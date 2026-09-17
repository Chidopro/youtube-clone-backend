/**
 * Downscale huge cart screenshots (data URLs / blobs) before they hit an <img>.
 * Full-size overlays freeze checkout when Chrome decodes them on the main thread.
 */

const DISPLAY_EDGE = 360;
const cache = new Map();
const inflight = new Map();
const queued = new Map();
let running = 0;
const MAX_PARALLEL = 1;
let worker = null;
let workerUnavailable = false;
let workerJobId = 0;
const workerWaiters = new Map();

function cacheKey(url) {
  const s = String(url || '');
  return `${s.length}:${s.slice(0, 48)}:${s.slice(-24)}`;
}

function needsDownscale(url) {
  const s = String(url || '');
  if (!s) return false;
  if (s.startsWith('blob:')) return true;
  if (s.startsWith('data:')) return s.length > 40_000;
  if (/^https?:/i.test(s)) return true;
  return false;
}

function fitSize(width, height, maxEdge) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const scale = Math.min(1, maxEdge / Math.max(w, h, 1));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

function nextIdle(timeout = 200) {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout });
    } else {
      window.setTimeout(resolve, 0);
    }
  });
}

function canvasToJpegSrc(canvas) {
  return new Promise((resolve, reject) => {
    const finish = (blob) => {
      if (!blob) {
        reject(new Error('jpeg blob failed'));
        return;
      }
      resolve({
        src: URL.createObjectURL(blob),
        width: canvas.width,
        height: canvas.height,
      });
    };
    if (typeof canvas.convertToBlob === 'function') {
      canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 }).then(finish, reject);
      return;
    }
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(finish, 'image/jpeg', 0.7);
      return;
    }
    try {
      resolve({
        src: canvas.toDataURL('image/jpeg', 0.7),
        width: canvas.width,
        height: canvas.height,
      });
    } catch (err) {
      reject(err);
    }
  });
}

function blobToJpeg(blob, maxEdge) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      const sized = fitSize(img.naturalWidth, img.naturalHeight, maxEdge);
      const canvas = document.createElement('canvas');
      canvas.width = sized.width;
      canvas.height = sized.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('no ctx'));
        return;
      }
      ctx.drawImage(img, 0, 0, sized.width, sized.height);
      URL.revokeObjectURL(objectUrl);
      canvasToJpegSrc(canvas).then(resolve, reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('image load failed'));
    };
    img.src = objectUrl;
  });
}

const DATA_URL_CHUNK = 262144;

const WORKER_SOURCE = `
const dataUrlJobs = new Map();

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : '';
  const mime = (/data:([^;,]+)/i.exec(header) || [])[1] || 'image/jpeg';
  if (!/;base64/i.test(header)) {
    return new Blob([decodeURIComponent(payload)], { type: mime });
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function downscaleBlob(id, sourceBlob, maxEdge) {
  let bmp;
  try {
    bmp = await createImageBitmap(sourceBlob, { resizeWidth: maxEdge, resizeQuality: 'low' });
  } catch {
    bmp = await createImageBitmap(sourceBlob);
  }
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height, 1));
  const width = Math.max(1, Math.round(bmp.width * scale));
  const height = Math.max(1, Math.round(bmp.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no ctx');
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
  self.postMessage({ id, ok: true, blob: out, width, height });
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  const { id, kind, buffer, type, maxEdge } = msg;
  try {
    if (kind === 'dataUrlStart') {
      dataUrlJobs.set(id, { parts: [], maxEdge });
      return;
    }
    if (kind === 'dataUrlChunk') {
      const job = dataUrlJobs.get(id);
      if (job && typeof msg.chunk === 'string') job.parts.push(msg.chunk);
      return;
    }
    if (kind === 'dataUrlEnd') {
      const job = dataUrlJobs.get(id);
      dataUrlJobs.delete(id);
      if (!job) throw new Error('missing data url job');
      const dataUrl = job.parts.join('');
      job.parts.length = 0;
      await downscaleBlob(id, dataUrlToBlob(dataUrl), job.maxEdge);
      return;
    }
    if (buffer) {
      await downscaleBlob(id, new Blob([buffer], { type: type || 'image/jpeg' }), maxEdge);
      return;
    }
    throw new Error('no image data');
  } catch (err) {
    dataUrlJobs.delete(id);
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};
`;

function resetWorker() {
  workerWaiters.forEach((waiter) => waiter.reject(new Error('worker reset')));
  workerWaiters.clear();
  if (worker) {
    try { worker.terminate(); } catch { /* ignore */ }
  }
  worker = null;
}

function getWorker() {
  if (worker) return worker;
  if (workerUnavailable) return null;
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof Blob === 'undefined') {
    workerUnavailable = true;
    return null;
  }
  try {
    const blob = new Blob([WORKER_SOURCE], { type: 'text/javascript' });
    const src = URL.createObjectURL(blob);
    worker = new Worker(src);
    worker.onmessage = (event) => {
      const data = event.data || {};
      const waiter = workerWaiters.get(data.id);
      if (!waiter) return;
      workerWaiters.delete(data.id);
      if (data.ok && data.blob) {
        waiter.resolve({
          src: URL.createObjectURL(data.blob),
          width: data.width,
          height: data.height,
        });
      } else {
        waiter.reject(new Error(data.error || 'worker failed'));
      }
    };
    worker.onerror = () => {
      resetWorker();
    };
    return worker;
  } catch {
    workerUnavailable = true;
    worker = null;
    return null;
  }
}

async function urlToBlob(url) {
  if (url.startsWith('data:')) {
    return dataUrlToBlob(url);
  }
  const res = await fetch(url);
  return res.blob();
}

