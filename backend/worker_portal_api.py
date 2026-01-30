"""
Worker Portal API - Complete order processing workflow
Handles: Image processing → Printful upload → Product creation → Order submission
Payment is automatically handled via Printful's stored payment method (no credit card needed)
"""

from flask import request, jsonify
import logging
from datetime import datetime
import time
import base64
import requests
from secure_order_processing_api import apply_proprietary_processing

logger = logging.getLogger(__name__)

def register_worker_portal_routes(app, supabase, supabase_admin, printful_integration):
    """
    Register worker portal API routes.
    
    Args:
        app: Flask application instance
        supabase: Supabase client (regular)
        supabase_admin: Supabase client (admin/service role)
        printful_integration: ScreenMerchPrintfulIntegration instance
    """
    
    @app.route("/api/worker/process-and-submit", methods=["POST", "OPTIONS"])
    def worker_process_and_submit():
        """
        Complete workflow for workers:
        1. Process image (300 DPI, edge feather, corner radius) - hidden algorithms
        2. Upload processed image to Printful
        3. Create product in Printful (if needed)
        4. Submit order to Printful with customer address
        5. Payment automatically charged to Printful account (stored payment method)
        
        Request:
            {
                "order_id": "uuid",
                "notes": "optional worker notes"
            }
        
        Response:
            {
                "success": true,
                "printful_order_id": "12345",
                "printful_order_status": "pending",
                "tracking_url": "https://...",
                "message": "Order submitted successfully"
            }
        """
        if request.method == "OPTIONS":
            response = jsonify(success=True)
            origin = request.headers.get('Origin')
            if origin in ["https://screenmerch.fly.dev", "https://screenmerch.com", "https://www.screenmerch.com"]:
                response.headers.add('Access-Control-Allow-Origin', origin)
            else:
                response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.com')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
        
        try:
            # Get auth token
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({"success": False, "error": "Authentication required"}), 401
            
            # Get request data
            data = request.get_json()
            order_id = data.get("order_id")
            worker_notes = data.get("notes", "")
            
            if not order_id:
                return jsonify({"success": False, "error": "order_id is required"}), 400
            
            logger.info(f"🔄 [WORKER_PORTAL] Processing order {order_id}")
            
            # Step 1: Get order from database
            order_result = supabase.table('orders').select('*').eq('order_id', order_id).execute()
            if not order_result.data:
                return jsonify({"success": False, "error": "Order not found"}), 404
            
            order = order_result.data[0]
            cart = order.get('cart', [])
            
            if not cart:
                return jsonify({"success": False, "error": "Order cart is empty"}), 400
            
            # Get screenshot from order
            screenshot = order.get('selected_screenshot') or order.get('screenshot') or order.get('thumbnail')
            if not screenshot and cart:
                for item in cart:
                    screenshot = item.get('selected_screenshot') or item.get('screenshot') or item.get('img') or item.get('thumbnail')
                    if screenshot:
                        break
            
            if not screenshot:
                return jsonify({"success": False, "error": "No screenshot found in order"}), 400
            
            # Step 2: Process image with proprietary algorithms (hidden from worker)
            logger.info(f"🔒 [WORKER_PORTAL] Processing image with proprietary algorithms...")
            start_time = time.time()
            processed_result = apply_proprietary_processing(screenshot, order_id)
            processing_time = int(time.time() - start_time)
            
            if not processed_result.get('success'):
                return jsonify({
                    "success": False,
                    "error": f"Image processing failed: {processed_result.get('error')}"
                }), 500
            
            processed_image = processed_result.get('processed_image')
            logger.info(f"✅ [WORKER_PORTAL] Image processed successfully in {processing_time}s")
            
            # Step 3: Upload processed image to Printful
            logger.info(f"📤 [WORKER_PORTAL] Uploading image to Printful...")
            try:
                # Convert base64 to format Printful expects
                if processed_image.startswith('data:image'):
                    image_data = processed_image.split(',')[1]
                else:
                    image_data = processed_image
                
                # Upload to Printful
                uploaded_image = printful_integration.printful.upload_image(processed_image)
                printful_image_url = uploaded_image['url']
                logger.info(f"✅ [WORKER_PORTAL] Image uploaded to Printful: {printful_image_url}")
            except Exception as e:
                logger.error(f"❌ [WORKER_PORTAL] Failed to upload image to Printful: {str(e)}")
                return jsonify({
                    "success": False,
                    "error": f"Failed to upload image to Printful: {str(e)}"
                }), 500
            
            # Step 4: Prepare Printful order items
            printful_items = []
            for item in cart:
                product_name = item.get('product', 'Unknown Product')
                color = (item.get('variants') or {}).get('color', 'Black')
                size = (item.get('variants') or {}).get('size', 'M')
                quantity = item.get('quantity', 1)
                
                # Map product to Printful variant ID
                # This uses the product_mappings from printful_integration
                try:
                    variant_id = printful_integration._get_variant_id(product_name, color, size)
                except Exception as e:
                    logger.warning(f"⚠️ [WORKER_PORTAL] Error getting variant ID: {str(e)}")
                    variant_id = None
                
                if not variant_id:
                    logger.warning(f"⚠️ [WORKER_PORTAL] No variant mapping for {product_name} {color} {size}, using default")
                    variant_id = 4012  # Default to basic t-shirt
                
                printful_items.append({
                    "variant_id": variant_id,
                    "quantity": quantity,
                    "files": [{"url": printful_image_url}]
                })
            
            # Step 5: Get shipping address from order
            shipping_address = order.get('shipping_address', {})
            if not shipping_address:
                # Try to get from Stripe metadata or order data
                shipping_address = {
                    "name": order.get('customer_name', 'Customer'),
                    "address1": order.get('shipping_line1', ''),
                    "address2": order.get('shipping_line2', ''),
                    "city": order.get('shipping_city', ''),
                    "state_code": order.get('shipping_state', ''),
                    "country_code": order.get('shipping_country', 'US'),
                    "zip": order.get('shipping_postal_code', '')
                }
            
            # Step 6: Create order in Printful
            # IMPORTANT: confirm=true automatically charges your Printful account's stored payment method
            # Workers never see or need access to credit card information
            logger.info(f"📦 [WORKER_PORTAL] Creating order in Printful...")
            try:
                order_payload = {
                    "recipient": {
                        "name": shipping_address.get('name', 'Customer'),
                        "address1": shipping_address.get('address1', ''),
                        "address2": shipping_address.get('address2', ''),
                        "city": shipping_address.get('city', ''),
                        "state_code": shipping_address.get('state_code', ''),
                        "country_code": shipping_address.get('country_code', 'US'),
                        "zip": shipping_address.get('zip', '')
                    },
                    "items": printful_items,
                    "shipping": "STANDARD",
                    "confirm": True,  # Automatically confirm and charge stored payment method
                    "retail_costs": {
                        "currency": "USD",
                        "subtotal": str(order.get('total_amount', 0) - order.get('shipping_cost', 0)),
                        "total": str(order.get('total_amount', 0))
                    }
                }
                
                # Create order via Printful API
                printful_order = printful_integration.printful._make_request("/orders", "POST", order_payload)
                
                if printful_order and printful_order.get('result'):
                    printful_order_data = printful_order['result']
                    printful_order_id = printful_order_data.get('id')
                    printful_order_status = printful_order_data.get('status', 'pending')
                    
                    logger.info(f"✅ [WORKER_PORTAL] Order created in Printful: {printful_order_id}")
                    
                    # Step 7: Update order processing queue
                    queue_result = supabase.table('order_processing_queue').select('*').eq('order_id', order_id).execute()
                    if queue_result.data:
                        queue_id = queue_result.data[0]['id']
                        supabase.table('order_processing_queue').update({
                            'status': 'completed',
                            'completed_at': datetime.utcnow().isoformat(),
                            'processed_image_url': printful_image_url,
                            'worker_notes': worker_notes,
                            'notes': f"Printful Order ID: {printful_order_id}"
                        }).eq('id', queue_id).execute()
                    
                    # Step 8: Log to processing history
                    supabase.table('processing_history').insert({
                        'order_id': order_id,
                        'queue_id': queue_id if queue_result.data else None,
                        'status': 'completed',
                        'processed_image_url': printful_image_url,
                        'processing_time_seconds': processing_time,
                        'notes': f"Printful Order: {printful_order_id}. {worker_notes}"
                    }).execute()
                    
                    # Step 9: Update order in database with Printful order ID
                    supabase.table('orders').update({
                        'printful_order_id': str(printful_order_id),
                        'printful_order_status': printful_order_status,
                        'status': 'fulfilled',
                        'updated_at': datetime.utcnow().isoformat()
                    }).eq('order_id', order_id).execute()
                    
                    # Return success response
                    response = jsonify({
                        "success": True,
                        "printful_order_id": str(printful_order_id),
                        "printful_order_status": printful_order_status,
                        "tracking_url": printful_order_data.get('tracking_url', ''),
                        "printful_image_url": printful_image_url,
                        "message": "Order processed and submitted to Printful successfully. Payment automatically charged to account.",
                        "processing_time_seconds": processing_time
                    })
                    
                    # Add CORS headers
                    origin = request.headers.get('Origin')
                    if origin in ["https://screenmerch.fly.dev", "https://screenmerch.com", "https://www.screenmerch.com"]:
                        response.headers.add('Access-Control-Allow-Origin', origin)
                    else:
                        response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.com')
                    response.headers.add('Access-Control-Allow-Credentials', 'true')
                    
                    return response
                else:
                    raise Exception("Printful API returned invalid response")
                    
            except Exception as e:
                logger.error(f"❌ [WORKER_PORTAL] Failed to create Printful order: {str(e)}")
                return jsonify({
                    "success": False,
                    "error": f"Failed to create Printful order: {str(e)}"
                }), 500
                
        except Exception as e:
            logger.error(f"❌ [WORKER_PORTAL] Error in process_and_submit: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return jsonify({
                "success": False,
                "error": f"Internal server error: {str(e)}"
            }), 500

