const assert = require('assert');
const http = require('http');
const config = require('../src/config');
const { directTrialLogin } = require('../src/wifi');

console.log('[TEST] Kiểm tra hàm directTrialLogin...');

let serverHit = false;
let receivedUsername = '';

const mockServer = http.createServer((req, res) => {
  serverHit = true;
  const url = new URL(req.url, 'http://127.0.0.1:8996');
  receivedUsername = url.searchParams.get('username');

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<html><body><h1>You are logged in</h1></body></html>');
});

async function runTest() {
  await new Promise(r => mockServer.listen(8996, r));
  
  const origLoginUrl = config.portalLoginUrl;
  config.portalLoginUrl = 'http://127.0.0.1:8996/login';

  const result = await directTrialLogin('14%3AAC%3A60%3AEA%3AA0%3AFB');

  config.portalLoginUrl = origLoginUrl;
  mockServer.close();

  assert.strictEqual(serverHit, true, 'Mock server phải được gọi');
  assert.strictEqual(receivedUsername, 'T-14:AC:60:EA:A0:FB', 'Username nhận được phải là T- và MAC');
  assert.strictEqual(result.success, true, 'Đăng nhập direct phải báo success: true');

  console.log('  ✓ Đã gọi đúng URL đăng nhập trực tiếp với MAC');
  console.log('  ✓ Phản hồi đăng nhập thành công không cần trình duyệt');
  console.log('[TEST] ==> KIỂM THỬ directTrialLogin ĐẠT 100%! <==\n');
}

runTest().catch(err => {
  console.error(err);
  mockServer.close();
  process.exit(1);
});
