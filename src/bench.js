#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function parseArgs(argv) {
  const opts = { seed: 42, duration: 30, out: 'bench.json' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed' && i + 1 < argv.length) {
      opts.seed = Number(argv[++i]);
    } else if (a === '--duration' && i + 1 < argv.length) {
      opts.duration = Number(argv[++i]);
    } else if (a === '--out' && i + 1 < argv.length) {
      opts.out = argv[++i];
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: node src/bench.js --seed 42 --duration 30 --out bench.json');
      process.exit(0);
    }
  }
  if (!Number.isInteger(opts.seed)) {
    console.error('Invalid --seed: must be an integer');
    process.exit(2);
  }
  if (!Number.isFinite(opts.duration) || opts.duration <= 0) {
    console.error('Invalid --duration: must be > 0');
    process.exit(2);
  }
  return opts;
}

function findBrowserBin() {
  const envBin = process.env.BENCH_BROWSER || process.env.CHROME_BIN || process.env.BROWSER_BIN;
  if (envBin && fs.existsSync(envBin)) return envBin;

  const candidates = [];
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA || '';
    candidates.push(
      path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    );
  } else {
    ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'].forEach((cmd) => {
      const r = spawnSync('which', [cmd], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) candidates.push(r.stdout.trim());
    });
  }

  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i] && fs.existsSync(candidates[i])) return candidates[i];
  }
  return null;
}

