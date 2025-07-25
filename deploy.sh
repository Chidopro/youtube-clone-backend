#!/bin/bash

echo "🚀 ScreenMerch Deployment Script"
echo "================================"

echo ""
echo "1. Backend Deployment (Railway)"
echo "   - Go to https://railway.app"
echo "   - Create new project"
echo "   - Add service from GitHub"
echo "   - Select backend/ folder"
echo "   - Set environment variables"
echo ""

echo "2. Frontend Deployment (Netlify)"
echo "   - Go to https://netlify.com"
echo "   - Create new site from Git"
echo "   - Connect your repository"
echo "   - Set build command: npm run build"
echo "   - Set publish directory: dist"
echo "   - Set environment variables"
echo ""

echo "3. Environment Variables to Set:"
echo ""
echo "Backend (Railway):"
echo "  SUPABASE_URL=your_supabase_url"
echo "  SUPABASE_ANON_KEY=your_supabase_anon_key"
echo "  STRIPE_SECRET_KEY=your_stripe_secret_key"
echo "  STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret"
echo "  TWILIO_ACCOUNT_SID=your_twilio_sid"
echo "  TWILIO_AUTH_TOKEN=your_twilio_token"
echo "  TWILIO_PHONE_NUMBER=your_twilio_phone"
echo "  YOUR_PHONE_NUMBER=your_admin_phone"
echo "  MAILGUN_API_KEY=your_mailgun_key"
echo "  MAILGUN_DOMAIN=your_mailgun_domain"
echo "  MAILGUN_FROM=your_mailgun_from_email"
echo "  MAIL_TO=your_admin_email"
echo "  PRINTFUL_API_KEY=your_printful_key"
echo ""
echo "Frontend (Netlify):"
echo "  VITE_API_BASE_URL=https://your-railway-backend-url.railway.app"
echo "  VITE_EMAIL_API_URL=https://your-railway-backend-url.railway.app"
echo "  VITE_SUBSCRIPTION_API_URL=https://your-railway-backend-url.railway.app"
echo "  VITE_SUPABASE_URL=your_supabase_url"
echo "  VITE_SUPABASE_ANON_KEY=your_supabase_anon_key"
echo ""

echo "4. After Deployment:"
echo "   - Test both URLs"
echo "   - Update any hardcoded URLs in your code"
echo "   - Test all functionality"
echo ""

echo "✅ Ready to deploy!" 