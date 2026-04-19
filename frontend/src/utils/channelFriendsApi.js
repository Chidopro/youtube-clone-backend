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

export async function channelFriendsFetch(path, options = {}) {
  const base = await authHeaders();
  const headers = { ...base, ...options.headers };
  return fetch(`${getBackendUrl()}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });
}

export async function channelFriendsJson(path, options = {}) {
  const res = await channelFriendsFetch(path, options);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
