@echo off
cd /d "%~dp0"

echo ============================================
echo   Inventory Management System
echo   http://localhost:8090
echo ============================================
echo.

echo Checking Python...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.11+ from python.org
    pause
    exit /b 1
)

echo Checking dependencies...
python -c "import fastapi, uvicorn, multipart" >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing missing dependencies...
    pip install fastapi uvicorn python-multipart
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
    echo Dependencies installed.
) else (
    echo All dependencies OK.
)

echo.
echo Starting server...
python server.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server failed to start.
    pause
    exit /b 1
)
pause
