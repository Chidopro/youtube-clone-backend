-- Test what tier values are allowed in the database
-- This will help us understand the current constraint

-- Check the current constraint definition
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'valid_tier';

-- Try to insert with different tier values to see which ones work
-- Test 'basic' tier
INSERT INTO user_subscriptions (user_id, tier, status, current_period_start)
VALUES ('00000000-0000-0000-0000-000000000000', 'basic', 'active', NOW())
ON CONFLICT DO NOTHING;

-- Test 'free' tier  
INSERT INTO user_subscriptions (user_id, tier, status, current_period_start)
VALUES ('00000000-0000-0000-0000-000000000001', 'free', 'active', NOW())
ON CONFLICT DO NOTHING;

-- Test 'pro' tier
INSERT INTO user_subscriptions (user_id, tier, status, current_period_start)
VALUES ('00000000-0000-0000-0000-000000000002', 'pro', 'active', NOW())
ON CONFLICT DO NOTHING;

-- Clean up test data
DELETE FROM user_subscriptions WHERE user_id IN (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001', 
    '00000000-0000-0000-0000-000000000002'
);
