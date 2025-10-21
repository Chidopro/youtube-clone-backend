// Rewrites any fetch to https://screenmerch.fly.dev/... → relative /...,
// so Netlify's /api/* proxy handles it (same-origin on mobile = no CORS).
(function patchFetchToRelative() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;

  const ABS_BACKEND = 'https://screenmerch.fly.dev';

  const h = (window.location && window.location.hostname) || '';
  const isLocal =
    h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local') ||
    h.startsWith('10.') || h.startsWith('192.168.') ||
    h.startsWith('172.16.') || h.startsWith('172.17.') || h.startsWith('172.18.') ||
    h.startsWith('172.19.') || h.startsWith('172.20.') || h.startsWith('172.21.') ||
    h.startsWith('172.22.') || h.startsWith('172.23.') || h.startsWith('172.24.') ||
    h.startsWith('172.25.') || h.startsWith('172.26.') || h.startsWith('172.27.') ||
    h.startsWith('172.28.') || h.startsWith('172.29.') || h.startsWith('172.30.') || h.startsWith('172.31.');

  // Only rewrite on hosted environments (Netlify prod/preview)
  if (isLocal) return;

  const origFetch = window.fetch;
  window.fetch = function(input, init) {
    let url = typeof input === 'string' ? input : input?.url;
    if (url && url.startsWith(ABS_BACKEND)) {
      const relative = url.replace(ABS_BACKEND, '');
      console.warn('[fetch shim] Rewriting Fly URL → relative:', url, '→', relative);
      input = (typeof input === 'string') ? relative : new Request(relative, input);
    }
    return origFetch(input, init);
  };
})();

