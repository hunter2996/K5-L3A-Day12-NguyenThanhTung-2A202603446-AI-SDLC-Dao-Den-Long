---
name: verify-phase3
description: Quy trình kiểm chứng bắt buộc cho Phase 3 (Change Request Đèn cạn dầu, Test Contract v1.2, ADR, changelog và bộ skill J/K/L trên bản 3D).
---

# Skill: Kiểm chứng Phase 3 — Đảo Đèn Lồng

Kích hoạt quy trình này trước khi hoàn thành mọi thay đổi Phase 3.

## Các bước thực hiện
1. Chạy kiểm tra cú pháp và toàn bộ test v1.2:
   ```bash
   npm run build
   npm test
   ```
2. Xác nhận `game.contract.json` (`contract_version: "1.2"`) khớp `sim.DEFAULT_TUNING`.
3. Xác nhận các test cũ bị `[THAY THẾ]` đã được cập nhật kèm lý do rõ ràng (không skip âm thầm) và mọi tính năng Phase 3 (nhiên liệu `1/60`, châm dầu, tắt đèn, thắp lại `5` đom đóm, Bóng Mực `drain`, sức chứa tăng dần, thắng `dawn_survived`, điểm mới) đều có scenario headless đạt.
4. Kiểm tra bản 3D trình duyệt ở `1280x720`: thanh dầu & nhấp nháy `fuel < 30`, đèn tắt xẹp `20%` rách giấy, chế độ mù màu (`#00B3FF` & `#FFFFFF ⚠`) lưu `localStorage`, giữ nguyên bộ skill `Shift`/`Q`/`J`/`K`/`L` và nhạc Web Audio.
