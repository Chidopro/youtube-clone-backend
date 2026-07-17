import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain } from '../../utils/subdomainService';
import { fetchPublicFavoritesByList, favoriteImageUrl } from '../../utils/favoriteListsApi';
import { favoriteListPageHeading } from '../../utils/favoriteListLabels';
import StorefrontFlowBanner from '../../Components/StorefrontFlowBanner/StorefrontFlowBanner';
import './Favorites.css';

const Favorites = ({ sidebar }) => {
  const navigate = useNavigate();
  const { listSlug } = useParams();
  const { currentCreator, loading: creatorLoading } = useCreator();
  const [favorites, setFavorites] = useState([]);
  const [listMeta, setListMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const effectiveSlug = (listSlug || 'owner').toLowerCase();

  useEffect(() => {
    const run = async () => {
      const sub = getSubdomain();
      if (!sub || creatorLoading) {
        if (!creatorLoading) {
          setLoading(false);
          setFavorites([]);
          setError('');
        }
        return;
      }
      if (!currentCreator?.id) {
        setLoading(false);
        setFavorites([]);
        setError('');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const { ok, data } = await fetchPublicFavoritesByList(sub, effectiveSlug);
        if (!ok || !data.success) {
          setError(data?.error || 'Could not load favorites');
          setFavorites([]);
          setListMeta(null);
        } else {
          setListMeta(data.list || null);
          setFavorites(data.favorites || []);
          if (data.list?.id) {
            try {
              localStorage.setItem('sm_favorite_list_id', data.list.id);
              localStorage.setItem('sm_favorite_list_slug', data.list.slug || effectiveSlug);
            } catch (_) {}
          }
        }
      } catch (e) {
        setError(e.message || 'Network error');
        setFavorites([]);
      }
      setLoading(false);
    };
    run();
  }, [currentCreator?.id, effectiveSlug, creatorLoading]);

  const handleMakeMerch = async (favorite) => {
    const imageUrl = favoriteImageUrl(favorite);
    if (!imageUrl) {
      alert('No image available for this favorite.');
      return;
    }

    const merchData = {
      thumbnail: imageUrl,
      screenshots: [imageUrl],
      videoTitle: favorite.title || 'Favorite',
      creatorName: currentCreator?.display_name || 'Creator',
      screenshot_timestamp: '0:00',
    };
    localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
    localStorage.setItem('creator_favorites_mode', 'false');
    if (listMeta?.id) {
      try {
        localStorage.setItem('sm_favorite_list_id', listMeta.id);
        if (listMeta.slug) localStorage.setItem('sm_favorite_list_slug', listMeta.slug);
      } catch (_) {
        /* ignore */
      }
    }

    navigate('/merchandise');
  };

  const pageTitle = listMeta
    ? favoriteListPageHeading(listMeta, currentCreator?.id)
    : effectiveSlug === 'owner'
      ? 'My Favorites'
      : 'Favorites';

  return (
    <div className={`container ${sidebar ? '' : ' large-container'}`}>
      <StorefrontFlowBanner />

      <div className="favorites-page favorites-page--in-container">
        <div className="favorites-toolbar">
          <button
            type="button"
            className="favorites-back-btn"
            onClick={() => navigate('/')}
            aria-label="Back"
          >
            ←
          </button>
          <div className="favorites-toolbar-text">
            <h1 className="favorites-page-title">{pageTitle}</h1>
            {error ? <p className="favorites-error">{error}</p> : null}
          </div>
        </div>

        {loading ? <div className="favorites-loading">Loading favorites...</div> : null}

        {!loading && favorites.length === 0 && !error ? (
          <div className="favorites-empty">
            <h2>No favorites yet</h2>
            <p>The creator hasn&apos;t added any favorites to this page yet. Check back later!</p>
          </div>
        ) : null}

        {!loading && favorites.length > 0 ? (
          <div className="favorites-grid">
            {favorites.map((favorite) => (
              <div className="favorites-card" key={favorite.id}>
                <div className="favorites-card-image">
                  <img
                    src={
                      favoriteImageUrl(favorite) ||
                      'https://via.placeholder.com/320x180?text=No+Image'
                    }
                    alt={favorite.title || 'Favorite'}
                  />
                </div>
                <div className="favorites-card-content">
                  <h3>{favorite.title || 'Untitled'}</h3>
                  {favorite.description && <p>{favorite.description}</p>}
                  <button
                    type="button"
                    className="favorites-make-merch-btn"
                    onClick={() => handleMakeMerch(favorite)}
                  >
                    Make Merch
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Favorites;
