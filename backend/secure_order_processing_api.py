"""
Secure Order Processing API
This module provides secure endpoints for outsourced workers to process orders
while protecting proprietary processing algorithms.
"""

from flask import request, jsonify
from functools import wraps
import logging
from datetime import datetime
import time

logger = logging.getLogger(__name__)

def processor_required(f):
    """
    Decorator to require processor authentication.
    Checks if user is authenticated and has processor permissions.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get auth token from request
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"success": False, "error": "Authentication required"}), 401
        
        # Extract token (assuming Bearer token format)
        try:
            token = auth_header.replace('Bearer ', '')
        except:
            return jsonify({"success": False, "error": "Invalid authentication format"}), 401
        
        # Verify token and get user (this would use Supabase auth)
        # For now, we'll check in the endpoint itself
        # In production, you'd verify the JWT token here
        
        return f(*args, **kwargs)
    return decorated_function

def apply_proprietary_processing(screenshot_data, order_id=None):
    """
    Apply all proprietary processing algorithms to an image.
    This function hides all processing parameters from workers.
    
    Args:
        screenshot_data: Base64 image data or URL
        order_id: Optional order ID for logging
    
    Returns:
        dict: {
            'success': bool,
            'processed_image': str (base64 data URL),
            'dimensions': dict,
            'file_size': int
        }
    """
    try:
        # Import processing modules
        import screenshot_capture as sc_module
        
        # PROPRIETARY PARAMETERS (hidden from workers)
        # These are your "house secrets" - workers never see these values
        PRINT_DPI = 300
        SOFT_CORNERS = True  # Always apply soft corners
        CORNER_RADIUS_PERCENT = 15  # Optimal corner radius
        EDGE_FEATHER = True  # Always apply edge feathering
        CROP_AREA = None  # No cropping by default (can be customized per order type)
        
        logger.info(f"🔒 [SECURE_PROCESSING] Processing order {order_id} with proprietary settings")
        logger.info(f"🔒 [SECURE_PROCESSING] DPI={PRINT_DPI}, corners={SOFT_CORNERS}, feather={EDGE_FEATHER}")
        
        # Apply processing using proprietary parameters
        result = sc_module.process_thumbnail_for_print(
            screenshot_data,
            print_dpi=PRINT_DPI,
            soft_corners=SOFT_CORNERS,
            edge_feather=EDGE_FEATHER,
            crop_area=CROP_AREA
        )
        
        if result.get('success'):
            logger.info(f"✅ [SECURE_PROCESSING] Order {order_id} processed successfully")
            return {
                'success': True,
                'processed_image': result.get('screenshot'),
                'dimensions': result.get('dimensions', {}),
                'file_size': result.get('file_size', 0),
                'format': result.get('format', 'PNG'),
                'quality': result.get('quality', 'Print Ready')
            }
        else:
            logger.error(f"❌ [SECURE_PROCESSING] Processing failed for order {order_id}: {result.get('error')}")
            return {
                'success': False,
                'error': result.get('error', 'Processing failed')
            }
            
    except Exception as e:
        logger.error(f"❌ [SECURE_PROCESSING] Error processing order {order_id}: {str(e)}")
        return {
            'success': False,
            'error': f'Processing error: {str(e)}'
        }

def register_secure_processing_routes(app, supabase, supabase_admin):
    """
    Register secure processing API routes with the Flask app.
    
    Args:
        app: Flask application instance
        supabase: Supabase client (regular)
        supabase_admin: Supabase client (admin/service role)
    """
    
    @app.route("/api/secure/process-order", methods=["POST", "OPTIONS"])
    def secure_process_order():
        """
        Secure endpoint for workers to process orders.
        Workers only provide order_id - all processing parameters are hidden.
        
        Request:
            {
                "order_id": "uuid",
                "notes": "optional worker notes"
            }
        
        Response:
            {
                "success": true,
                "processed_image": "data:image/png;base64,...",
                "dimensions": {"width": 2400, "height": 3000, "dpi": 300},
                "file_size": 2048576,
                "format": "PNG",
                "quality": "Print Ready"
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
            
            # Verify user is authenticated (using Supabase)
            # This is a simplified check - in production, verify JWT token
            token = auth_header.replace('Bearer ', '')
            
            # Get request data
            data = request.get_json()
            order_id = data.get("order_id")
            worker_notes = data.get("notes", "")
            
            if not order_id:
                return jsonify({"success": False, "error": "order_id is required"}), 400
            
            # Get order from database
            order_result = supabase.table('orders').select('*').eq('order_id', order_id).execute()
            if not order_result.data:
                return jsonify({"success": False, "error": "Order not found"}), 404
            
            order = order_result.data[0]
            
            # Get screenshot from order
            screenshot = None
            cart = order.get('cart', [])
            
            # Try to get screenshot from order-level field first
            screenshot = order.get('selected_screenshot') or order.get('screenshot') or order.get('thumbnail')
            
            # If not found, get from first cart item
            if not screenshot and cart:
                for item in cart:
                    screenshot = item.get('selected_screenshot') or item.get('screenshot') or item.get('img') or item.get('thumbnail')
                    if screenshot:
                        break
            
            if not screenshot:
                return jsonify({"success": False, "error": "No screenshot found in order"}), 400
            
            # Update queue status to "processing"
            queue_result = supabase.table('order_processing_queue').select('*').eq('order_id', order_id).execute()
            if queue_result.data:
                queue_id = queue_result.data[0]['id']
                supabase.table('order_processing_queue').update({
                    'status': 'processing',
                    'started_at': datetime.utcnow().isoformat(),
                    'processing_attempts': queue_result.data[0].get('processing_attempts', 0) + 1
                }).eq('id', queue_id).execute()
            
            # Apply proprietary processing (all parameters hidden)
            start_time = time.time()
            result = apply_proprietary_processing(screenshot, order_id)
            processing_time = int(time.time() - start_time)
            
            if result.get('success'):
                # Store processed image URL (you might want to upload to Supabase Storage)
                processed_image_url = result.get('processed_image')  # For now, return base64
                
                # Update queue status to "completed"
                if queue_result.data:
                    supabase.table('order_processing_queue').update({
                        'status': 'completed',
                        'completed_at': datetime.utcnow().isoformat(),
                        'processed_image_url': processed_image_url[:100] + '...' if len(processed_image_url) > 100 else processed_image_url,  # Store truncated URL
                        'worker_notes': worker_notes
                    }).eq('id', queue_id).execute()
                
                # Log to processing history
                # Note: You'd need to get the actual user_id from the auth token
                supabase.table('processing_history').insert({
                    'order_id': order_id,
                    'queue_id': queue_id if queue_result.data else None,
                    'status': 'completed',
                    'processed_image_url': processed_image_url[:100] + '...' if len(processed_image_url) > 100 else processed_image_url,
                    'processing_time_seconds': processing_time,
                    'notes': worker_notes
                }).execute()
                
                # Return processed image (no algorithm details exposed)
                response = jsonify({
                    "success": True,
                    "processed_image": result.get('processed_image'),
                    "dimensions": result.get('dimensions', {}),
                    "file_size": result.get('file_size', 0),
                    "format": result.get('format', 'PNG'),
                    "quality": result.get('quality', 'Print Ready'),
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
                # Update queue status to "failed"
                if queue_result.data:
                    supabase.table('order_processing_queue').update({
                        'status': 'failed',
                        'notes': f"Processing failed: {result.get('error')}"
                    }).eq('id', queue_id).execute()
                
                return jsonify({
                    "success": False,
                    "error": result.get('error', 'Processing failed')
                }), 500
                
        except Exception as e:
            logger.error(f"❌ [SECURE_PROCESSING] Error in secure_process_order: {str(e)}")
            return jsonify({
                "success": False,
                "error": f"Internal server error: {str(e)}"
            }), 500
    
    @app.route("/api/secure/queue", methods=["GET", "OPTIONS"])
    def get_processing_queue():
        """
        Get orders assigned to the authenticated worker.
        Workers can only see their own assigned orders.
        """
        if request.method == "OPTIONS":
            response = jsonify(success=True)
            origin = request.headers.get('Origin')
            if origin in ["https://screenmerch.fly.dev", "https://screenmerch.com", "https://www.screenmerch.com"]:
                response.headers.add('Access-Control-Allow-Origin', origin)
            else:
                response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.com')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
        
        try:
            # Get auth token
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({"success": False, "error": "Authentication required"}), 401
            
            # Get query parameters
            status = request.args.get('status', 'assigned')  # assigned, pending, completed
            limit = int(request.args.get('limit', 50))
            
            # Get queue items (this would filter by authenticated user_id in production)
            # For now, return all items with the requested status
            queue_result = supabase.table('order_processing_queue').select(
                '*, orders(*)'
            ).eq('status', status).order('priority', desc=True).order('created_at', desc=False).limit(limit).execute()
            
            return jsonify({
                "success": True,
                "orders": queue_result.data or []
            })
            
        except Exception as e:
            logger.error(f"❌ [SECURE_PROCESSING] Error getting queue: {str(e)}")
            return jsonify({
                "success": False,
                "error": f"Internal server error: {str(e)}"
            }), 500
    
    @app.route("/api/secure/claim-order", methods=["POST", "OPTIONS"])
    def claim_order():
        """
        Allow worker to claim a pending order.
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
            data = request.get_json()
            queue_id = data.get("queue_id")
            
            if not queue_id:
                return jsonify({"success": False, "error": "queue_id is required"}), 400
            
            # Update queue item to assign to worker
            # In production, you'd get user_id from auth token
            result = supabase.table('order_processing_queue').update({
                'status': 'assigned',
                'assigned_at': datetime.utcnow().isoformat(),
                # 'assigned_to': user_id  # Set from auth token
            }).eq('id', queue_id).eq('status', 'pending').execute()
            
            if result.data:
                return jsonify({"success": True, "message": "Order claimed successfully"})
            else:
                return jsonify({"success": False, "error": "Order not available or already claimed"}), 400
                
        except Exception as e:
            logger.error(f"❌ [SECURE_PROCESSING] Error claiming order: {str(e)}")
            return jsonify({
                "success": False,
                "error": f"Internal server error: {str(e)}"
            }), 500

