# Testing Stripe Checkout Without Live Charges

## You don't need live mode to get addresses

Stripe returns **shipping address** in both **test mode** and **live mode** when you request it. The Checkout Session is configured with `shipping_address_collection` so Stripe collects (and returns) the address in either mode.

---

## What to change when switching to test mode

**No code changes and no API URL changes.** Stripe uses the same API (`https://api.stripe.com`); test vs live is determined only by the keys you use. Update these **environment variables** (e.g. in `.env` or Fly.io secrets):

| Variable | Switch to (test) | Where to get it |
|----------|------------------|------------------|
| **STRIPE_SECRET_KEY** | `sk_test_...` | Stripe Dashboard → Developers → API keys → toggle **Test mode** ON → Secret key |
| **STRIPE_WEBHOOK_SECRET** | `whsec_...` (test) | Stripe Dashboard → Developers → Webhooks → **Test mode** → add endpoint (e.g. `https://your-app.fly.dev/api/webhook` or `/webhook`) → reveal **Signing secret** |

**Important:** Test and live webhooks have different signing secrets. If you only had a webhook under Live mode, add the same URL under **Test mode** and use that secret. Otherwise webhook signature verification will fail and paid events will not be processed.

**Frontend:** Your checkout redirects to Stripe Hosted Checkout (backend creates the session). The frontend does not use a Stripe publishable key for that flow, so you do not need to change any frontend key for checkout testing.

---

## Recommended: use test mode for all testing

1. **Use test API keys** (`sk_test_...` and `pk_test_...`) in your environment while developing and testing.
2. **Use Stripe test cards** (e.g. `4242 4242 4242 4242`). No real charges; no refunds needed.
3. **Test the full flow**: add to cart → checkout → enter shipping address in Stripe’s form → pay with test card. The webhook receives the same `shipping_details` as in live mode and persists the address on the order.

## When to use live mode

- **Production**: Use live keys so real customers pay and you receive funds.
- **Final verification**: One or two small live orders if you want to confirm production end-to-end (e.g. with a real card you then refund).

## Optional: restrict test mode in code

`_ensure_stripe_test_mode()` in `routes/orders.py` only logs a warning if a non-test key is used; it does not block. To avoid accidentally using live keys in dev, you can:

- Set `STRIPE_SECRET_KEY` to a test key in dev/staging.
- Use a separate env (e.g. `APP_ENV=production`) and only load live keys when `APP_ENV=production`.

## Summary

| Goal                         | Approach                                      |
|-----------------------------|-----------------------------------------------|
| Test checkout + address     | Test mode + test card; address is returned   |
| Avoid real charges          | Use test secret key + test webhook secret    |
| Go live                     | Switch to live keys in production             |
