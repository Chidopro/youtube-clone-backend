import mockupsByCatalogId from '../data/printfulColorMockups.json';

/** Catalog ids with Printful per-color photos. */
const SHIRT_CATALOG_IDS_BY_NAME = {
  'T-Shirt': 71,
  'Unisex T-Shirt': 71,
  'Mens Fitted T-Shirt': 108,
  "Men's Fitted Long Sleeve": 116,
  "Men's Long Sleeve Shirt": 57,
  "Men's Tank Top": 248,
  'Oversized T-Shirt': 1592,
  'Unisex Oversized T-Shirt': 1592,
  'Heavyweight T-Shirt': 586,
  'Unisex Heavyweight T-Shirt': 586,
  "Women's Shirt": 360,
  'Kids Shirt': 307,
  'Kids Long Sleeve': 511,
  "Women's Ribbed Neck": 818,
  'Racerback Tank': 857,
  'Micro-Rib Tank Top': 780,
  "Women's Crop Top": 636,
  'Baby Staple Tee': 305,
  'Toddler Jersey T-Shirt': 489,
  'Baby Jersey T-Shirt': 854,
  'Baby Body Suit': 234,
  Hoodie: 380,
  'Unisex Hoodie': 380,
  'Champion Hoodie': 842,
  'Unisex Champion Hoodie': 842,
  'Pullover Hoodie': 294,
  'Unisex Pullover Hoodie': 294,
  'Cropped Hoodie': 317,
  'Youth Heavy Blend Hoodie': 689,
  'Kids Sweatshirt': 677,
  'Greeting Card': 568,
  'Hardcover Bound Notebook': 682,
  Apron: 894,
  'Jigsaw Puzzle with Tin': 906,
  'White Glossy Mug': 19,
  'Colored Mug': 403,
  'Enamel Mug': 407,
  'Travel Mug': 663,
  'All-Over Print Drawstring': 262,
  'All Over Print Tote Pocket': 274,
  'All-Over Print Utility Bag': 744,
  'Laptop Sleeve': 394,
  'Pet Bowl All-Over Print': 678,
  'Pet Bandana Collar': 902,
  'Distressed Dad Hat': 396,
  'Closed Back Cap': 140,
  'Five Panel Trucker Hat': 100,
  'Five Panel Baseball Cap': 952,
};

const COLOR_ALIASES = {
  1592: {
    'washed black': 'Black',
    'washed charcoal': 'Dark Grey',
    'vintage white': 'White',
    khaki: 'Toast',
    'light washed denim': 'Navy',
  },
  857: {
    'vintage black': 'Black',
    'heather white': 'White',
    'premium heather': 'Heather Gray',
    'vintage turquoise': 'Tahiti Blue',
  },
  906: {
    'white (glossy)': 'White',
  },
  396: {
    'charcoal gray': 'Charcoal Grey',
  },
};

function normalizeColor(value) {
  return String(value || '').trim().toLowerCase();
}

/** Printful per-color photos and swatches on every storefront product page. */
export function isColorMockupPreviewEnabled() {
  return true;
}

export function catalogIdForColorMockup(product) {
  const raw = product?.printful_catalog_product_id;
  const id = Number(raw);
  if (Number.isFinite(id) && id > 0) return id;
  const name = String(product?.name || '').trim();
  return SHIRT_CATALOG_IDS_BY_NAME[name] || 0;
}

export function getPrintfulColorEntry(product, colorName) {
  const id = catalogIdForColorMockup(product);
  if (!id) return null;
  const table = mockupsByCatalogId[String(id)];
  if (!table) return null;
  const wanted = String(colorName || '').trim();
  if (!wanted) return null;
  if (table[wanted]) return table[wanted];
  const lower = normalizeColor(wanted);
  const match = Object.keys(table).find((key) => normalizeColor(key) === lower);
  if (match) return table[match];
  const alias = COLOR_ALIASES[id]?.[lower];
  if (alias && table[alias]) return table[alias];
  return null;
}

export function getPrintfulColorMockupUrl(product, colorName) {
  return getPrintfulColorEntry(product, colorName)?.image || '';
}

/** Women's gallery cutouts: shirt pixels are transparent so color_code shows through. */
export function usesPrintfulVariantColorTint(url) {
  return String(url || '').includes('/o/upload/variant-image/');
}

