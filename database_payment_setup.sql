-- Add payment and payout fields to users table for multiple payment method integration
-- This allows creators to receive payments from their merch sales via PayPal, ACH, or Stripe

-- Add payment-related columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS paypal_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS payout_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payout_threshold DECIMAL(10,2) DEFAULT 50.00,
ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS pending_payout DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_payout_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_info_verified BOOLEAN DEFAULT FALSE,
-- New fields for multiple payment methods
ADD COLUMN IF NOT EXISTS preferred_payment_method VARCHAR(20) DEFAULT 'paypal' CHECK (preferred_payment_method IN ('paypal', 'ach', 'stripe')),
ADD COLUMN IF NOT EXISTS ach_routing_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS ach_account_number_encrypted VARCHAR(255),
ADD COLUMN IF NOT EXISTS ach_account_type VARCHAR(20) CHECK (ach_account_type IN ('checking', 'savings')),
ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_connect_status VARCHAR(20) DEFAULT 'pending' CHECK (stripe_connect_status IN ('pending', 'active', 'restricted', 'disabled')),
ADD COLUMN IF NOT EXISTS bank_account_verified BOOLEAN DEFAULT FALSE;

-- Create payouts table to track payout history with multiple payment methods
CREATE TABLE IF NOT EXISTS payouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'paypal' CHECK (payment_method IN ('paypal', 'ach', 'stripe')),
    payment_details JSONB, -- Store method-specific details (email, account info, etc.)
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    transaction_id VARCHAR(255), -- Generic transaction ID for any payment method
    payout_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create earnings table to track individual sales
CREATE TABLE IF NOT EXISTS creator_earnings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    sale_amount DECIMAL(10,2) NOT NULL,
    creator_share DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) NOT NULL,
    payout_id UUID REFERENCES payouts(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payment_methods table to store available payment options
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    method_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    fees_percentage DECIMAL(5,2) DEFAULT 0.00,
    fees_fixed DECIMAL(10,2) DEFAULT 0.00,
    processing_time_days INTEGER DEFAULT 1,
    min_payout DECIMAL(10,2) DEFAULT 50.00,
    max_payout DECIMAL(10,2),
    supported_countries TEXT[], -- Array of supported country codes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default payment methods
INSERT INTO payment_methods (method_name, display_name, description, fees_percentage, fees_fixed, processing_time_days, min_payout, supported_countries) VALUES
('paypal', 'PayPal Business', 'Fast, secure PayPal Business payments with low fees', 2.9, 0.30, 1, 50.00, ARRAY['US', 'CA', 'GB', 'AU', 'DE', 'FR']),
('ach', 'Direct Bank Transfer', 'Direct deposit to your bank account with minimal fees', 0.5, 0.25, 3, 50.00, ARRAY['US']),
('stripe', 'Stripe Connect', 'Professional payment processing with advanced features', 2.9, 0.30, 2, 25.00, ARRAY['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'JP', 'SG']);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_paypal_email ON users(paypal_email);
CREATE INDEX IF NOT EXISTS idx_users_payout_enabled ON users(payout_enabled);
CREATE INDEX IF NOT EXISTS idx_users_preferred_payment_method ON users(preferred_payment_method);
CREATE INDEX IF NOT EXISTS idx_users_stripe_connect_account_id ON users(stripe_connect_account_id);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_payment_method ON payouts(payment_method);
CREATE INDEX IF NOT EXISTS idx_payouts_payout_date ON payouts(payout_date);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_user_id ON creator_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_status ON creator_earnings(status);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_payout_id ON creator_earnings(payout_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_active ON payment_methods(is_active);

-- Enable RLS on new tables
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payouts
CREATE POLICY "Users can view own payouts" ON payouts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payouts" ON payouts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Create RLS policies for creator_earnings
CREATE POLICY "Users can view own earnings" ON creator_earnings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all earnings" ON creator_earnings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Create RLS policies for payment_methods (read-only for all authenticated users)
CREATE POLICY "All authenticated users can view payment methods" ON payment_methods
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create function to calculate creator earnings
CREATE OR REPLACE FUNCTION calculate_creator_earnings(sale_amount DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    -- Creator gets 70% of sale amount (30% platform fee)
    RETURN sale_amount * 0.70;
END;
$$ LANGUAGE plpgsql;

-- Create function to update user earnings
CREATE OR REPLACE FUNCTION update_user_earnings()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user's total earnings and pending payout
    UPDATE users 
    SET 
        total_earnings = total_earnings + NEW.creator_share,
        pending_payout = pending_payout + NEW.creator_share,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update user earnings
CREATE TRIGGER trigger_update_user_earnings
    AFTER INSERT ON creator_earnings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_earnings();

-- Create function to get available payment methods for a user
CREATE OR REPLACE FUNCTION get_user_payment_methods(user_country VARCHAR(2) DEFAULT 'US')
RETURNS TABLE (
    method_name VARCHAR(50),
    display_name VARCHAR(100),
    description TEXT,
    fees_percentage DECIMAL(5,2),
    fees_fixed DECIMAL(10,2),
    processing_time_days INTEGER,
    min_payout DECIMAL(10,2),
    is_available BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pm.method_name,
        pm.display_name,
        pm.description,
        pm.fees_percentage,
        pm.fees_fixed,
        pm.processing_time_days,
        pm.min_payout,
        CASE 
            WHEN user_country = ANY(pm.supported_countries) THEN TRUE
            ELSE FALSE
        END as is_available
    FROM payment_methods pm
    WHERE pm.is_active = TRUE
    ORDER BY 
        CASE WHEN user_country = ANY(pm.supported_countries) THEN 0 ELSE 1 END,
        pm.fees_percentage;
END;
$$ LANGUAGE plpgsql;
