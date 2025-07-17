#!/usr/bin/env python3
"""
Emergency Video Deletion Script
This script allows you to delete videos from Supabase database and storage
without needing to log into the admin interface.

Usage:
    python delete_video_emergency.py
"""

import os
import sys
from supabase import create_client, Client
import requests
from urllib.parse import urlparse

# Supabase Configuration
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no"

def connect_to_supabase():
    """Connect to Supabase"""
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        print("✅ Connected to Supabase successfully")
        return supabase
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        return None

def list_all_videos(supabase):
    """List all videos in the database"""
    try:
        response = supabase.table("videos2").select("*").execute()
        videos = response.data
        print(f"\n📹 Found {len(videos)} videos in database:")
        print("-" * 80)
        
        for i, video in enumerate(videos, 1):
            print(f"{i}. ID: {video['id']}")
            print(f"   Title: {video.get('title', 'No title')}")
            print(f"   Channel: {video.get('channelTitle', 'Unknown')}")
            print(f"   Created: {video.get('created_at', 'Unknown')}")
            print(f"   Video URL: {video.get('video_url', 'No URL')[:100]}...")
            print(f"   Thumbnail: {video.get('thumbnail', 'No thumbnail')[:100]}...")
            print("-" * 80)
        
        return videos
    except Exception as e:
        print(f"❌ Error listing videos: {e}")
        return []

def delete_video_from_database(supabase, video_id):
    """Delete video from database"""
    try:
        # First get the video details to extract file paths
        response = supabase.table("videos2").select("*").eq("id", video_id).execute()
        if not response.data:
            print(f"❌ Video with ID {video_id} not found in database")
            return False
        
        video = response.data[0]
        video_url = video.get('video_url', '')
        thumbnail_url = video.get('thumbnail', '')
        
        # Delete from database
        delete_response = supabase.table("videos2").delete().eq("id", video_id).execute()
        print(f"✅ Deleted video {video_id} from database")
        
        return True, video_url, thumbnail_url
    except Exception as e:
        print(f"❌ Error deleting video from database: {e}")
        return False, None, None

def extract_file_path_from_url(url, bucket_name):
    """Extract file path from Supabase storage URL"""
    try:
        # Parse the URL to extract the file path
        # Example URL: https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/videos2/user_id/filename.mp4
        parsed = urlparse(url)
        path_parts = parsed.path.split('/')
        
        # Find the bucket name in the path
        try:
            bucket_index = path_parts.index(bucket_name)
            # Everything after the bucket name is the file path
            file_path = '/'.join(path_parts[bucket_index + 1:])
            return file_path
        except ValueError:
            print(f"❌ Could not find bucket '{bucket_name}' in URL: {url}")
            return None
    except Exception as e:
        print(f"❌ Error parsing URL {url}: {e}")
        return None

def delete_file_from_storage(supabase, file_url, bucket_name):
    """Delete file from Supabase storage"""
    try:
        file_path = extract_file_path_from_url(file_url, bucket_name)
        if not file_path:
            print(f"❌ Could not extract file path from URL: {file_url}")
            return False
        
        # Delete the file from storage
        response = supabase.storage.from_(bucket_name).remove([file_path])
        print(f"✅ Deleted file {file_path} from {bucket_name} bucket")
        return True
    except Exception as e:
        print(f"❌ Error deleting file from storage: {e}")
        return False

def delete_video_completely(supabase, video_id):
    """Delete video completely from both database and storage"""
    print(f"\n🗑️  Deleting video {video_id}...")
    
    # Delete from database and get file URLs
    success, video_url, thumbnail_url = delete_video_from_database(supabase, video_id)
    if not success:
        return False
    
    # Delete video file from storage
    if video_url:
        print(f"🗑️  Deleting video file...")
        delete_file_from_storage(supabase, video_url, "videos2")
    
    # Delete thumbnail file from storage
    if thumbnail_url:
        print(f"🗑️  Deleting thumbnail file...")
        delete_file_from_storage(supabase, thumbnail_url, "thumbnails")
    
    print(f"✅ Video {video_id} completely deleted!")
    return True

def main():
    """Main function"""
    print("🚨 EMERGENCY VIDEO DELETION TOOL")
    print("=" * 50)
    
    # Connect to Supabase
    supabase = connect_to_supabase()
    if not supabase:
        sys.exit(1)
    
    # List all videos
    videos = list_all_videos(supabase)
    if not videos:
        print("No videos found in database.")
        return
    
    # Ask user which video to delete
    while True:
        try:
            choice = input(f"\nEnter the number of the video to delete (1-{len(videos)}) or 'q' to quit: ").strip()
            
            if choice.lower() == 'q':
                print("Exiting...")
                break
            
            video_index = int(choice) - 1
            if 0 <= video_index < len(videos):
                video = videos[video_index]
                video_id = video['id']
                
                # Confirm deletion
                confirm = input(f"\n⚠️  Are you sure you want to delete '{video.get('title', 'No title')}'? (yes/no): ").strip().lower()
                if confirm in ['yes', 'y']:
                    delete_video_completely(supabase, video_id)
                    break
                else:
                    print("Deletion cancelled.")
                    break
            else:
                print(f"Invalid choice. Please enter a number between 1 and {len(videos)}")
        except ValueError:
            print("Please enter a valid number.")
        except KeyboardInterrupt:
            print("\nExiting...")
            break

if __name__ == "__main__":
    main() 