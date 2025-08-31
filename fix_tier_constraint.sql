-- Fix the tier constraint to allow the tier values we need
-- This will resolve the signup error

-- Drop the existing constraint
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS valid_tier;

-- Add the new constraint that allows all the tier values we need
ALTER TABLE user_subscriptions ADD CONSTRAINT valid_tier 
CHECK (tier IN ('free', 'pro', 'basic', 'premium', 'creator_network'));

-- Verify the constraint was updated
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'valid_tier';

-- Test that 'basic' tier now works
INSERT INTO user_subscriptions (user_id, tier, status, current_period_start)
VALUES ('00000000-0000-0000-0000-000000000000', 'basic', 'active', NOW())
ON CONFLICT DO NOTHING;

-- Clean up test data
DELETE FROM user_subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000000';
