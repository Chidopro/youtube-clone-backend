@echo off
echo Starting ScreenMerch Backend Server...
echo.

cd backend

echo Navigated to backend directory: %cd%
echo.

if not exist "server.js" (
    echo ERROR: server.js not found in backend directory!
    echo Please make sure this batch file is in the correct location.
    pause
    exit /b 1
)

echo Starting Node.js server...
echo.
echo ========================================
echo   ScreenMerch Backend Server
echo   Port: 3001
echo   Health Check: http://localhost:3001/health
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.

node server.js

pause 