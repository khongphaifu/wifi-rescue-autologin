# WiFi Rescue Auto-Login Daemon V2.3 (Bản Quét Sóng Thông Minh & Bảo Vệ Toàn Diện)

Công cụ tự động kết nối và giải quyết Captive Portal cho mạng Wi-Fi **Free Wi-MESH-Rescue** (và các mạng Wi-MESH tương tự) trên Windows với cơ chế bảo vệ quyền ưu tiên người dùng tuyệt đối và quét sóng thông minh.

## 🚀 Các Tính Năng & Cơ Chế Hoạt Động (V2.3)

1. **Quét Sóng Thực Tế Trước Khi Kết Nối (`getVisibleNetworks`)**:
   - Chỉ khi thực sự phát hiện **CÓ SÓNG Wi-MESH** ở gần, hệ thống mới gửi tín hiệu kết nối cứu hộ.
   - Nếu **không có sóng Wi-MESH**, hệ thống giữ **im lặng 100%**, không gửi bất kỳ lệnh nào, không gây tiêu hao tài nguyên card mạng hay pin.

2. **Chống Cướp Quyền Card Mạng (Nhận diện trạng thái bận `isConnecting`)**:
   - Khi bạn bấm vào bất kỳ mạng Wi-Fi nào khác để kết nối hoặc gõ mật khẩu, Windows chuyển card mạng sang trạng thái `associating` (liên kết) hoặc `authenticating` (xác thực).
   - Tiến trình V2.3 nhận diện ngay card mạng đang bận và **tuyệt đối đứng chờ, không can thiệp**.
   - **Loại bỏ 100% lỗi `"Can't connect to this network"`** khi người dùng kết nối mạng mới.

3. **Độ Ưu Tiên Thấp Nhất Tuyệt Đối & Thời Gian Ân Hạn (Grace Period: 12 giây)**:
   - Khi Wi-Fi bị ngắt kết nối hoàn toàn, dịch vụ không vội vàng kết nối ngay mà **chờ 12 giây** để Windows tự do kết nối các mạng ưu tiên (nhà, công ty, điện thoại) hoặc để người dùng thoải mái bấm chọn mạng.
   - Chỉ khi sau 12 giây không có bất kỳ mạng nào kết nối VÀ có sóng Wi-MESH, dịch vụ mới kích hoạt mạng cứu hộ.

4. **Chống Văng Mạng Khi Mới Kết Nối Wi-Fi Khác (Fail Threshold Safe)**:
   - Khi bạn vừa kết nối một mạng mới, router cấp IP (DHCP) mất vài giây.
   - Chỉ khi một mạng ưu tiên **thực sự mất Internet liên tiếp 3 lần kiểm tra (~15 giây)**, dịch vụ mới chuyển hướng sang Wi-MESH cứu hộ.

5. **Chống Spam Tín Hiệu Kết Nối (`Rate Limit: 10 giây`)**:
   - Đảm bảo khoảng cách giữa các lần gửi lệnh `netsh connect` tối thiểu 10 giây, chấm dứt hoàn toàn việc bắn tín hiệu liên tục.

6. **Gia Hạn Chủ Động (Proactive Renewal)**:
   - Theo dõi từng giây thời gian còn lại của phiên (`session-time-left`).
   - Khi phiên còn $\le 30$ giây, tự động gia hạn ngầm mà không làm rớt mạng mỗi 15 phút.

7. **Tự Khởi Động Cùng Windows**:
   - Tự động chạy ngầm tàng hình khi bật máy tính mà không hiện bất kỳ cửa sổ CMD nào.

## 📂 Danh Sách File
- `start.bat`: Khởi động dịch vụ chạy ngầm.
- `stop.bat`: Dừng dịch vụ đang chạy ngầm.
- `status.bat`: Kiểm tra trạng thái thời gian thực và log gần nhất.
- `install-startup.bat`: Đăng ký tự động chạy ngầm khi mở máy tính.
- `uninstall-startup.bat`: Gỡ bỏ tự động chạy cùng Windows.
- `src/config.js`: Cấu hình thông số mạng, ngưỡng gia hạn và thời gian ân hạn.
- `src/wifi.js`: Xử lý card mạng, quét sóng xung quanh và phân tích trạng thái kết nối.
- `src/portal.js`: Tự động giải Captive Portal siêu tốc bằng headless Chromium.
- `src/index.js`: Bộ điều phối trạng thái an toàn toàn diện.

## 🛠 Hướng Dẫn Sử Dụng
- **Bật dịch vụ**: Nhấp đúp vào `start.bat`.
- **Xem trạng thái**: Nhấp đúp vào `status.bat`.
- **Dừng dịch vụ**: Nhấp đúp vào `stop.bat`.
- **Cài tự khởi động cùng máy**: Nhấp đúp vào `install-startup.bat`.
