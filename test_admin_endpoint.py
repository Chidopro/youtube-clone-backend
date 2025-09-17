#!/usr/bin/env python3
"""
Test admin login endpoint directly
"""
import requests
import json

def test_admin_endpoint():
    print("🔐 Testing admin login endpoint directly...")
    
    # Test the admin login endpoint (not the API endpoint)
    login_data = {
        'email': 'chidopro@proton.me',
        'password': 'VieG369Bbk8!'
    }
    
    try:
        # Use the admin login endpoint
        response = requests.post('https://copy5-backend.fly.dev/admin/login', 
                               data=login_data)  # Use data instead of json for form data
        
        print(f"Admin login status: {response.status_code}")
        print(f"Admin login response: {response.text[:500]}...")
        
        if response.status_code == 200:
            print("✅ Admin login successful!")
        elif response.status_code == 302:
            print("✅ Admin login successful (redirect)!")
        else:
            print("❌ Admin login failed")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Also test the API endpoint for comparison
    print("\n🔐 Testing API login endpoint...")
    try:
        response = requests.post('https://copy5-backend.fly.dev/api/auth/login', 
                               json=login_data)
        
        print(f"API login status: {response.status_code}")
        print(f"API login response: {response.text}")
        
    except Exception as e:
        print(f"❌ API Error: {e}")

if __name__ == "__main__":
    test_admin_endpoint()
