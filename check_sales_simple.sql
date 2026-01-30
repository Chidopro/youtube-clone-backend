-- Simple query to check sales - works even if some columns are missing
-- Run this FIRST to see what columns actually exist

-- First, check what columns exist in sales table
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'sales'
ORDER BY ordinal_position;

-- Then check recent sales (without created_at filter if column doesn't exist)
SELECT 
    id,
    product_name,
    amount,
    user_id,  -- ⚠️ This is critical - should NOT be NULL
    channel_id
FROM sales
ORDER BY id DESC  -- Order by ID instead of created_at
LIMIT 10;
