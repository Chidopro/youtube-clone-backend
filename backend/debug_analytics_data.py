#!/usr/bin/env python3
"""
Debug analytics data to see what's actually in the orders table.
"""

import os
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTg1MjA1NSwiZXhwIjoyMDY1NDI4MDU1fQ.lF-SglNH91xhXlTU1Inl8OSX2DeW19P12P-pFZAlRIA"

def debug_analytics_data():
    """Debug what's actually in the orders table"""
    
    print("🔍 Debugging Analytics Data")
    print("=" * 50)
    
    try:
        # Initialize Supabase client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Connected to Supabase")
        
        # Get all orders
        result = supabase.table('orders').select('*').execute()
        
        print(f"📊 Found {len(result.data)} orders")
        
        total_revenue = 0
        valid_orders = 0
        
        for i, order in enumerate(result.data[:5]):  # Show first 5 orders
            print(f"\n📦 Order {i+1}:")
            print(f"   - ID: {order.get('id')}")
            print(f"   - Order ID: {order.get('order_id')}")
            print(f"   - Total Amount: ${order.get('total_amount', 0):.2f}")
            print(f"   - Status: {order.get('status')}")
            print(f"   - Created: {order.get('created_at')}")
            
            if order.get('total_amount', 0) > 0:
                total_revenue += order.get('total_amount', 0)
                valid_orders += 1
        
        print(f"\n💰 Summary:")
        print(f"   - Valid orders (amount > 0): {valid_orders}")
        print(f"   - Total revenue: ${total_revenue:.2f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    debug_analytics_data()
