-- Check the actual column names in creator_favorites table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'creator_favorites'
ORDER BY ordinal_position;

