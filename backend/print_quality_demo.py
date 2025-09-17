#!/usr/bin/env python3
"""
Print Quality Screenshot Demo
============================

This script demonstrates how to use the new print-quality screenshot capture
for getting the highest quality images for Printify/print production.

Usage:
    python print_quality_demo.py

Features:
- Captures screenshots at 300 DPI (professional print quality)
- Scales up images to meet minimum print requirements (2400x3000 pixels)
- Uses PNG format for lossless quality
- Supports cropping for specific areas
- Returns detailed metadata about dimensions and file size
"""

import requests
import json
import base64
from datetime import datetime

# Configuration
BACKEND_URL = "https://your-backend-url.fly.dev"  # Replace with your actual backend URL
API_ENDPOINT = f"{BACKEND_URL}/api/capture-print-quality"

def capture_print_quality_screenshot(video_url, timestamp=0, crop_area=None, print_dpi=300):
    """
    Capture a high-quality screenshot optimized for print production
    
    Args:
        video_url (str): URL of the video to capture from
        timestamp (float): Timestamp in seconds (default: 0 for first frame)
        crop_area (dict): Optional crop area with x, y, width, height (normalized 0-1)
        print_dpi (int): DPI for print quality (default: 300)
    
    Returns:
        dict: Response with screenshot data and metadata
    """
    
    payload = {
        "video_url": video_url,
        "timestamp": timestamp,
        "print_dpi": print_dpi
    }
    
    if crop_area:
        payload["crop_area"] = crop_area
    
    try:
        print(f"🎬 Capturing print quality screenshot from: {video_url}")
        print(f"⏰ Timestamp: {timestamp}s")
        print(f"🖨️  Print DPI: {print_dpi}")
        if crop_area:
            print(f"✂️  Crop area: {crop_area}")
        print()
        
        response = requests.post(API_ENDPOINT, json=payload, timeout=120)
        
        if response.status_code == 200:
            result = response.json()
            
            if result['success']:
                print("✅ SUCCESS! Print quality screenshot captured")
                print(f"📐 Dimensions: {result['dimensions']['width']}x{result['dimensions']['height']} pixels")
                print(f"📊 File size: {result['file_size']:,} bytes ({result['file_size']/1024/1024:.1f} MB)")
                print(f"🎨 Format: {result['format']}")
                print(f"⭐ Quality: {result['quality']}")
                print(f"🖨️  DPI: {result['dimensions']['dpi']}")
                
                # Save the image to a file
                timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"print_quality_screenshot_{timestamp_str}.png"
                
                # Extract base64 data
                base64_data = result['screenshot'].split(',')[1]
                image_data = base64.b64decode(base64_data)
                
                with open(filename, 'wb') as f:
                    f.write(image_data)
                
                print(f"💾 Saved to: {filename}")
                print()
                print("🚀 This image is ready for Printify upload!")
                print("   - High resolution (300 DPI)")
                print("   - Lossless PNG format")
                print("   - Professional print quality")
                
                return result
            else:
                print(f"❌ ERROR: {result['error']}")
                return None
        else:
            print(f"❌ HTTP ERROR: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except requests.exceptions.Timeout:
        print("⏰ TIMEOUT: Screenshot capture took too long (>120s)")
        return None
    except Exception as e:
        print(f"❌ EXCEPTION: {str(e)}")
        return None

def demo_print_quality_capture():
    """Demo function showing different print quality capture scenarios"""
    
    print("🖨️  PRINT QUALITY SCREENSHOT DEMO")
    print("=" * 50)
    print()
    
    # Example video URL (replace with your actual video)
    video_url = "https://example.com/your-video.mp4"
    
    print("📝 NOTE: Replace 'video_url' with your actual video URL")
    print()
    
    # Scenario 1: Full frame capture
    print("📸 SCENARIO 1: Full Frame Capture")
    print("-" * 30)
    result1 = capture_print_quality_screenshot(
        video_url=video_url,
        timestamp=5.0,  # 5 seconds into video
        print_dpi=300
    )
    
    if result1:
        print("✅ Full frame capture successful!")
    print()
    
    # Scenario 2: Cropped capture (center area)
    print("✂️  SCENARIO 2: Cropped Capture (Center Area)")
    print("-" * 40)
    crop_area = {
        "x": 0.25,      # Start at 25% from left
        "y": 0.25,      # Start at 25% from top
        "width": 0.5,   # 50% width
        "height": 0.5   # 50% height
    }
    
    result2 = capture_print_quality_screenshot(
        video_url=video_url,
        timestamp=10.0,  # 10 seconds into video
        crop_area=crop_area,
        print_dpi=300
    )
    
    if result2:
        print("✅ Cropped capture successful!")
    print()
    
    # Scenario 3: High DPI capture
    print("🔍 SCENARIO 3: Ultra High DPI Capture")
    print("-" * 35)
    result3 = capture_print_quality_screenshot(
        video_url=video_url,
        timestamp=15.0,  # 15 seconds into video
        print_dpi=600    # Ultra high DPI
    )
    
    if result3:
        print("✅ Ultra high DPI capture successful!")
    print()
    
    print("🎉 DEMO COMPLETE!")
    print()
    print("📋 NEXT STEPS:")
    print("1. Use the captured PNG files for Printify uploads")
    print("2. Images are optimized for professional print quality")
    print("3. All images meet minimum print requirements (300+ DPI)")
    print("4. PNG format ensures lossless quality")

if __name__ == "__main__":
    demo_print_quality_capture()
