# Switch Stripe from Test Mode to Live

Your app uses **one Stripe secret key** on the backend (`STRIPE_SECRET_KEY`) and a **webhook signing secret** (`STRIPE_WEBHOOK_SECRET`). The frontend does not use a publishable key for checkout (sessions are created on the backend and users are redirected to Stripe).

## 1. Activate your Stripe account for live payments

- Log in to [Stripe Dashboard](https://dashboard.stripe.com).
- Complete any required steps (identity, bank account, etc.) so your account can accept live payments.
- In the dashboard, switch from **Test mode** (toggle in the top right) to **Live mode**.

## 2. Get your live API keys

- In **Live mode**, go to **Developers → API keys**.
- Copy your **Secret key** (starts with `sk_live_`). This replaces your current test secret key.

## 3. Create a live webhook

- In **Live mode**, go to **Developers → Webhooks**.
- Click **Add endpoint**.
- **Endpoint URL:** `https://screenmerch.fly.dev/webhook`
- **Events to send:** enable at least `checkout.session.completed` (and any other events your app uses).
- After creating the endpoint, open it and click **Reveal** under **Signing secret**.
- Copy the **Signing secret** (starts with `whsec_`). This is your live webhook secret.

## 4. Set secrets in Fly.io

Set the **live** values (do not mix test and live):

```bash
fly secrets set STRIPE_SECRET_KEY="sk_live_..." STRIPE_WEBHOOK_SECRET="whsec_..." -a screenmerch
```

Use your actual `sk_live_...` and `whsec_...` values.

## 5. Update local backend .env (optional)

If you run the backend locally and want to test live there too, set in `backend/.env`:

- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`

Never commit these to git.

## 6. Redeploy and verify

- Redeploy so the app uses the new secrets:  
  `fly deploy -a screenmerch`
- Check logs:  
  `fly logs -a screenmerch`  
  You should see a line like: **Stripe LIVE mode - key starts with 'sk_live_'**
- Run a small real payment (e.g. lowest-price product) and confirm:
  - Checkout completes on Stripe.
  - Webhook fires (order marked paid, confirmation email sent if your app does that).

## Summary

| Where        | What to set |
|-------------|-------------|
| Stripe Dashboard | Use **Live** mode; create live webhook for `https://screenmerch.fly.dev/webhook` |
| Fly secrets | `STRIPE_SECRET_KEY` = `sk_live_...`, `STRIPE_WEBHOOK_SECRET` = `whsec_...` (live webhook secret) |
| Local .env  | Same keys if you want local to use live (optional) |

No frontend or code changes are required beyond using the live keys; the app already supports live mode.
