"""Order processing routes Blueprint for ScreenMerch"""
from flask import Blueprint, request, jsonify, render_template
import logging
import json
import uuid
import os
import stripe
import requests
from urllib.parse import urlparse

# Import utilities
from utils.helpers import (
    _data_from_request, _allow_origin, read_json, 
    require_shipping_address, _parse_zip
)
from services.email_service import send_order_email
from services.order_email import (
    build_admin_order_email,
    resend_attachments_from_builder,
    get_order_screenshot as get_screenshot_for_order,
    _compress_for_inline,
)

logger = logging.getLogger(__name__)

# Create Blueprint
orders_bp = Blueprint('orders', __name__)


def register_orders_routes(app, supabase, supabase_admin, order_store, products_list, config):
    """
    Register order routes with the Flask app
    
    Args:
        app: Flask application instance
        supabase: Supabase client
        supabase_admin: Supabase admin client (for bypassing RLS)
        order_store: In-memory order store dictionary
        products_list: List of product definitions (PRODUCTS array)
        config: Dictionary with configuration values:
            - STRIPE_SECRET_KEY
            - STRIPE_WEBHOOK_SECRET
            - RESEND_API_KEY
            - RESEND_FROM
            - MAIL_TO
            - PRINTFUL_API_KEY (optional)
    """
    # Store dependencies in Blueprint
    orders_bp.supabase = supabase
    orders_bp.supabase_admin = supabase_admin
    orders_bp.order_store = order_store
    orders_bp.products_list = products_list
    orders_bp.config = config
    
    # Configure Stripe
    stripe.api_key = config.get('STRIPE_SECRET_KEY')
    
    # Register the Blueprint
    app.register_blueprint(orders_bp)


def _get_supabase_client():
    """Get Supabase client"""
    return orders_bp.supabase if hasattr(orders_bp, 'supabase') else None


def _get_supabase_admin():
    """Get Supabase admin client"""
    return orders_bp.supabase_admin if hasattr(orders_bp, 'supabase_admin') else None


def _get_order_store():
    """Get order store"""
    return orders_bp.order_store if hasattr(orders_bp, 'order_store') else {}


def _get_products_list():
    """Get products list"""
    return orders_bp.products_list if hasattr(orders_bp, 'products_list') else []


def _get_config(key, default=None):
    """Get configuration value"""
    return orders_bp.config.get(key, default) if hasattr(orders_bp, 'config') else default


def _ensure_stripe_test_mode():
    """Ensure Stripe is in test mode"""
    api_key = _get_config('STRIPE_SECRET_KEY')
    if not api_key:
        raise ValueError("STRIPE_SECRET_KEY is not configured")
    if not api_key.startswith('sk_test_'):
        logger.warning("⚠️ Using non-test Stripe key - ensure this is intentional")


def _record_sale(item, user_id=None, friend_id=None, channel_id=None, order_id=None):
    """Record a sale in the database"""
    from datetime import datetime
    
    products = _get_products_list()
    client = _get_supabase_admin() or _get_supabase_client()
    
    # Get the correct price
    item_price = item.get('price')
    if not item_price or item_price <= 0:
        product_info = next((p for p in products if p.get("name") == item.get("product")), None)
        if not product_info:
            product_info = next((p for p in products if p.get("name", "").lower() == item.get("product", "").lower()), None)
        item_price = product_info.get("price", 0) if product_info else 0
    
    creator_user_id = user_id
    creator_name = item.get('creator_name', '')
    
    # Look up creator from subdomain if not provided
    if not creator_user_id:
        try:
            origin = request.headers.get('Origin', '')
            if origin and origin.endswith('.screenmerch.com') and origin.startswith('https://'):
                parsed = urlparse(origin)
                hostname = parsed.netloc
                subdomain = hostname.replace('.screenmerch.com', '').lower()
                
                if subdomain and subdomain != 'www' and client:
                    creator_result = client.table('users').select('id, display_name').eq('subdomain', subdomain).limit(1).execute()
                    if creator_result.data and len(creator_result.data) > 0:
                        creator_user_id = creator_result.data[0]['id']
                        creator_name = creator_result.data[0].get('display_name', creator_name)
        except Exception:
            pass
    
    # Fallback: Look up by creator_name
    if not creator_user_id and creator_name and creator_name != 'Unknown Creator' and client:
        try:
            # Try display_name first
            creator_result = client.table('users').select('id').ilike('display_name', f'%{creator_name}%').limit(1).execute()
            if creator_result.data and len(creator_result.data) > 0:
                creator_user_id = creator_result.data[0]['id']
            else:
                # Try username if display_name didn't match
                creator_result = client.table('users').select('id').ilike('username', f'%{creator_name}%').limit(1).execute()
                if creator_result.data and len(creator_result.data) > 0:
                    creator_user_id = creator_result.data[0]['id']
        except Exception as lookup_error:
            logger.warning(f"Error looking up creator user_id for '{creator_name}': {str(lookup_error)}")
    
    # Validate creator_user_id is a valid UUID before inserting
    # If it's not a valid UUID (e.g., a subdomain string), set it to None
    if creator_user_id:
        try:
            # Try to parse as UUID to validate
            uuid.UUID(str(creator_user_id))
        except (ValueError, TypeError, AttributeError):
            logger.warning(f"Invalid creator_user_id format (not a UUID): {creator_user_id}. Setting to None.")
            creator_user_id = None
    
    sale_data = {
        "user_id": creator_user_id,  # Will be None if invalid UUID
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
        "channel_id": channel_id
    }
    
    try:
        if client:
            client.table('sales').insert(sale_data).execute()
            
            # Create creator earnings if creator_user_id exists
            if creator_user_id:
                try:
                    user_result = client.table('users').select('role').eq('id', creator_user_id).single().execute()
                    if user_result.data and user_result.data.get('role') == 'creator':
                        from utils.payout import get_payout_for_sale
                        product_name = sale_data.get('product_name') or item.get('product') or ''
                        quantity = item.get('quantity', 1)
                        creator_share, platform_fee = get_payout_for_sale(product_name, item_price, quantity)
                        earnings_order_id = order_id or item.get('order_id') or f"ORD-{str(uuid.uuid4())[:8].upper()}"
                        
                        earnings_data = {
                            "user_id": creator_user_id,
                            "order_id": earnings_order_id,
                            "product_name": sale_data['product_name'],
                            "sale_amount": item_price,
                            "creator_share": creator_share,
                            "platform_fee": platform_fee,
                            "status": "pending"
                        }
                        client.table('creator_earnings').insert(earnings_data).execute()
                except Exception:
                    pass
    except Exception as e:
        logger.error(f"❌ Error recording sale: {str(e)}")


