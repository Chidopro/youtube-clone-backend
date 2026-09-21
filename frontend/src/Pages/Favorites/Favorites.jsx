import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain } from '../../utils/subdomainService';
import { fetchPublicFavoritesByList, fetchOwnerExtraPages, fetchFavoritesForList, favoriteImageUrl, favoriteCardThumbUrl, favoriteMerchImagePayload, publicStorageCardUrl, withMemberPublicIdentity, fetchMemberFavorites, peekPublicFavoriteLists } from '../../utils/favoriteListsApi';
import { favoriteListPageHeading, friendPageLabel } from '../../utils/favoriteListLabels';
import { apiJoin } from '../../config/apiConfig';
import { savePendingMerchData, markMerchIntentStarted } from '../../utils/merchSession';
import {
  browseShopCategoryPath,
  readShopAddIntent,
  clearShopAddIntent,
} from '../../utils/shopCategories';
import StorefrontFlowBanner from '../../Components/StorefrontFlowBanner/StorefrontFlowBanner';
import { ChevronLeft, ChevronRight } from '../../Components/Chevrons/Chevrons';
import { sortVideosForPlay } from '../../utils/videoPlayOrder';
import { prefetchVideoPlayback } from '../../utils/videoOptimize';
import './Favorites.css';

const sortNewest = (a, b) => {
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
  return tb - ta;
};

function FavoritesShelfTrack({
  children,
  itemCount = 0,
  pair = false,
  trio = false,
  scrollRef = null,
  onScrollState = null,
}) {
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
    onScrollState?.({
      canScroll,
      atStart: scrollLeft <= 2,
      atEnd: !canScroll || scrollLeft >= overflow - 2,
    });
  }, [onScrollState]);

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

function FavoriteThumb({ src, fallback = '', eager = false }) {
  const [current, setCurrent] = useState(src || fallback || '');

  useEffect(() => {
    setCurrent(src || fallback || '');
  }, [src, fallback]);

  if (!current) return null;
  return (
    <img
      src={current}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      onError={(e) => {
        if (fallback && e.currentTarget.src !== fallback) {
          setCurrent(fallback);
        }
      }}
    />
  );
}

function FavoriteImageCard({ item, onMakeMerch, eager = false }) {
  const handleActivate = () => onMakeMerch(item.raw);
  return (
    <div className="favorites-card">
      <button
        type="button"
        className="favorites-card-image favorites-card-image--clickable"
        onClick={handleActivate}
        aria-label={`Make merch from ${item.title}`}
      >
        <FavoriteThumb src={item.gallery || item.thumb} fallback={item.full} eager={eager} />
      </button>
      <div className="favorites-card-content">
        <h3>{item.title}</h3>
        <button
          type="button"
          className="favorites-make-merch-btn"
          onClick={handleActivate}
        >
          Make Merch
        </button>
      </div>
    </div>
  );
}

const mapFavoriteImages = (favorites) =>
  (favorites || [])
    .map((f) => {
      const full = favoriteImageUrl(f);
      const thumb = favoriteCardThumbUrl(f) || full;
      return {
        kind: 'image',
        id: `image-${f.id}`,
        title: f.title || 'Untitled',
        thumb,
        gallery: thumb,
        full,
        created_at: f.created_at || '',
        description: f.description || '',
        raw: f,
      };
    })
    .sort(sortNewest);

