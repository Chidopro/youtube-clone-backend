import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { getPrintAreaConfig, getPrintAreaDimensions, getPrintAreaAspectRatio, getAspectRatio, getPixelDimensions, PRINT_AREA_CONFIG, matchPrintAreaProductName, getProductPrintFilter } from '../../config/printAreaConfig';
import API_CONFIG, { apiJoin } from '../../config/apiConfig';
import { consumeToolsFocusCartIndex, peekToolsFocusCartIndex, setToolsFocusCartIndex, setToolsPreviewNewest, writeCartItems, readPendingMerchData, savePendingMerchData, readCartItems, resyncMerchSessionFromStorage, CART_UPDATED_EVENT, PENDING_MERCH_UPDATED_EVENT, resetToolsEditorSession, consumeToolsEditorReset, readToolsSeenCartCount, writeToolsSeenCartCount, consumeToolsPreviewNewest, peekToolsPreviewNewest, rememberArtworkOrientation } from '../../utils/merchSession';
import { isDemoStorefront } from '../../utils/demoStorefront';
import { toolsPreviewMockupUrl } from '../../utils/shopCategories';
import { getWhiteBlankGarmentTint, getPrintfulColorMockupUrl } from '../../utils/printfulColorMockups';
import { ChevronLeft } from '../../Components/Chevrons/Chevrons';
import { buildEditLog, editLogHasEntries, formatEditLogLines, formatEditLogPlainText, cornerRadiusPx, featherPx } from '../../utils/editLog';
import { roundedRectFeatherFactor } from '../../utils/bakeBrowsePreset';
import { BW_INTENSITY_DEFAULT, blackAndWhiteCssFilter, blackAndWhiteStyle, bwIntensityLabel, clampBwIntensity } from '../../utils/blackAndWhiteFilter';
import { IMAGE_OPACITY_DEFAULT, clampImageOpacity, imageOpacityCss, imageOpacityHasEdit } from '../../utils/imageOpacity';
import { isCurvedBagProduct, isPrintfulWrapProduct, isTotePocketProduct, printfulWrapKind, requestMugWrapMockup, uniqueMugWrapViews } from '../../utils/mugMockup';
import './ToolsPage.css';

// Google Fonts used by the Text tool (fringe/style). Must be loaded before canvas can use them.
const TEXT_TOOL_GOOGLE_FONTS = [
  'Permanent Marker',
  'Orbitron',
  'Bebas Neue',
  'Creepster',
  'Dela Gothic One',
  'Long Cang',
  'Pacifico'
];
const GOOGLE_FONTS_STYLESHEET_URL = 'https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Orbitron:wght@400;700&family=Bebas+Neue&family=Creepster&family=Dela+Gothic+One&family=Long+Cang&family=Pacifico&display=swap';

// Women's / men's / kids garments that use a chest print on a framed mockup photo.
// All-over, swim, and leggings stay on their existing paths.
function isApparelChestPrintProduct(productName) {
  if (!productName) return false;
  const n = productName.toLowerCase();
  if (n.includes('all-over') || n.includes('all over')) return false;
  if (n.includes('swimsuit') || n.includes('leggings')) return false;
  if (n.includes('hat') || n.includes('cap')) return false;
  return (
    n.includes('shirt') ||
    n.includes('tee') ||
    n.includes('hoodie') ||
    n.includes('sweatshirt') ||
    n.includes('jersey') ||
    n.includes('body suit') ||
    n.includes('bodysuit') ||
    n.includes('crop top') ||
    n.includes('long sleeve') ||
    n.includes('tank') ||
    n.includes('ribbed neck')
  );
}

function isShirtOrHoodieApparel(productName, category) {
  const n = String(productName || '').toLowerCase();
  if (
    !(
      n.includes('shirt') ||
      n.includes('tee') ||
      n.includes('hoodie') ||
      n.includes('sweatshirt')
    )
  ) {
    return false;
  }
  const cat = String(category || '').toLowerCase().trim();
  if (cat === 'mugs' || cat === 'hats' || cat === 'bags' || cat === 'pets' || cat === 'misc') {
    return false;
  }
  return cat === 'womens' || cat === 'mens' || cat === 'kids' || !cat;
}

// Landscape shirts fill the chest print, so crop pan is locked. Mugs and other
// non-shirt products keep Move Horizontal / Move Vertical in any orientation.
function locksImageOffsetsInLandscape(productName, orientation) {
  return orientation === 'landscape' && isApparelChestPrintProduct(productName);
}

/** Portrait cover: start at the helmet, not the sword/padding above it, so more of the legs stay in. */
const PORTRAIT_COVER_Y = 26;

const ARTWORK_ZOOM_MIN = 50;
const ARTWORK_ZOOM_MAX = 150;

function clampArtworkZoom(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.max(ARTWORK_ZOOM_MIN, Math.min(ARTWORK_ZOOM_MAX, Math.round(n)));
}

/**
 * Place artwork in a print box. 100% = cover (fill). Below 100% shrinks
 * inside the box so the shirt shows through. Above 100% crops tighter.
 */
function artworkLayoutInBox(boxW, boxH, imgW, imgH, zoomPercent, posX, posY) {
  const bw = Number(boxW) || 0;
  const bh = Number(boxH) || 0;
  const iw = Number(imgW) || 0;
  const ih = Number(imgH) || 0;
  if (!(bw > 0 && bh > 0 && iw > 0 && ih > 0)) return null;
  const zoom = clampArtworkZoom(zoomPercent) / 100;
  const boxAspect = bw / bh;
  const imgAspect = iw / ih;
  let coverW;
  let coverH;
  if (imgAspect > boxAspect) {
    coverH = bh;
    coverW = bh * imgAspect;
  } else {
    coverW = bw;
    coverH = bw / imgAspect;
  }
  const drawW = coverW * zoom;
  const drawH = coverH * zoom;
  const px = Math.max(0, Math.min(100, Number(posX) || 0));
  const py = Math.max(0, Math.min(100, Number(posY) || 0));
  return {
    width: drawW,
    height: drawH,
    left: (px / 100) * (bw - drawW),
    top: (py / 100) * (bh - drawH),
  };
}

/**
 * Visible intersection of zoomed artwork with the print box.
 * Zoom-out is the smaller image; zoom-in / 100% is the full box.
 */
function visibleArtworkRect(boxW, boxH, layout) {
  const bw = Number(boxW) || 0;
  const bh = Number(boxH) || 0;
  if (!(bw > 0 && bh > 0)) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  if (!layout) {
    return { left: 0, top: 0, width: bw, height: bh };
  }
  const l = Number(layout.left) || 0;
  const t = Number(layout.top) || 0;
  const w = Number(layout.width) || 0;
  const h = Number(layout.height) || 0;
  const left = Math.max(0, l);
  const top = Math.max(0, t);
  const right = Math.min(bw, l + w);
  const bottom = Math.min(bh, t + h);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function artworkRectFillsBox(vis, boxW, boxH) {
  return (
    vis.left <= 0.5
    && vis.top <= 0.5
    && vis.width >= (Number(boxW) || 0) - 1
    && vis.height >= (Number(boxH) || 0) - 1
  );
}

function integerArtworkRect(vis, boxW, boxH) {
  const bw = Number(boxW) || 0;
  const bh = Number(boxH) || 0;
  const left = Math.max(0, Math.floor(Number(vis?.left) || 0));
  const top = Math.max(0, Math.floor(Number(vis?.top) || 0));
  const right = Math.min(bw, Math.ceil((Number(vis?.left) || 0) + (Number(vis?.width) || 0)));
  const bottom = Math.min(bh, Math.ceil((Number(vis?.top) || 0) + (Number(vis?.height) || 0)));
  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function printBoxObjectPosition(productName, orientation, offsetX, offsetY) {
  if (locksImageOffsetsInLandscape(productName, orientation)) {
    return { x: 50, y: 50 };
  }
  const x = Math.max(0, Math.min(100, 50 + (Number(offsetX) || 0) / 2));
  const yBase = orientation === 'landscape' ? 50 : PORTRAIT_COVER_Y;
  const y = Math.max(0, Math.min(100, yBase + (Number(offsetY) || 0) / 2));
  return { x, y };
}

/**
 * Per-product overlay size/placement. This is the Ribbed Neck / Micro-Rib /
 * Racerback logic: map the overlay to the mint→pink print rectangle painted
 * on that SKU's mockup photo (widthFrac/heightFrac of the photo, top/left =
 * box center). Do not share one formula across shirts — print boxes differ.
 */
const APPAREL_PRINT_OVERRIDES = {
  "Men's Tank Top": {
    widthFrac: 0.551,
    heightFrac: 0.527,
    top: 56.2,
    left: 50.6,
  },
  "Women's Ribbed Neck": {
    widthFrac: 0.42,
    heightFrac: 0.524,
    top: 38.2,
    left: 50.5,
  },
  "Micro-Rib Tank Top": {
    widthFrac: 0.511,
    heightFrac: 0.408,
    top: 56.7,
    left: 50.8,
  },
  "Racerback Tank": {
    widthFrac: 0.706,
    heightFrac: 0.521,
    top: 49.8,
    left: 49.6,
    // Landscape only: print box is a tight crop of a fitted tank, so the
    // full portrait width crowds the armholes. Portrait stays unchanged.
    landscapeWidthScale: 0.94,
    landscapeRightGrow: 0.03,
  },
  "Cropped Hoodie": {
    widthFrac: 0.389,
    heightFrac: 0.301,
    top: 26.5,
    left: 50.0,
  },
  "Champion Hoodie": {
    widthFrac: 0.508,
    heightFrac: 0.337,
    top: 31.6,
    left: 50.4,
  },
  "Men's Long Sleeve Shirt": {
    widthFrac: 0.32,
    heightFrac: 0.459,
    top: 41.7,
    left: 51.5,
  },
  "Oversized T-Shirt": {
    widthFrac: 0.404,
    heightFrac: 0.487,
    top: 40,
    left: 49.5,
  },
  "Mens Fitted T-Shirt": {
    widthFrac: 0.349,
    heightFrac: 0.483,
    top: 41.4,
    left: 49.6,
  },
  "Men's Fitted Long Sleeve": {
    widthFrac: 0.339,
    heightFrac: 0.525,
    top: 44.9,
    left: 51,
  },
  "Hoodie": {
    widthFrac: 0.472,
    heightFrac: 0.365,
    top: 34.8,
    left: 51.3,
  },
  "Kids Shirt": {
    widthFrac: 0.415,
    heightFrac: 0.485,
    top: 45.4,
    left: 50.3,
  },
  "Youth Heavy Blend Hoodie": {
    widthFrac: 0.363,
    heightFrac: 0.258,
    top: 52.9,
    left: 50.1,
  },
  "Kids Sweatshirt": {
    widthFrac: 0.388,
    heightFrac: 0.485,
    top: 43.6,
    left: 52.2,
  },
  "T-Shirt": {
    widthFrac: 0.56,
    heightFrac: 0.501,
    top: 42.5,
    left: 50.2,
  },
  "Women's Shirt": {
    widthFrac: 0.437,
    heightFrac: 0.469,
    top: 34.2,
    left: 49.9,
  },
  "Heavyweight T-Shirt": {
    widthFrac: 0.429,
    heightFrac: 0.49,
    top: 38.4,
    left: 49,
    // Portrait: close the hairline white print-box gap on the right only.
    rightGrow: 0.02,
    // Landscape: this mockup's print box is taller than a 1.5:1 band, which
    // left mint showing around a wide crop. Keep width on the painted box
    // and use a taller landscape frame so the image fills the chest.
    landscapeWidthScale: 1.05,
    landscapeAspect: 1.15,
  },
  "Kids Long Sleeve": {
    widthFrac: 0.502,
    heightFrac: 0.453,
    top: 39.9,
    left: 50.2,
  },
  "Toddler Jersey T-Shirt": {
    widthFrac: 0.361,
    heightFrac: 0.414,
    top: 40.2,
    left: 50,
  },
  "Baby Staple Tee": {
    widthFrac: 0.426,
    heightFrac: 0.627,
    top: 54,
    left: 50.7,
  },
  "Baby Jersey T-Shirt": {
    widthFrac: 0.393,
    heightFrac: 0.557,
    top: 49.7,
    left: 50.1,
  },
  "Pullover Hoodie": {
    widthFrac: 0.476,
    heightFrac: 0.36,
    top: 35.7,
    left: 50.8,
  },
  "Women's Crop Top": {
    widthFrac: 0.465,
    heightFrac: 0.541,
    top: 49.9,
    left: 49.9,
  },
  "Baby Body Suit": {
    widthFrac: 0.424,
    heightFrac: 0.471,
    top: 41.4,
    left: 49.5,
  },
};

const BASEBALL_FRONT_PRINT = {
  widthFrac: 0.50,
  heightFrac: 0.20,
  top: 46.5,
  left: 50,
  topShift: 7,
  landscapeAspect: 2.5,
};
const DAD_FRONT_PRINT = {
  widthFrac: 0.54,
  heightFrac: 0.216,
  top: 45.2,
  left: 50,
  topShift: 4,
  landscapeAspect: 2.5,
};
const CLOSED_BACK_FRONT_PRINT = {
  widthFrac: 0.50,
  heightFrac: 0.20,
  top: 46.5,
  left: 50,
  topShift: 7,
  landscapeAspect: 2.5,
};
const TRUCKER_FRONT_PRINT = {
  widthFrac: 0.48,
  heightFrac: 0.218,
  top: 48,
  left: 50,
  topShift: 10,
  landscapeAspect: 2.2,
};
APPAREL_PRINT_OVERRIDES["Distressed Dad Hat"] = DAD_FRONT_PRINT;
APPAREL_PRINT_OVERRIDES["Closed Back Cap"] = CLOSED_BACK_FRONT_PRINT;
APPAREL_PRINT_OVERRIDES["Five Panel Trucker Hat"] = TRUCKER_FRONT_PRINT;
APPAREL_PRINT_OVERRIDES["Five Panel Baseball Cap"] = BASEBALL_FRONT_PRINT;
APPAREL_PRINT_OVERRIDES["Unisex Champion Hoodie"] = APPAREL_PRINT_OVERRIDES["Champion Hoodie"];
APPAREL_PRINT_OVERRIDES["Unisex Oversized T-Shirt"] = APPAREL_PRINT_OVERRIDES["Oversized T-Shirt"];
APPAREL_PRINT_OVERRIDES["Unisex Hoodie"] = APPAREL_PRINT_OVERRIDES["Hoodie"];
APPAREL_PRINT_OVERRIDES["Kids Hoodie"] = APPAREL_PRINT_OVERRIDES["Youth Heavy Blend Hoodie"];
APPAREL_PRINT_OVERRIDES["Unisex T-Shirt"] = APPAREL_PRINT_OVERRIDES["T-Shirt"];
APPAREL_PRINT_OVERRIDES["Unisex Pullover Hoodie"] = APPAREL_PRINT_OVERRIDES["Pullover Hoodie"];
APPAREL_PRINT_OVERRIDES["Unisex Heavyweight T-Shirt"] = APPAREL_PRINT_OVERRIDES["Heavyweight T-Shirt"];
APPAREL_PRINT_OVERRIDES["Crop Top"] = APPAREL_PRINT_OVERRIDES["Women's Crop Top"];

function getApparelPrintOverride(productName) {
  const name = matchPrintAreaProductName(productName) || String(productName || '').trim();
  return APPAREL_PRINT_OVERRIDES[name] || APPAREL_PRINT_OVERRIDES[String(productName || '').trim()] || null;
}

function parseCssHex(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return null;
  return [r, g, b];
}

/** Multiply opaque white-blank mockup pixels by a Printful swatch. Keeps the mint print box. */
function tintMockupCanvas(img, hex) {
  const rgb = parseCssHex(hex);
  const nw = img?.naturalWidth || 0;
  const nh = img?.naturalHeight || 0;
  if (!rgb || !nw || !nh) return '';
  const canvas = document.createElement('canvas');
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0, nw, nh);
  const imageData = ctx.getImageData(0, 0, nw, nh);
  const data = imageData.data;
  const [tr, tg, tb] = rgb;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 20) continue;
    if (isPrintBoxPixel(data[i], data[i + 1], data[i + 2])) continue;
    data[i] = Math.round((data[i] * tr) / 255);
    data[i + 1] = Math.round((data[i + 1] * tg) / 255);
    data[i + 2] = Math.round((data[i + 2] * tb) / 255);
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function isPrintBoxPixel(r, g, b) {
  const isMint = r > 170 && r < 230 && g > r + 10 && g >= b - 5 && g > 200;
  const isPink = r > 190 && (r - g) > 50 && g < 140 && g > 60;
  return isMint || isPink;
}

const shirtFillCache = new Map();
const PIXEL_PROBE_MAX = 280;
const DEBUG_OVERLAY_SIZE = false;
const FEATHER_WORK_MAX = 640;
const BAKE_EXPORT_MAX = 720;
const BAKE_DEBOUNCE_MS = 200;

function readImagePixelsScaled(img, maxDim = PIXEL_PROBE_MAX) {
  const nw = img?.naturalWidth || 0;
  const nh = img?.naturalHeight || 0;
  if (!nw || !nh) return null;
  const scale = Math.min(1, maxDim / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * scale));
  const h = Math.max(1, Math.round(nh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h };
}

function scheduleIdleWork(fn) {
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(() => fn(), { timeout: 300 });
  }
  return window.setTimeout(fn, 0);
}

/** Shirt fabric around the mint/pink guide, so zoom-out gaps are garment, not the painted box. */
function sampleShirtFillFromMockup(img, productName) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return '';
  const src = img.currentSrc || img.src || '';
  const cacheKey = `${src}|${String(productName || '')}`;
  if (cacheKey && shirtFillCache.has(cacheKey)) return shirtFillCache.get(cacheKey);
  try {
    const probed = readImagePixelsScaled(img);
    if (!probed) return '';
    const { data, w, h } = probed;
    const box = getApparelPrintOverride(productName) || {
      widthFrac: 0.5,
      heightFrac: 0.5,
      top: 44,
      left: 50,
    };
    const cx = (Number(box.left) || 50) / 100;
    const cy = (Number(box.top) || 44) / 100;
    const hw = (Number(box.widthFrac) || 0.5) / 2 + 0.06;
    const hh = (Number(box.heightFrac) || 0.5) / 2 + 0.06;
    const samples = [];
    for (let t = 0; t < 24; t++) {
      const a = (t / 24) * Math.PI * 2;
      const xf = cx + Math.cos(a) * hw;
      const yf = cy + Math.sin(a) * hh;
      if (xf < 0.1 || xf > 0.9 || yf < 0.1 || yf > 0.9) continue;
      const x = Math.max(0, Math.min(w - 1, Math.round(xf * w)));
      const y = Math.max(0, Math.min(h - 1, Math.round(yf * h)));
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];
      if (alpha < 80) continue;
      if (isPrintBoxPixel(r, g, b)) continue;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      // Skip near-white highlights only. Light shirts (sky/cyan) must still sample.
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      if (l > 245 && sat < 18) continue;
      samples.push([r, g, b, l]);
    }
    if (!samples.length) return '';
    samples.sort((a, b) => a[3] - b[3]);
    const mid = samples[Math.floor(samples.length / 2)];
    const color = `rgb(${Math.round(mid[0])}, ${Math.round(mid[1])}, ${Math.round(mid[2])})`;
    shirtFillCache.set(cacheKey, color);
    return color;
  } catch {
    return '';
  }
}

function percentileSorted(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

const paintedPrintBoxCache = new Map();

/** Same mint→pink box detection used to lock Ribbed Neck / tanks to the mockup. */
function detectPaintedPrintBox(img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;
  const src = img.currentSrc || img.src || '';
  if (src && paintedPrintBoxCache.has(src)) return paintedPrintBoxCache.get(src);
  try {
    const probed = readImagePixelsScaled(img);
    if (!probed) return null;
    const { data, w, h } = probed;
    const xs = [];
    const ys = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (isPrintBoxPixel(data[i], data[i + 1], data[i + 2])) {
          xs.push(x);
          ys.push(y);
        }
      }
    }
    const minHits = Math.max(24, Math.round(w * h * 0.0008));
    if (xs.length < minHits) {
      if (src) paintedPrintBoxCache.set(src, null);
      return null;
    }
    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);
    const x1 = percentileSorted(xs, 0.02);
    const x2 = percentileSorted(xs, 0.98);
    const y1 = percentileSorted(ys, 0.02);
    const y2 = percentileSorted(ys, 0.98);
    const bw = x2 - x1;
    const bh = y2 - y1;
    const widthFrac = bw / w;
    const heightFrac = bh / h;
    const left = (100 * (x1 + x2)) / 2 / w;
    const top = (100 * (y1 + y2)) / 2 / h;
    const sane =
      widthFrac >= 0.18 && widthFrac <= 0.78 &&
      heightFrac >= 0.15 && heightFrac <= 0.75 &&
      left >= 40 && left <= 60 &&
      top >= 18 && top <= 68;
    const box = sane
      ? {
          widthFrac: Math.round(widthFrac * 1000) / 1000,
          heightFrac: Math.round(heightFrac * 1000) / 1000,
          top: Math.round(top * 10) / 10,
          left: Math.round(left * 10) / 10,
        }
      : null;
    if (src) paintedPrintBoxCache.set(src, box);
    return box;
  } catch {
    if (src) paintedPrintBoxCache.set(src, null);
    return null;
  }
}

function resolveApparelPrintBox(productName, detected) {
  const override = getApparelPrintOverride(productName);
  if (override?.widthFrac) return override;
  if (detected?.widthFrac && detected?.heightFrac) return detected;
  return null;
}

const WOMENS_CHEST_PRINT_NAMES = new Set([
  "Women's Shirt",
  "Heavyweight T-Shirt",
  "Women's Ribbed Neck",
  "Micro-Rib Tank Top",
  "Racerback Tank",
  "Women's Crop Top",
  "Pullover Hoodie",
  "Cropped Hoodie",
  "Unisex Pullover Hoodie",
  "Unisex Heavyweight T-Shirt",
  "Crop Top",
]);

function isWomensChestPrintProduct(productName) {
  const name = matchPrintAreaProductName(productName) || String(productName || '').trim();
  if (WOMENS_CHEST_PRINT_NAMES.has(name)) return true;
  return String(productName || '').toLowerCase().includes('women');
}

const MENS_CHEST_PRINT_NAMES = new Set([
  "T-Shirt",
  "Unisex T-Shirt",
  "Men's Long Sleeve Shirt",
  "Mens Fitted T-Shirt",
  "Men's Fitted Long Sleeve",
  "Oversized T-Shirt",
  "Unisex Oversized T-Shirt",
  "Hoodie",
  "Unisex Hoodie",
  "Champion Hoodie",
  "Unisex Champion Hoodie",
  "Men's Tank Top",
]);

function isMensChestPrintProduct(productName) {
  const name = matchPrintAreaProductName(productName) || String(productName || '').trim();
  return MENS_CHEST_PRINT_NAMES.has(name);
}

const KIDS_CHEST_PRINT_NAMES = new Set([
  "Kids Shirt",
  "Kids Long Sleeve",
  "Kids Sweatshirt",
  "Youth Heavy Blend Hoodie",
  "Kids Hoodie",
  "Toddler Jersey T-Shirt",
  "Baby Staple Tee",
  "Baby Jersey T-Shirt",
]);

function isKidsChestPrintProduct(productName) {
  const name = matchPrintAreaProductName(productName) || String(productName || '').trim();
  return KIDS_CHEST_PRINT_NAMES.has(name);
}

// Measured boxes use a 2–98 percentile inset, so a hair of print area shows
// around the overlay. Scale from the center. Cropped hoodie is placement-only
// when the gap is on one side.
const WOMENS_PRINT_BOX_SCALE = 1.05;
const MENS_PRINT_BOX_SCALE = 1.05;
const KIDS_PRINT_BOX_SCALE = 1.05;

function printBoxCoverScale(productName) {
  if (isWomensChestPrintProduct(productName)) return WOMENS_PRINT_BOX_SCALE;
  if (isMensChestPrintProduct(productName)) return MENS_PRINT_BOX_SCALE;
  if (isKidsChestPrintProduct(productName)) return KIDS_PRINT_BOX_SCALE;
  return 1;
}

/** Overlay px for apparel: print W×H inches, scaled to the mockup photo. */
function sizeApparelPrintOverlay(printW, printH, mockupW, mockupH, productName, detected) {
  const aspect = printW / printH;
  const box = resolveApparelPrintBox(productName, detected);
  if (box?.widthFrac) {
    let width = mockupW * box.widthFrac;
    let height = mockupH > 0 && box.heightFrac
      ? mockupH * box.heightFrac
      : width / aspect;
    const coverScale = printBoxCoverScale(productName);
    if (coverScale !== 1) {
      width *= coverScale;
      height *= coverScale;
    }
    return { width, height };
  }
  const n = String(productName || '').toLowerCase();
  const isWomens = n.includes('women');
  const isTank = n.includes('tank');
  const isBaby = n.includes('baby') || n.includes('toddler');
  const isKids = !isBaby && (n.includes('kids') || n.includes('youth'));
  const isHoodie = n.includes('hoodie') || n.includes('sweatshirt');

  // Share of mockup width a 12" print should cover.
  // T-Shirt: 0.525 was ~3 clicks too big. Tanks are a narrow garment in the photo.
  const coverAt12in = isBaby
    ? (7 / 18) * (12 / 7)
    : isTank
      ? 0.36
      : isHoodie
        ? 0.44
        : isKids
          ? 0.47
          : isWomens
            ? 0.545
            : 0.509;

  let width = mockupW * coverAt12in * (printW / 12);
  let height = width / aspect;

  const maxW = mockupW * (isBaby ? 0.50 : isTank ? 0.40 : 0.58);
  const maxH = mockupH > 0
    ? mockupH * (isHoodie ? 0.52 : isTank ? 0.44 : 0.62)
    : Number.POSITIVE_INFINITY;
  if (width > maxW) {
    width = maxW;
    height = width / aspect;
  }
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }
  return { width, height };
}

/**
 * Landscape uses the measured print-area width (not the portrait cover
 * scale). Portrait is grown ~5% to hide the mint box; that extra width
 * makes a landscape band stick out past the mockup rectangle. Height is
 * a shorter band so a wide screenshot fills left-to-right. A product can
 * set `landscapeWidthScale` to inset that band, `landscapeAspect` (width /
 * height, default 1.5) to make the band taller or shorter, and
 * `landscapeRightGrow` to extend only the right edge (left stays put).
 */
function overlaySizeForOrientation(width, height, orientation, productName) {
  const box = getApparelPrintOverride(productName);
  if (orientation !== 'landscape' || !(width > 0 && height > 0)) {
    if (!(width > 0 && height > 0)) return { width, height, rightShift: 0 };
    const rightGrow = box?.rightGrow > 0 ? width * box.rightGrow : 0;
    return { width: width + rightGrow, height, rightShift: rightGrow / 2 };
  }
  const coverScale = printBoxCoverScale(productName);
  let w = coverScale > 1 ? width / coverScale : width;
  const widthScale = box?.landscapeWidthScale > 0 ? box.landscapeWidthScale : 1;
  w *= widthScale;
  const landscapeAspect = box?.landscapeAspect > 1 ? box.landscapeAspect : 1.5;
  const h = Math.min(height, w / landscapeAspect);
  const rightGrow = box?.landscapeRightGrow > 0 ? w * box.landscapeRightGrow : 0;
  w += rightGrow;
  return { width: w, height: h, rightShift: rightGrow / 2 };
}

function applyArtworkOrientation(product, _screenshotUrl, userSetRef, setImageOrientation) {
  if (userSetRef.current) return;
  const fromItem = (product?.toolSettings?.imageOrientation || product?.imageOrientation || product?.image_orientation || '');
  const ori = fromItem === 'landscape' || fromItem === 'portrait' ? fromItem : 'portrait';
  if (fromItem === 'landscape' || fromItem === 'portrait') {
    userSetRef.current = true;
  }
  rememberArtworkOrientation(ori);
  setImageOrientation(ori);
}

/** Fill the print box. Portrait stays the shirt-sized box and crops from the feet. */
function overlayBoxForArtwork(printBox) {
  const width = Number(printBox?.width) || 0;
  const height = Number(printBox?.height) || 0;
  const rightShift = printBox?.rightShift || 0;
  return { width, height, rightShift, objectFit: 'cover', cover: true };
}

/** Keep the overlay frame horizontally centered and inside the print box. */
function clampOverlayOffsetToPrintArea({
  offsetY = 0,
  rightShift = 0,
  overlayH,
  printH,
}) {
  // Keep 1px inside the painted box so the frame is not clipped by rounding.
  const maxY = Math.max(0, (Number(printH) - Number(overlayH)) / 2 - 1);
  const shift = Number(rightShift) || 0;
  const y = Number.isFinite(maxY)
    ? Math.max(-maxY, Math.min(maxY, Number(offsetY) || 0))
    : (Number(offsetY) || 0);
  return { x: -shift, y };
}

/** Pixel corner radius for the visible print box (100% = inscribed circle / pill). */
function overlayCornerRadiusPx(cornerRadius, width, height) {
  if (!(cornerRadius > 0) || !(width > 0) || !(height > 0)) return 0;
  const maxRadius = Math.min(width, height) / 2;
  return cornerRadius >= 100 ? maxRadius : (cornerRadius / 100) * maxRadius;
}

/**
 * Inner ring matches outer thickness and stays a short gutter inside it
 * so widening the frame does not shove the inner ring toward the center.
 */
function doubleFrameSpacing(framePx) {
  const thickness = Math.max(1, Number(framePx) || 0);
  const gap = Math.max(2, thickness * 0.25);
  return { innerFrameWidth: thickness, innerOuter: thickness + gap };
}

/**
 * Inner ring is inset by innerOuter. Its outer corner radius must be
 * outerRadius − inset so the gap stays even through the corners
 * (same-radius inset boxes flare at the corners).
 */
function overlayDoubleFrameLayout(previewFrame, outerRadiusPx) {
  const { innerFrameWidth, innerOuter } = doubleFrameSpacing(previewFrame);
  const innerRadius = Math.max(0, (Number(outerRadiusPx) || 0) - innerOuter);
  return { innerFrameWidth, innerOuter, innerRadius };
}

function artworkOverlayMetrics({
  boxW,
  boxH,
  layout,
  cornerRadius = 0,
  featherEdge = 0,
  frameEnabled = false,
  frameWidth = 10,
  sourceWidth = 0,
  sourceHeight = 0,
}) {
  const vis = visibleArtworkRect(boxW, boxH, layout);
  const clipRadius = overlayCornerRadiusPx(cornerRadius, vis.width, vis.height);
  const boxRadius = artworkRectFillsBox(vis, boxW, boxH) ? clipRadius : 0;
  const featherMask = overlayFeatherMaskStyle(featherEdge, vis.width, vis.height, clipRadius);
  const previewFrame = frameEnabled
    ? overlayFramePx(frameWidth, boxW, boxH, sourceWidth, sourceHeight)
    : 0;
  const { innerFrameWidth, innerOuter, innerRadius } = overlayDoubleFrameLayout(
    previewFrame,
    clipRadius
  );
  return {
    vis,
    clipRadius,
    boxRadius,
    featherMask,
    previewFrame,
    innerFrameWidth,
    innerOuter,
    innerRadius,
  };
}

function artworkImageOffsetStyle(layout, vis) {
  if (!layout || !(Number(vis?.width) > 0) || !(Number(vis?.height) > 0)) return null;
  const vw = Number(vis.width);
  const vh = Number(vis.height);
  return {
    position: 'absolute',
    width: `${((Number(layout.width) || 0) / vw) * 100}%`,
    height: `${((Number(layout.height) || 0) / vh) * 100}%`,
    left: `${(((Number(layout.left) || 0) - (Number(vis.left) || 0)) / vw) * 100}%`,
    top: `${(((Number(layout.top) || 0) - (Number(vis.top) || 0)) / vh) * 100}%`,
    maxWidth: 'none',
    maxHeight: 'none',
  };
}

function overlayVisBoxStyle(vis, boxW, boxH) {
  const bw = Number(boxW) || 0;
  const bh = Number(boxH) || 0;
  if (bw > 0 && bh > 0) {
    return {
      position: 'absolute',
      left: `${((Number(vis?.left) || 0) / bw) * 100}%`,
      top: `${((Number(vis?.top) || 0) / bh) * 100}%`,
      width: `${((Number(vis?.width) || 0) / bw) * 100}%`,
      height: `${((Number(vis?.height) || 0) / bh) * 100}%`,
    };
  }
  return {
    position: 'absolute',
    left: vis.left,
    top: vis.top,
    width: vis.width,
    height: vis.height,
  };
}

