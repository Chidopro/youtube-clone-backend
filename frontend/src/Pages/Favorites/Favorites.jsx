import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain } from '../../utils/subdomainService';
import { fetchPublicFavoritesByList, fetchOwnerExtraPages, fetchFavoritesForList, favoriteImageUrl, favoriteCardThumbUrl } from '../../utils/favoriteListsApi';
import { favoriteListPageHeading } from '../../utils/favoriteListLabels';
import { apiJoin } from '../../config/apiConfig';
import { savePendingMerchData } from '../../utils/merchSession';
import StorefrontFlowBanner from '../../Components/StorefrontFlowBanner/StorefrontFlowBanner';
import './Favorites.css';

const sortNewest = (a, b) => {
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
  return tb - ta;
};

function FavoritesShelfTrack({ children, itemCount = 0 }) {
  const trackRef = useRef(null);
  const [bar, setBar] = useState({ canScroll: false, thumbPct: 100, leftPct: 0 });

  const updateBar = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    const overflow = scrollWidth - clientWidth;
    const canScroll = overflow > 2;
    const thumbPct = canScroll ? Math.min(80, Math.max(16, (clientWidth / scrollWidth) * 100)) : 100;
    const leftPct = canScroll ? (scrollLeft / overflow) * (100 - thumbPct) : 0;
    setBar({ canScroll, thumbPct, leftPct });
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateBar();
    el.addEventListener('scroll', updateBar, { passive: true });
    window.addEventListener('resize', updateBar);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateBar) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateBar);
      window.removeEventListener('resize', updateBar);
      ro?.disconnect();
    };
  }, [updateBar, itemCount]);

  const jumpTo = (event) => {
    const el = trackRef.current;
    const track = event.currentTarget;
    if (!el || !bar.canScroll) return;
    const rect = track.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    el.scrollTo({ left: x * (el.scrollWidth - el.clientWidth), behavior: 'smooth' });
  };

  return (
    <div className={`favorites-shelf-scroller${bar.canScroll ? ' has-overflow' : ''}`}>
      <div ref={trackRef} className="favorites-shelf-track">
        {children}
      </div>
      <div
        className="favorites-shelf-scrollbar"
        aria-hidden="true"
        onClick={jumpTo}
      >
        <span
          className="favorites-shelf-scrollbar-thumb"
          style={{ width: `${bar.thumbPct}%`, left: `${bar.leftPct}%` }}
        />
      </div>
    </div>
  );
}

function FavoriteImageCard({ item, onMakeMerch }) {
  return (
    <div className="favorites-card">
      <div className="favorites-card-image">
        <img
          src={item.thumb || 'https://via.placeholder.com/320x180?text=No+Image'}
          alt={item.title}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const fallback = item.full || favoriteImageUrl(item.raw);
            if (fallback && e.currentTarget.src !== fallback) {
              e.currentTarget.src = fallback;
            }
          }}
        />
      </div>
      <div className="favorites-card-content">
        <h3>{item.title}</h3>
        <p>{item.description || '\u00A0'}</p>
        <button
          type="button"
          className="favorites-make-merch-btn"
          onClick={() => onMakeMerch(item.raw)}
        >
          Make Merch
        </button>
      </div>
    </div>
  );
}

