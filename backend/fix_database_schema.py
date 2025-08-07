#!/usr/bin/env python3
"""
Fix database schema by adding missing creator_name column to products table
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

# Initialize Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

def fix_products_table():
    """Add missing creator_name column to products table"""
    try:
        print("🔧 Fixing products table schema...")
        
        # Read the SQL script
        sql_file = Path(__file__).parent / "fix_products_table.sql"
        with open(sql_file, 'r') as f:
            sql_script = f.read()
        
        print("📝 SQL Script:")
        print(sql_script)
        print()
        
        # Execute the SQL script
        print("🚀 Executing SQL script...")
        result = supabase.rpc('exec_sql', {'sql': sql_script}).execute()
        
        print("✅ Database schema fixed successfully!")
        print("✅ creator_name column added to products table")
        
        # Verify the fix
        print("\n🔍 Verifying the fix...")
        result = supabase.table('products').select('*').limit(1).execute()
        if result.data:
            product = result.data[0]
            print(f"✅ Sample product: {product}")
            if 'creator_name' in product:
                print(f"✅ creator_name column exists: {product['creator_name']}")
            else:
                print("❌ creator_name column still missing")
        else:
            print("ℹ️ No products found in table")
            
    except Exception as e:
        print(f"❌ Error fixing database schema: {e}")
        sys.exit(1)

if __name__ == "__main__":
    fix_products_table() 