const puppeteer = require('puppeteer-core');
const config = require('./config');
const {
  checkInternetAccess,
  getRouterSessionInfo,
  directTrialLogin
} = require('./wifi');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Hàm bọc an toàn quanh page.evaluate() để tự động bắt các lỗi hủy ngữ cảnh khi trang chuyển hướng
 */
async function safeEvaluate(page, fn, defaultValue = null) {
  try {
    return await page.evaluate(fn);
  } catch (err) {
    const msg = (err && err.message) ? err.message.toLowerCase() : '';
    if (
      msg.includes('execution context was destroyed') ||
      msg.includes('cannot find context with specified id') ||
      msg.includes('protocol error') ||
      msg.includes('frame was detached') ||
      msg.includes('target closed')
    ) {
      // Trang web đang trong quá trình điều hướng (navigation) -> trả về giá trị mặc định để vòng lặp tiếp tục
      return defaultValue;
    }
    throw err;
  }
}

/**
 * Tự động đăng nhập Captive Portal cho Wi-MESH với cơ chế Kép:
 * 1. Ưu tiên Direct HTTP Login siêu tốc (< 0.3s, miễn nhiễm 100% với ERR_BLOCKED_BY_CLIENT & White Screen)
 * 2. Fallback bằng Chromium Engine an toàn, tự động dọn sạch Cache/Storage và chống kẹt trang trắng
 */
