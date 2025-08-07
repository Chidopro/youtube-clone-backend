#!/usr/bin/env python3
"""
Script to fix the sale amount for the recent sale
"""

import os
from supabase import create_client, Client

# Get environment variables
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def fix_sale_amount():
    """Fix the sale amount for the recent sale"""
    
    try:
        print("🔍 Checking recent sale...")
        
        # Get the recent sale
        sales_result = supabase.table('sales').select('*').execute()
        
        if len(sales_result.data) == 0:
            print("❌ No sales found")
            return
        
        sale = sales_result.data[0]
        sale_id = sale.get('id')
        current_amount = sale.get('amount', 0)
        
        print(f"📊 Found sale: {sale.get('product_name')}")
        print(f"💰 Current amount: ${current_amount}")
        print(f"🆔 Sale ID: {sale_id}")
        
        if current_amount > 0:
            print("✅ Sale amount is already correct")
            return
        
        # Ask for the correct amount
        print("\n💡 The sale amount is $0, which is why revenue shows as $0")
        print("💰 What should the correct amount be? (e.g., 25.00 for $25)")
        
        try:
            new_amount = float(input("Enter amount: $"))
        except ValueError:
            print("❌ Invalid amount")
            return
        
        # Update the sale amount
        print(f"🔄 Updating sale amount to ${new_amount}...")
        
        update_result = supabase.table('sales').update({
            'amount': new_amount
        }).eq('id', sale_id).execute()
        
        if update_result.data:
            print("✅ Sale amount updated successfully!")
            print(f"💰 New amount: ${new_amount}")
            print("📊 Analytics should now show correct revenue")
        else:
            print("❌ Failed to update sale amount")
        
    except Exception as e:
        print(f"❌ Error fixing sale amount: {str(e)}")

if __name__ == "__main__":
    print("🔧 ScreenMerch Sale Amount Fix")
    print("=" * 40)
    
    fix_sale_amount()
