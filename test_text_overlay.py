#!/usr/bin/env python3
"""
Test script for Image Text Overlay functionality
Demonstrates various text overlay features and effects
"""

import requests
import json
import base64
from PIL import Image, ImageDraw
import io

def create_test_image():
    """Create a simple test image"""
    # Create a 400x300 test image with gradient
    width, height = 400, 300
    image = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(image)
    
    # Create a gradient background
    for y in range(height):
        r = int(255 * (1 - y / height))
        g = int(128 * (y / height))
        b = int(255 * (y / height))
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    # Convert to base64
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)
    
    result_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{result_data}"

def test_single_text_overlay():
    """Test single text overlay with different styles"""
    print("🎨 Testing Single Text Overlay...")
    
    # Create test image
    test_image = create_test_image()
    
    # Test different styles
    styles = ["modern", "vintage", "bold", "elegant", "fun", "minimal"]
    
    for style in styles:
        print(f"\n📝 Testing '{style}' style...")
        
        payload = {
            "image_data": test_image,
            "text": f"Hello World - {style.title()}",
            "style": style,
            "position": "center"
        }
        
        try:
            response = requests.post(
                "http://localhost:5000/api/image/add-text-overlay",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    print(f"✅ {style.title()} style applied successfully!")
                else:
                    print(f"❌ {style.title()} style failed: {result.get('error')}")
            else:
                print(f"❌ HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ Error testing {style} style: {str(e)}")

def test_multiple_text_overlays():
    """Test multiple text overlays on the same image"""
    print("\n🎨 Testing Multiple Text Overlays...")
    
    # Create test image
    test_image = create_test_image()
    
    # Define multiple text elements
    text_elements = [
        {
            "text": "TOP TEXT",
            "position": "top",
            "style": "bold",
            "font_size": 36,
            "font_color": [255, 255, 255],
            "stroke_color": [0, 0, 0],
            "stroke_width": 3
        },
        {
            "text": "BOTTOM TEXT",
            "position": "bottom",
            "style": "modern",
            "font_size": 32,
            "font_color": [255, 215, 0],  # Gold
            "stroke_color": [139, 69, 19],  # Brown
            "stroke_width": 2
        },
        {
            "text": "CENTER",
            "position": "center",
            "style": "elegant",
            "font_size": 48,
            "font_color": [255, 255, 255],
            "stroke_color": [105, 105, 105],
            "stroke_width": 1,
            "glow": True
        }
    ]
    
    payload = {
        "image_data": test_image,
        "text_elements": text_elements
    }
    
    try:
        response = requests.post(
            "http://localhost:5000/api/image/add-multiple-text-overlays",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                print("✅ Multiple text overlays applied successfully!")
                print(f"📊 Added {len(text_elements)} text elements")
            else:
                print(f"❌ Multiple overlays failed: {result.get('error')}")
        else:
            print(f"❌ HTTP {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing multiple overlays: {str(e)}")

def test_advanced_effects():
    """Test advanced effects like rotation, shadow, glow, and background"""
    print("\n🎨 Testing Advanced Effects...")
    
    # Create test image
    test_image = create_test_image()
    
    # Test different effects
    effects_tests = [
        {
            "name": "Rotated Text",
            "payload": {
                "image_data": test_image,
                "text": "ROTATED TEXT",
                "style": "bold",
                "position": "center",
                "rotation": 15,
                "font_size": 40
            }
        },
        {
            "name": "Shadow Effect",
            "payload": {
                "image_data": test_image,
                "text": "SHADOW TEXT",
                "style": "modern",
                "position": "center",
                "shadow": True,
                "font_size": 44
            }
        },
        {
            "name": "Glow Effect",
            "payload": {
                "image_data": test_image,
                "text": "GLOW TEXT",
                "style": "elegant",
                "position": "center",
                "glow": True,
                "font_size": 42
            }
        },
        {
            "name": "Background Effect",
            "payload": {
                "image_data": test_image,
                "text": "BACKGROUND TEXT",
                "style": "minimal",
                "position": "center",
                "background": True,
                "background_color": [0, 0, 0],
                "background_opacity": 0.7,
                "font_size": 38
            }
        }
    ]
    
    for test in effects_tests:
        print(f"\n📝 Testing {test['name']}...")
        
        try:
            response = requests.post(
                "http://localhost:5000/api/image/add-text-overlay",
                json=test["payload"],
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    print(f"✅ {test['name']} applied successfully!")
                else:
                    print(f"❌ {test['name']} failed: {result.get('error')}")
            else:
                print(f"❌ HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ Error testing {test['name']}: {str(e)}")

def test_text_styles_api():
    """Test the text styles API endpoint"""
    print("\n🎨 Testing Text Styles API...")
    
    try:
        response = requests.get("http://localhost:5000/api/image/text-styles")
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                styles = result.get("styles", {})
                print("✅ Text styles retrieved successfully!")
                print(f"📊 Available styles: {styles.get('available_styles', [])}")
                print(f"📊 Available positions: {styles.get('positions', [])}")
                print(f"📊 Available effects: {styles.get('effects', [])}")
            else:
                print(f"❌ Text styles failed: {result.get('error')}")
        else:
            print(f"❌ HTTP {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing text styles API: {str(e)}")

def test_preview_functionality():
    """Test the preview functionality"""
    print("\n🎨 Testing Preview Functionality...")
    
    payload = {
        "text": "PREVIEW TEXT",
        "style": "fun",
        "position": "center"
    }
    
    try:
        response = requests.post(
            "http://localhost:5000/api/image/preview-text-overlay",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                print("✅ Preview generated successfully!")
                print(f"📊 Style config: {result.get('style_config', {})}")
            else:
                print(f"❌ Preview failed: {result.get('error')}")
        else:
            print(f"❌ HTTP {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing preview: {str(e)}")

def main():
    """Run all tests"""
    print("🚀 Starting Image Text Overlay Tests...")
    print("=" * 50)
    
    # Test basic functionality
    test_text_styles_api()
    test_preview_functionality()
    test_single_text_overlay()
    test_multiple_text_overlays()
    test_advanced_effects()
    
    print("\n" + "=" * 50)
    print("✅ All tests completed!")
    print("\n💡 To view the interactive demo, visit: http://localhost:5000/text-overlay-demo")

if __name__ == "__main__":
    main() 