#!/usr/bin/env python3
"""
Test product creation
"""

import requests
import json

def test_product_creation():
    try:
        print("Testing product creation...")
        
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
            "https://backend-hidden-firefly-7865.fly.dev/api/create-product",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                product_url = data.get("product_url")
                print(f"✅ Product created: {product_url}")
                return product_url
            else:
                print(f"❌ Product creation failed: {data.get('error')}")
                return None
        else:
            print(f"❌ Request failed with status {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    test_product_creation() 