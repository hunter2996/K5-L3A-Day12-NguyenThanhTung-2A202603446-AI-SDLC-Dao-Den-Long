# Changelog — Đảo Đèn Lồng

Tất cả thay đổi đáng chú ý của dự án **Đảo Đèn Lồng** qua 4 Phase phát triển.

---

## [v1.0.0] — Phase 4: Phát hành & Đóng gói (`Contract v1.3`)

### Tính năng mới
- **Chế độ Benchmark chuẩn ([src/bench.js](src/bench.js)):** `node src/bench.js --seed 42 --duration 30 --out bench.json` mở cửa sổ `1280×720` tắt VSync (`--disable-frame-rate-limit --disable-gpu-vsync`), tải Đêm 1 với `200` Bóng Mực `wander`, `100` đom đóm, `L1–L3` `fuel 100`, camera bay quỹ đạo tròn `R=30, Y=15` trong `15 s/vòng` từ `(30,15,0)`, `3 s` warmup rồi xuất đầy đủ số đo `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms`, `peak_mem_mb`, `vsync_off`, `renderer`, `os`. Tắt toàn bộ nhân vật/kỹ năng sáng tạo trong cảnh benchmark.
- **Soak Test 10 Đêm ([src/soak.js](src/soak.js)):** Chạy headless `10` Đêm xoay vòng `1 -> 2 -> 3` với seed `7 + i`, input ngẫu nhiên theo seed, kiểm chứng `crashes = 0` và `mem_end_mb <= 1.2 × mem_start_mb`.
- **Bảng xếp hạng cục bộ ([src/serve.js](src/serve.js), [index.html](index.html), [src/game.js](src/game.js)):** Lưu điểm sau màn hình Bình Minh (thắng Đêm 3) hoặc thua ở bất kỳ Đêm nào; kiểm tra tên `3–12` ký tự (hỗ trợ cả tiếng Việt có dấu), lưu top `10` trên đĩa (`score` giảm dần, bằng điểm xét đạt trước đứng trên), màn hình Bảng xếp hạng ở Menu chính và CLI `--export-leaderboard <out.json>`.
- **Dễ tiếp cận (Accessibility):**
  - Đổi toàn bộ `9` phím điều khiển chính (4 hướng, nhảy, lướt, tương tác, tỏa sáng, tạm dừng), cảnh báo trùng phím, nút **"Khôi phục mặc định"**, lưu tự động vào `localStorage`.
  - Phụ đề & chỉ báo hình ảnh khi Bóng Mực xuất hiện (kèm mũi tên chỉ hướng ở mép màn hình), gió sắp thổi, `10 s` cuối và đèn có `fuel < 30`.
  - Chế độ **Giảm chuyển động** (tắt rung camera, chớp màn hình, nhấp nháy đồng hồ).
  - Cỡ chữ UI mặc định `≥ 18 px` ở `1280×720` kèm tùy chọn **Cỡ chữ lớn (`×1.25`)**.
- **Đóng gói & Tài liệu:** Thêm `Dockerfile`, script đóng gói `scripts/package-release.js`, [docs/notes/retro.md](docs/notes/retro.md), [CHANGELOG.md](CHANGELOG.md), cập nhật [README.md](README.md) và [CREDITS.md](CREDITS.md) (loại bỏ tệp `.mp3` ngoài bản quyền không sử dụng).

### Tối ưu hiệu năng & Sửa lỗi
- Chia sẻ GPU geometry & pooled material theo trạng thái cho `Bóng Mực` (`InstancedMesh` cho mây, gộp mesh hai mắt) và đặt `pixelRatio = 1`, giúp benchmark `200` Bóng Mực trên `Intel Iris Xe` đạt `88.3 FPS` trung bình và `load_ms = 1745 ms`.
- Thêm `createBenchGame(seed)` và tối ưu giảm cấp phát mảng tạm trong `sim.step`, rút ngắn chạy `18.000` tick Đêm 3 xuống `~279 ms`.

---

## [Phase 3] — Change Request "Đèn cạn dầu" (`Contract v1.2`)

### Breaking Changes (chi tiết tại [docs/notes/changelog-phase3.md](docs/notes/changelog-phase3.md))
- Chuyển mô hình Đèn Lồng Lớn sang **nhiên liệu động** tính bằng số nguyên `1/60` (`fuelUnits`, tối đa `6000` = `100` fuel): hao `1.0/s`, châm dầu `used = min(carried, ceil((100 - fuel)/10))`, hết dầu tắt (`lantern_out`, `ever_lit = true`), thắp lại tốn `5` đom đóm (`+40` điểm).
- Đèn `fuel < 30` mất vùng an toàn `6 m` và nhấp nháy `1 Hz`; Bóng Mực `wander` ưu tiên tìm đèn yếu và hút `5/s` ở trạng thái `drain` (ghi `fuel_drain` mỗi `60` tick; Tỏa Sáng trúng thưởng `+15`; hết choáng về `wander`).
- Bỏ thắng sớm `all_lit`; thời lượng Đêm đổi thành `240 / 270 / 300 s`; thắng `dawn_survived` khi giữ sáng `≥ ceil(0.6 × tổng đèn)` tới bình minh (`no_flames` luôn ưu tiên trước).
- Sức chứa tăng dần `min(20, 10 + 2 × successful_lights)`; cập nhật thang điểm (`per_mote = 5`, bỏ `per_second_left`).
- Giao diện thêm thanh dầu billboard, đèn tắt xẹp `20%` kèm vết rách giấy, và **Chế độ mù màu** (`#00B3FF` & `#FFFFFF ⚠`) lưu `localStorage`.

---

## [Phase 2] — Chuẩn hóa 3 Đêm & Kỹ năng mới (`Contract v1.1`)

- Chuẩn hóa toàn bộ thông số vận tốc (`6.0 m/s`), nhảy (`7.0 m/s`, `-20 m/s²`), **Lướt (`Dash`)** (`14 m/s`, `0.2 s`, hồi `1.5 s`), **Tỏa Sáng 3D** (`-3` đom đóm, `5 m`, choáng `120` tick, đẩy lùi `4 m`).
- Mở rộng thành 3 màn: **Đêm 1 (Đảo Bến)**, **Đêm 2 (Đảo Cau — cầu tre, 2 bục nhảy, Gió Lạc, Bùa Gió)**, **Đêm 3 (Đảo Chuông — địa hình 3 tầng, dốc, tháp chuông, gió mạnh)**.
- Bổ sung bộ kỹ năng sáng tạo trên trình duyệt (`[J]` Lốc Xoáy Mini, `[K]` Tường Gió, `[L]` Trảm Không), Bóng Mực dạng cầu ánh sáng tím mờ và nhạc nền/SFX Web Audio đa âm không dùng tài sản bản quyền ngoài.

---

## [Phase 1] — Nguyên mẫu Đảo Bến (`Contract v1.0`)

- Ra mắt vòng chơi cốt lõi Đêm 1 **Đảo Bến** với nhân vật Mây đội nón lá cầm đèn, 5 Đèn Lồng Lớn, đom đóm rải trên đảo, Bóng Mực rượt đuổi, HUD cơ bản và lõi mô phỏng tất định `60 tick/s` tách riêng cho chế độ headless.
