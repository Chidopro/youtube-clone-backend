#!/usr/bin/env python3
"""
Fix user roles in the database
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
    print("❌ Missing Supabase environment variables")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

def fix_user_roles():
    """Fix user roles to ensure all users have 'creator' role"""
    try:
        print("🔧 Fixing user roles...")
        
        # Get all users
        result = supabase.table('users').select('*').execute()
        
        if not result.data:
            print("❌ No users found")
            return
        
        for user in result.data:
            user_id = user.get('id')
            current_role = user.get('role')
            email = user.get('email')
            
            print(f"  Checking user: {email}")
            print(f"    Current role: {current_role}")
            
            # If role is missing or not 'creator', fix it
            if not current_role or current_role != 'creator':
                print(f"    ❌ Role needs fixing...")
                
                # Update the user role to 'creator'
                update_result = supabase.table('users').update({
                    'role': 'creator',
                    'updated_at': 'now()'
                }).eq('id', user_id).execute()
                
                if update_result.data:
                    print(f"    ✅ Role updated to 'creator'")
                else:
                    print(f"    ❌ Failed to update role")
            else:
                print(f"    ✅ Role is already 'creator'")
            
            print("    ---")
            
    except Exception as e:
        print(f"❌ Error fixing user roles: {str(e)}")

def verify_fix():
    """Verify that all users now have creator role"""
    try:
        print("\n🔍 Verifying user roles...")
        
        result = supabase.table('users').select('*').execute()
        
        if result.data:
            print(f"✅ Found {len(result.data)} users:")
            for user in result.data:
                print(f"  - Email: {user.get('email')}")
                print(f"    Role: {user.get('role')}")
                print(f"    Status: {'✅' if user.get('role') == 'creator' else '❌'}")
                print("    ---")
        else:
            print("❌ No users found")
            
    except Exception as e:
        print(f"❌ Error verifying users: {str(e)}")

if __name__ == "__main__":
    print("🚀 Starting user role fix...\n")
    fix_user_roles()
    verify_fix()
    print("\n✅ User role fix complete!") 