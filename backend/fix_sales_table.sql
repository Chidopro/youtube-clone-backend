-- Fix sales table schema
-- Add missing columns that the backend expects

-- Add creator_name column if it doesn't exist
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS creator_name TEXT;

-- Add created_at column if it doesn't exist
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add updated_at column if it doesn't exist
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have default values
UPDATE sales 
SET creator_name = 'Unknown Creator' 
WHERE creator_name IS NULL;

-- Make sure the columns are not null for future inserts
ALTER TABLE sales 
ALTER COLUMN creator_name SET NOT NULL;

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at 
    BEFORE UPDATE ON sales 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 