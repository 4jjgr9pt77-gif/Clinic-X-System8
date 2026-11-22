@echo off
title Clinic X
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Download: https://nodejs.org
  pause
  exit /b 1
)

echo Starting Clinic X...
start "ClinicX-Server" /min cmd /c "node server.js"
timeout /t 2 /nobreak >nul

start "" chrome --app=http://localhost:3000 --new-window 2>nul
if errorlevel 1 start "" msedge --app=http://localhost:3000 --new-window 2>nul
if errorlevel 1 start http://localhost:3000

echo Clinic X is open.
echo You can minimize this window. Do not close it while using the clinic.
pause
