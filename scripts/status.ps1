$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Trạng Thái Dịch Vụ Wi-Fi Rescue"

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "   KIỂM TRA TRẠNG THÁI DỊCH VỤ WI-FI RESCUE        " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Yellow

$pidFile = Join-Path $rootDir "wifi-rescue.pid"
if (Test-Path $pidFile) {
    $pidVal = (Get-Content $pidFile -Raw).Trim()
    $proc = Get-Process -Id $pidVal -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "[TRẠNG THÁI] Dịch vụ ĐANG CHẠY NGẦM (PID: $pidVal)." -ForegroundColor Green
    } else {
        Write-Host "[TRẠNG THÁI] Dịch vụ KHÔNG CHẠY (PID cũ: $pidVal đã dừng)." -ForegroundColor Red
    }
} else {
    Write-Host "[TRẠNG THÁI] Dịch vụ KHÔNG CHẠY." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "--- 10 DÒNG NHẬT KÝ (LOG) GẦN NHẤT ---" -ForegroundColor Cyan
$logFile = Join-Path $rootDir "activity.log"
if (Test-Path $logFile) {
    Get-Content $logFile -Tail 10 -Encoding UTF8
} else {
    Write-Host "Chưa có file activity.log." -ForegroundColor Gray
}

Write-Host ""
Write-Host "--- KIỂM TRA WI-FI HIỆN TẠI ---" -ForegroundColor Cyan
node src/wifi.js
