const fs = require('fs');
const path = require('path');
const config = require('./config');
const {
  getCurrentConnection,
  getRouterSessionInfo,
  checkInternetAccess
} = require('./wifi');

const PID_FILE = path.join(__dirname, '..', 'wifi-rescue.pid');

// Màu sắc ANSI hiển thị trên Terminal Windows
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightRed: '\x1b[91m',
  brightCyan: '\x1b[96m'
};

function formatDuration(totalSeconds) {
  if (totalSeconds == null || totalSeconds < 0) return '0 giây';
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    return `${h} giờ ${m.toString().padStart(2, '0')} phút ${s.toString().padStart(2, '0')} giây`;
  }
  if (m > 0) {
    return `${m} phút ${s.toString().padStart(2, '0')} giây`;
  }
  return `${s} giây`;
}

function renderProgressBar(seconds, maxSeconds = 900, width = 30) {
  const clamped = Math.max(0, Math.min(maxSeconds, seconds));
  const pct = Math.round((clamped / maxSeconds) * 100);
  const filled = Math.round((clamped / maxSeconds) * width);
  const empty = width - filled;

  let color = C.brightGreen;
  if (clamped <= 60) {
    color = C.brightRed;
  } else if (clamped <= 180) {
    color = C.brightYellow;
  }

  const bar = `${color}${'█'.repeat(filled)}${C.dim}${'░'.repeat(empty)}${C.reset}`;
  return { bar, pct };
}

function getDaemonInfo() {
  try {
    if (!fs.existsSync(PID_FILE)) {
      return { isRunning: false, pid: null };
    }
    const pidStr = fs.readFileSync(PID_FILE, 'utf-8').trim();
    const pid = parseInt(pidStr, 10);
    if (!pid) return { isRunning: false, pid: null };
    process.kill(pid, 0); // Kiểm tra tiến trình còn sống
    return { isRunning: true, pid };
  } catch (e) {
    return { isRunning: false, pid: null };
  }
}

function setConsoleTitle(title) {
  try {
    process.stdout.write(`\x1b]0;${title}\x07`);
  } catch (e) {}
}

