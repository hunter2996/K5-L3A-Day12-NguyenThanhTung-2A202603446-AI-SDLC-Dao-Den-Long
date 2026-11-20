# Ticket-02: Đảo Đèn Lồng — Phase 2 (Chuẩn hóa số liệu, 3 Đêm & Test Contract v1.1)

---

## Bối cảnh & Nguyên tắc

Đêm 1 đã chạy được. Nhà sản xuất chơi thử bản của các bạn và nhận thấy mỗi bản cho cảm giác điều khiển rất khác nhau. Ticket này gồm hai mục tiêu chính:

1. **Đồng bộ số liệu chuẩn** để mọi bản cho cảm giác điều khiển và cân bằng giống nhau.
2. **Mở rộng game thành 3 Đêm** cùng các tính năng mới.

> [!IMPORTANT]
> **Về sáng tạo:** Những gì bạn đã sáng tạo thêm ở Phase 1 vẫn được giữ, và bạn vẫn được thêm ý riêng (kể cả nhân vật mới và kẻ địch mới ngoài Bóng Mực và Gió Lạc), miễn là:
> - Số liệu chuẩn, bản đồ chuẩn và Test Contract v1.1 dưới đây **không bị đổi**.
> - Phần thêm **không làm đổi đầu ra headless** theo contract (ví dụ: tắt các thực thể/kỹ năng sáng tạo khi chạy headless).

---

## Phần 1 — Số liệu chuẩn (Bắt buộc)

Thay thế mọi giá trị tự chọn ở Phase 1 bằng các số liệu chuẩn dưới đây. Logic chạy ở **60 tick/giây cố định**. Đơn vị: **mét (`m`)**, **giây (`s`)**. Trục **Y hướng lên**.

### Bảng hằng số chuẩn

| Nhóm | Hằng số | Giá trị & Quy tắc |
|---|---|---|
| **Di chuyển** | Tốc độ chạy | `6.0 m/s`; tăng tốc/dừng trong `≤ 0.1 s`; điều khiển trên không đầy đủ |
| **Nhảy** | Vận tốc / trọng lực | Vận tốc `7.0 m/s`, trọng lực `−20 m/s²`, chỉ nhảy khi chạm đất |
| **Lướt (mới)** | Tốc độ / thời gian / hồi chiêu | `14 m/s` / `0.2 s` (`12` tick) / `1.5 s` (tính từ lúc bắt đầu lướt) |
| | Hướng & đặc tính | Hướng đang di chuyển; nếu đứng yên thì hướng nhân vật đang quay mặt. Lướt trên không giữ nguyên độ cao. **Không** bất tử khi lướt |
| **Đom đóm** | Sức chứa | `10` |
| | Nhặt | Tự động khi khoảng cách `XZ ≤ 1.0 m` và chênh cao giữa chân Mây và mặt đất nơi đặt đom đóm `≤ 1.5 m` |
| | Số lượng & lịch sinh | `20` lúc bắt đầu tại `20` điểm khác nhau; trần `30`; tại các tick `240, 480, …` sinh thêm `1` ở một điểm trống nếu dưới `30`; hết điểm trống thì bỏ lượt |
| **Đèn lồng** | Chi phí thắp | `10` đom đóm, nạp nhiều lần được, đèn nhớ tiến độ |
| | Tương tác | Trong bán kính `2.0 m`; mỗi lần bấm nạp `min(đang mang, còn thiếu)` vào một đèn. Chỉ xét đèn chưa sáng; chọn đèn gần nhất, bằng nhau thì `id` nhỏ hơn |
| | Vùng an toàn | Đèn đã sáng tạo vùng bán kính `6 m`: Bóng Mực ở ngoài bị chặn ở mép `6 m`. Bóng đang ở trong lúc đèn vừa thắp bị đẩy ra mép trong tối đa `30` tick và không gây sát thương trong lúc đó |
| **Tỏa Sáng** | Chi phí / bán kính / hồi chiêu | `3` đom đóm / `5 m` / `3 s` |
| | Hiệu ứng | Tâm = `chân Mây + 0.8 m`. Mục tiêu chốt ngay tick kích hoạt (khoảng cách **3D** tới tâm Bóng Mực `≤ 5 m`). Bóng Mực choáng `120` tick, trong `15` tick đầu bị đẩy lùi tổng `4 m` theo phương ngang (dừng nếu gặp vật cản; trùng vị trí thì đẩy theo `+X`). Pulse lại làm mới choáng và đẩy lùi. Không chết. Không đủ `3` đom đóm thì không kích hoạt |
| **Bóng Mực** | Tốc độ | `4.0 m/s` (Đêm 3: `4.5 m/s`) |
| | Phát hiện / bỏ đuổi | `12 m` / `18 m` |
| | Chạm | Khoảng cách `XZ ≤ 1.0 m` và chênh cao `≤ 1.5 m`. Tối đa `1` lần mất Ngọn Lửa mỗi tick. Bóng gây hit lùi `2 m` trong `60` tick (`recoil`); bóng chạm lúc Mây bất tử không làm gì |
| | Lịch sinh | `2` con tại tick `300`, sau đó `1` con mỗi khoảng sinh (tick `300 + 480k` ở Đêm 1); hết điểm hợp lệ thì bỏ lượt. Id `S1, S2, …` theo thứ tự sinh |
| **Bị đánh** | Hậu quả | `−1` Ngọn Lửa; rơi `floor(đang mang / 2)` đom đóm ra vành `1.5–2.5 m` quanh Mây (tồn tại `480` tick, nhặt lại được từ tick sau); bất tử `90` tick |
| **Rơi khỏi đảo** | Điều kiện `Y < −10` | Xảy ra đúng `1` lần, bỏ qua bất tử: `−1` Ngọn Lửa, mất toàn bộ đom đóm. Chờ `60` tick (không nhặt, không bị chạm), rồi hồi sinh ở điểm xuất phát, vận tốc `0`, bất tử `90` tick. Hết Ngọn Lửa thì thua ngay, không hồi sinh |
| **Máu** | Ngọn Lửa | `3`, hồi đầy đầu mỗi Đêm |
| **Thời gian** | Đêm 1 / 2 / 3 | `300` / `330` / `360 s` |
| **Thắng / thua** | Điều kiện kết thúc | Sau mỗi tick: hết Ngọn Lửa → luôn thua (`no_flames`); còn sống và tất cả đèn sáng → thắng (kể cả đúng tick hết giờ); còn lại mà hết giờ → thua (`dawn`) |

