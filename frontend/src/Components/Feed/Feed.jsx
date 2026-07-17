import React, { useEffect, useMemo, useState } from 'react'
import './Feed.css'
import { useNavigate } from 'react-router-dom'

const HUB_ROTATE_MS = 12000;

function uniqueUrls(list) {
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
function rotatingUrl(urls, hubKey, tick) {
  const list = uniqueUrls(urls);
  if (!list.length) return null;
  let salt = 0;
  for (let i = 0; i < hubKey.length; i += 1) salt += hubKey.charCodeAt(i);
  return list[(tick + salt) % list.length];
}

function HubThumb({ src, emptyLabel }) {
  if (src) {
    return <img src={src} alt="" />;
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
  showHubs = true,
}) => {
  const navigate = useNavigate();
  const [tick, setTick] = useState(() => Math.floor(Date.now() / HUB_ROTATE_MS));

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick(Math.floor(Date.now() / HUB_ROTATE_MS));
    }, Math.min(HUB_ROTATE_MS, 4000));
    return () => window.clearInterval(id);
  }, []);

  const videoUrls = useMemo(
    () => uniqueUrls(videos.map((v) => v.thumbnail || v.thumbnail_url).filter(Boolean)),
    [videos]
  );
  const favoriteUrls = useMemo(
    () => uniqueUrls(Array.isArray(favoritesPreview) ? favoritesPreview : []),
    [favoritesPreview]
  );
  const friendUrls = useMemo(
    () => uniqueUrls(Array.isArray(friendPagePreview) ? friendPagePreview : []),
    [friendPagePreview]
  );

  const hubThumbs = useMemo(
    () => ({
      videos: rotatingUrl(videoUrls, 'videos', tick),
      favorites: rotatingUrl(favoriteUrls, 'favorites', tick),
      friend: rotatingUrl(friendUrls, 'friend', tick),
    }),
    [videoUrls, favoriteUrls, friendUrls, tick]
  );

  const scrollToVideos = () => {
    const el = document.getElementById('storefront-videos');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    navigate('/#storefront-videos');
  };

  return (
    <div className="feed-wrap">
      {showHubs && (
        <div className="feed-hubs" aria-label="Storefront sections">
          <button type="button" className="card hub-card" onClick={scrollToVideos}>
            <HubThumb src={hubThumbs.videos} emptyLabel="No Videos Yet" />
            <h2>My Videos</h2>
          </button>
          <button type="button" className="card hub-card" onClick={() => navigate('/favorites')}>
            <HubThumb src={hubThumbs.favorites} emptyLabel="No Favorites Yet" />
            <h2>My Favorites</h2>
          </button>
          <button type="button" className="card hub-card" onClick={() => navigate('/friend-pages')}>
            <HubThumb src={hubThumbs.friend} emptyLabel="No Friends Yet" />
            <h2>Friends List</h2>
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
