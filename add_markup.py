#!/usr/bin/env python3
"""
Add $10 markup to all product prices in products.js
"""

import json
import re
import time

def add_markup_to_products():
    file_path = "frontend/src/data/products.js"
    
    # Create backup
    backup_path = f"{file_path}.{int(time.time())}.bak"
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"📦 Backup created: {backup_path}")
    
    # Add $10 to all prices
    def add_markup(match):
        old_price = float(match.group(1))
        new_price = old_price + 10.0
        return f'"price": {new_price:.2f}'
    
    # Find and replace all price fields
    price_pattern = r'"price":\s*([0-9]+(?:\.[0-9]+)?)'
    updated_content = re.sub(price_pattern, add_markup, content)
    
    # Write updated content
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    
    print(f"✅ Added $10 markup to all product prices in {file_path}")
    
    # Count how many prices were updated
    matches = re.findall(price_pattern, content)
    print(f"📊 Updated {len(matches)} product prices")

if __name__ == "__main__":
    add_markup_to_products()
