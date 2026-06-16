/**
 * Syncs ScreenMerch dashboard "Save to" list target into extension storage
 * so FrameSnag opens the correct favorites page (incl. umbrella collaborators).
 */
(function () {
  function syncFramesnagTarget() {
    try {
      const path = window.location.pathname || '';
      if (!path.includes('dashboard')) return;
      const params = new URLSearchParams(window.location.search || '');
      if (params.get('tab') !== 'favorites') return;
      const listId = localStorage.getItem('screenmerch_framesnag_list_id');
      const origin = window.location.origin;
      const baseUrl = `${origin}/dashboard?tab=favorites`;
      const payload = { screenmerch_favorites_base_url: baseUrl };
      if (listId) payload.screenmerch_favorites_list_id = listId;
      chrome.storage.local.set(payload);
    } catch (e) {
      console.debug('[FrameSnag sync]', e);
    }
  }

  syncFramesnagTarget();
  window.addEventListener('storage', syncFramesnagTarget);
  setInterval(syncFramesnagTarget, 2000);
})();
