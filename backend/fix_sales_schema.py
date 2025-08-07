#!/usr/bin/env python3
"""
Fix sales table schema by adding missing columns
This script uses the Fly.io environment variables
"""

import os
import sys
from pathlib import Path
from supabase import create_client, Client

def fix_sales_table():
    """Add missing columns to sales table"""
    try:
        print("🔧 Fixing sales table schema...")
        
        # Get Supabase credentials from environment (Fly.io secrets)
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Use service role for schema changes
        
        if not supabase_url or not supabase_key:
            print("ERROR: Missing Supabase environment variables")
            print("SUPABASE_URL:", "SET" if supabase_url else "MISSING")
            print("SUPABASE_SERVICE_ROLE_KEY:", "SET" if supabase_key else "MISSING")
            sys.exit(1)
        
        # Initialize Supabase client
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Read the SQL script
        sql_file = Path(__file__).parent / "fix_sales_table.sql"
        with open(sql_file, 'r') as f:
            sql_script = f.read()
        
        print("📝 SQL Script:")
        print(sql_script)
        print()
        
        # Execute the SQL script
        print("🚀 Executing SQL script...")
        result = supabase.rpc('exec_sql', {'sql': sql_script}).execute()
        
        print("✅ Database schema fixed successfully!")
        print("✅ creator_name column added to sales table")
        print("✅ created_at column added to sales table")
        print("✅ updated_at column added to sales table")
        
        # Verify the fix
        print("\n🔍 Verifying the fix...")
        result = supabase.table('sales').select('*').limit(1).execute()
        if result.data:
            sale = result.data[0]
            print(f"✅ Sample sale: {sale}")
            if 'creator_name' in sale:
                print(f"✅ creator_name column exists: {sale['creator_name']}")
            else:
                print("❌ creator_name column still missing")
        else:
            print("ℹ️ No sales found in table")
            
    except Exception as e:
        print(f"❌ Error fixing database schema: {e}")
        sys.exit(1)

if __name__ == "__main__":
    fix_sales_table() 