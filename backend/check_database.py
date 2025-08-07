#!/usr/bin/env python3
"""
Script to check database structure and sales table
"""

import os
import sys
from supabase import create_client, Client

# Get environment variables
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase environment variables!")
    print("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_database():
    """Check database structure and tables"""
    
    print("🔍 Checking database structure...")
    
    # Check if products table exists and has data
    try:
        products_result = supabase.table('products').select('*').limit(5).execute()
        print(f"✅ Products table exists with {len(products_result.data)} records")
        
        if products_result.data:
            print("📦 Sample product data:")
            for i, product in enumerate(products_result.data[:3]):
                print(f"  Product {i+1}:")
                print(f"    ID: {product.get('product_id', 'N/A')}")
                print(f"    Name: {product.get('name', 'N/A')}")
                print(f"    Video Title: {product.get('video_title', 'N/A')}")
                print(f"    Creator: {product.get('creator_name', 'N/A')}")
                print()
    except Exception as e:
        print(f"❌ Error checking products table: {str(e)}")
    
    # Check if sales table exists and has data
    try:
        sales_result = supabase.table('sales').select('*').limit(5).execute()
        print(f"✅ Sales table exists with {len(sales_result.data)} records")
        
        if sales_result.data:
            print("💰 Sample sales data:")
            for i, sale in enumerate(sales_result.data[:3]):
                print(f"  Sale {i+1}:")
                print(f"    Product: {sale.get('product_name', 'N/A')}")
                print(f"    Amount: ${sale.get('amount', 'N/A')}")
                print(f"    Video Title: {sale.get('video_title', 'N/A')}")
                print(f"    Creator: {sale.get('creator_name', 'N/A')}")
                print()
        else:
            print("⚠️ Sales table exists but has no records")
    except Exception as e:
        print(f"❌ Error checking sales table: {str(e)}")
        print("💡 Sales table might not exist - you may need to create it")

if __name__ == "__main__":
    check_database() 