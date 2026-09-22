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
    preview: 'https://files.cdn.printful.com/products/394/10984_1737468114.jpg',
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
    preview: 'https://files.cdn.printful.com/products/682/16952_1683889985.jpg',
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
    return `${shopImgBase()}/kidsbabybodysuitpreview2.png`;
  }
  return fallbackUrl;
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
