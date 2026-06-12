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

export async function channelFriendsFetch(path, options = {}) {
  const base = await authHeaders();
  const headers = { ...base, ...options.headers };
  try {
    return await fetch(`${getBackendUrl()}${path}`, {
      credentials: 'include',
      ...options,
      headers,
    });
  } catch (err) {
    const netErr = new Error(
      'Network error — check your connection, disable VPN if on, then refresh and try again.'
    );
    netErr.cause = err;
    throw netErr;
  }
}

export async function channelFriendsJson(path, options = {}, retried = false) {
  let res;
  try {
    res = await channelFriendsFetch(path, options);
  } catch (err) {
    return { ok: false, status: 0, data: { error: err.message || 'Network error' } };
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 403 && !retried) {
    try {
      localStorage.removeItem('auth_token');
    } catch (_) {}
    const raw = localStorage.getItem('user');
    const userId = raw ? JSON.parse(raw)?.id : null;
    if (userId) await claimSessionTokenIfNeeded(userId);
    return channelFriendsJson(path, options, true);
  }
  return { ok: res.ok, status: res.status, data };
}
