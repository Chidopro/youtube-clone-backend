# Auth Blueprint - Complete Example ✅

## What We've Created

A **complete, working auth Blueprint** that demonstrates the refactoring pattern for all routes.

### File: `backend/routes/auth.py` (~900 lines)

**Routes Included:**
- ✅ `/api/auth/login` - User login with email/password
- ✅ `/api/auth/check-admin` - Admin status check
- ✅ `/api/auth/signup` - User signup
- ✅ `/api/auth/signup/email-only` - Email-only signup with verification
- ✅ `/api/auth/verify-email` - Email verification and password setup
- ✅ `/api/auth/google/login` - Google OAuth initiation
- ✅ `/api/auth/google/callback` - Google OAuth callback
- ✅ `/login` - Login page
- ✅ `/admin/login` - Admin login page

## Key Features

### 1. Factory Pattern
```python
def register_auth_routes(app, supabase, supabase_admin, config):
    """Register auth routes with dependencies"""
    auth_bp.config = config
    auth_bp.supabase = supabase
    auth_bp.supabase_admin = supabase_admin
    app.register_blueprint(auth_bp)
```

### 2. Dependency Injection
- Supabase clients passed when registering
- Configuration values passed as dictionary
- No circular imports

### 3. Helper Functions
- Uses `_get_supabase_client()` to get appropriate client
- Uses `_get_config()` to access configuration
- Uses utility functions from `utils/helpers.py`

### 4. Blueprint Routes
- All routes use `@auth_bp.route()` instead of `@app.route()`
- Routes are self-contained and testable

## How to Register in app.py

Add this to `app.py` after app creation and supabase initialization:

```python
# After creating app and initializing supabase
from routes.auth import register_auth_routes

# Register auth Blueprint
register_auth_routes(app, supabase, supabase_admin, {
    'GOOGLE_CLIENT_ID': GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': GOOGLE_CLIENT_SECRET,
    'GOOGLE_REDIRECT_URI': GOOGLE_REDIRECT_URI,
    'RESEND_API_KEY': RESEND_API_KEY,
    'RESEND_FROM': RESEND_FROM,
    'MAIL_TO': MAIL_TO
})
```

## Next Steps

1. ✅ **Auth Blueprint Complete** - All auth routes extracted
2. ⏳ **Create Other Blueprints** - Follow same pattern for:
   - `routes/admin.py`
   - `routes/products.py`
   - `routes/orders.py`
   - `routes/videos.py`
   - `routes/analytics.py`
3. ⏳ **Update app.py** - Register all Blueprints, remove old route code
4. ⏳ **Test** - Verify all routes work

## Pattern to Follow

For each Blueprint:
1. Create Blueprint: `bp = Blueprint('name', __name__)`
2. Create registration function: `register_name_routes(app, deps...)`
3. Store dependencies in Blueprint: `bp.dep = dep`
4. Define routes: `@bp.route(...)`
5. Register in app.py: `register_name_routes(app, ...)`
