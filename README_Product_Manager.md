# ScreenMerch Product Manager

A simple standalone tool to manage products in the ScreenMerch system.

## 🚀 Quick Start

1. **Double-click** `start_product_manager.bat` to run the Product Manager
2. **Or run manually**: `python product_manager.py`

## 📋 Features

- ✅ **List Products** - View all products in the system
- ✅ **Add Product** - Create new products with name, price, category, and description
- ✅ **Edit Product** - Modify existing product details
- ✅ **Delete Product** - Remove products from the system
- ✅ **Export Products** - Save products to JSON file
- ✅ **Import Products** - Load products from JSON file
- ✅ **Auto Backup** - Automatic backup before saving changes

## 🛠️ Usage

### Main Menu Options:
1. **List Products** - Shows all products with details
2. **Add Product** - Create a new product
3. **Edit Product** - Modify an existing product
4. **Delete Product** - Remove a product (with confirmation)
5. **Export Products** - Save products to timestamped JSON file
6. **Import Products** - Load products from JSON file
7. **Save & Exit** - Save changes and close
8. **Exit without saving** - Close without saving changes

### Product Fields:
- **Name** - Product name (required)
- **Price** - Product price in dollars (required)
- **Category** - Product category (defaults to "Custom Merch")
- **Description** - Product description (optional)

## 📁 Files

- `product_manager.py` - Main application
- `start_product_manager.bat` - Windows batch file to start the manager
- `products.json` - Product data file (created automatically)
- `products_backup_*.json` - Automatic backup files

## 🔧 Requirements

- Python 3.6 or higher
- No additional packages required (uses only standard library)

## 💡 Tips

- **Always backup** before making major changes
- **Export products** regularly to keep safe copies
- **Use descriptive names** for easy product management
- **Test changes** before applying to production

## 🆘 Troubleshooting

- **File not found errors**: Make sure you're running from the correct directory
- **Permission errors**: Run as administrator if needed
- **Python not found**: Install Python or add to PATH

## 📞 Support

For issues with the Product Manager, check the error messages and ensure Python is properly installed. 