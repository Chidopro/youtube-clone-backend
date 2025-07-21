import React, { useState, useEffect } from 'react'
import './Sidebar.css'
import home from '../../assets/home.png'
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

const Sidebar = ({sidebar, category, setCategory}) => {
  const [showSubs, setShowSubs] = useState(true);
  const [subscribers, setSubscribers] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [subscriberType, setSubscriberType] = useState('platform'); // 'platform' or 'channel'
  const [channelOwner, setChannelOwner] = useState(null);
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const determineSubscriberType = () => {
      const path = location.pathname;
      
      // Check if we're on a user's dashboard or profile page
      if (path === '/dashboard') {
        // Get current user to show their channel subscribers
        return { type: 'channel', username: 'current' };
      } else if (path.startsWith('/profile/')) {
        // Extract username from profile URL
        const username = path.split('/profile/')[1];
        return { type: 'channel', username };
      } else {
        // Homepage or other pages - show platform subscribers
        return { type: 'platform', username: null };
      }
    };

    const fetchSubscribers = async () => {
      setLoadingSubs(true);
      const context = determineSubscriberType();
      setSubscriberType(context.type);

      try {
        if (context.type === 'platform') {
          await fetchPlatformSubscribers();
        } else {
          await fetchChannelSubscribers(context.username);
        }
      } catch (err) {
        console.error('Error fetching subscribers:', err);
        setSubscribers([]);
      }
      setLoadingSubs(false);
    };

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

    fetchSubscribers();
    fetchCurrentUser();
  }, [location.pathname]);

  const fetchPlatformSubscribers = async () => {
    // Fetch users who have active subscriptions to the platform
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select(`
        user_id,
        tier,
        status,
        created_at,
        users:user_id (
          id,
          username,
          display_name,
          profile_image_url
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      setSubscribers([]);
    } else {
      const platformSubs = data
        .filter(sub => sub.users) // Only include users with valid profile data
        .map(sub => ({
          id: sub.user_id,
          username: sub.users.username,
          name: sub.users.display_name || sub.users.username,
          avatar: sub.users.profile_image_url,
          tier: sub.tier,
          joinedAt: sub.created_at,
          type: 'platform'
        }));
      setSubscribers(platformSubs);
    }
  };

  const fetchChannelSubscribers = async (username) => {
    try {
      let channelId;
      
      if (username === 'current') {
        // Get current user's ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setSubscribers([]);
          return;
        }
        channelId = user.id;
        
        // Also get current user's profile info
        const { data: profile } = await supabase
          .from('users')
          .select('username, display_name')
          .eq('id', user.id)
          .single();
        
        setChannelOwner(profile);
      } else {
        // Get specific user's ID from username
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, username, display_name')
          .eq('username', username)
          .single();
        
        if (userError || !user) {
          setSubscribers([]);
          return;
        }
        
        channelId = user.id;
        setChannelOwner(user);
      }

      // Fetch subscribers for this channel
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          subscriber_id,
          created_at,
          users:subscriber_id (
            username,
            display_name,
            profile_image_url
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching channel subscribers:', error);
        setSubscribers([]);
      } else {
        const channelSubs = data
          .filter(sub => sub.users)
          .map(sub => ({
            id: sub.subscriber_id,
            username: sub.users.username,
            name: sub.users.display_name || sub.users.username,
            avatar: sub.users.profile_image_url,
            joinedAt: sub.created_at,
            type: 'channel',
            channelId: channelId // Store channelId for unsubscribe functionality
          }));
        
        setSubscribers(channelSubs);
      }
    } catch (err) {
      console.error('Error in fetchChannelSubscribers:', err);
      setSubscribers([]);
    }
  };

  const handleUnsubscribe = async (event, subscriberId, subscriberName, channelId) => {
    event.preventDefault(); // Prevent navigation when clicking unsubscribe button
    
    if (!window.confirm(`Are you sure you want to unsubscribe from ${subscriberName}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('channel_id', channelId)
        .eq('subscriber_id', subscriberId);

      if (error) {
        console.error('Error unsubscribing:', error);
        alert('Failed to unsubscribe. Please try again.');
      } else {
        // Remove the subscriber from the local state
        setSubscribers(prevSubs => prevSubs.filter(sub => sub.id !== subscriberId));
        alert(`Successfully unsubscribed from ${subscriberName}`);
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
      alert('Failed to unsubscribe. Please try again.');
    }
  };

  return (
    <div className={`sidebar ${sidebar ? "" : "small-sidebar"}`}>
      <div className="shortcut-links">
        <Link to="/" className={`side-link ${category === 0 ? "active" : ""}`} onClick={() => setCategory(0)}>
          <img src={home} alt="" /><p>Home</p>
        </Link>
        {currentUser && currentUser.role === 'creator' && (
          <Link to="/dashboard">Dashboard</Link>
        )}
        <hr />
      </div>
      <div className="subscribed-list">
        <h3 style={{ cursor: 'pointer' }} onClick={() => setShowSubs(s => !s)}>
          {subscriberType === 'platform' ? 'SCREENMERCH COMMUNITY' : 
           subscriberType === 'channel' ? 'Channel Friends' :
           'SUBSCRIBERS'} {showSubs ? '▲' : '▼'}
        </h3>
        {showSubs && (
          <div>
            {loadingSubs ? (
              <div className="loading-subs">Loading subscribers...</div>
            ) : subscribers.length === 0 ? (
              <div className="no-subs">
                {subscriberType === 'platform' ? 
                  'No platform subscribers yet.' : 
                  'No channel friends yet.'}
              </div>
            ) : (
              <div className="subscribers-list">
                {subscribers.map(sub => (
                  <div className="subscriber-item-container" key={sub.id}>
                    <Link to={`/profile/${sub.username}`} className="side-link subscriber-item">
                      <img 
                        src={sub.avatar || '/default-avatar.jpg'} 
                        alt={sub.name} 
                        className="subscriber-avatar"
                      />
                      <div className="subscriber-info">
                        <p className="subscriber-name">{sub.name}</p>
                        {sub.type === 'platform' && sub.tier && (
                          <span className={`tier-badge tier-${sub.tier}`}>
                            {sub.tier === 'basic' ? 'Free' : 
                             sub.tier === 'premium' ? 'Premium' : 
                             sub.tier === 'creator_network' ? 'Creator' : 'Basic'}
                          </span>
                        )}
                        {sub.type === 'channel' && (
                          <span className="subscriber-badge">
                            Subscriber
                          </span>
                        )}
                      </div>
                    </Link>
                    {sub.type === 'channel' && (
                      <button 
                        className="sidebar-unsubscribe-btn"
                        onClick={(e) => handleUnsubscribe(e, sub.id, sub.name, sub.channelId)}
                        title={`Unsubscribe from ${sub.name}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Sidebar
