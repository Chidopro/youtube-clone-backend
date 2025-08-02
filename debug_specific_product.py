#!/usr/bin/env python3
"""
Debug the specific product that's showing blank
"""
import requests

def debug_product(product_id):
    print(f"🔍 Debugging product: {product_id}")
    
    # Test the specific product page
    url = f"https://backend-hidden-firefly-7865.fly.dev/product/{product_id}"
    print(f"📄 Testing URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            content = response.text
            
            # Check for key elements
            checks = {
                "Debug fallback": "🚨 DEBUG: Page is loading!" in content,
                "JavaScript initialization": "🚀 Initializing merchandise page..." in content,
                "Screenshot handling": "screenshot-preview-row" in content,
                "Product handling": "product-row" in content,
                "No resolutionNotice errors": "resolutionNotice" not in content,
                "Proper HTML structure": "<!DOCTYPE html>" in content,
                "Has img_url": "{{ img_url }}" in content,
                "Has screenshots": "{% if screenshots %}" in content,
                "Has products": "{% if products %}" in content
            }
            
            print("\n📊 Page Analysis Results:")
            for check, result in checks.items():
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"   {status} {check}")
            
            # Check if this product exists in database
            print(f"\n🔍 Checking if product exists in database...")
            db_response = requests.get(f"https://backend-hidden-firefly-7865.fly.dev/api/ping")
            print(f"   Backend ping: {db_response.status_code}")
            
            # Look for specific data in the content
            if "{{ img_url }}" in content:
                print("   ⚠️ Template variables not replaced - product data missing")
            else:
                print("   ✅ Template variables replaced - product data present")
                
        else:
            print(f"❌ Failed to load page: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    # Test the product ID from the image
    debug_product("7b4e1f1d-0ef2-4802-9810-507207999d41") 