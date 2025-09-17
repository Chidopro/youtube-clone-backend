#!/usr/bin/env python3
"""
Supabase Webhook Setup Script
This script helps set up a webhook in Supabase to automatically capture video metadata
when orders are created.
"""

import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def setup_supabase_webhook():
    """Set up Supabase webhook for order creation"""
    
    # Get Supabase credentials
    supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase credentials in .env file")
        return False
    
    # Extract project ID from URL
    project_id = supabase_url.split('//')[1].split('.')[0]
    print(f"🔍 Supabase Project ID: {project_id}")
    
    # Webhook configuration
    webhook_url = "https://copy5-backend.fly.dev/api/supabase-webhook"
    
    print(f"🔗 Setting up webhook: {webhook_url}")
    print("\n📋 Manual Setup Instructions:")
    print("=" * 50)
    print("1. Go to your Supabase Dashboard")
    print(f"   https://supabase.com/dashboard/project/{project_id}")
    print("\n2. Navigate to Database > Webhooks")
    print("\n3. Click 'Create a new hook'")
    print("\n4. Configure the webhook:")
    print(f"   - Name: Order Video Metadata Capture")
    print(f"   - Table: orders")
    print(f"   - Events: Insert")
    print(f"   - Type: HTTP Request")
    print(f"   - URL: {webhook_url}")
    print(f"   - HTTP Method: POST")
    print(f"   - HTTP Headers: Content-Type: application/json")
    print("\n5. Click 'Create hook'")
    print("\n6. Test the webhook by creating a new order")
    
    print("\n🔧 Alternative: SQL Setup (if webhook UI doesn't work)")
    print("=" * 50)
    print("Run this SQL in your Supabase SQL Editor:")
    print(f"""
CREATE OR REPLACE FUNCTION capture_video_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- This function will be called when a new order is inserted
    -- The webhook will handle the actual metadata extraction
    PERFORM net.http_post(
        url := '{webhook_url}',
        headers := '{{"Content-Type": "application/json"}}'::jsonb,
        body := json_build_object('record', row_to_json(NEW))::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS order_video_metadata_trigger ON orders;
CREATE TRIGGER order_video_metadata_trigger
    AFTER INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION capture_video_metadata();
""")
    
    print("\n✅ Webhook setup instructions complete!")
    print("\n📝 What this webhook does:")
    print("- Automatically captures video URL, creator name, and video title")
    print("- Updates the order record with this metadata")
    print("- Ensures admin order details show correct video information")
    
    return True

def test_webhook():
    """Test the webhook endpoint"""
    webhook_url = "https://copy5-backend.fly.dev/api/supabase-webhook"
    
    test_data = {
        "record": {
            "order_id": "test-order-123",
            "cart": [
                {
                    "img": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
                    "videoUrl": "https://example.com/video.mp4",
                    "videoTitle": "Test Video",
                    "creatorName": "Test Creator",
                    "timestamp": "120"
                }
            ]
        }
    }
    
    print(f"🧪 Testing webhook: {webhook_url}")
    
    try:
        response = requests.post(
            webhook_url,
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ Webhook test successful!")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ Webhook test failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Webhook test error: {str(e)}")

if __name__ == "__main__":
    print("🚀 Supabase Webhook Setup for Video Metadata Capture")
    print("=" * 60)
    
    if setup_supabase_webhook():
        print("\n" + "=" * 60)
        print("🧪 Would you like to test the webhook? (y/n): ", end="")
        
        # Uncomment the next lines to enable interactive testing
        # choice = input().lower().strip()
        # if choice == 'y':
        #     test_webhook()
        
        print("\n✅ Setup complete! Follow the instructions above to configure your webhook.")
