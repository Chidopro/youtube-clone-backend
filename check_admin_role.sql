-- Check current admin role for filialsons@gmail.com
SELECT email, is_admin, admin_role 
FROM users 
WHERE email = 'filialsons@gmail.com';

-- Check all admins and their roles
SELECT email, is_admin, admin_role 
FROM users 
WHERE is_admin = true
ORDER BY admin_role;