async function renderDashboard(state) {
  const {
    conn,
    session,
    net,
    daemon,
    localSecondsLeft,
    lastSyncTime,
    isSyncing
  } = state;

  const lines = [];
  const width = 64;
  const hr = '─'.repeat(width);
  const dblHr = '═'.repeat(width);

  lines.push(`${C.cyan}${dblHr}${C.reset}`);
  lines.push(`  ${C.bold}${C.brightCyan}BẢNG THEO DÕI THỜI GIAN WI-FI RESCUE (REAL-TIME STATUS)${C.reset}`);
  lines.push(`${C.cyan}${dblHr}${C.reset}`);

  // Dòng trạng thái tiến trình nền
  if (daemon.isRunning) {
    lines.push(`  🛡️  ${C.bold}Dịch vụ chạy ngầm${C.reset} : ${C.brightGreen}● ĐANG HOẠT ĐỘNG${C.reset} (PID: ${daemon.pid})`);
  } else {
    lines.push(`  🛡️  ${C.bold}Dịch vụ chạy ngầm${C.reset} : ${C.yellow}○ Chưa khởi động${C.reset} (Chạy start.bat để bật)`);
  }

  // Dòng Wi-Fi
  if (conn.isConnecting) {
    lines.push(`  📶  ${C.bold}Mạng Wi-Fi${C.reset}        : ${C.yellow}Đang liên kết / xác thực mật khẩu...${C.reset}`);
  } else if (conn.connected) {
    const isTarget = conn.ssid === config.ssid || config.fallbackSsids.includes(conn.ssid);
    const ssidColor = isTarget ? C.brightCyan : C.brightGreen;
    lines.push(`  📶  ${C.bold}Mạng Wi-Fi${C.reset}        : ${ssidColor}${C.bold}${conn.ssid}${C.reset} (Cường độ sóng: ${conn.signal})`);
  } else {
    lines.push(`  📶  ${C.bold}Mạng Wi-Fi${C.reset}        : ${C.brightRed}Đã ngắt kết nối (Chưa có Wi-Fi)${C.reset}`);
  }

  // Dòng Internet
  if (net && net.isOnline) {
    lines.push(`  🌐  ${C.bold}Trạng thái mạng${C.reset}   : ${C.brightGreen}HOẠT ĐỘNG TỐT (Online)${C.reset}`);
  } else if (net && net.captiveNeeded) {
    lines.push(`  🌐  ${C.bold}Trạng thái mạng${C.reset}   : ${C.brightYellow}Cần đăng nhập Captive Portal${C.reset}`);
  } else {
    lines.push(`  🌐  ${C.bold}Trạng thái mạng${C.reset}   : ${C.yellow}Đang kiểm tra / Chưa thông Internet${C.reset}`);
  }

  lines.push(`${C.cyan}${hr}${C.reset}`);

  // Phần hiển thị thời gian còn lại
  const isTargetSsid = conn.connected && (conn.ssid === config.ssid || config.fallbackSsids.includes(conn.ssid));

  if (isTargetSsid) {
    if (session && session.loggedIn) {
      const sec = localSecondsLeft != null ? localSecondsLeft : session.sessionSecondsLeft;
      const formatted = formatDuration(sec);
      const { bar, pct } = renderProgressBar(sec, 900, 28);

      let timeColor = C.brightGreen;
      let statusHint = `${C.dim}Tự động gia hạn ngầm khi còn dưới ${config.proactiveRenewSeconds} giây${C.reset}`;

      if (sec <= config.proactiveRenewSeconds) {
        timeColor = C.brightYellow;
        statusHint = `${C.brightYellow}⚡ Đang trong ngưỡng tự động gia hạn (Proactive Renewal)...${C.reset}`;
      } else if (sec <= 180) {
        timeColor = C.brightYellow;
      }

      lines.push(`  ⏳  ${C.bold}THỜI GIAN PHIÊN CÒN LẠI:${C.reset}`);
      lines.push(``);
      lines.push(`      ${C.bold}${timeColor}▶▶  ${formatted.toUpperCase()}  ◀◀${C.reset}  (${sec}s)`);
      lines.push(``);
      lines.push(`      Tiến trình: [${bar}] ${C.bold}${pct}%${C.reset} (Phiên 15p)`);
      lines.push(``);
      lines.push(`  💡  ${statusHint}`);
      lines.push(`  👤  ${C.dim}Tài khoản: ${session.username || 'awing'} | Router: ${session.statusCode === 200 ? 'Sẵn sàng (186.186.0.1)' : 'Bận'}${C.reset}`);

      // Cập nhật tiêu đề cửa sổ CMD
      setConsoleTitle(`[${formatted}] Wi-Fi Rescue Monitor`);
    } else if (session && session.reachable) {
      lines.push(`  ⏳  ${C.bold}THỜI GIAN PHIÊN CÒN LẠI:${C.reset}`);
      lines.push(`      ${C.yellow}Chưa đăng nhập portal (Trang đăng nhập đang sẵn sàng)${C.reset}`);
      lines.push(`      Dịch vụ nền sẽ tự động đăng nhập khi phát hiện.`);
      setConsoleTitle(`[Cần Đăng Nhập] Wi-Fi Rescue Monitor`);
    } else {
      lines.push(`  ⏳  ${C.bold}THỜI GIAN PHIÊN CÒN LẠI:${C.reset}`);
      lines.push(`      ${C.dim}Đang kết nối tới gateway router 186.186.0.1...${C.reset}`);
      setConsoleTitle(`[Đang kết nối...] Wi-Fi Rescue Monitor`);
    }
  } else if (conn.connected) {
    lines.push(`  ℹ️  ${C.bold}THÔNG TIN MẠNG ƯU TIÊN:${C.reset}`);
    lines.push(`      Bạn đang kết nối Wi-Fi riêng: ${C.brightGreen}${C.bold}"${conn.ssid}"${C.reset}`);
    lines.push(`      ${C.cyan}Mạng này không giới hạn phiên 15 phút của Wi-MESH.${C.reset}`);
    lines.push(`      Dịch vụ cứu hộ đang ở chế độ nhường quyền (Ưu tiên thấp nhất).`);
    setConsoleTitle(`[${conn.ssid}] Wi-Fi Rescue Monitor`);
  } else {
    lines.push(`  ⚠️  ${C.bold}TRẠNG THÁI MẤT KẾT NỐI:${C.reset}`);
    lines.push(`      Máy tính hiện chưa kết nối Wi-Fi nào.`);
    lines.push(`      Dịch vụ cứu hộ sẽ quét sóng Wi-MESH sau 12 giây ân hạn.`);
    setConsoleTitle(`[Mất kết nối] Wi-Fi Rescue Monitor`);
  }

  lines.push(`${C.cyan}${hr}${C.reset}`);

  const syncIndicator = isSyncing ? `${C.yellow}⟳ Đang đồng bộ...${C.reset}` : `${C.dim}Đồng bộ lúc: ${lastSyncTime || '--:--:--'}${C.reset}`;
  lines.push(`  ${syncIndicator}  |  ${C.bold}Nhấn Ctrl+C để đóng cửa sổ này${C.reset}`);
  lines.push(`${C.cyan}${dblHr}${C.reset}`);

  return lines.join('\n');
}

