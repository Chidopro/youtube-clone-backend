"""Rate limiter for auth and sensitive endpoints - single instance, init_app in app.py"""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


def _exempt_browse_and_static():
    """Exempt product API and static (images) so browsing is unlimited; only limit auth/sensitive routes."""
    try:
        from flask import request
        path = (request.path or "")
        return path.startswith("/static/") or path.startswith("/api/product/")
    except Exception:
        return False


limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    default_limits_exempt_when=_exempt_browse_and_static,
)
