from flask import Flask, request, jsonify, render_template, send_from_directory, redirect, url_for, session, make_response
import os
import logging
import time
from dotenv import load_dotenv
from flask_cors import CORS, cross_origin
import uuid
import requests
import stripe
from urllib.parse import urlencode
import json
from supabase_storage import storage
from supabase import create_client, Client
# Twilio removed - using email notifications instead
from pathlib import Path
import sys
from functools import wraps

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

# NEW: Import security manager
from security_config import security_manager, SECURITY_HEADERS, validate_file_upload

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
        print(f"Loaded .env from: {env_path}")

# Try VITE_ prefixed variables first, then fall back to non-prefixed
supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")
print("SUPABASE_URL:", "OK" if supabase_url else "MISSING")
print("SUPABASE_ANON_KEY:", "OK" if supabase_key else "MISSING")
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
    """Decorator to require admin authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated_function

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

# Configure session secret key
app.secret_key = os.getenv("FLASK_SECRET_KEY", "your-secret-key-change-in-production")

# Session / cookie settings for cross-site auth (Netlify -> Fly.io)
from datetime import timedelta

def cookie_domain_for_request():
    host = (request.host or "").lower()
    if host.endswith("screenmerch.com"):
        return "screenmerch.com"       # cookie will be sent to screenmerch.com
    if host.endswith("screenmerch.fly.dev"):
        return "screenmerch.fly.dev"   # direct hits (dev/tests)
    return None                        # fallback: host-only cookie

app.config.update(
    SESSION_COOKIE_NAME="sm_session",
    SESSION_COOKIE_DOMAIN=None,  # we'll override via response if needed
    SESSION_COOKIE_SAMESITE="Lax",  # same-site via proxy
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    PERMANENT_SESSION_LIFETIME=timedelta(days=7)
)

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
CORS(app, resources={r"/api/*": {"origins": [
    "https://screenmerch.com", 
    "https://www.screenmerch.com", 
    "https://eloquent-crumble-37c09e.netlify.app",  # Netlify preview URL
    "https://68e94d7278d7ced80877724f--eloquent-crumble-37c09e.netlify.app",  # Previous preview URL
    "https://68e9564fa66cd5f4794e5748--eloquent-crumble-37c09e.netlify.app",  # Current preview URL
    "https://*.netlify.app",  # All Netlify apps
    "http://localhost:3000", 
    "http://localhost:5173",
    "chrome-extension://*"
]}}, supports_credentials=True)

# Global preflight handler for all /api/* routes
@app.route('/api/<path:any_path>', methods=['OPTIONS'])
def api_preflight(any_path):
    response = jsonify(success=True)
    origin = request.headers.get('Origin')
    allowed_origins = [
        "https://screenmerch.com", 
        "https://www.screenmerch.com", 
        "https://eloquent-crumble-37c09e.netlify.app",  # Netlify preview URL
        "https://68e94d7278d7ced80877724f--eloquent-crumble-37c09e.netlify.app",  # Previous preview URL
    "https://68e9564fa66cd5f4794e5748--eloquent-crumble-37c09e.netlify.app",  # Current preview URL
        "https://*.netlify.app",  # All Netlify apps
        "http://localhost:3000", 
        "http://localhost:5173",
        "chrome-extension://*"
    ]
    
    # Check if origin matches any allowed pattern
    origin_allowed = False
    for allowed_origin in allowed_origins:
        if allowed_origin == origin or (allowed_origin.startswith("https://*") and origin and origin.startswith(allowed_origin.replace("*", ""))):
            origin_allowed = True
            break
    
    if origin_allowed:
        response.headers.add('Access-Control-Allow-Origin', origin)
    else:
        response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.com')
    
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Add CORS headers to all API responses
@app.after_request
def add_cors_headers(response):
    """Add CORS headers to all API responses"""
    if request.path.startswith('/api/'):
        origin = request.headers.get('Origin')
        allowed_origins = [
            "https://screenmerch.com", 
            "https://www.screenmerch.com", 
            "https://eloquent-crumble-37c09e.netlify.app",  # Netlify preview URL
            "https://68e94d7278d7ced80877724f--eloquent-crumble-37c09e.netlify.app",  # Previous preview URL
    "https://68e9564fa66cd5f4794e5748--eloquent-crumble-37c09e.netlify.app",  # Current preview URL
            "https://*.netlify.app",  # All Netlify apps
            "http://localhost:3000", 
            "http://localhost:5173",
            "chrome-extension://*"
        ]
        
        # Check if origin matches any allowed pattern
        origin_allowed = False
        for allowed_origin in allowed_origins:
            if allowed_origin == origin or (allowed_origin.startswith("https://*") and origin and origin.startswith(allowed_origin.replace("*", ""))):
                origin_allowed = True
                break
        
        if origin_allowed:
            response.headers.add('Access-Control-Allow-Origin', origin)
        else:
            response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.com')
        
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    
    return response

# Security middleware
@app.before_request
def security_check():
    """Security checks before each request"""
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
    
    # Ensure CORS headers are properly set for all responses
    origin = request.headers.get('Origin')
    allowed_origins = ["https://screenmerch.com", "https://www.screenmerch.com", "https://68e94d7278d7ced80877724f--eloquent-crumble-37c09e.netlify.app", "https://*.netlify.app", "http://localhost:3000", "http://localhost:5173"]
    
    if origin in allowed_origins:
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
        response.headers['Access-Control-Allow-Origin'] = 'https://screenmerch.com'
    
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    
    return response

# Initialize Supabase client for database operations
supabase: Client = create_client(supabase_url, supabase_key)

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

# NEW: Printful API Key (optional for now)
PRINTFUL_API_KEY = os.getenv("PRINTFUL_API_KEY") or "dummy_key"

@app.route("/api/ping")
def ping():
    return {"message": "pong"}

@app.route("/api/product/<product_id>", methods=["GET", "OPTIONS"])
def get_product_api(product_id):
    """API endpoint to get product data for frontend"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
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
                response.headers.add('Access-Control-Allow-Origin', '*')
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
                response.headers.add('Access-Control-Allow-Origin', '*')
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
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response
            
    except Exception as e:
        logger.error(f"Error in get_product_api: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        response.headers.add('Access-Control-Allow-Origin', '*')
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
        "price": 21.69,
        "filename": "guidontee.png",
        "main_image": "guidontee.png",
        "preview_image": "guidonteepreview.png",
        "options": {"color": ["Black", "White", "Dark Grey Heather", "Navy", "Red", "Athletic Heather"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]},
        "size_pricing": {
            "XS": 0,      # No extra charge
            "S": 0,       # No extra charge  
            "M": 0,       # No extra charge
            "L": 0,       # No extra charge
            "XL": 0,      # No extra charge
            "XXL": 2,     # +$2 (2XL)
            "XXXL": 4,    # +$4 (3XL)
            "XXXXL": 6,   # +$6 (4XL)
            "XXXXXL": 8   # +$8 (5XL)
        }
    },
    {
        "name": "Mens Fitted T-Shirt",
        "price": 26.58,
        "filename": "mensfittedtshirt.png",
        "main_image": "mensfittedtshirt.png",
        "preview_image": "mensfittedtshirtpreview.png",
        "options": {"color": ["Black", "White", "Heather Grey", "Royal Blue", "Midnight Navy", "Desert Pink"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"]},
        "size_pricing": {
            "XS": 0,      # No extra charge
            "S": 0,       # No extra charge  
            "M": 0,       # No extra charge
            "L": 0,       # No extra charge
            "XL": 0,      # No extra charge
            "XXL": 1.00,  # $27.58
            "XXXL": 2.00, # $28.58
            "XXXXL": 4.00 # $30.58
        }
    },
    {
        "name": "Unisex Oversized T-Shirt",
        "price": 26.49,
        "filename": "unisexoversizedtshirt.png",
        "main_image": "unisexoversizedtshirt.png",
        "preview_image": "unisexoversizedtshirtpreview.png",
        "options": {"color": ["Washed Black", "Washed Maroon", "Washed Charcoal", "Khaki", "Light Washed Denim", "Vintage White"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]},
        "size_pricing": {
            "XS": 0,      # No extra charge
            "S": 0,       # No extra charge  
            "M": 0,       # No extra charge
            "L": 0,       # No extra charge
            "XL": 0,      # No extra charge
            "XXL": 2.00,  # $28.49
            "XXXL": 4.00  # $30.49
        }
    },
    {
        "name": "Men's Tank Top",
        "price": 24.23,
        "filename": "random.png",
        "main_image": "random.png",
        "preview_image": "randompreview.png",
        "options": {"color": ["Black", "White", "Navy", "True Royal", "Athletic Heather", "Red", "Oatmeal Triblend"], "size": ["XS", "S", "M", "L", "XL", "XXL"]},
        "size_pricing": {
            "XS": 0,      # No extra charge
            "S": 0,       # No extra charge  
            "M": 0,       # No extra charge
            "L": 0,       # No extra charge
            "XL": 0,      # No extra charge
            "XXL": 2      # +$2 (2XL)
        }
    },
    {
        "name": "Men's Fitted Long Sleeve",
        "price": 29.33,
        "filename": "mensfittedlongsleeve.png",
        "main_image": "mensfittedlongsleeve.png",
        "preview_image": "mensfittedlongsleevepreview.png",
        "options": {"color": ["Black", "Heavy Metal", "White"], "size": ["S", "M", "L", "XL", "XXL"]},
        "size_pricing": {
            "S": 0,       # No extra charge  
            "M": 0,       # No extra charge
            "L": 0,       # No extra charge
            "XL": 0,      # No extra charge
            "XXL": 2.00   # $31.33
        }
    },
    {
        "name": "Unisex Hoodie",
        "price": 36.95,
        "filename": "tested.png",
        "main_image": "tested.png",
        "preview_image": "testedpreview.png",
        "options": {"color": ["Black", "Navy Blazer", "Carbon Grey", "White", "Maroon", "Charcoal Heather", "Vintage Black", "Forest Green", "Military Green", "Team Red", "Dusty Rose", "Sky Blue", "Purple", "Team Royal"], "size": ["S", "M", "L", "XL", "XXL", "XXXL"]},
        "size_pricing": {
            "S": 0,       # Base price $36.95
            "M": 0,       # Base price $36.95
            "L": 0,       # Base price $36.95
            "XL": 0,      # Base price $36.95
            "XXL": 2,     # +$2 = $38.95
            "XXXL": 4     # +$4 = $40.95
        }
    },
    {
        "name": "Cropped Hoodie",
        "price": 43.15,
        "filename": "croppedhoodie.png",
        "main_image": "croppedhoodie.png",
        "preview_image": "croppedhoodiepreview.png",
        "options": {"color": ["Black", "Military Green", "Storm", "Peach"], "size": ["S", "M", "L", "XL", "XXL"]},
        "size_pricing": {
            "S": 0,       # Base price $43.15
            "M": 0,       # Base price $43.15
            "L": 0,       # Base price $43.15
            "XL": 0,      # Base price $43.15
            "XXL": 2      # +$2 = $45.15
        }
    },
    {
        "name": "Unisex Champion Hoodie",
        "price": 45.00,
        "filename": "hoodiechampion.png",
        "main_image": "hoodiechampion.png",
        "preview_image": "hoodiechampionpreview.jpg",
        "options": {"color": ["Black", "Light Steel"], "size": ["S", "M", "L", "XL", "XXL", "XXXL"]},
        "size_pricing": {
            "S": 0,       # Base price $45
            "M": 0,       # Base price $45
            "L": 0,       # Base price $45
            "XL": 0,      # Base price $45
            "XXL": 2,     # +$2 = $47
            "XXXL": 4     # +$4 = $49
        }
    },
    {
        "name": "Women's Ribbed Neck",
        "price": 25.60,
        "filename": "womensribbedneck.png",
        "main_image": "womensribbedneck.png",
        "preview_image": "womensribbedneckpreview.png",
        "options": {"color": ["Black", "French Navy", "Heather Grey", "White", "Dark Heather Grey", "Burgundy", "India Ink Grey", "Anthracite", "Red", "Stargazer", "Khaki", "Desert Dust", "Fraiche Peche", "Cotton Pink", "Lavender"], "size": ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]},
         "size_pricing": {
            "S": 0,       # Base price $25.60
            "M": 0,       # Base price $25.60
            "L": 0,       # Base price $25.60
            "XL": 0,      # Base price $25.60
            "XXL": 2,     # +$2 = $27.60
            "XXXL": 4,     # +$4 = $29.60
            "XXXXL": 6,   # +$6 = $31.60
            "XXXXXL": 8   # +$8 = $33.60
        }
    },
    {
        "name": "Women's Shirt",
        "price": 23.69,
        "filename": "womensshirt.png",
        "main_image": "womensshirt.png",
        "preview_image": "womensshirtpreview.png",
        "options": {"color": ["Black", "White", "Dark Grey Heather", "Pink", "Navy", "Heather Mauve", "Heather Red", "Berry", "Leaf", "Heather Blue Lagoon", "Athletic Heather", "Heather Stone"], "size": ["S", "M", "L", "XL", "XXL", "XXXL"]},
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 2,
            "XXXL": 4
        } 
    },
    {
        "name": "Unisex Heavyweight T-Shirt",
        "price": 25.29,
        "filename": "womenshdshirt.png",
        "main_image": "womenshdshirt.png",
        "preview_image": "womenshdshirtpreview.png",
        "options": {"color": ["Berry", "Blue Jean", "Grey", "Violet", "White", "Black", "True Navy", "Brick", "Moss", "Lagoon Blue", "Blue Spruce", "Flo Blue", "Butter", "Pepper", "Bay", "Ivory", "Red", "Sage", "Midnight", "Grape"], "size": ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"]},
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 2,
            "XXXL": 4,
            "XXXXL": 6
        }
    },
    {
        "name": "Kids Shirt",
        "price": 23.49,
        "filename": "kidshirt.png",
        "main_image": "kidshirt.png",
        "preview_image": "kidshirtpreview.png",
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
        "price": 29.33,
        "filename": "kidhoodie.png",
        "main_image": "kidhoodie.png",
        "preview_image": "kidhoodiepreview.png",
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
        "price": 26.49,
        "filename": "kidlongsleeve.png",
        "main_image": "kidlongsleeve.png",
        "preview_image": "kidlongsleevepreview.png",
        "options": {"color": ["Black", "Navy", "Red", "Athletic Heather", "White"], "size": ["S", "M", "L"]},
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0
        }
    },
    {
        "name": "Kids Sweatshirt",
        "price": 27.29,
        "filename": "kidssweatshirt.png",
        "main_image": "kidssweatshirt.png",
        "preview_image": "kidssweatshirtpreview.png",
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
        "name": "Youth All Over Print Swimsuit",
        "price": 33.95,
        "filename": "youthalloverprintswimsuit.png",
        "main_image": "youthalloverprintswimsuit.png",
        "preview_image": "youthalloverprintswimsuitpreview.png",
        "options": {"color": ["White", "Navy", "Black", "Pink", "Blue"], "size": ["8", "10", "12", "14", "16", "18", "20"]},
        "size_pricing": {
            "8": 0,       # No extra charge
            "10": 0,      # No extra charge  
            "12": 0,      # No extra charge
            "14": 0,      # No extra charge
            "16": 0,      # No extra charge
            "18": 0,      # No extra charge
            "20": 0       # No extra charge
        }
    },
    {
        "name": "Girls Leggings",
        "price": 28.31,
        "filename": "girlsleggings.png",
        "main_image": "girlsleggings.png",
        "preview_image": "girlsleggingspreview.png",
        "options": {"color": ["White", "Black", "Navy", "Pink", "Purple"], "size": ["2T", "3T", "4T", "5T", "6x", "7"]},
        "size_pricing": {
            "2T": 0,      # No extra charge
            "3T": 0,      # No extra charge  
            "4T": 0,      # No extra charge
            "5T": 0,      # No extra charge
            "6x": 0,      # No extra charge
            "7": 0        # No extra charge
        }
    },
    {
        "name": "Toddler Short Sleeve T-Shirt",
        "price": 22.75,
        "filename": "toddlershortsleevet.png",
        "main_image": "toddlershortsleevet.png",
        "preview_image": "toddlershortsleevetpreview.png",
        "options": {"color": ["Black", "Heather Columbia Blue", "Pink", "White"], "size": ["2T", "3T", "4T", "5T"]},
        "size_pricing": {
            "2T": 0,      # No extra charge
            "3T": 0,      # No extra charge
            "4T": 0,      # No extra charge
            "5T": 0       # No extra charge
        }
    },
    {
        "name": "Toddler Jersey Shirt",
        "price": 20.29,
        "filename": "toddlerjerseytshirt.png",
        "main_image": "toddlerjerseytshirt.png",
        "preview_image": "toddlerjerseytshirtpreview.png",
        "options": {"color": ["Black", "Navy", "Hot Pink", "Heather", "Light Blue", "White"], "size": ["2", "3", "4", "5/6"]},
        "size_pricing": {
            "2": 0,       # No extra charge
            "3": 0,       # No extra charge
            "4": 0,       # No extra charge
            "5/6": 0      # No extra charge
        }
    },
    {
        "name": "Laptop Sleeve",
        "price": 31.16,
        "filename": "laptopsleeve.png",
        "main_image": "laptopsleeve.png",
        "preview_image": "laptopsleevepreview.png",
        "options": {"color": ["White"], "size": ["13.5\"x10.5\"", "14.75\"x11.25\""]},
        "size_pricing": {
            "13.5\"x10.5\"": 0,
            "14.75\"x11.25\"": 2.04
        }
    },
    {
        "name": "All-Over Print Drawstring Bag",
        "price": 25.25,
        "filename": "drawstringbag.png",
        "main_image": "drawstringbag.png",
        "preview_image": "drawstringbagpreview.png",
        "options": {"color": ["White", "Black", "Blue"], "size": ["15\"x17\""]},
        "size_pricing": {
            "15\"x17\"": 0
        }
    },
    {
        "name": "All Over Print Tote Pocket",
        "price": 33.41,
        "filename": "largecanvasbag.png",
        "main_image": "largecanvasbag.png",
        "preview_image": "largecanvasbagpreview.png",
        "options": {"color": ["Black", "Red", "Yellow"], "size": ["16\"x20\""]},
        "size_pricing": {
            "16\"x20\"": 0
        }
    },
    {
        "name": "Greeting Card",
        "price": 5.00,
        "filename": "greetingcard.png",
        "main_image": "greetingcard.png",
        "preview_image": "greetingcardpreview.png",
        "options": {"color": ["White"], "size": ["4\"x6\""]},
        "size_pricing": {
            "4\"x6\"": 0
        }
    },
    {
        "name": "Hardcover Bound Notebook",
        "price": 23.21,
        "filename": "hardcovernotebook.png",
        "main_image": "hardcovernotebook.png",
        "preview_image": "hardcovernotebookpreview.png",
        "options": {"color": ["Black", "Navy", "Red", "Blue", "Turquoise", "Orange", "Silver", "Lime", "White"], "size": ["5.5\"x8.5\""]},
        "size_pricing": {
            "5.5\"x8.5\"": 0
        }
    },
    {
        "name": "Coasters",
        "price": 33.99,
        "filename": "coaster.png",
        "main_image": "coaster.png",
        "preview_image": "coasterpreview.jpg",
        "options": {"color": ["Wood", "Cork", "Black"], "size": ["4\"x4\""]},
        "size_pricing": {
            "4\"x4\"": 0
        }
    },
    {
        "name": "Apron",
        "price": 19.99,
        "filename": "apron.png",
        "main_image": "apron.png",
        "preview_image": "apronpreview.png",
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
        "price": 4.29,
        "filename": "stickers.png",
        "main_image": "stickers.png",
        "preview_image": "stickerspreview.png",
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
        "price": 31.49,
        "filename": "dogbowl.png",
        "main_image": "dogbowl.png",
        "preview_image": "dogbowlpreview.png",
        "options": {"color": ["White"], "size": ["18oz", "32oz"]},
        "size_pricing": {
            "18oz": 0,
            "32oz": 3
        }
    },
    {
        "name": "Pet Bandana Collar",
        "price": 23.67,
        "filename": "scarfcollar.png",
        "main_image": "scarfcollar.png",
        "preview_image": "scarfcollarpreview.png",
        "options": {"color": ["Black", "Red", "Blue", "Green"], "size": ["Small 10″–16.75″", "Medium 12″–20.25″", "Large 14.25″–23″", "XL 15.5″–23.5″"]},
        "size_pricing": {
            "Small 10″–16.75″": 0,
            "Medium 12″–20.25″": 0,
            "Large 14.25″–23″": 1.56,
            "XL 15.5″–23.5″": 1.56
        }
    },
    {
        "name": "Bandana",
        "price": 12.99,
        "filename": "bandana.png",
        "main_image": "bandana.png",
        "preview_image": "bandanapreview.png",
        "options": {"color": ["Black", "Red", "Blue", "Green", "Pink"], "size": ["Small", "Medium", "Large"]},
        "size_pricing": {
            "Small": 0,
            "Medium": 0,
            "Large": 0
        }
    },
    {
        "name": "All Over Print Leash",
        "price": 24.90,
        "filename": "leash.png",
        "main_image": "leash.png",
        "preview_image": "leashpreview.png",
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
        "preview_image": "collarpreview.png",
        "options": {"color": ["Black", "Brown", "Blue", "Red", "Green"], "size": ["S 11.8\"-17.8\"", "M 13.5\"-20.5\"", "L 14.8\"-23.8\""]},
        "size_pricing": {
            "S 11.8\"-17.8\"": 0,
            "M 13.5\"-20.5\"": 0,
            "L 14.8\"-23.8\"": 0
        }
    },
    {
        "name": "Die-Cut Magnets",
        "price": 5.32,
        "filename": "magnet.png",
        "main_image": "magnet.png",
        "preview_image": "magnetpreview.png",
        "options": {"color": ["White"], "size": ["3\"x3\"", "4\"x4\"", "6\"x6\""]},
        "size_pricing": {
            "3\"x3\"": 0,
            "4\"x4\"": 0.51,
            "6\"x6\"": 2.55
        }
    },
    {
        "name": "Men's Long Sleeve Shirt",
        "price": 24.79,
        "filename": "menslongsleeve.png",
        "main_image": "menslongsleeve.png",
        "preview_image": "menslongsleevepreview.jpg",
        "options": {"color": ["Black", "White", "Navy", "Sport Grey", "Red", "Military Green", "Ash"], "size": ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"]},
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 2,
            "XXXL": 4,
            "XXXXL": 6
        }
    },
    {
        "name": "Women's Fitted Racerback Tank",
        "price": 20.95,
        "filename": "womenstank.png",
        "main_image": "womenstank.png",
        "preview_image": "womenstankpreview.jpg",
        "options": {"color": ["Black", "Hot Pink", "Light Orange", "Tahiti Blue", "Heather Gray", "Cancun", "White"], "size": ["XS", "S", "M", "L", "XL", "XXL"]},
        "size_pricing": {
            "XS": 0,
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 2
        }
    },
    {
        "name": "Unisex Pullover Hoodie",
        "price": 41.06,
        "filename": "unisexpulloverhoodie.png",
        "main_image": "unisexpulloverhoodie.png",
        "preview_image": "unisexpulloverhoodiepreview.png",
        "options": {"color": ["Black", "White", "Heather Forest", "Heather Navy"], "size": ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]},
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 2,
            "XXXL": 4,
            "XXXXL": 5,
            "XXXXXL": 8
        }
    },
    {
        "name": "Women's Micro-Rib Tank Top",
        "price": 25.81,
        "filename": "womenstee.png",
        "main_image": "womenstee.png",
        "preview_image": "womensteepreview.png",
        "options": {"color": ["Solid Black Blend", "Solid Navy Blend", "Athletic Heather", "Solid Baby Blue Blend", "Solid Pink Blend", "Solid White Blend"], "size": ["XS", "S", "M", "L", "XL", "XXL"]},
        "size_pricing": {
            "XS": 0,
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 2
        }
    },
    {
        "name": "Distressed Dad Hat",
        "price": 23.99,
        "filename": "distresseddadhat.jpg",
        "main_image": "distresseddadhat.jpg",
        "preview_image": "distresseddadhatpreview.jpg",
        "options": {"color": ["Black", "Navy", "Charcoal Gray", "Khaki"], "size": ["One Size"]},
        "size_pricing": {
            "One Size": 0
        }
    },
    {
        "name": "Snapback Hat",
        "price": 26.19,
        "filename": "snapbackhat.png",
        "main_image": "snapbackhat.png",
        "preview_image": "snapbackhatpreview.png",
        "options": {"color": ["Black", "Purple / Black / Black", "Red / Black / Black", "Gray / Black / Black", "Gold / Black / Black", "Navy blue", "Red", "Black / Charcoal gray / Charcoal gray", "Charcoal gray", "Kelly green", "Black / White / White", "White", "Aqua blue / Black / Black", "Orange / Black / Black", "Burgundy maroon", "Black / Red / Red", "Black / Gray / Gray"], "size": ["One Size"]},
        "size_pricing": {
            "One Size": 0
        }
    },
    {
        "name": "Five Panel Trucker Hat",
        "price": 24.79,
        "filename": "fivepaneltruckerhat.png",
        "main_image": "fivepaneltruckerhat.png",
        "preview_image": "fivepaneltruckerhatpreview.jpg",
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
        "name": "5 Panel Baseball Cap",
        "price": 21.72,
        "filename": "youthbaseballcap.png",
        "main_image": "youthbaseballcap.png",
        "preview_image": "youthbaseballcappreview.png",
        "options": {"color": ["Black", "Black/Natural", "Red/Natural", "Navy/Natural", "Dark Green/Natural", "Royal/Natural", "White"], "size": ["One Size"]},
        "size_pricing": {
            "One Size": 0
        }
    },
    {
        "name": "White Glossy Mug",
        "price": 15.95,
        "filename": "mug1.jpg",
        "main_image": "mug1.jpg",
        "preview_image": "mug1preview.jpg",
        "options": {"color": ["White"], "size": ["11 oz", "15 oz", "20 oz"]},
        "size_pricing": {
            "11 oz": 0,
            "15 oz": 2.00,
            "20 oz": 3.55
        }
    },
    {
        "name": "Travel Mug",
        "price": 32.10,
        "filename": "travelmug.png",
        "main_image": "travelmug.png",
        "preview_image": "travelmugpreview.png",
        "options": {"color": ["White", "Black", "Navy", "Gray"], "size": ["25 oz", "40 oz"]},
        "size_pricing": {
            "25 oz": 0,
            "40 oz": 1.10
        }
    },
    {
        "name": "Enamel Mug",
        "price": 22.42,
        "filename": "mug1.jpg",
        "main_image": "mug1.jpg",
        "preview_image": "mug1preview.jpg",
        "options": {"color": ["White", "Black", "Navy", "Red"], "size": ["12 oz"]},
        "size_pricing": {
            "12 oz": 0
        }
    },
    {
        "name": "Colored Mug",
        "price": 17.95,
        "filename": "coloredmug.png",
        "main_image": "coloredmug.png",
        "preview_image": "coloredmugpreview.png",
        "options": {"color": ["Black", "Red", "Blue", "Dark Green"], "size": ["11 oz", "15 oz"]},
        "size_pricing": {
            "11 oz": 0,
            "15 oz": 1.00
        }
    },
    {
        "name": "All-Over Print Crossbody Bag",
        "price": 30.35,
        "filename": "crossbodybag.png",
        "main_image": "crossbodybag.png",
        "preview_image": "crossbodybagpreview.png",
        "options": {"color": ["White"], "size": ["5.7\"x7.7\"x2\""]},
        "size_pricing": {
            "5.7\"x7.7\"x2\"": 0
        }
    },
    {
        "name": "Pajama Shorts",
        "price": 32.56,
        "filename": "pajamashorts.png",
        "main_image": "pajamashorts.png",
        "preview_image": "pajamashortspreview.png",
        "options": {"color": ["Black", "White", "Gray", "Navy", "Pink"], "size": ["XS", "S", "M", "L", "XL", "XXL"]},
        "size_pricing": {
            "XS": 0,
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 2
        },
        "category": "womens"
    }
]

