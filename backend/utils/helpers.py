"""Helper utility functions for the ScreenMerch application"""
import json
import logging
from flask import request

logger = logging.getLogger(__name__)


def format_timestamp(timestamp):
    """Convert timestamp to MM:SS format"""
    try:
        # Debug logging
        logger.info(f"🔍 Formatting timestamp: {timestamp} (type: {type(timestamp)})")
        
        if isinstance(timestamp, str):
            # Handle ISO timestamp format
            if 'T' in timestamp:
                from datetime import datetime
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                total_seconds = dt.timestamp()
            else:
                # Try to convert string to float
                total_seconds = float(timestamp)
        else:
            total_seconds = float(timestamp)
        
        # Handle very large timestamps (might be milliseconds or microseconds)
        if total_seconds > 86400:  # More than 24 hours, likely wrong format
            if total_seconds > 1000000000:  # Looks like milliseconds since epoch
                total_seconds = total_seconds / 1000
            elif total_seconds > 1000000000000:  # Looks like microseconds since epoch
                total_seconds = total_seconds / 1000000
        
        # If still too large, it might be a timestamp in seconds but for a very long video
        # Cap it at 24 hours (86400 seconds) for display purposes
        if total_seconds > 86400:
            total_seconds = total_seconds % 86400  # Get the remainder to show reasonable time
        
        minutes = int(total_seconds // 60)
        seconds = int(total_seconds % 60)
        result = f"{minutes:02d}:{seconds:02d}"
        logger.info(f"✅ Formatted timestamp: {timestamp} -> {result}")
        return result
    except (ValueError, TypeError) as e:
        logger.error(f"❌ Error formatting timestamp {timestamp}: {str(e)}")
        return str(timestamp)


def read_json():
    """Robust JSON reader with detailed diagnostics for proxied requests."""
    ct = (request.headers.get("Content-Type") or "").lower()
    raw = request.get_data(cache=False, as_text=True) or ""
    
    # Short raw log
    logger.info(f"[REQ] {request.path} CT={ct} len={len(raw)} raw[0:200]={raw[:200]!r}")

    data = None
    # 1) Normal case - application/json
    if "application/json" in ct:
        data = request.get_json(silent=True)
    # 2) Some proxies send text/plain or missing CT
    if data is None and raw:
        try:
            data = json.loads(raw)
        except Exception as e:
            logger.warning(f"[PARSE] JSON.loads failed: {str(e)}")
            data = None
    # 3) Fallback: form-encoded (unlikely but safe)
    if data is None and request.form:
        try:
            data = {k: json.loads(v) if v and v.strip().startswith(("{", "[")) else v
                    for k, v in request.form.items()}
        except Exception:
            data = dict(request.form)

    if not isinstance(data, dict):
        data = {}

    # Detailed keys snapshot
    logger.info(f"[PARSED] keys={list(data.keys())} shipping_address={data.get('shipping_address')}")
    return data


def require_shipping_address(payload):
    """Validate and extract shipping address from payload."""
    addr = payload.get("shipping_address") or {}
    zip_code = (addr.get("zip") or addr.get("postal_code") or "").strip()
    country = (addr.get("country_code") or addr.get("country") or "US").strip()
    if not zip_code:
        return False, "ZIP / Postal Code is required."
    if not country:
        country = "US"  # Default to US
    return True, {"zip": zip_code, "country_code": country}


def _parse_zip(shipping_address: dict) -> str:
    """Parse ZIP code from shipping_address dict, handling multiple field names and types."""
    if not shipping_address:
        return ""
    raw = (
        shipping_address.get("zip") or
        shipping_address.get("postal_code") or
        shipping_address.get("postcode") or
        shipping_address.get("postalCode") or
        shipping_address.get("ZIP") or
        ""
    )
    try:
        return str(raw).strip()
    except Exception:
        return ""


def _data_from_request():
    if request.is_json:
        return request.get_json(silent=True) or {}
    return request.form or {}


def _return_url():
    return request.values.get("return_url") or "https://screenmerch.com/"


def _cookie_domain():
    host = (request.host or "").lower()
    if host.endswith("screenmerch.com"):
        return "screenmerch.com"
    if host.endswith("screenmerch.fly.dev"):
        return "screenmerch.fly.dev"
    return None


def get_cookie_domain():
    host = request.host.lower()
    if "screenmerch.com" in host:
        return ".screenmerch.com"
    elif "localhost" in host:
        return None
    else:
        return ".screenmerch.fly.dev"


def _allow_origin(resp):
    """Add CORS headers to response based on request origin"""
    origin = request.headers.get('Origin')
    allowed = {
        "https://screenmerch.com",
        "https://www.screenmerch.com",
        "https://screenmerch.fly.dev",
        "http://localhost:5173",
        "http://localhost:3000",
    }
    
    # Check exact match first
    origin_allowed = origin in allowed
    
    # If not exact match, check if it's a Netlify subdomain or screenmerch.com subdomain
    if not origin_allowed and origin:
        if origin.endswith('.netlify.app') and origin.startswith('https://'):
            origin_allowed = True
        # Allow subdomains of screenmerch.com (e.g., testcreator.screenmerch.com)
        elif origin.endswith('.screenmerch.com') and origin.startswith('https://'):
            origin_allowed = True
    
    if origin_allowed:
        resp.headers['Access-Control-Allow-Origin'] = origin
        resp.headers['Vary'] = 'Origin'
        resp.headers['Access-Control-Allow-Credentials'] = 'true'
    else:
        # Fallback to default
        resp.headers['Access-Control-Allow-Origin'] = 'https://screenmerch.com'
        resp.headers['Access-Control-Allow-Credentials'] = 'true'
    
    # CRITICAL: Add methods and headers for CORS preflight (required for PUT requests)
    resp.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Cache-Control,Pragma,Expires'
    
    return resp
