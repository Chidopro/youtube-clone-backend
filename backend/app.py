from flask import Flask, request, jsonify, render_template, send_from_directory
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

# Configure CORS for production
CORS(app, resources={r"/api/*": {"origins": [
    "chrome-extension://*",
    "https://screenmerch.com",
    "https://www.screenmerch.com"
]}})

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
        "name": "Soft Tee",
        "price": 24.99,
        "filename": "guidontee.png",
        "main_image": "guidontee.png",
        "options": {"color": ["Black", "White", "Gray"], "size": ["S", "M", "L", "XL"]}
    },
    {
        "name": "Unisex Classic Tee",
        "price": 24.99,
        "filename": "unisexclassicteepreview.png",
        "main_image": "unisexclassictee.png",
        "options": {"color": ["Black", "White", "Gray", "Navy"], "size": ["S", "M", "L", "XL"]}
    },
    {
        "name": "Men's Tank Top",
        "price": 19.99,
        "filename": "randompreview.png",
        "main_image": "random.png",
        "options": {"color": ["Black", "White", "Gray"], "size": ["S", "M", "L", "XL"]}
    },
    {
        "name": "Unisex Hoodie",
        "price": 22.99,
        "filename": "testedpreview.png",
        "main_image": "tested.png",
        "options": {"color": ["Black", "White"], "size": ["S", "M", "L"]}
    },
    {
        "name": "Cropped Hoodie",
        "price": 39.99,
        "filename": "croppedhoodiepreview.png",
        "main_image": "croppedhoodie.png",
        "options": {"color": ["Black", "Gray", "Navy"], "size": ["S", "M", "L", "XL"]}
    },
    {
        "name": "Unisex Champion Hoodie",
        "price": 29.99,
        "filename": "hoodiechampionpreview.jpg",
        "main_image": "hoodiechampion.png",
        "options": {"color": ["Black", "Gray"], "size": ["13 inch", "15 inch"]}
    },
    {
        "name": "Women's Ribbed Neck",
        "price": 25.99,
        "filename": "womensribbedneckpreview.jpg",
        "main_image": "womensribbedneck.png",
        "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["S", "M", "L", "XL"]}
    },
    {
        "name": "Women's Shirt",
        "price": 26.99,
        "filename": "womensshirtkevin.png",
        "main_image": "womensshirt.png",
        "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["S", "M", "L", "XL"]}
    },
    {
        "name": "Women's HD Shirt",
        "price": 28.99,
        "filename": "womenshdshirtpreview.png",
        "main_image": "womenshdshirt.png",
        "options": {"color": ["Black", "White", "Gray", "Navy"], "size": ["S", "M", "L", "XL"]}
    },
    {
        "name": "Kids Shirt",
        "price": 19.99,
        "filename": "kidshirtpreview.jpg",
        "main_image": "kidshirt.png",
        "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["XS", "S", "M", "L"]}
    },
    {
        "name": "Kids Hoodie",
        "price": 29.99,
        "filename": "kidhoodiepreview.jpg",
        "main_image": "kidhoodie.png",
        "options": {"color": ["Black", "White", "Gray", "Navy"], "size": ["XS", "S", "M", "L"]}
    },
    {
        "name": "Kids Long Sleeve",
        "price": 24.99,
        "filename": "kidlongsleevepreview.jpg",
        "main_image": "kidlongsleeve.png",
        "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["XS", "S", "M", "L"]}
    },
    {
        "name": "Canvas Tote",
        "price": 18.99,
        "filename": "allovertotebagpreview.png",
        "main_image": "allovertotebag.png",
        "options": {"color": ["Natural", "Black"], "size": []}
    },
    {
        "name": "Tote Bag",
        "price": 21.99,
        "filename": "drawstringbagpreview.png",
        "main_image": "drawstringbag.png",
        "options": {"color": ["White", "Black", "Blue"], "size": []}
    },
    {
        "name": "Large Canvas Bag",
        "price": 24.99,
        "filename": "largecanvasbagpreview.png",
        "main_image": "largecanvasbag.png",
        "options": {"color": ["Natural", "Black", "Navy"], "size": []}
    },
    {
        "name": "Greeting Card",
        "price": 22.99,
        "filename": "greetingcardpreview.png",
        "main_image": "greetingcard.png",
        "options": {"color": ["White", "Cream"], "size": []}
    },
    {
        "name": "Notebook",
        "price": 14.99,
        "filename": "hardcovernotebookpreview.png",
        "main_image": "hardcovernotebook.png",
        "options": {"color": ["Black", "Blue"], "size": []}
    },
    {
        "name": "Coasters",
        "price": 13.99,
        "filename": "coasterpreview.jpg",
        "main_image": "coaster.png",
        "options": {"color": ["Wood", "Cork", "Black"], "size": []}
    },
    {
        "name": "Sticker Pack",
        "price": 8.99,
        "filename": "stickerspreview.png",
        "main_image": "stickers.png",
        "options": {"color": [], "size": []}
    },
    {
        "name": "Dog Bowl",
        "price": 12.99,
        "filename": "dogbowlpreview.png",
        "main_image": "dogbowl.png",
        "options": {"color": [], "size": []}
    },
    {
        "name": "Magnet Set",
        "price": 11.99,
        "filename": "magnetpreview.png",
        "main_image": "magnet.png",
        "options": {"color": [], "size": []}
    },
    {
        "name": "Men's Long Sleeve",
        "price": 29.99,
        "filename": "menslongsleevepreview.jpg",
        "main_image": "menslongsleeve.png",
        "options": {"color": ["Black", "White", "Gray"], "size": ["S", "M", "L", "XL"]}
    },
    {
        "name": "Women's Tank",
        "price": 22.99,
        "filename": "womenstankpreview.jpg",
        "main_image": "womenstank.png",
        "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["S", "M", "L", "XL"]}
    },
    {
        "name": "Women's Tee",
        "price": 23.99,
        "filename": "womensteepreview.jpg",
        "main_image": "womenstee.png",
        "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["S", "M", "L", "XL"]}
    },
    {
        "name": "Distressed Dad Hat",
        "price": 24.99,
        "filename": "distresseddadhatpreview.jpg",
        "main_image": "distresseddadhat.jpg",
        "options": {"color": ["Black", "Navy", "Gray"], "size": ["One Size"]}
    },
    {
        "name": "Snapback Hat",
        "price": 25.99,
        "filename": "snapbackhatpreview.png",
        "main_image": "snapbackhat.png",
        "options": {"color": ["Black", "White", "Navy", "Gray"], "size": ["One Size"]}
    },
    {
        "name": "Five Panel Trucker Hat",
        "price": 26.99,
        "filename": "fivepaneltruckerhatpreview.jpg",
        "main_image": "fivepaneltruckerhat.png",
        "options": {"color": ["Black", "White", "Navy"], "size": ["One Size"]}
    },
    {
        "name": "Flat Bill Cap",
        "price": 24.99,
        "filename": "flatbillcappreview.png",
        "main_image": "flatbillcap.png",
        "options": {"color": ["Black", "White", "Navy", "Gray"], "size": ["One Size"]}
    },
    {
        "name": "Crossbody Bag",
        "price": 32.99,
        "filename": "crossbodybagpreview.png",
        "main_image": "crossbodybag.png",
        "options": {"color": ["Black", "Brown", "Tan"], "size": []}
    },
    {
        "name": "Baby Bib",
        "price": 16.99,
        "filename": "babybibpreview.jpg",
        "main_image": "babybib.png",
        "options": {"color": ["White", "Pink", "Blue"], "size": []}
    }
]

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
    if request.method == "OPTIONS":
        return jsonify(success=True)

    try:
        data = request.get_json()
        if not data:
            return jsonify(success=False, error="No data received"), 400

        product_id = str(uuid.uuid4())
        thumbnail = data.get("thumbnail", "")
        video_url = data.get("videoUrl", "")
        screenshots = data.get("screenshots", [])

        logger.info(f"✅ Creating product {product_id}")
        logger.info(f"  Video URL: {video_url}")
        logger.info(f"  Thumbnail present: {'Yes' if thumbnail else 'No'}")
        logger.info(f"  Screenshots: {len(screenshots)}")

        # Try to save to Supabase first
        try:
            supabase.table("products").insert({
                "name": f"Custom Merch - {product_id[:8]}",  # Required field
                "price": 24.99,  # Required field - default price
                "description": f"Custom merchandise from video",  # Optional but good to have
                "product_id": product_id,
                "thumbnail_url": thumbnail,
                "video_url": video_url,
                "screenshots_urls": json.dumps(screenshots),
                "category": "Custom Merch"
            }).execute()
            logger.info(f"✅ Successfully saved to Supabase database")
        except Exception as db_error:
            logger.error(f"❌ Database error: {str(db_error)}")
            logger.info("🔄 Falling back to in-memory storage")
            
            # Fallback to in-memory storage
            product_data_store[product_id] = {
                "thumbnail": thumbnail,
                "screenshots": screenshots,
                "video_url": video_url,
                "created_at": "now"
            }

        return jsonify({
            "success": True,
            "product_id": product_id,
            "product_url": f"https://backend-hidden-firefly-7865.fly.dev/product/{product_id}"
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
                
                logger.info(f"🎨 Rendering template with data:")
                logger.info(f"   img_url: {product_data.get('thumbnail_url', 'None')}")
                logger.info(f"   screenshots: {len(screenshots)} items")
                logger.info(f"   products: {len(PRODUCTS)} items")
                logger.info(f"   product_id: {product_id}")
                
                try:
                    return render_template(
                        'product_page.html',
                        img_url=product_data.get('thumbnail_url'),
                        screenshots=screenshots,
                        products=PRODUCTS,
                        product_id=product_id,
                        email='',
                        channel_id=''
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
            return render_template(
                'product_page.html',
                img_url=product_data.get('thumbnail'),
                screenshots=product_data.get('screenshots', []),
                products=PRODUCTS,
                product_id=product_id,
                email='',
                channel_id=''
            )
        else:
            logger.warning(f"⚠️ Product not found in memory storage either")
            
    except Exception as e:
        logger.error(f"❌ Error in show_product_page for {product_id}: {str(e)}")
        logger.error(f"❌ Error type: {type(e).__name__}")
        logger.error(f"❌ Full error details: {repr(e)}")

    logger.error(f"❌ Returning 'Product not found' for ID: {product_id}")
    return "Product not found", 404

@app.route("/checkout/<product_id>")
def checkout_page(product_id):
    return render_template('checkout.html', product_id=product_id)

@app.route("/privacy-policy")
def privacy_policy():
    return render_template('privacy-policy.html')

@app.route("/terms-of-service")
def terms_of_service():
    return render_template('terms-of-service.html')

def record_sale(item, user_id=None, friend_id=None, channel_id=None):
    sale_data = {
        "user_id": user_id,
        "product_id": item.get('product_id', ''),
        "product_name": item.get('product', ''),
        "video_id": item.get('video_id', ''),
        "video_title": item.get('video_title', ''),
        "image_url": item.get('img', ''),
        "amount": item.get('price', 0),
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
        # Record each sale
        for item in cart:
            record_sale(item)
        # --- Send Email with Resend ---
        email_data = {
            "from": RESEND_FROM,
            "to": [MAIL_TO],
            "subject": f"New Order Received: {len(cart)} Item(s)",
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
            
            # Format and send the order email
            html_body = f"<h1>New Paid ScreenMerch Order #{order_number}</h1>"
            html_body += f"<p><strong>Order ID:</strong> {order_id}</p>"
            html_body += f"<p><strong>Items:</strong> {len(cart)}</p>"
            
            for item in cart:
                # Debug: Log the image URL
                img_url = item.get('img', '')
                logger.info(f"📸 Product: {item.get('product')} - Image URL: {img_url[:100]}...")
                
                # Skip base64 images - they're too large for email
                if img_url and img_url.startswith('data:image'):
                    logger.info(f"⚠️ Skipping base64 image for {item.get('product')} - too large for email")
                    img_html = "<p><em>Image selected (not shown in email due to size)</em></p>"
                else:
                    # Make sure image URL is absolute
                    if img_url and not img_url.startswith('http'):
                        img_url = f"https://backend-hidden-firefly-7865.fly.dev{img_url}"
                        logger.info(f"🔗 Converted to absolute URL: {img_url}")
                    
                    if img_url:
                        img_html = f'<img src="{img_url}" alt="Product Image" style="max-width: 300px; border-radius: 6px; border: 2px solid #ddd;">'
                    else:
                        img_html = "<p><em>No image available</em></p>"
                
                html_body += f"""
                    <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                        <h2>{item.get('product', 'N/A')}</h2>
                        <p><strong>Color:</strong> {item.get('variants', {}).get('color', 'N/A')}</p>
                        <p><strong>Size:</strong> {item.get('variants', {}).get('size', 'N/A')}</p>
                        <p><strong>Note:</strong> {item.get('note', 'None')}</p>
                        <p><strong>Selected Image:</strong></p>
                        {img_html}
                    </div>
                """
            
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
                # Remove from order_store to prevent duplicate emails
                del order_store[order_id]
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

        if not cart:
            return jsonify({"error": "Cart is empty"}), 400

        # Email notifications - SMS consent not required
        # sms_consent is kept for backward compatibility but not enforced

        # Generate a unique order ID and store the full cart (with images) and SMS consent
        order_id = str(uuid.uuid4())
        order_store[order_id] = {
            "cart": cart,
            "sms_consent": sms_consent,
            "timestamp": data.get("timestamp"),
            "order_id": order_id
        }

        line_items = []
        for item in cart:
            product_info = next((p for p in PRODUCTS if p["name"] == item.get("product")), None)
            if not product_info:
                logger.error(f"Could not find price for product: {item.get('product')}")
                continue
            line_items.append({
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": item.get("product"),
                    },
                    "unit_amount": int(product_info["price"] * 100),
                },
                "quantity": 1,
            })

        if not line_items:
            return jsonify({"error": "No valid items in cart to check out."}), 400

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

            # Get customer phone number from Stripe session
            customer_phone = session.get("customer_details", {}).get("phone", "")
            
            # Format and send the order email
            html_body = f"<h1>New Paid ScreenMerch Order #{order_id}</h1>"
            html_body += f"<p><strong>SMS Consent:</strong> {'Yes' if sms_consent else 'No'}</p>"
            html_body += f"<p><strong>Customer Phone:</strong> {customer_phone}</p>"
            
            for item in cart:
                html_body += f"""
                    <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                        <h2>{item.get('product', 'N/A')}</h2>
                        <p><strong>Color:</strong> {item.get('variants', {}).get('color', 'N/A')}</p>
                        <p><strong>Size:</strong> {item.get('variants', {}).get('size', 'N/A')}</p>
                        <p><strong>Note:</strong> {item.get('note', 'None')}</p>
                        <p><strong>Image:</strong></p>
                        <img src="{item.get('img', '')}" alt='Product Image' style='max-width: 300px; border-radius: 6px;'>
                    </div>
                """
            
            # Record each sale
            for item in cart:
                record_sale(item)
                
            # Email notifications only - no SMS
            logger.info("📧 Order notifications will be sent via email")
                
            # Send admin notification email
            admin_email_body = f"New ScreenMerch Order #{order_id}!\n"
            admin_email_body += f"Items: {len(cart)}\n"
            admin_email_body += f"Customer Phone: {customer_phone}\n"
            for item in cart:
                admin_email_body += f"• {item.get('product', 'N/A')} ({item.get('variants', {}).get('color', 'N/A')}, {item.get('variants', {}).get('size', 'N/A')})\n"
            send_order_email(admin_email_body)
            
            # Send email using Resend
            email_data = {
                "from": RESEND_FROM,
                "to": [MAIL_TO],
                "subject": f"New Paid Order #{order_id}: {len(cart)} Item(s)",
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

# NEW: Video Screenshot Capture Endpoints
@app.route("/api/capture-screenshot", methods=["POST", "OPTIONS"])
def capture_screenshot():
    if request.method == "OPTIONS":
        return jsonify(success=True)
    """Capture a single screenshot from a video at a specific timestamp"""
    try:
        data = request.get_json()
        video_url = data.get('video_url')
        timestamp = data.get('timestamp', 0)
        quality = data.get('quality', 85)
        
        if not video_url:
            return jsonify({"success": False, "error": "video_url is required"}), 400
        
        logger.info(f"Capturing screenshot from {video_url} at timestamp {timestamp}")
        
        result = screenshot_capture.capture_screenshot(video_url, timestamp, quality)
        
        if result['success']:
            logger.info("Screenshot captured successfully")
            return jsonify(result)
        else:
            logger.error(f"Screenshot capture failed: {result['error']}")
            return jsonify(result), 500
            
    except Exception as e:
        logger.error(f"Error in capture_screenshot: {str(e)}")
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500

@app.route("/api/capture-multiple-screenshots", methods=["POST"])
def capture_multiple_screenshots():
    """Capture multiple screenshots from a video at different timestamps"""
    try:
        data = request.get_json()
        video_url = data.get('video_url')
        timestamps = data.get('timestamps', [0, 2, 4, 6, 8])
        quality = data.get('quality', 85)
        
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

@app.route("/api/video-info", methods=["POST"])
def get_video_info():
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

@app.route("/api/users/ensure-exists", methods=["POST"])
def ensure_user_exists():
    """Ensure user exists in users table"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        email = data.get('email')
        display_name = data.get('display_name')
        
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        
        # Check if user exists
        result = supabase.table('users').select('*').eq('id', user_id).execute()
        
        if result.data:
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
                return jsonify({"message": "User created", "user": result.data[0]})
            except Exception as insert_error:
                # If insert fails due to duplicate key, try to update existing user
                if "duplicate key" in str(insert_error).lower():
                    logger.info(f"Duplicate key detected for user {user_id}, updating existing user")
                    result = supabase.table('users').update({
                        'role': 'creator',
                        'updated_at': 'now()'
                    }).eq('id', user_id).execute()
                    return jsonify({"message": "User updated", "user": result.data[0]})
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
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": "ScreenMerch Pro Plan",
                        "description": "Creator Pro Plan with 7-day free trial - You will be charged $9.99/month after the trial period"
                    },
                    "unit_amount": 999,  # $9.99 in cents
                    "recurring": {
                        "interval": "month"
                    }
                },
                "quantity": 1,
            }],
            subscription_data={
                "trial_period_days": 7,
                "metadata": {
                    "user_id": user_id or "guest",
                    "tier": tier
                }
            },
            success_url="https://screenmerch.com/subscription-success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url="https://screenmerch.com/subscription-tiers",
            customer_email=email,  # Pre-fill email if available
            metadata={
                "user_id": user_id or "guest",
                "tier": tier
            }
        )
        
        logger.info(f"Created Pro checkout session for user {user_id or 'guest'}")
        return jsonify({"url": session.url})
        
    except Exception as e:
        logger.error(f"Error creating checkout session: {str(e)}")
        return jsonify({"error": f"Failed to create checkout session: {str(e)}"}), 500

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

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
