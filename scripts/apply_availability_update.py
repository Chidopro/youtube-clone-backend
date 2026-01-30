#!/usr/bin/env python3
"""
Apply Availability Update from Printful Variable Editor
This script reads the exported JSON file from the admin tool and automatically
updates the availability in frontend/src/data/products.js
"""

import json
import os
import re
import sys
from datetime import datetime

def apply_availability_update(json_file_path):
    """Apply availability update from exported JSON file"""
    
    # Read the exported JSON file
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            export_data = json.load(f)
    except Exception as e:
        print(f"❌ Error reading JSON file: {e}")
        return False
    
    product_key = export_data.get('productKey')
    product_name = export_data.get('productName')
    availability = export_data.get('availability')
    
    if not product_key or not availability:
        print("❌ Invalid JSON format. Missing productKey or availability.")
        return False
    
    print(f"📦 Updating availability for: {product_name} (key: {product_key})")
    
    # Path to products.js file
    products_file = os.path.join('frontend', 'src', 'data', 'products.js')
    if not os.path.exists(products_file):
        # Try alternative path
        products_file = os.path.join('src', 'data', 'products.js')
        if not os.path.exists(products_file):
            print(f"❌ products.js file not found at {products_file}")
            return False
    
    # Create backup
    backup_file = f"{products_file}.{int(datetime.now().timestamp())}.bak"
    try:
        with open(products_file, 'r', encoding='utf-8') as f:
            content = f.read()
        with open(backup_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"📦 Backup created: {backup_file}")
    except Exception as e:
        print(f"❌ Error creating backup: {e}")
        return False
    
    # Find the product block
    product_pattern = rf'"{re.escape(product_key)}":\s*\{{'
    product_match = re.search(product_pattern, content)
    
    if not product_match:
        print(f"❌ Product '{product_key}' not found in products.js")
        return False
    
    # Find availability pattern
    availability_pattern = r'"availability":\s*\{'
    avail_match = re.search(availability_pattern, content[product_match.start():])
    
    if not avail_match:
        print(f"❌ Availability object not found for product '{product_key}'")
        return False
    
    # Get absolute position
    avail_start_abs = product_match.start() + avail_match.start()
    avail_brace_start = product_match.start() + avail_match.end() - 1
    
    # Find matching closing brace
    brace_count = 0
    in_string = False
    escape_next = False
    avail_end_pos = avail_brace_start
    
    for i in range(avail_brace_start, len(content)):
        char = content[i]
        
        if escape_next:
            escape_next = False
            continue
        
        if char == '\\':
            escape_next = True
            continue
        
        if char == '"' and not escape_next:
            in_string = not in_string
            continue
        
        if not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    avail_end_pos = i + 1
                    break
    
    # Get indentation from the line before availability
    line_start = content.rfind('\n', 0, avail_start_abs) + 1
    indent_line = content[line_start:avail_start_abs]
    indent = len(indent_line) - len(indent_line.lstrip())
    
    # Generate new availability JSON with proper formatting
    availability_json = json.dumps(availability, indent=2)
    # Add proper indentation (match the file's style)
    availability_lines = availability_json.split('\n')
    indented_availability = []
    for i, line in enumerate(availability_lines):
        if i == 0:
            # First line (opening brace) - add indent + 2 spaces for "availability": 
            indented_availability.append(' ' * (indent + 2) + line)
        else:
            # Subsequent lines - add indent + 2 spaces
            indented_availability.append(' ' * (indent + 2) + line)
    
    new_availability_block = ' ' * indent + '"availability": ' + '\n'.join(indented_availability)
    
    # Replace in content
    updated_content = content[:avail_start_abs] + new_availability_block + content[avail_end_pos:]
    
    # Write the updated content
    try:
        with open(products_file, 'w', encoding='utf-8') as f:
            f.write(updated_content)
        print(f"✅ Successfully updated availability for '{product_key}' in {products_file}")
        print(f"📝 Next steps:")
        print(f"   1. Review the changes in {products_file}")
        print(f"   2. Build frontend: cd frontend && npm run build")
        print(f"   3. Deploy: netlify deploy --prod --dir=frontend/dist")
        return True
    except Exception as e:
        print(f"❌ Error writing file: {e}")
        # Restore from backup
        try:
            with open(backup_file, 'r', encoding='utf-8') as f:
                backup_content = f.read()
            with open(products_file, 'w', encoding='utf-8') as f:
                f.write(backup_content)
            print(f"🔄 Restored from backup")
        except:
            pass
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/apply_availability_update.py <path_to_exported_json>")
        print("\nExample:")
        print("  python scripts/apply_availability_update.py croppedhoodie_availability.json")
        sys.exit(1)
    
    json_file = sys.argv[1]
    if not os.path.exists(json_file):
        print(f"❌ File not found: {json_file}")
        sys.exit(1)
    
    success = apply_availability_update(json_file)
    sys.exit(0 if success else 1)

