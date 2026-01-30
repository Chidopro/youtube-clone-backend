# Fix: Stripe Webhook Not Firing (0 Events)

## Problem
- ✅ SQL migrations completed
- ✅ Purchase completed with test card
- ✅ Success page shown
- ❌ **No webhook events in Stripe (0 delivered)**

## Root Cause
Stripe webhooks are **mode-specific**. You need separate webhooks for:
- **Test Mode** (for testing)
- **Live Mode** (for production)

If your webhook is configured for Live mode but you're making test purchases, Stripe won't send webhooks.

---

## Solution: Configure Test Mode Webhook

### Step 1: Switch to Test Mode in Stripe

1. In Stripe Dashboard, look for the **"Test mode" toggle** in the top right
2. Make sure it's **ON** (should show "Test mode" or have a toggle switched)
3. The URL should show `?test=true` or similar

### Step 2: Check Your Webhook Configuration

1. Go to **Stripe Dashboard → Developers → Webhooks**
2. Make sure you're viewing **Test mode** webhooks (not Live mode)
3. Look for your webhook: `https://screenmerch.fly.dev/webhook`

**If the webhook doesn't exist in Test mode:**
- You need to create it for Test mode separately

### Step 3: Create Test Mode Webhook (If Missing)

1. In **Test mode**, go to **Developers → Webhooks**
2. Click **"+ Add endpoint"** or **"+ Add destination"**
3. Enter endpoint URL: `https://screenmerch.fly.dev/webhook`
4. Select events to listen to:
   - **`checkout.session.completed`** (this is the critical one for sales)
5. Click **"Add endpoint"**

### Step 4: Verify Webhook Events

After creating the webhook, check:
1. Click on your webhook endpoint
2. Go to the **"Events"** tab (not "Overview")
3. You should see a list of events
4. Look for `checkout.session.completed` events

### Step 5: Test the Webhook

1. Make a **NEW test purchase** from `testcreator.screenmerch.com`
2. Use test card: `4242 4242 4242 4242`
3. Complete checkout
4. Go back to Stripe → Webhooks → Your endpoint → **"Events"** tab
5. You should now see a `checkout.session.completed` event

---

## Alternative: Check Events Tab Instead of Overview

The "Overview" tab shows aggregate stats. To see individual events:

1. In Stripe Dashboard → Webhooks
2. Click on your webhook endpoint (`https://screenmerch.fly.dev/webhook`)
3. Click the **"Events"** tab (not "Overview")
4. This will show individual webhook delivery attempts

---

## Verify Webhook Secret

Make sure your backend has the **TEST mode** webhook secret:

1. In Stripe Dashboard → Webhooks → Your endpoint
2. Click **"Reveal"** next to "Signing secret"
3. Copy the secret (starts with `whsec_...`)
4. Verify it matches your `STRIPE_WEBHOOK_SECRET` environment variable

**Important:** Test mode and Live mode have **different** webhook secrets!

---

## Quick Checklist

- [ ] Stripe Dashboard is in **Test mode** (toggle in top right)
- [ ] Webhook exists for **Test mode** (not just Live mode)
- [ ] Webhook endpoint URL is: `https://screenmerch.fly.dev/webhook`
- [ ] Webhook is listening to: `checkout.session.completed`
- [ ] Webhook secret in backend matches **Test mode** secret
- [ ] Made a NEW test purchase after configuring webhook
- [ ] Checked **"Events"** tab (not "Overview") for webhook deliveries

---

## If Still Not Working

### Check Webhook Endpoint Accessibility

Test if your webhook endpoint is accessible:

```bash
# Test if endpoint responds
curl -X POST https://screenmerch.fly.dev/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

If this fails, your endpoint might not be accessible from Stripe's servers.

### Check Backend Logs

Check Fly.io logs for any webhook attempts:

```bash
fly logs | grep webhook
```

Or check in Fly.io dashboard for any POST requests to `/webhook`.

---

## Expected Flow After Fix

1. Make test purchase → Stripe processes payment
2. Stripe sends `checkout.session.completed` webhook to your endpoint
3. Backend receives webhook → Processes order → Records sale
4. Sale appears in database with `user_id` populated
5. Analytics dashboard shows the sale

---

## Next Steps

1. **Switch to Test mode** in Stripe Dashboard
2. **Create/verify Test mode webhook** for `checkout.session.completed`
3. **Make a NEW test purchase**
4. **Check "Events" tab** (not Overview) for webhook delivery
5. **Check backend logs** for webhook processing
6. **Verify sale in database** with correct `user_id`
