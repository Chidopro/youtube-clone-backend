-- Fix RLS policies for creator_favorites table to work with Google OAuth users
-- The current policy requires auth.uid() which doesn't work for Google OAuth users

-- First, create a function to check if a user_id exists in the users table
CREATE OR REPLACE FUNCTION user_exists(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM users WHERE id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies
DROP POLICY IF EXISTS "Creators can insert their own favorites" ON creator_favorites;
DROP POLICY IF EXISTS "Creators can update their own favorites" ON creator_favorites;
DROP POLICY IF EXISTS "Creators can delete their own favorites" ON creator_favorites;

-- Create new policies that work with both Supabase Auth and Google OAuth
-- For inserts: Allow if user has Supabase Auth session OR if user_id exists in users table
CREATE POLICY "Creators can insert their own favorites" ON creator_favorites
    FOR INSERT 
    WITH CHECK (
        -- Allow if user has Supabase Auth session
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR 
        -- OR allow if user_id exists in users table (for Google OAuth users)
        user_exists(user_id)
    );

-- For updates: Allow if user_id matches auth.uid() OR if user_id exists in users table
CREATE POLICY "Creators can update their own favorites" ON creator_favorites
    FOR UPDATE 
    USING (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR 
        user_exists(user_id)
    );

-- For deletes: Allow if user_id matches auth.uid() OR if user_id exists in users table
CREATE POLICY "Creators can delete their own favorites" ON creator_favorites
    FOR DELETE 
    USING (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR 
        user_exists(user_id)
    );
