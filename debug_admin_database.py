#!/usr/bin/env python3
"""
Debug admin database
"""
import requests
import json

def debug_admin():
    print("🔍 Debugging admin database...")
    
    # Check what users exist
    try:
        response = requests.get('https://copy5-backend.fly.dev/api/debug/users')
        print(f"Users endpoint status: {response.status_code}")
        if response.status_code == 200:
            print("Users:", response.text)
        else:
            print("Users endpoint not available")
    except Exception as e:
        print(f"Users endpoint error: {e}")
    
    # Try admin setup again
    print("\n🔧 Running admin setup again...")
    try:
        response = requests.post('https://copy5-backend.fly.dev/admin/setup')
        print(f"Admin setup status: {response.status_code}")
        print("Admin setup response:", response.text[:300])
    except Exception as e:
        print(f"Admin setup error: {e}")
    
    # Test login again
    print("\n🔐 Testing login after setup...")
    try:
        login_data = {
            'email': 'chidopro@proton.me',
            'password': 'VieG369Bbk8!'
        }
        response = requests.post('https://copy5-backend.fly.dev/api/auth/login', 
                               json=login_data)
        print(f"Login status: {response.status_code}")
        print(f"Login response: {response.text}")
    except Exception as e:
        print(f"Login error: {e}")

if __name__ == "__main__":
    debug_admin()
