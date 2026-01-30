# Fix Order Queue & Stripe Webhook Configuration

## Part 1: Fix the Existing Order

The order `44be5aba-a922-4ba0-9fca-f85d5f2ebfad` needs to be manually fixed.

### Option A: Using Browser Console (Easiest)

1. **Log into the admin portal**: https://screenmerch.com/admin
2. **Open browser console** (F12 or Right-click → Inspect → Console)
3. **Run this command**:
```javascript
fetch('https://screenmerch.fly.dev/api/admin/fix-order-queue/44be5aba-a922-4ba0-9fca-f85d5f2ebfad', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => console.log('Result:', data))
.catch(err => console.error('Error:', err));
```

4. **Refresh the admin portal** - the order should now appear in the processing queue

### Option B: Using curl (Command Line)

```bash
curl -X POST https://screenmerch.fly.dev/api/admin/fix-order-queue/44be5aba-a922-4ba0-9fca-f85d5f2ebfad \
  -H "Content-Type: application/json" \
  -b "your_session_cookie_here"
```

---

## Part 2: Configure Stripe Webhook

The webhook didn't fire because it's not properly configured. Here's how to fix it:

### Step 1: Go to Stripe Dashboard

1. **Open Stripe Dashboard**: https://dashboard.stripe.com/test/webhooks
2. **Make sure you're in TEST MODE** (toggle in top right should say "Test mode")

### Step 2: Check Existing Webhooks

1. Look for a webhook endpoint pointing to: `https://screenmerch.fly.dev/webhook`
2. If it exists, click on it to edit
3. If it doesn't exist, click **"+ Add endpoint"**

### Step 3: Configure Webhook

**Endpoint URL:**
```
https://screenmerch.fly.dev/webhook
```

**Events to listen for:**
- ✅ `checkout.session.completed` (REQUIRED - this is what processes orders)

**Optional events** (for subscriptions):
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### Step 4: Get Webhook Secret

1. After creating/updating the webhook, click on it
2. Click **"Reveal"** next to "Signing secret"
3. Copy the secret (starts with `whsec_...`)

### Step 5: Update Fly.io Secret

Run this command (replace `YOUR_WEBHOOK_SECRET` with the actual secret):

```bash
cd backend
fly secrets set STRIPE_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET -a screenmerch
```

### Step 6: Test the Webhook

1. **Place a test order** on your site
2. **Complete payment** using test card: `4242 4242 4242 4242`
3. **Check Stripe Dashboard** → Webhooks → Your endpoint → "Recent events"
4. You should see a `checkout.session.completed` event with status "Succeeded"
5. **Check admin portal** - the order should appear automatically

### Step 7: Verify in Logs

```bash
cd backend
fly logs -a screenmerch -n
```

Look for:
- `✅ Updated order ... status to 'paid' in database`
- `✅ Created processing queue entry for order ...`

---

## Troubleshooting

### Webhook not receiving events?

1. **Check webhook URL is correct**: `https://screenmerch.fly.dev/webhook`
2. **Check you're in TEST mode** in Stripe Dashboard
3. **Check webhook secret** matches what's in Fly.io secrets
4. **Check logs** for webhook errors: `fly logs -a screenmerch`

### Order still not appearing?

1. **Check order status** in database - should be "paid"
2. **Check processing queue** - should have an entry with status "pending"
3. **Try the fix endpoint** again
4. **Check admin portal** is querying the correct table

### Webhook returns 400 error?

- Usually means webhook secret is wrong
- Update `STRIPE_WEBHOOK_SECRET` in Fly.io secrets
- Make sure you're using the TEST mode webhook secret

---

## Quick Test

After configuring the webhook, test it:

1. Place a new test order
2. Complete payment with test card `4242 4242 4242 4242`
3. Check admin portal - order should appear within seconds
4. If it doesn't appear, check logs for webhook errors

---

## Summary

✅ **Fixed code deployed** - Future orders will automatically create queue entries  
✅ **Admin endpoint created** - Can manually fix orders that miss webhooks  
⏳ **Webhook needs configuration** - Follow Part 2 above  
⏳ **Existing order needs fixing** - Follow Part 1 above

