# Video Upload Size Limit Fix

## Problem
Videos over ~50MB fail to upload with error: "File size exceeds the storage bucket limit"

## Solution 1: Automatic Client-Side Compression (Implemented) ✅

The upload page now automatically compresses videos over 50MB before uploading. This:
- Reduces file size to fit within Supabase limits
- Improves upload speed
- Reduces storage costs
- Works automatically - no user action needed

**How it works:**
- Videos over 50MB are automatically compressed using browser's MediaRecorder API
- Compression reduces resolution (max 1280px width) and bitrate (2 Mbps)
- Original file is used if compression fails or doesn't help

## Solution 2: Increase Supabase Storage Bucket Limit (Alternative)

If you prefer to allow larger files without compression:

### Steps to Increase Supabase Bucket Limit:

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open Storage Settings**
   - Click on **Storage** in the left sidebar
   - Click on the **videos2** bucket

3. **Edit Bucket Settings**
   - Click **Settings** or **Edit** button
   - Find **File size limit** setting
   - Change from default (usually 50MB) to your desired limit (e.g., 100MB, 200MB, etc.)
   - Click **Save**

4. **Note on Supabase Plans:**
   - Free tier: Usually limited to 50MB per file
   - Pro tier: Can set higher limits (up to 5GB per file)
   - Check your plan's limits before increasing

### Recommended Settings:
- **File size limit**: 100MB (matches frontend validation)
- **Public bucket**: ✅ Yes
- **Allowed MIME types**: `video/*`

## Which Solution to Use?

**Use Compression (Solution 1)** if:
- You want to reduce storage costs
- You want faster uploads
- You're on a free Supabase plan
- You want automatic optimization

**Use Increased Bucket Limit (Solution 2)** if:
- You need to preserve original video quality
- You're on a paid Supabase plan
- You have specific file size requirements
- Compression causes quality issues

## Testing

After implementing either solution:
1. Try uploading a video over 50MB
2. With compression: You should see "Compressing video..." message
3. With increased limit: Video should upload directly without compression
4. Check that video plays correctly after upload

## Troubleshooting

### Compression not working:
- Check browser console for errors
- Some browsers may not support MediaRecorder
- Fallback: Original file will be used if compression fails

### Still getting size limit errors:
- Verify Supabase bucket limit is increased
- Check that you're editing the correct bucket (`videos2`)
- Ensure changes are saved in Supabase dashboard

### Compression taking too long:
- Large videos may take several minutes to compress
- Consider using Solution 2 (increase bucket limit) for very large files
- Or compress videos manually before uploading
