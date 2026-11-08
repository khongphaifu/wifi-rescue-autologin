const assert = require('assert');
const { parseSessionTimeLeft } = require('./test-session-time-parser');

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

// Kiểm thử mẫu thực tế từ router MikroTik / Wi-MESH
const sampleHtmlLoggedIn = `
<div><script>const wifiInfo={identity:"PC-ROUTER-AMR",mac:"14:AC:60:EA:A0:FB",ip:"186.186.31.153",username:"awing15-15","link-login":"http://186.186.0.1/login","link-orig":"","error":"","error-code":"","link-login-only":"http://186.186.0.1/login","link-orig-esc":"","mac-esc":"14%3AAC%3A60%3AEA%3AA0%3AFB","link-advert":"http://186.186.0.1/advert","link-logout":"http://186.186.0.1/logout","login-by":"http-chap","bytes-in-nice":"21.9 MiB","bytes-out-nice":"37.8 MiB",istrial:"yes",chap_id:"$(chap-id)",chap_challenge:"$(chap-challenge)","session-time-left":"6m42s",uptime:"1m42s",blocked:"no","login-by-mac":"no","interface-name":"WM_AWING",hostname:"186.186.0.1","server-address":"186.186.0.1:80","server-name":"WM_AWING",domain":"","session-id":"","logged-in":"yes","host-ip":"186.186.31.153"};document.querySelector("#wifi-info").innerHTML=JSON.stringify(wifiInfo)</script></div>
`;

console.log('[TEST] Kiểm tra hàm extractRouterStatus với dữ liệu mẫu...');
const res = extractRouterStatus(sampleHtmlLoggedIn);
assert.strictEqual(res.loggedIn, true, 'Phải là loggedIn = true');
assert.strictEqual(res.sessionTimeLeftRaw, '6m42s');
assert.strictEqual(res.sessionSecondsLeft, 402, '6m42s = 402 giây');
assert.strictEqual(res.username, 'awing15-15');
assert.strictEqual(res.macEsc, '14%3AAC%3A60%3AEA%3AA0%3AFB');
assert.strictEqual(res.linkLoginOnly, 'http://186.186.0.1/login');
console.log('  ✓ Đã parse chính xác thông tin đăng nhập và thời gian còn lại (402s)');

// Test trường hợp chưa đăng nhập
const sampleHtmlLoggedOut = `
<div><script>const wifiInfo={identity:"PC-ROUTER-AMR","link-login-only":"http://186.186.0.1/login","mac-esc":"14%3AAC%3A60%3AEA%3AA0%3AFB","logged-in":"no"};</script></div>
`;
const resOut = extractRouterStatus(sampleHtmlLoggedOut);
assert.strictEqual(resOut.loggedIn, false, 'Phải là loggedIn = false');
assert.strictEqual(resOut.sessionSecondsLeft, 0);
console.log('  ✓ Đã parse chính xác khi chưa đăng nhập (loggedIn: false)');

console.log('[TEST] ==> KIỂM THỬ ROUTER STATUS PARSER THÀNH CÔNG 100%! <==\n');

module.exports = { extractRouterStatus };
