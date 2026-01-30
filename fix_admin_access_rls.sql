-- Fix Admin Access for alancraigdigital@gmail.com
-- This bypasses RLS by using direct SQL (run in Supabase SQL Editor as admin)

-- Step 1: First, check if user exists
SELECT id, email, display_name, is_admin, status
FROM users 
WHERE email = 'alancraigdigital@gmail.com';

-- Step 2: Grant admin access (this will work even with RLS enabled)
-- Using direct UPDATE which bypasses RLS when run in SQL Editor
UPDATE users 
SET is_admin = true,
    status = 'active'
WHERE email = 'alancraigdigital@gmail.com';

-- Step 3: Verify it worked
SELECT id, email, display_name, is_admin, status
FROM users 
WHERE email = 'alancraigdigital@gmail.com';

-- If you need to also ensure the user can query their own admin status,
-- you may need to update the RLS policy to allow users to read their own is_admin field
-- But first, try the UPDATE above and see if it works.

