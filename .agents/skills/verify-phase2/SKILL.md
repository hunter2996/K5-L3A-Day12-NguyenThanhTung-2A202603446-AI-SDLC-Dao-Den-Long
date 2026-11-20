---
name: verify-phase2
description: Quy trình kiểm chứng bắt buộc cho Phase 2 (Test Contract v1.1, regression Phase 1, headless 21.600 ticks và bản 3D 1280x720).
---

# Skill: Kiểm chứng Phase 2 — Đảo Đèn Lồng

Kích hoạt quy trình này trước khi kết thúc mọi thay đổi code trong Phase 2.

## Các bước thực hiện
1. Chạy kiểm tra cú pháp và toàn bộ test tự động:
   ```bash
   npm run build
   npm test
   ```
2. Xác nhận `game.contract.json` (`contract_version: "1.1"`) khớp `sim.DEFAULT_TUNING`.
3. Xác nhận hiệu năng headless `--night 3 --ticks 21600` hoàn tất dưới `30 s` (thực tế mục tiêu `< 2 s`).
4. Mở game trình duyệt ở độ phân giải `1280x720`, kiểm tra không có lỗi console, thử chuỗi Đêm 1/2/3, Lướt (`Shift`), Tỏa Sáng (`Q`), Tạm dừng (`Esc`), bộ kỹ năng Lốc Xoáy (`J`) / Tường Gió (`K`) / Trảm Không (`L`), và ghi nhận FPS trung bình `>= 30 FPS`.
