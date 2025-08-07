#!/usr/bin/env python3
"""
Debug script to test the exact analytics endpoint logic.
"""

import os
import sys
from supabase import create_client, Client

# Use hardcoded keys like other working scripts
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def test_analytics_logic():
    """Test the exact logic from the analytics endpoint"""
    
    print("🚀 Testing analytics endpoint logic...")
    print(f"✅ Connected to Supabase: {SUPABASE_URL}")
    
    try:
        # This is the exact query from the analytics endpoint
        print("🔍 Testing the exact analytics query (no filters)...")
        sales_result = supabase.table('sales').select('id,product_name,amount').gt('amount', 0).execute()
        
        print(f"📊 Found {len(sales_result.data)} sales records in database")
        
        # Show first 5 sales
        for i, sale in enumerate(sales_result.data[:5]):
            print(f"  {i+1}. {sale.get('product_name')} - ${sale.get('amount', 0):.2f} - Channel: {sale.get('channel_id')}")
        
        # Calculate totals like the analytics endpoint
        total_sales = len(sales_result.data)
        total_revenue = sum(sale.get('amount', 0) for sale in sales_result.data)
        
        print(f"\n📈 Analytics calculation:")
        print(f"  - Total sales: {total_sales}")
        print(f"  - Total revenue: ${total_revenue:.2f}")
        
        # Check for non-zero amounts
        non_zero_sales = [sale for sale in sales_result.data if sale.get('amount', 0) > 0]
        print(f"  - Sales with non-zero amounts: {len(non_zero_sales)}")
        
        for sale in non_zero_sales:
            print(f"    - {sale.get('product_name')}: ${sale.get('amount', 0):.2f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error in analytics logic: {str(e)}")
        return False

if __name__ == "__main__":
    test_analytics_logic()
