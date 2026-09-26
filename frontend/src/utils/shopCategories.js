const SHOP_IMG_BASE_FALLBACK = 'https://screenmerch.fly.dev/static/images';

function shopImgBase() {
  if (typeof window !== 'undefined') {
    const host = (window.location.hostname || '').toLowerCase();
    if (host === 'screenmerch.com' || host === 'www.screenmerch.com' || host.endsWith('.screenmerch.com')) {
      return '/static/images';
    }
  }
  return SHOP_IMG_BASE_FALLBACK;
}

/** Storefront shop hubs: the 8 product categories (no Product Info / Image Tools). */
export const SHOP_CATEGORIES = [
  {
    name: "Women's",
    emoji: '👩',
    category: 'womens',
    thumbFit: 'model',
    preview: 'https://files.cdn.printful.com/products/360/14268_1774363083.jpg',
  },
  {
    name: "Men's",
    emoji: '👨',
    category: 'mens',
    thumbFit: 'model',
    preview: 'https://files.cdn.printful.com/products/71/4086_1752236281.jpg',
  },
  {
    name: 'Kids',
    emoji: '👶',
    category: 'kids',
    thumbFit: 'model',
    preview: 'https://files.cdn.printful.com/products/307/10616_1738935713.jpg',
  },
  {
    name: 'Hats',
    emoji: '🧢',
    category: 'hats',
    preview: 'https://files.cdn.printful.com/products/396/10992_1582184592.jpg',
  },
  {
    name: 'Mugs',
    emoji: '☕',
    category: 'mugs',
    preview: 'https://files.cdn.printful.com/products/19/1320_1663762583.jpg',
  },
  {
    name: 'Bags',
    emoji: '👜',
    category: 'bags',
    preview: 'https://files.cdn.printful.com/products/274/9039_1530789433.jpg',
  },
  {
    name: 'Pets',
    emoji: '🐕',
    category: 'pets',
    preview: 'https://files.cdn.printful.com/products/678/16785_1680768114.jpg',
  },
  {
    name: 'Accessories',
    emoji: '📦',
    category: 'misc',
    preview: 'https://files.cdn.printful.com/products/682/16957_1683889996.jpg',
  },
];

