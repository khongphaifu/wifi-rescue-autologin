@echo off
chcp 65001 >nul
title Dừng Dịch Vụ Wi-Fi Rescue
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1"
pause
