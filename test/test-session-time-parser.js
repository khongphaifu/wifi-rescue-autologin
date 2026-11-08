const assert = require('assert');

/**
 * Chuyển đổi chuỗi thời gian còn lại (session-time-left) thành số giây
 * Ví dụ: "6m42s" -> 402, "45s" -> 45, "14m" -> 840, "1h2m3s" -> 3723
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

console.log('[TEST] Kiểm tra bộ phân tích thời gian còn lại (Session Time Left)...');

assert.strictEqual(parseSessionTimeLeft('6m42s'), 402, '6m42s phải bằng 402s');
console.log('  ✓ 6m42s -> 402s');

assert.strictEqual(parseSessionTimeLeft('45s'), 45, '45s phải bằng 45s');
console.log('  ✓ 45s -> 45s');

assert.strictEqual(parseSessionTimeLeft('15m'), 900, '15m phải bằng 900s');
console.log('  ✓ 15m -> 900s');

assert.strictEqual(parseSessionTimeLeft('1h5m10s'), 3910, '1h5m10s phải bằng 3910s');
console.log('  ✓ 1h5m10s -> 3910s');

assert.strictEqual(parseSessionTimeLeft(''), 0, 'Chuỗi rỗng -> 0s');
assert.strictEqual(parseSessionTimeLeft(null), 0, 'Null -> 0s');
console.log('  ✓ Rỗng / Null an toàn -> 0s');

console.log('[TEST] ==> KIỂM THỬ BỘ PHÂN TÍCH THỜI GIAN ĐẠT 100%! <==\n');

module.exports = { parseSessionTimeLeft };
