$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Cài Đặt Tự Khởi Động Wi-Fi Rescue"

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

Write-Host "==============================================================" -ForegroundColor Yellow
Write-Host "  CÀI ĐẶT TỰ KHỞI ĐỘNG CÙNG WINDOWS CHO WI-FI RESCUE DAEMON   " -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Yellow

$vbsPath = Join-Path $rootDir "run-silent.vbs"

# 1. Cấu hình Windows Registry Run (Khởi động tức thì 0 giây độ trễ khi mở máy)
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$regName = "WifiRescueAutoLogin"
$regValue = "wscript.exe `"$vbsPath`""

try {
    Set-ItemProperty -Path $regPath -Name $regName -Value $regValue -Force
    Write-Host "[THÀNH CÔNG] Đã đăng ký Registry Run (Khởi động tức thì 0s delay)!" -ForegroundColor Green
} catch {
    Write-Host "[CẢNH BÁO] Không thể ghi Registry Run: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 2. Cấu hình Shortcut trong thư mục Startup (Cơ chế dự phòng kép)
$startupDir = [System.IO.Path]::Combine($env:APPDATA, 'Microsoft\Windows\Start Menu\Programs\Startup')
$shortcutPath = Join-Path $startupDir "WifiRescueAutoLogin.lnk"

try {
    $ws = New-Object -ComObject WScript.Shell
    $shortcut = $ws.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = "wscript.exe"
    $shortcut.Arguments = "`"$vbsPath`""
    $shortcut.WorkingDirectory = $rootDir
    $shortcut.Description = "Wifi Rescue Auto Login Daemon"
    $shortcut.Save()

    if (Test-Path $shortcutPath) {
        Write-Host "[THÀNH CÔNG] Đã tạo shortcut dự phòng trong thư mục Startup!" -ForegroundColor Green
    }
} catch {
    Write-Host "[CẢNH BÁO] Không thể tạo shortcut Startup: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 3. Thiết lập độ ưu tiên mạng cứu hộ thấp nhất trong Windows
netsh wlan set profileorder name="Free Wi-MESH-Rescue" interface="Wi-Fi" priority=999 >$null 2>&1
netsh wlan set profileorder name="Free Wi-MESH - Rescue" interface="Wi-Fi" priority=999 >$null 2>&1
netsh wlan set profileorder name="1.Free Wi-MESH" interface="Wi-Fi" priority=999 >$null 2>&1

Write-Host "--------------------------------------------------------------" -ForegroundColor Gray
Write-Host "TRẠNG THÁI: Tự động chạy ngầm ngay khi vừa bật/đăng nhập Windows!" -ForegroundColor Cyan
Write-Host "Vị trí script: $vbsPath" -ForegroundColor Gray
Write-Host "==============================================================" -ForegroundColor Yellow
