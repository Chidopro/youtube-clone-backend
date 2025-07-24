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
from supabase import create_client, Client
from twilio.rest import Client
from pathlib import Path
import sys

# NEW: Import Printful integration
# from printful_integration import ScreenMerchPrintfulIntegration

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

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")
print("SUPABASE_URL:", "✓" if supabase_url else "✗")
print("SUPABASE_ANON_KEY:", "✓" if supabase_key else "✗")
if not supabase_url or not supabase_key:
    print("ERROR: Missing Supabase environment variables. Check your .env file location and content.", file=sys.stderr)
    sys.exit(1)

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
           template_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates'),
           static_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static'))

# Correctly configure CORS for the extension and local dev server
CORS(app, resources={r"/api/*": {"origins": ["chrome-extension://*", "http://localhost:5173", "http://127.0.0.1:5000"]}})

# Initialize Supabase client for database operations
supabase: Client = create_client(supabase_url, supabase_key)

# NEW: Initialize Printful integration
# printful_integration = ScreenMerchPrintfulIntegration()

# Keep in-memory storage as fallback, but prioritize database
product_data_store = {}
order_store = {}  # In-memory store for demo; use a database for production

# --- Mailgun Configuration ---
# These are loaded from your .env file
MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY")
MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN")
MAILGUN_FROM = os.getenv("MAILGUN_FROM", f"ScreenMerch <support@{MAILGUN_DOMAIN}>")
MAIL_TO = os.getenv("MAIL_TO") # The email address that will receive the orders

# Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# NEW: Printful API Key
PRINTFUL_API_KEY = os.getenv("PRINTFUL_API_KEY")

PRODUCTS = [
]

@app.route("/")
def index():
    return "Flask Backend is Running!"

@app.route("/api/create-product", methods=["POST", "OPTIONS"])
def create_product():
    if request.method == "OPTIONS":
        return jsonify(success=True) # Handle CORS preflight

    try:
        data = request.get_json()
        if not data:
            return jsonify(success=False, error="No data received"), 400

        # Log the received data
        thumbnail = data.get('thumbnail', '')
        video_url = data.get('videoUrl', '')
        screenshots = data.get('screenshots', [])
        
        logger.info(f"✅ Received Make Merch request:")
        logger.info(f"  Video URL: {video_url}")
        logger.info(f"  Has thumbnail: {'Yes' if thumbnail else 'No'}")
        logger.info(f"  Screenshots: {len(screenshots)}")
        
        # For now, just return success without complex storage
        # This allows the Make Merch button to work for testing SMS
        product_id = str(uuid.uuid4())
        
        # Store basic data in memory for now
        product_data_store[product_id] = {
            "thumbnail": thumbnail,
            "screenshots": screenshots,
            "video_url": video_url,
            "created_at": "now"
        }
        
        logger.info(f"✅ Created product with ID: {product_id}")
        
        # Return success with product_url that frontend expects
        product_page_url = f"https://screenmerch.com/product/{product_id}"
        
        return jsonify(
            success=True, 
            product_url=product_page_url,
            message="Merch creation request received successfully!",
            product_id=product_id
        )
        
    except Exception as e:
        logger.error(f"❌ Error in create-product: {str(e)}")
        return jsonify(success=False, error="Internal server error"), 500

