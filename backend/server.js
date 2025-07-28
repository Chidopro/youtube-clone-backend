const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const { supabase, supabaseAdmin } = require('./supabase');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 3002;

app.use(express.json());

// A more robust CORS configuration
const allowedOrigins = [
    'https://screenmerch.com', // Your production domain
    'https://www.screenmerch.com' // Also allow www subdomain
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

const store = new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'your_default_session_secret',
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
        secure: true, // Set to true for HTTPS in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://backend-hidden-firefly-7865.fly.dev/api/callback'
);

// 1. Login
app.get('/api/login', (req, res) => {
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/youtube.readonly'
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes
    });
    res.json({ url });
});

// 2. Callback
app.get('/api/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Fetch Google profile
        const oauth2 = google.oauth2({
            auth: oauth2Client,
            version: 'v2'
        });
        const { data: googleProfile } = await oauth2.userinfo.get();
        
        // Fetch YouTube channel info
        const youtube = google.youtube({
            version: 'v3',
            auth: oauth2Client
        });

        const { data: channelData } = await youtube.channels.list({
            mine: true,
            part: 'id,snippet,statistics'
        });

        const youtubeChannel = channelData.items[0];
        const username = googleProfile.name.replace(/\s+/g, '').toLowerCase();

        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .upsert(
                {
                    username: username,
                    youtube_channel_id: youtubeChannel.id,
                    channel_title: youtubeChannel.snippet.title,
                    profile_image_url: youtubeChannel.snippet.thumbnails.default.url,
                },
                { onConflict: 'youtube_channel_id' }
            )
            .select();

        if (profileError) {
            console.error('Error saving profile to Supabase:', profileError);
            return res.status(500).send('Error saving user profile');
        }

        const user = {
            google: {
                id: googleProfile.id,
                name: googleProfile.name,
                email: googleProfile.email,
                picture: googleProfile.picture
            },
            tokens,
            youtube: youtubeChannel
        };
        req.session.user = user;

        res.redirect('https://screenmerch.com/dashboard');

    } catch (error) {
        console.error('Error during Google Auth callback:', error);
        res.status(500).send('Authentication failed');
    }
});

// 3. Get current user
app.get('/api/me', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// 4. Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.status(200).json({ success: true, message: 'Logged out' });
});

// 5. Get User's Uploaded Videos
app.get('/api/my-videos', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const youtubeChannelId = req.session.user.youtube.id;

    try {
        const { data, error } = await supabase
            .from('videos2')
            .select('*')
            .eq('youtube_channel_id', youtubeChannelId)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching user videos:', error);
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
});

