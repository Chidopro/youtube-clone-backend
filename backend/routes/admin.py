"""Admin routes Blueprint for ScreenMerch"""
from flask import Blueprint, request, jsonify, render_template, redirect, url_for, session
from flask_cors import cross_origin
import logging
import os
import re
import uuid
import bcrypt
import requests
from datetime import datetime, timedelta

# Import utilities
from utils.helpers import _data_from_request, _allow_origin
from utils.security import admin_required

logger = logging.getLogger(__name__)

# Create Blueprint
admin_bp = Blueprint('admin', __name__)


def register_admin_routes(app, supabase, supabase_admin, order_store):
    """
    Register admin routes with the Flask app
    
    Args:
        app: Flask application instance
        supabase: Supabase client
        supabase_admin: Supabase admin client (for bypassing RLS)
        order_store: In-memory order store dictionary
    """
    # Store dependencies in Blueprint for access in routes
    admin_bp.supabase = supabase
    admin_bp.supabase_admin = supabase_admin
    admin_bp.order_store = order_store
    
    # Register the Blueprint
    app.register_blueprint(admin_bp)


def _get_supabase_client():
    """Get the appropriate Supabase client (admin if available, else regular)"""
    return admin_bp.supabase_admin if admin_bp.supabase_admin else admin_bp.supabase


def _get_order_store():
    """Get the order store dictionary"""
    return admin_bp.order_store if hasattr(admin_bp, 'order_store') else {}


def _is_master_admin(user_email):
    """Check if user is a master admin"""
    try:
        if not user_email:
            return False
        user_email = user_email.strip().lower()
        client = _get_supabase_client()
        result = client.table('users').select('is_admin, admin_role').eq('email', user_email).execute()
        if result.data and len(result.data) > 0:
            user = result.data[0]
            return user.get('is_admin') and user.get('admin_role') == 'master_admin'
        return False
    except Exception as e:
        logger.error(f"Error checking master admin status: {str(e)}")
        return False


def _handle_cors_preflight():
    """Handle CORS preflight requests"""
    response = jsonify({})
    origin = request.headers.get('Origin', '*')
    response.headers.add('Access-Control-Allow-Origin', origin)
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, X-User-Email')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response


def _send_creator_welcome_email(creator_email):
    """Send the creator welcome email via Resend. Returns True if sent, False otherwise."""
    if not creator_email or not creator_email.strip():
        return False
    api_key = os.getenv("RESEND_API_KEY")
    from_addr = os.getenv("RESEND_FROM", "noreply@screenmerch.com")
    # New creators haven't set a password yet; link to set-password page
    set_password_url = os.getenv("SCREENMERCH_SET_PASSWORD_URL", "https://screenmerch.com/set-password")
    intro_video_url = os.getenv("SCREENMERCH_INTRO_VIDEO_URL", "")
    if not api_key:
        logger.warning("RESEND_API_KEY not set; skipping creator welcome email")
        return False
    subject = "Welcome to ScreenMerch — your store is ready"
    body = f"""Hi,

Welcome to ScreenMerch — we're glad you're here.

You get your own store link (yourname.screenmerch.com) where only your videos show. In Personalization you can add your logo, colors, and a custom title and description so your store feels like you.

We invite you to sign in and check out the products we offer — from women's and men's to kids, mugs, bags, hats, and more (stickers, magnets, greeting cards, and more). You'll see prices and colors for each item so you know exactly what your fans can order.

Fans pick a moment from your video, capture a screenshot, and put it on any product. Every screenshot is processed for 300 DPI print quality. You earn $7 per sale on most items; we handle printing and shipping.

Next steps: Create your password, sign in, browse the catalog, set your subdomain, upload your videos, and share your link.

Create your password and explore products: {set_password_url}
"""
    if intro_video_url:
        body += f"\nWant a full walkthrough? Watch our intro video: {intro_video_url}\n"
    body += """

Thanks for joining — we're excited to have you.

The ScreenMerch team
"""
    try:
        r = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "from": from_addr,
                "to": [creator_email.strip()],
                "subject": subject,
                "text": body.strip(),
            },
            timeout=15,
        )
        if r.status_code in (200, 201, 202):
            logger.info(f"Creator welcome email sent to {creator_email}")
            return True
        logger.warning(f"Resend welcome email failed: {r.status_code} {r.text}")
        return False
    except Exception as e:
        logger.exception(f"Error sending creator welcome email: {e}")
        return False


def _is_valid_uuid(value):
    """Validate that value is a valid UUID string (for dashboard-stats and creator lookups)."""
    if not value or value == "undefined" or value == "null":
        return False
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


