# Testing Subdomain Personalization

## 🧪 **Test Subdomain Name**

You can use any subdomain name. Here are some good test options:

### **Recommended Test Subdomains:**
- `test` - Simple and easy
- `testcreator` - More descriptive
- `demo` - Common test name
- `mybrand` - Example brand name
- `john` - Example creator name

**Note:** Avoid reserved words like: `www`, `api`, `admin`, `app`, `mail`, `ftp`, `localhost`, `test`, `staging`, `dev`, `prod`

---

## 🎯 **How to Test (3 Methods)**

### **Method 1: Test in Dashboard (No DNS Needed)**

This tests the settings and database without needing DNS:

1. **Go to Dashboard → Personalization tab**
2. **Enable Personalization**
3. **Set Subdomain:** `testcreator` (or any name you like)
4. **Set Colors:** 
   - Primary: `#FF5733` (red-orange)
   - Secondary: `#C70039` (dark red)
5. **Set Custom Logo URL:** (optional) `https://example.com/logo.png`
6. **Save Settings**

**What this tests:**
- ✅ Settings save correctly
- ✅ Database stores subdomain
- ✅ Validation works
- ✅ Settings load correctly

**To verify:**
- Check database: `SELECT subdomain, personalization_enabled FROM users WHERE subdomain = 'testcreator';`
- Should see your subdomain stored

---

### **Method 2: Test with Local Hosts File (Simulate Subdomain)**

This lets you test the full subdomain experience locally:

1. **Set up subdomain in Dashboard** (Method 1 above)

2. **Edit your hosts file:**
   - Windows: `C:\Windows\System32\drivers\etc\hosts`
   - Mac/Linux: `/etc/hosts`
   - Add this line:
   ```
   127.0.0.1 testcreator.screenmerch.com
   ```

3. **Run local dev server:**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Visit:** `http://testcreator.screenmerch.com:5173` (or your dev port)

**What this tests:**
- ✅ Subdomain detection works
- ✅ Content filtering works
- ✅ Branding applies correctly
- ✅ Full personalized experience

---

### **Method 3: Test on Production (Requires DNS)**

Once DNS is configured, test on production:

1. **Set up subdomain in Dashboard** (Method 1 above)

2. **Ensure DNS is configured:**
   - Wildcard DNS: `*.screenmerch.com` → Netlify
   - Or specific: `testcreator.screenmerch.com` → Netlify

3. **Visit:** `https://testcreator.screenmerch.com`

**What this tests:**
- ✅ Full production experience
- ✅ Real subdomain routing
- ✅ CDN caching
- ✅ Production performance

---

## ✅ **Quick Test Checklist**

### **Step 1: Database Test**
```sql
-- In Supabase SQL Editor, check if subdomain is stored:
SELECT 
  id, 
  display_name, 
  subdomain, 
  personalization_enabled,
  primary_color,
  secondary_color
FROM users 
WHERE subdomain = 'testcreator';
```

**Expected:** Should see your user with subdomain set.

### **Step 2: Settings Test**
- Go to Dashboard → Personalization
- Settings should load with your subdomain
- Change colors and save
- Refresh - should persist

### **Step 3: Content Filtering Test**
- Upload a test video (if you haven't)
- Visit subdomain (Method 2 or 3)
- Should see only your videos
- Visit main domain - should see all videos

### **Step 4: Branding Test**
- Set custom colors in Dashboard
- Visit subdomain
- Purple bar should show your colors
- Logo should change (if set)

---

## 🐛 **Troubleshooting**

### **Subdomain Not Detected:**
- Check database: `SELECT subdomain FROM users WHERE id = 'your-user-id';`
- Verify `personalization_enabled = true`
- Check browser console for errors
- Verify subdomain format (lowercase, no spaces)

### **Content Not Filtering:**
- Check if you have videos uploaded
- Verify videos have correct `user_id`
- Check browser console for query errors
- Verify `currentCreator` is set in React DevTools

### **Branding Not Applying:**
- Check if colors are saved in database
- Verify CSS variables are set: `document.documentElement.style.getPropertyValue('--primary-color')`
- Check browser console for errors
- Hard refresh (Ctrl+Shift+R) to clear cache

### **DNS Not Working:**
- Verify DNS record exists: `nslookup testcreator.screenmerch.com`
- Check Netlify domain settings
- Wait for DNS propagation (can take up to 48 hours)
- Use Method 2 (hosts file) for immediate testing

---

## 📝 **Test Subdomain Examples**

### **Safe Test Names:**
- `testcreator`
- `mytest`
- `demo123`
- `brandtest`
- `creator1`

### **Names to Avoid (Reserved):**
- `www` - Reserved
- `api` - Reserved
- `admin` - Reserved
- `test` - Reserved (but might work)
- `mail` - Reserved
- `ftp` - Reserved

---

## 🎯 **Recommended Test Flow**

1. **Start with Dashboard Test (Method 1)**
   - Verify settings save
   - Check database

2. **Then Local Test (Method 2)**
   - Test full functionality
   - Verify content filtering
   - Check branding

3. **Finally Production Test (Method 3)**
   - Once DNS is ready
   - Test real subdomain
   - Verify production experience

---

## 💡 **Quick Test Script**

Here's a quick way to verify everything:

```javascript
// In browser console on your subdomain:
// 1. Check if creator is detected
console.log('Creator:', window.location.hostname);

// 2. Check CSS variables
console.log('Primary Color:', getComputedStyle(document.documentElement).getPropertyValue('--primary-color'));
console.log('Secondary Color:', getComputedStyle(document.documentElement).getPropertyValue('--secondary-color'));

// 3. Check if videos are filtered (should only show creator's videos)
// Check Network tab for Supabase queries - should have user_id filter
```

---

## ✅ **Success Indicators**

You'll know it's working when:

1. ✅ Dashboard shows subdomain saved
2. ✅ Database has subdomain stored
3. ✅ Visiting subdomain shows only your videos
4. ✅ Colors change to your custom colors
5. ✅ Logo changes (if set)
6. ✅ Meta tags update (check page source)
7. ✅ Favicon changes (if set)

---

## 🚀 **Ready to Test!**

**Recommended test subdomain:** `testcreator`

1. Go to Dashboard → Personalization
2. Enable personalization
3. Set subdomain: `testcreator`
4. Set test colors
5. Save
6. Test using Method 2 (hosts file) or wait for DNS

Everything is ready - just pick a subdomain name and start testing!
