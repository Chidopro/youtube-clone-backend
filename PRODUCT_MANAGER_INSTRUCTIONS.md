# ScreenMerch Product Manager - Instructions

## 📋 Overview
This tool allows you to manage products for your ScreenMerch website. After making changes, you need to sync them to your website files and rebuild.

## 🛠️ How to Use

### Step 1: Edit Products
```bash
# Open the product manager tool
python product_manager.py
```

**Available Options:**
- **1. List Products** - View all products
- **2. Add Product** - Create new product
- **3. Edit Product** - Modify existing product
- **4. Delete Product** - Remove product
- **5. Export Products** - Save to JSON file
- **6. Import Products** - Load from JSON file
- **7. Save & Exit** - Save changes and quit
- **8. Exit without saving** - Quit without saving

### Step 2: Sync Changes to Website
```bash
# After editing products, sync to website files
python sync_products_to_website.py
```

This updates:
- `backend/app.py`
- `frontend_app.py`
- `frontend/src/data/products.js`

### Step 3: Rebuild Frontend
```bash
# Navigate to frontend directory
cd frontend

# Build the project
npm run build
```

### Step 4: Deploy
Netlify will automatically detect the new build and deploy to your website.

## 🔄 Complete Workflow

```bash
# 1. Edit products
python product_manager.py

# 2. Sync to website
python sync_products_to_website.py

# 3. Rebuild frontend
cd frontend
npm run build

# 4. Wait for Netlify deployment
```

## 📁 File Locations

- **Product Manager Tool:** `product_manager.py`
- **Sync Script:** `sync_products_to_website.py`
- **Product Data:** `products.json`
- **Frontend Build:** `frontend/dist/`

## ⚠️ Important Notes

1. **Always save changes** in the product manager before exiting
2. **Run sync script** after every product edit
3. **Rebuild frontend** after syncing
4. **Wait for deployment** - changes take a few minutes to appear live

## 🐛 Troubleshooting

### If products don't appear on website:
1. Check that `products.json` has your products
2. Run sync script again
3. Rebuild frontend
4. Clear browser cache

### If sync script fails:
1. Make sure you're in the root directory (`youtube-clone/`)
2. Check that `products.json` exists
3. Verify file permissions

### If build fails:
1. Make sure you're in the `frontend/` directory
2. Run `npm install` if needed
3. Check for syntax errors in updated files

## 📞 Support

If you encounter issues:
1. Check the error messages
2. Verify file paths
3. Ensure all required files exist
4. Try running commands step by step

---

**Remember:** Edit → Sync → Build → Deploy 