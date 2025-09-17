
-- Add missing customer_name field to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

-- Add shipping address fields if they don't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;

-- Update existing orders to have proper customer info structure
UPDATE orders 
SET customer_name = 'Not provided' 
WHERE customer_name IS NULL;

-- Create index for customer_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders(customer_name);
