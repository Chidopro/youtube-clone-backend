"""Authentication routes Blueprint for ScreenMerch"""
from flask import Blueprint, request, jsonify, render_template, redirect, url_for, session, make_response
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
            'admin@screenmerch.com'
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
                
                # Check password and admin role
                if password == stored_password and user_role == 'admin':
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
            # Send verification email
            resend_api_key = _get_config('RESEND_API_KEY')
            resend_from = _get_config('RESEND_FROM', 'noreply@screenmerch.com')
            frontend_url = os.getenv("FRONTEND_URL", "https://screenmerch.com")
            verification_link = f"{frontend_url}/verify-email?token={verification_token}&email={email}"
            
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
                except Exception as email_error:
                    logger.error(f"❌ Error sending verification email: {str(email_error)}")
            
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


@auth_bp.route("/api/auth/verify-email", methods=["POST", "OPTIONS"])
def auth_verify_email():
    """Verify email token and set password"""
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
        
        # Check if already verified
        if user.get('email_verified'):
            return jsonify({"success": False, "error": "Email already verified. Please sign in."}), 400
        
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
            
            response = jsonify({
                "success": True,
                "message": "Email verified and password set successfully!",
                "user": {
                    "id": update_result.data[0].get('id'),
                    "email": update_result.data[0].get('email'),
                    "display_name": update_result.data[0].get('display_name'),
                    "role": update_result.data[0].get('role', 'customer')
                },
                "token": token
            })
            return response, 200
        else:
            response = jsonify({"success": False, "error": "Failed to verify email"})
            return response, 500
            
    except Exception as e:
        logger.error(f"Email verification error: {str(e)}")
        response = jsonify({"success": False, "error": "Internal server error"})
        return response, 500


