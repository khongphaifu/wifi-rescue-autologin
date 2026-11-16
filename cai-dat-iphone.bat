@echo off
chcp 65001 >nul
title Cai Dat Wi-Fi Rescue Cho iPhone (QR Server)
cd /d "%~dp0"
node src\mobile-server.js
pause
