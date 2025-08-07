#!/usr/bin/env python3
"""
Fix the Cheedo V sale by adding channel_id as a string.
"""

import os
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def fix_cheedo_sale():
    """Fix the Cheedo V sale by adding channel_id as string"""
    
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
        print("🔍 Finding and fixing Cheedo V sale...")
        
        # 1. Find the Cheedo V sale
        print("\n📊 Looking for Cheedo V sale:")
        cheedo_sale = supabase.table('sales').select('*').eq('product_name', 'Custom Product from Cheedo V').execute()
        
        if cheedo_sale.data:
            sale = cheedo_sale.data[0]
            print(f"✅ Found Cheedo V sale:")
            print(f"  - ID: {sale.get('id')}")
            print(f"  - Product: {sale.get('product_name')}")
            print(f"  - Amount: ${sale.get('amount', 0):.2f}")
            print(f"  - Current Channel ID: {sale.get('channel_id', 'None')}")
            print(f"  - Current User ID: {sale.get('user_id', 'None')}")
            
            # 2. Update the sale with channel_id as string
            print(f"\n🔧 Updating sale with channel_id: 'cheedo_v'")
            print(f"🔧 Updating sale with user_id: 'cheedo_user'")
            
            update_data = {
                'channel_id': 'cheedo_v',
                'user_id': 'cheedo_user'
            }
            
            update_result = supabase.table('sales').update(update_data).eq('id', sale.get('id')).execute()
            
            if update_result.data:
                print("✅ Successfully updated sale with channel_id and user_id!")
                
                # 3. Test analytics filtering
                print("\n🔍 Testing analytics filtering:")
                
                # Test channel-specific analytics
                channel_analytics = supabase.table('sales').select('id,product_name,amount,channel_id').eq('channel_id', 'cheedo_v').execute()
                channel_revenue = sum(sale.get('amount', 0) for sale in channel_analytics.data)
                print(f"  Cheedo V sales: {len(channel_analytics.data)}")
                print(f"  Cheedo V revenue: ${channel_revenue:.2f}")
                
                # Test user-specific analytics
                user_analytics = supabase.table('sales').select('id,product_name,amount,user_id').eq('user_id', 'cheedo_user').execute()
                user_revenue = sum(sale.get('amount', 0) for sale in user_analytics.data)
                print(f"  Cheedo user sales: {len(user_analytics.data)}")
                print(f"  Cheedo user revenue: ${user_revenue:.2f}")
                
                # Test all sales with channel_id
                all_channel_sales = supabase.table('sales').select('id,product_name,amount,channel_id').not_.is_('channel_id', 'null').execute()
                all_channel_revenue = sum(sale.get('amount', 0) for sale in all_channel_sales.data)
                print(f"  All channel sales: {len(all_channel_sales.data)}")
                print(f"  All channel revenue: ${all_channel_revenue:.2f}")
                
            else:
                print("❌ Failed to update sale!")
                return False
        else:
            print("❌ Cheedo V sale not found!")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error fixing Cheedo V sale: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Fixing Cheedo V sale...")
    success = fix_cheedo_sale()
    
    if success:
        print("\n🎉 Fix completed!")
        print("📊 Your dashboard should now show the Cheedo V sale in analytics.")
    else:
        print("\n💥 Fix failed!")
        exit(1) 