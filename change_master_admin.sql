-- Change Master Admin to alancraigdigital@gmail.com
-- This script updates the master admin role

-- Step 1: Check current admin roles
SELECT email, is_admin, admin_role 
FROM users 
WHERE email IN ('alancraigdigital@gmail.com', 'filialsons@gmail.com')
ORDER BY email;

-- Step 2: Update alancraigdigital@gmail.com to Master Admin
UPDATE users 
SET admin_role = 'master_admin', is_admin = true 
WHERE email = 'alancraigdigital@gmail.com';

-- Step 3: (Optional) Change filialsons@gmail.com to Order Processing Admin
-- Uncomment the line below if you want to change filialsons@gmail.com to Order Processing Admin
-- UPDATE users 
-- SET admin_role = 'order_processing_admin', is_admin = true 
-- WHERE email = 'filialsons@gmail.com';

-- Step 4: Verify the changes
SELECT email, is_admin, admin_role 
FROM users 
WHERE email IN ('alancraigdigital@gmail.com', 'filialsons@gmail.com')
ORDER BY email;

