# 🔧 Fix Signup Error - Database Trigger Issue

## 🎯 **The Problem**
The signup is failing because there's a database trigger that automatically creates a subscription entry with tier 'basic', but the database constraint only allows 'free' or 'pro'.

## 📋 **The Solution**
We need to update the database trigger to use 'free' instead of 'basic'.

## 🚀 **Step-by-Step Fix**

### **Step 1: Open Supabase Dashboard**
1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Click on your **ScreenMerch project**

### **Step 2: Open SQL Editor**
1. In the left sidebar, click **"SQL Editor"**
2. Click **"New query"** (or the "+" button)

### **Step 3: Run This SQL Script**
Copy and paste this **exact** SQL script into the editor:

```sql
-- Fix the auto_create_user_subscription trigger to use 'free' instead of 'basic'
-- This will resolve the valid_tier constraint violation during signup

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS auto_create_user_subscription ON users;
DROP FUNCTION IF EXISTS create_user_subscription();

-- Recreate the function with 'free' tier
CREATE OR REPLACE FUNCTION create_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_subscriptions (user_id, tier, status)
    VALUES (NEW.id, 'free', 'active');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the trigger
CREATE TRIGGER auto_create_user_subscription
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_subscription();

-- Verify the fix
SELECT 'Trigger updated successfully' as status;
```

### **Step 4: Execute the Script**
1. Click the **"Run"** button (or press Ctrl+Enter)
2. You should see "Trigger updated successfully" in the results

### **Step 5: Test Signup**
1. Go back to your app
2. Try signing up with `driveralan1@yahoo.com` and `Test123456`
3. The signup should now work! 🎉

## ✅ **What This Fix Does**
- Updates the database trigger to use 'free' tier instead of 'basic'
- Ensures new users get a free subscription automatically
- Resolves the constraint violation error during signup

## 🔍 **If You Still Have Issues**
If the signup still fails after this fix, please share the new error message and I'll help you resolve it.

