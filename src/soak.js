#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const sim = require('./sim');

function parseArgs(argv) {
  const opts = { seed: 7, nights: 10, out: 'soak.json' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed' && i + 1 < argv.length) {
      opts.seed = Number(argv[++i]);
    } else if (a === '--nights' && i + 1 < argv.length) {
      opts.nights = Number(argv[++i]);
    } else if (a === '--out' && i + 1 < argv.length) {
      opts.out = argv[++i];
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: node src/soak.js --seed 7 --nights 10 --out soak.json');
      process.exit(0);
    }
  }
  if (!Number.isInteger(opts.seed)) {
    console.error('Invalid --seed: must be an integer');
    process.exit(2);
  }
  if (!Number.isInteger(opts.nights) || opts.nights <= 0) {
    console.error('Invalid --nights: must be a positive integer');
    process.exit(2);
  }
  return opts;
}

function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rssMb() {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const tStart = Date.now();

  let tuning = sim.DEFAULT_TUNING;
  const contractPath = path.resolve(__dirname, '..', 'game.contract.json');
  if (fs.existsSync(contractPath)) {
    try {
      const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      if (contract && contract.tuning) tuning = contract.tuning;
    } catch (_) {
      // Ignore contract read issues
    }
  }

  const results = [];
  let crashes = 0;
  let memStartMb = null;
  let state = null;

  for (let i = 0; i < opts.nights; i++) {
    const nightNum = (i % 3) + 1;
    const nightSeed = opts.seed + (i + 1);
    const inputRng = makeRng(nightSeed ^ 0x9E3779B9);

    try {
      state = sim.createGame({ seed: nightSeed, night: nightNum, tuning: tuning });
      if (i === 0) {
        memStartMb = rssMb();
      }

      const durKey = nightNum === 1 ? 'night1_duration_s' : (nightNum === 2 ? 'night2_duration_s' : 'night3_duration_s');
      const maxTicks = Math.round((tuning[durKey] || 300) * sim.TICK_RATE) + 60;
      let moveVec = [0, 0];
      const inputFrame = {
        move: moveVec,
        cam_yaw_deg: 0,
        jump: false,
        dash: false,
        pulse: false,
        interact: false
      };

      for (let tick = 0; tick < maxTicks && state.gameState === 'playing'; tick++) {
        if (tick % 30 === 0) {
          const ang = inputRng() * Math.PI * 2;
          moveVec[0] = Math.cos(ang);
          moveVec[1] = Math.sin(ang);
        }
        inputFrame.jump = inputRng() < 0.05;
        inputFrame.dash = inputRng() < 0.03;
        inputFrame.pulse = inputRng() < 0.02;
        inputFrame.interact = inputRng() < 0.10;
        sim.step(state, inputFrame);
      }

      if (state.gameState === 'won' || state.gameState === 'lost') {
        results.push(state.gameState);
      } else {
        results.push('lost');
      }
    } catch (err) {
      crashes += 1;
      results.push('crash');
      console.error('Soak crash on night ' + (i + 1) + ':', err);
    } finally {
      state = null;
      if (typeof global.gc === 'function') global.gc();
    }
  }

  const memEndMb = rssMb();
  const durationS = Math.round(((Date.now() - tStart) / 1000) * 10) / 10;

  const output = {
    nights: opts.nights,
    crashes: crashes,
    results: results,
    mem_start_mb: memStartMb !== null ? memStartMb : memEndMb,
    mem_end_mb: memEndMb,
    duration_s: durationS
  };

  const outPath = path.resolve(opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(output));
}

main();
