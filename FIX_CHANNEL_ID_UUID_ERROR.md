# Fix: Channel ID UUID Error Preventing Sales Recording

## Problem Found in Logs

```
❌ Error recording sale: invalid input syntax for type uuid: "cheedo_v"
```

The webhook is trying to insert `"cheedo_v"` (a string) into a UUID column, causing the sale insert to fail.

---

## Root Cause

The `channel_id` column in the `sales` table is likely defined as **UUID** type, but the code is trying to insert the string `"cheedo_v"`.

---

## Solution Options

### Option 1: Change channel_id Column to VARCHAR (Recommended)

Run this in Supabase SQL Editor:

```sql
-- Change channel_id from UUID to VARCHAR(255)
ALTER TABLE sales 
ALTER COLUMN channel_id TYPE VARCHAR(255) USING channel_id::text;
```

This allows string values like `"cheedo_v"` to be stored.

---

### Option 2: Remove channel_id from Inserts (Temporary Fix)

I've already updated the code to skip `channel_id` in the insert. This will allow sales to be recorded, but you'll lose channel tracking.

**To re-enable channel_id after fixing schema:**
1. Run the SQL migration above (Option 1)
2. Uncomment the `channel_id` line in `sale_data` in `backend/app.py` line ~2273

---

## Quick Fix Steps

1. **Check actual schema:**
   ```sql
   SELECT column_name, data_type, udt_name
   FROM information_schema.columns 
   WHERE table_name = 'sales'
   AND column_name = 'channel_id';
   ```

2. **If it's UUID, change it to VARCHAR:**
   ```sql
   ALTER TABLE sales 
   ALTER COLUMN channel_id TYPE VARCHAR(255) USING channel_id::text;
   ```

3. **Revert code change** - uncomment `channel_id` in `sale_data` in `backend/app.py`

4. **Make a new test purchase** - sales should now be recorded!

---

## After Fix

Once `channel_id` is VARCHAR, sales will be recorded with:
- ✅ Correct `user_id` (from `creator_user_id`)
- ✅ `channel_id` as string (e.g., "cheedo_v" or NULL)
- ✅ All other sale data

Then the analytics dashboard should show the sales!
