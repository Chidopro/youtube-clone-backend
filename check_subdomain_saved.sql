-- Diagnostic query to check if subdomain was saved for a specific user
-- Replace 'alancraigdigital@gmail.com' with your actual email

-- Check user by email
SELECT 
    id,
    email,
    display_name,
    subdomain,
    personalization_enabled,
    primary_color,
    secondary_color,
    hide_screenmerch_branding,
    created_at,
    updated_at
FROM users
WHERE email = 'alancraigdigital@gmail.com';

-- Check all users with subdomains
SELECT 
    id,
    email,
    display_name,
    subdomain,
    personalization_enabled
FROM users
WHERE subdomain IS NOT NULL AND subdomain != ''
ORDER BY updated_at DESC;

-- Check if subdomain column exists and has data
SELECT 
    COUNT(*) as total_users,
    COUNT(subdomain) as users_with_subdomain,
    COUNT(CASE WHEN subdomain = 'testcreator' THEN 1 END) as testcreator_count
FROM users;
