import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ChannelFriend.css';
import { supabase } from '../../supabaseClient';

const ChannelFriend = () => {
    const { channelUsername } = useParams();
    const navigate = useNavigate();
    const [channelOwner, setChannelOwner] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [availableChannels, setAvailableChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [subscribing, setSubscribing] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Get current user
                const { data: { user } } = await supabase.auth.getUser();
                setCurrentUser(user);

                if (channelUsername) {
                    // Get specific channel owner info
                    const { data: owner, error } = await supabase
                        .from('users')
                        .select('id, username, display_name, profile_image_url')
                        .eq('username', channelUsername)
                        .single();

                    if (error || !owner) {
                        setMessage('Channel not found.');
                    } else {
                        setChannelOwner(owner);
                    }
                } else {
                    // Get available channels to become friends with
                    const { data: channels, error } = await supabase
                        .from('users')
                        .select('id, username, display_name, profile_image_url')
                        .neq('id', user?.id || 'none') // Exclude current user
                        .limit(20);

                    if (!error && channels) {
                        setAvailableChannels(channels);
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                setMessage('Error loading channel information.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [channelUsername]);

    const handleSubscribeAsFriend = async () => {
        if (!currentUser) {
            setMessage('Please sign in to become a channel friend.');
            return;
        }

        if (currentUser.id === channelOwner?.id) {
            setMessage('You cannot subscribe to your own channel as a friend.');
            return;
        }

        setSubscribing(true);
        setMessage('');

        try {
            // Insert into channel_friends table
            const { error } = await supabase
                .from('channel_friends')
                .insert([{
                    channel_owner_id: channelOwner.id,
                    friend_id: currentUser.id,
                    status: 'pending'
                }]);

            if (error) {
                console.error('Error creating friend request:', error);
                setMessage('Failed to send friend request. Please try again.');
            } else {
                setMessage('Friend request sent! Waiting for channel owner approval.');
                setTimeout(() => {
                    navigate('/dashboard');
                }, 3000);
            }
        } catch (error) {
            console.error('Error in friend request:', error);
            setMessage('An error occurred. Please try again.');
        } finally {
            setSubscribing(false);
        }
    };

    if (loading) {
        return (
            <div className="channel-friend-page">
                <div className="loading-container">
                    <h2>Loading channel information...</h2>
                </div>
            </div>
        );
    }

    // Show browse channels page if no specific channel
    if (!channelUsername) {
        return (
            <div className="channel-friend-page">
                <div className="channel-friend-container">
                    <div className="channel-header-simple">
                        <div className="channel-info">
                            <h1>🤝 Become a Channel Friend</h1>
                            <p className="channel-username">Choose a channel to collaborate with</p>
                        </div>
                    </div>
                    
                    <div className="friend-agreement">
                        <h2>Available Channels</h2>
                        <p className="agreement-intro">
                            Select a channel below to learn about their Channel Friend program and request to join their content creation network.
                        </p>
                        
                        {availableChannels.length > 0 ? (
                            <div className="channels-grid">
                                {availableChannels.map(channel => (
                                    <div 
                                        key={channel.id} 
                                        className="channel-card"
                                        onClick={() => navigate(`/channel-friend/${channel.username}`)}
                                    >
                                        <img
                                            src={channel.profile_image_url || '/default-avatar.jpg'}
                                            alt={channel.display_name}
                                            className="channel-card-avatar"
                                        />
                                        <div className="channel-card-info">
                                            <h3>{channel.display_name || channel.username}</h3>
                                            <p>@{channel.username}</p>
                                            <button className="view-channel-btn">
                                                View Channel Friend Program
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="no-channels">
                                <p>No channels available at the moment.</p>
                            </div>
                        )}
                        
                        <div className="action-section">
                            <button onClick={() => navigate('/')} className="back-btn secondary">
                                Back to Home
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!channelOwner) {
        return (
            <div className="channel-friend-page">
                <div className="error-container">
                    <h2>Channel Not Found</h2>
                    <p>The channel you're looking for doesn't exist.</p>
                    <button onClick={() => navigate('/')} className="back-btn">
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="channel-friend-page">
            <div className="channel-friend-container">
                {/* Channel Header - Logo Only */}
                <div className="channel-header-simple">
                    <img
                        src={channelOwner.profile_image_url || '/default-avatar.jpg'}
                        alt={channelOwner.display_name}
                        className="channel-logo"
                    />
                    <div className="channel-info">
                        <h1>{channelOwner.display_name || channelOwner.username}</h1>
                        <p className="channel-username">@{channelOwner.username}</p>
                    </div>
                </div>

                {/* Friend Subscription Agreement */}
                <div className="friend-agreement">
                    <h2>🤝 Become a Channel Friend</h2>
                    <p className="agreement-intro">
                        Join <strong>{channelOwner.display_name}</strong>'s content creation network as a Channel Friend. 
                        Create content under their brand while earning revenue from your uploads.
                    </p>

                    {/* Revenue Split Section */}
                    <div className="revenue-split-section">
                        <h3>💰 Revenue Sharing Agreement</h3>
                        <div className="revenue-breakdown">
                            <div className="revenue-item friend">
                                <div className="percentage">60%</div>
                                <div className="description">
                                    <strong>You (Channel Friend)</strong>
                                    <p>Majority share of revenue from your content</p>
                                </div>
                            </div>
                            <div className="revenue-item owner">
                                <div className="percentage">20%</div>
                                <div className="description">
                                    <strong>Channel Owner</strong>
                                    <p>Revenue share for hosting and brand support</p>
                                </div>
                            </div>
                            <div className="revenue-item platform">
                                <div className="percentage">20%</div>
                                <div className="description">
                                    <strong>ScreenMerch Platform</strong>
                                    <p>Platform maintenance and infrastructure costs</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Limitations Section */}
                    <div className="limitations-section">
                        <h3>📹 Content Guidelines & Limits</h3>
                        <div className="limitation-grid">
                            <div className="limitation-item">
                                <div className="icon">📊</div>
                                <div>
                                    <strong>Video Upload Limit</strong>
                                    <p>Maximum 5 videos per month as a Channel Friend</p>
                                </div>
                            </div>
                            <div className="limitation-item">
                                <div className="icon">🎨</div>
                                <div>
                                    <strong>Brand Guidelines</strong>
                                    <p>Content must align with channel owner's brand and standards</p>
                                </div>
                            </div>
                            <div className="limitation-item">
                                <div className="icon">✅</div>
                                <div>
                                    <strong>Content Approval</strong>
                                    <p>All uploads subject to channel owner review and approval</p>
                                </div>
                            </div>
                            <div className="limitation-item">
                                <div className="icon">📋</div>
                                <div>
                                    <strong>Attribution</strong>
                                    <p>Content published under channel owner's brand and name</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Benefits Section */}
                    <div className="benefits-section">
                        <h3>🌟 Channel Friend Benefits</h3>
                        <ul className="benefits-list">
                            <li>✅ Access to established audience and subscriber base</li>
                            <li>✅ Professional brand association and credibility</li>
                            <li>✅ Revenue sharing without upfront investment</li>
                            <li>✅ Mentorship and guidance from experienced content creator</li>
                            <li>✅ Collaborative content creation opportunities</li>
                            <li>✅ Analytics and performance insights</li>
                        </ul>
                    </div>

                    {/* Terms & Conditions */}
                    <div className="terms-section">
                        <h3>📄 Terms & Conditions</h3>
                        <div className="terms-content">
                            <p><strong>Agreement Duration:</strong> This friendship agreement continues until terminated by either party with 30-day notice.</p>
                            <p><strong>Content Ownership:</strong> While revenue is shared, content intellectual property belongs to the channel owner.</p>
                            <p><strong>Performance Standards:</strong> Maintain quality standards and upload consistency as agreed with channel owner.</p>
                            <p><strong>Termination:</strong> Either party may terminate this agreement for violations of community guidelines or poor performance.</p>
                            <p><strong>Payment:</strong> Revenue payments processed monthly via ScreenMerch's payment system.</p>
                        </div>
                    </div>

                    {/* Action Section */}
                    <div className="action-section">
                        {message && (
                            <div className={`message ${message.includes('sent') ? 'success' : 'error'}`}>
                                {message}
                            </div>
                        )}
                        
                        {currentUser ? (
                            <button 
                                onClick={handleSubscribeAsFriend}
                                disabled={subscribing}
                                className="subscribe-friend-btn"
                            >
                                {subscribing ? 'Sending Request...' : `🤝 Request to Join ${channelOwner.display_name}'s Network`}
                            </button>
                        ) : (
                            <div className="auth-required">
                                <p>Please sign in to become a Channel Friend</p>
                                <button onClick={() => navigate('/')} className="sign-in-redirect-btn">
                                    Sign In
                                </button>
                            </div>
                        )}
                        
                        <button onClick={() => navigate(-1)} className="back-btn secondary">
                            Back
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChannelFriend; 