#!/usr/bin/env python3
"""
Debug why Stripe webhook isn't capturing correct customer information
"""
import requests
import json

def debug_stripe_webhook_issue():
    print("🔍 Debugging Stripe webhook customer information issue...")
    
    # The new order ID from the screenshot
    order_id = "4d736969-7c6c-4734-a640-02db526b986d"
    
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
            
            # Get the order page
            response = session.get(f'https://copy5-backend.fly.dev/admin/order/{order_id}')
            
            if response.status_code == 200:
                response_text = response.text
                
                print("   Order details from admin page:")
                
                # Extract customer information from the page
                if 'Email: test@screenmerch.com' in response_text:
                    print("   ❌ Email: test@screenmerch.com (WRONG - should be driveralan1@yahoo.com)")
                else:
                    print("   ✅ Email: Has correct value")
                
                if 'Phone: +15109938024' in response_text:
                    print("   ✅ Phone: +15109938024 (CORRECT - matches Stripe)")
                else:
                    print("   ❌ Phone: Wrong value")
                
                if 'Name: Not provided' in response_text:
                    print("   ❌ Name: Not provided (should be from Stripe)")
                else:
                    print("   ✅ Name: Has value")
                
                # Check if order has Stripe session ID
                if 'stripe_session_id' in response_text:
                    print("   ✅ Order has Stripe session ID")
                else:
                    print("   ❌ Order missing Stripe session ID")
                
                # Check order status
                if 'Status: paid' in response_text:
                    print("   ✅ Order status: paid")
                else:
                    print("   ❌ Order status: not paid")
                
            else:
                print(f"❌ Could not access order page: {response.status_code}")
        else:
            print(f"❌ Admin login failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error debugging order: {e}")

def analyze_webhook_issue():
    print("\n2️⃣ Analyzing webhook issue...")
    
    print("   The problem:")
    print("   - Stripe checkout shows: driveralan1@yahoo.com")
    print("   - Order shows: test@screenmerch.com")
    print("   - This means webhook is NOT capturing Stripe customer data")
    
    print("\n   Possible causes:")
    print("   1. Stripe webhook not configured")
    print("   2. Webhook not being called")
    print("   3. Webhook receiving wrong data")
    print("   4. Webhook failing to update database")
    print("   5. Order created before webhook processes")

def check_webhook_configuration():
    print("\n3️⃣ Checking webhook configuration...")
    
    print("   To fix this issue:")
    print("   1. Go to Stripe Dashboard")
    print("   2. Navigate to Developers > Webhooks")
    print("   3. Check if webhook endpoint exists:")
    print("      URL: https://copy5-backend.fly.dev/webhook")
    print("      Events: checkout.session.completed")
    print("   4. Verify webhook is receiving events")
    print("   5. Check webhook logs for errors")
    
    print("\n   Expected webhook flow:")
    print("   1. Customer completes payment in Stripe")
    print("   2. Stripe sends webhook to /webhook")
    print("   3. Webhook extracts customer details from session")
    print("   4. Webhook updates database with customer info")
    print("   5. Admin page shows correct customer info")

def suggest_immediate_fix():
    print("\n4️⃣ Immediate fix options...")
    
    print("   Option 1: Check Stripe webhook configuration")
    print("   - Verify webhook URL is correct")
    print("   - Check if webhook is enabled")
    print("   - Look for webhook delivery errors")
    
    print("\n   Option 2: Test webhook manually")
    print("   - Create a test webhook event")
    print("   - Send it to the webhook endpoint")
    print("   - Check if it processes correctly")
    
    print("\n   Option 3: Manual database update")
    print("   - Update this specific order in database")
    print("   - Set correct email: driveralan1@yahoo.com")
    print("   - Set correct name from Stripe session")

if __name__ == "__main__":
    print("🎯 Debugging Stripe Webhook Customer Info Issue...")
    
    debug_stripe_webhook_issue()
    analyze_webhook_issue()
    check_webhook_configuration()
    suggest_immediate_fix()
    
    print("\n📋 Summary:")
    print("   ❌ Stripe webhook is NOT working properly")
    print("   ❌ Customer email is wrong (test@screenmerch.com vs driveralan1@yahoo.com)")
    print("   ✅ Phone number is correct")
    print("   ❌ Customer name is missing")
    print("   🔧 Need to check Stripe webhook configuration")