function sampleBrowserRssMb(profileTag, callback) {
  try {
    if (process.platform === 'linux') {
      const pids = fs.readdirSync('/proc').filter((p) => /^\d+$/.test(p));
      let totalKb = 0;
      for (let i = 0; i < pids.length; i++) {
        try {
          const cmd = fs.readFileSync('/proc/' + pids[i] + '/cmdline', 'utf8');
          if (!cmd.includes(profileTag)) continue;
          const st = fs.readFileSync('/proc/' + pids[i] + '/status', 'utf8');
          const m = /VmRSS:\s+(\d+)\s+kB/.exec(st);
          if (m) totalKb += Number(m[1]);
        } catch (_) {
          // Process exited mid-scan
        }
      }
      callback(totalKb > 0 ? Math.round((totalKb / 1024) * 10) / 10 : null);
      return;
    }

    if (process.platform === 'darwin') {
      execFile('ps', ['-Ao', 'rss=,command='], { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
        if (err || !stdout) return callback(null);
        let totalKb = 0;
        const lines = stdout.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].includes(profileTag)) continue;
          const m = /^\s*(\d+)\s+/.exec(lines[i]);
          if (m) totalKb += Number(m[1]);
        }
        callback(totalKb > 0 ? Math.round((totalKb / 1024) * 10) / 10 : null);
      });
      return;
    }

    if (process.platform === 'win32') {
      const psCmd =
        "Get-CimInstance Win32_Process -Filter \"CommandLine LIKE '%" + profileTag + "%'\" | " +
        'Measure-Object -Property WorkingSetSize -Sum | Select-Object -ExpandProperty Sum';
      execFile('powershell', ['-NoProfile', '-Command', psCmd], { timeout: 2500 }, (err, stdout) => {
        if (err || !stdout) return callback(null);
        const bytes = Number(stdout.trim());
        if (!Number.isFinite(bytes) || bytes <= 0) return callback(null);
        callback(Math.round((bytes / (1024 * 1024)) * 10) / 10);
      });
      return;
    }
  } catch (_) {
    // Fallback below
  }
  callback(null);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function main() {
  const procStartMs = Date.now();
  const opts = parseArgs(process.argv.slice(2));
  const browserBin = findBrowserBin();
  if (!browserBin) {
    console.error('Could not find Chrome, Chromium, or Edge binary. Set BENCH_BROWSER env var.');
    process.exit(1);
  }

  const profileTag = 'ddl-bench-' + process.pid + '-' + Date.now();
  const tmpProfileDir = path.join(os.tmpdir(), profileTag);
  fs.mkdirSync(tmpProfileDir, { recursive: true });

  let loadMs = null;
  let peakMemMb = null;
  let browserProc = null;
  let memTimer = null;
  let timeoutTimer = null;
  let finished = false;

  function cleanup() {
    if (memTimer) clearInterval(memTimer);
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (browserProc && !browserProc.killed) {
      try {
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/PID', String(browserProc.pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
          browserProc.kill('SIGKILL');
        }
      } catch (_) {
        // Ignore cleanup failure
      }
    }
    try {
      fs.rmSync(tmpProfileDir, { recursive: true, force: true });
    } catch (_) {
      // Ignore profile cleanup lock
    }
  }

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

    if (urlPath === '/api/bench-ready' && req.method === 'POST') {
      if (loadMs === null) {
        loadMs = Date.now() - procStartMs;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, load_ms: loadMs }));
      return;
    }

    if (urlPath === '/api/bench-done' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        if (finished) {
          res.writeHead(200);
          res.end('ok');
          return;
        }
        finished = true;
        try {
          const stats = JSON.parse(body || '{}');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));

          sampleBrowserRssMb(profileTag, (endMb) => {
            if (endMb !== null && (peakMemMb === null || endMb > peakMemMb)) {
              peakMemMb = endMb;
            }
            const result = {
              contract_version: '1.3',
              avg_fps: round1(stats.avg_fps || 0),
              p1_low_fps: round1(stats.p1_low_fps || 0),
              frame_ms_p95: round1(stats.frame_ms_p95 || 0),
              frames: Math.round(stats.frames || 0),
              load_ms: loadMs !== null ? loadMs : (Date.now() - procStartMs),
              peak_mem_mb: peakMemMb,
              vsync_off: true,
              renderer: String(stats.renderer || 'Three.js r147 WebGL'),
              os: os.platform() + ' ' + os.release() + ' (' + os.arch() + ')'
            };

            const outPath = path.resolve(opts.out);
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
            console.log(JSON.stringify(result));
            cleanup();
            server.close(() => process.exit(0));
            setTimeout(() => process.exit(0), 200).unref();
          });
        } catch (err) {
          console.error('Failed to process bench payload:', err);
          cleanup();
          process.exit(1);
        }
      });
      return;
    }

    const relPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const fullPath = path.resolve(ROOT, relPath);
    if (!fullPath.startsWith(ROOT + path.sep) && fullPath !== ROOT) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(fullPath, (err, buf) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(buf);
    });
  });

  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const targetUrl =
      'http://127.0.0.1:' + port +
      '/?bench=1&seed=' + encodeURIComponent(String(opts.seed)) +
      '&duration=' + encodeURIComponent(String(opts.duration));

    const args = [
      '--app=' + targetUrl,
      '--window-size=1280,720',
      '--disable-frame-rate-limit',
      '--disable-gpu-vsync',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--autoplay-policy=no-user-gesture-required',
      '--no-first-run',
      '--no-default-browser-check',
      '--user-data-dir=' + tmpProfileDir
    ];

    browserProc = spawn(browserBin, args, { stdio: 'ignore', detached: false });

    const sampleNow = () => {
      if (finished) return;
      sampleBrowserRssMb(profileTag, (mb) => {
        if (mb !== null && (peakMemMb === null || mb > peakMemMb)) {
          peakMemMb = mb;
        }
      });
    };
    // Sample RSS during warmup (pre-measurement) and at measurement completion (inside /api/bench-done)
    // so OS process queries never inject CPU spikes into measured frame times.
    setTimeout(sampleNow, 1500);
    if (process.platform === 'linux') {
      memTimer = setInterval(sampleNow, 2500);
    }

    const maxWaitMs = (opts.duration + 35) * 1000;
    timeoutTimer = setTimeout(() => {
      if (!finished) {
        console.error('Benchmark timed out after ' + maxWaitMs + ' ms');
        cleanup();
        process.exit(1);
      }
    }, maxWaitMs);

    browserProc.on('exit', (code) => {
      if (!finished) {
        console.error('Benchmark browser exited unexpectedly before finishing (code ' + code + ')');
        cleanup();
        process.exit(1);
      }
    });
  });
}

main();
