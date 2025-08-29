-- Add payment and payout fields to users table for PayPal Business integration
-- This allows creators to receive payments from their merch sales

-- Add payment-related columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS paypal_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS payout_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payout_threshold DECIMAL(10,2) DEFAULT 50.00,
ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS pending_payout DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_payout_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_info_verified BOOLEAN DEFAULT FALSE;

-- Create payouts table to track payout history
CREATE TABLE IF NOT EXISTS payouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    paypal_email VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    paypal_transaction_id VARCHAR(255),
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_paypal_email ON users(paypal_email);
CREATE INDEX IF NOT EXISTS idx_users_payout_enabled ON users(payout_enabled);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_payout_date ON payouts(payout_date);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_user_id ON creator_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_status ON creator_earnings(status);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_payout_id ON creator_earnings(payout_id);

-- Enable RLS on new tables
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;

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
DROP TRIGGER IF EXISTS trigger_update_user_earnings ON creator_earnings;
CREATE TRIGGER trigger_update_user_earnings
    AFTER INSERT ON creator_earnings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_earnings();
