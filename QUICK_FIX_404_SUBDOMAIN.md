# Quick Fix: 404 on testcreator.screenmerch.com

## Issue
Getting 404 on `testcreator.screenmerch.com` after deployment.

## Quick Checks:

### 1. Check Netlify Domain Status
1. Go to **Netlify Dashboard** → Your Site → **Domain settings**
2. Find `testcreator.screenmerch.com`
3. What status does it show?
   - ✅ "Active" = Should work
   - ⚠️ "Pending DNS verification" = Wait or re-verify
   - ❌ "Failed" = Needs fixing

### 2. If Status is "Pending" or "Failed"

**Option A: Re-verify**
1. Click "Options" (three dots) next to `testcreator.screenmerch.com`
2. Click "Verify DNS configuration" or "Retry verification"
3. Wait 1-2 minutes

**Option B: Remove and Re-add**
1. Click "Options" → "Remove domain"
2. Wait 30 seconds
3. Click "Add domain alias"
4. Enter: `testcreator.screenmerch.com`
5. Click "Verify"
6. Wait 1-2 minutes

### 3. Verify DNS in Bluehost
1. Go to **Bluehost cPanel** → **DNS Zone Editor**
2. Confirm `testcreator` CNAME exists:
   - Type: CNAME
   - Points to: `eloquent-crumble-37c09e.netlify.app`

### 4. Test DNS Resolution
Open Command Prompt and run:
```bash
nslookup testcreator.screenmerch.com
```

Should return: `eloquent-crumble-37c09e.netlify.app`

### 5. Visit Correct URL
Make sure you're visiting:
- ✅ `https://testcreator.screenmerch.com` (root)
- ❌ NOT `https://testcreator.screenmerch.com/404.html`

### 6. Wait for CDN Update
After re-adding domain or deployment:
- Wait 2-5 minutes for Netlify CDN to update
- Clear browser cache
- Try incognito mode

## Most Likely Cause
After deployment, Netlify's CDN might need a few minutes to update, or the domain alias needs to be re-verified.

## Quick Fix
1. Check Netlify domain status
2. If "Pending", click "Retry verification"
3. Wait 2-5 minutes
4. Try visiting `https://testcreator.screenmerch.com` (not `/404.html`)
