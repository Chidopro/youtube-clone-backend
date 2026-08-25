import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain } from '../../utils/subdomainService';
import { fetchPublicFavoriteLists, peekPublicFavoriteLists } from '../../utils/favoriteListsApi';
import { friendPageLabel, isCollaboratorFavoriteList } from '../../utils/favoriteListLabels';
import StorefrontFlowBanner from '../../Components/StorefrontFlowBanner/StorefrontFlowBanner';
import './FriendPages.css';

function umbrellaFriendPages(lists, ownerId) {
  const all = Array.isArray(lists) ? lists : [];
  return all.filter((L) => {
    if (L.is_primary || L.slug === 'owner') return false;
    if (ownerId) return isCollaboratorFavoriteList(L, ownerId);
    return true;
  });
}

const FriendPages = ({ sidebar }) => {
  const navigate = useNavigate();
  const { currentCreator } = useCreator();
  const cachedLists = peekPublicFavoriteLists(getSubdomain());
  const [pages, setPages] = useState(() => umbrellaFriendPages(cachedLists, currentCreator?.id));
  const [loading, setLoading] = useState(cachedLists == null);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      const sub = getSubdomain();
      if (!sub) {
        setPages([]);
        setLoading(false);
        return;
      }
      const cached = peekPublicFavoriteLists(sub);
      if (cached) {
        setPages(umbrellaFriendPages(cached, currentCreator?.id));
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError('');
      try {
        const { ok, data } = await fetchPublicFavoriteLists(sub, { lite: true });
        if (!ok || !data?.success) {
          if (!cached) {
            setError(data?.error || 'Could not load friends list');
            setPages([]);
          }
        } else {
          const lists = Array.isArray(data.lists) ? data.lists : [];
          setPages(umbrellaFriendPages(lists, currentCreator?.id));
        }
      } catch (e) {
        if (!cached) {
          setError(e.message || 'Network error');
          setPages([]);
        }
      }
      setLoading(false);
    };
    run();
  }, [currentCreator?.id]);

  return (
    <div className={`container ${sidebar ? '' : ' large-container'}`}>
      <StorefrontFlowBanner />

      <div className="friend-pages friend-pages--in-container">
        <div className="friend-pages-toolbar">
          <button
            type="button"
            className="friend-pages-back-btn"
            onClick={() => navigate('/')}
            aria-label="Back"
          >
            ←
          </button>
          <div className="friend-pages-toolbar-text">
            <h1 className="friend-pages-title">My Friends</h1>
          </div>
        </div>

        <div className="friend-pages-body">
        {loading ? <div className="friend-pages-loading">Loading…</div> : null}
        {error ? <p className="friend-pages-error">{error}</p> : null}

        {!loading && !error && pages.length === 0 ? (
          <div className="friend-pages-empty">
            <h2>No friends yet</h2>
            <p>When creators join this storefront, their pages will show up here.</p>
          </div>
        ) : null}

        {!loading && pages.length > 0 ? (
          <ul className="friend-pages-list">
            {pages.map((L) => {
              const label = friendPageLabel(L, currentCreator?.id);
              const to =
                L.slug === 'owner' ? '/favorites' : `/favorites/${encodeURIComponent(L.slug)}`;
              return (
                <li key={L.id}>
                  <button
                    type="button"
                    className="friend-pages-item"
                    onClick={() => navigate(to)}
                  >
                    <span className="friend-pages-item-name">{label}</span>
                    <span className="friend-pages-item-arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        </div>
      </div>
    </div>
  );
};

export default FriendPages;
