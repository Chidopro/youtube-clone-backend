-- Grant Full Admin Access to alancraigdigital@gmail.com
-- Run this in Supabase SQL Editor

-- First, verify the user exists
SELECT id, email, display_name, is_admin, admin_role 
FROM users 
WHERE email = 'alancraigdigital@gmail.com';

-- Grant full admin access
UPDATE users 
SET is_admin = true, admin_role = 'admin' 
WHERE email = 'alancraigdigital@gmail.com';

-- Verify the update was successful
SELECT id, email, display_name, is_admin, admin_role 
FROM users 
WHERE email = 'alancraigdigital@gmail.com';

