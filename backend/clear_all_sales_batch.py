#!/usr/bin/env python3
"""
Script to clear all sales from the ScreenMerch database in batches.
This will delete all records from the sales table in small batches to avoid timeouts.
"""

import os
from supabase import create_client, Client

# Get environment variables
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def clear_all_sales_batch():
    """Clear all sales from the database in batches"""
    
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
        
        # Delete sales in batches of 10
        batch_size = 10
        deleted_count = 0
        
        print(f"🗑️  Deleting sales in batches of {batch_size}...")
        
        while True:
            # Get a batch of sales to delete
            batch_result = supabase.table('sales').select('id').limit(batch_size).execute()
            
            if not batch_result.data:
                break
                
            # Delete this batch
            batch_ids = [sale['id'] for sale in batch_result.data]
            for sale_id in batch_ids:
                try:
                    supabase.table('sales').delete().eq('id', sale_id).execute()
                    deleted_count += 1
                    print(f"🗑️  Deleted sale {deleted_count}/{current_count}")
                except Exception as e:
                    print(f"⚠️  Failed to delete sale {sale_id}: {str(e)}")
        
        # Verify deletion
        verify_result = supabase.table('sales').select('id').execute()
        remaining_count = len(verify_result.data)
        
        print(f"✅ Successfully deleted {deleted_count} sales records")
        print(f"📊 Remaining sales: {remaining_count}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error clearing sales: {str(e)}")
        return False

if __name__ == "__main__":
    print("🧹 ScreenMerch Sales Clear Tool (Batch Mode)")
    print("=" * 50)
    
    success = clear_all_sales_batch()
    
    if success:
        print("\n✅ Sales cleared successfully!")
        print("📊 Your analytics dashboard will now show 0 sales")
    else:
        print("\n❌ Failed to clear sales")
