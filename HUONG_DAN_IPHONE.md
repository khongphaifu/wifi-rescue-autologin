# 📱 Hướng Dẫn Cài Đặt Wi-Fi Rescue Siêu Tốc Trên iPhone (Cách A)

Tài liệu này hướng dẫn bạn thiết lập tính năng tự động kết nối và gia hạn mạng **Free Wi-MESH-Rescue** trên iPhone (iOS) bằng ứng dụng **Phím tắt (Shortcuts)** có sẵn của Apple:
- ⚡ **Tốc độ:** Chỉ mất 0.3 giây (Bỏ qua hoàn toàn đếm ngược quảng cáo 5s).
- 🔋 **Pin:** 0% hao pin (Không dùng app ngầm lách luật làm nóng máy).
- 🛡️ **An toàn:** Không bao giờ cướp hay đè lên Wi-Fi nhà/công ty.

---

## 🛠️ BƯỚC 1: TẠO PHÍM TẮT CẤP MẠNG (Wi-Fi Rescue)

1. Mở ứng dụng **Phím tắt (Shortcuts)** trên iPhone.
2. Tại tab **Phím tắt** (góc dưới bên trái), nhấn dấu **`+`** (góc trên bên phải) để tạo mới.
3. Chạm vào tên ở trên cùng và đổi tên thành: **`Wi-Fi Rescue`**.
4. Lần lượt thêm **4 tác vụ** sau:

### 1.1. Lấy thông tin router
- Tìm tác vụ: **`Lấy nội dung của URL`** (Get contents of URL).
- Nhấp vào chữ `URL` màu xanh và nhập:
  ```text
  http://186.186.0.1/status
  ```

### 1.2. Trích xuất mã MAC tự động
- Tìm tác vụ: **`Khớp văn bản`** (Match Text).
- Mục *Mẫu (Pattern)*: Dán đoạn regex sau:
  ```text
  mac-esc["':\s]+([^"&]+)
  ```
- Mục *Văn bản*: Chọn là **`Nội dung của URL`** (từ bước 1).

### 1.3. Lấy nhóm từ phần khớp
- Tìm tác vụ: **`Lấy nhóm từ phần khớp`** (Get Group from Matched Text).
- Mục *Nhóm tại chỉ mục*: Điền số **`1`**.

### 1.4. Gửi lệnh kích hoạt mạng siêu tốc
- Tìm tác vụ: **`Lấy nội dung của URL`** (Get contents of URL).
- Nhấp vào ô URL và điền:
  ```text
  http://186.186.0.1/login?username=T-[Nhóm từ phần khớp]
  ```
  *(Để chèn biến `[Nhóm từ phần khớp]`, bạn gõ `http://186.186.0.1/login?username=T-` rồi chạm vào biến màu xanh **"Nhóm từ phần khớp"** xuất hiện ngay phía trên bàn phím)*.

### 1.5. Rung báo thành công (Tùy chọn)
- Tìm tác vụ: **`Rung thiết bị`** (Vibrate device) hoặc **`Hiển thị thông báo`**.
- Nhấn **Xong** ở góc trên bên phải để lưu phím tắt.

---

## ⚡ BƯỚC 2: CÀI TỰ ĐỘNG HÓA KHI BẮT WI-FI (Automation)

1. Trong ứng dụng **Phím tắt**, chuyển sang tab **Tự động hóa (Automation)** ở giữa thanh dưới cùng.
2. Nhấn **Tạo mục tự động hóa cá nhân** (hoặc dấu **`+`** góc trên).
3. Cuộn xuống tìm chọn mục: **Wi-Fi**.
4. Thiết lập:
   - **Mạng**: Bấm *"Chọn"*, tích chọn mạng **`Free Wi-MESH-Rescue`** (nếu chưa có sóng, bạn gõ đúng tên này).
   - Chọn mục: **Khi kết nối** (Is Connected).
   - Chọn: **Chạy ngay lập tức** (Run Immediately).
   - Tắt công tắc: **Thông báo khi chạy** (Notify When Run) -> TẮT.
5. Nhấn **Tiếp tục** -> Chọn phím tắt **`Wi-Fi Rescue`** vừa tạo ở Bước 1.

> 🎉 **Từ nay**: Mỗi khi iPhone bắt sóng `Free Wi-MESH-Rescue`, máy sẽ tự động kích hoạt thông mạng ngầm trong 0.3 giây mà bạn không cần mở web hay chờ quảng cáo!

---

## ✌️ BƯỚC 3: GÕ MẶT LƯNG ĐỂ GIA HẠN KHI HẾT 15 PHÚT (Back Tap)

Khi hết 15 phút, mạng bị ngắt, bạn không cần thoát ứng dụng đang xem (YouTube, TikTok, Facebook...):
1. Vào **Cài đặt (Settings)** trên iPhone.
2. Chọn **Trợ năng (Accessibility)** -> **Cảm ứng (Touch)**.
3. Cuộn xuống dưới cùng chọn **Chạm vào mặt lưng (Back Tap)**.
4. Chọn **Chạm hai lần (Double Tap)** -> Cuộn xuống mục *Phím tắt*, tích chọn **`Wi-Fi Rescue`**.

> 💡 **Cách dùng**: Cứ mỗi khi thấy mạng bị đơ do hết 15 phút, bạn chỉ cần lấy ngón tay **gõ "cộc cộc" 2 cái vào lưng iPhone**, 0.3 giây sau mạng tự nối lại và tiếp tục lướt mượt mà!

---

## 🛡️ BƯỚC 4: QUẢN LÝ ĐỘ ƯU TIÊN WI-FI TRÊN IPHONE

1. Vào **Cài đặt** -> **Wi-Fi**.
2. Nhấn vào chữ **`(i)`** bên cạnh mạng `Free Wi-MESH-Rescue`.
3. Kiểm tra mục **"Tự động kết nối" (Auto-Join)**:
   - **Nếu BẬT**: iPhone tự bắt Wi-MESH khi không có Wi-Fi quen thuộc (iOS luôn ưu tiên Wi-Fi nhà có mật khẩu trước).
   - **Nếu TẮT**: iPhone chỉ kết nối Wi-MESH khi chính tay bạn chạm chọn nó trong cài đặt (Độ ưu tiên thấp nhất 100%).
