#!/usr/bin/env python3
"""
Fix Frontend Products
Restore the correct PRODUCTS array in frontend_app.py from Product Manager data
"""

import json
import os

def fix_frontend_products():
    """Fix the PRODUCTS array in frontend_app.py with correct data"""
    
    print("🔄 Fixing frontend products...")
    
    # Load products from Product Manager
    try:
        with open('products.json', 'r', encoding='utf-8') as f:
            products = json.load(f)
        print(f"✅ Loaded {len(products)} products from products.json")
    except Exception as e:
        print(f"❌ Error loading products.json: {e}")
        return
    
    # Read frontend_app.py
    try:
        with open('frontend_app.py', 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Error reading frontend_app.py: {e}")
        return
    
    # Find the PRODUCTS array
    products_start = content.find('PRODUCTS = [')
    if products_start == -1:
        print("⚠️ Could not find PRODUCTS array in frontend_app.py")
        return
    
    # Find the end of the PRODUCTS array
    products_end = content.find(']', products_start)
    if products_end == -1:
        print("⚠️ Could not find end of PRODUCTS array")
        return
    
    # Create new PRODUCTS array with correct data
    new_products_array = 'PRODUCTS = [\n'
    for product in products:
        # Use the actual data from Product Manager
        colors = product.get('colors', [])
        sizes = product.get('options', {}).get('size', ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"])
        
        options = {
            "color": colors,
            "size": sizes
        }
        
        new_products_array += f'    {{\n'
        new_products_array += f'        "name": "{product["name"]}",\n'
        new_products_array += f'        "price": {product["base_price"]},\n'
        new_products_array += f'        "filename": "{product.get("filename", product["main_image"])}",\n'
        new_products_array += f'        "main_image": "{product["main_image"]}",\n'
        new_products_array += f'        "options": {json.dumps(options)}\n'
        new_products_array += f'    }},\n'
    new_products_array += ']'
    
    # Replace the old PRODUCTS array
    new_content = content[:products_start] + new_products_array + content[products_end + 1:]
    
    # Write back to file
    try:
        with open('frontend_app.py', 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("✅ Updated frontend_app.py with correct product data")
    except Exception as e:
        print(f"❌ Error writing frontend_app.py: {e}")

if __name__ == "__main__":
    fix_frontend_products()
