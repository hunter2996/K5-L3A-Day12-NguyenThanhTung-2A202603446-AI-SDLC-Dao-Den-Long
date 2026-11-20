#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const sim = require('./sim');

function fail(code, msg) {
  process.stderr.write(msg + '\n');
  process.exit(code);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      fail(1, 'Unexpected argument: ' + token);
    }
    const key = token.slice(2);
    if (i + 1 >= argv.length) {
      fail(1, 'Missing value for --' + key);
    }
    args[key] = argv[++i];
  }
  return args;
}

function parseIntStrict(raw, name) {
  if (raw === undefined) fail(1, 'Missing required flag --' + name);
  if (!/^-?\d+$/.test(String(raw))) {
    fail(1, 'Flag --' + name + ' must be an integer, got: ' + raw);
  }
  return Number.parseInt(raw, 10);
}

function readJsonFile(filePath, label) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    fail(1, 'Cannot read ' + label + ' file "' + filePath + '": ' + err.message);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    fail(2, 'Malformed JSON in ' + label + ' file "' + filePath + '": ' + err.message);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const seed = parseIntStrict(args.seed, 'seed');
  const night = args.night !== undefined ? parseIntStrict(args.night, 'night') : 1;
  if (night !== 1 && night !== 2 && night !== 3) {
    fail(1, 'Unsupported --night value: ' + night + ' (expected 1, 2, or 3)');
  }
  const ticks = parseIntStrict(args.ticks, 'ticks');
  if (ticks < 0) {
    fail(1, 'Flag --ticks must be >= 0, got: ' + ticks);
  }
  if (!args.out) {
    fail(1, 'Missing required flag --out');
  }
  const snapshotEvery = args['snapshot-every'] !== undefined
    ? parseIntStrict(args['snapshot-every'], 'snapshot-every')
    : 10;
  if (snapshotEvery <= 0) {
    fail(1, 'Flag --snapshot-every must be > 0, got: ' + snapshotEvery);
  }

  let tuning = sim.DEFAULT_TUNING;
  const contractPath = path.resolve(__dirname, '..', 'game.contract.json');
  if (fs.existsSync(contractPath)) {
    try {
      const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      if (contract && contract.tuning) tuning = contract.tuning;
    } catch (_) {
      // Fall back to embedded DEFAULT_TUNING if contract is unreadable
    }
  }

  let scenario = null;
  if (args.scenario !== undefined) {
    scenario = readJsonFile(args.scenario, 'scenario');
    const err = sim.validateScenario(scenario, night);
    if (err) {
      fail(2, 'Invalid scenario format: ' + err);
    }
  }

  const frameByTick = new Map();
  if (args.inputs !== undefined) {
    const inputs = readJsonFile(args.inputs, 'inputs');
    const err = sim.validateInputs(inputs);
    if (err) {
      fail(2, 'Invalid inputs format: ' + err);
    }
    for (let i = 0; i < inputs.frames.length; i++) {
      const f = inputs.frames[i];
      frameByTick.set(f.tick, f);
    }
  }

  let state;
  try {
    state = sim.createGame({
      seed: seed,
      night: night,
      tuning: tuning,
      scenario: scenario
    });
  } catch (err) {
    if (err && err.code === 'INVALID_SCENARIO') {
      fail(2, 'Invalid scenario format: ' + err.message);
    }
    fail(1, 'Failed to initialize game: ' + (err ? err.message : String(err)));
  }

  const outPath = path.resolve(args.out);
  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
  } catch (err) {
    fail(1, 'Failed to create output directory: ' + err.message);
  }

  let fd;
  try {
    fd = fs.openSync(outPath, 'w');
  } catch (err) {
    fail(1, 'Cannot open output file "' + outPath + '": ' + err.message);
  }

  const buffer = [];
  function pushLine(obj) {
    buffer.push(JSON.stringify(obj));
    if (buffer.length >= 256) {
      fs.writeSync(fd, buffer.join('\n') + '\n', null, 'utf8');
      buffer.length = 0;
    }
  }

  try {
    // Tick 0 snapshot (post-scenario, pre-input)
    pushLine(sim.getSnapshot(state));

    for (let k = 0; k < ticks; k++) {
      const frame = frameByTick.get(k);
      const events = sim.step(state, frame);
      for (let e = 0; e < events.length; e++) {
        pushLine(events[e]);
      }
      if (state.tick % snapshotEvery === 0) {
        pushLine(sim.getSnapshot(state));
      }
      if (state.gameState === 'won' || state.gameState === 'lost') {
        break;
      }
    }

    pushLine(sim.getEndRecord(state));
    if (buffer.length > 0) {
      fs.writeSync(fd, buffer.join('\n') + '\n', null, 'utf8');
      buffer.length = 0;
    }
  } finally {
    fs.closeSync(fd);
  }

  process.exit(0);
}

main();