def filter_products_by_category(category):
    """Filter products based on category selection"""
    print(f"🔍 FILTER DEBUG: Received category: '{category}'")
    if not category or category == "all":
        print(f"🔍 FILTER DEBUG: No category or 'all', returning all products")
        return PRODUCTS  # Show all products when category is 'all'
    
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
            "Women's Fitted Racerback Tank",
            "Women's Micro-Rib Tank Top", 
            "Women's Ribbed Neck",
            "Women's Shirt",
            "Unisex Heavyweight T-Shirt",
            "Unisex Pullover Hoodie",
            "Pajama Shorts"
        ],
        'kids': [
            "Youth Heavy Blend Hoodie",
            "Kids Shirt",
            "Kids Long Sleeve",
            "Toddler Short Sleeve T-Shirt",
            "Toddler Jersey Shirt",
            "Kids Sweatshirt",
            "Youth All Over Print Swimsuit",
            "Girls Leggings"
        ],
        'bags': [
            "Laptop Sleeve",
            "All-Over Print Drawstring Bag", 
            "All Over Print Tote Pocket",
            "All-Over Print Crossbody Bag"
        ],
        'hats': [
            "Distressed Dad Hat",
            "Snapback Hat",
            "Five Panel Trucker Hat",
            "5 Panel Baseball Cap"
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
        'stickers': [
            "Kiss-Cut Stickers",
            "Die-Cut Magnets"
        ],
        'misc': [
            "Greeting Card",
            "Hardcover Bound Notebook", 
            "Coasters",
            "Apron",
            "Bandana"
        ],
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

@app.route("/")
def index():
    return "Flask Backend is Running!"

@app.route("/static/images/<filename>")
def serve_static_image(filename):
    """Serve static images with proper headers"""
    static_dir = os.path.join(app.root_path, 'static', 'images')
    response = send_from_directory(static_dir, filename)
    
    # Add CORS headers for images
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    
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

@app.route("/api/product/<product_id>", methods=["GET"])
def get_product_data(product_id):
    """API endpoint to fetch product data for frontend"""
    try:
        logger.info(f"🔍 API: Fetching product data for ID: {product_id}")
        
        # Try to get from Supabase first
        try:
            result = supabase.table('products').select('*').eq('product_id', product_id).execute()
            if result.data:
                product_data = result.data[0]
                logger.info(f"✅ Found product in database: {product_data.get('name', 'No name')}")
                
                # Parse screenshots if they exist
                screenshots = []
                if product_data.get('screenshots_urls'):
                    try:
                        screenshots = json.loads(product_data.get('screenshots_urls'))
                    except Exception as json_error:
                        logger.error(f"❌ Error parsing screenshots JSON: {str(json_error)}")
                        screenshots = []
                
                return jsonify({
                    "success": True,
                    "product": {
                        "id": product_id,
                        "name": product_data.get('name', 'Unknown Product'),
                        "price": product_data.get('price', 0),
                        "thumbnail_url": product_data.get('thumbnail_url', ''),
                        "screenshots": screenshots,
                        "video_title": product_data.get('video_title', 'Unknown Video'),
                        "creator_name": product_data.get('creator_name', 'Unknown Creator'),
                        "video_url": product_data.get('video_url', ''),
                        "description": product_data.get('description', ''),
                        "category": product_data.get('category', 'custom')
                    }
                })
        except Exception as db_error:
            logger.error(f"❌ Database error fetching product {product_id}: {str(db_error)}")
        
        # Fallback to in-memory storage
        if product_id in product_data_store:
            logger.info(f"🔄 Found product in memory storage")
            product_data = product_data_store[product_id]
            return jsonify({
                "success": True,
                "product": {
                    "id": product_id,
                    "name": "Custom Product",
                    "price": 24.99,
                    "thumbnail_url": product_data.get('thumbnail', ''),
                    "screenshots": product_data.get('screenshots', []),
                    "video_title": product_data.get('video_title', 'Unknown Video'),
                    "creator_name": product_data.get('creator_name', 'Unknown Creator'),
                    "video_url": product_data.get('video_url', ''),
                    "description": "Custom merchandise from video",
                    "category": "custom"
                }
            })
        
        # Product not found
        logger.warning(f"⚠️ Product {product_id} not found")
        return jsonify({
            "success": False,
            "error": "Product not found"
        }), 404
        
    except Exception as e:
        logger.error(f"❌ Error in get_product_data for {product_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Internal server error"
        }), 500

