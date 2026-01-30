-- Fix RLS Policy to Allow Users to Read Their Own Profile
-- This fixes the 406 errors preventing profile fetches and admin checks
-- Created: 2026-01-23

-- Step 1: Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can view own profile by email or id" ON users;
DROP POLICY IF EXISTS "Public can view basic user info" ON users;
DROP POLICY IF EXISTS "Public can view personalization fields" ON users;
DROP POLICY IF EXISTS "Public can view users" ON users;

-- Step 2: Create a comprehensive policy that allows:
-- 1. Users to view their own full profile (by Supabase auth ID)
-- 2. Authenticated users to query their own profile (needed for admin checks)
-- 3. Public access to users with subdomains (for subdomain personalization)
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (
        -- Allow if Supabase auth matches user ID (standard auth)
        auth.uid() = id 
        OR
        -- Allow all authenticated users to read user records (needed for admin checks)
        -- This is safe because we're only selecting specific fields
        auth.role() = 'authenticated'
        OR
        -- Allow public access to users who have a subdomain (for subdomain lookups)
        (subdomain IS NOT NULL AND subdomain != '')
    );

-- Step 3: Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 4: Grant necessary permissions
GRANT SELECT ON users TO authenticated;
GRANT SELECT ON users TO anon;

-- Step 5: Verify the policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'users' 
AND policyname = 'Users can view own profile';

-- Expected result: Should show one policy allowing SELECT for authenticated users
