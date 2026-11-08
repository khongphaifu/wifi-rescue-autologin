const http = require('http');
const config = require('../src/config');

let isInternetGranted = false;

// Mock server giả lập chính xác chuỗi tương tác thực tế của Wi-MESH
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html><body>
        <div id="root">
          <button id="step1-btn" class="btn" onclick="window.location.href='/step2'">Kết nối</button>
        </div>
        <div id="wifi-info">{"logged-in":"no"}</div>
      </body></html>
    `);
  } else if (req.url === '/step2') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html><body>
        <div id="root">
          <a id="trial-url" class="btn" href="/do-login">kết nối internet sau\\n(connecting in) 3s</a>
        </div>
        <script>
          let sec = 3;
          const a = document.getElementById('trial-url');
          const timer = setInterval(() => {
            sec--;
            if (sec > 0) {
              a.innerText = 'kết nối internet sau\\n(connecting in) ' + sec + 's';
            } else {
              clearInterval(timer);
              a.innerText = 'kết nối internet miễn phí';
            }
          }, 1000);
        </script>
      </body></html>
    `);
  } else if (req.url === '/do-login') {
    isInternetGranted = true;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Logged In</h1>');
  } else if (req.url === '/connecttest.txt') {
    if (isInternetGranted) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Microsoft Connect Test');
    } else {
      res.writeHead(302, { 'Location': 'http://127.0.0.1:8997/' });
      res.end();
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

async function runTwoStepRealTest() {
  await new Promise(r => server.listen(8997, r));
  console.log('[MOCK SERVER] Server running on 8997');

  const origPortal = config.portalUrl;
  const origTest = config.connectivityTestUrl;
  config.portalUrl = 'http://127.0.0.1:8997/';
  config.connectivityTestUrl = 'http://127.0.0.1:8997/connecttest.txt';

  const { solveCaptivePortal } = require('../src/portal');
  const result = await solveCaptivePortal({ headless: true });
  console.log('[TEST] Kết quả solveCaptivePortal:', result);

  config.portalUrl = origPortal;
  config.connectivityTestUrl = origTest;
  server.close();

  if (result.success && isInternetGranted) {
    console.log('[TEST] ==> KIỂM THỬ KHỚP CHÍNH XÁC ĐỊNH DẠNG ĐẾM NGƯỢC THÀNH CÔNG 100%! <==');
  } else {
    console.error('[TEST] ==> KIỂM THỬ THẤT BẠI <==');
    process.exit(1);
  }
}

runTwoStepRealTest().catch(err => {
  console.error(err);
  server.close();
  process.exit(1);
});
