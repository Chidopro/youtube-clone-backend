#!/usr/bin/env python3
"""
Update backend app.py PRODUCTS array with real Printful data and $10 markup
"""

import os
import json
import requests
import time
import re
from typing import Dict, List, Tuple, Optional
from collections import defaultdict

PRINTFUL_BASE_URL = "https://api.printful.com"

class BackendProductUpdater:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {"Authorization": f"Bearer {api_key}"}
        self.markup = 10.0  # $10 markup on all products
    
    def fetch_store_products(self) -> List[Dict]:
        """Fetch all products from Printful store"""
        products = []
        limit = 100
        offset = 0
        
        while True:
            resp = requests.get(
                f"{PRINTFUL_BASE_URL}/store/products?limit={limit}&offset={offset}", 
                headers=self.headers
            )
            resp.raise_for_status()
            data = resp.json()["result"]
            products.extend(data)
            if len(data) < limit:
                break
            offset += limit
        
        return products
    
    def fetch_variant_details(self, variant_id: int) -> Dict:
        """Fetch detailed variant information"""
        resp = requests.get(f"{PRINTFUL_BASE_URL}/products/variant/{variant_id}", headers=self.headers)
        resp.raise_for_status()
        return resp.json()["result"]
    
    def build_product_data(self, sync_product_id: int) -> Dict:
        """Build product data for backend format"""
        resp = requests.get(f"{PRINTFUL_BASE_URL}/store/products/{sync_product_id}", headers=self.headers)
        resp.raise_for_status()
        result = resp.json()["result"]
        sync_variants = result.get("sync_variants", [])
        
        size_to_colors = defaultdict(set)
        all_colors = set()
        prices = []
        
        for sv in sync_variants:
            variant_id = sv.get("variant_id")
            if not variant_id:
                continue
            
            details = self.fetch_variant_details(variant_id)
            variant_data = details.get("variant", {})
            size = variant_data.get("size")
            color = variant_data.get("color")
            price = variant_data.get("price")
            
            if size and color:
                normalized_size = self.normalize_size(size)
                size_to_colors[normalized_size].add(color)
                all_colors.add(color)
                
                if price:
                    try:
                        price_float = float(price) + self.markup  # Add $10 markup
                        prices.append(price_float)
                    except ValueError:
                        pass
        
        if not prices:
            return None
        
        # Calculate average price with markup
        avg_price = sum(prices) / len(prices)
        
        # Build sizes and colors arrays
        sizes = self.get_sorted_sizes(list(size_to_colors.keys()))
        colors = sorted(all_colors)
        
        return {
            "sizes": sizes,
            "colors": colors,
            "price": round(avg_price, 2)
        }
    
    def normalize_size(self, size: str) -> str:
        """Normalize size names"""
        if not size:
            return size
        
        size_mapping = {
            "2XS": "XXS",
            "2XL": "XXL", 
            "3XL": "XXXL",
            "4XL": "XXXXL",
            "5XL": "XXXXXL",
        }
        
        if size.upper() in ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL", "2XS", "2XL", "3XL", "4XL", "5XL"]:
            return size_mapping.get(size.upper(), size.upper())
        
        return size
    
    def get_sorted_sizes(self, sizes: List[str]) -> List[str]:
        """Sort sizes in proper order"""
        clothing_size_order = [
            "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"
        ]
        
        clothing_sizes = [s for s in sizes if s.upper() in ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL", "XXS"]]
        
        if clothing_sizes:
            sorted_sizes = []
            for size in clothing_size_order:
                if size in sizes:
                    sorted_sizes.append(size)
            
            for size in sizes:
                if size not in sorted_sizes:
                    sorted_sizes.append(size)
            
            return sorted_sizes
        else:
            return sorted(sizes)
    
    def update_backend_app_py(self):
        """Update the backend app.py file with new product data"""
        file_path = "backend/app.py"
        
        # Create backup
        backup_path = f"{file_path}.{int(time.time())}.bak"
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"📦 Backup created: {backup_path}")
        
        # Fetch all store products
        store_products = self.fetch_store_products()
        print(f"📦 Found {len(store_products)} products in store")
        
        updated_products = []
        
        for product in store_products:
            product_name = product.get("name")
            sync_product_id = product.get("id")
            
            if not product_name or not sync_product_id:
                continue
            
            print(f"🔄 Processing: {product_name}")
            
            try:
                product_data = self.build_product_data(sync_product_id)
                
                if product_data and product_data["sizes"] and product_data["colors"]:
                    # Create backend product format
                    backend_product = {
                        "name": product_name,
                        "price": product_data["price"],
                        "filename": f"{product_name.lower().replace(' ', '').replace(chr(39), '')}.png",
                        "main_image": f"{product_name.lower().replace(' ', '').replace(chr(39), '')}.png",
                        "preview_image": f"{product_name.lower().replace(' ', '').replace(chr(39), '')}preview.png",
                        "options": {
                            "color": product_data["colors"],
                            "size": product_data["sizes"]
                        }
                    }
                    
                    updated_products.append(backend_product)
                    print(f"✅ {product_name}: ${product_data['price']:.2f}, {len(product_data['sizes'])} sizes, {len(product_data['colors'])} colors")
                
            except Exception as e:
                print(f"❌ Error processing {product_name}: {e}")
                continue
        
        # Update the PRODUCTS array in app.py
        if updated_products:
            # Find the PRODUCTS array in the file
            products_start = content.find("PRODUCTS = [")
            if products_start == -1:
                print("❌ Could not find PRODUCTS array in app.py")
                return
            
            # Find the end of the PRODUCTS array
            brace_count = 0
            i = products_start
            while i < len(content):
                if content[i] == '[':
                    brace_count += 1
                elif content[i] == ']':
                    brace_count -= 1
                    if brace_count == 0:
                        products_end = i + 1
                        break
                i += 1
            else:
                print("❌ Could not find end of PRODUCTS array")
                return
            
            # Create new PRODUCTS array
            new_products_array = "PRODUCTS = [\n"
            for i, product in enumerate(updated_products):
                new_products_array += "    {\n"
                new_products_array += f'        "name": "{product["name"]}",\n'
                new_products_array += f'        "price": {product["price"]},\n'
                new_products_array += f'        "filename": "{product["filename"]}",\n'
                new_products_array += f'        "main_image": "{product["main_image"]}",\n'
                new_products_array += f'        "preview_image": "{product["preview_image"]}",\n'
                new_products_array += f'        "options": {json.dumps(product["options"], indent=8)}\n'
                new_products_array += "    }"
                if i < len(updated_products) - 1:
                    new_products_array += ","
                new_products_array += "\n"
            new_products_array += "]"
            
            # Replace the PRODUCTS array
            new_content = content[:products_start] + new_products_array + content[products_end:]
            
            # Write updated content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            print(f"✅ Updated {file_path} with {len(updated_products)} products")
        else:
            print("❌ No products were successfully processed")

def main():
    api_key = os.getenv("PRINTFUL_API_KEY")
    if not api_key:
        print("❌ PRINTFUL_API_KEY environment variable not set")
        return
    
    updater = BackendProductUpdater(api_key)
    updater.update_backend_app_py()

if __name__ == "__main__":
    main()
