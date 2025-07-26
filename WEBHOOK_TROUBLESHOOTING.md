# ScreenMerch Webhook Troubleshooting Guide

## 🚨 Current Issue
Success email is not being sent after Stripe payment completion. Webhook events are not being logged.

## 🔍 Root Cause Analysis

Based on your Stripe dashboard and code analysis, here are the most likely issues:

### 1. Webhook URL Configuration
**Current webhook URL in Stripe:** `https://backend-hidden-firefly-7865.fly.dev/webhook`
**Expected webhook URL:** `https://backend-hidden-firefly-7865.fly.dev/webhook`

✅ **Status:** URL appears correct

### 2. Webhook Secret Mismatch
You mentioned updating the webhook secret, but there might be a mismatch between:
- Stripe Dashboard webhook secret
- Environment variable `STRIPE_WEBHOOK_SECRET`
- Deployed application environment

### 3. Event Type Configuration
**Current event:** `checkout.session.completed`
**Code handling:** ✅ Correctly implemented

### 4. Application Deployment
**Deployment status:** ✅ App is deployed and running

## 🛠️ Step-by-Step Troubleshooting

### Step 1: Verify Webhook Secret
1. Go to your Stripe Dashboard → Developers → Webhooks
2. Click on your webhook endpoint
3. Click "Reveal" next to "Signing secret"
4. Copy the secret (starts with `whsec_`)

### Step 2: Update Environment Variables
```bash
# Update your .env file with the correct webhook secret
STRIPE_WEBHOOK_SECRET=whsec_your_actual_secret_here
```

### Step 3: Redeploy Application
```bash
fly deploy
```

### Step 4: Test Webhook Endpoint
Run the debug script:
```bash
python test_webhook_debug.py
```

### Step 5: Check Application Logs
```bash
fly logs
```

### Step 6: Test Real Payment
1. Make a test purchase using Stripe test card: `4242 4242 4242 4242`
2. Check if webhook events appear in Stripe dashboard
3. Check application logs for webhook processing

## 🔧 Common Issues and Solutions

### Issue 1: Webhook Secret Mismatch
**Symptoms:** 400 errors in webhook logs
**Solution:** 
- Verify webhook secret in Stripe dashboard
- Update environment variable
- Redeploy application

### Issue 2: Webhook Not Receiving Events
**Symptoms:** No events in Stripe webhook logs
**Solution:**
- Check webhook URL is correct
- Verify webhook is enabled
- Check if events are being triggered

### Issue 3: Application Not Processing Events
**Symptoms:** Events received but no email sent
**Solution:**
- Check application logs
- Verify email service configuration (Resend API)
- Check environment variables

### Issue 4: Order Data Missing
**Symptoms:** Webhook processes but no order data found
**Solution:**
- Verify `order_id` is passed in Stripe session metadata
- Check `order_store` contains the order data

## 📋 Verification Checklist

- [ ] Webhook URL is correct in Stripe dashboard
- [ ] Webhook secret matches environment variable
- [ ] Webhook is enabled and listening for `checkout.session.completed`
- [ ] Application is deployed and running
- [ ] Environment variables are set correctly
- [ ] Email service (Resend) is configured
- [ ] Test payment triggers webhook event
- [ ] Application logs show webhook processing
- [ ] Success email is sent

## 🧪 Testing Steps

### 1. Basic Connectivity Test
```bash
curl -X POST https://backend-hidden-firefly-7865.fly.dev/webhook \
  -H "Content-Type: application/json" \
  -d '{"test":"ping"}'
```

### 2. Webhook Signature Test
```bash
python test_webhook_debug.py
```

### 3. Real Payment Test
1. Use test card: `4242 4242 4242 4242`
2. Complete a purchase
3. Check Stripe webhook logs
4. Check application logs
5. Verify email is sent

## 📞 Debug Information

### Current Configuration
- **Webhook URL:** `https://backend-hidden-firefly-7865.fly.dev/webhook`
- **Event Type:** `checkout.session.completed`
- **Email Service:** Resend API
- **Deployment:** Fly.io

### Key Files
- `app.py` - Main webhook handler (lines 760-852)
- `test_webhook_debug.py` - Debug script
- Environment variables in deployment

### Log Locations
- Stripe Dashboard → Developers → Webhooks → View logs
- Application logs: `fly logs`
- Email service logs: Resend dashboard

## 🚀 Quick Fix Steps

1. **Update webhook secret** in your environment variables
2. **Redeploy** the application: `fly deploy`
3. **Test** with a real payment
4. **Check logs** for any errors
5. **Verify** email is sent

## 📞 Support

If issues persist:
1. Run the debug script and share output
2. Check application logs and share relevant errors
3. Verify webhook secret is correct
4. Test with a real payment and share results 