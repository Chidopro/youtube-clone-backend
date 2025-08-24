#!/usr/bin/env python3
"""
Test script to check shipping integration status
"""

import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

def test_printful_api_key():
    """Test if Printful API key is valid"""
    api_key = os.getenv("PRINTFUL_API_KEY")
    
    if not api_key:
        print("❌ PRINTFUL_API_KEY not found in environment")
        return False
    
    print(f"✅ PRINTFUL_API_KEY found: {api_key[:10]}...")
    
    # Test API key with a simple request
    try:
        response = requests.get(
            "https://api.printful.com/store",
            headers={"Authorization": f"Bearer {api_key}"}
        )
        
        if response.status_code == 200:
            print("✅ Printful API key is valid")
            return True
        else:
            print(f"❌ Printful API key test failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Printful API test failed: {str(e)}")
        return False

def test_shipping_endpoint():
    """Test the shipping calculation endpoint"""
    print("\n🔍 Testing shipping calculation endpoint...")
    
    test_data = {
        "cart": [
            {
                "printful_variant_id": 71,
                "quantity": 1
            }
        ],
        "shipping_address": {
            "country_code": "US",
            "state_code": "CA",
            "city": "Los Angeles",
            "zip": "90210"
        }
    }
    
    try:
        response = requests.post(
            "https://backend-hidden-firefly-7865.fly.dev/api/calculate-shipping",
            headers={"Content-Type": "application/json"},
            json=test_data
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Shipping endpoint working")
            print(f"Response: {json.dumps(data, indent=2)}")
            return True
        else:
            print(f"❌ Shipping endpoint failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Shipping endpoint test failed: {str(e)}")
        return False

def test_backend_health():
    """Test if backend is responding"""
    print("\n🔍 Testing backend health...")
    
    try:
        response = requests.get("https://backend-hidden-firefly-7865.fly.dev/api/ping")
        
        if response.status_code == 200:
            print("✅ Backend is responding")
            return True
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Backend health check failed: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚚 Shipping Integration Status Check")
    print("=" * 50)
    
    # Test backend health
    backend_ok = test_backend_health()
    
    # Test Printful API key
    api_ok = test_printful_api_key()
    
    # Test shipping endpoint
    shipping_ok = test_shipping_endpoint()
    
    print("\n" + "=" * 50)
    print("📊 SUMMARY:")
    print(f"Backend Health: {'✅ OK' if backend_ok else '❌ FAILED'}")
    print(f"Printful API: {'✅ OK' if api_ok else '❌ FAILED'}")
    print(f"Shipping Endpoint: {'✅ OK' if shipping_ok else '❌ FAILED'}")
    
    if not backend_ok:
        print("\n💡 Backend is not responding. Check if it's deployed to Fly.io")
    elif not api_ok:
        print("\n💡 Printful API key issue. Check your .env file and API key validity")
    elif not shipping_ok:
        print("\n💡 Shipping endpoint is failing. Check backend logs for details")
    else:
        print("\n🎉 All systems are working correctly!")

if __name__ == "__main__":
    main()
