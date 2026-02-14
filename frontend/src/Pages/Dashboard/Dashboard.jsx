import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Dashboard.css';
import { supabase } from '../../supabaseClient';
import { SubscriptionService } from '../../utils/subscriptionService';
import { AdminService } from '../../utils/adminService';
import { fetchMyProfileFromBackend } from '../../utils/userService';
import PersonalizationSettings from '../../Components/PersonalizationSettings/PersonalizationSettings.jsx';
// Force Netlify rebuild


const Dashboard = ({ sidebar }) => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        display_name: '',
        bio: '',
        cover_image_url: '',
        profile_image_url: ''
    });
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imagePreview, setImagePreview] = useState({
        cover: null,
        profile: null
    });

    const [isEditingCover, setIsEditingCover] = useState(false);
    const [isEditingAvatar, setIsEditingAvatar] = useState(false);
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('videos');

    // Open Personalization tab when URL has ?tab=personalization (e.g. from navbar logo edit)
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'personalization') setActiveTab('personalization');
    }, [searchParams]);
    const [currentUser, setCurrentUser] = useState(null);
    const [payoutData, setPayoutData] = useState({
        paypal_email: '',
        tax_id: ''
    });
    const [payoutLoading, setPayoutLoading] = useState(false);
    const [payoutMessage, setPayoutMessage] = useState('');
    const [favorites, setFavorites] = useState([]);
    const [uploadingFavorite, setUploadingFavorite] = useState(false);
    const [showFavoriteModal, setShowFavoriteModal] = useState(false);
    const [newFavorite, setNewFavorite] = useState({
        title: '',
        description: '',
        image: null,
        imagePreview: null
    });
    const [analyticsData, setAnalyticsData] = useState({
        total_sales: 0,
        total_revenue: 0,
        products_sold_count: 0,
        videos_with_sales_count: 0,
        avg_order_value: 0,
        products_sold: [],
        recent_sales: [],
        daily_sales: []  // Last 7 days of sales data
    });
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [isMasterAdmin, setIsMasterAdmin] = useState(false);
    const [editingVideo, setEditingVideo] = useState(null);
    const [editVideoForm, setEditVideoForm] = useState({
        title: '',
        thumbnail: '',
        video_url: ''
    });
    const [uploadingVideoFile, setUploadingVideoFile] = useState(false);
    const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const modalContentRef = useRef(null);
    

    const navigate = useNavigate();


    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Check for authenticated user (email login or OAuth)
                const isAuthenticated = localStorage.getItem('isAuthenticated');
                const userData = localStorage.getItem('user');
                
                let user = null;
                
                if (isAuthenticated === 'true' && userData) {
                    // User from localStorage (email login or OAuth)
                    user = JSON.parse(userData);
                    console.log('🔐 Dashboard: Found authenticated user from localStorage:', user);
                } else {
                    // Fallback to Supabase auth
                    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
                    if (supabaseUser) {
                        user = supabaseUser;
                        console.log('🔐 Dashboard: Found Supabase user:', user);
                    }
                }
                
                if (!user) {
                    console.log('🔐 Dashboard: No authenticated user found, redirecting to home');
                    navigate('/');
                    return;
                }

                setUser(user);

                // CRITICAL: Fetch user profile from backend (safe fields only)
                let profile = null;
                if (user.id) {
                    console.log('🔍 [DASHBOARD] Fetching latest profile from backend for user ID:', user.id);
                    profile = await fetchMyProfileFromBackend(user.id);
                    if (profile) {
                        console.log('✅ [DASHBOARD] Fetched profile from backend:', {
                            profile_image_url: profile?.profile_image_url,
                            cover_image_url: profile?.cover_image_url,
                            display_name: profile?.display_name
                        });
                    }
                }

                if (profile) {
                    // CRITICAL: Use database values directly (same as cover_image_url)
                    // Don't override database values with fallbacks - let the image src handle fallbacks
                    const finalProfileImageUrl = profile.profile_image_url || '';
                    const finalCoverImageUrl = profile.cover_image_url || '';
                    
                    // Merge profile with user data - use database values directly
                    const mergedProfile = {
                        ...profile,
                        profile_image_url: finalProfileImageUrl,
                        cover_image_url: finalCoverImageUrl
                    };
                    
                    setUserProfile(mergedProfile);
                    setEditForm({
                        display_name: profile.display_name || '',
                        bio: profile.bio || '',
                        cover_image_url: finalCoverImageUrl,
                        profile_image_url: finalProfileImageUrl
                    });
                    
                    // CRITICAL: Update localStorage with latest database values
                    const updatedUser = {
                        ...user,
                        profile_image_url: finalProfileImageUrl,
                        cover_image_url: finalCoverImageUrl,
                        display_name: profile.display_name || user.display_name || user.user_metadata?.name || '',
                        bio: profile.bio || user.bio || ''
                    };
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                    console.log('💾 [DASHBOARD] Updated localStorage with profile_image_url:', updatedUser.profile_image_url);
                    
                    // CRITICAL: Also update user state so image src resolution works immediately
                    setUser(updatedUser);
                    console.log('✅ [DASHBOARD] Updated user state with profile_image_url:', updatedUser.profile_image_url);
                    
                    // Load payout data if available
                    setPayoutData({
                        paypal_email: profile.paypal_email || '',
                        tax_id: profile.tax_id || ''
                    });
                } else {
                    // Fallback: For users without database profile, use localStorage data
                    console.log('⚠️ [DASHBOARD] No database profile found, using localStorage data');
                    // Priority: user.profile_image_url > user.picture > user.user_metadata?.picture
                    const profileImageUrl = user.profile_image_url || user.picture || user.user_metadata?.picture || '';
                    const coverImageUrl = user.cover_image_url || '';
                    // Create userProfile object with all available data
                    const userProfileData = {
                        ...user,
                        profile_image_url: profileImageUrl,
                        cover_image_url: coverImageUrl,
                        display_name: user.display_name || user.user_metadata?.name || '',
                        bio: user.bio || ''
                    };
                    setUserProfile(userProfileData);
                    setEditForm({
                        display_name: userProfileData.display_name,
                        bio: userProfileData.bio,
                        cover_image_url: userProfileData.cover_image_url,
                        profile_image_url: profileImageUrl
                    });
                }

                // Fetch user subscription
                const userSubscription = await SubscriptionService.getCurrentUserSubscription();
                setSubscription(userSubscription);

                // Fetch user's videos from Supabase (only if user has an ID)
                if (user.id) {
                    const { data: userVideos, error: videosError } = await supabase
                        .from('videos2')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });

                    if (userVideos) {
                        setVideos(userVideos);
                    }
                    
                    // Fetch user's favorites
                    const { data: userFavorites, error: favoritesError } = await supabase
                        .from('creator_favorites')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });
                    
                    if (userFavorites) {
                        setFavorites(userFavorites);
                    }
                } else {
                    // For Google OAuth users without database ID, show empty videos
                    setVideos([]);
                    setFavorites([]);
                }

            } catch (error) {
                console.error('Error fetching data:', error);
                navigate('/');
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, [navigate]);

    useEffect(() => {
        const fetchCurrentUser = async () => {
            // Check for Google OAuth user first
            const isAuthenticated = localStorage.getItem('isAuthenticated');
            const userData = localStorage.getItem('user');
            
            if (isAuthenticated === 'true' && userData) {
                // Google OAuth user
                const googleUser = JSON.parse(userData);
                setCurrentUser({ ...googleUser, role: 'creator' });
            } else {
                // Fallback to Supabase auth
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('users')
                        .select('role')
                        .eq('id', user.id)
                        .single();
                    setCurrentUser({ ...user, ...profile });
                } else {
                    setCurrentUser(null);
                }
            }
        };
        fetchCurrentUser();
    }, []);


    const uploadImageToSupabase = async (file, type) => {
        try {
            setUploadingImage(true);
            
            // Create a unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${type}-${Date.now()}.${fileExt}`;
            
            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('profile-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('Error uploading image:', error);
                alert('Failed to upload image. Please try again.');
                return null;
            }

            // Get the public URL
            const { data: { publicUrl } } = supabase.storage
                .from('profile-images')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Error in uploadImageToSupabase:', error);
            alert('Failed to upload image. Please try again.');
            return null;
        } finally {
            setUploadingImage(false);
        }
    };

    const handleFileUpload = async (file, type) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB.');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setImagePreview(prev => ({
                ...prev,
                [type]: e.target.result
            }));
        };
        reader.readAsDataURL(file);

        // Upload to Supabase
        const imageUrl = await uploadImageToSupabase(file, type);
        if (imageUrl) {
            setEditForm(prev => ({
                ...prev,
                [`${type}_image_url`]: imageUrl
            }));
        }
    };

    const handleSaveProfile = async () => {
        try {
            // Get user ID - support both Google OAuth and Supabase auth
            let userId = user?.id;
            
            // If user doesn't have id but has email, look up user in database
            if (!userId && user?.email) {
                console.log('🔐 Dashboard: User missing id, looking up by email:', user.email);
                try {
                    const { data: profileData, error: lookupError } = await supabase
                        .from('users')
                        .select('id')
                        .eq('email', user.email)
                        .single();
                    
                    if (profileData && profileData.id) {
                        userId = profileData.id;
                        console.log('🔐 Dashboard: Found user id from database:', userId);
                    }
                } catch (lookupErr) {
                    console.error('Error looking up user by email:', lookupErr);
                }
            }
            
            if (!userId) {
                console.error('Error: No user ID available');
                alert('Error: Unable to identify user. Please try logging in again.');
                return;
            }
            
            // Use backend API endpoint to bypass RLS
            const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://screenmerch.fly.dev';
            console.log('💾 Dashboard: Saving profile for user:', userId);
            console.log('💾 Dashboard: Profile data:', {
                display_name: editForm.display_name,
                bio: editForm.bio,
                cover_image_url: editForm.cover_image_url,
                profile_image_url: editForm.profile_image_url,
            });
            
            const response = await fetch(`${BACKEND_URL}/api/users/${userId}/update-profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    display_name: editForm.display_name,
                    bio: editForm.bio,
                    cover_image_url: editForm.cover_image_url,
                    profile_image_url: editForm.profile_image_url,
                }),
            });

            console.log('💾 Dashboard: Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                let errorData;
                if (contentType && contentType.includes('application/json')) {
                    errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                } else {
                    const text = await response.text();
                    console.error('💾 Dashboard: Non-JSON error response:', text);
                    errorData = { error: `Server error: ${response.status} - ${text.substring(0, 100)}` };
                }
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const data = await response.json();
            
            // Backend returns the updated user with the latest profile_image_url from database
            const backendUpdatedUser = data?.user;
            console.log('💾 Dashboard: Backend returned updated user:', backendUpdatedUser);
            console.log('💾 Dashboard: Updated profile_image_url from backend:', backendUpdatedUser?.profile_image_url);
            
            // Update local state with backend response (most up-to-date)
            const updatedProfile = backendUpdatedUser || {
                ...userProfile,
                display_name: editForm.display_name,
                bio: editForm.bio,
                cover_image_url: editForm.cover_image_url,
                profile_image_url: editForm.profile_image_url,
            };
            setUserProfile(updatedProfile);
            
            // Update user object in localStorage if it exists
            const userData = localStorage.getItem('user');
            let updatedUser = null;
            if (userData) {
                try {
                    const userObj = JSON.parse(userData);
                    // Use backend response if available, otherwise use form data
                    updatedUser = {
                        ...userObj,
                        profile_image_url: backendUpdatedUser?.profile_image_url || editForm.profile_image_url,
                        cover_image_url: backendUpdatedUser?.cover_image_url || editForm.cover_image_url,
                        display_name: backendUpdatedUser?.display_name || editForm.display_name,
                        bio: backendUpdatedUser?.bio || editForm.bio,
                    };
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                    setUser(updatedUser);
                    console.log('💾 Dashboard: Updated localStorage with profile_image_url:', updatedUser.profile_image_url);
                } catch (e) {
                    console.error('Error updating localStorage user:', e);
                }
            }
            
            // Dispatch event to notify Navbar and other components of profile update
            // CRITICAL: Use backendUpdatedUser (from backend response) as it has the latest database values
            // Merge with updatedUser to ensure we have all fields (id, role, etc.)
            const userForEvent = backendUpdatedUser ? {
                ...updatedUser,
                ...backendUpdatedUser, // Backend response takes priority
                profile_image_url: backendUpdatedUser.profile_image_url || updatedUser?.profile_image_url,
                cover_image_url: backendUpdatedUser.cover_image_url || updatedUser?.cover_image_url,
            } : updatedUser;
            
            if (userForEvent) {
                console.log('📡 Dashboard: Preparing to dispatch events with profile_image_url:', userForEvent.profile_image_url);
                
                // Dispatch profileUpdated event IMMEDIATELY with backend response (no delay needed - backend already saved)
                window.dispatchEvent(new CustomEvent('profileUpdated', { 
                    detail: { user: userForEvent } 
                }));
                console.log('📡 Dashboard: ✅ Dispatched profileUpdated event IMMEDIATELY with profile_image_url:', userForEvent.profile_image_url);
                
                // Also dispatch userLoggedIn for compatibility
                window.dispatchEvent(new CustomEvent('userLoggedIn', { 
                    detail: { user: userForEvent } 
                }));
                console.log('📡 Dashboard: Dispatched userLoggedIn event with profile image:', userForEvent.profile_image_url);
            }
            
            setIsEditing(false);
            setImagePreview({ cover: null, profile: null });
            
            console.log('✅ Profile saved successfully via backend API');
        } catch (error) {
            console.error('Error saving profile:', error);
            alert(`Failed to save profile: ${error.message || 'Unknown error'}`);
        }
    };



    const handleDeleteVideo = async (videoId, videoTitle, event) => {
        // Prevent the card click event from triggering
        event.stopPropagation();
        
        // Show confirmation dialog
        const isConfirmed = window.confirm(`Are you sure you want to delete "${videoTitle}"? This action cannot be undone.`);
        
        if (!isConfirmed) {
            return;
        }

        try {
            const result = await AdminService.deleteVideo(videoId);
            
            if (result.success) {
                // Remove the video from the local state
                setVideos(prevVideos => prevVideos.filter(video => video.id !== videoId));
                alert('Video deleted successfully!');
            } else {
                alert(`Failed to delete video: ${result.error}`);
            }
        } catch (error) {
            console.error('Error deleting video:', error);
            alert('Failed to delete video. Please try again.');
        }
    };

    const handleUploadFavorite = async () => {
        if (!newFavorite.title || !newFavorite.image) {
            alert('Please provide a title and image.');
            return;
        }

        // Try to get user ID from Supabase Auth first
        let userId = null;
        let authError = null;
        
        const { data: { user: supabaseUser }, error: authErr } = await supabase.auth.getUser();
        
        if (supabaseUser && supabaseUser.id) {
            userId = supabaseUser.id;
            console.log('Using Supabase Auth user ID:', userId);
        } else {
            authError = authErr;
            console.log('No Supabase Auth session, checking for Google OAuth user...');
            
            // Try to get user ID from users table (for Google OAuth users)
            const isAuthenticated = localStorage.getItem('isAuthenticated');
            const userData = localStorage.getItem('user');
            
            if (isAuthenticated === 'true' && userData) {
                try {
                    const googleUser = JSON.parse(userData);
                    console.log('Found Google OAuth user:', googleUser);
                    
                    // Try to find user in users table by email
                    if (googleUser.email) {
                        const { data: userRecord, error: userError } = await supabase
                            .from('users')
                            .select('id')
                            .eq('email', googleUser.email)
                            .single();
                        
                        if (userRecord && userRecord.id) {
                            userId = userRecord.id;
                            console.log('Found user ID from users table:', userId);
                        } else {
                            console.error('User not found in users table:', userError);
                        }
                    }
                } catch (e) {
                    console.error('Error parsing Google OAuth user:', e);
                }
            }
        }
        
        if (!userId) {
            console.error('Auth error:', authError);
            alert('Authentication required. Please ensure you are logged in. If you are using Google OAuth, you may need to sign in through Supabase Auth to upload favorites.');
            return;
        }

        try {
            setUploadingFavorite(true);

            // Validate file size (max 5MB)
            if (newFavorite.image.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB.');
                setUploadingFavorite(false);
                return;
            }

            // Upload image to Supabase storage
            const fileExt = newFavorite.image.name.split('.').pop();
            const fileName = `${userId}/favorites/${Date.now()}.${fileExt}`;
            
            console.log('Uploading favorite image:', fileName);
            console.log('User ID:', userId);
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('thumbnails')
                .upload(fileName, newFavorite.image, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('Error uploading image:', uploadError);
                console.error('Error details:', JSON.stringify(uploadError, null, 2));
                
                // Try alternative bucket if thumbnails fails
                if (uploadError.message && uploadError.message.includes('not found')) {
                    alert('Storage bucket not found. Please check your Supabase storage configuration.');
                } else if (uploadError.message && uploadError.message.includes('row-level security')) {
                    alert('Permission denied. Please check your Supabase storage policies.');
                } else {
                    alert(`Failed to upload image: ${uploadError.message || 'Unknown error'}`);
                }
                setUploadingFavorite(false);
                return;
            }

            console.log('Image uploaded successfully:', uploadData);

            const { data: { publicUrl } } = supabase.storage
                .from('thumbnails')
                .getPublicUrl(fileName);

            console.log('Public URL:', publicUrl);

            // Get channel title - use same logic as videos (display_name || username)
            // This must match exactly what Profile.jsx queries for
            const channelTitle = userProfile?.display_name || userProfile?.username || 'Unknown';
            console.log('Saving favorite to database with channelTitle:', channelTitle);
            console.log('User profile data:', { display_name: userProfile?.display_name, username: userProfile?.username });

            // Save favorite to database
            // Use camelCase channelTitle to match database schema (quoted column name "channelTitle")
            let insertData = {
                user_id: userId,
                channelTitle: channelTitle,  // Use camelCase to match database column "channelTitle"
                title: newFavorite.title,
                description: newFavorite.description || null,
                image_url: publicUrl,
                thumbnail_url: publicUrl
            };
            
            const { data, error } = await supabase
                .from('creator_favorites')
                .insert(insertData)
                .select()
                .single();

            if (error) {
                console.error('Error saving favorite:', error);
                console.error('Error details:', JSON.stringify(error, null, 2));
                
                // If error is about column name, try with lowercase as fallback
                if (error.message && (error.message.includes('channelTitle') || error.message.includes('channeltitle'))) {
                    console.log('Retrying with lowercase column name as fallback...');
                    const retryData = {
                        user_id: userId,
                        channeltitle: channelTitle,  // Try lowercase as fallback
                        title: newFavorite.title,
                        description: newFavorite.description || null,
                        image_url: publicUrl,
                        thumbnail_url: publicUrl
                    };
                    
                    const { data: retryData_result, error: retryError } = await supabase
                        .from('creator_favorites')
                        .insert(retryData)
                        .select()
                        .single();
                    
                    if (retryError) {
                        console.error('Retry also failed:', retryError);
                        alert(`Failed to save favorite: ${retryError.message || 'Unknown error'}. Please check that the creator_favorites table exists and has the correct columns.`);
                    } else {
                        console.log('Favorite saved successfully with lowercase column:', retryData_result);
                        setFavorites(prev => [retryData_result, ...prev]);
                        setNewFavorite({ title: '', description: '', image: null, imagePreview: null });
                        setShowFavoriteModal(false);
                        alert('Favorite uploaded successfully!');
                    }
                    setUploadingFavorite(false);
                    return;
                }
                
                alert(`Failed to save favorite: ${error.message || 'Unknown error'}`);
            } else {
                console.log('Favorite saved successfully:', data);
                // Add to local state
                setFavorites(prev => [data, ...prev]);
                // Reset form and close modal
                setNewFavorite({ title: '', description: '', image: null, imagePreview: null });
                setShowFavoriteModal(false);
                alert('Favorite uploaded successfully!');
            }
        } catch (error) {
            console.error('Error uploading favorite:', error);
            console.error('Error stack:', error.stack);
            alert(`Failed to upload favorite: ${error.message || 'Unknown error'}`);
        } finally {
            setUploadingFavorite(false);
        }
    };

    const handleMakeMerchFromFavorite = async (favorite) => {
        // Check if user is authenticated
        const isAuthenticated = localStorage.getItem('user_authenticated');
        const googleAuthenticated = localStorage.getItem('isAuthenticated');
        const isLoggedIn = (isAuthenticated === 'true') || (googleAuthenticated === 'true');
        
        if (!isLoggedIn) {
            // Store favorite data for after login
            const merchData = {
                thumbnail: favorite.image_url || favorite.thumbnail_url,
                screenshots: [favorite.image_url || favorite.thumbnail_url],
                videoUrl: window.location.href,
                videoTitle: favorite.title || 'Favorite Image',
                creatorName: favorite.channeltitle || favorite.channelTitle || userProfile?.display_name || userProfile?.username || 'Unknown Creator'
            };
            localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
            alert('Please log in to create merchandise');
            return;
        }
        
        // User is authenticated, save data and navigate to merchandise page
        const merchData = {
            thumbnail: favorite.image_url || favorite.thumbnail_url,
            screenshots: [favorite.image_url || favorite.thumbnail_url],
            videoUrl: window.location.href,
            videoTitle: favorite.title || 'Favorite Image',
            creatorName: favorite.channeltitle || favorite.channelTitle || userProfile?.display_name || userProfile?.username || 'Unknown Creator'
        };
        localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
        
        // Navigate to merchandise categories page
        navigate('/merchandise');
    };

    const handleDeleteFavorite = async (favoriteId, favoriteTitle) => {
        const isConfirmed = window.confirm(`Are you sure you want to delete "${favoriteTitle}"? This action cannot be undone.`);
        
        if (!isConfirmed) {
            return;
        }

        try {
            const { error } = await supabase
                .from('creator_favorites')
                .delete()
                .eq('id', favoriteId);

            if (error) {
                console.error('Error deleting favorite:', error);
                alert('Failed to delete favorite. Please try again.');
            } else {
                // Remove from local state
                setFavorites(prev => prev.filter(fav => fav.id !== favoriteId));
                alert('Favorite deleted successfully!');
            }
        } catch (error) {
            console.error('Error deleting favorite:', error);
            alert('Failed to delete favorite. Please try again.');
        }
    };

    const handleEditVideo = (video, event) => {
        event.stopPropagation();
        setEditingVideo(video);
        setEditVideoForm({
            title: video.title || '',
            thumbnail: video.thumbnail || '',
            video_url: video.video_url || ''
        });
        setThumbnailPreview(null);
    };

    // Reset scroll position when modal opens and ensure content is visible
    useEffect(() => {
        if (editingVideo && modalContentRef.current) {
            // Reset scroll to top
            modalContentRef.current.scrollTop = 0;
            // Force a reflow to ensure content is properly positioned
            modalContentRef.current.offsetHeight;
        }
    }, [editingVideo]);

    const handleCancelEdit = () => {
        setEditingVideo(null);
        setEditVideoForm({ title: '', thumbnail: '', video_url: '' });
        setThumbnailPreview(null);
    };

    const uploadThumbnailToSupabase = async (file) => {
        try {
            setUploadingThumbnail(true);
            
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/thumbnails/${Date.now()}.${fileExt}`;
            
            const { data, error } = await supabase.storage
                .from('thumbnails')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('Error uploading thumbnail:', error);
                alert('Failed to upload thumbnail. Please try again.');
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('thumbnails')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Error in uploadThumbnailToSupabase:', error);
            alert('Failed to upload thumbnail. Please try again.');
            return null;
        } finally {
            setUploadingThumbnail(false);
        }
    };

    const uploadVideoToSupabase = async (file) => {
        try {
            setUploadingVideoFile(true);
            
            if (!user || !user.id) {
                alert('User not found. Please sign in again.');
                return null;
            }
            
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/videos/${Date.now()}.${fileExt}`;
            
            console.log('Attempting to upload video:', fileName);
            console.log('User ID:', user.id);
            
            const { data, error } = await supabase.storage
                .from('videos2')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('Error uploading video:', error);
                console.error('Error details:', JSON.stringify(error, null, 2));
                
                if (error.message && error.message.includes('row-level security')) {
                    alert('Upload failed: Permission denied. The storage policies may not allow uploads for your account. Please use the Video URL field instead, or ensure you are authenticated through Supabase Auth.');
                } else if (error.message && error.message.includes('new row violates')) {
                    alert('Upload failed: Storage policy error. Please check your Supabase storage policies or use the Video URL field instead.');
                } else {
                    alert(`Failed to upload video: ${error.message || 'Unknown error. Please try using the Video URL field instead.'}`);
                }
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('videos2')
                .getPublicUrl(fileName);

            console.log('Video uploaded successfully:', publicUrl);
            return publicUrl;
        } catch (error) {
            console.error('Error in uploadVideoToSupabase:', error);
            console.error('Error stack:', error.stack);
            alert(`Failed to upload video: ${error.message || 'Please try again or use the Video URL field instead.'}`);
            return null;
        } finally {
            setUploadingVideoFile(false);
        }
    };

    const handleThumbnailChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB.');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setThumbnailPreview(e.target.result);
        };
        reader.readAsDataURL(file);

        // Upload to Supabase
        const thumbnailUrl = await uploadThumbnailToSupabase(file);
        if (thumbnailUrl) {
            setEditVideoForm(prev => ({ ...prev, thumbnail: thumbnailUrl }));
        }
    };

    const handleVideoFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('video/')) {
            alert('Please select a valid video file.');
            return;
        }

        // Upload to Supabase
        const videoUrl = await uploadVideoToSupabase(file);
        if (videoUrl) {
            setEditVideoForm(prev => ({ ...prev, video_url: videoUrl }));
        }
    };

    const handleSaveVideo = async () => {
        if (!editingVideo) return;

        try {
            const updates = {};
            if (editVideoForm.title.trim()) {
                updates.title = editVideoForm.title.trim();
            }
            if (editVideoForm.thumbnail) {
                updates.thumbnail = editVideoForm.thumbnail;
            }
            if (editVideoForm.video_url) {
                updates.video_url = editVideoForm.video_url;
            }

            if (Object.keys(updates).length === 0) {
                alert('No changes to save.');
                return;
            }

            const result = await AdminService.updateVideo(editingVideo.id, updates);
            
            if (result.success) {
                // Update the video in the local state
                setVideos(prevVideos => 
                    prevVideos.map(video => 
                        video.id === editingVideo.id 
                            ? { ...video, ...updates }
                            : video
                    )
                );
                alert('Video updated successfully!');
                handleCancelEdit();
            } else {
                alert(`Failed to update video: ${result.error}`);
            }
        } catch (error) {
            console.error('Error updating video:', error);
            alert('Failed to update video. Please try again.');
        }
    };

    // Check if current user is master admin (so we only show Reset Sales to them)
    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!user?.email) return;
            try {
                const status = await AdminService.checkAdminStatus();
                if (mounted) setIsMasterAdmin(status?.isMasterAdmin || false);
            } catch (_) {
                if (mounted) setIsMasterAdmin(false);
            }
        })();
        return () => { mounted = false; };
    }, [user?.email]);

    // Fetch analytics data
    const fetchAnalytics = async () => {
        if (!user || !user.id) {
            console.warn('Cannot fetch analytics: user not found');
            return;
        }

        setAnalyticsLoading(true);
        try {
            const BACKEND_URL = 
                (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
                "https://screenmerch.fly.dev";

            const response = await fetch(`${BACKEND_URL}/api/analytics?user_id=${user.id}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`Analytics API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('📊 Analytics data received:', data);
            
            setAnalyticsData({
                total_sales: data.total_sales || 0,
                total_revenue: data.total_revenue || 0,
                avg_order_value: data.avg_order_value || 0,
                products_sold_count: data.products_sold_count || 0,
                videos_with_sales_count: data.videos_with_sales_count || 0,
                sales_data: data.sales_data || [],
                products_sold: data.products_sold || [],
                videos_with_sales: data.videos_with_sales || [],
                recent_sales: data.recent_sales || [],
                daily_sales: data.daily_sales || []  // Last 7 days of sales data
            });
        } catch (error) {
            console.error('Error fetching analytics:', error);
            // Don't show alert, just log - analytics might not be critical
        } finally {
            setAnalyticsLoading(false);
        }
    };



    // Check if user has proper role or needs to be created/updated
    if (currentUser && (!currentUser.role || currentUser.role !== 'creator')) {
        console.log('User role issue:', currentUser.role, 'User:', currentUser);
        return <div className="dashboard-error">
            Access denied. Only creators can view this page.
            <br />
            <button onClick={async () => {
                try {
                    console.log('Fixing role for user:', currentUser.id);
                    
                    // First check if user exists in users table
                    const { data: existingUser, error: checkError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', currentUser.id)
                        .single();
                    
                    if (checkError && checkError.code === 'PGRST116') {
                        // User doesn't exist, create them
                        console.log('User not found, creating new user record');
                        const { data: newUser, error: createError } = await supabase
                            .from('users')
                            .upsert({
                                id: currentUser.id,
                                email: currentUser.email,
                                username: currentUser.email?.split('@')[0] || 'user',
                                display_name: currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User',
                                role: 'creator',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }, {
                                onConflict: 'id',
                                ignoreDuplicates: false
                            })
                            .select();
                        
                        if (createError) {
                            console.error('Error creating user:', createError);
                            // If it's a duplicate key error, try to update instead
                            if (createError.message.includes('duplicate key')) {
                                console.log('Duplicate key detected, updating existing user');
                                const { data: updatedUser, error: updateError } = await supabase
                                    .from('users')
                                    .update({
                                        role: 'creator',
                                        updated_at: new Date().toISOString()
                                    })
                                    .eq('id', currentUser.id)
                                    .select();
                                
                                if (updateError) {
                                    console.error('Error updating user:', updateError);
                                    alert('Failed to update user: ' + updateError.message);
                                } else {
                                    console.log('User updated successfully:', updatedUser);
                                    alert('User updated! Reloading page...');
                                    window.location.reload();
                                }
                            } else {
                                alert('Failed to create user: ' + createError.message);
                            }
                        } else {
                            console.log('User created successfully:', newUser);
                            alert('User created! Reloading page...');
                            window.location.reload();
                        }
                    } else if (existingUser) {
                        // User exists, update their role
                        const { data, error } = await supabase
                            .from('users')
                            .update({ role: 'creator' })
                            .eq('id', currentUser.id)
                            .select();
                        
                        if (error) {
                            console.error('Error updating role:', error);
                            alert('Failed to update role: ' + error.message);
                        } else {
                            console.log('Role updated successfully:', data);
                            alert('Role updated! Reloading page...');
                            window.location.reload();
                        }
                    } else {
                        console.error('Unexpected error checking user:', checkError);
                        alert('Error checking user: ' + checkError.message);
                    }
                } catch (err) {
                    console.error('Error in role fix:', err);
                    alert('Error fixing role: ' + err.message);
                }
            }} style={{marginTop: '10px', padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>
                Fix Role & Reload
            </button>
        </div>;
    }

    if (loading) {
        return <div className="dashboard-loading">Loading your dashboard...</div>;
    }

    if (!user) {
        return <div className="dashboard-error">Please log in to see your dashboard.</div>;
    }

    return (
        <div className={`dashboard-container ${sidebar ? "" : " large-container"}`}>
            {/* User's Custom Channel Header - Cheedo V Style */}
            <div className="channel-header">
                <div className="channel-cover-container">
                    {/* Cover Image */}
                    {isEditingCover ? (
                        <div className="edit-cover-section">
                            <div className="cover-edit-backdrop" onClick={() => { setIsEditingCover(false); setImagePreview(prev => ({ ...prev, cover: null })); }} />
                            <div className="cover-edit-overlay" onClick={e => e.stopPropagation()}>
                                <div className="cover-edit-controls">
                                    <button className="cover-edit-close-btn" onClick={() => { setIsEditingCover(false); setImagePreview(prev => ({ ...prev, cover: null })); }} title="Close">×</button>
                                    <h3>📸 Update Cover Image</h3>
                                    <div className="file-upload-section">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0], 'cover')}
                                            id="cover-upload"
                                            className="file-input"
                                            disabled={uploadingImage}
                                        />
                                        <label htmlFor="cover-upload" className="file-upload-btn">
                                            {uploadingImage ? '⏳ Uploading...' : '📁 Choose Cover Image'}
                                        </label>
                                    </div>
                                    <p className="edit-tip">💡 Tip: Max 5MB, high-quality image (1920x1080 recommended)</p>
                                </div>
                            </div>
                            {(imagePreview.cover || editForm.cover_image_url) && (
                                <img 
                                    src={imagePreview.cover || editForm.cover_image_url || userProfile?.cover_image_url || 'https://images.unsplash.com/photo-1557683316-973673baf926?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'} 
                                    alt="Cover preview" 
                                    className="channel-cover-photo"
                                />
                            )}
                        </div>
                    ) : (
                        <div className="cover-image-container">
                            <img
                                className="channel-cover-photo"
                                src={editForm.cover_image_url || userProfile?.cover_image_url || 'https://images.unsplash.com/photo-1557683316-973673baf926?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'}
                                alt="Channel Cover"
                            />
                            <button className="corner-edit-icon cover-edit" onClick={() => setIsEditingCover(true)} title="Edit cover image">
                                ✏️
                            </button>
                        </div>
                    )}
                    {/* Channel Info Overlay */}
                    <div className="channel-info-overlay">
                        <div className="channel-avatar-container">
                            {isEditingAvatar ? (
                                <div className="edit-avatar-section">
                                    <img
                                        className="channel-avatar editing"
                                        src={imagePreview.profile || editForm.profile_image_url || userProfile?.profile_image_url || user?.profile_image_url || user?.user_metadata?.picture || user?.picture || '/default-avatar.jpg'}
                                        alt="Channel Avatar"
                                    />
                                    <div className="avatar-upload-section">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0], 'profile')}
                                            id="avatar-upload"
                                            className="file-input"
                                            disabled={uploadingImage}
                                        />
                                        <label htmlFor="avatar-upload" className="avatar-upload-btn">
                                            {uploadingImage ? '⏳ Uploading...' : '📷 Change Avatar'}
                                        </label>
                                    </div>
                                    <div className="avatar-edit-buttons">
                                        <button 
                                            onClick={async () => {
                                                await handleSaveProfile();
                                                setIsEditingAvatar(false);
                                                setImagePreview(prev => ({ ...prev, profile: null }));
                                            }} 
                                            className="save-btn"
                                            disabled={uploadingImage}
                                        >
                                            Save
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setIsEditingAvatar(false);
                                                setImagePreview(prev => ({ ...prev, profile: null }));
                                                // Reset to original profile_image_url
                                                setEditForm(prev => ({
                                                    ...prev,
                                                    profile_image_url: userProfile?.profile_image_url || ''
                                                }));
                                            }} 
                                            className="cancel-btn"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="avatar-with-edit">
                                    <img
                                        className="channel-avatar"
                                        src={(() => {
                                            // Priority order for image URL:
                                            // 1. userProfile.profile_image_url (from database)
                                            // 2. user.profile_image_url (from localStorage)
                                            // 3. user.picture or user.user_metadata?.picture (for Google OAuth users)
                                            // 4. default avatar
                                            const imageUrl = (userProfile?.profile_image_url && userProfile.profile_image_url.trim() !== '') 
                                                ? userProfile.profile_image_url
                                                : (user?.profile_image_url && user.profile_image_url.trim() !== '')
                                                    ? user.profile_image_url
                                                    : user?.user_metadata?.picture || user?.picture || '/default-avatar.jpg';
                                            return imageUrl;
                                        })()}
                                        alt="Channel Avatar"
                                    />
                                    <button className="corner-edit-icon avatar-edit" onClick={() => setIsEditingAvatar(true)} title="Edit avatar">
                                        ✏️
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="channel-details">
                            {isEditing ? (
                                <div className="edit-details-section">
                                    <input
                                        type="text"
                                        placeholder="Display name"
                                        value={editForm.display_name}
                                        onChange={(e) => setEditForm({...editForm, display_name: e.target.value})}
                                        className="edit-input edit-title"
                                    />
                                    <textarea
                                        placeholder="Bio/Description"
                                        value={editForm.bio}
                                        onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                                        className="edit-textarea"
                                        rows="2"
                                    />
                                </div>
                            ) : (
                                <>
                                    <h1 className="channel-name">
                                        {userProfile?.display_name || user.user_metadata?.name || 'Your Channel'}
                                    </h1>
                                    <p className="channel-username">@{userProfile?.username || 'username'}</p>
                                    {userProfile?.bio && (
                                        <p className="channel-bio">{userProfile.bio}</p>
                                    )}

                                </>
                            )}
                        </div>
                        <div className="edit-controls">
                            {isEditing ? (
                                <div className="edit-buttons">
                                    <button onClick={handleSaveProfile} className="save-btn">Save Changes</button>
                                    <button onClick={() => setIsEditing(false)} className="cancel-btn">Cancel</button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="dashboard-tabs">
                <button 
                    className={`tab-button ${activeTab === 'videos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('videos')}
                >
                    📹 Videos ({videos.length})
                </button>
                <button 
                    className={`tab-button ${activeTab === 'favorites' ? 'active' : ''}`}
                    onClick={() => {
                        console.log('Favorites tab clicked');
                        setActiveTab('favorites');
                    }}
                >
                    ⭐ Favorites ({favorites.length})
                </button>
                <button 
                    className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('analytics');
                        fetchAnalytics();
                    }}
                >
                    📊 Analytics
                </button>
                <button 
                    className={`tab-button ${activeTab === 'payout' ? 'active' : ''}`}
                    onClick={() => setActiveTab('payout')}
                >
                    💰 Payout Setup
                </button>
                <button 
                    className={`tab-button ${activeTab === 'personalization' ? 'active' : ''}`}
                    onClick={() => setActiveTab('personalization')}
                >
                    🎨 Personalization
                </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {/* Videos Tab */}
                {activeTab === 'videos' && (
                    <div className="videos-tab">
                        {/* Getting Started Tips - Moved to top */}
                        <div className="getting-started-section">
                            <h2>Getting Started</h2>
                            <div className="tips-grid">
                                <div className="tip-card">
                                    <h4>🎨 Customize Your Channel</h4>
                                    <p>Add a cover image, profile picture, and bio to make your channel unique.</p>
                                </div>
                                <div className="tip-card clickable" onClick={() => navigate('/upload')}>
                                    <h4>📹 Upload Content</h4>
                                    <p>Start sharing your videos and build your audience.</p>
                                    <div className="card-action">Click to upload →</div>
                                </div>
                                <div className="tip-card">
                                    <h4>📊 Check Your Analytics</h4>
                                    <p>Monitor your sales and track your performance.</p>
                                </div>
                            </div>
                        </div>

                        {/* User's Videos Section */}
                        <div className="user-videos-section">
                            <div className="section-header">
                                <h2>Your Videos ({videos.length})</h2>
                            </div>
                            
                            {videos.length > 0 ? (
                                <div className="dashboard-video-grid">
                                    {videos.map(video => (
                                        <div 
                                            key={video.id} 
                                            className="dashboard-video-card"
                                            onClick={() => {
                                                // For creators, navigate to screenshot selection page (product page in creator mode)
                                                // Save video data to localStorage for ProductPage to use
                                                // Note: videos2 table doesn't have screenshots field, so we'll use empty array
                                                // Screenshots can be generated from video or added later
                                                const merchData = {
                                                    thumbnail: video.thumbnail || '',
                                                    screenshots: video.screenshots || [], // Empty if not available
                                                    videoUrl: video.video_url || '',
                                                    videoTitle: video.title || 'Unknown Video',
                                                    creatorName: userProfile?.display_name || userProfile?.username || 'Unknown Creator',
                                                    videoId: video.id
                                                };
                                                localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
                                                localStorage.setItem('creator_favorites_mode', 'true');
                                                // Navigate to product page in creator favorites mode
                                                navigate('/product/browse?category=mens&creatorMode=favorites');
                                            }}
                                        >
                                            <img src={video.thumbnail} alt={video.title} className="dashboard-video-thumbnail" />
                                            <div className="dashboard-video-info">
                                                <h4>{video.title}</h4>
                                                <p>{new Date(video.created_at).toLocaleDateString()}</p>
                                                <span className="video-views">0 views</span>
                                            </div>
                                            <button className="edit-video-btn" onClick={(e) => handleEditVideo(video, e)} title="Edit Video">
                                                ✏️
                                            </button>
                                            <button className="delete-video-btn" onClick={(e) => handleDeleteVideo(video.id, video.title, e)} title="Delete Video">
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="no-videos-placeholder">
                                    <div className="placeholder-content">
                                        <h3>No videos yet</h3>
                                        <p>Start building your content library by uploading your first video!</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Favorites Tab */}
                {activeTab === 'favorites' && (
                    <div className="favorites-tab">
                        <div className="section-header">
                            <h2>⭐ Your Favorites ({favorites.length})</h2>
                            <button 
                                className="add-favorite-btn"
                                onClick={() => {
                                    setNewFavorite({ title: '', description: '', image: null, imagePreview: null });
                                    setShowFavoriteModal(true);
                                }}
                            >
                                + Add Favorite
                            </button>
                        </div>
                        
                        {favorites.length > 0 ? (
                            <div className="dashboard-video-grid">
                                {favorites.map(favorite => (
                                    <div 
                                        key={favorite.id} 
                                        className="dashboard-video-card"
                                    >
                                        <img 
                                            src={favorite.image_url || favorite.thumbnail_url || 'https://via.placeholder.com/320x180?text=No+Image'} 
                                            alt={favorite.title} 
                                            className="dashboard-video-thumbnail" 
                                        />
                                        <div className="dashboard-video-info">
                                            <h4>{favorite.title}</h4>
                                            {favorite.description && <p>{favorite.description}</p>}
                                            <span className="video-views">{new Date(favorite.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <button 
                                            className="make-merch-btn-favorite-dashboard"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleMakeMerchFromFavorite(favorite);
                                            }}
                                        >
                                            Make Merch
                                        </button>
                                        <button 
                                            className="delete-video-btn" 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteFavorite(favorite.id, favorite.title);
                                            }} 
                                            title="Delete Favorite"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="no-videos-placeholder">
                                <div className="placeholder-content">
                                    <h3>No favorites yet</h3>
                                    <p>Upload your favorite images for users to create merchandise from!</p>
                                    <button 
                                        className="add-favorite-btn"
                                        onClick={() => {
                                            setNewFavorite({ title: '', description: '', image: null, imagePreview: null });
                                            setShowFavoriteModal(true);
                                        }}
                                    >
                                        + Add Your First Favorite
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* Favorite Upload Modal */}
                        {showFavoriteModal && (
                            <div className="favorite-modal-overlay" onClick={() => setShowFavoriteModal(false)}>
                                <div className="favorite-modal-content" onClick={(e) => e.stopPropagation()} ref={modalContentRef}>
                                    <span className="favorite-modal-close" onClick={() => setShowFavoriteModal(false)}>&times;</span>
                                    <h2>Upload Favorite Image</h2>
                                <div className="upload-form">
                                    <div className="form-group">
                                        <label>Title *</label>
                                        <input
                                            type="text"
                                            value={newFavorite.title}
                                            onChange={(e) => setNewFavorite({...newFavorite, title: e.target.value})}
                                            placeholder="Enter favorite title"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Description</label>
                                        <textarea
                                            value={newFavorite.description}
                                            onChange={(e) => setNewFavorite({...newFavorite, description: e.target.value})}
                                            placeholder="Enter description (optional)"
                                            rows="3"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Image *</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (event) => {
                                                        setNewFavorite({
                                                            ...newFavorite,
                                                            image: file,
                                                            imagePreview: event.target.result
                                                        });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                        {newFavorite.imagePreview && (
                                            <img 
                                                src={newFavorite.imagePreview} 
                                                alt="Preview" 
                                                style={{ maxWidth: '100%', marginTop: '10px', borderRadius: '8px' }}
                                            />
                                        )}
                                    </div>
                                    <div className="form-actions">
                                        <button 
                                            className="save-btn" 
                                            onClick={handleUploadFavorite}
                                            disabled={uploadingFavorite || !newFavorite.title || !newFavorite.image}
                                        >
                                            {uploadingFavorite ? 'Uploading...' : 'Upload Favorite'}
                                        </button>
                                        <button 
                                            className="cancel-btn" 
                                            onClick={() => {
                                                setShowFavoriteModal(false);
                                                setNewFavorite({ title: '', description: '', image: null, imagePreview: null });
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Analytics Tab */}
                {activeTab === 'analytics' && (
                    <div className="analytics-tab">
                        {/* Sales Analytics Section */}
                        <div className="sales-analytics-section">
                            <div className="section-header">
                                <h2>📊 Sales Analytics</h2>
                                <div className="analytics-summary">
                                    <span className="total-sales">Total Sales: {analyticsLoading ? 'Loading...' : analyticsData.total_sales}</span>
                                    <span className="total-revenue">Total Revenue: ${analyticsLoading ? '0.00' : analyticsData.total_revenue.toFixed(2)}</span>
                                    {isMasterAdmin && (
                                    <button 
                                        onClick={async () => {
                                            if (!window.confirm('⚠️ WARNING: This will permanently delete all your sales data. This action cannot be undone. Are you absolutely sure?')) {
                                                return;
                                            }
                                            
                                            if (!window.confirm('This is your final warning. All sales records will be deleted. Continue?')) {
                                                return;
                                            }
                                            
                                            try {
                                                const BACKEND_URL = 
                                                    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
                                                    "https://screenmerch.fly.dev";
                                                
                                                const userEmail = user?.email || userProfile?.email;
                                                
                                                const response = await fetch(`${BACKEND_URL}/api/admin/reset-sales`, {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        'X-User-Email': userEmail
                                                    },
                                                    body: JSON.stringify({
                                                        user_id: user.id
                                                    })
                                                });
                                                
                                                const data = await response.json();
                                                
                                                if (data.success) {
                                                    alert(`✅ Sales reset successfully! Deleted ${data.deleted_count || 0} sales records.`);
                                                    // Refresh analytics
                                                    fetchAnalytics();
                                                } else {
                                                    alert(`❌ Failed to reset sales: ${data.error || 'Unknown error'}`);
                                                }
                                            } catch (error) {
                                                console.error('Error resetting sales:', error);
                                                alert(`❌ Error resetting sales: ${error.message}`);
                                            }
                                        }}
                                        style={{
                                            marginLeft: '20px',
                                            padding: '8px 16px',
                                            backgroundColor: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                        title="Reset all sales data (Master Admin only)"
                                    >
                                        🔄 Reset Sales
                                    </button>
                                    )}
                                </div>
                            </div>
                            
                            <div className="analytics-dashboard">
                                {/* Sales Per Day Overview */}
                                <div className="analytics-overview-cards">
                                    <div className="analytics-card">
                                        <h4>📈 Sales Per Day</h4>
                                        <div className="analytics-amount">{analyticsLoading ? '...' : analyticsData.total_sales}</div>
                                        <div className="analytics-change">{analyticsLoading ? 'Loading...' : analyticsData.total_sales > 0 ? 'Active sales' : 'No data yet'}</div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>🛍️ Products Sold</h4>
                                        <div className="analytics-amount">{analyticsLoading ? '...' : analyticsData.products_sold_count}</div>
                                        <div className="analytics-change">{analyticsLoading ? 'Loading...' : analyticsData.products_sold_count > 0 ? 'Products selling' : 'No data yet'}</div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>🎬 Videos with Sales</h4>
                                        <div className="analytics-amount">{analyticsLoading ? '...' : analyticsData.videos_with_sales_count}</div>
                                        <div className="analytics-change">{analyticsLoading ? 'Loading...' : analyticsData.videos_with_sales_count > 0 ? 'Videos performing' : 'No data yet'}</div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>💰 Avg Order Value</h4>
                                        <div className="analytics-amount">${analyticsLoading ? '0.00' : analyticsData.avg_order_value.toFixed(2)}</div>
                                        <div className="analytics-change">{analyticsLoading ? 'Loading...' : analyticsData.avg_order_value > 0 ? 'Good average' : 'No data yet'}</div>
                                    </div>
                                </div>
                                
                                {/* Enhanced Sales Chart */}
                                <div className="sales-chart-section">
                                                                         <div className="chart-header">
                                         <h3>📊 Sales Analytics Dashboard</h3>
                                         <div className="service-fee-info">
                                             <span className="fee-badge">30% Service Fee</span>
                                             <span className="fee-explanation">Net revenue shown after fees</span>
                                         </div>
                                     </div>
                                    
                                    {/* Daily Sales Chart */}
                                    <div className="chart-section">
                                        <h4>📅 Daily Sales (Last 7 Days)</h4>
                                        <div className="daily-chart-container">
                                            <div className="daily-chart-bars">
                                                {analyticsData.daily_sales && analyticsData.daily_sales.length > 0 ? (() => {
                                                    const dailySales = analyticsData.daily_sales;
                                                    const maxSales = Math.max(...dailySales.map(d => d.sales_count || 0), 1);
                                                    const maxBarHeightPx = 160;
                                                    return dailySales.map((dayData, i) => {
                                                        const isToday = i === dailySales.length - 1;
                                                        const salesCount = dayData.sales_count || 0;
                                                        const netRevenue = dayData.net_revenue || 0;
                                                        const revenue = dayData.revenue || 0;
                                                        const barHeightPx = salesCount > 0 ? Math.max((salesCount / maxSales) * maxBarHeightPx, 20) : 0;
                                                        return (
                                                            <div key={i} className="daily-bar-container">
                                                                <div 
                                                                    className={`daily-bar ${salesCount > 0 ? 'has-sales' : 'no-sales'} ${isToday ? 'today' : ''}`}
                                                                    style={{ height: `${barHeightPx}px` }}
                                                                    title={`${dayData.date_display}: ${salesCount} sales | Gross: $${revenue.toFixed(2)} | Net: $${netRevenue.toFixed(2)}`}
                                                                >
                                                                    <span className="daily-bar-value">{salesCount}</span>
                                                                </div>
                                                                <div className="daily-bar-label">{dayData.date_display}</div>
                                                                {salesCount > 0 && (
                                                                    <div className="daily-bar-revenue">${netRevenue.toFixed(2)}</div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })() : (
                                                    // Fallback if daily_sales is not available yet
                                                    Array.from({length: 7}, (_, i) => {
                                                        const date = new Date();
                                                        date.setDate(date.getDate() - (6 - i));
                                                        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                                        const isToday = i === 6;
                                                        const salesCount = 0;
                                                        
                                                        return (
                                                            <div key={i} className="daily-bar-container">
                                                                <div 
                                                                    className={`daily-bar no-sales ${isToday ? 'today' : ''}`}
                                                                    style={{height: '0px'}}
                                                                    title={`${dateStr}: 0 sales`}
                                                                >
                                                                    <span className="daily-bar-value">0</span>
                                                                </div>
                                                                <div className="daily-bar-label">{dateStr}</div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Weekly Summary */}
                                    <div className="weekly-summary">
                                        <h4>📊 Weekly Summary</h4>
                                        <div className="summary-grid">
                                            <div className="summary-card">
                                                <div className="summary-label">This Week</div>
                                                <div className="summary-value">{analyticsData.total_sales}</div>
                                                <div className="summary-subtitle">Total Sales</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-label">Gross Revenue</div>
                                                <div className="summary-value">${analyticsData.total_revenue.toFixed(2)}</div>
                                                <div className="summary-subtitle">Before fees</div>
                                            </div>
                                            <div className="summary-card highlight">
                                                <div className="summary-label">Net Revenue</div>
                                                <div className="summary-value">${(analyticsData.total_revenue * 0.7).toFixed(2)}</div>
                                                <div className="summary-subtitle">After 30% fee</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-label">Service Fee</div>
                                                <div className="summary-value">${(analyticsData.total_revenue * 0.3).toFixed(2)}</div>
                                                <div className="summary-subtitle">Platform fee</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Recent Sales Activity */}
                                    <div className="recent-activity">
                                        <h4>🕒 Recent Sales Activity</h4>
                                        <div className="activity-list">
                                            {analyticsData.recent_sales && analyticsData.recent_sales.length > 0 ? (
                                                analyticsData.recent_sales.slice(0, 5).map((sale, index) => {
                                                    // Format time ago
                                                    let timeAgo = 'Recently';
                                                    try {
                                                        if (sale.created_at && sale.created_at !== 'N/A') {
                                                            const saleDate = new Date(sale.created_at);
                                                            const now = new Date();
                                                            const diffMs = now - saleDate;
                                                            const diffMins = Math.floor(diffMs / 60000);
                                                            const diffHours = Math.floor(diffMs / 3600000);
                                                            const diffDays = Math.floor(diffMs / 86400000);
                                                            
                                                            if (diffMins < 1) {
                                                                timeAgo = 'Just now';
                                                            } else if (diffMins < 60) {
                                                                timeAgo = `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
                                                            } else if (diffHours < 24) {
                                                                timeAgo = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
                                                            } else {
                                                                timeAgo = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
                                                            }
                                                        }
                                                    } catch (e) {
                                                        timeAgo = 'Recently';
                                                    }
                                                    
                                                    return (
                                                        <div key={index} className="activity-item">
                                                            <div className="activity-icon">💰</div>
                                                            <div className="activity-details">
                                                                <div className="activity-title">Sale completed</div>
                                                                <div className="activity-subtitle">Product: {sale.product} | Net: ${sale.net_amount?.toFixed(2) || (sale.amount * 0.7).toFixed(2)}</div>
                                                            </div>
                                                            <div className="activity-time">{timeAgo}</div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="activity-item">
                                                    <div className="activity-icon">📊</div>
                                                    <div className="activity-details">
                                                        <div className="activity-title">No recent sales</div>
                                                        <div className="activity-subtitle">Start making sales to see activity here</div>
                                                    </div>
                                                    <div className="activity-time">—</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Products Sold Chart */}
                                <div className="products-sold-chart">
                                    <h3>🛍️ Products Sold</h3>
                                    
                                    {analyticsData.products_sold && analyticsData.products_sold.length > 0 ? (
                                        <div className="products-chart-container">
                                            {analyticsData.products_sold.map((product, index) => {
                                                const maxQuantity = Math.max(...analyticsData.products_sold.map(p => p.quantity));
                                                const barWidth = maxQuantity > 0 ? (product.quantity / maxQuantity) * 100 : 0;
                                                
                                                return (
                                                    <div key={index} className="product-chart-item">
                                                        <div className="product-chart-header">
                                                            <div className="product-name">{product.product}</div>
                                                            <div className="product-stats">
                                                                <span className="quantity">{product.quantity} sold</span>
                                                                <span className="revenue">${product.revenue.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="product-chart-bar-container">
                                                            <div 
                                                                className="product-chart-bar" 
                                                                style={{width: `${barWidth}%`}}
                                                                title={`${product.quantity} units sold - $${product.revenue.toFixed(2)} revenue`}
                                                            >
                                                                <span className="bar-label">{product.quantity}</span>
                                                            </div>
                                                        </div>
                                                        <div className="product-source">
                                                            <small>From: {product.video_source}</small>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="products-chart-empty">
                                            <div className="empty-icon">📦</div>
                                            <h4>No products sold yet</h4>
                                            <p>Start creating content to see your sales data here!</p>
                                        </div>
                                    )}
                                </div>
                                

                                

                            </div>
                        </div>
                    </div>
                )}

                {/* Personalization Tab */}
                {activeTab === 'personalization' && (
                    <div className="personalization-tab">
                        <PersonalizationSettings />
                    </div>
                )}

                {/* Payout Setup Tab */}
                {activeTab === 'payout' && (
                    <div className="payout-tab">
                        <div className="payout-section">
                            <div className="section-header">
                                <p className="payout-main-description">Configure your payment information to receive earnings from your sales</p>
                            </div>

                            {payoutMessage && (
                                <div className={`payout-message ${payoutMessage.includes('error') || payoutMessage.includes('Failed') ? 'error' : 'success'}`}>
                                    {payoutMessage}
                                </div>
                            )}

                            <form 
                                className="payout-form"
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    setPayoutLoading(true);
                                    setPayoutMessage('');

                                    try {
                                        if (!user || !user.id) {
                                            throw new Error('User not found');
                                        }

                                        const updateData = {
                                            paypal_email: payoutData.paypal_email.trim(),
                                            tax_id: payoutData.tax_id.trim() || null
                                        };

                                        const { data, error } = await supabase
                                            .from('users')
                                            .update(updateData)
                                            .eq('id', user.id)
                                            .select()
                                            .single();

                                        if (error) throw error;

                                        setPayoutMessage('Payout information saved successfully!');
                                        setUserProfile({ ...userProfile, ...updateData });
                                        
                                        // Clear message after 3 seconds
                                        setTimeout(() => setPayoutMessage(''), 3000);
                                    } catch (error) {
                                        console.error('Error saving payout info:', error);
                                        setPayoutMessage(`Failed to save payout information: ${error.message}`);
                                    } finally {
                                        setPayoutLoading(false);
                                    }
                                }}
                            >
                                <div className="payout-form-group">
                                    <label htmlFor="paypal-email" className="payout-label">
                                        PayPal Email <span className="required">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        id="paypal-email"
                                        className="payout-input"
                                        placeholder="your.email@example.com"
                                        value={payoutData.paypal_email}
                                        onChange={(e) => setPayoutData({ ...payoutData, paypal_email: e.target.value })}
                                        disabled={payoutLoading}
                                        required
                                    />
                                    <p className="payout-help-text">
                                        This is where we'll send your earnings. Make sure it's a valid PayPal account.
                                    </p>
                                </div>

                                <div className="payout-form-group">
                                    <label htmlFor="tax-id" className="payout-label">
                                        Tax ID / SSN (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        id="tax-id"
                                        className="payout-input"
                                        placeholder="Enter your Tax ID or SSN"
                                        value={payoutData.tax_id}
                                        onChange={(e) => setPayoutData({ ...payoutData, tax_id: e.target.value })}
                                        disabled={payoutLoading}
                                    />
                                    <p className="payout-help-text">
                                        Required for tax reporting in some jurisdictions. Your information is encrypted and secure.
                                    </p>
                                </div>

                                <div className="payout-form-actions">
                                    <button
                                        type="submit"
                                        className="payout-save-btn"
                                        disabled={payoutLoading || !payoutData.paypal_email.trim()}
                                    >
                                        {payoutLoading ? (
                                            <>
                                                <span className="loading-spinner-small"></span>
                                                Saving...
                                            </>
                                        ) : (
                                            '💾 Save Payout Information'
                                        )}
                                    </button>
                                </div>
                            </form>

                            <div className="payout-info-box">
                                <h3>ℹ️ Important Information</h3>
                                <ul>
                                    <li>Your payout information is encrypted and stored securely</li>
                                    <li>Payments are processed monthly after you reach the minimum payout threshold</li>
                                    <li>You can update your payout information at any time</li>
                                    <li>Make sure your PayPal email is correct to avoid payment delays</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* Edit Video Modal */}
            {editingVideo && (
                <div className="edit-video-modal-overlay" onClick={handleCancelEdit}>
                    <div className="edit-video-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="edit-video-modal-header">
                            <h2>Edit Video</h2>
                            <button className="edit-video-modal-close" onClick={handleCancelEdit}>×</button>
                        </div>
                        <div className="edit-video-modal-content" ref={modalContentRef}>
                            <div className="edit-video-form-group">
                                <label htmlFor="edit-video-title">Video Name</label>
                                <input
                                    type="text"
                                    id="edit-video-title"
                                    value={editVideoForm.title}
                                    onChange={(e) => setEditVideoForm({ ...editVideoForm, title: e.target.value })}
                                    placeholder="Enter video name"
                                    className="edit-video-input"
                                />
                            </div>

                            <div className="edit-video-form-group">
                                <label htmlFor="edit-video-thumbnail">Thumbnail</label>
                                <div className="edit-video-thumbnail-preview">
                                    {(thumbnailPreview || editVideoForm.thumbnail) && (
                                        <img 
                                            src={thumbnailPreview || editVideoForm.thumbnail} 
                                            alt="Thumbnail preview" 
                                            className="thumbnail-preview-img"
                                        />
                                    )}
                                </div>
                                <input
                                    type="file"
                                    id="edit-video-thumbnail"
                                    accept="image/*"
                                    onChange={handleThumbnailChange}
                                    disabled={uploadingThumbnail}
                                    className="edit-video-file-input"
                                />
                                <label htmlFor="edit-video-thumbnail" className="edit-video-file-label">
                                    {uploadingThumbnail ? '⏳ Uploading...' : '📷 Choose Thumbnail Image'}
                                </label>
                                <p className="edit-video-tip">Max 5MB, recommended: 1280x720</p>
                            </div>

                            <div className="edit-video-form-group">
                                <label htmlFor="edit-video-url">Video URL</label>
                                <input
                                    type="text"
                                    id="edit-video-url"
                                    value={editVideoForm.video_url}
                                    onChange={(e) => setEditVideoForm({ ...editVideoForm, video_url: e.target.value })}
                                    placeholder="Enter video URL (YouTube or direct link)"
                                    className="edit-video-input"
                                />
                                <p className="edit-video-tip">Or upload a video file below</p>
                            </div>

                            <div className="edit-video-form-group">
                                <label htmlFor="edit-video-file">Upload Video File</label>
                                <input
                                    type="file"
                                    id="edit-video-file"
                                    accept="video/*"
                                    onChange={handleVideoFileChange}
                                    disabled={uploadingVideoFile}
                                    className="edit-video-file-input"
                                />
                                <label htmlFor="edit-video-file" className="edit-video-file-label">
                                    {uploadingVideoFile ? '⏳ Uploading...' : '🎬 Choose Video File'}
                                </label>
                                <p className="edit-video-tip">Max file size depends on your plan</p>
                            </div>
                        </div>
                        <div className="edit-video-modal-footer">
                            <button className="edit-video-cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                            <button className="edit-video-save-btn" onClick={handleSaveVideo} disabled={uploadingThumbnail || uploadingVideoFile}>
                                {uploadingThumbnail || uploadingVideoFile ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard; 
