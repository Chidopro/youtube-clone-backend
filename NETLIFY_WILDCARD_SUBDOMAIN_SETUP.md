# Netlify Wildcard Subdomain Setup

## ✅ **Good News: You're Using Netlify DNS!**

Since `screenmerch.com` shows "Netlify DNS" with a green checkmark, wildcard subdomains **should work automatically** - you don't need to add `*.screenmerch.com` as a domain alias.

## 🔍 **How to Verify/Configure Wildcard Subdomains**

### **Option 1: Check Netlify DNS Records**

1. In Netlify Dashboard → **Domain management**
2. Click **"Go to DNS panel"** (next to screenmerch.com)
3. Look for DNS records - you should see:
   - `A` or `CNAME` record for `screenmerch.com`
   - Possibly a wildcard `*` record

If there's no wildcard record, you can add one:

### **Option 2: Add Wildcard DNS Record Manually**

1. Click **"Go to DNS panel"** (in the Options dropdown for screenmerch.com)
2. Click **"Add new record"**
3. Add:
   - **Type:** `A` or `CNAME`
   - **Hostname:** `*` (just the asterisk)
   - **Value:** Your Netlify site's IP or `eloquent-crumble-37c09e.netlify.app`
4. Save

### **Option 3: Test Without Adding Domain**

Actually, with Netlify DNS, **wildcard subdomains should work automatically**. Try this:

1. **Don't add `*.screenmerch.com` as a domain alias** (it won't accept it)
2. **Just test the subdomain directly:**
   - Visit: `https://testcreator.screenmerch.com`
   - Netlify should route it to your site automatically

## 🧪 **Test It Now**

Since you're using Netlify DNS, try visiting:
- `https://testcreator.screenmerch.com`

If it works → Great! No configuration needed.
If it still shows 404 → We need to check DNS records.

## 📋 **Alternative: Use Specific Subdomain**

If wildcard doesn't work automatically, you can add specific subdomains:

1. Click **"Add domain alias"**
2. Enter: `testcreator.screenmerch.com` (without asterisk)
3. Netlify will verify and provision SSL

Then each creator would need their subdomain added individually (not ideal for scale, but works for testing).

## 🎯 **Recommended Approach**

1. **First, test:** Visit `https://testcreator.screenmerch.com` right now
2. **If it works:** You're done! Netlify DNS handles wildcards automatically
3. **If 404:** Go to DNS panel and add wildcard record manually

Let me know what happens when you test the subdomain!