// 6. Get Public Videos for a Channel
app.get('/api/users/:username/videos', async (req, res) => {
    const { username } = req.params;
    console.log(`[${new Date().toISOString()}] 1. Received request for user: ${username}`);
    try {
        console.log(`[${new Date().toISOString()}] 2. Querying 'profiles' table for username: ${username}`);
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('youtube_channel_id')
            .eq('username', username)
            .single();
        console.log(`[${new Date().toISOString()}] 3. 'profiles' query finished.`);

        if (profileError || !profile) {
            console.error(`[${new Date().toISOString()}] 4. Profile not found for username: ${username}. Error: ${profileError?.message}`);
            return res.status(404).json({ error: 'User not found' });
        }
        
        console.log(`[${new Date().toISOString()}] 5. Profile found. YouTube Channel ID: ${profile.youtube_channel_id}`);
        console.log(`[${new Date().toISOString()}] 6. Querying 'videos2' table for channel ID: ${profile.youtube_channel_id}`);
        const { data: videos, error: videosError } = await supabase
            .from('videos2')
            .select('*')
            .eq('youtube_channel_id', profile.youtube_channel_id)
            .order('created_at', { ascending: false });
        console.log(`[${new Date().toISOString()}] 7. 'videos2' query finished.`);

        if (videosError) {
            console.error(`[${new Date().toISOString()}] 8. Error fetching videos for channel ID: ${profile.youtube_channel_id}. Error: ${videosError.message}`);
            throw videosError;
        }

        console.log(`[${new Date().toISOString()}] 9. Found ${videos.length} videos. Sending response.`);
        res.status(200).json(videos);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] FATAL: Error fetching videos for ${username}:`, error);
        res.status(500).json({ error: 'Failed to fetch user videos' });
    }
});

// 7. Get User Subscription Tier
app.get('/api/users/:username/subscription', async (req, res) => {
    const { username } = req.params;
    
    try {
        // For now, we'll use a simple logic based on username
        // In a real implementation, this would query a subscriptions table
        const thirdTierUsernames = ['admin', 'premium', 'tier3', 'screenmerch', 'cheedov'];
        
        const isThirdTier = thirdTierUsernames.includes(username);
        
        // Mock subscription data
        const subscriptionData = {
            username: username,
            tier: isThirdTier ? 'third' : 'basic',
            isThirdTier: isThirdTier,
            features: isThirdTier ? [
                'Invite friends to create content',
                'Share revenue from friend sales',
                'Friends list sidebar',
                'Advanced analytics'
            ] : [
                'Basic video upload',
                'Standard features'
            ],
            revenueShare: isThirdTier ? 0.15 : 0, // 15% revenue share for third tier
            maxFriends: isThirdTier ? 50 : 0
        };
        
        res.status(200).json(subscriptionData);
    } catch (error) {
        console.error('Error fetching subscription data:', error);
        res.status(500).json({ error: 'Failed to fetch subscription data' });
    }
});

// 8. Delete User Account (Complete)
app.delete('/api/users/:userId/delete-account', async (req, res) => {
    const { userId } = req.params;
    
    try {
        console.log('Attempting to delete account for user:', userId);

        // Delete from database tables first
        try {
            // Delete user profile and related data
            const { error: profileError } = await supabase
                .from('users')
                .delete()
                .eq('id', userId);

            if (profileError) {
                console.error('Error deleting user profile:', profileError);
            }

            // Delete subscriptions
            await supabase
                .from('subscriptions')
                .delete()
                .eq('user_id', userId);

            await supabase
                .from('user_subscriptions')
                .delete()
                .eq('user_id', userId);

            // Friend functionality removed - no friend requests to delete

            // Delete videos
            await supabase
                .from('videos2')
                .delete()
                .eq('user_id', userId);

            console.log('Database cleanup completed for user:', userId);
        } catch (dbError) {
            console.error('Error during database cleanup:', dbError);
        }

        // Delete from storage
        try {
            const { data: files } = await supabase.storage
                .from('profile-images')
                .list('', { 
                    limit: 100,
                    search: userId 
                });

            if (files && files.length > 0) {
                const filePaths = files.map(file => file.name);
                await supabase.storage
                    .from('profile-images')
                    .remove(filePaths);
            }

            console.log('Storage cleanup completed for user:', userId);
        } catch (storageError) {
            console.error('Error during storage cleanup:', storageError);
        }

        // Delete the Supabase Auth user
        try {
            if (!supabaseAdmin) {
                console.log('No admin client available, skipping auth user deletion');
                res.status(200).json({ 
                    success: true, 
                    message: 'Account data deleted successfully. Auth user still exists (no admin privileges).' 
                });
                return;
            }

            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
            
            if (authError) {
                console.error('Error deleting auth user:', authError);
                // Even if auth deletion fails, we've cleaned up the data
                res.status(200).json({ 
                    success: true, 
                    message: 'Account data deleted successfully. Auth user may still exist.' 
                });
            } else {
                console.log('Auth user deleted successfully:', userId);
                res.status(200).json({ 
                    success: true, 
                    message: 'Account completely deleted successfully.' 
                });
            }
        } catch (authError) {
            console.error('Error during auth deletion:', authError);
            res.status(200).json({ 
                success: true, 
                message: 'Account data deleted successfully. Auth user may still exist.' 
            });
        }

    } catch (error) {
        console.error('Error deleting user account:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete account completely' 
        });
    }
});

// --- Stripe Subscription Endpoints ---

// Create Premium Tier Checkout Session
app.post('/api/create-premium-checkout', async (req, res) => {
    try {
        const { userId, userEmail, userName, tier } = req.body;

        if (!userId || !userEmail) {
            return res.status(400).json({ error: 'User ID and email are required' });
        }

        // Create or retrieve Stripe customer
        let customer;
        try {
            const existingCustomers = await stripe.customers.list({
                email: userEmail,
                limit: 1
            });
            
            if (existingCustomers.data.length > 0) {
                customer = existingCustomers.data[0];
            } else {
                customer = await stripe.customers.create({
                    email: userEmail,
                    name: userName,
                    metadata: {
                        userId: userId,
                        tier: tier
                    }
                });
            }
        } catch (customerError) {
            console.error('Error creating/retrieving customer:', customerError);
            return res.status(500).json({ error: 'Failed to create customer' });
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'ScreenMerch Premium Tier',
                        description: 'Advanced analytics, priority support, custom branding, and enhanced upload limits'
                    },
                    unit_amount: 999, // $9.99 in cents
                    recurring: {
                        interval: 'month'
                    }
                },
                quantity: 1
            }],
            success_url: `${process.env.FRONTEND_URL || 'https://screenmerch.com'}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'https://screenmerch.com'}/subscription-tiers`,
            metadata: {
                userId: userId,
                tier: tier
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// Handle successful subscription webhook
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            
            // Update user subscription in database
            try {
                const { userId, tier } = session.metadata;
                const subscription = await stripe.subscriptions.retrieve(session.subscription);
                
                const { error } = await supabase
                    .from('user_subscriptions')
                    .upsert({
                        user_id: userId,
                        tier: tier,
                        status: 'active',
                        stripe_subscription_id: subscription.id,
                        stripe_customer_id: session.customer,
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                        updated_at: new Date().toISOString()
                    }, { 
                        onConflict: 'user_id' 
                    });

                if (error) {
                    console.error('Error updating subscription in database:', error);
                }
            } catch (dbError) {
                console.error('Database error in webhook:', dbError);
            }
            break;
            
        case 'invoice.payment_succeeded':
            // Handle successful recurring payment
            console.log('Payment succeeded for subscription:', event.data.object.subscription);
            break;
            
        case 'invoice.payment_failed':
            // Handle failed payment
            console.log('Payment failed for subscription:', event.data.object.subscription);
            break;
            
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({received: true});
});

// Verify subscription success
app.get('/api/verify-subscription/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        if (session.payment_status === 'paid') {
            res.json({ 
                success: true, 
                subscription_id: session.subscription,
                customer_id: session.customer 
            });
        } else {
            res.json({ success: false, message: 'Payment not completed' });
        }
    } catch (error) {
        console.error('Error verifying subscription:', error);
        res.status(500).json({ error: 'Failed to verify subscription' });
    }
});

// Create Creator Network Tier Checkout Session
app.post('/api/create-creator-network-checkout', async (req, res) => {
    try {
        const { userId, userEmail, userName, tier } = req.body;

        if (!userId || !userEmail) {
            return res.status(400).json({ error: 'User ID and email are required' });
        }

        // Create or retrieve Stripe customer
        let customer;
        try {
            const existingCustomers = await stripe.customers.list({
                email: userEmail,
                limit: 1
            });
            
            if (existingCustomers.data.length > 0) {
                customer = existingCustomers.data[0];
            } else {
                customer = await stripe.customers.create({
                    email: userEmail,
                    name: userName,
                    metadata: {
                        userId: userId,
                        tier: tier
                    }
                });
            }
        } catch (customerError) {
            console.error('Error creating/retrieving customer:', customerError);
            return res.status(500).json({ error: 'Failed to create customer' });
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'ScreenMerch Creator Network Tier',
                        description: 'Everything in Premium, invite friends, revenue sharing, advanced creator tools, network analytics, up to 50 friends'
                    },
                    unit_amount: 2999, // $29.99 in cents
                    recurring: {
                        interval: 'month'
                    }
                },
                quantity: 1
            }],
            success_url: `${process.env.FRONTEND_URL || 'https://screenmerch.com'}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'https://screenmerch.com'}/subscription-tiers`,
            metadata: {
                userId: userId,
                tier: 'creator_network'
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Friendly root route
app.get('/', (req, res) => {
  res.send('Backend API is running!');
});
// --- Video Upload Endpoint ---
app.post('/api/upload', async (req, res) => {
    if (!req.session.user || !req.session.user.youtube) {
        return res.status(401).json({ error: 'You must be logged in to upload a video.' });
    }

    const { videoUrl, title, description, price } = req.body;
    const { youtube } = req.session.user;

    if (!videoUrl) {
        return res.status(400).json({ error: 'Video URL is required.' });
    }

    try {
        const videoId = new URL(videoUrl).searchParams.get('v');
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL.' });
        }

        const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${YOUTUBE_API_KEY}`);
        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            return res.status(404).json({ error: 'YouTube video not found.' });
        }

        const videoDetails = data.items[0];

        if (videoDetails.snippet.channelId !== youtube.id) {
            return res.status(403).json({ error: 'This video does not belong to your authenticated YouTube channel.' });
        }

        const { error: dbError } = await supabase
            .from('videos2')
            .insert([{
                video_url: videoUrl,
                title: title || videoDetails.snippet.title,
                description: description || videoDetails.snippet.description,
                thumbnail: videoDetails.snippet.thumbnails.high.url,
                channelTitle: videoDetails.snippet.channelTitle,
                youtube_video_id: videoId,
                youtube_channel_id: videoDetails.snippet.channelId,
                price: price || 0,
                verification_status: 'Verified'
            }]);

        if (dbError) {
            console.error('Supabase insert error:', dbError);
            return res.status(500).json({ error: 'Failed to save video to database.' });
        }

        res.status(200).json({ success: true, message: 'Video uploaded successfully!' });

    } catch (error) {
        console.error('Upload process error:', error);
        res.status(500).json({ error: 'An unexpected error occurred during the upload process.' });
    }
}); 