# Saved place: Screenshot edits & Tools page

**Last updated:** When switching to creator signup agreement work.

## Where we left off (Edit Tools / screenshot edits)

- **Problem:** When the user selected the second (or next) screenshot in "Select Product From Cart", the previous product's edits were persisting (same edited image, fit, scale, etc.).
- **Location:** `frontend/src/Pages/ToolsPage/ToolsPage.jsx` (and related order email in `backend/services/order_email.py`).

## What was implemented

1. **Per-slot edit state**
   - `slotStateRef` stores edit state per cart product index (editedImageUrl, screenshotScale, selectedProductName, printAreaFit, imageOffsetX/Y, printQualityImageUrl/Meta, offsetX/Y).
   - When switching "Select Product From Cart": save current slot to `slotStateRef.current[oldIndex]`, then set `selectedCartProductIndex(newIndex)`.
   - In the loadScreenshot effect (cart-product branch): load from `slotStateRef.current[selectedCartProductIndex]` or set defaults (clean slate).

2. **No localStorage when opened from order link**
   - If URL has `order_id`, we do not restore or save `tools_page_state` in localStorage so email "Edit Tools" links always start with a clean session.

3. **Apply-edits race fix**
   - `switchingSlotRef`: set to `true` when the user changes the cart product dropdown so the apply-edits effect does not run with stale imageUrl and overwrite editedImageUrl with the previous product's result.
   - In the apply-edits effect: `if (switchingSlotRef.current) return;`
   - At the end of the loadScreenshot cart-product branch: `setTimeout(() => { switchingSlotRef.current = false; setSlotSwitchTick(t => t + 1); }, 0);` so the apply-edits effect runs again on the next tick with the new image.
   - `slotSwitchTick` is in the apply-edits effect dependency array so it re-runs after the switch and applies edits to the new screenshot only.

## Key symbols in ToolsPage.jsx

- `slotStateRef`, `switchingSlotRef`, `slotSwitchTick`
- Cart product dropdown `onChange`: save to slotStateRef, set switchingSlotRef.current = true, setSelectedCartProductIndex
- loadScreenshot effect: when loading from cart product, set imageUrl and then either load from slotStateRef or set defaults; then setTimeout to clear switchingSlotRef and bump slotSwitchTick
- Apply-edits effect: early return if switchingSlotRef.current; deps include slotSwitchTick

## If we need to continue from here

- Any new bug like "edits still carrying over" should be checked against: (1) slot state save/load, (2) switchingSlotRef and effect order, (3) whether order_id flow skips localStorage.
