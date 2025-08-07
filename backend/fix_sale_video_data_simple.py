#!/usr/bin/env python3
"""
Script to fix the missing video data in the sale (simple version)
"""

import os
from supabase import create_client, Client

# Get environment variables
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def fix_sale_video_data_simple():
    """Fix the missing video data in the sale with preset values"""
    
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
        
        # Set the video data directly
        video_title = "Crow"
        channel_id = "cheedo_v"
        
        print(f"\n🔄 Updating sale with video data...")
        print(f"   Video Title: {video_title}")
        print(f"   Channel ID: {channel_id}")
        
        # Update the sale with video data
        update_result = supabase.table('sales').update({
            'video_title': video_title,
            'channel_id': channel_id
        }).eq('id', sale_id).execute()
        
        if update_result.data:
            print("✅ Sale video data updated successfully!")
            print("📊 Analytics should now show video information")
        else:
            print("❌ Failed to update sale video data")
        
    except Exception as e:
        print(f"❌ Error fixing sale video data: {str(e)}")

if __name__ == "__main__":
    print("🎬 ScreenMerch Sale Video Data Fix (Simple)")
    print("=" * 50)
    
    fix_sale_video_data_simple()
