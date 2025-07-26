#!/usr/bin/env python3
"""
Download Script for Enhanced Product Manager
This script will create and save the product manager files to your desktop.
"""

import os
import sys

def create_product_manager_py():
    """Create the enhanced product_manager.py file"""
    content = '''#!/usr/bin/env python3
"""
Enhanced Product Manager for ScreenMerch
A standalone tool to manage products in the ScreenMerch system with Printful integration.
"""

import json
import os
import requests
from datetime import datetime

class ProductManager:
    def __init__(self):
        self.products_file = "products.json"
        self.backup_file = f"products_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        self.products = []
        self.printful_api_key = "C6c4vKYLebPS1Zsu66o8fp2DE9Mye2FYmE5ATiNf"
        self.printful_base_url = "https://api.printful.com"
        self.load_products()
    
    def load_products(self):
        """Load products from JSON file"""
        try:
            if os.path.exists(self.products_file):
                with open(self.products_file, 'r') as f:
                    self.products = json.load(f)
                print(f"✅ Loaded {len(self.products)} products from {self.products_file}")
            else:
                print("⚠️ No products file found. Starting with empty product list.")
                self.products = []
        except Exception as e:
            print(f"❌ Error loading products: {e}")
            self.products = []
    
    def save_products(self):
        """Save products to JSON file"""
        try:
            # Create backup first
            if os.path.exists(self.products_file):
                with open(self.products_file, 'r') as f:
                    backup_data = f.read()
                with open(self.backup_file, 'w') as f:
                    f.write(backup_data)
                print(f"📦 Backup created: {self.backup_file}")
            
            # Save current products
            with open(self.products_file, 'w') as f:
                json.dump(self.products, f, indent=2)
            print(f"✅ Saved {len(self.products)} products to {self.products_file}")
        except Exception as e:
            print(f"❌ Error saving products: {e}")
    
    def get_printful_colors(self, product_type_id):
        """Get available colors from Printful API"""
        try:
            headers = {
                'Authorization': f'Bearer {self.printful_api_key}',
                'Content-Type': 'application/json'
            }
            
            url = f"{self.printful_base_url}/products/{product_type_id}"
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'result' in data and 'variants' in data['result']:
                    colors = {}
                    for variant in data['result']['variants']:
                        if 'color' in variant:
                            color_name = variant['color']
                            color_code = variant.get('color_code', '')
                            colors[color_name] = color_code
                    return colors
            else:
                print(f"❌ Printful API error: {response.status_code}")
                return {}
        except Exception as e:
            print(f"❌ Error fetching colors: {e}")
            return {}
    
    def get_printful_product_types(self):
        """Get available product types from Printful"""
        try:
            headers = {
                'Authorization': f'Bearer {self.printful_api_key}',
                'Content-Type': 'application/json'
            }
            
            url = f"{self.printful_base_url}/products"
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'result' in data:
                    return data['result']
            else:
                print(f"❌ Printful API error: {response.status_code}")
                return []
        except Exception as e:
            print(f"❌ Error fetching product types: {e}")
            return []
    
    def select_colors(self, product_type_id):
        """Let user select colors with checkboxes"""
        colors = self.get_printful_colors(product_type_id)
        if not colors:
            print("❌ No colors available for this product type")
            return []
        
        print(f"\\n🎨 Available Colors for Product Type {product_type_id}:")
        print("-" * 50)
        
        color_list = list(colors.keys())
        selected_colors = []
        
        for i, color in enumerate(color_list, 1):
            color_code = colors[color]
            print(f"[ ] {i:2d}. {color} {f'({color_code})' if color_code else ''}")
        
        print("\\nEnter color numbers to select (comma-separated, e.g., 1,3,5):")
        try:
            selections = input("Selected colors: ").strip()
            if selections:
                indices = [int(x.strip()) - 1 for x in selections.split(',')]
                for idx in indices:
                    if 0 <= idx < len(color_list):
                        selected_colors.append(color_list[idx])
                    else:
                        print(f"⚠️ Invalid color number: {idx + 1}")
        except ValueError:
            print("❌ Invalid input format")
        
        return selected_colors
    
    def get_size_pricing(self):
        """Get size-based pricing from user"""
        print("\\n📏 Size-based Pricing Setup")
        print("-" * 40)
        
        sizes = {
            'XS': 0, 'S': 0, 'M': 0, 'L': 0, 'XL': 0, 'XXL': 0, 'XXXL': 0
        }
        
        print("Enter price adjustments for each size (0 for no change):")
        for size in sizes:
            try:
                price_input = input(f"{size}: $").strip()
                if price_input:
                    sizes[size] = float(price_input)
            except ValueError:
                print(f"❌ Invalid price for {size}, using $0")
                sizes[size] = 0
        
        return sizes
    
    def list_products(self):
        """Display all products"""
        if not self.products:
            print("📝 No products found.")
            return
        
        print(f"\\n📋 Product List ({len(self.products)} products):")
        print("-" * 80)
        for i, product in enumerate(self.products, 1):
            print(f"{i:2d}. {product.get('name', 'N/A')}")
            print(f"     Base Price: ${product.get('base_price', 0):.2f}")
            print(f"     Category: {product.get('category', 'N/A')}")
            
            # Show size pricing
            if 'size_pricing' in product:
                print(f"     Size Pricing: {product['size_pricing']}")
            
            # Show selected colors
            if 'colors' in product and product['colors']:
                colors_str = ', '.join(product['colors'][:3])
                if len(product['colors']) > 3:
                    colors_str += f" (+{len(product['colors']) - 3} more)"
                print(f"     Colors: {colors_str}")
            
            if product.get('description'):
                desc = product['description'][:50] + "..." if len(product['description']) > 50 else product['description']
                print(f"     Description: {desc}")
            print()
    
    def add_product(self):
        """Add a new product"""
        print("\\n➕ Add New Product")
        print("-" * 40)
        
        name = input("Product name: ").strip()
        if not name:
            print("❌ Product name is required!")
            return
        
        try:
            base_price = float(input("Base price ($): ").strip())
        except ValueError:
            print("❌ Invalid price!")
            return
        
        category = input("Category: ").strip() or "Custom Merch"
        description = input("Description (optional): ").strip()
        
        # Get Printful product type
        print("\\n🛍️ Select Printful Product Type:")
        product_types = self.get_printful_product_types()
        if product_types:
            print("Available product types:")
            for i, pt in enumerate(product_types[:10], 1):  # Show first 10
                print(f"{i:2d}. {pt.get('title', 'N/A')} (ID: {pt.get('id', 'N/A')})")
            
            try:
                choice = int(input("Enter product type number: ")) - 1
                if 0 <= choice < len(product_types):
                    product_type = product_types[choice]
                    product_type_id = product_type.get('id')
                else:
                    print("❌ Invalid selection, using default")
                    product_type_id = None
            except ValueError:
                print("❌ Invalid input, using default")
                product_type_id = None
        else:
            product_type_id = None
        
        # Get colors
        colors = []
        if product_type_id:
            colors = self.select_colors(product_type_id)
        
        # Get size pricing
        size_pricing = self.get_size_pricing()
        
        product = {
            "name": name,
            "base_price": base_price,
            "category": category,
            "description": description,
            "printful_product_type_id": product_type_id,
            "colors": colors,
            "size_pricing": size_pricing,
            "created_at": datetime.now().isoformat()
        }
        
        self.products.append(product)
        print(f"✅ Added product: {name}")
        print(f"   Colors: {len(colors)} selected")
        print(f"   Size pricing configured")
    
    def edit_product(self):
        """Edit an existing product"""
        if not self.products:
            print("📝 No products to edit.")
            return
        
        self.list_products()
        try:
            choice = int(input("\\nEnter product number to edit: ")) - 1
            if choice < 0 or choice >= len(self.products):
                print("❌ Invalid product number!")
                return
        except ValueError:
            print("❌ Please enter a valid number!")
            return
        
        product = self.products[choice]
        print(f"\\n✏️ Editing: {product['name']}")
        print("-" * 40)
        
        # Edit basic fields
        name = input(f"Name ({product['name']}): ").strip()
        if name:
            product['name'] = name
        
        try:
            price_input = input(f"Base Price (${product['base_price']}): ").strip()
            if price_input:
                product['base_price'] = float(price_input)
        except ValueError:
            print("❌ Invalid price format!")
            return
        
        category = input(f"Category ({product['category']}): ").strip()
        if category:
            product['category'] = category
        
        description = input(f"Description ({product.get('description', '')}): ").strip()
        if description:
            product['description'] = description
        
        # Edit colors
        if product.get('printful_product_type_id'):
            print(f"\\nCurrent colors: {', '.join(product.get('colors', []))}")
            change_colors = input("Change colors? (y/N): ").strip().lower()
            if change_colors == 'y':
                new_colors = self.select_colors(product['printful_product_type_id'])
                if new_colors:
                    product['colors'] = new_colors
        
        # Edit size pricing
        print(f"\\nCurrent size pricing: {product.get('size_pricing', {})}")
        change_sizes = input("Change size pricing? (y/N): ").strip().lower()
        if change_sizes == 'y':
            product['size_pricing'] = self.get_size_pricing()
        
        product['updated_at'] = datetime.now().isoformat()
        print(f"✅ Updated product: {product['name']}")
    
    def delete_product(self):
        """Delete a product"""
        if not self.products:
            print("📝 No products to delete.")
            return
        
        self.list_products()
        try:
            choice = int(input("\\nEnter product number to delete: ")) - 1
            if choice < 0 or choice >= len(self.products):
                print("❌ Invalid product number!")
                return
        except ValueError:
            print("❌ Please enter a valid number!")
            return
        
        product = self.products[choice]
        confirm = input(f"🗑️ Are you sure you want to delete '{product['name']}'? (y/N): ").strip().lower()
        if confirm == 'y':
            deleted = self.products.pop(choice)
            print(f"✅ Deleted product: {deleted['name']}")
        else:
            print("❌ Deletion cancelled.")
    
    def export_products(self):
        """Export products to a file"""
        if not self.products:
            print("📝 No products to export.")
            return
        
        filename = f"products_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        try:
            with open(filename, 'w') as f:
                json.dump(self.products, f, indent=2)
            print(f"📤 Exported {len(self.products)} products to {filename}")
        except Exception as e:
            print(f"❌ Error exporting products: {e}")
    
    def import_products(self):
        """Import products from a file"""
        filename = input("Enter filename to import from: ").strip()
        if not filename:
            print("❌ No filename provided!")
            return
        
        try:
            with open(filename, 'r') as f:
                imported_products = json.load(f)
            
            if not isinstance(imported_products, list):
                print("❌ Invalid file format!")
                return
            
            confirm = input(f"📥 Import {len(imported_products)} products? (y/N): ").strip().lower()
            if confirm == 'y':
                self.products.extend(imported_products)
                print(f"✅ Imported {len(imported_products)} products")
            else:
                print("❌ Import cancelled.")
        except FileNotFoundError:
            print(f"❌ File not found: {filename}")
        except Exception as e:
            print(f"❌ Error importing products: {e}")
    
    def show_menu(self):
        """Display the main menu"""
        print("\\n" + "="*50)
        print("🛍️ ScreenMerch Product Manager (Enhanced)")
        print("="*50)
        print("1. List Products")
        print("2. Add Product")
        print("3. Edit Product")
        print("4. Delete Product")
        print("5. Export Products")
        print("6. Import Products")
        print("7. Save & Exit")
        print("8. Exit without saving")
        print("-"*50)
    
    def run(self):
        """Main application loop"""
        print("🚀 Starting Enhanced ScreenMerch Product Manager...")
        print(f"🔑 Using Printful API key: {self.printful_api_key[:10]}...")
        
        while True:
            self.show_menu()
            choice = input("Enter your choice (1-8): ").strip()
            
            if choice == '1':
                self.list_products()
            elif choice == '2':
                self.add_product()
            elif choice == '3':
                self.edit_product()
            elif choice == '4':
                self.delete_product()
            elif choice == '5':
                self.export_products()
            elif choice == '6':
                self.import_products()
            elif choice == '7':
                self.save_products()
                print("👋 Goodbye!")
                break
            elif choice == '8':
                print("👋 Exiting without saving...")
                break
            else:
                print("❌ Invalid choice! Please enter 1-8.")
            
            input("\\nPress Enter to continue...")

def main():
    """Main function"""
    try:
        manager = ProductManager()
        manager.run()
    except KeyboardInterrupt:
        print("\\n\\n👋 Product Manager interrupted. Goodbye!")
    except Exception as e:
        print(f"\\n❌ Unexpected error: {e}")

if __name__ == "__main__":
    main()
'''
    return content

