#!/usr/bin/env python3
"""
Simple script to manually add missing sale records for tracking purposes.
This can be used to add sales that weren't properly recorded due to the missing sales table.
"""

import os
from datetime import datetime
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def add_missing_sale():
    """Add a missing sale record for tracking"""
    
    # Get the service key from user input (using regular input instead of getpass)
    print("🔑 Please enter your Supabase Service Role Key:")
    print("   (You can find this in your Supabase dashboard under Settings > API)")
    print("   (The key will be visible as you type - this is normal)")
    supabase_key = input("Service Role Key: ").strip()
    
    if not supabase_key:
        print("❌ No service key provided!")
        return False
    
    # Initialize Supabase client
    try:
        supabase: Client = create_client(SUPABASE_URL, supabase_key)
        print(f"✅ Connected to Supabase: {SUPABASE_URL}")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {str(e)}")
        return False
    
    # Get sale details from user
    print("\n📝 Enter the sale details:")
    product_name = input("Product name: ").strip()
    if not product_name:
        product_name = "Custom Product"
    
    amount_str = input("Amount (e.g., 25.00): ").strip()
    try:
        amount = float(amount_str)
    except ValueError:
        amount = 25.00
        print(f"⚠️  Invalid amount, using default: ${amount}")
    
    channel_id = input("Channel ID (optional): ").strip()
    user_id = input("User ID (optional): ").strip()
    
    # Create the sale record
    sale_data = {
        "product_name": product_name,
        "amount": amount,
        "image_url": "https://example.com/product.jpg",
        "created_at": datetime.now().isoformat()
    }
    
    if channel_id:
        sale_data["channel_id"] = channel_id
    if user_id:
        sale_data["user_id"] = user_id
    
    try:
        print(f"\n📊 Adding sale record: {product_name} - ${amount}")
        result = supabase.table('sales').insert(sale_data).execute()
        
        if result.data:
            sale_id = result.data[0]['id']
            print(f"✅ Sale record added successfully!")
            print(f"📋 Sale ID: {sale_id}")
            print(f"📦 Product: {product_name}")
            print(f"💰 Amount: ${amount}")
            print(f"📅 Created: {sale_data['created_at']}")
            
            # Test analytics endpoint
            print("\n🧪 Testing analytics endpoint...")
            analytics_result = supabase.table('sales').select('*').execute()
            total_sales = len(analytics_result.data)
            total_revenue = sum(sale.get('amount', 0) for sale in analytics_result.data)
            
            print(f"📈 Total sales in database: {total_sales}")
            print(f"💰 Total revenue: ${total_revenue:.2f}")
            
            return True
        else:
            print("❌ Failed to add sale record")
            return False
            
    except Exception as e:
        print(f"❌ Error adding sale record: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Adding missing sale record...")
    print(f"📡 Connecting to Supabase: {SUPABASE_URL}")
    success = add_missing_sale()
    
    if success:
        print("\n🎉 Sale record added successfully!")
        print("📊 The sale should now appear in your analytics dashboard.")
        print("🔄 Please refresh your dashboard to see the updated analytics.")
    else:
        print("\n💥 Failed to add sale record!")
        exit(1) 