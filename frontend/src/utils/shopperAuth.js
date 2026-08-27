/** Safe in-app path after login. Blocks protocol-relative and off-site URLs. */
export function safeAuthReturnPath(value) {
  if (typeof value !== 'string') return '';
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '';
  return path;
}

/** True when the shopper has a real account session, not just a guest browser. */
export function isShopperSignedIn() {
  try {
    if (localStorage.getItem('auth_token')) return true;
    if (localStorage.getItem('isAuthenticated') === 'true' && localStorage.getItem('user')) return true;
    if (localStorage.getItem('googleAuthenticated') === 'true') return true;
    if (localStorage.getItem('user_authenticated') === 'true' && (localStorage.getItem('user_email') || localStorage.getItem('customer_user'))) {
      return true;
    }
    if (localStorage.getItem('customer_authenticated') === 'true' && localStorage.getItem('customer_user')) {
      return true;
    }
  } catch (_) {
    /* ignore */
  }
  return false;
}

/** Persist email/password login the same way the full Login page does. */
export function persistShopperSession(data = {}, email = '') {
  const user = data.user || null;
  const trimmed = String(email || user?.email || '').trim();
  if (data.token) localStorage.setItem('auth_token', data.token);
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('isAuthenticated', 'true');
  }
  localStorage.setItem('user_authenticated', 'true');
  if (trimmed) {
    localStorage.setItem('user_email', trimmed);
    localStorage.setItem('customer_authenticated', 'true');
    localStorage.setItem(
      'customer_user',
      JSON.stringify({
        id: user?.id,
        email: trimmed,
        display_name: user?.display_name || trimmed,
        user_type: user?.role || 'customer',
      })
    );
  }
}
