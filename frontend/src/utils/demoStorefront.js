import { getSubdomain } from './subdomainService';

export const DEMO_STOREFRONT_SUBDOMAIN = 'maxfreedom';
export const DEMO_STOREFRONT_ORIGIN = `https://${DEMO_STOREFRONT_SUBDOMAIN}.screenmerch.com`;
/** Platform test storefront — stays live at filialsons.screenmerch.com, not a public homepage seat. */
export const TEST_STOREFRONT_SUBDOMAIN = 'filialsons';
export const DEMO_DASHBOARD_PATH = '/demo/dashboard';
export const DEMO_PREVIEW_SESSION_KEY = 'screenmerch_demo_preview_session';
export const DEMO_PREVIEW_USER_ID = 'demo-preview';

/** True only on maxfreedom.screenmerch.com — never other creator storefronts. */
export function isDemoStorefront() {
  return getSubdomain() === DEMO_STOREFRONT_SUBDOMAIN;
}

export function readStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function isDemoPreviewUser(user) {
  return !!(user && (user.demo_preview || user.id === DEMO_PREVIEW_USER_ID));
}

/** Real creator/shopper session — never the sample-store tour persona. */
export function isRealStorefrontUser(user) {
  if (!user || isDemoPreviewUser(user)) return false;
  const id = String(user.id || '').trim();
  if (!id || id === DEMO_PREVIEW_USER_ID) return false;
  return true;
}

export function isDemoPreviewSession() {
  if (!isDemoStorefront()) return false;
  if (isRealStorefrontUser(readStoredUser())) {
    try {
      localStorage.removeItem(DEMO_PREVIEW_SESSION_KEY);
    } catch (_) {
      /* ignore */
    }
    return false;
  }
  try {
    return localStorage.getItem(DEMO_PREVIEW_SESSION_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function startDemoPreviewSession() {
  if (isRealStorefrontUser(readStoredUser())) {
    try {
      localStorage.removeItem(DEMO_PREVIEW_SESSION_KEY);
    } catch (_) {
      /* ignore */
    }
    return readStoredUser();
  }
  const previewUser = {
    id: DEMO_PREVIEW_USER_ID,
    role: 'creator',
    status: 'active',
    display_name: 'MAXFreedom',
    username: DEMO_STOREFRONT_SUBDOMAIN,
    demo_preview: true,
  };
  try {
    localStorage.setItem(DEMO_PREVIEW_SESSION_KEY, '1');
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('user', JSON.stringify(previewUser));
  } catch (_) {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('userLoggedIn', {
        detail: { user: previewUser, user_type: 'creator' },
      })
    );
  }
  return previewUser;
}

export function endDemoPreviewSession() {
  try {
    localStorage.removeItem(DEMO_PREVIEW_SESSION_KEY);
    const u = readStoredUser();
    if (isDemoPreviewUser(u)) {
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
    }
  } catch (_) {}
}

export function loggedInUserId() {
  const user = readStoredUser();
  return String(user?.id || '').trim();
}

/**
 * True when this visitor is looking at the sample storefront and is not its owner.
 * If the owner id is not loaded yet, do not treat a real login as a visitor
 * (that was kicking maxfreedom11 into /demo/dashboard).
 */
export function isDemoStorefrontVisitor(creatorId) {
  if (!isDemoStorefront()) return false;
  const stored = readStoredUser();
  if (isDemoPreviewUser(stored)) return true;
  const uid = String(stored?.id || '').trim();
  const oid = String(creatorId || '').trim();
  if (!oid) return false;
  if (uid && uid === oid) return false;
  return true;
}
