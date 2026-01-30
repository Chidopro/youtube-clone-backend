-- =====================================================
-- Add display_order column to videos2 table
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Add the display_order column if it doesn't exist
ALTER TABLE videos2 
ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Step 2: Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_videos2_display_order ON videos2(display_order);

-- Step 3: Initialize existing videos with display_order based on created_at
-- This ensures all existing videos have an order value (maintains current order)
UPDATE videos2
SET display_order = subquery.row_num - 1
FROM (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as row_num
    FROM videos2
    WHERE display_order IS NULL
) AS subquery
WHERE videos2.id = subquery.id AND videos2.display_order IS NULL;

-- Step 4: Verify the column was added
-- You can run this to check:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'videos2' AND column_name = 'display_order';
