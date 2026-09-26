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

/**
 * Bowl print is 6496×803. Eleven windows of 590×803 (about 3:4) tile that band exactly.
 * Each photo is fitted inside its window. Windows sit back to back.
 */
export const PET_BOWL_PANEL_COUNT = 11;
export const PET_BOWL_WINDOW = { width: 590, height: 803 };
/** Wider than this, a photo cannot fill a portrait window without becoming a slice. */
export const PET_BOWL_MAX_PHOTO_ASPECT = 1.45;
export const PET_BOWL_PRINT = { width: 6496, height: 803 };
/** Half-size strip: 11 × 295 by 401, same ratio as the print band. */
const PET_BOWL_COMPOSE = { width: 3245, height: 401 };

function loadHtmlImage(src, failMessage = 'Could not load image') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!String(src).startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(failMessage));
    img.src = src;
  });
}

/** Fit the whole photo inside one print window. Neighboring windows share an edge. */
function drawBowlPanel(ctx, img, tileX, tileW, height) {
  const scale = Math.min(tileW / img.width, height / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = tileX + (tileW - dw) / 2;
  const dy = (height - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

export async function composePetBowlBand(sources) {
  const count = PET_BOWL_PANEL_COUNT;
  const panels = Array.from({ length: count }, (_, index) => String(sources?.[index] || '').trim());
  if (panels.some((src) => !src)) return null;
  const { width, height } = PET_BOWL_COMPOSE;
  const tileW = width / count;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, width, height);
  for (let index = 0; index < count; index += 1) {
    const img = await loadHtmlImage(panels[index], 'Could not load a bowl panel');
    drawBowlPanel(ctx, img, index * tileW, tileW, height);
  }
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
    width,
    height,
  };
}

/** Printful pet bandana collar printfile. */
export const PET_BANDANA_PRINT = { width: 3060, height: 1875 };
/**
 * The hanging triangle hides the bottom third of that rectangle.
 * The crop window is the top two-thirds, which is what shows on the bandana.
 */
const PET_BANDANA_VISIBLE = 2 / 3;
/** Full printfile ratio, small enough to upload with the wrap. */
const PET_BANDANA_COMPOSE = { width: 2040, height: 1250 };

function bandanaWindowAspect() {
  return PET_BANDANA_PRINT.width / (PET_BANDANA_PRINT.height * PET_BANDANA_VISIBLE);
}

/**
 * The slice of a photo that shows on the bandana.
 * A tall photo moves up and down. A wide photo moves left and right.
 * offset 0 keeps the start of that axis, 1 keeps the end.
 */
export function bandanaCropWindow(imageWidth, imageHeight, offset = 0.5) {
  const iw = Number(imageWidth) || 0;
  const ih = Number(imageHeight) || 0;
  if (iw < 1 || ih < 1) return null;
  const aspect = bandanaWindowAspect();
  const t = Math.min(1, Math.max(0, Number(offset) || 0));
  if (iw / ih <= aspect) {
    const cropW = iw;
    const cropH = Math.min(ih, iw / aspect);
    const max = Math.max(0, ih - cropH);
    return { axis: 'y', x: 0, y: max * t, cropW, cropH, max };
  }
  const cropH = ih;
  const cropW = Math.min(iw, ih * aspect);
  const max = Math.max(0, iw - cropW);
  return { axis: 'x', x: max * t, y: 0, cropW, cropH, max };
}

export async function composePetBandanaCrop(src, offset = 0.5) {
  const img = await loadHtmlImage(src, 'Could not crop this photo');
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const win = bandanaCropWindow(iw, ih, offset);
  if (!win) return null;
  const { width, height } = PET_BANDANA_COMPOSE;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const visibleH = Math.max(1, Math.round(width / bandanaWindowAspect()));
  ctx.drawImage(img, win.x, win.y, win.cropW, win.cropH, 0, 0, width, visibleH);
  const tipH = height - visibleH;
  if (tipH > 0) {
    const tipSrc = Math.max(1, win.cropH * 0.25);
    ctx.drawImage(
      img,
      win.x,
      win.y + win.cropH - tipSrc,
      win.cropW,
      tipSrc,
      0,
      visibleH,
      width,
      tipH
    );
  }
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    width,
    height,
  };
}

export function isPetBandanaProduct(productName) {
  const n = String(productName || '').toLowerCase();
  return n.includes('bandana collar') || (n.includes('pet') && n.includes('bandana'));
}

/** Custom pet bowl and bandana lines that still need a saved Wrap now preview. */
export function petWrapItemsNeedingPreview(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (item?.premade) return false;
      const name = item?.name || item?.product || '';
      if (!isPetBowlProduct(name) && !isPetBandanaProduct(name)) return false;
      const url = String(item?.printfulMugMockupUrl || item?.printfulTotePrintfileUrl || '').trim();
      return !url;
    });
}

/** Custom pet bowl and bandana orders need a saved Wrap now preview. */
export function petWrapCheckoutMessage(items) {
  const missing = petWrapItemsNeedingPreview(items);
  if (!missing.length) return '';
  const names = [...new Set(missing.map(({ item }) => String(item?.name || item?.product || 'this product').trim()))];
  return `Click Preview Design on ${names.join(' and ')}, then Wrap now, before placing the order.`;
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
