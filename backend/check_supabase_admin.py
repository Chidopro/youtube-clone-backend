#!/usr/bin/env python3
"""
Check Supabase database for admin user
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

def check_supabase():
    print("🔍 Checking Supabase database for admin user...")
    
    # Load environment variables
    load_dotenv()
    
    # Get Supabase credentials
    supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase environment variables")
        return
    
    print(f"✅ Supabase URL: {supabase_url}")
    print(f"✅ Supabase Key: {supabase_key[:20]}...")
    
    try:
        # Create Supabase client
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Check if users table exists and get admin user
        print("\n1️⃣ Checking users table...")
        result = supabase.table('users').select('*').eq('email', 'chidopro@proton.me').execute()
        
        if result.data:
            user = result.data[0]
            print("✅ Admin user found in database:")
            print(f"   ID: {user.get('id')}")
            print(f"   Email: {user.get('email')}")
            print(f"   Role: {user.get('role')}")
            print(f"   Status: {user.get('status')}")
            print(f"   Password Hash: {user.get('password_hash')}")
            print(f"   Display Name: {user.get('display_name')}")
            print(f"   Created: {user.get('created_at')}")
            print(f"   Updated: {user.get('updated_at')}")
            
            # Check if password matches what we expect
            stored_password = user.get('password_hash', '')
            expected_password = 'VieG369Bbk8!'
            
            if stored_password == expected_password:
                print("✅ Password matches expected value")
            else:
                print(f"❌ Password mismatch!")
                print(f"   Stored: '{stored_password}' (length: {len(stored_password)})")
                print(f"   Expected: '{expected_password}' (length: {len(expected_password)})")
                
        else:
            print("❌ Admin user NOT found in database")
            
        # Check all users with admin role
        print("\n2️⃣ Checking all admin users...")
        admin_result = supabase.table('users').select('*').eq('role', 'admin').execute()
        
        if admin_result.data:
            print(f"✅ Found {len(admin_result.data)} admin user(s):")
            for admin in admin_result.data:
                print(f"   - {admin.get('email')} (ID: {admin.get('id')})")
        else:
            print("❌ No admin users found")
            
        # Check all users
        print("\n3️⃣ Checking all users...")
        all_users = supabase.table('users').select('*').execute()
        
        if all_users.data:
            print(f"✅ Found {len(all_users.data)} total user(s):")
            for user in all_users.data:
                print(f"   - {user.get('email')} (Role: {user.get('role')}, Status: {user.get('status')})")
        else:
            print("❌ No users found")
            
    except Exception as e:
        print(f"❌ Error accessing Supabase: {e}")

if __name__ == "__main__":
    check_supabase()
