@echo off
title Stop NexMine Platform
cls
color 0C

echo ================================================================
echo                     STOPPING NEXMINE PLATFORM
echo ================================================================
echo.
echo Stopping any running backend (Port 8000) and frontend (Port 5173)...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /F /PID %%a >nul 2>nul
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /F /PID %%a >nul 2>nul
)

echo.
color 0A
echo [SUCCESS] NexMine servers have been shut down cleanly.
echo.
timeout /t 3 >nul
exit
