# Database Setup Guide - Fix "Account creation failed"

## 🎯 **The Problem**
Your Supabase database is missing the required authentication columns, which is why you're getting "Account creation failed".

## 📋 **Step-by-Step Fix**

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
-- Add authentication columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('customer', 'creator', 'admin')),
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Update RLS policies for authentication
DROP POLICY IF EXISTS "Public can view users for authentication" ON users;
CREATE POLICY "Public can view users for authentication" ON users
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert users for signup" ON users;
CREATE POLICY "Public can insert users for signup" ON users
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);
```

### **Step 4: Execute the Script**
1. Click the **"Run"** button (or press Ctrl+Enter)
2. You should see a success message

### **Step 5: Verify the Setup**
After running the script, you should see:
- ✅ No error messages
- ✅ Success confirmation
- ✅ The `users` table now has the new columns

## 🧪 **Test the Fix**

After running the SQL script, test your account creation:

1. **Go back to your product page**
2. **Try creating an account** with any email
3. **Check if the error is gone**

## 🔍 **What This Script Does**

- ✅ **Adds `password_hash`** - Stores encrypted passwords
- ✅ **Adds `role`** - User permissions (customer/creator/admin)
- ✅ **Adds `is_admin`** - Admin user flag
- ✅ **Adds `status`** - Account status (active/suspended/banned)
- ✅ **Adds `email_verified`** - Email verification status
- ✅ **Adds `email_verification_token`** - For password reset & email verification
- ✅ **Creates indexes** - For better performance
- ✅ **Updates RLS policies** - For proper security

## 🚨 **If You Still Get Errors**

If you still get "Account creation failed" after running the SQL:

1. **Check the SQL Editor** - Make sure there were no error messages
2. **Refresh your product page** - Clear browser cache
3. **Try a different email** - Sometimes helps with testing

## 📞 **Need Help?**

If you're having trouble with the Supabase setup:
1. Make sure you're in the correct project
2. Check that you have admin access to the database
3. Try running the SQL commands one by one if needed

**This is the ONLY fix needed for the "Account creation failed" error!** 🎯 