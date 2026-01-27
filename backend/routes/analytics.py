"""Analytics routes Blueprint for ScreenMerch"""
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import logging
from datetime import datetime, timedelta

# Import utilities
from utils.helpers import _allow_origin

logger = logging.getLogger(__name__)

# Create Blueprint
analytics_bp = Blueprint('analytics', __name__)


def register_analytics_routes(app, supabase, supabase_admin, order_store):
    """
    Register analytics routes with the Flask app
    
    Args:
        app: Flask application instance
        supabase: Supabase client
        supabase_admin: Supabase admin client (for bypassing RLS)
        order_store: In-memory order store dictionary
    """
    # Store dependencies in Blueprint
    analytics_bp.supabase = supabase
    analytics_bp.supabase_admin = supabase_admin
    analytics_bp.order_store = order_store
    
    # Register the Blueprint
    app.register_blueprint(analytics_bp)


def _get_supabase_client():
    """Get Supabase client"""
    return analytics_bp.supabase if hasattr(analytics_bp, 'supabase') else None


def _get_supabase_admin():
    """Get Supabase admin client"""
    return analytics_bp.supabase_admin if hasattr(analytics_bp, 'supabase_admin') else None


def _get_order_store():
    """Get order store"""
    return analytics_bp.order_store if hasattr(analytics_bp, 'order_store') else {}


