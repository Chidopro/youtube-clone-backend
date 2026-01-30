# Master Admin Setup and Login Guide

## How to Set Yourself as Master Admin

### Step 1: Access Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your ScreenMerch project
3. Navigate to **SQL Editor** (left sidebar)

### Step 2: Run the Master Admin SQL Command

In the SQL Editor, run this command (replace with your email):

```sql
UPDATE users 
SET admin_role = 'master_admin', is_admin = true 
WHERE email = 'your-email@gmail.com';
```

**Important:** Use the exact email address you use to log in with Google OAuth.

### Step 3: Verify Your Admin Status

Run this query to verify:

```sql
SELECT email, is_admin, admin_role 
FROM users 
WHERE email = 'your-email@gmail.com';
```

You should see:
- `is_admin`: `true`
- `admin_role`: `master_admin`

## How to Log Into Admin Portal

### Option 1: Direct URL

1. Go to: `https://screenmerch.com/admin`
2. Click **"Sign in with Google"**
3. Use the Google account that matches your email in the database

### Option 2: From Website

1. Visit `https://screenmerch.com`
2. Look for admin portal link (if available)
3. Or navigate directly to `/admin`

## What You'll See as Master Admin

Once logged in, you'll see:

1. **Header shows:** "Welcome, [Your Name] **(Master Admin)**" in red text

2. **Sidebar includes:**
   - Dashboard
   - User Management
   - Content Moderation
   - Subscriptions
   - 💰 Payouts
   - 📦 Order Processing
   - **👥 Admin Management** ← This is ONLY visible to Master Admin
   - System Settings

3. **Admin Management Tab:**
   - View pending admin signup requests
   - Approve/reject requests
   - Manage all admin accounts
   - Change admin roles
   - Remove admin access

## Troubleshooting

### "Access Denied" Error

If you see "Access Denied":
1. Verify your email in Supabase matches your Google login email
2. Check that `is_admin = true` and `admin_role = 'master_admin'`
3. Clear browser cache and cookies
4. Log out and log back in

### Can't See Admin Management Tab

If you don't see the "👥 Admin Management" tab:
1. Verify you're set as `master_admin` (not just `admin`)
2. Refresh the page
3. Check browser console for errors

### Google OAuth Not Working

If Google sign-in fails:
1. Make sure you're using the correct Google account
2. Check that the email matches exactly (case-insensitive)
3. Try incognito/private browsing mode
4. Clear browser cache

## Setting Up Other Admins

1. **Regular Admin Signup:**
   - They visit: `https://screenmerch.com/admin-signup`
   - Enter their Google email
   - Submit request

2. **You Approve:**
   - Go to Admin Portal → 👥 Admin Management
   - See pending requests
   - Select role: "Master Admin", "Full Admin", or "Order Processing Admin"
   - Click "Approve"

3. **Set Up in Supabase Auth:**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add User"
   - Enter the approved email
   - Set a secure password
   - Provide password to the new admin

4. **They Log In:**
   - Go to `https://screenmerch.com/admin`
   - Sign in with Google (or use email/password if you set it up)

## Quick Reference

- **Admin Portal URL:** `https://screenmerch.com/admin`
- **Admin Signup URL:** `https://screenmerch.com/admin-signup`
- **Master Admin SQL:**
  ```sql
  UPDATE users 
  SET admin_role = 'master_admin', is_admin = true 
  WHERE email = 'your-email@gmail.com';
  ```

