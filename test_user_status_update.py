#!/usr/bin/env python3
"""
Test script to verify user status update functionality
This script will help debug the user suspension issue
"""

import os
import sys
from supabase import create_client, Client

def test_user_status_update():
    """Test the user status update functionality"""
    
    # Get Supabase credentials from environment variables
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    
    if not url or not key:
        print("❌ Missing Supabase credentials")
        print("Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables")
        return False
    
    try:
        # Create Supabase client
        supabase: Client = create_client(url, key)
        
        print("🔍 Testing user status update functionality...")
        
        # First, let's find a test user (Stephanie Smit)
        print("\n1. Searching for Stephanie Smit...")
        result = supabase.table('users').select('*').ilike('email', '%stephanie%').execute()
        
        if not result.data:
            print("❌ No users found with 'stephanie' in email")
            return False
        
        user = result.data[0]
        print(f"✅ Found user: {user['email']} (ID: {user['id']})")
        print(f"   Current status: {user.get('status', 'NULL')}")
        
        # Test updating status to suspended
        print("\n2. Testing status update to 'suspended'...")
        update_result = supabase.table('users').update({
            'status': 'suspended'
        }).eq('id', user['id']).select().execute()
        
        if update_result.data:
            updated_user = update_result.data[0]
            print(f"✅ Status updated successfully!")
            print(f"   New status: {updated_user['status']}")
        else:
            print("❌ Failed to update status")
            return False
        
        # Test updating status back to active
        print("\n3. Testing status update to 'active'...")
        update_result = supabase.table('users').update({
            'status': 'active'
        }).eq('id', user['id']).select().execute()
        
        if update_result.data:
            updated_user = update_result.data[0]
            print(f"✅ Status updated successfully!")
            print(f"   New status: {updated_user['status']}")
        else:
            print("❌ Failed to update status")
            return False
        
        # Test querying users with status filter
        print("\n4. Testing status filtering...")
        suspended_users = supabase.table('users').select('*').eq('status', 'suspended').execute()
        active_users = supabase.table('users').select('*').eq('status', 'active').execute()
        
        print(f"   Suspended users: {len(suspended_users.data)}")
        print(f"   Active users: {len(active_users.data)}")
        
        print("\n✅ All tests passed! User status update functionality is working correctly.")
        return True
        
    except Exception as e:
        print(f"❌ Error during testing: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_user_status_update()
    sys.exit(0 if success else 1)
