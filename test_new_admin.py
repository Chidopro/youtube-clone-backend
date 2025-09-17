#!/usr/bin/env python3
"""
Test new admin credentials
"""
import requests
import json

def test_new_admin():
    print("🔐 Testing NEW admin credentials...")
    
    # Test the new credentials
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
            print("✅ NEW admin login successful!")
            return True
        else:
            print("❌ NEW admin login failed")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    test_new_admin()
