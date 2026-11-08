$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
    })[0]

    function Await-WinRt($WinRtTask, $ResultType) {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(-1) | Out-Null
        return $netTask.Result
    }

    [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime] | Out-Null
    [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime] | Out-Null

    $connProf = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
    if ($connProf) {
        Write-Host "Profile mạng Internet hiện tại: $($connProf.ProfileName)" -ForegroundColor Green
        $tetheringManager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($connProf)
        Write-Host "Trạng thái Hotspot: $($tetheringManager.TetheringOperationalState)" -ForegroundColor Cyan
        Write-Host "Số lượng thiết bị tối đa: $($tetheringManager.MaxClientCount)" -ForegroundColor Cyan
        
        # Đọc cấu hình SSID và mật khẩu hotspot hiện tại
        $config = $tetheringManager.GetCurrentAccessPointConfiguration()
        Write-Host "Tên điểm phát (SSID): $($config.Ssid)" -ForegroundColor Yellow
        Write-Host "Mật khẩu (Passphrase): $($config.Passphrase)" -ForegroundColor Yellow
        Write-Host "Hỗ trợ Mobile Hotspot: THÀNH CÔNG 100%" -ForegroundColor Green
    } else {
        Write-Host "Hiện tại chưa có profile kết nối Internet." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Lỗi kiểm tra Hotspot: $($_.Exception.Message)" -ForegroundColor Red
}
