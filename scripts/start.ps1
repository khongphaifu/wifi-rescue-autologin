$ErrorActionPreference = 'SilentlyContinue'
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

$nodeScript = Join-Path $rootDir "src\index.js"
$cmdLine = "node.exe `"$nodeScript`""

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
