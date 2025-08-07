-- Create sales table for tracking product sales
-- This table stores sales data for analytics and reporting

CREATE TABLE IF NOT EXISTS sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    product_id VARCHAR(255),
    product_name VARCHAR(255) NOT NULL,
    video_id VARCHAR(255),
    video_title VARCHAR(255),
    image_url TEXT,
    amount DECIMAL(10,2) NOT NULL,
    friend_id VARCHAR(255),
    channel_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_product_name ON sales(product_name);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_channel_id ON sales(channel_id);

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_sales_updated_at 
    BEFORE UPDATE ON sales 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sales table
-- Allow users to view their own sales
CREATE POLICY "Users can view their own sales" ON sales
    FOR SELECT USING (auth.uid() = user_id);

-- Allow authenticated users to insert sales records
CREATE POLICY "Authenticated users can insert sales" ON sales
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow service role to manage all sales (for admin functions)
CREATE POLICY "Service role can manage all sales" ON sales
    FOR ALL USING (auth.role() = 'service_role'); 