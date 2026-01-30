# Fix Subdomain 404 Error

## Current Issue
`testcreator.screenmerch.com` is showing 404 because Netlify doesn't know to route it to your site.

## ✅ Solution: Add Specific Subdomain

Since Netlify doesn't allow wildcard (`*`) in domain aliases, we need to add the specific subdomain:

### Step 1: Add Subdomain as Domain Alias

1. In Netlify Dashboard → **Domain management**
2. Click **"Add domain alias"** button
3. Enter: `testcreator.screenmerch.com` (without asterisk, just the specific subdomain)
4. Click **"Add"** or **"Verify"**
5. Netlify will automatically:
   - Verify the domain
   - Provision SSL certificate
   - Route traffic to your site

### Step 2: Wait for SSL Provisioning

- Usually takes **1-2 minutes**
- You'll see a green checkmark when ready
- Status will show "Active"

### Step 3: Test

Visit: `https://testcreator.screenmerch.com`

Should now load your app!

---

## 🔄 For Multiple Creators (Future)

For production with many creators, you have two options:

### Option A: Add Each Subdomain Individually
- Add each creator's subdomain as a domain alias
- Works but requires manual setup per creator

### Option B: Configure Wildcard DNS Record
1. Click **"Go to DNS panel"** (in Options dropdown for screenmerch.com)
2. Add DNS record:
   - **Type:** `A` or `CNAME`
   - **Hostname:** `*` (wildcard)
   - **Value:** Your Netlify site's IP or netlify.app address
3. This allows all subdomains to work automatically

---

## 🎯 Quick Fix for Now

**Just add `testcreator.screenmerch.com` as a domain alias** - this will work immediately for testing!
