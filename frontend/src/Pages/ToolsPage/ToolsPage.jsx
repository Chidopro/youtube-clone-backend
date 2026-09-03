import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { getPrintAreaConfig, getPrintAreaDimensions, getPrintAreaAspectRatio, getAspectRatio, getPixelDimensions, PRINT_AREA_CONFIG, matchPrintAreaProductName, getProductPrintFilter } from '../../config/printAreaConfig';
import API_CONFIG, { apiJoin } from '../../config/apiConfig';
import { consumeToolsFocusCartIndex, peekToolsFocusCartIndex, writeCartItems, readPendingMerchData, savePendingMerchData, readCartItems, resyncMerchSessionFromStorage, CART_UPDATED_EVENT, PENDING_MERCH_UPDATED_EVENT, resetToolsEditorSession, consumeToolsEditorReset, readToolsSeenCartCount, writeToolsSeenCartCount, consumeToolsPreviewNewest, peekToolsPreviewNewest, rememberArtworkOrientation } from '../../utils/merchSession';
import { isDemoStorefront } from '../../utils/demoStorefront';
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
    widthFrac: 0.291,
    heightFrac: 0.539,
    top: 43.5,
    left: 48.1,
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
};
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

function isPrintBoxPixel(r, g, b) {
  const isMint = r > 170 && r < 230 && g > r + 10 && g >= b - 5 && g > 200;
  const isPink = r > 190 && (r - g) > 50 && g < 140 && g > 60;
  return isMint || isPink;
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
    const canvas = document.createElement('canvas');
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
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
    if (xs.length < 200) {
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
 * set `landscapeWidthScale` to inset that band, and `landscapeRightGrow`
 * to extend only the right edge (left stays put).
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
  const h = Math.min(height, w / 1.5);
  const rightGrow = box?.landscapeRightGrow > 0 ? w * box.landscapeRightGrow : 0;
  w += rightGrow;
  return { width: w, height: h, rightShift: rightGrow / 2 };
}

function applyArtworkOrientation(_product, _screenshotUrl, userSetRef, setImageOrientation) {
  if (userSetRef.current) return;
  rememberArtworkOrientation('portrait');
  setImageOrientation('portrait');
}

/** Fill the current print box. Portrait = full print area; Landscape = wide print inside it. */
function overlayFitForPreview(printBox) {
  return {
    width: printBox.width,
    height: printBox.height,
    objectFit: 'cover',
    cover: true
  };
}

/** Pixel corner radius for the visible print box (100% = inscribed circle / pill). */
function overlayCornerRadiusPx(cornerRadius, width, height) {
  if (!(cornerRadius > 0) || !(width > 0) || !(height > 0)) return 0;
  const maxRadius = Math.min(width, height) / 2;
  return cornerRadius >= 100 ? maxRadius : (cornerRadius / 100) * maxRadius;
}

/**
 * Feather the visible print-box edges, not the full screenshot.
 * Nested X then Y masks — mask-composite is unreliable in Chromium.
 */
function overlayFeatherMaskStyle(featherEdge, width, height) {
  if (!(featherEdge > 0) || !(width > 0) || !(height > 0)) return null;
  const fx = (featherEdge / 100) * width * 0.5;
  const fy = (featherEdge / 100) * height * 0.5;
  const asMask = (image) => ({
    maskImage: image,
    maskRepeat: 'no-repeat',
    maskSize: '100% 100%',
    WebkitMaskImage: image,
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: '100% 100%',
  });
  return {
    x: asMask(`linear-gradient(to right, transparent 0px, #000 ${fx}px, #000 calc(100% - ${fx}px), transparent 100%)`),
    y: asMask(`linear-gradient(to bottom, transparent 0px, #000 ${fy}px, #000 calc(100% - ${fy}px), transparent 100%)`),
  };
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

/** Chest print box on the mockup photo (not geometric 50/50 of the PNG). */
function apparelOverlayPlacement(productName, detected) {
  const box = resolveApparelPrintBox(productName, detected);
  if (box && box.top != null) {
    return { top: box.top, left: box.left ?? 50 };
  }
  const n = String(productName || '').toLowerCase();
  if (n.includes('hat') || n.includes('cap')) return { top: 42, left: 50 };
  if (n.includes('hoodie') || n.includes('sweatshirt')) return { top: 52, left: 50 };
  if (n.includes('tank')) return { top: 44.8, left: 50.2 };
  if (n.includes('women')) return { top: 43.0, left: 50.7 };
  if (n.includes('baby') || n.includes('toddler')) return { top: 48, left: 50 };
  if (n.includes('kids') || n.includes('youth')) return { top: 46.8, left: 50.2 };
  return { top: 43.8, left: 50.35 };
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
  if (typeof window === 'undefined') return { name: '', fit: 'none' };
  try {
    const q = window.location.search;
    if (q && new URLSearchParams(q).get('order_id')) {
      return { name: '', fit: 'none' };
    }
    const items = readCartItems();
    if (!Array.isArray(items) || items.length === 0) {
      return { name: '', fit: 'none' };
    }

    const withShots = items
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => item && item.screenshot && String(item.screenshot).trim() !== '');
    if (!withShots.length) return { name: '', fit: 'none' };

    let chosen = withShots[withShots.length - 1];
    if (!peekToolsPreviewNewest()) {
      const focusOriginal = peekToolsFocusCartIndex();
      if (focusOriginal != null) {
        const matched = withShots.find((p) => p.originalIndex === focusOriginal);
        if (matched) chosen = matched;
      }
    }
    const name = matchPrintAreaProductName(chosen.item.name) || '';
    return { name, fit: name ? 'product' : 'none' };
  } catch {
    return { name: '', fit: 'none' };
  }
}

// Component for product preview with draggable screenshot
const ProductPreviewWithDrag = ({ 
  productImage, 
  screenshot, 
  productName, 
  productSize,
  offsetX, 
  offsetY, 
  onOffsetChange,
  textEnabled,
  textOffsetX = 50,
  textOffsetY = 50,
  onTextPositionChange,
  featherEdge,
  cornerRadius,
  frameEnabled = false,
  frameColor = '#FF0000',
  frameWidth = 10,
  doubleFrame = false,
  sourceWidth = 0,
  sourceHeight = 0,
  printAreaFit,
  selectedProductName,
  screenshotScale = 100,
  imageOffsetX = 0,
  imageOffsetY = 0,
  imageOrientation = 'portrait'
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
  const overlayFitKeyRef = useRef('');

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
        
        console.log(`🔍 [SIZE_CALC] Product: "${effectiveProductName}" (from ${printAreaFit === 'product' && selectedProductName ? 'dropdown' : 'cart'}), Size: "${productSize || 'default'}", Print Area:`, printDimensions);
        
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
            // For hats: 5" print area on ~6.5" hat = ~77% of hat width
            // But we want it to look proportional, so use 60-75% range
            minPercent = 0.60;  // 60% of hat width for 5" print area
            maxPercent = 0.75;  // 75% of hat width for 5.5" print area (trucker hat)
            
            // Calculate percentage directly based on print area width
            // 5" = 60%, 5.5" = 75% (linear interpolation)
            const hatPrintWidth = printDimensions.width; // 5 or 5.5
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
            
            console.log(`📐 [PRINT_AREA] ${effectiveProductName} (${productSize || 'default'}): Print ${printDimensions.width}"x${printDimensions.height}" (AR: ${printAspectRatio.toFixed(2)}) → ${finalWidth.toFixed(0)}x${finalHeight.toFixed(0)}px (${(finalWidth/displayedProductWidth*100).toFixed(1)}% x ${(finalHeight/displayedProductHeight*100).toFixed(1)}% of product)`);
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

            console.log(`📐 [PRINT_AREA] ${effectiveProductName} (${productSize || 'default'}): Print ${printDimensions.width}"x${printDimensions.height}" (AR: ${printAspectRatio.toFixed(2)}) → ${sized.width.toFixed(0)}x${sized.height.toFixed(0)}px (${(sized.width/displayedProductWidth*100).toFixed(1)}% x ${(sized.height/displayedProductHeight*100).toFixed(1)}% of product) [apparel chest]`);
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
          
          console.log(`📐 [PRINT_AREA] ${effectiveProductName} (${productSize || 'default'}): Print ${printDimensions.width}"x${printDimensions.height}" (AR: ${printAspectRatio.toFixed(2)}) → ${finalWidth.toFixed(0)}x${finalHeight.toFixed(0)}px (${(finalWidth/displayedProductWidth*100).toFixed(1)}% x ${(finalHeight/displayedProductHeight*100).toFixed(1)}% of product)`);
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
  }, [productName, productSize, productImageSize, selectedProductName, printAreaFit, productImage, detectedPrintBox]);

  // Measure the painted mockup only. naturalWidth is the file size and
  // makes the overlay huge on phones (then too tall once width is matched).
  const measureProductImage = () => {
    const img = productImageRef.current;
    const stage = containerRef.current;
    if (!img && !stage) return;
    const rect = img ? img.getBoundingClientRect() : { width: 0, height: 0 };
    let width = rect.width || img?.clientWidth || img?.offsetWidth || 0;
    let height = rect.height || img?.clientHeight || img?.offsetHeight || 0;
    // iOS can report width before height:auto has resolved. Infer painted
    // height from file aspect — never use naturalWidth as the overlay size.
    if (width >= 2 && height < 2 && img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      height = width * (img.naturalHeight / img.naturalWidth);
    }
    // Cached/mobile: img rect can be 0 on first layout. Stage width is the
    // mockup's CSS width (img is 100%).
    const stageW = stage ? stage.getBoundingClientRect().width : 0;
    if (width < 2 && stageW >= 2) {
      width = stageW;
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        height = width * (img.naturalHeight / img.naturalWidth);
      }
    }
    // Cap to the painted stage so a pre-CSS intrinsic box cannot inflate the overlay.
    if (stageW >= 2 && width > stageW + 1) {
      const aspect = (img && img.naturalWidth > 0 && img.naturalHeight > 0)
        ? (img.naturalHeight / img.naturalWidth)
        : (height > 0 && width > 0 ? height / width : 0);
      width = stageW;
      if (aspect > 0) height = width * aspect;
    }
    if (width < 2 || height < 2) return;
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
    if (img && isApparelChestPrintProduct(name) && !getApparelPrintOverride(name)) {
      const src = img.currentSrc || img.src;
      if (paintedPrintBoxCache.has(src)) {
        setDetectedPrintBox(paintedPrintBoxCache.get(src));
      } else {
        const probe = new Image();
        probe.crossOrigin = 'anonymous';
        probe.onload = () => setDetectedPrintBox(detectPaintedPrintBox(probe));
        probe.onerror = () => setDetectedPrintBox(null);
        probe.src = src;
      }
    } else {
      setDetectedPrintBox(null);
    }
    requestAnimationFrame(() => {
      measureProductImage();
      requestAnimationFrame(measureProductImage);
    });
  };

  useLayoutEffect(() => {
    setDetectedPrintBox(null);
    measureProductImage();
    const img = productImageRef.current;
    const stage = containerRef.current;
    // Cached images (especially iOS) may not fire onLoad again.
    if (img?.complete) {
      handleProductImageLoad();
    }
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => measureProductImage())
      : null;
    if (observer) {
      if (img) observer.observe(img);
      if (stage) observer.observe(stage);
    }
    window.addEventListener('resize', measureProductImage);
    window.addEventListener('orientationchange', measureProductImage);
    let measureCancelled = false;
    const tickMeasure = (attempt) => {
      if (measureCancelled) return;
      measureProductImage();
      if (attempt < 8) {
        requestAnimationFrame(() => tickMeasure(attempt + 1));
      }
    };
    requestAnimationFrame(() => tickMeasure(0));
    return () => {
      measureCancelled = true;
      observer?.disconnect();
      window.removeEventListener('resize', measureProductImage);
      window.removeEventListener('orientationchange', measureProductImage);
    };
  }, [productImage, productName]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const startPos = { x: e.clientX, y: e.clientY };
    setDragStart(startPos);
    lastDragPositionRef.current = startPos;
    currentDragPositionRef.current = { x: offsetX, y: offsetY };
    if (textDragMode) {
      dragStartTextPositionRef.current = { x: textOffsetX, y: textOffsetY };
      totalDragDeltaRef.current = { x: 0, y: 0 };
    }
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    const startPos = { x: touch.clientX, y: touch.clientY };
    setDragStart(startPos);
    lastDragPositionRef.current = startPos;
    currentDragPositionRef.current = { x: offsetX, y: offsetY };
    if (textDragMode) {
      dragStartTextPositionRef.current = { x: textOffsetX, y: textOffsetY };
      totalDragDeltaRef.current = { x: 0, y: 0 };
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const clampOffsets = (x, y) => {
      if (productImageSize.width > 0 && productImageSize.height > 0) {
        const maxOffsetX = productImageSize.width * 0.4;
        const maxOffsetYUp = productImageSize.height * 0.6;
        const maxOffsetYDown = productImageSize.height * 0.4;
        return {
          x: Math.max(-maxOffsetX, Math.min(maxOffsetX, x)),
          y: Math.max(-maxOffsetYUp, Math.min(maxOffsetYDown, y)),
        };
      }
      const scaledWidth = screenshotDisplaySize.width * (screenshotScale / 100);
      const scaledHeight = screenshotDisplaySize.height * (screenshotScale / 100);
      const maxOffsetX = Math.max(scaledWidth, scaledHeight) * 0.5;
      const maxOffsetYUp = Math.max(scaledWidth, scaledHeight) * 1.2;
      const maxOffsetYDown = Math.max(scaledWidth, scaledHeight) * 0.5;
      return {
        x: Math.max(-maxOffsetX, Math.min(maxOffsetX, x)),
        y: Math.max(-maxOffsetYUp, Math.min(maxOffsetYDown, y)),
      };
    };

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

      const next = clampOffsets(
        currentDragPositionRef.current.x + deltaX,
        currentDragPositionRef.current.y + deltaY
      );
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
  }, [isDragging, onOffsetChange, onTextPositionChange, textDragMode, screenshotDisplaySize, productImageSize, screenshotScale]);

  return (
    <div 
      ref={containerRef}
      className="product-preview-stage"
      style={{
        position: 'relative',
        width: '100%',
        margin: '0 auto',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'none'
      }}
    >
      {/* Product Image */}
      <img 
        ref={productImageRef}
        className="product-preview-mockup"
        key={productImage || 'mockup'}
        src={productImage} 
        alt={productName}
        onLoad={handleProductImageLoad}
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
        const productNameLower = (placeName || '').toLowerCase();
        const isHat = productNameLower.includes('hat') || productNameLower.includes('cap');
        const topPct = (isHat && productImageSize.height > 0)
          ? `${50 - 8}%`
          : `${apparelOverlayPlacement(placeName, detectedPrintBox).top}%`;
        return (
        <div
          style={{
            position: 'absolute',
            top: topPct,
            left: `${apparelOverlayPlacement(placeName, detectedPrintBox).left}%`,
            transform: `translate(calc(-50% + ${offsetX + (printBox.rightShift || 0)}px), calc(-50% + ${offsetY}px))`,
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            touchAction: 'none',
            pointerEvents: 'auto',
            zIndex: 2,
            overflow: 'hidden'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {(() => {
            const scaleFactor = 1;
            const oriented = overlayFitForPreview(printBox);
            const scaledWidth = oriented.width * scaleFactor;
            const scaledHeight = oriented.height * scaleFactor;
            const posX = Math.max(0, Math.min(100, 50 + imageOffsetX / 2));
            const posY = Math.max(0, Math.min(100, 50 + imageOffsetY / 2));
            const overlayFitClass = ' product-preview-overlay-landscape';
            const clipRadius = overlayCornerRadiusPx(cornerRadius, scaledWidth, scaledHeight);
            const featherMask = overlayFeatherMaskStyle(featherEdge, scaledWidth, scaledHeight);
            const clipBox = {
              width: `${scaledWidth}px`,
              height: `${scaledHeight}px`,
            };
            const previewFrame = frameEnabled
              ? overlayFramePx(frameWidth, scaledWidth, scaledHeight, sourceWidth, sourceHeight)
              : 0;
            const innerFrameOffset = previewFrame * 1.5;
            const innerFrameWidth = previewFrame * 0.7;
            const innerOuter = previewFrame + innerFrameOffset;
            const innerRadius = Math.max(0, clipRadius - innerOuter);
            return (
              <div
                style={{
                  ...clipBox,
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: clipRadius > 0 ? `${clipRadius}px` : 0,
                }}
              >
                <div
                  className="product-preview-overlay-clip"
                  style={{
                    ...clipBox,
                    overflow: 'hidden',
                    borderRadius: clipRadius > 0 ? `${clipRadius}px` : 0,
                    background: 'transparent',
                    ...(featherMask?.x || {})
                  }}
                >
                  <div style={{ ...clipBox, ...(featherMask?.y || {}) }}>
                    <img 
                      className={`product-preview-overlay${overlayFitClass}`}
                      key={screenshot || 'overlay'}
                      src={screenshot}
                      alt="Screenshot overlay"
                      style={{
                        ...clipBox,
                        objectFit: oriented.objectFit,
                        objectPosition: `${posX}% ${posY}%`,
                        display: 'block',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        touchAction: 'none',
                        borderRadius: clipRadius > 0 ? `${clipRadius}px` : 0
                      }}
                      draggable={false}
                    />
                  </div>
                </div>
                {previewFrame > 0 && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: clipRadius > 0 ? `${clipRadius}px` : 0,
                      border: `${previewFrame}px solid ${frameColor}`,
                      boxSizing: 'border-box',
                      pointerEvents: 'none'
                    }}
                  />
                )}
                {previewFrame > 0 && doubleFrame && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: innerOuter,
                      right: innerOuter,
                      bottom: innerOuter,
                      left: innerOuter,
                      borderRadius: innerRadius,
                      border: `${innerFrameWidth}px solid ${frameColor}`,
                      boxSizing: 'border-box',
                      pointerEvents: 'none'
                    }}
                  />
                )}
              </div>
            );
          })()}
        </div>
        );
      })()}
    </div>
  );
};

