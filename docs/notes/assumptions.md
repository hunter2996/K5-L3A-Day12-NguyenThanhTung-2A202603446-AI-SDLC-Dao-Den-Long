# Giả định & Tiêu chí nghiệm thu — Phase 1 (Đêm 1: Đảo Bến)

## 1. Giả định cho các điểm mơ hồ trong PRD-0

| Điểm chưa quy định cụ thể | Giả định đã chọn | Lý do |
|---|---|---|
| Kích thước đảo tròn Đảo Bến | Bán kính `42.0m`, giới hạn di chuyển `41.5m`, `fall_enabled: false` | Khớp tọa độ ví dụ trong PRD-0 (`L1` tại `[0,0,25]`, Shade tại `[30.1,1,2]`), tránh rơi oan khi thử nghiệm tự động. |
| Vị trí 5 Đèn Lồng Lớn (`L1..L5`) | Bố trí đều trên vòng tròn bán kính `25.0m` quanh `(0,0,0)` với `L1` tại `[0,0,25]` | Giữ đúng tọa độ ví dụ trong Test Contract, các vùng an toàn `safe_radius = 6.0m` không chồng lấn. |
| Số lượng & tái sinh đom đóm | Khởi tạo 24 đom đóm (`random_motes: true`); tự bổ sung tối thiểu `max(16, còn_thiếu + 4)` mỗi 2 giây | Đảm bảo người chơi không bị kẹt thiếu ánh sáng khi dùng Tỏa sáng hoặc đánh rơi đom đóm. |
| Tần suất Bóng Mực | Khởi tạo 3 Bóng Mực ở rìa đảo (`32–39m`), sinh thêm ở giây 45, 90, 150 (tối đa 6) khi `random_shades: true` | Giữ nhịp độ tăng dần vừa sức và tạo sự kiện `shade_spawned` tất định. |
| Tác dụng của `safe_radius` | Chỉ áp dụng cho Đèn Lồng **đã thắp (`lit: true`)**; Bóng Mực trượt dọc rìa ngoài (`> safe_radius`) và không gây sát thương khi Mây đứng trong vùng sáng | Đúng tinh thần "Bóng Mực sợ những chiếc đèn" sau khi thắp lại ánh sáng. |
| Công thức đánh rơi đom đóm khi bị chạm | `dropped = Math.floor(carried * hit_drop_ratio)` (`hit_drop_ratio = 0.5`) | Cho kết quả nguyên, tất định và không làm thay đổi danh sách `motes` trong scenario test. |
| Thao tác nạp ánh sáng (`interact`) | Nạp tối đa lượng đom đóm còn thiếu của đèn gần nhất trong `interact_radius` (`3.0m`) | Chỉ cần 1 lần nhấn phím chuyển `false -> true` cho mỗi lượt nạp. |
| Điểm thưởng khi thắng (`all_lit`) | Cộng `Math.floor(time_left_s) * per_second_left + flames * per_flame_left` | Giữ tổng điểm `score` luôn là số nguyên, chỉ thưởng khi thắng (`won`). |

## 2. Tiêu chí nghiệm thu kiểm chứng được

1. **Di chuyển & Nhảy:** Giữ `WASD`/mũi tên di chuyển đúng theo `cam_yaw_deg` (chuẩn hóa khi `|move| > 1`); nhấn `Space` nhảy lên và rơi về `Y = 0`.
2. **Nhặt đom đóm & Nạp đèn:** Chạy qua đom đóm trong `1.8m` tự nhặt (`mote_picked`, `+10` điểm); nhấn `E` trong `3.0m` quanh đèn nạp đủ `4` đom đóm làm đèn sáng (`lantern_lit`, `+200` điểm).
3. **Bóng Mực & Vùng an toàn:** Bóng Mực đuổi theo Mây ở `4.2 m/s`, không đi vào bán kính `6.0m` quanh đèn đã thắp; va chạm trong `1.3m` làm mất 1 ngọn lửa, đánh rơi nửa số đom đóm và kích hoạt miễn nhiễm `2.0s`.
4. **Tỏa sáng (`pulse`):** Khi có ít nhất `1` đom đóm và hết hồi chiêu `2.5s`, nhấn `Q`/`Shift` tốn `1` đom đóm, đẩy lùi `5.0m` và làm choáng `3.0s` mọi Bóng Mực trong `7.5m` (`+30` điểm mỗi Bóng Mực mới bị choáng).
5. **Thắng / Thua & Chơi lại:** Thắp đủ `5` đèn -> thắng (`all_lit`); mất hết `3` ngọn lửa -> thua (`no_flames`); hết `300s` -> thua (`dawn`); bấm nút chơi lại khởi tạo ván mới sạch sẽ.
6. **Chế độ Headless & Tất định:** Tuân thủ Test Contract v1.0, lỗi định dạng `inputs`/`scenario` trả mã thoát `2`, cùng `--seed` cho output JSONL giống hệt nhau từng byte.