@auth_bp.route("/api/auth/google/login", methods=["GET", "OPTIONS"])
@cross_origin(origins=[], supports_credentials=True)
def google_login():
    """Initiate Google OAuth login"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        origin = request.headers.get('Origin')
        allowed_origins = [
            "https://screenmerch.com", "https://www.screenmerch.com", 
            "https://screenmerch.fly.dev", 
            "https://68e94d7278d7ced80877724f--eloquent-crumble-37c09e.netlify.app", 
            "https://68e9564fa66cd5f4794e5748--eloquent-crumble-37c09e.netlify.app", 
            "http://localhost:3000", "http://localhost:5173"
        ]
        
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
        else:
            response.headers['Access-Control-Allow-Origin'] = 'https://screenmerch.com'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response
    
    google_client_id = _get_config('GOOGLE_CLIENT_ID')
    google_client_secret = _get_config('GOOGLE_CLIENT_SECRET')
    google_redirect_uri = _get_config('GOOGLE_REDIRECT_URI')
    
    if not google_client_id or not google_client_secret:
        return jsonify({"success": False, "error": "Google OAuth not configured"}), 500
    
    try:
        # Create OAuth flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": google_client_id,
                    "client_secret": google_client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [google_redirect_uri]
                }
            },
            scopes=[
                'openid',
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/youtube.readonly'
            ]
        )
        flow.redirect_uri = google_redirect_uri
        
        # Get return_url (subdomain) - encode it in state parameter
        return_url = request.args.get('return_url') or request.headers.get('Referer') or "https://screenmerch.com"
        frontend_origin = "https://screenmerch.com"
        if return_url and return_url.startswith('http'):
            from urllib.parse import urlparse
            parsed = urlparse(return_url)
            frontend_origin = f"{parsed.scheme}://{parsed.netloc}"
            logger.info(f"🔍 [GOOGLE OAUTH] Extracted return_url: {frontend_origin}")
        
        # Generate authorization URL
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        
        # Store state in session
        session['oauth_state'] = state
        
        # Encode return_url in state parameter
        state_data = {
            'state': state,
            'return_url': frontend_origin
        }
        encoded_state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()
        
        # Replace state in authorization URL
        authorization_url = authorization_url.replace(f'state={state}', f'state={encoded_state}')
        
        # Store in session as fallback
        session['oauth_return_url'] = frontend_origin
        logger.info(f"🔍 [GOOGLE OAUTH] Encoded return_url in state: {frontend_origin}")
        
        return redirect(authorization_url, code=302)
        
    except Exception as e:
        logger.error(f"Google OAuth login error: {str(e)}")
        return jsonify({"success": False, "error": "Failed to initiate Google login"}), 500


@auth_bp.route("/api/auth/google/callback", methods=["GET", "OPTIONS"])
@cross_origin(origins=[], supports_credentials=True)
def google_callback():
    """Handle Google OAuth callback"""
    if request.method == "OPTIONS":
        response = jsonify(success=True)
        origin = request.headers.get('Origin')
        allowed_origins = [
            "https://screenmerch.com", "https://www.screenmerch.com",
            "https://68e94d7278d7ced80877724f--eloquent-crumble-37c09e.netlify.app",
            "https://68e9564fa66cd5f4794e5748--eloquent-crumble-37c09e.netlify.app",
            "http://localhost:3000", "http://localhost:5173"
        ]
        
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
        else:
            response.headers['Access-Control-Allow-Origin'] = 'https://screenmerch.com'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response
    
    try:
        code = request.args.get('code')
        state = request.args.get('state')
        
        if not code:
            return jsonify({"success": False, "error": "Authorization code not provided"}), 400
        
        # Decode return_url from state parameter
        frontend_origin_from_state = None
        if state:
            try:
                decoded_state = base64.urlsafe_b64decode(state.encode()).decode()
                state_data = json.loads(decoded_state)
                if 'return_url' in state_data:
                    frontend_origin_from_state = state_data['return_url']
                    state = state_data.get('state', state)
            except Exception:
                pass
        
        google_client_id = _get_config('GOOGLE_CLIENT_ID')
        google_client_secret = _get_config('GOOGLE_CLIENT_SECRET')
        google_redirect_uri = _get_config('GOOGLE_REDIRECT_URI')
        
        # Create OAuth flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": google_client_id,
                    "client_secret": google_client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [google_redirect_uri]
                }
            },
            scopes=[
                'openid',
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/youtube.readonly'
            ]
        )
        flow.redirect_uri = google_redirect_uri
        
        # Exchange code for tokens
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Get user info from Google
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        
        # Get YouTube channel info
        youtube_service = build('youtube', 'v3', credentials=credentials)
        channel_response = youtube_service.channels().list(
            part='snippet,statistics',
            mine=True
        ).execute()
        
        google_email = user_info.get('email')
        google_name = user_info.get('name')
        google_picture = user_info.get('picture')
        
        client = _get_supabase_client()
        
        # Check if user exists
        result = client.table('users').select('*').eq('email', google_email).execute()
        
        if result.data:
            user = result.data[0]
            user_status = user.get('status', 'active')
            
            # Block login if pending/suspended/banned
            if user_status == 'pending':
                frontend_url = session.get('oauth_return_url') or frontend_origin_from_state or "https://screenmerch.com"
                if not frontend_url.startswith('http'):
                    frontend_url = f"https://{frontend_url}"
                error_message = "Your account is pending approval. Please wait for admin approval before signing in."
                return redirect(f"{frontend_url}?login=error&message={quote(error_message)}")
            
            if user_status in ['suspended', 'banned']:
                frontend_url = session.get('oauth_return_url') or frontend_origin_from_state or "https://screenmerch.com"
                if not frontend_url.startswith('http'):
                    frontend_url = f"https://{frontend_url}"
                error_message = f"Your account has been {user_status}. Please contact support for assistance."
                return redirect(f"{frontend_url}?login=error&message={quote(error_message)}")
            
            # Update user info
            update_data = {'display_name': google_name}
            current_profile_image = user.get('profile_image_url')
            if google_picture and (not current_profile_image or current_profile_image == google_picture):
                update_data['profile_image_url'] = google_picture
            
            update_result = client.table('users').update(update_data).eq('id', user['id']).execute()
            if update_result.data:
                user = update_result.data[0]
        else:
            # Create new user - check creator limit
            current_creator_count = 0
            try:
                creator_result = client.table('users').select('id').in_('status', ['active', 'pending']).eq('role', 'creator').execute()
                current_creator_count = len(creator_result.data) if creator_result.data else 0
                
                if current_creator_count >= 20:
                    frontend_url = session.get('oauth_return_url') or frontend_origin_from_state or "https://screenmerch.com"
                    if not frontend_url.startswith('http'):
                        frontend_url = f"https://{frontend_url}"
                    error_message = "We've reached our limit of 20 creator signups. Please check back later or contact support."
                    return redirect(f"{frontend_url}?login=error&message={quote(error_message)}")
            except Exception:
                pass
            
            # Create new user
            new_user = {
                'email': google_email,
                'display_name': google_name,
                'role': 'creator',
                'status': 'pending',
                'profile_image_url': google_picture
            }
            result = client.table('users').insert(new_user).execute()
            user = result.data[0] if result.data else None
            
            # Send admin notification
            mail_to = _get_config('MAIL_TO')
            resend_api_key = _get_config('RESEND_API_KEY')
            resend_from = _get_config('RESEND_FROM', 'noreply@screenmerch.com')
            
            if user and mail_to and resend_api_key:
                try:
                    admin_email_data = {
                        "from": resend_from,
                        "to": [mail_to],
                        "subject": f"🎨 New Creator Signup Request: {google_email}",
                        "html": f"""
                        <h1>🎨 New Creator Signup Request</h1>
                        <div style="background: #f0f8ff; padding: 20px; border-radius: 8px;">
                            <h2>Creator Details:</h2>
                            <p><strong>Email:</strong> {google_email}</p>
                            <p><strong>Name:</strong> {google_name}</p>
                            <p><strong>User ID:</strong> {user.get('id')}</p>
                            <p><strong>Status:</strong> Pending Approval</p>
                            <p><strong>Signup Method:</strong> Google OAuth</p>
                        </div>
                        <p><strong>Current Creator Count:</strong> {current_creator_count + 1} / 20</p>
                        """
                    }
                    requests.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json"},
                        json=admin_email_data
                    )
                except Exception:
                    pass
        
        if not user:
            frontend_url = session.get('oauth_return_url') or frontend_origin_from_state or "https://screenmerch.com"
            if not frontend_url.startswith('http'):
                frontend_url = f"https://{frontend_url}"
            return redirect(f"{frontend_url}?login=error&message={quote('Failed to create or update user account')}")
        
        # Get YouTube channel info
        youtube_channel = None
        if channel_response.get('items'):
            channel = channel_response['items'][0]
            youtube_channel = {
                'id': channel['id'],
                'title': channel['snippet']['title'],
                'subscriber_count': channel['statistics'].get('subscriberCount', 0),
                'video_count': channel['statistics'].get('videoCount', 0)
            }
        
        session.pop('oauth_state', None)
        
        # Prepare user data
        profile_image_url = user.get('profile_image_url') or google_picture
        user_data = {
            "id": user.get('id'),
            "email": user.get('email'),
            "display_name": user.get('display_name'),
            "role": user.get('role', 'creator'),
            "picture": google_picture,
            "profile_image_url": profile_image_url,
            "cover_image_url": user.get('cover_image_url'),
            "bio": user.get('bio'),
            "subdomain": user.get('subdomain'),
            "user_metadata": {"name": user.get('display_name'), "picture": profile_image_url},
            "youtube_channel": youtube_channel
        }
        
        # Determine frontend URL (prioritize subdomain from session/state, then user's subdomain)
        frontend_url = frontend_origin_from_state or session.get('oauth_return_url') or "https://screenmerch.com"
        
        # Extract subdomain from URL if present
        from urllib.parse import urlparse
        parsed = urlparse(frontend_url)
        hostname = parsed.netloc
        if hostname and hostname.endswith('.screenmerch.com') and hostname != 'screenmerch.com' and hostname != 'www.screenmerch.com':
            subdomain = hostname.replace('.screenmerch.com', '')
            frontend_url = f"https://{subdomain}.screenmerch.com"
        elif user.get('subdomain'):
            frontend_url = f"https://{user.get('subdomain')}.screenmerch.com"
        else:
            frontend_url = "https://screenmerch.com"
        
        session.pop('oauth_return_url', None)
        
        # Redirect to frontend with user data
        user_data_encoded = quote(json.dumps(user_data))
        redirect_url = f"{frontend_url}?login=success&user={user_data_encoded}"
        
        logger.info(f"✅ [GOOGLE OAUTH CALLBACK] Redirecting to: {frontend_url}")
        return redirect(redirect_url)
        
    except Exception as e:
        logger.error(f"❌ Google OAuth callback error: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        
        frontend_url = session.get('oauth_return_url') or "https://screenmerch.com"
        if not frontend_url.startswith('http'):
            frontend_url = f"https://{frontend_url}"
        error_message = str(e)[:100]
        return redirect(f"{frontend_url}?login=error&message={quote(error_message)}")
