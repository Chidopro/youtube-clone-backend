-- Delete test users directly from the database
-- This bypasses any RLS policies that might be preventing deletion

-- First, delete from user_subscriptions table
DELETE FROM user_subscriptions 
WHERE user_id IN (
  SELECT id FROM users 
  WHERE email IN (
    'digitalavatartutorial@gmail.com',
    'test@example.com',
    'chidopro@proton.me',
    'chidopro2@proton.me',
    'driveralan1@yahoo.com'
  )
);

-- Then delete from users table
DELETE FROM users 
WHERE email IN (
  'digitalavatartutorial@gmail.com',
  'test@example.com',
  'chidopro@proton.me',
  'chidopro2@proton.me',
  'driveralan1@yahoo.com'
);

-- Verify deletion
SELECT 
  'remaining users' as status,
  id,
  email,
  created_at
FROM users 
ORDER BY created_at DESC
LIMIT 10;
