# CORS FIX BACKUP - MOBILE AUTH LOGIN

**Date**: October 17, 2025
**Issue**: Mobile merch email login getting "Authentication error: Load failed"
**Root Cause**: CORS mismatch between OPTIONS and POST responses

## Current Working State:
- ✅ Desktop Google sign-in working
- ✅ Mobile Google sign-in working  
- ✅ Header layout correct
- ❌ Mobile merch email login failing

## What I'm About to Change:
**File**: `backend/app.py` lines 3697-3727
**Problem**: OPTIONS request uses specific origins, but POST responses use `'*'`
**Fix**: Make POST responses use same CORS logic as OPTIONS

## EXACT CHANGES:
1. **Success Response** (line 3697): Changed from `'*'` to specific origin logic
2. **Error Responses** (lines 3708, 3718): Changed from `'*'` to specific origin logic
3. **Added**: `Access-Control-Allow-Credentials: true` header

## REVERSE INSTRUCTIONS (if this breaks anything):
1. Revert lines 3697-3727 in backend/app.py
2. Change back to `response.headers.add('Access-Control-Allow-Origin', '*')`
3. Remove `Access-Control-Allow-Credentials` headers
4. Test desktop and mobile Google login immediately

## Why This Should Work:
The logs show OPTIONS requests succeed (200) but no POST requests are made. This CORS mismatch prevents mobile browsers from making the actual POST request after the preflight succeeds.

**DO NOT DEPLOY** until user confirms this approach is safe.
