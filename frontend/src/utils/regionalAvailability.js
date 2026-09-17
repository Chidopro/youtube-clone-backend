import { CHECKOUT_COUNTRY_OPTIONS } from '../data/shippingRegions';
import { readShipToCountry } from './shipToCountry';

function shipToCode(country) {
  const c = String(country || '').trim().toUpperCase();
  return CHECKOUT_COUNTRY_OPTIONS.some((o) => o.code === c) ? c : 'US';
}

const STOREFRONT_SIZE_FROM_PRINTFUL = {
  '2XL': 'XXL',
  '3XL': 'XXXL',
  '4XL': 'XXXXL',
  '5XL': 'XXXXXL',
};
const STOREFRONT_LETTER_SIZES = new Set(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL', 'XXXXXL']);

export function canonicalStorefrontSize(size) {
  const s = String(size || '').trim();
  if (!s) return s;
  const upper = s.toUpperCase();
  if (STOREFRONT_SIZE_FROM_PRINTFUL[upper]) return STOREFRONT_SIZE_FROM_PRINTFUL[upper];
  if (STOREFRONT_LETTER_SIZES.has(upper)) return upper;
  return s;
}

export function shipToCountryName(country) {
  const code = shipToCode(country);
  return CHECKOUT_COUNTRY_OPTIONS.find((o) => o.code === code)?.name || 'United States';
}

function hasRegionalMatrix(product, country) {
  const code = shipToCode(country);
  const regional = product?.regional_size_color_availability;
  return !!(regional && Object.prototype.hasOwnProperty.call(regional, code));
}

function isPrintfulCatalogProduct(product) {
  return !!(product?.printful_catalog_product_id || product?.printful_variant_map);
}

/** Catalog cards waiting for Printful regional stock — not the same as out of stock. */
export function catalogStockPending(product) {
  if (!product) return false;
  if (product._catalogPreview) return true;
  return isPrintfulCatalogProduct(product) && !product.regional_size_color_availability;
}

export function sizeColorAvailabilityForCountry(product, country) {
  const code = shipToCode(country);
  const regional = product?.regional_size_color_availability;
  if (regional && Object.prototype.hasOwnProperty.call(regional, code)) {
    return regional[code];
  }
  if (isPrintfulCatalogProduct(product)) return {};
  return product?.size_color_availability || null;
}

export function getAvailableSizesForCountry(product, color, country = readShipToCountry()) {
  const apiSizes = product?.options?.size || [];
  const regional = hasRegionalMatrix(product, country);
  if (!product || !color) return isPrintfulCatalogProduct(product) ? [] : apiSizes;

  const sca = sizeColorAvailabilityForCountry(product, country);
  if (sca && typeof sca === 'object') {
    const sizesFromApi = apiSizes.filter((size) => {
      const colorsForSize = sca[size] || sca[canonicalStorefrontSize(size)];
      return Array.isArray(colorsForSize) && colorsForSize.includes(color);
    });
    if (sizesFromApi.length > 0) return sizesFromApi;
    if (regional || isPrintfulCatalogProduct(product)) return [];
  }
  return isPrintfulCatalogProduct(product) ? [] : apiSizes;
}

export function getAvailableColorsForCountry(product, size, country = readShipToCountry()) {
  const apiColors = product?.options?.color || [];
  const regional = hasRegionalMatrix(product, country);
  if (!product || !size) return isPrintfulCatalogProduct(product) ? [] : apiColors;

  const sca = sizeColorAvailabilityForCountry(product, country);
  const sizeKey = canonicalStorefrontSize(size);
  const listed = sca && typeof sca === 'object'
    ? (Array.isArray(sca[size]) ? sca[size] : sca[sizeKey])
    : null;
  if (Array.isArray(listed)) {
    if (listed.length === 0) return (regional || isPrintfulCatalogProduct(product)) ? [] : apiColors;
    return apiColors.filter((c) => listed.includes(c));
  }
  if (regional || isPrintfulCatalogProduct(product)) return [];
  return apiColors;
}

/** Colors that have at least one in-stock size for this ship-to country. */
export function getColorsForCountry(product, country = readShipToCountry()) {
  const apiColors = product?.options?.color || [];
  if (!product) return apiColors;
  const sca = sizeColorAvailabilityForCountry(product, country);
  if (!sca || typeof sca !== 'object') {
    return isPrintfulCatalogProduct(product) ? [] : apiColors;
  }
  const inStock = new Set();
  Object.values(sca).forEach((colors) => {
    if (Array.isArray(colors)) colors.forEach((c) => inStock.add(c));
  });
  if (!inStock.size) return isPrintfulCatalogProduct(product) ? [] : apiColors;
  return apiColors.filter((c) => inStock.has(c));
}

export function comboAvailableForCountry(product, color, size, country = readShipToCountry()) {
  if (!product || !color || !size) return null;
  if (isPrintfulCatalogProduct(product) && !hasRegionalMatrix(product, country)) return false;
  if (!hasRegionalMatrix(product, country)) return null;
  const sca = sizeColorAvailabilityForCountry(product, country);
  if (!sca || typeof sca !== 'object') return false;
  const sizeKey = canonicalStorefrontSize(size);
  const colors = Array.isArray(sca[size]) ? sca[size] : sca[sizeKey];
  if (!Array.isArray(colors)) return false;
  return colors.includes(color);
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function regionalBasePrice(product, country) {
  const code = shipToCode(country);
  const map = product?.regional_base_prices;
  if (map && map[code] != null && Number(map[code]) > 0) {
    return Number(map[code]);
  }
  return Number(product?.price || 0);
}

export function unitPriceForCountry(product, size, country) {
  const base = regionalBasePrice(product, country);
  const extra = product?.size_pricing && size != null ? product.size_pricing[size] : undefined;
  return roundMoney(base + (typeof extra === 'number' ? extra : 0));
}

export function cartItemUnitPrice(item, country) {
  const code = shipToCode(country);
  const map = item?.regional_base_prices;
  const size = item?.size || item?.variants?.size;
  if (map && map[code] != null && Number(map[code]) > 0) {
    const extra = item?.size_pricing && size != null ? item.size_pricing[size] : undefined;
    return roundMoney(Number(map[code]) + (typeof extra === 'number' ? extra : 0));
  }
  return Number(item?.price || 0);
}

export function repriceCartItems(items, country) {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    const next = cartItemUnitPrice(item, country);
    if (!Number.isFinite(next) || next <= 0 || item.price === next) return item;
    return { ...item, price: next };
  });
}

export function productShipsToCountry(product, country = readShipToCountry()) {
  const colors = product?.options?.color || [];
  const sizes = product?.options?.size || [];
  if (!colors.length && !sizes.length) return true;
  if (colors.length) {
    const size = sizes[0];
    return getAvailableColorsForCountry(product, size, country).length > 0
      || sizes.some((sz) => getAvailableColorsForCountry(product, sz, country).length > 0);
  }
  const color = colors[0] || product?.options?.handle_color?.[0];
  return getAvailableSizesForCountry(product, color, country).length > 0;
}
