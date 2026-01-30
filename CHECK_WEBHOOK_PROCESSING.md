# Check Webhook Processing - Sales Not Appearing

## Current Status
✅ Webhooks are being sent successfully (`200 OK` responses)  
✅ Backend is receiving webhooks  
❌ Sales not appearing in analytics

## Next Steps to Diagnose

### Step 1: Check Database for Recent Orders

Run this in Supabase SQL Editor to see if your recent order has `creator_user_id`:

```sql
-- Check recent orders (last 2 hours)
SELECT 
    order_id,
    creator_name,
    creator_user_id,  -- ⚠️ Should NOT be NULL
    subdomain,
    status,
    total_amount,
    created_at
FROM orders
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 5;
```

**What to look for:**
- If `creator_user_id` is **NULL** → The order was created before SQL migration or subdomain lookup failed
- If `subdomain` is **NULL** → Subdomain wasn't extracted from request

---

### Step 2: Check Database for Recent Sales

```sql
-- Check recent sales (last 2 hours)
SELECT 
    id,
    product_name,
    amount,
    user_id,  -- ⚠️ CRITICAL - Should NOT be NULL
    creator_name,
    created_at
FROM sales
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 5;
```

**What to look for:**
- If `user_id` is **NULL** → Sale was recorded without creator tracking (this is the problem!)
- If no rows → Webhook received but sale wasn't recorded (check backend logs)

---

### Step 3: Get testcreator's user_id

```sql
-- Get testcreator's user_id
SELECT id, display_name, subdomain, role
FROM users
WHERE subdomain = 'testcreator';
```

**Note the `id` value** - this should match what's in `sales.user_id` and `orders.creator_user_id`

---

### Step 4: Check Backend Logs

Check your Fly.io logs for webhook processing. Look for:

**Success indicators:**
- `✅ Payment received for session: <session_id>`
- `✅ Retrieved order <order_id> from database`
- `✅ [WEBHOOK] Using creator_user_id: <uuid>`
- `✅ [RECORD_SALE] Recording sale with creator_user_id: <uuid>`

**Error indicators:**
- `❌ [WEBHOOK] CRITICAL: No creator_user_id found` → Order doesn't have creator_user_id
- `⚠️ [RECORD_SALE] Recording sale WITHOUT creator_user_id!` → Sale won't appear in analytics
- `Order ID <order_id> not found` → Order wasn't saved to database

---

## Most Likely Issue

Since webhooks are returning `200 OK`, the backend is receiving them. The most likely issue is:

**The order was created BEFORE the SQL migrations were run**, so:
1. Order doesn't have `creator_user_id` stored
2. Webhook tries to find `creator_user_id` from order → finds NULL
3. Webhook tries to look up from `subdomain` → might also be NULL
4. Sale is recorded with `user_id = NULL`
5. Analytics filters by `user_id`, so sale doesn't appear

---

## Solution

### If Order Has creator_user_id = NULL:

The order was created before the SQL migration. You need to make a **NEW test purchase** after the migrations were run.

### If Sale Has user_id = NULL:

The webhook processed the order but couldn't find the creator. Check:
1. Does the order have `subdomain` stored?
2. Does that subdomain match a user in the database?
3. Check backend logs for the exact error

---

## Quick Test

1. Make a **NEW test purchase** from `testcreator.screenmerch.com` (after SQL migrations)
2. Check the order in database - does it have `creator_user_id`?
3. Check the sale in database - does it have `user_id`?
4. If both are populated, refresh analytics dashboard
