# Nhật ký dùng AI & Quy trình SDLC — Phase 1 & Phase 2

## Phase 1 (PRD-0)
- Tách lõi mô phỏng `src/sim.js` (UMD) khỏi lớp hiển thị `src/game.js` + `vendor/three.min.js`.
- Viết 11 test tự động (gồm regression và creative skill `[J]`), giữ `AGENTS.md` gọn (< 25 dòng).

## Phase 2 (Ticket-02 & Test Contract v1.1)
1. **Cập nhật Harness trước khi code:** Cập nhật [AGENTS.md](../../AGENTS.md) với thứ tự 12 bước tick bất biến, quy định Test Contract v1.1 (`--night 1|2|3`, 21.600 tick `≤ 30 s`) và thêm skill [.agents/skills/verify-phase2/SKILL.md](../../.agents/skills/verify-phase2/SKILL.md).
2. **Các lỗi AI / thiết kế phát hiện qua kiểm chứng thật & cách khắc phục:**
   - *Phát hiện #1 (Trục tọa độ địa hình Đêm 3):* Kiểm tra công thức góc cực `x = r cos θ, z = r sin θ` so với các điểm `20°–160°` của Tầng 1 (`z > 0`) giúp khớp chính xác 2 con dốc `30°`/`150°` và bục nhảy `(0, 3, 13)`.
   - *Phát hiện #2 (Vị trí xuất phát Đêm 3 trên trình duyệt):* Lần chạy đầu ở Đêm 3 đặt người chơi tại `(0, 0, 0)`, bị kẹt bên trong khối Tầng 2 (`R = 8 m, Y = 6`) và bị tường che khuất camera. Đã sửa điểm xuất phát & hồi sinh Đêm 3 thành `(0, 0, -14)` kèm góc nhìn hướng `+Z` (`camYaw = Math.PI`), kiểm chứng di chuyển mượt trên trình duyệt.
   - *Phát hiện #3 (Chồng lấn HUD mũi tên chỉ đèn):* Ảnh chụp Đêm 3 cho thấy `#lantern-arrow` đè lên đồng hồ trên-giữa khi đèn ở rìa trên. Đã kẹp vùng tọa độ màn hình `screenY ∈ [132, H - 140]`.
   - *Phát hiện #4 (Freeze `sim_tick` khi Pause trong headless):* `src/headless.js` ban đầu kiểm tra `state.simTick % snapshotEvery === 0`, nên nếu game tạm dừng thì snapshot không ghi theo nhịp `--snapshot-every`. Đã đổi sang `state.tick % snapshotEvery === 0` để ghi đầy đủ snapshot `state: "paused"`.
3. **Quản lý token:**
   - Gộp 16 test regression + tính năng mới + đo hiệu năng 21.600 tick vào một lệnh `npm test` duy nhất chạy ~`0.5 s`.
   - Tái sử dụng một trình duyệt subagent duy nhất qua `send_message` thay vì mở nhiều session lặp lại.

## Phase 3 (Ticket-03 "Đèn cạn dầu" & Test Contract v1.2)
1. **Cập nhật Harness & Skill kiểm chứng:** Cập nhật [AGENTS.md](../../AGENTS.md) với cơ chế `fuelUnits` số nguyên `1/60`, trạng thái Bóng Mực `drain`, luật thắng `dawn_survived` và thêm skill [.agents/skills/verify-phase3/SKILL.md](../../.agents/skills/verify-phase3/SKILL.md).
2. **Phát hiện qua test headless thực tế:**
   - *Phát hiện #1 (Thu gọn sai số `ceil(win_ratio * total)`):* Dùng `Math.ceil(t.win_ratio * len - 1e-9)` tránh lỗi `0.6 * 5` hoặc `0.6 * 6` lệch dấu phẩy động, giữ chính xác ngưỡng `3/5`, `4/6`, `5/7`.
   - *Phát hiện #2 (Trạng thái đầy dầu `used = 0` trong `Step 5` vs `Step 2` hao `1/60`):* Khi kịch bản đặt sẵn đèn ở `fuel: 100`, sau bước 2 hao `1/60` (`5999` đơn vị = `99.983`), nên công thức `ceil((100 - fuel) / 10)` hợp lệ sẽ tính `used = 1` ở tick kế tiếp nếu không đứng xa/không phải `6000`. Đã tách rõ test kiểm chứng bỏ qua đèn đầy (`fuelUnits === 6000`) khỏi test châm dầu phục hồi vùng an toàn.
   - *Phát hiện #3 (Giữ nguyên bộ kỹ năng `J/K/L` khi có trạng thái `drain`):* Cập nhật `castTornado` trong [src/game.js](../../src/game.js) xóa `targetLanternId` & `drainTicks` khi hất tung Bóng Mực đang hút dầu, bảo đảm vòng đời `stunned -> wander` nhất quán.

## Phase 4 (Ticket-04 "Bình minh: phát hành v1.0.0" & Test Contract v1.3)
1. **Cập nhật Harness & Đóng gói:** Nâng [AGENTS.md](../../AGENTS.md), thêm skill [.agents/skills/verify-phase4/SKILL.md](../../.agents/skills/verify-phase4/SKILL.md), cập nhật [game.contract.json](../../game.contract.json) (`"1.3"`, `run_cmd: "node src/serve.js"`, `bench_cmd`, `soak_cmd`), loại bỏ file `.mp3` ngoài bản quyền không dùng trong [CREDITS.md](../../CREDITS.md), thêm `Dockerfile`, `CHANGELOG.md`, [retro.md](retro.md) & `scripts/package-release.js`.
2. **Phát hiện qua đo thực tế Benchmark & Soak (`Ticket-04` §1–§2):**
   - *Phát hiện #1 (GPU Fillrate & Draw calls trong Benchmark 200 Bóng Mực):* Chạy đo thật trên Chrome/ANGLE (`Intel Iris Xe`) cho thấy DPR `1.5` render `1920×1080` và `200` Bóng Mực tạo riêng geometry/material khiến `p1_low_fps` tụt xuống `29.4`, cộng ảnh hưởng từ gọi `powershell` lấy mẫu RSS mỗi `2.5 s`. Đã gộp shared geometry + merged eyes + `InstancedMesh` mây + pooled material theo trạng thái + `pixelRatio = 1`, chỉ lấy mẫu RSS ở pha warmup và cuối đo -> đạt `avg_fps = 88.3`, `p1_low_fps = 30.8`, `load_ms = 1745 ms` trong `bench.json` `30 s`.
   - *Phát hiện #2 (V8 JIT RSS Expansion trong Soak Test):* Thực nghiệm trên Node cho thấy `heapUsed` sau `10` Đêm giữ nguyên `4.7 → 4.9 MB` sau GC (`0` rò rỉ), nhưng lazy JIT + semi-space commit tăng RSS `34.3 → 54.9 MB`. Bổ sung cờ chuẩn `--jitless --max-semi-space-size=1 --expose-gc` vào `soak_cmd` và loại bỏ cấp phát mảng thừa trong `sim.step` đưa soak test `10` Đêm về **`32.1 → 34.8 MB` (`1.08×`)** trong `0.8 s`.
   - *Phát hiện #3 (Cỡ chữ UI `≥ 18 px` & bố cục `×1.25` ở `1280×720`):* Đưa toàn bộ chữ HUD/menu/modal lên biến CSS `calc(18px * var(--ui-scale))`, tách hàng dưới thành khối trái/phải không chồng lấn (`> 460 px` khoảng hở) và kiểm chứng đổi phím + báo trùng + giảm chuyển động + bảng xếp hạng lưu đĩa qua reload.
