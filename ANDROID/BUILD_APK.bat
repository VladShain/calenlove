@echo off
setlocal EnableExtensions DisableDelayedExpansion
call "%~dp0APK_BUILD.bat"
exit /b %ERRORLEVEL%
