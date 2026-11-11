$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Gỡ Bỏ Tự Khởi Động Wi-Fi Rescue"

Write-Host "==============================================================" -ForegroundColor Yellow
Write-Host "  GỠ BỎ TỰ KHỞI ĐỘNG CÙNG WINDOWS CHO WI-FI RESCUE DAEMON     " -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Yellow

# 1. Xóa Registry Run
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$regName = "WifiRescueAutoLogin"
try {
    Remove-ItemProperty -Path $regPath -Name $regName -ErrorAction SilentlyContinue
    Write-Host "[THÀNH CÔNG] Đã xóa khỏi Windows Registry Run." -ForegroundColor Green
} catch {}

# 2. Xóa Shortcut Startup
$startupDir = [System.IO.Path]::Combine($env:APPDATA, 'Microsoft\Windows\Start Menu\Programs\Startup')
$shortcutPath = Join-Path $startupDir "WifiRescueAutoLogin.lnk"

if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force -ErrorAction SilentlyContinue
    Write-Host "[THÀNH CÔNG] Đã xóa shortcut khỏi thư mục Startup của Windows." -ForegroundColor Green
} else {
    Write-Host "[THÔNG BÁO] Không tìm thấy shortcut trong thư mục Startup." -ForegroundColor Gray
}

Write-Host "==============================================================" -ForegroundColor Yellow
