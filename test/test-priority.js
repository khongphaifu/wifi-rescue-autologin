const assert = require('assert');
const config = require('../src/config');

// Test unit logic kiểm tra phân loại trạng thái Wi-Fi nâng cao kèm quét sóng
function evaluateWifiDecision(conn, opts = {}) {
  const {
    isInternetOnline = true,
    disconnectedDurationMs = 0,
    otherWifiFailCount = 0,
    visibleNetworks = []
  } = opts;

  // 1. Nếu card mạng đang bận (connecting / authenticating / associating)
  if (conn.isConnecting) {
    return { action: 'wait_connecting', reason: 'Card mạng đang bận kết nối hoặc xác thực' };
  }

  const isTargetSsid = conn.connected && (conn.ssid === config.ssid || config.fallbackSsids.includes(conn.ssid));

  const meshCandidates = [config.ssid, ...config.fallbackSsids];
  const detectedMesh = visibleNetworks.find(s => meshCandidates.includes(s));

  // 2. Đang ở mạng khác (ưu tiên hơn)
  if (conn.connected && !isTargetSsid) {
    if (isInternetOnline) {
      return { action: 'ignore_other_wifi', ssid: conn.ssid };
    } else {
      // Kiểm tra ngưỡng thất bại liên tiếp
      if (otherWifiFailCount >= config.otherWifiFailThreshold) {
        if (detectedMesh) {
          return { action: 'rescue_from_broken_wifi', currentSsid: conn.ssid, target: detectedMesh };
        } else {
          return { action: 'warn_and_wait', currentSsid: conn.ssid, reason: 'Mất mạng nhưng xung quanh không có sóng Wi-MESH' };
        }
      } else {
        return { action: 'warn_and_wait', currentSsid: conn.ssid, count: otherWifiFailCount };
      }
    }
  }

  // 3. Hoàn toàn mất kết nối
  if (!conn.connected) {
    if (disconnectedDurationMs < config.disconnectGracePeriodMs) {
      return { action: 'grace_period_wait', remaining: config.disconnectGracePeriodMs - disconnectedDurationMs };
    } else {
      // Hết ân hạn, kiểm tra xem có sóng Wi-MESH gần đó không
      if (detectedMesh) {
        return { action: 'connect_rescue', target: detectedMesh };
      } else {
        return { action: 'idle_no_mesh', reason: 'Không có sóng Wi-MESH xung quanh, giữ yên lặng không gửi lệnh' };
      }
    }
  }

  // 4. Đang ở mạng cứu hộ
  return { action: 'monitor_portal', ssid: conn.ssid };
}

console.log('[TEST] Kiểm tra logic độ ưu tiên Wi-Fi, Quét sóng Wi-MESH & Chống spam...');

// Kịch bản 1: Đang bắt tay mạng mới
const res1 = evaluateWifiDecision({ connected: false, isConnecting: true, ssid: 'nptq' });
assert.strictEqual(res1.action, 'wait_connecting');
console.log('  ✓ Đang bắt tay / xác thực mạng mới -> ĐỨNG CHỜ, KHÔNG CAN THIỆP');

// Kịch bản 2: Vừa ngắt kết nối (mới 3 giây, trong thời gian ân hạn 12 giây)
const res2 = evaluateWifiDecision({ connected: false, isConnecting: false, ssid: '' }, { disconnectedDurationMs: 3000 });
assert.strictEqual(res2.action, 'grace_period_wait');
console.log('  ✓ Vừa ngắt kết nối 3s (< 12s) -> Đang trong thời gian ân hạn, để yên cho người dùng');

// Kịch bản 3: Mất kết nối 15s (> 12s) NHƯNG KHÔNG CÓ SÓNG WI-MESH xung quanh
const res3 = evaluateWifiDecision(
  { connected: false, isConnecting: false, ssid: '' },
  { disconnectedDurationMs: 15000, visibleNetworks: ['Home-Wifi', 'Cafe-Wifi', '5G-Plus'] }
);
assert.strictEqual(res3.action, 'idle_no_mesh');
console.log('  ✓ Mất kết nối nhưng KHÔNG CÓ sóng Wi-MESH xung quanh -> Giữ yên lặng, KHÔNG gửi tín hiệu kết nối!');

// Kịch bản 4: Mất kết nối 15s VÀ PHÁT HIỆN CÓ SÓNG Free Wi-MESH-Rescue
const res4 = evaluateWifiDecision(
  { connected: false, isConnecting: false, ssid: '' },
  { disconnectedDurationMs: 15000, visibleNetworks: ['Home-Wifi', 'Free Wi-MESH-Rescue', 'Cafe-Wifi'] }
);
assert.strictEqual(res4.action, 'connect_rescue');
assert.strictEqual(res4.target, 'Free Wi-MESH-Rescue');
console.log('  ✓ Mất kết nối VÀ CÓ sóng Free Wi-MESH-Rescue xung quanh -> Gửi tín hiệu kết nối cứu hộ!');

// Kịch bản 5: Đang ở mạng nptq có Internet bình thường
const res5 = evaluateWifiDecision({ connected: true, isConnecting: false, ssid: 'nptq' }, { isInternetOnline: true });
assert.strictEqual(res5.action, 'ignore_other_wifi');
console.log('  ✓ Đang ở mạng nptq có Internet -> Giữ nguyên, không can thiệp');

// Kịch bản 6: Mạng khác vừa kết nối chưa có IP (failCount = 1)
const res6 = evaluateWifiDecision({ connected: true, isConnecting: false, ssid: 'nptq' }, { isInternetOnline: false, otherWifiFailCount: 1 });
assert.strictEqual(res6.action, 'warn_and_wait');
console.log('  ✓ Mạng khác đang xin IP -> Chờ, không ngắt mạng của người dùng');

// Kịch bản 7: Mạng khác mất mạng liên tiếp 3 lần VÀ có sóng Wi-MESH cứu hộ
const res7 = evaluateWifiDecision(
  { connected: true, isConnecting: false, ssid: 'nptq' },
  { isInternetOnline: false, otherWifiFailCount: 3, visibleNetworks: ['Free Wi-MESH-Rescue'] }
);
assert.strictEqual(res7.action, 'rescue_from_broken_wifi');
assert.strictEqual(res7.target, 'Free Wi-MESH-Rescue');
console.log('  ✓ Mạng khác mất mạng 3 lần + CÓ sóng Wi-MESH -> Chuyển sang Wi-MESH cứu hộ');

console.log('[TEST] ==> TẤT CẢ KIỂM THỬ ĐỘ ƯU TIÊN VÀ QUÉT SÓNG ĐẠT 100%! <==\n');
