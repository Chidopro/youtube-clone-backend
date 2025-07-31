@echo off
echo Syncing products to website...
echo.
echo Product Manager is now located in: C:\Users\chido\OneDrive\Desktop\Product Manager
echo.
cd "C:\Users\chido\OneDrive\Desktop\Product Manager"
python sync_products_to_website.py
echo.
echo Sync completed! You can now rebuild the frontend.
pause 