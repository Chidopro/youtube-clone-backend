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

export function isDemoPreviewSession() {
  if (!isDemoStorefront()) return false;
  try {
    return localStorage.getItem(DEMO_PREVIEW_SESSION_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function startDemoPreviewSession() {
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
    const raw = localStorage.getItem('user');
    const u = raw ? JSON.parse(raw) : null;
    if (u?.demo_preview || u?.id === DEMO_PREVIEW_USER_ID) {
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
    }
  } catch (_) {}
}

export function isDemoPreviewUser(user) {
  return !!(user && (user.demo_preview || user.id === DEMO_PREVIEW_USER_ID));
}

export function loggedInUserId() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    const user = JSON.parse(raw);
    return String(user?.id || '').trim();
  } catch (_) {
    return '';
  }
}

/** True when this visitor is looking at the sample storefront and is not its owner. */
export function isDemoStorefrontVisitor(creatorId) {
  if (!isDemoStorefront()) return false;
  const uid = loggedInUserId();
  const oid = String(creatorId || '').trim();
  if (uid && oid && uid === oid) return false;
  return true;
}
