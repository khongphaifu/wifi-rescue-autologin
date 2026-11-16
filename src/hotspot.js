const { execFileSync } = require('child_process');
const { renderAsciiQr } = require('./qr');

const WINRT_PREAMBLE = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
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
if (-not $connProf) {
    $allProfs = [Windows.Networking.Connectivity.NetworkInformation]::GetConnectionProfiles()
    $connProf = $allProfs | Where-Object { $_.GetNetworkConnectivityLevel().ToString() -ne 'None' } | Select-Object -First 1
}
if (-not $connProf) {
    Write-Output (@{ supported = $false; error = 'No active connection profile found' } | ConvertTo-Json -Compress)
    exit 0
}
$tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($connProf)
`;

function runWinRtHotspotScript(actionScript) {
  const fullScript = WINRT_PREAMBLE + '\n' + actionScript;
  try {
    const encoded = Buffer.from(fullScript, 'utf16le').toString('base64');
    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { encoding: 'utf-8', timeout: 15000 }
    );
    const trimmed = (out || '').trim();
    const jsonLine = trimmed.split(/\r?\n/).reverse().find(l => l.trim().startsWith('{'));
    return jsonLine ? JSON.parse(jsonLine) : { supported: false, error: 'Empty response from WinRT' };
  } catch (err) {
    return { supported: false, error: err.message };
  }
}

function getHotspotStatus() {
  return runWinRtHotspotScript(`
$cfg = $tm.GetCurrentAccessPointConfiguration()
$state = $tm.TetheringOperationalState.ToString()
Write-Output (@{
    supported = $true
    state = $state
    isRunning = ($state -eq 'On')
    profileName = $connProf.ProfileName
    ssid = $cfg.Ssid
    passphrase = $cfg.Passphrase
    maxClients = $tm.MaxClientCount
    clientCount = $tm.ClientCount
} | ConvertTo-Json -Compress)
`);
}

function startHotspot() {
  return runWinRtHotspotScript(`
$cfg = $tm.GetCurrentAccessPointConfiguration()
$state = $tm.TetheringOperationalState.ToString()
if ($state -eq 'On') {
    Write-Output (@{
        supported = $true
        success = $true
        alreadyOn = $true
        state = 'On'
        ssid = $cfg.Ssid
        passphrase = $cfg.Passphrase
        clientCount = $tm.ClientCount
    } | ConvertTo-Json -Compress)
    exit 0
}
$op = Await-WinRt ($tm.StartTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])
$newState = $tm.TetheringOperationalState.ToString()
Write-Output (@{
    supported = $true
    success = ($op.Status.ToString() -eq 'Success' -or $newState -eq 'On')
    alreadyOn = $false
    operationStatus = $op.Status.ToString()
    additionalError = $op.AdditionalErrorMessage
    state = $newState
    ssid = $cfg.Ssid
    passphrase = $cfg.Passphrase
    clientCount = $tm.ClientCount
} | ConvertTo-Json -Compress)
`);
}

function stopHotspot() {
  return runWinRtHotspotScript(`
$state = $tm.TetheringOperationalState.ToString()
if ($state -eq 'Off') {
    Write-Output (@{ supported = $true; success = $true; state = 'Off' } | ConvertTo-Json -Compress)
    exit 0
}
$op = Await-WinRt ($tm.StopTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])
$newState = $tm.TetheringOperationalState.ToString()
Write-Output (@{
    supported = $true
    success = ($op.Status.ToString() -eq 'Success' -or $newState -eq 'Off')
    state = $newState
} | ConvertTo-Json -Compress)
`);
}

function printHotspotBanner(info) {
  console.log('==============================================================');
  console.log('  TRẠM PHÁT WI-FI CỨU HỘ CHO IPHONE (MOBILE HOTSPOT RELAY)');
  console.log('==============================================================');
  if (!info || !info.supported) {
    console.log(`  [LỖI] Không thể truy cập Mobile Hotspot: ${(info && info.error) || 'Không rõ'}`);
    return;
  }
  console.log(`  Trạng thái : ${info.state === 'On' ? 'ĐANG PHÁT SÓNG (ON)' : info.state}`);
  console.log(`  Tên Wi-Fi  : ${info.ssid}`);
  console.log(`  Mật khẩu   : ${info.passphrase}`);
  console.log(`  Thiết bị   : ${info.clientCount || 0} đang kết nối`);

  if (info.ssid && info.passphrase) {
    const wifiQr = `WIFI:T:WPA;S:${info.ssid};P:${info.passphrase};;`;
    console.log('\n  [MÃ QR KẾT NỐI WI-FI NHANH CHO IPHONE]');
    console.log('  Mở Camera iPhone -> Quét mã dưới đây để tự động bắt sóng:\n');
    try {
      console.log(renderAsciiQr(wifiQr));
    } catch (e) {
      console.log(`  (Mã kết nối dài hơn chuẩn QR v5: ${wifiQr})`);
    }
  }
  console.log('==============================================================');
}

if (require.main === module) {
  if (process.argv.includes('--stop')) {
    const res = stopHotspot();
    console.log('[HOTSPOT] Dừng phát sóng:', res);
  } else if (process.argv.includes('--status')) {
    const info = getHotspotStatus();
    printHotspotBanner(info);
  } else {
    const res = startHotspot();
    printHotspotBanner(res);
  }
}

module.exports = {
  getHotspotStatus,
  startHotspot,
  stopHotspot
};
