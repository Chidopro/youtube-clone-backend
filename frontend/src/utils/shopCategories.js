const SHOP_IMG_BASE = 'https://screenmerch.fly.dev/static/images';

/** Storefront shop hubs: the 8 product categories (no Product Info / Image Tools). */
export const SHOP_CATEGORIES = [
  { name: "Women's", emoji: '👩', category: 'womens', preview: 'womenshirtpreview.png' },
  { name: "Men's", emoji: '👨', category: 'mens', preview: 'mensunisextshirtpreview.png' },
  { name: 'Kids', emoji: '👶', category: 'kids', preview: 'kidsshirtpreview.png' },
  { name: 'Hats', emoji: '🧢', category: 'hats', preview: 'hatsdistresseddadhatpreview.png' },
  { name: 'Mugs', emoji: '☕', category: 'mugs', preview: 'mugwhiteglossymugpreview.png' },
  { name: 'Bags', emoji: '👜', category: 'bags', preview: 'bagslaptopsleevepreview.png' },
  { name: 'Pets', emoji: '🐕', category: 'pets', preview: 'petspetbowlalloverprintpreview.png' },
  { name: 'Miscellaneous', emoji: '📦', category: 'misc', preview: 'miscellaneoushardcovernotebookpreview.png' },
];

export function shopCategoryThumbUrl(previewFile) {
  const file = String(previewFile || '').trim();
  if (!file) return '';
  return `${SHOP_IMG_BASE}/${file}`;
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
