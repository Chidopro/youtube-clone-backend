-- Database Migration Script to Add trial_end Column
-- Run this in Supabase SQL Editor to fix the subscription activation error

-- Add trial_end column to user_subscriptions table
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE;

-- Add any other missing columns that might be needed
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Update the tier constraint to ensure it allows 'pro'
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS valid_tier;
ALTER TABLE user_subscriptions ADD CONSTRAINT valid_tier CHECK (tier IN ('free', 'pro'));

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions' 
AND column_name IN ('trial_end', 'stripe_subscription_id', 'stripe_customer_id', 'tier');

-- Show current table structure
SELECT * FROM user_subscriptions LIMIT 1;
