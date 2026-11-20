#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const sim = require('../src/sim');

const ROOT = path.resolve(__dirname, '..');
const HEADLESS = path.join(ROOT, 'src', 'headless.js');
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-v2-tests-'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('PASS:', name);
  } catch (err) {
    failed++;
    console.error('FAIL:', name);
    console.error('  ', err && err.stack ? err.stack : err);
  }
}

function runHeadless(extraArgs) {
  return spawnSync(process.execPath, [HEADLESS].concat(extraArgs), {
    cwd: ROOT,
    encoding: 'utf8'
  });
}

function readJsonl(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  return raw.split('\n').map((line) => JSON.parse(line));
}

// NOTE [THAY THẾ Phase 3-4]: Contract updated to v1.3 per Ticket-04 (adds bench_cmd, soak_cmd, run_cmd="node src/serve.js" alongside v1.2 tuning).
test('Contract v1.3: game.contract.json matches sim.DEFAULT_TUNING & required v1.3 keys', () => {
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
  assert.strictEqual(contract.contract_version, '1.3');
  assert.strictEqual(contract.run_cmd, 'node src/serve.js');
  assert.strictEqual(contract.bench_cmd, 'node src/bench.js');
  assert(typeof contract.soak_cmd === 'string' && contract.soak_cmd.includes('src/soak.js'));
  assert.deepStrictEqual(contract.tuning, sim.DEFAULT_TUNING);
  assert.strictEqual(contract.tuning.carry_capacity, 10);
  assert.strictEqual(contract.tuning.capacity_max, 20);
  assert.strictEqual(contract.tuning.lantern_cost, 10);
  assert.strictEqual(contract.tuning.relight_cost, 5);
  assert.strictEqual(contract.tuning.fuel_max, 100);
  assert.strictEqual(contract.tuning.fuel_decay_per_s, 1.0);
  assert.strictEqual(contract.tuning.fuel_per_mote, 10);
  assert.strictEqual(contract.tuning.win_ratio, 0.6);
  assert.strictEqual(contract.tuning.drain_per_s, 5);
  assert.strictEqual(contract.tuning.low_fuel_threshold, 30);
  assert.strictEqual(contract.tuning.dash_speed, 14.0);
  assert.strictEqual(contract.tuning.night1_duration_s, 240);
  assert.strictEqual(contract.tuning.night2_duration_s, 270);
  assert.strictEqual(contract.tuning.night3_duration_s, 300);
  assert.strictEqual(contract.tuning.score.per_mote, 5);
  assert.strictEqual(contract.tuning.score.per_second_left, 0);
});

test('Regression: Tick model, accel<=0.1s, yaw transform, normalization & jump (vy=7, g=-20)', () => {
  const s = sim.createGame({
    seed: 1,
    night: 1,
    scenario: { random_motes: false, random_shades: false, motes: [], shades: [] }
  });
  for (let i = 0; i < 6; i++) {
    sim.step(s, i === 0 ? { move: [0, 1], cam_yaw_deg: 90, jump: true } : { jump: false });
  }
  assert.strictEqual(s.simTick, 6);
  // After 6 ticks (0.1 s), player reaches full speed 6.0 m/s along +X
  assert(Math.abs(s.player.vel[0] - 6.0) < 1e-6, 'expected vx=6.0 after 0.1s, got ' + s.player.vel[0]);
  assert(s.player.pos[1] > 0.5, 'jump should raise Y > 0.5');

  // Vector [1, 1] normalized so steady speed equals 6.0 m/s
  const s2 = sim.createGame({
    seed: 1,
    night: 1,
    scenario: { random_motes: false, random_shades: false, motes: [], shades: [] }
  });
  for (let i = 0; i < 60; i++) {
    sim.step(s2, i === 0 ? { move: [1, 1], cam_yaw_deg: 0 } : undefined);
  }
  const steadySpeed = Math.hypot(s2.player.vel[0], s2.player.vel[2]);
  assert(Math.abs(steadySpeed - 6.0) < 1e-4, 'expected normalized speed 6.0, got ' + steadySpeed);
});

