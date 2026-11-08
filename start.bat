@echo off
chcp 65001 >nul
title Khởi Động Dịch Vụ Wi-Fi Rescue
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"
pause
