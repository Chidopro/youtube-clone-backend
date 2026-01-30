-- Fix admin_role check constraint to allow 'master_admin'
-- This script drops the old constraint and creates a new one that includes 'master_admin'

-- Step 1: Drop the existing check constraint (if it exists)
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_admin_role_check;

-- Step 2: Add a new check constraint that includes 'master_admin'
ALTER TABLE users 
ADD CONSTRAINT users_admin_role_check 
CHECK (admin_role IS NULL OR admin_role IN ('admin', 'order_processing_admin', 'master_admin'));

-- Step 3: Now you can set filialsons@gmail.com as master admin
UPDATE users 
SET admin_role = 'master_admin', is_admin = true 
WHERE email = 'filialsons@gmail.com';

-- Step 4: Verify the change
SELECT email, is_admin, admin_role 
FROM users 
WHERE email = 'filialsons@gmail.com';

