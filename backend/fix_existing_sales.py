#!/usr/bin/env python3
"""
Fix existing sales records that have amount=0 by looking up correct prices.
This will update the sales table with proper revenue amounts.
"""

import os
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTg1MjA1NSwiZXhwIjoyMDY1NDI4MDU1fQ.lF-SglNH91xhXlTU1Inl8OSX2DeW19P12P-pFZAlRIA"

# Product prices (from your PRODUCTS array)
PRODUCT_PRICES = {
    "Unisex Heavy Blend Hoodie": 45.99,
    "Cropped Hoodie": 42.99,
    "Youth Heavy Blend Hoodie": 35.99,
    "Unisex Heavy Blend T-Shirt": 25.99,
    "Men's Heavy Blend T-Shirt": 25.99,
    "Women's Heavy Blend T-Shirt": 25.99
}

def fix_existing_sales():
    """Fix existing sales records with amount=0"""
    
    print("🔧 Fixing existing sales records with amount=0")
    print("=" * 50)
    
    try:
        # Initialize Supabase client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Connected to Supabase")
        
        # Get all sales records with amount=0
        result = supabase.table('sales').select('*').eq('amount', 0).execute()
        
        if not result.data:
            print("✅ No sales records with amount=0 found")
            return True
            
        print(f"📊 Found {len(result.data)} sales records with amount=0")
        
        # Fix each sales record
        fixed_count = 0
        for sale in result.data:
            product_name = sale.get('product_name', '')
            
            # Look up the correct price
            correct_price = PRODUCT_PRICES.get(product_name, 0)
            
            if correct_price > 0:
                # Update the sales record with correct price
                update_result = supabase.table('sales').update({
                    'amount': correct_price
                }).eq('id', sale['id']).execute()
                
                if update_result.data:
                    print(f"✅ Fixed sale {sale['id']}: {product_name} = ${correct_price:.2f}")
                    fixed_count += 1
                else:
                    print(f"❌ Failed to update sale {sale['id']}")
            else:
                print(f"⚠️  No price found for product: {product_name}")
        
        print(f"\n🎉 Fixed {fixed_count} sales records!")
        
        # Test analytics after fix
        print("\n📊 Testing analytics after fix...")
        import requests
        response = requests.get("https://screenmerch.fly.dev/api/analytics")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ New analytics data:")
            print(f"   - Total Sales: {data.get('total_sales', 0)}")
            print(f"   - Total Revenue: ${data.get('total_revenue', 0):.2f}")
            print(f"   - Products Sold: {len(data.get('products_sold', []))}")
            print(f"   - Videos with Sales: {len(data.get('videos_with_sales', []))}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error fixing sales: {str(e)}")
        return False

if __name__ == "__main__":
    fix_existing_sales()
