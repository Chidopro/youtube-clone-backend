import { getBackendUrl } from '../config/apiConfig';
import { claimSessionTokenIfNeeded } from './userService';
import { supabase } from '../supabaseClient';

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

const FAV_LISTS_TTL_MS = 90_000;
const favListsMemory = new Map();
const favListsInflight = new Map();

function readFavListsSession(sub) {
  try {
    const raw = sessionStorage.getItem(`sm_fav_lists_${sub}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || Date.now() - parsed.at > FAV_LISTS_TTL_MS) return null;
    if (!Array.isArray(parsed.lists)) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function rememberFavLists(sub, lists, lite) {
  const existing = favListsMemory.get(sub);
  if (lite && existing && !existing.lite && Date.now() - existing.at < FAV_LISTS_TTL_MS) {
    return;
  }
  const entry = { at: Date.now(), lists, lite: !!lite };
  favListsMemory.set(sub, entry);
  try {
    sessionStorage.setItem(`sm_fav_lists_${sub}`, JSON.stringify(entry));
  } catch (_) {}
}

/** Instant read of lists already fetched on Home / a previous Friends visit. */
export function peekPublicFavoriteLists(subdomain) {
  const s = (subdomain || '').trim().toLowerCase();
  if (!s) return null;
  const mem = favListsMemory.get(s);
  if (mem && Date.now() - mem.at < FAV_LISTS_TTL_MS && Array.isArray(mem.lists)) {
    return mem.lists;
  }
  const session = readFavListsSession(s);
  if (session) {
    favListsMemory.set(s, session);
    return session.lists;
  }
  return null;
}

function forgetPublicFavoriteLists(subdomain) {
  const s = (subdomain || '').trim().toLowerCase();
  if (!s) return;
  favListsMemory.delete(s);
  try {
    sessionStorage.removeItem(`sm_fav_lists_${s}`);
  } catch (_) {}
}

export async function linkOwnerExtraPagesToStorefront(creatorId, lists) {
  if (!creatorId || !Array.isArray(lists) || !lists.length) return 0;
  const orphans = lists.filter(
    (L) =>
      L?.id &&
      !L.is_collaborator_page &&
      String(L.owner_user_id || creatorId) === String(creatorId) &&
      !L.storefront_owner_id
  );
  if (!orphans.length) return 0;
  await Promise.all(
    orphans.map((L) =>
      supabase
        .from('creator_favorite_lists')
        .update({ storefront_owner_id: creatorId })
        .eq('id', L.id)
    )
  );
  return orphans.length;
}

export async function fetchPublicFavoriteLists(subdomain, { lite = false, force = false } = {}) {
  const s = (subdomain || '').trim().toLowerCase();
  if (!s) return { ok: true, data: { success: true, lists: [] } };

  if (force) {
    favListsMemory.delete(s);
    try {
      sessionStorage.removeItem(`sm_fav_lists_${s}`);
    } catch (_) {}
  }

  const cached = favListsMemory.get(s) || readFavListsSession(s);
  if (cached && Date.now() - cached.at < FAV_LISTS_TTL_MS) {
    favListsMemory.set(s, cached);
    if (lite || !cached.lite) {
      return { ok: true, data: { success: true, lists: cached.lists } };
    }
  }

  const inflightKey = `${s}:${lite ? 'lite' : 'full'}`;
  const reuse = favListsInflight.get(inflightKey);
  if (reuse) return reuse;

  const req = (async () => {
    const qs = new URLSearchParams({ subdomain: s });
    if (lite) qs.set('lite', '1');
    const res = await fetch(`${getBackendUrl()}/api/public/favorite-lists?${qs}`, {
      credentials: 'omit',
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && Array.isArray(data.lists)) {
      rememberFavLists(s, data.lists, lite);
    }
    return { ok: res.ok, data };
  })().finally(() => favListsInflight.delete(inflightKey));

  favListsInflight.set(inflightKey, req);
  return req;
}

export function favoriteImageUrl(favorite) {
  if (!favorite) return '';
  return (favorite.image_url || favorite.thumbnail_url || favorite.thumbnail || '').trim();
}

/**
 * Lightweight URL for grid/cards. Keeps full image_url for Make Merch / print.
 * Uses a dedicated thumbnail when present; otherwise asks Supabase for a resized render.
 */
export function publicStorageCardUrl(src, width = 720) {
  const url = (src || '').trim();
  if (!url) return '';
  const w = Number(width);
  const px = Number.isFinite(w) && w >= 32 ? Math.round(w) : 720;
  try {
    const u = new URL(url);
    const isSupabase = u.hostname.includes('supabase.co');
    const isObject = u.pathname.includes('/storage/v1/object/public/');
    const isRender = u.pathname.includes('/storage/v1/render/image/public/');
    if (isSupabase && (isObject || isRender)) {
      if (isObject) {
        u.pathname = u.pathname.replace(
          '/storage/v1/object/public/',
          '/storage/v1/render/image/public/'
        );
      }
      u.searchParams.set('width', String(px));
      u.searchParams.set('resize', 'contain');
      u.searchParams.set('quality', px >= 1000 ? '82' : '70');
      return u.toString();
    }
  } catch (_) {}
  return url;
}

/** Sharper image for the 2-up My Page gallery. */
export function favoriteGalleryUrl(favorite) {
  if (!favorite) return '';
  const full = (favorite.image_url || favorite.thumbnail_url || favorite.thumbnail || '').trim();
  return publicStorageCardUrl(full, 1200) || full;
}

export function favoriteCardThumbUrl(favorite) {
  if (!favorite) return '';
  const full = (favorite.image_url || '').trim();
  const thumb = (favorite.thumbnail_url || favorite.thumbnail || '').trim();
  if (thumb && full && thumb !== full) return thumb;
  if (thumb && !full) return thumb;
  return publicStorageCardUrl(full || thumb);
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

/** Extra owner-created pages for My Page. Uses public lists plus the signed-in owner's own lists. */
export async function fetchOwnerExtraPages(subdomain, creatorId) {
  const byId = new Map();
  const add = (list) => {
    if (!list?.id || list.is_primary || list.slug === 'owner' || list.is_collaborator_page) return;
    if (isCollaboratorList(list, creatorId)) return;
    if (creatorId && list.owner_user_id && String(list.owner_user_id) !== String(creatorId)) return;
    byId.set(String(list.id), list);
  };

  const cached = peekPublicFavoriteLists(subdomain);
  if (cached) cached.forEach(add);

  if (byId.size === 0) {
    try {
      const pub = await fetchPublicFavoriteLists(subdomain, { lite: true });
      if (pub.ok && Array.isArray(pub.data?.lists)) pub.data.lists.forEach(add);
    } catch (_) {}
  }

  let signedIn = false;
  try {
    signedIn = !!localStorage.getItem('user');
  } catch (_) {}
  if (signedIn) {
    try {
      const mine = await favoriteListsJson('/api/favorite-lists/mine');
      if (mine.ok && Array.isArray(mine.data?.lists) && !mine.data.is_umbrella_only) {
        const mineUserId = mine.data.user_id;
        const ownerMatch = !creatorId || !mineUserId || String(mineUserId) === String(creatorId);
        if (ownerMatch) {
          mine.data.lists.forEach(add);
          const repaired = await linkOwnerExtraPagesToStorefront(creatorId, mine.data.lists);
          if (repaired) forgetPublicFavoriteLists(subdomain);
        }
      }
    } catch (_) {}
  }

  return [...byId.values()].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function isCollaboratorList(list, storefrontOwnerId) {
  if (!list?.owner_user_id || !storefrontOwnerId) return false;
  return String(list.owner_user_id) !== String(storefrontOwnerId);
}

export async function fetchFavoritesForList(subdomain, list, ownerUserId) {
  const slug = list?.slug || 'owner';
  const pub = await fetchPublicFavoritesByList(subdomain, slug);
  if (pub.ok && pub.data?.success) return pub.data.favorites || [];
  if (!list?.id) return [];
  try {
    let q = supabase.from('creator_favorites').select('*').eq('list_id', list.id);
    const uid = ownerUserId || list.owner_user_id;
    if (uid) q = q.eq('user_id', uid);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  } catch (_) {
    return [];
  }
}
