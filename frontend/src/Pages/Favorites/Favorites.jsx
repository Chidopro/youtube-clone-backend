import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain } from '../../utils/subdomainService';
import { fetchPublicFavoritesByList } from '../../utils/favoriteListsApi';
import { favoriteListPageHeading } from '../../utils/favoriteListLabels';
import './Favorites.css';

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1557683316-973673baf926?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80';

/** Desktop banner = 75% of original 260px. Mobile = 75% of original 200px. */
const FAVORITES_BANNER_HEIGHT_DESKTOP = 195;
const FAVORITES_BANNER_HEIGHT_MOBILE = 150;
const FAVORITES_BANNER_MOBILE_MAX_WIDTH = 900;

const Favorites = ({ sidebar }) => {
  const navigate = useNavigate();
  const { listSlug } = useParams();
  const { currentCreator } = useCreator();
  const [favorites, setFavorites] = useState([]);
  const [listMeta, setListMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bannerHeight, setBannerHeight] = useState(FAVORITES_BANNER_HEIGHT_DESKTOP);

  const effectiveSlug = (listSlug || 'owner').toLowerCase();

  useEffect(() => {
    document.body.classList.add('page-favorites');
    return () => document.body.classList.remove('page-favorites');
  }, []);

  useEffect(() => {
    const syncBannerHeight = () => {
      setBannerHeight(
        window.innerWidth <= FAVORITES_BANNER_MOBILE_MAX_WIDTH
          ? FAVORITES_BANNER_HEIGHT_MOBILE
          : FAVORITES_BANNER_HEIGHT_DESKTOP
      );
    };
    syncBannerHeight();
    window.addEventListener('resize', syncBannerHeight);
    return () => window.removeEventListener('resize', syncBannerHeight);
  }, []);

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

  const pageTitle = listMeta
    ? favoriteListPageHeading(listMeta, currentCreator?.id)
    : (effectiveSlug === 'owner' ? 'Main Favorites' : 'Favorites');

  const coverUrl =
    currentCreator?.cover_image_url || currentCreator?.banner_url || DEFAULT_COVER;

  const bannerSlot = typeof document !== 'undefined' ? document.getElementById('page-top-banner') : null;

  const coverWrapStyle = {
    height: bannerHeight,
    maxHeight: bannerHeight,
    minHeight: bannerHeight,
    overflow: 'hidden',
  };

  const channelHeader = currentCreator?.id ? (
    <div
      className={`favorites-channel-header favorites-channel-header--wide${bannerHeight === FAVORITES_BANNER_HEIGHT_MOBILE ? ' favorites-channel-header--mobile' : ''}`}
      style={coverWrapStyle}
    >
      <div className="channel-header" style={coverWrapStyle}>
        <div className="channel-cover-container" style={coverWrapStyle}>
          <img
            className="channel-cover-photo"
            src={coverUrl}
            alt="Channel Cover"
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {bannerSlot && channelHeader ? createPortal(channelHeader, bannerSlot) : channelHeader}

      <div className={`favorites-page ${sidebar ? '' : 'large-container'}`}>
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
            <h1 className="favorites-page-title">
              <span className="favorites-heart-icon" aria-hidden="true">
                ♥
              </span>
              {pageTitle}
            </h1>
            {error ? <p className="favorites-error">{error}</p> : null}
          </div>
        </div>

        {loading ? (
          <div className="favorites-loading">Loading favorites...</div>
        ) : null}

        {!loading && favorites.length === 0 && !error ? (
          <div className="favorites-empty">
            <div className="favorites-empty-icon" aria-hidden="true">
              ♥
            </div>
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
    </>
  );
};

export default Favorites;
