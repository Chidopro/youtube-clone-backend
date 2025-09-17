#!/usr/bin/env python3
"""
Fix admin user in database directly
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

def fix_admin():
    print("🔧 Fixing admin user in database...")
    
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
        
        print("1️⃣ Updating chidopro@proton.me to admin role...")
        
        # Update chidopro@proton.me to admin role with correct password
        result = supabase.table('users').update({
            'role': 'admin',
            'password_hash': 'VieG369Bbk8!',
            'display_name': 'Admin User',
            'status': 'active'
        }).eq('email', 'chidopro@proton.me').execute()
        
        if result.data:
            print("✅ chidopro@proton.me updated to admin!")
            print(f"   Updated user: {result.data[0]}")
        else:
            print("❌ Failed to update chidopro@proton.me")
            
        print("\n2️⃣ Removing admin role from admin@screenmerch.com...")
        
        # Remove admin role from old admin
        result2 = supabase.table('users').update({
            'role': 'customer'
        }).eq('email', 'admin@screenmerch.com').execute()
        
        if result2.data:
            print("✅ admin@screenmerch.com demoted to customer!")
        else:
            print("❌ Failed to demote admin@screenmerch.com")
            
        print("\n3️⃣ Verifying changes...")
        
        # Check chidopro@proton.me
        check_result = supabase.table('users').select('*').eq('email', 'chidopro@proton.me').execute()
        if check_result.data:
            user = check_result.data[0]
            print(f"✅ chidopro@proton.me: Role={user.get('role')}, Password={user.get('password_hash')}")
        
        # Check admin@screenmerch.com
        check_result2 = supabase.table('users').select('*').eq('email', 'admin@screenmerch.com').execute()
        if check_result2.data:
            user2 = check_result2.data[0]
            print(f"✅ admin@screenmerch.com: Role={user2.get('role')}")
            
        print("\n🎉 Database fix complete!")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    fix_admin()
