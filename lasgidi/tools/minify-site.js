#!/usr/bin/env node
// Shrinks the game's scripts and stylesheet in an assembled site folder (the GitHub Pages build), in place.
// Same settings as the single-file build: only local names are shortened, every global and property name stays.
// Usage: node tools/minify-site.js <site-folder>
'use strict';
const fs = require('fs');
const path = require('path');
const terser = require('terser');
async function main() {
  const site = process.argv[2];
  if (!site) { console.error('usage: node tools/minify-site.js <site-folder>'); process.exit(1); }
  const dir = path.join(site, 'src');
  let before = 0, after = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const p = path.join(dir, f), src = fs.readFileSync(p, 'utf8');
    const r = await terser.minify(src, { compress: { passes: 2 }, mangle: { toplevel: false }, format: { comments: false } });
    if (!r.code) throw new Error('minify failed: ' + f);
    fs.writeFileSync(p, r.code); before += src.length; after += r.code.length;
  }
  const css = path.join(dir, 'styles.css');
  if (fs.existsSync(css)) { const c = fs.readFileSync(css, 'utf8'), m = c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}').trim(); fs.writeFileSync(css, m); before += c.length; after += m.length; }
  console.log('minified ' + Math.round(before / 1024) + ' KB -> ' + Math.round(after / 1024) + ' KB');
}
main().catch(e => { console.error(e); process.exit(1); });
