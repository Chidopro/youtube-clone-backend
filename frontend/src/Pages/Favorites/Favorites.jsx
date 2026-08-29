import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain } from '../../utils/subdomainService';
import { fetchPublicFavoritesByList, fetchOwnerExtraPages, fetchFavoritesForList, favoriteImageUrl, favoriteCardThumbUrl, favoriteGalleryUrl } from '../../utils/favoriteListsApi';
import { favoriteListPageHeading } from '../../utils/favoriteListLabels';
import { apiJoin } from '../../config/apiConfig';
import { savePendingMerchData } from '../../utils/merchSession';
import {
  browseShopCategoryPath,
  readShopAddIntent,
  clearShopAddIntent,
} from '../../utils/shopCategories';
import StorefrontFlowBanner from '../../Components/StorefrontFlowBanner/StorefrontFlowBanner';
import './Favorites.css';

const sortNewest = (a, b) => {
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
  return tb - ta;
};

function FavoritesShelfTrack({ children, itemCount = 0, pair = false, trio = false, scrollRef = null }) {
  const trackRef = useRef(null);
  const [bar, setBar] = useState({ canScroll: false, thumbPct: 100, leftPct: 0 });

  const setTrackEl = (el) => {
    trackRef.current = el;
    if (scrollRef) scrollRef.current = el;
  };

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
      <div ref={setTrackEl} className={`favorites-shelf-track${pair ? ' favorites-shelf-track--pair' : ''}${trio ? ' favorites-shelf-track--trio' : ''}`}>
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
          src={item.gallery || item.full || item.thumb || 'https://via.placeholder.com/640x480?text=No+Image'}
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
      gallery: favoriteGalleryUrl(f),
      full: favoriteImageUrl(f),
      created_at: f.created_at || '',
      description: f.description || '',
      raw: f,
    }))
    .sort(sortNewest);

function getShelfMaxScroll(el) {
  if (!el) return 0;
  const cards = el.querySelectorAll('.favorites-card');
  const nativeMax = Math.max(0, el.scrollWidth - el.clientWidth);
  if (!cards.length) return nativeMax;
  const last = cards[cards.length - 1];
  const paddingRight = parseFloat(window.getComputedStyle(el).paddingRight) || 0;
  const lastEnd = last.offsetLeft + last.offsetWidth + paddingRight;
  const showLast = Math.max(0, lastEnd - el.clientWidth);
  return Math.max(0, Math.min(nativeMax, showLast));
}

