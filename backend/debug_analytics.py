#!/usr/bin/env python3
"""
Debug script to check analytics and channel filtering issues.
"""

import os
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def debug_analytics():
    """Debug analytics and channel filtering"""
    
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
        print("🔍 Debugging analytics and channel filtering...")
        
        # 1. Check all sales records
        print("\n📊 All sales records:")
        all_sales = supabase.table('sales').select('*').execute()
        print(f"Total sales in database: {len(all_sales.data)}")
        
        for i, sale in enumerate(all_sales.data, 1):
            print(f"  {i}. {sale.get('product_name', 'Unknown')} - ${sale.get('amount', 0):.2f} - Channel: {sale.get('channel_id', 'None')}")
        
        # 2. Check sales with channel_id
        print("\n📊 Sales with channel_id:")
        channel_sales = supabase.table('sales').select('*').not_.is_('channel_id', 'null').execute()
        print(f"Sales with channel_id: {len(channel_sales.data)}")
        
        for sale in channel_sales.data:
            print(f"  - {sale.get('product_name')} - ${sale.get('amount', 0):.2f} - Channel: {sale.get('channel_id')}")
        
        # 3. Check sales for Cheedo V specifically
        print("\n📊 Sales for Cheedo V channel:")
        cheedo_sales = supabase.table('sales').select('*').eq('channel_id', 'cheedo_v').execute()
        print(f"Cheedo V sales: {len(cheedo_sales.data)}")
        
        for sale in cheedo_sales.data:
            print(f"  - {sale.get('product_name')} - ${sale.get('amount', 0):.2f}")
        
        # 4. Test analytics endpoint filtering
        print("\n🔍 Testing analytics endpoint filtering:")
        
        # Test without filters (all sales)
        print("  All sales (no filter):")
        all_analytics = supabase.table('sales').select('id,product_name,amount,channel_id').execute()
        total_revenue = sum(sale.get('amount', 0) for sale in all_analytics.data)
        print(f"    Total sales: {len(all_analytics.data)}")
        print(f"    Total revenue: ${total_revenue:.2f}")
        
        # Test with channel filter
        print("  Cheedo V sales (channel filter):")
        cheedo_analytics = supabase.table('sales').select('id,product_name,amount,channel_id').eq('channel_id', 'cheedo_v').execute()
        cheedo_revenue = sum(sale.get('amount', 0) for sale in cheedo_analytics.data)
        print(f"    Cheedo V sales: {len(cheedo_analytics.data)}")
        print(f"    Cheedo V revenue: ${cheedo_revenue:.2f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error debugging analytics: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Debugging analytics...")
    success = debug_analytics()
    
    if success:
        print("\n🎉 Debug completed!")
    else:
        print("\n💥 Debug failed!")
        exit(1) 