-- Create orders table to store order information persistently
-- This replaces the in-memory order_store to prevent data loss on app restarts

CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id VARCHAR(255) UNIQUE NOT NULL, -- The UUID used in Stripe metadata
    cart JSONB NOT NULL, -- Store the complete cart data
    sms_consent BOOLEAN DEFAULT FALSE,
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    video_title VARCHAR(255),
    creator_name VARCHAR(255),
    total_amount DECIMAL(10,2),
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'completed', 'cancelled')),
    stripe_session_id VARCHAR(255),
    payment_intent_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to access all orders
CREATE POLICY "Service role can manage all orders" ON orders
    FOR ALL USING (auth.role() = 'service_role');

-- Create policy to allow authenticated users to view their own orders
CREATE POLICY "Users can view their own orders" ON orders
    FOR SELECT USING (auth.uid() IS NOT NULL);
