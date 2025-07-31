from flask import Flask, request, jsonify, render_template
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
from twilio.rest import Client
from pathlib import Path
import sys

# NEW: Import Printful integration
from printful_integration import ScreenMerchPrintfulIntegration

# NEW: Import video screenshot capture
from video_screenshot import screenshot_capture

# NEW: Import image text overlay
from image_text_overlay import ImageTextOverlay

# NEW: Import security manager
from security_config import security_manager, SECURITY_HEADERS, validate_file_upload

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize image text overlay service
image_text_overlay = ImageTextOverlay()

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
    print("WARNING: Missing Supabase environment variables. Some features may not work.")
    print("Continuing with dummy values for development...")
    supabase_url = "https://dummy.supabase.co"
    supabase_key = "dummy_key"

# Twilio setup
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
ADMIN_PHONE_NUMBER = os.getenv("YOUR_PHONE_NUMBER")

# Debug: Print Twilio credentials status
print(f"TWILIO_ACCOUNT_SID: {'✓' if TWILIO_ACCOUNT_SID else '✗'}")
print(f"TWILIO_AUTH_TOKEN: {'✓' if TWILIO_AUTH_TOKEN else '✗'}")
print(f"TWILIO_PHONE_NUMBER: {'✓' if TWILIO_PHONE_NUMBER else '✗'}")
print(f"ADMIN_PHONE_NUMBER: {'✓' if ADMIN_PHONE_NUMBER else '✗'}")

def send_order_sms(order_details):
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER and ADMIN_PHONE_NUMBER):
        print("Twilio credentials not set. SMS not sent.")
        return
    
    print(f"📱 Attempting to send SMS...")
    print(f"  From: {TWILIO_PHONE_NUMBER}")
    print(f"  To: {ADMIN_PHONE_NUMBER}")
    print(f"  Message length: {len(order_details)} characters")
    
    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            body=order_details,
            from_=TWILIO_PHONE_NUMBER,
            to=ADMIN_PHONE_NUMBER
        )
        print(f"✅ SMS sent successfully!")
        print(f"  Message SID: {message.sid}")
        print(f"  Status: {message.status}")
        print(f"  Direction: {message.direction}")
    except Exception as e:
        print(f"❌ Error sending SMS:")
        print(f"  Error type: {type(e).__name__}")
        print(f"  Error message: {str(e)}")
        
        # Check if it's a Twilio-specific error
        if hasattr(e, 'code'):
            print(f"  Twilio error code: {e.code}")
        if hasattr(e, 'status'):
            print(f"  HTTP status: {e.status}")
        if hasattr(e, 'uri'):
            print(f"  Error URI: {e.uri}")
        if hasattr(e, 'msg'):
            print(f"  Detailed message: {e.msg}")
            
        # Print the full error details for debugging
        print(f"  Full error details: {repr(e)}")

def send_customer_sms(phone_number, message_type, order_id=None, tracking_number=None):
    """Send SMS to customer with A2P 10DLC compliant messages"""
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER):
        print("Twilio credentials not set. Customer SMS not sent.")
        return
    
    # A2P 10DLC Compliant message templates
    messages = {
        'opt_in': "Welcome to ScreenMerch SMS notifications! You'll receive order updates and customer service messages. Reply STOP to opt-out, HELP for support. Message & data rates may apply. Frequency varies.",
        'order_confirmation': f"ScreenMerch: Your order #{order_id} has been confirmed! We're preparing your custom merchandise. You'll receive shipping updates here. Reply STOP to opt-out.",
        'order_processing': f"ScreenMerch: Good news! Your order #{order_id} is now in production. Estimated completion: 3-5 business days. Track progress at screenmerch.com/orders",
        'shipped': f"ScreenMerch: Your order #{order_id} has shipped! Tracking: {tracking_number}. Thanks for choosing ScreenMerch! Reply STOP to opt-out.",
        'help': "ScreenMerch Help: For support visit screenmerch.com or email support@screenmerch.com. Reply STOP to opt-out. Msg & data rates may apply. Reply START to restart getting messages from ScreenMerch.",
        'stop': "You have successfully unsubscribed from ScreenMerch SMS notifications. No further messages will be sent. Reply START to opt back in to communication with ScreenMerch."
    }
    
    message_body = messages.get(message_type, "ScreenMerch: Thank you for your order! Reply STOP to opt-out.")
    
    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            body=message_body,
            from_=TWILIO_PHONE_NUMBER,
            to=phone_number
        )
        print(f"✅ Customer SMS sent successfully!")
        print(f"  Type: {message_type}")
        print(f"  To: {phone_number}")
        print(f"  Message SID: {message.sid}")
        return message.sid
    except Exception as e:
        print(f"❌ Error sending customer SMS:")
        print(f"  Type: {message_type}")
        print(f"  To: {phone_number}")
        print(f"  Error: {str(e)}")
        return None

app = Flask(__name__, 
           template_folder='templates',
           static_folder='static')

# Configure CORS for production - allow all origins for now
CORS(app, resources={r"/api/*": {"origins": "*"}})

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

