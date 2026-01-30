-- Check the actual data type of channel_id in sales table
SELECT 
    column_name, 
    data_type, 
    udt_name,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'sales'
AND column_name IN ('channel_id', 'friend_id', 'user_id')
ORDER BY column_name;
