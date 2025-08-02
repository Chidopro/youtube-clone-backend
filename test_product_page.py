#!/usr/bin/env python3
"""
Test product page content
"""

import requests

def test_product_page():
    try:
        print("Testing product page...")
        
        # Use the product URL from the previous test
        product_url = "https://backend-hidden-firefly-7865.fly.dev/product/64361df7-4037-4778-ab0e-4ed655f0f0b1"
        
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
                ("Soft Tee", "Product names")
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
            
            return True
        else:
            print(f"❌ Request failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    test_product_page() 