// NOTE [THAY THẾ Phase 3]: per_mote changed from +10 to +5, lantern_lit gains relight:false, snapshot gains capacity/fuel/ever_lit/relit_count.
test('Regression Scenario 1: pickup 10 motes (no pickup score) and deposit to light L1 (+150 in Phase 3)', () => {
  const out = path.join(TMP_DIR, 's1.jsonl');
  const res = runHeadless([
    '--seed', '7',
    '--night', '1',
    '--scenario', 'tests/scenarios/s1_pickup_deposit.json',
    '--inputs', 'tests/scenarios/s1_inputs.json',
    '--ticks', '260',
    '--out', out,
    '--snapshot-every', '10'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);

  const snap0 = rows[0];
  assert.strictEqual(snap0.type, 'snapshot');
  assert.strictEqual(snap0.night, 1);
  assert.strictEqual(snap0.motes_active, 10);
  assert.strictEqual(snap0.player.capacity, 10);
  assert('vel' in snap0.player && 'grounded' in snap0.player && 'invuln' in snap0.player);
  assert('dash_cd_s' in snap0.player && 'pulse_cd_s' in snap0.player && 'charm_s' in snap0.player);
  assert('wind' in snap0 && 'drifters' in snap0 && 'charms' in snap0);
  assert.strictEqual(snap0.lanterns[0].fuel, 0);
  assert.strictEqual(snap0.lanterns[0].ever_lit, false);
  assert.strictEqual(snap0.lanterns[0].relit_count, 0);

  const picked = rows.filter((r) => r.type === 'event' && r.name === 'mote_picked');
  assert.strictEqual(picked.length, 10);

  const deposit = rows.find((r) => r.type === 'event' && r.name === 'deposit');
  assert(deposit, 'expected deposit event');
  assert.deepStrictEqual(deposit.data, { lantern_id: 'L1', amount: 10, deposited: 10 });

  const lit = rows.find((r) => r.type === 'event' && r.name === 'lantern_lit');
  assert(lit && lit.data.lantern_id === 'L1' && lit.data.relight === false);

  const lastSnap = rows.filter((r) => r.type === 'snapshot').pop();
  const l1End = lastSnap.lanterns.find((l) => l.id === 'L1');
  assert.strictEqual(l1End.ever_lit, true);
  assert.strictEqual(l1End.relit_count, 0);
  assert(l1End.fuel > 95 && l1End.fuel <= 100);
  assert.strictEqual(lastSnap.player.capacity, 12);

  const end = rows[rows.length - 1];
  assert.strictEqual(end.type, 'end');
  assert.strictEqual(end.score, 10 * 5 + 100); // Phase 3: 50 deposit + 100 first lantern
});

test('Regression Scenario 2: 3D Light Pulse (-3 motes, <=5m, 120-tick stun, 15-tick 4m push, +5 score)', () => {
  const out = path.join(TMP_DIR, 's2.jsonl');
  const res = runHeadless([
    '--seed', '7',
    '--night', '1',
    '--scenario', 'tests/scenarios/s2_pulse_stun.json',
    '--inputs', 'tests/scenarios/s2_inputs.json',
    '--ticks', '140',
    '--out', out,
    '--snapshot-every', '1'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);

  const pulseEv = rows.find((r) => r.type === 'event' && r.name === 'pulse');
  assert(pulseEv && pulseEv.tick === 1);
  assert.deepStrictEqual(pulseEv.data.stunned_ids, ['S1']);

  const snap1 = rows.find((r) => r.type === 'snapshot' && r.tick === 1);
  assert.strictEqual(snap1.player.carried, 3); // 6 - 3
  assert.strictEqual(snap1.score, 5);
  assert.strictEqual(snap1.shades.find((s) => s.id === 'S1').state, 'stunned');

  // After 15 ticks of pushback, S1 moved 4.0m horizontally (4.5 -> 8.5)
  const snap15 = rows.find((r) => r.type === 'snapshot' && r.tick === 15);
  const s1After = snap15.shades.find((s) => s.id === 'S1');
  assert(Math.abs(s1After.pos[2] - 8.5) < 0.05, 'expected S1 at z~8.5 after 4m push, got ' + s1After.pos[2]);

  // After 120 ticks stun expires -> wander or chase
  const snap125 = rows.find((r) => r.type === 'snapshot' && r.tick === 125);
  const s1Recovered = snap125.shades.find((s) => s.id === 'S1');
  assert(s1Recovered.state === 'chase' || s1Recovered.state === 'wander');
});

test('Regression Scenario 3: safe_radius pushes Shades out within <=30 ticks and prevents hits', () => {
  const scPath = path.join(TMP_DIR, 'safe_push_sc.json');
  fs.writeFileSync(scPath, JSON.stringify({
    player: { pos: [0, 0, 23.5], carried: 10, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [{ id: 'S1', pos: [0, 1, 24.5], state: 'chase' }],
    lanterns: [{ id: 'L1', pos: [0, 0, 25], deposited: 0 }],
    time_left_s: 300
  }));
  const inPath = path.join(TMP_DIR, 'safe_push_in.json');
  fs.writeFileSync(inPath, JSON.stringify({
    frames: [
      { tick: 0, interact: true },
      { tick: 1, interact: false }
    ]
  }));
  const out = path.join(TMP_DIR, 's3.jsonl');
  const res = runHeadless([
    '--seed', '1',
    '--night', '1',
    '--scenario', scPath,
    '--inputs', inPath,
    '--ticks', '40',
    '--out', out,
    '--snapshot-every', '5'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  const hits = rows.filter((r) => r.type === 'event' && r.name === 'player_hit');
  assert.strictEqual(hits.length, 0, 'Shade being pushed out of safe_radius must not damage player');

  const snap30 = rows.find((r) => r.type === 'snapshot' && r.tick === 30);
  const s1 = snap30.shades.find((s) => s.id === 'S1');
  const l1 = snap30.lanterns.find((l) => l.id === 'L1');
  const d = Math.hypot(s1.pos[0] - l1.pos[0], s1.pos[2] - l1.pos[2]);
  assert(d >= 6.0, 'Shade must be pushed outside safe_radius=6m within 30 ticks, dist=' + d);
});

test('Regression Scenario 4: hit drops motes onto 1.5-2.5m ring (TTL 480), recoil 60 ticks, invuln 90 ticks', () => {
  const out = path.join(TMP_DIR, 's4.jsonl');
  const res = runHeadless([
    '--seed', '1',
    '--night', '1',
    '--scenario', 'tests/scenarios/s4_hit_and_loss.json',
    '--ticks', '200',
    '--out', out,
    '--snapshot-every', '1'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  const hits = rows.filter((r) => r.type === 'event' && r.name === 'player_hit');
  assert(hits.length >= 1);
  assert.deepStrictEqual(hits[0].data, { by: 'shade', flames: 1, dropped: 2 });

  const hitSnap = rows.find((r) => r.type === 'snapshot' && r.tick === hits[0].tick);
  assert.strictEqual(hitSnap.shades[0].state, 'recoil');
  assert.strictEqual(hitSnap.player.invuln, true);
  assert.strictEqual(hitSnap.motes.filter((m) => m.kind === 'dropped').length, 2);
});

// NOTE [THAY THẾ Phase 3]: Ticket-03 Section 3 removes early 'all_lit' win; lighting final lantern gives +150 (10*5 + 100) and keeps game in 'playing' until dawn.
test('Regression Scenario 5 (Phase 3 replaced law): lighting final lantern keeps playing without early all_lit win', () => {
  const out = path.join(TMP_DIR, 's5.jsonl');
  const res = runHeadless([
    '--seed', '1',
    '--night', '1',
    '--scenario', 'tests/scenarios/s5_win_all_lit.json',
    '--inputs', 'tests/scenarios/s5_inputs.json',
    '--ticks', '60',
    '--out', out,
    '--snapshot-every', '1'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  const earlyWin = rows.find((r) => r.type === 'event' && r.name === 'game_over');
  assert.strictEqual(earlyWin, undefined, 'Phase 3 must not win early on all_lit');

  const snap1 = rows.find((r) => r.type === 'snapshot' && r.tick === 1);
  assert.strictEqual(snap1.state, 'playing');
  assert.strictEqual(snap1.lanterns.find((l) => l.id === 'L1').fuel, 100);
  assert.strictEqual(snap1.score, 10 * 5 + 100);

  const end = rows[rows.length - 1];
  assert.strictEqual(end.state, 'playing');
  assert.strictEqual(end.ticks, 60);
});

test('Phase 2 Feature — Dash: 14 m/s for 12 ticks (2.8m), cooldown 1.5s, air dash preserves height', () => {
  const scPath = path.join(TMP_DIR, 'dash_sc.json');
  fs.writeFileSync(scPath, JSON.stringify({
    player: { pos: [0, 0, 0], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: []
  }));
  const out = path.join(TMP_DIR, 's6.jsonl');
  const res = runHeadless([
    '--seed', '1',
    '--night', '1',
    '--scenario', scPath,
    '--inputs', 'tests/scenarios/s6_dash_inputs.json',
    '--ticks', '115',
    '--out', out,
    '--snapshot-every', '1'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  const dashes = rows.filter((r) => r.type === 'event' && r.name === 'dash');
  assert.strictEqual(dashes.length, 2, 'Should allow second dash at tick 95 after 90-tick cooldown');

  const snap12 = rows.find((r) => r.type === 'snapshot' && r.tick === 12);
  assert(Math.abs(snap12.player.pos[2] - 2.8) < 0.05, '12 ticks at 14m/s = 2.8m, got ' + snap12.player.pos[2]);

  // Air dash started at tick 95 (tick 96 snapshot) holds Y height constant through tick 107
  const snap96 = rows.find((r) => r.type === 'snapshot' && r.tick === 96);
  const snap107 = rows.find((r) => r.type === 'snapshot' && r.tick === 107);
  assert(Math.abs(snap96.player.pos[1] - snap107.player.pos[1]) < 1e-4, 'Air dash must hold Y height');
});

test('Phase 2 Feature — Fall off island (Y < -10): ignores invuln, emits lost, waits 60 ticks, respawns at (0,0,0)', () => {
  const inPath = path.join(TMP_DIR, 'fall_in.json');
  fs.writeFileSync(inPath, JSON.stringify({
    frames: [
      { tick: 0, move: [0, 1] },
      { tick: 20, move: [0, 0] }
    ]
  }));
  const out = path.join(TMP_DIR, 's7.jsonl');
  const res = runHeadless([
    '--seed', '1',
    '--night', '1',
    '--scenario', 'tests/scenarios/s7_fall_scenario.json',
    '--inputs', inPath,
    '--ticks', '150',
    '--out', out,
    '--snapshot-every', '1'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  const fallHit = rows.find((r) => r.type === 'event' && r.name === 'player_hit' && r.data.by === 'fall');
  assert(fallHit, 'expected fall player_hit event');
  assert.deepStrictEqual(fallHit.data, { by: 'fall', flames: 1, dropped: 0, lost: 5 });

  // After 60 ticks waiting -> respawns at (0,0,0) with invuln=true
  const snapRespawn = rows.find((r) => r.type === 'snapshot' && r.tick === fallHit.tick + 60);
  assert.deepStrictEqual(snapRespawn.player.pos, [0, 0, 0]);
  assert.strictEqual(snapRespawn.player.invuln, true);
});

test('Phase 2 Feature — Night 2 (Đảo Cau): launchpad launches from (20,0,18) across gap onto Island B', () => {
  const out = path.join(TMP_DIR, 's8.jsonl');
  const res = runHeadless([
    '--seed', '2',
    '--night', '2',
    '--scenario', 'tests/scenarios/s8_night2_launchpad.json',
    '--ticks', '110',
    '--out', out,
    '--snapshot-every', '5'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  const snap110 = rows.find((r) => r.type === 'snapshot' && r.tick === 110);
  assert.strictEqual(snap110.night, 2);
  assert.strictEqual(snap110.lanterns.length, 6);
  const distToB = Math.hypot(snap110.player.pos[0] - 70, snap110.player.pos[2]);
  assert(distToB <= 28.0 && snap110.player.grounded, 'Expected landing inside Island B (r<=28), distToB=' + distToB);
});

test('Phase 2 Feature — Night 3 (Đảo Chuông): launchpad to Tier 2, ramps, Bell Tower & Strong Wind', () => {
  // Launchpad from (0,3,13) lands on Tier 2 (Y=6, r<=8)
  const out = path.join(TMP_DIR, 's9.jsonl');
  const res = runHeadless([
    '--seed', '3',
    '--night', '3',
    '--scenario', 'tests/scenarios/s9_night3_launchpad_wind.json',
    '--ticks', '1900',
    '--out', out,
    '--snapshot-every', '20'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  const snap60 = rows.find((r) => r.type === 'snapshot' && r.tick === 60);
  assert.strictEqual(snap60.night, 3);
  assert.strictEqual(snap60.lanterns.length, 7);
  assert(Math.abs(snap60.player.pos[1] - 6.0) < 0.05 && snap60.player.grounded, 'Expected landing on Tier 2 (Y=6), got y=' + snap60.player.pos[1]);

  // Strong wind activates at tick 1800
  const snap1820 = rows.find((r) => r.type === 'snapshot' && r.tick === 1820);
  assert.strictEqual(snap1820.wind.active, true, 'Expected Night 3 wind active after 30s');
});

test('Phase 2 Feature — Gió Lạc (Drifter) steals & drops on Pulse + Bùa Gió (Wind Charm) gives 7.2 m/s & zero dash cd', () => {
  const inPath = path.join(TMP_DIR, 's10_in.json');
  fs.writeFileSync(inPath, JSON.stringify({
    frames: [
      // Stay still until D1 steals (by tick 40), then pulse to make D1 drop motes, then walk -Z to pick C1
      { tick: 40, pulse: true },
      { tick: 41, pulse: false },
      { tick: 42, move: [0, -1] }
    ]
  }));
  const out = path.join(TMP_DIR, 's10.jsonl');
  const res = runHeadless([
    '--seed', '5',
    '--night', '2',
    '--scenario', 'tests/scenarios/s10_drifter_charm.json',
    '--inputs', inPath,
    '--ticks', '100',
    '--out', out,
    '--snapshot-every', '5'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);

  const stealEv = rows.find((r) => r.type === 'event' && r.name === 'drifter_steal');
  assert(stealEv && stealEv.data.amount === 3 && stealEv.data.carried === 3, 'Drifter must steal 3 motes ignoring invuln');

  const dropEv = rows.find((r) => r.type === 'event' && r.name === 'drifter_drop');
  assert(dropEv && dropEv.data.amount === 3, 'Pulse hitting fleeing Drifter must drop all 3 stolen motes');

  const charmEv = rows.find((r) => r.type === 'event' && r.name === 'charm_picked');
  assert(charmEv && charmEv.data.charm_id === 'C1' && charmEv.data.charm_ticks === 600);

  const snap100 = rows.find((r) => r.type === 'snapshot' && r.tick === 100);
  assert(snap100.player.charm_s > 8.0);
  assert(Math.abs(Math.abs(snap100.player.vel[2]) - 7.2) < 1e-3, 'Charm speed should be 7.2 m/s, got ' + snap100.player.vel[2]);
});

test('Phase 2 Feature — Pause/Resume freezes sim_tick & time_left_s while tick advances', () => {
  const scPath = path.join(TMP_DIR, 'pause_sc.json');
  fs.writeFileSync(scPath, JSON.stringify({
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [],
    time_left_s: 300
  }));
  const out = path.join(TMP_DIR, 's11.jsonl');
  const res = runHeadless([
    '--seed', '1',
    '--night', '1',
    '--scenario', scPath,
    '--inputs', 'tests/scenarios/s11_pause_inputs.json',
    '--ticks', '50',
    '--out', out,
    '--snapshot-every', '5'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  const pausedEv = rows.find((r) => r.type === 'event' && r.name === 'paused');
  const resumedEv = rows.find((r) => r.type === 'event' && r.name === 'resumed');
  assert(pausedEv && resumedEv);

  const snap20 = rows.find((r) => r.type === 'snapshot' && r.tick === 20);
  assert.strictEqual(snap20.state, 'paused');
  assert.strictEqual(snap20.sim_tick, 5);
  assert.strictEqual(snap20.time_left_s, rows.find((r) => r.type === 'snapshot' && r.tick === 10).time_left_s);

  const snap45 = rows.find((r) => r.type === 'snapshot' && r.tick === 45);
  assert.strictEqual(snap45.state, 'playing');
  assert.strictEqual(snap45.sim_tick, 15);
});

test('Determinism & Error Handling: identical seed output + exit code 2 on invalid JSON/frames', () => {
  const outA = path.join(TMP_DIR, 'detA.jsonl');
  const outB = path.join(TMP_DIR, 'detB.jsonl');
  const resA = runHeadless(['--seed', '42', '--night', '2', '--ticks', '1400', '--out', outA]);
  const resB = runHeadless(['--seed', '42', '--night', '2', '--ticks', '1400', '--out', outB]);
  assert.strictEqual(resA.status, 0, resA.stderr);
  assert.strictEqual(resB.status, 0, resB.stderr);
  assert.strictEqual(fs.readFileSync(outA, 'utf8'), fs.readFileSync(outB, 'utf8'));

  const badIn = path.join(TMP_DIR, 'bad_in.json');
  fs.writeFileSync(badIn, JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] }));
  const rBad = runHeadless(['--seed', '1', '--night', '1', '--inputs', badIn, '--ticks', '10', '--out', path.join(TMP_DIR, 'e1.jsonl')]);
  assert.strictEqual(rBad.status, 2);

  const rNight4 = runHeadless(['--seed', '1', '--night', '4', '--ticks', '10', '--out', path.join(TMP_DIR, 'e2.jsonl')]);
  assert.notStrictEqual(rNight4.status, 0);
});

test('Performance: Headless full Night 3 (18,000 ticks / 300s) finishes in <= 30s', () => {
  const out = path.join(TMP_DIR, 'perf_18000.jsonl');
  const t0 = Date.now();
  const res = runHeadless(['--seed', '99', '--night', '3', '--ticks', '18000', '--out', out]);
  const elapsedMs = Date.now() - t0;
  assert.strictEqual(res.status, 0, res.stderr);
  console.log('  [Perf] Night 3 18,000 ticks completed in ' + elapsedMs + ' ms');
  assert(elapsedMs <= 30000, 'Expected <= 30000 ms, got ' + elapsedMs + ' ms');
});

test('Phase 3 P3-1: 1/60 integer fuel decay, lantern_out (deposited=0, ever_lit=true), and 5-mote relight (+40)', () => {
  const scPath = path.join(TMP_DIR, 'p3_fuel_sc.json');
  fs.writeFileSync(scPath, JSON.stringify({
    player: { pos: [0, 0, 23.5], carried: 6, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [],
    lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 3.5 }],
    time_left_s: 200
  }));
  const inPath = path.join(TMP_DIR, 'p3_fuel_in.json');
  fs.writeFileSync(inPath, JSON.stringify({
    frames: [
      { tick: 215, interact: true },
      { tick: 216, interact: false }
    ]
  }));
  const out = path.join(TMP_DIR, 'p3_fuel.jsonl');
  const res = runHeadless([
    '--seed', '1', '--night', '1',
    '--scenario', scPath, '--inputs', inPath,
    '--ticks', '225', '--out', out, '--snapshot-every', '1'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);

  const snap60 = rows.find((r) => r.type === 'snapshot' && r.tick === 60);
  assert.strictEqual(snap60.lanterns[0].fuel, 2.5, '60 ticks of 1/60 decay should leave fuel=2.5');

  const outEv = rows.find((r) => r.type === 'event' && r.name === 'lantern_out');
  assert(outEv && outEv.tick === 210 && outEv.data.lantern_id === 'L1', 'fuel=3.5 should go out at tick 210');

  const snap210 = rows.find((r) => r.type === 'snapshot' && r.tick === 210);
  assert.strictEqual(snap210.lanterns[0].lit, false);
  assert.strictEqual(snap210.lanterns[0].fuel, 0);
  assert.strictEqual(snap210.lanterns[0].deposited, 0);
  assert.strictEqual(snap210.lanterns[0].ever_lit, true);

  // Relight at tick 216 with 5 of 6 motes -> fuel=100, relit_count=1, score=5*5+40=65
  const relitEv = rows.find((r) => r.type === 'event' && r.name === 'lantern_lit');
  assert(relitEv && relitEv.data.lantern_id === 'L1' && relitEv.data.relight === true);

  const snap216 = rows.find((r) => r.type === 'snapshot' && r.tick === 216);
  assert.strictEqual(snap216.player.carried, 1);
  assert.strictEqual(snap216.player.capacity, 12);
  assert.strictEqual(snap216.lanterns[0].lit, true);
  assert.strictEqual(snap216.lanterns[0].fuel, 100);
  assert.strictEqual(snap216.lanterns[0].relit_count, 1);
  assert.strictEqual(snap216.score, 5 * 5 + 40);
});

test('Phase 3 P3-2: Refuel ceil((100-fuel)/10), skips full lanterns (used=0), restores safe_radius & pushes Shades out <=30 ticks', () => {
  // Part A: Strict used=0 skip when L1 is strictly at fuel=100 (decay=0) and equidistant to L2 at fuel=25
  const sSkip = sim.createGame({
    seed: 1,
    night: 1,
    tuning: { fuel_decay_per_s: 0 },
    scenario: {
      player: { pos: [0, 0, 23.5], carried: 10, flames: 3 },
      random_motes: false, random_shades: false, motes: [], shades: [],
      lanterns: [
        { id: 'L1', pos: [0, 0, 25], lit: true, fuel: 100 },
        { id: 'L2', pos: [0, 0, 25], lit: true, fuel: 25 }
      ],
      time_left_s: 200
    }
  });
  const ev1 = sim.step(sSkip, { interact: true });
  const refuel1 = ev1.find((e) => e.name === 'refuel');
  assert(refuel1, 'Should refuel L2 while skipping full L1');
  assert.deepStrictEqual(refuel1.data, { lantern_id: 'L2', amount: 8, fuel: 100 });
  assert.strictEqual(sSkip.player.carried, 2);
  assert.strictEqual(sSkip.score, 40);
  // Second interact when both L1 & L2 are full (used=0) emits no event & adds 0 score
  sim.step(sSkip, { interact: false });
  const ev2 = sim.step(sSkip, { interact: true });
  assert.strictEqual(ev2.find((e) => e.name === 'refuel'), undefined, 'Full lantern must not emit refuel');
  assert.strictEqual(sSkip.score, 40);

  // Part B: Headless default decay — refuel weak L1 (fuel 25 -> 100) pushes Shade inside 6m out within 30 ticks without damage
  const scPath = path.join(TMP_DIR, 'p3_refuel_sc.json');
  fs.writeFileSync(scPath, JSON.stringify({
    player: { pos: [0, 0, 23.5], carried: 10, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [{ id: 'S1', pos: [0, 1, 24.5], state: 'wander' }],
    lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
    time_left_s: 200
  }));
  const inPath = path.join(TMP_DIR, 'p3_refuel_in.json');
  fs.writeFileSync(inPath, JSON.stringify({
    frames: [
      { tick: 0, interact: true },
      { tick: 1, interact: false }
    ]
  }));
  const out = path.join(TMP_DIR, 'p3_refuel.jsonl');
  const res = runHeadless([
    '--seed', '1', '--night', '1',
    '--scenario', scPath, '--inputs', inPath,
    '--ticks', '40', '--out', out, '--snapshot-every', '1'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);

  const refuels = rows.filter((r) => r.type === 'event' && r.name === 'refuel');
  assert.strictEqual(refuels.length, 1);
  assert.deepStrictEqual(refuels[0].data, { lantern_id: 'L1', amount: 8, fuel: 100 });

  const snap1 = rows.find((r) => r.type === 'snapshot' && r.tick === 1);
  assert.strictEqual(snap1.player.carried, 2);
  assert.strictEqual(snap1.score, 8 * 5);

  const hits = rows.filter((r) => r.type === 'event' && r.name === 'player_hit');
  assert.strictEqual(hits.length, 0, 'Pushout after refueling to >=30 must not damage player');

  const snap31 = rows.find((r) => r.type === 'snapshot' && r.tick === 31);
  const s1 = snap31.shades[0];
  const distToL = Math.hypot(s1.pos[0], s1.pos[2] - 25);
  assert(distToL >= 6.0, 'Shade must be pushed outside safe_radius=6m within 30 ticks after refuel, dist=' + distToL);
});

test('Phase 3 P3-3: Safe cutoff (30 vs <30), Shade wander->drain (5/s), stacking, chase<=6m, stun +15 & post-stun wander', () => {
  // Part A: fuel=30 keeps safe zone, fuel=29.5 enters drain and emits fuel_drain every 60 ticks
  const scPath = path.join(TMP_DIR, 'p3_drain_sc.json');
  fs.writeFileSync(scPath, JSON.stringify({
    player: { pos: [0, 0, 0], carried: 6, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [
      { id: 'S1', pos: [0, 1, 24.5], state: 'wander' },
      { id: 'S2', pos: [0, 1, 24.2], state: 'wander' },
      { id: 'S3', pos: [23.8, 1, 10.0], state: 'wander' }
    ],
    lanterns: [
      { id: 'L1', pos: [0, 0, 25], lit: true, fuel: 29.0 },
      { id: 'L2', pos: [23.8, 0, 7.7], lit: true, fuel: 35.0 }
    ],
    time_left_s: 200
  }));
  const out = path.join(TMP_DIR, 'p3_drain.jsonl');
  const res = runHeadless([
    '--seed', '1', '--night', '1',
    '--scenario', scPath, '--ticks', '70', '--out', out, '--snapshot-every', '1'
  ]);
  assert.strictEqual(res.status, 0, res.stderr);
  const rows = readJsonl(out);

  // S3 near L2 (fuel 35 >= 30) is clamped outside safe_radius=6m
  const snap1 = rows.find((r) => r.type === 'snapshot' && r.tick === 1);
  assert.strictEqual(snap1.shades.find((s) => s.id === 'S1').state, 'drain');
  assert.strictEqual(snap1.shades.find((s) => s.id === 'S2').state, 'drain');
  const s3 = snap1.shades.find((s) => s.id === 'S3');
  const dL2 = Math.hypot(s3.pos[0] - 23.8, s3.pos[2] - 7.7);
  assert(dL2 >= 5.99, 'L2 with fuel>=30 must enforce safe_radius=6m, got ' + dL2);

  // Over ticks 2..61 (60 ticks draining by S1+S2), L1 loses 60 * (1 + 2*5)/60 = 11 + 1/60(tick1)
  const drainEvs = rows.filter((r) => r.type === 'event' && r.name === 'fuel_drain');
  assert.strictEqual(drainEvs.length, 2, 'Both S1 and S2 emit fuel_drain after 60 ticks draining');

  // Part B: Pulse on draining Shade awards +15 total and post-stun returns to wander when player moves away >12m; chase when player <=6m
  const sPulse = sim.createGame({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 17.5], carried: 3, flames: 3 },
      random_motes: false, random_shades: false, motes: [],
      shades: [
        { id: 'S1', pos: [0, 1, 24.5], state: 'drain', target_lantern_id: 'L1' },
        { id: 'S2', pos: [0, 1, 21.0], state: 'drain', target_lantern_id: 'L1' }
      ],
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      time_left_s: 200
    }
  });
  // Tick 1: S1 is 7.0m from Mây (>6m stays drain), S2 is 3.5m from Mây (<=6m enters chase -> moves toward Mây, Wait: Mây pulse hits S2 & if Mây moves close enough, let's test direct Pulse on S1)
  const evs1 = sim.step(sPulse, {});
  assert.strictEqual(sPulse.shades[0].state, 'drain', 'S1 at 7m (>6m) stays drain');
  assert.strictEqual(sPulse.shades[1].state, 'chase', 'S2 at 3.5m (<=6m) enters chase');

  // Place Mây 3.0m from draining S1, Wait — in step 8 S1 would turn chase only AFTER step 7 Pulse!
  // Step order: step 7 Pulse runs BEFORE step 8 AI transition, so pressing Pulse while S1 is in 'drain' awards +15!
  const sPulseDrain = sim.createGame({
    seed: 1, night: 1,
    scenario: {
      player: { pos: [0, 0, 21.0], carried: 3, flames: 3 },
      random_motes: false, random_shades: false, motes: [],
      shades: [{ id: 'S1', pos: [0, 1, 24.5], state: 'drain', target_lantern_id: 'L1' }],
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      time_left_s: 200
    }
  });
  sim.step(sPulseDrain, { pulse: true });
  assert.strictEqual(sPulseDrain.score, 15, 'Pulse on draining Shade must grant +15 total score');
  assert.strictEqual(sPulseDrain.shades[0].state, 'stunned');
  // Move Mây >12m away and let 120-tick stun expire -> must enter wander (not return to drain/chase)
  sPulseDrain.player.pos = [0, 0, 0];
  for (let i = 0; i < 120; i++) sim.step(sPulseDrain, { pulse: false });
  assert.strictEqual(sPulseDrain.shades[0].state, 'wander', 'Post-stun must transition to wander');
});

test('Phase 3 P3-4: Progressive capacity = min(20, 10 + 2*successful_lights), ignores pre-lit scenario lanterns', () => {
  const mList = [];
  for (let i = 0; i < 20; i++) mList.push({ id: 'M' + (i + 1), pos: [0, 0, 0] });
  const g = sim.createGame({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 23.5], carried: 10, flames: 3, successful_lights: 0 },
      random_motes: false, random_shades: false,
      motes: mList,
      lanterns: [
        { id: 'L1', pos: [0, 0, 25], lit: false, ever_lit: false },
        { id: 'L2', pos: [23.8, 0, 7.7], lit: true },
        { id: 'L3', pos: [14.7, 0, -20.2], lit: false, ever_lit: true }
      ],
      time_left_s: 200
    }
  });
  assert.strictEqual(sim.getSnapshot(g).player.capacity, 10, 'Pre-lit L2 must not raise initial capacity');
  sim.step(g, { interact: true }); // lights L1 -> successful_lights=1 -> capacity=12
  assert.strictEqual(sim.getSnapshot(g).player.capacity, 12);
  // Teleport to (0,0,0) with 20 motes -> can only pick up 12
  g.player.pos = [0, 0, 0];
  sim.step(g, { interact: false });
  assert.strictEqual(g.player.carried, 12);
  // Cap at 20 when successful_lights = 6
  const gCap = sim.createGame({
    seed: 1, night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3, successful_lights: 6 },
      random_motes: false, random_shades: false, motes: mList
    }
  });
  assert.strictEqual(sim.getSnapshot(gCap).player.capacity, 20);
  sim.step(gCap, {});
  assert.strictEqual(gCap.player.carried, 20);
});

test('Phase 3 P3-5: Dawn survival thresholds (N1 3/5, N2 4/6, N3 5/7), dawn bonus & no_flames priority on last tick', () => {
  // Night 1 win with 3/5 lit at dawn + exact bonus check (no time bonus)
  const gWin1 = sim.createGame({
    seed: 1, night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 2 },
      random_motes: false, random_shades: false, motes: [], shades: [],
      lanterns: [
        { id: 'L1', lit: true, fuel: 51.0 },
        { id: 'L2', lit: true, fuel: 21.0 },
        { id: 'L3', lit: true, fuel: 11.0 },
        { id: 'L4', lit: false },
        { id: 'L5', lit: false }
      ],
      time_left_s: 1.0
    }
  });
  let winEv1 = null;
  for (let i = 0; i < 65 && gWin1.gameState === 'playing'; i++) {
    const evs = sim.step(gWin1, {});
    const found = evs.find((e) => e.name === 'game_over');
    if (found) winEv1 = found;
  }
  assert.strictEqual(gWin1.gameState, 'won');
  assert.deepStrictEqual(winEv1.data, { result: 'won', reason: 'dawn_survived' });
  // After 60 ticks decay: fuels = 50, 20, 10 -> lantern bonuses (50+50)+(50+20)+(50+10) = 230 + 2*50 (100) = 330
  assert.strictEqual(gWin1.score, 330);

  // Night 1 loss with 2/5 lit at dawn
  const gLose1 = sim.createGame({
    seed: 1, night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false, random_shades: false, motes: [], shades: [],
      lanterns: [{ id: 'L1', lit: true, fuel: 50 }, { id: 'L2', lit: true, fuel: 50 }],
      time_left_s: 0.5
    }
  });
  let loseEv1 = null;
  for (let i = 0; i < 35 && gLose1.gameState === 'playing'; i++) {
    const found = sim.step(gLose1, {}).find((e) => e.name === 'game_over');
    if (found) loseEv1 = found;
  }
  assert.strictEqual(gLose1.gameState, 'lost');
  assert.deepStrictEqual(loseEv1.data, { result: 'lost', reason: 'dawn' });

  // Night 2 (needs 4/6) & Night 3 (needs 5/7)
  const gN2 = sim.createGame({
    seed: 2, night: 2,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false, random_shades: false, motes: [], shades: [],
      lanterns: [
        { id: 'L1', lit: true, fuel: 50 },
        { id: 'L2', lit: true, fuel: 50 },
        { id: 'L3', lit: true, fuel: 50 }
      ],
      time_left_s: 0.1
    }
  });
  for (let i = 0; i < 10 && gN2.gameState === 'playing'; i++) sim.step(gN2, {});
  assert.strictEqual(gN2.gameState, 'lost', 'Night 2 with 3/6 lit should lose at dawn');

  const gN3 = sim.createGame({
    seed: 3, night: 3,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 1 },
      random_motes: false, random_shades: false, motes: [], shades: [],
      lanterns: [
        { id: 'L1', lit: true, fuel: 50 }, { id: 'L2', lit: true, fuel: 50 },
        { id: 'L3', lit: true, fuel: 50 }, { id: 'L4', lit: true, fuel: 50 },
        { id: 'L5', lit: true, fuel: 50 }
      ],
      time_left_s: 0.1
    }
  });
  for (let i = 0; i < 10 && gN3.gameState === 'playing'; i++) sim.step(gN3, {});
  assert.strictEqual(gN3.gameState, 'won', 'Night 3 with 5/7 lit should win at dawn');

  // Exact dawn tick with flames hitting 0 -> no_flames MUST win priority over dawn_survived
  const gLastTickHit = sim.createGame({
    seed: 1, night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 1 },
      random_motes: false, random_shades: false, motes: [],
      shades: [{ id: 'S1', pos: [0, 1, 0.2], state: 'chase' }],
      lanterns: [
        { id: 'L1', lit: true, fuel: 50 },
        { id: 'L2', lit: true, fuel: 50 },
        { id: 'L3', lit: true, fuel: 50 }
      ],
      time_left_s: 1 / 60
    }
  });
  const evFinal = sim.step(gLastTickHit, {}).find((e) => e.name === 'game_over');
  assert.strictEqual(gLastTickHit.gameState, 'lost');
  assert.deepStrictEqual(evFinal.data, { result: 'lost', reason: 'no_flames' });
});

test('Phase 3 P3-6: Validate v1.2 scenario errors return exit code 2', () => {
  const badSc = path.join(TMP_DIR, 'bad_v12_sc.json');
  fs.writeFileSync(badSc, JSON.stringify({
    lanterns: [{ id: 'L1', lit: true, fuel: 150 }]
  }));
  const res = runHeadless([
    '--seed', '1', '--night', '1', '--scenario', badSc,
    '--ticks', '5', '--out', path.join(TMP_DIR, 'bad_v12.jsonl')
  ]);
  assert.strictEqual(res.status, 2);
});

test('Phase 4 P4-1: createBenchGame(42) spawns 200 wander Shades, 100 motes, L1-L3 fuel=100, no decay/damage/win', () => {
  const b1 = sim.createBenchGame(42);
  const b2 = sim.createBenchGame(42);
  assert.strictEqual(b1.shades.length, 200);
  assert.strictEqual(b1.motes.length, 100);
  assert(b1.shades.every((s) => s.state === 'wander'));
  assert.strictEqual(b1.lanterns[0].lit && b1.lanterns[0].fuelUnits, 6000);
  assert.strictEqual(b1.lanterns[1].lit && b1.lanterns[1].fuelUnits, 6000);
  assert.strictEqual(b1.lanterns[2].lit && b1.lanterns[2].fuelUnits, 6000);
  assert.strictEqual(b1.lanterns[3].lit, false);
  assert.strictEqual(b1.lanterns[4].lit, false);
  assert.deepStrictEqual(sim.getSnapshot(b1), sim.getSnapshot(b2));

  for (let i = 0; i < 300; i++) {
    sim.step(b1, {});
    sim.step(b2, {});
  }
  assert.strictEqual(b1.gameState, 'playing');
  assert.strictEqual(b1.shades.length, 200);
  assert.strictEqual(b1.motes.length, 100);
  assert(b1.shades.every((s) => s.state === 'wander'));
  assert.strictEqual(b1.lanterns[0].fuelUnits, 6000);
  assert.strictEqual(b1.player.flames, 3);
  assert.deepStrictEqual(sim.getSnapshot(b1), sim.getSnapshot(b2));
});

test('Phase 4 P4-2: Soak CLI runs multi-night cleanly & committed bench.json / soak.json satisfy Ticket-04', () => {
  const soakTmp = path.join(TMP_DIR, 'soak_mini.json');
  const res = spawnSync(
    process.execPath,
    ['--jitless', '--max-semi-space-size=1', '--expose-gc', path.join(ROOT, 'src', 'soak.js'), '--seed', '7', '--nights', '3', '--out', soakTmp],
    { cwd: ROOT, encoding: 'utf8' }
  );
  assert.strictEqual(res.status, 0, res.stderr);
  const mini = JSON.parse(fs.readFileSync(soakTmp, 'utf8'));
  assert.strictEqual(mini.nights, 3);
  assert.strictEqual(mini.crashes, 0);
  assert.strictEqual(mini.results.length, 3);
  assert(mini.mem_end_mb <= 1.2 * mini.mem_start_mb, 'mini soak mem grew >1.2x: ' + mini.mem_start_mb + ' -> ' + mini.mem_end_mb);

  const benchFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'bench.json'), 'utf8'));
  assert.strictEqual(benchFile.contract_version, '1.3');
  assert(benchFile.frames > 100 && benchFile.avg_fps >= 60, 'bench avg_fps=' + benchFile.avg_fps);
  assert(benchFile.p1_low_fps >= 30, 'bench p1_low_fps=' + benchFile.p1_low_fps);
  assert(benchFile.load_ms <= 10000, 'bench load_ms=' + benchFile.load_ms);

  const soakFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'soak.json'), 'utf8'));
  assert.strictEqual(soakFile.nights, 10);
  assert.strictEqual(soakFile.crashes, 0);
  assert.strictEqual(soakFile.results.length, 10);
  assert(soakFile.mem_end_mb <= 1.2 * soakFile.mem_start_mb, 'soak mem grew >1.2x: ' + soakFile.mem_start_mb + ' -> ' + soakFile.mem_end_mb);
});

