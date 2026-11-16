const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { URL } = require('url');
const { generateMobileConfig, normalizeMac } = require('../ios/profile-generator');
const { getRouterSessionInfo } = require('./wifi');
const { renderAsciiQr } = require('./qr');

const IOS_DIR = path.join(__dirname, '..', 'ios');
const WEBAPP_PATH = path.join(IOS_DIR, 'webapp', 'index.html');
const SCRIPTABLE_PATH = path.join(IOS_DIR, 'scriptable', 'WiFiRescue.js');
const BOOKMARKLET_PATH = path.join(IOS_DIR, 'bookmarklet', 'bookmarklet-url.txt');

/**
 * Clean IPv4 address from Node socket remoteAddress (strips ::ffff: prefix).
 */
function normalizeIp(ip) {
  if (!ip) return '';
  if (ip === '::1') return '127.0.0.1';
  return ip.startsWith('::ffff:') ? ip.substring(7) : ip;
}

/**
 * Parse Windows `arp -a` output to resolve the MAC address for a given LAN IPv4.
 */
function parseArpMacForIp(arpOutput, targetIp) {
  if (!arpOutput || !targetIp) return '';
  const escapedIp = targetIp.replace(/\./g, '\\.');
  const regex = new RegExp(`^\\s*${escapedIp}\\s+([0-9a-fA-F]{2}(?:[:-][0-9a-fA-F]{2}){5})\\b`, 'm');
  const match = arpOutput.match(regex);
  if (!match) return '';
  const norm = normalizeMac(match[1]);
  return norm.valid ? norm.macColon : '';
}

function defaultArpLookup(ip) {
  const cleanIp = normalizeIp(ip);
  if (!cleanIp || cleanIp === '127.0.0.1') return '';
  try {
    const out = execSync('arp -a', { encoding: 'utf-8', timeout: 2500 });
    return parseArpMacForIp(out, cleanIp);
  } catch (e) {
    return '';
  }
}

/**
 * Find best candidate LAN IPv4 addresses on this PC (preferring Wi-Fi / Hotspot over virtual adapters).
 */
function getLocalLanIps() {
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const info of addrs) {
      if (info.family === 'IPv4' && !info.internal) {
        const lowerName = name.toLowerCase();
        const isVirtual = lowerName.includes('virtual') || lowerName.includes('vmware') ||
                          lowerName.includes('vbox') || lowerName.includes('vethernet') ||
                          lowerName.includes('wsl') || info.address.startsWith('169.254.');
        const isWifiOrHotspot = lowerName.includes('wi-fi') || lowerName.includes('wlan') ||
                                lowerName.includes('local area connection*');
        candidates.push({
          name,
          address: info.address,
          score: isWifiOrHotspot ? 3 : (isVirtual ? 0 : 2)
        });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendFile(res, filePath, contentType, extraHeaders = {}) {
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      ...extraHeaders
    });
    res.end(content);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('File not found: ' + path.basename(filePath));
  }
}

/**
 * Create the local HTTP setup server for iPhone onboarding via QR code.
 */
function createMobileServer(options = {}) {
  const arpLookup = options.arpLookupFn || defaultArpLookup;
  const routerStatusFn = options.routerStatusFn || (() => getRouterSessionInfo(1500));

  return http.createServer(async (req, res) => {
    const hostHeader = req.headers.host || '127.0.0.1:8888';
    const parsedUrl = new URL(req.url || '/', `http://${hostHeader}`);
    const pathname = parsedUrl.pathname;
    const clientIp = normalizeIp(req.socket.remoteAddress);

    if (pathname === '/' || pathname === '/index.html') {
      return sendFile(res, WEBAPP_PATH, 'text/html; charset=utf-8');
    }

    if (pathname === '/api/client-info') {
      const clientMac = arpLookup(clientIp);
      let router = null;
      try {
        router = await routerStatusFn();
      } catch (e) {}
      return sendJson(res, 200, { clientIp, clientMac, router });
    }

    if (pathname === '/profile.mobileconfig') {
      const queryMac = parsedUrl.searchParams.get('mac') || '';
      const normQuery = normalizeMac(queryMac);
      const effectiveMac = normQuery.valid ? normQuery.macColon : arpLookup(clientIp);
      const xml = generateMobileConfig({ mac: effectiveMac });

      res.writeHead(200, {
        'Content-Type': 'application/x-apple-aspen-config; charset=utf-8',
        'Content-Disposition': 'attachment; filename="WiFi-Rescue-iOS.mobileconfig"',
        'Cache-Control': 'no-store'
      });
      return res.end(xml);
    }

    if (pathname === '/scriptable.js') {
      return sendFile(res, SCRIPTABLE_PATH, 'application/javascript; charset=utf-8', {
        'Content-Disposition': 'attachment; filename="WiFiRescue.js"'
      });
    }

    if (pathname === '/bookmarklet.txt') {
      return sendFile(res, BOOKMARKLET_PATH, 'text/plain; charset=utf-8');
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });
}

/**
 * Start mobile setup server on requested port, falling back cleanly if port is busy.
 */
function startMobileServer(options = {}) {
  const startPort = options.port !== undefined ? options.port : 8888;
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 10;
  const host = options.host || '0.0.0.0';

  return new Promise((resolve, reject) => {
    let attempt = 0;

    function tryListen(port) {
      const server = createMobileServer(options);
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && port !== 0 && attempt < maxRetries) {
          attempt++;
          tryListen(port + 1);
        } else {
          reject(err);
        }
      });
      server.listen(port, host, () => {
        const addr = server.address();
        resolve({ server, port: addr.port });
      });
    }

    tryListen(startPort);
  });
}

if (require.main === module) {
  startMobileServer({ port: 8888 }).then(({ port }) => {
    const ips = getLocalLanIps();
    const primaryIp = ips.length > 0 ? ips[0].address : '127.0.0.1';
    const setupUrl = `http://${primaryIp}:${port}/`;

    console.log('==============================================================');
    console.log('   SERVER CÀI ĐẶT WI-FI RESCUE CHO IPHONE (QR ONBOARDING)');
    console.log('==============================================================');
    console.log(`  Địa chỉ cài đặt : ${setupUrl}`);
    if (ips.length > 1) {
      console.log('  Địa chỉ dự phòng:');
      for (const item of ips.slice(1, 3)) {
        console.log(`    - http://${item.address}:${port}/ (${item.name})`);
      }
    }
    console.log('\n  [HƯỚNG DẪN CÀI TRÊN IPHONE]');
    console.log('  1. Đảm bảo iPhone và Laptop dùng chung Wi-Fi (hoặc bắt Hotspot Laptop).');
    console.log('  2. Mở Camera iPhone -> Quét mã QR bên dưới để mở trang cài đặt:\n');
    try {
      console.log(renderAsciiQr(setupUrl));
    } catch (e) {
      console.log(`  (Mở Safari trên iPhone và truy cập: ${setupUrl})`);
    }
    console.log('\n  3. Trên iPhone: Bấm "Tải Cấu Hình Wi-Fi 1-Chạm" -> Cài đặt hồ sơ.');
    console.log('  4. Nhấn Ctrl+C trên cửa sổ này để tắt Server sau khi cài xong.');
    console.log('==============================================================');
  }).catch((err) => {
    console.error('[LỖI] Không thể khởi động Mobile Server:', err.message);
    process.exit(1);
  });
}

module.exports = {
  normalizeIp,
  parseArpMacForIp,
  getLocalLanIps,
  createMobileServer,
  startMobileServer
};
