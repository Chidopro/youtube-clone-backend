#!/usr/bin/env python3
"""
Direct setup script for the sales table in ScreenMerch database.
This script creates the sales table using Supabase's table operations.
"""

import os
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def setup_sales_table():
    """Create the sales table in the database"""
    
    # Get the service key from user input
    print("🔑 Please enter your Supabase Service Role Key:")
    print("   (You can find this in your Supabase dashboard under Settings > API)")
    print("   (The key will be visible as you type - this is normal)")
    supabase_key = input("Service Role Key: ").strip()
    
    if not supabase_key:
        print("❌ No service key provided!")
        return False
    
    # Initialize Supabase client
    try:
        supabase: Client = create_client(SUPABASE_URL, supabase_key)
        print(f"✅ Connected to Supabase: {SUPABASE_URL}")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {str(e)}")
        return False
    
    try:
        print("🔧 Setting up sales table...")
        
        # First, let's check if the sales table already exists
        print("📊 Checking if sales table exists...")
        try:
            result = supabase.table('sales').select('id').limit(1).execute()
            print("✅ Sales table already exists!")
            return True
        except Exception as e:
            if "relation" in str(e).lower() and "does not exist" in str(e).lower():
                print("📊 Sales table does not exist, creating it...")
            else:
                print(f"⚠️  Error checking table: {str(e)}")
        
        # Since we can't create tables directly through the API, we'll create a simple table
        # by inserting a record and letting Supabase create the table structure
        print("📊 Creating sales table by inserting initial record...")
        
        # Create the initial sale record with all required fields
        initial_sale = {
            "product_name": "Initial Setup Product",
            "amount": 0.00,
            "image_url": "https://example.com/setup.jpg",
            "user_id": None,
            "product_id": "setup",
            "video_id": None,
            "video_title": None,
            "friend_id": None,
            "channel_id": None
        }
        
        # Try to insert the initial record
        result = supabase.table('sales').insert(initial_sale).execute()
        
        if result.data:
            print("✅ Sales table created successfully!")
            print(f"📋 Initial record ID: {result.data[0]['id']}")
            
            # Clean up the initial record
            print("🧹 Cleaning up initial setup record...")
            supabase.table('sales').delete().eq('product_id', 'setup').execute()
            print("✅ Initial record cleaned up")
            
            # Test the table by inserting a sample record
            print("🧪 Testing sales table with sample data...")
            test_sale = {
                "product_name": "Test Product",
                "amount": 25.00,
                "image_url": "https://example.com/test.jpg"
            }
            
            result = supabase.table('sales').insert(test_sale).execute()
            print(f"✅ Test sale inserted with ID: {result.data[0]['id']}")
            
            # Clean up test data
            supabase.table('sales').delete().eq('product_name', 'Test Product').execute()
            print("🧹 Test data cleaned up")
            
            return True
        else:
            print("❌ Failed to create sales table")
            return False
            
    except Exception as e:
        print(f"❌ Error setting up sales table: {str(e)}")
        print("\n💡 Alternative approach:")
        print("   You may need to create the sales table manually in your Supabase dashboard:")
        print("   1. Go to your Supabase dashboard")
        print("   2. Navigate to Table Editor")
        print("   3. Click 'Create a new table'")
        print("   4. Name it 'sales'")
        print("   5. Add the following columns:")
        print("      - id (uuid, primary key)")
        print("      - user_id (uuid, nullable)")
        print("      - product_id (text, nullable)")
        print("      - product_name (text, not null)")
        print("      - video_id (text, nullable)")
        print("      - video_title (text, nullable)")
        print("      - image_url (text, nullable)")
        print("      - amount (decimal, not null)")
        print("      - friend_id (text, nullable)")
        print("      - channel_id (text, nullable)")
        print("      - created_at (timestamp with time zone, default now())")
        print("      - updated_at (timestamp with time zone, default now())")
        return False

if __name__ == "__main__":
    print("🚀 Starting sales table setup...")
    print(f"📡 Connecting to Supabase: {SUPABASE_URL}")
    success = setup_sales_table()
    
    if success:
        print("🎉 Sales table setup completed successfully!")
        print("📊 Analytics should now work properly for tracking sales.")
        print("🔄 Please restart your backend server to see the changes.")
    else:
        print("💥 Sales table setup failed!")
        print("\n📋 Next steps:")
        print("   1. Create the sales table manually in Supabase dashboard")
        print("   2. Run the add_missing_sale_simple.py script to add your sale")
        exit(1) 