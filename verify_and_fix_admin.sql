-- Step 1: Find the user by email and get their ID
SELECT 
    id,
    email,
    display_name,
    role,
    admin_role,
    is_admin,
    status
FROM users 
WHERE email = 'driveralan1@yahoo.com';

-- Step 2: Update by user ID (more reliable than email)
-- Replace 'USER_ID_HERE' with the actual ID from Step 1
UPDATE users 
SET 
    admin_role = 'master_admin',
    is_admin = true,
    role = 'creator',  -- Required to access Dashboard
    status = 'active'
WHERE email = 'driveralan1@yahoo.com';

-- Step 3: Verify the update
SELECT 
    id,
    email,
    display_name,
    role,
    admin_role,
    is_admin,
    status
FROM users 
WHERE email = 'driveralan1@yahoo.com';
