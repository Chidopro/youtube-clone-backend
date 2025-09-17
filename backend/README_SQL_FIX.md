# Fix Admin User - SQL Script

## 🚨 **Problem:**
- `chidopro@proton.me` has role `customer` (should be `admin`)
- Password is `Test123` (should be `VieG369Bbk8!`)
- `admin@screenmerch.com` still has `admin` role (should be blocked)

## 🔧 **Solution:**
Run the SQL script `fix_admin_sql.sql` in the Supabase SQL Editor.

## 📋 **Steps:**

1. **Go to Supabase Dashboard:**
   - Open https://supabase.com/dashboard
   - Navigate to your project
   - Go to **SQL Editor**

2. **Run the SQL Script:**
   - Copy the contents of `fix_admin_sql.sql`
   - Paste into the SQL Editor
   - Click **Run**

3. **Verify Results:**
   - The script will show the updated users
   - Check that `chidopro@proton.me` has role `admin`
   - Check that `admin@screenmerch.com` has role `customer`

## ✅ **Expected Results:**
```
email                        | role    | password_hash | display_name | status
chidopro@proton.me          | admin   | VieG369Bbk8!  | Admin User   | active
admin@screenmerch.com       | customer| [old password]| [old name]   | active
```

## 🧪 **Test After Fix:**
- Try logging in with `chidopro@proton.me` / `VieG369Bbk8!`
- Try logging in with `admin@screenmerch.com` (should fail)
- Check that admin dashboard is accessible

## 🎯 **Why This Works:**
- SQL Editor runs with full database privileges
- Bypasses Row Level Security (RLS) restrictions
- Directly updates the database without API limitations
