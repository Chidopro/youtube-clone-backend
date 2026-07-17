import { getBackendUrl } from '../config/apiConfig';
import { claimSessionTokenIfNeeded } from './userService';

async function authHeaders() {
  const raw = localStorage.getItem('user');
  if (!raw) throw new Error('Not signed in');
  const user = JSON.parse(raw);
  const token = await claimSessionTokenIfNeeded(user.id);
  return {
    'Content-Type': 'application/json',
    'X-User-Id': user.id,
    ...(user.email ? { 'X-User-Email': String(user.email).trim().toLowerCase() } : {}),
    ...(token ? { 'X-Session-Token': token } : {}),
  };
}

export async function favoriteListsJson(path, options = {}, retried = false) {
  const base = await authHeaders();
  let res;
  try {
    res = await fetch(`${getBackendUrl()}${path}`, {
      credentials: 'include',
      ...options,
      headers: { ...base, ...options.headers },
    });
  } catch (err) {
    return { ok: false, status: 0, data: { error: err.message || 'Network error' } };
  }
  const data = await res.json().catch(() => ({}));
  if (data?.user_id && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && String(u.id) !== String(data.user_id)) {
          localStorage.setItem('user', JSON.stringify({ ...u, id: data.user_id }));
        }
      }
    } catch (_) {}
  }
  if (res.status === 403 && !retried) {
    try {
      localStorage.removeItem('auth_token');
    } catch (_) {}
    const raw = localStorage.getItem('user');
    const userId = raw ? JSON.parse(raw)?.id : null;
    if (userId) await claimSessionTokenIfNeeded(userId);
    return favoriteListsJson(path, options, true);
  }
  return { ok: res.ok, status: res.status, data };
}

export async function fetchPublicFavoriteLists(subdomain) {
  const s = (subdomain || '').trim().toLowerCase();
  if (!s) return { ok: true, data: { success: true, lists: [] } };
  const res = await fetch(`${getBackendUrl()}/api/public/favorite-lists?subdomain=${encodeURIComponent(s)}`, {
    credentials: 'omit',
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function favoriteImageUrl(favorite) {
  if (!favorite) return '';
  return (favorite.image_url || favorite.thumbnail_url || favorite.thumbnail || '').trim();
}

export function listPreviewImages(list) {
  if (!list) return [];
  if (Array.isArray(list.preview_images) && list.preview_images.length) {
    return list.preview_images.map((u) => String(u || '').trim()).filter(Boolean);
  }
  const single = (list.preview_image_url || '').trim();
  return single ? [single] : [];
}

export async function fetchPublicFavoritesByList(subdomain, listSlug) {
  const sub = (subdomain || '').trim().toLowerCase();
  const slug = (listSlug || 'owner').trim().toLowerCase() || 'owner';
  if (!sub) return { ok: false, data: { success: false, error: 'subdomain is required' } };
  const res = await fetch(
    `${getBackendUrl()}/api/public/favorites-by-list?subdomain=${encodeURIComponent(sub)}&list_slug=${encodeURIComponent(slug)}`,
    { credentials: 'omit' }
  );
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}
