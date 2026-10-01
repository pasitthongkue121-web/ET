@echo off
title ENERGY TWINS AI - Stop Servers
echo ===================================================
echo           STOPPING ENERGY TWINS AI SERVERS
echo ===================================================

echo [*] Terminating Cloudflare Tunnel...
taskkill /f /im cloudflared.exe >nul 2>&1

echo [*] Terminating processes on Port 8000 (FastAPI)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [*] Terminating processes on Port 3000 (Next.js)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo [+] All ENERGY TWINS AI servers stopped successfully.
pause
