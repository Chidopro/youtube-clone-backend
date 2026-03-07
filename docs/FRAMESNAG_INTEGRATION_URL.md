# FrameSnag → ScreenMerch: Correct URL for "Add to Favorites"

## URL to use in FrameSnag

When the creator clicks **"Add to Favorites"** in the FrameSnag extension, open this URL (not `/favorites`):

```
https://screenmerch.com/dashboard?tab=favorites
```

**Why:** The creator Favorites **management** page (where they add/edit favorites) is the **Dashboard** with the Favorites tab. The route `/favorites` is the public view of a creator's favorites (e.g. on a subdomain). So FrameSnag should open the dashboard with the Favorites tab selected.

## Update in FrameSnag

In `popup-lite.js` (or wherever the constant is defined), set:

```js
const SCREENMERCH_FAVORITES_URL = 'https://screenmerch.com/dashboard?tab=favorites';
```

## What ScreenMerch does when the tab opens

1. **Dashboard** reads `?tab=favorites` and opens the **Favorites** tab.
2. **Paste support:** When the creator is on the Favorites tab, they can press **Ctrl+V** (or Cmd+V). If the clipboard contains an image (e.g. from FrameSnag), the "Add Favorite" modal opens with that image so they can add a title and save.

No API or auth is required from FrameSnag; only clipboard + opening this URL.
