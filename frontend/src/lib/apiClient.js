// Robust API client for POST requests
export async function postJSON(path, payload) {
  const url = path.startsWith('http') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  const body = JSON.stringify(payload ?? {});
  console.log('📦 POST', url, 'payload →', JSON.parse(body));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // ✅ crucial
    body,
    credentials: 'include',
    redirect: 'follow',
  });

  const text = await res.text(); // keep debuggable
  let json = null;
  try { 
    json = text ? JSON.parse(text) : null; 
  } catch (_) {
    console.error('❌ Failed to parse response as JSON:', text);
  }
  console.log('📬 Response', res.status, json ?? text);

  if (!res.ok) {
    throw new Error(json?.error || json?.message || `Request failed: ${res.status}`);
  }
  return json;
}