def _validate_product_availability(cart):
    """Validate color-size availability for cart items"""
    for item in cart:
        product_name = item.get('product', '')
        color = item.get('variants', {}).get('color', '')
        size = item.get('variants', {}).get('size', '')
        
        # Women's Ribbed Neck restrictions
        if product_name == "Women's Ribbed Neck":
            restricted_colors = [
                "Dark Heather Grey", "Burgundy", "India Ink Grey", "Anthracite",
                "Red", "Stargazer", "Khaki", "Desert Dust", "Fraiche Peche",
                "Cotton Pink", "Lavender"
            ]
            restricted_sizes = ["XXXL", "XXXXL", "XXXXXL"]
            if color in restricted_colors and size in restricted_sizes:
                return False, f"{color} is not available in size {size} for Women's Ribbed Neck. Please select a different size or color."
        
        # Cropped Hoodie restrictions
        if product_name == "Cropped Hoodie":
            if color == "Black" and size in ["XL", "XXL"]:
                return False, f"{color} is not available in size {size} for Cropped Hoodie. Please select a different size or color."
            if color == "Peach" and size != "XL":
                return False, f"{color} is only available in size XL for Cropped Hoodie. Please select XL or a different color."
        
        # Women's Crop Top restrictions
        if product_name == "Women's Crop Top":
            if color == "Bubblegum":
                return False, f"{color} is currently out of stock for Women's Crop Top. Please select a different color."
        
        # Unisex T-Shirt restrictions
        if product_name == "Unisex T-Shirt":
            unavailable_in_xs = [
                "Heather Midnight Navy", "True Royal", "Asphalt", "Heather True Royal",
                "Mauve", "Forest", "Heather Forest", "Olive", "Heather Deep Teal"
            ]
            if color in unavailable_in_xs and size == "XS":
                return False, f"{color} is not available in size XS for Unisex T-Shirt. Please select a different size or color."
            
            unavailable_in_5xl = [
                "Heather Midnight Navy", "True Royal", "Asphalt", "Heather True Royal",
                "Heather Prism Lilac", "Soft Cream", "Heather Prism Ice Blue", "Mauve",
                "Forest", "Heather Forest", "Olive", "Heather Deep Teal"
            ]
            if color in unavailable_in_5xl and size == "XXXXXL":
                return False, f"{color} is not available in size 5XL for Unisex T-Shirt. Please select a different size or color."
    
    return True, None


def _handle_cors_preflight():
    """Handle CORS preflight requests"""
    response = jsonify(success=True)
    origin = request.headers.get('Origin', '*')
    response.headers.add('Access-Control-Allow-Origin', origin)
    response.headers.add('Vary', 'Origin')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cache-Control,Pragma,Expires')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response


