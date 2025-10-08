# 🚀 Deploy Email Sign-In Fix

## Summary of Issues Fixed

### 1. Email Whitelist Blocking Users ✅
- Backend had hardcoded email whitelist
- Only 4 specific emails could sign in
- **Fixed**: Removed whitelist from login/signup endpoints

### 2. Correct Backend URL ✅  
- Frontend points to: `screenmerch.fly.dev` ✅
- **Updated**: All frontend configs and docs reference `screenmerch.fly.dev`

---

## 📦 Files Changed

### Backend Changes (`backend/app.py`)
- Line ~3210: Removed email whitelist from `/api/auth/login`
- Line ~3270: Removed email whitelist from `/api/auth/signup`

### Frontend Changes
- `frontend/src/config/apiConfig.js` - Fixed backend URL to screenmerch.fly.dev
- `frontend/src/cache-bust.js` - Updated logging
- `frontend/netlify.toml` - CSP includes screenmerch.fly.dev ✅

---

## 🚀 Deployment Steps

### Step 1: Deploy Backend to Fly.io

```bash
cd backend
fly deploy --app screenmerch
```

**Wait for deployment to complete** (check Fly.io dashboard shows "Running")

### Step 2: Test Backend is Working

Open browser and visit:
```
https://screenmerch.fly.dev/api/ping
```

Should return: `{"message": "pong"}`

### Step 3: Deploy Frontend to Netlify

```bash
cd frontend
npm run build
```

**Commit and push changes:**
```bash
git add .
git commit -m "fix: Update backend URL to screenmerch.fly.dev and remove email whitelist"
git push origin main
```

Netlify will auto-deploy from your GitHub repository.

### Step 4: Wait for Netlify Deployment

1. Go to: https://app.netlify.com/projects/eloquent-crumble-37c09e
2. Click "Watch NTL Deploy" (from your screenshot)
3. Wait for deployment to complete (~2-3 minutes)
4. You'll see: "Published" with green checkmark

### Step 5: Clear Browser Cache & Test

**Clear Cache:**
1. Open your site: https://screenmerch.com
2. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
3. Clear "Cached images and files"
4. Click "Clear data"

**Or do a Hard Refresh:**
- Windows: `Ctrl + F5`
- Mac: `Cmd + Shift + R`

**Test Sign-In:**
1. Go to login page
2. Try signing up with ANY email (e.g., `test@example.com`)
3. Should work without "Access restricted" error ✅

---

## 🧪 Testing Checklist

### Before Deployment
- [x] Backend whitelist removed
- [x] Frontend URL updated to screenmerch.fly.dev
- [x] CSP includes screenmerch.fly.dev

### After Deployment
- [ ] Backend responds to /api/ping
- [ ] Frontend loads without errors
- [ ] Can create account with any email
- [ ] Can login with existing credentials
- [ ] No "Access restricted" errors
- [ ] No CSP errors in browser console

---

## 🔍 How to Check if It's Working

### 1. Open Browser DevTools
Press `F12` on your site

### 2. Check Console Tab
You should see:
```
🔧 FORCING PRODUCTION API CONFIG OVERRIDE
🔧 Forced API_BASE_URL: https://screenmerch.fly.dev
```

### 3. Try to Sign Up
Enter any email and password (6+ characters)

### 4. Check Network Tab in DevTools
Look for request to:
```
https://screenmerch.fly.dev/api/auth/signup
```

Should return:
```json
{
  "success": true,
  "message": "Account created successfully"
}
```

---

## ❌ Troubleshooting

### "Access restricted to authorized users only"
- Backend not deployed yet
- Clear browser cache completely
- Check Fly.io shows backend is "Running"

### "Failed to fetch" or Connection timeout
- Check backend is running: `fly status --app screenmerch`
- Check backend logs: `fly logs --app screenmerch`
- Verify CSP in browser console (F12 → Console)

### CSP Error in Console
```
Refused to connect to 'https://screenmerch.fly.dev' because it violates CSP
```
- Frontend not deployed yet
- Clear browser cache
- Check Netlify deployment completed

### Email still not working after deployment
1. **Hard refresh**: Ctrl+F5 (Cmd+Shift+R on Mac)
2. **Clear browser cache completely**
3. **Try incognito/private window**
4. **Check console for actual error message**

---

## 🎯 Expected Result

After successful deployment:

✅ **Any email can sign up** (no whitelist restriction)  
✅ **Frontend connects to screenmerch.fly.dev**  
✅ **Login/signup works smoothly**  
✅ **No console errors**  
✅ **Users can access product pages**  

---

## 📝 Quick Deploy Commands

**Full deployment (copy and paste):**

```bash
# Deploy backend
cd backend
fly deploy --app screenmerch

# Build and deploy frontend
cd ../frontend
npm run build
git add .
git commit -m "fix: Update backend URL to screenmerch.fly.dev and remove email whitelist"
git push origin main

# Watch deployment on Netlify dashboard
```

---

## ✅ Verification After Deploy

1. Visit: https://screenmerch.com
2. Open DevTools (F12)
3. Check console shows: `Forced API_BASE_URL: https://screenmerch.fly.dev`
4. Try signing up with `test123@gmail.com`
5. Should succeed ✅

**Your email sign-in should now work perfectly!** 🎉

