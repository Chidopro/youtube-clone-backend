# ScreenMerch - Quick Start for Safe Development

## 🎯 The Problem
Your live site at `screenmerch.com` is broken, and you need to fix the merchandise page without making it worse.

## ✅ The Solution
Use your existing development environment to make changes safely.

## 🚀 Start Development (2 minutes)

### Option 1: Use the Simple Script
```bash
start_simple.bat
```

### Option 2: Manual Start
```bash
# Terminal 1: Backend
python app.py

# Terminal 2: Frontend
cd frontend
npm run dev
```

## 📍 Access Your Development
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:5000

## 🔧 What You Can Do Now

### Safe Development
- ✅ Edit files locally
- ✅ Test changes at localhost:5173
- ✅ Live site stays untouched
- ✅ Deploy only when ready

### Focus on These Issues
- ❌ Merchandise page layout problems
- ❌ Product selection not working  
- ❌ Screenshot integration issues

## 📝 Simple Workflow

1. **Make changes** to your files
2. **Test locally** at localhost:5173
3. **Fix issues** you mentioned
4. **Deploy when ready** with `fly deploy`

## ⚠️ Important
- Always test locally first
- Use git branches for safety
- Deploy only when confident

That's it! No complex setup - just your existing development environment for safe editing. 