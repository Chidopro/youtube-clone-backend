#!/usr/bin/env python3
"""
Simple test to check database query.
"""

import os
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def test_simple_query():
    """Test a simple database query"""
    
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
        print("🔍 Testing simple database query...")
        
        # Test 1: Just get the count
        print("\n📊 Test 1: Get count only")
        count_result = supabase.table('sales').select('id', count='exact').execute()
        print(f"✅ Total sales count: {count_result.count}")
        
        # Test 2: Get just 1 record
        print("\n📊 Test 2: Get 1 record")
        single_result = supabase.table('sales').select('id,product_name,amount').limit(1).execute()
        print(f"✅ Found {len(single_result.data)} record(s)")
        
        if single_result.data:
            sale = single_result.data[0]
            print(f"  - {sale.get('product_name')} - ${sale.get('amount', 0):.2f}")
        
        # Test 3: Get records with non-zero amounts (limit 5)
        print("\n📊 Test 3: Get non-zero amounts (limit 5)")
        non_zero_result = supabase.table('sales').select('id,product_name,amount').gt('amount', 0).limit(5).execute()
        print(f"✅ Found {len(non_zero_result.data)} sales with non-zero amounts")
        
        for sale in non_zero_result.data:
            print(f"  - {sale.get('product_name')} - ${sale.get('amount', 0):.2f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error in simple query: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Testing simple database query...")
    success = test_simple_query()
    
    if success:
        print("\n🎉 Simple query test completed!")
    else:
        print("\n💥 Simple query test failed!")
        exit(1) 