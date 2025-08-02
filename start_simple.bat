@echo off
echo ========================================
echo ScreenMerch - Simple Development Start
echo ========================================
echo.

echo Starting your existing development environment...
echo.

echo 1. Starting Backend Server...
echo    URL: http://localhost:5000
start "ScreenMerch Backend" cmd /k "python app.py"

echo.
echo 2. Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo.
echo 3. Starting Frontend Server...
echo    URL: http://localhost:5173
cd frontend
start "ScreenMerch Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo Development Environment Started!
echo ========================================
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo.
echo You can now safely edit your website without affecting the live site.
echo.
echo Press any key to open the frontend in your browser...
pause > nul

echo Opening frontend in browser...
start http://localhost:5173

echo.
echo Ready to make changes! 
echo - Edit files locally
echo - Test at localhost:5173
echo - Deploy only when ready
echo.
pause 