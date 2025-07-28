#!/usr/bin/env python3
"""
Debug authentication error
"""

import requests
import json

# Configuration
BASE_URL = "https://backend-hidden-firefly-7865.fly.dev"

def test_health():
    """Test if backend is healthy"""
    print("🏥 Testing backend health...")
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        print(f"Health Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Backend is healthy")
            return True
        else:
            print(f"❌ Backend health check failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to backend: {str(e)}")
        return False

def test_signup_detailed():
    """Test signup with detailed error reporting"""
    print("\n🔍 Testing signup with detailed error...")
    
    signup_data = {
        "email": "test@example.com",
        "password": "testpassword123",
        "redirect_url": "https://screenmerch.com"
    }
    
    try:
        print(f"Sending request to: {BASE_URL}/api/auth/signup")
        print(f"Data: {json.dumps(signup_data, indent=2)}")
        
        response = requests.post(
            f"{BASE_URL}/api/auth/signup", 
            json=signup_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        try:
            response_json = response.json()
            print(f"Response JSON: {json.dumps(response_json, indent=2)}")
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
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ Connection error")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False

def test_login_detailed():
    """Test login with detailed error reporting"""
    print("\n🔍 Testing login with detailed error...")
    
    login_data = {
        "email": "test@example.com",
        "password": "testpassword123"
    }
    
    try:
        print(f"Sending request to: {BASE_URL}/api/auth/login")
        print(f"Data: {json.dumps(login_data, indent=2)}")
        
        response = requests.post(
            f"{BASE_URL}/api/auth/login", 
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
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

if __name__ == "__main__":
    print("🚀 Debug Authentication Error")
    print("=" * 50)
    
    # Test health first
    health_ok = test_health()
    
    if health_ok:
        # Test signup
        signup_ok = test_signup_detailed()
        
        if signup_ok:
            # Test login
            login_ok = test_login_detailed()
            
            if login_ok:
                print("\n🎉 Authentication is working!")
            else:
                print("\n⚠️ Signup works but login fails")
        else:
            print("\n❌ Signup is failing - this is the main issue")
    else:
        print("\n❌ Backend health check failed") 