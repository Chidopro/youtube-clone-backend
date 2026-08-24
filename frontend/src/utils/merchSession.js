/**
 * Persist Make Merch / screenshot session data.
 * When the user switches to a different video, clear leftover cart items,
 * tools page state, and edited screenshots from the previous video.
 */
export function normalizeVideoUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url, window.location.origin);
    return `${u.origin}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return url.split('?')[0].replace(/\/$/, '');
  }
}

let pendingMerchMemory = null;
let cartItemsMemory = null;

const PENDING_JSON_BUDGET = 2.2 * 1024 * 1024;

function compactMerchData(data) {
  const clean = { ...(data || {}) };
  let json = JSON.stringify(clean);
  if (json.length <= PENDING_JSON_BUDGET) return { clean, json };
  const shots = Array.isArray(clean.screenshots) ? clean.screenshots.filter(Boolean) : [];
  const keep = clean.selected_screenshot || shots[0] || clean.thumbnail || '';
  clean.screenshots = keep ? [keep] : [];
  if (clean.thumbnail && String(clean.thumbnail).startsWith('data:') && clean.thumbnail !== keep) {
    clean.thumbnail = keep;
  }
  json = JSON.stringify(clean);
  return { clean, json };
}

export function savePendingMerchData(merchData) {
  const clean = { ...(merchData || {}) };
  try {
    let prev = pendingMerchMemory;
    if (!prev) {
      try {
        const prevRaw = localStorage.getItem('pending_merch_data');
        prev = prevRaw ? JSON.parse(prevRaw) : null;
      } catch {
        prev = null;
      }
    }
    if (!prev) {
      try {
        const prevRaw = sessionStorage.getItem('pending_merch_data');
        prev = prevRaw ? JSON.parse(prevRaw) : null;
      } catch {
        prev = null;
      }
    }

    const prevUrl = normalizeVideoUrl(prev?.videoUrl || prev?.video_url || '');
    const nextUrl = normalizeVideoUrl(clean?.videoUrl || clean?.video_url || '');
    const videoChanged = Boolean(prevUrl && nextUrl && prevUrl !== nextUrl);

    if (videoChanged) {
      localStorage.removeItem('tools_page_state');
      localStorage.removeItem('tools_focus_cart_index');
      try {
        const cart = JSON.parse(localStorage.getItem('cart_items') || '[]');
        const kept = (Array.isArray(cart) ? cart : []).filter((item) => {
          const itemUrl = normalizeVideoUrl(item.video_url || item.videoUrl || '');
          return itemUrl && itemUrl === nextUrl;
        });
        localStorage.setItem('cart_items', JSON.stringify(kept));
        emitCartUpdated();
      } catch {
        /* ignore cart cleanup errors */
      }
    }

    if (videoChanged || !clean.edited_screenshot) {
      delete clean.edited_screenshot;
    }

    const packed = compactMerchData(clean);
    pendingMerchMemory = packed.clean;
    const json = packed.json;
    try {
      localStorage.setItem('pending_merch_data', json);
    } catch {
      try {
        localStorage.removeItem('pending_merch_data');
      } catch {
        /* ignore */
      }
    }
    try {
      sessionStorage.setItem('pending_merch_data', json);
    } catch {
      /* memory still has the screenshots for this tab */
    }
  } catch (e) {
    console.warn('Failed saving pending_merch_data:', e);
    pendingMerchMemory = merchData && typeof merchData === 'object' ? merchData : pendingMerchMemory;
    try {
      sessionStorage.setItem('pending_merch_data', JSON.stringify(merchData));
    } catch {
      /* ignore */
    }
  }
}

export function readPendingMerchData() {
  const parse = (raw) => {
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : null;
    } catch {
      return null;
    }
  };
  const hasShots = (data) =>
    Boolean(
      data &&
        (data.screenshots?.length ||
          data.selected_screenshot ||
          data.edited_screenshot ||
          data.thumbnail)
    );

  if (hasShots(pendingMerchMemory)) return pendingMerchMemory;

  try {
    const fromSession = parse(sessionStorage.getItem('pending_merch_data'));
    if (hasShots(fromSession)) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    const fromLocal = parse(localStorage.getItem('pending_merch_data'));
    if (hasShots(fromLocal)) return fromLocal;
  } catch {
    /* ignore */
  }
  return pendingMerchMemory || {};
}

/** Focus Tools on a specific cart item (original cart index). */
export function setToolsFocusCartIndex(originalCartIndex) {
  try {
    if (originalCartIndex == null || Number.isNaN(Number(originalCartIndex))) {
      localStorage.removeItem('tools_focus_cart_index');
      return;
    }
    localStorage.setItem('tools_focus_cart_index', String(originalCartIndex));
  } catch {
    /* ignore */
  }
}

export function consumeToolsFocusCartIndex() {
  try {
    const raw = localStorage.getItem('tools_focus_cart_index');
    localStorage.removeItem('tools_focus_cart_index');
    if (raw == null || raw === '') return null;
    const idx = parseInt(raw, 10);
    return Number.isNaN(idx) ? null : idx;
  } catch {
    return null;
  }
}

export function peekToolsFocusCartIndex() {
  try {
    const raw = localStorage.getItem('tools_focus_cart_index');
    if (raw == null || raw === '') return null;
    const idx = parseInt(raw, 10);
    return Number.isNaN(idx) ? null : idx;
  } catch {
    return null;
  }
}

/** Replace the working screenshot and drop the previous Tools edit. */
export function applySelectedScreenshot(url) {
  if (!url || typeof url !== 'string') return;
  const prev = readPendingMerchData() || {};
  const oldShot = prev.selected_screenshot || prev.edited_screenshot || '';
  const next = { ...prev, selected_screenshot: url };
  delete next.edited_screenshot;
  savePendingMerchData(next);

  try {
    const cart = readCartItems();
    if (!Array.isArray(cart) || cart.length === 0) return;

    let idx = peekToolsFocusCartIndex();
    if (idx == null || !cart[idx]) {
      idx = cart.findIndex(
        (item) =>
          item &&
          (item.screenshot === oldShot ||
            item.selected_screenshot === oldShot ||
            item.screenshot === prev.selected_screenshot ||
            item.screenshot === prev.edited_screenshot)
      );
    }
    if (idx < 0 && cart.length === 1) idx = 0;
    if (idx < 0 || !cart[idx]) return;

    const nextCart = cart.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, screenshot: url, selected_screenshot: url };
      if (updated.toolSettings) {
        updated.toolSettings = { ...updated.toolSettings, editedImageUrl: '', screenshot: url };
      }
      return updated;
    });
    writeCartItems(nextCart);
    setToolsFocusCartIndex(idx);
  } catch {
    /* ignore */
  }
}

export const CART_UPDATED_EVENT = 'screenmerch-cart-updated';

export function readCartItems() {
  if (Array.isArray(cartItemsMemory)) return cartItemsMemory;
  try {
    const fromSession = JSON.parse(sessionStorage.getItem('cart_items') || 'null');
    if (Array.isArray(fromSession)) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    const fromLocal = JSON.parse(localStorage.getItem('cart_items') || '[]');
    return Array.isArray(fromLocal) ? fromLocal : [];
  } catch {
    return [];
  }
}

export function getCartItemCount() {
  return readCartItems().length;
}

export function emitCartUpdated() {
  try {
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export function writeCartItems(items) {
  cartItemsMemory = Array.isArray(items) ? items : [];
  const json = JSON.stringify(cartItemsMemory);
  try {
    localStorage.setItem('cart_items', json);
  } catch {
    try {
      sessionStorage.setItem('cart_items', json);
    } catch {
      /* memory still has the cart for this tab */
    }
  }
  emitCartUpdated();
}
