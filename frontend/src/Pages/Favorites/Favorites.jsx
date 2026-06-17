import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain } from '../../utils/subdomainService';
import { fetchPublicFavoritesByList } from '../../utils/favoriteListsApi';
import ChannelHeader from '../../Components/ChannelHeader/ChannelHeader';
import './Favorites.css';

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1557683316-973673baf926?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80';

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
    document.body.classList.add('page-favorites');
    return () => document.body.classList.remove('page-favorites');
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

  const isCollaboratorPage = Boolean(
    listMeta?.storefront_owner_id &&
    listMeta?.owner_user_id &&
    String(listMeta.storefront_owner_id) !== String(listMeta.owner_user_id)
  );

  const rawPageName = (listMeta?.display_name || '').trim();
  const cleanPageName =
    rawPageName
      .replace(/\s*\(owner\)\s*/gi, ' ')
      .replace(/\s*—?\s*collaborator\s*page\s*/gi, ' ')
      .replace(/\s*Favorites\s*$/i, '')
      .trim() || (effectiveSlug === 'owner' ? 'Main favorites' : 'Favorites');

  const pageTitle = rawPageName || `${currentCreator?.display_name || 'Creator'}'s Favorites`;

  const headerBio = isCollaboratorPage
    ? `${cleanPageName} — curated favorites`
    : 'Favorite picks — turn screenshots into merch';

  const coverUrl =
    currentCreator?.cover_image_url || currentCreator?.banner_url || DEFAULT_COVER;
  const avatarUrl = currentCreator?.profile_image_url || '/default-avatar.jpg';
  const handle = currentCreator?.subdomain || currentCreator?.username || 'creator';

  const bannerSlot = typeof document !== 'undefined' ? document.getElementById('page-top-banner') : null;

  const channelHeader = currentCreator?.id ? (
    <div className={`favorites-channel-header ${!sidebar ? 'favorites-channel-header--wide' : ''}`}>
      <ChannelHeader
        coverImageUrl={coverUrl}
        avatarUrl={avatarUrl}
        displayName={currentCreator.display_name || 'Creator'}
        username={handle}
        bio={headerBio}
      />
    </div>
  ) : null;

  return (
    <>
      {bannerSlot && channelHeader ? createPortal(channelHeader, bannerSlot) : channelHeader}

      <div className={`favorites-page ${sidebar ? '' : 'large-container'}`}>
        <div className="favorites-toolbar">
          <button type="button" className="favorites-back-btn" onClick={() => navigate('/')}>
            ← Back
          </button>
          <div className="favorites-toolbar-text">
            <h1 className="favorites-page-title">⭐ {pageTitle}</h1>
            <p className="favorites-subtitle">
              {loading ? (
                'Loading favorites…'
              ) : error ? (
                <span className="favorites-error">{error}</span>
              ) : (
                <>
                  {favorites.length} favorite{favorites.length !== 1 ? 's' : ''} on this page
                </>
              )}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="favorites-loading">Loading favorites...</div>
        ) : null}

        {!loading && favorites.length === 0 && !error ? (
          <div className="favorites-empty">
            <div className="favorites-empty-icon">⭐</div>
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
