#!/usr/bin/env python3
"""
Create a working product page for testing
"""

import requests
import json

def create_working_product():
    try:
        print("Creating a working product page...")
        
        # Create test data with actual screenshots
        test_data = {
            "thumbnail": "https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=Video+Thumbnail",
            "videoUrl": "https://example.com/test-video",
            "screenshots": [
                "https://via.placeholder.com/300x200/2196F3/FFFFFF?text=Screenshot+1",
                "https://via.placeholder.com/300x200/FF9800/FFFFFF?text=Screenshot+2", 
                "https://via.placeholder.com/300x200/9C27B0/FFFFFF?text=Screenshot+3",
                "https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=Screenshot+4",
                "https://via.placeholder.com/300x200/FF5722/FFFFFF?text=Screenshot+5"
            ]
        }
        
        response = requests.post(
            "https://backend-hidden-firefly-7865.fly.dev/api/create-product",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                product_url = data.get("product_url")
                print(f"✅ Working product created!")
                print(f"📝 URL: {product_url}")
                print(f"🎯 Product ID: {data.get('product_id')}")
                print(f"\n🔗 Test this URL in your browser:")
                print(f"   {product_url}")
                print(f"\n📸 This product has:")
                print(f"   - 1 video thumbnail")
                print(f"   - 5 screenshots")
                print(f"   - All product options")
                return product_url
            else:
                print(f"❌ Product creation failed: {data.get('error')}")
                return None
        else:
            print(f"❌ Request failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    create_working_product() 