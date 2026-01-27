"""Product routes Blueprint for ScreenMerch"""
from flask import Blueprint, request, jsonify, render_template, redirect
from flask_cors import cross_origin
import logging
import json
import uuid
import time
import os

# Import utilities
from utils.helpers import _allow_origin

logger = logging.getLogger(__name__)

# Create Blueprint
products_bp = Blueprint('products', __name__)


def register_products_routes(app, supabase, products_list, product_data_store, printful_integration=None):
    """
    Register product routes with the Flask app
    
    Args:
        app: Flask application instance
        supabase: Supabase client
        products_list: List of product definitions (PRODUCTS array)
        product_data_store: In-memory product data store dictionary
        printful_integration: Printful integration instance (optional)
    """
    # Store dependencies in Blueprint
    products_bp.supabase = supabase
    products_bp.products_list = products_list
    products_bp.product_data_store = product_data_store
    products_bp.printful_integration = printful_integration
    
    # Register the Blueprint
    app.register_blueprint(products_bp)


def _get_supabase_client():
    """Get Supabase client"""
    return products_bp.supabase if hasattr(products_bp, 'supabase') else None


def _get_products_list():
    """Get products list"""
    return products_bp.products_list if hasattr(products_bp, 'products_list') else []


def _get_product_data_store():
    """Get product data store"""
    return products_bp.product_data_store if hasattr(products_bp, 'product_data_store') else {}


def _get_printful_integration():
    """Get Printful integration"""
    return products_bp.printful_integration if hasattr(products_bp, 'printful_integration') else None


def _filter_products_by_category(category):
    """Filter products based on category selection"""
    products = _get_products_list()
    
    if not category or category == "all" or category == "all-products":
        return products
    
    # Special handling for thumbnails category
    if category == "thumbnails":
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
    
    # Define category mappings
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
        ]
    }
    
    category_products = category_mappings.get(category, [])
    filtered_products = []
    
    for product in products:
        if product.get("name") in category_products:
            filtered_products.append(product)
    
    return filtered_products


def _handle_cors_preflight():
    """Handle CORS preflight requests"""
    response = jsonify(success=True)
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cache-Control,Pragma,Expires')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response


