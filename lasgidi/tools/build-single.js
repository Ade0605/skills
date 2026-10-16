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
const js = ['src/data.js', 'src/engine.js', 'src/icons.js', 'src/playground.js', 'src/interior.js', 'src/home3d.js', 'src/avatar.js', 'src/avatar3d.js', 'src/images.js', 'src/danfo.js', 'src/danceoff.js', 'src/hawker.js', 'src/bole.js', 'src/quiz.js', 'src/gov.js', 'src/chat.js', 'src/cruise.js', 'src/cruise3d.js', 'src/airport.js', 'src/airport3d.js', 'src/city3d.js', 'src/ride3d.js', 'src/games3d.js', 'src/hall3d.js', 'src/beach3d.js', 'src/venue.js', 'src/ui.js'].map(read).join('\n');
// Minify when terser is installed (npm install); otherwise ship the readable source as before.
// Only local names are shortened: globals and every property name stay as written.
function minifyCss(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}').trim();
}
async function main() {
  const plain = process.argv.includes('--no-minify');
  let terser = null;
  if (!plain) { try { terser = require('terser'); } catch (e) { console.log('terser not installed: writing unminified JS (run npm install to shrink the build)'); } }
  let code = js, css = read('src/styles.css');
  if (terser) {
    const r = await terser.minify(js, { compress: { passes: 2 }, mangle: { toplevel: false }, format: { comments: false } });
    code = r.code; css = minifyCss(css);
  }
  const out = [
    '<meta charset="utf-8">',
    '<title>Lasgidi</title>',
    fonts,
    '<style>\n' + css + '\n</style>',
    body.trim(),
    // three.js rides along as inert text and is only run when the 3D airport first opens (see loadThree in src/ui.js).
    '<script type="text/plain" id="lsg-three">' + read('vendor/three.min.js').replace(/<\/script/gi, '<\\/script') + '</script>',
    '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>'
  ].join('\n');
  const dest = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(root, 'dist', 'lasgidi.html');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
  const gz = require('zlib').gzipSync(out, { level: 9 }).length;
  console.log('Wrote ' + dest + ' (' + Math.round(out.length / 1024) + ' KB, ' + Math.round(gz / 1024) + ' KB gzipped' + (terser ? ', minified' : '') + ')');
}
main().catch(e => { console.error(e); process.exit(1); });
