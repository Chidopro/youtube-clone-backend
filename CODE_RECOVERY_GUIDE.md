# 🔄 Code Recovery Guide - ScreenMerch App

## 🚨 Your Situation
- Your laptop is BitLocker encrypted and you can't access it
- You have a folder copy that's not completely up to date
- Your app is working on:
  - **Frontend**: Netlify (screenmerch.com)
  - **Backend**: Fly.io (screenmerch.fly.dev)

## 🔍 What is SSH?

**SSH (Secure Shell)** is a way to securely connect to a remote server and access its command line. Think of it like:
- **Remote Desktop** but for command line only
- A way to **log into your server** and run commands
- Access to see files, run commands, and download code

### For Your Situation:
- **Fly.io SSH**: Connect to your backend server to see/download the deployed code
- **Netlify**: Doesn't support SSH, but has other ways to get code

---

## ✅ Your Options to Recover Latest Code

### **Option 1: Use Fly.io SSH (Best for Backend) ⭐**

Fly.io allows you to SSH into your running backend server and download the code.

#### Step 1: Install Fly.io CLI (if not already installed)
```bash
# Download from: https://fly.io/docs/hands-on/install-flyctl/
# Or use winget on Windows:
winget install flyctl
```

#### Step 2: Login to Fly.io
```bash
fly auth login
```

#### Step 3: SSH into Your Backend Server
```bash
cd backend
fly ssh console --app screenmerch
```

#### Step 4: Once Connected, Find Your Code
```bash
# List files in the container
ls -la

# Find your app.py
find . -name "app.py"

# View the code
cat app.py

# Or copy it to a file you can download
# (You'll need to use fly ssh to copy files out)
```

#### Step 5: Download Files from Container
```bash
# Exit SSH first (type: exit)
# Then use fly ssh to copy files:
fly ssh sftp --app screenmerch

# Or use fly ssh console and copy/paste code manually
```

**Note**: Fly.io containers are read-only for deployed code, but you can view and copy the files.

---

### **Option 2: Check Git Repository (If You Have One)**

If your code was pushed to GitHub/GitLab, that's the easiest way:

```bash
# Check if you have a git remote
git remote -v

# If you have a remote, pull latest code
git pull origin main
```

**Check your Netlify dashboard** - it shows which Git repository is connected!

---

### **Option 3: Download from Netlify (For Frontend)**

Netlify doesn't support SSH, but you can:

#### Option 3A: Check Connected Git Repository
1. Go to: https://app.netlify.com
2. Click on your site
3. Go to **Site settings > Build & deploy**
4. See which **Git repository** is connected
5. Clone that repository to get the latest frontend code

#### Option 3B: Download Deploy Files
1. Go to your Netlify dashboard
2. Click on a **deployment**
3. Click **"Download deploy"** (if available)
4. This gives you the **built files** (not source code, but better than nothing)

---

### **Option 4: Use Browser DevTools (Quick Reference)**

Since your app is working, you can:

1. **Open your live site**: https://screenmerch.com
2. **Press F12** to open DevTools
3. **Go to Sources tab**
4. **Browse the JavaScript files** to see the current frontend code
5. **Copy/paste** what you need

**Note**: This shows the **compiled/bundled** code, not the original source, but it's better than nothing!

---

### **Option 5: Contact Microsoft Support for BitLocker**

If you have time, you might be able to recover your laptop:

1. **Microsoft Account Recovery**: 
   - Go to: https://account.microsoft.com/devices/recoverykey
   - Look for your laptop's BitLocker recovery key

2. **Try Different Recovery Methods**:
   - Check if the key is saved in your Microsoft account
   - Check if you saved it to a file/USB drive
   - Check if your organization has it (if work laptop)

---

## 🎯 Recommended Action Plan

### **Immediate Steps (Do These First):**

1. **Check Git Repository** (5 minutes)
   ```bash
   git remote -v
   git log --oneline -10
   ```
   If you have a remote, pull the latest code!

2. **Check Netlify Dashboard** (5 minutes)
   - See which Git repo is connected
   - Clone that repo if available

3. **Use Fly.io SSH** (15 minutes)
   ```bash
   cd backend
   fly auth login
   fly ssh console --app screenmerch
   ```
   Then copy the code you need

### **If Git/SSH Don't Work:**

4. **Use Browser DevTools** to copy frontend code
5. **Use Fly.io SSH** to copy backend code
6. **Update your local folder** with the recovered code

---

## 📋 Quick Commands Reference

### Fly.io SSH Commands
```bash
# Login
fly auth login

# SSH into backend
cd backend
fly ssh console --app screenmerch

# Once inside, explore:
ls -la                    # List files
cat app.py               # View app.py
find . -name "*.py"      # Find Python files
exit                     # Exit SSH
```

### Git Commands
```bash
# Check remotes
git remote -v

# Pull latest
git pull origin main

# Check recent commits
git log --oneline -20
```

---

## ⚠️ Important Notes

1. **Fly.io containers** are typically read-only for deployed code
2. **Netlify** doesn't store source code - only built files
3. **Git is your best friend** - if you have a repo, use it!
4. **Browser DevTools** shows compiled code, not original source
5. **SSH access** might require proper authentication setup

---

## 🆘 Need Help?

If you get stuck:
1. Check Fly.io docs: https://fly.io/docs/app-guides/ssh-into-apps/
2. Check Netlify docs: https://docs.netlify.com/
3. The code in your current folder might be closer to latest than you think!

---

**Last Updated**: January 27, 2025
**Status**: Recovery Guide Ready