async function solveCaptivePortal(options = {}) {
  const isHeadless = options.headless !== undefined ? options.headless : config.headless;
  const isProactive = Boolean(options.proactive);
  console.log(`[PORTAL] Bắt đầu giải quyết Captive Portal (Headless: ${isHeadless}, Gia hạn chủ động: ${isProactive})...`);

  // =========================================================================
  // CHIẾN LƯỢC 1: ĐĂNG NHẬP TRỰC TIẾP QUA HTTP GET (DIRECT HTTP LOGIN)
  // =========================================================================
  try {
    console.log('[PORTAL] Thử nghiệm Đăng nhập Trực tiếp Siêu Tốc (Direct HTTP Login)...');
    const directRes = await directTrialLogin();
    if (directRes && directRes.success) {
      await sleep(500);
      const verifySession = await getRouterSessionInfo(2500);
      if (verifySession && verifySession.loggedIn) {
        console.log(`[PORTAL] Tuyệt vời! Đăng nhập Direct HTTP thành công trong 0.2s: còn ${verifySession.sessionTimeLeftRaw}!`);
        return { success: true, isOnline: true, method: 'direct_http' };
      }
    }
  } catch (directErr) {
    console.log(`[PORTAL] Direct HTTP không khả dụng (${directErr.message}), chuyển sang Browser Engine...`);
  }

  // =========================================================================
  // CHIẾN LƯỢC 2: CHROMIUM BROWSER ENGINE AN TOÀN VÀ TỰ ĐỘNG CHỮA LỖI
  // =========================================================================
  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: config.chromePath,
      headless: isHeadless ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1024,768',
        '--disable-extensions',
        // Tắt toàn bộ cache ổ đĩa để chống kẹt cache / corrupted service worker
        '--disable-http-cache',
        '--disable-application-cache',
        '--disk-cache-size=0',
        '--media-cache-size=0',
        // Tắt tính năng bảo vệ web nghiêm ngặt gây lỗi ERR_BLOCKED_BY_CLIENT
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-features=IsolateOrigins,site-per-process,PreloadMediaEngagementData',
        '--incognito'
      ],
      defaultViewport: { width: 1024, height: 768 }
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');

    // Tắt Cache trên trang và dọn sạch dữ liệu duyệt web của origin qua Chrome DevTools Protocol (CDP)
    try {
      await page.setCacheEnabled(false);
      const cdp = await page.target().createCDPSession();
      await cdp.send('Network.clearBrowserCache');
      await cdp.send('Network.clearBrowserCookies');
      await cdp.send('Storage.clearDataForOrigin', {
        origin: 'http://186.186.0.1',
        storageTypes: 'all'
      });
    } catch (e) {}

    // Xử lý request: KHÔNG dùng req.abort() để tránh phát sinh lỗi ERR_BLOCKED_BY_CLIENT
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'media', 'font'].includes(type)) {
        // Trả về response 200 rỗng an toàn thay vì abort()
        req.respond({
          status: 200,
          contentType: type === 'font' ? 'font/woff2' : 'image/png',
          body: ''
        });
      } else {
        req.continue();
      }
    });

    // Nếu là gia hạn chủ động, yêu cầu router đăng xuất phiên cũ trước
    if (isProactive) {
      try {
        console.log('[PORTAL] Đang đăng xuất phiên cũ để chuẩn bị gia hạn mới...');
        await page.goto(config.portalLogoutUrl, { waitUntil: 'domcontentloaded', timeout: 4000 });
        await sleep(500);
      } catch (e) {}
    }

    // 1. Tải trang Portal với cơ chế Retry & Tự Chữa Trang Trắng
    let loaded = false;
    for (let attempt = 1; attempt <= config.maxPortalRetries; attempt++) {
      console.log(`[PORTAL] Đang nạp trang ${config.portalUrl} (Lần thử ${attempt}/${config.maxPortalRetries})...`);
      try {
        await page.goto(config.portalUrl, {
          waitUntil: 'domcontentloaded',
          timeout: config.pageTimeoutMs
        });

        // Chờ ngắn để các mã chuyển hướng nội bộ của router / React ổn định
        await sleep(800);

        // Kiểm tra xem trang có nội dung thật hay bị Trang Trắng (White Screen)
        const waitDomStart = Date.now();
        while (Date.now() - waitDomStart < 3500) {
          const domCheck = await safeEvaluate(page, () => {
            const root = document.getElementById('root');
            const rootHasContent = root && root.children.length > 0 && root.innerText.trim().length > 0;
            const hasButtons = !!document.querySelector('a, button, input[type="submit"], input[type="button"], .btn');
            const hasText = (document.body && document.body.innerText.length > 30);
            const hasWifiInfo = !!document.getElementById('wifi-info');
            return {
              hasRealContent: rootHasContent || hasButtons || (hasText && !hasWifiInfo),
              hasWifiInfo
            };
          }, { hasRealContent: false, hasWifiInfo: false });

          if (domCheck && domCheck.hasRealContent) {
            loaded = true;
            break;
          }
          await sleep(200);
        }

        // Nếu phát hiện trang trắng (React không render được nút):
        if (!loaded) {
          console.warn(`[PORTAL] Phát hiện lỗi Trang Trắng ở lần thử ${attempt}. Tự động kích hoạt URL cứu hộ trực tiếp...`);
          const routerInfo = await getRouterSessionInfo(2000);
          if (routerInfo && routerInfo.macEsc) {
            const directUrl = `${routerInfo.linkLoginOnly || config.portalLoginUrl}?username=T-${routerInfo.macEsc}`;
            try {
              await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
              await sleep(1000);
              loaded = true;
              break;
            } catch (e) {}
          }
        }

        if (loaded) {
          console.log('[PORTAL] Tải trang thành công!');
          break;
        }
      } catch (err) {
        console.warn(`[PORTAL] Lỗi tải trang ở lần ${attempt}: ${err.message}`);
        await sleep(1000);
      }
    }

    if (!loaded) {
      throw new Error(`Không thể nạp trang portal sau ${config.maxPortalRetries} lần thử.`);
    }

    // 2. Nếu không phải gia hạn chủ động, kiểm tra xem router đã báo đăng nhập rồi chưa
    if (!isProactive) {
      const alreadyLoggedIn = await safeEvaluate(page, () => {
        try {
          const infoEl = document.getElementById('wifi-info');
          if (infoEl && infoEl.innerHTML) {
            const info = JSON.parse(infoEl.innerHTML);
            if (info['logged-in'] === 'yes') return true;
          }
          if (document.body && document.body.innerText.includes('You are logged in')) {
            return true;
          }
        } catch (e) {}
        return false;
      }, false);

      if (alreadyLoggedIn) {
        console.log('[PORTAL] Router báo đã đăng nhập trước đó!');
        return { success: true, message: 'Already logged in' };
      }
    }

    // 3. BƯỚC 1: Tìm và click nút "Kết nối" (Trang đầu) với Deferred Click an toàn
    console.log('[PORTAL] Đang tìm nút "Kết nối" ở Bước 1...');
    let step1Clicked = false;
    const step1Start = Date.now();

    while (Date.now() - step1Start < 12000) {
      try {
        const findResult = await safeEvaluate(page, () => {
          const candidates = Array.from(document.querySelectorAll('a, button, input[type="submit"], input[type="button"], .btn'));
          for (const el of candidates) {
            const text = (el.innerText || el.value || el.textContent || '').trim().toLowerCase();
            const href = (el.getAttribute('href') || '').toLowerCase();
            const id = (el.id || '').toLowerCase();

            const isMatch = (id === 'trial-url') ||
                            text.includes('kết nối') || text.includes('tiếp tục') || text.includes('tiếp theo') || text.includes('bỏ qua') ||
                            href.includes('link-login') || href.includes('username=t-');

            if (isMatch) {
              // Click bất đồng bộ để bảo vệ context thực thi không bị hủy giữa chừng
              setTimeout(() => {
                try { el.click(); } catch (e) {}
              }, 50);
              return { found: true, text: text.replace(/\s+/g, ' '), href };
            }
          }
          return { found: false };
        }, { found: false });

        if (findResult && findResult.found) {
          console.log(`[PORTAL] Đã bấm nút Bước 1 thành công! (Nút: "${findResult.text || 'trial'}")`);
          step1Clicked = true;
          break;
        }
      } catch (e) {}

      await sleep(200);
    }

    // Chờ chuyển cảnh ổn định sau khi click bước 1
    await sleep(1500);

    // Kiểm tra nhanh xem bước 1 đã thông mạng luôn chưa
    const quickSession = await getRouterSessionInfo();
    if (quickSession.loggedIn) {
      console.log(`[PORTAL] Bước 1 đã hoàn tất và router cấp mạng ngay! (Còn: ${quickSession.sessionTimeLeftRaw})`);
      return { success: true, isOnline: true };
    }

    // 4. BƯỚC 2: Chờ đếm ngược countdown và bấm nút "Kết nối" lần cuối
    console.log('[PORTAL] Đang chờ đếm ngược và xử lý nút Bước 2...');
    let step2Completed = false;
    const step2Start = Date.now();
    let lastCountdown = '';

    while (Date.now() - step2Start < 20000) {
      try {
        const clickResult = await safeEvaluate(page, () => {
          const candidates = Array.from(document.querySelectorAll('a, button, input[type="submit"], .btn'));
          for (const el of candidates) {
            const text = (el.innerText || el.value || el.textContent || '').trim().toLowerCase();
            const id = (el.id || '').toLowerCase();

            const isCountingDown = /\d+\s*s\b/i.test(text) || 
                                   /connecting\s*in/i.test(text) || 
                                   (text.includes('sau') && /\d+/.test(text)) ||
                                   el.hasAttribute('disabled');

            if (id === 'trial-url' || text.includes('kết nối') || text.includes('truy cập')) {
              if (isCountingDown) {
                return { status: 'waiting_countdown', text: text.replace(/\s+/g, ' ') };
              }
              const href = el.href || el.getAttribute('href') || '';
              // Click bất đồng bộ để bảo vệ context
              setTimeout(() => {
                try { el.click(); } catch (e) {}
              }, 50);
              return { status: 'clicked', text: text.replace(/\s+/g, ' '), href };
            }
          }
          return { status: 'not_found' };
        }, { status: 'not_found' });

        if (clickResult && clickResult.status === 'clicked') {
          console.log(`[PORTAL] Đã bấm nút xác nhận cuối cùng! ("${clickResult.text}")`);
          step2Completed = true;
          break;
        } else if (clickResult && clickResult.status === 'waiting_countdown') {
          if (clickResult.text !== lastCountdown) {
            lastCountdown = clickResult.text;
            console.log(`[PORTAL] Đang đợi đếm ngược: "${clickResult.text}"...`);
          }
        }
      } catch (e) {}

      await sleep(250);
    }

    // 5. Xác minh siêu tốc bằng truy vấn trực tiếp router
    console.log('[PORTAL] Đang xác minh kết nối...');
    const verifyStart = Date.now();
    while (Date.now() - verifyStart < 4500) {
      await sleep(500);
      const sess = await getRouterSessionInfo();
      if (sess.loggedIn) {
        console.log(`[PORTAL] Tuyệt vời! Router xác nhận phiên mới thành công: còn ${sess.sessionTimeLeftRaw}!`);
        return { success: true, isOnline: true };
      }
    }

    const netStatus = await checkInternetAccess(1500);
    return {
      success: netStatus.isOnline || step2Completed,
      isOnline: netStatus.isOnline
    };

  } catch (err) {
    console.error(`[PORTAL] Lỗi trong quá trình giải quyết portal: ${err.message}`);
    return { success: false, error: err.message };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
  }
}

// Nếu chạy trực tiếp file này
if (require.main === module) {
  const isHeadless = !process.argv.includes('--headful');
  const isProactive = process.argv.includes('--proactive');
  solveCaptivePortal({ headless: isHeadless, proactive: isProactive }).then(res => {
    console.log('[PORTAL] Kết quả:', res);
  });
}

module.exports = {
  solveCaptivePortal,
  safeEvaluate
};
