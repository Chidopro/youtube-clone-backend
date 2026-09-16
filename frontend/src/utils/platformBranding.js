import { apiJoin } from '../config/apiConfig';

const CACHE_KEY = 'sm_platform_brand';

export function peekCachedPlatformBrand() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.primary_color || !parsed?.secondary_color) return null;
    return {
      primary_color: parsed.primary_color,
      secondary_color: parsed.secondary_color,
      header_opacity: parsed.header_opacity ?? 100,
      platform_homepage: true,
    };
  } catch (_) {
    return null;
  }
}

export function rememberPlatformBrand(settings) {
  if (typeof window === 'undefined') return;
  try {
    if (!settings?.primary_color || !settings?.secondary_color) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        primary_color: settings.primary_color,
        secondary_color: settings.secondary_color,
        header_opacity: settings.header_opacity ?? 100,
        platform_homepage: true,
      })
    );
  } catch (_) {}
}

export async function fetchPlatformBranding() {
  const res = await fetch(apiJoin('/api/platform-branding'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok && json.success && json.settings) {
    rememberPlatformBrand(json.settings);
    return json.settings;
  }
  rememberPlatformBrand(null);
  return null;
}

export async function savePlatformBranding({ primary_color, secondary_color, header_opacity, email }) {
  const res = await fetch(apiJoin('/api/platform-branding'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-User-Email': email || '',
    },
    credentials: 'include',
    body: JSON.stringify({ primary_color, secondary_color, header_opacity }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Could not save homepage header');
  }
  rememberPlatformBrand(json.settings);
  return json.settings;
}
