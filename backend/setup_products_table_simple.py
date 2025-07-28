#!/usr/bin/env python3
"""
Simple setup script for products table
This script provides instructions for manually creating the products table
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

def test_connection():
    """Test the Supabase connection"""
    try:
        print("🔍 Testing Supabase connection...")
        # Try to query the products table (it might not exist yet)
        result = supabase.table('products').select('count').limit(1).execute()
        print("✅ Products table exists and connection is working!")
        return True
    except Exception as e:
        print(f"⚠️  Products table doesn't exist yet: {str(e)}")
        return False

def create_table_manually():
    """Provide instructions for manual table creation"""
    print("\n📋 MANUAL TABLE SETUP INSTRUCTIONS:")
    print("=" * 50)
    print("1. Go to your Supabase Dashboard:")
    print(f"   {supabase_url.replace('/rest/v1', '')}")
    print("\n2. Navigate to 'Table Editor' in the left sidebar")
    print("\n3. Click 'Create a new table'")
    print("\n4. Use these settings:")
    print("   - Name: products")
    print("   - Enable Row Level Security: ✅")
    print("\n5. Add these columns:")
    print("   - id (uuid, primary key, default: gen_random_uuid())")
    print("   - product_id (varchar, unique, not null)")
    print("   - thumbnail_url (text)")
    print("   - video_url (text)")
    print("   - screenshots_urls (text)")
    print("   - created_at (timestamptz, default: now())")
    print("   - updated_at (timestamptz, default: now())")
    print("\n6. Click 'Save' to create the table")
    print("\n7. Go to 'Authentication' > 'Policies'")
    print("   - Find the 'products' table")
    print("   - Click 'New Policy'")
    print("   - Choose 'Create a policy from scratch'")
    print("   - Name: 'Public can view products'")
    print("   - Target roles: public")
    print("   - Using expression: true")
    print("   - Click 'Review' and 'Save'")
    print("\n8. Create another policy:")
    print("   - Name: 'Public can insert products'")
    print("   - Target roles: public")
    print("   - Using expression: true")
    print("   - Click 'Review' and 'Save'")
    print("\n9. Run this script again to test the connection")

def main():
    print("🚀 ScreenMerch Products Table Setup\n")
    
    # Test if the table already exists
    if test_connection():
        print("\n✅ Products table is already set up and working!")
        print("You can now use the 'Make Merch' button without errors.")
        return
    
    # Provide manual setup instructions
    create_table_manually()
    
    print("\n" + "=" * 50)
    print("After following the steps above, run this script again to verify the setup.")
    print("=" * 50)

if __name__ == "__main__":
    main() 