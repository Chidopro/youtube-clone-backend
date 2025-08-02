#!/usr/bin/env python3
"""
Create a fresh product with the current working system
"""
import requests
import json

def create_fresh_product():
    print("🆕 Creating a fresh product with current system...")
    
    # Create a test product with screenshots
    product_data = {
        "thumbnail": "https://backend-hidden-firefly-7865.fly.dev/static/images/alloverpajamatop.png",
        "videoUrl": "https://example.com/test-video.mp4",
        "screenshots": [
            "https://backend-hidden-firefly-7865.fly.dev/static/images/alloverpajamatop.png",
            "https://backend-hidden-firefly-7865.fly.dev/static/images/alloverpajamatoppreview.png",
            "https://backend-hidden-firefly-7865.fly.dev/static/images/allovertotebag.png",
            "https://backend-hidden-firefly-7865.fly.dev/static/images/alloverpajamatop.png",
            "https://backend-hidden-firefly-7865.fly.dev/static/images/alloverpajamatoppreview.png"
        ]
    }
    
    try:
        # Create product
        print("📦 Creating fresh product...")
        response = requests.post(
            "https://backend-hidden-firefly-7865.fly.dev/api/create-product",
            json=product_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            product_id = result.get("product_id")
            product_url = result.get("product_url")
            
            print(f"✅ Fresh product created successfully!")
            print(f"   Product ID: {product_id}")
            print(f"   Product URL: {product_url}")
            print(f"\n🎯 TEST THIS URL: {product_url}")
            print(f"   This should show the merchandise page with screenshots and products!")
            
            return product_url
        else:
            print(f"❌ Failed to create product: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error creating fresh product: {e}")
        return None

if __name__ == "__main__":
    create_fresh_product() 