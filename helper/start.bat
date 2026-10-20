@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening the download page...
  start https://nodejs.org
  echo Install Node.js ^(LTS version^), then open this file again.
  pause
  exit /b
)
if not exist node_modules (
  echo Setting up, please wait a minute...
  call npm install --omit=dev
)
node agent.js
pause
