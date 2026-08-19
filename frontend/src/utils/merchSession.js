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

export function savePendingMerchData(merchData) {
  try {
    let prev = null;
    try {
      const prevRaw = localStorage.getItem('pending_merch_data');
      prev = prevRaw ? JSON.parse(prevRaw) : null;
    } catch {
      prev = null;
    }

    const prevUrl = normalizeVideoUrl(prev?.videoUrl || prev?.video_url || '');
    const nextUrl = normalizeVideoUrl(merchData?.videoUrl || merchData?.video_url || '');
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

    const clean = { ...merchData };
    // Fresh video session should not keep an edited image from a prior tools visit
    if (videoChanged || !clean.edited_screenshot) {
      delete clean.edited_screenshot;
    }

    localStorage.setItem('pending_merch_data', JSON.stringify(clean));
  } catch (e) {
    console.warn('Failed saving pending_merch_data:', e);
  }
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

export const CART_UPDATED_EVENT = 'screenmerch-cart-updated';

export function getCartItemCount() {
  try {
    const items = JSON.parse(localStorage.getItem('cart_items') || '[]');
    return Array.isArray(items) ? items.length : 0;
  } catch {
    return 0;
  }
}

export function emitCartUpdated() {
  try {
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export function writeCartItems(items) {
  try {
    localStorage.setItem('cart_items', JSON.stringify(Array.isArray(items) ? items : []));
  } catch {
    /* ignore */
  }
  emitCartUpdated();
}
