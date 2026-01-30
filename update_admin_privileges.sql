-- Update admin privileges
-- Grant admin access to filialsons@gmail.com (Google account)
-- Remove admin access from chidopro@proton.me

-- Step 1: Grant admin access to filialsons@gmail.com
UPDATE users 
SET 
    is_admin = true, 
    admin_role = 'admin'
WHERE email = 'filialsons@gmail.com';

-- Step 2: Remove admin access from chidopro@proton.me
UPDATE users 
SET 
    is_admin = false, 
    admin_role = NULL
WHERE email = 'chidopro@proton.me';

-- Step 3: Verify the changes
SELECT 
    id,
    email,
    display_name,
    is_admin,
    admin_role
FROM users 
WHERE email IN ('filialsons@gmail.com', 'chidopro@proton.me')
ORDER BY email;

