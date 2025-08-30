-- Clear Supabase Auth Users
-- Run this in Supabase SQL Editor to delete auth users

-- First, let's see what auth users exist
SELECT 
    au.id,
    au.email,
    au.created_at,
    au.last_sign_in_at,
    au.confirmed_at
FROM auth.users au
WHERE au.email IN (
    'driveralan1@yahoo.com',
    'digitalavatartutorial@gmail.com',
    'test@example.com',
    'chidopro@proton.me'
);

-- Delete auth users (this will cascade to related data)
DELETE FROM auth.users 
WHERE email IN (
    'driveralan1@yahoo.com',
    'digitalavatartutorial@gmail.com',
    'test@example.com',
    'chidopro@proton.me'
);

-- Verify deletion
SELECT 
    au.id,
    au.email,
    au.created_at
FROM auth.users au
WHERE au.email IN (
    'driveralan1@yahoo.com',
    'digitalavatartutorial@gmail.com',
    'test@example.com',
    'chidopro@proton.me'
);

-- Show remaining auth users
SELECT 
    au.id,
    au.email,
    au.created_at
FROM auth.users au
ORDER BY au.created_at DESC
LIMIT 10;
