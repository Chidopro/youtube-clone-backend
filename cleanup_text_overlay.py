#!/usr/bin/env python3
"""
Cleanup script to remove all text overlay additions
Run this if you don't like the text overlay feature
"""

import os
import shutil

def cleanup_text_overlay():
    """Remove all text overlay related files and code"""
    
    print("🧹 Starting cleanup of text overlay feature...")
    
    # Files to delete
    files_to_delete = [
        "image_text_overlay.py",
        "templates/text_overlay_demo.html", 
        "test_text_overlay.py",
        "TEXT_OVERLAY_README.md",
        "cleanup_text_overlay.py"  # This script will delete itself too
    ]
    
    # Delete files
    for file_path in files_to_delete:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"✅ Deleted: {file_path}")
            except Exception as e:
                print(f"❌ Failed to delete {file_path}: {e}")
        else:
            print(f"⚠️  File not found: {file_path}")
    
    print("\n📝 Manual steps needed:")
    print("1. Open app.py and remove these lines from the imports section:")
    print("   - from image_text_overlay import ImageTextOverlay")
    print("   - text_overlay = ImageTextOverlay()")
    print("2. Remove the text overlay API endpoints (lines with @app.route for /api/image/)")
    print("3. Remove the demo route: @app.route('/text-overlay-demo')")
    
    print("\n🎉 Cleanup complete! The text overlay feature has been removed.")
    print("💡 If you want to try it again later, just let me know!")

if __name__ == "__main__":
    cleanup_text_overlay() 