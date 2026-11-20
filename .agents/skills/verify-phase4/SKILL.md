---
name: verify-phase4
description: Quy trình kiểm chứng bắt buộc cho Phase 4 (Test Contract v1.3, Benchmark 1280x720, Soak test 10 Đêm, Bảng xếp hạng cục bộ, Dễ tiếp cận, Đóng gói & Retro).
---

# Skill: Kiểm chứng Phase 4 — Phát hành v1.0.0

Kích hoạt quy trình này trước khi gắn tag `phase-4` và phát hành `v1.0.0`.

## Các bước thực hiện
1. Kiểm tra cú pháp & toàn bộ test Contract v1.3 + regression Phase 1–3:
   ```bash
   npm run build
   npm test
   ```
2. Chạy benchmark chuẩn và kiểm tra `bench.json` (có `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms`, `peak_mem_mb`, `vsync_off`, `renderer`, `os`):
   ```bash
   node src/bench.js --seed 42 --duration 30 --out bench.json
   ```
3. Chạy soak test 10 Đêm liên tiếp và kiểm tra `crashes = 0`, `mem_end_mb <= 1.2 * mem_start_mb`:
   ```bash
   node src/soak.js --seed 7 --nights 10 --out soak.json
   ```
4. Kiểm tra CLI bảng xếp hạng và khởi chạy sạch tối đa 3 lệnh:
   ```bash
   node src/serve.js --export-leaderboard out.json
   ```
5. Kiểm tra trên trình duyệt `1280x720`:
   - Cỡ chữ UI `>= 18 px` và tùy chọn chữ lớn (`×1.25`) không bị cắt/chồng lấn.
   - Đổi phím, cảnh báo trùng phím, "Khôi phục mặc định", lưu `localStorage`.
   - Phụ đề/chỉ báo hình ảnh (Bóng Mực xuất hiện + mũi tên mép, gió sắp thổi, `10 s` cuối, đèn `< 30`), Giảm chuyển động.
   - Bảng xếp hạng cục bộ lưu tên `3–12` ký tự, xếp hạng top 10, còn sau khi tải lại trang.
   - Bộ kỹ năng sáng tạo `[Shift]`, `[Q]`, `[J]`, `[K]`, `[L]` và nhạc Web Audio vẫn hoạt động khi chơi thật.
