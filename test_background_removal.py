#!/usr/bin/env python3
"""
Test Background Removal Functionality
"""

import requests
import base64
import io
from PIL import Image, ImageDraw
import json

def create_test_image():
    """Create a test image with white background"""
    # Create a simple test image
    img = Image.new('RGB', (400, 300), color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw a colored circle
    draw.ellipse([50, 50, 200, 200], fill='red', outline='black', width=3)
    
    # Draw some text
    draw.text((250, 100), "TEST IMAGE", fill='blue')
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{image_data}"

def test_background_removal():
    """Test the background removal API"""
    print("🧪 Testing Background Removal API...")
    
    # Create test image
    test_image = create_test_image()
    print("✅ Test image created")
    
    # Test different methods
    methods = ["adaptive", "threshold", "color_range", "edge_detection"]
    
    for method in methods:
        print(f"\n🔍 Testing method: {method}")
        
        try:
            # Test background removal
            response = requests.post('http://localhost:5000/api/image/remove-background', 
                                  json={
                                      'image_data': test_image,
                                      'method': method,
                                      'feather_edges': True
                                  })
            
            if response.status_code == 200:
                result = response.json()
                if result['success']:
                    print(f"✅ {method} method: SUCCESS")
                    
                    # Save result for inspection
                    result_data = result['image_data'].split(',')[1]
                    result_bytes = base64.b64decode(result_data)
                    
                    with open(f'test_result_{method}.png', 'wb') as f:
                        f.write(result_bytes)
                    print(f"   💾 Saved as: test_result_{method}.png")
                else:
                    print(f"❌ {method} method: {result.get('error', 'Unknown error')}")
            else:
                print(f"❌ {method} method: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"❌ {method} method: Exception - {str(e)}")

def test_enhancement():
    """Test the enhancement API"""
    print("\n🎨 Testing Enhancement API...")
    
    # Create test image
    test_image = create_test_image()
    
    try:
        # First remove background
        response = requests.post('http://localhost:5000/api/image/remove-background', 
                              json={
                                  'image_data': test_image,
                                  'method': 'adaptive',
                                  'feather_edges': True
                              })
        
        if response.status_code == 200:
            result = response.json()
            if result['success']:
                # Now enhance it
                enhance_response = requests.post('http://localhost:5000/api/image/enhance-transparency', 
                                              json={
                                                  'image_data': result['image_data'],
                                                  'contrast_boost': 1.3,
                                                  'saturation_boost': 1.2
                                              })
                
                if enhance_response.status_code == 200:
                    enhance_result = enhance_response.json()
                    if enhance_result['success']:
                        print("✅ Enhancement: SUCCESS")
                        
                        # Save enhanced result
                        result_data = enhance_result['image_data'].split(',')[1]
                        result_bytes = base64.b64decode(result_data)
                        
                        with open('test_enhanced.png', 'wb') as f:
                            f.write(result_bytes)
                        print("   💾 Saved as: test_enhanced.png")
                    else:
                        print(f"❌ Enhancement: {enhance_result.get('error', 'Unknown error')}")
                else:
                    print(f"❌ Enhancement: HTTP {enhance_response.status_code}")
            else:
                print("❌ Enhancement: Background removal failed first")
        else:
            print("❌ Enhancement: Background removal HTTP error")
            
    except Exception as e:
        print(f"❌ Enhancement: Exception - {str(e)}")

def test_batch_processing():
    """Test batch processing"""
    print("\n📦 Testing Batch Processing...")
    
    # Create multiple test images
    test_images = [create_test_image() for _ in range(3)]
    
    try:
        response = requests.post('http://localhost:5000/api/image/batch-remove-backgrounds', 
                              json={
                                  'image_data_list': test_images,
                                  'method': 'adaptive'
                              })
        
        if response.status_code == 200:
            result = response.json()
            if result['success']:
                print(f"✅ Batch processing: SUCCESS - {len(result['results'])} images processed")
                
                # Save results
                for i, img_result in enumerate(result['results']):
                    if img_result['success']:
                        result_data = img_result['image_data'].split(',')[1]
                        result_bytes = base64.b64decode(result_data)
                        
                        with open(f'batch_result_{i}.png', 'wb') as f:
                            f.write(result_bytes)
                        print(f"   💾 Saved as: batch_result_{i}.png")
                    else:
                        print(f"   ❌ Image {i}: {img_result.get('error', 'Unknown error')}")
            else:
                print(f"❌ Batch processing: {result.get('error', 'Unknown error')}")
        else:
            print(f"❌ Batch processing: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ Batch processing: Exception - {str(e)}")

def test_methods_info():
    """Test getting available methods"""
    print("\n📋 Testing Methods Info...")
    
    try:
        response = requests.get('http://localhost:5000/api/image/background-removal-methods')
        
        if response.status_code == 200:
            result = response.json()
            if result['success']:
                print("✅ Methods info: SUCCESS")
                print("   Available methods:")
                for method, description in result['methods'].items():
                    print(f"     - {method}: {description}")
                print(f"   Default method: {result['default_method']}")
            else:
                print(f"❌ Methods info: {result.get('error', 'Unknown error')}")
        else:
            print(f"❌ Methods info: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ Methods info: Exception - {str(e)}")

if __name__ == "__main__":
    print("🚀 Starting Background Removal Tests")
    print("=" * 50)
    
    # Test methods info first
    test_methods_info()
    
    # Test individual background removal
    test_background_removal()
    
    # Test enhancement
    test_enhancement()
    
    # Test batch processing
    test_batch_processing()
    
    print("\n" + "=" * 50)
    print("🏁 Tests completed!")
    print("\nCheck the generated PNG files to see the results:")
    print("- test_result_*.png - Different method results")
    print("- test_enhanced.png - Enhanced transparent image")
    print("- batch_result_*.png - Batch processing results")