def create_batch_file():
    """Create the start_product_manager.bat file"""
    content = '''@echo off
echo Starting Enhanced ScreenMerch Product Manager...
echo.
python product_manager.py
echo.
echo Press any key to exit...
pause >nul
'''
    return content

def create_readme():
    """Create the README file"""
    content = '''# Enhanced ScreenMerch Product Manager

## 🚀 Features

### Size-Based Pricing
- Set different price adjustments for each size (XS, S, M, L, XL, XXL, XXXL)
- Base price + size adjustments for flexible pricing

### Printful Integration
- **API Key**: Uses your Printful API key to fetch real product data
- **Product Types**: Browse and select from available Printful product types
- **Color Selection**: Get all available colors with checkboxes for easy selection

### Product Management
- Add, edit, delete products
- Import/export product data
- Automatic backups before saving
- JSON-based storage

## 📁 Files

- `product_manager.py` - Main application
- `start_product_manager.bat` - Windows launcher
- `products.json` - Product data (created automatically)
- `products_backup_*.json` - Automatic backups

## 🛠️ Setup

1. **Install Python** (if not already installed)
2. **Install required packages**:
   ```
   pip install requests
   ```
3. **Run the application**:
   - Double-click `start_product_manager.bat`
   - Or run: `python product_manager.py`

## 🎨 Using Color Selection

When adding/editing products:
1. Select a Printful product type
2. View available colors with checkboxes
3. Enter color numbers (comma-separated): `1,3,5`
4. Selected colors are saved with the product

## 💰 Size Pricing

For each product, you can set price adjustments:
- XS: $0 (no change)
- S: $0 (no change)  
- M: $0 (no change)
- L: $0 (no change)
- XL: $2 (add $2)
- XXL: $3 (add $3)
- XXXL: $4 (add $4)

## 🔑 API Configuration

The tool uses your Printful API key:
`C6c4vKYLebPS1Zsu66o8fp2DE9Mye2FYmE5ATiNf`

## 📊 Data Structure

Products are stored with:
- Basic info (name, price, category, description)
- Printful product type ID
- Selected colors array
- Size pricing adjustments
- Timestamps

## 🔄 Backup System

- Automatic backups before each save
- Backup files named with timestamps
- Safe to experiment with changes
'''
    return content

