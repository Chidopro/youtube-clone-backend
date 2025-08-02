#!/usr/bin/env python3
"""
Debug browser rendering issue
"""

import requests
import json

def debug_browser_issue():
    try:
        print("🔍 Debugging browser rendering issue...")
        
        # Test the specific URL that's showing blank
        product_url = "https://backend-hidden-firefly-7865.fly.dev/product/7ae41515-7ff5-48b7-a99d-4bdd440f15ec"
        
        response = requests.get(product_url, timeout=10)
        
        print(f"Status: {response.status_code}")
        print(f"Content length: {len(response.text)}")
        
        if response.status_code == 200:
            content = response.text
            
            # Check for critical issues
            print("\n🔍 Checking for critical issues:")
            
            # Check if HTML is complete
            if "<!DOCTYPE html>" in content and "</html>" in content:
                print("✅ HTML structure is complete")
            else:
                print("❌ HTML structure is incomplete")
                return False
            
            # Check for body content
            if "<body" in content and "</body>" in content:
                body_start = content.find("<body")
                body_end = content.find("</body>")
                body_content = content[body_start:body_end]
                print(f"✅ Body content found (length: {len(body_content)})")
                
                # Check if body has actual content
                if len(body_content) < 1000:
                    print("❌ Body content is too short")
                    print(f"Body content: {body_content[:500]}...")
                    return False
            else:
                print("❌ Body tags missing")
                return False
            
            # Check for JavaScript errors
            print("\n🔍 Checking JavaScript:")
            
            # Look for any remaining problematic code
            problematic_patterns = [
                ("resolutionNotice", "Resolution notice references"),
                ("Uncaught", "JavaScript errors"),
                ("SyntaxError", "Syntax errors"),
                ("ReferenceError", "Reference errors"),
                ("TypeError", "Type errors"),
                ("console.error", "Console errors")
            ]
            
            for pattern, description in problematic_patterns:
                if pattern in content:
                    print(f"⚠️  {description}: Found")
                else:
                    print(f"✅ {description}: Not found")
            
            # Check for script loading
            script_tags = content.count("<script")
            print(f"📜 Script tags found: {script_tags}")
            
            # Check for CSS
            style_tags = content.count("<style")
            print(f"🎨 Style tags found: {style_tags}")
            
            # Check for key elements that should be visible
            print("\n🔍 Checking key elements:")
            
            key_elements = [
                ("main-container", "Main container"),
                ("screenshots-selected", "Screenshots section"),
                ("products-section", "Products section"),
                ("user-flow-section", "User flow section"),
                ("DOMContentLoaded", "DOM ready event"),
                ("console.log", "Debug logging")
            ]
            
            for element, description in key_elements:
                if element in content:
                    print(f"✅ {description}: Found")
                else:
                    print(f"❌ {description}: Missing")
            
            # Check for actual content that should be visible
            print("\n🔍 Checking visible content:")
            
            visible_content = [
                ("Screenshots Selected", "Screenshots heading"),
                ("Available Products", "Products heading"),
                ("Products Selected", "Selected products heading"),
                ("Make Merchandise", "Page title"),
                ("Global Shipping", "Shipping info")
            ]
            
            for content_text, description in visible_content:
                if content_text in content:
                    print(f"✅ {description}: Found")
                else:
                    print(f"❌ {description}: Missing")
            
            # Check for image sources
            if "placeholder.com" in content:
                print("✅ Placeholder images: Found")
            else:
                print("❌ Placeholder images: Missing")
            
            # Check for product data
            if "product-card" in content:
                print("✅ Product cards: Found")
            else:
                print("❌ Product cards: Missing")
            
            print(f"\n🎯 URL being tested: {product_url}")
            print("💡 The page content seems to be there, but browser might have rendering issues")
            
            return True
        else:
            print(f"❌ Page failed to load: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    debug_browser_issue() 