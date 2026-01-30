# Fix: Subdomain Creator Analytics Tracking Issue

## Problem

When a user makes a test purchase from a subdomain (e.g., `testcreator.screenmerch.com`), the sale is not appearing in that creator's dashboard analytics page.

## Root Cause

The `orders` table in the database was missing the `creator_user_id` and `subdomain` columns. When orders were created:

1. The code tried to save `creator_user_id` and `subdomain` to the database (lines 2818-2819 in `backend/app.py`)
2. **But these columns didn't exist in the database schema**, so the values were silently ignored
3. When the Stripe webhook processed the payment:
   - It retrieved the order from the database
   - `order_data.get('creator_user_id')` returned `None` (because the field was never saved)
   - The webhook tried to look up from subdomain, but `subdomain` was also `None`
   - `record_sale()` was called with `user_id=None`
   - The sale was recorded in the `sales` table **without a `user_id`**
   - The analytics query filters by `user_id`, so sales without `user_id` don't appear in creator dashboards

## Solution

### Step 1: Add Missing Database Columns

Run this SQL migration in your Supabase SQL Editor:

```sql
-- File: fix_orders_table_add_creator_fields.sql

-- Add creator_user_id column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS creator_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add subdomain column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS subdomain VARCHAR(255);

-- Add video_url column if it doesn't exist (for completeness)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add screenshot_timestamp column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS screenshot_timestamp VARCHAR(50);

-- Create index on creator_user_id for faster analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_creator_user_id ON orders(creator_user_id);

-- Create index on subdomain for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_subdomain ON orders(subdomain);
```

### Step 2: Code Changes Made

1. **Enhanced Webhook Logging** (`backend/app.py` lines 4387-4410):
   - Added detailed logging to track `creator_user_id` retrieval
   - Logs when `creator_user_id` is found or missing
   - Logs subdomain lookup attempts

2. **Enhanced Order Creation Logging** (`backend/app.py` lines 2832-2844):
   - Added logging to show what `creator_user_id` and `subdomain` values are being saved
   - Logs errors if database insert fails

3. **Enhanced record_sale Logging** (`backend/app.py` lines 2213-2269):
   - Added logging to track if `creator_user_id` is passed correctly
   - Warns when sales are recorded without `creator_user_id` (these won't appear in analytics)

4. **Updated in-memory order_store** (`backend/app.py` lines 2847-2853):
   - Now also stores `creator_user_id` and `subdomain` in the in-memory backup

## Testing

After applying the fix:

1. **Run the SQL migration** in Supabase SQL Editor
2. **Make a test purchase** from `testcreator.screenmerch.com`
3. **Check the logs** for:
   - `💾 [PLACE-ORDER] Saving order to database with creator_user_id: <uuid>`
   - `✅ [WEBHOOK] Using creator_user_id: <uuid> for order <order_id>`
   - `✅ [RECORD_SALE] Recording sale with creator_user_id: <uuid>`
4. **Verify in dashboard**:
   - Go to `testcreator.screenmerch.com/dashboard`
   - The test purchase should now appear in analytics

## Verification Queries

Run these in Supabase SQL Editor to verify:

```sql
-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('creator_user_id', 'subdomain');

-- Check recent orders with creator_user_id
SELECT order_id, creator_name, creator_user_id, subdomain, created_at
FROM orders
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;

-- Check sales with user_id (should have creator_user_id)
SELECT id, product_name, amount, user_id, creator_name, created_at
FROM sales
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;
```

## Expected Behavior After Fix

1. **Order Creation**:
   - Subdomain is extracted from request Origin header
   - Creator's `user_id` is looked up from subdomain
   - Both `creator_user_id` and `subdomain` are saved to database

2. **Stripe Webhook**:
   - Order is retrieved from database
   - `creator_user_id` is read from order data
   - If missing, looks up from `subdomain` field
   - `record_sale()` is called with correct `creator_user_id`

3. **Sale Recording**:
   - Sale is recorded in `sales` table with `user_id = creator_user_id`
   - Creator earnings record is created
   - Analytics query filters by `user_id`, so sale appears in creator dashboard

## Important Notes

- **Existing orders**: Orders created before this fix will not have `creator_user_id` set. They may need to be backfilled if you want them to appear in analytics.
- **Test mode**: Make sure Stripe is in test mode when testing, and use test card numbers.
- **Logs**: Check application logs after making a test purchase to verify the flow is working correctly.

## Files Modified

- `backend/app.py` - Enhanced logging and ensured creator_user_id is passed correctly
- `fix_orders_table_add_creator_fields.sql` - Database migration to add missing columns

## Next Steps

1. ✅ Run SQL migration
2. ✅ Deploy updated code
3. ⏳ Make test purchase from subdomain
4. ⏳ Verify in creator dashboard
5. ⏳ Check logs for any issues
