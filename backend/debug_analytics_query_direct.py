#!/usr/bin/env python3
"""
Debug the exact database query used by the analytics endpoint.
"""

import os
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def debug_analytics_query():
    """Debug the exact analytics query"""
    
    # Use the service key directly
    supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTg1MjA1NSwiZXhwIjoyMDY1NDI4MDU1fQ.lF-SglNH91xhXlTU1Inl8OSX2DeW19P12P-pFZAlRIA"
    
    # Initialize Supabase client
    try:
        supabase: Client = create_client(SUPABASE_URL, supabase_key)
        print(f"✅ Connected to Supabase: {SUPABASE_URL}")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {str(e)}")
        return False
    
    try:
        print("🔍 Testing the exact analytics query...")
        
        # Test 1: Get all sales (no filters) - EXACT same query as analytics endpoint
        print("\n📊 Test 1: Get all sales (no filters)")
        query = supabase.table('sales').select('id,product_name,amount,image_url,user_id,channel_id')
        sales_result = query.execute()
        
        print(f"✅ Found {len(sales_result.data)} sales records")
        
        # Show first 5 sales
        for i, sale in enumerate(sales_result.data[:5]):
            print(f"  {i+1}. {sale.get('product_name')} - ${sale.get('amount', 0):.2f}")
        
        # Test 2: Calculate totals (same as analytics endpoint)
        print("\n📊 Test 2: Calculate totals")
        total_sales = len(sales_result.data)
        total_revenue = sum(sale.get('amount', 0) for sale in sales_result.data)
        
        print(f"✅ Total sales: {total_sales}")
        print(f"✅ Total revenue: ${total_revenue:.2f}")
        
        # Test 3: Check for non-zero amounts
        non_zero_sales = [sale for sale in sales_result.data if sale.get('amount', 0) > 0]
        print(f"✅ Sales with non-zero amounts: {len(non_zero_sales)}")
        
        for sale in non_zero_sales:
            print(f"  - {sale.get('product_name')}: ${sale.get('amount', 0):.2f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error in analytics query: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Debugging analytics query...")
    success = debug_analytics_query()
    
    if success:
        print("\n🎉 Analytics query debug completed!")
    else:
        print("\n💥 Analytics query debug failed!")
        exit(1) 