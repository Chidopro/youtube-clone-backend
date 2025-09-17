-- Add print quality image columns to orders table
-- This allows storing auto-generated print quality images for each order

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS print_quality_image TEXT,
ADD COLUMN IF NOT EXISTS print_quality_dimensions JSONB,
ADD COLUMN IF NOT EXISTS print_quality_file_size INTEGER,
ADD COLUMN IF NOT EXISTS print_quality_generated_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_print_quality_generated_at ON orders(print_quality_generated_at);

-- Add comment to document the new columns
COMMENT ON COLUMN orders.print_quality_image IS 'Base64 encoded print quality image (300 DPI PNG)';
COMMENT ON COLUMN orders.print_quality_dimensions IS 'Image dimensions (width, height, dpi)';
COMMENT ON COLUMN orders.print_quality_file_size IS 'File size in bytes';
COMMENT ON COLUMN orders.print_quality_generated_at IS 'Timestamp when print quality image was generated';
