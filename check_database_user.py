#!/usr/bin/env python3
"""
Check if user exists in database
"""
import requests
import json

def check_database():
    print("🔍 Checking database for user...")
    
    # Try to access a debug endpoint or check if user exists
    # Let's try the admin setup and see what it says
    
    print("1️⃣ Running admin setup to see what happens...")
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
            print(response.text)
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Try to test if the user exists by trying to create a duplicate
    print("\n2️⃣ Testing user creation...")
    try:
        # Try to create a new user with the same email
        signup_data = {
            'email': 'chidopro@proton.me',
            'password': 'VieG369Bbk8!',
            'display_name': 'Test Admin'
        }
        
        response = requests.post('https://copy5-backend.fly.dev/api/auth/signup', 
                               json=signup_data)
        print(f"Signup status: {response.status_code}")
        print(f"Signup response: {response.text}")
        
        if "already exists" in response.text or "duplicate" in response.text:
            print("✅ User EXISTS in database")
        elif response.status_code == 201:
            print("✅ User was CREATED")
        else:
            print("❓ Unknown signup response")
            
    except Exception as e:
        print(f"❌ Signup error: {e}")

if __name__ == "__main__":
    check_database()