test('Phase 4 P4-3: Leaderboard persistence, tie-break sort, top-10 cap & --export-leaderboard CLI', () => {
  const lbPath = path.join(TMP_DIR, 'lb.json');
  const exportOut = path.join(TMP_DIR, 'exported_lb.json');
  const prevEnv = process.env.LEADERBOARD_FILE;
  process.env.LEADERBOARD_FILE = lbPath;
  try {
    const serveMod = require('../src/serve');
    assert.throws(() => serveMod.addLeaderboardEntry({ name: 'ab', score: 100, nights_won: 1, achieved_at: '2026-11-20T10:00:00+07:00', seed: 1 }));
    assert.throws(() => serveMod.addLeaderboardEntry({ name: 'bad name!', score: 100, nights_won: 1, achieved_at: '2026-11-20T10:00:00+07:00', seed: 1 }));

    serveMod.addLeaderboardEntry({ name: 'LaterTie', score: 500, nights_won: 3, achieved_at: '2026-11-20T12:00:00+07:00', seed: 11 });
    serveMod.addLeaderboardEntry({ name: 'EarlierTie', score: 500, nights_won: 3, achieved_at: '2026-11-20T11:00:00+07:00', seed: 12 });
    serveMod.addLeaderboardEntry({ name: 'Mây_01', score: 850, nights_won: 3, achieved_at: '2026-11-20T12:30:00+07:00', seed: 13 });
    for (let k = 0; k < 10; k++) {
      serveMod.addLeaderboardEntry({ name: 'Run_' + k, score: 100 + k, nights_won: 1, achieved_at: '2026-11-20T10:0' + k + ':00+07:00', seed: k });
    }

    const expRes = spawnSync(
      process.execPath,
      [path.join(ROOT, 'src', 'serve.js'), '--export-leaderboard', exportOut],
      { cwd: ROOT, env: Object.assign({}, process.env, { LEADERBOARD_FILE: lbPath }), encoding: 'utf8' }
    );
    assert.strictEqual(expRes.status, 0, expRes.stderr);
    const exported = JSON.parse(fs.readFileSync(exportOut, 'utf8'));
    assert.strictEqual(exported.entries.length, 10);
    assert.strictEqual(exported.entries[0].name, 'Mây_01');
    assert.strictEqual(exported.entries[1].name, 'EarlierTie');
    assert.strictEqual(exported.entries[2].name, 'LaterTie');
    assert.strictEqual(exported.entries[9].score, 103);
  } finally {
    if (prevEnv === undefined) delete process.env.LEADERBOARD_FILE;
    else process.env.LEADERBOARD_FILE = prevEnv;
  }
});

test('Creative browser skill triggerCreativeLightning leaves contract score/headless untouched', () => {
  const s = sim.createGame({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [{ id: 'S1', pos: [0, 1, 5], state: 'chase' }]
    }
  });
  const strikes = sim.triggerCreativeLightning(s);
  assert.strictEqual(strikes.length, 1);
  assert.strictEqual(s.shades[0].state, 'stunned');
  assert.strictEqual(s.score, 0);
});

fs.rmSync(TMP_DIR, { recursive: true, force: true });
console.log('\nSummary: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
