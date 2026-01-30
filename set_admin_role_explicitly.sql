-- Set admin_role explicitly to 'admin' for filialsons@gmail.com
UPDATE users 
SET admin_role = 'admin'
WHERE email = 'filialsons@gmail.com';

-- Verify it's set correctly
SELECT email, is_admin, admin_role 
FROM users 
WHERE email = 'filialsons@gmail.com';

-- Should show:
-- is_admin = true
-- admin_role = 'admin' (not NULL)

