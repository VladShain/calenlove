@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul 2>nul

pushd "%~dp0.." >nul 2>nul
if errorlevel 1 (
  echo [ANDROID] Failed to open project folder.
  pause
  exit /b 1
)

call :ResolvePowerShell
if errorlevel 1 (
  popd
  pause
  exit /b 1
)

"%PS_RUNNER%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\android\install-android-apk.ps1"
set "ERR=%ERRORLEVEL%"

echo.
if not "%ERR%"=="0" (
  echo [ANDROID] APK install finished with errors.
  popd
  pause
  exit /b %ERR%
)

echo [ANDROID] APK install finished successfully.

popd
pause
exit /b 0

:ResolvePowerShell
set "PS_RUNNER="
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" (
  set "PS_RUNNER=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
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
echo [ANDROID] PowerShell was not found.
exit /b 1
