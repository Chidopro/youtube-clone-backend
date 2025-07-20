# Video Upload Setup Guide

This guide will help you set up the video upload functionality for your YouTube clone application.

## Prerequisites

1. **Supabase Project**: Make sure you have a Supabase project set up
2. **Database Setup**: Run the database setup scripts
3. **Storage Buckets**: Create the required storage buckets

## Step 1: Database Setup

Run the following SQL scripts in your Supabase SQL Editor:

1. **Main Database Setup**: Run `database_setup.sql` to create all tables including the `videos2` table
2. **Storage Policies**: Run `storage_setup.sql` to set up storage policies

## Step 2: Create Storage Buckets

In your Supabase Dashboard, go to **Storage** and create the following buckets:

### 1. videos2 Bucket
- **Name**: `videos2`
- **Public**: ✅ Yes
- **File Size Limit**: 100MB
- **Allowed MIME Types**: `video/*`

### 2. thumbnails Bucket
- **Name**: `thumbnails`
- **Public**: ✅ Yes
- **File Size Limit**: 10MB
- **Allowed MIME Types**: `image/*`

### 3. profile-images Bucket
- **Name**: `profile-images`
- **Public**: ✅ Yes
- **File Size Limit**: 5MB
- **Allowed MIME Types**: `image/*`

## Step 3: Configure Storage Policies

After creating the buckets, run the storage policies from `storage_setup.sql` in the SQL Editor.

## Step 4: Environment Variables

Make sure your `.env` file has the correct Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Step 5: Test the Upload

1. Start your development server
2. Navigate to the upload page
3. Sign in with Google
4. Try uploading a video file and thumbnail

## Troubleshooting Common Issues

### Issue 1: "Table 'videos2' does not exist"
**Solution**: Run the database setup script in Supabase SQL Editor

### Issue 2: "Storage bucket 'videos2' not found"
**Solution**: Create the storage bucket in Supabase Dashboard

### Issue 3: "Permission denied" errors
**Solution**: Check that storage policies are properly configured

### Issue 4: "File too large" errors
**Solution**: Check file size limits in bucket settings

### Issue 5: "Authentication required" errors
**Solution**: Make sure user is properly authenticated with Supabase

## File Size Limits

- **Videos**: Maximum 100MB
- **Thumbnails**: Maximum 10MB
- **Profile Images**: Maximum 5MB

## Supported File Types

- **Videos**: All video formats (mp4, avi, mov, etc.)
- **Images**: All image formats (jpg, png, gif, etc.)

## Security Considerations

1. **Row Level Security (RLS)**: Enabled on all tables
2. **Storage Policies**: Users can only upload to their own folders
3. **File Validation**: Client-side and server-side validation
4. **Authentication**: Required for all upload operations

## Monitoring Uploads

Check the browser console for detailed upload logs. The improved upload component now provides:
- Progress indicators
- Detailed error messages
- File validation
- Upload cleanup on errors

## Next Steps

After setting up the upload functionality:

1. Test with different file types and sizes
2. Monitor storage usage in Supabase Dashboard
3. Consider implementing video processing (compression, format conversion)
4. Add video preview functionality
5. Implement video deletion features

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify Supabase configuration
3. Ensure all storage buckets are created
4. Confirm database tables exist
5. Check storage policies are applied 