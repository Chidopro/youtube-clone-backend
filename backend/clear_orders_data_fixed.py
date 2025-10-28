#!/usr/bin/env python3
"""
Clear the orders data to start fresh for analytics testing.
Fixed version that properly handles UUID columns.
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
    """Clear all orders data using proper UUID handling"""
    print("\n🧹 Clearing Orders Data")
    print("=" * 50)
    
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Method 1: Try to delete all records by selecting all IDs first
        print("🔍 Getting all order IDs...")
        all_orders = supabase.table('orders').select('id').execute()
        
        if not all_orders.data:
            print("   - No orders to delete")
            return True
        
        print(f"   - Found {len(all_orders.data)} orders to delete")
        
        # Method 2: Delete in batches to avoid timeout
        batch_size = 100
        total_deleted = 0
        
        for i in range(0, len(all_orders.data), batch_size):
            batch = all_orders.data[i:i + batch_size]
            order_ids = [order['id'] for order in batch]
            
            print(f"   - Deleting batch {i//batch_size + 1} ({len(order_ids)} orders)...")
            
            # Delete this batch
            for order_id in order_ids:
                try:
                    result = supabase.table('orders').delete().eq('id', order_id).execute()
                    total_deleted += len(result.data)
                except Exception as e:
                    print(f"     - Error deleting order {order_id}: {str(e)}")
        
        print(f"   - Successfully deleted {total_deleted} orders")
        print("✅ All orders data cleared successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error clearing data: {str(e)}")
        return False

def clear_orders_data_simple():
    """Alternative method: Clear orders data using a simpler approach"""
    print("\n🧹 Clearing Orders Data (Simple Method)")
    print("=" * 50)
    
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Try to delete all records using a different approach
        print("🗑️  Clearing orders table...")
        
        # Get all orders first
        all_orders = supabase.table('orders').select('id').execute()
        print(f"   - Found {len(all_orders.data)} orders to delete")
        
        if len(all_orders.data) == 0:
            print("   - No orders to delete")
            return True
        
        # Delete all orders by using a condition that matches all records
        # Since we know all records have created_at, we can use that
        result = supabase.table('orders').delete().gte('created_at', '1900-01-01').execute()
        print(f"   - Deleted {len(result.data)} orders")
        
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
    print("🚀 ScreenMerch Orders Data Reset Tool (Fixed)")
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
    
    # Try the simple method first
    if clear_orders_data_simple():
        # Verify the reset
        verify_reset()
    else:
        print("❌ Simple method failed. Trying alternative method...")
        if clear_orders_data():
            verify_reset()
        else:
            print("❌ Failed to clear data. Please check the error messages above.")

if __name__ == "__main__":
    main()
