"""Video routes Blueprint for ScreenMerch"""
from flask import Blueprint, request, jsonify, render_template, make_response
from flask_cors import cross_origin
import logging

# Import utilities
from utils.helpers import _allow_origin

logger = logging.getLogger(__name__)

# Create Blueprint
videos_bp = Blueprint('videos', __name__)


def register_videos_routes(app, supabase, screenshot_capture_module, sc_module):
    """
    Register video routes with the Flask app
    
    Args:
        app: Flask application instance
        supabase: Supabase client
        screenshot_capture_module: Screenshot capture module/class (from video_screenshot)
        sc_module: Screenshot capture module (imported as sc_module)
    """
    # Store dependencies in Blueprint
    videos_bp.supabase = supabase
    videos_bp.screenshot_capture = screenshot_capture_module
    videos_bp.sc_module = sc_module
    
    # Register the Blueprint
    app.register_blueprint(videos_bp)


def _get_supabase_client():
    """Get Supabase client"""
    return videos_bp.supabase if hasattr(videos_bp, 'supabase') else None


def _get_screenshot_capture():
    """Get screenshot capture module"""
    return videos_bp.screenshot_capture if hasattr(videos_bp, 'screenshot_capture') else None


def _get_sc_module():
    """Get sc_module"""
    return videos_bp.sc_module if hasattr(videos_bp, 'sc_module') else None


def _handle_cors_preflight():
    """Handle CORS preflight requests"""
    response = jsonify(success=True)
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cache-Control,Pragma,Expires')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response


@videos_bp.route("/api/videos", methods=["GET"])
def get_videos():
    """Get list of videos. Query params: category (optional), user_id (optional), limit (optional, default 100)."""
    try:
        client = _get_supabase_client()
        if not client:
            return jsonify({"error": "Database not available"}), 500
        category = request.args.get("category", "").strip() or None
        user_id = request.args.get("user_id", "").strip() or None
        limit = request.args.get("limit", "100").strip()
        try:
            limit = min(int(limit), 500) if limit.isdigit() else 100
        except ValueError:
            limit = 100
        query = client.table("videos2").select("*").order("created_at", desc=True).limit(limit)
        if category:
            query = query.eq("category", category)
        if user_id:
            query = query.eq("user_id", user_id)
        response = query.execute()
        return jsonify(response.data), 200
    except Exception as e:
        logger.error(f"Error fetching videos: {e}")
        return jsonify({"error": str(e)}), 500


