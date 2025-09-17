#!/usr/bin/env python3
"""
Test the thumbnail tool after fixing the endpoint
"""
import requests
import json
import base64

def test_thumbnail_tool():
    print("🧪 Testing thumbnail tool after endpoint fix...")
    
    # Create a test thumbnail image
    import io
    from PIL import Image
    
    try:
        # Create a test thumbnail (similar to what would come from an order)
        img = Image.new('RGB', (20, 20), color='purple')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        # Convert to base64 (this simulates what the frontend sends)
        test_thumbnail_data = base64.b64encode(img_bytes.getvalue()).decode('utf-8')
        
        # Test the thumbnail endpoint with the correct parameter name
        thumbnail_data = {
            'thumbnail_data': test_thumbnail_data,  # This is the key fix!
            'print_dpi': 300,
            'crop_area': None
        }
        
        print("1️⃣ Testing thumbnail endpoint with correct parameters...")
        response = requests.post('https://copy5-backend.fly.dev/api/process-thumbnail-print-quality', 
                               json=thumbnail_data)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ Thumbnail processing working!")
                print(f"   Original size: 20x20")
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

def test_old_endpoint_still_works():
    print("\n2️⃣ Testing that old screenshot endpoint still works...")
    
    # Create a test image
    import io
    from PIL import Image
    
    try:
        img = Image.new('RGB', (15, 15), color='orange')
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
        
        print(f"Old screenshot endpoint status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ Old screenshot endpoint still working!")
                return True
            else:
                print(f"❌ Old screenshot endpoint failed: {result.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ Old screenshot endpoint error: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Old endpoint test error: {e}")
        return False

if __name__ == "__main__":
    print("🎯 Testing Thumbnail Tool After Fix...")
    
    success1 = test_thumbnail_tool()
    success2 = test_old_endpoint_still_works()
    
    if success1 and success2:
        print("\n🎉 Both endpoints working perfectly!")
        print("   ✅ New thumbnail endpoint: /api/process-thumbnail-print-quality")
        print("   ✅ Old screenshot endpoint: /api/process-order-screenshot-print-quality")
        print("   ✅ Cache issue resolved!")
    else:
        print("\n❌ Some endpoints still have issues")
