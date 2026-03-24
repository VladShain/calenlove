@echo off
setlocal
cd /d "%~dp0.."
echo.
echo ==================================================
echo INSTALL MSVC BUILD TOOLS
echo ==================================================
echo Project: %CD%
echo Log: logs\msvc_build_tools_install_LATEST.log
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\android\install-msvc-build-tools.ps1"
if errorlevel 1 (
  echo.
  echo [MSVC] Install finished with errors.
  echo [MSVC] Open logs\msvc_build_tools_install_LATEST.log
) else (
  echo.
  echo [MSVC] Install finished.
  echo [MSVC] Next: ANDROID\CHECK_ANDROID_ENV.bat then ANDROID\APK_BUILD.bat
)
pause
