-- Separate Admin Roles for Security
-- Creates distinct roles: 'admin' (full access) and 'order_processing_admin' (limited access)

-- Add role column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS admin_role VARCHAR(50) DEFAULT NULL;

-- Create admin_roles enum type
DO $$ BEGIN
    CREATE TYPE admin_role_type AS ENUM ('admin', 'order_processing_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update users table to use enum (if you want strict typing)
-- Or keep as VARCHAR for flexibility

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_users_admin_role ON users(admin_role) WHERE admin_role IS NOT NULL;

-- Update processor_permissions to include admin roles
ALTER TABLE processor_permissions
ADD COLUMN IF NOT EXISTS admin_role VARCHAR(50) DEFAULT NULL;

-- Add comment to clarify role separation
COMMENT ON COLUMN users.admin_role IS 'Admin role: "admin" (full access) or "order_processing_admin" (order processing only)';
COMMENT ON COLUMN processor_permissions.admin_role IS 'Admin role for order processing management';

-- Create function to check if user is full admin
CREATE OR REPLACE FUNCTION is_full_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_id 
        AND (is_admin = true AND (admin_role = 'admin' OR admin_role IS NULL))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is order processing admin
CREATE OR REPLACE FUNCTION is_order_processing_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_id 
        AND (
            (is_admin = true AND admin_role = 'order_processing_admin')
            OR (is_admin = true AND admin_role = 'admin') -- Full admins can also access order processing
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_full_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_order_processing_admin(UUID) TO authenticated;

-- Example: Set a user as order processing admin only
-- UPDATE users SET admin_role = 'order_processing_admin', is_admin = true WHERE id = 'user-uuid-here';

-- Example: Set a user as full admin
-- UPDATE users SET admin_role = 'admin', is_admin = true WHERE id = 'user-uuid-here';

