import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import ToolsPage from '../ToolsPage/ToolsPage';
import { supabase } from '../../supabaseClient';
import { UserService, claimSessionTokenIfNeeded } from '../../utils/userService';
import { getBackendUrl, apiJoin } from '../../config/apiConfig';
import { favoriteListsJson, artworkDisplayUrl } from '../../utils/favoriteListsApi';
import { useCreator } from '../../contexts/CreatorContext';
import { resolvePrintfulVariantId } from '../../utils/printfulVariants';
import { setToolsFocusCartIndex, setToolsPreviewNewest, writeCartItems, readPendingMerchData, savePendingMerchData, readCartItems, applySelectedScreenshot, applyCroppedScreenshot, rememberToolsProductName, peekToolsPreviewNewest, isVideoScreenshotMerch, readBrowseToolSettings, writeBrowseToolSettings, rememberArtworkOrientation } from '../../utils/merchSession';
import { applyBrowsePresetToCartItem, featherEdgeMaskStyle } from '../../utils/bakeBrowsePreset';
import { BW_INTENSITY_DEFAULT, blackAndWhiteCssFilter, bwIntensityLabel, clampBwIntensity } from '../../utils/blackAndWhiteFilter';
import { isShopperSignedIn } from '../../utils/shopperAuth';
import { isDemoStorefront } from '../../utils/demoStorefront';
import { isCurvedBagProduct, stripCurvedBagRectEdits } from '../../utils/mugMockup';
import {
  getPrintfulColorCode,
  getPrintfulColorMockupUrl,
  isColorMockupPreviewEnabled,
  pendingSwatchColors,
  swatchToneClass,
  usesPrintfulVariantColorTint,
} from '../../utils/printfulColorMockups';
import { isCreatorStorefrontHostname } from '../../utils/subdomainService';
import { saveShopAddIntent, SHOP_CATEGORIES, storefrontMockupUrl } from '../../utils/shopCategories';
import { ChevronLeft } from '../../Components/Chevrons/Chevrons';
import { readShipToCountry, SHIP_TO_UPDATED_EVENT } from '../../utils/shipToCountry';
import {
  catalogStockPending,
  comboAvailableForCountry,
  getAvailableColorsForCountry,
  getAvailableSizesForCountry,
  getColorsForCountry,
  productShipsToCountry,
  repriceCartItems,
  shipToCountryName,
  unitPriceForCountry,
} from '../../utils/regionalAvailability';
import { peekDisplaySrc, prepareDisplaySrc } from '../../utils/displaySrc';
import InlineStillCrop from '../../Components/InlineStillCrop/InlineStillCrop';
import './ProductPage.css';

const BROWSE_EDIT_ORIGINAL = {
  blackAndWhite: false,
  bwIntensity: BW_INTENSITY_DEFAULT,
  cornerRadius: 0,
  featherEdge: 0,
  frameEnabled: false,
  doubleFrame: false,
};

const BROWSE_EDIT_PRESETS = [
  {
    id: 'bw',
    label: 'Black and White',
    settings: { ...BROWSE_EDIT_ORIGINAL, blackAndWhite: true, bwIntensity: BW_INTENSITY_DEFAULT },
  },
  {
    id: 'radius',
    label: 'Corner radius',
    settings: { ...BROWSE_EDIT_ORIGINAL, cornerRadius: 25 },
  },
  {
    id: 'feather',
    label: 'Feathered edge',
    settings: { ...BROWSE_EDIT_ORIGINAL, featherEdge: 38 },
  },
  {
    id: 'frame',
    label: 'Frame',
    settings: { ...BROWSE_EDIT_ORIGINAL, frameEnabled: true, frameColor: '#111111', innerFrameColor: '#111111', frameWidth: 6, doubleFrame: true },
  },
];

const BROWSE_FEATHER_EDGE = BROWSE_EDIT_PRESETS.find((p) => p.id === 'feather')?.settings?.featherEdge || 38;

function isHatsCategory(cat) {
  return String(cat || '').toLowerCase().trim() === 'hats';
}

function defaultBrowseOrientation(cat) {
  return isHatsCategory(cat) ? 'landscape' : 'portrait';
}

function BrowseLayoutPicker({ value, onChange, groupName = 'browse-image-layout' }) {
  const isLandscape = value === 'landscape';
  return (
    <div className="browse-layout-picker" role="radiogroup" aria-label="Image layout">
      <label className={`browse-layout-picker-option${isLandscape ? '' : ' is-selected'}`}>
        <input
          type="radio"
          name={groupName}
          value="portrait"
          checked={!isLandscape}
          onChange={() => onChange('portrait')}
        />
        Portrait
      </label>
      <label className={`browse-layout-picker-option${isLandscape ? ' is-selected' : ''}`}>
        <input
          type="radio"
          name={groupName}
          value="landscape"
          checked={isLandscape}
          onChange={() => onChange('landscape')}
        />
        Landscape
      </label>
    </div>
  );
}

function useBrowseDisplaySrc(url) {
  const raw = String(url || '').trim();
  const httpDisplay = /^https?:/i.test(raw) ? (artworkDisplayUrl(raw) || raw) : raw;
  const [src, setSrc] = useState(() => {
    if (!raw) return '';
    if (httpDisplay && httpDisplay !== raw) return httpDisplay;
    return peekDisplaySrc(raw)?.src || httpDisplay || raw;
  });
  useEffect(() => {
    if (!raw) {
      setSrc('');
      return undefined;
    }
    if (httpDisplay && !raw.startsWith('data:') && !raw.startsWith('blob:')) {
      setSrc(httpDisplay);
      return undefined;
    }
    const hit = peekDisplaySrc(raw);
    if (hit?.src) {
      setSrc(hit.src);
      return undefined;
    }
    setSrc(raw);
    if (!(raw.startsWith('data:') || raw.startsWith('blob:'))) {
      return undefined;
    }
    let cancelled = false;
    prepareDisplaySrc(raw, 360, { urgent: true })
      .then((next) => {
        if (!cancelled && next?.src) setSrc(next.src);
      })
      .catch(() => {
        /* keep the original so the Selected Image window is never blank */
      });
    return () => {
      cancelled = true;
    };
  }, [raw, httpDisplay]);
  return src;
}

function isScreenmerchHost() {
  if (typeof window === 'undefined') return false;
  const host = (window.location.hostname || '').toLowerCase();
  return host === 'screenmerch.com' || host === 'www.screenmerch.com' || host.endsWith('.screenmerch.com');
}

const getImgBase = () => {
  // Same-origin /static/images is proxied to Fly and cached by Netlify.
  if (isScreenmerchHost()) return '/static/images';
  const base = getBackendUrl();
  if (!base || typeof base !== 'string') return IMG_BASE_FALLBACK;
  return `${base.replace(/\/$/, '')}/static/images`;
};

// Ensure HTTPS to avoid Mixed Content on https://screenmerch.com
const ensureHttps = (url) => {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/^http:\/\//i, 'https://');
};