@app.route("/api/health")
def health():
    """Health check endpoint for debugging"""
    return jsonify({
        "status": "healthy",
        "timestamp": "now",
        "endpoints": {
            "create_product": "/api/create-product",
            "capture_screenshot": "/api/capture-screenshot",
            "ping": "/api/ping"
        }
    })

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
    {
        "name": "Soft Tee",
        "price": 24.99,
        "filename": "guidonteepreview.png",
        "main_image": "guidontee.png",
        "options": {"color": ["Black", "White", "Gray"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}
    },
    {
        "name": "Unisex Classic Tee",
        "price": 24.99,
        "filename": "unisexclassicteepreview.png",
        "main_image": "unisexclassictee.png",
        "options": {"color": ["Black", "White", "Gray", "Navy"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}
    },
    {
        "name": "Men's Tank Top",
        "price": 19.99,
        "filename": "randompreview.png",
        "main_image": "random.png",
        "options": {"color": ["Black", "White", "Gray"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}
    },
    {
        "name": "Unisex Hoodie",
        "price": 22.99,
        "filename": "testedpreview.png",
        "main_image": "tested.png",
        "options": {"color": ["Black", "White"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}
    },
    {
        "name": "Cropped Hoodie",
        "price": 39.99,
        "filename": "croppedhoodiepreview.png",
        "main_image": "croppedhoodie.png",
        "options": {"color": ["Black", "Gray", "Navy"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}
    },
    {
        "name": "Unisex Champion Hoodie",
        "price": 29.99,
        "filename": "hoodiechampionpreview.jpg",
        "main_image": "hoodiechampion.png",
        "options": {"color": ["Black", "Gray"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}
    },
    {
        "name": "Women's Ribbed Neck",
        "price": 25.99,
        "filename": "womensribbedneckpreview.jpg",
        "main_image": "womensribbedneck.png",
        "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}
    },
    {
        "name": "Women's Shirt",
        "price": 26.99,
        "filename": "womensshirtkevin.png",
        "main_image": "womensshirt.png",
        "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}
    },
    {
        "name": "Women's HD Shirt",
        "price": 28.99,
        "filename": "womenshdshirtpreview.png",
        "main_image": "womenshdshirt.png",
        "options": {"color": ["Black", "White", "Gray", "Navy"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}
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
        "options": {"color": ["Black", "White", "Gray"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}
    },
    {
        "name": "Women's Tank",
        "price": 22.99,
        "filename": "womenstankpreview.jpg",
        "main_image": "womenstank.png",
        "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}
    },
    {
        "name": "Women's Tee",
        "price": 23.99,
        "filename": "womensteepreview.jpg",
        "main_image": "womenstee.png",
        "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}
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

@app.route("/text-overlay-demo")
def text_overlay_demo():
    """Demo page for image text overlay functionality"""
    return render_template("text_overlay_demo.html")

@app.route("/api/create-product", methods=["POST", "OPTIONS"])
def create_product():
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response

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

        response = jsonify({
            "success": True,
            "product_id": product_id,
            "product_url": f"https://backend-hidden-firefly-7865.fly.dev/product/{product_id}"
        })
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response
    except Exception as e:
        logger.error(f"❌ Error in create-product: {str(e)}")
        logger.error(f"❌ Error type: {type(e).__name__}")
        logger.error(f"❌ Full error details: {repr(e)}")
        response = jsonify(success=False, error="Internal server error"), 500
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response

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
        send_order_sms(sms_body)

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
            html_body += f"<p><strong>Payment Status:</strong> ✅ Completed</p>"
            html_body += f"<p><strong>Email Sent Via:</strong> Success Page (Webhook Fallback)</p>"
            
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

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        logger.info(f"Payment received for session: {session.get('id')}")
        
        # Check if this is a subscription or one-time payment
        if session.get("mode") == "subscription":
            # Handle subscription creation
            user_id = session.get("metadata", {}).get("user_id")
            tier = session.get("metadata", {}).get("tier", "pro")
            
            if user_id:
                try:
                    # Update user subscription in database
                    subscription_data = {
                        "user_id": user_id,
                        "tier": tier,
                        "status": "active",
                        "stripe_subscription_id": session.get("subscription"),
                        "trial_end": None,  # Will be set by Stripe
                        "updated_at": "now()"
                    }
                    
                    # Upsert subscription data
                    result = supabase.table('user_subscriptions').upsert(
                        subscription_data,
                        on_conflict='user_id'
                    ).execute()
                    
                    logger.info(f"Subscription created for user {user_id}: {result.data}")
                    
                    # Send welcome email for subscription
                    customer_email = session.get("customer_details", {}).get("email")
                    if customer_email:
                        try:
                            resend.emails.send({
                                "from": "ScreenMerch <noreply@screenmerch.com>",
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
                            })
                            logger.info(f"Welcome email sent to {customer_email}")
                        except Exception as email_error:
                            logger.error(f"Failed to send welcome email: {email_error}")
                    
                except Exception as sub_error:
                    logger.error(f"Error creating subscription: {sub_error}")
            else:
                logger.error("User ID not found in subscription metadata")
        else:
            # Handle one-time payment (existing order logic)
            order_id = session.get("metadata", {}).get("order_id")
            if not order_id:
                logger.error("Order ID not found in session metadata")
                return "", 200

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
        shipping_line1 = shipping_address.get("line1", "")
        shipping_line2 = shipping_address.get("line2", "")
        shipping_city = shipping_address.get("city", "")
        shipping_state = shipping_address.get("state", "")
        shipping_postal_code = shipping_address.get("postal_code", "")
        shipping_country = shipping_address.get("country", "")
        
        # Format complete shipping address
        shipping_address_formatted = f"{shipping_line1}"
        if shipping_line2:
            shipping_address_formatted += f"<br>{shipping_line2}"
        shipping_address_formatted += f"<br>{shipping_city}, {shipping_state} {shipping_postal_code}"
        shipping_address_formatted += f"<br>{shipping_country}"
        
        # Format and send the order email
        html_body = f"<h1>New Paid ScreenMerch Order #{order_id}</h1>"
        html_body += f"<p><strong>Order ID:</strong> {order_id}</p>"
        html_body += f"<p><strong>Items:</strong> {len(cart)}</p>"
        html_body += f"<p><strong>Customer Name:</strong> {customer_name}</p>"
        html_body += f"<p><strong>Customer Email:</strong> {customer_email}</p>"
        html_body += f"<p><strong>Customer Phone:</strong> {customer_phone}</p>"
        html_body += f"<p><strong>Shipping Address:</strong><br>{shipping_address_formatted}</p>"
        html_body += f"<p><strong>SMS Consent:</strong> {'Yes' if sms_consent else 'No'}</p>"
        
        for item in cart:
            # Enhanced image information display
            image_info = ""
            video_name = item.get('videoName', 'N/A')
            
            # Check if this item has screenshots (detailed selection)
            if item.get('screenshots') and len(item.get('screenshots', [])) > 0:
                image_info += f"<p><strong>📸 Screenshot Selection:</strong></p>"
                image_info += f"<p><strong>Video:</strong> {video_name}</p>"
                
                for i, screenshot in enumerate(item.get('screenshots', []), 1):
                    timestamp = screenshot.get('timestamp', 'N/A')
                    # Format timestamp if it's a number
                    if isinstance(timestamp, (int, float)):
                        minutes = int(timestamp // 60)
                        seconds = int(timestamp % 60)
                        formatted_time = f"{minutes:02d}:{seconds:02d}"
                    else:
                        formatted_time = str(timestamp)
                    
                    image_info += f"""
                        <div style='border: 1px solid #eee; padding: 10px; margin: 10px 0; border-radius: 6px; background: #f9f9f9;'>
                            <p><strong>Screenshot {i}:</strong></p>
                            <p><strong>⏱️ Timestamp:</strong> {formatted_time}</p>
                            <p><strong>🎬 Video:</strong> {screenshot.get('videoName', video_name)}</p>
                            <img src="{screenshot.get('img', '')}" alt='Screenshot {i}' style='max-width: 150px; max-height: 150px; border-radius: 4px; border: 2px solid #ddd; object-fit: contain;'>
                        </div>
                    """
            else:
                # Thumbnail selection (fallback)
                image_info += f"<p><strong>🖼️ Thumbnail Selection:</strong></p>"
                image_info += f"<p><strong>Video:</strong> {video_name}</p>"
                image_info += f"<p><strong>Image:</strong></p>"
                image_info += f"<img src='{item.get('img', '')}' alt='Thumbnail' style='max-width: 180px; max-height: 180px; border-radius: 6px; border: 2px solid #ddd; object-fit: contain;'>"
            
            html_body += f"""
                <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                    <h2>{item.get('product', 'N/A')}</h2>
                    <p><strong>Color:</strong> {item.get('variants', {}).get('color', 'N/A')}</p>
                    <p><strong>Size:</strong> {item.get('variants', {}).get('size', 'N/A')}</p>
                    <p><strong>Note:</strong> {item.get('note', 'None')}</p>
                    {image_info}
                </div>
            """
        
        # Record each sale
        for item in cart:
            record_sale(item)
            
        # Send customer SMS if consented (A2P 10DLC compliant)
        if sms_consent and customer_phone:
            logger.info(f"📱 Sending order confirmation SMS to {customer_phone}")
            send_customer_sms(customer_phone, 'order_confirmation', order_id)
        elif sms_consent:
            logger.warning("SMS consent given but no phone number available")
        else:
            logger.info("Customer did not consent to SMS notifications")
            
        # Send admin notification SMS
        admin_sms_body = f"New ScreenMerch Order #{order_id}!\n"
        admin_sms_body += f"Items: {len(cart)}\n"
        admin_sms_body += f"Customer: {customer_name}\n"
        admin_sms_body += f"Phone: {customer_phone}\n"
        admin_sms_body += f"Email: {customer_email}\n"
        admin_sms_body += f"Address: {shipping_line1}, {shipping_city}, {shipping_state}\n"
        admin_sms_body += f"SMS Consent: {'Yes' if sms_consent else 'No'}\n"
        for item in cart:
            product_info = f"• {item.get('product', 'N/A')} ({item.get('variants', {}).get('color', 'N/A')}, {item.get('variants', {}).get('size', 'N/A')})"
            
            # Add screenshot info if available
            if item.get('screenshots') and len(item.get('screenshots', [])) > 0:
                screenshot_count = len(item.get('screenshots', []))
                video_name = item.get('videoName', 'N/A')
                admin_sms_body += f"{product_info}\n  📸 {screenshot_count} screenshot(s) from '{video_name}'\n"
            else:
                video_name = item.get('videoName', 'N/A')
                admin_sms_body += f"{product_info}\n  🖼️ Thumbnail from '{video_name}'\n"
        send_order_sms(admin_sms_body)
        
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
    elif event["type"] == "customer.subscription.created":
        subscription = event["data"]["object"]
        user_id = subscription.get("metadata", {}).get("user_id")
        if user_id:
            try:
                # Update subscription status
                subscription_data = {
                    "user_id": user_id,
                    "tier": "pro",
                    "status": subscription.get("status"),
                    "stripe_subscription_id": subscription.get("id"),
                    "trial_end": subscription.get("trial_end"),
                    "current_period_end": subscription.get("current_period_end"),
                    "updated_at": "now()"
                }
                
                result = supabase.table('user_subscriptions').upsert(
                    subscription_data,
                    on_conflict='user_id'
                ).execute()
                
                logger.info(f"Subscription created for user {user_id}")
            except Exception as e:
                logger.error(f"Error handling subscription creation: {e}")
    
    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        user_id = subscription.get("metadata", {}).get("user_id")
        if user_id:
            try:
                # Update subscription status
                subscription_data = {
                    "user_id": user_id,
                    "tier": "pro",
                    "status": subscription.get("status"),
                    "stripe_subscription_id": subscription.get("id"),
                    "trial_end": subscription.get("trial_end"),
                    "current_period_end": subscription.get("current_period_end"),
                    "updated_at": "now()"
                }
                
                result = supabase.table('user_subscriptions').upsert(
                    subscription_data,
                    on_conflict='user_id'
                ).execute()
                
                logger.info(f"Subscription updated for user {user_id}")
            except Exception as e:
                logger.error(f"Error handling subscription update: {e}")
    
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        user_id = subscription.get("metadata", {}).get("user_id")
        if user_id:
            try:
                # Update subscription status to cancelled
                subscription_data = {
                    "user_id": user_id,
                    "tier": "free",  # Downgrade to free
                    "status": "cancelled",
                    "stripe_subscription_id": subscription.get("id"),
                    "updated_at": "now()"
                }
                
                result = supabase.table('user_subscriptions').upsert(
                    subscription_data,
                    on_conflict='user_id'
                ).execute()
                
                logger.info(f"Subscription cancelled for user {user_id}")
            except Exception as e:
                logger.error(f"Error handling subscription cancellation: {e}")

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
    """Capture a single screenshot from a video at a specific timestamp"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
        
    try:
        data = request.get_json()
        video_url = data.get('video_url')
        timestamp = data.get('timestamp', 0)
        quality = data.get('quality', 85)
        
        if not video_url:
            response = jsonify({"success": False, "error": "video_url is required"}), 400
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response
        
        logger.info(f"Capturing screenshot from {video_url} at timestamp {timestamp}")
        
        # Try to capture screenshot using ffmpeg
        try:
            result = screenshot_capture.capture_screenshot(video_url, timestamp, quality)
            
            if result['success']:
                logger.info("Screenshot captured successfully")
                response = jsonify(result)
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response
            else:
                logger.error(f"Screenshot capture failed: {result['error']}")
                # Return a more user-friendly error
                response = jsonify({
                    "success": False, 
                    "error": "Screenshot capture failed. This might be due to video format or server limitations.",
                    "details": result['error']
                }), 500
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response
                
        except ImportError as e:
            logger.error(f"FFmpeg not available: {str(e)}")
            response = jsonify({
                "success": False, 
                "error": "Screenshot capture service not available on this server."
            }), 503
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response
        except Exception as e:
            logger.error(f"FFmpeg error: {str(e)}")
            # Try to extract thumbnail from video URL as fallback
            try:
                # For now, return a placeholder image or the video URL itself
                # In a real implementation, you might want to use a different approach
                logger.info("FFmpeg failed, returning video URL as fallback")
                response = jsonify({
                    "success": True,
                    "screenshot": video_url,  # Use video URL as fallback
                    "timestamp": timestamp,
                    "fallback": True
                })
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response
            except Exception as fallback_error:
                logger.error(f"Fallback also failed: {str(fallback_error)}")
                response = jsonify({
                    "success": False, 
                    "error": "Screenshot capture failed due to video processing error."
                }), 500
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response
            
    except Exception as e:
        logger.error(f"Error in capture_screenshot: {str(e)}")
        response = jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response

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
        
        # Delete user's friend requests
        try:
            supabase.table('friend_requests').delete().eq('sender_id', user_id).execute()
            supabase.table('friend_requests').delete().eq('receiver_id', user_id).execute()
            logger.info(f"Deleted friend requests for user {user_id}")
        except Exception as e:
            logger.error(f"Error deleting friend requests: {str(e)}")
        
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

# NEW: Authentication endpoints
@app.route("/api/auth/login", methods=["POST"])
def auth_login():
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

@app.route("/api/auth/signup", methods=["POST"])
def auth_signup():
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
                
                # Send confirmation email
                try:
                    # Generate verification token
                    import secrets
                    verification_token = secrets.token_urlsafe(32)
                    
                    # Store verification token
                    supabase.table('users').update({
                        'email_verification_token': verification_token
                    }).eq('email', email).execute()
                    
                    # Create confirmation URL
                    confirmation_url = f"https://backend-hidden-firefly-7865.fly.dev/api/auth/confirm-email?token={verification_token}&email={email}&redirect={redirect_url}"
                    
                    # Send confirmation email using Resend
                    email_data = {
                        "from": RESEND_FROM,
                        "to": [email],
                        "subject": "Confirm your ScreenMerch account",
                        "html": f"""
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #3f51b5;">Welcome to ScreenMerch!</h2>
                            <p>Thank you for creating an account. Please confirm your email address to continue.</p>
                            <p>Click the button below to confirm your account:</p>
                            <a href="{confirmation_url}" 
                               style="display: inline-block; background: #3f51b5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                                Confirm Email Address
                            </a>
                            <p>Or copy and paste this link into your browser:</p>
                            <p style="word-break: break-all; color: #666;">{confirmation_url}</p>
                            <p>This link will expire in 24 hours.</p>
                            <p>If you didn't create this account, you can safely ignore this email.</p>
                        </div>
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
                    
                    if response.status_code == 200:
                        logger.info(f"Confirmation email sent to {email}")
                        return jsonify({
                            "success": True, 
                            "message": "Account created successfully! Please check your email to confirm your account.",
                            "user": {
                                "id": result.data[0].get('id'),
                                "email": result.data[0].get('email'),
                                "display_name": result.data[0].get('display_name'),
                                "role": result.data[0].get('role', 'customer')
                            }
                        })
                    else:
                        logger.error(f"Failed to send confirmation email: {response.text}")
                        return jsonify({
                            "success": True, 
                            "message": "Account created successfully! Please check your email to confirm your account.",
                            "user": {
                                "id": result.data[0].get('id'),
                                "email": result.data[0].get('email'),
                                "display_name": result.data[0].get('display_name'),
                                "role": result.data[0].get('role', 'customer')
                            }
                        })
                        
                except Exception as email_error:
                    logger.error(f"Error sending confirmation email: {str(email_error)}")
                    return jsonify({
                        "success": True, 
                        "message": "Account created successfully! Please check your email to confirm your account.",
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

@app.route("/api/auth/verify", methods=["POST"])
def auth_verify():
    """Verify if user is authenticated (for session checking)"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({"success": False, "error": "Email is required"}), 400
        
        # Check if user exists
        try:
            result = supabase.table('users').select('*').eq('email', email).execute()
            
            if result.data:
                user = result.data[0]
                return jsonify({
                    "success": True,
                    "authenticated": True,
                    "user": {
                        "id": user.get('id'),
                        "email": user.get('email'),
                        "display_name": user.get('display_name'),
                        "role": user.get('role', 'customer')
                    }
                })
            else:
                return jsonify({"success": True, "authenticated": False}), 200
                
        except Exception as db_error:
            logger.error(f"Database error during verification: {str(db_error)}")
            return jsonify({"success": False, "error": "Verification service unavailable"}), 500
            
    except Exception as e:
        logger.error(f"Verification error: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

# NEW: Email confirmation endpoints
@app.route("/api/auth/send-confirmation", methods=["POST"])
def send_email_confirmation():
    """Send email confirmation to user"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        redirect_url = data.get('redirect_url', '')
        
        if not email:
            return jsonify({"success": False, "error": "Email is required"}), 400
        
        # Generate verification token
        import secrets
        verification_token = secrets.token_urlsafe(32)
        
        # Store verification token in database
        try:
            supabase.table('users').update({
                'email_verification_token': verification_token,
                'updated_at': 'now()'
            }).eq('email', email).execute()
            
            # Create confirmation URL
            confirmation_url = f"https://backend-hidden-firefly-7865.fly.dev/api/auth/confirm-email?token={verification_token}&email={email}&redirect={redirect_url}"
            
            # Send confirmation email using Resend
            email_data = {
                "from": RESEND_FROM,
                "to": [email],
                "subject": "Confirm your ScreenMerch account",
                "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #3f51b5;">Welcome to ScreenMerch!</h2>
                    <p>Thank you for creating an account. Please confirm your email address to continue.</p>
                    <p>Click the button below to confirm your account:</p>
                    <a href="{confirmation_url}" 
                       style="display: inline-block; background: #3f51b5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                        Confirm Email Address
                    </a>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #666;">{confirmation_url}</p>
                    <p>This link will expire in 24 hours.</p>
                    <p>If you didn't create this account, you can safely ignore this email.</p>
                </div>
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
            
            if response.status_code == 200:
                logger.info(f"Confirmation email sent to {email}")
                return jsonify({
                    "success": True,
                    "message": "Confirmation email sent! Please check your inbox."
                })
            else:
                logger.error(f"Failed to send confirmation email: {response.text}")
                return jsonify({
                    "success": False,
                    "error": "Failed to send confirmation email"
                }), 500
                
        except Exception as db_error:
            logger.error(f"Database error: {str(db_error)}")
            return jsonify({
                "success": False,
                "error": "Failed to process confirmation request"
            }), 500
            
    except Exception as e:
        logger.error(f"Error in send_email_confirmation: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route("/api/auth/confirm-email")
def confirm_email():
    """Confirm email address with token"""
    try:
        token = request.args.get('token')
        email = request.args.get('email')
        redirect_url = request.args.get('redirect', '')
        
        if not token or not email:
            return "Invalid confirmation link", 400
        
        # Verify token in database
        try:
            result = supabase.table('users').select('*').eq('email', email).eq('email_verification_token', token).execute()
            
            if result.data:
                # Update user as verified
                supabase.table('users').update({
                    'email_verified': True,
                    'email_verification_token': None,
                    'updated_at': 'now()'
                }).eq('email', email).execute()
                
                logger.info(f"Email confirmed for {email}")
                
                # Redirect to product page or success page
                if redirect_url:
                    return f"""
                    <html>
                    <head>
                        <title>Email Confirmed - ScreenMerch</title>
                        <style>
                            body {{ font-family: Arial, sans-serif; text-align: center; padding: 50px; }}
                            .success {{ color: #4CAF50; font-size: 24px; margin-bottom: 20px; }}
                            .redirect {{ color: #666; margin-top: 30px; }}
                        </style>
                    </head>
                    <body>
                        <div class="success">✅ Email Confirmed!</div>
                        <p>Your email address has been successfully confirmed.</p>
                        <p>You can now access your ScreenMerch products.</p>
                        <div class="redirect">
                            <p>Redirecting to your product page...</p>
                            <script>
                                setTimeout(function() {{
                                    window.location.href = "{redirect_url}";
                                }}, 3000);
                            </script>
                            <p><a href="{redirect_url}">Click here if you're not redirected automatically</a></p>
                        </div>
                    </body>
                    </html>
                    """
                else:
                    return """
                    <html>
                    <head>
                        <title>Email Confirmed - ScreenMerch</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            .success { color: #4CAF50; font-size: 24px; margin-bottom: 20px; }
                        </style>
                    </head>
                    <body>
                        <div class="success">✅ Email Confirmed!</div>
                        <p>Your email address has been successfully confirmed.</p>
                        <p>You can now access your ScreenMerch products.</p>
                        <p><a href="https://screenmerch.com">Return to ScreenMerch</a></p>
                    </body>
                    </html>
                    """
            else:
                return """
                <html>
                <head>
                    <title>Invalid Link - ScreenMerch</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .error { color: #f44336; font-size: 24px; margin-bottom: 20px; }
                    </style>
                </head>
                <body>
                    <div class="error">❌ Invalid Confirmation Link</div>
                    <p>This confirmation link is invalid or has expired.</p>
                    <p><a href="https://screenmerch.com">Return to ScreenMerch</a></p>
                </body>
                </html>
                """, 400
                
        except Exception as db_error:
            logger.error(f"Database error during email confirmation: {str(db_error)}")
            return "Database error during confirmation", 500
            
    except Exception as e:
        logger.error(f"Error in confirm_email: {str(e)}")
        return "Internal server error", 500

# NEW: Forgot password endpoints
@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    """Send password reset email"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        redirect_url = data.get('redirect_url', '')
        
        if not email:
            return jsonify({"success": False, "error": "Email is required"}), 400
        
        # Check if user exists
        try:
            result = supabase.table('users').select('*').eq('email', email).execute()
            
            if not result.data:
                # Don't reveal if email exists or not for security
                return jsonify({
                    "success": True,
                    "message": "If an account with this email exists, a password reset link has been sent."
                })
            
            # Generate reset token
            import secrets
            reset_token = secrets.token_urlsafe(32)
            
            # Store reset token in database
            supabase.table('users').update({
                'email_verification_token': reset_token,  # Reuse this field for reset tokens
                'updated_at': 'now()'
            }).eq('email', email).execute()
            
            # Create reset URL
            reset_url = f"https://backend-hidden-firefly-7865.fly.dev/api/auth/reset-password?token={reset_token}&email={email}&redirect={redirect_url}"
            
            # Send reset email using Resend
            email_data = {
                "from": RESEND_FROM,
                "to": [email],
                "subject": "Reset your ScreenMerch password",
                "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #3f51b5;">Password Reset Request</h2>
                    <p>You requested to reset your password for your ScreenMerch account.</p>
                    <p>Click the button below to reset your password:</p>
                    <a href="{reset_url}" 
                       style="display: inline-block; background: #3f51b5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                        Reset Password
                    </a>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #666;">{reset_url}</p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request this password reset, you can safely ignore this email.</p>
                </div>
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
            
            if response.status_code == 200:
                logger.info(f"Password reset email sent to {email}")
                return jsonify({
                    "success": True,
                    "message": "If an account with this email exists, a password reset link has been sent."
                })
            else:
                logger.error(f"Failed to send reset email: {response.text}")
                return jsonify({
                    "success": False,
                    "error": "Failed to send password reset email"
                }), 500
                
        except Exception as db_error:
            logger.error(f"Database error: {str(db_error)}")
            return jsonify({
                "success": False,
                "error": "Failed to process password reset request"
            }), 500
            
    except Exception as e:
        logger.error(f"Error in forgot_password: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route("/api/auth/reset-password")
def reset_password_page():
    """Show password reset page"""
    token = request.args.get('token')
    email = request.args.get('email')
    redirect_url = request.args.get('redirect', '')
    
    if not token or not email:
        return "Invalid reset link", 400
    
    return f"""
    <html>
    <head>
        <title>Reset Password - ScreenMerch</title>
        <style>
            body {{ 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 50px; 
                background: #f5f5f5;
            }}
            .container {{
                max-width: 400px;
                margin: 0 auto;
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }}
            .title {{ color: #3f51b5; font-size: 24px; margin-bottom: 20px; }}
            input {{ 
                width: 100%; 
                padding: 12px; 
                margin: 10px 0; 
                border: 1px solid #ddd; 
                border-radius: 6px; 
                box-sizing: border-box;
            }}
            button {{ 
                background: #3f51b5; 
                color: white; 
                padding: 12px 24px; 
                border: none; 
                border-radius: 6px; 
                cursor: pointer; 
                width: 100%;
                margin-top: 10px;
            }}
            button:hover {{ background: #303f9f; }}
            .error {{ color: #f44336; margin-top: 10px; }}
            .success {{ color: #4CAF50; margin-top: 10px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="title">Reset Your Password</div>
            <p>Enter your new password below:</p>
            <form id="resetForm">
                <input type="email" id="email" value="{email}" readonly style="background: #f5f5f5;">
                <input type="password" id="newPassword" placeholder="New Password" required minlength="6">
                <input type="password" id="confirmPassword" placeholder="Confirm Password" required minlength="6">
                <button type="submit">Reset Password</button>
            </form>
            <div id="message"></div>
        </div>
        
        <script>
            document.getElementById('resetForm').addEventListener('submit', async function(e) {{
                e.preventDefault();
                
                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                const messageDiv = document.getElementById('message');
                
                if (newPassword !== confirmPassword) {{
                    messageDiv.innerHTML = '<div class="error">Passwords do not match</div>';
                    return;
                }}
                
                if (newPassword.length < 6) {{
                    messageDiv.innerHTML = '<div class="error">Password must be at least 6 characters</div>';
                    return;
                }}
                
                try {{
                    const response = await fetch('/api/auth/update-password', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{
                            email: '{email}',
                            token: '{token}',
                            new_password: newPassword,
                            redirect_url: '{redirect_url}'
                        }})
                    }});
                    
                    const data = await response.json();
                    
                    if (data.success) {{
                        messageDiv.innerHTML = '<div class="success">Password updated successfully! Redirecting...</div>';
                        setTimeout(() => {{
                            window.location.href = '{redirect_url}' || 'https://screenmerch.com';
                        }}, 2000);
                    }} else {{
                        messageDiv.innerHTML = '<div class="error">' + (data.error || 'Failed to update password') + '</div>';
                    }}
                }} catch (error) {{
                    messageDiv.innerHTML = '<div class="error">An error occurred. Please try again.</div>';
                }}
            }});
        </script>
    </body>
    </html>
    """

@app.route("/api/auth/update-password", methods=["POST"])
def update_password():
    """Update password with reset token"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        token = data.get('token')
        new_password = data.get('new_password')
        redirect_url = data.get('redirect_url', '')
        
        if not email or not token or not new_password:
            return jsonify({"success": False, "error": "Missing required fields"}), 400
        
        if len(new_password) < 6:
            return jsonify({"success": False, "error": "Password must be at least 6 characters"}), 400
        
        # Verify token and update password
        try:
            result = supabase.table('users').select('*').eq('email', email).eq('email_verification_token', token).execute()
            
            if result.data:
                # Update password and clear token
                supabase.table('users').update({
                    'password_hash': new_password,  # In production, use bcrypt
                    'email_verification_token': None,
                    'updated_at': 'now()'
                }).eq('email', email).execute()
                
                logger.info(f"Password updated for {email}")
                return jsonify({
                    "success": True,
                    "message": "Password updated successfully"
                })
            else:
                return jsonify({
                    "success": False,
                    "error": "Invalid or expired reset token"
                }), 400
                
        except Exception as db_error:
            logger.error(f"Database error during password update: {str(db_error)}")
            return jsonify({
                "success": False,
                "error": "Failed to update password"
            }), 500
            
    except Exception as e:
        logger.error(f"Error in update_password: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route("/api/create-pro-checkout", methods=["POST"])
def create_pro_checkout():
    """Create Stripe checkout session for Pro subscription with 7-day trial"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        tier = data.get('tier', 'pro')
        email = data.get('email')
        
        # Allow guest checkout - user_id can be null
        # Stripe will collect email during checkout if not provided
        
        # Create Stripe checkout session for Pro subscription
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": "ScreenMerch Pro Plan",
                        "description": "Creator Pro Plan with 7-day free trial"
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
            cancel_url="https://screenmerch.com/subscription",
            customer_email=email,  # Pre-fill email if available
            metadata={
                "user_id": user_id or "guest",
                "tier": tier
            }
        )
        
        logger.info(f"Created Pro checkout session for user {user_id or 'guest'}")
        return jsonify({"url": session.url})
        
    except Exception as e:
        logger.error(f"Error creating Pro checkout session: {str(e)}")
        return jsonify({"error": "Failed to create checkout session"}), 500


# ============================================================================
# IMAGE TEXT OVERLAY API ENDPOINTS
# ============================================================================

@app.route("/api/image/add-text-overlay", methods=["POST", "OPTIONS"])
def add_text_overlay():
    """Add stylish text overlay to an image"""
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
        
        # Required fields
        image_data = data.get('image_data')
        text = data.get('text')
        
        if not image_data or not text:
            return jsonify({"success": False, "error": "Missing required fields: image_data and text"}), 400
        
        # Optional fields with defaults
        position = data.get('position', 'center')
        font_size = data.get('font_size')
        font_color = data.get('font_color')
        stroke_color = data.get('stroke_color')
        stroke_width = data.get('stroke_width')
        style = data.get('style', 'modern')
        opacity = data.get('opacity', 1.0)
        rotation = data.get('rotation', 0)
        shadow = data.get('shadow', False)
        glow = data.get('glow', False)
        background = data.get('background', False)
        background_color = data.get('background_color')
        background_opacity = data.get('background_opacity', 0.7)
        
        # Convert color tuples if provided as lists
        if font_color and isinstance(font_color, list):
            font_color = tuple(font_color)
        if stroke_color and isinstance(stroke_color, list):
            stroke_color = tuple(stroke_color)
        if background_color and isinstance(background_color, list):
            background_color = tuple(background_color)
        
        # Add text overlay
        result_image = image_text_overlay.add_text_overlay(
            image_data=image_data,
            text=text,
            position=position,
            font_size=font_size,
            font_color=font_color,
            stroke_color=stroke_color,
            stroke_width=stroke_width,
            style=style,
            opacity=opacity,
            rotation=rotation,
            shadow=shadow,
            glow=glow,
            background=background,
            background_color=background_color,
            background_opacity=background_opacity
        )
        
        logger.info(f"Text overlay added successfully: '{text}' with style '{style}'")
        return jsonify({
            "success": True,
            "image_data": result_image,
            "message": "Text overlay added successfully"
        })
        
    except Exception as e:
        logger.error(f"Error adding text overlay: {str(e)}")
        return jsonify({"success": False, "error": f"Failed to add text overlay: {str(e)}"}), 500


@app.route("/api/image/add-multiple-text-overlays", methods=["POST", "OPTIONS"])
def add_multiple_text_overlays():
    """Add multiple text overlays to an image"""
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
        
        # Required fields
        image_data = data.get('image_data')
        text_elements = data.get('text_elements')
        
        if not image_data or not text_elements:
            return jsonify({"success": False, "error": "Missing required fields: image_data and text_elements"}), 400
        
        if not isinstance(text_elements, list):
            return jsonify({"success": False, "error": "text_elements must be a list"}), 400
        
        # Process color tuples for each text element
        for element in text_elements:
            if 'font_color' in element and isinstance(element['font_color'], list):
                element['font_color'] = tuple(element['font_color'])
            if 'stroke_color' in element and isinstance(element['stroke_color'], list):
                element['stroke_color'] = tuple(element['stroke_color'])
            if 'background_color' in element and isinstance(element['background_color'], list):
                element['background_color'] = tuple(element['background_color'])
        
        # Add multiple text overlays
        result_image = image_text_overlay.add_multiple_text_overlays(
            image_data=image_data,
            text_elements=text_elements
        )
        
        logger.info(f"Multiple text overlays added successfully: {len(text_elements)} elements")
        return jsonify({
            "success": True,
            "image_data": result_image,
            "message": f"Added {len(text_elements)} text overlays successfully"
        })
        
    except Exception as e:
        logger.error(f"Error adding multiple text overlays: {str(e)}")
        return jsonify({"success": False, "error": f"Failed to add text overlays: {str(e)}"}), 500


@app.route("/api/image/text-styles", methods=["GET"])
def get_text_styles():
    """Get available text styles and their configurations"""
    try:
        styles = image_text_overlay.get_preset_styles()
        
        # Add additional style information
        style_info = {
            "available_styles": list(styles.keys()),
            "positions": ["top", "center", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"],
            "effects": ["shadow", "glow", "background", "rotation", "opacity"],
            "preset_styles": styles
        }
        
        return jsonify({
            "success": True,
            "styles": style_info
        })
        
    except Exception as e:
        logger.error(f"Error getting text styles: {str(e)}")
        return jsonify({"success": False, "error": f"Failed to get text styles: {str(e)}"}), 500


@app.route("/api/image/preview-text-overlay", methods=["POST", "OPTIONS"])
def preview_text_overlay():
    """Preview text overlay on a sample image"""
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
        
        # Create a sample image for preview
        sample_image = create_sample_image()
        
        # Get text overlay parameters
        text = data.get('text', 'Sample Text')
        style = data.get('style', 'modern')
        position = data.get('position', 'center')
        
        # Get style configuration
        styles = image_text_overlay.get_preset_styles()
        style_config = styles.get(style, styles['modern'])
        
        # Add text overlay to sample image
        result_image = image_text_overlay.add_text_overlay(
            image_data=sample_image,
            text=text,
            position=position,
            **style_config
        )
        
        return jsonify({
            "success": True,
            "preview_image": result_image,
            "style_config": style_config
        })
        
    except Exception as e:
        logger.error(f"Error creating preview: {str(e)}")
        return jsonify({"success": False, "error": f"Failed to create preview: {str(e)}"}), 500


def create_sample_image():
    """Create a sample image for preview purposes"""
    try:
        # Create a simple gradient image
        width, height = 400, 300
        image = Image.new('RGB', (width, height))
        draw = ImageDraw.Draw(image)
        
        # Create a gradient background
        for y in range(height):
            r = int(255 * (1 - y / height))
            g = int(128 * (y / height))
            b = int(255 * (y / height))
            draw.line([(0, y), (width, y)], fill=(r, g, b))
        
        # Convert to base64
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        buffer.seek(0)
        
        result_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{result_data}"
        
    except Exception as e:
        logger.error(f"Error creating sample image: {str(e)}")
        # Return a simple colored rectangle as fallback
        image = Image.new('RGB', (400, 300), (100, 150, 200))
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        buffer.seek(0)
        
        result_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{result_data}"


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)

