#!/usr/bin/env python3
"""
Clear the orders data to start fresh for analytics testing.
Based on actual table structure: orders table has 371 records with total_amount column.
"""

import os
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTg1MjA1NSwiZXhwIjoyMDY1NDI4MDU1fQ.lF-SglNH91xhXlTU1Inl8OSX2DeW19P12P-pFZAlRIA"

def show_current_data():
    """Show current orders data"""
    print("🔍 Current Orders Data")
    print("=" * 50)
    
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Check orders table with correct column names
        print("\n📊 Orders Table:")
        orders_result = supabase.table('orders').select('id,order_id,total_amount,created_at').execute()
        print(f"   - Total records: {len(orders_result.data)}")
        
        if orders_result.data:
            total_orders = sum(order.get('total_amount', 0) for order in orders_result.data)
            print(f"   - Total amount: ${total_orders:.2f}")
            print("   - Sample records:")
            for order in orders_result.data[:5]:
                print(f"     * Order {order.get('order_id')} - ${order.get('total_amount', 0):.2f} - {order.get('created_at', 'No date')}")
        
        return len(orders_result.data), total_orders
        
    except Exception as e:
        print(f"❌ Error checking data: {str(e)}")
        return 0, 0

def clear_orders_data():
    """Clear all orders data"""
    print("\n🧹 Clearing Orders Data")
    print("=" * 50)
    
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Clear orders table
        print("🗑️  Clearing orders table...")
        orders_result = supabase.table('orders').delete().neq('id', 0).execute()
        print(f"   - Deleted {len(orders_result.data)} orders records")
        
        print("✅ All orders data cleared successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error clearing data: {str(e)}")
        return False

def verify_reset():
    """Verify that the data has been cleared"""
    print("\n✅ Verifying Reset")
    print("=" * 50)
    
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Check orders table
        orders_result = supabase.table('orders').select('id').execute()
        print(f"📊 Orders records remaining: {len(orders_result.data)}")
        
        if len(orders_result.data) == 0:
            print("🎉 SUCCESS: All orders data has been cleared!")
            print("   - Analytics will now start fresh")
            print("   - You can test analytics without old test data")
            return True
        else:
            print("⚠️  WARNING: Some data may still remain")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying reset: {str(e)}")
        return False

def main():
    """Main function to safely clear orders data"""
    print("🚀 ScreenMerch Orders Data Reset Tool")
    print("=" * 50)
    print("This will clear ALL orders data to start fresh.")
    print("This is SAFE for testing - all data will be reset to zero.")
    print()
    
    # Show current data
    orders_count, total_orders = show_current_data()
    
    if orders_count == 0:
        print("\n✅ No data to clear - orders table is already empty!")
        return
    
    # Ask for confirmation
    print(f"\n⚠️  WARNING: This will delete {orders_count} orders records.")
    print(f"Total value: ${total_orders:.2f}")
    print("This action cannot be undone!")
    
    confirm = input("\nType 'CLEAR' to confirm (case sensitive): ")
    
    if confirm != 'CLEAR':
        print("❌ Operation cancelled. No data was deleted.")
        return
    
    # Clear the data
    if clear_orders_data():
        # Verify the reset
        verify_reset()
    else:
        print("❌ Failed to clear data. Please check the error messages above.")

if __name__ == "__main__":
    main()
