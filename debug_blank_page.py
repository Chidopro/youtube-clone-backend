#!/usr/bin/env python3
"""
Debug the blank page issue
"""

import requests
import json

def debug_blank_page():
    try:
        print("🔍 Debugging the blank page issue...")
        
        # Test the specific product that's showing blank
        product_url = "https://backend-hidden-firefly-7865.fly.dev/product/079586fa-bab2-4090-83ba-a78523ec60ba"
        
        response = requests.get(product_url, timeout=10)
        
        print(f"Status: {response.status_code}")
        print(f"Content length: {len(response.text)}")
        
        if response.status_code == 200:
            content = response.text
            
            # Check for JavaScript errors
            print("\n🔍 Checking for JavaScript issues:")
            
            # Look for specific error patterns
            error_patterns = [
                ("resolutionNotice", "Duplicate resolutionNotice declaration"),
                ("Uncaught SyntaxError", "JavaScript syntax error"),
                ("Uncaught ReferenceError", "JavaScript reference error"),
                ("Uncaught TypeError", "JavaScript type error"),
                ("console.error", "Console error found"),
                ("throw new Error", "Thrown error found"),
                ("document.getElementById", "DOM manipulation"),
                ("window.onload", "Window load event"),
                ("addEventListener", "Event listeners"),
                ("innerHTML", "InnerHTML manipulation")
            ]
            
            for pattern, description in error_patterns:
                count = content.count(pattern)
                if count > 0:
                    print(f"⚠️  {description}: {count} occurrences")
                else:
                    print(f"✅ {description}: Not found")
            
            # Check for specific problematic code
            print("\n🔍 Checking for problematic code:")
            
            # Look for the specific JavaScript that might be causing issues
            if "resolutionNotice" in content:
                print("❌ Found resolutionNotice - this is likely causing the blank page")
                
                # Find the context around resolutionNotice
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if "resolutionNotice" in line:
                        print(f"   Line {i+1}: {line.strip()}")
                        # Show surrounding lines
                        for j in range(max(0, i-2), min(len(lines), i+3)):
                            if j != i:
                                print(f"   Line {j+1}: {lines[j].strip()}")
                        break
            
            # Check if there are any script loading issues
            if "<script" in content:
                script_count = content.count("<script")
                print(f"📜 Found {script_count} script tags")
                
                # Check for script loading order issues
                if "DOMContentLoaded" in content:
                    print("✅ DOMContentLoaded event found")
                else:
                    print("⚠️  No DOMContentLoaded event found")
            
            # Check for CSS issues
            if "<style" in content:
                style_count = content.count("<style")
                print(f"🎨 Found {style_count} style tags")
            
            # Check for body content
            if "<body" in content:
                body_start = content.find("<body")
                body_end = content.find("</body>")
                if body_start != -1 and body_end != -1:
                    body_content = content[body_start:body_end]
                    if len(body_content) < 1000:
                        print("⚠️  Body content seems very short")
                        print(f"   Body content length: {len(body_content)}")
                    else:
                        print(f"✅ Body content length: {len(body_content)}")
            
            return True
        else:
            print(f"❌ Page failed to load: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    debug_blank_page() 