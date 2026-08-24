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

/** Stable id for a merch source (video URL and/or first gallery shot). */
function sourceIdentity(data) {
  if (!data || typeof data !== 'object') return '';
  const video = normalizeVideoUrl(data.videoUrl || data.video_url || '');
  const shot = (Array.isArray(data.screenshots) && data.screenshots[0]) || data.thumbnail || '';
  if (!shot) return video;
  const shotKey = String(shot).startsWith('data:')
    ? `data:${String(shot).length}:${String(shot).slice(0, 80)}`
    : String(shot).slice(0, 240);
  return video ? `${video}::${shotKey}` : `image:${shotKey}`;
}

export const PENDING_MERCH_UPDATED_EVENT = 'screenmerch-pending-merch-updated';

export function emitPendingMerchUpdated() {
  try {
    window.dispatchEvent(new Event(PENDING_MERCH_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

function persistPendingObject(clean) {
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
  emitPendingMerchUpdated();
  return packed.clean;
}

function clearToolsPageState() {
  try {
    localStorage.removeItem('tools_page_state');
    localStorage.removeItem('tools_focus_cart_index');
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem('tools_page_state');
    sessionStorage.removeItem('tools_focus_cart_index');
  } catch {
    /* ignore */
  }
}

/**
 * Drop the working Tools/cart screenshot so Tools stays empty until a new
 * screenshot is chosen. Keeps video metadata and the picker gallery.
 */
export function clearWorkingScreenshot() {
  clearToolsPageState();
  let prev = pendingMerchMemory;
  if (!prev || typeof prev !== 'object') {
    try {
      const fromSession = JSON.parse(sessionStorage.getItem('pending_merch_data') || 'null');
      if (fromSession && typeof fromSession === 'object') prev = fromSession;
    } catch {
      /* ignore */
    }
  }
  if (!prev || typeof prev !== 'object') {
    try {
      const fromLocal = JSON.parse(localStorage.getItem('pending_merch_data') || 'null');
      if (fromLocal && typeof fromLocal === 'object') prev = fromLocal;
    } catch {
      /* ignore */
    }
  }
  if (!prev || typeof prev !== 'object') {
    if (pendingMerchMemory && typeof pendingMerchMemory === 'object') {
      delete pendingMerchMemory.edited_screenshot;
      delete pendingMerchMemory.selected_screenshot;
    }
    return;
  }
  const next = { ...prev };
  delete next.edited_screenshot;
  delete next.selected_screenshot;
  persistPendingObject(next);
}

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
    const prevId = sourceIdentity(prev);
    const nextId = sourceIdentity(clean);
    const sourceChanged = videoChanged || Boolean(prevId && nextId && prevId !== nextId);
    const incomingHadSelected = Boolean(merchData?.selected_screenshot);
    const incomingHadEdited = Boolean(merchData?.edited_screenshot);
    const isFreshPickerSession = !incomingHadSelected && !incomingHadEdited;

    if (sourceChanged || isFreshPickerSession) {
      clearToolsPageState();
    }

    if (videoChanged) {
      try {
        const cart = readCartItems();
        const kept = (Array.isArray(cart) ? cart : []).filter((item) => {
          const itemUrl = normalizeVideoUrl(item.video_url || item.videoUrl || '');
          return itemUrl && itemUrl === nextUrl;
        });
        writeCartItems(kept);
      } catch {
        /* ignore cart cleanup errors */
      }
    }

    if (sourceChanged || isFreshPickerSession || !incomingHadEdited) {
      delete clean.edited_screenshot;
    }
    if (sourceChanged || isFreshPickerSession) {
      if (!incomingHadSelected) delete clean.selected_screenshot;
    }

    persistPendingObject(clean);
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

  let fromSession = null;
  let fromLocal = null;
  try {
    fromSession = parse(sessionStorage.getItem('pending_merch_data'));
  } catch {
    /* ignore */
  }
  try {
    fromLocal = parse(localStorage.getItem('pending_merch_data'));
  } catch {
    /* ignore */
  }
  const stored = (hasShots(fromSession) ? fromSession : null) || (hasShots(fromLocal) ? fromLocal : null);

  // Dashboard/Favorites may write storage without updating in-memory cache.
  if (pendingMerchMemory && stored) {
    const memId = sourceIdentity(pendingMerchMemory);
    const storeId = sourceIdentity(stored);
    if (storeId && memId && storeId !== memId) {
      pendingMerchMemory = stored;
    }
  }

  if (hasShots(pendingMerchMemory)) return pendingMerchMemory;
  if (stored) return stored;
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
  clearToolsPageState();
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

function parseCartArray(raw) {
  if (raw == null || raw === '') return null;
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function persistCartStore(store, json, isEmpty) {
  try {
    if (isEmpty) store.removeItem('cart_items');
    else store.setItem('cart_items', json);
    return true;
  } catch {
    try {
      if (isEmpty) store.removeItem('cart_items');
    } catch {
      /* ignore */
    }
    return false;
  }
}

export function readCartItems() {
  if (Array.isArray(cartItemsMemory)) return cartItemsMemory;
  let fromLocal = null;
  let localKeyExists = false;
  try {
    const raw = localStorage.getItem('cart_items');
    localKeyExists = raw != null;
    fromLocal = parseCartArray(raw);
  } catch {
    /* ignore */
  }
  let fromSession = null;
  try {
    fromSession = parseCartArray(sessionStorage.getItem('cart_items'));
  } catch {
    /* ignore */
  }

  // Phone refresh bug: writeCartItems used to persist [] to localStorage only,
  // so sessionStorage kept the old cart (and Tools reloaded the old shot).
  if (localKeyExists && Array.isArray(fromLocal) && fromLocal.length === 0) {
    if (Array.isArray(fromSession) && fromSession.length > 0) {
      try {
        sessionStorage.removeItem('cart_items');
      } catch {
        /* ignore */
      }
    }
    return [];
  }
  if (Array.isArray(fromLocal) && fromLocal.length > 0) return fromLocal;
  if (Array.isArray(fromSession)) return fromSession;
  if (Array.isArray(fromLocal)) return fromLocal;
  return [];
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
  const prevLen = Array.isArray(cartItemsMemory)
    ? cartItemsMemory.length
    : readCartItems().length;
  cartItemsMemory = Array.isArray(items) ? items : [];
  const isEmpty = cartItemsMemory.length === 0;
  const json = JSON.stringify(cartItemsMemory);
  const localOk = persistCartStore(localStorage, json, isEmpty);
  persistCartStore(sessionStorage, json, isEmpty);
  // Quota failed on localStorage: drop a stale [] so read() can use session.
  if (!isEmpty && !localOk) {
    try {
      localStorage.removeItem('cart_items');
    } catch {
      /* ignore */
    }
  }
  if (prevLen > 0 && isEmpty) {
    clearWorkingScreenshot();
  }
  emitCartUpdated();
}
