#!/usr/bin/env python3
"""
Script to check user password in database
"""

import os
import sys
from supabase import create_client, Client

def check_user_password():
    """Check the user's password in the database"""
    
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
        
        email = "chidopro@proton.me"
        password = "VieG369Bbk8!"
        
        print(f"🔍 Checking user account for: {email}")
        
        # Get user from database
        result = supabase.table('users').select('*').eq('email', email).execute()
        
        if not result.data:
            print(f"❌ No user found with email: {email}")
            print("The user account doesn't exist in the database.")
            return False
        
        user = result.data[0]
        stored_password = user.get('password_hash', '')
        
        print(f"✅ User found:")
        print(f"   ID: {user.get('id')}")
        print(f"   Email: {user.get('email')}")
        print(f"   Display Name: {user.get('display_name')}")
        print(f"   Role: {user.get('role')}")
        print(f"   Stored Password: '{stored_password}'")
        print(f"   Expected Password: '{password}'")
        print(f"   Passwords Match: {password == stored_password}")
        
        if password != stored_password:
            print(f"\n🔧 Fix: Update the password in the database")
            print(f"Run this SQL command in Supabase:")
            print(f"UPDATE users SET password_hash = '{password}' WHERE email = '{email}';")
            
            # Offer to update the password
            update = input("\nWould you like me to update the password now? (y/n): ")
            if update.lower() == 'y':
                update_result = supabase.table('users').update({
                    'password_hash': password
                }).eq('email', email).execute()
                
                if update_result.data:
                    print("✅ Password updated successfully!")
                    print("You should now be able to log in with your credentials.")
                else:
                    print("❌ Failed to update password")
        else:
            print("✅ Password is correct in the database")
            print("The login issue might be elsewhere (frontend, network, etc.)")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during check: {str(e)}")
        return False

if __name__ == "__main__":
    success = check_user_password()
    sys.exit(0 if success else 1)
