# EXACT CHANGES TO app.py - Adding Printful Integration
# Only the highlighted lines are new/changed

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
from backend.supabase_storage import storage
from supabase import create_client, Client

# NEW: Import Printful integration
from printful_integration import ScreenMerchPrintfulIntegration

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)

# Correctly configure CORS for the extension and local dev server
CORS(app, resources={r"/api/*": {"origins": ["chrome-extension://*", "http://localhost:5173", "http://127.0.0.1:5000"]}})

# Initialize Supabase client for database operations
supabase_url = os.getenv("VITE_SUPABASE_URL")
supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase environment variables")

supabase: Client = create_client(supabase_url, supabase_key)

# NEW: Initialize Printful integration
printful_integration = ScreenMerchPrintfulIntegration()

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
    # Products with both COLOR and SIZE options
    {
        "name": "Soft Tee",
        "price": 24.99,
        "filename": "guidonteepreview.png",
        "main_image": "guidontee.png",
        "options": {"color": ["Black", "White", "Gray"], "size": ["S", "M", "L", "XL"]},
        # NEW: Add Printful variant ID mapping
        "printful_variant_id": 4012  # Bella + Canvas 3001 Unisex Short Sleeve Jersey T-Shirt
    },
    {
        "name": "Unisex Classic Tee",
        "price": 24.99,
        "filename": "unisexclassicteepreview.png",
        "main_image": "unisexclassictee.png",
        "options": {"color": ["Black", "White", "Gray", "Navy"], "size": ["S", "M", "L", "XL"]},
        # NEW: Add Printful variant ID mapping
        "printful_variant_id": 4012
    },
    # ... rest of your existing products stay exactly the same ...
]

# ... existing routes stay exactly the same ...

@app.route("/api/create-product", methods=["POST", "OPTIONS"])
def create_product():
    if request.method == "OPTIONS":
        return jsonify(success=True) # Handle CORS preflight

    try:
        data = request.get_json()
        if not data or 'thumbnail' not in data or 'videoUrl' not in data:
            return jsonify(success=False, error="Missing required data"), 400

        # Log the received data, including the screenshots
        thumbnail = data['thumbnail']
        video_url = data['videoUrl']
        screenshots = data.get('screenshots', []) # Safely get screenshots
        
        logger.info(f"Received data for video: {video_url}")
        logger.info(f"Received {len(screenshots)} screenshots.")
        
        product_id = str(uuid.uuid4())
        
        # Save images to Supabase Storage
        thumbnail_url = None
        screenshots_urls = []
        
        try:
            # Save thumbnail
            if thumbnail:
                thumbnail_url = storage.save_image(thumbnail, f"thumbnail_{product_id}.png")
                logger.info(f"Saved thumbnail: {thumbnail_url}")
            
            # Save screenshots
            if screenshots:
                screenshots_urls = storage.save_multiple_images(screenshots, f"screenshots_{product_id}")
                logger.info(f"Saved {len(screenshots_urls)} screenshots")
                
        except Exception as e:
            logger.error(f"Error saving images to Supabase: {str(e)}")
            # Fallback to in-memory storage
            thumbnail_url = thumbnail
            screenshots_urls = screenshots
        
        # Store data in database
        try:
            product_data = {
                "product_id": product_id,
                "thumbnail_url": thumbnail_url,
                "video_url": video_url,
                "screenshots_urls": screenshots_urls
            }
            
            # Insert into Supabase database
            result = supabase.table('products').insert(product_data).execute()
            logger.info(f"Saved product to database: {product_id}")
            
        except Exception as e:
            logger.error(f"Error saving to database: {str(e)}")
            # Fallback to in-memory storage
            product_data_store[product_id] = {
                "thumbnail": thumbnail_url or thumbnail,
                "screenshots": screenshots_urls or screenshots,
                "video_url": video_url
            }

        # Return a URL to our new product page endpoint
        product_page_url = f"http://127.0.0.1:5000/product/{product_id}"
        
        return jsonify(success=True, product_url=product_page_url)
    except Exception as e:
        logger.error(f"Error in create-product: {str(e)}")
        return jsonify(success=False, error="Internal server error"), 500

# ... existing routes stay exactly the same ...

# NEW: Printful API endpoints (ADDITIONS ONLY)

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

# ... rest of your existing code stays exactly the same ... 