@videos_bp.route("/api/search/creators", methods=["GET", "OPTIONS"])
@cross_origin(origins=[], supports_credentials=True)
def search_creators():
    """Search for creators by username or display name"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        query = request.args.get('q', '').strip()
        if not query or len(query) < 2:
            return jsonify({
                "success": False,
                "error": "Search query must be at least 2 characters"
            }), 400
        
        client = _get_supabase_client()
        if not client:
            return jsonify({"success": False, "error": "Database not available"}), 500
        
        response = client.table("users").select(
            "id, username, display_name, profile_image_url, cover_image_url, bio, created_at"
        ).or_(
            f"username.ilike.%{query}%,display_name.ilike.%{query}%"
        ).not_("username", "is", None).order("created_at", desc=True).limit(20).execute()
        
        if response.data:
            creators_with_counts = []
            for creator in response.data:
                creators_with_counts.append({
                    **creator,
                    "video_count": 0
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


@videos_bp.route("/api/video-info", methods=["POST", "OPTIONS"])
def get_video_info():
    """Get video information including duration and dimensions"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        data = request.get_json()
        video_url = data.get('video_url')
        
        if not video_url:
            return jsonify({"success": False, "error": "video_url is required"}), 400
        
        screenshot_capture = _get_screenshot_capture()
        if not screenshot_capture:
            return jsonify({"success": False, "error": "Screenshot capture service not available"}), 500
        
        result = screenshot_capture.get_video_info(video_url)
        
        if result.get('success'):
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        logger.error(f"Error in get_video_info: {str(e)}")
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@videos_bp.route("/api/capture-screenshot", methods=["POST", "OPTIONS"])
def capture_screenshot():
    """Capture a single screenshot from a video at a specific timestamp with optional cropping"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        data = request.get_json()
        video_url = data.get('video_url')
        timestamp = data.get('timestamp', 0)
        quality = data.get('quality', 95)
        crop_area = data.get('crop_area')
        
        if not video_url:
            return jsonify({"success": False, "error": "video_url is required"}), 400
        
        screenshot_capture = _get_screenshot_capture()
        if not screenshot_capture:
            return jsonify({"success": False, "error": "Screenshot capture service not available"}), 500
        
        result = screenshot_capture.capture_screenshot(video_url, timestamp, quality, crop_area)
        
        if result.get('success'):
            response = jsonify(result)
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response
        else:
            response = jsonify(result)
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 500
            
    except Exception as e:
        logger.error(f"Error in capture_screenshot: {str(e)}")
        response = jsonify({"success": False, "error": f"Internal server error: {str(e)}"})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500


@videos_bp.route("/api/capture-multiple-screenshots", methods=["POST", "OPTIONS"])
def capture_multiple_screenshots():
    """Capture multiple screenshots from a video at different timestamps"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        data = request.get_json()
        video_url = data.get('video_url')
        timestamps = data.get('timestamps', [0, 2, 4, 6, 8])
        quality = data.get('quality', 95)
        
        if not video_url:
            return jsonify({"success": False, "error": "video_url is required"}), 400
        
        screenshot_capture = _get_screenshot_capture()
        if not screenshot_capture:
            return jsonify({"success": False, "error": "Screenshot capture service not available"}), 500
        
        result = screenshot_capture.capture_multiple_screenshots(video_url, timestamps, quality)
        
        if result.get('success'):
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        logger.error(f"Error in capture_multiple_screenshots: {str(e)}")
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@videos_bp.route("/api/capture-print-quality", methods=["POST", "OPTIONS"])
def capture_print_quality():
    """Capture a high-quality screenshot optimized for print production"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        data = request.get_json()
        video_url = data.get('video_url')
        timestamp = data.get('timestamp', 0)
        crop_area = data.get('crop_area')
        print_dpi = data.get('print_dpi', 300)
        
        if not video_url:
            return jsonify({"success": False, "error": "video_url is required"}), 400
        
        screenshot_capture = _get_screenshot_capture()
        if not screenshot_capture:
            return jsonify({"success": False, "error": "Screenshot capture service not available"}), 500
        
        result = screenshot_capture.capture_print_quality_screenshot(
            video_url, 
            timestamp, 
            crop_area, 
            print_dpi
        )
        
        if result.get('success'):
            response = jsonify(result)
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response
        else:
            response = jsonify(result)
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 500
            
    except Exception as e:
        logger.error(f"Error in capture_print_quality: {str(e)}")
        response = jsonify({"success": False, "error": f"Internal server error: {str(e)}"})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500


@videos_bp.route("/api/process-shirt-image", methods=["POST", "OPTIONS"])
def process_shirt_image():
    """Process an image to be shirt-print ready with feathered edges"""
    origin = request.headers.get('Origin')
    allowed_origins = ["https://screenmerch.fly.dev", "https://screenmerch.com", "https://www.screenmerch.com"]
    cors_origin = origin if origin in allowed_origins else "https://screenmerch.fly.dev"
    
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', cors_origin)
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cache-Control,Pragma,Expires')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    
    try:
        data = request.get_json()
        image_data = data.get("image_data")
        feather_radius = data.get("feather_radius", 12)
        enhance_quality = data.get("enhance_quality", True)
        
        if not image_data:
            response = jsonify({"success": False, "error": "image_data is required"})
            response.headers.add('Access-Control-Allow-Origin', cors_origin)
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response, 400
        
        screenshot_capture = _get_screenshot_capture()
        if not screenshot_capture:
            response = jsonify({"success": False, "error": "Screenshot capture service not available"})
            response.headers.add('Access-Control-Allow-Origin', cors_origin)
            return response, 500
        
        processed_image = screenshot_capture.create_shirt_ready_image(
            image_data, 
            feather_radius=feather_radius, 
            enhance_quality=enhance_quality
        )
        
        response = jsonify({
            "success": True,
            "processed_image": processed_image
        })
        response.headers.add('Access-Control-Allow-Origin', cors_origin)
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
            
    except Exception as e:
        logger.error(f"Error processing shirt image: {str(e)}")
        response = jsonify({"success": False, "error": f"Internal server error: {str(e)}"})
        response.headers.add('Access-Control-Allow-Origin', cors_origin)
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 500


@videos_bp.route("/api/process-corner-radius", methods=["POST", "OPTIONS"])
def process_corner_radius():
    """Process an image to apply corner radius only"""
    origin = request.headers.get('Origin')
    allowed_origins = ["https://screenmerch.fly.dev", "https://screenmerch.com", "https://www.screenmerch.com"]
    cors_origin = origin if origin in allowed_origins else "https://screenmerch.fly.dev"
    
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', cors_origin)
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cache-Control,Pragma,Expires')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    
    try:
        data = request.get_json()
        image_data = data.get("image_data")
        corner_radius = data.get("corner_radius", 15)
        
        if not image_data:
            response = jsonify({"success": False, "error": "image_data is required"})
            response.headers.add('Access-Control-Allow-Origin', cors_origin)
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response, 400
        
        sc_module = _get_sc_module()
        if not sc_module:
            response = jsonify({"success": False, "error": "Image processing service not available"})
            response.headers.add('Access-Control-Allow-Origin', cors_origin)
            return response, 500
        
        result = sc_module.apply_corner_radius_only(image_data, corner_radius)
        
        if result and result.get('success'):
            processed_img = result.get('processed_image')
            if not processed_img:
                response = jsonify({"success": False, "error": "No processed image returned"})
                response.headers.add('Access-Control-Allow-Origin', cors_origin)
                response.headers.add('Access-Control-Allow-Credentials', 'true')
                return response, 500
            
            response = jsonify({
                "success": True,
                "processed_image": processed_img
            })
            response.headers.add('Access-Control-Allow-Origin', cors_origin)
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
        else:
            error_msg = result.get('error', 'Failed to apply corner radius') if result else 'Failed to apply corner radius'
            response = jsonify({"success": False, "error": error_msg})
            response.headers.add('Access-Control-Allow-Origin', cors_origin)
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response, 500
            
    except Exception as e:
        logger.error(f"Error processing corner radius: {str(e)}")
        response = jsonify({"success": False, "error": f"Internal server error: {str(e)}"})
        response.headers.add('Access-Control-Allow-Origin', cors_origin)
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 500


@videos_bp.route("/api/apply-feather-to-print-quality", methods=["POST", "OPTIONS"])
def apply_feather_to_print_quality():
    """Apply feather effect to a print quality image"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        data = request.get_json()
        image_data = data.get("image_data")
        feather_radius = data.get("feather_radius", 12)
        
        if not image_data:
            return jsonify({"success": False, "error": "image_data is required"}), 400
        
        sc_module = _get_sc_module()
        if not sc_module:
            return jsonify({"success": False, "error": "Image processing service not available"}), 500
        
        processed_image = sc_module.apply_feather_to_print_quality(image_data, feather_radius)
        
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


