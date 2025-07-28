#!/usr/bin/env python3
"""
Test script to simulate order processing and email sending
"""

import requests
import json
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from backend folder
backend_env_path = Path(__file__).parent / "backend" / ".env"
if backend_env_path.exists():
    load_dotenv(dotenv_path=backend_env_path)
    print(f"✅ Loaded .env from: {backend_env_path}")

def test_order_email():
    """Test the order email endpoint directly"""
    print("🔍 Testing order email endpoint...")
    
    # Test order data
    test_order = {
        "cart": [
            {
                "product": "Test Product",
                "variants": {"color": "Black", "size": "M"},
                "note": "Test order",
                "img": "https://example.com/test-image.jpg"
            }
        ]
    }
    
    try:
        response = requests.post(
            "https://backend-hidden-firefly-7865.fly.dev/send-order",
            json=test_order,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Order email test successful!")
        else:
            print("❌ Order email test failed!")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def test_webhook_simulation():
    """Simulate webhook processing"""
    print("\n🔍 Testing webhook simulation...")
    
    # Simulate webhook data
    webhook_data = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_123",
                "metadata": {"order_id": "test_order_123"},
                "customer_details": {"phone": "+1234567890"}
            }
        }
    }
    
    try:
        response = requests.post(
            "https://backend-hidden-firefly-7865.fly.dev/webhook",
            json=webhook_data,
            headers={
                "Content-Type": "application/json",
                "stripe-signature": "t=1234567890,v1=test_signature"
            }
        )
        
        print(f"Webhook Status: {response.status_code}")
        print(f"Webhook Response: {response.text[:200]}...")
        
    except Exception as e:
        print(f"❌ Webhook test error: {str(e)}")

def main():
    print("🚀 Order Email Debug Test")
    print("=" * 50)
    
    # Test 1: Direct order email
    test_order_email()
    
    # Test 2: Webhook simulation
    test_webhook_simulation()
    
    print("\n" + "=" * 50)
    print("💡 If emails are intermittent, check:")
    print("1. Stripe webhook configuration")
    print("2. Webhook secret matching")
    print("3. Order store data persistence")
    print("4. Network connectivity to Resend API")

if __name__ == "__main__":
    main() 