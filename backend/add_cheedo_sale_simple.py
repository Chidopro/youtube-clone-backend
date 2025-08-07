#!/usr/bin/env python3
"""
Simple script to add the missing Cheedo V sale record with basic fields only.
"""

import os
from supabase import create_client, Client

# Known Supabase URL from fly.toml
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"

def add_cheedo_sale():
    """Add the missing Cheedo V sale record"""
    
    # Use the service key directly
    supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTg1MjA1NSwiZXhwIjoyMDY1NDI4MDU1fQ.lF-SglNH91xhXlTU1Inl8OSX2DeW19P12P-pFZAlRIA"
    
    # Initialize Supabase client
    try:
        supabase: Client = create_client(SUPABASE_URL, supabase_key)
        print(f"✅ Connected to Supabase: {SUPABASE_URL}")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {str(e)}")
        return False
    
    # Create the sale record with only basic fields
    sale_data = {
        "product_name": "Custom Product from Cheedo V",
        "amount": 25.00,
        "image_url": "https://example.com/cheedo-product.jpg"
    }
    
    try:
        print(f"📊 Adding sale record: {sale_data['product_name']} - ${sale_data['amount']}")
        result = supabase.table('sales').insert(sale_data).execute()
        
        if result.data:
            sale_id = result.data[0]['id']
            print(f"✅ Sale record added successfully!")
            print(f"📋 Sale ID: {sale_id}")
            print(f"📦 Product: {sale_data['product_name']}")
            print(f"💰 Amount: ${sale_data['amount']}")
            
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
    print("🚀 Adding Cheedo V sale record...")
    print(f"📡 Connecting to Supabase: {SUPABASE_URL}")
    success = add_cheedo_sale()
    
    if success:
        print("\n🎉 Sale record added successfully!")
        print("📊 The sale should now appear in your analytics dashboard.")
        print("🔄 Please refresh your dashboard to see the updated analytics.")
    else:
        print("\n💥 Failed to add sale record!")
        exit(1) 