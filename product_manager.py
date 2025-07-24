#!/usr/bin/env python3
"""
ScreenMerch Product Manager
Web-based interface for managing products, prices, and availability
Enhanced with size-based pricing support and Printful color integration
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for
import json
import os
import requests
from datetime import datetime

app = Flask(__name__)

# Printful API configuration
PRINTFUL_API_KEY = "C6c4vKYLebPS1Zsu66o8fp2DE9Mye2FYmE5ATiNf"  # Direct API key
PRINTFUL_BASE_URL = "https://api.printful.com"

# Printful product variant mappings (common products)
PRINTFUL_VARIANTS = {
    "Unisex Staple T-Shirt | Bella + Canvas 3001": 4012,
    "Unisex Classic Tee": 4012,
    "Unisex Classic Tee | Gildan 5000": 4012,  # Updated mapping
    "Men's Tank Top": 4013,
    "Unisex Hoodie": 4014,
    "Cropped Hoodie": 4015,
    "Unisex Champion Hoodie": 4016,
    "Women's Ribbed Neck": 4017,
    "Women's Shirt": 4018,
    "Women's HD Shirt": 4019,
    "Kids Shirt": 4020,
    "Kids Hoodie": 4021,
    "Kids Long Sleeve": 4022,
    "Men's Long Sleeve": 4023,
    "Canvas Tote": 4024,
    "Tote Bag": 4025,
    "Large Canvas Bag": 4026,
    "Greeting Card": 4027,
    "Notebook": 4028,
    "Coasters": 4029,
    "Sticker Pack": 4030,
    "Dog Bowl": 4031,
    "Magnet Set": 4032
}



def get_printful_colors(variant_id):
    """Fetch available colors for a specific Printful variant"""
    if not PRINTFUL_API_KEY:
        return []
    
    try:
        headers = {
            "Authorization": f"Bearer {PRINTFUL_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # First, get the product ID from the variant
        variant_response = requests.get(
            f"{PRINTFUL_BASE_URL}/products/variant/{variant_id}",
            headers=headers
        )
        
        if variant_response.status_code != 200:
            print(f"Error fetching variant {variant_id}: {variant_response.status_code}")
            return []
        
        variant_data = variant_response.json()
        product_id = variant_data.get('result', {}).get('variant', {}).get('product_id')
        
        if not product_id:
            print(f"No product_id found for variant {variant_id}")
            return []
        
        # Now get all variants for this product to extract available colors
        product_response = requests.get(
            f"{PRINTFUL_BASE_URL}/products/{product_id}",
            headers=headers
        )
        
        print(f"Product API Response Status: {product_response.status_code}")
        
        if product_response.status_code == 200:
            product_data = product_response.json()
            result = product_data.get('result', {})
            
            # Extract all available colors from variants
            available_colors = set()
            variants = result.get('variants', [])
            
            for variant in variants:
                if variant.get('in_stock', False):
                    color = variant.get('color')
                    if color:
                        available_colors.add(color)
            
            colors = sorted(list(available_colors))
            print(f"Found {len(colors)} available colors: {colors}")
            return colors
        else:
            print(f"Error fetching product {product_id}: {product_response.status_code}")
            print(f"Error response: {product_response.text[:500]}...")
            return []
            
    except Exception as e:
        print(f"Error connecting to Printful API: {e}")
        return []

def get_all_printful_colors():
    """Get all available colors from Printful for all product variants"""
    all_colors = set()
    
    for product_name, variant_id in PRINTFUL_VARIANTS.items():
        colors = get_printful_colors(variant_id)
        all_colors.update(colors)
    
    return sorted(list(all_colors))

# Load current products from backend
def load_current_products():
    """Load products from backend app.py with size-based pricing support"""
    try:
        with open("backend/app.py", "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        
        print("Loading products from backend/app.py...")
        
        # Find PRODUCTS list
        start_marker = "PRODUCTS = ["
        start_idx = content.find(start_marker)
        if start_idx == -1:
            print("PRODUCTS list not found in backend/app.py")
            return []
        
        print(f"Found PRODUCTS list at position {start_idx}")
        
        # Extract the PRODUCTS list - find the closing bracket
        start_pos = start_idx + len("PRODUCTS = [")
        brace_count = 1
        end_idx = start_pos
        
        for i, char in enumerate(content[start_pos:], start_pos):
            if char == "[":
                brace_count += 1
            elif char == "]":
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i + 1
                    break
        
        products_str = "[" + content[start_pos:end_idx]
        print(f"Extracted products string length: {len(products_str)}")
        print(f"First 200 chars: {products_str[:200]}...")
        
        # Use a simpler approach - try to evaluate the PRODUCTS list directly
        try:
            # Create a safe environment for eval
            safe_dict = {}
            exec(f"PRODUCTS = {products_str}", safe_dict)
            products_data = safe_dict['PRODUCTS']
            
            print(f"Successfully parsed {len(products_data)} products")
            
            # Convert to our format
            products = []
            for product in products_data:
                current_product = {
                    'name': product.get('name', ''),
                    'price': product.get('price', 0),
                    'filename': product.get('filename', ''),
                    'main_image': product.get('main_image', ''),
                    'has_color': False,
                    'has_size': False,
                    'available_colors': [],
                    'size_pricing': product.get('size_pricing', {}),
                    'available': True
                }
                
                # Parse options
                options = product.get('options', {})
                if 'color' in options and options['color']:
                    current_product['has_color'] = True
                    current_product['available_colors'] = options['color']
                if 'size' in options and options['size']:
                    current_product['has_size'] = True
                
                # Get Printful colors if available
                variant_id = PRINTFUL_VARIANTS.get(current_product['name'])
                if variant_id:
                    current_product['printful_colors'] = get_printful_colors(variant_id)
                    current_product['variant_id'] = variant_id
                
                products.append(current_product)
            
            print(f"Processed {len(products)} products successfully")
            return products
            
        except Exception as e:
            print(f"Error parsing products with eval: {e}")
            return []
            
    except Exception as e:
        print(f"Error loading products: {e}")
        return []

def save_products_to_backend(products):
    """Save updated products back to backend files with size-based pricing"""
    backend_files = ["backend/app.py", "app.py", "frontend_app.py"]
    
    for file_path in backend_files:
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                # Find PRODUCTS list
                start_marker = "PRODUCTS = ["
                start_idx = content.find(start_marker)
                if start_idx == -1:
                    continue
                
                # Find end of PRODUCTS list
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
                
                # Generate new PRODUCTS list with size pricing
                new_products_list = "PRODUCTS = [\n"
                for product in products:
                    if not product.get("available", True):
                        continue
                    
                    new_products_list += f"    {{\n"
                    new_products_list += f'        "name": "{product["name"]}",\n'
                    
                    # Use base price (smallest size price)
                    base_price = product.get("price", 24.99)
                    new_products_list += f'        "price": {base_price},\n'
                    
                    # Preserve existing image filenames or use defaults
                    default_filename = product['name'].lower().replace(' ', '').replace("'", '') + "preview.png"
                    default_main_image = product['name'].lower().replace(' ', '').replace("'", '') + ".png"
                    filename = product.get("filename", default_filename)
                    main_image = product.get("main_image", default_main_image)
                    
                    new_products_list += f'        "filename": "{filename}",\n'
                    new_products_list += f'        "main_image": "{main_image}",\n'
                    
                    # Handle options with Printful colors
                    if product.get("has_color") and product.get("has_size"):
                        colors = product.get("available_colors", product.get("printful_colors", ["Black", "White", "Gray"]))
                        sizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]
                        new_products_list += f'        "options": {{"color": {colors}, "size": {sizes}}}\n'
                    elif product.get("has_color"):
                        colors = product.get("available_colors", product.get("printful_colors", ["Black", "White", "Gray"]))
                        new_products_list += f'        "options": {{"color": {colors}, "size": []}}\n'
                    elif product.get("has_size"):
                        sizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]
                        new_products_list += f'        "options": {{"color": [], "size": {sizes}}}\n'
                    else:
                        new_products_list += f'        "options": {{"color": [], "size": []}}\n'
                    
                    # Add size pricing if product has sizes
                    if product.get("has_size") and product.get("size_pricing"):
                        new_products_list += f'        ,\n'
                        new_products_list += f'        "size_pricing": {{\n'
                        size_pricing = product.get("size_pricing", {})
                        for size, price in size_pricing.items():
                            new_products_list += f'            "{size}": {price}'
                            if size != list(size_pricing.keys())[-1]:
                                new_products_list += ','
                            new_products_list += '\n'
                        new_products_list += f'        }}\n'
                    
                    new_products_list += f"    }},\n"
                
                new_products_list += "]"
                
                # Replace old PRODUCTS list
                new_content = content[:start_idx] + new_products_list + content[end_idx:]
                
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                    
            except Exception as e:
                print(f"Error updating {file_path}: {e}")

@app.route('/')
def index():
    """Main product management page"""
    products = load_current_products()
    return render_template('product_manager.html', products=products)

@app.route('/api/products', methods=['GET'])
def get_products():
    """API endpoint to get all products"""
    products = load_current_products()
    return jsonify(products)

@app.route('/api/printful-colors', methods=['GET'])
def get_printful_colors_api():
    """API endpoint to get Printful colors for a specific product"""
    product_name = request.args.get('product_name')
    
    # Default colors as fallback
    default_colors = [
        'Black', 'White', 'Gray', 'Navy', 'Red', 'Green', 'Blue', 
        'Pink', 'Purple', 'Yellow', 'Orange', 'Brown', 'Cream',
        'Maroon', 'Olive', 'Teal', 'Silver', 'Gold', 'Burgundy',
        'Royal Blue', 'Forest Green', 'Charcoal', 'Light Blue'
    ]
    

    
    if product_name and product_name in PRINTFUL_VARIANTS:
        variant_id = PRINTFUL_VARIANTS[product_name]
        colors = get_printful_colors(variant_id)
        
        # If Printful API fails, return default colors
        if not colors:
            print(f"Using default colors for {product_name}")
            colors = default_colors
        
        return jsonify({'colors': colors, 'variant_id': variant_id, 'source': 'printful' if colors != default_colors else 'default'})
    else:
        # Return default colors for unknown products
        return jsonify({'colors': default_colors, 'error': 'Product not found in Printful', 'source': 'default'})

@app.route('/api/all-printful-colors', methods=['GET'])
def get_all_printful_colors_api():
    """API endpoint to get all available Printful colors"""
    colors = get_all_printful_colors()
    return jsonify({'colors': colors})

@app.route('/api/products', methods=['POST'])
def update_products():
    """API endpoint to update products"""
    try:
        data = request.get_json()
        products = data.get('products', [])
        
        # Save to backend
        save_products_to_backend(products)
        
        # Also save to JSON file for backup
        with open('product_backup.json', 'w') as f:
            json.dump({
                'products': products,
                'updated_at': datetime.now().isoformat()
            }, f, indent=2)
        
        return jsonify({'success': True, 'message': 'Products updated successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/export', methods=['GET'])
def export_products():
    """Export products to JSON file"""
    try:
        products = load_current_products()
        filename = f"products_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(filename, 'w') as f:
            json.dump({
                'products': products,
                'exported_at': datetime.now().isoformat()
            }, f, indent=2)
        
        return jsonify({'success': True, 'filename': filename})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting ScreenMerch Product Manager...")
    print("📱 Open your browser and go to: http://localhost:5000")
    print("🛑 Press Ctrl+C to stop the server")
    app.run(debug=True, host='0.0.0.0', port=5000) 