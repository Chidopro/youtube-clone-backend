#!/usr/bin/env python3
"""
Setup script to create the orders table in Supabase
This replaces the in-memory order_store with persistent database storage
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
env_paths = [
    Path(__file__).parent / '.env',
    Path(__file__).parent.parent / '.env',
    Path.cwd() / '.env'
]

for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        print(f"Loaded .env from: {env_path}")

# Get Supabase credentials
supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("ERROR: Missing Supabase environment variables")
    sys.exit(1)

def setup_orders_table():
    """Create the orders table in Supabase"""
    try:
        # Initialize Supabase client
        supabase: Client = create_client(supabase_url, supabase_key)
        
        print("🔧 Setting up orders table...")
        
        # Read the SQL file
        sql_file = Path(__file__).parent / "create_orders_table.sql"
        if not sql_file.exists():
            print(f"❌ SQL file not found: {sql_file}")
            return False
            
        with open(sql_file, 'r') as f:
            sql_content = f.read()
        
        # Execute the SQL
        result = supabase.rpc('exec_sql', {'sql': sql_content}).execute()
        
        print("✅ Orders table created successfully!")
        print("📊 Table structure:")
        print("   - id: UUID primary key")
        print("   - order_id: VARCHAR(255) unique (Stripe metadata)")
        print("   - cart: JSONB (complete cart data)")
        print("   - sms_consent: BOOLEAN")
        print("   - customer_phone: VARCHAR(50)")
        print("   - customer_email: VARCHAR(255)")
        print("   - video_title: VARCHAR(255)")
        print("   - creator_name: VARCHAR(255)")
        print("   - total_amount: DECIMAL(10,2)")
        print("   - shipping_cost: DECIMAL(10,2)")
        print("   - status: VARCHAR(50)")
        print("   - stripe_session_id: VARCHAR(255)")
        print("   - payment_intent_id: VARCHAR(255)")
        print("   - created_at/updated_at: TIMESTAMP")
        
        return True
        
    except Exception as e:
        print(f"❌ Error setting up orders table: {str(e)}")
        return False

def test_orders_table():
    """Test the orders table by inserting and retrieving a test order"""
    try:
        supabase: Client = create_client(supabase_url, supabase_key)
        
        print("\n🧪 Testing orders table...")
        
        # Insert a test order
        test_order = {
            "order_id": "test-order-123",
            "cart": [{"product": "Test Product", "price": 25.99}],
            "sms_consent": False,
            "customer_phone": "+1234567890",
            "customer_email": "test@example.com",
            "video_title": "Test Video",
            "creator_name": "Test Creator",
            "total_amount": 25.99,
            "shipping_cost": 5.99,
            "status": "pending"
        }
        
        result = supabase.table('orders').insert(test_order).execute()
        
        if result.data:
            print("✅ Test order inserted successfully")
            
            # Retrieve the test order
            retrieved = supabase.table('orders').select('*').eq('order_id', 'test-order-123').execute()
            
            if retrieved.data:
                print("✅ Test order retrieved successfully")
                print(f"   Order ID: {retrieved.data[0]['order_id']}")
                print(f"   Status: {retrieved.data[0]['status']}")
                
                # Clean up test order
                supabase.table('orders').delete().eq('order_id', 'test-order-123').execute()
                print("✅ Test order cleaned up")
                
                return True
            else:
                print("❌ Failed to retrieve test order")
                return False
        else:
            print("❌ Failed to insert test order")
            return False
            
    except Exception as e:
        print(f"❌ Error testing orders table: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Orders Table Setup")
    print("=" * 50)
    
    # Setup the table
    if setup_orders_table():
        # Test the table
        if test_orders_table():
            print("\n🎉 Orders table setup completed successfully!")
            print("\n📝 Next steps:")
            print("   1. Update your app.py to use database storage instead of order_store")
            print("   2. Deploy the updated backend to Fly.io")
            print("   3. Test the complete order flow")
        else:
            print("\n❌ Orders table setup failed during testing")
    else:
        print("\n❌ Orders table setup failed")
