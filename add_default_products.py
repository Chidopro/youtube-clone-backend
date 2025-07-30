#!/usr/bin/env python3
"""
Add default products to the ScreenMerch product manager
"""

import json
import os
from datetime import datetime

def add_default_products():
    """Add default products to products.json"""
    
    default_products = [
        {
            "id": 1,
            "name": "ScreenMerch Classic T-Shirt",
            "description": "Premium cotton t-shirt with custom ScreenMerch design",
            "price": 24.99,
            "category": "Apparel",
            "product_type_id": 1,
            "colors": ["Black", "White", "Navy"],
            "sizes": ["S", "M", "L", "XL"],
            "image_url": "https://example.com/tshirt.jpg",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "id": 2,
            "name": "ScreenMerch Hoodie",
            "description": "Comfortable hoodie perfect for creators",
            "price": 39.99,
            "category": "Apparel",
            "product_type_id": 2,
            "colors": ["Black", "Gray", "Navy"],
            "sizes": ["S", "M", "L", "XL", "XXL"],
            "image_url": "https://example.com/hoodie.jpg",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "id": 3,
            "name": "ScreenMerch Coffee Mug",
            "description": "Ceramic coffee mug with your favorite content",
            "price": 14.99,
            "category": "Home & Office",
            "product_type_id": 3,
            "colors": ["White"],
            "sizes": ["Standard"],
            "image_url": "https://example.com/mug.jpg",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "id": 4,
            "name": "ScreenMerch Phone Case",
            "description": "Durable phone case with custom design",
            "price": 19.99,
            "category": "Accessories",
            "product_type_id": 4,
            "colors": ["Black", "White", "Clear"],
            "sizes": ["iPhone 13", "iPhone 14", "Samsung Galaxy"],
            "image_url": "https://example.com/phonecase.jpg",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "id": 5,
            "name": "ScreenMerch Sticker Pack",
            "description": "High-quality vinyl stickers for laptops and water bottles",
            "price": 9.99,
            "category": "Accessories",
            "product_type_id": 5,
            "colors": ["Multi-color"],
            "sizes": ["Standard"],
            "image_url": "https://example.com/stickers.jpg",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    # Check if products.json already exists
    if os.path.exists("products.json"):
        print("⚠️ products.json already exists. Creating backup...")
        backup_file = f"products_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open("products.json", 'r') as f:
            existing_data = f.read()
        with open(backup_file, 'w') as f:
            f.write(existing_data)
        print(f"📦 Backup created: {backup_file}")
    
    # Save default products
    with open("products.json", 'w') as f:
        json.dump(default_products, f, indent=2)
    
    print(f"✅ Added {len(default_products)} default products to products.json")
    print("\n📋 Default Products Added:")
    for product in default_products:
        print(f"  • {product['name']} - ${product['price']}")
    
    print("\n🎯 You can now run the product manager to edit these products!")

if __name__ == "__main__":
    add_default_products() 