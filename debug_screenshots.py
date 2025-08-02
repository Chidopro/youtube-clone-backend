#!/usr/bin/env python3
"""
Debug screenshots data for merchandise page
"""
import requests
import json

def debug_screenshots():
    # Test with the current product ID
    product_id = "aeb9b44d-080a-41e7-b46d-ba47d760c068"
    print(f"🔍 Debugging screenshots for product: {product_id}")
    
    # Test the merchandise page
    url = f"https://backend-hidden-firefly-7865.fly.dev/product/{product_id}"
    print(f"📄 Testing URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            content = response.text
            
            # Check for screenshots data in the HTML
            checks = {
                "Screenshots array": "screenshots.push(" in content,
                "Video thumbnail": "{{ img_url }}" in content,
                "Screenshot thumbnails container": "screenshot-thumbnails" in content,
                "Video thumbnail element": "video-thumbnail" in content,
                "Screenshot thumbnail elements": "screenshot-thumbnail" in content,
                "Row layout": "flex-direction: row" in content,
                "Grid layout": "grid-template-columns: repeat(2, 1fr)" in content
            }
            
            print("\n📊 Template Analysis Results:")
            for check, result in checks.items():
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"   {status} {check}")
            
            # Look for specific data patterns
            if "screenshots.push(" in content:
                print("\n🔍 Found screenshots.push() calls in template")
                # Count how many screenshots are being pushed
                screenshot_count = content.count("screenshots.push(")
                print(f"   📸 Number of screenshots.push() calls: {screenshot_count}")
            else:
                print("\n⚠️ No screenshots.push() calls found in template")
            
            # Check if template variables are replaced
            if "{{ img_url }}" in content:
                print("   ⚠️ img_url template variable not replaced")
            else:
                print("   ✅ img_url template variable replaced")
                
            # Look for the actual screenshot URLs in the content
            print(f"\n🔍 Looking for screenshot URLs in content...")
            if "https://" in content and "screenshot" in content.lower():
                print("   ✅ Found potential screenshot URLs")
            else:
                print("   ❌ No screenshot URLs found")
                
        else:
            print(f"❌ Failed to load page: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    debug_screenshots() 