# Refactoring Example: Auth Blueprint

## What We've Created

### ✅ Complete Structure
```
backend/
├── routes/
│   ├── __init__.py
│   └── auth.py (PARTIAL - example pattern)
├── services/
│   ├── __init__.py
│   └── email_service.py
└── utils/
    ├── __init__.py
    ├── helpers.py
    └── security.py
```

### ✅ Auth Blueprint Pattern (routes/auth.py)

**Key Features:**
1. **Factory Pattern** - `register_auth_routes()` function accepts dependencies
2. **Dependency Injection** - Supabase clients and config passed when registering
3. **Utility Functions** - Uses extracted helpers from `utils/helpers.py`
4. **Blueprint Routes** - All routes use `@auth_bp.route()` instead of `@app.route()`

**Routes Included (so far):**
- ✅ `/api/auth/login` - User login
- ✅ `/api/auth/check-admin` - Admin status check
- ✅ `/login` - Login page
- ✅ `/admin/login` - Admin login page

**Routes Still Needed:**
- ⏳ `/api/auth/signup` - User signup
- ⏳ `/api/auth/signup/email-only` - Email-only signup
- ⏳ `/api/auth/verify-email` - Email verification
- ⏳ `/api/auth/google/login` - Google OAuth initiation
- ⏳ `/api/auth/google/callback` - Google OAuth callback

## How It Works

### 1. Blueprint Creation
```python
auth_bp = Blueprint('auth', __name__)
```

### 2. Registration Function
```python
def register_auth_routes(app, supabase, supabase_admin, config):
    auth_bp.config = config
    auth_bp.supabase = supabase
    auth_bp.supabase_admin = supabase_admin
    app.register_blueprint(auth_bp)
```

### 3. Route Definition
```python
@auth_bp.route("/api/auth/login", methods=["POST", "OPTIONS"])
def auth_login():
    client = _get_supabase_client()  # Gets supabase_admin or supabase
    # ... route logic
```

### 4. In app.py (to be updated)
```python
from routes.auth import register_auth_routes

# After app creation and supabase initialization
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

1. ✅ **Complete auth.py** - Add remaining auth routes (signup, verify-email, Google OAuth)
2. ⏳ **Create other Blueprints** - admin.py, products.py, orders.py, videos.py, analytics.py
3. ⏳ **Update app.py** - Register all Blueprints, remove old route code
4. ⏳ **Test** - Verify all routes still work

## Benefits Demonstrated

- ✅ **Separation of Concerns** - Auth logic isolated in one file
- ✅ **Reusability** - Utility functions can be used across Blueprints
- ✅ **Testability** - Can test auth routes independently
- ✅ **Maintainability** - Easier to find and modify auth-related code
