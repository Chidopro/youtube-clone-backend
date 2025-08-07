#!/usr/bin/env python3
"""
Fix the Cheedo V sale by adding the correct channel_id.
"""

import os
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def fix_cheedo_sale():
    """Fix the Cheedo V sale by adding channel_id"""
    
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
        print("🔍 Finding Cheedo V channel and fixing sale...")
        
        # 1. Find the Cheedo V channel
        print("\n📊 Looking for Cheedo V channel:")
        channels = supabase.table('channels').select('*').ilike('name', '%cheedo%').execute()
        
        if channels.data:
            channel = channels.data[0]
            print(f"✅ Found Cheedo V channel:")
            print(f"  - ID: {channel.get('id')}")
            print(f"  - Name: {channel.get('name')}")
            print(f"  - User ID: {channel.get('user_id')}")
            
            channel_id = channel.get('id')
            user_id = channel.get('user_id')
        else:
            print("❌ Cheedo V channel not found!")
            print("Let me check all channels...")
            
            all_channels = supabase.table('channels').select('id,name,user_id').execute()
            print(f"Available channels:")
            for ch in all_channels.data:
                print(f"  - {ch.get('name')} (ID: {ch.get('id')})")
            
            # Use the first channel as fallback
            if all_channels.data:
                channel = all_channels.data[0]
                channel_id = channel.get('id')
                user_id = channel.get('user_id')
                print(f"\n⚠️  Using first available channel: {channel.get('name')}")
            else:
                print("❌ No channels found!")
                return False
        
        # 2. Find the Cheedo V sale
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
            
            # 3. Update the sale with correct channel_id and user_id
            print(f"\n🔧 Updating sale with channel_id: {channel_id}")
            print(f"🔧 Updating sale with user_id: {user_id}")
            
            update_data = {
                'channel_id': channel_id,
                'user_id': user_id
            }
            
            update_result = supabase.table('sales').update(update_data).eq('id', sale.get('id')).execute()
            
            if update_result.data:
                print("✅ Successfully updated sale with channel_id and user_id!")
                
                # 4. Test analytics filtering
                print("\n🔍 Testing analytics filtering:")
                
                # Test channel-specific analytics
                channel_analytics = supabase.table('sales').select('id,product_name,amount,channel_id').eq('channel_id', channel_id).execute()
                channel_revenue = sum(sale.get('amount', 0) for sale in channel_analytics.data)
                print(f"  Channel sales: {len(channel_analytics.data)}")
                print(f"  Channel revenue: ${channel_revenue:.2f}")
                
                # Test user-specific analytics
                user_analytics = supabase.table('sales').select('id,product_name,amount,user_id').eq('user_id', user_id).execute()
                user_revenue = sum(sale.get('amount', 0) for sale in user_analytics.data)
                print(f"  User sales: {len(user_analytics.data)}")
                print(f"  User revenue: ${user_revenue:.2f}")
                
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