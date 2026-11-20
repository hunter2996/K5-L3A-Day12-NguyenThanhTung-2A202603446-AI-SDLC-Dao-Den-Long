#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist', 'dao-den-long-v1.0.0');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

[
  'index.html',
  'package.json',
  'game.contract.json',
  'README.md',
  'CHANGELOG.md',
  'CREDITS.md',
  'LICENSE',
  'Dockerfile',
  'src',
  'vendor'
].forEach((entry) => {
  copyRecursive(path.join(ROOT, entry), path.join(OUT_DIR, entry));
});

console.log('Packaged static + Node release bundle at: ' + OUT_DIR);
