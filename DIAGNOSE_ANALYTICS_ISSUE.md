# Diagnosing Analytics Issue - Sale Not Appearing

## Quick Checks

### Step 1: Verify SQL Migration Was Run

The `creator_user_id` and `subdomain` columns must exist in the `orders` table. Run this in Supabase SQL Editor:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('creator_user_id', 'subdomain');
```

**Expected Result:** Should return 2 rows (creator_user_id and subdomain)

**If empty:** Run `fix_orders_table_add_creator_fields.sql` first!

---

### Step 2: Check If Sale Was Recorded

Run this query to see if your test purchase created a sale record:

```sql
SELECT 
    id,
    product_name,
    amount,
    user_id,  -- This is critical - should NOT be NULL
    creator_name,
    created_at
FROM sales
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;
```

**What to look for:**
- If `user_id` is `NULL` → The sale was recorded but without creator tracking (this is the problem!)
- If no rows returned → The webhook hasn't fired yet or the sale wasn't recorded

---

### Step 3: Check If Order Has Creator Info

```sql
SELECT 
    order_id,
    creator_name,
    creator_user_id,  -- Should NOT be NULL
    subdomain,
    status,
    created_at
FROM orders
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;
```

**What to look for:**
- If `creator_user_id` is `NULL` → The order was created before the SQL migration or the subdomain lookup failed
- If `subdomain` is `NULL` → The subdomain wasn't extracted from the request

---

### Step 4: Get testcreator's user_id

```sql
SELECT id, display_name, subdomain, role
FROM users
WHERE subdomain = 'testcreator';
```

**Note the `id` value** - this is what should be in `sales.user_id` and `orders.creator_user_id`

---

### Step 5: Check Analytics Query Directly

Replace `YOUR_USER_ID_HERE` with the user_id from Step 4:

```sql
SELECT 
    id,
    product_name,
    amount,
    user_id,
    creator_name,
    created_at
FROM sales
WHERE user_id = 'YOUR_USER_ID_HERE'
ORDER BY created_at DESC;
```

**If this returns rows:** The sales exist, but the analytics API might have an issue
**If this returns empty:** The sales were recorded without `user_id` (the problem!)

---

## Common Issues & Solutions

### Issue 1: SQL Migration Not Run
**Symptom:** `creator_user_id` column doesn't exist in `orders` table
**Solution:** Run `fix_orders_table_add_creator_fields.sql` in Supabase SQL Editor

### Issue 2: Webhook Hasn't Fired Yet
**Symptom:** No sale record in `sales` table
**Solution:** 
- Check Stripe dashboard for webhook delivery status
- Webhooks can take a few seconds to minutes
- In test mode, webhooks might be delayed

### Issue 3: Sale Recorded Without user_id
**Symptom:** Sale exists in `sales` table but `user_id` is NULL
**Cause:** Order was created before SQL migration, or webhook couldn't find creator_user_id
**Solution:** 
- Run SQL migration
- Make a new test purchase
- Or manually update existing sales (see below)

### Issue 4: Wrong user_id in Analytics Query
**Symptom:** Sales exist but analytics shows empty
**Solution:** Check browser console - verify the `user_id` being sent matches the creator's actual user_id

---

## Manual Fix (If Sale Exists Without user_id)

If you find a sale with `user_id = NULL`, you can manually fix it:

```sql
-- First, get the creator's user_id
SELECT id FROM users WHERE subdomain = 'testcreator';

-- Then update the sale (replace USER_ID and SALE_ID)
UPDATE sales
SET user_id = 'USER_ID_FROM_ABOVE'
WHERE id = 'SALE_ID' AND user_id IS NULL;
```

---

## Check Webhook Logs

The webhook should log:
- `✅ [WEBHOOK] Using creator_user_id: <uuid> for order <order_id>`
- `✅ [RECORD_SALE] Recording sale with creator_user_id: <uuid>`

If you see:
- `❌ [WEBHOOK] CRITICAL: No creator_user_id found` → The order doesn't have creator_user_id stored
- `⚠️ [RECORD_SALE] Recording sale WITHOUT creator_user_id!` → The sale will not appear in analytics

---

## Next Steps After Diagnosis

1. **If SQL migration not run:** Run it now
2. **If webhook hasn't fired:** Wait a few minutes, check Stripe dashboard
3. **If sale recorded without user_id:** Make a new test purchase after running migration
4. **If everything looks correct:** Check browser console for analytics API response
