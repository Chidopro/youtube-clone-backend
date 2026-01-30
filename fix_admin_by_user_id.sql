-- Update admin status by User ID (from console log: 181e8481-9f14-46e3-a821-16d53e1e6f90)
-- This is more reliable than updating by email

UPDATE users 
SET 
    admin_role = 'master_admin',
    is_admin = true,
    role = 'creator',  -- Required to access Dashboard
    status = 'active'
WHERE id = '181e8481-9f14-46e3-a821-16d53e1e6f90';

-- Verify the update
SELECT 
    id,
    email,
    display_name,
    role,
    admin_role,
    is_admin,
    status,
    created_at
FROM users 
WHERE id = '181e8481-9f14-46e3-a821-16d53e1e6f90';
