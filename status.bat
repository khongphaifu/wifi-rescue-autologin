@echo off
chcp 65001 >nul
title Trạng Thái Dịch Vụ Wi-Fi Rescue
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\status.ps1"
pause
