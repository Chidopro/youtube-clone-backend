#!/usr/bin/env python3
"""
Test script for authentication system
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000"  # Change this to your backend URL

def test_signup():
    """Test user signup"""
    print("🧪 Testing user signup...")
    
    signup_data = {
        "email": "test@example.com",
        "password": "testpassword123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/signup", 
                               json=signup_data,
                               headers={'Content-Type': 'application/json'})
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
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
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            print("✅ Login successful!")
            return True
        else:
            print("❌ Login failed!")
            return False
            
    except Exception as e:
        print(f"❌ Error during login test: {str(e)}")
        return False

def test_invalid_login():
    """Test invalid login credentials"""
    print("\n🧪 Testing invalid login...")
    
    login_data = {
        "email": "test@example.com",
        "password": "wrongpassword"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", 
                               json=login_data,
                               headers={'Content-Type': 'application/json'})
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 401:
            print("✅ Invalid login correctly rejected!")
            return True
        else:
            print("❌ Invalid login should have been rejected!")
            return False
            
    except Exception as e:
        print(f"❌ Error during invalid login test: {str(e)}")
        return False

def test_verify():
    """Test user verification"""
    print("\n🧪 Testing user verification...")
    
    verify_data = {
        "email": "test@example.com"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/verify", 
                               json=verify_data,
                               headers={'Content-Type': 'application/json'})
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            print("✅ Verification successful!")
            return True
        else:
            print("❌ Verification failed!")
            return False
            
    except Exception as e:
        print(f"❌ Error during verification test: {str(e)}")
        return False

def main():
    """Run all authentication tests"""
    print("🚀 Starting Authentication System Tests")
    print("=" * 50)
    
    # Test signup
    signup_success = test_signup()
    
    # Test login
    login_success = test_login()
    
    # Test invalid login
    invalid_login_success = test_invalid_login()
    
    # Test verification
    verify_success = test_verify()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Results Summary:")
    print(f"Signup: {'✅ PASS' if signup_success else '❌ FAIL'}")
    print(f"Login: {'✅ PASS' if login_success else '❌ FAIL'}")
    print(f"Invalid Login: {'✅ PASS' if invalid_login_success else '❌ FAIL'}")
    print(f"Verification: {'✅ PASS' if verify_success else '❌ FAIL'}")
    
    all_tests_passed = signup_success and login_success and invalid_login_success and verify_success
    
    if all_tests_passed:
        print("\n🎉 All authentication tests passed!")
        print("✅ Your authentication system is working correctly!")
    else:
        print("\n⚠️ Some tests failed. Please check the implementation.")
    
    print("\n📝 Next steps:")
    print("1. Run the database setup script: database_auth_setup.sql")
    print("2. Test the product page authentication flow")
    print("3. Implement proper password hashing for production")

if __name__ == "__main__":
    main() 