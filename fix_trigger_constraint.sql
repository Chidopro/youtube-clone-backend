-- Fix the auto_create_user_subscription trigger to use 'free' instead of 'basic'
-- This will resolve the valid_tier constraint violation during signup

-- Drop the existing trigger and function
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

-- Verify the fix
SELECT 'Trigger updated successfully' as status;

