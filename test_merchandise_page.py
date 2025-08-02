#!/usr/bin/env python3
"""
Test script to verify merchandise page functionality
"""

import requests
import json
import sys

# Configuration
BACKEND_URL = "https://backend-hidden-firefly-7865.fly.dev"

def test_backend_health():
    """Test if backend is responding"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/ping", timeout=10)
        if response.status_code == 200:
            print("✅ Backend is responding")
            return True
        else:
            print(f"❌ Backend responded with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend connection failed: {e}")
        return False

def test_create_product():
    """Test product creation endpoint"""
    try:
        test_data = {
            "thumbnail": "https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=Test+Thumbnail",
            "videoUrl": "https://example.com/test-video",
            "screenshots": [
                "https://via.placeholder.com/300x200/2196F3/FFFFFF?text=Screenshot+1",
                "https://via.placeholder.com/300x200/FF9800/FFFFFF?text=Screenshot+2",
                "https://via.placeholder.com/300x200/9C27B0/FFFFFF?text=Screenshot+3"
            ]
        }
        
        response = requests.post(
            f"{BACKEND_URL}/api/create-product",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                product_url = data.get("product_url")
                print(f"✅ Product created successfully: {product_url}")
                return product_url
            else:
                print(f"❌ Product creation failed: {data.get('error')}")
                return None
        else:
            print(f"❌ Product creation request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Product creation test failed: {e}")
        return None

def test_product_page(product_url):
    """Test if product page loads correctly"""
    try:
        response = requests.get(product_url, timeout=15)
        if response.status_code == 200:
            content = response.text
            if "Available Products" in content and "Screenshots Selected" in content:
                print("✅ Product page loads correctly")
                return True
            else:
                print("❌ Product page missing expected content")
                return False
        else:
            print(f"❌ Product page request failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Product page test failed: {e}")
        return False

def main():
    print("🧪 Testing Merchandise Page Functionality")
    print("=" * 50)
    
    # Test 1: Backend health
    if not test_backend_health():
        print("\n❌ Backend is not responding. Please check your deployment.")
        sys.exit(1)
    
    # Test 2: Create product
    product_url = test_create_product()
    if not product_url:
        print("\n❌ Product creation failed. Please check the backend logs.")
        sys.exit(1)
    
    # Test 3: Test product page
    if not test_product_page(product_url):
        print("\n❌ Product page test failed. Please check the template and static files.")
        sys.exit(1)
    
    print("\n🎉 All tests passed! Your merchandise page should be working.")
    print(f"📝 Test product URL: {product_url}")

if __name__ == "__main__":
    main() 