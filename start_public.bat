@echo off
title ENERGY TWINS AI - Public Tunnel Launcher
cd /d "%~dp0"

echo ================================================================
echo         STARTING ENERGY TWINS AI (WORLDWIDE PUBLIC ACCESS)
echo ================================================================
echo.
echo Launching Servers and Free Cloudflare Public HTTPS Tunnel...
echo.

python public_tunnel.py

pause
