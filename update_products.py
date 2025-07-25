#!/usr/bin/env python3
"""
ScreenMerch Product Update Script
Updates product catalog with new prices, availability, and profit margins
"""

import json
import os
from typing import Dict, List, Any

def load_template():
    """Load the product update template"""
    try:
        with open("product_update_template.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print("❌ product_update_template.json not found. Run product_review_tool.py first.")
        return None

def update_backend_products(updated_products: List[Dict]):
    """Update the backend app.py with new product data"""
    print("🔄 Updating backend product catalog...")
    
    # Read current backend app.py
    backend_files = [
        "backend/app.py",
        "app.py", 
        "frontend_app.py"
    ]
    
    for file_path in backend_files:
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                # Find the PRODUCTS list in the file
                start_marker = "PRODUCTS = ["
                end_marker = "]"
                
                start_idx = content.find(start_marker)
                if start_idx == -1:
                    print(f"⚠️  Could not find PRODUCTS list in {file_path}")
                    continue
                
                # Find the end of the PRODUCTS list
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
                
                # Generate new PRODUCTS list
                new_products_list = "PRODUCTS = [\n"
                for product in updated_products:
                    if not product.get("available", True):
                        continue  # Skip unavailable products
                    
                    new_products_list += f"    {{\n"
                    new_products_list += f'        "name": "{product["name"]}",\n'
                    new_products_list += f'        "price": {product["suggested_price"]},\n'
                    new_products_list += f'        "filename": "{product["name"].lower().replace(" ", "").replace("\'", "")}preview.png",\n'
                    new_products_list += f'        "main_image": "{product["name"].lower().replace(" ", "").replace("\'", "")}.png",\n'
                    
                    # Handle options
                    options = product["options"]
                    if options.get("color") and options.get("size"):
                        new_products_list += f'        "options": {{"color": {options["color"]}, "size": {options["size"]}}}\n'
                    elif options.get("color"):
                        new_products_list += f'        "options": {{"color": {options["color"]}, "size": []}}\n'
                    elif options.get("size"):
                        new_products_list += f'        "options": {{"color": [], "size": {options["size"]}}}\n'
                    else:
                        new_products_list += f'        "options": {{"color": [], "size": []}}\n'
                    
                    new_products_list += f"    }},\n"
                
                new_products_list += "]"
                
                # Replace the old PRODUCTS list
                new_content = content[:start_idx] + new_products_list + content[end_idx:]
                
                # Write back to file
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                
                print(f"✅ Updated {file_path}")
                
            except Exception as e:
                print(f"❌ Error updating {file_path}: {str(e)}")

def update_frontend_products(updated_products: List[Dict]):
    """Update the frontend products.js with new product data"""
    print("🔄 Updating frontend product catalog...")
    
    frontend_files = [
        "frontend/src/data/products.js",
        "src/data/products.js"
    ]
    
    for file_path in frontend_files:
        if os.path.exists(file_path):
            try:
                # Generate new products object
                new_content = "export const products = {\n"
                
                for product in updated_products:
                    if not product.get("available", True):
                        continue  # Skip unavailable products
                    
                    # Create product key
                    product_key = product["name"].lower().replace(" ", "").replace("'", "").replace("-", "")
                    
                    new_content += f'  "{product_key}": {{\n'
                    new_content += f'    name: "{product["name"]}",\n'
                    new_content += f'    price: {product["suggested_price"]},\n'
                    new_content += f'    description: "{product["name"]} with custom prints",\n'
                    new_content += f'    image: "/static/images/{product["name"].lower().replace(" ", "").replace("\'", "")}.png",\n'
                    new_content += f'    preview: "/static/images/{product["name"].lower().replace(" ", "").replace("\'", "")}preview.png",\n'
                    new_content += f'    category: "{product["category"]}",\n'
                    
                    # Handle variables
                    options = product["options"]
                    if options.get("color") or options.get("size"):
                        new_content += f'    variables: {{\n'
                        if options.get("size"):
                            new_content += f'      sizes: {options["size"]},\n'
                        if options.get("color"):
                            new_content += f'      colors: {options["color"]},\n'
                        
                        # Generate availability (all true for now)
                        new_content += f'      availability: {{\n'
                        if options.get("size") and options.get("color"):
                            for size in options["size"]:
                                new_content += f'        "{size}": {{\n'
                                for color in options["color"]:
                                    new_content += f'          "{color}": true,\n'
                                new_content += f'        }},\n'
                        elif options.get("color"):
                            for color in options["color"]:
                                new_content += f'        "{color}": true,\n'
                        new_content += f'      }}\n'
                        new_content += f'    }}\n'
                    
                    new_content += f'  }},\n'
                
                new_content += "};\n\n"
                
                # Add helper functions
                new_content += '''// Helper function to check availability
export const checkAvailability = (productId, size = null, color = null) => {
  const product = products[productId];
  if (!product) return false;
  
  if (!product.variables) return true; // No variables = always available
  
  if (size && color) {
    return product.variables.availability?.[size]?.[color] ?? false;
  } else if (color) {
    return product.variables.availability?.[color] ?? false;
  }
  
  return true;
};

// Helper function to get available options
export const getAvailableOptions = (productId) => {
  const product = products[productId];
  if (!product?.variables) return { sizes: [], colors: [] };
  
  const available = { sizes: [], colors: [] };
  
  if (product.variables.sizes) {
    available.sizes = product.variables.sizes.filter(size => 
      Object.values(product.variables.availability[size] || {}).some(available => available)
    );
  }
  
  if (product.variables.colors) {
    if (product.variables.sizes) {
      // For products with both size and color
      const allColors = new Set();
      product.variables.sizes.forEach(size => {
        Object.entries(product.variables.availability[size] || {}).forEach(([color, available]) => {
          if (available) allColors.add(color);
        });
      });
      available.colors = Array.from(allColors);
    } else {
      // For products with only color
      available.colors = product.variables.colors.filter(color => 
        product.variables.availability[color]
      );
    }
  }
  
  return available;
};
'''
                
                # Write to file
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                
                print(f"✅ Updated {file_path}")
                
            except Exception as e:
                print(f"❌ Error updating {file_path}: {str(e)}")

def calculate_profit_margins(updated_products: List[Dict]):
    """Calculate and display profit margins for each product"""
    print("💰 PROFIT MARGIN CALCULATIONS")
    print("=" * 50)
    
    total_profit = 0
    total_revenue = 0
    
    for product in updated_products:
        if not product.get("available", True):
            continue
            
        cost = product.get("cost_estimate", 0)
        price = product.get("suggested_price", 0)
        
        if cost > 0 and price > 0:
            profit = price - cost
            margin = (profit / price) * 100
            product["profit_margin"] = margin / 100
            
            print(f"📦 {product['name']}:")
            print(f"   Cost: ${cost:.2f} | Price: ${price:.2f} | Profit: ${profit:.2f} | Margin: {margin:.1f}%")
            
            total_profit += profit
            total_revenue += price
    
    if total_revenue > 0:
        overall_margin = (total_profit / total_revenue) * 100
        print(f"\n📊 OVERALL: Revenue: ${total_revenue:.2f} | Profit: ${total_profit:.2f} | Margin: {overall_margin:.1f}%")

def main():
    """Main function to update products"""
    print("🎯 ScreenMerch Product Update Tool")
    print("=" * 50)
    
    # Load template
    template = load_template()
    if not template:
        return
    
    updated_products = template["products"]
    
    print(f"📋 Loaded {len(updated_products)} products from template")
    print()
    
    # Show current status
    available_count = sum(1 for p in updated_products if p.get("available", True))
    print(f"✅ Available products: {available_count}")
    print(f"❌ Unavailable products: {len(updated_products) - available_count}")
    print()
    
    # Calculate profit margins
    calculate_profit_margins(updated_products)
    print()
    
    # Ask for confirmation
    response = input("Do you want to update the product catalogs? (y/n): ").strip().lower()
    if response != 'y':
        print("❌ Update cancelled")
        return
    
    # Update backend
    update_backend_products(updated_products)
    print()
    
    # Update frontend
    update_frontend_products(updated_products)
    print()
    
    print("🎉 Product catalog update complete!")
    print("📝 Next steps:")
    print("   1. Review the updated files")
    print("   2. Test the product pages")
    print("   3. Deploy the changes")
    print("   4. Verify Printful integration")

if __name__ == "__main__":
    main() 