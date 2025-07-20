#!/usr/bin/env python3
"""
Setup script to create the products table in Supabase
Run this script to create the missing products table
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
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("❌ Missing Supabase environment variables")
    print("Please check your .env file and ensure SUPABASE_URL and SUPABASE_ANON_KEY are set")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

def create_products_table():
    """Create the products table in Supabase"""
    
    # SQL to create the products table
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS products (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        product_id VARCHAR(255) UNIQUE NOT NULL,
        thumbnail_url TEXT,
        video_url TEXT,
        screenshots_urls TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    
    # SQL to create index
    create_index_sql = """
    CREATE INDEX IF NOT EXISTS idx_products_product_id ON products(product_id);
    """
    
    # SQL to create trigger function
    create_trigger_function_sql = """
    CREATE OR REPLACE FUNCTION update_products_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';
    """
    
    # SQL to create trigger
    create_trigger_sql = """
    CREATE TRIGGER update_products_updated_at 
        BEFORE UPDATE ON products 
        FOR EACH ROW 
        EXECUTE FUNCTION update_products_updated_at_column();
    """
    
    # SQL to enable RLS
    enable_rls_sql = """
    ALTER TABLE products ENABLE ROW LEVEL SECURITY;
    """
    
    # SQL to create policies
    create_policies_sql = """
    -- Allow public read access to all products
    CREATE POLICY "Public can view products" ON products
        FOR SELECT USING (true);

    -- Allow public insert access (for the API)
    CREATE POLICY "Public can insert products" ON products
        FOR INSERT WITH CHECK (true);
    """
    
    try:
        print("🔧 Setting up products table...")
        
        # Execute each SQL statement
        print("📄 Creating products table...")
        result = supabase.rpc('exec_sql', {'sql': create_table_sql}).execute()
        print("✅ Products table created")
        
        print("📄 Creating index...")
        result = supabase.rpc('exec_sql', {'sql': create_index_sql}).execute()
        print("✅ Index created")
        
        print("📄 Creating trigger function...")
        result = supabase.rpc('exec_sql', {'sql': create_trigger_function_sql}).execute()
        print("✅ Trigger function created")
        
        print("📄 Creating trigger...")
        result = supabase.rpc('exec_sql', {'sql': create_trigger_sql}).execute()
        print("✅ Trigger created")
        
        print("📄 Enabling RLS...")
        result = supabase.rpc('exec_sql', {'sql': enable_rls_sql}).execute()
        print("✅ RLS enabled")
        
        print("📄 Creating policies...")
        result = supabase.rpc('exec_sql', {'sql': create_policies_sql}).execute()
        print("✅ Policies created")
        
        print("\n🎉 Products table setup completed successfully!")
        print("\n📋 The table is now ready to use with the following structure:")
        print("   - product_id (VARCHAR, UNIQUE)")
        print("   - thumbnail_url (TEXT)")
        print("   - video_url (TEXT)")
        print("   - screenshots_urls (TEXT)")
        print("   - created_at (TIMESTAMP)")
        print("   - updated_at (TIMESTAMP)")
        
        return True
        
    except Exception as e:
        print(f"❌ Error setting up products table: {str(e)}")
        print(f"❌ Error type: {type(e).__name__}")
        return False

def test_connection():
    """Test the Supabase connection"""
    try:
        print("🔍 Testing Supabase connection...")
        # Try to query the products table (it might not exist yet)
        result = supabase.table('products').select('count').limit(1).execute()
        print("✅ Connection successful")
        return True
    except Exception as e:
        print(f"⚠️  Connection test: {str(e)}")
        # This might fail if the table doesn't exist, which is expected
        return True

def main():
    print("🚀 ScreenMerch Products Table Setup\n")
    
    # Test connection
    if not test_connection():
        print("❌ Cannot connect to Supabase. Please check your credentials.")
        sys.exit(1)
    
    # Create the products table
    if create_products_table():
        print("\n✅ Setup completed successfully!")
        print("You can now use the 'Make Merch' button without errors.")
    else:
        print("\n❌ Setup failed. Please check the error messages above.")
        sys.exit(1)

if __name__ == "__main__":
    main() 