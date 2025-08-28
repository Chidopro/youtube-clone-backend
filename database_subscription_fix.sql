-- Database Migration Script to Fix Subscription System
-- Run this in Supabase SQL Editor to fix the subscription issues

-- 1. Add trial_end column if it doesn't exist
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE;

-- 2. Update the tier constraint to allow 'free' and 'pro' only
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS valid_tier;
ALTER TABLE user_subscriptions ADD CONSTRAINT valid_tier CHECK (tier IN ('free', 'pro'));

-- 3. Update existing subscriptions to use new tier names
UPDATE user_subscriptions SET tier = 'free' WHERE tier = 'basic';
UPDATE user_subscriptions SET tier = 'pro' WHERE tier = 'premium';
UPDATE user_subscriptions SET tier = 'pro' WHERE tier = 'creator_network';

-- 4. Fix the trigger function to use 'free' instead of 'basic'
CREATE OR REPLACE FUNCTION create_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_subscriptions (user_id, tier, status)
    VALUES (NEW.id, 'free', 'active');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Update the default tier in the table definition
ALTER TABLE user_subscriptions ALTER COLUMN tier SET DEFAULT 'free';

-- 6. Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions' 
AND column_name IN ('tier', 'trial_end', 'status');

-- 7. Check current subscriptions
SELECT 
    us.id,
    us.user_id,
    us.tier,
    us.status,
    us.trial_end,
    us.created_at,
    u.email
FROM user_subscriptions us
LEFT JOIN users u ON us.user_id = u.id
ORDER BY us.created_at DESC;

-- 8. Add index on trial_end for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_end ON user_subscriptions(trial_end);

-- 9. Update RLS policies to ensure proper access
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
CREATE POLICY "Users can view own subscription" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions;
CREATE POLICY "Users can update own subscription" ON user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own subscription" ON user_subscriptions;
CREATE POLICY "Users can insert own subscription" ON user_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 10. Ensure public read access for active subscriptions
DROP POLICY IF EXISTS "Public can view user subscriptions" ON user_subscriptions;
CREATE POLICY "Public can view user subscriptions" ON user_subscriptions
    FOR SELECT USING (status = 'active');

-- Success message
SELECT 'Database migration completed successfully!' as status;
