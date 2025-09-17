-- Fix admin user in Supabase database
-- Run this in the Supabase SQL Editor

-- 1. Update chidopro@proton.me to admin role with correct password
UPDATE users 
SET 
    role = 'admin',
    password_hash = 'VieG369Bbk8!',
    display_name = 'Admin User',
    status = 'active',
    updated_at = NOW()
WHERE email = 'chidopro@proton.me';

-- 2. Remove admin role from old admin user
UPDATE users 
SET 
    role = 'customer',
    updated_at = NOW()
WHERE email = 'admin@screenmerch.com';

-- 3. Verify the changes
SELECT 
    email,
    role,
    password_hash,
    display_name,
    status,
    updated_at
FROM users 
WHERE email IN ('chidopro@proton.me', 'admin@screenmerch.com')
ORDER BY email;

-- 4. Check all admin users
SELECT 
    email,
    role,
    status,
    created_at,
    updated_at
FROM users 
WHERE role = 'admin'
ORDER BY email;