function FavoritesSectionHeader({
  title,
  leadTitle,
  showArrows,
  atStart,
  atEnd,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}) {
  return (
    <div className="favorites-section-header">
      <h2 className="favorites-section-title">
        {leadTitle ? `${leadTitle} ${title}` : title}
      </h2>
      {showArrows ? (
        <div className="favorites-section-arrows">
          <button
            type="button"
            className="favorites-section-arrow"
            onClick={onPrev}
            aria-label={prevLabel}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className="favorites-section-arrow"
            onClick={onNext}
            aria-label={nextLabel}
          >
            <ChevronRight />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FavoritesMediaSection({
  id,
  title,
  leadTitle,
  ariaLabel,
  itemCount,
  className = '',
  alwaysShowArrows = false,
  onPrevAtStart = null,
  children,
}) {
  const trackRef = useRef(null);
  const shelfScrollTargetRef = useRef(null);
  const [scrollState, setScrollState] = useState({ canScroll: false, atStart: true, atEnd: true });

  const restoreShelfSnap = (el) => {
    if (!el) return;
    const saved = el.dataset.shelfSnap;
    if (saved == null) return;
    el.style.scrollSnapType = saved === 'none' ? '' : saved;
    delete el.dataset.shelfSnap;
  };

  const scrollBy = (direction) => {
    const el = trackRef.current;
    if (!el) return;
    const cards = [...el.querySelectorAll('.favorites-card')];
    if (!cards.length) return;

    const trackLeft = el.getBoundingClientRect().left;
    const positions = cards.map(
      (card) => el.scrollLeft + card.getBoundingClientRect().left - trackLeft
    );
    const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    const from = shelfScrollTargetRef.current != null ? shelfScrollTargetRef.current : el.scrollLeft;

    if (direction < 0 && from <= 2 && typeof onPrevAtStart === 'function') {
      onPrevAtStart();
      return;
    }
    if (maxLeft <= 1) return;

    let current = 0;
    let nearest = Infinity;
    positions.forEach((pos, idx) => {
      const delta = Math.abs(pos - from);
      if (delta < nearest) {
        nearest = delta;
        current = idx;
      }
    });

    let nextIndex = current + direction;
    if (nextIndex >= cards.length) nextIndex = 0;
    else if (nextIndex < 0) nextIndex = cards.length - 1;

    let next = positions[nextIndex];
    if (next > maxLeft + 1) {
      next = from >= maxLeft - 2 ? 0 : maxLeft;
    } else if (next < 0) {
      next = 0;
    }
    if (Math.abs(next - from) < 2) {
      next = direction > 0 ? 0 : maxLeft;
    }
    if (Math.abs(next - from) < 2) return;

    if (el.dataset.shelfSnap == null) {
      el.dataset.shelfSnap = window.getComputedStyle(el).scrollSnapType || 'none';
    }
    el.style.scrollSnapType = 'none';
    shelfScrollTargetRef.current = next;
    el.scrollTo({ left: next, behavior: 'smooth' });
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let settle;
    const onScroll = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        shelfScrollTargetRef.current = null;
        restoreShelfSnap(el);
      }, 320);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(settle);
      el.removeEventListener('scroll', onScroll);
      restoreShelfSnap(el);
    };
  }, [itemCount]);

  return (
    <section
      id={id}
      className={`favorites-shelf${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
    >
      <FavoritesSectionHeader
        title={title}
        leadTitle={leadTitle}
        showArrows={alwaysShowArrows}
        atStart={scrollState.atStart}
        atEnd={scrollState.atEnd}
        onPrev={() => scrollBy(-1)}
        onNext={() => scrollBy(1)}
        prevLabel={`Previous ${title.toLowerCase()}`}
        nextLabel={`Next ${title.toLowerCase()}`}
      />
      <FavoritesShelfTrack
        itemCount={itemCount}
        trio
        scrollRef={trackRef}
        onScrollState={setScrollState}
      >
        {children}
      </FavoritesShelfTrack>
    </section>
  );
}

const EMPTY_PAGE_MEDIA = { images: [], videos: [] };

const Favorites = ({ sidebar }) => {
  const navigate = useNavigate();
  const { listSlug } = useParams();
  const [searchParams] = useSearchParams();
  const fromShop = searchParams.get('from') === 'shop';
  const { currentCreator } = useCreator();
  const [pageMedia, setPageMedia] = useState({ images: [], videos: [] });
  const [listMeta, setListMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clipsLoading, setClipsLoading] = useState(true);
  const [mediaSlug, setMediaSlug] = useState(null);
  const [error, setError] = useState('');
  const [extraPages, setExtraPages] = useState([]);
  const images = pageMedia.images;
  const videos = pageMedia.videos;

  const isOnFriendPage = () => {
    if (listMeta?.is_primary || listMeta?.slug === 'owner') return false;
    const slug = (listSlug || '').toLowerCase();
    return !!(slug && slug !== 'owner');
  };

  const effectiveSlug = (listSlug || 'owner').toLowerCase();

  useEffect(() => {
    if (!fromShop) clearShopAddIntent();
  }, [fromShop]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [effectiveSlug]);

  useEffect(() => {
    let cancelled = false;
    const loadVideos = (userId) => {
      if (!userId) return Promise.resolve([]);
      return fetch(`${apiJoin('/api/videos')}?user_id=${encodeURIComponent(userId)}&limit=24`)
        .then((vRes) => (vRes.ok ? vRes.json().catch(() => []) : []))
        .then((vData) =>
          (Array.isArray(vData) ? vData : []).map((v) => ({
            ...v,
            thumbnail: v.thumbnail || v.thumbnail_url || '',
          }))
        )
        .catch(() => []);
    };

    const run = async () => {
      const sub = getSubdomain();
      if (!sub) {
        setLoading(false);
        setPageMedia(EMPTY_PAGE_MEDIA);
        setMediaSlug(effectiveSlug);
        setExtraPages([]);
        setError('');
        setClipsLoading(false);
        return;
      }

      setLoading(true);
      setClipsLoading(true);
      setExtraPages([]);
      setError('');
      const peeked = peekPublicFavoriteLists(sub) || [];
      const peekedList =
        peeked.find((L) => (L.slug || '').toLowerCase() === effectiveSlug) ||
        (effectiveSlug === 'owner'
          ? peeked.find((L) => L.is_primary || L.slug === 'owner')
          : null);
      const aheadUserId =
        peekedList?.owner_user_id ||
        (effectiveSlug === 'owner' ? currentCreator?.id : null);
      const videosAhead = aheadUserId ? loadVideos(aheadUserId) : null;
      try {
        const { ok, data } = await fetchPublicFavoritesByList(sub, effectiveSlug);
        if (cancelled) return;
        if (!ok || !data.success) {
          setError(data?.error || 'Could not load this page');
          setPageMedia(EMPTY_PAGE_MEDIA);
          setListMeta(null);
          setExtraPages([]);
          setMediaSlug(effectiveSlug);
          setLoading(false);
          setClipsLoading(false);
          return;
        }

        const rawList = data.list || null;
        const isOwnerPage = !!(rawList?.is_primary || rawList?.slug === 'owner' || effectiveSlug === 'owner');
        setListMeta(rawList);
        const pageUserId =
          rawList?.owner_user_id ||
          (isOwnerPage ? currentCreator?.id : null) ||
          currentCreator?.id;
        let favs = data.favorites || [];
        if (
          !favs.length &&
          rawList?.owner_user_id &&
          !isOwnerPage
        ) {
          favs = await fetchMemberFavorites(rawList.owner_user_id);
          if (cancelled) return;
        }

        if (!isOwnerPage && rawList?.owner_user_id) {
          void withMemberPublicIdentity(rawList).then((resolved) => {
            if (!cancelled && resolved) setListMeta(resolved);
          });
        }

        if (rawList?.id) {
          try {
            localStorage.setItem('sm_favorite_list_id', rawList.id);
            localStorage.setItem('sm_favorite_list_slug', rawList.slug || effectiveSlug);
          } catch (_) {}
        }
        const nextSlug = (rawList?.slug || '').toLowerCase();
        if (nextSlug && nextSlug !== effectiveSlug && nextSlug !== 'owner') {
          navigate(`/favorites/${encodeURIComponent(nextSlug)}`, { replace: true });
        }

        setPageMedia({ images: favs, videos: [] });
        setMediaSlug(effectiveSlug);
        setLoading(false);

        const listVideos =
          videosAhead && pageUserId && String(pageUserId) === String(aheadUserId)
            ? await videosAhead
            : await loadVideos(pageUserId);
        if (cancelled) return;
        setPageMedia((prev) => ({ images: prev.images, videos: listVideos }));
        setClipsLoading(false);

        if (!isOwnerPage) {
          setExtraPages([]);
          return;
        }
        const ownerId = currentCreator?.id || rawList?.owner_user_id;
        if (!ownerId) return;
        try {
          const extras = await fetchOwnerExtraPages(sub, ownerId);
          if (cancelled) return;
          const pages = await Promise.all(
            extras.map(async (extraList) => ({
              list: extraList,
              images: await fetchFavoritesForList(
                sub,
                extraList,
                extraList.owner_user_id || ownerId
              ),
            }))
          );
          if (!cancelled) setExtraPages(pages);
        } catch (_) {
          if (!cancelled) setExtraPages([]);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e.message || 'Network error');
        setPageMedia(EMPTY_PAGE_MEDIA);
        setMediaSlug(effectiveSlug);
        setExtraPages([]);
        setLoading(false);
        setClipsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [currentCreator?.id, effectiveSlug, navigate]);

  const imageItems = useMemo(() => mapFavoriteImages(images), [images]);

  const videoItems = useMemo(
    () =>
      sortVideosForPlay(videos).map((v) => ({
        kind: 'video',
        id: `video-${v.id}`,
        title: v.title || 'Untitled video',
        thumb: publicStorageCardUrl(v.thumbnail || v.thumbnail_url || '', 720),
        created_at: v.created_at || '',
        raw: v,
      })),
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

  const visibleExtraPages = extraPageItems;
  const hasVisibleItems =
    imageItems.length > 0 ||
    videoItems.length > 0 ||
    clipsLoading ||
    visibleExtraPages.some((page) => page.images.length > 0);
  const onFriendPage = isOnFriendPage();

  const handleMakeMerch = (favorite, pageList = listMeta) => {
    const imageUrl = favoriteImageUrl(favorite);
    if (!imageUrl) {
      alert('No image available.');
      return;
    }

    markMerchIntentStarted();

    const merchData = {
      ...favoriteMerchImagePayload(favorite),
      videoTitle: favorite.title || 'Image',
      creatorName: currentCreator?.display_name || currentCreator?.username || 'Creator',
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
    prefetchVideoPlayback(video);
    navigate(`/video/${video.categoryId || 0}/${video.id}`, { state: { video } });
  };

  const creatorHeading = onFriendPage
    ? friendPageLabel(listMeta, currentCreator?.id)
    : '';
  const pageReady = !loading && mediaSlug === effectiveSlug;

  return (
    <div className={`container favorites-root ${sidebar ? '' : ' large-container'}`}>
      <StorefrontFlowBanner />

      <div className="favorites-page favorites-page--in-container">
        {error ? <p className="favorites-error">{error}</p> : null}

        {!pageReady && !error ? (
          <div className="favorites-shelves" aria-busy="true">
            <section className="favorites-shelf favorites-shelf--videos" aria-label="Loading clips">
              <FavoritesSectionHeader title="View Clip" showArrows={false} />
              <div className="favorites-shelf-scroller">
                <div className="favorites-shelf-track favorites-shelf-track--trio">
                  {[0, 1, 2].map((n) => (
                    <div className="favorites-card favorites-card--skeleton" key={`skel-${n}`}>
                      <div className="favorites-card-image" />
                      <div className="favorites-card-content">
                        <div className="favorites-skel-line" />
                        <div className="favorites-skel-btn" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {pageReady && !hasVisibleItems && extraPageItems.length === 0 && !error && !clipsLoading ? (
          <div className="favorites-empty">
            <h2>Nothing here yet</h2>
            <p>This page has no videos or images yet. Check back later!</p>
          </div>
        ) : null}

        {pageReady && (hasVisibleItems || extraPageItems.length > 0) ? (
          <div className="favorites-shelves">
            {videoItems.length > 0 ? (
              <FavoritesMediaSection
                id="videos"
                title="View Clip"
                ariaLabel="View Clip"
                itemCount={videoItems.length}
                className="favorites-shelf--videos"
                alwaysShowArrows
                onPrevAtStart={() => navigate('/')}
              >
                {videoItems.map((item, index) => (
                  <div className="favorites-card favorites-card--video" key={item.id}>
                    <button
                      type="button"
                      className="favorites-card-image favorites-card-image--clickable"
                      onClick={() => openVideo(item.raw)}
                      aria-label={`Watch ${item.title}`}
                    >
                      <FavoriteThumb src={item.thumb} eager={index < 3} />
                    </button>
                    <div className="favorites-card-content">
                      <h3>{item.title}</h3>
                      <button
                        type="button"
                        className="favorites-make-merch-btn"
                        onClick={() => openVideo(item.raw)}
                      >
                        Watch
                      </button>
                    </div>
                  </div>
                ))}
              </FavoritesMediaSection>
            ) : clipsLoading ? (
              <section className="favorites-shelf favorites-shelf--videos" aria-label="Loading clips">
                <FavoritesSectionHeader title="View Clip" showArrows={false} />
                <div className="favorites-shelf-scroller">
                  <div className="favorites-shelf-track favorites-shelf-track--trio">
                    {[0, 1, 2].map((n) => (
                      <div className="favorites-card favorites-card--skeleton" key={`clip-skel-${n}`}>
                        <div className="favorites-card-image" />
                        <div className="favorites-card-content">
                          <div className="favorites-skel-line" />
                          <div className="favorites-skel-btn" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {imageItems.length > 0 ? (
              <FavoritesMediaSection
                id="images"
                title="Images"
                leadTitle={creatorHeading && videoItems.length === 0 && !clipsLoading ? creatorHeading : undefined}
                ariaLabel="Images"
                itemCount={imageItems.length}
                className="favorites-shelf--images"
              >
                {imageItems.map((item, index) => (
                  <FavoriteImageCard
                    key={item.id}
                    item={item}
                    eager={index < 3}
                    onMakeMerch={handleMakeMerch}
                  />
                ))}
              </FavoritesMediaSection>
            ) : null}

            {visibleExtraPages.map((page) => (
              page.images.length > 0 ? (
                <FavoritesMediaSection
                  key={page.list.id || page.list.slug}
                  id={`page-${page.list.slug || page.list.id}`}
                  title={page.title}
                  ariaLabel={page.title}
                  itemCount={page.images.length}
                  className="favorites-extra-page"
                >
                  {page.images.map((item) => (
                    <FavoriteImageCard
                      key={item.id}
                      item={item}
                      onMakeMerch={(fav) => handleMakeMerch(fav, page.list)}
                    />
                  ))}
                </FavoritesMediaSection>
              ) : (
                <section
                  className="favorites-extra-page"
                  key={page.list.id || page.list.slug}
                  aria-label={page.title}
                >
                  <FavoritesSectionHeader title={page.title} />
                  <p className="favorites-extra-empty">No images on this page yet.</p>
                </section>
              )
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Favorites;
