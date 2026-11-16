const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const { generateMobileConfig, normalizeMac } = require('../ios/profile-generator');
const { parseArpMacForIp, normalizeIp, startMobileServer } = require('../src/mobile-server');
const { generateQrMatrix, renderAsciiQr } = require('../src/qr');
const scriptableMod = require('../ios/scriptable/WiFiRescue');
const hotspotMod = require('../src/hotspot');

console.log('[TEST] Kiểm thử toàn diện hệ sinh thái iPhone (iOS Suite)...');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

async function runTests() {
  // 1. Test Apple Profile Generator (.mobileconfig)
  const norm = normalizeMac('aa-bb-cc-dd-ee-ff');
  assert.strictEqual(norm.valid, true);
  assert.strictEqual(norm.macColon, 'AA:BB:CC:DD:EE:FF');
  assert.strictEqual(norm.macEsc, 'AA%3ABB%3ACC%3ADD%3AEE%3AFF');

  const xmlWithMac = generateMobileConfig({ mac: '14:ac:60:ea:a0:fb' });
  assert.ok(xmlWithMac.includes('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"'), 'Phải có DTD Apple Plist');
  assert.ok(xmlWithMac.includes('<key>CaptiveBypass</key>\n        <true/>'), 'Phải bật CaptiveBypass cho iOS');
  assert.ok(xmlWithMac.includes('<key>DisableAssociationMACRandomization</key>\n        <true/>'), 'Phải tắt đổi MAC ngẫu nhiên');
  assert.ok(xmlWithMac.includes('<string>Free Wi-MESH-Rescue</string>'), 'Phải cấu hình Free Wi-MESH-Rescue');
  assert.ok(xmlWithMac.includes('http://186.186.0.1/login?username=T-14%3AAC%3A60%3AEA%3AA0%3AFB'), 'WebClip phải trỏ đúng link Direct Login kèm MAC');

  const xmlGeneric = generateMobileConfig({ mac: 'invalid-mac' });
  assert.ok(!xmlGeneric.includes('?username=T-'), 'MAC không hợp lệ không được sinh URL kèm T- sai');
  assert.ok(xmlGeneric.includes('⚡ Wi-Fi Rescue'), 'Luôn phải có WebClip ⚡ Wi-Fi Rescue ngay cả khi không nhập MAC');
  assert.ok(xmlGeneric.includes('<key>Icon</key>') && xmlGeneric.includes('<data>'), 'WebClip phải có ảnh Icon Base64');
  assert.ok(xmlGeneric.includes('http://186.186.0.1/login') && xmlGeneric.includes('http://186.186.0.1/status'), 'Phải có cả link Login và Trạng Thái');
  console.log('  ✓ ios/profile-generator.js: DTD Plist, CaptiveBypass, DisableMACRandomization & WebClip hợp lệ');

  // 2. Test ARP parser & IP normalization
  const sampleArp = `
Interface: 186.186.10.19 --- 0x12
  Internet Address      Physical Address      Type
  186.186.0.1           f4-1d-6b-bc-0a-50     dynamic
  186.186.10.99         a4-c3-f0-11-22-33     dynamic
`;
  assert.strictEqual(normalizeIp('::ffff:186.186.10.99'), '186.186.10.99');
  assert.strictEqual(parseArpMacForIp(sampleArp, '186.186.10.99'), 'A4:C3:F0:11:22:33');
  assert.strictEqual(parseArpMacForIp(sampleArp, '186.186.10.1'), '');
  console.log('  ✓ src/mobile-server.js: Chuẩn hóa IPv6->IPv4 và tra MAC từ bảng ARP chính xác');

  // 3. Test HTTP Onboarding Server + Fallback Port on EADDRINUSE
  const blocker = http.createServer((req, res) => res.end('busy'));
  await new Promise(r => blocker.listen(0, '127.0.0.1', r));
  const busyPort = blocker.address().port;

  const { server, port } = await startMobileServer({
    host: '127.0.0.1',
    port: busyPort,
    arpLookupFn: () => 'AA:11:BB:22:CC:33',
    routerStatusFn: async () => ({ reachable: true, loggedIn: true, sessionSecondsLeft: 600 })
  });

  try {
    assert.strictEqual(port, busyPort + 1, 'Phải tự động nhảy cổng khi cổng đích đang bận');

    const homeRes = await fetchUrl(`http://127.0.0.1:${port}/`);
    assert.strictEqual(homeRes.statusCode, 200);
    assert.ok(homeRes.body.includes('Wi-Fi Rescue iOS'), 'Trang chủ phải phục vụ WebApp iOS');

    const infoRes = await fetchUrl(`http://127.0.0.1:${port}/api/client-info`);
    assert.strictEqual(infoRes.statusCode, 200);
    const infoJson = JSON.parse(infoRes.body);
    assert.strictEqual(infoJson.clientMac, 'AA:11:BB:22:CC:33');
    assert.strictEqual(infoJson.router.sessionSecondsLeft, 600);

    const profRes = await fetchUrl(`http://127.0.0.1:${port}/profile.mobileconfig`);
    assert.strictEqual(profRes.statusCode, 200);
    assert.ok(profRes.headers['content-type'].includes('application/x-apple-aspen-config'));
    assert.ok(profRes.body.includes('T-AA%3A11%3ABB%3A22%3ACC%3A33'), 'Profile động phải tự gắn MAC từ ARP');

    const profCustom = await fetchUrl(`http://127.0.0.1:${port}/profile.mobileconfig?mac=11:22:33:44:55:66`);
    assert.ok(profCustom.body.includes('T-11%3A22%3A33%3A44%3A55%3A66'));

    const scRes = await fetchUrl(`http://127.0.0.1:${port}/scriptable.js`);
    assert.strictEqual(scRes.statusCode, 200);
    assert.ok(scRes.body.includes('ListWidget'));

    const bmRes = await fetchUrl(`http://127.0.0.1:${port}/bookmarklet.txt`);
    assert.strictEqual(bmRes.statusCode, 200);
    assert.ok(bmRes.body.startsWith('javascript:'));

    const notFoundRes = await fetchUrl(`http://127.0.0.1:${port}/not-found`);
    assert.strictEqual(notFoundRes.statusCode, 404);
  } finally {
    await new Promise(r => server.close(r));
    await new Promise(r => blocker.close(r));
  }
  console.log('  ✓ src/mobile-server.js: Các endpoint HTTP & fallback cổng hoạt động 100%');

  // 4. Test Scriptable Script Logic & Syntax
  assert.strictEqual(scriptableMod.parseSessionTimeLeft('14m29s'), 869);
  const st = scriptableMod.extractRouterStatus('{"logged-in":"yes","session-time-left":"9m10s","mac-esc":"AA%3ABB"}');
  assert.strictEqual(st.loggedIn, true);
  assert.strictEqual(st.sessionSecondsLeft, 550);
  execSync('node --check "' + path.join(__dirname, '..', 'ios', 'scriptable', 'WiFiRescue.js') + '"');
  console.log('  ✓ ios/scriptable/WiFiRescue.js: Cú pháp hợp lệ & parse trạng thái router chính xác');

  // 5. Test Same-Origin Bookmarklet & WebApp & Swift files
  const injectPath = path.join(__dirname, '..', 'ios', 'bookmarklet', 'dashboard-inject.js');
  execSync('node --check "' + injectPath + '"');
  const bookmarkletTxt = fs.readFileSync(path.join(__dirname, '..', 'ios', 'bookmarklet', 'bookmarklet-url.txt'), 'utf8');
  assert.ok(bookmarkletTxt.startsWith('javascript:'));
  assert.ok(bookmarkletTxt.length < 1500, 'Bookmarklet phải ngắn gọn < 1500 ký tự để dán vừa trên Safari iOS');
  assert.strictEqual(bookmarkletTxt.match(/%[0-9a-fA-F]{2}/g), null, 'Bookmarklet không được chứa chuỗi %XX gây lỗi decode');
  new vm.Script(bookmarkletTxt.slice('javascript:'.length));

  const swiftContent = fs.readFileSync(path.join(__dirname, '..', 'ios', 'native-swift', 'WiFiRescueApp.swift'), 'utf8');
  assert.ok(swiftContent.includes('allowsCellularAccess = false') && swiftContent.includes('AVAudioPlayer'));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'ios', 'WiFi-Rescue-iOS.mobileconfig')));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'KE_HOACH_IPHONE.md')));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'cai-dat-iphone.bat')));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'bat-phat-wifi-iphone.bat')));
  console.log('  ✓ Bookmarklet, WebApp HTML, Swift Native, MobileConfig mẫu & file .bat đều hợp lệ');

  // 6. Test Offline QR Code Generator & Hotspot Exports
  const qrMatrix = generateQrMatrix('http://186.186.17.111:8888/');
  assert.strictEqual(qrMatrix.length, qrMatrix[0].length);
  assert.ok(qrMatrix.length >= 21);
  // Top-left finder corners (0,0), (0,6), (6,0), (6,6) must be dark (1)
  assert.strictEqual(qrMatrix[0][0], 1);
  assert.strictEqual(qrMatrix[0][6], 1);
  assert.strictEqual(qrMatrix[6][0], 1);
  assert.strictEqual(qrMatrix[6][6], 1);
  const asciiQr = renderAsciiQr('WIFI:T:WPA;S:PHU 7525;P:B94+n379;;');
  assert.ok(asciiQr.includes('█') && asciiQr.includes('▄'));

  assert.strictEqual(typeof hotspotMod.getHotspotStatus, 'function');
  assert.strictEqual(typeof hotspotMod.startHotspot, 'function');
  assert.strictEqual(typeof hotspotMod.stopHotspot, 'function');
  console.log('  ✓ src/qr.js & src/hotspot.js: Sinh QR ma trận chuẩn & export API Hotspot đầy đủ');

  console.log('[TEST] ==> TOÀN BỘ KIỂM THỬ HỆ SINH THÁI IPHONE ĐẠT 100%! <==\n');
}

runTests().catch(err => {
  console.error('[TEST THẤT BẠI]:', err);
  process.exit(1);
});
