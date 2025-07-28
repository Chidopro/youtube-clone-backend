# QUICK FIX: CORS Error

## The Problem
The console shows CORS errors preventing the frontend from connecting to the backend:

```
Access to fetch at 'https://backend-hidden-firefly-7865.fly.dev/api/capture-screenshot' from origin 'https://screenmerch.com' has been blocked by CORS policy
```

## The Solution
I've updated the backend to allow all origins and added explicit CORS headers to the problematic endpoints.

## Deploy the Fix

```bash
# Deploy the updated backend to Fly.io
fly deploy
```

## What Changed
1. **CORS Configuration**: Now allows all origins (`"*"`)
2. **Explicit Headers**: Added `Access-Control-Allow-Origin: *` to all API responses
3. **OPTIONS Handling**: Properly handles preflight requests

## Test After Deployment
1. Wait 2-3 minutes for deployment to complete
2. Try the "Grab Screenshot" button - should work now
3. Try the "Make Merch" button - should work now
4. Check console - should see successful API calls instead of CORS errors

## If Still Not Working
Check the Fly.io logs:
```bash
fly logs
```

The buttons should now work properly without the "Flask is running" error! 