#!/usr/bin/env python3
"""
Test to see exact database error
"""

import requests
import json

# Configuration
BASE_URL = "https://backend-hidden-firefly-7865.fly.dev"

def test_with_detailed_logging():
    """Test signup with detailed error logging"""
    print("🔍 Testing with Detailed Logging")
    print("=" * 50)
    
    # Test with a unique email
    import time
    timestamp = int(time.time())
    email = f"debug{timestamp}@example.com"
    
    signup_data = {
        "email": email,
        "password": "test123",
        "redirect_url": "https://screenmerch.com"
    }
    
    print(f"Testing with email: {email}")
    print(f"Request data: {json.dumps(signup_data, indent=2)}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/signup", 
            json=signup_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
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
        elif response.status_code == 409:
            print("ℹ️ Account already exists")
            return True
        else:
            print("❌ Signup failed!")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    test_with_detailed_logging() 