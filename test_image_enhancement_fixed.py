#!/usr/bin/env python3
"""
Test image enhancement tool with correct endpoint
"""
import requests
import json
import base64

def test_image_enhancement():
    print("🧪 Testing image enhancement tool with correct endpoint...")
    
    # Create a simple test image (1x1 pixel PNG)
    test_image_data = base64.b64encode(
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
    ).decode('utf-8')
    
    try:
        # Test the correct endpoint
        enhancement_data = {
            'screenshot_data': test_image_data,
            'print_dpi': 300,
            'crop_area': None
        }
        
        print("1️⃣ Testing image enhancement endpoint...")
        response = requests.post('https://copy5-backend.fly.dev/api/process-order-screenshot-print-quality', 
                               json=enhancement_data)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ Image enhancement tool working!")
                print(f"   Enhanced image size: {len(result.get('enhanced_image', ''))}")
                print(f"   Dimensions: {result.get('dimensions', {})}")
                print(f"   File size: {result.get('file_size', 0):,} bytes")
                return True
            else:
                print(f"❌ Image enhancement failed: {result.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ Image enhancement endpoint error: {response.status_code}")
            print(f"   Response: {response.text[:300]}...")
            return False
            
    except Exception as e:
        print(f"❌ Image enhancement error: {e}")
        return False

def test_thumbnail_enhancement():
    print("\n2️⃣ Testing thumbnail enhancement (simulating real use case)...")
    
    # Create a larger test image (10x10 pixel PNG) to simulate a thumbnail
    import io
    from PIL import Image
    
    try:
        # Create a simple test image
        img = Image.new('RGB', (10, 10), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        # Convert to base64
        test_image_data = base64.b64encode(img_bytes.getvalue()).decode('utf-8')
        
        # Test enhancement
        enhancement_data = {
            'screenshot_data': test_image_data,
            'print_dpi': 300,
            'crop_area': None
        }
        
        response = requests.post('https://copy5-backend.fly.dev/api/process-order-screenshot-print-quality', 
                               json=enhancement_data)
        
        print(f"Thumbnail enhancement status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ Thumbnail enhancement working!")
                print(f"   Original size: 10x10")
                print(f"   Enhanced dimensions: {result.get('dimensions', {})}")
                print(f"   File size: {result.get('file_size', 0):,} bytes")
                return True
            else:
                print(f"❌ Thumbnail enhancement failed: {result.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ Thumbnail enhancement error: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Thumbnail enhancement error: {e}")
        return False

if __name__ == "__main__":
    print("🎯 Testing Image Enhancement Tool...")
    
    success1 = test_image_enhancement()
    success2 = test_thumbnail_enhancement()
    
    if success1 and success2:
        print("\n🎉 Image enhancement tool is working perfectly!")
    else:
        print("\n❌ Image enhancement tool has issues")
