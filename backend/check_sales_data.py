#!/usr/bin/env python3
"""
Check where sales data is actually stored and what the current values are.
"""

import os
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTg1MjA1NSwiZXhwIjoyMDY1NDI4MDU1fQ.lF-SglNH91xhXlTU1Inl8OSX2DeW19P12P-pFZAlRIA"

def check_sales_data():
    """Check all possible sales data locations"""
    
    print("🔍 Checking sales data locations")
    print("=" * 50)
    
    try:
        # Initialize Supabase client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Connected to Supabase")
        
        # Check sales table
        print("\n📊 Checking 'sales' table:")
        try:
            sales_result = supabase.table('sales').select('*').execute()
            print(f"   - Records found: {len(sales_result.data)}")
            if sales_result.data:
                for sale in sales_result.data[:3]:  # Show first 3
                    print(f"   - ID: {sale.get('id')}, Product: {sale.get('product_name')}, Amount: ${sale.get('amount', 0):.2f}")
        except Exception as e:
            print(f"   - Error: {str(e)}")
        
        # Check orders table
        print("\n📊 Checking 'orders' table:")
        try:
            orders_result = supabase.table('orders').select('*').execute()
            print(f"   - Records found: {len(orders_result.data)}")
            if orders_result.data:
                for order in orders_result.data[:3]:  # Show first 3
                    print(f"   - ID: {order.get('id')}, Order ID: {order.get('order_id')}, Total Value: ${order.get('total_value', 0):.2f}")
        except Exception as e:
            print(f"   - Error: {str(e)}")
        
        # Check if there are other tables
        print("\n📊 Checking for other relevant tables:")
        try:
            # Try to get table list (this might not work with current permissions)
            print("   - Checking available tables...")
        except Exception as e:
            print(f"   - Error checking tables: {str(e)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    check_sales_data()
