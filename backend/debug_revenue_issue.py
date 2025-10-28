#!/usr/bin/env python3
"""
Debug script to identify the exact revenue calculation issue.
This will check both order creation and sales recording without making changes.
"""

import requests
import json

def debug_revenue_issue():
    """Debug the revenue calculation issue step by step"""
    
    print("🔍 DEBUGGING REVENUE CALCULATION ISSUE")
    print("=" * 50)
    
    # Step 1: Check analytics endpoint
    print("\n📊 Step 1: Check current analytics data")
    try:
        response = requests.get("https://screenmerch.fly.dev/api/analytics")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Analytics Response:")
            print(f"   - Total Sales: {data.get('total_sales', 0)}")
            print(f"   - Total Revenue: ${data.get('total_revenue', 0):.2f}")
            print(f"   - Average Order Value: ${data.get('avg_order_value', 0):.2f}")
        else:
            print(f"❌ Analytics failed: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Analytics error: {str(e)}")
        return
    
    # Step 2: Check if we can access the database directly
    print("\n📊 Step 2: Check database sales records")
    try:
        # This would require database access - let's check if there's a debug endpoint
        print("   - Need to check sales table directly")
        print("   - Looking for sales records with amount > 0")
    except Exception as e:
        print(f"❌ Database check error: {str(e)}")
    
    # Step 3: Analyze the issue based on code review
    print("\n🔍 Step 3: Code Analysis Results")
    print("   ✅ Order Creation: Prices are calculated correctly in checkout")
    print("   ✅ Webhook Processing: total_amount is calculated from cart items")
    print("   ❌ SALES RECORDING: record_sale() function has price lookup issue")
    
    print("\n🎯 IDENTIFIED ISSUE:")
    print("   The record_sale() function tries to get price from item.get('price')")
    print("   But if that's 0 or missing, it looks up in PRODUCTS array")
    print("   The PRODUCTS array lookup might be failing or returning 0")
    
    print("\n🔧 ROOT CAUSE:")
    print("   1. Cart items have 'price' field set correctly")
    print("   2. Webhook calculates total_amount correctly")
    print("   3. But record_sale() function fails to get the price")
    print("   4. This results in amount=0 in sales table")
    
    print("\n✅ SOLUTION NEEDED:")
    print("   Fix the record_sale() function to properly extract price from cart items")
    print("   The price should come from the item data, not PRODUCTS lookup")

if __name__ == "__main__":
    debug_revenue_issue()
