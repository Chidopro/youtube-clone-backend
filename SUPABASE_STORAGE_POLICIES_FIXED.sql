-- Supabase Storage Policies - Safe to run multiple times
-- This script drops existing policies first, then creates them

-- ============================================
-- VIDEOS2 BUCKET POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own videos" ON storage.objects;

-- Create videos2 bucket policies
CREATE POLICY "Authenticated users can upload videos" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'videos2' AND 
        auth.role() = 'authenticated'
    );

CREATE POLICY "Public can view videos" ON storage.objects
    FOR SELECT USING (bucket_id = 'videos2');

CREATE POLICY "Users can update their own videos" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'videos2' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own videos" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'videos2' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- ============================================
-- THUMBNAILS BUCKET POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Public can view thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own thumbnails" ON storage.objects;

-- Create thumbnails bucket policies
CREATE POLICY "Authenticated users can upload thumbnails" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'thumbnails' AND 
        auth.role() = 'authenticated'
    );

CREATE POLICY "Public can view thumbnails" ON storage.objects
    FOR SELECT USING (bucket_id = 'thumbnails');

CREATE POLICY "Users can update their own thumbnails" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'thumbnails' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own thumbnails" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'thumbnails' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- ============================================
-- PROFILE-IMAGES BUCKET POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;

-- Create profile-images bucket policies
CREATE POLICY "Authenticated users can upload profile images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'profile-images' AND 
        auth.role() = 'authenticated'
    );

CREATE POLICY "Public can view profile images" ON storage.objects
    FOR SELECT USING (bucket_id = 'profile-images');

CREATE POLICY "Users can update their own profile images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'profile-images' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own profile images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'profile-images' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

