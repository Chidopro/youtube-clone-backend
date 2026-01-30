-- Add creator_name column to sales table if it doesn't exist
-- This is needed for analytics to work properly

ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS creator_name TEXT;

-- Also add video_url and screenshot_timestamp if they don't exist (for completeness)
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS screenshot_timestamp VARCHAR(50);

-- Update existing records to have default values
UPDATE sales 
SET creator_name = 'Unknown Creator' 
WHERE creator_name IS NULL;
