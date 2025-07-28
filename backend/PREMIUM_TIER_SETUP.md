# Premium Tier Setup Guide

This guide explains how to set up the Premium Tier with Stripe integration for ScreenMerch.

## 🚀 Features Implemented

### Premium Tier ($9.99/month)
- ✅ Stripe checkout integration
- ✅ Automatic subscription management
- ✅ Webhook handling for payment events
- ✅ Success/failure page handling
- ✅ Database integration with user_subscriptions table
- ✅ Premium feature access control

### Premium Features
- Advanced analytics
- Priority support
- Custom branding
- Enhanced upload limits
- All Premium tier benefits

## 🛠️ Setup Instructions

### 1. Install Dependencies

In the backend directory:
```bash
cd backend
npm install stripe @supabase/supabase-js
```

### 2. Environment Variables

Add these to your `.env` file:

```env
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret

# Application URLs
FRONTEND_URL=http://localhost:5176
```

### 3. Stripe Configuration

1. **Create Stripe Account**: Sign up at [https://stripe.com](https://stripe.com)
2. **Get API Keys**: Go to Developers > API Keys
3. **Set up Webhook**: 
   - Go to Developers > Webhooks
   - Add endpoint: `http://localhost:3002/api/stripe-webhook`
   - Select events: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`

### 4. Database Setup

The Premium tier uses the existing `user_subscriptions` table with these fields:
- `stripe_subscription_id`: Stripe subscription ID
- `stripe_customer_id`: Stripe customer ID
- `current_period_start`: Subscription start date
- `current_period_end`: Subscription end date

## 🔄 Payment Flow

1. **User clicks "Subscribe Now"** on Premium tier
2. **Frontend calls** `/api/create-premium-checkout`
3. **Backend creates** Stripe checkout session
4. **User redirected** to Stripe payment page
5. **After payment**, user redirected to `/subscription-success`
6. **Stripe webhook** confirms payment and updates database
7. **Frontend verifies** subscription and activates features

## 🧪 Testing

### Test Mode
- Use Stripe test mode with test card numbers
- Test card: `4242 4242 4242 4242`
- Any future expiry date and CVC

### Webhook Testing
1. Install Stripe CLI: `stripe login`
2. Forward webhooks: `stripe listen --forward-to localhost:3002/api/stripe-webhook`
3. Test payment flow

## 📁 Files Created/Modified

### New Files:
- `src/Pages/SubscriptionSuccess/SubscriptionSuccess.jsx`
- `src/Pages/SubscriptionSuccess/SubscriptionSuccess.css`

### Modified Files:
- `src/utils/subscriptionService.js` - Added Premium tier methods
- `src/Pages/SubscriptionTiers/SubscriptionTiers.jsx` - Premium tier handler
- `backend/server.js` - Stripe endpoints
- `backend/package.json` - Added Stripe dependency
- `src/App.jsx` - Added success page route

## 🎯 Premium Tier Features

The Premium tier unlocks:
- Enhanced upload capabilities
- Advanced analytics dashboard
- Priority customer support
- Custom branding options
- Increased storage limits

## 🔐 Security Features

- ✅ Stripe webhook signature verification
- ✅ User authentication required
- ✅ Database transaction safety
- ✅ Error handling and rollback
- ✅ Secure payment processing

## 🚨 Production Checklist

Before going live:

1. ✅ Switch to Stripe live mode
2. ✅ Update webhook URLs to production
3. ✅ Set production environment variables
4. ✅ Test complete payment flow
5. ✅ Set up monitoring and alerts
6. ✅ Configure backup webhook endpoints

## 💡 Next Steps

- Creator Network Tier ($29.99/month) integration
- Annual billing discounts
- Proration handling for upgrades/downgrades
- Enhanced analytics for Premium users
- Advanced reporting features

## 🐛 Troubleshooting

### Common Issues:
1. **Webhook not receiving events**: Check webhook URL and events selection
2. **Payment success but no activation**: Check webhook endpoint and database logs
3. **Redirect issues**: Verify success/cancel URLs in Stripe configuration

### Debug Tips:
- Check browser network tab for API calls
- Monitor Stripe dashboard for payment events
- Check backend logs for webhook processing
- Verify database updates in Supabase dashboard

---

## 🎉 Ready to Go!

Your Premium Tier is now fully configured with:
- Secure Stripe payment processing
- Automated subscription management  
- Professional user experience
- Robust error handling

Users can now subscribe to Premium and enjoy enhanced features! 🚀 