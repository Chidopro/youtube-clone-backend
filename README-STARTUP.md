# 🚀 VidTube Startup Guide

## Easy Way to Start Both Servers

### Step 1: Start Backend Server
**Double-click** the `start-backend.bat` file in your main project folder.

You should see:
```
========================================
  VidTube Backend Server
  Port: 3001
  Health Check: http://localhost:3001/health
========================================

Backend server running on port 3001
```

**⚠️ Keep this window open!** - Don't close it or the backend will stop.

### Step 2: Start Frontend (if not already running)
Open a new terminal and run:
```bash
npm run dev
```

### Step 3: Test the System
1. Go to http://localhost:5173
2. Click the "Subscribe" button
3. Enter your email
4. Click "Send Approval Link"
5. Check your email inbox!

## Status Check
- ✅ **Frontend:** http://localhost:5173
- ✅ **Backend:** http://localhost:3001/health
- ✅ **Emails:** Sent via Mailgun to your inbox

## Troubleshooting
- If backend fails: Make sure Node.js is installed
- If emails don't send: Check the backend terminal for error messages
- If frontend doesn't work: Run `npm install` then `npm run dev` 