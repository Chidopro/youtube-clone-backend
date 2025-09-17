#!/usr/bin/env python3
"""
Test admin login directly
"""
import requests
import json

def test_admin_login():
    print("🔐 Testing admin login...")
    
    # Test the exact credentials
    login_data = {
        'email': 'chidopro@proton.me',
        'password': 'VieG369Bbk8!'
    }
    
    try:
        response = requests.post('https://copy5-backend.fly.dev/api/auth/login', 
                               json=login_data)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Login successful!")
        else:
            print("❌ Login failed")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_admin_login()
