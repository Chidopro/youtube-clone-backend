#!/usr/bin/env python3
"""
Simple script to test the analytics endpoint and verify sales are recorded.
"""

import os
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def test_analytics():
    """Test the analytics endpoint"""
    
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
        print("📊 Testing sales analytics...")
        
        # Get all sales records
        result = supabase.table('sales').select('id,product_name,amount').execute()
        
        if result.data:
            total_sales = len(result.data)
            total_revenue = sum(sale.get('amount', 0) for sale in result.data)
            
            print(f"✅ Analytics test successful!")
            print(f"📈 Total sales in database: {total_sales}")
            print(f"💰 Total revenue: ${total_revenue:.2f}")
            
            # Show individual sales
            print("\n📋 Sales records:")
            for i, sale in enumerate(result.data, 1):
                print(f"  {i}. {sale.get('product_name', 'Unknown')} - ${sale.get('amount', 0):.2f}")
            
            return True
        else:
            print("❌ No sales data found")
            return False
            
    except Exception as e:
        print(f"❌ Error testing analytics: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Testing analytics...")
    success = test_analytics()
    
    if success:
        print("\n🎉 Analytics test completed!")
        print("📊 Your dashboard should now show the correct sales data.")
    else:
        print("\n💥 Analytics test failed!")
        exit(1) 