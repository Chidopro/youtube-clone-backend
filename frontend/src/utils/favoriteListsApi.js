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
    ...(token ? { 'X-Session-Token': token } : {}),
  };
}

export async function favoriteListsJson(path, options = {}) {
  const base = await authHeaders();
  const res = await fetch(`${getBackendUrl()}${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...base, ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
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

export async function fetchPublicFavoritesByList(subdomain, listSlug) {
  const slug = (listSlug || 'owner').trim().toLowerCase() || 'owner';
  const res = await fetch(
    `${getBackendUrl()}/api/public/favorites-by-list?subdomain=${encodeURIComponent(subdomain)}&list_slug=${encodeURIComponent(slug)}`,
    { credentials: 'omit' }
  );
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}
