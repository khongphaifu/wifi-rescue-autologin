$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Cài Đặt Tự Khởi Động Wi-Fi Rescue"

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

Write-Host "==============================================================" -ForegroundColor Yellow
Write-Host "  CÀI ĐẶT TỰ KHỞI ĐỘNG CÙNG WINDOWS CHO WI-FI RESCUE DAEMON   " -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Yellow

$vbsPath = Join-Path $rootDir "run-silent.vbs"
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

    # Thiết lập độ ưu tiên mạng cứu hộ thấp nhất trong Windows
    netsh wlan set profileorder name="Free Wi-MESH-Rescue" interface="Wi-Fi" priority=999 >$null 2>&1
    netsh wlan set profileorder name="Free Wi-MESH - Rescue" interface="Wi-Fi" priority=999 >$null 2>&1
    netsh wlan set profileorder name="1.Free Wi-MESH" interface="Wi-Fi" priority=999 >$null 2>&1

    if (Test-Path $shortcutPath) {
        Write-Host "[THÀNH CÔNG] Đã tạo shortcut trong thư mục Startup của Windows!" -ForegroundColor Green
        Write-Host "Vị trí: $shortcutPath" -ForegroundColor Gray
        Write-Host "Từ nay mỗi khi bật máy tính, tiện ích sẽ tự động chạy ngầm." -ForegroundColor Cyan
    } else {
        Write-Host "[LỖI] Không thể tạo file shortcut." -ForegroundColor Red
    }
} catch {
    Write-Host "[LỖI] $($_.Exception.Message)" -ForegroundColor Red
}
