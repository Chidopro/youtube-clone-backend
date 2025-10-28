#!/usr/bin/env python3
"""
Fix existing orders in the orders table by calculating correct total_value from cart items.
This will update the orders table with proper revenue amounts.
"""

import os
import json
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTg1MjA1NSwiZXhwIjoyMDY1NDI4MDU1fQ.lF-SglNH91xhXlTU1Inl8OSX2DeW19P12P-pFZAlRIA"

# Product prices (from your PRODUCTS array)
PRODUCT_PRICES = {
    "Unisex Heavy Blend Hoodie": 45.99,
    "Cropped Hoodie": 42.99,
    "Youth Heavy Blend Hoodie": 35.99,
    "Unisex Heavy Blend T-Shirt": 25.99,
    "Men's Heavy Blend T-Shirt": 25.99,
    "Women's Heavy Blend T-Shirt": 25.99
}

def fix_orders_revenue():
    """Fix existing orders by calculating correct total_value from cart items"""
    
    print("🔧 Fixing orders revenue in orders table")
    print("=" * 50)
    
    try:
        # Initialize Supabase client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Connected to Supabase")
        
        # Get all orders with total_value = 0
        result = supabase.table('orders').select('*').eq('total_value', 0).execute()
        
        if not result.data:
            print("✅ No orders with total_value=0 found")
            return True
            
        print(f"📊 Found {len(result.data)} orders with total_value=0")
        
        # Fix each order
        fixed_count = 0
        for order in result.data:
            order_id = order.get('order_id')
            cart = order.get('cart', [])
            
            if not cart:
                print(f"⚠️  Order {order_id} has no cart items")
                continue
            
            # Calculate total value from cart items
            total_value = 0
            for item in cart:
                # Try to get price from item first
                item_price = item.get('price', 0)
                
                # If no price, look up in PRODUCT_PRICES
                if not item_price or item_price <= 0:
                    product_name = item.get('product', '')
                    item_price = PRODUCT_PRICES.get(product_name, 0)
                
                total_value += item_price
            
            if total_value > 0:
                # Update the order with correct total_value
                update_result = supabase.table('orders').update({
                    'total_value': total_value
                }).eq('order_id', order_id).execute()
                
                if update_result.data:
                    print(f"✅ Fixed order {order_id}: ${total_value:.2f}")
                    fixed_count += 1
                else:
                    print(f"❌ Failed to update order {order_id}")
            else:
                print(f"⚠️  Could not calculate price for order {order_id}")
        
        print(f"\n🎉 Fixed {fixed_count} orders!")
        
        # Test analytics after fix
        print("\n📊 Testing analytics after fix...")
        import requests
        response = requests.get("https://screenmerch.fly.dev/api/analytics")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ New analytics data:")
            print(f"   - Total Sales: {data.get('total_sales', 0)}")
            print(f"   - Total Revenue: ${data.get('total_revenue', 0):.2f}")
            print(f"   - Products Sold: {len(data.get('products_sold', []))}")
            print(f"   - Videos with Sales: {len(data.get('videos_with_sales', []))}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error fixing orders: {str(e)}")
        return False

if __name__ == "__main__":
    fix_orders_revenue()
