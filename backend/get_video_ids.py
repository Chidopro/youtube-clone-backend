from supabase import create_client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY'))

try:
    print("🔍 Fetching videos from database...")
    
    # Get a few videos to test with
    result = supabase.table('videos2').select('id, title, user_id').limit(5).execute()
    
    if result.data:
        print(f"\n✅ Found {len(result.data)} videos:")
        print("-" * 60)
        for i, video in enumerate(result.data, 1):
            print(f"{i}. ID: {video['id']}")
            print(f"   Title: {video.get('title', 'No title')}")
            print(f"   User ID: {video.get('user_id', 'No user')}")
            print()
        
        print("📝 To test deletion, use one of these IDs:")
        for video in result.data:
            print(f"   curl -X DELETE https://copy5-backend.fly.dev/api/videos/{video['id']}")
            
    else:
        print("❌ No videos found in database")
        
except Exception as e:
    print(f"❌ Error: {e}")
