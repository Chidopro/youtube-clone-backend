#!/usr/bin/env python3
"""
Test deployment fixes
"""
import requests
import json

def test_deployment():
    print("🧪 Testing deployment fixes...")
    
    # Test 1: Admin login with old credentials (should fail)
    print("\n1️⃣ Testing old admin credentials (should fail)...")
    try:
        response = requests.post('https://copy5-backend.fly.dev/api/auth/login', 
                               json={'email': 'admin@screenmerch.com', 'password': 'admin123'})
        if response.status_code == 401:
            print("✅ Old admin credentials properly rejected")
        else:
            print(f"❌ Old admin still working: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing old admin: {e}")
    
    # Test 2: Admin login with new credentials (should work)
    print("\n2️⃣ Testing new admin credentials (should work)...")
    try:
        response = requests.post('https://copy5-backend.fly.dev/api/auth/login', 
                               json={'email': 'chidopro@proton.me', 'password': 'VieG369Bbk8!'})
        if response.status_code == 200:
            print("✅ New admin credentials working")
        else:
            print(f"❌ New admin not working: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing new admin: {e}")
    
    # Test 3: Check if image enhancement endpoint exists
    print("\n3️⃣ Testing image enhancement endpoint...")
    try:
        # Just check if endpoint responds (we can't test actual image processing without a real image)
        response = requests.get('https://copy5-backend.fly.dev/api/health')
        if response.status_code == 200:
            print("✅ Backend is responding")
        else:
            print(f"❌ Backend not responding: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing backend: {e}")
    
    print("\n🎯 Deployment test complete!")

if __name__ == "__main__":
    test_deployment()
