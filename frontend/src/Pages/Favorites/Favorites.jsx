import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain } from '../../utils/subdomainService';
import { fetchPublicFavoritesByList } from '../../utils/favoriteListsApi';
import './Favorites.css';

const Favorites = ({ sidebar }) => {
  const navigate = useNavigate();
  const { listSlug } = useParams();
  const { currentCreator } = useCreator();
  const [favorites, setFavorites] = useState([]);
  const [listMeta, setListMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const effectiveSlug = (listSlug || 'owner').toLowerCase();

  useEffect(() => {
    const run = async () => {
      const sub = getSubdomain();
      if (!sub || !currentCreator?.id) {
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
  }, [currentCreator?.id, effectiveSlug]);

  const handleMakeMerch = async (favorite) => {
    const imageUrl = favorite.image_url || favorite.thumbnail_url;
    if (!imageUrl) {
      alert('No image available for this favorite.');
      return;
    }

    const merchData = {
      thumbnail: imageUrl,
      screenshots: [imageUrl],
      videoTitle: favorite.title || 'Favorite',
      creatorName: currentCreator?.display_name || 'Creator',
      screenshot_timestamp: '0:00'
    };
    localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
    localStorage.setItem('creator_favorites_mode', 'false');

    navigate('/merchandise');
  };

  const pageTitle = listMeta?.display_name || `${currentCreator?.display_name || 'Creator'}'s Favorites`;

  if (loading) {
    return (
      <div className={`favorites-page ${sidebar ? '' : 'large-container'}`}>
        <div className="favorites-loading">Loading favorites...</div>
      </div>
    );
  }

  return (
    <div className={`favorites-page ${sidebar ? '' : 'large-container'}`}>
      <div className="favorites-header">
        <button type="button" className="favorites-back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1>⭐ {pageTitle}</h1>
        <p className="favorites-subtitle">
          {error ? <span style={{ color: '#c00' }}>{error}</span> : (
            <>
              {favorites.length} favorite{favorites.length !== 1 ? 's' : ''} on this page
            </>
          )}
        </p>
      </div>

      {favorites.length === 0 && !error ? (
        <div className="favorites-empty">
          <div className="favorites-empty-icon">⭐</div>
          <h2>No favorites yet</h2>
          <p>The creator hasn&apos;t added any favorites to this page yet. Check back later!</p>
        </div>
      ) : null}

      {favorites.length > 0 ? (
        <div className="favorites-grid">
          {favorites.map((favorite) => (
            <div className="favorites-card" key={favorite.id}>
              <div className="favorites-card-image">
                <img
                  src={favorite.image_url || favorite.thumbnail_url || 'https://via.placeholder.com/320x180?text=No+Image'}
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
  );
};

export default Favorites;
