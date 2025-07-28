#!/usr/bin/env python3
"""
Quick test for authentication endpoints
"""

import requests
import json

# Configuration
BASE_URL = "https://backend-hidden-firefly-7865.fly.dev"

def test_signup():
    """Test user signup"""
    print("🧪 Testing user signup...")
    
    signup_data = {
        "email": "test@example.com",
        "password": "testpassword123",
        "redirect_url": "https://screenmerch.com"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/signup", 
                               json=signup_data,
                               headers={'Content-Type': 'application/json'})
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        try:
            response_json = response.json()
            print(f"Response JSON: {json.dumps(response_json, indent=2)}")
        except:
            print(f"Response Text: {response.text}")
        
        if response.status_code == 200:
            print("✅ Signup successful!")
            return True
        else:
            print("❌ Signup failed!")
            return False
            
    except Exception as e:
        print(f"❌ Error during signup test: {str(e)}")
        return False

def test_login():
    """Test user login"""
    print("\n🧪 Testing user login...")
    
    login_data = {
        "email": "test@example.com",
        "password": "testpassword123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", 
                               json=login_data,
                               headers={'Content-Type': 'application/json'})
        
        print(f"Status Code: {response.status_code}")
        
        try:
            response_json = response.json()
            print(f"Response JSON: {json.dumps(response_json, indent=2)}")
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

def test_health():
    """Test health endpoint"""
    print("\n🧪 Testing health endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        
        print(f"Status Code: {response.status_code}")
        
        try:
            response_json = response.json()
            print(f"Response JSON: {json.dumps(response_json, indent=2)}")
        except:
            print(f"Response Text: {response.text}")
        
        if response.status_code == 200:
            print("✅ Health check successful!")
            return True
        else:
            print("❌ Health check failed!")
            return False
            
    except Exception as e:
        print(f"❌ Error during health test: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Quick Authentication Test")
    print("=" * 50)
    
    # Test health first
    health_ok = test_health()
    
    if health_ok:
        # Test signup
        signup_ok = test_signup()
        
        if signup_ok:
            # Test login
            login_ok = test_login()
        else:
            print("\n⚠️ Skipping login test due to signup failure")
            login_ok = False
    else:
        print("\n⚠️ Skipping auth tests due to health check failure")
        signup_ok = False
        login_ok = False
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Results Summary:")
    print(f"Health Check: {'✅ PASS' if health_ok else '❌ FAIL'}")
    print(f"Signup: {'✅ PASS' if signup_ok else '❌ FAIL'}")
    print(f"Login: {'✅ PASS' if login_ok else '❌ FAIL'}")
    
    if not health_ok:
        print("\n🔧 Troubleshooting:")
        print("1. Check if backend is running: https://backend-hidden-firefly-7865.fly.dev/api/health")
        print("2. Check Fly.io logs: fly logs")
        print("3. Verify deployment: fly status")
    
    if not signup_ok and health_ok:
        print("\n🔧 Database Issues:")
        print("1. Run the SQL script in Supabase SQL Editor")
        print("2. Check if users table has required columns")
        print("3. Verify RLS policies are set correctly") 