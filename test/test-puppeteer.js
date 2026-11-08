const puppeteer = require('puppeteer-core');
const config = require('../src/config');

async function testChrome() {
  console.log(`[TEST] Đang khởi chạy Chrome từ: ${config.chromePath}`);
  const browser = await puppeteer.launch({
    executablePath: config.chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setContent('<html><body><h1>Test Wi-Fi Automation</h1><button id="trial-url">Kết nối</button></body></html>');
  
  const text = await page.$eval('button', el => el.innerText);
  console.log(`[TEST] Đã tìm thấy nút test: "${text}"`);
  
  await browser.close();
  console.log('[TEST] Chrome headless hoạt động hoàn hảo!');
}

testChrome().catch(err => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
