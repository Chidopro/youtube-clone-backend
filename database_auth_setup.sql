-- Authentication Setup for ScreenMerch
-- This script adds authentication columns to the existing users table

-- Add authentication columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('customer', 'creator', 'admin')),
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned'));

-- Create index for email lookups (if not already exists)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create index for admin lookups
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Update RLS policies to allow authentication
-- Allow public access for login/signup (we'll handle auth in the application layer)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Public can view users for authentication" ON users
    FOR SELECT USING (true);

-- Allow users to insert their own profile during signup
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Public can insert users for signup" ON users
    FOR INSERT WITH CHECK (true);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Create a function to hash passwords (for future use with proper hashing)
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    -- For now, return the password as-is (replace with proper hashing in production)
    -- In production, use: RETURN crypt(password, gen_salt('bf'));
    RETURN password;
END;
$$ LANGUAGE plpgsql;

-- Create a function to verify passwords
CREATE OR REPLACE FUNCTION verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- For now, simple comparison (replace with proper verification in production)
    -- In production, use: RETURN crypt(password, hash) = hash;
    RETURN password = hash;
END;
$$ LANGUAGE plpgsql;

-- Insert default admin user if needed (replace with your email)
-- Uncomment and modify the line below to create a default admin
-- INSERT INTO users (email, password_hash, role, is_admin, display_name) 
-- VALUES ('admin@screenmerch.com', 'admin123', 'admin', true, 'Admin User')
-- ON CONFLICT (email) DO NOTHING;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON users TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Enable RLS if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Log the setup completion
DO $$
BEGIN
    RAISE NOTICE 'Authentication setup completed successfully!';
    RAISE NOTICE 'Users table now supports email/password authentication.';
    RAISE NOTICE 'Remember to implement proper password hashing in production!';
END $$; 