#!/usr/bin/env python3
"""
Script to set up test subscribers Alan Armstrong and Cheedo V
for analytics testing purposes.
"""

import os
import sys
from supabase import create_client, Client

# Add the current directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import environment variables
from dotenv import load_dotenv
load_dotenv()

# Supabase configuration
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

def setup_test_subscribers():
    """Set up Alan Armstrong and Cheedo V as test subscribers"""
    
    print("🔧 Setting up test subscribers for analytics testing...")
    
    # Test subscriber data
    test_subscribers = [
        {
            "username": "alan_armstrong",
            "display_name": "Alan Armstrong",
            "email": "alan.armstrong@test.com",
            "profile_image_url": "https://via.placeholder.com/150/007bff/ffffff?text=AA"
        },
        {
            "username": "cheedo_v",
            "display_name": "Cheedo V", 
            "email": "cheedo.v@test.com",
            "profile_image_url": "https://via.placeholder.com/150/28a745/ffffff?text=CV"
        }
    ]
    
    created_users = []
    
    for subscriber in test_subscribers:
        try:
            print(f"📝 Creating subscriber: {subscriber['display_name']}")
            
            # Check if user already exists
            existing_user = supabase.table('users').select('id, username').eq('username', subscriber['username']).execute()
            
            if existing_user.data:
                print(f"   ⚠️  User {subscriber['username']} already exists, skipping...")
                created_users.append(existing_user.data[0])
                continue
            
            # Create user record
            user_data = {
                "username": subscriber['username'],
                "display_name": subscriber['display_name'],
                "email": subscriber['email'],
                "profile_image_url": subscriber['profile_image_url'],
                "created_at": "2024-01-01T00:00:00Z"  # Set to beginning of year for testing
            }
            
            result = supabase.table('users').insert(user_data).execute()
            
            if result.data:
                print(f"   ✅ Created user: {subscriber['display_name']} (ID: {result.data[0]['id']})")
                created_users.append(result.data[0])
            else:
                print(f"   ❌ Failed to create user: {subscriber['display_name']}")
                
        except Exception as e:
            print(f"   ❌ Error creating {subscriber['display_name']}: {str(e)}")
    
    print(f"\n📊 Setting up analytics data for {len(created_users)} subscribers...")
    
    # Set up analytics data with 0 values for testing
    for user in created_users:
        try:
            # Check if analytics record already exists
            existing_analytics = supabase.table('user_analytics').select('id').eq('user_id', user['id']).execute()
            
            if existing_analytics.data:
                print(f"   ⚠️  Analytics for {user['username']} already exists, updating to 0...")
                
                # Update existing analytics to 0
                supabase.table('user_analytics').update({
                    "total_views": 0,
                    "total_likes": 0,
                    "total_comments": 0,
                    "total_shares": 0,
                    "total_revenue": 0.0,
                    "products_sold": 0,
                    "last_updated": "2024-01-01T00:00:00Z"
                }).eq('user_id', user['id']).execute()
                
            else:
                print(f"   📈 Creating analytics record for {user['username']}...")
                
                # Create new analytics record with 0 values
                analytics_data = {
                    "user_id": user['id'],
                    "total_views": 0,
                    "total_likes": 0,
                    "total_comments": 0,
                    "total_shares": 0,
                    "total_revenue": 0.0,
                    "products_sold": 0,
                    "created_at": "2024-01-01T00:00:00Z",
                    "last_updated": "2024-01-01T00:00:00Z"
                }
                
                supabase.table('user_analytics').insert(analytics_data).execute()
                
            print(f"   ✅ Analytics set to 0 for {user['username']}")
            
        except Exception as e:
            print(f"   ❌ Error setting up analytics for {user['username']}: {str(e)}")
    
    print(f"\n🎉 Setup complete! Created/updated {len(created_users)} test subscribers:")
    for user in created_users:
        print(f"   • {user['display_name']} (@{user['username']}) - Analytics: 0")
    
    print(f"\n📋 Test subscribers are now ready for analytics testing!")
    print(f"   You can test the analytics page by visiting:")
    print(f"   • https://screenmerch.com/profile/alan_armstrong")
    print(f"   • https://screenmerch.com/profile/cheedo_v")
    print(f"   • Or check the sidebar on the homepage")

if __name__ == "__main__":
    setup_test_subscribers() 