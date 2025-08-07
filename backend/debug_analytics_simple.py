#!/usr/bin/env python3
"""
Simple debug script to test analytics endpoint.
"""

import requests
import json

def test_analytics():
    """Test the analytics endpoint"""
    
    print("🚀 Testing analytics endpoint...")
    
    try:
        # Test the analytics endpoint
        response = requests.get("https://backend-hidden-firefly-7865.fly.dev/api/analytics")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Analytics endpoint response:")
            print(json.dumps(data, indent=2))
        else:
            print(f"❌ Analytics endpoint failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing analytics endpoint: {str(e)}")
        return False
    
    return True

if __name__ == "__main__":
    print("🚀 Testing analytics endpoint...")
    success = test_analytics()
    
    if success:
        print("\n🎉 Analytics endpoint test completed!")
    else:
        print("\n💥 Analytics endpoint test failed!")
        exit(1) 