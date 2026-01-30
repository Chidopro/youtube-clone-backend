-- PayPal-Only Payout System Setup
-- Simplified version for PayPal payouts only
-- Run this in your Supabase SQL Editor

-- Add PayPal payout fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS paypal_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS pending_payout DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_payout_date TIMESTAMP WITH TIME ZONE;

-- Create payouts table to track payout history
CREATE TABLE IF NOT EXISTS payouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'paypal',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    transaction_id VARCHAR(255), -- PayPal transaction ID (optional)
    payout_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create creator_earnings table to track individual sales
CREATE TABLE IF NOT EXISTS creator_earnings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    sale_amount DECIMAL(10,2) NOT NULL,
    creator_share DECIMAL(10,2) NOT NULL, -- 70% of sale
    platform_fee DECIMAL(10,2) NOT NULL, -- 30% of sale
    payout_id UUID REFERENCES payouts(id), -- Links to payout when paid
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_paypal_email ON users(paypal_email);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_payout_date ON payouts(payout_date);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_user_id ON creator_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_status ON creator_earnings(status);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_payout_id ON creator_earnings(payout_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_order_id ON creator_earnings(order_id);

-- Enable RLS on new tables
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payouts
-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can view own payouts" ON payouts;
DROP POLICY IF EXISTS "Admins can manage all payouts" ON payouts;
DROP POLICY IF EXISTS "Admins can view all payouts" ON payouts;

-- Users can view their own payouts
CREATE POLICY "Users can view own payouts" ON payouts
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view and manage all payouts
CREATE POLICY "Admins can manage all payouts" ON payouts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Create RLS policies for creator_earnings
-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can view own earnings" ON creator_earnings;
DROP POLICY IF EXISTS "Admins can manage all earnings" ON creator_earnings;
DROP POLICY IF EXISTS "Admins can view all earnings" ON creator_earnings;

-- Users can view their own earnings
CREATE POLICY "Users can view own earnings" ON creator_earnings
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view and manage all earnings
CREATE POLICY "Admins can manage all earnings" ON creator_earnings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Create function to calculate creator earnings (70% of sale)
CREATE OR REPLACE FUNCTION calculate_creator_earnings(sale_amount DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    -- Creator gets 70% of sale amount (30% platform fee)
    RETURN sale_amount * 0.70;
END;
$$ LANGUAGE plpgsql;

-- Create function to update user earnings totals
CREATE OR REPLACE FUNCTION update_user_earnings()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user's total earnings and pending payout when new earnings are added
    IF TG_OP = 'INSERT' THEN
        UPDATE users 
        SET 
            total_earnings = COALESCE(total_earnings, 0) + NEW.creator_share,
            pending_payout = COALESCE(pending_payout, 0) + NEW.creator_share,
            updated_at = NOW()
        WHERE id = NEW.user_id;
        RETURN NEW;
    END IF;
    
    -- Update user's pending payout when earnings are marked as paid
    IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'paid' THEN
        UPDATE users 
        SET 
            pending_payout = COALESCE(pending_payout, 0) - OLD.creator_share,
            last_payout_date = COALESCE(NEW.updated_at, NOW()),
            updated_at = NOW()
        WHERE id = NEW.user_id;
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update user earnings
DROP TRIGGER IF EXISTS trigger_update_user_earnings ON creator_earnings;
CREATE TRIGGER trigger_update_user_earnings
    AFTER INSERT OR UPDATE ON creator_earnings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_earnings();

-- Grant necessary permissions (if needed)
-- Note: Supabase handles most permissions automatically, but you may need to adjust based on your setup

