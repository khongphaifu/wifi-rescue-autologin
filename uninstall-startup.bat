@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\uninstall-startup.ps1"
echo.
pause
