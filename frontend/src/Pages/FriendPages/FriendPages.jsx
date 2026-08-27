import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain } from '../../utils/subdomainService';
import {
  fetchPublicFavoriteLists,
  peekPublicFavoriteLists,
  fetchPublicFavoritesByList,
  listPreviewImages,
  favoriteImageUrl,
  publicStorageCardUrl,
} from '../../utils/favoriteListsApi';
import { friendPageLabel, isCollaboratorFavoriteList } from '../../utils/favoriteListLabels';
import { HubThumb, rotatingUrl, uniqueUrls, HUB_ROTATE_MS } from '../../Components/Feed/Feed';
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

function previewUrlsFromList(list) {
  return uniqueUrls(
    listPreviewImages(list).map((u) => publicStorageCardUrl(u, 1400))
  );
}

async function attachPreviewUrls(lists, sub) {
  const out = [];
  for (const L of lists) {
    let previewUrls = previewUrlsFromList(L);
    if (!previewUrls.length) {
      const slug = (L.slug || '').trim();
      if (slug) {
        const { ok, data } = await fetchPublicFavoritesByList(sub, slug);
        if (ok && data?.success) {
          previewUrls = uniqueUrls(
            (data.favorites || [])
              .map((f) => publicStorageCardUrl(favoriteImageUrl(f), 1400))
              .filter(Boolean)
          );
        }
      }
    }
    out.push({ ...L, previewUrls });
  }
  return out;
}

const FriendPages = ({ sidebar }) => {
  const navigate = useNavigate();
  const { currentCreator } = useCreator();
  const cachedLists = peekPublicFavoriteLists(getSubdomain());
  const [pages, setPages] = useState(() =>
    umbrellaFriendPages(cachedLists, currentCreator?.id).map((L) => ({
      ...L,
      previewUrls: previewUrlsFromList(L),
    }))
  );
  const [loading, setLoading] = useState(cachedLists == null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(() => Math.floor(Date.now() / HUB_ROTATE_MS));
  const listRef = useRef(null);

  const scrollFriends = (direction) => {
    const el = listRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.9, 280);
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick(Math.floor(Date.now() / HUB_ROTATE_MS));
    }, Math.min(HUB_ROTATE_MS, 4000));
    return () => window.clearInterval(id);
  }, []);

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
        setPages(
          umbrellaFriendPages(cached, currentCreator?.id).map((L) => ({
            ...L,
            previewUrls: previewUrlsFromList(L),
          }))
        );
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError('');
      try {
        const { ok, data } = await fetchPublicFavoriteLists(sub);
        if (!ok || !data?.success) {
          if (!cached) {
            setError(data?.error || 'Could not load friends list');
            setPages([]);
          }
        } else {
          const lists = umbrellaFriendPages(data.lists, currentCreator?.id);
          setPages(await attachPreviewUrls(lists, sub));
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

  const thumbs = useMemo(
    () =>
      Object.fromEntries(
        pages.map((L) => [
          L.id || L.slug,
          rotatingUrl(L.previewUrls, String(L.slug || L.id || 'friend'), tick),
        ])
      ),
    [pages, tick]
  );

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
          <button
            type="button"
            className="friend-pages-back-btn friend-pages-scroll-right-btn"
            onClick={() => scrollFriends(1)}
            aria-label="Scroll friends right"
          >
            →
          </button>
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
          <ul className="friend-pages-list" ref={listRef}>
            {pages.map((L) => {
              const label = friendPageLabel(L, currentCreator?.id);
              const to =
                L.slug === 'owner' ? '/favorites' : `/favorites/${encodeURIComponent(L.slug)}`;
              const key = L.id || L.slug;
              return (
                <li key={key}>
                  <button
                    type="button"
                    className="friend-pages-item"
                    onClick={() => navigate(to)}
                  >
                    <span className="friend-pages-item-thumb">
                      <HubThumb src={thumbs[key]} emptyLabel={label} />
                    </span>
                    <span className="friend-pages-item-name">{label}</span>
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
