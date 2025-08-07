#!/usr/bin/env python3
"""
Debug script to check the specific Cheedo V sale and analytics filtering.
"""

import os
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def debug_cheedo_sale():
    """Debug the specific Cheedo V sale and analytics"""
    
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
        print("🔍 Debugging Cheedo V sale and analytics...")
        
        # 1. Find the specific Cheedo V sale
        print("\n📊 Looking for Cheedo V sale:")
        cheedo_sale = supabase.table('sales').select('*').eq('product_name', 'Custom Product from Cheedo V').execute()
        
        if cheedo_sale.data:
            sale = cheedo_sale.data[0]
            print(f"✅ Found Cheedo V sale:")
            print(f"  - ID: {sale.get('id')}")
            print(f"  - Product: {sale.get('product_name')}")
            print(f"  - Amount: ${sale.get('amount', 0):.2f}")
            print(f"  - Channel ID: {sale.get('channel_id', 'None')}")
            print(f"  - User ID: {sale.get('user_id', 'None')}")
            print(f"  - Created At: {sale.get('created_at', 'None')}")
        else:
            print("❌ Cheedo V sale not found!")
            return False
        
        # 2. Check if the sale has channel_id
        if not sale.get('channel_id'):
            print("\n⚠️  The Cheedo V sale doesn't have a channel_id!")
            print("This is why it's not showing in channel-specific analytics.")
            
            # 3. Update the sale with channel_id
            print("\n🔧 Updating sale with channel_id...")
            update_result = supabase.table('sales').update({
                'channel_id': 'cheedo_v'
            }).eq('id', sale.get('id')).execute()
            
            if update_result.data:
                print("✅ Successfully updated sale with channel_id!")
            else:
                print("❌ Failed to update sale with channel_id!")
                return False
        else:
            print(f"\n✅ Sale already has channel_id: {sale.get('channel_id')}")
        
        # 4. Test analytics filtering
        print("\n🔍 Testing analytics filtering:")
        
        # Test Cheedo V specific analytics
        cheedo_analytics = supabase.table('sales').select('id,product_name,amount,channel_id').eq('channel_id', 'cheedo_v').execute()
        cheedo_revenue = sum(sale.get('amount', 0) for sale in cheedo_analytics.data)
        print(f"  Cheedo V sales: {len(cheedo_analytics.data)}")
        print(f"  Cheedo V revenue: ${cheedo_revenue:.2f}")
        
        # Test all sales with channel_id
        channel_sales = supabase.table('sales').select('id,product_name,amount,channel_id').not_.is_('channel_id', 'null').execute()
        channel_revenue = sum(sale.get('amount', 0) for sale in channel_sales.data)
        print(f"  All channel sales: {len(channel_sales.data)}")
        print(f"  All channel revenue: ${channel_revenue:.2f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error debugging Cheedo V sale: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Debugging Cheedo V sale...")
    success = debug_cheedo_sale()
    
    if success:
        print("\n🎉 Debug completed!")
        print("📊 Your dashboard should now show the Cheedo V sale in analytics.")
    else:
        print("\n💥 Debug failed!")
        exit(1) 