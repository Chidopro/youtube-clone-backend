import React, { useState, useEffect } from 'react'
import './Sidebar.css'
import home from '../../assets/home.png'
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

const Sidebar = ({sidebar, category, setCategory}) => {
  const [showSubs, setShowSubs] = useState(true);
  const [subscribers, setSubscribers] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [subscriberType, setSubscriberType] = useState('platform');
  const location = useLocation();

  useEffect(() => {
    const fetchPlatformSubscribers = async () => {
      setLoadingSubs(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select(`
            id,
            username,
            display_name,
            profile_image_url,
            created_at
          `)
          .not('username', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Error fetching platform creators:', error);
          setSubscribers([]);
        } else {
          const platformCreators = data
            .filter(user => user.username)
            .map(user => ({
              id: user.id,
              username: user.username,
              name: user.display_name || user.username,
              avatar: user.profile_image_url,
              joinedAt: user.created_at,
              type: 'platform'
            }));
          setSubscribers(platformCreators);
        }
      } catch (err) {
        console.error('Error fetching subscribers:', err);
        setSubscribers([]);
      }
      setLoadingSubs(false);
    };

    fetchPlatformSubscribers();
  }, []);

  return (
    <div className={`sidebar ${sidebar ? "" : "small-sidebar"}`}>
      <div className="shortcut-links">
        <Link to="/" className={`side-link ${category === 0 ? "active" : ""}`} onClick={() => setCategory(0)}>
          <img src={home} alt="" /><p>Home</p>
        </Link>
        <hr />
      </div>
      <div className="subscribed-list">
        <h3 style={{ cursor: 'pointer' }} onClick={() => setShowSubs(s => !s)}>
          CREATORS {showSubs ? '▲' : '▼'}
        </h3>
        {showSubs && (
          <div>
            {loadingSubs ? (
              <div className="loading-subs">Loading creators...</div>
            ) : subscribers.length === 0 ? (
              <div className="no-subs">No creators yet.</div>
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
                      </div>
                    </Link>
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
