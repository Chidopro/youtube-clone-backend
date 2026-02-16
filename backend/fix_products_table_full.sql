-- Run this in Supabase SQL Editor to align products table with the app.
-- Fixes: "Could not find the 'creator_name' column" and related 400s.
-- Safe to run multiple times (IF NOT EXISTS / DO blocks).

-- Add columns the app expects (no-op if they already exist)
ALTER TABLE products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS creator_name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;

-- App sends screenshots as a JSON string; if your column is TEXT[] and causes errors, add a text column and use it
-- If you already have screenshots_urls as TEXT, skip the next line
ALTER TABLE products ADD COLUMN IF NOT EXISTS screenshots_urls TEXT;

-- Backfill creator_name for existing rows (so NOT NULL won't break)
UPDATE products SET creator_name = 'Unknown Creator' WHERE creator_name IS NULL;

-- Optional: make creator_name required for new rows (uncomment if you want)
-- ALTER TABLE products ALTER COLUMN creator_name SET NOT NULL;