def main():
    """Main function to create all files"""
    desktop_path = os.path.expanduser("~/Desktop")
    product_manager_path = os.path.join(desktop_path, "Product Manager")
    
    # Create directory if it doesn't exist
    if not os.path.exists(product_manager_path):
        os.makedirs(product_manager_path)
        print(f"✅ Created directory: {product_manager_path}")
    
    # Create product_manager.py
    py_file_path = os.path.join(product_manager_path, "product_manager.py")
    with open(py_file_path, 'w', encoding='utf-8') as f:
        f.write(create_product_manager_py())
    print(f"✅ Created: {py_file_path}")
    
    # Create start_product_manager.bat
    bat_file_path = os.path.join(product_manager_path, "start_product_manager.bat")
    with open(bat_file_path, 'w', encoding='utf-8') as f:
        f.write(create_batch_file())
    print(f"✅ Created: {bat_file_path}")
    
    # Create README.md
    readme_file_path = os.path.join(product_manager_path, "README.md")
    with open(readme_file_path, 'w', encoding='utf-8') as f:
        f.write(create_readme())
    print(f"✅ Created: {readme_file_path}")
    
    print(f"\\n🎉 All files created successfully in: {product_manager_path}")
    print("\\n📋 Files created:")
    print("  - product_manager.py (Enhanced with Printful integration)")
    print("  - start_product_manager.bat (Easy launcher)")
    print("  - README.md (Documentation)")
    print("\\n🚀 To start using:")
    print("  1. Double-click 'start_product_manager.bat'")
    print("  2. Or run: python product_manager.py")
    print("\\n📦 Make sure you have the 'requests' package installed:")
    print("  pip install requests")

if __name__ == "__main__":
    main() 