### Điểm số (Chuẩn hóa)

- **`+10`** mỗi đom đóm nạp vào đèn.
- **`+100`** mỗi đèn được thắp sáng.
- **`+5`** mỗi Bóng Mực trúng Tỏa Sáng (mỗi con mỗi lần, kể cả con đang choáng).
- Khi thắng Đêm: **`+ floor(giây còn lại) × 2 + 50 × Ngọn Lửa còn lại`**.
- **Tổng điểm game** = tổng điểm các Đêm đã thắng.

### Thứ tự xử lý trong một tick (Bắt buộc)

1. Đọc input (xử lý `pause` trước; nếu vừa tạm dừng thì dừng bước ở đây).
2. Giảm các bộ đếm: thời gian, hồi chiêu, bất tử, choáng, bùa, TTL đom đóm rơi, hồi bùa.
3. Di chuyển Mây (nhảy, lướt, bục nhảy, gió) rồi kiểm tra rơi khỏi đảo.
4. Nhặt đom đóm và bùa.
5. Tương tác với đèn.
6. Cập nhật vùng an toàn.
7. Tỏa Sáng.
8. Di chuyển Bóng Mực và Gió Lạc.
9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực gây hit (xét theo `id` tăng dần).
10. Sinh đom đóm, Bóng Mực, Gió Lạc theo lịch (thực thể mới chỉ tương tác được từ tick sau).
11. Xét thắng/thua.
12. Ghi snapshot nếu tới lượt.

> [!NOTE]
> Khi đang tạm dừng: `tick` vẫn tăng nhưng `sim_tick`, thời gian, hồi chiêu, spawn và TTL đều đứng yên; snapshot ghi `"state": "paused"`.

---

## Phần 2 — Bản đồ chuẩn

> **Quy ước góc:** Góc đo từ trục `+X`, ngược chiều kim đồng hồ khi nhìn từ trên xuống, trên mặt phẳng `XZ`.