@products_bp.route("/api/product/browse", methods=["GET", "OPTIONS"])
def get_browse_api():
    """API endpoint to get browse data for frontend"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        category = request.args.get('category', 'all')
        user_agent = request.headers.get('User-Agent', '')
        is_mobile = 'Mobile' in user_agent or 'Android' in user_agent or 'iPhone' in user_agent
        
        logger.info(f"📂 API Browse request - Category: {category}")
        logger.info(f"📱 Mobile detection: {is_mobile}")
        
        filtered_products = _filter_products_by_category(category)
        
        # Ensure all products have a description field
        for product in filtered_products:
            if 'description' not in product:
                product['description'] = ""
        
        if is_mobile:
            logger.info(f"📱 Mobile request - Found {len(filtered_products)} products for category '{category}'")
        
        screenshots = []
        thumbnail_url = ""
        
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
        
        if is_mobile:
            logger.info(f"📱 Sending response to mobile - {len(filtered_products)} products")
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"❌ Browse API error: {str(e)}")
        category = request.args.get('category', 'all')
        return jsonify({
            "success": False,
            "error": str(e),
            "products": [],
            "category": category
        }), 500


@products_bp.route("/api/product/<product_id>", methods=["GET", "OPTIONS"])
def get_product_api(product_id):
    """API endpoint to get product data for frontend"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        category = request.args.get('category', 'all')
        logger.info(f"📂 API Product request - ID: {product_id}, Category: {category}")
        
        filtered_products = _filter_products_by_category(category)
        client = _get_supabase_client()
        
        # Try to get product from database
        try:
            if client:
                result = client.table('products').select('*').eq('product_id', product_id).execute()
                
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
        except Exception as db_error:
            logger.error(f"Database error: {str(db_error)}")
        
        # Product not found in database, return default
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
        response.headers.add('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        response.headers.add('Pragma', 'no-cache')
        response.headers.add('Expires', '0')
        return response
            
    except Exception as e:
        logger.error(f"Error in get_product_api: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500


@products_bp.route("/api/create-product", methods=["POST", "OPTIONS"])
def create_product():
    """Create a new product"""
    if request.method == "OPTIONS":
        response = jsonify({"success": True})
        return _allow_origin(response)
    
    try:
        data = request.get_json()
        if not data:
            response = jsonify(success=False, error="No data received")
            return _allow_origin(response), 400
        
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
        
        client = _get_supabase_client()
        product_store = _get_product_data_store()
        
        # Try to save to Supabase first
        try:
            if client:
                client.table("products").insert({
                    "name": f"Custom Merch - {product_id[:8]}",
                    "price": 24.99,
                    "description": f"Custom merchandise from video",
                    "product_id": product_id,
                    "thumbnail_url": thumbnail,
                    "video_url": video_url,
                    "video_title": video_title,
                    "creator_name": creator_name,
                    "screenshots_urls": json.dumps(screenshots),
                    "category": "Custom Merch"
                }).execute()
                logger.info(f"✅ Successfully saved to Supabase database")
        except Exception as db_error:
            logger.error(f"❌ Database error: {str(db_error)}")
            logger.info("🔄 Trying without creator_name column...")
            try:
                if client:
                    client.table("products").insert({
                        "name": f"Custom Merch - {product_id[:8]}",
                        "price": 24.99,
                        "description": f"Custom merchandise from video",
                        "product_id": product_id,
                        "thumbnail_url": thumbnail,
                        "video_url": video_url,
                        "video_title": video_title,
                        "screenshots_urls": json.dumps(screenshots),
                        "category": "Custom Merch"
                    }).execute()
                    logger.info(f"✅ Successfully saved to Supabase database (without creator_name)")
            except Exception:
                logger.info("🔄 Falling back to in-memory storage")
                product_store[product_id] = {
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
        
        # Detect the origin/subdomain from the request
        origin = request.headers.get('Origin', 'https://screenmerch.com')
        if origin and origin.startswith('https://') and origin.endswith('.screenmerch.com'):
            base_url = origin
        else:
            base_url = 'https://screenmerch.com'
        
        merchandise_url = f"{base_url}/merchandise"
        if is_authenticated and user_email:
            merchandise_url += f"?authenticated=true&email={user_email}"
        
        response = jsonify({
            "success": True,
            "product_id": product_id,
            "product_url": merchandise_url
        })
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"❌ Error in create-product: {str(e)}")
        response = jsonify(success=False, error="Internal server error")
        return _allow_origin(response), 500


@products_bp.route("/api/printful/create-product", methods=["POST"])
def create_printful_product():
    """Create product in Printful automatically"""
    try:
        data = request.get_json()
        thumbnail = data['thumbnail']
        video_url = data['videoUrl']
        product_type = data['productType']
        variants = data['variants']
        
        printful = _get_printful_integration()
        if not printful:
            return jsonify({
                "success": False,
                "error": "Printful integration not available"
            }), 500
        
        # Create automated product in Printful
        result = printful.create_automated_product({
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
            
            client = _get_supabase_client()
            if client:
                client.table('products').insert(product_data).execute()
            
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


# Page routes (redirects to frontend)
@products_bp.route("/product/browse")
def show_browse_page():
    """Redirect to frontend browse page"""
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


@products_bp.route("/product/<product_id>")
def show_product_page(product_id):
    """Redirect product page to React frontend"""
    logger.info(f"🔍 Redirecting product page for ID: {product_id} to React frontend")
    
    category = request.args.get('category', 'all')
    authenticated = request.args.get('authenticated', 'false')
    email = request.args.get('email', '')
    
    frontend_url = "https://screenmerch.com"
    redirect_url = f"{frontend_url}/product/{product_id}?category={category}&authenticated={authenticated}&email={email}"
    
    logger.info(f"🔄 Redirecting to: {redirect_url}")
    
    response = redirect(redirect_url)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


@products_bp.route("/product-new/<product_id>")
def show_product_page_new(product_id):
    """Show product page (legacy route)"""
    logger.info(f"🔍 NEW ROUTE: Attempting to show product page for ID: {product_id}")
    
    category = request.args.get('category', 'all')
    logger.info(f"📂 Category filter: {category}")
    
    filtered_products = _filter_products_by_category(category)
    logger.info(f"🔍 Filtered {len(filtered_products)} products for category '{category}'")
    
    try:
        client = _get_supabase_client()
        product_store = _get_product_data_store()
        products = _get_products_list()
        
        # Try to get from Supabase first
        try:
            if client:
                logger.info(f"📊 Querying Supabase for product {product_id}")
                result = client.table('products').select('*').eq('product_id', product_id).execute()
                logger.info(f"📊 Supabase query result: {len(result.data) if result.data else 0} records")
                
                if result.data:
                    product_data = result.data[0]
                    logger.info(f"✅ Found product in database: {product_data.get('name', 'No name')}")
                    
                    screenshots = []
                    if product_data.get('screenshots_urls'):
                        try:
                            screenshots = json.loads(product_data.get('screenshots_urls'))
                            logger.info(f"📸 Parsed {len(screenshots)} screenshots")
                        except Exception:
                            screenshots = []
                    
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
                        raise template_error
        except Exception as supabase_error:
            logger.error(f"❌ Supabase error: {str(supabase_error)}")
        
        # Fallback to in-memory storage
        if product_id in product_store:
            logger.info(f"🔄 Found product in memory storage")
            product_data = product_store[product_id]
            
            # Find the specific product data from PRODUCTS array
            specific_product = None
            for p in products:
                if p.get('name') == product_data.get('name'):
                    specific_product = p
                    break
            
            if not specific_product:
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
    except Exception as e:
        logger.error(f"❌ Error in show_product_page for {product_id}: {str(e)}")
    
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


@products_bp.route("/simple-merchandise/<product_id>")
def simple_merchandise_page(product_id):
    """Show simple merchandise page"""
    logger.info(f"🔍 Showing simple merchandise page for ID: {product_id}")
    
    try:
        client = _get_supabase_client()
        if client:
            result = client.table('products').select('*').eq('product_id', product_id).execute()
            
            if result.data:
                product_data = result.data[0]
                
                screenshots = []
                if product_data.get('screenshots_urls'):
                    try:
                        screenshots = json.loads(product_data.get('screenshots_urls'))
                    except Exception:
                        screenshots = []
                
                return render_template(
                    'simple_merchandise.html',
                    img_url=product_data.get('thumbnail_url'),
                    screenshots=screenshots,
                    product_id=product_id
                )
            else:
                return "Product not found", 404
        else:
            return "Database not available", 500
                
    except Exception as db_error:
        logger.error(f"❌ Database error: {str(db_error)}")
        return "Database error", 500
        
    except Exception as e:
        logger.error(f"❌ Error in simple merchandise page: {str(e)}")
        return "Server error", 500


@products_bp.route("/checkout/<product_id>")
def checkout_page(product_id):
    """Checkout page"""
    logger.info(f"🔍 Checkout page requested for product ID: {product_id}")
    
    product_data = {
        'product_id': product_id,
        'video_title': 'Dynamic Product',
        'creator_name': 'ScreenMerch Creator'
    }
    
    return render_template('checkout.html', product_id=product_id, product_data=product_data)
