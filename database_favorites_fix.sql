-- Fix for creator_favorites table if it was created without quoted column name
-- This will rename the column from lowercase to camelCase with quotes

-- First, check if the table exists and has the lowercase column
-- If the column is already "channelTitle" (with quotes), this will fail gracefully

-- Drop the old index if it exists
DROP INDEX IF EXISTS idx_creator_favorites_channeltitle;
DROP INDEX IF EXISTS idx_creator_favorites_channelTitle;

-- Rename the column from lowercase to quoted camelCase
ALTER TABLE creator_favorites 
RENAME COLUMN channeltitle TO "channelTitle";

-- Recreate the index with the correct column name
CREATE INDEX IF NOT EXISTS idx_creator_favorites_channelTitle ON creator_favorites("channelTitle");

