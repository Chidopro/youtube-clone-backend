# 🚀 Heroku Backend Deployment Guide

## Prerequisites
- Heroku account (you have this ✅)
- Heroku CLI installed (optional but recommended)
- Your code pushed to GitHub

## Step 1: Deploy Backend to Heroku

### Option A: Using Heroku CLI (Recommended)

1. **Install Heroku CLI** (if not already installed):
   ```bash
   # Windows
   winget install --id=Heroku.HerokuCLI
   
   # Or download from: https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login to Heroku**:
   ```bash
   heroku login
   ```

3. **Navigate to backend folder**:
   ```bash
   cd backend
   ```

4. **Create Heroku app**:
   ```bash
   heroku create your-app-name
   ```

5. **Set environment variables**:
   ```bash
   heroku config:set SUPABASE_URL=your_supabase_url
   heroku config:set SUPABASE_ANON_KEY=your_supabase_anon_key
   heroku config:set STRIPE_SECRET_KEY=your_stripe_secret_key
   heroku config:set STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   heroku config:set TWILIO_ACCOUNT_SID=your_twilio_sid
   heroku config:set TWILIO_AUTH_TOKEN=your_twilio_token
   heroku config:set TWILIO_PHONE_NUMBER=your_twilio_phone
   heroku config:set YOUR_PHONE_NUMBER=your_admin_phone
   heroku config:set MAILGUN_API_KEY=your_mailgun_key
   heroku config:set MAILGUN_DOMAIN=your_mailgun_domain
   heroku config:set MAILGUN_FROM=your_mailgun_from_email
   heroku config:set MAIL_TO=your_admin_email
   heroku config:set PRINTFUL_API_KEY=your_printful_key
   ```

6. **Deploy to Heroku**:
   ```bash
   git add .
   git commit -m "Deploy to Heroku"
   git push heroku main
   ```

### Option B: Using Heroku Dashboard

1. **Go to [Heroku Dashboard](https://dashboard.heroku.com)**
2. **Click "New" → "Create new app"**
3. **Choose app name** (e.g., `screenmerch-backend`)
4. **Select region** (closest to your users)
5. **Click "Create app"**

6. **Connect to GitHub**:
   - Go to "Deploy" tab
   - Choose "GitHub" as deployment method
   - Connect your GitHub account
   - Select your repository
   - Set branch to `main` (or your default branch)

7. **Set buildpack**:
   - Go to "Settings" tab
   - Click "Add buildpack"
   - Select "Python"

8. **Set environment variables**:
   - Go to "Settings" tab
   - Click "Reveal Config Vars"
   - Add each environment variable:
     ```
     SUPABASE_URL=your_supabase_url
     SUPABASE_ANON_KEY=your_supabase_anon_key
     STRIPE_SECRET_KEY=your_stripe_secret_key
     STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
     TWILIO_ACCOUNT_SID=your_twilio_sid
     TWILIO_AUTH_TOKEN=your_twilio_token
     TWILIO_PHONE_NUMBER=your_twilio_phone
     YOUR_PHONE_NUMBER=your_admin_phone
     MAILGUN_API_KEY=your_mailgun_key
     MAILGUN_DOMAIN=your_mailgun_domain
     MAILGUN_FROM=your_mailgun_from_email
     MAIL_TO=your_admin_email
     PRINTFUL_API_KEY=your_printful_key
     ```

9. **Deploy**:
   - Go to "Deploy" tab
   - Click "Deploy Branch"

## Step 2: Update Frontend Configuration

Once your Heroku app is deployed, you'll get a URL like:
`https://your-app-name.herokuapp.com`

Update your Netlify environment variables:
```
VITE_API_BASE_URL=https://your-app-name.herokuapp.com
VITE_EMAIL_API_URL=https://your-app-name.herokuapp.com
VITE_SUBSCRIPTION_API_URL=https://your-app-name.herokuapp.com
```

## Step 3: Test Your Deployment

1. **Test backend directly**:
   ```
   https://your-app-name.herokuapp.com/
   ```

2. **Test API endpoints**:
   ```
   https://your-app-name.herokuapp.com/api/create-product
   ```

3. **Check logs** (if using CLI):
   ```bash
   heroku logs --tail
   ```

## Troubleshooting

### Common Issues:

1. **Build fails**: Check that `requirements.txt` is in the backend folder
2. **App crashes**: Check logs with `heroku logs --tail`
3. **CORS errors**: Make sure your frontend URL is in the CORS origins
4. **Environment variables**: Double-check all variables are set correctly

### Useful Commands:

```bash
# View logs
heroku logs --tail

# Restart app
heroku restart

# Check config vars
heroku config

# Open app in browser
heroku open

# Run one-off dyno (for debugging)
heroku run python app.py
```

## Next Steps

1. ✅ Deploy backend to Heroku
2. ✅ Update frontend environment variables
3. ✅ Test both deployments
4. ✅ Monitor logs for any issues
5. ✅ Set up custom domain (optional)

Your backend will be much more reliable on Heroku compared to Render! 🎉 