async function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : '';
  const mime = (/data:([^;,]+)/i.exec(header) || [])[1] || 'image/jpeg';
  if (!/;base64/i.test(header)) {
    return new Blob([decodeURIComponent(payload)], { type: mime });
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  const chunk = 1 << 18;
  for (let i = 0; i < binary.length; i += chunk) {
    const end = Math.min(i + chunk, binary.length);
    for (let j = i; j < end; j += 1) {
      bytes[j] = binary.charCodeAt(j);
    }
    if (end < binary.length) await nextIdle(32);
  }
  return new Blob([bytes], { type: mime });
}

function downscaleDataUrlInWorker(dataUrl, maxEdge) {
  const w = getWorker();
  if (!w) return null;
  const id = ++workerJobId;
  return new Promise((resolve, reject) => {
    workerWaiters.set(id, { resolve, reject });
    (async () => {
      try {
        w.postMessage({ id, kind: 'dataUrlStart', maxEdge });
        for (let i = 0; i < dataUrl.length; i += DATA_URL_CHUNK) {
          if (i > 0) await nextIdle(8);
          if (!workerWaiters.has(id)) return;
          w.postMessage({ id, kind: 'dataUrlChunk', chunk: dataUrl.slice(i, i + DATA_URL_CHUNK) });
        }
        if (!workerWaiters.has(id)) return;
        w.postMessage({ id, kind: 'dataUrlEnd' });
      } catch (err) {
        workerWaiters.delete(id);
        reject(err);
      }
    })();
  });
}

function downscaleInWorker(blob, maxEdge) {
  const w = getWorker();
  if (!w) return null;
  const id = ++workerJobId;
  return blob.arrayBuffer().then((buffer) => new Promise((resolve, reject) => {
    workerWaiters.set(id, { resolve, reject });
    try {
      w.postMessage(
        { id, buffer, type: blob.type || 'image/jpeg', maxEdge },
        [buffer]
      );
    } catch (err) {
      workerWaiters.delete(id);
      reject(err);
    }
  }));
}

async function downscaleOnMain(blob, maxEdge) {
  await nextIdle(120);
  if (typeof createImageBitmap === 'function') {
    try {
      let bmp;
      try {
        bmp = await createImageBitmap(blob, {
          resizeWidth: maxEdge,
          resizeQuality: 'low',
        });
      } catch {
        bmp = await createImageBitmap(blob);
      }
      const sized = fitSize(bmp.width, bmp.height, maxEdge);
      const canvas = document.createElement('canvas');
      canvas.width = sized.width;
      canvas.height = sized.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bmp.close();
        return blobToJpeg(blob, maxEdge);
      }
      ctx.drawImage(bmp, 0, 0, sized.width, sized.height);
      bmp.close();
      return canvasToJpegSrc(canvas);
    } catch {
      return blobToJpeg(blob, maxEdge);
    }
  }
  return blobToJpeg(blob, maxEdge);
}

async function downscaleUrl(url, maxEdge) {
  if (url.startsWith('data:')) {
    const dataJob = downscaleDataUrlInWorker(url, maxEdge);
    if (dataJob) {
      try {
        return await dataJob;
      } catch {
        resetWorker();
      }
    }
    return { src: '', width: 0, height: 0 };
  }
  try {
    const blob = await urlToBlob(url);
    return await downscaleBlob(blob, maxEdge);
  } catch {
    return { src: '', width: 0, height: 0 };
  }
}

async function downscaleBlob(blob, maxEdge) {
  const workerJob = downscaleInWorker(blob, maxEdge);
  if (workerJob) {
    try {
      return await workerJob;
    } catch {
      resetWorker();
    }
  }
  return downscaleOnMain(blob, maxEdge);
}

function remember(key, result) {
  if (cache.size >= 48) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, result);
}

function pumpQueue() {
  if (running >= MAX_PARALLEL) return;
  let nextKey = null;
  for (const [key, job] of queued) {
    if (job.urgent) {
      nextKey = key;
      break;
    }
    if (!nextKey) nextKey = key;
  }
  if (!nextKey) return;
  const job = queued.get(nextKey);
  queued.delete(nextKey);
  running += 1;
  Promise.resolve()
    .then(job.run)
    .finally(() => {
      running -= 1;
      pumpQueue();
    });
}

export function peekDisplaySrc(url) {
  const src = String(url || '').trim();
  if (!src) return null;
  if (!needsDownscale(src)) return { src, width: 0, height: 0 };
  return cache.get(cacheKey(src)) || null;
}

/**
 * @returns {Promise<{ src: string, width: number, height: number }>}
 */
export function prepareDisplaySrc(url, _maxEdge = DISPLAY_EDGE, options = {}) {
  const src = String(url || '').trim();
  const urgent = Boolean(options && options.urgent);
  if (!src) return Promise.resolve({ src: '', width: 0, height: 0 });
  if (!needsDownscale(src)) {
    return Promise.resolve({ src, width: 0, height: 0 });
  }
  const key = cacheKey(src);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (inflight.has(key)) {
    const existing = queued.get(key);
    if (urgent && existing) existing.urgent = true;
    pumpQueue();
    return inflight.get(key);
  }

  let settle;
  const pending = new Promise((resolve, reject) => {
    settle = { resolve, reject };
  });
  inflight.set(key, pending);

  queued.set(key, {
    urgent,
    run: async () => {
      try {
        await nextIdle(urgent ? 16 : 80);
        const result = await downscaleUrl(src, DISPLAY_EDGE);
        remember(key, result);
        settle.resolve(result);
      } catch (err) {
        settle.reject(err);
      } finally {
        inflight.delete(key);
      }
    },
  });
  pumpQueue();
  return pending;
}