@app.route("/api/create-product", methods=["POST", "OPTIONS"])
def create_product():
    print("🔍 CREATE-PRODUCT ENDPOINT CALLED")
    print(f"🔍 Request method: {request.method}")
    print(f"🔍 Request headers: {dict(request.headers)}")
    print(f"🔍 Request origin: {request.headers.get('Origin')}")
    
    if request.method == "OPTIONS":
        print("🔍 Handling OPTIONS preflight request")
        return jsonify({"success": True})

    try:
        data = request.get_json()
        if not data:
            return jsonify(success=False, error="No data received"), 400

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
        
        # Build product URL with authentication parameters and category - redirect to frontend
        product_url = f"https://screenmerch.com/product/{product_id}?category={category}"
        if is_authenticated and user_email:
            product_url += f"&authenticated=true&email={user_email}"
        
        return jsonify({
            "success": True,
            "product_id": product_id,
            "product_url": product_url
        })
    except Exception as e:
        logger.error(f"❌ Error in create-product: {str(e)}")
        logger.error(f"❌ Error type: {type(e).__name__}")
        logger.error(f"❌ Full error details: {repr(e)}")
        return jsonify(success=False, error="Internal server error"), 500

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
                show_category_selection=show_category_selection,
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

def record_sale(item, user_id=None, friend_id=None, channel_id=None):
    from datetime import datetime
    
    # Get the correct price - try item price first, then look up in PRODUCTS
    item_price = item.get('price')
    if not item_price or item_price <= 0:
        # Look up price in PRODUCTS array
        product_info = next((p for p in PRODUCTS if p["name"] == item.get("product")), None)
        if not product_info:
            # Try case-insensitive match
            product_info = next((p for p in PRODUCTS if p["name"].lower() == item.get("product", "").lower()), None)
        
        item_price = product_info["price"] if product_info else 0
    
    sale_data = {
        "user_id": user_id,
        "product_id": item.get('product_id', ''),
        "product_name": item.get('product', ''),
        "video_id": item.get('video_id', ''),
        "video_title": item.get('video_title', ''),
        "video_url": item.get('video_url', ''),
        "creator_name": item.get('creator_name', ''),
        "screenshot_timestamp": item.get('screenshot_timestamp', ''),
        "image_url": item.get('img', ''),
        "amount": item_price,
        "friend_id": friend_id,
        "channel_id": channel_id
    }
    try:
        supabase.table('sales').insert(sale_data).execute()
        logger.info(f"Recorded sale: {sale_data}")
    except Exception as e:
        logger.error(f"Error recording sale: {str(e)}")