@orders_bp.route("/api/place-order", methods=["POST", "OPTIONS"])
def place_order():
    """Place an order - validates ZIP code requirement"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        data = read_json()
        cart = data.get("cart", [])
        shipping_cost = data.get("shipping_cost", data.get("shipping", {}).get("cost", 0)) or 0
        total_amount = data.get("total", 0) or sum(item.get('price', 0) for item in cart) + (shipping_cost or 0)
        
        if not cart:
            response = jsonify({"success": False, "error": "Cart is empty"})
            return _allow_origin(response), 400
        
        # Validate product availability
        is_valid, error_msg = _validate_product_availability(cart)
        if not is_valid:
            response = jsonify({"success": False, "error": error_msg})
            return _allow_origin(response), 400
        
        # Validate shipping address
        ok, addr_result = require_shipping_address(data)
        if not ok:
            response = jsonify({"success": False, "error": addr_result})
            return _allow_origin(response), 400
        
        shipping_address = addr_result
        
        # Generate order ID
        full_uuid = str(uuid.uuid4())
        order_id = f"ORD-{full_uuid[:8].upper()}"
        
        # Normalize cart items (strip base64 images)
        normalized_cart = []
        for item in cart:
            normalized_item = {
                'product': item.get('product') or item.get('name') or 'N/A',
                'variants': item.get('variants') or {
                    'color': item.get('color'),
                    'size': item.get('size')
                },
                'price': item.get('price', 0),
                'note': item.get('note', '')
            }
            # Only include non-image fields
            for key, value in item.items():
                if key not in ['img', 'image', 'screenshot', 'selected_screenshot', 'thumbnail']:
                    if key not in normalized_item:
                        normalized_item[key] = value
            normalized_cart.append(normalized_item)
        
        # Get screenshot from top-level payload
        top_level_screenshot = data.get("selected_screenshot") or data.get("thumbnail") or data.get("screenshot")
        
        # Enrich cart items with video metadata
        enriched_cart = []
        for item in normalized_cart:
            enriched_item = item.copy()
            enriched_item.update({
                "videoName": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                "creatorName": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
                "timestamp": data.get("screenshot_timestamp", data.get("timestamp", "Not provided")),
                "selected_screenshot": top_level_screenshot or data.get("selected_screenshot") or data.get("thumbnail")
            })
            enriched_cart.append(enriched_item)
        
        # Extract subdomain from request origin
        creator_user_id_from_subdomain = None
        subdomain_from_request = None
        try:
            origin = request.headers.get('Origin', '')
            if origin and origin.endswith('.screenmerch.com') and origin.startswith('https://'):
                parsed = urlparse(origin)
                hostname = parsed.netloc
                subdomain_from_request = hostname.replace('.screenmerch.com', '').lower()
                
                if subdomain_from_request and subdomain_from_request != 'www':
                    client = _get_supabase_admin()
                    if client:
                        creator_result = client.table('users').select('id, display_name').eq('subdomain', subdomain_from_request).limit(1).execute()
                        if creator_result.data and len(creator_result.data) > 0:
                            creator_user_id_from_subdomain = creator_result.data[0]['id']
        except Exception:
            pass
        
        # Prepare order data
        order_data = {
            "order_id": order_id,
            "cart": enriched_cart,
            "sms_consent": data.get("sms_consent", False),
            "customer_email": data.get("user_email", data.get("customer_email", "")),
            "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
            "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
            "creator_user_id": creator_user_id_from_subdomain,
            "subdomain": subdomain_from_request,
            "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
            "total_amount": total_amount,
            "shipping_cost": shipping_cost,
            "shipping_address": shipping_address,
            "status": "pending",
        }
        
        if top_level_screenshot:
            order_data["selected_screenshot"] = top_level_screenshot
        
        # Store in database
        client = _get_supabase_client()
        stored_in_db = False
        try:
            if client:
                client.table('orders').insert(order_data).execute()
                stored_in_db = True
        except Exception as db_error:
            logger.error(f"❌ Failed to store order in database: {str(db_error)}")
        
        # Always keep in-memory backup
        order_store = _get_order_store()
        order_store[order_id] = {
            "cart": enriched_cart,
            "timestamp": data.get("timestamp"),
            "order_id": order_id,
            "video_title": order_data["video_title"],
            "creator_user_id": creator_user_id_from_subdomain,
            "subdomain": subdomain_from_request,
            "creator_name": order_data["creator_name"],
            "video_url": order_data["video_url"],
            "screenshot_timestamp": data.get("screenshot_timestamp", data.get("timestamp", "Not provided")),
            "status": "pending",
            "created_at": data.get("created_at", "Recent"),
        }
        
        # Send admin notification email
        resend_api_key = _get_config('RESEND_API_KEY')
        resend_from = _get_config('RESEND_FROM', 'noreply@screenmerch.com')
        mail_to = _get_config('MAIL_TO')
        
        if resend_api_key and mail_to:
            try:
                html_body = f"<h1>New ScreenMerch Order #{order_id}</h1>"
                html_body += f"<p><strong>Order ID:</strong> {order_id}</p>"
                html_body += f"<p><strong>Items:</strong> {len(enriched_cart)}</p>"
                html_body += f"<p><strong>Total Value:</strong> ${total_amount:.2f}</p>"
                
                # Add screenshot if available
                if top_level_screenshot:
                    if top_level_screenshot.startswith('data:image'):
                        # Base64 image - would need attachment handling
                        html_body += f"<p><em>Screenshot available in order details</em></p>"
                    else:
                        html_body += f"<img src='{top_level_screenshot}' alt='Product Screenshot' style='max-width: 300px;'>"
                
                for item in enriched_cart:
                    html_body += f"""
                        <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                            <h2>{item.get('product', 'N/A')}</h2>
                            <p><strong>Color:</strong> {item.get('variants', {}).get('color', 'N/A')}</p>
                            <p><strong>Size:</strong> {item.get('variants', {}).get('size', 'N/A')}</p>
                            <p><strong>Note:</strong> {item.get('note', 'None')}</p>
                        </div>
                    """
                
                html_body += f"""
                    <hr>
                    <h2>📹 Video Information</h2>
                    <p><strong>Video Title:</strong> {order_data['video_title']}</p>
                    <p><strong>Creator:</strong> {order_data['creator_name']}</p>
                    <p><strong>Video URL:</strong> {order_data['video_url']}</p>
                    <p><a href="https://screenmerch.fly.dev/print-quality?order_id={order_id}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Open Print & Image Tools</a></p>
                """
                
                email_data = {
                    "from": resend_from,
                    "to": [mail_to],
                    "subject": f"🛍️ New ScreenMerch Order #{order_id}",
                    "html": html_body
                }
                
                requests.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {resend_api_key}",
                        "Content-Type": "application/json"
                    },
                    json=email_data,
                    timeout=30
                )
            except Exception:
                pass
        
        # Send customer confirmation email if email provided
        customer_email = order_data.get("customer_email", "").strip()
        if customer_email and resend_api_key:
            try:
                customer_html = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1>🎉 Thank You for Your Order!</h1>
                    <p>Hi there,</p>
                    <p>We've received your order and are getting it ready for you!</p>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h2>Order Details</h2>
                        <p><strong>Order Number:</strong> #{order_id}</p>
                        <p><strong>Items:</strong> {len(enriched_cart)}</p>
                        <p><strong>Total:</strong> ${total_amount:.2f}</p>
                    </div>
                    <p>We'll send you another email when your order ships!</p>
                </div>
                """
                
                customer_email_data = {
                    "from": resend_from,
                    "to": [customer_email],
                    "subject": f"🎉 Order Confirmation - #{order_id}",
                    "html": customer_html
                }
                
                requests.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {resend_api_key}",
                        "Content-Type": "application/json"
                    },
                    json=customer_email_data,
                    timeout=30
                )
            except Exception:
                pass
        
        response = jsonify({"success": True, "order_id": order_id})
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"Error in place_order: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return _allow_origin(response), 500


