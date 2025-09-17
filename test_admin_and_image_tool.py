#!/usr/bin/env python3
"""
Test admin login and image enhancement tool
"""
import requests
import json
import base64

def test_admin_and_image():
    print("🧪 Testing admin login and image enhancement tool...")
    
    # Test 1: Admin Login
    print("\n1️⃣ Testing Admin Login...")
    
    session = requests.Session()
    
    try:
        # Test admin login
        login_data = {
            'email': 'chidopro@proton.me',
            'password': 'VieG369Bbk8!'
        }
        
        response = session.post('https://copy5-backend.fly.dev/admin/login', 
                              data=login_data)
        
        if response.status_code == 200 and "admin" in response.text.lower():
            print("✅ Admin login successful!")
        else:
            print(f"❌ Admin login failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Admin login error: {e}")
        return False
    
    # Test 2: Image Enhancement Tool
    print("\n2️⃣ Testing Image Enhancement Tool...")
    
    try:
        # Create a simple test image (1x1 pixel PNG)
        test_image_data = base64.b64encode(
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
        ).decode('utf-8')
        
        # Test image enhancement endpoint
        enhancement_data = {
            'screenshot_data': test_image_data,
            'print_dpi': 300,
            'crop_area': None
        }
        
        response = session.post('https://copy5-backend.fly.dev/api/enhance-screenshot', 
                              json=enhancement_data)
        
        print(f"Image enhancement status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ Image enhancement tool working!")
                print(f"   Enhanced image size: {len(result.get('enhanced_image', ''))}")
            else:
                print(f"❌ Image enhancement failed: {result.get('error', 'Unknown error')}")
        else:
            print(f"❌ Image enhancement endpoint error: {response.status_code}")
            print(f"   Response: {response.text[:200]}...")
            
    except Exception as e:
        print(f"❌ Image enhancement error: {e}")
    
    # Test 3: Check if we can access admin dashboard
    print("\n3️⃣ Testing Admin Dashboard Access...")
    
    try:
        response = session.get('https://copy5-backend.fly.dev/admin/orders')
        
        if response.status_code == 200:
            print("✅ Admin dashboard accessible!")
        else:
            print(f"❌ Admin dashboard not accessible: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Admin dashboard error: {e}")
    
    print("\n🎯 Test complete!")
    return True

if __name__ == "__main__":
    test_admin_and_image()
