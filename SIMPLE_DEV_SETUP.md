# Simple Development Setup for ScreenMerch

## 🎯 What You Need
You have a working ScreenMerch website at `screenmerch.com` that's currently broken. You need to:
1. Make edits safely without affecting the live site
2. Fix the merchandise page issues
3. Test changes before deploying

## 🚀 Quick Start (5 minutes)

### 1. Create a Development Branch
```bash
git checkout -b fix/merchandise-page
```

### 2. Start Local Development
```bash
# Terminal 1: Start backend
python app.py

# Terminal 2: Start frontend  
cd frontend
npm run dev
```

### 3. Access Your Local Development
- Backend: http://localhost:5000
- Frontend: http://localhost:5173

## 🔧 What This Gives You

### Safe Development Environment
- ✅ Changes only affect local development
- ✅ Live site remains untouched
- ✅ Test everything before deploying
- ✅ Easy rollback if needed

### Current Issues to Fix
Based on your feedback:
- ❌ Merchandise page layout problems
- ❌ Product selection not working
- ❌ Screenshot integration issues

## 📝 Simple Workflow

### 1. Make Changes Locally
- Edit files in your local environment
- Test changes at `localhost:5173`
- Fix the merchandise page issues

### 2. Test Thoroughly
- Test screenshot capture
- Test merchandise creation
- Test all user flows

### 3. Deploy Only When Ready
```bash
# Commit your changes
git add .
git commit -m "Fix merchandise page layout and functionality"

# Deploy to production
fly deploy
```

## 🎯 Focus Areas

### Merchandise Page Issues
- Layout improvements
- Product selection functionality
- Better user experience
- Screenshot integration

### Safe Deployment
- Test locally first
- Deploy only when confident
- Have rollback plan ready

## ⚠️ Important Notes

### Don't Break the Live Site
- Always test locally first
- Use feature branches
- Deploy only when ready

### Emergency Rollback
If the live site breaks:
```bash
git log --oneline -5
git checkout <previous_working_commit>
fly deploy
```

## 🚀 Next Steps

1. **Start local development** (commands above)
2. **Focus on merchandise page fixes**
3. **Test everything locally**
4. **Deploy only when ready**

That's it! No complex setup needed - just a safe way to edit your working website. 