const mapFavoriteImages = (favorites) =>
  (favorites || [])
    .map((f) => ({
      kind: 'image',
      id: `image-${f.id}`,
      title: f.title || 'Untitled',
      thumb: favoriteCardThumbUrl(f),
      full: favoriteImageUrl(f),
      created_at: f.created_at || '',
      description: f.description || '',
      raw: f,
    }))
    .sort(sortNewest);

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
  const [extraPages, setExtraPages] = useState([]);

  const effectiveSlug = (listSlug || 'owner').toLowerCase();

  useEffect(() => {
    const run = async () => {
      const sub = getSubdomain();
      if (!sub || creatorLoading) {
        if (!creatorLoading) {
          setLoading(false);
          setImages([]);
          setVideos([]);
          setExtraPages([]);
          setError('');
        }
        return;
      }
      if (!currentCreator?.id) {
        setLoading(false);
        setImages([]);
        setVideos([]);
        setExtraPages([]);
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
          setExtraPages([]);
          setLoading(false);
          return;
        }

        const list = data.list || null;
        setListMeta(list);
        setImages(data.favorites || []);
        setLoading(false);

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

        const extrasPromise =
          list?.is_primary || effectiveSlug === 'owner'
            ? fetchOwnerExtraPages(sub, currentCreator.id)
                .then((extras) =>
                  Promise.all(
                    extras.map(async (extraList) => ({
                      list: extraList,
                      images: await fetchFavoritesForList(
                        sub,
                        extraList,
                        extraList.owner_user_id || currentCreator.id
                      ),
                    }))
                  )
                )
                .then(setExtraPages)
                .catch(() => setExtraPages([]))
            : Promise.resolve(setExtraPages([]));

        const videosPromise = pageUserId
          ? fetch(`${apiJoin('/api/videos')}?user_id=${encodeURIComponent(pageUserId)}&limit=100`)
              .then((vRes) => (vRes.ok ? vRes.json().catch(() => []) : []))
              .then((vData) => {
                const listVideos = (Array.isArray(vData) ? vData : []).map((v) => ({
                  ...v,
                  thumbnail: v.thumbnail || v.thumbnail_url || '',
                }));
                setVideos(listVideos);
              })
              .catch(() => setVideos([]))
          : Promise.resolve(setVideos([]));

        void extrasPromise;
        void videosPromise;
      } catch (e) {
        setError(e.message || 'Network error');
        setImages([]);
        setVideos([]);
        setExtraPages([]);
        setLoading(false);
      }
    };
    run();
  }, [currentCreator?.id, effectiveSlug, creatorLoading, navigate]);

  const pageTitle = listMeta
    ? favoriteListPageHeading(listMeta, currentCreator?.id)
    : effectiveSlug === 'owner'
      ? 'My Page'
      : 'Page';

  const imageItems = useMemo(() => mapFavoriteImages(images), [images]);

  const videoItems = useMemo(
    () =>
      videos
        .map((v) => ({
          kind: 'video',
          id: `video-${v.id}`,
          title: v.title || 'Untitled video',
          thumb: v.thumbnail || v.thumbnail_url || '',
          created_at: v.created_at || '',
          raw: v,
        }))
        .sort(sortNewest),
    [videos]
  );

  const extraPageItems = useMemo(
    () =>
      extraPages.map((page) => ({
        list: page.list,
        title: favoriteListPageHeading(page.list, currentCreator?.id),
        images: mapFavoriteImages(page.images),
      })),
    [extraPages, currentCreator?.id]
  );

  const showImagesRow = filter !== 'videos';
  const showVideosRow = filter !== 'images';
  const visibleExtraPages = showImagesRow ? extraPageItems : [];
  const hasVisibleItems =
    (showImagesRow && imageItems.length > 0) ||
    (showVideosRow && videoItems.length > 0) ||
    visibleExtraPages.some((page) => page.images.length > 0);

  const handleMakeMerch = (favorite, pageList = listMeta) => {
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
    savePendingMerchData(merchData);
    localStorage.setItem('creator_favorites_mode', 'false');
    if (pageList?.id) {
      try {
        localStorage.setItem('sm_favorite_list_id', pageList.id);
        if (pageList.slug) localStorage.setItem('sm_favorite_list_slug', pageList.slug);
      } catch (_) {
        /* ignore */
      }
    }

    navigate('/merchandise');
    window.scrollTo(0, 0);
  };

  const openVideo = (video) => {
    navigate(`/video/${video.categoryId || 0}/${video.id}`);
  };

  return (
    <div className={`container favorites-root ${sidebar ? '' : ' large-container'}`}>
      <StorefrontFlowBanner />

      <div className="favorites-page favorites-page--in-container">
        <div className="favorites-toolbar">
          <button
            type="button"
            className="favorites-back-btn"
            onClick={() => navigate(effectiveSlug !== 'owner' ? '/friend-pages' : '/')}
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

        {!loading && !hasVisibleItems && extraPageItems.length === 0 && !error ? (
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

        {!loading && (hasVisibleItems || extraPageItems.length > 0) ? (
          <div className="favorites-shelves">
            {showImagesRow && imageItems.length > 0 ? (
              <section className="favorites-shelf" aria-label="Images">
                <h2 className="favorites-shelf-title">Images</h2>
                <FavoritesShelfTrack itemCount={imageItems.length}>
                  {imageItems.map((item) => (
                    <FavoriteImageCard key={item.id} item={item} onMakeMerch={handleMakeMerch} />
                  ))}
                </FavoritesShelfTrack>
              </section>
            ) : null}

            {showVideosRow && videoItems.length > 0 ? (
              <section className="favorites-shelf" aria-label="Videos">
                <h2 className="favorites-shelf-title">Videos</h2>
                <FavoritesShelfTrack itemCount={videoItems.length}>
                  {videoItems.map((item) => (
                    <div className="favorites-card favorites-card--video" key={item.id}>
                      <div className="favorites-card-image">
                        <img
                          src={item.thumb || 'https://via.placeholder.com/320x180?text=No+Thumbnail'}
                          alt={item.title}
                          loading="lazy"
                          decoding="async"
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
                  ))}
                </FavoritesShelfTrack>
              </section>
            ) : null}

            {visibleExtraPages.map((page) => (
              <section
                className="favorites-extra-page"
                key={page.list.id || page.list.slug}
                aria-label={page.title}
              >
                <h2 className="favorites-extra-page-title">{page.title}</h2>
                {page.images.length > 0 ? (
                  <FavoritesShelfTrack itemCount={page.images.length}>
                    {page.images.map((item) => (
                      <FavoriteImageCard
                        key={item.id}
                        item={item}
                        onMakeMerch={(fav) => handleMakeMerch(fav, page.list)}
                      />
                    ))}
                  </FavoritesShelfTrack>
                ) : (
                  <p className="favorites-extra-empty">No images on this page yet.</p>
                )}
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Favorites;
