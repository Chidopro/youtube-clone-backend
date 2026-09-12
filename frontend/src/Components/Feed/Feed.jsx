import React, { useEffect, useMemo, useState } from 'react'
import './Feed.css'
import { useNavigate } from 'react-router-dom'
import { publicStorageCardUrl, fetchPublicFavoriteLists } from '../../utils/favoriteListsApi'
import { getSubdomain } from '../../utils/subdomainService'

export const HUB_ROTATE_MS = 12000;

export function uniqueUrls(list) {
  const out = [];
  const seen = new Set();
  for (const u of list || []) {
    const s = (u || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Same photo at different sizes / Supabase render vs object URLs. */
export function imageIdentity(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    const path = u.pathname
      .replace('/storage/v1/render/image/public/', '/')
      .replace('/storage/v1/object/public/', '/');
    return `${u.host}${path}`.toLowerCase();
  } catch {
    return s.split('?')[0].toLowerCase();
  }
}

function hubSalt(hubKey) {
  let salt = 0;
  const s = String(hubKey || '');
  for (let i = 0; i < s.length; i += 1) salt += s.charCodeAt(i);
  return salt;
}

/** Rotating pick; skips URLs already in usedKeys (same image identity). */
export function pickRotatingUrl(urls, hubKey, tick, usedKeys = null) {
  const list = uniqueUrls(urls);
  if (!list.length) return null;
  const n = list.length;
  const start = ((tick + hubSalt(hubKey)) % n + n) % n;
  for (let i = 0; i < n; i += 1) {
    const url = list[(start + i) % n];
    const key = imageIdentity(url);
    if (!key) continue;
    if (usedKeys && usedKeys.has(key)) continue;
    if (usedKeys) usedKeys.add(key);
    return url;
  }
  return null;
}

/** Stable-ish pick that advances every HUB_ROTATE_MS and differs per hub key. */
export function rotatingUrl(urls, hubKey, tick) {
  return pickRotatingUrl(urls, hubKey, tick);
}

/** Homepage hubs: never show the same photo on two cards when another unused image exists. */
export function distinctHubThumbs({ favoriteUrls, friendUrls, shopPreferredUrls, shopUrls }, tick) {
  const used = new Set();
  const pick = (urls, key) =>
    pickRotatingUrl(urls, key, tick, used) || pickRotatingUrl(urls, key, tick);
  return {
    favorites: pick(favoriteUrls, 'favorites'),
    friend: pick(friendUrls, 'friend'),
    shop: pick(shopPreferredUrls, 'shop') || pick(shopUrls, 'shop-more'),
  };
}

/** Top row: first distinct photo per hub. Does not rotate. */
export function stagnantHubThumbs(pools) {
  return distinctHubThumbs(pools, 0);
}

function urlsWithout(urls, blockedIdentities) {
  return (urls || []).filter((u) => {
    const key = imageIdentity(u);
    return key && !blockedIdentities.has(key);
  });
}

/** Second row: rotate through leftover photos, skipping the still top-row images. */
export function shuffleHubThumbs(pools, tick, stagnant) {
  const blocked = new Set(
    [stagnant?.favorites, stagnant?.friend, stagnant?.shop].map(imageIdentity).filter(Boolean)
  );
  return distinctHubThumbs(
    {
      favoriteUrls: urlsWithout(pools.favoriteUrls, blocked),
      friendUrls: urlsWithout(pools.friendUrls, blocked),
      shopPreferredUrls: urlsWithout(pools.shopPreferredUrls, blocked),
      shopUrls: urlsWithout(pools.shopUrls, blocked),
    },
    tick
  );
}

export function HubThumb({ src, emptyLabel }) {
  const [current, setCurrent] = useState(src || '');

  useEffect(() => {
    setCurrent(src || '');
  }, [src]);

  if (current) {
    return (
      <img
        src={current}
        alt=""
        loading="eager"
        fetchPriority="high"
        decoding="async"
        onError={() => {
          try {
            const u = new URL(current);
            if (u.pathname.includes('/storage/v1/render/image/public/')) {
              u.pathname = u.pathname.replace(
                '/storage/v1/render/image/public/',
                '/storage/v1/object/public/'
              );
              u.search = '';
              setCurrent(u.toString());
              return;
            }
          } catch (_) {}
          setCurrent('');
        }}
      />
    );
  }
  return (
    <div className="hub-card-empty" aria-hidden="true">
      <span>{emptyLabel}</span>
    </div>
  );
}

const Feed = ({
  videos = [],
  favoritesPreview = null,
  friendPagePreview = null,
  shopPreview = null,
  showHubs = false,
}) => {
  const navigate = useNavigate();
  const [tick, setTick] = useState(() => Math.floor(Date.now() / HUB_ROTATE_MS));

  useEffect(() => {
    if (!showHubs) return undefined;
    const id = window.setInterval(() => {
      setTick(Math.floor(Date.now() / HUB_ROTATE_MS));
    }, Math.min(HUB_ROTATE_MS, 4000));
    return () => window.clearInterval(id);
  }, [showHubs]);

  const favoriteUrls = useMemo(
    () => uniqueUrls((Array.isArray(favoritesPreview) ? favoritesPreview : []).map((u) => publicStorageCardUrl(u, 1400))),
    [favoritesPreview]
  );
  const friendUrls = useMemo(
    () => uniqueUrls((Array.isArray(friendPagePreview) ? friendPagePreview : []).map((u) => publicStorageCardUrl(u, 1400))),
    [friendPagePreview]
  );
  const shopUrls = useMemo(() => {
    const pageUrls = (Array.isArray(shopPreview) ? shopPreview : []).map((u) => publicStorageCardUrl(u, 1400));
    const videoUrls = (videos || []).map((v) => v.thumbnail || v.thumbnail_url).filter(Boolean);
    return uniqueUrls([...pageUrls, ...favoriteUrls, ...friendUrls, ...videoUrls]);
  }, [shopPreview, videos, favoriteUrls, friendUrls]);

  const shopPreferredUrls = useMemo(() => {
    const taken = new Set(
      [...favoriteUrls, ...friendUrls].map(imageIdentity).filter(Boolean)
    );
    return shopUrls.filter((url) => {
      const key = imageIdentity(url);
      return key && !taken.has(key);
    });
  }, [shopUrls, favoriteUrls, friendUrls]);

  const hubPools = useMemo(
    () => ({ favoriteUrls, friendUrls, shopPreferredUrls, shopUrls }),
    [favoriteUrls, friendUrls, shopPreferredUrls, shopUrls]
  );

  const hubThumbs = useMemo(() => stagnantHubThumbs(hubPools), [hubPools]);

  const shuffleThumbs = useMemo(
    () => shuffleHubThumbs(hubPools, tick, hubThumbs),
    [hubPools, tick, hubThumbs]
  );

  return (
    <div className="feed-wrap">
      {showHubs && (
        <>
          <div className="feed-hubs" aria-label="Storefront sections">
            <button type="button" className="card hub-card" onClick={() => navigate('/favorites')}>
              <HubThumb src={hubThumbs.favorites} emptyLabel="No Images Yet" />
              <h2>My Page</h2>
            </button>
            <button
              type="button"
              className="card hub-card"
              onPointerEnter={() => {
                const sub = getSubdomain();
                if (sub) fetchPublicFavoriteLists(sub, { lite: true });
              }}
              onClick={() => navigate('/friend-pages')}
            >
              <HubThumb src={hubThumbs.friend} emptyLabel="No Friends Yet" />
              <h2>My Friends</h2>
            </button>
            <button type="button" className="card hub-card" onClick={() => navigate('/shop')}>
              <HubThumb src={hubThumbs.shop} emptyLabel="My Shop" />
              <h2>My Shop</h2>
            </button>
          </div>
          <div className="feed-hubs feed-hubs--shuffle" aria-label="More from this store">
            <button
              type="button"
              className="card hub-card hub-card--shuffle"
              aria-label="More from My Page"
              onClick={() => navigate('/favorites')}
            >
              <HubThumb
                key={shuffleThumbs.favorites || 'page-shuffle'}
                src={shuffleThumbs.favorites}
                emptyLabel=""
              />
            </button>
            <button
              type="button"
              className="card hub-card hub-card--shuffle"
              aria-label="More from My Friends"
              onPointerEnter={() => {
                const sub = getSubdomain();
                if (sub) fetchPublicFavoriteLists(sub, { lite: true });
              }}
              onClick={() => navigate('/friend-pages')}
            >
              <HubThumb
                key={shuffleThumbs.friend || 'friends-shuffle'}
                src={shuffleThumbs.friend}
                emptyLabel=""
              />
            </button>
            <button
              type="button"
              className="card hub-card hub-card--shuffle"
              aria-label="More from My Shop"
              onClick={() => navigate('/shop')}
            >
              <HubThumb
                key={shuffleThumbs.shop || 'shop-shuffle'}
                src={shuffleThumbs.shop}
                emptyLabel=""
              />
            </button>
          </div>
        </>
      )}

      {!showHubs ? (
      <div className="feed" id="storefront-videos">
        {videos.map((item) => (
          <div
            key={item.id}
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/video/${item.categoryId || 0}/${item.id}`)}
          >
            <img
              src={item.thumbnail || item.thumbnail_url || 'https://via.placeholder.com/320x180?text=No+Thumbnail'}
              alt=""
            />
            <h2>{item.title}</h2>
            <h3>{item.channelTitle || 'Creator'}</h3>
          </div>
        ))}
      </div>
      ) : null}
    </div>
  );
};

export default Feed;
