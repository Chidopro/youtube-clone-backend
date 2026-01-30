# Printful Variable Editor - Quick Update Guide

This guide explains how to easily update product color/size availability using the admin Printful Variable Editor tool.

## Method 1: Automatic Update (Recommended) ⚡

### Step 1: Make Changes in Admin Tool
1. Go to Admin Portal → Printful Variable Editor
2. Select the product you want to update
3. Click cells to toggle color/size availability
4. Click **"📥 Export JSON"** button
5. Save the downloaded JSON file to your project root directory

### Step 2: Apply the Update
Run the automatic update script:

```bash
python scripts/apply_availability_update.py <filename>.json
```

**Example:**
```bash
python scripts/apply_availability_update.py croppedhoodie_availability.json
```

The script will:
- ✅ Create a backup of `frontend/src/data/products.js`
- ✅ Update the availability data automatically
- ✅ Show you the next steps

### Step 3: Build and Deploy
```bash
cd frontend
npm run build
cd ..
netlify deploy --prod --dir=frontend/dist
```

---

## Method 2: Manual Update (Fallback) 📋

### Step 1: Get the Code Snippet
1. Go to Admin Portal → Printful Variable Editor
2. Select the product and make your changes
3. Click **"📋 Copy Code"** button
4. The code snippet is now in your clipboard

### Step 2: Apply Manually
1. Open `frontend/src/data/products.js`
2. Find the product with the matching key (e.g., `"croppedhoodie"`)
3. Locate the `"availability"` property
4. Replace the entire `"availability"` object with the copied code
5. Save the file

### Step 3: Build and Deploy
```bash
cd frontend
npm run build
cd ..
netlify deploy --prod --dir=frontend/dist
```

---

## Troubleshooting

### Script Not Found
Make sure you're running the script from the project root directory:
```bash
# From project root
python scripts/apply_availability_update.py <filename>.json
```

### Product Not Found
- Verify the product key matches exactly (case-sensitive)
- Check that the product exists in `frontend/src/data/products.js`

### JSON Format Error
- Make sure you downloaded the JSON from the "Export JSON" button
- Don't modify the JSON file structure manually

---

## Tips

- 💡 **Always review changes** before deploying
- 💡 **Backups are automatic** - check the `.bak` files if you need to restore
- 💡 **Test locally** by running `npm run build` before deploying
- 💡 **Use Export JSON** for automatic updates (faster and less error-prone)

