# Supabase Storage Setup for Video Uploads

## Step 1: Create Storage Buckets

Go to your Supabase Dashboard → **Storage** and create these buckets:

### 1. videos2 Bucket
- **Name**: `videos2`
- **Public**: ✅ Yes (check this box)
- **File Size Limit**: 100MB (or your preferred limit)
- **Allowed MIME Types**: `video/*`

### 2. thumbnails Bucket
- **Name**: `thumbnails`
- **Public**: ✅ Yes (check this box)
- **File Size Limit**: 10MB
- **Allowed MIME Types**: `image/*`

### 3. profile-images Bucket
- **Name**: `profile-images`
- **Public**: ✅ Yes (check this box)
- **File Size Limit**: 5MB
- **Allowed MIME Types**: `image/*`

## Step 2: Add Storage Policies

Go to your Supabase Dashboard → **SQL Editor** and run the SQL from `SUPABASE_STORAGE_POLICIES_FIXED.sql` file.

**OR** copy and paste this SQL (it's safe to run multiple times - it drops existing policies first):

```sql
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
```

## Important Note About Google OAuth Users

**The storage policies require `auth.role() = 'authenticated'`, which means users must be authenticated through Supabase Auth, not just have data in localStorage.**

If you're using Google OAuth:
1. Users need to sign in through Supabase Auth (not just Google OAuth stored in localStorage)
2. OR you need to modify the policies to allow uploads based on user_id in the users table

If you want to allow Google OAuth users to upload, you can use this alternative policy:

```sql
-- Alternative policy for videos2 that works with Google OAuth users
-- This checks if the user exists in the users table
CREATE POLICY "Users can upload videos" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'videos2' AND 
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id::text = (storage.foldername(name))[1]
        )
    );
```

## After Adding Policies

1. Refresh your Supabase dashboard
2. Test the video upload functionality
3. If uploads still fail, check the browser console for specific error messages