function productImageSrc(url) {
  if (!url || typeof url !== 'string') return `${getImgBase()}/placeholder.png`;
  const raw = ensureHttps(url.trim());
  const match = raw.match(/\/static\/images\/([^/?#]+)/i);
  if (match) return `${getImgBase()}/${match[1]}`;
  if (raw.startsWith('http')) return raw;
  return `${getImgBase()}/${raw.replace(/^\/+/, '')}`;
}

// Prefer full URL from API (main_image_url / preview_image_url) when present
const getProductImageUrl = (product, preferPreview = true) => {
  if (!product) return `${getImgBase()}/placeholder.png`;
  const forced = storefrontMockupUrl(product.name || product.product, '');
  if (forced) return productImageSrc(forced);
  // Use normalized URL from setProductData so images persist across category switches
  if (product._displayImageUrl) return productImageSrc(product._displayImageUrl);
  const url = preferPreview
    ? (product.preview_image_url || product.preview_image)
    : (product.main_image_url || product.main_image);
  return productImageSrc(url);
};

// Cart screenshots still need a unique query when the same URL is reused.
const getCacheBuster = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/** Keep the current mockup visible until the next color photo is decoded, same as Women's Shirt. */
function PrintfulColorMockupImg({
  src,
  className,
  alt,
  loading,
  fetchPriority,
  sizes,
  onError,
  tintColor,
  isWrapPreview = false,
}) {
  const [shownSrc, setShownSrc] = useState(src);
  const wasWrapRef = useRef(Boolean(isWrapPreview));
  useEffect(() => {
    const droppedWrap = wasWrapRef.current && !isWrapPreview;
    wasWrapRef.current = Boolean(isWrapPreview);
    if (!src) {
      setShownSrc('');
      return undefined;
    }
    if (droppedWrap) {
      setShownSrc(src);
      return undefined;
    }
    if (src === shownSrc) return undefined;
    let cancelled = false;
    const img = new Image();
    img.decoding = 'async';
    const commit = () => {
      if (!cancelled) setShownSrc(src);
    };
    img.onload = commit;
    img.onerror = commit;
    img.src = src;
    if (img.complete) commit();
    return () => {
      cancelled = true;
    };
  }, [src, shownSrc, isWrapPreview]);
  const image = (
    <img
      className={className}
      src={shownSrc || src}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      sizes={sizes}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={onError}
    />
  );
  if (!tintColor) return image;
  return (
    <span className="product-image-tint-shell" style={{ backgroundColor: tintColor }}>
      {image}
    </span>
  );
}

const categoryBrowseCache = new Map();
const BROWSE_CACHE_KEY = (category) => `sm_browse_v8_${String(category || '').trim().toLowerCase()}`;

function readBrowseCache(category) {
  const mem = categoryBrowseCache.get(category);
  if (mem?.products?.length) return mem;
  try {
    const raw = sessionStorage.getItem(BROWSE_CACHE_KEY(category));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.products?.length) {
      categoryBrowseCache.set(category, parsed);
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function browseNeedsLiveStock(data) {
  const products = data?.products;
  if (!Array.isArray(products) || !products.length) return false;
  return products.some((p) => catalogStockPending(p));
}

function writeBrowseCache(category, data) {
  if (!data?.products?.length) return;
  categoryBrowseCache.set(category, data);
  if (browseNeedsLiveStock(data)) return;
  try {
    sessionStorage.setItem(BROWSE_CACHE_KEY(category), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

const PRODUCT_CARD_CONTROL_SELECTOR = 'select, button, a, input, textarea, label, .product-options, .variant-unavailable-note';

const isProductCardControlClick = (event) => {
  const target = event?.target;
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest(PRODUCT_CARD_CONTROL_SELECTOR));
};

const preloadImageUrls = (urls) => {
  (urls || []).forEach((url) => {
    if (!url || typeof url !== 'string') return;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  });
};

const STATIC_CATEGORY_PRODUCT_NAMES = {
  mens: [
    'T-Shirt',
    "Men's Long Sleeve Shirt",
    'Mens Fitted T-Shirt',
    "Men's Tank Top",
    'Oversized T-Shirt',
    "Men's Fitted Long Sleeve",
    'Hoodie',
    'Champion Hoodie',
  ],
  womens: [
    "Women's Shirt",
    'Heavyweight T-Shirt',
    "Women's Ribbed Neck",
    'Micro-Rib Tank Top',
    'Racerback Tank',
    "Women's Crop Top",
    'Pullover Hoodie',
    'Cropped Hoodie',
  ],
  kids: [
    'Youth Heavy Blend Hoodie',
    'Kids Shirt',
    'Kids Long Sleeve',
    'Toddler Short Sleeve T-Shirt',
    'Toddler Jersey T-Shirt',
    'Kids Sweatshirt',
    'Youth All Over Print Swimsuit',
    'Girls Leggings',
    'Baby Staple Tee',
    'Baby Jersey T-Shirt',
    'Baby Body Suit',
  ],
  bags: [
    'Laptop Sleeve',
    'All-Over Print Drawstring',
    'All Over Print Tote Pocket',
    'All-Over Print Crossbody Bag',
    'All-Over Print Utility Bag',
  ],
  hats: [
    'Distressed Dad Hat',
    'Closed Back Cap',
    'Five Panel Trucker Hat',
    'Five Panel Baseball Cap',
  ],
  mugs: ['White Glossy Mug', 'Travel Mug', 'Enamel Mug', 'Colored Mug'],
  pets: ['Pet Bowl All-Over Print', 'Pet Bandana Collar'],
  misc: ['Hardcover Bound Notebook', 'Apron', 'Jigsaw Puzzle with Tin', 'Greeting Card'],
  'all-products': [],
  thumbnails: [],
};

const STATIC_PRODUCT_IMAGE_MAP = {
  Hoodie: { filename: 'tested.png', preview: 'testedpreview.png', price: 35.35 },
  "Men's Tank Top": { filename: 'random.png', preview: 'randompreview.png', price: 26.23 },
  'Mens Fitted T-Shirt': { filename: 'mensfittedtshirt.png', preview: 'mensfittedtshirtpreview.png', price: 28.58 },
  "Men's Fitted Long Sleeve": { filename: 'mensfittedlongsleeve.png', preview: 'mensfittedlongsleevepreview.png', price: 31.33 },
  'T-Shirt': { filename: 'guidontee.png', preview: 'guidonteepreview.png', price: 23.69 },
  'Oversized T-Shirt': { filename: 'unisexoversizedtshirt.png', preview: 'unisexoversizedtshirtpreview.png', price: 28.49 },
  "Men's Long Sleeve Shirt": { filename: 'menslongsleeveshirt6.png', preview: 'menslongsleeveshirtpreview6.png', price: 26.79 },
  'Champion Hoodie': { filename: 'hoodiechampion.png', preview: 'hoodiechampionpreview.png', price: 47.00 },
  'Cropped Hoodie': { filename: 'womenscroppedhoodiepreview.png', preview: 'womenscroppedhoodiepreview.png', price: 45.15 },
  'Racerback Tank': { filename: 'womenstankpreview.png', preview: 'womenstankpreview.png', price: 22.95 },
  'Micro-Rib Tank Top': { filename: 'womensmicroribtanktoppreview.png', preview: 'womensmicroribtanktoppreview.png', price: 27.81 },
  "Women's Ribbed Neck": { filename: 'womensribbedneckpreview.png', preview: 'womensribbedneckpreview.png', price: 27.60 },
  "Women's Shirt": { filename: 'womenshirtpreview.png', preview: 'womenshirtpreview.png', price: 25.69 },
  'Heavyweight T-Shirt': { filename: 'womenshdshirtpreview.png', preview: 'womenshdshirtpreview.png', price: 27.29 },
  'Pullover Hoodie': { filename: 'womensunisexpulloverhoodiepreview.png', preview: 'womensunisexpulloverhoodiepreview.png', price: 43.06 },
  "Women's Crop Top": { filename: 'womenscroptoppreview.png', preview: 'womenscroptoppreview.png', price: 30.55 },
  'Youth Heavy Blend Hoodie': { filename: 'kidhoodie.png', preview: 'kidsyouthheavyblendhoodiepreview2.png', price: 31.33 },
  'Kids Shirt': { filename: 'kidshirt.png', preview: 'kidsshirtpreview2.png', price: 25.49 },
  'Kids Long Sleeve': { filename: 'kidlongsleeve.png', preview: 'kidslongsleevepreview2.png', price: 28.49 },
  'Toddler Short Sleeve T-Shirt': { filename: 'toddlershortsleevet.png', preview: 'toddlershortsleevetpreview.png', price: 24.75 },
  'Toddler Jersey T-Shirt': { filename: 'toddlerjerseytshirt.png', preview: 'kidstoddlerjerseytshirtpreview2.png', price: 22.29 },
  'Baby Staple Tee': { filename: 'babystapletshirt.png', preview: 'kidsbabystapleteepreview2.png', price: 24.19 },
  'Baby Jersey T-Shirt': { filename: 'toddlershortsleevet.png', preview: 'kidsbabyjerseytshirtpreview2.png', price: 22.29 },
  'Baby Body Suit': { filename: 'kidsbabybodysuit6.png', preview: 'kidsbabybodysuitpreview6.png', price: 22.90 },
  'Kids Sweatshirt': { filename: 'kidssweatshirt.png', preview: 'kidssweatshirtpreview2.png', price: 29.29 },
  'Youth All Over Print Swimsuit': { filename: 'youthalloverprintswimsuit.png', preview: 'youthalloverprintswimsuitpreview.png', price: 35.95 },
  'Girls Leggings': { filename: 'girlsleggings.png', preview: 'girlsleggingspreview.png', price: 30.31 },
  'Laptop Sleeve': { filename: 'laptopsleeve.png', preview: 'laptopsleevepreview.png', price: 33.16 },
  'All-Over Print Drawstring': { filename: 'drawstringbag.png', preview: 'drawstringbagpreview.png', price: 27.25 },
  'All-Over Print Utility Bag': { filename: 'crossbodybag.png', preview: 'crossbodybagpreview.png', price: 33.79 },
  'All Over Print Tote Pocket': { filename: 'largecanvasbag.png', preview: 'largecanvasbagpreview.png', price: 35.41 },
  'All-Over Print Crossbody Bag': { filename: 'crossbodybag.png', preview: 'crossbodybagpreview.png', price: 30.95 },
  'Distressed Dad Hat': { filename: 'distresseddadhat.png', preview: 'distresseddadhatpreview.png', price: 26.95 },
  'Closed Back Cap': { filename: 'closedbackcap.png', preview: 'hatsclosedbackcappreview.png', price: 24.91 },
  'Five Panel Trucker Hat': { filename: 'fivepaneltruckerhat.png', preview: 'fivepaneltruckerhatpreview.png', price: 26.95 },
  'Five Panel Baseball Cap': { filename: 'youthbaseballcap.png', preview: 'youthbaseballcappreview.png', price: 26.95 },
  'White Glossy Mug': { filename: 'mug1.png', preview: 'mug1preview.png', price: 17.95 },
  'Travel Mug': { filename: 'travelmug.png', preview: 'travelmugpreview.png', price: 21.95 },
  'Enamel Mug': { filename: 'enamalmug.png', preview: 'enamalmugpreview.png', price: 20.95 },
  'Colored Mug': { filename: 'coloredmug.png', preview: 'coloredmugpreview.png', price: 19.95 },
  'Pet Bowl All-Over Print': { filename: 'dogbowl.png', preview: 'dogbowlpreview.png', price: 33.49 },
  'Pet Bandana Collar': { filename: 'scarfcollar.png', preview: 'scarfcollarpreview.png', price: 21.95 },
  'Greeting Card': { filename: 'greetingcard.png', preview: 'greetingcardpreview.png', price: 9.99 },
  'Hardcover Bound Notebook': { filename: 'hardcovernotebook.png', preview: 'hardcovernotebookpreview.png', price: 23.05 },
  Apron: { filename: 'apron.png', preview: 'apronpreview.png', price: 28.90 },
  'Jigsaw Puzzle with Tin': { filename: 'jigsawpuzzle.png', preview: 'jigsawpuzzlepreview.png', price: 25.40 },
};

function getStaticProductsForCategory(category) {
  const categoryProducts = STATIC_CATEGORY_PRODUCT_NAMES[category] || [];
  if (!category || category === 'all' || category === 'all-products') return [];
  return categoryProducts
    .map((productName) => {
      const productMeta = STATIC_PRODUCT_IMAGE_MAP[productName] || {
        filename: 'placeholder.png',
        preview: 'placeholder.png',
        price: 25.00,
      };
      return {
        name: productName,
        price: productMeta.price,
        main_image: `${getImgBase()}/${productMeta.filename}`,
        preview_image: `${getImgBase()}/${productMeta.preview}`,
        _catalogPreview: true,
        options: {
          color: ['Black', 'White', 'Hazy Pink', 'Pale Pink', 'Orchid', 'Ecru', 'White', 'Bubblegum', 'Bone', 'Mineral', 'Natural'],
          size: ['XS', 'S', 'M', 'L', 'XL'],
        },
      };
    })
    .sort(
      (a, b) =>
        (Number(a.price) || 0) - (Number(b.price) || 0) || String(a.name).localeCompare(String(b.name)),
    );
}

function decorateBrowseData(data, isShopCatalog) {
  const productsWithUrls = (data.products || []).map((p) => {
    if (!p) return p;
    const previewUrl = p.preview_image_url || p.preview_image || '';
    const mainUrl = p.main_image_url || p.main_image || '';
    return { ...p, _displayImageUrl: productImageSrc(previewUrl || mainUrl) };
  });
  const next = { ...data, products: productsWithUrls };
  if (!isShopCatalog) return next;
  return {
    ...next,
    img_url: '',
    product: { thumbnail_url: '', screenshots: [] },
  };
}

function buildInitialProductData() {
  let category = '';
  let isShopCatalog = false;
  try {
    const qs = new URLSearchParams(window.location.search);
    category = (qs.get('category') || '').trim();
    isShopCatalog = qs.get('from') === 'shop';
  } catch {
    /* ignore */
  }
  if (!category || category === 'all' || category === 'all-products') return null;
  const cached = readBrowseCache(category);
  if (cached?.products?.length) return decorateBrowseData(cached, isShopCatalog);
  const staticProducts = getStaticProductsForCategory(category);
  if (!staticProducts.length) return null;
  return decorateBrowseData(
    {
      success: true,
      products: staticProducts,
      category,
      product: { thumbnail_url: '', screenshots: [] },
    },
    isShopCatalog,
  );
}

const PRODUCT_IMAGE_RETRY_DELAYS_MS = [400, 1200, 2800];

function browseImageLoadHints(index) {
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  return {
    loading: index < (mobile ? 3 : 8) ? 'eager' : 'lazy',
    fetchPriority: index < (mobile ? 1 : 4) ? 'high' : 'auto',
  };
}

/** Fly static files can 502 on a cold start; retry before locking in the gray placeholder. */
const handleProductImageError = (event, product) => {
  const img = event.currentTarget;
  if (!img) return;
  const placeholder = `${getImgBase()}/placeholder.png`;
  const attempt = Number(img.dataset.retryAttempt || 0);
  const original = img.dataset.originalSrc || img.getAttribute('src') || '';
  if (!img.dataset.originalSrc && original && !original.includes('placeholder.png')) {
    img.dataset.originalSrc = original.split('?')[0];
  }
  const primary = img.dataset.originalSrc || '';
  if (primary && !primary.includes('placeholder.png') && attempt < PRODUCT_IMAGE_RETRY_DELAYS_MS.length) {
    img.dataset.retryAttempt = String(attempt + 1);
    const delay = PRODUCT_IMAGE_RETRY_DELAYS_MS[attempt];
    window.setTimeout(() => {
      if (!img.isConnected) return;
      const current = (img.getAttribute('src') || '').split('?')[0];
      if (current !== primary) return;
      img.src = `${primary}${primary.includes('?') ? '&' : '?'}retry=${attempt + 1}`;
    }, delay);
    return;
  }
  const fallback = getProductImageUrl(product, false);
  if (fallback && fallback !== primary && img.src !== fallback && !fallback.includes('placeholder.png')) {
    img.dataset.retryAttempt = '0';
    img.dataset.originalSrc = fallback.split('?')[0];
    img.src = fallback;
    return;
  }
  if (img.src !== placeholder) img.src = placeholder;
};

const ProductPage = ({ sidebar }) => {
  const { productId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { creatorSettings } = useCreator();
  const [productData, setProductData] = useState(buildInitialProductData);
  const [loading, setLoading] = useState(() => !buildInitialProductData());
  const [error, setError] = useState(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  /** Actual URL/data of the selected screenshot (set on click). Used for add-to-cart so the exact chosen image is sent, not a fallback. */
  const [selectedScreenshotUrl, setSelectedScreenshotUrl] = useState(null);
  const [selectedEditPreset, setSelectedEditPreset] = useState('original');
  const [bwIntensity, setBwIntensity] = useState(BW_INTENSITY_DEFAULT);
  const [browseLayoutOrientation, setBrowseLayoutOrientation] = useState(() => {
    try {
      const fromQuery = new URLSearchParams(window.location.search).get('category');
      const stored = localStorage.getItem('last_selected_category');
      return defaultBrowseOrientation(fromQuery || stored || '');
    } catch {
      return 'portrait';
    }
  });
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  ));
  const [selectedColors, setSelectedColors] = useState({});
  const [previewColors, setPreviewColors] = useState({});
  const [selectedSizes, setSelectedSizes] = useState({});
  const [variantAvailability, setVariantAvailability] = useState({});
  const [addingProductIndex, setAddingProductIndex] = useState(null);
  const addingLockRef = useRef(new Set());
  const radiusObserverRef = useRef(null);
  const [radiusPreviewPx, setRadiusPreviewPx] = useState(0);
  const setRadiusFrameNode = useCallback((el) => {
    if (radiusObserverRef.current) {
      radiusObserverRef.current.disconnect();
      radiusObserverRef.current = null;
    }
    if (!el) {
      setRadiusPreviewPx(0);
      return;
    }
    const sync = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!(width > 0 && height > 0)) return;
      setRadiusPreviewPx(Math.min(width, height) * 0.125);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    radiusObserverRef.current = ro;
  }, []);
  const [shipToCountry, setShipToCountry] = useState(readShipToCountry);
  const [cartItems, setCartItems] = useState(() => {
    try {
      return readCartItems();
    } catch (e) {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showAddedToCartModal, setShowAddedToCartModal] = useState(false);
  const [cartModalMode, setCartModalMode] = useState('add');
  const [fallbackImages, setFallbackImages] = useState({ screenshots: [], thumbnail: '' });
  const videoMerchBrowse = isVideoScreenshotMerch();
  const thumbnailBrowseUrl = productData?.product?.thumbnail_url || fallbackImages.thumbnail || '';
  const browseScreenshotList = (
    (Array.isArray(productData?.product?.screenshots) && productData.product.screenshots.length)
      ? productData.product.screenshots
      : (fallbackImages.screenshots || [])
  );
  const firstStillUrl = (browseScreenshotList || []).find((s) => s && s !== thumbnailBrowseUrl) || '';
  const browseSourceUrl = selectedScreenshotUrl
    || (videoMerchBrowse && firstStillUrl ? firstStillUrl : '')
    || thumbnailBrowseUrl
    || firstStillUrl
    || '';
  const browsePreviewSrc = useBrowseDisplaySrc(browseSourceUrl);
  const browseLayoutIsLandscape = browseLayoutOrientation === 'landscape';
  const featherPresetMaskStyle = useMemo(
    () => featherEdgeMaskStyle(
      BROWSE_FEATHER_EDGE,
      browseLayoutIsLandscape ? 320 : 240,
      browseLayoutIsLandscape ? 180 : 320,
      0,
    ) || undefined,
    [browseLayoutIsLandscape],
  );
  useEffect(() => {
    setSelectedEditPreset('original');
    setBwIntensity(BW_INTENSITY_DEFAULT);
    writeBrowseToolSettings(BROWSE_EDIT_ORIGINAL);
  }, [browseSourceUrl]);
  const [isCreator, setIsCreator] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [selectedScreenshotForFavorite, setSelectedScreenshotForFavorite] = useState(null);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(null);
  const [browseReload, setBrowseReload] = useState(0);
  const productCardRefs = useRef([]);
  const selectedImageRef = useRef(null);
  const [browseCropping, setBrowseCropping] = useState(false);
  const editPrefillKeyRef = useRef('');
  const lastTouchedCartIndexRef = useRef(null);
  const lastPickedProductRef = useRef(null);

  // Read from query first
  const qsCategory = searchParams.get('category');
  
  // Fallback to localStorage if query missing (mobile stale reloads)
  const category = useMemo(() => {
    const c = (qsCategory || localStorage.getItem('last_selected_category') || '').trim();
    return c || 'mens'; // final default if truly absent
  }, [qsCategory]);

  const categoryDisplayName = useMemo(
    () => SHOP_CATEGORIES.find((c) => c.category === category)?.name || 'Shop',
    [category]
  );

  useEffect(() => {
    const ori = defaultBrowseOrientation(category);
    setBrowseLayoutOrientation(ori);
    rememberArtworkOrientation(ori);
  }, [category]);

  const chooseBrowseLayout = useCallback((next) => {
    const ori = isHatsCategory(category)
      ? 'landscape'
      : (next === 'landscape' ? 'landscape' : 'portrait');
    setBrowseLayoutOrientation(ori);
    rememberArtworkOrientation(ori);
  }, [category]);
  
  const authenticated = searchParams.get('authenticated') === 'true';
  const email = searchParams.get('email') || '';
  const isShopCatalog = searchParams.get('from') === 'shop';
  const colorMockupPreview = isColorMockupPreviewEnabled();
  const isBrowseMode =
    !productId || productId === 'browse' || productId === 'undefined' || productId === 'null';
  const goToMainCategories = () => navigate(isShopCatalog ? '/shop' : '/merchandise');
  const handleChangeImage = () => {
    if (isCreatorStorefrontHostname()) {
      try {
        const slug = localStorage.getItem('sm_favorite_list_slug');
        if (slug && slug !== 'owner') {
          navigate(`/favorites/${encodeURIComponent(slug)}`);
          return;
        }
      } catch {
        /* ignore */
      }
      navigate('/favorites');
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/merchandise');
  };
  const selectScreenshot = (key, url) => {
    if (!url) return;
    setSelectedScreenshot(key);
    setSelectedScreenshotUrl(url);
    applySelectedScreenshot(url);
    const nextOri = defaultBrowseOrientation(category);
    setBrowseLayoutOrientation(nextOri);
    rememberArtworkOrientation(nextOri);
    setSelectedEditPreset('original');
    setBwIntensity(BW_INTENSITY_DEFAULT);
    writeBrowseToolSettings(BROWSE_EDIT_ORIGINAL);
    if (creatorMode) setSelectedScreenshotForFavorite(key);
  };

  const handleBrowseCrop = useCallback((croppedUrl) => {
    const next = String(croppedUrl || '').trim();
    if (!next) return;
    setSelectedScreenshotUrl(next);
    applyCroppedScreenshot(next);
    setSelectedEditPreset('original');
    setBwIntensity(BW_INTENSITY_DEFAULT);
    writeBrowseToolSettings(BROWSE_EDIT_ORIGINAL);
    setBrowseCropping(false);
  }, []);

  const applyBrowseEditPreset = (presetId, settings) => {
    setSelectedEditPreset(presetId);
    const next = settings || BROWSE_EDIT_ORIGINAL;
    if (presetId === 'bw') {
      setBwIntensity(clampBwIntensity(next.bwIntensity));
    } else {
      setBwIntensity(BW_INTENSITY_DEFAULT);
    }
    writeBrowseToolSettings(next);
  };

  const setBrowseBwIntensity = (value) => {
    const next = clampBwIntensity(value);
    setBwIntensity(next);
    writeBrowseToolSettings({
      ...(readBrowseToolSettings() || BROWSE_EDIT_ORIGINAL),
      blackAndWhite: true,
      bwIntensity: next,
    });
  };

  const mergeBrowseToolSettings = (item) => {
    const browseTools = readBrowseToolSettings();
    if (!browseTools || !item) return item;
    const tools = isCurvedBagProduct(item.name)
      ? stripCurvedBagRectEdits(browseTools)
      : browseTools;
    return {
      ...item,
      toolSettings: {
        ...(item.toolSettings || {}),
        ...tools,
      },
    };
  };
  const openCartIfSignedIn = () => {
    if (isDemoStorefront() || isShopperSignedIn()) {
      setIsCartOpen(true);
      return;
    }
    navigate('/checkout');
  };
  const openCart = searchParams.get('openCart') === 'true';
  const creatorMode = searchParams.get('creatorMode') === 'favorites';
  useEffect(() => {
    if (!creatorMode) return undefined;
    let dest = '/dashboard';
    try {
      const merch = readPendingMerchData() || {};
      if (merch.videoId) dest = `/video/0/${encodeURIComponent(merch.videoId)}`;
    } catch (_) {}
    navigate(dest, { replace: true });
    return undefined;
  }, [creatorMode, navigate]);
  const editCartParam = searchParams.get('editCart');
  const editingCartIndex = Number.parseInt(editCartParam, 10);
  const isEditingCart = Number.isInteger(editingCartIndex) && editingCartIndex >= 0 && editingCartIndex < cartItems.length;
  const editingCartItem = isEditingCart ? cartItems[editingCartIndex] : null;

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktopLayout(mq.matches);
    sync();
    if (mq.addEventListener) mq.addEventListener('change', sync);
    else mq.addListener(sync);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', sync);
      else mq.removeListener(sync);
    };
  }, []);

  useEffect(() => {
    const sync = () => setShipToCountry(readShipToCountry());
    window.addEventListener(SHIP_TO_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SHIP_TO_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    setVariantAvailability({});
  }, [shipToCountry]);

  useEffect(() => {
    if (!cartItems.length) return;
    let source = cartItems;
    if (productData?.products?.length) {
      source = cartItems.map((it) => {
        const prod = productData.products.find((p) => p.name === (it.name || it.product));
        if (!prod?.regional_base_prices) return it;
        return {
          ...it,
          regional_base_prices: prod.regional_base_prices,
          size_pricing: it.size_pricing || prod.size_pricing,
        };
      });
    }
    const next = repriceCartItems(source, shipToCountry);
    if (next.some((item, i) => item.price !== cartItems[i].price || item.regional_base_prices !== cartItems[i].regional_base_prices)) {
      setCartItems(next);
      writeCartItems(next);
    }
  }, [shipToCountry, productData]);

  useEffect(() => {
    if (window.__DEBUG__) {
      console.log('🔎 browse: qsCategory=', qsCategory, 'resolved category=', category);
      console.log('🔗 full url:', window.location.href);
    }
    // keep the last used category current
    if (category) localStorage.setItem('last_selected_category', category);
    
    // Open cart modal if openCart parameter is present
    if (openCart) {
      if (isDemoStorefront() || isShopperSignedIn()) {
        setIsCartOpen(true);
      } else {
        navigate('/checkout');
        return;
      }
      // Remove the parameter from URL to clean it up
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('openCart');
      const newUrl = `${window.location.pathname}?${newSearchParams.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [qsCategory, category, openCart, searchParams]);

  const getVisibleScreenshots = () => {
    const thumbnailUrl = productData?.product?.thumbnail_url || fallbackImages.thumbnail;
    const baseShots = (productData?.product?.screenshots && productData.product.screenshots.length > 0)
      ? productData.product.screenshots
      : fallbackImages.screenshots;
    return (baseShots || []).filter((s) => s && s !== thumbnailUrl);
  };

  const getSelectImageCount = () => {
    const thumbnailUrl = productData?.product?.thumbnail_url || fallbackImages.thumbnail;
    return (thumbnailUrl ? 1 : 0) + getVisibleScreenshots().length;
  };

  const getSelectedScreenshotUrl = () => {
    if (selectedScreenshot === 'thumbnail') {
      return productData?.product?.thumbnail_url || fallbackImages.thumbnail || '';
    }
    const shots = getVisibleScreenshots();
    if (typeof selectedScreenshot === 'number' && shots[selectedScreenshot]) {
      return shots[selectedScreenshot];
    }
    return '';
  };

  const handleToFavorite = async () => {
    if (!selectedScreenshotForFavorite) {
      alert('Please select a screenshot first.');
      return;
    }

    const screenshotUrl = getSelectedScreenshotUrl();
    if (!screenshotUrl) {
      alert('No screenshot selected.');
      return;
    }

    // Get screenshot label
    let screenshotLabel = 'Screenshot';
    if (selectedScreenshotForFavorite === 'thumbnail') {
      screenshotLabel = 'Thumbnail';
    } else if (typeof selectedScreenshotForFavorite === 'number') {
      screenshotLabel = `Screenshot ${selectedScreenshotForFavorite + 1}`;
    }

    await handleSaveToFavorites(screenshotUrl, screenshotLabel);
  };

  const handleSaveToFavorites = async (screenshotUrl, screenshotLabel) => {
    if (!isCreator) {
      alert('Only creators can save screenshots to Pages.');
      return;
    }

    try {
      setSavingFavorite(true);

      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');

      let user = null;
      let userId = null;

      if (isAuthenticated === 'true' && userData) {
        const googleUser = JSON.parse(userData);
        user = googleUser;
        userId = googleUser.id;
      } else {
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (!supabaseUser) {
          alert('Please sign in to save favorites.');
          return;
        }
        user = supabaseUser;
        userId = supabaseUser.id;
      }

      if (!userId) {
        alert('Unable to identify user. Please sign in again.');
        return;
      }

      await claimSessionTokenIfNeeded(userId);

      let channelTitle = user?.name || user?.email?.split('@')[0] || 'Unknown Creator';
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('display_name, username, channelTitle')
          .eq('id', userId)
          .single();
        channelTitle =
          profile?.channelTitle ||
          profile?.display_name ||
          profile?.username ||
          channelTitle;
      } catch (_) {
        /* profile optional — backend fills channel title if missing */
      }

      const merchData = readPendingMerchData();
      let videoTitle = screenshotLabel || 'Screenshot';
      if (merchData?.videoTitle) {
        videoTitle = `${merchData.videoTitle} - ${screenshotLabel}`;
      }

      let listId = null;
      try {
        listId = localStorage.getItem('sm_favorite_list_id') || null;
      } catch (_) {}

      const { ok, data } = await favoriteListsJson('/api/favorites/save-url', {
        method: 'POST',
        body: JSON.stringify({
          image_url: screenshotUrl,
          title: videoTitle,
          description: 'Saved screenshot from product selection',
          channel_title: channelTitle,
          ...(listId ? { list_id: listId } : {}),
        }),
      });

      if (!ok || !data?.success) {
        alert(data?.error || 'Failed to save favorite');
        return;
      }

      if (data.list_id) {
        try {
          localStorage.setItem('sm_favorite_list_id', data.list_id);
        } catch (_) {}
      }

      alert('Screenshot saved to Pages!');
    } catch (error) {
      console.error('Error saving favorite:', error);
      alert(`Failed to save favorite: ${error.message || 'Unknown error'}`);
    } finally {
      setSavingFavorite(false);
    }
  };

  // Get available sizes for a product and color based on availability data.
  // API product.options.size is the source of truth (never use stale products.js).
  const getAvailableSizes = (product, color) => (
    getAvailableSizesForCountry(product, color, shipToCountry)
  );

  // Colors available for a selected size (size_color_availability from API, filtered by ship-to).
  const getAvailableColors = (product, size) => (
    getAvailableColorsForCountry(product, size, shipToCountry)
  );

  const resolvedColorSize = (product, index) => {
    const colors = getColorsForCountry(product, shipToCountry);
    const fallbackColors = product?.options?.color || product?.options?.handle_color || [];
    let color = selectedColors[index] || colors[0] || fallbackColors[0] || 'Default';
    if (colors.length && !colors.includes(color)) {
      color = colors[0];
    }
    let size = selectedSizes[index] || '';
    const sizesForColor = getAvailableSizes(product, color);
    if (sizesForColor.length && !sizesForColor.includes(size)) {
      size = sizesForColor[0];
    } else if (!sizesForColor.length) {
      size = '';
    }
    const colorsForSize = getAvailableColors(product, size);
    return { color, size, sizesForColor, colorsForSize };
  };

  const variantSelectable = (product, index) => {
    if (catalogStockPending(product)) return false;
    if (!productShipsToCountry(product, shipToCountry)) return false;
    const { color, size, sizesForColor } = resolvedColorSize(product, index);
    if (product?.options?.size?.length && sizesForColor.length === 0) return false;
    if (comboAvailableForCountry(product, color, size, shipToCountry) === false) return false;
    return true;
  };

  const cartItemUnavailable = (item) => {
    const products = productData?.products || [];
    const prod = products.find((p) => p?.name === (item?.name || item?.product));
    if (!prod) return false;
    const color = item.color || item.variants?.color;
    const size = item.size || item.variants?.size;
    if (comboAvailableForCountry(prod, color, size, shipToCountry) === false) return true;
    if (color && size) {
      const sizes = getAvailableSizes(prod, color);
      if (sizes.length && !sizes.includes(size)) return true;
    }
    return !productShipsToCountry(prod, shipToCountry);
  };
  const cartHasUnavailableItems = (cartItems || []).some(cartItemUnavailable);

  const goToCheckout = () => {
    if (cartHasUnavailableItems) {
      alert(`One or more cart items are out of stock for shipping to ${shipToCountryName(shipToCountry)}. Choose a different size or color.`);
      return;
    }
    if (lastTouchedCartIndexRef.current != null) {
      setToolsFocusCartIndex(lastTouchedCartIndexRef.current);
      setToolsPreviewNewest(false);
    }
    navigate('/checkout');
  };

  // Calculate price based on selected size
  const calculatePrice = (product, productIndex) => {
    const { size } = resolvedColorSize(product, productIndex);
    return unitPriceForCountry(product, size, shipToCountry);
  };

  const persistCart = (items) => {
    setCartItems(items);
    writeCartItems(items);
    if (!items.length) {
      setSelectedScreenshot(null);
      setSelectedScreenshotUrl(null);
    }
  };

  const rememberPickedProduct = (product, index) => {
    if (!product) return;
    lastPickedProductRef.current = { product, index };
    rememberToolsProductName(product?.name);
  };

  const clearVariantAvailability = (index) => {
    setVariantAvailability((prev) => {
      if (!prev[index]) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const previewProductColor = (index, color, product) => {
    if (!color) return;
    setPreviewColors((prev) => (
      prev[index] === color ? prev : { ...prev, [index]: color }
    ));
    const url = getPrintfulColorMockupUrl(product, color);
    if (url) preloadImageUrls([url]);
  };

  const clearPreviewColor = (index) => {
    setPreviewColors((prev) => {
      if (!(index in prev)) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const applyProductColor = (product, index, newColor) => {
    if (!product || !newColor) return;
    rememberPickedProduct(product, index);
    clearVariantAvailability(index);
    setSelectedColors((prev) => ({ ...prev, [index]: newColor }));
    clearPreviewColor(index);
    const availableSizes = getAvailableSizes(product, newColor);
    setSelectedSizes((prev) => {
      const currentSize = prev[index] || product.options?.size?.[0];
      if (availableSizes.length > 0 && !availableSizes.includes(currentSize)) {
        return { ...prev, [index]: availableSizes[0] };
      }
      return prev;
    });
  };

  const cartLineMatchesPick = (item, product, color, size) => {
    if (!item || !product) return false;
    if (String(item.name || '') !== String(product.name || '')) return false;
    return String(item.color || '') === String(color || '') && String(item.size || '') === String(size || '');
  };

  const screenshotForNewCartItem = () => {
    const pending = readPendingMerchData() || {};
    if (pending.source === 'image') {
      const original = pending.selected_screenshot || pending.edited_screenshot;
      if (original) return original;
    }
    const fromPicker = selectedScreenshotUrl || getSelectedScreenshotUrl();
    if (fromPicker) return fromPicker;
    if (editingCartItem?.selected_screenshot || editingCartItem?.screenshot) {
      return editingCartItem.selected_screenshot || editingCartItem.screenshot;
    }
    if (pending.selected_screenshot || pending.edited_screenshot) {
      return pending.selected_screenshot || pending.edited_screenshot;
    }
    const cartNow = Array.isArray(cartItems) && cartItems.length ? cartItems : readCartItems();
    for (let i = (cartNow || []).length - 1; i >= 0; i--) {
      const shot = cartNow[i]?.screenshot || cartNow[i]?.selected_screenshot;
      if (shot) return shot;
    }
    return '';
  };

  const handleAddToCart = async (product, index, options = {}) => {
    const showModal = options.showModal !== false;
    if (catalogStockPending(product)) return null;
    const { color: chosenColor, size: chosenSize } = resolvedColorSize(product, index);
    if (!variantSelectable(product, index)) {
      const oos = comboAvailableForCountry(product, chosenColor, chosenSize, shipToCountry) === false
        || (product?.options?.size?.length && resolvedColorSize(product, index).sizesForColor.length === 0);
      setVariantAvailability((prev) => ({
        ...prev,
        [index]: {
          checking: false,
          available: false,
          message: oos
            ? `${chosenColor} / ${chosenSize} is out of stock for shipping to ${shipToCountryName(shipToCountry)}.`
            : `This item is not available to ship to ${shipToCountryName(shipToCountry)}.`,
        },
      }));
      return null;
    }
    const listedCombo = comboAvailableForCountry(product, chosenColor, chosenSize, shipToCountry);
    if (listedCombo === false) {
      setVariantAvailability((prev) => ({
        ...prev,
        [index]: {
          checking: false,
          available: false,
          message: `${chosenColor} / ${chosenSize} is out of stock for shipping to ${shipToCountryName(shipToCountry)}.`,
        },
      }));
      return null;
    }
    if (addingLockRef.current.has(index)) return null;
    addingLockRef.current.add(index);
    setAddingProductIndex(index);
    try {
    if (isShopCatalog) {
      saveShopAddIntent({
        category,
        productName: product?.name || '',
        color: chosenColor,
        size: chosenSize,
      });
      navigate('/favorites?from=shop');
      window.scrollTo(0, 0);
      return null;
    }
    rememberPickedProduct(product, index);
    const printful_variant_id = resolvePrintfulVariantId(product, chosenColor, chosenSize);
    try {
      const res = await fetch(apiJoin('/api/check-variant-availability'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: product?.name || '',
          color: chosenColor,
          size: chosenSize,
          variant_id: printful_variant_id,
          country_code: shipToCountry,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (!data?.success || data?.available !== true) {
          setVariantAvailability((prev) => ({
            ...prev,
            [index]: {
              checking: false,
              available: false,
              message: data?.error || `${chosenColor} / ${chosenSize} is out of stock for shipping to ${shipToCountryName(shipToCountry)}.`,
            },
          }));
          return null;
        }
      } else if (listedCombo !== true) {
        setVariantAvailability((prev) => ({
          ...prev,
          [index]: {
            checking: false,
            available: false,
            message: `${chosenColor} / ${chosenSize} could not be confirmed in stock for ${shipToCountryName(shipToCountry)}. Choose a different size or color.`,
          },
        }));
        return null;
      }
    } catch (e) {
      if (listedCombo !== true) {
        setVariantAvailability((prev) => ({
          ...prev,
          [index]: {
            checking: false,
            available: false,
            message: `${chosenColor} / ${chosenSize} could not be confirmed in stock. Choose a different size or color.`,
          },
        }));
        return null;
      }
    }
    setVariantAvailability((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    // Use the URL stored when user clicked a screenshot so we send the exact image they selected (not thumbnail by mistake)
    const screenshotUrl = screenshotForNewCartItem();

    // Get video metadata from merch session (including screenshot_timestamp for email/order)
    let videoMetadata = {};
    const pendingOrientation = isHatsCategory(category)
      ? 'landscape'
      : (browseLayoutOrientation === 'landscape' ? 'landscape' : 'portrait');
    try {
      const merchData = readPendingMerchData();
      if (merchData && typeof merchData === 'object') {
        videoMetadata = {
          video_url: merchData.videoUrl,
          video_title: merchData.videoTitle,
          creator_name: merchData.creatorName,
          thumbnail: merchData.thumbnail,
          screenshot_timestamp: merchData.screenshot_timestamp
        };
      }
    } catch (e) {
      console.warn('Could not load video metadata from merch session:', e);
    }
    const filledVideoMetadata = Object.fromEntries(
      Object.entries(videoMetadata).filter(([, value]) => value != null && value !== '')
    );

    const item = {
      ...(isEditingCart && editingCartItem ? editingCartItem : {}),
      name: product?.name || 'Product',
      price: calculatePrice(product, index),
      image: getProductImageUrl(product, true),
      color: chosenColor,
      size: chosenSize,
      screenshot: screenshotUrl || editingCartItem?.screenshot,
      selected_screenshot: screenshotUrl || editingCartItem?.selected_screenshot,
      displayScreenshot: (
        (readPendingMerchData() || {}).display_screenshot
        || editingCartItem?.displayScreenshot
        || artworkDisplayUrl(screenshotUrl)
        || ''
      ),
      qty: isEditingCart && editingCartItem?.qty ? editingCartItem.qty : 1,
      category: category || '',
      printful_catalog_product_id: product?.printful_catalog_product_id ?? null,
      printful_variant_id: printful_variant_id != null ? printful_variant_id : undefined,
      regional_base_prices: product?.regional_base_prices || undefined,
      size_pricing: product?.size_pricing || undefined,
      // Include video metadata in cart item (screenshot_timestamp for email/Print Quality)
      ...filledVideoMetadata
    };
    if (pendingOrientation) {
      item.imageOrientation = pendingOrientation;
      item.image_orientation = pendingOrientation;
      item.toolSettings = {
        ...(item.toolSettings || {}),
        imageOrientation: pendingOrientation
      };
    }
    rememberArtworkOrientation(pendingOrientation);
    Object.assign(item, mergeBrowseToolSettings(item));
    if (pendingOrientation) {
      item.imageOrientation = pendingOrientation;
      item.image_orientation = pendingOrientation;
      item.toolSettings = {
        ...(item.toolSettings || {}),
        imageOrientation: pendingOrientation,
      };
    }
    const bakedItem = await applyBrowsePresetToCartItem(item, item.toolSettings);
    Object.assign(item, bakedItem);
    if (!item.favorite_list_id) {
      try {
        const flid = localStorage.getItem('sm_favorite_list_id');
        if (flid && flid.trim()) item.favorite_list_id = flid.trim();
      } catch (_) { /* ignore */ }
    }
    const next = [...(readCartItems() || cartItems || [])];
    if (isEditingCart) {
      next[editingCartIndex] = item;
    } else {
      next.push(item);
    }
    persistCart(next);
    const focusIndex = isEditingCart ? editingCartIndex : next.length - 1;
    lastTouchedCartIndexRef.current = focusIndex;
    setToolsFocusCartIndex(focusIndex);
    if (isEditingCart) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('editCart');
      setSearchParams(nextParams, { replace: true });
      setHighlightedProductIndex(null);
    }
    console.log(isEditingCart ? '✅ Cart item updated' : '✅ Item added to cart, showing modal...');
    if (showModal) {
      setCartModalMode(isEditingCart ? 'update' : 'add');
      setShowAddedToCartModal(true);
    }
    return focusIndex;
    } finally {
      addingLockRef.current.delete(index);
      setAddingProductIndex((current) => (current === index ? null : current));
    }
  };

  const goToToolsPage = async () => {
    // Prefer the item being edited or last picked, then the most recently added cart item.
    try {
      let items = readCartItems();
      const picked = lastPickedProductRef.current;
      const pickedColor = picked
        ? (selectedColors[picked.index] || picked.product?.options?.color?.[0] || 'Default')
        : '';
      const pickedSize = picked
        ? (selectedSizes[picked.index] || picked.product?.options?.size?.[0] || 'One Size')
        : '';

      if (isEditingCart) {
        setToolsFocusCartIndex(editingCartIndex);
        setToolsPreviewNewest(false);
      } else {
        let focusIndex = Array.isArray(items) && items.length ? items.length - 1 : -1;
        let openedNewSelection = Boolean(peekToolsPreviewNewest());
        const lastTouched = lastTouchedCartIndexRef.current;
        const justAdded = (
          lastTouched != null
          && Array.isArray(items)
          && lastTouched === items.length - 1
          && picked?.product
          && cartLineMatchesPick(items[lastTouched], picked.product, pickedColor, pickedSize)
        );

        if (justAdded) {
          focusIndex = lastTouched;
          openedNewSelection = true;
        } else if (picked?.product && !isShopCatalog) {
          let matchIdx = -1;
          for (let i = (items || []).length - 1; i >= 0; i--) {
            if (cartLineMatchesPick(items[i], picked.product, pickedColor, pickedSize)) {
              matchIdx = i;
              break;
            }
          }
          if (matchIdx >= 0) {
            focusIndex = matchIdx;
            openedNewSelection = lastTouchedCartIndexRef.current === matchIdx;
          } else {
            const added = await handleAddToCart(picked.product, picked.index, { showModal: false });
            items = readCartItems();
            if (Number.isInteger(added) && added >= 0) {
              focusIndex = added;
              openedNewSelection = true;
            } else if (Array.isArray(items) && items.length) {
              focusIndex = items.length - 1;
            }
          }
        } else if (lastTouched != null) {
          focusIndex = lastTouched;
          openedNewSelection = true;
        }

        if (!Array.isArray(items) || items.length === 0 || focusIndex < 0) {
          setIsCartOpen(true);
          return;
        }

        setToolsFocusCartIndex(focusIndex);
        setToolsPreviewNewest(openedNewSelection);
        writeCartItems(readCartItems(), { immediate: true });
        items = readCartItems();

        let urlToSave = selectedScreenshotUrl || getSelectedScreenshotUrl();
        if (!urlToSave) {
          const merch = readPendingMerchData() || {};
          const productShots = productData?.product?.screenshots;
          urlToSave =
            merch.selected_screenshot ||
            merch.edited_screenshot ||
            merch.thumbnail ||
            (Array.isArray(merch.screenshots) && merch.screenshots[0]) ||
            productData?.product?.thumbnail_url ||
            fallbackImages.thumbnail ||
            (Array.isArray(productShots) && productShots[0]) ||
            (Array.isArray(fallbackImages.screenshots) && fallbackImages.screenshots[0]) ||
            '';
        }
        const focused = items[focusIndex];
        const currentShot = focused?.screenshot || focused?.selected_screenshot || '';
        if (focused) {
          const withShot = (urlToSave && !currentShot)
            ? { ...focused, screenshot: urlToSave, selected_screenshot: urlToSave }
            : focused;
          const withPreset = mergeBrowseToolSettings(withShot);
          const baked = await applyBrowsePresetToCartItem(withPreset, withPreset.toolSettings);
          if (baked !== focused) {
            persistCart(items.map((item, i) => (i === focusIndex ? baked : item)));
            if (openedNewSelection) setToolsPreviewNewest(true);
          }
        }
      }
    } catch (e) {
      console.warn('Could not prepare tools focus:', e);
      const cartNow = readCartItems();
      if (!Array.isArray(cartNow) || cartNow.length === 0) {
        setIsCartOpen(true);
        return;
      }
    }
    navigate('/tools');
  };

  // Check if user is a creator
  useEffect(() => {
    const checkCreatorStatus = async () => {
      if (isDemoStorefront()) {
        setIsCreator(false);
        return;
      }
      const creatorStatus = await UserService.isCreator();
      setIsCreator(creatorStatus);
      
      // If in creator mode, set initial selected screenshot
      if (creatorMode && creatorStatus) {
        // Set thumbnail as default selection (URL will be set when fallbackImages load)
        setSelectedScreenshot('thumbnail');
        setSelectedScreenshotForFavorite('thumbnail');
      }
    };
    checkCreatorStatus();
  }, [creatorMode]);

  // Load fallback screenshots/thumbnail from merch session in case backend data is empty
  useEffect(() => {
    if (isShopCatalog) {
      setFallbackImages({ screenshots: [], thumbnail: '' });
      setSelectedScreenshot(null);
      setSelectedScreenshotUrl(null);
      return;
    }
    try {
      const d = readPendingMerchData();
      if (d && (d.screenshots?.length || d.thumbnail || d.selected_screenshot || d.edited_screenshot)) {
        const display = d.display_screenshot
          || d.thumbnail
          || artworkDisplayUrl(d.selected_screenshot || d.edited_screenshot || '')
          || '';
        const shots = Array.isArray(d?.screenshots) && d.screenshots.length
          ? d.screenshots.slice(0, 6).map((s) => artworkDisplayUrl(s) || s)
          : (display ? [display] : []);
        setFallbackImages({
          screenshots: shots,
          thumbnail: display || shots[0] || ''
        });
        
        // In creator mode, if we have video data, set up productData structure
        if (creatorMode && d?.thumbnail) {
          setSelectedScreenshotUrl((prev) => prev ?? d.thumbnail);
          // Create a minimal productData structure for screenshot selection
          setProductData({
            success: true,
            product: {
              thumbnail_url: d.thumbnail,
              screenshots: Array.isArray(d.screenshots) ? d.screenshots : []
            },
            products: [],
            category: category
          });
        }
      }
    } catch (e) {
      console.warn('Invalid pending_merch_data, ignoring');
    }
  }, [productId, creatorMode, category, isShopCatalog]);

  // Keep the picker highlight in sync with the chosen image. A cart that already
  // has artwork must not block the highlight — only skip overwriting that art.
  useEffect(() => {
    if (isShopCatalog || selectedScreenshot != null) return;
    const thumbnailUrl = productData?.product?.thumbnail_url || fallbackImages.thumbnail;
    const shots = getVisibleScreenshots();
    const options = [];
    if (thumbnailUrl) options.push({ key: 'thumbnail', url: thumbnailUrl });
    (shots || []).forEach((s, i) => {
      options.push({ key: i, url: s });
    });
    if (options.length === 0) return;

    const strip = (u) => String(u || '').split('?')[0];
    const matchUrl = (url) => {
      if (!url) return null;
      const target = strip(url);
      return options.find((opt) => opt.url === url || strip(opt.url) === target) || null;
    };

    let match = options.length === 1 ? options[0] : null;
    if (!match) {
      try {
        const merch = readPendingMerchData() || {};
        const cartNow = readCartItems({ ignoreMemory: true }) || [];
        const focused = isEditingCart ? editingCartItem : null;
        const lastCart = Array.isArray(cartNow) && cartNow.length ? cartNow[cartNow.length - 1] : null;
        const candidates = [
          selectedScreenshotUrl,
          focused?.selected_screenshot,
          focused?.screenshot,
          merch.selected_screenshot,
          merch.edited_screenshot,
          lastCart?.selected_screenshot,
          lastCart?.screenshot,
        ];
        for (const candidate of candidates) {
          match = matchUrl(candidate);
          if (match) break;
        }
      } catch (_) {}
    }
    if (!match) return;

    setSelectedScreenshot(match.key);
    setSelectedScreenshotUrl(match.url);
    const nextOri = defaultBrowseOrientation(category);
    setBrowseLayoutOrientation(nextOri);
    rememberArtworkOrientation(nextOri);
    if (creatorMode) setSelectedScreenshotForFavorite(match.key);

    try {
      const cartNow = readCartItems({ ignoreMemory: true });
      const cartHasArt = Array.isArray(cartNow) && cartNow.some(
        (it) => it && String(it.screenshot || it.selected_screenshot || '').trim()
      );
      if (!cartHasArt) {
        const merch = readPendingMerchData() || {};
        const original = merch.selected_screenshot;
        const display = merch.display_screenshot;
        if (!(original && display && match.url === display)) {
          applySelectedScreenshot(match.url);
        }
      }
    } catch (_) {
      applySelectedScreenshot(match.url);
    }
  }, [isShopCatalog, selectedScreenshot, productData, fallbackImages, creatorMode, isEditingCart, editingCartIndex]);

  useEffect(() => {
    const wantedCategory = category;
    const controller = new AbortController();
    let cancelled = false;

    if (window.__DEBUG__) {
    console.log('🔄 useEffect triggered with:', { productId, category, authenticated, email });
    }

    const paintProducts = (data) => {
      const next = decorateBrowseData(data, isShopCatalog);
      setProductData(next);
      preloadImageUrls((next.products || []).map((p) => p._displayImageUrl));
    };

    const paintFallbackCatalog = () => {
      const cachedFallback = readBrowseCache(wantedCategory);
      if (cachedFallback?.products?.length) {
        paintProducts(cachedFallback);
        return true;
      }
      const staticProducts = getStaticProductsForCategory(wantedCategory);
      if (!staticProducts.length) return false;
      paintProducts({
        success: true,
        products: staticProducts,
        category: wantedCategory,
        product: isShopCatalog ? { thumbnail_url: '', screenshots: [] } : (productData?.product || { thumbnail_url: '', screenshots: [] }),
      });
      return true;
    };

    const cached = readBrowseCache(wantedCategory);
    const cachedStockReady = cached && !browseNeedsLiveStock(cached);
    if (cached) {
      paintProducts(cached);
      setLoading(false);
      setError(null);
    } else if (paintFallbackCatalog()) {
      setLoading(false);
      setError(null);
    } else if (!productData) {
      setLoading(true);
    }

    const fetchProductData = async () => {
      setError(null);

      const actualProductId = productId || 'browse';
      const isBrowseMode = !productId || productId === 'browse' || productId === 'dynamic';
      const apiBase = getBackendUrl().replace(/\/$/, '');
      const url = isBrowseMode
        ? `${apiBase}/api/product/browse?category=${encodeURIComponent(category)}&authenticated=${authenticated}&email=${encodeURIComponent(email || '')}`
        : `${apiBase}/api/product/${actualProductId}?category=${encodeURIComponent(category)}&authenticated=${authenticated}&email=${encodeURIComponent(email || '')}`;

      const retryDelaysMs = cachedStockReady ? [0] : [0, 800, 1500, 2500, 4000, 6000, 8000];
      let lastError = null;
      let paintedLiveCatalog = false;

      for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
        if (cancelled || controller.signal.aborted) return;
        if (retryDelaysMs[attempt]) {
          await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
          if (cancelled || controller.signal.aborted) return;
        }

        const attemptController = new AbortController();
        const abortAttempt = () => attemptController.abort();
        controller.signal.addEventListener('abort', abortAttempt);
        const timeoutId = window.setTimeout(abortAttempt, 25000);
        try {
          const stockUrl = attempt > 0 ? `${url}&stockRetry=${attempt}` : url;
          const response = await fetch(stockUrl, {
            method: 'GET',
            cache: attempt > 0 ? 'no-store' : 'default',
            signal: attemptController.signal,
          });
          if (response.status === 502 || response.status === 503 || response.status === 504) {
            lastError = new Error(`Failed to fetch product data: ${response.status}`);
            continue;
          }
          if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 429) {
              throw new Error('Too many requests. Please wait a moment and try again.');
            }
            throw new Error(`Failed to fetch product data: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          if (data.category && data.category !== wantedCategory) return;
          if (browseNeedsLiveStock(data)) {
            if (!cachedStockReady) paintProducts(data);
            paintedLiveCatalog = true;
            lastError = new Error('catalog stock still warming');
            continue;
          }
          paintProducts(data);
          paintedLiveCatalog = true;
          try {
            localStorage.setItem('cached_products', JSON.stringify(data.products));
          } catch {
            /* ignore */
          }
          writeBrowseCache(wantedCategory, data);
          return;
        } catch (err) {
          if (cancelled || controller.signal.aborted) return;
          if (err?.name === 'AbortError') {
            lastError = err;
            continue;
          }
          lastError = err;
          if (String(err?.message || '').includes('429')) break;
        } finally {
          window.clearTimeout(timeoutId);
          controller.signal.removeEventListener('abort', abortAttempt);
        }
      }

      if (cancelled || controller.signal.aborted) return;
      if (paintedLiveCatalog) return;
      if (paintFallbackCatalog()) return;
      setError(lastError?.message || 'Failed to load products. Please try again.');
    };

    fetchProductData().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [productId, category, authenticated, email, isShopCatalog, browseReload]);

  // Validate and reset sizes when products or colors change
  useEffect(() => {
    if (!productData?.products || productData.products.length === 0) return;
    
    setSelectedSizes(prevSizes => {
      const newSelectedSizes = { ...prevSizes };
      let hasChanges = false;
      
      productData.products.forEach((product, index) => {
        if (!product || !product.options) return;
        
        // Bags "All Over Print Tote Pocket" has handle_color but no color
        const selectedColor = selectedColors[index] || product.options?.color?.[0] || product.options?.handle_color?.[0];
        if (!selectedColor && (!product.options?.size?.length)) return;
        
        const availableSizes = getAvailableSizes(product, selectedColor);
        if (availableSizes.length === 0) {
          if (prevSizes[index]) {
            delete newSelectedSizes[index];
            hasChanges = true;
          }
          return;
        }
        
        const currentSize = prevSizes[index];
        
        // If no size is selected yet, or current size is not available, set to first available
        if (!currentSize || !availableSizes.includes(currentSize)) {
          newSelectedSizes[index] = availableSizes[0];
          hasChanges = true;
        }
      });
      
      return hasChanges ? newSelectedSizes : prevSizes;
    });
  }, [productData, selectedColors, shipToCountry]);

  useEffect(() => {
    if (!productData?.products || productData.products.length === 0) return;
    setSelectedColors((prevColors) => {
      const nextColors = { ...prevColors };
      let hasChanges = false;
      productData.products.forEach((product, index) => {
        if (!product?.options?.color?.length) return;
        const availableColors = getColorsForCountry(product, shipToCountry);
        if (availableColors.length === 0) return;
        const currentColor = prevColors[index] || product.options.color[0];
        if (!currentColor || !availableColors.includes(currentColor)) {
          nextColors[index] = availableColors[0];
          hasChanges = true;
        }
      });
      return hasChanges ? nextColors : prevColors;
    });
  }, [productData, selectedSizes, shipToCountry]);

  useEffect(() => {
    if (!colorMockupPreview || !productData?.products?.length) return;
    const urls = [];
    productData.products.forEach((product) => {
      const colors = getColorsForCountry(product, shipToCountry);
      (colors.length ? colors : pendingSwatchColors(product)).forEach((color) => {
        const url = getPrintfulColorMockupUrl(product, color);
        if (url) urls.push(url);
      });
    });
    preloadImageUrls(urls);
  }, [colorMockupPreview, productData, shipToCountry]);

  useEffect(() => {
    if (!isEditingCart || !editingCartItem) return;
    const shot = editingCartItem.selected_screenshot || editingCartItem.screenshot;
    if (shot) setSelectedScreenshotUrl(shot);
  }, [isEditingCart, editingCartIndex]);

  useEffect(() => {
    if (!isEditingCart || !editingCartItem) {
      setHighlightedProductIndex(null);
      return;
    }
    const products = productData?.products;
    if (!Array.isArray(products) || products.length === 0) return;

    const key = `${category}:${editingCartIndex}:${editingCartItem.name || ''}:${editingCartItem.size || ''}:${editingCartItem.color || ''}`;
    if (editPrefillKeyRef.current === key) return;

    let matchIndex = -1;
    const catalogId = editingCartItem.printful_catalog_product_id;
    if (catalogId != null && catalogId !== '') {
      matchIndex = products.findIndex((p) => p && p.printful_catalog_product_id === catalogId);
    }
    if (matchIndex < 0) {
      const name = (editingCartItem.name || editingCartItem.product || '').trim().toLowerCase();
      if (name) {
        matchIndex = products.findIndex((p) => (p?.name || '').trim().toLowerCase() === name);
      }
    }
    if (matchIndex < 0) {
      setHighlightedProductIndex(null);
      return;
    }

    editPrefillKeyRef.current = key;
    setHighlightedProductIndex(matchIndex);
    if (editingCartItem.color) {
      setSelectedColors((prev) => ({ ...prev, [matchIndex]: editingCartItem.color }));
    }
    if (editingCartItem.size) {
      setSelectedSizes((prev) => ({ ...prev, [matchIndex]: editingCartItem.size }));
    }
    const frame = window.requestAnimationFrame(() => {
      productCardRefs.current[matchIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isEditingCart, editingCartIndex, editingCartItem, productData, category]);

  // Only show full-screen loading on initial load (no productData yet). When switching category, keep showing current products so images persist.
  if (loading && !productData) {
    return (
      <div className={`container product-page ${sidebar ? "" : " large-container"}`}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p>Loading product...</p>
        </div>
      </div>
    );
  }

  if (error && !(productData?.products?.length)) {
    return (
      <div className={`container product-page ${sidebar ? "" : " large-container"}`}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Could not load products</h2>
          <p>Please try again.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setError(null);
              setLoading(true);
              setBrowseReload((n) => n + 1);
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!productData) {
    // Debug why productData is falsy
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (window.__DEBUG__ || isMobile) {
      console.log('❌ ProductData is falsy:', productData);
      console.log('❌ Loading state:', loading);
      console.log('❌ Error state:', error);
    }
    
    return (
      <div className={`container product-page ${sidebar ? "" : " large-container"}`}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Product Not Found</h2>
          <p>The requested product could not be found.</p>
          <p>Debug: productData = {JSON.stringify(productData)}</p>
        </div>
      </div>
    );
  }

  // Show ToolsPage when category is thumbnails
  if (category === 'thumbnails') {
    const shotKey = cartItems
      .map((c) => `${c.name}:${String(c.screenshot || '').length}:${String(c.image || '').slice(-24)}`)
      .join('|');
    return <ToolsPage key={`thumb-tools-${shotKey}`} />;
  }

  if (creatorMode) {
    return null;
  }

  const showVideoThumbLabel = isVideoScreenshotMerch();
  const showAutoEditPresets = !creatorMode && !isShopCatalog && !showVideoThumbLabel && getSelectImageCount() <= 1 && Boolean(browsePreviewSrc || browseSourceUrl);
  const showDesktopEditPresets = showAutoEditPresets && isDesktopLayout;
  const presetImageSrc = browsePreviewSrc || browseSourceUrl;

  return (
    <div className={`container product-page${isShopCatalog ? ' product-page--shop-catalog' : ''}${!creatorMode && !isShopCatalog ? ' product-page--choose' : ''}${sidebar ? '' : ' large-container'}${category ? ` product-page--${String(category).trim().toLowerCase()}` : ''}`}>
      {/* User Flow Section - Step 3 Only - Hide for All Products; storefronts hide via CSS */}
      {(() => {
        const categoryNormalized = (category || '').trim().toLowerCase();
        return !isShopCatalog && categoryNormalized !== 'all' && categoryNormalized !== 'all-products';
      })() && (
        <div
          className="user-flow-section"
          style={
            creatorSettings?.primary_color && creatorSettings?.secondary_color
              ? { background: `linear-gradient(135deg, ${creatorSettings.primary_color} 0%, ${creatorSettings.secondary_color} 100%)` }
              : undefined
          }
        >
          <div className="flow-steps">
            <div className="flow-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Make Merchandise</h3>
                <p>Create custom products with your selection</p>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* All Products - Informational Layout - MUST BE FIRST */}
      {(() => {
        const categoryNormalized = (category || '').trim().toLowerCase();
        const isAllProducts = categoryNormalized === 'all' || categoryNormalized === 'all-products';
        const hasProducts = productData?.products && productData.products.length > 0;
        
        // Only log for debugging when debug mode is enabled
        if (window.__DEBUG__) {
          console.log('🔍 All Products Check:', { 
            category, 
            isAllProducts, 
            hasProducts, 
            productCount: productData?.products?.length,
            productDataExists: !!productData
          });
        }
        
        if (isAllProducts && hasProducts) {
          if (window.__DEBUG__) {
            console.log('✅ Showing All Products informational layout');
          }
          return true;
        } else {
          // Only log when debug mode is enabled - this is normal behavior, not an error
          if (window.__DEBUG__) {
            console.log('ℹ️ Not showing All Products layout (normal for specific categories):', { 
              reason: !isAllProducts ? 'viewing specific category' : 'no products' 
            });
          }
          return false;
        }
      })() && (
        <div className="all-products-info-container">
          <div className="shop-catalog-toolbar">
            <button
              type="button"
              className="shop-catalog-back-btn"
              onClick={goToMainCategories}
              aria-label="Back to categories"
            >
              <ChevronLeft />
            </button>
            <div className="shop-catalog-toolbar-text">
              <h1 className="product-information-title">Product Information</h1>
            </div>
          </div>
          {(() => {
            if (window.__DEBUG__) {
              console.log('✅ Rendering All Products informational layout');
            }
            // Group products by category
            const categoryGroups = {
              'womens': [],
              'mens': [],
              'kids': [],
              'mugs': [],
              'hats': [],
              'bags': [],
              'pets': [],
              'misc': []
            };

            // Map product names to categories
            const productCategoryMap = {
              'womens': ["Women's Shirt", "Heavyweight T-Shirt", "Women's Ribbed Neck", "Micro-Rib Tank Top", "Racerback Tank", "Women's Crop Top", "Pullover Hoodie", "Cropped Hoodie"],
              'mens': ["T-Shirt", "Men's Long Sleeve Shirt", "Mens Fitted T-Shirt", "Men's Tank Top", "Oversized T-Shirt", "Men's Fitted Long Sleeve", "Hoodie", "Champion Hoodie"],
              'kids': ["Youth Heavy Blend Hoodie", "Kids Shirt", "Kids Long Sleeve", "Toddler Jersey T-Shirt", "Kids Sweatshirt", "Baby Staple Tee", "Baby Jersey T-Shirt", "Baby Body Suit"],
              'mugs': ["White Glossy Mug", "Travel Mug", "Enamel Mug", "Colored Mug"],
              'hats': ["Distressed Dad Hat", "Closed Back Cap", "Five Panel Trucker Hat", "Five Panel Baseball Cap"],
              'bags': ["Laptop Sleeve", "All-Over Print Drawstring", "All Over Print Tote Pocket", "All-Over Print Utility Bag"],
              'pets': ["Pet Bowl All-Over Print", "Pet Bandana Collar"],
              'misc': ["Hardcover Bound Notebook", "Apron", "Jigsaw Puzzle with Tin", "Greeting Card"]
            };

            // Group products
            productData.products.forEach(product => {
              for (const [cat, products] of Object.entries(productCategoryMap)) {
                if (products.includes(product.name)) {
                  categoryGroups[cat].push(product);
                  break;
                }
              }
            });

            const categoryTitles = {
              'womens': "Women's",
              'mens': "Men's",
              'kids': "Kids",
              'mugs': "Mugs",
              'hats': "Hats",
              'bags': "Bags",
              'pets': "Pets",
              'misc': "Accessories"
            };

            return ['womens', 'mens', 'kids', 'mugs', 'hats', 'bags', 'pets', 'misc'].map(cat => {
              if (categoryGroups[cat].length === 0) return null;
              return (
                <div key={cat} className="category-section">
                  <h2 className="category-section-title">{categoryTitles[cat]}</h2>
                  <div className="products-info-table">
                    <div className="info-table-header">
                      <div className="info-col-name">Name</div>
                      <div className="info-col-image">Image</div>
                      <div className="info-col-description">Description</div>
                    </div>
                    {categoryGroups[cat].map((product, index) => (
                      <div key={index} className="info-table-row">
                        <div className="info-col-name">
                          {product.name}
                          {product.name && product.name.includes('Jigsaw Puzzle with Tin') && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#666', display: 'block', marginTop: '4px' }}>
                              (Ages 4+ only)
                            </span>
                          )}
                        </div>
                        <div className="info-col-image">
                          <img 
                            src={getProductImageUrl(product, true)}
                            alt={product.name}
                            className="info-product-image"
                            onError={(e) => handleProductImageError(e, product)}
                          />
                        </div>
                        <div className="info-col-description">
                          {product.description || "No description available."}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Products Section - Only show when specific category is selected (not "all") and has products */}
      {(() => {
        const categoryNormalized = (category || '').trim().toLowerCase();
        return categoryNormalized !== 'all' && categoryNormalized !== 'all-products';
      })() && productData.products && productData.products.length > 0 && (
        <>
          {/* Screenshot Selection Section — hidden in My Shop catalog (blank products only) */}
          {!isShopCatalog && (
          <div
            className={`screenshots-section${getSelectImageCount() <= 1 ? ' screenshots-section--single' : ''}${showDesktopEditPresets ? ' screenshots-section--with-edits' : ''}${browseLayoutIsLandscape ? ' screenshots-section--layout-landscape' : ''}`}
            style={{
              '--screenshot-frame-aspect': browseLayoutIsLandscape ? '4 / 3' : '3 / 4',
              '--screenshot-aspect-number': String(browseLayoutIsLandscape ? 4 / 3 : 3 / 4),
            }}
          >
            {!creatorMode && (
              <div className="product-choose-header">
                <h1 className="product-choose-title">
                  {showVideoThumbLabel ? 'Choose a Screenshot' : 'Selected Image'}
                </h1>
                {showVideoThumbLabel ? (
                  <p className="product-choose-subtitle">
                    Choose a frame for your custom merchandise.
                  </p>
                ) : null}
              </div>
            )}
            <h2 className="screenshots-title">
              {creatorMode
                ? 'Select Screenshot to Add to Pages'
                : showVideoThumbLabel
                  ? 'Choose a Screenshot'
                  : 'Selected Image'}
            </h2>
            <div className={`selected-image-row${showDesktopEditPresets ? ' selected-image-row--presets' : ''}`}>
            <div className="screenshots-preview">
              <div className="screenshot-grid">
                {/* Thumbnail (video capture only) */}
                {(() => {
                  const thumbnailUrl = productData?.product?.thumbnail_url || fallbackImages.thumbnail;
                  return thumbnailUrl ? (
                  <div
                    className={`screenshot-item${showDesktopEditPresets ? ' screenshot-item--original' : ''}${showVideoThumbLabel ? ' screenshot-item--thumbnail' : ''}${browseLayoutIsLandscape ? ' screenshot-item--landscape' : ''}${selectedScreenshot === 'thumbnail' && selectedEditPreset === 'original' ? ' selected' : ''}${browseCropping ? ' screenshot-item--cropping' : ''}`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={showVideoThumbLabel ? 'Thumbnail' : 'Selected image'}
                      aria-current={selectedScreenshot === 'thumbnail' && selectedEditPreset === 'original' ? 'true' : undefined}
                      onClick={() => {
                        if (browseCropping) return;
                        selectScreenshot('thumbnail', thumbnailUrl);
                        applyBrowseEditPreset('original', BROWSE_EDIT_ORIGINAL);
                      }}
                      onKeyDown={(e) => {
                        if (browseCropping) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectScreenshot('thumbnail', thumbnailUrl);
                          applyBrowseEditPreset('original', BROWSE_EDIT_ORIGINAL);
                        }
                      }}
                    >
                      <img 
                        ref={selectedImageRef}
                        src={showVideoThumbLabel ? thumbnailUrl : (presetImageSrc || thumbnailUrl)} 
                        alt={showVideoThumbLabel ? 'Thumbnail' : 'Selected image'} 
                        className="screenshot-image"
                        fetchPriority="high"
                        decoding="async"
                      />
                      {showAutoEditPresets ? (
                        <InlineStillCrop
                          sourceUrl={browseSourceUrl || thumbnailUrl}
                          imgRef={selectedImageRef}
                          onApply={handleBrowseCrop}
                          onCropModeChange={setBrowseCropping}
                        />
                      ) : null}
                      {showVideoThumbLabel ? <div className="screenshot-label">Thumbnail</div> : null}
                    </div>
                    {showDesktopEditPresets && !creatorMode ? (
                      <>
                        <span className="screenshot-preset-label screenshot-preset-label--selected">Selected</span>
                        <div className="selected-image-actions">
                          <button
                            type="button"
                            className="change-image-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleChangeImage();
                            }}
                          >
                            Change Image
                          </button>
                          <BrowseLayoutPicker
                            value={browseLayoutOrientation}
                            onChange={chooseBrowseLayout}
                            groupName="browse-layout-original"
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                  ) : null;
                })()}
                
                {/* Screenshots */}
                {(() => {
                  const shots = getVisibleScreenshots();
                  const thumbnailUrl = productData?.product?.thumbnail_url || fallbackImages.thumbnail;
                  return shots && shots.length > 0 ? shots.map((screenshot, index) => {
                    const isFirstImage = !thumbnailUrl && index === 0;
                    const label = showVideoThumbLabel
                      ? (isFirstImage ? 'Thumbnail' : `Screenshot ${index + 1}`)
                      : '';
                    return (
                      <div
                        key={`shot-${index}`}
                        className={`screenshot-item${showDesktopEditPresets && index === 0 && !thumbnailUrl ? ' screenshot-item--original' : ''}${isFirstImage && showVideoThumbLabel ? ' screenshot-item--thumbnail' : ''}${browseLayoutIsLandscape ? ' screenshot-item--landscape' : ''}${selectedScreenshot === index && selectedEditPreset === 'original' ? ' selected' : ''}${browseCropping && showAutoEditPresets && index === 0 && !thumbnailUrl ? ' screenshot-item--cropping' : ''}`}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={label || 'Selected image'}
                          aria-current={selectedScreenshot === index && selectedEditPreset === 'original' ? 'true' : undefined}
                          onClick={() => {
                            if (browseCropping) return;
                            selectScreenshot(index, screenshot);
                            applyBrowseEditPreset('original', BROWSE_EDIT_ORIGINAL);
                          }}
                          onKeyDown={(e) => {
                            if (browseCropping) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              selectScreenshot(index, screenshot);
                              applyBrowseEditPreset('original', BROWSE_EDIT_ORIGINAL);
                            }
                          }}
                        >
                          <img 
                            ref={showAutoEditPresets && index === 0 && !thumbnailUrl ? selectedImageRef : undefined}
                            src={(!showVideoThumbLabel && presetImageSrc) ? presetImageSrc : screenshot} 
                            alt={label || `Image ${index + 1}`} 
                            className="screenshot-image"
                            fetchPriority={selectedScreenshot === index ? 'high' : 'auto'}
                            decoding="async"
                          />
                          {showAutoEditPresets && index === 0 && !thumbnailUrl ? (
                            <InlineStillCrop
                              sourceUrl={browseSourceUrl || screenshot}
                              imgRef={selectedImageRef}
                              onApply={handleBrowseCrop}
                              onCropModeChange={setBrowseCropping}
                            />
                          ) : null}
                          {label ? <div className="screenshot-label">{label}</div> : null}
                        </div>
                        {showDesktopEditPresets && !creatorMode && !thumbnailUrl && index === 0 ? (
                          <>
                            <span className="screenshot-preset-label screenshot-preset-label--selected">Selected</span>
                            <div className="selected-image-actions">
                              <button
                                type="button"
                                className="change-image-link"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleChangeImage();
                                }}
                              >
                                Change Image
                              </button>
                              <BrowseLayoutPicker
                                value={browseLayoutOrientation}
                                onChange={chooseBrowseLayout}
                                groupName="browse-layout-shot"
                              />
                            </div>
                          </>
                        ) : null}
                      </div>
                    );
                  }) : null;
                })()}
                {showDesktopEditPresets && presetImageSrc ? BROWSE_EDIT_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    className={`screenshot-item screenshot-item--preset screenshot-item--preset-${preset.id}${selectedEditPreset === preset.id ? ' selected' : ''}`}
                    aria-pressed={selectedEditPreset === preset.id}
                    aria-label={`Try ${preset.label}`}
                    onClick={() => applyBrowseEditPreset(preset.id, preset.settings)}
                  >
                    <div
                      ref={preset.id === 'radius' ? setRadiusFrameNode : undefined}
                      style={preset.id === 'radius' && radiusPreviewPx > 0 ? { borderRadius: radiusPreviewPx } : undefined}
                    >
                      <img
                        src={presetImageSrc}
                        alt={preset.label}
                        className="screenshot-image"
                        style={
                          preset.id === 'bw'
                            ? { filter: blackAndWhiteCssFilter(true, selectedEditPreset === 'bw' ? bwIntensity : BW_INTENSITY_DEFAULT) }
                            : (preset.id === 'feather'
                              ? featherPresetMaskStyle
                              : (preset.id === 'radius' && radiusPreviewPx > 0
                                ? { borderRadius: radiusPreviewPx }
                                : undefined))
                        }
                      />
                      {preset.id === 'frame' ? (
                        <span className="screenshot-preset-frame-mat" aria-hidden="true" />
                      ) : null}
                    </div>
                    <span className="screenshot-preset-label">{preset.label}</span>
                  </button>
                )) : null}
              </div>
              {showDesktopEditPresets && selectedEditPreset === 'bw' ? (
                <div className="browse-bw-intensity">
                  <label htmlFor="browse-bw-intensity">Black and white intensity</label>
                  <input
                    id="browse-bw-intensity"
                    type="range"
                    min="0"
                    max="100"
                    value={clampBwIntensity(bwIntensity)}
                    onChange={(e) => setBrowseBwIntensity(e.target.value)}
                    className="browse-bw-intensity-slider"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={clampBwIntensity(bwIntensity)}
                    aria-valuetext={bwIntensityLabel(bwIntensity)}
                  />
                  <div className="browse-bw-intensity-ends">
                    <span>White</span>
                    <span>{bwIntensityLabel(bwIntensity)}</span>
                    <span>Black</span>
                  </div>
                </div>
              ) : null}
            </div>
            {!creatorMode && !showVideoThumbLabel && (
              <div className={`selected-image-meta${showDesktopEditPresets ? ' selected-image-meta--mobile-only' : ''}`}>
                <button type="button" className="change-image-link" onClick={handleChangeImage}>
                  Change Image
                </button>
                {showAutoEditPresets && !showDesktopEditPresets ? (
                  <BrowseLayoutPicker
                    value={browseLayoutOrientation}
                    onChange={chooseBrowseLayout}
                    groupName="browse-layout-meta"
                  />
                ) : null}
              </div>
            )}
            </div>
            {creatorMode && (
              <p className="screenshots-subtitle">Choose which screenshot to save to your favorites</p>
            )}
            {!creatorMode && (
              <div className="screenshots-section-actions">
                <p className="screenshots-subtitle">For your custom merchandise</p>
                <button
                  className="tools-page-btn"
                  onClick={goToToolsPage}
                >
                  Product Preview
                </button>
                <div className="cart-section-buttons">
                  <button className="view-cart-btn" onClick={openCartIfSignedIn}>View Cart</button>
                  <button className="checkout-btn" onClick={goToCheckout} disabled={cartHasUnavailableItems}>Checkout</button>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Save Favorite Button - Only in creator mode */}
          {creatorMode && !isShopCatalog && (
            <div className="tools-button-container">
              <button 
                className="to-favorite-btn"
                onClick={handleToFavorite}
                disabled={savingFavorite || !selectedScreenshotForFavorite}
              >
                {savingFavorite ? 'Saving...' : '⭐ Save Favorite'}
              </button>
            </div>
          )}

          {/* Tools Page Button - Underneath screenshots, above cart/checkout - Hidden in creator mode and My Shop catalog */}
          {!creatorMode && !isShopCatalog && (
            <div className="tools-button-container">
              <p className="screenshots-subtitle screenshots-subtitle-above-buttons">For your custom merchandise</p>
              <button 
                className="tools-page-btn"
                onClick={goToToolsPage}
              >
                Product Preview
              </button>
            </div>
          )}

          {/* Product Selection - Hidden in creator mode */}
          {!creatorMode && (
            <div className="product-page-container">
              <div className="product-main">
          <div className="product-image-section">
            {!isShopCatalog && productData.img_url && (
              <img 
                src={productData.img_url.includes('?') ? `${productData.img_url}&v=${getCacheBuster()}` : `${productData.img_url}?v=${getCacheBuster()}`} 
                alt="Product Preview" 
                className="product-preview-image"
              />
            )}
          </div>

          <div className="product-options-section">
            {/* Cart Buttons Above Products */}
            <div className="cart-section">
              {isBrowseMode ? (
                <div className="shop-catalog-toolbar">
                  <button
                    type="button"
                    className="shop-catalog-back-btn"
                    onClick={goToMainCategories}
                    aria-label="Back to categories"
                  >
                    <ChevronLeft />
                  </button>
                  <div className="shop-catalog-toolbar-text">
                    {isShopCatalog ? (
                      <h1 className="shop-catalog-page-title">{categoryDisplayName}</h1>
                    ) : (
                      <div className="cart-section-buttons">
                        <button className="view-cart-btn" onClick={openCartIfSignedIn}>View Cart</button>
                        <button className="checkout-btn" onClick={goToCheckout} disabled={cartHasUnavailableItems}>Checkout</button>
                      </div>
                    )}
                  </div>
                </div>
              ) : isShopCatalog ? (
                <h1 className="shop-catalog-page-title">{categoryDisplayName}</h1>
              ) : (
                <>
                  <div className="cart-section-buttons">
                    <button className="view-cart-btn" onClick={openCartIfSignedIn}>View Cart</button>
                    <button className="checkout-btn" onClick={goToCheckout} disabled={cartHasUnavailableItems}>Checkout</button>
                  </div>
                </>
              )}
            </div>

            {!isShopCatalog && (
              <div className="product-catalog-heading">
                <h2 className="product-catalog-title">{categoryDisplayName} Products</h2>
                <p className="product-catalog-subtitle">Choose a product for your selected image.</p>
                {(category === 'womens' || category === 'mens' || category === 'kids') && !colorMockupPreview && (
                  <p className="product-mockup-color-notice product-mockup-color-notice-intro">
                    Product mockups show representative colors. Your order will be made in the colors you select.
                  </p>
                )}
              </div>
            )}

            {isEditingCart && editingCartItem && (
              <div className="edit-cart-banner">
                <p className="edit-cart-banner-text">
                  Editing <strong>{editingCartItem.name || editingCartItem.product || 'item'}</strong>
                  {editingCartItem.size ? ` · ${editingCartItem.size}` : ''}
                  {editingCartItem.color ? ` · ${editingCartItem.color}` : ''}.
                  {' '}Change product, size, or color, then Update Cart.
                </p>
                <button
                  type="button"
                  className="edit-cart-banner-cancel"
                  onClick={() => navigate('/checkout')}
                >
                  Back to Checkout
                </button>
              </div>
            )}

            <div className="products-grid">
              {productData.products && productData.products.map((product, index) => {
                const stockPending = catalogStockPending(product);
                const cardUnavailable = !stockPending && (
                  variantAvailability[index]?.available === false
                  || !variantSelectable(product, index)
                );
                const isAddingThis = addingProductIndex === index;
                const { color: resolvedColor } = resolvedColorSize(product, index);
                const availableColors = stockPending ? [] : getColorsForCountry(product, shipToCountry);
                const fallbackSwatches = pendingSwatchColors(product);
                const swatchColors = colorMockupPreview
                  ? (availableColors.length ? availableColors : fallbackSwatches)
                  : availableColors;
                const displayColor = (
                  colorMockupPreview
                  && selectedColors[index]
                  && swatchColors.includes(selectedColors[index])
                ) ? selectedColors[index] : resolvedColor;
                const hoverColor = previewColors[index];
                const mockupColor = (
                  colorMockupPreview
                  && hoverColor
                  && (!swatchColors.length || swatchColors.includes(hoverColor))
                ) ? hoverColor : displayColor;
                const colorMockupUrl = colorMockupPreview ? getPrintfulColorMockupUrl(product, mockupColor) : '';
                const colorMockupTint = (
                  colorMockupUrl
                  && usesPrintfulVariantColorTint(colorMockupUrl)
                    ? getPrintfulColorCode(product, mockupColor)
                    : ''
                );
                return (
                <div
                  key={product?.name ? `${product.name}-${index}` : index}
                  className={`product-card${highlightedProductIndex === index ? ' product-card-editing' : ''}${cardUnavailable ? ' product-card--unavailable' : ''}${isAddingThis ? ' product-card--adding' : ''}`}
                  ref={(el) => { productCardRefs.current[index] = el; }}
                  onPointerDown={() => rememberToolsProductName(product?.name)}
                  onClick={(e) => {
                    rememberPickedProduct(product, index);
                    if (isProductCardControlClick(e) || cardUnavailable || isAddingThis) return;
                    handleAddToCart(product, index);
                  }}
                >
                  {/* Product Image - always show; stable URL so images load despite re-renders */}
                  {(() => {
                    const isApparelCategory = category === 'womens' || category === 'mens' || category === 'kids';
                    const imgUrl = colorMockupUrl || getProductImageUrl(product, true);
                    const safeUrl = (imgUrl && typeof imgUrl === 'string') ? imgUrl : `${getImgBase()}/placeholder.png`;
                    const loadHints = browseImageLoadHints(index);
                    return (
                      <div className={`product-image${colorMockupUrl ? ' product-image--color-mockup' : ''}`}>
                        <div className="product-image-wrapper">
                          <PrintfulColorMockupImg
                            key={`${product?.name || index}-${mockupColor || 'blank'}`}
                            className={(isApparelCategory || colorMockupUrl) ? "product-image-clear" : "product-image-normal"}
                            src={safeUrl}
                            alt={`${product.name}${mockupColor ? ` ${mockupColor}` : ''}`}
                            loading={loadHints.loading}
                            fetchPriority={loadHints.fetchPriority}
                            sizes="(max-width: 768px) 46vw, 240px"
                            tintColor={colorMockupTint}
                            onError={(e) => handleProductImageError(e, product)}
                          />
                        </div>
                      </div>
                    );
                  })()}
                  
                  <h3>
                    {product.name}
                    {product.name && product.name.includes('Jigsaw Puzzle with Tin') && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#666', display: 'block', marginTop: '4px' }}>
                        (Ages 4+ only)
                      </span>
                    )}
                  </h3>
                  {/* Reserved: product price from API - do not edit price or color variables */}
                  <p className="product-price">${calculatePrice(product, index).toFixed(2)}</p>
                  
                  <div className="product-options" onClick={(e) => e.stopPropagation()}>
                    {/* Color Options - reserved: use product.options.color / selectedColors only */}
                    {product.options && product.options.color && product.options.color.length > 0 && (
                      <div className="option-group option-group--swatches">
                        <label>Color:{colorMockupPreview && mockupColor ? ` ${mockupColor}` : ''}</label>
                        {colorMockupPreview && swatchColors.length > 0 && (
                          <div
                            className="color-swatch-row"
                            onPointerLeave={(event) => {
                              if (event.pointerType && event.pointerType !== 'mouse') return;
                              clearPreviewColor(index);
                            }}
                          >
                            {swatchColors.map((color) => {
                              const swatchHex = getPrintfulColorCode(product, color) || '#cccccc';
                              const isSelected = displayColor === color;
                              const isPreview = hoverColor === color;
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  className={`color-swatch${swatchToneClass(swatchHex)}${isSelected ? ' is-selected' : ''}${isPreview ? ' is-preview' : ''}`}
                                  style={{ '--swatch': swatchHex }}
                                  title={color}
                                  aria-label={color}
                                  aria-pressed={isSelected}
                                  onPointerEnter={() => previewProductColor(index, color, product)}
                                  onPointerDown={() => previewProductColor(index, color, product)}
                                  onFocus={() => previewProductColor(index, color, product)}
                                  onClick={() => applyProductColor(product, index, color)}
                                />
                              );
                            })}
                          </div>
                        )}
                        <select 
                          className={`color-select${colorMockupPreview && swatchColors.length ? ' color-select--hidden' : ''}`}
                          value={availableColors.includes(displayColor) ? displayColor : (availableColors[0] || '')}
                          disabled={!availableColors.length}
                          onChange={(e) => applyProductColor(product, index, e.target.value)}
                        >
                          {availableColors.length ? availableColors.map((color, colorIndex) => (
                            <option key={colorIndex} value={color}>
                              {color}
                            </option>
                          )) : (
                            <option value="">{stockPending ? 'Loading…' : 'Not available'}</option>
                          )}
                        </select>
                      </div>
                    )}
                    
                    {/* Handle Color Options */}
                    {product.options && product.options.handle_color && product.options.handle_color.length > 0 && (
                      <div className="option-group">
                        <label>Handle Color:</label>
                        <select 
                          className="color-select"
                          value={selectedColors[index] || product.options.handle_color[0]}
                          onChange={(e) => {
                            rememberPickedProduct(product, index);
                            clearVariantAvailability(index);
                            const newSelectedColors = { ...selectedColors };
                            newSelectedColors[index] = e.target.value;
                            setSelectedColors(newSelectedColors);
                          }}
                        >
                          {product.options.handle_color.map((color, colorIndex) => (
                            <option key={colorIndex} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {/* Size Options */}
                    {product.options && product.options.size && product.options.size.length > 0 && (() => {
                      // Bags "All Over Print Tote Pocket" has handle_color but no color - use optional chaining
                      const selectedColor = selectedColors[index] || product.options?.color?.[0] || product.options?.handle_color?.[0];
                      const availableSizes = stockPending ? [] : getAvailableSizes(product, selectedColor);
                      const currentSize = selectedSizes[index];
                      
                      // Determine the size to display - use current if available, otherwise first available
                      let displaySize = '';
                      if (currentSize && availableSizes.includes(currentSize)) {
                        displaySize = currentSize;
                      } else if (availableSizes.length > 0) {
                        displaySize = availableSizes[0];
                      }
                      
                      return (
                        <div className="option-group">
                          <label>Size:</label>
                          <select 
                            className="size-select"
                            value={displaySize}
                            disabled={!availableSizes.length}
                            onChange={(e) => {
                              rememberPickedProduct(product, index);
                              clearVariantAvailability(index);
                              const newSelectedSizes = { ...selectedSizes };
                              const nextSize = e.target.value;
                              newSelectedSizes[index] = nextSize;
                              setSelectedSizes(newSelectedSizes);
                              const colorsForSize = getAvailableColors(product, nextSize);
                              let nextColor = selectedColors[index] || product.options?.color?.[0] || product.options?.handle_color?.[0];
                              if (colorsForSize.length > 0 && !colorsForSize.includes(nextColor)) {
                                nextColor = colorsForSize[0];
                                setSelectedColors({ ...selectedColors, [index]: nextColor });
                              }
                            }}
                          >
                            {availableSizes.length ? availableSizes.map((size, sizeIndex) => (
                              <option key={sizeIndex} value={size}>
                                {size}
                              </option>
                            )) : (
                              <option value="">{stockPending ? 'Loading…' : 'Not available'}</option>
                            )}
                          </select>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {variantAvailability[index]?.message && !variantAvailability[index]?.available && (
                    <div className="variant-unavailable-note">{variantAvailability[index].message}</div>
                  )}
                  {!stockPending && !productShipsToCountry(product, shipToCountry) && shipToCountry !== 'US' && (
                    <div className="variant-unavailable-note">
                      This item is not available to ship to {shipToCountryName(shipToCountry)}. Switch the flag in the header, or pick another product.
                    </div>
                  )}
                  <button 
                    type="button"
                    className={`add-to-cart-btn${isAddingThis ? ' is-busy' : ''}`}
                    disabled={
                      isAddingThis
                      || variantAvailability[index]?.available === false
                      || !variantSelectable(product, index)
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product, index);
                    }}
                  >
                    {isAddingThis ? (
                      <>
                        <span className="add-to-cart-spinner" aria-hidden="true" />
                        Adding…
                      </>
                    ) : isShopCatalog
                        ? 'Select Image'
                        : isEditingCart
                          ? 'Update Cart'
                          : 'Add to Cart'}
                  </button>
                </div>
              );
              })}
            </div>

            {/* Cart Buttons Below Products */}
            <div className="cart-section-bottom-wrap">
              {!isShopCatalog && (category === 'womens' || category === 'mens' || category === 'kids') && !colorMockupPreview && (
                <p className="product-mockup-color-notice product-mockup-color-notice-center product-mockup-color-notice-bottom">
                  Product mockups show representative colors. Your order will be made in the colors you select.
                </p>
              )}
              <div className="cart-section cart-section-bottom">
                <button className="view-cart-btn" onClick={openCartIfSignedIn}>View Cart</button>
                <button className="checkout-btn" onClick={goToCheckout} disabled={cartHasUnavailableItems}>Checkout</button>
              </div>
            </div>
          </div>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Simple Cart Modal - Always available, hidden in creator mode */}
      {!creatorMode && isCartOpen && (
        <div className="cart-modal" onClick={() => setIsCartOpen(false)}>
          <div className="cart-modal-content" onClick={(e) => e.stopPropagation()}>
            {cartItems.length === 0 ? (
              <div className="empty-cart-message">
                <div className="empty-cart-icon">🛒</div>
                <p>Your cart is empty</p>
              </div>
            ) : (
              <div className="cart-items-wrapper">
                <h2 className="cart-section-title">Cart Items</h2>
                <div className="cart-items">
                  {cartItems.map((ci, i) => (
                  <div key={i} className="cart-item">
                    <div className="cart-item-info">
                      <div className="cart-item-name">{ci.name}</div>
                      {(ci.color || ci.size) ? (
                        <div className="cart-item-meta">{[ci.color, ci.size].filter(Boolean).join(' • ')}</div>
                      ) : null}
                      <div className="cart-item-price">${(ci.price || 0).toFixed(2)}</div>
                    </div>
                    {ci.screenshot && <img className="cart-item-shot" src={ci.screenshot} alt="" />}
                    <button 
                      className="cart-item-delete" 
                      onClick={() => {
                        const updatedItems = cartItems.filter((_, index) => index !== i);
                        persistCart(updatedItems);
                      }}
                      title="Remove item"
                    >
                      🗑️
                    </button>
                  </div>
                  ))}
                </div>
                <div className="cart-actions">
                  <button className="view-cart-btn" onClick={() => setIsCartOpen(false)}>Continue Shopping</button>
                  <button className="checkout-btn" onClick={goToCheckout} disabled={cartHasUnavailableItems}>Checkout</button>
                  <button className="edit-tools-btn" onClick={goToToolsPage}>Preview Design</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Added to Cart Modal - portal to body so navbar/overflow never clip it */}
      {!creatorMode && showAddedToCartModal && createPortal(
        <div className="added-to-cart-modal-overlay" onClick={() => setShowAddedToCartModal(false)}>
          <div className="added-to-cart-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="added-to-cart-modal-close" 
              onClick={() => setShowAddedToCartModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            
            <div className="added-to-cart-modal-content">
              <div className="added-to-cart-success-icon">✓</div>
              <h2 className="added-to-cart-title">{cartModalMode === 'update' ? 'Cart Updated!' : 'Added to Cart!'}</h2>
              <p className="added-to-cart-message">{cartModalMode === 'update' ? 'Your item has been updated successfully.' : 'Your item has been added successfully.'}</p>
              
              <div className="added-to-cart-modal-actions">
                <button 
                  className="checkout-btn-modal"
                  onClick={() => {
                    setShowAddedToCartModal(false);
                    goToCheckout();
                  }}
                >
                  Checkout
                </button>
                <button 
                  className="go-to-tools-btn"
                  onClick={() => {
                    setShowAddedToCartModal(false);
                    goToToolsPage();
                  }}
                >
                  Preview Design
                </button>
                <button 
                  className="continue-shopping-btn"
                  onClick={() => setShowAddedToCartModal(false)}
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProductPage;
