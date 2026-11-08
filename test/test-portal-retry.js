const http = require('http');
const config = require('../src/config');

let requestCount = 0;

const server = http.createServer((req, res) => {
  requestCount++;
  console.log(`[MOCK SERVER] Nhận request lần thứ ${requestCount}`);
  
  if (requestCount === 1) {
    // Lần 1: Giả lập lỗi 502
    res.writeHead(502);
    res.end('Bad Gateway');
  } else if (requestCount === 2) {
    // Lần 2: Giả lập timeout / reset connection
    req.socket.destroy();
  } else {
    // Lần 3 trở đi: Trả về trang portal hợp lệ
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html><body>
        <div id="root">
          <button id="trial-url" onclick="document.body.innerHTML='SUCCESS'">Kết nối</button>
        </div>
      </body></html>
    `);
  }
});

async function runRetryTest() {
  await new Promise(r => server.listen(8998, r));
  console.log('[MOCK SERVER] Retry test server listening on 8998');

  const originalUrl = config.portalUrl;
  config.portalUrl = 'http://127.0.0.1:8998/';

  const { solveCaptivePortal } = require('../src/portal');
  const result = await solveCaptivePortal({ headless: true });
  console.log('[TEST] Kết quả retry test:', result);

  config.portalUrl = originalUrl;
  server.close();

  if (requestCount >= 3 && result.success) {
    console.log('[TEST] ==> KIỂM THỬ TỰ ĐỘNG THỬ LẠI (RETRY) KHI LỖI MẠNG ĐẠT 100%! <==');
  } else {
    console.error('[TEST] ==> KIỂM THỬ THẤT BẠI <==');
    process.exit(1);
  }
}

runRetryTest().catch(err => {
  console.error(err);
  server.close();
  process.exit(1);
});
