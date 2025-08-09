#!/usr/bin/env python3
"""
Test script for shipping cost integration with Printful
"""

import os
import sys
import json
import requests
from dotenv import load_dotenv

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from printful_integration import ScreenMerchPrintfulIntegration

load_dotenv()

def test_shipping_calculation():
    """Test shipping cost calculation"""
    print("🧪 Testing Shipping Cost Integration")
    print("=" * 50)
    
    try:
        # Initialize the integration
        integration = ScreenMerchPrintfulIntegration()
        print("✅ Printful integration initialized successfully")
        
        # Test data
        test_items = [
            {
                "product": "Unisex Staple T-Shirt",
                "quantity": 1,
                "printful_variant_id": 71  # Basic t-shirt variant
            }
        ]
        
        test_addresses = [
            {
                "country_code": "US",
                "state_code": "CA",
                "city": "Los Angeles",
                "zip": "90210"
            },
            {
                "country_code": "CA",
                "state_code": "ON",
                "city": "Toronto",
                "zip": "M5V 3A8"
            },
            {
                "country_code": "GB",
                "city": "London",
                "zip": "SW1A 1AA"
            },
            {
                "country_code": "AU",
                "state_code": "NSW",
                "city": "Sydney",
                "zip": "2000"
            }
        ]
        
        print("\n🌍 Testing shipping calculations for different countries:")
        print("-" * 50)
        
        for i, address in enumerate(test_addresses, 1):
            print(f"\nTest {i}: {address['country_code']}")
            try:
                result = integration.calculate_shipping_rates(address, test_items)
                if result['success']:
                    print(f"✅ Shipping Cost: ${result['shipping_cost']:.2f}")
                    print(f"   Delivery Days: {result.get('delivery_days', 'N/A')}")
                    print(f"   Fallback Mode: {result.get('fallback', False)}")
                else:
                    print(f"❌ Failed: {result.get('error', 'Unknown error')}")
            except Exception as e:
                print(f"❌ Exception: {str(e)}")
        
        print("\n" + "=" * 50)
        print("✅ Shipping integration test completed!")
        
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False
    
    return True

def test_api_endpoint():
    """Test the API endpoint"""
    print("\n🌐 Testing API Endpoint")
    print("=" * 50)
    
    # Test data for API call
    test_data = {
        "cart": [
            {
                "product": "Unisex Staple T-Shirt",
                "quantity": 1,
                "printful_variant_id": 71
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
        # Test the local API endpoint
        response = requests.post(
            "http://127.0.0.1:5000/api/calculate-shipping",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ API endpoint working!")
            print(f"   Shipping Cost: ${data.get('shipping_cost', 0):.2f}")
            print(f"   Success: {data.get('success', False)}")
        else:
            print(f"❌ API returned status {response.status_code}")
            print(f"   Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("⚠️  API endpoint not running (this is expected if server is not started)")
        print("   To test: Start your Flask server and run this test again")
    except Exception as e:
        print(f"❌ API test failed: {str(e)}")

if __name__ == "__main__":
    print("🚀 ScreenMerch Shipping Integration Test")
    print("=" * 50)
    
    # Check environment variables
    if not os.getenv("PRINTFUL_API_KEY"):
        print("❌ PRINTFUL_API_KEY environment variable not found!")
        print("   Please add your Printful API key to your .env file")
        sys.exit(1)
    
    # Run tests
    test_shipping_calculation()
    test_api_endpoint()
    
    print("\n🎉 All tests completed!")
    print("\nNext steps:")
    print("1. Start your Flask server: python backend/app.py")
    print("2. Test checkout flow with shipping calculation")
    print("3. Verify customers are charged for both products and shipping")
