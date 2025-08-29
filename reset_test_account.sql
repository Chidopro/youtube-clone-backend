-- Reset Test Account Subscription Data
-- Run this in Supabase SQL Editor to clean up the test account

-- First, let's see what subscription data exists for the test account
SELECT 
    us.id,
    us.user_id,
    us.tier,
    us.status,
    us.stripe_subscription_id,
    us.stripe_customer_id,
    us.trial_end,
    us.created_at,
    us.updated_at,
    u.email
FROM user_subscriptions us
JOIN users u ON us.user_id = u.id
WHERE u.email = 'chidopro@proton.me';

-- Delete existing subscription data for the test account
DELETE FROM user_subscriptions 
WHERE user_id IN (
    SELECT id FROM users WHERE email = 'chidopro@proton.me'
);

-- Verify the deletion
SELECT 
    us.id,
    us.user_id,
    us.tier,
    us.status,
    u.email
FROM user_subscriptions us
JOIN users u ON us.user_id = u.id
WHERE u.email = 'chidopro@proton.me';

-- Show all remaining subscriptions
SELECT 
    us.id,
    us.user_id,
    us.tier,
    us.status,
    us.created_at,
    u.email
FROM user_subscriptions us
JOIN users u ON us.user_id = u.id
ORDER BY us.created_at DESC;
