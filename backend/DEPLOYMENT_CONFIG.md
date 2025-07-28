# ScreenMerch Production Deployment Guide

## Environment Variables Setup

### Frontend (.env file in root directory)
Create a `.env` file in your project root:

```env
# Backend API URL - Flask server for Make Merch functionality  
VITE_API_URL=https://api.screenmerch.com

# Node.js Services (if needed)
VITE_SUBSCRIPTION_API_URL=https://subscriptions.screenmerch.com
VITE_EMAIL_API_URL=https://email.screenmerch.com

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Backend (.env file in backend/ directory)
Your backend/.env is already configured with:
- Twilio credentials
- Supabase credentials
- Other services

## Netlify Deployment Steps

### 1. Frontend (React) on Netlify

1. **Connect Repository:**
   - Go to Netlify Dashboard
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository

2. **Build Settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Base directory: `/` (root)

3. **Environment Variables in Netlify:**
   - Go to Site Settings → Environment Variables
   - Add all VITE_ variables from .env file

4. **Custom Domain:**
   - Go to Site Settings → Domain management
   - Add custom domain: `screenmerch.com`
   - Configure DNS (A record or CNAME)

### 2. Backend (Flask) on Railway

1. **Deploy to Railway:**
   - Go to railway.app
   - Connect GitHub repository
   - Select the `backend` folder as root
   - Railway will auto-detect Python/Flask

2. **Environment Variables in Railway:**
   - Add all variables from backend/.env
   - Set `RAILWAY_PORT` if needed

3. **Custom Domain:**
   - In Railway dashboard → Settings → Domains
   - Add custom domain: `api.screenmerch.com`

## DNS Configuration

Point your domain to:
- `screenmerch.com` → Netlify (A record or CNAME)
- `api.screenmerch.com` → Railway (CNAME)

## A2P 10DLC Registration Info

Once deployed, use these URLs for registration:
- **Website:** https://screenmerch.com
- **Privacy Policy:** https://screenmerch.com/privacy-policy
- **Opt-in Location:** https://screenmerch.com/checkout/{product_id}

## Testing Checklist

After deployment:
- [ ] Frontend loads at screenmerch.com
- [ ] Backend API responds at api.screenmerch.com
- [ ] Make Merch button works
- [ ] Checkout flow shows SMS consent
- [ ] Privacy policy accessible
- [ ] SMS opt-in required for checkout 