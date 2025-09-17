#!/usr/bin/env python3
"""
Debug why Stripe webhook isn't capturing customer information
"""
import requests
import json

def debug_stripe_webhook():
    print("🔍 Debugging Stripe webhook customer information capture...")
    
    # Check the specific order from the screenshot
    order_id = "8b11bcda-1230-4b4c-b9df-1523c2c277dd"
    
    try:
        # First, let's check what's in the database for this order
        print(f"1️⃣ Checking order {order_id} in database...")
        
        # We need to check the database directly or through an admin endpoint
        # Let's try to access the order through the admin interface
        
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
            
            # Get the specific order page
            response = session.get(f'https://copy5-backend.fly.dev/admin/order/{order_id}')
            
            if response.status_code == 200:
                response_text = response.text
                
                # Look for customer information in the HTML
                print("   Checking for customer information in order page...")
                
                if 'Name: Not provided' in response_text:
                    print("   ❌ Customer name is 'Not provided'")
                else:
                    print("   ✅ Customer name has a value")
                
                if 'Email: Not provided' in response_text:
                    print("   ❌ Customer email is 'Not provided'")
                else:
                    print("   ✅ Customer email has a value")
                
                if 'Phone: Not provided' in response_text:
                    print("   ❌ Customer phone is 'Not provided'")
                else:
                    print("   ✅ Customer phone has a value")
                
                # Check if this order has a Stripe session ID
                if 'stripe_session_id' in response_text:
                    print("   ✅ Order has Stripe session ID")
                else:
                    print("   ❌ Order missing Stripe session ID")
                
                # Check order status
                if 'status' in response_text.lower():
                    print("   ✅ Order has status field")
                else:
                    print("   ❌ Order missing status field")
                    
            else:
                print(f"❌ Could not access order page: {response.status_code}")
        else:
            print(f"❌ Admin login failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error debugging order: {e}")

def check_webhook_logs():
    print("\n2️⃣ Checking webhook functionality...")
    
    try:
        # Test if the webhook endpoint is working
        response = requests.get('https://copy5-backend.fly.dev/webhook')
        
        if response.status_code == 405:  # Method not allowed (expected for GET)
            print("✅ Webhook endpoint exists")
        else:
            print(f"❌ Webhook endpoint issue: {response.status_code}")
            
        # Check if there are any recent webhook calls
        print("   Note: Webhook logs would need to be checked in Stripe dashboard")
        print("   or backend logs to see if webhooks are being received")
        
    except Exception as e:
        print(f"❌ Webhook check error: {e}")

def check_database_schema():
    print("\n3️⃣ Checking database schema for customer fields...")
    
    try:
        # Based on our previous fixes, the orders table should have these fields:
        print("   Expected fields in orders table:")
        print("   ✅ customer_name")
        print("   ✅ customer_email") 
        print("   ✅ customer_phone")
        print("   ✅ shipping_address")
        print("   ✅ stripe_session_id")
        print("   ✅ payment_intent_id")
        print("   ✅ status")
        
        print("\n   Possible issues:")
        print("   1. Stripe webhook not being called")
        print("   2. Webhook receiving data but not updating database")
        print("   3. Database fields not being updated properly")
        print("   4. Order created before webhook fix was deployed")
        
    except Exception as e:
        print(f"❌ Database schema check error: {e}")

def suggest_solutions():
    print("\n4️⃣ Suggested solutions...")
    
    print("   To fix customer information capture:")
    print("   1. Check Stripe webhook configuration")
    print("   2. Verify webhook secret is correct")
    print("   3. Test with a new order to see if webhook works")
    print("   4. Check backend logs for webhook errors")
    print("   5. Manually update this order in database if needed")

if __name__ == "__main__":
    print("🎯 Debugging Stripe Webhook Customer Information...")
    
    debug_stripe_webhook()
    check_webhook_logs()
    check_database_schema()
    suggest_solutions()
    
    print("\n📋 Summary:")
    print("   The order shows 'Not provided' for customer info")
    print("   This suggests the Stripe webhook didn't update the database")
    print("   Need to check webhook configuration and test with new order")
