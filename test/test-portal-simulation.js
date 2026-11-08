const http = require('http');
const puppeteer = require('puppeteer-core');
const config = require('../src/config');

// Tạo mock HTTP server giả lập hành vi portal của Wi-MESH
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Wi-MESH Login Step 1</title></head>
      <body>
        <div id="root">
          <h2>Chào mừng đến với Wi-MESH</h2>
          <button id="step1-btn" class="btn btn-primary" onclick="window.location.href='/step2'">Kết nối</button>
        </div>
        <div id="wifi-info">{"logged-in":"no"}</div>
      </body>
      </html>
    `);
  } else if (req.url === '/step2') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Wi-MESH Login Step 2</title></head>
      <body>
        <div id="root">
          <h2>Trang xem quảng cáo</h2>
          <button id="trial-url" class="btn btn-dark" disabled>Kết nối Internet miễn phí sau 3s</button>
        </div>
        <script>
          let count = 3;
          const btn = document.getElementById('trial-url');
          const timer = setInterval(() => {
            count--;
            if (count > 0) {
              btn.innerText = 'Kết nối Internet miễn phí sau ' + count + 's';
            } else {
              clearInterval(timer);
              btn.disabled = false;
              btn.innerText = 'Kết nối Internet miễn phí';
              btn.onclick = () => {
                document.body.innerHTML = '<h1>ĐĂNG NHẬP THÀNH CÔNG</h1>';
                window.loginSuccess = true;
              };
            }
          }, 1000);
        </script>
      </body>
      </html>
    `);
  } else {
    res.writeHead(404);
    res.end();
  }
});

async function runSimulation() {
  await new Promise(r => server.listen(8999, r));
  console.log('[MOCK SERVER] Đã khởi động tại http://127.0.0.1:8999');

  const originalUrl = config.portalUrl;
  config.portalUrl = 'http://127.0.0.1:8999/';

  const { solveCaptivePortal } = require('../src/portal');
  console.log('[TEST] Đang chạy solveCaptivePortal đối với mock server...');
  
  const result = await solveCaptivePortal({ headless: true });
  console.log('[TEST] Kết quả solveCaptivePortal:', result);

  config.portalUrl = originalUrl;
  server.close();

  if (result.success) {
    console.log('[TEST] ==> GIẢ LẬP CAPTIVE PORTAL 2 BƯỚC THÀNH CÔNG RỰC RỠ! <==');
  } else {
    console.error('[TEST] ==> GIẢ LẬP THẤT BẠI <==');
    process.exit(1);
  }
}

runSimulation().catch(err => {
  console.error(err);
  server.close();
  process.exit(1);
});
