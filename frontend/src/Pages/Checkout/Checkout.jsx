import React, { useEffect, useState, useCallback, useRef, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_CONFIG, apiJoin } from '../../config/apiConfig';
import { emitCartUpdated, setToolsFocusCartIndex, setToolsPreviewNewest, writeCartItems, readCartItems, applySelectedScreenshot, resolveItemImageOrientation, withItemImageOrientation, setCartPersistPaused, consumeToolsFocusCartIndex, CART_UPDATED_EVENT } from '../../utils/merchSession';
import { ProductPreviewWithDrag } from '../ToolsPage/ToolsPage';
import { isShopperSignedIn, rememberAuthReturnPath } from '../../utils/shopperAuth';
import AuthModal from '../../Components/AuthModal/AuthModal';
import { isDemoStorefront } from '../../utils/demoStorefront';
import {
  CHECKOUT_COUNTRY_OPTIONS,
  US_STATE_OPTIONS,
  CA_PROVINCE_OPTIONS,
  postalLooksComplete,
  needsStateForShipping,
  hasStateSelected,
} from './shippingRegions';
import { readShipToCountry, writeShipToCountry, SHIP_TO_UPDATED_EVENT } from '../../utils/shipToCountry';
import { repriceCartItems } from '../../utils/regionalAvailability';
import { peekDisplaySrc, prepareDisplaySrc } from '../../utils/displaySrc';
import './Checkout.css';

const noopPreviewOffset = () => {};

function itemHasLiveOverlayEdits(item) {
  const ts = item?.toolSettings;
  if (!ts || typeof ts !== 'object') return false;
  return Boolean(
    ts.frameEnabled
    || ts.blackAndWhite
    || Number(ts.featherEdge) > 0
    || Number(ts.cornerRadius) > 0
    || (ts.textEnabled && String(ts.textContent || '').trim())
  );
}

function itemShotUrl(item) {
  return String(
    item?.displayScreenshot
    || item?.screenshot
    || item?.selected_screenshot
    || item?.originalScreenshot
    || item?.thumbnail
    || ''
  ).trim();
}

function itemConfirmShotUrl(item) {
  if (itemHasLiveOverlayEdits(item)) {
    return String(
      item?.originalScreenshot
      || item?.screenshot
      || item?.selected_screenshot
      || item?.displayScreenshot
      || item?.thumbnail
      || ''
    ).trim();
  }
  return itemShotUrl(item);
}

function useDisplaySrc(url, maxEdge, enabled = true, urgent = false) {
  const raw = String(url || '').trim();
  const cached = enabled && raw ? peekDisplaySrc(raw) : null;
  const [result, setResult] = useState(() => cached || { src: '', width: 0, height: 0, forUrl: '' });
  useEffect(() => {
    if (!enabled || !raw) {
      setResult({ src: '', width: 0, height: 0, forUrl: '' });
      return undefined;
    }
    const hit = peekDisplaySrc(raw);
    if (hit?.src) {
      setResult({ ...hit, forUrl: raw });
      return undefined;
    }
    let cancelled = false;
    prepareDisplaySrc(raw, maxEdge, { urgent })
      .then((next) => {
        if (!cancelled) setResult({ ...next, forUrl: raw });
      })
      .catch(() => {
        if (!cancelled) setResult({ src: '', width: 0, height: 0, forUrl: raw });
      });
    return () => {
      cancelled = true;
    };
  }, [url, maxEdge, enabled, urgent]);
  if (!enabled || !raw) return { src: '', width: 0, height: 0 };
  if (result.forUrl === raw && result.src) return result;
  if (cached?.src) return cached;
  return { src: '', width: 0, height: 0 };
}

function OrderItemShot({ url, orientation, offsetX, offsetY, enabled = true }) {
  const shot = useDisplaySrc(url, 180, enabled);
  if (!shot.src) {
    return <div className={`item-screenshot item-screenshot--${orientation}`} aria-hidden="true" />;
  }
  const shotX = Math.max(0, Math.min(100, 50 + (Number(offsetX) || 0) / 2));
  const shotY = Math.max(
    0,
    Math.min(100, (orientation === 'landscape' ? 50 : 26) + (Number(offsetY) || 0) / 2)
  );
  return (
    <img
      src={shot.src}
      alt="Your design"
      className={`item-screenshot item-screenshot--${orientation}`}
      decoding="async"
      style={{ objectPosition: `${shotX}% ${shotY}%` }}
    />
  );
}

/** Portrait/landscape confirm is useful on shirts, hoodies, and hats. */
const DESIGN_CONFIRM_CATEGORIES = new Set(['womens', 'mens', 'kids', 'hats']);
const DESIGN_SKIP_CATEGORIES = new Set(['mugs', 'bags', 'pets', 'misc']);
const DESIGN_SKIP_NAME_RE = /\b(mug|tote|bag|sleeve|bowl|bandana|notebook|puzzle|poster|magnet|sticker|phone case|pet)\b/i;
const DESIGN_CONFIRM_NAME_RE = /\b(t-?shirt|shirt|hoodie|tee|tank|sweatshirt|crewneck|jersey|pullover|hat|cap|beanie)\b/i;

function itemNeedsDesignConfirm(item) {
  const cat = String(item?.category || '').trim().toLowerCase();
  if (DESIGN_SKIP_CATEGORIES.has(cat)) return false;
  if (DESIGN_CONFIRM_CATEGORIES.has(cat)) return true;
  const name = String(item?.name || item?.product || '');
  if (DESIGN_SKIP_NAME_RE.test(name)) return false;
  if (DESIGN_CONFIRM_NAME_RE.test(name)) return true;
  return false;
}

function cartConfirmIndexes(itemList) {
  return (itemList || [])
    .map((it, i) => (itemNeedsDesignConfirm(it) ? i : -1))
    .filter((i) => i >= 0);
}

function cartNeedsDesignModal(itemList) {
  return cartConfirmIndexes(itemList).length > 0;
}

