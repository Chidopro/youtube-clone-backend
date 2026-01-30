# Permanent Fix for Recurring Subdomain 404 Issue

## Problem
The subdomain `testcreator.screenmerch.com` keeps "blinking out" (going to 404) after deployments, even though DNS is correct.

## Root Cause
Netlify's domain aliases can become unlinked from deployments, especially when:
- New deployments are triggered
- SSL certificates are re-provisioned
- Netlify's CDN cache updates

## Permanent Solutions

### Option 1: Contact Netlify Support (Recommended)
Since this is happening repeatedly, contact Netlify support and tell them:
- Domain alias `testcreator.screenmerch.com` keeps becoming inactive after deployments
- DNS is correct (CNAME in Bluehost points to `eloquent-crumble-37c09e.netlify.app`)
- This is the 2nd time it's happened
- Ask them to investigate why domain aliases are getting unlinked

**They may need to:**
- Manually fix the domain alias
- Investigate if there's a bug in their system
- Provide a more permanent solution

### Option 2: Use Netlify API to Auto-Re-add Domain
Create a script that automatically re-adds the domain alias after each deployment. However, this requires Netlify API access.

### Option 3: Check for Inactive DNS Zone Conflict
The inactive Netlify DNS zone might be causing conflicts. Make sure it's deleted:
1. Go to Netlify Dashboard → **DNS** (left sidebar)
2. Check if `screenmerch.com` DNS zone exists
3. If it exists, delete it (Danger zone → Delete DNS zone)

### Option 4: Manual Re-add After Each Deployment
For now, after each deployment:
1. Go to Netlify Dashboard → Domain settings
2. Check if `testcreator.screenmerch.com` is still "Active"
3. If not, remove and re-add it

## Immediate Fix (Right Now)

1. **Check Netlify Domain Status:**
   - Go to Domain settings
   - Is `testcreator.screenmerch.com` still listed?
   - What status does it show?

2. **If Missing or "Failed":**
   - Re-add it: "Add domain alias" → `testcreator.screenmerch.com`
   - Wait 1-2 minutes

3. **If "Active" but Still 404:**
   - Remove and re-add to force re-link
   - Wait 2-5 minutes for CDN to update

## Why This Keeps Happening

Netlify's domain alias system can have issues with:
- Automatic domain verification after deployments
- SSL certificate re-provisioning
- CDN cache invalidation
- Domain-to-deployment linking

This is a known issue with Netlify when using external DNS (Bluehost) instead of Netlify DNS.

## Best Long-term Solution

**Contact Netlify Support** - This recurring issue suggests a bug or configuration problem on their end. They can:
- Investigate the root cause
- Provide a permanent fix
- Potentially set up the domain alias in a way that doesn't get unlinked

## Quick Check Right Now

1. Go to Netlify Dashboard → Domain settings
2. Is `testcreator.screenmerch.com` listed?
3. What's its status?

This will tell us if the domain was removed or just needs re-verification.
