# AGENTS.md — Đảo Đèn Lồng (Phase 4 · Release v1.0.0)

## Mục tiêu dự án
Game 3D **Đảo Đèn Lồng** 3 Đêm (*Đêm 1: Đảo Bến*, *Đêm 2: Đảo Cau*, *Đêm 3: Đảo Chuông*) hoàn chỉnh phát hành **v1.0.0**, tuân thủ [PRD-0.md](PRD-0.md), [Ticket-02.md](Ticket-02.md), [Ticket-03.md](Ticket-03.md), [Ticket-04.md](Ticket-04.md) và **Test Contract v1.3**.

## Kiến trúc & Quy tắc bất biến
- `src/sim.js`: Logic game thuần, tất định, 60 tick/giây, dùng chung cho trình duyệt (`window.LanternSim`) và Node.js (`module.exports`). **Không** dùng `Math.random()`, `Date.now()`, DOM hay Three.js trong `src/sim.js`. Chế độ benchmark (`createBenchGame`) dùng PRNG có seed, tắt sinh thêm thực thể, sát thương, nhặt đom đóm, hao dầu và kết thúc Đêm, nhưng giữ Bóng Mực `wander` bình thường.
- **Nhiên liệu & Luật thắng Phase 3–4:** Dầu đèn tính bằng đơn vị nguyên `1/60` (`fuelUnits`, tối đa `6000` = `100` fuel), chỉ làm tròn `1` chữ số thập phân khi xuất snapshot/event. Thắng khi sống sót tới bình minh với số đèn sáng `≥ ceil(0.6 × tổng đèn)` (`dawn_survived`). Thứ tự 12 bước mỗi tick không đảo lộn.
- `game.contract.json`: Nguồn chân lý duy nhất cho `contract_version: "1.3"`, `tuning`, `run_cmd`, `headless_cmd`, `bench_cmd`, `soak_cmd`.
- `src/headless.js`: Hỗ trợ `--night 1|2|3` (mã thoát `2` khi sai định dạng `inputs`/`scenario`).
- `src/bench.js`: Chế độ benchmark chuẩn (`--seed 42 --duration 30 --out bench.json`) mở cửa sổ `1280×720` tắt vsync (`--disable-frame-rate-limit --disable-gpu-vsync` nếu engine hỗ trợ), Đêm 1, `200` Bóng Mực `wander`, `100` đom đóm, `L1–L3` `fuel 100`, camera quay tròn `R=30, Y=15` ngược chiều kim đồng hồ `15 s/vòng` từ `(30,15,0)`, warmup `3 s` rồi đo `--duration` giây. **Tắt hoàn toàn** nhân vật, kỹ năng và hiệu ứng sáng tạo thêm trong `bench` và `soak`.
- `src/soak.js`: Chạy headless `10` Đêm xoay vòng trong cùng 1 tiến trình (`--seed 7 --nights 10 --out soak.json`), kiểm tra `crashes = 0` và `mem_end_mb <= 1.2 × mem_start_mb`.
- `src/serve.js`: Phục vụ web + API lưu bảng xếp hạng cục bộ trên đĩa (`GET/POST /api/leaderboard`) và hỗ trợ CLI `--export-leaderboard <out.json>` xuất top 10 theo thứ tự điểm giảm dần (bằng điểm xếp theo đạt trước đứng trên).
- `index.html` + `src/game.js`: Lớp hiển thị 3D (Three.js r147 UMD), tiếp cận đầy đủ (đổi phím & báo trùng, phụ đề/chỉ báo hình ảnh, giảm chuyển động, cỡ chữ `≥ 18 px` ở `1280×720` + tùy chọn chữ lớn `×1.25`, chế độ mù màu) và giữ nguyên yếu tố sáng tạo (Cụ Đò, `[J]` Lốc Xoáy, `[K]` Tường Gió, `[L]` Trảm Không) ở tầng trình diễn khi chơi thật.

## Lệnh kiểm tra bắt buộc sau mỗi lần sửa
```bash
npm run build
npm test
```
Không đánh dấu hoàn thành nếu `npm test` chưa chạy thật và xanh toàn bộ.
