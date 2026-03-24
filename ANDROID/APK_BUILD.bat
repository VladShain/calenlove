@echo off
setlocal EnableExtensions DisableDelayedExpansion

for %%I in ("%~dp0..") do set "ROOT_DIR=%%~fI"
if not defined ROOT_DIR (
  echo [APK] Failed to resolve project root.
  pause
  exit /b 1
)

pushd "%ROOT_DIR%" >nul 2>nul
if errorlevel 1 (
  echo [APK] Failed to open project root.
  pause
  exit /b 1
)

call :ResolvePowerShell
if errorlevel 1 (
  popd
  pause
  exit /b 1
)

echo.
echo ==================================================
echo APK BUILD
echo ==================================================
echo Project: %ROOT_DIR%\
echo Log: logs\apk_build_LATEST.log
echo Wait for the final READY lines. The build is not finished right after the Tauri line "Finished 1 APK at".
echo.

"%PS_RUNNER%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%\scripts\android\build-android.ps1"
set "ERR=%ERRORLEVEL%"

echo.
if not "%ERR%"=="0" (
  echo [APK] Build finished with errors.
  echo [APK] Open logs\apk_build_LATEST.log and logs\android-build_LATEST.log
  popd
  pause
  exit /b %ERR%
)

echo [APK] Build finished successfully.
echo [APK] APK folder: ANDROID\READY
echo [APK] Log: logs\apk_build_LATEST.log
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
echo [APK] PowerShell was not found.
exit /b 1
