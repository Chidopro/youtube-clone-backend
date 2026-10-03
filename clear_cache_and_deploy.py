#!/usr/bin/env python3
"""
Clear Cache and Force Redeploy Script
Forces cache clearing and redeployment to both Fly.io and Netlify
"""

import os
import subprocess
import time

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {description} completed successfully")
            if result.stdout:
                print(f"📝 Output: {result.stdout.strip()}")
        else:
            print(f"❌ {description} failed")
            print(f"📝 Error: {result.stderr.strip()}")
        return result.returncode == 0
    except Exception as e:
        print(f"❌ {description} failed with exception: {e}")
        return False

def main():
    print("🚀 Starting cache clear and force redeploy...")
    
    # Step 1: Force rebuild frontend with cache busting
    print("\n📦 Step 1: Rebuilding frontend with cache busting...")
    if run_command("cd frontend && npm run build", "Building frontend"):
        print("✅ Frontend built successfully")
    
    # Step 2: Add cache busting to HTML files
    print("\n🔧 Step 2: Adding cache busting to HTML files...")
    cache_buster = str(int(time.time()))
    
    # Update product page with cache busting
    product_page_path = "backend/templates/product_page.html"
    if os.path.exists(product_page_path):
        with open(product_page_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Add cache busting meta tags
        cache_meta = f'<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n  <meta http-equiv="Pragma" content="no-cache">\n  <meta http-equiv="Expires" content="0">\n  <meta name="cache-buster" content="{cache_buster}">'
        
        if '<meta http-equiv="Cache-Control"' not in content:
            # Insert after the first meta tag
            content = content.replace('<meta name="viewport"', f'{cache_meta}\n  <meta name="viewport"')
        
        with open(product_page_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("✅ Added cache busting to product page")
    
    # Step 3: Force commit and push with cache busting
    print("\n📤 Step 3: Force pushing changes with cache busting...")
    if run_command("git add .", "Adding all changes"):
        if run_command(f'git commit -m "Force redeploy with cache busting - {cache_buster}"', "Committing changes"):
            if run_command("git push", "Pushing to GitHub"):
                print("✅ Changes pushed successfully")
    
    # Step 4: Trigger Fly.io redeploy
    print("\n🚀 Step 4: Triggering Fly.io redeploy...")
    if run_command(
        "cd backend && flyctl deploy --remote-only --app screenmerch",
        "Deploying production backend to Fly.io",
    ):
        print("✅ Fly.io deployment triggered")
    
    # Step 5: Instructions for Netlify
    print("\n🌐 Step 5: Netlify Deployment Instructions")
    print("📋 To deploy to Netlify:")
    print("1. Go to your Netlify dashboard")
    print("2. Find your site")
    print("3. Go to 'Deploys' tab")
    print("4. Click 'Trigger deploy' > 'Deploy site'")
    print("5. Or connect your GitHub repo for automatic deployments")
    
    print("\n🎯 Cache Clearing Instructions:")
    print("1. Press Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)")
    print("2. Select 'Cached images and files'")
    print("3. Click 'Clear data'")
    print("4. Refresh your website")
    
    print(f"\n✅ Cache busting completed with timestamp: {cache_buster}")
    print("🔄 Your changes should now be visible after clearing browser cache!")

if __name__ == "__main__":
    main()
