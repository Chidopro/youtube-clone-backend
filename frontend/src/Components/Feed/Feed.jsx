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

/** Stable-ish pick that advances every HUB_ROTATE_MS and differs per hub key. */
export function rotatingUrl(urls, hubKey, tick) {
  const list = uniqueUrls(urls);
  if (!list.length) return null;
  let salt = 0;
  for (let i = 0; i < hubKey.length; i += 1) salt += hubKey.charCodeAt(i);
  return list[(tick + salt) % list.length];
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
        loading="lazy"
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
    const id = window.setInterval(() => {
      setTick(Math.floor(Date.now() / HUB_ROTATE_MS));
    }, Math.min(HUB_ROTATE_MS, 4000));
    return () => window.clearInterval(id);
  }, []);

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

  const hubThumbs = useMemo(
    () => ({
      shop: rotatingUrl(shopUrls, 'shop', tick),
      favorites: rotatingUrl(favoriteUrls, 'favorites', tick),
      friend: rotatingUrl(friendUrls, 'friend', tick),
    }),
    [shopUrls, favoriteUrls, friendUrls, tick]
  );

  return (
    <div className="feed-wrap">
      {showHubs && (
        <div className="feed-hubs" aria-label="Storefront sections">
          <button type="button" className="card hub-card" onClick={() => navigate('/shop')}>
            <HubThumb src={hubThumbs.shop} emptyLabel="My Shop" />
            <h2>My Shop</h2>
          </button>
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
        </div>
      )}

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
    </div>
  );
};

export default Feed;
