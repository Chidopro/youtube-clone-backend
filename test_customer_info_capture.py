#!/usr/bin/env python3
"""
Test if customer information is being captured in orders
"""
import requests
import json

def test_customer_info():
    print("🧪 Testing customer information capture in orders...")
    
    try:
        # Test 1: Check recent orders in database
        print("1️⃣ Checking recent orders for customer info...")
        
        # We'll simulate checking the admin orders endpoint
        session = requests.Session()
        
        # First login as admin
        login_data = {
            'email': 'chidopro@proton.me',
            'password': 'VieG369Bbk8!'
        }
        
        response = session.post('https://copy5-backend.fly.dev/admin/login', 
                              data=login_data)
        
        if response.status_code == 200:
            print("✅ Admin login successful")
            
            # Now check orders
            response = session.get('https://copy5-backend.fly.dev/admin/orders')
            
            if response.status_code == 200:
                print("✅ Admin orders page accessible")
                
                # Look for customer information in the response
                response_text = response.text
                
                # Check for customer info patterns
                if 'customer_name' in response_text:
                    print("✅ Customer name field found in orders")
                else:
                    print("❌ Customer name field not found")
                    
                if 'customer_email' in response_text:
                    print("✅ Customer email field found in orders")
                else:
                    print("❌ Customer email field not found")
                    
                if 'customer_phone' in response_text:
                    print("✅ Customer phone field found in orders")
                else:
                    print("❌ Customer phone field not found")
                    
                # Check for actual customer data
                if '@' in response_text and 'customer' in response_text.lower():
                    print("✅ Customer email data found in orders")
                else:
                    print("❌ No customer email data found")
                    
            else:
                print(f"❌ Admin orders page error: {response.status_code}")
        else:
            print(f"❌ Admin login failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing customer info: {e}")

def test_stripe_webhook_customer_info():
    print("\n2️⃣ Testing Stripe webhook customer info capture...")
    
    try:
        # Check if the webhook endpoint exists and what it expects
        response = requests.get('https://copy5-backend.fly.dev/api/webhook/stripe')
        
        if response.status_code == 405:  # Method not allowed (expected for GET)
            print("✅ Stripe webhook endpoint exists")
        else:
            print(f"❌ Stripe webhook endpoint issue: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Stripe webhook test error: {e}")

def check_database_schema():
    print("\n3️⃣ Checking if orders table has customer fields...")
    
    try:
        # Try to access a debug endpoint or check the database structure
        # This is a basic check - in reality we'd need database access
        print("   Note: Database schema check requires direct database access")
        print("   Based on previous fixes, orders table should have:")
        print("   ✅ customer_name")
        print("   ✅ customer_email") 
        print("   ✅ customer_phone")
        print("   ✅ shipping_address")
        
    except Exception as e:
        print(f"❌ Database schema check error: {e}")

if __name__ == "__main__":
    print("🎯 Testing Customer Information Capture...")
    
    test_customer_info()
    test_stripe_webhook_customer_info()
    check_database_schema()
    
    print("\n📋 Summary:")
    print("   - Check admin orders page for customer info display")
    print("   - Verify Stripe webhook is updating customer fields")
    print("   - Ensure orders table has customer_name, customer_email, customer_phone")
