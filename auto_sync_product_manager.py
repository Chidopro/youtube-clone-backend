#!/usr/bin/env python3
"""
Auto-Sync Product Manager for ScreenMerch
Automatically syncs changes to the website after saving products.
"""

import json
import os
import subprocess
import sys
from datetime import datetime

class AutoSyncProductManager:
    def __init__(self):
        self.products_file = "products.json"
        self.backup_file = f"products_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        self.products = []
        
        # Basic colors from your selection
        self.basic_colors = {
            "Black": {"name": "Black", "code": "#000000", "printful_id": "Black"},
            "White": {"name": "White", "code": "#ffffff", "printful_id": "White"},
            "Navy": {"name": "Navy", "code": "#212642", "printful_id": "Navy"},
            "Grey": {"name": "Grey", "code": "#808080", "printful_id": "Grey"},
            "Red": {"name": "Red", "code": "#dc143c", "printful_id": "Red"},
            "Pink": {"name": "Pink", "code": "#fdbfc7", "printful_id": "Pink"}
        }
        
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
            return True
        except Exception as e:
            print(f"❌ Error saving products: {e}")
            return False
    
    def auto_sync_to_website(self):
        """Automatically sync products to website and deploy"""
        print("\n🔄 Auto-syncing to website...")
        
        try:
            # Step 1: Run the sync script
            print("📝 Step 1: Syncing to app.py...")
            result = subprocess.run([sys.executable, "sync_products_to_app.py"], 
                                  capture_output=True, text=True, cwd=os.getcwd())
            
            if result.returncode == 0:
                print("✅ Sync to app.py successful!")
            else:
                print(f"❌ Sync failed: {result.stderr}")
                return False
            
            # Step 2: Deploy to Fly.io
            print("🚀 Step 2: Deploying to Fly.io...")
            deploy_result = subprocess.run(["fly", "deploy"], 
                                         capture_output=True, text=True, cwd="backend")
            
            if deploy_result.returncode == 0:
                print("✅ Deployment successful!")
                print("🌐 Your changes are now live on the website!")
                return True
            else:
                print(f"❌ Deployment failed: {deploy_result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Auto-sync error: {e}")
            return False
    
    def select_basic_colors(self):
        """Let user select from basic colors"""
        print(f"\n🎨 Basic Colors Available:")
        print("-" * 50)
        
        color_list = list(self.basic_colors.keys())
        selected_colors = []
        
        for i, color in enumerate(color_list, 1):
            color_info = self.basic_colors[color]
            print(f"[ ] {i:2d}. {color} ({color_info['code']})")
        
        print("\nEnter color numbers to select (comma-separated, e.g., 1,3,5):")
        print("Or type 'all' to select all colors:")
        try:
            selections = input("Selected colors: ").strip()
            if selections.lower() == 'all':
                selected_colors = color_list
            elif selections:
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
        print("\n📏 Size-based Pricing Setup")
        print("-" * 40)
        
        sizes = {
            'XS': 0, 'S': 0, 'M': 0, 'L': 0, 'XL': 0, 'XXL': 0, 'XXXL': 0
        }
        
        print("Enter price adjustments for each size (0 for no change):")
        for size in sizes:
            try:
                adjustment = float(input(f"{size}: $").strip() or "0")
                sizes[size] = adjustment
            except ValueError:
                print(f"❌ Invalid price for {size}, using $0")
                sizes[size] = 0
        
        return sizes
    
    def list_products(self):
        """List all products"""
        if not self.products:
            print("📝 No products found.")
            return
        
        print(f"\n📋 Products ({len(self.products)} total):")
        print("-" * 80)
        
        for i, product in enumerate(self.products, 1):
            name = product.get('name', 'Unknown')
            price = product.get('base_price', 0)
            colors = product.get('options', {}).get('color', [])
            category = product.get('category', 'Unknown')
            
            print(f"{i:2d}. {name}")
            print(f"    💰 Price: ${price}")
            print(f"    🎨 Colors: {', '.join(colors[:5])}{'...' if len(colors) > 5 else ''}")
            print(f"    📂 Category: {category}")
            print()
    
    def add_product(self):
        """Add a new product"""
        print("\n➕ Add New Product")
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
        
        # Select colors from basic colors
        colors = self.select_basic_colors()
        
        # Get size pricing
        size_pricing = self.get_size_pricing()
        
        product = {
            "name": name,
            "base_price": base_price,
            "category": category,
            "description": description,
            "colors": colors,
            "options": {
                "color": colors,
                "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]
            },
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
            choice = int(input("\nEnter product number to edit: ")) - 1
            if choice < 0 or choice >= len(self.products):
                print("❌ Invalid product number!")
                return
        except ValueError:
            print("❌ Please enter a valid number!")
            return
        
        product = self.products[choice]
        print(f"\n✏️ Editing: {product['name']}")
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
        print(f"\nCurrent colors: {', '.join(product.get('colors', []))}")
        change_colors = input("Change colors? (y/N): ").strip().lower()
        if change_colors == 'y':
            new_colors = self.select_basic_colors()
            if new_colors:
                product['colors'] = new_colors
                # Also update options.color for website compatibility
                if 'options' not in product:
                    product['options'] = {}
                product['options']['color'] = new_colors
        
        # Edit size pricing
        print(f"\nCurrent size pricing: {product.get('size_pricing', {})}")
        change_pricing = input("Change size pricing? (y/N): ").strip().lower()
        if change_pricing == 'y':
            new_pricing = self.get_size_pricing()
            product['size_pricing'] = new_pricing
        
        product['updated_at'] = datetime.now().isoformat()
        print("✅ Product updated!")
    
    def delete_product(self):
        """Delete a product"""
        if not self.products:
            print("📝 No products to delete.")
            return
        
        self.list_products()
        try:
            choice = int(input("\nEnter product number to delete: ")) - 1
            if choice < 0 or choice >= len(self.products):
                print("❌ Invalid product number!")
                return
        except ValueError:
            print("❌ Please enter a valid number!")
            return
        
        product = self.products[choice]
        confirm = input(f"\n⚠️ Are you sure you want to delete '{product['name']}'? (y/N): ").strip().lower()
        
        if confirm == 'y':
            deleted = self.products.pop(choice)
            print(f"✅ Deleted: {deleted['name']}")
        else:
            print("❌ Deletion cancelled.")
    
    def show_menu(self):
        """Display the main menu"""
        print("\n" + "="*60)
        print("🛍️ Auto-Sync ScreenMerch Product Manager")
        print("="*60)
        print("1. List Products")
        print("2. Add Product")
        print("3. Edit Product")
        print("4. Delete Product")
        print("5. Save & Auto-Sync to Website")
        print("6. Save Only (No Sync)")
        print("7. Exit without saving")
        print("-"*60)
    
    def run(self):
        """Main application loop"""
        print("🚀 Starting Auto-Sync ScreenMerch Product Manager...")
        print("💡 Changes will automatically sync to your website!")
        
        while True:
            self.show_menu()
            choice = input("Enter your choice (1-7): ").strip()
            
            if choice == '1':
                self.list_products()
            elif choice == '2':
                self.add_product()
            elif choice == '3':
                self.edit_product()
            elif choice == '4':
                self.delete_product()
            elif choice == '5':
                if self.save_products():
                    print("\n🔄 Auto-syncing to website...")
                    if self.auto_sync_to_website():
                        print("🎉 All done! Your changes are live on the website!")
                    else:
                        print("⚠️ Auto-sync failed, but products were saved locally.")
                input("\nPress Enter to continue...")
            elif choice == '6':
                if self.save_products():
                    print("✅ Products saved locally (not synced to website)")
                input("\nPress Enter to continue...")
            elif choice == '7':
                print("👋 Exiting without saving...")
                break
            else:
                print("❌ Invalid choice! Please enter 1-7.")
            
            input("\nPress Enter to continue...")

def main():
    """Main function"""
    try:
        manager = AutoSyncProductManager()
        manager.run()
    except KeyboardInterrupt:
        print("\n\n👋 Product Manager interrupted. Goodbye!")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")

if __name__ == "__main__":
    main()
