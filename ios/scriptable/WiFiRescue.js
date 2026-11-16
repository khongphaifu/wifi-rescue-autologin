// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: wifi;

/**
 * Wi-Fi Rescue Auto-Login for iOS (Scriptable Widget & 1-Tap Runner)
 * Giao tiếp trực tiếp với Router MikroTik / Wi-MESH (186.186.0.1) trong 0.2s.
 * Khuyên dùng kèm Profile .mobileconfig có CaptiveBypass = true.
 */

const PORTAL_STATUS_URL = "http://186.186.0.1/status";
const PORTAL_LOGIN_URL = "http://186.186.0.1/login";
const PORTAL_LOGOUT_URL = "http://186.186.0.1/logout";
const PROACTIVE_RENEW_SECONDS = 45;

// Có thể điền cứng MAC iPhone vào đây nếu muốn kích hoạt ngay cả khi /status chưa phản hồi (VD: "14:AC:60:EA:A0:FB")
const FALLBACK_IPHONE_MAC = "";

function parseSessionTimeLeft(str) {
  if (!str) return 0;
  const clean = String(str).trim().toLowerCase();
  let totalSeconds = 0;
  const h = clean.match(/(\d+)\s*h/);
  const m = clean.match(/(\d+)\s*m/);
  const s = clean.match(/(\d+)\s*s/);
  if (h) totalSeconds += parseInt(h[1], 10) * 3600;
  if (m) totalSeconds += parseInt(m[1], 10) * 60;
  if (s) totalSeconds += parseInt(s[1], 10);
  return totalSeconds;
}

function extractRouterStatus(html) {
  if (!html) return null;
  const loggedMatch = html.match(/["']?logged-in["']?\s*:\s*"([^"]+)"/i);
  const leftMatch = html.match(/["']?session-time-left["']?\s*:\s*"([^"]+)"/i);
  const macEscMatch = html.match(/["']?mac-esc["']?\s*:\s*"([^"]+)"/i);
  const macMatch = html.match(/["']?mac["']?\s*:\s*"([^"]+)"/i);

  const timeRaw = leftMatch ? leftMatch[1] : "";
  return {
    loggedIn: loggedMatch ? loggedMatch[1].toLowerCase() === "yes" : false,
    sessionTimeLeftRaw: timeRaw,
    sessionSecondsLeft: parseSessionTimeLeft(timeRaw),
    macEsc: macEscMatch ? macEscMatch[1] : "",
    mac: macMatch ? macMatch[1] : ""
  };
}

async function fetchText(url, timeoutSec = 4) {
  const req = new Request(url);
  req.timeoutInterval = timeoutSec;
  req.headers = {
    "Cache-Control": "no-cache, no-store",
    "Pragma": "no-cache"
  };
  return await req.loadString();
}

async function checkAndRenew() {
  const result = {
    reachable: false,
    loggedIn: false,
    renewed: false,
    secondsLeft: 0,
    timeRaw: "0s",
    mac: FALLBACK_IPHONE_MAC,
    message: ""
  };

  try {
    const html = await fetchText(PORTAL_STATUS_URL, 3);
    const status = extractRouterStatus(html);
    if (!status) {
      result.message = "Không đọc được dữ liệu từ router 186.186.0.1";
      return result;
    }

    result.reachable = true;
    result.loggedIn = status.loggedIn;
    result.secondsLeft = status.sessionSecondsLeft;
    result.timeRaw = status.sessionTimeLeftRaw || "0s";
    result.mac = status.mac || FALLBACK_IPHONE_MAC;

    const targetMacEsc = status.macEsc || (FALLBACK_IPHONE_MAC ? encodeURIComponent(FALLBACK_IPHONE_MAC) : "");

    // Nếu chưa đăng nhập hoặc phiên sắp hết (<= 45s) -> Gia hạn ngay 0.2s
    if ((!status.loggedIn || status.sessionSecondsLeft <= PROACTIVE_RENEW_SECONDS) && targetMacEsc) {
      if (status.loggedIn) {
        try { await fetchText(PORTAL_LOGOUT_URL, 2); } catch (e) {}
      }
      await fetchText(`${PORTAL_LOGIN_URL}?username=T-${targetMacEsc}`, 4);

      const afterHtml = await fetchText(PORTAL_STATUS_URL, 3);
      const afterStatus = extractRouterStatus(afterHtml);
      if (afterStatus && afterStatus.loggedIn) {
        result.loggedIn = true;
        result.renewed = true;
        result.secondsLeft = afterStatus.sessionSecondsLeft;
        result.timeRaw = afterStatus.sessionTimeLeftRaw || "15m";
        result.message = `Đã gia hạn 15p thành công (${result.timeRaw})`;
      } else {
        result.message = "Đã gửi lệnh đăng nhập cho router";
      }
    } else if (status.loggedIn) {
      result.message = `Đang Online - Còn ${result.timeRaw}`;
    } else {
      result.message = "Chưa tìm thấy mã MAC để tự đăng nhập";
    }
  } catch (err) {
    result.message = `Chưa kết nối Wi-MESH (${err.message})`;
  }

  return result;
}

function buildWidget(data) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#0f172a");
  w.setPadding(14, 16, 14, 16);
  w.refreshAfterDate = new Date(Date.now() + 60 * 1000);

  const header = w.addText("WI-FI RESCUE");
  header.font = Font.boldSystemFont(11);
  header.textColor = new Color("#38bdf8");

  w.addSpacer(6);

  const statusText = data.loggedIn ? `● ONLINE (${data.timeRaw})` : "○ OFFLINE / CẦN KÍCH HOẠT";
  const statusEl = w.addText(statusText);
  statusEl.font = Font.boldSystemFont(16);
  statusEl.textColor = data.loggedIn ? new Color("#4ade80") : new Color("#fbbf24");

  w.addSpacer(6);

  const infoEl = w.addText(data.message || "Chạm để kích hoạt mạng 0.2s");
  infoEl.font = Font.systemFont(12);
  infoEl.textColor = new Color("#cbd5e1");

  w.addSpacer(8);

  const footer = w.addText(data.mac ? `MAC: ${data.mac}` : "Free Wi-MESH-Rescue");
  footer.font = Font.mediumMonospacedSystemFont(10);
  footer.textColor = new Color("#64748b");

  return w;
}

async function main() {
  const data = await checkAndRenew();

  if (config.runsInWidget) {
    const widget = buildWidget(data);
    Script.setWidget(widget);
  } else {
    const n = new Notification();
    n.title = data.loggedIn ? "Wi-Fi Rescue: Đã thông mạng!" : "Wi-Fi Rescue";
    n.body = data.message;
    await n.schedule();

    const alert = new Alert();
    alert.title = data.loggedIn ? "Đang Kết Nối Internet" : "Trạng Thái Wi-Fi Rescue";
    alert.message = `${data.message}\nMAC: ${data.mac || "Chưa nhận diện"}`;
    alert.addAction("Đóng");
    await alert.present();
  }
  if (typeof Script !== "undefined") {
    Script.complete();
  }
}

if (typeof Script !== "undefined") {
  main();
} else if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseSessionTimeLeft, extractRouterStatus };
}
