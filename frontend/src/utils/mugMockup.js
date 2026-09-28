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
 * Printful bowl printfile is 6496×803. Eleven integer windows must sum to
 * that width (6×591 + 5×590). A 590×11 = 6490 strip left a 6px sliver
 * when Printful closed the ring.
 */
export const PET_BOWL_PANEL_COUNT = 11;
export const PET_BOWL_PRINT = { width: 6496, height: 803 };
export const PET_BOWL_WINDOW = {
  width: Math.round(PET_BOWL_PRINT.width / PET_BOWL_PANEL_COUNT),
  height: PET_BOWL_PRINT.height,
};
/** Wider than this, a photo cannot fill a portrait window without becoming a slice. */
export const PET_BOWL_MAX_PHOTO_ASPECT = 1.45;
export const PET_BOWL_PRINT_FILE = {
  width: PET_BOWL_PRINT.width,
  height: PET_BOWL_PRINT.height,
};
const PET_BOWL_COMPOSE = {
  width: PET_BOWL_PRINT.width,
  height: PET_BOWL_PRINT.height,
};

/** Integer tile boxes that fill `width` with no leftover column. */
export function bowlTileRects(width, height, count = PET_BOWL_PANEL_COUNT) {
  const w = Math.max(count, Math.round(Number(width) || 0));
  const h = Math.max(1, Math.round(Number(height) || 0));
  const n = Math.max(1, Math.round(Number(count) || PET_BOWL_PANEL_COUNT));
  const base = Math.floor(w / n);
  const extra = w - base * n;
  const rects = [];
  let x = 0;
  for (let index = 0; index < n; index += 1) {
    const add = Math.floor(((index + 1) * extra) / n) - Math.floor((index * extra) / n);
    const tileW = base + add;
    rects.push({ x, width: tileW, height: h });
    x += tileW;
  }
  if (rects.length) {
    const last = rects[rects.length - 1];
    last.width = w - last.x;
  }
  return rects;
}

function loadHtmlImage(src, failMessage = 'Could not load image') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!String(src).startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(failMessage));
    img.src = src;
  });
}

/** Fill one print window. Crop the overflow so the photo meets the top and bottom edges. */
function drawBowlPanel(ctx, img, tileX, tileW, height) {
  const x = Math.round(tileX);
  const w = Math.max(1, Math.round(tileW));
  const h = Math.max(1, Math.round(height));
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, 0, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

export async function composePetBowlBand(sources, target = PET_BOWL_COMPOSE) {
  const count = PET_BOWL_PANEL_COUNT;
  const panels = Array.from({ length: count }, (_, index) => String(sources?.[index] || '').trim());
  if (panels.some((src) => !src)) return null;
  const width = Math.round(Number(target?.width) || PET_BOWL_COMPOSE.width);
  const height = Math.round(Number(target?.height) || PET_BOWL_COMPOSE.height);
  const tiles = bowlTileRects(width, height, count);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, width, height);
  for (let index = 0; index < count; index += 1) {
    const img = await loadHtmlImage(panels[index], 'Could not load a bowl panel');
    const tile = tiles[index];
    const next = tiles[index + 1];
    const overlap = next ? 1 : 0;
    drawBowlPanel(ctx, img, tile.x, tile.width + overlap, height);
  }
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
    width,
    height,
  };
}

/**
 * Print file for the pet bowl. A normal photo is repeated across eleven windows.
 * A file that is already the wide strip is scaled onto that strip and not tiled again.
 */
export async function petBowlPrintStrip(src) {
  const img = await loadHtmlImage(src, 'Could not load the bowl photo');
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const stripAspect = PET_BOWL_PRINT_FILE.width / PET_BOWL_PRINT_FILE.height;
  if (iw > 0 && ih > 0 && iw / ih > stripAspect * 0.7) {
    const { width, height } = PET_BOWL_PRINT_FILE;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const scale = Math.max(width / iw, height / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.9),
      width,
      height,
    };
  }
  return composePetBowlBand(
    Array(PET_BOWL_PANEL_COUNT).fill(src),
    PET_BOWL_PRINT_FILE
  );
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

export async function composePetBandanaCrop(src, offset = 0.5, target = PET_BANDANA_COMPOSE) {
  const img = await loadHtmlImage(src, 'Could not crop this photo');
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const win = bandanaCropWindow(iw, ih, offset);
  if (!win) return null;
  const width = target?.width || PET_BANDANA_COMPOSE.width;
  const height = target?.height || PET_BANDANA_COMPOSE.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const visibleH = Math.max(1, Math.round(width / bandanaWindowAspect()));
  if (height <= visibleH + 1) {
    ctx.drawImage(img, win.x, win.y, win.cropW, win.cropH, 0, 0, width, height);
  } else {
    const scale = visibleH / win.cropH;
    const tipH = Math.max(0, height - visibleH);
    const take = Math.min(Math.max(0, ih - (win.y + win.cropH)), tipH / scale);
    const srcH = Math.max(1, win.cropH + take);
    const destH = Math.min(height, Math.max(1, Math.round(visibleH + take * scale)));
    ctx.drawImage(img, win.x, win.y, win.cropW, srcH, 0, 0, width, destH);
    if (destH < height) {
      ctx.drawImage(canvas, 0, destH - 1, width, 1, 0, destH, width, height - destH);
    }
  }
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    width,
    height,
  };
}

/** Print file is the Wrap now window only: 3060×1250, the top two-thirds of the bandana area. */
export async function petBandanaPrintFile(src, offset = 0.5) {
  const height = Math.round(PET_BANDANA_PRINT.width / bandanaWindowAspect());
  return composePetBandanaCrop(src, offset, { width: PET_BANDANA_PRINT.width, height });
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

export function isGreetingCardProduct(productName) {
  return String(productName || '').toLowerCase().includes('greeting card');
}

export function isJigsawPuzzleProduct(productName) {
  const n = String(productName || '').toLowerCase();
  return n.includes('jigsaw') || n.includes('puzzle');
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

function cacheKey(productName, color, size, image, backImage, orientation, focalX, focalY) {
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
  const focalBit = name.toLowerCase().includes('jigsaw') || name.toLowerCase().includes('puzzle')
    ? `|${Number(focalX ?? 0.5).toFixed(3)}|${Number(focalY ?? 0.5).toFixed(3)}`
    : '';
  const cardBit = name.toLowerCase().includes('greeting card') ? '|cardopenright' : '';
  return `${name}|${String(color || '')}|${String(size || '')}|${finger}|${backFinger}|a11${oriBit}${focalBit}${cardBit}`;
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
  focalX,
  focalY,
  signal,
} = {}) {
  const src = String(image || '').trim();
  if (!src) throw new Error('image is required');
  const backSrc = String(backImage || '').trim();
  const key = cacheKey(productName, color, size, src, backSrc, imageOrientation, focalX, focalY);
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
      focal_x: focalX,
      focal_y: focalY,
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
