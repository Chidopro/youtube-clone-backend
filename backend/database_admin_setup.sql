-- Admin Portal Database Setup
-- This script adds admin functionality to the existing ScreenMerch database

-- Add admin and status columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'pending'));

-- Create admin_logs table for tracking admin actions
CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL, -- 'user', 'video', 'subscription', etc.
    target_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admin_settings table for system configuration
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string', -- 'string', 'boolean', 'number', 'json'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_user_id ON admin_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);

-- Enable RLS on new tables
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin_logs
CREATE POLICY "Admins can view all admin logs" ON admin_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can insert admin logs" ON admin_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Create RLS policies for admin_settings
CREATE POLICY "Admins can view all admin settings" ON admin_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can update admin settings" ON admin_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can insert admin settings" ON admin_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Update existing RLS policies to allow admin access
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile or admins can view all" ON users
    FOR SELECT USING (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM users admin_user 
            WHERE admin_user.id = auth.uid() 
            AND admin_user.is_admin = true
        )
    );

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile or admins can update any" ON users
    FOR UPDATE USING (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM users admin_user 
            WHERE admin_user.id = auth.uid() 
            AND admin_user.is_admin = true
        )
    );

-- Update videos2 policies to allow admin access
DROP POLICY IF EXISTS "Users can view all videos" ON videos2;
CREATE POLICY "Users can view all videos" ON videos2
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own videos" ON videos2;
CREATE POLICY "Users can update their own videos or admins can update any" ON videos2
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM users admin_user 
            WHERE admin_user.id = auth.uid() 
            AND admin_user.is_admin = true
        )
    );

DROP POLICY IF EXISTS "Users can delete their own videos" ON videos2;
CREATE POLICY "Users can delete their own videos or admins can delete any" ON videos2
    FOR DELETE USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM users admin_user 
            WHERE admin_user.id = auth.uid() 
            AND admin_user.is_admin = true
        )
    );

-- Insert default admin settings
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('admin_emails', 'admin@screenmerch.com,cheedov@gmail.com', 'string', 'Comma-separated list of admin email addresses'),
('max_video_size_mb', '100', 'number', 'Maximum video file size in MB'),
('auto_approve_videos', 'false', 'boolean', 'Whether to automatically approve uploaded videos'),
('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode'),
('default_user_tier', 'basic', 'string', 'Default subscription tier for new users'),
('content_moderation_enabled', 'true', 'boolean', 'Enable content moderation features')
ON CONFLICT (setting_key) DO NOTHING;

-- Create function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_user_id UUID,
    p_action_type VARCHAR(50),
    p_target_type VARCHAR(50),
    p_target_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO admin_logs (
        admin_user_id,
        action_type,
        target_type,
        target_id,
        details,
        ip_address,
        user_agent
    ) VALUES (
        p_admin_user_id,
        p_action_type,
        p_target_type,
        p_target_id,
        p_details,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_id 
        AND is_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get admin settings
CREATE OR REPLACE FUNCTION get_admin_setting(setting_key VARCHAR(100))
RETURNS TEXT AS $$
DECLARE
    setting_value TEXT;
BEGIN
    SELECT admin_settings.setting_value INTO setting_value
    FROM admin_settings
    WHERE admin_settings.setting_key = get_admin_setting.setting_key;
    
    RETURN setting_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update admin setting
CREATE OR REPLACE FUNCTION update_admin_setting(
    p_setting_key VARCHAR(100),
    p_setting_value TEXT,
    p_admin_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is admin
    IF NOT is_admin_user(p_admin_user_id) THEN
        RETURN FALSE;
    END IF;
    
    -- Update or insert setting
    INSERT INTO admin_settings (setting_key, setting_value, updated_at)
    VALUES (p_setting_key, p_setting_value, NOW())
    ON CONFLICT (setting_key) 
    DO UPDATE SET 
        setting_value = EXCLUDED.setting_value,
        updated_at = NOW();
    
    -- Log the action
    PERFORM log_admin_action(
        p_admin_user_id,
        'update_setting',
        'admin_setting',
        NULL,
        jsonb_build_object('setting_key', p_setting_key, 'new_value', p_setting_value)
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION log_admin_action(UUID, VARCHAR, VARCHAR, UUID, JSONB, INET, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_setting(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION update_admin_setting(VARCHAR, TEXT, UUID) TO authenticated;

-- Insert sample admin user (replace with actual admin email)
-- UPDATE users SET is_admin = true WHERE email = 'your-admin-email@example.com';

-- Create view for admin dashboard stats
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