@orders_bp.route("/send-order", methods=["POST"])
def send_order():
    """Legacy send-order endpoint"""
    try:
        data = request.get_json()
        cart = data.get("cart", [])
        if not cart:
            return jsonify({"success": False, "error": "Cart is empty"}), 400
        
        # Validate product availability
        is_valid, error_msg = _validate_product_availability(cart)
        if not is_valid:
            return jsonify({"success": False, "error": error_msg}), 400
        
        # Generate order ID
        full_uuid = str(uuid.uuid4())
        order_id = f"ORD-{full_uuid[:8].upper()}"
        
        # Enrich cart items
        enriched_cart = []
        for item in cart:
            enriched_item = item.copy()
            enriched_item.update({
                "videoName": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                "creatorName": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
                "timestamp": data.get("screenshot_timestamp", data.get("timestamp", "Not provided"))
            })
            enriched_cart.append(enriched_item)
        
        # Extract subdomain
        creator_user_id_from_subdomain = None
        subdomain_from_request = None
        try:
            origin = request.headers.get('Origin', '')
            if origin and origin.endswith('.screenmerch.com') and origin.startswith('https://'):
                parsed = urlparse(origin)
                hostname = parsed.netloc
                subdomain_from_request = hostname.replace('.screenmerch.com', '').lower()
                if subdomain_from_request and subdomain_from_request != 'www':
                    client = _get_supabase_admin()
                    if client:
                        creator_result = client.table('users').select('id, display_name').eq('subdomain', subdomain_from_request).limit(1).execute()
                        if creator_result.data and len(creator_result.data) > 0:
                            creator_user_id_from_subdomain = creator_result.data[0]['id']
        except Exception:
            pass
        
        # Store order
        order_store = _get_order_store()
        order_store[order_id] = {
            "cart": enriched_cart,
            "timestamp": data.get("timestamp"),
            "order_id": order_id,
            "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
            "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
            "creator_user_id": creator_user_id_from_subdomain,
            "subdomain": subdomain_from_request,
            "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
            "screenshot_timestamp": data.get("screenshot_timestamp", data.get("timestamp", "Not provided")),
            "status": "pending",
            "created_at": data.get("created_at", "Recent")
        }
        
        # Record sales
        for item in cart:
            item['video_url'] = data.get('video_url', '')
            item['video_title'] = data.get('video_title', '')
            item['creator_name'] = data.get('creator_name', '')
            item['screenshot_timestamp'] = data.get('screenshot_timestamp', '')
            _record_sale(item, user_id=creator_user_id_from_subdomain, order_id=order_id)
        
        # Send email notification
        resend_api_key = _get_config('RESEND_API_KEY')
        resend_from = _get_config('RESEND_FROM', 'noreply@screenmerch.com')
        mail_to = _get_config('MAIL_TO')
        
        if resend_api_key and mail_to:
            try:
                html_body = f"<h1>New ScreenMerch Order #{order_id}</h1>"
                html_body += f"<p><strong>Order ID:</strong> {order_id}</p>"
                html_body += f"<p><strong>Items:</strong> {len(cart)}</p>"
                
                for item in cart:
                    html_body += f"""
                        <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                            <h2>{item.get('product', 'N/A')}</h2>
                            <p><strong>Color:</strong> {item.get('variants', {}).get('color', 'N/A')}</p>
                            <p><strong>Size:</strong> {item.get('variants', {}).get('size', 'N/A')}</p>
                            <p><strong>Note:</strong> {item.get('note', 'None')}</p>
                        </div>
                    """
                
                email_data = {
                    "from": resend_from,
                    "to": [mail_to],
                    "subject": f"🛍️ New ScreenMerch Order #{order_id}",
                    "html": html_body
                }
                
                requests.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {resend_api_key}",
                        "Content-Type": "application/json"
                    },
                    json=email_data
                )
            except Exception:
                pass
        
        # Create Stripe checkout session as fallback
        next_url = None
        try:
            shipping_cost = data.get("shipping_cost", 0) or 0
            products = _get_products_list()
            line_items = []
            
            for item in cart:
                item_price = item.get('price')
                if item_price and item_price > 0:
                    unit_amount = int(item_price * 100)
                    name = item.get("product") or item.get("name") or "Item"
                else:
                    product_info = next((p for p in products if p.get("name") == item.get("product")), None)
                    if not product_info:
                        continue
                    unit_amount = int(product_info.get("price", 0) * 100)
                    name = product_info.get("name", "Item")
                
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
                _ensure_stripe_test_mode()
                
                origin = request.headers.get('Origin', 'https://screenmerch.com')
                if origin and origin.startswith('https://') and origin.endswith('.screenmerch.com'):
                    base_url = origin
                else:
                    base_url = 'https://screenmerch.com'
                
                session = stripe.checkout.Session.create(
                    payment_method_types=["card"],
                    mode="payment",
                    line_items=line_items,
                    success_url=f"{base_url}/order-success?order_id={order_id}",
                    cancel_url=f"{base_url}/checkout",
                    phone_number_collection={"enabled": True},
                    payment_intent_data={"statement_descriptor": "ScreenMerch"},
                    metadata={
                        "order_id": order_id,
                        "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
                        "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                        "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
                    },
                )
                next_url = session.url
        except Exception:
            pass
        
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


