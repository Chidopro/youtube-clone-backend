# 🎯 ACTIVE FILES MAPPING - ScreenMerch Project

## 🚨 CRITICAL: Only Edit These Files!

### ✅ BACKEND (Fly.io Deployment)
**Location**: `backend/` directory
**Deployment**: `fly deploy` from `backend/` directory
**Active Files**:
- `backend/app.py` ← **MAIN BACKEND FILE** (Flask server)
- `backend/fly.toml` ← **DEPLOYMENT CONFIG**
- `backend/requirements.txt` ← **PYTHON DEPENDENCIES**

### ✅ FRONTEND (Netlify Deployment)  
**Location**: `frontend/` directory
**Deployment**: Netlify auto-deploys from `frontend/` directory
**Active Files**:
- `frontend/src/App.jsx` ← **MAIN APP COMPONENT**
- `frontend/src/main.jsx` ← **ENTRY POINT**
- `frontend/src/Components/Navbar/Navbar.jsx` ← **NAVBAR COMPONENT**
- `frontend/src/Pages/Login/Login.jsx` ← **LOGIN PAGE**
- `frontend/src/Pages/Upload/Upload.jsx` ← **UPLOAD PAGE**
- `frontend/src/Components/PlayVideo/PlayVideo.jsx` ← **VIDEO PLAYER**
- `frontend/package.json` ← **NPM CONFIG**
- `frontend/vite.config.js` ← **BUILD CONFIG**
- `frontend/netlify.toml` ← **NETLIFY CONFIG**

### ❌ INACTIVE/DUPLICATE FILES (DO NOT EDIT)
**These files are NOT used in production**:
- `src/` directory (root level) ← **INACTIVE**
- `app.py` (root level) ← **INACTIVE** 
- `package.json` (root level) ← **INACTIVE**
- `vite.config.js` (root level) ← **INACTIVE**
- `netlify.toml` (root level) ← **INACTIVE**
- `fly.toml` (root level) ← **INACTIVE**

## 🔍 How to Verify Active Files

### Backend Verification:
```bash
cd backend
fly status  # Should show active deployment
```

### Frontend Verification:
```bash
cd frontend
npm run build  # Should create dist/ folder
ls dist/       # Should show built files
```

## 🚀 Deployment Commands

### Backend (Fly.io):
```bash
cd backend
fly deploy
```

### Frontend (Netlify):
```bash
cd frontend
npm run build
# Netlify auto-deploys from this directory
```

## ⚠️ IMPORTANT NOTES

1. **Always check the directory** before editing files
2. **Backend files** are in `backend/` directory
3. **Frontend files** are in `frontend/src/` directory  
4. **Root level files** are mostly inactive duplicates
5. **When in doubt**, check the deployment configs:
   - `backend/fly.toml` for backend
   - `frontend/netlify.toml` for frontend

## 🧹 Cleanup Recommendations

Consider removing these inactive directories to avoid confusion:
- `src/` (root level)
- `dist/` (root level) 
- Root level config files (`package.json`, `vite.config.js`, etc.)

---
**Last Updated**: January 27, 2025
**Status**: ✅ Verified Active Files
