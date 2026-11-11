const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./config');
const {
  getCurrentConnection,
  getVisibleNetworks,
  connectToSsid,
  disconnectWifi,
  checkInternetAccess,
  getRouterSessionInfo,
  logoutRouter
} = require('./wifi');
const { solveCaptivePortal } = require('./portal');

const LOCK_FILE = path.join(__dirname, '..', 'wifi-rescue.pid');
const LOG_FILE = path.join(__dirname, '..', 'activity.log');

function log(msg) {
  const time = new Date().toLocaleString('vi-VN');
  const line = `[${time}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf-8');
  } catch (e) {}
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkSingleInstance() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const content = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
      const existingPid = parseInt(content, 10);
      if (existingPid && existingPid !== process.pid) {
        process.kill(existingPid, 0); // Kiểm tra PID còn sống không
        try {
          const out = execSync(`powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId = ${existingPid}').CommandLine"`, {
            encoding: 'utf-8',
            timeout: 2500
          });
          if (out.includes('index.js') || out.includes('wifi-rescue')) {
            console.log(`[THÔNG BÁO] Wi-Fi Rescue (PID: ${existingPid}) đang chạy ngầm rồi. Tiến trình này tự động dừng.`);
            process.exit(0);
          }
        } catch (e) {
          console.log(`[THÔNG BÁO] Tiến trình PID ${existingPid} đang hoạt động. Dừng tiến trình mới.`);
          process.exit(0);
        }
      }
    } catch (e) {
      // Tiến trình cũ không tồn tại (ESRCH), an toàn tiếp tục
    }
  }
}

function writePid() {
  try {
    fs.writeFileSync(LOCK_FILE, process.pid.toString(), 'utf-8');
  } catch (e) {}
}

function removePid() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (e) {}
}

process.on('uncaughtException', (err) => {
  log(`[UNCAUGHT ERROR] ${err.stack || err.message}`);
});

process.on('unhandledRejection', (reason) => {
  log(`[UNHANDLED REJECTION] ${reason}`);
});

process.on('SIGINT', () => {
  log('Đang dừng dịch vụ (SIGINT)...');
  removePid();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Đang dừng dịch vụ (SIGTERM)...');
  removePid();
  process.exit(0);
});

