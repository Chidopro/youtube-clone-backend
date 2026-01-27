"""Route Blueprints for the ScreenMerch application"""
from .auth import auth_bp, register_auth_routes
from .admin import admin_bp, register_admin_routes
from .products import products_bp, register_products_routes
from .orders import orders_bp, register_orders_routes
from .videos import videos_bp, register_videos_routes
from .analytics import analytics_bp, register_analytics_routes

__all__ = [
    'auth_bp', 'register_auth_routes',
    'admin_bp', 'register_admin_routes',
    'products_bp', 'register_products_routes',
    'orders_bp', 'register_orders_routes',
    'videos_bp', 'register_videos_routes',
    'analytics_bp', 'register_analytics_routes'
]
