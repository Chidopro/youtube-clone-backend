-- Check remaining users in database
-- Run this in Supabase SQL Editor to see what users exist

-- Check users table
SELECT 
    id,
    email,
    display_name,
    created_at
FROM users
ORDER BY created_at DESC;

-- Check auth.users table
SELECT 
    id,
    email,
    created_at
FROM auth.users
ORDER BY created_at DESC;

-- Check if there are any users with the specific email
SELECT 
    'users table' as source,
    id,
    email,
    display_name,
    created_at
FROM users
WHERE email = 'digitalavatartutorial@gmail.com'

UNION ALL

SELECT 
    'auth.users table' as source,
    id,
    email,
    NULL as display_name,
    created_at
FROM auth.users
WHERE email = 'digitalavatartutorial@gmail.com';
