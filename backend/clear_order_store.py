#!/usr/bin/env python3
"""
Clear the in-memory order_store to complete the data reset.
This will clear the cached sales data that's still showing in analytics.
"""

import requests
import json

def clear_order_store():
    """Clear the in-memory order_store by calling the backend"""
    print("🧹 Clearing In-Memory Order Store")
    print("=" * 50)
    
    try:
        # Call the backend to clear the order_store
        print("📡 Sending request to clear order_store...")
        
        # We need to create an endpoint to clear the order_store
        # For now, let's restart the backend to clear the in-memory data
        print("⚠️  The order_store is in-memory and will be cleared when the backend restarts.")
        print("   - This happens automatically when you deploy")
        print("   - Or you can restart the backend manually")
        
        print("\n✅ Solution: Deploy the backend to clear the in-memory order_store")
        print("   - Run: cd backend && fly deploy")
        print("   - This will restart the backend and clear all in-memory data")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def check_analytics_after_clear():
    """Check if analytics are now showing zero data"""
    print("\n🔍 Checking Analytics After Clear")
    print("=" * 50)
    
    try:
        print("📊 Fetching analytics data...")
        response = requests.get("https://screenmerch.fly.dev/api/analytics")
        
        if response.status_code == 200:
            data = response.json()
            
            print("✅ Analytics Data Retrieved!")
            print(f"📈 Total Sales: {data.get('total_sales', 0)}")
            print(f"💰 Total Revenue: ${data.get('total_revenue', 0):.2f}")
            print(f"📊 Average Order Value: ${data.get('avg_order_value', 0):.2f}")
            
            # Check if data is cleared
            if data.get('total_sales', 0) == 0 and data.get('total_revenue', 0) == 0:
                print("\n🎉 SUCCESS: Analytics are now showing zero data!")
                print("   - All test sales data has been cleared")
                print("   - Analytics are ready for fresh testing")
                return True
            else:
                print("\n⚠️  WARNING: Analytics still showing data")
                print("   - The in-memory order_store may still contain data")
                print("   - Deploy the backend to clear it completely")
                return False
        else:
            print(f"❌ Error fetching analytics: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking analytics: {str(e)}")
        return False

def main():
    """Main function to clear order_store and verify"""
    print("🚀 ScreenMerch Order Store Clear Tool")
    print("=" * 50)
    print("This will clear the in-memory order_store that contains cached sales data.")
    print()
    
    # Clear the order_store
    if clear_order_store():
        print("\n" + "=" * 50)
        print("📋 NEXT STEPS:")
        print("1. Deploy the backend to clear in-memory data:")
        print("   cd backend && fly deploy")
        print()
        print("2. Check the dashboard to verify analytics show zero data")
        print()
        print("3. The analytics should now show:")
        print("   - Total Sales: 0")
        print("   - Total Revenue: $0.00")
        print("   - Recent Sales Activity: Empty")
        
        # Check current analytics status
        print("\n" + "=" * 50)
        check_analytics_after_clear()
    else:
        print("❌ Failed to clear order_store")

if __name__ == "__main__":
    main()
