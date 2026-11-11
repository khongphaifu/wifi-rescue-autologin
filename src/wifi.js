const { execSync } = require('child_process');
const http = require('http');
const config = require('./config');

/**
 * Chuyển đổi chuỗi thời gian còn lại (session-time-left) thành số giây
 * Ví dụ: "6m42s" -> 402, "45s" -> 45, "15m" -> 900
 */
function parseSessionTimeLeft(str) {
  if (!str || typeof str !== 'string') return 0;
  const clean = str.trim().toLowerCase();
  let totalSeconds = 0;

  const hoursMatch = clean.match(/(\d+)\s*h/);
  if (hoursMatch) totalSeconds += parseInt(hoursMatch[1], 10) * 3600;

  const minutesMatch = clean.match(/(\d+)\s*m/);
  if (minutesMatch) totalSeconds += parseInt(minutesMatch[1], 10) * 60;

  const secondsMatch = clean.match(/(\d+)\s*s/);
  if (secondsMatch) totalSeconds += parseInt(secondsMatch[1], 10);

  return totalSeconds;
}

/**
 * Bóc tách thông tin trạng thái từ trang status của router MikroTik / Wi-MESH
 */
function extractRouterStatus(html) {
  if (!html || typeof html !== 'string') return null;
  const loggedInMatch = html.match(/["']?logged-in["']?\s*:\s*"([^"]+)"/i);
  const timeLeftMatch = html.match(/["']?session-time-left["']?\s*:\s*"([^"]+)"/i);
  const usernameMatch = html.match(/["']?username["']?\s*:\s*"([^"]+)"/i);
  const macEscMatch = html.match(/["']?mac-esc["']?\s*:\s*"([^"]+)"/i);
  const linkLoginOnlyMatch = html.match(/["']?link-login-only["']?\s*:\s*"([^"]+)"/i);

  return {
    loggedIn: loggedInMatch ? loggedInMatch[1].toLowerCase() === 'yes' : false,
    sessionTimeLeftRaw: timeLeftMatch ? timeLeftMatch[1] : '',
    sessionSecondsLeft: timeLeftMatch ? parseSessionTimeLeft(timeLeftMatch[1]) : 0,
    username: usernameMatch ? usernameMatch[1] : '',
    macEsc: macEscMatch ? macEscMatch[1] : '',
    linkLoginOnly: linkLoginOnlyMatch ? linkLoginOnlyMatch[1] : ''
  };
}

/**
 * Lấy thông tin trạng thái Wi-Fi hiện tại của Windows
 * Phân biệt chính xác: Đã kết nối, Đang kết nối/xác thực (bận), Đã ngắt kết nối
 */
function getCurrentConnection() {
  try {
    const output = execSync('netsh wlan show interfaces', { encoding: 'utf-8', timeout: 5000 });
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

    // Phát hiện trạng thái đang bắt tay / xác thực mật khẩu / liên kết
    const isConnecting = stateLower.includes('associat') || 
                         stateLower.includes('authenticat') || 
                         stateLower.includes('xác thực') || 
                         stateLower.includes('liên kết') ||
                         (stateLower.includes('đang kết nối') && !stateLower.includes('đã'));

    // Trạng thái đã kết nối hoàn tất
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
  } catch (err) {
    return {
      connected: false,
      isConnecting: false,
      state: 'error',
      ssid: '',
      signal: '',
      error: err.message
    };
  }
}

/**
 * Lấy danh sách các mạng Wi-Fi đang quét thấy xung quanh
 */
function getVisibleNetworks() {
  try {
    const output = execSync('netsh wlan show networks', { encoding: 'utf-8', timeout: 8000 });
    const ssids = [];
    const lines = output.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('SSID') && !trimmed.startsWith('SSID BSSID')) {
        const colonIdx = trimmed.indexOf(':');
        const name = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : '';
        if (name && !ssids.includes(name)) {
          ssids.push(name);
        }
      }
    }
    return ssids;
  } catch (err) {
    return [];
  }
}

/**
 * Kết nối vào một mạng Wi-Fi chỉ định (không gọi disconnect gây delay adapter)
 */
function connectToSsid(targetSsid = config.ssid) {
  try {
    const cmd = `netsh wlan connect name="${targetSsid}" ssid="${targetSsid}"`;
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 8000 });
    const isSuccess = output.toLowerCase().includes('completed successfully') ||
                      output.toLowerCase().includes('thành công') ||
                      output.toLowerCase().includes('connection request was completed');
    return { success: isSuccess, message: output.trim() };
  } catch (err) {
    const out = err.stdout ? err.stdout.trim() : err.message;
    return { success: false, message: out };
  }
}

/**
 * Ngắt kết nối Wi-Fi thủ công nếu cần
 */
function disconnectWifi() {
  try {
    execSync('netsh wlan disconnect', { encoding: 'utf-8', timeout: 3000 });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Lấy nhanh thông tin phiên đăng nhập từ router Gateway (186.186.0.1/status)
 */
function getRouterSessionInfo() {
  return new Promise((resolve) => {
    let finished = false;
    const req = http.get(config.portalStatusUrl, { timeout: 1500 }, (res) => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
        if (data.length > 50000) { // Giới hạn kích thước bảo vệ
          req.destroy();
        }
      });
      res.on('end', () => {
        if (finished) return;
        finished = true;
        const parsed = extractRouterStatus(data);
        resolve({
          reachable: true,
          statusCode: res.statusCode,
          ...(parsed || { loggedIn: false, sessionSecondsLeft: 0 })
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      if (!finished) {
        finished = true;
        resolve({ reachable: false, loggedIn: false, sessionSecondsLeft: 0, error: 'timeout' });
      }
    });

    req.on('error', (err) => {
      if (!finished) {
        finished = true;
        resolve({ reachable: false, loggedIn: false, sessionSecondsLeft: 0, error: err.message });
      }
    });
  });
}

/**
 * Yêu cầu router đăng xuất phiên hiện tại
 */
function logoutRouter() {
  return new Promise((resolve) => {
    const req = http.get(config.portalLogoutUrl, { timeout: 2000 }, (res) => {
      resolve(true);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

/**
 * Kiểm tra kết nối Internet thực tế và phát hiện Captive Portal
 */
function checkInternetAccess(timeoutMs = 2000) {
  return new Promise((resolve) => {
    let finished = false;
    const req = http.get(config.connectivityTestUrl, {
      timeout: timeoutMs,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        finished = true;
        return resolve({
          isOnline: false,
          captiveNeeded: true,
          redirectUrl: res.headers.location || config.portalUrl,
          statusCode: res.statusCode
        });
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (finished) return;
        finished = true;
        if (res.statusCode === 200 && data.includes(config.expectedTestResponse)) {
          return resolve({ isOnline: true, captiveNeeded: false });
        } else {
          return resolve({
            isOnline: false,
            captiveNeeded: true,
            bodySnippet: data.substring(0, 100),
            statusCode: res.statusCode
          });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      if (!finished) {
        finished = true;
        checkGatewayReachable().then(gwReachable => {
          resolve({
            isOnline: false,
            captiveNeeded: gwReachable,
            error: 'timeout'
          });
        });
      }
    });

    req.on('error', (err) => {
      if (!finished) {
        finished = true;
        checkGatewayReachable().then(gwReachable => {
          resolve({
            isOnline: false,
            captiveNeeded: gwReachable,
            error: err.message
          });
        });
      }
    });
  });
}

/**
 * Kiểm tra xem router Gateway (186.186.0.1) có phản hồi không
 */
function checkGatewayReachable() {
  return new Promise((resolve) => {
    const req = http.get(config.portalUrl, { timeout: 1500 }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Thực hiện đăng nhập Trial trực tiếp qua HTTP GET tới router MikroTik / Wi-MESH
 * Tốc độ siêu tốc < 0.3s, không cần mở trình duyệt, miễn nhiễm 100% với ERR_BLOCKED_BY_CLIENT
 */
function directTrialLogin(macEscInput = null) {
  return new Promise((resolve) => {
    const execute = (macEsc, loginBaseUrl) => {
      if (!macEsc) {
        return resolve({ success: false, reason: 'Không tìm thấy MAC address' });
      }
      const baseUrl = loginBaseUrl || config.portalLoginUrl;
      const targetUrl = `${baseUrl}?username=T-${macEsc}`;
      let finished = false;

      const req = http.get(targetUrl, {
        timeout: 3000,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          if (finished) return;
          finished = true;
          const isRedirect = [301, 302, 303, 307].includes(res.statusCode);
          const hasLoggedIn = body.includes('You are logged in') || body.includes('/status');
          resolve({
            success: isRedirect || hasLoggedIn || res.statusCode === 200,
            statusCode: res.statusCode,
            url: targetUrl
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        if (!finished) {
          finished = true;
          resolve({ success: false, reason: 'timeout' });
        }
      });

      req.on('error', (err) => {
        if (!finished) {
          finished = true;
          resolve({ success: false, reason: err.message });
        }
      });
    };

    if (macEscInput) {
      execute(macEscInput, config.portalLoginUrl);
    } else {
      getRouterSessionInfo(2000).then(info => {
        const mac = (info && info.macEsc) ? info.macEsc : null;
        execute(mac, info && info.linkLoginOnly ? info.linkLoginOnly : config.portalLoginUrl);
      }).catch(() => {
        resolve({ success: false, reason: 'router unreachable' });
      });
    }
  });
}

// Nếu chạy trực tiếp file này: test chẩn đoán
if (require.main === module) {
  console.log('=== CHẨN ĐOÁN MẠNG WI-FI ===');
  const conn = getCurrentConnection();
  console.log('Trạng thái kết nối:', conn);
  
  getRouterSessionInfo().then(session => {
    console.log('Thông tin phiên Router:', session);
  });

  checkInternetAccess().then(net => {
    console.log('Trạng thái Internet:', net);
  });
}

module.exports = {
  getCurrentConnection,
  getVisibleNetworks,
  connectToSsid,
  disconnectWifi,
  getRouterSessionInfo,
  logoutRouter,
  checkInternetAccess,
  checkGatewayReachable,
  directTrialLogin,
  parseSessionTimeLeft,
  extractRouterStatus
};