/** CSS border (not inset box-shadow) so corner thickness matches the straight edges. */
function overlayFrameRingStyle(inset, thickness, outerRadius, color) {
  const t = Math.max(0, Number(thickness) || 0);
  const r = Math.max(0, Number(outerRadius) || 0);
  const i = Math.max(0, Number(inset) || 0);
  return {
    position: 'absolute',
    top: i,
    right: i,
    bottom: i,
    left: i,
    boxSizing: 'border-box',
    border: t > 0 ? `${t}px solid ${color}` : 'none',
    borderRadius: r > 0 ? `${r}px` : 0,
    pointerEvents: 'none',
    background: 'transparent',
  };
}

const overlayFeatherMaskCache = new Map();

/**
 * Feather the visible print-box edges, following the rounded frame instead of
 * nested X/Y ramps that meet at a right angle.
 */
function overlayFeatherMaskStyle(featherEdge, width, height, cornerRadiusPx = 0) {
  if (!(featherEdge > 0) || !(width > 0) || !(height > 0)) return null;
  if (typeof document === 'undefined') return null;
  const maxSide = 256;
  const scale = maxSide / Math.max(width, height);
  const mw = Math.max(1, Math.round(width * scale));
  const mh = Math.max(1, Math.round(height * scale));
  const rScaled = Math.max(0, cornerRadiusPx) * (mw / width);
  const cacheKey = `${mw}x${mh}:${featherEdge}:${Math.round(rScaled * 10)}`;
  let url = overlayFeatherMaskCache.get(cacheKey);
  if (!url) {
    const canvas = document.createElement('canvas');
    canvas.width = mw;
    canvas.height = mh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const imageData = ctx.createImageData(mw, mh);
    const data = imageData.data;
    const fadeX = Math.max(1, (featherEdge / 100) * (mw * 0.5));
    const fadeY = Math.max(1, (featherEdge / 100) * (mh * 0.5));
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
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
    if (overlayFeatherMaskCache.size > 24) {
      overlayFeatherMaskCache.delete(overlayFeatherMaskCache.keys().next().value);
    }
    overlayFeatherMaskCache.set(cacheKey, url);
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

function normalizeFeatherFadeColor(value) {
  if (value === 'black') return 'black';
  if (value === 'transparent') return 'transparent';
  return 'white';
}

function isTransparentFeatherFade(enabled, color) {
  return !enabled || color === 'transparent';
}

function overlayFeatherFadeBackground(enabled, color) {
  if (isTransparentFeatherFade(enabled, color)) return 'transparent';
  return color === 'black' ? '#000' : '#fff';
}

function flattenCanvasFeatherToColor(ctx, canvas, fadeColor) {
  if (!ctx || !canvas) return;
  const raw = String(fadeColor || '').trim();
  if (!raw || raw === 'transparent') return;
  const fillCss = raw === 'black' || raw === '#000' || raw === '#000000'
    ? '#000000'
    : (raw === 'white' || raw === '#fff' || raw === '#ffffff'
      ? '#ffffff'
      : raw);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = fillCss;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(Number(radius) || 0, width / 2, height / 2));
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/**
 * Radius, feather, and optional fade on a canvas the size of the visible artwork.
 * Letterbox / print-box pixels stay on the caller.
 */
function applyRadiusFeatherFade(sourceCanvas, {
  cornerRadius = 0,
  featherEdge = 0,
  featherFadeEnabled = false,
  featherFadeColor = 'white',
} = {}) {
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const workScale = Math.min(1, FEATHER_WORK_MAX / Math.max(srcW, srcH, 1));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  canvas.width = Math.max(1, Math.round(srcW * workScale));
  canvas.height = Math.max(1, Math.round(srcH * workScale));
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);

  const maxCornerRadius = Math.min(canvas.width, canvas.height) / 2;
  const isCircle = cornerRadius >= 100;
  const effectiveCornerRadius = isCircle
    ? maxCornerRadius
    : Math.round((Number(cornerRadius) || 0) / 100 * maxCornerRadius);

  if (effectiveCornerRadius > 0) {
    const roundedMaskCanvas = document.createElement('canvas');
    const roundedMaskCtx = roundedMaskCanvas.getContext('2d', { alpha: true });
    roundedMaskCanvas.width = canvas.width;
    roundedMaskCanvas.height = canvas.height;
    roundedMaskCtx.clearRect(0, 0, roundedMaskCanvas.width, roundedMaskCanvas.height);
    roundedMaskCtx.fillStyle = 'white';
    if (isCircle) {
      roundedMaskCtx.beginPath();
      roundedMaskCtx.arc(
        roundedMaskCanvas.width / 2,
        roundedMaskCanvas.height / 2,
        maxCornerRadius,
        0,
        Math.PI * 2
      );
      roundedMaskCtx.fill();
    } else {
      roundedMaskCtx.beginPath();
      roundedRectPath(roundedMaskCtx, 0, 0, roundedMaskCanvas.width, roundedMaskCanvas.height, effectiveCornerRadius);
      roundedMaskCtx.fill();
    }

    const finalCanvas = document.createElement('canvas');
    const finalCtx = finalCanvas.getContext('2d', { alpha: true });
    finalCanvas.width = canvas.width;
    finalCanvas.height = canvas.height;
    finalCtx.drawImage(canvas, 0, 0);
    finalCtx.globalCompositeOperation = 'destination-in';
    finalCtx.drawImage(roundedMaskCanvas, 0, 0);
    finalCtx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(finalCanvas, 0, 0);
  }

  if (featherEdge > 0) {
    const featherX = (featherEdge / 100) * (canvas.width * 0.5);
    const featherY = (featherEdge / 100) * (canvas.height * 0.5);
    const maskCanvas = document.createElement('canvas');
    const maskCtx = maskCanvas.getContext('2d', { alpha: true });
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskCtx.fillStyle = 'white';
    if (isCircle) {
      maskCtx.beginPath();
      maskCtx.arc(canvas.width / 2, canvas.height / 2, maxCornerRadius, 0, Math.PI * 2);
      maskCtx.fill();
    } else if (effectiveCornerRadius > 0) {
      maskCtx.beginPath();
      roundedRectPath(maskCtx, 0, 0, canvas.width, canvas.height, effectiveCornerRadius);
      maskCtx.fill();
    } else {
      maskCtx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (isCircle) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const innerRadius = Math.max(0, maxCornerRadius - ((featherEdge / 100) * maxCornerRadius));
      const outerRadius = maxCornerRadius;
      const radialGradient = maskCtx.createRadialGradient(
        centerX, centerY, innerRadius,
        centerX, centerY, outerRadius
      );
      radialGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      radialGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
      maskCtx.globalCompositeOperation = 'destination-out';
      maskCtx.fillStyle = radialGradient;
      maskCtx.beginPath();
      maskCtx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
      maskCtx.fill();
    } else {
      const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const data = imageData.data;
      const fadeX = Math.max(1, featherX);
      const fadeY = Math.max(1, featherY);
      const cornerR = Math.max(0, effectiveCornerRadius);
      for (let y = 0; y < maskCanvas.height; y++) {
        for (let x = 0; x < maskCanvas.width; x++) {
          const edgeFade = roundedRectFeatherFactor(
            x,
            y,
            maskCanvas.width,
            maskCanvas.height,
            fadeX,
            fadeY,
            cornerR
          );
          const index = (y * maskCanvas.width + x) * 4;
          data[index + 3] = Math.floor(Math.max(0, Math.min(1, edgeFade)) * 255);
        }
      }
      maskCtx.putImageData(imageData, 0, 0);
    }

    maskCtx.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  if (featherFadeEnabled && featherEdge > 0) {
    flattenCanvasFeatherToColor(ctx, canvas, featherFadeColor);
  }

  if (workScale < 1) {
    const restored = document.createElement('canvas');
    const restoredCtx = restored.getContext('2d', { alpha: true });
    restored.width = srcW;
    restored.height = srcH;
    restoredCtx.drawImage(canvas, 0, 0, srcW, srcH);
    return restored;
  }

  return canvas;
}

function LiteOverlayArtwork({
  screenshot,
  vis,
  layout,
  cornerRadius = 0,
  featherEdge = 0,
  featherFadeEnabled = false,
  featherFadeColor = 'white',
  shirtFillColor = '',
  mockupSrc = '',
  productName = '',
  blackAndWhite = false,
  bwIntensity = BW_INTENSITY_DEFAULT,
  imageOpacity = IMAGE_OPACITY_DEFAULT,
  posX = 50,
  posY = 50,
  objectFit = 'cover',
}) {
  const visW = Math.max(0, Number(vis?.width) || 0);
  const visH = Math.max(0, Number(vis?.height) || 0);
  const [png, setPng] = useState('');
  const transparentFade = isTransparentFeatherFade(featherFadeEnabled, featherFadeColor);
  useEffect(() => {
    const src = String(screenshot || '');
    const solidFill = transparentFade
      ? ''
      : (featherFadeColor === 'black' ? '#000000' : '#ffffff');
    if (!src || !(visW > 1) || !(visH > 1)) {
      setPng('');
      return undefined;
    }
    let cancelled = false;

    const rasterize = (flattenFill) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        try {
          const w = Math.max(1, Math.round(visW));
          const h = Math.max(1, Math.round(visH));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { alpha: true });
          if (!ctx) {
            setPng('');
            return;
          }
          ctx.clearRect(0, 0, w, h);
          if (flattenFill) {
            ctx.fillStyle = flattenFill;
            ctx.fillRect(0, 0, w, h);
          }
          ctx.globalAlpha = imageOpacityCss(imageOpacity);
          if (blackAndWhite) ctx.filter = blackAndWhiteCssFilter(true, bwIntensity);
          const iw = img.naturalWidth || img.width;
          const ih = img.naturalHeight || img.height;
          if (layout && Number(layout.width) > 0 && Number(layout.height) > 0) {
            ctx.drawImage(
              img,
              0,
              0,
              iw,
              ih,
              (Number(layout.left) || 0) - (Number(vis?.left) || 0),
              (Number(layout.top) || 0) - (Number(vis?.top) || 0),
              Number(layout.width) || w,
              Number(layout.height) || h
            );
          } else if (iw > 0 && ih > 0) {
            const cover = objectFit !== 'contain';
            const scale = cover
              ? Math.max(w / iw, h / ih)
              : Math.min(w / iw, h / ih);
            const dw = iw * scale;
            const dh = ih * scale;
            const dx = (w - dw) * (Math.max(0, Math.min(100, Number(posX) || 50)) / 100);
            const dy = (h - dh) * (Math.max(0, Math.min(100, Number(posY) || 50)) / 100);
            ctx.drawImage(img, dx, dy, dw, dh);
          }
          ctx.filter = 'none';
          ctx.globalAlpha = 1;
          const processed = applyRadiusFeatherFade(canvas, {
            cornerRadius,
            featherEdge,
            featherFadeEnabled: false,
            featherFadeColor: 'transparent',
          });
          const pctx = processed.getContext('2d', { alpha: true });
          if (flattenFill) {
            flattenCanvasFeatherToColor(pctx, processed, flattenFill);
          } else if (transparentFade) {
            if (!cancelled) setPng('');
            return;
          }
          if (cancelled) return;
          setPng(processed.toDataURL('image/png'));
        } catch {
          if (!cancelled) setPng('');
        }
      };
      img.onerror = () => {
        if (!cancelled) setPng('');
      };
      img.src = src;
    };

    const hinted = String(shirtFillColor || '').trim();
    if (!transparentFade) {
      rasterize(solidFill);
      return () => {
        cancelled = true;
      };
    }
    if (hinted && hinted !== 'transparent' && hinted !== 'black' && hinted !== '#000' && hinted !== '#000000') {
      rasterize(hinted);
      return () => {
        cancelled = true;
      };
    }
    const mockup = String(mockupSrc || '');
    if (!mockup) {
      rasterize('');
      return () => {
        cancelled = true;
      };
    }
    const mockImg = new Image();
    mockImg.onload = () => {
      if (cancelled) return;
      const sampled = sampleShirtFillFromMockup(mockImg, productName);
      rasterize(sampled || '');
    };
    mockImg.onerror = () => {
      if (!cancelled) rasterize('');
    };
    mockImg.src = mockup;
    return () => {
      cancelled = true;
    };
  }, [
    screenshot,
    visW,
    visH,
    vis?.left,
    vis?.top,
    layout?.left,
    layout?.top,
    layout?.width,
    layout?.height,
    cornerRadius,
    featherEdge,
    transparentFade,
    featherFadeColor,
    shirtFillColor,
    mockupSrc,
    productName,
    blackAndWhite,
    bwIntensity,
    imageOpacity,
    posX,
    posY,
    objectFit,
  ]);
  if (!png) return null;
  return (
    <img
      src={png}
      alt=""
      decoding="async"
      draggable={false}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    />
  );
}

function exportPreviewDataUrl(sourceCanvas, { keepAlpha = false } = {}) {
  if (!sourceCanvas || !(sourceCanvas.width > 0) || !(sourceCanvas.height > 0)) return '';
  const scale = Math.min(1, BAKE_EXPORT_MAX / Math.max(sourceCanvas.width, sourceCanvas.height, 1));
  let out = sourceCanvas;
  if (scale < 1) {
    out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    out.height = Math.max(1, Math.round(sourceCanvas.height * scale));
    const octx = out.getContext('2d', { alpha: true });
    if (!octx) return '';
    octx.clearRect(0, 0, out.width, out.height);
    octx.drawImage(sourceCanvas, 0, 0, out.width, out.height);
  }
  try {
    if (keepAlpha) return out.toDataURL('image/png');
    return out.toDataURL('image/jpeg', 0.82);
  } catch {
    try {
      return out.toDataURL('image/png');
    } catch {
      return '';
    }
  }
}

/**
 * Scale canvas frameWidth (source pixels) onto the visible print box.
 */
function overlayFramePx(frameWidth, overlayW, overlayH, sourceW, sourceH) {
  const overlayMin = Math.min(overlayW, overlayH);
  if (!(frameWidth > 0) || !(overlayMin > 0)) return 0;
  const sourceMin = Math.min(sourceW, sourceH);
  const scale = sourceMin > 0 ? overlayMin / sourceMin : overlayMin / 800;
  return Math.max(2, frameWidth * scale);
}

/** Region of the image that object-fit:cover shows in a print box of this aspect. */
function coverVisibleRect(imgW, imgH, boxAspect, alignY = 'center') {
  const w = Number(imgW) || 0;
  const h = Number(imgH) || 0;
  const aspect = Number(boxAspect) || 0;
  if (!(w > 0 && h > 0)) return { x: 0, y: 0, w, h };
  if (!(aspect > 0)) return { x: 0, y: 0, w, h };
  const imgAspect = w / h;
  if (Math.abs(imgAspect - aspect) < 0.002) return { x: 0, y: 0, w, h };
  if (imgAspect > aspect) {
    const visW = h * aspect;
    return { x: (w - visW) / 2, y: 0, w: visW, h };
  }
  const visH = w / aspect;
  const maxY = Math.max(0, h - visH);
  let y;
  if (typeof alignY === 'number') {
    y = (Math.max(0, Math.min(100, alignY)) / 100) * maxY;
  } else if (alignY === 'top') {
    y = 0;
  } else {
    y = maxY / 2;
  }
  return { x: 0, y, w, h: visH };
}

function normalizeFrameHex(value, fallback = '#FF0000') {
  const raw = String(value || '').trim();
  const six = raw.match(/^#([0-9A-Fa-f]{6})$/);
  if (six) return `#${six[1]}`;
  const three = raw.match(/^#([0-9A-Fa-f]{3})$/);
  if (!three) return fallback;
  const [a, b, c] = three[1];
  return `#${a}${a}${b}${b}${c}${c}`;
}

function resolveInnerFrameColor(inner, outer) {
  const outerColor = normalizeFrameHex(outer, '#FF0000');
  return normalizeFrameHex(inner, outerColor);
}

function paintFrameRings(ctx, vis, {
  frameWidth,
  frameColor,
  innerFrameColor,
  doubleFrame,
  cornerRadiusPercent,
  addRoundedRectPath,
}) {
  const x = vis.x;
  const y = vis.y;
  const w = vis.w;
  const h = vis.h;
  const outer = Math.max(1, Number(frameWidth) || 0);
  if (!(w > 2 && h > 2) || !(outer > 0) || !ctx) return;
  const maxR = Math.min(w, h) / 2;
  const isCircle = cornerRadiusPercent >= 100;
  const cornerR = isCircle ? maxR : Math.round(((Number(cornerRadiusPercent) || 0) / 100) * maxR);

  const paintRing = (inset, thickness, ringOuterRadius, color) => {
    const ow = w - inset * 2;
    const oh = h - inset * 2;
    if (ow < 2 || oh < 2 || !(thickness > 0)) return;
    const ox = x + inset;
    const oy = y + inset;
    const inner = inset + thickness;
    const iw = w - inner * 2;
    const ih = h - inner * 2;
    const maxOuterR = Math.min(ow, oh) / 2;
    const outerR = Math.min(Math.max(0, ringOuterRadius), maxOuterR);
    const maxHoleR = Math.min(Math.max(0, iw), Math.max(0, ih)) / 2;
    const innerR = Math.min(Math.max(0, outerR - thickness), maxHoleR);
    ctx.fillStyle = color || '#FF0000';
    if (isCircle) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0, maxR - inset), 0, Math.PI * 2);
      ctx.arc(cx, cy, Math.max(0, maxR - inner), 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      return;
    }
    if (outerR > 0 && typeof addRoundedRectPath === 'function') {
      ctx.beginPath();
      addRoundedRectPath(ctx, ox, oy, ow, oh, outerR);
      if (iw > 1 && ih > 1) {
        addRoundedRectPath(ctx, ox + thickness, oy + thickness, iw, ih, innerR);
      }
      ctx.fill('evenodd');
      return;
    }
    ctx.fillRect(ox, oy, ow, thickness);
    ctx.fillRect(ox, oy, thickness, oh);
    ctx.fillRect(ox + ow - thickness, oy, thickness, oh);
    ctx.fillRect(ox, oy + oh - thickness, ow, thickness);
  };

  paintRing(0, outer, cornerR, frameColor || '#FF0000');
  if (doubleFrame) {
    const { innerFrameWidth, innerOuter } = doubleFrameSpacing(outer);
    paintRing(
      innerOuter,
      innerFrameWidth,
      Math.max(0, cornerR - innerOuter),
      resolveInnerFrameColor(innerFrameColor, frameColor)
    );
  }
}

/** Chest print box on the mockup photo (not geometric 50/50 of the PNG). */
function apparelOverlayPlacement(productName, detected) {
  const box = resolveApparelPrintBox(productName, detected);
  if (box && box.top != null) {
    return { top: box.top, left: box.left ?? 50, topShift: Number(box.topShift) || 0 };
  }
  const n = String(productName || '').toLowerCase();
  if (n.includes('hat') || n.includes('cap')) return { top: 42, left: 50, topShift: 0 };
  if (n.includes('hoodie') || n.includes('sweatshirt')) return { top: 52, left: 50, topShift: 0 };
  if (n.includes('tank')) return { top: 44.8, left: 50.2, topShift: 0 };
  if (n.includes('women')) return { top: 43.0, left: 50.7, topShift: 0 };
  if (n.includes('baby') || n.includes('toddler')) return { top: 48, left: 50, topShift: 0 };
  if (n.includes('kids') || n.includes('youth')) return { top: 46.8, left: 50.2, topShift: 0 };
  return { top: 43.8, left: 50.35, topShift: 0 };
}

// Sync Product Specific fit before first paint when a cart item is already known
// (order_id path sets this after fetch; cart Tools used to wait on effects).
function shotFingerprint(url) {
  const s = String(url || '');
  if (!s) return '';
  return `${s.length}:${s.slice(0, 40)}:${s.slice(-40)}`;
}

function cartIdentity(products) {
  return (products || [])
    .map((p) => `${p.originalCartIndex}|${p.name}|${shotFingerprint(p.productImage)}|${shotFingerprint(p.screenshot)}`)
    .join(';');
}

function getInitialCartPrintFit() {
  if (typeof window === 'undefined') return { name: '', fit: 'none', index: null };
  try {
    const q = window.location.search;
    if (q && new URLSearchParams(q).get('order_id')) {
      return { name: '', fit: 'none', index: null };
    }
    const items = readCartItems();
    if (!Array.isArray(items) || items.length === 0) {
      return { name: '', fit: 'none', index: null };
    }

    const withShots = items
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => item && item.screenshot && String(item.screenshot).trim() !== '');
    if (!withShots.length) return { name: '', fit: 'none', index: null };

    let chosen = withShots[withShots.length - 1];
    if (!peekToolsPreviewNewest()) {
      const focusOriginal = peekToolsFocusCartIndex();
      if (focusOriginal != null) {
        const matched = withShots.find((p) => p.originalIndex === focusOriginal);
        if (matched) chosen = matched;
      }
    }
    const name = matchPrintAreaProductName(chosen.item.name) || '';
    const index = Math.max(0, withShots.indexOf(chosen));
    return { name, fit: name ? 'product' : 'none', index };
  } catch {
    return { name: '', fit: 'none', index: null };
  }
}

const EDITOR_SLOT_DEFAULTS = {
  featherEdge: 0,
  cornerRadius: 0,
  featherFadeEnabled: false,
  featherFadeColor: 'white',
  frameEnabled: false,
  frameColor: '#FF0000',
  frameWidth: 10,
  doubleFrame: false,
  innerFrameColor: '#FF0000',
  blackAndWhite: false,
  bwIntensity: BW_INTENSITY_DEFAULT,
  imageOpacity: IMAGE_OPACITY_DEFAULT,
  textEnabled: false,
  textContent: '',
  textFont: 'Arial',
  textColor: '#000000',
  textSize: 24,
  textOffsetX: 50,
  textOffsetY: 50,
  textDirection: 'horizontal',
  imageOffsetX: 0,
  imageOffsetY: 0,
  screenshotScale: 100,
};

function normalizeTextDirection(value) {
  return String(value || '').toLowerCase() === 'vertical' ? 'vertical' : 'horizontal';
}

