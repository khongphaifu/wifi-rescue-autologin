# WiFi Rescue Auto-Login Daemon V2.3 (Bản Quét Sóng Thông Minh & Bảng Theo Dõi Thời Gian Thực)

Công cụ tự động kết nối và giải quyết Captive Portal cho mạng Wi-Fi **Free Wi-MESH-Rescue** (và các mạng Wi-MESH tương tự) trên Windows với cơ chế bảo vệ quyền ưu tiên người dùng tuyệt đối, quét sóng thông minh và bảng đồng hồ theo dõi thời gian thực.

## 🚀 Các Tính Năng Nổi Bật (V2.3)

1. **Bảng Theo Dõi Thời Gian Phiên Còn Lại Trực Tiếp (`xem-thoi-gian.bat`)**:
   - Nhấp đúp chuột là mở ngay đồng hồ đếm ngược trực tiếp từng giây (`14 phút 30 giây`, `14 phút 29 giây`...).
   - Hiển thị thanh tiến trình trực quan `[████████████████████░░░░░░░░] 73% (Phiên 15p)`.
   - Tiêu đề cửa sổ trên thanh Taskbar tự động cập nhật thời gian theo từng giây (dễ dàng nhìn thấy ngay cả khi thu nhỏ).
   - Tự động đồng bộ với router và báo động khi dịch vụ tiến hành gia hạn tự động.

2. **Quét Sóng Thực Tế Trước Khi Kết Nối (`getVisibleNetworks`)**:
   - Chỉ khi thực sự phát hiện **CÓ SÓNG Wi-MESH** ở gần, hệ thống mới gửi tín hiệu kết nối cứu hộ.
   - Nếu **không có sóng Wi-MESH**, hệ thống giữ **im lặng 100%**, không gửi bất kỳ lệnh nào, không gây tiêu hao tài nguyên card mạng hay pin.

3. **Chống Cướp Quyền Card Mạng (Nhận diện trạng thái bận `isConnecting`)**:
   - Khi bạn bấm vào bất kỳ mạng Wi-Fi nào khác để kết nối hoặc gõ mật khẩu, Windows chuyển card mạng sang trạng thái `associating` (liên kết) hoặc `authenticating` (xác thực).
   - Dịch vụ nhận diện ngay card mạng đang bận và **tuyệt đối đứng chờ, không can thiệp**.
   - **Loại bỏ 100% lỗi `"Can't connect to this network"`** khi người dùng kết nối mạng mới.

4. **Độ Ưu Tiên Thấp Nhất Tuyệt Đối & Thời Gian Ân Hạn (Grace Period: 12 giây)**:
   - Khi Wi-Fi bị ngắt kết nối hoàn toàn, dịch vụ không vội vàng kết nối ngay mà **chờ 12 giây** để Windows tự do kết nối các mạng ưu tiên (nhà, công ty, điện thoại) hoặc để người dùng thoải mái bấm chọn mạng.
   - Chỉ khi sau 12 giây không có bất kỳ mạng nào kết nối VÀ có sóng Wi-MESH, dịch vụ mới kích hoạt mạng cứu hộ.

5. **Chống Văng Mạng Khi Mới Kết Nối Wi-Fi Khác (Fail Threshold Safe)**:
   - Khi bạn vừa kết nối một mạng mới, router cấp IP (DHCP) mất vài giây.
   - Chỉ khi một mạng ưu tiên **thực sự mất Internet liên tiếp 3 lần kiểm tra (~15 giây)**, dịch vụ mới chuyển hướng sang Wi-MESH cứu hộ.

6. **Chống Spam Tín Hiệu Kết Nối (`Rate Limit: 10 giây`)**:
   - Đảm bảo khoảng cách giữa các lần gửi lệnh `netsh connect` tối thiểu 10 giây, chấm dứt hoàn toàn việc bắn tín hiệu liên tục.

7. **Gia Hạn Chủ Động (Proactive Renewal)**:
   - Theo dõi từng giây thời gian còn lại của phiên (`session-time-left`).
   - Khi phiên còn $\le 30$ giây, tự động gia hạn ngầm mà không làm rớt mạng mỗi 15 phút.

8. **Tự Khởi Động Cùng Windows**:
   - Tự động chạy ngầm tàng hình khi bật máy tính mà không hiện bất kỳ cửa sổ CMD nào.

## 📂 Danh Sách File Tiện Ích
- **`xem-thoi-gian.bat`**: **[MỚI]** Bật đồng hồ đếm ngược trực tiếp thời gian phiên còn lại theo từng giây.
- **`status.bat`**: Bật bảng chẩn đoán trạng thái tức thì, to rõ ràng, không còn JSON rác.
- **`start.bat`**: Khởi động dịch vụ chạy ngầm.
- **`stop.bat`**: Dừng dịch vụ đang chạy ngầm.
- **`install-startup.bat`**: Cài đặt tự động chạy ngầm khi mở máy tính.
- **`uninstall-startup.bat`**: Gỡ bỏ tự động chạy cùng Windows.

## 🛠 Hướng Dẫn Nhanh
- **Muốn xem còn bao nhiêu phút**: Nhấp đúp vào **`xem-thoi-gian.bat`** (đếm ngược trực tiếp) hoặc **`status.bat`** (xem nhanh tức thì).
- **Muốn khởi động dịch vụ**: Nhấp đúp vào **`start.bat`**.
- **Muốn tắt dịch vụ**: Nhấp đúp vào **`stop.bat`**.
