# Testing Admin Order Processing with Stripe Test Mode

## Overview
To fully test the admin order processing system, you need to:
1. Switch Stripe to test mode
2. Configure test webhooks
3. Make test payments
4. Verify orders appear in the processing queue

## Step 1: Switch Stripe to Test Mode

### In Fly.io (Backend):
1. Get your Stripe **Test** API keys from Stripe Dashboard:
   - Go to: https://dashboard.stripe.com/test/apikeys
   - Copy your **Test** secret key (starts with `sk_test_...`)

2. Update Fly.io environment variable:
   ```bash
   fly secrets set STRIPE_SECRET_KEY=sk_test_YOUR_TEST_KEY_HERE
   ```

3. Get your Stripe **Test** webhook secret:
   - Go to: https://dashboard.stripe.com/test/webhooks
   - Create a webhook endpoint pointing to: `https://screenmerch.fly.dev/webhook`
   - Select events: `checkout.session.completed`
   - Copy the webhook signing secret (starts with `whsec_...`)

4. Update webhook secret:
   ```bash
   fly secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
   ```

5. Restart the backend:
   ```bash
   fly apps restart screenmerch
   ```

## Step 2: Verify Stripe Test Mode

Test the Stripe configuration:
```bash
curl https://screenmerch.fly.dev/api/test-stripe
```

Should return:
```json
{
  "success": true,
  "message": "Stripe configuration is working",
  "account_id": "acct_...",
  "stripe_key_configured": true
}
```

## Step 3: Test Payment Flow

### Test Cards (Stripe Test Mode):
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires 3D Secure**: `4000 0025 0000 3155`

Use any:
- Expiry: Future date (e.g., `12/34`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

### Test Order Flow:
1. Go to your product page
2. Add items to cart
3. Proceed to checkout
4. Use test card: `4242 4242 4242 4242`
5. Complete payment

## Step 4: Verify Order Processing Queue

After a successful test payment:

1. **Check Database** (Supabase):
   ```sql
   -- Check if order was created
   SELECT order_id, status, created_at 
   FROM orders 
   ORDER BY created_at DESC 
   LIMIT 5;

   -- Check if order was added to processing queue
   SELECT * 
   FROM order_processing_queue 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

2. **Check Admin Portal**:
   - Go to: `https://screenmerch.com/admin`
   - Click "📦 Order Processing" tab
   - You should see the test order in "Processing Queue"

## Step 5: Test Order Processing

1. **Assign Order to Worker**:
   - In Admin Portal → Order Processing
   - Click "Assign" on a pending order
   - Select a worker (or create one first)

2. **Process Order** (Worker Portal):
   - Worker logs in at `/worker-portal`
   - Sees assigned orders
   - Processes order (uploads image, submits to Printful)

3. **Verify Processing History**:
   - Check "Processing History" section
   - Order should show as "completed"

## Troubleshooting

### Orders not appearing in queue:
- Check if database trigger exists:
  ```sql
  SELECT * FROM pg_trigger WHERE tgname = 'trigger_auto_create_processing_queue';
  ```
- If missing, run `database_order_processing_queue.sql`

### Webhook not receiving events:
- Check Stripe Dashboard → Webhooks → Events
- Verify webhook endpoint URL is correct
- Check backend logs: `fly logs`

### Test payments failing:
- Verify you're using test API keys (not live keys)
- Check Stripe Dashboard → Payments (test mode)
- Verify webhook secret matches

## Switching Back to Live Mode

When ready for production:

1. Get **Live** API keys from: https://dashboard.stripe.com/apikeys
2. Update Fly.io secrets:
   ```bash
   fly secrets set STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
   fly secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_LIVE_WEBHOOK_SECRET
   ```
3. Update webhook endpoint in Stripe Dashboard (live mode)
4. Restart backend: `fly apps restart screenmerch`

## Notes

- Test mode and live mode use separate webhook endpoints
- Test payments don't charge real money
- Test orders appear in Stripe Dashboard (test mode view)
- All test data is separate from production data

