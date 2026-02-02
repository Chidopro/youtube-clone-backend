# Screenshot Not Saved – Files & Paths Reference

Use this list to compare or replace files from a **working** Print Quality / checkout flow. All paths are relative to the project root.

---

## Backend (saving & serving screenshot)

| Purpose | File path |
|--------|-----------|
| Checkout: receive cart, extract screenshot, save order + `selected_screenshot` | `backend/app.py` (around lines 3604–3940: `create_checkout_session`) |
| Get screenshot for Print Quality page | `backend/app.py` (around lines 5418–5570: `get_order_screenshot`) |
| Request body size limit (allow large base64 in cart) | `backend/app.py` (around line 286: `MAX_CONTENT_LENGTH`) |
| Order email: Video Info + **blue “View Order Details”** + **green “Generate Print Quality Images”** | `backend/app.py` (around lines 4454–4495: webhook email HTML) |
| DB migration: `selected_screenshot` + `screenshot_timestamp` columns | `backend/add_order_screenshot_column.sql` |
| Print Quality page (HTML + “Load Screenshot” + “No screenshot found” message) | `backend/templates/print_quality.html` |

---

## Frontend (capture & send screenshot)

| Purpose | File path |
|--------|-----------|
| Capture screenshots, timestamps, “Make Merch” → save to `pending_merch_data` (incl. `screenshot_timestamp`) | `frontend/src/Components/PlayVideo/PlayVideo.jsx` |
| Add to cart: include `screenshot`, `selected_screenshot`, `screenshot_timestamp` in cart item | `frontend/src/Pages/ProductPage/ProductPage.jsx` (e.g. `handleAddToCart`, videoMetadata, item shape) |
| Checkout: build payload with `cart[].selected_screenshot` and top-level `screenshot_timestamp` | `frontend/src/Pages/Checkout/Checkout.jsx` (payload and `stripeCart`) |
| Video page “Make Merch”: set `pending_merch_data` with `screenshot_timestamp` | `frontend/src/Pages/Video/Video.jsx` |

---

## Flow summary

1. **PlayVideo** → user captures frame → “Make Merch” → `pending_merch_data` (screenshots + `screenshot_timestamp`) in `localStorage`.
2. **ProductPage** → add to cart → cart item has `screenshot`, `selected_screenshot`, `screenshot_timestamp` (from `pending_merch_data`).
3. **Checkout** → payload: `cart` (each item with `selected_screenshot`) + `screenshot_timestamp` (and `timestamp`) at top level.
4. **Backend** `create_checkout_session` → reads cart, sets `checkout_screenshot`, builds `enriched_cart` and `order_data["selected_screenshot"]`, inserts into `orders` (and in-memory store).
5. **Backend** `get_order_screenshot` → loads order by `order_id`, returns `selected_screenshot` (order-level) or screenshot from `cart` items.
6. **Print Quality page** → calls `/api/get-order-screenshot/<order_id>`, shows image or “No screenshot found in order”.

---

## Fixes applied in this project

- **Backend**
  - `MAX_CONTENT_LENGTH = 16 MB` so large checkout payloads (base64 screenshots) are accepted.
  - `get_order_screenshot`: only return success when there is a non-empty screenshot; otherwise 404 with a clear error and extra logging.
- **Email**
  - Kept **blue “View Order Details”** and **green “Generate Print Quality Images”** buttons in the webhook email (in `backend/app.py` around 4469–4485).
- **DB**
  - Migration adds `selected_screenshot` and `screenshot_timestamp`; run `backend/add_order_screenshot_column.sql` if not already done.

---

## If you have a working “print tools generator” folder

From the **working** project, copy or diff these paths into this project:

**Backend**

- `backend/app.py` (create_checkout_session, get_order_screenshot, webhook email block, MAX_CONTENT_LENGTH)
- `backend/templates/print_quality.html`
- `backend/add_order_screenshot_column.sql` (or your equivalent migration)

**Frontend**

- `frontend/src/Components/PlayVideo/PlayVideo.jsx`
- `frontend/src/Pages/ProductPage/ProductPage.jsx`
- `frontend/src/Pages/Checkout/Checkout.jsx`
- `frontend/src/Pages/Video/Video.jsx`

Then:

1. Run the migration on the DB used by this app.
2. Redeploy backend and frontend.
3. Place a **new** test order (capture screenshot → add to cart → checkout) and open the Print Quality link from the order email to confirm the screenshot loads.
