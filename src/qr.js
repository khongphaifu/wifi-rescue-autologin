/**
 * Lightweight zero-dependency QR Code generator (ISO/IEC 18004 Versions 1-5, ECC Level L, Byte Mode).
 * Supports rendering compact ASCII/Unicode half-block QR codes in Windows terminal for iPhone scanning.
 */

const VERSIONS = [
  { version: 1, size: 21, dataBytes: 19, eccBytes: 7, alignPos: null },
  { version: 2, size: 25, dataBytes: 34, eccBytes: 10, alignPos: 18 },
  { version: 3, size: 29, dataBytes: 55, eccBytes: 15, alignPos: 22 },
  { version: 4, size: 33, dataBytes: 80, eccBytes: 20, alignPos: 26 },
  { version: 5, size: 37, dataBytes: 108, eccBytes: 26, alignPos: 30 }
];

// GF(256) log/exp lookup tables for Reed-Solomon (polynomial 0x11d)
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGaloisField() {
  let v = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = v;
    LOG[v] = i;
    v = (v << 1) ^ (v & 0x80 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeEcc(data, eccCount) {
  const gen = rsGeneratorPoly(eccCount);
  const res = new Uint8Array(data.length + eccCount);
  res.set(data, 0);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return Array.from(res.slice(data.length));
}

function encodeDataCodewords(text, spec) {
  const bytes = Array.from(Buffer.from(text, 'utf8'));
  if (bytes.length + 2 > spec.dataBytes) {
    throw new Error(`Text length (${bytes.length}) exceeds Version ${spec.version} capacity`);
  }

  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  // Byte mode indicator (0100) + 8-bit character count (for V1-V9)
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);

  const maxBits = spec.dataBytes * 8;
  pushBits(0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | bits[i + j];
    out.push(val);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (out.length < spec.dataBytes) {
    out.push(padBytes[padIdx % 2]);
    padIdx++;
  }
  return out;
}

function createMatrix(size) {
  return {
    size,
    modules: Array.from({ length: size }, () => new Uint8Array(size)),
    isFunc: Array.from({ length: size }, () => new Uint8Array(size))
  };
}

function setFuncModule(m, r, c, dark) {
  if (r >= 0 && r < m.size && c >= 0 && c < m.size) {
    m.modules[r][c] = dark ? 1 : 0;
    m.isFunc[r][c] = 1;
  }
}

function drawFinderPattern(m, top, left) {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const r = top + dy;
      const c = left + dx;
      if (r < 0 || r >= m.size || c < 0 || c >= m.size) continue;
      const inOuter = dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6;
      const isBorder = dy === 0 || dy === 6 || dx === 0 || dx === 6;
      const isCenter = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
      setFuncModule(m, r, c, inOuter && (isBorder || isCenter));
    }
  }
}

function drawAlignmentPattern(m, cr, cc) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const dist = Math.max(Math.abs(dy), Math.abs(dx));
      setFuncModule(m, cr + dy, cc + dx, dist !== 1);
    }
  }
}

function drawFunctionPatterns(m, spec) {
  const n = m.size;
  drawFinderPattern(m, 0, 0);
  drawFinderPattern(m, 0, n - 7);
  drawFinderPattern(m, n - 7, 0);

  if (spec.alignPos !== null) {
    drawAlignmentPattern(m, spec.alignPos, spec.alignPos);
  }

  for (let i = 8; i < n - 8; i++) {
    setFuncModule(m, 6, i, i % 2 === 0);
    setFuncModule(m, i, 6, i % 2 === 0);
  }
  setFuncModule(m, n - 8, 8, true);

  // Reserve format info slots
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      setFuncModule(m, 8, i, false);
      setFuncModule(m, i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) setFuncModule(m, 8, n - 1 - i, false);
  for (let i = 0; i < 7; i++) setFuncModule(m, n - 1 - i, 8, false);
}

