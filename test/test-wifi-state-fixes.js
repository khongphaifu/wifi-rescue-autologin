const assert = require('assert');

// 1. Kiểm tra logic phân tích trạng thái card mạng netsh
function parseInterfaceOutput(output) {
  const lines = output.split('\n');
  let state = 'disconnected';
  let ssid = '';
  let signal = '';

  for (const line of lines) {
    const trimmed = line.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.substring(0, colonIdx).trim().toLowerCase();
    const val = trimmed.substring(colonIdx + 1).trim();

    if (key === 'state' || key === 'trạng thái') {
      state = val;
    } else if (key === 'ssid') {
      ssid = val;
    } else if (key === 'signal' || key === 'tín hiệu') {
      signal = val;
    }
  }

  const stateLower = state.toLowerCase();

  const isConnecting = stateLower.includes('associat') || 
                       stateLower.includes('authenticat') || 
                       stateLower.includes('xác thực') || 
                       stateLower.includes('liên kết') ||
                       (stateLower.includes('đang kết nối') && !stateLower.includes('đã'));

  const isStateConnected = (stateLower.includes('connected') || stateLower.includes('kết nối'))
    && !stateLower.includes('disconnected')
    && !stateLower.includes('ngắt')
    && !isConnecting;

  const hasValidSsid = Boolean(ssid && ssid.trim().length > 0);

  return {
    connected: isStateConnected && hasValidSsid,
    isConnecting,
    state,
    ssid: ssid.trim(),
    signal
  };
}

console.log('[TEST] Kiểm tra logic phân tích trạng thái Wi-Fi nâng cao...');

// Case 1: Trạng thái tiếng Việt "Đã ngắt kết nối"
const vnDisconnected = `
    Trạng thái             : Đã ngắt kết nối
    SSID                   : 
`;
const res1 = parseInterfaceOutput(vnDisconnected);
assert.strictEqual(res1.connected, false);
assert.strictEqual(res1.isConnecting, false);
console.log('  ✓ Đã ngắt kết nối -> connected: false, isConnecting: false');

// Case 2: Trạng thái tiếng Anh đang liên kết "associating"
const enAssociating = `
    State                  : associating
    SSID                   : nptq
`;
const res2 = parseInterfaceOutput(enAssociating);
assert.strictEqual(res2.connected, false);
assert.strictEqual(res2.isConnecting, true);
console.log('  ✓ State associating -> connected: false, isConnecting: true (Nhận diện card bận!)');

// Case 3: Trạng thái tiếng Anh đang xác thực "authenticating"
const enAuthenticating = `
    State                  : authenticating
    SSID                   : nptq
`;
const res3 = parseInterfaceOutput(enAuthenticating);
assert.strictEqual(res3.connected, false);
assert.strictEqual(res3.isConnecting, true);
console.log('  ✓ State authenticating -> isConnecting: true (Đang nhập/xác thực mật khẩu)');

// Case 4: Trạng thái tiếng Việt "Đang kết nối"
const vnConnecting = `
    Trạng thái             : Đang kết nối
    SSID                   : S22 của Nguyễn
`;
const res4 = parseInterfaceOutput(vnConnecting);
assert.strictEqual(res4.connected, false);
assert.strictEqual(res4.isConnecting, true);
console.log('  ✓ Đang kết nối -> isConnecting: true');

// Case 5: SSID có dấu hai chấm ":" (ví dụ "Wifi:Home:5G")
const ssidWithColon = `
    Trạng thái             : Đã kết nối
    SSID                   : Wifi:Home:5G
    Tín hiệu               : 95%
`;
const res5 = parseInterfaceOutput(ssidWithColon);
assert.strictEqual(res5.connected, true);
assert.strictEqual(res5.ssid, 'Wifi:Home:5G');
console.log('  ✓ SSID có dấu hai chấm "Wifi:Home:5G" parse đầy đủ chính xác: ' + res5.ssid);

// Case 6: Đã kết nối mạng Free Wi-MESH-Rescue
const enRescue = `
    State                  : connected
    SSID                   : Free Wi-MESH-Rescue
    Signal                 : 90%
`;
const res6 = parseInterfaceOutput(enRescue);
assert.strictEqual(res6.connected, true);
assert.strictEqual(res6.isConnecting, false);
assert.strictEqual(res6.ssid, 'Free Wi-MESH-Rescue');
console.log('  ✓ Đã kết nối Free Wi-MESH-Rescue -> connected: true');

console.log('[TEST] ==> TẤT CẢ KIỂM THỬ TRẠNG THÁI CARD MẠNG NÂNG CAO ĐẠT 100%! <==\n');
