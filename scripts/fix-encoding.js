const fs = require('fs');
const path = require('path');

const startPs1 = `$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Khởi Động Dịch Vụ Wi-Fi Rescue"

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "   KHỞI ĐỘNG DỊCH VỤ TỰ ĐỘNG KẾT NỐI WI-FI RESCUE   " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Yellow

$pidFile = Join-Path $rootDir "wifi-rescue.pid"
if (Test-Path $pidFile) {
    $oldPid = (Get-Content $pidFile -Raw).Trim()
    $oldProc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
    if ($oldProc) {
        Write-Host "[THÔNG BÁO] Dịch vụ đang chạy ngầm rồi (PID: $oldPid)." -ForegroundColor Green
        return
    } else {
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Đang khởi động dịch vụ chạy ngầm độc lập..." -ForegroundColor Gray

# Thiết lập độ ưu tiên mạng cứu hộ thấp nhất trong Windows
netsh wlan set profileorder name="Free Wi-MESH-Rescue" interface="Wi-Fi" priority=999 >$null 2>&1
netsh wlan set profileorder name="Free Wi-MESH - Rescue" interface="Wi-Fi" priority=999 >$null 2>&1
netsh wlan set profileorder name="1.Free Wi-MESH" interface="Wi-Fi" priority=999 >$null 2>&1

$nodeScript = Join-Path $rootDir "src\\index.js"
$cmdLine = "node.exe \`"$nodeScript\`""

# Sử dụng Win32_Process để tạo tiến trình nền hoàn toàn tách biệt
$cimResult = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = $cmdLine
    CurrentDirectory = $rootDir
}

Start-Sleep -Seconds 2

if (Test-Path $pidFile) {
    $newPid = (Get-Content $pidFile -Raw).Trim()
    Write-Host "[THÀNH CÔNG] Dịch vụ đã khởi động ngầm thành công! (PID: $newPid)" -ForegroundColor Green
    Write-Host "Bạn có thể theo dõi hoạt động trong file: activity.log" -ForegroundColor Cyan
} elseif ($cimResult.ProcessId) {
    Write-Host "[THÀNH CÔNG] Dịch vụ đã khởi động ngầm thành công! (PID: $($cimResult.ProcessId))" -ForegroundColor Green
    Write-Host "Bạn có thể theo dõi hoạt động trong file: activity.log" -ForegroundColor Cyan
} else {
    Write-Host "[LỖI] Không thể khởi động dịch vụ." -ForegroundColor Red
}
`;

const stopPs1 = `$ErrorActionPreference = 'SilentlyContinue'
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
`;

const statusPs1 = `$ErrorActionPreference = 'SilentlyContinue'
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
`;

const root = path.join(__dirname, '..');
fs.writeFileSync(path.join(root, 'scripts', 'start.ps1'), '\ufeff' + startPs1, 'utf-8');
fs.writeFileSync(path.join(root, 'scripts', 'stop.ps1'), '\ufeff' + stopPs1, 'utf-8');
fs.writeFileSync(path.join(root, 'scripts', 'status.ps1'), '\ufeff' + statusPs1, 'utf-8');
console.log('Đã ghi toàn bộ file ps1 với UTF-8 with BOM thành công!');
