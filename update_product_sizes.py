#!/usr/bin/env python3
"""
Update Product Sizes to 5XL (Precise)
Updates only clothing products to include sizes up to 5XL
"""

import json
import os
from datetime import datetime

def update_product_sizes():
    """Update only clothing products to include sizes up to 5XL"""
    
    print("🔄 Updating clothing product sizes to include 5XL...")
    
    # Load products from products.json
    try:
        with open('products.json', 'r') as f:
            products = json.load(f)
        print(f"✅ Loaded {len(products)} products from products.json")
    except Exception as e:
        print(f"❌ Error loading products.json: {e}")
        return
    
    # Full size range up to 5XL
    full_sizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]
    
    # Categories that should have 5XL sizes
    clothing_categories = [
        "T-Shirts", "Tank Tops", "Hoodies", "Men's Shirts", 
        "Women's Shirts", "Women's Tank", "Women's Tee"
    ]
    
    # Update each product
    updated_count = 0
    skipped_count = 0
    
    for product in products:
        category = product.get('category', '')
        name = product.get('name', '')
        
        # Skip non-clothing products
        if category not in clothing_categories:
            print(f"⏭️ Skipping {name} (Category: {category})")
            skipped_count += 1
            continue
        
        # Skip kids products
        if 'Kids' in name or 'kids' in name.lower():
            print(f"⏭️ Skipping {name} (Kids product)")
            skipped_count += 1
            continue
        
        if 'options' in product and 'size' in product['options']:
            current_sizes = product['options']['size']
            
            # Check if this product needs size updates
            if len(current_sizes) < len(full_sizes):
                print(f"📏 Updating {name}: {current_sizes} → {full_sizes}")
                product['options']['size'] = full_sizes
                updated_count += 1
            else:
                print(f"✅ {name}: Already has full size range")
    
    # Save updated products
    try:
        with open('products.json', 'w') as f:
            json.dump(products, f, indent=2)
        print(f"✅ Updated {updated_count} clothing products with full size range")
        print(f"✅ Skipped {skipped_count} non-clothing products")
        print(f"✅ Saved to products.json")
    except Exception as e:
        print(f"❌ Error saving products.json: {e}")
        return
    
    print("\n📋 Summary:")
    print(f"   • Total products: {len(products)}")
    print(f"   • Updated products: {updated_count}")
    print(f"   • Skipped products: {skipped_count}")
    print(f"   • New size range: {full_sizes}")
    print("\n🔄 Next steps:")
    print("   1. Copy products.json to main project")
    print("   2. Run sync script")
    print("   3. Rebuild frontend")

if __name__ == "__main__":
    update_product_sizes() 