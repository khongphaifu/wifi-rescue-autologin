$proc = Start-Process node -ArgumentList 'src\index.js' -PassThru
Write-Host "Started PID: $($proc.Id)"
Start-Sleep -Seconds 15
Write-Host "Still alive after 15s: $(-not $proc.HasExited)"
if ($proc.HasExited) {
    Write-Host "ExitCode: $($proc.ExitCode)"
} else {
    Write-Host "Process is happily running indefinitely!"
    $proc.Kill()
}