async function runDaemon() {
  checkSingleInstance();
  writePid();
  log('================================================================');
  log(`BẮT ĐẦU DỊCH VỤ TỰ ĐỘNG KẾT NỐI WI-FI V2.4 (DUAL-ENGINE SIÊU TỐC): "${config.ssid}"`);
  log(`PID: ${process.pid} | Trình duyệt: ${config.chromePath}`);
  log(`Cơ chế: Chỉ gửi tín hiệu khi CÓ SÓNG | Độ ưu tiên thấp nhất | Ân hạn 12s | Chống spam`);
  log('================================================================');

  let wasOnline = null;
  let wasOtherWifi = null;
  let heartBeatCount = 0;
  let isResolvingPortal = false;

  let disconnectedSince = null;        // Thời điểm bắt đầu mất kết nối
  let lastRescueConnectAttempt = 0;     // Lần gửi lệnh kết nối cứu hộ gần nhất
  let otherWifiFailCount = 0;          // Số lần mất mạng liên tiếp trên mạng ưu tiên

  const meshCandidates = [config.ssid, ...config.fallbackSsids];

  while (true) {
    try {
      const conn = getCurrentConnection();

      // 1. TRƯỜNG HỢP: Card mạng đang bận bắt tay / liên kết / xác thực mật khẩu
      // Tuyệt đối KHÔNG CAN THIỆP để người dùng thoải mái nhập mật khẩu mạng mới!
      if (conn.isConnecting) {
        disconnectedSince = null;
        log(`[ĐANG KẾT NỐI] Windows đang bắt tay kết nối mạng ("${conn.state}"). Đứng chờ, không can thiệp...`);
        await sleep(2500);
        continue;
      }

      const isTargetSsid = conn.connected && (conn.ssid === config.ssid || config.fallbackSsids.includes(conn.ssid));

      // 2. TRƯỜNG HỢP: Đang kết nối một mạng Wi-Fi khác (ưu tiên hơn)
      if (conn.connected && !isTargetSsid) {
        disconnectedSince = null; // Đang có mạng -> reset thời gian ân hạn

        const otherNet = await checkInternetAccess(2000);
        if (otherNet.isOnline) {
          otherWifiFailCount = 0; // Reset bộ đếm lỗi
          if (wasOtherWifi !== conn.ssid) {
            log(`[ƯU TIÊN MẠNG KHÁC] Đang kết nối "${conn.ssid}" (Tín hiệu: ${conn.signal}). Internet HOẠT ĐỘNG TỐT -> Giữ nguyên, không can thiệp.`);
            wasOtherWifi = conn.ssid;
            wasOnline = true;
          }
          await sleep(config.checkIntervalMs);
          continue;
        } else {
          // Chưa có Internet (có thể vừa kết nối đang xin IP hoặc mạng chập chờn)
          otherWifiFailCount++;
          log(`[CẢNH BÁO MẠNG] Mạng ưu tiên "${conn.ssid}" chưa thông Internet (lần ${otherWifiFailCount}/${config.otherWifiFailThreshold}). Chờ ổn định...`);

          if (otherWifiFailCount >= config.otherWifiFailThreshold) {
            // Mất mạng liên tục -> Quét xem có sóng Wi-MESH xung quanh không trước khi gửi lệnh
            const visible = getVisibleNetworks();
            const detectedMesh = visible.find(s => meshCandidates.includes(s));

            if (detectedMesh) {
              log(`[CỨU HỘ MẠNG] Mạng ưu tiên "${conn.ssid}" mất Internet và PHÁT HIỆN CÓ SÓNG "${detectedMesh}". Tự động chuyển sang cứu hộ...`);
              wasOtherWifi = null;
              otherWifiFailCount = 0;
              connectToSsid(detectedMesh);
              await sleep(config.reconnectWaitMs);
            } else {
              log(`[CỨU HỘ MẠNG] Mạng ưu tiên "${conn.ssid}" mất Internet NHƯNG xung quanh KHÔNG CÓ sóng Wi-MESH. Tiếp tục chờ, không gửi lệnh vô ích.`);
              await sleep(4000);
            }
          } else {
            await sleep(3500);
          }
          continue;
        }
      }

      // 3. TRƯỜNG HỢP: Hoàn toàn mất kết nối Wi-Fi (Chưa kết nối mạng nào)
      if (!conn.connected) {
        wasOtherWifi = null;
        wasOnline = false;
        heartBeatCount = 0;
        otherWifiFailCount = 0;

        const now = Date.now();
        if (!disconnectedSince) {
          disconnectedSince = now;
          log(`[MẤT KẾT NỐI] Wi-Fi vừa bị ngắt. Bắt đầu thời gian ân hạn ${config.disconnectGracePeriodMs / 1000}s để Windows hoặc người dùng tự do kết nối...`);
        }

        const disconnectedDuration = now - disconnectedSince;
        if (disconnectedDuration < config.disconnectGracePeriodMs) {
          // Đang trong thời gian ân hạn (Grace Period): để người dùng hoặc Windows tự kết nối mạng quen thuộc
          await sleep(config.fastCheckIntervalMs);
          continue;
        }

        // Đã hết ân hạn mà vẫn không có kết nối nào -> Quét sóng Wi-MESH xung quanh!
        const visible = getVisibleNetworks();
        const detectedMesh = visible.find(s => meshCandidates.includes(s));

        if (!detectedMesh) {
          // Xung quanh KHÔNG CÓ sóng Wi-MESH -> Tuyệt đối KHÔNG gửi tín hiệu kết nối!
          log(`[KHÔNG CÓ SÓNG WI-MESH] Không có Wi-Fi, nhưng xung quanh KHÔNG tìm thấy sóng Wi-MESH ("${config.ssid}"). Giữ yên lặng, không gửi lệnh kết nối.`);
          await sleep(5000); // Nghỉ 5s rồi quét lại, không gây tốn pin/CPU
          continue;
        }

        // Có sóng Wi-MESH trong vùng phủ sóng! Kiểm tra rate-limit trước khi gửi lệnh
        const timeSinceLastAttempt = now - lastRescueConnectAttempt;
        if (timeSinceLastAttempt < config.connectRateLimitMs) {
          await sleep(config.fastCheckIntervalMs);
          continue;
        }

        lastRescueConnectAttempt = now;
        log(`[PHÁT HIỆN SÓNG WI-MESH] Tìm thấy sóng "${detectedMesh}" xung quanh. Đang gửi tín hiệu kết nối cứu hộ...`);

        const res = connectToSsid(detectedMesh);
        if (res.success) {
          log(`Đã gửi lệnh kết nối tới "${detectedMesh}". Chờ cấp IP...`);
          await sleep(config.reconnectWaitMs);
        }

        await sleep(config.fastCheckIntervalMs);
        continue;
      }

      // 4. TRƯỜNG HỢP: Đã kết nối vào đúng mạng "Free Wi-MESH-Rescue" (hoặc fallback)
      wasOtherWifi = null;
      disconnectedSince = null;
      otherWifiFailCount = 0;

      const routerSession = await getRouterSessionInfo();

      if (routerSession.reachable) {
        if (routerSession.loggedIn) {
          // Phiên đang hoạt động
          // Kiểm tra Gia Hạn Chủ Động (Proactive Renewal)
          if (routerSession.sessionSecondsLeft > 0 && routerSession.sessionSecondsLeft <= config.proactiveRenewSeconds) {
            log(`[GIA HẠN CHỦ ĐỘNG] Phiên chỉ còn ${routerSession.sessionSecondsLeft}s (Dưới ngưỡng ${config.proactiveRenewSeconds}s). Tự động gia hạn trước khi router ngắt mạng!`);
            isResolvingPortal = true;

            // Đăng xuất sạch phiên cũ qua HTTP trước
            await logoutRouter();
            await sleep(800);

            const renewResult = await solveCaptivePortal({ headless: config.headless, proactive: false });
            isResolvingPortal = false;

            if (renewResult.success) {
              log(`[GIA HẠN THÀNH CÔNG] Đã gia hạn phiên 15 phút thành công mượt mà!`);
            } else {
              log(`[GIA HẠN] Chưa xong (${renewResult.error || 'thử lại'}), tiếp tục theo dõi...`);
              await sleep(2500);
            }
            await sleep(config.fastCheckIntervalMs);
            continue;
          }

          // Phiên dồi dào thời gian
          if (wasOnline !== true) {
            log(`[MẠNG TỐT] Đã kết nối "${conn.ssid}" (Tín hiệu: ${conn.signal}) | Phiên còn: ${routerSession.sessionTimeLeftRaw}.`);
            wasOnline = true;
          }

          heartBeatCount++;
          if (heartBeatCount >= 10) { // Mỗi ~30s log 1 lần
            heartBeatCount = 0;
            log(`[Đang chạy] Wi-Fi: "${conn.ssid}" (${conn.signal}) | Thời gian phiên còn: ${routerSession.sessionTimeLeftRaw}`);
          }

          await sleep(config.checkIntervalMs);
          continue;

        } else {
          // Router báo phiên đã hết -> Giải Captive Portal
          wasOnline = false;
          heartBeatCount = 0;
          log(`[HẾT HẠN PHIÊN] Router báo phiên đã hết. Đang tự động giải Captive Portal siêu tốc...`);

          isResolvingPortal = true;
          const portalRes = await solveCaptivePortal({ headless: config.headless, proactive: false });
          isResolvingPortal = false;

          if (portalRes.success) {
            log(`[KẾT NỐI THÀNH CÔNG] Đã vượt Captive Portal và kết nối lại Internet!`);
          } else {
            log(`[THỬ LẠI] Chưa thể vượt Captive Portal: ${portalRes.error || 'Lỗi mạng'}. Thử lại sau 2.5s...`);
            await sleep(2500);
          }
          continue;
        }

      } else {
        // Router status không phản hồi, kiểm tra Internet thông thường
        const net = await checkInternetAccess(2000);
        if (net.isOnline) {
          if (wasOnline !== true) {
            log(`[MẠNG TỐT] Internet đang hoạt động bình thường trên "${conn.ssid}" (Tín hiệu: ${conn.signal}).`);
            wasOnline = true;
          }
          await sleep(config.checkIntervalMs);
          continue;
        } else {
          wasOnline = false;
          log(`[MẤT KẾT NỐI / CẦN XÁC THỰC] Đang kích hoạt giải quyết Captive Portal...`);
          isResolvingPortal = true;
          const portalRes = await solveCaptivePortal({ headless: config.headless, proactive: false });
          isResolvingPortal = false;

          if (portalRes.success) {
            log(`[THÀNH CÔNG] Đã hoàn tất đăng nhập Captive Portal!`);
          } else {
            log(`[THỬ LẠI] Chưa thể vượt Captive Portal: ${portalRes.error}. Thử lại sau 2.5s...`);
            await sleep(2500);
          }
          continue;
        }
      }

    } catch (err) {
      log(`[LỖI VÒNG LẶP] ${err.message}`);
      await sleep(2500);
    }
  }
}

if (require.main === module) {
  runDaemon();
}

module.exports = { runDaemon };
