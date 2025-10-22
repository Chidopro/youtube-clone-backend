# CORS BACKUP - BEFORE AUTH LOGIN FIX

**Date**: October 17, 2025
**Status**: WORKING STATE - Desktop and Mobile Google login working
**Issue**: Mobile merch email login getting "Authentication error: Load failed"

## Current Working CORS Configuration:

### Login Endpoint (backend/app.py line 3650):
```python
allowed_origins = ["https://screenmerch.com", "https://www.screenmerch.com", "https://68e94d7278d7ced80877724f--eloquent-crumble-37c09e.netlify.app", "https://68e9564fa66cd5f4794e5748--eloquent-crumble-37c09e.netlify.app", "https://*.netlify.app", "http://localhost:3000", "http://localhost:5173"]
```

### Signup Endpoint (backend/app.py line 3724):
```python
response.headers.add('Access-Control-Allow-Origin', '*')
```

## What I'm About to Change:
- Add current Netlify URL to login endpoint allowed_origins
- Remove wildcard "https://*.netlify.app" (doesn't work properly)

## REVERSE INSTRUCTIONS (if this breaks desktop/mobile):
1. Revert backend/app.py line 3650 to original allowed_origins
2. Keep signup endpoint as is (using '*')
3. Test desktop and mobile Google login immediately

## Current Working State:
- ✅ Desktop Google sign-in working
- ✅ Mobile Google sign-in working  
- ✅ Header layout correct
- ❌ Mobile merch email login failing with "Load failed"

**DO NOT DEPLOY** until user confirms this approach is safe.
