#!/usr/bin/env python3
"""
Setup script for the sales table in ScreenMerch database.
This script creates the sales table that's needed for tracking product sales and analytics.
"""

import os
import sys
from supabase import create_client, Client

# Add the parent directory to the path so we can import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import configuration
from backend.app import supabase

def setup_sales_table():
    """Create the sales table in the database"""
    
    # SQL to create the sales table
    sales_table_sql = """
    -- Create sales table for tracking product sales
    CREATE TABLE IF NOT EXISTS sales (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        product_id VARCHAR(255),
        product_name VARCHAR(255) NOT NULL,
        video_id VARCHAR(255),
        video_title VARCHAR(255),
        image_url TEXT,
        amount DECIMAL(10,2) NOT NULL,
        friend_id VARCHAR(255),
        channel_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    
    # SQL to create indexes
    indexes_sql = """
    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
    CREATE INDEX IF NOT EXISTS idx_sales_product_name ON sales(product_name);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_channel_id ON sales(channel_id);
    """
    
    # SQL to create trigger
    trigger_sql = """
    -- Create trigger to automatically update the updated_at column
    CREATE TRIGGER update_sales_updated_at 
        BEFORE UPDATE ON sales 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    """
    
    # SQL to enable RLS
    rls_sql = """
    -- Enable Row Level Security (RLS)
    ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
    """
    
    # SQL to create RLS policies
    policies_sql = """
    -- Create RLS policies for sales table
    -- Allow users to view their own sales
    CREATE POLICY "Users can view their own sales" ON sales
        FOR SELECT USING (auth.uid() = user_id);

    -- Allow authenticated users to insert sales records
    CREATE POLICY "Authenticated users can insert sales" ON sales
        FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    -- Allow service role to manage all sales (for admin functions)
    CREATE POLICY "Service role can manage all sales" ON sales
        FOR ALL USING (auth.role() = 'service_role');
    """
    
    try:
        print("🔧 Setting up sales table...")
        
        # Execute the SQL statements
        print("📊 Creating sales table...")
        supabase.rpc('exec_sql', {'sql': sales_table_sql}).execute()
        
        print("📈 Creating indexes...")
        supabase.rpc('exec_sql', {'sql': indexes_sql}).execute()
        
        print("🔔 Creating trigger...")
        supabase.rpc('exec_sql', {'sql': trigger_sql}).execute()
        
        print("🔒 Enabling RLS...")
        supabase.rpc('exec_sql', {'sql': rls_sql}).execute()
        
        print("🛡️ Creating RLS policies...")
        supabase.rpc('exec_sql', {'sql': policies_sql}).execute()
        
        print("✅ Sales table setup completed successfully!")
        
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
        
    except Exception as e:
        print(f"❌ Error setting up sales table: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Starting sales table setup...")
    success = setup_sales_table()
    
    if success:
        print("🎉 Sales table setup completed successfully!")
        print("📊 Analytics should now work properly for tracking sales.")
    else:
        print("💥 Sales table setup failed!")
        sys.exit(1) 