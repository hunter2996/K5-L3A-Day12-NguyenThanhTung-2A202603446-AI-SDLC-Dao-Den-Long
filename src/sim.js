(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LanternSim = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TICK_RATE = 60;
  const DT = 1 / TICK_RATE;

  const FUEL_UNITS_PER_FUEL = 60;
  const FUEL_MAX_UNITS = 100 * FUEL_UNITS_PER_FUEL; // 6000
  const FUEL_LOW_UNITS = 30 * FUEL_UNITS_PER_FUEL;  // 1800
  const FUEL_PER_MOTE_UNITS = 10 * FUEL_UNITS_PER_FUEL; // 600

  const DEFAULT_TUNING = {
    player_speed: 6.0,
    dash_speed: 14.0,
    dash_duration_s: 0.2,
    dash_cooldown_s: 1.5,
    carry_capacity: 10,
    capacity_max: 20,
    lantern_cost: 10,
    relight_cost: 5,
    lantern_count_night1: 5,
    pickup_radius: 1.0,
    interact_radius: 2.0,
    pulse_cost: 3,
    pulse_radius: 5.0,
    night1_duration_s: 240,
    night2_duration_s: 270,
    night3_duration_s: 300,
    flames: 3,
    invuln_s: 1.5,
    hit_drop_ratio: 0.5,
    pulse_stun_s: 2.0,
    pulse_push_m: 4.0,
    pulse_cooldown_s: 3.0,
    safe_radius: 6.0,
    shade_speed: 4.0,
    shade_hit_radius: 1.0,
    fall_enabled: true,
    fuel_max: 100,
    fuel_decay_per_s: 1.0,
    fuel_per_mote: 10,
    win_ratio: 0.6,
    drain_per_s: 5,
    low_fuel_threshold: 30,
    score: {
      per_mote: 5,
      per_lantern: 100,
      per_stun: 5,
      per_second_left: 0,
      per_flame_left: 50
    }
  };

  function round1(n) {
    const r = Math.round(n * 10) / 10;
    return Object.is(r, -0) ? 0 : r;
  }

  function round3(n) {
    const r = Math.round(n * 1000) / 1000;
    return Object.is(r, -0) ? 0 : r;
  }

  function polarXZ(r, deg, cx, cz) {
    const rad = (deg * Math.PI) / 180;
    return [round3((cx || 0) + r * Math.cos(rad)), round3((cz || 0) + r * Math.sin(rad))];
  }

  function buildNight1Config() {
    const motes = [];
    for (let i = 0; i < 8; i++) {
      const xz = polarXZ(12, i * 45);
      motes.push([xz[0], 0, xz[1]]);
    }
    for (let i = 0; i < 16; i++) {
      const xz = polarXZ(33, i * 22.5);
      motes.push([xz[0], 0, xz[1]]);
    }
    const shades = [];
    for (let i = 0; i < 12; i++) {
      const xz = polarXZ(37, 15 + i * 30);
      shades.push([xz[0], 0, xz[1]]);
    }
    return {
      night: 1,
      name: 'Đảo Bến',
      spawnPos: [0, 0, 0],
      durationKey: 'night1_duration_s',
      shadeSpeed: 4.0,
      shadeSpawnPeriodTicks: 480,
      maxShades: 6,
      randomDriftersDefault: false,
      windEnabledDefault: false,
      lanterns: [
        { id: 'L1', pos: [0, 0, 25] },
        { id: 'L2', pos: [23.8, 0, 7.7] },
        { id: 'L3', pos: [14.7, 0, -20.2] },
        { id: 'L4', pos: [-14.7, 0, -20.2] },
        { id: 'L5', pos: [-23.8, 0, 7.7] }
      ],
      moteSpawnPoints: motes,
      shadeSpawnPoints: shades,
      launchpads: [],
      charms: []
    };
  }

  function buildNight2Config() {
    const motes = [];
    const centers = [0, 70];
    for (let c = 0; c < centers.length; c++) {
      const cx = centers[c];
      for (let i = 0; i < 4; i++) {
        const xz = polarXZ(10, i * 90, cx, 0);
        motes.push([xz[0], 0, xz[1]]);
      }
      for (let i = 0; i < 8; i++) {
        const xz = polarXZ(22, i * 45, cx, 0);
        motes.push([xz[0], 0, xz[1]]);
      }
    }
    const shades = [];
    for (let c = 0; c < centers.length; c++) {
      const cx = centers[c];
      for (let i = 0; i < 8; i++) {
        const xz = polarXZ(26, 22.5 + i * 45, cx, 0);
        shades.push([xz[0], 0, xz[1]]);
      }
    }
    return {
      night: 2,
      name: 'Đảo Cau',
      spawnPos: [0, 0, 0],
      durationKey: 'night2_duration_s',
      shadeSpeed: 4.0,
      shadeSpawnPeriodTicks: 420,
      maxShades: 8,
      randomDriftersDefault: true,
      windEnabledDefault: false,
      lanterns: [
        { id: 'L1', pos: [0, 0, 20] },
        { id: 'L2', pos: [17, 0, -10] },
        { id: 'L3', pos: [-17, 0, -10] },
        { id: 'L4', pos: [70, 0, 20] },
        { id: 'L5', pos: [87, 0, -10] },
        { id: 'L6', pos: [53, 0, -10] }
      ],
      moteSpawnPoints: motes,
      shadeSpawnPoints: shades,
      launchpads: [
        { x: 20, y: 0, z: 18, radius: 1.0, targetX: 70, targetZ: 0, vy: 14.0, vh: 24.0 },
        { x: 50, y: 0, z: -18, radius: 1.0, targetX: 0, targetZ: 0, vy: 14.0, vh: 24.0 }
      ],
      charms: [
        { id: 'C1', pos: [35, 0, 0] }
      ]
    };
  }

  function buildNight3Config() {
    const motes = [];
    // Tier 0: 18 points at r=34 (every 20 deg from 0)
    for (let i = 0; i < 18; i++) {
      const xz = polarXZ(34, i * 20);
      motes.push([xz[0], 0, xz[1]]);
    }
    // Tier 1: 8 points at r=18 (20, 40, ..., 160)
    for (let i = 1; i <= 8; i++) {
      const xz = polarXZ(18, i * 20);
      motes.push([xz[0], 3, xz[1]]);
    }
    // Tier 2: 4 points at r=5 (45, 135, 225, 315)
    for (let i = 0; i < 4; i++) {
      const xz = polarXZ(5, 45 + i * 90);
      motes.push([xz[0], 6, xz[1]]);
    }
    const shades = [];
    for (let i = 0; i < 16; i++) {
      const xz = polarXZ(43, i * 22.5);
      shades.push([xz[0], 0, xz[1]]);
    }
    return {
      night: 3,
      name: 'Đảo Chuông',
      spawnPos: [0, 0, -14],
      durationKey: 'night3_duration_s',
      shadeSpeed: 4.5,
      shadeSpawnPeriodTicks: 360,
      maxShades: 10,
      randomDriftersDefault: true,
      windEnabledDefault: true,
      lanterns: [
        { id: 'L1', pos: [0, 6, 6] },
        { id: 'L2', pos: [18, 3, 10] },
        { id: 'L3', pos: [-18, 3, 10] },
        { id: 'L4', pos: [35, 0, -10] },
        { id: 'L5', pos: [-35, 0, -10] },
        { id: 'L6', pos: [20, 0, -35] },
        { id: 'L7', pos: [-20, 0, -35] }
      ],
      moteSpawnPoints: motes,
      shadeSpawnPoints: shades,
      launchpads: [
        { x: 0, y: 3, z: 13, radius: 1.0, fixedDir: [0, -1], vy: 12.0, vh: 8.0 }
      ],
      charms: [
        { id: 'C1', pos: [30, 0, 25] },
        { id: 'C2', pos: [-30, 0, 25] }
      ]
    };
  }

  const NIGHT_CONFIGS = {
    1: buildNight1Config(),
    2: buildNight2Config(),
    3: buildNight3Config()
  };

  const NIGHT3_RAMPS = [
    { cos: Math.cos(Math.PI / 6), sin: Math.sin(Math.PI / 6) },       // 30 deg
    { cos: Math.cos((5 * Math.PI) / 6), sin: Math.sin((5 * Math.PI) / 6) } // 150 deg
  ];

  function getRampHeightNight3(x, z) {
    for (let i = 0; i < NIGHT3_RAMPS.length; i++) {
      const rm = NIGHT3_RAMPS[i];
      const s = x * rm.cos + z * rm.sin;
      const p = -x * rm.sin + z * rm.cos;
      if (s >= 24.0 && s <= 30.0 && Math.abs(p) <= 1.5) {
        return 3.0 * ((30.0 - s) / 6.0);
      }
    }
    return null;
  }

  function getGroundHeight(night, x, z, refY) {
    if (night === 1) {
      return Math.hypot(x, z) <= 40.0 ? 0 : null;
    }
    if (night === 2) {
      if (Math.hypot(x, z) <= 28.0) return 0;
      if (Math.hypot(x - 70, z) <= 28.0) return 0;
      if (x >= 26.0 && x <= 44.0 && Math.abs(z) <= 2.0) return 0;
      return null;
    }
    if (night === 3) {
      const r = Math.hypot(x, z);
      const yCheck = refY !== undefined ? refY : 100;
      if (r <= 8.0 && yCheck >= 5.5) return 6.0;
      const rampY = getRampHeightNight3(x, z);
      if (rampY !== null && yCheck >= rampY - 0.5) return rampY;
      if (r >= 12.0 && r <= 24.0 && z > 0 && yCheck >= 2.5) return 3.0;
      if (r <= 45.0) return 0;
      return null;
    }
    return null;
  }

  function isBlockedHorizontalNight3(x, z, y) {
    const r = Math.hypot(x, z);
    // Bell tower at center of Tier 2 (radius 2 m, height 8 m -> Y=6..14, cannot climb)
    if (y >= 5.5 && y <= 14.5 && r < 2.0) {
      return true;
    }
    // Tier 2 solid wall (radius 8 m, height 6 m)
    if (y < 5.55 && r < 8.0) {
      return true;
    }
    // Tier 1 solid wall (r in [12, 24], z > 0, height 3 m), except via ramps
    if (y < 2.55 && r >= 12.0 && r <= 24.0 && z > 0) {
      const rampY = getRampHeightNight3(x, z);
      if (rampY === null || y < rampY - 0.45) {
        return true;
      }
    }
    // Side walls of ramps when below ramp surface by > 0.45 m
    const rampY = getRampHeightNight3(x, z);
    if (rampY !== null && y < rampY - 0.45) {
      return true;
    }
    return false;
  }

  function resolveEntityHorizontal(night, prevX, prevZ, nextX, nextZ, y, stopOnBlock) {
    if (night !== 3) {
      return { x: nextX, z: nextZ, blocked: false };
    }
    if (!isBlockedHorizontalNight3(nextX, nextZ, y)) {
      return { x: nextX, z: nextZ, blocked: false };
    }
    if (stopOnBlock) {
      return { x: prevX, z: prevZ, blocked: true };
    }
    // Try axis sliding along X or Z
    if (!isBlockedHorizontalNight3(nextX, prevZ, y)) {
      return { x: nextX, z: prevZ, blocked: true };
    }
    if (!isBlockedHorizontalNight3(prevX, nextZ, y)) {
      return { x: prevX, z: nextZ, blocked: true };
    }
    // Push radially out of Bell Tower if inside tower cylinder
    const r = Math.hypot(nextX, nextZ);
    if (y >= 5.5 && r < 2.0) {
      const ang = r > 1e-6 ? Math.atan2(nextZ, nextX) : 0;
      return { x: Math.cos(ang) * 2.02, z: Math.sin(ang) * 2.02, blocked: true };
    }
    return { x: prevX, z: prevZ, blocked: true };
  }

  function cloneTuning(override) {
    const base = JSON.parse(JSON.stringify(DEFAULT_TUNING));
    if (override && typeof override === 'object') {
      Object.assign(base, override);
      if (override.score) {
        base.score = Object.assign({}, DEFAULT_TUNING.score, override.score);
      }
    }
    return base;
  }

  function createRng(seed) {
    let a = (Number(seed) | 0) >>> 0;
    return function nextFloat() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function distXZ(a, b) {
    return Math.hypot(a[0] - b[0], a[2] - b[2]);
  }

  function dist3D(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }

  function parseTrailingNum(id, prefix) {
    if (typeof id !== 'string' || !id.startsWith(prefix)) return 0;
    const n = Number(id.slice(prefix.length));
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

  function compareIds(a, b) {
    const numA = parseTrailingNum(a, a[0] || '');
    const numB = parseTrailingNum(b, b[0] || '');
    if (numA && numB && a[0] === b[0]) return numA - numB;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function validatePosArray(pos, label) {
    if (!Array.isArray(pos) || pos.length !== 3) {
      return label + ' must be a [x, y, z] array';
    }
    for (let i = 0; i < 3; i++) {
      if (typeof pos[i] !== 'number' || !Number.isFinite(pos[i])) {
        return label + ' must contain finite numbers';
      }
    }
    return null;
  }

  function validateScenario(scenario, night) {
    if (scenario === null || typeof scenario !== 'object' || Array.isArray(scenario)) {
      return 'Scenario must be a JSON object';
    }
    if (scenario.player !== undefined) {
      const p = scenario.player;
      if (p === null || typeof p !== 'object' || Array.isArray(p)) {
        return 'scenario.player must be an object';
      }
      if (p.pos !== undefined) {
        const err = validatePosArray(p.pos, 'scenario.player.pos');
        if (err) return err;
      }
      const intFields = ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights'];
      for (let i = 0; i < intFields.length; i++) {
        const k = intFields[i];
        if (p[k] !== undefined && (!Number.isInteger(p[k]) || p[k] < 0)) {
          return 'scenario.player.' + k + ' must be a non-negative integer';
        }
      }
    }
    const boolFlags = ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'];
    for (let i = 0; i < boolFlags.length; i++) {
      const k = boolFlags[i];
      if (scenario[k] !== undefined && typeof scenario[k] !== 'boolean') {
        return 'scenario.' + k + ' must be a boolean';
      }
    }
    if (scenario.motes !== undefined) {
      if (!Array.isArray(scenario.motes)) return 'scenario.motes must be an array';
      for (let i = 0; i < scenario.motes.length; i++) {
        const m = scenario.motes[i];
        if (Array.isArray(m)) {
          const err = validatePosArray(m, 'scenario.motes[' + i + ']');
          if (err) return err;
        } else if (m && typeof m === 'object') {
          const err = validatePosArray(m.pos, 'scenario.motes[' + i + '].pos');
          if (err) return err;
          if (m.id !== undefined && typeof m.id !== 'string') return 'scenario.motes[' + i + '].id must be a string';
        } else {
          return 'scenario.motes[' + i + '] must be [x,y,z] or {pos}';
        }
      }
    }
    if (scenario.shades !== undefined) {
      if (!Array.isArray(scenario.shades)) return 'scenario.shades must be an array';
      const validShadeStates = new Set(['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain']);
      for (let i = 0; i < scenario.shades.length; i++) {
        const s = scenario.shades[i];
        if (Array.isArray(s)) {
          const err = validatePosArray(s, 'scenario.shades[' + i + ']');
          if (err) return err;
        } else if (s && typeof s === 'object') {
          const err = validatePosArray(s.pos, 'scenario.shades[' + i + '].pos');
          if (err) return err;
          if (s.id !== undefined && typeof s.id !== 'string') return 'scenario.shades[' + i + '].id must be a string';
          if (s.state !== undefined && !validShadeStates.has(s.state)) {
            return 'scenario.shades[' + i + '].state invalid: ' + s.state;
          }
          if (s.state_ticks_left !== undefined && (!Number.isInteger(s.state_ticks_left) || s.state_ticks_left < 0)) {
            return 'scenario.shades[' + i + '].state_ticks_left must be a non-negative integer';
          }
          if (s.target_lantern_id !== undefined && s.target_lantern_id !== null && typeof s.target_lantern_id !== 'string') {
            return 'scenario.shades[' + i + '].target_lantern_id must be a string';
          }
        } else {
          return 'scenario.shades[' + i + '] must be {pos}';
        }
      }
    }
    if (scenario.drifters !== undefined) {
      if (!Array.isArray(scenario.drifters)) return 'scenario.drifters must be an array';
      const validDrifterStates = new Set(['idle', 'chase', 'flee', 'removed']);
      for (let i = 0; i < scenario.drifters.length; i++) {
        const d = scenario.drifters[i];
        if (Array.isArray(d)) {
          const err = validatePosArray(d, 'scenario.drifters[' + i + ']');
          if (err) return err;
        } else if (d && typeof d === 'object') {
          const err = validatePosArray(d.pos, 'scenario.drifters[' + i + '].pos');
          if (err) return err;
          if (d.id !== undefined && typeof d.id !== 'string') return 'scenario.drifters[' + i + '].id must be a string';
          if (d.state !== undefined && !validDrifterStates.has(d.state)) {
            return 'scenario.drifters[' + i + '].state invalid: ' + d.state;
          }
          if (d.stolen !== undefined && (!Number.isInteger(d.stolen) || d.stolen < 0)) {
            return 'scenario.drifters[' + i + '].stolen must be a non-negative integer';
          }
        } else {
          return 'scenario.drifters[' + i + '] must be {pos}';
        }
      }
    }
    if (scenario.charms !== undefined) {
      if (!Array.isArray(scenario.charms)) return 'scenario.charms must be an array';
      for (let i = 0; i < scenario.charms.length; i++) {
        const c = scenario.charms[i];
        if (!c || typeof c !== 'object' || Array.isArray(c)) {
          return 'scenario.charms[' + i + '] must be an object';
        }
        if (c.pos !== undefined) {
          const err = validatePosArray(c.pos, 'scenario.charms[' + i + '].pos');
          if (err) return err;
        }
        if (c.id !== undefined && typeof c.id !== 'string') return 'scenario.charms[' + i + '].id must be a string';
        if (c.available !== undefined && typeof c.available !== 'boolean') {
          return 'scenario.charms[' + i + '].available must be a boolean';
        }
        if (c.respawn_ticks !== undefined && (!Number.isInteger(c.respawn_ticks) || c.respawn_ticks < 0)) {
          return 'scenario.charms[' + i + '].respawn_ticks must be a non-negative integer';
        }
      }
    }
    if (scenario.lanterns !== undefined) {
      if (!Array.isArray(scenario.lanterns)) return 'scenario.lanterns must be an array';
      const maxL = night ? NIGHT_CONFIGS[night].lanterns.length : 7;
      const validIds = new Set();
      for (let k = 1; k <= maxL; k++) validIds.add('L' + k);
      for (let i = 0; i < scenario.lanterns.length; i++) {
        const l = scenario.lanterns[i];
        if (!l || typeof l !== 'object' || Array.isArray(l)) {
          return 'scenario.lanterns[' + i + '] must be an object';
        }
        if (typeof l.id !== 'string' || !validIds.has(l.id)) {
          return 'scenario.lanterns[' + i + '].id invalid for night: ' + l.id;
        }
        if (l.pos !== undefined) {
          const err = validatePosArray(l.pos, 'scenario.lanterns[' + i + '].pos');
          if (err) return err;
        }
        if (l.deposited !== undefined && (!Number.isInteger(l.deposited) || l.deposited < 0)) {
          return 'scenario.lanterns[' + i + '].deposited must be a non-negative integer';
        }
        if (l.lit !== undefined && typeof l.lit !== 'boolean') {
          return 'scenario.lanterns[' + i + '].lit must be a boolean';
        }
        if (l.fuel !== undefined && (typeof l.fuel !== 'number' || !Number.isFinite(l.fuel) || l.fuel < 0 || l.fuel > 100)) {
          return 'scenario.lanterns[' + i + '].fuel must be in [0, 100]';
        }
        if (l.ever_lit !== undefined && typeof l.ever_lit !== 'boolean') {
          return 'scenario.lanterns[' + i + '].ever_lit must be a boolean';
        }
      }
    }
    if (scenario.time_left_s !== undefined && (typeof scenario.time_left_s !== 'number' || !Number.isFinite(scenario.time_left_s) || scenario.time_left_s < 0)) {
      return 'scenario.time_left_s must be a non-negative finite number';
    }
    return null;
  }

  function validateInputs(inputs) {
    if (inputs === null || typeof inputs !== 'object' || Array.isArray(inputs)) {
      return 'Inputs must be a JSON object';
    }
    if (!Array.isArray(inputs.frames)) {
      return 'Inputs must contain a "frames" array';
    }
    let prevTick = -1;
    for (let i = 0; i < inputs.frames.length; i++) {
      const f = inputs.frames[i];
      if (!f || typeof f !== 'object' || Array.isArray(f)) {
        return 'frames[' + i + '] must be an object';
      }
      if (!Number.isInteger(f.tick) || f.tick < 0) {
        return 'frames[' + i + '].tick must be a non-negative integer';
      }
      if (f.tick <= prevTick) {
        return 'frames[' + i + '].tick (' + f.tick + ') must be strictly increasing';
      }
      prevTick = f.tick;
      if (f.move !== undefined) {
        if (!Array.isArray(f.move) || f.move.length !== 2 ||
            typeof f.move[0] !== 'number' || !Number.isFinite(f.move[0]) ||
            typeof f.move[1] !== 'number' || !Number.isFinite(f.move[1])) {
          return 'frames[' + i + '].move must be [x, z] finite numbers';
        }
      }
      if (f.cam_yaw_deg !== undefined && (typeof f.cam_yaw_deg !== 'number' || !Number.isFinite(f.cam_yaw_deg))) {
        return 'frames[' + i + '].cam_yaw_deg must be a finite number';
      }
      const boolKeys = ['jump', 'interact', 'pulse', 'dash', 'pause'];
      for (let b = 0; b < boolKeys.length; b++) {
        const key = boolKeys[b];
        if (f[key] !== undefined && typeof f[key] !== 'boolean') {
          return 'frames[' + i + '].' + key + ' must be a boolean';
        }
      }
    }
    return null;
  }

  function createGame(options) {
    const opts = options || {};
    const night = opts.night !== undefined ? opts.night : 1;
    const cfg = NIGHT_CONFIGS[night];
    if (!cfg) {
      throw new Error('Unsupported night: ' + night);
    }
    const seed = opts.seed !== undefined ? opts.seed : 1;
    const tuning = cloneTuning(opts.tuning);
    const rng = createRng(seed);
    const durationS = tuning[cfg.durationKey] || tuning.night1_duration_s;

    const state = {
      seed: Number(seed) | 0,
      night: night,
      mapConfig: cfg,
      tuning: tuning,
      rng: rng,
      tick: 0,
      simTick: 0,
      nightStarted: false,
      gameState: 'playing', // 'playing' | 'paused' | 'won' | 'lost'
      initialTimeLeft: durationS,
      timeLeftS: durationS,
      score: 0,
      randomMotes: true,
      randomShades: true,
      randomDrifters: cfg.randomDriftersDefault,
      windEnabled: cfg.windEnabledDefault,
      wind: { active: false, dir_deg: 0 },
      windWarning: false,
      windTicksLeft: 0,
      successfulLights: 0,
      benchMode: false,
      player: {
        pos: [cfg.spawnPos[0], cfg.spawnPos[1], cfg.spawnPos[2]],
        vel: [0, 0, 0],
        grounded: true,
        launchLocked: false,
        facingAngle: 0, // facing +Z (atan2(0, 1) = 0)
        flames: tuning.flames,
        carried: 0,
        invulnTicks: 0,
        dashTicks: 0,
        dashDir: [0, 1],
        dashCooldownTicks: 0,
        pulseCooldownTicks: 0,
        charmTicks: 0,
        respawnTicks: 0
      },
      lanterns: cfg.lanterns.map(function (l) {
        return {
          id: l.id,
          pos: [l.pos[0], l.pos[1], l.pos[2]],
          lit: false,
          deposited: 0,
          fuelUnits: 0,
          everLit: false,
          relitCount: 0
        };
      }),
      motes: [],
      shades: [],
      drifters: [],
      charms: cfg.charms.map(function (c) {
        return {
          id: c.id,
          pos: [c.pos[0], c.pos[1], c.pos[2]],
          available: true,
          respawnTicks: 0
        };
      }),
      nextMoteNum: 1,
      nextShadeNum: 1,
      nextDrifterNum: 1,
      pulseVisualTimer: 0,
      lastPulsePos: [0, 0, 0],
      prevInput: {
        move: [0, 0],
        cam_yaw_deg: 0,
        jump: false,
        interact: false,
        pulse: false,
        dash: false,
        pause: false
      },
      currInput: {
        move: [0, 0],
        cam_yaw_deg: 0,
        jump: false,
        interact: false,
        pulse: false,
        dash: false,
        pause: false
      }
    };

    const scenario = opts.scenario || null;
    if (scenario) {
      const err = validateScenario(scenario, night);
      if (err) {
        const e = new Error(err);
        e.code = 'INVALID_SCENARIO';
        throw e;
      }
      if (scenario.random_motes !== undefined) state.randomMotes = scenario.random_motes;
      if (scenario.random_shades !== undefined) state.randomShades = scenario.random_shades;
      if (scenario.random_drifters !== undefined) state.randomDrifters = scenario.random_drifters;
      if (scenario.wind_enabled !== undefined) state.windEnabled = scenario.wind_enabled;
      if (scenario.time_left_s !== undefined) {
        state.initialTimeLeft = scenario.time_left_s;
        state.timeLeftS = scenario.time_left_s;
      }

      if (scenario.player) {
        const sp = scenario.player;
        if (sp.pos !== undefined) {
          state.player.pos = [sp.pos[0], sp.pos[1], sp.pos[2]];
          const gY = getGroundHeight(night, sp.pos[0], sp.pos[2], sp.pos[1]);
          state.player.grounded = gY !== null && Math.abs(sp.pos[1] - gY) <= 0.05;
        }
        if (sp.carried !== undefined) state.player.carried = sp.carried;
        if (sp.flames !== undefined) state.player.flames = sp.flames;
        if (sp.invuln_ticks !== undefined) state.player.invulnTicks = sp.invuln_ticks;
        if (sp.dash_cd_ticks !== undefined) state.player.dashCooldownTicks = sp.dash_cd_ticks;
        if (sp.pulse_cd_ticks !== undefined) state.player.pulseCooldownTicks = sp.pulse_cd_ticks;
        if (sp.charm_ticks !== undefined) state.player.charmTicks = sp.charm_ticks;
        if (sp.successful_lights !== undefined) state.successfulLights = sp.successful_lights;
      }

      if (scenario.lanterns) {
        const byId = new Map(state.lanterns.map(function (l) { return [l.id, l]; }));
        for (let i = 0; i < scenario.lanterns.length; i++) {
          const patch = scenario.lanterns[i];
          const target = byId.get(patch.id);
          if (!target) continue;
          if (patch.pos !== undefined) target.pos = [patch.pos[0], patch.pos[1], patch.pos[2]];
          if (patch.ever_lit !== undefined) target.everLit = patch.ever_lit;
          if (patch.deposited !== undefined) target.deposited = patch.deposited;
          if (patch.lit !== undefined) {
            target.lit = patch.lit;
            if (patch.lit) {
              target.fuelUnits = patch.fuel !== undefined ? Math.round(patch.fuel * FUEL_UNITS_PER_FUEL) : FUEL_MAX_UNITS;
              if (patch.ever_lit === undefined) target.everLit = true;
              if (patch.deposited === undefined) target.deposited = tuning.lantern_cost;
            } else {
              target.fuelUnits = 0;
            }
          } else if (patch.fuel !== undefined) {
            target.fuelUnits = Math.round(patch.fuel * FUEL_UNITS_PER_FUEL);
            if (target.fuelUnits > 0) {
              target.lit = true;
              if (patch.ever_lit === undefined) target.everLit = true;
            } else {
              target.lit = false;
            }
          } else if (patch.deposited !== undefined) {
            const costNeeded = target.everLit ? tuning.relight_cost : tuning.lantern_cost;
            if (patch.deposited >= costNeeded) {
              target.lit = true;
              target.fuelUnits = FUEL_MAX_UNITS;
              if (patch.ever_lit === undefined) target.everLit = true;
            }
          }
        }
      }

      if (scenario.motes !== undefined) {
        for (let i = 0; i < scenario.motes.length; i++) {
          const item = scenario.motes[i];
          let id, pos;
          if (Array.isArray(item)) {
            id = 'M' + state.nextMoteNum++;
            pos = [item[0], item[1], item[2]];
          } else {
            id = item.id || ('M' + state.nextMoteNum++);
            pos = [item.pos[0], item.pos[1], item.pos[2]];
          }
          const num = parseTrailingNum(id, 'M');
          if (num >= state.nextMoteNum) state.nextMoteNum = num + 1;
          state.motes.push({
            id: id,
            pos: pos,
            kind: (item && item.kind) || 'random',
            ttlTicks: item && item.kind === 'dropped' ? 480 : null,
            pickupDelayTicks: 0
          });
        }
      } else if (state.randomMotes) {
        populateInitialMotes(state);
      }

      if (scenario.shades !== undefined) {
        for (let i = 0; i < scenario.shades.length; i++) {
          const item = scenario.shades[i];
          let id, pos, shadeState, stateTicksLeft, targetLanternId;
          if (Array.isArray(item)) {
            id = 'S' + state.nextShadeNum++;
            pos = [item[0], item[1], item[2]];
            shadeState = 'chase';
            stateTicksLeft = 0;
            targetLanternId = null;
          } else {
            id = item.id || ('S' + state.nextShadeNum++);
            pos = [item.pos[0], item.pos[1], item.pos[2]];
            shadeState = item.state || 'chase';
            targetLanternId = item.target_lantern_id || null;
            if (item.state_ticks_left !== undefined) {
              stateTicksLeft = item.state_ticks_left;
            } else if (shadeState === 'stunned') {
              stateTicksLeft = 120;
            } else if (shadeState === 'recoil') {
              stateTicksLeft = 60;
            } else if (shadeState === 'spawning') {
              stateTicksLeft = 60;
            } else {
              stateTicksLeft = 0;
            }
          }
          if (shadeState === 'drain' && !targetLanternId) {
            let bestL = null;
            let bestD = Infinity;
            for (let li = 0; li < state.lanterns.length; li++) {
              const l = state.lanterns[li];
              if (!l.lit) continue;
              const d = distXZ(pos, l.pos);
              if (d <= 2.0 && d < bestD) {
                bestD = d;
                bestL = l;
              }
            }
            if (bestL) targetLanternId = bestL.id;
          }
          const num = parseTrailingNum(id, 'S');
          if (num >= state.nextShadeNum) state.nextShadeNum = num + 1;
          const gY = getGroundHeight(night, pos[0], pos[2], pos[1]);
          const baseGround = gY !== null ? gY : 0;
          state.shades.push({
            id: id,
            pos: pos,
            heightOffset: pos[1] - baseGround,
            state: shadeState,
            stateTicksLeft: stateTicksLeft,
            knockbackTicks: 0,
            knockbackDir: [1, 0],
            recoilDir: [1, 0],
            pushoutTicks: 0,
            targetLanternId: targetLanternId,
            drainTicks: 0,
            wanderAngle: (i * 1.7) % (Math.PI * 2),
            facingAngle: 0
          });
        }
      }

      if (scenario.drifters !== undefined) {
        for (let i = 0; i < scenario.drifters.length; i++) {
          const item = scenario.drifters[i];
          let id, pos, dState, stolen;
          if (Array.isArray(item)) {
            id = 'D' + state.nextDrifterNum++;
            pos = [item[0], item[1], item[2]];
            dState = 'idle';
            stolen = 0;
          } else {
            id = item.id || ('D' + state.nextDrifterNum++);
            pos = [item.pos[0], item.pos[1], item.pos[2]];
            dState = item.state || 'idle';
            stolen = item.stolen || 0;
          }
          const num = parseTrailingNum(id, 'D');
          if (num >= state.nextDrifterNum) state.nextDrifterNum = num + 1;
          state.drifters.push({
            id: id,
            pos: pos,
            state: dState,
            stolen: stolen,
            hasStolen: stolen > 0 || dState === 'flee' || dState === 'removed',
            fleeTicksLeft: dState === 'flee' ? 240 : 0,
            wanderAngle: (i * 2.1) % (Math.PI * 2)
          });
        }
      }

      if (scenario.charms !== undefined) {
        state.charms = [];
        for (let i = 0; i < scenario.charms.length; i++) {
          const item = scenario.charms[i];
          const id = item.id || ('C' + (i + 1));
          const pos = item.pos ? [item.pos[0], item.pos[1], item.pos[2]] : [0, 0, 0];
          const available = item.available !== undefined ? item.available : true;
          const respawnTicks = item.respawn_ticks !== undefined ? item.respawn_ticks : (available ? 0 : 2700);
          state.charms.push({
            id: id,
            pos: pos,
            available: available,
            respawnTicks: respawnTicks
          });
        }
      }
    } else {
      populateInitialMotes(state);
    }

    return state;
  }

  function createBenchGame(seed) {
    const useSeed = seed !== undefined ? seed : 42;
    const state = createGame({
      seed: useSeed,
      night: 1,
      scenario: {
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        wind_enabled: false,
        player: { pos: [0, 0, 0], carried: 0, flames: 3 },
        lanterns: [
          { id: 'L1', lit: true, fuel: 100 },
          { id: 'L2', lit: true, fuel: 100 },
          { id: 'L3', lit: true, fuel: 100 },
          { id: 'L4', lit: false },
          { id: 'L5', lit: false }
        ],
        motes: [],
        shades: []
      }
    });
    state.benchMode = true;

    // Scatter 100 motes evenly across Night 1 island (seed deterministic)
    for (let i = 0; i < 100; i++) {
      const r = Math.sqrt(state.rng()) * 36.0;
      const a = state.rng() * Math.PI * 2;
      const mx = round3(Math.cos(a) * r);
      const mz = round3(Math.sin(a) * r);
      state.motes.push({
        id: 'M' + state.nextMoteNum++,
        pos: [mx, 0, mz],
        kind: 'random',
        ttlTicks: null,
        pickupDelayTicks: 0
      });
    }

    // Scatter 200 wander Shades evenly across Night 1 island outside L1-L3 safe zones
    let spawned = 0;
    let guard = 0;
    while (spawned < 200 && guard < 4000) {
      guard++;
      const r = Math.sqrt(state.rng()) * 36.5;
      const a = state.rng() * Math.PI * 2;
      const sx = round3(Math.cos(a) * r);
      const sz = round3(Math.sin(a) * r);
      let blocked = false;
      for (let li = 0; li < state.lanterns.length; li++) {
        if (isLanternSafeActive(state.lanterns[li]) &&
            Math.hypot(sx - state.lanterns[li].pos[0], sz - state.lanterns[li].pos[2]) <= state.tuning.safe_radius + 0.25) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const wa = state.rng() * Math.PI * 2;
      state.shades.push({
        id: 'S' + state.nextShadeNum++,
        pos: [sx, 1.0, sz],
        heightOffset: 1.0,
        state: 'wander',
        stateTicksLeft: 0,
        knockbackTicks: 0,
        knockbackDir: [1, 0],
        recoilDir: [1, 0],
        pushoutTicks: 0,
        targetLanternId: null,
        drainTicks: 0,
        wanderAngle: wa,
        facingAngle: wa
      });
      spawned++;
    }
    return state;
  }

  function populateInitialMotes(state) {
    const pool = state.mapConfig.moteSpawnPoints.slice();
    // Fisher-Yates shuffle with seeded RNG so 20 distinct points are chosen
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(state.rng() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    const count = Math.min(20, pool.length);
    for (let i = 0; i < count; i++) {
      state.motes.push({
        id: 'M' + state.nextMoteNum++,
        pos: [pool[i][0], pool[i][1], pool[i][2]],
        kind: 'random',
        ttlTicks: null,
        pickupDelayTicks: 0
      });
    }
  }

  function spawnOneScheduledMote(state) {
    if (state.motes.length >= 30) return;
    const pool = state.mapConfig.moteSpawnPoints;
    const free = [];
    for (let i = 0; i < pool.length; i++) {
      const pt = pool[i];
      let occupied = false;
      for (let m = 0; m < state.motes.length; m++) {
        if (distXZ(pt, state.motes[m].pos) < 0.5 && Math.abs(pt[1] - state.motes[m].pos[1]) < 1.0) {
          occupied = true;
          break;
        }
      }
      if (!occupied) free.push(pt);
    }
    if (free.length === 0) return;
    const idx = Math.floor(state.rng() * free.length);
    const chosen = free[idx];
    state.motes.push({
      id: 'M' + state.nextMoteNum++,
      pos: [chosen[0], chosen[1], chosen[2]],
      kind: 'random',
      ttlTicks: null,
      pickupDelayTicks: 0
    });
  }

  function getPlayerCapacity(state) {
    return Math.min(state.tuning.capacity_max, state.tuning.carry_capacity + 2 * state.successfulLights);
  }

  function isLanternSafeActive(l) {
    return l.lit && l.fuelUnits >= FUEL_LOW_UNITS;
  }

  function spawnOneShade(state) {
    const pool = state.mapConfig.shadeSpawnPoints;
    const valid = [];
    for (let i = 0; i < pool.length; i++) {
      const pt = pool[i];
      if (distXZ(pt, state.player.pos) < 15.0) continue;
      let inSafe = false;
      for (let l = 0; l < state.lanterns.length; l++) {
        if (isLanternSafeActive(state.lanterns[l]) && distXZ(pt, state.lanterns[l].pos) <= state.tuning.safe_radius) {
          inSafe = true;
          break;
        }
      }
      if (!inSafe) valid.push(pt);
    }
    if (valid.length === 0) return null;
    const idx = Math.floor(state.rng() * valid.length);
    const pt = valid[idx];
    const shade = {
      id: 'S' + state.nextShadeNum++,
      pos: [pt[0], pt[1] + 1.0, pt[2]],
      heightOffset: 1.0,
      state: 'spawning',
      stateTicksLeft: 60,
      knockbackTicks: 0,
      knockbackDir: [1, 0],
      recoilDir: [1, 0],
      pushoutTicks: 0,
      targetLanternId: null,
      drainTicks: 0,
      wanderAngle: state.rng() * Math.PI * 2,
      facingAngle: 0
    };
    state.shades.push(shade);
    return shade;
  }

  function spawnOneDrifter(state) {
    const pool = state.mapConfig.shadeSpawnPoints;
    if (pool.length === 0) return null;
    const idx = Math.floor(state.rng() * pool.length);
    const pt = pool[idx];
    const drifter = {
      id: 'D' + state.nextDrifterNum++,
      pos: [pt[0], pt[1] + 1.2, pt[2]],
      state: 'idle',
      stolen: 0,
      hasStolen: false,
      fleeTicksLeft: 0,
      wanderAngle: state.rng() * Math.PI * 2
    };
    state.drifters.push(drifter);
    return drifter;
  }

  function isInsideLitLanternSafe(pos, lanterns, safeRadius) {
    for (let i = 0; i < lanterns.length; i++) {
      const l = lanterns[i];
      if (isLanternSafeActive(l) && distXZ(pos, l.pos) <= safeRadius && Math.abs(pos[1] - l.pos[1]) <= 2.5) {
        return true;
      }
    }
    return false;
  }

  function clampShadeSafeBoundary(shade, lanterns, safeRadius) {
    const minDist = safeRadius + 0.02;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < lanterns.length; i++) {
        const l = lanterns[i];
        if (!isLanternSafeActive(l)) continue;
        const dx = shade.pos[0] - l.pos[0];
        const dz = shade.pos[2] - l.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < minDist) {
          const nx = d > 1e-6 ? dx / d : 1;
          const nz = d > 1e-6 ? dz / d : 0;
          shade.pos[0] = l.pos[0] + nx * minDist;
          shade.pos[2] = l.pos[2] + nz * minDist;
        }
      }
    }
  }

  function moveShadeOnTerrain(state, shade, targetX, targetZ, speed) {
    const step = speed * DT;
    const dx = targetX - shade.pos[0];
    const dz = targetZ - shade.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < 1e-5) return;
    const dirX = dx / d;
    const dirZ = dz / d;
    const distToMove = Math.min(d, step);
    const prevX = shade.pos[0];
    const prevZ = shade.pos[2];
    let nx = prevX + dirX * distToMove;
    let nz = prevZ + dirZ * distToMove;
    shade.facingAngle = Math.atan2(dirX, dirZ);

    const baseGround = shade.pos[1] - shade.heightOffset;
    const res = resolveEntityHorizontal(state.night, prevX, prevZ, nx, nz, baseGround, false);
    nx = res.x;
    nz = res.z;

    const gY = getGroundHeight(state.night, nx, nz, baseGround);
    if (gY === null) {
      // Try sliding along X or Z to stay on valid island surface
      const gx = getGroundHeight(state.night, nx, prevZ, baseGround);
      const gz = getGroundHeight(state.night, prevX, nz, baseGround);
      if (gx !== null) {
        shade.pos[0] = nx;
        shade.pos[1] = gx + shade.heightOffset;
      } else if (gz !== null) {
        shade.pos[2] = nz;
        shade.pos[1] = gz + shade.heightOffset;
      }
    } else {
      shade.pos[0] = nx;
      shade.pos[2] = nz;
      shade.pos[1] = gY + shade.heightOffset;
    }

    if (shade.pushoutTicks <= 0) {
      clampShadeSafeBoundary(shade, state.lanterns, state.tuning.safe_radius);
    }
  }

  function applyInputFrame(state, frame) {
    if (!frame) return;
    if (frame.move !== undefined) state.currInput.move = [frame.move[0], frame.move[1]];
    if (frame.cam_yaw_deg !== undefined) state.currInput.cam_yaw_deg = frame.cam_yaw_deg;
    if (frame.jump !== undefined) state.currInput.jump = frame.jump;
    if (frame.interact !== undefined) state.currInput.interact = frame.interact;
    if (frame.pulse !== undefined) state.currInput.pulse = frame.pulse;
    if (frame.dash !== undefined) state.currInput.dash = frame.dash;
    if (frame.pause !== undefined) state.currInput.pause = frame.pause;
  }

  function step(state, inputFrame) {
    if (state.gameState === 'won' || state.gameState === 'lost') return [];

    // Tick counter always increments even while paused
    state.tick += 1;

    // 1. Read input & process pause first
    if (inputFrame) {
      applyInputFrame(state, inputFrame);
    }
    const pausePressed = Boolean(state.currInput.pause) && !state.prevInput.pause;
    const jumpPressed = Boolean(state.currInput.jump) && !state.prevInput.jump;
    const interactPressed = Boolean(state.currInput.interact) && !state.prevInput.interact;
    const pulsePressed = Boolean(state.currInput.pulse) && !state.prevInput.pulse;
    const dashPressed = Boolean(state.currInput.dash) && !state.prevInput.dash;

    state.prevInput.move = [state.currInput.move[0], state.currInput.move[1]];
    state.prevInput.cam_yaw_deg = state.currInput.cam_yaw_deg;
    state.prevInput.jump = Boolean(state.currInput.jump);
    state.prevInput.interact = Boolean(state.currInput.interact);
    state.prevInput.pulse = Boolean(state.currInput.pulse);
    state.prevInput.dash = Boolean(state.currInput.dash);
    state.prevInput.pause = Boolean(state.currInput.pause);

    const events = [];

    if (pausePressed) {
      if (state.gameState === 'playing') {
        state.gameState = 'paused';
        events.push({ type: 'event', tick: state.tick, name: 'paused', data: {} });
        return events;
      }
      if (state.gameState === 'paused') {
        state.gameState = 'playing';
        events.push({ type: 'event', tick: state.tick, name: 'resumed', data: {} });
      }
    } else if (state.gameState === 'paused') {
      return events;
    }

    if (!state.nightStarted) {
      state.nightStarted = true;
      events.push({ type: 'event', tick: state.tick, name: 'night_start', data: { night: state.night } });
    }

    const t = state.tuning;
    const p = state.player;

    // 2. Decrement timers: time, cooldowns, invuln, stun, charm, dropped TTL, charm respawn, wind
    state.simTick += 1;
    state.timeLeftS = Math.max(0, state.initialTimeLeft - state.simTick / TICK_RATE);

    if (p.invulnTicks > 0) p.invulnTicks -= 1;
    if (p.charmTicks > 0) {
      p.charmTicks -= 1;
      p.dashCooldownTicks = 0;
    } else if (p.dashCooldownTicks > 0) {
      p.dashCooldownTicks -= 1;
    }
    if (p.pulseCooldownTicks > 0) p.pulseCooldownTicks -= 1;
    if (state.pulseVisualTimer > 0) state.pulseVisualTimer = Math.max(0, state.pulseVisualTimer - DT);

    if (p.respawnTicks > 0) {
      p.respawnTicks -= 1;
      if (p.respawnTicks === 0) {
        const sp = state.mapConfig.spawnPos;
        p.pos = [sp[0], sp[1], sp[2]];
        p.vel = [0, 0, 0];
        p.grounded = true;
        p.launchLocked = false;
        p.dashTicks = 0;
        p.invulnTicks = 90;
      }
    }

    for (let i = 0; i < state.shades.length; i++) {
      const s = state.shades[i];
      if (s.stateTicksLeft > 0) {
        s.stateTicksLeft -= 1;
        if (s.stateTicksLeft === 0) {
          if (s.state === 'stunned') {
            s.state = 'wander';
            s.targetLanternId = null;
            s.drainTicks = 0;
          } else if (s.state === 'spawning') {
            s.state = (p.respawnTicks === 0 && distXZ(s.pos, p.pos) <= 12.0) ? 'chase' : 'wander';
          } else if (s.state === 'recoil') {
            s.state = (p.respawnTicks === 0 && distXZ(s.pos, p.pos) <= 18.0) ? 'chase' : 'wander';
          }
        }
      }
    }

    for (let i = 0; i < state.drifters.length; i++) {
      const d = state.drifters[i];
      if (d.state === 'flee' && d.fleeTicksLeft > 0) {
        d.fleeTicksLeft -= 1;
        if (d.fleeTicksLeft === 0) {
          d.state = 'removed';
        }
      }
    }

    if (state.motes.length > 0) {
      let anyExpired = false;
      for (let i = 0; i < state.motes.length; i++) {
        const m = state.motes[i];
        if (m.pickupDelayTicks > 0) m.pickupDelayTicks -= 1;
        if (m.kind === 'dropped') {
          m.ttlTicks -= 1;
          if (m.ttlTicks <= 0) anyExpired = true;
        }
      }
      if (anyExpired) {
        const keptMotes = [];
        for (let i = 0; i < state.motes.length; i++) {
          const m = state.motes[i];
          if (m.kind === 'dropped' && m.ttlTicks <= 0) continue;
          keptMotes.push(m);
        }
        state.motes = keptMotes;
      }
    }

    for (let i = 0; i < state.charms.length; i++) {
      const c = state.charms[i];
      if (!c.available && c.respawnTicks > 0) {
        c.respawnTicks -= 1;
        if (c.respawnTicks === 0) {
          c.available = true;
        }
      }
    }

    if (state.windEnabled) {
      const mod = state.simTick % 1800;
      if (mod === 1680) {
        state.windWarning = true;
        state.wind.dir_deg = Math.floor(state.rng() * 360);
      } else if (mod === 0 && state.simTick > 0) {
        state.windWarning = false;
        state.wind.active = true;
        state.windTicksLeft = 300;
      }
      if (state.windTicksLeft > 0) {
        state.windTicksLeft -= 1;
        if (state.windTicksLeft === 0) {
          state.wind.active = false;
        }
      }
    }

    // Subtract lantern fuel (passive decay + drain) in integer 1/60 units, then extinguish empty lanterns
    if (!state.benchMode) {
      const decayUnits = Math.round(t.fuel_decay_per_s * FUEL_UNITS_PER_FUEL / TICK_RATE);
      const drainUnits = Math.round(t.drain_per_s * FUEL_UNITS_PER_FUEL / TICK_RATE);
      let drainsByLantern = null;
      for (let i = 0; i < state.shades.length; i++) {
        const sh = state.shades[i];
        if (sh.state === 'drain' && sh.targetLanternId) {
          if (!drainsByLantern) drainsByLantern = {};
          if (!drainsByLantern[sh.targetLanternId]) drainsByLantern[sh.targetLanternId] = [];
          drainsByLantern[sh.targetLanternId].push(sh);
        }
      }
      if (drainsByLantern) {
        const lKeys = Object.keys(drainsByLantern);
        for (let ki = 0; ki < lKeys.length; ki++) {
          if (drainsByLantern[lKeys[ki]].length > 1) {
            drainsByLantern[lKeys[ki]].sort(function (a, b) { return compareIds(a.id, b.id); });
          }
        }
      }

      for (let i = 0; i < state.lanterns.length; i++) {
        const l = state.lanterns[i];
        if (!l.lit) continue;
        const drainers = drainsByLantern && drainsByLantern[l.id] ? drainsByLantern[l.id] : null;
        const drainCount = drainers ? drainers.length : 0;
        l.fuelUnits = Math.max(0, l.fuelUnits - decayUnits - drainCount * drainUnits);
        if (drainers) {
          for (let di = 0; di < drainers.length; di++) {
            const sh = drainers[di];
            sh.drainTicks += 1;
            if (sh.drainTicks % 60 === 0) {
              events.push({
                type: 'event',
                tick: state.tick,
                name: 'fuel_drain',
                data: {
                  lantern_id: l.id,
                  shade_id: sh.id,
                  fuel: round1(l.fuelUnits / FUEL_UNITS_PER_FUEL)
                }
              });
            }
          }
        }
        if (l.fuelUnits <= 0) {
          l.lit = false;
          l.fuelUnits = 0;
          l.deposited = 0;
          l.everLit = true;
          events.push({
            type: 'event',
            tick: state.tick,
            name: 'lantern_out',
            data: { lantern_id: l.id }
          });
          if (drainers) {
            for (let di = 0; di < drainers.length; di++) {
              drainers[di].state = 'wander';
              drainers[di].targetLanternId = null;
              drainers[di].drainTicks = 0;
            }
          }
        }
      }
    }

    // 3. Move Mây (jump, dash, launchpad, wind) then fall check
    if (p.respawnTicks === 0) {
      let mx = state.currInput.move[0];
      let mz = state.currInput.move[1];
      const mag = Math.hypot(mx, mz);
      if (mag > 1) {
        mx /= mag;
        mz /= mag;
      }
      const theta = (state.currInput.cam_yaw_deg * Math.PI) / 180;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const wx = mx * cosT + mz * sinT;
      const wz = -mx * sinT + mz * cosT;
      const hasMove = Math.hypot(wx, wz) > 1e-6;

      if (dashPressed && p.dashTicks === 0 && (p.charmTicks > 0 || p.dashCooldownTicks === 0)) {
        p.dashTicks = 12;
        p.dashCooldownTicks = p.charmTicks > 0 ? 0 : 90;
        p.launchLocked = false;
        if (hasMove) {
          const wLen = Math.hypot(wx, wz);
          p.dashDir = [wx / wLen, wz / wLen];
          p.facingAngle = Math.atan2(p.dashDir[0], p.dashDir[1]);
        } else {
          p.dashDir = [Math.sin(p.facingAngle), Math.cos(p.facingAngle)];
        }
        p.vel[0] = p.dashDir[0] * t.dash_speed;
        p.vel[2] = p.dashDir[1] * t.dash_speed;
        if (!p.grounded) p.vel[1] = 0;
        events.push({ type: 'event', tick: state.tick, name: 'dash', data: {} });
      } else if (p.dashTicks > 0) {
        p.vel[0] = p.dashDir[0] * t.dash_speed;
        p.vel[2] = p.dashDir[1] * t.dash_speed;
        if (!p.grounded) p.vel[1] = 0;
      } else if (!p.launchLocked) {
        const maxSpeed = p.charmTicks > 0 ? 7.2 : t.player_speed;
        const accelStep = (maxSpeed / 0.1) * DT;
        const tvx = wx * maxSpeed;
        const tvz = wz * maxSpeed;
        const dvx = tvx - p.vel[0];
        const dvz = tvz - p.vel[2];
        const dv = Math.hypot(dvx, dvz);
        if (dv <= accelStep) {
          p.vel[0] = tvx;
          p.vel[2] = tvz;
        } else if (dv > 1e-9) {
          p.vel[0] += (dvx / dv) * accelStep;
          p.vel[2] += (dvz / dv) * accelStep;
        }
        if (hasMove) {
          p.facingAngle = Math.atan2(wx, wz);
        }
      }

      const dashingAir = p.dashTicks > 0 && !p.grounded;
      if (p.dashTicks > 0) p.dashTicks -= 1;

      if (jumpPressed && p.grounded && p.dashTicks === 0) {
        p.vel[1] = 7.0;
        p.grounded = false;
      }

      if (!p.grounded && !dashingAir) {
        p.vel[1] -= 20.0 * DT;
      }

      let windDx = 0;
      let windDz = 0;
      if (state.wind.active) {
        const wRad = (state.wind.dir_deg * Math.PI) / 180;
        windDx = Math.cos(wRad) * 2.0 * DT;
        windDz = Math.sin(wRad) * 2.0 * DT;
      }

      const prevX = p.pos[0];
      const prevZ = p.pos[2];
      const targetX = prevX + p.vel[0] * DT + windDx;
      const targetZ = prevZ + p.vel[2] * DT + windDz;
      const resH = resolveEntityHorizontal(state.night, prevX, prevZ, targetX, targetZ, p.pos[1], false);
      p.pos[0] = resH.x;
      p.pos[2] = resH.z;

      const prevY = p.pos[1];
      const nextY = prevY + p.vel[1] * DT;
      const groundY = getGroundHeight(state.night, p.pos[0], p.pos[2], prevY);

      if (groundY !== null) {
        if (p.grounded && Math.abs(groundY - prevY) <= 0.45) {
          p.pos[1] = groundY;
          p.vel[1] = 0;
          p.grounded = true;
        } else if (p.vel[1] <= 0.01 && nextY <= groundY + 0.001 && prevY >= groundY - 0.45) {
          p.pos[1] = groundY;
          p.vel[1] = 0;
          p.grounded = true;
          p.launchLocked = false;
        } else {
          p.pos[1] = nextY;
          p.grounded = false;
        }
      } else {
        p.pos[1] = nextY;
        p.grounded = false;
      }

      // Launchpad trigger check
      const pads = state.mapConfig.launchpads;
      for (let i = 0; i < pads.length; i++) {
        const pad = pads[i];
        if (!p.launchLocked && Math.abs(p.pos[1] - pad.y) <= 0.35 &&
            Math.hypot(p.pos[0] - pad.x, p.pos[2] - pad.z) <= pad.radius) {
          let dirX, dirZ;
          if (pad.fixedDir) {
            dirX = pad.fixedDir[0];
            dirZ = pad.fixedDir[1];
          } else {
            const dx = pad.targetX - pad.x;
            const dz = pad.targetZ - pad.z;
            const dist = Math.hypot(dx, dz) || 1;
            dirX = dx / dist;
            dirZ = dz / dist;
          }
          p.vel[0] = dirX * pad.vh;
          p.vel[2] = dirZ * pad.vh;
          p.vel[1] = pad.vy;
          p.grounded = false;
          p.launchLocked = true;
          p.dashTicks = 0;
          p.facingAngle = Math.atan2(dirX, dirZ);
          break;
        }
      }

      // Fall off island (Y < -10)
      if (p.pos[1] < -10.0) {
        p.flames = Math.max(0, p.flames - 1);
        const lostCount = p.carried;
        p.carried = 0;
        p.dashTicks = 0;
        p.launchLocked = false;
        p.vel = [0, 0, 0];
        p.respawnTicks = p.flames > 0 ? 60 : 0;
        events.push({
          type: 'event',
          tick: state.tick,
          name: 'player_hit',
          data: {
            by: 'fall',
            flames: p.flames,
            dropped: 0,
            lost: lostCount
          }
        });
      }
    }

    // 4. Pickup motes & charms
    const currentCapacity = getPlayerCapacity(state);
    if (!state.benchMode && p.respawnTicks === 0 && p.flames > 0) {
      if (p.carried < currentCapacity && state.motes.length > 0) {
        let pickedAny = false;
        let writeIdx = 0;
        for (let i = 0; i < state.motes.length; i++) {
          const m = state.motes[i];
          if (m.pickupDelayTicks <= 0 &&
              p.carried < currentCapacity &&
              distXZ(p.pos, m.pos) <= t.pickup_radius &&
              Math.abs(p.pos[1] - m.pos[1]) <= 1.5) {
            p.carried += 1;
            pickedAny = true;
            events.push({
              type: 'event',
              tick: state.tick,
              name: 'mote_picked',
              data: { carried: p.carried }
            });
          } else {
            if (pickedAny) state.motes[writeIdx] = m;
            writeIdx++;
          }
        }
        if (pickedAny) state.motes.length = writeIdx;
      }

      for (let i = 0; i < state.charms.length; i++) {
        const c = state.charms[i];
        if (c.available &&
            distXZ(p.pos, c.pos) <= t.pickup_radius &&
            Math.abs(p.pos[1] - c.pos[1]) <= 1.5) {
          c.available = false;
          c.respawnTicks = 2700;
          p.charmTicks = 600;
          p.dashCooldownTicks = 0;
          events.push({
            type: 'event',
            tick: state.tick,
            name: 'charm_picked',
            data: { charm_id: c.id, charm_ticks: 600 }
          });
        }
      }
    }

    // 5. Interact with lanterns (unlit: light/relight; lit & fuel < 100: refuel; skip full lanterns)
    if (p.respawnTicks === 0 && p.flames > 0 && interactPressed && p.carried > 0) {
      let bestLantern = null;
      let bestDist = Infinity;
      for (let i = 0; i < state.lanterns.length; i++) {
        const l = state.lanterns[i];
        if (l.lit && l.fuelUnits >= FUEL_MAX_UNITS) continue;
        const d = distXZ(p.pos, l.pos);
        if (d <= t.interact_radius && Math.abs(p.pos[1] - l.pos[1]) <= 1.5) {
          if (d < bestDist - 1e-9 || (Math.abs(d - bestDist) <= 1e-9 && (!bestLantern || compareIds(l.id, bestLantern.id) < 0))) {
            bestDist = d;
            bestLantern = l;
          }
        }
      }
      if (bestLantern) {
        if (!bestLantern.lit) {
          const isRelight = bestLantern.everLit;
          const reqCost = isRelight ? t.relight_cost : t.lantern_cost;
          const needed = Math.max(0, reqCost - bestLantern.deposited);
          const amount = Math.min(p.carried, needed);
          if (amount > 0) {
            p.carried -= amount;
            bestLantern.deposited += amount;
            state.score += amount * t.score.per_mote;
            events.push({
              type: 'event',
              tick: state.tick,
              name: 'deposit',
              data: {
                lantern_id: bestLantern.id,
                amount: amount,
                deposited: bestLantern.deposited
              }
            });
            if (bestLantern.deposited >= reqCost) {
              bestLantern.lit = true;
              bestLantern.fuelUnits = FUEL_MAX_UNITS;
              bestLantern.everLit = true;
              if (isRelight) bestLantern.relitCount += 1;
              state.successfulLights += 1;
              state.score += isRelight ? 40 : t.score.per_lantern;
              events.push({
                type: 'event',
                tick: state.tick,
                name: 'lantern_lit',
                data: { lantern_id: bestLantern.id, relight: isRelight }
              });
              // Mark any Shade inside newly lit lantern's safe_radius for <=30-tick pushout
              for (let sIdx = 0; sIdx < state.shades.length; sIdx++) {
                const sh = state.shades[sIdx];
                if (distXZ(sh.pos, bestLantern.pos) < t.safe_radius) {
                  sh.pushoutTicks = 30;
                }
              }
            }
          }
        } else {
          const prevFuelUnits = bestLantern.fuelUnits;
          const missingUnits = Math.max(0, FUEL_MAX_UNITS - prevFuelUnits);
          const motesNeeded = Math.floor((missingUnits + FUEL_PER_MOTE_UNITS - 1) / FUEL_PER_MOTE_UNITS);
          const used = Math.min(p.carried, motesNeeded);
          if (used > 0) {
            p.carried -= used;
            bestLantern.fuelUnits = Math.min(FUEL_MAX_UNITS, prevFuelUnits + used * FUEL_PER_MOTE_UNITS);
            state.score += used * t.score.per_mote;
            events.push({
              type: 'event',
              tick: state.tick,
              name: 'refuel',
              data: {
                lantern_id: bestLantern.id,
                amount: used,
                fuel: round1(bestLantern.fuelUnits / FUEL_UNITS_PER_FUEL)
              }
            });
            if (prevFuelUnits < FUEL_LOW_UNITS && bestLantern.fuelUnits >= FUEL_LOW_UNITS) {
              for (let sIdx = 0; sIdx < state.shades.length; sIdx++) {
                const sh = state.shades[sIdx];
                if (sh.state === 'drain' && sh.targetLanternId === bestLantern.id) {
                  sh.state = 'wander';
                  sh.targetLanternId = null;
                  sh.drainTicks = 0;
                }
                if (distXZ(sh.pos, bestLantern.pos) < t.safe_radius) {
                  sh.pushoutTicks = 30;
                }
              }
            }
          }
        }
      }
    }

    // 6. Update safe radius (smooth pushout <= 30 ticks for shades caught inside; clamp others outside)
    for (let i = 0; i < state.shades.length; i++) {
      const sh = state.shades[i];
      if (sh.pushoutTicks > 0) {
        let pushedOut = true;
        for (let lIdx = 0; lIdx < state.lanterns.length; lIdx++) {
          const l = state.lanterns[lIdx];
          if (!isLanternSafeActive(l)) continue;
          const dx = sh.pos[0] - l.pos[0];
          const dz = sh.pos[2] - l.pos[2];
          const d = Math.hypot(dx, dz);
          if (d < t.safe_radius + 0.02) {
            pushedOut = false;
            const nx = d > 1e-6 ? dx / d : 1;
            const nz = d > 1e-6 ? dz / d : 0;
            const remain = t.safe_radius + 0.05 - d;
            const stepOut = Math.min(remain, Math.max(0.22, remain / sh.pushoutTicks));
            sh.pos[0] += nx * stepOut;
            sh.pos[2] += nz * stepOut;
          }
        }
        sh.pushoutTicks -= 1;
        if (pushedOut || sh.pushoutTicks === 0) {
          clampShadeSafeBoundary(sh, state.lanterns, t.safe_radius);
          sh.pushoutTicks = 0;
        }
      } else {
        clampShadeSafeBoundary(sh, state.lanterns, t.safe_radius);
      }
    }

    // 7. Light Pulse (3D distance <= 5 m from foot + 0.8 m; stun 120 ticks; 15-tick 4 m horizontal push; +5 score per hit)
    if (p.respawnTicks === 0 && p.flames > 0 && pulsePressed && p.pulseCooldownTicks === 0 && p.carried >= t.pulse_cost) {
      p.carried -= t.pulse_cost;
      p.pulseCooldownTicks = Math.round(t.pulse_cooldown_s * TICK_RATE);
      state.pulseVisualTimer = 0.6;
      state.lastPulsePos = [p.pos[0], p.pos[1], p.pos[2]];

      const pulseCenter = [p.pos[0], p.pos[1] + 0.8, p.pos[2]];
      const hitShades = [];
      for (let i = 0; i < state.shades.length; i++) {
        const s = state.shades[i];
        if (dist3D(pulseCenter, s.pos) <= t.pulse_radius) {
          hitShades.push(s);
        }
      }
      hitShades.sort(function (a, b) { return compareIds(a.id, b.id); });

      const stunnedIds = [];
      for (let i = 0; i < hitShades.length; i++) {
        const s = hitShades[i];
        const wasDraining = s.state === 'drain';
        state.score += t.score.per_stun + (wasDraining ? 10 : 0); // +15 total if draining, else +5
        s.state = 'stunned';
        s.stateTicksLeft = 120;
        s.targetLanternId = null;
        s.drainTicks = 0;
        s.knockbackTicks = 15;
        let dx = s.pos[0] - p.pos[0];
        let dz = s.pos[2] - p.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < 1e-6) {
          s.knockbackDir = [1, 0]; // +X fallback
        } else {
          s.knockbackDir = [dx / d, dz / d];
        }
        stunnedIds.push(s.id);
      }

      // Pulse also affects Gió Lạc (Drifters) within 3D radius 5 m
      const driftersSorted = state.drifters.slice().sort(function (a, b) { return compareIds(a.id, b.id); });
      for (let i = 0; i < driftersSorted.length; i++) {
        const dr = driftersSorted[i];
        if (dr.state === 'removed') continue;
        if (dist3D(pulseCenter, dr.pos) <= t.pulse_radius) {
          if (dr.state === 'chase') {
            dr.state = 'flee';
            dr.fleeTicksLeft = 240;
            dr.stolen = 0;
          } else if (dr.state === 'flee') {
            if (dr.stolen > 0) {
              const dropAmt = dr.stolen;
              const dgY = getGroundHeight(state.night, dr.pos[0], dr.pos[2], dr.pos[1]);
              const dropY = dgY !== null ? dgY : 0;
              for (let m = 0; m < dropAmt; m++) {
                const ang = (m / dropAmt) * Math.PI * 2;
                const ox = Math.cos(ang) * 0.4;
                const oz = Math.sin(ang) * 0.4;
                state.motes.push({
                  id: 'M' + state.nextMoteNum++,
                  pos: [round3(dr.pos[0] + ox), dropY, round3(dr.pos[2] + oz)],
                  kind: 'dropped',
                  ttlTicks: 480,
                  pickupDelayTicks: 1
                });
              }
              dr.stolen = 0;
              events.push({
                type: 'event',
                tick: state.tick,
                name: 'drifter_drop',
                data: { drifter_id: dr.id, amount: dropAmt }
              });
            }
            dr.fleeTicksLeft = 120;
          }
        }
      }

      events.push({
        type: 'event',
        tick: state.tick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds }
      });
    }

    // 8. Move Shades and Drifters
    const shadeSpeed = state.mapConfig.shadeSpeed;
    for (let i = 0; i < state.shades.length; i++) {
      const s = state.shades[i];
      if (s.knockbackTicks > 0) {
        const kbStep = t.pulse_push_m / 15.0;
        const prevX = s.pos[0];
        const prevZ = s.pos[2];
        const nx = prevX + s.knockbackDir[0] * kbStep;
        const nz = prevZ + s.knockbackDir[1] * kbStep;
        const baseGround = s.pos[1] - s.heightOffset;
        const res = resolveEntityHorizontal(state.night, prevX, prevZ, nx, nz, baseGround, true);
        if (!res.blocked && getGroundHeight(state.night, res.x, res.z, baseGround) !== null) {
          s.pos[0] = res.x;
          s.pos[2] = res.z;
          const gY = getGroundHeight(state.night, res.x, res.z, baseGround);
          s.pos[1] = gY + s.heightOffset;
          if (s.pushoutTicks <= 0) clampShadeSafeBoundary(s, state.lanterns, t.safe_radius);
        } else {
          s.knockbackTicks = 1; // Stop pushback on obstacle
        }
        s.knockbackTicks -= 1;
      } else if (s.state === 'recoil') {
        const recStep = 2.0 / 60.0;
        const prevX = s.pos[0];
        const prevZ = s.pos[2];
        const nx = prevX + s.recoilDir[0] * recStep;
        const nz = prevZ + s.recoilDir[1] * recStep;
        const baseGround = s.pos[1] - s.heightOffset;
        const res = resolveEntityHorizontal(state.night, prevX, prevZ, nx, nz, baseGround, true);
        if (!res.blocked && getGroundHeight(state.night, res.x, res.z, baseGround) !== null) {
          s.pos[0] = res.x;
          s.pos[2] = res.z;
          const gY = getGroundHeight(state.night, res.x, res.z, baseGround);
          s.pos[1] = gY + s.heightOffset;
          if (s.pushoutTicks <= 0) clampShadeSafeBoundary(s, state.lanterns, t.safe_radius);
        }
      } else if (s.state === 'drain') {
        let targetL = null;
        if (s.targetLanternId) {
          for (let li = 0; li < state.lanterns.length; li++) {
            if (state.lanterns[li].id === s.targetLanternId) {
              targetL = state.lanterns[li];
              break;
            }
          }
        }
        if (p.respawnTicks === 0 && distXZ(s.pos, p.pos) <= 6.0) {
          s.state = 'chase';
          s.targetLanternId = null;
          s.drainTicks = 0;
          moveShadeOnTerrain(state, s, p.pos[0], p.pos[2], shadeSpeed);
        } else if (!targetL || !targetL.lit || targetL.fuelUnits >= FUEL_LOW_UNITS || distXZ(s.pos, targetL.pos) > 2.0 + 1e-9) {
          s.state = 'wander';
          s.targetLanternId = null;
          s.drainTicks = 0;
        }
      } else if (s.state === 'wander' || s.state === 'chase') {
        if (state.benchMode) {
          s.state = 'wander';
          const wx = s.pos[0] + Math.cos(s.wanderAngle) * 2.0 * DT;
          const wz = s.pos[2] + Math.sin(s.wanderAngle) * 2.0 * DT;
          const baseGround = s.pos[1] - s.heightOffset;
          if (getGroundHeight(state.night, wx, wz, baseGround) === null ||
              isInsideLitLanternSafe([wx, s.pos[1], wz], state.lanterns, t.safe_radius)) {
            s.wanderAngle += 1.4;
          } else {
            moveShadeOnTerrain(state, s, wx, wz, 2.0);
          }
          continue;
        }
        const distP = distXZ(s.pos, p.pos);
        if (s.state === 'wander') {
          if (p.respawnTicks === 0 && distP <= 12.0) {
            s.state = 'chase';
          }
        } else if (s.state === 'chase') {
          if (p.respawnTicks > 0 || distP > 18.0) {
            s.state = 'wander';
          }
        }

        if (s.state === 'chase') {
          moveShadeOnTerrain(state, s, p.pos[0], p.pos[2], shadeSpeed);
        } else {
          // Wander targeting: prioritize nearest weak lit lantern (fuel < 30), else nearest unlit lantern, else patrol
          let weakTarget = null;
          let weakDist = Infinity;
          let unlitTarget = null;
          let unlitDist = Infinity;
          for (let li = 0; li < state.lanterns.length; li++) {
            const l = state.lanterns[li];
            const ld = distXZ(s.pos, l.pos);
            if (l.lit && l.fuelUnits < FUEL_LOW_UNITS) {
              if (ld < weakDist - 1e-9 || (Math.abs(ld - weakDist) <= 1e-9 && (!weakTarget || compareIds(l.id, weakTarget.id) < 0))) {
                weakDist = ld;
                weakTarget = l;
              }
            } else if (!l.lit) {
              if (ld < unlitDist - 1e-9 || (Math.abs(ld - unlitDist) <= 1e-9 && (!unlitTarget || compareIds(l.id, unlitTarget.id) < 0))) {
                unlitDist = ld;
                unlitTarget = l;
              }
            }
          }

          if (weakTarget) {
            if (weakDist <= 2.0 + 1e-9) {
              s.state = 'drain';
              s.targetLanternId = weakTarget.id;
              s.drainTicks = 0;
            } else {
              moveShadeOnTerrain(state, s, weakTarget.pos[0], weakTarget.pos[2], 2.0);
              if (distXZ(s.pos, weakTarget.pos) <= 2.0 + 1e-9) {
                s.state = 'drain';
                s.targetLanternId = weakTarget.id;
                s.drainTicks = 0;
              }
            }
          } else if (unlitTarget && unlitDist > 2.0) {
            moveShadeOnTerrain(state, s, unlitTarget.pos[0], unlitTarget.pos[2], 2.0);
          } else {
            const wx = s.pos[0] + Math.cos(s.wanderAngle) * 2.0 * DT;
            const wz = s.pos[2] + Math.sin(s.wanderAngle) * 2.0 * DT;
            const baseGround = s.pos[1] - s.heightOffset;
            if (getGroundHeight(state.night, wx, wz, baseGround) === null ||
                isInsideLitLanternSafe([wx, s.pos[1], wz], state.lanterns, t.safe_radius)) {
              s.wanderAngle += 1.4;
            } else {
              moveShadeOnTerrain(state, s, wx, wz, 2.0);
            }
          }
        }
      }
    }

    for (let i = 0; i < state.drifters.length; i++) {
      const dr = state.drifters[i];
      if (dr.state === 'removed') continue;

      if (dr.state === 'idle') {
        if (p.respawnTicks === 0 && p.carried >= 5 && distXZ(p.pos, dr.pos) <= 15.0) {
          dr.state = 'chase';
        }
      } else if (dr.state === 'chase') {
        if (p.respawnTicks > 0 || p.carried < 5 || distXZ(p.pos, dr.pos) > 15.0) {
          dr.state = 'idle';
        }
      }

      if (dr.state === 'idle') {
        dr.wanderAngle += 0.015;
        dr.pos[0] += Math.cos(dr.wanderAngle) * 2.0 * DT;
        dr.pos[2] += Math.sin(dr.wanderAngle) * 2.0 * DT;
        // Keep idle drifter loosely centered near island
        if (Math.hypot(dr.pos[0] - (state.night === 2 ? 35 : 0), dr.pos[2]) > 46.0) {
          dr.wanderAngle += Math.PI * 0.75;
        }
      } else if (dr.state === 'chase') {
        const dx = p.pos[0] - dr.pos[0];
        const dz = p.pos[2] - dr.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 1e-4) {
          const stepD = Math.min(d, 7.0 * DT);
          dr.pos[0] += (dx / d) * stepD;
          dr.pos[2] += (dz / d) * stepD;
        }
        dr.pos[1] = p.pos[1] + 1.2;
      } else if (dr.state === 'flee') {
        const dx = dr.pos[0] - p.pos[0];
        const dz = dr.pos[2] - p.pos[2];
        const d = Math.hypot(dx, dz);
        const fx = d > 1e-4 ? dx / d : 1;
        const fz = d > 1e-4 ? dz / d : 0;
        dr.pos[0] += fx * 7.0 * DT;
        dr.pos[2] += fz * 7.0 * DT;
      }
    }

    // 9. Touch: Drifters steal FIRST, then Shades cause hit (sorted by ascending ID)
    if (!state.benchMode && p.respawnTicks === 0 && p.flames > 0) {
      const driftersById = state.drifters.slice().sort(function (a, b) { return compareIds(a.id, b.id); });
      for (let i = 0; i < driftersById.length; i++) {
        const dr = driftersById[i];
        if (dr.state === 'chase' && !dr.hasStolen && distXZ(p.pos, dr.pos) <= 1.2) {
          const stealAmt = Math.min(3, p.carried);
          if (stealAmt > 0) {
            p.carried -= stealAmt;
            dr.stolen = stealAmt;
            dr.hasStolen = true;
            dr.state = 'flee';
            dr.fleeTicksLeft = 240;
            events.push({
              type: 'event',
              tick: state.tick,
              name: 'drifter_steal',
              data: { drifter_id: dr.id, amount: stealAmt, carried: p.carried }
            });
          }
        }
      }

      if (p.invulnTicks === 0) {
        const shadesById = state.shades.slice().sort(function (a, b) { return compareIds(a.id, b.id); });
        for (let i = 0; i < shadesById.length; i++) {
          const s = shadesById[i];
          if (s.state !== 'chase' && s.state !== 'wander') continue;
          if (s.pushoutTicks > 0) continue;
          if (isInsideLitLanternSafe(s.pos, state.lanterns, t.safe_radius - 0.05)) continue;
          if (distXZ(p.pos, s.pos) <= t.shade_hit_radius && Math.abs(p.pos[1] - s.pos[1]) <= 1.5) {
            p.flames = Math.max(0, p.flames - 1);
            const dropAmt = Math.floor(p.carried * t.hit_drop_ratio);
            p.carried -= dropAmt;
            p.invulnTicks = 90;

            // Spawn dropped motes onto 1.5-2.5 m ring around Mây (TTL 480, pickup from next tick)
            for (let m = 0; m < dropAmt; m++) {
              const ang = state.rng() * Math.PI * 2;
              const rad = 1.5 + state.rng() * 1.0;
              const mx = p.pos[0] + Math.cos(ang) * rad;
              const mz = p.pos[2] + Math.sin(ang) * rad;
              const mgY = getGroundHeight(state.night, mx, mz, p.pos[1]);
              const dropY = mgY !== null ? mgY : p.pos[1];
              state.motes.push({
                id: 'M' + state.nextMoteNum++,
                pos: [round3(mx), dropY, round3(mz)],
                kind: 'dropped',
                ttlTicks: 480,
                pickupDelayTicks: 1
              });
            }

            // Shade enters recoil (2 m over 60 ticks)
            const rdx = s.pos[0] - p.pos[0];
            const rdz = s.pos[2] - p.pos[2];
            const rd = Math.hypot(rdx, rdz);
            s.recoilDir = rd > 1e-6 ? [rdx / rd, rdz / rd] : [1, 0];
            s.state = 'recoil';
            s.stateTicksLeft = 60;
            s.targetLanternId = null;
            s.drainTicks = 0;

            events.push({
              type: 'event',
              tick: state.tick,
              name: 'player_hit',
              data: {
                by: 'shade',
                flames: p.flames,
                dropped: dropAmt
              }
            });
            break;
          }
        }
      }
    }

    // 10. Scheduled spawns (interactable from next tick)
    if (!state.benchMode && state.randomMotes && state.simTick % 240 === 0) {
      spawnOneScheduledMote(state);
    }

    if (!state.benchMode && state.randomShades && state.shades.length < state.mapConfig.maxShades) {
      if (state.simTick === 300) {
        for (let c = 0; c < 2 && state.shades.length < state.mapConfig.maxShades; c++) {
          const sh = spawnOneShade(state);
          if (sh) {
            events.push({ type: 'event', tick: state.tick, name: 'shade_spawned', data: { id: sh.id } });
          }
        }
      } else if (state.simTick > 300 && (state.simTick - 300) % state.mapConfig.shadeSpawnPeriodTicks === 0) {
        const sh = spawnOneShade(state);
        if (sh) {
          events.push({ type: 'event', tick: state.tick, name: 'shade_spawned', data: { id: sh.id } });
        }
      }
    }

    if (!state.benchMode && state.randomDrifters && (state.night === 2 || state.night === 3) && state.simTick % 1200 === 0) {
      let activeDrifters = 0;
      for (let i = 0; i < state.drifters.length; i++) {
        if (state.drifters[i].state !== 'removed') activeDrifters++;
      }
      if (activeDrifters < 2) {
        spawnOneDrifter(state);
      }
    }

    // 11. Win / loss resolution (keep-alive to dawn, no_flames always takes precedence even at dawn)
    if (!state.benchMode && p.flames <= 0) {
      state.gameState = 'lost';
      events.push({
        type: 'event',
        tick: state.tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'no_flames' }
      });
    } else if (!state.benchMode && state.timeLeftS <= 1e-9) {
      state.timeLeftS = 0;
      const requiredLit = Math.ceil(t.win_ratio * state.lanterns.length - 1e-9);
      let litCount = 0;
      let lanternFuelBonus = 0;
      for (let i = 0; i < state.lanterns.length; i++) {
        const l = state.lanterns[i];
        if (l.lit) {
          litCount += 1;
          lanternFuelBonus += 50 + Math.floor(l.fuelUnits / FUEL_UNITS_PER_FUEL);
        }
      }
      if (litCount >= requiredLit) {
        state.gameState = 'won';
        const flameBonus = p.flames * t.score.per_flame_left;
        state.score += lanternFuelBonus + flameBonus;
        events.push({
          type: 'event',
          tick: state.tick,
          name: 'game_over',
          data: { result: 'won', reason: 'dawn_survived' }
        });
      } else {
        state.gameState = 'lost';
        events.push({
          type: 'event',
          tick: state.tick,
          name: 'game_over',
          data: { result: 'lost', reason: 'dawn' }
        });
      }
    }

    return events;
  }

  function getSnapshot(state) {
    const p = state.player;
    return {
      type: 'snapshot',
      tick: state.tick,
      sim_tick: state.simTick,
      night: state.night,
      state: state.gameState,
      time_left_s: round3(state.timeLeftS),
      score: state.score,
      wind: {
        active: state.wind.active,
        dir_deg: state.wind.active ? state.wind.dir_deg : 0
      },
      player: {
        pos: p.pos.map(round3),
        vel: p.vel.map(round3),
        grounded: p.grounded,
        invuln: p.invulnTicks > 0,
        dash_cd_s: round3(p.dashCooldownTicks / TICK_RATE),
        pulse_cd_s: round3(p.pulseCooldownTicks / TICK_RATE),
        charm_s: round3(p.charmTicks / TICK_RATE),
        flames: p.flames,
        carried: p.carried,
        capacity: getPlayerCapacity(state)
      },
      lanterns: state.lanterns.map(function (l) {
        return {
          id: l.id,
          pos: l.pos.map(round3),
          lit: l.lit,
          deposited: l.deposited,
          fuel: l.lit ? round1(l.fuelUnits / FUEL_UNITS_PER_FUEL) : 0,
          ever_lit: l.everLit,
          relit_count: l.relitCount
        };
      }),
      shades: state.shades.map(function (s) {
        return {
          id: s.id,
          pos: s.pos.map(round3),
          state: s.state
        };
      }),
      motes_active: state.motes.length,
      motes: state.motes.map(function (m) {
        return {
          id: m.id,
          pos: m.pos.map(round3),
          kind: m.kind,
          ttl_s: m.kind === 'dropped' ? round3(m.ttlTicks / TICK_RATE) : null
        };
      }),
      drifters: state.drifters.map(function (d) {
        return {
          id: d.id,
          pos: d.pos.map(round3),
          state: d.state,
          stolen: d.stolen
        };
      }),
      charms: state.charms.map(function (c) {
        return {
          id: c.id,
          available: c.available,
          respawn_s: c.available ? 0 : round3(c.respawnTicks / TICK_RATE)
        };
      })
    };
  }

  // Creative browser-only skill [J] — never invoked in headless mode or Test Contract
  function triggerCreativeLightning(state) {
    if (!state || state.gameState !== 'playing') return [];
    const STRIKE_RANGE = 14.0;
    const STUN_TICKS = 120;
    const PUSH_M = 4.0;
    const MAX_TARGETS = 3;

    const candidates = [];
    for (let i = 0; i < state.shades.length; i++) {
      const s = state.shades[i];
      const d = distXZ(state.player.pos, s.pos);
      if (d <= STRIKE_RANGE) {
        candidates.push({ shade: s, dist: d });
      }
    }
    candidates.sort(function (a, b) {
      if (Math.abs(a.dist - b.dist) > 1e-6) return a.dist - b.dist;
      return compareIds(a.shade.id, b.shade.id);
    });

    const strikes = [];
    const count = Math.min(MAX_TARGETS, candidates.length);
    for (let i = 0; i < count; i++) {
      const s = candidates[i].shade;
      const baseGround = s.pos[1] - s.heightOffset;
      strikes.push([s.pos[0], baseGround, s.pos[2]]);
      s.state = 'stunned';
      s.stateTicksLeft = Math.max(s.stateTicksLeft, STUN_TICKS);

      let dx = s.pos[0] - state.player.pos[0];
      let dz = s.pos[2] - state.player.pos[2];
      let d = Math.hypot(dx, dz);
      if (d < 1e-6) {
        dx = Math.sin(state.player.facingAngle || 0);
        dz = Math.cos(state.player.facingAngle || 0);
        d = Math.hypot(dx, dz) || 1;
      }
      const nx = s.pos[0] + (dx / d) * PUSH_M;
      const nz = s.pos[2] + (dz / d) * PUSH_M;
      const res = resolveEntityHorizontal(state.night, s.pos[0], s.pos[2], nx, nz, baseGround, true);
      if (!res.blocked && getGroundHeight(state.night, res.x, res.z, baseGround) !== null) {
        s.pos[0] = res.x;
        s.pos[2] = res.z;
      }
      clampShadeSafeBoundary(s, state.lanterns, state.tuning.safe_radius);
    }

    if (strikes.length === 0) {
      const ang = state.player.facingAngle || 0;
      const tx = state.player.pos[0] + Math.sin(ang) * 6.0;
      const tz = state.player.pos[2] + Math.cos(ang) * 6.0;
      const gY = getGroundHeight(state.night, tx, tz, state.player.pos[1]);
      strikes.push([tx, gY !== null ? gY : state.player.pos[1], tz]);
    }
    return strikes;
  }

  function getEndRecord(state) {
    return {
      type: 'end',
      ticks: state.tick,
      state: state.gameState,
      score: state.score
    };
  }

  return {
    TICK_RATE: TICK_RATE,
    DT: DT,
    DEFAULT_TUNING: DEFAULT_TUNING,
    NIGHT_CONFIGS: NIGHT_CONFIGS,
    round3: round3,
    distXZ: distXZ,
    dist3D: dist3D,
    getGroundHeight: getGroundHeight,
    validateScenario: validateScenario,
    validateInputs: validateInputs,
    createGame: createGame,
    createBenchGame: createBenchGame,
    step: step,
    triggerCreativeLightning: triggerCreativeLightning,
    getSnapshot: getSnapshot,
    getEndRecord: getEndRecord
  };
}));
