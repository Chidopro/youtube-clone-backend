#!/usr/bin/env python3
"""
Simple admin test - try the exact credentials from your screenshot
"""
import requests
import json

def simple_test():
    print("🧪 Simple admin test...")
    
    # Try the exact credentials that should work
    print("Testing: chidopro@proton.me / VieG369Bbk8!")
    
    session = requests.Session()
    
    try:
        # Get login page first
        response = session.get('https://copy5-backend.fly.dev/admin/login')
        print(f"Login page: {response.status_code}")
        
        # Submit login
        login_data = {
            'email': 'chidopro@proton.me',
            'password': 'VieG369Bbk8!'
        }
        
        response = session.post('https://copy5-backend.fly.dev/admin/login', 
                              data=login_data)
        
        print(f"Login result: {response.status_code}")
        
        if response.status_code == 302:
            print("✅ SUCCESS! Redirected (likely to admin dashboard)")
        elif response.status_code == 200:
            if "Invalid credentials" in response.text:
                print("❌ Invalid credentials")
            elif "admin" in response.text.lower() and "dashboard" in response.text.lower():
                print("✅ SUCCESS! On admin dashboard")
            else:
                print("❓ Unknown response")
        else:
            print(f"❌ Unexpected status: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    simple_test()
