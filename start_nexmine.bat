@echo off
title NexMine Platform Launcher
cls
color 0B

echo ================================================================
echo                     NEXMINE INTELLIGENCE PLATFORM
echo          AI-Powered Data Mining & Predictive Analytics
echo ================================================================
echo.
echo [1/3] Checking environment prerequisites...

where python >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Python is not found in your PATH. Please install Python 3.10+.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js / npm is not found in your PATH. Please install Node.js 18+.
    pause
    exit /b 1
)

echo [OK] Python and Node.js detected.
echo.
echo [2/3] Launching NexMine Backend (FastAPI on http://localhost:8000)...
start "NexMine Backend API" /min cmd /k "cd /d %~dp0backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/3] Launching NexMine Frontend (Vite on http://localhost:5173)...
start "NexMine Frontend" /min cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo Opening NexMine in your default browser...
start http://localhost:5173/app/dashboard

cls
color 0A
echo ================================================================
echo               NEXMINE IS NOW RUNNING SUCCESSFULLY!
echo ================================================================
echo.
echo   * Web Dashboard:  http://localhost:5173/app/dashboard
echo   * Backend API:    http://localhost:8000
echo   * API Docs:       http://localhost:8000/docs
echo   * Currency:       Indian Rupees (INR)
echo.
echo ----------------------------------------------------------------
echo   To STOP NexMine:
echo   Run stop_nexmine.bat or close the minimized server windows.
echo ================================================================
echo.
pause
