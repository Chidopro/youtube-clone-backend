-- Storage bucket setup for video uploads
-- Note: These commands need to be run in the Supabase dashboard under Storage

-- Create videos2 bucket for video files
-- Bucket name: videos2
-- Public bucket: true
-- File size limit: 100MB (or your preferred limit)
-- Allowed MIME types: video/*

-- Create thumbnails bucket for video thumbnails
-- Bucket name: thumbnails
-- Public bucket: true
-- File size limit: 10MB
-- Allowed MIME types: image/*

-- Create profile-images bucket for user profile images
-- Bucket name: profile-images
-- Public bucket: true
-- File size limit: 5MB
-- Allowed MIME types: image/*

-- Storage policies for videos2 bucket
-- Allow authenticated users to upload videos
CREATE POLICY "Authenticated users can upload videos" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'videos2' AND 
        auth.role() = 'authenticated'
    );

-- Allow public read access to videos
CREATE POLICY "Public can view videos" ON storage.objects
    FOR SELECT USING (bucket_id = 'videos2');

-- Allow users to update their own videos
CREATE POLICY "Users can update their own videos" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'videos2' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow users to delete their own videos
CREATE POLICY "Users can delete their own videos" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'videos2' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage policies for thumbnails bucket
-- Allow authenticated users to upload thumbnails
CREATE POLICY "Authenticated users can upload thumbnails" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'thumbnails' AND 
        auth.role() = 'authenticated'
    );

-- Allow public read access to thumbnails
CREATE POLICY "Public can view thumbnails" ON storage.objects
    FOR SELECT USING (bucket_id = 'thumbnails');

-- Allow users to update their own thumbnails
CREATE POLICY "Users can update their own thumbnails" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'thumbnails' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow users to delete their own thumbnails
CREATE POLICY "Users can delete their own thumbnails" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'thumbnails' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage policies for profile-images bucket
-- Allow authenticated users to upload profile images
CREATE POLICY "Authenticated users can upload profile images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'profile-images' AND 
        auth.role() = 'authenticated'
    );

-- Allow public read access to profile images
CREATE POLICY "Public can view profile images" ON storage.objects
    FOR SELECT USING (bucket_id = 'profile-images');

-- Allow users to update their own profile images
CREATE POLICY "Users can update their own profile images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'profile-images' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow users to delete their own profile images
CREATE POLICY "Users can delete their own profile images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'profile-images' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    ); 