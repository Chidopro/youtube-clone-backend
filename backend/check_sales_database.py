#!/usr/bin/env python3
"""
Script to check what's in the sales database
"""

import os
from supabase import create_client, Client

# Get environment variables
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def check_sales_database():
    """Check what's in the sales database"""
    
    try:
        print("🔍 Checking sales database...")
        print(f"✅ Connected to: {SUPABASE_URL}")
        
        # Get all sales with details
        print("📊 Fetching all sales...")
        sales_result = supabase.table('sales').select('*').execute()
        
        print(f"📈 Found {len(sales_result.data)} sales records")
        
        if len(sales_result.data) == 0:
            print("✅ No sales in database")
            return
        
        print("\n📋 Sales Details:")
        print("=" * 80)
        
        for i, sale in enumerate(sales_result.data, 1):
            print(f"\n{i}. Sale ID: {sale.get('id', 'N/A')}")
            print(f"   Product: {sale.get('product_name', 'N/A')}")
            print(f"   Amount: ${sale.get('amount', 0)}")
            print(f"   User ID: {sale.get('user_id', 'N/A')}")
            print(f"   Channel ID: {sale.get('channel_id', 'N/A')}")
            print(f"   Video Title: {sale.get('video_title', 'N/A')}")
            print(f"   Created: {sale.get('created_at', 'N/A')}")
        
        # Calculate totals
        total_amount = sum(sale.get('amount', 0) for sale in sales_result.data)
        print(f"\n💰 Total Revenue: ${total_amount}")
        print(f"📊 Total Sales: {len(sales_result.data)}")
        
        # Check for zero amounts
        zero_amount_sales = [sale for sale in sales_result.data if sale.get('amount', 0) == 0]
        if zero_amount_sales:
            print(f"\n⚠️  Found {len(zero_amount_sales)} sales with $0 amount:")
            for sale in zero_amount_sales:
                print(f"   - {sale.get('product_name', 'Unknown')} (ID: {sale.get('id', 'N/A')})")
        
    except Exception as e:
        print(f"❌ Error checking sales: {str(e)}")

if __name__ == "__main__":
    print("🔍 ScreenMerch Sales Database Check")
    print("=" * 50)
    
    check_sales_database()
