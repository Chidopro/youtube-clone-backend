#!/usr/bin/env python3
"""
Manual Product Editor - Let you manually input prices and colors for each product
"""

import json
import re
import time
from typing import Dict, List

class ManualProductEditor:
    def __init__(self):
        self.app_file = "backend/app.py"
        self.backup_file = f"{self.app_file}.{int(time.time())}.bak"
    
    def load_current_products(self) -> List[Dict]:
        """Load current products from backend/app.py"""
        with open(self.app_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find the PRODUCTS array
        products_start = content.find("PRODUCTS = [")
        if products_start == -1:
            print("❌ Could not find PRODUCTS array")
            return []
        
        # Extract the products array content
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
        
        products_content = content[products_start:products_end]
        
        # Parse products (simple regex approach)
        products = []
        product_pattern = r'{\s*"name":\s*"([^"]+)",\s*"price":\s*([0-9.]+),'
        matches = re.findall(product_pattern, products_content)
        
        for name, price in matches:
            products.append({
                "name": name,
                "price": float(price)
            })
        
        return products
    
    def show_products(self, products: List[Dict]):
        """Display current products"""
        print(f"\n📋 Current Products ({len(products)} total):")
        print("-" * 60)
        for i, product in enumerate(products, 1):
            print(f"{i:2d}. {product['name']} - ${product['price']:.2f}")
    
    def edit_product_price(self, products: List[Dict], index: int):
        """Edit a specific product's price"""
        if index < 0 or index >= len(products):
            print("❌ Invalid product number!")
            return
        
        product = products[index]
        print(f"\n✏️ Editing: {product['name']}")
        print(f"Current price: ${product['price']:.2f}")
        
        try:
            new_price = float(input("Enter new price: $"))
            products[index]['price'] = new_price
            print(f"✅ Updated {product['name']} to ${new_price:.2f}")
        except ValueError:
            print("❌ Invalid price format!")
    
    def edit_product_colors(self, products: List[Dict], index: int):
        """Edit a specific product's colors"""
        if index < 0 or index >= len(products):
            print("❌ Invalid product number!")
            return
        
        product = products[index]
        print(f"\n🎨 Editing colors for: {product['name']}")
        
        print("\nEnter colors (one per line, press Enter twice when done):")
        colors = []
        while True:
            color = input("Color: ").strip()
            if not color:
                break
            colors.append(color)
        
        if colors:
            # Update the product in the actual file
            self.update_product_colors_in_file(product['name'], colors)
            print(f"✅ Updated {product['name']} with {len(colors)} colors: {', '.join(colors)}")
    
    def update_product_colors_in_file(self, product_name: str, colors: List[str]):
        """Update colors for a specific product in the app.py file"""
        with open(self.app_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find the product and update its colors
        color_pattern = rf'"name":\s*"{re.escape(product_name)}"[^}}]*"color":\s*\[([^\]]+)\]'
        
        def replace_colors(match):
            colors_str = ', '.join([f'"{color}"' for color in colors])
            return match.group(0).replace(match.group(1), colors_str)
        
        updated_content = re.sub(color_pattern, replace_colors, content)
        
        with open(self.app_file, 'w', encoding='utf-8') as f:
            f.write(updated_content)
    
    def update_all_prices_in_file(self, products: List[Dict]):
        """Update all prices in the app.py file"""
        with open(self.app_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Update each product's price
        for product in products:
            name = product['name']
            price = product['price']
            
            # Find and replace the price for this product
            price_pattern = rf'"name":\s*"{re.escape(name)}"[^}}]*"price":\s*([0-9.]+)'
            
            def replace_price(match):
                return match.group(0).replace(match.group(1), str(price))
            
            content = re.sub(price_pattern, replace_price, content)
        
        with open(self.app_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print("✅ Updated all prices in backend/app.py")
    
    def create_backup(self):
        """Create backup of current app.py"""
        with open(self.app_file, 'r', encoding='utf-8') as f:
            content = f.read()
        with open(self.backup_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"📦 Backup created: {self.backup_file}")
    
    def run(self):
        """Main application loop"""
        print("🛍️ Manual Product Editor")
        print("=" * 50)
        
        # Create backup
        self.create_backup()
        
        # Load current products
        products = self.load_current_products()
        if not products:
            print("❌ No products found!")
            return
        
        while True:
            self.show_products(products)
            
            print("\n📝 Options:")
            print("1. Edit product price")
            print("2. Edit product colors")
            print("3. Save all changes")
            print("4. Exit without saving")
            
            choice = input("\nEnter your choice (1-4): ").strip()
            
            if choice == '1':
                try:
                    index = int(input("Enter product number to edit: ")) - 1
                    self.edit_product_price(products, index)
                except ValueError:
                    print("❌ Please enter a valid number!")
            
            elif choice == '2':
                try:
                    index = int(input("Enter product number to edit colors: ")) - 1
                    self.edit_product_colors(products, index)
                except ValueError:
                    print("❌ Please enter a valid number!")
            
            elif choice == '3':
                self.update_all_prices_in_file(products)
                print("✅ All changes saved!")
                break
            
            elif choice == '4':
                print("👋 Exiting without saving...")
                break
            
            else:
                print("❌ Invalid choice! Please enter 1-4.")

def main():
    editor = ManualProductEditor()
    editor.run()

if __name__ == "__main__":
    main()
