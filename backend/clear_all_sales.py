#!/usr/bin/env python3
"""
Script to clear all sales from the ScreenMerch database.
This will delete all records from the sales table.
"""

import os
from supabase import create_client, Client

# Get environment variables
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def clear_all_sales():
    """Clear all sales from the database"""
    
    try:
        print("🔍 Connecting to Supabase...")
        print(f"✅ Connected to: {SUPABASE_URL}")
        
        # First, let's check how many sales we have
        print("📊 Checking current sales count...")
        sales_result = supabase.table('sales').select('id').execute()
        current_count = len(sales_result.data)
        print(f"📈 Found {current_count} sales records")
        
        if current_count == 0:
            print("✅ No sales to clear!")
            return True
        
        # Ask for confirmation
        confirm = input(f"⚠️  Are you sure you want to delete ALL {current_count} sales? (yes/no): ")
        if confirm.lower() != 'yes':
            print("❌ Operation cancelled")
            return False
        
        # Delete all sales
        print("🗑️  Deleting all sales...")
        delete_result = supabase.table('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        
        # Verify deletion
        verify_result = supabase.table('sales').select('id').execute()
        remaining_count = len(verify_result.data)
        
        print(f"✅ Successfully deleted {current_count - remaining_count} sales records")
        print(f"📊 Remaining sales: {remaining_count}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error clearing sales: {str(e)}")
        return False

if __name__ == "__main__":
    print("🧹 ScreenMerch Sales Clear Tool")
    print("=" * 40)
    
    success = clear_all_sales()
    
    if success:
        print("\n✅ Sales cleared successfully!")
        print("📊 Your analytics dashboard will now show 0 sales")
    else:
        print("\n❌ Failed to clear sales")
