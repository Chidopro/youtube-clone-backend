-- Verify and fix subdomain setup for testcreator
-- Run this in Supabase SQL Editor

-- 1. Check if testcreator user exists and has subdomain
SELECT 
    id,
    email,
    display_name,
    subdomain,
    personalization_enabled,
    primary_color,
    secondary_color,
    password_hash IS NOT NULL as has_password,
    role,
    status
FROM users
WHERE email = 'alancraigdigital@gmail.com' OR subdomain = 'testcreator';

-- 2. Update testcreator subdomain if missing or incorrect
UPDATE users
SET 
    subdomain = 'testcreator',
    personalization_enabled = COALESCE(personalization_enabled, true),
    role = COALESCE(role, 'creator'),
    status = COALESCE(status, 'active')
WHERE email = 'alancraigdigital@gmail.com'
RETURNING id, email, subdomain, role, status;

-- 3. Verify the update
SELECT 
    id,
    email,
    display_name,
    subdomain,
    personalization_enabled,
    role,
    status
FROM users
WHERE email = 'alancraigdigital@gmail.com';

-- 4. List all users with subdomains for verification
SELECT 
    id,
    email,
    display_name,
    subdomain,
    role,
    status
FROM users
WHERE subdomain IS NOT NULL AND subdomain != ''
ORDER BY subdomain;
