-- Comprehensive fix for signup error
-- This script fixes both the tier constraint and the trigger

-- 1. First, update the tier constraint to allow all the tiers we need
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS valid_tier;
ALTER TABLE user_subscriptions ADD CONSTRAINT valid_tier 
CHECK (tier IN ('free', 'pro', 'basic', 'premium', 'creator_network'));

-- 2. Fix the auto_create_user_subscription trigger to use 'free' instead of 'basic'
DROP TRIGGER IF EXISTS auto_create_user_subscription ON users;
DROP FUNCTION IF EXISTS create_user_subscription();

-- Recreate the function with 'free' tier
CREATE OR REPLACE FUNCTION create_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_subscriptions (user_id, tier, status)
    VALUES (NEW.id, 'free', 'active');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the trigger
CREATE TRIGGER auto_create_user_subscription
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_subscription();

-- 3. Verify the changes
SELECT 'Tier constraint and trigger updated successfully' as status;

-- 4. Show current constraint definition
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'valid_tier';
