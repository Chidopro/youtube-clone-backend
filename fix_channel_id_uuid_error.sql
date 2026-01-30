-- Check if channel_id is UUID type (which would cause the error)
SELECT 
    column_name, 
    data_type, 
    udt_name
FROM information_schema.columns 
WHERE table_name = 'sales'
AND column_name = 'channel_id';

-- If channel_id is UUID, we need to either:
-- 1. Change it to VARCHAR (recommended)
-- 2. Or remove the 'cheedo_v' fallback from code

-- Option 1: Change channel_id to VARCHAR (if it's currently UUID)
-- ALTER TABLE sales ALTER COLUMN channel_id TYPE VARCHAR(255);

-- Option 2: If channel_id should stay UUID, we need to remove string values from code
