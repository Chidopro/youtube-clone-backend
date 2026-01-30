-- Diagnostic queries to check if sales are being tracked correctly
-- Run these in Supabase SQL Editor to diagnose the analytics issue

-- 1. Check if the orders table has creator_user_id column
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('creator_user_id', 'subdomain')
ORDER BY column_name;

-- 2. Check recent orders and see if creator_user_id is populated
SELECT 
    order_id,
    creator_name,
    creator_user_id,
    subdomain,
    status,
    total_amount,
    created_at
FROM orders
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check recent sales and see if user_id is populated
-- Note: If creator_name column doesn't exist, remove it from SELECT
SELECT 
    id,
    product_name,
    amount,
    user_id,  -- This should match the creator's user_id (CRITICAL - should NOT be NULL)
    channel_id,
    created_at
FROM sales
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if testcreator user exists and get their user_id
SELECT 
    id,
    display_name,
    username,
    subdomain,
    role
FROM users
WHERE subdomain = 'testcreator' OR display_name ILIKE '%testcreator%' OR username ILIKE '%testcreator%';

-- 5. Check sales for a specific creator (replace USER_ID_HERE with actual user_id from query 4)
-- First run query 4 to get the user_id, then run this:
/*
SELECT 
    id,
    product_name,
    amount,
    user_id,
    creator_name,
    created_at
FROM sales
WHERE user_id = 'USER_ID_HERE'  -- Replace with actual user_id
ORDER BY created_at DESC;
*/