function drawOverlayText(ctx, {
  text,
  fontFamily,
  color,
  fontSize,
  centerX,
  centerY,
  direction,
}) {
  ctx.save();
  ctx.font = `${fontSize}px "${fontFamily}", Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = String(text).trim().split('\n');
  const lineHeight = fontSize * 1.2;
  if (direction === 'vertical') {
    const colWidth = fontSize * 1.15;
    const startX = centerX - (lines.length - 1) * colWidth / 2;
    lines.forEach((line, col) => {
      const chars = Array.from(line);
      if (!chars.length) return;
      const startY = centerY - (chars.length - 1) * lineHeight / 2;
      chars.forEach((ch, i) => {
        ctx.fillText(ch, startX + col * colWidth, startY + i * lineHeight);
      });
    });
  } else {
    const startY = centerY - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, centerX, startY + i * lineHeight);
    });
  }
  ctx.restore();
}

function overlayTextFontPx(textSize, width, height) {
  const minDim = Math.min(Number(width) || 0, Number(height) || 0);
  if (!(minDim > 0)) return 12;
  return Math.max(8, Math.min(120, Math.round((Number(textSize) || 24) / 100 * minDim * 0.22)));
}

function ToolsLiveText({
  enabled,
  content,
  font,
  color,
  size,
  offsetX = 50,
  offsetY = 50,
  direction,
  boxWidth,
  boxHeight,
}) {
  const text = String(content || '').trim();
  if (!enabled || !text || !(boxWidth > 0) || !(boxHeight > 0)) return null;
  const vertical = normalizeTextDirection(direction) === 'vertical';
  const fontSize = overlayTextFontPx(size, boxWidth, boxHeight);
  const lines = text.split('\n');
  return (
    <div
      aria-hidden="true"
      className={`tools-live-text${vertical ? ' is-vertical' : ''}`}
      style={{
        position: 'absolute',
        left: `${Number(offsetX) || 0}%`,
        top: `${Number(offsetY) || 0}%`,
        transform: 'translate(-50%, -50%)',
        color: color || '#000000',
        fontFamily: `"${font || 'Arial'}", Arial, sans-serif`,
        fontSize: `${fontSize}px`,
        fontWeight: 'bold',
        lineHeight: 1.2,
        textAlign: 'center',
        whiteSpace: vertical ? 'normal' : 'pre',
        pointerEvents: 'none',
        display: vertical ? 'flex' : 'block',
        flexDirection: vertical ? 'row' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: vertical ? '0.15em' : undefined,
        zIndex: 4,
      }}
    >
      {vertical
        ? lines.map((line, col) => (
            <span
              key={col}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2 }}
            >
              {(line ? Array.from(line) : [' ']).map((ch, i) => (
                <span key={i}>{ch}</span>
              ))}
            </span>
          ))
        : text}
    </div>
  );
}

function editorSlotFromCartItem(item) {
  if (!item || typeof item !== 'object') return null;
  const s = item.toolSettings;
  const ori = (s && s.imageOrientation) || item.imageOrientation || '';
  const hasSettings = s && typeof s === 'object';
  if (!hasSettings && ori !== 'landscape' && ori !== 'portrait') return null;
  return {
    ...EDITOR_SLOT_DEFAULTS,
    ...(hasSettings ? s : {}),
    imageOrientation: ori === 'landscape' ? 'landscape' : (ori === 'portrait' ? 'portrait' : (hasSettings ? s.imageOrientation : 'portrait')),
    offsetX: hasSettings && typeof s.offsetX === 'number' ? s.offsetX : 0,
    offsetY: hasSettings && typeof s.offsetY === 'number' ? s.offsetY : 0,
    sourceScreenshot: slotSourceKey(
      item.originalScreenshot || item.screenshot || item.selected_screenshot || ''
    ),
    fitUserSet: true,
  };
}

function parseToolsPageState(raw) {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    return state && typeof state === 'object' ? state : null;
  } catch {
    return null;
  }
}

function readToolsPageState() {
  try {
    const fromSession = parseToolsPageState(sessionStorage.getItem('tools_page_state'));
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    const fromLocal = parseToolsPageState(localStorage.getItem('tools_page_state'));
    if (fromLocal) return fromLocal;
  } catch {
    /* ignore */
  }
  return {};
}

function writeToolsPageState(patch) {
  const next = { ...readToolsPageState(), ...patch };
  const json = JSON.stringify(next);
  try {
    sessionStorage.setItem('tools_page_state', json);
  } catch {
    /* quota / private mode */
  }
  try {
    localStorage.setItem('tools_page_state', json);
  } catch {
    /* quota / private mode */
  }
}

function readEditorSlots() {
  const slots = readToolsPageState().editorSlots;
  return slots && typeof slots === 'object' ? slots : {};
}

function writeEditorSlots(slots) {
  writeToolsPageState({ editorSlots: slots && typeof slots === 'object' ? slots : {} });
}

function hydrateSlotsFromCart(slots) {
  const next = { ...(slots && typeof slots === 'object' ? slots : {}) };
  try {
    const cartNow = readCartItems({ ignoreMemory: true }) || [];
    cartNow.forEach((item, i) => {
      const fromCart = editorSlotFromCartItem(item);
      if (!fromCart) return;
      const shot = item.originalScreenshot || item.screenshot || item.selected_screenshot || '';
      if (!savedMatchesSourcePreview(next[i], shot, shot)) {
        next[i] = fromCart;
      }
    });
  } catch {
    /* ignore */
  }
  return next;
}

function screenshotMatchKeys(url) {
  const raw = String(url || '');
  if (!raw) return [];
  const key = slotSourceKey(raw);
  const finger = shotFingerprint(raw);
  return [raw, key, finger].filter(Boolean);
}

function savedMatchesSourcePreview(saved, screenshot, screenshotFromCart) {
  if (!saved) return false;
  if (!saved.sourceScreenshot) return true;
  const keys = new Set([
    ...screenshotMatchKeys(screenshot),
    ...screenshotMatchKeys(screenshotFromCart),
  ]);
  return keys.has(saved.sourceScreenshot);
}

function slotMatchesCartShot(slot, product) {
  if (!slot?.sourceScreenshot || !product) return false;
  return savedMatchesSourcePreview(
    slot,
    product.originalScreenshot || product.screenshot || '',
    product.screenshot || product.selected_screenshot || ''
  );
}

function slotSourceKey(url) {
  const raw = String(url || '');
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.length > 400) return shotFingerprint(raw);
  return raw;
}

function getInitialEditorSlot() {
  if (typeof window === 'undefined') return null;
  try {
    const q = window.location.search;
    if (q && new URLSearchParams(q).get('order_id')) return null;
    const { index } = getInitialCartPrintFit();
    if (index == null || index < 0) return null;
    const slots = readEditorSlots();
    return slots[index] || slots[String(index)] || null;
  } catch {
    return null;
  }
}

/** 300 DPI print-box pixels for the current product / orientation / scale. */
function printTargetPixels(productName, productSize, orientation, printAreaFit, screenshotScale = 100) {
  const name = matchPrintAreaProductName(productName) || String(productName || '').trim();
  const dims = getPrintAreaDimensions(name, productSize, 'front');
  let wIn = dims?.width > 0 ? dims.width : 11.5;
  let hIn = dims?.height > 0 ? dims.height : 13.8;
  if (printAreaFit === 'horizontal') {
    hIn = wIn / 1.5;
  } else if (printAreaFit === 'square') {
    hIn = wIn;
  } else if (printAreaFit === 'vertical') {
    wIn = hIn * (2 / 3);
  } else if (orientation === 'landscape') {
    const sized = overlaySizeForOrientation(wIn, hIn, 'landscape', name);
    wIn = sized.width;
    hIn = sized.height;
  }
  return {
    width: Math.round(wIn * 300),
    height: Math.round(hIn * 300),
  };
}

function ToolsEditLogCard({ log, previewSrc }) {
  const lines = formatEditLogLines(log);
  if (!editLogHasEntries(log) && !previewSrc) return null;
  const copyText = formatEditLogPlainText(log);
  const onCopy = () => {
    if (!copyText || !navigator.clipboard) return;
    navigator.clipboard.writeText(copyText).catch(() => {});
  };
  return (
    <div className="tools-edit-log-card">
      <h4 className="tools-edit-log-title">Edit log</h4>
      <p className="tools-edit-log-hint">
        Generate the 300 DPI image from the original first, then replicate these values.
      </p>
      {previewSrc ? (
        <img src={previewSrc} alt="Edited screenshot" className="tools-edit-log-preview" />
      ) : null}
      {lines.length > 0 ? (
        <dl className="tools-edit-log-list">
          {lines.map((row) => (
            <div key={row.label} className="tools-edit-log-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="tools-edit-log-empty">No edits yet.</p>
      )}
      {copyText ? (
        <button type="button" className="tools-edit-log-copy" onClick={onCopy}>
          Copy log
        </button>
      ) : null}
    </div>
  );
}

/** Aspect of the visible print box so Screenshot Preview matches Product Preview. */
function printBoxPreviewAspect(productName, productSize, orientation, printAreaFit, overlayW = 0, overlayH = 0) {
  if (overlayW > 0 && overlayH > 0) return overlayW / overlayH;
  if (printAreaFit === 'horizontal') return 1.5;
  if (printAreaFit === 'square') return 1;
  if (printAreaFit === 'vertical') return 2 / 3;

  const name = matchPrintAreaProductName(productName) || String(productName || '').trim();
  const dims = getPrintAreaDimensions(name, productSize, 'front');
  const width = dims?.width > 0 ? dims.width : 11.5;
  const height = dims?.height > 0 ? dims.height : 13.8;

  if (orientation === 'landscape') {
    const sized = overlaySizeForOrientation(width, height, 'landscape', name);
    if (sized.width > 0 && sized.height > 0) return sized.width / sized.height;
    return 1.5;
  }
  return width / height;
}

// Component for product preview with draggable screenshot
const ProductPreviewWithDrag = ({ 
  productImage, 
  fallbackMockupUrl = '',
  screenshot, 
  productName, 
  productSize,
  offsetX, 
  offsetY, 
  onOffsetChange,
  textEnabled,
  textContent = '',
  textFont = 'Arial',
  textColor = '#000000',
  textSize = 24,
  textOffsetX = 50,
  textOffsetY = 50,
  textDirection = 'horizontal',
  onTextPositionChange,
  featherEdge,
  cornerRadius,
  frameEnabled = false,
  frameColor = '#FF0000',
  frameWidth = 10,
  doubleFrame = false,
  innerFrameColor = '',
  sourceWidth = 0,
  sourceHeight = 0,
  printAreaFit,
  selectedProductName,
  screenshotScale = 100,
  imageOffsetX = 0,
  imageOffsetY = 0,
  imageOrientation = 'portrait',
  blackAndWhite = false,
  bwIntensity = BW_INTENSITY_DEFAULT,
  imageOpacity = IMAGE_OPACITY_DEFAULT,
  featherFadeEnabled = false,
  featherFadeColor = 'white',
  onOverlayBoxChange,
  onShirtFillChange,
  litePreview = false,
  shirtFillHint = '',
  garmentTintColor = '',
}) => {
  const containerRef = useRef(null);
  const productImageRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const lastDragPositionRef = useRef({ x: 0, y: 0 });
  const currentDragPositionRef = useRef({ x: 0, y: 0 }); // Track current position for snapping
  const dragStartTextPositionRef = useRef({ x: 50, y: 50 }); // When text drag starts, store text %
  const totalDragDeltaRef = useRef({ x: 0, y: 0 }); // Accumulated pixel delta during text drag
  const textDragMode = false;
  const [screenshotDisplaySize, setScreenshotDisplaySize] = useState({ width: 0, height: 0 });
  const [productImageSize, setProductImageSize] = useState({ width: 0, height: 0 });
  const [detectedPrintBox, setDetectedPrintBox] = useState(null);
  const [shirtFillColor, setShirtFillColor] = useState(() => String(garmentTintColor || shirtFillHint || ''));
  const [tintedMockupSrc, setTintedMockupSrc] = useState('');
  const [mockupSrc, setMockupSrc] = useState(productImage);
  const [overlayNaturalSize, setOverlayNaturalSize] = useState({ width: 0, height: 0 });
  const overlayFitKeyRef = useRef('');
  const liteSizeLockedRef = useRef(false);

  useEffect(() => {
    setMockupSrc(productImage);
  }, [productImage]);

  useEffect(() => {
    const tint = String(garmentTintColor || '').trim();
    if (tint) {
      setShirtFillColor(tint);
      return;
    }
    const hint = String(shirtFillHint || '');
    if (!hint) return;
    setShirtFillColor((prev) => prev || hint);
  }, [shirtFillHint, garmentTintColor]);

  useEffect(() => {
    const tint = String(garmentTintColor || '').trim();
    const src = String(productImage || '').trim();
    if (!tint || !src) {
      setTintedMockupSrc('');
      return undefined;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const next = tintMockupCanvas(img, tint);
        if (!cancelled) setTintedMockupSrc(next || '');
      } catch {
        if (!cancelled) setTintedMockupSrc('');
      }
    };
    img.onerror = () => {
      if (!cancelled) setTintedMockupSrc('');
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [garmentTintColor, productImage]);

  const clampFrameOffset = (x, y) => {
    const placeName = selectedProductName || productName;
    const printBox = overlaySizeForOrientation(
      screenshotDisplaySize.width,
      screenshotDisplaySize.height,
      imageOrientation,
      placeName
    );
    if (!(printBox.width > 0 && printBox.height > 0 && screenshotDisplaySize.width > 0 && screenshotDisplaySize.height > 0)) {
      return { x: 0, y: 0 };
    }
    // Portrait overlay is grown ~5% to hide the painted box. Clamp landscape
    // to that un-grown rectangle so the frame stays inside the print area.
    const coverScale = printBoxCoverScale(placeName);
    const visualPrintH = coverScale > 1
      ? screenshotDisplaySize.height / coverScale
      : screenshotDisplaySize.height;
    return clampOverlayOffsetToPrintArea({
      offsetY: y,
      rightShift: printBox.rightShift || 0,
      overlayH: printBox.height,
      printH: visualPrintH,
    });
  };

  useEffect(() => {
    if (sourceWidth > 0 && sourceHeight > 0) {
      setOverlayNaturalSize((prev) => (
        prev.width === sourceWidth && prev.height === sourceHeight
          ? prev
          : { width: sourceWidth, height: sourceHeight }
      ));
      return undefined;
    }
    const src = String(screenshot || '');
    if (!src) {
      setOverlayNaturalSize((prev) => (prev.width || prev.height ? { width: 0, height: 0 } : prev));
      return undefined;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth || 0;
      const h = img.naturalHeight || 0;
      if (!(w > 0 && h > 0)) return;
      setOverlayNaturalSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [screenshot, sourceWidth, sourceHeight]);

  // Calculate screenshot display size based on product print area
  useLayoutEffect(() => {
    // Use selectedProductName if available and printAreaFit is 'product', otherwise use productName
    const effectiveProductName = (printAreaFit === 'product' && selectedProductName) ? selectedProductName : productName;
    
    if (!effectiveProductName) return;

    const calculateSize = () => {
      const hasProductImage = productImageSize.width > 0 && productImageSize.height > 0;
      let displayedProductWidth = productImageSize.width;
      let displayedProductHeight = productImageSize.height;
      const stageW = containerRef.current
        ? containerRef.current.getBoundingClientRect().width
        : 0;

      // Before the mockup reports a painted rect, size from the stage width
      // (img is width:100%). Same print-area math — not a 400×400 guess.
      if (!hasProductImage && stageW >= 2) {
        displayedProductWidth = stageW;
        const img = productImageRef.current;
        if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
          displayedProductHeight = stageW * (img.naturalHeight / img.naturalWidth);
        }
      }

      // A late measure can pick up the file's intrinsic box before CSS
      // max-width applies, which makes the overlay jump larger than the print area.
      if (stageW >= 2 && displayedProductWidth > stageW + 1) {
        const aspect = displayedProductHeight > 0
          ? displayedProductHeight / displayedProductWidth
          : 0;
        displayedProductWidth = stageW;
        if (aspect > 0) displayedProductHeight = stageW * aspect;
      }

      // Mockup height can lag width. Infer it so we never leave a skinny
      // 150×150 contain strip on screen.
      if (displayedProductWidth >= 2 && displayedProductHeight < 2) {
        const img = productImageRef.current;
        if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
          displayedProductHeight = displayedProductWidth * (img.naturalHeight / img.naturalWidth);
        } else {
          displayedProductHeight = displayedProductWidth * 1.25;
        }
      }

      const commitOverlaySize = (width, height) => {
        overlayFitKeyRef.current = `${effectiveProductName}|${productSize || ''}`;
        setScreenshotDisplaySize((prev) => {
          if (Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5) {
            return prev;
          }
          return { width, height };
        });
      };

      try {
        // Get print area dimensions for this product
        const printDimensions = getPrintAreaDimensions(effectiveProductName, productSize || null, 'front');
        
        if (DEBUG_OVERLAY_SIZE) {
        console.log(`🔍 [SIZE_CALC] Product: "${effectiveProductName}" (from ${printAreaFit === 'product' && selectedProductName ? 'dropdown' : 'cart'}), Size: "${productSize || 'default'}", Print Area:`, printDimensions);
        }
        
        // Wait for the painted mockup. A 400×400 fallback sizes the overlay
        // as if the photo were huge, which sticks on phones when layout is late.
        if (printDimensions && displayedProductWidth > 0) {
          // Calculate size based on print area dimensions and product image size
          // Direct mapping: print area inches → percentage of product image
          // This ensures consistent sizing across all product types
          
          // Calculate print area aspect ratio (must maintain this)
          const printAspectRatio = printDimensions.width / printDimensions.height;
          
          // Estimate typical product width in inches for scaling reference
          // This helps convert print area inches to a percentage of product image
          const productNameLower = effectiveProductName.toLowerCase();
          const isCroppedHoodie = productNameLower.includes('cropped') && productNameLower.includes('hoodie');
          
          // Check if this is a square product (aspect ratio very close to 1.0)
          // Cropped Hoodie has 10x10 print area, so it's square
          const isSquare = Math.abs(printAspectRatio - 1.0) < 0.01 || isCroppedHoodie;
          
          // Check for hats first (they have much smaller print areas)
          const isHat = productNameLower.includes('hat') || productNameLower.includes('cap');
          
          // Check if this is a shirt (women's, men's, or kids) for optimized sizing
          const isShirt = productNameLower.includes('shirt') || productNameLower.includes('tee');
          const isWomensShirt = productNameLower.includes("women") && isShirt;
          const isMensShirt = productNameLower.includes("men") && isShirt;
          const isKidsShirt = productNameLower.includes("kids") && isShirt;
          
          // Direct mapping: print area width in inches → percentage of product image width
          // Print areas typically range from 5" (hats) to 15" (large shirts) wide
          // For hats, use a different calculation since they're much smaller
          let minPercent, maxPercent;
          
          if (isHat) {
            if (getApparelPrintOverride(effectiveProductName)) {
              const sized = sizeApparelPrintOverlay(
                printDimensions.width,
                printDimensions.height,
                displayedProductWidth,
                displayedProductHeight,
                effectiveProductName,
                detectedPrintBox
              );
              commitOverlaySize(sized.width, sized.height);
              if (DEBUG_OVERLAY_SIZE) console.log(`📐 [PRINT_AREA] ${effectiveProductName} (${productSize || 'default'}): Print ${printDimensions.width}"x${printDimensions.height}" → ${sized.width.toFixed(0)}x${sized.height.toFixed(0)}px [hat front]`);
              return;
            }
            // Fallback when a hat has no Printful-front override (legacy crop).
            minPercent = 0.60;
            maxPercent = 0.75;
            const hatPrintWidth = printDimensions.width;
            const widthPercent = hatPrintWidth <= 5 ? 0.60 : 0.60 + ((hatPrintWidth - 5) / 0.5) * (0.75 - 0.60);
            
            // Calculate base width from product image
            let finalWidth = displayedProductWidth * widthPercent;
            
            // Calculate height to maintain print area aspect ratio
            let finalHeight = finalWidth / printAspectRatio;
            
            // Set bounds for hats (can be larger percentage since print area is on front panel)
            const maxWidth = displayedProductWidth * 0.80;
            const maxHeight = displayedProductHeight > 0 ? displayedProductHeight * 0.50 : Number.POSITIVE_INFINITY; // Hats are taller, print area is on front panel
            
            if (finalWidth > maxWidth) {
              finalWidth = maxWidth;
              finalHeight = finalWidth / printAspectRatio;
            }
            if (finalHeight > maxHeight) {
              finalHeight = maxHeight;
              finalWidth = finalHeight * printAspectRatio;
            }
            
            // Ensure minimum size for visibility
            const minWidth = displayedProductWidth * 0.40;
            const minHeight = displayedProductHeight > 0 ? displayedProductHeight * 0.20 : 0;
            
            if (finalWidth < minWidth) {
              finalWidth = minWidth;
              finalHeight = finalWidth / printAspectRatio;
            }
            if (finalHeight < minHeight) {
              finalHeight = minHeight;
              finalWidth = finalHeight * printAspectRatio;
            }
            
            commitOverlaySize(finalWidth, finalHeight);
            
            if (DEBUG_OVERLAY_SIZE) console.log(`📐 [PRINT_AREA] ${effectiveProductName} (${productSize || 'default'}): Print ${printDimensions.width}"x${printDimensions.height}" (AR: ${printAspectRatio.toFixed(2)}) → ${finalWidth.toFixed(0)}x${finalHeight.toFixed(0)}px (${(finalWidth/displayedProductWidth*100).toFixed(1)}% x ${(finalHeight/displayedProductHeight*100).toFixed(1)}% of product)`);
            return; // Exit early for hats
          }

          // Apparel: size the overlay to this product's print W×H on the mockup.
          if (isApparelChestPrintProduct(effectiveProductName)) {
            const sized = sizeApparelPrintOverlay(
              printDimensions.width,
              printDimensions.height,
              displayedProductWidth,
              displayedProductHeight,
              effectiveProductName,
              detectedPrintBox
            );
            commitOverlaySize(sized.width, sized.height);

            if (DEBUG_OVERLAY_SIZE) console.log(`📐 [PRINT_AREA] ${effectiveProductName} (${productSize || 'default'}): Print ${printDimensions.width}"x${printDimensions.height}" (AR: ${printAspectRatio.toFixed(2)}) → ${sized.width.toFixed(0)}x${sized.height.toFixed(0)}px (${(sized.width/displayedProductWidth*100).toFixed(1)}% x ${(sized.height/displayedProductHeight*100).toFixed(1)}% of product) [apparel chest]`);
            return;
          }
          
          // For non-hat products, calculate size to ensure full print area coverage
          // Calculate based on print area dimensions to ensure even coverage
          const printWidthInches = printDimensions.width;
          const printHeightInches = printDimensions.height;
          
          // Estimate product dimensions in inches for scaling
          // Typical product widths: kids ~14", womens/mens ~18-20", hoodies ~20"
          let typicalProductWidthInches = 18;
          
          if (productNameLower.includes('kids') || productNameLower.includes('youth')) {
            typicalProductWidthInches = 14;
          } else if (productNameLower.includes('hoodie')) {
            typicalProductWidthInches = 20;
          } else if (productNameLower.includes('tank')) {
            typicalProductWidthInches = 17;
          }
          
          // Map configured print inches onto the mockup. Height comes only from
          // the print-area aspect (width x height in printAreaConfig) — do not
          // also scale from mockup photo height or the overlay becomes too tall.
          const printWidthPercent = printWidthInches / typicalProductWidthInches;
          let finalWidth = displayedProductWidth * printWidthPercent;
          let finalHeight = finalWidth / printAspectRatio;
          
          // For square products, ensure width and height are always equal
          if (isSquare) {
            // Use the larger of width or height to ensure full coverage, then make square
            const baseSize = displayedProductHeight > 0
              ? Math.min(displayedProductWidth, displayedProductHeight)
              : displayedProductWidth;
            const squareSize = Math.max(finalWidth, finalHeight);
            // Use the larger dimension to ensure coverage, but don't exceed product bounds
            finalWidth = Math.min(squareSize, baseSize * 0.75);
            finalHeight = finalWidth; // Force square
            
            // Apply square-specific bounds (use same percentage for both dimensions)
            const maxPercent = isShirt ? 0.75 : 0.70;
            const minPercent = 0.35;
            const maxSize = baseSize * maxPercent;
            const minSize = baseSize * minPercent;
            
            if (finalWidth > maxSize) {
              finalWidth = maxSize;
              finalHeight = maxSize; // Keep square
            }
            if (finalWidth < minSize) {
              finalWidth = minSize;
              finalHeight = minSize; // Keep square
            }
          } else {
            // For non-square products, apply reasonable maximum bounds
            // But prioritize coverage - if print area requires larger size, allow it
            const maxWidth = displayedProductWidth * 0.80; // Allow up to 80% of product width
            const maxHeight = displayedProductHeight > 0 ? displayedProductHeight * 0.80 : Number.POSITIVE_INFINITY;
            
            // Only clamp if we exceed maximum, but maintain aspect ratio
            if (finalWidth > maxWidth) {
              finalWidth = maxWidth;
              finalHeight = finalWidth / printAspectRatio;
              // If height still exceeds, recalculate from height
              if (finalHeight > maxHeight) {
                finalHeight = maxHeight;
                finalWidth = finalHeight * printAspectRatio;
              }
            } else if (finalHeight > maxHeight) {
              finalHeight = maxHeight;
              finalWidth = finalHeight * printAspectRatio;
              // If width still exceeds, recalculate from width
              if (finalWidth > maxWidth) {
                finalWidth = maxWidth;
                finalHeight = finalWidth / printAspectRatio;
              }
            }
            
            // Ensure minimum size for visibility (at least 30% width, 25% height)
            // But don't override if we need larger for print area coverage
            const minWidth = displayedProductWidth * 0.30;
            
            if (finalWidth < minWidth) {
              finalWidth = minWidth;
              finalHeight = finalWidth / printAspectRatio;
            }
          }
          
          commitOverlaySize(finalWidth, finalHeight);
          
          if (DEBUG_OVERLAY_SIZE) console.log(`📐 [PRINT_AREA] ${effectiveProductName} (${productSize || 'default'}): Print ${printDimensions.width}"x${printDimensions.height}" (AR: ${printAspectRatio.toFixed(2)}) → ${finalWidth.toFixed(0)}x${finalHeight.toFixed(0)}px (${(finalWidth/displayedProductWidth*100).toFixed(1)}% x ${(finalHeight/displayedProductHeight*100).toFixed(1)}% of product)`);
        } else if (displayedProductWidth > 0) {
          // Fallback: use a percentage of the painted mockup, not a 400px guess
          const fallbackPercent = effectiveProductName.toLowerCase().includes('cropped') ? 0.25 : 0.30;
          const fallbackBase = displayedProductHeight > 0
            ? Math.min(displayedProductWidth, displayedProductHeight)
            : displayedProductWidth;
          const fallbackSize = fallbackBase * fallbackPercent;
          commitOverlaySize(fallbackSize, fallbackSize);
        }
      } catch (e) {
        console.warn('Could not calculate print area size:', e);
        if (productImageSize.width > 0 && productImageSize.height > 0) {
          const fallbackSize = Math.min(productImageSize.width, productImageSize.height) * 0.25;
          commitOverlaySize(fallbackSize, fallbackSize);
        }
      }
    };

    calculateSize();
    const raf = requestAnimationFrame(calculateSize);
    return () => cancelAnimationFrame(raf);
  }, [productName, productSize, productImageSize, selectedProductName, printAreaFit, productImage, detectedPrintBox, litePreview]);

  useLayoutEffect(() => {
    if (!onOverlayBoxChange) return;
    if (!(screenshotDisplaySize.width >= 8) || !(screenshotDisplaySize.height >= 8)) return;
    const printBox = overlaySizeForOrientation(
      screenshotDisplaySize.width,
      screenshotDisplaySize.height,
      imageOrientation,
      selectedProductName || productName
    );
    const oriented = overlayBoxForArtwork(printBox);
    if (oriented.width > 0 && oriented.height > 0) {
      onOverlayBoxChange({ width: oriented.width, height: oriented.height });
    }
  }, [
    onOverlayBoxChange,
    screenshotDisplaySize.width,
    screenshotDisplaySize.height,
    imageOrientation,
    selectedProductName,
    productName,
  ]);

  // Measure the painted mockup only. naturalWidth is the file size and
  // makes the overlay huge on phones (then too tall once width is matched).
  const measureProductImage = () => {
    const img = productImageRef.current;
    const stage = containerRef.current;
    if (!img && !stage) return;
    const rect = img ? img.getBoundingClientRect() : { width: 0, height: 0 };
    let width = rect.width || img?.clientWidth || img?.offsetWidth || 0;
    let height = rect.height || img?.clientHeight || img?.offsetHeight || 0;
    const nw = img?.naturalWidth || 0;
    const nh = img?.naturalHeight || 0;
    // object-fit:contain can letterbox inside a fixed stage. Size the print
    // to the painted photo, not the empty stage around it.
    if (nw > 0 && nh > 0 && width >= 2 && height >= 2) {
      const fitScale = Math.min(width / nw, height / nh);
      const fittedW = nw * fitScale;
      const fittedH = nh * fitScale;
      if (fittedW + 1 < width || fittedH + 1 < height) {
        width = fittedW;
        height = fittedH;
      }
    }
    // iOS can report width before height:auto has resolved. Infer painted
    // height from file aspect — never use naturalWidth as the overlay size.
    if (width >= 2 && height < 2 && nw > 0 && nh > 0) {
      height = width * (nh / nw);
    }
    // Cached/mobile: img rect can be 0 on first layout. Stage width is the
    // mockup's CSS width (img is 100%).
    const stageRect = stage ? stage.getBoundingClientRect() : { width: 0, height: 0 };
    const stageW = stageRect.width || 0;
    const stageH = stageRect.height || 0;
    if (width < 2 && stageW >= 2) {
      width = stageW;
      if (nw > 0 && nh > 0) {
        height = width * (nh / nw);
      }
    }
    // Cap to the painted stage so a pre-CSS intrinsic box cannot inflate the overlay.
    if (stageW >= 2 && width > stageW + 1) {
      const aspect = nw > 0 && nh > 0
        ? (nh / nw)
        : (height > 0 && width > 0 ? height / width : 0);
      width = stageW;
      if (aspect > 0) height = width * aspect;
    }
    if (stageH >= 2 && height > stageH + 1) {
      const aspect = nw > 0 && nh > 0
        ? (nw / nh)
        : (width > 0 && height > 0 ? width / height : 0);
      height = stageH;
      if (aspect > 0) width = height * aspect;
    }
    if (width < 2 || height < 2) return;
    // Wait for the stage to paint. An intrinsic file box (800px+) would size
    // the print far outside the mockup print area, especially in Confirm.
    if (stageW < 2 && width > 400) return;
    const paintedOk = stageW >= 2 && width <= stageW + 1;
    if (litePreview && paintedOk) liteSizeLockedRef.current = true;
    setProductImageSize((prev) => {
      if (Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5) {
        return prev;
      }
      return { width, height };
    });
  };

  const handleProductImageLoad = () => {
    measureProductImage();
    const img = productImageRef.current;
    const name = (printAreaFit === 'product' && selectedProductName) ? selectedProductName : productName;
    const src = img ? (img.currentSrc || img.src) : '';
    if (src && !isPrintfulMockupUrl(src)) {
      const fillKey = `${src}|${name}`;
      const applyFill = (fill) => {
        const tint = String(garmentTintColor || '').trim();
        const next = tint || fill;
        if (!next) return;
        setShirtFillColor((prev) => (prev === next ? prev : next));
        if (onShirtFillChange) onShirtFillChange(next);
      };
      if (shirtFillCache.has(fillKey)) {
        applyFill(shirtFillCache.get(fillKey));
      } else if (litePreview) {
        applyFill(sampleShirtFillFromMockup(img, name));
      } else {
        const sourceImg = img;
        scheduleIdleWork(() => {
          if ((productImageRef.current?.currentSrc || productImageRef.current?.src) !== src) return;
          applyFill(sampleShirtFillFromMockup(sourceImg, name));
        });
      }
    }
    if (img && isApparelChestPrintProduct(name) && !getApparelPrintOverride(name)) {
      const detectSrc = img.currentSrc || img.src;
      if (paintedPrintBoxCache.has(detectSrc)) {
        setDetectedPrintBox(paintedPrintBoxCache.get(detectSrc));
      } else {
        const sourceImg = img;
        scheduleIdleWork(() => {
          if ((productImageRef.current?.currentSrc || productImageRef.current?.src) !== detectSrc) return;
          setDetectedPrintBox(detectPaintedPrintBox(sourceImg));
        });
      }
    } else if (!img || !isApparelChestPrintProduct(name) || getApparelPrintOverride(name)) {
      setDetectedPrintBox((prev) => (prev == null ? prev : null));
    }
    requestAnimationFrame(() => {
      measureProductImage();
      requestAnimationFrame(measureProductImage);
    });
  };

  useLayoutEffect(() => {
    liteSizeLockedRef.current = false;
    setDetectedPrintBox(null);
    measureProductImage();
    const img = productImageRef.current;
    const stage = containerRef.current;
    // Cached images (especially iOS) may not fire onLoad again.
    if (img?.complete) {
      handleProductImageLoad();
    }
    let measureCancelled = false;
    const maxTicks = litePreview ? 4 : 4;
    const tickMeasure = (attempt) => {
      if (measureCancelled) return;
      measureProductImage();
      if (attempt < maxTicks) {
        requestAnimationFrame(() => tickMeasure(attempt + 1));
      }
    };
    requestAnimationFrame(() => tickMeasure(0));
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
        if (measureCancelled) return;
        measureProductImage();
      })
      : null;
    if (observer) {
      if (img) observer.observe(img);
      if (stage) observer.observe(stage);
    }
    window.addEventListener('resize', measureProductImage);
    window.addEventListener('orientationchange', measureProductImage);
    return () => {
      measureCancelled = true;
      observer?.disconnect();
      window.removeEventListener('resize', measureProductImage);
      window.removeEventListener('orientationchange', measureProductImage);
    };
  }, [productImage, productName, litePreview]);

  const handleMouseDown = (e) => {
    if (litePreview) return;
    if (imageOrientation === 'landscape') return;
    if (!screenshot || !(screenshotDisplaySize.width >= 8) || !(screenshotDisplaySize.height >= 8)) return;
    e.preventDefault();
    setIsDragging(true);
    const startPos = { x: e.clientX, y: e.clientY };
    setDragStart(startPos);
    lastDragPositionRef.current = startPos;
    currentDragPositionRef.current = clampFrameOffset(offsetX, offsetY);
    if (textDragMode) {
      dragStartTextPositionRef.current = { x: textOffsetX, y: textOffsetY };
      totalDragDeltaRef.current = { x: 0, y: 0 };
    }
  };

  const handleTouchStart = (e) => {
    if (litePreview) return;
    if (imageOrientation === 'landscape') return;
    if (!screenshot || !(screenshotDisplaySize.width >= 8) || !(screenshotDisplaySize.height >= 8)) return;
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    const startPos = { x: touch.clientX, y: touch.clientY };
    setDragStart(startPos);
    lastDragPositionRef.current = startPos;
    currentDragPositionRef.current = clampFrameOffset(offsetX, offsetY);
    if (textDragMode) {
      dragStartTextPositionRef.current = { x: textOffsetX, y: textOffsetY };
      totalDragDeltaRef.current = { x: 0, y: 0 };
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      if (e.touches) e.preventDefault();
      const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);
      if (clientX === undefined || clientY === undefined) return;

      // 1:1 with cursor so placement matches where you release
      const deltaX = clientX - lastDragPositionRef.current.x;
      const deltaY = clientY - lastDragPositionRef.current.y;
      lastDragPositionRef.current = { x: clientX, y: clientY };

      if (textDragMode && onTextPositionChange) {
        totalDragDeltaRef.current.x += deltaX;
        totalDragDeltaRef.current.y += deltaY;
        const refW = productImageSize.width || screenshotDisplaySize.width || 300;
        const refH = productImageSize.height || screenshotDisplaySize.height || 300;
        const start = dragStartTextPositionRef.current;
        const percentX = Math.max(0, Math.min(100, start.x + (totalDragDeltaRef.current.x / refW) * 100));
        const percentY = Math.max(0, Math.min(100, start.y + (totalDragDeltaRef.current.y / refH) * 100));
        onTextPositionChange(percentX, percentY);
        return;
      }

      const next = clampFrameOffset(0, currentDragPositionRef.current.y + deltaY);
      currentDragPositionRef.current = next;
      onOffsetChange(next.x, next.y);
    };

    const handleUp = () => {
      // Keep exact release position — do not snap back to center
      if (!textDragMode && onOffsetChange) {
        const { x, y } = currentDragPositionRef.current;
        onOffsetChange(x, y);
      }
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
    document.addEventListener('touchcancel', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
      document.removeEventListener('touchcancel', handleUp);
    };
  }, [isDragging, onOffsetChange, onTextPositionChange, textDragMode, screenshotDisplaySize, productImageSize, imageOrientation, selectedProductName, productName]);

  useLayoutEffect(() => {
    if (litePreview || isDragging || !onOffsetChange) return;
    if (!(screenshotDisplaySize.width > 8) || !(screenshotDisplaySize.height > 8)) return;
    if (imageOrientation === 'landscape') {
      if (Math.abs(offsetX) > 0.5 || Math.abs(offsetY) > 0.5) {
        onOffsetChange(0, 0);
      }
      return;
    }
    const next = clampFrameOffset(offsetX, offsetY);
    if (Math.abs(next.x - offsetX) > 0.5 || Math.abs(next.y - offsetY) > 0.5) {
      onOffsetChange(next.x, next.y);
    }
  }, [litePreview, isDragging, offsetX, offsetY, screenshotDisplaySize, imageOrientation, selectedProductName, productName, onOffsetChange]);

  return (
    <div 
      ref={containerRef}
      className="product-preview-stage"
      style={{
        position: 'relative',
        width: '100%',
        margin: '0 auto',
        overflow: litePreview ? 'visible' : undefined,
        cursor: litePreview || imageOrientation === 'landscape' ? 'default' : (isDragging ? 'grabbing' : 'grab'),
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: litePreview || imageOrientation === 'landscape' ? 'auto' : 'none'
      }}
      onMouseDown={litePreview ? undefined : handleMouseDown}
      onTouchStart={litePreview ? undefined : handleTouchStart}
    >
      {/* Product Image */}
      <img
        ref={productImageRef}
        className="product-preview-mockup"
        key={mockupSrc || productImage || 'mockup'}
        src={tintedMockupSrc || mockupSrc || productImage}
        alt={productName}
        decoding="async"
        referrerPolicy="no-referrer"
        crossOrigin={garmentTintColor ? 'anonymous' : undefined}
        onLoad={handleProductImageLoad}
        onError={() => {
          const fb = String(fallbackMockupUrl || '').trim();
          if (fb && fb !== mockupSrc) setMockupSrc(fb);
        }}
        onDragStart={(e) => e.preventDefault()}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          borderRadius: '4px'
        }}
      />
      
      {/* Screenshot Overlay (Draggable) */}
      {screenshot && screenshotDisplaySize.width >= 8 && screenshotDisplaySize.height >= 8 && (() => {
        const placeName = selectedProductName || productName;
        const printBox = overlaySizeForOrientation(
          screenshotDisplaySize.width,
          screenshotDisplaySize.height,
          imageOrientation,
          placeName
        );
        const place = apparelOverlayPlacement(placeName, detectedPrintBox);
        const topPct = `${place.top}%`;
        const clampedOffset = imageOrientation === 'landscape'
          ? { x: 0, y: 0 }
          : clampFrameOffset(offsetX, offsetY);
        return (
        <div
          style={{
            position: 'absolute',
            top: topPct,
            left: `${place.left}%`,
            transform: `translate(calc(-50% + ${clampedOffset.x + (printBox.rightShift || 0)}px), calc(-50% + ${clampedOffset.y + (place.topShift || 0)}px))`,
            cursor: litePreview || imageOrientation === 'landscape' ? 'default' : (isDragging ? 'grabbing' : 'grab'),
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            touchAction: litePreview ? 'auto' : 'none',
            pointerEvents: litePreview ? 'none' : 'auto',
            zIndex: 2,
            overflow: 'hidden'
          }}
        >
          {(() => {
            const scaleFactor = 1;
            const oriented = overlayBoxForArtwork(printBox);
            const scaledWidth = oriented.width * scaleFactor;
            const scaledHeight = oriented.height * scaleFactor;
            const objectPos = printBoxObjectPosition(placeName, imageOrientation, imageOffsetX, imageOffsetY);
            const posX = objectPos.x;
            const posY = objectPos.y;
            const artworkSrcW = sourceWidth > 0 ? sourceWidth : overlayNaturalSize.width;
            const artworkSrcH = sourceHeight > 0 ? sourceHeight : overlayNaturalSize.height;
            const artworkLayout = artworkLayoutInBox(
              scaledWidth,
              scaledHeight,
              artworkSrcW,
              artworkSrcH,
              screenshotScale,
              posX,
              posY
            );
            const overlayFitClass = artworkLayout
              ? ' product-preview-overlay-zoom'
              : (oriented.cover
                ? ' product-preview-overlay-landscape'
                : ' product-preview-overlay-portrait');
            const {
              vis,
              clipRadius,
              boxRadius,
              featherMask,
              previewFrame,
              innerFrameWidth,
              innerOuter,
              innerRadius,
            } = artworkOverlayMetrics({
              boxW: scaledWidth,
              boxH: scaledHeight,
              layout: artworkLayout,
              cornerRadius,
              featherEdge,
              frameEnabled,
              frameWidth,
              sourceWidth: artworkSrcW,
              sourceHeight: artworkSrcH,
            });
            const clipBox = {
              width: `${scaledWidth}px`,
              height: `${scaledHeight}px`,
            };
            const fadeBg = overlayFeatherFadeBackground(featherFadeEnabled, featherFadeColor);
            const visStyle = overlayVisBoxStyle(vis, scaledWidth, scaledHeight);
            const zoomImgStyle = artworkImageOffsetStyle(artworkLayout, vis);
            const rasterizeLiteFeather = Boolean(
              litePreview && (featherEdge > 0 || cornerRadius > 0)
            );
            return (
              <div
                style={{
                  ...clipBox,
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: boxRadius > 0 ? `${boxRadius}px` : 0,
                  background: shirtFillColor || 'transparent',
                }}
              >
                <div
                  style={{
                    ...visStyle,
                    overflow: 'hidden',
                    borderRadius: rasterizeLiteFeather ? 0 : (clipRadius > 0 ? `${clipRadius}px` : 0),
                    background: rasterizeLiteFeather
                      ? (shirtFillColor || 'transparent')
                      : (fadeBg === 'transparent' ? 'transparent' : fadeBg),
                  }}
                >
                <div
                    className={`product-preview-overlay-clip${litePreview ? ' product-preview-overlay-clip--lite' : ''}`}
                    style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: rasterizeLiteFeather ? 0 : (clipRadius > 0 ? `${clipRadius}px` : 0),
                    background: 'transparent',
                    ...(rasterizeLiteFeather ? {} : (featherMask || {})),
                  }}
                >
                    {rasterizeLiteFeather ? (
                      <LiteOverlayArtwork
                        screenshot={screenshot}
                        vis={vis}
                        layout={artworkLayout}
                        cornerRadius={cornerRadius}
                        featherEdge={featherEdge}
                        featherFadeEnabled={featherFadeEnabled}
                        featherFadeColor={featherFadeColor}
                        shirtFillColor={shirtFillColor}
                        mockupSrc={productImage}
                        productName={placeName}
                        blackAndWhite={blackAndWhite}
                        bwIntensity={bwIntensity}
                        imageOpacity={imageOpacity}
                        posX={posX}
                        posY={posY}
                        objectFit={oriented.objectFit}
                      />
                    ) : (
                    <img 
                      className={`product-preview-overlay${overlayFitClass}`}
                      key={screenshot || 'overlay'}
                      src={screenshot}
                      alt="Screenshot overlay"
                      decoding="async"
                      style={{
                        ...(zoomImgStyle || {
                          ...clipBox,
                          objectFit: oriented.objectFit,
                          objectPosition: `${posX}% ${posY}%`,
                        }),
                        display: 'block',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        touchAction: 'none',
                        filter: blackAndWhiteStyle(blackAndWhite, bwIntensity),
                        opacity: imageOpacityCss(imageOpacity),
                      }}
                      draggable={false}
                    />
                    )}
                </div>
                </div>
                {previewFrame > 0 && (
                  <div
                    aria-hidden="true"
                    style={{ ...visStyle, pointerEvents: 'none' }}
                  >
                    <div style={overlayFrameRingStyle(0, previewFrame, clipRadius, frameColor)} />
                    {doubleFrame && (
                      <div style={overlayFrameRingStyle(innerOuter, innerFrameWidth, innerRadius, resolveInnerFrameColor(innerFrameColor, frameColor))} />
                    )}
                  </div>
                )}
                <ToolsLiveText
                  enabled={textEnabled}
                  content={textContent}
                  font={textFont}
                  color={textColor}
                  size={textSize}
                  offsetX={textOffsetX}
                  offsetY={textOffsetY}
                  direction={textDirection}
                  boxWidth={scaledWidth}
                  boxHeight={scaledHeight}
                />
              </div>
            );
          })()}
        </div>
        );
      })()}
    </div>
  );
};

/** Mini print-box clone of Product Preview so orientation and crop stay in sync. */
function ScreenshotPreviewPane({
  src,
  productName,
  productSize,
  imageOrientation,
  printAreaFit,
  imageOffsetX = 0,
  imageOffsetY = 0,
  featherEdge = 0,
  cornerRadius = 0,
  frameEnabled = false,
  frameColor = '#FF0000',
  frameWidth = 10,
  doubleFrame = false,
  innerFrameColor = '',
  sourceWidth = 0,
  sourceHeight = 0,
  blackAndWhite = false,
  bwIntensity = BW_INTENSITY_DEFAULT,
  imageOpacity = IMAGE_OPACITY_DEFAULT,
  featherFadeEnabled = false,
  featherFadeColor = 'white',
  boxWidth = 176,
  overlayBoxWidth = 0,
  overlayBoxHeight = 0,
  screenshotScale = 100,
  printBoxFillColor = '',
  textEnabled = false,
  textContent = '',
  textFont = 'Arial',
  textColor = '#000000',
  textSize = 24,
  textOffsetX = 50,
  textOffsetY = 50,
  textDirection = 'horizontal',
}) {
  if (!src) {
    return (
      <p style={{ color: '#999', fontSize: '0.85rem', margin: 0, textAlign: 'center', padding: '10px' }}>
        No screenshot loaded
      </p>
    );
  }
  const aspect = printBoxPreviewAspect(
    productName,
    productSize,
    imageOrientation,
    printAreaFit,
    overlayBoxWidth,
    overlayBoxHeight
  );
  const maxSide = boxWidth > 0 ? boxWidth : 176;
  const safeAspect = aspect > 0 ? aspect : 1;
  const boxW = safeAspect >= 1 ? maxSide : maxSide * safeAspect;
  const boxH = safeAspect >= 1 ? maxSide / safeAspect : maxSide;
  const objectPos = printBoxObjectPosition(productName, imageOrientation, imageOffsetX, imageOffsetY);
  const posX = objectPos.x;
  const posY = objectPos.y;
  const artworkLayout = artworkLayoutInBox(
    boxW,
    boxH,
    sourceWidth,
    sourceHeight,
    screenshotScale,
    posX,
    posY
  );
  const {
    vis,
    clipRadius,
    boxRadius,
    featherMask,
    previewFrame,
    innerFrameWidth,
    innerOuter,
    innerRadius,
  } = artworkOverlayMetrics({
    boxW,
    boxH,
    layout: artworkLayout,
    cornerRadius,
    featherEdge,
    frameEnabled,
    frameWidth,
    sourceWidth,
    sourceHeight,
  });
  const fadeBg = overlayFeatherFadeBackground(featherFadeEnabled, featherFadeColor);
  const visStyle = overlayVisBoxStyle(vis, boxW, boxH);
  const zoomImgStyle = artworkImageOffsetStyle(artworkLayout, vis);
  const fill = { position: 'absolute', inset: 0 };
  return (
    <div
      className={`screenshot-preview-stage${imageOrientation === 'landscape' ? ' is-landscape' : ' is-portrait'}`}
      style={{
        aspectRatio: String(safeAspect),
        '--preview-aspect': String(safeAspect),
      }}
    >
      <div
        style={{
          ...fill,
          overflow: 'hidden',
          borderRadius: boxRadius > 0 ? `${boxRadius}px` : 0,
          background: printBoxFillColor || 'transparent',
        }}
      >
        <div
          style={{
            ...visStyle,
            overflow: 'hidden',
            borderRadius: clipRadius > 0 ? `${clipRadius}px` : 0,
            background: fadeBg === 'transparent' ? 'transparent' : fadeBg,
          }}
        >
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: clipRadius > 0 ? `${clipRadius}px` : 0,
            ...(featherMask || {})
          }}
        >
            <img
              src={src}
              alt="Screenshot Preview"
              className={artworkLayout ? 'is-artwork-zoom' : undefined}
              style={{
                ...(zoomImgStyle ? { ...zoomImgStyle, objectFit: 'fill' } : {
                  ...fill,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: `${posX}% ${posY}%`,
                }),
                display: 'block',
                filter: blackAndWhiteStyle(blackAndWhite, bwIntensity),
                opacity: imageOpacityCss(imageOpacity),
              }}
            />
        </div>
        </div>
        {previewFrame > 0 && (
          <div
            aria-hidden="true"
            style={{ ...visStyle, pointerEvents: 'none' }}
          >
            <div style={overlayFrameRingStyle(0, previewFrame, clipRadius, frameColor)} />
            {doubleFrame && (
              <div style={overlayFrameRingStyle(innerOuter, innerFrameWidth, innerRadius, resolveInnerFrameColor(innerFrameColor, frameColor))} />
            )}
          </div>
        )}
        <ToolsLiveText
          enabled={textEnabled}
          content={textContent}
          font={textFont}
          color={textColor}
          size={textSize}
          offsetX={textOffsetX}
          offsetY={textOffsetY}
          direction={textDirection}
          boxWidth={boxW}
          boxHeight={boxH}
        />
      </div>
    </div>
  );
}

// Helper functions to determine product handling
const isHatProduct = (productName) => {
  if (!productName) return false;
  const productNameLower = productName.toLowerCase().trim();
  const hats = [
    "distressed dad hat",
    "closed back cap",
    "five panel trucker hat",
    "five panel baseball cap",
    "5 panel baseball cap",
    "snapback hat" // Legacy support
  ];
  // More robust matching - check if product name contains any hat name or vice versa
  const isHat = hats.some(hat => {
    const hatLower = hat.toLowerCase().trim();
    return productNameLower.includes(hatLower) || hatLower.includes(productNameLower) ||
           productNameLower === hatLower;
  });
  if (isHat) {
    console.log('🎩 [HAT CHECK] Matched:', productName, 'as hat product');
  }
  return isHat;
};

const NO_MOCKUP_PREVIEW_CATEGORIES = {
  bags: {
    products: [
      'Laptop Sleeve',
      'All-Over Print Drawstring',
      'All Over Print Tote Pocket',
      'All-Over Print Crossbody Bag',
      'All-Over Print Utility Bag',
      'Canvas Tote',
      'Tote Bag',
      'Large Canvas Bag',
    ],
    message:
      'Bag preview is not available, but you can still use the editing tools to customize your screenshot.',
  },
  pets: {
    products: ['Pet Bowl All-Over Print', 'Pet Bandana Collar'],
    message:
      'Pet product preview is not available, but you can still use the editing tools to customize your screenshot.',
  },
  misc: {
    products: ['Hardcover Bound Notebook', 'Apron', 'Jigsaw Puzzle with Tin', 'Greeting Card'],
    message:
      'Accessory preview is not available, but you can still use the editing tools to customize your screenshot.',
  },
};

const productNameMatchesListed = (productName, listedName) => {
  const a = String(productName || '').toLowerCase().trim();
  const b = String(listedName || '').toLowerCase().trim();
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
};

const isAllOverPrintProduct = (productName) => {
  if (!productName) return false;
  const n = productName.toLowerCase();
  return n.includes('all over print') || n.includes('all-over print') || n.includes('apron');
};

const getNoMockupPreviewInfo = (productName, category) => {
  const cat = String(category || '').toLowerCase().trim();
  if (NO_MOCKUP_PREVIEW_CATEGORIES[cat]) {
    return NO_MOCKUP_PREVIEW_CATEGORIES[cat];
  }
  if (productName) {
    for (const meta of Object.values(NO_MOCKUP_PREVIEW_CATEGORIES)) {
      if (meta.products.some((listed) => productNameMatchesListed(productName, listed))) {
        return meta;
      }
    }
  }
  return null;
};

const getToolsUnavailableInfo = (productName, category) => {
  if (getNoMockupPreviewInfo(productName, category)) {
    return null;
  }
  if (isAllOverPrintProduct(productName)) {
    return {
      title: 'No Tools for All-Over Print',
      message: 'Editing tools (feather, corner radius, frame) are not available for all-over print products.',
    };
  }
  return null;
};

const toolsUnavailableNoticeStyle = {
  padding: '20px',
  textAlign: 'center',
  background: '#fff3cd',
  border: '2px solid #ffc107',
  borderRadius: '8px',
  color: '#856404',
};

const ToolsUnavailableNotice = ({ info }) => (
  <div style={toolsUnavailableNoticeStyle}>
    <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{info.title}</div>
    <div style={{ fontSize: '14px' }}>{info.message}</div>
  </div>
);

function isPrintfulMockupUrl(url) {
  return /files\.cdn\.printful\.com/i.test(String(url || ''));
}

function toolsHatLocalMockupUrl(product) {
  const fallback = String(product?.productImage || '').trim();
  if (fallback && !/hatflatfront/i.test(fallback) && !isPrintfulMockupUrl(fallback)) return fallback;
  return '';
}

/** Tools Product Preview only: selected hat + cart color from Printful. No tint, no hatflatfront. */
function toolsHatPreviewUrl(product, selectedName) {
  const name = String(selectedName || product?.name || product?.product || '').trim();
  const cartName = String(product?.name || product?.product || '').trim();
  const sameHat =
    isHatProduct(cartName) &&
    (!name || name === cartName || matchPrintAreaProductName(name) === matchPrintAreaProductName(cartName));
  const fromPrintful = getPrintfulColorMockupUrl(
    {
      name,
      printful_catalog_product_id: sameHat ? product?.printful_catalog_product_id : undefined,
    },
    product?.color
  );
  if (fromPrintful) return fromPrintful;
  return toolsHatLocalMockupUrl(product);
}

// Placeholder when product image is missing (e.g. products loaded from order_id) so screenshot still shows
let _placeholderProductImage = null;
const getPlaceholderProductImage = () => {
  if (_placeholderProductImage) return _placeholderProductImage;
  const w = 400;
  const h = 480;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(20, 20, w - 40, h - 40);
  _placeholderProductImage = canvas.toDataURL('image/png');
  return _placeholderProductImage;
};

const ToolsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const leftColumnRef = useRef(null);
  const containerRef = useRef(null);
  const backBtnRef = useRef(null);
  
  const initialEditorSlot = getInitialEditorSlot() || {};
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [featherEdge, setFeatherEdge] = useState(() => initialEditorSlot.featherEdge ?? 0);
  const [featherFadeEnabled, setFeatherFadeEnabled] = useState(() => Boolean(initialEditorSlot.featherFadeEnabled));
  const [featherFadeColor, setFeatherFadeColor] = useState(() => normalizeFeatherFadeColor(initialEditorSlot.featherFadeColor));
  const [cornerRadius, setCornerRadius] = useState(() => initialEditorSlot.cornerRadius ?? 0);
  const [frameEnabled, setFrameEnabled] = useState(() => Boolean(initialEditorSlot.frameEnabled));
  const [frameColor, setFrameColor] = useState(() => initialEditorSlot.frameColor || '#FF0000');
  const [frameWidth, setFrameWidth] = useState(() => initialEditorSlot.frameWidth ?? 10);
  const [doubleFrame, setDoubleFrame] = useState(() => Boolean(initialEditorSlot.doubleFrame));
  const [innerFrameColor, setInnerFrameColor] = useState(() => (
    resolveInnerFrameColor(initialEditorSlot.innerFrameColor, initialEditorSlot.frameColor)
  ));
  const [blackAndWhite, setBlackAndWhite] = useState(() => Boolean(initialEditorSlot.blackAndWhite));
  const [bwIntensity, setBwIntensity] = useState(() => clampBwIntensity(initialEditorSlot.bwIntensity));
  const [imageOpacity, setImageOpacity] = useState(() => clampImageOpacity(initialEditorSlot.imageOpacity));
  const [textEnabled, setTextEnabled] = useState(() => Boolean(initialEditorSlot.textEnabled));
  const [textContent, setTextContent] = useState(() => initialEditorSlot.textContent || '');
  const [textFont, setTextFont] = useState(() => initialEditorSlot.textFont || 'Arial');
  const [textColor, setTextColor] = useState(() => initialEditorSlot.textColor || '#000000');
  const [textSize, setTextSize] = useState(() => initialEditorSlot.textSize ?? 24);
  const [textOffsetX, setTextOffsetX] = useState(() => initialEditorSlot.textOffsetX ?? 50);
  const [textOffsetY, setTextOffsetY] = useState(() => initialEditorSlot.textOffsetY ?? 50);
  const [textDirection, setTextDirection] = useState(() => normalizeTextDirection(initialEditorSlot.textDirection));
  const [printAreaFit, setPrintAreaFit] = useState(() => initialEditorSlot.printAreaFit || getInitialCartPrintFit().fit);
  const [imageOrientation, setImageOrientation] = useState(() => (
    initialEditorSlot.imageOrientation === 'landscape' ? 'landscape' : 'portrait'
  ));
  const [imageOffsetX, setImageOffsetX] = useState(() => initialEditorSlot.imageOffsetX ?? 0);
  const [imageOffsetY, setImageOffsetY] = useState(() => initialEditorSlot.imageOffsetY ?? 0);
  const [editedImageUrl, setEditedImageUrl] = useState('');
  const editedImageUrlRef = useRef('');
  const [selectedProductName, setSelectedProductName] = useState(() => getInitialCartPrintFit().name);
  const [currentImageDimensions, setCurrentImageDimensions] = useState({ width: 0, height: 0 });
  const [bakedImageSize, setBakedImageSize] = useState({ width: 0, height: 0 });
  const [overlayBoxSize, setOverlayBoxSize] = useState({ width: 0, height: 0 });
  const handleOverlayBoxChange = useCallback((box) => {
    const width = Number(box?.width) || 0;
    const height = Number(box?.height) || 0;
    setOverlayBoxSize((prev) => {
      if (Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5) return prev;
      return { width, height };
    });
  }, []);
  const [printBoxFillColor, setPrintBoxFillColor] = useState('');
  const handleShirtFillChange = useCallback((color) => {
    const next = String(color || '');
    setPrintBoxFillColor((prev) => (prev === next ? prev : next));
  }, []);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeFailed, setUpgradeFailed] = useState(false);
  const upgradeTriggeredRef = useRef(false); // Track if we've already triggered an upgrade for this image
  const [cartProducts, setCartProducts] = useState([]); // Store all cart products
  const [selectedCartProductIndex, setSelectedCartProductIndex] = useState(null); // Selected product index from cart
  const [productImageOffsets, setProductImageOffsets] = useState({}); // Store image offsets for each cart product {cartIndex: {x: 0, y: 0}}
  const [screenshotScale, setScreenshotScale] = useState(100); // Screenshot size scale (percentage: 50-150%)
  const [screenshotSizeInteracted, setScreenshotSizeInteracted] = useState(false); // Track if screenshot size has been adjusted
  const [productSelectClicked, setProductSelectClicked] = useState(() => Boolean(getInitialCartPrintFit().name)); // Track if product select has been clicked
  const [fitPreviewImageUrl, setFitPreviewImageUrl] = useState('');
  const [orderScreenshotsLoading, setOrderScreenshotsLoading] = useState(false);
  const [orderScreenshotsError, setOrderScreenshotsError] = useState(null);
  // True when opened from admin email (Edit Tools link). Init from URL so first paint is correct.
  const [isFromOrderEmail, setIsFromOrderEmail] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const q = window.location.search;
      if (q && new URLSearchParams(q).get('order_id')) return true;
      if (window.location.href && window.location.href.includes('order_id=')) return true;
    } catch (_) {}
    return false;
  });
  const orderIdLoadedRef = useRef(null); // Avoid re-fetching same order when effect re-runs
  // Per-slot edit state (keyed by cart product index) so each of up-to-5 products has its own edits; no carry-over when switching
  const slotStateRef = useRef(readEditorSlots());
  const cartCountRef = useRef(0);
  const cartIdentityRef = useRef('');
  const entrySelectRef = useRef(true);
  const selectedCartProductIndexRef = useRef(null);
  const sessionPreviewUrlRef = useRef('');
  const [sessionEpoch, setSessionEpoch] = useState(0);

  useEffect(() => {
    selectedCartProductIndexRef.current = selectedCartProductIndex;
  }, [selectedCartProductIndex]);
  // True when the user picked Fit Type / landscape (do not treat initial 'none' as a choice)
  const fitUserSetRef = useRef((() => {
    const flags = {};
    const slots = readEditorSlots();
    Object.keys(slots).forEach((key) => {
      if (slots[key] && slots[key].fitUserSet) flags[key] = true;
    });
    return flags;
  })());
  const autoFitCartIndexRef = useRef({});
  const printFilterKeyRef = useRef('');
  // When true, apply-edits effect must skip so it doesn't overwrite with previous product's image (same effect batch race)
  const switchingSlotRef = useRef(false);
  const editorHydratedRef = useRef(Boolean(initialEditorSlot.sourceScreenshot || initialEditorSlot.frameEnabled || initialEditorSlot.imageOrientation));
  const orientationUserSetRef = useRef(
    initialEditorSlot.imageOrientation === 'landscape' || initialEditorSlot.imageOrientation === 'portrait'
  );
  const [slotSwitchTick, setSlotSwitchTick] = useState(0);
  const [mugMockupUrl, setMugMockupUrl] = useState('');
  const [mugMockupUrls, setMugMockupUrls] = useState([]);
  const [mugMockupLoading, setMugMockupLoading] = useState(false);
  const [mugMockupError, setMugMockupError] = useState('');
  const [wrapRequested, setWrapRequested] = useState(false);
  const wrapEditKeyRef = useRef('');
  const persistMugMockupUrl = useCallback((cartIndex, url, urls, sourceUrl, printfileUrl) => {
    const wrap = String(url || '').trim();
    const views = (Array.isArray(urls) ? urls : [])
      .map((row) => ({
        url: String(row?.url || '').trim(),
        title: String(row?.title || 'View').trim() || 'View',
      }))
      .filter((row) => row.url);
    if (!wrap || !Number.isInteger(cartIndex) || cartIndex < 0) return;
    try {
      const items = readCartItems();
      if (!items[cartIndex]) return;
      const source = String(sourceUrl || items[cartIndex].printfulMugMockupSource || '').trim();
      const sameUrl = items[cartIndex].printfulMugMockupUrl === wrap;
      const sameViews = JSON.stringify(items[cartIndex].printfulMugMockupUrls || []) === JSON.stringify(views);
      const sameSource = String(items[cartIndex].printfulMugMockupSource || '') === source;
      const sameFresh = !items[cartIndex].printfulMugMockupStale;
      const printfile = String(printfileUrl || '').trim();
      const samePrintfile = String(items[cartIndex].printfulTotePrintfileUrl || '') === printfile;
      if (sameUrl && sameViews && sameSource && sameFresh && samePrintfile) return;
      const next = items.map((item, index) => {
        if (index !== cartIndex) return item;
        const updated = {
          ...item,
          printfulMugMockupUrl: wrap,
          printfulMugMockupUrls: views,
        };
        delete updated.printfulMugMockupStale;
        if (source) updated.printfulMugMockupSource = source;
        const printfile = String(printfileUrl || '').trim();
        if (printfile) updated.printfulTotePrintfileUrl = printfile;
        return updated;
      });
      writeCartItems(next);
    } catch (_) {}
    try {
      const data = { ...readPendingMerchData() };
      data.printful_mug_mockup_url = wrap;
      data.printful_mug_mockup_urls = views;
      savePendingMerchData(data);
    } catch (_) {}
  }, []);
  const [printQualityImageUrl, setPrintQualityImageUrl] = useState(''); // 300 DPI image from API (parked for download)
  const [printQualityMeta, setPrintQualityMeta] = useState(null); // { dimensions: { width, height, dpi }, file_size, format, quality }
  const [generating300Dpi, setGenerating300Dpi] = useState(false);
  const customFontsReadyRef = useRef(false);

  // Lock horizontal page pan on mobile so it doesn't fight mockup drag / sliders
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add('tools-page-active');
    document.body.classList.add('tools-page-active');
    return () => {
      html.classList.remove('tools-page-active');
      document.body.classList.remove('tools-page-active');
    };
  }, []);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    const onTouchStart = (e) => {
      if (!e.touches?.[0]) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (!e.touches?.[0]) return;
      const el = e.target;
      if (el?.closest?.('input[type="range"], select, .preview-image-wrapper, .preview-image-wrapper-compact')) {
        return;
      }
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > dy && dx > 6) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // Ensure Google Fonts stylesheet is loaded and preload fringe fonts so canvas can use them
  useEffect(() => {
    let cancelled = false;
    const ensureFonts = async () => {
      if (typeof document === 'undefined' || !document.fonts) return;
      const existing = document.querySelector(`link[href*="fonts.googleapis.com"][rel="stylesheet"]`);
      if (!existing) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = GOOGLE_FONTS_STYLESHEET_URL;
        document.head.appendChild(link);
        await new Promise((resolve, reject) => {
          link.onload = resolve;
          link.onerror = reject;
        });
      }
      if (cancelled) return;
      await document.fonts.ready;
      if (cancelled) return;
      await Promise.all(
        TEXT_TOOL_GOOGLE_FONTS.map((family) =>
          document.fonts.load(`16px "${family}"`)
        )
      ).catch(() => {});
      if (!cancelled) customFontsReadyRef.current = true;
    };
    ensureFonts();
    return () => { cancelled = true; };
  }, []);

  // Calculate and set fixed position for left column
  useEffect(() => {
    const updateLeftColumnPosition = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const leftPosition = containerRect.left + 100; // Add 100px for the grey spacer column
      const isDesktopTools = !window.matchMedia('(max-width: 968px)').matches;
      const nav = document.querySelector('nav');
      const belowHeader = Math.max(nav?.getBoundingClientRect().bottom || 0, 64);
      if (leftColumnRef.current) {
        leftColumnRef.current.style.left = `${leftPosition}px`;
        if (isDesktopTools) {
          leftColumnRef.current.style.top = `${Math.round(belowHeader)}px`;
          leftColumnRef.current.style.maxHeight = `calc(100dvh - ${Math.round(belowHeader)}px)`;
        }
      }
      if (backBtnRef.current && isDesktopTools) {
        // Inset so the hover plate is not clipped at the viewport edge.
        backBtnRef.current.style.left = `${Math.round(containerRect.left) + 8}px`;
        backBtnRef.current.style.top = `${Math.round(belowHeader + 4)}px`;
      }
    };

    updateLeftColumnPosition();
    const later = window.setTimeout(updateLeftColumnPosition, 250);
    const later2 = window.setTimeout(updateLeftColumnPosition, 700);
    window.addEventListener('resize', updateLeftColumnPosition);
    window.addEventListener('scroll', updateLeftColumnPosition);
    const logoImg = document.querySelector('.navbar-logo-wrap img.logo');
    logoImg?.addEventListener('load', updateLeftColumnPosition);

    return () => {
      window.clearTimeout(later);
      window.clearTimeout(later2);
      window.removeEventListener('resize', updateLeftColumnPosition);
      window.removeEventListener('scroll', updateLeftColumnPosition);
      logoImg?.removeEventListener('load', updateLeftColumnPosition);
    };
  }, []);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const buildLiveEditLog = (productOverride = null) => {
    const product = productOverride || (
      selectedCartProductIndex != null ? cartProducts[selectedCartProductIndex] : null
    );
    const previewName = selectedProductName || product?.name || '';
    const previewSize = product?.size || null;
    const printPx = printTargetPixels(
      previewName,
      previewSize,
      imageOrientation,
      printAreaFit,
      screenshotScale
    );
    const bakedW = bakedImageSize.width || currentImageDimensions.width;
    const bakedH = bakedImageSize.height || currentImageDimensions.height;
    return buildEditLog({
      bakedWidth: bakedW,
      bakedHeight: bakedH,
      printWidth: printPx.width,
      printHeight: printPx.height,
      featherEdge,
      cornerRadius,
      frameEnabled,
      frameColor,
      frameWidth,
      doubleFrame,
      innerFrameColor,
      blackAndWhite,
      bwIntensity,
      imageOpacity,
      featherFadeEnabled,
      featherFadeColor,
      textEnabled,
      textContent,
      textFont,
      textColor,
      textSize,
      textOffsetX,
      textOffsetY,
      textDirection,
      printAreaFit,
      imageOrientation,
      imageOffsetX,
      imageOffsetY,
      screenshotScale,
      selectedProductName: previewName,
    });
  };

  const captureLiveEditorSlot = (idx, extra = {}) => {
    const product = (idx != null && cartProducts[idx]) ? cartProducts[idx] : null;
    const cartIndex = product?.originalCartIndex;
    const offset = (cartIndex != null && productImageOffsets[cartIndex]) || { x: 0, y: 0 };
    const prev = { ...(slotStateRef.current[idx] || {}) };
    delete prev.editedImageUrl;
    return {
      ...prev,
      featherEdge,
      cornerRadius,
      frameEnabled,
      frameColor,
      frameWidth,
      doubleFrame,
      innerFrameColor,
      blackAndWhite,
      bwIntensity,
      imageOpacity,
      featherFadeEnabled,
      featherFadeColor,
      shirtFillColor: printBoxFillColor || '',
      textEnabled,
      textContent,
      textFont,
      textColor,
      textSize,
      textOffsetX,
      textOffsetY,
      textDirection,
      screenshotScale,
      selectedProductName,
      printAreaFit,
      imageOrientation,
      imageOffsetX,
      imageOffsetY,
      printQualityImageUrl: String(printQualityImageUrl || '').startsWith('data:') ? '' : printQualityImageUrl,
      printQualityMeta,
      offsetX: offset.x,
      offsetY: offset.y,
      fitUserSet: idx != null ? Boolean(fitUserSetRef.current[idx]) : false,
      sourceScreenshot: slotSourceKey(
        imageUrl || product?.originalScreenshot || product?.screenshot || ''
      ),
      editLog: buildLiveEditLog(product),
      ...extra,
    };
  };

  const applySavedEditorFields = (saved) => {
    if (!saved || typeof saved !== 'object') return;
    const skipRectEdits = isCurvedBagProduct(saved.selectedProductName || mugPreviewName || selectedProductName);
    if (skipRectEdits) {
      setFeatherEdge(0);
      setCornerRadius(0);
      setFrameEnabled(false);
      setFeatherFadeEnabled(false);
    } else {
      if (typeof saved.featherEdge === 'number') setFeatherEdge(saved.featherEdge);
      if (typeof saved.cornerRadius === 'number') setCornerRadius(saved.cornerRadius);
      if (typeof saved.frameEnabled === 'boolean') setFrameEnabled(saved.frameEnabled);
      const savedTransparent = isTransparentFeatherFade(saved.featherFadeEnabled, saved.featherFadeColor);
      setFeatherFadeEnabled(!savedTransparent);
      setFeatherFadeColor(savedTransparent ? 'transparent' : normalizeFeatherFadeColor(saved.featherFadeColor));
    }
    if (saved.frameColor) setFrameColor(saved.frameColor);
    if (typeof saved.frameWidth === 'number') setFrameWidth(saved.frameWidth);
    if (typeof saved.doubleFrame === 'boolean') setDoubleFrame(saved.doubleFrame);
    setInnerFrameColor(resolveInnerFrameColor(saved.innerFrameColor, saved.frameColor));
    setBlackAndWhite(Boolean(saved.blackAndWhite));
    setBwIntensity(clampBwIntensity(saved.bwIntensity));
    setImageOpacity(clampImageOpacity(saved.imageOpacity));
    if (skipRectEdits) setFeatherFadeColor('transparent');
    if (typeof saved.textEnabled === 'boolean') setTextEnabled(saved.textEnabled);
    if (typeof saved.textContent === 'string') setTextContent(saved.textContent);
    if (saved.textFont) setTextFont(saved.textFont);
    if (saved.textColor) setTextColor(saved.textColor);
    if (typeof saved.textSize === 'number') setTextSize(saved.textSize);
    if (typeof saved.textOffsetX === 'number') setTextOffsetX(saved.textOffsetX);
    if (typeof saved.textOffsetY === 'number') setTextOffsetY(saved.textOffsetY);
    setTextDirection(normalizeTextDirection(saved.textDirection));
    if (typeof saved.imageOffsetX === 'number') setImageOffsetX(saved.imageOffsetX);
    if (typeof saved.imageOffsetY === 'number') setImageOffsetY(saved.imageOffsetY);
    if (typeof saved.screenshotScale === 'number') setScreenshotScale(clampArtworkZoom(saved.screenshotScale));
    if (saved.shirtFillColor) setPrintBoxFillColor(saved.shirtFillColor);
  };

  const persistEditorSlotsNow = (opts = {}) => {
    writeEditorSlots(slotStateRef.current);
    syncLiveEditorToCartItem(selectedCartProductIndex, opts);
  };

  const syncLiveEditorToCartItem = (idx = selectedCartProductIndex, opts = {}) => {
    if (idx == null) return;
    const product = cartProducts[idx];
    const orig = product?.originalCartIndex;
    if (!Number.isInteger(orig)) return;
    const slot = slotStateRef.current[idx] || captureLiveEditorSlot(idx);
    const nextSettings = {
      screenshotScale: slot.screenshotScale,
      offsetX: slot.offsetX,
      offsetY: slot.offsetY,
      featherEdge: slot.featherEdge,
      cornerRadius: slot.cornerRadius,
      frameEnabled: slot.frameEnabled,
      frameColor: slot.frameColor,
      frameWidth: slot.frameWidth,
      doubleFrame: slot.doubleFrame,
      innerFrameColor: resolveInnerFrameColor(slot.innerFrameColor, slot.frameColor),
      blackAndWhite: slot.blackAndWhite,
      bwIntensity: clampBwIntensity(slot.bwIntensity),
      imageOpacity: clampImageOpacity(slot.imageOpacity),
      featherFadeEnabled: Boolean(slot.featherFadeEnabled) && slot.featherFadeColor !== 'transparent',
      featherFadeColor: isTransparentFeatherFade(slot.featherFadeEnabled, slot.featherFadeColor)
        ? 'transparent'
        : normalizeFeatherFadeColor(slot.featherFadeColor),
      shirtFillColor: slot.shirtFillColor || '',
      textEnabled: slot.textEnabled,
      textContent: slot.textContent,
      textFont: slot.textFont,
      textColor: slot.textColor,
      textSize: slot.textSize,
      textOffsetX: slot.textOffsetX,
      textOffsetY: slot.textOffsetY,
      textDirection: normalizeTextDirection(slot.textDirection),
      printAreaFit: slot.printAreaFit,
      imageOrientation: slot.imageOrientation,
      selectedProductName: slot.selectedProductName,
      editLog: slot.editLog || null,
    };
    try {
    const cartItems = readCartItems();
      if (!Array.isArray(cartItems) || !cartItems[orig]) return;
      const prev = cartItems[orig].toolSettings || null;
      const nextIsDefault = !nextSettings.frameEnabled
        && nextSettings.imageOrientation !== 'landscape'
        && !nextSettings.blackAndWhite
        && !nextSettings.featherFadeEnabled
        && !nextSettings.textEnabled
        && !(nextSettings.featherEdge > 0)
        && !(nextSettings.cornerRadius > 0)
        && !imageOpacityHasEdit(nextSettings.imageOpacity);
      const prevHasEdits = prev && (
        prev.frameEnabled
        || prev.imageOrientation === 'landscape'
        || prev.blackAndWhite
        || prev.featherFadeEnabled
        || prev.textEnabled
        || prev.featherEdge > 0
        || prev.cornerRadius > 0
        || imageOpacityHasEdit(prev.imageOpacity)
      );
      if (!opts.force && nextIsDefault && prevHasEdits) return;
      if (
        JSON.stringify(prev) === JSON.stringify(nextSettings) &&
        cartItems[orig].imageOrientation === slot.imageOrientation
      ) {
        return;
      }
      writeCartItems(cartItems.map((item, i) => (
        i !== orig
          ? item
          : { ...item, imageOrientation: slot.imageOrientation, toolSettings: nextSettings }
      )));
    } catch {
      /* ignore */
    }
  };

  const applyEditorReset = () => {
    slotStateRef.current = {};
    writeEditorSlots({});
    editorHydratedRef.current = false;
    sessionPreviewUrlRef.current = '';
    cartIdentityRef.current = '';
    cartCountRef.current = 0;
    entrySelectRef.current = true;
    autoFitCartIndexRef.current = {};
    printFilterKeyRef.current = '';
    fitUserSetRef.current = {};
    setSelectedProductName('');
    setPrintAreaFit('none');
    setFitPreviewImageUrl('');
    setCartProducts([]);
    setSelectedCartProductIndex(null);
    setProductImageOffsets({});
    setScreenshotScale(100);
    setEditedImageUrl('');
    setImageOffsetX(0);
    setImageOffsetY(0);
    setFeatherEdge(0);
    setFeatherFadeEnabled(false);
    setFeatherFadeColor('white');
    setCornerRadius(0);
    setFrameEnabled(false);
    setFrameWidth(10);
    setFrameColor('#FF0000');
    setDoubleFrame(false);
    setBlackAndWhite(false);
    setBwIntensity(BW_INTENSITY_DEFAULT);
    setTextEnabled(false);
    setTextContent('');
    setTextFont('Arial');
    setTextColor('#000000');
    setTextSize(24);
    setTextOffsetX(50);
    setTextOffsetY(50);
    setTextDirection('horizontal');
    orientationUserSetRef.current = false;
    setImageOrientation('portrait');
    setProductSelectClicked(false);
    setScreenshotSizeInteracted(false);
  };

  // Phone: module memory kept the previous cart/screenshot after adding a
  // new product. A manual refresh dropped that cache. Re-read storage on
  // every Tools visit and when iOS restores the page from bfcache.
  useEffect(() => {
    resyncMerchSessionFromStorage();
    entrySelectRef.current = true;
    cartIdentityRef.current = '';
    cartCountRef.current = 0;
    if (consumeToolsEditorReset()) {
      applyEditorReset();
      return;
    }
    slotStateRef.current = hydrateSlotsFromCart(readEditorSlots());
  }, [location.key]);

  useEffect(() => {
    const onPageShow = (event) => {
      if (!event.persisted) return;
      resyncMerchSessionFromStorage();
      entrySelectRef.current = true;
      cartIdentityRef.current = '';
      cartCountRef.current = 0;
      if (consumeToolsEditorReset()) {
        applyEditorReset();
      } else {
        slotStateRef.current = hydrateSlotsFromCart(readEditorSlots());
      }
      setSessionEpoch((n) => n + 1);
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      resyncMerchSessionFromStorage();
      setSessionEpoch((n) => n + 1);
    };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Persist current slot (edits survive cart/checkout and returning to Tools)
  useEffect(() => {
    const fromOrder = searchParams.get('order_id') || (typeof window !== 'undefined' && window.location.href && window.location.href.includes('order_id='));
    if (fromOrder) return;
    if (!editorHydratedRef.current) return;
    if (selectedCartProductIndex === null || !cartProducts.length || !cartProducts[selectedCartProductIndex]) return;
    const idx = selectedCartProductIndex;
    slotStateRef.current[idx] = captureLiveEditorSlot(idx);
    writeToolsPageState({
      editorSlots: slotStateRef.current,
      screenshotScale,
      productImageOffsets,
      selectedCartProductIndex,
    });
    syncLiveEditorToCartItem(idx);
  }, [selectedCartProductIndex, cartProducts, imageUrl, screenshotScale, selectedProductName, printAreaFit, imageOrientation, imageOffsetX, imageOffsetY, printQualityImageUrl, printQualityMeta, productImageOffsets, featherEdge, cornerRadius, frameEnabled, frameColor, frameWidth, doubleFrame, innerFrameColor, blackAndWhite, bwIntensity, imageOpacity, featherFadeEnabled, featherFadeColor, printBoxFillColor, textEnabled, textContent, textFont, textColor, textSize, textOffsetX, textOffsetY, textDirection, searchParams]);

  // When order_id is in URL (e.g. from email "Edit Tools" link), load screenshots from order (same API as Print Quality page)
  useEffect(() => {
    const orderId = searchParams.get('order_id');
    if (!orderId || String(orderId).trim() === '') {
      orderIdLoadedRef.current = null;
      return;
    }
    const trimmedOrderId = String(orderId).trim();
    if (orderIdLoadedRef.current === trimmedOrderId) return;

    let cancelled = false;
    orderIdLoadedRef.current = trimmedOrderId;
    setOrderScreenshotsLoading(true);
    setOrderScreenshotsError(null);

    fetch(apiJoin(`/api/get-order-screenshot/${encodeURIComponent(trimmedOrderId)}`))
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          let errMsg = 'Failed to load order screenshots';
          try {
            const errData = await response.json();
            if (errData && errData.error) errMsg = errData.error;
          } catch (_) {}
          setOrderScreenshotsError(errMsg);
          setCartProducts([]);
          setSelectedCartProductIndex(null);
          orderIdLoadedRef.current = null;
          setIsFromOrderEmail(false);
          return;
        }
        const data = await response.json();
        if (cancelled) return;
        if (data.success && (data.products?.length > 0 || data.screenshot)) {
          const products = data.products?.length > 0
            ? data.products
            : [{ product: 'Order Screenshot', screenshot: data.screenshot, color: 'N/A', size: 'N/A', index: 0 }];
          let mapped = products
            .map((p, i) => {
              const hasOriginal = Boolean(p.original_screenshot && String(p.original_screenshot).trim());
              const ts = p.toolSettings && typeof p.toolSettings === 'object' ? p.toolSettings : {};
              const ori = p.image_orientation || ts.imageOrientation || p.imageOrientation || '';
              return {
                originalCartIndex: p.index ?? i,
                name: p.product || 'Product',
                color: p.color || 'N/A',
                size: p.size || 'N/A',
                category: p.category || '',
                screenshot: hasOriginal ? p.original_screenshot : (p.screenshot || ''),
                originalScreenshot: hasOriginal ? p.original_screenshot : '',
                productImage: toolsPreviewMockupUrl(p.product, (p.preview_image_url && p.preview_image_url.trim()) || ''),
                imageOrientation: ori,
                toolSettings: hasOriginal
                  ? ts
                  : { imageOrientation: ori === 'landscape' ? 'landscape' : 'portrait' },
                filteredIndex: i
              };
            })
            .filter((item) => item.screenshot && item.screenshot.trim() !== '');
          setCartProducts(mapped);
          setSelectedCartProductIndex(mapped.length > 0 ? 0 : null);
          setOrderScreenshotsError(null);
          setIsFromOrderEmail(true); // Opened from admin email (Edit Tools link) → show 300 DPI actions, not Apply Edits
          // If any product is missing product image, fetch by name so we show product mockup (measure screenshot over print area)
          const missing = mapped.filter((item) => item.name && !item.productImage);
          if (missing.length > 0) {
            Promise.all(
              missing.map((item) =>
                fetch(apiJoin(`/api/product-preview-url?name=${encodeURIComponent(item.name)}`))
                  .then((r) => r.ok ? r.json() : null)
                  .then((data) => (data && data.url ? { ...item, productImage: toolsPreviewMockupUrl(item.name, data.url) } : item))
                  .catch(() => item)
              )
            ).then((filled) => {
              if (filled.some((f) => f.productImage)) {
                const updated = mapped.map((m) => {
                  const i = missing.findIndex((x) => x.name === m.name && x.originalCartIndex === m.originalCartIndex);
                  if (i >= 0 && filled[i].productImage) return { ...m, productImage: filled[i].productImage };
                  return m;
                });
                setCartProducts(updated);
                console.log('📦 Fetched product preview URLs for Tools (screenshot over print area)');
              }
            });
          }
          // Auto-select Fit to Print Area to order's product so screenshot auto-resizes to print area (like cart tools)
          if (mapped.length > 0) {
            const firstProductName = matchPrintAreaProductName(mapped[0].name);
            if (firstProductName) {
              setSelectedProductName(firstProductName);
              setPrintAreaFit('product');
              setProductSelectClicked(true);
            }
          }
          console.log(`📦 Loaded ${mapped.length} screenshot(s) from order ${trimmedOrderId} (same as Print Quality / email)`);
        } else {
          setCartProducts([]);
          setSelectedCartProductIndex(null);
          setOrderScreenshotsError('No screenshots found for this order.');
          setIsFromOrderEmail(false);
        }
        setOrderScreenshotsLoading(false);
      })
      .catch((error) => {
        if (!cancelled) {
          setOrderScreenshotsError(error.message || 'Error loading order screenshots');
          setCartProducts([]);
          setSelectedCartProductIndex(null);
          orderIdLoadedRef.current = null;
          setIsFromOrderEmail(false);
          setOrderScreenshotsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [searchParams]);

  // Load cart products on mount and when component becomes visible (skip when order_id in URL — those come from order API)
  useEffect(() => {
    if (searchParams.get('order_id')) return;

    const loadCartProducts = () => {
      try {
        if (entrySelectRef.current) {
          resyncMerchSessionFromStorage();
        }
        const cartItems = readCartItems();
        if (cartItems && cartItems.length > 0) {
          // Filter items that have screenshots, preserving original cart index
          const productsWithScreenshots = cartItems
            .map((item, originalIndex) => ({
              originalCartIndex: originalIndex, // Store original cart index for matching
              name: item.name || 'Product',
              color: item.color || 'N/A',
              size: item.size || 'N/A',
              category: item.category || '',
              printful_catalog_product_id: item.printful_catalog_product_id || null,
              screenshot: item.originalScreenshot || item.screenshot || '',
              originalScreenshot: item.originalScreenshot || '',
              productImage: toolsPreviewMockupUrl(item.name || item.product, item.image || ''),
              imageOrientation: item.imageOrientation || item.toolSettings?.imageOrientation || '',
              toolSettings: item.toolSettings || null // Store tool settings if they exist
            }))
            .filter(item => item.screenshot && item.screenshot.trim() !== '')
            .map((item, filteredIndex) => ({
              ...item,
              filteredIndex // Also store filtered index for dropdown
            }));
          
          setCartProducts(productsWithScreenshots);
          
          // Newest cart item wins and resets preview after an add.
          // Editing a specific item still honors tools_focus_cart_index.
          if (productsWithScreenshots.length > 0) {
            const lastIndex = productsWithScreenshots.length - 1;
            const identity = cartIdentity(productsWithScreenshots);
            const identityChanged = identity !== cartIdentityRef.current;
            cartIdentityRef.current = identity;
            const previousCount = cartCountRef.current;
            const addedWhileOpen = productsWithScreenshots.length > previousCount && previousCount > 0;
            const cartGrew = productsWithScreenshots.length > previousCount;
            cartCountRef.current = productsWithScreenshots.length;
            const demoStore = isDemoStorefront();
            const forceEntry = entrySelectRef.current;
            if (forceEntry) entrySelectRef.current = false;

            const seenCount = readToolsSeenCartCount();
            const newProductAdded = productsWithScreenshots.length > seenCount;
            writeToolsSeenCartCount(productsWithScreenshots.length);
            const focusOriginal = peekToolsFocusCartIndex();
            const previewNewestFlag = consumeToolsPreviewNewest();
            // Returning from Confirm/Preview Design sets a focus index and must
            // keep live edits. Do not treat that remount as a newest-item reset.
            const showNewest = previewNewestFlag
              || addedWhileOpen
              || (newProductAdded && focusOriginal == null);

            let nextIndex = lastIndex;
            if (showNewest) {
              const matched = focusOriginal != null
                ? productsWithScreenshots.findIndex((p) => p.originalCartIndex === focusOriginal)
                : -1;
              if (focusOriginal != null) consumeToolsFocusCartIndex();
              nextIndex = matched >= 0 ? matched : lastIndex;
            } else if (focusOriginal != null) {
              consumeToolsFocusCartIndex();
              const matched = productsWithScreenshots.findIndex(
                (p) => p.originalCartIndex === focusOriginal
              );
              nextIndex = matched >= 0 ? matched : lastIndex;
            } else if (forceEntry || (!demoStore && cartGrew)) {
              nextIndex = lastIndex;
            } else if (
              selectedCartProductIndexRef.current !== null &&
              selectedCartProductIndexRef.current < productsWithScreenshots.length
            ) {
              nextIndex = selectedCartProductIndexRef.current;
            }

            const chosen = productsWithScreenshots[nextIndex];
            if (identityChanged && chosen && !showNewest) {
              const slot = slotStateRef.current[nextIndex];
              if (slot && slot.sourceScreenshot && !slotMatchesCartShot(slot, chosen)) {
                delete slotStateRef.current[nextIndex];
                persistEditorSlotsNow();
                setEditedImageUrl('');
              }
            }
            if (showNewest && chosen) {
              const existingSlot = slotStateRef.current[nextIndex];
              const sameShot = slotMatchesCartShot(existingSlot, chosen);
              if (!sameShot) {
                switchingSlotRef.current = true;
                delete slotStateRef.current[nextIndex];
                persistEditorSlotsNow();
                fitUserSetRef.current[nextIndex] = false;
                delete autoFitCartIndexRef.current[nextIndex];
                printFilterKeyRef.current = '';
                setEditedImageUrl('');
                setFitPreviewImageUrl('');
                setScreenshotSizeInteracted(true);
                setImageOffsetX(0);
                setImageOffsetY(0);
                applySavedEditorFields(EDITOR_SLOT_DEFAULTS);
                orientationUserSetRef.current = false;
                applyArtworkOrientation(chosen, chosen?.screenshot, orientationUserSetRef, setImageOrientation);
              }
            }
            if (showNewest || nextIndex !== selectedCartProductIndexRef.current || forceEntry) {
              selectedCartProductIndexRef.current = nextIndex;
              setSelectedCartProductIndex(nextIndex);
              const slot = !showNewest ? slotStateRef.current[nextIndex] : null;
              const matchedName = (slot && slot.selectedProductName) || matchPrintAreaProductName(chosen?.name) || '';
              if (matchedName) {
                setSelectedProductName(matchedName);
                setPrintAreaFit((slot && slot.printAreaFit) || 'product');
                setProductSelectClicked(true);
              } else {
                setSelectedProductName('');
                setPrintAreaFit((slot && slot.printAreaFit) || 'none');
              }
              const settings = showNewest ? null : chosen?.toolSettings;
              const savedSlot = !showNewest ? slotStateRef.current[nextIndex] : null;
              const restoreEdits = savedSlot || settings;
              if (!showNewest && restoreEdits) {
                applySavedEditorFields(restoreEdits);
              }
              const sessionScale = savedSlot?.screenshotScale;
              const cartScale = settings && typeof settings.screenshotScale === 'number'
                ? settings.screenshotScale
                : undefined;
              setScreenshotScale(
                sessionScale !== undefined
                  ? sessionScale
                  : (cartScale !== undefined ? cartScale : 100)
              );
              if (chosen && savedSlot && savedSlot.offsetX !== undefined) {
                const ox = savedSlot.offsetX ?? 0;
                const oy = savedSlot.offsetY ?? 0;
                const cartIdx = chosen.originalCartIndex;
                setProductImageOffsets(prev => ({
                  ...prev,
                  [cartIdx]: { x: ox, y: oy }
                }));
              } else if (chosen && settings && settings.offsetX !== undefined && settings.offsetY !== undefined) {
                const ox = settings.offsetX;
                const oy = settings.offsetY;
                const cartIdx = chosen.originalCartIndex;
                setProductImageOffsets(prev => ({
                  ...prev,
                  [cartIdx]: { x: ox, y: oy }
                }));
              } else if (chosen) {
                const cartIdx = chosen.originalCartIndex;
                setProductImageOffsets(prev => ({
                  ...prev,
                  [cartIdx]: { x: 0, y: 0 }
                }));
              }
            }
            if (productsWithScreenshots.length > 1) {
              console.log(`🛍️ Found ${productsWithScreenshots.length} products in cart`);
            }
          }
        } else {
          cartCountRef.current = 0;
          cartIdentityRef.current = '';
          writeToolsSeenCartCount(0);
          setCartProducts([]);
          setSelectedCartProductIndex(null);
        }
      } catch (e) {
        console.warn('Could not load cart items:', e);
        cartCountRef.current = 0;
        cartIdentityRef.current = '';
        writeToolsSeenCartCount(0);
        setCartProducts([]);
        setSelectedCartProductIndex(null);
      }
    };
    
    // Load immediately
    loadCartProducts();
    
    // Also listen for storage changes (when cart is updated in other tabs/pages)
    const handleStorageChange = (e) => {
      if (e.key === 'cart_items') {
        loadCartProducts();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(CART_UPDATED_EVENT, loadCartProducts);
    
    // Also check periodically in case localStorage is updated in same tab
    const checkInterval = setInterval(loadCartProducts, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(CART_UPDATED_EVENT, loadCartProducts);
      clearInterval(checkInterval);
    };
  }, [searchParams, sessionEpoch, location.key]); // Re-run on Tools visit, bfcache, or cart selection

  // Load screenshot and product name from localStorage or URL params
  useEffect(() => {
    const loadScreenshot = () => {
      try {
        // Priority 1: Use selected cart product screenshot if available
        if (selectedCartProductIndex !== null && cartProducts.length > 0 && cartProducts[selectedCartProductIndex]) {
          const selectedProduct = cartProducts[selectedCartProductIndex];
          if (selectedProduct.screenshot && selectedProduct.screenshot.trim() !== '') {
            const screenshotFromCart = selectedProduct.screenshot;
            const pending = readPendingMerchData() || {};
            const preferred = pending.selected_screenshot || '';
            const pendingEdited = pending.edited_screenshot || '';
            let screenshot = screenshotFromCart;
            // Never replace a cart item that already has art with leftover
            // pending_merch from a previous product.
            if (!screenshotFromCart && preferred && !pendingEdited) {
              screenshot = preferred;
              try {
                const cartItems = readCartItems();
                const origIdx = selectedProduct.originalCartIndex;
                if (Array.isArray(cartItems) && cartItems[origIdx]) {
                  cartItems[origIdx] = {
                    ...cartItems[origIdx],
                    screenshot: preferred,
                    selected_screenshot: preferred
                  };
                  writeCartItems(cartItems);
                }
              } catch (_) { /* ignore */ }
              if (slotStateRef.current[selectedCartProductIndex]) {
                slotStateRef.current[selectedCartProductIndex] = {
                  ...slotStateRef.current[selectedCartProductIndex],
                  editedImageUrl: ''
                };
              }
            }
            // Avoid clobbering an in-progress edit when cart poll reloads the same image
            const savedFromSlot = slotStateRef.current[selectedCartProductIndex];
            const savedFromCart = editorSlotFromCartItem(selectedProduct);
            const slotMatches = savedMatchesSourcePreview(savedFromSlot, screenshot, screenshotFromCart);
            const cartMatches = Boolean(savedFromCart) && screenshotFromCart === (selectedProduct.screenshot || selectedProduct.selected_screenshot || '');
            const saved = slotMatches ? savedFromSlot : (cartMatches ? savedFromCart : savedFromSlot);
            if (saved === savedFromCart && savedFromCart) {
              slotStateRef.current[selectedCartProductIndex] = savedFromCart;
            }
            const matchedName = matchPrintAreaProductName(selectedProduct.name);
            const resolvedName = (saved && saved.selectedProductName) || matchedName || '';
            const savedFit = saved && saved.printAreaFit;
            const userChoseNoFit = Boolean(saved && saved.fitUserSet && savedFit === 'none');
            const resolvedFit = userChoseNoFit
              ? 'none'
              : (savedFit && savedFit !== 'none'
                ? savedFit
                : (resolvedName ? 'product' : 'none'));
            if (screenshot === imageUrl && !switchingSlotRef.current) {
              // Same image, but first load used to skip Product Specific forever.
              if (!userChoseNoFit && resolvedName) {
                setSelectedProductName((prev) => prev || resolvedName);
                setPrintAreaFit((prev) => (prev && prev !== 'none' ? prev : 'product'));
              }
              if (saved && savedMatchesSourcePreview(saved, screenshot, screenshotFromCart)) {
                applySavedEditorFields(saved);
                if (saved.imageOrientation === 'landscape' || saved.imageOrientation === 'portrait') {
                  orientationUserSetRef.current = true;
                  setImageOrientation(saved.imageOrientation);
                }
              }
              editorHydratedRef.current = true;
              return;
            }
            if (screenshot !== imageUrl) {
              upgradeTriggeredRef.current = false;
              if (!savedMatchesSourcePreview(saved, screenshot, screenshotFromCart)) {
                fitUserSetRef.current[selectedCartProductIndex] = false;
                setEditedImageUrl('');
              }
            }
            setImageUrl(screenshot);
            setSelectedImage(screenshot);
            setIsUpgrading(false);
            const savedMatchesSource = savedMatchesSourcePreview(saved, screenshot, screenshotFromCart);
            if (savedMatchesSource) {
              fitUserSetRef.current[selectedCartProductIndex] = Boolean(saved.fitUserSet);
              setEditedImageUrl('');
              setScreenshotScale(saved.screenshotScale ?? 100);
              setSelectedProductName(resolvedName);
              setPrintAreaFit(resolvedFit);
              applySavedEditorFields(saved);
              if (saved.imageOrientation === 'landscape' || saved.imageOrientation === 'portrait') {
                orientationUserSetRef.current = true;
                setImageOrientation(saved.imageOrientation);
              } else {
                applyArtworkOrientation(selectedProduct, screenshot, orientationUserSetRef, setImageOrientation);
              }
              setPrintQualityImageUrl(saved.printQualityImageUrl || '');
              setPrintQualityMeta(saved.printQualityMeta || null);
              const cartIndex = selectedProduct.originalCartIndex;
              const ox = saved.offsetX ?? 0;
              const oy = saved.offsetY ?? 0;
              setProductImageOffsets(prev => ({ ...prev, [cartIndex]: { x: ox, y: oy } }));
            } else {
              fitUserSetRef.current[selectedCartProductIndex] = false;
              setEditedImageUrl('');
              setScreenshotScale(100);
              setSelectedProductName(resolvedName);
              setPrintAreaFit(resolvedFit);
              applySavedEditorFields(EDITOR_SLOT_DEFAULTS);
              const cartOri = selectedProduct.imageOrientation || selectedProduct.toolSettings?.imageOrientation || selectedProduct.image_orientation;
              if (cartOri === 'landscape' || cartOri === 'portrait') {
                orientationUserSetRef.current = true;
                setImageOrientation(cartOri);
              } else {
                orientationUserSetRef.current = false;
                applyArtworkOrientation(selectedProduct, screenshot, orientationUserSetRef, setImageOrientation);
              }
              setPrintQualityImageUrl('');
              setPrintQualityMeta(null);
              const cartIndex = selectedProduct.originalCartIndex;
              setProductImageOffsets(prev => ({ ...prev, [cartIndex]: { x: 0, y: 0 } }));
              if (resolvedFit === 'product' && resolvedName) {
                setScreenshotSizeInteracted(true);
              }
            }
            editorHydratedRef.current = true;
            if (resolvedName) setProductSelectClicked(true);
            setTimeout(function clearSwitchFlag() {
              switchingSlotRef.current = false;
              setSlotSwitchTick(t => t + 1);
            }, 0);
            console.log(`📸 Loaded screenshot from cart product ${selectedCartProductIndex + 1}: ${selectedProduct.name}`);
            return; // Exit early, don't check other sources
          }
        }
        
        // Priority 2: Only an explicitly chosen working shot. Do not fall back to
        // screenshots[0]/thumbnail — that keeps the previous image after cart-empty
        // or when the user goes back to pick another video/image.
        const data = readPendingMerchData();
        const cartEmpty = !cartProducts.length;
        const screenshot = cartEmpty
          ? (data?.selected_screenshot || '')
          : (data?.edited_screenshot || data?.selected_screenshot || '');
        if (!screenshot) {
          slotStateRef.current = {};
          if (imageUrl || editedImageUrl) {
            setImageUrl('');
            setSelectedImage('');
            setEditedImageUrl('');
            setPrintQualityImageUrl('');
            setPrintQualityMeta(null);
          }
        } else if (data && (data.screenshots?.length || data.selected_screenshot || data.thumbnail || data.edited_screenshot)) {
          // Priority: edited screenshot > selected screenshot (never gallery leftovers)
          if (screenshot) {
            // Reset upgrade trigger if image changed
            if (screenshot !== imageUrl) {
              upgradeTriggeredRef.current = false;
              setEditedImageUrl('');
            }
            setImageUrl(screenshot);
            setSelectedImage(screenshot);
            if (cartEmpty) {
              setEditedImageUrl('');
              slotStateRef.current = {};
              applyArtworkOrientation(null, screenshot, orientationUserSetRef, setImageOrientation);
            }
            // Reset upgrading state when new image loads (will be set again when image actually loads)
            setIsUpgrading(false);
          }
          // Check if upgrade failed - but verify the current image isn't already upgraded
          // If we have a print quality screenshot that matches the current image, clear failure
          if (data.print_quality_upgrade_failed) {
            console.log('🔍 [UPGRADE] Found failure flag in localStorage, checking if image is actually upgraded...');
            // Check if the current screenshot is actually the upgraded one
            const currentScreenshot = data.edited_screenshot || data.selected_screenshot || data.screenshots?.[0] || data.thumbnail || '';
            if (data.print_quality_screenshot && currentScreenshot === data.print_quality_screenshot) {
              // Image is already upgraded, clear failure flag
              console.log('✅ [UPGRADE] Current image matches print_quality_screenshot - clearing failure flag');
              setUpgradeFailed(false);
              // Also clear the flag in localStorage
              try {
                delete data.print_quality_upgrade_failed;
                localStorage.setItem('pending_merch_data', JSON.stringify(data));
              } catch (e) {
                console.warn('Could not clear failure flag:', e);
              }
            } else if (currentImageDimensions.width && currentImageDimensions.height && currentImageDimensions.width >= 2000 && currentImageDimensions.height >= 2000) {
              // Image dimensions indicate it's already at print quality, clear failure flag
              console.log('✅ [UPGRADE] Image dimensions indicate print quality - clearing failure flag', {
                width: currentImageDimensions.width,
                height: currentImageDimensions.height
              });
              setUpgradeFailed(false);
              // Also clear the flag in localStorage
              try {
                delete data.print_quality_upgrade_failed;
                localStorage.setItem('pending_merch_data', JSON.stringify(data));
              } catch (e) {
                console.warn('Could not clear failure flag:', e);
              }
            } else {
              // Upgrade actually failed - but don't set the state yet, wait for image to load
              // The image load handler will check dimensions and clear if needed
              console.log('⚠️ [UPGRADE] Failure flag found and image appears to be small - will check again when image loads');
              setUpgradeFailed(true);
              setIsUpgrading(false);
            }
          } else {
            // No failure flag, clear failure state
            setUpgradeFailed(false);
          }
          // Cart item is the source of truth; leftover pending_merch names
          // must not keep Product Preview on a previous shirt.
          if (data.selected_product_name && !(selectedCartProductIndex !== null && cartProducts[selectedCartProductIndex])) {
            setSelectedProductName(data.selected_product_name);
            setPrintAreaFit((prev) => (prev && prev !== 'none' ? prev : 'product'));
          }
        }
        
        // Also check if there's a selected screenshot from URL params
        const selectedScreenshot = searchParams.get('screenshot');
        if (selectedScreenshot) {
          if (selectedScreenshot !== imageUrl) {
            upgradeTriggeredRef.current = false;
          }
          setImageUrl(selectedScreenshot);
          setSelectedImage(selectedScreenshot);
        }
      } catch (e) {
        console.warn('Could not load screenshot from localStorage:', e);
      }
    };
    
    // Load immediately
    loadScreenshot();
  }, [selectedCartProductIndex, cartProducts]); // Re-run when cart product selection changes

  // Auto-apply this product's recorded print area (W×H) so the screenshot
  // fills Product Preview without dragging Screenshot Size. Scale stays 100
  // unless the shopper already saved a size for this cart item.
  useEffect(() => {
    if (selectedCartProductIndex === null) return;
    const product = cartProducts[selectedCartProductIndex];
    if (!product?.name) return;
    if (fitUserSetRef.current[selectedCartProductIndex]) {
      const matched = matchPrintAreaProductName(product.name);
      if (matched) {
        setSelectedProductName((prev) => prev || matched);
        setProductSelectClicked(true);
      }
      return;
    }
    const filter = getProductPrintFilter(product.name, product.size);
    if (!filter) return;
    const key = `${selectedCartProductIndex}|${product.originalCartIndex}|${filter.name}|${product.size || ''}|${filter.width}x${filter.height}`;
    if (printFilterKeyRef.current === key) return;
    printFilterKeyRef.current = key;
    setSelectedProductName(filter.name);
    setPrintAreaFit('product');
    setProductSelectClicked(true);
    if (slotStateRef.current[selectedCartProductIndex]?.screenshotScale === undefined) {
      setScreenshotScale(100);
    }
    setScreenshotSizeInteracted(true);
    autoFitCartIndexRef.current[selectedCartProductIndex] = true;
  }, [selectedCartProductIndex, cartProducts]);

  useEffect(() => {
    if (imageOrientation !== 'landscape') return;
    const product = selectedCartProductIndex != null ? cartProducts[selectedCartProductIndex] : null;
    const name = selectedProductName || product?.name || '';
    if (!locksImageOffsetsInLandscape(name, imageOrientation)) return;
    setImageOffsetX(0);
    setImageOffsetY(0);
    if (selectedCartProductIndex == null) return;
    setProductImageOffsets((prev) => {
      const cur = prev[selectedCartProductIndex];
      if (cur && cur.x === 0 && cur.y === 0) return prev;
      return { ...prev, [selectedCartProductIndex]: { x: 0, y: 0 } };
    });
  }, [imageOrientation, selectedCartProductIndex, selectedProductName, cartProducts]);

  // When Fit to Print names a product that is not the current cart item,
  // load that product's mockup so the screenshot can be tested on it.
  useEffect(() => {
    const name = selectedProductName;
    const cartProduct = selectedCartProductIndex != null ? cartProducts[selectedCartProductIndex] : null;
    const cartMatched = cartProduct
      ? (matchPrintAreaProductName(cartProduct.name) || cartProduct.name)
      : '';
    if (!name || name === cartMatched) {
      setFitPreviewImageUrl('');
      return;
    }
    let cancelled = false;
    fetch(apiJoin(`/api/product-preview-url?name=${encodeURIComponent(name)}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.url) setFitPreviewImageUrl(data.url);
        else if (!cancelled) setFitPreviewImageUrl('');
      })
      .catch(() => {
        if (!cancelled) setFitPreviewImageUrl('');
      });
    return () => { cancelled = true; };
  }, [selectedProductName, selectedCartProductIndex, cartProducts]);

  // Listen for storage events and set up upgrade checking
  useEffect(() => {
    // Listen for storage events (when print quality upgrade completes from other tabs)
    const applyWorkingScreenshot = (data) => {
      // Cart items own their screenshots. Do not paste leftover pending_merch
      // art over every product when the user is testing other cart items.
      const items = readCartItems();
      if (Array.isArray(items) && items.length > 0) {
        return;
      }
      const screenshot = data?.selected_screenshot || '';
      if (!screenshot) {
        if (imageUrl || editedImageUrl) {
          setImageUrl('');
          setSelectedImage('');
          setEditedImageUrl('');
        }
      } else if (screenshot !== imageUrl) {
        setImageUrl(screenshot);
        setSelectedImage(screenshot);
        setEditedImageUrl('');
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === 'pending_merch_data' || e.key === 'cart_items') {
        try {
          applyWorkingScreenshot(readPendingMerchData());
        } catch (err) {
          console.warn('Could not parse storage data:', err);
        }
      }
    };
    
    // Listen for custom event (when print quality upgrade completes in same tab)
    const handleLocalStorageUpdate = () => {
      try {
        applyWorkingScreenshot(readPendingMerchData());
      } catch (err) {
        console.warn('Could not parse storage data:', err);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageUpdated', handleLocalStorageUpdate);
    window.addEventListener(PENDING_MERCH_UPDATED_EVENT, handleLocalStorageUpdate);
    window.addEventListener(CART_UPDATED_EVENT, handleLocalStorageUpdate);
    
    // Also check periodically for upgrades (backup in case events don't fire)
    // Check more frequently for first 10 seconds, then every 5 seconds for up to 70 seconds total
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      checkCount++;
      // Check if upgrade has been running too long (more than 60 seconds)
      try {
        const raw = localStorage.getItem('pending_merch_data');
        if (raw) {
          const data = JSON.parse(raw);
          if (data.print_quality_upgrade_timestamp) {
            const timeSinceUpgrade = Date.now() - data.print_quality_upgrade_timestamp;
            if (timeSinceUpgrade > 60000 && !data.print_quality_upgrade_failed) {
              // Upgrade has been running for more than 60 seconds, mark as failed
              data.print_quality_upgrade_failed = true;
              localStorage.setItem('pending_merch_data', JSON.stringify(data));
            }
          }
        }
      } catch (e) {
        console.warn('Could not check upgrade status:', e);
      }
    }, 2000); // Check every 2 seconds
    
    // Stop checking after 70 seconds (enough time for 60 second timeout + buffer)
    setTimeout(() => clearInterval(checkInterval), 70000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageUpdated', handleLocalStorageUpdate);
      window.removeEventListener(PENDING_MERCH_UPDATED_EVENT, handleLocalStorageUpdate);
      window.removeEventListener(CART_UPDATED_EVENT, handleLocalStorageUpdate);
      clearInterval(checkInterval);
    };
  }, [searchParams, imageUrl]);

  // Circular-arc rounded rect so mid-range Angle Radius is actually visible.
  const addRoundedRectPath = (ctx, x, y, width, height, radius) => {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  };

  const drawRoundedRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    addRoundedRectPath(ctx, x, y, width, height, radius);
  };

  // Manual 300 DPI upgrade function (no longer automatic)
  const triggerPrintQualityUpgrade = () => {
    if (!imageUrl || !currentImageDimensions.width || !currentImageDimensions.height) {
      console.log('🔍 [UPGRADE] Cannot upgrade: missing imageUrl or dimensions');
      return;
    }
    
    // Check if image is small (likely client-side capture) - needs upgrade
    // Small images are typically < 2000 pixels in either dimension
    const isSmallImage = currentImageDimensions.width < 2000 || currentImageDimensions.height < 2000;
    
    // Don't trigger if image is already large enough
    if (!isSmallImage) {
      console.log('✅ [UPGRADE] Image is already at print quality, no upgrade needed');
      alert('Image is already at print quality!');
      return;
    }
    
    // Don't trigger if upgrade is already in progress
    if (isUpgrading) {
      console.log('⏸️ [UPGRADE] Upgrade already in progress');
      return;
    }
    
    // Check current upgrade state from localStorage
    let currentUpgradeInProgress = false;
    let currentUpgradeFailed = false;
    try {
      const raw = localStorage.getItem('pending_merch_data');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.print_quality_upgrade_timestamp) {
          const timeSinceUpgrade = Date.now() - data.print_quality_upgrade_timestamp;
          currentUpgradeInProgress = timeSinceUpgrade < 60000;
          console.log('🔍 [UPGRADE] Upgrade timestamp check', {
            timestamp: data.print_quality_upgrade_timestamp,
            timeSinceUpgrade: Math.round(timeSinceUpgrade / 1000) + 's',
            inProgress: currentUpgradeInProgress
          });
        }
        currentUpgradeFailed = !!data.print_quality_upgrade_failed;
        console.log('🔍 [UPGRADE] Failure flag check', { failed: currentUpgradeFailed });
      }
    } catch (e) {
      console.warn('❌ [UPGRADE] Could not check upgrade status:', e);
    }
    
    // Don't trigger if upgrade is currently in progress (within last 60 seconds)
    // BUT allow retry if it previously failed (failure flag might be stale)
    if (currentUpgradeInProgress) {
      console.log('⏸️ [UPGRADE] Skipping: upgrade currently in progress', {
        inProgress: currentUpgradeInProgress
      });
      return;
    }
    
    // If it previously failed, log it but still allow retry
    if (currentUpgradeFailed) {
      console.log('⚠️ [UPGRADE] Previous upgrade failed, but allowing retry...', {
        failed: currentUpgradeFailed
      });
      // Clear the failure flag so we can try again
      try {
        const raw = localStorage.getItem('pending_merch_data');
        if (raw) {
          const data = JSON.parse(raw);
          delete data.print_quality_upgrade_failed;
          localStorage.setItem('pending_merch_data', JSON.stringify(data));
          console.log('✅ [UPGRADE] Cleared previous failure flag to allow retry');
        }
      } catch (e) {
        console.warn('⚠️ [UPGRADE] Could not clear failure flag, but continuing anyway:', e);
      }
    }
    
    // Check if image has already been upgraded (check if there's a print quality version)
    try {
      const raw = localStorage.getItem('pending_merch_data');
      if (raw) {
        const data = JSON.parse(raw);
        // If the current image URL matches a print quality screenshot, don't upgrade again
        if (data.print_quality_screenshot && imageUrl === data.print_quality_screenshot) {
          upgradeTriggeredRef.current = true;
          return;
        }
      }
    } catch (e) {
      console.warn('Could not check if image already upgraded:', e);
    }
    
    // Mark that we're triggering an upgrade
    console.log('🚀 [UPGRADE] Starting manual 300 DPI upgrade');
    upgradeTriggeredRef.current = true;
    setIsUpgrading(true);
    setUpgradeFailed(false); // Clear any previous failure state
    
    // Mark upgrade as starting in localStorage
    try {
      const raw = localStorage.getItem('pending_merch_data');
      if (raw) {
        const data = JSON.parse(raw);
        data.print_quality_upgrade_timestamp = Date.now();
        delete data.print_quality_upgrade_failed; // Clear any previous failure
        localStorage.setItem('pending_merch_data', JSON.stringify(data));
        window.dispatchEvent(new Event('localStorageUpdated'));
        console.log('✅ [UPGRADE] Marked upgrade as starting in localStorage');
      }
    } catch (e) {
      console.warn('❌ [UPGRADE] Failed to mark upgrade as starting:', e);
    }
    
    // Trigger manual 300 DPI upgrade
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn('⚠️ Print quality upgrade timed out after 120 seconds');
      // Mark upgrade as failed
      try {
        const raw = localStorage.getItem('pending_merch_data');
        if (raw) {
          const data = JSON.parse(raw);
          data.print_quality_upgrade_failed = true;
          localStorage.setItem('pending_merch_data', JSON.stringify(data));
          window.dispatchEvent(new Event('localStorageUpdated'));
        }
      } catch (e) {
        console.warn('Failed to mark upgrade as failed:', e);
      }
      setIsUpgrading(false);
      setUpgradeFailed(true);
    }, 120000); // 120 second timeout (increased from 60s)
    
    // Convert image to base64 if it's not already
    const getImageAsBase64 = async (url) => {
      // If it's already a data URL, return it
      if (url.startsWith('data:image')) {
        return url;
      }
      
      // If it's a blob URL, convert it
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('Failed to convert image to base64:', error);
        throw error;
      }
    };
    
    // Use process-thumbnail-print-quality endpoint to upgrade the image
    const upgradeUrl = API_CONFIG.BASE_URL === 'http://127.0.0.1:5000' 
      ? 'http://127.0.0.1:5000/api/process-thumbnail-print-quality'
      : 'https://screenmerch.fly.dev/api/process-thumbnail-print-quality';
    
    console.log('🌐 [UPGRADE] API URL:', upgradeUrl);
    console.log('🖼️ [UPGRADE] Converting image to base64...');
    
    // Convert image to base64 first
    getImageAsBase64(imageUrl)
      .then(base64Image => {
        console.log('✅ [UPGRADE] Image converted to base64, size:', Math.round(base64Image.length / 1024) + ' KB');
        console.log('📤 [UPGRADE] Sending request to:', upgradeUrl);
        return fetch(upgradeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            thumbnail_data: base64Image,
            print_dpi: 300,
            soft_corners: false,
            edge_feather: false
          }),
          signal: controller.signal
        });
      })
        .then(response => {
          clearTimeout(timeoutId);
          console.log('📥 [UPGRADE] Response received:', response.status, response.statusText);
          if (!response.ok) {
            return response.text().then(text => {
              let errorMsg = `Server responded with status: ${response.status}`;
              try {
                const errorData = JSON.parse(text);
                errorMsg = errorData.error || errorMsg;
              } catch (e) {
                errorMsg = text || errorMsg;
              }
              console.error('❌ [UPGRADE] Server error:', errorMsg);
              throw new Error(errorMsg);
            });
          }
          return response.json();
        })
      .then(result => {
      console.log('📦 [UPGRADE] Response data received:', { success: result.success, hasScreenshot: !!result.screenshot, dimensions: result.dimensions });
      if (result.success && result.screenshot) {
        // Check if upgrade actually increased dimensions
        const upgradedWidth = result.dimensions?.width || 0;
        const upgradedHeight = result.dimensions?.height || 0;
        const wasUpgraded = upgradedWidth >= 2000 || upgradedHeight >= 2000;
        
        console.log('✅ [UPGRADE] Upgrade successful! Updating UI...');
        console.log('📊 [UPGRADE] New image size:', result.screenshot ? Math.round(result.screenshot.length / 1024) + ' KB' : 'N/A');
        console.log('📐 [UPGRADE] Upgraded dimensions:', { width: upgradedWidth, height: upgradedHeight, wasUpgraded });
        
        if (!wasUpgraded) {
          console.warn('⚠️ [UPGRADE] Upgrade completed but dimensions are still small - upgrade may have failed silently');
        }
        // IMPORTANT: Update UI state FIRST - the upgrade succeeded regardless of localStorage
        // Clear failure flag IMMEDIATELY since upgrade succeeded
        setUpgradeFailed(false);
        setIsUpgrading(false);
        // Force image reload by clearing first, then setting
        // This ensures React detects the change and reloads the image
        const oldUrl = imageUrl;
        setImageUrl('');
        setSelectedImage('');
        
        // Use setTimeout to ensure state updates properly and force re-render
        setTimeout(() => {
          // Add a cache-busting parameter to force reload if it's the same URL
          const newImageUrl = result.screenshot;
          setImageUrl(newImageUrl);
          setSelectedImage(newImageUrl);
          console.log('🔄 [UPGRADE] Image URL updated, waiting for dimensions to load...');
          console.log('📏 [UPGRADE] Expected dimensions from server:', { width: upgradedWidth, height: upgradedHeight });
          
          // Force a check after image should have loaded (2 seconds)
          setTimeout(() => {
            const img = new Image();
            img.onload = () => {
              console.log('🔍 [UPGRADE] Verification - Image actually loaded with dimensions:', { width: img.width, height: img.height });
              if (img.width >= 2000 || img.height >= 2000) {
                console.log('✅ [UPGRADE] Verified: Image is at print quality!');
                setCurrentImageDimensions({ width: img.width, height: img.height });
              } else {
                console.warn('⚠️ [UPGRADE] Warning: Image loaded but dimensions are still small:', { width: img.width, height: img.height });
              }
            };
            img.onerror = () => {
              console.error('❌ [UPGRADE] Failed to load upgraded image');
            };
            img.src = newImageUrl;
          }, 2000);
        }, 100);
        
        // Clear failure flag in localStorage immediately (before trying to save the large image)
        try {
          const raw = localStorage.getItem('pending_merch_data');
          if (raw) {
            const data = JSON.parse(raw);
            delete data.print_quality_upgrade_failed;
            // Try to save just the flag clearing (small operation)
            try {
              localStorage.setItem('pending_merch_data', JSON.stringify(data));
              console.log('✅ [UPGRADE] Cleared failure flag in localStorage');
            } catch (e) {
              console.warn('⚠️ [UPGRADE] Could not clear failure flag in localStorage, but upgrade succeeded');
            }
          }
        } catch (e) {
          console.warn('⚠️ [UPGRADE] Error clearing failure flag:', e);
        }
        
        // Then try to save to localStorage (but don't let failures affect UI state)
        try {
          const raw = localStorage.getItem('pending_merch_data');
          if (raw) {
            const data = JSON.parse(raw);
            
            // Update the appropriate screenshot field
            if (data.selected_screenshot === imageUrl) {
              data.selected_screenshot = result.screenshot;
            } else if (data.screenshots && Array.isArray(data.screenshots)) {
              const index = data.screenshots.findIndex(s => s === imageUrl);
              if (index >= 0) {
                data.screenshots[index] = result.screenshot;
              }
            } else if (data.thumbnail === imageUrl) {
              data.thumbnail = result.screenshot;
            }
            
            // Store print quality version
            data.print_quality_screenshot = result.screenshot;
            
            // Clear upgrade flags FIRST before trying to save
            delete data.print_quality_upgrade_failed;
            delete data.print_quality_upgrade_timestamp;
            
            // Try to save - if it fails due to quota, clear more data
            try {
              localStorage.setItem('pending_merch_data', JSON.stringify(data));
            } catch (quotaError) {
              if (quotaError.name === 'QuotaExceededError') {
                console.warn('⚠️ localStorage quota exceeded, clearing old screenshots to make room');
                // Clear old screenshots array and thumbnail to free space
                delete data.screenshots;
                delete data.thumbnail;
                // Keep only the essential upgraded screenshot
                if (!data.selected_screenshot || data.selected_screenshot === imageUrl) {
                  data.selected_screenshot = result.screenshot;
                }
                // Make sure failure flag is still cleared
                delete data.print_quality_upgrade_failed;
                delete data.print_quality_upgrade_timestamp;
                // Try again with minimal data
                try {
                  localStorage.setItem('pending_merch_data', JSON.stringify(data));
                  console.log('✅ Saved upgraded screenshot after clearing old data');
                } catch (secondError) {
                  console.warn('⚠️ Still unable to save to localStorage, but upgrade succeeded. Image is available in memory.');
                  // Even if we can't save, try one more time with just the essential data and cleared flags
                  try {
                    const minimalData = {
                      selected_screenshot: result.screenshot,
                      print_quality_screenshot: result.screenshot,
                      selected_product_name: data.selected_product_name
                    };
                    localStorage.setItem('pending_merch_data', JSON.stringify(minimalData));
                    console.log('✅ Saved minimal data with upgraded screenshot');
                  } catch (finalError) {
                    console.warn('⚠️ Could not save even minimal data, but upgrade succeeded. Image is in memory.');
                  }
                }
              } else {
                throw quotaError;
              }
            }
            
            // Trigger custom event for same-tab updates
            window.dispatchEvent(new Event('localStorageUpdated'));
          }
        } catch (e) {
          console.warn('Failed to update localStorage with print quality screenshot:', e);
          // localStorage save failed, but upgrade succeeded - UI already updated above
        }
        
        console.log('✅ Screenshot upgraded to 300 DPI print quality');
        // IMPORTANT: Even if localStorage save failed, the upgrade succeeded and image is in memory
        // Don't show error - the image is available and will work for this session
        console.log('💡 [UPGRADE] Note: Image is in memory. If localStorage save failed, it will be lost on page reload, but works for current session.');
      } else {
        throw new Error(result.error || 'Server failed to upgrade screenshot');
      }
    })
      .catch(error => {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.warn('⚠️ [UPGRADE] Print quality upgrade aborted (timeout after 120s)');
          alert('Upgrade timed out. The image may be too large or the server is slow. Try again or use a smaller image.');
        } else {
          console.error('❌ [UPGRADE] Failed to upgrade screenshot to print quality:', error);
          alert(`Upgrade failed: ${error.message || 'Unknown error'}. Please try again.`);
        }
        setIsUpgrading(false);
        setUpgradeFailed(true);
      // Mark upgrade as failed in localStorage (only if it actually failed, not if localStorage quota was exceeded)
      try {
        const raw = localStorage.getItem('pending_merch_data');
        if (raw) {
          const data = JSON.parse(raw);
          // Only mark as failed if the API call actually failed, not if localStorage quota was exceeded
          // The upgrade might have succeeded but localStorage save failed
          if (error.name !== 'QuotaExceededError') {
            data.print_quality_upgrade_failed = true;
            localStorage.setItem('pending_merch_data', JSON.stringify(data));
            window.dispatchEvent(new Event('localStorageUpdated'));
          }
        }
      } catch (e) {
        console.warn('Failed to mark upgrade as failed:', e);
      }
    });
  };

  const selectedCartProduct = (selectedCartProductIndex !== null && cartProducts[selectedCartProductIndex])
    ? cartProducts[selectedCartProductIndex]
    : null;
  const fitProductSize = selectedCartProduct?.size || null;

  // Apply edits to image
  useEffect(() => {
    editedImageUrlRef.current = editedImageUrl;
  }, [editedImageUrl]);

  useEffect(() => {
    if (!imageUrl) return;
    if (switchingSlotRef.current) return;
    const hasLivePixelEdits = Boolean(
      featherEdge ||
      cornerRadius ||
      frameEnabled ||
      blackAndWhite ||
      featherFadeEnabled ||
      imageOpacityHasEdit(imageOpacity) ||
      (textEnabled && String(textContent || '').trim())
    );
    // Don't rasterize Original/uncropped while Product Specific is still pending.
    const idx = selectedCartProductIndex;
    const awaitingAutoProductFit =
      idx !== null &&
      cartProducts[idx] &&
      printAreaFit === 'none' &&
      imageOrientation !== 'landscape' &&
      !fitUserSetRef.current[idx] &&
      matchPrintAreaProductName(cartProducts[idx].name);
    if (awaitingAutoProductFit && !hasLivePixelEdits) return;
    if (printAreaFit === 'product' && !selectedProductName && !hasLivePixelEdits) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
    if (cancelled) return;
    const startBakeImage = (useCors) => {
    const img = new Image();
    if (useCors && /^https?:/i.test(imageUrl)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = async () => {
      if (cancelled) return;
      // Store current image dimensions
      const newDimensions = { width: img.width, height: img.height };
      setCurrentImageDimensions(newDimensions);
      console.log('🖼️ [IMAGE] Image loaded with dimensions:', newDimensions);
      
      // Check if image is already at print quality (large dimensions)
      // If image is large, it's already upgraded - clear any failure flags
      const isPrintQuality = img.width >= 2000 && img.height >= 2000;
      if (isPrintQuality) {
        console.log('✅ [UPGRADE] Image loaded with print quality dimensions:', { width: img.width, height: img.height });
        // Image is already at print quality, clear failure state
        setUpgradeFailed(false);
        // Also clear failure flag in localStorage if it exists
        try {
          const raw = localStorage.getItem('pending_merch_data');
          if (raw) {
            const data = JSON.parse(raw);
            if (data.print_quality_upgrade_failed) {
              console.log('✅ [UPGRADE] Clearing failure flag because image is at print quality');
              delete data.print_quality_upgrade_failed;
              try {
                localStorage.setItem('pending_merch_data', JSON.stringify(data));
                console.log('✅ [UPGRADE] Failure flag cleared in localStorage');
              } catch (e) {
                console.warn('⚠️ [UPGRADE] Could not save cleared flag to localStorage, but image is upgraded');
              }
            }
          }
        } catch (e) {
          console.warn('Could not clear failure flag:', e);
        }
      } else {
        console.log('🔍 [UPGRADE] Image dimensions are small:', { width: img.width, height: img.height });
      }
      
      // Check if image is small (likely client-side capture) - upgrade might be in progress
      // Small images are typically < 2000 pixels in either dimension
      const isSmallImage = img.width < 2000 || img.height < 2000;
      // Only set upgrading state if we haven't already triggered an upgrade
      if (isSmallImage && !upgradeTriggeredRef.current) {
        setIsUpgrading(isSmallImage);
      }
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: true }); // Ensure alpha channel for transparency
      canvas.width = img.width;
      canvas.height = img.height;

      // Create a temporary canvas for processing
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', { alpha: true }); // Ensure alpha channel
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;

      // Bake the visible print box (portrait / landscape / zoom) so Apply
      // Edits, checkout, and Generate 300 DPI match Screenshot Preview.
      let sourceWidth = img.width;
      let sourceHeight = img.height;
      let sourceX = 0;
      let sourceY = 0;
      let artworkLayout = null;
      const zoomPct = clampArtworkZoom(screenshotScale);

      const previewProduct = selectedCartProductIndex != null ? cartProducts[selectedCartProductIndex] : null;
      const previewName = selectedProductName || previewProduct?.name || '';
      const previewSize = previewProduct?.size || fitProductSize;
      const targetAspect = printBoxPreviewAspect(
        previewName,
        previewSize,
        imageOrientation,
        printAreaFit,
        overlayBoxSize.width,
        overlayBoxSize.height
      );
      const objectPos = printBoxObjectPosition(
        previewName,
        imageOrientation,
        imageOffsetX,
        imageOffsetY
      );
      if (targetAspect > 0 && img.width > 0 && img.height > 0) {
        const imgW = img.width;
        const imgH = img.height;
        if (imgW / imgH > targetAspect) {
          sourceHeight = imgH;
          sourceWidth = imgH * targetAspect;
        } else {
          sourceWidth = imgW;
          sourceHeight = imgW / targetAspect;
        }
        artworkLayout = artworkLayoutInBox(
          sourceWidth,
          sourceHeight,
          imgW,
          imgH,
          zoomPct,
          objectPos.x,
          objectPos.y
        );
      }
      if (!cancelled) {
        setBakedImageSize({
          width: Math.round(sourceWidth) || img.width,
          height: Math.round(sourceHeight) || img.height,
        });
      }

      const didCrop = sourceWidth < img.width - 1 || sourceHeight < img.height - 1 || sourceX > 1 || sourceY > 1;
      const hasPixelEdits = Boolean(
        featherEdge ||
        cornerRadius ||
        frameEnabled ||
        blackAndWhite ||
        featherFadeEnabled ||
        imageOpacityHasEdit(imageOpacity) ||
        (textEnabled && textContent && String(textContent).trim())
      );
      if (!didCrop && !hasPixelEdits && zoomPct === 100) {
        setEditedImageUrl('');
        return;
      }
      
      // Update canvas size to match cropped area
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      tempCanvas.width = sourceWidth;
      tempCanvas.height = sourceHeight;
      
      // Clear canvas to ensure transparent background (important for rounded corners)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Draw artwork into the print box (cover at 100%, letterbox when zoomed out).
      if (printBoxFillColor) {
        tempCtx.filter = 'none';
        tempCtx.fillStyle = printBoxFillColor;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      }
      tempCtx.filter = blackAndWhite ? blackAndWhiteCssFilter(true, bwIntensity) : 'none';
      tempCtx.globalAlpha = imageOpacityCss(imageOpacity);
      if (artworkLayout) {
        tempCtx.drawImage(
          img,
          0,
          0,
          img.width,
          img.height,
          artworkLayout.left,
          artworkLayout.top,
          artworkLayout.width,
          artworkLayout.height
        );
      } else {
        tempCtx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
      }
      tempCtx.globalAlpha = 1;
      tempCtx.filter = 'none';

      const artVis = visibleArtworkRect(canvas.width, canvas.height, artworkLayout);
      const visFills = artworkRectFillsBox(artVis, canvas.width, canvas.height);
      const visPx = integerArtworkRect(artVis, canvas.width, canvas.height);
      let effectSource = tempCanvas;
      if (!visFills) {
        const crop = document.createElement('canvas');
        const cropCtx = crop.getContext('2d', { alpha: true });
        crop.width = visPx.width;
        crop.height = visPx.height;
        cropCtx.drawImage(
          tempCanvas,
          visPx.left,
          visPx.top,
          visPx.width,
          visPx.height,
          0,
          0,
          visPx.width,
          visPx.height
        );
        effectSource = crop;
      }

      const processed = applyRadiusFeatherFade(effectSource, {
        cornerRadius,
        featherEdge,
        featherFadeEnabled,
        featherFadeColor,
      });
      if (isTransparentFeatherFade(featherFadeEnabled, featherFadeColor) && printBoxFillColor) {
        flattenCanvasFeatherToColor(processed.getContext('2d', { alpha: true }), processed, printBoxFillColor);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (visFills) {
        ctx.drawImage(processed, 0, 0);
      } else {
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.clearRect(visPx.left, visPx.top, visPx.width, visPx.height);
        if (printBoxFillColor) {
          ctx.fillStyle = printBoxFillColor;
          ctx.fillRect(visPx.left, visPx.top, visPx.width, visPx.height);
        }
        ctx.drawImage(processed, visPx.left, visPx.top);
      }
      if (isTransparentFeatherFade(featherFadeEnabled, featherFadeColor) && printBoxFillColor) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = printBoxFillColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Paint the frame on the visible artwork (print box when zoomed in / 100%).
      if (frameEnabled) {
        let ringVis;
        if (!visFills && artworkLayout) {
          ringVis = { x: visPx.left, y: visPx.top, w: visPx.width, h: visPx.height };
        } else if (overlayBoxSize.width > 0 && overlayBoxSize.height > 0) {
          const overlayAspect = overlayBoxSize.width / overlayBoxSize.height;
          ringVis = coverVisibleRect(
            canvas.width,
            canvas.height,
            overlayAspect,
            imageOrientation === 'landscape' ? 'center' : PORTRAIT_COVER_Y
          );
        } else {
          ringVis = { x: 0, y: 0, w: canvas.width, h: canvas.height };
        }
        paintFrameRings(ctx, ringVis, {
          frameWidth,
          frameColor,
          innerFrameColor,
          doubleFrame,
          cornerRadiusPercent: cornerRadius,
          addRoundedRectPath,
        });
      }

      // Apply text overlay if enabled (position: textOffsetX/Y are 0-100, 50 = center)
      if (textEnabled && textContent && textContent.trim()) {
        // Ensure font is loaded before drawing (required for Google/fringe fonts to show)
        if (typeof document !== 'undefined' && document.fonts) {
          try {
            await document.fonts.ready;
            const loadPromise = document.fonts.load(`16px "${textFont}"`);
            await Promise.race([loadPromise, new Promise((r) => setTimeout(r, 3000))]);
          } catch (_) {
            // Fallback font will be used
          }
        }
        if (cancelled) return;
        const minDim = Math.min(canvas.width, canvas.height);
        const fontSize = Math.max(12, Math.min(300, Math.round((textSize / 100) * minDim * 0.22)));
        drawOverlayText(ctx, {
          text: textContent,
          fontFamily: textFont,
          color: textColor,
          fontSize,
          centerX: (canvas.width * textOffsetX) / 100,
          centerY: (canvas.height * textOffsetY) / 100,
          direction: normalizeTextDirection(textDirection),
        });
      }

      // Convert to data URL (capped jpeg so Apply Edits does not freeze checkout)
      const dataUrl = exportPreviewDataUrl(canvas, {
        keepAlpha: isTransparentFeatherFade(featherFadeEnabled, featherFadeColor) && !printBoxFillColor,
      });
      if (!dataUrl) return;
      if (cancelled) return;
      editedImageUrlRef.current = dataUrl;
      setEditedImageUrl(dataUrl);
    };
    img.onerror = () => {
      if (cancelled) return;
      if (useCors && /^https?:/i.test(imageUrl)) {
        startBakeImage(false);
        return;
      }
      console.error('Failed to load image');
    };
    img.src = imageUrl;
    };
    startBakeImage(true);
    }, BAKE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [imageUrl, featherEdge, cornerRadius, frameEnabled, frameColor, frameWidth, doubleFrame, innerFrameColor, blackAndWhite, bwIntensity, imageOpacity, featherFadeEnabled, featherFadeColor, textEnabled, textContent, textFont, textColor, textSize, textOffsetX, textOffsetY, textDirection, printAreaFit, imageOffsetX, imageOffsetY, screenshotScale, printBoxFillColor, selectedProductName, slotSwitchTick, selectedCartProductIndex, cartProducts, imageOrientation, overlayBoxSize.width, overlayBoxSize.height]);

  const mugPreviewProduct = selectedCartProductIndex != null ? cartProducts[selectedCartProductIndex] : null;
  const mugPreviewName = mugPreviewProduct?.name || selectedProductName || '';
  const mugPreviewColor = mugPreviewProduct?.color || '';
  const mugPreviewSize = mugPreviewProduct?.size || '';
  const mugPreviewSlotKey = `${selectedCartProductIndex}|${mugPreviewName}|${mugPreviewColor}|${mugPreviewSize}`;
  const skipRectEdgeEdits = isCurvedBagProduct(mugPreviewName);

  useEffect(() => {
    if (!skipRectEdgeEdits) return;
    setFeatherEdge(0);
    setCornerRadius(0);
    setFrameEnabled(false);
    setFeatherFadeEnabled(false);
  }, [mugPreviewSlotKey, skipRectEdgeEdits]);

  useEffect(() => {
    const product = selectedCartProductIndex != null ? cartProducts[selectedCartProductIndex] : null;
    const wrapSlot = isPrintfulWrapProduct(product?.name || selectedProductName, product?.category);
    if (wrapSlot) {
      setMugMockupUrl('');
      setMugMockupUrls([]);
      setWrapRequested(false);
      wrapEditKeyRef.current = '';
    } else {
      setMugMockupUrl('');
      setMugMockupUrls([]);
    }
    setMugMockupError('');
  }, [mugPreviewSlotKey, selectedCartProductIndex, selectedProductName]);

  useEffect(() => {
    const product = selectedCartProductIndex != null ? cartProducts[selectedCartProductIndex] : null;
    if (!product || !isPrintfulWrapProduct(product.name || selectedProductName, product.category)) {
      setMugMockupLoading(false);
      return undefined;
    }
    const wrapSrc = String(imageUrl || '');
    const wrapEditKey = [
      `${wrapSrc.length}:${wrapSrc.slice(0, 48)}:${wrapSrc.slice(-24)}`,
      Number(featherEdge) || 0,
      Number(cornerRadius) || 0,
      frameEnabled ? 1 : 0,
      String(frameColor || ''),
      Number(frameWidth) || 0,
      doubleFrame ? 1 : 0,
      String(innerFrameColor || ''),
      blackAndWhite ? 1 : 0,
      Number(bwIntensity) || 0,
      featherFadeEnabled ? 1 : 0,
      String(imageOpacity ?? ''),
      textEnabled ? 1 : 0,
      String(textContent || ''),
      String(imageOrientation || ''),
    ].join('|');
    if (!wrapRequested) {
      if (wrapEditKeyRef.current && wrapEditKeyRef.current !== wrapEditKey) {
        setMugMockupUrl('');
        setMugMockupUrls([]);
        wrapEditKeyRef.current = '';
      }
      setMugMockupLoading(false);
      return undefined;
    }
    const hasPixelEdits = Boolean(
      (!skipRectEdgeEdits && (featherEdge || cornerRadius || frameEnabled || featherFadeEnabled)) ||
      blackAndWhite ||
      imageOpacityHasEdit(imageOpacity) ||
      (textEnabled && String(textContent || '').trim())
    );
    const httpsSource = /^https?:\/\//i.test(String(imageUrl || '')) ? String(imageUrl).trim() : '';
    if (hasPixelEdits && imageUrl && !editedImageUrl) {
      setMugMockupLoading(true);
      return undefined;
    }
    const artwork = (!hasPixelEdits && httpsSource)
      ? httpsSource
      : String(editedImageUrl || imageUrl || '').trim();
    if (!artwork) {
      setMugMockupLoading(false);
      setWrapRequested(false);
      return undefined;
    }
    const usingBaked = Boolean(hasPixelEdits && editedImageUrl);
    const imageWidth = usingBaked
      ? (bakedImageSize.width || currentImageDimensions.width)
      : (currentImageDimensions.width || bakedImageSize.width);
    const imageHeight = usingBaked
      ? (bakedImageSize.height || currentImageDimensions.height)
      : (currentImageDimensions.height || bakedImageSize.height);
    if (!(Number(imageWidth) > 0 && Number(imageHeight) > 0)) {
      setMugMockupLoading(true);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setMugMockupLoading(true);
      setMugMockupError('');
      try {
        const wrap = await requestMugWrapMockup({
          productName: product.name || selectedProductName,
          color: product.color,
          size: product.size,
          image: artwork,
          imageWidth,
          imageHeight,
          imageOrientation,
          signal: controller.signal,
        });
        if (controller.signal.aborted || !wrap?.mockupUrl) return;
        wrapEditKeyRef.current = wrapEditKey;
        setMugMockupUrl(wrap.mockupUrl);
        setMugMockupUrls(wrap.mockupUrls || []);
        setWrapRequested(false);
        persistMugMockupUrl(
          product.originalCartIndex,
          wrap.mockupUrl,
          wrap.mockupUrls,
          httpsSource || (/^https?:\/\//i.test(String(imageUrl || '')) ? String(imageUrl).trim() : ''),
          wrap.printfileUrl,
        );
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setWrapRequested(false);
        setMugMockupError('Wrap preview is taking a moment. Your screenshot is still saved.');
      } finally {
        if (!controller.signal.aborted) setMugMockupLoading(false);
      }
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    editedImageUrl,
    imageUrl,
    mugPreviewSlotKey,
    selectedCartProductIndex,
    selectedProductName,
    persistMugMockupUrl,
    wrapRequested,
    featherEdge,
    cornerRadius,
    frameEnabled,
    frameColor,
    frameWidth,
    doubleFrame,
    innerFrameColor,
    blackAndWhite,
    bwIntensity,
    featherFadeEnabled,
    imageOpacity,
    textEnabled,
    textContent,
    currentImageDimensions.width,
    currentImageDimensions.height,
    bakedImageSize.width,
    bakedImageSize.height,
    imageOrientation,
  ]);

  const rotateScreenshotClockwise = () => {
    const src = (imageUrl || '').trim();
    if (!src) {
      alert('No image to rotate. Load a screenshot first.');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        alert('Could not rotate this image.');
        return;
      }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      let dataUrl;
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch (_) {
        alert('Could not rotate this image. Try again after it fully loads.');
        return;
      }

      // Persist so loadScreenshot / cart poll cannot restore the unrotated original
      if (selectedCartProductIndex !== null) {
        slotStateRef.current[selectedCartProductIndex] = {
          ...(slotStateRef.current[selectedCartProductIndex] || {}),
          editedImageUrl: '',
        };
      }

      setImageUrl(dataUrl);
      setSelectedImage(dataUrl);
      setEditedImageUrl('');
      upgradeTriggeredRef.current = false;

      setCartProducts((prev) => {
        if (selectedCartProductIndex === null || !prev[selectedCartProductIndex]) return prev;
        return prev.map((p, i) =>
          i === selectedCartProductIndex ? { ...p, screenshot: dataUrl } : p
        );
      });

      try {
        const cartItems = readCartItems();
        const selected =
          selectedCartProductIndex !== null ? cartProducts[selectedCartProductIndex] : null;
        const cartIndex =
          selected && typeof selected.originalCartIndex === 'number'
            ? selected.originalCartIndex
            : -1;
        if (cartIndex >= 0 && cartItems[cartIndex]) {
          cartItems[cartIndex] = {
            ...cartItems[cartIndex],
            screenshot: dataUrl,
          };
          writeCartItems(cartItems);
        }
      } catch (e) {
        console.warn('Could not persist rotated screenshot to cart:', e);
      }

      try {
        const data = { ...readPendingMerchData() };
        data.edited_screenshot = dataUrl;
        data.selected_screenshot = dataUrl;
        if (Array.isArray(data.screenshots) && data.screenshots.length) {
          data.screenshots = [dataUrl, ...data.screenshots.slice(1)];
        }
        savePendingMerchData(data);
      } catch (e) {
        console.warn('Could not persist rotated screenshot to pending merch session:', e);
      }
    };
    img.onerror = () => alert('Could not load image to rotate.');
    img.src = src;
  };

  const handleDownload = () => {
    const imageToDownload = editedImageUrl || imageUrl;
    if (!imageToDownload || !imageToDownload.trim()) {
      alert('No image to download. Please load a screenshot first.');
      return;
    }
    const orderId = searchParams.get('order_id') || '';
    const baseName = orderId ? 'screenmerch-' + orderId : 'screenmerch-print-ready';
    const filename = baseName + '.png';

    const doDownload = (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    if (imageToDownload.startsWith('data:image')) {
      try {
        const comma = imageToDownload.indexOf(',');
        const base64 = comma >= 0 ? imageToDownload.slice(comma + 1) : '';
        const mime = imageToDownload.match(/data:([^;]+);/);
        const type = (mime && mime[1]) || 'image/png';
        if (base64) {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          doDownload(new Blob([bytes], { type }));
        } else {
          alert('Download failed. No image data.');
        }
      } catch (e) {
        console.error(e);
        alert('Download failed. Try again.');
      }
    } else if (imageToDownload.startsWith('http')) {
      fetch(imageToDownload, { mode: 'cors' })
        .then((r) => r.blob())
        .then(doDownload)
        .catch(() => alert('Download failed. Image may be from another origin.'));
    } else {
      alert('Download failed. No valid image.');
    }
  };

  const handleGenerate300Dpi = async () => {
    const selectedProduct =
      selectedCartProductIndex != null ? cartProducts[selectedCartProductIndex] : null;
    const originalShot = String(selectedProduct?.originalScreenshot || '').trim();
    // Always start from the unedited original. Passing a baked/edited preview
    // through 300 DPI changes feather, corners, and frame.
    const imageToUse = originalShot || imageUrl;
    if (!imageToUse || !imageToUse.trim()) {
      alert('No image to use. Please load a screenshot first.');
      return;
    }
    setGenerating300Dpi(true);
    setPrintQualityImageUrl('');
    setPrintQualityMeta(null);
    try {
      const orientation = imageOrientation === 'landscape' ? 'landscape' : 'portrait';
      const payload = {
        thumbnail_data: imageToUse,
        print_dpi: 300,
        preserve_edits: false,
        fit_mode: 'cover',
        image_orientation: orientation,
        soft_corners: false,
        edge_feather: false,
        corner_radius_percent: 0,
        feather_edge_percent: 0,
        frame_enabled: false,
        frame_color: frameColor,
        frame_width: frameWidth,
        double_frame: false,
        text_enabled: false,
        text_content: '',
        text_font: textFont,
        text_color: textColor,
        text_size: textSize,
        text_offset_x: textOffsetX,
        text_offset_y: textOffsetY,
        add_white_background: true
      };
      if (selectedProductName && printAreaFit === 'product') {
        try {
          const dims = getPrintAreaDimensions(selectedProductName, fitProductSize, 'front');
          if (dims && dims.width && dims.height) {
            payload.print_area_width = dims.width;
            payload.print_area_height = dims.height;
          }
        } catch (_) {}
      }
      if (!originalShot) {
        payload.preserve_edits = true;
        payload.fit_mode = 'preserve';
        delete payload.image_orientation;
        delete payload.print_area_width;
        delete payload.print_area_height;
      }
      const apiUrl = import.meta.env.DEV
        ? 'http://127.0.0.1:5000/api/process-thumbnail-print-quality'
        : apiJoin('/api/process-thumbnail-print-quality');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const raw = await response.text();
      if (!raw) {
        alert(
          response.status === 502
            ? 'Server ran out of memory generating the 300 DPI image. Please try again.'
            : 'Server returned an empty response. Please try again.'
        );
        return;
      }
      let result = {};
      try {
        result = JSON.parse(raw);
      } catch (_) {
        alert('Server returned an invalid response. Please try again.');
        return;
      }
      if (response.ok) {
        if (result.screenshot) {
          setPrintQualityImageUrl(result.screenshot);
          setPrintQualityMeta({
            dimensions: result.dimensions || { width: 0, height: 0, dpi: 300 },
            file_size: result.file_size,
            format: result.format || 'PNG',
            quality: result.quality || 'Print Ready'
          });
        } else {
          alert('Generated but no image returned.');
        }
      } else {
        alert(result.error || 'Failed to generate 300 DPI image.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error. Try again.');
    } finally {
      setGenerating300Dpi(false);
    }
  };

  const handleDownloadPrintQuality = () => {
    if (!printQualityImageUrl || !printQualityImageUrl.trim()) {
      alert('Generate a 300 DPI image first.');
      return;
    }
    const orderId = searchParams.get('order_id') || '';
    const baseName = orderId ? 'screenmerch-300dpi-' + orderId : 'screenmerch-300dpi';
    const filename = baseName + '.png';
    if (printQualityImageUrl.startsWith('data:image')) {
      try {
        const comma = printQualityImageUrl.indexOf(',');
        const base64 = comma >= 0 ? printQualityImageUrl.slice(comma + 1) : '';
        const mime = printQualityImageUrl.match(/data:([^;]+);/);
        const type = (mime && mime[1]) || 'image/png';
        if (base64) {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const url = URL.createObjectURL(new Blob([bytes], { type }));
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch (e) {
        alert('Download failed.');
      }
    } else {
      alert('Download failed. No valid image.');
    }
  };

  const browseCategoryPath = () => {
    let category = 'mens';
    try { category = localStorage.getItem('last_selected_category') || 'mens'; } catch (_) {}
    return `/product/browse?category=${encodeURIComponent(category)}`;
  };

  const saveAppliedEditsToCart = () => {
    const bakedShot = editedImageUrlRef.current || editedImageUrl || '';

    try {
      const data = { ...readPendingMerchData() };
      if (bakedShot) data.edited_screenshot = bakedShot;
      data.imageOrientation = imageOrientation === 'landscape' ? 'landscape' : 'portrait';
      data.tools_used = {
        featherEdge,
        cornerRadius,
        frameEnabled,
        frameColor,
        frameWidth,
        doubleFrame,
        innerFrameColor,
        blackAndWhite,
        bwIntensity,
        imageOpacity,
        featherFadeEnabled,
        featherFadeColor,
        textEnabled,
        textContent,
        textFont,
        textColor,
        textSize,
        textOffsetX,
        textOffsetY,
        textDirection,
        printAreaFit,
        imageOrientation,
        imageOffsetX,
        imageOffsetY,
        editLog: buildLiveEditLog(selectedCartProductIndex != null ? cartProducts[selectedCartProductIndex] : null)
      };
      savePendingMerchData(data);
      
      // Also update cart items if they exist
      const cartItems = readCartItems();
      let updatedCart;
      const selectedProduct =
        selectedCartProductIndex !== null && cartProducts.length > 0
          ? cartProducts[selectedCartProductIndex]
          : null;
      const cartIndex = selectedProduct?.originalCartIndex;
      const canUpdateCartItem =
        selectedProduct &&
        !selectedProduct.sessionOnly &&
        Number.isInteger(cartIndex) &&
        cartItems[cartIndex];

      const nextToolSettings = {
        screenshotScale,
        offsetX: (productImageOffsets[cartIndex] || {}).x || 0,
        offsetY: (productImageOffsets[cartIndex] || {}).y || 0,
        featherEdge,
        cornerRadius,
        frameEnabled,
        frameColor,
        frameWidth,
        doubleFrame,
        innerFrameColor,
        blackAndWhite,
        bwIntensity,
        imageOpacity,
        featherFadeEnabled,
        featherFadeColor,
        shirtFillColor: printBoxFillColor || '',
        textEnabled,
        textContent,
        textFont,
        textColor,
        textSize,
        textOffsetX,
        textOffsetY,
        textDirection,
        printAreaFit,
        imageOrientation,
        imageOffsetX,
        imageOffsetY,
        editLog: buildLiveEditLog(selectedProduct)
      };

      if (canUpdateCartItem) {
        updatedCart = cartItems.map((item, index) => {
          if (index !== cartIndex) return item;
          const next = {
            ...item,
            originalScreenshot: item.originalScreenshot || item.screenshot,
            edited: true,
            tools_acknowledged: true,
            imageOrientation,
            toolSettings: nextToolSettings,
          };
          if (mugMockupUrl) next.printfulMugMockupUrl = mugMockupUrl;
          if (mugMockupUrls.length) next.printfulMugMockupUrls = mugMockupUrls;
          if (mugMockupUrl) {
            delete next.printfulMugMockupStale;
            const wrapSource = String(
              item.originalScreenshot
              || (/^https?:\/\//i.test(String(imageUrl || '')) ? imageUrl : '')
              || item.printfulMugMockupSource
              || ''
            ).trim();
            if (wrapSource) next.printfulMugMockupSource = wrapSource;
          }
          if (mugMockupUrl) {
            delete next.printfulMugMockupStale;
            const wrapSource = String(
              item.originalScreenshot
              || (/^https?:\/\//i.test(String(imageUrl || '')) ? imageUrl : '')
              || item.printfulMugMockupSource
              || ''
            ).trim();
            if (wrapSource) next.printfulMugMockupSource = wrapSource;
          }
          if (bakedShot) {
            next.screenshot = bakedShot;
            next.selected_screenshot = bakedShot;
            next.displayScreenshot = bakedShot;
          }
          return next;
        });
        console.log(`💾 Updated screenshot for selected cart product: ${selectedProduct.name} (cart index: ${cartIndex})`);
      } else if (selectedProduct) {
        let category = '';
        try { category = localStorage.getItem('last_selected_category') || ''; } catch (_) {}
        updatedCart = [
          ...cartItems,
          {
            name: selectedProduct.name || selectedProductName || 'Product',
            price: 0,
            image: selectedProduct.productImage || '',
            color: selectedProduct.color && selectedProduct.color !== 'N/A' ? selectedProduct.color : 'Default',
            size: selectedProduct.size && selectedProduct.size !== 'N/A' ? selectedProduct.size : 'One Size',
            originalScreenshot: selectedProduct.originalScreenshot || selectedProduct.screenshot || imageUrl,
            screenshot: bakedShot || selectedProduct.screenshot || imageUrl,
            selected_screenshot: bakedShot || selectedProduct.screenshot || imageUrl,
            displayScreenshot: bakedShot || selectedProduct.displayScreenshot || '',
            qty: 1,
            category,
            edited: true,
            tools_acknowledged: true,
            toolSettings: nextToolSettings,
            ...(mugMockupUrl ? { printfulMugMockupUrl: mugMockupUrl } : {}),
            ...(mugMockupUrls.length ? { printfulMugMockupUrls: mugMockupUrls } : {}),
          }
        ];
        console.log(`💾 Added tools product to cart: ${selectedProduct.name}`);
      } else if (cartItems.length) {
        updatedCart = cartItems.map(item => ({
          ...item,
          originalScreenshot: item.originalScreenshot || item.screenshot,
          ...(bakedShot ? { screenshot: bakedShot, selected_screenshot: bakedShot, displayScreenshot: bakedShot } : {}),
          edited: true,
          tools_acknowledged: true,
          toolSettings: {
            ...(item.toolSettings || {}),
            ...nextToolSettings,
          },
        }));
        console.log('💾 Updated screenshot for all cart items');
      } else {
        return false;
      }
      
      writeCartItems(updatedCart);
      if (selectedCartProductIndex !== null) {
        slotStateRef.current[selectedCartProductIndex] = captureLiveEditorSlot(selectedCartProductIndex, {
          ...EDITOR_SLOT_DEFAULTS,
          sourceScreenshot: slotSourceKey(bakedShot || imageUrl),
          imageOrientation,
          blackAndWhite,
          bwIntensity,
          imageOpacity,
          featherFadeEnabled,
          featherFadeColor,
          selectedProductName,
          printAreaFit,
          screenshotScale,
        });
        persistEditorSlotsNow({ force: true });
      }
      return true;
    } catch (e) {
      console.error('Failed to save edited image:', e);
      return false;
    }
  };

  const toolsHavePixelEdits = Boolean(
    featherEdge ||
    cornerRadius ||
    frameEnabled ||
    blackAndWhite ||
    imageOpacityHasEdit(imageOpacity) ||
    (textEnabled && String(textContent || '').trim())
  );

  const persistToolsBeforeLeave = () => {
    if (selectedCartProductIndex !== null && cartProducts[selectedCartProductIndex]) {
      slotStateRef.current[selectedCartProductIndex] = captureLiveEditorSlot(selectedCartProductIndex);
    }
    saveAppliedEditsToCart();
  };

  const handleContinueShopping = () => {
    persistToolsBeforeLeave();
    navigate(browseCategoryPath());
  };

  const handleCheckoutFromTools = async () => {
    if (imageUrl && toolsHavePixelEdits && !editedImageUrlRef.current) {
      const deadline = Date.now() + 2500;
      while (Date.now() < deadline && !editedImageUrlRef.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      }
    }
    persistToolsBeforeLeave();
    const selectedProduct =
      selectedCartProductIndex !== null && cartProducts.length > 0
        ? cartProducts[selectedCartProductIndex]
        : null;
    const cartIndex = selectedProduct?.originalCartIndex;
    if (Number.isInteger(cartIndex) && cartIndex >= 0) {
      setToolsFocusCartIndex(cartIndex);
      setToolsPreviewNewest(false);
    }
    navigate('/checkout');
  };

  const applyFeatherFadeChoice = (choice) => {
    if (choice === 'transparent') {
      setFeatherFadeColor('transparent');
      setFeatherFadeEnabled(false);
      setFeatherEdge((prev) => (prev > 0 ? prev : 20));
      return;
    }
    setFeatherFadeColor(choice === 'black' ? 'black' : 'white');
    setFeatherFadeEnabled(true);
    setFeatherEdge((prev) => (prev > 0 ? prev : 20));
  };

  const switchToCartSlot = (newIndex) => {
    if (newIndex == null || !cartProducts[newIndex] || newIndex === selectedCartProductIndex) return;
    switchingSlotRef.current = true;
    const oldIndex = selectedCartProductIndex;
    if (oldIndex !== null && cartProducts[oldIndex]) {
      slotStateRef.current[oldIndex] = captureLiveEditorSlot(oldIndex);
      persistEditorSlotsNow();
    }
    setSelectedCartProductIndex(newIndex);
    printFilterKeyRef.current = '';
    const filter = getProductPrintFilter(cartProducts[newIndex].name, cartProducts[newIndex].size);
    const matchedName = filter?.name || matchPrintAreaProductName(cartProducts[newIndex].name) || '';
    if (matchedName) {
      setSelectedProductName(matchedName);
      setPrintAreaFit('product');
      setProductSelectClicked(true);
    }
    const savedScale = slotStateRef.current[newIndex]?.screenshotScale;
    if (savedScale === undefined) {
      setScreenshotScale(100);
      setScreenshotSizeInteracted(true);
    } else {
      setScreenshotScale(savedScale);
      setScreenshotSizeInteracted(true);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target.result;
        setImageUrl(url);
        setSelectedImage(url);
      };
      reader.readAsDataURL(file);
    }
  };

  const goBackFromTools = () => {
    if (selectedCartProductIndex !== null && cartProducts[selectedCartProductIndex]) {
      slotStateRef.current[selectedCartProductIndex] = captureLiveEditorSlot(selectedCartProductIndex);
      persistEditorSlotsNow();
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/merchandise');
  };

  const leaveEmptyToolsToBrowse = () => {
    resetToolsEditorSession();
    applyEditorReset();
    let category = 'mens';
    try { category = localStorage.getItem('last_selected_category') || 'mens'; } catch (_) {}
    navigate(`/product/browse?category=${encodeURIComponent(category)}`, { replace: true });
  };

  const showEmptyCartWindow =
    !searchParams.get('order_id') &&
    !isFromOrderEmail &&
    readCartItems().length === 0;

  const liveEditLog = buildLiveEditLog();
  const liveFeatherPx = featherPx(
    featherEdge,
    liveEditLog.imageWidth,
    liveEditLog.imageHeight
  );
  const liveCornerPx = cornerRadiusPx(
    cornerRadius,
    liveEditLog.imageWidth,
    liveEditLog.imageHeight
  );

  return (
    <div className="tools-page-container" ref={containerRef}>
      <button
        type="button"
        ref={backBtnRef}
        className="tools-back-btn tools-back-btn-page"
        onClick={goBackFromTools}
        aria-label="Back"
      >
        <ChevronLeft />
      </button>
      <div className="tools-page-header">
        <h1>Customize Your Design</h1>
        <p className="tools-subtitle">Edit your screenshot with professional tools</p>
      </div>

      {showEmptyCartWindow && (
        <div className="tools-empty-cart-modal" onClick={leaveEmptyToolsToBrowse}>
          <div className="tools-empty-cart-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="tools-empty-cart-message">
              <div className="tools-empty-cart-icon">🛒</div>
              <p>Your cart is empty</p>
            </div>
          </div>
        </div>
      )}

      {searchParams.get('order_id') && (orderScreenshotsLoading || orderScreenshotsError) && (
        <div style={{
          margin: '0 20px 16px',
          padding: '12px 16px',
          borderRadius: '8px',
          background: orderScreenshotsError ? '#f8d7da' : '#cce5ff',
          color: orderScreenshotsError ? '#721c24' : '#004085',
          border: `1px solid ${orderScreenshotsError ? '#f5c6cb' : '#b8daff'}`
        }}>
          {orderScreenshotsLoading && '⏳ Loading screenshots from order (same as in your email)...'}
          {orderScreenshotsError && !orderScreenshotsLoading && `❌ ${orderScreenshotsError}`}
        </div>
      )}

      {(() => {
        // Check if screenshot and product are selected
        const hasScreenshot = imageUrl || editedImageUrl;
        const hasProduct = cartProducts.length > 0 && selectedCartProductIndex !== null;
        const isEnabled = hasScreenshot && hasProduct;
        
        return (
          <>
            <div 
              className={`tools-content-reorganized ${!isEnabled ? 'tools-disabled' : ''}`}
              style={!isEnabled ? { opacity: 0.5, pointerEvents: 'none' } : {}}
            >
        {/* Left Column: Product Preview and Screenshot Size - Fixed Position */}
        <div className="tools-left-column" ref={leftColumnRef}>
          {/* Fixed section at top - Product Preview and Screenshot Preview */}
          <div className="cart-products-preview-fixed">
            {/* Cart Products Preview Section - Show only selected product */}
            {cartProducts.length > 0 && selectedCartProductIndex !== null && cartProducts[selectedCartProductIndex] && (
              <div className="cart-products-preview-section-compact">
              {(() => {
                const product = cartProducts[selectedCartProductIndex];
                const cartIndex = product.originalCartIndex;
                const offset = productImageOffsets[cartIndex] || { x: 0, y: 0 };
                const currentImage = editedImageUrl || imageUrl;
                // Live preview always uses the unbaked screenshot plus CSS
                // feather/frames. Feeding the bake back in (needed for text)
                // re-feathered the outer ring and washed the frame color out.
                const paintCssFrames = Boolean(frameEnabled) && !skipRectEdgeEdits;
                const overlayFeather = skipRectEdgeEdits ? 0 : featherEdge;
                const overlayCorner = skipRectEdgeEdits ? 0 : cornerRadius;
                const overlayScreenshot = imageUrl || currentImage;
                const showingFitOverride = Boolean(fitPreviewImageUrl);
                const displayName = showingFitOverride ? selectedProductName : product.name;
                
                return (
                  <div className="product-preview-inner-card" style={{
                    background: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '2px solid #dee2e6',
                    position: 'relative'
                  }}>
                    <h3 className="product-preview-heading">
                      <span className="product-preview-heading-label product-preview-heading-desktop">
                        Product Preview ({selectedCartProductIndex + 1} of {cartProducts.length})
                        {displayName ? (
                          <span className="product-preview-heading-product"> {displayName}</span>
                        ) : null}
                      </span>
                      <span className="product-preview-heading-label product-preview-heading-mobile">
                        Customize Your Design
                      </span>
                    </h3>
                    <div className="product-preview-name-row" style={{
                      position: 'relative',
                      marginBottom: '10px',
                      minHeight: '30px',
                      padding: '0 36px'
                    }}>
                      <span className="product-preview-index-badge" style={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: '#007bff',
                        color: 'white',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}>
                        {selectedCartProductIndex + 1}
                      </span>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', wordBreak: 'break-word' }}>{displayName}</div>
                        {!showingFitOverride && !isShirtOrHoodieApparel(product.name, product.category) && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {product.color} • {product.size}
                        </div>
                        )}
                      </div>
                    </div>
                    {/* Product Preview - Handle different product types */}
                    <div className="product-preview-image-row">
                      <button
                        type="button"
                        className="tools-back-btn tools-back-btn-preview"
                        onClick={goBackFromTools}
                        aria-label="Back"
                      >
                        <ChevronLeft />
                      </button>
                      <div className="product-preview-visual">
                    {(() => {
                      const productName = selectedProductName || product.name || '';
                      const isHat = isHatProduct(productName);
                      const noMockupPreview = getNoMockupPreviewInfo(product.name || productName, product.category);
                      const toolsUnavailable = getToolsUnavailableInfo(product.name || productName, product.category);
                      
                      if (toolsUnavailable) {
                        return <ToolsUnavailableNotice info={toolsUnavailable} />;
                      }

                      if (isPrintfulWrapProduct(product.name || productName, product.category)) {
                        const wrapKind = printfulWrapKind(product.name || productName, product.category);
                        const wrapNote = mugMockupLoading
                          ? `Wrapping your design on the ${wrapKind}…`
                          : mugMockupError;
                        const showWrapNow = !mugMockupLoading && !mugMockupUrl;
                        const mugViews = uniqueMugWrapViews(mugMockupUrls);
                        const wrapAngleNoun = wrapKind === 'mug' ? 'Mug' : wrapKind.charAt(0).toUpperCase() + wrapKind.slice(1);
                        return (
                          <div>
                            <div className={`mug-product-preview-image${mugMockupUrl ? ' mug-product-preview-image--wrap' : ''}${wrapKind === 'mug' || wrapKind === 'bowl' ? ' mug-product-preview-image--mug' : ''}`}>
                              {mugMockupUrl ? (
                                <>
                                  <div className="mug-wrap-mockup-clip">
                                    <img
                                      className="mug-wrap-mockup"
                                      src={mugMockupUrl}
                                      alt={`${productName} wrap preview`}
                                      decoding="async"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  {mugViews.length > 1 ? (
                                    <div className="mug-wrap-angles" role="tablist" aria-label={`${wrapAngleNoun} preview angles`}>
                                      {mugViews.map((view) => (
                                        <button
                                          key={view.url}
                                          type="button"
                                          className={`mug-wrap-angle${view.url === mugMockupUrl ? ' is-selected' : ''}`}
                                          aria-label={view.title || `${wrapAngleNoun} angle`}
                                          aria-pressed={view.url === mugMockupUrl}
                                          onClick={() => {
                                            setMugMockupUrl(view.url);
                                            persistMugMockupUrl(product.originalCartIndex, view.url, mugViews);
                                          }}
                                        >
                                          <img
                                            src={view.url}
                                            alt=""
                                            decoding="async"
                                            referrerPolicy="no-referrer"
                                          />
                                          {view.title ? (
                                            <span className="mug-wrap-angle-label">{view.title}</span>
                                          ) : null}
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}
                                </>
                              ) : currentImage ? (
                                <ScreenshotPreviewPane
                                  src={overlayScreenshot}
                                  productName={productName}
                                  productSize={product.size}
                                  imageOrientation={imageOrientation}
                                  printAreaFit={printAreaFit}
                                  imageOffsetX={imageOffsetX}
                                  imageOffsetY={imageOffsetY}
                                  featherEdge={overlayFeather}
                                  cornerRadius={overlayCorner}
                                  frameEnabled={paintCssFrames}
                                  frameColor={frameColor}
                                  frameWidth={frameWidth}
                                  doubleFrame={doubleFrame}
                                  innerFrameColor={innerFrameColor}
                                  blackAndWhite={blackAndWhite}
                                  bwIntensity={bwIntensity}
                                  imageOpacity={imageOpacity}
                                  featherFadeEnabled={featherFadeEnabled}
                                  featherFadeColor={featherFadeColor}
                                  sourceWidth={currentImageDimensions.width}
                                  sourceHeight={currentImageDimensions.height}
                                  overlayBoxWidth={overlayBoxSize.width}
                                  overlayBoxHeight={overlayBoxSize.height}
                                  screenshotScale={screenshotScale}
                                  printBoxFillColor={printBoxFillColor}
                                  boxWidth={240}
                                  textEnabled={textEnabled}
                                  textContent={textContent}
                                  textFont={textFont}
                                  textColor={textColor}
                                  textSize={textSize}
                                  textOffsetX={textOffsetX}
                                  textOffsetY={textOffsetY}
                                  textDirection={textDirection}
                                />
                              ) : null}
                              {mugMockupLoading ? (
                                <div className="mug-wrap-loading" aria-live="polite">
                                  {`Wrapping design on ${wrapKind}…`}
                                </div>
                              ) : null}
                            </div>
                            {showWrapNow ? (
                              <div className="product-preview-unavailable-note">
                                {mugMockupError ? (
                                  <div className="product-preview-unavailable-note-text">{mugMockupError}</div>
                                ) : null}
                                <button
                                  type="button"
                                  className="mug-wrap-now-btn"
                                  onClick={() => {
                                    setMugMockupError('');
                                    const needsBake = Boolean(
                                      (!skipRectEdgeEdits && (featherEdge || cornerRadius || frameEnabled || featherFadeEnabled)) ||
                                      blackAndWhite ||
                                      imageOpacityHasEdit(imageOpacity) ||
                                      (textEnabled && String(textContent || '').trim())
                                    );
                                    if (needsBake) setEditedImageUrl('');
                                    setWrapRequested(true);
                                  }}
                                >
                                  Wrap now
                                </button>
                              </div>
                            ) : wrapNote && !mugMockupUrl ? (
                              <div className="product-preview-unavailable-note">
                                <div className="product-preview-unavailable-note-text">{wrapNote}</div>
                              </div>
                            ) : null}
                          </div>
                        );
                      }
                      
                      // Bags/pets/accessories that are not wrap-capable still skip mockup overlay.
                      if (noMockupPreview) {
                        const previewNotice = (
                          <div className="product-preview-unavailable-note">
                            <div className="product-preview-unavailable-note-title">Preview Not Available</div>
                            <div className="product-preview-unavailable-note-text">
                              {noMockupPreview.message}
                            </div>
                          </div>
                        );
                        if (currentImage) {
                          return (
                            <div>
                              <div className="mug-product-preview-image">
                                <ScreenshotPreviewPane
                                  src={overlayScreenshot}
                                  productName={productName}
                                  productSize={product.size}
                                  imageOrientation={imageOrientation}
                                  printAreaFit={printAreaFit}
                                  imageOffsetX={imageOffsetX}
                                  imageOffsetY={imageOffsetY}
                                  featherEdge={overlayFeather}
                                  cornerRadius={overlayCorner}
                                  frameEnabled={paintCssFrames}
                                  frameColor={frameColor}
                                  frameWidth={frameWidth}
                                  doubleFrame={doubleFrame}
                                  innerFrameColor={innerFrameColor}
                                  blackAndWhite={blackAndWhite}
                                  bwIntensity={bwIntensity}
                                  imageOpacity={imageOpacity}
                                  featherFadeEnabled={featherFadeEnabled}
                                  featherFadeColor={featherFadeColor}
                                  sourceWidth={currentImageDimensions.width}
                                  sourceHeight={currentImageDimensions.height}
                                  overlayBoxWidth={overlayBoxSize.width}
                                  overlayBoxHeight={overlayBoxSize.height}
                                  screenshotScale={screenshotScale}
                                  printBoxFillColor={printBoxFillColor}
                                  boxWidth={240}
                                  textEnabled={textEnabled}
                                  textContent={textContent}
                                  textFont={textFont}
                                  textColor={textColor}
                                  textSize={textSize}
                                  textOffsetX={textOffsetX}
                                  textOffsetY={textOffsetY}
                                  textDirection={textDirection}
                                />
                              </div>
                              {previewNotice}
                            </div>
                          );
                        }
                        return previewNotice;
                      }
                      
                      // Hats: Printful front photo for this SKU + cart color (overlay stays on the front panel).
                      if (isHat) {
                        const hatImage = toolsHatPreviewUrl(product, productName) || getPlaceholderProductImage();
                        const hatFallback = toolsHatLocalMockupUrl(product);
                        if (currentImage) {
                          return (
                            <ProductPreviewWithDrag
                              key={`${cartIndex}|${shotFingerprint(hatImage)}|${shotFingerprint(overlayScreenshot)}`}
                              productImage={hatImage}
                              fallbackMockupUrl={hatFallback}
                              screenshot={overlayScreenshot}
                              productName={productName}
                              productSize={product.size}
                              offsetX={offset.x}
                              offsetY={offset.y}
                              onOffsetChange={(x, y) => {
                                setProductImageOffsets(prev => ({
                                  ...prev,
                                  [cartIndex]: { x, y }
                                }));
                              }}
                              textEnabled={textEnabled}
                              textContent={textContent}
                              textFont={textFont}
                              textColor={textColor}
                              textSize={textSize}
                              textOffsetX={textOffsetX}
                              textOffsetY={textOffsetY}
                              textDirection={textDirection}
                              onTextPositionChange={textEnabled ? (px, py) => { setTextOffsetX(px); setTextOffsetY(py); } : undefined}
                              featherEdge={overlayFeather}
                              cornerRadius={overlayCorner}
                              frameEnabled={paintCssFrames}
                              frameColor={frameColor}
                              frameWidth={frameWidth}
                              doubleFrame={doubleFrame}
                              innerFrameColor={innerFrameColor}
                              sourceWidth={currentImageDimensions.width}
                              sourceHeight={currentImageDimensions.height}
                              printAreaFit={printAreaFit}
                              selectedProductName={selectedProductName}
                              screenshotScale={screenshotScale}
                              imageOffsetX={imageOffsetX}
                              imageOffsetY={imageOffsetY}
                              imageOrientation={imageOrientation}
                              blackAndWhite={blackAndWhite}
                              bwIntensity={bwIntensity}
                              imageOpacity={imageOpacity}
                              featherFadeEnabled={featherFadeEnabled}
                              featherFadeColor={featherFadeColor}
                              onOverlayBoxChange={handleOverlayBoxChange}
                              onShirtFillChange={handleShirtFillChange}
                            />
                          );
                        } else {
                          // Show placeholder for hat when no screenshot
                          return (
                            <div style={{
                              padding: '20px',
                              textAlign: 'center',
                              background: '#f8f9fa',
                              border: '2px solid #dee2e6',
                              borderRadius: '8px',
                              color: '#495057',
                              minHeight: '150px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center'
                            }}>
                              <img 
                                src={hatImage} 
                                alt={productName}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const fb = toolsHatLocalMockupUrl(product);
                                  if (fb && e.currentTarget.src !== fb) e.currentTarget.src = fb;
                                }}
                                style={{ maxWidth: '200px', maxHeight: '150px', marginBottom: '10px' }}
                              />
                              <div style={{ fontSize: '14px', color: '#666' }}>
                                Add a screenshot to see preview
                              </div>
                            </div>
                          );
                        }
                      }
                      
                      // Regular products (shirts, etc.): Show normal preview (use placeholder when productImage missing, e.g. loaded from order_id)
                      if (currentImage) {
                        const previewName = selectedProductName || product.name;
                        const productImg = toolsPreviewMockupUrl(
                          previewName,
                          fitPreviewImageUrl || product.productImage || getPlaceholderProductImage()
                        );
                        const garmentTintColor = getWhiteBlankGarmentTint(
                          { ...product, name: previewName },
                          product.color
                        );
                        return (
                          <ProductPreviewWithDrag
                            key={`${cartIndex}|${shotFingerprint(productImg)}|${shotFingerprint(overlayScreenshot)}`}
                            productImage={productImg}
                            screenshot={overlayScreenshot}
                            productName={productName}
                            productSize={product.size}
                            offsetX={offset.x}
                            offsetY={offset.y}
                            onOffsetChange={(x, y) => {
                              setProductImageOffsets(prev => ({
                                ...prev,
                                [cartIndex]: { x, y }
                              }));
                            }}
                            textEnabled={textEnabled}
                            textContent={textContent}
                            textFont={textFont}
                            textColor={textColor}
                            textSize={textSize}
                            textOffsetX={textOffsetX}
                            textOffsetY={textOffsetY}
                            textDirection={textDirection}
                            onTextPositionChange={textEnabled ? (px, py) => { setTextOffsetX(px); setTextOffsetY(py); } : undefined}
                            featherEdge={overlayFeather}
                            cornerRadius={overlayCorner}
                            frameEnabled={paintCssFrames}
                            frameColor={frameColor}
                            frameWidth={frameWidth}
                            doubleFrame={doubleFrame}
                            innerFrameColor={innerFrameColor}
                            sourceWidth={currentImageDimensions.width}
                            sourceHeight={currentImageDimensions.height}
                            printAreaFit={printAreaFit}
                            selectedProductName={selectedProductName}
                            screenshotScale={screenshotScale}
                            imageOffsetX={imageOffsetX}
                            imageOffsetY={imageOffsetY}
                            imageOrientation={imageOrientation}
                            blackAndWhite={blackAndWhite}
                            bwIntensity={bwIntensity}
                            imageOpacity={imageOpacity}
                            featherFadeEnabled={featherFadeEnabled}
                            featherFadeColor={featherFadeColor}
                            onOverlayBoxChange={handleOverlayBoxChange}
                            onShirtFillChange={handleShirtFillChange}
                            garmentTintColor={garmentTintColor}
                          />
                        );
                      }
                      
                      return null;
                    })()}
                      </div>
                    </div>
                    <p className="edit-tools-under-preview">Customize Your Design</p>
                  </div>
                );
              })()}
              </div>
            )}

          </div>
        </div>
        
        {/* Spacer to maintain grid layout since left column is fixed */}
        <div style={{ width: '100px', flexShrink: 0 }} className="tools-left-column-spacer"></div>
        <div style={{ width: '400px', flexShrink: 0 }} className="tools-left-column-spacer"></div>

        {/* Right Column: Tools */}
        <div className="tools-right-column">
          <h1 className="tools-column-heading">Customize Your Design</h1>
          <div className="tools-controls-section">
          {/* Product Selector - Small dropdown at top of tools */}
          {cartProducts.length > 0 && (
            <div 
              className="tool-control-group tools-cart-product-group"
              style={{ 
                position: 'relative'
              }}
            >
              <h3 className="tools-cart-product-label">
                <span className="tools-cart-product-label-desktop">Select Product From Cart:</span>
                <span className="tools-cart-product-label-mobile">Customize Your Design</span>
              </h3>
              <select
                value={selectedCartProductIndex !== null ? selectedCartProductIndex : ''}
                onChange={(e) => {
                  const newIndex = parseInt(e.target.value);
                  switchToCartSlot(newIndex);
                }}
                className="print-area-select"
                style={{ width: '100%' }}
                aria-label="Select product from cart"
              >
                <option value="">-- Select Product --</option>
                {cartProducts.map((product, index) => (
                  <option key={index} value={index}>
                    {product.name}{product.color && product.color !== 'N/A' ? ` - ${product.color}` : ''}{product.size && product.size !== 'N/A' ? ` (${product.size})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="tool-control-group tools-orientation-group">
            {/* Portrait = tuned print box. Landscape = same box, wide on the chest. */}
            <div className="select-control" style={{ marginBottom: '1rem', marginTop: 0 }}>
              <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontWeight: 'bold' }}>Image orientation:</h3>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="imageOrientation"
                    value="portrait"
                    checked={imageOrientation === 'portrait'}
                    onChange={() => {
                      orientationUserSetRef.current = true;
                      rememberArtworkOrientation('portrait');
                      setImageOrientation('portrait');
                    }}
                  />
                  <span>Portrait</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="imageOrientation"
                    value="landscape"
                    checked={imageOrientation === 'landscape'}
                    onChange={() => {
                      orientationUserSetRef.current = true;
                      rememberArtworkOrientation('landscape');
                      setImageOrientation('landscape');
                      const landscapeName = selectedProductName
                        || (selectedCartProductIndex != null ? cartProducts[selectedCartProductIndex]?.name : '')
                        || '';
                      if (locksImageOffsetsInLandscape(landscapeName, 'landscape')) {
                        setImageOffsetX(0);
                        setImageOffsetY(0);
                        if (selectedCartProductIndex !== null) {
                          setProductImageOffsets((prev) => ({
                            ...prev,
                            [selectedCartProductIndex]: { x: 0, y: 0 },
                          }));
                        }
                      }
                      if (selectedCartProductIndex !== null) {
                        fitUserSetRef.current[selectedCartProductIndex] = true;
                      }
                      if (selectedProductName && printAreaFit === 'none') {
                        setPrintAreaFit('product');
                      }
                    }}
                  />
                  <span>Landscape</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={blackAndWhite}
                    onChange={(e) => setBlackAndWhite(e.target.checked)}
                  />
                  <span>Black and white</span>
                </label>
              </div>
              {blackAndWhite ? (
                <div className="slider-control bw-intensity-control">
                  <label htmlFor="bw-intensity">Intensity</label>
                  <input
                    id="bw-intensity"
                    type="range"
                    min="0"
                    max="100"
                    value={clampBwIntensity(bwIntensity)}
                    onChange={(e) => setBwIntensity(clampBwIntensity(e.target.value))}
                    className="slider bw-intensity-slider"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={clampBwIntensity(bwIntensity)}
                    aria-valuetext={bwIntensityLabel(bwIntensity)}
                  />
                  <div className="bw-intensity-ends">
                    <span>White</span>
                    <span className="slider-value">{bwIntensityLabel(bwIntensity)}</span>
                    <span>Black</span>
                  </div>
                </div>
              ) : null}
            </div>
            
            <div className="select-control">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Fit Type:</label>
              <select
                value={printAreaFit}
                onChange={(e) => {
                  const value = e.target.value;
                  setPrintAreaFit(value);
                  if (selectedCartProductIndex !== null) {
                    fitUserSetRef.current[selectedCartProductIndex] = true;
                  }
                  setImageOffsetX(0);
                  setImageOffsetY(0);
                }}
                className="print-area-select"
              >
                <option value="none">Original (No Fit)</option>
                {selectedProductName && (
                  <option value="product">Product Specific ({selectedProductName})</option>
                )}
                <option value="horizontal">Horizontal (Wide - for standard shirts)</option>
                <option value="square">Square (1:1 - for mugs, square items)</option>
                <option value="vertical">Vertical (Tall - for tank tops, vertical shirts)</option>
              </select>
              {isTotePocketProduct(selectedProductName || selectedCartProduct?.name || '') ? (
                <p className="tote-wrap-note">
                  Same photo on the back, reversed.
                </p>
              ) : null}
            </div>

            <div className="slider-control" style={{ marginTop: '1rem' }}>
              <label>Zoom:</label>
              <input
                type="range"
                min={ARTWORK_ZOOM_MIN}
                max={ARTWORK_ZOOM_MAX}
                value={clampArtworkZoom(screenshotScale)}
                onChange={(e) => {
                  setScreenshotScale(clampArtworkZoom(parseInt(e.target.value, 10)));
                  setScreenshotSizeInteracted(true);
                }}
                className="slider"
              />
              <span className="slider-value">
                {clampArtworkZoom(screenshotScale) === 100
                  ? 'Fill'
                  : clampArtworkZoom(screenshotScale) < 100
                    ? `Out ${100 - clampArtworkZoom(screenshotScale)}%`
                    : `In ${clampArtworkZoom(screenshotScale) - 100}%`}
              </span>
            </div>

            <div className="slider-control" style={{ marginTop: '1rem' }}>
              <label htmlFor="image-opacity">Image Opacity:</label>
              <input
                id="image-opacity"
                type="range"
                min="0"
                max="100"
                value={clampImageOpacity(imageOpacity)}
                onChange={(e) => setImageOpacity(clampImageOpacity(e.target.value))}
                className="slider image-opacity-slider"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clampImageOpacity(imageOpacity)}
                aria-valuetext={`${clampImageOpacity(imageOpacity)} percent`}
              />
              <span className="slider-value">{clampImageOpacity(imageOpacity)}%</span>
            </div>
            
            {printAreaFit !== 'none' && !locksImageOffsetsInLandscape(
              selectedProductName || selectedCartProduct?.name || '',
              imageOrientation
            ) && (
              <>
                <div className="slider-control" style={{ marginTop: '1rem' }}>
                  <label>Move Horizontal:</label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={imageOffsetX}
                    onChange={(e) => setImageOffsetX(parseInt(e.target.value))}
                    className="slider"
                  />
                  <span className="slider-value">{imageOffsetX > 0 ? `Right ${imageOffsetX}%` : imageOffsetX < 0 ? `Left ${Math.abs(imageOffsetX)}%` : 'Center'}</span>
                </div>
                <div className="slider-control">
                  <label>Move Vertical:</label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={imageOffsetY}
                    onChange={(e) => setImageOffsetY(parseInt(e.target.value))}
                    className="slider"
                  />
                  <span className="slider-value">{imageOffsetY > 0 ? `Down ${imageOffsetY}%` : imageOffsetY < 0 ? `Up ${Math.abs(imageOffsetY)}%` : 'Center'}</span>
                </div>
              </>
            )}
          </div>

          {(() => {
            // Check if current product is all-over-print (tools should be disabled)
            const currentProduct = cartProducts.length > 0 && selectedCartProductIndex !== null 
              ? cartProducts[selectedCartProductIndex] 
              : null;
            const currentProductName = currentProduct?.name || '';
            const toolsUnavailable = getToolsUnavailableInfo(currentProductName, currentProduct?.category);
            
            if (toolsUnavailable) {
              return (
                <div className="tool-control-group">
                  <ToolsUnavailableNotice info={toolsUnavailable} />
                </div>
              );
            }
            
            return (
              <>
                {skipRectEdgeEdits ? (
                  <div className="tool-control-group">
                    <p className="tool-description">
                      Frame, feather, and rounded corners are not available on this bag — the print sits on a curved surface.
                    </p>
                  </div>
                ) : (
                  <>
                <div className="tool-control-group">
                  <h3>Feather Edge</h3>
                  <p className="tool-description">Softens the edges of your screenshot</p>
                  <div className="slider-control">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={featherEdge}
                      onChange={(e) => setFeatherEdge(parseInt(e.target.value))}
                      className="slider"
                    />
                    <span className="slider-value">
                      {featherEdge}%
                      {featherEdge > 0 && liveFeatherPx.x > 0
                        ? ` · ${Math.round(liveFeatherPx.x)}×${Math.round(liveFeatherPx.y)}px`
                        : ''}
                    </span>
                  </div>
                  {(() => {
                    const fadeChoice = isTransparentFeatherFade(featherFadeEnabled, featherFadeColor)
                      ? 'transparent'
                      : (featherFadeColor === 'black' ? 'black' : 'white');
                    return (
                      <>
                        <p className="tool-description feather-fade-caption">
                          {fadeChoice === 'transparent'
                            ? 'Color shows through edge'
                            : 'Fills the blurred edge so the shirt does not show through'}
                        </p>
                        <div className="feather-fade-choices" role="group" aria-label="Feather fade color">
                          <button
                            type="button"
                            className={`feather-fade-choice${fadeChoice === 'transparent' ? ' is-active' : ''}`}
                            onClick={() => applyFeatherFadeChoice('transparent')}
                          >
                            <span className="feather-fade-swatch is-transparent" />
                            Transparent
                          </button>
                          <button
                            type="button"
                            className={`feather-fade-choice${fadeChoice === 'white' ? ' is-active' : ''}`}
                            onClick={() => applyFeatherFadeChoice('white')}
                          >
                            <span className="feather-fade-swatch is-white" />
                            White
                          </button>
                          <button
                            type="button"
                            className={`feather-fade-choice${fadeChoice === 'black' ? ' is-active' : ''}`}
                            onClick={() => applyFeatherFadeChoice('black')}
                          >
                            <span className="feather-fade-swatch is-black" />
                            Black
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="tool-control-group">
                  <h3>Corner Radius</h3>
                  <p className="tool-description">Round the corners of your screenshot (max = perfect circle)</p>
                  <div className="slider-control">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={cornerRadius}
                      onChange={(e) => setCornerRadius(parseInt(e.target.value))}
                      className="slider"
                    />
                    <span className="slider-value">
                      {cornerRadius === 100
                        ? 'Circle'
                        : `${cornerRadius}%`}
                      {cornerRadius > 0 && liveCornerPx > 0
                        ? ` · ${Math.round(liveCornerPx)}px`
                        : ''}
                    </span>
                  </div>
                </div>
                  </>
                )}

                <div className="tool-control-group">
                  <h3>Text</h3>
                  <p className="tool-description">Add text to your creation with custom font, color, size and direction</p>
                  <div className="checkbox-control">
                    <label>
                      <input
                        type="checkbox"
                        checked={textEnabled}
                        onChange={(e) => setTextEnabled(e.target.checked)}
                      />
                      Add Text
                    </label>
                  </div>
                  {textEnabled && (
                    <>
                      <div className="select-control" style={{ marginTop: '0.75rem' }}>
                        <h4 style={{ margin: '0 0 0.45rem', fontWeight: 'bold' }}>Direction:</h4>
                        <div className="tools-text-direction">
                          <label>
                            <input
                              type="radio"
                              name="textDirection"
                              value="horizontal"
                              checked={textDirection === 'horizontal'}
                              onChange={() => setTextDirection('horizontal')}
                            />
                            <span>Horizontal</span>
                          </label>
                          <label>
                            <input
                              type="radio"
                              name="textDirection"
                              value="vertical"
                              checked={textDirection === 'vertical'}
                              onChange={() => setTextDirection('vertical')}
                            />
                            <span>Vertical</span>
                          </label>
                        </div>
                        <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                          Vertical stacks letters top to bottom
                        </small>
                      </div>
                      <div className="form-group" style={{ marginTop: '0.5rem' }}>
                        <label>Text:</label>
                        <textarea
                          value={textContent}
                          onChange={(e) => setTextContent(e.target.value)}
                          placeholder="Enter text to overlay"
                          rows={2}
                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
                        />
                      </div>
                      <div className="color-control" style={{ flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <label style={{ minWidth: '80px' }}>Font:</label>
                        <select
                          value={textFont}
                          onChange={(e) => setTextFont(e.target.value)}
                          style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', maxWidth: '100%' }}
                        >
                          <optgroup label="Classic">
                            <option value="Arial">Arial</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Verdana">Verdana</option>
                            <option value="Courier New">Courier New</option>
                          </optgroup>
                          <optgroup label="Fringe &amp; style">
                            <option value="Permanent Marker">Permanent Marker (Graffiti)</option>
                            <option value="Orbitron">Orbitron (Metal)</option>
                            <option value="Bebas Neue">Bebas Neue</option>
                            <option value="Creepster">Creepster (Scary / Halloween)</option>
                            <option value="Dela Gothic One">Dela Gothic One</option>
                            <option value="Long Cang">Long Cang (Chinese brush)</option>
                            <option value="Pacifico">Pacifico (Hawaiian / surf)</option>
                          </optgroup>
                        </select>
                      </div>
                      <div className="color-control" style={{ flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <label style={{ minWidth: '80px' }}>Color:</label>
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="color-picker"
                        />
                        <span className="color-value" style={{ wordBreak: 'break-all' }}>{textColor}</span>
                      </div>
                      <div className="slider-control" style={{ marginTop: '0.5rem' }}>
                        <label>Size (headline scale):</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <input
                            type="range"
                            min="12"
                            max="150"
                            value={Math.min(150, Math.max(12, textSize))}
                            onChange={(e) => setTextSize(parseInt(e.target.value, 10) || 24)}
                            className="slider"
                            style={{ flex: '1 1 120px', minWidth: '100px' }}
                          />
                          <input
                            type="number"
                            min={12}
                            max={200}
                            value={textSize}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!Number.isNaN(v)) setTextSize(Math.max(12, Math.min(200, v)));
                            }}
                            style={{ width: '64px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}
                            title="Type 12–200 for headline size"
                          />
                          <span className="slider-value">{textSize}</span>
                        </div>
                        <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>Slider or type 12–200: 100+ = headline size</small>
                      </div>
                      <div className="slider-control" style={{ marginTop: '0.5rem' }}>
                        <label>Horizontal position:</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={textOffsetX}
                          onChange={(e) => setTextOffsetX(parseInt(e.target.value, 10))}
                          className="slider"
                        />
                        <span className="slider-value">{textOffsetX}%</span>
                      </div>
                      <div className="slider-control" style={{ marginTop: '0.5rem' }}>
                        <label>Vertical position:</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={textOffsetY}
                          onChange={(e) => setTextOffsetY(parseInt(e.target.value, 10))}
                          className="slider"
                        />
                        <span className="slider-value">{textOffsetY}%</span>
                      </div>
                      <small style={{ color: '#666', display: 'block', marginTop: '6px' }}>Or drag the product mockup to move the image and text together.</small>
                    </>
                  )}
                </div>

                <div className="tool-control-group">
                  <div className="framed-border-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {skipRectEdgeEdits ? null : (
                    <div style={{ width: '100%' }}>
                      <h3>Framed Border</h3>
                      <p className="tool-description">Add a colored frame around your screenshot</p>
                      <div className="checkbox-control">
                        <label>
                          <input
                            type="checkbox"
                            checked={frameEnabled}
                            onChange={(e) => setFrameEnabled(e.target.checked)}
                          />
                          Enable Frame
                        </label>
                      </div>
                      {frameEnabled && (
                        <>
                          <div className="checkbox-control" style={{ marginTop: '0.5rem' }}>
                            <label>
                              <input
                                type="checkbox"
                                checked={doubleFrame}
                                onChange={(e) => setDoubleFrame(e.target.checked)}
                              />
                              Double Frame (3D Look)
                            </label>
                          </div>
                          <div className="color-control" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                            <label style={{ minWidth: '100px' }}>{doubleFrame ? 'Outer Frame Color:' : 'Frame Color:'}</label>
                            <input
                              type="color"
                              value={normalizeFrameHex(frameColor)}
                              onChange={(e) => setFrameColor(e.target.value)}
                              className="color-picker"
                            />
                            <span className="color-value" style={{ wordBreak: 'break-all' }}>{normalizeFrameHex(frameColor)}</span>
                          </div>
                          {doubleFrame && (
                            <div className="color-control" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                              <label style={{ minWidth: '100px' }}>Inner Frame Color:</label>
                              <input
                                type="color"
                                value={resolveInnerFrameColor(innerFrameColor, frameColor)}
                                onChange={(e) => setInnerFrameColor(e.target.value)}
                                className="color-picker"
                              />
                              <span className="color-value" style={{ wordBreak: 'break-all' }}>{resolveInnerFrameColor(innerFrameColor, frameColor)}</span>
                            </div>
                          )}
                          <div className="slider-control">
                            <label>Frame Width:</label>
                            <input
                              type="range"
                              min="1"
                              max="50"
                              value={frameWidth}
                              onChange={(e) => setFrameWidth(parseInt(e.target.value))}
                              className="slider"
                            />
                            <span className="slider-value">{frameWidth}px</span>
                          </div>
                        </>
                      )}
                    </div>
                    )}
                    {/* Screenshot Preview — same print-box crop as Product Preview */}
                    <div className="screenshot-preview-card">
                      <h4 className="screenshot-preview-title">
                        Screenshot Preview
                      </h4>
                      {(() => {
                        const paintCssFrames = Boolean(frameEnabled) && !skipRectEdgeEdits;
                        const previewSrc = imageUrl || editedImageUrl;
                        const cartProduct = selectedCartProductIndex != null
                          ? cartProducts[selectedCartProductIndex]
                          : null;
                        const previewName = selectedProductName || cartProduct?.name || '';
                        return (
                          <ScreenshotPreviewPane
                            src={previewSrc}
                            productName={previewName}
                            productSize={cartProduct?.size}
                            imageOrientation={imageOrientation}
                            printAreaFit={printAreaFit}
                            imageOffsetX={imageOffsetX}
                            imageOffsetY={imageOffsetY}
                            featherEdge={skipRectEdgeEdits ? 0 : featherEdge}
                            cornerRadius={skipRectEdgeEdits ? 0 : cornerRadius}
                            frameEnabled={paintCssFrames}
                            frameColor={frameColor}
                            frameWidth={frameWidth}
                            doubleFrame={doubleFrame}
                            innerFrameColor={innerFrameColor}
                            blackAndWhite={blackAndWhite}
                            bwIntensity={bwIntensity}
                            imageOpacity={imageOpacity}
                            featherFadeEnabled={featherFadeEnabled}
                            featherFadeColor={featherFadeColor}
                            sourceWidth={currentImageDimensions.width}
                            sourceHeight={currentImageDimensions.height}
                            overlayBoxWidth={overlayBoxSize.width}
                            overlayBoxHeight={overlayBoxSize.height}
                            screenshotScale={screenshotScale}
                            printBoxFillColor={printBoxFillColor}
                            textEnabled={textEnabled}
                            textContent={textContent}
                            textFont={textFont}
                            textColor={textColor}
                            textSize={textSize}
                            textOffsetX={textOffsetX}
                            textOffsetY={textOffsetY}
                            textDirection={textDirection}
                          />
                        );
                      })()}
                    </div>
                    {editLogHasEntries(liveEditLog) && (searchParams.get('order_id') || isFromOrderEmail) && (
                      <ToolsEditLogCard
                        log={liveEditLog}
                        previewSrc={editedImageUrl || imageUrl}
                      />
                    )}
                    {/* Print Quality Image - only on email Edit Tools page; 300 DPI result parked here for download */}
                    {(searchParams.get('order_id') || (typeof window !== 'undefined' && (window.location.search && new URLSearchParams(window.location.search).get('order_id')) || (window.location.href && window.location.href.includes('order_id='))) || isFromOrderEmail) && (
                      <div style={{
                        flexShrink: 0,
                        width: '200px',
                        background: 'white',
                        borderRadius: '8px',
                        padding: '12px',
                        marginTop: '12px',
                        border: '2px solid #28a745',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#28a745' }}>
                          Print Quality Image
                        </h4>
                        <div style={{
                          width: '100%',
                          minHeight: '120px',
                          maxHeight: '180px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#f0f8f0',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          border: '1px solid #c3e6cb'
                        }}>
                          {printQualityImageUrl ? (
                            <img
                              src={printQualityImageUrl}
                              alt="Print Quality 300 DPI"
                              style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', display: 'block' }}
                            />
                          ) : (
                            <p style={{ color: '#999', fontSize: '0.85rem', margin: 0, textAlign: 'center', padding: '10px' }}>
                              Click &quot;Generate 300 DPI Image&quot; to create
                            </p>
                          )}
                        </div>
                        {printQualityMeta && printQualityMeta.dimensions && (
                          <div style={{ marginTop: '8px', fontSize: '11px', color: '#155724', background: '#d4edda', padding: '6px 8px', borderRadius: '4px', border: '1px solid #c3e6cb' }}>
                            <strong>Print quality verified</strong>
                            <div style={{ marginTop: '4px' }}>
                              {printQualityMeta.dimensions.width} × {printQualityMeta.dimensions.height} px
                              {' · '}{printQualityMeta.dimensions.dpi || 300} DPI
                              {printQualityMeta.file_size != null && (
                                <> · {((printQualityMeta.file_size * 3 / 4) / 1024 / 1024).toFixed(1)} MB</>
                              )}
                              {printQualityMeta.format && <> · {printQualityMeta.format}</>}
                              {printQualityMeta.quality && <> · {printQualityMeta.quality}</>}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

          <div className="tools-actions">
            {(() => {
              // Email Edit Tools link (order_id in URL): Generate 300 DPI, Order Details, Download Print Quality only (no extra "Download" — avoids confusion with preview resolution)
              const fromParams = searchParams.get('order_id');
              let fromUrl = false;
              if (typeof window !== 'undefined') {
                const q = window.location.search;
                if (q) fromUrl = !!new URLSearchParams(q).get('order_id');
                if (!fromUrl && window.location.href && window.location.href.includes('order_id=')) fromUrl = true;
              }
              const isEmailEditToolsPage = !!(fromParams || fromUrl || isFromOrderEmail);
              const orderId = searchParams.get('order_id') || '';
              const resetEditor = () => {
                applySavedEditorFields(EDITOR_SLOT_DEFAULTS);
                setPrintAreaFit('none');
                setImageOffsetX(0);
                setImageOffsetY(0);
                orientationUserSetRef.current = false;
                setImageOrientation('portrait');
                if (selectedCartProductIndex !== null) {
                  fitUserSetRef.current[selectedCartProductIndex] = true;
                  slotStateRef.current[selectedCartProductIndex] = captureLiveEditorSlot(selectedCartProductIndex, {
                    ...EDITOR_SLOT_DEFAULTS,
                    printAreaFit: 'none',
                    imageOffsetX: 0,
                    imageOffsetY: 0,
                    imageOrientation: 'portrait',
                    blackAndWhite: false,
                    fitUserSet: true,
                    sourceScreenshot: slotSourceKey(imageUrl || cartProducts[selectedCartProductIndex]?.screenshot || ''),
                  });
                  persistEditorSlotsNow({ force: true });
                }
              };
              if (isEmailEditToolsPage) {
                const orderDetailsUrl = orderId ? `${API_CONFIG.BASE_URL}/admin/orders?order_id=${encodeURIComponent(orderId)}` : '';
                return (
                  <>
                    <div className="tools-actions-email-row">
                      <button
                        type="button"
                        className="tools-email-btn tools-email-btn-300dpi"
                        onClick={handleGenerate300Dpi}
                        disabled={(!editedImageUrl && !imageUrl) || generating300Dpi}
                      >
                        {generating300Dpi ? 'Generating…' : 'Generate 300 DPI Image'}
                      </button>
                      {orderDetailsUrl && (
                        <a
                          href={orderDetailsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tools-email-btn tools-email-btn-order"
                        >
                          Order Details
                        </a>
                      )}
                      <button
                        type="button"
                        className="tools-email-btn tools-email-btn-order"
                        onClick={handleDownloadPrintQuality}
                        disabled={!printQualityImageUrl}
                        title="Downloads the 300 DPI file after you click Generate 300 DPI Image"
                      >
                        Download Print Quality Image
                      </button>
                    </div>
                    <button
                      type="button"
                      className="reset-btn"
                      onClick={resetEditor}
                    >
                      Reset
                    </button>
                  </>
                );
              }
              // Cart tools: save in place, then continue shopping, checkout, or stay on Tools
              return (
                <>
                  <button
                    type="button"
                    className="reset-btn"
                    onClick={resetEditor}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="continue-shopping-btn"
                    onClick={handleContinueShopping}
                  >
                    Shopping
                  </button>
                  <button
                    type="button"
                    className="tools-checkout-btn"
                    onClick={handleCheckoutFromTools}
                  >
                    Checkout
                  </button>
                </>
              );
            })()}
          </div>
          </div>
        </div>
      </div>
          </>
        );
      })()}

    </div>
  );
};

export { ProductPreviewWithDrag };
export default ToolsPage;

