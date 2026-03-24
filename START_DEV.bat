@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul 2>nul

cd /d "%~dp0"
if not exist logs mkdir logs

echo ========================================
echo LOVERS CALENDAR 0.8.2
echo START DEV
echo ========================================

where node >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  if exist "scripts\apply-key-api.mjs" (
    node "scripts\apply-key-api.mjs"
  )
)

call npm install
call npm run dev
pause
