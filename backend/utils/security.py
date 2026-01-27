"""Security utilities for the ScreenMerch application"""
import logging
from functools import wraps
from flask import request, jsonify, redirect, url_for, session

logger = logging.getLogger(__name__)


def admin_required(supabase_admin=None):
    """
    Decorator factory to require admin authentication - supports both session and email-based auth
    
    Args:
        supabase_admin: Supabase admin client (optional, can be passed when creating decorator)
    
    Returns:
        Decorator function
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Allow OPTIONS requests to pass through for CORS preflight
            if request.method == "OPTIONS":
                return f(*args, **kwargs)
            
            # Check session-based auth (for direct backend access)
            if session.get('admin_logged_in'):
                return f(*args, **kwargs)
            
            # Check email-based auth (for cross-origin API requests)
            user_email = request.headers.get('X-User-Email') or request.args.get('user_email')
            if user_email:
                try:
                    user_email = user_email.strip().lower()
                    # Import here to avoid circular imports
                    from app import supabase_admin as admin_client
                    client = supabase_admin or admin_client
                    
                    if not client:
                        # Fallback to regular supabase client
                        from app import supabase
                        client = supabase
                    
                    # Check if user is admin in database - check both is_admin and admin_role fields
                    result = client.table('users').select('is_admin, admin_role, role, email').eq('email', user_email).execute()
                    if result.data and len(result.data) > 0:
                        user = result.data[0]
                        # Check for is_admin flag and admin_role (new system)
                        is_admin = user.get('is_admin', False)
                        admin_role = user.get('admin_role')
                        # Also check legacy role == 'admin' for backward compatibility
                        role = user.get('role')
                        
                        if is_admin or (role == 'admin') or (admin_role in ['master_admin', 'admin', 'order_processing_admin']):
                            logger.info(f"✅ Admin access granted via email: {user_email} (is_admin={is_admin}, admin_role={admin_role}, role={role})")
                            return f(*args, **kwargs)
                        
                        # Also check allowed emails list
                        allowed_emails = [
                            'chidopro@proton.me',
                            'alancraigdigital@gmail.com', 
                            'digitalavatartutorial@gmail.com',
                            'admin@screenmerch.com',
                            'filialsons@gmail.com',
                            'driveralan1@yahoo.com'  # Master admin email
                        ]
                        if user_email in allowed_emails:
                            logger.info(f"✅ Admin access granted via allowed email: {user_email}")
                            return f(*args, **kwargs)
                except Exception as e:
                    logger.error(f"Error checking admin status for {user_email}: {str(e)}")
            
            # No valid auth found - return 401 instead of redirect for API endpoints
            if request.path.startswith('/api/'):
                response = jsonify({"error": "Unauthorized", "message": "Admin access required"})
                response.status_code = 401
                origin = request.headers.get('Origin', '*')
                response.headers.add('Access-Control-Allow-Origin', origin)
                response.headers.add('Access-Control-Allow-Credentials', 'true')
                return response
            
            # For non-API endpoints, redirect to login
            return redirect(url_for('admin_login'))
        return decorated_function
    return decorator
