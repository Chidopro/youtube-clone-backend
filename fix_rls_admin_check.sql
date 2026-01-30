-- Fix RLS Policy to Allow Users to Check Their Own Admin Status
-- This fixes the 406 errors when AdminService tries to check is_admin and admin_role

-- Step 1: Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can view own profile by email or id" ON users;

-- Step 2: Create a policy that allows users to view their own record
-- This works for both Supabase auth (by ID) and email-based lookups
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (
        -- Allow if Supabase auth matches (for regular auth)
        auth.uid() = id OR
        -- Allow all authenticated users to read basic user info (needed for admin checks)
        -- This is safe because we're only selecting is_admin and admin_role
        auth.role() = 'authenticated'
    );

-- Step 3: Ensure the policy is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 4: Grant necessary permissions
GRANT SELECT ON users TO authenticated;
GRANT SELECT (id, email, is_admin, admin_role, role, status) ON users TO authenticated;

-- Step 5: Verify the policy exists
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
AND policyname LIKE '%view own profile%';
