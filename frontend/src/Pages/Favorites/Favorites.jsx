import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain } from '../../utils/subdomainService';
import { fetchPublicFavoritesByList, favoriteImageUrl } from '../../utils/favoriteListsApi';
import { favoriteListPageHeading } from '../../utils/favoriteListLabels';
import { apiJoin } from '../../config/apiConfig';
import StorefrontFlowBanner from '../../Components/StorefrontFlowBanner/StorefrontFlowBanner';
import './Favorites.css';

const Favorites = ({ sidebar }) => {
  const navigate = useNavigate();
  const { listSlug } = useParams();
  const { currentCreator, loading: creatorLoading } = useCreator();
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [listMeta, setListMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all | videos | images

  const effectiveSlug = (listSlug || 'owner').toLowerCase();

  useEffect(() => {
    const run = async () => {
      const sub = getSubdomain();
      if (!sub || creatorLoading) {
        if (!creatorLoading) {
          setLoading(false);
          setImages([]);
          setVideos([]);
          setError('');
        }
        return;
      }
      if (!currentCreator?.id) {
        setLoading(false);
        setImages([]);
        setVideos([]);
        setError('');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const { ok, data } = await fetchPublicFavoritesByList(sub, effectiveSlug);
        if (!ok || !data.success) {
          setError(data?.error || 'Could not load this page');
          setImages([]);
          setVideos([]);
          setListMeta(null);
          setLoading(false);
          return;
        }

        const list = data.list || null;
        setListMeta(list);
        setImages(data.favorites || []);
        if (list?.id) {
          try {
            localStorage.setItem('sm_favorite_list_id', list.id);
            localStorage.setItem('sm_favorite_list_slug', list.slug || effectiveSlug);
          } catch (_) {}
        }
        const nextSlug = (list?.slug || '').toLowerCase();
        if (nextSlug && nextSlug !== effectiveSlug && nextSlug !== 'owner') {
          navigate(`/favorites/${encodeURIComponent(nextSlug)}`, { replace: true });
        }

        const pageUserId =
          list?.owner_user_id ||
          (list?.is_primary || list?.slug === 'owner' ? currentCreator.id : null) ||
          currentCreator.id;

        if (pageUserId) {
          try {
            const vRes = await fetch(
              `${apiJoin('/api/videos')}?user_id=${encodeURIComponent(pageUserId)}&limit=100`
            );
            const vData = vRes.ok ? await vRes.json().catch(() => []) : [];
            const listVideos = (Array.isArray(vData) ? vData : []).map((v) => ({
              ...v,
              thumbnail: v.thumbnail || v.thumbnail_url || '',
            }));
            setVideos(listVideos);
          } catch (_) {
            setVideos([]);
          }
        } else {
          setVideos([]);
        }
      } catch (e) {
        setError(e.message || 'Network error');
        setImages([]);
        setVideos([]);
      }
      setLoading(false);
    };
    run();
  }, [currentCreator?.id, effectiveSlug, creatorLoading, navigate]);

  const pageTitle = listMeta
    ? favoriteListPageHeading(listMeta, currentCreator?.id)
    : effectiveSlug === 'owner'
      ? 'My Page'
      : 'Page';

  const items = useMemo(() => {
    const videoItems = videos.map((v) => ({
      kind: 'video',
      id: `video-${v.id}`,
      title: v.title || 'Untitled video',
      thumb: v.thumbnail || v.thumbnail_url || '',
      created_at: v.created_at || '',
      raw: v,
    }));
    const imageItems = images.map((f) => ({
      kind: 'image',
      id: `image-${f.id}`,
      title: f.title || 'Untitled',
      thumb: favoriteImageUrl(f),
      created_at: f.created_at || '',
      description: f.description || '',
      raw: f,
    }));
    const merged = [...videoItems, ...imageItems].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
    if (filter === 'videos') return merged.filter((i) => i.kind === 'video');
    if (filter === 'images') return merged.filter((i) => i.kind === 'image');
    return merged;
  }, [videos, images, filter]);

  const handleMakeMerch = (favorite) => {
    const imageUrl = favoriteImageUrl(favorite);
    if (!imageUrl) {
      alert('No image available.');
      return;
    }

    const merchData = {
      thumbnail: imageUrl,
      screenshots: [imageUrl],
      videoTitle: favorite.title || 'Image',
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

  const openVideo = (video) => {
    navigate(`/video/${video.categoryId || 0}/${video.id}`);
  };

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

        {!loading && !error ? (
          <div className="page-filter-row" role="tablist" aria-label="Filter page content">
            {[
              { id: 'all', label: 'All' },
              { id: 'videos', label: 'Videos' },
              { id: 'images', label: 'Images' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={filter === opt.id}
                className={`page-filter-chip${filter === opt.id ? ' is-active' : ''}`}
                onClick={() => setFilter(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? <div className="favorites-loading">Loading page...</div> : null}

        {!loading && items.length === 0 && !error ? (
          <div className="favorites-empty">
            <h2>Nothing here yet</h2>
            <p>
              {filter === 'videos'
                ? 'No videos on this page yet. Check back later!'
                : filter === 'images'
                  ? 'No images on this page yet. Check back later!'
                  : 'This page has no videos or images yet. Check back later!'}
            </p>
          </div>
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="favorites-grid">
            {items.map((item) =>
              item.kind === 'video' ? (
                <div className="favorites-card favorites-card--video" key={item.id}>
                  <div className="favorites-card-image">
                    <span className="page-item-badge">Video</span>
                    <img
                      src={item.thumb || 'https://via.placeholder.com/320x180?text=No+Thumbnail'}
                      alt={item.title}
                    />
                  </div>
                  <div className="favorites-card-content">
                    <h3>{item.title}</h3>
                    <p className="page-item-meta">{item.raw.channelTitle || 'Creator'}</p>
                    <button
                      type="button"
                      className="favorites-make-merch-btn"
                      onClick={() => openVideo(item.raw)}
                    >
                      Play Video
                    </button>
                  </div>
                </div>
              ) : (
                <div className="favorites-card" key={item.id}>
                  <div className="favorites-card-image">
                    <span className="page-item-badge page-item-badge--image">Image</span>
                    <img
                      src={item.thumb || 'https://via.placeholder.com/320x180?text=No+Image'}
                      alt={item.title}
                    />
                  </div>
                  <div className="favorites-card-content">
                    <h3>{item.title}</h3>
                    <p>{item.description || '\u00A0'}</p>
                    <button
                      type="button"
                      className="favorites-make-merch-btn"
                      onClick={() => handleMakeMerch(item.raw)}
                    >
                      Make Merch
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Favorites;
