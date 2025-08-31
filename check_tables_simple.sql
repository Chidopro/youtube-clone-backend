-- Simple check for any remaining user data
-- Let's check what tables exist and their structure first

-- Check user_subscriptions table for any orphaned records
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

-- Check if there are any orphaned subscription records (user_id that doesn't exist in users table)
SELECT 
  'orphaned subscriptions' as table_name,
  us.user_id,
  us.tier,
  us.status
FROM user_subscriptions us
LEFT JOIN users u ON us.user_id = u.id
WHERE u.id IS NULL;

-- Check what columns exist in products table
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'products';

-- Check what columns exist in sales table  
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'sales';

-- Check what columns exist in videos2 table
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'videos2';