@app.route("/send-order", methods=["POST"])
def send_order():
    try:
        data = request.get_json()
        cart = data.get("cart", [])
        if not cart:
            return jsonify({"success": False, "error": "Cart is empty"}), 400

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
        # Generate order ID and order number
        order_id = str(uuid.uuid4())
        order_number = order_id[-8:].upper()
        
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
        
        # Store order in order_store for admin dashboard
        order_store[order_id] = {
            "cart": enriched_cart,
            "timestamp": data.get("timestamp"),
            "order_id": order_id,
            "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
            "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
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
            record_sale(item)
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
                session = stripe.checkout.Session.create(
                    payment_method_types=["card"],
                    mode="payment",
                    line_items=line_items,
                    success_url=f"https://screenmerch.fly.dev/success?order_id={order_id}",
                    cancel_url=f"https://screenmerch.com/checkout",
                    phone_number_collection={"enabled": True},
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
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Vary', 'Origin')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    except Exception as e:
        logger.error(f"Error in send_order: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route("/api/place-order", methods=["POST", "OPTIONS"])
def place_order():
    """Simple place-order endpoint for frontend.
    - Accepts cart items, totals, shipping info, and selected screenshot/thumbnail
    - Persists to Supabase `orders` when available; falls back to in-memory `order_store`
    - Sends email including a link to the print-quality page
    - Returns { success: true, order_id }
    """
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        origin = request.headers.get('Origin', '*')
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Vary', 'Origin')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        data = request.get_json() or {}
        cart = data.get("cart", [])
        shipping_cost = data.get("shipping_cost", data.get("shipping", {}).get("cost", 0)) or 0
        total_amount = data.get("total", 0) or sum(item.get('price', 0) for item in cart) + (shipping_cost or 0)

        if not cart:
            return jsonify({"success": False, "error": "Cart is empty"}), 400

        # Generate order identifiers
        order_id = str(uuid.uuid4())
        order_number = order_id[-8:].upper()

        # Normalize items to expected structure
        normalized_cart = []
        for item in cart:
            # Support both existing structure and simplified frontend items
            product_name = item.get('product') or item.get('name') or 'N/A'
            variants = item.get('variants') or {
                'color': item.get('color'),
                'size': item.get('size')
            }
            normalized_item = {
                **item,
                'product': product_name,
                'variants': variants,
                'img': item.get('img') or item.get('image')
            }
            normalized_cart.append(normalized_item)

        # Enrich cart items with video metadata when provided
        enriched_cart = []
        for item in normalized_cart:
            enriched_item = item.copy()
            enriched_item.update({
                "videoName": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                "creatorName": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
                "timestamp": data.get("screenshot_timestamp", data.get("timestamp", "Not provided")),
                "selected_screenshot": data.get("selected_screenshot") or data.get("thumbnail")
            })
            enriched_cart.append(enriched_item)

        # Prepare DB payload restricted to known columns
        order_data = {
            "order_id": order_id,
            "cart": enriched_cart,
            "sms_consent": data.get("sms_consent", False),
            "customer_email": data.get("user_email", data.get("customer_email", "")),
            "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
            "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
            "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
            "total_amount": total_amount,
            "shipping_cost": shipping_cost,
            "status": "pending",
        }

        # Try database first; fallback to in-memory store
        stored_in_db = False
        try:
            supabase.table('orders').insert(order_data).execute()
            stored_in_db = True
            logger.info(f"✅ Order {order_id} stored in database")
        except Exception as db_error:
            logger.error(f"❌ Failed to store order in database: {str(db_error)}")

        # Always keep an in-memory backup for admin dashboard/tools
        order_store[order_id] = {
            "cart": enriched_cart,
            "timestamp": data.get("timestamp"),
            "order_id": order_id,
            "video_title": order_data["video_title"],
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

        for item in enriched_cart:
            product_name = item.get('product', 'N/A')
            color = (item.get('variants') or {}).get('color', 'N/A')
            size = (item.get('variants') or {}).get('size', 'N/A')
            note = item.get('note', 'None')
            image_url = item.get('img', '')
            html_body += f"""
                <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                    <h2>{product_name}</h2>
                    <p><strong>Color:</strong> {color}</p>
                    <p><strong>Size:</strong> {size}</p>
                    <p><strong>Note:</strong> {note}</p>
                    {f"<img src='{image_url}' alt='Product Image' style='max-width: 300px; border-radius: 6px;'>" if image_url else ""}
                </div>
            """

        html_body += "<hr>"
        html_body += "<h2>📹 Video Information</h2>"
        html_body += f"<p><strong>Video Title:</strong> {order_data['video_title']}</p>"
        html_body += f"<p><strong>Creator:</strong> {order_data['creator_name']}</p>"
        html_body += f"<p><strong>Video URL:</strong> {order_data['video_url']}</p>"
        html_body += f"<p><strong>Screenshot Timestamp:</strong> {order_store[order_id]['screenshot_timestamp']} seconds</p>"
        html_body += "<br>"
        html_body += "<p><strong>📋 View Full Order Details:</strong></p>"
        html_body += f"<p><a href='https://screenmerch.fly.dev/admin/order/{order_id}' style='background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>View Order Details</a></p>"
        html_body += "<br>"
        html_body += "<p><strong>📊 All Orders Dashboard:</strong></p>"
        html_body += f"<p><a href='https://screenmerch.fly.dev/admin/orders' style='background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>View All Orders</a></p>"
        html_body += "<br>"
        html_body += "<hr>"
        html_body += "<h2>🖨️ Print Quality Images</h2>"
        html_body += "<p>Use the print quality generator to get 300 DPI images:</p>"
        html_body += f"<p><strong>Web Interface:</strong> <a href='https://screenmerch.fly.dev/print-quality?order_id={order_id}'>https://screenmerch.fly.dev/print-quality?order_id={order_id}</a></p>"
        html_body += "<br>"
        html_body += "<p><small>This is an automated notification from ScreenMerch</small></p>"

        # Send email with Resend if configured; fall back to logging
        if RESEND_API_KEY and MAIL_TO:
            email_data = {
                "from": RESEND_FROM,
                "to": [MAIL_TO],
                "subject": f"🛍️ New ScreenMerch Order #{order_number}",
                "html": html_body,
            }
            try:
                resp = requests.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=email_data,
                )
                if resp.status_code != 200:
                    logger.error(f"Resend API error: {resp.text}")
            except Exception as e:
                logger.error(f"Error sending email via Resend: {str(e)}")
        else:
            logger.warning("Email service not configured; order email not sent")

        response = jsonify({"success": True, "order_id": order_id})
        origin = request.headers.get('Origin', '*')
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Vary', 'Origin')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    except Exception as e:
        logger.error(f"Error in place_order: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        origin = request.headers.get('Origin', '*')
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Vary', 'Origin')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
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
            
            logger.info(f"📧 Preparing email for {len(cart)} items")
            
            # Format and send the order email - simplified version
            html_body = f"<h1>New Paid ScreenMerch Order #{order_number}</h1>"
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
            html_body += f"<br>"
            html_body += f"<p><strong>📋 View Full Order Details:</strong></p>"
            html_body += f"<p><a href='https://screenmerch.fly.dev/admin/order/{order_id}' style='background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>View Order Details</a></p>"
            html_body += f"<br>"
            html_body += f"<p><strong>📊 All Orders Dashboard:</strong></p>"
            html_body += f"<p><a href='https://screenmerch.fly.dev/admin/orders' style='background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>View All Orders</a></p>"
            html_body += f"<br>"
            html_body += f"<p><small>This is an automated notification from ScreenMerch</small></p>"
            
            # Record each sale
            for item in cart:
                record_sale(item)
            
            # Email is already sent from webhook, no need to send duplicate
            logger.info(f"✅ Order {order_number} processed - email already sent from webhook")
                
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
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Vary', 'Origin')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    try:
        data = request.get_json()
        cart = data.get("cart", [])
        product_id = data.get("product_id")
        sms_consent = data.get("sms_consent", False)
        shipping_cost = data.get("shipping_cost", 5.99)  # Default to $5.99 if not provided

        logger.info(f"🛒 Received checkout request - Cart: {cart}")
        logger.info(f"🛒 Product ID: {product_id}")
        logger.info(f"🛒 SMS Consent: {sms_consent}")

        if not cart:
            logger.error("❌ Cart is empty")
            return jsonify({"error": "Cart is empty"}), 400

        # Email notifications - SMS consent not required
        # sms_consent is kept for backward compatibility but not enforced

        # Generate a unique order ID and store the full cart (with images) and SMS consent
        order_id = str(uuid.uuid4())
        
        # Calculate total amount
        total_amount = sum(item.get('price', 0) for item in cart) + shipping_cost
        
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
        
        # Store order in database instead of in-memory store
        order_data = {
            "order_id": order_id,
            "cart": enriched_cart,
            "sms_consent": sms_consent,
            "customer_email": data.get("user_email", ""),
            "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
            "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
            "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
            "total_amount": total_amount,
            "shipping_cost": shipping_cost,
            "status": "pending"
        }
        
        try:
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

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="payment",
            line_items=line_items,
            success_url=f"https://screenmerch.fly.dev/success?order_id={order_id}",
            cancel_url=f"https://screenmerch.com/checkout/{product_id or ''}",
            # A2P 10DLC Compliance: Collect phone number for SMS notifications
            phone_number_collection={"enabled": True},
            metadata={
                "order_id": order_id,  # Only store the small order ID in Stripe
                "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
                "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator"))
            }
        )
        response = jsonify({"url": session.url})
        origin = request.headers.get('Origin', '*')
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Vary', 'Origin')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    except Exception as e:
        logger.error(f"Stripe API Error: {str(e)}")
        response = jsonify({"error": "Failed to create Stripe checkout session"})
        origin = request.headers.get('Origin', '*')
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Vary', 'Origin')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
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
            
            # Generate print-quality images for each product
            print_quality_images = []
            for i, item in enumerate(cart):
                try:
                    # Extract video URL and timestamp from the screenshot
                    screenshot_url = item.get('img', '')
                    if screenshot_url and 'data:image' in screenshot_url:
                        # This is a base64 screenshot, we need to get the original video info
                        # For now, we'll include both preview and note about print quality
                        print_quality_images.append({
                            'index': i,
                            'preview': screenshot_url,
                            'note': 'Print quality version available via API'
                        })
                except Exception as e:
                    logger.error(f"Error processing print quality for item {i}: {str(e)}")
                    print_quality_images.append({
                        'index': i,
                        'preview': item.get('img', ''),
                        'note': 'Preview only'
                    })
            
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
                
                # Get print quality info
                print_info = print_quality_images[i] if i < len(print_quality_images) else {'preview': item.get('img', ''), 'note': 'Preview only'}
                
                html_body += f"""
                    <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                        <h3>{category} - {product_name}</h3>
                        <p><strong>Color:</strong> {color}</p>
                        <p><strong>Size:</strong> {size}</p>
                        <p><strong>Price:</strong> ${item.get('price', 0):.2f}</p>
                        <p><strong>Note:</strong> {item.get('note', 'None')}</p>
                        <p><strong>📅 Order Time:</strong> {timestamp_str}</p>
                        <p><strong>📸 Screenshot Selected (Preview):</strong></p>
                        <img src="{print_info['preview']}" alt='Product Screenshot' style='max-width: 400px; border-radius: 6px; border: 2px solid #007bff;'>
                        <p><strong>🖨️ Print Quality:</strong> {print_info['note']}</p>
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
                        <li><strong>Print Quality:</strong> Click "Generate Print Quality Images" to create 300 DPI images for Printify</li>
                        <li><strong>Video URL:</strong> Copy the video URL from order details and paste it into the print quality tool</li>
                        <li><strong>Timestamp:</strong> Use the timestamp shown above in the print quality tool</li>
                    </ol>
                </div>
            """
            
            # Record each sale with creator and video information
            for item in cart:
                # Add creator and video information to each item
                item['video_title'] = order_data.get('video_title', 'Unknown Video')
                item['creator_name'] = order_data.get('creator_name', 'Unknown Creator')
                
                # Extract channel_id from the order data if available
                # For Cheedo V, use 'cheedo_v' as channel_id
                channel_id = order_data.get('channel_id') or item.get('channel_id') or 'cheedo_v'
                record_sale(item, channel_id=channel_id)
                
            # Email notifications only - no SMS
            logger.info("📧 Order notifications will be sent via email")
            
            # Send confirmation email to chidopro@proton.me (verified email for Resend)
            email_data = {
                "from": RESEND_FROM,
                "to": ["chidopro@proton.me"],
                "subject": f"🛍️ New ScreenMerch Order - {len(cart)} Item(s) - ${total_amount:.2f} - {customer_name}",
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
            if response.status_code != 200:
                logger.error(f"Resend API error: {response.text}")
            else:
                logger.info(f"Order email sent successfully via Resend")
                
                # Update order status in database to 'paid'
                try:
                    supabase.table('orders').update({
                        'status': 'paid',
                        'customer_phone': customer_phone,
                        'stripe_session_id': session.get('id'),
                        'payment_intent_id': session.get('payment_intent')
                    }).eq('order_id', order_id).execute()
                    logger.info(f"✅ Updated order {order_id} status to 'paid' in database")
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
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
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
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
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
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response
        else:
            logger.error(f"Screenshot capture failed: {result['error']}")
            response = jsonify(result)
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 500
            
    except Exception as e:
        logger.error(f"Error in capture_screenshot: {str(e)}")
        response = jsonify({"success": False, "error": f"Internal server error: {str(e)}"})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500

@app.route("/api/capture-multiple-screenshots", methods=["POST", "OPTIONS"])
def capture_multiple_screenshots():
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
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
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
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
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
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
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response
        else:
            logger.error(f"Print quality screenshot capture failed: {result['error']}")
            response = jsonify(result)
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 500
            
    except Exception as e:
        logger.error(f"Error in capture_print_quality: {str(e)}")
        response = jsonify({"success": False, "error": f"Internal server error: {str(e)}"})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500

@app.route("/api/process-shirt-image", methods=["POST", "OPTIONS"])
def process_shirt_image():
    """Process an image to be shirt-print ready with feathered edges"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    
    try:
        data = request.get_json()
        image_data = data.get("image_data")
        feather_radius = data.get("feather_radius", 12)
        enhance_quality = data.get("enhance_quality", True)
        
        if not image_data:
            return jsonify({"success": False, "error": "image_data is required"}), 400
        
        logger.info(f"Processing shirt image with feather_radius={feather_radius}, enhance_quality={enhance_quality}")
        
        # Process the image for shirt printing (feather only - working version)
        processed_image = screenshot_capture.create_shirt_ready_image(
            image_data, 
            feather_radius=feather_radius, 
            enhance_quality=enhance_quality
        )
        
        logger.info("Shirt image processed successfully")
        return jsonify({
            "success": True,
            "processed_image": processed_image
        })
            
    except Exception as e:
        logger.error(f"Error processing shirt image: {str(e)}")
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500

@app.route("/api/process-corner-radius", methods=["POST", "OPTIONS"])
def process_corner_radius():
    """Process an image to apply corner radius only - using same approach as feather"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    
    try:
        data = request.get_json()
        image_data = data.get("image_data")
        corner_radius = data.get("corner_radius", 15)
        
        if not image_data:
            return jsonify({"success": False, "error": "image_data is required"}), 400
        
        logger.info(f"Processing corner radius with radius={corner_radius}")
        
        # For now, just return the original image to avoid errors
        # The corner radius effect needs to be implemented properly
        return jsonify({
            "success": True,
            "processed_image": image_data
        })
            
    except Exception as e:
        logger.error(f"Error processing corner radius: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route("/api/apply-feather-to-print-quality", methods=["POST", "OPTIONS"])
def apply_feather_to_print_quality():
    """Apply feather effect to a print quality image"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    
    try:
        data = request.get_json()
        image_data = data.get("image_data")
        feather_radius = data.get("feather_radius", 12)
        
        if not image_data:
            return jsonify({"success": False, "error": "image_data is required"}), 400
        
        logger.info(f"Applying feather effect to print quality image with radius={feather_radius}")
        
        # Apply feather effect to the print quality image
        processed_image = screenshot_capture.apply_feather_to_print_quality(image_data, feather_radius)
        
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
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
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
        processed_image = screenshot_capture.apply_feather_effect(
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
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    
    try:
        data = request.get_json()
        thumbnail_data = data.get("thumbnail_data")
        print_dpi = data.get("print_dpi", 300)
        soft_corners = data.get("soft_corners", False)
        edge_feather = data.get("edge_feather", False)
        crop_area = data.get("crop_area")
        
        if not thumbnail_data:
            return jsonify({"success": False, "error": "thumbnail_data is required"}), 400
        
        logger.info(f"Processing thumbnail for print quality: DPI={print_dpi}, soft_corners={soft_corners}, edge_feather={edge_feather}")
        if crop_area:
            logger.info(f"Crop area provided: {crop_area}")
        
        # Process the thumbnail for print quality
        result = screenshot_capture.process_thumbnail_for_print(
            thumbnail_data,
            print_dpi=print_dpi,
            soft_corners=soft_corners,
            edge_feather=edge_feather,
            crop_area=crop_area
        )
        
        if result['success']:
            logger.info(f"Thumbnail processed for print: {result.get('dimensions', {}).get('width', 'unknown')}x{result.get('dimensions', {}).get('height', 'unknown')}")
            response = jsonify(result)
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response
        else:
            logger.error(f"Thumbnail processing failed: {result['error']}")
            response = jsonify(result)
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 500
            
    except Exception as e:
        logger.error(f"Error processing thumbnail for print quality: {str(e)}")
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500

@app.route("/api/get-order-screenshot/<order_id>")
def get_order_screenshot(order_id):
    """Get screenshot data for a specific order"""
    try:
        # First try to get order from database using order_id field
        result = supabase.table('orders').select('*').eq('order_id', order_id).execute()
        
        if not result.data:
            # Fallback: try to get from in-memory order_store
            if order_id in order_store:
                order_data = order_store[order_id]
                logger.info(f"✅ Retrieved order {order_id} from in-memory store")
            else:
                return jsonify({
                    "success": False,
                    "error": "Order not found"
                }), 404
        else:
            order_data = result.data[0]
            logger.info(f"✅ Retrieved order {order_id} from database")
        
        # Extract screenshot data from cart items
        screenshot_data = None
        cart = order_data.get('cart', [])
        
        # Look for screenshot in cart items
        for item in cart:
            if item.get('img') and item['img'].startswith('data:image'):
                screenshot_data = item['img']
                break
            elif item.get('screenshot') and item['screenshot'].startswith('data:image'):
                screenshot_data = item['screenshot']
                break
        
        # Fallback: check order-level fields
        if not screenshot_data:
            if order_data.get('image_url'):
                screenshot_data = order_data.get('image_url')
            elif order_data.get('screenshot_data'):
                screenshot_data = order_data.get('screenshot_data')
            elif order_data.get('thumbnail_data'):
                screenshot_data = order_data.get('thumbnail_data')
        
        if screenshot_data:
            return jsonify({
                "success": True,
                "screenshot": screenshot_data,
                "order_id": order_id,
                "video_title": order_data.get('video_title', 'Unknown Video'),
                "creator_name": order_data.get('creator_name', 'Unknown Creator')
            })
        else:
            return jsonify({
                "success": False,
                "error": "No screenshot data found for this order"
            }), 404
            
    except Exception as e:
        logger.error(f"Error getting order screenshot: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        }), 500

@app.route("/print-quality")
def print_quality_page():
    """Serve the print quality image generator page"""
    order_id = request.args.get('order_id')
    return render_template('print_quality.html', order_id=order_id)

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

@app.route("/api/users/<user_id>/delete-account", methods=["DELETE"])
def delete_user_account(user_id):
    """Delete user account and all associated data"""
    try:
        logger.info(f"Attempting to delete user account: {user_id}")
        
        # Delete user's videos
        try:
            supabase.table('videos2').delete().eq('user_id', user_id).execute()
            logger.info(f"Deleted videos for user {user_id}")
        except Exception as e:
            logger.error(f"Error deleting videos: {str(e)}")
        
        # Delete user's subscriptions (where they are the subscriber)
        try:
            supabase.table('subscriptions').delete().eq('subscriber_id', user_id).execute()
            logger.info(f"Deleted subscriptions for user {user_id}")
        except Exception as e:
            logger.error(f"Error deleting subscriptions: {str(e)}")
        
        # Delete user's channel subscriptions (where they are the channel)
        try:
            supabase.table('subscriptions').delete().eq('channel_id', user_id).execute()
            logger.info(f"Deleted channel subscriptions for user {user_id}")
        except Exception as e:
            logger.error(f"Error deleting channel subscriptions: {str(e)}")
        
        # Delete user's subscription tier
        try:
            supabase.table('user_subscriptions').delete().eq('user_id', user_id).execute()
            logger.info(f"Deleted user subscription for user {user_id}")
        except Exception as e:
            logger.error(f"Error deleting user subscription: {str(e)}")
        
        # Friend functionality removed - no friend requests to delete
        
        # Delete user's products
        try:
            supabase.table('products').delete().eq('user_id', user_id).execute()
            logger.info(f"Deleted products for user {user_id}")
        except Exception as e:
            logger.error(f"Error deleting products: {str(e)}")
        
        # Delete user's sales
        try:
            supabase.table('sales').delete().eq('user_id', user_id).execute()
            logger.info(f"Deleted sales for user {user_id}")
        except Exception as e:
            logger.error(f"Error deleting sales: {str(e)}")
        
        # Finally, delete the user profile
        try:
            supabase.table('users').delete().eq('id', user_id).execute()
            logger.info(f"Deleted user profile for user {user_id}")
        except Exception as e:
            logger.error(f"Error deleting user profile: {str(e)}")
        
        logger.info(f"Successfully deleted all data for user {user_id}")
        return jsonify({"success": True, "message": "Account deleted successfully"})
        
    except Exception as e:
        logger.error(f"Error in delete_user_account: {str(e)}")
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
        # Test Stripe configuration
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        if not stripe.api_key:
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
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        # Get shipping address from frontend
        shipping_address = data.get('shipping_address', {})
        country = shipping_address.get('country_code', 'US')
        postal_code = shipping_address.get('zip', '')
        
        # Get cart items from frontend
        cart = data.get('cart', [])
        
        if not cart:
            return jsonify({
                "success": False,
                "error": "No cart items provided"
            }), 400
        
        # Printify API configuration (read from environment)
        printify_api_key = os.getenv("PRINTIFY_API_KEY") or os.getenv("PRINTFUL_API_KEY")
        printify_base_url = "https://api.printify.com/v1"

        if not printify_api_key:
            logger.error("PRINTIFY_API_KEY/PRINTFUL_API_KEY is not configured")
            # Fallback to default shipping without attempting external call
            return jsonify({
                "success": True,
                "shipping_cost": 5.99,
                "currency": "USD",
                "delivery_days": "5-7",
                "shipping_method": "Standard Shipping",
                "fallback": True
            })
        
        # Calculate shipping using Printify API
        shipping_data = {
            "line_items": [],
            "shipping_address": {
                "country": country,
                "postal_code": postal_code
            }
        }
        
        # Convert cart items to Printify format
        for item in cart:
            shipping_data["line_items"].append({
                "variant_id": item.get('variant_id', 1),
                "quantity": item.get('quantity', 1)
            })
        
        # Make request to Printify shipping API
        headers = {
            'Authorization': f'Bearer {printify_api_key}',
            'Content-Type': 'application/json'
        }
        
        response = requests.post(
            f"{printify_base_url}/shipping/rates",
            json=shipping_data,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            shipping_rates = response.json()
            
            # Get the first available shipping rate
            if shipping_rates and len(shipping_rates) > 0:
                rate = shipping_rates[0]
                return jsonify({
                    "success": True,
                    "shipping_cost": rate.get('cost', 5.99),
                    "currency": "USD",
                    "delivery_days": rate.get('estimated_days', '5-7'),
                    "shipping_method": rate.get('name', 'Standard Shipping')
                })
            else:
                # Fallback if no rates available
                return jsonify({
                    "success": True,
                    "shipping_cost": 5.99,
                    "currency": "USD",
                    "delivery_days": "5-7",
                    "shipping_method": "Standard Shipping"
                })
        else:
            logger.error(f"Printify API error: {response.status_code} - {response.text}")
            # Fallback to default shipping
            return jsonify({
                "success": True,
                "shipping_cost": 5.99,
                "currency": "USD",
                "delivery_days": "5-7",
                "shipping_method": "Standard Shipping"
            })
        
    except Exception as e:
        logger.error(f"Error calculating shipping: {str(e)}")
        # Fallback to default shipping
        return jsonify({
            "success": True,
            "shipping_cost": 5.99,
            "currency": "USD",
            "delivery_days": "5-7",
            "shipping_method": "Standard Shipping"
        })

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

# Authentication endpoints
@app.route("/api/auth/login", methods=["POST", "OPTIONS"])
def auth_login():
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        origin = request.headers.get('Origin')
        allowed_origins = ["https://screenmerch.com", "https://www.screenmerch.com", "https://68e94d7278d7ced80877724f--eloquent-crumble-37c09e.netlify.app", "https://68e9564fa66cd5f4794e5748--eloquent-crumble-37c09e.netlify.app", "https://*.netlify.app", "http://localhost:3000", "http://localhost:5173"]
        
        if origin in allowed_origins:
            response.headers.add('Access-Control-Allow-Origin', origin)
        else:
            response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.com')
        
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    """Handle user login with email and password validation"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({"success": False, "error": "Email and password are required"}), 400
        
        # Validate email format
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({"success": False, "error": "Please enter a valid email address"}), 400
        
        # Check if user exists in database
        try:
            result = supabase.table('users').select('*').eq('email', email).execute()
            
            if result.data:
                user = result.data[0]
                stored_password = user.get('password_hash', '')
                
                # Simple password verification (replace with bcrypt in production)
                if password == stored_password:  # Simple check for demo
                    logger.info(f"User {email} logged in successfully")
                    response = jsonify({
                        "success": True, 
                        "message": "Login successful",
                        "user": {
                            "id": user.get('id'),
                            "email": user.get('email'),
                            "display_name": user.get('display_name'),
                            "role": user.get('role', 'customer')
                        }
                    })
                    
                    # Set cookie with dynamic domain
                    domain = cookie_domain_for_request()
                    response.set_cookie(
                        "sm_auth", user.get('id'),
                        domain=domain,
                        path="/",
                        secure=True,
                        httponly=True,
                        samesite="Lax"
                    )
                    
                    response.headers.add('Access-Control-Allow-Origin', '*')
                    return response
                else:
                    response = jsonify({"success": False, "error": "Invalid email or password"})
                    response.headers.add('Access-Control-Allow-Origin', '*')
                    return response, 401
            else:
                response = jsonify({"success": False, "error": "Invalid email or password"})
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response, 401
                
        except Exception as db_error:
            logger.error(f"Database error during login: {str(db_error)}")
            response = jsonify({"success": False, "error": "Authentication service unavailable"})
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 500
            
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500

@app.route("/api/auth/signup", methods=["POST", "OPTIONS"])
def auth_signup():
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    """Handle user signup with email and password validation"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        redirect_url = data.get('redirect_url', '')
        
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
        
        # Check if user already exists
        try:
            existing_user = supabase.table('users').select('*').eq('email', email).execute()
            
            if existing_user.data:
                return jsonify({"success": False, "error": "An account with this email already exists"}), 409
            
            # Create new user
            # For demo purposes, store password as-is (replace with bcrypt in production)
            new_user = {
                'email': email,
                'password_hash': password,  # Replace with bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()) in production
                'role': 'customer',
                'status': 'active',
                'email_verified': False
            }
            
            result = supabase.table('users').insert(new_user).execute()
            
            if result.data:
                logger.info(f"New user {email} created successfully")
                response = jsonify({
                    "success": True, 
                    "message": "Account created successfully!",
                    "user": {
                        "id": result.data[0].get('id'),
                        "email": result.data[0].get('email'),
                        "display_name": result.data[0].get('display_name'),
                        "role": result.data[0].get('role', 'customer')
                    }
                })
                
                # Set cookie with dynamic domain
                domain = cookie_domain_for_request()
                response.set_cookie(
                    "sm_auth", result.data[0].get('id'),
                    domain=domain,
                    path="/",
                    secure=True,
                    httponly=True,
                    samesite="Lax"
                )
                
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response
            else:
                response = jsonify({"success": False, "error": "Failed to create account"})
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response, 500
                
        except Exception as db_error:
            logger.error(f"Database error during signup: {str(db_error)}")
            if "duplicate key" in str(db_error).lower():
                response = jsonify({"success": False, "error": "An account with this email already exists"})
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response, 409
            response = jsonify({"success": False, "error": "Account creation failed"})
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 500
            
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500

@app.route("/api/analytics", methods=["GET"])
def get_analytics():
    """Get analytics data for creator dashboard"""
    try:
        # Get user ID and channel ID from query parameters
        user_id = request.args.get('user_id')
        channel_id = request.args.get('channel_id')
        
        logger.info(f"📊 Analytics request - User ID: {user_id}, Channel ID: {channel_id}")
        
        # Get all orders from database and in-memory store
        all_orders = []
        
        # Get orders from order_store (recent orders)
        for order_id, order_data in order_store.items():
            order_data['order_id'] = order_id
            order_data['status'] = 'pending'
            order_data['created_at'] = order_data.get('timestamp', 'N/A')
            all_orders.append(order_data)
        
        # Get orders from database (sales table)
        try:
            logger.info("🔍 Fetching sales data from database...")
            
            # Build query based on filters - use more efficient approach
            if channel_id or user_id:
                # If filters provided, use them
                query = supabase.table('sales').select('id,product_name,amount,image_url,user_id,channel_id')
                
                if channel_id:
                    query = query.eq('channel_id', channel_id)
                    logger.info(f"🔍 Filtering sales by channel_id: {channel_id}")
                
                if user_id:
                    query = query.eq('user_id', user_id)
                    logger.info(f"🔍 Filtering sales by user_id: {user_id}")
                
                sales_result = query.execute()
            else:
                # If no filters, get only sales with non-zero amounts (faster query)
                logger.info("🔍 Getting sales with non-zero amounts (no filters provided)")
                sales_result = supabase.table('sales').select('id,product_name,amount').gt('amount', 0).execute()
            logger.info(f"📊 Found {len(sales_result.data)} sales records in database")
            
            # Debug: Log the first few sales to see what we're getting
            for i, sale in enumerate(sales_result.data[:3]):
                logger.info(f"📦 Sample sale {i+1}: {sale.get('product_name')} - ${sale.get('amount')} - Channel: {sale.get('channel_id')}")
            
            # Debug: Log all sales found
            for sale in sales_result.data:
                logger.info(f"📦 Found sale: {sale.get('product_name')} - ${sale.get('amount')} - Channel: {sale.get('channel_id')} - User: {sale.get('user_id')}")
            
            for sale in sales_result.data:
                logger.info(f"📦 Processing sale: {sale.get('product_name')} - ${sale.get('amount')}")
                # Convert database sale to order format
                order_data = {
                    'order_id': sale.get('id', 'db-' + str(sale.get('id'))),
                    'cart': [{
                        'product': sale.get('product_name', 'Unknown Product'),
                        'variants': {'color': 'N/A', 'size': 'N/A'},
                        'note': '',
                        'img': '',
                        'video_title': 'Unknown Video',
                        'creator_name': 'Unknown Creator'
                    }],
                    'status': 'completed',
                    'created_at': 'N/A',  # created_at column doesn't exist
                    'total_value': sale.get('amount', 0),
                    'user_id': None,
                    'channel_id': None
                }
                all_orders.append(order_data)
                logger.info(f"✅ Added sale to analytics: {sale.get('product_name')} - ${sale.get('amount')}")
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
        
        analytics_data = {
            'total_sales': total_sales,
            'total_revenue': round(total_revenue, 2),
            'avg_order_value': round(avg_order_value, 2),
            'products_sold_count': len(products_sold),
            'videos_with_sales_count': len(videos_with_sales),
            'sales_data': sales_data,
            'products_sold': [
                {
                    'product': product,
                    'quantity': quantity,
                    'revenue': quantity * 25.00,  # Assuming $25 per product
                    'video_source': 'Unknown Video',
                    'image': ''
                }
                for product, quantity in products_sold.items()
            ],
            'videos_with_sales': [
                {
                    'video_name': video_name,
                    'sales_count': video_data['sales_count'],
                    'revenue': video_data['revenue']
                }
                for video_name, video_data in videos_with_sales.items()
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
            # Create admin user
            admin_user = {
                'email': 'admin@screenmerch.com',
                'password_hash': 'VieG369Bbk8!',
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
                    'password_hash': 'VieG369Bbk8!'
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
        allowed_origins = ["https://screenmerch.com", "https://www.screenmerch.com", "https://68e94d7278d7ced80877724f--eloquent-crumble-37c09e.netlify.app", "https://68e9564fa66cd5f4794e5748--eloquent-crumble-37c09e.netlify.app", "https://*.netlify.app", "http://localhost:3000", "http://localhost:5173"]
        
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
        else:
            response.headers['Access-Control-Allow-Origin'] = 'https://screenmerch.com'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
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
        
        # Generate authorization URL
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        
        # Store state in session for security
        session['oauth_state'] = state
        
        # Redirect to Google OAuth instead of returning JSON
        return redirect(authorization_url, code=302)
        
    except Exception as e:
        logger.error(f"Google OAuth login error: {str(e)}")
        return jsonify({"success": False, "error": "Failed to initiate Google login"}), 500

@app.route("/api/auth/google/callback", methods=["GET", "OPTIONS"])
@cross_origin(origins=[], supports_credentials=True)  # Disable Flask-CORS for this endpoint
def google_callback():
    """Handle Google OAuth callback"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        origin = request.headers.get('Origin')
        allowed_origins = ["https://screenmerch.com", "https://www.screenmerch.com", "https://68e94d7278d7ced80877724f--eloquent-crumble-37c09e.netlify.app", "https://68e9564fa66cd5f4794e5748--eloquent-crumble-37c09e.netlify.app", "https://*.netlify.app", "http://localhost:3000", "http://localhost:5173"]
        
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
        else:
            response.headers['Access-Control-Allow-Origin'] = 'https://screenmerch.com'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response
    
    try:
        # Get authorization code from callback
        code = request.args.get('code')
        state = request.args.get('state')
        
        if not code:
            return jsonify({"success": False, "error": "Authorization code not provided"}), 400
        
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
        
        # Check if user exists in database
        result = supabase.table('users').select('*').eq('email', google_email).execute()
        
        if result.data:
            # User exists, update their Google info
            user = result.data[0]
            supabase.table('users').update({
                'display_name': google_name
            }).eq('id', user['id']).execute()
        else:
            # Create new user
            username = google_name.replace(' ', '').lower() if google_name else google_email.split('@')[0]
            new_user = {
                'email': google_email,
                'display_name': google_name,
                'role': 'creator'
            }
            result = supabase.table('users').insert(new_user).execute()
            user = result.data[0] if result.data else None
        
        if not user:
            return jsonify({"success": False, "error": "Failed to create or update user"}), 500
        
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
        
        # Redirect to frontend with success
        from flask import redirect
        import urllib.parse
        
        # Create user data for frontend
        user_data = {
            "id": user.get('id'),
            "email": user.get('email'),
            "display_name": user.get('display_name'),
            "role": user.get('role', 'creator'),
            "picture": google_picture,
            "youtube_channel": youtube_channel
        }
        
        # Debug: Log the user_data being sent to frontend
        logger.info(f"🔍 User data being sent to frontend: {user_data}")
        
        # Encode user data as URL parameter
        user_data_json = json.dumps(user_data)
        user_data_encoded = urllib.parse.quote(user_data_json)
        
        # Redirect to frontend with user data
        frontend_url = "https://screenmerch.com"
        redirect_url = f"{frontend_url}?login=success&user={user_data_encoded}"
        
        return redirect(redirect_url)
        
    except Exception as e:
        logger.error(f"Google OAuth callback error: {str(e)}")
        return jsonify({"success": False, "error": "Google authentication failed"}), 500

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
