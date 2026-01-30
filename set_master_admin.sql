-- Set driveralan1@yahoo.com as master admin
-- This account already has working login, so it's easier than fixing filialsons@gmail.com password hash
-- Master admin has full access to all dashboard settings, subdomain management, etc.
-- NOTE: role = 'creator' is needed to access Dashboard, admin_role = 'master_admin' is for Admin Portal

UPDATE users 
SET admin_role = 'master_admin',
    is_admin = true,
    role = 'creator',  -- Required to access Dashboard with Personalization tab
    status = 'active'
WHERE email = 'driveralan1@yahoo.com';

-- Verify the update
SELECT email, display_name, role, admin_role, is_admin, status, subdomain 
FROM users 
WHERE email = 'driveralan1@yahoo.com';
