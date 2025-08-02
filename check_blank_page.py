#!/usr/bin/env python3
"""
Check the blank product page
"""

import requests

def check_blank_page():
    try:
        print("Checking the blank product page...")
        
        # Use the URL from the image
        product_url = "https://backend-hidden-firefly-7865.fly.dev/product/0c0071a3-d426-4f36-a79e-3386ae020ac5"
        
        response = requests.get(product_url, timeout=10)
        
        print(f"Status: {response.status_code}")
        print(f"Content length: {len(response.text)}")
        
        if response.status_code == 200:
            content = response.text
            
            # Check if content is empty or very short
            if len(content) < 100:
                print("❌ Page content is too short - likely an error")
                print(f"Content: {content[:200]}")
                return False
            
            # Check for key elements
            checks = [
                ("<!DOCTYPE html>", "HTML doctype"),
                ("<html>", "HTML tag"),
                ("<head>", "Head section"),
                ("<body>", "Body section"),
                ("Available Products", "Available Products section"),
                ("Screenshots Selected", "Screenshots Selected section")
            ]
            
            print("\nChecking page structure:")
            for check, description in checks:
                if check in content:
                    print(f"✅ {description}: Found")
                else:
                    print(f"❌ {description}: Missing")
            
            # Check for error messages
            error_indicators = [
                "Internal Server Error",
                "500",
                "404",
                "Not Found",
                "Error",
                "Exception"
            ]
            
            print("\nChecking for errors:")
            for error in error_indicators:
                if error in content:
                    print(f"⚠️  Found error indicator: {error}")
            
            return True
        else:
            print(f"❌ Request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    check_blank_page() 