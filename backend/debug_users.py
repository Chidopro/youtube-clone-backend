#!/usr/bin/env python3
"""
Debug script to check user data in the database
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

def check_users():
    """Check all users in the database"""
    try:
        print("🔍 Checking users table...")
        
        # Get all users
        result = supabase.table('users').select('*').execute()
        
        if result.data:
            print(f"✅ Found {len(result.data)} users:")
            for user in result.data:
                print(f"  - ID: {user.get('id')}")
                print(f"    Email: {user.get('email')}")
                print(f"    Display Name: {user.get('display_name')}")
                print(f"    Role: {user.get('role')}")
                print(f"    Created: {user.get('created_at')}")
                print(f"    Updated: {user.get('updated_at')}")
                print("    ---")
        else:
            print("❌ No users found in database")
            
    except Exception as e:
        print(f"❌ Error checking users: {str(e)}")

def check_user_subscriptions():
    """Check user subscriptions"""
    try:
        print("\n🔍 Checking user_subscriptions table...")
        
        result = supabase.table('user_subscriptions').select('*').execute()
        
        if result.data:
            print(f"✅ Found {len(result.data)} user subscriptions:")
            for sub in result.data:
                print(f"  - User ID: {sub.get('user_id')}")
                print(f"    Tier: {sub.get('tier')}")
                print(f"    Status: {sub.get('status')}")
                print("    ---")
        else:
            print("❌ No user subscriptions found")
            
    except Exception as e:
        print(f"❌ Error checking user subscriptions: {str(e)}")

def check_videos():
    """Check videos table"""
    try:
        print("\n🔍 Checking videos2 table...")
        
        result = supabase.table('videos2').select('*').execute()
        
        if result.data:
            print(f"✅ Found {len(result.data)} videos:")
            for video in result.data:
                print(f"  - ID: {video.get('id')}")
                print(f"    Title: {video.get('title')}")
                print(f"    User ID: {video.get('user_id')}")
                print(f"    Status: {video.get('verification_status')}")
                print("    ---")
        else:
            print("❌ No videos found")
            
    except Exception as e:
        print(f"❌ Error checking videos: {str(e)}")

if __name__ == "__main__":
    print("🚀 Starting database diagnostics...\n")
    check_users()
    check_user_subscriptions()
    check_videos()
    print("\n✅ Diagnostics complete!") 