#!/usr/bin/env python3
"""
Check for sales with non-zero amounts.
"""

import os
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def check_nonzero_sales():
    """Check for sales with non-zero amounts"""
    
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
        print("🔍 Checking for sales with non-zero amounts...")
        
        # Get all sales with amounts > 0
        result = supabase.table('sales').select('id,product_name,amount,channel_id,user_id').gt('amount', 0).execute()
        
        print(f"✅ Found {len(result.data)} sales with non-zero amounts")
        
        if len(result.data) > 0:
            for i, sale in enumerate(result.data):
                print(f"  {i+1}. {sale.get('product_name')} - ${sale.get('amount', 0):.2f}")
                print(f"     Channel ID: {sale.get('channel_id')}")
                print(f"     User ID: {sale.get('user_id')}")
                print()
        else:
            print("❌ No sales found with non-zero amounts!")
            print("💡 This explains why analytics shows $0.00 revenue.")
        
        return True
        
    except Exception as e:
        print(f"❌ Error checking sales: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Checking non-zero sales...")
    success = check_nonzero_sales()
    
    if success:
        print("\n🎉 Check completed!")
    else:
        print("\n💥 Check failed!")
        exit(1) 