-- Fix Admin Access for User
-- Run this in Supabase SQL Editor to grant admin access

-- First, find the user by email or display name
-- Replace 'chido@example.com' with the actual email, or search by display_name

-- Option 1: Find user by email (replace with actual email)
SELECT id, email, display_name, is_admin, admin_role 
FROM users 
WHERE email LIKE '%chido%' OR display_name LIKE '%chido%';

-- Option 2: Grant full admin access (replace 'USER_ID_HERE' with the actual user ID from above)
-- UPDATE users 
-- SET is_admin = true, admin_role = 'admin' 
-- WHERE id = 'USER_ID_HERE';

-- Option 3: Grant admin access by email (replace with actual email)
-- UPDATE users 
-- SET is_admin = true, admin_role = 'admin' 
-- WHERE email = 'chido@example.com';

-- Option 4: Grant admin access by display name
-- UPDATE users 
-- SET is_admin = true, admin_role = 'admin' 
-- WHERE display_name ILIKE '%chido%';

-- Verify the update
-- SELECT id, email, display_name, is_admin, admin_role 
-- FROM users 
-- WHERE email LIKE '%chido%' OR display_name LIKE '%chido%';

