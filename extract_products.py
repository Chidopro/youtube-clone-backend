#!/usr/bin/env python3
"""
Extract Products from product_page.html
Converts template products to Product Manager format
"""

import json
import re
from datetime import datetime

def extract_products_from_html():
    """Extract products from the HTML template"""
    
    # Products from the actual PRODUCTS array in backend/app.py
    products = [
        {
            "name": "Soft Tee",
            "base_price": 24.99,
            "category": "T-Shirts",
            "description": "Comfortable soft t-shirt with custom design",
            "main_image": "guidontee.png",
            "filename": "guidonteepreview.png",
            "options": {"color": ["Black", "White", "Gray"], "size": ["S", "M", "L", "XL"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Gray"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 1, "XXL": 2, "XXXL": 3},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Unisex Classic Tee",
            "base_price": 24.99,
            "category": "T-Shirts",
            "description": "Classic unisex t-shirt",
            "main_image": "unisexclassictee.png",
            "filename": "unisexclassicteepreview.png",
            "options": {"color": ["Black", "White", "Gray", "Navy"], "size": ["S", "M", "L", "XL"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Gray", "Navy"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 1, "XXL": 2, "XXXL": 3},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Men's Tank Top",
            "base_price": 19.99,
            "category": "Tank Tops",
            "description": "Comfortable men's tank top",
            "main_image": "random.png",
            "filename": "randompreview.png",
            "options": {"color": ["Black", "White", "Gray"], "size": ["S", "M", "L", "XL"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Gray"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 1, "XXL": 2, "XXXL": 3},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Unisex Hoodie",
            "base_price": 22.99,
            "category": "Hoodies",
            "description": "Comfortable unisex hoodie",
            "main_image": "tested.png",
            "filename": "testedpreview.png",
            "options": {"color": ["Black", "White"], "size": ["S", "M", "L"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 2, "XXL": 3, "XXXL": 4},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Cropped Hoodie",
            "base_price": 39.99,
            "category": "Hoodies",
            "description": "Stylish cropped hoodie",
            "main_image": "croppedhoodie.png",
            "filename": "croppedhoodiepreview.png",
            "options": {"color": ["Black", "Gray", "Navy"], "size": ["S", "M", "L", "XL"]},
            "printful_product_type_id": None,
            "colors": ["Black", "Gray", "Navy"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 3, "XXL": 4, "XXXL": 5},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Unisex Champion Hoodie",
            "base_price": 29.99,
            "category": "Hoodies",
            "description": "Premium Champion brand hoodie",
            "main_image": "hoodiechampion.png",
            "filename": "hoodiechampionpreview.jpg",
            "options": {"color": ["Black", "Gray"], "size": ["13 inch", "15 inch"]},
            "printful_product_type_id": None,
            "colors": ["Black", "Gray"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 3, "XXL": 4, "XXXL": 5},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Women's Ribbed Neck",
            "base_price": 25.99,
            "category": "Women's Shirts",
            "description": "Women's shirt with ribbed neck design",
            "main_image": "womensribbedneck.png",
            "filename": "womensribbedneckpreview.jpg",
            "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["S", "M", "L", "XL"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Gray", "Pink"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 1, "XXL": 2, "XXXL": 3},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Women's Shirt",
            "base_price": 26.99,
            "category": "Women's Shirts",
            "description": "Comfortable women's shirt",
            "main_image": "womensshirt.png",
            "filename": "womensshirtkevin.png",
            "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["S", "M", "L", "XL"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Gray", "Pink"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 1, "XXL": 2, "XXXL": 3},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Women's HD Shirt",
            "base_price": 28.99,
            "category": "Women's Shirts",
            "description": "High-definition print women's shirt",
            "main_image": "womenshdshirt.png",
            "filename": "womenshdshirtpreview.png",
            "options": {"color": ["Black", "White", "Gray", "Navy"], "size": ["S", "M", "L", "XL"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Gray", "Navy"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 2, "XXL": 3, "XXXL": 4},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Kids Shirt",
            "base_price": 19.99,
            "category": "Kids",
            "description": "Comfortable kids t-shirt",
            "main_image": "kidshirt.png",
            "filename": "kidshirtpreview.jpg",
            "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["XS", "S", "M", "L"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Gray", "Pink"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 1, "XXL": 2, "XXXL": 3},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Kids Hoodie",
            "base_price": 29.99,
            "category": "Kids",
            "description": "Warm kids hoodie",
            "main_image": "kidhoodie.png",
            "filename": "kidhoodiepreview.jpg",
            "options": {"color": ["Black", "White", "Gray", "Navy"], "size": ["XS", "S", "M", "L"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Gray", "Navy"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 2, "XXL": 3, "XXXL": 4},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Kids Long Sleeve",
            "base_price": 24.99,
            "category": "Kids",
            "description": "Comfortable kids long sleeve shirt",
            "main_image": "kidlongsleeve.png",
            "filename": "kidlongsleevepreview.jpg",
            "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["XS", "S", "M", "L"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Gray", "Pink"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 1, "XXL": 2, "XXXL": 3},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Canvas Tote",
            "base_price": 18.99,
            "category": "Bags",
            "description": "Eco-friendly canvas tote bag",
            "main_image": "allovertotebag.png",
            "filename": "allovertotebagpreview.png",
            "options": {"color": ["Natural", "Black"], "size": []},
            "printful_product_type_id": None,
            "colors": ["Natural", "Black"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Tote Bag",
            "base_price": 21.99,
            "category": "Bags",
            "description": "Versatile tote bag",
            "main_image": "drawstringbag.png",
            "filename": "drawstringbagpreview.png",
            "options": {"color": ["White", "Black", "Blue"], "size": []},
            "printful_product_type_id": None,
            "colors": ["White", "Black", "Blue"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Large Canvas Bag",
            "base_price": 24.99,
            "category": "Bags",
            "description": "Large canvas bag for all your needs",
            "main_image": "largecanvasbag.png",
            "filename": "largecanvasbagpreview.png",
            "options": {"color": ["Natural", "Black", "Navy"], "size": []},
            "printful_product_type_id": None,
            "colors": ["Natural", "Black", "Navy"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Greeting Card",
            "base_price": 22.99,
            "category": "Stationery",
            "description": "Beautiful greeting card",
            "main_image": "greetingcard.png",
            "filename": "greetingcardpreview.png",
            "options": {"color": ["White", "Cream"], "size": []},
            "printful_product_type_id": None,
            "colors": ["White", "Cream"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Notebook",
            "base_price": 14.99,
            "category": "Stationery",
            "description": "Hardcover notebook",
            "main_image": "hardcovernotebook.png",
            "filename": "hardcovernotebookpreview.png",
            "options": {"color": ["Black", "Blue"], "size": []},
            "printful_product_type_id": None,
            "colors": ["Black", "Blue"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Coasters",
            "base_price": 13.99,
            "category": "Home & Living",
            "description": "Set of custom coasters",
            "main_image": "coaster.png",
            "filename": "coasterpreview.jpg",
            "options": {"color": ["Wood", "Cork", "Black"], "size": []},
            "printful_product_type_id": None,
            "colors": ["Wood", "Cork", "Black"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Sticker Pack",
            "base_price": 8.99,
            "category": "Accessories",
            "description": "Set of custom stickers",
            "main_image": "stickers.png",
            "filename": "stickerspreview.png",
            "options": {"color": [], "size": []},
            "printful_product_type_id": None,
            "colors": [],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Dog Bowl",
            "base_price": 12.99,
            "category": "Pet Supplies",
            "description": "Custom dog bowl",
            "main_image": "dogbowl.png",
            "filename": "dogbowlpreview.png",
            "options": {"color": [], "size": []},
            "printful_product_type_id": None,
            "colors": [],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Magnet Set",
            "base_price": 11.99,
            "category": "Accessories",
            "description": "Set of custom magnets",
            "main_image": "magnet.png",
            "filename": "magnetpreview.png",
            "options": {"color": [], "size": []},
            "printful_product_type_id": None,
            "colors": [],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Men's Long Sleeve",
            "base_price": 29.99,
            "category": "Men's Shirts",
            "description": "Comfortable men's long sleeve shirt",
            "main_image": "menslongsleeve.png",
            "filename": "menslongsleevepreview.jpg",
            "options": {"color": ["Black", "White", "Gray"], "size": ["S", "M", "L", "XL"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Gray"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 2, "XXL": 3, "XXXL": 4},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Women's Tank",
            "base_price": 22.99,
            "category": "Women's Shirts",
            "description": "Comfortable women's tank top",
            "main_image": "womenstank.png",
            "filename": "womenstankpreview.jpg",
            "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["S", "M", "L", "XL"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Gray", "Pink"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 1, "XXL": 2, "XXXL": 3},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Women's Tee",
            "base_price": 23.99,
            "category": "Women's Shirts",
            "description": "Comfortable women's t-shirt",
            "main_image": "womenstee.png",
            "filename": "womensteepreview.jpg",
            "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["S", "M", "L", "XL"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Gray", "Pink"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 1, "XXL": 2, "XXXL": 3},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Distressed Dad Hat",
            "base_price": 24.99,
            "category": "Hats",
            "description": "Stylish distressed dad hat",
            "main_image": "distresseddadhat.jpg",
            "filename": "distresseddadhatpreview.jpg",
            "options": {"color": ["Black", "Navy", "Gray"], "size": ["One Size"]},
            "printful_product_type_id": None,
            "colors": ["Black", "Navy", "Gray"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Snapback Hat",
            "base_price": 25.99,
            "category": "Hats",
            "description": "Classic snapback hat",
            "main_image": "snapbackhat.png",
            "filename": "snapbackhatpreview.png",
            "options": {"color": ["Black", "White", "Navy", "Gray"], "size": ["One Size"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Navy", "Gray"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Five Panel Trucker Hat",
            "base_price": 26.99,
            "category": "Hats",
            "description": "Five panel trucker hat",
            "main_image": "fivepaneltruckerhat.png",
            "filename": "fivepaneltruckerhatpreview.jpg",
            "options": {"color": ["Black", "White", "Navy"], "size": ["One Size"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Navy"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Flat Bill Cap",
            "base_price": 24.99,
            "category": "Hats",
            "description": "Flat bill cap",
            "main_image": "flatbillcap.png",
            "filename": "flatbillcappreview.png",
            "options": {"color": ["Black", "White", "Navy", "Gray"], "size": ["One Size"]},
            "printful_product_type_id": None,
            "colors": ["Black", "White", "Navy", "Gray"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Crossbody Bag",
            "base_price": 32.99,
            "category": "Bags",
            "description": "Stylish crossbody bag",
            "main_image": "crossbodybag.png",
            "filename": "crossbodybagpreview.png",
            "options": {"color": ["Black", "Brown", "Tan"], "size": []},
            "printful_product_type_id": None,
            "colors": ["Black", "Brown", "Tan"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        },
        {
            "name": "Baby Bib",
            "base_price": 16.99,
            "category": "Baby",
            "description": "Custom baby bib",
            "main_image": "babybib.png",
            "filename": "babybibpreview.jpg",
            "options": {"color": ["White", "Pink", "Blue"], "size": []},
            "printful_product_type_id": None,
            "colors": ["White", "Pink", "Blue"],
            "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0},
            "created_at": datetime.now().isoformat()
        }
    ]
    
    return products

def save_products_for_import():
    """Save products in a format that can be imported into Product Manager"""
    products = extract_products_from_html()
    
    # Save as JSON file that Product Manager can import
    filename = f"products_from_html_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    with open(filename, 'w') as f:
        json.dump(products, f, indent=2)
    
    print(f"✅ Extracted {len(products)} products to {filename}")
    print("\n📋 Products extracted:")
    for i, product in enumerate(products, 1):
        print(f"{i:2d}. {product['name']} - ${product['base_price']:.2f}")
        print(f"     Category: {product['category']}")
        print(f"     Colors: {', '.join(product['colors']) if product['colors'] else 'No colors'}")
        print(f"     Sizes: {', '.join(product['options']['size']) if product['options']['size'] else 'No sizes'}")
        print()
    
    print("🚀 To import into Product Manager:")
    print(f"1. Open Product Manager")
    print(f"2. Choose option 6 (Import Products)")
    print(f"3. Enter filename: {filename}")
    print(f"4. Confirm import")
    
    return filename

def create_enhanced_products():
    """Create enhanced products with Printful integration"""
    print("🛍️ Creating enhanced products with Printful integration...")
    
    # First, let's get available Printful product types
    import requests
    
    printful_api_key = "C6c4vKYLebPS1Zsu66o8fp2DE9Mye2FYmE5ATiNf"
    printful_base_url = "https://api.printful.com"
    
    try:
        headers = {
            'Authorization': f'Bearer {printful_api_key}',
            'Content-Type': 'application/json'
        }
        
        url = f"{printful_base_url}/products"
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if 'result' in data:
                product_types = data['result']
                print(f"✅ Found {len(product_types)} Printful product types")
                
                # Show first 10 product types
                print("\n📋 Available Printful Product Types:")
                for i, pt in enumerate(product_types[:10], 1):
                    print(f"{i:2d}. {pt.get('title', 'N/A')} (ID: {pt.get('id', 'N/A')})")
                
                return product_types
        else:
            print(f"❌ Printful API error: {response.status_code}")
            return []
    except Exception as e:
        print(f"❌ Error fetching Printful products: {e}")
        return []

if __name__ == "__main__":
    print("🔄 Extracting products from product_page.html...")
    
    # Create basic products file
    filename = save_products_for_import()
    
    # Try to get Printful product types
    print("\n" + "="*50)
    print("🛍️ Printful Integration")
    print("="*50)
    
    product_types = create_enhanced_products()
    
    if product_types:
        print(f"\n💡 Tip: You can now use these Printful product types in your Product Manager")
        print("   When adding products, you'll be able to select from these types")
        print("   and get real color options from Printful!")
    
    print(f"\n✅ Ready! Import file created: {filename}")
    print("   Open your Product Manager and import this file to get started.") 