import React, { useState, useEffect } from 'react'
import './Sidebar.css'
import home from '../../assets/home.png'
import { Link, useLocation } from 'react-router-dom';
import { apiJoin } from '../../config/apiConfig';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain, isCreatorStorefrontHostname } from '../../utils/subdomainService';
import { fetchPublicFavoriteLists } from '../../utils/favoriteListsApi';
import { favoriteListSidebarLabel, isStorefrontNavList } from '../../utils/favoriteListLabels';

const Sidebar = ({ sidebar, category, setCategory, setSidebar }) => {
  const [showSubs, setShowSubs] = useState(true);
  const [subscribers, setSubscribers] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [creatorsError, setCreatorsError] = useState(false);
  const [favLists, setFavLists] = useState([]);
  const [loadingFavLists, setLoadingFavLists] = useState(false);
  const [showFav, setShowFav] = useState(true);
  const location = useLocation();
  const { currentCreator } = useCreator();

  // Creator directory: main site only (screenmerch.com). Subdomains keep Pages (+ optional channel tools elsewhere).
  useEffect(() => {
    if (isCreatorStorefrontHostname()) {
      setSubscribers([]);
      setLoadingSubs(false);
      setCreatorsError(false);
      return;
    }
    let cancelled = false;
    const fetchCreators = async () => {
      setLoadingSubs(true);
      setCreatorsError(false);
      try {
        const res = await fetch(apiJoin('/api/creators/list'));
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data?.success && Array.isArray(data.creators)) {
          const mapped = data.creators.map((c) => {
            const subdomain = (c.subdomain || '').trim();
            const username = (c.username || '').trim();
            const rawName = (c.name || c.display_name || username || '').trim();
            const name =
              rawName && rawName.toLowerCase() !== 'creator'
                ? rawName
                : subdomain || username || 'Creator';
            return {
              id: c.id,
              username,
              name,
              avatar: c.avatar,
              subdomain,
            };
          });
          const linkable = mapped.filter((c) => c.subdomain || c.username);
          setSubscribers(linkable);
          setCreatorsError(false);
        } else {
          setSubscribers([]);
          setCreatorsError(true);
        }
      } catch (err) {
        console.error('Error fetching creators for sidebar:', err);
        if (!cancelled) {
          setSubscribers([]);
          setCreatorsError(true);
        }
      } finally {
        if (!cancelled) setLoadingSubs(false);
      }
    };

    fetchCreators();
    return () => {
      cancelled = true;
    };
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
          setFavLists(data.lists.filter((L) => isStorefrontNavList(L, currentCreator?.id)));
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

  const closeSidebar = () => {
    setSidebar?.(false);
  };

  return (
    <div className={`sidebar ${sidebar ? "" : "small-sidebar"}`}>
      <div className="shortcut-links">
        <Link to="/" className={`side-link ${category === 0 ? "active" : ""}`} onClick={() => { setCategory(0); closeSidebar(); }}>
          <img src={home} alt="" /><p>Home</p>
        </Link>
        <hr />
      </div>
      {favLists.length > 0 && (
        <div className="subscribed-list" style={{ marginBottom: 8 }}>
          <h3 style={{ cursor: 'pointer' }} onClick={() => setShowFav((s) => !s)}>
            Pages {showFav ? '▲' : '▼'}
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
                    onClick={() => { setCategory(0); closeSidebar(); }}
                  >
                    <div className="subscriber-info">
                      <p className={`subscriber-name ${L.is_primary ? 'favorites-owner-row' : ''}`}>
                        {favoriteListSidebarLabel(L, currentCreator?.id)}
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
            ) : creatorsError ? (
              <div className="no-subs">Creators unavailable. Try again later.</div>
            ) : subscribers.length === 0 ? (
              <div className="no-subs">No creators yet.</div>
            ) : (
              <div className="subscribers-list">
                {subscribers.map(sub => (
                  <div className="subscriber-item-container" key={sub.id}>
                    {sub.subdomain ? (
                      <a
                        href={`https://${sub.subdomain}.screenmerch.com`}
                        className="side-link subscriber-item"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={closeSidebar}
                      >
                        <img src={sub.avatar || '/default-avatar.jpg'} alt={sub.name} className="subscriber-avatar" />
                        <div className="subscriber-info">
                          <p className="subscriber-name">{sub.name}</p>
                        </div>
                      </a>
                    ) : sub.username ? (
                      <a
                        href={`https://screenmerch.com/profile/${sub.username}`}
                        className="side-link subscriber-item"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={closeSidebar}
                      >
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
