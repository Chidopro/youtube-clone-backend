/**
 * Match storefront size labels to Printful catalog sizes (e.g. XXL -> 2XL).
 */
const SIZE_TO_PRINTFUL = {
  XXL: '2XL',
  XXXL: '3XL',
  XXXXL: '4XL',
  XXXXXL: '5XL',
  2: '2T',
  3: '3T',
  4: '4T',
  '5/6': '5T',
};

export function normalizePrintfulSize(size) {
  if (size == null || size === '') return size;
  const s = String(size).trim();
  return SIZE_TO_PRINTFUL[s] || s;
}

const JIGSAW_PUZZLE_WITH_TIN_CATALOG_ID = 906;
/** Must match backend printful_catalog.NO_COLOR_BUCKET_KEY */
const PRINTFUL_NO_COLOR_KEY = '__printful_no_color__';

/**
 * Printful catalog 906: color is "White (glossy)"; sizes look like 40″×28″ (2000 pcs).
 * Storefront uses "White" and long size strings starting with "2000 pcs: …".
 */
function resolveJigsawTinVariantId(map, color, rawSize) {
  const c = String(color || '').trim();
  let byColor = map[c];
  if (!byColor && c.toLowerCase() === 'white' && map['White (glossy)']) {
    byColor = map['White (glossy)'];
  }
  if (!byColor || typeof byColor !== 'object') return null;
  const m = String(rawSize).match(/(\d+)\s*pcs/i);
  if (!m) return null;
  const needle = `(${m[1]} pcs)`;
  for (const sk of Object.keys(byColor)) {
    if (String(sk).includes(needle)) {
      const v = byColor[sk];
      if (v != null && v !== '') return Number(v);
    }
  }
  return null;
}

/**
 * @param {object|null} product - from API (may include printful_variant_map: { [color]: { [size]: id } } })
 * @param {string} color
 * @param {string} size
 * @returns {number|null}
 */
export function resolvePrintfulVariantId(product, color, size) {
  const map = product?.printful_variant_map;
  if (!map || typeof map !== 'object' || !color || !size) return null;

  const catalogId = product?.printful_catalog_product_id;
  if (catalogId === JIGSAW_PUZZLE_WITH_TIN_CATALOG_ID || catalogId === String(JIGSAW_PUZZLE_WITH_TIN_CATALOG_ID)) {
    const j = resolveJigsawTinVariantId(map, color, size);
    if (j != null) return j;
  }

  const c = String(color).trim();
  const rawSize = String(size).trim();
  const altSize = normalizePrintfulSize(rawSize);

  let byColor = map[c];
  if (!byColor) {
    const lower = c.toLowerCase();
    const key = Object.keys(map).find((k) => String(k).toLowerCase() === lower);
    if (key) byColor = map[key];
  }
  if (!byColor && map[PRINTFUL_NO_COLOR_KEY]) {
    byColor = map[PRINTFUL_NO_COLOR_KEY];
  }
  if (!byColor || typeof byColor !== 'object') return null;

  const trySizes = [rawSize, altSize].filter((s, i, a) => s && a.indexOf(s) === i);
  for (const sz of trySizes) {
    const v = byColor[sz];
    if (v != null && v !== '') return Number(v);
  }
  const sl = rawSize.toLowerCase();
  for (const sk of Object.keys(byColor)) {
    if (String(sk).toLowerCase() === sl) {
      const v = byColor[sk];
      if (v != null && v !== '') return Number(v);
    }
  }
  const norm = (s) =>
    String(s)
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[\u2033\u201c\u201d"'*]/g, '')
      .replace(/\u00d7/g, 'x');
  const nRaw = norm(rawSize);
  if (nRaw) {
    for (const sk of Object.keys(byColor)) {
      if (norm(sk) === nRaw) {
        const v = byColor[sk];
        if (v != null && v !== '') return Number(v);
      }
    }
  }
  return null;
}
