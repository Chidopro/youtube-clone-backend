#!/usr/bin/env python3
"""
Clear all test user records from the custom users table
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

def clear_test_users():
    """Clear all test user records"""
    print("\n=== Clearing Test Users ===")
    
    # List of test emails to clear
    test_emails = [
        "digitalavatartutorial@gmail.com",
        "test@example.com",
        "chidopro@proton.me",
        "chidopro2@proton.me",
        "driveralan1@yahoo.com"
    ]
    
    try:
        for email in test_emails:
            print(f"Checking for user: {email}")
            
            # Find user in custom users table
            result = supabase.table('users').select('*').eq('email', email).execute()
            
            if result.data:
                user = result.data[0]
                user_id = user.get('id')
                print(f"  Found user with ID: {user_id}")
                
                # Delete from user_subscriptions first
                try:
                    sub_result = supabase.table('user_subscriptions').delete().eq('user_id', user_id).execute()
                    print(f"  Deleted {len(sub_result.data)} subscription records")
                except Exception as e:
                    print(f"  Error deleting subscriptions: {str(e)}")
                
                # Delete from users table
                try:
                    delete_result = supabase.table('users').delete().eq('id', user_id).execute()
                    print(f"  Deleted user record: {len(delete_result.data)} records")
                except Exception as e:
                    print(f"  Error deleting user: {str(e)}")
            else:
                print(f"  No user found with email: {email}")
        
        print("\n=== Verification ===")
        
        # Verify all test users are gone
        for email in test_emails:
            result = supabase.table('users').select('*').eq('email', email).execute()
            if result.data:
                print(f"❌ User still exists: {email}")
            else:
                print(f"✅ User cleared: {email}")
        
    except Exception as e:
        print(f"Error during cleanup: {str(e)}")

if __name__ == "__main__":
    clear_test_users()
