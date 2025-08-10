# CORS Configuration Backup - WORKING SETUP

## ⚠️ IMPORTANT: DO NOT CHANGE THIS CORS CONFIGURATION

This file documents the current working CORS configuration. Any changes to CORS settings have caused issues in the past.

## Current Working CORS Configuration

### 1. Main CORS Setup (Lines 175-179 in app.py)
```python
# Configure CORS for production
CORS(app, resources={r"/api/*": {"origins": [
    "chrome-extension://*",
    "https://screenmerch.com",
    "https://www.screenmerch.com"
]}})
```

### 2. Individual Endpoint CORS Headers

#### For OPTIONS requests (preflight):
```python
if request.method == "OPTIONS":
    response = jsonify(success=True)
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response
```

#### For successful POST responses:
```python
response = jsonify(result)
response.headers.add('Access-Control-Allow-Origin', '*')
return response
```

## Endpoints with CORS Headers

The following endpoints have explicit CORS headers:

1. `/api/capture-screenshot` (POST, OPTIONS)
2. `/api/capture-multiple-screenshots` (POST, OPTIONS)
3. `/api/video-info` (POST, OPTIONS)
4. `/api/create-product` (POST, OPTIONS)
5. `/api/auth/login` (POST, OPTIONS)
6. `/api/auth/signup` (POST, OPTIONS)

## Allowed Origins

- `chrome-extension://*` - Chrome extension requests
- `https://screenmerch.com` - Main production domain
- `https://www.screenmerch.com` - www subdomain

## Why This Configuration Works

1. **Dual CORS Setup**: Uses both Flask-CORS library AND explicit headers
2. **Wildcard for Chrome Extension**: Allows any chrome extension to access
3. **Explicit Headers**: Each endpoint manually adds CORS headers for reliability
4. **OPTIONS Support**: Properly handles preflight requests
5. **Production Domains**: Includes both www and non-www versions

## Troubleshooting

If CORS issues occur in the future:

1. **Check this backup file** - Restore the exact configuration above
2. **Verify all endpoints** have both OPTIONS handling and explicit headers
3. **Test with curl** - Use `curl -X OPTIONS` to test preflight requests
4. **Check browser console** - Look for CORS error messages

## Deployment Checklist

Before deploying any changes:

- [ ] CORS configuration matches this backup
- [ ] All API endpoints have OPTIONS handling
- [ ] All successful responses include CORS headers
- [ ] Test with Chrome extension
- [ ] Test with screenmerch.com domain

## Last Working Deployment

- **Date**: Current deployment
- **Status**: ✅ Working
- **Issues**: None
- **Notes**: Login, screenshot capture, and product creation all working

---

**⚠️ REMEMBER: This configuration has been tested and works. Do not modify without thorough testing!**
