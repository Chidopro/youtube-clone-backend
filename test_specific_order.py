#!/usr/bin/env python3
"""
Test the specific order that's failing
"""
import requests
import json

def test_specific_order():
    print("🧪 Testing the specific order that's failing...")
    
    # The order ID from the error message
    order_id = "eed28374-d53d-4f32-844e-9646353ba669"
    
    try:
        # Get the order screenshot
        print(f"1️⃣ Getting screenshot for order: {order_id}")
        response = requests.get(f'https://copy5-backend.fly.dev/api/get-order-screenshot/{order_id}')
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                screenshot_data = result.get('screenshot', '')
                print(f"✅ Screenshot retrieved successfully")
                print(f"   Screenshot data length: {len(screenshot_data)}")
                print(f"   Screenshot data type: {type(screenshot_data)}")
                print(f"   Screenshot starts with: {screenshot_data[:50]}...")
                
                # Check if it's base64 data
                if screenshot_data.startswith('data:image'):
                    print("✅ Screenshot is in data URL format")
                elif screenshot_data.startswith('iVBORw0KGgo'):
                    print("✅ Screenshot is in base64 format")
                else:
                    print("❌ Screenshot format unknown")
                
                # Now test processing this specific screenshot
                print("\n2️⃣ Testing processing of this specific screenshot...")
                
                thumbnail_data = {
                    'thumbnail_data': screenshot_data,
                    'print_dpi': 300,
                    'crop_area': None
                }
                
                response2 = requests.post('https://copy5-backend.fly.dev/api/process-thumbnail-print-quality', 
                                        json=thumbnail_data)
                
                print(f"Processing status: {response2.status_code}")
                
                if response2.status_code == 200:
                    result2 = response2.json()
                    if result2.get('success'):
                        print("✅ Screenshot processing successful!")
                        return True
                    else:
                        print(f"❌ Screenshot processing failed: {result2.get('error', 'Unknown error')}")
                        return False
                else:
                    print(f"❌ Screenshot processing error: {response2.status_code}")
                    print(f"   Response: {response2.text[:300]}...")
                    return False
                    
            else:
                print(f"❌ Failed to get screenshot: {result.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ Failed to get order screenshot: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing specific order: {e}")
        return False

if __name__ == "__main__":
    print("🎯 Testing Specific Order Screenshot...")
    
    success = test_specific_order()
    
    if success:
        print("\n🎉 The specific order screenshot is working!")
    else:
        print("\n❌ The specific order screenshot has issues")
        print("   This explains why the image enhancement tool is failing")
