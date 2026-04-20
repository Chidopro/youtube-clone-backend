import React, { useState, useEffect } from 'react'
import './Sidebar.css'
import home from '../../assets/home.png'
import { Link, useLocation } from 'react-router-dom';
import { API_CONFIG } from '../../config/apiConfig';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain, isCreatorStorefrontHostname } from '../../utils/subdomainService';
import { fetchPublicFavoriteLists } from '../../utils/favoriteListsApi';

const Sidebar = ({sidebar, category, setCategory}) => {
  const [showSubs, setShowSubs] = useState(true);
  const [subscribers, setSubscribers] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [favLists, setFavLists] = useState([]);
  const [loadingFavLists, setLoadingFavLists] = useState(false);
  const [showFav, setShowFav] = useState(true);
  const location = useLocation();
  const { currentCreator } = useCreator();

  // Creator directory: main site only (screenmerch.com). Subdomains keep Favorites (+ optional channel tools elsewhere).
  useEffect(() => {
    if (isCreatorStorefrontHostname()) {
      setSubscribers([]);
      setLoadingSubs(false);
      return;
    }
    const fetchCreators = async () => {
      setLoadingSubs(true);
      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/creators/list`);
        const data = await res.json().catch(() => ({}));
        if (data?.success && Array.isArray(data.creators)) {
          const mapped = data.creators.map(c => ({
            id: c.id,
            username: c.username,
            name: c.name || c.display_name || c.username,
            avatar: c.avatar,
            subdomain: c.subdomain || '',
          }));
          const linkable = mapped.filter(
            c => (c.subdomain && c.subdomain.trim()) || (c.username && c.username.trim())
          );
          setSubscribers(linkable);
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

  useEffect(() => {
    const sub = getSubdomain();
    if (!sub || !currentCreator?.id) {
      setFavLists([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingFavLists(true);
      try {
        const { ok, data } = await fetchPublicFavoriteLists(sub);
        if (!cancelled && ok && data?.success && Array.isArray(data.lists) && data.lists.length > 0) {
          setFavLists(data.lists);
        } else if (!cancelled) {
          setFavLists([]);
        }
      } catch (_) {
        if (!cancelled) setFavLists([]);
      } finally {
        if (!cancelled) setLoadingFavLists(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentCreator?.id]);

  return (
    <div className={`sidebar ${sidebar ? "" : "small-sidebar"}`}>
      <div className="shortcut-links">
        <Link to="/" className={`side-link ${category === 0 ? "active" : ""}`} onClick={() => setCategory(0)}>
          <img src={home} alt="" /><p>Home</p>
        </Link>
        <hr />
      </div>
      {favLists.length > 0 && (
        <div className="subscribed-list" style={{ marginBottom: 8 }}>
          <h3 style={{ cursor: 'pointer' }} onClick={() => setShowFav((s) => !s)}>
            Favorites {showFav ? '▲' : '▼'}
          </h3>
          {showFav && (
            <div className="subscribers-list">
              {loadingFavLists ? (
                <div className="loading-subs">Loading…</div>
              ) : (
                favLists.map((L) => (
                  <Link
                    key={L.id}
                    to={L.slug === 'owner' ? '/favorites' : `/favorites/${encodeURIComponent(L.slug)}`}
                    className={`side-link subscriber-item ${location.pathname === '/favorites' && L.slug === 'owner' ? 'active' : ''} ${location.pathname === `/favorites/${L.slug}` ? 'active' : ''}`}
                    onClick={() => setCategory(0)}
                  >
                    <div className="subscriber-info">
                      <p className={`subscriber-name ${L.is_primary ? 'favorites-owner-row' : ''}`}>
                        {L.display_name || L.slug}
                        {L.is_primary ? ' ★' : ''}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
          <hr />
        </div>
      )}
      {!isCreatorStorefrontHostname() && (
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
                    ) : sub.username ? (
                      <a href={`https://screenmerch.com/profile/${sub.username}`} className="side-link subscriber-item" target="_blank" rel="noopener noreferrer">
                        <img src={sub.avatar || '/default-avatar.jpg'} alt={sub.name} className="subscriber-avatar" />
                        <div className="subscriber-info">
                          <p className="subscriber-name">{sub.name}</p>
                        </div>
                      </a>
                    ) : (
                      <div className="side-link subscriber-item">
                        <img src={sub.avatar || '/default-avatar.jpg'} alt={sub.name} className="subscriber-avatar" />
                        <div className="subscriber-info">
                          <p className="subscriber-name">{sub.name}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  )
}

export default Sidebar
