"""Analytics routes Blueprint for ScreenMerch.

The /api/analytics handler lives on app.py (markup-based payout summary).
This blueprint is kept for dependency injection used during app startup.
"""
from flask import Blueprint
import logging

logger = logging.getLogger(__name__)

analytics_bp = Blueprint('analytics', __name__)


def register_analytics_routes(app, supabase, supabase_admin, order_store):
    """
    Register analytics routes with the Flask app.

    Args:
        app: Flask application instance
        supabase: Supabase client
        supabase_admin: Supabase admin client (for bypassing RLS)
        order_store: In-memory order store dictionary
    """
    analytics_bp.supabase = supabase
    analytics_bp.supabase_admin = supabase_admin
    analytics_bp.order_store = order_store
    app.register_blueprint(analytics_bp)
