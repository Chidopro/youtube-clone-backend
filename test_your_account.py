#!/usr/bin/env python3
"""
Test specific user account
"""

import requests
import json

# Configuration
BASE_URL = "https://backend-hidden-firefly-7865.fly.dev"

def test_user_signup(email, password):
    """Test signup for specific user"""
    print(f"🧪 Testing signup for: {email}")
    
    signup_data = {
        "email": email,
        "password": password,
        "redirect_url": "https://screenmerch.com"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/signup", 
                               json=signup_data,
                               headers={'Content-Type': 'application/json'})
        
        print(f"Status Code: {response.status_code}")
        
        try:
            response_json = response.json()
            print(f"Response: {json.dumps(response_json, indent=2)}")
        except:
            print(f"Response Text: {response.text}")
        
        if response.status_code == 200:
            print("✅ Signup successful!")
            return True
        elif response.status_code == 409:
            print("ℹ️ Account already exists")
            return True
        else:
            print("❌ Signup failed!")
            return False
            
    except Exception as e:
        print(f"❌ Error during signup test: {str(e)}")
        return False

def test_user_login(email, password):
    """Test login for specific user"""
    print(f"\n🧪 Testing login for: {email}")
    
    login_data = {
        "email": email,
        "password": password
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", 
                               json=login_data,
                               headers={'Content-Type': 'application/json'})
        
        print(f"Status Code: {response.status_code}")
        
        try:
            response_json = response.json()
            print(f"Response: {json.dumps(response_json, indent=2)}")
        except:
            print(f"Response Text: {response.text}")
        
        if response.status_code == 200:
            print("✅ Login successful!")
            return True
        else:
            print("❌ Login failed!")
            return False
            
    except Exception as e:
        print(f"❌ Error during login test: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Testing Your Account")
    print("=" * 50)
    
    # Test with your email
    email = "chidopro@proton.me"
    password = "testpassword123"  # Use this test password
    
    print(f"Testing account: {email}")
    print("Please replace 'your_password_here' with your actual password in the script")
    
    # Test signup first
    signup_ok = test_user_signup(email, password)
    
    if signup_ok:
        # Test login
        login_ok = test_user_login(email, password)
        
        if login_ok:
            print("\n🎉 Your account is working!")
            print("The issue might be in the frontend. Try refreshing the page.")
        else:
            print("\n⚠️ Login failed. Possible issues:")
            print("1. Password might be incorrect")
            print("2. Account might not be properly created")
            print("3. Database connection issue")
    else:
        print("\n❌ Account creation failed. Database setup needed.")
        print("Please run the SQL script in Supabase first.") 