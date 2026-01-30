# App.py Refactoring Plan

## Current State
- **File:** `app.py` - 9,159 lines
- **Routes:** 83 endpoints
- **Structure:** All code in one monolithic file

## Target Structure

```
backend/
├── app.py (200-300 lines) - App initialization & Blueprint registration
├── routes/
│   ├── __init__.py
│   ├── auth.py (~800 lines) - Authentication routes
│   ├── admin.py (~2000 lines) - Admin dashboard & management
│   ├── products.py (~600 lines) - Product endpoints
│   ├── orders.py (~800 lines) - Order processing
│   ├── videos.py (~500 lines) - Video endpoints
│   └── analytics.py (~400 lines) - Analytics endpoints
├── services/
│   ├── __init__.py
│   └── email_service.py - Email notifications
└── utils/
    ├── __init__.py
    ├── helpers.py - Utility functions
    └── security.py - Security decorators
```

## Route Distribution

### Auth Routes (routes/auth.py)
- `/api/auth/login`
- `/api/auth/signup`
- `/api/auth/signup/email-only`
- `/api/auth/verify-email`
- `/api/auth/check-admin`
- `/api/auth/google/login`
- `/api/auth/google/callback`
- `/login`
- `/admin/login`

### Admin Routes (routes/admin.py)
- `/api/admin/dashboard-stats`
- `/api/admin/check-status`
- `/api/admin/subdomains`
- `/api/admin/subdomains/<user_id>`
- `/api/admin/subdomains/validate`
- `/api/admin/fix-order-queue/<order_id>`
- `/api/admin/processing-queue`
- `/api/admin/processing-history`
- `/api/admin/delete-order/<queue_id>`
- `/api/admin/workers`
- `/api/admin/reset-sales`
- `/api/admin/platform-revenue`
- `/api/admin/recent-orders`
- `/admin/setup`
- `/admin/orders`
- `/admin/order/<order_id>`
- `/admin/order/<order_id>/status`
- `/admin/logout`

### Product Routes (routes/products.py)
- `/api/product/browse`
- `/api/product/<product_id>`
- `/api/create-product`
- `/api/printful/create-product`
- `/product/browse`
- `/product/<product_id>`
- `/product-new/<product_id>`
- `/simple-merchandise/<product_id>`
- `/checkout/<product_id>`

### Order Routes (routes/orders.py)
- `/api/place-order`
- `/send-order`
- `/api/printful/create-order`
- `/api/create-checkout-session`
- `/create-checkout-session`
- `/webhook` (Stripe)
- `/success`
- `/api/get-order-screenshot/<order_id>`
- `/api/test-order-email`
- `/api/calculate-shipping`

### Video Routes (routes/videos.py)
- `/api/videos`
- `/api/video-info`
- `/api/search/creators`
- `/api/capture-screenshot`
- `/api/capture-multiple-screenshots`
- `/api/capture-print-quality`
- `/api/process-shirt-image`
- `/api/process-corner-radius`
- `/api/apply-feather-to-print-quality`
- `/api/apply-feather-only`
- `/api/process-thumbnail-print-quality`
- `/print-quality`

### Analytics Routes (routes/analytics.py)
- `/api/analytics`

### Other Routes (to be determined)
- `/api/ping`
- `/api/users/ensure-exists`
- `/api/users/<user_id>/update-profile`
- `/api/users/<user_id>/delete-account`
- `/api/create-pro-checkout`
- `/api/test-stripe`
- `/api/test-email-config`
- `/api/subdomain/<subdomain>`
- `/api/supabase-webhook`
- `/api/fix-database-schema`
- `/` (home)
- `/static/images/<filename>`
- `/test`
- `/minimal`
- `/privacy-policy`
- `/terms-of-service`

## Progress

✅ **Completed:**
- Created folder structure (routes/, services/, utils/)
- Extracted utility functions to utils/helpers.py
- Extracted security functions to utils/security.py
- Created email service module

🔄 **In Progress:**
- Creating Blueprint modules

⏳ **Remaining:**
- Extract all routes to Blueprints
- Update app.py to register Blueprints
- Test all endpoints
- Update imports throughout codebase

## Next Steps

1. Create auth.py Blueprint (example)
2. Create remaining Blueprint modules
3. Update app.py to register all Blueprints
4. Test all routes
5. Remove old route code from app.py
