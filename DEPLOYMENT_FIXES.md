# Deployment Fixes for ScreenMerch

## Issues Fixed

1. **Grab Screenshot Button**: Now has better error handling and fallback to thumbnail when server-side capture fails
2. **Make Merch Button**: Improved error handling and debugging information
3. **CORS Configuration**: Added localhost origins for development
4. **Backend Health Check**: Added health endpoint for debugging

## Changes Made

### Frontend Changes (`frontend/src/Components/PlayVideo/PlayVideo.jsx`)
- Enhanced error handling in `handleGrabScreenshot`
- Added detailed logging in `handleMakeMerch`
- Better fallback handling for screenshot capture
- More informative error messages

### Backend Changes (`app.py`)
- Improved CORS configuration
- Added health check endpoint (`/api/health`)
- Better error handling in screenshot capture endpoint
- Fallback mechanism when ffmpeg fails

## Deployment Steps

### 1. Deploy Backend to Fly.io

```bash
# Navigate to the root directory
cd /path/to/youtube-clone

# Deploy to Fly.io
fly deploy
```

### 2. Deploy Frontend to Netlify

```bash
# Navigate to frontend directory
cd frontend

# Build the project
npm run build

# Deploy to Netlify (if using Netlify CLI)
netlify deploy --prod
```

### 3. Test the Connection

1. Open your browser's developer console
2. Navigate to your deployed frontend
3. Try the "Grab Screenshot" button
4. Check the console for detailed error messages
5. Try the "Make Merch" button
6. Check the console for connection details

### 4. Debug Connection Issues

If you're still having issues, run the debug script:

```bash
# Open browser console and paste the contents of debug_connection.js
# Or run it in Node.js if you have it installed
node debug_connection.js
```

## Expected Behavior

### Grab Screenshot Button
- Should attempt server-side capture first
- If server capture fails, should fallback to thumbnail
- Should show informative messages about what's happening
- Should not hang or take too long

### Make Merch Button
- Should connect to Fly.io backend
- Should show detailed error messages if connection fails
- Should open product page in new tab if successful

## Troubleshooting

### If "Make Merch" still shows "Flask is running" error:
1. Check that your frontend is using the correct API_BASE_URL
2. Verify the Fly.io backend is running: `https://backend-hidden-firefly-7865.fly.dev/api/health`
3. Check browser console for CORS errors
4. Ensure your environment variables are set correctly

### If "Grab Screenshot" is still slow:
1. The server-side ffmpeg capture might be slow on Fly.io
2. The fallback to thumbnail should work quickly
3. Check the console for which method is being used

### If you see CORS errors:
1. Verify the CORS configuration in the backend
2. Check that your frontend domain is in the allowed origins
3. Try the health check endpoint to verify backend is accessible

## Environment Variables

Make sure these are set in your Netlify environment:

```
VITE_API_BASE_URL=https://backend-hidden-firefly-7865.fly.dev
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

## Monitoring

After deployment, monitor the Fly.io logs:

```bash
fly logs
```

This will help you see if there are any backend errors when users interact with the buttons. 