// Helper functions to determine product handling
const isMugProduct = (productName) => {
  if (!productName) return false;
  const mugs = ["White Glossy Mug", "Travel Mug", "Enamel Mug", "Colored Mug"];
  return mugs.some(mug => productName.includes(mug) || mug.includes(productName));
};

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

const TOOLS_BLOCKED_CATEGORIES = {
  bags: {
    label: 'Bags',
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
  },
  pets: {
    label: 'Pets',
    products: [
      'Pet Bowl All-Over Print',
      'Pet Bandana Collar',
    ],
  },
  misc: {
    label: 'Miscellaneous',
    products: [
      'Hardcover Bound Notebook',
      'Apron',
      'Jigsaw Puzzle with Tin',
      'Greeting Card',
    ],
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

const getToolsUnavailableInfo = (productName, category) => {
  const cat = String(category || '').toLowerCase().trim();
  const blockedMeta = TOOLS_BLOCKED_CATEGORIES[cat];
  if (blockedMeta) {
    return {
      title: `No Tools for ${blockedMeta.label}`,
      message: `Editing tools (feather, corner radius, frame) are not available for ${blockedMeta.label.toLowerCase()} products.`,
    };
  }
  if (productName) {
    for (const meta of Object.values(TOOLS_BLOCKED_CATEGORIES)) {
      if (meta.products.some((listed) => productNameMatchesListed(productName, listed))) {
        return {
          title: `No Tools for ${meta.label}`,
          message: `Editing tools (feather, corner radius, frame) are not available for ${meta.label.toLowerCase()} products.`,
        };
      }
    }
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

const isMiscProductNoPreview = (productName) => {
  if (!productName) return false;
  const miscNoPreview = [
    "Greeting Card",
    "Hardcover Bound Notebook"
  ];
  return miscNoPreview.some(product => productName.includes(product) || product.includes(productName));
};

const getGenericHatImage = () => {
  // Use a generic hat image for all hats in tools page
  // This flat front-facing hat template works well for accurate screenshot positioning
  // All hats use this same preview image in tools (except 5 Panel Trucker Hat which has slightly bigger print area)
  return "https://screenmerch.fly.dev/static/images/hatflatfront.png";
};

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
  
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [featherEdge, setFeatherEdge] = useState(0);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [frameEnabled, setFrameEnabled] = useState(false);
  const [frameColor, setFrameColor] = useState('#FF0000');
  const [frameWidth, setFrameWidth] = useState(10);
  const [doubleFrame, setDoubleFrame] = useState(false);
  const [textEnabled, setTextEnabled] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [textFont, setTextFont] = useState('Arial');
  const [textColor, setTextColor] = useState('#000000');
  const [textSize, setTextSize] = useState(24);
  const [textOffsetX, setTextOffsetX] = useState(50); // 0-100, 50 = center
  const [textOffsetY, setTextOffsetY] = useState(50); // 0-100, 50 = center
  const [printAreaFit, setPrintAreaFit] = useState(() => getInitialCartPrintFit().fit); // 'none', 'horizontal', 'square', 'vertical', 'product'
  const [imageOrientation, setImageOrientation] = useState('portrait'); // 'portrait' | 'landscape'
  const [imageOffsetX, setImageOffsetX] = useState(0); // -100 to 100 (percentage)
  const [imageOffsetY, setImageOffsetY] = useState(0); // -100 to 100 (percentage)
  const [editedImageUrl, setEditedImageUrl] = useState('');
  const [selectedProductName, setSelectedProductName] = useState(() => getInitialCartPrintFit().name);
  const [currentImageDimensions, setCurrentImageDimensions] = useState({ width: 0, height: 0 });
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
  const slotStateRef = useRef({});
  const cartCountRef = useRef(0);
  const cartIdentityRef = useRef('');
  const entrySelectRef = useRef(true);
  const sessionPreviewUrlRef = useRef('');
  const [sessionEpoch, setSessionEpoch] = useState(0);
  // True when the user picked Fit Type / landscape (do not treat initial 'none' as a choice)
  const fitUserSetRef = useRef({});
  const autoFitCartIndexRef = useRef({});
  const printFilterKeyRef = useRef('');
  // When true, apply-edits effect must skip so it doesn't overwrite with previous product's image (same effect batch race)
  const switchingSlotRef = useRef(false);
  const orientationUserSetRef = useRef(false);
  const [slotSwitchTick, setSlotSwitchTick] = useState(0);
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
      if (leftColumnRef.current) {
        leftColumnRef.current.style.left = `${leftPosition}px`;
      }
      if (backBtnRef.current && !window.matchMedia('(max-width: 968px)').matches) {
        // Left gutter beside Product Preview, just under the header bar.
        backBtnRef.current.style.left = `${Math.round(containerRect.left)}px`;
        const nav = document.querySelector('nav');
        const belowHeader = Math.max(nav?.getBoundingClientRect().bottom || 0, 64);
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

  const applyEditorReset = () => {
    slotStateRef.current = {};
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
    slotStateRef.current = {};
    cartIdentityRef.current = '';
    cartCountRef.current = 0;
    if (consumeToolsEditorReset()) {
      applyEditorReset();
    }
  }, [location.key]);

  useEffect(() => {
    const onPageShow = (event) => {
      if (!event.persisted) return;
      resyncMerchSessionFromStorage();
      entrySelectRef.current = true;
      slotStateRef.current = {};
      cartIdentityRef.current = '';
      cartCountRef.current = 0;
      setImageUrl('');
      setSelectedImage('');
      setEditedImageUrl('');
      if (consumeToolsEditorReset()) {
        applyEditorReset();
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

  // Load tool page state from localStorage on mount (skip when opened from email/order link so we always start clean)
  useEffect(() => {
    const fromOrder = searchParams.get('order_id') || (typeof window !== 'undefined' && window.location.href && window.location.href.includes('order_id='));
    if (fromOrder) return;
    try {
      const savedState = localStorage.getItem('tools_page_state');
      if (savedState) {
        const state = JSON.parse(savedState);
        // Do not restore screenshotScale or productImageOffsets — those belong
        // to the previous cart item and shove a newly added product off-center.
        // Do NOT restore selectedCartProductIndex — it often points at a leftover
        // item from a previous video. Selection is set from focus index / latest cart item.
        console.log('📦 Restored tool page state from localStorage');
      }
    } catch (e) {
      console.warn('Could not load tool page state:', e);
    }
  }, [searchParams]);

  // Save tool page state to localStorage whenever it changes (skip when opened from order link)
  useEffect(() => {
    const fromOrder = searchParams.get('order_id') || (typeof window !== 'undefined' && window.location.href && window.location.href.includes('order_id='));
    if (fromOrder) return;
    try {
      const stateToSave = {
        screenshotScale,
        productImageOffsets,
        selectedCartProductIndex
      };
      localStorage.setItem('tools_page_state', JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Could not save tool page state:', e);
    }
  }, [screenshotScale, productImageOffsets, selectedCartProductIndex, searchParams]);

  // Persist current slot's Fit to Print (and related) state so it survives cart poll / loadScreenshot re-run
  useEffect(() => {
    if (selectedCartProductIndex === null || !cartProducts.length || !cartProducts[selectedCartProductIndex]) return;
    const idx = selectedCartProductIndex;
    const cartIndex = cartProducts[idx].originalCartIndex;
    const offset = productImageOffsets[cartIndex] || { x: 0, y: 0 };
    slotStateRef.current[idx] = {
      ...(slotStateRef.current[idx] || {}),
      editedImageUrl,
      screenshotScale,
      selectedProductName,
      printAreaFit,
      imageOrientation,
      imageOffsetX,
      imageOffsetY,
      printQualityImageUrl,
      printQualityMeta,
      offsetX: offset.x,
      offsetY: offset.y,
      fitUserSet: Boolean(fitUserSetRef.current[idx]),
      sourceScreenshot: imageUrl || cartProducts[idx].screenshot || ''
    };
  }, [selectedCartProductIndex, cartProducts, editedImageUrl, imageUrl, screenshotScale, selectedProductName, printAreaFit, imageOrientation, imageOffsetX, imageOffsetY, printQualityImageUrl, printQualityMeta, productImageOffsets]);

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
            .map((p, i) => ({
              originalCartIndex: p.index ?? i,
              name: p.product || 'Product',
              color: p.color || 'N/A',
              size: p.size || 'N/A',
              category: p.category || '',
              screenshot: p.screenshot || '',
              productImage: (p.preview_image_url && p.preview_image_url.trim()) || '', // Product mockup (same as cart tools)
              toolSettings: null,
              filteredIndex: i
            }))
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
                  .then((data) => (data && data.url ? { ...item, productImage: data.url } : item))
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
              screenshot: item.screenshot || '',
              productImage: item.image || '', // Store product image from cart
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
            const showNewest = consumeToolsPreviewNewest() || newProductAdded || addedWhileOpen;

            let nextIndex = lastIndex;
            const focusOriginal = peekToolsFocusCartIndex();
            if (showNewest) {
              if (focusOriginal != null) consumeToolsFocusCartIndex();
              nextIndex = lastIndex;
            } else if (focusOriginal != null) {
              consumeToolsFocusCartIndex();
              const matched = productsWithScreenshots.findIndex(
                (p) => p.originalCartIndex === focusOriginal
              );
              nextIndex = matched >= 0 ? matched : lastIndex;
            } else if (forceEntry || (!demoStore && cartGrew)) {
              nextIndex = lastIndex;
            } else if (
              selectedCartProductIndex !== null &&
              selectedCartProductIndex < productsWithScreenshots.length
            ) {
              nextIndex = selectedCartProductIndex;
            }

            const chosen = productsWithScreenshots[nextIndex];
            if (identityChanged && chosen && !showNewest) {
              const slot = slotStateRef.current[nextIndex];
              if (slot && slot.sourceScreenshot && slot.sourceScreenshot !== chosen.screenshot) {
                delete slotStateRef.current[nextIndex];
                setEditedImageUrl('');
              }
            }
            if (showNewest && chosen) {
              switchingSlotRef.current = true;
              delete slotStateRef.current[nextIndex];
              fitUserSetRef.current[nextIndex] = false;
              delete autoFitCartIndexRef.current[nextIndex];
              printFilterKeyRef.current = '';
              setEditedImageUrl('');
              setFitPreviewImageUrl('');
              setScreenshotSizeInteracted(true);
              setImageOffsetX(0);
              setImageOffsetY(0);
              orientationUserSetRef.current = false;
              applyArtworkOrientation(chosen, chosen?.screenshot, orientationUserSetRef, setImageOrientation);
            }
            if (showNewest || nextIndex !== selectedCartProductIndex || forceEntry) {
              setSelectedCartProductIndex(nextIndex);
              const matchedName = matchPrintAreaProductName(chosen?.name) || '';
              if (matchedName) {
                setSelectedProductName(matchedName);
                setPrintAreaFit('product');
                setProductSelectClicked(true);
              } else {
                setSelectedProductName('');
                setPrintAreaFit('none');
              }
              const settings = showNewest ? null : chosen?.toolSettings;
              // Do not restore cart-saved screenshotScale — that value was often
              // compensation for a wrong first size and makes the overlay jump larger.
              const sessionScale = !showNewest
                ? slotStateRef.current[nextIndex]?.screenshotScale
                : undefined;
              setScreenshotScale(sessionScale !== undefined ? sessionScale : 100);
              if (chosen && settings && settings.offsetX !== undefined && settings.offsetY !== undefined) {
                setProductImageOffsets(prev => ({
                  ...prev,
                  [chosen.originalCartIndex]: { x: settings.offsetX, y: settings.offsetY }
                }));
              } else if (chosen) {
                setProductImageOffsets(prev => ({
                  ...prev,
                  [chosen.originalCartIndex]: { x: 0, y: 0 }
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
  }, [selectedCartProductIndex, searchParams, sessionEpoch, location.key]); // Re-run on Tools visit, bfcache, or cart selection

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
            const saved = slotStateRef.current[selectedCartProductIndex];
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
              return;
            }
            if (screenshot !== imageUrl) {
              upgradeTriggeredRef.current = false;
              fitUserSetRef.current[selectedCartProductIndex] = false;
              setEditedImageUrl('');
            }
            setImageUrl(screenshot);
            setSelectedImage(screenshot);
            setIsUpgrading(false);
            const savedMatchesSource = Boolean(
              saved &&
              screenshot === screenshotFromCart &&
              (!saved.sourceScreenshot || saved.sourceScreenshot === screenshot)
            );
            if (savedMatchesSource) {
              fitUserSetRef.current[selectedCartProductIndex] = Boolean(saved.fitUserSet);
              setEditedImageUrl(saved.editedImageUrl || '');
              setScreenshotScale(saved.screenshotScale ?? 100);
              setSelectedProductName(resolvedName);
              setPrintAreaFit(resolvedFit);
              if (saved.imageOrientation === 'landscape' || saved.imageOrientation === 'portrait') {
                setImageOrientation(saved.imageOrientation);
              } else {
                applyArtworkOrientation(selectedProduct, screenshot, orientationUserSetRef, setImageOrientation);
              }
              setImageOffsetX(saved.imageOffsetX ?? 0);
              setImageOffsetY(saved.imageOffsetY ?? 0);
              setPrintQualityImageUrl(saved.printQualityImageUrl || '');
              setPrintQualityMeta(saved.printQualityMeta || null);
              const cartIndex = selectedProduct.originalCartIndex;
              setProductImageOffsets(prev => ({ ...prev, [cartIndex]: { x: saved.offsetX ?? 0, y: saved.offsetY ?? 0 } }));
            } else {
              fitUserSetRef.current[selectedCartProductIndex] = false;
              setEditedImageUrl('');
              setScreenshotScale(100);
              setSelectedProductName(resolvedName);
              setPrintAreaFit(resolvedFit);
              orientationUserSetRef.current = false;
              applyArtworkOrientation(selectedProduct, screenshot, orientationUserSetRef, setImageOrientation);
              setImageOffsetX(0);
              setImageOffsetY(0);
              setPrintQualityImageUrl('');
              setPrintQualityMeta(null);
              const cartIndex = selectedProduct.originalCartIndex;
              setProductImageOffsets(prev => ({ ...prev, [cartIndex]: { x: 0, y: 0 } }));
              if (resolvedFit === 'product' && resolvedName) {
                setScreenshotSizeInteracted(true);
              }
            }
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
          // Load selected product name
          if (data.selected_product_name) {
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
    if (!imageUrl) return;
    if (switchingSlotRef.current) return;
    // Don't rasterize Original/uncropped while Product Specific is still pending.
    const idx = selectedCartProductIndex;
    const awaitingAutoProductFit =
      idx !== null &&
      cartProducts[idx] &&
      printAreaFit === 'none' &&
      imageOrientation !== 'landscape' &&
      !fitUserSetRef.current[idx] &&
      matchPrintAreaProductName(cartProducts[idx].name);
    if (awaitingAutoProductFit) return;
    if (printAreaFit === 'product' && !selectedProductName) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
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

      // Horizontal / Square / Vertical still crop. Product Specific must not —
      // that cover-crop runs after the first paint and zooms video stills too far.
      let sourceWidth = img.width;
      let sourceHeight = img.height;
      let sourceX = 0;
      let sourceY = 0;

      const cropToAspect = (targetAspect) => {
        const imgW = img.width;
        const imgH = img.height;
        if (!(targetAspect > 0) || !(imgW > 0 && imgH > 0)) return;
        const imgAspect = imgW / imgH;
        let cropW;
        let cropH;
        if (imgAspect > targetAspect) {
          cropH = imgH;
          cropW = cropH * targetAspect;
        } else {
          cropW = imgW;
          cropH = cropW / targetAspect;
        }
        // Keep cover size on open (no extra zoom). If the shopper uses the
        // slider on the locked axis, zoom just enough for that pan.
        const yNeed = Math.abs(imageOffsetY) / 100;
        const xNeed = Math.abs(imageOffsetX) / 100;
        if (imgH - cropH < 2 && yNeed > 0) {
          cropH = imgH * (1 - Math.min(0.28, yNeed * 0.28));
          cropW = cropH * targetAspect;
        } else if (imgW - cropW < 2 && xNeed > 0) {
          cropW = imgW * (1 - Math.min(0.28, xNeed * 0.28));
          cropH = cropW / targetAspect;
        }
        if (cropW > imgW) {
          cropW = imgW;
          cropH = cropW / targetAspect;
        }
        if (cropH > imgH) {
          cropH = imgH;
          cropW = cropH * targetAspect;
        }
        const maxOffsetX = Math.max(0, imgW - cropW);
        const maxOffsetY = Math.max(0, imgH - cropH);
        sourceWidth = cropW;
        sourceHeight = cropH;
        sourceX = maxOffsetX / 2 + (imageOffsetX / 100) * (maxOffsetX / 2);
        sourceX = Math.max(0, Math.min(sourceX, maxOffsetX));
        sourceY = maxOffsetY / 2 - (imageOffsetY / 100) * (maxOffsetY / 2);
        sourceY = Math.max(0, Math.min(sourceY, maxOffsetY));
      };

      if (printAreaFit !== 'none' && printAreaFit !== 'product') {
        let targetAspect;
        switch (printAreaFit) {
          case 'horizontal':
            targetAspect = 1.5; // Wider (e.g., 3:2 or 4:3)
            break;
          case 'square':
            targetAspect = 1.0; // Square (1:1)
            break;
          case 'vertical':
            targetAspect = 0.67; // Taller (e.g., 2:3 or 3:4) - for tank tops, vertical shirts
            break;
          default:
            targetAspect = img.width / img.height;
        }
        cropToAspect(targetAspect);
      }

      const didCrop = sourceWidth < img.width - 1 || sourceHeight < img.height - 1 || sourceX > 1 || sourceY > 1;
      const hasPixelEdits = Boolean(
        featherEdge ||
        cornerRadius ||
        frameEnabled ||
        (textEnabled && textContent && String(textContent).trim())
      );
      if (!didCrop && !hasPixelEdits) {
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
      
      // Draw cropped image to temp canvas
      tempCtx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);

      // Calculate max corner radius for circle (half of smallest dimension)
      const maxCornerRadius = Math.min(canvas.width, canvas.height) / 2;
      const isCircle = cornerRadius >= 100; // When maxed out, create perfect circle
      // Convert percentage (0-100) to pixels
      const effectiveCornerRadius = isCircle ? maxCornerRadius : Math.round((cornerRadius / 100) * maxCornerRadius);

      // Apply corner radius clipping (or circle if maxed out)
      // Create a new transparent canvas for the final result to ensure no black background
      if (effectiveCornerRadius > 0) {
        // Create a mask canvas for the rounded corners
        const roundedMaskCanvas = document.createElement('canvas');
        const roundedMaskCtx = roundedMaskCanvas.getContext('2d', { alpha: true });
        roundedMaskCanvas.width = canvas.width;
        roundedMaskCanvas.height = canvas.height;
        
        // Clear mask canvas to transparent
        roundedMaskCtx.clearRect(0, 0, roundedMaskCanvas.width, roundedMaskCanvas.height);
        
        // Draw white shape (will be used as mask)
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
          drawRoundedRect(roundedMaskCtx, 0, 0, roundedMaskCanvas.width, roundedMaskCanvas.height, effectiveCornerRadius);
          roundedMaskCtx.fill();
        }
        
        // Create a new transparent canvas for the final result
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d', { alpha: true });
        finalCanvas.width = canvas.width;
        finalCanvas.height = canvas.height;
        
        // Draw image to final canvas first
        finalCtx.drawImage(tempCanvas, 0, 0);
        
        // Use destination-in to clip the image to the rounded shape (removes black background)
        // This operation keeps only the pixels where the mask is opaque, making everything else transparent
        finalCtx.globalCompositeOperation = 'destination-in';
        finalCtx.drawImage(roundedMaskCanvas, 0, 0);
        finalCtx.globalCompositeOperation = 'source-over';
        
        // Replace the original canvas with the final transparent canvas
        canvas.width = finalCanvas.width;
        canvas.height = finalCanvas.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(finalCanvas, 0, 0);
      } else {
        // No rounded corners, just draw the image
        ctx.drawImage(tempCanvas, 0, 0);
      }

      // Apply feather edge (soft edge effect) - works with both rectangles and circles
      if (featherEdge > 0) {
        const featherX = (featherEdge / 100) * (canvas.width * 0.5);
        const featherY = (featherEdge / 100) * (canvas.height * 0.5);
        
        // Create a mask canvas for feather effect
        const maskCanvas = document.createElement('canvas');
        const maskCtx = maskCanvas.getContext('2d', { alpha: true });
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        
        // Clear mask canvas to transparent
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        
        // Start with a fully opaque white shape (circle or rectangle with same corner radius as image)
        maskCtx.fillStyle = 'white';
        if (isCircle) {
          // For circle, create a white circle
          maskCtx.beginPath();
          maskCtx.arc(
            canvas.width / 2,
            canvas.height / 2,
            maxCornerRadius,
            0,
            Math.PI * 2
          );
          maskCtx.fill();
        } else if (effectiveCornerRadius > 0) {
          // For rectangle with rounded corners, create a white rounded rectangle matching the image shape
          drawRoundedRect(maskCtx, 0, 0, canvas.width, canvas.height, effectiveCornerRadius);
          maskCtx.fill();
        } else {
          // For rectangle without rounded corners, create a white rectangle
          maskCtx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Create soft edges using distance-based approach for smooth corners
        if (isCircle) {
          // For circular images, use radial gradient to create soft edge
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const innerRadius = Math.max(0, maxCornerRadius - ((featherEdge / 100) * maxCornerRadius));
          const outerRadius = maxCornerRadius;
          
          const radialGradient = maskCtx.createRadialGradient(
            centerX, centerY, innerRadius,
            centerX, centerY, outerRadius
          );
          radialGradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); // No erase in center
          radialGradient.addColorStop(1, 'rgba(0, 0, 0, 1)'); // Fully erase at edge
          
          maskCtx.globalCompositeOperation = 'destination-out';
          maskCtx.fillStyle = radialGradient;
          maskCtx.beginPath();
          maskCtx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
          maskCtx.fill();
        } else {
          // Fade each side by a share of that side's length so portrait and
          // landscape screenshots soften top, bottom, left, and right equally.
          const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
          const data = imageData.data;
          const fadeX = Math.max(1, featherX);
          const fadeY = Math.max(1, featherY);
          
          for (let y = 0; y < maskCanvas.height; y++) {
            for (let x = 0; x < maskCanvas.width; x++) {
              let edgeFade = 1;
              const distLeft = x;
              const distRight = maskCanvas.width - 1 - x;
              const distTop = y;
              const distBottom = maskCanvas.height - 1 - y;
              const dx = Math.min(distLeft, distRight);
              const dy = Math.min(distTop, distBottom);

              if (effectiveCornerRadius > 0) {
                const inTopLeft = distLeft < effectiveCornerRadius && distTop < effectiveCornerRadius;
                const inTopRight = distRight < effectiveCornerRadius && distTop < effectiveCornerRadius;
                const inBottomLeft = distLeft < effectiveCornerRadius && distBottom < effectiveCornerRadius;
                const inBottomRight = distRight < effectiveCornerRadius && distBottom < effectiveCornerRadius;
                if (inTopLeft || inTopRight || inBottomLeft || inBottomRight) {
                  const cornerCenterX = inTopLeft || inBottomLeft
                    ? effectiveCornerRadius
                    : maskCanvas.width - effectiveCornerRadius;
                  const cornerCenterY = inTopLeft || inTopRight
                    ? effectiveCornerRadius
                    : maskCanvas.height - effectiveCornerRadius;
                  const distToCornerCenter = Math.hypot(x - cornerCenterX, y - cornerCenterY);
                  const minDist = Math.max(0, effectiveCornerRadius - distToCornerCenter);
                  const cornerFeather = Math.max(fadeX, fadeY);
                  edgeFade = minDist < cornerFeather ? minDist / cornerFeather : 1;
                } else {
                  const fadeFromX = dx < fadeX ? dx / fadeX : 1;
                  const fadeFromY = dy < fadeY ? dy / fadeY : 1;
                  edgeFade = fadeFromX * fadeFromY;
                }
              } else {
                const fadeFromX = dx < fadeX ? dx / fadeX : 1;
                const fadeFromY = dy < fadeY ? dy / fadeY : 1;
                edgeFade = fadeFromX * fadeFromY;
              }

              const index = (y * maskCanvas.width + x) * 4;
              data[index + 3] = Math.floor(Math.max(0, Math.min(1, edgeFade)) * 255);
            }
          }
          
          maskCtx.putImageData(imageData, 0, 0);
        }
        
        maskCtx.globalCompositeOperation = 'source-over';
        
        // Apply mask to soften edges (image already drawn, just apply feather mask)
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
      }

      // Paint the frame as a filled ring on the same path as the image clip.
      // A stroke using the raw % slider looked square; this follows Angle Radius.
      if (frameEnabled) {
        ctx.fillStyle = frameColor;
        if (isCircle) {
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, maxCornerRadius, 0, Math.PI * 2);
          ctx.arc(
            canvas.width / 2,
            canvas.height / 2,
            Math.max(0, maxCornerRadius - frameWidth),
            0,
            Math.PI * 2,
            true
          );
          ctx.fill('evenodd');
        } else if (effectiveCornerRadius > 0) {
          ctx.beginPath();
          addRoundedRectPath(ctx, 0, 0, canvas.width, canvas.height, effectiveCornerRadius);
          addRoundedRectPath(
            ctx,
            frameWidth,
            frameWidth,
            canvas.width - frameWidth * 2,
            canvas.height - frameWidth * 2,
            Math.max(0, effectiveCornerRadius - frameWidth)
          );
          ctx.fill('evenodd');
        } else {
          ctx.fillRect(0, 0, canvas.width, frameWidth);
          ctx.fillRect(0, 0, frameWidth, canvas.height);
          ctx.fillRect(canvas.width - frameWidth, 0, frameWidth, canvas.height);
          ctx.fillRect(0, canvas.height - frameWidth, canvas.width, frameWidth);
        }

        if (doubleFrame) {
          const innerFrameOffset = frameWidth * 1.5;
          const innerFrameWidth = frameWidth * 0.7;
          const innerOuter = frameWidth + innerFrameOffset;
          const innerInner = innerOuter + innerFrameWidth;

          if (isCircle) {
            ctx.beginPath();
            ctx.arc(
              canvas.width / 2,
              canvas.height / 2,
              Math.max(0, maxCornerRadius - innerOuter),
              0,
              Math.PI * 2
            );
            ctx.arc(
              canvas.width / 2,
              canvas.height / 2,
              Math.max(0, maxCornerRadius - innerInner),
              0,
              Math.PI * 2,
              true
            );
            ctx.fill('evenodd');
          } else if (effectiveCornerRadius > 0) {
            ctx.beginPath();
            addRoundedRectPath(
              ctx,
              innerOuter,
              innerOuter,
              canvas.width - innerOuter * 2,
              canvas.height - innerOuter * 2,
              Math.max(0, effectiveCornerRadius - innerOuter)
            );
            addRoundedRectPath(
              ctx,
              innerInner,
              innerInner,
              canvas.width - innerInner * 2,
              canvas.height - innerInner * 2,
              Math.max(0, effectiveCornerRadius - innerInner)
            );
            ctx.fill('evenodd');
          } else {
            ctx.beginPath();
            ctx.rect(innerOuter, innerOuter, canvas.width - innerOuter * 2, canvas.height - innerOuter * 2);
            ctx.rect(innerInner, innerInner, canvas.width - innerInner * 2, canvas.height - innerInner * 2);
            ctx.fill('evenodd');
          }
        }
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
        ctx.save();
        // Headline-style: textSize 100 = ~22% of image min dimension so it stands out (not sentence-sized)
        const minDim = Math.min(canvas.width, canvas.height);
        const fontSize = Math.max(12, Math.min(300, Math.round((textSize / 100) * minDim * 0.22)));
        ctx.font = `${fontSize}px "${textFont}", Arial, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerX = (canvas.width * textOffsetX) / 100;
        const centerY = (canvas.height * textOffsetY) / 100;
        const lines = textContent.trim().split('\n');
        const lineHeight = fontSize * 1.2;
        const startY = centerY - (lines.length - 1) * lineHeight / 2;
        lines.forEach((line, i) => {
          ctx.fillText(line, centerX, startY + i * lineHeight);
        });
        ctx.restore();
      }

      // Convert to data URL
      let dataUrl;
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch (_) {
        try {
          dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        } catch (err) {
          console.error('Failed to export edited image', err);
          return;
        }
      }
      if (cancelled) return;
      setEditedImageUrl(dataUrl);
    };
    img.onerror = () => {
      if (cancelled) return;
      console.error('Failed to load image');
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl, featherEdge, cornerRadius, frameEnabled, frameColor, frameWidth, doubleFrame, textEnabled, textContent, textFont, textColor, textSize, textOffsetX, textOffsetY, printAreaFit, imageOffsetX, imageOffsetY, selectedProductName, slotSwitchTick, selectedCartProductIndex, cartProducts, imageOrientation]);

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
    const imageToUse = editedImageUrl || imageUrl;
    if (!imageToUse || !imageToUse.trim()) {
      alert('No image to use. Please load a screenshot first.');
      return;
    }
    setGenerating300Dpi(true);
    setPrintQualityImageUrl('');
    setPrintQualityMeta(null);
    try {
      const payload = {
        thumbnail_data: imageToUse,
        print_dpi: 300,
        soft_corners: false,
        edge_feather: false
      };
      if (selectedProductName && printAreaFit === 'product') {
        try {
          const dims = getPrintAreaDimensions(selectedProductName, fitProductSize, 'front');
          if (dims && dims.width && dims.height) {
            const scale = screenshotScale / 100;
            payload.print_area_width = dims.width * scale;
            payload.print_area_height = dims.height * scale;
          }
        } catch (_) {}
      }
      const apiUrl = import.meta.env.DEV
        ? 'http://127.0.0.1:5000/api/process-thumbnail-print-quality'
        : apiJoin('/api/process-thumbnail-print-quality');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const result = await response.json();
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
        const err = await response.json().catch(() => ({}));
        alert(err.error || 'Failed to generate 300 DPI image.');
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

  const handleApplyEdits = () => {
    // When opened from order email (order_id in URL): always download, never go to checkout (avoids empty cart)
    const hasOrderId = searchParams.get('order_id') ||
      (typeof window !== 'undefined' && (
        (window.location.search && new URLSearchParams(window.location.search).get('order_id')) ||
        (window.location.href && window.location.href.includes('order_id='))
      )) ||
      isFromOrderEmail;
    if (hasOrderId) {
      handleDownload();
      return;
    }

    if (!editedImageUrl) {
      alert('Please wait for the image to process, or select a screenshot first.');
      return;
    }
    
    // Save edited image to merch session
    try {
      const data = { ...readPendingMerchData() };
      data.edited_screenshot = editedImageUrl;
      data.imageOrientation = imageOrientation === 'landscape' ? 'landscape' : 'portrait';
      data.tools_used = {
        featherEdge,
        cornerRadius,
        frameEnabled,
        frameColor,
        frameWidth,
        doubleFrame,
        textEnabled,
        textContent,
        textFont,
        textColor,
        textSize,
        textOffsetX,
        textOffsetY,
        printAreaFit,
        imageOrientation,
        imageOffsetX,
        imageOffsetY
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

      if (canUpdateCartItem) {
        const offsets = productImageOffsets[cartIndex] || { x: 0, y: 0 };
        updatedCart = cartItems.map((item, index) => {
          if (index === cartIndex) {
            return {
              ...item,
              screenshot: editedImageUrl,
              edited: true,
              tools_acknowledged: true,
              toolSettings: {
                screenshotScale,
                offsetX: offsets.x,
                offsetY: offsets.y,
                featherEdge,
                cornerRadius,
                frameEnabled,
                frameColor,
                frameWidth,
                doubleFrame,
                textEnabled,
                textContent,
                textFont,
                textColor,
                textSize,
                textOffsetX,
                textOffsetY,
                printAreaFit,
                imageOrientation
              }
            };
          }
          return item;
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
            screenshot: editedImageUrl,
            selected_screenshot: editedImageUrl,
            qty: 1,
            category,
            edited: true,
            tools_acknowledged: true,
          }
        ];
        console.log(`💾 Added tools product to cart: ${selectedProduct.name}`);
      } else {
        updatedCart = cartItems.map(item => ({
          ...item,
          screenshot: editedImageUrl,
          edited: true,
          tools_acknowledged: true
        }));
        console.log('💾 Updated screenshot for all cart items');
      }
      
      writeCartItems(updatedCart);
    } catch (e) {
      console.error('Failed to save edited image:', e);
    }

    if (isDemoStorefront()) {
      let category = 'mens';
      try { category = localStorage.getItem('last_selected_category') || 'mens'; } catch (_) {}
      navigate(`/product/browse?category=${encodeURIComponent(category)}&openCart=true`);
      return;
    }
    navigate('/checkout');
  };

  const switchToCartSlot = (newIndex) => {
    if (newIndex == null || !cartProducts[newIndex] || newIndex === selectedCartProductIndex) return;
    switchingSlotRef.current = true;
    const oldIndex = selectedCartProductIndex;
    if (oldIndex !== null && cartProducts[oldIndex]) {
      const cartIndex = cartProducts[oldIndex].originalCartIndex;
      const offset = productImageOffsets[cartIndex] || { x: 0, y: 0 };
      slotStateRef.current[oldIndex] = {
        editedImageUrl,
        screenshotScale,
        selectedProductName,
        printAreaFit,
        imageOrientation,
        imageOffsetX,
        imageOffsetY,
        printQualityImageUrl,
        printQualityMeta,
        offsetX: offset.x,
        offsetY: offset.y,
        fitUserSet: Boolean(fitUserSetRef.current[oldIndex]),
        sourceScreenshot: imageUrl || cartProducts[oldIndex].screenshot || ''
      };
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
    resetToolsEditorSession();
    applyEditorReset();
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

  return (
    <div className="tools-page-container" ref={containerRef}>
      <button
        type="button"
        ref={backBtnRef}
        className="tools-back-btn tools-back-btn-page"
        onClick={goBackFromTools}
        aria-label="Back"
      >
        ←
      </button>
      <div className="tools-page-header">
        <h1>Edit Tools</h1>
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
                // Radius/feather are clipped in CSS on the visible print box.
                // Prefer the unbaked screenshot so cover-fit does not hide those
                // edges, and so baked + CSS do not double-soften the same sides.
                const overlayNeedsBakedPixels = Boolean(
                  (textEnabled && String(textContent || '').trim()) ||
                  (printAreaFit !== 'none' && printAreaFit !== 'product')
                );
                const overlayScreenshot = overlayNeedsBakedPixels
                  ? currentImage
                  : (imageUrl || currentImage);
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
                      <span className="product-preview-heading-label">
                        Product Preview ({selectedCartProductIndex + 1} of {cartProducts.length})
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
                        ←
                      </button>
                      <div className="product-preview-visual">
                    {(() => {
                      const productName = selectedProductName || product.name || '';
                      const isMug = isMugProduct(productName);
                      const isHat = isHatProduct(productName);
                      const toolsUnavailable = getToolsUnavailableInfo(product.name || productName, product.category);
                      const isMiscNoPreview = isMiscProductNoPreview(productName);
                      
                      // Debug logging for hat products
                      if (isHat) {
                        console.log('🎩 [HAT DETECTED] Product:', productName, 'Will use generic hat image');
                      }
                      
                      if (toolsUnavailable) {
                        return <ToolsUnavailableNotice info={toolsUnavailable} />;
                      }
                      
                      // Mugs: Show "Preview Not Available" message, but allow tools
                      if (isMug) {
                        return (
                          <div style={{
                            padding: '20px',
                            textAlign: 'center',
                            background: '#e7f3ff',
                            border: '2px solid #b3d9ff',
                            borderRadius: '8px',
                            color: '#004085',
                            minHeight: '150px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}>
                            <div style={{ fontSize: '24px', marginBottom: '10px' }}>☕</div>
                            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Preview Not Available</div>
                            <div style={{ fontSize: '14px' }}>
                              Mug preview is not available due to the curved surface, but you can still use the editing tools to customize your screenshot.
                            </div>
                          </div>
                        );
                      }
                      
                      // Misc products (no preview needed): Allow tools but no preview
                      // Still render ProductPreviewWithDrag for size calculation, but use placeholder image
                      if (isMiscNoPreview) {
                        if (currentImage) {
                          // Use a placeholder transparent/white image for size calculation
                          // Create a data URL for a white rectangle
                          const placeholderSize = 400;
                          const canvas = document.createElement('canvas');
                          canvas.width = placeholderSize;
                          canvas.height = placeholderSize;
                          const ctx = canvas.getContext('2d');
                          ctx.fillStyle = '#f8f9fa';
                          ctx.fillRect(0, 0, placeholderSize, placeholderSize);
                          const placeholderImage = canvas.toDataURL();
                          
                          return (
                            <div style={{ position: 'relative' }}>
                              <ProductPreviewWithDrag
                                key={`${cartIndex}|${shotFingerprint(placeholderImage)}|${shotFingerprint(overlayScreenshot)}`}
                                productImage={placeholderImage}
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
                                textOffsetX={textOffsetX}
                                textOffsetY={textOffsetY}
                                onTextPositionChange={textEnabled ? (px, py) => { setTextOffsetX(px); setTextOffsetY(py); } : undefined}
                                featherEdge={featherEdge}
                                cornerRadius={cornerRadius}
                                frameEnabled={frameEnabled}
                                frameColor={frameColor}
                                frameWidth={frameWidth}
                                doubleFrame={doubleFrame}
                                sourceWidth={currentImageDimensions.width}
                                sourceHeight={currentImageDimensions.height}
                                printAreaFit={printAreaFit}
                                selectedProductName={selectedProductName}
                                screenshotScale={screenshotScale}
                                imageOffsetX={imageOffsetX}
                                imageOffsetY={imageOffsetY}
                                imageOrientation={imageOrientation}
                              />
                              <div style={{
                                position: 'absolute',
                                top: '10px',
                                left: '10px',
                                right: '10px',
                                background: 'rgba(255, 255, 255, 0.9)',
                                padding: '8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                textAlign: 'center',
                                border: '1px solid #dee2e6'
                              }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Product Preview Not Available</div>
                                <div style={{ fontSize: '11px', color: '#666' }}>
                                  Screenshot size reflects selected product print area
                                </div>
                              </div>
                            </div>
                          );
                        } else {
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
                              <div style={{ fontSize: '24px', marginBottom: '10px' }}>✏️</div>
                              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Product Preview Not Available</div>
                              <div style={{ fontSize: '14px' }}>
                                You can use the editing tools to customize your screenshot for this product.
                              </div>
                            </div>
                          );
                        }
                      }
                      
                      // Hats: Use generic hat image for all hats (always, even without screenshot)
                      if (isHat) {
                        const hatImage = getGenericHatImage();
                        console.log('🎩 [HAT DETECTED] Product:', productName);
                        console.log('🎩 [HAT IMAGE] Using generic hat image:', hatImage);
                        console.log('🎩 [HAT IMAGE] Original product image from cart:', product.productImage);
                        console.log('🎩 [HAT IMAGE] Will override with:', hatImage);
                        // Only show preview if there's a screenshot
                        if (currentImage) {
                          return (
                            <ProductPreviewWithDrag
                              key={`${cartIndex}|${shotFingerprint(hatImage)}|${shotFingerprint(overlayScreenshot)}`}
                              productImage={hatImage}
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
                              textOffsetX={textOffsetX}
                              textOffsetY={textOffsetY}
                              onTextPositionChange={textEnabled ? (px, py) => { setTextOffsetX(px); setTextOffsetY(py); } : undefined}
                              featherEdge={featherEdge}
                              cornerRadius={cornerRadius}
                              frameEnabled={frameEnabled}
                              frameColor={frameColor}
                              frameWidth={frameWidth}
                              doubleFrame={doubleFrame}
                              sourceWidth={currentImageDimensions.width}
                              sourceHeight={currentImageDimensions.height}
                              printAreaFit={printAreaFit}
                              selectedProductName={selectedProductName}
                              screenshotScale={screenshotScale}
                              imageOffsetX={imageOffsetX}
                              imageOffsetY={imageOffsetY}
                              imageOrientation={imageOrientation}
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
                        const productImg = fitPreviewImageUrl || product.productImage || getPlaceholderProductImage();
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
                            textOffsetX={textOffsetX}
                            textOffsetY={textOffsetY}
                            onTextPositionChange={textEnabled ? (px, py) => { setTextOffsetX(px); setTextOffsetY(py); } : undefined}
                            featherEdge={featherEdge}
                            cornerRadius={cornerRadius}
                            frameEnabled={frameEnabled}
                            frameColor={frameColor}
                            frameWidth={frameWidth}
                            doubleFrame={doubleFrame}
                            sourceWidth={currentImageDimensions.width}
                            sourceHeight={currentImageDimensions.height}
                            printAreaFit={printAreaFit}
                            selectedProductName={selectedProductName}
                            screenshotScale={screenshotScale}
                            imageOffsetX={imageOffsetX}
                            imageOffsetY={imageOffsetY}
                            imageOrientation={imageOrientation}
                          />
                        );
                      }
                      
                      return null;
                    })()}
                      </div>
                    </div>
                    <p className="product-preview-color-note">
                      Color shown is for display only. You&apos;ll receive the color you selected.
                    </p>
                    <p className="edit-tools-under-preview">Edit Tools</p>
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
          <h1 className="tools-column-heading">Edit Tools</h1>
          <div className="tools-controls-section">
          {/* Product Selector - Small dropdown at top of tools */}
          {cartProducts.length > 1 && (
            <div 
              className="tool-control-group"
              style={{ 
                marginBottom: '1rem',
                position: 'relative'
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Select Product From Cart:
              </h3>
              <select
                value={selectedCartProductIndex !== null ? selectedCartProductIndex : ''}
                onChange={(e) => {
                  const newIndex = parseInt(e.target.value);
                  switchToCartSlot(newIndex);
                }}
                className="print-area-select"
                style={{ width: '100%' }}
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
          
          {/* Fit to Print Area - At the top */}
          <div className="tool-control-group">
            <h3>Fit to Print Area</h3>
            <p className="tool-description">Crop image to fit product print areas</p>
            
            {/* Portrait = tuned print box. Landscape = same box, wide on the chest. */}
            <div className="select-control" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Image orientation:</label>
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
                      if (selectedProductName && printAreaFit === 'none') {
                        setPrintAreaFit('product');
                      }
                      if (selectedCartProductIndex !== null) {
                        fitUserSetRef.current[selectedCartProductIndex] = true;
                      }
                    }}
                  />
                  <span>Landscape (wide print inside the print area)</span>
                </label>
              </div>
            </div>
            
            {/* Product Selector */}
            <div 
              className="select-control product-select-pulse-wrapper"
              style={{ marginBottom: '1rem', position: 'relative' }}
            >
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Select Product:
              </label>
              <select
                value={selectedProductName}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedProductName(value);
                  setProductSelectClicked(true);
                  setScreenshotSizeInteracted(false);
                  if (value) {
                    setPrintAreaFit('product');
                    if (!orientationUserSetRef.current) {
                      rememberArtworkOrientation('portrait');
                      setImageOrientation('portrait');
                    }
                  }
                  if (selectedCartProductIndex !== null) {
                    fitUserSetRef.current[selectedCartProductIndex] = true;
                  }
                  const matchIdx = cartProducts.findIndex((p) => {
                    const n = matchPrintAreaProductName(p.name) || p.name;
                    return n === value || p.name === value;
                  });
                  if (matchIdx >= 0) {
                    switchToCartSlot(matchIdx);
                  }
                }}
                className={`print-area-select ${!productSelectClicked ? 'product-select-pulse' : ''}`}
              >
                <option value="">-- Select Product --</option>
                {Object.keys(PRINT_AREA_CONFIG).sort().map(productName => (
                  <option key={productName} value={productName}>
                    {productName}
                  </option>
                ))}
              </select>
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
            </div>
            
            {(printAreaFit !== 'none' || imageOrientation === 'landscape') && (
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
                    <span className="slider-value">{featherEdge}%</span>
                  </div>
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
                    <span className="slider-value">{cornerRadius === 100 ? 'Circle' : `${cornerRadius}%`}</span>
                  </div>
                </div>

                <div className="tool-control-group">
                  <h3>Text</h3>
                  <p className="tool-description">Add text to your creation with custom font, color and size</p>
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
                            <label style={{ minWidth: '100px' }}>Frame Color:</label>
                            <input
                              type="color"
                              value={frameColor}
                              onChange={(e) => setFrameColor(e.target.value)}
                              className="color-picker"
                            />
                            <span className="color-value" style={{ wordBreak: 'break-all' }}>{frameColor}</span>
                          </div>
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
                    
                    {/* Screenshot Preview - Small window to the right */}
                    <div style={{ 
                      flexShrink: 0, 
                      width: '200px', 
                      background: 'white', 
                      borderRadius: '8px', 
                      padding: '12px',
                      border: '2px solid #e0e0e0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                      <h4 className="screenshot-preview-title" style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
                        Screenshot Preview
                      </h4>
                      <div style={{ 
                        width: '100%', 
                        minHeight: '120px', 
                        maxHeight: '150px',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: '#f8f9fa', 
                        borderRadius: '6px', 
                        overflow: 'hidden',
                        border: '1px solid #dee2e6'
                      }}>
                        {editedImageUrl ? (
                          <img 
                            key={editedImageUrl}
                            src={editedImageUrl} 
                            alt="Screenshot Preview" 
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '150px', 
                              objectFit: 'contain',
                              display: 'block'
                            }}
                          />
                        ) : imageUrl ? (
                          <img 
                            key={imageUrl}
                            src={imageUrl} 
                            alt="Screenshot Preview" 
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '150px', 
                              objectFit: 'contain',
                              display: 'block'
                            }}
                          />
                        ) : (
                          <p style={{ color: '#999', fontSize: '0.85rem', margin: 0, textAlign: 'center', padding: '10px' }}>
                            No screenshot loaded
                          </p>
                        )}
                      </div>
                    </div>
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
          
          {(() => {
            // Check if current product is all-over-print (tools should be disabled)
            const currentProduct = cartProducts.length > 0 && selectedCartProductIndex !== null 
              ? cartProducts[selectedCartProductIndex] 
              : null;
            const currentProductName = currentProduct?.name || '';
            const toolsUnavailable = getToolsUnavailableInfo(currentProductName, currentProduct?.category);
            
            if (toolsUnavailable) {
              return null; // Don't show Framed Border if tools are disabled
            }
            
            return null; // Framed Border is already shown above
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
                  </>
                );
              }
              // Cart tools: show Apply Edits (apply and proceed to checkout)
              return (
                <button 
                  className="apply-edits-btn"
                  onClick={handleApplyEdits}
                  disabled={!editedImageUrl}
                >
                  Apply Edits
                </button>
              );
            })()}
            <button 
              className="reset-btn"
              onClick={() => {
                setFeatherEdge(0);
                setCornerRadius(0);
                setFrameEnabled(false);
                setFrameWidth(10);
                setFrameColor('#FF0000');
                setDoubleFrame(false);
                setTextEnabled(false);
                setTextContent('');
                setTextFont('Arial');
                setTextColor('#000000');
                setTextSize(24);
                setTextOffsetX(50);
                setTextOffsetY(50);
                setPrintAreaFit('none');
                setImageOffsetX(0);
                setImageOffsetY(0);
              }}
            >
              Reset
            </button>
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

export default ToolsPage;

