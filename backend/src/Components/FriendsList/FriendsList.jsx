import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './FriendsList.css';
import { supabase } from '../../supabaseClient';

const NAVBAR_HEIGHT = 140; // px, increase to ensure sidebar is below logo

const FriendsList = ({ username, userData }) => {
    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchSubscribers = async () => {
            setLoading(true);
            if (!userData?.id) {
                setFriends([]);
                setLoading(false);
                return;
            }
            const { data, error } = await supabase
                .from('subscriptions')
                .select('subscriber_id, users:subscriber_id (username, display_name, profile_image_url)')
                .eq('channel_id', userData.id);
            if (error) {
                setFriends([]);
            } else {
                setFriends(
                    data.map(row => ({
                        id: row.subscriber_id,
                        username: row.users.username,
                        name: row.users.display_name,
                        avatar: row.users.profile_image_url,
                    }))
                );
            }
            setLoading(false);
        };
        fetchSubscribers();
    }, [userData]);

    const handleFriendClick = (friendUsername) => {
        if (!collapsed) navigate(`/profile/${friendUsername}`);
    };

    const handleUnsubscribe = async (event, friendId, friendName) => {
        event.stopPropagation(); // Prevent navigation when clicking unsubscribe button
        
        if (!window.confirm(`Are you sure you want to unsubscribe from ${friendName}?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('subscriptions')
                .delete()
                .eq('channel_id', userData.id)
                .eq('subscriber_id', friendId);

            if (error) {
                console.error('Error unsubscribing:', error);
                alert('Failed to unsubscribe. Please try again.');
            } else {
                // Remove the friend from the local state
                setFriends(prevFriends => prevFriends.filter(friend => friend.id !== friendId));
                alert(`Successfully unsubscribed from ${friendName}`);
            }
        } catch (error) {
            console.error('Error unsubscribing:', error);
            alert('Failed to unsubscribe. Please try again.');
        }
    };

    return (
        <div className={`friends-list${collapsed ? ' collapsed' : ''}`}> 
            <div className="friends-list-header" onClick={() => setCollapsed(!collapsed)}>
                <span>Friends List</span>
                <span className="collapse-icon">{collapsed ? '▶' : '▼'}</span>
            </div>
            {!collapsed && (
                <div className="friends-list-content">
                    {loading ? (
                        <div>Loading...</div>
                    ) : friends.length === 0 ? (
                        <div>None Yet</div>
                    ) : (
                        friends.map(friend => (
                            <div key={friend.id} className="friend-item" onClick={() => handleFriendClick(friend.username)}>
                                <img src={friend.avatar} alt={friend.name} className="friend-avatar" />
                                <div className="friend-info">
                                    <div className="friend-name">{friend.name}</div>
                                    <div className="friend-meta">
                                        <span>{friend.subscriberCount} subs</span> • <span>{friend.videoCount} videos</span>
                                        {friend.isOnline && <span className="online-dot" title="Online"></span>}
                                    </div>
                                </div>
                                <button 
                                    className="unsubscribe-btn"
                                    onClick={(e) => handleUnsubscribe(e, friend.id, friend.name)}
                                    title={`Unsubscribe from ${friend.name}`}
                                >
                                    ×
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default FriendsList; 