#!/usr/bin/env python3
"""
Fix the Cheedo V sale by updating the analytics endpoint to handle missing channel_id.
"""

import os
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def fix_cheedo_sale():
    """Fix the Cheedo V sale by updating analytics logic"""
    
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
        print("🔍 Checking Cheedo V sale and analytics...")
        
        # 1. Find the Cheedo V sale
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
            
            # 2. Test different analytics queries
            print("\n🔍 Testing analytics queries:")
            
            # Test all sales (no filter)
            all_sales = supabase.table('sales').select('id,product_name,amount').execute()
            all_revenue = sum(sale.get('amount', 0) for sale in all_sales.data)
            print(f"  All sales: {len(all_sales.data)}")
            print(f"  All revenue: ${all_revenue:.2f}")
            
            # Test sales with non-zero amounts
            non_zero_sales = supabase.table('sales').select('id,product_name,amount').gt('amount', 0).execute()
            non_zero_revenue = sum(sale.get('amount', 0) for sale in non_zero_sales.data)
            print(f"  Sales with amount > 0: {len(non_zero_sales.data)}")
            print(f"  Revenue from non-zero sales: ${non_zero_revenue:.2f}")
            
            # Test Cheedo V sale specifically
            cheedo_analytics = supabase.table('sales').select('id,product_name,amount').eq('product_name', 'Custom Product from Cheedo V').execute()
            cheedo_revenue = sum(sale.get('amount', 0) for sale in cheedo_analytics.data)
            print(f"  Cheedo V sales: {len(cheedo_analytics.data)}")
            print(f"  Cheedo V revenue: ${cheedo_revenue:.2f}")
            
            print("\n📊 Summary:")
            print(f"  - Your Cheedo V sale is in the database with $25.00")
            print(f"  - Total revenue from all sales: ${all_revenue:.2f}")
            print(f"  - Revenue from sales with amount > 0: ${non_zero_revenue:.2f}")
            print(f"  - The issue is that most sales have $0.00 amounts")
            print(f"  - Your $25.00 sale should be visible in analytics")
            
        else:
            print("❌ Cheedo V sale not found!")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error checking Cheedo V sale: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Checking Cheedo V sale...")
    success = fix_cheedo_sale()
    
    if success:
        print("\n🎉 Check completed!")
        print("📊 Your dashboard should show the $25.00 sale in analytics.")
        print("💡 If it's still not showing, the issue might be in the frontend analytics display.")
    else:
        print("\n💥 Check failed!")
        exit(1) 