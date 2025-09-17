#!/usr/bin/env python3
"""
Test the new thumbnail processing endpoint
"""
import requests
import json
import base64

def test_thumbnail_endpoint():
    print("🧪 Testing new thumbnail processing endpoint...")
    
    # Create a test thumbnail image (10x10 pixel PNG)
    import io
    from PIL import Image
    
    try:
        # Create a simple test thumbnail
        img = Image.new('RGB', (10, 10), color='blue')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        # Convert to base64
        test_thumbnail_data = base64.b64encode(img_bytes.getvalue()).decode('utf-8')
        
        # Test the new thumbnail endpoint
        thumbnail_data = {
            'thumbnail_data': test_thumbnail_data,
            'print_dpi': 300,
            'crop_area': None
        }
        
        print("1️⃣ Testing thumbnail processing endpoint...")
        response = requests.post('https://copy5-backend.fly.dev/api/process-thumbnail-print-quality', 
                               json=thumbnail_data)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ Thumbnail processing working!")
                print(f"   Original size: 10x10")
                print(f"   Enhanced dimensions: {result.get('dimensions', {})}")
                print(f"   File size: {result.get('file_size', 0):,} bytes")
                print(f"   DPI: {result.get('dpi', 'unknown')}")
                return True
            else:
                print(f"❌ Thumbnail processing failed: {result.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ Thumbnail endpoint error: {response.status_code}")
            print(f"   Response: {response.text[:300]}...")
            return False
            
    except Exception as e:
        print(f"❌ Thumbnail processing error: {e}")
        return False

def test_thumbnail_vs_screenshot():
    print("\n2️⃣ Testing thumbnail vs screenshot endpoints...")
    
    # Create the same test image
    import io
    from PIL import Image
    
    try:
        img = Image.new('RGB', (10, 10), color='green')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        test_image_data = base64.b64encode(img_bytes.getvalue()).decode('utf-8')
        
        # Test both endpoints with the same data
        test_data = {
            'print_dpi': 300,
            'crop_area': None
        }
        
        # Test screenshot endpoint
        screenshot_data = test_data.copy()
        screenshot_data['screenshot_data'] = test_image_data
        
        print("   Testing screenshot endpoint...")
        response1 = requests.post('https://copy5-backend.fly.dev/api/process-order-screenshot-print-quality', 
                                json=screenshot_data)
        print(f"   Screenshot status: {response1.status_code}")
        
        # Test thumbnail endpoint
        thumbnail_data = test_data.copy()
        thumbnail_data['thumbnail_data'] = test_image_data
        
        print("   Testing thumbnail endpoint...")
        response2 = requests.post('https://copy5-backend.fly.dev/api/process-thumbnail-print-quality', 
                                json=thumbnail_data)
        print(f"   Thumbnail status: {response2.status_code}")
        
        if response1.status_code == 200 and response2.status_code == 200:
            print("✅ Both endpoints working!")
            return True
        else:
            print("❌ One or both endpoints failed")
            return False
            
    except Exception as e:
        print(f"❌ Comparison test error: {e}")
        return False

if __name__ == "__main__":
    print("🎯 Testing Thumbnail Processing Endpoint...")
    
    success1 = test_thumbnail_endpoint()
    success2 = test_thumbnail_vs_screenshot()
    
    if success1 and success2:
        print("\n🎉 Thumbnail processing is working perfectly!")
        print("   ✅ New endpoint: /api/process-thumbnail-print-quality")
        print("   ✅ Thumbnails can now be processed for print quality")
    else:
        print("\n❌ Thumbnail processing has issues")
