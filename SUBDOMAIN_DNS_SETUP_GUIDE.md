# Subdomain DNS Setup Guide

## ⚠️ **Important: DNS is Managed in Bluehost, NOT Netlify**

Your domain `screenmerch.com` uses **Bluehost for DNS management**, not Netlify DNS. This means:
- ✅ You need to add DNS records in **Bluehost**
- ❌ You should **NOT** use Netlify DNS zones (they will be inactive)
- ✅ You need to **delete any inactive Netlify DNS zones** to avoid conflicts

## ✅ **Solution: Configure DNS in Bluehost**

### **Step 1: Delete Inactive Netlify DNS Zone**

1. Go to **Netlify Dashboard** → **DNS** (left sidebar)
2. Click on `screenmerch.com` DNS zone
3. Scroll down to **"Danger zone"** section
4. Click **"Delete DNS zone"** button
5. Confirm deletion

**Why?** Since DNS is managed in Bluehost, the Netlify DNS zone is inactive and can cause SSL/TLS certificate conflicts.

### **Step 2: Add Domain Aliases in Netlify**

1. Go to **Netlify Dashboard** → Your Site → **Domain settings**
2. Click **"Add domain alias"**
3. Add each subdomain individually:
   - `testcreator.screenmerch.com`
   - `www.testcreator.screenmerch.com` (optional)
4. Netlify will verify and provision SSL certificates

### **Step 3: Add CNAME Records in Bluehost**

Go to your **Bluehost DNS management** and add these CNAME records:

**Record 1: Main Subdomain**
```
Type: CNAME
Name: testcreator
Value: eloquent-crumble-37c09e.netlify.app
TTL: 3600 (or default)
```

**Record 2: WWW Subdomain (Optional)**
```
Type: CNAME
Name: www.testcreator
Value: eloquent-crumble-37c09e.netlify.app
TTL: 3600 (or default)
```

**How to add in Bluehost:**
1. Log into Bluehost cPanel
2. Go to **DNS Zone Editor** or **Advanced DNS**
3. Find the section for `screenmerch.com`
4. Click **"Add Record"** or **"Create"**
5. Select **CNAME** as the type
6. Enter the Name and Value as shown above
7. Save the record

**Note:** For future creators, you'll need to add a CNAME record for each subdomain in Bluehost.

### **Step 3: Wait for DNS Propagation**

- DNS changes can take **5 minutes to 48 hours** to propagate
- Usually takes **15-30 minutes** for most providers
- You can check propagation at: https://www.whatsmydns.net

---

## 🧪 **Test Without DNS (Local Testing)**

While waiting for DNS, you can test locally:

### **Method 1: Edit Hosts File**

1. **Windows:** Open `C:\Windows\System32\drivers\etc\hosts` as Administrator
2. **Mac/Linux:** Open `/etc/hosts` with sudo

3. **Add this line:**
   ```
   127.0.0.1 testcreator.screenmerch.com
   ```

4. **Run local dev server:**
   ```bash
   cd frontend
   npm run dev
   ```

5. **Visit:** `http://testcreator.screenmerch.com:5173` (or your dev port)

This simulates the subdomain locally!

---

## ✅ **Verify DNS is Working**

Once DNS is configured, test:

1. **Check DNS resolution:**
   ```bash
   nslookup testcreator.screenmerch.com
   ```
   Should return Netlify's IP

2. **Visit subdomain:**
   - `https://testcreator.screenmerch.com`
   - Should load your app (not 404)

3. **Check in browser console:**
   - Should see subdomain detected
   - Should see creator's content filtered

---

## 🔍 **Troubleshooting**

### **Still Getting 404 After DNS Setup:**

1. **Check DNS propagation:**
   - Use https://www.whatsmydns.net
   - Make sure `*.screenmerch.com` resolves globally

2. **Verify Netlify domain:**
   - Netlify Dashboard → Domain settings
   - Make sure `*.screenmerch.com` is listed
   - Should show "Active" status

3. **Check Netlify redirects:**
   - The `netlify.toml` already has SPA routing
   - Should work automatically for subdomains

4. **Clear browser cache:**
   - Hard refresh (Ctrl+Shift+R)
   - Or try incognito mode

### **Subdomain Not Detected:**

1. **Check database:**
   ```sql
   SELECT subdomain, personalization_enabled 
   FROM users 
   WHERE subdomain = 'testcreator';
   ```
   - Should show `personalization_enabled = true`

2. **Check browser console:**
   - Look for subdomain detection logs
   - Should see creator loaded

3. **Verify subdomain format:**
   - Must be lowercase
   - No spaces or special characters
   - 3-63 characters

---

## 📋 **Quick Checklist**

- [ ] Deleted inactive Netlify DNS zone (if it exists)
- [ ] Added `testcreator.screenmerch.com` as domain alias in Netlify
- [ ] Added CNAME record in Bluehost: `testcreator` → `eloquent-crumble-37c09e.netlify.app`
- [ ] Waited for DNS propagation (15-30 min)
- [ ] Verified DNS with `nslookup` or online tool
- [ ] Enabled personalization in Dashboard
- [ ] Set subdomain in Dashboard
- [ ] Tested subdomain URL

---

## 🚀 **Once DNS is Configured**

After DNS propagates:
- ✅ `testcreator.screenmerch.com` will route to Netlify
- ✅ Netlify will serve your React app
- ✅ App will detect subdomain
- ✅ Content will be filtered
- ✅ Branding will apply

**The code is ready - it just needs DNS!**
