#!/usr/bin/env python3
"""
Update Backend Product Sizes to 5XL
Updates all size arrays in backend files to include sizes up to 5XL
"""

import re

def update_backend_sizes():
    """Update all size arrays in backend files to include 5XL"""
    
    print("🔄 Updating backend product sizes to include 5XL...")
    
    # Files to update
    files_to_update = [
        "backend/app.py",
        "frontend_app.py"
    ]
    
    # Size mappings for different product types
    size_mappings = {
        # Standard clothing sizes (XS to 5XL)
        r'"size": \["S", "M", "L", "XL"\]': '"size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]',
        r'"size": \["XS", "S", "M", "L"\]': '"size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]',
        r'"size": \["S", "M", "L"\]': '"size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]',
        
        # Keep laptop sleeves as they are (they use inch sizes)
        # r'"size": \["13 inch", "15 inch"\]': '"size": ["13 inch", "15 inch"]',
        
        # Keep accessories as they are (no sizes)
        # r'"size": \[\]': '"size": []',
    }
    
    for file_path in files_to_update:
        try:
            print(f"📝 Updating {file_path}...")
            
            # Read the file
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Apply size mappings
            original_content = content
            for old_pattern, new_pattern in size_mappings.items():
                content = re.sub(old_pattern, new_pattern, content)
            
            # Write back if changes were made
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"✅ Updated {file_path}")
            else:
                print(f"⚠️ No changes needed for {file_path}")
                
        except Exception as e:
            print(f"❌ Error updating {file_path}: {e}")
    
    print("🎉 Backend size updates completed!")

if __name__ == "__main__":
    update_backend_sizes()
