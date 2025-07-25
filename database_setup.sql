-- Create users table for ScreenMerch application
-- This table stores user profile information

CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100),
    display_name VARCHAR(100),
    profile_image_url TEXT,
    cover_image_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create videos2 table for video uploads
CREATE TABLE IF NOT EXISTS videos2 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail TEXT,
    channelTitle VARCHAR(255),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    youtube_channel_id VARCHAR(255),
    youtube_video_id VARCHAR(255),
    verification_status VARCHAR(50) DEFAULT 'pending',
    price DECIMAL(10,2) DEFAULT 0,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_subscriptions table to store subscription tier information
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(50) NOT NULL DEFAULT 'free',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_subscription UNIQUE(user_id),
    CONSTRAINT valid_tier CHECK (tier IN ('free', 'pro')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid'))
);

-- Create subscriptions table for channel subscriptions (friend relationships)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscriber_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_subscription UNIQUE(channel_id, subscriber_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_videos2_user_id ON videos2(user_id);
CREATE INDEX IF NOT EXISTS idx_videos2_youtube_channel_id ON videos2(youtube_channel_id);
CREATE INDEX IF NOT EXISTS idx_videos2_created_at ON videos2(created_at);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier ON user_subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_channel_id ON subscriptions(channel_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber_id ON subscriptions(subscriber_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update the updated_at column
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos2_updated_at 
    BEFORE UPDATE ON videos2 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at 
    BEFORE UPDATE ON user_subscriptions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for the users table
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create policies for videos2 table
CREATE POLICY "Users can view all videos" ON videos2
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own videos" ON videos2
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos" ON videos2
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own videos" ON videos2
    FOR DELETE USING (auth.uid() = user_id);

-- Create policies for user_subscriptions table
CREATE POLICY "Users can view own subscription" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription" ON user_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow public read access to user subscriptions for sidebar display
CREATE POLICY "Public can view user subscriptions" ON user_subscriptions
    FOR SELECT USING (status = 'active');

-- Create policies for subscriptions table (channel subscriptions)
CREATE POLICY "Users can view subscriptions they are part of" ON subscriptions
    FOR SELECT USING (auth.uid() = channel_id OR auth.uid() = subscriber_id);

CREATE POLICY "Users can create subscriptions for themselves" ON subscriptions
    FOR INSERT WITH CHECK (auth.uid() = subscriber_id);

CREATE POLICY "Users can delete their own subscriptions" ON subscriptions
    FOR DELETE USING (auth.uid() = subscriber_id OR auth.uid() = channel_id);

-- Public read access for basic profile info (optional)
CREATE POLICY "Public can view basic user info" ON users
    FOR SELECT USING (true);

-- Function to automatically create basic subscription when user is created
CREATE OR REPLACE FUNCTION create_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_subscriptions (user_id, tier, status)
    VALUES (NEW.id, 'basic', 'active');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically create basic subscription for new users
CREATE TRIGGER auto_create_user_subscription
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_subscription();

-- Insert a sample user (optional - for testing)
-- INSERT INTO users (id, email, display_name, bio) 
-- VALUES (
--     '00000000-0000-0000-0000-000000000000',
--     'test@example.com',
--     'Test User',
--     'This is a test user profile'
-- ); 