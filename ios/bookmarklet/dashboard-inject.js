(function () {
  if (window.__wifiRescueDashboardActive) {
    var existing = document.getElementById('wifi-rescue-ios-overlay');
    if (existing) existing.style.display = 'flex';
    return;
  }
  window.__wifiRescueDashboardActive = true;

  function parseTimeSec(str) {
    if (!str) return 0;
    var clean = String(str).trim().toLowerCase();
    var sec = 0;
    var h = clean.match(/(\d+)\s*h/);
    var m = clean.match(/(\d+)\s*m/);
    var s = clean.match(/(\d+)\s*s/);
    if (h) sec += parseInt(h[1], 10) * 3600;
    if (m) sec += parseInt(m[1], 10) * 60;
    if (s) sec += parseInt(s[1], 10);
    return sec;
  }

  function extractStatus(html) {
    if (!html) return { loggedIn: false, macEsc: '', mac: '', secLeft: 0, rawLeft: '', rx: '-', tx: '-' };
    var loggedMatch = html.match(/["']?logged-in["']?\s*:\s*"([^"]+)"/i);
    var leftMatch = html.match(/["']?session-time-left["']?\s*:\s*"([^"]+)"/i);
    var macEscMatch = html.match(/["']?mac-esc["']?\s*:\s*"([^"]+)"/i);
    var macMatch = html.match(/["']?mac["']?\s*:\s*"([^"]+)"/i);
    var rxMatch = html.match(/["']?bytes-in-nice["']?\s*:\s*"([^"]+)"/i);
    var txMatch = html.match(/["']?bytes-out-nice["']?\s*:\s*"([^"]+)"/i);
    var rawLeft = leftMatch ? leftMatch[1] : '';
    return {
      loggedIn: loggedMatch ? loggedMatch[1].toLowerCase() === 'yes' : false,
      macEsc: macEscMatch ? macEscMatch[1] : '',
      mac: macMatch ? macMatch[1] : '',
      rawLeft: rawLeft,
      secLeft: parseTimeSec(rawLeft),
      rx: rxMatch ? rxMatch[1] : '-',
      tx: txMatch ? txMatch[1] : '-'
    };
  }

  function formatClock(totalSec) {
    var s = Math.max(0, Math.floor(totalSec || 0));
    var mm = String(Math.floor(s / 60)).padStart(2, '0');
    var ss = String(s % 60).padStart(2, '0');
    return mm + ':' + ss;
  }

  var state = {
    loggedIn: false,
    macEsc: '',
    mac: '',
    secLeft: 0,
    keepAlive: false,
    renewing: false,
    rx: '-',
    tx: '-',
    audioCtx: null,
    silentAudio: null,
    wakeLock: null
  };

  var root = document.createElement('div');
  root.id = 'wifi-rescue-ios-overlay';
  root.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#0a0e17;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;overflow-y:auto;';
  root.innerHTML = [
    '<div style="width:100%;max-width:400px;background:#131b2e;border:1px solid #1e293b;border-radius:24px;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,0.6);">',
    '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">',
    '    <div style="font-weight:700;font-size:17px;color:#38bdf8;">Wi-Fi Rescue iOS</div>',
    '    <span id="wr-badge" style="font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:#1e293b;color:#94a3b8;">Đang kiểm tra...</span>',
    '  </div>',
    '  <div style="text-align:center;margin:14px 0;">',
    '    <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Thời gian phiên còn lại</div>',
    '    <div id="wr-timer" style="font-size:56px;font-weight:800;font-variant-numeric:tabular-nums;color:#22c55e;line-height:1.1;margin:8px 0;">--:--</div>',
    '    <div style="width:100%;height:10px;background:#0f172a;border-radius:999px;overflow:hidden;margin-top:8px;">',
    '      <div id="wr-bar" style="width:0%;height:100%;background:#22c55e;transition:width 0.4s ease;"></div>',
    '    </div>',
    '  </div>',
    '  <div style="background:#0f172a;border-radius:14px;padding:12px 14px;font-size:13px;margin-bottom:16px;line-height:1.7;">',
    '    <div>MAC iPhone: <strong id="wr-mac" style="color:#e2e8f0;">--</strong></div>',
    '    <div>Lưu lượng: <strong id="wr-traffic" style="color:#cbd5e1;">--</strong></div>',
    '    <div id="wr-log" style="color:#38bdf8;font-size:12px;margin-top:4px;">Khởi tạo bảng điều khiển...</div>',
    '  </div>',
    '  <button id="wr-btn-renew" style="width:100%;padding:14px;border:none;border-radius:14px;background:#2563eb;color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">⚡ Gia Hạn Ngay (0.2s)</button>',
    '  <button id="wr-btn-keep" style="width:100%;padding:14px;border:1px solid #334155;border-radius:14px;background:#1e293b;color:#f8fafc;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:10px;">🔇 Bật Giữ Mạng Ngầm 24/7 (Tự Gia Hạn)</button>',
    '  <button id="wr-btn-close" style="width:100%;padding:10px;border:none;border-radius:12px;background:transparent;color:#64748b;font-size:13px;cursor:pointer;">Thu gọn giao diện</button>',
    '</div>'
  ].join('');
  document.body.appendChild(root);

  var elTimer = document.getElementById('wr-timer');
  var elBar = document.getElementById('wr-bar');
  var elBadge = document.getElementById('wr-badge');
  var elMac = document.getElementById('wr-mac');
  var elTraffic = document.getElementById('wr-traffic');
  var elLog = document.getElementById('wr-log');
  var btnRenew = document.getElementById('wr-btn-renew');
  var btnKeep = document.getElementById('wr-btn-keep');
  var btnClose = document.getElementById('wr-btn-close');

  function setLog(msg) {
    if (elLog) elLog.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  }

  function updateUI() {
    elTimer.textContent = formatClock(state.secLeft);
    var pct = Math.max(0, Math.min(100, Math.round((state.secLeft / 900) * 100)));
    elBar.style.width = pct + '%';
    var color = state.secLeft <= 60 ? '#ef4444' : (state.secLeft <= 180 ? '#eab308' : '#22c55e');
    elTimer.style.color = state.loggedIn ? color : '#f59e0b';
    elBar.style.background = state.loggedIn ? color : '#f59e0b';
    elBadge.textContent = state.loggedIn ? 'ONLINE' : 'CẦN ĐĂNG NHẬP';
    elBadge.style.background = state.loggedIn ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)';
    elBadge.style.color = state.loggedIn ? '#4ade80' : '#fbbf24';
    elMac.textContent = state.mac || 'Đang dò...';
    elTraffic.textContent = '⬇ ' + state.rx + '  •  ⬆ ' + state.tx;
  }

  async function syncStatus() {
    try {
      var res = await fetch('/status?_t=' + Date.now(), { cache: 'no-store' });
      var html = await res.text();
      var info = extractStatus(html);
      if (info.macEsc) state.macEsc = info.macEsc;
      if (info.mac) state.mac = info.mac;
      state.loggedIn = info.loggedIn;
      if (info.secLeft > 0) state.secLeft = info.secLeft;
      else if (!info.loggedIn) state.secLeft = 0;
      state.rx = info.rx;
      state.tx = info.tx;
      updateUI();
      return info;
    } catch (err) {
      setLog('Lỗi kết nối router: ' + err.message);
      return null;
    }
  }

  async function doRenew(forceLogout) {
    if (state.renewing) return;
    state.renewing = true;
    btnRenew.textContent = 'Đang kích hoạt 0.2s...';
    try {
      if (!state.macEsc) await syncStatus();
      if (forceLogout) {
        try { await fetch('/logout', { cache: 'no-store' }); } catch (e) {}
      }
      if (state.macEsc) {
        await fetch('/login?username=T-' + state.macEsc, { cache: 'no-store' });
        setLog('Đã gửi lệnh đăng nhập T-' + state.mac + '!');
      } else {
        await fetch('/login', { cache: 'no-store' });
      }
      await new Promise(function (r) { setTimeout(r, 400); });
      await syncStatus();
      if (state.loggedIn) setLog('Kích hoạt Internet 15 phút thành công!');
    } catch (err) {
      setLog('Lỗi gia hạn: ' + err.message);
    } finally {
      state.renewing = false;
      btnRenew.textContent = '⚡ Gia Hạn Ngay (0.2s)';
    }
  }

  function startSilentKeepAlive() {
    try {
      /* 1. Silent WAV audio loop keeps Safari background thread alive on iOS */
      var silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      if (!state.silentAudio) {
        state.silentAudio = new Audio(silentWav);
        state.silentAudio.loop = true;
        state.silentAudio.volume = 0.01;
      }
      state.silentAudio.play().catch(function () {});

      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !state.audioCtx) {
        state.audioCtx = new AC();
        var osc = state.audioCtx.createOscillator();
        var gain = state.audioCtx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(state.audioCtx.destination);
        osc.start();
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Wi-Fi Rescue Keep-Alive',
          artist: 'Free Wi-MESH-Rescue'
        });
      }
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then(function (wl) { state.wakeLock = wl; }).catch(function () {});
      }
      state.keepAlive = true;
      btnKeep.textContent = '🔊 ĐANG GIỮ MẠNG NGẦM 24/7 (Bấm để tắt)';
      btnKeep.style.background = '#166534';
      setLog('Đã bật Silent Keep-Alive: Tự gia hạn khi còn <= 45s.');
    } catch (err) {
      setLog('Không bật được Keep-Alive: ' + err.message);
    }
  }

  function stopSilentKeepAlive() {
    state.keepAlive = false;
    if (state.silentAudio) state.silentAudio.pause();
    if (state.audioCtx) { try { state.audioCtx.close(); } catch (e) {} state.audioCtx = null; }
    if (state.wakeLock) { try { state.wakeLock.release(); } catch (e) {} state.wakeLock = null; }
    btnKeep.textContent = '🔇 Bật Giữ Mạng Ngầm 24/7 (Tự Gia Hạn)';
    btnKeep.style.background = '#1e293b';
    setLog('Đã tắt chế độ giữ mạng ngầm.');
  }

  btnRenew.onclick = function () { doRenew(state.loggedIn); };
  btnKeep.onclick = function () {
    if (state.keepAlive) stopSilentKeepAlive();
    else startSilentKeepAlive();
  };
  btnClose.onclick = function () { root.style.display = 'none'; };

  /* Start initial sync and auto-login if disconnected */
  syncStatus().then(function (info) {
    if (info && !info.loggedIn && info.macEsc) {
      setLog('Phát hiện chưa đăng nhập -> Tự động kích hoạt ngay...');
      doRenew(false);
    } else if (info && info.loggedIn) {
      setLog('Đã kết nối sẵn (' + info.rawLeft + '). Bật nút 🔊 để tự gia hạn!');
    }
  });

  /* 1-second local countdown + proactive renewal check */
  setInterval(function () {
    if (state.loggedIn && state.secLeft > 0) {
      state.secLeft--;
      updateUI();
      if (state.keepAlive && state.secLeft <= 45 && !state.renewing) {
        setLog('Còn <= 45s! Tự động gia hạn chủ động...');
        doRenew(true);
      }
    }
  }, 1000);

  /* Periodic sync every 15s with real router time */
  setInterval(function () {
    syncStatus().then(function (info) {
      if (state.keepAlive && info && !info.loggedIn && !state.renewing) {
        setLog('Router vừa ngắt phiên! Tự động đăng nhập lại...');
        doRenew(false);
      }
    });
  }, 15000);
})();
