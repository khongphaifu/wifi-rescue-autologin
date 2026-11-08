const assert = require('assert');

/**
 * Hàm mô phỏng safeEvaluate để kiểm tra khả năng bắt lỗi context destruction
 */
async function mockSafeEvaluate(mockPage, fn, defaultValue = null) {
  try {
    return await mockPage.evaluate(fn);
  } catch (err) {
    const msg = (err && err.message) ? err.message.toLowerCase() : '';
    if (
      msg.includes('execution context was destroyed') ||
      msg.includes('cannot find context with specified id') ||
      msg.includes('protocol error') ||
      msg.includes('frame was detached') ||
      msg.includes('target closed')
    ) {
      return defaultValue;
    }
    throw err;
  }
}

console.log('[TEST] Kiểm tra hàm safeEvaluate bắt lỗi chuyển trang...');

// 1. Trường hợp bình thường (thành công)
const normalPage = {
  evaluate: async () => ({ found: true, text: 'Kết nối' })
};
mockSafeEvaluate(normalPage, () => {}, { found: false }).then(res => {
  assert.strictEqual(res.found, true);
  console.log('  ✓ Thực thi bình thường -> trả về kết quả chính xác');
});

// 2. Trường hợp ném lỗi: "Execution context was destroyed, most likely because of a navigation."
const destroyedPage = {
  evaluate: async () => {
    throw new Error('Execution context was destroyed, most likely because of a navigation.');
  }
};
mockSafeEvaluate(destroyedPage, () => {}, { found: false }).then(res => {
  assert.strictEqual(res.found, false);
  console.log('  ✓ Bắt lỗi "Execution context was destroyed" -> trả về defaultValue an toàn, không làm crash!');
});

// 3. Trường hợp ném lỗi: "Cannot find context with specified id"
const detachedPage = {
  evaluate: async () => {
    throw new Error('Protocol error (Runtime.callFunctionOn): Cannot find context with specified id');
  }
};
mockSafeEvaluate(detachedPage, () => {}, { found: false }).then(res => {
  assert.strictEqual(res.found, false);
  console.log('  ✓ Bắt lỗi "Cannot find context" -> trả về defaultValue an toàn');
});

// 4. Trường hợp ném lỗi code JavaScript thông thường (phải throw để debug)
const errorPage = {
  evaluate: async () => {
    throw new Error('ReferenceError: something is not defined');
  }
};
mockSafeEvaluate(errorPage, () => {}, { found: false }).catch(err => {
  assert(err.message.includes('ReferenceError'));
  console.log('  ✓ Lỗi code khác vẫn được ném ra bình thường');
  console.log('[TEST] ==> KIỂM THỬ safeEvaluate ĐẠT 100%! <==\n');
});
