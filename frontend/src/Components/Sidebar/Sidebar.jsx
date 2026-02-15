import React, { useState, useEffect } from 'react'
import './Sidebar.css'
import home from '../../assets/home.png'
import { Link, useLocation } from 'react-router-dom';
import { API_CONFIG } from '../../config/apiConfig';

const Sidebar = ({sidebar, category, setCategory}) => {
  const [showSubs, setShowSubs] = useState(true);
  const [subscribers, setSubscribers] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const location = useLocation();

  // Fetch ScreenMerch creators from backend so list works on main and all subdomains (bypasses RLS)
  useEffect(() => {
    const fetchCreators = async () => {
      setLoadingSubs(true);
      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/creators/list`);
        const data = await res.json().catch(() => ({}));
        if (data?.success && Array.isArray(data.creators)) {
          setSubscribers(data.creators.map(c => ({
            id: c.id,
            username: c.username,
            name: c.name || c.display_name || c.username,
            avatar: c.avatar,
            subdomain: c.subdomain || '',
          })));
        } else {
          setSubscribers([]);
        }
      } catch (err) {
        console.error('Error fetching creators for sidebar:', err);
        setSubscribers([]);
      }
      setLoadingSubs(false);
    };

    fetchCreators();
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
                    {sub.subdomain ? (
                      <a href={`https://${sub.subdomain}.screenmerch.com`} className="side-link subscriber-item" target="_blank" rel="noopener noreferrer">
                        <img src={sub.avatar || '/default-avatar.jpg'} alt={sub.name} className="subscriber-avatar" />
                        <div className="subscriber-info">
                          <p className="subscriber-name">{sub.name}</p>
                        </div>
                      </a>
                    ) : (
                      <Link to={`/profile/${sub.username}`} className="side-link subscriber-item">
                        <img src={sub.avatar || '/default-avatar.jpg'} alt={sub.name} className="subscriber-avatar" />
                        <div className="subscriber-info">
                          <p className="subscriber-name">{sub.name}</p>
                        </div>
                      </Link>
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
