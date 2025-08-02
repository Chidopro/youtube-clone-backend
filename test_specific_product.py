#!/usr/bin/env python3
"""
Test the specific product that's showing blank
"""

import requests
import json

def test_specific_product():
    try:
        print("Testing the specific product that's showing blank...")
        
        # Test the product ID from the blank page
        product_id = "0c0071a3-d426-4f36-a79e-3386ae020ac5"
        
        # First, try to create a new product with this ID
        test_data = {
            "thumbnail": "https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=Test+Thumbnail",
            "videoUrl": "https://example.com/test-video",
            "screenshots": [
                "https://via.placeholder.com/300x200/2196F3/FFFFFF?text=Screenshot+1",
                "https://via.placeholder.com/300x200/FF9800/FFFFFF?text=Screenshot+2",
                "https://via.placeholder.com/300x200/9C27B0/FFFFFF?text=Screenshot+3"
            ]
        }
        
        print("Creating a new product...")
        response = requests.post(
            "https://backend-hidden-firefly-7865.fly.dev/api/create-product",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                new_product_url = data.get("product_url")
                print(f"✅ New product created: {new_product_url}")
                
                # Now test the new product page
                print("\nTesting the new product page...")
                page_response = requests.get(new_product_url, timeout=10)
                
                if page_response.status_code == 200:
                    content = page_response.text
                    
                    # Check for key elements
                    checks = [
                        ("Available Products", "Available Products section"),
                        ("Screenshots Selected", "Screenshots Selected section"),
                        ("Products Selected", "Products Selected section"),
                        ("console.log", "Debug logging"),
                        ("🚀 Initializing", "Initialization message")
                    ]
                    
                    print("\nChecking new product page:")
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
                    
                    return new_product_url
                else:
                    print(f"❌ New product page failed: {page_response.status_code}")
                    return None
            else:
                print(f"❌ Product creation failed: {data.get('error')}")
                return None
        else:
            print(f"❌ Product creation request failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    test_specific_product() 