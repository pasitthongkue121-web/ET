@echo off
title ENERGY TWINS AI - Local Launcher
cd /d "%~dp0"

echo ===================================================
echo        STARTING ENERGY TWINS AI (LOCAL)
echo ===================================================
echo [*] Starting FastAPI Backend on port 8000...
start "ENERGY TWINS - Backend (Port 8000)" /min cmd /c "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

echo [*] Starting Next.js Frontend on port 3000...
cd frontend
start "ENERGY TWINS - Frontend (Port 3000)" /min cmd /c "node node_modules/next/dist/bin/next start -p 3000"

timeout /t 3 /nobreak >nul

echo.
echo ===================================================
echo  [+] Web App is running!
echo  - Local:   http://localhost:3000
echo  - Backend: http://localhost:8000/docs
echo ===================================================
echo Opening your default browser...
start http://localhost:3000

echo.
echo Press any key to close this launcher window (servers remain running).
pause >nul
