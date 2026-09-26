import { getBackendUrl } from '../config/apiConfig';

function backendUrl(path) {
  return `${getBackendUrl().replace(/\/$/, '')}${path}`;
}

export async function fetchShopCatalog({ subdomain, collaboratorId, headers } = {}) {
  const params = new URLSearchParams();
  if (subdomain) params.set('subdomain', String(subdomain).trim().toLowerCase());
  if (collaboratorId) params.set('collaborator_id', String(collaboratorId).trim());
  const qs = params.toString();
  const res = await fetch(backendUrl(`/api/shop-catalog${qs ? `?${qs}` : ''}`), {
    method: 'GET',
    credentials: headers ? 'include' : 'omit',
    headers: headers || {},
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    return { products: {} };
  }
  return { products: data.products && typeof data.products === 'object' ? data.products : {} };
}

export async function patchShopCatalog({ headers, userId, email, sessionToken, products }) {
  const res = await fetch(backendUrl('/api/shop-catalog'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: JSON.stringify({
      user_id: userId,
      email,
      session_token: sessionToken,
      products,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Save failed (${res.status})`);
  }
  return data.products && typeof data.products === 'object' ? data.products : {};
}

export async function uploadShopCatalogImage({ headers, userId, email, sessionToken, sku, file }) {
  const form = new FormData();
  form.append('sku', sku);
  form.append('user_id', userId);
  if (email) form.append('email', email);
  if (sessionToken) form.append('session_token', sessionToken);
  form.append('file', file);
  const res = await fetch(backendUrl('/api/shop-catalog/upload'), {
    method: 'POST',
    credentials: 'include',
    headers: headers || {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Upload failed (${res.status})`);
  }
  return data;
}