@admin_bp.route("/api/admin/dashboard-stats", methods=["GET"])
@cross_origin(origins=["https://screenmerch.com", "https://www.screenmerch.com"], supports_credentials=True)
def admin_dashboard_stats():
    """Get admin dashboard statistics. Accepts user_id (UUID) or X-User-Email for admin verification."""
    try:
        user_id = request.args.get('user_id')
        admin_email = request.headers.get('X-User-Email') or request.args.get('email')
        # Resolve UUID validation: allow stats if valid user_id OR if admin verified by email (so dashboard still loads)
        if not _is_valid_uuid(user_id) and not admin_email:
            return jsonify({"error": "User ID (valid UUID) or X-User-Email required"}), 400
        if not _is_valid_uuid(user_id) and admin_email:
            # Verify requester is admin so we don't leak stats
            if not _is_master_admin(admin_email):
                return jsonify({"error": "Unauthorized"}), 401
            logger.info(f"[ADMIN DASHBOARD] Dashboard stats requested by email (no valid user_id): {admin_email[:20]}...")
        elif user_id and not _is_valid_uuid(user_id):
            logger.warning(f"[ADMIN DASHBOARD] Invalid user_id format (not UUID): {user_id!r}")
        
        client = _get_supabase_client()
        
        # Try to use the view first if it exists
        try:
            result = client.table('admin_dashboard_stats').select('*').execute()
            if result.data and len(result.data) > 0:
                stats_row = dict(result.data[0])
                # Ensure pending_users is always set (view may not have it before migration)
                if stats_row.get('pending_users') is None:
                    pending_res = client.table('users').select('id').eq('status', 'pending').execute()
                    stats_row['pending_users'] = len(pending_res.data) if pending_res.data else 0
                return jsonify(stats_row)
        except Exception:
            logger.warning("Could not use admin_dashboard_stats view, calculating manually")
        
        # Fallback: Calculate stats manually
        try:
            # Get total users
            users_result = client.table('users').select('id').execute()
            total_users = len(users_result.data) if users_result.data else 0
            
            # Get active users
            active_users_result = client.table('users').select('id').eq('status', 'active').execute()
            active_users = len(active_users_result.data) if active_users_result.data else 0
            
            # Get suspended users
            suspended_users_result = client.table('users').select('id').eq('status', 'suspended').execute()
            suspended_users = len(suspended_users_result.data) if suspended_users_result.data else 0
            
            # Get pending users
            pending_users_result = client.table('users').select('id').eq('status', 'pending').execute()
            pending_users = len(pending_users_result.data) if pending_users_result.data else 0
            
            # Get total videos
            videos_result = client.table('videos2').select('id').execute()
            total_videos = len(videos_result.data) if videos_result.data else 0
            
            # Get pending videos
            pending_videos_result = client.table('videos2').select('id').eq('verification_status', 'pending').execute()
            pending_videos = len(pending_videos_result.data) if pending_videos_result.data else 0
            
            # Get approved videos
            approved_videos_result = client.table('videos2').select('id').eq('verification_status', 'approved').execute()
            approved_videos = len(approved_videos_result.data) if approved_videos_result.data else 0
            
            # Get total subscriptions
            subscriptions_result = client.table('user_subscriptions').select('id').execute()
            total_subscriptions = len(subscriptions_result.data) if subscriptions_result.data else 0
            
            # Get active subscriptions
            active_subscriptions_result = client.table('user_subscriptions').select('id').eq('status', 'active').execute()
            active_subscriptions = len(active_subscriptions_result.data) if active_subscriptions_result.data else 0
            
            # Get premium subscriptions
            premium_subscriptions_result = client.table('user_subscriptions').select('id').eq('tier', 'premium').execute()
            premium_subscriptions = len(premium_subscriptions_result.data) if premium_subscriptions_result.data else 0
            
            # Get creator network subscriptions
            creator_network_subscriptions_result = client.table('user_subscriptions').select('id').eq('tier', 'creator_network').execute()
            creator_network_subscriptions = len(creator_network_subscriptions_result.data) if creator_network_subscriptions_result.data else 0
            
            # Get total orders/purchases
            orders_result = client.table('orders').select('order_id, status, total_amount').execute()
            total_orders = len(orders_result.data) if orders_result.data else 0
            paid_orders = len([o for o in (orders_result.data or []) if o.get('status') == 'paid']) if orders_result.data else 0
            total_revenue = sum([float(o.get('total_amount', 0)) for o in (orders_result.data or []) if o.get('status') == 'paid']) if orders_result.data else 0
            
            # Get orders in processing queue
            queue_result = client.table('order_processing_queue').select('id').execute()
            orders_in_queue = len(queue_result.data) if queue_result.data else 0
            pending_queue = len([q for q in (queue_result.data or []) if q.get('status') == 'pending']) if queue_result.data else 0
            
            stats = {
                "total_users": total_users,
                "active_users": active_users,
                "suspended_users": suspended_users,
                "pending_users": pending_users,
                "total_videos": total_videos,
                "pending_videos": pending_videos,
                "approved_videos": approved_videos,
                "total_subscriptions": total_subscriptions,
                "active_subscriptions": active_subscriptions,
                "premium_subscriptions": premium_subscriptions,
                "creator_network_subscriptions": creator_network_subscriptions,
                "total_orders": total_orders,
                "paid_orders": paid_orders,
                "total_revenue": round(total_revenue, 2),
                "orders_in_queue": orders_in_queue,
                "pending_queue": pending_queue
            }
            
            logger.info(f"Admin dashboard stats calculated: {stats}")
            return jsonify(stats)
            
        except Exception as calc_error:
            logger.error(f"Error calculating stats: {str(calc_error)}")
            return jsonify({"error": "Failed to calculate stats"}), 500
            
    except Exception as e:
        logger.error(f"Error in admin_dashboard_stats: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@admin_bp.route("/api/admin/check-status", methods=["GET", "OPTIONS"])
def check_admin_status():
    """Check if user is admin - bypasses RLS to prevent 406 errors"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        user_email = request.args.get('email') or request.headers.get('X-User-Email')
        user_id = request.args.get('user_id')
        
        if not user_email and not user_id:
            return _allow_origin(jsonify({
                "success": False,
                "error": "Email or user_id required"
            })), 400
        
        client = _get_supabase_client()
        if not client:
            raise Exception("Supabase client not initialized")
        
        # Query user
        query = client.table('users').select('is_admin, admin_role')
        if user_id:
            query = query.eq('id', user_id)
        else:
            query = query.ilike('email', user_email.lower().strip())
        
        result = query.single().execute()
        
        if result.data:
            user = result.data
            return _allow_origin(jsonify({
                "success": True,
                "is_admin": user.get('is_admin', False),
                "admin_role": user.get('admin_role'),
                "is_full_admin": user.get('is_admin', False) and user.get('admin_role') == 'master_admin',
                "is_order_processing_admin": user.get('is_admin', False) and (
                    user.get('admin_role') in ['order_processing_admin', 'admin', 'master_admin'] or
                    user.get('admin_role') is None
                )
            })), 200
        else:
            return _allow_origin(jsonify({
                "success": True,
                "is_admin": False,
                "admin_role": None,
                "is_full_admin": False,
                "is_order_processing_admin": False
            })), 200
            
    except Exception as e:
        logger.error(f"Error in check_admin_status: {str(e)}")
        return _allow_origin(jsonify({"success": False, "error": str(e)})), 500


# Admin signup requests list (Master Admin only, bypasses RLS)
@admin_bp.route("/api/admin/signup-requests", methods=["GET", "OPTIONS"])
@admin_bp.route("/api/admin/signup-requests/", methods=["GET", "OPTIONS"])
def admin_get_signup_requests():
    """Get admin signup requests for Admin Management - uses service role to bypass RLS."""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    try:
        admin_email = request.headers.get('X-User-Email') or request.args.get('email')
        if not admin_email:
            response = jsonify({"success": False, "error": "Admin email required"})
            return _allow_origin(response), 401
        client = _get_supabase_client()
        if not client:
            response = jsonify({"success": False, "error": "Database service unavailable"})
            return _allow_origin(response), 500
        admin_result = client.table('users').select('is_admin, admin_role').ilike('email', admin_email).execute()
        if not admin_result.data or len(admin_result.data) == 0:
            response = jsonify({"success": False, "error": "Admin not found"})
            return _allow_origin(response), 403
        admin_user = admin_result.data[0]
        if not admin_user.get('is_admin') or admin_user.get('admin_role') != 'master_admin':
            response = jsonify({"success": False, "error": "Master admin access required"})
            return _allow_origin(response), 403
        result = client.table('admin_signup_requests').select('*').order('requested_at', desc=True).execute()
        response = jsonify({"success": True, "requests": result.data or []})
        return _allow_origin(response), 200
    except Exception as e:
        if '42P01' in str(e) or 'does not exist' in str(e).lower():
            response = jsonify({"success": True, "requests": []})
            return _allow_origin(response), 200
        logger.error(f"Error in admin_get_signup_requests: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return _allow_origin(response), 500


# User list for User Management (Master Admin only, bypasses RLS)
@admin_bp.route("/api/admin/users", methods=["GET", "OPTIONS"])
@admin_bp.route("/api/admin/users/", methods=["GET", "OPTIONS"])
def admin_get_users():
    """Get users list for admin User Management - uses service role to bypass RLS."""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    try:
        admin_email = request.headers.get('X-User-Email') or request.args.get('email')
        if not admin_email:
            response = jsonify({"success": False, "error": "Admin email required"})
            return _allow_origin(response), 401
        client = _get_supabase_client()
        if not client:
            response = jsonify({"success": False, "error": "Database service unavailable"})
            return _allow_origin(response), 500
        admin_result = client.table('users').select('is_admin, admin_role').ilike('email', admin_email).execute()
        if not admin_result.data or len(admin_result.data) == 0:
            response = jsonify({"success": False, "error": "Admin not found"})
            return _allow_origin(response), 403
        admin_user = admin_result.data[0]
        if not admin_user.get('is_admin') or admin_user.get('admin_role') != 'master_admin':
            response = jsonify({"success": False, "error": "Master admin access required"})
            return _allow_origin(response), 403
        search = (request.args.get('search') or '').strip()
        status = request.args.get('status') or 'all'
        role = request.args.get('role') or 'all'
        page = max(0, int(request.args.get('page', 0)))
        limit = min(100, max(1, int(request.args.get('limit', 100))))
        query = client.table('users').select('*', count='exact')
        if search:
            query = query.or_(f"display_name.ilike.%{search}%,email.ilike.%{search}%")
        if status != 'all':
            query = query.eq('status', status)
        if role != 'all':
            query = query.eq('role', role)
        result = query.order('created_at', desc=True).range(page * limit, (page + 1) * limit - 1).execute()
        total = result.count if hasattr(result, 'count') and result.count is not None else (len(result.data) if result.data else 0)
        response = jsonify({
            "success": True,
            "users": result.data or [],
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": max(0, (total + limit - 1) // limit)
        })
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"Error in admin_get_users: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return _allow_origin(response), 500


# Subdomain management routes (Master Admin only)
@admin_bp.route("/api/admin/subdomains", methods=["GET", "OPTIONS"])
@admin_bp.route("/api/admin/subdomains/", methods=["GET", "OPTIONS"])
def admin_get_subdomains():
    """Get all subdomains with creator info - Master Admin only"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        admin_email = request.headers.get('X-User-Email') or request.args.get('email')
        if not admin_email:
            response = jsonify({"success": False, "error": "Admin email required"})
            return _allow_origin(response), 401
        
        client = _get_supabase_client()
        if not client:
            response = jsonify({"success": False, "error": "Database service unavailable"})
            return _allow_origin(response), 500
        
        admin_result = client.table('users').select('is_admin, admin_role').ilike('email', admin_email).execute()
        if not admin_result.data or len(admin_result.data) == 0:
            response = jsonify({"success": False, "error": "Admin not found"})
            return _allow_origin(response), 403
        
        admin_user = admin_result.data[0]
        if not admin_user.get('is_admin') or admin_user.get('admin_role') != 'master_admin':
            response = jsonify({"success": False, "error": "Master admin access required"})
            return _allow_origin(response), 403
        
        # Get all users with subdomains
        result = client.table('users').select(
            'id, email, display_name, subdomain, role, status, created_at, updated_at, personalization_enabled'
        ).not_.is_('subdomain', 'null').order('created_at', desc=True).execute()
        
        subdomains = []
        for user in result.data:
            subdomain = user.get('subdomain')
            if subdomain:
                subdomains.append({
                    'user_id': user.get('id'),
                    'email': user.get('email'),
                    'display_name': user.get('display_name'),
                    'subdomain': subdomain,
                    'subdomain_url': f'https://{subdomain}.screenmerch.com',
                    'role': user.get('role'),
                    'status': user.get('status'),
                    'personalization_enabled': user.get('personalization_enabled', False),
                    'created_at': user.get('created_at'),
                    'updated_at': user.get('updated_at')
                })
        
        logger.info(f"✅ [SUBDOMAIN-MGMT] Retrieved {len(subdomains)} subdomains")
        response = jsonify({"success": True, "subdomains": subdomains})
        return _allow_origin(response), 200
        
    except Exception as e:
        logger.error(f"❌ [SUBDOMAIN-MGMT] Error: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/subdomains/<user_id>", methods=["PUT", "OPTIONS"])
@admin_bp.route("/api/admin/subdomains/<user_id>/", methods=["PUT", "OPTIONS"])
def admin_update_subdomain(user_id):
    """Update subdomain for a user - Master Admin only"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        admin_email = request.headers.get('X-User-Email') or request.json.get('admin_email')
        if not admin_email:
            response = jsonify({"success": False, "error": "Admin email required"})
            return _allow_origin(response), 401
        
        client = _get_supabase_client()
        if not client:
            response = jsonify({"success": False, "error": "Database service unavailable"})
            return _allow_origin(response), 500
        
        admin_result = client.table('users').select('is_admin, admin_role').ilike('email', admin_email).execute()
        if not admin_result.data or len(admin_result.data) == 0:
            response = jsonify({"success": False, "error": "Admin not found"})
            return _allow_origin(response), 403
        
        admin_user = admin_result.data[0]
        if not admin_user.get('is_admin') or admin_user.get('admin_role') != 'master_admin':
            response = jsonify({"success": False, "error": "Master admin access required"})
            return _allow_origin(response), 403
        
        data = _data_from_request()
        new_subdomain = (data.get('subdomain') or '').strip().lower()
        
        # Validate subdomain format
        if new_subdomain:
            if not re.match(r'^[a-z0-9]([a-z0-9-]*[a-z0-9])?$', new_subdomain):
                response = jsonify({"success": False, "error": "Invalid subdomain format. Must be 3-63 lowercase alphanumeric characters with hyphens."})
                return _allow_origin(response), 400
            
            if len(new_subdomain) < 3 or len(new_subdomain) > 63:
                response = jsonify({"success": False, "error": "Subdomain must be between 3 and 63 characters"})
                return _allow_origin(response), 400
            
            # Check if subdomain is already taken
            existing = client.table('users').select('id, email').eq('subdomain', new_subdomain).execute()
            if existing.data and len(existing.data) > 0:
                existing_user = existing.data[0]
                if existing_user.get('id') != user_id:
                    response = jsonify({"success": False, "error": f"Subdomain '{new_subdomain}' is already taken by {existing_user.get('email')}"})
                    return _allow_origin(response), 400
        
        update_data = {'subdomain': new_subdomain if new_subdomain else None}
        result = client.table('users').update(update_data).eq('id', user_id).execute()
        
        if not result.data or len(result.data) == 0:
            response = jsonify({"success": False, "error": "User not found"})
            return _allow_origin(response), 404
        
        logger.info(f"✅ [SUBDOMAIN-MGMT] Updated subdomain for user {user_id} to '{new_subdomain}'")
        response = jsonify({
            "success": True,
            "user": result.data[0],
            "message": f"Subdomain updated to '{new_subdomain}'" if new_subdomain else "Subdomain removed"
        })
        return _allow_origin(response), 200
        
    except Exception as e:
        logger.error(f"❌ [SUBDOMAIN-MGMT] Error: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/pending-creators", methods=["GET", "OPTIONS"])
def admin_pending_creators():
    """List creators with status=pending (new sign-ups awaiting approval). Master Admin only."""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    try:
        admin_email = request.headers.get('X-User-Email') or request.args.get('email')
        if not admin_email:
            response = jsonify({"error": "X-User-Email required"})
            return _allow_origin(response), 401
        if not _is_master_admin(admin_email):
            response = jsonify({"error": "Master admin required"})
            return _allow_origin(response), 403
        client = _get_supabase_client()
        if not client:
            response = jsonify({"error": "Database unavailable"})
            return _allow_origin(response), 500
        result = client.table('users').select(
            'id, email, display_name, created_at, profile_image_url'
        ).eq('status', 'pending').eq('role', 'creator').order('created_at', desc=True).execute()
        creators = result.data or []
        response = jsonify({"success": True, "pending_creators": creators})
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"pending-creators error: {e}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/approve-creator/<user_id>", methods=["POST", "OPTIONS"])
@admin_bp.route("/api/admin/approve-creator/<user_id>/", methods=["POST", "OPTIONS"])
def admin_approve_creator(user_id):
    """Set creator status to active. Master Admin only."""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    try:
        admin_email = request.headers.get('X-User-Email') or (_data_from_request() or {}).get('admin_email')
        if not admin_email:
            response = jsonify({"success": False, "error": "X-User-Email required"})
            return _allow_origin(response), 401
        if not _is_master_admin(admin_email):
            response = jsonify({"success": False, "error": "Master admin required"})
            return _allow_origin(response), 403
        if not _is_valid_uuid(user_id):
            response = jsonify({"success": False, "error": "Invalid user ID"})
            return _allow_origin(response), 400
        client = _get_supabase_client()
        if not client:
            response = jsonify({"success": False, "error": "Database unavailable"})
            return _allow_origin(response), 500
        # Fetch creator to check welcome email and get email address
        try:
            creator_row = client.table('users').select('id, email, creator_welcome_email_sent_at').eq('id', user_id).eq('status', 'pending').eq('role', 'creator').single().execute()
        except Exception:
            creator_row = client.table('users').select('id, email').eq('id', user_id).eq('status', 'pending').eq('role', 'creator').single().execute()
        if not creator_row.data:
            response = jsonify({"success": False, "error": "User not found or not pending creator"})
            return _allow_origin(response), 404
        creator = creator_row.data
        result = client.table('users').update({'status': 'active'}).eq('id', user_id).eq('status', 'pending').eq('role', 'creator').execute()
        if not result.data or len(result.data) == 0:
            response = jsonify({"success": False, "error": "User not found or not pending creator"})
            return _allow_origin(response), 404
        # Send welcome email once (when creator_welcome_email_sent_at is null)
        if creator.get('creator_welcome_email_sent_at') is None and _send_creator_welcome_email(creator.get('email') or ''):
            try:
                client.table('users').update({'creator_welcome_email_sent_at': datetime.utcnow().isoformat()}).eq('id', user_id).execute()
            except Exception:
                pass
        logger.info(f"Creator approved: {user_id} by {admin_email}")
        response = jsonify({"success": True, "message": "Creator approved"})
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"approve-creator error: {e}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/users/<user_id>/activate", methods=["POST", "OPTIONS"])
@admin_bp.route("/api/admin/users/<user_id>/activate/", methods=["POST", "OPTIONS"])
def admin_activate_user(user_id):
    """Set user status to active. For creators, send welcome email once (when creator_welcome_email_sent_at is null). Master Admin only."""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    try:
        admin_email = request.headers.get("X-User-Email") or (_data_from_request() or {}).get("admin_email")
        if not admin_email:
            response = jsonify({"success": False, "error": "X-User-Email required"})
            return _allow_origin(response), 401
        if not _is_master_admin(admin_email):
            response = jsonify({"success": False, "error": "Master admin required"})
            return _allow_origin(response), 403
        if not _is_valid_uuid(user_id):
            response = jsonify({"success": False, "error": "Invalid user ID"})
            return _allow_origin(response), 400
        client = _get_supabase_client()
        if not client:
            response = jsonify({"success": False, "error": "Database unavailable"})
            return _allow_origin(response), 500
        # Fetch user (include creator_welcome_email_sent_at if column exists)
        try:
            row = client.table("users").select("id, email, role, creator_welcome_email_sent_at").eq("id", user_id).single().execute()
        except Exception:
            row = client.table("users").select("id, email, role").eq("id", user_id).single().execute()
        if not row.data:
            response = jsonify({"success": False, "error": "User not found"})
            return _allow_origin(response), 404
        user = row.data
        # Update status to active (pending or suspended -> active)
        client.table("users").update({"status": "active"}).eq("id", user_id).execute()
        # If creator and welcome email not yet sent, send and mark
        if user.get("role") == "creator":
            sent_at = user.get("creator_welcome_email_sent_at")
            if sent_at is None:
                if _send_creator_welcome_email(user.get("email") or ""):
                    try:
                        client.table("users").update({"creator_welcome_email_sent_at": datetime.utcnow().isoformat()}).eq("id", user_id).execute()
                    except Exception:
                        pass
                # If send failed we still activated; don't block
        logger.info(f"User activated: {user_id} by {admin_email}")
        response = jsonify({"success": True, "message": "User activated"})
        return _allow_origin(response), 200
    except Exception as e:
        logger.exception(f"activate user error: {e}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/disapprove-creator/<user_id>", methods=["POST", "OPTIONS"])
@admin_bp.route("/api/admin/disapprove-creator/<user_id>/", methods=["POST", "OPTIONS"])
def admin_disapprove_creator(user_id):
    """Set creator status to rejected (disapprove sign-up). Master Admin only."""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    try:
        admin_email = request.headers.get('X-User-Email') or (_data_from_request() or {}).get('admin_email')
        if not admin_email:
            response = jsonify({"success": False, "error": "X-User-Email required"})
            return _allow_origin(response), 401
        if not _is_master_admin(admin_email):
            response = jsonify({"success": False, "error": "Master admin required"})
            return _allow_origin(response), 403
        if not _is_valid_uuid(user_id):
            response = jsonify({"success": False, "error": "Invalid user ID"})
            return _allow_origin(response), 400
        client = _get_supabase_client()
        if not client:
            response = jsonify({"success": False, "error": "Database unavailable"})
            return _allow_origin(response), 500
        result = client.table('users').update({'status': 'suspended'}).eq('id', user_id).eq('status', 'pending').eq('role', 'creator').execute()
        if not result.data or len(result.data) == 0:
            response = jsonify({"success": False, "error": "User not found or not pending creator"})
            return _allow_origin(response), 404
        logger.info(f"Creator disapproved (suspended): {user_id} by {admin_email}")
        response = jsonify({"success": True, "message": "Creator disapproved"})
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"disapprove-creator error: {e}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/subdomains/validate", methods=["POST", "OPTIONS"])
@admin_bp.route("/api/admin/subdomains/validate/", methods=["POST", "OPTIONS"])
def admin_validate_subdomain():
    """Validate if a subdomain is accessible - Master Admin only"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        data = _data_from_request()
        subdomain = (data.get('subdomain') or '').strip().lower()
        
        if not subdomain:
            response = jsonify({"success": False, "error": "Subdomain required"})
            return _allow_origin(response), 400
        
        subdomain_url = f'https://{subdomain}.screenmerch.com'
        is_accessible = False
        status_code = None
        error_message = None
        
        try:
            response_check = requests.head(subdomain_url, timeout=5, allow_redirects=True)
            status_code = response_check.status_code
            is_accessible = status_code < 500
        except requests.exceptions.Timeout:
            error_message = "Timeout checking subdomain"
        except requests.exceptions.ConnectionError:
            error_message = "Connection error - subdomain may not be configured"
        except Exception as e:
            error_message = str(e)
        
        logger.info(f"🔍 [SUBDOMAIN-VALIDATE] Subdomain '{subdomain}': accessible={is_accessible}, status={status_code}")
        
        response = jsonify({
            "success": True,
            "subdomain": subdomain,
            "url": subdomain_url,
            "is_accessible": is_accessible,
            "status_code": status_code,
            "error": error_message
        })
        return _allow_origin(response), 200
        
    except Exception as e:
        logger.error(f"❌ [SUBDOMAIN-VALIDATE] Error: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return _allow_origin(response), 500


# Admin page routes
@admin_bp.route("/admin/setup", methods=["GET", "POST"])
def admin_setup():
    """Create admin user endpoint"""
    if request.method == "POST":
        try:
            admin_password = 'VieG369Bbk8!'
            password_hash = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            admin_user = {
                'email': 'admin@screenmerch.com',
                'password_hash': password_hash,
                'role': 'admin',
                'display_name': 'Admin User',
                'status': 'active'
            }
            
            client = _get_supabase_client()
            existing = client.table('users').select('*').eq('email', 'admin@screenmerch.com').execute()
            
            if existing.data:
                result = client.table('users').update({
                    'role': 'admin',
                    'password_hash': password_hash
                }).eq('email', 'admin@screenmerch.com').execute()
                message = "Admin user updated successfully!"
            else:
                result = client.table('users').insert(admin_user).execute()
                message = "Admin user created successfully!"
            
            return f"""
            <h1>Admin Setup Complete!</h1>
            <p>{message}</p>
            <p><strong>Login Credentials:</strong></p>
            <ul>
                <li>Email: admin@screenmerch.com</li>
                <li>Password: VieG369Bbk8!</li>
            </ul>
            <p><a href="/admin/login">Go to Admin Login</a></p>
            """
            
        except Exception as e:
            return f"<h1>Error</h1><p>Failed to create admin user: {str(e)}</p>"
    
    return """
    <h1>Admin Setup</h1>
    <p>Click the button below to create an admin user:</p>
    <form method="POST">
        <button type="submit">Create Admin User</button>
    </form>
    """


@admin_bp.route("/admin/logout")
def admin_logout():
    """Admin logout"""
    session.clear()
    return redirect(url_for('auth.admin_login'))


@admin_bp.route("/admin/orders")
@admin_required()
def admin_orders():
    """Internal order management page for fulfillment"""
    try:
        all_orders = []
        order_store = _get_order_store()
        
        # Get orders from order_store (recent orders)
        for order_id, order_data in order_store.items():
            order_data['order_id'] = order_id
            order_data['status'] = 'pending'
            order_data['created_at'] = order_data.get('timestamp', 'N/A')
            all_orders.append(order_data)
        
        # Get orders from database
        try:
            client = _get_supabase_client()
            orders_result = client.table('orders').select('*').order('created_at', desc=True).execute()
            for order in orders_result.data:
                order_data = {
                    'order_id': order.get('order_id'),
                    'cart': order.get('cart', []),
                    'status': order.get('status', 'pending'),
                    'created_at': order.get('created_at', 'N/A'),
                    'total_value': order.get('total_amount', 0),
                    'customer_email': order.get('customer_email', ''),
                    'customer_phone': order.get('customer_phone', ''),
                    'video_title': order.get('video_title', ''),
                    'creator_name': order.get('creator_name', '')
                }
                all_orders.append(order_data)
        except Exception as db_error:
            logger.error(f"Database error loading orders: {str(db_error)}")
        
        # Also get legacy sales data
        try:
            client = _get_supabase_client()
            sales_result = client.table('sales').select('id,product_name,amount,image_url').execute()
            for sale in sales_result.data:
                order_data = {
                    'order_id': sale.get('id', 'db-' + str(sale.get('id'))),
                    'cart': [{
                        'product': sale.get('product_name', 'Unknown Product'),
                        'variants': {'color': 'N/A', 'size': 'N/A'},
                        'note': '',
                        'img': sale.get('image_url', '')
                    }],
                    'status': 'completed',
                    'created_at': 'N/A',
                    'total_value': sale.get('amount', 0)
                }
                all_orders.append(order_data)
        except Exception as db_error:
            logger.error(f"Database error loading sales: {str(db_error)}")
        
        # Sort by creation time
        def sort_key(order):
            created_at = order.get('created_at', '')
            if isinstance(created_at, (int, float)):
                return created_at
            elif isinstance(created_at, str):
                try:
                    return float(created_at)
                except (ValueError, TypeError):
                    return 0
            else:
                return 0
        
        all_orders.sort(key=sort_key, reverse=True)
        
        return render_template('admin_orders.html', orders=all_orders, admin_email=session.get('admin_email'))
    except Exception as e:
        logger.error(f"Error loading admin orders: {str(e)}")
        return jsonify({"error": "Failed to load orders"}), 500


@admin_bp.route("/admin/order/<order_id>")
@admin_required()
def admin_order_detail(order_id):
    """Detailed view of a specific order"""
    try:
        order_store = _get_order_store()
        order_data = order_store.get(order_id)
        
        if not order_data:
            client = _get_supabase_client()
            try:
                db_result = client.table('orders').select('*').eq('order_id', order_id).execute()
                if db_result.data:
                    db_order = db_result.data[0]
                    order_data = {
                        'cart': db_order.get('cart', []),
                        'status': db_order.get('status', 'pending'),
                        'created_at': db_order.get('created_at', 'N/A'),
                        'video_title': db_order.get('video_title', 'Unknown Video'),
                        'creator_name': db_order.get('creator_name', 'Unknown Creator'),
                        'video_url': db_order.get('video_url', 'Not provided'),
                        'shipping_cost': db_order.get('shipping_cost', 0)
                    }
                else:
                    return "Order not found", 404
            except Exception as db_error:
                logger.error(f"Database error loading order {order_id}: {str(db_error)}")
                return "Error loading order from database", 500
        
        # Try to extract video metadata if missing
        if (order_data.get('video_title') == 'Unknown Video' or 
            order_data.get('creator_name') == 'Unknown Creator' or 
            order_data.get('video_url') == 'Not provided'):
            
            video_url = order_data.get('video_url', '')
            if video_url and video_url != 'Not provided':
                try:
                    if 'screenmerch.com/video/' in video_url:
                        video_id = video_url.split('/')[-1]
                        client = _get_supabase_client()
                        video_result = client.table('videos2').select('*').eq('id', video_id).execute()
                        if video_result.data:
                            video_info = video_result.data[0]
                            video_title = (video_info.get('title') or 
                                         video_info.get('video_title') or 
                                         video_info.get('name') or 
                                         'Unknown Video')
                            
                            creator_name = (video_info.get('channelTitle') or 
                                           video_info.get('channel_title') or 
                                           video_info.get('creator') or 
                                           video_info.get('creator_name') or 
                                           video_info.get('author') or 
                                           'Unknown Creator')
                            
                            video_url = video_info.get('video_url', 'Not provided')
                            
                            order_data['video_title'] = video_title
                            order_data['creator_name'] = creator_name
                            order_data['video_url'] = video_url
                            
                            update_data = {
                                'video_title': video_title,
                                'creator_name': creator_name,
                                'video_url': video_url
                            }
                            client.table('orders').update(update_data).eq('order_id', order_id).execute()
                except Exception:
                    pass
        
        return render_template('admin_order_detail.html', order=order_data, order_id=order_id, admin_email=session.get('admin_email'))
    except Exception as e:
        logger.error(f"Error loading order detail: {str(e)}")
        return "Error loading order", 500


@admin_bp.route("/admin/order/<order_id>/status", methods=["POST"])
@admin_required()
def update_order_status(order_id):
    """Update order status (pending, processing, shipped, etc.)"""
    try:
        data = request.get_json()
        new_status = data.get('status')
        
        order_store = _get_order_store()
        if order_id in order_store:
            order_store[order_id]['status'] = new_status
            logger.info(f"Updated order {order_id} status to {new_status}")
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Order not found"}), 404
    except Exception as e:
        logger.error(f"Error updating order status: {str(e)}")
        return jsonify({"error": "Failed to update status"}), 500


# Order processing queue routes
@admin_bp.route("/api/admin/fix-order-queue/<order_id>", methods=["POST"])
@admin_required()
def fix_order_queue(order_id):
    """Manually fix an order that missed the webhook - mark as paid and add to processing queue"""
    try:
        client = _get_supabase_client()
        order_result = client.table('orders').select('*').eq('order_id', order_id).execute()
        if not order_result.data:
            return jsonify({"success": False, "error": "Order not found"}), 404
        
        order = order_result.data[0]
        
        if order.get('status') == 'pending':
            client.table('orders').update({'status': 'paid'}).eq('order_id', order_id).execute()
            logger.info(f"✅ [ADMIN] Updated order {order_id} status to 'paid'")
        
        queue_check = client.table('order_processing_queue').select('id').eq('order_id', order_id).execute()
        if not queue_check.data:
            queue_entry = {
                'order_id': order_id,
                'status': 'pending',
                'priority': 0
            }
            client.table('order_processing_queue').insert(queue_entry).execute()
            logger.info(f"✅ [ADMIN] Created processing queue entry for order {order_id}")
            return jsonify({"success": True, "message": "Order fixed and added to processing queue"})
        else:
            logger.info(f"✅ [ADMIN] Processing queue entry already exists for order {order_id}")
            return jsonify({"success": True, "message": "Order already in processing queue"})
            
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error fixing order queue: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@admin_bp.route("/api/admin/processing-queue", methods=["GET", "OPTIONS"])
@admin_required()
def admin_processing_queue():
    """Get processing queue for admin portal"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        status = request.args.get('status', 'all')
        client = _get_supabase_client()
        
        query = client.table('order_processing_queue').select('*').order('priority', desc=True).order('created_at')
        
        if status != 'all':
            query = query.eq('status', status)
        
        result = query.execute()
        
        # Enrich queue items with order data and user data
        enriched_data = []
        for queue_item in (result.data or []):
            enriched_item = dict(queue_item)
            
            # Get order data
            try:
                order_id = queue_item.get('order_id')
                if order_id:
                    order_result = client.table('orders').select('*').eq('order_id', order_id).execute()
                    if order_result.data:
                        enriched_item['orders'] = order_result.data[0]
            except Exception:
                pass
            
            # Get assigned user data
            try:
                assigned_to = queue_item.get('assigned_to')
                if assigned_to:
                    user_result = client.table('users').select('id, display_name, email').eq('id', assigned_to).execute()
                    if user_result.data:
                        enriched_item['assigned_to_user'] = user_result.data[0]
            except Exception:
                pass
            
            enriched_data.append(enriched_item)
        
        response = jsonify({
            "success": True,
            "data": enriched_data
        })
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error fetching processing queue: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/processing-history", methods=["GET", "OPTIONS"])
@admin_required()
def admin_processing_history():
    """Get processing history for admin portal"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        limit = int(request.args.get('limit', 50))
        client = _get_supabase_client()
        
        result = client.table('processing_history').select(
            '*, processed_by_user:users!processed_by(id, display_name, email)'
        ).order('processed_at', desc=True).limit(limit).execute()
        
        response = jsonify({
            "success": True,
            "data": result.data or []
        })
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error fetching processing history: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/assign-order", methods=["POST", "OPTIONS"])
@admin_required()
def assign_order():
    """Assign a queue item to a worker (master admin or order processing admin). Body: { \"queue_id\": \"uuid\", \"worker_id\": \"uuid\" }."""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    try:
        user_email = request.headers.get('X-User-Email') or request.args.get('user_email')
        if not user_email:
            response = jsonify({"success": False, "error": "X-User-Email required"})
            return _allow_origin(response), 401
        # Allow master_admin or order_processing_admin to assign
        client = _get_supabase_client()
        user_result = client.table('users').select('admin_role, is_admin').eq('email', user_email.strip().lower()).execute()
        if not user_result.data:
            response = jsonify({"success": False, "error": "User not found"})
            return _allow_origin(response), 403
        user = user_result.data[0]
        if not (user.get('is_admin') and user.get('admin_role') in ('master_admin', 'order_processing_admin')):
            response = jsonify({"success": False, "error": "Admin access required to assign orders"})
            return _allow_origin(response), 403
        data = request.get_json() or {}
        queue_id = data.get('queue_id')
        worker_id = data.get('worker_id')
        if not queue_id or not worker_id:
            response = jsonify({"success": False, "error": "queue_id and worker_id are required"})
            return _allow_origin(response), 400
        queue_result = client.table('order_processing_queue').select('id, order_id').eq('id', queue_id).execute()
        if not queue_result.data:
            response = jsonify({"success": False, "error": "Order not found in queue"})
            return _allow_origin(response), 404
        from datetime import datetime, timezone
        assigned_at = datetime.now(timezone.utc).isoformat()
        client.table('order_processing_queue').update({
            'status': 'assigned',
            'assigned_to': worker_id,
            'assigned_at': assigned_at
        }).eq('id', queue_id).execute()
        logger.info(f"✅ [ADMIN] Assigned queue {queue_id} to worker {worker_id} by {user_email}")
        response = jsonify({
            "success": True,
            "message": "Order assigned successfully",
            "queue_id": queue_id,
            "assigned_to": worker_id
        })
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error assigning order: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/assign-orders", methods=["POST", "OPTIONS"])
@admin_required()
def assign_orders_bulk():
    """Bulk assign multiple queue items to one worker. Body: { \"queue_ids\": [\"uuid\", ...], \"worker_id\": \"uuid\" }."""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    try:
        user_email = request.headers.get('X-User-Email') or request.args.get('user_email')
        if not user_email:
            response = jsonify({"success": False, "error": "X-User-Email required"})
            return _allow_origin(response), 401
        client = _get_supabase_client()
        user_result = client.table('users').select('admin_role, is_admin').eq('email', user_email.strip().lower()).execute()
        if not user_result.data:
            response = jsonify({"success": False, "error": "User not found"})
            return _allow_origin(response), 403
        user = user_result.data[0]
        if not (user.get('is_admin') and user.get('admin_role') in ('master_admin', 'order_processing_admin')):
            response = jsonify({"success": False, "error": "Admin access required to assign orders"})
            return _allow_origin(response), 403
        data = request.get_json() or {}
        queue_ids = data.get('queue_ids') or []
        worker_id = data.get('worker_id')
        if not queue_ids or not isinstance(queue_ids, list):
            response = jsonify({"success": False, "error": "queue_ids array is required"})
            return _allow_origin(response), 400
        if not worker_id:
            response = jsonify({"success": False, "error": "worker_id is required"})
            return _allow_origin(response), 400
        from datetime import datetime, timezone
        assigned_at = datetime.now(timezone.utc).isoformat()
        updated = 0
        for qid in queue_ids:
            try:
                client.table('order_processing_queue').update({
                    'status': 'assigned',
                    'assigned_to': worker_id,
                    'assigned_at': assigned_at
                }).eq('id', qid).execute()
                updated += 1
            except Exception:
                pass
        logger.info(f"✅ [ADMIN] Bulk assigned {updated} order(s) to worker {worker_id} by {user_email}")
        response = jsonify({
            "success": True,
            "message": f"Assigned {updated} order(s)",
            "assigned_count": updated,
            "assigned_to": worker_id
        })
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error bulk assigning orders: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/delete-order/<queue_id>", methods=["DELETE", "OPTIONS"])
@admin_required()
def delete_order(queue_id):
    """Delete an order from the processing queue (master admin only)"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        user_email = request.headers.get('X-User-Email') or request.args.get('user_email')
        if not _is_master_admin(user_email):
            response = jsonify({"success": False, "error": "Master admin access required"})
            response.status_code = 403
            return _allow_origin(response), 403
        
        client = _get_supabase_client()
        queue_result = client.table('order_processing_queue').select('order_id').eq('id', queue_id).execute()
        if not queue_result.data:
            response = jsonify({"success": False, "error": "Order not found in queue"})
            return _allow_origin(response), 404
        
        order_id = queue_result.data[0].get('order_id')
        client.table('order_processing_queue').delete().eq('id', queue_id).execute()
        
        logger.info(f"✅ [MASTER ADMIN] Deleted order {order_id} from processing queue (queue_id: {queue_id}) by {user_email}")
        
        response = jsonify({
            "success": True,
            "message": "Order deleted successfully"
        })
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error deleting order: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/delete-orders", methods=["POST", "OPTIONS"])
@admin_required()
def delete_orders_bulk():
    """Delete multiple orders from the processing queue (master admin only). Body: { \"queue_ids\": [\"uuid\", ...] }."""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    try:
        user_email = request.headers.get('X-User-Email') or request.args.get('user_email')
        if not _is_master_admin(user_email):
            response = jsonify({"success": False, "error": "Master admin access required"})
            response.status_code = 403
            return _allow_origin(response), 403
        data = request.get_json() or {}
        queue_ids = data.get('queue_ids') or []
        if not queue_ids or not isinstance(queue_ids, list):
            response = jsonify({"success": False, "error": "queue_ids array is required"})
            return _allow_origin(response), 400
        client = _get_supabase_client()
        deleted = 0
        errors = []
        for qid in queue_ids:
            try:
                client.table('order_processing_queue').delete().eq('id', qid).execute()
                deleted += 1
            except Exception as e:
                errors.append(str(e))
        response = jsonify({
            "success": True,
            "message": f"Deleted {deleted} order(s)",
            "deleted_count": deleted,
            "errors": errors if errors else None
        })
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error bulk deleting orders: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/workers", methods=["GET", "OPTIONS"])
@admin_required()
def admin_workers():
    """Get workers list for admin portal"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        client = _get_supabase_client()
        
        # Get all admins
        all_admins_result = client.table('users').select(
            'id, display_name, email, profile_image_url, admin_role'
        ).eq('is_admin', True).execute()
        
        # Filter to only include relevant admin roles
        admins_list = []
        for admin in (all_admins_result.data or []):
            admin_role = admin.get('admin_role')
            if admin_role in ['order_processing_admin', 'master_admin']:
                admins_list.append(admin)
        
        # Also get users from processor_permissions table
        processor_result = client.table('processor_permissions').select(
            '*, user:users!user_id(id, display_name, email, profile_image_url)'
        ).eq('is_active', True).execute()
        
        # Combine both lists, avoiding duplicates
        workers_dict = {}
        
        for admin in admins_list:
            user_id = admin.get('id')
            if user_id:
                workers_dict[user_id] = {
                    'user_id': user_id,
                    'user': {
                        'id': admin.get('id'),
                        'display_name': admin.get('display_name'),
                        'email': admin.get('email'),
                        'profile_image_url': admin.get('profile_image_url')
                    },
                    'role': 'admin',
                    'is_active': True,
                    'admin_role': admin.get('admin_role')
                }
        
        for processor in (processor_result.data or []):
            user_id = processor.get('user_id')
            if user_id and user_id not in workers_dict:
                workers_dict[user_id] = processor
        
        workers_list = list(workers_dict.values())
        
        response = jsonify({
            "success": True,
            "data": workers_list
        })
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error fetching workers: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/reset-sales", methods=["POST", "OPTIONS"])
@admin_required()
def reset_sales():
    """Reset/clear all sales data for a specific user (master admin only)"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        user_email = request.headers.get('X-User-Email') or request.args.get('user_email')
        if not _is_master_admin(user_email):
            response = jsonify({"success": False, "error": "Master admin access required"})
            return _allow_origin(response), 403
        
        data = request.get_json() or {}
        user_id = data.get('user_id')
        
        if not user_id:
            response = jsonify({"success": False, "error": "user_id is required"})
            return _allow_origin(response), 400
        
        client = _get_supabase_client()
        deleted_sales = client.table('sales').delete().eq('user_id', user_id).execute()
        
        try:
            client.table('creator_earnings').delete().eq('user_id', user_id).execute()
        except Exception:
            pass
        
        logger.info(f"✅ [MASTER ADMIN] Reset sales for user {user_id} by {user_email}")
        
        response = jsonify({
            "success": True,
            "message": f"Sales reset successfully. Deleted {len(deleted_sales.data) if deleted_sales.data else 0} sales records.",
            "deleted_count": len(deleted_sales.data) if deleted_sales.data else 0
        })
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error resetting sales: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/platform-revenue", methods=["GET", "OPTIONS"])
@admin_required()
def platform_revenue():
    """Get platform revenue analytics (30% commission from all creator earnings) - Master admin only"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        user_email = request.headers.get('X-User-Email') or request.args.get('user_email')
        if not _is_master_admin(user_email):
            response = jsonify({"success": False, "error": "Master admin access required"})
            return _allow_origin(response), 403
        
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        creator_id = request.args.get('creator_id')
        
        client = _get_supabase_client()
        
        # If creator_id is provided, check if it's a subdomain and convert to UUID
        creator_user_id = None
        if creator_id:
            subdomain = creator_id
            if '.screenmerch.com' in creator_id:
                subdomain = creator_id.replace('.screenmerch.com', '').replace('https://', '').replace('http://', '')
            
            uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
            
            if uuid_pattern.match(creator_id):
                creator_user_id = creator_id
            else:
                try:
                    creator_result = client.table('users').select('id').eq('subdomain', subdomain).limit(1).execute()
                    if creator_result.data and len(creator_result.data) > 0:
                        creator_user_id = creator_result.data[0]['id']
                    else:
                        return jsonify({
                            "success": True,
                            "summary": {
                                "total_platform_revenue": 0,
                                "total_gross_revenue": 0,
                                "total_creator_payouts": 0,
                                "total_transactions": 0,
                                "commission_rate": 0.30
                            },
                            "revenue_by_creator": [],
                            "revenue_by_date": [],
                            "revenue_by_product": [],
                            "all_transactions": []
                        })
                except Exception:
                    return jsonify({
                        "success": True,
                        "summary": {
                            "total_platform_revenue": 0,
                            "total_gross_revenue": 0,
                            "total_creator_payouts": 0,
                            "total_transactions": 0,
                            "commission_rate": 0.30
                        },
                        "revenue_by_creator": [],
                        "revenue_by_date": [],
                        "revenue_by_product": [],
                        "all_transactions": []
                    })
        
        # Build query for creator_earnings
        query = client.table('creator_earnings').select('*, users!inner(id, email, display_name, username, subdomain)')
        
        if start_date:
            query = query.gte('created_at', start_date)
        if end_date:
            query = query.lte('created_at', end_date)
        if creator_user_id:
            query = query.eq('user_id', creator_user_id)
        
        result = query.order('created_at', desc=True).execute()
        earnings = result.data if result.data else []
        
        # Calculate totals
        total_platform_revenue = sum(float(e.get('platform_fee', 0)) for e in earnings)
        total_gross_revenue = sum(float(e.get('sale_amount', 0)) for e in earnings)
        total_creator_payouts = sum(float(e.get('creator_share', 0)) for e in earnings)
        total_transactions = len(earnings)
        
        # Group by creator
        revenue_by_creator = {}
        for earning in earnings:
            user = earning.get('users', {})
            creator_id_key = earning.get('user_id')
            creator_name = user.get('display_name') or user.get('username') or user.get('email') or 'Unknown Creator'
            creator_email = user.get('email', 'Unknown')
            creator_subdomain = user.get('subdomain', '')
            
            if creator_id_key not in revenue_by_creator:
                revenue_by_creator[creator_id_key] = {
                    'creator_id': creator_id_key,
                    'creator_name': creator_name,
                    'creator_email': creator_email,
                    'creator_subdomain': creator_subdomain,
                    'platform_revenue': 0,
                    'gross_revenue': 0,
                    'creator_payouts': 0,
                    'transaction_count': 0,
                    'transactions': []
                }
            
            revenue_by_creator[creator_id_key]['platform_revenue'] += float(earning.get('platform_fee', 0))
            revenue_by_creator[creator_id_key]['gross_revenue'] += float(earning.get('sale_amount', 0))
            revenue_by_creator[creator_id_key]['creator_payouts'] += float(earning.get('creator_share', 0))
            revenue_by_creator[creator_id_key]['transaction_count'] += 1
            revenue_by_creator[creator_id_key]['transactions'].append({
                'order_id': earning.get('order_id'),
                'product_name': earning.get('product_name'),
                'sale_amount': float(earning.get('sale_amount', 0)),
                'platform_fee': float(earning.get('platform_fee', 0)),
                'creator_share': float(earning.get('creator_share', 0)),
                'created_at': earning.get('created_at'),
                'status': earning.get('status')
            })
        
        revenue_by_creator_list = sorted(
            revenue_by_creator.values(),
            key=lambda x: x['platform_revenue'],
            reverse=True
        )
        
        # Group by date
        revenue_by_date = {}
        for earning in earnings:
            try:
                created_at = earning.get('created_at')
                if created_at:
                    if isinstance(created_at, str):
                        date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    else:
                        date_obj = created_at
                    date_str = date_obj.strftime('%Y-%m-%d')
                    
                    if date_str not in revenue_by_date:
                        revenue_by_date[date_str] = {
                            'date': date_str,
                            'platform_revenue': 0,
                            'gross_revenue': 0,
                            'transaction_count': 0
                        }
                    
                    revenue_by_date[date_str]['platform_revenue'] += float(earning.get('platform_fee', 0))
                    revenue_by_date[date_str]['gross_revenue'] += float(earning.get('sale_amount', 0))
                    revenue_by_date[date_str]['transaction_count'] += 1
            except Exception:
                continue
        
        revenue_by_date_list = sorted(revenue_by_date.values(), key=lambda x: x['date'])
        
        # Group by product
        revenue_by_product = {}
        for earning in earnings:
            product_name = earning.get('product_name', 'Unknown Product')
            if product_name not in revenue_by_product:
                revenue_by_product[product_name] = {
                    'product_name': product_name,
                    'platform_revenue': 0,
                    'gross_revenue': 0,
                    'transaction_count': 0
                }
            
            revenue_by_product[product_name]['platform_revenue'] += float(earning.get('platform_fee', 0))
            revenue_by_product[product_name]['gross_revenue'] += float(earning.get('sale_amount', 0))
            revenue_by_product[product_name]['transaction_count'] += 1
        
        revenue_by_product_list = sorted(
            revenue_by_product.values(),
            key=lambda x: x['platform_revenue'],
            reverse=True
        )
        
        response_data = {
            "success": True,
            "summary": {
                "total_platform_revenue": round(total_platform_revenue, 2),
                "total_gross_revenue": round(total_gross_revenue, 2),
                "total_creator_payouts": round(total_creator_payouts, 2),
                "total_transactions": total_transactions,
                "commission_rate": 0.30
            },
            "revenue_by_creator": revenue_by_creator_list,
            "revenue_by_date": revenue_by_date_list,
            "revenue_by_product": revenue_by_product_list,
            "all_transactions": [
                {
                    'id': earning.get('id'),
                    'order_id': earning.get('order_id'),
                    'creator_id': earning.get('user_id'),
                    'creator_name': (earning.get('users', {}).get('display_name') or 
                                    earning.get('users', {}).get('username') or 
                                    earning.get('users', {}).get('email') or 'Unknown'),
                    'creator_email': earning.get('users', {}).get('email', 'Unknown'),
                    'creator_subdomain': earning.get('users', {}).get('subdomain', ''),
                    'product_name': earning.get('product_name'),
                    'sale_amount': round(float(earning.get('sale_amount', 0)), 2),
                    'platform_fee': round(float(earning.get('platform_fee', 0)), 2),
                    'creator_share': round(float(earning.get('creator_share', 0)), 2),
                    'created_at': earning.get('created_at'),
                    'status': earning.get('status')
                }
                for earning in earnings[:100]
            ]
        }
        
        response = jsonify(response_data)
        return _allow_origin(response), 200
        
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error fetching platform revenue: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500


@admin_bp.route("/api/admin/recent-orders", methods=["GET", "OPTIONS"])
@admin_required()
def admin_recent_orders():
    """Get recent orders for debugging - shows all orders regardless of status"""
    if request.method == "OPTIONS":
        return _handle_cors_preflight()
    
    try:
        limit = int(request.args.get('limit', 20))
        client = _get_supabase_client()
        
        orders_result = client.table('orders').select('*').order('created_at', desc=True).limit(limit).execute()
        
        queue_result = client.table('order_processing_queue').select('order_id, status').execute()
        queue_map = {q['order_id']: q['status'] for q in (queue_result.data or [])}
        
        enriched_orders = []
        for order in (orders_result.data or []):
            order_id = order.get('order_id')
            enriched_order = dict(order)
            enriched_order['in_processing_queue'] = order_id in queue_map
            enriched_order['queue_status'] = queue_map.get(order_id, 'not_in_queue')
            enriched_orders.append(enriched_order)
        
        response = jsonify({
            "success": True,
            "data": enriched_orders,
            "total": len(enriched_orders)
        })
        return _allow_origin(response), 200
    except Exception as e:
        logger.error(f"❌ [ADMIN] Error fetching recent orders: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        return _allow_origin(response), 500
