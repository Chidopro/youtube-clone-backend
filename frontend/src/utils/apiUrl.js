// Central place to build API URLs.
// - On localhost/LAN -> absolute (VITE_API_BASE_URL)
// - On Netlify (prod/preview) -> relative -> hits Netlify proxy (/api/*)
export const apiUrl = (endpoint) => {
  const host = (typeof window !== 'undefined' && window.location.hostname) || '';
  const isLocal =
    host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') ||
    host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.16.');

  if (isLocal) {
    const base = import.meta.env.VITE_API_BASE_URL || '';
    return `${base}${endpoint}`;
  }
  return endpoint; // hosted → relative
};