const Favorites = ({ sidebar }) => {
  const navigate = useNavigate();
  const { listSlug } = useParams();
  const [searchParams] = useSearchParams();
  const fromShop = searchParams.get('from') === 'shop';
  const { currentCreator, loading: creatorLoading } = useCreator();
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [listMeta, setListMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [extraPages, setExtraPages] = useState([]);
  const imageTrackRef = useRef(null);
  const videoTrackRef = useRef(null);
  const shelfScrollTargetRef = useRef(null);
  const [desktopMediaTab, setDesktopMediaTab] = useState('images');

  const restoreShelfSnap = (el) => {
    if (!el) return;
    const saved = el.dataset.shelfSnap;
    if (saved == null) return;
    el.style.scrollSnapType = saved === 'none' ? '' : saved;
    delete el.dataset.shelfSnap;
  };

  const getActiveShelfEl = () => {
    const desktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 901px)').matches;
    if (desktop) {
      if (desktopMediaTab === 'videos') return videoTrackRef.current;
      return imageTrackRef.current;
    }
    return imageTrackRef.current || videoTrackRef.current;
  };

  const isOnFriendPage = () => {
    if (listMeta?.is_primary || listMeta?.slug === 'owner') return false;
    const slug = (listSlug || '').toLowerCase();
    return !!(slug && slug !== 'owner');
  };

  const goBackFromFavorites = () => {
    if (isOnFriendPage()) {
      navigate('/friend-pages');
      return;
    }
    navigate('/');
  };

  const scrollShelf = (direction) => {
    const el = getActiveShelfEl();
    if (!el) return;
    const maxLeft = getShelfMaxScroll(el);
    if (maxLeft <= 1) return;

    const firstCard = el.querySelector('.favorites-card');
    const styles = window.getComputedStyle(el);
    const gap = parseFloat(styles.columnGap || styles.gap) || 16;
    const step = firstCard ? firstCard.getBoundingClientRect().width + gap : Math.max(el.clientWidth * 0.9, 280);
    const from = shelfScrollTargetRef.current != null ? shelfScrollTargetRef.current : el.scrollLeft;
    const next = Math.max(0, Math.min(maxLeft, from + direction * step));
    if (Math.abs(next - from) < 2) return;

    if (el.dataset.shelfSnap == null) {
      el.dataset.shelfSnap = styles.scrollSnapType || 'none';
    }
    el.style.scrollSnapType = 'none';
    shelfScrollTargetRef.current = next;
    el.scrollTo({ left: next, behavior: 'smooth' });
  };

  useEffect(() => {
    const el = getActiveShelfEl();
    if (!el) return;
    let settle;
    const onScroll = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        shelfScrollTargetRef.current = null;
        restoreShelfSnap(el);
      }, 160);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(settle);
      el.removeEventListener('scroll', onScroll);
      restoreShelfSnap(el);
    };
  }, [loading, desktopMediaTab, images.length, videos.length]);

  const effectiveSlug = (listSlug || 'owner').toLowerCase();

  useEffect(() => {
    if (!fromShop) clearShopAddIntent();
  }, [fromShop]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [effectiveSlug]);

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

  useEffect(() => {
    if (desktopMediaTab === 'images' && imageItems.length === 0 && videoItems.length > 0) {
      setDesktopMediaTab('videos');
    } else if (desktopMediaTab === 'videos' && videoItems.length === 0 && imageItems.length > 0) {
      setDesktopMediaTab('images');
    }
  }, [desktopMediaTab, imageItems.length, videoItems.length]);

  const selectDesktopMediaTab = (tab) => {
    setDesktopMediaTab(tab);
    shelfScrollTargetRef.current = null;
  };

  const extraPageItems = useMemo(
    () =>
      extraPages.map((page) => ({
        list: page.list,
        title: favoriteListPageHeading(page.list, currentCreator?.id),
        images: mapFavoriteImages(page.images),
      })),
    [extraPages, currentCreator?.id]
  );

  const visibleExtraPages = extraPageItems;
  const hasVisibleItems =
    imageItems.length > 0 ||
    videoItems.length > 0 ||
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

    const shopIntent = readShopAddIntent();
    clearShopAddIntent();
    if (shopIntent?.category) {
      navigate(browseShopCategoryPath(shopIntent.category, { fromShop: false }));
    } else {
      navigate('/merchandise');
    }
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
            onClick={goBackFromFavorites}
            aria-label="Back"
          >
            ←
          </button>
          {imageItems.length > 0 ? (
            <button
              type="button"
              className={`favorites-media-tab favorites-media-tab--images${desktopMediaTab === 'images' ? ' is-active' : ''}`}
              onClick={() => selectDesktopMediaTab('images')}
              aria-pressed={desktopMediaTab === 'images'}
            >
              Images
            </button>
          ) : null}
          <div className="favorites-toolbar-text">
            <h1 className={`favorites-page-title${pageTitle === 'My Page' ? ' favorites-page-title--visually-hidden' : ''}`}>{pageTitle}</h1>
            {error ? <p className="favorites-error">{error}</p> : null}
          </div>
          {videoItems.length > 0 ? (
            <button
              type="button"
              className={`favorites-media-tab favorites-media-tab--videos${desktopMediaTab === 'videos' ? ' is-active' : ''}`}
              onClick={() => selectDesktopMediaTab('videos')}
              aria-pressed={desktopMediaTab === 'videos'}
            >
              Videos
            </button>
          ) : null}
          <button
            type="button"
            className="favorites-back-btn favorites-scroll-right-btn"
            onClick={() => scrollShelf(1)}
            aria-label="Scroll right"
          >
            →
          </button>
        </div>

        {loading ? <div className="favorites-loading">Loading page...</div> : null}

        {!loading && !hasVisibleItems && extraPageItems.length === 0 && !error ? (
          <div className="favorites-empty">
            <h2>Nothing here yet</h2>
            <p>This page has no videos or images yet. Check back later!</p>
          </div>
        ) : null}

        {!loading && (hasVisibleItems || extraPageItems.length > 0) ? (
          <div className="favorites-shelves">
            <div className="favorites-media-switch" data-active={desktopMediaTab}>
            {imageItems.length > 0 ? (
              <section className="favorites-shelf favorites-shelf--images" aria-label="Images">
                <h2 className="favorites-shelf-title">Images</h2>
                <FavoritesShelfTrack itemCount={imageItems.length} pair scrollRef={imageTrackRef}>
                  {imageItems.map((item) => (
                    <FavoriteImageCard key={item.id} item={item} onMakeMerch={handleMakeMerch} />
                  ))}
                </FavoritesShelfTrack>
              </section>
            ) : null}

            {videoItems.length > 0 ? (
              <section className="favorites-shelf favorites-shelf--videos" aria-label="Videos">
                <h2 className="favorites-shelf-title">Videos</h2>
                <FavoritesShelfTrack itemCount={videoItems.length} pair scrollRef={videoTrackRef}>
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
            </div>

            {visibleExtraPages.map((page) => (
              <section
                className="favorites-extra-page"
                key={page.list.id || page.list.slug}
                aria-label={page.title}
              >
                <h2 className="favorites-extra-page-title">{page.title}</h2>
                {page.images.length > 0 ? (
                  <FavoritesShelfTrack itemCount={page.images.length} pair>
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
