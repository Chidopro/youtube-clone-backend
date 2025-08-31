-- Comprehensive check of all user-related tables
-- This will help us find where the user data might still exist

-- Check user_subscriptions table
SELECT 
  'user_subscriptions' as table_name,
  user_id,
  tier,
  status,
  created_at
FROM user_subscriptions 
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'digitalavatartutorial@gmail.com'
);

-- Check if there are any orphaned subscription records
SELECT 
  'orphaned subscriptions' as table_name,
  us.user_id,
  us.tier,
  us.status
FROM user_subscriptions us
LEFT JOIN users u ON us.user_id = u.id
WHERE u.id IS NULL;

-- Check products table for any products by this user
SELECT 
  'products' as table_name,
  id,
  creator_id,
  name,
  created_at
FROM products 
WHERE creator_id IN (
  SELECT id FROM users WHERE email = 'digitalavatartutorial@gmail.com'
);

-- Check sales table for any sales by this user
SELECT 
  'sales' as table_name,
  id,
  creator_id,
  product_id,
  created_at
FROM sales 
WHERE creator_id IN (
  SELECT id FROM users WHERE email = 'digitalavatartutorial@gmail.com'
);

-- Check videos2 table for any videos by this user
SELECT 
  'videos2' as table_name,
  id,
  creator_id,
  title,
  created_at
FROM videos2 
WHERE creator_id IN (
  SELECT id FROM users WHERE email = 'digitalavatartutorial@gmail.com'
);
