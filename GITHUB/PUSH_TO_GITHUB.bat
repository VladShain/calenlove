@echo off
setlocal
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\windows\push-to-github.ps1"
if errorlevel 1 (
  echo.
  echo [GITHUB] PUSH finished with errors.
  echo Open logs\github_push_LATEST.log for details.
  pause
  exit /b 1
)
echo.
echo [GITHUB] PUSH finished successfully.
pause
