#!/usr/bin/env python3
"""
Test script for shipping calculation functionality
"""
import requests
import json

# Test the shipping calculation endpoint
def test_shipping_calculation():
    """Test the /api/calculate-shipping endpoint"""
    
    # Your backend URL
    backend_url = "https://copy5-backend.fly.dev"
    
    # Test data
    test_data = {
        "items": [
            {
                "product_type": "Unisex Classic Tee",
                "color": "Black",
                "size": "M",
                "quantity": 1,
                "printful_variant_id": 4012
            }
        ],
        "country": "US",
        "state": "CA",
        "zip": "94501"
    }
    
    try:
        print("Testing shipping calculation...")
        print(f"Backend URL: {backend_url}")
        print(f"Test data: {json.dumps(test_data, indent=2)}")
        
        response = requests.post(
            f"{backend_url}/api/calculate-shipping",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Success! Shipping rates: {json.dumps(result, indent=2)}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {str(e)}")
        return False
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_shipping_calculation()
    if success:
        print("\n✅ Shipping calculation test passed!")
    else:
        print("\n❌ Shipping calculation test failed!")
