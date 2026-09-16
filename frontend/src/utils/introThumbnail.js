import { apiJoin } from '../config/apiConfig';

const CACHE_KEY = 'sm_how_it_works_intro_thumb';

export const readCachedIntroThumbnail = () => {
  try {
    const url = (localStorage.getItem(CACHE_KEY) || '').trim();
    return url || null;
  } catch (_) {
    return null;
  }
};

export const writeCachedIntroThumbnail = (url) => {
  try {
    const next = (url || '').trim();
    if (!next) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    localStorage.setItem(CACHE_KEY, next);
  } catch (_) {
    /* ignore */
  }
};

export const fetchIntroThumbnail = async () => {
  const res = await fetch(apiJoin('/api/public/intro-video'));
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const thumb = (data?.video?.thumbnail || data?.video?.thumbnail_url || '').trim();
  return thumb || null;
};
