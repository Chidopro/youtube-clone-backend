import { apiJoin } from '../config/apiConfig';

const MUG_MOCKUP_DEBOUNCE_MS = 900;
const clientCache = new Map();

export function isMugProduct(productName, category) {
  const cat = String(category || '').toLowerCase().trim();
  if (cat === 'mugs') return true;
  return String(productName || '').toLowerCase().includes('mug');
}

export function isBagProduct(productName) {
  const n = String(productName || '').toLowerCase();
  return (
    n.includes('laptop sleeve')
    || n.includes('drawstring')
    || n.includes('tote pocket')
  );
}

export function isTotePocketProduct(productName) {
  return String(productName || '').toLowerCase().includes('tote pocket');
}

/** Laptop sleeve and drawstring print on a curved body; rectangular frame/feather look wrong. */
export function isCurvedBagProduct(productName) {
  const n = String(productName || '').toLowerCase();
  return n.includes('laptop sleeve') || n.includes('drawstring');
}

export function stripCurvedBagRectEdits(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  return {
    ...settings,
    featherEdge: 0,
    cornerRadius: 0,
    frameEnabled: false,
    featherFadeEnabled: false,
  };
}

export function isPetBowlProduct(productName) {
  return String(productName || '').toLowerCase().includes('pet bowl');
}

export function isPetBandanaProduct(productName) {
  const n = String(productName || '').toLowerCase();
  return n.includes('bandana collar') || (n.includes('pet') && n.includes('bandana'));
}

export function isPetWrapProduct(productName) {
  return isPetBowlProduct(productName) || isPetBandanaProduct(productName);
}

export function isAccessoryWrapProduct(productName) {
  const n = String(productName || '').toLowerCase();
  return (
    n.includes('greeting card')
    || (n.includes('hardcover') && n.includes('notebook'))
    || n.includes('apron')
    || n.includes('jigsaw puzzle')
  );
}

export function printfulWrapKind(productName, category) {
  if (isBagProduct(productName)) return 'bag';
  if (isPetBowlProduct(productName)) return 'bowl';
  if (isPetBandanaProduct(productName)) return 'bandana';
  if (String(productName || '').toLowerCase().includes('greeting card')) return 'card';
  if (String(productName || '').toLowerCase().includes('notebook')) return 'notebook';
  if (String(productName || '').toLowerCase().includes('apron')) return 'apron';
  if (String(productName || '').toLowerCase().includes('jigsaw') || String(productName || '').toLowerCase().includes('puzzle')) return 'puzzle';
  if (isMugProduct(productName, category)) return 'mug';
  return 'product';
}

