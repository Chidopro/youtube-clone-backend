-- Fix orders table to include creator_user_id and subdomain columns
-- This ensures subdomain purchases are properly tracked for creator analytics

-- Add creator_user_id column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS creator_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add subdomain column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS subdomain VARCHAR(255);

-- Add video_url column if it doesn't exist (for completeness)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add screenshot_timestamp column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS screenshot_timestamp VARCHAR(50);

-- Create index on creator_user_id for faster analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_creator_user_id ON orders(creator_user_id);

-- Create index on subdomain for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_subdomain ON orders(subdomain);

-- Update RLS policy to allow service role to access all orders (if not already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' 
        AND policyname = 'Service role can manage all orders'
    ) THEN
        CREATE POLICY "Service role can manage all orders" ON orders
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;
