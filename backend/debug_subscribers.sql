-- Debug query to check current users and their subscriptions
-- Run this in Supabase SQL Editor to see what data exists

-- First, let's see all users
SELECT id, email, username, display_name, created_at 
FROM users 
ORDER BY created_at DESC;

-- Then let's see all user subscriptions
SELECT 
    us.id,
    us.user_id,
    us.tier,
    us.status,
    us.created_at,
    u.email,
    u.username,
    u.display_name
FROM user_subscriptions us
LEFT JOIN users u ON us.user_id = u.id
ORDER BY us.created_at DESC;

-- Check if we have any channel subscriptions
SELECT 
    s.id,
    s.channel_id,
    s.subscriber_id,
    s.created_at,
    channel.username as channel_username,
    subscriber.username as subscriber_username
FROM subscriptions s
LEFT JOIN users channel ON s.channel_id = channel.id
LEFT JOIN users subscriber ON s.subscriber_id = subscriber.id
ORDER BY s.created_at DESC;

-- Check for any auth.users that might not have corresponding users records
-- Note: This might not work depending on RLS, but try it
SELECT email FROM auth.users; 