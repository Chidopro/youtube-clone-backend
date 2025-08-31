-- Delete specific user from auth.users table
-- This will remove the user that's preventing signup

DELETE FROM auth.users 
WHERE email = 'digitalavatartutorial@gmail.com';

-- Verify the deletion
SELECT 
  'auth.users table' as source,
  id,
  email,
  created_at
FROM auth.users 
WHERE email = 'digitalavatartutorial@gmail.com';