@analytics_bp.route("/api/analytics", methods=["GET"])
@cross_origin(origins=["https://screenmerch.com", "https://www.screenmerch.com"], supports_credentials=True)
def get_analytics():
    """Get analytics data for creator dashboard - PRECISE tracking by user_id"""
    try:
        user_id = request.args.get('user_id')
        channel_id = request.args.get('channel_id')
        
        # Validate user_id is provided
        if not user_id:
            logger.warning("⚠️ Analytics request missing user_id - returning empty data for security")
            return jsonify({
                'total_sales': 0,
                'total_revenue': 0,
                'avg_order_value': 0,
                'products_sold_count': 0,
                'videos_with_sales_count': 0,
                'sales_data': [0] * 30,
                'products_sold': [],
                'videos_with_sales': []
            })
        
        logger.info(f"📊 Analytics request - User ID: {user_id}, Channel ID: {channel_id}")
        
        all_orders = []
        order_store = _get_order_store()
        client = _get_supabase_admin() or _get_supabase_client()
        
        # Get orders from order_store (filtered by user_id)
        for order_id, order_data in order_store.items():
            order_creator_name = order_data.get('creator_name', 'Unknown Creator')
            
            if user_id and order_creator_name != 'Unknown Creator':
                try:
                    if client:
                        creator_match = client.table('users').select('id').or_(
                            f"display_name.ilike.{order_creator_name},username.ilike.{order_creator_name}"
                        ).eq('id', user_id).limit(1).execute()
                        if not creator_match.data or len(creator_match.data) == 0:
                            continue
                except Exception:
                    continue
            
            order_data_copy = dict(order_data)
            order_data_copy['order_id'] = order_id
            order_data_copy['status'] = 'pending'
            order_data_copy['created_at'] = order_data.get('timestamp', 'N/A')
            all_orders.append(order_data_copy)
        
        # Get orders from database (sales table)
        try:
            if client and user_id:
                query = client.table('sales').select(
                    'id,product_name,amount,image_url,user_id,channel_id,creator_name,video_title,created_at'
                )
                query = query.eq('user_id', user_id)
                
                if channel_id:
                    query = query.eq('channel_id', channel_id)
                
                sales_result = query.execute()
                
                for sale in sales_result.data:
                    sale_created_at = sale.get('created_at')
                    if not sale_created_at or sale_created_at == 'N/A':
                        sale_created_at = datetime.now().isoformat()
                    
                    order_data = {
                        'order_id': sale.get('id', 'db-' + str(sale.get('id'))),
                        'cart': [{
                            'product': sale.get('product_name', 'Unknown Product'),
                            'variants': {'color': 'N/A', 'size': 'N/A'},
                            'note': '',
                            'img': sale.get('image_url', ''),
                            'video_title': sale.get('video_title', 'Unknown Video'),
                            'creator_name': sale.get('creator_name', 'Unknown Creator'),
                            'price': sale.get('amount', 0)
                        }],
                        'status': 'completed',
                        'created_at': sale_created_at,
                        'total_value': sale.get('amount', 0),
                        'user_id': sale.get('user_id'),
                        'channel_id': sale.get('channel_id'),
                        'creator_name': sale.get('creator_name', 'Unknown Creator')
                    }
                    all_orders.append(order_data)
        except Exception as db_error:
            logger.error(f"Database error loading analytics: {str(db_error)}")
        
        # Calculate analytics
        total_sales = len(all_orders)
        total_revenue = sum(order.get('total_value', 0) for order in all_orders)
        avg_order_value = total_revenue / total_sales if total_sales > 0 else 0
        
        # Get unique products sold
        products_sold = {}
        videos_with_sales = {}
        
        for order in all_orders:
            if order.get('total_value', 0) <= 0:
                continue
                
            for item in order.get('cart', []):
                product_name = item.get('product', 'Unknown')
                if product_name not in products_sold:
                    products_sold[product_name] = 0
                products_sold[product_name] += 1
                
                video_name = item.get('video_title', 'Unknown Video')
                creator_name = item.get('creator_name', 'Unknown Creator')
                video_key = f"{creator_name} - {video_name}"
                
                if video_key not in videos_with_sales:
                    videos_with_sales[video_key] = {
                        'sales_count': 0,
                        'revenue': 0
                    }
                videos_with_sales[video_key]['sales_count'] += 1
                videos_with_sales[video_key]['revenue'] += order.get('total_value', 0)
        
        # Generate sales data for chart (last 30 days)
        sales_data = [0] * 30
        
        for order in all_orders:
            try:
                if order.get('created_at') and order.get('created_at') != 'N/A':
                    order_date = datetime.fromisoformat(order.get('created_at').replace('Z', '+00:00'))
                    days_ago = (datetime.now() - order_date.replace(tzinfo=None)).days
                    if 0 <= days_ago < 30:
                        sales_data[days_ago] += 1
            except Exception:
                pass
        
        # Generate daily sales data for last 7 days
        daily_sales = []
        now = datetime.now()
        for i in range(6, -1, -1):
            date = now - timedelta(days=i)
            date_str = date.strftime('%Y-%m-%d')
            date_display = date.strftime('%a, %b %d')
            
            day_sales_count = 0
            day_revenue = 0
            
            for order in all_orders:
                try:
                    if order.get('created_at') and order.get('created_at') != 'N/A':
                        order_date = datetime.fromisoformat(order.get('created_at').replace('Z', '+00:00'))
                        order_date_str = order_date.strftime('%Y-%m-%d')
                        
                        if order_date_str == date_str:
                            day_sales_count += len(order.get('cart', []))
                            day_revenue += order.get('total_value', 0)
                except Exception:
                    pass
            
            daily_sales.append({
                'date': date_str,
                'date_display': date_display,
                'sales_count': day_sales_count,
                'revenue': round(day_revenue, 2),
                'net_revenue': round(day_revenue * 0.7, 2)
            })
        
        # Calculate revenue per product
        products_sold_list = []
        for product, quantity in products_sold.items():
            product_revenue = 0
            for order in all_orders:
                for item in order.get('cart', []):
                    if item.get('product', '') == product:
                        item_price = item.get('price', 0)
                        if not item_price or item_price <= 0:
                            cart_length = len(order.get('cart', []))
                            if cart_length > 0:
                                item_price = order.get('total_value', 0) / cart_length
                        product_revenue += item_price
            
            products_sold_list.append({
                'product': product,
                'quantity': quantity,
                'revenue': round(product_revenue, 2),
                'video_source': 'Unknown Video',
                'image': ''
            })
        
        analytics_data = {
            'total_sales': total_sales,
            'total_revenue': round(total_revenue, 2),
            'avg_order_value': round(avg_order_value, 2),
            'products_sold_count': len(products_sold),
            'videos_with_sales_count': len(videos_with_sales),
            'sales_data': sales_data,
            'daily_sales': daily_sales,
            'products_sold': products_sold_list,
            'videos_with_sales': [
                {
                    'video_name': video_name,
                    'sales_count': video_data['sales_count'],
                    'revenue': round(video_data['revenue'], 2)
                }
                for video_name, video_data in videos_with_sales.items()
            ],
            'recent_sales': [
                {
                    'product': item.get('product', 'Unknown Product'),
                    'amount': round(order.get('total_value', 0), 2),
                    'net_amount': round(order.get('total_value', 0) * 0.7, 2),
                    'created_at': order.get('created_at', 'N/A')
                }
                for order in sorted(all_orders, key=lambda x: (
                    float(x.get('created_at', 0)) if isinstance(x.get('created_at'), (int, float)) 
                    else (x.get('created_at') if isinstance(x.get('created_at'), str) and x.get('created_at') != 'N/A' 
                          else '1970-01-01')
                ), reverse=True)[:10]
                for item in order.get('cart', [])
            ]
        }
        
        return jsonify(analytics_data)
        
    except Exception as e:
        logger.error(f"Error loading analytics: {str(e)}")
        return jsonify({"error": "Failed to load analytics"}), 500
