-- Master Admin and Regular Admin Roles Setup
-- Creates: 'master_admin' (full access), 'order_processing_admin' (order processing only)

-- Update admin_role column to support master_admin
-- The column already exists from previous migration, just need to ensure it supports the new role

-- Update comment to include master_admin
COMMENT ON COLUMN users.admin_role IS 'Admin role: "master_admin" (full access, oversees all), "admin" (full access), or "order_processing_admin" (order processing only)';

-- Create function to check if user is master admin
CREATE OR REPLACE FUNCTION is_master_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_id 
        AND is_admin = true 
        AND admin_role = 'master_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update function to check if user is full admin (includes master_admin and admin)
CREATE OR REPLACE FUNCTION is_full_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_id 
        AND is_admin = true 
        AND (admin_role = 'master_admin' OR admin_role = 'admin' OR admin_role IS NULL)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update function to check if user is order processing admin (includes all admin types)
CREATE OR REPLACE FUNCTION is_order_processing_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_id 
        AND is_admin = true 
        AND (
            admin_role = 'order_processing_admin' 
            OR admin_role = 'admin' 
            OR admin_role = 'master_admin'
            OR admin_role IS NULL
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_master_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_full_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_order_processing_admin(UUID) TO authenticated;

-- Create admin_signup_requests table for pending admin registrations
CREATE TABLE IF NOT EXISTS admin_signup_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_signup_requests_email ON admin_signup_requests(email);
CREATE INDEX IF NOT EXISTS idx_admin_signup_requests_status ON admin_signup_requests(status);

-- Enable RLS on admin_signup_requests
ALTER TABLE admin_signup_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only master admins can view all signup requests
CREATE POLICY "Master admins can view all admin signup requests" ON admin_signup_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true 
            AND users.admin_role = 'master_admin'
        )
    );

-- RLS Policy: Anyone can create a signup request
CREATE POLICY "Anyone can create admin signup request" ON admin_signup_requests
    FOR INSERT
    WITH CHECK (true);

-- RLS Policy: Only master admins can update signup requests
CREATE POLICY "Master admins can update admin signup requests" ON admin_signup_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true 
            AND users.admin_role = 'master_admin'
        )
    );

-- Example: Set a user as master admin
-- UPDATE users SET admin_role = 'master_admin', is_admin = true WHERE email = 'your-email@example.com';

-- Example: Set a user as order processing admin
-- UPDATE users SET admin_role = 'order_processing_admin', is_admin = true WHERE email = 'helper-admin@example.com';

