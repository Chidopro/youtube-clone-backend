import React, { useEffect, useMemo, useState } from 'react'
import './Feed.css'
import { useNavigate } from 'react-router-dom'
import { publicStorageCardUrl, fetchPublicFavoriteLists } from '../../utils/favoriteListsApi'
import { getSubdomain } from '../../utils/subdomainService'
import { prefetchVideoPlayback } from '../../utils/videoOptimize'
import { hashIsNearSet, hashesTooClose, loadAverageHash } from '../../utils/imageVisualHash'
import { isDemoStorefront } from '../../utils/demoStorefront'
import { applyCoverFrame } from '../../utils/coverFrame'

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

/** One URL per photo, ignoring size/render query differences. */
export function uniqueByIdentity(list) {
  const out = [];
  const seen = new Set();
  for (const u of list || []) {
    const s = (u || '').trim();
    const key = imageIdentity(s);
    if (!s || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Same photo at different sizes, thumbs vs originals, or two saves a couple seconds apart. */
export function imageIdentity(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    const path = u.pathname
      .replace('/storage/v1/render/image/public/', '/')
      .replace('/storage/v1/object/public/', '/');
    const fav = path.match(/\/thumbnails\/([^/]+)\/favorites\/(?:thumbs\/)?(\d{12,})/i);
    if (fav) {
      const bucket = Math.floor(Number(fav[2]) / 5000);
      return `${u.host}/thumbnails/${fav[1]}/fav:${bucket}`.toLowerCase();
    }
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
export function pickRotatingUrl(urls, hubKey, tick, usedKeys = null, visual = null) {
  const list = uniqueUrls(urls);
  if (!list.length) return null;
  const n = list.length;
  const start = ((tick + hubSalt(hubKey)) % n + n) % n;
  const hashByUrl = visual?.hashByUrl || {};
  const usedHashes = visual?.usedHashes || null;
  for (let i = 0; i < n; i += 1) {
    const url = list[(start + i) % n];
    const key = imageIdentity(url);
    if (!key) continue;
    if (usedKeys && usedKeys.has(key)) continue;
    const hash = hashByUrl[url];
    if (usedHashes && hash && hashIsNearSet(hash, usedHashes)) continue;
    if (usedKeys) usedKeys.add(key);
    if (usedHashes && hash) usedHashes.add(hash);
    return url;
  }
  return null;
}

/** Stable-ish pick that advances every HUB_ROTATE_MS and differs per hub key. */
export function rotatingUrl(urls, hubKey, tick) {
  return pickRotatingUrl(urls, hubKey, tick);
}

/** Homepage hubs: never show the same photo on two cards when another unused image exists.
 * When a co-creator photo is available, it goes in the Creator window and
 * Co-Creators takes a different photo. Shop stays on its own pick.
 */
export function distinctHubThumbs({ favoriteUrls, friendUrls, shopPreferredUrls, shopUrls }, tick, hashByUrl = {}) {
  const used = new Set();
  const usedHashes = new Set();
  const visual = { hashByUrl, usedHashes };
  const pick = (urls, key) => pickRotatingUrl(urls, key, tick, used, visual);
  const creatorImage = pick(favoriteUrls, 'favorites');
  const coCreatorImage = pick(friendUrls, 'friend');
  if (!coCreatorImage) {
    return {
      favorites: creatorImage,
      friend: pick(favoriteUrls, 'friend-fill') || pick(shopUrls, 'friend-shop'),
      shop: pick(shopPreferredUrls, 'shop') || pick(shopUrls, 'shop-more'),
    };
  }
  const shop = pick(shopPreferredUrls, 'shop') || pick(shopUrls, 'shop-more');
  const replacement =
    pick(friendUrls, 'friend-next') ||
    pick(favoriteUrls, 'friend-own') ||
    pick(shopUrls, 'friend-shop-left') ||
    creatorImage;
  return {
    favorites: coCreatorImage,
    friend: replacement,
    shop,
  };
}

/** Top row: first distinct photo per hub. Does not rotate. */
export function stagnantHubThumbs(pools, hashByUrl = {}) {
  return distinctHubThumbs(pools, 0, hashByUrl);
}

function uniqueByVisual(urls, hashByUrl = {}) {
  const out = [];
  const used = new Set();
  const hashes = new Set();
  for (const url of urls || []) {
    const s = (url || '').trim();
    const key = imageIdentity(s);
    if (!s || !key || used.has(key)) continue;
    const hash = hashByUrl[s];
    if (hash && hashIsNearSet(hash, hashes)) continue;
    used.add(key);
    if (hash) hashes.add(hash);
    out.push(s);
  }
  return out;
}

function sameHubPhoto(a, b, hashByUrl = {}) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (imageIdentity(a) === imageIdentity(b)) return true;
  return hashesTooClose(hashByUrl[a], hashByUrl[b]);
}

/** Rotate through a list without repeating a URL in the same tick. */
export function takeRotatedDistinct(list, tick, count = 3) {
  const urls = uniqueByIdentity(list);
  const n = urls.length;
  if (!n) return Array.from({ length: count }, () => null);
  if (n >= count) {
    const start = ((tick % n) + n) % n;
    return Array.from({ length: count }, (_, i) => urls[(start + i) % n]);
  }
  return [...urls, ...Array.from({ length: count - n }, () => null)];
}

export function hubIdentities(thumbs) {
  return new Set(
    [thumbs?.favorites, thumbs?.friend, thumbs?.shop].map(imageIdentity).filter(Boolean)
  );
}

function hubHashSet(thumbs, hashByUrl = {}) {
  return new Set(
    [thumbs?.favorites, thumbs?.friend, thumbs?.shop]
      .map((url) => hashByUrl[url])
      .filter(Boolean)
  );
}

/** These Deluzion top-row photos stay fixed across login, logout, new uploads, and reloads. */
const LOCKED_HUB_TOP = {
  deluzion: {
    favorites: 'https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/thumbnails/8a6b0ae8-19ed-46ca-857a-a56366e780e1/favorites/thumbs/1790336768390-2ff0c6.jpg',
    friend: 'https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/thumbnails/1c382c92-00b1-4ccd-b2c1-a1b4b973dca9/favorites/thumbs/1790337127610-ef0976.jpg',
    shop: 'https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/thumbnails/1c382c92-00b1-4ccd-b2c1-a1b4b973dca9/favorites/thumbs/1790337010649-511c88.jpg',
  },
};

function hubTopStorageKey(subdomain) {
  return `sm_hub_top_v1:${String(subdomain || '').trim().toLowerCase()}`;
}

function readHubTopPin(subdomain) {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(hubTopStorageKey(subdomain)) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const favorites = String(parsed.favorites || '').trim();
    const friend = String(parsed.friend || '').trim();
    const shop = String(parsed.shop || '').trim();
    if (!favorites || !friend || !shop) return null;
    return { favorites, friend, shop };
  } catch (_) {
    return null;
  }
}

function writeHubTopPin(subdomain, thumbs) {
  if (typeof window === 'undefined') return;
  const favorites = String(thumbs?.favorites || '').trim();
  const friend = String(thumbs?.friend || '').trim();
  const shop = String(thumbs?.shop || '').trim();
  if (!favorites || !friend || !shop) return;
  try {
    window.localStorage.setItem(
      hubTopStorageKey(subdomain),
      JSON.stringify({ favorites, friend, shop })
    );
  } catch (_) { /* private mode */ }
}

/** Top row sticks once chosen. New uploads and sign-in changes do not replace it. */
export function lockedHubThumbs(subdomain, computed) {
  const saved = readHubTopPin(subdomain);
  if (saved) return saved;
  const seed = LOCKED_HUB_TOP[String(subdomain || '').trim().toLowerCase()];
  if (seed?.favorites && seed?.friend && seed?.shop) {
    writeHubTopPin(subdomain, seed);
    return seed;
  }
  const next = {
    favorites: computed?.favorites || null,
    friend: computed?.friend || null,
    shop: computed?.shop || null,
  };
  writeHubTopPin(subdomain, next);
  return next;
}

/** Keep the first chosen top-row photos so a growing pool cannot move them into the shuffle. */
export function pinStagnantHubThumbs(pinned, next, poolUrls, hashByUrl = {}) {
  const fillFrom = uniqueByVisual(poolUrls, hashByUrl);
  const poolIds = new Set(fillFrom.map(imageIdentity).filter(Boolean));
  const stillInPool = (url) => url && poolIds.has(imageIdentity(url));
  const kept = {
    favorites: stillInPool(pinned?.favorites) ? pinned.favorites : null,
    friend: stillInPool(pinned?.friend) ? pinned.friend : null,
    shop: stillInPool(pinned?.shop) ? pinned.shop : null,
  };
  const clashes = (url, others) => others.some((other) => sameHubPhoto(url, other, hashByUrl));
  if (clashes(kept.friend, [kept.favorites])) kept.friend = null;
  if (clashes(kept.shop, [kept.favorites, kept.friend])) kept.shop = null;

  const used = hubIdentities(kept);
  const usedHashes = hubHashSet(kept, hashByUrl);
  const take = (current, candidate) => {
    if (current) return current;
    const tryUrl = (url) => {
      const key = imageIdentity(url);
      if (!key || used.has(key)) return null;
      const hash = hashByUrl[url];
      if (hash && hashIsNearSet(hash, usedHashes)) return null;
      used.add(key);
      if (hash) usedHashes.add(hash);
      return url;
    };
    return tryUrl(candidate) || fillFrom.reduce((found, url) => found || tryUrl(url), null);
  };
  return {
    favorites: take(kept.favorites, next?.favorites),
    friend: take(kept.friend, next?.friend),
    shop: take(kept.shop, next?.shop),
  };
}

/** Second row: leftover photos only — three different images, never a top-row photo. */
export function shuffleHubThumbs(pools, tick, stagnant, hashByUrl = {}) {
  const blocked = hubIdentities(stagnant);
  const blockedHashes = hubHashSet(stagnant, hashByUrl);
  const leftover = uniqueByVisual(
    [
      ...(pools.favoriteUrls || []),
      ...(pools.friendUrls || []),
      ...(pools.shopPreferredUrls || []),
      ...(pools.shopUrls || []),
    ].filter((u) => {
      if (!u || blocked.has(imageIdentity(u))) return false;
      const hash = hashByUrl[u];
      if (hash && hashIsNearSet(hash, blockedHashes)) return false;
      return true;
    }),
    hashByUrl
  );

  const [favorites, friend, shop] = takeRotatedDistinct(leftover, tick, 3);
  return { favorites, friend, shop };
}

export function HubThumb({ src, emptyLabel }) {
  const [fallback, setFallback] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFallback('');
    setFailed(false);
  }, [src]);

  const current = failed ? '' : (fallback || src || '');

  if (!current) {
    return (
      <div className={`hub-card-empty${emptyLabel ? '' : ' hub-card-empty--pulse'}`} aria-hidden="true">
        {emptyLabel ? <span>{emptyLabel}</span> : null}
      </div>
    );
  }

  return (
    <img
      src={current}
      alt=""
      loading={emptyLabel ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={emptyLabel ? 'high' : 'auto'}
      ref={applyCoverFrame}
      onLoad={(e) => applyCoverFrame(e.currentTarget)}
      onError={(e) => {
        try {
          const u = new URL(e.currentTarget.src);
          if (u.pathname.includes('/storage/v1/render/image/public/')) {
            u.pathname = u.pathname.replace(
              '/storage/v1/render/image/public/',
              '/storage/v1/object/public/'
            );
            u.search = '';
            const next = u.toString();
            if (e.currentTarget.src !== next) {
              setFallback(next);
              return;
            }
          }
        } catch (_) { /* ignore */ }
        setFailed(true);
      }}
    />
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
    () => uniqueByIdentity((Array.isArray(favoritesPreview) ? favoritesPreview : []).map((u) => publicStorageCardUrl(u, 800))),
    [favoritesPreview]
  );
  const friendUrls = useMemo(
    () => uniqueByIdentity((Array.isArray(friendPagePreview) ? friendPagePreview : []).map((u) => publicStorageCardUrl(u, 800))),
    [friendPagePreview]
  );
  const shopUrls = useMemo(() => {
    const pageUrls = (Array.isArray(shopPreview) ? shopPreview : []).map((u) => publicStorageCardUrl(u, 800));
    // Real storefronts shuffle stills only. Clip thumbs mix in strangers from View Clip.
    const videoUrls = isDemoStorefront()
      ? (videos || []).map((v) => v.thumbnail || v.thumbnail_url).filter(Boolean)
      : [];
    return uniqueByIdentity([...pageUrls, ...favoriteUrls, ...friendUrls, ...videoUrls]);
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

  const [hashByUrl, setHashByUrl] = useState({});
  useEffect(() => {
    if (!showHubs) return undefined;
    const urls = uniqueByIdentity([...favoriteUrls, ...friendUrls, ...shopUrls]);
    if (!urls.length) {
      setHashByUrl({});
      return undefined;
    }
    let cancelled = false;
    Promise.all(urls.map(async (url) => [url, await loadAverageHash(url)])).then((entries) => {
      if (cancelled) return;
      setHashByUrl(Object.fromEntries(entries.filter(([, hash]) => hash)));
    });
    return () => {
      cancelled = true;
    };
  }, [showHubs, favoriteUrls, friendUrls, shopUrls]);

  const hubThumbs = useMemo(() => {
    const next = stagnantHubThumbs(hubPools, hashByUrl);
    return lockedHubThumbs(getSubdomain(), next);
  }, [hubPools, hashByUrl]);

  const shuffleThumbs = useMemo(() => {
    const picked = shuffleHubThumbs(hubPools, tick, hubThumbs, hashByUrl);
    const used = hubIdentities(hubThumbs);
    const usedHashes = hubHashSet(hubThumbs, hashByUrl);
    const keep = (url) => {
      const key = imageIdentity(url);
      if (!url || !key || used.has(key)) return null;
      const hash = hashByUrl[url];
      if (hash && hashIsNearSet(hash, usedHashes)) return null;
      used.add(key);
      if (hash) usedHashes.add(hash);
      return url;
    };
    return {
      favorites: keep(picked.favorites),
      friend: keep(picked.friend),
      shop: keep(picked.shop),
    };
  }, [hubPools, tick, hubThumbs, hashByUrl]);

  return (
    <div className="feed-wrap">
      {showHubs && (
        <>
          <div className="feed-hubs" aria-label="Storefront sections">
            <button type="button" className="card hub-card" onClick={() => navigate('/favorites')}>
              <HubThumb src={hubThumbs.favorites} emptyLabel="No Images Yet" />
              <h2>Creator</h2>
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
              <HubThumb src={hubThumbs.friend} emptyLabel="No Co-Creators Yet" />
              <h2>Co-Creators</h2>
            </button>
            <button type="button" className="card hub-card" onClick={() => navigate('/shop')}>
              <HubThumb src={hubThumbs.shop} emptyLabel="Shop" />
              <h2>Shop</h2>
            </button>
          </div>
          <div className="feed-hubs feed-hubs--shuffle" aria-label="More from this store">
            <button
              type="button"
              className="card hub-card hub-card--shuffle"
              aria-label="More from Creator"
              onClick={() => navigate('/favorites')}
            >
              <HubThumb src={shuffleThumbs.favorites} emptyLabel="" />
            </button>
            <button
              type="button"
              className="card hub-card hub-card--shuffle"
              aria-label="More from Co-Creators"
              onPointerEnter={() => {
                const sub = getSubdomain();
                if (sub) fetchPublicFavoriteLists(sub, { lite: true });
              }}
              onClick={() => navigate('/friend-pages')}
            >
              <HubThumb src={shuffleThumbs.friend} emptyLabel="" />
            </button>
            <button
              type="button"
              className="card hub-card hub-card--shuffle"
              aria-label="More from Shop"
              onClick={() => navigate('/shop')}
            >
              <HubThumb src={shuffleThumbs.shop} emptyLabel="" />
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
            onClick={() => {
              prefetchVideoPlayback(item);
              navigate(`/video/${item.categoryId || 0}/${item.id}`, { state: { video: item } });
            }}
          >
            <img
              src={publicStorageCardUrl(item.thumbnail || item.thumbnail_url || '', 720) || item.thumbnail || item.thumbnail_url || 'https://via.placeholder.com/320x180?text=No+Thumbnail'}
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
