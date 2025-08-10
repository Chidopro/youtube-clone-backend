#!/usr/bin/env python3
"""
Sync products from products.json to app.py PRODUCTS array
"""

import json
import re

def load_products_from_json():
    """Load products from products.json"""
    try:
        with open('products.json', 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error loading products.json: {e}")
        return []

def convert_product_format(product):
    """Convert product from products.json format to app.py format"""
    return {
        "name": product.get("name", ""),
        "price": product.get("base_price", 24.99),
        "filename": product.get("main_image", ""),
        "main_image": product.get("main_image", ""),
        "preview_image": product.get("filename", ""),
        "options": {
            "color": product.get("options", {}).get("color", []),
            "size": product.get("options", {}).get("size", [])
        }
    }

def update_app_py_products(products):
    """Update the PRODUCTS array in app.py"""
    try:
        # Read the current app.py file
        with open('backend/app.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find the PRODUCTS array
        start_marker = "PRODUCTS = ["
        end_marker = "]"
        
        start_idx = content.find(start_marker)
        if start_idx == -1:
            print("❌ Could not find PRODUCTS array in app.py")
            return False
        
        # Find the end of the PRODUCTS array
        brace_count = 0
        end_idx = start_idx
        for i, char in enumerate(content[start_idx:], start_idx):
            if char == "[":
                brace_count += 1
            elif char == "]":
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i + 1
                    break
        
        # Generate new PRODUCTS array
        new_products_list = "PRODUCTS = [\n"
        for i, product in enumerate(products):
            converted_product = convert_product_format(product)
            new_products_list += f"    {{\n"
            new_products_list += f'        "name": "{converted_product["name"]}",\n'
            new_products_list += f'        "price": {converted_product["price"]},\n'
            new_products_list += f'        "filename": "{converted_product["filename"]}",\n'
            new_products_list += f'        "main_image": "{converted_product["main_image"]}",\n'
            new_products_list += f'        "preview_image": "{converted_product["preview_image"]}",\n'
            new_products_list += f'        "options": {{"color": {converted_product["options"]["color"]}, "size": {converted_product["options"]["size"]}}}\n'
            if i < len(products) - 1:
                new_products_list += "    },\n"
            else:
                new_products_list += "    }\n"
        new_products_list += "]\n"
        
        # Replace the old PRODUCTS array with the new one
        new_content = content[:start_idx] + new_products_list + content[end_idx:]
        
        # Write the updated content back to app.py
        with open('backend/app.py', 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"✅ Successfully updated PRODUCTS array in app.py with {len(products)} products")
        return True
        
    except Exception as e:
        print(f"❌ Error updating app.py: {e}")
        return False

def main():
    print("🔄 Syncing products from products.json to app.py...")
    
    # Load products from products.json
    products = load_products_from_json()
    if not products:
        print("❌ No products found in products.json")
        return
    
    print(f"📦 Found {len(products)} products in products.json")
    
    # Show some sample products
    print("\n📋 Sample products:")
    for i, product in enumerate(products[:3]):
        print(f"  {i+1}. {product.get('name', 'Unknown')}")
        print(f"     Colors: {', '.join(product.get('options', {}).get('color', []))}")
        print(f"     Price: ${product.get('base_price', 0)}")
    
    # Update app.py
    if update_app_py_products(products):
        print("\n🎉 Sync completed successfully!")
        print("📝 Next steps:")
        print("   1. Deploy the backend: cd backend && fly deploy")
        print("   2. Test the product page to see the updated colors")
    else:
        print("\n❌ Sync failed!")

if __name__ == "__main__":
    main()
