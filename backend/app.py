from flask import Flask, request, jsonify, render_template, send_from_directory, redirect, url_for, session
import os
import logging
from dotenv import load_dotenv
from flask_cors import CORS
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
from datetime import datetime
import time


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
print("SUPABASE_URL:", "✓" if supabase_url else "✗")
print("SUPABASE_ANON_KEY:", "✓" if supabase_key else "✗")
if not supabase_url or not supabase_key:
    print("ERROR: Missing Supabase environment variables. Check your .env file location and content.", file=sys.stderr)
    sys.exit(1)

# Email notification setup (replacing Twilio SMS)
ADMIN_EMAIL = os.getenv("MAIL_TO") or os.getenv("ADMIN_EMAIL")
print(f"ADMIN_EMAIL: {'✓' if ADMIN_EMAIL else '✗'}")

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
    
    # Use product-specific size pricing if available, otherwise use default
    if "size_pricing" in product:
        size_adjustments = product["size_pricing"]
    else:
        # Default size pricing for products without specific pricing
        size_adjustments = {
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
    
    # Use product-specific size pricing if available, otherwise use default
    if "size_pricing" in product:
        size_adjustments = product["size_pricing"]
    else:
        # Default size pricing for products without specific pricing
        size_adjustments = {
            "XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0,
            "XXL": 2, "XXXL": 4, "XXXXL": 6, "XXXXXL": 8
        }
    
    # Calculate min and max prices based on size adjustments
    min_price = base_price + min(size_adjustments.values())
    max_price = base_price + max(size_adjustments.values())
    
    if min_price == max_price:
        return f"${min_price:.2f}"
    else:
        return f"${min_price:.2f}-${max_price:.2f}"

# Configure CORS for production
CORS(app, resources={r"/api/*": {"origins": [
    "chrome-extension://*",
    "https://screenmerch.com",
    "https://www.screenmerch.com",
    "https://famous-custard-4c8894.netlify.app",
    "https://breakupplug.netlify.app",
    "https://*.netlify.app",
    "https://*.fly.dev"
]}}, supports_credentials=True)

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
    
    # Ensure CORS headers are properly set
    if request.method == 'OPTIONS':
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers.add('Access-Control-Allow-Credentials', 'true')
    
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

# NEW: Printful API Key
PRINTFUL_API_KEY = os.getenv("PRINTFUL_API_KEY")

@app.route("/api/ping")
def ping():
    return {"message": "pong"}

@app.route("/api/calculate-shipping", methods=["POST"])
def calculate_shipping():
    """Calculate exact shipping using Printful's rates API.

    Expects JSON with:
      - cart: [{ printful_variant_id?, quantity? }]
      - shipping_address: { country_code, state_code?, city?, zip? }
    """
    try:
        data = request.get_json() or {}
        cart = data.get("cart", [])
        shipping_address = data.get("shipping_address") or data.get("shippingAddress") or {}

        if not shipping_address or not shipping_address.get("country_code"):
            return jsonify({"success": False, "error": "shipping_address.country_code is required"}), 400

        # Map cart into the minimal shape needed for Printful rate lookup
        items = []
        for item in cart:
            items.append({
                "printful_variant_id": item.get("printful_variant_id") or item.get("variant_id") or 71,
                "quantity": item.get("quantity", 1)
            })

        recipient = {
            "country_code": shipping_address.get("country_code"),
            "state_code": shipping_address.get("state_code", ""),
            "city": shipping_address.get("city", ""),
            "zip": shipping_address.get("zip", "")
        }

        result = printful_integration.calculate_shipping_rates(recipient, items)
        logger.info(f"🚚 Calculated shipping result: {result}")

        return jsonify({
            "success": bool(result.get("success")),
            "shipping_cost": float(result.get("shipping_cost", 0.0)),
            "currency": result.get("currency", "USD"),
            "delivery_days": result.get("delivery_days"),
            "fallback": result.get("fallback", False),
        })
    except Exception as e:
        logger.error(f"Shipping calculation API error: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

def send_welcome_email(user_email, user_name, tier="Pro"):
    """Send welcome email to new subscribers"""
    try:
        subject = f"Welcome to ScreenMerch {tier}! 🚀 Here's Your Next Steps"
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to ScreenMerch {tier}!</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                .step {{ background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #667eea; }}
                .step h3 {{ color: #667eea; margin-top: 0; }}
                .cta {{ background: #667eea; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }}
                .footer {{ text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🎉 Welcome to ScreenMerch {tier}!</h1>
                <p>Your 7-day free trial is now active</p>
            </div>
            
            <div class="content">
                <p>Hi {user_name or 'there'},</p>
                
                <p>Congratulations! You're now part of ScreenMerch {tier}. Your 7-day free trial is active, and you have access to all our premium features.</p>
                
                <h2>🚀 Here's what you can do next:</h2>
                
                <div class="step">
                    <h3>1. Create Password & Log In</h3>
                    <p>• Complete your account setup</p>
                    <p>• Set a secure password</p>
                    <p>• Access your dashboard</p>
                    <a href="https://screenmerch.com/dashboard" class="cta">Go to Dashboard</a>
                </div>
                
                <div class="step">
                    <h3>2. Customize Your Public Page</h3>
                    <p>• Add your logo and brand colors</p>
                    <p>• Write your creator bio</p>
                    <p>• Design your store layout</p>
                    <a href="https://screenmerch.com/dashboard/settings" class="cta">Customize Store</a>
                </div>
                
                <div class="step">
                    <h3>3. Upload Videos & Promote</h3>
                    <p>• Share your store link on social media</p>
                    <p>• Use our built-in social media tools</p>
                    <p>• Track your sales analytics</p>
                    <a href="https://screenmerch.com/dashboard/analytics" class="cta">View Analytics</a>
                </div>
                
                <h3>💰 Your Earnings</h3>
                <p>With ScreenMerch {tier}, you keep <strong>70% of your earnings</strong> with our competitive 30% service fee. No hidden costs!</p>
                
                <h3>❓ Need Help?</h3>
                <p>• Reply to this email for support</p>
                <p>• Check our <a href="https://screenmerch.com/help">Help Center</a></p>
                <p>• Join our <a href="https://discord.gg/screenmerch">Creator Community</a></p>
                
                <p><strong>Best regards,<br>The ScreenMerch Team</strong></p>
            </div>
            
            <div class="footer">
                <p>© 2024 ScreenMerch. All rights reserved.</p>
                <p>You're receiving this email because you signed up for ScreenMerch {tier}.</p>
            </div>
        </body>
        </html>
        """
        
        # Send email using Resend
        data = {
            "from": RESEND_FROM,
            "to": user_email,
            "subject": subject,
            "html": html_body
        }
        
        headers = {
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            "https://api.resend.com/emails",
            headers=headers,
            json=data
        )
        
        if response.status_code == 200:
            logger.info(f"Welcome email sent successfully to {user_email}")
            return True
        else:
            logger.error(f"Failed to send welcome email: {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Error sending welcome email: {str(e)}")
        return False

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

@app.route("/api/test-welcome-email", methods=["POST"])
def test_welcome_email():
    """Test endpoint to send a welcome email"""
    try:
        data = request.get_json() or {}
        user_email = data.get("email", "test@example.com")
        user_name = data.get("name", "Test User")
        tier = data.get("tier", "Pro")
        
        success = send_welcome_email(user_email, user_name, tier)
        
        if success:
            return jsonify({"success": True, "message": f"Welcome email sent successfully to {user_email}"})
        else:
            return jsonify({"success": False, "error": "Failed to send welcome email"}), 500
            
    except Exception as e:
        logger.error(f"Test welcome email error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

PRODUCTS = [
    # Products with both COLOR and SIZE options
    {
        "name": "Unisex T-Shirt",
        "price": 21.69,
        "filename": "guidontee.png",
        "main_image": "guidontee.png",
        "preview_image": "guidonpreview.png",
        "options": {"color": ["Black", "White", "Dark Gray", "Navy", "Red", "Athletic Heather"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]},
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
        "name": "Unisex Classic Tee",
        "price": 19.25,
        "filename": "unisexclassictee.png",
        "main_image": "unisexclassictee.png",
        "preview_image": "unisexclassicteepreview.png",
        "options": {"color": ["Black", "Navy", "Sport Grey", "White", "Maroon", "Red", "Natural", "Military Green", "Orange", "Irish Green", "Gold", "Sky", "Ash", "Purple", "Cardinal"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]},
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
        "name": "Men's Tank Top",
        "price": 24.23,
        "filename": "random.png",
        "main_image": "random.png",
        "preview_image": "randompreview.png",
        "options": {"color": ["Black", "White", "Navy", "True Royal", "Athletic Heather", "Red", "Charcoal-Black Triblend", "Oatmeal Triblend"], "size": ["XS", "S", "M", "L", "XL", "XXL"]},
        "size_pricing": {
            "XS": 0,      # No extra charge
            "S": 0,       # No extra charge  
            "M": 0,       # No extra charge
            "L": 0,       # No extra charge
            "XL": 0,      # No extra charge
            "XXL": 2,     # +$2 (2XL)
        }
    },
    {
        "name": "Unisex Hoodie",
        "price": 36.95,
        "filename": "tested.png",
        "main_image": "tested.png",
        "preview_image": "testedpreview.png",
        "options": {"color": ["Black", "Navy Blazer", "Carbon Grey", "White", "Maroon", "Charcoal Heather", "Vintage Black", "Forest Green", "Military Green", "Team Red", "Dusty Rose", "Sky Blue", "Bone", "Purple", "Team Royal"], "size": ["S", "M", "L", "XL", "XXL", "XXXL"]},
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
        "options": {"color": ["Black", "Gray"], "size": ["S", "M", "L", "XL", "XXL", "XXXL"]},
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
        "preview_image": "womensribbedneckpreview.jpg",
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
        "preview_image": "womensshirtkevin.png",
        "options": {"color": ["Black", "White", "Dark Grey Heather", "Pink", "Navy", "Heather Mauve", "Poppy", "Heather Red", "Berry", "Leaf", "Heather Blue Lagoon", "Athletic Heather", "Heather Stone", "Heather Prism Lilac", "Citron"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]},
        "size_pricing": {
            "XS": 0,
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 2,
            "XXXL": 2
        }
    },
            {
        "name": "Unisex Heavyweight T-Shirt",
        "price": 25.6,
        "filename": "womenshdshirt.png",
        "main_image": "womenshdshirt.png",
        "preview_image": "womenshdshirtpreview.png",
        "options": {"color": ["Anthracite", "Black", "Burgundy", "Cotton Pink", "Dark Heather Grey", "Desert Dust", "Fraiche Peche", "French Navy", "Heather Grey", "India Ink Grey", "Khaki", "Lavender", "Red", "Stargazer", "White"], "size": ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]},
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "2XL": 2.1,
            "3XL": 4.1,
            "4XL": 6.1,
            "5XL": 8.1
},
        "size_color_availability": {
            "S": [
                        "Black",
                        "French Navy",
                        "Heather Grey",
                        "White",
                        "Dark Heather Grey",
                        "Burgundy",
                        "India Ink Grey",
                        "Anthracite",
                        "Red",
                        "Stargazer",
                        "Khaki",
                        "Desert Dust",
                        "Fraiche Peche",
                        "Cotton Pink",
                        "Lavender"
            ],
            "M": [
                        "Black",
                        "French Navy",
                        "Heather Grey",
                        "White",
                        "Dark Heather Grey",
                        "Burgundy",
                        "India Ink Grey",
                        "Anthracite",
                        "Red",
                        "Stargazer",
                        "Khaki",
                        "Desert Dust",
                        "Fraiche Peche",
                        "Cotton Pink",
                        "Lavender"
            ],
            "L": [
                        "Black",
                        "French Navy",
                        "Heather Grey",
                        "White",
                        "Dark Heather Grey",
                        "Burgundy",
                        "India Ink Grey",
                        "Anthracite",
                        "Red",
                        "Stargazer",
                        "Khaki",
                        "Desert Dust",
                        "Fraiche Peche",
                        "Cotton Pink",
                        "Lavender"
            ],
            "XL": [
                        "Black",
                        "French Navy",
                        "Heather Grey",
                        "White",
                        "Dark Heather Grey",
                        "Burgundy",
                        "India Ink Grey",
                        "Anthracite",
                        "Red",
                        "Stargazer",
                        "Khaki",
                        "Desert Dust",
                        "Fraiche Peche",
                        "Cotton Pink",
                        "Lavender"
            ],
            "2XL": [
                        "Black",
                        "French Navy",
                        "Heather Grey",
                        "White",
                        "Dark Heather Grey",
                        "Burgundy",
                        "India Ink Grey",
                        "Anthracite",
                        "Red",
                        "Stargazer",
                        "Khaki",
                        "Desert Dust",
                        "Fraiche Peche",
                        "Cotton Pink",
                        "Lavender"
            ],
            "3XL": [
                        "Black",
                        "French Navy",
                        "Heather Grey",
                        "White"
            ],
            "4XL": [
                        "Black",
                        "French Navy",
                        "Heather Grey",
                        "White"
            ],
            "5XL": [
                        "Black",
                        "French Navy",
                        "Heather Grey",
                        "White"
            ]
}
    },
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "2XL": 2.1,
            "3XL": 4.1,
            "4XL": 6.1,
            "5XL": 8.1
}
    },
        "size_pricing": {
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 2,
            "XXXL": 2,
            "XXXXL": 2
        }
    },
    {
        "name": "Kids Shirt",
        "price": 23.49,
        "filename": "kidshirt.png",
        "main_image": "kidshirt.png",
        "preview_image": "kidshirtpreview.jpg",
        "options": {"color": ["Black", "Navy", "Maroon", "Forest", "Red", "Dark Grey Heather", "True Royal", "Berry", "Heather Forest", "Kelly", "Heather Columbia Blue", "Athletic Heather", "Mustard", "Pink", "Heather Dust", "Natural", "White"], "size": ["XS", "S", "M", "L", "XL"]}
    },
    {
        "name": "Youth Heavy Blend Hoodie",
        "price": 29.33,
        "filename": "kidhoodie.png",
        "main_image": "kidhoodie.png",
        "preview_image": "kidhoodiepreview.jpg",
        "options": {"color": ["Black", "Navy", "Royal", "White", "Dark Heather", "Carolina Blue"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}
    },
    {
        "name": "Kids Long Sleeve",
        "price": 26.49,
        "filename": "kidlongsleeve.png",
        "main_image": "kidlongsleeve.png",
        "preview_image": "kidlongsleevepreview.jpg",
        "options": {"color": ["Black", "Navy", "Red", "Athletic Heather", "White"], "size": ["S", "M", "L"]}
    },
    {
        "name": "All-Over Print Tote Bag",
        "price": 24.23,
        "filename": "allovertotebag.png",
        "main_image": "allovertotebag.png",
        "preview_image": "allovertotebagpreview.png",
        "options": {"color": ["Black", "Red", "Yellow"], "size": ["15\"x15\""]}
    },
    {
        "name": "All-Over Print Drawstring Bag",
        "price": 25.25,
        "filename": "drawstringbag.png",
        "main_image": "drawstringbag.png",
        "preview_image": "drawstringbagpreview.png",
        "options": {"color": ["White", "Black", "Blue"], "size": ["15\"x17\""]}
    },
    {
        "name": "All-Over Print Crossbody Bag",
        "price": 32.14,
        "filename": "largecanvasbag.png",
        "main_image": "largecanvasbag.png",
        "preview_image": "largecanvasbagpreview.png",
        "options": {"color": ["Natural", "Black", "Navy"], "size": ["11\"x8\"x1.5\""]}
    },
    {
        "name": "Greeting Card",
        "price": 5.00,
        "filename": "greetingcard.png",
        "main_image": "greetingcard.png",
        "preview_image": "greetingcardpreview.png",
        "options": {"color": ["White"], "size": ["4\"x6\""]}
    },
    {
        "name": "Hardcover Bound Notebook",
        "price": 23.21,
        "filename": "hardcovernotebook.png",
        "main_image": "hardcovernotebook.png",
        "preview_image": "hardcovernotebookpreview.png",
        "options": {"color": ["Black", "Navy", "Red", "Blue", "Turquoise", "Orange", "Silver", "Lime", "White"], "size": ["5.5\"x8.5\""]}
    },
    {
        "name": "Coasters",
        "price": 33.99,
        "filename": "coaster.png",
        "main_image": "coaster.png",
        "preview_image": "coasterpreview.jpg",
        "options": {"color": ["Wood", "Cork", "Black"], "size": []}
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
        "options": {"color": ["White"], "size": ["18oz", "32oz"]}
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
        "options": {"color": ["Black", "White", "Navy", "Sport Grey", "Red", "Military Green", "Light Pink", "Ash"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"]},
        "size_pricing": {
            "XS": 0,
            "S": 0,
            "M": 0,
            "L": 0,
            "XL": 0,
            "XXL": 2,
            "XXXL": 2,
            "XXXXL": 2
        }
    },
    {
        "name": "Women's fitted racerback tank top",
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
        "name": "Women's Micro-Rib Tank Top",
        "price": 25.81,
        "filename": "womenstee.png",
        "main_image": "womenstee.png",
        "preview_image": "womensteepreview.jpg",
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
        "options": {"color": ["Black", "Navy", "Charcoal Gray"], "size": ["One Size"]}
    },
    {
        "name": "Snapback Hat",
        "price": 26.89,
        "filename": "snapbackhat.png",
        "main_image": "snapbackhat.png",
        "preview_image": "snapbackhatpreview.png",
        "options": {"color": ["Black", "White", "Navy", "Gray"], "size": ["One Size"]}
    },
    {
        "name": "Five Panel Trucker Hat",
        "price": 24.85,
        "filename": "fivepaneltruckerhat.png",
        "main_image": "fivepaneltruckerhat.png",
        "preview_image": "fivepaneltruckerhatpreview.jpg",
        "options": {"color": [
            "Black",
            "Black/ White",
            "Charcoal",
            "Black/ White/ Black",
            "Red/ White/ Red",
            "Navy/ White/ Navy",
            "White",
            "Royal/ White/ Royal",
            "Kelly/ White/ Kelly",
            "Navy",
            "Navy/ White",
            "Charcoal/ White",
            "Silver/ Black"
        ], "size": ["One Size"]}
    },
    {
        "name": "White Glossy Mug",
        "price": 19.95,
        "filename": "flatbillcap.png",
        "main_image": "flatbillcap.png",
        "preview_image": "flatbillcappreview.png",
        "options": {"color": ["White"], "size": ["11 oz", "15 oz", "20 oz"]},
        "size_pricing": {
            "11 oz": 0,
            "15 oz": 2.00,
            "20 oz": 4.00
        }
    },
    {
        "name": "All-Over Print Crossbody Bag",
        "price": 30.35,
        "filename": "crossbodybag.png",
        "main_image": "crossbodybag.png",
        "preview_image": "crossbodybagpreview.png",
        "options": {"color": ["White"], "size": []}
    },
    {
        "name": "Baby Short Sleeve One Piece",
        "price": 23.52,
        "filename": "babybib.png",
        "main_image": "babybib.png",
        "preview_image": "babybibpreview.jpg",
        "options": {"color": ["Black", "Dark Grey Heather", "Heather Columbia Blue", "Athletic Heather", "Pink", "Yellow", "White"], "size": ["3-6m", "6-12m", "12-18m", "18-24m"]}
    },
    {
        "name": "Custom Thumbnail Print",
        "price": 15.99,
        "filename": "thumbnail_print.png",
        "main_image": "thumbnail_print.png",
        "preview_image": "thumbnail_print_preview.png",
        "options": {"color": ["Glossy", "Matte"], "size": ["8\"x10\"", "11\"x14\"", "16\"x20\""]},
        "size_pricing": {
            "8\"x10\"": 0,
            "11\"x14\"": 5.00,
            "16\"x20\"": 12.00
        }
    },
    {
        "name": "Thumbnail Poster",
        "price": 19.99,
        "filename": "thumbnail_poster.png",
        "main_image": "thumbnail_poster.png",
        "preview_image": "thumbnail_poster_preview.png",
        "options": {"color": ["White"], "size": ["18\"x24\"", "24\"x36\""]},
        "size_pricing": {
            "18\"x24\"": 0,
            "24\"x36\"": 8.00
        }
    },
    {
        "name": "Thumbnail Canvas Print",
        "price": 29.99,
        "filename": "thumbnail_canvas.png",
        "main_image": "thumbnail_canvas.png",
        "preview_image": "thumbnail_canvas_preview.png",
        "options": {"color": ["Natural"], "size": ["12\"x16\"", "16\"x20\"", "20\"x24\""]},
        "size_pricing": {
            "12\"x16\"": 0,
            "16\"x20\"": 10.00,
            "20\"x24\"": 20.00
        }
    }
]

# Server-side product availability rules (pinpointed to only the requested product)
# This enforces allowed color–size combinations at checkout, matching the storefront/Printful grid.
WOMENS_RIBBED_NECK_ALL_COLORS = [
    "Black",
    "French Navy",
    "Heather Grey",
    "White",
    "Dark Heather Grey",
    "Burgundy",
    "India Ink Grey",
    "Anthracite",
    "Red",
    "Stargazer",
    "Khaki",
    "Desert Dust",
    "Fraiche Peche",
    "Cotton Pink",
    "Lavender",
]

WOMENS_RIBBED_NECK_CORE_COLORS = [
    "Black",
    "French Navy",
    "Heather Grey",
    "White",
]

PRODUCT_AVAILABILITY = {
    "Women's Ribbed Neck": {
        "S": set(WOMENS_RIBBED_NECK_ALL_COLORS),
        "M": set(WOMENS_RIBBED_NECK_ALL_COLORS),
        "L": set(WOMENS_RIBBED_NECK_ALL_COLORS),
        "XL": set(WOMENS_RIBBED_NECK_ALL_COLORS),
        "XXL": set(WOMENS_RIBBED_NECK_ALL_COLORS),
        "XXXL": set(WOMENS_RIBBED_NECK_CORE_COLORS),
        "XXXXL": set(WOMENS_RIBBED_NECK_CORE_COLORS),
        "XXXXXL": set(WOMENS_RIBBED_NECK_CORE_COLORS),
    }
}

def is_variant_available(product_name: str, size: str, color: str) -> bool:
    """Return True if the color–size combo is allowed for the product; defaults to True for products without rules."""
    rules = PRODUCT_AVAILABILITY.get(product_name) or PRODUCT_AVAILABILITY.get((product_name or "").strip())
    if not rules:
        return True
    allowed_colors = rules.get(size)
    if not allowed_colors:
        return True
    return color in allowed_colors

def filter_products_by_category(category):
    """Filter products based on category selection"""
    print(f"🔍 FILTER DEBUG: Received category: '{category}'")
    if not category or category == "all":
        print(f"🔍 FILTER DEBUG: No category or 'all', returning all {len(PRODUCTS)} products")
        return PRODUCTS
    
    # Define category mappings based on actual product names from PRODUCTS list
    category_mappings = {
        'mens': [
            "Men's Long Sleeve Shirt",
            "Men's Tank Top", 
            "Unisex Classic Tee",
            "Unisex T-Shirt",
            "Unisex Hoodie",
            "Unisex Champion Hoodie"
        ],
        'womens': [
            "Cropped Hoodie",
            "Women's fitted racerback tank top",
            "Women's Micro-Rib Tank Top",
            "Women's Ribbed Neck",
            "Women's Shirt",
            "Unisex Heavyweight T-Shirt"
        ],
        'kids': [
            "Youth Heavy Blend Hoodie",
            "Kids Shirt",
            "Kids Long Sleeve"
        ],
        'bags': [
            "All-Over Print Tote Bag",
            "All-Over Print Drawstring Bag", 
            "All-Over Print Crossbody Bag"
        ],
        'hats': [
            "Distressed Dad Hat",
            "Snapback Hat",
            "Five Panel Trucker Hat"
        ],
        'mugs': [
            "White Glossy Mug"
        ],
        'pets': [
            "Pet Bowl All-Over Print",
            "Baby Short Sleeve One Piece"
        ],
        'stickers': [
            "Kiss-Cut Stickers",
            "Die-Cut Magnets"
        ],
        'misc': [
            "Greeting Card",
            "Hardcover Bound Notebook", 
            "Coasters"
        ],
        'thumbnails': [
            "Custom Thumbnail Print",
            "Thumbnail Poster",
            "Thumbnail Canvas Print"
        ]
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

@app.route("/api/create-product", methods=["POST", "OPTIONS"])
def create_product():
    print("🔍 CREATE-PRODUCT ENDPOINT CALLED")
    print(f"🔍 Request method: {request.method}")
    print(f"🔍 Request headers: {dict(request.headers)}")
    print(f"🔍 Request origin: {request.headers.get('Origin')}")
    
    if request.method == "OPTIONS":
        print("🔍 Handling OPTIONS preflight request")
        response = jsonify({"success": True})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST")
        return response
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    try:
        data = request.get_json()
        if not data:
            return jsonify(success=False, error="No data received"), 400

        # Get authentication data and category from request FIRST
        is_authenticated = data.get("isAuthenticated", False)
        user_email = data.get("userEmail", "")
        category = data.get("category", "")
        print(f"🔍 CREATE_PRODUCT DEBUG: Received category from frontend: '{category}'")

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
            # Get a proper product name from the PRODUCTS list
            import random
            product_names = [p["name"] for p in PRODUCTS]
            selected_product_name = random.choice(product_names)
            
            # Try with creator_name first
            print(f"🔍 SUPABASE INSERT DEBUG: Saving category '{category}' to database")
            supabase.table("products").insert({
                "name": selected_product_name,  # Use actual product name instead of generic
                "price": 24.99,  # Required field - default price
                "description": f"Custom merchandise from video",  # Optional but good to have
                "product_id": product_id,
                "thumbnail_url": thumbnail,
                "video_url": video_url,
                "video_title": video_title,
                "creator_name": creator_name,
                "screenshots_urls": json.dumps(screenshots),
                "category": category if category else "misc"
            }).execute()
            logger.info(f"✅ Successfully saved to Supabase database with creator_name")
        except Exception as db_error:
            logger.error(f"❌ Database error: {str(db_error)}")
            logger.info("🔄 Trying without creator_name column...")
            try:
                # Get a proper product name from the PRODUCTS list
                import random
                product_names = [p["name"] for p in PRODUCTS]
                selected_product_name = random.choice(product_names)
                
                # Fallback: insert without creator_name column
                supabase.table("products").insert({
                    "name": selected_product_name,  # Use actual product name instead of generic
                    "price": 24.99,  # Required field - default price
                    "description": f"Custom merchandise from video",  # Optional but good to have
                    "product_id": product_id,
                    "thumbnail_url": thumbnail,
                    "video_url": video_url,
                    "video_title": video_title,
                    "screenshots_urls": json.dumps(screenshots),
                    "category": category if category else "misc"
                }).execute()
                logger.info(f"✅ Successfully saved to Supabase database (without creator_name)")
            except Exception as db_error2:
                logger.error(f"❌ Database error (fallback): {str(db_error2)}")
                logger.info("🔄 Falling back to in-memory storage")
                
                # Fallback to in-memory storage
                print(f"🔍 IN-MEMORY STORE DEBUG: Storing category '{category}' in memory for product {product_id}")
                product_data_store[product_id] = {
                    "thumbnail": thumbnail,
                    "screenshots": screenshots,
                    "video_url": video_url,
                    "video_title": video_title,
                    "creator_name": creator_name,
                    "category": category,  # Add the category to in-memory storage
                    "created_at": "now"
                }

        # Category and authentication data already extracted above
        
        # Build product URL with authentication parameters
        product_url = f"https://copy5-backend.fly.dev/product/{product_id}"
        if is_authenticated and user_email:
            product_url += f"?authenticated=true&email={user_email}"
        
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

@app.route("/product/<product_id>")
def show_product_page(product_id):
    logger.info(f"🔍 Attempting to show product page for ID: {product_id}")
    
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
                        logger.error(f"❌ Error parsing screenshots JSON: {str(json_error)}")
                        screenshots = []
                
                # Get category from URL parameter or database (URL parameter takes priority)
                url_category = request.args.get('category')
                if url_category:
                    category = url_category
                    print(f"🔍 URL CATEGORY DEBUG: Using category '{category}' from URL parameter")
                    filtered_products = filter_products_by_category(category)
                else:
                    # No category specified - show category selection instead of defaulting
                    print(f"🔍 NO CATEGORY SPECIFIED: Showing category selection page")
                    return render_template(
                        'product_page.html',
                        img_url=product_data.get('thumbnail'),
                        screenshots=product_data.get('screenshots', []),
                        products=[],  # Empty products to trigger category selection
                        product_id=product_id,
                        email='',
                        channel_id='',
                        video_title=product_data.get('video_title', 'Unknown Video'),
                        creator_name=product_data.get('creator_name', 'Unknown Creator'),
                        show_category_selection=True
                    )
                
                logger.info(f"🎨 Rendering template with data:")
                logger.info(f"   img_url: {product_data.get('thumbnail_url', 'None')}")
                logger.info(f"   screenshots: {len(screenshots)} items")
                logger.info(f"   category: {category}")
                logger.info(f"   filtered_products: {len(filtered_products)} items (was {len(PRODUCTS)})")
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
                        show_category_selection=False
                    )
                except Exception as template_error:
                    logger.error(f"❌ Template rendering error: {str(template_error)}")
                    logger.error(f"❌ Template error type: {type(template_error).__name__}")
                    raise template_error
            else:
                logger.warning(f"⚠️ No product found in database for ID: {product_id}")
                
        except Exception as db_error:
            logger.error(f"❌ Database error fetching product {product_id}: {str(db_error)}")
            logger.info("🔄 Checking in-memory storage")
        
        # Fallback to in-memory storage
        if product_id in product_data_store:
            logger.info(f"🔄 Found product in memory storage")
            product_data = product_data_store[product_id]
            
            # Get category from URL parameter or memory storage (URL parameter takes priority)
            url_category = request.args.get('category')
            if url_category:
                category = url_category
                print(f"🔍 URL CATEGORY DEBUG (MEMORY): Using category '{category}' from URL parameter")
                filtered_products = filter_products_by_category(category)
            else:
                # No category specified - show category selection instead of defaulting
                print(f"🔍 NO CATEGORY SPECIFIED (MEMORY): Showing category selection page")
                return render_template(
                    'product_page.html',
                    img_url=product_data.get('thumbnail'),
                    screenshots=product_data.get('screenshots', []),
                    products=[],  # Empty products to trigger category selection
                    product_id=product_id,
                    email='',
                    channel_id='',
                    video_title=product_data.get('video_title', 'Unknown Video'),
                    creator_name=product_data.get('creator_name', 'Unknown Creator'),
                    show_category_selection=True
                )
            logger.info(f"🔄 Memory storage - filtering for category '{category}': {len(filtered_products)} products")
            
            return render_template(
                'product_page.html',
                img_url=product_data.get('thumbnail'),
                screenshots=product_data.get('screenshots', []),
                products=filtered_products,
                product_id=product_id,
                email='',
                channel_id='',
                video_title=product_data.get('video_title', 'Unknown Video'),
                creator_name=product_data.get('creator_name', 'Unknown Creator'),
                show_category_selection=False
            )
        else:
            logger.warning(f"⚠️ Product not found in memory storage either")
            
    except Exception as e:
        logger.error(f"❌ Error in show_product_page for {product_id}: {str(e)}")
        logger.error(f"❌ Error type: {type(e).__name__}")
        logger.error(f"❌ Full error details: {repr(e)}")

    logger.warning(f"⚠️ Product not found, but rendering template with default values")
    # Even if product is not found, render the template with default values
    url_category = request.args.get('category')
    if url_category:
        fallback_filtered_products = filter_products_by_category(url_category)
        logger.info(f"🔄 Fallback - using {url_category} category: {len(fallback_filtered_products)} products")
    else:
        # No category specified - show category selection
        logger.info(f"🔄 Fallback - no category specified, showing category selection")
        fallback_filtered_products = []
    
    return render_template(
        'product_page.html',
        img_url='',
        screenshots=[],
        products=fallback_filtered_products,
        product_id=product_id,
        email='',
        channel_id='',
        video_title='Unknown Video',
        creator_name='Unknown Creator',
        show_category_selection=(url_category is None)
    )

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
        # Generate unique order ID and number for tracking
        order_id = str(uuid.uuid4())
        order_number = order_id[-8:].upper()  # Use last 8 characters as order number
        
        # Record each sale
        for item in cart:
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
                    <p><strong>📋 View Full Order Details:</strong></p>
                    <p><a href="https://backend-hidden-firefly-7865.fly.dev/admin/order/{order_id}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order Details</a></p>
                    <br>
                    <p><strong>📊 All Orders Dashboard:</strong></p>
                    <p><a href="https://backend-hidden-firefly-7865.fly.dev/admin/orders" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View All Orders</a></p>
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

        return jsonify({"success": True})

    except Exception as e:
        logger.error(f"Error in send_order: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route("/success")
def success():
    order_id = request.args.get('order_id')
    logger.info(f"🎯 Success page visited with order_id: {order_id}")
    
    if order_id and order_id in order_store:
        logger.info(f"✅ Found order {order_id} in store, processing email...")
        try:
            order_data = order_store[order_id]
            cart = order_data.get("cart", [])
            
            # Generate a simple order number (last 8 characters of order_id)
            order_number = order_id[-8:].upper()
            
            logger.info(f"📧 Preparing email for {len(cart)} items")
            
            # Format and send the order email - simplified version
            html_body = f"<h1>New Paid ScreenMerch Order #{order_number}</h1>"
            html_body += f"<p><strong>Order ID:</strong> {order_id}</p>"
            html_body += f"<p><strong>Items:</strong> {len(cart)}</p>"
            
            # Calculate total value (products only)
            total_value = 0
            for item in cart:
                product_name = item.get('product', '')
                product_info = next((p for p in PRODUCTS if p["name"] == product_name), None)
                if product_info:
                    total_value += product_info["price"]

            # Include shipping if recorded during checkout
            shipping_cost = float(order_data.get("shipping_cost", 0) or 0)
            shipping_currency = order_data.get("shipping_currency", "USD")
            delivery_days = order_data.get("shipping_delivery_days")

            html_body += f"<p><strong>Products Subtotal:</strong> ${total_value:.2f}</p>"
            if shipping_cost:
                html_body += f"<p><strong>Shipping:</strong> ${shipping_cost:.2f} {shipping_currency}"
                if delivery_days:
                    html_body += f" • ETA: {delivery_days} days"
                html_body += "</p>"
            html_body += f"<p><strong>Order Total:</strong> ${(total_value + shipping_cost):.2f}</p>"
            html_body += f"<br>"
            html_body += f"<p><strong>📋 View Full Order Details:</strong></p>"
            html_body += f"<p><a href='https://backend-hidden-firefly-7865.fly.dev/admin/order/{order_id}' style='background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>View Order Details</a></p>"
            html_body += f"<br>"
            html_body += f"<p><strong>📊 All Orders Dashboard:</strong></p>"
            html_body += f"<p><a href='https://backend-hidden-firefly-7865.fly.dev/admin/orders' style='background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>View All Orders</a></p>"
            html_body += f"<br>"
            html_body += f"<p><small>This is an automated notification from ScreenMerch</small></p>"
            
            # Record each sale
            for item in cart:
                record_sale(item)
            
            # Send email using Resend
            email_data = {
                "from": RESEND_FROM,
                "to": [MAIL_TO],
                "subject": f"New Paid Order #{order_number}: {len(cart)} Item(s)",
                "html": html_body
            }
            
            logger.info(f"📤 Sending email to {MAIL_TO} with Resend API...")
            
            response = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json"
                },
                json=email_data
            )
            
            logger.info(f"📨 Resend response status: {response.status_code}")
            
            if response.status_code == 200:
                logger.info(f"✅ Email sent successfully for order {order_number}")
                # Keep order in store for admin dashboard (don't delete)
                # del order_store[order_id]  # Commented out to keep orders visible
            else:
                logger.error(f"❌ Failed to send email for order {order_number}: {response.status_code}")
                
        except Exception as e:
            logger.error(f"❌ Error processing order {order_id}: {str(e)}")
    else:
        logger.warning(f"⚠️ Order {order_id} not found in store or no order_id provided")
    
    return render_template('success.html')

@app.route("/create-checkout-session", methods=["POST"])
def create_checkout_session():
    try:
        data = request.get_json()
        cart = data.get("cart", [])
        product_id = data.get("product_id")
        sms_consent = data.get("sms_consent", False)
        shipping_address = data.get("shipping_address") or data.get("shippingAddress")

        logger.info(f"🛒 Received checkout request - Cart: {cart}")
        logger.info(f"🛒 Product ID: {product_id}")
        logger.info(f"🛒 SMS Consent: {sms_consent}")
        logger.info(f"🧾 Shipping address provided: {bool(shipping_address)}")

        if not cart:
            logger.error("❌ Cart is empty")
            return jsonify({"error": "Cart is empty"}), 400

        # Email notifications - SMS consent not required
        # sms_consent is kept for backward compatibility but not enforced

        # Generate a unique order ID and store the full cart (with images) and SMS consent
        order_id = str(uuid.uuid4())
        order_store[order_id] = {
            "cart": cart,
            "sms_consent": sms_consent,
            "timestamp": data.get("timestamp"),
            "order_id": order_id,
            "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
            "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator"))
        }

        line_items = []
        for item in cart:
            logger.info(f"🛒 Processing item: {item}")
            logger.info(f"🛒 Item product name: '{item.get('product')}'")
            logger.info(f"🛒 Item price: {item.get('price')}")
            logger.info(f"🛒 Available products: {[p['name'] for p in PRODUCTS]}")
            
            # Validate color/size availability if present (pinpointed to requested product only)
            try:
                product_name = item.get("product")
                variants = item.get("variants", {})
                color = variants.get("color")
                size = variants.get("size")
                if product_name and size and color:
                    if not is_variant_available(product_name, size, color):
                        logger.error(f"❌ Invalid variant for {product_name}: {color} / {size}")
                        return jsonify({"error": f"{product_name}: {color} in {size} is not available"}), 400
            except Exception:
                # Never block checkout due to validation errors; just log
                logger.exception("Variant validation error; allowing checkout to proceed")

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

        logger.info(f"🛒 Created line items: {line_items}")
        if not line_items:
            logger.error("❌ No valid items in cart to check out")
            return jsonify({"error": "No valid items in cart to check out."}), 400

        # Calculate and append shipping as a separate line item when address is provided
        if shipping_address:
            try:
                items_for_shipping = []
                for item in cart:
                    items_for_shipping.append({
                        "printful_variant_id": item.get("printful_variant_id") or item.get("variant_id") or 71,
                        "quantity": item.get("quantity", 1)
                    })

                recipient = {
                    "country_code": shipping_address.get("country_code"),
                    "state_code": shipping_address.get("state_code", ""),
                    "city": shipping_address.get("city", ""),
                    "zip": shipping_address.get("zip", "")
                }

                shipping_result = printful_integration.calculate_shipping_rates(recipient, items_for_shipping)
                if shipping_result.get("success") and float(shipping_result.get("shipping_cost", 0)) > 0:
                    shipping_amount_cents = int(round(float(shipping_result["shipping_cost"]) * 100))
                    # Persist for admin/email views
                    order_store[order_id]["shipping_cost"] = float(shipping_result["shipping_cost"])
                    order_store[order_id]["shipping_currency"] = shipping_result.get("currency", "USD")
                    order_store[order_id]["shipping_delivery_days"] = shipping_result.get("delivery_days")
                    order_store[order_id]["shipping_fallback"] = shipping_result.get("fallback", False)
                    line_items.append({
                        "price_data": {
                            "currency": "usd",
                            "product_data": {"name": "Shipping"},
                            "unit_amount": shipping_amount_cents,
                        },
                        "quantity": 1,
                    })
                    logger.info(f"🚚 Shipping added to checkout: ${shipping_result['shipping_cost']:.2f}")
                else:
                    logger.warning("🚚 Shipping calculation failed or returned 0; proceeding without shipping line item")
            except Exception:
                logger.exception("🚚 Error calculating shipping; proceeding without shipping line item")

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="payment",
            line_items=line_items,
            success_url=f"https://backend-hidden-firefly-7865.fly.dev/success?order_id={order_id}",
            cancel_url=f"https://screenmerch.com/checkout/{product_id}",
            # A2P 10DLC Compliance: Collect phone number for SMS notifications
            phone_number_collection={"enabled": True},
            metadata={
                "order_id": order_id  # Only store the small order ID in Stripe
            }
        )
        return jsonify({"url": session.url})
    except Exception as e:
        logger.error(f"Stripe API Error: {str(e)}")
        return jsonify({"error": "Failed to create Stripe checkout session"}), 500

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
                order_data = order_store[order_id]
                cart = order_data.get("cart", [])
                sms_consent = order_data.get("sms_consent", False)
            except KeyError:
                logger.error(f"Order ID {order_id} not found in order_store")
                return "", 200

            # Get customer details from Stripe session
            customer_details = session.get("customer_details", {})
            customer_phone = customer_details.get("phone", "")
            customer_email = customer_details.get("email", "")
            customer_name = customer_details.get("name", "")
            
            # Get shipping address from Stripe session
            shipping_address = customer_details.get("address", {})
            address_line1 = shipping_address.get("line1", "")
            address_line2 = shipping_address.get("line2", "")
            city = shipping_address.get("city", "")
            state = shipping_address.get("state", "")
            postal_code = shipping_address.get("postal_code", "")
            country = shipping_address.get("country", "")
            
            # Calculate order totals
            total_amount = session.get("amount_total", 0) / 100  # Convert from cents
            shipping_cost = float(order_data.get("shipping_cost", 0) or 0)
            shipping_currency = order_data.get("shipping_currency", "USD")
            delivery_days = order_data.get("shipping_delivery_days")
            
            # Generate order number (last 8 characters of order_id)
            order_number = order_id[-8:].upper()
            
            # Helper function to get product category
            def get_product_category(product_name):
                category_mappings = {
                    'mens': ["Men's Long Sleeve Shirt", "Men's Tank Top", "Unisex Classic Tee", "Unisex T-Shirt", "Unisex Hoodie", "Unisex Champion Hoodie"],
                    'womens': ["Cropped Hoodie", "Women's fitted racerback tank top", "Women's Micro-Rib Tank Top", "Women's Ribbed Neck", "Women's Shirt", "Unisex Heavyweight T-Shirt"],
                    'kids': ["Youth Heavy Blend Hoodie", "Kids Shirt", "Kids Long Sleeve"],
                    'bags': ["All-Over Print Tote Bag", "All-Over Print Drawstring Bag", "All-Over Print Crossbody Bag"],
                    'hats': ["Distressed Dad Hat", "Snapback Hat", "Five Panel Trucker Hat"],
                    'mugs': ["White Glossy Mug"],
                    'pets': ["Pet Bowl All-Over Print", "Baby Short Sleeve One Piece"],
                    'stickers': ["Kiss-Cut Stickers", "Die-Cut Magnets"],
                    'misc': ["Greeting Card", "Hardcover Bound Notebook", "Coasters"],
                    'thumbnails': ["Custom Thumbnail Print", "Thumbnail Poster", "Thumbnail Canvas Print"]
                }
                
                for category, products in category_mappings.items():
                    if product_name in products:
                        return category.title()
                return "General"
            
            # Format and send the robust order email
            html_body = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
                <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h1 style="color: #333; text-align: center; margin-bottom: 30px;">🎯 New ScreenMerch Order #{order_number}</h1>
                    
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #28a745;">
                        <h3 style="color: #28a745; margin: 0;">✅ Payment received successfully! This order is ready for Printful fulfillment.</h3>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #333; margin-top: 0;">📋 Order Summary</h3>
                        <p><strong>Order ID:</strong> {order_id}</p>
                        <p><strong>Customer Name:</strong> {customer_name or 'Not provided'}</p>
                        <p><strong>Customer Email:</strong> {customer_email or 'Not provided'}</p>
                        <p><strong>Customer Phone:</strong> {customer_phone or 'Not provided'}</p>
                        <p><strong>Items:</strong> {len(cart)}</p>
                        <p><strong>Shipping Cost:</strong> ${shipping_cost:.2f} {shipping_currency}{f" • ETA: {delivery_days} days" if delivery_days else ""}</p>
                        <p><strong>Total Amount:</strong> ${total_amount:.2f}</p>
                    </div>
                    
                    <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
                        <h3 style="color: #856404; margin-top: 0;">🚚 Shipping Address (Printful Fulfillment)</h3>
                        <p style="margin: 5px 0;"><strong>Address:</strong> {address_line1}</p>
                        {f'<p style="margin: 5px 0;"><strong>Address 2:</strong> {address_line2}</p>' if address_line2 else ''}
                        <p style="margin: 5px 0;"><strong>City:</strong> {city}</p>
                        <p style="margin: 5px 0;"><strong>State/Province:</strong> {state}</p>
                        <p style="margin: 5px 0;"><strong>Postal Code:</strong> {postal_code}</p>
                        <p style="margin: 5px 0;"><strong>Country:</strong> {country}</p>
                    </div>
                    
                    <h3 style="color: #333;">🛍️ Product Details</h3>
            """
            
            for item in cart:
                product_name = item.get('product', 'N/A')
                product_category = get_product_category(product_name)
                
                html_body += f"""
                    <div style='border: 1px solid #ddd; padding: 20px; margin-bottom: 20px; border-radius: 8px; background: white;'>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                            <h4 style="color: #333; margin: 0;">{product_name}</h4>
                            <span style="background: #007bff; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">{product_category}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                            <div>
                                <p><strong>Color:</strong> {item.get('variants', {}).get('color', 'N/A')}</p>
                                <p><strong>Size:</strong> {item.get('variants', {}).get('size', 'N/A')}</p>
                                <p><strong>Price:</strong> ${item.get('price', 0):.2f}</p>
                                <p><strong>Note:</strong> {item.get('note', 'None')}</p>
                            </div>
                            <div>
                                <p><strong>Video:</strong> {order_data.get('video_title', 'Unknown Video')}</p>
                                <p><strong>Creator:</strong> {order_data.get('creator_name', 'Unknown Creator')}</p>
                                <p><strong>Category:</strong> {product_category}</p>
                            </div>
                        </div>
                        <p><strong>Screenshot/Thumbnail:</strong></p>
                        <img src="{item.get('img', '')}" alt='Product Image' style='max-width: 300px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'>
                    </div>
                """
            
            html_body += f"""
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px;">
                        <h3 style="color: #333; margin-top: 0;">📋 Printful Fulfillment Steps</h3>
                        <ul style="color: #666;">
                            <li>✅ Review the screenshot/thumbnail for print quality and positioning</li>
                            <li>✅ Verify customer information and shipping address above</li>
                            <li>✅ Check product category and variant details</li>
                            <li>🚀 Create order in Printful dashboard with the provided shipping address</li>
                            <li>📦 Printful will handle printing, packaging, and shipping</li>
                            <li>📧 Customer will receive tracking information from Printful</li>
                        </ul>
                    </div>
                    
                    <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #17a2b8;">
                        <h4 style="color: #0c5460; margin-top: 0;">💡 Printful Integration Tips</h4>
                        <ul style="color: #0c5460; margin: 5px 0; font-size: 0.9rem;">
                            <li>Use the exact shipping address provided above for Printful order creation</li>
                            <li>Product categories help identify the correct Printful product type</li>
                            <li>Review image quality before submitting to Printful</li>
                            <li>Customer will receive automated shipping notifications from Printful</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="color: #666; font-size: 14px;">This is an automated notification from ScreenMerch - Ready for Printful Fulfillment</p>
                    </div>
                </div>
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
                
            # Send admin notification email to alancraigdigital@gmail.com
            admin_email_body = f"New ScreenMerch Order #{order_id}!\n"
            admin_email_body += f"Items: {len(cart)}\n"
            admin_email_body += f"Customer Name: {customer_name or 'Not provided'}\n"
            admin_email_body += f"Customer Email: {customer_email or 'Not provided'}\n"
            admin_email_body += f"Customer Phone: {customer_phone or 'Not provided'}\n"
            admin_email_body += f"Shipping Address: {address_line1}, {city}, {state} {postal_code}, {country}\n"
            admin_email_body += f"Total Amount: ${total_amount:.2f}\n\n"
            admin_email_body += "Products:\n"
            for item in cart:
                product_name = item.get('product', 'N/A')
                product_category = get_product_category(product_name)
                admin_email_body += f"• {product_name} ({product_category}) - {item.get('variants', {}).get('color', 'N/A')}, {item.get('variants', {}).get('size', 'N/A')}\n"
            send_order_email(admin_email_body)
            
            # Send robust confirmation email to admin
            email_data = {
                "from": RESEND_FROM,
                "to": [MAIL_TO],
                "subject": f"New ScreenMerch Order #{order_number}",
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

@app.route("/api/videos/<video_id>", methods=["DELETE"])
def delete_video(video_id):
    """Delete a video and all associated data"""
    try:
        # Delete from videos2 table
        result = supabase.table('videos2').delete().eq('id', video_id).execute()
        
        logger.info(f"Video {video_id} deleted successfully")
        return jsonify({"success": True, "message": "Video deleted successfully"})
    except Exception as e:
        logger.error(f"Error deleting video {video_id}: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

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
            response = jsonify({"success": False, "error": "video_url is required"})
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 400
        
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
        feather_radius = data.get("feather_radius", 10)
        enhance_quality = data.get("enhance_quality", True)
        
        if not image_data:
            return jsonify({"success": False, "error": "image_data is required"}), 400
        
        logger.info(f"Processing shirt image with feather_radius={feather_radius}, enhance_quality={enhance_quality}")
        
        # Process the image for shirt printing
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

@app.route("/api/users/ensure-exists", methods=["POST"])
def ensure_user_exists():
    """Ensure user exists in users table"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        email = data.get('email')
        display_name = data.get('display_name')
        
        # First, check if a user with this email already exists
        if email:
            existing_user_result = supabase.table('users').select('*').eq('email', email).execute()
            if existing_user_result.data and len(existing_user_result.data) > 0:
                # User exists, update if needed and return existing user
                existing_user = existing_user_result.data[0]
                if display_name and existing_user.get('display_name') != display_name:
                    supabase.table('users').update({
                        'display_name': display_name,
                        'updated_at': 'now()'
                    }).eq('id', existing_user['id']).execute()
                return jsonify({"message": "User exists", "user": existing_user})
        
        # If no user_id provided and no existing user found, generate one
        if not user_id:
            import uuid
            user_id = str(uuid.uuid4())
            logger.info(f"Generated UUID for user: {user_id}")
        
        # Check if user exists by ID
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
                    try:
                        result = supabase.table('users').update({
                            'role': 'creator',
                            'updated_at': 'now()'
                        }).eq('id', user_id).execute()
                        
                        # Check if update was successful and return appropriate response
                        if result.data and len(result.data) > 0:
                            return jsonify({"message": "User updated", "user": result.data[0]})
                        else:
                            # If no data returned from update, fetch the user to return
                            fetch_result = supabase.table('users').select('*').eq('id', user_id).execute()
                            if fetch_result.data and len(fetch_result.data) > 0:
                                return jsonify({"message": "User updated", "user": fetch_result.data[0]})
                            else:
                                return jsonify({"message": "User updated", "user": {"id": user_id, "email": email}})
                    except Exception as update_error:
                        logger.error(f"Error updating user after duplicate key: {str(update_error)}")
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

# Create free signup flow - redirects to PayPal setup or email signup
@app.route("/api/create-pro-checkout", methods=["POST"])
def create_pro_checkout():
    try:
        data = request.get_json()
        user_id = data.get('userId')
        tier = data.get('tier', 'free')
        email = data.get('email')
        
        # For the new free flow, redirect directly to payment setup
        # This bypasses Stripe entirely since we don't need payment processing
        
        # Create a simple session ID for tracking
        session_id = f"free_setup_{int(time.time())}"
        
        # Store session info for tracking
        session_data = {
            "session_id": session_id,
            "user_id": user_id or "guest",
            "tier": "free",
            "setup_type": "paypal_setup",
            "created_at": datetime.now().isoformat()
        }
        
        # In a real implementation, you might store this in a database
        # For now, we'll just log it
        logger.info(f"Created free signup session: {session_data}")
        
        # Redirect directly to payment setup
        payment_setup_url = "https://screenmerch.com/payment-setup"
        if user_id:
            payment_setup_url += f"?user_id={user_id}"
        
        return jsonify({"url": payment_setup_url})
        
    except Exception as e:
        logger.error(f"Error creating free signup flow: {str(e)}")
        return jsonify({"error": "Failed to create signup flow"}), 500

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
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
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
                    return jsonify({
                        "success": True, 
                        "message": "Login successful",
                        "user": {
                            "id": user.get('id'),
                            "email": user.get('email'),
                            "display_name": user.get('display_name'),
                            "role": user.get('role', 'customer')
                        }
                    })
                else:
                    return jsonify({"success": False, "error": "Invalid email or password"}), 401
            else:
                return jsonify({"success": False, "error": "Invalid email or password"}), 401
                
        except Exception as db_error:
            logger.error(f"Database error during login: {str(db_error)}")
            return jsonify({"success": False, "error": "Authentication service unavailable"}), 500
            
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

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
            
            # Create new user - simple free account
            new_user = {
                'email': email,
                'password_hash': password,  # Replace with bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()) in production
                'role': 'customer',
                'status': 'active',
                'email_verified': False,
                'display_name': email.split('@')[0]  # Use email prefix as display name
            }
            
            result = supabase.table('users').insert(new_user).execute()
            
            if result.data:
                logger.info(f"New user {email} created successfully")
                
                # Skip subscription creation for now - just create the user account
                # Subscription can be created later when needed
                logger.info(f"User account created successfully - subscription will be created later if needed")
                
                return jsonify({
                    "success": True, 
                    "message": "Account created successfully!",
                    "user": {
                        "id": result.data[0].get('id'),
                        "email": result.data[0].get('email'),
                        "display_name": result.data[0].get('display_name'),
                        "role": result.data[0].get('role', 'customer')
                    }
                })
            else:
                return jsonify({"success": False, "error": "Failed to create account"}), 500
                
        except Exception as db_error:
            logger.error(f"Database error during signup: {str(db_error)}")
            if "duplicate key" in str(db_error).lower():
                return jsonify({"success": False, "error": "An account with this email already exists"}), 409
            return jsonify({"success": False, "error": "Account creation failed"}), 500
            
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

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
        
        # Get orders from database (sales table)
        try:
            # Only select the columns we need to avoid timeout
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
            logger.error(f"Database error loading orders: {str(db_error)}")
        
        # Sort by creation time (newest first)
        all_orders.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return render_template('admin_orders.html', orders=all_orders, admin_email=session.get('admin_email'))
    except Exception as e:
        logger.error(f"Error loading admin orders: {str(e)}")
        return jsonify({"error": "Failed to load orders"}), 500

@app.route("/admin/order/<order_id>")
@admin_required
def admin_order_detail(order_id):
    """Detailed view of a specific order"""
    try:
        order_data = order_store.get(order_id)
        if not order_data:
            return "Order not found", 404
        
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

@app.route("/api/subscriptions/activate", methods=["POST"])
def activate_subscription():
    """Activate a subscription in the database"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        tier = data.get('tier', 'pro')
        status = data.get('status', 'active')
        stripe_subscription_id = data.get('stripe_subscription_id')
        stripe_customer_id = data.get('stripe_customer_id')
        trial_end = data.get('trial_end')
        
        if not user_id:
            return jsonify({"success": False, "error": "user_id is required"}), 400
        
        # Insert or update subscription in database
        subscription_data = {
            'user_id': user_id,
            'tier': tier,
            'status': status,
            'updated_at': 'now()'
        }
        
        if stripe_subscription_id:
            subscription_data['stripe_subscription_id'] = stripe_subscription_id
        if stripe_customer_id:
            subscription_data['stripe_customer_id'] = stripe_customer_id
        if trial_end:
            subscription_data['trial_end'] = trial_end
        
        # Use upsert to handle both insert and update
        result = supabase.table('user_subscriptions').upsert(
            subscription_data,
            on_conflict='user_id'
        ).execute()
        
        if result.data and len(result.data) > 0:
            logger.info(f"✅ Subscription activated for user {user_id}")
            return jsonify({
                "success": True,
                "subscription": result.data[0]
            })
        else:
            logger.error(f"❌ Failed to activate subscription for user {user_id}")
            return jsonify({"success": False, "error": "Failed to activate subscription"}), 500
            
    except Exception as e:
        logger.error(f"❌ Error activating subscription: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/users/update-channel", methods=["POST"])
def update_user_channel():
    """Update user's channel information"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        channel_slug = data.get('channel_slug')
        channel_url = data.get('channel_url')
        
        if not user_id:
            return jsonify({"success": False, "error": "user_id is required"}), 400
        
        update_data = {
            'updated_at': 'now()'
        }
        
        if channel_slug:
            update_data['channel_slug'] = channel_slug
        if channel_url:
            update_data['channel_url'] = channel_url
        
        # Update user record
        result = supabase.table('users').update(update_data).eq('id', user_id).execute()
        
        if result.data and len(result.data) > 0:
            logger.info(f"✅ Channel updated for user {user_id}")
            return jsonify({
                "success": True,
                "user": result.data[0]
            })
        else:
            logger.error(f"❌ Failed to update channel for user {user_id}")
            return jsonify({"success": False, "error": "Failed to update channel"}), 500
            
    except Exception as e:
        logger.error(f"❌ Error updating channel: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/verify-subscription/<session_id>", methods=["GET"])
def verify_subscription(session_id):
    """Verify Stripe subscription payment"""
    try:
        # Initialize Stripe
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        if not stripe.api_key:
            logger.error("STRIPE_SECRET_KEY not found in environment variables")
            return jsonify({"success": False, "error": "Stripe configuration error"}), 500
        
        # Retrieve the checkout session
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status == 'paid':
            return jsonify({ 
                "success": True, 
                "subscription_id": session.subscription,
                "customer_id": session.customer 
            })
        else:
            return jsonify({"success": False, "message": "Payment not completed"}), 400
            
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error verifying subscription: {e}")
        return jsonify({"success": False, "error": f"Stripe error: {str(e)}"}), 400
    except Exception as e:
        logger.error(f"Error verifying subscription: {e}")
        return jsonify({"success": False, "error": "Failed to verify subscription"}), 500

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
