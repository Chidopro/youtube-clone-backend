"""Authentication routes Blueprint for ScreenMerch"""
from flask import Blueprint, request, jsonify, render_template, redirect, url_for, session, make_response, current_app
from flask_cors import cross_origin
import logging
import os
import re
import uuid
import bcrypt
import requests
import base64
import json
from urllib.parse import quote
from datetime import datetime, timedelta, timezone

# Google OAuth imports
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

# Import utilities
from utils.helpers import (
    _data_from_request, _return_url, _cookie_domain, 
    get_cookie_domain, _allow_origin
)

logger = logging.getLogger(__name__)

# Create Blueprint
auth_bp = Blueprint('auth', __name__)


def _get_limiter():
    """Lazy import limiter to avoid circular import; may be None if not loaded."""
    try:
        from utils.limiter import limiter
        return limiter
    except Exception:
        return None


def register_auth_routes(app, supabase, supabase_admin, config):
    """
    Register auth routes with the Flask app
    
    Args:
        app: Flask application instance
        supabase: Supabase client
        supabase_admin: Supabase admin client (for bypassing RLS)
        config: Dictionary with configuration values:
            - GOOGLE_CLIENT_ID
            - GOOGLE_CLIENT_SECRET
            - GOOGLE_REDIRECT_URI
            - RESEND_API_KEY
            - RESEND_FROM
            - MAIL_TO
    """
    # Store config in Blueprint for access in routes
    auth_bp.config = config
    auth_bp.supabase = supabase
    auth_bp.supabase_admin = supabase_admin
    
    # Register the Blueprint
    app.register_blueprint(auth_bp)


def _get_supabase_client():
    """Get the appropriate Supabase client (admin if available, else regular)"""
    return auth_bp.supabase_admin if auth_bp.supabase_admin else auth_bp.supabase


def _get_config(key, default=None):
    """Get configuration value from Blueprint config"""
    return auth_bp.config.get(key, default) if hasattr(auth_bp, 'config') else default