export function getPrintfulColorCode(product, colorName) {
  const code = String(getPrintfulColorEntry(product, colorName)?.color_code || '').trim();
  if (code) return code;
  const n = normalizeColor(colorName);
  if (n === 'white' || n === 'white (glossy)') return '#ffffff';
  return '';
}

function isLightSwatch(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 210;
}

/** True white / off-white blanks — pastels like Pink still need a tint. */
function isNearWhiteBlank(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  const l = (r * 299 + g * 587 + b * 114) / 1000;
  return l > 242 && sat < 18;
}

/** White flat blanks we tint to the cart color in Tools / Confirm. */
const WHITE_BLANK_TINT_NAMES = new Set([
  'Baby Body Suit',
  'Kids Shirt',
  'Kids Long Sleeve',
  'Kids Sweatshirt',
  'Youth Heavy Blend Hoodie',
  'Kids Hoodie',
  'Toddler Jersey T-Shirt',
  'Baby Staple Tee',
  'Baby Jersey T-Shirt',
  'T-Shirt',
  'Unisex T-Shirt',
  'Mens Fitted T-Shirt',
  "Men's Fitted Long Sleeve",
  "Men's Long Sleeve Shirt",
  "Men's Tank Top",
  'Oversized T-Shirt',
  'Unisex Oversized T-Shirt',
  'Hoodie',
  'Unisex Hoodie',
  'Champion Hoodie',
  'Unisex Champion Hoodie',
  "Women's Shirt",
  'Heavyweight T-Shirt',
  'Unisex Heavyweight T-Shirt',
  "Women's Ribbed Neck",
  'Micro-Rib Tank Top',
  'Racerback Tank',
  "Women's Crop Top",
  'Pullover Hoodie',
  'Unisex Pullover Hoodie',
  'Cropped Hoodie',
]);

export function usesWhiteBlankGarmentTint(productName) {
  const name = String(productName || '').trim();
  return WHITE_BLANK_TINT_NAMES.has(name) || /baby body suit/i.test(name);
}

const NAMED_GARMENT_HEX = {
  black: '#131313',
  white: '#ffffff',
  pink: '#ffb2da',
  heather: '#babdc0',
  red: '#da0a1a',
  royal: '#253f8d',
  navy: '#1a1f2e',
  maroon: '#47171c',
  forest: '#1C3727',
  'true royal': '#05499b',
  berry: '#c02773',
  kelly: '#0e7b4e',
  mustard: '#E6A133',
  'dark grey heather': '#3e3c3d',
  'heather forest': '#4F5549',
  'heather columbia blue': '#6495ff',
  'athletic heather': '#b5b5b7',
  'dark heather': '#424248',
  'carolina blue': '#9ABEF5',
  'sport grey': '#cacacd',
  'hot pink': '#fe607a',
  'light pink': '#FFD6DC',
  'light blue': '#cbdbec',
  charcoal: '#6e6661',
  'navy blazer': '#1c2b4a',
  'charcoal heather': '#3e3c3d',
  'carbon grey': '#5b5c5e',
  'vintage black': '#2b2b2b',
  'team royal': '#2a4fa3',
  'desert pink': '#e8b4b8',
  'midnight navy': '#191970',
  'royal blue': '#4169e1',
  'heavy metal': '#4a4a4a',
  'light steel': '#c5c6c8',
  'soft pink': '#f4c6d1',
  'dusty rose': '#d4a5a5',
  'oatmeal heather': '#d8cfc4',
  natural: '#e8e0d5',
  'dark grey': '#3d3d3d',
  toast: '#c4a574',
  adobe: '#c47a5a',
  latte: '#c8b89a',
  lavender: '#b57edc',
  'team gold': '#d4a017',
  'team red': '#b22222',
  'military green': '#4b5320',
  'forest green': '#213b21',
  'black heather': '#2a2a2a',
  asphalt: '#3c3c3c',
  'soft cream': '#f2ead8',
  'cotton pink': '#FFE9EB',
  'fraiche peche': '#FFD2BE',
  'pale pink': '#ffd4c5',
  'hazy pink': '#cba59b',
  bubblegum: '#ffc5d4',
  'solid pink blend': '#ffd7de',
  lilac: '#fabbd8',
  peach: '#f8bc9f',
  storm: '#746e72',
  blossom: '#ffd6e1',
  cancun: '#c2faf9',
  'tahiti blue': '#52c7bd',
  leaf: '#84a357',
  'vintage indigo': '#3b4c6b',
  ash: '#e9e7e4',
};

