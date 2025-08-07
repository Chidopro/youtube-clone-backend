#!/usr/bin/env python3
"""
Final test script to verify analytics endpoint after deployment.
"""

import requests
import json
import time

def test_analytics_endpoint():
    """Test the analytics endpoint after deployment"""
    
    print("🚀 Testing analytics endpoint after deployment...")
    print("⏳ Waiting for deployment to complete...")
    
    # Wait a bit for deployment to complete
    time.sleep(10)
    
    try:
        # Test the analytics endpoint
        print("📊 Testing analytics endpoint...")
        response = requests.get("https://backend-hidden-firefly-7865.fly.dev/api/analytics")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Analytics endpoint response:")
            print(f"  - Total sales: {data.get('total_sales', 0)}")
            print(f"  - Total revenue: ${data.get('total_revenue', 0):.2f}")
            print(f"  - Products sold: {data.get('products_sold', 0)}")
            print(f"  - Videos with sales: {data.get('videos_with_sales', 0)}")
            print(f"  - Avg order value: ${data.get('avg_order_value', 0):.2f}")
            
            if data.get('total_sales', 0) > 0:
                print("🎉 SUCCESS! Analytics is working!")
                print("📊 Your dashboard should now show the sales data.")
                return True
            else:
                print("⚠️  Analytics endpoint is working but showing 0 sales.")
                print("💡 This might be because the sales don't have the right channel_id/user_id.")
                return False
        else:
            print(f"❌ Analytics endpoint failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing analytics: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Final analytics test...")
    success = test_analytics_endpoint()
    
    if success:
        print("\n🎉 Analytics test completed successfully!")
        print("📊 Check your dashboard now!")
    else:
        print("\n💥 Analytics test failed!")
        print("🔧 The issue might be with channel_id/user_id filtering.") 