-- Check Account Status for chidopro@proton.me
-- Run this in Supabase SQL Editor to see what happened

-- Check if user exists in users table
SELECT 
    id,
    email,
    username,
    display_name,
    role,
    created_at,
    updated_at
FROM users 
WHERE email = 'chidopro@proton.me';

-- Check if user has subscription data
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

-- Check all users in the system (to see if account was created)
SELECT 
    id,
    email,
    username,
    display_name,
    role,
    created_at
FROM users 
ORDER BY created_at DESC
LIMIT 10;

-- Check all subscriptions in the system
SELECT 
    us.id,
    us.user_id,
    us.tier,
    us.status,
    us.created_at,
    u.email
FROM user_subscriptions us
JOIN users u ON us.user_id = u.id
ORDER BY us.created_at DESC
LIMIT 10;