export function shopCategoryThumbUrl(previewFile) {
  const file = String(previewFile || '').trim();
  if (!file) return '';
  if (/^https?:\/\//i.test(file) || file.startsWith('/')) return file;
  return `${shopImgBase()}/${file}`;
}

/** Deluzion Shop only — eight premade products, not the shared category hubs. */
export const DELUZION_SHOP_PRODUCTS = [
  { id: 'apron', name: 'Apron', catalogName: 'Apron', category: 'misc', preview: '/shop/deluzion/apron.png', color: 'White', emoji: '🧺' },
  { id: 'mug', name: 'Mug', catalogName: 'Colored Mug', category: 'mugs', preview: '/shop/deluzion/mug.png', color: 'Black', emoji: '☕', hasSizes: true },
  { id: 'tote', name: 'Tote Bag', catalogName: 'All Over Print Tote Pocket', category: 'bags', preview: '/shop/deluzion/tote.png', color: 'Black', emoji: '👜' },
  { id: 'tshirt', name: 'T Shirt', catalogName: 'T-Shirt', category: 'mens', preview: '/shop/deluzion/tshirt.png', color: 'Black', emoji: '👕', hasSizes: true },
  { id: 'tanktop', name: 'Tank Top', catalogName: "Men's Tank Top", category: 'mens', preview: '/shop/deluzion/tanktop.png', color: 'Black', emoji: '🎽', hasSizes: true },
  { id: 'hat', name: 'Hat', catalogName: 'Five Panel Baseball Cap', category: 'hats', preview: '/shop/deluzion/hat.png', color: 'Black', emoji: '🧢' },
  { id: 'notebook', name: 'Notebook', catalogName: 'Hardcover Bound Notebook', category: 'misc', preview: '/shop/deluzion/notebook.png', color: 'Silver', emoji: '📓' },
  { id: 'puzzle', name: 'Puzzle', catalogName: 'Jigsaw Puzzle with Tin', category: 'misc', preview: '/shop/deluzion/puzzle.jpg', color: 'White', emoji: '🧩', hasSizes: true },
];

export function isPremadeShopfront(subdomain) {
  return String(subdomain || '').trim().toLowerCase() === 'deluzion';
}

export function applyShopCatalogOverrides(products, overrides) {
  const map = overrides && typeof overrides === 'object' ? overrides : {};
  return (products || []).map((product, index) => {
    const patch = map[product.id];
    const order = patch && Number.isFinite(Number(patch.order)) ? Number(patch.order) : index;
    const hidden = Boolean(patch && patch.hidden);
    if (!patch || typeof patch !== 'object') {
      return { ...product, order, hidden: false };
    }
    const preview = String(patch.preview || '').trim();
    const color = String(patch.color || '').trim();
    const size = String(patch.size || '').trim();
    return {
      ...product,
      preview: preview || product.preview,
      color: color || product.color,
      size: size || product.size || '',
      order,
      hidden,
    };
  });
}

/** Shopper-facing order. Collaborator shops only include photos that shop saved. */
export function orderedShopProducts(products, { collaborator = false } = {}) {
  return [...(products || [])]
    .map((tile, index) => ({ tile, index }))
    .filter(({ tile }) => {
      if (tile?.hidden) return false;
      if (!collaborator) return true;
      const preview = String(tile?.preview || '').trim();
      return Boolean(preview) && !preview.startsWith('/shop/');
    })
    .sort((a, b) => {
      const ao = Number.isFinite(Number(a.tile?.order)) ? Number(a.tile.order) : a.index;
      const bo = Number.isFinite(Number(b.tile?.order)) ? Number(b.tile.order) : b.index;
      if (ao !== bo) return ao - bo;
      return a.index - b.index;
    })
    .map(({ tile }) => tile);
}

export function deluzionShopArtworkUrl(preview) {
  const path = shopCategoryThumbUrl(preview);
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Short size labels for shop tiles (puzzle piece counts stay readable). */
export function shopperSizeLabel(size) {
  const s = String(size || '').trim();
  const pcs = s.match(/^(\d+)\s*pcs/i);
  if (pcs) return `${pcs[1]} pcs`;
  return s;
}

export function shopperChoosesSize(sizes) {
  return (Array.isArray(sizes) ? sizes : []).filter(Boolean).length > 1;
}

/** Forced mockups when browse cache or API still point at an older file. */
export function storefrontMockupUrl(productName, fallbackUrl) {
  const n = String(productName || '');
  if (/men'?s long sleeve shirt/i.test(n) && !/fitted/i.test(n)) {
    return `${shopImgBase()}/menslongsleeveshirtpreview6.png`;
  }
  if (/baby body suit/i.test(n)) {
    return `${shopImgBase()}/kidsbabybodysuitpreview6.png`;
  }
  if (/kids long sleeve/i.test(n)) {
    return `${shopImgBase()}/kidslongsleevepreview2.png`;
  }
  if (/kids shirt/i.test(n)) {
    return `${shopImgBase()}/kidsshirtpreview2.png`;
  }
  if (/youth heavy blend hoodie|kids hoodie/i.test(n)) {
    return `${shopImgBase()}/kidsyouthheavyblendhoodiepreview2.png`;
  }
  if (/kids sweatshirt/i.test(n)) {
    return `${shopImgBase()}/kidssweatshirtpreview2.png`;
  }
  if (/toddler jersey/i.test(n)) {
    return `${shopImgBase()}/kidstoddlerjerseytshirtpreview2.png`;
  }
  if (/baby staple/i.test(n)) {
    return `${shopImgBase()}/kidsbabystapleteepreview2.png`;
  }
  if (/baby jersey/i.test(n)) {
    return `${shopImgBase()}/kidsbabyjerseytshirtpreview2.png`;
  }
  return fallbackUrl;
}

/**
 * Tools / Confirm overlay only. White flats we tint to the cart color.
 * Does not change shop browse cards or ColorPickerModal.
 */
const TOOLS_WHITE_BLANK_FILES = [
  [/oversized t-shirt/i, 'mensunisexoversizedtshirtpreview2.png'],
  [/champion hoodie/i, 'mensunisexchampionhoodiepreview2.png'],
  [/fitted long sleeve/i, 'mensfittedlongsleeveshirtpreview2.png'],
  [/men'?s long sleeve shirt/i, 'menslongsleeveshirtpreview7.png'],
  [/men'?s tank/i, 'menstanktoppreview2.png'],
  [/mens fitted t-shirt|^fitted t-shirt$/i, 'mensfittedtshirtpreview2.png'],
  [/heavyweight t-shirt/i, 'womenshdshirtpreview2.png'],
  [/micro-rib/i, 'womensmicroribtanktoppreview2.png'],
  [/racerback/i, 'womenstankpreview2.png'],
  [/cropped hoodie/i, 'womenscroppedhoodiepreview2.png'],
  [/pullover hoodie/i, 'womensunisexpulloverhoodiepreview2.png'],
  [/crop top/i, 'womenscroptoppreview2.png'],
  [/ribbed neck/i, 'womensribbedneckpreview2.png'],
  [/^women'?s shirt$/i, 'womenshirtpreview2.png'],
  [/^t-shirt$/i, 'mensunisextshirtpreview2.png'],
  [/^unisex t-shirt$/i, 'mensunisextshirtpreview2.png'],
  [/^hoodie$/i, 'mensunisexhoodiepreview2.png'],
  [/^unisex hoodie$/i, 'mensunisexhoodiepreview2.png'],
];

export function toolsPreviewMockupUrl(productName, fallbackUrl) {
  const n = String(productName || '').trim();
  for (const [pattern, file] of TOOLS_WHITE_BLANK_FILES) {
    if (pattern.test(n)) return `${shopImgBase()}/${file}`;
  }
  return storefrontMockupUrl(productName, fallbackUrl);
}

const SHOP_ADD_INTENT_KEY = 'sm_shop_add_intent';

export function browseShopCategoryPath(category, options = {}) {
  const fromShop = options.fromShop !== false;
  const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
  const userEmail = localStorage.getItem('user_email') || '';
  localStorage.setItem('last_selected_category', category);
  const qs = new URLSearchParams({
    category,
    authenticated: String(isAuthenticated),
    email: userEmail,
  });
  if (fromShop) qs.set('from', 'shop');
  return `/product/browse?${qs.toString()}`;
}

export function saveShopAddIntent(intent) {
  try {
    sessionStorage.setItem(SHOP_ADD_INTENT_KEY, JSON.stringify(intent || {}));
  } catch {
    /* ignore */
  }
}

export function readShopAddIntent() {
  try {
    const raw = sessionStorage.getItem(SHOP_ADD_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearShopAddIntent() {
  try {
    sessionStorage.removeItem(SHOP_ADD_INTENT_KEY);
  } catch {
    /* ignore */
  }
}
