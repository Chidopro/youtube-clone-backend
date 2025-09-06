#!/usr/bin/env python3
"""
Debug script to examine actual Printful variant data structure
"""

import os
import json
import requests

PRINTFUL_BASE_URL = "https://api.printful.com"

def debug_variant_data():
    api_key = os.getenv("PRINTFUL_API_KEY")
    if not api_key:
        print("❌ PRINTFUL_API_KEY not set")
        return
    
    headers = {"Authorization": f"Bearer {api_key}"}
    
    # Get store products
    resp = requests.get(f"{PRINTFUL_BASE_URL}/store/products", headers=headers)
    resp.raise_for_status()
    products = resp.json()["result"]
    
    print(f"📦 Found {len(products)} products")
    
    # Debug first few products
    for i, product in enumerate(products[:3]):
        product_name = product.get("name")
        product_id = product.get("id")
        
        print(f"\n🔍 Product {i+1}: {product_name} (ID: {product_id})")
        
        # Get product details
        resp = requests.get(f"{PRINTFUL_BASE_URL}/store/products/{product_id}", headers=headers)
        resp.raise_for_status()
        product_data = resp.json()["result"]
        
        sync_variants = product_data.get("sync_variants", [])
        print(f"   📊 {len(sync_variants)} sync variants")
        
        # Debug first few variants
        for j, variant in enumerate(sync_variants[:3]):
            variant_id = variant.get("variant_id")
            print(f"\n   🔍 Variant {j+1}: {variant_id}")
            
            # Get variant details
            resp = requests.get(f"{PRINTFUL_BASE_URL}/products/variant/{variant_id}", headers=headers)
            resp.raise_for_status()
            variant_data = resp.json()["result"]
            
            print(f"      📋 Raw variant data:")
            print(f"         Name: {variant_data.get('name', 'N/A')}")
            print(f"         Size: {variant_data.get('size', 'N/A')}")
            print(f"         Color: {variant_data.get('color', 'N/A')}")
            print(f"         Options: {variant_data.get('options', {})}")
            print(f"         Retail Price: {variant_data.get('retail_price', 'N/A')}")
            print(f"         Wholesale Price: {variant_data.get('wholesale_price', 'N/A')}")
            
            # Pretty print the full structure
            print(f"      📄 Full structure:")
            print(json.dumps(variant_data, indent=8)[:500] + "...")

if __name__ == "__main__":
    debug_variant_data()
