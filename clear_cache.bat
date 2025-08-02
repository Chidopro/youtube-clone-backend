@echo off
echo ========================================
echo   ScreenMerch Cache Clearing Script
echo ========================================
echo.
echo 1. Stopping Flask server...
taskkill /F /IM python.exe 2>nul
echo.
echo 2. Starting Flask server...
start /B python app.py
echo.
echo 3. Server started! Now:
echo    - Open: http://localhost:5000/product/test123
echo    - Press Ctrl+Shift+R for hard refresh
echo    - Or use Ctrl+F5 to force reload
echo.
echo 4. If you still don't see updates:
echo    - Try opening in incognito/private window
echo    - Or clear browser cache manually
echo.
pause 