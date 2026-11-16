const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../src/config');

const DEFAULT_IOS_SSIDS = [
  config.ssid || 'Free Wi-MESH-Rescue',
  'Free Wi-MESH - Rescue',
  '1.Free Wi-MESH'
];

/**
 * Escape special XML characters to keep Apple .mobileconfig plist valid.
 */
function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Normalize MAC address input (accepts XX:XX:XX:XX:XX:XX, XX-XX..., or URL-encoded %3A).
 */
function normalizeMac(macInput) {
  if (!macInput || typeof macInput !== 'string') {
    return { valid: false, macColon: '', macEsc: '' };
  }
  let decoded = macInput.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch (e) {}

  const cleanHex = decoded.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (cleanHex.length !== 12) {
    return { valid: false, macColon: '', macEsc: '' };
  }

  const parts = cleanHex.match(/.{2}/g);
  const macColon = parts.join(':');
  const macEsc = encodeURIComponent(macColon);
  return { valid: true, macColon, macEsc };
}

function buildWifiPayload(ssid, index) {
  const safeSsid = escapeXml(ssid);
  const uuid = crypto.randomUUID().toUpperCase();
  return `      <dict>
        <key>AutoJoin</key>
        <true/>
        <key>CaptiveBypass</key>
        <true/>
        <key>DisableAssociationMACRandomization</key>
        <true/>
        <key>EncryptionType</key>
        <string>None</string>
        <key>HIDDEN_NETWORK</key>
        <false/>
        <key>IsHotspot</key>
        <false/>
        <key>PayloadDescription</key>
        <string>Cau hinh tu dong ket noi va vuot Captive cho ${safeSsid}</string>
        <key>PayloadDisplayName</key>
        <string>Wi-Fi: ${safeSsid}</string>
        <key>PayloadIdentifier</key>
        <string>com.wifirescue.autologin.wifi.${index + 1}</string>
        <key>PayloadType</key>
        <string>com.apple.wifi.managed</string>
        <key>PayloadUUID</key>
        <string>${uuid}</string>
        <key>PayloadVersion</key>
        <integer>1</integer>
        <key>SSID_STR</key>
        <string>${safeSsid}</string>
      </dict>`;
}

function buildWebClipPayload(label, url, idSuffix) {
  const uuid = crypto.randomUUID().toUpperCase();
  return `      <dict>
        <key>FullScreen</key>
        <false/>
        <key>IgnoreManifestScope</key>
        <false/>
        <key>IsRemovable</key>
        <true/>
        <key>Label</key>
        <string>${escapeXml(label)}</string>
        <key>PayloadDescription</key>
        <string>Nut kich hoat nhanh Wi-Fi Rescue 0.2s</string>
        <key>PayloadDisplayName</key>
        <string>${escapeXml(label)}</string>
        <key>PayloadIdentifier</key>
        <string>com.wifirescue.autologin.webclip.${idSuffix}</string>
        <key>PayloadType</key>
        <string>com.apple.webclip.managed</string>
        <key>PayloadUUID</key>
        <string>${uuid}</string>
        <key>PayloadVersion</key>
        <integer>1</integer>
        <key>Precomposed</key>
        <true/>
        <key>URL</key>
        <string>${escapeXml(url)}</string>
      </dict>`;
}

/**
 * Generate an Apple Configuration Profile (.mobileconfig) XML string for iPhone.
 * Enables CaptiveBypass & DisableAssociationMACRandomization so iOS does not drop Wi-Fi or block 186.186.0.1.
 */
function generateMobileConfig(options = {}) {
  const ssids = Array.isArray(options.ssids) && options.ssids.length > 0
    ? options.ssids
    : DEFAULT_IOS_SSIDS;

  const macInfo = normalizeMac(options.mac);
  const payloads = ssids.map((ssid, idx) => buildWifiPayload(ssid, idx));

  const loginBase = config.portalLoginUrl || 'http://186.186.0.1/login';
  const statusBase = config.portalStatusUrl || 'http://186.186.0.1/status';

  if (macInfo.valid) {
    const directLoginUrl = `${loginBase}?username=T-${macInfo.macEsc}`;
    payloads.push(buildWebClipPayload('⚡ Wi-Fi Rescue', directLoginUrl, 'login'));
  }

  // Always provide a Status WebClip so users can inspect remaining time or run the Bookmarklet anytime
  payloads.push(buildWebClipPayload('⏱️ Trạng Thái Wi-Fi', statusBase, 'status'));

  const rootUuid = crypto.randomUUID().toUpperCase();
  const profileSubtitle = macInfo.valid
    ? `Da gan co dinh MAC iPhone (${macInfo.macColon}). Bat CaptiveBypass & nut kich hoat 0.2s.`
    : 'Bat CaptiveBypass & co dinh dia chi MAC cho mang Free Wi-MESH-Rescue.';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>PayloadContent</key>
    <array>
${payloads.join('\n')}
    </array>
    <key>PayloadDescription</key>
    <string>${escapeXml(profileSubtitle)}</string>
    <key>PayloadDisplayName</key>
    <string>Wi-Fi Rescue Auto-Login (iOS)</string>
    <key>PayloadIdentifier</key>
    <string>com.wifirescue.autologin.profile</string>
    <key>PayloadOrganization</key>
    <string>Wi-Fi Rescue Project</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${rootUuid}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
  </dict>
</plist>
`;
}

if (require.main === module) {
  const argMac = process.argv[2] || '';
  const outPath = path.join(__dirname, 'WiFi-Rescue-iOS.mobileconfig');
  const xml = generateMobileConfig({ mac: argMac });
  fs.writeFileSync(outPath, xml, 'utf-8');
  console.log(`[iOS] Đã tạo file cấu hình Apple Profile tại: ${outPath}`);
}

module.exports = {
  DEFAULT_IOS_SSIDS,
  escapeXml,
  normalizeMac,
  generateMobileConfig
};
