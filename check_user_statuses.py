#!/usr/bin/env python3
"""
Script to check the current status of all users
This will help identify if the status field is properly set in the database
"""

import os
import sys
from supabase import create_client, Client

def check_user_statuses():
    """Check the current status of all users"""
    
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
        
        print("🔍 Checking user statuses...")
        
        # Get all users
        result = supabase.table('users').select('id, email, display_name, status, created_at').order('created_at', ascending=False).execute()
        
        if not result.data:
            print("❌ No users found")
            return False
        
        print(f"\n📊 Found {len(result.data)} users:")
        print("-" * 80)
        print(f"{'Email':<30} {'Display Name':<20} {'Status':<12} {'Created'}")
        print("-" * 80)
        
        status_counts = {'active': 0, 'suspended': 0, 'banned': 0, 'null': 0}
        
        for user in result.data:
            email = user.get('email', 'N/A')[:29]
            display_name = (user.get('display_name') or 'N/A')[:19]
            status = user.get('status')
            created_at = user.get('created_at', 'N/A')[:10] if user.get('created_at') else 'N/A'
            
            if status is None:
                status_display = 'NULL'
                status_counts['null'] += 1
            else:
                status_display = status.upper()
                status_counts[status] = status_counts.get(status, 0) + 1
            
            print(f"{email:<30} {display_name:<20} {status_display:<12} {created_at}")
        
        print("-" * 80)
        print(f"\n📈 Status Summary:")
        for status, count in status_counts.items():
            if count > 0:
                print(f"   {status.upper()}: {count}")
        
        # Check for Stephanie Smit specifically
        print(f"\n🔍 Looking for Stephanie Smit specifically...")
        stephanie_users = [u for u in result.data if 'stephanie' in (u.get('email') or '').lower() or 'stephanie' in (u.get('display_name') or '').lower()]
        
        if stephanie_users:
            print(f"Found {len(stephanie_users)} user(s) matching 'Stephanie':")
            for user in stephanie_users:
                print(f"   - {user.get('email')} (Status: {user.get('status', 'NULL')})")
        else:
            print("   No users found matching 'Stephanie'")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during check: {str(e)}")
        return False

if __name__ == "__main__":
    success = check_user_statuses()
    sys.exit(0 if success else 1)
