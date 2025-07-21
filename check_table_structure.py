#!/usr/bin/env python3
"""
Check the actual structure of the products table and fix column mismatches
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
# Try VITE_ prefixed variables first, then fall back to non-prefixed
supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("❌ Missing Supabase environment variables")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

def check_table_structure():
    """Check what columns exist in the products table"""
    try:
        print("🔍 Checking products table structure...")
        
        # Try to get table info by attempting a select with limit 0
        result = supabase.table('products').select('*').limit(0).execute()
        
        # If we get here, the table exists. Let's try to insert a test record
        # to see what columns are required
        print("✅ Products table exists")
        
        # Try to insert a minimal record to see what's required
        test_data = {
            "product_id": "test-123",
            "thumbnail_url": "test-url",
            "video_url": "test-video",
            "screenshots_urls": "[]"
        }
        
        print("🧪 Testing insert with minimal data...")
        result = supabase.table('products').insert(test_data).execute()
        print("✅ Insert successful with minimal data")
        
        # Clean up test data
        supabase.table('products').delete().eq('product_id', 'test-123').execute()
        print("🧹 Cleaned up test data")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        
        # Check if it's a column constraint error
        if "null value in column" in str(e):
            print("\n🔧 This looks like a missing required column.")
            print("Let's check what columns your table actually has...")
            
            # Try to get a sample record to see the structure
            try:
                result = supabase.table('products').select('*').limit(1).execute()
                if result.data:
                    print("\n📋 Current table columns:")
                    for key in result.data[0].keys():
                        print(f"   - {key}")
                else:
                    print("\n📋 Table is empty, but exists")
            except Exception as e2:
                print(f"❌ Couldn't get table structure: {str(e2)}")
        
        return False

def fix_table_structure():
    """Add missing columns if needed"""
    print("\n🔧 Attempting to fix table structure...")
    
    # Try to add a name column if it's missing
    try:
        # This would need to be done in the Supabase dashboard
        print("📋 To fix this, you need to:")
        print("1. Go to your Supabase Dashboard")
        print("2. Navigate to Table Editor > products")
        print("3. Add a 'name' column (text, nullable)")
        print("4. Or remove the NOT NULL constraint from existing columns")
        print("\nAlternatively, we can modify the code to match your table structure.")
        
    except Exception as e:
        print(f"❌ Error fixing table: {str(e)}")

def main():
    print("🚀 Products Table Structure Check\n")
    
    if check_table_structure():
        print("\n✅ Table structure looks good!")
        print("The issue might be elsewhere.")
    else:
        fix_table_structure()

if __name__ == "__main__":
    main() 