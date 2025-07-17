# 🚀 Production Deployment Guide

## Overview
This guide covers deploying the YouTube Clone React app to production:
- **Frontend**: Netlify → screenmerch.com
- **Backend**: Railway/Render → api.screenmerch.com

## 📋 Prerequisites

1. **Netlify Account** - Sign up at [netlify.com](https://netlify.com)
2. **Backend Deployed** - Deploy your Flask backend to Railway/Render
3. **Supabase Project** - Production Supabase instance
4. **Domain** - screenmerch.com pointed to Netlify

## 🔧 Step 1: Environment Configuration

### Frontend Environment Variables (Set in Netlify Dashboard)

Navigate to **Site Settings > Environment Variables** in Netlify and add:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Backend API URLs (Production)
VITE_API_BASE_URL=https://api.screenmerch.com
VITE_EMAIL_API_URL=https://api.screenmerch.com
VITE_SUBSCRIPTION_API_URL=https://api.screenmerch.com
```

### Development Environment Variables

For local development, you can set these in your system environment or create a `.env.local` file:

```bash
# Development Environment Variables
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Backend API URLs (Development)
VITE_API_BASE_URL=http://127.0.0.1:5000
VITE_EMAIL_API_URL=http://localhost:3001
VITE_SUBSCRIPTION_API_URL=http://localhost:3002
```

## 🌐 Step 2: Deploy to Netlify

### Option A: Git Integration (Recommended)

1. **Connect Repository**:
   - Go to Netlify Dashboard
   - Click "New site from Git"
   - Connect your GitHub/GitLab repository

2. **Build Settings**:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Node version**: `18`

3. **Deploy Settings**:
   - The `netlify.toml` file is already configured
   - Environment variables will be loaded automatically

### Option B: Manual Deploy

1. **Build Locally**:
   ```bash
   npm run build
   ```

2. **Upload dist folder** to Netlify manually

## 🔒 Step 3: Domain Configuration

1. **Add Custom Domain**:
   - Go to **Site Settings > Domain Management**
   - Add `screenmerch.com` as custom domain

2. **DNS Configuration**:
   - Point your domain to Netlify:
   ```
   Type: CNAME
   Name: www
   Value: your-site-name.netlify.app

   Type: A
   Name: @
   Value: 75.2.60.5
   ```

3. **SSL Certificate**:
   - Netlify automatically provides free SSL
   - Enable "Force HTTPS redirect"

## 🛠️ Step 4: Backend Deployment

Deploy your Flask backend to Railway or Render with these endpoints:
- `/api/create-product`
- `/api/send-subscription-email`
- `/api/verify-subscription`
- `/api/users/{username}/subscription`

Make sure your backend:
1. **Handles CORS** for `https://screenmerch.com`
2. **Has proper environment variables** configured
3. **Uses production database connections**

## 🧪 Step 5: Testing

### Local Testing
```bash
# Test development build
npm run dev

# Test production build locally  
npm run build
npm run preview
```

### Production Testing
1. **Visit** `https://screenmerch.com`
2. **Test all features**:
   - Video playback
   - User authentication
   - Subscription system
   - API connections
   - Merch creation

## 📝 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ0eXAi...` |
| `VITE_API_BASE_URL` | Main backend API | `https://api.screenmerch.com` |
| `VITE_EMAIL_API_URL` | Email service API | `https://api.screenmerch.com` |
| `VITE_SUBSCRIPTION_API_URL` | Subscription API | `https://api.screenmerch.com` |

## 🔄 Deployment Process

### Automated Deployment (Git Integration)
1. **Push to main branch**
2. **Netlify automatically builds and deploys**
3. **Check deployment logs for errors**

### Manual Deployment
1. **Run build command**: `npm run build`
2. **Upload `dist` folder** to Netlify
3. **Update environment variables** if needed

## 🐛 Troubleshooting

### Common Issues

**1. Environment Variables Not Working**
- Check Netlify environment variables are set correctly
- Ensure variables start with `VITE_`
- Redeploy after changing environment variables

**2. API Calls Failing**
- Verify backend is deployed and accessible
- Check CORS configuration on backend
- Confirm API endpoints match configuration

**3. Build Failures**
- Check Node.js version (should be 18+)
- Verify all dependencies are installed
- Review build logs for specific errors

**4. Routing Issues**
- Ensure `netlify.toml` redirects are configured
- Check React Router configuration

### Debug Commands
```bash
# Check environment variables
npm run build -- --debug

# Preview production build locally
npm run preview

# Check for linting issues
npm run lint
```

## 📊 Performance Optimization

The configuration includes:
- **Code splitting** by vendor and feature
- **Asset caching** for static files
- **Security headers** for production
- **Build optimization** with Rollup

## 🔐 Security

Production includes:
- **HTTPS enforcement**
- **Security headers** (XSS, CSRF protection)
- **Environment variable security**
- **CORS configuration**

## 📞 Support

If you encounter issues:
1. **Check deployment logs** in Netlify dashboard
2. **Verify environment variables** are set correctly  
3. **Test API endpoints** independently
4. **Review browser console** for client-side errors

---

**🎉 Once deployed, your YouTube clone will be live at `https://screenmerch.com`!** 