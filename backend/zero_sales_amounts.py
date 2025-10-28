#!/usr/bin/env python3
"""
Safely zero out all sales amounts to start fresh for analytics testing.
This script will:
1. Show current sales data
2. Ask for confirmation
3. Set all amounts to 0 (keeps structure)
4. Verify the reset
"""

import os
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTg1MjA1NSwiZXhwIjoyMDY1NDI4MDU1fQ.lF-SglNH91xhXlTU1Inl8OSX2DeW19P12P-pFZAlRIA"

def show_current_data():
    """Show current sales and orders data"""
    print("🔍 Current Sales Data")
    print("=" * 50)
    
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Check sales table
        print("\n📊 Sales Table:")
        sales_result = supabase.table('sales').select('id,product_name,amount,created_at').execute()
        print(f"   - Total records: {len(sales_result.data)}")
        
        if sales_result.data:
            total_sales = sum(sale.get('amount', 0) for sale in sales_result.data)
            print(f"   - Total amount: ${total_sales:.2f}")
            print("   - Sample records:")
            for sale in sales_result.data[:5]:
                print(f"     * {sale.get('product_name')} - ${sale.get('amount', 0):.2f} - {sale.get('created_at', 'No date')}")
        
        # Check orders table
        print("\n📊 Orders Table:")
        orders_result = supabase.table('orders').select('id,order_id,total_value,created_at').execute()
        print(f"   - Total records: {len(orders_result.data)}")
        
        if orders_result.data:
            total_orders = sum(order.get('total_value', 0) for order in orders_result.data)
            print(f"   - Total value: ${total_orders:.2f}")
            print("   - Sample records:")
            for order in orders_result.data[:5]:
                print(f"     * Order {order.get('order_id')} - ${order.get('total_value', 0):.2f} - {order.get('created_at', 'No date')}")
        
        return len(sales_result.data), len(orders_result.data), total_sales, total_orders
        
    except Exception as e:
        print(f"❌ Error checking data: {str(e)}")
        return 0, 0, 0, 0

def zero_sales_amounts():
    """Zero out all sales and orders amounts"""
    print("\n🧹 Zeroing Sales Amounts")
    print("=" * 50)
    
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Zero out sales amounts
        print("🔢 Zeroing sales amounts...")
        sales_result = supabase.table('sales').update({'amount': 0}).neq('id', 0).execute()
        print(f"   - Updated {len(sales_result.data)} sales records")
        
        # Zero out orders amounts
        print("🔢 Zeroing orders amounts...")
        orders_result = supabase.table('orders').update({'total_value': 0}).neq('id', 0).execute()
        print(f"   - Updated {len(orders_result.data)} orders records")
        
        print("✅ All sales amounts zeroed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error zeroing amounts: {str(e)}")
        return False

def verify_reset():
    """Verify that the amounts have been zeroed"""
    print("\n✅ Verifying Reset")
    print("=" * 50)
    
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Check sales table
        sales_result = supabase.table('sales').select('id,amount').execute()
        total_sales = sum(sale.get('amount', 0) for sale in sales_result.data)
        print(f"📊 Sales records: {len(sales_result.data)}")
        print(f"📊 Total sales amount: ${total_sales:.2f}")
        
        # Check orders table
        orders_result = supabase.table('orders').select('id,total_value').execute()
        total_orders = sum(order.get('total_value', 0) for order in orders_result.data)
        print(f"📊 Orders records: {len(orders_result.data)}")
        print(f"📊 Total orders value: ${total_orders:.2f}")
        
        if total_sales == 0 and total_orders == 0:
            print("🎉 SUCCESS: All sales amounts have been zeroed!")
            print("   - Analytics will now start fresh")
            print("   - You can test analytics without old test data")
            print("   - Record structure is preserved")
            return True
        else:
            print("⚠️  WARNING: Some amounts may still be non-zero")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying reset: {str(e)}")
        return False

def main():
    """Main function to safely zero sales amounts"""
    print("🚀 ScreenMerch Sales Amount Reset Tool")
    print("=" * 50)
    print("This will set ALL sales and orders amounts to 0.")
    print("This preserves the record structure but zeros the values.")
    print("This is SAFE for testing - all amounts will be reset to zero.")
    print()
    
    # Show current data
    sales_count, orders_count, total_sales, total_orders = show_current_data()
    
    if total_sales == 0 and total_orders == 0:
        print("\n✅ No amounts to zero - all values are already 0!")
        return
    
    # Ask for confirmation
    print(f"\n⚠️  WARNING: This will zero out ${total_sales:.2f} in sales and ${total_orders:.2f} in orders.")
    print("This action cannot be undone!")
    
    confirm = input("\nType 'ZERO' to confirm (case sensitive): ")
    
    if confirm != 'ZERO':
        print("❌ Operation cancelled. No amounts were changed.")
        return
    
    # Zero the amounts
    if zero_sales_amounts():
        # Verify the reset
        verify_reset()
    else:
        print("❌ Failed to zero amounts. Please check the error messages above.")

if __name__ == "__main__":
    main()
