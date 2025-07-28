#!/usr/bin/env python3
"""
Setup authentication database for ScreenMerch
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("ERROR: Missing Supabase environment variables")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

def setup_auth_database():
    """Set up authentication database tables and columns"""
    print("🔧 Setting up authentication database...")
    
    try:
        # Check if users table exists and has required columns
        result = supabase.table('users').select('*').limit(1).execute()
        print("✅ Users table exists")
        
        # Try to add authentication columns if they don't exist
        # Note: We'll handle this through SQL script instead
        
        print("📝 Please run the following SQL in your Supabase SQL Editor:")
        print("=" * 60)
        print("""
-- Add authentication columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('customer', 'creator', 'admin')),
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Update RLS policies
DROP POLICY IF EXISTS "Public can view users for authentication" ON users;
CREATE POLICY "Public can view users for authentication" ON users
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert users for signup" ON users;
CREATE POLICY "Public can insert users for signup" ON users
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);
        """)
        print("=" * 60)
        
        # Test creating a user
        test_user = {
            'email': 'test@example.com',
            'password_hash': 'testpassword123',
            'username': 'testuser',
            'display_name': 'Test User',
            'role': 'customer',
            'status': 'active',
            'email_verified': False
        }
        
        print("🧪 Testing user creation...")
        result = supabase.table('users').insert(test_user).execute()
        
        if result.data:
            print("✅ Test user created successfully")
            # Clean up test user
            supabase.table('users').delete().eq('email', 'test@example.com').execute()
            print("✅ Test user cleaned up")
        else:
            print("❌ Failed to create test user")
            
    except Exception as e:
        print(f"❌ Error setting up database: {str(e)}")
        return False
    
    print("✅ Database setup completed!")
    return True

def test_authentication():
    """Test the authentication endpoints"""
    print("\n🧪 Testing authentication endpoints...")
    
    import requests
    
    base_url = "https://backend-hidden-firefly-7865.fly.dev"
    
    # Test signup
    signup_data = {
        "email": "test@example.com",
        "password": "testpassword123"
    }
    
    try:
        response = requests.post(f"{base_url}/api/auth/signup", 
                               json=signup_data,
                               headers={'Content-Type': 'application/json'})
        
        print(f"Signup Status: {response.status_code}")
        print(f"Signup Response: {response.json()}")
        
        if response.status_code == 200:
            print("✅ Signup test passed")
            
            # Test login
            login_data = {
                "email": "test@example.com",
                "password": "testpassword123"
            }
            
            response = requests.post(f"{base_url}/api/auth/login", 
                                   json=login_data,
                                   headers={'Content-Type': 'application/json'})
            
            print(f"Login Status: {response.status_code}")
            print(f"Login Response: {response.json()}")
            
            if response.status_code == 200:
                print("✅ Login test passed")
            else:
                print("❌ Login test failed")
        else:
            print("❌ Signup test failed")
            
    except Exception as e:
        print(f"❌ Authentication test error: {str(e)}")

if __name__ == "__main__":
    print("🚀 ScreenMerch Authentication Setup")
    print("=" * 50)
    
    # Setup database
    if setup_auth_database():
        # Test authentication
        test_authentication()
    
    print("\n📝 Next steps:")
    print("1. Run the SQL script in Supabase SQL Editor")
    print("2. Test the authentication on your product page")
    print("3. Implement email confirmation if needed") 