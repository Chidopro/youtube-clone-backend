-- Verify admin status for driveralan1@yahoo.com
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
WHERE email = 'driveralan1@yahoo.com';
