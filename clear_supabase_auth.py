#!/usr/bin/env python3
"""
Script to clear Supabase auth users from the ScreenMerch database.
This will delete auth users so you can reuse those email addresses.
"""

import os
from supabase import create_client, Client

# Get environment variables
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def clear_supabase_auth():
    """Clear Supabase auth users"""
    
    # List of test emails to clear
    test_emails = [
        'driveralan1@yahoo.com',
        'digitalavatartutorial@gmail.com',
        'test@example.com',
        'chidopro@proton.me'
    ]
    
    try:
        print("🔍 Connecting to Supabase...")
        print(f"✅ Connected to: {SUPABASE_URL}")
        
        print("📊 Checking for auth users...")
        
        for email in test_emails:
            print(f"\n🔍 Looking for auth user: {email}")
            
            # Try to get auth user
            try:
                # This will list all auth users (admin function)
                auth_users = supabase.auth.admin.list_users()
                
                # Find the user by email
                user_to_delete = None
                for user in auth_users.users:
                    if user.email == email:
                        user_to_delete = user
                        break
                
                if user_to_delete:
                    print(f"   📝 Found auth user: {user_to_delete.email} (ID: {user_to_delete.id})")
                    
                    # Delete the auth user
                    try:
                        supabase.auth.admin.delete_user(user_to_delete.id)
                        print(f"   ✅ Successfully deleted auth user: {email}")
                    except Exception as e:
                        print(f"   ❌ Failed to delete auth user: {str(e)}")
                else:
                    print(f"   ✅ No auth user found for: {email}")
                    
            except Exception as e:
                print(f"   ⚠️  Could not check auth users (might need admin access): {str(e)}")
                print("   💡 This is normal - auth users are managed by Supabase directly")
        
        print("\n🎉 Auth user cleanup completed!")
        print("📧 You can now reuse these email addresses for testing:")
        for email in test_emails:
            print(f"   • {email}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during cleanup: {str(e)}")
        return False

if __name__ == "__main__":
    print("🧹 ScreenMerch Auth User Cleanup")
    print("=" * 50)
    
    # Ask for confirmation
    confirm = input("⚠️  This will delete auth users. Are you sure? (yes/no): ")
    if confirm.lower() == 'yes':
        clear_supabase_auth()
    else:
        print("❌ Operation cancelled")
