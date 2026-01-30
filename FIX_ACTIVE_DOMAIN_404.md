# Fix: Domain Shows "Active" But Still 404

## Issue
Domain alias `testcreator.screenmerch.com` shows "Active" in Netlify but still returns 404.

## Solution: Force Re-link Domain to Deployment

When a domain is "Active" but not working, it's usually because Netlify hasn't properly linked it to the latest deployment. Here's how to fix it:

### Step 1: Remove Domain Alias

1. Go to **Netlify Dashboard** → Your Site → **Domain settings**
2. Find `testcreator.screenmerch.com`
3. Click the **"Options"** dropdown (three dots)
4. Click **"Remove domain"**
5. Confirm removal
6. Wait 10-15 seconds

### Step 2: Re-add Domain Alias

1. Click **"Add domain alias"** button
2. Enter: `testcreator.screenmerch.com`
3. Click **"Verify"** or **"Add"**
4. Wait for verification (usually 30-60 seconds)
5. Should show "Active" status

### Step 3: Wait and Test

1. Wait 1-2 minutes for Netlify to fully process
2. Visit: `https://testcreator.screenmerch.com`
3. Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
4. Try incognito mode if still not working

## Why This Works

Removing and re-adding forces Netlify to:
- Re-verify DNS configuration
- Re-link the domain to the current deployment
- Re-provision SSL certificate
- Update CDN routing

## Alternative: Trigger New Deployment

If removing/re-adding doesn't work, trigger a new deployment:

1. Make a small change (like a comment in code)
2. Commit and push
3. Or manually trigger deploy in Netlify Dashboard
4. This forces Netlify to re-associate all domains with the new deployment

## Still Not Working?

If it still doesn't work after removing/re-adding:

1. **Check DNS is correct:**
   - Bluehost should have: `testcreator` → `eloquent-crumble-37c09e.netlify.app`
   - Test with: `nslookup testcreator.screenmerch.com`

2. **Check Netlify deployment:**
   - Make sure latest deployment is successful
   - Check deployment logs for errors

3. **Contact Netlify Support:**
   - Sometimes domain aliases get stuck
   - Netlify support can manually fix it
