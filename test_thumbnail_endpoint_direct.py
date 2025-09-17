#!/usr/bin/env python3
"""
Test the thumbnail endpoint directly to see if it's working
"""
import requests
import json
import base64

def test_thumbnail_endpoint_direct():
    print("🧪 Testing thumbnail endpoint directly...")
    
    # Create a test image
    import io
    from PIL import Image
    
    try:
        # Create a test thumbnail
        img = Image.new('RGB', (20, 20), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        # Convert to base64
        test_thumbnail_data = base64.b64encode(img_bytes.getvalue()).decode('utf-8')
        
        # Test the thumbnail endpoint
        thumbnail_data = {
            'thumbnail_data': test_thumbnail_data,
            'print_dpi': 300,
            'crop_area': None
        }
        
        print("1️⃣ Testing thumbnail endpoint...")
        response = requests.post('https://copy5-backend.fly.dev/api/process-thumbnail-print-quality', 
                               json=thumbnail_data)
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ Thumbnail endpoint working!")
                return True
            else:
                print(f"❌ Thumbnail endpoint failed: {result.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ Thumbnail endpoint error: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Thumbnail endpoint error: {e}")
        return False

def test_old_endpoint_for_comparison():
    print("\n2️⃣ Testing old screenshot endpoint for comparison...")
    
    # Create a test image
    import io
    from PIL import Image
    
    try:
        img = Image.new('RGB', (20, 20), color='blue')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        test_image_data = base64.b64encode(img_bytes.getvalue()).decode('utf-8')
        
        # Test the old screenshot endpoint
        screenshot_data = {
            'screenshot_data': test_image_data,
            'print_dpi': 300,
            'crop_area': None
        }
        
        response = requests.post('https://copy5-backend.fly.dev/api/process-order-screenshot-print-quality', 
                               json=screenshot_data)
        
        print(f"Old endpoint status: {response.status_code}")
        print(f"Old endpoint response: {response.text[:200]}...")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ Old screenshot endpoint working!")
                return True
            else:
                print(f"❌ Old screenshot endpoint failed: {result.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ Old screenshot endpoint error: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Old endpoint error: {e}")
        return False

def check_frontend_cache():
    print("\n3️⃣ Checking if frontend is using cached version...")
    
    try:
        # Get the print quality page to see what endpoint it's actually calling
        response = requests.get('https://copy5-backend.fly.dev/print-quality?order_id=test')
        
        if response.status_code == 200:
            response_text = response.text
            
            # Check which endpoint is being called
            if '/api/process-thumbnail-print-quality' in response_text:
                print("✅ Frontend is calling the new thumbnail endpoint")
                return True
            elif '/api/process-order-screenshot-print-quality' in response_text:
                print("❌ Frontend is still calling the old screenshot endpoint")
                return False
            else:
                print("❓ Could not determine which endpoint frontend is calling")
                return False
        else:
            print(f"❌ Could not access print quality page: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Frontend cache check error: {e}")
        return False

if __name__ == "__main__":
    print("🎯 Testing Thumbnail Endpoint Issues...")
    
    success1 = test_thumbnail_endpoint_direct()
    success2 = test_old_endpoint_for_comparison()
    success3 = check_frontend_cache()
    
    print("\n📋 Summary:")
    if success1:
        print("✅ Thumbnail endpoint is working")
    else:
        print("❌ Thumbnail endpoint has issues")
        
    if success2:
        print("✅ Old screenshot endpoint is working")
    else:
        print("❌ Old screenshot endpoint has issues")
        
    if success3:
        print("✅ Frontend is using correct endpoint")
    else:
        print("❌ Frontend cache issue - still using old endpoint")
