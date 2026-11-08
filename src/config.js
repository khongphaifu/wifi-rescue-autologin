const fs = require('fs');

// Danh sách các đường dẫn trình duyệt Chromium có sẵn trên máy
const possibleBrowserPaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\CocCoc\\Browser\\Application\\browser.exe"
];

function findBrowserPath() {
  for (const p of possibleBrowserPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return possibleBrowserPaths[0];
}

module.exports = {
  // Tên Wi-Fi cần kết nối
  ssid: "Free Wi-MESH-Rescue",
  // Các tên SSID tương tự nếu mạng đổi tên
  fallbackSsids: ["Free Wi-MESH - Rescue", "1.Free Wi-MESH", "Wi-MESH 5G", "Wi-MESH 2.4G"],

  // Đường dẫn Chrome/Edge
  chromePath: findBrowserPath(),

  // Địa chỉ trang đăng nhập Captive Portal của router Wi-MESH / MikroTik
  portalUrl: "http://186.186.0.1/",
  portalStatusUrl: "http://186.186.0.1/status",
  portalLoginUrl: "http://186.186.0.1/login",
  portalLogoutUrl: "http://186.186.0.1/logout",
  fallbackPortalUrl: "http://detectportal.firefox.com/canonical.html",

  // URL kiểm tra kết nối Internet thực tế
  connectivityTestUrl: "http://www.msftconnecttest.com/connecttest.txt",
  expectedTestResponse: "Microsoft Connect Test",

  // Chu kỳ kiểm tra bình thường khi mạng ổn định (ms)
  checkIntervalMs: 3000,

  // Chu kỳ kiểm tra khi mất mạng hoặc đang kết nối lại (ms)
  fastCheckIntervalMs: 1000,

  // Thời gian ân hạn chờ khi mất mạng trước khi kích hoạt cứu hộ (ms)
  // Đảm bảo không chiếm quyền khi người dùng đang bấm chọn mạng hoặc gõ mật khẩu
  disconnectGracePeriodMs: 12000,

  // Khoảng cách tối thiểu giữa 2 lần gửi lệnh netsh connect (ms) tránh spam card mạng
  connectRateLimitMs: 10000,

  // Số lần kiểm tra thất bại liên tiếp trên mạng khác trước khi quyết định cứu hộ
  // Tránh việc mạng vừa kết nối đang xin IP bị ngắt đột ngột
  otherWifiFailThreshold: 3,

  // Ngưỡng thời gian còn lại (giây) để kích hoạt gia hạn chủ động (Proactive Renewal)
  proactiveRenewSeconds: 30,

  // Thời gian chờ lấy IP sau khi gửi lệnh netsh connect (ms)
  reconnectWaitMs: 2500,

  // Timeout khi tải trang web (ms)
  pageTimeoutMs: 15000,

  // Số lần thử tải lại trang portal nếu bị lỗi
  maxPortalRetries: 5,

  // Chế độ chạy ngầm (true = không hiện cửa sổ)
  headless: true
};
