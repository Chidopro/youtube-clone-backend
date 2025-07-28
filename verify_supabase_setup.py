#!/usr/bin/env python3
"""
Verify Supabase database setup
"""

import os
import requests
from supabase import create_client, Client

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def check_environment_variables():
    """Check if environment variables are set"""
    print("🔧 Checking Environment Variables")
    print("=" * 50)
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
    
    print(f"VITE_SUPABASE_URL: {'✅ Set' if supabase_url else '❌ Missing'}")
    print(f"VITE_SUPABASE_ANON_KEY: {'✅ Set' if supabase_key else '❌ Missing'}")
    
    if supabase_url:
        print(f"URL: {supabase_url}")
    if supabase_key:
        print(f"Key: {supabase_key[:10]}...{supabase_key[-10:]}")
    
    return supabase_url and supabase_key

def test_supabase_connection():
    """Test connection to Supabase"""
    print("\n🌐 Testing Supabase Connection")
    print("=" * 50)
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Missing environment variables")
        return None
    
    try:
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Test basic connection
        result = supabase.table('users').select('*').limit(1).execute()
        
        if result.data is not None:
            print("✅ Successfully connected to Supabase")
            return supabase
        else:
            print("❌ Cannot query users table")
            return None
            
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        return None

def check_table_structure(supabase):
    """Check if the required columns exist"""
    print("\n📊 Checking Table Structure")
    print("=" * 50)
    
    try:
        # Try to get table info by attempting to insert with all required fields
        test_data = {
            'email': 'structure_test@example.com',
            'password_hash': 'test_hash',
            'role': 'customer',
            'is_admin': False,
            'status': 'active',
            'email_verified': False,
            'email_verification_token': None
        }
        
        print("Testing column structure...")
        result = supabase.table('users').insert(test_data).execute()
        
        if result.data:
            print("✅ All required columns exist!")
            
            # Clean up test data
            supabase.table('users').delete().eq('email', 'structure_test@example.com').execute()
            print("🧹 Test data cleaned up")
            
            return True
        else:
            print("❌ Insert failed - columns may be missing")
            return False
            
    except Exception as e:
        print(f"❌ Column check failed: {str(e)}")
        
        # Try to get more specific error info
        if "column" in str(e).lower() and "does not exist" in str(e).lower():
            print("🔍 This suggests the database columns are missing!")
            print("Please run the SQL script in Supabase SQL Editor")
        elif "permission" in str(e).lower():
            print("🔍 This suggests a permissions issue with RLS policies")
        else:
            print("🔍 Unknown database error")
        
        return False

def show_sql_script():
    """Show the SQL script that needs to be run"""
    print("\n📝 Required SQL Script")
    print("=" * 50)
    print("If the columns are missing, run this in Supabase SQL Editor:")
    print()
    print("```sql")
    print("-- Add authentication columns to users table")
    print("ALTER TABLE users")
    print("ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),")
    print("ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('customer', 'creator', 'admin')),")
    print("ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,")
    print("ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),")
    print("ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,")
    print("ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);")
    print()
    print("-- Create indexes for performance")
    print("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
    print("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);")
    print("CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);")
    print()
    print("-- Update RLS policies for authentication")
    print("DROP POLICY IF EXISTS \"Public can view users for authentication\" ON users;")
    print("CREATE POLICY \"Public can view users for authentication\" ON users")
    print("    FOR SELECT USING (true);")
    print()
    print("DROP POLICY IF EXISTS \"Public can insert users for signup\" ON users;")
    print("CREATE POLICY \"Public can insert users for signup\" ON users")
    print("    FOR INSERT WITH CHECK (true);")
    print()
    print("DROP POLICY IF EXISTS \"Users can update own profile\" ON users;")
    print("CREATE POLICY \"Users can update own profile\" ON users")
    print("    FOR UPDATE USING (auth.uid() = id);")
    print("```")

if __name__ == "__main__":
    print("🔍 Supabase Database Setup Verification")
    print("=" * 50)
    
    # Check environment variables
    env_ok = check_environment_variables()
    
    if not env_ok:
        print("\n❌ Environment variables are missing!")
        print("Please check your .env file or environment setup")
        exit(1)
    
    # Test connection
    supabase = test_supabase_connection()
    
    if not supabase:
        print("\n❌ Cannot connect to Supabase!")
        print("Please check your Supabase URL and API key")
        exit(1)
    
    # Check table structure
    structure_ok = check_table_structure(supabase)
    
    print("\n📋 Summary:")
    print("=" * 50)
    
    if structure_ok:
        print("🎉 Database setup is correct!")
        print("✅ All required columns exist")
        print("✅ RLS policies should be working")
        print("\nIf you're still getting 'Account creation failed', the issue might be:")
        print("1. Backend code issue")
        print("2. Environment variable mismatch")
        print("3. Database connection issue in the backend")
    else:
        print("❌ Database setup is incomplete!")
        print("❌ Required columns are missing")
        print("\nPlease run the SQL script in Supabase SQL Editor")
        show_sql_script() 