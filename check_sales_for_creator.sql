-- Check if sales were recorded with the correct user_id
-- Use the creator_user_id from orders: 77d7e054-785a-46ff-b235-ff3ae94e5d18

-- Check recent sales (last 2 hours)
SELECT 
    id,
    product_name,
    amount,
    user_id,  -- ⚠️ Should match: 77d7e054-785a-46ff-b235-ff3ae94e5d18
    creator_name,
    created_at
FROM sales
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 10;

-- Also check sales specifically for testcreator's user_id
SELECT 
    id,
    product_name,
    amount,
    user_id,
    creator_name,
    created_at
FROM sales
WHERE user_id = '77d7e054-785a-46ff-b235-ff3ae94e5d18'
ORDER BY created_at DESC
LIMIT 10;
