@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\windows\build-exe.ps1"
set ERR=%ERRORLEVEL%
echo.
if not "%ERR%"=="0" (
  echo EXE build failed.
  pause
  exit /b %ERR%
)
echo EXE build finished.
pause
exit /b 0