function drawCodewords(m, allBytes) {
  const n = m.size;
  let bitIdx = 0;
  const totalBits = allBytes.length * 8;

  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? n - 1 - vert : vert;
        if (!m.isFunc[row][col]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((allBytes[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
          m.modules[row][col] = dark ? 1 : 0;
        }
      }
    }
  }
}

function applyFormatBits(m, eccBits, maskPattern) {
  const data = (eccBits << 3) | maskPattern;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;

  const n = m.size;
  for (let i = 0; i <= 5; i++) setFuncModule(m, 8, i, (bits >> i) & 1);
  setFuncModule(m, 8, 7, (bits >> 6) & 1);
  setFuncModule(m, 8, 8, (bits >> 7) & 1);
  setFuncModule(m, 7, 8, (bits >> 8) & 1);
  for (let i = 9; i < 15; i++) setFuncModule(m, 14 - i, 8, (bits >> i) & 1);

  for (let i = 0; i < 8; i++) setFuncModule(m, 8, n - 1 - i, (bits >> i) & 1);
  for (let i = 8; i < 15; i++) setFuncModule(m, n - 15 + i, 8, (bits >> i) & 1);
}

function applyMask(m, mask) {
  const n = m.size;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (m.isFunc[r][c]) continue;
      let invert = false;
      if (mask === 0) invert = (r + c) % 2 === 0;
      else if (mask === 1) invert = r % 2 === 0;
      else if (mask === 2) invert = c % 3 === 0;
      else if (mask === 3) invert = (r + c) % 3 === 0;
      if (invert) m.modules[r][c] ^= 1;
    }
  }
}

function generateQrMatrix(text) {
  const byteLen = Buffer.byteLength(text, 'utf8');
  const spec = VERSIONS.find(v => byteLen + 2 <= v.dataBytes);
  if (!spec) {
    throw new Error(`Payload too long for QR V1-V5 (${byteLen} bytes)`);
  }

  const data = encodeDataCodewords(text, spec);
  const ecc = rsComputeEcc(data, spec.eccBytes);
  const codewords = data.concat(ecc);

  const m = createMatrix(spec.size);
  drawFunctionPatterns(m, spec);
  drawCodewords(m, codewords);

  // Pick best balance mask among masks 0..3 using 50% dark ratio heuristic
  let bestMask = 0;
  let bestScore = Infinity;
  const total = spec.size * spec.size;
  for (let mask = 0; mask < 4; mask++) {
    applyMask(m, mask);
    let dark = 0;
    for (let r = 0; r < spec.size; r++) {
      for (let c = 0; c < spec.size; c++) dark += m.modules[r][c];
    }
    const diff = Math.abs((dark * 100) / total - 50);
    if (diff < bestScore) {
      bestScore = diff;
      bestMask = mask;
    }
    applyMask(m, mask);
  }

  applyMask(m, bestMask);
  applyFormatBits(m, 0b01, bestMask); // ECC Level L = 01
  return m.modules;
}

/**
 * Render QR matrix using compact Unicode half-blocks (black on white quiet zone) for terminal scanning.
 */
function renderAsciiQr(text, margin = 2) {
  const matrix = generateQrMatrix(text);
  const n = matrix.length;
  const total = n + margin * 2;
  const get = (r, c) => {
    const mr = r - margin;
    const mc = c - margin;
    if (mr < 0 || mr >= n || mc < 0 || mc >= n) return 0; // white quiet zone
    return matrix[mr][mc];
  };

  const lines = [];
  for (let r = 0; r < total; r += 2) {
    let line = '';
    for (let c = 0; c < total; c++) {
      const topDark = get(r, c) === 1;
      const botDark = r + 1 < total ? get(r + 1, c) === 1 : false;
      // Since Windows console background is dark and text is white,
      // invert visuals so "white quiet zone" uses white blocks ('█') and dark modules are spaces (' ')
      if (!topDark && !botDark) line += '█';
      else if (topDark && botDark) line += ' ';
      else if (!topDark && botDark) line += '▀';
      else line += '▄';
    }
    lines.push('  ' + line);
  }
  return lines.join('\n');
}

module.exports = {
  generateQrMatrix,
  renderAsciiQr
};
