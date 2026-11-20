#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4'
};

function getLeaderboardPath() {
  if (process.env.LEADERBOARD_FILE) {
    return path.resolve(process.env.LEADERBOARD_FILE);
  }
  return path.join(os.homedir(), '.dao-den-long', 'leaderboard.json');
}

function isValidLeaderboardName(name) {
  return typeof name === 'string' && /^[\p{L}0-9_]{3,12}$/u.test(name.trim());
}

function isIso8601WithTz(str) {
  return typeof str === 'string' && !Number.isNaN(Date.parse(str)) && /([Zz]|[+-]\d{2}:\d{2})$/.test(str);
}

function formatLocalIsoTz(date) {
  const d = date instanceof Date ? date : new Date();
  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? '+' : '-';
  const abs = Math.abs(tzMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
    sign + hh + ':' + mm
  );
}

function normalizeAndSortEntries(rawEntries) {
  const clean = [];
  if (Array.isArray(rawEntries)) {
    for (let i = 0; i < rawEntries.length; i++) {
      const e = rawEntries[i];
      if (!e || typeof e !== 'object') continue;
      const name = typeof e.name === 'string' ? e.name.trim() : '';
      if (!isValidLeaderboardName(name)) continue;
      const score = Number(e.score);
      const nightsWon = Number(e.nights_won);
      const seed = Number(e.seed);
      const achievedAt = isIso8601WithTz(e.achieved_at) ? e.achieved_at : formatLocalIsoTz(new Date());
      if (!Number.isFinite(score) || score < 0) continue;
      if (!Number.isInteger(nightsWon) || nightsWon < 0 || nightsWon > 3) continue;
      if (!Number.isFinite(seed)) continue;
      clean.push({
        name: name,
        score: Math.round(score),
        nights_won: nightsWon,
        achieved_at: achievedAt,
        seed: Math.trunc(seed)
      });
    }
  }
  clean.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Date.parse(a.achieved_at) - Date.parse(b.achieved_at);
  });
  return clean.slice(0, 10);
}

function readLeaderboard() {
  const lbPath = getLeaderboardPath();
  if (!fs.existsSync(lbPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(lbPath, 'utf8'));
    const list = Array.isArray(parsed) ? parsed : (parsed && parsed.entries ? parsed.entries : []);
    return normalizeAndSortEntries(list);
  } catch (_) {
    return [];
  }
}

function writeLeaderboard(entries) {
  const lbPath = getLeaderboardPath();
  const sorted = normalizeAndSortEntries(entries);
  fs.mkdirSync(path.dirname(lbPath), { recursive: true });
  const tmpPath = lbPath + '.tmp-' + process.pid;
  fs.writeFileSync(tmpPath, JSON.stringify({ entries: sorted }, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, lbPath);
  return sorted;
}

function addLeaderboardEntry(entry) {
  const name = entry && typeof entry.name === 'string' ? entry.name.trim() : '';
  if (!isValidLeaderboardName(name)) {
    throw new Error('Tên phải dài 3-12 ký tự (chữ, số hoặc dấu gạch dưới _)');
  }
  const score = Number(entry.score);
  const nightsWon = Number(entry.nights_won);
  const seed = Number(entry.seed);
  if (!Number.isFinite(score) || score < 0) {
    throw new Error('Invalid score');
  }
  if (!Number.isInteger(nightsWon) || nightsWon < 0 || nightsWon > 3) {
    throw new Error('Invalid nights_won');
  }
  if (!Number.isFinite(seed)) {
    throw new Error('Invalid seed');
  }
  const achievedAt = isIso8601WithTz(entry.achieved_at) ? entry.achieved_at : formatLocalIsoTz(new Date());
  const list = readLeaderboard();
  list.push({
    name: name,
    score: Math.round(score),
    nights_won: nightsWon,
    achieved_at: achievedAt,
    seed: Math.trunc(seed)
  });
  return writeLeaderboard(list);
}

function handleCliExport(argv) {
  const idx = argv.indexOf('--export-leaderboard');
  if (idx === -1) return false;
  const outArg = argv[idx + 1];
  if (!outArg || outArg.startsWith('--')) {
    console.error('Missing output path for --export-leaderboard <out.json>');
    process.exit(2);
  }
  const outPath = path.resolve(outArg);
  const entries = readLeaderboard();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ entries: entries }, null, 2) + '\n', 'utf8');
  console.log('Exported ' + entries.length + ' leaderboard entries to ' + outPath);
  return true;
}

function openBrowser(url) {
  if (process.env.NO_OPEN === '1' || process.argv.includes('--no-open')) return;
  try {
    if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (_) {
    // Ignore browser launch failures on headless servers
  }
}

function createServer() {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

    if (urlPath === '/api/leaderboard') {
      if (req.method === 'GET') {
        const entries = readLeaderboard();
        const body = JSON.stringify({ entries: entries });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(body);
        return;
      }
      if (req.method === 'POST') {
        let raw = '';
        req.on('data', (chunk) => {
          raw += chunk;
          if (raw.length > 65536) req.destroy();
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(raw || '{}');
            const updated = addLeaderboardEntry(payload);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, entries: updated }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'Invalid payload' }));
          }
        });
        return;
      }
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    const relPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const fullPath = path.resolve(ROOT, relPath);

    if (!fullPath.startsWith(ROOT + path.sep) && fullPath !== ROOT) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(fullPath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const total = stat.size;
      const range = req.headers.range;

      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2])) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + total });
          res.end();
          return;
        }
        const start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2]));
        const end = match[1] && match[2] ? Math.min(total - 1, Number(match[2])) : total - 1;
        if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + total });
          res.end();
          return;
        }
        res.writeHead(206, {
          'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Type': contentType
        });
        fs.createReadStream(fullPath, { start, end }).pipe(res);
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': total,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(fullPath).pipe(res);
    });
  });
}

if (require.main === module) {
  if (handleCliExport(process.argv.slice(2))) {
    process.exit(0);
  }
  const server = createServer();
  function listenOn(port) {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const url = 'http://127.0.0.1:' + addr.port + '/';
      console.log('Dao Den Long server running at ' + url);
      openBrowser(url);
    });
  }
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      listenOn(0);
    } else {
      console.error(err);
      process.exit(1);
    }
  });
  listenOn(PORT);
}

module.exports = {
  getLeaderboardPath,
  isValidLeaderboardName,
  readLeaderboard,
  writeLeaderboard,
  addLeaderboardEntry,
  normalizeAndSortEntries,
  formatLocalIsoTz
};
