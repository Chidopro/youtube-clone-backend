# Fix Subdomain: Bluehost DNS Setup

## 🎯 **Problem Identified by Netlify Support**

Your DNS is managed in **Bluehost**, not Netlify. The inactive Netlify DNS zone is causing conflicts with SSL/TLS certificate provisioning.

## ✅ **Step-by-Step Fix**

### **Step 1: Delete Inactive Netlify DNS Zone**

1. Go to: https://app.netlify.com/teams/chidopro/dns/screenmerch.com#delete-dns-zone
   - Or navigate: **Netlify Dashboard** → **DNS** (left sidebar) → Click `screenmerch.com`
2. Scroll down to the **"Danger zone"** section
3. Click the red **"Delete DNS zone"** button
4. Confirm the deletion

**Why?** Since DNS is managed in Bluehost, this Netlify DNS zone is inactive and can cause SSL conflicts.

---

### **Step 2: Add Domain Aliases in Netlify**

1. Go to **Netlify Dashboard** → Your Site → **Domain settings**
2. Click **"Add domain alias"**
3. Add:
   - `testcreator.screenmerch.com`
   - `www.testcreator.screenmerch.com` (optional, but Netlify recommended it)
4. Netlify will automatically:
   - Verify the domain
   - Provision SSL certificates
   - Route traffic to your site

---

### **Step 3: Add CNAME Records in Bluehost**

1. **Log into Bluehost cPanel**
2. Navigate to **DNS Zone Editor** or **Advanced DNS**
3. Find the DNS management section for `screenmerch.com`
4. **Add Record 1:**
   - **Type:** `CNAME`
   - **Name:** `testcreator` (just "testcreator", not the full domain)
   - **Value:** `eloquent-crumble-37c09e.netlify.app`
   - **TTL:** `3600` (or leave as default)
   - Click **"Add Record"** or **"Save"**

5. **Add Record 2 (Optional, but recommended):**
   - **Type:** `CNAME`
   - **Name:** `www.testcreator` (just "www.testcreator", not the full domain)
   - **Value:** `eloquent-crumble-37c09e.netlify.app`
   - **TTL:** `3600` (or leave as default)
   - Click **"Add Record"** or **"Save"**

**Important Notes:**
- The **Name** field should be just the subdomain part (e.g., `testcreator`), NOT the full domain
- Bluehost will automatically append `screenmerch.com` to the name
- The **Value** must be exactly: `eloquent-crumble-37c09e.netlify.app`

---

### **Step 4: Wait for DNS Propagation**

- DNS changes typically take **15-30 minutes** to propagate
- Can take up to **24-48 hours** in rare cases
- Check propagation status at: https://www.whatsmydns.net

**Test DNS Resolution:**
```bash
nslookup testcreator.screenmerch.com
```

Should return: `eloquent-crumble-37c09e.netlify.app` or Netlify's IP address

---

### **Step 5: Verify Everything Works**

1. **Check Netlify Domain Status:**
   - Go to **Domain settings** in Netlify
   - `testcreator.screenmerch.com` should show **"Active"** with a green checkmark
   - SSL certificate should be provisioned

2. **Test the Subdomain:**
   - Visit: `https://testcreator.screenmerch.com`
   - Should load your app (not 404)
   - Should show SSL certificate (lock icon in browser)

3. **Check Browser Console:**
   - Open DevTools (F12)
   - Should see subdomain detected
   - Should see creator's content filtered

---

## 🔍 **Troubleshooting**

### **Still Getting 404 After Setup:**

1. **Verify DNS Records in Bluehost:**
   - Make sure CNAME records are saved correctly
   - Check that the Name is just `testcreator` (not `testcreator.screenmerch.com`)
   - Verify the Value is exactly `eloquent-crumble-37c09e.netlify.app`

2. **Check DNS Propagation:**
   - Use https://www.whatsmydns.net
   - Enter: `testcreator.screenmerch.com`
   - Should show CNAME pointing to Netlify globally

3. **Verify Netlify Domain Alias:**
   - Netlify Dashboard → Domain settings
   - `testcreator.screenmerch.com` should be listed
   - Should show "Active" status (not "Propagating")

4. **Clear Browser Cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or try incognito/private mode

### **SSL Certificate Not Provisioning:**

- Make sure you deleted the inactive Netlify DNS zone (Step 1)
- Wait a few minutes after adding domain alias in Netlify
- Check Netlify's SSL status in Domain settings

---

## 📋 **Quick Checklist**

- [ ] Deleted inactive Netlify DNS zone
- [ ] Added `testcreator.screenmerch.com` as domain alias in Netlify
- [ ] Added `www.testcreator.screenmerch.com` as domain alias in Netlify (optional)
- [ ] Added CNAME record in Bluehost: `testcreator` → `eloquent-crumble-37c09e.netlify.app`
- [ ] Added CNAME record in Bluehost: `www.testcreator` → `eloquent-crumble-37c09e.netlify.app` (optional)
- [ ] Waited for DNS propagation (15-30 min)
- [ ] Verified DNS with `nslookup` or online tool
- [ ] Tested subdomain URL - should load app
- [ ] Enabled personalization in Dashboard
- [ ] Set subdomain in Dashboard

---

## 🚀 **For Future Creators**

When adding new creators, you'll need to:

1. **In Netlify:** Add their subdomain as a domain alias
2. **In Bluehost:** Add a CNAME record:
   - **Name:** `[creator-subdomain]`
   - **Value:** `eloquent-crumble-37c09e.netlify.app`

Example for a creator with subdomain `john`:
- Netlify: Add `john.screenmerch.com`
- Bluehost: Add CNAME `john` → `eloquent-crumble-37c09e.netlify.app`

---

**Once DNS propagates, your subdomain will work!** 🎉