@auth_bp.route("/api/auth/login", methods=["POST", "OPTIONS"])
@auth_bp.route("/api/auth/login/", methods=["POST", "OPTIONS"])
@(_get_limiter().limit("10 per minute") if _get_limiter() else lambda f: f)
def auth_login():
    """Handle user login with email and password validation"""
    if request.method == "OPTIONS":
        logger.info(f"🔵 [LOGIN] OPTIONS preflight from {request.headers.get('Origin', 'unknown')}")
        # Let Flask-CORS handle OPTIONS requests to avoid duplicate headers
        # Flask-CORS is configured globally in app.py and will handle this automatically
        response = jsonify(success=True)
        return response
    
    try:
        logger.info(f"🔵 [LOGIN] Request received from {request.headers.get('Origin', 'unknown')}")
        
        # Handle both JSON (fetch) and form data (redirect)
        data = _data_from_request()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        
        if not email or not password:
            response = jsonify({"success": False, "error": "Email and password are required"})
            return response, 400
        
        # Validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            response = jsonify({"success": False, "error": "Please enter a valid email address"})
            return response, 400
        
        # Check if user exists in database - use admin client to bypass RLS
        try:
            logger.info(f"🔵 [LOGIN] Querying database for user: {email}")
            client = _get_supabase_client()
            if not client:
                logger.error("❌ [LOGIN] Supabase client not initialized")
                response = jsonify({"success": False, "error": "Authentication service unavailable"})
                return response, 500
            
            result = client.table('users').select('*').eq('email', email).execute()
            logger.info(f"🔵 [LOGIN] Database query completed for: {email}")
            
            if result.data:
                user = result.data[0]
                user_status = user.get('status', 'active')
                
                # Block login if user status is 'pending' (requires admin approval)
                if user_status == 'pending':
                    response = jsonify({
                        "success": False, 
                        "error": "Your account is pending approval. Please wait for admin approval before signing in."
                    })
                    return response, 403
                
                # Block login if user is suspended or banned
                if user_status in ['suspended', 'banned']:
                    response = jsonify({
                        "success": False, 
                        "error": f"Your account has been {user_status}. Please contact support for assistance."
                    })
                    return response, 403
                
                stored_password = user.get('password_hash', '')
                
                # Verify password using bcrypt
                password_match = False
                if stored_password:
                    try:
                        stored_password_trimmed = stored_password.strip()
                        
                        # Check if stored password is a bcrypt hash
                        if stored_password_trimmed.startswith('$2b$') or stored_password_trimmed.startswith('$2a$'):
                            password_match = bcrypt.checkpw(password.encode('utf-8'), stored_password_trimmed.encode('utf-8'))
                            logger.info(f"🔑 [LOGIN] Bcrypt verification result: {password_match}")
                        else:
                            # Legacy plain text password - verify and upgrade to bcrypt
                            if password.strip() == stored_password_trimmed:
                                password_match = True
                                hashed = bcrypt.hashpw(password.strip().encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                                client.table('users').update({'password_hash': hashed}).eq('id', user['id']).execute()
                                logger.info(f"✅ [LOGIN] Upgraded password to bcrypt for user {email}")
                    except Exception as hash_error:
                        logger.error(f"❌ [LOGIN] Error verifying password: {str(hash_error)}")
                        password_match = False
                
                if password_match:
                    logger.info(f"✅ [LOGIN] User {email} logged in successfully")
                    response = jsonify({
                        "success": True, 
                        "message": "Login successful",
                        "user": {
                            "id": user.get('id'),
                            "email": user.get('email'),
                            "display_name": user.get('display_name'),
                            "role": user.get('role', 'customer'),
                            "status": user.get('status', 'active'),
                            "profile_image_url": user.get('profile_image_url'),
                            "cover_image_url": user.get('cover_image_url'),
                            "bio": user.get('bio'),
                            "subdomain": user.get('subdomain')
                        }
                    })
                    
                    # Generate token
                    token = str(uuid.uuid4())
                    
                    is_form = not request.is_json
                    domain = get_cookie_domain()
                    
                    if is_form:
                        resp = redirect(_return_url(), code=303)
                    else:
                        response_data = {
                            "success": True,
                            "message": "Login successful",
                            "user": {
                                "id": user.get('id'),
                                "email": user.get('email'),
                                "display_name": user.get('display_name'),
                                "role": user.get('role', 'customer'),
                                "status": user.get('status', 'active'),
                                "profile_image_url": user.get('profile_image_url'),
                                "cover_image_url": user.get('cover_image_url'),
                                "bio": user.get('bio'),
                                "subdomain": user.get('subdomain')
                            },
                            "token": token
                        }
                        resp = make_response(jsonify(response_data), 200)
                    
                    # Flask-CORS will handle CORS headers automatically
                    resp.set_cookie(
                        "sm_session", token,
                        domain=domain, path="/",
                        secure=True, httponly=True, samesite="None", max_age=7*24*3600
                    )
                    # Store token -> user_id for /api/users/me validation (in-memory; single instance)
                    current_app.config.setdefault("session_token_store", {})[token] = user.get("id")
                    return resp
                else:
                    response = jsonify({"success": False, "error": "Invalid email or password"})
                    return response, 401
            else:
                response = jsonify({"success": False, "error": "Invalid email or password"})
                return response, 401
                
        except Exception as db_error:
            logger.error(f"Database error during login: {str(db_error)}")
            response = jsonify({"success": False, "error": "Authentication service unavailable"})
            return response, 500
            
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return response, 500


@auth_bp.route("/api/auth/check-admin", methods=["POST", "OPTIONS"])
@auth_bp.route("/api/auth/check-admin/", methods=["POST", "OPTIONS"])
def auth_check_admin():
    """Check if a user has admin privileges"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        # Flask-CORS handles CORS headers automatically
        return response
    
    try:
        data = _data_from_request()
        user_id = data.get("user_id")
        user_email = (data.get("email") or "").strip().lower()
        
        if not user_id and not user_email:
            response = jsonify({"success": False, "error": "user_id or email is required"})
            return response, 400
        
        logger.info(f"🔐 [CHECK-ADMIN] Checking admin status for user_id={user_id}, email={user_email}")
        
        client = _get_supabase_client()
        if not client:
            logger.error("❌ [CHECK-ADMIN] Supabase client not initialized")
            response = jsonify({"success": False, "error": "Database service unavailable"})
            return response, 500
        
        # Query by ID first, then fallback to email
        user_data = None
        if user_id:
            result = client.table('users').select('id, email, is_admin, admin_role').eq('id', user_id).execute()
            if result.data:
                user_data = result.data[0]
                logger.info(f"🔐 [CHECK-ADMIN] Found user by ID: {user_id}")
        
        if not user_data and user_email:
            result = client.table('users').select('id, email, is_admin, admin_role').ilike('email', user_email).execute()
            if result.data:
                user_data = result.data[0]
                logger.info(f"🔐 [CHECK-ADMIN] Found user by email: {user_email}")
        
        if not user_data:
            logger.warning(f"⚠️ [CHECK-ADMIN] User not found: user_id={user_id}, email={user_email}")
            response = jsonify({
                "success": True,
                "isAdmin": False,
                "isFullAdmin": False,
                "isMasterAdmin": False,
                "isOrderProcessingAdmin": False,
                "adminRole": None
            })
            return response, 200
        
        is_admin = user_data.get('is_admin', False) or False
        admin_role = user_data.get('admin_role')
        
        # Calculate admin types based on role
        is_master_admin = is_admin and admin_role == 'master_admin'
        is_full_admin = is_admin and admin_role == 'master_admin'
        is_order_processing_admin = is_admin and (
            admin_role == 'order_processing_admin' or 
            admin_role == 'admin' or 
            admin_role == 'master_admin' or 
            admin_role is None
        )
        
        logger.info(f"✅ [CHECK-ADMIN] Admin check result: is_admin={is_admin}, admin_role={admin_role}")
        
        response = jsonify({
            "success": True,
            "isAdmin": is_admin,
            "isFullAdmin": is_full_admin,
            "isMasterAdmin": is_master_admin,
            "isOrderProcessingAdmin": is_order_processing_admin,
            "adminRole": admin_role
        })
        return response, 200
        
    except Exception as e:
        logger.error(f"❌ [CHECK-ADMIN] Error: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return response, 500


@auth_bp.route("/login")
def login_page():
    """Login page route"""
    return render_template('login.html')


@auth_bp.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    """Admin login page"""
    if request.method == "POST":
        data = request.form
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return render_template('admin_login.html', error="Email and password are required")
        
        # Email whitelist validation
        allowed_emails = [
            'chidopro@proton.me',
            'alancraigdigital@gmail.com',
            'digitalavatartutorial@gmail.com',
            'admin@screenmerch.com',
            'driveralan1@yahoo.com'
        ]
        if email not in allowed_emails:
            return render_template('admin_login.html', error="Access restricted to authorized users only")
        
        try:
            client = _get_supabase_client()
            result = client.table('users').select('*').eq('email', email).execute()
            
            if result.data:
                user = result.data[0]
                stored_password = user.get('password_hash', '')
                user_role = user.get('role', 'customer')
                is_admin = user.get('is_admin', False)
                admin_role = user.get('admin_role')
                
                # Check password and admin access (role=='admin' OR is_admin flag)
                if password != stored_password:
                    return render_template('admin_login.html', error="Invalid credentials or insufficient privileges")
                if user_role == 'admin' or is_admin or admin_role in ('master_admin', 'admin', 'order_processing_admin'):
                    session['admin_logged_in'] = True
                    session['admin_email'] = email
                    session['admin_id'] = user.get('id')
                    logger.info(f"Admin {email} logged in successfully")
                    return redirect(url_for('admin.admin_orders'))
                else:
                    return render_template('admin_login.html', error="Invalid credentials or insufficient privileges")
            else:
                return render_template('admin_login.html', error="Invalid credentials")
                
        except Exception as e:
            logger.error(f"Admin login error: {str(e)}")
            return render_template('admin_login.html', error="Authentication service unavailable")
    
    return render_template('admin_login.html')


@auth_bp.route("/api/auth/signup", methods=["POST", "OPTIONS"])
@auth_bp.route("/api/auth/signup/", methods=["POST", "OPTIONS"])
@(_get_limiter().limit("10 per minute") if _get_limiter() else lambda f: f)
def auth_signup():
    """Handle user signup with email and password validation"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cache-Control,Pragma,Expires')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    
    try:
        data = _data_from_request()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        
        if not email or not password:
            return jsonify({"success": False, "error": "Email and password are required"}), 400
        
        # Validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({"success": False, "error": "Please enter a valid email address"}), 400
        
        # Validate password strength
        if len(password) < 6:
            return jsonify({"success": False, "error": "Password must be at least 6 characters long"}), 400
        
        # Check if this is a creator signup
        is_creator = data.get("is_creator", False) or data.get("role") == "creator"
        current_creator_count = 0
        
        # If creator signup, check the 20-user limit
        if is_creator:
            try:
                client = _get_supabase_client()
                creator_result = client.table('users').select('id').in_('status', ['active', 'pending']).eq('role', 'creator').execute()
                current_creator_count = len(creator_result.data) if creator_result.data else 0
                
                if current_creator_count >= 20:
                    response = jsonify({
                        "success": False, 
                        "error": "We've reached our limit of 20 creator signups. Please check back later or contact support."
                    })
                    response.headers.add('Access-Control-Allow-Origin', '*')
                    return response, 403
            except Exception as limit_error:
                logger.error(f"Error checking creator limit: {str(limit_error)}")
        
        # Check if user already exists
        try:
            client = _get_supabase_client()
            existing_user = client.table('users').select('*').eq('email', email).execute()
            
            if existing_user.data:
                return jsonify({"success": False, "error": "An account with this email already exists"}), 409
            
            # Create new user
            user_role = 'creator' if is_creator else 'customer'
            user_status = 'pending' if is_creator else 'active'
            
            # Hash password with bcrypt
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            new_user = {
                'email': email,
                'password_hash': password_hash,
                'role': user_role,
                'status': user_status,
                'email_verified': False
            }
            
            result = client.table('users').insert(new_user).execute()
            
            if result.data:
                user_role = result.data[0].get('role', 'customer')
                user_status = result.data[0].get('status', 'active')
                
                if user_role == 'creator' and user_status == 'pending':
                    success_message = "Account created successfully! Your application is pending approval. You'll receive an email once approved."
                else:
                    success_message = "Account created successfully!"
                
                logger.info(f"New user {email} created successfully (role: {user_role}, status: {user_status})")
                
                # Send admin notification email if this is a creator signup
                mail_to = _get_config('MAIL_TO')
                resend_api_key = _get_config('RESEND_API_KEY')
                resend_from = _get_config('RESEND_FROM', 'noreply@screenmerch.com')
                
                if user_role == 'creator' and user_status == 'pending' and mail_to and resend_api_key:
                    try:
                        admin_email_data = {
                            "from": resend_from,
                            "to": [mail_to],
                            "subject": f"🎨 New Creator Signup Request: {email}",
                            "html": f"""
                            <h1>🎨 New Creator Signup Request</h1>
                            <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50;">
                                <h2>Creator Details:</h2>
                                <p><strong>Email:</strong> {email}</p>
                                <p><strong>User ID:</strong> {result.data[0].get('id')}</p>
                                <p><strong>Status:</strong> Pending Approval</p>
                                <p><strong>Signup Date:</strong> {result.data[0].get('created_at', 'N/A')}</p>
                            </div>
                            <p><strong>Action Required:</strong> Please review and approve this creator signup in the admin panel.</p>
                            <p><strong>Current Creator Count:</strong> {current_creator_count + 1} / 20</p>
                            """
                        }
                        
                        email_response = requests.post(
                            "https://api.resend.com/emails",
                            headers={
                                "Authorization": f"Bearer {resend_api_key}",
                                "Content-Type": "application/json"
                            },
                            json=admin_email_data
                        )
                        if email_response.status_code == 200:
                            logger.info(f"✅ Admin notification sent for new creator signup: {email}")
                    except Exception as email_error:
                        logger.error(f"❌ Error sending admin notification: {str(email_error)}")
                
                response = jsonify({
                    "success": True, 
                    "message": success_message,
                    "user": {
                        "id": result.data[0].get('id'),
                        "email": result.data[0].get('email'),
                        "display_name": result.data[0].get('display_name'),
                        "role": user_role,
                        "status": user_status
                    }
                })
                
                # Generate token
                token = str(uuid.uuid4())
                
                is_form = not request.is_json
                domain = _cookie_domain()
                
                if is_form:
                    resp = redirect(_return_url(), code=303)
                else:
                    resp = make_response(jsonify(
                        success=True,
                        message=success_message,
                        user={"email": email, "role": user_role, "status": user_status},
                        token=token
                    ), 200)
                
                resp.set_cookie(
                    "sm_session", token,
                    domain=domain, path="/",
                    secure=True, httponly=True, samesite="None", max_age=7*24*3600
                )
                return resp
            else:
                response = jsonify({"success": False, "error": "Failed to create account"})
                return response, 500
                
        except Exception as db_error:
            logger.error(f"Database error during signup: {str(db_error)}")
            if "duplicate key" in str(db_error).lower():
                response = jsonify({"success": False, "error": "An account with this email already exists"})
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response, 409
            response = jsonify({"success": False, "error": "Account creation failed"})
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 500
            
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500


@auth_bp.route("/api/auth/signup/email-only", methods=["POST", "OPTIONS"])
def auth_signup_email_only():
    """Handle customer signup with email only - sends verification email"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        # Flask-CORS handles CORS headers automatically
        return response
    
    try:
        data = _data_from_request()
        email = (data.get("email") or "").strip().lower()
        
        if not email:
            return jsonify({"success": False, "error": "Email is required"}), 400
        
        # Validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({"success": False, "error": "Please enter a valid email address"}), 400
        
        client = _get_supabase_client()
        
        # Check if user already exists
        existing_user = client.table('users').select('*').eq('email', email).execute()
        
        if existing_user.data:
            for user in existing_user.data:
                user_status = user.get('status')
                if user_status in ['active', 'pending']:
                    return jsonify({"success": False, "error": "An account with this email already exists. Please sign in instead."}), 409
        
        # Generate verification token
        verification_token = str(uuid.uuid4())
        token_expiry = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        
        # Create new user without password
        new_user = {
            'email': email,
            'role': 'customer',
            'status': 'active',
            'email_verified': False,
            'email_verification_token': verification_token,
            'token_expiry': token_expiry
        }
        
        result = client.table('users').insert(new_user).execute()
        
        if result.data:
            # Send verification email (prefer config, fallback to env for Resend)
            resend_api_key = _get_config('RESEND_API_KEY') or os.getenv('RESEND_API_KEY')
            resend_from = _get_config('RESEND_FROM') or os.getenv('RESEND_FROM', 'noreply@screenmerch.com')
            frontend_url = os.getenv("FRONTEND_URL", "https://screenmerch.com")
            verification_link = f"{frontend_url}/verify-email?token={verification_token}&email={quote(email, safe='')}"
            
            if resend_api_key:
                try:
                    email_html = f"""
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Verify Your Email - ScreenMerch</title>
                    </head>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: white; margin: 0;">Welcome to ScreenMerch!</h1>
                        </div>
                        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                            <p>Hi there,</p>
                            <p>Thank you for signing up! Please verify your email address and set your password by clicking the button below:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{verification_link}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email & Set Password</a>
                            </div>
                            <p style="font-size: 12px; color: #666;">Or copy and paste this link into your browser:</p>
                            <p style="font-size: 12px; color: #667eea; word-break: break-all;">{verification_link}</p>
                            <p style="font-size: 12px; color: #666; margin-top: 30px;">This link will expire in 24 hours.</p>
                        </div>
                    </body>
                    </html>
                    """
                    
                    email_response = requests.post(
                        "https://api.resend.com/emails",
                        headers={
                            "Authorization": f"Bearer {resend_api_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "from": resend_from,
                            "to": email,
                            "subject": "Verify Your Email - ScreenMerch",
                            "html": email_html
                        },
                        timeout=30
                    )
                    
                    if email_response.status_code == 200:
                        logger.info(f"✅ Verification email sent successfully to {email}")
                    else:
                        logger.warning(f"Resend returned {email_response.status_code}: {email_response.text}")
                except Exception as email_error:
                    logger.error(f"❌ Error sending verification email: {str(email_error)}")
            else:
                logger.warning("RESEND_API_KEY not set - verification email not sent. Set RESEND_API_KEY (and RESEND_FROM) in Fly.io secrets.")
            
            response = jsonify({
                "success": True,
                "message": "Please check your email to verify your account and set your password."
            })
            return response, 200
        else:
            response = jsonify({"success": False, "error": "Failed to create account"})
            return response, 500
            
    except Exception as e:
        logger.error(f"Email-only signup error: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return response, 500


@auth_bp.route("/api/auth/request-set-password", methods=["POST", "OPTIONS"])
def auth_request_set_password():
    """Send a 'set password' email. For accounts with no password (e.g. creator signup) or forgot password."""
    if request.method == "OPTIONS":
        return jsonify(success=True)
    try:
        data = _data_from_request()
        email = (data.get("email") or "").strip().lower()
        if not email or "@" not in email:
            return jsonify({"success": False, "error": "Valid email is required"}), 400
        client = _get_supabase_client()
        result = client.table('users').select('id, email').eq('email', email).execute()
        if not result.data:
            return jsonify({"success": True, "message": "If an account exists with that email, we sent a link to set your password."}), 200
        verification_token = str(uuid.uuid4())
        token_expiry = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        client.table('users').update({
            'email_verification_token': verification_token,
            'token_expiry': token_expiry
        }).eq('id', result.data[0]['id']).execute()
        resend_api_key = _get_config('RESEND_API_KEY')
        resend_from = _get_config('RESEND_FROM', 'noreply@screenmerch.com')
        frontend_url = os.getenv("FRONTEND_URL", "https://screenmerch.com")
        link = f"{frontend_url}/verify-email?token={verification_token}&email={quote(email)}"
        if resend_api_key:
            try:
                r = requests.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json"},
                    json={
                        "from": resend_from,
                        "to": email,
                        "subject": "Set your ScreenMerch password",
                        "html": f"""
                        <p>You requested to set your password for ScreenMerch.</p>
                        <p><a href="{link}">Set your password</a> (link expires in 24 hours).</p>
                        <p>If you didn't request this, you can ignore this email.</p>
                        """
                    },
                    timeout=30
                )
                if r.status_code == 200:
                    logger.info(f"request-set-password: email sent to {email}")
                else:
                    logger.error(f"request-set-password: Resend failed status={r.status_code} body={r.text[:500]}")
            except Exception as e:
                logger.error(f"request-set-password email error: {e}")
        else:
            logger.warning("request-set-password: RESEND_API_KEY not set - set-password email not sent. Set RESEND_API_KEY and RESEND_FROM in Fly.io secrets.")
        return jsonify({"success": True, "message": "If an account exists with that email, we sent a link to set your password."}), 200
    except Exception as e:
        logger.error(f"request-set-password error: {e}")
        return jsonify({"success": False, "error": "Something went wrong. Please try again."}), 500


@auth_bp.route("/api/auth/verify-email", methods=["POST", "OPTIONS"])
def auth_verify_email():
    """Verify email token and set password (first-time set or reset)."""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        # Flask-CORS handles CORS headers automatically
        return response
    
    try:
        data = _data_from_request()
        token = data.get("token", "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password", "")
        
        if not token or not email or not password:
            return jsonify({"success": False, "error": "Token, email, and password are required"}), 400
        
        # Validate password strength
        if len(password) < 6:
            return jsonify({"success": False, "error": "Password must be at least 6 characters long"}), 400
        
        client = _get_supabase_client()
        
        # Find user by email and token
        result = client.table('users').select('*').eq('email', email).eq('email_verification_token', token).execute()
        
        if not result.data:
            return jsonify({"success": False, "error": "Invalid or expired verification link"}), 400
        
        user = result.data[0]
        
        # Check if token is expired
        token_expiry_str = user.get('token_expiry')
        if token_expiry_str:
            try:
                token_expiry = datetime.fromisoformat(token_expiry_str.replace('Z', '+00:00'))
                if datetime.now(timezone.utc) > token_expiry.replace(tzinfo=timezone.utc):
                    return jsonify({"success": False, "error": "Verification link has expired. Please request a new one."}), 400
            except Exception:
                pass
        
        # Allow setting password when token is valid (first-time set or reset); do not block if email_verified
        # Update user: set password, mark as verified, clear token
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        update_data = {
            'password_hash': password_hash,
            'email_verified': True,
            'email_verification_token': None,
            'token_expiry': None
        }
        
        update_result = client.table('users').update(update_data).eq('id', user.get('id')).execute()
        
        if update_result.data:
            token = str(uuid.uuid4())
            user_id = str(update_result.data[0].get('id'))
            row = update_result.data[0]
            payload = {
                "success": True,
                "message": "Email verified and password set successfully!",
                "user": {
                    "id": row.get('id'),
                    "email": row.get('email'),
                    "display_name": row.get('display_name'),
                    "role": row.get('role', 'customer'),
                    "status": row.get('status', 'active'),
                },
                "token": token
            }
            resp = make_response(jsonify(payload), 200)
            domain = _cookie_domain()
            resp.set_cookie(
                "sm_session", token,
                domain=domain, path="/",
                secure=True, httponly=True, samesite="None", max_age=7*24*3600
            )
            current_app.config.setdefault("session_token_store", {})[token] = user_id
            return resp
        else:
            response = jsonify({"success": False, "error": "Failed to verify email"})
            return response, 500
            
    except Exception as e:
        logger.error(f"Email verification error: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return response, 500


# Google OAuth login is in app.py only so flow=creator_signup is encoded in state.
# That ensures new creator signups are recorded with status=pending and show in Pending Approval.
# Do not add /api/auth/google/login here or the callback would not see flow=creator_signup.


# Google OAuth callback is handled in app.py (single source of truth).
# It uses supabase_admin for new creator inserts and creator_signup → thank-you redirect.
