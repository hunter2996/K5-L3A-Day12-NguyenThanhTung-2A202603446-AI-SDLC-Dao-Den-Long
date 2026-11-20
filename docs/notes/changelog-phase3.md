# Changelog — Breaking Changes Phase 3 (Contract v1.1 -> v1.2)

Tài liệu liệt kê toàn bộ các thay đổi phá vỡ tương thích (*breaking changes*) khi áp dụng [Ticket-03.md](../../Ticket-03.md) ("Đèn cạn dầu") từ Phase 2 (`Contract v1.1`) sang Phase 3 (`Contract v1.2`).

## 1. Test Contract & Thông số chuẩn ([game.contract.json](../../game.contract.json))

- **`contract_version`:** `"1.1"` -> **`"1.2"`**.
- **`tuning` thêm khóa mới:**
  - `capacity_max: 20`
  - `relight_cost: 5`
  - `fuel_max: 100`
  - `fuel_decay_per_s: 1.0`
  - `fuel_per_mote: 10`
  - `win_ratio: 0.6`
  - `drain_per_s: 5`
  - `low_fuel_threshold: 30`
- **`tuning` thay đổi giá trị cũ (Breaking):**
  - `night1_duration_s`: `300` -> **`240`**
  - `night2_duration_s`: `330` -> **`270`**
  - `night3_duration_s`: `360` -> **`300`**
  - `score.per_mote`: `10` -> **`5`**
  - `score.per_second_left`: `2` -> **`0`** (bỏ thưởng thời gian còn lại)

## 2. Luật chơi cốt lõi (`[THAY THẾ]`)

- **Đèn cạn dầu & Châm dầu:** Đèn đang sáng không còn khóa cứng: hao `1.0` dầu/giây (`1/60` tick), nhận thêm đom đóm bằng công thức `used = min(carried, ceil((100 - fuel) / 10))`. Đèn về `fuel <= 0` tắt (`deposited = 0`, `ever_lit = true`), thắp lại chỉ tốn `5` đom đóm (`+40` điểm).
- **Mất vùng an toàn & Hút dầu:** Đèn sáng có `fuel < 30` mất vùng an toàn `6 m`; Bóng Mực `wander` ưu tiên tìm đèn yếu vào trạng thái `drain` (`5` fuel/giây mỗi con, cộng dồn). Hết `stunned` luôn về `wander`.
- **Sức chứa tăng dần:** Tăng từ `10` theo `min(20, 10 + 2 * successful_lights)` (reset `0` mỗi Đêm, bỏ qua đèn đặt sẵn bởi scenario).
- **Luật thắng & Thang điểm:** Bỏ thắng sớm `all_lit`; phải trụ tới hết giờ (`dawn_survived`) với ít nhất `ceil(0.6 * total)` đèn đang sáng (`3/5`, `4/6`, `5/7`). Điểm thắng bình minh đổi thành `+50 + floor(fuel)` mỗi đèn đang sáng và `+50` mỗi Ngọn Lửa còn lại; Tỏa Sáng trúng con đang `drain` thưởng `+15` thay vì `+5`.

## 3. Đầu ra Headless JSONL & Schema Scenario (`v1.2`)

- **Snapshot:**
  - `player` thêm `capacity`.
  - `lanterns[]` thêm `fuel` (`1` chữ số thập phân, `0` khi tắt), `ever_lit`, `relit_count`.
  - `shades[].state` thêm giá trị `"drain"`.
- **Scenario đầu vào:**
  - `player` hỗ trợ `successful_lights`.
  - `lanterns[]` hỗ trợ `lit`, `fuel` (mặc định `100` nếu `lit: true` không ghi `fuel`), `ever_lit`.
  - `shades[]` hỗ trợ `state: "drain"` và `target_lantern_id`.
- **Events:**
  - Thêm `refuel`, `lantern_out`, `fuel_drain` (ghi mỗi `60` tick đang hút).
  - `lantern_lit` thêm trường `"relight": true | false`.
  - `game_over.reason` dùng `"dawn_survived"` khi thắng; không còn `"all_lit"`.

## 4. Thay đổi Giao diện & Khả năng tiếp cận ([index.html](../../index.html), [src/game.js](../../src/game.js))

- Thêm thanh dầu `fuel` billboard phía trên đèn sáng và nhấp nháy chậm `1 Hz` khi `fuel < 30`.
- Đèn tắt bị xẹp `20%` chiều dọc và có vết rách giấy để phân biệt không cần màu.
- Thêm cài đặt **"Bảng màu dễ phân biệt"** lưu qua `localStorage`: viền/mắt Bóng Mực `#7A3CFF -> #00B3FF`, màu cảnh báo UI `#FF5A5F -> #FFFFFF` kèm biểu tượng `⚠`.
- Giữ nguyên nhân vật phụ **Cụ Đò**, nhạc nền/SFX **Web Audio**, và bộ kỹ năng `[Shift]` Lướt / `[Q]` Tỏa Sáng / `[J]` Lốc Xoáy Mini / `[K]` Tường Gió / `[L]` Trảm Không.
