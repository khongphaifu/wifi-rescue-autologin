@echo off
chcp 65001 >nul
title Phat Wi-Fi Hotspot Tu Laptop Cho iPhone
cd /d "%~dp0"
node src\hotspot.js
echo.
pause
