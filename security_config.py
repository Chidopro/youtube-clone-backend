# Security Configuration for ScreenMerch
import os
from datetime import datetime, timedelta
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

class SecurityManager:
    """Security manager for rate limiting and threat detection"""
    
    def __init__(self):
        self.request_counts = defaultdict(list)
        self.blocked_ips = set()
        self.max_requests_per_minute = 60
        self.max_requests_per_hour = 1000
        self.block_duration = timedelta(hours=1)
    
    def check_rate_limit(self, ip_address):
        """Check if IP is rate limited"""
        now = datetime.now()
        
        # Clean old requests
        self.request_counts[ip_address] = [
            req_time for req_time in self.request_counts[ip_address]
            if now - req_time < timedelta(hours=1)
        ]
        
        # Check if IP is blocked
        if ip_address in self.blocked_ips:
            return False, "IP is temporarily blocked"
        
        # Add current request
        self.request_counts[ip_address].append(now)
        
        # Check minute limit
        minute_ago = now - timedelta(minutes=1)
        recent_requests = len([
            req_time for req_time in self.request_counts[ip_address]
            if req_time > minute_ago
        ])
        
        if recent_requests > self.max_requests_per_minute:
            self.blocked_ips.add(ip_address)
            logger.warning(f"Rate limit exceeded for IP: {ip_address}")
            return False, "Rate limit exceeded"
        
        # Check hour limit
        hour_ago = now - timedelta(hours=1)
        hourly_requests = len([
            req_time for req_time in self.request_counts[ip_address]
            if req_time > hour_ago
        ])
        
        if hourly_requests > self.max_requests_per_hour:
            self.blocked_ips.add(ip_address)
            logger.warning(f"Hourly rate limit exceeded for IP: {ip_address}")
            return False, "Hourly rate limit exceeded"
        
        return True, "OK"
    
    def is_suspicious_request(self, request):
        """Check for suspicious request patterns"""
        suspicious_indicators = [
            # SQL injection attempts
            "' OR '1'='1",
            "'; DROP TABLE",
            "UNION SELECT",
            # XSS attempts
            "<script>",
            "javascript:",
            # Path traversal
            "../",
            "..\\",
            # Command injection
            "; ls",
            "| cat",
            # Large payloads
            len(request.get_data()) > 10000
        ]
        
        request_data = str(request.get_data()).lower()
        request_url = request.url.lower()
        
        for indicator in suspicious_indicators:
            if isinstance(indicator, str) and indicator.lower() in request_data:
                logger.warning(f"Suspicious request detected: {indicator}")
                return True
            elif isinstance(indicator, bool) and indicator:
                logger.warning("Large payload detected")
                return True
        
        return False

# Security headers configuration
SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' https: data: https://sojxbydpcdcdzfdtbypd.supabase.co; connect-src 'self' https://api.printful.com https://api.resend.com https://api.stripe.com https://sojxbydpcdcdzfdtbypd.supabase.co; frame-src https://js.stripe.com https://checkout.stripe.com;",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
}

# CORS configuration for production
PRODUCTION_CORS_ORIGINS = [
    "https://screenmerch.com",
    "https://www.screenmerch.com",
    "chrome-extension://*"  # For your browser extension
]

# Allowed file types for uploads
ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.mov', '.avi'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB for videos

def validate_file_upload(filename, file_size):
    """Validate file uploads"""
    if not filename:
        return False, "No filename provided"
    
    file_ext = os.path.splitext(filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        return False, f"File type {file_ext} not allowed"
    
    if file_size > MAX_FILE_SIZE:
        return False, f"File size {file_size} exceeds maximum {MAX_FILE_SIZE}"
    
    return True, "OK"

# Initialize security manager
security_manager = SecurityManager() 