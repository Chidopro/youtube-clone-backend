#!/usr/bin/env python3
"""
Check if the order is coming from in-memory store or database
"""
import requests
import json

def check_order_source():
    print("🔍 Checking where the order data is coming from...")
    
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
            
            # Get the order page
            response = session.get(f'https://copy5-backend.fly.dev/admin/order/{order_id}')
            
            if response.status_code == 200:
                response_text = response.text
                
                # Check the page source to see if we can determine the data source
                print("   Analyzing order page...")
                
                # Look for clues about data source
                if 'in-memory' in response_text.lower():
                    print("   ❌ Order is from in-memory store (no customer info)")
                elif 'database' in response_text.lower():
                    print("   ✅ Order is from database (should have customer info)")
                else:
                    print("   ❓ Cannot determine data source from page")
                
                # Check for specific customer info display
                if 'Name: Not provided' in response_text:
                    print("   ❌ Customer name showing as 'Not provided'")
                else:
                    print("   ✅ Customer name has a value")
                
                if 'Email: Not provided' in response_text:
                    print("   ❌ Customer email showing as 'Not provided'")
                else:
                    print("   ✅ Customer email has a value")
                
                if 'Phone: Not provided' in response_text:
                    print("   ❌ Customer phone showing as 'Not provided'")
                else:
                    print("   ✅ Customer phone has a value")
                
                # Check for order status
                if 'status' in response_text.lower():
                    print("   ✅ Order has status information")
                else:
                    print("   ❌ Order missing status information")
                
                # Check for Stripe information
                if 'stripe' in response_text.lower():
                    print("   ✅ Order has Stripe information")
                else:
                    print("   ❌ Order missing Stripe information")
                
            else:
                print(f"❌ Could not access order page: {response.status_code}")
        else:
            print(f"❌ Admin login failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error checking order source: {e}")

def suggest_fix():
    print("\n🔧 Suggested fix...")
    
    print("   The issue is likely that:")
    print("   1. Order is in in-memory store (order_store)")
    print("   2. In-memory store doesn't have customer info")
    print("   3. Database has customer info but order is fetched from memory")
    
    print("\n   Solutions:")
    print("   1. Clear the in-memory store to force database lookup")
    print("   2. Update the admin route to prioritize database over memory")
    print("   3. Manually update the in-memory store with customer info")
    print("   4. Test with a new order to see if webhook works")

if __name__ == "__main__":
    print("🎯 Checking Order Data Source...")
    
    check_order_source()
    suggest_fix()
    
    print("\n📋 Summary:")
    print("   Need to determine if order is from memory or database")
    print("   If from memory, customer info won't be available")
    print("   If from database, there might be a display issue")
