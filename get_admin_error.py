#!/usr/bin/env python3
"""
Get admin login error message
"""
import requests
import json

def get_admin_error():
    print("🔍 Getting admin login error message...")
    
    session = requests.Session()
    
    try:
        # Submit the form and get the full response
        login_data = {
            'email': 'chidopro@proton.me',
            'password': 'VieG369Bbk8!'
        }
        
        response = session.post('https://copy5-backend.fly.dev/admin/login', 
                              data=login_data)
        
        print(f"Status: {response.status_code}")
        print(f"Response length: {len(response.text)}")
        
        # Look for error messages in the HTML
        response_text = response.text
        
        # Find error messages
        if "error" in response_text.lower():
            # Extract error message
            import re
            error_match = re.search(r'<div[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)</div>', response_text, re.IGNORECASE)
            if error_match:
                print(f"Error message: {error_match.group(1)}")
            else:
                # Look for any text that might be an error
                error_match = re.search(r'error[^>]*>([^<]+)', response_text, re.IGNORECASE)
                if error_match:
                    print(f"Error text: {error_match.group(1)}")
                else:
                    print("Error found but couldn't extract message")
        
        # Check if we're still on login page
        if "ScreenMerch Admin Login" in response_text:
            print("✅ Still on login page")
        else:
            print("❓ Not on login page - might have succeeded")
            
        # Save response to file for inspection
        with open('admin_response.html', 'w', encoding='utf-8') as f:
            f.write(response_text)
        print("📄 Response saved to admin_response.html")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    get_admin_error()
