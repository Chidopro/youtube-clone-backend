#!/usr/bin/env python3
"""
Test if database columns were added correctly
"""

import os
import requests
from supabase import create_client, Client

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def test_database_columns():
    """Test if the required database columns exist"""
    print("🔍 Testing Database Setup")
    print("=" * 50)
    
    # Get Supabase credentials
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase environment variables")
        print("Please make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set")
        return False
    
    try:
        # Create Supabase client
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Test if we can query the users table
        print("📊 Testing users table access...")
        result = supabase.table('users').select('*').limit(1).execute()
        
        if result.data is not None:
            print("✅ Users table is accessible")
            
            # Check if columns exist by trying to insert a test record
            print("🔧 Testing column structure...")
            
            test_user = {
                'email': 'test@example.com',
                'password_hash': 'test_hash',
                'role': 'customer',
                'is_admin': False,
                'status': 'active',
                'email_verified': False,
                'email_verification_token': None
            }
            
            # Try to insert (this will fail if columns don't exist)
            try:
                insert_result = supabase.table('users').insert(test_user).execute()
                print("✅ All required columns exist!")
                
                # Clean up test record
                supabase.table('users').delete().eq('email', 'test@example.com').execute()
                print("🧹 Test record cleaned up")
                
                return True
                
            except Exception as e:
                print(f"❌ Column test failed: {str(e)}")
                print("This means the database columns are missing!")
                return False
                
        else:
            print("❌ Cannot access users table")
            return False
            
    except Exception as e:
        print(f"❌ Database connection failed: {str(e)}")
        return False

def test_backend_connection():
    """Test if backend can connect to database"""
    print("\n🌐 Testing Backend Connection")
    print("=" * 50)
    
    try:
        response = requests.get('https://backend-hidden-firefly-7865.fly.dev/api/health')
        if response.status_code == 200:
            print("✅ Backend is running")
            return True
        else:
            print(f"❌ Backend returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to backend: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Database Setup Verification")
    print("=" * 50)
    
    # Test backend connection
    backend_ok = test_backend_connection()
    
    # Test database columns
    db_ok = test_database_columns()
    
    print("\n📋 Summary:")
    print("=" * 50)
    
    if backend_ok and db_ok:
        print("🎉 Everything is working!")
        print("✅ Backend is running")
        print("✅ Database columns are set up")
        print("\nYou can now create accounts on your product page!")
    elif backend_ok and not db_ok:
        print("⚠️ Backend is running but database needs setup")
        print("❌ Database columns are missing")
        print("\nPlease run the SQL script in Supabase as described in DATABASE_SETUP_GUIDE.md")
    else:
        print("❌ Multiple issues detected")
        print("Please check both backend deployment and database setup") 