@orders_bp.route("/create-checkout-session", methods=["POST", "OPTIONS"])
@orders_bp.route("/api/create-checkout-session", methods=["POST", "OPTIONS"])
def create_checkout_session():
    """Create Stripe checkout session"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        data = read_json()
        cart = data.get("cart", [])
        product_id = data.get("product_id")
        sms_consent = data.get("sms_consent", False)
        
        # Validate product availability
        is_valid, error_msg = _validate_product_availability(cart)
        if not is_valid:
            response = jsonify({"error": error_msg})
            return _allow_origin(response), 400
        
        # Validate shipping address
        ok, addr_result = require_shipping_address(data)
        if not ok:
            response = jsonify({"error": addr_result})
            return _allow_origin(response), 400
        
        shipping_address = addr_result
        
        # Ensure shipping_cost is valid
        shipping_cost_raw = data.get("shipping_cost", 5.99)
        try:
            shipping_cost = float(shipping_cost_raw) if shipping_cost_raw is not None else 5.99
            if shipping_cost < 0:
                shipping_cost = 5.99
        except (ValueError, TypeError):
            shipping_cost = 5.99
        
        if not cart or not isinstance(cart, list):
            response = jsonify({"error": "Cart is empty or invalid"})
            return _allow_origin(response), 400
        
        # Generate order ID
        full_uuid = str(uuid.uuid4())
        order_id = f"ORD-{full_uuid[:8].upper()}"
        total_amount = sum(item.get('price', 0) for item in cart) + shipping_cost
        
        # Get screenshot from cart items
        checkout_screenshot = None
        for item in cart:
            screenshot = item.get("selected_screenshot") or item.get("screenshot") or item.get("img") or item.get("thumbnail")
            if screenshot and isinstance(screenshot, str) and screenshot.strip():
                checkout_screenshot = screenshot
                break
        
        # Fallback to top-level payload
        if not checkout_screenshot:
            checkout_screenshot = data.get("selected_screenshot") or data.get("thumbnail") or data.get("screenshot")
        
        # Enrich cart items
        enriched_cart = []
        for item in cart:
            enriched_item = item.copy()
            item_screenshot = (item.get("selected_screenshot") or item.get("screenshot") or 
                             item.get("img") or item.get("thumbnail") or checkout_screenshot)
            enriched_item.update({
                "videoName": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                "creatorName": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
                "timestamp": data.get("screenshot_timestamp", data.get("timestamp", "Not provided")),
                "selected_screenshot": item_screenshot
            })
            enriched_cart.append(enriched_item)
        
        # Extract subdomain
        creator_user_id_from_subdomain = None
        subdomain_from_request = None
        try:
            origin = request.headers.get('Origin', '')
            if origin and origin.endswith('.screenmerch.com') and origin.startswith('https://'):
                parsed = urlparse(origin)
                hostname = parsed.netloc
                subdomain_from_request = hostname.replace('.screenmerch.com', '').lower()
                if subdomain_from_request and subdomain_from_request != 'www':
                    client = _get_supabase_admin()
                    if client:
                        creator_result = client.table('users').select('id, display_name').eq('subdomain', subdomain_from_request).limit(1).execute()
                        if creator_result.data and len(creator_result.data) > 0:
                            creator_user_id_from_subdomain = creator_result.data[0]['id']
        except Exception:
            pass
        
        # Store order in database
        order_data = {
            "order_id": order_id,
            "cart": enriched_cart,
            "sms_consent": sms_consent,
            "customer_email": data.get("user_email", ""),
            "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
            "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator")),
            "creator_user_id": creator_user_id_from_subdomain,
            "subdomain": subdomain_from_request,
            "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
            "total_amount": total_amount,
            "shipping_cost": shipping_cost,
            "shipping_address": shipping_address,
            "status": "pending"
        }
        
        if checkout_screenshot:
            order_data["selected_screenshot"] = checkout_screenshot
        order_ts = data.get("screenshot_timestamp") or data.get("timestamp")
        if order_ts is not None and str(order_ts).strip():
            order_data["screenshot_timestamp"] = str(order_ts)
        
        client = _get_supabase_client()
        order_store = _get_order_store()
        
        try:
            if client:
                client.table('orders').insert(order_data).execute()
                logger.info("Order %s stored in database (with screenshot: %s)", order_id, bool(checkout_screenshot))
        except Exception as e:
            logger.error("Failed to store order %s in database: %s", order_id, e)
        
        # Keep in-memory backup (include selected_screenshot so webhook/get-order-screenshot can use it)
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
        if checkout_screenshot:
            order_store[order_id]["selected_screenshot"] = checkout_screenshot
        
        # Build Stripe line items
        products = _get_products_list()
        line_items = []
        for item in cart:
            item_price = item.get('price')
            if item_price and item_price > 0:
                unit_amount = int(item_price * 100)
            else:
                product_info = next((p for p in products if p.get("name") == item.get("product")), None)
                if not product_info:
                    product_info = next((p for p in products if p.get("name", "").lower() == item.get("product", "").lower()), None)
                if not product_info:
                    continue
                unit_amount = int(product_info.get("price", 0) * 100)
            
            line_items.append({
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": item.get("product", "Item")},
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
        
        if not line_items:
            response = jsonify({"error": "No valid items in cart to check out."})
            return _allow_origin(response), 400
        
        # Detect origin/subdomain
        origin = request.headers.get('Origin', 'https://screenmerch.com')
        if origin and origin.startswith('https://') and origin.endswith('.screenmerch.com'):
            base_url = origin
        else:
            base_url = 'https://screenmerch.com'
        
        # Create Stripe session
        try:
            _ensure_stripe_test_mode()
        except ValueError as e:
            response = jsonify({"error": "Payment system configuration error", "details": str(e)})
            return _allow_origin(response), 500
        
        session_params = {
            "payment_method_types": ["card"],
            "mode": "payment",
            "line_items": line_items,
            "success_url": f"{base_url}/order-success?order_id={order_id}",
            "cancel_url": f"{base_url}/checkout/{product_id or ''}",
            "phone_number_collection": {"enabled": True},
            "payment_intent_data": {"statement_descriptor": "ScreenMerch"},
            "metadata": {
                "order_id": order_id,
                "video_url": data.get("videoUrl", data.get("video_url", "Not provided")),
                "video_title": data.get("videoTitle", data.get("video_title", "Unknown Video")),
                "creator_name": data.get("creatorName", data.get("creator_name", "Unknown Creator"))
            }
        }
        
        # Pre-populate customer email if available
        user_email = data.get("user_email", data.get("customer_email", ""))
        if user_email and user_email.strip():
            session_params["customer_email"] = user_email.strip()
        
        session = stripe.checkout.Session.create(**session_params)
        response = jsonify({"url": session.url})
        return _allow_origin(response), 200
        
    except stripe.error.StripeError as e:
        logger.error(f"❌ Stripe error: {str(e)}")
        response = jsonify({"error": "Payment processing error", "details": str(e)})
        return _allow_origin(response), 500
    except Exception as e:
        logger.error(f"❌ Error creating checkout session: {str(e)}")
        response = jsonify({"error": "Failed to create checkout session", "details": str(e)})
        return _allow_origin(response), 500


@orders_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    """Handle Stripe webhook events"""
    payload = request.data
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = _get_config('STRIPE_WEBHOOK_SECRET')
    
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return "Webhook error", 400
    
    # Handle checkout.session.completed events
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        logger.info(f"Payment received for session: {session.get('id')}")
        order_id = session.get("metadata", {}).get("order_id")
        
        if order_id:
            try:
                client = _get_supabase_client()
                order_store = _get_order_store()
                
                # Get order from database
                if client:
                    db_result = client.table('orders').select('*').eq('order_id', order_id).execute()
                    if db_result.data:
                        order_data = db_result.data[0]
                        cart = order_data.get("cart", [])
                        if isinstance(cart, str):
                            try:
                                cart = json.loads(cart) if cart.strip() else []
                            except Exception:
                                cart = []
                        if not isinstance(cart, list):
                            cart = []
                        # Prefer in-memory cart when available so email and Print Quality get per-product screenshots (DB cart may be truncated)
                        if order_id in order_store:
                            store_cart = order_store[order_id].get("cart", [])
                            if isinstance(store_cart, list) and len(store_cart) == len(cart):
                                has_screenshots = any(
                                    isinstance(it, dict) and (it.get("selected_screenshot") or it.get("screenshot") or it.get("img") or it.get("thumbnail"))
                                    for it in store_cart
                                )
                                if has_screenshots:
                                    cart = store_cart
                                    order_data = dict(order_data)
                                    order_data["cart"] = cart
                                    logger.info("Using order_store cart for email (per-product screenshots)")
                        # If DB has no order-level screenshot, set from first cart item (so email gets one correct screenshot)
                        if not (order_data.get("selected_screenshot") or order_data.get("screenshot") or order_data.get("thumbnail")):
                            for item in cart:
                                if isinstance(item, dict):
                                    s = item.get("selected_screenshot") or item.get("screenshot") or item.get("img") or item.get("thumbnail")
                                    if s and isinstance(s, str) and s.strip():
                                        order_data = dict(order_data)
                                        order_data["selected_screenshot"] = s
                                        break
                    elif order_id in order_store:
                        order_data = order_store[order_id]
                        cart = order_data.get("cart", [])
                    else:
                        logger.error(f"Order ID {order_id} not found")
                        return "", 200
                else:
                    if order_id in order_store:
                        order_data = order_store[order_id]
                        cart = order_data.get("cart", [])
                    else:
                        return "", 200
                if isinstance(cart, str):
                    try:
                        cart = json.loads(cart) if cart.strip() else []
                    except Exception:
                        cart = []
                if not isinstance(cart, list):
                    cart = []

                # Get customer details from Stripe
                customer_details = session.get("customer_details", {})
                customer_name = customer_details.get("name", "Not provided")
                customer_email = customer_details.get("email", "Not provided")
                customer_phone = session.get("customer_details", {}).get("phone", "")
                
                if not customer_email or customer_email == "Not provided":
                    customer_email = session.get("customer_email") or order_data.get("customer_email", "")
                
                # Get shipping address
                shipping_details = session.get("shipping_details")
                shipping_address = {}
                if shipping_details:
                    shipping_address = shipping_details.get("address", {})
                
                # Calculate total
                total_amount = sum(item.get('price', 0) for item in cart)
                
                # Get creator_user_id
                creator_user_id = order_data.get('creator_user_id')
                if not creator_user_id:
                    subdomain = order_data.get('subdomain')
                    if subdomain:
                        try:
                            admin_client = _get_supabase_admin()
                            if admin_client:
                                creator_result = admin_client.table('users').select('id').eq('subdomain', subdomain).limit(1).execute()
                                if creator_result.data and len(creator_result.data) > 0:
                                    creator_user_id = creator_result.data[0]['id']
                        except Exception:
                            pass
                
                # Record sales
                for item in cart:
                    item['video_title'] = order_data.get('video_title', 'Unknown Video')
                    item['creator_name'] = order_data.get('creator_name', 'Unknown Creator')
                    _record_sale(item, user_id=creator_user_id, order_id=order_id)
                
                # Send admin notification email (single source: build_admin_order_email — one screenshot, Print Quality link, no admin login)
                resend_api_key = _get_config('RESEND_API_KEY')
                resend_from = _get_config('RESEND_FROM', 'noreply@screenmerch.com')
                mail_to = _get_config('MAIL_TO')
                
                if resend_api_key and mail_to:
                    try:
                        order_number = order_id[-8:].upper() if len(order_id) >= 8 else order_id
                        html_body, email_attachments = build_admin_order_email(
                            order_id, order_data, cart, order_number, total_amount
                        )
                        resend_attachments = resend_attachments_from_builder(email_attachments)
                        # Exactly one screenshot attachment per order (no multiple/lingering images)
                        resend_attachments = resend_attachments[:1] if resend_attachments else []
                        email_data = {
                            "from": resend_from,
                            "to": [mail_to],
                            "subject": f"🛍️ New ScreenMerch Order - {len(cart)} Item(s) - ${total_amount:.2f} - {customer_name}",
                            "html": html_body
                        }
                        if resend_attachments:
                            email_data["attachments"] = resend_attachments
                        requests.post(
                            "https://api.resend.com/emails",
                            headers={
                                "Authorization": f"Bearer {resend_api_key}",
                                "Content-Type": "application/json"
                            },
                            json=email_data,
                            timeout=30
                        )
                        # Persist screenshot to DB so Print Quality page can load it later (same as in email)
                        try:
                            screenshot_for_db, _ = get_screenshot_for_order(order_data, cart)
                            if screenshot_for_db and isinstance(screenshot_for_db, str) and screenshot_for_db.strip().startswith("data:image"):
                                max_size = 800000
                                to_store = screenshot_for_db
                                if len(screenshot_for_db) > max_size:
                                    to_store = _compress_for_inline(screenshot_for_db, max_bytes=750000, max_width=800)
                                if to_store and len(to_store) <= max_size:
                                    client = _get_supabase_client()
                                    if client:
                                        client.table('orders').update({'selected_screenshot': to_store}).eq('order_id', order_id).execute()
                                        logger.info("Persisted screenshot to order for Print Quality page")
                                elif not to_store:
                                    logger.warning("Screenshot too large and compression failed, Print Quality may not load it")
                        except Exception as persist_err:
                            logger.warning("Could not persist screenshot to order: %s", persist_err)
                    except Exception as e:
                        logger.exception("Webhook admin email failed: %s", e)
                
                # Send customer confirmation email
                if customer_email and customer_email != "Not provided" and resend_api_key:
                    try:
                        logger.info("Webhook: sending order confirmation email to customer")
                        customer_html = f"""
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h1>🎉 Thank You for Your Order!</h1>
                            <p>Hi there,</p>
                            <p>We've received your order and payment has been confirmed. We're getting it ready for you!</p>
                            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h2>Order Details</h2>
                                <p><strong>Order Number:</strong> #{order_id[-8:].upper()}</p>
                                <p><strong>Items:</strong> {len(cart)}</p>
                                <p><strong>Total:</strong> ${total_amount:.2f}</p>
                            </div>
                            <p>We'll send you another email when your order ships!</p>
                        </div>
                        """
                        
                        customer_email_data = {
                            "from": resend_from,
                            "to": [customer_email],
                            "subject": f"🎉 Order Confirmation - #{order_id[-8:].upper()}",
                            "html": customer_html
                        }
                        
                        r = requests.post(
                            "https://api.resend.com/emails",
                            headers={
                                "Authorization": f"Bearer {resend_api_key}",
                                "Content-Type": "application/json"
                            },
                            json=customer_email_data,
                            timeout=30
                        )
                        if r.status_code in (200, 201, 202):
                            logger.info("Webhook: order confirmation email sent to customer")
                        else:
                            logger.warning("Webhook: Resend customer email failed %s %s", r.status_code, r.text[:200])
                    except Exception as email_err:
                        logger.exception("Webhook: exception sending customer order email: %s", email_err)
                else:
                    if not customer_email or customer_email == "Not provided":
                        logger.warning("Webhook: skipping customer order email (no customer email)")
                    elif not resend_api_key:
                        logger.warning("Webhook: skipping customer order email (RESEND_API_KEY not set)")
                
                # Update order status to 'paid'
                try:
                    if client:
                        update_data = {
                            'status': 'paid',
                            'customer_phone': customer_phone,
                            'stripe_session_id': session.get('id'),
                            'payment_intent_id': session.get('payment_intent')
                        }
                        if customer_email and customer_email != "Not provided":
                            update_data['customer_email'] = customer_email
                        client.table('orders').update(update_data).eq('order_id', order_id).execute()
                        
                        # Ensure order is in processing queue
                        admin_client = _get_supabase_admin() or client
                        queue_check = admin_client.table('order_processing_queue').select('id').eq('order_id', order_id).execute()
                        if not queue_check.data:
                            queue_entry = {
                                'order_id': order_id,
                                'status': 'pending',
                                'priority': 0
                            }
                            admin_client.table('order_processing_queue').insert(queue_entry).execute()
                except Exception:
                    pass
            except Exception as e:
                logger.error(f"Error processing order in webhook: {str(e)}")
        
        # Handle subscription events (if not a product order)
        if not order_id and session.get("mode") == "subscription":
            logger.info(f"Subscription checkout completed: {session.get('id')}")
            # Subscription handling can be added here if needed
    
    return "", 200


@orders_bp.route("/success")
def success():
    """Order success page"""
    order_id = request.args.get('order_id')
    logger.info(f"🎯 Success page visited with order_id: {order_id}")
    
    if order_id:
        try:
            client = _get_supabase_client()
            order_store = _get_order_store()
            
            order_data = None
            if client:
                db_result = client.table('orders').select('*').eq('order_id', order_id).execute()
                if db_result.data:
                    order_data = db_result.data[0]
                    cart = order_data.get("cart", [])
                elif order_id in order_store:
                    order_data = order_store[order_id]
                    cart = order_data.get("cart", [])
            
            if order_data:
                # Record sales if status is still pending
                order_status = order_data.get('status', 'pending')
                if order_status == 'pending':
                    creator_user_id = order_data.get('creator_user_id')
                    if not creator_user_id:
                        subdomain = order_data.get('subdomain')
                        if subdomain:
                            try:
                                admin_client = _get_supabase_admin()
                                if admin_client:
                                    creator_result = admin_client.table('users').select('id').eq('subdomain', subdomain).limit(1).execute()
                                    if creator_result.data and len(creator_result.data) > 0:
                                        creator_user_id = creator_result.data[0]['id']
                            except Exception:
                                pass
                    
                    for item in cart:
                        _record_sale(item, user_id=creator_user_id, order_id=order_id)
            
            return render_template('success.html')
        except Exception as e:
            logger.error(f"Error in success page: {str(e)}")
    
    return render_template('success.html')


@orders_bp.route("/api/get-order-screenshot/<order_id>")
def get_order_screenshot(order_id):
    """Get screenshot data for a specific order"""
    try:
        client = _get_supabase_client()
        order_store = _get_order_store()
        
        order_data = None
        if client:
            result = client.table('orders').select('*').eq('order_id', order_id).execute()
            if result.data:
                order_data = result.data[0]
            elif order_id in order_store:
                order_data = order_store[order_id]
        else:
            if order_id in order_store:
                order_data = order_store[order_id]
        
        if not order_data:
            response = jsonify({
                "success": False,
                "error": "Order not found"
            })
            origin = request.headers.get('Origin')
            if origin in ["https://screenmerch.fly.dev", "https://screenmerch.com", "https://www.screenmerch.com"]:
                response.headers.add('Access-Control-Allow-Origin', origin)
            else:
                response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.com')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response, 404
        
        cart = order_data.get('cart', [])
        order_level_screenshot = (order_data.get('selected_screenshot') or 
                                 order_data.get('thumbnail') or 
                                 order_data.get('screenshot'))
        
        # Build products list with screenshots
        products = []
        for idx, item in enumerate(cart):
            product_name = item.get('product', f'Product {idx + 1}')
            color = item.get('variants', {}).get('color', 'N/A')
            size = item.get('variants', {}).get('size', 'N/A')
            
            screenshot_data = (item.get('selected_screenshot') or 
                             item.get('img') or 
                             item.get('screenshot') or 
                             item.get('thumbnail') or 
                             order_level_screenshot)
            
            if screenshot_data:
                products.append({
                    "index": idx,
                    "product": product_name,
                    "screenshot": screenshot_data,
                    "color": color,
                    "size": size
                })
            else:
                products.append({
                    "index": idx,
                    "product": product_name,
                    "screenshot": "",
                    "color": color,
                    "size": size
                })
        
        response = jsonify({
            "success": True,
            "order_id": order_id,
            "products": products,
            "video_url": order_data.get('video_url', ''),
            "video_title": order_data.get('video_title', ''),
            "creator_name": order_data.get('creator_name', ''),
            "screenshot_timestamp": order_data.get('screenshot_timestamp', '')
        })
        origin = request.headers.get('Origin')
        if origin in ["https://screenmerch.fly.dev", "https://screenmerch.com", "https://www.screenmerch.com"]:
            response.headers.add('Access-Control-Allow-Origin', origin)
        else:
            response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.com')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    except Exception as e:
        logger.error(f"Error in get_order_screenshot: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return _allow_origin(response), 500


@orders_bp.route("/api/test-order-email", methods=["POST"])
def test_order_email():
    """Test endpoint to send a sample order confirmation email"""
    try:
        resend_api_key = _get_config('RESEND_API_KEY')
        resend_from = _get_config('RESEND_FROM', 'noreply@screenmerch.com')
        mail_to = _get_config('MAIL_TO')
        
        if not resend_api_key or not mail_to:
            return jsonify({"success": False, "error": "Email service not configured"}), 500
        
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
        
        email_data = {
            "from": resend_from,
            "to": [mail_to],
            "subject": f"Test Order Confirmation #{sample_order['order_id']}",
            "html": html_body
        }
        
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json"
            },
            json=email_data
        )
        
        if response.status_code == 200:
            return jsonify({"success": True, "message": "Test order email sent successfully"})
        else:
            return jsonify({"success": False, "error": f"Failed to send email: {response.text}"}), 500
            
    except Exception as e:
        logger.error(f"Error in test_order_email: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500


@orders_bp.route("/api/calculate-shipping", methods=["POST", "OPTIONS"])
def calculate_shipping():
    """Calculate shipping cost for an order"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        data = request.get_json()
        shipping_address = data.get('shipping_address', {})
        country = shipping_address.get('country_code', 'US')
        cart = data.get('cart', [])
        
        if not cart:
            return jsonify({
                "success": False,
                "error": "No cart items provided"
            }), 400
        
        postal_code = _parse_zip(shipping_address)
        if not postal_code:
            return jsonify({
                "success": False,
                "error": "ZIP / Postal Code is required for shipping calculation"
            }), 400
        
        # Try Printful API
        printful_api_key = _get_config('PRINTFUL_API_KEY')
        if printful_api_key:
            try:
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
                
                response = requests.post(
                    "https://api.printful.com/shipping/rates",
                    json=shipping_payload,
                    headers=headers,
                    timeout=10
                )
                
                if response.status_code == 200:
                    shipping_response = response.json()
                    if 'result' in shipping_response:
                        rates_list = shipping_response['result']
                        if rates_list and len(rates_list) > 0:
                            rate = rates_list[0]
                            cost = rate.get('rate') or rate.get('cost') or rate.get('price')
                            if cost:
                                return jsonify({
                                    "success": True,
                                    "shipping_cost": float(cost),
                                    "currency": "USD",
                                    "delivery_days": str(rate.get('minDeliveryDays', '5-7')),
                                    "shipping_method": rate.get('name', 'Standard Shipping')
                                })
            except Exception:
                pass
        
        # Fallback: default shipping cost
        return jsonify({
            "success": True,
            "shipping_cost": 5.99,
            "currency": "USD",
            "delivery_days": "5-7",
            "shipping_method": "Standard Shipping"
        })
        
    except Exception as e:
        logger.error(f"Error calculating shipping: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Shipping calculation failed: {str(e)}"
        }), 500


@orders_bp.route("/api/printful/create-order", methods=["POST"])
def create_printful_order():
    """Create order in Printful automatically"""
    try:
        data = request.get_json()
        cart = data['cart']
        customer_info = data['customerInfo']
        
        # This would use printful_integration if available
        # For now, return a placeholder response
        return jsonify({
            "success": False,
            "error": "Printful integration not fully configured"
        }), 500
            
    except Exception as e:
        logger.error(f"Printful order creation error: {str(e)}")
        return jsonify(success=False, error="Internal server error"), 500
