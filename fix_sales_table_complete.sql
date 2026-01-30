-- Complete fix for sales table - add all missing columns
-- Run this in Supabase SQL Editor

-- Add created_at column if it doesn't exist (CRITICAL for analytics)
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add updated_at column if it doesn't exist
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add creator_name column if it doesn't exist
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS creator_name TEXT;

-- Add video_url column if it doesn't exist
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add screenshot_timestamp column if it doesn't exist
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS screenshot_timestamp VARCHAR(50);

-- Update existing records to have default created_at if NULL
UPDATE sales 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- Update existing records to have default creator_name if NULL
UPDATE sales 
SET creator_name = 'Unknown Creator' 
WHERE creator_name IS NULL;

-- Create index on created_at for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
