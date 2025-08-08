#!/usr/bin/env python3
"""
Product Sync Script
Automatically syncs product changes from Product Manager to all data sources
"""

import json
import os
import re
from pathlib import Path

def load_product_manager_data():
    """Load data from Product Manager products.json"""
    product_manager_path = r"c:\Users\chido\OneDrive\Desktop\Product Manager\products.json"
    try:
        with open(product_manager_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Product Manager file not found: {product_manager_path}")
        return None

def update_frontend_products_js(products_data):
    """Update frontend/src/data/products.js"""
    frontend_path = "frontend/src/data/products.js"
    
    try:
        with open(frontend_path, 'r') as f:
            content = f.read()
        
        # Find the products array
        products_match = re.search(r'export const products = (\[.*?\]);', content, re.DOTALL)
        if not products_match:
            print("Could not find products array in frontend file")
            return False
        
        # Convert products_data to JavaScript format
        js_products = []
        for product in products_data:
            js_product = {
                "id": product.get("id", ""),
                "name": product.get("name", ""),
                "price": product.get("price", 0),
                "description": product.get("description", ""),
                "image": product.get("image", ""),
                "category": product.get("category", ""),
                "colors": product.get("options", {}).get("color", []),
                "sizes": product.get("options", {}).get("size", []),
                "availability": product.get("availability", {})
            }
            js_products.append(js_product)
        
        # Create new JavaScript content
        new_products_js = json.dumps(js_products, indent=2)
        new_content = re.sub(
            r'export const products = \[.*?\];',
            f'export const products = {new_products_js};',
            content,
            flags=re.DOTALL
        )
        
        with open(frontend_path, 'w') as f:
            f.write(new_content)
        
        print(f"Updated {frontend_path}")
        return True
        
    except Exception as e:
        print(f"Error updating frontend file: {e}")
        return False

def update_backend_app_py(products_data):
    """Update backend/app.py"""
    backend_path = "backend/app.py"
    
    try:
        with open(backend_path, 'r') as f:
            content = f.read()
        
        # Find the products list in the backend
        products_match = re.search(r'products = (\[.*?\])', content, re.DOTALL)
        if not products_match:
            print("Could not find products list in backend file")
            return False
        
        # Convert to Python format
        py_products = []
        for product in products_data:
            py_product = {
                "id": product.get("id", ""),
                "name": product.get("name", ""),
                "price": product.get("price", 0),
                "description": product.get("description", ""),
                "image": product.get("image", ""),
                "category": product.get("category", ""),
                "options": product.get("options", {}),
                "availability": product.get("availability", {})
            }
            py_products.append(py_product)
        
        # Create new Python content
        new_products_py = str(py_products).replace("'", '"')
        new_content = re.sub(
            r'products = \[.*?\]',
            f'products = {new_products_py}',
            content,
            flags=re.DOTALL
        )
        
        with open(backend_path, 'w') as f:
            f.write(new_content)
        
        print(f"Updated {backend_path}")
        return True
        
    except Exception as e:
        print(f"Error updating backend file: {e}")
        return False

def update_frontend_app_py(products_data):
    """Update frontend_app.py"""
    frontend_app_path = "frontend_app.py"
    
    try:
        with open(frontend_app_path, 'r') as f:
            content = f.read()
        
        # Find the products list
        products_match = re.search(r'products = (\[.*?\])', content, re.DOTALL)
        if not products_match:
            print("Could not find products list in frontend_app.py")
            return False
        
        # Convert to Python format
        py_products = []
        for product in products_data:
            py_product = {
                "id": product.get("id", ""),
                "name": product.get("name", ""),
                "price": product.get("price", 0),
                "description": product.get("description", ""),
                "image": product.get("image", ""),
                "category": product.get("category", ""),
                "options": product.get("options", {}),
                "availability": product.get("availability", {})
            }
            py_products.append(py_product)
        
        # Create new Python content
        new_products_py = str(py_products).replace("'", '"')
        new_content = re.sub(
            r'products = \[.*?\]',
            f'products = {new_products_py}',
            content,
            flags=re.DOTALL
        )
        
        with open(frontend_app_path, 'w') as f:
            f.write(new_content)
        
        print(f"Updated {frontend_app_path}")
        return True
        
    except Exception as e:
        print(f"Error updating frontend_app.py: {e}")
        return False

def main():
    print("Starting product sync...")
    
    # Load data from Product Manager
    products_data = load_product_manager_data()
    if not products_data:
        return
    
    print(f"Found {len(products_data)} products in Product Manager")
    
    # Update all data sources
    success_count = 0
    total_files = 3
    
    if update_frontend_products_js(products_data):
        success_count += 1
    
    if update_backend_app_py(products_data):
        success_count += 1
    
    if update_frontend_app_py(products_data):
        success_count += 1
    
    print(f"\nSync Results: {success_count}/{total_files} files updated")
    
    if success_count == total_files:
        print("All files synced successfully!")
        print("\nNext steps:")
        print("1. Run: git add . && git commit -m 'Auto-sync products'")
        print("2. Run: git push (for Netlify deployment)")
        print("3. Run: cd backend && fly deploy (for backend deployment)")
    else:
        print("Some files failed to sync. Check the errors above.")

if __name__ == "__main__":
    main()
