#!/usr/bin/env python3
"""
Simple test to debug analytics endpoint.
"""

import requests
import json

def test_analytics_simple():
    """Simple test of analytics endpoint"""
    
    print("🚀 Simple analytics test...")
    
    try:
        # Test the analytics endpoint
        print("📊 Testing analytics endpoint...")
        response = requests.get("https://backend-hidden-firefly-7865.fly.dev/api/analytics")
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Analytics endpoint response:")
            print(json.dumps(data, indent=2))
            
            # Check if there are any sales
            total_sales = data.get('total_sales', 0)
            total_revenue = data.get('total_revenue', 0)
            
            print(f"\n📊 Summary:")
            print(f"  - Total sales: {total_sales}")
            print(f"  - Total revenue: ${total_revenue}")
            
            if total_sales > 0:
                print("🎉 SUCCESS! Analytics is working!")
            else:
                print("⚠️  Analytics endpoint is working but showing 0 sales.")
                print("💡 This suggests the database query is not finding the sales.")
                
        else:
            print(f"❌ Analytics endpoint failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing analytics: {str(e)}")

if __name__ == "__main__":
    test_analytics_simple() 