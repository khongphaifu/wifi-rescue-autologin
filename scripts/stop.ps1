$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Dừng Dịch Vụ Wi-Fi Rescue"

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "     DỪNG DỊCH VỤ TỰ ĐỘNG KẾT NỐI WI-FI RESCUE     " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Yellow

$pidFile = Join-Path $rootDir "wifi-rescue.pid"
if (Test-Path $pidFile) {
    $pidVal = (Get-Content $pidFile -Raw).Trim()
    $proc = Get-Process -Id $pidVal -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "Đang dừng tiến trình PID: $pidVal..." -ForegroundColor Yellow
        Stop-Process -Id $pidVal -Force -ErrorAction SilentlyContinue
        Write-Host "[THÀNH CÔNG] Đã dừng dịch vụ chạy ngầm." -ForegroundColor Green
    } else {
        Write-Host "[THÔNG BÁO] Tiến trình PID: $pidVal không còn chạy." -ForegroundColor Gray
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "[THÔNG BÁO] Dịch vụ hiện không chạy (không tìm thấy file PID)." -ForegroundColor Gray
}
