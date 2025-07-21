import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { supabase } from '../../supabaseClient';
import { SubscriptionService } from '../../utils/subscriptionService';

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
    const [friendRequestStatus, setFriendRequestStatus] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);
    const [isEditingCover, setIsEditingCover] = useState(false);
    const [isEditingAvatar, setIsEditingAvatar] = useState(false);
    const [activeTab, setActiveTab] = useState('videos');
    const [currentUser, setCurrentUser] = useState(null);
    const navigate = useNavigate();

    // Sales data for the chart
    const salesData = [2, 4, 1, 3, 5, 2, 4, 6, 3, 2, 5, 4, 3, 2, 1, 4, 6, 3, 5, 2, 4, 3, 2, 1, 3, 4, 5, 2, 3, 4];
    const maxSales = Math.max(...salesData);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Get authenticated user from Supabase
                const { data: { user }, error } = await supabase.auth.getUser();
                
                if (!user) {
                    navigate('/');
                    return;
                }

                setUser(user);

                // Fetch user profile from users table
                const { data: profile, error: profileError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    setUserProfile(profile);
                    setEditForm({
                        display_name: profile.display_name || '',
                        bio: profile.bio || '',
                        cover_image_url: profile.cover_image_url || '',
                        profile_image_url: profile.profile_image_url || ''
                    });
                }

                // Fetch user subscription
                const userSubscription = await SubscriptionService.getCurrentUserSubscription();
                setSubscription(userSubscription);

                // Fetch user's videos from Supabase
                const { data: userVideos, error: videosError } = await supabase
                    .from('videos2')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (userVideos) {
                    setVideos(userVideos);
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
            const { data, error } = await supabase
                .from('users')
                .update({
                    display_name: editForm.display_name,
                    bio: editForm.bio,
                    cover_image_url: editForm.cover_image_url,
                    profile_image_url: editForm.profile_image_url,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id);

            if (!error) {
                setUserProfile({
                    ...userProfile,
                    ...editForm
                });
                setIsEditing(false);
                setImagePreview({ cover: null, profile: null });
            } else {
                console.error('Error updating profile:', error);
            }
        } catch (error) {
            console.error('Error saving profile:', error);
        }
    };

    const handleBeAFriend = () => {
        navigate('/channel-friend');
    };

    const canInviteFriends = subscription && SubscriptionService.getTierConfig(subscription.tier).canInviteFriends;

    if (currentUser && currentUser.role !== 'creator') {
        return <div className="dashboard-error">Access denied. Only creators can view this page.</div>;
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
                                        src={imagePreview.profile || editForm.profile_image_url || userProfile?.profile_image_url || user.user_metadata?.picture || '/default-avatar.jpg'}
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
                                </div>
                            ) : (
                                <div className="avatar-with-edit">
                                    <img
                                        className="channel-avatar"
                                        src={userProfile?.profile_image_url || user.user_metadata?.picture || '/default-avatar.jpg'}
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
                                    <button className="be-a-friend-btn" onClick={handleBeAFriend} disabled={isRequesting} style={{display:'inline-block', width:'auto', minWidth:'unset', textAlign:'center', padding:'10px 18px'}}>
                                        {isRequesting ? 'Requesting...' : 'Be A FRIEND'}
                                    </button>
                                    {friendRequestStatus === 'pending' && (
                                        <div style={{ color: '#ffc107', marginTop: 8 }}>You have already applied. Please wait for approval.</div>
                                    )}
                                    {friendRequestStatus === 'already_friend' && (
                                        <div style={{ color: '#28a745', marginTop: 8 }}>You are already friends with this channel!</div>
                                    )}
                                    {friendRequestStatus === 'success' && (
                                        <div style={{ color: '#28a745', marginTop: 8 }}>Request sent! The channel owner will review your application.</div>
                                    )}
                                    {friendRequestStatus === 'error' && (
                                        <div style={{ color: '#dc3545', marginTop: 8 }}>Failed to send request. Please try again.</div>
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
                    className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analytics')}
                >
                    📊 Analytics
                </button>
                {canInviteFriends && (
                    <button 
                        className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
                        onClick={() => setActiveTab('friends')}
                    >
                        👥 Friends Revenue
                    </button>
                )}
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {/* Videos Tab */}
                {activeTab === 'videos' && (
                    <div className="videos-tab">
                        {/* Quick Upload Section */}
                        <div className="quick-upload-section">
                            <div className="upload-card">
                                <div className="upload-icon">📹</div>
                                <h3>Upload New Video</h3>
                                <p>Share your content with the ScreenMerch community</p>
                                <button onClick={() => navigate('/upload')} className="primary-upload-btn">
                                    Start Upload
                                </button>
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
                                            onClick={() => navigate(`/video/${video.categoryId || 0}/${video.id}`)}
                                        >
                                            <img src={video.thumbnail} alt={video.title} className="dashboard-video-thumbnail" />
                                            <div className="dashboard-video-info">
                                                <h4>{video.title}</h4>
                                                <p>{new Date(video.created_at).toLocaleDateString()}</p>
                                                <span className="video-views">0 views</span>
                                            </div>
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

                        {/* Getting Started Tips */}
                        <div className="getting-started-section">
                            <h2>Getting Started</h2>
                            <div className="tips-grid">
                                <div className="tip-card">
                                    <h4>🎨 Customize Your Channel</h4>
                                    <p>Add a cover image, profile picture, and bio to make your channel unique.</p>
                                </div>
                                <div className="tip-card">
                                    <h4>📹 Upload Content</h4>
                                    <p>Start sharing your videos and build your audience.</p>
                                </div>
                                {canInviteFriends && (
                                    <div className="tip-card">
                                        <h4>👥 Invite Friends</h4>
                                        <p>With Creator Network tier, invite friends to collaborate and earn revenue!</p>
                                    </div>
                                )}
                                <div className="tip-card">
                                    <h4>⬆️ Upgrade Your Plan</h4>
                                    <p>
                                        <button onClick={() => navigate('/subscription-tiers')} className="upgrade-link">
                                            Explore subscription tiers
                                        </button> for more features.
                                    </p>
                                </div>
                            </div>
                        </div>
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
                                    <span className="total-sales">Total Sales: 47</span>
                                    <span className="total-revenue">Total Revenue: $1,247.50</span>
                                </div>
                            </div>
                            
                            <div className="analytics-dashboard">
                                {/* Sales Per Day Overview */}
                                <div className="analytics-overview-cards">
                                    <div className="analytics-card">
                                        <h4>📈 Sales Per Day</h4>
                                        <div className="analytics-amount">3.2</div>
                                        <div className="analytics-change">+0.8 vs last week</div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>🛍️ Products Sold</h4>
                                        <div className="analytics-amount">47</div>
                                        <div className="analytics-change">+12 this month</div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>🎬 Videos with Sales</h4>
                                        <div className="analytics-amount">8</div>
                                        <div className="analytics-change">3 new this month</div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>💰 Avg Order Value</h4>
                                        <div className="analytics-amount">$26.54</div>
                                        <div className="analytics-change">+$3.21 vs last month</div>
                                    </div>
                                </div>
                                
                                {/* Sales Per Day Chart */}
                                <div className="sales-chart-section">
                                    <h3>📊 Sales Per Day (Last 30 Days)</h3>
                                    <div className="chart-container">
                                        <div className="chart-bars">
                                            {salesData.map((height, index) => (
                                                <div 
                                                    key={index} 
                                                    className="chart-bar" 
                                                    style={{height: `${(height / maxSales) * 200}px`}}
                                                    title={`Day ${index + 1}: ${height} sales`}
                                                >
                                                    <span className="bar-value">{height}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="chart-labels">
                                            <span>1</span>
                                            <span>7</span>
                                            <span>14</span>
                                            <span>21</span>
                                            <span>30</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Products Sold Table */}
                                <div className="products-sold-table">
                                    <h3>🛍️ Products Sold</h3>
                                    <div className="table-header">
                                        <div>Product</div>
                                        <div>Quantity Sold</div>
                                        <div>Revenue</div>
                                        <div>Video Source</div>
                                        <div>Image</div>
                                    </div>
                                    
                                    {/* Mock data - replace with real data from sales table */}
                                    <div className="table-row">
                                        <div className="product-info">
                                            <span>Soft Tee</span>
                                        </div>
                                        <div>12</div>
                                        <div>$299.88</div>
                                        <div>My Gaming Setup Tour</div>
                                        <div className="product-image">
                                            <img src="/static/images/guidonteepreview.png" alt="Soft Tee" />
                                        </div>
                                    </div>
                                    
                                    <div className="table-row">
                                        <div className="product-info">
                                            <span>Unisex Classic Tee</span>
                                        </div>
                                        <div>8</div>
                                        <div>$199.92</div>
                                        <div>React Tutorial Series</div>
                                        <div className="product-image">
                                            <img src="/static/images/unisexclassicteepreview.png" alt="Unisex Classic Tee" />
                                        </div>
                                    </div>
                                    
                                    <div className="table-row">
                                        <div className="product-info">
                                            <span>Cropped Hoodie</span>
                                        </div>
                                        <div>6</div>
                                        <div>$239.94</div>
                                        <div>Fitness Motivation Video</div>
                                        <div className="product-image">
                                            <img src="/static/images/croppedhoodiepreview.png" alt="Cropped Hoodie" />
                                        </div>
                                    </div>
                                    
                                    <div className="table-row">
                                        <div className="product-info">
                                            <span>Canvas Tote</span>
                                        </div>
                                        <div>5</div>
                                        <div>$94.95</div>
                                        <div>Travel Vlog</div>
                                        <div className="product-image">
                                            <img src="/static/images/allovertotebagpreview.png" alt="Canvas Tote" />
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Video Images Taken From */}
                                <div className="video-sources-section">
                                    <h3>🎬 Video Sources</h3>
                                    <div className="video-sources-grid">
                                        <div className="video-source-card">
                                            <img src="/static/images/guidonteepreview.png" alt="Video thumbnail" className="video-source-thumbnail" />
                                            <div className="video-source-info">
                                                <h4>My Gaming Setup Tour</h4>
                                                <p>12 sales • $299.88 revenue</p>
                                                <span className="video-date">Uploaded: Dec 15, 2024</span>
                                            </div>
                                        </div>
                                        
                                        <div className="video-source-card">
                                            <img src="/static/images/unisexclassicteepreview.png" alt="Video thumbnail" className="video-source-thumbnail" />
                                            <div className="video-source-info">
                                                <h4>React Tutorial Series</h4>
                                                <p>8 sales • $199.92 revenue</p>
                                                <span className="video-date">Uploaded: Dec 10, 2024</span>
                                            </div>
                                        </div>
                                        
                                        <div className="video-source-card">
                                            <img src="/static/images/croppedhoodiepreview.png" alt="Video thumbnail" className="video-source-thumbnail" />
                                            <div className="video-source-info">
                                                <h4>Fitness Motivation Video</h4>
                                                <p>6 sales • $239.94 revenue</p>
                                                <span className="video-date">Uploaded: Dec 5, 2024</span>
                                            </div>
                                        </div>
                                        
                                        <div className="video-source-card">
                                            <img src="/static/images/allovertotebagpreview.png" alt="Video thumbnail" className="video-source-thumbnail" />
                                            <div className="video-source-info">
                                                <h4>Travel Vlog</h4>
                                                <p>5 sales • $94.95 revenue</p>
                                                <span className="video-date">Uploaded: Nov 28, 2024</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="analytics-actions">
                                    <button className="action-btn primary">Export Sales Report</button>
                                    <button className="action-btn secondary">View Detailed Analytics</button>
                                    <button className="action-btn secondary">Compare Periods</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Friends Revenue Tab */}
                {activeTab === 'friends' && canInviteFriends && (
                    <div className="friends-tab">
                        {/* Friends/Collaborators Section */}
                        <div className="friends-management-section">
                            <h2>Invited Friends & Collaborators</h2>
                            <p>Manage your content creator network</p>
                            {/* Friends management component would go here */}
                            <div className="friends-placeholder">
                                <p>Feature coming soon: Invite friends to collaborate on your content!</p>
                            </div>
                        </div>

                        {/* Friends Revenue Analytics Section */}
                        <div className="friends-revenue-section">
                            <div className="section-header">
                                <h2>Friends Revenue Analytics</h2>
                                <div className="revenue-summary">
                                    <span className="total-revenue">Total Friend Revenue: $1,247.50</span>
                                    <span className="your-share">Your Share (15%): $187.13</span>
                                </div>
                            </div>
                            
                            <div className="revenue-dashboard">
                                <div className="revenue-overview-cards">
                                    <div className="revenue-card">
                                        <h4>📊 This Month</h4>
                                        <div className="revenue-amount">$324.75</div>
                                        <div className="revenue-change">+23.5% vs last month</div>
                                    </div>
                                    <div className="revenue-card">
                                        <h4>👥 Active Friends</h4>
                                        <div className="revenue-amount">8</div>
                                        <div className="revenue-change">2 new this month</div>
                                    </div>
                                    <div className="revenue-card">
                                        <h4>🎯 Conversion Rate</h4>
                                        <div className="revenue-amount">12.3%</div>
                                        <div className="revenue-change">+2.1% improvement</div>
                                    </div>
                                    <div className="revenue-card">
                                        <h4>💰 Avg Revenue/Friend</h4>
                                        <div className="revenue-amount">$155.94</div>
                                        <div className="revenue-change">+$12.45 vs last month</div>
                                    </div>
                                </div>
                                
                                <div className="friends-performance-table">
                                    <h3>Friend Performance</h3>
                                    <div className="table-header">
                                        <div>Friend</div>
                                        <div>Sales Generated</div>
                                        <div>Revenue</div>
                                        <div>Your Share (15%)</div>
                                        <div>Conversion Rate</div>
                                        <div>Status</div>
                                    </div>
                                    
                                    {/* Mock data - replace with real data later */}
                                    <div className="table-row">
                                        <div className="friend-info">
                                            <img src="/default-avatar.jpg" alt="Friend" className="friend-avatar-small" />
                                            <span>Alex Johnson</span>
                                        </div>
                                        <div>24 sales</div>
                                        <div>$487.50</div>
                                        <div className="revenue-share">$73.13</div>
                                        <div>18.2%</div>
                                        <div><span className="status-active">Active</span></div>
                                    </div>
                                    
                                    <div className="table-row">
                                        <div className="friend-info">
                                            <img src="/default-avatar.jpg" alt="Friend" className="friend-avatar-small" />
                                            <span>Sarah Chen</span>
                                        </div>
                                        <div>18 sales</div>
                                        <div>$356.25</div>
                                        <div className="revenue-share">$53.44</div>
                                        <div>15.7%</div>
                                        <div><span className="status-active">Active</span></div>
                                    </div>
                                    
                                    <div className="table-row">
                                        <div className="friend-info">
                                            <img src="/default-avatar.jpg" alt="Friend" className="friend-avatar-small" />
                                            <span>Mike Rodriguez</span>
                                        </div>
                                        <div>12 sales</div>
                                        <div>$234.50</div>
                                        <div className="revenue-share">$35.18</div>
                                        <div>9.8%</div>
                                        <div><span className="status-inactive">Inactive</span></div>
                                    </div>
                                    
                                    <div className="table-row">
                                        <div className="friend-info">
                                            <img src="/default-avatar.jpg" alt="Friend" className="friend-avatar-small" />
                                            <span>Emma Wilson</span>
                                        </div>
                                        <div>8 sales</div>
                                        <div>$169.25</div>
                                        <div className="revenue-share">$25.39</div>
                                        <div>21.5%</div>
                                        <div><span className="status-new">New</span></div>
                                    </div>
                                </div>
                                
                                <div className="revenue-actions">
                                    <button className="action-btn primary">Export Revenue Report</button>
                                    <button className="action-btn secondary">Manage Revenue Splits</button>
                                    <button className="action-btn secondary">View Detailed Analytics</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard; 