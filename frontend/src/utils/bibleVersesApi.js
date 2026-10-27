import { getBackendUrl } from '../config/apiConfig';
import { claimSessionTokenIfNeeded } from './userService';

async function optionalAuthHeaders() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return {};
    const user = JSON.parse(raw);
    if (!user?.id) return {};
    const token = await claimSessionTokenIfNeeded(user.id);
    return {
      'X-User-Id': user.id,
      ...(user.email ? { 'X-User-Email': String(user.email).trim().toLowerCase() } : {}),
      ...(token ? { 'X-Session-Token': token } : {}),
    };
  } catch (_) {
    return {};
  }
}

export function mergeBibleVersePresets(defaults, saved) {
  const merged = new Map((defaults || []).map((verse) => [verse.id, verse]));
  for (const verse of saved || []) {
    if (verse?.id && verse?.reference && verse?.text) {
      merged.set(verse.id, { ...merged.get(verse.id), ...verse, ownerSaved: true });
    }
  }
  return [...merged.values()];
}

export async function fetchStorefrontBibleVerses(subdomain) {
  const sub = String(subdomain || '').trim().toLowerCase();
  if (!sub) return { ok: false, data: { success: false, error: 'Subdomain is required' } };
  const headers = await optionalAuthHeaders();
  try {
    const response = await fetch(
      `${getBackendUrl()}/api/storefront-bible-verses?subdomain=${encodeURIComponent(sub)}`,
      { credentials: 'include', cache: 'no-store', headers }
    );
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: { success: false, error: error.message || 'Network error' } };
  }
}

export async function saveStorefrontBibleVerse(subdomain, verse) {
  const headers = await optionalAuthHeaders();
  try {
    const response = await fetch(`${getBackendUrl()}/api/storefront-bible-verses`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ ...verse, subdomain }),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: { success: false, error: error.message || 'Network error' } };
  }
}
