/**
 * Bake Selected Image offerings (B&W, radius, feather, frame) onto a cart
 * screenshot so checkout, confirm, and fulfillment use the chosen look.
 */

const WORK_MAX = 640;
const EXPORT_MAX = 720;
const DISPLAY_EDGE = 360;

export function browsePresetHasPixelEdits(settings) {
  if (!settings || typeof settings !== 'object') return false;
  return Boolean(
    settings.blackAndWhite
    || Number(settings.cornerRadius) > 0
    || Number(settings.featherEdge) > 0
    || settings.frameEnabled
  );
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('preset image failed to load'));
    img.src = url;
  });
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  if (r <= 0) {
    ctx.rect(x, y, width, height);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function roundedRectSdf(x, y, cx, cy, halfW, halfH, radius) {
  const hw = Math.max(0, halfW);
  const hh = Math.max(0, halfH);
  const r = Math.min(Math.max(0, radius), hw, hh);
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}

/** Inward fade using Euclidean box distance (the old Gaussian/distance-transform brush).
 * Straight sides stay square; corners blend in a quarter-circle so X/Y ramps do not crease.
 */
export function roundedRectFeatherFactor(x, y, width, height, fadeX, fadeY, cornerR) {
  const cx = (width - 1) * 0.5;
  const cy = (height - 1) * 0.5;
  const halfW = (width - 1) * 0.5;
  const halfH = (height - 1) * 0.5;
  const rOuter = Math.min(Math.max(0, cornerR), halfW, halfH);
  const sdfOuter = roundedRectSdf(x, y, cx, cy, halfW, halfH, rOuter);
  const halfWIn = Math.max(0.5, halfW - fadeX);
  const halfHIn = Math.max(0.5, halfH - fadeY);
  const fadeMin = Math.min(fadeX, fadeY);
  let rInner = Math.max(0, rOuter - fadeMin);
  if (rInner < fadeMin) rInner = fadeMin;
  rInner = Math.min(rInner, halfWIn, halfHIn);
  const sdfInner = roundedRectSdf(x, y, cx, cy, halfWIn, halfHIn, rInner);
  if (sdfOuter >= 0) return 0;
  if (sdfInner <= 0) return 1;
  return (-sdfOuter) / Math.max(-sdfOuter + sdfInner, 1e-6);
}

const featherMaskUrlCache = new Map();

/** Square (or rounded) feather mask for browse thumbnails — same SDF as Tools. */
export function featherEdgeMaskStyle(featherEdge, width = 240, height = 320, cornerRadiusPx = 0) {
  if (!(featherEdge > 0) || !(width > 0) || !(height > 0)) return null;
  if (typeof document === 'undefined') return null;
  const maxSide = 256;
  const scale = maxSide / Math.max(width, height);
  const mw = Math.max(1, Math.round(width * scale));
  const mh = Math.max(1, Math.round(height * scale));
  const rScaled = Math.max(0, cornerRadiusPx) * (mw / width);
  const cacheKey = `${mw}x${mh}:${featherEdge}:${Math.round(rScaled * 10)}`;
  let url = featherMaskUrlCache.get(cacheKey);
  if (!url) {
    const canvas = document.createElement('canvas');
    canvas.width = mw;
    canvas.height = mh;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;
    const imageData = ctx.createImageData(mw, mh);
    const data = imageData.data;
    const fadeX = Math.max(1, (featherEdge / 100) * (mw * 0.5));
    const fadeY = Math.max(1, (featherEdge / 100) * (mh * 0.5));
    for (let y = 0; y < mh; y += 1) {
      for (let x = 0; x < mw; x += 1) {
        const fade = roundedRectFeatherFactor(x, y, mw, mh, fadeX, fadeY, rScaled);
        const i = (y * mw + x) * 4;
        const v = Math.round(Math.max(0, Math.min(1, fade)) * 255);
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = v;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    url = canvas.toDataURL('image/png');
    if (featherMaskUrlCache.size > 24) {
      featherMaskUrlCache.delete(featherMaskUrlCache.keys().next().value);
    }
    featherMaskUrlCache.set(cacheKey, url);
  }
  return {
    maskImage: `url("${url}")`,
    maskRepeat: 'no-repeat',
    maskSize: '100% 100%',
    maskMode: 'alpha',
    WebkitMaskImage: `url("${url}")`,
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: '100% 100%',
  };
}

function needsAlpha(settings) {
  return Number(settings?.cornerRadius) > 0 || Number(settings?.featherEdge) > 0;
}

export async function bakeBrowsePresetImage(sourceUrl, settings) {
  const src = String(sourceUrl || '').trim();
  if (!src || !browsePresetHasPixelEdits(settings)) return src;

  const img = await loadImage(src);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!(srcW > 1 && srcH > 1)) return src;

  const workScale = Math.min(1, WORK_MAX / Math.max(srcW, srcH));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(srcW * workScale));
  canvas.height = Math.max(1, Math.round(srcH * workScale));
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return src;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = settings.blackAndWhite ? 'grayscale(1)' : 'none';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';

  const maxR = Math.min(canvas.width, canvas.height) / 2;
  const cornerPct = Number(settings.cornerRadius) || 0;
  const isCircle = cornerPct >= 100;
  const cornerR = isCircle ? maxR : Math.round((cornerPct / 100) * maxR);
  const featherPct = Number(settings.featherEdge) || 0;

  if (cornerR > 0) {
    const mask = document.createElement('canvas');
    mask.width = canvas.width;
    mask.height = canvas.height;
    const mctx = mask.getContext('2d', { alpha: true });
    mctx.fillStyle = '#fff';
    if (isCircle) {
      mctx.beginPath();
      mctx.arc(canvas.width / 2, canvas.height / 2, maxR, 0, Math.PI * 2);
      mctx.fill();
    } else {
      roundedRectPath(mctx, 0, 0, canvas.width, canvas.height, cornerR);
      mctx.fill();
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  if (featherPct > 0) {
    const fadeX = Math.max(1, (featherPct / 100) * (canvas.width * 0.5));
    const fadeY = Math.max(1, (featherPct / 100) * (canvas.height * 0.5));
    const mask = document.createElement('canvas');
    mask.width = canvas.width;
    mask.height = canvas.height;
    const mctx = mask.getContext('2d', { alpha: true });
    const imageData = mctx.createImageData(mask.width, mask.height);
    const data = imageData.data;
    for (let y = 0; y < mask.height; y += 1) {
      for (let x = 0; x < mask.width; x += 1) {
        const alpha = roundedRectFeatherFactor(x, y, mask.width, mask.height, fadeX, fadeY, cornerR);
        const i = (y * mask.width + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = Math.floor(Math.max(0, Math.min(1, alpha)) * 255);
      }
    }
    mctx.putImageData(imageData, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  if (settings.frameEnabled) {
    const thickness = Math.max(4, Math.round(Math.min(canvas.width, canvas.height) * ((Number(settings.frameWidth) || 12) / 180)));
    const paintFrameRing = (inset) => {
      ctx.strokeStyle = settings.frameColor || '#111111';
      ctx.lineWidth = thickness;
      ctx.lineJoin = 'round';
      const x = inset + thickness / 2;
      const y = inset + thickness / 2;
      const w = canvas.width - inset * 2 - thickness;
      const h = canvas.height - inset * 2 - thickness;
      if (!(w > 1 && h > 1)) return;
      if (isCircle) {
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, Math.max(1, maxR - inset - thickness / 2), 0, Math.PI * 2);
        ctx.stroke();
      } else if (cornerR > 0) {
        roundedRectPath(ctx, x, y, w, h, Math.max(0, cornerR - inset - thickness / 2));
        ctx.stroke();
      } else {
        ctx.strokeRect(x, y, w, h);
      }
    };
    paintFrameRing(0);
    if (settings.doubleFrame) {
      paintFrameRing(thickness + Math.max(2, thickness * 0.25));
    }
  }

  const exportScale = Math.min(1, EXPORT_MAX / Math.max(canvas.width, canvas.height));
  let out = canvas;
  if (exportScale < 1) {
    out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(canvas.width * exportScale));
    out.height = Math.max(1, Math.round(canvas.height * exportScale));
    const octx = out.getContext('2d', { alpha: true });
    if (!octx) return src;
    octx.drawImage(canvas, 0, 0, out.width, out.height);
  }

  try {
    const full = needsAlpha(settings)
      ? out.toDataURL('image/png')
      : out.toDataURL('image/jpeg', 0.86);
    const displayCanvas = canvasAtMaxEdge(out, DISPLAY_EDGE);
    const display = needsAlpha(settings)
      ? displayCanvas.toDataURL('image/png')
      : displayCanvas.toDataURL('image/jpeg', 0.72);
    return { full, display };
  } catch {
    return { full: src, display: '' };
  }
}

function canvasAtMaxEdge(canvas, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height, 1));
  if (scale >= 1) return canvas;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(canvas.width * scale));
  out.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = out.getContext('2d', { alpha: true });
  if (!ctx) return canvas;
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

async function jpegDisplayCopy(url) {
  const src = String(url || '').trim();
  if (!src) return '';
  if (src.startsWith('data:') && src.length > 24 && src.length <= 100_000) return src;
  const img = await loadImage(src);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!(srcW > 1 && srcH > 1)) return '';
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, DISPLAY_EDGE / Math.max(srcW, srcH));
  canvas.width = Math.max(1, Math.round(srcW * scale));
  canvas.height = Math.max(1, Math.round(srcH * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export async function applyBrowsePresetToCartItem(item, settings) {
  if (!item) return item;
  const tools = settings && typeof settings === 'object' ? settings : {};
  const original = String(item.originalScreenshot || item.screenshot || item.selected_screenshot || '').trim();
  const next = {
    ...item,
    toolSettings: {
      ...(item.toolSettings || {}),
      ...tools,
    },
  };
  if (original && browsePresetHasPixelEdits(tools)) {
    try {
      const baked = await bakeBrowsePresetImage(original, tools);
      if (baked?.full && baked.full !== original) {
        next.originalScreenshot = original;
        next.screenshot = baked.full;
        next.selected_screenshot = baked.full;
        next.displayScreenshot = baked.display || next.displayScreenshot;
        next.edited = true;
      }
    } catch {
      /* keep original pixels; checkout can still apply CSS from toolSettings */
    }
  }
  if (!String(next.displayScreenshot || '').trim()) {
    try {
      next.displayScreenshot = await jpegDisplayCopy(
        next.screenshot || next.selected_screenshot || original
      );
    } catch {
      /* confirm will downscale the full shot instead */
    }
  }
  return next;
}
