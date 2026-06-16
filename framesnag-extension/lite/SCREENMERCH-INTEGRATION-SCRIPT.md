# FrameSnag → ScreenMerch Integration – Script for ScreenMerch Chat

Use this in the ScreenMerch folder chat to explain what’s new and what ScreenMerch needs to implement.

---

## What We Did (New in FrameSnag)

### 1. "Add to Favorites" button

- **Where:** FrameSnag Chrome extension popup.
- **When:** After a creator captures a **thumbnail** or a **screenshot** from a YouTube video.
- **What we added:**
  - **Thumbnail:** Next to "Download" and "Delete" there is now a teal **"Add to Favorites"** button.
  - **Screenshots:** Each captured screenshot has three buttons: **"Add to Favorites"**, **"Download"**, **"Delete"**.

### 2. What "Add to Favorites" does (FrameSnag side)

When the creator clicks **"Add to Favorites"**:

1. **Clipboard:** FrameSnag copies the image (PNG) to the system clipboard.
2. **New tab:** FrameSnag opens the ScreenMerch creator Favorites page in a new browser tab.

So the creator lands on the Favorites page with the image already in the clipboard, ready to paste or upload.

### 3. URL used in FrameSnag

FrameSnag opens this URL when "Add to Favorites" is clicked:

```text
https://screenmerch.com/dashboard?tab=favorites
```

If this URL changes (e.g. `/creator/favorites`, `/dashboard/favorites`, or a different domain), tell us the exact URL and we’ll update the constant in FrameSnag.

---

## Code in FrameSnag (for reference)

**Constant (popup-lite.js):**

```javascript
// ScreenMerch creator Favorites page – change if your URL is different
const SCREENMERCH_FAVORITES_URL = 'https://screenmerch.com/dashboard?tab=favorites';
```

**Behavior when "Add to Favorites" is clicked:**

```javascript
// Copy image (data URL) to clipboard and open ScreenMerch Favorites in new tab
async function addToFavorites(imageDataUrl) {
  if (!imageDataUrl) return;
  try {
    const res = await fetch(imageDataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    chrome.tabs.create({ url: SCREENMERCH_FAVORITES_URL });
  } catch (err) {
    console.error('Clipboard or tab error:', err);
    chrome.tabs.create({ url: SCREENMERCH_FAVORITES_URL });
  }
}
```

So: no API key, no auth, no POST from FrameSnag. Only **clipboard + open URL**.

---

## What ScreenMerch Needs to Do (connections to ScreenMerch)

### Required

1. **Confirm Favorites URL**
   - Tell us the exact URL of the **creator Favorites page** (where creators manage favorites for customers to use on products).
   - We’ll set `SCREENMERCH_FAVORITES_URL` in FrameSnag to that URL so "Add to Favorites" opens the right page.

### Recommended (best experience)

2. **Paste / upload on Favorites page**
   - On the Favorites page, support at least one of:
     - **Paste:** e.g. "Paste from FrameSnag (Ctrl+V)" and handle `paste` events to accept an image from the clipboard and add it as a favorite.
     - **Upload:** "Upload image" so the creator can paste (Ctrl+V) into a file input or drop the image.
   - That way, when FrameSnag opens the Favorites tab and has already put the image in the clipboard, the creator can paste once and the image is added to Favorites.

**Example (conceptual) for paste on Favorites page:**

```javascript
// On the ScreenMerch Favorites page (when you want to support paste-from-FrameSnag)
document.addEventListener('paste', async (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type === 'image/png' || item.type.startsWith('image/')) {
      e.preventDefault();
      const blob = item.getAsFile();
      // Upload blob to your backend and add to Favorites, then refresh the list
      // await yourApi.addFavoriteFromBlob(blob);
      break;
    }
  }
});
```

(You’d replace `yourApi.addFavoriteFromBlob` with your real API and UI update.)

### Optional (later)

3. **Direct add via URL param**
   - If you add an endpoint that accepts an image (e.g. upload and redirect to Favorites with the new item), we could change FrameSnag to POST the image to that endpoint and then open the Favorites URL. That would require:
     - ScreenMerch: new endpoint (e.g. `POST /api/creator/favorites/from-framesnag` or similar) and auth if needed.
     - FrameSnag: use `fetch` to POST the image, then `chrome.tabs.create` with the Favorites URL.
   - For now, **clipboard + open URL** is enough; this can be a later improvement.

---

## Summary for ScreenMerch chat

**Script you can paste:**

- FrameSnag now has an **"Add to Favorites"** button next to each thumbnail and screenshot.
- Clicking it **copies the image to the clipboard** and **opens the ScreenMerch creator Favorites page** in a new tab (`https://screenmerch.com/dashboard?tab=favorites` unless we’re told a different URL).
- ScreenMerch needs to:
  1. Confirm the correct Favorites page URL so we can set it in FrameSnag.
  2. On that Favorites page, support **paste** (and/or upload) so creators can paste the FrameSnag image (Ctrl+V) and add it to Favorites in one step.
- No API keys or auth are used from FrameSnag; the only “connection” is opening your URL and putting the image on the clipboard. Optional later: an upload API so FrameSnag can POST the image and then open the Favorites page.

---

*Document generated for the ScreenMerch folder chat. Update the Favorites URL in FrameSnag when ScreenMerch confirms it.*
