#!/usr/bin/env python3
"""
Test admin login after database fix
"""
import requests
import json

def test_final_login():
    print("🧪 Testing admin login after database fix...")
    
    # Test new admin credentials
    print("1️⃣ Testing NEW admin: chidopro@proton.me / VieG369Bbk8!")
    
    session = requests.Session()
    
    try:
        # Submit login form
        login_data = {
            'email': 'chidopro@proton.me',
            'password': 'VieG369Bbk8!'
        }
        
        response = session.post('https://copy5-backend.fly.dev/admin/login', 
                              data=login_data)
        
        print(f"Login status: {response.status_code}")
        
        if response.status_code == 302:
            print("✅ SUCCESS! Redirected (likely to admin dashboard)")
            print(f"Redirect location: {response.headers.get('Location', 'Not specified')}")
        elif response.status_code == 200:
            if "Invalid credentials" in response.text:
                print("❌ Still getting invalid credentials")
            elif "admin" in response.text.lower() and "dashboard" in response.text.lower():
                print("✅ SUCCESS! On admin dashboard")
            else:
                print("❓ Unknown response")
        else:
            print(f"❌ Unexpected status: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test old admin (should fail)
    print("\n2️⃣ Testing OLD admin: admin@screenmerch.com (should fail)")
    
    try:
        login_data_old = {
            'email': 'admin@screenmerch.com',
            'password': 'admin123'
        }
        
        response = session.post('https://copy5-backend.fly.dev/admin/login', 
                              data=login_data_old)
        
        if response.status_code == 200:
            if "Access restricted" in response.text:
                print("✅ OLD admin properly blocked!")
            else:
                print("❌ OLD admin still working")
        else:
            print(f"❓ OLD admin status: {response.status_code}")
            
    except Exception as e:
        print(f"❌ OLD admin error: {e}")
    
    print("\n🎯 Admin login test complete!")

if __name__ == "__main__":
    test_final_login()