@videos_bp.route("/api/apply-feather-only", methods=["POST", "OPTIONS"])
def apply_feather_only():
    """Apply feather effect to an image without other processing"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        data = request.get_json()
        thumbnail_data = data.get("thumbnail_data")
        crop_area = data.get("crop_area")
        feather_radius = data.get("feather_radius", 10)
        
        if not thumbnail_data:
            return jsonify({"success": False, "error": "thumbnail_data is required"}), 400
        
        sc_module = _get_sc_module()
        if not sc_module:
            return jsonify({"success": False, "error": "Image processing service not available"}), 500
        
        processed_image = sc_module.apply_feather_effect(
            thumbnail_data, 
            feather_radius=feather_radius,
            crop_area=crop_area
        )
        
        return jsonify({
            "success": True,
            "screenshot": processed_image,
            "effect": "feather"
        })
            
    except Exception as e:
        logger.error(f"Error applying feather effect: {str(e)}")
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


@videos_bp.route("/api/process-thumbnail-print-quality", methods=["POST", "OPTIONS"])
def process_thumbnail_print_quality():
    """Process a thumbnail image for print quality output"""
    origin = request.headers.get('Origin')
    allowed_origins = ["https://screenmerch.fly.dev", "https://screenmerch.com", "https://www.screenmerch.com"]
    cors_origin = origin if origin in allowed_origins else "https://screenmerch.fly.dev"
    
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        if origin in allowed_origins:
            response.headers.add('Access-Control-Allow-Origin', origin)
        else:
            response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.fly.dev')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cache-Control,Pragma,Expires')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    try:
        data = request.get_json()
        thumbnail_data = data.get("thumbnail_data")
        print_dpi = data.get("print_dpi", 300)
        soft_corners = data.get("soft_corners", False)
        edge_feather = data.get("edge_feather", False)
        crop_area = data.get("crop_area")
        corner_radius_percent = data.get("corner_radius_percent", 0)
        feather_edge_percent = data.get("feather_edge_percent", 0)
        frame_enabled = data.get("frame_enabled", False)
        frame_color = data.get("frame_color", "#FF0000")
        frame_width = int(data.get("frame_width", 10))
        double_frame = data.get("double_frame", False)
        add_white_background = data.get("add_white_background", False)
        print_area_width = data.get("print_area_width")
        print_area_height = data.get("print_area_height")
        
        frame_width = max(1, min(100, frame_width))
        
        if not thumbnail_data:
            response = jsonify({"success": False, "error": "thumbnail_data is required"})
            if origin in allowed_origins:
                response.headers.add('Access-Control-Allow-Origin', origin)
            else:
                response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.fly.dev')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response, 400
        
        screenshot_capture = _get_screenshot_capture()
        if not screenshot_capture:
            response = jsonify({"success": False, "error": "Screenshot capture service not available"})
            if origin in allowed_origins:
                response.headers.add('Access-Control-Allow-Origin', origin)
            else:
                response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.fly.dev')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response, 500
        
        result = screenshot_capture.process_thumbnail_for_print(
            thumbnail_data,
            print_dpi=print_dpi,
            soft_corners=soft_corners,
            edge_feather=edge_feather,
            crop_area=crop_area,
            corner_radius_percent=corner_radius_percent,
            feather_edge_percent=feather_edge_percent,
            frame_enabled=frame_enabled,
            frame_color=frame_color,
            frame_width=frame_width,
            double_frame=double_frame,
            add_white_background=add_white_background,
            print_area_width=print_area_width,
            print_area_height=print_area_height
        )
        
        if result.get('success'):
            response = jsonify(result)
            if origin in allowed_origins:
                response.headers.add('Access-Control-Allow-Origin', origin)
            else:
                response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.fly.dev')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
        else:
            response = jsonify(result)
            if origin in allowed_origins:
                response.headers.add('Access-Control-Allow-Origin', origin)
            else:
                response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.fly.dev')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response, 500
            
    except Exception as e:
        logger.error(f"Error processing thumbnail for print quality: {str(e)}")
        response = jsonify({"success": False, "error": f"Internal server error: {str(e)}"})
        if origin in allowed_origins:
            response.headers.add('Access-Control-Allow-Origin', origin)
        else:
            response.headers.add('Access-Control-Allow-Origin', 'https://screenmerch.fly.dev')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 500


@videos_bp.route("/print-quality")
def print_quality_page():
    """Serve the print quality image generator page"""
    order_id = request.args.get('order_id')
    response = make_response(render_template('print_quality.html', order_id=order_id))
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' https: data: blob:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://screenmerch.fly.dev; "
        "frame-src 'self'; "
        "object-src 'none';"
    )
    return response
