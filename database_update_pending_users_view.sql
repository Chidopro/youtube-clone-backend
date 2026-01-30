-- Update admin_dashboard_stats view to include pending_users
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
    (SELECT COUNT(*) FROM users WHERE status = 'suspended') as suspended_users,
    (SELECT COUNT(*) FROM users WHERE status = 'pending') as pending_users,
    (SELECT COUNT(*) FROM videos2) as total_videos,
    (SELECT COUNT(*) FROM videos2 WHERE verification_status = 'pending') as pending_videos,
    (SELECT COUNT(*) FROM videos2 WHERE verification_status = 'approved') as approved_videos,
    (SELECT COUNT(*) FROM user_subscriptions) as total_subscriptions,
    (SELECT COUNT(*) FROM user_subscriptions WHERE status = 'active') as active_subscriptions,
    (SELECT COUNT(*) FROM user_subscriptions WHERE tier = 'premium') as premium_subscriptions,
    (SELECT COUNT(*) FROM user_subscriptions WHERE tier = 'creator_network') as creator_network_subscriptions;

-- Grant access to the view
GRANT SELECT ON admin_dashboard_stats TO authenticated;

