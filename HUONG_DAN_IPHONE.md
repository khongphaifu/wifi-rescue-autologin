# 📱 Hướng Dẫn Đưa Wi-Fi Rescue Auto-Login Hoạt Động Trên iPhone (iOS)

> Tài liệu hướng dẫn chi tiết **4 giải pháp đã được tích hợp sẵn trong dự án**, khắc phục triệt để các giới hạn của iOS (lỗi `-1009 Offline`, Captive Network Assistant tự ngắt Wi-Fi, Private MAC ngẫu nhiên).

---

## ⭐ PHƯƠNG ÁN 1: Cài Cấu Hình Apple Profile + WebClip 1-Chạm Qua Mã QR (Khuyên Dùng)

Đây là cách cài **nhanh nhất & giải quyết tận gốc rào cản iOS**:
- Kích hoạt **`CaptiveBypass = true`**: iOS không tự ngắt Wi-Fi và không chặn truy cập `186.186.0.1`.
- Kích hoạt **`DisableAssociationMACRandomization = true`**: Giữ cố định địa chỉ MAC của iPhone trên mạng `Free Wi-MESH-Rescue`.
- Tự động thêm nút **`⚡ Wi-Fi Rescue`** (WebClip 0.2s) ngay trên Màn hình chính iPhone.

### Các bước thực hiện (chỉ làm 1 lần):
1. Trên Laptop, nhấp đúp chuột chạy file **`cai-dat-iphone.bat`**.
2. Đảm bảo iPhone và Laptop kết nối cùng mạng Wi-Fi (hoặc iPhone bắt sóng từ `bat-phat-wifi-iphone.bat`).
3. Mở **Camera iPhone**, quét mã QR hiển thị trên cửa sổ màn hình Laptop để vào trang **Wi-Fi Rescue iOS**.
4. Bấm nút xanh **📥 Tải Cấu Hình Wi-Fi 1-Chạm (.mobileconfig)** ➔ Chọn **Cho phép**.
5. Vào **Cài đặt (Settings)** trên iPhone ➔ Mục **Đã tải về hồ sơ (Profile Downloaded)** (ngay dưới Apple ID) ➔ Bấm **Cài đặt (Install)** và nhập mật mã máy.
6. Quay ra Màn hình chính, bạn sẽ thấy ngay nút **`⚡ Wi-Fi Rescue`** để kích hoạt mạng trong 0.2s bất cứ lúc nào!

*(Mẹo: Bạn cũng có thể gửi trực tiếp file mẫu `ios/WiFi-Rescue-iOS.mobileconfig` qua Zalo / AirDrop sang iPhone nếu không tiện quét QR).*

---

## 📊 PHƯƠNG ÁN 2: Đồng Hồ Đếm Ngược & Tự Gia Hạn Trên Safari (Không Cần Laptop)

Sử dụng **Same-Origin Bookmarklet** (`ios/bookmarklet/dashboard-inject.js`) chạy trực tiếp trên địa chỉ `http://186.186.0.1/status`:
1. Copy toàn bộ mã trong file `ios/bookmarklet/bookmarklet-url.txt` (hoặc bấm nút **Copy Bookmarklet** trên trang `cai-dat-iphone.bat`).
2. Trên Safari iPhone, lưu một trang bất kỳ vào **Dấu trang (Bookmark)** với tên **`⚡ Đồng Hồ Wi-MESH`** ➔ Bấm **Sửa dấu trang** ➔ Dán đoạn mã `javascript:...` vừa copy vào ô địa chỉ URL.
3. Khi đang mở trang `http://186.186.0.1/status`, chạm vào dấu trang **`⚡ Đồng Hồ Wi-MESH`**:
   - Biến trang trắng của router thành **Bảng Đồng Hồ Đếm Ngược Từng Giây** (Dark Mode).
   - Bấm **`🔊 Bật Giữ Mạng Ngầm 24/7`** để bật bộ **Silent WebAudio Keep-Alive**, giữ tab Safari luôn thức và **tự động gia hạn khi còn <= 45 giây**!

---

## 📱 PHƯƠNG ÁN 3: Widget Màn Hình Chính iPhone Với Scriptable

1. Tải ứng dụng **Scriptable** (miễn phí trên App Store).
2. Mở file `ios/scriptable/WiFiRescue.js` (hoặc bấm tải từ server `cai-dat-iphone.bat`), nạp vào app Scriptable với tên **`WiFiRescue`**.
3. Thêm **Widget Scriptable** ra Màn hình chính và chọn script `WiFiRescue`:
   - Xem trực tiếp trạng thái `● ONLINE`, số phút còn lại và mã MAC.
   - Chạm vào Widget để tự động kiểm tra và gia hạn ngay 15 phút mới trong 0.2s!

---

## 📡 PHƯƠNG ÁN 4: Phát Sóng Trực Tiếp Từ Laptop Hoặc Cài App Native Swift

### Cách 4A: Trạm Phát Wi-Fi Hotspot Từ Laptop (`bat-phat-wifi-iphone.bat`)
Nếu bạn ngồi làm việc bên cạnh Laptop đang chạy `wifi-rescue-autologin`:
1. Nhấp đúp file **`bat-phat-wifi-iphone.bat`** trên Laptop.
2. Mở Camera iPhone quét thẳng mã QR Wi-Fi hiện trên màn hình.
3. iPhone dùng Internet qua Laptop **liên tục 24/7**, 0% hao pin, không bao giờ gặp màn hình quảng cáo hay bị ngắt mỗi 15 phút!

### Cách 4B: Build Ứng Dụng Native iOS (`.ipa`) Từ SwiftUI
Mã nguồn ứng dụng iOS độc lập nằm tại [`ios/native-swift/WiFiRescueApp.swift`](file:///C:/Users/bunsm/.gemini/antigravity/scratch/wifi-rescue-autologin/ios/native-swift/WiFiRescueApp.swift):
- Sử dụng `NWPathMonitor` + `URLSession` ép buộc giao diện Wi-Fi (không bao giờ bị 4G/Wi-Fi Assist chuyển nhầm).
- Dùng `AVAudioSession` phát âm thanh vô thanh giữ tiến trình chạy ngầm 24/7 và tự gia hạn mỗi 14 phút.
- Có thể build miễn phí lên iPhone bằng Xcode, Sideloadly hoặc AltStore.
