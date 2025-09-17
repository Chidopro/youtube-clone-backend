#!/usr/bin/env python3
"""
Auto Print Quality Generator
===========================

This script automatically generates print-quality images for orders.
It can be run manually or integrated into your workflow.

Usage:
    python auto_print_quality.py --order-id ORDER_ID
    python auto_print_quality.py --all-pending
"""

import requests
import json
import base64
import argparse
import os
from datetime import datetime

# Configuration
BACKEND_URL = "https://backend-hidden-firefly-7865.fly.dev"  # Your backend URL
PRINT_QUALITY_ENDPOINT = f"{BACKEND_URL}/api/capture-print-quality"
ORDERS_ENDPOINT = f"{BACKEND_URL}/admin/orders"

def get_order_details(order_id):
    """Get order details from the backend"""
    try:
        response = requests.get(f"{BACKEND_URL}/admin/order/{order_id}")
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ Failed to get order details: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Error getting order details: {str(e)}")
        return None

def generate_print_quality_image(video_url, timestamp=0, crop_area=None, output_dir="print_quality"):
    """Generate a print-quality image"""
    try:
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        payload = {
            "video_url": video_url,
            "timestamp": timestamp,
            "print_dpi": 300
        }
        
        if crop_area:
            payload["crop_area"] = crop_area
        
        print(f"🎬 Generating print quality image...")
        print(f"   Video: {video_url}")
        print(f"   Timestamp: {timestamp}s")
        
        response = requests.post(PRINT_QUALITY_ENDPOINT, json=payload, timeout=120)
        
        if response.status_code == 200:
            result = response.json()
            
            if result['success']:
                # Save the image
                timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"print_quality_{timestamp_str}.png"
                filepath = os.path.join(output_dir, filename)
                
                # Extract base64 data
                base64_data = result['screenshot'].split(',')[1]
                image_data = base64.b64decode(base64_data)
                
                with open(filepath, 'wb') as f:
                    f.write(image_data)
                
                print(f"✅ Print quality image saved: {filepath}")
                print(f"   Dimensions: {result['dimensions']['width']}x{result['dimensions']['height']}")
                print(f"   File size: {result['file_size']:,} bytes ({result['file_size']/1024/1024:.1f} MB)")
                print(f"   DPI: {result['dimensions']['dpi']}")
                
                return filepath
            else:
                print(f"❌ Failed to generate print quality image: {result['error']}")
                return None
        else:
            print(f"❌ HTTP error: {response.status_code}")
            return None
            
    except requests.exceptions.Timeout:
        print("⏰ Timeout: Print quality generation took too long")
        return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None

def process_order(order_id):
    """Process a single order and generate print quality images"""
    print(f"🛍️ Processing Order: {order_id}")
    print("=" * 50)
    
    # Get order details
    order_data = get_order_details(order_id)
    if not order_data:
        return False
    
    cart = order_data.get('cart', [])
    if not cart:
        print("❌ No items in cart")
        return False
    
    print(f"📦 Found {len(cart)} items in order")
    
    # Create order-specific directory
    order_dir = f"print_quality/order_{order_id}"
    os.makedirs(order_dir, exist_ok=True)
    
    generated_images = []
    
    for i, item in enumerate(cart):
        print(f"\n📸 Processing item {i+1}/{len(cart)}")
        print(f"   Product: {item.get('product', 'Unknown')}")
        
        # Extract screenshot info
        screenshot_url = item.get('img', '')
        if not screenshot_url:
            print("   ⚠️ No screenshot found, skipping")
            continue
        
        # For now, we'll use a placeholder video URL
        # In a real implementation, you'd extract this from the order data
        video_url = "https://example.com/video.mp4"  # Replace with actual video URL
        
        # Generate print quality image
        image_path = generate_print_quality_image(
            video_url=video_url,
            timestamp=0,  # You might want to extract this from the screenshot
            output_dir=order_dir
        )
        
        if image_path:
            generated_images.append({
                'item_index': i,
                'product': item.get('product', 'Unknown'),
                'image_path': image_path
            })
    
    print(f"\n🎉 Order processing complete!")
    print(f"✅ Generated {len(generated_images)} print quality images")
    print(f"📁 Images saved in: {order_dir}")
    
    # Create a summary file
    summary_path = os.path.join(order_dir, "summary.json")
    with open(summary_path, 'w') as f:
        json.dump({
            'order_id': order_id,
            'processed_at': datetime.now().isoformat(),
            'total_items': len(cart),
            'generated_images': len(generated_images),
            'images': generated_images
        }, f, indent=2)
    
    print(f"📋 Summary saved: {summary_path}")
    return True

def process_all_pending_orders():
    """Process all pending orders"""
    print("🔄 Processing all pending orders...")
    
    # This would need to be implemented based on your order system
    # For now, this is a placeholder
    print("⚠️ Auto-processing all orders not yet implemented")
    print("   Use --order-id to process specific orders")

def main():
    parser = argparse.ArgumentParser(description='Generate print quality images for orders')
    parser.add_argument('--order-id', help='Process specific order ID')
    parser.add_argument('--all-pending', action='store_true', help='Process all pending orders')
    
    args = parser.parse_args()
    
    if args.order_id:
        success = process_order(args.order_id)
        if success:
            print("\n🚀 Ready for Printify upload!")
        else:
            print("\n❌ Order processing failed")
    elif args.all_pending:
        process_all_pending_orders()
    else:
        print("❌ Please specify --order-id or --all-pending")
        print("Example: python auto_print_quality.py --order-id abc123")

if __name__ == "__main__":
    main()
