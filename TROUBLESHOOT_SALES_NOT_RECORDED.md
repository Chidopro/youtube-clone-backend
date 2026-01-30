# Troubleshooting: Sales Not Being Recorded

## Two Separate Issues

### Issue 1: Print Quality 500 Errors (Non-Critical)
The 500 errors you're seeing are from `/api/capture-print-quality` endpoint. This is for screenshot processing and **does NOT affect sales recording**. You can ignore these for now.

### Issue 2: Sales Not Recorded (Critical)
This is the main issue we need to fix.

---

## Diagnostic Steps

### Step 1: Verify SQL Migrations Were Run

Run this in Supabase SQL Editor:

```sql
-- Check if orders table has creator_user_id
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('creator_user_id', 'subdomain');

-- Check if sales table has created_at
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'sales' 
AND column_name IN ('created_at', 'creator_name');
```

**Expected:** Both queries should return rows. If not, run the migrations first!

---

### Step 2: Check If Purchase Was Actually Completed

**Important Questions:**
1. Did you complete the Stripe checkout process?
2. Did you see a "Payment successful" or "Order confirmed" message?
3. Are you using Stripe **test mode** with test card numbers?

**Test Card Numbers:**
- `4242 4242 4242 4242` (Visa)
- Any future expiry date
- Any 3-digit CVC

---

### Step 3: Check Stripe Webhook Delivery

1. Go to Stripe Dashboard → Developers → Webhooks
2. Find your webhook endpoint (should be `https://screenmerch.fly.dev/webhook`)
3. Check recent events:
   - Look for `checkout.session.completed` events
   - Check if they show "Succeeded" (green) or "Failed" (red)
   - If failed, click to see error details

**If webhook shows "Failed":**
- Check the error message
- Verify webhook secret is correct in your environment variables
- Check if the endpoint is accessible

---

### Step 4: Check Backend Logs

Check your Fly.io logs for webhook processing:

```bash
# If using Fly.io CLI
fly logs

# Or check in Fly.io dashboard
```

**Look for:**
- `✅ Payment received for session: <session_id>`
- `✅ Retrieved order <order_id> from database`
- `✅ [WEBHOOK] Using creator_user_id: <uuid>`
- `✅ [RECORD_SALE] Recording sale with creator_user_id: <uuid>`

**If you see errors:**
- `❌ [WEBHOOK] CRITICAL: No creator_user_id found` → Order doesn't have creator_user_id
- `⚠️ [RECORD_SALE] Recording sale WITHOUT creator_user_id!` → Sale won't appear in analytics
- `Order ID <order_id> not found` → Order wasn't saved to database

---

### Step 5: Check Database for Orders and Sales

Run these queries in Supabase:

```sql
-- Check recent orders
SELECT 
    order_id,
    creator_name,
    creator_user_id,  -- Should NOT be NULL
    subdomain,
    status,
    created_at
FROM orders
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 5;

-- Check recent sales
SELECT 
    id,
    product_name,
    amount,
    user_id,  -- Should NOT be NULL (this is critical!)
    created_at
FROM sales
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 5;
```

**What to look for:**
- **No orders:** Purchase didn't complete or order wasn't saved
- **Order exists but `creator_user_id` is NULL:** SQL migration wasn't run before purchase
- **No sales:** Webhook hasn't fired or failed
- **Sale exists but `user_id` is NULL:** Webhook couldn't find creator_user_id

---

## Most Likely Scenarios

### Scenario 1: Purchase Never Completed
**Symptom:** No order in database, no webhook events in Stripe
**Solution:** Complete a test purchase using Stripe test card

### Scenario 2: SQL Migrations Not Run Before Purchase
**Symptom:** Order exists but `creator_user_id` is NULL, sale has `user_id` = NULL
**Solution:** 
1. Run SQL migrations
2. Make a NEW test purchase (old one won't be fixed automatically)

### Scenario 3: Webhook Not Firing
**Symptom:** Order exists but no sale record, no webhook events in Stripe
**Solution:**
- Check Stripe webhook configuration
- Verify webhook endpoint is accessible
- Check webhook secret in environment variables

### Scenario 4: Webhook Firing But Failing
**Symptom:** Webhook events show "Failed" in Stripe dashboard
**Solution:**
- Check backend logs for error details
- Verify database connection
- Check if all required columns exist

---

## Quick Fix Checklist

1. ✅ Run `fix_orders_table_add_creator_fields.sql`
2. ✅ Run `fix_sales_table_complete.sql`
3. ✅ Make a NEW test purchase from `testcreator.screenmerch.com`
4. ✅ Use Stripe test card: `4242 4242 4242 4242`
5. ✅ Complete the full checkout process
6. ✅ Check Stripe webhook dashboard for delivery status
7. ✅ Check backend logs for webhook processing
8. ✅ Verify sale appears in database with `user_id` populated
9. ✅ Refresh analytics dashboard

---

## Next Steps

After running the diagnostic steps above, share:
1. Results of SQL column checks (Step 1)
2. Whether purchase was completed (Step 2)
3. Stripe webhook status (Step 3)
4. Any errors from backend logs (Step 4)
5. Results of database queries (Step 5)

This will help identify exactly where the issue is occurring.