### Đêm 1 — Đảo Bến (Chuẩn hóa lại)

- **Địa hình:** Đảo tròn tâm `(0, 0, 0)`, bán kính `40 m`. Ngoài `40 m` là biển mây (rơi).
- **Xuất phát:** `(0, 0, 0)`, quay mặt về `+Z`.
- **5 Đèn (`L1…L5`):**
  - `L1`: `(0, 0, 25)`
  - `L2`: `(23.8, 0, 7.7)`
  - `L3`: `(14.7, 0, −20.2)`
  - `L4`: `(−14.7, 0, −20.2)`
  - `L5`: `(−23.8, 0, 7.7)`
- **Điểm sinh đom đóm (24):** `8` điểm trên bán kính `12 m` (mỗi `45°`) và `16` điểm trên bán kính `33 m` (mỗi `22.5°`).
- **Bóng Mực:** Sinh trên `12` điểm bán kính `37 m` (`15°, 45°, …`), cách người chơi `≥ 15 m`; `2` con lúc giây thứ `5` (tick `300`), sau đó mỗi `8 s` (`480` tick); tối đa `6`.

### Đêm 2 — Đảo Cau (Mới)

- **Địa hình:** Hai đảo tròn bán kính `28 m`, tâm `A (0, 0, 0)` và `B (70, 0, 0)`, nối bằng **cầu tre** `x ∈ [26, 44]`, `z ∈ [−2, 2]`, không lan can.
- **Bục nhảy:** Hình tròn bán kính `1 m` tại `(20, 0, 18)` và `(50, 0, −18)`: chân Mây chạm bục thì được bắn lên với vận tốc `Y = 14 m/s` và vận tốc ngang `24 m/s` hướng về tâm đảo kia. Vận tốc phóng giữ nguyên tới khi chạm đất (phím di chuyển không ghi đè; vẫn được lướt). Bay khoảng `1.4 s`, đáp trong đảo đích.
- **Điểm sinh đom đóm mỗi đảo (12 × 2 = 24):** `4` điểm trên bán kính `10 m` (`0°, 90°, 180°, 270°`) và `8` điểm trên bán kính `22 m` (mỗi `45°`).
- **Điểm sinh Bóng Mực (8 × 2 = 16):** `8` điểm bán kính `26 m` mỗi đảo (`22.5°, 67.5°, …`).
- **6 Đèn (`L1…L6` theo đúng thứ tự):**
  - `L1`: `(0, 0, 20)` · `L2`: `(17, 0, −10)` · `L3`: `(−17, 0, −10)`
  - `L4`: `(70, 0, 20)` · `L5`: `(87, 0, −10)` · `L6`: `(53, 0, −10)`
- **Bóng Mực:** Sinh mỗi `7 s`, tối đa `8`.

### Đêm 3 — Đảo Chuông (Mới)

- **Địa hình 3 tầng:** Đảo tròn bán kính `45 m`:
  - **Tầng 0 (`Y = 0`):** Toàn đảo.
  - **Tầng 1 (`Y = 3`):** Vành khăn bán kính `12–24 m` ở nửa có `z > 0`.
  - **Tầng 2 (`Y = 6`):** Đĩa bán kính `8 m` ở tâm.
  - Mép các tầng là vách đứng (không đi lên được; bước ra thì rơi xuống tầng dưới).
- **Dốc & Bục nhảy & Vật cản:**
  - `2` dốc thẳng rộng `3 m` dọc theo bán kính ở góc `30°` và `150°`: chân dốc ở bán kính `30 m` (`Y = 0`), đỉnh dốc ở bán kính `24 m` (`Y = 3`).
  - Bục nhảy bán kính `1 m` tại `(0, 3, 13)`: vận tốc `Y = 12 m/s` và vận tốc ngang `8 m/s` hướng `−Z`, giữ tới khi chạm đất → đáp lên tầng 2.
  - **Tháp chuông** cao `8 m` ở tâm tầng 2, hình trụ bán kính `2 m`, không leo được.
- **Điểm sinh đom đóm (30):**
  - Tầng 0: `18` điểm bán kính `34 m` (mỗi `20°` từ `0°`).
  - Tầng 1: `8` điểm bán kính `18 m` (`20°, 40°, …, 160°`).
  - Tầng 2: `4` điểm bán kính `5 m` (`45°, 135°, 225°, 315°`).
