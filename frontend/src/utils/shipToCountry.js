import { CHECKOUT_COUNTRY_OPTIONS } from '../data/shippingRegions';

export const SHIP_TO_STORAGE_KEY = 'ship_to_country';
export const SHIP_TO_UPDATED_EVENT = 'screenmerch-ship-to-country-updated';

export function isAllowedShipToCountry(code) {
  const c = String(code || '').trim().toUpperCase();
  return CHECKOUT_COUNTRY_OPTIONS.some((o) => o.code === c);
}

export function readShipToCountry() {
  try {
    const raw = localStorage.getItem(SHIP_TO_STORAGE_KEY);
    if (isAllowedShipToCountry(raw)) return String(raw).trim().toUpperCase();
  } catch {
    /* ignore */
  }
  return 'US';
}

export function writeShipToCountry(code) {
  const next = isAllowedShipToCountry(code) ? String(code).trim().toUpperCase() : 'US';
  try {
    localStorage.setItem(SHIP_TO_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(SHIP_TO_UPDATED_EVENT, { detail: { country: next } }));
  } catch {
    /* ignore */
  }
  return next;
}

export function getShipToOption(code) {
  const c = isAllowedShipToCountry(code) ? String(code).trim().toUpperCase() : readShipToCountry();
  return CHECKOUT_COUNTRY_OPTIONS.find((o) => o.code === c) || CHECKOUT_COUNTRY_OPTIONS[0];
}
