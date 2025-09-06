#!/usr/bin/env python3
"""
Corrected Printful Sync - Properly handles the actual Printful API data structure
"""

import os
import json
import requests
import time
from typing import Dict, List, Tuple, Optional
from collections import defaultdict

PRINTFUL_BASE_URL = "https://api.printful.com"

class CorrectedPrintfulSync:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {"Authorization": f"Bearer {api_key}"}
    
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
    
    def build_corrected_availability(self, sync_product_id: int) -> Dict:
        """Build availability and pricing data using correct API structure"""
        resp = requests.get(f"{PRINTFUL_BASE_URL}/store/products/{sync_product_id}", headers=self.headers)
        resp.raise_for_status()
        result = resp.json()["result"]
        sync_variants = result.get("sync_variants", [])
        
        # Enhanced data structure
        size_to_colors = defaultdict(set)
        all_colors = set()
        variant_pricing = {}
        size_color_pricing = {}
        regional_availability = {}
        
        print(f"🔍 Processing {len(sync_variants)} variants...")
        
        for i, sv in enumerate(sync_variants):
            variant_id = sv.get("variant_id")
            if not variant_id:
                continue
            
            print(f"📊 Processing variant {i+1}/{len(sync_variants)}: {variant_id}")
            
            # Fetch variant details
            details = self.fetch_variant_details(variant_id)
            
            # Extract data from the correct structure
            variant_data = details.get("variant", {})
            size = variant_data.get("size")
            color = variant_data.get("color")
            price = variant_data.get("price")
            availability_regions = variant_data.get("availability_regions", {})
            
            print(f"   📋 Size: {size}, Color: {color}, Price: ${price}")
            
            if size and color:
                # Normalize size
                normalized_size = self.normalize_size(size)
                
                # Store availability
                size_to_colors[normalized_size].add(color)
                all_colors.add(color)
                
                # Store pricing
                if price:
                    try:
                        price_float = float(price)
                        variant_pricing[variant_id] = {
                            "retail_price": price_float,
                            "wholesale_price": price_float * 0.6,  # Estimate wholesale
                            "currency": "USD"
                        }
                        
                        # Store size-color specific pricing
                        size_color_key = f"{normalized_size}_{color}"
                        size_color_pricing[size_color_key] = {
                            "retail_price": price_float,
                            "wholesale_price": price_float * 0.6,
                            "currency": "USD"
                        }
                    except ValueError:
                        print(f"   ⚠️ Invalid price format: {price}")
                
                # Store regional availability
                if availability_regions:
                    regional_availability[f"{normalized_size}_{color}"] = availability_regions
                    print(f"   🌍 Regional availability: {list(availability_regions.keys())}")
                
                # Small delay to avoid rate limiting
                time.sleep(0.1)
        
        # Build final availability structure
        sizes_sorted = self.get_sorted_sizes(list(size_to_colors.keys()))
        colors_sorted = sorted(all_colors)
        
        availability = {}
        for size in sizes_sorted:
            availability[size] = {}
            for color in colors_sorted:
                # Check if this size-color combination exists
                if color in size_to_colors[size]:
                    availability[size][color] = True
                else:
                    availability[size][color] = False
        
        return {
            "sizes": sizes_sorted,
            "colors": colors_sorted,
            "availability": availability,
            "pricing": size_color_pricing,
            "variant_pricing": variant_pricing,
            "regional_availability": regional_availability
        }
    
    def normalize_size(self, size: str) -> str:
        """Normalize size names for clothing items"""
        if not size:
            return size
        
        # Handle clothing sizes
        size_mapping = {
            "2XS": "XXS",
            "2XL": "XXL", 
            "3XL": "XXXL",
            "4XL": "XXXXL",
            "5XL": "XXXXXL",
        }
        
        # Check if it's a clothing size (letters)
        if size.upper() in ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL", "2XS", "2XL", "3XL", "4XL", "5XL"]:
            return size_mapping.get(size.upper(), size.upper())
        
        # For non-clothing items (mugs, bowls, etc.), keep original size
        return size
    
    def get_sorted_sizes(self, sizes: List[str]) -> List[str]:
        """Sort sizes in proper order for clothing items"""
        clothing_size_order = [
            "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"
        ]
        
        # Check if we have clothing sizes
        clothing_sizes = [s for s in sizes if s.upper() in ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL", "XXS"]]
        
        if clothing_sizes:
            # Sort clothing sizes
            sorted_sizes = []
            for size in clothing_size_order:
                if size in sizes:
                    sorted_sizes.append(size)
            
            # Add any remaining sizes
            for size in sizes:
                if size not in sorted_sizes:
                    sorted_sizes.append(size)
            
            return sorted_sizes
        else:
            # For non-clothing items, sort alphabetically
            return sorted(sizes)
    
    def update_products_js(self, products_data: Dict):
        """Update the frontend products.js file"""
        file_path = "frontend/src/data/products.js"
        
        # Create backup
        backup_path = f"{file_path}.{int(time.time())}.bak"
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"📦 Backup created: {backup_path}")
        
        # Update each product
        for product_name, data in products_data.items():
            print(f"🔄 Updating product: {product_name}")
            
            # Update availability
            content = self.update_product_availability(content, product_name, data)
            
            # Update pricing if available
            if data.get('pricing'):
                content = self.update_product_pricing(content, product_name, data['pricing'])
        
        # Write updated content
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✅ Updated {file_path}")
    
    def update_product_availability(self, content: str, product_name: str, data: Dict) -> str:
        """Update product availability in the content"""
        import re
        
        # Find the product block
        name_pattern = re.escape(f'"name": "{product_name}"')
        match = re.search(name_pattern, content)
        if not match:
            return content
        
        # Find variables block
        var_start = content.find('"variables": {', match.end())
        if var_start == -1:
            return content
        
        # Find end of variables block
        brace_count = 0
        i = var_start
        while i < len(content):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    var_end = i + 1
                    break
            i += 1
        else:
            return content
        
        # Create new variables block
        variables_obj = {
            "sizes": data["sizes"],
            "colors": data["colors"], 
            "availability": data["availability"]
        }
        
        new_block = '"variables": ' + json.dumps(variables_obj, indent=2, ensure_ascii=False)
        
        return content[:var_start] + new_block + content[var_end:]
    
    def update_product_pricing(self, content: str, product_name: str, pricing_data: Dict) -> str:
        """Update product pricing"""
        import re
        
        # Find the product block
        name_pattern = re.escape(f'"name": "{product_name}"')
        match = re.search(name_pattern, content)
        if not match:
            return content
        
        # Calculate average price
        prices = [p.get('retail_price', 0) for p in pricing_data.values() if p.get('retail_price', 0) > 0]
        if prices:
            avg_price = sum(prices) / len(prices)
            
            # Update the price field
            price_pattern = r'"price":\s*([0-9]+(?:\.[0-9]+)?)'
            price_match = re.search(price_pattern, content[match.start():match.start() + 1000])
            if price_match:
                start_pos = match.start() + price_match.start()
                end_pos = match.start() + price_match.end()
                content = content[:start_pos] + f'"price": {avg_price:.2f}' + content[end_pos:]
        
        return content
    
    def sync_all_products(self):
        """Main sync function"""
        print("🚀 Starting Corrected Printful Sync...")
        
        # Fetch all store products
        store_products = self.fetch_store_products()
        print(f"📦 Found {len(store_products)} products in store")
        
        products_data = {}
        
        for product in store_products:
            product_name = product.get("name")
            sync_product_id = product.get("id")
            
            if not product_name or not sync_product_id:
                continue
            
            print(f"\n🔄 Processing: {product_name}")
            
            try:
                # Build corrected availability data
                corrected_data = self.build_corrected_availability(sync_product_id)
                
                if corrected_data["sizes"] and corrected_data["colors"]:
                    products_data[product_name] = corrected_data
                    print(f"✅ {product_name}: {len(corrected_data['sizes'])} sizes, {len(corrected_data['colors'])} colors")
                    
                    # Show pricing info
                    if corrected_data.get('pricing'):
                        prices = [p.get('retail_price', 0) for p in corrected_data['pricing'].values()]
                        if prices:
                            min_price = min(prices)
                            max_price = max(prices)
                            print(f"   💰 Price range: ${min_price:.2f} - ${max_price:.2f}")
                else:
                    print(f"⚠️ {product_name}: No size/color data found")
                
            except Exception as e:
                print(f"❌ Error processing {product_name}: {e}")
                continue
        
        # Update the products.js file
        if products_data:
            self.update_products_js(products_data)
            print(f"\n🎉 Successfully synced {len(products_data)} products with size/color data!")
        else:
            print("❌ No products with size/color data were found")

def main():
    api_key = os.getenv("PRINTFUL_API_KEY")
    if not api_key:
        print("❌ PRINTFUL_API_KEY environment variable not set")
        return
    
    syncer = CorrectedPrintfulSync(api_key)
    syncer.sync_all_products()

if __name__ == "__main__":
    main()