function cssHex(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const hex = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '';
}

/** Printful swatch for a white-blank mockup. Empty for White (already the blank). */
export function getWhiteBlankGarmentTint(product, colorName) {
  const name = product?.name || product?.product || product;
  if (!usesWhiteBlankGarmentTint(name)) return '';
  const prod = product && typeof product === 'object' ? product : { name: String(name || '') };
  const hex = cssHex(getPrintfulColorCode(prod, colorName))
    || cssHex(NAMED_GARMENT_HEX[normalizeColor(colorName)]);
  if (!hex || isNearWhiteBlank(hex)) return '';
  return hex;
}

export function swatchToneClass(hex) {
  return isLightSwatch(hex) ? ' color-swatch--light' : '';
}

const STOREFRONT_COLORS_BY_NAME = {
  'T-Shirt': [
    'Black', 'White', 'Navy', 'Black Heather', 'Athletic Heather', 'Dark Grey Heather',
    'Red', 'Kelly', 'Heather Midnight Navy', 'True Royal', 'Asphalt', 'Heather True Royal',
    'Heather Prism Lilac', 'Soft Cream', 'Heather Prism Ice Blue', 'Mauve', 'Forest',
    'Heather Forest', 'Olive', 'Heather Deep Teal',
  ],
  'Unisex T-Shirt': [
    'Black', 'White', 'Navy', 'Black Heather', 'Athletic Heather', 'Dark Grey Heather',
    'Red', 'Kelly', 'Heather Midnight Navy', 'True Royal', 'Asphalt', 'Heather True Royal',
    'Heather Prism Lilac', 'Soft Cream', 'Heather Prism Ice Blue', 'Mauve', 'Forest',
    'Heather Forest', 'Olive', 'Heather Deep Teal',
  ],
  'Mens Fitted T-Shirt': ['Black', 'White', 'Heather Grey', 'Midnight Navy', 'Royal Blue', 'Red', 'Desert Pink', 'Light Blue'],
  "Men's Fitted Long Sleeve": ['Black', 'Heavy Metal', 'White'],
  "Men's Long Sleeve Shirt": ['Black', 'White', 'Navy', 'Royal', 'Sport Grey', 'Maroon', 'Red', 'Light Blue', 'Military Green', 'Sand', 'Irish Green', 'Ash', 'Forest Green', 'Indigo Blue', 'Light Pink'],
  "Men's Tank Top": ['Black', 'White', 'Navy', 'True Royal', 'Red', 'Athletic Heather'],
  'Distressed Dad Hat': ['Black', 'Navy', 'Charcoal Gray', 'Khaki'],
  'Closed Back Cap': [
    'Dark Navy', 'Black', 'Royal Blue', 'Red', 'Grey', 'White',
    'Dark Grey', 'Multicam Black', 'Olive', 'Multicam Green', 'Khaki',
  ],
  'Five Panel Trucker Hat': [
    'Black/ White', 'Black', 'Charcoal', 'Black/ White/ Black', 'Red/ White/ Red',
    'White', 'Navy/ White/ Navy', 'Royal/ White/ Royal', 'Kelly/ White/ Kelly',
    'Navy', 'Navy/ White', 'Charcoal/ White', 'Silver/ Black',
  ],
  'Five Panel Baseball Cap': [
    'Black', 'Black/Natural', 'Red/Natural', 'Navy/Natural',
    'Dark Green/Natural', 'Royal/Natural', 'White',
  ],
};

export function pendingSwatchColors(product) {
  const named = STOREFRONT_COLORS_BY_NAME[String(product?.name || '').trim()];
  const list = named || product?.options?.color || [];
  const seen = new Set();
  return list.filter((color) => {
    if (!color || seen.has(color)) return false;
    seen.add(color);
    return Boolean(getPrintfulColorMockupUrl(product, color));
  });
}