@app.route("/product/<product_id>")
def show_product_page(product_id):
    # Try to get product from database first
    try:
        result = supabase.table('products').select('*').eq('product_id', product_id).execute()
        if result.data:
            product_data = result.data[0]
            return render_template(
                'product_page.html', 
                img_url=product_data['thumbnail_url'],
                screenshots=product_data['screenshots_urls'],
                products=PRODUCTS,
                product_id=product_id
            )
    except Exception as e:
        logger.error(f"Error fetching from database: {str(e)}")
    
    # Fallback to in-memory storage
    product_data = product_data_store.get(product_id)
    if not product_data:
        return "Product not found", 404
    
    # Debug: Log what we're passing to template
    logger.info(f"🖼️ Rendering product page for {product_id}:")
    logger.info(f"  Has thumbnail: {'Yes' if product_data.get('thumbnail') else 'No'}")
    if product_data.get('thumbnail'):
        logger.info(f"  Thumbnail length: {len(product_data['thumbnail'])} chars")
        logger.info(f"  Thumbnail starts with: {product_data['thumbnail'][:50]}...")
    logger.info(f"  Screenshots: {len(product_data.get('screenshots', []))}")
        
    return render_template(
        'product_page.html', 
        img_url=product_data['thumbnail'],
        screenshots=product_data['screenshots'],
        products=PRODUCTS,
        product_id=product_id
    )

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
        # --- Send Email with Mailgun ---
        response = requests.post(
            f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages",
            auth=("api", MAILGUN_API_KEY),
            data={
                "from": MAILGUN_FROM,
                "to": MAIL_TO,
                "subject": f"New Order Received: {len(cart)} Item(s)",
                "html": html_body
            }
        )

        # --- Send SMS Notification ---
        send_order_sms(sms_body)

        if response.status_code != 200:
            logger.error(f"Mailgun API error: {response.text}")
            return jsonify({"success": False, "error": "Failed to send order email"}), 500

        return jsonify({"success": True})

    except Exception as e:
        logger.error(f"Error in send_order: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route("/success")
def success():
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
            success_url=f"https://screenmerch.com/success",
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
        admin_sms_body += f"SMS Consent: {'Yes' if sms_consent else 'No'}\n"
        admin_sms_body += f"Customer: {customer_phone}\n"
        for item in cart:
            admin_sms_body += f"• {item.get('product', 'N/A')} ({item.get('variants', {}).get('color', 'N/A')}, {item.get('variants', {}).get('size', 'N/A')})\n"
        send_order_sms(admin_sms_body)
        
        # Send email
        response = requests.post(
            f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages",
            auth=("api", MAILGUN_API_KEY),
            data={"from": MAILGUN_FROM, "to": MAIL_TO, "subject": f"New Paid Order #{order_id}: {len(cart)} Item(s)", "html": html_body}
        )
        if response.status_code != 200:
            logger.error(f"Mailgun API error: {response.text}")

    return "", 200

# NEW: Printful API endpoints (ADDITIONS ONLY)
# Commented out until printful_integration module is available

# @app.route("/api/printful/create-product", methods=["POST"])
# def create_printful_product():
#     """Create product in Printful automatically"""
#     try:
#         data = request.get_json()
#         thumbnail = data['thumbnail']
#         video_url = data['videoUrl']
#         product_type = data['productType']
#         variants = data['variants']
#         
#         # Create automated product in Printful
#         result = printful_integration.create_automated_product({
#             'image': thumbnail,
#             'productType': product_type,
#             'variants': variants,
#             'videoUrl': video_url
#         })
#         
#         if result['success']:
#             # Store Printful product info in database
#             product_data = {
#                 "product_id": str(uuid.uuid4()),
#                 "printful_product_id": result['product_id'],
#                 "thumbnail_url": result['image_url'],
#                 "video_url": video_url,
#                 "mockups": result['mockups']
#             }
#             
#             # Save to Supabase
#             supabase.table('products').insert(product_data).execute()
#             
#             return jsonify({
#                 "success": True,
#                 "product_url": f"http://127.0.0.1:5000/product/{product_data['product_id']}",
#                 "mockups": result['mockups']
#             })
#         else:
#             return jsonify({
#                 "success": False,
#                 "error": result['error']
#             }), 500
#             
#     except Exception as e:
#         logger.error(f"Printful product creation error: {str(e)}")
#         return jsonify(success=False, error="Internal server error"), 500

# @app.route("/api/printful/create-order", methods=["POST"])
# def create_printful_order():
#     """Create order in Printful automatically"""
#     try:
#         data = request.get_json()
#         cart = data['cart']
#         customer_info = data['customerInfo']
#         
#         # Create order in Printful
#         result = printful_integration.create_order({
#             'customerInfo': customer_info,
#             'items': cart,
#             'shippingAddress': customer_info['shipping_address']
#         })
#         
#         if result['success']:
#             return jsonify({
#                 "success": True,
#                 "order_id": result['order_id'],
#                 "tracking_url": result['printful_order'].get('tracking_url', '')
#             })
#         else:
#             return jsonify({
#                 "success": False,
#                 "error": result['error']
#             }), 500
#             
#     except Exception as e:
#         logger.error(f"Printful order creation error: {str(e)}")
#         return jsonify(success=False, error="Internal server error"), 500

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port) 