/** Confirm should open on the item just edited or added, not always cart slot 0. */
function initialConfirmPreviewIndex(itemList) {
  const confirmIndexes = cartConfirmIndexes(itemList);
  if (!confirmIndexes.length) return 0;
  const focus = consumeToolsFocusCartIndex();
  if (focus != null) {
    const focusedPos = confirmIndexes.indexOf(focus);
    if (focusedPos >= 0) return focusedPos;
  }
  for (let i = confirmIndexes.length - 1; i >= 0; i -= 1) {
    const item = itemList[confirmIndexes[i]];
    if (itemHasLiveOverlayEdits(item) || item?.edited) return i;
  }
  return confirmIndexes.length - 1;
}

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [signedIn, setSignedIn] = useState(() => isShopperSignedIn());
  const [showAuthModal, setShowAuthModal] = useState(() => !isDemoStorefront() && !isShopperSignedIn());
  const [items, setItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [shipping, setShipping] = useState({ cost: 0, tax: 0, taxLabel: '', method: 'Standard Shipping', loading: false, error: '', calculated: false });
  const [stockError, setStockError] = useState('');
  const [address, setAddress] = useState({ country_code: readShipToCountry(), zip: '', state_code: '' });
  const shippingRef = useRef(shipping);
  // Design preferences modal – per-item orientation; tools live on /tools
  const [showDesignModal, setShowDesignModal] = useState(false);
  /** One entry per cart item: { orientation: ''|'portrait'|'landscape' } */
  const [designPreferences, setDesignPreferences] = useState([]);
  const designPreferencesRef = useRef([]);
  const [designPreviewIndex, setDesignPreviewIndex] = useState(0);
  const [previewMockups, setPreviewMockups] = useState({});
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  /** Set true when user completes design modal with "Continue to Checkout". Required before Place Order. */
  const [designConfirmed, setDesignConfirmed] = useState(false);
  const designModalShownOnLoadRef = useRef(false);
  const shippingSectionRef = useRef(null);
  const confirmClickLockRef = useRef(false);
  const [, startConfirmTransition] = useTransition();
  const [confirmPreviewReady, setConfirmPreviewReady] = useState(false);

  const scrollToShippingSection = useCallback(() => {
    // Wait for the design modal to unmount so layout height is correct.
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        shippingSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 80);
    });
  }, []);

  // Keep refs in sync with state
  useEffect(() => {
    shippingRef.current = shipping;
  }, [shipping]);
  useEffect(() => {
    designPreferencesRef.current = designPreferences;
  }, [designPreferences]);

  useEffect(() => {
    if (!isDemoStorefront() && !isShopperSignedIn()) {
      rememberAuthReturnPath('/checkout');
    }
  }, []);

  const loadCart = useCallback(() => {
    if (!signedIn) return;
    try {
      const parsed = readCartItems();
      const next = repriceCartItems(parsed, address.country_code);
      setItems(next);
      setSubtotal(next.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0));
      if (next.some((item, i) => item.price !== parsed[i].price)) {
        writeCartItems(next);
      }
    } catch (e) {
      setItems([]);
      setSubtotal(0);
    }
  }, [signedIn, address.country_code]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  useEffect(() => {
    window.addEventListener(CART_UPDATED_EVENT, loadCart);
    return () => window.removeEventListener(CART_UPDATED_EVENT, loadCart);
  }, [loadCart]);

  // Confirm Your Design for shirts, hoodies, and hats. Mugs, bags, pets, and accessories skip it.
  useEffect(() => {
    if (!signedIn || items.length === 0 || designModalShownOnLoadRef.current) return;
    designModalShownOnLoadRef.current = true;
    if (cartNeedsDesignModal(items)) {
      setShowDesignModal(true);
    } else {
      setDesignConfirmed(true);
    }
  }, [signedIn, items.length]);

  // When design modal opens, show Product Preview with the item's saved or default orientation.
  useEffect(() => {
    setCartPersistPaused(showDesignModal);
    return () => setCartPersistPaused(false);
  }, [showDesignModal]);

  useEffect(() => {
    if (!showDesignModal) {
      setConfirmPreviewReady(false);
      confirmClickLockRef.current = false;
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setConfirmPreviewReady(true);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [showDesignModal]);

  useEffect(() => {
    if (!showDesignModal) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [showDesignModal]);

  // When design modal opens, show Product Preview with the item's saved or default orientation.
  useEffect(() => {
    if (!showDesignModal) return;
    let latest = items;
    try {
      const parsed = readCartItems();
      if (Array.isArray(parsed) && parsed.length) {
        latest = repriceCartItems(parsed, address.country_code);
        setItems(latest);
        setSubtotal(latest.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0));
      }
    } catch {
      /* keep current items */
    }
    setDesignPreviewIndex(initialConfirmPreviewIndex(latest));
    setDesignPreferences((prev) => {
      if (!latest.length) return prev;
      return latest.map((it, i) => prev[i] || {
        orientation: resolveItemImageOrientation(it) || 'portrait',
      });
    });
  }, [showDesignModal]);

  useEffect(() => {
    if (!showDesignModal || !items.length) return undefined;
    let cancelled = false;
    const missing = items
      .map((it, i) => ({ i, name: it.name || it.product, image: it.image || it.img }))
      .filter((row) => row.name && !String(row.image || '').trim());
    if (!missing.length) {
      return undefined;
    }
    Promise.all(
      missing.map((row) =>
        fetch(apiJoin(`/api/product-preview-url?name=${encodeURIComponent(row.name)}`))
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => [row.i, (data && data.url) || ''])
          .catch(() => [row.i, ''])
      )
    ).then((pairs) => {
      if (cancelled) return;
      const next = {};
      pairs.forEach(([i, url]) => {
        if (url) next[i] = url;
      });
      setPreviewMockups(next);
    });
    return () => {
      cancelled = true;
    };
  }, [showDesignModal, items]);

  const confirmIndexesForPreview = cartConfirmIndexes(items);
  const previewCartIndexForShot = confirmIndexesForPreview.length
    ? confirmIndexesForPreview[Math.min(Math.max(0, designPreviewIndex), confirmIndexesForPreview.length - 1)]
    : -1;
  const previewItemForShot = previewCartIndexForShot >= 0 ? items[previewCartIndexForShot] : null;
  const confirmShotUrl = showDesignModal && confirmPreviewReady ? itemConfirmShotUrl(previewItemForShot) : '';
  const confirmDisplayShot = useDisplaySrc(confirmShotUrl, 360, showDesignModal && confirmPreviewReady, true);

  useEffect(() => {
    if (!showDesignModal || !confirmPreviewReady) return undefined;
    cartConfirmIndexes(items).forEach((idx, i) => {
      const url = itemConfirmShotUrl(items[idx]);
      if (url) prepareDisplaySrc(url, 360, { urgent: i === designPreviewIndex });
    });
    return undefined;
  }, [showDesignModal, confirmPreviewReady, items, designPreviewIndex]);

  // If destination changes, discard a prior quote so totals stay honest.
  useEffect(() => {
    setShipping((s) => {
      if (!s.calculated) return s;
      return { ...s, calculated: false, cost: 0, tax: 0, taxLabel: '', method: 'Standard Shipping', error: '' };
    });
  }, [address.zip, address.country_code, address.state_code]);

  useEffect(() => {
    const onShipTo = (event) => {
      const code = event?.detail?.country || readShipToCountry();
      setAddress((a) => (a.country_code === code ? a : { ...a, country_code: code, state_code: '' }));
    };
    window.addEventListener(SHIP_TO_UPDATED_EVENT, onShipTo);
    return () => window.removeEventListener(SHIP_TO_UPDATED_EVENT, onShipTo);
  }, []);

  useEffect(() => {
    if (!items.length) return;
    const next = repriceCartItems(items, address.country_code);
    if (next.some((item, i) => item.price !== items[i].price)) {
      setItems(next);
      writeCartItems(next);
      setSubtotal(next.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0));
    }
  }, [address.country_code, items.length]);

  useEffect(() => {
    if (!items.length) {
      setStockError('');
      return undefined;
    }
    let cancelled = false;
    const countryValue = String(address.country_code || 'US').trim();
    const run = async () => {
      const unavailable = [];
      await Promise.all(items.map(async (it) => {
        const product = it.product || it.name || '';
        const color = it.color || it.variants?.color || '';
        const size = it.size || it.variants?.size || '';
        if (!product || !size) return;
        try {
          const res = await fetch(apiJoin('/api/check-variant-availability'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product,
              color,
              size,
              variant_id: it.printful_variant_id ?? it.printify_variant_id ?? it.variant_id,
              country_code: countryValue,
            }),
          });
          if (!res.ok) {
            unavailable.push(`${product}${color || size ? ` (${[color, size].filter(Boolean).join(' / ')})` : ''}`);
            return;
          }
          const data = await res.json();
          if (!data?.success || data?.available !== true) {
            unavailable.push(`${product}${color || size ? ` (${[color, size].filter(Boolean).join(' / ')})` : ''}`);
          }
        } catch {
          unavailable.push(`${product}${color || size ? ` (${[color, size].filter(Boolean).join(' / ')})` : ''}`);
        }
      }));
      if (cancelled) return;
      if (unavailable.length) {
        const dest = CHECKOUT_COUNTRY_OPTIONS.find((o) => o.code === countryValue)?.name || countryValue;
        setStockError(`These selections are out of stock for shipping to ${dest}: ${unavailable.join('; ')}. Choose a different size or color.`);
        setShipping((s) => ({ ...s, calculated: false, cost: 0, tax: 0, error: '', loading: false }));
      } else {
        setStockError('');
      }
    };
    run();
    return () => { cancelled = true; };
  }, [address.country_code, items.map((it) => `${it.product || it.name}|${it.color}|${it.size}`).join('|')]);

  const fetchShipping = useCallback(async () => {
    if (items.length === 0) return;
    if (stockError) return;
    const countryValue = String(address.country_code || 'US').trim();
    if (needsStateForShipping(countryValue) && !hasStateSelected(address.state_code)) {
      setShipping((s) => ({ ...s, loading: false }));
      return;
    }
    setShipping(s => ({ ...s, loading: true, error: '' }));
    try {
      // Ensure clean ZIP and country (same format as checkout)
      const zipValue = String(address.zip || '').trim();
      const stateTrim = String(address.state_code || '').trim();
      const stateUpper = stateTrim ? stateTrim.toUpperCase().slice(0, 32) : '';
      
      const payload = {
        shipping_address: {
          zip: zipValue,
          country_code: countryValue,
          ...(stateUpper ? { state_code: stateUpper } : {}),
        },
        cart: items.map((it) => {
          const vid = it.printful_variant_id ?? it.printify_variant_id ?? it.variant_id;
          const qty = it.qty ?? it.quantity ?? 1;
          const line = {
            quantity: typeof qty === 'number' && !Number.isNaN(qty) ? Math.max(1, Math.floor(qty)) : 1,
            product: it.product || it.name || 'Item',
            color: it.color || '',
            size: it.size || '',
          };
          if (vid != null && vid !== '') {
            const n = Number(vid);
            if (!Number.isNaN(n)) {
              line.variant_id = n;
              line.printful_variant_id = n;
            }
          }
          return line;
        }),
      };
      console.log('🚀 Calling shipping API:', apiJoin('/api/calculate-shipping'));
      console.log('🚀 Payload:', payload);
      
      const res = await fetch(apiJoin('/api/calculate-shipping'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log('📦 Response status:', res.status);
      console.log('📦 Response URL:', res.url);
      
      // Handle 404 errors specifically
      if (res.status === 404) {
        throw new Error(`Shipping API endpoint not found (404). Please verify the backend is deployed and the endpoint exists at: ${apiJoin('/api/calculate-shipping')}`);
      }
      
      // Handle other error statuses
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ API Error Response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || `HTTP ${res.status}: ${res.statusText}` };
        }
        if (errorData?.code === 'SHIPPING_QUOTE_REJECTED') {
          const u = Array.isArray(errorData.unavailable_items) ? errorData.unavailable_items : [];
          const base = (errorData.error && String(errorData.error).trim())
            || 'Shipping could not be calculated. Check your ZIP code and state, then tap Calculate Shipping again.';
          if (u.length > 0) {
            throw new Error(
              `${base} If it keeps failing, try different options for: ${u.join(', ')}.`
            );
          }
          const action = (errorData.action && String(errorData.action).trim()) || '';
          throw new Error(action ? `${base} ${action}` : base);
        }
        if (errorData?.code === 'OUT_OF_STOCK') {
          const itemsList = Array.isArray(errorData.unavailable_items) ? errorData.unavailable_items : [];
          if (itemsList.length > 0) {
            throw new Error(
              `These options could not be used for shipping: ${itemsList.join(', ')}. `
              + 'Pick different sizes or colors, then calculate shipping again.'
            );
          }
          throw new Error(
            'Shipping could not be calculated. Check your ZIP code and state, then try again.'
          );
        }
        throw new Error(errorData.error || `API returned status ${res.status}`);
      }
      
      const data = await res.json();
      console.log('📦 Shipping calculation response:', data);
      console.log('📦 Response success:', data?.success);
      console.log('📦 Response shipping_cost:', data?.shipping_cost);
      console.log('📦 Response type:', typeof data?.shipping_cost);
      
      // Check if response indicates success
      if (data && data.success === true) {
        // Get shipping cost - handle different formats
        let shippingCost = data.shipping_cost;
        if (shippingCost === null || shippingCost === undefined) {
          // Try alternative field names
          shippingCost = data.cost || data.price || data.amount;
        }
        
        // Convert to number and validate
        shippingCost = parseFloat(shippingCost);
        
        console.log('📦 Parsed shipping cost:', shippingCost);
        console.log('📦 Is valid number?', !isNaN(shippingCost));
        console.log('📦 Is greater than 0?', shippingCost > 0);
        
        if (!isNaN(shippingCost) && shippingCost > 0) {
          console.log('✅ Shipping calculated successfully:', shippingCost);
          let fulfillmentTax = parseFloat(data.fulfillment_tax);
          if (isNaN(fulfillmentTax) || fulfillmentTax < 0) fulfillmentTax = 0;
          const newShippingState = { 
            cost: shippingCost, 
            tax: fulfillmentTax,
            taxLabel: data.fulfillment_tax_label || '',
            method: data.shipping_method || data.method || 'Standard Shipping', 
            loading: false, 
            error: '', 
            calculated: true 
          };
          console.log('✅ Setting shipping state:', newShippingState);
          setShipping(newShippingState);
          // Force update ref immediately
          setTimeout(() => {
            shippingRef.current = newShippingState;
            console.log('✅ Shipping ref updated:', shippingRef.current);
          }, 100);
        } else {
          // Success response but invalid cost
          const errorMsg = data?.error || `Invalid shipping cost received: ${data.shipping_cost}. Please verify your ZIP code and try again.`;
          console.error('❌ Shipping cost invalid:', shippingCost);
          console.error('❌ Full response:', data);
          const errorState = { 
            cost: 0,
            tax: 0,
            taxLabel: '',
            method: '', 
            loading: false, 
            error: errorMsg, 
            calculated: false 
          };
          setShipping(errorState);
          shippingRef.current = errorState;
        }
      } else {
        // Calculation failed or success is false
        const errorMsg = data?.error || 'Unable to calculate shipping. Please verify your ZIP code and try again.';
        console.error('❌ Shipping calculation failed:', errorMsg);
        console.error('❌ Response data:', data);
        console.error('❌ Response success field:', data?.success);
        const errorState = { 
          cost: 0,
          tax: 0,
          taxLabel: '',
          method: '', 
          loading: false, 
          error: errorMsg, 
          calculated: false 
        };
        setShipping(errorState);
        shippingRef.current = errorState;
      }
    } catch (e) {
      // Network error - do not allow checkout
      const msg = String(e?.message || '');
      const m = msg.toLowerCase();
      const isBizError = m.includes('shipping could not be calculated')
        || m.includes('these options could not be used')
        || m.includes('out of stock')
        || m.includes('could not calculate shipping');
      const errorMsg = isBizError
        ? msg
        : msg.includes('404') || msg.includes('Not found')
        ? 'Shipping API endpoint not found. The backend may not be deployed. Please contact support.'
        : `Network error: ${msg}. Please check your connection and try again.`;
      console.error('❌ Shipping calculation exception:', e);
      const errorState = { 
        cost: 0,
        tax: 0,
        taxLabel: '',
        method: '', 
        loading: false, 
        error: errorMsg, 
        calculated: false 
      };
      setShipping(errorState);
      shippingRef.current = errorState;
      // Don't show alert here - let the error display inline to avoid duplicate messages
    }
  }, [items, address, stockError]);

  // Auto-calculate shipping when ZIP (and US/CA state) look complete (debounced)
  useEffect(() => {
    const cc = String(address.country_code || 'US').trim();
    const zipOk = postalLooksComplete(cc, address.zip);
    const stateOk = !needsStateForShipping(cc) || hasStateSelected(address.state_code);
    if (zipOk && stateOk && !stockError && !shipping.calculated && !shipping.loading && items.length > 0) {
      console.log('⏱️ Auto-calculating shipping in 800ms for ZIP:', address.zip);
      const timer = setTimeout(() => {
        console.log('🚀 Triggering auto-calculate shipping...');
        fetchShipping();
      }, 800);
      return () => clearTimeout(timer);
    } else {
      console.log('⏸️ Skipping auto-calculate:', {
        hasZip: !!(address.zip && address.zip.trim()),
        zipOk,
        stateOk,
        calculated: shipping.calculated,
        loading: shipping.loading,
        itemsCount: items.length
      });
    }
  // Do not list shipping.loading here: when a quote fails, loading→false while calculated stays false,
  // which would retrigger this effect and spam /api/calculate-shipping (blinking error banner).
  }, [address.zip, address.country_code, address.state_code, items.length, shipping.calculated, fetchShipping]);

  /** Run actual checkout (build payload, POST, redirect). Call after design modal "Continue to Checkout". */
  const runCheckout = useCallback(async (cartOverride = null) => {
    if (isDemoStorefront()) return;
    if (stockError) {
      alert(stockError);
      return;
    }
    if (!isShopperSignedIn()) {
      setShowAuthModal(true);
      return;
    }
    const cartToUse = Array.isArray(cartOverride) ? cartOverride : items;
    const zipValue = String(address.zip || '').trim();
    const countryValue = String(address.country_code || 'US').trim();
    const stateTrim = String(address.state_code || '').trim();
    if (needsStateForShipping(countryValue) && !hasStateSelected(stateTrim)) {
      alert('Please select your state or province for shipping.');
      return;
    }
    const stateUpper = stateTrim ? stateTrim.toUpperCase().slice(0, 32) : '';
    const currentShipping = shippingRef.current;
    if (currentShipping.error || !currentShipping.calculated || !(Number(currentShipping.cost) > 0)) {
      alert(currentShipping.error || 'Please wait for shipping to be calculated before checkout.');
      return;
    }
    const shippingCost = currentShipping.cost || 0;
    const fulfillmentTax = currentShipping.tax || 0;

    let selectedScreenshot = null;
    for (const it of cartToUse) {
      selectedScreenshot = it.screenshot || it.selected_screenshot || it.thumbnail || it.img;
      if (selectedScreenshot && selectedScreenshot.trim()) break;
    }
    let screenshotTimestampFromStorage = null;
    try {
      const merchData = localStorage.getItem('pending_merch_data');
      if (merchData) {
        const parsed = JSON.parse(merchData);
        screenshotTimestampFromStorage = parsed.screenshot_timestamp ?? parsed.timestamp ?? null;
        if (!selectedScreenshot) {
          selectedScreenshot = parsed.edited_screenshot || parsed.selected_screenshot ||
            (parsed.screenshots && Array.isArray(parsed.screenshots) && parsed.screenshots.length > 0 ? parsed.screenshots[0] : null) ||
            parsed.thumbnail || null;
        }
      }
    } catch (e) { /* ignore */ }

    const stripeCart = cartToUse.map(it => {
      const itemScreenshot = it.screenshot || it.selected_screenshot || it.thumbnail || it.img;
      const finalScreenshot = itemScreenshot || selectedScreenshot || null;
      const cleanItem = {
        product: it.product || it.name,
        variants: { color: it.color || 'Default', size: it.size || 'Default' },
        color: it.color || '',
        size: it.size || '',
        price: it.price || 0,
        quantity: it.qty ?? it.quantity ?? 1,
        selected_screenshot: finalScreenshot,
        note: it.note || '',
        // Video frame position (seconds) for admin / fulfillment — same as order-level screenshot_timestamp when single item
        screenshot_timestamp: it.screenshot_timestamp ?? it.timestamp ?? screenshotTimestampFromStorage ?? null,
        timestamp: it.screenshot_timestamp ?? it.timestamp ?? screenshotTimestampFromStorage ?? null,
      };
      const vid = it.printful_variant_id ?? it.printify_variant_id ?? it.variant_id;
      if (vid != null && vid !== '') {
        const n = Number(vid);
        if (!Number.isNaN(n)) {
          cleanItem.variant_id = n;
          cleanItem.printful_variant_id = n;
        }
      }
      if (it.toolSettings && typeof it.toolSettings === 'object') {
        cleanItem.toolSettings = it.toolSettings;
      }
      const ori = resolveItemImageOrientation(it);
      if (ori === 'landscape' || ori === 'portrait') {
        cleanItem.image_orientation = ori;
        cleanItem.imageOrientation = ori;
        cleanItem.toolSettings = {
          ...(cleanItem.toolSettings || {}),
          imageOrientation: ori,
        };
      }
      if (it.originalScreenshot && String(it.originalScreenshot).trim()) {
        cleanItem.original_screenshot = it.originalScreenshot;
      }
      if (it.edited) {
        cleanItem.edited = true;
      }
      const itemListId = it.favorite_list_id || it.favoriteListId;
      if (itemListId && String(itemListId).trim()) {
        cleanItem.favorite_list_id = String(itemListId).trim();
      }
      return cleanItem;
    });

    const shippingAddress = { zip: zipValue, country_code: countryValue };
    if (stateUpper) shippingAddress.state_code = stateUpper;
    const userEmail = searchParams.get('email') || localStorage.getItem('user_email') || '';
    const payload = {
      shipping_address: shippingAddress,
      cart: stripeCart,
      product_id: cartToUse[0]?.product_id || cartToUse[0]?.id || null,
      sms_consent: false,
      shipping_cost: shippingCost,
      fulfillment_tax: fulfillmentTax,
      videoUrl: cartToUse[0]?.video_url || null,
      videoTitle: cartToUse[0]?.video_title || null,
      creatorName: cartToUse[0]?.creator_name || null,
      user_email: userEmail,
      screenshot_timestamp: cartToUse[0]?.screenshot_timestamp ?? screenshotTimestampFromStorage ?? null,
      timestamp: cartToUse[0]?.screenshot_timestamp ?? screenshotTimestampFromStorage ?? null,
    };
    if (selectedScreenshot) payload.selected_screenshot = selectedScreenshot;

    try {
      const fromCart = stripeCart
        .map((it) => it.favorite_list_id)
        .find((id) => id && String(id).trim());
      const fromStore = localStorage.getItem('sm_favorite_list_id');
      const flid = String(fromCart || fromStore || '').trim();
      if (flid) payload.favorite_list_id = flid;
    } catch (_) { /* ignore */ }

    if (!payload.shipping_address?.zip) {
      alert('⚠️ Error: Shipping address is missing. Please refresh and try again.');
      return;
    }

    setIsCheckoutLoading(true);
    const payloadJSON = JSON.stringify(payload);
    try {
      const res = await fetch(apiJoin('/api/create-checkout-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: payloadJSON,
      });
      if (!res.ok) {
        const errorText = await res.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch (e) { errorData = { error: errorText }; }
        throw new Error(errorData.error || errorData.message || `API returned status ${res.status}`);
      }
      const data = await res.json();
      if (data?.url) {
        try {
          writeCartItems([], { clearMerchIntent: true });
          localStorage.removeItem('cart');
          localStorage.removeItem('cartData');
          localStorage.removeItem('persistent_cart');
          Object.keys(localStorage).forEach(key => { if (key.toLowerCase().includes('cart') && key !== 'cart_items') localStorage.removeItem(key); });
          Object.keys(sessionStorage).forEach(key => { if (key.toLowerCase().includes('cart') && key !== 'cart_items') sessionStorage.removeItem(key); });
        } catch (err) { /* ignore */ }
        emitCartUpdated();
        window.location.href = data.url;
        return;
      }
      const res2 = await fetch(apiJoin('/api/place-order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: payloadJSON,
      });
      if (!res2.ok) {
        const errorText = await res2.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch (e) { errorData = { error: errorText }; }
        throw new Error(errorData.error || errorData.message || `API returned status ${res2.status}`);
      }
      const data2 = await res2.json();
      if (data2?.next_url) {
        try {
          writeCartItems([], { clearMerchIntent: true });
          localStorage.removeItem('cart');
          localStorage.removeItem('cartData');
          localStorage.removeItem('persistent_cart');
          Object.keys(localStorage).forEach(key => { if (key.toLowerCase().includes('cart') && key !== 'cart_items') localStorage.removeItem(key); });
          Object.keys(sessionStorage).forEach(key => { if (key.toLowerCase().includes('cart') && key !== 'cart_items') sessionStorage.removeItem(key); });
        } catch (err) { /* ignore */ }
        emitCartUpdated();
        window.location.href = data2.next_url;
      } else {
        alert(data?.error || data2?.error || 'Failed to start checkout');
      }
    } catch (e) {
      alert(`⚠️ Checkout error: ${e.message || 'Network error starting checkout'}`);
    } finally {
      setIsCheckoutLoading(false);
    }
  }, [items, address, searchParams]);

  const removeCartItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    setSubtotal(updated.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0));
    setDesignPreferences((prev) => prev.filter((_, i) => i !== index));
    writeCartItems(updated);
    setShipping((s) => ({ ...s, calculated: false, cost: 0, tax: 0, taxLabel: '', error: '' }));
    if (updated.length === 0) {
      setShowDesignModal(false);
      return;
    }
    if (!showDesignModal) return;
    const remainingConfirm = cartConfirmIndexes(updated);
    if (remainingConfirm.length === 0) {
      setShowDesignModal(false);
      setDesignConfirmed(true);
    } else {
      setDesignPreviewIndex((prev) => Math.min(prev, remainingConfirm.length - 1));
    }
  };

  const startEditCartItem = (index) => {
    const item = items[index];
    if (!item) return;
    const itemCategory = (item.category || localStorage.getItem('last_selected_category') || 'mens').trim() || 'mens';
    try {
      localStorage.setItem('last_selected_category', itemCategory);
    } catch {}
    setToolsFocusCartIndex(index);
    setToolsPreviewNewest(false);
    try {
      const shot = item.selected_screenshot || item.screenshot;
      if (shot) applySelectedScreenshot(shot);
    } catch {}
    setShowDesignModal(false);
    const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
    const userEmail = localStorage.getItem('user_email') || '';
    navigate(
      `/product/browse?category=${encodeURIComponent(itemCategory)}&authenticated=${isAuthenticated}&email=${encodeURIComponent(userEmail)}&editCart=${index}`
    );
  };

  return (
    <div className={`checkout-container${signedIn && items.length === 0 ? ' checkout-container--empty' : ''}`}>
      {isDemoStorefront() ? (
        <div className="checkout-sample-stop" role="status">
          <button
            type="button"
            className="checkout-sample-stop-back"
            aria-label="Back to products"
            onClick={() => {
              const idx = window.history.state?.idx;
              if (typeof idx === 'number' && idx > 0) {
                navigate(-1);
                return;
              }
              navigate('/merchandise');
            }}
          >
            ← Back
          </button>
          <p className="checkout-sample-stop-kicker">Sample storefront</p>
          <h1>These items are not for sale</h1>
          <p>
            Browse products and image tools page. Check out video snapshot tool, click Sign In to
            view dashboard tools.
          </p>
          <div className="checkout-sample-stop-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/')}>
              Main
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => navigate('/subscription-tiers', { state: { intent: 'creator' } })}
            >
              Claim a storefront
            </button>
          </div>
        </div>
      ) : (
      <>
      <AuthModal
        isOpen={showAuthModal}
        returnTo="/checkout"
        promptText="To view your cart and complete a purchase, please log in or create an account."
        onClose={() => {
          setShowAuthModal(false);
        }}
        onSuccess={() => {
          setSignedIn(true);
          setShowAuthModal(false);
        }}
      />
      {!signedIn ? (
        <div className="empty-cart checkout-signin-gate">
          <div className="empty-cart-icon">🛒</div>
          <h2>Sign in to check out</h2>
          <p>Your cart is saved. Sign in or create an account to finish your purchase.</p>
          <button type="button" className="btn-primary" onClick={() => setShowAuthModal(true)}>
            Sign in to continue
          </button>
        </div>
      ) : (
      <>
      {items.length === 0 ? (
        <div className="empty-cart">
          <div className="empty-cart-icon" aria-hidden="true">🛒</div>
          <h2>Your cart is empty</h2>
          <p>Add some items to your cart to continue</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/merchandise')}>Continue Shopping</button>
        </div>
      ) : (
        <>
      <div className="checkout-header">
        <h1>Checkout</h1>
        <div className="checkout-progress">
          <div className="progress-step active">1. Review</div>
          <div className="progress-step">2. Payment</div>
          <div className="progress-step">3. Complete</div>
        </div>
      </div>

        <div className="checkout-content">
          <div className="checkout-main">
            {/* Order Items */}
            <div className="order-section">
              <div className="order-section-header">
                <h2>Order Items</h2>
                <button 
                  className="back-to-cart-btn" 
                  onClick={() => {
                    // Navigate to product page with flag to open cart modal
                    const category = localStorage.getItem('last_selected_category') || 'mens';
                    const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
                    const userEmail = localStorage.getItem('user_email') || '';
                    navigate(`/product/browse?category=${encodeURIComponent(category)}&authenticated=${isAuthenticated}&email=${encodeURIComponent(userEmail)}&openCart=true`);
                  }}
                  aria-label="Back to Cart"
                >
                  <span className="back-to-cart-text">BACK TO CART</span>
                </button>
              </div>
              <div className="items-list">
                {items.map((ci, i) => {
                  // Get product image and screenshot separately (matching cart display)
                  const productImage = ci.image || ci.img;
                  const screenshot = itemShotUrl(ci);
                  
                  return (
                    <div key={i} className="item-card">
                      <div className="item-image-wrapper">
                        {productImage && (
                          <img
                            src={productImage}
                            alt={ci.name || ci.product}
                            decoding="async"
                          />
                        )}
                        <div className="item-variants">
                          {ci.color} • {ci.size}
                        </div>
                      </div>
                      <div className="item-info">
                        <h3 className="item-name">{ci.name || ci.product}</h3>
                        <div className="item-price">${(ci.price || 0).toFixed(2)}</div>
                      </div>
                      {screenshot ? (
                        <OrderItemShot
                          url={screenshot}
                          orientation={resolveItemImageOrientation(ci) || 'portrait'}
                          offsetX={ci.toolSettings?.imageOffsetX}
                          offsetY={ci.toolSettings?.imageOffsetY}
                          enabled={!showDesignModal}
                        />
                      ) : null}
                      <div className="item-card-actions">
                        <button
                          type="button"
                          className="item-edit-btn"
                          onClick={() => startEditCartItem(i)}
                          title="Edit item"
                          aria-label={`Edit ${ci.name || ci.product || 'item'}`}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="item-delete-btn"
                          onClick={() => removeCartItem(i)}
                          title="Remove item"
                          aria-label={`Remove ${ci.name || ci.product || 'item'} from cart`}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="checkout-mockup-remark">Product mockup, your item will be made in the color you selected.</p>
            </div>

            {/* Shipping Section */}
            <div
              className="order-section checkout-shipping-section"
              id="checkout-shipping"
              ref={shippingSectionRef}
            >
              <h2>Shipping Information</h2>
              <div className="shipping-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>ZIP / Postal Code</label>
                    <input 
                      type="text" 
                      placeholder="Enter ZIP code" 
                      value={address.zip} 
                      onChange={e => setAddress(a => ({ ...a, zip: e.target.value }))}
                      className="form-input"
                      aria-label="ZIP or Postal Code"
                      aria-describedby="zip-help"
                    />
                  </div>
                  <div className="form-group">
                    <label>Country</label>
                    <select 
                      value={address.country_code} 
                      onChange={e => {
                        const next = e.target.value;
                        writeShipToCountry(next);
                        setAddress(a => ({ ...a, country_code: next, state_code: '' }));
                      }}
                      className="form-select"
                      aria-label="Country"
                    >
                      {CHECKOUT_COUNTRY_OPTIONS.map(({ code, name }) => (
                        <option key={code} value={code}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  {needsStateForShipping(address.country_code) ? (
                    <div className="form-group">
                      <label>{address.country_code === 'CA' ? 'Province / Territory' : 'State'}</label>
                      <select
                        className="form-select"
                        value={address.state_code}
                        onChange={(e) => setAddress((a) => ({ ...a, state_code: e.target.value }))}
                        aria-label={address.country_code === 'CA' ? 'Province or territory' : 'State'}
                      >
                        <option value="">Select…</option>
                        {(address.country_code === 'CA' ? CA_PROVINCE_OPTIONS : US_STATE_OPTIONS).map(([code, name]) => (
                          <option key={code} value={code}>{name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Region <span style={{ fontWeight: 400, color: '#64748b' }}>(optional)</span></label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="State, county, or region"
                        value={address.state_code}
                        onChange={(e) => setAddress((a) => ({ ...a, state_code: e.target.value }))}
                        maxLength={32}
                        aria-label="Region optional"
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label>&nbsp;</label>
                    <button 
                      className="btn-primary" 
                      onClick={() => {
                        if (stockError) {
                          alert(stockError);
                          return;
                        }
                        if (!address.zip || !address.zip.trim()) {
                          alert('⚠️ Please enter your ZIP / Postal Code first.');
                          return;
                        }
                        const cc = String(address.country_code || 'US').trim();
                        if (needsStateForShipping(cc) && !hasStateSelected(address.state_code)) {
                          alert(address.country_code === 'CA'
                            ? 'Please select your province or territory before calculating shipping.'
                            : 'Please select your state before calculating shipping.');
                          return;
                        }
                        // Clear any previous errors before calculating
                        setShipping(s => ({ ...s, error: '', loading: true }));
                        fetchShipping();
                      }}
                      id="calc-shipping-btn" 
                      disabled={
                        shipping.loading
                        || !!stockError
                        || !address.zip
                        || !address.zip.trim()
                        || (needsStateForShipping(address.country_code) && !hasStateSelected(address.state_code))
                      }
                    >
                      {shipping.loading ? (
                        <>
                          <span className="loading-spinner"></span>
                          Calculating…
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: '1rem', marginRight: '6px' }}>🚚</span>
                          Calculate Shipping
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {stockError && (
                  <div className="error-message" style={{ 
                    background: '#f8d7da', 
                    color: '#721c24', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    marginTop: '10px',
                    border: '1px solid #f5c6cb'
                  }}>
                    {stockError}
                  </div>
                )}
                {shipping.error && !stockError && (
                  <div className="error-message" style={{ 
                    background: '#f8d7da', 
                    color: '#721c24', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    marginTop: '10px',
                    border: '1px solid #f5c6cb'
                  }}>
                    ❌ {shipping.error}
                  </div>
                )}
                {shipping.loading && (
                  <div style={{ 
                    background: '#d1ecf1', 
                    color: '#0c5460', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    marginTop: '10px',
                    border: '1px solid #bee5eb',
                    textAlign: 'center'
                  }}>
                    ⏳ Calculating shipping...
                  </div>
                )}
                {shipping.calculated && shipping.cost > 0 && (
                  <div className="shipping-result">
                    <div className="shipping-result-row">
                      <span className="shipping-method">✓ {shipping.method}</span>
                      <span className="shipping-cost">${shipping.cost.toFixed(2)}</span>
                    </div>
                    {(shipping.tax || 0) > 0 && (
                      <div className="shipping-result-row">
                        <span className="shipping-result-label">{shipping.taxLabel || 'Fulfillment tax'}</span>
                        <span className="shipping-cost">${shipping.tax.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
                {!shipping.calculated && !shipping.loading && !shipping.error && address.zip && address.zip.trim()
                  && needsStateForShipping(address.country_code) && !hasStateSelected(address.state_code) && (
                  <div style={{
                    color: '#856404',
                    padding: '8px',
                    fontSize: '0.9rem',
                    textAlign: 'center',
                  }}>
                    Select your {address.country_code === 'CA' ? 'province' : 'state'} for an accurate shipping quote.
                  </div>
                )}
                {!shipping.calculated && !shipping.loading && !shipping.error && address.zip && address.zip.trim()
                  && (!needsStateForShipping(address.country_code) || hasStateSelected(address.state_code)) && (
                  <div style={{ 
                    color: '#856404', 
                    padding: '8px', 
                    fontSize: '0.9rem',
                    textAlign: 'center'
                  }}>
                    ⚠️ Click "Calculate Shipping" or wait for auto-calculation...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="order-summary">
            <h2>Order Summary</h2>
            <div className="summary-line">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="summary-line">
              <span>Shipping</span>
              <span>${shipping.cost.toFixed(2)}</span>
            </div>
            {(shipping.tax || 0) > 0 && (
              <div className="summary-line">
                <span>{shipping.taxLabel || 'Fulfillment tax'}</span>
                <span>${shipping.tax.toFixed(2)}</span>
              </div>
            )}
            <div className="summary-line total">
              <span>Total</span>
              <span>${(subtotal + (shipping.cost || 0) + (shipping.tax || 0)).toFixed(2)}</span>
            </div>
            
            <div className="checkout-actions">
              <button className="btn-outline" onClick={() => navigate('/merchandise')}>
                Continue Shopping
              </button>
              <button 
                className="btn-primary btn-large" 
                disabled={
                  !!stockError
                  || !address.zip
                  || !address.zip.trim()
                  || shipping.loading
                  || isCheckoutLoading
                  || !!shipping.error
                  || !shipping.calculated
                  || !(Number(shipping.cost) > 0)
                  || (needsStateForShipping(address.country_code) && !hasStateSelected(address.state_code))
                }
                style={{
                  opacity: (stockError || !address.zip || !address.zip.trim() || shipping.loading || isCheckoutLoading
                    || !!shipping.error || !shipping.calculated || !(Number(shipping.cost) > 0)
                    || (needsStateForShipping(address.country_code) && !hasStateSelected(address.state_code)))
                    ? 0.5 : 1,
                  cursor: (stockError || !address.zip || !address.zip.trim() || shipping.loading || isCheckoutLoading
                    || !!shipping.error || !shipping.calculated || !(Number(shipping.cost) > 0)
                    || (needsStateForShipping(address.country_code) && !hasStateSelected(address.state_code)))
                    ? 'not-allowed' : 'pointer'
                }}
                title={stockError
                  ? stockError
                  : !address.zip || !address.zip.trim() 
                  ? 'Please enter ZIP code'
                  : (needsStateForShipping(address.country_code) && !hasStateSelected(address.state_code))
                  ? 'Please select state or province'
                  : shipping.loading
                  ? 'Calculating shipping...'
                  : shipping.error
                  ? shipping.error
                  : (!shipping.calculated || !(Number(shipping.cost) > 0))
                  ? 'Calculate shipping before checkout'
                  : 'Ready to checkout'}
                onClick={() => {
                // Require design preferences for shirts, hoodies, and hats. Other categories skip modal.
                if (!designConfirmed) {
                  if (cartNeedsDesignModal(items)) {
                    setShowDesignModal(true);
                    return;
                  }
                  setDesignConfirmed(true);
                }
                const zipInput = document.querySelector('input[aria-label="ZIP or Postal Code"]');
                const zipValue = String(zipInput?.value ?? address.zip ?? '').trim();
                const countryValue = String(address.country_code || 'US').trim();
                if (!zipValue) {
                  alert('⚠️ Please enter your ZIP / Postal Code before proceeding.');
                  return;
                }
                if (needsStateForShipping(countryValue) && !hasStateSelected(address.state_code)) {
                  alert(countryValue === 'CA'
                    ? '⚠️ Please select your province or territory before proceeding.'
                    : '⚠️ Please select your state before proceeding.');
                  return;
                }
                if (shipping.loading) {
                  alert('⚠️ Please wait for shipping calculation to complete.');
                  return;
                }
                runCheckout();
              }}>
                {isCheckoutLoading ? (
                  <>
                    <span className="loading-spinner"></span>
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <>
                    <span>Place Order</span>
                    <span className="btn-icon">→</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      {/* Design preferences – portaled to body so navbar cannot cover it */}
      {showDesignModal && cartConfirmIndexes(items).length > 0 && createPortal(
        <div className="design-modal-overlay" onClick={() => setShowDesignModal(false)}>
          <div className="design-modal design-modal--multi design-modal--preview" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="design-modal-close"
              aria-label="Close design preview"
              onClick={() => setShowDesignModal(false)}
            >
              ×
            </button>
            <h2>Confirm Your Design</h2>

            {(() => {
              const confirmIndexes = cartConfirmIndexes(items);
              const previewIndex = Math.min(Math.max(0, designPreviewIndex), confirmIndexes.length - 1);
              const previewCartIndex = confirmIndexes[previewIndex];
              const item = items[previewCartIndex];
              const itemName = item?.name || item?.product || `Item ${previewCartIndex + 1}`;
              const itemSize = (item?.size || '').trim();
              const mockupUrl = item?.image || item?.img || previewMockups[previewCartIndex] || '';
              const ts = item?.toolSettings && typeof item.toolSettings === 'object' ? item.toolSettings : {};
              const previewOrientation = (designPreferences[previewCartIndex]?.orientation === 'landscape')
                ? 'landscape'
                : 'portrait';
              return (
                <div className="design-modal-preview-card">
                  <h3 className="design-modal-preview-title">
                    Product Preview ({previewIndex + 1} of {confirmIndexes.length})
                  </h3>
                  <div className="design-modal-preview-name-row">
                    <div className="design-modal-preview-name">
                      <div>{itemName}</div>
                      {itemSize || item?.color ? (
                        <div className="design-modal-item-size">
                          {[item?.color, itemSize].filter(Boolean).join(' · ')}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className={`design-modal-preview-visual${confirmShotUrl && !confirmDisplayShot.src ? ' is-loading-shot' : ''}`}>
                    {mockupUrl ? (
                      confirmPreviewReady ? (
                      <ProductPreviewWithDrag
                        key={previewCartIndex}
                        productImage={mockupUrl}
                        screenshot={confirmDisplayShot.src}
                        productName={itemName}
                        productSize={item?.size}
                        offsetX={ts.offsetX || 0}
                        offsetY={ts.offsetY || 0}
                        onOffsetChange={noopPreviewOffset}
                        featherEdge={ts.featherEdge || 0}
                        cornerRadius={ts.cornerRadius || 0}
                        frameEnabled={Boolean(ts.frameEnabled)}
                        frameColor={ts.frameColor || '#FF0000'}
                        frameWidth={ts.frameWidth ?? 10}
                        doubleFrame={Boolean(ts.doubleFrame)}
                        printAreaFit={ts.printAreaFit || 'product'}
                        selectedProductName={itemName}
                        screenshotScale={ts.screenshotScale ?? 100}
                        imageOffsetX={ts.imageOffsetX || 0}
                        imageOffsetY={ts.imageOffsetY || 0}
                        imageOrientation={previewOrientation}
                        blackAndWhite={Boolean(ts.blackAndWhite)}
                        featherFadeEnabled={Boolean(ts.featherFadeEnabled)}
                        featherFadeColor={ts.featherFadeColor || 'white'}
                        textEnabled={Boolean(ts.textEnabled)}
                        textContent={ts.textContent || ''}
                        textFont={ts.textFont}
                        textColor={ts.textColor}
                        textSize={ts.textSize}
                        textOffsetX={ts.textOffsetX}
                        textOffsetY={ts.textOffsetY}
                        textDirection={ts.textDirection}
                        litePreview
                        sourceWidth={confirmDisplayShot.width}
                        sourceHeight={confirmDisplayShot.height}
                      />
                      ) : (
                        <img
                          className="design-modal-preview-fallback-shot"
                          src={mockupUrl}
                          alt={itemName}
                          decoding="async"
                        />
                      )
                    ) : (
                      <p className="design-modal-preview-empty">No preview available</p>
                    )}
                  </div>
                  <div className="design-modal-orient-row" role="group" aria-label="Image orientation">
                      <label className="design-modal-orient-check">
                        <input
                          type="checkbox"
                          checked={previewOrientation === 'portrait'}
                          onChange={() => {
                            setDesignPreferences((prev) => {
                              const next = prev.slice();
                              while (next.length <= previewCartIndex) next.push({ orientation: 'portrait' });
                              next[previewCartIndex] = { ...(next[previewCartIndex] || {}), orientation: 'portrait' };
                              return next;
                            });
                          }}
                        />
                        Portrait
                      </label>
                      <label className="design-modal-orient-check">
                        <input
                          type="checkbox"
                          checked={previewOrientation === 'landscape'}
                          onChange={() => {
                            setDesignPreferences((prev) => {
                              const next = prev.slice();
                              while (next.length <= previewCartIndex) next.push({ orientation: 'portrait' });
                              next[previewCartIndex] = { ...(next[previewCartIndex] || {}), orientation: 'landscape' };
                              return next;
                            });
                          }}
                        />
                        Landscape
                      </label>
                    </div>
                  <div className="design-modal-preview-nav">
                    <button
                      type="button"
                      className="design-modal-nav-btn"
                      disabled={previewIndex <= 0}
                      onClick={() => setDesignPreviewIndex((prev) => Math.max(0, prev - 1))}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="design-modal-text-action"
                      onClick={() => removeCartItem(previewCartIndex)}
                    >
                      Remove Item
                    </button>
                    <button
                      type="button"
                      className="design-modal-nav-btn"
                      disabled={previewIndex >= confirmIndexes.length - 1}
                      onClick={() => setDesignPreviewIndex((prev) => Math.min(confirmIndexes.length - 1, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              );
            })()}

            {(() => {
                const confirmIndexes = cartConfirmIndexes(items);
                const applyOrientationToCart = () => {
                const currentPrefs = designPreferencesRef.current;
                for (let i = 0; i < confirmIndexes.length; i += 1) {
                  const idx = confirmIndexes[i];
                  const chosen = (currentPrefs[idx] ?? {}).orientation;
                  if (chosen !== 'landscape' && chosen !== 'portrait') {
                    alert('Please choose Portrait or Landscape for your design.');
                    setDesignPreviewIndex(i);
                    return false;
                  }
                }
                const updated = items.map((it, idx) => {
                  if (!itemNeedsDesignConfirm(it)) return it;
                  const chosen = ((currentPrefs[idx] ?? {}).orientation);
                  return withItemImageOrientation(it, chosen);
                });
                setItems(updated);
                writeCartItems(updated);
                return updated;
              };
              const handleConfirm = () => {
                if (confirmClickLockRef.current) return;
                const previewIndex = Math.min(Math.max(0, designPreviewIndex), confirmIndexes.length - 1);
                if (previewIndex < confirmIndexes.length - 1) {
                  confirmClickLockRef.current = true;
                  startConfirmTransition(() => {
                    setDesignPreviewIndex((prev) => Math.min(prev + 1, confirmIndexes.length - 1));
                  });
                  window.setTimeout(() => {
                    confirmClickLockRef.current = false;
                  }, 280);
                  return;
                }
                confirmClickLockRef.current = true;
                if (!applyOrientationToCart()) {
                  confirmClickLockRef.current = false;
                  return;
                }
                setDesignConfirmed(true);
                setShowDesignModal(false);
                scrollToShippingSection();
              };
              const handleGoToTools = () => {
                if (!applyOrientationToCart()) return;
                setShowDesignModal(false);
                try {
                  const cart = readCartItems();
                  const previewIndex = Math.min(Math.max(0, designPreviewIndex), confirmIndexes.length - 1);
                  const previewCartIndex = confirmIndexes[previewIndex];
                  if (Array.isArray(cart) && cart.length > 0) {
                    setToolsFocusCartIndex(Math.min(previewCartIndex ?? 0, cart.length - 1));
                  }
                } catch (_) { /* ignore */ }
                navigate('/tools');
              };
              const isLast = designPreviewIndex >= confirmIndexes.length - 1;
              return (
                <div className="design-modal-footer">
                  <button type="button" className="design-modal-tools-btn" onClick={handleConfirm}>
                    {isLast ? 'Confirm' : 'Confirm and next'}
                  </button>
                  <div className="design-modal-actions">
                    <button type="button" className="btn-outline" onClick={() => setShowDesignModal(false)}>
                      Back
                    </button>
                    <button type="button" className="btn-primary" onClick={handleGoToTools}>
                      Customize Design
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      </>
      )}
      </>
      )}
      </>
      )}
    </div>
  );
};

export default Checkout;