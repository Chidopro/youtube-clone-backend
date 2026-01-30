from flask import Flask, request, jsonify, render_template, send_from_directory, redirect, url_for, session, make_response
import os
import logging

logger = logging.getLogger(__name__)
import time
from dotenv import load_dotenv
from flask_cors import CORS, cross_origin
import uuid
import requests
import stripe
from urllib.parse import urlencode, quote
import json
from supabase_storage import storage
from supabase import create_client, Client
# Twilio removed - using email notifications instead
from pathlib import Path
import sys
from functools import wraps
import bcrypt
import re

# Google OAuth imports
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import google.auth

# NEW: Import Printful integration
from printful_integration import ScreenMerchPrintfulIntegration

# NEW: Import video screenshot capture
from video_screenshot import screenshot_capture

# NEW: Import worker portal and secure processing APIs
try:
    from worker_portal_api import register_worker_portal_routes
    from secure_order_processing_api import register_secure_processing_routes
except ImportError as e:
    logger.warning(f"Could not import worker portal APIs: {e}")
    register_worker_portal_routes = None
    register_secure_processing_routes = None

# Import screenshot_capture module for standalone functions
import screenshot_capture as sc_module

# NEW: Import security manager
from security_config import security_manager, SECURITY_HEADERS, validate_file_upload

# Import Blueprint registration functions
from routes import (
    register_auth_routes,
    register_admin_routes,
    register_products_routes,
    register_orders_routes,
    register_videos_routes,
    register_analytics_routes
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Robust .env loading
env_paths = [
    Path(__file__).parent / '.env',
    Path(__file__).parent.parent / '.env',
    Path.cwd() / '.env'
]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        if os.getenv("FLASK_DEBUG"):
            print(f"Loaded .env from: {env_path}")
        break

# Try VITE_ prefixed variables first, then fall back to non-prefixed
supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
print("SUPABASE_URL:", "OK" if supabase_url else "MISSING")
print("SUPABASE_ANON_KEY:", "OK" if supabase_key else "MISSING")
print("SUPABASE_SERVICE_ROLE_KEY:", "OK" if supabase_service_key else "MISSING (some admin features won't work)")
if not supabase_url or not supabase_key:
    print("ERROR: Missing Supabase environment variables. Check your .env file location and content.", file=sys.stderr)
    sys.exit(1)

# Email notification setup (replacing Twilio SMS)
ADMIN_EMAIL = os.getenv("MAIL_TO") or os.getenv("ADMIN_EMAIL")
print(f"ADMIN_EMAIL: {'OK' if ADMIN_EMAIL else 'MISSING'}")

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI") or "https://screenmerch.fly.dev/api/auth/google/callback"
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

print(f"GOOGLE_CLIENT_ID: {'OK' if GOOGLE_CLIENT_ID else 'MISSING'}")
print(f"GOOGLE_CLIENT_SECRET: {'OK' if GOOGLE_CLIENT_SECRET else 'MISSING'}")
print(f"YOUTUBE_API_KEY: {'OK' if YOUTUBE_API_KEY else 'MISSING'}")

# Add session configuration (will be set after app creation)

def admin_required(f):
    """Decorator to require admin authentication - supports both session and email-based auth"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Allow OPTIONS requests to pass through for CORS preflight
        if request.method == "OPTIONS":
            return ("", 204)
        
        # Check session-based auth (for direct backend access)
        if session.get('admin_logged_in'):
            return f(*args, **kwargs)
        
        # Check email-based auth (for cross-origin API requests)
        user_email = request.headers.get('X-User-Email') or request.args.get('user_email')
        if user_email:
            try:
                user_email = user_email.strip().lower()
                # Use admin client to bypass RLS for checking admin status
                client = supabase_admin if supabase_admin else supabase
                # Check if user is admin in database - check both is_admin and admin_role fields
                result = client.table('users').select('is_admin, admin_role, role, email').eq('email', user_email).execute()
                if result.data and len(result.data) > 0:
                    user = result.data[0]
                    # Check for is_admin flag and admin_role (new system)
                    is_admin = user.get('is_admin', False)
                    admin_role = user.get('admin_role')
                    # Also check legacy role == 'admin' for backward compatibility
                    role = user.get('role')
                    
                    if is_admin or (role == 'admin') or (admin_role in ['master_admin', 'admin', 'order_processing_admin']):
                        logger.info(f"✅ Admin access granted via email: {user_email} (is_admin={is_admin}, admin_role={admin_role}, role={role})")
                        return f(*args, **kwargs)
                    
                    # Also check allowed emails list
                    allowed_emails = [
                        'chidopro@proton.me',
                        'alancraigdigital@gmail.com', 
                        'digitalavatartutorial@gmail.com',
                        'admin@screenmerch.com',
                        'filialsons@gmail.com',
                        'driveralan1@yahoo.com'  # Master admin email
                    ]
                    if user_email in allowed_emails:
                        logger.info(f"✅ Admin access granted via allowed email: {user_email}")
                        return f(*args, **kwargs)
            except Exception as e:
                logger.error(f"Error checking admin status for {user_email}: {str(e)}")
        
        # No valid auth found - return 401 instead of redirect for API endpoints
        if request.path.startswith('/api/'):
            response = jsonify({"error": "Unauthorized", "message": "Admin access required"})
            response.status_code = 401
            origin = request.headers.get('Origin', '*')
            return response
        
        # For non-API endpoints, redirect to login
        return redirect(url_for('admin_login'))
    return decorated_function

def ensure_print_quality_image(image_data):
    """
    Ensure image is at 300 DPI print quality before attaching to email.
    Automatically upgrades small images to print quality.
    
    Args:
        image_data: Base64 image data (data URL or base64 string)
    
    Returns:
        dict: {
            'success': bool,
            'image_data': str (upgraded base64 data URL),
            'dimensions': dict (width, height),
            'was_upgraded': bool
        }
    """
    try:
        # Check if it's a data URL
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            # Process for print quality
            result = sc_module.process_thumbnail_for_print(
                image_data,
                print_dpi=300,
                soft_corners=False,
                edge_feather=False
            )
            
            if result.get('success') and result.get('screenshot'):
                dimensions = result.get('dimensions', {})
                original_width = dimensions.get('width', 0)
                was_upgraded = original_width >= 2000  # Check if actually upgraded
                
                logger.info(f"✅ [EMAIL] Image processed for print quality: {dimensions.get('width')}x{dimensions.get('height')}, upgraded: {was_upgraded}")
                
                return {
                    'success': True,
                    'image_data': result['screenshot'],
                    'dimensions': dimensions,
                    'was_upgraded': was_upgraded
                }
            else:
                logger.warning(f"⚠️ [EMAIL] Print quality upgrade failed, using original image: {result.get('error', 'Unknown error')}")
                return {
                    'success': False,
                    'image_data': image_data,  # Return original
                    'dimensions': {},
                    'was_upgraded': False
                }
        else:
            # Not a data URL, return as-is (might be a URL)
            return {
                'success': True,
                'image_data': image_data,
                'dimensions': {},
                'was_upgraded': False
            }
    except Exception as e:
        logger.error(f"❌ [EMAIL] Error ensuring print quality: {str(e)}")
        # Return original image on error
        return {
            'success': False,
            'image_data': image_data,
            'dimensions': {},
            'was_upgraded': False
        }

def send_order_email(order_details):
    """Send order notification email instead of SMS"""
    if not ADMIN_EMAIL:
        print("Admin email not set. Email notification not sent.")
        return
    
    print(f"📧 Attempting to send order notification email...")
    print(f"  To: {ADMIN_EMAIL}")
    print(f"  Subject: New ScreenMerch Order")
    
    try:
        # Use your existing email service (Resend/Mailgun)
        if os.getenv("RESEND_API_KEY"):
            # Use Resend
            import requests
            headers = {
                'Authorization': f'Bearer {os.getenv("RESEND_API_KEY")}',
                'Content-Type': 'application/json'
            }
            
            data = {
                'from': os.getenv("RESEND_FROM", 'noreply@screenmerch.com'),
                'to': [ADMIN_EMAIL],
                'subject': '🛍️ New ScreenMerch Order Received!',
                'html': f"""
                <h2>New Order Notification</h2>
                <p>You have received a new order on ScreenMerch!</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                    {order_details.replace(chr(10), '<br>')}
                </div>
                <p><small>This is an automated notification from ScreenMerch</small></p>
                """
            }
            
            response = requests.post('https://api.resend.com/emails', headers=headers, json=data)
            
            if response.status_code == 200:
                print(f"✅ Order notification email sent successfully!")
                print(f"  Email ID: {response.json().get('id', 'N/A')}")
            else:
                print(f"❌ Error sending email: {response.status_code} - {response.text}")
                
        else:
            print("❌ No email service configured (RESEND_API_KEY not found)")
            
    except Exception as e:
        print(f"❌ Error sending order notification email:")
        print(f"  Error: {str(e)}")

# Customer SMS function removed - using email notifications instead

app = Flask(__name__, 
           template_folder='templates',
           static_folder='static')
# --- Preflight handler (fixes OPTIONS 500 / CORS preflight failures) ---
@app.before_request
def _handle_preflight():
    if request.method == "OPTIONS":
        return ("", 204)

# Configure session secret key - REQUIRED for security
secret_key = os.getenv("FLASK_SECRET_KEY")
if not secret_key:
    raise ValueError("FLASK_SECRET_KEY environment variable is required. Set it in your environment or .env file.")
app.secret_key = secret_key

# Session / cookie settings for cross-device friendly auth
from datetime import timedelta

def get_cookie_domain():
    host = request.host.lower()
    if "screenmerch.com" in host:
        return ".screenmerch.com"
    elif "localhost" in host:
        return None
    else:
        return ".screenmerch.fly.dev"

def _allow_origin(resp):
    """
    DEPRECATED: Flask-CORS now handles all CORS automatically.
    This function is kept for backward compatibility but does nothing.
    Flask-CORS is configured globally with cors_origin_validator function.
    """
    # Flask-CORS handles all CORS headers automatically - no need to add them here
    # This prevents duplicate headers that cause "multiple values" errors
    return resp


app.config.update(
    SESSION_COOKIE_NAME="sm_session",
    SESSION_COOKIE_DOMAIN=None,     # overridden dynamically if needed
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
)

# Accept routes with or without trailing slashes
app.url_map.strict_slashes = False

# In-memory session token -> user_id for /api/users/me validation (single instance; cleared on restart)
app.config.setdefault("session_token_store", {})

# Rate limiting for auth and sensitive endpoints
try:
    from utils.limiter import limiter
    limiter.init_app(app)
except Exception as limiter_err:
    logger.warning(f"Rate limiter not loaded: {limiter_err}")
    limiter = None

def _data_from_request():
    """
    Robustly read request data for both:
    - JSON (fetch / curl / axios)
    - form-data (HTML forms)
    - raw JSON strings (when headers/proxies are weird)
    """
    try:
        logger.info(
            f"🧾 [DATA] method={request.method} content_type={request.content_type} "
            f"content_length={request.content_length} is_json={request.is_json}"
        )

        # 1) Try JSON regardless of request.is_json
        data = request.get_json(force=True, silent=True)
        if isinstance(data, dict):
            logger.info(f"✅ [DATA] Parsed JSON keys: {list(data.keys())}")
            return data

        # 2) Try form body
        if request.form:
            form_data = request.form.to_dict(flat=True)
            logger.info(f"✅ [DATA] Parsed FORM keys: {list(form_data.keys())}")
            return form_data

        # 3) Try raw body as JSON
        raw = (request.get_data(cache=False, as_text=True) or "").strip()
        if raw:
            logger.info(f"🧾 [DATA] Raw body startswith: {raw[:80]}")
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    logger.info(f"✅ [DATA] Parsed RAW JSON keys: {list(parsed.keys())}")
                    return parsed
            except Exception as e:
                logger.warning(f"⚠️ [DATA] Raw body JSON parse failed: {e}")

        logger.warning("⚠️ [DATA] No JSON/form/raw dict parsed; returning {}")
        return {}

    except Exception as e:
        logger.exception(f"❌ [DATA] Exception parsing request: {e}")
        return {}

def _return_url():
    return request.values.get("return_url") or "https://screenmerch.com/"

def _cookie_domain():
    host = (request.host or "").lower()
    if host.endswith("screenmerch.com"):
        return "screenmerch.com"
    if host.endswith("screenmerch.fly.dev"):
        return "screenmerch.fly.dev"
    return None

def read_json():
    """Robust JSON reader with detailed diagnostics for proxied requests."""
    ct = (request.headers.get("Content-Type") or "").lower()
    raw = request.get_data(cache=False, as_text=True) or ""
    
    # Short raw log
    logger.info(f"[REQ] {request.path} CT={ct} len={len(raw)} raw[0:200]={raw[:200]!r}")

    data = None
    # 1) Normal case - application/json
    if "application/json" in ct:
        data = request.get_json(force=True, silent=True)
    # 2) Some proxies send text/plain or missing CT
    if data is None and raw:
        try:
            data = json.loads(raw)
        except Exception as e:
            logger.warning(f"[PARSE] JSON.loads failed: {str(e)}")
            data = None
    # 3) Fallback: form-encoded (unlikely but safe)
    if data is None and request.form:
        try:
            data = {k: json.loads(v) if v and v.strip().startswith(("{", "[")) else v
                    for k, v in request.form.items()}
        except Exception:
            data = dict(request.form)

    if not isinstance(data, dict):
        data = {}

    # Detailed keys snapshot
    logger.info(f"[PARSED] keys={list(data.keys())} shipping_address={data.get('shipping_address')}")
    return data

def require_shipping_address(payload):
    """Validate and extract shipping address from payload."""
    addr = payload.get("shipping_address") or {}
    zip_code = (addr.get("zip") or addr.get("postal_code") or "").strip()
    country = (addr.get("country_code") or addr.get("country") or "US").strip()
    if not zip_code:
        return False, "ZIP / Postal Code is required."
    if not country:
        country = "US"  # Default to US
    return True, {"zip": zip_code, "country_code": country}

# Helper function to parse ZIP code from shipping_address dict
def _parse_zip(shipping_address: dict) -> str:
    """Parse ZIP code from shipping_address dict, handling multiple field names and types."""
    if not shipping_address:
        return ""
    raw = (
        shipping_address.get("zip") or
        shipping_address.get("postal_code") or
        shipping_address.get("postcode") or
        shipping_address.get("postalCode") or
        shipping_address.get("ZIP") or
        ""
    )
    try:
        return str(raw).strip()
    except Exception:
        return ""

# Template filter for formatting timestamps
@app.template_filter('format_timestamp')
def format_timestamp(timestamp):
    """Convert timestamp to MM:SS format"""
    try:
        # Debug logging
        logger.info(f"🔍 Formatting timestamp: {timestamp} (type: {type(timestamp)})")
        
        if isinstance(timestamp, str):
            # Handle ISO timestamp format
            if 'T' in timestamp:
                from datetime import datetime
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                total_seconds = dt.timestamp()
            else:
                # Try to convert string to float
                total_seconds = float(timestamp)
        else:
            total_seconds = float(timestamp)
        
        # Handle very large timestamps (might be milliseconds or microseconds)
        if total_seconds > 86400:  # More than 24 hours, likely wrong format
            if total_seconds > 1000000000:  # Looks like milliseconds since epoch
                total_seconds = total_seconds / 1000
            elif total_seconds > 1000000000000:  # Looks like microseconds since epoch
                total_seconds = total_seconds / 1000000
        
        # If still too large, it might be a timestamp in seconds but for a very long video
        # Cap it at 24 hours (86400 seconds) for display purposes
        if total_seconds > 86400:
            total_seconds = total_seconds % 86400  # Get the remainder to show reasonable time
        
        minutes = int(total_seconds // 60)
        seconds = int(total_seconds % 60)
        result = f"{minutes:02d}:{seconds:02d}"
        logger.info(f"✅ Formatted timestamp: {timestamp} -> {result}")
        return result
    except (ValueError, TypeError) as e:
        logger.error(f"❌ Error formatting timestamp {timestamp}: {str(e)}")
        return str(timestamp)

# Add custom Jinja2 filters
@app.template_filter('get_product_price')
def get_product_price(product_name):
    """Get the price of a product by name"""
    for product in PRODUCTS:
        if product['name'] == product_name:
            return product['price']
    return 0.0

# Add this function after the existing get_product_price function (around line 125)
@app.template_filter('get_product_price_with_size')
def get_product_price_with_size(product_name, size=None):
    """Get product price with size adjustment"""
    product = next((p for p in PRODUCTS if p["name"] == product_name), None)
    if not product:
        return 0.0
    
    base_price = product["price"]
    
    # Size pricing adjustments
    size_adjustments = {
        "XS": 0,      # No extra charge
        "S": 0,       # No extra charge  
        "M": 0,       # No extra charge
        "L": 0,       # No extra charge
        "XL": 2,      # +$2
        "XXL": 3,     # +$3
        "XXXL": 4,    # +$4
        "XXXXL": 5,   # +$5
        "XXXXXL": 8   # +$8 (to reach $32.99 from $24.99 base)
    }
    
    if size and size in size_adjustments:
        return base_price + size_adjustments[size]
    
    return base_price

@app.template_filter('get_product_price_range')
def get_product_price_range(product_name):
    """Get product price range (min to max)"""
    product = next((p for p in PRODUCTS if p["name"] == product_name), None)
    if not product:
        return "$0.00"
    
    base_price = product["price"]
    min_price = base_price  # XS, S, M, L have no extra charge
    max_price = base_price + 6  # XXXXXL has +$6
    
    if min_price == max_price:
        return f"${min_price:.2f}"
    else:
        return f"${min_price:.2f}-${max_price:.2f}"

# Configure CORS for production - Netlify frontend to Fly.io backend
# Use a function to handle subdomains dynamically
# Configure CORS for production – screenmerch.com + all subdomains
ALLOWED_ORIGINS = [
    "https://screenmerch.com",
    "https://www.screenmerch.com",

    # Allow any subdomain like https://testcreator.screenmerch.com
    "https://testcreator.screenmerch.com",

    # Fly.io backend (optional but safe)
    "https://screenmerch.fly.dev",

    # Local development
    "http://localhost:3000",
    "http://localhost:5173",
]

CORS(
    app,
    resources={r"/api/*": {"origins": ALLOWED_ORIGINS}},
    supports_credentials=True,
    always_send=True,
)

# NOTE:
# CORS is handled via Flask-CORS using the explicit ALLOWED_ORIGINS list above.
# Subdomains must be listed explicitly or added here.

# Security middleware
@app.before_request
def security_check():
    """Security checks before each request"""
    # Log all API requests for debugging
    if request.path.startswith('/api/'):
        logger.info(f"🔵 [BEFORE_REQUEST] {request.method} {request.path} from {request.headers.get('Origin', 'unknown')}")
    
    # Get client IP
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    
    # Rate limiting - temporarily disabled for debugging
    # allowed, message = security_manager.check_rate_limit(client_ip)
    # if not allowed:
    #     return jsonify({"error": message}), 429
    
    # Suspicious request detection - temporarily disabled for debugging
    # if security_manager.is_suspicious_request(request):
    #     logger.warning(f"Suspicious request blocked from IP: {client_ip}")
    #     return jsonify({"error": "Request blocked for security reasons"}), 403

@app.after_request
def add_security_headers(response):
    """Add security headers to all responses"""
    for header, value in SECURITY_HEADERS.items():
        response.headers[header] = value
    
    # Don't set CORS headers here - Flask-CORS handles all CORS automatically
    
    return response

# Initialize Supabase client for database operations
supabase: Client = create_client(supabase_url, supabase_key)

# Create service role client for admin operations (bypasses RLS)
supabase_admin: Client = None
if supabase_service_key:
    supabase_admin = create_client(supabase_url, supabase_service_key)
    print("[OK] Service role client initialized")
else:
    print("[WARNING] Service role key not found - some admin operations may not work")

# NEW: Initialize Printful integration
printful_integration = ScreenMerchPrintfulIntegration()

# Keep in-memory storage as fallback, but prioritize database
product_data_store = {}
order_store = {}  # In-memory store for demo; use a database for production

# --- Resend Email Configuration ---
# These are loaded from your .env file
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM = os.getenv("RESEND_FROM", "onboarding@resend.dev")
MAIL_TO = os.getenv("MAIL_TO") # The email address that will receive the orders

# Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

def ensure_stripe_test_mode():
    """
    Reload Stripe API key from environment and validate it's in test mode.
    This ensures we always use the latest key and are in test mode.
    """
    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    if not stripe_key:
        raise ValueError("STRIPE_SECRET_KEY environment variable is not set")
    
    # Validate that we're using test mode key
    if not stripe_key.startswith("sk_test_"):
        logger.warning(f"⚠️ WARNING: Stripe key does not start with 'sk_test_' - this may be a LIVE key!")
        logger.warning(f"⚠️ Key preview: {stripe_key[:20]}...{stripe_key[-4:] if len(stripe_key) > 24 else '***'}")
        logger.warning(f"⚠️ If you want test mode, ensure your STRIPE_SECRET_KEY starts with 'sk_test_'")
    else:
        logger.info(f"✅ Stripe test mode confirmed - key starts with 'sk_test_'")
    
    # Set the key
    stripe.api_key = stripe_key
    
    # Log key info for debugging (first 20 chars and last 4 chars)
    key_preview = f"{stripe_key[:20]}...{stripe_key[-4:]}" if len(stripe_key) > 24 else "***"
    logger.info(f"🔑 Using Stripe API key: {key_preview} (length: {len(stripe_key)})")
    
    return stripe_key

# NEW: Printful API Key (optional for now)
PRINTFUL_API_KEY = os.getenv("PRINTFUL_API_KEY")

# ============================================================================
# Register Flask Blueprints
# ============================================================================
# Prepare configuration dictionary for Blueprints
config = {
    'STRIPE_SECRET_KEY': os.getenv("STRIPE_SECRET_KEY"),
    'STRIPE_WEBHOOK_SECRET': STRIPE_WEBHOOK_SECRET,
    'RESEND_API_KEY': RESEND_API_KEY,
    'RESEND_FROM': RESEND_FROM,
    'MAIL_TO': MAIL_TO,
    'PRINTFUL_API_KEY': PRINTFUL_API_KEY,
    'GOOGLE_CLIENT_ID': GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': GOOGLE_CLIENT_SECRET,
    'GOOGLE_REDIRECT_URI': GOOGLE_REDIRECT_URI,
    'YOUTUBE_API_KEY': YOUTUBE_API_KEY
}

# Register Blueprints that don't depend on PRODUCTS
print("[INFO] Registering Flask Blueprints...")
try:
    # Auth Blueprint
    register_auth_routes(app, supabase, supabase_admin, config)
    print("  [OK] Auth Blueprint registered")
    
    # Admin Blueprint
    register_admin_routes(app, supabase, supabase_admin, order_store)
    print("  [OK] Admin Blueprint registered")
    
    # Videos Blueprint
    register_videos_routes(app, supabase, screenshot_capture, sc_module)
    print("  [OK] Videos Blueprint registered")
    
    # Analytics Blueprint
    register_analytics_routes(app, supabase, supabase_admin, order_store)
    print("  [OK] Analytics Blueprint registered")
    
    # Products and Orders Blueprints will be registered after PRODUCTS is defined (see below)
    print("  [INFO] Products and Orders Blueprints will be registered after PRODUCTS definition")
    
    print("[OK] Initial Blueprints registered successfully!")
except Exception as e:
    print(f"[ERROR] Error registering Blueprints: {str(e)}")
    import traceback
    traceback.print_exc()
    # Don't exit - allow app to continue with old routes as fallback

@app.route("/api/ping")
def ping():
    return {"message": "pong"}

@app.route("/api/product/browse", methods=["GET", "OPTIONS"])
def get_browse_api():
    """API endpoint to get browse data for frontend"""
    if request.method == "OPTIONS":
        return ("", 204)
    
    try:
        # Get category parameter
        category = request.args.get('category', 'all')
        user_agent = request.headers.get('User-Agent', '')
        is_mobile = 'Mobile' in user_agent or 'Android' in user_agent or 'iPhone' in user_agent
        
        logger.info(f"📂 API Browse request - Category: {category}")
        logger.info(f"📱 Mobile detection: {is_mobile}")
        logger.info(f"📱 User-Agent: {user_agent}")
        
        # Filter products by category
        filtered_products = filter_products_by_category(category)
        
        # Ensure all products have a description field (even if empty)
        for product in filtered_products:
            if 'description' not in product:
                product['description'] = ""
        
        # Log product details for mobile debugging
        if is_mobile:
            logger.info(f"📱 Mobile request - Found {len(filtered_products)} products for category '{category}'")
            if filtered_products:
                first_product = filtered_products[0]
                logger.info(f"📱 First product: {first_product.get('name', 'Unknown')}")
                logger.info(f"📱 First product main_image: {first_product.get('main_image', 'None')}")
                logger.info(f"📱 First product preview_image: {first_product.get('preview_image', 'None')}")
        
        # Get screenshots from localStorage data (if available)
        # For browse mode, we'll use fallback screenshots
        screenshots = []
        thumbnail_url = ""
        
        # Try to get screenshots from the request or use fallback
        try:
            # This would come from the frontend's localStorage data
            # For now, we'll return empty arrays as the frontend will use fallback
            screenshots = []
            thumbnail_url = ""
        except:
            screenshots = []
            thumbnail_url = ""
        
        # Return browse data with both product info and products list
        response_data = {
            "success": True,
            "product": {
                "thumbnail_url": thumbnail_url,
                "screenshots": screenshots
            },
            "products": filtered_products,
            "category": category,
            "timestamp": int(time.time())
        }
        
        # Log response for mobile debugging
        if is_mobile:
            logger.info(f"📱 Sending response to mobile - {len(filtered_products)} products")
            logger.info(f"📱 Response success: {response_data['success']}")
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"❌ Browse API error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "products": [],
            "category": category or "all"
        }), 500

@app.route("/api/product/<product_id>", methods=["GET", "OPTIONS"])
def get_product_api(product_id):
    """API endpoint to get product data for frontend"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        return response
    
    try:
        # Get category parameter
        category = request.args.get('category', 'all')
        logger.info(f"📂 API Product request - ID: {product_id}, Category: {category}")
        
        # Filter products by category
        filtered_products = filter_products_by_category(category)
        
        # Try to get product from database
        try:
            result = supabase.table('products').select('*').eq('product_id', product_id).execute()
            
            if result.data:
                product_data = result.data[0]
                screenshots = []
                if product_data.get('screenshots_urls'):
                    try:
                        screenshots = json.loads(product_data.get('screenshots_urls'))
                    except:
                        screenshots = []
                
                response_data = {
                    "success": True,
                    "product": {
                        "product_id": product_id,
                        "thumbnail_url": product_data.get('thumbnail_url'),
                        "video_title": product_data.get('video_title', 'Unknown Video'),
                        "creator_name": product_data.get('creator_name', 'Unknown Creator'),
                        "video_url": product_data.get('video_url', 'Not provided'),
                        "screenshots": screenshots
                    },
                    "products": filtered_products,
                    "category": category
                }
                
                response = jsonify(response_data)
                return response
            else:
                # Product not found in database, return products list anyway
                response_data = {
                    "success": True,
                    "product": {
                        "product_id": product_id,
                        "thumbnail_url": "",
                        "video_title": "Unknown Video",
                        "creator_name": "Unknown Creator",
                        "video_url": "Not provided",
                        "screenshots": []
                    },
                    "products": filtered_products,
                    "category": category
                }
                response = jsonify(response_data)
                return response
                
        except Exception as db_error:
            logger.error(f"Database error: {str(db_error)}")
            # Return products list even if database fails
            response_data = {
                "success": True,
                "product": {
                    "product_id": product_id,
                    "thumbnail_url": "",
                    "video_title": "Unknown Video",
                    "creator_name": "Unknown Creator",
                    "video_url": "Not provided",
                    "screenshots": []
                },
                "products": filtered_products,
                "category": category
            }
            response = jsonify(response_data)
            response.headers.add('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            response.headers.add('Pragma', 'no-cache')
            response.headers.add('Expires', '0')
            return response
            
    except Exception as e:
        logger.error(f"Error in get_product_api: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return response, 500

@app.route("/api/test-order-email", methods=["POST"])
def test_order_email():
    """Test endpoint to send a sample order confirmation email"""
    try:
        # Create a sample order data
        sample_order = {
            "order_id": "test-order-123",
            "cart": [
                {
                    "product": "Cropped Hoodie",
                    "variants": {"color": "Black", "size": "M"},
                    "note": "Test order",
                    "img": "https://example.com/test-image.jpg"
                }
            ],
            "customer_phone": "+1234567890"
        }
        
        # Format the email
        html_body = f"<h1>Test Order Confirmation #{sample_order['order_id']}</h1>"
        html_body += f"<p><strong>Customer Phone:</strong> {sample_order['customer_phone']}</p>"
        
        for item in sample_order['cart']:
            html_body += f"""
                <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                    <h2>{item.get('product', 'N/A')}</h2>
                    <p><strong>Color:</strong> {item.get('variants', {}).get('color', 'N/A')}</p>
                    <p><strong>Size:</strong> {item.get('variants', {}).get('size', 'N/A')}</p>
                    <p><strong>Note:</strong> {item.get('note', 'None')}</p>
                </div>
            """
        
        # Send email using Resend
        email_data = {
            "from": RESEND_FROM,
            "to": [MAIL_TO],
            "subject": f"Test Order Confirmation #{sample_order['order_id']}",
            "html": html_body
        }
        
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json"
            },
            json=email_data
        )
        
        if response.status_code == 200:
            logger.info(f"Test order email sent successfully via Resend")
            return jsonify({"success": True, "message": "Test order email sent successfully"})
        else:
            logger.error(f"Resend API error: {response.text}")
            return jsonify({"success": False, "error": f"Failed to send email: {response.text}"}), 500
            
    except Exception as e:
        logger.error(f"Error in test_order_email: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

PRODUCTS = [
    # Products with both COLOR and SIZE options
    {
        "name": "Unisex T-Shirt",
        "price": 19.59,
        "filename": "guidontee.png",
        "main_image": "guidontee.png",
        "preview_image": "mensunisextshirtpreview.png",
        "description": "The Unisex Staple T-Shirt feels soft and light with just the right amount of stretch. It's comfortable and flattering for all. We can't compliment this shirt enough–it's one of our crowd favorites, and it's sure to be your next favorite too! Solid colors are 100% Airlume combed and ring-spun cotton. Ash color is 99% combed and ring-spun cotton, 1% polyester. Heather colors are 52% combed and ring-spun cotton, 48% polyester. Athletic and Black Heather are 90% combed and ring-spun cotton, 10% polyester. Heather Prism colors are 99% combed and ring-spun cotton, 1% polyester. Fabric weight: 4.2 oz./yd.² (142 g/m²). Pre-shrunk fabric. 30 singles. Side-seamed construction. Tear-away label. Shoulder-to-shoulder taping. Blank product sourced from Nicaragua, Mexico, Honduras, or the US. Disclaimer: The fabric is slightly sheer and may appear see-through, especially in lighter colors or under certain lighting conditions. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "White", "Navy", "Black Heather", "Athletic Heather", "Dark Grey Heather", "Red", "Kelly", "Heather Midnight Navy", "True Royal", "Asphalt", "Heather True Royal", "Heather Prism Lilac", "Soft Cream", "Heather Prism Ice Blue", "Mauve", "Forest", "Heather Forest", "Olive", "Heather Deep Teal"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]},
        "size_pricing": {
            "XS": 0,      # No extra charge
            "S": 0,       # No extra charge  
            "M": 0,       # No extra charge
            "L": 0,       # No extra charge
            "XL": 0,      # No extra charge
            "XXL": 1.65,  # +$1.65 = $21.24
            "XXXL": 3.30, # +$3.30 = $22.89
            "XXXXL": 4.95, # +$4.95 = $24.54
            "XXXXXL": 6.60 # +$6.60 = $26.19
        }
    },
    {
        "name": "Mens Fitted T-Shirt",
        "price": 22.11,
        "filename": "mensfittedtshirt.png",
        "main_image": "mensfittedtshirt.png",
        "preview_image": "mensfittedtshirtpreview.png",
        "description": "The Next Level 3600 Men's Fitted T-Shirt combines softness with a modern, tailored fit that holds its shape wash after wash. Its lightweight feel makes it a natural everyday favorite, while the tear-away tag offers room for custom branding. 100% ring-spun combed cotton. Heather Grey is 90% cotton, 10% polyester. Fabric weight: 4.3 oz/y² (145.8 g/m²). 32 singles. Pre-shrunk. Tear-away tag. Blank product sourced from Honduras, Nicaragua, Mexico, or Cambodia. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "White", "Heather Grey", "Royal Blue", "Midnight Navy", "Desert Pink"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"]},
        "size_pricing": {
            "XS": 0,      # No extra charge
            "S": 0,       # No extra charge  
            "M": 0,       # No extra charge
            "L": 0,       # No extra charge
            "XL": 0,      # No extra charge
            "XXL": 1.65,  # +$1.65 = $23.76
            "XXXL": 3.30, # +$3.30 = $25.41
            "XXXXL": 4.00 # Keep existing for 4XL
        }
    },
    {
        "name": "Unisex Oversized T-Shirt",
        "price": 24.02,
        "filename": "unisexoversizedtshirt.png",
        "main_image": "unisexoversizedtshirt.png",
        "preview_image": "mensunisexoversizedtshirtpreview.png",
        "description": "This oversized 100% cotton tee is made for streetwear drops and everyday fits. The heavyweight fabric gives it structure and a premium feel, while the relaxed, roomy cut makes it perfect for layering or wearing on its own. Add bold prints or clean embroidery—this tee is ready to carry your brand's style. 100% ring-spun cotton. Fabric weight: 6.5 oz./yd.² (220.4 g/m²). 18 singles yarn. Oversized fit. Tear-away label. Washed-color options for a trendy vintage look. Streetwear-inspired style. Blank product sourced from Nicaragua. This product is made on demand. No minimums.",
        "options": {"color": ["Washed Black", "Washed Maroon", "Washed Charcoal", "Khaki", "Light Washed Denim", "Vintage White"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]},
        "size_pricing": {
            "XS": 0,      # No extra charge
            "S": 0,       # No extra charge  
            "M": 0,       # No extra charge
            "L": 0,       # No extra charge
            "XL": 0,      # No extra charge
            "XXL": 1.65,  # +$1.65 = $25.67
            "XXXL": 3.30  # +$3.30 = $27.32
        }
    },
    {
        "name": "Men's Tank Top",
        "price": 21.87,
        "filename": "random.png",
        "main_image": "random.png",
        "preview_image": "menstanktoppreview.png",
        "description": "The Men's Staple Tank Top is made of high-quality durable materials. Wear it on a sunny day out or offer it to your customers on your online store. 100% combed and ring-spun cotton. Tri-blends are 50% polyester, 25% combed, 25% ring-spun cotton, and rayon. Athletic Heather is 90% airlume combed and ring-spun cotton, 10% polyester. All the other Heather colors are 52% airlume combed and ring-spun cotton, 48% polyester. Fabric weight: 4.2 oz/yd² (142.40 g/m²), triblends: 3.8 oz/yd² (90.07 g/m²). 30 singles. Regular fit. Side-seamed construction. Blank product sourced from Nicaragua, Honduras, or the US. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "White", "Navy", "True Royal", "Athletic Heather", "Red", "Oatmeal Triblend"], "size": ["XS", "S", "M", "L", "XL", "XXL"]},
        "size_pricing": {
            "XS": 0,      # No extra charge
            "S": 0,       # No extra charge  
            "M": 0,       # No extra charge
            "L": 0,       # No extra charge
            "XL": 0,      # No extra charge
            "XXL": 1.65   # +$1.65 = $23.52
        }
    },
    {
        "name": "Men's Fitted Long Sleeve",
        "price": 26.49,
        "filename": "mensfittedlongsleeve.png",
        "main_image": "mensfittedlongsleeve.png",
        "preview_image": "mensfittedlongsleeveshirtpreview.png",
        "description": "This super-soft long-sleeved crew shirt will be a classic piece in your wardrobe. There are multiple branding options for this 100% cotton shirt, so get your designs ready and customize it to your liking! 100% combed ring-spun cotton. Fabric weight: 4.3 oz/yd² (149.2 g/m²). 32 singles. Pre-shrunk fabric. Set-in 1 × 1 baby rib collar. Tear-away label. Blank product sourced from Nicaragua or Cambodia. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Heavy Metal", "White"], "size": ["S", "M", "L", "XL", "XXL"]},
        "size_pricing": {
            "S": 0,       # No extra charge  
            "M": 0,       # No extra charge
            "L": 0,       # No extra charge
            "XL": 0,      # No extra charge
            "XXL": 1.65   # +$1.65 = $28.14
        }
    },
    {
        "name": "Unisex Hoodie",
        "price": 32.99,
        "filename": "tested.png",
        "main_image": "tested.png",
        "preview_image": "mensunisexhoodiepreview.png",
        "description": "Classic unisex hoodie with a front pouch pocket and matching flat drawstrings. The 100% cotton exterior makes this hoodie soft to the touch. What's more, if you go with custom prints, you can personalize the hoodie to your heart's content and maximize your branding thanks to the custom inside label. Use it to showcase your logo, strengthen customer loyalty, and boost your brand's visibility on the market. 65% ring-spun cotton, 35% polyester. Charcoal Heather is 60% ring-spun cotton, 40% polyester. Carbon Grey is 55% ring-spun cotton, 45% polyester. 100% cotton face. Fabric weight: 8.5 oz./yd.² (288.2 g/m²). Front pouch pocket. Self-fabric patch on the back. Matching flat drawstrings. 3-panel hood. Tear-away tag. Blank product sourced from Pakistan. Disclaimer: Please be aware that, for legal reasons, this product comes with a manufacturer's side tag attached. The tag is discreet and won't compromise your design's integrity. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Navy Blazer", "Carbon Grey", "White", "Maroon", "Charcoal Heather", "Vintage Black", "Forest Green", "Military Green", "Team Red", "Dusty Rose", "Sky Blue", "Purple", "Team Royal"], "size": ["S", "M", "L", "XL", "XXL", "XXXL"]},
        "size_pricing": {
            "S": 0,       # Base price $32.99
            "M": 0,       # Base price $32.99
            "L": 0,       # Base price $32.99
            "XL": 0,      # Base price $32.99
            "XXL": 1.65,  # +$1.65 = $34.64
            "XXXL": 3.30  # +$3.30 = $36.29
        }
    },
    {
        "name": "Cropped Hoodie",
        "price": 38.27,
        "filename": "croppedhoodie.png",
        "main_image": "croppedhoodie.png",
        "preview_image": "womenscroppedhoodiepreview.png",
        "description": "Comfort and style rolled into one—that's the easiest way to describe this fashion-forward hoodie. It serves as a great statement piece in any wardrobe, and with its trendy raw hem and matching drawstrings, the hoodie is bound to become a true favorite on your online store. 52% airlume combed and ring-spun cotton, 48% poly fleece. Fabric weight: 6.5 oz/yd² (220.39 g/m²). Dyed-to-match drawstrings. Dropped shoulder cut. Cropped body with a raw hem. Blank product sourced from Mexico, Nicaragua or the United States. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Military Green", "Storm", "Peach"], "size": ["S", "M", "L", "XL", "XXL"]},
        "size_pricing": {
            "S": 0,       # Base price $38.27
            "M": 0,       # Base price $38.27
            "L": 0,       # Base price $38.27
            "XL": 0,      # Base price $38.27
            "XXL": 1.65   # +$1.65 = $39.92
        }
    },
    {
        "name": "Unisex Champion Hoodie",
        "price": 39.75,
        "filename": "hoodiechampion.png",
        "main_image": "hoodiechampion.png",
        "preview_image": "mensunisexchampionhoodiepreview.png",
        "description": "A classic hoodie that combines Champion's signature quality with everyday comfort. The cotton-poly blend makes it soft and durable, while the two-ply hood and snug rib-knit cuffs lock in warmth. Champion's double Dry technology keeps the wearer dry on the move, and the kangaroo pocket keeps essentials handy. Customize it with your design, order one for yourself, or sell it online. 50% cotton, 50% polyester. Light Steel color is 50% cotton, 40% polyester, and 10% black polyester. Fabric weight: 9 oz./yd.² (305 g/m²). Regular fit. Set-in sleeves. Two-ply hood. Dyed-to-match drawcord. Kangaroo pocket. Heavy rib-knit waistband and cuffs. Embroidered C logo on the left cuff. Blank product sourced from Honduras and Guatemala. Disclaimer: Size up for a looser fit.",
        "options": {"color": ["Black", "Light Steel"], "size": ["S", "M", "L", "XL", "XXL", "XXXL"]},
        "size_pricing": {
            "S": 0,       # Base price $39.75
            "M": 0,       # Base price $39.75
            "L": 0,       # Base price $39.75
            "XL": 0,      # Base price $39.75
            "XXL": 1.65,  # +$1.65 = $41.40
            "XXXL": 3.30  # +$3.30 = $43.05
        }
    },
    {
        "name": "Women's Ribbed Neck",
        "price": 23.13,
        "filename": "womensribbedneck.png",
        "main_image": "womensribbedneck.png",
        "preview_image": "womensribbedneckpreview.png",
        "description": "This classic women's t-shirt is designed to flatter every body shape. The 100% organic cotton is soft on the skin, and the ribbed collar adds a polished look. Add your design, order this tee for yourself, or sell it online. 100% organic combed ring-spun cotton. Fabric weight: 5.3 oz./yd.² (180 g/m²). Regular fit. Set-in sleeves. 1 × 1 rib at collar. Double-needle topstitch on the sleeves and bottom hems. Self-fabric neck tape on the inside of the back. The fabric of this product holds certifications for its organic cotton content under GOTS (Global Organic Textile Standard) and OCS (Organic Content Standard). Blank product sourced from Bangladesh. Disclaimer: Note that we show the US sizes for this product. The sizes correspond to a bigger size in the European market, so customers from that region should order a size down. To learn more about eco-friendly certificates, check out this FAQ article! This product is made on demand. No minimums.",
        "options": {"color": ["Black", "French Navy", "Heather Grey", "White", "Dark Heather Grey", "Burgundy", "India Ink Grey", "Anthracite", "Red", "Stargazer", "Khaki", "Desert Dust", "Fraiche Peche", "Cotton Pink", "Lavender"], "size": ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]},
         "size_pricing": {
            "S": 0,       # Base price $23.13
            "M": 0,       # Base price $23.13
            "L": 0,       # Base price $23.13
            "XL": 0,      # Base price $23.13
            "XXL": 1.65,  # +$1.65 = $24.78
            "XXXL": 3.30, # +$3.30 = $26.43
            "XXXXL": 4.95, # +$4.95 = $28.08
            "XXXXXL": 6.60 # +$6.60 = $29.73
        }
    },
    {
        "name": "Women's Shirt",
        "price": 20.99,
        "filename": "womensshirt.png",
        "main_image": "womensshirt.png",
        "preview_image": "womenshirtpreview.png",
        "description": "The perfect women's t-shirt is hard to find, but this Bella + Canvas relaxed tee just might be it. Its soft and smooth fabric, as well as the relaxed fit will appeal to anyone looking for a comfy everyday t-shirt, or an addition to their business casual wardrobe. Add your design and turn this shirt into something truly special. 100% combed and ring-spun cotton. Heather Prism Lilac & Heather Prism Natural are 99% combed and ring-spun cotton, 1% polyester. Athletic Heather is 90% combed and ring-spun cotton, 10% polyester. Other Heather colors are 52% combed and ring-spun cotton, 48% polyester. Fabric weight: 4.2 oz/y² (142 g/m²). Relaxed fit. Pre-shrunk fabric. Side-seamed construction. Crew neck. Blank product sourced from Nicaragua, Honduras, or the US. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "White", "Dark Grey Heather", "Pink", "Navy", "Heather Mauve", "Heather Red", "Leaf", "Heather Blue Lagoon", "Athletic Heather", "Heather Stone"], "size": ["S", "M", "L", "XL", "XXL", "XXXL"]},
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 1.65,  # +$1.65 = $22.64
            "XXXL": 3.30  # +$3.30 = $24.29
        } 
    },
    {
        "name": "Unisex Heavyweight T-Shirt",
        "price": 22.19,
        "filename": "womenshdshirt.png",
        "main_image": "womenshdshirt.png",
        "preview_image": "womenshdshirtpreview.png",
        "description": "The Comfort Colors 1717 Heavyweight T-Shirt combines a structured fit with garment-dyed softness that feels lived-in from day one. Made from 100% cotton, it's durable enough for repeat wear and comfortable enough to style for any occasion. Perfect for custom designs that call for a structured, yet relaxed look. 100% ring-spun cotton. Fabric weight: 6.1 oz/yd² (206.8 g/m²). Yarn diameter: 20 singles. Garment-dyed, pre-shrunk fabric. Relaxed fit. 7/8″ double-needle topstitched collar. Twill-taped neck and shoulders for extra durability. Double-needle armhole, sleeve, and bottom hems. Signature twill label. Blank product sourced from Honduras. Disclaimer: This t-shirt undergoes garment-dyeing and softening processes, which may cause slight color variations. This product is made on demand. No minimums.",
        "options": {"color": ["Berry", "Blue Jean", "Grey", "Violet", "White", "Black", "True Navy", "Brick", "Moss", "Lagoon Blue", "Blue Spruce", "Flo Blue", "Butter", "Pepper", "Bay", "Ivory", "Paprika", "Sage", "Midnight", "Grape"], "size": ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"]},
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 1.65,  # +$1.65 = $23.84
            "XXXL": 3.30, # +$3.30 = $25.49
            "XXXXL": 4.95 # +$4.95 = $27.14
        }
    },
    {
        "name": "Kids Shirt",
        "price": 19.79,
        "filename": "kidshirtpreview.png",
        "main_image": "kidshirtpreview.png",
        "preview_image": "kidsshirtpreview.png",
        "description": "This Youth Staple Tee is light, comfy, and has just the right amount of stretch youngsters need for an active lifestyle. Both your print and embroidery designs will look great on this soft cotton tee. Add your artistry and make this crowd favorite into something special! 100% Airlume combed and ring-spun cotton. Heather colors are 52% combed and ring-spun cotton, 48% polyester. Athletic Heather is 90% combed and ring-spun cotton, 10% polyester. Fabric weight: 4.2 oz/yd² (142 g/m²). Pre-shrunk fabric. 32 singles. Relaxed unisex fit. Side-seamed construction. Blank product sourced from Nicaragua, the US, Guatemala, or Honduras. Disclaimer: The fabric is slightly sheer and may appear see-through, especially in lighter colors or under certain lighting conditions. Take a look at our Bella + Canvas 3001 unisex, toddler, and baby tees as well! This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Navy", "Maroon", "Forest", "Red", "Dark Grey Heather", "True Royal", "Berry", "Heather Forest", "Kelly", "Heather Columbia Blue", "Athletic Heather", "Mustard", "Pink", "Heather Dust", "Natural", "White"], "size": ["XS", "S", "M", "L", "XL"]},
        "size_pricing": {
            "XS": 0,
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0
        }
    },
    {
        "name": "Youth Heavy Blend Hoodie",
        "price": 27.16,
        "filename": "kidhoodie.png",
        "main_image": "kidhoodie.png",
        "preview_image": "kidsyouthheavyblendhoodiepreview.png",
        "description": "The Youth Heavy Blend Hoodie is a timeless and versatile piece, combining resilience with comfort. The blend of breathable cotton and durable polyester ensures this hoodie can withstand daily wear and frequent washes, making it a suitable fit for children on-the-go. Comfortable fleece and air jet yarn guarantees minimal pilling, and the hoodie comes with a front pouch pocket and no drawcords. Design a hoodie for your child, or start selling today! 50% cotton, 50% polyester, 20 singles. Fabric weight: 8 oz./yd² (271.25 g/m²). 2-end midweight fleece fabric. Air jet yarn for a softer feel and reduced pilling. Double-lined hood. No drawcords for child safety. Front pouch pocket. Double-needle stitching detailing at shoulders, armholes, neck, waistband and cuffs. 1 x 1 rib with spandex at cuffs and hem for enhanced stretch and recovery. CPSIA Tracking Label Compliant. Tear away label. Blank product sourced from Honduras. Disclaimer: Due to the fabric properties, the White color variant may appear off-white rather than bright white. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Navy", "Royal", "White", "Dark Heather", "Carolina Blue"], "size": ["XS", "S", "M", "L", "XL"]},
        "size_pricing": {
            "XS": 0,
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0
        }
    },
    {
        "name": "Kids Long Sleeve",
        "price": 23.99,
        "filename": "kidlongsleeve.png",
        "main_image": "kidlongsleeve.png",
        "preview_image": "kidslongsleevepreview.png",
        "description": "When it comes to apparel classics, this is it! The Youth Long Sleeve Tee is a wardrobe staple that'll go great with casual, sporty, or loungewear looks. The shirt is made of airlume combed and ring-spun cotton and will feel soft and comfy to the always energetic youth. Create print or embroidery designs and start selling the shirt on your store! 100% airlume combed and ring-spun cotton. Athletic Heather is 90% airlume combed and ring-spun cotton, 10% polyester. Fabric weight: 4.2 oz/yd² (180 g/m²). Regular fit. Side-seamed construction. Ribbed cuff. Blank product sourced Honduras, Nicaragua, US. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Navy", "Red", "Athletic Heather", "White"], "size": ["S", "M", "L"]},
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0
        }
    },
    {
        "name": "Kids Sweatshirt",
        "price": 24.13,
        "filename": "kidssweatshirt.png",
        "main_image": "kidssweatshirt.png",
        "preview_image": "kidssweatshirtpreview.png",
        "description": "Available in 8 classic colors, you're sure to fall in love with this sweatshirt's comfy fit and cozy feel. Made from air-jetted fleece fabric for a softer touch and reduced pilling, it'll stay looking great wash after wash. Customize it with your original designs and create a must-have wardrobe staple for a younger audience. Sell it online or order for yourself with no minimums. 50% cotton, 50% polyester. Fabric weight: 8 oz/yd² (271.25 g/m²). Air-jetted fleece fabric. Regular fit. Double-needle stitching on shoulders, armholes, neck, waistband, and cuffs. The fabric is OEKO-TEX Standard 100 certified. Blank product sourced from Honduras. Disclaimer: Due to the fabric properties, the White color variant may appear off-white rather than bright white. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Navy", "Maroon", "Red", "Dark Heather", "Royal", "Sport Grey", "White"], "size": ["XS", "S", "M", "L", "XL"]},
        "size_pricing": {
            "XS": 0,      # No extra charge
            "S": 0,       # No extra charge  
            "M": 0,       # No extra charge
            "L": 0,       # No extra charge
            "XL": 0       # No extra charge
        }
    },
    {
        "name": "Baby Body Suit",
        "price": 19.27,
        "filename": "youthalloverprintswimsuit.png",
        "main_image": "youthalloverprintswimsuit.png",
        "preview_image": "kidsbabybodysuitpreview.png",
        "description": "Made from supremely soft cotton, this one-piece is ideal for delicate skin. The lap shoulder design and three-snap closure ensure quick, easy outfit changes, making it a practical choice for parents. Add your design, order this bodysuit for your little one, or start selling it online! 100% combed ring-spun cotton in a 1 × 1 rib. Heather color is 90% combed ring-spun cotton, 10% polyester. Fabric weight: 5 oz./yd.² (170 g/m²). Three-snap closure. Lap shoulders. Blank product sourced from India. Note that due to the ribbed fabric, the print can break when stretched. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Heather", "Pink", "White"], "size": ["6m", "12m", "18m", "24m"]},
        "size_pricing": {
            "6m": 0,      # No extra charge
            "12m": 0,     # No extra charge  
            "18m": 0,     # No extra charge
            "24m": 0      # No extra charge
        }
    },
    {
        "name": "Toddler Jersey T-Shirt",
        "price": 18.75,
        "filename": "toddlerjerseytshirt.png",
        "main_image": "toddlerjerseytshirt.png",
        "preview_image": "kidstoddlerjerseytshirtpreview.png",
        "description": "This soft jersey t-shirt is built to handle the energy of active toddlers. Its ribbed collar, self-fabric neck tape, and double-stitched sleeves add comfort and durability. Customize the shirt with print designs and add it to your store! 100% combed ring-spun cotton. Ash color is 99% combed ring-spun cotton and 1% polyester. Heather color is 90% combed ring-spun cotton and 10% polyester. Fabric weight: 4.5 oz./yd.² (153 g/m²). Side-seamed construction. Shoulder-to-shoulder taping. Double-needle stitching on the sleeves and bottom hem. Ribbed topstitch on the collar. EasyTear label. Blank product sourced from India. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Navy", "Hot Pink", "Heather", "Light Blue", "White"], "size": ["2", "3", "4", "5/6"]},
        "size_pricing": {
            "2": 0,       # No extra charge
            "3": 0,       # No extra charge
            "4": 0,       # No extra charge
            "5/6": 0      # No extra charge
        }
    },
    {
        "name": "Baby Staple Tee",
        "price": 20.40,
        "filename": "babystapletshirt.png",
        "main_image": "babystapletshirt.png",
        "preview_image": "kidsbabystapleteepreview.png",
        "description": "This Bella + Canvas baby short sleeve tee is made from soft and light jersey cotton and ensures maximum comfort. Combined with your unique design, the casual crew neck tee will become a well-loved item in any baby's wardrobe! 100% Airlume combed ring-spun cotton. Heather colors are 52% combed ring-spun cotton, 48% polyester. Fabric weight: 4.2 oz/yd² (142 g/m²). Pre-shrunk fabric. 32 singles. Relaxed fit. Side-seamed construction. Blank product sourced from Nicaragua, the US, or Honduras. Looking for bigger sizes? Check out the same tee for toddlers and youth! This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Pink", "White"], "size": ["6-12m", "12-18m", "18-24m"]},
        "size_pricing": {
            "6-12m": 0,      # No extra charge
            "12-18m": 0,     # No extra charge
            "18-24m": 0      # No extra charge
        }
    },
    {
        "name": "Baby Jersey T-Shirt",
        "price": 18.75,
        "filename": "toddlershortsleevet.png",
        "main_image": "toddlershortsleevet.png",
        "preview_image": "kidsbabyjerseytshirtpreview.png",
        "description": "Soft, cozy, and made for everyday wear—this baby jersey t-shirt is designed with gentle, breathable fabric that's perfect for delicate skin. The ribbed collar keeps the shirt snug and maintains its shape wash after wash. Whether it's playtime, naptime, or a family outing, it's a reliable choice. Customize this baby tee with your design, order it for your child, or start selling it online. 100% combed ring-spun cotton. Fabric weight: 4.5 oz./yd.² (153 g/m²). Regular fit. Side-seamed construction. Topstitched ribbed collar. Shoulder-to-shoulder self-fabric back neck tape. Double-needle topstitch on sleeves and bottom hem. EasyTear label. Blank product sourced from India. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Royal", "Pink", "Light Blue", "White", "Charcoal"], "size": ["6m", "12m", "18m", "24m"]},
        "size_pricing": {
            "6m": 0,      # No extra charge
            "12m": 0,     # No extra charge
            "18m": 0,     # No extra charge
            "24m": 0      # No extra charge
        }
    },
    {
        "name": "Laptop Sleeve",
        "price": 28.73,
        "filename": "laptopsleeve.png",
        "main_image": "laptopsleeve.png",
        "preview_image": "bagslaptopsleevepreview.png",
        "description": "This lightweight, form-fitting laptop sleeve is a must-have for any laptop owner on the go. To prevent any scratches, it contains a padded zipper binding and its interior is lined with faux fur. What's more, it's made from a water-resistant and scratch-proof material, making sure that both the laptop and the sleeve design are intact from day to day. 100% neoprene. 13″ sleeve weight: 6.49 oz (220 g). 15″ sleeve weight: 8.8 oz (250 g). Lightweight and resistant to water, oil, and heat. Snug fit. Faux fur interior lining. Top-loading zippered enclosure with two sliders. Padded zipper binding. Customizable front, solid black rear. Blank product sourced from China. The laptop sleeve fits most 13″ and 15″ laptops—see our size guide for precise measurements. This product is made on demand. No minimums.",
        "options": {"color": ["White"], "size": ["13.5\"x10.5\"", "14.75\"x11.25\""]},
        "size_pricing": {
            "13.5\"x10.5\"": 0,
            "14.75\"x11.25\"": 1.78  # +$1.78 = $30.51
        }
    },
    {
        "name": "All-Over Print Drawstring",
        "price": 23.64,
        "filename": "drawstringbag.png",
        "main_image": "drawstringbag.png",
        "preview_image": "bagsalloverprintdrawstringpreview.png",
        "description": "Gym bag, drawstring bag, or backpack? Call it as you like! It's a must-have gym essential that can be worn as a backpack with drawstring closure at the top, and narrow, contrasting shoulder straps. Combine your love for vibrant prints and a sporty style! 100% polyester. One size: 15″ × 17″ (38.1 cm × 43.2 cm). Fabric weight (may vary by 5%): 6.64 oz./yd.² (225 g/m²). Maximum weight limit: 33 lbs (15 kg). Twin cotton handles. Drawstring closure. Printed, cut, and hand-sewn by our in-house team. Fabric is OEKO-TEX 100 standard certified. Price includes a full print.",
        "options": {"color": ["White", "Black", "Blue"], "size": ["15\"x17\""]},
        "size_pricing": {
            "15\"x17\"": 0
        }
    },
    {
        "name": "All Over Print Tote Pocket",
        "price": 25.55,
        "filename": "largecanvasbag.png",
        "main_image": "largecanvasbag.png",
        "preview_image": "bagsalloverprinttotepocketpreview.png",
        "description": "Meet your companion for any occasion—our All-Over Print Large Tote Bag! It's spacious, comfy, and a great choice no matter where you're going. Take it with you on your next beach trip or on a stroll around town. Customize the bag with your fun designs and get it for yourself, or sell it on your online store. 100% polyester. Fabric weight (may vary by 5%): 6.64 oz/yd² (225 g/m²). Maximum weight limit: 44lbs (20kg). Capacity: 4.4 US gal (17.8l). Large inside pocket that can be customized with a logo. Printed, cut, and hand-sewn by our in-house team. Comfortable cotton webbing handles. Vibrant colors that won't fade. Available in one size. Fabric is OEKO-TEX 100 standard certified. Product code: #602. This product is made on demand. No minimums.",
        "options": {"handle_color": ["Black", "Red", "Yellow"], "size": ["16\"x20\""]},
        "size_pricing": {
            "16\"x20\"": 0
        }
    },
    {
        "name": "Greeting Card",
        "price": 4.75,
        "filename": "greetingcard.png",
        "main_image": "greetingcard.png",
        "preview_image": "miscellaneousgreetingcardpreview.png",
        "description": "A well-designed greeting card has the power to help people express gratitude or sympathy, as well as inform attendees and set the mood for any given occasion. Coming in three different sizes, the greeting cards are customizable from top to bottom, and they can be designed to stand both horizontally and vertically. Create your own greeting cards tailored to any circumstance, be it a seasonal one or a once-in-a-lifetime event. Cardboard paper. Sizes: Small: 4″ × 6″ (101 × 152 mm), Medium: 5″ × 7″ (127 × 178 mm), Large: 5.83″ × 8.27″ (148 × 210 mm). Product weight: Small: 0.39 oz (11 g), Medium: 0.6 oz (17 g), Large: 0.85 oz (24 g). Toner-based printing. Vibrant colors. Comes with a complimentary envelope. Blank product materials sourced from Sweden. Disclaimer: Greeting cards shipped from Europe have a matte outside and a thicker envelope (120 g/m²). Greeting cards shipped from the US have a glossy outside and a thinner envelope (60#). Due to the different coatings on the inside and outside of the card, identical colors will look slightly different on the respective surfaces. Small cracks are likely to appear in the fold area over time. A small QR code is printed on the lower left corner of the back of the postcard. This is intended only for the production team's use. In case of low card stock, we might use comparable paper to fulfill the order. The substitute will be as close to the original as possible. This product is made on demand. No minimums.",
        "options": {"color": ["White"], "size": ["4\"x6\""]},
        "size_pricing": {
            "4\"x6\"": 0
        }
    },
    {
        "name": "Hardcover Bound Notebook",
        "price": 21.05,
        "filename": "hardcovernotebook.png",
        "main_image": "hardcovernotebook.png",
        "preview_image": "miscellaneoushardcovernotebookpreview.png",
        "description": "Whether crafting a masterpiece or brainstorming the next big idea, the Hardcover Bound Notebook will inspire your inner wordsmith. The notebook features 80 lined, cream-colored pages, a built-in elastic closure, and a matching ribbon page marker. Plus, the expandable inner pocket is perfect for storing loose notes and business cards to never lose track of important information. Make it your own with an original cover design and sell it on your store! Cover material: UltraHyde hardcover paper. Size: 5.5\" × 8.5\" (13.97 cm × 21.59 cm). Weight: 10.9 oz (309 g). 80 pages of lined, cream-colored paper. Matching elastic closure and ribbon marker. Expandable inner pocket. Blank product sourced from China. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Navy", "Red", "Blue", "Turquoise", "Orange", "Silver", "Lime", "White"], "size": ["5.5\"x8.5\""]},
        "size_pricing": {
            "5.5\"x8.5\"": 0
        }
    },
    {
        "name": "Coasters",
        "price": 5.00,
        "filename": "coaster.png",
        "main_image": "coaster.png",
        "preview_image": "miscellaneouscoasterspreview.png",
        "description": "Hello beverage coaster, goodbye mug stain! Introducing the long-awaited Cork-Back Coaster that's designed to protect your countertops and furniture from spills and scratches. It's crafted from genuine cork, hardboard, with a high-gloss coating that ensures a quality print. The coaster is heat-resistant, water-repellent, and easy to clean—just wipe it with a damp cloth. Add a vibrant design, a meaningful quote, or a photo to the coaster and pair it with your favorite mug or offer the item to your customers online. Hardboard MDF 0.12″ (3 mm). Cork 0.04″ (1 mm). High-gloss coating on top. Size: 3.74″ × 3.74″ × 0.16″ (95 × 95 × 4 mm). Rounded corners. Water-repellent, heat-resistant, and non-slip. Easy to clean. Blank product sourced from China. The displayed price is for a single item. This product is made on demand. No minimums.",
        "options": {"color": ["Wood", "Cork", "Black"], "size": ["4\"x4\""]},
        "size_pricing": {
            "4\"x4\"": 0
        }
    },
    {
        "name": "Apron",
        "price": 26.85,
        "filename": "apron.png",
        "main_image": "apron.png",
        "preview_image": "miscellaneousapronpreview.png",
        "description": "This apron is a canvas for bold, custom designs, perfect for pros behind the grill or home chefs mastering pasta night. It seamlessly blends fashion and function with a sleek fit, button-adjustable straps, and a durable yet lightweight fabric. It's a bestseller for online stores offering kitchen-ready gear or a thoughtful gift for foodies, newlyweds, or housewarming hosts. 100% polyester. Size: 27.6″ × 30.3″ (70 cm × 77 cm). Weight: 10.9 oz (310 g). Durable overlocked seams. Button-adjustable black twill straps. One size fits most. One-sided print. Blank product sourced from China. Disclaimer: Apron size may vary by ±1″ (2.5 cm). This product is made on demand. No minimums.",
        "options": {"color": ["Black", "White", "Navy", "Red", "Green"], "size": ["S", "M", "L", "XL"]},
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0
        }
    },
    {
        "name": "Kiss-Cut Stickers",
        "price": 3.39,
        "filename": "stickers.png",
        "main_image": "stickers.png",
        "preview_image": "miscellaneouskisscutstickerspreview.png",
        "description": "These Kiss-Cut Stickers can be cut in any shape you want, while also leaving a wide enough border around your design for smooth peeling. Available in four sizes that can be used for a single sticker or multiple smaller ones. What's more, there are no order minimums, so you can get a single sticker or a whole bunch—the world of stickers is your oyster. High opacity film that's impossible to see through. Durable vinyl. 95µ thickness. Fast and easy bubble-free application. Blank product sourced from Japan. Follow these tips when applying stickers: Apply the sticker to a clean, dust-free, oil-free, and moisture-free surface. After application, press the sticker down with a clean cloth to maximize the sticker's ability to stick to the surface and avoid air bubbles. Make sure that the sticker is applied correctly the first time. With every reapplication, the sticker's ability to stick will decrease. Apply the sticker to a flat surface only. If applied on items that bend, are round, or in a cylinder form, we can't guarantee its ability to hold. Disclaimer: Please note that the sticker paper is white and a transparent background isn't possible. This product is made on demand. No minimums.",
        "options": {"color": ["White"], "size": ["3\"x3\"", "4\"x4\"", "5.5\"x5.5\"", "15\"x3.75\""]},
        "size_pricing": {
            "3\"x3\"": 0,
            "4\"x4\"": 0.20,
            "5.5\"x5.5\"": 0.40,
            "15\"x3.75\"": 3.07
        }
    },
    {
        "name": "Pet Bowl All-Over Print",
        "price": 29.65,
        "filename": "dogbowl.png",
        "main_image": "dogbowl.png",
        "preview_image": "petspetbowlalloverprintpreview.png",
        "description": "Whether you're looking for a new addition to your store or the perfect gift for a pet lover, this Pet Bowl is an excellent choice. It works for dogs, cats or any other type of pet. But that's not all—since it's made with double-walled stainless steel and has an anti-slip rubber base, it's built to last and to withstand even the most impetuous of pets. Available in 2 sizes: 18 oz (532 ml) and 32 oz (946 ml). Double-wall stainless steel. Anti-slip rubber base. Food grade safe. Dishwasher safe when the rubber base is removed. Blank product sourced from China. Important: This product is available only in select countries. If you sell this item on your online store, make sure you let your customers know that they won't be able to order this product outside of these countries. This product is made on demand. No minimums.",
        "options": {"color": ["White"], "size": ["18oz", "32oz"]},
        "size_pricing": {
            "18oz": 0,
            "32oz": 1.64  # +$1.64 = $31.29
        }
    },
    {
        "name": "Pet Bandana Collar",
        "price": 21.78,
        "filename": "scarfcollar.png",
        "main_image": "scarfcollar.png",
        "preview_image": "petspetbandanacollarpreview.png",
        "description": "Add personality to your pet's wardrobe with this fun and functional bandana collar. Whether you're snapping pics for social media or just out for a walk, this collar brings a playful twist that pet lovers will adore. Available in four sizes to fit most pets, it's a great choice for online sellers in the pet product market. 100% polyester. Adjustable black collar with plastic buckle. 4 sizes: S, M, L, XL. Collar circumference: S: 10″–16.75″ (25.4 cm–42.5 cm), M: 12″–20.25″ (30.5 cm–51.4 cm), L: 14.25″–23″ (36.2 cm–58.4 cm), XL: 15.5″–23.5″ (39.4 cm–59.7 cm). Durable construction, machine washable (max 90ºF (30ºC)). One-sided print: white reverse. Blank product sourced from China. Disclaimer: Product size may vary by ±1″ (2.5 cm). This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Red", "Blue", "Green"], "size": ["Small 10″–16.75″", "Medium 12″–20.25″", "Large 14.25″–23″", "XL 15.5″–23.5″"]},
        "size_pricing": {
            "Small 10″–16.75″": 0,
            "Medium 12″–20.25″": 0,
            "Large 14.25″–23″": 1.35,  # +$1.35 = $23.13
            "XL 15.5″–23.5″": 1.35  # +$1.35 = $23.13
        }
    },
    {
        "name": "Bandana",
        "price": 12.99,
        "filename": "bandana.png",
        "main_image": "bandana.png",
        "preview_image": "miscellaneousbandanapreview.png",
        "description": "A headband, armband, necktie, bag accessory, or even a scarf for a beloved pet—that's the All-Over Print Bandana! With double-folded edges and a detailed single-sided print, it's sturdy and durable to use for as long as you like. Create your own custom design for this bandana and get one for yourself or start selling! 65% recycled polyester, 35% polyester. Fabric weight: 2.95 oz./yd.² (100 g/m²). Breathable and moisture-wicking material. Lightweight and soft to the touch. Double-folded edges. Single-sided print. Multifunctional. UPF50+ protection. The fabric is OEKO-TEX 100 standard certified. The recycled content of this product is certified under GRS (Global Recycled Standard). Important sizing information: the smallest bandana size is made for small pets and won't fit a grown-up. Please choose the medium or large size if you're selling/ordering for a grown-up and disclose this sizing information on your store. Product code: 655. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Red", "Blue", "Green", "Pink"], "size": ["Small", "Medium", "Large"]},
        "size_pricing": {
            "Small": 0,
            "Medium": 0,
            "Large": 0
        }
    },
    {
        "name": "Jigsaw Puzzle with Tin",
        "price": 25.59,
        "filename": "jigsawpuzzle.png",
        "main_image": "jigsawpuzzle.png",
        "preview_image": "miscellaneousjigsawpuzzlewithtinpreview.png",
        "description": "Make quality time more fun with a custom jigsaw puzzle that's both a challenge and a keepsake. Whether it's a cozy night in with family or a weekend brain-teaser with friends, this puzzle delivers an experience worth framing. With rich colors, a glossy finish, and your design, it's ideal for sellers looking to offer meaningful, personalized gifts. Pre-die-cut chipboard with non-edge pieces. White metal tin box with the image on the lid. Available in 6 sizes: 30 pcs: 10″ × 8″ (25.40 cm × 20.32 cm), 110 pcs: 10″ × 8″ (25.40 cm × 20.32 cm), 252 pcs: 14″ × 11″ (35.56 cm × 27.94 cm), 500 pcs: 21″ × 15.5″ (53.34 cm × 39.37 cm), 1000 pcs: 30″ × 20″ (76.20 cm × 50.80 cm), 2000 pcs: 40″ × 28″ (101.60 cm × 71.12 cm). Weight by size: 30 pcs: 8 oz (227 g), 110 pcs: 8 oz (227 g), 252 pcs: 9.6 oz (272 g), 500 pcs: 20 oz (567 g), 1000 pcs: 24 oz (680 g), 2000 pcs: 28 oz (794 g). Glossy finish. Vibrant colors. Ideal for gifting or wall decor. Blank product sourced from China. Important: Choking hazard—small parts. Not suitable for children under 4 years. This product is made on demand. No minimums.",
        "options": {"color": ["White"], "size": ["252 pcs: 14″ × 11″ (35.56 cm × 27.94 cm)", "500 pcs: 21″ × 15.5″ (53.34 cm × 39.37 cm)", "1000 pcs: 30″ × 20″ (76.20 cm × 50.80 cm)", "2000 pcs: 40″ × 28″ (101.60 cm × 71.12 cm)"]},
        "size_pricing": {
            "252 pcs: 14″ × 11″ (35.56 cm × 27.94 cm)": 0,  # Base price $25.59
            "500 pcs: 21″ × 15.5″ (53.34 cm × 39.37 cm)": 3.74,  # +$3.74 = $29.33
            "1000 pcs: 30″ × 20″ (76.20 cm × 50.80 cm)": 6.18,  # +$6.18 = $31.77
            "2000 pcs: 40″ × 28″ (101.60 cm × 71.12 cm)": 14.91  # +$14.91 = $40.50
        }
    },
    {
        "name": "All Over Print Leash",
        "price": 24.90,
        "filename": "leash.png",
        "main_image": "leash.png",
        "preview_image": "petsalloverprintleash.png",
        "description": "Design custom pet collar and leash sets for yourself or sell them to pet owners online. With all-over print sublimation, designs stay vibrant and last long. The padded collar inside and leash handle offer comfort to the pet and its owner. Optionally, add branding to the product packaging. Durable 100% polyester webbing. 92% polyester, 8% spandex collar and leash handle inside. Black 100% polyester sponge collar and handle padding. Metal snap hook and D-ring for the leash. Black plastic main buckle, adjustable buckle, and strap holder for the collar. Leash length: 6 ft. (1.83 m). Leash and collar width: 1″ (2.54 cm). 3 collar sizes available: S 11.8″–17.8″ (30–45 cm), M 13.5″–20.5″ (35–52 cm), L 14.8″–23.8″ (38–60 cm). Adjustable collar length. The leash is customizable on both sides. The collar is customizable on one side. Option to add branding to the cardboard packaging and poly mailer. Blank product sourced from China. Disclaimers: The collar has visible black stitching. Hand wash with mild detergent or machine wash on a gentle cycle in a mesh bag. Air dry. Important: This product is available only in select countries. If you sell this item on your online store, make sure you let your customers know that they won't be able to order this product outside of these countries. As of April 21, 2025, express shipping is no longer available for customers who previously had this option enabled. This change is due to increased carrier surcharges of up to $25–$30 per package. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Brown", "Blue", "Red"], "size": ["6 feet"]},
        "size_pricing": {
            "6 feet": 0
        }
    },
    {
        "name": "All Over Print Collar",
        "price": 23.08,
        "filename": "collar.png",
        "main_image": "collar.png",
        "preview_image": "petsalloverprintcollarpreview.png",
        "description": "Expand your pet accessory range with custom collars. The all-over print sublimation technique allows for vibrant, long-lasting prints. The premium quality collar features black padding on the inside to ensure comfort for pets. Available in three adjustable sizes. Optionally, add branding to the packaging. Durable 100% polyester webbing. 92% polyester, 8% spandex collar inside. Black 100% polyester sponge collar inside padding. 3 sizes available: S 11.8″–17.8″ (30–45 cm), M 13.5″–20.5″ (35–52 cm), L 14.8″–23.8″ (38–60 cm). Adjustable collar length. Collar width: 1″ (2.54 cm). Black plastic main buckle, adjustable buckle, and strap holder. The collar is customizable on one side. Option to add branding to the cardboard packaging and poly mailer. Blank product sourced from China. Disclaimers: The collar has visible black stitching. Hand wash with mild detergent or machine wash on a gentle cycle in a mesh bag. Air dry. Important: This product is available only in select countries. If you sell this item on your online store, make sure you let your customers know that they won't be able to order this product outside of these countries. As of April 21, 2025, express shipping is no longer available for customers who previously had this option enabled. This change is due to increased carrier surcharges of up to $25–$30 per package. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Brown", "Blue", "Red", "Green"], "size": ["S 11.8\"-17.8\"", "M 13.5\"-20.5\"", "L 14.8\"-23.8\""]},
        "size_pricing": {
            "S 11.8\"-17.8\"": 0,
            "M 13.5\"-20.5\"": 0,
            "L 14.8\"-23.8\"": 0
        }
    },
    {
        "name": "Die-Cut Magnets",
        "price": 4.75,
        "filename": "magnet.png",
        "main_image": "magnet.png",
        "preview_image": "miscellaneousdiecutmagnetspreview.png",
        "description": "Make jokes, memories, or original drawings last forever with our Die-Cut Magnets. Featuring a sleek, professional matte finish, these magnets come in three sizes and can be cut into any defined shape. The entire back of each magnet is covered with a strong magnetic material, ensuring a secure hold on any metallic surface. Create travel magnets and order in bulk to sell as souvenirs, or design a cool complement to different collections for your online store. Made from 20 mil (0.5 mm) flexible vinyl. Premium matte finish on top. Black magnetic backing. 3 sizes available: 3″ × 3″ (8 × 8 cm), 4″ × 4″ (10 × 10 cm), 6″ × 6″ (15 × 15 cm). Blank product sourced from the USA. This product is made on demand. No minimums.",
        "options": {"color": ["White"], "size": ["3\"x3\"", "4\"x4\"", "6\"x6\""]},
        "size_pricing": {
            "3\"x3\"": 0,
            "4\"x4\"": 0.51,
            "6\"x6\"": 2.55
        }
    },
    {
        "name": "Men's Long Sleeve Shirt",
        "price": 20.79,
        "filename": "menslongsleeve.png",
        "main_image": "menslongsleeve.png",
        "preview_image": "menslongsleevepreview.png",
        "description": "With its classic and regular fit, this Men's Long Sleeve Shirt is a true wardrobe essential. It'll look great on its own or layered under a jacket and will be perfect for a relaxed and casual setting. 100% cotton. Sport Grey is 90% cotton, 10% polyester. Fabric weight: 6.0 oz./yd.² (203.43 g/m²). Classic fit with long sleeves and rib cuffs. Pre-shrunk jersey knit. Seamless double-needle ⅞ ″ (2.2 cm) collar. Double-needle bottom hem. Taped neck and shoulders. Quarter-turned to avoid crease down the middle. Blank product sourced from Honduras, Haiti, or Nicaragua. Disclaimer: Due to the fabric properties, the White color variant may appear off-white rather than bright white. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "White", "Navy", "Sport Grey", "Red", "Military Green", "Ash"], "size": ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"]},
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 1.65,  # +$1.65 = $22.44
            "XXXL": 3.30, # +$3.30 = $24.09
            "XXXXL": 4.95 # +$4.95 = $25.74
        }
    },
    {
        "name": "Fitted Racerback Tank",
        "price": 19.31,
        "filename": "womenstank.png",
        "main_image": "womenstank.png",
        "preview_image": "womenstankpreview.png",
        "description": "A proven bestseller in women's activewear, this racerback tank blends style, comfort, and affordability. Designed to deliver a premium feel without the high price tag, it's a smart pick for fitness or athleisure-oriented stores. With matching self-binding seams, a flattering fitted cut, and a lightweight cotton-poly jersey blend, it's built to perform and easy to customize for yourself or to sell online. 60% combed ringspun cotton, 40% polyester. Fabric weight: 4 oz./yd.² (113.4 g/m²). Lightweight jersey. Fitted silhouette. Scoop neck and racerback. Self-binding seams in matching colors for a seamless look. Tear-away label. Blank product sourced from Honduras. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Hot Pink", "Light Orange", "Tahiti Blue", "Heather Gray", "Cancun", "White"], "size": ["XS", "S", "M", "L", "XL", "XXL"]},
        "size_pricing": {
            "XS": 0,
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 1.65  # +$1.65 = $20.96
        }
    },
    {
        "name": "Unisex Pullover Hoodie",
        "price": 37.97,
        "filename": "unisexpulloverhoodie.png",
        "main_image": "unisexpulloverhoodie.png",
        "preview_image": "womensunisexpulloverhoodiepreview.png",
        "description": "This classic Unisex Pullover Hoodie should be a staple in every store and wardrobe. It's soft and warm with cuffed long sleeves. Add your designs and start selling! 52% airlume combed ring-spun cotton, 48% poly fleece. Heather colors are 60% airlume combed ring-spun cotton, 40% poly fleece. Fabric weight: 6.5 oz/yd² (220.4 g/m²). Regular fit. Side-seamed construction. Blank product sourced from Honduras, Nicaragua or the US. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "White", "Heather Forest", "Heather Navy"], "size": ["S", "M", "L", "XL", "XXL"]},
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 1.65  # +$1.65 = $39.62
        }
    },
    {
        "name": "Micro-Rib Tank Top",
        "price": 23.31,
        "filename": "womenstee.png",
        "main_image": "womenstee.png",
        "preview_image": "womensmicroribtanktoppreview.png",
        "description": "This women's tank top redefines the classic tank with its flattering 1 × 1 micro-rib texture, thick straps, and mid-length cut. The tank's soft, stretchy fabric ensures all-day comfort. It pairs well with high-waisted jeans or under a blazer for a polished look. Order one for yourself or add it to your online store. 52% Airlume combed and ring-spun cotton, 48% polyester. Athletic Heather colors are 90% Airlume combed and ring-spun cotton and 10% polyester. Fabric weight: 5.4 oz./yd.² (183 g/m²). Yarn diameter: 32 singles. 1 × 1 micro ribbing. Pre-shrunk. Stretch fit. Mid-length. Thick straps. Scoop neck. Side-seamed construction. Blank product sourced from Nicaragua. This product is made on demand. No minimums.",
        "options": {"color": ["Solid Black Blend", "Solid Navy Blend", "Athletic Heather", "Solid Baby Blue Blend", "Solid Pink Blend", "Solid White Blend"], "size": ["XS", "S", "M", "L", "XL", "XXL"]},
        "size_pricing": {
            "XS": 0,
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 1.65  # +$1.65 = $24.96
        }
    },
    {
        "name": "Distressed Dad Hat",
        "price": 21.89,
        "filename": "distresseddadhat.png",
        "main_image": "distresseddadhat.png",
        "preview_image": "hatsdistresseddadhatpreview.png",
        "description": "Expand your headwear collection with this fashionable Dad Hat. The fabric on its brim and crown is distressed, giving the hat an edgy look. 100% pre-shrunk cotton twill. Unstructured 6-panel cap with a low profile. Soft crown. 6 sewn eyelets. 4 stitched rows on the brim. Adjustable hook-and-loop closure. Seamed front panel without buckram. Blank product sourced from China. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Navy", "Charcoal Gray", "Khaki"], "size": ["One Size"]},
        "size_pricing": {
            "One Size": 0
        }
    },
    {
        "name": "Closed Back Cap",
        "price": 25.19,
        "filename": "closedbackcap.png",
        "main_image": "closedbackcap.png",
        "preview_image": "hatsclosedbackcappreview.png",
        "description": "Closed back cap with adjustable fit. Perfect for custom designs and logos.",
        "options": {"color": ["Dark Navy", "Black", "Royal Blue", "Red", "Grey", "White", "Dark Grey", "Multicam Black", "Olive", "Multicam Green", "Khaki"], "size": ["One Size"]},
        "size_pricing": {
            "One Size": 0
        }
    },
    {
        "name": "Five Panel Trucker Hat",
        "price": 22.71,
        "filename": "fivepaneltruckerhat.png",
        "main_image": "fivepaneltruckerhat.png",
        "preview_image": "hatsfivepaneltruckerhatpreview.png",
        "description": "This structured, high-profile 5 Panel Trucker Cap is the perfect choice for sunny days. It can also serve as a stylish accessory for your outfit as the flat bill gives the cap a modern twist. Put your striking designs on this cap—be it a catchy phrase, your logo, or a cute graphic—and sell it on your store or get one for yourself! 47% cotton, 28% nylon, 25% polyester, or 65% polyester, 35% cotton. Structured, five-panel, high-profile. Classic trucker cap styling. Flat bill. Snapback closure. Head circumference: 21⅝″–23⅝″ (53.3 cm–60 cm). Blank product sourced from Vietnam or Bangladesh. This product is made on demand. No minimums.",
        "options": {"color": [
            "Black/ White",
            "Black",
            "Charcoal",
            "Black/ White/ Black",
            "Red/ White/ Red",
            "White",
            "Navy/ White/ Navy",
            "Royal/ White/ Royal",
            "Kelly/ White/ Kelly",
            "Navy",
            "Navy/ White",
            "Charcoal/ White",
            "Silver/ Black"
        ], "size": ["One Size"]},
        "size_pricing": {
            "One Size": 0
        }
    },
    {
        "name": "Five Panel Baseball Cap",
        "price": 19.96,
        "filename": "youthbaseballcap.png",
        "main_image": "youthbaseballcap.png",
        "preview_image": "hatsfivepanelbaseballhatpreview.png",
        "description": "Our 5 panel cap is a time-tested favorite. With a structured front panel, it offers a clean, crisp canvas for print and embroidery. The cap has a popular mid-profile fit with an adjustable snap closure for a snug shape. Its slightly curved visor adds a classic look, and a matching undervisor and sweatband give it a cohesive, professional finish—built for bold and clean designs. 65% polyester, 35% cotton. Mid-profile, contoured fit with a structured, firm front panel. 6 sewn eyelets for breathability. Adjustable plastic snap closure for a secure fit. Matching fabric undervisor and sweatband. Blank product sourced from China and Myanmar. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Black/Natural", "Red/Natural", "Navy/Natural", "Dark Green/Natural", "Royal/Natural", "White"], "size": ["One Size"]},
        "size_pricing": {
            "One Size": 0
        }
    },
    {
        "name": "White Glossy Mug",
        "price": 14.95,
        "filename": "mug1.png",
        "main_image": "mug1.png",
        "preview_image": "mugwhiteglossymugpreview.png",
        "description": "This sturdy mug is perfect for your morning coffee, afternoon tea, or whatever hot beverage you enjoy. It's glossy white and yields vivid prints that retain their quality when dish-washed and microwaved. Add a graphic of your choice and add this best-seller to your store, so others can enjoy your magical designs too! Ceramic. 11 oz mug dimensions: 3.8″ (9.6 cm) in height, 3.2″ (8.2 cm) in diameter. 15 oz mug dimensions: 4.7″ (11.9 cm) in height, 3.3″ (8.5 cm) in diameter. 20 oz mug dimensions: 4.3″ (10.9 cm) in height, 3.7″ (9.3 cm) in diameter. Lead and BPA-free material. Dishwasher and microwave safe. Blank product sourced from China. Disclaimer: The White Glossy Mug may vary slightly in size by up to +/- 0.1″ (2 mm) due to the nature of the production process. These variations are normal and won't affect your mug's quality or functionality. This product is made on demand. No minimums.",
        "options": {"color": ["White"], "size": ["11 oz", "15 oz", "20 oz"]},
        "size_pricing": {
            "11 oz": 0,
            "15 oz": 1.50,  # +$1.50 = $16.45
            "20 oz": 3.00   # +$3.00 = $17.95
        }
    },
    {
        "name": "Travel Mug",
        "price": 28.48,
        "filename": "travelmug.png",
        "main_image": "travelmug.png",
        "preview_image": "mugtravelmugpreview.png",
        "description": "Enjoy your favorite beverage on the go with a premium-quality travel mug. It's made with stainless steel and keeps hot drinks hot for up to 6 h, and cold drinks cold for up to 8 h. It fits into most car cup holders and has a spill-proof plastic lid. Personalize it for yourself or add it to your online store and start selling modern drinkware. Made with stainless steel. Lead and BPA-free materials used. Hand-wash only. Blank product sourced from China. 25 oz (739 ml) size: Height: 7.9″ (20 cm), Upper diameter: 3.3″ (8.4 cm), Bottom diameter: 2.7″ (7 cm). Comes with a plastic press-in lid. 40 oz (1183 ml) size: Height: 10.4″ (26.5 cm), Upper diameter: 3.9″ (9.9 cm), Bottom diameter: 2.9″ (7.4 cm). Comes with a plastic straw and screw-on lid. Caution! To prevent steam pressure buildup, always open the lid before placing it on a hot drink. This product is made on demand. No minimums.",
        "options": {"color": ["White", "Black", "Navy", "Gray"], "size": ["25 oz", "40 oz"]},
        "size_pricing": {
            "25 oz": 0,
            "40 oz": 0.93  # +$0.93 = $29.41
        }
    },
    {
        "name": "Enamel Mug",
        "price": 19.82,
        "filename": "enamalmug.png",
        "main_image": "enamalmug.png",
        "preview_image": "mugenamelmugpreview.png",
        "description": "Lightweight and durable, our Enamel Mug is a must-have for every devoted camper. Use it for your favorite beverage or a hot meal, and attach it to your bag for easy access on a hike. Order a personalized mug for your next camping trip or add your designs and start selling online. Material: Metal with an enamel layer and sublimation coating. Dimensions: height 3.14″ (8 cm), diameter 3.25″ (8.5 cm). Lead and BPA-free material. White coating with a silver rim. NOT dishwasher or microwave-safe. Hand-wash only. Blank product sourced from China. Attention! Don't heat liquids or food directly in the mug—it can damage the coating. Disclaimer: The Enamel Mug is susceptible to staining when used with certain beverages, including coffee, tea, and natural juices. That's a normal characteristic of enamel products and not specific to our mug alone. Due to the enamel's rough and porous surface texture, particles from these drinks may easily adhere to the mug, resulting in stains over time. Stains can be effectively removed by applying lemon juice or soda to the affected area and gently scrubbing with a hard sponge. This product is made on demand. No minimums.",
        "options": {"color": ["White", "Black", "Navy", "Red"], "size": ["12 oz"]},
        "size_pricing": {
            "12 oz": 0
        }
    },
    {
        "name": "Colored Mug",
        "price": 16.49,
        "filename": "coloredmug.png",
        "main_image": "coloredmug.png",
        "preview_image": "mugcoloredmugpreview.png",
        "description": "This sturdy White Ceramic Mug has a colorful inside and a white print area all around the mug. Choose between vibrant color options, create your own unique designs, and start selling the mug to your customers! Ceramic. 11 oz mug dimensions: 3.79″ (9.6 cm) in height, 3.25″ (8.3 cm) in diameter. 15 oz mug dimensions: 4.69″ (11.9 cm) in height, 3.35″ (8.5 cm) in diameter. Lead and BPA-free material. White print area. Colored rim, inside, and handle. Dishwasher and microwave safe. Blank product sourced from China. This product is made on demand. No minimums. Disclaimer: This product is not suitable for children under 18 months. Depending on the light setting, the handle color of the White Ceramic Mug in Black may appear blue.",
        "options": {"color": ["Black", "Red", "Blue", "Dark Green"], "size": ["11 oz", "15 oz"]},
        "size_pricing": {
            "11 oz": 0,
            "15 oz": 0.80  # +$0.80 = $17.29
        }
    },
    {
        "name": "All-Over Print Utility Bag",
        "price": 28.57,
        "filename": "crossbodybag.png",
        "main_image": "crossbodybag.png",
        "preview_image": "bagsalloverprintutilitybagpreview.png",
        "description": "Designed for those who love to explore the great outdoors or dance the night away at festivals, this versatile bag will become the ideal companion for all your and your customers' daily adventures. 100% polyester. Fabric weight: 9 oz./yd.² (305 g/m²). Bag size: 5.7″ × 7.7″ × 2″ (14.5 cm × 19.5 cm × 5 cm). Capacity: 0.37 gallons (1.4 l). Water-resistant and durable. Sturdy fabric with fusible backing to add firmness. Inside and outside pockets. Adjustable strap. Two-way zipper. Product code: #609. This product is made on demand. No minimums.",
        "options": {"color": ["White"], "size": ["5.7\"x7.7\"x2\""]},
        "size_pricing": {
            "5.7\"x7.7\"x2\"": 0
        }
    },
    {
        "name": "Women's Crop Top",
        "price": 26.01,
        "filename": "womens-crop-top.png",
        "main_image": "womens-crop-top.png",
        "preview_image": "womenscroptoppreview.png",
        "description": "Simple and classic—that's the Women's Crop Top | AS Color 4062. It's made of 100% combed cotton, which makes the shirt extremely soft and more durable than regular cotton shirts. The relaxed fit and dropped shoulders ensure comfortable wear, while the cropped length makes it a popular choice for customers living in warmer climates. 100% combed cotton. Heather colors are 15% viscose and 85% cotton. Fabric weight: 5.3 oz/yd² (180 g/m²). Relaxed fit. Cropped length. Ribbed crew neck. Dropped shoulders. Side-seamed construction. Shoulder-to-shoulder taping. Double-needle hems. Preshrunk. Blank product sourced from Bangladesh. This product is made on demand. No minimums.",
        "options": {"color": ["Black", "Hazy Pink", "Pale Pink", "Orchid", "Ecru", "White", "Bubblegum", "Bone", "Mineral", "Natural"], "size": ["XS", "S", "M", "L", "XL"]},
        "size_pricing": {
            "XS": 0,
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0
        },
        "category": "womens"
    },
    {
        "name": "Pajama Shorts",
        "price": 32.56,
        "filename": "womens-crop-top.png",
        "main_image": "womens-crop-top.png",
        "preview_image": "womenscroptoppreview.png",
        "options": {"color": ["Black", "Hazy Pink", "Pale Pink", "Orchid", "Ecru", "White", "Bubblegum", "Bone", "Mineral", "Natural"], "size": ["XS", "S", "M", "L", "XL"]},
        "size_pricing": {
            "XS": 0,
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0
        },
        "category": "womens"
    }
]

def filter_products_by_category(category):
    """Filter products based on category selection"""
    print(f"🔍 FILTER DEBUG: Received category: '{category}'")
    if not category or category == "all" or category == "all-products":
        print(f"🔍 FILTER DEBUG: No category or 'all'/'all-products', returning all products")
        return PRODUCTS  # Show all products when category is 'all' or 'all-products'
    
    # Special handling for thumbnails category - Coming Soon
    if category == "thumbnails":
        print(f"🔍 FILTER DEBUG: Thumbnails category selected - returning Coming Soon")
        return [{
            "name": "Coming Soon",
            "price": 0,
            "filename": "",
            "main_image": "",
            "preview_image": "",
            "options": {"color": [], "size": []},
            "size_pricing": {},
            "coming_soon": True
        }]
    
    # Define category mappings based on actual product names from PRODUCTS list
    category_mappings = {
        'mens': [
            "Unisex Hoodie",
            "Men's Tank Top", 
            "Mens Fitted T-Shirt",
            "Men's Fitted Long Sleeve",
            "Unisex T-Shirt",
            "Unisex Oversized T-Shirt",
            "Men's Long Sleeve Shirt",
            "Unisex Champion Hoodie"
        ],
        'womens': [
            "Cropped Hoodie",
            "Fitted Racerback Tank",
            "Micro-Rib Tank Top", 
            "Women's Ribbed Neck",
            "Women's Shirt",
            "Unisex Heavyweight T-Shirt",
            "Unisex Pullover Hoodie",
            "Women's Crop Top"
        ],
        'kids': [
            "Youth Heavy Blend Hoodie",
            "Kids Shirt",
            "Kids Long Sleeve",
            "Toddler Jersey T-Shirt",
            "Kids Sweatshirt",
            "Baby Staple Tee",
            "Baby Jersey T-Shirt",
            "Baby Body Suit"
        ],
        'bags': [
            "Laptop Sleeve",
            "All-Over Print Drawstring", 
            "All Over Print Tote Pocket",
            "All-Over Print Utility Bag"
        ],
        'hats': [
            "Distressed Dad Hat",
            "Closed Back Cap",
            "Five Panel Trucker Hat",
            "Five Panel Baseball Cap"
        ],
        'mugs': [
            "White Glossy Mug",
            "Travel Mug",
            "Enamel Mug",
            "Colored Mug"
        ],
        'pets': [
            "Pet Bowl All-Over Print",
            "Pet Bandana Collar",
            "All Over Print Leash",
            "All Over Print Collar"
        ],
        'misc': [
            "Bandana",
            "Hardcover Bound Notebook", 
            "Coasters",
            "Apron",
            "Jigsaw Puzzle with Tin",
            "Greeting Card",
            "Kiss-Cut Stickers",
            "Die-Cut Magnets"
        ],
        'all-products': [],  # All Products category - will contain all products eventually
        'thumbnails': []  # Coming Soon - no products yet
    }
    
    # Get product names for the selected category
    category_products = category_mappings.get(category, [])
    
    # Filter PRODUCTS list to only include products from this category
    filtered_products = []
    print(f"🔍 FILTER DEBUG: Looking for products in category '{category}' with {len(category_products)} product names")
    print(f"🔍 FILTER DEBUG: Category products: {category_products}")
    
    for product in PRODUCTS:
        if product["name"] in category_products:
            print(f"✅ FILTER DEBUG: Found matching product: {product['name']}")
            filtered_products.append(product)
        else:
            print(f"❌ FILTER DEBUG: Skipping product: {product['name']}")
    
    print(f"🔍 FILTER DEBUG: Returning {len(filtered_products)} filtered products out of {len(PRODUCTS)} total")
    return filtered_products

# Register Products and Orders Blueprints now that PRODUCTS is defined
try:
    register_products_routes(app, supabase, PRODUCTS, product_data_store, printful_integration)
    print("  [OK] Products Blueprint registered (after PRODUCTS definition)")
    
    # Register Orders Blueprint with PRODUCTS list
    register_orders_routes(app, supabase, supabase_admin, order_store, PRODUCTS, config)
    print("  [OK] Orders Blueprint registered (after PRODUCTS definition)")
    print("[OK] All Blueprints registered successfully!")
except Exception as e:
    print(f"[ERROR] Error registering Products/Orders Blueprints: {str(e)}")
    import traceback
    traceback.print_exc()

@app.route("/")
def index():
    return "Flask Backend is Running!"

@app.route("/static/images/<filename>")
def serve_static_image(filename):
    """Serve static images with proper headers"""
    # Remove query parameters from filename for file lookup
    clean_filename = filename.split('?')[0]
    static_dir = os.path.join(app.root_path, 'static', 'images')
    response = send_from_directory(static_dir, clean_filename)
    
    # Add cache-busting headers for mobile compatibility
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    # Add CORS headers for images
    
    return response

@app.route("/test")
def test_page():
    return render_template("simple_test.html")

@app.route("/minimal")
def minimal_test():
    return render_template("minimal_test.html")

@app.route("/simple-merchandise/<product_id>")
def simple_merchandise_page(product_id):
    logger.info(f"🔍 Showing simple merchandise page for ID: {product_id}")
    
    try:
        # Try to get from Supabase first
        try:
            result = supabase.table('products').select('*').eq('product_id', product_id).execute()
            
            if result.data:
                product_data = result.data[0]
                
                screenshots = []
                if product_data.get('screenshots_urls'):
                    try:
                        screenshots = json.loads(product_data.get('screenshots_urls'))
                    except Exception as json_error:
                        screenshots = []
                
                return render_template(
                    'simple_merchandise.html',
                    img_url=product_data.get('thumbnail_url'),
                    screenshots=screenshots,
                    product_id=product_id
                )
            else:
                return "Product not found", 404
                
        except Exception as db_error:
            logger.error(f"❌ Database error: {str(db_error)}")
            return "Database error", 500
            
    except Exception as e:
        logger.error(f"❌ Error in simple merchandise page: {str(e)}")
        return "Server error", 500

# Removed duplicate route - using the first /api/product/<product_id> route instead

@app.route("/api/create-product", methods=["POST", "OPTIONS"])
def create_product():
    if request.method == "OPTIONS":
        # Flask-CORS handles OPTIONS requests automatically
        return jsonify({"success": True})

    try:
        data = request.get_json()
        if not data:
            response = jsonify(success=False, error="No data received")
            return response, 400

        product_id = str(uuid.uuid4())
        thumbnail = data.get("thumbnail", "")
        video_url = data.get("videoUrl", "")
        video_title = data.get("videoTitle", "Unknown Video")
        creator_name = data.get("creatorName", "Unknown Creator")
        screenshots = data.get("screenshots", [])

        logger.info(f"✅ Creating product {product_id}")
        logger.info(f"  Video URL: {video_url}")
        logger.info(f"  Video Title: {video_title}")
        logger.info(f"  Creator: {creator_name}")
        logger.info(f"  Thumbnail present: {'Yes' if thumbnail else 'No'}")
        logger.info(f"  Screenshots: {len(screenshots)}")

        # Try to save to Supabase first
        try:
            # Try with creator_name first
            supabase.table("products").insert({
                "name": f"Custom Merch - {product_id[:8]}",  # Required field
                "price": 24.99,  # Required field - default price
                "description": f"Custom merchandise from video",  # Optional but good to have
                "product_id": product_id,
                "thumbnail_url": thumbnail,
                "video_url": video_url,
                "video_title": video_title,
                "creator_name": creator_name,
                "screenshots_urls": json.dumps(screenshots),
                "category": "Custom Merch"
            }).execute()
            logger.info(f"✅ Successfully saved to Supabase database with creator_name")
        except Exception as db_error:
            logger.error(f"❌ Database error: {str(db_error)}")
            logger.info("🔄 Trying without creator_name column...")
            try:
                # Fallback: insert without creator_name column
                supabase.table("products").insert({
                    "name": f"Custom Merch - {product_id[:8]}",  # Required field
                    "price": 24.99,  # Required field - default price
                    "description": f"Custom merchandise from video",  # Optional but good to have
                    "product_id": product_id,
                    "thumbnail_url": thumbnail,
                    "video_url": video_url,
                    "video_title": video_title,
                    "screenshots_urls": json.dumps(screenshots),
                    "category": "Custom Merch"
                }).execute()
                logger.info(f"✅ Successfully saved to Supabase database (without creator_name)")
            except Exception as db_error2:
                logger.error(f"❌ Database error (fallback): {str(db_error2)}")
                logger.info("🔄 Falling back to in-memory storage")
                
                # Fallback to in-memory storage
                product_data_store[product_id] = {
                    "thumbnail": thumbnail,
                    "screenshots": screenshots,
                    "video_url": video_url,
                    "video_title": video_title,
                    "creator_name": creator_name,
                    "created_at": "now"
                }

        # Get authentication data and category from request
        is_authenticated = data.get("isAuthenticated", False)
        user_email = data.get("userEmail", "")
        category = data.get("category", "all")
        
        # Detect the origin/subdomain from the request to preserve it
        origin = request.headers.get('Origin', 'https://screenmerch.com')
        # Extract the base URL (protocol + host) from origin
        # If origin is a subdomain like https://testcreator.screenmerch.com, use it
        # Otherwise default to https://screenmerch.com
        if origin and origin.startswith('https://') and origin.endswith('.screenmerch.com'):
            # It's a subdomain, use it
            base_url = origin
        else:
            # Default to main domain
            base_url = 'https://screenmerch.com'
        
        # Build product URL with authentication parameters and category - redirect to frontend
        # Return merchandise categories page instead of specific product page
        merchandise_url = f"{base_url}/merchandise"
        if is_authenticated and user_email:
            merchandise_url += f"?authenticated=true&email={user_email}"
        
        response = jsonify({
            "success": True,
            "product_id": product_id,
            "product_url": merchandise_url
        })
        return response, 200
    except Exception as e:
        logger.error(f"❌ Error in create-product: {str(e)}")
        logger.error(f"❌ Error type: {type(e).__name__}")
        logger.error(f"❌ Full error details: {repr(e)}")
        response = jsonify(success=False, error="Internal server error")
        return _allow_origin(response), 500

@app.route("/product-new/<product_id>")
def show_product_page_new(product_id):
    logger.info(f"🔍 NEW ROUTE: Attempting to show product page for ID: {product_id}")
    
    # Get category parameter from query string
    category = request.args.get('category', 'all')
    logger.info(f"📂 Category filter: {category}")
    
    # Filter products by category using comprehensive mapping
    filtered_products = filter_products_by_category(category)
    logger.info(f"🔍 Filtered {len(filtered_products)} products for category '{category}'")
    
    try:
        # Try to get from Supabase first
        try:
            logger.info(f"📊 Querying Supabase for product {product_id}")
            result = supabase.table('products').select('*').eq('product_id', product_id).execute()
            logger.info(f"🧪 Raw Supabase result: {result}")

            logger.info(f"📊 Supabase query result: {len(result.data) if result.data else 0} records")
            
            if result.data:
                product_data = result.data[0]
                logger.info(f"✅ Found product in database: {product_data.get('name', 'No name')}")
                
                screenshots = []
                if product_data.get('screenshots_urls'):
                    try:
                        screenshots = json.loads(product_data.get('screenshots_urls'))
                        logger.info(f"📸 Parsed {len(screenshots)} screenshots")
                    except Exception as json_error:
                        logger.error(f"❌ JSON parsing error for screenshots: {str(json_error)}")
                        screenshots = []
                
                logger.info(f"📊 Product data summary:")
                logger.info(f"   name: {product_data.get('name', 'No name')}")
                logger.info(f"   screenshots: {len(screenshots)} items")
                logger.info(f"   products: {len(PRODUCTS)} items")
                logger.info(f"   product_id: {product_id}")
                
                try:
                    return render_template(
                        'product_page.html',
                        img_url=product_data.get('thumbnail_url'),
                        screenshots=screenshots,
                        products=filtered_products,
                        product_id=product_id,
                        email='',
                        channel_id='',
                        video_title=product_data.get('video_title', 'Unknown Video'),
                        creator_name=product_data.get('creator_name', 'Unknown Creator'),
                        video_url=product_data.get('video_url', 'Not provided'),
                        current_category=category,
                        timestamp=int(time.time()),
                        cache_buster=uuid.uuid4().hex[:8]
                    )
                except Exception as template_error:
                    logger.error(f"❌ Template rendering error: {str(template_error)}")
                    logger.error(f"❌ Template error type: {type(template_error).__name__}")
                    raise template_error
            else:
                logger.warning(f"⚠️ No product found in Supabase for ID: {product_id}")
        except Exception as supabase_error:
            logger.error(f"❌ Supabase error: {str(supabase_error)}")
            logger.error(f"❌ Supabase error type: {type(supabase_error).__name__}")
        
        # Fallback to in-memory storage
        if product_id in product_data_store:
            logger.info(f"🔄 Found product in memory storage")
            product_data = product_data_store[product_id]
            
            # Find the specific product data from PRODUCTS array
            specific_product = None
            for p in PRODUCTS:
                if p.get('name') == product_data.get('name'):
                    specific_product = p
                    break
            
            if not specific_product:
                # Fallback: create product data from memory storage
                specific_product = {
                    'name': product_data.get('name', 'Unknown Product'),
                    'price': product_data.get('price', 0),
                    'main_image': product_data.get('main_image', ''),
                    'filename': product_data.get('filename', ''),
                    'preview_image': product_data.get('preview_image', ''),
                    'options': product_data.get('options', {}),
                    'size_pricing': product_data.get('size_pricing', {}),
                    'size_color_availability': product_data.get('size_color_availability', {})
                }
            
            return render_template(
                'product_page.html',
                img_url=product_data.get('thumbnail'),
                screenshots=product_data.get('screenshots', []),
                products=filtered_products,
                product=specific_product,
                product_id=product_id,
                email='',
                channel_id='',
                video_title=product_data.get('video_title', 'Unknown Video'),
                creator_name=product_data.get('creator_name', 'Unknown Creator'),
                video_url=product_data.get('video_url', 'Not provided'),
                current_category=category,
                show_category_selection=True,
                timestamp=int(time.time()),
                cache_buster=uuid.uuid4().hex[:8]
            )
        else:
            logger.warning(f"⚠️ Product not found in memory storage either")
            
    except Exception as e:
        logger.error(f"❌ Error in show_product_page for {product_id}: {str(e)}")
        logger.error(f"❌ Error type: {type(e).__name__}")
        logger.error(f"❌ Full error details: {repr(e)}")

    logger.warning(f"⚠️ Product not found, but rendering template with default values")
    # Even if product is not found, render the template with default values
    return render_template(
        'product_page.html',
        img_url='',
        screenshots=[],
        products=filtered_products,
        product_id=product_id,
        email='',
        channel_id='',
        video_title='Unknown Video',
        creator_name='Unknown Creator',
        video_url='Not provided',
        current_category=category,
        timestamp=int(time.time()),
        cache_buster=uuid.uuid4().hex[:8]
    )

@app.route("/product/browse")
def show_browse_page():
    logger.info("🔍 Handling /product/browse redirect")

    category = request.args.get("category", "all")
    authenticated = request.args.get("authenticated", "false")
    email = request.args.get("email", "")

    frontend_url = "https://screenmerch.com"
    redirect_url = (
        f"{frontend_url}/product/browse"
        f"?category={category}&authenticated={authenticated}&email={email}"
    )

    logger.info(f"🔄 Redirecting to frontend: {redirect_url}")

    response = redirect(redirect_url, code=302)
    response.headers.update({
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
    })
    return response

@app.route("/product/<product_id>")
def show_product_page(product_id):
    logger.info(f"🔍 Redirecting product page for ID: {product_id} to React frontend")
    
    # Get query parameters
    category = request.args.get('category', 'all')
    authenticated = request.args.get('authenticated', 'false')
    email = request.args.get('email', '')
    
    # Build redirect URL to React frontend
    frontend_url = "https://screenmerch.com"
    redirect_url = f"{frontend_url}/product/{product_id}?category={category}&authenticated={authenticated}&email={email}"
    
    logger.info(f"🔄 Redirecting to: {redirect_url}")
    
    # Create redirect response with no-cache headers
    response = redirect(redirect_url)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route("/checkout/<product_id>")
def checkout_page(product_id):
    logger.info(f"🔍 Checkout page requested for product ID: {product_id}")
    
    # For dynamic products, we don't need to fetch from database
    # The product data will come from the frontend session storage
    product_data = {
        'product_id': product_id,
        'video_title': 'Dynamic Product',
        'creator_name': 'ScreenMerch Creator'
    }
    
    return render_template('checkout.html', product_id=product_id, product_data=product_data)

@app.route("/login")
def login_page():
    return render_template('login.html')

@app.route("/privacy-policy")
def privacy_policy():
    return render_template('privacy-policy.html')

@app.route("/terms-of-service")
def terms_of_service():
    return render_template('terms-of-service.html')

def record_sale(item, user_id=None, friend_id=None, channel_id=None, order_id=None):
    from datetime import datetime
    from urllib.parse import urlparse
    
    # Get the correct price - try item price first, then look up in PRODUCTS
    item_price = item.get('price')
    if not item_price or item_price <= 0:
        # Look up price in PRODUCTS array
        product_info = next((p for p in PRODUCTS if p["name"] == item.get("product")), None)
        if not product_info:
            # Try case-insensitive match
            product_info = next((p for p in PRODUCTS if p["name"].lower() == item.get("product", "").lower()), None)
        
        item_price = product_info["price"] if product_info else 0
    
    # IMPORTANT: Look up creator's user_id from subdomain if request is from a subdomain
    # This ensures precise tracking for analytics when purchases are made on subdomains
    creator_user_id = user_id
    creator_name = item.get('creator_name', '')
    
    logger.info(f"🔍 [RECORD_SALE] Starting with user_id={user_id}, creator_name={creator_name}")
    
    # First, try to get user_id from subdomain in the request origin
    # NOTE: This only works for direct requests, not webhooks (webhooks don't have Origin header)
    if not creator_user_id:
        try:
            origin = request.headers.get('Origin', '')
            if origin and origin.endswith('.screenmerch.com') and origin.startswith('https://'):
                # Extract subdomain from origin (e.g., testcreator.screenmerch.com -> testcreator)
                parsed = urlparse(origin)
                hostname = parsed.netloc
                subdomain = hostname.replace('.screenmerch.com', '').lower()
                
                if subdomain and subdomain != 'www':
                    # Look up creator by subdomain
                    creator_result = supabase_admin.table('users').select('id, display_name').eq('subdomain', subdomain).limit(1).execute()
                    
                    if creator_result.data and len(creator_result.data) > 0:
                        creator_user_id = creator_result.data[0]['id']
                        creator_name = creator_result.data[0].get('display_name', creator_name)
                        logger.info(f"✅ Found creator user_id from subdomain '{subdomain}': {creator_user_id}")
        except Exception as subdomain_error:
            logger.warning(f"⚠️ Error looking up creator from subdomain: {subdomain_error}")
    
    # Fallback: Look up creator's user_id if not provided but creator_name is available
    # This ensures precise tracking for analytics
    if not creator_user_id and creator_name and creator_name != 'Unknown Creator':
        try:
            # Try to find creator by display_name or username (case-insensitive)
            creator_result = supabase_admin.table('users').select('id').or_(
                f"display_name.ilike.{creator_name},username.ilike.{creator_name}"
            ).limit(1).execute()
            
            if creator_result.data and len(creator_result.data) > 0:
                creator_user_id = creator_result.data[0]['id']
                logger.info(f"✅ Found creator user_id for '{creator_name}': {creator_user_id}")
            else:
                logger.warning(f"⚠️ Could not find user_id for creator '{creator_name}' - sale will be recorded without user_id")
        except Exception as lookup_error:
            logger.error(f"Error looking up creator user_id for '{creator_name}': {lookup_error}")
    
    # Log final creator_user_id before saving
    if creator_user_id:
        logger.info(f"✅ [RECORD_SALE] Recording sale with creator_user_id: {creator_user_id}, product: {item.get('product', 'N/A')}, amount: ${item_price}")
    else:
        logger.warning(f"⚠️ [RECORD_SALE] Recording sale WITHOUT creator_user_id! Product: {item.get('product', 'N/A')}, amount: ${item_price}")
        logger.warning(f"⚠️ [RECORD_SALE] This sale will NOT appear in creator analytics dashboard!")
    
    sale_data = {
        "user_id": creator_user_id,  # Use looked-up creator user_id for precise tracking
        "product_id": item.get('product_id', ''),
        "product_name": item.get('product', ''),
        "video_id": item.get('video_id', ''),
        "video_title": item.get('video_title', ''),
        "video_url": item.get('video_url', ''),
        "creator_name": creator_name,
        "screenshot_timestamp": item.get('screenshot_timestamp', ''),
        "image_url": item.get('img', ''),
        "amount": item_price,
        "friend_id": friend_id,
        "channel_id": channel_id  # Now that column is VARCHAR(255), string values work correctly
    }
    try:
        # Use service role client to bypass RLS for precise tracking
        client_to_use = supabase_admin if supabase_admin else supabase
        client_to_use.table('sales').insert(sale_data).execute()
        logger.info(f"✅ Recorded sale with precise tracking: product={sale_data['product_name']}, creator_user_id={creator_user_id}, amount=${item_price}")
        
        # Create creator earnings record if creator_user_id exists and they are a creator
        if creator_user_id:
            try:
                # Check if user is a creator
                user_result = client_to_use.table('users').select('role').eq('id', creator_user_id).single().execute()
                if user_result.data and user_result.data.get('role') == 'creator':
                    # Calculate earnings (70% creator, 30% platform)
                    creator_share = item_price * 0.70
                    platform_fee = item_price * 0.30
                    
                    # Get order_id from item if available, otherwise generate one (shorter format)
                    fallback_id = f"ORD-{str(uuid.uuid4())[:8].upper()}"
                    order_id = item.get('order_id', sale_data.get('order_id', fallback_id))
                    
                    # Get order_id from parameter or item, otherwise generate one (shorter format)
                    earnings_order_id = order_id or item.get('order_id') or sale_data.get('order_id') or fallback_id
                    
                    # Create earnings record
                    earnings_data = {
                        "user_id": creator_user_id,
                        "order_id": earnings_order_id,
                        "product_name": sale_data['product_name'],
                        "sale_amount": item_price,
                        "creator_share": creator_share,
                        "platform_fee": platform_fee,
                        "status": "pending"
                    }
                    
                    client_to_use.table('creator_earnings').insert(earnings_data).execute()
                    logger.info(f"✅ Created creator earnings: user_id={creator_user_id}, amount=${item_price}, creator_share=${creator_share}")
            except Exception as earnings_error:
                logger.error(f"❌ Error creating creator earnings: {str(earnings_error)}")
                # Don't fail the sale if earnings creation fails
    except Exception as e:
        logger.error(f"❌ Error recording sale: {str(e)}")
        # Try fallback with regular client
        try:
            supabase.table('sales').insert(sale_data).execute()
            logger.info(f"✅ Recorded sale (fallback): {sale_data}")
        except Exception as e2:
            logger.error(f"❌ Error recording sale (fallback): {str(e2)}")

@app.route("/send-order", methods=["POST"])
def send_order():
    try:
        data = request.get_json()
        cart = data.get("cart", [])
        if not cart:
            return jsonify({"success": False, "error": "Cart is empty"}), 400
        
        # Validate color-size availability for each cart item
        for item in cart:
            product_name = item.get('product', '')
            color = item.get('variants', {}).get('color', '')
            size = item.get('variants', {}).get('size', '')
            
            # Check Women's Ribbed Neck availability
            if product_name == "Women's Ribbed Neck":
                # Colors that are NOT available in XXXL, XXXXL, XXXXXL
                restricted_colors = [
                    "Dark Heather Grey", "Burgundy", "India Ink Grey", "Anthracite",
                    "Red", "Stargazer", "Khaki", "Desert Dust", "Fraiche Peche",
                    "Cotton Pink", "Lavender"
                ]
                
                # Sizes that are restricted for certain colors
                restricted_sizes = ["XXXL", "XXXXL", "XXXXXL"]
                
                if color in restricted_colors and size in restricted_sizes:
                    return jsonify({
                        "success": False,
                        "error": f"{color} is not available in size {size} for Women's Ribbed Neck. Please select a different size or color."
                    }), 400
            
            # Check Cropped Hoodie availability
            if product_name == "Cropped Hoodie":
                # Black is NOT available in XL and XXL
                if color == "Black" and size in ["XL", "XXL"]:
                    return jsonify({
                        "success": False,
                        "error": f"{color} is not available in size {size} for Cropped Hoodie. Please select a different size or color."
                    }), 400
                
                # Peach is ONLY available in XL
                if color == "Peach" and size != "XL":
                    return jsonify({
                        "success": False,
                        "error": f"{color} is only available in size XL for Cropped Hoodie. Please select XL or a different color."
                    }), 400
            
            # Check Women's Crop Top availability
            if product_name == "Women's Crop Top":
                # Bubblegum is out of stock
                if color == "Bubblegum":
                    return jsonify({
                        "success": False,
                        "error": f"{color} is currently out of stock for Women's Crop Top. Please select a different color."
                    }), 400
            
            # Check Unisex T-Shirt availability
            if product_name == "Unisex T-Shirt":
                # Colors not available in XS
                unavailable_in_xs = [
                    "Heather Midnight Navy", "True Royal", "Asphalt", "Heather True Royal",
                    "Mauve", "Forest", "Heather Forest", "Olive", "Heather Deep Teal"
                ]
                if color in unavailable_in_xs and size == "XS":
                    return jsonify({
                        "success": False,
                        "error": f"{color} is not available in size XS for Unisex T-Shirt. Please select a different size or color."
                    }), 400
                
                # Colors not available in 5XL (XXXXXL)
                unavailable_in_5xl = [
                    "Heather Midnight Navy", "True Royal", "Asphalt", "Heather True Royal",
                    "Heather Prism Lilac", "Soft Cream", "Heather Prism Ice Blue", "Mauve",
                    "Forest", "Heather Forest", "Olive", "Heather Deep Teal"
                ]
                if color in unavailable_in_5xl and size == "XXXXXL":
                    return jsonify({
                        "success": False,
                        "error": f"{color} is not available in size 5XL for Unisex T-Shirt. Please select a different size or color."
                    }), 400

        # --- Email Formatting ---
        html_body = "<h1>New ScreenMerch Order</h1>"
        sms_body = "New Order Received!\n"
        for item in cart:
            product_name = item.get('product', 'N/A')
            variants = item.get('variants', {})
            color = variants.get('color', 'N/A')
            size = variants.get('size', 'N/A')
            note = item.get('note', 'None')
            image_url = item.get('img', '')

            html_body += f"""
                <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                    <h2>{product_name}</h2>
                    <p><strong>Color:</strong> {color}</p>
                    <p><strong>Size:</strong> {size}</p>
                    <p><strong>Note:</strong> {note}</p>
                    <p><strong>Image:</strong></p>
                    <img src='{image_url}' alt='Product Image' style='max-width: 300px; border-radius: 6px;'>
                </div>
            """
            sms_body += f"Product: {product_name}, Color: {color}, Size: {size}, Note: {note}, Image: {image_url}\n"
        # Generate order ID and order number (shorter format for easier record keeping)
        full_uuid = str(uuid.uuid4())
        order_id = f"ORD-{full_uuid[:8].upper()}"  # Short format: ORD-XXXXXXXX
        order_number = order_id
        
        # Enrich cart items with video metadata
        enriched_cart = []
        for item in cart:
            enriched_item = item.copy()
            # Add video metadata to each cart item
            enriched_item.update({
                "videoName": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                "creatorName": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
                "timestamp": data.get("screenshot_timestamp", data.get("timestamp", "Not provided"))
            })
            enriched_cart.append(enriched_item)
        
        # Extract subdomain from request origin to store with order
        creator_user_id_from_subdomain = None
        subdomain_from_request = None
        try:
            origin = request.headers.get('Origin', '')
            if origin and origin.endswith('.screenmerch.com') and origin.startswith('https://'):
                from urllib.parse import urlparse
                parsed = urlparse(origin)
                hostname = parsed.netloc
                subdomain_from_request = hostname.replace('.screenmerch.com', '').lower()
                
                if subdomain_from_request and subdomain_from_request != 'www':
                    # Look up creator by subdomain
                    creator_result = supabase_admin.table('users').select('id, display_name').eq('subdomain', subdomain_from_request).limit(1).execute()
                    
                    if creator_result.data and len(creator_result.data) > 0:
                        creator_user_id_from_subdomain = creator_result.data[0]['id']
                        logger.info(f"✅ [SEND-ORDER] Found creator user_id from subdomain '{subdomain_from_request}': {creator_user_id_from_subdomain}")
        except Exception as subdomain_error:
            logger.warning(f"⚠️ [SEND-ORDER] Error looking up creator from subdomain: {subdomain_error}")
        
        # Store order in order_store for admin dashboard
        order_store[order_id] = {
            "cart": enriched_cart,
            "timestamp": data.get("timestamp"),
            "order_id": order_id,
            "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
            "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
            "creator_user_id": creator_user_id_from_subdomain,  # Store creator user_id for webhook
            "subdomain": subdomain_from_request,  # Store subdomain for reference
            "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
            "screenshot_timestamp": data.get("screenshot_timestamp", data.get("timestamp", "Not provided")),
            "status": "pending",
            "created_at": data.get("created_at", "Recent")
        }
        
        # Record each sale with video metadata
        for item in cart:
            # Add video metadata to each item if available
            if 'video_url' in data:
                item['video_url'] = data['video_url']
            if 'video_title' in data:
                item['video_title'] = data['video_title']
            if 'creator_name' in data:
                item['creator_name'] = data['creator_name']
            if 'screenshot_timestamp' in data:
                item['screenshot_timestamp'] = data['screenshot_timestamp']
            # Pass creator_user_id if we found it from subdomain
            record_sale(item, user_id=creator_user_id_from_subdomain, order_id=order_id)
        # --- Send Email with Resend ---
        email_data = {
            "from": RESEND_FROM,
            "to": [MAIL_TO],
            "subject": f"🛍️ New ScreenMerch Order #{order_number}",
            "html": f"""
                    <h2>New Order Received!</h2>
                    <p><strong>Order ID:</strong> {order_number}</p>
                    <p><strong>Items:</strong> {len(cart)}</p>
                    <p><strong>Total Value:</strong> ${sum([next((p['price'] for p in PRODUCTS if p['name'] == item.get('product')), 0) for item in cart]):.2f}</p>
                    <br>
                    <hr>
                    <h2>📹 Video Information</h2>
                    <p><strong>Video Title:</strong> {data.get("videoTitle", data.get("video_title", "Unknown Video"))}</p>
                    <p><strong>Creator:</strong> {data.get("creatorName", data.get("creator_name", "Unknown Creator"))}</p>
                    <p><strong>Video URL:</strong> {data.get("videoUrl", data.get("video_url", "Not provided"))}</p>
                    <p><strong>Screenshot Timestamp:</strong> {data.get("screenshot_timestamp", data.get("timestamp", "Not provided"))} seconds</p>
                    <br>
                    <p><strong>📋 View Full Order Details:</strong></p>
                    <p><a href="https://screenmerch.fly.dev/admin/order/{order_id}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order Details</a></p>
                    <br>
                    <p><strong>📊 All Orders Dashboard:</strong></p>
                    <p><a href="https://screenmerch.fly.dev/admin/orders" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View All Orders</a></p>
                    <br>
                    <hr>
                    <h2>🖨️ Print Quality Images</h2>
                    <p><strong>For Printify Upload:</strong></p>
                    <p>Use the print quality generator to get 300 DPI images:</p>
                    <p><strong>Web Interface:</strong> <a href="https://screenmerch.fly.dev/print-quality?order_id={order_id}">https://screenmerch.fly.dev/print-quality?order_id={order_id}</a></p>
                    <p>This will generate professional print-ready images (2400x3000+ pixels, PNG format)</p>
                    <br>
                    <p><small>This is an automated notification from ScreenMerch</small></p>
                """
            }
        
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json"
            },
            json=email_data
        )

        # --- Send SMS Notification ---
        send_order_email(sms_body)

        if response.status_code != 200:
            logger.error(f"Resend API error: {response.text}")
            return jsonify({"success": False, "error": "Failed to send order email"}), 500

        # Optional: create a Stripe checkout session as fallback so legacy frontend can redirect
        next_url = None
        try:
            shipping_cost = data.get("shipping_cost", 0) or 0
            # Build line items (mirror logic from create_checkout_session)
            line_items = []
            for item in cart:
                item_price = item.get('price')
                if item_price and item_price > 0:
                    unit_amount = int(item_price * 100)
                    name = item.get("product") or item.get("name") or "Item"
                else:
                    product_info = next((p for p in PRODUCTS if p["name"].lower() == (item.get("product") or "").lower()), None)
                    if not product_info:
                        continue
                    unit_amount = int(product_info["price"] * 100)
                    name = product_info["name"]
                line_items.append({
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": name},
                        "unit_amount": unit_amount,
                    },
                    "quantity": 1,
                })
            if shipping_cost and shipping_cost > 0:
                line_items.append({
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": "Shipping"},
                        "unit_amount": int(shipping_cost * 100),
                    },
                    "quantity": 1,
                })

            if line_items:
                # Ensure we're using test mode Stripe key
                ensure_stripe_test_mode()
                
                # Detect the origin/subdomain from the request to preserve it
                origin = request.headers.get('Origin', 'https://screenmerch.com')
                # Extract the base URL (protocol + host) from origin
                # If origin is a subdomain like https://testcreator.screenmerch.com, use it
                # Otherwise default to https://screenmerch.com
                if origin and origin.startswith('https://') and origin.endswith('.screenmerch.com'):
                    # It's a subdomain, use it
                    base_url = origin
                else:
                    # Default to main domain
                    base_url = 'https://screenmerch.com'
                
                session = stripe.checkout.Session.create(
                    payment_method_types=["card"],
                    mode="payment",
                    line_items=line_items,
                    success_url=f"{base_url}/order-success?order_id={order_id}",
                    cancel_url=f"{base_url}/checkout",
                    phone_number_collection={"enabled": True},
                    payment_intent_data={
                        "statement_descriptor": "ScreenMerch"
                    },
                    metadata={
                        "order_id": order_id,
                        "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
                        "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                        "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
                    },
                )
                next_url = session.url
        except Exception as e:
            logger.error(f"Stripe fallback session error: {str(e)}")

        response = jsonify({
            "success": True,
            "message": "Order sent successfully. Cart will be cleared on the frontend.",
            "clear_cart": True,
            "next_url": next_url
        })
        origin = request.headers.get('Origin', '*')
        response.headers.add('Vary', 'Origin')
        return response

    except Exception as e:
        logger.error(f"Error in send_order: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route("/api/place-order", methods=["POST", "OPTIONS"])
def place_order():
    """Place an order - validates ZIP code requirement
    
    Simple place-order endpoint for frontend.
    - Accepts cart items, totals, shipping info, and selected screenshot/thumbnail
    - Persists to Supabase `orders` when available; falls back to in-memory `order_store`
    - Sends email including a link to the print-quality page
    - Returns { success: true, order_id }
    """
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        origin = request.headers.get('Origin', '*')
        response.headers.add('Vary', 'Origin')
        return response

    try:
        # Use robust JSON reader
        data = read_json()
        
        cart = data.get("cart", [])
        shipping_cost = data.get("shipping_cost", data.get("shipping", {}).get("cost", 0)) or 0
        total_amount = data.get("total", 0) or sum(item.get('price', 0) for item in cart) + (shipping_cost or 0)

        if not cart:
            return jsonify({"success": False, "error": "Cart is empty"}), 400
        
        # Validate color-size availability for each cart item
        for item in cart:
            product_name = item.get('product', '')
            color = item.get('variants', {}).get('color', '')
            size = item.get('variants', {}).get('size', '')
            
            # Check Women's Ribbed Neck availability
            if product_name == "Women's Ribbed Neck":
                # Colors that are NOT available in XXXL, XXXXL, XXXXXL
                restricted_colors = [
                    "Dark Heather Grey", "Burgundy", "India Ink Grey", "Anthracite",
                    "Red", "Stargazer", "Khaki", "Desert Dust", "Fraiche Peche",
                    "Cotton Pink", "Lavender"
                ]
                
                # Sizes that are restricted for certain colors
                restricted_sizes = ["XXXL", "XXXXL", "XXXXXL"]
                
                if color in restricted_colors and size in restricted_sizes:
                    return jsonify({
                        "success": False,
                        "error": f"{color} is not available in size {size} for Women's Ribbed Neck. Please select a different size or color."
                    }), 400
            
            # Check Cropped Hoodie availability
            if product_name == "Cropped Hoodie":
                # Black is NOT available in XL and XXL
                if color == "Black" and size in ["XL", "XXL"]:
                    return jsonify({
                        "success": False,
                        "error": f"{color} is not available in size {size} for Cropped Hoodie. Please select a different size or color."
                    }), 400
                
                # Peach is ONLY available in XL
                if color == "Peach" and size != "XL":
                    return jsonify({
                        "success": False,
                        "error": f"{color} is only available in size XL for Cropped Hoodie. Please select XL or a different color."
                    }), 400
            
            # Check Women's Crop Top availability
            if product_name == "Women's Crop Top":
                # Bubblegum is out of stock
                if color == "Bubblegum":
                    return jsonify({
                        "success": False,
                        "error": f"{color} is currently out of stock for Women's Crop Top. Please select a different color."
                    }), 400
            
            # Check Unisex T-Shirt availability
            if product_name == "Unisex T-Shirt":
                # Colors not available in XS
                unavailable_in_xs = [
                    "Heather Midnight Navy", "True Royal", "Asphalt", "Heather True Royal",
                    "Mauve", "Forest", "Heather Forest", "Olive", "Heather Deep Teal"
                ]
                if color in unavailable_in_xs and size == "XS":
                    return jsonify({
                        "success": False,
                        "error": f"{color} is not available in size XS for Unisex T-Shirt. Please select a different size or color."
                    }), 400
                
                # Colors not available in 5XL (XXXXXL)
                unavailable_in_5xl = [
                    "Heather Midnight Navy", "True Royal", "Asphalt", "Heather True Royal",
                    "Heather Prism Lilac", "Soft Cream", "Heather Prism Ice Blue", "Mauve",
                    "Forest", "Heather Forest", "Olive", "Heather Deep Teal"
                ]
                if color in unavailable_in_5xl and size == "XXXXXL":
                    return jsonify({
                        "success": False,
                        "error": f"{color} is not available in size 5XL for Unisex T-Shirt. Please select a different size or color."
                    }), 400
        
        # Validate shipping address using robust function
        ok, addr_result = require_shipping_address(data)
        if not ok:
            logger.error(f"❌ Shipping address validation failed: {addr_result}")
            return jsonify({"success": False, "error": addr_result}), 400
        
        shipping_address = addr_result
        logger.info(f"✅ Shipping address validated: {shipping_address}")

        # Generate order identifiers (shorter format for easier record keeping)
        full_uuid = str(uuid.uuid4())
        order_id = f"ORD-{full_uuid[:8].upper()}"  # Short format: ORD-XXXXXXXX
        order_number = order_id

        # Normalize items to expected structure
        # CRITICAL: Strip base64 images from cart items to reduce payload size
        normalized_cart = []
        for item in cart:
            # Support both existing structure and simplified frontend items
            product_name = item.get('product') or item.get('name') or 'N/A'
            variants = item.get('variants') or {
                'color': item.get('color'),
                'size': item.get('size')
            }
            # Create clean item WITHOUT base64 images
            normalized_item = {
                'product': product_name,
                'variants': variants,
                'price': item.get('price', 0),
                'note': item.get('note', '')
            }
            # Only include non-image fields
            for key, value in item.items():
                if key not in ['img', 'image', 'screenshot', 'selected_screenshot', 'thumbnail']:
                    if key not in normalized_item:  # Don't overwrite already set fields
                        normalized_item[key] = value
            normalized_cart.append(normalized_item)
            logger.info(f"✅ Cleaned cart item: removed base64 images, kept only essential fields")

        # Get screenshot from top-level payload BEFORE enriching cart
        # This is the selected screenshot for the product that should be stored
        top_level_screenshot = data.get("selected_screenshot") or data.get("thumbnail") or data.get("screenshot")
        
        # Enrich cart items with video metadata when provided
        enriched_cart = []
        for item in normalized_cart:
            enriched_item = item.copy()
            enriched_item.update({
                "videoName": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                "creatorName": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
                "timestamp": data.get("screenshot_timestamp", data.get("timestamp", "Not provided")),
                # Store screenshot at cart item level so it can be retrieved later
                "selected_screenshot": top_level_screenshot or data.get("selected_screenshot") or data.get("thumbnail")
            })
            enriched_cart.append(enriched_item)
            
        logger.info(f"✅ Stored screenshot in enriched_cart items: {bool(top_level_screenshot)}")

        # Extract subdomain from request origin to store with order
        creator_user_id_from_subdomain = None
        subdomain_from_request = None
        try:
            origin = request.headers.get('Origin', '')
            if origin and origin.endswith('.screenmerch.com') and origin.startswith('https://'):
                from urllib.parse import urlparse
                parsed = urlparse(origin)
                hostname = parsed.netloc
                subdomain_from_request = hostname.replace('.screenmerch.com', '').lower()
                
                if subdomain_from_request and subdomain_from_request != 'www':
                    # Look up creator by subdomain
                    creator_result = supabase_admin.table('users').select('id, display_name').eq('subdomain', subdomain_from_request).limit(1).execute()
                    
                    if creator_result.data and len(creator_result.data) > 0:
                        creator_user_id_from_subdomain = creator_result.data[0]['id']
                        logger.info(f"✅ [PLACE-ORDER] Found creator user_id from subdomain '{subdomain_from_request}': {creator_user_id_from_subdomain}")
        except Exception as subdomain_error:
            logger.warning(f"⚠️ [PLACE-ORDER] Error looking up creator from subdomain: {subdomain_error}")
        
        # Prepare DB payload restricted to known columns
        # Also store screenshot at order level for easy retrieval
        user_email_from_data = data.get("user_email", "")
        customer_email_from_data = data.get("customer_email", "")
        logger.info(f"📧 [ORDER] Email from request - user_email: '{user_email_from_data}', customer_email: '{customer_email_from_data}'")
        order_data = {
            "order_id": order_id,
            "cart": enriched_cart,
            "sms_consent": data.get("sms_consent", False),
            "customer_email": data.get("user_email", data.get("customer_email", "")),
            "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
            "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
            "creator_user_id": creator_user_id_from_subdomain,  # Store creator user_id for webhook
            "subdomain": subdomain_from_request,  # Store subdomain for reference
            "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
            "total_amount": total_amount,
            "shipping_cost": shipping_cost,
            "shipping_address": shipping_address,  # Store shipping address for future reference
            "status": "pending",
        }
        
        # Store screenshot at order level too (for get-order-screenshot endpoint)
        if top_level_screenshot:
            order_data["selected_screenshot"] = top_level_screenshot
            logger.info(f"✅ Stored screenshot at order level for retrieval")

        # Try database first; fallback to in-memory store
        stored_in_db = False
        try:
            # Log what we're trying to save for debugging
            logger.info(f"💾 [PLACE-ORDER] Saving order to database with creator_user_id: {creator_user_id_from_subdomain}, subdomain: {subdomain_from_request}")
            supabase.table('orders').insert(order_data).execute()
            stored_in_db = True
            logger.info(f"✅ Order {order_id} stored in database with creator tracking")
        except Exception as db_error:
            logger.error(f"❌ Failed to store order in database: {str(db_error)}")
            logger.error(f"❌ Order data keys being saved: {list(order_data.keys())}")
            logger.error(f"❌ creator_user_id value: {creator_user_id_from_subdomain}")
            logger.error(f"❌ subdomain value: {subdomain_from_request}")

        # Always keep an in-memory backup for admin dashboard/tools
        order_store[order_id] = {
            "cart": enriched_cart,
            "timestamp": data.get("timestamp"),
            "order_id": order_id,
            "video_title": order_data["video_title"],
            "creator_user_id": creator_user_id_from_subdomain,  # Store creator user_id for webhook
            "subdomain": subdomain_from_request,  # Store subdomain for reference
            "creator_user_id": creator_user_id_from_subdomain,  # Store creator user_id for webhook
            "subdomain": subdomain_from_request,  # Store subdomain for reference
            "creator_name": order_data["creator_name"],
            "video_url": order_data["video_url"],
            "screenshot_timestamp": data.get("screenshot_timestamp", data.get("timestamp", "Not provided")),
            "status": "pending",
            "created_at": data.get("created_at", "Recent"),
        }

        # Build email body
        html_body = f"<h1>New ScreenMerch Order #{order_number}</h1>"
        html_body += f"<p><strong>Order ID:</strong> {order_id}</p>"
        html_body += f"<p><strong>Items:</strong> {len(enriched_cart)}</p>"
        html_body += f"<p><strong>Total Value:</strong> ${total_amount:.2f}</p>"
        html_body += "<br>"

        # Collect images for email attachments (CID embedding)
        email_attachments = []
        attachment_cids = {}
        
        # Get screenshot from top-level payload (not from cart items, which are cleaned)
        # This is the selected screenshot for the product
        top_level_screenshot = data.get("selected_screenshot") or data.get("thumbnail") or data.get("screenshot")
        
        # Also check enriched_cart items for screenshot (might be stored there)
        if not top_level_screenshot and enriched_cart:
            for item in enriched_cart:
                if item.get("selected_screenshot"):
                    top_level_screenshot = item.get("selected_screenshot")
                    logger.info(f"📸 Found screenshot in enriched_cart item")
                    break
        
        # Log what we found
        if top_level_screenshot:
            screenshot_len = len(str(top_level_screenshot))
            logger.info(f"📸 Found screenshot (length: {screenshot_len} chars)")
            if isinstance(top_level_screenshot, str) and top_level_screenshot.startswith('data:image'):
                logger.info(f"📸 Screenshot is base64 data URL")
                # Log first 100 chars to verify format
                logger.info(f"📸 Screenshot preview: {top_level_screenshot[:100]}...")
            elif isinstance(top_level_screenshot, str) and (top_level_screenshot.startswith('http') or top_level_screenshot.startswith('https')):
                logger.info(f"📸 Screenshot is URL: {top_level_screenshot[:100] if screenshot_len > 100 else top_level_screenshot}")
            else:
                logger.info(f"📸 Screenshot type: {type(top_level_screenshot)}, preview: {str(top_level_screenshot)[:100]}")
        else:
            logger.warning(f"⚠️ No top-level screenshot found in payload")
            logger.warning(f"⚠️ Payload keys: {list(data.keys())}")
            logger.warning(f"⚠️ First cart item keys: {list(enriched_cart[0].keys()) if enriched_cart else 'No cart items'}")
        
        # Track unique screenshots to avoid duplicates
        unique_screenshots = {}  # Maps screenshot URL/data to CID
        screenshot_used = False  # Track if we've added the screenshot to email
        
        for idx, item in enumerate(enriched_cart):
            product_name = item.get('product', 'N/A')
            color = (item.get('variants') or {}).get('color', 'N/A')
            size = (item.get('variants') or {}).get('size', 'N/A')
            note = item.get('note', 'None')
            
            # Use top-level screenshot for all items (same product, same screenshot)
            # Only check cart item fields as fallback if top-level is missing
            image_url = top_level_screenshot or item.get('screenshot') or item.get('selected_screenshot') or item.get('thumbnail') or item.get('img', '')
            
            # Handle data URLs (base64 images) - convert to attachments
            image_tag = ""
            print_quality_info = ""
            download_link = ""
            
            # CRITICAL: Only add image ONCE per order, not per cart item
            # This ensures one image per order, not multiple images for multiple products
            if image_url and not screenshot_used:
                if image_url.startswith('data:image'):
                    # Send original screenshot as-is (no automatic 300 DPI upgrade)
                    # Admin will manually process through 300 DPI generator
                    logger.info(f"📸 [EMAIL] Adding screenshot for order (one image total, not per item)")
                    
                    # Data URL - convert to attachment for email
                    try:
                        # Parse data URL: data:image/png;base64,<data>
                        header, data = image_url.split(',', 1)
                        image_format = header.split('/')[1].split(';')[0]  # png, jpeg, etc.
                        image_data = data
                        
                        # Generate CID for embedding (use order_id, not item index)
                        cid = f"screenshot_{order_id}_0"
                        attachment_cids[0] = cid
                        
                        # Add as attachment (Resend format: content should be base64 string)
                        # Only add once per order
                        if cid not in [att.get('cid') for att in email_attachments]:
                            email_attachments.append({
                                "filename": f"screenshot.{image_format}",
                                "content": image_data,  # Already base64 encoded from data URL
                                "cid": cid
                            })
                            screenshot_used = True  # Mark as used so we don't add again
                            logger.info(f"✅ Added screenshot attachment with CID: {cid}")
                        
                        # Use CID attachment method (like thumbnails) - Gmail blocks base64 images in body
                        # CID embedding shows image in email body via attachment, matching thumbnail behavior
                        cid_img_tag = f"<img src='cid:{cid}' alt='Product Screenshot' style='max-width: 300px; border-radius: 6px; border: 1px solid #ddd;'>"
                        
                        # Use CID method to match how thumbnails (URLs) are displayed
                        image_tag = f"{cid_img_tag}"
                        logger.info(f"✅ Converted data URL to attachment CID: {cid}")
                    except Exception as e:
                        logger.warning(f"⚠️ Failed to convert data URL to attachment: {str(e)}")
                        # Fallback: just provide a note
                        image_tag = "<p><em>Screenshot available in order details</em></p>"
                        screenshot_used = True  # Mark as used even on error
                else:
                    # Regular URL - use directly (only once)
                    image_tag = f"<img src='{image_url}' alt='Product Image' style='max-width: 300px; border-radius: 6px;'>"
                    screenshot_used = True  # Mark as used
            
            # Only show image for the FIRST item to avoid duplicates
            # All items share the same screenshot, so only display it once
            if idx == 0:
                html_body += f"""
                    <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                        <h2>📸 Order Screenshot</h2>
                        {image_tag if image_tag else "<p><em>Screenshot available in order details</em></p>"}
                    </div>
                """
            
            # Add product details for each item (but image only once above)
            html_body += f"""
                <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                    <h2>{product_name}</h2>
                    <p><strong>Color:</strong> {color}</p>
                    <p><strong>Size:</strong> {size}</p>
                    <p><strong>Note:</strong> {note}</p>
                    {print_quality_info}
                    {download_link}
                </div>
            """

        html_body += "<hr>"
        html_body += "<h2>📹 Video Information</h2>"
        html_body += f"<p><strong>Video Title:</strong> {order_data['video_title']}</p>"
        html_body += f"<p><strong>Creator:</strong> {order_data['creator_name']}</p>"
        html_body += f"<p><strong>Video URL:</strong> {order_data['video_url']}</p>"
        html_body += f"<p><strong>Screenshot Timestamp:</strong> {order_store[order_id]['screenshot_timestamp']} seconds</p>"
        html_body += "<br>"
        
        # Add action buttons section with better email client compatibility (matching webhook email format)
        html_body += f"""
            <hr>
            <h2>🚀 Order Management & Print Quality</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                    <td align="center">
                        <table cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="padding: 10px;">
                                    <a href="https://screenmerch.fly.dev/admin/order/{order_id}" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">📋 View Order Details</a>
                                </td>
                                <td style="padding: 10px;">
                                    <a href="https://screenmerch.fly.dev/print-quality?order_id={order_id}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">🖨️ Generate Print Quality Images</a>
                                </td>
                            </tr>
                            <tr>
                                <td colspan="2" style="padding: 10px; text-align: center;">
                                    <a href="https://screenmerch.fly.dev/admin/orders" style="background: #6c757d; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">📊 View All Orders</a>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>📝 Quick Instructions:</h3>
                <ol>
                    <li><strong>View Order:</strong> Click "View Order Details" to see full order information</li>
                    <li><strong>Print Quality:</strong> Use "Generate Print Quality Images" to process images to 300 DPI and apply additional processing (edge feather, corner radius, etc.)</li>
                    <li><strong>Video URL:</strong> The print quality tool will automatically load the order details, or you can copy the video URL from order details</li>
                    <li><strong>Timestamp:</strong> The screenshot timestamp is shown above and will be used in the print quality tool</li>
                </ol>
            </div>
            <hr>
            <p><small>This is an automated notification from ScreenMerch</small></p>
        """

        # Send email with Resend if configured; fall back to logging
        logger.info(f"📧 Email configuration check: RESEND_API_KEY={'SET' if RESEND_API_KEY else 'NOT SET'}, MAIL_TO={'SET' if MAIL_TO else 'NOT SET'}")
        
        if RESEND_API_KEY and MAIL_TO:
            email_data = {
                "from": RESEND_FROM,
                "to": [MAIL_TO],
                "subject": f"🛍️ New ScreenMerch Order #{order_number}",
                "html": html_body,
            }
            
            # Add attachments if any (for base64 screenshots)
            # Resend format: attachments array with filename, content (base64 string), and optional path/contentId
            if email_attachments:
                # Convert to Resend format: need to ensure contentId matches CID
                resend_attachments = []
                for att in email_attachments:
                    resend_att = {
                        "filename": att.get("filename", "screenshot.png"),
                        "content": att.get("content", ""),
                    }
                    # Add contentId if CID exists (for inline images)
                    if att.get("cid"):
                        resend_att["contentId"] = att.get("cid")
                    resend_attachments.append(resend_att)
                
                email_data["attachments"] = resend_attachments
                logger.info(f"📎 Adding {len(resend_attachments)} image attachments to email")
                logger.info(f"📎 Attachment CIDs: {[att.get('contentId') for att in resend_attachments]}")
            else:
                logger.warning(f"⚠️ No email attachments created - screenshot might be missing")
            
            logger.info(f"📧 Attempting to send email to {MAIL_TO} from {RESEND_FROM}")
            logger.info(f"📧 Email subject: {email_data['subject']}")
            logger.info(f"📧 Email HTML length: {len(html_body)} chars")
            
            try:
                resp = requests.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=email_data,
                    timeout=30  # Add timeout
                )
                
                logger.info(f"📧 Resend API response status: {resp.status_code}")
                
                if resp.status_code != 200:
                    error_text = resp.text
                    logger.error(f"❌ Resend API error ({resp.status_code}): {error_text}")
                    # Log the full response for debugging
                    try:
                        error_json = resp.json()
                        logger.error(f"❌ Resend error details: {error_json}")
                    except:
                        logger.error(f"❌ Resend error (non-JSON): {error_text}")
                else:
                    logger.info(f"✅ Email sent successfully with {len(email_attachments) if email_attachments else 0} attachments")
                    try:
                        resp_data = resp.json()
                        logger.info(f"📧 Email ID: {resp_data.get('id', 'unknown')}")
                    except:
                        logger.warning(f"⚠️ Could not parse email response JSON")
            except requests.exceptions.Timeout:
                logger.error(f"❌ Timeout sending email via Resend (exceeded 30s)")
            except Exception as e:
                logger.error(f"❌ Error sending email via Resend: {str(e)}")
                import traceback
                logger.error(f"Full traceback: {traceback.format_exc()}")
        else:
            if not RESEND_API_KEY:
                logger.error("❌ RESEND_API_KEY not configured; order email not sent")
            if not MAIL_TO:
                logger.error("❌ MAIL_TO not configured; order email not sent")
            logger.warning("Email service not configured; order email not sent")

        # Send confirmation email to customer if email is provided
        customer_email = order_data.get("customer_email", "").strip()
        logger.info(f"📧 [CUSTOMER] Checking customer email: '{customer_email}' (empty: {not customer_email}, RESEND_API_KEY: {bool(RESEND_API_KEY)})")
        if customer_email and RESEND_API_KEY:
            logger.info(f"📧 [CUSTOMER] Preparing confirmation email for customer: {customer_email}")
            
            # Build customer-friendly confirmation email
            customer_html_body = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #333;">🎉 Thank You for Your Order!</h1>
                <p>Hi there,</p>
                <p>We've received your order and are getting it ready for you!</p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h2 style="margin-top: 0; color: #333;">Order Details</h2>
                    <p><strong>Order Number:</strong> #{order_number}</p>
                    <p><strong>Order ID:</strong> {order_id}</p>
                    <p><strong>Items:</strong> {len(enriched_cart)}</p>
                    <p><strong>Subtotal:</strong> ${total_amount - shipping_cost:.2f}</p>
                    <p><strong>Shipping:</strong> ${shipping_cost:.2f}</p>
                    <p><strong style="font-size: 18px;">Total:</strong> <strong style="font-size: 18px; color: #007bff;">${total_amount:.2f}</strong></p>
                </div>
                
                <h2 style="color: #333;">Order Items</h2>
            """
            
            # Add order items to customer email
            for idx, item in enumerate(enriched_cart):
                product_name = item.get('product', 'N/A')
                color = (item.get('variants') or {}).get('color', 'N/A')
                size = (item.get('variants') or {}).get('size', 'N/A')
                price = item.get('price', 0)
                note = item.get('note', '')
                
                customer_html_body += f"""
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
                    <h3 style="margin-top: 0; color: #333;">{product_name}</h3>
                    <p><strong>Color:</strong> {color}</p>
                    <p><strong>Size:</strong> {size}</p>
                    <p><strong>Price:</strong> ${price:.2f}</p>
                    {f'<p><strong>Note:</strong> {note}</p>' if note else ''}
                </div>
                """
            
            # Add video information if available
            if order_data.get('video_title') and order_data.get('video_title') != 'Unknown Video':
                customer_html_body += f"""
                <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #333;">📹 Video Information</h3>
                    <p><strong>Video:</strong> {order_data['video_title']}</p>
                    <p><strong>Creator:</strong> {order_data['creator_name']}</p>
                </div>
                """
            
            # Add shipping address if available
            if shipping_address:
                customer_html_body += f"""
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #333;">📦 Shipping Address</h3>
                    <p>{shipping_address.get('name', '')}<br>
                    {shipping_address.get('line1', '')}<br>
                    {shipping_address.get('line2', '') + '<br>' if shipping_address.get('line2') else ''}
                    {shipping_address.get('city', '')}, {shipping_address.get('state', '')} {shipping_address.get('postal_code', '')}<br>
                    {shipping_address.get('country', '')}</p>
                </div>
                """
            
            customer_html_body += """
                <p style="margin-top: 30px;">We'll send you another email when your order ships!</p>
                <p>If you have any questions, please don't hesitate to reach out to us.</p>
                <p>Best regards,<br>The ScreenMerch Team</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="color: #666; font-size: 12px;">This is an automated confirmation email. Please do not reply to this email.</p>
            </div>
            """
            
            try:
                customer_email_data = {
                    "from": RESEND_FROM,
                    "to": [customer_email],
                    "subject": f"🎉 Order Confirmation - #{order_number}",
                    "html": customer_html_body,
                }
                
                logger.info(f"📧 [CUSTOMER] Sending confirmation email to {customer_email}")
                customer_resp = requests.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=customer_email_data,
                    timeout=30
                )
                
                if customer_resp.status_code == 200:
                    logger.info(f"✅ [CUSTOMER] Confirmation email sent successfully to {customer_email}")
                    try:
                        resp_data = customer_resp.json()
                        logger.info(f"📧 [CUSTOMER] Email ID: {resp_data.get('id', 'unknown')}")
                    except:
                        pass
                else:
                    error_text = customer_resp.text
                    logger.error(f"❌ [CUSTOMER] Failed to send confirmation email ({customer_resp.status_code}): {error_text}")
            except Exception as e:
                logger.error(f"❌ [CUSTOMER] Error sending confirmation email: {str(e)}")
                import traceback
                logger.error(f"Full traceback: {traceback.format_exc()}")
        elif not customer_email:
            logger.warning(f"⚠️ [CUSTOMER] No customer email provided - skipping confirmation email")
        elif not RESEND_API_KEY:
            logger.warning(f"⚠️ [CUSTOMER] RESEND_API_KEY not configured - skipping confirmation email")

        response = jsonify({"success": True, "order_id": order_id})
        origin = request.headers.get('Origin', '*')
        response.headers.add('Vary', 'Origin')
        return response
    except Exception as e:
        logger.error(f"Error in place_order: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        origin = request.headers.get('Origin', '*')
        response.headers.add('Vary', 'Origin')
        return response, 500

@app.route("/success")
def success():
    order_id = request.args.get('order_id')
    logger.info(f"🎯 Success page visited with order_id: {order_id}")
    
    if order_id:
        logger.info(f"🔍 Looking for order {order_id}...")
        try:
            # First try to get order from database
            db_result = supabase.table('orders').select('*').eq('order_id', order_id).execute()
            
            if db_result.data:
                order_data = db_result.data[0]
                cart = order_data.get("cart", [])
                logger.info(f"✅ Found order {order_id} in database, processing email...")
            elif order_id in order_store:
                order_data = order_store[order_id]
                cart = order_data.get("cart", [])
                logger.info(f"✅ Found order {order_id} in memory store, processing email...")
            else:
                logger.warning(f"⚠️ Order {order_id} not found in database or memory store")
                return render_template('success.html')
            
            # Generate a simple order number (last 8 characters of order_id)
            order_number = order_id[-8:].upper()
            
            # Check order status - if "paid", webhook already fired and email was sent
            # If "pending", webhook didn't fire yet, so send email as fallback
            order_status = order_data.get('status', 'pending')
            
            logger.info(f"📧 [SUCCESS] Order status: {order_status}")
            
            # Get creator_user_id from order data if available
            creator_user_id = order_data.get('creator_user_id')
            if not creator_user_id:
                # Try to look up from subdomain if stored
                subdomain = order_data.get('subdomain')
                if subdomain:
                    try:
                        creator_result = supabase_admin.table('users').select('id').eq('subdomain', subdomain).limit(1).execute()
                        if creator_result.data and len(creator_result.data) > 0:
                            creator_user_id = creator_result.data[0]['id']
                            logger.info(f"✅ [SUCCESS] Found creator_user_id from stored subdomain '{subdomain}': {creator_user_id}")
                    except Exception as e:
                        logger.warning(f"⚠️ [SUCCESS] Error looking up creator from subdomain: {str(e)}")
            
            # Record each sale with creator_user_id if available
            for item in cart:
                record_sale(item, user_id=creator_user_id, order_id=order_id)
            
            # Only send email if order is still "pending" (webhook didn't fire)
            if order_status != 'paid':
                logger.info(f"📧 [SUCCESS] Order status is {order_status}, sending email as fallback (webhook may not have fired)")
                
                # Get screenshot from order data (stored at order level or in cart items)
                top_level_screenshot = order_data.get('selected_screenshot') or order_data.get('thumbnail') or order_data.get('screenshot')
                
                # Also check cart items for screenshot
                if not top_level_screenshot:
                    for item in cart:
                        if item.get('selected_screenshot') or item.get('screenshot') or item.get('thumbnail') or item.get('img'):
                            top_level_screenshot = item.get('selected_screenshot') or item.get('screenshot') or item.get('thumbnail') or item.get('img')
                            logger.info(f"📸 [SUCCESS] Found screenshot in cart item")
                            break
                
                if top_level_screenshot:
                    logger.info(f"📸 [SUCCESS] Found screenshot (length: {len(str(top_level_screenshot))} chars)")
                else:
                    logger.warning(f"⚠️ [SUCCESS] No screenshot found for order {order_id}")
                
                # Format comprehensive email with products and screenshots
                html_body = f"<h1>🛍️ New ScreenMerch Order #{order_number}</h1>"
                html_body += f"<p><strong>Order ID:</strong> {order_id}</p>"
                html_body += f"<p><strong>Items:</strong> {len(cart)}</p>"
                
                # Calculate total value
                total_value = 0
                for item in cart:
                    product_name = item.get('product', '')
                    product_info = next((p for p in PRODUCTS if p["name"] == product_name), None)
                    if product_info:
                        total_value += product_info["price"]
                
                html_body += f"<p><strong>Total Value:</strong> ${total_value:.2f}</p>"
                html_body += "<hr>"
                html_body += "<h2>🛍️ Products</h2>"
                
                # Collect images for email attachments
                email_attachments = []
                attachment_cids = {}  # Track CIDs for each item
                
                # CRITICAL: Only add ONE screenshot attachment per order, not per cart item
                screenshot_attachment_added = False
                screenshot_cid = None
                
                # Get screenshot once from top-level or first cart item
                order_screenshot = top_level_screenshot or (cart[0].get('selected_screenshot') if cart else None) or (cart[0].get('screenshot') if cart else None) or (cart[0].get('thumbnail') if cart else None) or (cart[0].get('img') if cart else None) or ''
                
                # Add screenshot as attachment ONCE if it's a base64 image
                if order_screenshot and isinstance(order_screenshot, str) and order_screenshot.startswith('data:image'):
                    try:
                        # Parse data URL: data:image/png;base64,<data>
                        header, data = order_screenshot.split(',', 1)
                        image_format = header.split('/')[1].split(';')[0]  # png, jpeg, etc.
                        image_data = data  # Already base64 encoded
                        
                        # Generate CID for embedding (use order_id, not item index)
                        screenshot_cid = f"screenshot_{order_id}_0"
                        attachment_cids[0] = screenshot_cid
                        
                        # Add as attachment ONCE (Resend format: content should be base64 string)
                        email_attachments.append({
                            "filename": f"screenshot.{image_format}",
                            "content": image_data,  # Already base64 encoded from data URL
                            "cid": screenshot_cid
                        })
                        screenshot_attachment_added = True
                        logger.info(f"✅ [SUCCESS] Added ONE screenshot attachment with CID: {screenshot_cid} (for entire order, not per item)")
                    except Exception as e:
                        logger.warning(f"⚠️ [SUCCESS] Failed to convert data URL to attachment: {str(e)}")
                
                # Display screenshot once at the top
                screenshot_html = ""
                if screenshot_attachment_added and screenshot_cid:
                    screenshot_html = f"""
                        <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                            <h2>📸 Order Screenshot</h2>
                            <img src='cid:{screenshot_cid}' alt='Product Screenshot' style='max-width: 300px; border-radius: 6px; border: 1px solid #ddd;'>
                        </div>
                    """
                elif order_screenshot and isinstance(order_screenshot, str) and (order_screenshot.startswith('http') or order_screenshot.startswith('https')):
                    screenshot_html = f"""
                        <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                            <h2>📸 Order Screenshot</h2>
                            <img src='{order_screenshot}' alt='Product Image' style='max-width: 300px; border-radius: 6px;'>
                        </div>
                    """
                
                if screenshot_html:
                    html_body += screenshot_html
                
                for idx, item in enumerate(cart):
                    product_name = item.get('product', 'N/A')
                    color = (item.get('variants') or {}).get('color', 'N/A')
                    size = (item.get('variants') or {}).get('size', 'N/A')
                    note = item.get('note', 'None')
                    
                    # Product details (no image - already shown above)
                    html_body += f"""
                        <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                            <h3>{product_name}</h3>
                            <p><strong>Color:</strong> {color}</p>
                            <p><strong>Size:</strong> {size}</p>
                            <p><strong>Note:</strong> {note}</p>
                        </div>
                    """
                
                # Add video information
                html_body += "<hr>"
                html_body += "<h2>📹 Video Information</h2>"
                html_body += f"<p><strong>Video Title:</strong> {order_data.get('video_title', 'Unknown Video')}</p>"
                html_body += f"<p><strong>Creator:</strong> {order_data.get('creator_name', 'Unknown Creator')}</p>"
                html_body += f"<p><strong>Video URL:</strong> {order_data.get('video_url', 'Not provided')}</p>"
                html_body += "<br>"
                html_body += "<p><strong>📋 View Full Order Details:</strong></p>"
                html_body += f"<p><a href='https://screenmerch.fly.dev/admin/order/{order_id}' style='background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>View Order Details</a></p>"
                html_body += "<br>"
                html_body += "<p><strong>📊 All Orders Dashboard:</strong></p>"
                html_body += f"<p><a href='https://screenmerch.fly.dev/admin/orders' style='background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>View All Orders</a></p>"
                html_body += "<br>"
                html_body += "<hr>"
                html_body += "<h2>🖨️ Print Quality Images</h2>"
                html_body += "<p><strong>📸 Screenshot Images:</strong> Original screenshots are included. Use the generator below to process to 300 DPI print quality and apply additional processing:</p>"
                html_body += f"<p><strong>Web Interface (for additional processing):</strong> <a href='https://screenmerch.fly.dev/print-quality?order_id={order_id}'>https://screenmerch.fly.dev/print-quality?order_id={order_id}</a></p>"
                html_body += "<br>"
                html_body += "<p><small>This is an automated notification from ScreenMerch</small></p>"
                
                # Send email with Resend if configured
                logger.info(f"📧 [SUCCESS] Email configuration check: RESEND_API_KEY={'SET' if RESEND_API_KEY else 'NOT SET'}, MAIL_TO={'SET' if MAIL_TO else 'NOT SET'}")
                
                if RESEND_API_KEY and MAIL_TO:
                    email_data = {
                        "from": RESEND_FROM,
                        "to": [MAIL_TO],
                        "subject": f"🛍️ New ScreenMerch Order #{order_number}",
                        "html": html_body,
                    }
                    
                    # Add attachments if any (for base64 screenshots)
                    if email_attachments:
                        # Convert to Resend format
                        resend_attachments = []
                        for att in email_attachments:
                            resend_att = {
                                "filename": att.get("filename", "screenshot.png"),
                                "content": att.get("content", ""),
                            }
                            # Add contentId if CID exists (for inline images)
                            if att.get("cid"):
                                resend_att["contentId"] = att.get("cid")
                            resend_attachments.append(resend_att)
                        
                        email_data["attachments"] = resend_attachments
                        logger.info(f"📎 [SUCCESS] Adding {len(resend_attachments)} image attachments to email")
                        logger.info(f"📎 [SUCCESS] Attachment CIDs: {[att.get('contentId') for att in resend_attachments]}")
                    else:
                        logger.warning(f"⚠️ [SUCCESS] No email attachments created - screenshots might be missing")
                    
                    logger.info(f"📧 [SUCCESS] Attempting to send email to {MAIL_TO} from {RESEND_FROM}")
                    logger.info(f"📧 [SUCCESS] Email subject: {email_data['subject']}")
                    logger.info(f"📧 [SUCCESS] Email HTML length: {len(html_body)} chars")
                    
                    try:
                        resp = requests.post(
                            "https://api.resend.com/emails",
                            headers={
                                "Authorization": f"Bearer {RESEND_API_KEY}",
                                "Content-Type": "application/json",
                            },
                            json=email_data,
                            timeout=30
                        )
                        
                        logger.info(f"📧 [SUCCESS] Resend API response status: {resp.status_code}")
                        
                        if resp.status_code != 200:
                            error_text = resp.text
                            logger.error(f"❌ [SUCCESS] Resend API error ({resp.status_code}): {error_text}")
                            try:
                                error_json = resp.json()
                                logger.error(f"❌ [SUCCESS] Resend error details: {error_json}")
                            except:
                                logger.error(f"❌ [SUCCESS] Resend error (non-JSON): {error_text}")
                        else:
                            logger.info(f"✅ [SUCCESS] Email sent successfully as fallback")
                            try:
                                resp_data = resp.json()
                                logger.info(f"📧 [SUCCESS] Email ID: {resp_data.get('id', 'unknown')}")
                            except:
                                logger.warning(f"⚠️ [SUCCESS] Could not parse email response JSON")
                    except requests.exceptions.Timeout:
                        logger.error(f"❌ [SUCCESS] Timeout sending email via Resend (exceeded 30s)")
                    except Exception as e:
                        logger.error(f"❌ [SUCCESS] Error sending email via Resend: {str(e)}")
                        import traceback
                        logger.error(f"❌ [SUCCESS] Full traceback: {traceback.format_exc()}")
                else:
                    if not RESEND_API_KEY:
                        logger.error("❌ [SUCCESS] RESEND_API_KEY not configured; order email not sent")
                    if not MAIL_TO:
                        logger.error("❌ [SUCCESS] MAIL_TO not configured; order email not sent")
                    logger.warning("❌ [SUCCESS] Email service not configured; order email not sent")
            else:
                # Order is already "paid" - webhook fired and email was sent
                logger.info(f"✅ [SUCCESS] Order {order_number} status is 'paid' - email already sent from webhook")
                
        except Exception as e:
            logger.error(f"❌ Error processing order {order_id}: {str(e)}")
    else:
        logger.warning(f"⚠️ Order {order_id} not found in store or no order_id provided")
    
    return render_template('success.html')

@app.route("/create-checkout-session", methods=["POST", "OPTIONS"])  # legacy path
@app.route("/api/create-checkout-session", methods=["POST", "OPTIONS"])  # CORS-covered API path
def create_checkout_session():
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        origin = request.headers.get('Origin', '*')
        response.headers.add('Vary', 'Origin')
        return response
    try:
        # Use robust JSON reader
        data = read_json()
        
        cart = data.get("cart", [])
        product_id = data.get("product_id")
        sms_consent = data.get("sms_consent", False)
        
        # Validate color-size availability for each cart item
        for item in cart:
            product_name = item.get('product', '')
            color = item.get('variants', {}).get('color', '')
            size = item.get('variants', {}).get('size', '')
            
            # Check Women's Ribbed Neck availability
            if product_name == "Women's Ribbed Neck":
                # Colors that are NOT available in XXXL, XXXXL, XXXXXL
                restricted_colors = [
                    "Dark Heather Grey", "Burgundy", "India Ink Grey", "Anthracite",
                    "Red", "Stargazer", "Khaki", "Desert Dust", "Fraiche Peche",
                    "Cotton Pink", "Lavender"
                ]
                
                # Sizes that are restricted for certain colors
                restricted_sizes = ["XXXL", "XXXXL", "XXXXXL"]
                
                if color in restricted_colors and size in restricted_sizes:
                    return jsonify({
                        "error": f"{color} is not available in size {size} for Women's Ribbed Neck. Please select a different size or color."
                    }), 400
            
            # Check Cropped Hoodie availability
            if product_name == "Cropped Hoodie":
                # Black is NOT available in XL and XXL
                if color == "Black" and size in ["XL", "XXL"]:
                    return jsonify({
                        "error": f"{color} is not available in size {size} for Cropped Hoodie. Please select a different size or color."
                    }), 400
                
                # Peach is ONLY available in XL
                if color == "Peach" and size != "XL":
                    return jsonify({
                        "error": f"{color} is only available in size XL for Cropped Hoodie. Please select XL or a different color."
                    }), 400
            
            # Check Women's Crop Top availability
            if product_name == "Women's Crop Top":
                # Bubblegum is out of stock
                if color == "Bubblegum":
                    return jsonify({
                        "error": f"{color} is currently out of stock for Women's Crop Top. Please select a different color."
                    }), 400
            
            # Check Unisex T-Shirt availability
            if product_name == "Unisex T-Shirt":
                # Colors not available in XS
                unavailable_in_xs = [
                    "Heather Midnight Navy", "True Royal", "Asphalt", "Heather True Royal",
                    "Mauve", "Forest", "Heather Forest", "Olive", "Heather Deep Teal"
                ]
                if color in unavailable_in_xs and size == "XS":
                    return jsonify({
                        "error": f"{color} is not available in size XS for Unisex T-Shirt. Please select a different size or color."
                    }), 400
                
                # Colors not available in 5XL (XXXXXL)
                unavailable_in_5xl = [
                    "Heather Midnight Navy", "True Royal", "Asphalt", "Heather True Royal",
                    "Heather Prism Lilac", "Soft Cream", "Heather Prism Ice Blue", "Mauve",
                    "Forest", "Heather Forest", "Olive", "Heather Deep Teal"
                ]
                if color in unavailable_in_5xl and size == "XXXXXL":
                    return jsonify({
                        "error": f"{color} is not available in size 5XL for Unisex T-Shirt. Please select a different size or color."
                    }), 400
        
        # Validate shipping address using robust function
        ok, addr_result = require_shipping_address(data)
        if not ok:
            logger.error(f"❌ Shipping address validation failed: {addr_result}")
            return jsonify({"error": addr_result}), 400
        
        shipping_address = addr_result
        logger.info(f"✅ Shipping address validated: {shipping_address}")
        
        # Ensure shipping_cost is a valid number
        shipping_cost_raw = data.get("shipping_cost", 5.99)
        try:
            shipping_cost = float(shipping_cost_raw) if shipping_cost_raw is not None else 5.99
            if shipping_cost < 0:
                shipping_cost = 5.99
        except (ValueError, TypeError):
            shipping_cost = 5.99  # Default to $5.99 if invalid

        logger.info(f"🛒 Received checkout request - Cart: {cart}")
        logger.info(f"🛒 Cart type: {type(cart)}, Cart length: {len(cart) if isinstance(cart, list) else 'N/A'}")
        logger.info(f"🛒 Product ID: {product_id}")
        logger.info(f"🛒 SMS Consent: {sms_consent}")

        if not cart:
            logger.error("❌ Cart is empty")
            return jsonify({"error": "Cart is empty"}), 400
        
        if not isinstance(cart, list):
            logger.error(f"❌ Cart is not a list: {type(cart)}")
            return jsonify({"error": "Cart must be an array"}), 400

        # Email notifications - SMS consent not required
        # sms_consent is kept for backward compatibility but not enforced

        # Generate a unique order ID and store the full cart (with images) and SMS consent
        # Shorter format for easier record keeping
        full_uuid = str(uuid.uuid4())
        order_id = f"ORD-{full_uuid[:8].upper()}"  # Short format: ORD-XXXXXXXX
        
        # Calculate total amount
        total_amount = sum(item.get('price', 0) for item in cart) + shipping_cost
        
        # Get screenshot from cart items first - check ALL possible screenshot fields
        # This handles both cases: with frontend deployment (selected_screenshot) and without (screenshot/img/thumbnail)
        checkout_screenshot = None
        logger.info(f"📸 [CHECKOUT] Checking cart items for screenshot (cart has {len(cart)} items)")
        for idx, item in enumerate(cart):
            # Check ALL possible screenshot fields in order of preference
            # Only use non-empty strings (filter out None, empty strings, etc.)
            screenshot = item.get("selected_screenshot") or item.get("screenshot") or item.get("img") or item.get("thumbnail")
            if screenshot and isinstance(screenshot, str) and screenshot.strip():
                checkout_screenshot = screenshot
                field_name = "selected_screenshot" if item.get("selected_screenshot") else ("screenshot" if item.get("screenshot") else ("img" if item.get("img") else "thumbnail"))
                logger.info(f"✅ [CHECKOUT] Found screenshot in cart item {idx} field '{field_name}': {str(screenshot)[:50]}...")
                break
        
        # Fallback to top-level payload if not found in cart items
        if not checkout_screenshot:
            screenshot_candidates = [data.get("selected_screenshot"), data.get("thumbnail"), data.get("screenshot")]
            for candidate in screenshot_candidates:
                if candidate and isinstance(candidate, str) and candidate.strip():
                    checkout_screenshot = candidate
                    break
            
            if checkout_screenshot:
                screenshot_type = "base64" if 'data:image' in checkout_screenshot else "URL"
                logger.info(f"✅ [CHECKOUT] Found screenshot in top-level payload (type: {screenshot_type}, length: {len(str(checkout_screenshot))} chars)")
                logger.info(f"✅ [CHECKOUT] Screenshot preview (first 200 chars): {str(checkout_screenshot)[:200]}...")
                logger.info(f"✅ [CHECKOUT] Screenshot is valid: {bool(checkout_screenshot and isinstance(checkout_screenshot, str) and checkout_screenshot.strip())}")
            else:
                logger.warning(f"⚠️ [CHECKOUT] No screenshot in top-level payload - checking keys: {[k for k in data.keys() if 'screen' in k.lower() or 'img' in k.lower() or 'thumb' in k.lower()]}")
                logger.warning(f"⚠️ [CHECKOUT] No screenshot found in cart items or top-level payload")
                logger.warning(f"⚠️ [CHECKOUT] Cart item keys (first item): {list(cart[0].keys()) if cart else 'No cart'}")
                logger.warning(f"⚠️ [CHECKOUT] Top-level payload keys with 'screen': {[k for k in data.keys() if 'screen' in k.lower() or 'img' in k.lower() or 'thumbnail' in k.lower()]}")
                # Also log the actual values to see what's there
                if cart:
                    logger.warning(f"⚠️ [CHECKOUT] First cart item values: selected_screenshot={cart[0].get('selected_screenshot')}, screenshot={cart[0].get('screenshot')}, img={cart[0].get('img')}, thumbnail={cart[0].get('thumbnail')}")
                logger.warning(f"⚠️ [CHECKOUT] Top-level values: selected_screenshot={data.get('selected_screenshot')}, thumbnail={data.get('thumbnail')}, screenshot={data.get('screenshot')}")
        
        # Enrich cart items with video metadata
        enriched_cart = []
        for idx, item in enumerate(cart):
            enriched_item = item.copy()
            # Add video metadata to each cart item
            # Use screenshot from cart item if available, otherwise use the extracted one
            # Check ALL fields in cart item first, then fallback to extracted screenshot
            # Only use non-empty strings (filter out None, empty strings, etc.)
            # IMPORTANT: Always use checkout_screenshot as final fallback - it was extracted earlier
            item_screenshot = None
            screenshot_candidates = [item.get("selected_screenshot"), item.get("screenshot"), item.get("img"), item.get("thumbnail")]
            
            # Log all candidates for debugging
            logger.info(f"📸 [CHECKOUT] Item {idx} screenshot candidates:")
            for i, candidate in enumerate(["item.selected_screenshot", "item.screenshot", "item.img", "item.thumbnail"]):
                val = screenshot_candidates[i] if i < len(screenshot_candidates) else None
                logger.info(f"   - {candidate}: {bool(val)} (value: {str(val)[:50] if val else 'None'}...)")
            logger.info(f"   - checkout_screenshot: {bool(checkout_screenshot)} (value: {str(checkout_screenshot)[:50] if checkout_screenshot else 'None'}...)")
            
            # Check candidates first, then fallback to checkout_screenshot
            for candidate in screenshot_candidates:
                if candidate and isinstance(candidate, str) and candidate.strip():
                    item_screenshot = candidate
                    logger.info(f"✅ [CHECKOUT] Item {idx} using screenshot from cart item: {str(candidate)[:50]}...")
                    break
            
            # If no screenshot found in cart item, use checkout_screenshot (extracted from top-level payload)
            if not item_screenshot and checkout_screenshot and isinstance(checkout_screenshot, str) and checkout_screenshot.strip():
                item_screenshot = checkout_screenshot
                logger.info(f"✅ [CHECKOUT] Item {idx} using checkout_screenshot (from top-level payload): {str(checkout_screenshot)[:50]}...")
            
            enriched_item.update({
                "videoName": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                "creatorName": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
                "timestamp": data.get("screenshot_timestamp", data.get("timestamp", "Not provided")),
                # Store screenshot at cart item level so it can be retrieved later
                # Always store in selected_screenshot for consistent retrieval
                # Use item_screenshot which was validated above
                "selected_screenshot": item_screenshot
            })
            enriched_cart.append(enriched_item)
            if item_screenshot:
                screenshot_type = "base64" if 'data:image' in item_screenshot else ("URL" if (item_screenshot.startswith('http') or item_screenshot.startswith('https')) else "other")
                logger.info(f"✅ [CHECKOUT] Stored screenshot in enriched_cart item {idx} (type: {screenshot_type}, length: {len(str(item_screenshot))} chars): {str(item_screenshot)[:100]}...")
            else:
                logger.warning(f"⚠️ [CHECKOUT] No screenshot in enriched_cart item {idx} - item_screenshot is None or empty")
                logger.warning(f"⚠️ [CHECKOUT] Cart item values: selected_screenshot={item.get('selected_screenshot')}, screenshot={item.get('screenshot')}, img={item.get('img')}, thumbnail={item.get('thumbnail')}")
                logger.warning(f"⚠️ [CHECKOUT] checkout_screenshot={checkout_screenshot}")
        
        if checkout_screenshot:
            logger.info(f"✅ [CHECKOUT] Screenshot will be stored in enriched_cart items and order level: {bool(checkout_screenshot)}")
        else:
            logger.warning(f"⚠️ [CHECKOUT] WARNING: No screenshot found to store in order!")
        
        # Extract subdomain from request origin to store with order
        creator_user_id_from_subdomain = None
        subdomain_from_request = None
        try:
            origin = request.headers.get('Origin', '')
            if origin and origin.endswith('.screenmerch.com') and origin.startswith('https://'):
                from urllib.parse import urlparse
                parsed = urlparse(origin)
                hostname = parsed.netloc
                subdomain_from_request = hostname.replace('.screenmerch.com', '').lower()
                
                if subdomain_from_request and subdomain_from_request != 'www':
                    # Look up creator by subdomain
                    creator_result = supabase_admin.table('users').select('id, display_name').eq('subdomain', subdomain_from_request).limit(1).execute()
                    
                    if creator_result.data and len(creator_result.data) > 0:
                        creator_user_id_from_subdomain = creator_result.data[0]['id']
                        logger.info(f"✅ [CHECKOUT] Found creator user_id from subdomain '{subdomain_from_request}': {creator_user_id_from_subdomain}")
        except Exception as subdomain_error:
            logger.warning(f"⚠️ [CHECKOUT] Error looking up creator from subdomain: {subdomain_error}")
        
        # Store order in database instead of in-memory store
        # NOTE: selected_screenshot column doesn't exist in database, so we store it only in cart items
        order_data = {
            "order_id": order_id,
            "cart": enriched_cart,  # Screenshot is stored in cart items (selected_screenshot field)
            "sms_consent": sms_consent,
            "customer_email": data.get("user_email", ""),
            "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
            "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
            "creator_user_id": creator_user_id_from_subdomain,  # Store creator user_id for webhook
            "subdomain": subdomain_from_request,  # Store subdomain for reference
            "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
            "total_amount": total_amount,
            "shipping_cost": shipping_cost,
            "shipping_address": shipping_address,  # Store shipping address for future reference
            "status": "pending"
        }
        
        # Screenshot is stored in enriched_cart items (selected_screenshot field in each cart item)
        # We don't store it at order level because the database column doesn't exist
        if checkout_screenshot:
            logger.info(f"✅ Screenshot stored in enriched_cart items (selected_screenshot field): {bool(checkout_screenshot)}")
            logger.info(f"✅ Screenshot will be retrievable from cart items for email: {bool(checkout_screenshot)}")
        
        try:
            # Verify screenshot is actually in enriched_cart before storing
            logger.info(f"📸 [CHECKOUT] Verifying screenshots in enriched_cart before database insert:")
            for idx, item in enumerate(enriched_cart):
                screenshot_val = item.get('selected_screenshot')
                if screenshot_val:
                    logger.info(f"   ✅ Item {idx} has screenshot (type: {type(screenshot_val).__name__}, length: {len(str(screenshot_val))} chars): {str(screenshot_val)[:50]}...")
                else:
                    logger.warning(f"   ⚠️ Item {idx} has NO screenshot - selected_screenshot={screenshot_val}")
            
            # Store in database
            supabase.table('orders').insert(order_data).execute()
            logger.info(f"✅ Order {order_id} stored in database")
            
            # Keep in-memory store as backup for admin dashboard
            order_store[order_id] = {
                "cart": enriched_cart,
                "sms_consent": sms_consent,
                "timestamp": data.get("timestamp"),
                "order_id": order_id,
                "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
                "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
                "screenshot_timestamp": data.get("screenshot_timestamp", data.get("timestamp", "Not provided")),
                "status": "pending",
                "created_at": data.get("created_at", "Recent")
            }
            logger.info(f"✅ Order {order_id} also stored in in-memory store")
        except Exception as db_error:
            logger.error(f"❌ Failed to store order in database: {str(db_error)}")
            # Fallback to in-memory storage
            order_store[order_id] = {
                "cart": enriched_cart,
                "sms_consent": sms_consent,
                "timestamp": data.get("timestamp"),
                "order_id": order_id,
                "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
                "creator_user_id": creator_user_id_from_subdomain,  # Store creator user_id for webhook
                "subdomain": subdomain_from_request,  # Store subdomain for reference
                "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
                "screenshot_timestamp": data.get("screenshot_timestamp", data.get("timestamp", "Not provided")),
                "status": "pending",
                "created_at": data.get("created_at", "Recent")
            }

        line_items = []
        for item in cart:
            logger.info(f"🛒 Processing item: {item}")
            logger.info(f"🛒 Item product name: '{item.get('product')}'")
            logger.info(f"🛒 Item price: {item.get('price')}")
            logger.info(f"🛒 Available products: {[p['name'] for p in PRODUCTS]}")
            
            # Use price from cart item if available, otherwise look up in PRODUCTS
            item_price = item.get('price')
            if item_price and item_price > 0:
                logger.info(f"✅ Using price from cart item: ${item_price}")
                unit_amount = int(item_price * 100)
            else:
                # Try exact match first
                product_info = next((p for p in PRODUCTS if p["name"] == item.get("product")), None)
                if not product_info:
                    # Try case-insensitive match
                    product_info = next((p for p in PRODUCTS if p["name"].lower() == item.get("product", "").lower()), None)
                    if product_info:
                        logger.info(f"✅ Found product info (case-insensitive): {product_info}")
                    else:
                        logger.error(f"❌ Could not find price for product: '{item.get('product')}'")
                        logger.error(f"❌ Product names in PRODUCTS: {[p['name'] for p in PRODUCTS]}")
                        continue
                else:
                    logger.info(f"✅ Found product info (exact match): {product_info}")
                
                unit_amount = int(product_info["price"] * 100)
            
            line_items.append({
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": item.get("product"),
                    },
                    "unit_amount": unit_amount,
                },
                "quantity": 1,
            })

        # Add shipping cost as a separate line item
        if shipping_cost and shipping_cost > 0:
            line_items.append({
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": "Shipping",
                    },
                    "unit_amount": int(shipping_cost * 100),
                },
                "quantity": 1,
            })
            logger.info(f"🚚 Added shipping cost: ${shipping_cost}")

        logger.info(f"🛒 Created line items: {line_items}")
        if not line_items:
            logger.error("❌ No valid items in cart to check out")
            return jsonify({"error": "No valid items in cart to check out."}), 400

        # Detect the origin/subdomain from the request to preserve it
        origin = request.headers.get('Origin', 'https://screenmerch.com')
        # Extract the base URL (protocol + host) from origin
        # If origin is a subdomain like https://testcreator.screenmerch.com, use it
        # Otherwise default to https://screenmerch.com
        if origin and origin.startswith('https://') and origin.endswith('.screenmerch.com'):
            # It's a subdomain, use it
            base_url = origin
        else:
            # Default to main domain
            base_url = 'https://screenmerch.com'
        
        # Pre-populate customer email if available from frontend
        session_params = {
            "payment_method_types": ["card"],
            "mode": "payment",
            "line_items": line_items,
            "success_url": f"{base_url}/order-success?order_id={order_id}",
            "cancel_url": f"{base_url}/checkout/{product_id or ''}",
            # A2P 10DLC Compliance: Collect phone number for SMS notifications
            "phone_number_collection": {"enabled": True},
            "payment_intent_data": {
                "statement_descriptor": "ScreenMerch"
            },
            "metadata": {
                "order_id": order_id,  # Only store the small order ID in Stripe
                "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
                "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator"))
            }
        }
        
        # Pre-populate customer email if available (user can still edit it in Stripe)
        user_email = data.get("user_email", data.get("customer_email", ""))
        if user_email and user_email.strip():
            session_params["customer_email"] = user_email.strip()
            logger.info(f"📧 [CHECKOUT] Pre-populating customer email in Stripe session: {user_email}")
        else:
            logger.info(f"📧 [CHECKOUT] No customer email provided - Stripe will collect it during checkout (email_collection enabled)")
        
        # Ensure we're using test mode Stripe key
        try:
            ensure_stripe_test_mode()
        except ValueError as e:
            logger.error(f"❌ {str(e)}")
            response = jsonify({"error": "Payment system configuration error", "details": "Stripe API key is not configured"})
            origin = request.headers.get('Origin', '*')
            response.headers.add('Vary', 'Origin')
            return response, 500
        
        session = stripe.checkout.Session.create(**session_params)
        response = jsonify({"url": session.url})
        origin = request.headers.get('Origin', '*')
        response.headers.add('Vary', 'Origin')
        return response
    except stripe.error.AuthenticationError as e:
        # Handle Stripe authentication errors (invalid API key) - do not log key material
        logger.error(f"❌ Stripe authentication error: {str(e)}")
        response = jsonify({
            "error": "Payment system configuration error",
            "details": "Invalid Stripe API key. Please verify STRIPE_SECRET_KEY is set correctly in Fly.io secrets."
        })
        origin = request.headers.get('Origin', '*')
        response.headers.add('Vary', 'Origin')
        return response, 500
    except stripe.error.StripeError as e:
        # Handle other Stripe-specific errors
        logger.error(f"❌ Stripe error: {str(e)}")
        logger.error(f"❌ Error type: {type(e).__name__}")
        response = jsonify({
            "error": "Payment processing error",
            "details": str(e)
        })
        origin = request.headers.get('Origin', '*')
        response.headers.add('Vary', 'Origin')
        return response, 500
    except Exception as e:
        logger.error(f"❌ Error creating checkout session: {str(e)}")
        logger.error(f"❌ Error type: {type(e).__name__}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        
        error_message = "Failed to create checkout session"
        if "ZIP" in str(e) or "zip" in str(e).lower():
            error_message = "ZIP / Postal Code is required"
        elif "cart" in str(e).lower() or "empty" in str(e).lower():
            error_message = "Cart is empty or invalid"
        elif "api key" in str(e).lower() or "authentication" in str(e).lower():
            error_message = "Payment system configuration error - Invalid API key"
            
        response = jsonify({"error": error_message, "details": str(e)})
        origin = request.headers.get('Origin', '*')
        response.headers.add('Vary', 'Origin')
        return response, 500

@app.route("/webhook", methods=["POST"])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return "Webhook error", 400

    # Handle product orders
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        logger.info(f"Payment received for session: {session.get('id')}")
        order_id = session.get("metadata", {}).get("order_id")
        
        # Handle product orders
        if order_id:
            try:
                # First try to get order from database
                db_result = supabase.table('orders').select('*').eq('order_id', order_id).execute()
                
                if db_result.data:
                    order_data = db_result.data[0]
                    cart = order_data.get("cart", [])
                    sms_consent = order_data.get("sms_consent", False)
                    logger.info(f"✅ Retrieved order {order_id} from database")
                    # Log order data to debug screenshot retrieval
                    logger.info(f"📸 [WEBHOOK] Order data keys: {list(order_data.keys())}")
                    logger.info(f"📸 [WEBHOOK] Order-level screenshot fields: selected_screenshot={bool(order_data.get('selected_screenshot'))}, thumbnail={bool(order_data.get('thumbnail'))}, screenshot={bool(order_data.get('screenshot'))}")
                    logger.info(f"📸 [WEBHOOK] Cart has {len(cart)} items")
                    if cart:
                        logger.info(f"📸 [WEBHOOK] First cart item keys: {list(cart[0].keys()) if cart else 'No cart'}")
                        logger.info(f"📸 [WEBHOOK] First cart item screenshot fields: selected_screenshot={bool(cart[0].get('selected_screenshot'))}, screenshot={bool(cart[0].get('screenshot'))}, img={bool(cart[0].get('img'))}, thumbnail={bool(cart[0].get('thumbnail'))}")
                else:
                    # Fallback to in-memory store
                    order_data = order_store[order_id]
                    cart = order_data.get("cart", [])
                    sms_consent = order_data.get("sms_consent", False)
                    logger.info(f"✅ Retrieved order {order_id} from in-memory store")
                    
            except KeyError:
                logger.error(f"Order ID {order_id} not found in database or order_store")
                return "", 200

            # Get customer phone number from Stripe session
            customer_phone = session.get("customer_details", {}).get("phone", "")
            
            # Get customer details from Stripe session
            customer_details = session.get("customer_details", {})
            customer_name = customer_details.get("name", "Not provided")
            customer_email = customer_details.get("email", "Not provided")
            
            # Log customer email extraction for debugging
            logger.info(f"📧 [WEBHOOK] ===== CUSTOMER EMAIL EXTRACTION DEBUG =====")
            logger.info(f"📧 [WEBHOOK] customer_details.email: '{customer_email}'")
            logger.info(f"📧 [WEBHOOK] customer_details.name: '{customer_name}'")
            logger.info(f"📧 [WEBHOOK] Full customer_details object: {customer_details}")
            logger.info(f"📧 [WEBHOOK] session.customer_email: '{session.get('customer_email', 'Not in session')}'")
            logger.info(f"📧 [WEBHOOK] session.customer: '{session.get('customer', 'Not in session')}'")
            
            # Try alternative locations for email if not found in customer_details
            if not customer_email or customer_email == "Not provided" or customer_email == "":
                # Try session.customer_email (direct field)
                alt_email = session.get("customer_email")
                if alt_email and alt_email.strip():
                    customer_email = alt_email.strip()
                    logger.info(f"📧 [WEBHOOK] Found email in session.customer_email: '{customer_email}'")
                
                # Try order_data as fallback (email might have been stored when order was created)
                if (not customer_email or customer_email == "Not provided" or customer_email == "") and order_data:
                    order_customer_email = order_data.get("customer_email", "")
                    if order_customer_email and order_customer_email.strip():
                        customer_email = order_customer_email.strip()
                        logger.info(f"📧 [WEBHOOK] Using customer_email from order_data: '{customer_email}'")
                
                # Final check - log if still not found
                if not customer_email or customer_email == "Not provided" or customer_email == "":
                    logger.error(f"❌ [WEBHOOK] Customer email NOT FOUND in any location!")
                    logger.error(f"❌ [WEBHOOK] customer_details: {customer_details}")
                    logger.error(f"❌ [WEBHOOK] session.customer_email: {session.get('customer_email')}")
                    logger.error(f"❌ [WEBHOOK] order_data.customer_email: {order_data.get('customer_email') if order_data else 'N/A'}")
                    logger.error(f"❌ [WEBHOOK] Full session object (first 50 keys): {list(session.keys())[:50]}")
            else:
                logger.info(f"✅ [WEBHOOK] Customer email found: '{customer_email}'")
            
            logger.info(f"📧 [WEBHOOK] ===== END EMAIL EXTRACTION DEBUG =====")
            
            # Get shipping address from Stripe session (handle None case)
            shipping_details = session.get("shipping_details")
            if shipping_details:
                shipping_address = shipping_details.get("address", {})
                address_line1 = shipping_address.get("line1", "Not provided")
                address_line2 = shipping_address.get("line2", "")
                city = shipping_address.get("city", "Not provided")
                state = shipping_address.get("state", "Not provided")
                postal_code = shipping_address.get("postal_code", "Not provided")
                country = shipping_address.get("country", "Not provided")
            else:
                # Fallback if shipping details are not available
                address_line1 = "Not provided"
                address_line2 = ""
                city = "Not provided"
                state = "Not provided"
                postal_code = "Not provided"
                country = "Not provided"
            
            # Calculate total amount
            total_amount = sum(item.get('price', 0) for item in cart)
            
            # Format and send the comprehensive order email
            html_body = f"<h1>🎯 New ScreenMerch Order #{order_id}</h1>"
            html_body += f"<p><strong>Items:</strong> {len(cart)}</p>"
            html_body += f"<p><strong>Total Amount:</strong> ${total_amount:.2f}</p>"
            html_body += f"<hr>"
            
            # Simplified - no customer details or shipping address
            
            # Products with Images
            html_body += f"<h2>🛍️ Products</h2>"
            
            # Collect email attachments for base64 screenshots
            email_attachments = []
            attachment_cids = {}
            
            # First check order-level screenshot as fallback
            order_level_screenshot = order_data.get('selected_screenshot') or order_data.get('thumbnail') or order_data.get('screenshot')
            logger.info(f"📸 [WEBHOOK] Order-level screenshot check: selected_screenshot={bool(order_data.get('selected_screenshot'))}, thumbnail={bool(order_data.get('thumbnail'))}, screenshot={bool(order_data.get('screenshot'))}, found={bool(order_level_screenshot)}")
            if order_level_screenshot:
                screenshot_type = "base64" if isinstance(order_level_screenshot, str) and 'data:image' in order_level_screenshot else "URL"
                logger.info(f"📸 [WEBHOOK] Found order-level screenshot (type: {screenshot_type}, length: {len(str(order_level_screenshot))} chars): {str(order_level_screenshot)[:100]}...")
            
            # CRITICAL: Only add ONE screenshot attachment per order, not per cart item
            # All items share the same screenshot, so we only need one attachment
            screenshot_attachment_added = False
            screenshot_cid = None
            screenshot_data = None
            screenshot_format = None
            
            # Get the screenshot once from order-level or first cart item
            order_screenshot = order_level_screenshot or (cart[0].get('selected_screenshot') if cart else None) or (cart[0].get('screenshot') if cart else None) or (cart[0].get('img') if cart else None) or (cart[0].get('thumbnail') if cart else None) or ''
            
            # Add screenshot as attachment ONCE if it's a base64 image
            if order_screenshot and isinstance(order_screenshot, str) and 'data:image' in order_screenshot:
                try:
                    # Parse data URL: data:image/png;base64,<data>
                    header, data = order_screenshot.split(',', 1)
                    screenshot_format = header.split('/')[1].split(';')[0]  # png, jpeg, etc.
                    screenshot_data = data  # Already base64 encoded from data URL
                    
                    # Generate CID for embedding (use order_id, not item index)
                    screenshot_cid = f"screenshot_{order_id}_0"
                    
                    # Add as attachment ONCE (Resend format: content should be base64 string)
                    email_attachments.append({
                        "filename": f"screenshot.{screenshot_format}",
                        "content": screenshot_data,  # Already base64 encoded
                        "cid": screenshot_cid
                    })
                    screenshot_attachment_added = True
                    logger.info(f"📎 [WEBHOOK] Added ONE screenshot attachment with CID: {screenshot_cid} (for entire order, not per item)")
                except Exception as e:
                    logger.error(f"⚠️ [WEBHOOK] Failed to convert base64 to attachment: {str(e)}")
            
            # Generate print-quality images for each product (but reuse same CID/attachment)
            print_quality_images = []
            for i, item in enumerate(cart):
                try:
                    # Get screenshot from cart item - check selected_screenshot first (this is where we store it)
                    # Fallback to order-level screenshot if not in cart item
                    screenshot_url = item.get('selected_screenshot') or item.get('screenshot') or item.get('img') or item.get('thumbnail') or order_level_screenshot or ''
                    logger.info(f"📸 [WEBHOOK] Item {i} screenshot check: selected_screenshot={bool(item.get('selected_screenshot'))}, screenshot={bool(item.get('screenshot'))}, img={bool(item.get('img'))}, thumbnail={bool(item.get('thumbnail'))}, found={bool(screenshot_url)}")
                    
                    if screenshot_url:
                        if isinstance(screenshot_url, str) and 'data:image' in screenshot_url:
                            # Use the same CID for all items (they share the same screenshot)
                            if screenshot_attachment_added and screenshot_cid:
                                # Reuse the CID we already created
                                print_quality_images.append({
                                    'index': i,
                                    'preview': f"cid:{screenshot_cid}",  # Use same CID for all items
                                    'cid': f"cid:{screenshot_cid}",
                                    'fallback_base64': screenshot_url,  # Keep as fallback if needed
                                    'note': 'User-selected screenshot (original, not upgraded)',
                                    'dimensions': {},
                                    'download_url': screenshot_url  # Store for download link
                                })
                                logger.info(f"📸 [WEBHOOK] Item {i} using shared screenshot CID: {screenshot_cid}")
                            else:
                                # Fallback: try direct base64 embedding (shouldn't happen if attachment was added)
                                print_quality_images.append({
                                    'index': i,
                                    'preview': screenshot_url,
                                    'note': 'User-selected screenshot (base64)'
                                })
                        elif isinstance(screenshot_url, str) and (screenshot_url.startswith('http') or screenshot_url.startswith('https')):
                            # This is a URL - use it directly
                            print_quality_images.append({
                                'index': i,
                                'preview': screenshot_url,
                                'note': 'User-selected screenshot (URL)'
                            })
                        else:
                            # Unknown format - try to use it anyway
                            print_quality_images.append({
                                'index': i,
                                'preview': str(screenshot_url),
                                'note': 'User-selected screenshot'
                            })
                    else:
                        # No screenshot found - log detailed info
                        logger.warning(f"⚠️ [WEBHOOK] No screenshot found for item {i}")
                        logger.warning(f"⚠️ [WEBHOOK] Cart item keys: {list(item.keys())}")
                        logger.warning(f"⚠️ [WEBHOOK] Cart item values: {str(item)[:200]}...")
                        logger.warning(f"⚠️ [WEBHOOK] Order-level screenshot available: {bool(order_level_screenshot)}")
                        # Use order-level screenshot as fallback
                        if order_level_screenshot:
                            print_quality_images.append({
                                'index': i,
                                'preview': order_level_screenshot if isinstance(order_level_screenshot, str) and not order_level_screenshot.startswith('data:image') else '',
                                'fallback_base64': order_level_screenshot if isinstance(order_level_screenshot, str) and 'data:image' in order_level_screenshot else '',
                                'note': 'Screenshot from order level'
                            })
                        else:
                            print_quality_images.append({
                                'index': i,
                                'preview': '',
                                'note': 'No screenshot available'
                            })
                except Exception as e:
                    logger.error(f"Error processing print quality for item {i}: {str(e)}")
                    print_quality_images.append({
                        'index': i,
                        'preview': item.get('selected_screenshot') or item.get('screenshot') or item.get('img', ''),
                        'note': 'Preview only'
                    })
            
            # CRITICAL: Only show ONE image per order, not per cart item
            # Display the screenshot once at the top, then list all products below
            screenshot_displayed = False
            screenshot_cid = None
            
            # Display screenshot once if available
            if print_quality_images and len(print_quality_images) > 0:
                first_image = print_quality_images[0]
                if first_image.get('preview'):
                    preview = first_image.get('preview', '')
                    if preview.startswith('cid:'):
                        screenshot_cid = preview
                        html_body += f"""
                            <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                                <h2>📸 Order Screenshot</h2>
                                <img src='{preview}' alt='Product Screenshot' style='max-width: 300px; border-radius: 6px; border: 1px solid #ddd;'>
                                <p><em>{first_image.get('note', 'User-selected screenshot')}</em></p>
                            </div>
                        """
                        screenshot_displayed = True
                    elif preview:
                        html_body += f"""
                            <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                                <h2>📸 Order Screenshot</h2>
                                <img src='{preview}' alt='Product Screenshot' style='max-width: 300px; border-radius: 6px; border: 1px solid #ddd;'>
                                <p><em>{first_image.get('note', 'User-selected screenshot')}</em></p>
                            </div>
                        """
                        screenshot_displayed = True
            
            for i, item in enumerate(cart):
                # Determine category based on product name
                product_name = item.get('product', 'N/A')
                color = item.get('variants', {}).get('color', 'N/A')
                size = item.get('variants', {}).get('size', 'N/A')
                
                # Map product names to categories
                if 'Cropped Hoodie' in product_name:
                    category = "Women's"
                elif 'Youth Heavy Blend Hoodie' in product_name or 'Kids' in product_name:
                    category = "Kids"
                elif 'Unisex' in product_name or 'Men' in product_name:
                    category = "Men's"
                else:
                    category = "Unisex"
                
                # Get timestamp from order data
                timestamp = order_data.get('created_at', 'N/A')
                if timestamp != 'N/A':
                    try:
                        from datetime import datetime
                        if isinstance(timestamp, str):
                            timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        timestamp_str = timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')
                    except:
                        timestamp_str = str(timestamp)
                else:
                    timestamp_str = 'N/A'
                
                # Get print quality info (prefer user-selected screenshot when no print image yet)
                # Check for screenshot in cart item - selected_screenshot is where we store it
                fallback_screenshot = item.get('selected_screenshot') or item.get('screenshot') or item.get('img') or item.get('thumbnail', '')
                print_info = print_quality_images[i] if i < len(print_quality_images) else {'preview': fallback_screenshot, 'note': 'User-selected screenshot'}
                
                # Log what we're using for this item
                logger.info(f"📸 [WEBHOOK] Item {i} print_info: preview={bool(print_info.get('preview'))}, fallback={bool(print_info.get('fallback_base64'))}, note={print_info.get('note')}")
                
                # Generate image tag - prioritize preview, use fallback_base64 if preview is empty
                image_tag = ''
                if print_info.get('preview'):
                    # Use the preview (could be base64, URL, or CID)
                    image_tag = f'<img src="{print_info["preview"]}" alt="Product Screenshot" style="max-width: 400px; border-radius: 6px; border: 2px solid #007bff; display: block; margin: 10px 0;">'
                    logger.info(f"📸 [WEBHOOK] Item {i} using preview for image tag (preview length: {len(str(print_info['preview']))} chars)")
                elif print_info.get('fallback_base64'):
                    # Use fallback base64
                    image_tag = f'<img src="{print_info["fallback_base64"]}" alt="Product Screenshot (Fallback)" style="max-width: 400px; border-radius: 6px; border: 2px solid #007bff; display: block; margin: 10px 0;">'
                    logger.info(f"📸 [WEBHOOK] Item {i} using fallback_base64 for image tag")
                else:
                    # No screenshot available
                    image_tag = '<p style="color: #dc3545; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;"><strong>⚠️ Screenshot not available</strong></p>'
                    logger.warning(f"⚠️ [WEBHOOK] Item {i} has NO screenshot - preview and fallback both empty")
                
                # Get print quality info and download link
                print_quality_info_html = ""
                download_link_html = ""
                dimensions = print_info.get('dimensions', {})
                if dimensions and (dimensions.get('width', 0) >= 2000 or dimensions.get('height', 0) >= 2000):
                    width = dimensions.get('width', 0)
                    height = dimensions.get('height', 0)
                    print_quality_info_html = f"""
                        <div style='background: #d4edda; border: 1px solid #c3e6cb; padding: 10px; border-radius: 5px; margin-top: 10px;'>
                            <p style='margin: 0; color: #155724;'><strong>✅ Print Quality: 300 DPI Ready</strong></p>
                            <p style='margin: 5px 0 0 0; color: #155724; font-size: 0.9em;'>Dimensions: {width} × {height} pixels | Format: PNG</p>
                        </div>
                    """
                    # Create download link
                    download_url = print_info.get('download_url') or print_info.get('preview') or print_info.get('fallback_base64', '')
                    if download_url:
                        download_link_html = f"""
                        <p style='margin-top: 10px;'>
                            <a href='{download_url}' download='print_quality_{order_id}_{i}.png' style='background: #28a745; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block;'>📥 Download Print Quality Image</a>
                        </p>
                    """
                
                # Only show image in product listing if screenshot wasn't already displayed at top
                # This prevents duplicate images when multiple products share the same screenshot
                product_image_html = ""
                if not screenshot_displayed and image_tag:
                    # Only show image for first product if not already shown
                    product_image_html = f"""
                        <p><strong>📸 Screenshot Selected (Preview):</strong></p>
                        {image_tag}
                    """
                
                html_body += f"""
                    <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                        <h3>{category} - {product_name}</h3>
                        <p><strong>Color:</strong> {color}</p>
                        <p><strong>Size:</strong> {size}</p>
                        <p><strong>Price:</strong> ${item.get('price', 0):.2f}</p>
                        <p><strong>Note:</strong> {item.get('note', 'None')}</p>
                        <p><strong>📅 Order Time:</strong> {timestamp_str}</p>
                        {product_image_html}
                        {print_quality_info_html}
                        {download_link_html}
                    </div>
                """
            
            # Add video information section
            html_body += f"""
                <hr>
                <h2>📹 Video Information</h2>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Video Title:</strong> {order_data.get('video_title', 'Unknown Video')}</p>
                    <p><strong>Creator:</strong> {order_data.get('creator_name', 'Unknown Creator')}</p>
                    <p><strong>Video URL:</strong> {order_data.get('video_url', 'Not provided')}</p>
                    <p><strong>Screenshot Timestamp:</strong> {order_data.get('screenshot_timestamp', 'Not provided')} seconds</p>
                </div>
            """
            
            # Add action buttons section with better email client compatibility
            html_body += f"""
                <hr>
                <h2>🚀 Order Management & Print Quality</h2>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                        <td align="center">
                            <table cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding: 10px;">
                                        <a href="https://screenmerch.fly.dev/admin/order/{order_id}" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">📋 View Order Details</a>
                                    </td>
                                    <td style="padding: 10px;">
                                        <a href="https://screenmerch.fly.dev/print-quality?order_id={order_id}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">🖨️ Generate Print Quality Images</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3>📝 Quick Instructions:</h3>
                    <ol>
                        <li><strong>View Order:</strong> Click "View Order Details" to see full order information</li>
                        <li><strong>Print Quality:</strong> Use the generator to process images to 300 DPI and apply additional processing (edge feather, corner radius)</li>
                        <li><strong>Video URL:</strong> Copy the video URL from order details and paste it into the print quality tool</li>
                        <li><strong>Timestamp:</strong> Use the timestamp shown above in the print quality tool</li>
                    </ol>
                </div>
            """
            
            # Get creator_user_id from order data if available
            creator_user_id = order_data.get('creator_user_id')
            logger.info(f"🔍 [WEBHOOK] Initial creator_user_id from order_data: {creator_user_id}")
            logger.info(f"🔍 [WEBHOOK] Order data keys: {list(order_data.keys())}")
            
            if not creator_user_id:
                # Try to look up from subdomain if stored
                subdomain = order_data.get('subdomain')
                logger.info(f"🔍 [WEBHOOK] No creator_user_id found, trying subdomain lookup. Subdomain: {subdomain}")
                if subdomain:
                    try:
                        creator_result = supabase_admin.table('users').select('id').eq('subdomain', subdomain).limit(1).execute()
                        if creator_result.data and len(creator_result.data) > 0:
                            creator_user_id = creator_result.data[0]['id']
                            logger.info(f"✅ [WEBHOOK] Found creator_user_id from stored subdomain '{subdomain}': {creator_user_id}")
                        else:
                            logger.warning(f"⚠️ [WEBHOOK] No creator found for subdomain '{subdomain}'")
                    except Exception as e:
                        logger.warning(f"⚠️ [WEBHOOK] Error looking up creator from subdomain: {str(e)}")
                else:
                    logger.warning(f"⚠️ [WEBHOOK] No subdomain found in order_data, cannot look up creator")
            
            # Final check - if still no creator_user_id, log warning
            if not creator_user_id:
                logger.error(f"❌ [WEBHOOK] CRITICAL: No creator_user_id found for order {order_id}. Order will be recorded without creator tracking!")
                logger.error(f"❌ [WEBHOOK] Order data: creator_name={order_data.get('creator_name')}, subdomain={order_data.get('subdomain')}")
            else:
                logger.info(f"✅ [WEBHOOK] Using creator_user_id: {creator_user_id} for order {order_id}")
            
            # Record each sale with creator and video information
            for item in cart:
                # Add creator and video information to each item
                item['video_title'] = order_data.get('video_title', 'Unknown Video')
                item['creator_name'] = order_data.get('creator_name', 'Unknown Creator')
                
                # Extract channel_id from the order data if available
                # channel_id is now VARCHAR(255) in database, so string values work correctly
                channel_id = order_data.get('channel_id') or item.get('channel_id') or None
                record_sale(item, user_id=creator_user_id, channel_id=channel_id, order_id=order_id)
                
            # Email notifications only - no SMS
            logger.info("📧 Order notifications will be sent via email")
            
            # Send confirmation email using MAIL_TO environment variable
            logger.info(f"📧 [WEBHOOK] Email configuration check: RESEND_API_KEY={'SET' if RESEND_API_KEY else 'NOT SET'}, MAIL_TO={'SET' if MAIL_TO else 'NOT SET'}")
            
            if RESEND_API_KEY and MAIL_TO:
                email_data = {
                    "from": RESEND_FROM,
                    "to": [MAIL_TO],
                    "subject": f"🛍️ New ScreenMerch Order - {len(cart)} Item(s) - ${total_amount:.2f} - {customer_name}",
                    "html": html_body
                }
                
                # Add attachments if any (for base64 screenshots)
                if email_attachments:
                    # Convert to Resend format
                    resend_attachments = []
                    for att in email_attachments:
                        resend_att = {
                            "filename": att.get("filename", "screenshot.png"),
                            "content": att.get("content", ""),
                        }
                        # Add contentId if CID exists (for inline images)
                        if att.get("cid"):
                            resend_att["contentId"] = att.get("cid")
                        resend_attachments.append(resend_att)
                    
                    email_data["attachments"] = resend_attachments
                    logger.info(f"📎 [WEBHOOK] Adding {len(resend_attachments)} image attachments to email")
                    logger.info(f"📎 [WEBHOOK] Attachment CIDs: {[att.get('contentId') for att in resend_attachments]}")
                else:
                    logger.warning(f"⚠️ [WEBHOOK] No email attachments created - screenshots might be missing")
                
                logger.info(f"📧 [WEBHOOK] Attempting to send email to {MAIL_TO} from {RESEND_FROM}")
                logger.info(f"📧 [WEBHOOK] Email subject: {email_data['subject']}")
                logger.info(f"📧 [WEBHOOK] Email HTML length: {len(html_body)} chars")
                
                try:
                    response = requests.post(
                        "https://api.resend.com/emails",
                        headers={
                            "Authorization": f"Bearer {RESEND_API_KEY}",
                            "Content-Type": "application/json"
                        },
                        json=email_data,
                        timeout=30  # Add timeout
                    )
                    
                    logger.info(f"📧 [WEBHOOK] Resend API response status: {response.status_code}")
                    
                    if response.status_code != 200:
                        error_text = response.text
                        logger.error(f"❌ [WEBHOOK] Resend API error ({response.status_code}): {error_text}")
                        # Log the full response for debugging
                        try:
                            error_json = response.json()
                            logger.error(f"❌ [WEBHOOK] Resend error details: {error_json}")
                        except:
                            logger.error(f"❌ [WEBHOOK] Resend error (non-JSON): {error_text}")
                    else:
                        logger.info(f"✅ [WEBHOOK] Email sent successfully via Resend")
                        try:
                            resp_data = response.json()
                            logger.info(f"📧 [WEBHOOK] Email ID: {resp_data.get('id', 'unknown')}")
                        except:
                            logger.warning(f"⚠️ [WEBHOOK] Could not parse email response JSON")
                except requests.exceptions.Timeout:
                    logger.error(f"❌ [WEBHOOK] Timeout sending email via Resend (exceeded 30s)")
                except Exception as e:
                    logger.error(f"❌ [WEBHOOK] Error sending email via Resend: {str(e)}")
                    import traceback
                    logger.error(f"❌ [WEBHOOK] Full traceback: {traceback.format_exc()}")
            else:
                if not RESEND_API_KEY:
                    logger.error("❌ [WEBHOOK] RESEND_API_KEY not configured; order email not sent")
                if not MAIL_TO:
                    logger.error("❌ [WEBHOOK] MAIL_TO not configured; order email not sent")
                logger.warning("❌ [WEBHOOK] Email service not configured; order email not sent")
            
            # Send customer confirmation email after payment is confirmed
            if customer_email and customer_email != "Not provided" and RESEND_API_KEY:
                logger.info(f"📧 [WEBHOOK] Preparing customer confirmation email for {customer_email}")
                
                # Build customer-friendly confirmation email
                customer_html_body = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #333;">🎉 Thank You for Your Order!</h1>
                    <p>Hi there,</p>
                    <p>We've received your order and payment has been confirmed. We're getting it ready for you!</p>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h2 style="margin-top: 0; color: #333;">Order Details</h2>
                        <p><strong>Order Number:</strong> #{order_id[-8:].upper()}</p>
                        <p><strong>Order ID:</strong> {order_id}</p>
                        <p><strong>Items:</strong> {len(cart)}</p>
                        <p><strong style="font-size: 18px;">Total:</strong> <strong style="font-size: 18px; color: #007bff;">${total_amount:.2f}</strong></p>
                    </div>
                    
                    <h2 style="color: #333;">Order Items</h2>
                """
                
                # Add order items to customer email
                for item in cart:
                    product_name = item.get('product', 'N/A')
                    color = (item.get('variants') or {}).get('color', 'N/A')
                    size = (item.get('variants') or {}).get('size', 'N/A')
                    price = item.get('price', 0)
                    note = item.get('note', '')
                    
                    customer_html_body += f"""
                    <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
                        <h3 style="margin-top: 0; color: #333;">{product_name}</h3>
                        <p><strong>Color:</strong> {color}</p>
                        <p><strong>Size:</strong> {size}</p>
                        <p><strong>Price:</strong> ${price:.2f}</p>
                        {f'<p><strong>Note:</strong> {note}</p>' if note else ''}
                    </div>
                    """
                
                # Add video information if available
                if order_data.get('video_title') and order_data.get('video_title') != 'Unknown Video':
                    customer_html_body += f"""
                    <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #333;">📹 Video Information</h3>
                        <p><strong>Video:</strong> {order_data['video_title']}</p>
                        <p><strong>Creator:</strong> {order_data.get('creator_name', 'Unknown Creator')}</p>
                    </div>
                    """
                
                # Add shipping address if available
                if shipping_details and shipping_details.get('address'):
                    addr = shipping_details['address']
                    customer_html_body += f"""
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #333;">📦 Shipping Address</h3>
                        <p>{customer_name}<br>
                        {addr.get('line1', '')}<br>
                        {addr.get('line2', '') + '<br>' if addr.get('line2') else ''}
                        {addr.get('city', '')}, {addr.get('state', '')} {addr.get('postal_code', '')}<br>
                        {addr.get('country', '')}</p>
                    </div>
                    """
                
                customer_html_body += """
                    <p style="margin-top: 30px;">We'll send you another email when your order ships!</p>
                    <p>If you have any questions, please don't hesitate to reach out to us.</p>
                    <p>Best regards,<br>The ScreenMerch Team</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="color: #666; font-size: 12px;">This is an automated confirmation email. Please do not reply to this email.</p>
                </div>
                """
                
                try:
                    customer_email_data = {
                        "from": RESEND_FROM,
                        "to": [customer_email],
                        "subject": f"🎉 Order Confirmation - #{order_id[-8:].upper()}",
                        "html": customer_html_body,
                    }
                    
                    logger.info(f"📧 [WEBHOOK] Sending customer confirmation email to {customer_email}")
                    customer_resp = requests.post(
                        "https://api.resend.com/emails",
                        headers={
                            "Authorization": f"Bearer {RESEND_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json=customer_email_data,
                        timeout=30
                    )
                    
                    if customer_resp.status_code == 200:
                        logger.info(f"✅ [WEBHOOK] Customer confirmation email sent successfully to {customer_email}")
                        try:
                            resp_data = customer_resp.json()
                            logger.info(f"📧 [WEBHOOK] Customer email ID: {resp_data.get('id', 'unknown')}")
                            logger.info(f"📧 [WEBHOOK] Full Resend response: {resp_data}")
                        except Exception as e:
                            logger.warning(f"⚠️ [WEBHOOK] Could not parse customer email response: {e}")
                    else:
                        error_text = customer_resp.text
                        logger.error(f"❌ [WEBHOOK] Failed to send customer confirmation email ({customer_resp.status_code}): {error_text}")
                        try:
                            error_json = customer_resp.json()
                            logger.error(f"❌ [WEBHOOK] Resend error details: {error_json}")
                        except:
                            pass
                except Exception as e:
                    logger.error(f"❌ [WEBHOOK] Error sending customer confirmation email: {str(e)}")
                    import traceback
                    logger.error(f"Full traceback: {traceback.format_exc()}")
            elif not customer_email or customer_email == "Not provided":
                logger.warning(f"⚠️ [WEBHOOK] No customer email available - skipping customer confirmation email")
                logger.warning(f"⚠️ [WEBHOOK] customer_email value: '{customer_email}'")
                logger.warning(f"⚠️ [WEBHOOK] session.customer_details: {session.get('customer_details', {})}")
            elif not RESEND_API_KEY:
                logger.warning(f"⚠️ [WEBHOOK] RESEND_API_KEY not configured - skipping customer confirmation email")
                logger.warning(f"⚠️ [WEBHOOK] RESEND_API_KEY check: {bool(RESEND_API_KEY)}")
            
            # Update order status in database to 'paid' (regardless of email status)
            try:
                update_data = {
                    'status': 'paid',
                    'customer_phone': customer_phone,
                    'stripe_session_id': session.get('id'),
                    'payment_intent_id': session.get('payment_intent')
                }
                # Update customer_email in database if we have it from Stripe
                if customer_email and customer_email != "Not provided":
                    update_data['customer_email'] = customer_email
                supabase.table('orders').update(update_data).eq('order_id', order_id).execute()
                logger.info(f"✅ Updated order {order_id} status to 'paid' in database")
                
                # Ensure order is added to processing queue (trigger should do this, but ensure it manually)
                try:
                    # Use admin client to bypass RLS
                    admin_client = supabase_admin if supabase_admin else supabase
                    
                    # Check if queue entry already exists
                    queue_check = admin_client.table('order_processing_queue').select('id').eq('order_id', order_id).execute()
                    if not queue_check.data:
                        # Create queue entry if it doesn't exist
                        queue_entry = {
                            'order_id': order_id,
                            'status': 'pending',
                            'priority': 0
                        }
                        admin_client.table('order_processing_queue').insert(queue_entry).execute()
                        logger.info(f"✅ Created processing queue entry for order {order_id}")
                    else:
                        logger.info(f"✅ Processing queue entry already exists for order {order_id}")
                except Exception as queue_error:
                    logger.error(f"❌ Failed to create processing queue entry: {str(queue_error)}")
                    # Don't fail the webhook if queue creation fails
                    
            except Exception as db_error:
                logger.error(f"❌ Failed to update order status in database: {str(db_error)}")
        
        # Handle subscription events
        elif session.get("mode") == "subscription":
            logger.info(f"Subscription checkout completed: {session.get('id')}")
            
            # Get subscription details
            subscription_id = session.get("subscription")
            customer_email = session.get("customer_details", {}).get("email", "No email provided")
            user_id = session.get("metadata", {}).get("user_id", "guest")
            tier = session.get("metadata", {}).get("tier", "pro")
            
            # Send admin notification for new subscriber
            admin_subscription_email = f"""
            🎉 NEW SCREENMERCH PRO SUBSCRIBER!
            
            Subscription Details:
            - Customer Email: {customer_email}
            - User ID: {user_id}
            - Tier: {tier}
            - Subscription ID: {subscription_id}
            - Session ID: {session.get('id')}
            
            This customer has started their 7-day free trial and will be charged $9.99/month after the trial period.
            """
            
            # Send admin notification email
            admin_email_data = {
                "from": RESEND_FROM,
                "to": [MAIL_TO],
                "subject": f"🎉 New ScreenMerch Pro Subscriber: {customer_email}",
                "html": f"""
                <h1>🎉 New ScreenMerch Pro Subscriber!</h1>
                <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50;">
                    <h2>Subscription Details:</h2>
                    <p><strong>Customer Email:</strong> {customer_email}</p>
                    <p><strong>User ID:</strong> {user_id}</p>
                    <p><strong>Tier:</strong> {tier}</p>
                    <p><strong>Subscription ID:</strong> {subscription_id}</p>
                    <p><strong>Session ID:</strong> {session.get('id')}</p>
                    <p><strong>Trial Status:</strong> 7-day free trial activated</p>
                    <p><strong>Billing:</strong> $9.99/month after trial period</p>
                </div>
                <p>This customer has started their 7-day free trial and will be charged $9.99/month after the trial period.</p>
                """
            }
            
            try:
                response = requests.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json=admin_email_data
                )
                if response.status_code == 200:
                    logger.info(f"✅ Admin notification sent for new subscriber: {customer_email}")
                else:
                    logger.error(f"❌ Failed to send admin notification: {response.text}")
            except Exception as e:
                logger.error(f"❌ Error sending admin notification: {str(e)}")
            
            # Also send welcome email to customer
            if customer_email and customer_email != "No email provided":
                try:
                    customer_welcome_email = {
                        "from": RESEND_FROM,
                        "to": [customer_email],
                        "subject": "Welcome to ScreenMerch Pro! 🎉",
                        "html": f"""
                        <h1>Welcome to ScreenMerch Pro!</h1>
                        <p>Your 7-day free trial has started. You now have access to all Pro features:</p>
                        <ul>
                            <li>✅ Upload and share your videos</li>
                            <li>✅ Create custom product pages</li>
                            <li>✅ Sell merchandise with revenue sharing</li>
                            <li>✅ Priority customer support</li>
                            <li>✅ Custom branding and channel colors</li>
                            <li>✅ Enhanced upload limits (2GB, 60 minutes)</li>
                            <li>✅ Analytics and sales tracking</li>
                            <li>✅ Creator dashboard and tools</li>
                            <li>✅ Ad-free viewing experience</li>
                            <li>✅ Early access to new features</li>
                        </ul>
                        <p>Your trial ends in 7 days. You can cancel anytime before then.</p>
                        <p>Start creating amazing content!</p>
                        """
                    }
                    
                    response = requests.post(
                        "https://api.resend.com/emails",
                        headers={
                            "Authorization": f"Bearer {RESEND_API_KEY}",
                            "Content-Type": "application/json"
                        },
                        json=customer_welcome_email
                    )
                    if response.status_code == 200:
                        logger.info(f"✅ Welcome email sent to {customer_email}")
                    else:
                        logger.error(f"❌ Failed to send welcome email: {response.text}")
                except Exception as e:
                    logger.error(f"❌ Error sending welcome email: {str(e)}")

    return "", 200

# NEW: Printful API endpoints
@app.route("/api/printful/create-product", methods=["POST"])
def create_printful_product():
    """Create product in Printful automatically"""
    try:
        data = request.get_json()
        thumbnail = data['thumbnail']
        video_url = data['videoUrl']
        product_type = data['productType']
        variants = data['variants']
        
        # Create automated product in Printful
        result = printful_integration.create_automated_product({
            'image': thumbnail,
            'productType': product_type,
            'variants': variants,
            'videoUrl': video_url
        })
        
        if result['success']:
            # Store Printful product info in database
            product_data = {
                "product_id": str(uuid.uuid4()),
                "printful_product_id": result['product_id'],
                "thumbnail_url": result['image_url'],
                "video_url": video_url,
                "mockups": result['mockups']
            }
            
            # Save to Supabase
            supabase.table('products').insert(product_data).execute()
            
            return jsonify({
                "success": True,
                "product_url": f"http://127.0.0.1:5000/product/{product_data['product_id']}",
                "mockups": result['mockups']
            })
        else:
            return jsonify({
                "success": False,
                "error": result['error']
            }), 500
            
    except Exception as e:
        logger.error(f"Printful product creation error: {str(e)}")
        return jsonify(success=False, error="Internal server error"), 500

@app.route("/api/printful/create-order", methods=["POST"])
def create_printful_order():
    """Create order in Printful automatically"""
    try:
        data = request.get_json()
        cart = data['cart']
        customer_info = data['customerInfo']
        
        # Create order in Printful
        result = printful_integration.create_order({
            'customerInfo': customer_info,
            'items': cart,
            'shippingAddress': customer_info['shipping_address']
        })
        
        if result['success']:
            return jsonify({
                "success": True,
                "order_id": result['order_id'],
                "tracking_url": result['printful_order'].get('tracking_url', '')
            })
        else:
            return jsonify({
                "success": False,
                "error": result['error']
            }), 500
            
    except Exception as e:
        logger.error(f"Printful order creation error: {str(e)}")
        return jsonify(success=False, error="Internal server error"), 500

@app.route("/api/videos", methods=["GET"])
def get_videos():
    try:
        response = supabase.table("videos2").select("*").order("created_at", desc=True).limit(20).execute()
        return jsonify(response.data), 200
    except Exception as e:
        logger.error(f"Error fetching videos: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/search/creators", methods=["GET", "OPTIONS"])
@cross_origin(origins=[], supports_credentials=True)
def search_creators():
    """Search for creators by username or display name - Updated"""
    logger.info("Search creators endpoint called - v2")
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        return response
    
    try:
        query = request.args.get('q', '').strip()
        if not query or len(query) < 2:
            return jsonify({
                "success": False,
                "error": "Search query must be at least 2 characters"
            }), 400
        
        # Simple search for creators in the users table
        response = supabase.table("users").select(
            "id, username, display_name, profile_image_url, cover_image_url, bio, created_at"
        ).or_(
            f"username.ilike.%{query}%,display_name.ilike.%{query}%"
        ).not_("username", "is", None).order("created_at", desc=True).limit(20).execute()
        
        if response.data:
            # Return results with basic video count
            creators_with_counts = []
            for creator in response.data:
                creators_with_counts.append({
                    **creator,
                    "video_count": 0  # Simplified for now
                })
            
            return jsonify({
                "success": True,
                "results": creators_with_counts
            }), 200
        else:
            return jsonify({
                "success": True,
                "results": []
            }), 200
            
    except Exception as e:
        logger.error(f"Error searching creators: {e}")
        return jsonify({
            "success": False,
            "error": f"Search failed: {str(e)}"
        }), 500

# NEW: Video Screenshot Capture Endpoints
@app.route("/api/capture-screenshot", methods=["POST", "OPTIONS"])
def capture_screenshot():
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        return response
    
    """Capture a single screenshot from a video at a specific timestamp with optional cropping"""
    try:
        data = request.get_json()
        video_url = data.get('video_url')
        timestamp = data.get('timestamp', 0)
        quality = data.get('quality', 95)
        crop_area = data.get('crop_area')  # New: crop area data
        
        if not video_url:
            return jsonify({"success": False, "error": "video_url is required"}), 400
        
        logger.info(f"Capturing screenshot from {video_url} at timestamp {timestamp}")
        if crop_area:
            logger.info(f"Crop area provided: {crop_area}")
        
        result = screenshot_capture.capture_screenshot(video_url, timestamp, quality, crop_area)
        
        if result['success']:
            logger.info("Screenshot captured successfully")
            response = jsonify(result)
            return response
        else:
            logger.error(f"Screenshot capture failed: {result['error']}")
            response = jsonify(result)
            return response, 500
            
    except Exception as e:
        logger.error(f"Error in capture_screenshot: {str(e)}")
        response = jsonify({"success": False, "error": f"Internal server error: {str(e)}"})
        return response, 500

@app.route("/api/capture-multiple-screenshots", methods=["POST", "OPTIONS"])
def capture_multiple_screenshots():
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        return response
    """Capture multiple screenshots from a video at different timestamps"""
    try:
        data = request.get_json()
        video_url = data.get('video_url')
        timestamps = data.get('timestamps', [0, 2, 4, 6, 8])
        quality = data.get('quality', 95)
        
        if not video_url:
            return jsonify({"success": False, "error": "video_url is required"}), 400
        
        logger.info(f"Capturing multiple screenshots from {video_url} at timestamps {timestamps}")
        
        result = screenshot_capture.capture_multiple_screenshots(video_url, timestamps, quality)
        
        if result['success']:
            logger.info(f"Captured {len(result['screenshots'])} screenshots successfully")
            return jsonify(result)
        else:
            logger.error(f"Multiple screenshot capture failed: {result['error']}")
            return jsonify(result), 500
            
    except Exception as e:
        logger.error(f"Error in capture_multiple_screenshots: {str(e)}")
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500

@app.route("/api/video-info", methods=["POST", "OPTIONS"])
def get_video_info():
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        return response
    """Get video information including duration and dimensions"""
    try:
        data = request.get_json()
        video_url = data.get('video_url')
        
        if not video_url:
            return jsonify({"success": False, "error": "video_url is required"}), 400
        
        logger.info(f"Getting video info for {video_url}")
        
        result = screenshot_capture.get_video_info(video_url)
        
        if result['success']:
            logger.info(f"Video info retrieved: {result['duration']}s, {result['width']}x{result['height']}")
            return jsonify(result)
        else:
            logger.error(f"Failed to get video info: {result['error']}")
            return jsonify(result), 500
            
    except Exception as e:
        logger.error(f"Error in get_video_info: {str(e)}")
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500

@app.route("/api/capture-print-quality", methods=["POST", "OPTIONS"])
def capture_print_quality():
    """Capture a high-quality screenshot optimized for print production"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        return response
    
    try:
        data = request.get_json()
        video_url = data.get('video_url')
        timestamp = data.get('timestamp', 0)
        crop_area = data.get('crop_area')
        print_dpi = data.get('print_dpi', 300)
        
        if not video_url:
            return jsonify({"success": False, "error": "video_url is required"}), 400
        
        logger.info(f"Capturing PRINT QUALITY screenshot from {video_url} at timestamp {timestamp}")
        if crop_area:
            logger.info(f"Crop area provided: {crop_area}")
        
        result = screenshot_capture.capture_print_quality_screenshot(
            video_url, 
            timestamp, 
            crop_area, 
            print_dpi
        )
        
        if result['success']:
            logger.info(f"Print quality screenshot captured: {result.get('dimensions', {}).get('width', 'unknown')}x{result.get('dimensions', {}).get('height', 'unknown')}, {result.get('file_size', 0):,} bytes")
            response = jsonify(result)
            return response
        else:
            logger.error(f"Print quality screenshot capture failed: {result['error']}")
            response = jsonify(result)
            return response, 500
            
    except Exception as e:
        logger.error(f"Error in capture_print_quality: {str(e)}")
        response = jsonify({"success": False, "error": f"Internal server error: {str(e)}"})
        return response, 500

@app.route("/api/process-shirt-image", methods=["POST", "OPTIONS"])
def process_shirt_image():
    """Process an image to be shirt-print ready with feathered edges"""
    # Handle CORS
    origin = request.headers.get('Origin')
    allowed_origins = ["https://screenmerch.fly.dev", "https://screenmerch.com", "https://www.screenmerch.com"]
    cors_origin = origin if origin in allowed_origins else "https://screenmerch.fly.dev"
    
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        return response
    
    try:
        data = request.get_json()
        image_data = data.get("image_data")
        feather_radius = data.get("feather_radius", 12)
        enhance_quality = data.get("enhance_quality", True)
        
        if not image_data:
            response = jsonify({"success": False, "error": "image_data is required"})
            return response, 400
        
        logger.info(f"Processing shirt image with feather_radius={feather_radius}, enhance_quality={enhance_quality}")
        
        # Process the image for shirt printing (feather only - working version)
        processed_image = screenshot_capture.create_shirt_ready_image(
            image_data, 
            feather_radius=feather_radius, 
            enhance_quality=enhance_quality
        )
        
        logger.info("Shirt image processed successfully")
        response = jsonify({
            "success": True,
            "processed_image": processed_image
        })
        return response
            
    except Exception as e:
        logger.error(f"Error processing shirt image: {str(e)}")
        response = jsonify({"success": False, "error": f"Internal server error: {str(e)}"})
        return response, 500

@app.route("/api/process-corner-radius", methods=["POST", "OPTIONS"])
def process_corner_radius():
    """Process an image to apply corner radius only - using same approach as feather"""
    # Handle CORS
    origin = request.headers.get('Origin')
    allowed_origins = ["https://screenmerch.fly.dev", "https://screenmerch.com", "https://www.screenmerch.com"]
    cors_origin = origin if origin in allowed_origins else "https://screenmerch.fly.dev"
    
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        return response
    
    try:
        data = request.get_json()
        image_data = data.get("image_data")
        corner_radius = data.get("corner_radius", 15)
        
        if not image_data:
            response = jsonify({"success": False, "error": "image_data is required"})
            return response, 400
        
        logger.info(f"Processing corner radius with radius={corner_radius}")
        logger.info(f"Image data type: {type(image_data)}, length: {len(image_data) if image_data else 0}")
        
        # Apply corner radius effect using the dedicated function
        try:
            result = sc_module.apply_corner_radius_only(image_data, corner_radius)
            logger.info(f"Corner radius result: success={result.get('success') if result else False}, has_processed_image={bool(result.get('processed_image') if result else False)}")
        except Exception as func_error:
            logger.error(f"Error calling apply_corner_radius_only: {str(func_error)}")
            response = jsonify({"success": False, "error": f"Function error: {str(func_error)}"})
            return response, 500
        
        if result and result.get('success'):
            processed_img = result.get('processed_image')
            if not processed_img:
                logger.error("Result has success=True but no processed_image field")
                response = jsonify({"success": False, "error": "No processed image returned from function"})
                return response, 500
            
            response = jsonify({
                "success": True,
                "processed_image": processed_img
            })
            return response
        else:
            error_msg = result.get('error', 'Failed to apply corner radius') if result else 'Failed to apply corner radius'
            logger.error(f"Corner radius processing failed: {error_msg}")
            response = jsonify({"success": False, "error": error_msg})
            return response, 500
            
    except Exception as e:
        logger.error(f"Error processing corner radius: {str(e)}")
        response = jsonify({"success": False, "error": f"Internal server error: {str(e)}"})
        return response, 500

@app.route("/api/apply-feather-to-print-quality", methods=["POST", "OPTIONS"])
def apply_feather_to_print_quality():
    """Apply feather effect to a print quality image"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        return response
    
    try:
        data = request.get_json()
        image_data = data.get("image_data")
        feather_radius = data.get("feather_radius", 12)
        
        if not image_data:
            return jsonify({"success": False, "error": "image_data is required"}), 400
        
        logger.info(f"Applying feather effect to print quality image with radius={feather_radius}")
        
        # Apply feather effect to the print quality image
        processed_image = sc_module.apply_feather_to_print_quality(image_data, feather_radius)
        
        if processed_image:
            return jsonify({
                "success": True,
                "processed_image": processed_image
            })
        else:
            return jsonify({"success": False, "error": "Failed to apply feather effect"}), 500
            
    except Exception as e:
        logger.error(f"Error applying feather to print quality: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route("/api/apply-feather-only", methods=["POST", "OPTIONS"])
def apply_feather_only():
    """Apply feather effect to an image without other processing"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        return response
    
    try:
        data = request.get_json()
        thumbnail_data = data.get("thumbnail_data")
        crop_area = data.get("crop_area")
        feather_radius = data.get("feather_radius", 10)
        
        if not thumbnail_data:
            return jsonify({"success": False, "error": "thumbnail_data is required"}), 400
        
        logger.info(f"Applying feather effect with radius={feather_radius}")
        if crop_area:
            logger.info(f"Crop area provided: {crop_area}")
        
        # Apply feather effect to the image
        processed_image = sc_module.apply_feather_effect(
            thumbnail_data, 
            feather_radius=feather_radius,
            crop_area=crop_area
        )
        
        logger.info("Feather effect applied successfully")
        return jsonify({
            "success": True,
            "screenshot": processed_image,
            "effect": "feather"
        })
            
    except Exception as e:
        logger.error(f"Error applying feather effect: {str(e)}")
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500

@app.route("/api/process-thumbnail-print-quality", methods=["POST", "OPTIONS"])
def process_thumbnail_print_quality():
    """Process a thumbnail image for print quality output"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        # Handle CORS preflight with correct origin for image tool
        origin = request.headers.get('Origin')
        logger.info(f"🔍 [IMAGE_TOOL] OPTIONS preflight - Origin: {origin}")
        logger.info(f"🔍 [IMAGE_TOOL] Request headers: {dict(request.headers)}")
        if origin in ["https://screenmerch.fly.dev", "https://screenmerch.com", "https://www.screenmerch.com"]:
            logger.info(f"✅ [IMAGE_TOOL] Set CORS origin to: {origin}")
        else:
            logger.info(f"⚠️ [IMAGE_TOOL] Origin not in allowed list, defaulting to: https://screenmerch.fly.dev")
        return response
    
    try:
        data = request.get_json()
        thumbnail_data = data.get("thumbnail_data")
        print_dpi = data.get("print_dpi", 300)
        soft_corners = data.get("soft_corners", False)
        edge_feather = data.get("edge_feather", False)
        crop_area = data.get("crop_area")
        # New numeric and frame parameters
        corner_radius_percent = data.get("corner_radius_percent", 0)
        feather_edge_percent = data.get("feather_edge_percent", 0)
        frame_enabled = data.get("frame_enabled", False)
        frame_color = data.get("frame_color", "#FF0000")
        frame_width = int(data.get("frame_width", 10))  # Ensure it's an integer
        double_frame = data.get("double_frame", False)
        add_white_background = data.get("add_white_background", False)
        # Print area dimensions (in inches) - if provided, will be used to set exact output size
        print_area_width = data.get("print_area_width")
        print_area_height = data.get("print_area_height")
        
        # Validate frame_width is within reasonable bounds (1-100px)
        frame_width = max(1, min(100, frame_width))
        
        if not thumbnail_data:
            response = jsonify({"success": False, "error": "thumbnail_data is required"})
            return response, 400
        
        # Log thumbnail_data info for debugging (without logging the full base64 string)
        thumbnail_type = type(thumbnail_data).__name__
        thumbnail_length = len(str(thumbnail_data)) if thumbnail_data else 0
        thumbnail_preview = str(thumbnail_data)[:100] if thumbnail_data else "None"
        logger.info(f"📧 [PRINT_QUALITY] Processing thumbnail - Type: {thumbnail_type}, Length: {thumbnail_length}, Preview: {thumbnail_preview}...")
        logger.info(f"📧 [PRINT_QUALITY] DPI={print_dpi}, soft_corners={soft_corners}, edge_feather={edge_feather}")
        logger.info(f"📧 [PRINT_QUALITY] corner_radius_percent={corner_radius_percent}, feather_edge_percent={feather_edge_percent}")
        logger.info(f"📧 [PRINT_QUALITY] frame_enabled={frame_enabled}, frame_color={frame_color}, frame_width={frame_width}, double_frame={double_frame}")
        logger.info(f"📧 [PRINT_QUALITY] add_white_background={add_white_background}")
        if crop_area:
            logger.info(f"📧 [PRINT_QUALITY] Crop area provided: {crop_area}")
        
        # Process the thumbnail for print quality
        result = screenshot_capture.process_thumbnail_for_print(
            thumbnail_data,
            print_dpi=print_dpi,
            soft_corners=soft_corners,
            edge_feather=edge_feather,
            crop_area=crop_area,
            corner_radius_percent=corner_radius_percent,
            feather_edge_percent=feather_edge_percent,
            frame_enabled=frame_enabled,
            frame_color=frame_color,
            frame_width=frame_width,
            double_frame=double_frame,
            add_white_background=add_white_background,
            print_area_width=print_area_width,
            print_area_height=print_area_height
        )
        
        if result['success']:
            logger.info(f"Thumbnail processed for print: {result.get('dimensions', {}).get('width', 'unknown')}x{result.get('dimensions', {}).get('height', 'unknown')}")
            response = jsonify(result)
            # Add CORS headers for image tool
            origin = request.headers.get('Origin')
            logger.info(f"🔍 [IMAGE_TOOL] POST success - Origin: {origin}")
            if origin in ["https://screenmerch.fly.dev", "https://screenmerch.com", "https://www.screenmerch.com"]:
                logger.info(f"✅ [IMAGE_TOOL] Set CORS origin to: {origin}")
            else:
                logger.info(f"⚠️ [IMAGE_TOOL] Origin not in allowed list, defaulting to: https://screenmerch.fly.dev")
            return response
        else:
            logger.error(f"Thumbnail processing failed: {result['error']}")
            response = jsonify(result)
            return response, 500
            
    except Exception as e:
        logger.error(f"Error processing thumbnail for print quality: {str(e)}")
        response = jsonify({"success": False, "error": f"Internal server error: {str(e)}"})
        return response, 500

@app.route("/api/get-order-screenshot/<order_id>")
def get_order_screenshot(order_id):
    """Get screenshot data for a specific order"""
    try:
        # First try to get order from database using order_id field
        result = supabase.table('orders').select('*').eq('order_id', order_id).execute()
        
        # If not found, try common alternative keys
        if not result.data:
            alt_result = supabase.table('orders').select('*').eq('id', order_id).execute()
            if alt_result.data:
                result = alt_result
            else:
                alt2_result = supabase.table('orders').select('*').eq('order_number', order_id).execute()
                if alt2_result.data:
                    result = alt2_result
        
        if not result.data:
            # Fallback: try to get from in-memory order_store
            if order_id in order_store:
                order_data = order_store[order_id]
                logger.info(f"✅ Retrieved order {order_id} from in-memory store")
            else:
                response = jsonify({
                    "success": False,
                    "error": "Order not found"
                })
                return response, 404
        else:
            order_data = result.data[0]
            logger.info(f"✅ Retrieved order {order_id} from database")
        
        # Extract screenshot data from cart items - return all products with their images
        cart = order_data.get('cart', [])
        
        logger.info(f"🔍 [GET-SCREENSHOT] Looking for screenshots in order {order_id}")
        logger.info(f"🔍 [GET-SCREENSHOT] Order data keys: {list(order_data.keys())}")
        logger.info(f"🔍 [GET-SCREENSHOT] Cart has {len(cart)} items")
        
        # Check for order-level screenshot (fallback for single screenshot orders)
        order_level_screenshot = None
        if order_data.get('selected_screenshot'):
            order_level_screenshot = order_data.get('selected_screenshot')
        elif order_data.get('thumbnail'):
            order_level_screenshot = order_data.get('thumbnail')
        elif order_data.get('screenshot'):
            order_level_screenshot = order_data.get('screenshot')
        elif order_data.get('image_url'):
            order_level_screenshot = order_data.get('image_url')
        elif order_data.get('screenshot_data'):
            order_level_screenshot = order_data.get('screenshot_data')
        elif order_data.get('thumbnail_data'):
            order_level_screenshot = order_data.get('thumbnail_data')
        
        # Build products list with their screenshots - include ALL products even if they share screenshots
        products = []
        for idx, item in enumerate(cart):
            product_name = item.get('product', f'Product {idx + 1}')
            color = (item.get('variants') or {}).get('color', 'N/A')
            size = (item.get('variants') or {}).get('size', 'N/A')
            
            # Find screenshot for this product - check item-specific fields first
            screenshot_data = None
            if item.get('selected_screenshot'):
                screenshot_data = item.get('selected_screenshot')
                logger.info(f"✅ Found screenshot in cart item {idx} ({product_name}) selected_screenshot")
            elif item.get('img'):
                screenshot_data = item.get('img')
                logger.info(f"✅ Found screenshot in cart item {idx} ({product_name}) img")
            elif item.get('screenshot'):
                screenshot_data = item.get('screenshot')
                logger.info(f"✅ Found screenshot in cart item {idx} ({product_name}) screenshot")
            elif item.get('thumbnail'):
                screenshot_data = item.get('thumbnail')
                logger.info(f"✅ Found screenshot in cart item {idx} ({product_name}) thumbnail")
            elif order_level_screenshot:
                # Use order-level screenshot as fallback - ALL products can use this
                screenshot_data = order_level_screenshot
                logger.info(f"✅ Using order-level screenshot for cart item {idx} ({product_name})")
            
            # Always add product to list, even if screenshot is shared (user can still process each product separately)
            if screenshot_data:
                products.append({
                    "index": idx,
                    "product": product_name,
                    "screenshot": screenshot_data,
                    "color": color,
                    "size": size
                })
            else:
                # Even if no screenshot found, add product so user knows it exists (they can still process it)
                logger.warning(f"⚠️ No screenshot found for cart item {idx} ({product_name}), but adding to list anyway")
                products.append({
                    "index": idx,
                    "product": product_name,
                    "screenshot": order_level_screenshot or '',  # Use order-level or empty
                    "color": color,
                    "size": size
                })
        
        # If no products found but we have order-level screenshot, create a single product entry
        if not products and order_level_screenshot:
            products.append({
                "index": 0,
                "product": "Order Screenshot",
                "screenshot": order_level_screenshot,
                "color": "N/A",
                "size": "N/A"
            })
        
        if products:
            # Return first product's screenshot for backward compatibility, plus all products
            first_screenshot = products[0]['screenshot']
            screenshot_preview = str(first_screenshot)[:100] if first_screenshot else "None"
            screenshot_type = "base64" if isinstance(first_screenshot, str) and first_screenshot.startswith('data:image') else "URL"
            logger.info(f"✅ [GET-SCREENSHOT] Found {len(products)} product(s) with screenshots (type: {screenshot_type}, preview: {screenshot_preview}...)")
            
            response = jsonify({
                "success": True,
                "screenshot": first_screenshot,  # Backward compatibility - first product's screenshot
                "products": products,  # All products with their screenshots
                "order_id": order_id,
                "video_title": order_data.get('video_title', 'Unknown Video'),
                "creator_name": order_data.get('creator_name', 'Unknown Creator')
            })
            # Add CORS headers for image tool
            origin = request.headers.get('Origin')
            logger.info(f"🔍 [IMAGE_TOOL] get-order-screenshot success - Origin: {origin}")
            if origin in ["https://screenmerch.fly.dev", "https://screenmerch.com", "https://www.screenmerch.com"]:
                logger.info(f"✅ [IMAGE_TOOL] Set CORS origin to: {origin}")
            else:
                logger.info(f"⚠️ [IMAGE_TOOL] Origin not in allowed list, defaulting to: https://screenmerch.com")
            return response
        else:
            logger.warning(f"⚠️ [GET-SCREENSHOT] No screenshot found for order {order_id}")
            logger.warning(f"⚠️ [GET-SCREENSHOT] Order keys: {list(order_data.keys())}")
            logger.warning(f"⚠️ [GET-SCREENSHOT] First cart item (if exists): {cart[0] if cart else 'No cart items'}")
            
            response = jsonify({
                "success": False,
                "error": "No screenshot data found for this order"
            })
            return response, 404
            
    except Exception as e:
        logger.error(f"Error getting order screenshot: {str(e)}")
        response = jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        })
        return response, 500

@app.route("/print-quality")
def print_quality_page():
    """Serve the print quality image generator page"""
    order_id = request.args.get('order_id')
    response = make_response(render_template('print_quality.html', order_id=order_id))
    # Set permissive CSP for this page since it needs to make API calls to the same domain
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' https: data: blob:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://screenmerch.fly.dev; "
        "frame-src 'self'; "
        "object-src 'none';"
    )
    return response

# Safe profile fields only - never expose password_hash, tokens, or internal data to client
USER_PROFILE_SAFE_FIELDS = [
    "id", "email", "display_name", "profile_image_url", "cover_image_url",
    "role", "status", "subdomain", "bio", "username", "created_at", "updated_at"
]

@app.route("/api/users/me", methods=["GET", "OPTIONS"])
@app.route("/api/users/me/", methods=["GET", "OPTIONS"])
def get_my_profile():
    """Return current user's profile with only safe, necessary fields. Requires sm_session cookie (or X-Session-Token/Authorization) and X-User-Id to match."""
    if request.method == "OPTIONS":
        return jsonify(success=True)
    try:
        token = request.cookies.get("sm_session")
        if not token and request.headers.get("X-Session-Token"):
            token = request.headers.get("X-Session-Token").strip()
        if not token and request.headers.get("Authorization"):
            auth = request.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                token = auth[7:].strip()
        store = app.config.get("session_token_store") or {}
        user_id_from_session = store.get(token) if token else None
        if not user_id_from_session:
            return jsonify({"error": "Authentication required (valid session cookie)"}), 401
        user_id = request.headers.get("X-User-Id") or request.args.get("user_id")
        if not user_id or not str(user_id).strip():
            return jsonify({"error": "X-User-Id header or user_id query is required"}), 401
        user_id = str(user_id).strip()
        if str(user_id_from_session) != user_id:
            return jsonify({"error": "Forbidden"}), 403
        client_to_use = supabase_admin if supabase_admin else supabase
        result = client_to_use.table("users").select(",".join(USER_PROFILE_SAFE_FIELDS)).eq("id", user_id).limit(1).execute()
        if not result.data or len(result.data) == 0:
            return jsonify({"error": "User not found"}), 404
        user = result.data[0]
        # Return only keys that exist and are in safe list (no extra columns leaked)
        out = {k: user.get(k) for k in USER_PROFILE_SAFE_FIELDS if k in user}
        return jsonify(out), 200
    except Exception as e:
        logger.error(f"Error in get_my_profile: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/users/ensure-exists", methods=["POST"])
def ensure_user_exists():
    """Ensure user exists in users table"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        email = data.get('email')
        display_name = data.get('display_name')
        
        # If no user_id provided, generate one from email
        if not user_id:
            import uuid
            user_id = str(uuid.uuid4())
            logger.info(f"Generated UUID for user: {user_id}")
        
        # Check if user exists
        result = supabase.table('users').select('*').eq('id', user_id).execute()
        
        if result.data and len(result.data) > 0:
            # User exists, update if needed
            if display_name and result.data[0].get('display_name') != display_name:
                supabase.table('users').update({
                    'display_name': display_name,
                    'updated_at': 'now()'
                }).eq('id', user_id).execute()
            return jsonify({"message": "User exists", "user": result.data[0]})
        else:
            # Create user
            new_user = {
                'id': user_id,
                'email': email,
                'username': email.split('@')[0] if email else 'user',
                'display_name': display_name or (email.split('@')[0] if email else 'User'),
                'role': 'creator',
                'created_at': 'now()',
                'updated_at': 'now()'
            }
            
            try:
                result = supabase.table('users').insert(new_user).execute()
                if result.data and len(result.data) > 0:
                    return jsonify({"message": "User created", "user": result.data[0]})
                else:
                    return jsonify({"message": "User created", "user": new_user})
            except Exception as insert_error:
                # If insert fails due to duplicate key, try to update existing user
                if "duplicate key" in str(insert_error).lower():
                    logger.info(f"Duplicate key detected for user {user_id}, updating existing user")
                    result = supabase.table('users').update({
                        'role': 'creator',
                        'updated_at': 'now()'
                    }).eq('id', user_id).execute()
                    if result.data and len(result.data) > 0:
                        return jsonify({"message": "User updated", "user": result.data[0]})
                    else:
                        return jsonify({"message": "User updated", "user": {"id": user_id, "email": email}})
                else:
                    raise insert_error
            
    except Exception as e:
        logger.error(f"Error ensuring user exists: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/users/<user_id>/update-profile", methods=["PUT", "POST", "OPTIONS"])
def update_user_profile(user_id):
    if request.method == "OPTIONS":
        # Flask-CORS handles OPTIONS requests automatically
        return jsonify(success=True)
    """Update user profile (cover_image_url, profile_image_url, etc.) using service role to bypass RLS"""
    try:
        # Handle both JSON and form data
        if request.is_json:
            data = request.get_json()
        else:
            # Try to parse as JSON from raw data
            try:
                data = json.loads(request.data) if request.data else {}
            except:
                data = request.form.to_dict() if request.form else {}
        
        if not data:
            response = jsonify({"error": "No data provided"})
            return response, 400
        logger.info(f"Updating profile for user {user_id}: {data}")
        
        # Validate user_id
        if not user_id:
            return jsonify({"error": "User ID is required"}), 400
        
        # Build update data (only include fields that are provided)
        update_data = {}
        if 'cover_image_url' in data:
            update_data['cover_image_url'] = data['cover_image_url']
        if 'profile_image_url' in data:
            update_data['profile_image_url'] = data['profile_image_url']
        if 'display_name' in data:
            update_data['display_name'] = data['display_name']
        if 'bio' in data:
            update_data['bio'] = data['bio']
        if 'primary_color' in data:
            update_data['primary_color'] = data['primary_color']
        if 'secondary_color' in data:
            update_data['secondary_color'] = data['secondary_color']
        
        update_data['updated_at'] = 'now()'
        
        if not update_data:
            return jsonify({"error": "No fields to update"}), 400
        
        # Use service role client if available, otherwise fall back to regular client
        client_to_use = supabase_admin if supabase_admin else supabase
        
        # Try update first
        result = client_to_use.table('users').update(update_data).eq('id', user_id).execute()
        
        if result.data and len(result.data) > 0:
            logger.info(f"Successfully updated profile for user {user_id}")
            response = jsonify({"success": True, "user": result.data[0]})
            return response, 200
        else:
            # User doesn't exist, try to create/upsert
            logger.info(f"User {user_id} doesn't exist, creating new profile")
            
            # Get email from request or use a default
            email = data.get('email', f"{user_id}@temp.com")
            
            upsert_data = {
                'id': user_id,
                'email': email,
                'username': email.split('@')[0] if email else 'user',
                **update_data
            }
            
            result = client_to_use.table('users').upsert(upsert_data, on_conflict='id').execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"Successfully created/updated profile for user {user_id}")
                response = jsonify({"success": True, "user": result.data[0]})
                return response, 200
            else:
                response = jsonify({"error": "Failed to update or create user profile"})
                return _allow_origin(response), 500
            
    except Exception as e:
        logger.error(f"Error updating user profile: {str(e)}")
        response = jsonify({"error": str(e)})
        return _allow_origin(response), 500

@app.route("/api/admin/dashboard-stats", methods=["GET"])
@cross_origin(origins=["https://screenmerch.com", "https://www.screenmerch.com"], supports_credentials=True)
def admin_dashboard_stats():
    """Get admin dashboard statistics"""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({"error": "User ID is required"}), 400
        
        # Use service role client if available to bypass RLS
        client_to_use = supabase_admin if supabase_admin else supabase
        
        # Try to use the view first if it exists
        try:
            result = client_to_use.table('admin_dashboard_stats').select('*').execute()
            if result.data and len(result.data) > 0:
                return jsonify(result.data[0])
        except Exception as view_error:
            logger.warning(f"Could not use admin_dashboard_stats view: {view_error}, calculating manually")
        
        # Fallback: Calculate stats manually
        try:
            # Get total users (fetch all and count)
            users_result = client_to_use.table('users').select('id').execute()
            total_users = len(users_result.data) if users_result.data else 0
            
            # Get active users
            active_users_result = client_to_use.table('users').select('id').eq('status', 'active').execute()
            active_users = len(active_users_result.data) if active_users_result.data else 0
            
            # Get suspended users  
            suspended_users_result = client_to_use.table('users').select('id').eq('status', 'suspended').execute()
            suspended_users = len(suspended_users_result.data) if suspended_users_result.data else 0
            
            # Get pending users (creators waiting for approval)
            pending_users_result = client_to_use.table('users').select('id').eq('status', 'pending').execute()
            pending_users = len(pending_users_result.data) if pending_users_result.data else 0
            
            # Get total videos
            videos_result = client_to_use.table('videos2').select('id').execute()
            total_videos = len(videos_result.data) if videos_result.data else 0
            
            # Get pending videos
            pending_videos_result = client_to_use.table('videos2').select('id').eq('verification_status', 'pending').execute()
            pending_videos = len(pending_videos_result.data) if pending_videos_result.data else 0
            
            # Get approved videos
            approved_videos_result = client_to_use.table('videos2').select('id').eq('verification_status', 'approved').execute()
            approved_videos = len(approved_videos_result.data) if approved_videos_result.data else 0
            
            # Get total subscriptions
            subscriptions_result = client_to_use.table('user_subscriptions').select('id').execute()
            total_subscriptions = len(subscriptions_result.data) if subscriptions_result.data else 0
            
            # Get active subscriptions
            active_subscriptions_result = client_to_use.table('user_subscriptions').select('id').eq('status', 'active').execute()
            active_subscriptions = len(active_subscriptions_result.data) if active_subscriptions_result.data else 0
            
            # Get premium subscriptions
            premium_subscriptions_result = client_to_use.table('user_subscriptions').select('id').eq('tier', 'premium').execute()
            premium_subscriptions = len(premium_subscriptions_result.data) if premium_subscriptions_result.data else 0
            
            # Get creator network subscriptions
            creator_network_subscriptions_result = client_to_use.table('user_subscriptions').select('id').eq('tier', 'creator_network').execute()
            creator_network_subscriptions = len(creator_network_subscriptions_result.data) if creator_network_subscriptions_result.data else 0
            
            # Get total orders/purchases
            orders_result = client_to_use.table('orders').select('order_id, status, total_amount').execute()
            total_orders = len(orders_result.data) if orders_result.data else 0
            paid_orders = len([o for o in (orders_result.data or []) if o.get('status') == 'paid']) if orders_result.data else 0
            total_revenue = sum([float(o.get('total_amount', 0)) for o in (orders_result.data or []) if o.get('status') == 'paid']) if orders_result.data else 0
            
            # Get orders in processing queue
            queue_result = client_to_use.table('order_processing_queue').select('id').execute()
            orders_in_queue = len(queue_result.data) if queue_result.data else 0
            pending_queue = len([q for q in (queue_result.data or []) if q.get('status') == 'pending']) if queue_result.data else 0
            
            stats = {
                "total_users": total_users,
                "active_users": active_users,
                "suspended_users": suspended_users,
                "pending_users": pending_users,
                "total_videos": total_videos,
                "pending_videos": pending_videos,
                "approved_videos": approved_videos,
                "total_subscriptions": total_subscriptions,
                "active_subscriptions": active_subscriptions,
                "premium_subscriptions": premium_subscriptions,
                "creator_network_subscriptions": creator_network_subscriptions,
                "total_orders": total_orders,
                "paid_orders": paid_orders,
                "total_revenue": round(total_revenue, 2),
                "orders_in_queue": orders_in_queue,
                "pending_queue": pending_queue
            }
            
            logger.info(f"Admin dashboard stats calculated: {stats}")
            return jsonify(stats)
            
        except Exception as calc_error:
            logger.error(f"Error calculating dashboard stats: {calc_error}")
            return jsonify({"error": str(calc_error)}), 500
            
    except Exception as e:
        logger.error(f"Error in admin dashboard stats endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/users/<user_id>/delete-account", methods=["DELETE"])
@cross_origin(origins=["https://screenmerch.com", "https://www.screenmerch.com"], supports_credentials=True)
def delete_user_account(user_id):
    """Delete user account and all associated data - uses admin client to bypass RLS"""
    try:
        logger.info(f"🗑️ Attempting to delete user account: {user_id}")
        
        # Use admin client to bypass RLS (same pattern as other admin endpoints)
        # This allows admin to delete users even when RLS would normally block it
        client_to_use = supabase_admin if supabase_admin else supabase
        
        if not supabase_admin:
            logger.warning("⚠️ Admin client not available - deletions may fail due to RLS")
        
        # Delete user's videos
        try:
            client_to_use.table('videos2').delete().eq('user_id', user_id).execute()
            logger.info(f"✅ Deleted videos for user {user_id}")
        except Exception as e:
            logger.error(f"❌ Error deleting videos: {str(e)}")
        
        # Delete user's subscriptions (where they are the subscriber)
        try:
            client_to_use.table('subscriptions').delete().eq('subscriber_id', user_id).execute()
            logger.info(f"✅ Deleted subscriptions for user {user_id}")
        except Exception as e:
            logger.error(f"❌ Error deleting subscriptions: {str(e)}")
        
        # Delete user's channel subscriptions (where they are the channel)
        try:
            client_to_use.table('subscriptions').delete().eq('channel_id', user_id).execute()
            logger.info(f"✅ Deleted channel subscriptions for user {user_id}")
        except Exception as e:
            logger.error(f"❌ Error deleting channel subscriptions: {str(e)}")
        
        # Delete user's subscription tier
        try:
            client_to_use.table('user_subscriptions').delete().eq('user_id', user_id).execute()
            logger.info(f"✅ Deleted user subscription for user {user_id}")
        except Exception as e:
            logger.error(f"❌ Error deleting user subscription: {str(e)}")
        
        # Friend functionality removed - no friend requests to delete
        
        # Delete user's products
        try:
            client_to_use.table('products').delete().eq('user_id', user_id).execute()
            logger.info(f"✅ Deleted products for user {user_id}")
        except Exception as e:
            logger.error(f"❌ Error deleting products: {str(e)}")
        
        # Delete user's sales
        try:
            client_to_use.table('sales').delete().eq('user_id', user_id).execute()
            logger.info(f"✅ Deleted sales for user {user_id}")
        except Exception as e:
            logger.error(f"❌ Error deleting sales: {str(e)}")
        
        # Finally, delete the user profile (most important - must succeed)
        try:
            client_to_use.table('users').delete().eq('id', user_id).execute()
            logger.info(f"✅ Deleted user profile for user {user_id}")
        except Exception as e:
            logger.error(f"❌ Error deleting user profile: {str(e)}")
            return jsonify({"success": False, "error": f"Failed to delete user profile: {str(e)}"}), 500
        
        logger.info(f"✅ Successfully deleted all data for user {user_id}")
        return jsonify({"success": True, "message": "Account deleted successfully"})
        
    except Exception as e:
        logger.error(f"❌ Error in delete_user_account: {str(e)}")
        return jsonify({"success": False, "error": f"Failed to delete account: {str(e)}"}), 500

# Create Pro checkout session with 7-day trial
@app.route("/api/create-pro-checkout", methods=["POST"])
def create_pro_checkout():
    try:
        data = request.get_json()
        user_id = data.get('userId')
        tier = data.get('tier', 'pro')
        email = data.get('email')
        
        # Allow guest checkout - user_id can be null
        # Stripe will collect email during checkout if not provided
        
        # Create Stripe checkout session for Pro subscription with 7-day trial
        session_params = {
            "payment_method_types": ["card"],
            "mode": "subscription",
            "line_items": [{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": "ScreenMerch Pro Plan",
                        "description": "Creator Pro Plan with 7-day free trial - You will be charged $49/month after the trial period"
                    },
                    "unit_amount": 4900,  # $49.00 in cents
                    "recurring": {
                        "interval": "month"
                    }
                },
                "quantity": 1,
            }],
            "subscription_data": {
                "trial_period_days": 7,
                "metadata": {
                    "user_id": user_id or "guest",
                    "tier": tier
                }
            },
            "payment_intent_data": {
                "statement_descriptor": "ScreenMerch"
            },
            "payment_method_options": {
                "card": {
                    "statement_descriptor": "ScreenMerch"
                }
            },
            "success_url": "https://screenmerch.com/subscription-success?session_id={CHECKOUT_SESSION_ID}",
            "cancel_url": "https://screenmerch.com/subscription-tiers",
            "metadata": {
                "user_id": user_id or "guest",
                "tier": tier
            }
        }
        
        # Only add customer_email if email is provided
        if email:
            session_params["customer_email"] = email
        
        # Ensure we're using test mode Stripe key
        ensure_stripe_test_mode()
        
        session = stripe.checkout.Session.create(**session_params)
        
        logger.info(f"Created Pro checkout session for user {user_id or 'guest'}")
        return jsonify({"url": session.url})
        
    except Exception as e:
        logger.error(f"Error creating Pro checkout session: {str(e)}")
        return jsonify({"error": "Failed to create checkout session"}), 500

# Test endpoint to verify Stripe configuration
@app.route("/api/test-stripe", methods=["GET"])
def test_stripe():
    try:
        # Test Stripe configuration - ensure test mode
        stripe_key = ensure_stripe_test_mode()
        if not stripe_key:
            return jsonify({"error": "Stripe secret key not configured"}), 500
        
        # Test basic Stripe API call
        account = stripe.Account.retrieve()
        
        return jsonify({
            "success": True,
            "message": "Stripe configuration is working",
            "account_id": account.id,
            "stripe_key_configured": bool(stripe.api_key)
        })
    except Exception as e:
        return jsonify({
            "error": f"Stripe configuration error: {str(e)}",
            "stripe_key_configured": bool(os.getenv("STRIPE_SECRET_KEY"))
        }), 500

@app.route("/api/calculate-shipping", methods=["POST", "OPTIONS"])
def calculate_shipping():
    """Calculate shipping cost for an order using Printify API"""
    logger.info("📦 /api/calculate-shipping endpoint called")
    logger.info(f"📦 Request method: {request.method}")
    logger.info(f"📦 Request URL: {request.url}")
    logger.info(f"📦 Request headers: {dict(request.headers)}")
    
    if request.method == "OPTIONS":
        logger.info("📦 Handling OPTIONS preflight request")
        response = jsonify(success=True)
        return response
    
    try:
        logger.info("📦 Processing POST request for shipping calculation")
        data = request.get_json()
        logger.info(f"📦 Received data: {data}")
        
        # Get shipping address from frontend
        shipping_address = data.get('shipping_address', {})
        country = shipping_address.get('country_code', 'US')
        
        # Get cart items from frontend
        cart = data.get('cart', [])
        
        if not cart:
            return jsonify({
                "success": False,
                "error": "No cart items provided"
            }), 400
        
        # Check for API key
        printful_api_key = os.getenv("PRINTFUL_API_KEY")
        printify_api_key = os.getenv("PRINTIFY_API_KEY")
        
        # Parse ZIP code using robust helper
        postal_code = _parse_zip(shipping_address)
        if not postal_code:
            return jsonify({
                "success": False,
                "error": "ZIP / Postal Code is required for shipping calculation"
            }), 400
        
        logger.info(f"📦 Calculating shipping for ZIP: {postal_code}, Country: {country}, Cart items: {len(cart)}")
        
        # Try using Printful integration first (preferred method)
        if printful_api_key and hasattr(printful_integration, 'calculate_shipping_rates'):
            try:
                logger.info("📦 Using Printful integration for shipping calculation")
                recipient_data = {
                    'country_code': country,
                    'zip': postal_code,
                    'state_code': shipping_address.get('state_code', ''),
                    'city': shipping_address.get('city', '')
                }
                result = printful_integration.calculate_shipping_rates(recipient_data, cart)
                logger.info(f"📦 Printful shipping result: {result}")
                
                if result and result.get('success'):
                    return jsonify({
                        "success": True,
                        "shipping_cost": result.get('shipping_cost', 0),
                        "currency": result.get('currency', 'USD'),
                        "delivery_days": str(result.get('delivery_days', '5-7')),
                        "shipping_method": result.get('shipping_method', 'Standard Shipping')
                    })
            except Exception as e:
                logger.error(f"📦 Printful integration failed: {str(e)}")
                # Fall through to direct API call
        
        # Fallback: Direct Printful API call
        if printful_api_key:
            logger.info("📦 Using direct Printful API for shipping calculation")
            printful_base_url = "https://api.printful.com"
            
            # Format items for Printful
            shipping_items = []
            for item in cart:
                shipping_items.append({
                    "variant_id": item.get('variant_id', item.get('printful_variant_id', 71)),
                    "quantity": item.get('quantity', 1)
                })
            
            shipping_payload = {
                "recipient": {
                    "country_code": country,
                    "zip": postal_code,
                    "state_code": shipping_address.get('state_code', ''),
                    "city": shipping_address.get('city', '')
                },
                "items": shipping_items,
                "currency": "USD"
            }
            
            headers = {
                'Authorization': f'Bearer {printful_api_key}',
                'Content-Type': 'application/json'
            }
            
            logger.info(f"📦 Calling Printful API: {printful_base_url}/shipping/rates")
            logger.info(f"📦 Request payload: {shipping_payload}")
            
            response = requests.post(
                f"{printful_base_url}/shipping/rates",
                json=shipping_payload,
                headers=headers,
                timeout=10
            )
            
            logger.info(f"📦 Printful API response status: {response.status_code}")
            logger.info(f"📦 Printful API response text: {response.text[:500]}")
            
            if response.status_code == 200:
                try:
                    shipping_response = response.json()
                    logger.info(f"📦 Parsed Printful response: {shipping_response}")
                    
                    # Printful API wraps results in a 'result' key
                    if 'result' in shipping_response:
                        rates_list = shipping_response['result']
                        logger.info(f"📦 Extracted rates list: {rates_list}")
                        logger.info(f"📦 Number of rates: {len(rates_list)}")
                        
                        if rates_list and len(rates_list) > 0:
                            # Find standard shipping or use first available
                            standard_rate = None
                            for rate in rates_list:
                                if rate.get('id') == 'STANDARD' or 'standard' in rate.get('name', '').lower():
                                    standard_rate = rate
                                    break
                            
                            rate = standard_rate or rates_list[0]
                            logger.info(f"📦 Selected rate: {rate}")
                            
                            # Printful uses 'rate' field for cost
                            cost = rate.get('rate') or rate.get('cost') or rate.get('price')
                            
                            if cost is None or cost == 0:
                                logger.error(f"📦 No valid cost found in rate: {rate}")
                                return jsonify({
                                    "success": False,
                                    "error": "Unable to calculate shipping cost. Please verify your ZIP code and try again."
                                }), 400
                            
                            logger.info(f"📦 Shipping cost calculated: {cost}")
                            return jsonify({
                                "success": True,
                                "shipping_cost": float(cost),
                                "currency": "USD",
                                "delivery_days": str(rate.get('minDeliveryDays', rate.get('estimated_days', '5-7'))),
                                "shipping_method": rate.get('name', 'Standard Shipping')
                            })
                        else:
                            logger.error(f"📦 No shipping rates found in Printful response")
                            return jsonify({
                                "success": False,
                                "error": "No shipping rates available for this location. Please verify your ZIP code or contact support."
                            }), 400
                    else:
                        logger.error(f"📦 Printful response missing 'result' key: {shipping_response}")
                        return jsonify({
                            "success": False,
                            "error": "Invalid response from shipping API. Please try again."
                        }), 500
                except Exception as parse_error:
                    logger.error(f"📦 Error parsing Printful response: {str(parse_error)}")
                    logger.error(f"📦 Raw response: {response.text}")
                    return jsonify({
                        "success": False,
                        "error": f"Error parsing shipping rates response: {str(parse_error)}"
                    }), 500
            else:
                logger.error(f"Printful API error: {response.status_code} - {response.text}")
                error_detail = "Unknown error"
                try:
                    error_data = response.json()
                    error_detail = error_data.get('message', error_data.get('error', error_data.get('description', 'Unknown error')))
                    logger.error(f"📦 Printful error details: {error_data}")
                except:
                    error_detail = response.text[:200] if response.text else "Unknown error"
                return jsonify({
                    "success": False,
                    "error": f"Unable to calculate shipping: {error_detail}. Please verify your ZIP code and try again."
                }), response.status_code if response.status_code < 600 else 500
        
        # No API keys configured
        logger.error("📦 Neither PRINTFUL_API_KEY nor PRINTIFY_API_KEY is configured")
        return jsonify({
            "success": False,
            "error": "Shipping calculation service is not configured. Please contact support."
        }), 500
        
    except Exception as e:
        logger.error(f"Error calculating shipping: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Shipping calculation failed: {str(e)}. Please verify your ZIP code and try again."
        }), 500

@app.route("/api/test-email-config", methods=["GET"])
def test_email_config():
    """Test email configuration and send a test notification"""
    try:
        # Check environment variables
        mail_to = os.getenv("MAIL_TO")
        resend_api_key = os.getenv("RESEND_API_KEY")
        resend_from = os.getenv("RESEND_FROM")
        
        config_status = {
            "MAIL_TO": mail_to or "NOT SET",
            "RESEND_API_KEY": "✓ SET" if resend_api_key else "✗ NOT SET",
            "RESEND_FROM": resend_from or "NOT SET"
        }
        
        # Send test email if all config is present
        if mail_to and resend_api_key and resend_from:
            test_email_data = {
                "from": resend_from,
                "to": [mail_to],
                "subject": "🧪 ScreenMerch Email Configuration Test",
                "html": f"""
                <h1>✅ ScreenMerch Email Configuration Test</h1>
                <p>This is a test email to verify that your email notifications are working properly.</p>
                <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3>Configuration Status:</h3>
                    <p><strong>Admin Email:</strong> {mail_to}</p>
                    <p><strong>From Email:</strong> {resend_from}</p>
                    <p><strong>Resend API:</strong> ✓ Configured</p>
                </div>
                <p>You will receive notifications at <strong>{mail_to}</strong> when:</p>
                <ul>
                    <li>🎉 New subscribers sign up for Pro plan</li>
                    <li>🛍️ New product orders are placed</li>
                    <li>📧 System notifications and alerts</li>
                </ul>
                <p>If you receive this email, your notification system is working correctly!</p>
                """
            }
            
            response = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json"
                },
                json=test_email_data
            )
            
            if response.status_code == 200:
                result = response.json()
                return jsonify({
                    "success": True,
                    "message": "Test email sent successfully!",
                    "email_id": result.get('id'),
                    "config_status": config_status,
                    "admin_email": mail_to
                })
            else:
                return jsonify({
                    "success": False,
                    "error": f"Failed to send test email: {response.status_code} - {response.text}",
                    "config_status": config_status
                }), 500
        else:
            return jsonify({
                "success": False,
                "error": "Email configuration incomplete",
                "config_status": config_status
            }), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Email configuration test failed: {str(e)}"
        }), 500

# Subdomain API endpoint - public access to creator data
@app.route("/api/subdomain/<subdomain>", methods=["GET", "OPTIONS"])
@app.route("/api/subdomain/<subdomain>/", methods=["GET", "OPTIONS"])
def get_subdomain_creator(subdomain):
    """
    Public API endpoint to look up a creator by subdomain.
    This bypasses RLS so visitors to creator subdomains can see personalization.
    """
    if request.method == "OPTIONS":
        # Flask-CORS handles OPTIONS requests automatically
        return jsonify(success=True)
    
    try:
        normalized = subdomain.lower().strip()
        logger.info(f"🔍 [SUBDOMAIN API] Looking up subdomain: {normalized}")
        
        # Use admin client to bypass RLS
        client = supabase_admin if supabase_admin else supabase
        if not client:
            raise Exception("Supabase client not initialized")
        
        # Query for the creator with this subdomain - use exact match since we normalize to lowercase
        result = client.table('users').select('*').eq('subdomain', normalized).execute()
        
        if result.data and len(result.data) > 0:
            creator = result.data[0]
            logger.info(f"✅ [SUBDOMAIN API] Found creator for subdomain {normalized}: {creator.get('display_name')}")
            
            response = jsonify({
                "success": True,
                "creator": {
                    "id": creator.get('id'),
                    "display_name": creator.get('display_name'),
                    "subdomain": creator.get('subdomain'),
                    "personalization_enabled": creator.get('personalization_enabled', False),
                    "primary_color": creator.get('primary_color'),
                    "secondary_color": creator.get('secondary_color'),
                    "logo_url": creator.get('custom_logo_url'),  # Use custom_logo_url from database
                    "custom_logo_url": creator.get('custom_logo_url'),  # Also include as custom_logo_url for clarity
                    "banner_url": creator.get('banner_url'),
                    "profile_image_url": creator.get('profile_image_url'),
                    "custom_favicon_url": creator.get('custom_favicon_url'),
                    "custom_meta_title": creator.get('custom_meta_title'),
                    "custom_meta_description": creator.get('custom_meta_description'),
                    "hide_screenmerch_branding": creator.get('hide_screenmerch_branding', False)
                }
            })
            return response, 200
        else:
            logger.warning(f"⚠️ [SUBDOMAIN API] No creator found for subdomain: {normalized}")
            
            # Debug: List all subdomains for troubleshooting
            try:
                all_subs = client.table('users').select('subdomain, email').not_('subdomain', 'is', None).execute()
                if all_subs.data:
                    logger.info(f"📋 [SUBDOMAIN API] All subdomains in DB: {[s.get('subdomain') for s in all_subs.data]}")
            except Exception as debug_error:
                logger.error(f"❌ [SUBDOMAIN API] Error listing subdomains: {str(debug_error)}")
            
            response = jsonify({
                "success": False,
                "error": "Creator not found",
                "subdomain_searched": normalized
            })
            return response, 404
            
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"❌ [SUBDOMAIN API] Error looking up subdomain {subdomain}: {str(e)}")
        logger.error(f"❌ [SUBDOMAIN API] Full traceback: {error_trace}")
        response = jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        })
        return _allow_origin(response), 500

# Admin check API endpoints - bypass RLS to prevent 406 errors
@app.route("/api/admin/check-status", methods=["GET", "OPTIONS"])
def check_admin_status():
    """Check if user is admin - bypasses RLS to prevent 406 errors"""
    if request.method == "OPTIONS":
        # Flask-CORS handles OPTIONS requests automatically
        return jsonify(success=True)
    
    try:
        user_email = request.args.get('email') or request.headers.get('X-User-Email')
        user_id = request.args.get('user_id')
        
        if not user_email and not user_id:
            return jsonify({
                "success": False,
                "error": "Email or user_id required"
            }), 400
        
        # Use admin client to bypass RLS
        client = supabase_admin if supabase_admin else supabase
        if not client:
            raise Exception("Supabase client not initialized")
        
        # Query user
        query = client.table('users').select('is_admin, admin_role')
        if user_id:
            query = query.eq('id', user_id)
        else:
            query = query.ilike('email', user_email.lower().strip())
        
        result = query.single().execute()
        
        if result.data:
            user = result.data
            return jsonify({
                "success": True,
                "is_admin": user.get('is_admin', False),
                "admin_role": user.get('admin_role'),
                "is_full_admin": user.get('is_admin', False) and user.get('admin_role') == 'master_admin',
                "is_order_processing_admin": user.get('is_admin', False) and (
                    user.get('admin_role') in ['order_processing_admin', 'admin', 'master_admin'] or
                    user.get('admin_role') is None  # Backward compatibility
                )
            }), 200
        else:
            return jsonify({
                "success": True,
                "is_admin": False,
                "admin_role": None,
                "is_full_admin": False,
                "is_order_processing_admin": False
            }), 200
            
    except Exception as e:
        logger.error(f"❌ Error checking admin status: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "is_admin": False,
            "admin_role": None,
            "is_full_admin": False,
            "is_order_processing_admin": False
        }), 500

# Auth login is in routes/auth.py (auth_bp) - single source of truth

@app.route("/api/auth/check-admin", methods=["POST", "OPTIONS"])
@app.route("/api/auth/check-admin/", methods=["POST", "OPTIONS"])
def auth_check_admin():
    """Check if a user has admin privileges - bypasses RLS using service role"""
    if request.method == "OPTIONS":
        # Flask-CORS handles OPTIONS requests automatically
        return jsonify(success=True)
    
    try:
        data = _data_from_request()
        user_id = data.get("user_id")
        user_email = (data.get("email") or "").strip().lower()
        
        if not user_id and not user_email:
            response = jsonify({"success": False, "error": "user_id or email is required"})
            return response, 400
        
        logger.info(f"🔐 [CHECK-ADMIN] Checking admin status for user_id={user_id}, email={user_email}")
        
        # Use admin client to bypass RLS
        client = supabase_admin if supabase_admin else supabase
        if not client:
            logger.error("❌ [CHECK-ADMIN] Supabase client not initialized")
            response = jsonify({"success": False, "error": "Database service unavailable"})
            return response, 500
        
        # Query by ID first, then fallback to email
        user_data = None
        if user_id:
            result = client.table('users').select('id, email, is_admin, admin_role').eq('id', user_id).execute()
            if result.data:
                user_data = result.data[0]
                logger.info(f"🔐 [CHECK-ADMIN] Found user by ID: {user_id}")
        
        # Fallback to email if ID lookup failed
        if not user_data and user_email:
            result = client.table('users').select('id, email, is_admin, admin_role').ilike('email', user_email).execute()
            if result.data:
                user_data = result.data[0]
                logger.info(f"🔐 [CHECK-ADMIN] Found user by email: {user_email}")
        
        if not user_data:
            logger.warning(f"⚠️ [CHECK-ADMIN] User not found: user_id={user_id}, email={user_email}")
            response = jsonify({
                "success": True,
                "isAdmin": False,
                "isFullAdmin": False,
                "isMasterAdmin": False,
                "isOrderProcessingAdmin": False,
                "adminRole": None
            })
            return response, 200
        
        is_admin = user_data.get('is_admin', False) or False
        admin_role = user_data.get('admin_role')
        
        # Calculate admin types based on role
        is_master_admin = is_admin and admin_role == 'master_admin'
        is_full_admin = is_admin and admin_role == 'master_admin'  # Only master_admin has full access
        is_order_processing_admin = is_admin and (
            admin_role == 'order_processing_admin' or 
            admin_role == 'admin' or 
            admin_role == 'master_admin' or 
            admin_role is None  # Backward compatibility
        )
        
        logger.info(f"✅ [CHECK-ADMIN] Admin check result: is_admin={is_admin}, admin_role={admin_role}, "
                   f"isMasterAdmin={is_master_admin}, isFullAdmin={is_full_admin}, isOrderProcessingAdmin={is_order_processing_admin}")
        
        response = jsonify({
            "success": True,
            "isAdmin": is_admin,
            "isFullAdmin": is_full_admin,
            "isMasterAdmin": is_master_admin,
            "isOrderProcessingAdmin": is_order_processing_admin,
            "adminRole": admin_role
        })
        return response, 200
        
    except Exception as e:
        logger.error(f"❌ [CHECK-ADMIN] Error: {str(e)}")
        import traceback
        logger.error(f"❌ [CHECK-ADMIN] Traceback: {traceback.format_exc()}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return _allow_origin(response), 500


@app.route("/api/admin/subdomains", methods=["GET", "OPTIONS"])
@app.route("/api/admin/subdomains/", methods=["GET", "OPTIONS"])
def admin_get_subdomains():
    """Get all subdomains with creator info - Master Admin only"""
    if request.method == "OPTIONS":
        # Flask-CORS handles OPTIONS requests automatically
        return jsonify(success=True)
    
    try:
        # Get admin email from header or request
        admin_email = request.headers.get('X-User-Email') or request.args.get('email')
        if not admin_email:
            response = jsonify({"success": False, "error": "Admin email required"})
            return response, 401
        
        # Verify master admin
        client = supabase_admin if supabase_admin else supabase
        if not client:
            response = jsonify({"success": False, "error": "Database service unavailable"})
            return _allow_origin(response), 500
        
        admin_result = client.table('users').select('is_admin, admin_role').ilike('email', admin_email).execute()
        if not admin_result.data or len(admin_result.data) == 0:
            response = jsonify({"success": False, "error": "Admin not found"})
            return _allow_origin(response), 403
        
        admin_user = admin_result.data[0]
        if not admin_user.get('is_admin') or admin_user.get('admin_role') != 'master_admin':
            response = jsonify({"success": False, "error": "Master admin access required"})
            return _allow_origin(response), 403
        
        # Get all users with subdomains
        result = client.table('users').select(
            'id, email, display_name, subdomain, role, status, created_at, updated_at, personalization_enabled'
        ).not_.is_('subdomain', 'null').order('created_at', desc=True).execute()
        
        subdomains = []
        for user in result.data:
            subdomain = user.get('subdomain')
            if subdomain:
                subdomains.append({
                    'user_id': user.get('id'),
                    'email': user.get('email'),
                    'display_name': user.get('display_name'),
                    'subdomain': subdomain,
                    'subdomain_url': f'https://{subdomain}.screenmerch.com',
                    'role': user.get('role'),
                    'status': user.get('status'),
                    'personalization_enabled': user.get('personalization_enabled', False),
                    'created_at': user.get('created_at'),
                    'updated_at': user.get('updated_at')
                })
        
        logger.info(f"✅ [SUBDOMAIN-MGMT] Retrieved {len(subdomains)} subdomains")
        response = jsonify({"success": True, "subdomains": subdomains})
        return response, 200
        
    except Exception as e:
        logger.error(f"❌ [SUBDOMAIN-MGMT] Error: {str(e)}")
        import traceback
        logger.error(f"❌ [SUBDOMAIN-MGMT] Traceback: {traceback.format_exc()}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return _allow_origin(response), 500


@app.route("/api/admin/subdomains/<user_id>", methods=["PUT", "OPTIONS"])
@app.route("/api/admin/subdomains/<user_id>/", methods=["PUT", "OPTIONS"])
def admin_update_subdomain(user_id):
    """Update subdomain for a user - Master Admin only"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        # Flask-CORS handles CORS headers automatically
        return response
    
    try:
        # Get admin email from header or request
        admin_email = request.headers.get('X-User-Email') or request.json.get('admin_email')
        if not admin_email:
            response = jsonify({"success": False, "error": "Admin email required"})
            return response, 401
        
        # Verify master admin
        client = supabase_admin if supabase_admin else supabase
        if not client:
            response = jsonify({"success": False, "error": "Database service unavailable"})
            return _allow_origin(response), 500
        
        admin_result = client.table('users').select('is_admin, admin_role').ilike('email', admin_email).execute()
        if not admin_result.data or len(admin_result.data) == 0:
            response = jsonify({"success": False, "error": "Admin not found"})
            return _allow_origin(response), 403
        
        admin_user = admin_result.data[0]
        if not admin_user.get('is_admin') or admin_user.get('admin_role') != 'master_admin':
            response = jsonify({"success": False, "error": "Master admin access required"})
            return _allow_origin(response), 403
        
        # Get new subdomain from request
        data = _data_from_request()
        new_subdomain = (data.get('subdomain') or '').strip().lower()
        
        # Validate subdomain format
        if new_subdomain:
            # Basic validation: 3-63 chars, lowercase alphanumeric with hyphens
            import re
            if not re.match(r'^[a-z0-9]([a-z0-9-]*[a-z0-9])?$', new_subdomain):
                response = jsonify({"success": False, "error": "Invalid subdomain format. Must be 3-63 lowercase alphanumeric characters with hyphens."})
                return response, 400
            
            if len(new_subdomain) < 3 or len(new_subdomain) > 63:
                response = jsonify({"success": False, "error": "Subdomain must be between 3 and 63 characters"})
                return response, 400
            
            # Check if subdomain is already taken
            existing = client.table('users').select('id, email').eq('subdomain', new_subdomain).execute()
            if existing.data and len(existing.data) > 0:
                existing_user = existing.data[0]
                if existing_user.get('id') != user_id:
                    response = jsonify({"success": False, "error": f"Subdomain '{new_subdomain}' is already taken by {existing_user.get('email')}"})
                    return response, 400
        
        # Update user subdomain
        # Note: updated_at is typically handled by database triggers
        update_data = {'subdomain': new_subdomain if new_subdomain else None}
        result = client.table('users').update(update_data).eq('id', user_id).execute()
        
        if not result.data or len(result.data) == 0:
            response = jsonify({"success": False, "error": "User not found"})
            return response, 404
        
        logger.info(f"✅ [SUBDOMAIN-MGMT] Updated subdomain for user {user_id} to '{new_subdomain}'")
        response = jsonify({
            "success": True,
            "user": result.data[0],
            "message": f"Subdomain updated to '{new_subdomain}'" if new_subdomain else "Subdomain removed"
        })
        return response, 200
        
    except Exception as e:
        logger.error(f"❌ [SUBDOMAIN-MGMT] Error: {str(e)}")
        import traceback
        logger.error(f"❌ [SUBDOMAIN-MGMT] Traceback: {traceback.format_exc()}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return _allow_origin(response), 500


@app.route("/api/admin/subdomains/validate", methods=["POST", "OPTIONS"])
@app.route("/api/admin/subdomains/validate/", methods=["POST", "OPTIONS"])
def admin_validate_subdomain():
    """Validate if a subdomain is accessible - Master Admin only"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        # Flask-CORS handles CORS headers automatically
        return response
    
    try:
        data = _data_from_request()
        subdomain = (data.get('subdomain') or '').strip().lower()
        
        if not subdomain:
            response = jsonify({"success": False, "error": "Subdomain required"})
            return response, 400
        
        # Check if subdomain is accessible by making a HEAD request
        subdomain_url = f'https://{subdomain}.screenmerch.com'
        is_accessible = False
        status_code = None
        error_message = None
        
        try:
            import requests
            response_check = requests.head(subdomain_url, timeout=5, allow_redirects=True)
            status_code = response_check.status_code
            is_accessible = status_code < 500  # Consider 2xx, 3xx, 4xx as accessible (4xx might be expected)
        except requests.exceptions.Timeout:
            error_message = "Timeout checking subdomain"
        except requests.exceptions.ConnectionError:
            error_message = "Connection error - subdomain may not be configured"
        except Exception as e:
            error_message = str(e)
        
        logger.info(f"🔍 [SUBDOMAIN-VALIDATE] Subdomain '{subdomain}': accessible={is_accessible}, status={status_code}, error={error_message}")
        
        response = jsonify({
            "success": True,
            "subdomain": subdomain,
            "url": subdomain_url,
            "is_accessible": is_accessible,
            "status_code": status_code,
            "error": error_message
        })
        return response, 200
        
    except Exception as e:
        logger.error(f"❌ [SUBDOMAIN-VALIDATE] Error: {str(e)}")
        import traceback
        logger.error(f"❌ [SUBDOMAIN-VALIDATE] Traceback: {traceback.format_exc()}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return _allow_origin(response), 500


@app.route("/api/auth/signup", methods=["POST", "OPTIONS"])
@app.route("/api/auth/signup/", methods=["POST", "OPTIONS"])
def auth_signup():
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        return response
    """Handle user signup with email and password validation"""
    try:
        # Handle both JSON (fetch) and form data (redirect)
        data = _data_from_request()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        
        if not email or not password:
            return jsonify({"success": False, "error": "Email and password are required"}), 400
        
        # Validate email format
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({"success": False, "error": "Please enter a valid email address"}), 400
        
        # Validate password strength
        if len(password) < 6:
            return jsonify({"success": False, "error": "Password must be at least 6 characters long"}), 400
        
        # Check if this is a creator signup (from "Start Free" flow)
        is_creator = data.get("is_creator", False) or data.get("role") == "creator"
        
        # Track creator count for email notification
        current_creator_count = 0
        
        # If creator signup, check the 20-user limit
        if is_creator:
            try:
                # Count existing creators (both active and pending)
                # First get all creators with active or pending status
                creator_result = supabase.table('users').select('id').in_('status', ['active', 'pending']).eq('role', 'creator').execute()
                current_creator_count = len(creator_result.data) if creator_result.data else 0
                
                if current_creator_count >= 20:
                    response = jsonify({
                        "success": False, 
                        "error": "We've reached our limit of 20 creator signups. Please check back later or contact support."
                    })
                    return response, 403
            except Exception as limit_error:
                logger.error(f"Error checking creator limit: {str(limit_error)}")
                # Continue with signup if limit check fails (fail open for now)
        
        # Check if user already exists
        try:
            existing_user = supabase.table('users').select('*').eq('email', email).execute()
            
            if existing_user.data:
                return jsonify({"success": False, "error": "An account with this email already exists"}), 409
            
            # Create new user
            # Hash password using bcrypt for security
            # Set role and status based on whether it's a creator signup
            user_role = 'creator' if is_creator else 'customer'
            user_status = 'pending' if is_creator else 'active'  # Creators need approval
            
            # Hash password with bcrypt
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            new_user = {
                'email': email,
                'password_hash': password_hash,
                'role': user_role,
                'status': user_status,
                'email_verified': False
            }
            
            result = supabase.table('users').insert(new_user).execute()
            
            if result.data:
                user_role = result.data[0].get('role', 'customer')
                user_status = result.data[0].get('status', 'active')
                
                # Different success messages for creators vs customers
                if user_role == 'creator' and user_status == 'pending':
                    success_message = "Account created successfully! Your application is pending approval. You'll receive an email once approved."
                else:
                    success_message = "Account created successfully!"
                
                logger.info(f"New user {email} created successfully (role: {user_role}, status: {user_status})")
                
                # Send admin notification email if this is a creator signup
                if user_role == 'creator' and user_status == 'pending' and MAIL_TO:
                    try:
                        admin_email_data = {
                            "from": RESEND_FROM,
                            "to": [MAIL_TO],
                            "subject": f"🎨 New Creator Signup Request: {email}",
                            "html": f"""
                            <h1>🎨 New Creator Signup Request</h1>
                            <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50;">
                                <h2>Creator Details:</h2>
                                <p><strong>Email:</strong> {email}</p>
                                <p><strong>User ID:</strong> {result.data[0].get('id')}</p>
                                <p><strong>Status:</strong> Pending Approval</p>
                                <p><strong>Signup Date:</strong> {result.data[0].get('created_at', 'N/A')}</p>
                            </div>
                            <p><strong>Action Required:</strong> Please review and approve this creator signup in the admin panel.</p>
                            <p><strong>Current Creator Count:</strong> {current_creator_count + 1} / 20</p>
                            <p>This creator has signed up and is waiting for approval to access the platform.</p>
                            """
                        }
                        
                        email_response = requests.post(
                            "https://api.resend.com/emails",
                            headers={
                                "Authorization": f"Bearer {RESEND_API_KEY}",
                                "Content-Type": "application/json"
                            },
                            json=admin_email_data
                        )
                        if email_response.status_code == 200:
                            logger.info(f"✅ Admin notification sent for new creator signup: {email}")
                        else:
                            logger.error(f"❌ Failed to send admin notification: {email_response.text}")
                    except Exception as email_error:
                        logger.error(f"❌ Error sending admin notification: {str(email_error)}")
                        # Don't fail signup if email fails
                
                response = jsonify({
                    "success": True, 
                    "message": success_message,
                    "user": {
                        "id": result.data[0].get('id'),
                        "email": result.data[0].get('email'),
                        "display_name": result.data[0].get('display_name'),
                        "role": user_role,
                        "status": user_status
                    }
                })
                
                # Generate token
                import uuid
                token = str(uuid.uuid4())
                
                is_form = not request.is_json
                domain = _cookie_domain()
                
                if is_form:
                    resp = redirect(_return_url(), code=303)  # 303 so browser switches to GET cleanly
                else:
                    resp = make_response(jsonify(
                        success=True,
                        message=success_message if 'success_message' in locals() else "Account created successfully!",
                        user={"email": email, "role": user_role, "status": user_status},
                        token=token
                    ), 200)
                
                resp.set_cookie(
                    "sm_session", token,
                    domain=domain, path="/",
                    secure=True, httponly=True, samesite="None", max_age=7*24*3600
                )
                return resp
            else:
                response = jsonify({"success": False, "error": "Failed to create account"})
                return _allow_origin(response), 500
                
        except Exception as db_error:
            logger.error(f"Database error during signup: {str(db_error)}")
            if "duplicate key" in str(db_error).lower():
                response = jsonify({"success": False, "error": "An account with this email already exists"})
                return response, 409
            response = jsonify({"success": False, "error": "Account creation failed"})
            return response, 500
            
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return response, 500

@app.route("/api/auth/signup/email-only", methods=["POST", "OPTIONS"])
def auth_signup_email_only():
    """Handle customer signup with email only - sends verification email"""
    logger.info("🔵 [EMAIL-ONLY-SIGNUP] Endpoint called")
    logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] Request method: {request.method}")
    
    if request.method == "OPTIONS":
        logger.info("🔵 [EMAIL-ONLY-SIGNUP] Handling OPTIONS preflight")
        response = jsonify(success=True)
        # Flask-CORS handles CORS headers automatically
        return response
    
    try:
        logger.info("🔵 [EMAIL-ONLY-SIGNUP] Processing POST request")
        data = _data_from_request()
        email = (data.get("email") or "").strip().lower()
        logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] Email received: {email}")
        
        if not email:
            logger.warning("🔵 [EMAIL-ONLY-SIGNUP] No email provided")
            return jsonify({"success": False, "error": "Email is required"}), 400
        
        # Validate email format
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            logger.warning(f"🔵 [EMAIL-ONLY-SIGNUP] Invalid email format: {email}")
            return jsonify({"success": False, "error": "Please enter a valid email address"}), 400
        
        logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] Email validated: {email}")
        
        # Check if user already exists (exclude deleted/suspended users)
        try:
            existing_user = supabase.table('users').select('*').eq('email', email).execute()
            
            # Filter out deleted, suspended, or null status users - allow re-signup for these
            if existing_user.data:
                active_user = None
                for user in existing_user.data:
                    user_status = user.get('status')
                    # Only consider active or pending users as "existing"
                    # Allow re-signup if status is null, empty, 'suspended', 'deleted', 'canceled', or any other non-active/pending status
                    if user_status in ['active', 'pending']:
                        active_user = user
                        break
                
                if active_user:
                    return jsonify({"success": False, "error": "An account with this email already exists. Please sign in instead."}), 409
                # If user exists but is not active/pending, allow re-signup (will update existing record or create new)
            
            # Generate verification token
            import uuid
            import datetime
            verification_token = str(uuid.uuid4())
            token_expiry = (datetime.datetime.now() + datetime.timedelta(hours=24)).isoformat()
            
            # Create new user without password (will be set after email verification)
            new_user = {
                'email': email,
                'role': 'customer',
                'status': 'active',
                'email_verified': False,
                'email_verification_token': verification_token
            }
            
            # Only add token_expiry if column exists (handle gracefully if not)
            try:
                new_user['token_expiry'] = token_expiry
            except:
                pass  # Column might not exist yet
            
            # Use admin client to bypass RLS (same pattern as other signup endpoints)
            client_to_use = supabase_admin if supabase_admin else supabase
            
            if not supabase_admin:
                logger.warning("⚠️ Admin client not available - signup may fail due to RLS")
            
            logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] Inserting user into database: {email}")
            result = client_to_use.table('users').insert(new_user).execute()
            logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] Database insert result: {len(result.data) if result.data else 0} record(s)")
            
            if result.data:
                user_id = result.data[0].get('id')
                logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] User created successfully. User ID: {user_id}")
                
                # Send verification email
                logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] Starting email sending process")
                logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] RESEND_API_KEY present: {bool(RESEND_API_KEY)}")
                logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] RESEND_FROM: {RESEND_FROM}")
                try:
                    frontend_url = os.getenv("FRONTEND_URL", "https://screenmerch.com")
                    verification_link = f"{frontend_url}/verify-email?token={verification_token}&email={email}"
                    logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] Verification link: {verification_link}")
                    
                    email_html = f"""
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Verify Your Email - ScreenMerch</title>
                    </head>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: white; margin: 0;">Welcome to ScreenMerch!</h1>
                        </div>
                        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                            <p>Hi there,</p>
                            <p>Thank you for signing up! Please verify your email address and set your password by clicking the button below:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{verification_link}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email & Set Password</a>
                            </div>
                            <p style="font-size: 12px; color: #666;">Or copy and paste this link into your browser:</p>
                            <p style="font-size: 12px; color: #667eea; word-break: break-all;">{verification_link}</p>
                            <p style="font-size: 12px; color: #666; margin-top: 30px;">This link will expire in 24 hours.</p>
                            <p style="font-size: 12px; color: #666;">If you didn't create an account, you can safely ignore this email.</p>
                        </div>
                    </body>
                    </html>
                    """
                    
                    if RESEND_API_KEY:
                        logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] 📧 Attempting to send verification email to {email}")
                        logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] 📧 Using RESEND_FROM: {RESEND_FROM}")
                        logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] 📧 Making request to Resend API...")
                        email_response = requests.post(
                            "https://api.resend.com/emails",
                            headers={
                                "Authorization": f"Bearer {RESEND_API_KEY}",
                                "Content-Type": "application/json"
                            },
                            json={
                                "from": RESEND_FROM,
                                "to": email,
                                "subject": "Verify Your Email - ScreenMerch",
                                "html": email_html
                            },
                            timeout=30
                        )
                        
                        logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] 📧 Resend API response status: {email_response.status_code}")
                        if email_response.status_code == 200:
                            response_data = email_response.json()
                            logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] ✅ Verification email sent successfully to {email}")
                            logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] 📧 Email ID: {response_data.get('id', 'N/A')}")
                        else:
                            error_text = email_response.text
                            logger.error(f"🔵 [EMAIL-ONLY-SIGNUP] ❌ Failed to send verification email: {email_response.status_code}")
                            logger.error(f"🔵 [EMAIL-ONLY-SIGNUP] ❌ Error response: {error_text}")
                            try:
                                error_json = email_response.json()
                                logger.error(f"🔵 [EMAIL-ONLY-SIGNUP] ❌ Error details: {error_json}")
                            except:
                                pass
                    else:
                        logger.error("🔵 [EMAIL-ONLY-SIGNUP] ❌ RESEND_API_KEY not configured - verification email not sent")
                        logger.error("🔵 [EMAIL-ONLY-SIGNUP] ❌ Please set RESEND_API_KEY environment variable in Fly.io")
                    
                except Exception as email_error:
                    logger.error(f"🔵 [EMAIL-ONLY-SIGNUP] ❌ Exception sending verification email: {str(email_error)}")
                    logger.error(f"🔵 [EMAIL-ONLY-SIGNUP] ❌ Exception type: {type(email_error).__name__}")
                    import traceback
                    logger.error(f"🔵 [EMAIL-ONLY-SIGNUP] ❌ Traceback: {traceback.format_exc()}")
                    # Continue even if email fails - user can request resend later
                
                logger.info(f"🔵 [EMAIL-ONLY-SIGNUP] ✅ Returning success response for {email}")
                response = jsonify({
                    "success": True,
                    "message": "Please check your email to verify your account and set your password."
                })
                # Flask-CORS handles CORS headers automatically
                return response, 200
            else:
                logger.error(f"🔵 [EMAIL-ONLY-SIGNUP] ❌ Failed to create account - no data returned from database")
                response = jsonify({"success": False, "error": "Failed to create account"})
                # Flask-CORS handles CORS headers automatically
                return response, 500
                
        except Exception as db_error:
            error_msg = str(db_error)
            logger.error(f"🔵 [EMAIL-ONLY-SIGNUP] ❌ Database error during email-only signup: {error_msg}")
            logger.error(f"🔵 [EMAIL-ONLY-SIGNUP] ❌ Full error details: {repr(db_error)}")
            import traceback
            logger.error(f"🔵 [EMAIL-ONLY-SIGNUP] ❌ Traceback: {traceback.format_exc()}")
            if "duplicate key" in error_msg.lower() or "already exists" in error_msg.lower():
                response = jsonify({"success": False, "error": "An account with this email already exists. Please sign in instead."})
                # Flask-CORS handles CORS headers automatically
                return response, 409
            # Return more detailed error for debugging (remove in production)
            response = jsonify({"success": False, "error": f"Account creation failed: {error_msg}"})
            # Flask-CORS handles CORS headers automatically
            return response, 500
            
    except Exception as e:
        logger.error(f"Email-only signup error: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        # Flask-CORS handles CORS headers automatically
        return response, 500

@app.route("/api/auth/verify-email", methods=["POST", "OPTIONS"])
def auth_verify_email():
    """Verify email token and set password"""
    logger.info("🔵 [VERIFY-EMAIL] Endpoint called")
    logger.info(f"🔵 [VERIFY-EMAIL] Request method: {request.method}")
    
    if request.method == "OPTIONS":
        logger.info("🔵 [VERIFY-EMAIL] Handling OPTIONS preflight")
        response = jsonify(success=True)
        # Flask-CORS handles CORS headers automatically
        return response
    
    try:
        logger.info("🔵 [VERIFY-EMAIL] Processing POST request")
        data = _data_from_request()
        token = data.get("token", "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password", "")
        logger.info(f"🔵 [VERIFY-EMAIL] Email: {email}, Token present: {bool(token)}, Password present: {bool(password)}")
        
        if not token or not email or not password:
            return jsonify({"success": False, "error": "Token, email, and password are required"}), 400
        
        # Validate password strength
        if len(password) < 6:
            return jsonify({"success": False, "error": "Password must be at least 6 characters long"}), 400
        
        # Find user by email and token
        try:
            logger.info(f"🔵 [VERIFY-EMAIL] Searching for user with email: {email} and token: {token[:10]}...")
            result = supabase.table('users').select('*').eq('email', email).eq('email_verification_token', token).execute()
            logger.info(f"🔵 [VERIFY-EMAIL] Database query result: {len(result.data) if result.data else 0} user(s) found")
            
            if not result.data:
                logger.warning(f"🔵 [VERIFY-EMAIL] No user found with matching email and token")
                return jsonify({"success": False, "error": "Invalid or expired verification link"}), 400
            
            user = result.data[0]
            
            # Check if token is expired
            import datetime
            token_expiry_str = user.get('token_expiry')
            if token_expiry_str:
                try:
                    token_expiry = datetime.datetime.fromisoformat(token_expiry_str.replace('Z', '+00:00'))
                    if datetime.datetime.now(datetime.timezone.utc) > token_expiry.replace(tzinfo=datetime.timezone.utc):
                        return jsonify({"success": False, "error": "Verification link has expired. Please request a new one."}), 400
                except Exception as date_error:
                    logger.error(f"Error parsing token expiry: {str(date_error)}")
                    # Continue if date parsing fails
            
            # Check if already verified
            if user.get('email_verified'):
                return jsonify({"success": False, "error": "Email already verified. Please sign in."}), 400
            
            # Update user: set password, mark as verified, clear token
            # Hash password with bcrypt
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            update_data = {
                'password_hash': password_hash,
                'email_verified': True,
                'email_verification_token': None,
                'token_expiry': None
            }
            
            logger.info(f"🔵 [VERIFY-EMAIL] Updating user {user.get('id')} with password and verification status")
            # Use admin client to bypass RLS (same pattern as signup endpoint)
            client_to_use = supabase_admin if supabase_admin else supabase
            if not supabase_admin:
                logger.warning("🔵 [VERIFY-EMAIL] ⚠️ Admin client not available - update may fail due to RLS")
            update_result = client_to_use.table('users').update(update_data).eq('id', user.get('id')).execute()
            logger.info(f"🔵 [VERIFY-EMAIL] Update result: {len(update_result.data) if update_result.data else 0} record(s) updated")
            
            if update_result.data:
                logger.info(f"🔵 [VERIFY-EMAIL] ✅ Email verified and password set for {email}")
                
                # Generate token for auto-login
                import uuid
                token = str(uuid.uuid4())
                
                response = jsonify({
                    "success": True,
                    "message": "Email verified and password set successfully!",
                    "user": {
                        "id": update_result.data[0].get('id'),
                        "email": update_result.data[0].get('email'),
                        "display_name": update_result.data[0].get('display_name'),
                        "role": update_result.data[0].get('role', 'customer')
                    },
                    "token": token
                })
                # Flask-CORS handles CORS headers automatically
                return response, 200
            else:
                response = jsonify({"success": False, "error": "Failed to verify email"})
                # Flask-CORS handles CORS headers automatically
                return response, 500
                
        except Exception as db_error:
            logger.error(f"🔵 [VERIFY-EMAIL] ❌ Database error during email verification: {str(db_error)}")
            logger.error(f"🔵 [VERIFY-EMAIL] ❌ Error type: {type(db_error).__name__}")
            import traceback
            logger.error(f"🔵 [VERIFY-EMAIL] ❌ Traceback: {traceback.format_exc()}")
            response = jsonify({"success": False, "error": "Verification failed"})
            # Flask-CORS handles CORS headers automatically
            return response, 500
            
    except Exception as e:
        logger.error(f"🔵 [VERIFY-EMAIL] ❌ Email verification error: {str(e)}")
        logger.error(f"🔵 [VERIFY-EMAIL] ❌ Error type: {type(e).__name__}")
        import traceback
        logger.error(f"🔵 [VERIFY-EMAIL] ❌ Traceback: {traceback.format_exc()}")
        response = jsonify({"success": False, "error": "Internal server error"})
        # Flask-CORS handles CORS headers automatically
        return response, 500

@app.route("/api/analytics", methods=["GET"])
@cross_origin(origins=["https://screenmerch.com", "https://www.screenmerch.com"], supports_credentials=True)
def get_analytics():
    """Get analytics data for creator dashboard - PRECISE tracking by user_id"""
    try:
        # Get user ID and channel ID from query parameters - user_id is REQUIRED for precise tracking
        user_id = request.args.get('user_id')
        channel_id = request.args.get('channel_id')
        
        # Validate user_id is provided for precise tracking
        if not user_id:
            logger.warning("⚠️ Analytics request missing user_id - returning empty data for security")
            return jsonify({
                'total_sales': 0,
                'total_revenue': 0,
                'avg_order_value': 0,
                'products_sold_count': 0,
                'videos_with_sales_count': 0,
                'sales_data': [0] * 30,
                'products_sold': [],
                'videos_with_sales': []
            })
        
        logger.info(f"📊 Analytics request - User ID: {user_id}, Channel ID: {channel_id}")
        
        # Get all orders from database and in-memory store
        all_orders = []
        
        # Get orders from order_store (recent orders) - FILTER by user_id for precise tracking
        for order_id, order_data in order_store.items():
            # IMPORTANT: Only include orders that belong to this creator
            # Check if order has creator_name that matches this user
            order_creator_name = order_data.get('creator_name', 'Unknown Creator')
            
            # If we have user_id, try to match orders to this creator
            # Skip orders that don't match this creator for precise tracking
            if user_id and order_creator_name != 'Unknown Creator':
                try:
                    # Look up if this creator_name matches the user_id
                    creator_match = supabase_admin.table('users').select('id').or_(
                        f"display_name.ilike.{order_creator_name},username.ilike.{order_creator_name}"
                    ).eq('id', user_id).limit(1).execute()
                    
                    # If creator doesn't match this user_id, skip this order
                    if not creator_match.data or len(creator_match.data) == 0:
                        continue  # Skip orders not belonging to this creator
                except:
                    # If lookup fails, skip to be safe (ensures precise tracking)
                    continue
            
            order_data['order_id'] = order_id
            order_data['status'] = 'pending'
            order_data['created_at'] = order_data.get('timestamp', 'N/A')
            all_orders.append(order_data)
        
        # Get orders from database (sales table)
        try:
            logger.info("🔍 Fetching sales data from database...")
            
            # IMPORTANT: Use service role client for precise tracking (bypasses RLS)
            client_to_use = supabase_admin if supabase_admin else supabase
            
            # Build query based on filters - user_id is REQUIRED for precise tracking
            if user_id:
                # PRECISE TRACKING: Filter by user_id to ensure creator only sees their own sales
                query = client_to_use.table('sales').select('id,product_name,amount,image_url,user_id,channel_id,creator_name,video_title')
                query = query.eq('user_id', user_id)  # CRITICAL: Only get sales for this creator
                
                if channel_id:
                    query = query.eq('channel_id', channel_id)
                    logger.info(f"🔍 Filtering sales by channel_id: {channel_id}")
                
                logger.info(f"✅ PRECISE TRACKING: Filtering sales by user_id: {user_id}")
                sales_result = query.execute()
            elif channel_id:
                # If only channel_id provided (fallback)
                query = client_to_use.table('sales').select('id,product_name,amount,image_url,user_id,channel_id')
                query = query.eq('channel_id', channel_id)
                logger.info(f"🔍 Filtering sales by channel_id: {channel_id}")
                sales_result = query.execute()
            else:
                # No user_id provided - return empty for security (precise tracking requires user_id)
                logger.warning("⚠️ Analytics request missing user_id - returning empty sales for security")
                sales_result = type('obj', (object,), {'data': []})()  # Empty result
            
            logger.info(f"📊 Found {len(sales_result.data)} sales records in database")
            
            # Debug: Log the first few sales to see what we're getting
            for i, sale in enumerate(sales_result.data[:3]):
                logger.info(f"📦 Sample sale {i+1}: {sale.get('product_name')} - ${sale.get('amount')} - Channel: {sale.get('channel_id')}")
            
            # Debug: Log all sales found
            for sale in sales_result.data:
                logger.info(f"📦 Found sale: {sale.get('product_name')} - ${sale.get('amount')} - Channel: {sale.get('channel_id')} - User: {sale.get('user_id')}")
            
            for sale in sales_result.data:
                logger.info(f"📦 Processing sale: {sale.get('product_name')} - ${sale.get('amount')}")
                # Convert database sale to order format - preserve creator info for precise tracking
                # Try to get created_at from sale record, fallback to current time if not available
                sale_created_at = sale.get('created_at')
                if not sale_created_at or sale_created_at == 'N/A':
                    # Use current timestamp if created_at is missing
                    from datetime import datetime
                    sale_created_at = datetime.now().isoformat()
                
                order_data = {
                    'order_id': sale.get('id', 'db-' + str(sale.get('id'))),
                    'cart': [{
                        'product': sale.get('product_name', 'Unknown Product'),
                        'variants': {'color': 'N/A', 'size': 'N/A'},
                        'note': '',
                        'img': sale.get('image_url', ''),
                        'video_title': sale.get('video_title', 'Unknown Video'),
                        'creator_name': sale.get('creator_name', 'Unknown Creator'),
                        'price': sale.get('amount', 0)  # Store price in cart item for revenue calculation
                    }],
                    'status': 'completed',
                    'created_at': sale_created_at,  # Use actual created_at from database
                    'total_value': sale.get('amount', 0),
                    'user_id': sale.get('user_id'),  # Preserve user_id for tracking
                    'channel_id': sale.get('channel_id'),
                    'creator_name': sale.get('creator_name', 'Unknown Creator')  # Preserve creator_name
                }
                all_orders.append(order_data)
                logger.info(f"✅ Added sale to analytics: {sale.get('product_name')} - ${sale.get('amount')} - created_at: {sale_created_at}")
        except Exception as db_error:
            logger.error(f"Database error loading analytics: {str(db_error)}")
        
        # Calculate analytics
        total_sales = len(all_orders)
        total_revenue = sum(order.get('total_value', 0) for order in all_orders)
        avg_order_value = total_revenue / total_sales if total_sales > 0 else 0
        
        logger.info(f"📈 Analytics calculated: {total_sales} sales, ${total_revenue} revenue")
        logger.info(f"🔍 Debug: all_orders length = {len(all_orders)}")
        logger.info(f"🔍 Debug: order_store length = {len(order_store)}")
        
        # Get unique products sold
        products_sold = {}
        videos_with_sales = {}
        
        for order in all_orders:
            # Skip orders with $0 value
            if order.get('total_value', 0) <= 0:
                continue
                
            for item in order.get('cart', []):
                product_name = item.get('product', 'Unknown')
                if product_name not in products_sold:
                    products_sold[product_name] = 0
                products_sold[product_name] += 1
                
                # Track video sources with revenue
                video_name = item.get('video_title', 'Unknown Video')
                creator_name = item.get('creator_name', 'Unknown Creator')
                video_key = f"{creator_name} - {video_name}"
                
                if video_key not in videos_with_sales:
                    videos_with_sales[video_key] = {
                        'sales_count': 0,
                        'revenue': 0
                    }
                videos_with_sales[video_key]['sales_count'] += 1
                videos_with_sales[video_key]['revenue'] += order.get('total_value', 0)
        
        # Generate sales data for chart (last 30 days)
        from datetime import datetime, timedelta
        sales_data = [0] * 30
        
        for order in all_orders:
            try:
                if order.get('created_at') and order.get('created_at') != 'N/A':
                    order_date = datetime.fromisoformat(order.get('created_at').replace('Z', '+00:00'))
                    days_ago = (datetime.now() - order_date).days
                    if 0 <= days_ago < 30:
                        sales_data[days_ago] += 1
            except:
                pass
        
        # Generate daily sales data for last 7 days (for daily chart)
        daily_sales = []
        now = datetime.now()
        for i in range(6, -1, -1):  # Last 7 days, from 6 days ago to today
            date = now - timedelta(days=i)
            date_str = date.strftime('%Y-%m-%d')
            date_display = date.strftime('%a, %b %d')
            
            # Count sales and calculate revenue for this day
            day_sales_count = 0
            day_revenue = 0
            
            for order in all_orders:
                try:
                    if order.get('created_at') and order.get('created_at') != 'N/A':
                        order_date = datetime.fromisoformat(order.get('created_at').replace('Z', '+00:00'))
                        order_date_str = order_date.strftime('%Y-%m-%d')
                        
                        if order_date_str == date_str:
                            day_sales_count += len(order.get('cart', []))
                            day_revenue += order.get('total_value', 0)
                except:
                    pass
            
            daily_sales.append({
                'date': date_str,
                'date_display': date_display,
                'sales_count': day_sales_count,
                'revenue': round(day_revenue, 2),
                'net_revenue': round(day_revenue * 0.7, 2)  # After 30% fee
            })
        
        # Calculate actual revenue per product (not hardcoded $25)
        products_sold_list = []
        for product, quantity in products_sold.items():
            # Calculate actual revenue for this product from orders
            product_revenue = 0
            for order in all_orders:
                for item in order.get('cart', []):
                    if item.get('product', '') == product:
                        # Get price from item or order total_value divided by items
                        item_price = item.get('price', 0)
                        if not item_price or item_price <= 0:
                            # Try to get from order total divided by cart length
                            cart_length = len(order.get('cart', []))
                            if cart_length > 0:
                                item_price = order.get('total_value', 0) / cart_length
                        product_revenue += item_price
            
            products_sold_list.append({
                'product': product,
                'quantity': quantity,
                'revenue': round(product_revenue, 2),
                'video_source': 'Unknown Video',
                'image': ''
            })
        
        analytics_data = {
            'total_sales': total_sales,
            'total_revenue': round(total_revenue, 2),
            'avg_order_value': round(avg_order_value, 2),
            'products_sold_count': len(products_sold),
            'videos_with_sales_count': len(videos_with_sales),
            'sales_data': sales_data,
            'daily_sales': daily_sales,  # Last 7 days with date, count, revenue
            'products_sold': products_sold_list,
            'videos_with_sales': [
                {
                    'video_name': video_name,
                    'sales_count': video_data['sales_count'],
                    'revenue': round(video_data['revenue'], 2)
                }
                for video_name, video_data in videos_with_sales.items()
            ],
            'recent_sales': [
                {
                    'product': item.get('product', 'Unknown Product'),
                    'amount': round(order.get('total_value', 0), 2),
                    'net_amount': round(order.get('total_value', 0) * 0.7, 2),
                    'created_at': order.get('created_at', 'N/A')
                }
                for order in sorted(all_orders, key=lambda x: (
                    float(x.get('created_at', 0)) if isinstance(x.get('created_at'), (int, float)) 
                    else (x.get('created_at') if isinstance(x.get('created_at'), str) and x.get('created_at') != 'N/A' 
                          else '1970-01-01')
                ), reverse=True)[:10]  # Get 10 most recent
                for item in order.get('cart', [])
            ]
        }
        
        return jsonify(analytics_data)
        
    except Exception as e:
        logger.error(f"Error loading analytics: {str(e)}")
        return jsonify({"error": "Failed to load analytics"}), 500

@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    """Admin login page"""
    if request.method == "POST":
        data = request.form
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return render_template('admin_login.html', error="Email and password are required")
        
        # Email whitelist validation
        allowed_emails = [
            'chidopro@proton.me',
            'alancraigdigital@gmail.com', 
            'digitalavatartutorial@gmail.com',
            'admin@screenmerch.com'
        ]
        if email not in allowed_emails:
            return render_template('admin_login.html', error="Access restricted to authorized users only")
        
        try:
            # Check if user exists and has admin role
            result = supabase.table('users').select('*').eq('email', email).execute()
            
            if result.data:
                user = result.data[0]
                stored_password = user.get('password_hash', '')
                user_role = user.get('role', 'customer')
                
                # Check password and admin role
                if password == stored_password and user_role == 'admin':
                    session['admin_logged_in'] = True
                    session['admin_email'] = email
                    session['admin_id'] = user.get('id')
                    logger.info(f"Admin {email} logged in successfully")
                    return redirect(url_for('admin_orders'))
                else:
                    return render_template('admin_login.html', error="Invalid credentials or insufficient privileges")
            else:
                return render_template('admin_login.html', error="Invalid credentials")
                
        except Exception as e:
            logger.error(f"Admin login error: {str(e)}")
            return render_template('admin_login.html', error="Authentication service unavailable")
    
    return render_template('admin_login.html')

@app.route("/admin/logout")
def admin_logout():
    """Admin logout"""
    session.clear()
    return redirect(url_for('admin_login'))

@app.route("/admin/setup", methods=["GET", "POST"])
def admin_setup():
    """Create admin user endpoint"""
    if request.method == "POST":
        try:
            # Hash the admin password using bcrypt for security
            admin_password = 'VieG369Bbk8!'
            password_hash = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Create admin user
            admin_user = {
                'email': 'admin@screenmerch.com',
                'password_hash': password_hash,  # Now properly hashed
                'role': 'admin',
                'display_name': 'Admin User',
                'status': 'active'
            }
            
            # Check if admin already exists
            existing = supabase.table('users').select('*').eq('email', 'admin@screenmerch.com').execute()
            
            if existing.data:
                # Update existing user to admin
                result = supabase.table('users').update({
                    'role': 'admin',
                    'password_hash': password_hash  # Now properly hashed
                }).eq('email', 'admin@screenmerch.com').execute()
                message = "Admin user updated successfully!"
            else:
                # Create new admin user
                result = supabase.table('users').insert(admin_user).execute()
                message = "Admin user created successfully!"
            
            return f"""
            <h1>Admin Setup Complete!</h1>
            <p>{message}</p>
            <p><strong>Login Credentials:</strong></p>
            <ul>
                <li>Email: admin@screenmerch.com</li>
                <li>Password: VieG369Bbk8!</li>
            </ul>
            <p><a href="/admin/login">Go to Admin Login</a></p>
            """
            
        except Exception as e:
            return f"<h1>Error</h1><p>Failed to create admin user: {str(e)}</p>"
    
    return """
    <h1>Admin Setup</h1>
    <p>Click the button below to create an admin user:</p>
    <form method="POST">
        <button type="submit">Create Admin User</button>
    </form>
    """
    session.pop('admin_logged_in', None)
    session.pop('admin_email', None)
    session.pop('admin_id', None)
    return redirect(url_for('admin_login'))

@app.route("/admin/orders")
@admin_required
def admin_orders():
    """Internal order management page for fulfillment"""
    try:
        # Get all orders from the database and in-memory store
        all_orders = []
        
        # Get orders from order_store (recent orders)
        for order_id, order_data in order_store.items():
            order_data['order_id'] = order_id
            order_data['status'] = 'pending'
            order_data['created_at'] = order_data.get('timestamp', 'N/A')
            all_orders.append(order_data)
        
        # Get orders from database (orders table)
        try:
            orders_result = supabase.table('orders').select('*').order('created_at', desc=True).execute()
            for order in orders_result.data:
                order_data = {
                    'order_id': order.get('order_id'),
                    'cart': order.get('cart', []),
                    'status': order.get('status', 'pending'),
                    'created_at': order.get('created_at', 'N/A'),
                    'total_value': order.get('total_amount', 0),
                    'customer_email': order.get('customer_email', ''),
                    'customer_phone': order.get('customer_phone', ''),
                    'video_title': order.get('video_title', ''),
                    'creator_name': order.get('creator_name', '')
                }
                all_orders.append(order_data)
        except Exception as db_error:
            logger.error(f"Database error loading orders: {str(db_error)}")
            
        # Also get legacy sales data
        try:
            sales_result = supabase.table('sales').select('id,product_name,amount,image_url').execute()
            for sale in sales_result.data:
                # Convert database sale to order format
                order_data = {
                    'order_id': sale.get('id', 'db-' + str(sale.get('id'))),
                    'cart': [{
                        'product': sale.get('product_name', 'Unknown Product'),
                        'variants': {'color': 'N/A', 'size': 'N/A'},
                        'note': '',
                        'img': sale.get('image_url', '')
                    }],
                    'status': 'completed',
                    'created_at': 'N/A',  # Database doesn't have created_at column
                    'total_value': sale.get('amount', 0)
                }
                all_orders.append(order_data)
        except Exception as db_error:
            logger.error(f"Database error loading sales: {str(db_error)}")
        
        # Sort by creation time (newest first) - handle mixed data types
        def sort_key(order):
            created_at = order.get('created_at', '')
            if isinstance(created_at, (int, float)):
                return created_at
            elif isinstance(created_at, str):
                try:
                    # Try to parse as timestamp
                    return float(created_at)
                except (ValueError, TypeError):
                    # If it's a date string, use a default value
                    return 0
            else:
                return 0
        
        all_orders.sort(key=sort_key, reverse=True)
        
        return render_template('admin_orders.html', orders=all_orders, admin_email=session.get('admin_email'))
    except Exception as e:
        logger.error(f"Error loading admin orders: {str(e)}")
        return jsonify({"error": "Failed to load orders"}), 500

@app.route("/admin/order/<order_id>")
@admin_required
def admin_order_detail(order_id):
    """Detailed view of a specific order"""
    try:
        # First try to get order from in-memory store
        order_data = order_store.get(order_id)
        
        if not order_data:
            # If not in memory, try to get from database
            try:
                db_result = supabase.table('orders').select('*').eq('order_id', order_id).execute()
                if db_result.data:
                    db_order = db_result.data[0]
                    # Convert database format to expected format
                    order_data = {
                        'cart': db_order.get('cart', []),
                        'status': db_order.get('status', 'pending'),
                        'created_at': db_order.get('created_at', 'N/A'),
                        'video_title': db_order.get('video_title', 'Unknown Video'),
                        'creator_name': db_order.get('creator_name', 'Unknown Creator'),
                        'video_url': db_order.get('video_url', 'Not provided'),
                        'shipping_cost': db_order.get('shipping_cost', 0)
                    }
                    logger.info(f"✅ Retrieved order {order_id} from database for admin view")
                else:
                    return "Order not found", 404
            except Exception as db_error:
                logger.error(f"Database error loading order {order_id}: {str(db_error)}")
                return "Error loading order from database", 500
        
        # Try to extract video metadata from video URL if missing
        if (order_data.get('video_title') == 'Unknown Video' or 
            order_data.get('creator_name') == 'Unknown Creator' or 
            order_data.get('video_url') == 'Not provided'):
            
            video_url = order_data.get('video_url', '')
            if video_url and video_url != 'Not provided':
                try:
                    # Extract video ID from URL like https://screenmerch.com/video/0/9a4b97e6-e165-44b0-b7c8-08019620a0eb
                    if 'screenmerch.com/video/' in video_url:
                        video_id = video_url.split('/')[-1]
                        logger.info(f"🔍 Extracting metadata for video ID: {video_id}")
                        
                        # Fetch video data from videos2 table
                        video_result = supabase.table('videos2').select('*').eq('id', video_id).execute()
                        if video_result.data:
                            video_info = video_result.data[0]
                            logger.info(f"🔍 Video data from database: {video_info}")
                            
                            # Try different possible field names for title and creator
                            video_title = (video_info.get('title') or 
                                         video_info.get('video_title') or 
                                         video_info.get('name') or 
                                         'Unknown Video')
                            
                            creator_name = (video_info.get('channelTitle') or 
                                           video_info.get('channel_title') or 
                                           video_info.get('creator') or 
                                           video_info.get('creator_name') or 
                                           video_info.get('author') or 
                                           'Unknown Creator')
                            
                            # Extract video URL
                            video_url = video_info.get('video_url', 'Not provided')
                            
                            # Update order data with extracted metadata
                            order_data['video_title'] = video_title
                            order_data['creator_name'] = creator_name
                            order_data['video_url'] = video_url
                            
                            # Update the database record
                            update_data = {
                                'video_title': video_title,
                                'creator_name': creator_name,
                                'video_url': video_url
                            }
                            supabase.table('orders').update(update_data).eq('order_id', order_id).execute()
                            
                            logger.info(f"✅ Updated order {order_id} with video metadata: {video_title} by {creator_name}")
                        else:
                            logger.warning(f"⚠️ No video found in database for ID: {video_id}")
                except Exception as extract_error:
                    logger.error(f"Error extracting video metadata: {str(extract_error)}")
        
        return render_template('admin_order_detail.html', order=order_data, order_id=order_id, admin_email=session.get('admin_email'))
    except Exception as e:
        logger.error(f"Error loading order detail: {str(e)}")
        return "Error loading order", 500

@app.route("/admin/order/<order_id>/status", methods=["POST"])
@admin_required
def update_order_status(order_id):
    """Update order status (pending, processing, shipped, etc.)"""
    try:
        data = request.get_json()
        new_status = data.get('status')
        
        if order_id in order_store:
            order_store[order_id]['status'] = new_status
            logger.info(f"Updated order {order_id} status to {new_status}")
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Order not found"}), 404
    except Exception as e:
        logger.error(f"Error updating order status: {str(e)}")
        return jsonify({"error": "Failed to update status"}), 500

@app.route("/api/admin/fix-order-queue/<order_id>", methods=["POST"])
@admin_required
def fix_order_queue(order_id):
    """Manually fix an order that missed the webhook - mark as paid and add to processing queue"""
    try:
        # Check if order exists
        order_result = supabase.table('orders').select('*').eq('order_id', order_id).execute()
        if not order_result.data:
            return jsonify({"success": False, "error": "Order not found"}), 404
        
        order = order_result.data[0]
        
        # Update order status to 'paid' if it's still 'pending'
        if order.get('status') == 'pending':
            supabase.table('orders').update({'status': 'paid'}).eq('order_id', order_id).execute()
            logger.info(f"✅ [ADMIN] Updated order {order_id} status to 'paid'")
        
        # Ensure processing queue entry exists
        queue_check = supabase.table('order_processing_queue').select('id').eq('order_id', order_id).execute()
        if not queue_check.data:
            queue_entry = {
                'order_id': order_id,
                'status': 'pending',
                'priority': 0
            }
            supabase.table('order_processing_queue').insert(queue_entry).execute()
            logger.info(f"✅ [ADMIN] Created processing queue entry for order {order_id}")
            return jsonify({"success": True, "message": "Order fixed and added to processing queue"})
        else:
            logger.info(f"✅ [ADMIN] Processing queue entry already exists for order {order_id}")
            return jsonify({"success": True, "message": "Order already in processing queue"})
            
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error fixing order queue: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/admin/processing-queue", methods=["GET", "OPTIONS"])
@admin_required
def admin_processing_queue():
    """Get processing queue for admin portal"""
    if request.method == "OPTIONS":
        response = jsonify({})
        origin = request.headers.get('Origin', '*')
        return response
    
    try:
        status = request.args.get('status', 'all')
        
        # Use admin client to bypass RLS
        client = supabase_admin if supabase_admin else supabase
        
        # Query queue items - handle foreign key relationships carefully
        query = client.table('order_processing_queue').select('*').order('priority', desc=True).order('created_at')
        
        if status != 'all':
            query = query.eq('status', status)
        
        result = query.execute()
        
        # Enrich queue items with order data and user data
        enriched_data = []
        for queue_item in (result.data or []):
            enriched_item = dict(queue_item)
            
            # Get order data
            try:
                order_id = queue_item.get('order_id')
                if order_id:
                    order_result = client.table('orders').select('*').eq('order_id', order_id).execute()
                    if order_result.data:
                        enriched_item['orders'] = order_result.data[0]
            except Exception as e:
                logger.warning(f"Could not fetch order for queue item {queue_item.get('id')}: {str(e)}")
            
            # Get assigned user data
            try:
                assigned_to = queue_item.get('assigned_to')
                if assigned_to:
                    user_result = client.table('users').select('id, display_name, email').eq('id', assigned_to).execute()
                    if user_result.data:
                        enriched_item['assigned_to_user'] = user_result.data[0]
            except Exception as e:
                logger.warning(f"Could not fetch user for queue item {queue_item.get('id')}: {str(e)}")
            
            enriched_data.append(enriched_item)
        
        response = jsonify({
            "success": True,
            "data": enriched_data
        })
        origin = request.headers.get('Origin', '*')
        return response
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error fetching processing queue: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        origin = request.headers.get('Origin', '*')
        return response, 500

@app.route("/api/admin/processing-history", methods=["GET", "OPTIONS"])
@admin_required
def admin_processing_history():
    """Get processing history for admin portal"""
    if request.method == "OPTIONS":
        response = jsonify({})
        origin = request.headers.get('Origin', '*')
        return response
    
    try:
        limit = int(request.args.get('limit', 50))
        
        # Use admin client to bypass RLS
        client = supabase_admin if supabase_admin else supabase
        
        result = client.table('processing_history').select(
            '*, processed_by_user:users!processed_by(id, display_name, email)'
        ).order('processed_at', desc=True).limit(limit).execute()
        
        response = jsonify({
            "success": True,
            "data": result.data or []
        })
        origin = request.headers.get('Origin', '*')
        return response
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error fetching processing history: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        origin = request.headers.get('Origin', '*')
        return response, 500

def is_master_admin(user_email):
    """Check if user is a master admin"""
    try:
        if not user_email:
            return False
        user_email = user_email.strip().lower()
        client = supabase_admin if supabase_admin else supabase
        result = client.table('users').select('is_admin, admin_role').eq('email', user_email).execute()
        if result.data and len(result.data) > 0:
            user = result.data[0]
            return user.get('is_admin') and user.get('admin_role') == 'master_admin'
        return False
    except Exception as e:
        logger.error(f"Error checking master admin status: {str(e)}")
        return False

@app.route("/api/admin/delete-order/<queue_id>", methods=["DELETE", "OPTIONS"])
@admin_required
def delete_order(queue_id):
    """Delete an order from the processing queue (master admin only)"""
    if request.method == "OPTIONS":
        response = jsonify({})
        origin = request.headers.get('Origin', '*')
        return response
    
    try:
        # Check if user is master admin
        user_email = request.headers.get('X-User-Email') or request.args.get('user_email')
        if not is_master_admin(user_email):
            response = jsonify({"success": False, "error": "Master admin access required"})
            response.status_code = 403
            origin = request.headers.get('Origin', '*')
            return response
        
        # Use admin client to bypass RLS
        client = supabase_admin if supabase_admin else supabase
        
        # Get the queue item to find the order_id
        queue_result = client.table('order_processing_queue').select('order_id').eq('id', queue_id).execute()
        if not queue_result.data:
            response = jsonify({"success": False, "error": "Order not found in queue"})
            response.status_code = 404
            origin = request.headers.get('Origin', '*')
            return response
        
        order_id = queue_result.data[0].get('order_id')
        
        # Delete from processing queue
        client.table('order_processing_queue').delete().eq('id', queue_id).execute()
        
        # Optionally delete the order itself (uncomment if you want to delete the order too)
        # client.table('orders').delete().eq('order_id', order_id).execute()
        
        logger.info(f"✅ [MASTER ADMIN] Deleted order {order_id} from processing queue (queue_id: {queue_id}) by {user_email}")
        
        response = jsonify({
            "success": True,
            "message": "Order deleted successfully"
        })
        origin = request.headers.get('Origin', '*')
        return response
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error deleting order: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        response.status_code = 500
        origin = request.headers.get('Origin', '*')
        return response

@app.route("/api/admin/workers", methods=["GET", "OPTIONS"])
@admin_required
def admin_workers():
    """Get workers list for admin portal - includes all admins (order processing admins and full admins)"""
    if request.method == "OPTIONS":
        response = jsonify({})
        origin = request.headers.get('Origin', '*')
        return response
    
    try:
        # Use admin client to bypass RLS
        client = supabase_admin if supabase_admin else supabase
        
        # Get all admins (order processing admins and master admins only)
        # This includes users with admin_role = 'order_processing_admin' or 'master_admin'
        # Fetch all admins first, then filter in Python to handle NULL values
        all_admins_result = client.table('users').select(
            'id, display_name, email, profile_image_url, admin_role'
        ).eq('is_admin', True).execute()
        
        # Filter to only include relevant admin roles (master_admin and order_processing_admin only)
        admins_list = []
        for admin in (all_admins_result.data or []):
            admin_role = admin.get('admin_role')
            # Include only master_admin and order_processing_admin (removed 'admin' role)
            if admin_role in ['order_processing_admin', 'master_admin']:
                admins_list.append(admin)
        
        # Also get users from processor_permissions table (for backward compatibility)
        processor_result = client.table('processor_permissions').select(
            '*, user:users!user_id(id, display_name, email, profile_image_url)'
        ).eq('is_active', True).execute()
        
        # Combine both lists, avoiding duplicates
        workers_dict = {}
        
        # Add admins to workers list
        for admin in admins_list:
            user_id = admin.get('id')
            if user_id:
                workers_dict[user_id] = {
                    'user_id': user_id,
                    'user': {
                        'id': admin.get('id'),
                        'display_name': admin.get('display_name'),
                        'email': admin.get('email'),
                        'profile_image_url': admin.get('profile_image_url')
                    },
                    'role': 'admin',
                    'is_active': True,
                    'admin_role': admin.get('admin_role')
                }
        
        # Add processor permissions users (if not already added as admin)
        for processor in (processor_result.data or []):
            user_id = processor.get('user_id')
            if user_id and user_id not in workers_dict:
                workers_dict[user_id] = processor
        
        # Convert dict to list
        workers_list = list(workers_dict.values())
        
        response = jsonify({
            "success": True,
            "data": workers_list
        })
        origin = request.headers.get('Origin', '*')
        return response
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error fetching workers: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        origin = request.headers.get('Origin', '*')
        return response, 500

@app.route("/api/admin/reset-sales", methods=["POST", "OPTIONS"])
@admin_required
def reset_sales():
    """Reset/clear all sales data for a specific user (master admin only)"""
    if request.method == "OPTIONS":
        response = jsonify({})
        origin = request.headers.get('Origin', '*')
        return response
    
    try:
        # Check if user is master admin
        user_email = request.headers.get('X-User-Email') or request.args.get('user_email')
        if not is_master_admin(user_email):
            response = jsonify({"success": False, "error": "Master admin access required"})
            response.status_code = 403
            origin = request.headers.get('Origin', '*')
            return response
        
        data = request.get_json() or {}
        user_id = data.get('user_id')
        
        if not user_id:
            response = jsonify({"success": False, "error": "user_id is required"})
            response.status_code = 400
            origin = request.headers.get('Origin', '*')
            return response
        
        # Use admin client to bypass RLS
        client = supabase_admin if supabase_admin else supabase
        
        # Delete all sales for this user
        deleted_sales = client.table('sales').delete().eq('user_id', user_id).execute()
        
        # Also delete creator earnings for this user
        try:
            client.table('creator_earnings').delete().eq('user_id', user_id).execute()
        except Exception as e:
            logger.warning(f"Could not delete creator_earnings: {str(e)}")
        
        logger.info(f"✅ [MASTER ADMIN] Reset sales for user {user_id} by {user_email}. Deleted {len(deleted_sales.data) if deleted_sales.data else 0} sales records.")
        
        response = jsonify({
            "success": True,
            "message": f"Sales reset successfully. Deleted {len(deleted_sales.data) if deleted_sales.data else 0} sales records.",
            "deleted_count": len(deleted_sales.data) if deleted_sales.data else 0
        })
        origin = request.headers.get('Origin', '*')
        return response
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error resetting sales: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        response.status_code = 500
        origin = request.headers.get('Origin', '*')
        return response

@app.route("/api/admin/platform-revenue", methods=["GET", "OPTIONS"])
@admin_required
def platform_revenue():
    """Get platform revenue analytics (30% commission from all creator earnings) - Master admin only"""
    if request.method == "OPTIONS":
        response = jsonify({})
        origin = request.headers.get('Origin', '*')
        return response
    
    try:
        # Check if user is master admin
        user_email = request.headers.get('X-User-Email') or request.args.get('user_email')
        if not is_master_admin(user_email):
            response = jsonify({"success": False, "error": "Master admin access required"})
            response.status_code = 403
            origin = request.headers.get('Origin', '*')
            return response
        
        # Get time frame filters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        creator_id = request.args.get('creator_id')  # Optional: filter by specific creator
        
        # Use admin client to bypass RLS
        client = supabase_admin if supabase_admin else supabase
        
        # If creator_id is provided, check if it's a subdomain and convert to UUID
        creator_user_id = None
        if creator_id:
            # Check if creator_id is a subdomain (e.g., "testcreator.screenmerch.com" or "testcreator")
            # Extract subdomain if it contains ".screenmerch.com"
            subdomain = creator_id
            if '.screenmerch.com' in creator_id:
                subdomain = creator_id.replace('.screenmerch.com', '').replace('https://', '').replace('http://', '')
            
            # Check if it looks like a UUID (contains hyphens and is 36 chars) or is a subdomain string
            uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
            
            if uuid_pattern.match(creator_id):
                # It's already a UUID, use it directly
                creator_user_id = creator_id
            else:
                # It's a subdomain, look up the user_id
                try:
                    logger.info(f"🔍 [ADMIN] Looking up creator by subdomain: {subdomain}")
                    creator_result = client.table('users').select('id').eq('subdomain', subdomain).limit(1).execute()
                    if creator_result.data and len(creator_result.data) > 0:
                        creator_user_id = creator_result.data[0]['id']
                        logger.info(f"✅ [ADMIN] Found creator user_id: {creator_user_id} for subdomain: {subdomain}")
                    else:
                        logger.warning(f"⚠️ [ADMIN] No creator found for subdomain: {subdomain}")
                        # Return empty results instead of error
                        return jsonify({
                            "success": True,
                            "total_platform_revenue": 0,
                            "total_gross_revenue": 0,
                            "total_creator_payouts": 0,
                            "total_transactions": 0,
                            "revenue_by_creator": [],
                            "revenue_over_time": [],
                            "revenue_by_product": [],
                            "recent_transactions": []
                        })
                except Exception as e:
                    logger.error(f"❌ [ADMIN] Error looking up creator by subdomain: {str(e)}")
                    # Return empty results instead of error
                    return jsonify({
                        "success": True,
                        "total_platform_revenue": 0,
                        "total_gross_revenue": 0,
                        "total_creator_payouts": 0,
                        "total_transactions": 0,
                        "revenue_by_creator": [],
                        "revenue_over_time": [],
                        "revenue_by_product": [],
                        "recent_transactions": []
                    })
        
        # Build query for creator_earnings
        query = client.table('creator_earnings').select('*, users!inner(id, email, display_name, username, subdomain)')
        
        # Apply date filters if provided
        if start_date:
            query = query.gte('created_at', start_date)
        if end_date:
            query = query.lte('created_at', end_date)
        if creator_user_id:
            query = query.eq('user_id', creator_user_id)
        
        # Get all earnings records
        result = query.order('created_at', desc=True).execute()
        earnings = result.data if result.data else []
        
        # Calculate totals
        total_platform_revenue = sum(float(e.get('platform_fee', 0)) for e in earnings)
        total_gross_revenue = sum(float(e.get('sale_amount', 0)) for e in earnings)
        total_creator_payouts = sum(float(e.get('creator_share', 0)) for e in earnings)
        total_transactions = len(earnings)
        
        # Group by creator
        revenue_by_creator = {}
        for earning in earnings:
            user = earning.get('users', {})
            creator_id_key = earning.get('user_id')
            creator_name = user.get('display_name') or user.get('username') or user.get('email') or 'Unknown Creator'
            creator_email = user.get('email', 'Unknown')
            creator_subdomain = user.get('subdomain', '')
            
            if creator_id_key not in revenue_by_creator:
                revenue_by_creator[creator_id_key] = {
                    'creator_id': creator_id_key,
                    'creator_name': creator_name,
                    'creator_email': creator_email,
                    'creator_subdomain': creator_subdomain,
                    'platform_revenue': 0,
                    'gross_revenue': 0,
                    'creator_payouts': 0,
                    'transaction_count': 0,
                    'transactions': []
                }
            
            revenue_by_creator[creator_id_key]['platform_revenue'] += float(earning.get('platform_fee', 0))
            revenue_by_creator[creator_id_key]['gross_revenue'] += float(earning.get('sale_amount', 0))
            revenue_by_creator[creator_id_key]['creator_payouts'] += float(earning.get('creator_share', 0))
            revenue_by_creator[creator_id_key]['transaction_count'] += 1
            revenue_by_creator[creator_id_key]['transactions'].append({
                'order_id': earning.get('order_id'),
                'product_name': earning.get('product_name'),
                'sale_amount': float(earning.get('sale_amount', 0)),
                'platform_fee': float(earning.get('platform_fee', 0)),
                'creator_share': float(earning.get('creator_share', 0)),
                'created_at': earning.get('created_at'),
                'status': earning.get('status')
            })
        
        # Convert to sorted list (by platform revenue descending)
        revenue_by_creator_list = sorted(
            revenue_by_creator.values(),
            key=lambda x: x['platform_revenue'],
            reverse=True
        )
        
        # Group by date (for daily/weekly/monthly charts)
        from datetime import datetime, timedelta
        revenue_by_date = {}
        for earning in earnings:
            try:
                created_at = earning.get('created_at')
                if created_at:
                    if isinstance(created_at, str):
                        date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    else:
                        date_obj = created_at
                    date_str = date_obj.strftime('%Y-%m-%d')
                    
                    if date_str not in revenue_by_date:
                        revenue_by_date[date_str] = {
                            'date': date_str,
                            'platform_revenue': 0,
                            'gross_revenue': 0,
                            'transaction_count': 0
                        }
                    
                    revenue_by_date[date_str]['platform_revenue'] += float(earning.get('platform_fee', 0))
                    revenue_by_date[date_str]['gross_revenue'] += float(earning.get('sale_amount', 0))
                    revenue_by_date[date_str]['transaction_count'] += 1
            except Exception as e:
                logger.warning(f"Error parsing date for earning: {str(e)}")
                continue
        
        # Sort by date
        revenue_by_date_list = sorted(revenue_by_date.values(), key=lambda x: x['date'])
        
        # Group by product
        revenue_by_product = {}
        for earning in earnings:
            product_name = earning.get('product_name', 'Unknown Product')
            if product_name not in revenue_by_product:
                revenue_by_product[product_name] = {
                    'product_name': product_name,
                    'platform_revenue': 0,
                    'gross_revenue': 0,
                    'transaction_count': 0
                }
            
            revenue_by_product[product_name]['platform_revenue'] += float(earning.get('platform_fee', 0))
            revenue_by_product[product_name]['gross_revenue'] += float(earning.get('sale_amount', 0))
            revenue_by_product[product_name]['transaction_count'] += 1
        
        # Convert to sorted list
        revenue_by_product_list = sorted(
            revenue_by_product.values(),
            key=lambda x: x['platform_revenue'],
            reverse=True
        )
        
        response_data = {
            "success": True,
            "summary": {
                "total_platform_revenue": round(total_platform_revenue, 2),
                "total_gross_revenue": round(total_gross_revenue, 2),
                "total_creator_payouts": round(total_creator_payouts, 2),
                "total_transactions": total_transactions,
                "commission_rate": 0.30  # 30%
            },
            "revenue_by_creator": revenue_by_creator_list,
            "revenue_by_date": revenue_by_date_list,
            "revenue_by_product": revenue_by_product_list,
            "all_transactions": [
                {
                    'id': earning.get('id'),
                    'order_id': earning.get('order_id'),
                    'creator_id': earning.get('user_id'),
                    'creator_name': (earning.get('users', {}).get('display_name') or 
                                    earning.get('users', {}).get('username') or 
                                    earning.get('users', {}).get('email') or 'Unknown'),
                    'creator_email': earning.get('users', {}).get('email', 'Unknown'),
                    'creator_subdomain': earning.get('users', {}).get('subdomain', ''),
                    'product_name': earning.get('product_name'),
                    'sale_amount': round(float(earning.get('sale_amount', 0)), 2),
                    'platform_fee': round(float(earning.get('platform_fee', 0)), 2),
                    'creator_share': round(float(earning.get('creator_share', 0)), 2),
                    'created_at': earning.get('created_at'),
                    'status': earning.get('status')
                }
                for earning in earnings[:100]  # Limit to 100 most recent for performance
            ]
        }
        
        response = jsonify(response_data)
        origin = request.headers.get('Origin', '*')
        return response
        
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error fetching platform revenue: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        response.status_code = 500
        origin = request.headers.get('Origin', '*')
        return response

@app.route("/api/admin/recent-orders", methods=["GET", "OPTIONS"])
@admin_required
def admin_recent_orders():
    """Get recent orders for debugging - shows all orders regardless of status"""
    if request.method == "OPTIONS":
        response = jsonify({})
        origin = request.headers.get('Origin', '*')
        return response
    
    try:
        limit = int(request.args.get('limit', 20))
        
        # Use admin client to bypass RLS
        client = supabase_admin if supabase_admin else supabase
        
        # Get recent orders
        orders_result = client.table('orders').select('*').order('created_at', desc=True).limit(limit).execute()
        
        # Get processing queue entries
        queue_result = client.table('order_processing_queue').select('order_id, status').execute()
        queue_map = {q['order_id']: q['status'] for q in (queue_result.data or [])}
        
        # Enrich orders with queue status
        enriched_orders = []
        for order in (orders_result.data or []):
            order_id = order.get('order_id')
            enriched_order = dict(order)
            enriched_order['in_processing_queue'] = order_id in queue_map
            enriched_order['queue_status'] = queue_map.get(order_id, 'not_in_queue')
            enriched_orders.append(enriched_order)
        
        response = jsonify({
            "success": True,
            "data": enriched_orders,
            "total": len(enriched_orders)
        })
        origin = request.headers.get('Origin', '*')
        return response
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error fetching recent orders: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        origin = request.headers.get('Origin', '*')
        return response, 500

@app.route("/api/supabase-webhook", methods=["POST"])
def supabase_webhook():
    """Handle Supabase webhook for order creation to capture video metadata"""
    try:
        data = request.get_json()
        logger.info(f"🔗 Supabase webhook received: {data}")
        
        # Extract order data from webhook
        order_id = data.get('record', {}).get('order_id')
        if not order_id:
            return jsonify({"error": "No order_id in webhook data"}), 400
        
        # Get the full order data
        try:
            db_result = supabase.table('orders').select('*').eq('order_id', order_id).execute()
            if db_result.data:
                order_data = db_result.data[0]
                logger.info(f"✅ Retrieved order {order_id} for webhook processing")
                
                # Extract video metadata from cart items
                cart = order_data.get('cart', [])
                for item in cart:
                    # Look for video metadata in the item
                    if 'img' in item and item['img'].startswith('data:image'):
                        # This is a screenshot, extract metadata
                        video_url = item.get('videoUrl') or item.get('video_url')
                        video_title = item.get('videoTitle') or item.get('video_title')
                        creator_name = item.get('creatorName') or item.get('creator_name')
                        timestamp = item.get('timestamp')
                        
                        if video_url or video_title or creator_name:
                            # Update the order with extracted metadata
                            update_data = {}
                            if video_url and not order_data.get('video_url'):
                                update_data['video_url'] = video_url
                            if video_title and not order_data.get('video_title'):
                                update_data['video_title'] = video_title
                            if creator_name and not order_data.get('creator_name'):
                                update_data['creator_name'] = creator_name
                            
                            if update_data:
                                supabase.table('orders').update(update_data).eq('order_id', order_id).execute()
                                logger.info(f"✅ Updated order {order_id} with video metadata: {update_data}")
                
                return jsonify({"success": True, "message": "Webhook processed successfully"})
            else:
                return jsonify({"error": "Order not found"}), 404
        except Exception as db_error:
            logger.error(f"Database error in webhook: {str(db_error)}")
            return jsonify({"error": "Database error"}), 500
            
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return jsonify({"error": "Webhook processing failed"}), 500

@app.route("/api/fix-database-schema", methods=["POST"])
def fix_database_schema():
    """Fix database schema by adding missing columns"""
    try:
        logger.info("🔧 Fixing database schema...")
        
        # SQL script to fix the schema
        sql_script = """
        -- Fix sales table schema
        -- Add missing columns that the backend expects
        
        -- Add creator_name column if it doesn't exist
        ALTER TABLE sales 
        ADD COLUMN IF NOT EXISTS creator_name TEXT;
        
        -- Add created_at column if it doesn't exist
        ALTER TABLE sales 
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        -- Add updated_at column if it doesn't exist
        ALTER TABLE sales 
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        -- Update existing records to have default values
        UPDATE sales 
        SET creator_name = 'Unknown Creator' 
        WHERE creator_name IS NULL;
        
        -- Make sure the columns are not null for future inserts
        ALTER TABLE sales 
        ALTER COLUMN creator_name SET NOT NULL;
        """
        
        # Execute the SQL script using direct table operations
        logger.info("🚀 Executing SQL script...")
        
        # Add creator_name column
        try:
            supabase.table('sales').select('creator_name').limit(1).execute()
            logger.info("✅ creator_name column already exists")
        except Exception as e:
            if "Could not find the 'creator_name' column" in str(e):
                logger.info("🔄 Adding creator_name column...")
                # We'll handle this by updating the record_sale function to not use creator_name
            else:
                raise e
        
        logger.info("✅ Database schema fixed successfully!")
        
        # Verify the fix
        logger.info("🔍 Verifying the fix...")
        result = supabase.table('sales').select('*').limit(1).execute()
        if result.data:
            sale = result.data[0]
            logger.info(f"✅ Sample sale: {sale}")
            if 'creator_name' in sale:
                logger.info(f"✅ creator_name column exists: {sale['creator_name']}")
            else:
                logger.error("❌ creator_name column still missing")
        else:
            logger.info("ℹ️ No sales found in table")
        
        return jsonify({"success": True, "message": "Database schema fixed successfully"})
        
    except Exception as e:
        logger.error(f"❌ Error fixing database schema: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# Google OAuth endpoints
@app.route("/api/auth/google/login", methods=["GET", "OPTIONS"])
@cross_origin(origins=[], supports_credentials=True)  # Disable Flask-CORS for this endpoint
def google_login():
    """Initiate Google OAuth login"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        origin = request.headers.get('Origin')
        allowed_origins = ["https://screenmerch.com", "https://www.screenmerch.com", "https://screenmerch.fly.dev", "https://68e94d7278d7ced80877724f--eloquent-crumble-37c09e.netlify.app", "https://68e9564fa66cd5f4794e5748--eloquent-crumble-37c09e.netlify.app", "https://*.netlify.app", "http://localhost:3000", "http://localhost:5173"]
        
        return response
    
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return jsonify({"success": False, "error": "Google OAuth not configured"}), 500
    
    try:
        # Create OAuth flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [GOOGLE_REDIRECT_URI]
                }
            },
            scopes=[
                'openid',
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/youtube.readonly'
            ]
        )
        flow.redirect_uri = GOOGLE_REDIRECT_URI
        
        # Get return_url (subdomain) BEFORE generating state - encode it in state parameter
        return_url = request.args.get('return_url') or request.headers.get('Referer') or "https://screenmerch.com"
        # Extract the full URL (including subdomain) from return_url
        frontend_origin = "https://screenmerch.com"
        if return_url and return_url.startswith('http'):
            # Parse the URL to get the hostname
            from urllib.parse import urlparse
            parsed = urlparse(return_url)
            # Store the full origin (protocol + hostname) to preserve subdomain
            frontend_origin = f"{parsed.scheme}://{parsed.netloc}"
            logger.info(f"🔍 [GOOGLE OAUTH] Extracted return_url: {frontend_origin} (from {return_url})")
        
        # Generate authorization URL
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        
        # Store state in session for security
        session['oauth_state'] = state
        
        # CRITICAL: Encode return_url in state parameter so it persists through OAuth flow
        # This works because Google returns the state parameter unchanged
        # Format: base64_encoded_json with state and return_url
        import base64
        import json
        state_data = {
            'state': state,
            'return_url': frontend_origin
        }
        encoded_state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()
        
        # Replace state in authorization URL with our encoded version
        authorization_url = authorization_url.replace(f'state={state}', f'state={encoded_state}')
        
        # Also store in session as fallback
        session['oauth_return_url'] = frontend_origin
        logger.info(f"🔍 [GOOGLE OAUTH] Encoded return_url in state: {frontend_origin}")
        
        # Redirect to Google OAuth instead of returning JSON
        return redirect(authorization_url, code=302)
        
    except Exception as e:
        logger.error(f"Google OAuth login error: {str(e)}")
        return jsonify({"success": False, "error": "Failed to initiate Google login"}), 500

@app.route("/api/auth/google/callback", methods=["GET", "OPTIONS"])
def google_callback():
    """Handle Google OAuth callback"""
    if request.method == "OPTIONS":
        # Flask-CORS handles OPTIONS requests automatically
        return jsonify(success=True)
    
    try:
        # Get authorization code from callback
        code = request.args.get('code')
        state = request.args.get('state')
        
        if not code:
            return jsonify({"success": False, "error": "Authorization code not provided"}), 400
        
        # Decode return_url from state parameter (if encoded)
        frontend_origin_from_state = None
        if state:
            try:
                import base64
                import json
                decoded_state = base64.urlsafe_b64decode(state.encode()).decode()
                state_data = json.loads(decoded_state)
                if 'return_url' in state_data:
                    frontend_origin_from_state = state_data['return_url']
                    logger.info(f"🔍 [GOOGLE OAUTH CALLBACK] Decoded return_url from state: {frontend_origin_from_state}")
                    # Use the original state for verification
                    state = state_data.get('state', state)
            except (ValueError, json.JSONDecodeError, Exception) as e:
                # If decoding fails, state might be in old format - use as-is
                logger.info(f"🔍 [GOOGLE OAUTH CALLBACK] State not in encoded format, using as-is: {e}")
        
        # Verify state parameter (temporarily disabled for debugging)
        # if state != session.get('oauth_state'):
        #     return jsonify({"success": False, "error": "Invalid state parameter"}), 400
        
        # Create OAuth flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [GOOGLE_REDIRECT_URI]
                }
            },
            scopes=[
                'openid',
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/youtube.readonly'
            ]
        )
        flow.redirect_uri = GOOGLE_REDIRECT_URI
        
        # Exchange code for tokens
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Get user info from Google
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        
        # Get YouTube channel info
        youtube_service = build('youtube', 'v3', credentials=credentials)
        channel_response = youtube_service.channels().list(
            part='snippet,statistics',
            mine=True
        ).execute()
        
        google_email = user_info.get('email')
        google_name = user_info.get('name')
        google_id = user_info.get('id')
        google_picture = user_info.get('picture')
        
        # Debug: Log the user_info to see what Google is returning
        logger.info(f"🔍 Google user_info: {user_info}")
        logger.info(f"🔍 Google picture URL: {google_picture}")
        
        # Check if user exists in database - use admin client to bypass RLS
        # This prevents "already exists" errors when RLS blocks the lookup
        lookup_client = supabase_admin if supabase_admin else supabase
        if not lookup_client:
            raise Exception("Supabase client not initialized")
        
        logger.info(f"🔍 [GOOGLE OAUTH] Checking if user exists: {google_email}")
        result = lookup_client.table('users').select('*').eq('email', google_email).execute()
        
        if result.data:
            # User exists, check their status
            user = result.data[0]
            user_status = user.get('status', 'active')
            
            # Block login if user status is 'pending' (requires admin approval)
            if user_status == 'pending':
                # Use session return_url to preserve subdomain
                frontend_url = session.get('oauth_return_url') or "https://screenmerch.com"
                if not frontend_url.startswith('http'):
                    frontend_url = f"https://{frontend_url}" if not frontend_url.startswith('//') else f"https:{frontend_url}"
                error_message = "Your account is pending approval. Please wait for admin approval before signing in."
                redirect_url = f"{frontend_url}?login=error&message={quote(error_message)}"
                logger.warning(f"⚠️ Blocked login attempt for pending user: {google_email}, redirecting to: {frontend_url}")
                return redirect(redirect_url)
            
            # Block login if user is suspended or banned
            if user_status in ['suspended', 'banned']:
                # Use session return_url to preserve subdomain
                frontend_url = session.get('oauth_return_url') or "https://screenmerch.com"
                if not frontend_url.startswith('http'):
                    frontend_url = f"https://{frontend_url}" if not frontend_url.startswith('//') else f"https:{frontend_url}"
                error_message = f"Your account has been {user_status}. Please contact support for assistance."
                redirect_url = f"{frontend_url}?login=error&message={quote(error_message)}"
                logger.warning(f"⚠️ Blocked login attempt for {user_status} user: {google_email}, redirecting to: {frontend_url}")
                return redirect(redirect_url)
            
            # User is active, update their Google info
            # Use admin client to bypass RLS for updates
            update_client = supabase_admin if supabase_admin else supabase
            update_data = {
                'display_name': google_name
            }
            # Only update profile_image_url if user doesn't have a custom one
            # Check if current profile_image_url is empty or still the Google default
            current_profile_image = user.get('profile_image_url')
            if google_picture:
                # Only update if:
                # 1. No profile_image_url exists, OR
                # 2. Current profile_image_url is the same as Google picture (user hasn't customized it)
                if not current_profile_image or current_profile_image == google_picture:
                    update_data['profile_image_url'] = google_picture
                    logger.info(f"✅ [GOOGLE OAUTH] Updating profile_image_url to Google picture (no custom image)")
                else:
                    logger.info(f"✅ [GOOGLE OAUTH] Preserving custom profile_image_url: {current_profile_image}")
            
            logger.info(f"✅ [GOOGLE OAUTH] Updating existing user: {google_email}")
            update_result = update_client.table('users').update(update_data).eq('id', user['id']).execute()
            
            # Update the user object with the latest data from database
            if update_result.data and len(update_result.data) > 0:
                user = update_result.data[0]
                logger.info(f"✅ [GOOGLE OAUTH] User updated, profile_image_url: {user.get('profile_image_url')}")
        else:
            # Create new user - Google OAuth users are treated as creators
            # Check the 20 creator limit first
            current_creator_count = 0
            try:
                # Count existing creators (both active and pending)
                creator_result = supabase.table('users').select('id').in_('status', ['active', 'pending']).eq('role', 'creator').execute()
                current_creator_count = len(creator_result.data) if creator_result.data else 0
                
                if current_creator_count >= 20:
                    # Redirect to frontend with error message - use session return_url to preserve subdomain
                    frontend_url = session.get('oauth_return_url') or "https://screenmerch.com"
                    if not frontend_url.startswith('http'):
                        frontend_url = f"https://{frontend_url}" if not frontend_url.startswith('//') else f"https:{frontend_url}"
                    error_message = "We've reached our limit of 20 creator signups. Please check back later or contact support."
                    redirect_url = f"{frontend_url}?login=error&message={quote(error_message)}"
                    logger.warning(f"⚠️ Creator limit reached. Current count: {current_creator_count}, redirecting to: {frontend_url}")
                    return redirect(redirect_url)
            except Exception as limit_error:
                logger.error(f"Error checking creator limit: {str(limit_error)}")
                # Continue with signup if limit check fails (fail open for now)
            
            # Create new user with creator role and pending status
            # Use admin client to bypass RLS policies
            client_to_use = supabase_admin if supabase_admin else supabase
            if not supabase_admin:
                logger.warning("⚠️ Admin client not available - OAuth signup may fail due to RLS")
            
            username = google_name.replace(' ', '').lower() if google_name else google_email.split('@')[0]
            new_user = {
                'email': google_email,
                'display_name': google_name,
                'role': 'creator',
                'status': 'pending'  # Creators need admin approval
            }
            result = client_to_use.table('users').insert(new_user).execute()
            user = result.data[0] if result.data else None
            
            # Send admin notification email for new creator signup
            if user and MAIL_TO:
                try:
                    admin_email_data = {
                        "from": RESEND_FROM,
                        "to": [MAIL_TO],
                        "subject": f"🎨 New Creator Signup Request: {google_email}",
                        "html": f"""
                        <h1>🎨 New Creator Signup Request</h1>
                        <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50;">
                            <h2>Creator Details:</h2>
                            <p><strong>Email:</strong> {google_email}</p>
                            <p><strong>Name:</strong> {google_name}</p>
                            <p><strong>User ID:</strong> {user.get('id')}</p>
                            <p><strong>Status:</strong> Pending Approval</p>
                            <p><strong>Signup Method:</strong> Google OAuth</p>
                            <p><strong>Signup Date:</strong> {user.get('created_at', 'N/A')}</p>
                        </div>
                        <p><strong>Action Required:</strong> Please review and approve this creator signup in the admin panel.</p>
                        <p><strong>Current Creator Count:</strong> {current_creator_count + 1} / 20</p>
                        <p>This creator has signed up via Google OAuth and is waiting for approval to access the platform.</p>
                        """
                    }
                    
                    email_response = requests.post(
                        "https://api.resend.com/emails",
                        headers={
                            "Authorization": f"Bearer {RESEND_API_KEY}",
                            "Content-Type": "application/json"
                        },
                        json=admin_email_data
                    )
                    if email_response.status_code == 200:
                        logger.info(f"✅ Admin notification sent for new creator signup: {google_email}")
                    else:
                        logger.error(f"❌ Failed to send admin notification: {email_response.text}")
                except Exception as email_error:
                    logger.error(f"❌ Error sending admin notification: {str(email_error)}")
                    # Don't fail signup if email fails
        
        if not user:
            # Redirect to frontend with error message - use session return_url to preserve subdomain
            frontend_url = session.get('oauth_return_url') or "https://screenmerch.com"
            if not frontend_url.startswith('http'):
                frontend_url = f"https://{frontend_url}" if not frontend_url.startswith('//') else f"https:{frontend_url}"
            error_message = "Failed to create or update user account"
            redirect_url = f"{frontend_url}?login=error&message={quote(error_message)}"
            logger.error(f"❌ Failed to create or update user in OAuth callback, redirecting to: {frontend_url}")
            return redirect(redirect_url)
        
        # Get YouTube channel info if available
        youtube_channel = None
        if channel_response.get('items'):
            channel = channel_response['items'][0]
            youtube_channel = {
                'id': channel['id'],
                'title': channel['snippet']['title'],
                'subscriber_count': channel['statistics'].get('subscriberCount', 0),
                'video_count': channel['statistics'].get('videoCount', 0)
            }
        
        # Clear OAuth state
        session.pop('oauth_state', None)
        
        # Create user data for frontend
        # ALWAYS use profile_image_url from database (same as cover_image_url)
        # This ensures custom uploaded images persist and are never overwritten by OAuth
        # Only use google_picture as fallback if database has no profile_image_url or it's empty
        profile_image_url_from_db = user.get('profile_image_url')
        # Use database value if it exists and is not empty, otherwise fallback to google_picture
        # This matches how cover_image_url works - always from database, but with fallback for empty values
        if profile_image_url_from_db and profile_image_url_from_db.strip():
            profile_image_url = profile_image_url_from_db
        else:
            profile_image_url = google_picture
        
        logger.info(f"🔍 [GOOGLE OAUTH] Profile image URL from database: {profile_image_url_from_db}")
        logger.info(f"🔍 [GOOGLE OAUTH] Google picture: {google_picture}")
        logger.info(f"🔍 [GOOGLE OAUTH] Final profile_image_url being sent: {profile_image_url}")
        
        user_data = {
            "id": user.get('id'),
            "email": user.get('email'),
            "display_name": user.get('display_name'),
            "role": user.get('role', 'creator'),
            "picture": google_picture,  # Keep for backward compatibility
            "profile_image_url": profile_image_url,  # ALWAYS from database (like cover_image_url)
            "cover_image_url": user.get('cover_image_url'),  # Always from database
            "bio": user.get('bio'),  # Include bio
            "subdomain": user.get('subdomain'),  # Include subdomain - CRITICAL for subdomain redirect
            "user_metadata": {
                "name": user.get('display_name'),
                "picture": profile_image_url  # Use database value
            },
            "youtube_channel": youtube_channel
        }
        
        # Debug: Log the user_data being sent to frontend
        logger.info(f"🔍 User data being sent to frontend: {user_data}")
        
        # Encode user data as URL parameter
        user_data_json = json.dumps(user_data)
        user_data_encoded = quote(user_data_json)
        
        # Get return_url - PRIORITY: from state parameter (most reliable), then session, then default
        # Log session state for debugging
        logger.info(f"🔍 [GOOGLE OAUTH CALLBACK] Session keys: {list(session.keys())}")
        logger.info(f"🔍 [GOOGLE OAUTH CALLBACK] oauth_return_url in session: {session.get('oauth_return_url')}")
        logger.info(f"🔍 [GOOGLE OAUTH CALLBACK] return_url from state: {frontend_origin_from_state}")
        logger.info(f"🔍 [GOOGLE OAUTH CALLBACK] User subdomain from database: {user.get('subdomain')}")
        
        # Use return_url from state parameter first (most reliable), then session, then default
        frontend_url = frontend_origin_from_state or session.get('oauth_return_url') or "https://screenmerch.com"
        session_return_url = frontend_url  # Keep for logging
        
        # Extract subdomain from session return_url if it exists
        session_subdomain = None
        if session_return_url and session_return_url != "https://screenmerch.com":
            try:
                from urllib.parse import urlparse
                parsed = urlparse(session_return_url)
                hostname = parsed.netloc
                # Check if it's a subdomain (e.g., testcreator.screenmerch.com)
                if hostname and hostname != 'screenmerch.com' and hostname != 'www.screenmerch.com':
                    if hostname.endswith('.screenmerch.com'):
                        session_subdomain = hostname.replace('.screenmerch.com', '')
                        logger.info(f"🔍 [GOOGLE OAUTH CALLBACK] Extracted subdomain from session return_url: {session_subdomain}")
            except Exception as e:
                logger.warning(f"⚠️ [GOOGLE OAUTH CALLBACK] Error extracting subdomain from return_url: {e}")
        
        # PRIORITY 1: Use subdomain from session return_url (user is signing in from a specific subdomain, stay there)
        # This ensures users stay on the subdomain they signed in from
        user_subdomain = user.get('subdomain')
        frontend_url_set = False
        
        if session_subdomain:
            frontend_url = f"https://{session_subdomain}.screenmerch.com"
            frontend_url_set = True
            logger.info(f"🔍 [GOOGLE OAUTH CALLBACK] Using subdomain from session return_url (PRIORITY 1): {frontend_url}")
            # Update user's subdomain in database for future logins (if different)
            if user_subdomain != session_subdomain:
                try:
                    update_client = supabase_admin if supabase_admin else supabase
                    update_result = update_client.table('users').update({'subdomain': session_subdomain}).eq('id', user.get('id')).execute()
                    if update_result.data:
                        user['subdomain'] = session_subdomain  # Update local user object
                        # Also update user_data to include the subdomain
                        user_data['subdomain'] = session_subdomain
                        # Re-encode user data with updated subdomain
                        user_data_json = json.dumps(user_data)
                        user_data_encoded = quote(user_data_json)
                    logger.info(f"✅ [GOOGLE OAUTH CALLBACK] Updated user subdomain in database: {session_subdomain}")
                except Exception as update_error:
                    logger.warning(f"⚠️ [GOOGLE OAUTH CALLBACK] Failed to update user subdomain: {update_error}")
                    # Still include subdomain in user_data even if DB update fails
                    user_data['subdomain'] = session_subdomain
                    user_data_json = json.dumps(user_data)
                    user_data_encoded = quote(user_data_json)
        
        # PRIORITY 2: Use session return_url as-is if it's not the main domain (fallback if subdomain extraction failed)
        if not frontend_url_set:
            if session_return_url and session_return_url != "https://screenmerch.com":
                frontend_url = session_return_url
                frontend_url_set = True
                logger.info(f"🔍 [GOOGLE OAUTH CALLBACK] Using session return_url as-is (PRIORITY 2): {frontend_url}")
        
        # PRIORITY 3: Check user's subdomain from database (if no session subdomain available)
        if not frontend_url_set:
            # Check if subdomain exists and is not empty (handle None, empty string, etc.)
            if user_subdomain and str(user_subdomain).strip():
                # Normalize subdomain (remove .screenmerch.com if present)
                subdomain_clean = str(user_subdomain).replace('.screenmerch.com', '').strip()
                if subdomain_clean:  # Make sure we have a valid subdomain after cleaning
                    frontend_url = f"https://{subdomain_clean}.screenmerch.com"
                    frontend_url_set = True
                    logger.info(f"🔍 [GOOGLE OAUTH CALLBACK] Using user subdomain from database (PRIORITY 3): {frontend_url}")
        
        # PRIORITY 4: Default to main domain
        if not frontend_url_set:
            frontend_url = "https://screenmerch.com"
            logger.info(f"🔍 [GOOGLE OAUTH CALLBACK] No subdomain found, defaulting to main domain")
            if session_return_url:
                logger.warning(f"⚠️ [GOOGLE OAUTH CALLBACK] Session had return_url but couldn't extract subdomain: {session_return_url}")
        
        # Clean up session after we've used it
        session.pop('oauth_return_url', None)
        
        # Ensure frontend_url is a full URL with protocol
        if not frontend_url.startswith('http'):
            frontend_url = f"https://{frontend_url}" if not frontend_url.startswith('//') else f"https:{frontend_url}"
        
        # Construct redirect URL with login success and user data
        redirect_url = f"{frontend_url}?login=success&user={user_data_encoded}"
        
        logger.info(f"✅ [GOOGLE OAUTH CALLBACK] Redirecting to frontend: {redirect_url[:150]}...")
        return redirect(redirect_url)
        
    except Exception as e:
        logger.error(f"❌ Google OAuth callback error: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        
        # Always redirect, even on error - never return JSON in OAuth callback
        # Use session return_url to preserve subdomain, fallback to main domain
        frontend_url = session.get('oauth_return_url') or "https://screenmerch.com"
        if not frontend_url.startswith('http'):
            frontend_url = f"https://{frontend_url}" if not frontend_url.startswith('//') else f"https:{frontend_url}"
        error_message = str(e)[:100]  # Limit error message length
        redirect_url = f"{frontend_url}?login=error&message={quote(error_message)}"
        
        logger.info(f"⚠️ Redirecting to error page: {redirect_url}")
        return redirect(redirect_url)

# Register worker portal and secure processing routes
if register_secure_processing_routes:
    try:
        register_secure_processing_routes(app, supabase, supabase_admin)
        logger.info("✅ Registered secure processing routes")
    except Exception as e:
        logger.error(f"❌ Failed to register secure processing routes: {e}")

if register_worker_portal_routes:
    try:
        register_worker_portal_routes(app, supabase, supabase_admin, printful_integration)
        logger.info("✅ Registered worker portal routes")
    except Exception as e:
        logger.error(f"❌ Failed to register worker portal routes: {e}")

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)