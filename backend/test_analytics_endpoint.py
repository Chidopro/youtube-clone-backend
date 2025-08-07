#!/usr/bin/env python3
"""
Test the analytics endpoint directly to debug the issue.
"""

import requests
import json

def test_analytics_endpoint():
    """Test the analytics endpoint"""
    
    print("🚀 Testing analytics endpoint...")
    
    # Test the analytics endpoint
    try:
        # Test without filters (all sales)
        print("\n📊 Testing analytics endpoint without filters:")
        response = requests.get("https://backend-hidden-firefly-7865.fly.dev/api/analytics")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Analytics endpoint response:")
            print(f"  - Total sales: {data.get('total_sales', 0)}")
            print(f"  - Total revenue: ${data.get('total_revenue', 0):.2f}")
            print(f"  - Avg order value: ${data.get('avg_order_value', 0):.2f}")
            print(f"  - Products sold count: {data.get('products_sold_count', 0)}")
            print(f"  - Videos with sales count: {data.get('videos_with_sales_count', 0)}")
            
            # Check products sold
            products_sold = data.get('products_sold', [])
            print(f"\n📦 Products sold:")
            for product in products_sold:
                print(f"  - {product.get('product')}: {product.get('quantity')} units, ${product.get('revenue', 0):.2f}")
            
            # Check videos with sales
            videos_with_sales = data.get('videos_with_sales', [])
            print(f"\n🎥 Videos with sales:")
            for video in videos_with_sales:
                print(f"  - {video.get('video_name')}: {video.get('sales_count')} sales, ${video.get('revenue', 0):.2f}")
            
        else:
            print(f"❌ Analytics endpoint failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing analytics endpoint: {str(e)}")
        return False
    
    # Test with channel filter
    try:
        print("\n📊 Testing analytics endpoint with channel filter:")
        response = requests.get("https://backend-hidden-firefly-7865.fly.dev/api/analytics?channel_id=cheedo_v")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Analytics endpoint response (with channel filter):")
            print(f"  - Total sales: {data.get('total_sales', 0)}")
            print(f"  - Total revenue: ${data.get('total_revenue', 0):.2f}")
            print(f"  - Avg order value: ${data.get('avg_order_value', 0):.2f}")
        else:
            print(f"❌ Analytics endpoint with filter failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing analytics endpoint with filter: {str(e)}")
        return False
    
    return True

if __name__ == "__main__":
    print("🚀 Testing analytics endpoint...")
    success = test_analytics_endpoint()
    
    if success:
        print("\n🎉 Analytics endpoint test completed!")
        print("📊 Check the output above to see if your $25.00 sale is included.")
    else:
        print("\n💥 Analytics endpoint test failed!")
        exit(1) 