@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul 2>nul

pushd "%~dp0.." >nul 2>nul
if errorlevel 1 (
  echo [SERVER] Failed to open project folder.
  pause
  exit /b 1
)

call :ResolvePowerShell
if errorlevel 1 (
  popd
  pause
  exit /b 1
)

"%PS_RUNNER%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\serveruild-server-package.ps1"
set "ERR=%ERRORLEVEL%"

echo.
if not "%ERR%"=="0" (
  echo [SERVER] Server package build finished with errors.
  echo [SERVER] Open logs\server_build_LATEST.log for details.
  popd
  pause
  exit /b %ERR%
)

echo [SERVER] Server package build finished successfully.
echo [SERVER] Log: logs\server_build_LATEST.log
popd
pause
exit /b 0

:ResolvePowerShell
set "PS_RUNNER="
if exist "%SystemRoot%\System32\WindowsPowerShell1.0\powershell.exe" (
  set "PS_RUNNER=%SystemRoot%\System32\WindowsPowerShell1.0\powershell.exe"
  exit /b 0
)
where powershell.exe >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  set "PS_RUNNER=powershell.exe"
  exit /b 0
)
where pwsh.exe >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  set "PS_RUNNER=pwsh.exe"
  exit /b 0
)
echo [SERVER] PowerShell was not found.
exit /b 1
