#!/usr/bin/env python3
"""
Test the updated product page
"""

import requests

def test_new_product_page():
    try:
        print("Testing updated product page...")
        
        # Use the new product URL
        product_url = "https://backend-hidden-firefly-7865.fly.dev/product/1b61ec9a-7113-4d2f-b177-1ee155d0399f"
        
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
                ("🚀 Initializing", "Initialization message")
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
            
            return True
        else:
            print(f"❌ Request failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    test_new_product_page() 