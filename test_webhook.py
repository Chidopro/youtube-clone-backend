#!/usr/bin/env python3
"""
Test script to simulate a Stripe webhook event
"""

import requests
import json
import hmac
import hashlib
import time

def test_webhook():
    """Test the webhook endpoint with a simulated Stripe event"""
    
    # Simulate a checkout.session.completed event
    webhook_payload = {
        "id": "evt_test_webhook",
        "object": "event",
        "api_version": "2020-08-27",
        "created": int(time.time()),
        "data": {
            "object": {
                "id": "cs_test_session",
                "object": "checkout.session",
                "customer_details": {
                    "phone": "+1234567890"
                },
                "metadata": {
                    "order_id": "test-order-456"
                }
            }
        },
        "type": "checkout.session.completed"
    }
    
    # Create a test signing secret (this won't match your real one, but we can test the endpoint)
    test_secret = "whsec_test_secret"
    
    # Create the signature
    timestamp = str(int(time.time()))
    payload = json.dumps(webhook_payload)
    signed_payload = f"{timestamp}.{payload}"
    signature = hmac.new(
        test_secret.encode('utf-8'),
        signed_payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    headers = {
        "Content-Type": "application/json",
        "Stripe-Signature": f"t={timestamp},v1={signature}"
    }
    
    try:
        print("🧪 Testing webhook endpoint...")
        response = requests.post(
            "https://backend-hidden-firefly-7865.fly.dev/webhook",
            json=webhook_payload,
            headers=headers
        )
        
        print(f"📊 Response Status: {response.status_code}")
        print(f"📄 Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Webhook endpoint is working!")
        else:
            print("❌ Webhook endpoint returned an error")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_webhook() 