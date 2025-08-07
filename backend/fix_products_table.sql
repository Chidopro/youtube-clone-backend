-- Fix products table schema
-- Add missing creator_name column

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS creator_name TEXT;

-- Update existing products to have a default creator name if needed
UPDATE products 
SET creator_name = 'Unknown Creator' 
WHERE creator_name IS NULL;

-- Make sure the column is not null for future inserts
ALTER TABLE products 
ALTER COLUMN creator_name SET NOT NULL; 