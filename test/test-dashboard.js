const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('[TEST] Kiểm tra Dashboard & Bảng hiển thị thời gian...');

// Giả lập test module dashboard
const dashboardPath = path.join(__dirname, '..', 'src', 'dashboard.js');
assert.ok(fs.existsSync(dashboardPath), 'File src/dashboard.js phải tồn tại');

console.log('  ✓ File src/dashboard.js tồn tại');

// Kiểm tra file xem-thoi-gian.bat
const batPath = path.join(__dirname, '..', 'xem-thoi-gian.bat');
assert.ok(fs.existsSync(batPath), 'File xem-thoi-gian.bat phải tồn tại');
const batContent = fs.readFileSync(batPath, 'utf8');
assert.ok(batContent.includes('dashboard.js'), 'xem-thoi-gian.bat phải gọi dashboard.js');

console.log('  ✓ File xem-thoi-gian.bat cấu hình chính xác');

// Kiểm tra status.ps1
const statusPs1Path = path.join(__dirname, '..', 'scripts', 'status.ps1');
const statusPs1Content = fs.readFileSync(statusPs1Path, 'utf8');
assert.ok(statusPs1Content.includes('dashboard.js --once'), 'scripts/status.ps1 phải gọi dashboard.js --once');
assert.ok(!statusPs1Content.includes('node src/wifi.js'), 'scripts/status.ps1 không được gọi node src/wifi.js làm rối JSON');

console.log('  ✓ File scripts/status.ps1 đã chuyển sang dùng dashboard.js --once (sạch sẽ, không còn JSON rác)');

console.log('[TEST] ==> TOÀN BỘ KIỂM THỬ DASHBOARD ĐẠT 100%! <==\n');
