# 📖 LỊCH SỬ PHÁT TRIỂN & TỔNG KẾT TOÀN BỘ QUÁ TRÌNH DỰ ÁN WI-FI RESCUE

Tài liệu này ghi lại toàn bộ lộ trình nghiên cứu, giải quyết bài toán, khắc phục sự cố và nâng cấp công cụ **Wi-Fi Rescue Auto-Login** từ phiên bản đầu tiên đến bản **V2.4 (Dual-Engine)** hiện tại.

---

## 🎯 1. Bài Toán Ban Đầu & Mục Tiêu Dự Án
- **Bối cảnh**: Bạn sử dụng mạng Wi-Fi công cộng **Free Wi-MESH-Rescue** (hạ tầng MikroTik RouterOS kết hợp nền tảng quảng cáo Awing).
- **Vấn đề**:
  - Mạng có Captive Portal yêu cầu mở trình duyệt web và bấm xác nhận / xem đếm ngược quảng cáo thì mới được cấp Internet.
  - Cứ sau **15 phút**, phiên mạng (`session-time-left`) sẽ hết hạn, router tự động cắt Internet và bắt buộc người dùng phải lặp lại quy trình mở web để đăng nhập.
  - Thao tác thủ công lặp đi lặp lại rất phiền phức, gây gián đoạn công việc, họp online hoặc tải dữ liệu.
- **Mục tiêu**: Xây dựng một công cụ chạy ngầm trên Windows, tự động kết nối và tự động vượt Captive Portal siêu tốc, duy trì Internet liên tục mà người dùng không cần phải bận tâm.

---

## 🚀 2. Các Giai Đoạn Phát Triển & Khắc Phục Sự Cố

### 📍 Giai Đoạn 1: Xây Dựng Bộ Khung Cơ Bản (V1.0)
- **Giải pháp**:
  - Sử dụng Node.js kết hợp trình duyệt Chromium ngầm (`puppeteer-core`) tận dụng sẵn Google Chrome trên máy tính để tiết kiệm dung lượng.
  - Viết module `wifi.js` để đọc trạng thái mạng qua lệnh `netsh wlan show interfaces` và `checkInternetAccess()` qua HTTP.
  - Viết `portal.js` để tự động điều khiển Chromium truy cập `http://186.186.0.1/` và click nút kết nối.
- **Kết quả**: Vượt portal thành công tự động khi hết phiên.

---

### 📍 Giai Đoạn 2: Xử Lý Lỗi Cướp Quyền & "Can't connect to this network" (V2.1 - V2.2)
- **Sự cố phát sinh**:
  - Khi bạn muốn kết nối vào một Wi-Fi khác (như mạng nhà, công ty, hotspot điện thoại) hoặc đang gõ mật khẩu mạng mới, Windows lập tức báo lỗi: **`Can't connect to this network`**.
- **Nguyên nhân kỹ thuật**:
  - Khi người dùng click chọn mạng mới, Windows tạm ngắt mạng cũ và chuyển card mạng sang trạng thái đệm (`associating` / `authenticating`).
  - Vòng lặp daemon cũ thấy `connected = false` nên lập tức phát lệnh `netsh wlan connect Free Wi-MESH-Rescue` mỗi 1 giây -> Xung đột làm Windows hủy ngang quá trình bắt tay kết nối của người dùng.
- **Giải pháp khắc phục**:
  1. **Nhận diện trạng thái bận (`isConnecting`)**: Bổ sung phân tích card mạng, nhận diện các trạng thái `associating`, `authenticating`, `connecting`, `đang liên kết`, `đang xác thực`. Khi ở trạng thái này, dịch vụ **tuyệt đối đứng chờ, không can thiệp**.
  2. **Thời gian ân hạn cứu hộ (Grace Period: 12 giây)**: Khi Wi-Fi bị ngắt, dịch vụ lùi lại chờ 12 giây để Windows tự do kết nối các mạng ưu tiên hoặc để người dùng thoải mái gõ mật khẩu.
  3. **Ngưỡng kiểm tra an toàn (`otherWifiFailThreshold = 3`)**: Khi bạn vừa vào mạng mới và router cấp IP chậm vài giây, dịch vụ không vội ép chuyển mạng mà phải kiểm tra rớt mạng liên tiếp 3 lần (~15s) mới xác nhận lỗi.
  4. **Rate Limit 10 giây**: Khoảng cách giữa 2 lần gửi lệnh kết nối cứu hộ tối thiểu 10 giây để chống spam đơ card mạng.

---

### 📍 Giai Đoạn 3: Cơ Chế Quét Sóng Thông Minh & Độ Ưu Tiên Thấp Nhất (V2.3)
- **Yêu cầu của bạn**:
  > *"Tôi muốn không liên tục gửi cấp mạng Wi-MESH, khi phát hiện có Wi-MESH mới gửi tín hiệu, nhưng độ ưu tiên của nó vẫn thấp nhất có thể, chỉ khi không có mạng và phát hiện có Wi-MESH gần đó mới gửi tín hiệu kết nối."*
