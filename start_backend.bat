@echo off
REM ==========================================
REM ChessCamp — Backend Startup Script (Windows)
REM Creates venv, installs deps, starts server
REM ==========================================

setlocal enabledelayedexpansion

set "PROJECT_DIR=%~dp0"
set "VENV_DIR=%PROJECT_DIR%.venv"
set "REQUIREMENTS=%PROJECT_DIR%backend\requirements.txt"

echo.
echo    ♟  ChessCamp Backend Setup (Windows)
echo   ==============================

REM 1. Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [31mError: Python is not installed or not in PATH.[0m
    pause
    exit /b 1
)

REM 2. Create virtual environment if it doesn't exist
if not exist "%VENV_DIR%" (
    echo  - Creating virtual environment...
    python -m venv "%VENV_DIR%"
    if !errorlevel! neq 0 (
        echo [31mError: Failed to create virtual environment.[0m
        pause
        exit /b 1
    )
    echo  + Virtual environment created at .venv/
) else (
    echo  + Virtual environment already exists
)

REM 3. Activate the venv
echo  - Activating virtual environment...
call "%VENV_DIR%\Scripts\activate.bat"

REM 4. Install/update dependencies
echo  - Installing dependencies...
python -m pip install -q --upgrade pip
pip install -q -r "%REQUIREMENTS%"
echo  + Dependencies installed

REM 5. Ensure .env exists
if not exist "%PROJECT_DIR%.env" (
    echo  - Creating default .env...
    echo DATABASE_URL=sqlite:///./chess.db> "%PROJECT_DIR%.env"
)

REM 6. Start the server
echo.
echo  - Starting FastAPI server on http://localhost:8000
echo  - API docs available at http://localhost:8000/docs
echo.

cd /d "%PROJECT_DIR%"
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

pause
