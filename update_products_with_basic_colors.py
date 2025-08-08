#!/usr/bin/env python3
"""
Update existing products with basic colors
This script will update your products.json file to use the basic colors
"""

import json
import os
from datetime import datetime

# Basic colors from your selection
BASIC_COLORS = {
    "Black": {"name": "Black", "code": "#000000", "printful_id": "Black"},
    "White": {"name": "White", "code": "#ffffff", "printful_id": "White"},
    "Navy": {"name": "Navy", "code": "#212642", "printful_id": "Navy"},
    "Grey": {"name": "Grey", "code": "#808080", "printful_id": "Grey"},
    "Red": {"name": "Red", "code": "#dc143c", "printful_id": "Red"},
    "Pink": {"name": "Pink", "code": "#fdbfc7", "printful_id": "Pink"}
}

def update_products_with_basic_colors():
    """Update existing products to use basic colors"""
    
    products_file = "products.json"
    
    # Check if products file exists
    if not os.path.exists(products_file):
        print(f"❌ Products file not found: {products_file}")
        print("Please run the product manager first to create some products.")
        return
    
    # Load existing products
    try:
        with open(products_file, 'r') as f:
            products = json.load(f)
        print(f"✅ Loaded {len(products)} products from {products_file}")
    except Exception as e:
        print(f"❌ Error loading products: {e}")
        return
    
    # Create backup
    backup_file = f"products_backup_basic_colors_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(backup_file, 'w') as f:
        json.dump(products, f, indent=2)
    print(f"📦 Backup created: {backup_file}")
    
    # Update each product
    updated_count = 0
    for product in products:
        if 'colors' in product:
            print(f"\n🔄 Updating colors for: {product['name']}")
            print(f"   Old colors: {', '.join(product['colors'])}")
            
            # Map existing colors to basic colors
            new_colors = []
            for old_color in product['colors']:
                # Try to find a matching basic color
                if old_color in BASIC_COLORS:
                    new_colors.append(old_color)
                elif 'black' in old_color.lower():
                    new_colors.append('Black')
                elif 'white' in old_color.lower():
                    new_colors.append('White')
                elif 'navy' in old_color.lower() or 'blue' in old_color.lower():
                    new_colors.append('Navy')
                elif 'grey' in old_color.lower() or 'gray' in old_color.lower():
                    new_colors.append('Grey')
                elif 'red' in old_color.lower():
                    new_colors.append('Red')
                elif 'pink' in old_color.lower():
                    new_colors.append('Pink')
                else:
                    # Default to Black if no match found
                    new_colors.append('Black')
            
            # Remove duplicates
            new_colors = list(set(new_colors))
            product['colors'] = new_colors
            
            print(f"   New colors: {', '.join(new_colors)}")
            updated_count += 1
    
    # Save updated products
    try:
        with open(products_file, 'w') as f:
            json.dump(products, f, indent=2)
        print(f"\n✅ Updated {updated_count} products with basic colors")
        print(f"📁 Saved to: {products_file}")
    except Exception as e:
        print(f"❌ Error saving products: {e}")

def show_basic_colors():
    """Display the basic colors"""
    print("\n🎨 Basic Colors Available:")
    print("-" * 50)
    for i, (color_name, color_info) in enumerate(BASIC_COLORS.items(), 1):
        print(f"{i:2d}. {color_name} ({color_info['code']})")
    print("-" * 50)

def main():
    """Main function"""
    print("🛍️ ScreenMerch Basic Colors Updater")
    print("=" * 50)
    
    show_basic_colors()
    
    print("\nThis script will:")
    print("1. Load your existing products.json file")
    print("2. Create a backup of your current products")
    print("3. Update all products to use the basic colors")
    print("4. Save the updated products back to products.json")
    
    confirm = input("\nContinue? (y/N): ").strip().lower()
    if confirm == 'y':
        update_products_with_basic_colors()
    else:
        print("❌ Update cancelled.")

if __name__ == "__main__":
    main()
