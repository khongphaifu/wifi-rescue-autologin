$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Trạng Thái Dịch Vụ Wi-Fi Rescue"

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

# Hiển thị bảng trạng thái và thời gian còn lại chuẩn đẹp qua dashboard.js
node src/dashboard.js --once

Write-Host ""
Write-Host "--- 5 DÒNG NHẬT KÝ (LOG) GẦN NHẤT ---" -ForegroundColor Cyan
$logFile = Join-Path $rootDir "activity.log"
if (Test-Path $logFile) {
    Get-Content $logFile -Tail 5 -Encoding UTF8
} else {
    Write-Host "Chưa có file activity.log." -ForegroundColor Gray
}

Write-Host ""
Write-Host "💡 Mẹo: Mở file [xem-thoi-gian.bat] để xem đồng hồ đếm ngược trực tiếp thời gian thực!" -ForegroundColor Yellow
Write-Host ""
