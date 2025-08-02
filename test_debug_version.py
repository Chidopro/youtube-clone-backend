#!/usr/bin/env python3
"""
Test the debug version of the merchandise page
"""

import requests

def test_debug_version():
    try:
        print("🔧 Testing debug version...")
        
        # Create a new product to test with
        test_data = {
            "thumbnail": "https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=Debug+Test",
            "videoUrl": "https://example.com/test-video",
            "screenshots": [
                "https://via.placeholder.com/300x200/2196F3/FFFFFF?text=Screenshot+1",
                "https://via.placeholder.com/300x200/FF9800/FFFFFF?text=Screenshot+2",
                "https://via.placeholder.com/300x200/9C27B0/FFFFFF?text=Screenshot+3"
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
                print(f"✅ Debug test product created: {product_url}")
                
                # Test the page
                page_response = requests.get(product_url, timeout=10)
                
                if page_response.status_code == 200:
                    content = page_response.text
                    
                    print(f"📄 Page loaded successfully (Content length: {len(content)})")
                    
                    # Check for debug element
                    if "debug-fallback" in content:
                        print("✅ Debug fallback element: Found")
                    else:
                        print("❌ Debug fallback element: Missing")
                    
                    if "🚨 DEBUG: Page is loading!" in content:
                        print("✅ Debug message: Found")
                    else:
                        print("❌ Debug message: Missing")
                    
                    # Check for main container with debug styles
                    if "display: flex !important" in content:
                        print("✅ Debug CSS: Found")
                    else:
                        print("❌ Debug CSS: Missing")
                    
                    print(f"\n🎯 Debug Test URL: {product_url}")
                    print("📱 Try this URL in your browser - you should see a red debug box!")
                    
                    return product_url
                else:
                    print(f"❌ Page failed to load: {page_response.status_code}")
                    return None
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
    test_debug_version() 