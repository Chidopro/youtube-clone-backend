import requests
import json

# Test the authentication endpoints
BASE_URL = "https://backend-hidden-firefly-7865.fly.dev"

def test_auth_endpoints():
    print("Testing authentication endpoints...")
    print(f"Base URL: {BASE_URL}")
    
    # Test 1: Check if the server is reachable
    try:
        response = requests.get(f"{BASE_URL}/api/ping")
        print(f"✅ Ping endpoint: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Ping endpoint failed: {e}")
        return
    
    # Test 2: Test signup endpoint
    signup_data = {
        "email": "test@example.com",
        "password": "testpassword123"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/signup",
            headers={"Content-Type": "application/json"},
            json=signup_data
        )
        print(f"📝 Signup endpoint: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Signup endpoint failed: {e}")
    
    # Test 3: Test login endpoint
    login_data = {
        "email": "test@example.com",
        "password": "testpassword123"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            headers={"Content-Type": "application/json"},
            json=login_data
        )
        print(f"🔐 Login endpoint: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Login endpoint failed: {e}")

if __name__ == "__main__":
    test_auth_endpoints() 