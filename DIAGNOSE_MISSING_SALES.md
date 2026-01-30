# Diagnose: Webhook Receives Events But No Sales Recorded

## Current Status
✅ Orders exist with `creator_user_id` populated  
✅ Webhooks returning `200 OK` (backend receiving them)  
❌ **NO sales records in database**

## Root Cause Analysis

The webhook is receiving events successfully, but `record_sale()` is either:
1. Not being called
2. Failing silently (exception caught)
3. Failing due to database schema mismatch
4. Blocked by RLS policies

---

## Step 1: Check Backend Logs

**This is the most important step!** Check your Fly.io logs for:

```bash
# If using Fly CLI
fly logs | grep -i "webhook\|record_sale\|sale"

# Or check in Fly.io dashboard
```

**Look for these log messages:**

### Success Indicators:
- `✅ Payment received for session: <session_id>`
- `✅ Retrieved order <order_id> from database`
- `✅ [WEBHOOK] Using creator_user_id: <uuid>`
- `✅ [RECORD_SALE] Recording sale with creator_user_id: <uuid>`
- `✅ Recorded sale with precise tracking: product=..., creator_user_id=..., amount=$...`

### Error Indicators:
- `❌ Error recording sale: <error message>`
- `❌ Error recording sale (fallback): <error message>`
- `❌ [WEBHOOK] CRITICAL: No creator_user_id found`
- `⚠️ [RECORD_SALE] Recording sale WITHOUT creator_user_id!`

**If you see error messages, that's the issue!**

---

## Step 2: Check Sales Table Schema

The `record_sale()` function tries to insert these fields. Verify they all exist:

```sql
-- Check sales table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'sales'
ORDER BY ordinal_position;
```

**Required columns that should exist:**
- `id` (UUID, primary key)
- `user_id` (UUID, nullable)
- `product_id` (VARCHAR)
- `product_name` (VARCHAR, NOT NULL)
- `video_id` (VARCHAR)
- `video_title` (VARCHAR)
- `video_url` (TEXT) - might be missing
- `creator_name` (TEXT) - might be missing
- `screenshot_timestamp` (VARCHAR) - might be missing
- `image_url` (TEXT)
- `amount` (DECIMAL, NOT NULL)
- `friend_id` (VARCHAR)
- `channel_id` (VARCHAR)
- `created_at` (TIMESTAMP) - might be missing

**If any required columns are missing, the insert will fail!**

---

## Step 3: Check RLS Policies

Row Level Security might be blocking inserts:

```sql
-- Check RLS policies on sales table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'sales';
```

**Look for:**
- Policy that allows service role to insert
- Policy that allows authenticated users to insert

**If no insert policy exists, inserts will fail silently!**

---

## Step 4: Test record_sale Directly

You can test if `record_sale()` works by manually calling it. But first, check the logs to see if it's even being called.

---

## Most Likely Issues

### Issue 1: Missing Columns
**Symptom:** `record_sale()` tries to insert `video_url`, `creator_name`, or `screenshot_timestamp` but columns don't exist
**Solution:** Run `fix_sales_table_complete.sql` migration

### Issue 2: RLS Blocking Inserts
**Symptom:** Service role client can't insert due to RLS policy
**Solution:** Check RLS policies, ensure service role can insert

### Issue 3: Exception Being Swallowed
**Symptom:** `record_sale()` throws exception but webhook still returns 200 OK
**Solution:** Check backend logs for error messages

### Issue 4: record_sale Not Being Called
**Symptom:** Webhook processes but doesn't call `record_sale()`
**Solution:** Check webhook code flow, verify `record_sale()` is in the execution path

---

## Quick Fix: Check Logs First

**The backend logs will tell us exactly what's happening.** Check Fly.io logs and look for:
1. Is `record_sale()` being called?
2. Are there any error messages?
3. What's the exact error if insert fails?

Share the log output and we can fix the exact issue!
