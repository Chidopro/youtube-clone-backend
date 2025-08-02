#!/usr/bin/env python3
"""
Test the fixed merchandise page
"""

import requests

def test_fixed_page():
    try:
        print("🔧 Testing the fixed merchandise page...")
        
        # Create a new product to test with
        test_data = {
            "thumbnail": "https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=Fixed+Test",
            "videoUrl": "https://example.com/test-video",
            "screenshots": [
                "https://via.placeholder.com/300x200/2196F3/FFFFFF?text=Screenshot+1",
                "https://via.placeholder.com/300x200/FF9800/FFFFFF?text=Screenshot+2",
                "https://via.placeholder.com/300x200/9C27B0/FFFFFF?text=Screenshot+3",
                "https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=Screenshot+4",
                "https://via.placeholder.com/300x200/FF5722/FFFFFF?text=Screenshot+5"
            ]
        }
        
        # Create product
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
                print(f"✅ Test product created: {product_url}")
                
                # Test the page
                page_response = requests.get(product_url, timeout=10)
                
                if page_response.status_code == 200:
                    content = page_response.text
                    
                    print(f"📄 Page loaded successfully (Content length: {len(content)})")
                    
                    # Check for JavaScript issues
                    if "resolutionNotice" in content:
                        print("❌ Still found resolutionNotice - JavaScript error not fixed")
                        return False
                    else:
                        print("✅ No resolutionNotice found - JavaScript error fixed!")
                    
                    # Check for key elements
                    checks = [
                        ("Available Products", "Available Products section"),
                        ("Screenshots Selected", "Screenshots Selected section"),
                        ("Products Selected", "Products Selected section"),
                        ("console.log", "Debug logging"),
                        ("🚀 Initializing", "Initialization message"),
                        ("DOMContentLoaded", "DOM ready event")
                    ]
                    
                    print("\n🔍 Checking page elements:")
                    for check, description in checks:
                        if check in content:
                            print(f"✅ {description}: Found")
                        else:
                            print(f"❌ {description}: Missing")
                    
                    # Check for screenshots and products
                    if "screenshot-thumbnail" in content:
                        print("✅ Screenshot thumbnails: Found")
                    else:
                        print("❌ Screenshot thumbnails: Missing")
                    
                    if "product-card" in content:
                        print("✅ Product cards: Found")
                    else:
                        print("❌ Product cards: Missing")
                    
                    print(f"\n🎯 Test URL: {product_url}")
                    print("📱 Try this URL in your browser - it should now work without going blank!")
                    
                    return True
                else:
                    print(f"❌ Page failed to load: {page_response.status_code}")
                    return False
            else:
                print(f"❌ Product creation failed: {data.get('error')}")
                return False
        else:
            print(f"❌ Request failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    test_fixed_page() 