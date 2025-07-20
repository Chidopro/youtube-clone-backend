#!/usr/bin/env python3
"""
Test script to check product creation and retrieval
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
import json

# Load environment variables
env_paths = [
    Path(__file__).parent / '.env',
    Path(__file__).parent.parent / '.env',
    Path.cwd() / '.env'
]

for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        print(f"Loaded .env from: {env_path}")

# Get Supabase credentials
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("❌ Missing Supabase environment variables")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

def test_product_creation():
    """Test creating a product"""
    try:
        print("🧪 Testing product creation...")
        
        test_product_id = "test-product-123"
        test_data = {
            "name": "Test Product",
            "price": 24.99,
            "description": "Test merchandise",
            "product_id": test_product_id,
            "thumbnail_url": "data:image/png;base64,test",
            "video_url": "https://example.com/video",
            "screenshots_urls": json.dumps(["screenshot1", "screenshot2"]),
            "category": "Test"
        }
        
        result = supabase.table("products").insert(test_data).execute()
        print("✅ Product created successfully")
        print(f"   Result: {result.data}")
        
        return test_product_id
        
    except Exception as e:
        print(f"❌ Error creating product: {str(e)}")
        return None

def test_product_retrieval(product_id):
    """Test retrieving a product"""
    try:
        print(f"\n🔍 Testing product retrieval for ID: {product_id}")
        
        result = supabase.table('products').select('*').eq('product_id', product_id).execute()
        
        if result.data:
            print("✅ Product found in database:")
            product = result.data[0]
            for key, value in product.items():
                print(f"   {key}: {value}")
            return product
        else:
            print("❌ Product not found in database")
            return None
            
    except Exception as e:
        print(f"❌ Error retrieving product: {str(e)}")
        return None

def cleanup_test_product(product_id):
    """Clean up test product"""
    try:
        print(f"\n🧹 Cleaning up test product: {product_id}")
        supabase.table('products').delete().eq('product_id', product_id).execute()
        print("✅ Test product cleaned up")
    except Exception as e:
        print(f"❌ Error cleaning up: {str(e)}")

def main():
    print("🚀 Product Creation and Retrieval Test\n")
    
    # Test product creation
    test_id = test_product_creation()
    if not test_id:
        print("❌ Cannot proceed with retrieval test")
        return
    
    # Test product retrieval
    product = test_product_retrieval(test_id)
    
    # Clean up
    cleanup_test_product(test_id)
    
    if product:
        print("\n✅ All tests passed! The database operations are working correctly.")
    else:
        print("\n❌ Product retrieval failed. This explains the 'Product not found' error.")

if __name__ == "__main__":
    main() 