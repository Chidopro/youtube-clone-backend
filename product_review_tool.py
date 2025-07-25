#!/usr/bin/env python3
"""
ScreenMerch Product Review Tool
Helps review and update product prices, availability, and profit margins
"""

import json
import os
from typing import Dict, List, Any

# Current product catalog from your backend
CURRENT_PRODUCTS = [
    # Clothing Items
    {"name": "Soft Tee", "price": 24.99, "category": "clothing", "options": {"color": ["Black", "White", "Gray"], "size": ["S", "M", "L", "XL"]}},
    {"name": "Unisex Classic Tee", "price": 24.99, "category": "clothing", "options": {"color": ["Black", "White", "Gray", "Navy"], "size": ["S", "M", "L", "XL"]}},
    {"name": "Men's Tank Top", "price": 19.99, "category": "clothing", "options": {"color": ["Black", "White", "Gray"], "size": ["S", "M", "L", "XL"]}},
    {"name": "Unisex Hoodie", "price": 22.99, "category": "clothing", "options": {"color": ["Black", "White"], "size": ["S", "M", "L"]}},
    {"name": "Cropped Hoodie", "price": 39.99, "category": "clothing", "options": {"color": ["Black", "Gray", "Navy"], "size": ["S", "M", "L", "XL"]}},
    {"name": "Unisex Champion Hoodie", "price": 29.99, "category": "clothing", "options": {"color": ["Black", "Gray"], "size": ["13 inch", "15 inch"]}},
    {"name": "Women's Ribbed Neck", "price": 25.99, "category": "clothing", "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["S", "M", "L", "XL"]}},
    {"name": "Women's Shirt", "price": 26.99, "category": "clothing", "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["S", "M", "L", "XL"]}},
    {"name": "Women's HD Shirt", "price": 28.99, "category": "clothing", "options": {"color": ["Black", "White", "Gray", "Navy"], "size": ["S", "M", "L", "XL"]}},
    {"name": "Kids Shirt", "price": 19.99, "category": "clothing", "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["XS", "S", "M", "L"]}},
    {"name": "Kids Hoodie", "price": 29.99, "category": "clothing", "options": {"color": ["Black", "White", "Gray", "Navy"], "size": ["XS", "S", "M", "L"]}},
    {"name": "Kids Long Sleeve", "price": 24.99, "category": "clothing", "options": {"color": ["Black", "White", "Gray", "Pink"], "size": ["XS", "S", "M", "L"]}},
    {"name": "Men's Long Sleeve", "price": 29.99, "category": "clothing", "options": {"color": ["Black", "White", "Gray"], "size": ["S", "M", "L", "XL"]}},
    
    # Accessories
    {"name": "Canvas Tote", "price": 18.99, "category": "accessories", "options": {"color": ["Natural", "Black"], "size": []}},
    {"name": "Tote Bag", "price": 21.99, "category": "accessories", "options": {"color": ["White", "Black", "Blue"], "size": []}},
    {"name": "Large Canvas Bag", "price": 24.99, "category": "accessories", "options": {"color": ["Natural", "Black", "Navy"], "size": []}},
    
    # Home & Other
    {"name": "Greeting Card", "price": 22.99, "category": "home", "options": {"color": ["White", "Cream"], "size": []}},
    {"name": "Notebook", "price": 14.99, "category": "home", "options": {"color": ["Black", "Blue"], "size": []}},
    {"name": "Coasters", "price": 13.99, "category": "home", "options": {"color": ["Wood", "Cork", "Black"], "size": []}},
    {"name": "Sticker Pack", "price": 8.99, "category": "other", "options": {"color": [], "size": []}},
    {"name": "Dog Bowl", "price": 12.99, "category": "other", "options": {"color": [], "size": []}},
    {"name": "Magnet Set", "price": 11.99, "category": "other", "options": {"color": [], "size": []}}
]

def display_product_summary():
    """Display current product catalog summary"""
    print("🛍️  SCREENMERCH PRODUCT CATALOG REVIEW")
    print("=" * 50)
    
    categories = {}
    total_products = 0
    
    for product in CURRENT_PRODUCTS:
        category = product["category"]
        if category not in categories:
            categories[category] = []
        categories[category].append(product)
        total_products += 1
    
    print(f"📊 Total Products: {total_products}")
    print(f"📂 Categories: {len(categories)}")
    print()
    
    for category, products in categories.items():
        print(f"📁 {category.upper()} ({len(products)} items):")
        for product in products:
            price_str = f"${product['price']:.2f}"
            options_str = ""
            if product['options']['color']:
                options_str += f"Colors: {', '.join(product['options']['color'])}"
            if product['options']['size']:
                if options_str:
                    options_str += " | "
                options_str += f"Sizes: {', '.join(product['options']['size'])}"
            
            print(f"  • {product['name']:<25} {price_str:<8} | {options_str}")
        print()

def calculate_profit_margins():
    """Calculate suggested profit margins based on product categories"""
    print("💰 PROFIT MARGIN ANALYSIS")
    print("=" * 50)
    
    # Suggested profit margins by category (you can adjust these)
    margin_suggestions = {
        "clothing": {"min": 0.30, "target": 0.40, "max": 0.50},  # 30-50% margin
        "accessories": {"min": 0.35, "target": 0.45, "max": 0.55},  # 35-55% margin
        "home": {"min": 0.40, "target": 0.50, "max": 0.60},  # 40-60% margin
        "other": {"min": 0.45, "target": 0.55, "max": 0.65}  # 45-65% margin
    }
    
    for category, margins in margin_suggestions.items():
        print(f"📁 {category.upper()}:")
        print(f"   Suggested margins: {margins['min']*100:.0f}% - {margins['target']*100:.0f}% - {margins['max']*100:.0f}%")
        print(f"   Example: $20 cost → ${20/(1-margins['target']):.2f} retail price")
        print()

def generate_product_update_template():
    """Generate a template for updating product prices and availability"""
    print("📝 PRODUCT UPDATE TEMPLATE")
    print("=" * 50)
    print("Use this template to update your product catalog:")
    print()
    
    template = {
        "products": [],
        "profit_margin_target": 0.45,  # 45% target margin
        "shipping_cost": 0.00,  # Free shipping
        "tax_rate": 0.00  # No tax included in price
    }
    
    for product in CURRENT_PRODUCTS:
        product_template = {
            "name": product["name"],
            "current_price": product["price"],
            "suggested_price": product["price"],  # You can adjust this
            "cost_estimate": 0.00,  # Add your cost estimate
            "profit_margin": 0.00,  # Will be calculated
            "available": True,
            "category": product["category"],
            "options": product["options"],
            "notes": ""
        }
        template["products"].append(product_template)
    
    # Save template to file
    with open("product_update_template.json", "w") as f:
        json.dump(template, f, indent=2)
    
    print("✅ Template saved to 'product_update_template.json'")
    print("📋 Edit this file to update your product catalog")
    print()

def check_printful_availability():
    """Check Printful product availability"""
    print("🔍 PRINTFUL AVAILABILITY CHECK")
    print("=" * 50)
    print("⚠️  IMPORTANT: You need to verify these products are available in Printful")
    print()
    
    print("📋 Products to verify in Printful dashboard:")
    for product in CURRENT_PRODUCTS:
        print(f"  • {product['name']}")
        if product['options']['color']:
            print(f"    Colors: {', '.join(product['options']['color'])}")
        if product['options']['size']:
            print(f"    Sizes: {', '.join(product['options']['size'])}")
        print()
    
    print("🔗 Check availability at: https://www.printful.com/dashboard/products")
    print()

def generate_launch_checklist():
    """Generate a launch checklist"""
    print("🚀 LAUNCH CHECKLIST")
    print("=" * 50)
    
    checklist = [
        "✅ Product prices updated and competitive",
        "✅ All products available in Printful",
        "✅ Profit margins calculated (target 40-50%)",
        "✅ Shipping costs configured",
        "✅ Tax settings configured",
        "✅ Product images uploaded",
        "✅ Product descriptions updated",
        "✅ Inventory tracking set up",
        "✅ Order fulfillment process tested",
        "✅ Email notifications working",
        "✅ Payment processing tested",
        "✅ Customer support ready"
    ]
    
    for item in checklist:
        print(f"  {item}")
    
    print()
    print("📊 Next Steps:")
    print("  1. Review current prices vs. market")
    print("  2. Calculate your costs from Printful")
    print("  3. Set target profit margins")
    print("  4. Update product availability")
    print("  5. Test order flow end-to-end")

def main():
    """Main function to run the product review tool"""
    print("🎯 ScreenMerch Product Review Tool")
    print("=" * 50)
    print()
    
    while True:
        print("Choose an option:")
        print("1. 📊 View current product catalog")
        print("2. 💰 Profit margin analysis")
        print("3. 📝 Generate update template")
        print("4. 🔍 Check Printful availability")
        print("5. 🚀 Launch checklist")
        print("6. 📋 Export all data")
        print("0. Exit")
        print()
        
        choice = input("Enter your choice (0-6): ").strip()
        print()
        
        if choice == "1":
            display_product_summary()
        elif choice == "2":
            calculate_profit_margins()
        elif choice == "3":
            generate_product_update_template()
        elif choice == "4":
            check_printful_availability()
        elif choice == "5":
            generate_launch_checklist()
        elif choice == "6":
            # Export all data
            export_data = {
                "current_products": CURRENT_PRODUCTS,
                "summary": {
                    "total_products": len(CURRENT_PRODUCTS),
                    "categories": list(set(p["category"] for p in CURRENT_PRODUCTS)),
                    "price_range": {
                        "min": min(p["price"] for p in CURRENT_PRODUCTS),
                        "max": max(p["price"] for p in CURRENT_PRODUCTS),
                        "average": sum(p["price"] for p in CURRENT_PRODUCTS) / len(CURRENT_PRODUCTS)
                    }
                }
            }
            with open("product_catalog_export.json", "w") as f:
                json.dump(export_data, f, indent=2)
            print("✅ Product catalog exported to 'product_catalog_export.json'")
        elif choice == "0":
            print("👋 Goodbye! Good luck with your launch!")
            break
        else:
            print("❌ Invalid choice. Please try again.")
        
        print()
        input("Press Enter to continue...")
        print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    main() 