-- Add display_order column to videos2 table for video reordering
-- This allows creators to set custom order for their videos

ALTER TABLE videos2 
ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Create an index on display_order for better query performance
CREATE INDEX IF NOT EXISTS idx_videos2_display_order ON videos2(display_order);

-- Update existing videos to have display_order based on created_at (so they maintain current order)
-- This ensures existing videos have an order value
UPDATE videos2
SET display_order = subquery.row_num - 1
FROM (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as row_num
    FROM videos2
) AS subquery
WHERE videos2.id = subquery.id;

-- Add comment to column
COMMENT ON COLUMN videos2.display_order IS 'Custom display order for videos set by creator. Lower numbers appear first.';
