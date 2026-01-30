-- Step 1: Check if admin_role column exists (if error, run the ALTER TABLE first)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'admin_role';

-- Step 2: If column doesn't exist, add it
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS admin_role VARCHAR(50) DEFAULT NULL CHECK (admin_role IN ('admin', 'order_processing_admin'));

-- Step 3: Check current status of both users
SELECT 
    email, 
    display_name,
    is_admin, 
    admin_role,
    created_at
FROM users 
WHERE email IN ('filialsons@gmail.com', 'chidopro@proton.me')
ORDER BY email;

-- Step 4: Set filialsons@gmail.com as full admin
UPDATE users 
SET 
    is_admin = true, 
    admin_role = 'admin'
WHERE email = 'filialsons@gmail.com';

-- Step 5: Remove admin from chidopro@proton.me (if needed)
UPDATE users 
SET 
    is_admin = false, 
    admin_role = NULL
WHERE email = 'chidopro@proton.me';

-- Step 6: Verify final status
SELECT 
    email, 
    display_name,
    is_admin, 
    admin_role
FROM users 
WHERE email IN ('filialsons@gmail.com', 'chidopro@proton.me')
ORDER BY email;

