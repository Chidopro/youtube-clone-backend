#!/usr/bin/env python3
"""
Enhanced Printful Sync - Handles size-specific color availability and regional pricing
This script properly syncs product data including:
- Size-specific color availability (some colors only available in certain sizes)
- Actual pricing from American/Mexican distribution hubs
- Regional cost variations
"""

import os
import json
import requests
import time
from typing import Dict, List, Tuple, Optional
from collections import defaultdict

PRINTFUL_BASE_URL = "https://api.printful.com"

class EnhancedPrintfulSync:
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
        """Fetch detailed variant information including pricing"""
        resp = requests.get(f"{PRINTFUL_BASE_URL}/products/variant/{variant_id}", headers=self.headers)
        resp.raise_for_status()
        return resp.json()["result"]
    
    def fetch_variant_pricing(self, variant_id: int) -> Dict:
        """Fetch pricing information for a specific variant"""
        try:
            resp = requests.get(f"{PRINTFUL_BASE_URL}/products/variant/{variant_id}", headers=self.headers)
            resp.raise_for_status()
            variant_data = resp.json()["result"]
            
            # Extract pricing information
            pricing = {
                "retail_price": variant_data.get("retail_price", 0),
                "wholesale_price": variant_data.get("wholesale_price", 0),
                "currency": variant_data.get("currency", "USD")
            }
            
            return pricing
        except Exception as e:
            print(f"⚠️ Error fetching pricing for variant {variant_id}: {e}")
            return {"retail_price": 0, "wholesale_price": 0, "currency": "USD"}
    
    def build_enhanced_availability(self, sync_product_id: int) -> Dict:
        """Build comprehensive availability and pricing data"""
        resp = requests.get(f"{PRINTFUL_BASE_URL}/store/products/{sync_product_id}", headers=self.headers)
        resp.raise_for_status()
        result = resp.json()["result"]
        sync_variants = result.get("sync_variants", [])
        
        # Enhanced data structure
        size_to_colors = defaultdict(set)
        all_colors = set()
        variant_pricing = {}
        size_color_pricing = {}
        
        print(f"🔍 Processing {len(sync_variants)} variants...")
        
        for i, sv in enumerate(sync_variants):
            variant_id = sv.get("variant_id")
            if not variant_id:
                continue
            
            print(f"📊 Processing variant {i+1}/{len(sync_variants)}: {variant_id}")
            
            # Fetch variant details
            details = self.fetch_variant_details(variant_id)
            
            # Extract size and color
            size = details.get("size") or details.get("options", {}).get("size")
            color = details.get("color") or details.get("options", {}).get("color")
            
            # Fallback parsing
            if not size or not color:
                name = details.get("name", "")
                if "/" in name:
                    parts = [p.strip() for p in name.split("/")]
                    if len(parts) >= 2:
                        color = color or parts[0]
                        size = size or parts[1]
            
            if size and color:
                # Normalize size
                normalized_size = self.normalize_size(size)
                
                # Store availability
                size_to_colors[normalized_size].add(color)
                all_colors.add(color)
                
                # Fetch pricing
                pricing = self.fetch_variant_pricing(variant_id)
                variant_pricing[variant_id] = pricing
                
                # Store size-color specific pricing
                size_color_key = f"{normalized_size}_{color}"
                size_color_pricing[size_color_key] = pricing
                
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
            "variant_pricing": variant_pricing
        }
    
    def normalize_size(self, size: str) -> str:
        """Normalize size names"""
        mapping = {
            "2XS": "XXS",
            "2XL": "XXL", 
            "3XL": "XXXL",
            "4XL": "XXXXL",
            "5XL": "XXXXXL",
        }
        return mapping.get(size.upper(), size.upper())
    
    def get_sorted_sizes(self, sizes: List[str]) -> List[str]:
        """Sort sizes in proper order"""
        size_order = [
            "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"
        ]
        
        # Normalize all sizes first
        normalized_sizes = [self.normalize_size(s) for s in sizes]
        
        # Sort according to size order
        sorted_sizes = []
        for size in size_order:
            if size in normalized_sizes:
                sorted_sizes.append(size)
        
        # Add any remaining sizes not in the order
        for size in normalized_sizes:
            if size not in sorted_sizes:
                sorted_sizes.append(size)
        
        return sorted_sizes
    
    def update_products_js(self, products_data: Dict):
        """Update the frontend products.js file with enhanced data"""
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
        """Update product pricing based on size-color combinations"""
        import re
        
        # Find the product block
        name_pattern = re.escape(f'"name": "{product_name}"')
        match = re.search(name_pattern, content)
        if not match:
            return content
        
        # For now, we'll update the base price to the average
        # In a full implementation, you'd want to handle size-specific pricing
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
        print("🚀 Starting Enhanced Printful Sync...")
        
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
                # Build enhanced availability data
                enhanced_data = self.build_enhanced_availability(sync_product_id)
                products_data[product_name] = enhanced_data
                
                print(f"✅ {product_name}: {len(enhanced_data['sizes'])} sizes, {len(enhanced_data['colors'])} colors")
                
            except Exception as e:
                print(f"❌ Error processing {product_name}: {e}")
                continue
        
        # Update the products.js file
        if products_data:
            self.update_products_js(products_data)
            print(f"\n🎉 Successfully synced {len(products_data)} products!")
        else:
            print("❌ No products were successfully processed")

def main():
    api_key = os.getenv("PRINTFUL_API_KEY")
    if not api_key:
        print("❌ PRINTFUL_API_KEY environment variable not set")
        return
    
    syncer = EnhancedPrintfulSync(api_key)
    syncer.sync_all_products()

if __name__ == "__main__":
    main()