async function runOnce() {
  const daemon = getDaemonInfo();
  const conn = getCurrentConnection();
  let session = null;
  let net = null;

  try {
    session = await getRouterSessionInfo(2000);
  } catch (e) {}

  try {
    net = await checkInternetAccess(2000);
  } catch (e) {}

  const state = {
    conn,
    session,
    net,
    daemon,
    localSecondsLeft: session ? session.sessionSecondsLeft : null,
    lastSyncTime: new Date().toLocaleTimeString('vi-VN'),
    isSyncing: false
  };

  const output = await renderDashboard(state);
  console.log(output);
}

async function runLive() {
  let daemon = getDaemonInfo();
  let conn = getCurrentConnection();
  let session = null;
  let net = null;
  let localSecondsLeft = null;
  let lastSyncTime = null;
  let isSyncing = false;

  // Hàm đồng bộ thông tin từ card mạng và router
  async function syncStatus() {
    isSyncing = true;
    try {
      daemon = getDaemonInfo();
      conn = getCurrentConnection();
      
      const isTarget = conn.connected && (conn.ssid === config.ssid || config.fallbackSsids.includes(conn.ssid));
      if (isTarget) {
        session = await getRouterSessionInfo(2500);
        if (session && session.loggedIn && session.sessionSecondsLeft > 0) {
          localSecondsLeft = session.sessionSecondsLeft;
        }
      } else {
        session = null;
        localSecondsLeft = null;
      }
      net = await checkInternetAccess(1500);
      lastSyncTime = new Date().toLocaleTimeString('vi-VN');
    } catch (e) {}
    isSyncing = false;
  }

  // Đồng bộ lần đầu
  await syncStatus();

  // Chu kỳ đồng bộ ngầm với router mỗi 5 giây
  setInterval(async () => {
    await syncStatus();
  }, 5000);

  // Chu kỳ đếm ngược mượt mà từng 1 giây trên màn hình
  setInterval(async () => {
    if (localSecondsLeft != null && localSecondsLeft > 0) {
      localSecondsLeft--;
    }

    const screen = await renderDashboard({
      conn,
      session,
      net,
      daemon,
      localSecondsLeft,
      lastSyncTime,
      isSyncing
    });

    // Vẽ lại màn hình mượt mà bằng ANSI escape codes
    process.stdout.write('\x1b[2J\x1b[H' + screen + '\n');
  }, 1000);

  // Vẽ lần đầu ngay lập tức
  const initialScreen = await renderDashboard({
    conn,
    session,
    net,
    daemon,
    localSecondsLeft,
    lastSyncTime,
    isSyncing
  });
  process.stdout.write('\x1b[2J\x1b[H' + initialScreen + '\n');
}

// Xử lý tham số dòng lệnh
if (process.argv.includes('--once')) {
  runOnce();
} else {
  runLive();
}
