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
  if (/^https?:\/\//i.test(file)) return file;
  return `${shopImgBase()}/${file}`;
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