- **Giải pháp kỹ thuật**:
  - Tích hợp hàm `getVisibleNetworks()` quét nhanh danh sách sóng Wi-Fi xung quanh máy tính (~150ms) bằng lệnh `netsh wlan show networks`.
  - **Nếu KHÔNG có sóng Wi-MESH**: Dịch vụ **giữ im lặng hoàn toàn 100%**, không gửi bất kỳ lệnh kết nối nào, không làm tốn pin hay tài nguyên máy tính.
  - **Chỉ khi CÓ sóng Wi-MESH VÀ đã qua 12 giây ân hạn**: Dịch vụ mới phát tín hiệu kết nối cứu hộ.

---

### 📍 Giai Đoạn 4: Tự Khởi Động Ngầm Cùng Windows & Bảng Đếm Ngược Trực Tiếp
- **Chạy ngầm tàng hình khi mở máy**:
  - Tạo file `run-silent.vbs` và shortcut `WifiRescueAutoLogin.lnk` đặt trong thư mục `shell:startup`.
  - Khi bạn bật máy tính lên, dịch vụ tự động chạy ngầm mà **hoàn toàn không bật bất kỳ cửa sổ màu đen (CMD) nào**.
- **Đồng hồ đếm ngược trực tiếp thời gian thực (`xem-thoi-gian.bat`)**:
  - Thay vì xem log kỹ thuật rối mắt hay mã JSON thô kệch, bạn chỉ cần nhấp đúp `xem-thoi-gian.bat` để mở bảng đồng hồ nhỏ gọn.
  - Đếm ngược từng giây (`14 phút 30 giây`, `14 phút 29 giây`...) kèm thanh tiến trình trực quan.
  - Tiêu đề trên thanh Taskbar tự động hiển thị số phút/giây còn lại để theo dõi tức thì mà không cần mở to cửa sổ.
