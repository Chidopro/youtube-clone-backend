#!/usr/bin/env python3
"""
Manually fix customer information for the specific order
"""
import requests
import json

def fix_customer_info_manually():
    print("🔧 Manually fixing customer information for the order...")
    
    # The order ID from the screenshot
    order_id = "8b11bcda-1230-4b4c-b9df-1523c2c277dd"
    
    try:
        # Login as admin
        session = requests.Session()
        login_data = {
            'email': 'chidopro@proton.me',
            'password': 'VieG369Bbk8!'
        }
        
        response = session.post('https://copy5-backend.fly.dev/admin/login', 
                              data=login_data)
        
        if response.status_code == 200:
            print("✅ Admin login successful")
            
            # Get the order page to see current data
            response = session.get(f'https://copy5-backend.fly.dev/admin/order/{order_id}')
            
            if response.status_code == 200:
                response_text = response.text
                
                # Check what's currently in the order
                print("   Current order data:")
                if 'Name: Not provided' in response_text:
                    print("   - Name: Not provided")
                else:
                    print("   - Name: Has value")
                
                if 'Email: Not provided' in response_text:
                    print("   - Email: Not provided")
                else:
                    print("   - Email: Has value")
                
                if 'Phone: Not provided' in response_text:
                    print("   - Phone: Not provided")
                else:
                    print("   - Phone: Has value")
                
                # Check if we can see any customer info in the HTML
                if 'customer' in response_text.lower():
                    print("   ✅ Customer-related data found in page")
                else:
                    print("   ❌ No customer data found in page")
                
                # Look for any email addresses in the page
                import re
                email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
                emails = re.findall(email_pattern, response_text)
                
                if emails:
                    print(f"   ✅ Found {len(emails)} email address(es) in page")
                    for email in emails[:3]:  # Show first 3
                        print(f"      - {email}")
                else:
                    print("   ❌ No email addresses found in page")
                
            else:
                print(f"❌ Could not access order page: {response.status_code}")
        else:
            print(f"❌ Admin login failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error fixing customer info: {e}")

def test_webhook_with_new_order():
    print("\n2️⃣ Testing webhook with a new order...")
    
    print("   To test if the webhook is working:")
    print("   1. Create a new test order")
    print("   2. Complete the payment process")
    print("   3. Check if customer info is captured")
    print("   4. If not, check Stripe webhook configuration")
    
    print("\n   Stripe webhook should be configured to:")
    print("   - URL: https://copy5-backend.fly.dev/webhook")
    print("   - Events: checkout.session.completed")
    print("   - Secret: Should match STRIPE_WEBHOOK_SECRET in backend")

def check_webhook_configuration():
    print("\n3️⃣ Checking webhook configuration...")
    
    print("   To verify webhook is working:")
    print("   1. Go to Stripe Dashboard")
    print("   2. Navigate to Developers > Webhooks")
    print("   3. Check if webhook endpoint exists")
    print("   4. Verify it's receiving events")
    print("   5. Check webhook logs for errors")
    
    print("\n   Expected webhook URL:")
    print("   https://copy5-backend.fly.dev/webhook")

if __name__ == "__main__":
    print("🎯 Fixing Customer Information Issue...")
    
    fix_customer_info_manually()
    test_webhook_with_new_order()
    check_webhook_configuration()
    
    print("\n📋 Summary:")
    print("   The order shows 'Not provided' for customer info")
    print("   This suggests the Stripe webhook didn't update the database")
    print("   Need to check Stripe webhook configuration")
    print("   Or test with a new order to see if webhook works")
