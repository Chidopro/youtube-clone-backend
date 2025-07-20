-- Create products table for ScreenMerch application
-- This table stores product data permanently

CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id VARCHAR(255) UNIQUE NOT NULL,
    thumbnail_url TEXT,
    video_url TEXT,
    screenshots_urls TEXT[], -- Array of screenshot URLs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on product_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_product_id ON products(product_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_products_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW 
    EXECUTE FUNCTION update_products_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policies for the products table
-- Allow public read access to all products
CREATE POLICY "Public can view products" ON products
    FOR SELECT USING (true);

-- Allow authenticated users to insert products
CREATE POLICY "Authenticated users can insert products" ON products
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update their own products (if you add user_id field later)
-- CREATE POLICY "Users can update own products" ON products
--     FOR UPDATE USING (auth.uid() = user_id);

-- Create storage bucket for product images
-- Note: This needs to be done in the Supabase dashboard under Storage
-- Bucket name: product-images
-- Public bucket: true 