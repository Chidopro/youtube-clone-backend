-- Add admin_role column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS admin_role VARCHAR(50) DEFAULT NULL CHECK (admin_role IN ('admin', 'order_processing_admin'));

-- Update existing admin users to have admin_role = 'admin'
UPDATE users 
SET admin_role = 'admin'
WHERE is_admin = true AND admin_role IS NULL;

-- Now set filialsons@gmail.com as full admin
UPDATE users 
SET 
    is_admin = true, 
    admin_role = 'admin'
WHERE email = 'filialsons@gmail.com';

-- Verify the changes
SELECT email, is_admin, admin_role 
FROM users 
WHERE email = 'filialsons@gmail.com';

