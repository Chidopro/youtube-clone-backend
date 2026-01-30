-- Clean up and fix RLS policies for subdomain lookups
-- This removes conflicting policies and ensures public access to subdomain fields

-- Drop ALL existing SELECT policies on users table (we'll recreate the correct one)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Public can view basic user info" ON users;
DROP POLICY IF EXISTS "Public can view personalization fields" ON users;
DROP POLICY IF EXISTS "Public can view users" ON users;
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON users;

-- Create a single, clear SELECT policy that allows:
-- 1. Users to view their own profile
-- 2. Anyone to view users who have a subdomain (for public subdomain lookups)
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (
        -- Allow users to see their own profile
        auth.uid() = id
        OR
        -- Allow public access to users who have a subdomain (for subdomain lookups)
        -- This enables the subdomain personalization feature
        (subdomain IS NOT NULL AND subdomain != '')
    );

-- Verify the policy was created correctly
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'SELECT';

-- Also verify that subdomains exist in the database
SELECT 
    id,
    email,
    display_name,
    subdomain,
    personalization_enabled,
    primary_color,
    secondary_color
FROM users
WHERE subdomain IS NOT NULL AND subdomain != '';