- **Đẩy toàn bộ dự án lên GitHub**:
  - Repository: [https://github.com/khongphaifu/wifi-rescue-autologin](https://github.com/khongphaifu/wifi-rescue-autologin)

---

### 📍 Giai Đoạn 5: Khắc Phục Lỗi `ERR_BLOCKED_BY_CLIENT` & Trang Trắng (V2.4 - Bản Mới Nhất)
- **Sự cố phát sinh**:
  - Khi hết phiên, dịch vụ không tự động kết nối lại được.
  - Khi bạn mở trình duyệt vào trang kết nối, màn hình chỉ hiện một **trang trắng tinh** và báo lỗi **`ERR_BLOCKED_BY_CLIENT`**.
  - Bạn phải vào Cài đặt của Chrome xóa toàn bộ bộ nhớ đệm (Cache) thì mới kết nối lại được.
- **Phân tích nguyên nhân gốc rễ**:
  1. **Bản chất của `ERR_BLOCKED_BY_CLIENT`**:
     - Đây là lỗi do trình duyệt (Client) chặn request chứ không phải do server.
     - Nguyên nhân chính: Các tiện ích chặn quảng cáo (AdBlock, uBlock Origin, v.v.) chặn các đoạn mã quảng cáo / banner của mạng Wi-MESH (Awing).
     - Giao diện của trang portal là ứng dụng React Single Page Application (`main.71bc6623.js`). Khi một tài nguyên quảng cáo bị AdBlock chặn, React gặp lỗi unhandled rejection và **bị sập (crash) hoàn toàn**, khiến thẻ `<div id="root">` bị rỗng không render được bất kỳ nút bấm nào -> **Hiện tượng Trang Trắng Tinh**.
  2. **Tại sao xóa cache Chrome mới hết?**:
     - Khi một tài nguyên hoặc redirect 302 bị lỗi, Chrome tự động lưu bản lỗi đó vào **Disk Cache**. Mỗi lần mở lại trang, Chrome lôi bản cache hỏng đó ra hiển thị tiếp mà không tải lại từ router. Chỉ khi xóa cache, Chrome mới tải lại tươi mới từ router.
  3. **Tại sao Puppeteer cũ cũng bị kẹt?**:
     - Trong code cũ có dòng `req.abort()` đối với hình ảnh. Trong Chromium, lệnh `req.abort()` sinh ra chính xác mã lỗi `net::ERR_BLOCKED_BY_CLIENT`! Điều này vô tình làm React app bên trong Puppeteer cũng bị crash trắng trang!
     - Code cũ chỉ kiểm tra `!!document.getElementById('root')`, nhưng thẻ `#root` luôn có sẵn trong HTML ban đầu, khiến Puppeteer tưởng là đã nạp xong và cố tìm nút bấm vô vọng trong 32 giây.

- **Giải pháp V2.4 (Cơ Chế Kép Đột Phá - Dual-Engine)**:
  1. **Chiến lược 1: Đăng Nhập Trực Tiếp Siêu Tốc (Direct HTTP Login)**:
     - Phân tích mã nguồn router MikroTik cho thấy đường dẫn cấp mạng Trial thực tế là:
       ```
       http://186.186.0.1/login?username=T-${macEsc}
       ```
     - Hệ thống gửi thẳng một request HTTP GET no-cache tới URL này để kích hoạt phiên mạng ngay lập tức trong **dưới 0.3 giây**!
     - **Miễn nhiễm 100% với lỗi `ERR_BLOCKED_BY_CLIENT`**, không phụ thuộc vào AdBlock, không cần mở Chrome, không bao giờ bị kẹt trang trắng.
  2. **Chiến lược 2: Browser Engine Bất Khả Xâm Phạm (Bulletproof Chromium Fallback)**:
     - Bật cờ tắt sạch Disk Cache: `--disable-http-cache`, `--disable-application-cache`, `--disk-cache-size=0`.
     - Sử dụng giao thức Chrome DevTools (CDP) xóa sạch Cache, Cookies và Storage của `186.186.0.1` trước mỗi lần nạp trang.
     - Thay thế hoàn toàn `req.abort()` bằng `req.respond({ status: 200, body: '' })` -> **Triệt tiêu hoàn toàn lỗi `ERR_BLOCKED_BY_CLIENT`**.
     - Bổ sung cơ chế phát hiện Trang Trắng: Nếu `#root` không có nút bấm sau 3 giây, Chromium sẽ tự động điều hướng thẳng tới URL cứu hộ trực tiếp.

---

## 📁 3. Cấu Trúc Dự Án Hiện Tại

```text
wifi-rescue-autologin/
├── src/
│   ├── config.js         # Cấu hình ngưỡng thời gian, URL router, timeout
│   ├── wifi.js           # Xử lý card mạng, quét sóng, Direct HTTP Login
│   ├── portal.js         # Động cơ kép giải Captive Portal (Direct HTTP + Chromium)
│   ├── dashboard.js      # Bảng điều khiển và đồng hồ đếm ngược thời gian thực
│   └── index.js          # Daemon nền giám sát và điều phối chu kỳ mạng
├── scripts/
│   ├── start.ps1         # Khởi động dịch vụ nền ngầm độc lập
│   ├── stop.ps1          # Dừng dịch vụ nền
│   ├── status.ps1        # Kiểm tra trạng thái và thời gian còn lại
│   ├── install-startup.ps1   # Đăng ký tự chạy cùng Windows
│   └── uninstall-startup.ps1 # Hủy tự chạy cùng Windows
├── test/                 # Toàn bộ 7 bộ kiểm thử tự động (Test Suites)
├── xem-thoi-gian.bat     # [MỚI] Nhấp đúp để mở đồng hồ đếm ngược trực tiếp
├── status.bat            # Nhấp đúp để xem trạng thái tức thì
├── start.bat             # Nhấp đúp để bật dịch vụ
├── stop.bat              # Nhấp đúp để tắt dịch vụ
├── install-startup.bat   # Cài đặt tự khởi động cùng Windows
├── uninstall-startup.bat # Gỡ bỏ tự khởi động cùng Windows
├── run-silent.vbs        # Khởi chạy ngầm tàng hình không hiện cửa sổ đen
├── README.md             # Hướng dẫn sử dụng chi tiết
└── LICH_SU_PHAT_TRIEN.md # Tài liệu tổng kết toàn bộ quá trình phát triển này
```

---

## 🛠️ 4. Hướng Dẫn Nhanh Dành Cho Bạn

| Nhu cầu của bạn | File cần bấm đúp chuột |
| :--- | :--- |
| **Xem còn bao nhiêu phút (Đếm ngược trực tiếp)** | **`xem-thoi-gian.bat`** |
| **Kiểm tra trạng thái mạng tức thì** | **`status.bat`** |
| **Bật dịch vụ chạy ngầm** | **`start.bat`** |
| **Tắt dịch vụ** | **`stop.bat`** |
| **Cài tự chạy khi bật máy tính** | **`install-startup.bat`** |

> 💡 **Mẹo nhỏ khi dùng Chrome**: Nếu bạn dùng các tiện ích AdBlock (uBlock Origin, AdBlock Plus, v.v.), hãy bấm vào biểu tượng AdBlock trên thanh công cụ và chọn **Tắt trên trang này (Disable on this site)** đối với địa chỉ `186.186.0.1` để tránh trang portal cá nhân của bạn bị chặn nhầm. Còn đối với tiến trình tự động của chúng ta, bản **V2.4** đã xử lý tự động và không còn bị ảnh hưởng nữa!
