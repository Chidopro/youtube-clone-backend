-- Check for remaining users in the custom users table
-- This is the table your backend actually uses for authentication

SELECT 
  'custom users table' as source,
  id,
  email,
  display_name,
  created_at
FROM users 
WHERE email = 'digitalavatartutorial@gmail.com';

-- Also check all users in the custom table
SELECT 
  'all custom users' as source,
  id,
  email,
  display_name,
  created_at
FROM users 
ORDER BY created_at DESC
LIMIT 10;
