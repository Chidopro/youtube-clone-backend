#!/usr/bin/env python3
"""
Test script to verify CORS configuration is working properly
"""
import requests
import json

def test_cors_headers():
    """Test CORS headers on the backend API"""
    
    # Test URLs
    base_url = "https://screenmerch.fly.dev"
    test_endpoints = [
        "/api/health",
        "/api/products",
        "/api/users/ensure-exists"
    ]
    
    # Test origins
    test_origins = [
        "https://screenmerch.com",
        "https://www.screenmerch.com", 
        "http://localhost:3000",
        "http://localhost:5173",
        "https://famous-custard-4c8894.netlify.app",
        "https://screenmerch.fly.dev"
    ]
    
    print("🧪 Testing CORS Configuration")
    print("=" * 50)
    
    for endpoint in test_endpoints:
        print(f"\n📍 Testing endpoint: {endpoint}")
        
        for origin in test_origins:
            try:
                # Test OPTIONS request (preflight)
                headers = {
                    'Origin': origin,
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Content-Type,Authorization'
                }
                
                response = requests.options(f"{base_url}{endpoint}", headers=headers, timeout=10)
                
                cors_origin = response.headers.get('Access-Control-Allow-Origin', 'Not set')
                cors_credentials = response.headers.get('Access-Control-Allow-Credentials', 'Not set')
                cors_methods = response.headers.get('Access-Control-Allow-Methods', 'Not set')
                cors_headers = response.headers.get('Access-Control-Allow-Headers', 'Not set')
                
                print(f"  🎯 Origin: {origin}")
                print(f"     Status: {response.status_code}")
                print(f"     CORS Origin: {cors_origin}")
                print(f"     CORS Credentials: {cors_credentials}")
                print(f"     CORS Methods: {cors_methods}")
                print(f"     CORS Headers: {cors_headers}")
                
                # Check if CORS is working
                if cors_origin == origin or cors_origin == '*':
                    print(f"     ✅ CORS working for {origin}")
                else:
                    print(f"     ❌ CORS issue for {origin}")
                    
            except requests.exceptions.RequestException as e:
                print(f"  ❌ Error testing {origin}: {e}")
        
        print("-" * 30)

def test_actual_api_call():
    """Test an actual API call to see if CORS works end-to-end"""
    print("\n🔗 Testing actual API call")
    print("=" * 50)
    
    try:
        # Test a simple API call
        response = requests.get("https://screenmerch.fly.dev/api/health", timeout=10)
        print(f"Health check status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Backend is responding")
        else:
            print("❌ Backend issue")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot reach backend: {e}")

if __name__ == "__main__":
    test_cors_headers()
    test_actual_api_call()
    print("\n🏁 CORS testing complete!")
