#!/usr/bin/env python3
"""
Fix admin password issue
"""
import requests
import json

def fix_admin():
    print("🔧 Fixing admin password...")
    
    # First, let's try to create a simple test admin
    print("1️⃣ Creating test admin with simple password...")
    
    # Try admin setup with a simple password
    try:
        # We need to modify the admin setup to use a simple password
        # Let's try the current setup first
        response = requests.post('https://copy5-backend.fly.dev/admin/setup')
        print(f"Admin setup status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Admin setup successful")
            
            # Now test login
            print("\n2️⃣ Testing login...")
            login_data = {
                'email': 'chidopro@proton.me',
                'password': 'VieG369Bbk8!'
            }
            
            response = requests.post('https://copy5-backend.fly.dev/api/auth/login', 
                                   json=login_data)
            print(f"Login status: {response.status_code}")
            print(f"Login response: {response.text}")
            
            if response.status_code == 401:
                print("\n❌ Still failing. Let me try a different approach...")
                
                # Try with the old password that might still be in database
                print("\n3️⃣ Trying old password...")
                login_data_old = {
                    'email': 'chidopro@proton.me',
                    'password': 'admin123'
                }
                
                response = requests.post('https://copy5-backend.fly.dev/api/auth/login', 
                                       json=login_data_old)
                print(f"Old password status: {response.status_code}")
                print(f"Old password response: {response.text}")
                
        else:
            print(f"❌ Admin setup failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    fix_admin()
