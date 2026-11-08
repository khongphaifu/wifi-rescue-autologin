@echo off
chcp 65001 >nul
title Wi-Fi Rescue Monitor
mode con: cols=68 lines=22
node "%~dp0src\dashboard.js"
pause
