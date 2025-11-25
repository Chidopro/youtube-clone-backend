-- Fix creator_favorites table column name
-- This script will work regardless of whether the column is 'channelTitle' or 'channeltitle'

-- First, check if column exists as lowercase
DO $$
BEGIN
    -- If column exists as 'channeltitle' (lowercase), rename it to quoted 'channelTitle'
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'creator_favorites' 
        AND column_name = 'channeltitle'
    ) THEN
        ALTER TABLE creator_favorites RENAME COLUMN channeltitle TO "channelTitle";
        RAISE NOTICE 'Renamed channeltitle to channelTitle';
    END IF;
    
    -- If column doesn't exist at all, add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'creator_favorites' 
        AND (column_name = 'channelTitle' OR column_name = 'channeltitle')
    ) THEN
        ALTER TABLE creator_favorites ADD COLUMN "channelTitle" VARCHAR(255) NOT NULL DEFAULT 'Unknown';
        RAISE NOTICE 'Added channelTitle column';
    END IF;
END $$;

-- Recreate index with correct column name
DROP INDEX IF EXISTS idx_creator_favorites_channeltitle;
DROP INDEX IF EXISTS idx_creator_favorites_channelTitle;
CREATE INDEX IF NOT EXISTS idx_creator_favorites_channelTitle ON creator_favorites("channelTitle");

