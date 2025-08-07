#!/usr/bin/env python3
"""
Admin User Setup Script for ScreenMerch
This script helps you create an admin user account
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Get Supabase credentials
supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("❌ Error: Missing Supabase environment variables")
    print("Please check your .env file")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

def create_admin_user():
    """Create an admin user account"""
    print("🔧 ScreenMerch Admin User Setup")
    print("=" * 40)
    
    # Get admin details
    email = input("Enter admin email: ").strip().lower()
    password = input("Enter admin password: ").strip()
    display_name = input("Enter display name (optional): ").strip()
    
    if not email or not password:
        print("❌ Email and password are required")
        return
    
    try:
        # Check if user already exists
        existing_user = supabase.table('users').select('*').eq('email', email).execute()
        
        if existing_user.data:
            print(f"⚠️  User {email} already exists")
            choice = input("Do you want to make this user an admin? (y/n): ").strip().lower()
            
            if choice == 'y':
                # Update existing user to admin
                result = supabase.table('users').update({
                    'role': 'admin',
                    'is_admin': True
                }).eq('email', email).execute()
                
                if result.data:
                    print(f"✅ User {email} is now an admin!")
                else:
                    print("❌ Failed to update user to admin")
            else:
                print("Operation cancelled")
            return
        
        # Create new admin user
        new_user = {
            'email': email,
            'password_hash': password,  # In production, use proper hashing
            'role': 'admin',
            'is_admin': True,
            'status': 'active',
            'display_name': display_name or email.split('@')[0],
            'email_verified': True
        }
        
        result = supabase.table('users').insert(new_user).execute()
        
        if result.data:
            print(f"✅ Admin user {email} created successfully!")
            print(f"   Role: {result.data[0].get('role')}")
            print(f"   Display Name: {result.data[0].get('display_name')}")
            print("\n🎉 You can now log in at:")
            print("   https://backend-hidden-firefly-7865.fly.dev/admin/login")
        else:
            print("❌ Failed to create admin user")
            
    except Exception as e:
        print(f"❌ Error creating admin user: {str(e)}")

def list_admin_users():
    """List all admin users"""
    try:
        result = supabase.table('users').select('*').eq('is_admin', True).execute()
        
        if result.data:
            print("\n👥 Current Admin Users:")
            print("-" * 40)
            for user in result.data:
                print(f"  • {user.get('email')} ({user.get('display_name')})")
        else:
            print("No admin users found")
            
    except Exception as e:
        print(f"❌ Error listing admin users: {str(e)}")

if __name__ == "__main__":
    print("🚀 ScreenMerch Admin Setup")
    print("=" * 40)
    
    while True:
        print("\nOptions:")
        print("1. Create new admin user")
        print("2. List existing admin users")
        print("3. Exit")
        
        choice = input("\nSelect option (1-3): ").strip()
        
        if choice == '1':
            create_admin_user()
        elif choice == '2':
            list_admin_users()
        elif choice == '3':
            print("👋 Goodbye!")
            break
        else:
            print("❌ Invalid option. Please try again.") 