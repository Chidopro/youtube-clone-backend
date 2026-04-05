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

/**
 * @param {object|null} product - from API (may include printful_variant_map: { [color]: { [size]: id } } })
 * @param {string} color
 * @param {string} size
 * @returns {number|null}
 */
export function resolvePrintfulVariantId(product, color, size) {
  const map = product?.printful_variant_map;
  if (!map || typeof map !== 'object' || !color || !size) return null;

  const c = String(color).trim();
  const rawSize = String(size).trim();
  const altSize = normalizePrintfulSize(rawSize);

  let byColor = map[c];
  if (!byColor) {
    const lower = c.toLowerCase();
    const key = Object.keys(map).find((k) => String(k).toLowerCase() === lower);
    if (key) byColor = map[key];
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
  return null;
}
