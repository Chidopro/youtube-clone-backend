-- Grant Admin Access to alancraigdigital@gmail.com
-- Simple version - just sets is_admin = true (works without admin_role column)

UPDATE users 
SET is_admin = true 
WHERE email = 'alancraigdigital@gmail.com';

-- Verify the update
SELECT id, email, display_name, is_admin 
FROM users 
WHERE email = 'alancraigdigital@gmail.com';

