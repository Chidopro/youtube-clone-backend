#!/usr/bin/env python3
"""
Test CORS configuration for Netlify frontend + Fly.io backend setup
"""
import requests
import json

def test_netlify_fly_cors():
    """Test CORS between Netlify frontend and Fly.io backend"""
    
    # Backend URL (Fly.io)
    backend_url = "https://screenmerch.fly.dev"
    
    # Frontend URLs (Netlify)
    frontend_urls = [
        "https://screenmerch.com",  # Production domain
        "https://www.screenmerch.com",  # www subdomain
        "https://eloquent-crumble-37c09e.netlify.app",  # Netlify preview URL
        "https://famous-custard-4c8894.netlify.app",  # Alternative Netlify URL
    ]
    
    # Test endpoints
    test_endpoints = [
        "/api/health",
        "/api/products",
        "/api/users/ensure-exists"
    ]
    
    print("🌐 Testing Netlify Frontend ↔ Fly.io Backend CORS")
    print("=" * 60)
    print(f"Backend: {backend_url}")
    print(f"Frontend: Netlify (screenmerch.com)")
    print("=" * 60)
    
    for endpoint in test_endpoints:
        print(f"\n📍 Testing endpoint: {endpoint}")
        
        for frontend_url in frontend_urls:
            try:
                # Test OPTIONS request (preflight)
                headers = {
                    'Origin': frontend_url,
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Content-Type,Authorization'
                }
                
                print(f"  🎯 Testing from: {frontend_url}")
                
                response = requests.options(f"{backend_url}{endpoint}", headers=headers, timeout=15)
                
                # Extract CORS headers
                cors_origin = response.headers.get('Access-Control-Allow-Origin', 'Not set')
                cors_credentials = response.headers.get('Access-Control-Allow-Credentials', 'Not set')
                cors_methods = response.headers.get('Access-Control-Allow-Methods', 'Not set')
                cors_headers = response.headers.get('Access-Control-Allow-Headers', 'Not set')
                
                print(f"     Status: {response.status_code}")
                print(f"     CORS Origin: {cors_origin}")
                print(f"     CORS Credentials: {cors_credentials}")
                print(f"     CORS Methods: {cors_methods}")
                print(f"     CORS Headers: {cors_headers}")
                
                # Check if CORS is working
                if cors_origin == frontend_url or cors_origin == '*':
                    print(f"     ✅ CORS working for {frontend_url}")
                else:
                    print(f"     ❌ CORS issue for {frontend_url}")
                    print(f"     Expected: {frontend_url}, Got: {cors_origin}")
                    
            except requests.exceptions.RequestException as e:
                print(f"  ❌ Error testing {frontend_url}: {e}")
        
        print("-" * 40)

def test_actual_api_calls():
    """Test actual API calls from different origins"""
    print("\n🔗 Testing actual API calls")
    print("=" * 60)
    
    backend_url = "https://screenmerch.fly.dev"
    
    # Test basic connectivity
    try:
        response = requests.get(f"{backend_url}/api/health", timeout=15)
        print(f"Health check status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Backend is responding")
        else:
            print("❌ Backend issue")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot reach backend: {e}")
        return
    
    # Test with different origins
    test_origins = [
        "https://screenmerch.com",
        "https://eloquent-crumble-37c09e.netlify.app"
    ]
    
    for origin in test_origins:
        try:
            headers = {'Origin': origin}
            response = requests.get(f"{backend_url}/api/health", headers=headers, timeout=15)
            
            cors_origin = response.headers.get('Access-Control-Allow-Origin', 'Not set')
            print(f"\n🎯 Testing from {origin}:")
            print(f"   Status: {response.status_code}")
            print(f"   CORS Origin: {cors_origin}")
            
            if cors_origin == origin:
                print(f"   ✅ CORS working correctly")
            else:
                print(f"   ❌ CORS mismatch")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Error testing {origin}: {e}")

def test_netlify_deployment():
    """Test if Netlify frontend is accessible"""
    print("\n🌐 Testing Netlify Frontend Deployment")
    print("=" * 60)
    
    frontend_urls = [
        "https://screenmerch.com",
        "https://eloquent-crumble-37c09e.netlify.app"
    ]
    
    for url in frontend_urls:
        try:
            response = requests.get(url, timeout=15)
            print(f"Frontend {url}:")
            print(f"  Status: {response.status_code}")
            
            if response.status_code == 200:
                print(f"  ✅ Frontend accessible")
            else:
                print(f"  ❌ Frontend issue")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Cannot reach {url}: {e}")

if __name__ == "__main__":
    test_netlify_fly_cors()
    test_actual_api_calls()
    test_netlify_deployment()
    print("\n🏁 Netlify + Fly.io CORS testing complete!")
    print("\n📋 Summary:")
    print("   • Frontend: Netlify (screenmerch.com)")
    print("   • Backend: Fly.io (screenmerch.fly.dev)")
    print("   • CORS configured for Netlify ↔ Fly.io communication")
