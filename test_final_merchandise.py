#!/usr/bin/env python3
"""
Test the final merchandise page with proper JavaScript
"""
import requests
import json

def test_merchandise_page():
    print("🧪 Testing final merchandise page...")
    
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
        print("📦 Creating test product...")
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
            
            print(f"✅ Product created successfully!")
            print(f"   Product ID: {product_id}")
            print(f"   Product URL: {product_url}")
            
            # Test the product page
            print("\n🔍 Testing product page...")
            page_response = requests.get(product_url, timeout=10)
            
            if page_response.status_code == 200:
                content = page_response.text
                
                # Check for key elements
                checks = {
                    "Debug fallback": "🚨 DEBUG: Page is loading!" in content,
                    "JavaScript initialization": "🚀 Initializing merchandise page..." in content,
                    "Screenshot handling": "screenshot-preview-row" in content,
                    "Product handling": "product-row" in content,
                    "No resolutionNotice errors": "resolutionNotice" not in content,
                    "Proper HTML structure": "<!DOCTYPE html>" in content
                }
                
                print("\n📊 Page Analysis Results:")
                for check, result in checks.items():
                    status = "✅ PASS" if result else "❌ FAIL"
                    print(f"   {status} {check}")
                
                if all(checks.values()):
                    print(f"\n🎉 SUCCESS! Merchandise page is working correctly!")
                    print(f"🌐 Visit: {product_url}")
                    return True
                else:
                    print(f"\n⚠️ Some checks failed. Page may have issues.")
                    return False
            else:
                print(f"❌ Failed to load product page: {page_response.status_code}")
                return False
        else:
            print(f"❌ Failed to create product: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing merchandise page: {e}")
        return False

if __name__ == "__main__":
    test_merchandise_page() 