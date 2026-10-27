import { getBackendUrl } from '../config/apiConfig';
import { claimSessionTokenIfNeeded } from './userService';

async function authHeaders() {
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
}

async function requestDashboard(subdomain, options = {}) {
  const headers = await authHeaders();
  const response = await fetch(
    `${getBackendUrl()}/api/platform-storefront-dashboard${options.method === 'POST' ? '' : `?subdomain=${encodeURIComponent(subdomain)}`}`,
    {
      cache: 'no-store',
      credentials: 'include',
      ...options,
      headers: {
        ...(options.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
        ...options.headers,
      },
    }
  );
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

export function fetchPlatformStorefrontDashboard(subdomain = 'bibleversemerch') {
  return requestDashboard(subdomain);
}

export function savePlatformStorefrontDashboard(settings, subdomain = 'bibleversemerch') {
  return requestDashboard(subdomain, {
    method: 'POST',
    body: JSON.stringify({ ...settings, subdomain }),
  });
}
