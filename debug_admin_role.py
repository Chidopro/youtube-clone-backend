#!/usr/bin/env python3
"""
Debug admin role issue
"""
import requests
import json

def debug_admin_role():
    print("🔍 Debugging admin role issue...")
    
    # Run admin setup and check the response
    print("1️⃣ Running admin setup...")
    try:
        response = requests.post('https://copy5-backend.fly.dev/admin/setup')
        print(f"Admin setup status: {response.status_code}")
        
        if response.status_code == 200:
            response_text = response.text
            print("Admin setup response:")
            print(response_text)
            
            # Check if it says "created" or "updated"
            if "created successfully" in response_text:
                print("✅ User was CREATED")
            elif "updated successfully" in response_text:
                print("✅ User was UPDATED")
            else:
                print("❓ Unknown response")
                
        else:
            print(f"❌ Admin setup failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Try to create a new user with admin role
    print("\n2️⃣ Trying to create fresh admin user...")
    try:
        # First, try to delete the existing user by creating a new one
        signup_data = {
            'email': 'chidopro@proton.me',
            'password': 'VieG369Bbk8!',
            'display_name': 'Admin User'
        }
        
        response = requests.post('https://copy5-backend.fly.dev/api/auth/signup', 
                               json=signup_data)
        print(f"Signup status: {response.status_code}")
        print(f"Signup response: {response.text}")
        
        if response.status_code == 201:
            print("✅ New user created")
        elif response.status_code == 409:
            print("✅ User already exists")
        else:
            print(f"❌ Signup failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Signup error: {e}")
    
    # Now try admin setup again
    print("\n3️⃣ Running admin setup again...")
    try:
        response = requests.post('https://copy5-backend.fly.dev/admin/setup')
        print(f"Admin setup status: {response.status_code}")
        print("Admin setup response:", response.text[:200] + "..." if len(response.text) > 200 else response.text)
        
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test login again
    print("\n4️⃣ Testing login after setup...")
    try:
        session = requests.Session()
        login_data = {
            'email': 'chidopro@proton.me',
            'password': 'VieG369Bbk8!'
        }
        
        response = session.post('https://copy5-backend.fly.dev/admin/login', 
                              data=login_data)
        
        print(f"Login status: {response.status_code}")
        if response.status_code == 200:
            if "Invalid credentials" in response.text:
                print("❌ Still getting invalid credentials")
            else:
                print("✅ Login might have worked!")
        else:
            print(f"❌ Login failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Login error: {e}")

if __name__ == "__main__":
    debug_admin_role()
