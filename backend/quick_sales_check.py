#!/usr/bin/env python3
"""
Quick check to see if sales data still exists.
"""

import os
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def quick_sales_check():
    """Quick check for sales data"""
    
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
        print("🔍 Quick sales check...")
        
        # Just get a few sales to check if they exist
        result = supabase.table('sales').select('id,product_name,amount').limit(5).execute()
        
        print(f"✅ Found {len(result.data)} sales records")
        
        for i, sale in enumerate(result.data):
            print(f"  {i+1}. {sale.get('product_name')} - ${sale.get('amount', 0):.2f}")
        
        # Check total count
        count_result = supabase.table('sales').select('id', count='exact').execute()
        print(f"✅ Total sales in database: {count_result.count}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error checking sales: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Quick sales check...")
    success = quick_sales_check()
    
    if success:
        print("\n🎉 Sales check completed!")
    else:
        print("\n💥 Sales check failed!")
        exit(1) 