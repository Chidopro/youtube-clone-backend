-- Direct SQL to grant admin access to alancraigdigital@gmail.com
-- Run this in Supabase SQL Editor

-- Step 1: Check if user exists and current status
SELECT id, email, display_name, is_admin, admin_role, status
FROM users 
WHERE email = 'alancraigdigital@gmail.com';

-- Step 2: Grant full admin access (run this after verifying user exists)
UPDATE users 
SET is_admin = true,
    status = 'active'
WHERE email = 'alancraigdigital@gmail.com';

-- Step 3: Verify the update worked
SELECT id, email, display_name, is_admin, admin_role, status
FROM users 
WHERE email = 'alancraigdigital@gmail.com';

-- If the user doesn't exist, you may need to check for variations:
-- SELECT id, email, display_name, is_admin 
-- FROM users 
-- WHERE email ILIKE '%alancraigdigital%' OR email ILIKE '%alan%craig%';

