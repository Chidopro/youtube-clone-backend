-- Fix RLS Policy for Subdomain Lookups
-- This allows public read access to subdomain and personalization fields
-- so that visitors to creator subdomains can see the creator's branding

-- Drop existing restrictive SELECT policy if it exists
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- Create a new policy that allows:
-- 1. Users to view their own full profile
-- 2. Anyone to view users with subdomains (for public subdomain lookups)
-- This is necessary so visitors to testcreator.screenmerch.com can see the creator's branding
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (
        -- Allow users to see their own profile
        auth.uid() = id
        OR
        -- Allow public access to users who have a subdomain (for subdomain lookups)
        -- This enables the subdomain personalization feature
        (subdomain IS NOT NULL AND subdomain != '')
    );

-- Alternative: More permissive policy that allows viewing all users
-- (Use this if the above doesn't work)
-- DROP POLICY IF EXISTS "Users can view own profile" ON users;
-- CREATE POLICY "Users can view own profile" ON users
--     FOR SELECT USING (true);

-- Verify the policy
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
WHERE tablename = 'users';
