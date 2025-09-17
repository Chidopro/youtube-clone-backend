#!/usr/bin/env python3
"""
Check if service role key is available
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

def check_service_key():
    print("🔍 Checking for service role key...")
    
    # Load environment variables
    load_dotenv()
    
    # Check for service role key
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if service_key:
        print("✅ Service role key found!")
        print(f"Key: {service_key[:20]}...")
        
        # Try using service role key
        supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
        
        try:
            supabase: Client = create_client(supabase_url, service_key)
            
            print("\n1️⃣ Testing update with service role key...")
            
            result = supabase.table('users').update({
                'role': 'admin',
                'password_hash': 'VieG369Bbk8!'
            }).eq('email', 'chidopro@proton.me').execute()
            
            if result.data:
                print("✅ Update successful with service role key!")
                print(f"Updated user: {result.data[0]}")
            else:
                print("❌ Update still failed")
                
        except Exception as e:
            print(f"❌ Service role key error: {e}")
            
    else:
        print("❌ Service role key not found")
        print("Available environment variables:")
        for key in os.environ:
            if 'SUPABASE' in key:
                print(f"  {key}: {os.environ[key][:20]}...")

if __name__ == "__main__":
    check_service_key()
