#!/usr/bin/env python3
"""
Script to fix just the video title in the sale
"""

import os
from supabase import create_client, Client

# Get environment variables
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def fix_sale_video_title():
    """Fix just the video title in the sale"""
    
    try:
        print("🔍 Checking sale for missing video title...")
        
        # Get the recent sale
        sales_result = supabase.table('sales').select('*').execute()
        
        if len(sales_result.data) == 0:
            print("❌ No sales found")
            return
        
        sale = sales_result.data[0]
        sale_id = sale.get('id')
        
        print(f"📊 Found sale: {sale.get('product_name')}")
        print(f"🎬 Video Title: '{sale.get('video_title', '')}'")
        print(f"🆔 Sale ID: {sale_id}")
        
        # Set the video title
        video_title = "Crow"
        
        print(f"\n🔄 Updating sale with video title...")
        print(f"   Video Title: {video_title}")
        
        # Update just the video title
        update_result = supabase.table('sales').update({
            'video_title': video_title
        }).eq('id', sale_id).execute()
        
        if update_result.data:
            print("✅ Sale video title updated successfully!")
            print("📊 Analytics should now show video information")
        else:
            print("❌ Failed to update sale video title")
        
    except Exception as e:
        print(f"❌ Error fixing sale video title: {str(e)}")

if __name__ == "__main__":
    print("🎬 ScreenMerch Sale Video Title Fix")
    print("=" * 45)
    
    fix_sale_video_title()
