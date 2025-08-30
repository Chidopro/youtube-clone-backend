#!/usr/bin/env python3
"""
Script to clear test accounts from the ScreenMerch database.
This will delete test accounts so you can reuse those email addresses.
"""

import os
from supabase import create_client, Client

# Get environment variables
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def clear_test_accounts():
    """Clear test accounts from the database"""
    
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
        
        print("📊 Checking for test accounts...")
        
        for email in test_emails:
            print(f"\n🔍 Looking for account: {email}")
            
            # Find the user
            user_result = supabase.table('users').select('id, email, display_name').eq('email', email).execute()
            
            if user_result.data:
                user = user_result.data[0]
                user_id = user['id']
                display_name = user.get('display_name', 'Unknown')
                
                print(f"   📝 Found user: {display_name} (ID: {user_id})")
                
                # Delete related data first
                print("   🗑️  Deleting related data...")
                
                # Delete user subscriptions
                try:
                    supabase.table('user_subscriptions').delete().eq('user_id', user_id).execute()
                    print("      ✅ Deleted user subscriptions")
                except Exception as e:
                    print(f"      ⚠️  No user subscriptions to delete: {str(e)}")
                
                # Delete channel subscriptions (where they are the channel)
                try:
                    supabase.table('subscriptions').delete().eq('channel_id', user_id).execute()
                    print("      ✅ Deleted channel subscriptions")
                except Exception as e:
                    print(f"      ⚠️  No channel subscriptions to delete: {str(e)}")
                
                # Delete subscriber subscriptions (where they are the subscriber)
                try:
                    supabase.table('subscriptions').delete().eq('subscriber_id', user_id).execute()
                    print("      ✅ Deleted subscriber subscriptions")
                except Exception as e:
                    print(f"      ⚠️  No subscriber subscriptions to delete: {str(e)}")
                
                # Delete videos
                try:
                    supabase.table('videos2').delete().eq('user_id', user_id).execute()
                    print("      ✅ Deleted videos")
                except Exception as e:
                    print(f"      ⚠️  No videos to delete: {str(e)}")
                
                # Delete products
                try:
                    supabase.table('products').delete().eq('user_id', user_id).execute()
                    print("      ✅ Deleted products")
                except Exception as e:
                    print(f"      ⚠️  No products to delete: {str(e)}")
                
                # Delete sales
                try:
                    supabase.table('sales').delete().eq('user_id', user_id).execute()
                    print("      ✅ Deleted sales")
                except Exception as e:
                    print(f"      ⚠️  No sales to delete: {str(e)}")
                
                # Finally, delete the user
                try:
                    supabase.table('users').delete().eq('id', user_id).execute()
                    print(f"   ✅ Successfully deleted user: {display_name}")
                except Exception as e:
                    print(f"   ❌ Failed to delete user: {str(e)}")
                
            else:
                print(f"   ✅ No account found for: {email}")
        
        print("\n🎉 Test account cleanup completed!")
        print("📧 You can now reuse these email addresses for testing:")
        for email in test_emails:
            print(f"   • {email}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during cleanup: {str(e)}")
        return False

if __name__ == "__main__":
    print("🧹 ScreenMerch Test Account Cleanup")
    print("=" * 50)
    
    # Ask for confirmation
    confirm = input("⚠️  This will delete test accounts. Are you sure? (yes/no): ")
    if confirm.lower() == 'yes':
        clear_test_accounts()
    else:
        print("❌ Operation cancelled")
