import { CHECKOUT_COUNTRY_OPTIONS } from '../data/shippingRegions';
import { readShipToCountry } from './shipToCountry';

function shipToCode(country) {
  const c = String(country || '').trim().toUpperCase();
  return CHECKOUT_COUNTRY_OPTIONS.some((o) => o.code === c) ? c : 'US';
}

export function shipToCountryName(country) {
  const code = shipToCode(country);
  return CHECKOUT_COUNTRY_OPTIONS.find((o) => o.code === code)?.name || 'United States';
}

function hasRegionalMatrix(product, country) {
  const code = shipToCode(country);
  if (code === 'US') return false;
  const regional = product?.regional_size_color_availability;
  return !!(regional && Object.prototype.hasOwnProperty.call(regional, code));
}

export function sizeColorAvailabilityForCountry(product, country) {
  const code = shipToCode(country);
  if (code === 'US') return product?.size_color_availability || null;
  const regional = product?.regional_size_color_availability;
  if (regional && Object.prototype.hasOwnProperty.call(regional, code)) {
    return regional[code];
  }
  return product?.size_color_availability || null;
}

export function getAvailableSizesForCountry(product, color, country = readShipToCountry()) {
  const apiSizes = product?.options?.size || [];
  const regional = hasRegionalMatrix(product, country);
  if (!product || !color) return apiSizes;

  const sca = sizeColorAvailabilityForCountry(product, country);
  if (sca && typeof sca === 'object') {
    const sizesFromApi = apiSizes.filter((size) => {
      const colorsForSize = sca[size];
      return Array.isArray(colorsForSize) && colorsForSize.includes(color);
    });
    if (sizesFromApi.length > 0) return sizesFromApi;
    if (regional) return [];
  }
  return apiSizes;
}

export function getAvailableColorsForCountry(product, size, country = readShipToCountry()) {
  const apiColors = product?.options?.color || [];
  const regional = hasRegionalMatrix(product, country);
  if (!product || !size) return apiColors;

  const sca = sizeColorAvailabilityForCountry(product, country);
  if (sca && typeof sca === 'object' && Array.isArray(sca[size])) {
    if (sca[size].length === 0) return regional ? [] : apiColors;
    return apiColors.filter((c) => sca[size].includes(c));
  }
  if (regional) return [];
  return apiColors;
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
