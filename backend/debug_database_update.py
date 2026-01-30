#!/usr/bin/env python3
"""
DEV/DEBUG ONLY. Do not run in production.
May print sensitive user data. Use only in secure local environment.
Debug database update issues
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

def debug_update():
    print("🔍 Debugging database update issues...")
    
    # Load environment variables
    load_dotenv()
    
    # Get Supabase credentials
    supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase environment variables")
        return
    
    try:
        # Create Supabase client
        supabase: Client = create_client(supabase_url, supabase_key)
        
        print("1️⃣ Testing simple update...")
        
        # Try a simple update first
        try:
            result = supabase.table('users').update({
                'display_name': 'Test Update'
            }).eq('email', 'chidopro@proton.me').execute()
            
            print(f"Simple update result: {result}")
            if result.data:
                print("✅ Simple update worked!")
            else:
                print("❌ Simple update failed")
                
        except Exception as e:
            print(f"❌ Simple update error: {e}")
            
        print("\n2️⃣ Testing role update...")
        
        # Try updating just the role
        try:
            result = supabase.table('users').update({
                'role': 'admin'
            }).eq('email', 'chidopro@proton.me').execute()
            
            print(f"Role update result: {result}")
            if result.data:
                print("✅ Role update worked!")
            else:
                print("❌ Role update failed")
                
        except Exception as e:
            print(f"❌ Role update error: {e}")
            
        print("\n3️⃣ Testing password update...")
        
        # Try updating just the password
        try:
            result = supabase.table('users').update({
                'password_hash': 'VieG369Bbk8!'
            }).eq('email', 'chidopro@proton.me').execute()
            
            print(f"Password update result: {result}")
            if result.data:
                print("✅ Password update worked!")
            else:
                print("❌ Password update failed")
                
        except Exception as e:
            print(f"❌ Password update error: {e}")
            
        print("\n4️⃣ Checking current state...")
        
        # Check current state
        check_result = supabase.table('users').select('*').eq('email', 'chidopro@proton.me').execute()
        if check_result.data:
            user = check_result.data[0]
            print(f"Current state: Role={user.get('role')}, Password={user.get('password_hash')}, Display={user.get('display_name')}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    debug_update()
