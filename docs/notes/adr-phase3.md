# ADR-003: Chuyển đổi Mô hình Trạng thái Đèn có Nhiên liệu & Luật Thắng Giữ Đảo Sáng Tới Bình Minh (Phase 3)

- **Trạng thái:** Đã chấp nhận và triển khai (`Phase 3`, Test Contract `v1.2`)
- **Tham chiếu:** [Ticket-03.md](../../Ticket-03.md), [src/sim.js](../../src/sim.js), [game.contract.json](../../game.contract.json)

## Bối cảnh (Context)

Ở Phase 1–2 (`Contract v1.0 / v1.1`), Đèn Lồng Lớn chỉ có hai trạng thái tuyến tính một chiều: `unlit -> lit`. Khi thắp xong `1` đèn, đèn sáng vĩnh viễn và tạo vùng an toàn bất khả xâm phạm `6 m`. Khi thắp đủ toàn bộ đèn (`5 / 6 / 7`), màn chơi kết thúc thắng ngay (`all_lit`) và cộng thưởng theo giây còn lại (`per_second_left: 2`).

Playtest chỉ ra rằng người chơi thành thạo thắp hết đèn sau khoảng ~2 phút và kết thúc màn sớm, làm phần cuối Đêm thiếu áp lực sinh tồn và khiến các đèn đã thắp mất vai trò chiến thuật.

## Quyết định thiết kế (Decision)

### 1. Mô hình trạng thái & Nhiên liệu Đèn (`fuelUnits` nguyên 1/60)

Thay thế trạng thái nhị phân vĩnh viễn bằng máy trạng thái có vòng đời tắt/thắp lại gắn liền nhiễu nhiên liệu:

```
   [Chưa từng sáng]  -- nạp 10 đom đóm -->  [Đang sáng: fuel = 100, ever_lit = true]
   (ever_lit=false,                         (an toàn 6m khi fuel >= 30; hao 1/60 mỗi tick)
    scale.y = 0.8 + rách giấy)                      |                 ^
         ^                                          v fuel < 30       | châm dầu:
         |                                  [Đèn yếu: mất vùng 6m]    | min(carried, ceil((100-fuel)/10))
         |                                  (nhấp nháy 1 Hz;          | (+10/đom đóm; đẩy Bóng ra <=30t khi >=30)
         |                                   thu hút Bóng Mực `drain`)
         |                                          |
         +------ fuel <= 0 (`lantern_out`) ---------+
         |
   [Đèn tắt từng sáng] -- nạp 5 đom đóm (`relight_cost`) -> [Đang sáng lại: fuel=100, relit_count+=1]
```

- **Biểu diễn số học:** Nhiên liệu lưu bằng số nguyên **`fuelUnits`** (bội số `1/60`, tối đa `6000` ứng `fuel = 100`, ngưỡng `1800` ứng `30`, mỗi đom đóm châm thêm `600` ứng `10`). Việc cộng/trừ số nguyên tuyệt đối loại bỏ sai số số thực dấu phẩy động IEEE-754 sau hàng chục nghìn tick, chỉ chia `60` và làm tròn `1` chữ số thập phân khi xuất snapshot/event (`fuel`).
- **Tương tác thống nhất ở Bước 5:** Cùng một nút `E/F` xử lý cả nạp thắp mới (`10`), thắp lại (`5` khi `ever_lit === true`), và châm dầu cho đèn đang sáng nhưng chưa đầy (`fuelUnits < 6000`). Đèn đầy dầu (`used === 0`) bị loại ngay từ bước chọn mục tiêu gần nhất để không lãng phí thao tác và không phát sự kiện thừa.

### 2. Đồng bộ Trạng thái Bóng Mực `drain` & Bảo toàn Kỹ năng Sáng tạo

- Bóng Mực ở trạng thái `wander` ưu tiên tìm đèn yếu (`lit && fuel < 30`) gần nhất; vào trong `2 m` chuyển sang `drain`, đứng yên và hút `5/60` nhiên liệu mỗi tick (cộng dồn nhiều con, ghi `fuel_drain` mỗi `60` tick đang hút). Hết `stunned` luôn về `wander` để tránh kẹt vòng lặp lao thẳng vào hút hoặc ép `chase` ngay lập tức.
- Bộ kỹ năng trình duyệt (`[J]` Lốc Xoáy Mini, `[K]` Tường Gió, `[L]` Trảm Không) giữ nguyên hoàn toàn ở tầng hiển thị (`src/game.js`), đồng bộ xóa `targetLanternId` & `drainTicks` khi hất tung Bóng Mực đang `drain` mà không làm đổi bất kỳ kết quả nào của `src/headless.js`.

### 3. Luật Thắng Giữ Đảo Sáng & Sức chứa Tăng dần

- Loại bỏ kết thúc sớm `all_lit`. Mỗi Đêm giờ có độ dài cố định mới (`240 / 270 / 300 s`), buộc người chơi phân phối đom đóm qua cơ chế **sức chứa tăng dần** `min(20, 10 + 2 * successful_lights)`.
- **Thứ tự xét kết thúc ở Bước 11:** Luôn kiểm tra `p.flames <= 0` (`no_flames`) **trước** xét bình minh (`time_left_s <= 0`), bảo đảm chạm chết ngay ở tick cuối vẫn tính thua. Khi còn sống lúc bình minh, thắng (`dawn_survived`) khi số đèn sáng `>= ceil(0.6 * total)` (`3/5`, `4/6`, `5/7`).

## Hệ quả (Consequences)

- **Tích cực:** Tạo nhịp điệu phòng thủ/luân chuyển liên tục tới giây cuối của Đêm; các bài test regression cũ được phân loại rõ phần giữ nguyên vs phần cập nhật theo luật mới; `headless.js` chạy `18.000` tick Đêm 3 dưới `0.5 s`.
- **Đánh đổi:** Phá vỡ tương thích ngược với điểm số, thời lượng và điều kiện thắng của Test Contract v1.1 (chi tiết trong [changelog-phase3.md](changelog-phase3.md)).
