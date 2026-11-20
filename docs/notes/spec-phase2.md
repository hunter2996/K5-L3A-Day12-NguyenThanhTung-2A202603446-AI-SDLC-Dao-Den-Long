# Spec Phase 2 — Acceptance Criteria & Giả định (Ticket-02)

Tài liệu đặc tả nghiệm thu cho toàn bộ các mục ở Phần 3 của [Ticket-02.md](../../Ticket-02.md).

---

## 1. Acceptance Criteria cho từng mục ở Phần 3

### 1.1. Gió Lạc (Đêm 2 và 3)
- **AC-1.1:** Ở Đêm 2 và Đêm 3 (khi `random_drifters !== false`), Gió Lạc sinh tại tick `1200, 2400, ...` tối đa `2` con đang hoạt động (`state !== "removed"`), `id` lần lượt `D1, D2, ...`.
- **AC-1.2:** Trạng thái `idle` (lượn `2 m/s`) tự chuyển sang `chase` (`7 m/s`) ngay tick Mây mang `>= 5` đom đóm và khoảng cách `XZ <= 15 m`; quay lại `idle` nếu điều kiện không còn thỏa.
- **AC-1.3:** Khi chạm trong `XZ <= 1.2 m` ở trạng thái `chase`, Gió Lạc cướp `min(3, carried)` đom đóm (bỏ qua bất tử của Mây và vùng an toàn của đèn), phát sự kiện `drifter_steal { drifter_id, amount, carried }`, chuyển `flee` (`7 m/s` trong `240` tick) rồi chuyển `removed`. Mỗi con chỉ cướp tối đa `1` lần.
- **AC-1.4:** Trúng Tỏa Sáng (`dist3D <= 5 m`) khi đang `chase` → chuyển `flee` không cướp; khi đang `flee` có mang đồ → rơi toàn bộ số đã cướp tại chỗ thành đom đóm rơi (`ttl_s = 8.0`), phát `drifter_drop { drifter_id, amount }`, và chuyển `removed` sau `120` tick.

### 1.2. Bùa Gió
- **AC-2.1:** Đêm 2 có `C1` tại `(35, 0, 0)`; Đêm 3 có `C1` tại `(30, 0, 25)` và `C2` tại `(-30, 0, 25)`.
- **AC-2.2:** Nhặt bùa khi `XZ <= 1.0 m` và `|dy| <= 1.5 m` phát sự kiện `charm_picked { charm_id, charm_ticks: 600 }`, hiệu lực `600` tick (`10 s`, nhặt lại sẽ làm mới): tốc độ chạy tăng lên `7.2 m/s` và **Lướt không hồi chiêu** (vẫn cần nhấn lại phím, bỏ qua nếu đang trong `12` tick lướt).
- **AC-2.3:** Sau `2700` tick kể từ lúc bị nhặt, bùa hồi lại (`available: true`).

### 1.3. Chuỗi 3 Đêm
- **AC-3.1:** Luồng điều hướng đầy đủ: Menu chính → màn giới thiệu Đêm (hiển thị tên đảo & lời Ông Đăng) → gameplay → kết quả Đêm (`won`/`lost`).
- **AC-3.2:** Thắng Đêm 1 hoặc 2 cho phép chuyển sang Đêm kế tiếp và cộng dồn tổng điểm; thắng Đêm 3 hiển thị màn hình **Bình Minh** với tổng điểm cả 3 Đêm; thua cho phép chơi lại Đêm hiện tại.

### 1.4. Tạm dừng (`Esc` / `P`)
- **AC-4.1:** Nhấn `Esc`/`P` (hoặc `pause: true` rising edge) phát `paused {}`, đặt `state: "paused"`, đóng băng hoàn toàn `sim_tick`, `time_left_s`, hồi chiêu, spawn và TTL đom đóm rơi trong khi `tick` vẫn tăng.
- **AC-4.2:** Menu tạm dừng có đủ 4 lựa chọn: *Tiếp tục*, *Chơi lại Đêm*, *Cài đặt*, *Về menu*. Nhấn lại `Esc`/`P` hoặc *Tiếp tục* phát `resumed {}` và tiếp tục mô phỏng.

### 1.5. Cài đặt
- **AC-5.1:** Có thanh chỉnh **Âm lượng** và **Độ nhạy chuột**, lưu tự động vào `localStorage` (`dao-den-long-settings-v2`) và giữ nguyên sau khi tải lại trang.

### 1.6. Âm thanh
- **AC-6.1:** Có nhạc nền đêm tổng hợp bằng Web Audio API và đủ hiệu ứng âm thanh cho: nhặt đom đóm, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, nhặt bùa, Bóng Mực xuất hiện, cảnh báo gió mạnh, đếm ngược `10 s` cuối, thắng và thua.

### 1.7. HUD đầy đủ
- **AC-7.1:** Hiển thị đủ: Ngọn Lửa (trên trái), đồng hồ `mm:ss` (trên giữa, đổi màu `#FF5A5F` và nhấp nháy khi `<= 30 s`), đèn `k/n` và điểm (trên phải), thanh đom đóm `10` ô (dưới giữa), hồi chiêu Lướt và Tỏa Sáng (dưới phải).
- **AC-7.2:** Hiện nhắc `"E — Nạp ánh sáng (x/10)"` khi đứng trong `2.0 m` gần đèn chưa sáng; hiện mũi tên chỉ hướng viền màn hình tới đèn chưa sáng gần nhất khi đèn nằm ngoài khung hình.

### 1.8. Bảng màu chuẩn & Ánh sáng môi trường
- **AC-8.1:** Toàn bộ vật thể chính và UI dùng đúng mã màu hex chuẩn trong Ticket-02 (sai lệch `0%`, nằm trong giới hạn `±10%`).
- **AC-8.2:** Cường độ `HemisphereLight` cập nhật theo công thức `0.15 + 0.55 * (đèn sáng / tổng đèn)`.

---

## 2. Giả định bổ sung cho Phase 2

| Điểm cần làm rõ | Giả định áp dụng | Lý do |
|---|---|---|
| Vị trí xuất phát Đêm 3 (*Đảo Chuông*) | `(0, 0, -14)` quay mặt `+Z` | Tâm `(0, 0, 0)` nằm trong lõi vách đứng Tầng 2 (`R = 8 m, Y = 6`) và Tháp chuông (`R = 2 m`), nên xuất phát và hồi sinh tại `(0, 0, -14)` giúp Mây đứng trên mặt đất Tầng 0 thông thoáng và nhìn thẳng lên 3 tầng đảo. |
| Hiển thị Gió Lạc khi `removed` | Giữ trong snapshot `drifters[]` với `state: "removed"`, ẩn mesh 3D và loại khỏi giới hạn tối đa `2` con | Đảm bảo trạng thái `removed` trong Test Contract v1.1 quan sát được qua snapshot trong khi bản 3D biến mất đúng mô tả. |
| `ttl_s` của đom đóm thường (`random`) | `null` cho `"random"`, giây còn lại (`ttlTicks / 60`) cho `"dropped"` | Phân biệt rõ đom đóm vĩnh viễn trên đảo với đom đóm rơi có thời hạn `480` tick (`8.0 s`). |
