# Order Email Sources

Order confirmation emails (admin and customer) are built in **one place** so that layout, screenshot handling, and buttons stay consistent.

## Single source of truth

- **Module:** `backend/services/order_email.py`
- **Functions:**
  - `build_admin_order_email(...)` – admin notification HTML + attachments
  - `build_customer_order_email(...)` – customer confirmation HTML (no attachments)
  - `resend_attachments_from_builder(attachments)` – convert builder attachments to Resend API format

**Do not edit email HTML in `app.py`.** Edit `services/order_email.py` only.

## Where emails are sent from

| Source | When | Admin email | Customer email |
|--------|------|-------------|----------------|
| **`/api/place-order`** (`place_order`) | Order created (before Stripe checkout) | ✅ | ✅ if `customer_email` provided |
| **`/success`** (`success()`) | User lands on success page and order status is still `pending` (webhook didn’t fire) | ✅ fallback | ❌ |
| **`/webhook`** (Stripe `checkout.session.completed`) | Payment confirmed by Stripe | ✅ | ✅ if `customer_email` from Stripe/order |

## Flow

1. **place_order** – Creates order, stores in DB and `order_store`, builds admin + customer email via `order_email`, sends both with Resend.
2. **success()** – Loads order; if status ≠ `paid`, builds admin email via `order_email` and sends (fallback when webhook is delayed or missed).
3. **stripe_webhook** – On `checkout.session.completed`, loads order, builds admin + customer email via `order_email`, sends both.

All three paths use the same HTML and screenshot/attachment logic from `order_email.py`.
