#!/usr/bin/env python3
"""
Test script for Resend email integration
"""

import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_resend_connection():
    """Test basic connection to Resend API"""
    print("🔍 Testing Resend API Connection...")
    
    # Check if API key is set
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        print("❌ RESEND_API_KEY not found in environment variables")
        print("   Please add your Resend API key to your .env file")
        return False
    
    print(f"✅ API Key found: {api_key[:10]}...")
    
    # Test basic API endpoint
    try:
        response = requests.get(
            "https://api.resend.com/domains",
            headers={"Authorization": f"Bearer {api_key}"}
        )
        
        if response.status_code == 200:
            print("✅ Successfully connected to Resend API")
            domains = response.json()
            print(f"   Available domains: {len(domains.get('data', []))}")
            return True
        else:
            print(f"❌ API connection failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Connection error: {str(e)}")
        return False

def test_email_sending():
    """Test sending a test email"""
    print("\n🔍 Testing Email Sending...")
    
    api_key = os.getenv("RESEND_API_KEY")
    mail_to = os.getenv("MAIL_TO")
    
    if not mail_to:
        print("❌ MAIL_TO not found in environment variables")
        print("   Please add your email address to MAIL_TO in your .env file")
        return False
    
    print(f"✅ Recipient email: {mail_to}")
    
    # Test email data - use verified email for testing
    email_data = {
        "from": "onboarding@resend.dev",
        "to": ["alancraigdigital@gmail.com"],  # Use verified email for testing
        "subject": "ScreenMerch - Resend Integration Test",
        "html": """
        <h1>🎉 Resend Integration Test Successful!</h1>
        <p>Your ScreenMerch application is now using Resend for email delivery.</p>
        <p>This means:</p>
        <ul>
            <li>✅ Order notifications will work</li>
            <li>✅ Login emails will be sent</li>
            <li>✅ You can test your Printful integration</li>
        </ul>
        <p><strong>Next step:</strong> Test your full workflow with Printful!</p>
        """
    }
    
    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json=email_data
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Test email sent successfully!")
            print(f"   Email ID: {result.get('id', 'N/A')}")
            return True
        else:
            print(f"❌ Email sending failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Email sending error: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 Resend Integration Test Suite")
    print("=" * 50)
    
    tests = [
        test_resend_connection,
        test_email_sending
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ Test failed with error: {str(e)}")
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Your Resend integration is ready.")
        print("\n📝 Next Steps:")
        print("   1. Start your Flask server: python app.py")
        print("   2. Test your login system")
        print("   3. Test your Printful integration")
        print("   4. Check your email for the test message")
    else:
        print("⚠️  Some tests failed. Please check the issues above.")
    
    return passed == total

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1) 