- **Điểm sinh Bóng Mực:** `16` điểm bán kính `43 m` (mỗi `22.5°`).
- **7 Đèn (`L1…L7`):** `(0, 6, 6)`, `(18, 3, 10)`, `(−18, 3, 10)`, `(35, 0, −10)`, `(−35, 0, −10)`, `(20, 0, −35)`, `(−20, 0, −35)`.
- **Gió mạnh:** Mỗi `30 s` có một cơn gió kéo dài `5 s` theo hướng ngẫu nhiên, đẩy người chơi `2 m/s`; báo trước `2 s` bằng lá bay và âm thanh.
- **Bóng Mực:** Tốc độ `4.5 m/s`, sinh mỗi `6 s`, tối đa `10`.

---

## Phần 3 — Tính năng mới

### 1. Gió Lạc (Đêm 2 và 3)

- Dải lụa xám xanh bay nhanh (`7 m/s`), tối đa `2` con, sinh tại tick `1200, 2400, …` trên điểm sương ngẫu nhiên, `id` là `D1, D2, …`.
- **Trạng thái:** `idle` (lượn chậm `2 m/s`) → `chase` → `flee` → `removed`.
- `idle → chase` khi Mây mang `≥ 5` đom đóm và cách `≤ 15 m` (kiểm tra mỗi tick); điều kiện mất thì về `idle`.
- **Chạm (`XZ ≤ 1.2 m`):** Cướp `min(3, đang mang)` đom đóm, chuyển `flee` (bay ra xa Mây `7 m/s` trong `240` tick rồi biến mất cùng số đã cướp). Mỗi con chỉ cướp `1` lần.
- **Tỏa Sáng trúng Gió Lạc:**
  - Nếu đang `chase` → chuyển `flee` không cướp.
  - Nếu đang `flee` có mang đồ → thả lại toàn bộ đom đóm đã cướp tại chỗ (thành đom đóm rơi), biến mất sau `120` tick.
- Không làm mất Ngọn Lửa; vùng an toàn của đèn **không** chặn Gió Lạc; bất tử của Mây **không** ngăn bị cướp.

### 2. Bùa Gió

- Lá bùa đỏ viền vàng, `id`: `C1`, `C2`. Nhặt theo luật như đom đóm.
- **Hiệu lực:** `600` tick (nhặt lại thì làm mới): tốc độ chạy `7.2 m/s` và **Lướt không hồi chiêu** (vẫn cần nhấn lại nút; nhấn khi đang lướt bị bỏ qua; lướt vẫn `14 m/s` trong `12` tick).
- Bùa xuất hiện lại sau `2700` tick.
- **Vị trí:**
  - Đêm 2: `(35, 0, 0)`.
  - Đêm 3: `(30, 0, 25)` và `(−30, 0, 25)`.

### 3. Chuỗi 3 Đêm, Tạm dừng, Cài đặt, Âm thanh & HUD

