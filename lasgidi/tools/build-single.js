#!/usr/bin/env node
// Bundles Lasgidi into one self-contained HTML fragment (no doctype/head/body),
// suitable for hosts that wrap the page themselves, or for sharing as one file.
// Usage: node tools/build-single.js [out.html]
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script'));
const js = ['src/data.js', 'src/engine.js', 'src/playground.js', 'src/ui.js'].map(read).join('\n');
const out = [
  '<title>Lasgidi</title>',
  fonts,
  '<style>\n' + read('src/styles.css') + '\n</style>',
  body.trim(),
  '<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>'
].join('\n');
const dest = process.argv[2] || path.join(root, 'dist', 'lasgidi.html');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log('Wrote ' + dest + ' (' + Math.round(out.length / 1024) + ' KB)');
