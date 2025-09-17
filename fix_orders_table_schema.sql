-- Add missing columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS video_title TEXT,
ADD COLUMN IF NOT EXISTS creator_name TEXT;

-- Update existing orders to have default values
UPDATE orders 
SET 
    video_url = COALESCE(video_url, 'Not provided'),
    video_title = COALESCE(video_title, 'Unknown Video'),
    creator_name = COALESCE(creator_name, 'Unknown Creator')
WHERE video_url IS NULL OR video_title IS NULL OR creator_name IS NULL;
