import { API_CONFIG } from '../config/apiConfig';

/** PUT a file to a Supabase signed upload URL with live byte progress. */

export function uploadFileWithProgress(signedUrl, file, {
  onProgress,
  contentType,
  timeoutMs = 30 * 60 * 1000,
} = {}) {
  const url = String(signedUrl || '');
  if (!url) return Promise.reject(new Error('Missing upload URL'));
  const type = contentType || file?.type || 'application/octet-stream';
  const anon = API_CONFIG.SUPABASE_ANON_KEY || '';

  const send = (method) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader('Content-Type', type);
    xhr.setRequestHeader('x-upsert', 'true');
    if (anon) {
      xhr.setRequestHeader('apikey', anon);
      xhr.setRequestHeader('Authorization', `Bearer ${anon}`);
    }
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && typeof onProgress === 'function') {
        onProgress(ev.loaded, ev.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ status: xhr.status });
        return;
      }
      const detail = String(xhr.responseText || '').slice(0, 240);
      reject(Object.assign(
        new Error(detail ? `Upload failed (${xhr.status}): ${detail}` : `Upload failed (${xhr.status})`),
        { status: xhr.status },
      ));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading. Check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Try again on a more stable connection.'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    xhr.send(file);
  });

  return send('PUT').catch((err) => {
    if (err && (err.status === 405 || err.status === 400)) return send('POST');
    throw err;
  });
}

export function mapRangeProgress(loaded, total, startPct, endPct) {
  const frac = total > 0 ? loaded / total : 0;
  return Math.round(startPct + (endPct - startPct) * frac);
}
