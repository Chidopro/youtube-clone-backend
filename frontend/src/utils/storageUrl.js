import { API_CONFIG } from '../config/apiConfig';

/**
 * Convert a partial Supabase storage path to a full public URL.
 * Handles values like "1/object/public/creator-logos/file.png" or "creator-logos/file.png"
 * so the logo/favicon work when only the path was saved.
 */
export function normalizeStorageUrl(value) {
  if (!value || typeof value !== 'string') return value;
  const s = value.trim();
  if (/^https?:\/\//i.test(s)) return s;
  const base = (API_CONFIG.SUPABASE_URL || '').replace(/\/$/, '') + '/storage/v1/';
  if (!base.includes('supabase')) return value;
  let path = s.replace(/^\/+/, '').replace(/^1\/?/, '');
  if (path.startsWith('object/public/')) return base + path;
  return base + 'object/public/' + path;
}
