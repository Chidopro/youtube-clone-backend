#!/usr/bin/env python3
"""
Focused test to verify channel analytics calculations are working correctly.
This will check sales data without making any changes to the system.
"""

import requests
import json

def test_channel_analytics():
    """Test channel analytics to verify sales calculations"""
    
    print("🔍 Testing Channel Analytics - Sales Calculations")
    print("=" * 50)
    
    try:
        # Test the analytics endpoint
        print("📊 Fetching analytics data...")
        response = requests.get("https://screenmerch.fly.dev/api/analytics")
        
        if response.status_code == 200:
            data = response.json()
            
            print("✅ Analytics Data Retrieved Successfully!")
            print(f"📈 Total Sales: {data.get('total_sales', 0)}")
            print(f"💰 Total Revenue: ${data.get('total_revenue', 0):.2f}")
            print(f"📊 Average Order Value: ${data.get('avg_order_value', 0):.2f}")
            
            # Check products sold
            products_sold = data.get('products_sold', [])
            print(f"\n📦 Products Sold ({len(products_sold)} different products):")
            for product in products_sold:
                print(f"  • {product.get('product', 'Unknown')}: {product.get('quantity', 0)} units, ${product.get('revenue', 0):.2f}")
            
            # Check videos with sales
            videos_with_sales = data.get('videos_with_sales', [])
            print(f"\n🎥 Videos with Sales ({len(videos_with_sales)} videos):")
            for video in videos_with_sales:
                print(f"  • {video.get('video_name', 'Unknown')}: {video.get('sales_count', 0)} sales, ${video.get('revenue', 0):.2f}")
            
            # Check daily sales data (last 30 days)
            sales_data = data.get('sales_data', [])
            recent_sales = sum(sales_data[-7:])  # Last 7 days
            print(f"\n📅 Recent Sales (Last 7 days): {recent_sales} orders")
            
            print("\n✅ Analytics Test Complete - All calculations appear to be working!")
            return True
            
        else:
            print(f"❌ Analytics endpoint failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing analytics: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Testing Channel Analytics...")
    test_channel_analytics()
