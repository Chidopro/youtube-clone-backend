#!/usr/bin/env python3
"""
Test script to check Stripe test mode and webhook configuration.
"""

import requests
import json

def test_stripe_configuration():
    """Test Stripe configuration and webhook setup"""
    
    print("🚀 Testing Stripe configuration...")
    
    # Test 1: Check if webhook endpoint is accessible
    print("\n📊 Test 1: Webhook endpoint accessibility")
    try:
        response = requests.get("https://backend-hidden-firefly-7865.fly.dev/webhook")
        print(f"✅ Webhook endpoint is accessible (Status: {response.status_code})")
    except Exception as e:
        print(f"❌ Webhook endpoint not accessible: {e}")
    
    # Test 2: Check Stripe test mode configuration
    print("\n📊 Test 2: Stripe test mode check")
    print("ℹ️  If you're using Stripe test mode, the following might be issues:")
    print("   - Test payments might not trigger webhooks")
    print("   - Webhook might not be configured for test mode")
    print("   - Test payments might not include order_id metadata")
    
    # Test 3: Simulate a test payment webhook
    print("\n📊 Test 3: Simulating test payment webhook")
    
    # Mock test payment webhook data
    test_webhook_data = {
        "id": "evt_test_payment",
        "object": "event",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_session_123",
                "object": "checkout.session",
                "metadata": {
                    "order_id": "test_order_456"
                },
                "customer_details": {
                    "phone": "+1234567890"
                }
            }
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "Stripe-Signature": "t=1234567890,v1=test_signature"
    }
    
    try:
        response = requests.post(
            "https://backend-hidden-firefly-7865.fly.dev/webhook",
            json=test_webhook_data,
            headers=headers,
            timeout=10
        )
        print(f"✅ Test webhook sent (Status: {response.status_code})")
        print(f"Response: {response.text[:200]}...")
        
        if response.status_code == 400:
            print("ℹ️  Expected 400 error due to invalid signature - this is normal")
        elif response.status_code == 200:
            print("✅ Webhook processed successfully!")
            
    except Exception as e:
        print(f"❌ Test webhook failed: {e}")
    
    # Test 4: Check if order_store has test data
    print("\n📊 Test 4: Checking order store")
    print("ℹ️  The webhook needs to find order data in order_store")
    print("ℹ️  If you made a test payment, check if the order_id was passed correctly")
    
    return True

def check_stripe_dashboard():
    """Provide guidance for checking Stripe dashboard"""
    
    print("\n🔍 Stripe Dashboard Checks:")
    print("1. Go to Stripe Dashboard → Developers → Webhooks")
    print("2. Check if webhook endpoint is configured for test mode")
    print("3. Verify webhook URL: https://backend-hidden-firefly-7865.fly.dev/webhook")
    print("4. Check if 'checkout.session.completed' event is enabled")
    print("5. Look for any failed webhook attempts in the logs")
    print("6. Check if test payments are triggering webhook events")

if __name__ == "__main__":
    print("🚀 Testing Stripe test mode configuration...")
    success = test_stripe_configuration()
    check_stripe_dashboard()
    
    if success:
        print("\n🎉 Stripe configuration test completed!")
        print("\n💡 Next steps:")
        print("1. Check Stripe dashboard for webhook configuration")
        print("2. Make a test payment with a real test card (4242 4242 4242 4242)")
        print("3. Check if webhook events appear in Stripe dashboard")
        print("4. Check application logs for webhook processing")
    else:
        print("\n💥 Stripe configuration test failed!")
        exit(1) 