#!/usr/bin/env python3
"""
Add a test sale to verify analytics system works.
"""

import os
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def add_test_sale():
    """Add a test sale to verify analytics"""
    
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
        print("🚀 Adding test sale to verify analytics...")
        
        # Add a test sale
        test_sale_data = {
            'product_name': 'Test Product from Cheedo V',
            'amount': 30.00,
            'image_url': 'https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=Test+Product'
        }
        
        print(f"📊 Adding test sale: {test_sale_data['product_name']} - ${test_sale_data['amount']}")
        
        result = supabase.table('sales').insert(test_sale_data).execute()
        
        if result.data:
            sale = result.data[0]
            print(f"✅ Test sale added successfully!")
            print(f"  - ID: {sale.get('id')}")
            print(f"  - Product: {sale.get('product_name')}")
            print(f"  - Amount: ${sale.get('amount', 0):.2f}")
            
            # Test analytics endpoint
            print("\n🧪 Testing analytics endpoint...")
            import requests
            
            response = requests.get("https://backend-hidden-firefly-7865.fly.dev/api/analytics")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Analytics endpoint response:")
                print(f"  - Total sales: {data.get('total_sales', 0)}")
                print(f"  - Total revenue: ${data.get('total_revenue', 0):.2f}")
                
                if data.get('total_sales', 0) > 0:
                    print("🎉 Analytics is working! Your dashboard should now show sales.")
                else:
                    print("⚠️  Analytics endpoint still showing 0 sales - there's a backend issue.")
            else:
                print(f"❌ Analytics endpoint failed: {response.status_code}")
                
        else:
            print("❌ Failed to add test sale!")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error adding test sale: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Adding test sale...")
    success = add_test_sale()
    
    if success:
        print("\n🎉 Test sale added!")
        print("📊 Check your dashboard now - it should show the test sale.")
        print("💡 If it still shows 0, the issue is in the analytics endpoint.")
    else:
        print("\n💥 Failed to add test sale!")
        exit(1) 