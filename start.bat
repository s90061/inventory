@echo off
cd /d "%~dp0"
echo ============================================
echo   Inventory Management System
echo   http://localhost:8090
echo ============================================
echo.
echo Starting server...
python server.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start. Make sure Python and dependencies are installed:
    echo   pip install fastapi uvicorn python-multipart
    echo.
)
pause
