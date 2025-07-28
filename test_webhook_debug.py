#!/usr/bin/env python3
"""
Webhook Debug Script for ScreenMerch
This script helps debug webhook issues by testing various scenarios.
"""

import requests
import json
import os
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from backend folder
backend_env_path = Path(__file__).parent / "backend" / ".env"
if backend_env_path.exists():
    load_dotenv(dotenv_path=backend_env_path)
    print(f"✅ Loaded .env from: {backend_env_path}")
else:
    # Fallback to current directory
    load_dotenv()
    print("⚠️ Backend .env not found, using current directory")

def test_webhook_endpoint():
    """Test if the webhook endpoint is accessible"""
    print("🔍 Testing webhook endpoint accessibility...")
    
    url = "https://backend-hidden-firefly-7865.fly.dev/webhook"
    
    try:
        # Test basic connectivity
        response = requests.post(url, json={"test": "ping"}, timeout=10)
        print(f"✅ Webhook endpoint is accessible (Status: {response.status_code})")
        print(f"Response: {response.text[:200]}...")
        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ Webhook endpoint is not accessible: {e}")
        return False

def test_webhook_with_stripe_signature():
    """Test webhook with a mock Stripe signature"""
    print("\n🔍 Testing webhook with Stripe signature...")
    
    url = "https://backend-hidden-firefly-7865.fly.dev/webhook"
    
    # Mock Stripe event data
    mock_event = {
        "id": "evt_test_123",
        "object": "event",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_123",
                "object": "checkout.session",
                "metadata": {
                    "order_id": "test_order_123"
                },
                "customer_details": {
                    "phone": "+1234567890"
                }
            }
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "stripe-signature": "t=1234567890,v1=invalid_signature_for_testing"
    }
    
    try:
        response = requests.post(url, json=mock_event, headers=headers, timeout=10)
        print(f"✅ Webhook responded (Status: {response.status_code})")
        print(f"Response: {response.text[:200]}...")
        
        if response.status_code == 400:
            print("ℹ️ Expected 400 error due to invalid signature - this is normal")
        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ Webhook test failed: {e}")
        return False

def check_environment_variables():
    """Check if required environment variables are set"""
    print("\n🔍 Checking environment variables...")
    
    required_vars = [
        "STRIPE_WEBHOOK_SECRET",
        "RESEND_API_KEY",
        "MAIL_TO",
        "RESEND_FROM"
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
            print(f"❌ Missing: {var}")
        else:
            print(f"✅ Found: {var}")
    
    if missing_vars:
        print(f"\n⚠️ Missing environment variables: {', '.join(missing_vars)}")
        return False
    else:
        print("\n✅ All required environment variables are set")
        return True

def test_stripe_webhook_events():
    """Test different Stripe webhook events"""
    print("\n🔍 Testing different webhook event types...")
    
    url = "https://backend-hidden-firefly-7865.fly.dev/webhook"
    
    # Test events that should be handled
    test_events = [
        {
            "type": "checkout.session.completed",
            "description": "Payment completed"
        },
        {
            "type": "payment_intent.succeeded", 
            "description": "Payment intent succeeded"
        },
        {
            "type": "invoice.payment_succeeded",
            "description": "Invoice payment succeeded"
        }
    ]
    
    for event in test_events:
        print(f"\nTesting event: {event['type']} ({event['description']})")
        
        mock_event = {
            "id": f"evt_test_{event['type']}",
            "object": "event",
            "type": event['type'],
            "data": {
                "object": {
                    "id": f"test_{event['type']}",
                    "object": "checkout.session" if "checkout" in event['type'] else "payment_intent"
                }
            }
        }
        
        headers = {
            "Content-Type": "application/json",
            "stripe-signature": "t=1234567890,v1=invalid_signature_for_testing"
        }
        
        try:
            response = requests.post(url, json=mock_event, headers=headers, timeout=10)
            print(f"Status: {response.status_code} - {response.text[:100]}...")
        except requests.exceptions.RequestException as e:
            print(f"Error: {e}")

def main():
    """Main debug function"""
    print("🚀 ScreenMerch Webhook Debug Script")
    print("=" * 50)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test 1: Basic connectivity
    if not test_webhook_endpoint():
        print("\n❌ Webhook endpoint is not accessible. Check your deployment.")
        return
    
    # Test 2: Environment variables
    check_environment_variables()
    
    # Test 3: Webhook with signature
    test_webhook_with_stripe_signature()
    
    # Test 4: Different event types
    test_stripe_webhook_events()
    
    print("\n" + "=" * 50)
    print("🔧 Debug Summary:")
    print("1. Check if your webhook endpoint is accessible")
    print("2. Verify your STRIPE_WEBHOOK_SECRET is correct")
    print("3. Ensure your webhook URL in Stripe dashboard matches: https://backend-hidden-firefly-7865.fly.dev/webhook")
    print("4. Check that the webhook is listening for 'checkout.session.completed' events")
    print("5. Verify your environment variables are set correctly")
    print("\n💡 Next steps:")
    print("- Test a real payment to see if webhook events are triggered")
    print("- Check your application logs for webhook processing")
    print("- Verify the webhook secret in your Stripe dashboard matches your environment variable")

if __name__ == "__main__":
    main() 