export function merchHttpsScreenshots(merch) {
  const urls = [];
  const add = (value) => {
    const src = String(value || '').trim();
    if (!src || !/^https?:\/\//i.test(src)) return;
    if (urls.some((row) => screenshotUrlKey(row) === screenshotUrlKey(src))) return;
    urls.push(src);
  };
  add(merch?.thumbnail);
  add(merch?.thumbnail_url);
  (Array.isArray(merch?.screenshots) ? merch.screenshots : []).forEach(add);
  add(merch?.selected_screenshot);
  add(merch?.edited_screenshot);
  return urls;
}

export function isPrintfulWrapProduct(productName, category) {
  return (
    isMugProduct(productName, category)
    || isBagProduct(productName)
    || isPetWrapProduct(productName)
    || isAccessoryWrapProduct(productName)
  );
}

export function screenshotUrlKey(url) {
  return String(url || '').trim().split('?')[0];
}

function urlsLookSame(left, right) {
  const a = screenshotUrlKey(left);
  const b = screenshotUrlKey(right);
  return Boolean(a) && Boolean(b) && (a === b || String(left || '').trim() === String(right || '').trim());
}

/** Browse wrap must match the picker image, not leftover cart art from a previous shot. */
export function cartItemMatchesBrowseScreenshot(item, browseUrl) {
  const browse = screenshotUrlKey(browseUrl);
  if (!browse) return false;
  if (item?.printfulMugMockupStale) return false;
  if (item?.printfulMugMockupSource) {
    return urlsLookSame(item.printfulMugMockupSource, browseUrl);
  }
  const candidates = [
    item?.screenshot,
    item?.selected_screenshot,
    item?.displayScreenshot,
    item?.originalScreenshot,
    item?.toolSettings?.editedImageUrl,
    item?.toolSettings?.screenshot,
  ];
  return candidates.some((candidate) => urlsLookSame(candidate, browseUrl));
}

export function mugMockupDebounceMs() {
  return MUG_MOCKUP_DEBOUNCE_MS;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    if (!signal) return;
    if (signal.aborted) {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function cacheKey(productName, color, size, image, backImage, orientation) {
  const src = String(image || '');
  const finger = `${src.length}:${src.slice(0, 48)}:${src.slice(-48)}`;
  const back = String(backImage || '');
  const backFinger = back
    ? `${back.length}:${back.slice(0, 24)}:${back.slice(-24)}`
    : 'noback';
  const name = String(productName || '');
  const oriBit = name.toLowerCase().includes('drawstring')
    ? `|${String(orientation || '').trim().toLowerCase() === 'landscape' ? 'landscape' : 'portrait'}`
    : '';
  return `${name}|${String(color || '')}|${String(size || '')}|${finger}|${backFinger}|a11${oriBit}`;
}

function viewBucket(title, url) {
  const t = `${title || ''} ${url || ''}`.toLowerCase();
  if (/lifestyle|\bperson\b|\bscene\b|\bboy\b|in-hand|holding/.test(t)) return 'skip';
  const left = /handle[-_ ]on[-_ ]left/.test(t) || (/\bleft\b/.test(t) && !/\bright\b/.test(t));
  const right = /handle[-_ ]on[-_ ]right/.test(t) || (/\bright\b/.test(t) && !/\bleft\b/.test(t));
  if (left && !right) return 'left';
  if (right && !left) return 'right';
  if (/\bfront\b/.test(t)) return 'front';
  if (/\bback\b/.test(t) || /[-_]back(?:[-_.]|$)/.test(t)) return 'back';
  return 'other';
}

export function uniqueMugWrapViews(views) {
  const by = {};
  const others = [];
  (Array.isArray(views) ? views : []).forEach((view) => {
    const url = String(view?.url || '').trim();
    if (!url) return;
    const bucket = viewBucket(view?.title, url);
    if (bucket === 'skip') return;
    const row = {
      url,
      title: bucket === 'other'
        ? (String(view?.title || 'View').trim() || 'View')
        : `${bucket.charAt(0).toUpperCase()}${bucket.slice(1)}`,
    };
    if (bucket === 'other') {
      others.push(row);
      return;
    }
    if (!by[bucket]) by[bucket] = row;
  });
  const ordered = ['front', 'back', 'left', 'right'].map((bucket) => by[bucket]).filter(Boolean).slice(0, 3);
  others.forEach((row) => {
    if (ordered.length >= 3) return;
    if (ordered.some((item) => item.url === row.url)) return;
    ordered.push(row);
  });
  return ordered;
}

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function normalizeWrapResult(data) {
  const rows = Array.isArray(data?.mockup_urls) ? data.mockup_urls : [];
  const mockupUrls = [];
  const seen = new Set();
  rows.forEach((row) => {
    const url = String(row?.url || row?.mockup_url || '').trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    mockupUrls.push({
      url,
      title: String(row?.title || 'View').trim() || 'View',
    });
  });
  const mockupUrl = String(data?.mockup_url || mockupUrls[0]?.url || '').trim();
  if (mockupUrl && !seen.has(mockupUrl)) {
    mockupUrls.unshift({ url: mockupUrl, title: 'View' });
  }
  if (!mockupUrl) return null;
  const unique = uniqueMugWrapViews(mockupUrls.length ? mockupUrls : [{ url: mockupUrl, title: 'View' }]);
  const printfileUrl = String(data?.printfile_url || data?.printfileUrl || '').trim();
  if (!unique.length) {
    return {
      mockupUrl,
      mockupUrls: [{ url: mockupUrl, title: 'View' }],
      printfileUrl,
    };
  }
  return { mockupUrl: unique[0].url, mockupUrls: unique, printfileUrl };
}

export async function requestMugWrapMockup({
  productName,
  color,
  size,
  image,
  imageWidth,
  imageHeight,
  backImage,
  imageOrientation,
  signal,
} = {}) {
  const src = String(image || '').trim();
  if (!src) throw new Error('image is required');
  const backSrc = String(backImage || '').trim();
  const key = cacheKey(productName, color, size, src, backSrc, imageOrientation);
  if (clientCache.has(key)) return clientCache.get(key);

  const res = await fetch(apiJoin('/api/printful/mug-mockup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_name: productName,
      color,
      size,
      image: src,
      image_width: imageWidth || undefined,
      image_height: imageHeight || undefined,
      back_image: backSrc || undefined,
      image_orientation: imageOrientation || undefined,
    }),
    signal,
  });
  let data = await parseJson(res);
  let wrap = normalizeWrapResult(data);
  if (wrap?.mockupUrl) {
    clientCache.set(key, wrap);
    return wrap;
  }
  if (data?.pending && data?.task_key) {
    for (let i = 0; i < 16; i += 1) {
      await sleep(1500, signal);
      const poll = await fetch(
        apiJoin(`/api/printful/mug-mockup?task_key=${encodeURIComponent(data.task_key)}`),
        { signal }
      );
      data = await parseJson(poll);
      wrap = normalizeWrapResult(data);
      if (wrap?.mockupUrl) {
        clientCache.set(key, wrap);
        return wrap;
      }
      if (!data?.pending && data?.error) {
        throw new Error(data.error);
      }
    }
  }
  throw new Error(data?.error || 'Wrap preview is not ready yet');
}

export function rememberMugWrapMockup(productName, color, size, image, wrap, backImage, orientation) {
  if (!wrap?.mockupUrl) return;
  clientCache.set(cacheKey(productName, color, size, image, backImage, orientation), wrap);
}
