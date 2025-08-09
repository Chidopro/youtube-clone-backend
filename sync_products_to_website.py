#!/usr/bin/env python3
"""
Sync Products to Website
Automatically updates website files with changes from products.json
"""

import json
import os
import re
from datetime import datetime

def sync_products_to_website():
    """Sync products.json changes to website files"""
    
    print("🔄 Syncing products to website...")
    
    # Load products from products.json
    try:
        with open('products.json', 'r') as f:
            products = json.load(f)
        print(f"✅ Loaded {len(products)} products from products.json")
    except Exception as e:
        print(f"❌ Error loading products.json: {e}")
        return
    
    # Update app.py
    update_main_app(products)
    
    # Update backend/app.py
    update_backend_app(products)
    
    # Update frontend_app.py
    update_frontend_app(products)
    
    # Update frontend/src/data/products.js
    update_frontend_products_js(products)
    
    print("✅ Product sync completed!")
    print("📝 Next steps:")
    print("   1. Rebuild frontend: cd frontend && npm run build")
    print("   2. Deploy changes to your website")

def update_backend_app(products):
    """Update the PRODUCTS array in backend/app.py"""
    print("🔄 Updating backend/app.py...")
    
    try:
        with open('backend/app.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find the PRODUCTS array
        products_start = content.find('PRODUCTS = [')
        if products_start == -1:
            print("⚠️ Could not find PRODUCTS array in backend/app.py")
            return
        
        # Find the end of the PRODUCTS array
        products_end = content.find(']', products_start)
        if products_end == -1:
            print("⚠️ Could not find end of PRODUCTS array")
            return
        
        # Create new PRODUCTS array
        new_products_array = 'PRODUCTS = [\n'
        for product in products:
            # Generate filename and main_image if not present
            safe_name = product['name'].lower().replace(' ', '').replace("'", '')
            filename = product.get('filename', f"{safe_name}.png")
            main_image = product.get('main_image', f"{safe_name}.png")
            
            # Map colors to options.color
            colors = product.get('colors', [])
            sizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]
            
            options = {
                "color": colors,
                "size": sizes
            }
            
            new_products_array += f'    {{\n'
            new_products_array += f'        "name": "{product["name"]}",\n'
            new_products_array += f'        "price": {product["base_price"]},\n'
            new_products_array += f'        "filename": "{filename}",\n'
            new_products_array += f'        "main_image": "{main_image}",\n'
            new_products_array += f'        "options": {json.dumps(options)}\n'
            new_products_array += f'    }},\n'
        new_products_array += ']'
        
        # Replace the old PRODUCTS array
        new_content = content[:products_start] + new_products_array + content[products_end + 1:]
        
        # Write back to file
        with open('backend/app.py', 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print("✅ Updated backend/app.py")
        
    except Exception as e:
        print(f"❌ Error updating backend/app.py: {e}")

def update_main_app(products):
    """Update the PRODUCTS array in app.py"""
    print("🔄 Updating app.py...")
    
    try:
        with open('app.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find the PRODUCTS array
        products_start = content.find('PRODUCTS = [')
        if products_start == -1:
            print("⚠️ Could not find PRODUCTS array in app.py")
            return
        
        # Find the end of the PRODUCTS array
        products_end = content.find(']', products_start)
        if products_end == -1:
            print("⚠️ Could not find end of PRODUCTS array")
            return
        
        # Create new PRODUCTS array
        new_products_array = 'PRODUCTS = [\n'
        for product in products:
            # Generate filename and main_image if not present
            safe_name = product['name'].lower().replace(' ', '').replace("'", '')
            filename = product.get('filename', f"{safe_name}.png")
            main_image = product.get('main_image', f"{safe_name}.png")
            
            # Map colors to options.color
            colors = product.get('colors', [])
            sizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]
            
            options = {
                "color": colors,
                "size": sizes
            }
            
            new_products_array += f'    {{\n'
            new_products_array += f'        "name": "{product["name"]}",\n'
            new_products_array += f'        "price": {product["base_price"]},\n'
            new_products_array += f'        "filename": "{filename}",\n'
            new_products_array += f'        "main_image": "{main_image}",\n'
            new_products_array += f'        "options": {json.dumps(options)}\n'
            new_products_array += f'    }},\n'
        new_products_array += ']'
        
        # Replace the old PRODUCTS array
        new_content = content[:products_start] + new_products_array + content[products_end + 1:]
        
        # Write back to file
        with open('app.py', 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print("✅ Updated app.py")
        
    except Exception as e:
        print(f"❌ Error updating app.py: {e}")

def update_frontend_app(products):
    """Update the PRODUCTS array in frontend_app.py"""
    print("🔄 Updating frontend_app.py...")
    
    try:
        with open('frontend_app.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
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
        
        # Create new PRODUCTS array
        new_products_array = 'PRODUCTS = [\n'
        for product in products:
            # Generate filename and main_image if not present
            safe_name = product['name'].lower().replace(' ', '').replace("'", '')
            filename = product.get('filename', f"{safe_name}.png")
            main_image = product.get('main_image', f"{safe_name}.png")
            
            # Map colors to options.color
            colors = product.get('colors', [])
            sizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]
            
            options = {
                "color": colors,
                "size": sizes
            }
            
            new_products_array += f'    {{\n'
            new_products_array += f'        "name": "{product["name"]}",\n'
            new_products_array += f'        "price": {product["base_price"]},\n'
            new_products_array += f'        "filename": "{filename}",\n'
            new_products_array += f'        "main_image": "{main_image}",\n'
            new_products_array += f'        "options": {json.dumps(options)}\n'
            new_products_array += f'    }},\n'
        new_products_array += ']'
        
        # Replace the old PRODUCTS array
        new_content = content[:products_start] + new_products_array + content[products_end + 1:]
        
        # Write back to file
        with open('frontend_app.py', 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print("✅ Updated frontend_app.py")
        
    except Exception as e:
        print(f"❌ Error updating frontend_app.py: {e}")

def update_frontend_products_js(products):
    """Update the products object in frontend/src/data/products.js"""
    print("🔄 Updating frontend/src/data/products.js...")
    
    try:
        # Create new products object
        new_content = 'export const products = {\n'
        
        for product in products:
            # Create product key
            product_key = product["name"].lower().replace(" ", "").replace("'", "").replace("-", "")
            
            new_content += f'  "{product_key}": {{\n'
            new_content += f'    name: "{product["name"]}",\n'
            new_content += f'    price: {product["base_price"]},\n'
            new_content += f'    description: "{product.get("description", product["name"] + " with custom prints")}",\n'
            new_content += f'    image: "/static/images/{product["main_image"]}",\n'
            new_content += f'    preview: "/static/images/{product["filename"]}",\n'
            new_content += f'    category: "{product["category"].lower()}",\n'
            
            # Handle variables
            options = product["options"]
            if options.get("color") or options.get("size"):
                new_content += '    variables: {\n'
                
                if options.get("size"):
                    new_content += f'      sizes: {json.dumps(options["size"])},\n'
                
                if options.get("color"):
                    new_content += f'      colors: {json.dumps(options["color"])},\n'
                
                # Add availability (you can customize this)
                new_content += '      availability: {\n'
                for size in options.get("size", []):
                    new_content += f'        "{size}": {{\n'
                    for color in options.get("color", []):
                        new_content += f'          "{color}": true,\n'
                    new_content += '        },\n'
                new_content += '      }\n'
                new_content += '    }\n'
            
            new_content += '  },\n'
        
        new_content += '};\n'
        
        # Write to file
        with open('frontend/src/data/products.js', 'w') as f:
            f.write(new_content)
        
        print("✅ Updated frontend/src/data/products.js")
        
    except Exception as e:
        print(f"❌ Error updating frontend/src/data/products.js: {e}")

if __name__ == "__main__":
    sync_products_to_website() 