- **Chuỗi 3 Đêm:** Menu chính → giới thiệu Đêm (tên đảo, lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. Thắng Đêm 3 thì hiện màn hình **Bình Minh** với tổng điểm. Thua thì được chơi lại Đêm đó.
- **Tạm dừng (`Esc` / `P`):** Logic dừng hoàn toàn. Có các lựa chọn: *Tiếp tục* / *Chơi lại Đêm* / *Cài đặt* / *Về menu*.
- **Cài đặt:** Âm lượng và độ nhạy chuột, được lưu giữa các lần mở game (`localStorage`).
- **Âm thanh:** Nhạc nền đêm và hiệu ứng cho: nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược `10 s` cuối.
- **HUD đầy đủ:**
  - Ngọn Lửa (trên trái).
  - Đồng hồ `mm:ss` (trên giữa, đổi màu đỏ và nhấp nháy khi `≤ 30 s`).
  - Đèn `k/n` và điểm (trên phải).
  - Thanh đom đóm `10` ô (dưới giữa).
  - Biểu tượng hồi chiêu **Lướt** và **Tỏa Sáng** (dưới phải).
  - Nhắc `"E — Nạp ánh sáng (x/10)"` khi đứng gần đèn.
  - Mũi tên chỉ tới đèn chưa sáng gần nhất khi nó ở ngoài màn hình.

### 4. Bảng màu chuẩn

Sai lệch tối đa `10%` mỗi kênh RGB; áp dụng cho các thành phần liệt kê, màu cho chi tiết khác tự chọn:

| Dùng cho | Hex |
|---|---|
| Trời đêm / sương | `#0E1430` / `#1B2350` |
| Cỏ / cát / gỗ / biển mây | `#2F5D50` / `#C9B48A` / `#6B4A2F` / `#12384A` |
| Đèn sáng / lõi / đèn tắt | `#FFB347` / `#FFE9B0` / `#5B5F6E` |
| Đom đóm lõi / quầng | `#FFF6C2` / `#FFE58A` |
| Bóng Mực thân / viền / bị choáng | `#120A1A` / `#7A3CFF` / `#3A3450` |
| Áo Mây / khăn Mây và Bùa Gió | `#E8E2D0` / `#C8102E` |
| Viền vàng, điểm số / Gió Lạc | `#F2C14E` / `#8FA3B8` |
| UI nguy hiểm / chữ UI | `#FF5A5F` / `#F5F1E6` |

- **Ánh sáng môi trường tăng theo tiến độ:**
  $$\text{cường độ} = 0.15 + 0.55 \times \frac{\text{đèn sáng}}{\text{tổng đèn}}$$

---

## Phần 4 — Test Contract v1.1 (Thay đổi so với v1.0)

- `contract_version`: `"1.1"`; `tuning` phải khớp số chuẩn ở Phần 1, thêm các khóa:
  - `dash_speed`, `dash_duration_s`, `dash_cooldown_s`
  - `night2_duration_s`, `night3_duration_s`
- `--night` nhận `1`, `2`, `3`.
- **Snapshot gốc** thêm `night`, `wind: { active, dir_deg }`. `player` thêm `vel`, `grounded`, `invuln`, `dash_cd_s`, `pulse_cd_s`, `charm_s`.
- **Snapshot** thêm các mảng bắt buộc:
  - `motes`: `id`, `pos`, `kind` (`"random"` / `"dropped"`), `ttl_s`
  - `drifters`: `id`, `pos`, `state`, `stolen`
  - `charms`: `id`, `available`, `respawn_s`
- **Scenario** thêm:
  - `player.{invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks}`
  - `shades[].{state, state_ticks_left}`
  - `drifters`, `charms`, cờ `random_drifters`, `wind_enabled`
  - Các mảng `drifters`, `charms` thay thế danh sách mặc định.
- **Input** thêm `dash` và `pause` (đều kích hoạt khi chuyển `false → true`).
- **Sự kiện mới:**
  - `dash`: `{}`
  - `charm_picked`: `{"charm_id": ..., "charm_ticks": ...}`
  - `drifter_steal`: `{"drifter_id": ..., "amount": ..., "carried": ...}`
  - `drifter_drop`: `{"drifter_id": ..., "amount": ...}`
  - `night_start`: `{"night": ...}`
  - `paused`: `{}`
  - `resumed`: `{}`
  - `player_hit` do rơi thêm trường `lost`.
- Từ v1.1, trạng thái Bóng Mực phải dùng đúng tên: **`spawning`**, **`wander`**, **`chase`**, **`recoil`**, **`stunned`**.
- Chạy headless một Đêm đầy đủ (tối đa `21.600` tick) phải xong trong `≤ 30` giây.

---

## Định nghĩa hoàn thành (DoD)

- [ ] Có bằng chứng game chạy đúng các yêu cầu của phase (định dạng tự chọn).
- [ ] Mọi test ẩn Phase 1 vẫn đạt khi chạy với số chuẩn (**regression**).
- [ ] Tài liệu spec của bạn (tên và vị trí tự chọn) có **acceptance criteria** cho từng mục ở Phần 3.
- [ ] File hướng dẫn agent (`AGENTS.md` hoặc tương đương) và các skill được cập nhật cho phạm vi mới (lịch sử git phải thể hiện).
- [ ] Test của bạn có ít nhất `1` scenario headless cho mỗi tính năng mới.
- [ ] Bản thường đạt `≥ 30 FPS` trung bình ở `1280×720`.
