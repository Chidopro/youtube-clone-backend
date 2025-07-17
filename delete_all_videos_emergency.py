#!/usr/bin/env python3
"""
Emergency ALL Videos Deletion Script
This script deletes ALL videos from Supabase database and storage
Use with extreme caution - this cannot be undone!

Usage:
    python delete_all_videos_emergency.py
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
            print("-" * 80)
        
        return videos
    except Exception as e:
        print(f"❌ Error listing videos: {e}")
        return []

def extract_file_path_from_url(url, bucket_name):
    """Extract file path from Supabase storage URL"""
    try:
        parsed = urlparse(url)
        path_parts = parsed.path.split('/')
        
        try:
            bucket_index = path_parts.index(bucket_name)
            file_path = '/'.join(path_parts[bucket_index + 1:])
            return file_path
        except ValueError:
            return None
    except Exception as e:
        return None

def delete_file_from_storage(supabase, file_url, bucket_name):
    """Delete file from Supabase storage"""
    try:
        file_path = extract_file_path_from_url(file_url, bucket_name)
        if not file_path:
            return False
        
        response = supabase.storage.from_(bucket_name).remove([file_path])
        return True
    except Exception as e:
        return False

def delete_all_videos(supabase):
    """Delete ALL videos from database and storage"""
    try:
        # Get all videos first
        response = supabase.table("videos2").select("*").execute()
        videos = response.data
        
        if not videos:
            print("No videos found to delete.")
            return True
        
        print(f"\n🗑️  Deleting {len(videos)} videos...")
        
        # Delete each video
        for i, video in enumerate(videos, 1):
            video_id = video['id']
            video_url = video.get('video_url', '')
            thumbnail_url = video.get('thumbnail', '')
            
            print(f"Deleting video {i}/{len(videos)}: {video.get('title', 'No title')}")
            
            # Delete video file from storage
            if video_url:
                delete_file_from_storage(supabase, video_url, "videos2")
            
            # Delete thumbnail file from storage
            if thumbnail_url:
                delete_file_from_storage(supabase, thumbnail_url, "thumbnails")
        
        # Delete all videos from database at once
        delete_response = supabase.table("videos2").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        
        print(f"✅ Successfully deleted {len(videos)} videos from database and storage!")
        return True
        
    except Exception as e:
        print(f"❌ Error deleting videos: {e}")
        return False

def main():
    """Main function"""
    print("🚨 EMERGENCY ALL VIDEOS DELETION TOOL")
    print("=" * 50)
    print("⚠️  WARNING: This will delete ALL videos from your database and storage!")
    print("⚠️  This action cannot be undone!")
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
    
    # Multiple confirmations
    print(f"\n⚠️  You are about to delete {len(videos)} videos permanently!")
    
    confirm1 = input("Type 'DELETE ALL VIDEOS' to confirm: ").strip()
    if confirm1 != "DELETE ALL VIDEOS":
        print("Deletion cancelled.")
        return
    
    confirm2 = input("Are you absolutely sure? Type 'YES I AM SURE': ").strip()
    if confirm2 != "YES I AM SURE":
        print("Deletion cancelled.")
        return
    
    # Delete all videos
    success = delete_all_videos(supabase)
    if success:
        print("\n✅ All videos have been successfully deleted!")
        print("Your site should now be clean of all videos.")
    else:
        print("\n❌ There was an error deleting the videos.")

if __name__ == "__main__":
    main() 