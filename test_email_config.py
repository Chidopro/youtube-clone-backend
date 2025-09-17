#!/usr/bin/env python3
"""
Test email configuration and fix email notifications
"""

import requests
import sys

def test_email_config():
    """Test the current email configuration"""
    try:
        print("📧 Testing email configuration...")
        
        backend_url = "https://copy5-backend.fly.dev"
        
        # Test the email configuration endpoint
        print(f"  🔍 Checking email configuration...")
        response = requests.get(f"{backend_url}/api/test-email-config", timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"  ✅ Email configuration test successful")
            print(f"  📋 Configuration status:")
            
            config = result.get('config_status', {})
            for key, value in config.items():
                print(f"    {key}: {value}")
                
            if result.get('success'):
                print(f"  ✅ Test email sent successfully!")
                print(f"  📧 Email ID: {result.get('email_id')}")
                print(f"  📬 Admin email: {result.get('admin_email')}")
            else:
                print(f"  ❌ Test email failed: {result.get('error')}")
                
        else:
            print(f"  ❌ Email configuration test failed: {response.status_code}")
            print(f"  Response: {response.text}")
            
        return True
        
    except Exception as e:
        print(f"❌ Error testing email configuration: {str(e)}")
        return False

def check_email_endpoints():
    """Check if email endpoints are working"""
    try:
        print("\n🔍 Checking email endpoints...")
        
        backend_url = "https://copy5-backend.fly.dev"
        
        # Test the test-order-email endpoint
        print(f"  🧪 Testing order email endpoint...")
        test_data = {
            "customer_name": "Test Customer",
            "customer_email": "test@example.com",
            "customer_phone": "555-1234",
            "cart": [
                {
                    "product": "Test Product",
                    "size": "M",
                    "color": "Black",
                    "quantity": 1
                }
            ]
        }
        
        response = requests.post(f"{backend_url}/api/test-order-email", json=test_data, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"  ✅ Test order email sent successfully!")
                print(f"  📧 Email ID: {result.get('email_id')}")
            else:
                print(f"  ❌ Test order email failed: {result.get('error')}")
        else:
            print(f"  ❌ Test order email endpoint failed: {response.status_code}")
            print(f"  Response: {response.text}")
            
        return True
        
    except Exception as e:
        print(f"❌ Error checking email endpoints: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Starting email configuration test...\n")
    
    # Step 1: Test email configuration
    test_email_config()
    
    # Step 2: Check email endpoints
    check_email_endpoints()
    
    print("\n✅ Email configuration test complete!")
    print("\n💡 If emails are not working:")
    print("  1. Check that MAIL_TO environment variable is set to digitalavatartutorial@gmail.com")
    print("  2. Verify RESEND_API_KEY is configured")
    print("  3. Ensure RESEND_FROM email is verified with Resend")
    print("  4. Check Resend dashboard for any delivery issues")
