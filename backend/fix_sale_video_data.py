#!/usr/bin/env python3
"""
Script to fix the missing video data in the sale
"""

import os
from supabase import create_client, Client

# Get environment variables
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def fix_sale_video_data():
    """Fix the missing video data in the sale"""
    
    try:
        print("🔍 Checking sale for missing video data...")
        
        # Get the recent sale
        sales_result = supabase.table('sales').select('*').execute()
        
        if len(sales_result.data) == 0:
            print("❌ No sales found")
            return
        
        sale = sales_result.data[0]
        sale_id = sale.get('id')
        
        print(f"📊 Found sale: {sale.get('product_name')}")
        print(f"🎬 Video Title: '{sale.get('video_title', '')}'")
        print(f"👤 Channel ID: '{sale.get('channel_id', '')}'")
        print(f"🆔 Sale ID: {sale_id}")
        
        # Ask for the missing data
        print("\n💡 The sale is missing video and creator information")
        print("🎬 What is the video title? (e.g., 'Cheedo V - My Amazing Video')")
        video_title = input("Video Title: ").strip().strip("'\"")
        
        print("👤 What is the creator/channel name? (e.g., 'Cheedo V')")
        channel_id = input("Creator/Channel: ").strip().strip("'\"")
        
        if not video_title and not channel_id:
            print("❌ No data provided")
            return
        
        # Update the sale with video data
        update_data = {}
        if video_title:
            update_data['video_title'] = video_title
        if channel_id:
            # Use a proper channel ID format (not UUID, just a string identifier)
            clean_channel_id = channel_id.lower().replace(' ', '_')
            update_data['channel_id'] = clean_channel_id
        
        print(f"🔄 Updating sale with video data...")
        print(f"   Video Title: {video_title}")
        print(f"   Channel ID: {clean_channel_id if channel_id else 'None'}")
        
        update_result = supabase.table('sales').update(update_data).eq('id', sale_id).execute()
        
        if update_result.data:
            print("✅ Sale video data updated successfully!")
            print("📊 Analytics should now show video information")
        else:
            print("❌ Failed to update sale video data")
        
    except Exception as e:
        print(f"❌ Error fixing sale video data: {str(e)}")

if __name__ == "__main__":
    print("🎬 ScreenMerch Sale Video Data Fix")
    print("=" * 45)
    
    fix_sale_video_data()
