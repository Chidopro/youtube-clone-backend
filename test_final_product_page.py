#!/usr/bin/env python3
"""
Test the final deployed product page
"""

import requests

def test_final_product_page():
    try:
        print("Testing final deployed product page...")
        
        # Use the new product URL from the latest test
        product_url = "https://backend-hidden-firefly-7865.fly.dev/product/7cf878d8-300a-4c94-aaf3-26fbb97c9efb"
        
        response = requests.get(product_url, timeout=10)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            content = response.text
            
            # Check for key elements
            checks = [
                ("Available Products", "Available Products section"),
                ("Screenshots Selected", "Screenshots Selected section"),
                ("Products Selected", "Products Selected section"),
                ("product-row", "Product grid container"),
                ("screenshot-thumbnails", "Screenshot thumbnails container"),
                ("guidontee.png", "Product images"),
                ("Soft Tee", "Product names"),
                ("console.log", "Debug logging"),
                ("🚀 Initializing", "Initialization message"),
                ("📸 Video thumbnail", "Video thumbnail logging"),
                ("🛍️ Products to display", "Product logging")
            ]
            
            print("\nChecking page content:")
            for check, description in checks:
                if check in content:
                    print(f"✅ {description}: Found")
                else:
                    print(f"❌ {description}: Missing")
            
            # Check for JavaScript errors
            if "resolutionNotice" in content:
                print("⚠️  Found resolutionNotice - potential JavaScript issue")
            else:
                print("✅ No resolutionNotice found - JavaScript should be clean")
            
            # Check for the new JavaScript improvements
            if "Clear existing content" in content:
                print("✅ Found content clearing logic")
            else:
                print("❌ Missing content clearing logic")
                
            if "screenshotCount" in content:
                print("✅ Found screenshot counting logic")
            else:
                print("❌ Missing screenshot counting logic")
            
            return True
        else:
            print(f"❌ Request failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    test_final_product_page() 