#!/usr/bin/env python3
"""
Test script to check backend database connection and user lookup
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
env_paths = [
    Path(__file__).parent / '.env',
    Path(__file__).parent / 'backend' / '.env',
    Path.cwd() / '.env'
]

for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        print(f"Loaded .env from: {env_path}")

# Get Supabase credentials
supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")

print(f"SUPABASE_URL: {supabase_url}")
print(f"SUPABASE_KEY: {'✓' if supabase_key else '✗'}")

if not supabase_url or not supabase_key:
    print("ERROR: Missing Supabase credentials")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

def test_user_lookup():
    """Test if we can find users in the database"""
    print("\n=== Testing User Lookup ===")
    
    # Test email that should NOT exist
    test_email = "test@example.com"
    
    try:
        # Check custom users table
        result = supabase.table('users').select('*').eq('email', test_email).execute()
        print(f"Custom users table - {test_email}: {len(result.data)} records found")
        
        if result.data:
            for user in result.data:
                print(f"  - ID: {user.get('id')}, Email: {user.get('email')}, Created: {user.get('created_at')}")
        
        # Check auth.users table
        auth_result = supabase.auth.admin.list_users()
        auth_users = [u for u in auth_result.users if u.email == test_email]
        print(f"Auth users table - {test_email}: {len(auth_users)} records found")
        
        if auth_users:
            for user in auth_users:
                print(f"  - ID: {user.id}, Email: {user.email}, Created: {user.created_at}")
        
        # Test the actual email that's causing issues
        actual_email = "digitalavatartutorial@gmail.com"
        
        print(f"\n--- Testing {actual_email} ---")
        
        # Check custom users table
        actual_result = supabase.table('users').select('*').eq('email', actual_email).execute()
        print(f"Custom users table - {actual_email}: {len(actual_result.data)} records found")
        
        if actual_result.data:
            for user in actual_result.data:
                print(f"  - ID: {user.get('id')}, Email: {user.get('email')}, Created: {user.get('created_at')}")
        
        # Check auth.users table
        actual_auth_users = [u for u in auth_result.users if u.email == actual_email]
        print(f"Auth users table - {actual_email}: {len(actual_auth_users)} records found")
        
        if actual_auth_users:
            for user in actual_auth_users:
                print(f"  - ID: {user.id}, Email: {user.email}, Created: {user.created_at}")
        
    except Exception as e:
        print(f"Error during user lookup: {str(e)}")

def test_table_structure():
    """Test what tables exist and their structure"""
    print("\n=== Testing Table Structure ===")
    
    try:
        # Check if users table exists
        result = supabase.table('users').select('id').limit(1).execute()
        print("✓ users table exists and is accessible")
        
        # Check if user_subscriptions table exists
        sub_result = supabase.table('user_subscriptions').select('id').limit(1).execute()
        print("✓ user_subscriptions table exists and is accessible")
        
    except Exception as e:
        print(f"Error checking table structure: {str(e)}")

if __name__ == "__main__":
    test_table_structure()
    test_user_lookup()
