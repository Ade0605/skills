/* Lasgidi — the playground: an isometric Lagos drawn on a 2D canvas.
 * No images, no 3D library. The ground, water and buildings are rendered
 * once into an offscreen layer and only redrawn when light, power, theme
 * or zoom change; each frame then draws vehicles, pins and people on top.
 * The city reacts to the game: night falls with the clock, windows light
 * up only where there is power (your home follows your real NEPA state),
 * floods tint the Island, danfos crawl at rush hour. */
(function (root) {
  'use strict';

  var D = root.LASGIDI_DATA;
  var TW = 26, TH = 13;          // iso tile size in world pixels (2:1)
  var X0 = -2, X1 = 43, Y0 = -1, Y1 = 30;

  // Land, in km: the mainland, and the Island strip from Lagos Island to Ajah.
  // Everything else is water: the Lagoon between them, the harbour channel,
  // and the Atlantic to the south.
  var MAINLAND = [[-2, -1], [31, -1], [34, 2.5], [32, 5.6], [24, 6.4], [17.4, 6.6], [16.6, 10], [17.2, 14], [17, 17.8], [14.2, 19.4], [11.4, 20.6], [7, 21.2], [2, 20.8], [-2, 20]];
  var ISLAND = [[14.4, 21], [17.8, 19.9], [21.6, 19.8], [25.6, 21.4], [33, 22.4], [43, 22.6], [43, 26.6], [33, 26.9], [24, 26.9], [20.6, 27.1], [17.6, 26.4], [16, 24.2], [14.2, 22.6]];
  var CREEK = [[17.2, 23.1], [21.4, 22.6], [21.6, 23.3], [17.4, 23.8]]; // Five Cowries creek between the Island and VI

  // How each district builds: height range (px), density, footprint, palette.
  var STYLE = {
    vi:       { h: [40, 92], dens: 0.8, r: 3.0, foot: [0.55, 0.75], roof: '#9fb3c4', wall: '#7f93a6', glass: true },
    ikoyi:    { h: [16, 44], dens: 0.45, r: 3.0, foot: [0.5, 0.7], roof: '#c9c2b2', wall: '#a79f8d', trees: 0.35 },
    island:   { h: [12, 44], dens: 0.9, r: 2.8, foot: [0.6, 0.85], roof: '#c7a27a', wall: '#a8835c' },
    lekki:    { h: [6, 10], dens: 0.6, r: 3.6, foot: [0.45, 0.6], roof: '#b9643f', wall: '#e3d6c3', rows: true, towers: 0.06 },
    ajah:     { h: [5, 8], dens: 0.5, r: 3.2, foot: [0.45, 0.6], roof: '#a65a3a', wall: '#ddd0bb', trees: 0.2 },
    ikeja:    { h: [9, 34], dens: 0.7, r: 3.4, foot: [0.55, 0.75], roof: '#b8b0a2', wall: '#958d7e' },
    mushin:   { h: [4, 9], dens: 0.92, r: 2.8, foot: [0.65, 0.9], roof: '#8f5a3c', wall: '#bfa58a' },
    oshodi:   { h: [3, 6], dens: 0.88, r: 2.6, foot: [0.7, 0.95], roof: '#3f7f9a', wall: '#c8b79a', market: true },
    yaba:     { h: [7, 26], dens: 0.72, r: 3.0, foot: [0.55, 0.75], roof: '#a8826a', wall: '#c9b29b' },
    surulere: { h: [5, 13], dens: 0.7, r: 3.0, foot: [0.55, 0.8], roof: '#9c6a4a', wall: '#cdb69c' },
    festac:   { h: [5, 7], dens: 0.6, r: 3.4, foot: [0.5, 0.62], roof: '#7c8f4a', wall: '#ddd3bf', rows: true },
    ikorodu:  { h: [3, 6], dens: 0.42, r: 3.2, foot: [0.45, 0.65], roof: '#9a5b3b', wall: '#d2c2a8', trees: 0.3 }
  };
  // Typical share of time each district has light.
  var GRID = { vi: 0.9, ikoyi: 0.95, lekki: 0.75, island: 0.6, ikeja: 0.6, yaba: 0.5, surulere: 0.55, festac: 0.55, ajah: 0.6, mushin: 0.35, oshodi: 0.4, ikorodu: 0.4 };
  var FERRIES = [['ikorodu', 'island'], ['ikorodu', 'ikoyi'], ['island', 'lekki'], ['ikoyi', 'lekki']];

  function inPoly(x, y, pts) {
    var c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }
  function isWater(x, y) {
    if (inPoly(x, y, CREEK)) return true;
    return !(inPoly(x, y, MAINLAND) || inPoly(x, y, ISLAND));
  }
  // Stable pseudo-random from integers.
  function hash(a, b, c) {
    var h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function shadeHex(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = f < 0 ? 0 : 255, p = Math.abs(f);
    var c = function (v) { return ('0' + Math.round((t - v) * p + v).toString(16)).slice(-2); };
    return '#' + c(r) + c(g) + c(b);
  }
  function iso(x, y) { return { x: (x - y) * TW / 2, y: (x + y) * TH / 2 }; }
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = f < 0 ? 0 : 255, p = Math.abs(f);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ---------- world model (built once) ---------- */

  var keys = Object.keys(D.DISTRICTS);
  function nearestDistrict(x, y) {
    var best = null, bd = 1e9;
    keys.forEach(function (k) {
      var d = D.DISTRICTS[k], dd = Math.hypot(d.x - x, d.y - y);
      if (dd < bd) { bd = dd; best = k; }
    });
    return { k: best, d: bd };
  }

  var tiles = [], buildings = [], trees = [];
  for (var ty = Y0; ty < Y1; ty++) {
    for (var tx = X0; tx < X1; tx++) {
      var cx = tx + 0.5, cy = ty + 0.5;
      if (isWater(cx, cy)) continue;
      var nd = nearestDistrict(cx, cy);
      tiles.push({ x: tx, y: ty, k: nd.d < 6 ? nd.k : null, d: nd.d, edgeR: isWater(cx + 1, cy), edgeL: isWater(cx, cy + 1), v: hash(tx, ty, 1) });
    }
  }
  // Buildings sit on a finer 0.5 km grid so the core reads as a dense city.
  var SUB = 0.5;
  for (var by = Y0; by < Y1; by += SUB) {
    for (var bx = X0; bx < X1; bx += SUB) {
      var px = bx + SUB / 2, py = by + SUB / 2, ix = Math.round(bx * 2), iy = Math.round(by * 2);
      if (isWater(px, py) || isWater(px + 0.3, py) || isWater(px, py + 0.3)) continue;
      var n2 = nearestDistrict(px, py), st = STYLE[n2.k];
      var fall = Math.max(0, 1 - n2.d / st.r);
      if (fall <= 0) { if (hash(ix, iy, 9) < 0.07) trees.push({ x: px, y: py, s: 0.8 + hash(ix, iy, 4) * 0.6 }); continue; }
      if (st.trees && hash(ix, iy, 7) < st.trees * 0.5) { trees.push({ x: px, y: py, s: 0.8 + hash(ix, iy, 8) * 0.4 }); continue; }
      if (hash(ix, iy, 5) > st.dens * Math.min(1, fall * 1.8)) continue;
      if (n2.d < 0.75) continue; // keep the centre clear for the district pin
      var tower = st.towers && hash(ix, iy, 11) < st.towers;
      var core = Math.pow(fall, 0.8);
      var h = tower ? 30 + hash(ix, iy, 12) * 26 : st.h[0] + (st.h[1] - st.h[0]) * Math.pow(hash(ix, iy, 6), 1.4) * (0.45 + core * 0.55);
      var f = (st.rows ? st.foot[0] : st.foot[0] + (st.foot[1] - st.foot[0]) * hash(ix, iy, 13)) * SUB;
      buildings.push({ x: px, y: py, w: f, dep: st.market ? f : f * (0.8 + hash(ix, iy, 14) * 0.4), h: h, k: n2.k,
        roof: st.market && hash(ix, iy, 15) < 0.6 ? ['#c44b3a', '#2f6fa0', '#d9a520', '#3f8f55'][Math.floor(hash(ix, iy, 16) * 4)] : (hash(ix, iy, 18) < 0.25 ? shadeHex(st.roof, 0.12) : st.roof),
        wall: tower ? '#8fa2b3' : st.wall, glass: st.glass || tower, seed: hash(ix, iy, 17) });
    }
  }
  // Housing estates: each home on the market gets its own plot of matching
  // buildings. Clear the generic city off those plots first.
  var MODELS = {
    room:     { n: [3, 2], gap: 0.26, w: 0.2, d: 0.2, h: [4, 5], roof: ['#8f5a3c', '#7c8a8f'], wall: '#c9b49a' },
    share:    { n: [2, 1], gap: 0.42, w: 0.32, d: 0.26, h: [12, 14], roof: ['#9aa3a8'], wall: '#d9cdb8' },
    selfcon:  { n: [3, 1], gap: 0.3, w: 0.24, d: 0.24, h: [8, 9], roof: ['#a8826a'], wall: '#e0d3bd' },
    miniflat: { n: [2, 2], gap: 0.32, w: 0.26, d: 0.24, h: [9, 11], roof: ['#7c8f4a'], wall: '#ddd3bf' },
    flat2:    { n: [2, 1], gap: 0.42, w: 0.32, d: 0.3, h: [16, 18], roof: ['#b3a28a'], wall: '#d6c7ad' },
    flat3:    { n: [3, 1], gap: 0.38, w: 0.3, d: 0.3, h: [20, 24], roof: ['#9fa8b0'], wall: '#cfc6b8' },
    duplex:   { n: [2, 2], gap: 0.36, w: 0.26, d: 0.22, h: [8, 8], roof: ['#b44a3a', '#4b4f55'], wall: '#efe6d6', pitch: true, lawn: true },
    luxury:   { n: [2, 1], gap: 0.46, w: 0.32, d: 0.32, h: [46, 58], roof: ['#9fb3c4'], wall: '#8fa2b3', glass: true },
    mansion:  { n: [1, 1], gap: 0, w: 0.62, d: 0.44, h: [11, 11], roof: ['#3d4a52'], wall: '#f2ede4', pitch: true, lawn: true, pool: true }
  };
  var ESTATES = Object.keys(D.HOMES).filter(function (k) { return !D.HOMES[k].hidden && D.HOMES[k].x != null; }).map(function (k) {
    var h = D.HOMES[k], m = MODELS[h.type] || MODELS.room;
    return { id: k, x: h.x, y: h.y, type: h.type, k: h.district, m: m, r: Math.max(0.45, (Math.max(m.n[0], m.n[1]) * Math.max(m.gap, m.w)) / 2 + 0.25) };
  });
  function nearEstate(x, y) { return ESTATES.some(function (e) { return Math.hypot(e.x - x, e.y - y) < e.r + 0.2; }); }
  var E = D.ESTATE, EX1 = E.x0 + E.cols * E.gap, EY1 = E.y0 + E.rows * E.gap;
  function inMainlandEstate(x, y) { return x > E.x0 - 0.3 && x < EX1 + 0.3 && y > E.y0 - 0.3 && y < EY1 + 0.3; }
  buildings = buildings.filter(function (b) { return !nearEstate(b.x, b.y) && !inMainlandEstate(b.x, b.y); });
  trees = trees.filter(function (t) { return !nearEstate(t.x, t.y) && !inMainlandEstate(t.x, t.y); });
  function plotXY(n) { return { x: E.x0 + (n % E.cols) * E.gap + E.gap / 2, y: E.y0 + Math.floor(n / E.cols) * E.gap + E.gap / 2 }; }
  function npcPlot(n) { var h = Math.imul((n + 17) * 2654435761, 1597334677) >>> 0; return (h % 100) < 38; }
  var ESTATE_ROOFS = ['#3f8f55', '#2f7a63', '#4a9a5a', '#b44a3a', '#4b4f55', '#2f6fa0'];
  ESTATES.forEach(function (e, ei) {
    var m = e.m, nx = m.n[0], ny = m.n[1];
    for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) {
      var bx = e.x + (i - (nx - 1) / 2) * m.gap, by = e.y + (j - (ny - 1) / 2) * m.gap;
      buildings.push({ x: bx, y: by, w: m.w, dep: m.d, h: m.h[0] + (m.h[1] - m.h[0]) * hash(ei, i * 7 + j, 51), k: e.k, estate: e.id,
        roof: m.roof[(i + j) % m.roof.length], wall: m.wall, glass: m.glass, pitch: m.pitch });
    }
  });
  buildings.sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
  trees.sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });

  var LAND_BOX = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 };
  tiles.forEach(function (t) {
    [[t.x, t.y], [t.x + 1, t.y], [t.x, t.y + 1], [t.x + 1, t.y + 1]].forEach(function (c) {
      var p = iso(c[0], c[1]);
      LAND_BOX.minX = Math.min(LAND_BOX.minX, p.x); LAND_BOX.maxX = Math.max(LAND_BOX.maxX, p.x);
      LAND_BOX.minY = Math.min(LAND_BOX.minY, p.y); LAND_BOX.maxY = Math.max(LAND_BOX.maxY, p.y);
    });
  });

  // Landmarks drawn into the static layer.
  var RUNWAY = [[3.2, 0.6], [9.6, 0.2], [9.8, 1.0], [3.4, 1.4]];
  var STADIUM = { x: 9.2, y: 16.6, rx: 0.9, ry: 0.7 };

  /* ---------- the playground ---------- */

  function create(opts) {
    var wrap = document.createElement('div');
    wrap.className = 'pg';
    var canvas = document.createElement('canvas');
    canvas.className = 'pg-canvas';
    canvas.setAttribute('role', 'img');
    var hud = document.createElement('div');
    hud.className = 'pg-hud';
    var zoom = document.createElement('div');
    zoom.className = 'pg-zoom';
    zoom.innerHTML = '<button type="button" class="pg-zbtn" data-z="1" aria-label="Zoom in">+</button><button type="button" class="pg-zbtn" data-z="-1" aria-label="Zoom out">−</button><button type="button" class="pg-zbtn" data-z="0" aria-label="Centre on me">◎</button>';
    wrap.appendChild(canvas); wrap.appendChild(hud); wrap.appendChild(zoom);

    var ctx = canvas.getContext('2d');
    // Can this device draw colour emoji? If not, fall back to vector glyphs.
    var emojiOk = (function () {
      try {
        var t = document.createElement('canvas'); t.width = t.height = 16;
        var g = t.getContext('2d'); g.font = '14px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textBaseline = 'top';
        g.fillText('🌳', 0, 0);
        var d = g.getImageData(0, 0, 16, 16).data;
        for (var i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && (Math.abs(d[i] - d[i + 1]) > 30 || Math.abs(d[i + 1] - d[i + 2]) > 30)) return true;
      } catch (e) { /* no canvas reads */ }
      return false;
    })();
    var scene = null, theme = null, staticLayer = null, staticKey = '';
    var W = 0, H = 0, dpr = 1, cam = { z: 1, px: 0, py: 0 }, base = { s: 1, ox: 0, oy: 0 };
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var raf = 0, last = 0, clock = 0;
    var vehicles = [], boats = [];
    var pins = [], placeHits = [], boardHits = [], homeHits = [];
    var HOME_ICON = { room: '🛏️', share: '👥', selfcon: '🚪', miniflat: '🏠', flat2: '🏢', flat3: '🏢', duplex: '🏡', luxury: '🌆', mansion: '🏰' };

    // Vehicles: danfos on roads, ferries on the lagoon.
    D.ROADS.forEach(function (r, i) {
      for (var n = 0; n < 2; n++) vehicles.push({ a: r[0], b: r[1], t: hash(i, n, 21), dir: n ? -1 : 1, kind: hash(i, n, 22) < 0.7 ? 'danfo' : 'car' });
    });
    FERRIES.forEach(function (r, i) { boats.push({ a: r[0], b: r[1], t: hash(i, 3, 23), dir: 1 }); });

    function readTheme() {
      var cs = getComputedStyle(document.documentElement);
      var get = function (n, f) { return (cs.getPropertyValue(n) || '').trim() || f; };
      var paper = get('--paper', '#f4f3ec');
      var dark = (function () { var c = paper.replace('#', ''); if (c.length !== 6) return false; var n = parseInt(c, 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) < 100; })();
      return {
        dark: dark, paper: paper, ink: get('--ink', '#17181a'), danfo: get('--danfo', '#f2b600'), danfoInk: get('--danfo-ink', '#1a1500'),
        lagoon: get('--lagoon', '#0f6f78'), surface: get('--surface', '#ffffff'), muted: get('--muted', '#5d5f63'),
        water: dark ? '#13353a' : '#9fd0d0', waterDeep: dark ? '#0e2a2e' : '#86c1c3',
        land: dark ? '#2d3a2b' : '#c9d6a9', land2: dark ? '#344331' : '#bfcf9b', soil: dark ? '#3b3a30' : '#d9cfb0',
        side: dark ? '#1c231a' : '#8c9a6c', road: dark ? '#4a4d52' : '#6b6f75', roadLine: dark ? '#8a8d91' : '#e8e6dc',
        tree: dark ? '#2f5a33' : '#4f8a46'
      };
    }

    function resize() {
      var r = wrap.getBoundingClientRect();
      var w = Math.max(240, Math.round(r.width)), h = Math.max(200, Math.round(w * (w < 600 ? 0.82 : 0.66)));
      dpr = Math.min(2, root.devicePixelRatio || 1);
      if (w === W && h === H && canvas.width === Math.round(w * dpr)) return false;
      W = w; H = h;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.height = H + 'px';
      // Fit the land (not the empty sea corners), leaving room for the HUD.
      var minX = LAND_BOX.minX, maxX = LAND_BOX.maxX, minY = LAND_BOX.minY - 70, maxY = LAND_BOX.maxY + 6;
      base.s = Math.min(W / (maxX - minX), H / (maxY - minY)) * 0.97;
      base.ox = W / 2 - (minX + maxX) / 2 * base.s;
      base.oy = H / 2 - (minY + maxY) / 2 * base.s;
      staticKey = '';
      return true;
    }

    function fromScreen(sx, sy) {
      var sc = base.s * cam.z;
      var ix = (sx - base.ox * cam.z + (W / 2) * (cam.z - 1) - cam.px) / sc;
      var iy = (sy - base.oy * cam.z + (H / 2) * (cam.z - 1) - cam.py) / sc;
      var a = ix / (TW / 2), b = iy / (TH / 2);
      return { x: (a + b) / 2, y: (b - a) / 2 };
    }
    function toScreen(x, y, z) {
      var p = iso(x, y), s = base.s * cam.z;
      return { x: (p.x * s) + base.ox * cam.z - (W / 2) * (cam.z - 1) + cam.px, y: ((p.y - (z || 0)) * s) + base.oy * cam.z - (H / 2) * (cam.z - 1) + cam.py };
    }

    // 0 = full day, 1 = deepest night.
    function nightLevel(hour, minute) {
      var h = hour + minute / 60;
      if (h >= 7 && h < 17.5) return 0;
      if (h >= 17.5 && h < 19.5) return (h - 17.5) / 2 * 0.85;
      if (h >= 19.5 || h < 5) return 0.85;
      return (1 - (h - 5) / 2) * 0.85;
    }
    function duskLevel(hour, minute) {
      var h = hour + minute / 60;
      if (h >= 17 && h < 19.5) return 1 - Math.abs(h - 18.3) / 1.3;
      if (h >= 5.2 && h < 7.2) return 1 - Math.abs(h - 6.2);
      return 0;
    }

    // Who has light right now, by district (deterministic per 3-hour block).
    function powerMap() {
      var out = {}, block = Math.floor((scene.t || 0) / 180);
      keys.forEach(function (k, i) {
        var p = GRID[k] * (scene.gridDown ? 0.3 : 1) + (scene.levy ? 0.2 : 0);
        out[k] = hash(block, i, 31) < p ? 2 : hash(block, i, 32) < 0.25 ? 1 : 0; // 2 grid, 1 generator, 0 dark
      });
      if (scene.home) out[scene.home] = scene.power ? 2 : 1;
      return out;
    }

    function drawStatic() {
      var night = nightLevel(scene.hour, scene.minute);
      var power = powerMap();
      var key = [W, H, dpr, cam.z, cam.px | 0, cam.py | 0, theme.dark, Math.round(night * 10), JSON.stringify(power), scene.flood ? 1 : 0, scene.myPlot, scene.plotSel, JSON.stringify(scene.plotOwners || {})].join('|');
      if (key === staticKey && staticLayer) return;
      staticKey = key;
      if (!staticLayer) staticLayer = document.createElement('canvas');
      staticLayer.width = canvas.width; staticLayer.height = canvas.height;
      var g = staticLayer.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var s = base.s * cam.z;

      // Water.
      g.fillStyle = theme.water; g.fillRect(0, 0, W, H);
      g.fillStyle = theme.waterDeep;
      for (var i = 0; i < 40; i++) {
        var wx = hash(i, 1, 41) * W, wy = hash(i, 2, 41) * H;
        g.fillRect(wx, wy, 10 + hash(i, 3, 41) * 30, 1);
      }

      function diamond(x, y, z) {
        var a = toScreen(x, y, z), b = toScreen(x + 1, y, z), c = toScreen(x + 1, y + 1, z), d = toScreen(x, y + 1, z);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath();
        return [a, b, c, d];
      }
      // Ground tiles and shoreline cliffs.
      var cliff = 5;
      tiles.forEach(function (t) {
        var pts = diamond(t.x, t.y, 0);
        var fill = t.k ? (t.d < (STYLE[t.k].r - 0.6) ? theme.soil : theme.land) : theme.land2;
        if (scene.flood && t.k && D.DISTRICTS[t.k].side === 'island' && t.v < 0.55) fill = theme.water;
        g.fillStyle = t.v < 0.5 ? fill : shade(fill.charAt(0) === '#' ? fill : '#888888', theme.dark ? 0.03 : -0.03);
        g.fill();
        if (t.edgeR) {
          var b = pts[1], c = pts[2];
          g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(c.x, c.y + cliff * s); g.lineTo(b.x, b.y + cliff * s); g.closePath();
          g.fillStyle = theme.side; g.fill();
        }
        if (t.edgeL) {
          var c2 = pts[2], d2 = pts[3];
          g.beginPath(); g.moveTo(d2.x, d2.y); g.lineTo(c2.x, c2.y); g.lineTo(c2.x, c2.y + cliff * s); g.lineTo(d2.x, d2.y + cliff * s); g.closePath();
          g.fillStyle = shade(theme.side.charAt(0) === '#' ? theme.side : '#666666', -0.15); g.fill();
        }
      });

      // Airport runway near Ikeja and the National Stadium in Surulere.
      g.beginPath();
      RUNWAY.forEach(function (p, i) { var q = toScreen(p[0], p[1], 0); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); });
      g.closePath(); g.fillStyle = theme.road; g.fill();
      g.strokeStyle = theme.roadLine; g.lineWidth = Math.max(0.5, 0.8 * s); g.setLineDash([4 * s, 4 * s]);
      var r0 = toScreen(3.6, 1.0, 0), r1 = toScreen(9.4, 0.6, 0);
      g.beginPath(); g.moveTo(r0.x, r0.y); g.lineTo(r1.x, r1.y); g.stroke(); g.setLineDash([]);
      var sc = toScreen(STADIUM.x, STADIUM.y, 0);
      g.beginPath(); g.ellipse(sc.x, sc.y, STADIUM.rx * TW * s * 0.8, STADIUM.ry * TH * s * 0.8, 0, 0, Math.PI * 2);
      g.fillStyle = theme.dark ? '#3c6a3a' : '#6aa357'; g.fill();
      g.lineWidth = 3 * s; g.strokeStyle = theme.dark ? '#7b7f86' : '#d8d4c8'; g.stroke();

      // Estate plots: a paved pad, lawns for duplexes and the mansion, a pool.
      ESTATES.forEach(function (e) {
        var r = e.r, pad = [[e.x - r, e.y - r], [e.x + r, e.y - r], [e.x + r, e.y + r], [e.x - r, e.y + r]];
        g.beginPath(); pad.forEach(function (c, i) { var q = toScreen(c[0], c[1], 0); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.closePath();
        g.fillStyle = e.m.lawn ? (theme.dark ? '#2f4a2c' : '#8fbf6a') : (theme.dark ? '#3a3b38' : '#e3ddcc'); g.fill();
        g.strokeStyle = theme.dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)'; g.lineWidth = 1; g.stroke();
        if (e.m.pool) {
          var pl = [[e.x + 0.18, e.y + 0.26], [e.x + 0.48, e.y + 0.26], [e.x + 0.48, e.y + 0.44], [e.x + 0.18, e.y + 0.44]];
          g.beginPath(); pl.forEach(function (c, i) { var q = toScreen(c[0], c[1], 0); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.closePath();
          g.fillStyle = '#3fb6d8'; g.fill(); g.strokeStyle = '#ffffff'; g.stroke();
        }
      });

      // Mainland Estate: a fenced grid of plots.
      (function () {
        var c = [[E.x0 - 0.15, E.y0 - 0.15], [EX1 + 0.15, E.y0 - 0.15], [EX1 + 0.15, EY1 + 0.15], [E.x0 - 0.15, EY1 + 0.15]];
        g.beginPath(); c.forEach(function (k, i) { var q = toScreen(k[0], k[1], 0); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.closePath();
        g.fillStyle = theme.dark ? '#33402f' : '#d4ddb8'; g.fill();
        g.strokeStyle = theme.dark ? '#7b7f86' : '#9aa08c'; g.lineWidth = Math.max(1, 1.2 * s); g.stroke();
        var pad = E.gap * 0.42;
        for (var n = 0; n < E.cols * E.rows; n++) {
          var p = plotXY(n), mine = scene.myPlot === n, sel = scene.plotSel === n;
          var q = [[p.x - pad, p.y - pad], [p.x + pad, p.y - pad], [p.x + pad, p.y + pad], [p.x - pad, p.y + pad]];
          g.beginPath(); q.forEach(function (k, i) { var t = toScreen(k[0], k[1], 0); if (i) g.lineTo(t.x, t.y); else g.moveTo(t.x, t.y); }); g.closePath();
          g.fillStyle = mine ? theme.danfo : sel ? (theme.dark ? '#2b5f66' : '#bfe2e2') : (theme.dark ? '#3d3e3a' : '#ece8da'); g.fill();
        }
      })();

      // Roads (bridges included) between districts.
      g.lineCap = 'round';
      D.ROADS.forEach(function (r) {
        var a = D.DISTRICTS[r[0]], b = D.DISTRICTS[r[1]];
        var p = toScreen(a.x, a.y, 0), q = toScreen(b.x, b.y, 0);
        var bridge = a.side !== b.side;
        g.strokeStyle = bridge ? (theme.dark ? '#5b5f66' : '#8d9198') : theme.road;
        g.lineWidth = Math.max(2, (bridge ? 4.2 : 3.4) * s);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
        g.strokeStyle = theme.roadLine; g.lineWidth = Math.max(0.5, 0.6 * s); g.setLineDash([3 * s, 4 * s]);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); g.setLineDash([]);
      });
      // Ferry lanes.
      g.strokeStyle = theme.lagoon; g.lineWidth = Math.max(1, 1.2 * s); g.setLineDash([5 * s, 5 * s]);
      FERRIES.forEach(function (r) {
        var a = D.DISTRICTS[r[0]], b = D.DISTRICTS[r[1]], p = toScreen(a.x, a.y, 0), q = toScreen(b.x, b.y, 0);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
      });
      g.setLineDash([]);

      // Road names along the roads; minor roads and streets appear as you zoom in.
      g.textAlign = 'center'; g.textBaseline = 'middle';
      D.ROADS.forEach(function (r) {
        var name = D.ROAD_NAMES[r[0] + '-' + r[1]];
        if (!name || (cam.z < 1.4 && D.MAJOR_ROADS.indexOf(name) < 0)) return;
        var a = D.DISTRICTS[r[0]], b = D.DISTRICTS[r[1]];
        groundText(g, name, (a.x + b.x) / 2, (a.y + b.y) / 2, b.x - a.x, b.y - a.y, D.MAJOR_ROADS.indexOf(name) >= 0 ? 0.55 : 0.42, theme.dark ? 'rgba(235,235,225,.85)' : 'rgba(40,42,46,.85)', true);
      });
      if (cam.z >= 1.6) {
        D.STREETS.forEach(function (st) {
          var p = toScreen(st.a[0], st.a[1], 0), q = toScreen(st.b[0], st.b[1], 0);
          g.strokeStyle = theme.road; g.lineWidth = Math.max(1.2, 1.6 * s); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
          groundText(g, st.name, (st.a[0] + st.b[0]) / 2, (st.a[1] + st.b[1]) / 2, st.b[0] - st.a[0], st.b[1] - st.a[1], 0.3, theme.dark ? 'rgba(235,235,225,.8)' : 'rgba(40,42,46,.8)', true);
        });
      }
      // Area names painted on the ground.
      D.AREA_LABELS.forEach(function (l) {
        groundText(g, l[0], l[1], l[2], 1, 0, l[3], theme.dark ? 'rgba(255,255,255,.3)' : 'rgba(30,60,30,.34)', false, true);
      });

      // Water labels.
      g.fillStyle = theme.dark ? 'rgba(160,210,214,.55)' : 'rgba(15,111,120,.55)';
      g.font = 'italic 600 ' + Math.max(9, 11 * Math.min(1.4, s)) + 'px ' + 'Atkinson Hyperlegible, sans-serif';
      g.textAlign = 'center';
      var lg = toScreen(30, 13.5, 0); g.fillText('LAGOS  LAGOON', lg.x, lg.y);
      var oc = toScreen(37, 29.6, 0); g.fillText('ATLANTIC  OCEAN', oc.x, oc.y);
      var hb = toScreen(11.5, 24.5, 0); g.fillText('HARBOUR', hb.x, hb.y);

      // Trees and buildings, back to front.
      var houses = [];
      for (var pn = 0; pn < E.cols * E.rows; pn++) {
        if (!(npcPlot(pn) || (scene.plotOwners && scene.plotOwners[pn]) || scene.myPlot === pn)) continue;
        var pp = plotXY(pn);
        houses.push({ x: pp.x, y: pp.y, w: E.gap * 0.5, dep: E.gap * 0.42, h: 7 + hash(pn, 3, 61) * 3, k: E.district, pitch: true,
          roof: scene.myPlot === pn ? '#f2b600' : ESTATE_ROOFS[Math.floor(hash(pn, 4, 62) * ESTATE_ROOFS.length)], wall: '#efe9dc' });
      }
      var items = trees.map(function (t) { return { tree: t, z: t.x + t.y }; }).concat(buildings.concat(houses).map(function (b) { return { b: b, z: b.x + b.y }; }));
      items.sort(function (a, b) { return a.z - b.z; });
      items.forEach(function (it) { if (it.tree) drawTree(g, it.tree, s); else drawBuilding(g, it.b, s, night, power[it.b.k]); });

      // Night and dusk wash, with lit windows punched back through.
      var dusk = duskLevel(scene.hour, scene.minute);
      if (dusk > 0) { g.fillStyle = 'rgba(255,140,60,' + (dusk * 0.18).toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
      if (night > 0) {
        g.fillStyle = 'rgba(8,14,40,' + (night * 0.5).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
        buildings.concat(houses).forEach(function (b) { drawWindows(g, b, s, power[b.k], night); });
      }
    }

    // Text laid on the ground plane along direction (dx, dy), size in km.
    function groundText(g, text, x, y, dx, dy, size, color, halo, bold) {
      var o = toScreen(x, y, 0), sc = base.s * cam.z;
      var len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      // World unit vectors projected to screen (per km).
      var ax = (ux - uy) * TW / 2 * sc, ay = (ux + uy) * TH / 2 * sc;
      var bx = (-uy - ux) * TW / 2 * sc, by = (-uy + ux) * TH / 2 * sc;
      if (ax < 0) { ax = -ax; ay = -ay; bx = -bx; by = -by; } // keep text left-to-right
      g.save();
      g.setTransform(dpr * ax, dpr * ay, dpr * bx, dpr * by, dpr * o.x, dpr * o.y);
      g.font = (bold ? '800 ' : '700 ') + size + 'px Atkinson Hyperlegible, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (halo) { g.lineWidth = size * 0.25; g.strokeStyle = theme.dark ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.75)'; g.strokeText(text, 0, 0); }
      g.fillStyle = color; g.fillText(text, 0, 0);
      g.restore();
    }

    function drawTree(g, t, s) {
      var p = toScreen(t.x, t.y, 0), r = 2.6 * t.s * s;
      g.fillStyle = theme.dark ? '#3a2d22' : '#7a5a3a';
      g.fillRect(p.x - 0.5 * s, p.y - 3 * s, 1 * s, 3 * s);
      g.beginPath(); g.arc(p.x, p.y - 4.5 * s, r, 0, Math.PI * 2); g.fillStyle = theme.tree; g.fill();
    }

    function boxFaces(b, s) {
      var hw = b.w / 2, hd = b.dep / 2;
      var p0 = toScreen(b.x - hw, b.y - hd, 0), p1 = toScreen(b.x + hw, b.y - hd, 0), p2 = toScreen(b.x + hw, b.y + hd, 0), p3 = toScreen(b.x - hw, b.y + hd, 0);
      var up = b.h * s;
      return { p0: p0, p1: p1, p2: p2, p3: p3, up: up };
    }

    function drawBuilding(g, b, s, night, pw) {
      var f = boxFaces(b, s), up = f.up;
      // Right face (x+), left face (y+), then roof.
      g.beginPath(); g.moveTo(f.p1.x, f.p1.y); g.lineTo(f.p2.x, f.p2.y); g.lineTo(f.p2.x, f.p2.y - up); g.lineTo(f.p1.x, f.p1.y - up); g.closePath();
      g.fillStyle = shade(b.wall, -0.28); g.fill();
      g.beginPath(); g.moveTo(f.p3.x, f.p3.y); g.lineTo(f.p2.x, f.p2.y); g.lineTo(f.p2.x, f.p2.y - up); g.lineTo(f.p3.x, f.p3.y - up); g.closePath();
      g.fillStyle = shade(b.wall, -0.1); g.fill();
      if (b.pitch) {
        // A gabled roof: ridge along x, two slopes and a gable end.
        var rise = Math.max(3, b.dep * 30) * s;
        var mL = { x: (f.p0.x + f.p3.x) / 2, y: (f.p0.y + f.p3.y) / 2 - up - rise }, mR = { x: (f.p1.x + f.p2.x) / 2, y: (f.p1.y + f.p2.y) / 2 - up - rise };
        g.beginPath(); g.moveTo(f.p0.x, f.p0.y - up); g.lineTo(f.p1.x, f.p1.y - up); g.lineTo(mR.x, mR.y); g.lineTo(mL.x, mL.y); g.closePath();
        g.fillStyle = shade(b.roof, -0.18); g.fill();
        g.beginPath(); g.moveTo(f.p1.x, f.p1.y - up); g.lineTo(f.p2.x, f.p2.y - up); g.lineTo(mR.x, mR.y); g.closePath();
        g.fillStyle = shade(b.wall, -0.2); g.fill();
        g.beginPath(); g.moveTo(f.p3.x, f.p3.y - up); g.lineTo(f.p2.x, f.p2.y - up); g.lineTo(mR.x, mR.y); g.lineTo(mL.x, mL.y); g.closePath();
        g.fillStyle = b.roof; g.fill();
      } else {
        g.beginPath(); g.moveTo(f.p0.x, f.p0.y - up); g.lineTo(f.p1.x, f.p1.y - up); g.lineTo(f.p2.x, f.p2.y - up); g.lineTo(f.p3.x, f.p3.y - up); g.closePath();
        g.fillStyle = b.roof; g.fill();
      }
      if (b.glass && up > 18 * s) {
        // Curtain-wall bands by day.
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = Math.max(0.5, 0.6 * s);
        for (var yy = 4 * s; yy < up - 2 * s; yy += 4 * s) {
          g.beginPath(); g.moveTo(f.p3.x, f.p3.y - yy); g.lineTo(f.p2.x, f.p2.y - yy); g.stroke();
        }
      }
    }

    function drawWindows(g, b, s, pw, night) {
      if (!pw) return;                       // NEPA: no light at all
      var f = boxFaces(b, s), up = f.up, rows = Math.max(1, Math.floor(b.h / 4.5)), lit = pw === 2 ? 0.7 : 0.2;
      g.fillStyle = pw === 2 ? 'rgba(255,214,120,' + (0.55 + night * 0.4).toFixed(2) + ')' : 'rgba(255,190,90,.75)';
      var ww = Math.max(1, 1.3 * s), wh = Math.max(1, 1.6 * s);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < 3; c++) {
          if (hash(Math.round(b.x * 10), Math.round(b.y * 10) + r * 7, c) > lit) continue;
          var t = (c + 0.5) / 3, x = f.p3.x + (f.p2.x - f.p3.x) * t, y = f.p3.y + (f.p2.y - f.p3.y) * t - (r + 0.6) * (up / rows);
          g.fillRect(x - ww / 2, y - wh / 2, ww, wh);
        }
      }
    }

    function along(v) {
      var a = D.DISTRICTS[v.a], b = D.DISTRICTS[v.b], t = v.dir > 0 ? v.t : 1 - v.t;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    function drawDynamic(dt) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(staticLayer, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var s = base.s * cam.z, night = nightLevel(scene.hour, scene.minute);

      // Traffic: slower in rush hour, fewer at night.
      var rush = (scene.hour >= 6 && scene.hour < 10) || (scene.hour >= 16 && scene.hour < 21);
      var speed = (rush ? 0.012 : 0.04) * (scene.fuel ? 0.6 : 1);
      vehicles.forEach(function (v, i) {
        if (night > 0.6 && i % 3) return;
        if (!reduce) { v.t += speed * dt; if (v.t > 1) v.t -= 1; }
        var p = along(v), q = toScreen(p.x, p.y, 1.5);
        var w = Math.max(3, 3.4 * s), h = Math.max(1.8, 1.9 * s);
        ctx.fillStyle = v.kind === 'danfo' ? theme.danfo : (theme.dark ? '#c9ccd2' : '#f5f5f2');
        ctx.fillRect(q.x - w / 2, q.y - h, w, h);
        if (v.kind === 'danfo') { ctx.fillStyle = theme.danfoInk; ctx.fillRect(q.x - w / 2, q.y - h * 0.55, w, Math.max(0.6, 0.35 * s)); }
        if (night > 0.3) { ctx.fillStyle = 'rgba(255,240,180,.9)'; ctx.fillRect(q.x + w / 2 - 0.8, q.y - h * 0.6, 1.4, 1); }
      });
      boats.forEach(function (bt) {
        if (!reduce) { bt.t += 0.01 * dt; if (bt.t > 1) { bt.t = 0; bt.dir = -bt.dir; } }
        var p = along(bt), q = toScreen(p.x, p.y, 0);
        ctx.fillStyle = theme.dark ? '#dfe6e8' : '#ffffff';
        ctx.beginPath(); ctx.ellipse(q.x, q.y, 3.4 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = theme.lagoon; ctx.fillRect(q.x - 1.2 * s, q.y - 2.4 * s, 2.4 * s, 1.4 * s);
      });

      var labels = [];
      // Estate badges: always for your home; for the rest when Homes is
      // chosen or you zoom in.
      homeHits = [];
      var er = Math.max(6.5, Math.min(12, 6.5 * Math.sqrt(cam.z) * Math.min(1.3, Math.max(0.85, base.s))));
      ESTATES.forEach(function (e) {
        var mine = e.id === scene.homeId, sel = e.id === scene.homeSel;
        if (!(mine || sel || scene.showHomes || cam.z >= 1.6)) return;
        var p = toScreen(e.x, e.y, 0), cy = p.y - (MODELS[e.type].h[1] + 6) * s - er;
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y - MODELS[e.type].h[1] * s * 0.5); ctx.lineTo(p.x, cy + er); ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, cy, mine ? er + 2 : er, 0, Math.PI * 2); ctx.fillStyle = mine ? theme.danfo : '#ffffff'; ctx.fill();
        ctx.lineWidth = sel ? 3 : 2; ctx.strokeStyle = sel ? theme.lagoon : (mine ? theme.danfoInk : '#5d5f63'); ctx.stroke();
        var icon = HOME_ICON[e.type] || '🏠';
        if (emojiOk) {
          ctx.font = Math.round(er * 1.15) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, p.x, cy + er * 0.08);
        } else { glyph(ctx, 'dome', p.x, cy, er * 0.6); }
        var n = scene.residents && scene.residents[e.id];
        if (n) {
          ctx.beginPath(); ctx.arc(p.x + er, cy - er * 0.6, 7, 0, Math.PI * 2); ctx.fillStyle = theme.lagoon; ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.font = '700 9px IBM Plex Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.min(99, n)), p.x + er, cy - er * 0.6 + 0.5);
        }
        homeHits.push({ id: e.id, x: p.x, y: cy });
        if (mine || sel) labels.push({ place: { name: mine ? 'Your home · ' + D.HOMES[e.id].name : D.HOMES[e.id].name, type: 'services' }, top: { x: p.x, y: cy + 4 }, pri: mine ? 2 : 1, sel: sel, homeTag: true });
      });
      if (scene.myPlot != null) {
        var mp = plotXY(scene.myPlot), mq = toScreen(mp.x, mp.y, 0), my = mq.y - 14 * s - er;
        ctx.beginPath(); ctx.arc(mq.x, my, er + 2, 0, Math.PI * 2); ctx.fillStyle = theme.danfo; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = theme.danfoInk; ctx.stroke();
        if (emojiOk) { ctx.font = Math.round(er * 1.15) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏡', mq.x, my + er * 0.08); }
        labels.push({ place: { name: 'Your house · plot ' + (scene.myPlot + 1), type: 'services' }, top: { x: mq.x, y: my + 4 }, pri: 2, homeTag: true });
      }
      ctx.textBaseline = 'alphabetic';

      // Billboards: a panel on two posts; paid ads rotate every 15 s.
      boardHits = [];
      var slot = Math.floor(Date.now() / 15000);
      D.BILLBOARDS.forEach(function (b, bi) {
        var ads = (scene.boards && scene.boards[b.id]) || [];
        if (!ads.length) return;
        var ad = ads[(slot + bi) % ads.length];
        var p = toScreen(b.x, b.y, 0), k = Math.max(0.85, Math.min(1.8, s));
        var pw = 40 * k, ph = 20 * k, post = 12 * k, x = p.x - pw / 2, y = p.y - post - ph;
        var selB = b.id === scene.board;
        ctx.strokeStyle = theme.dark ? '#9aa0a6' : '#4b4f55'; ctx.lineWidth = Math.max(1, 1.2 * k);
        ctx.beginPath(); ctx.moveTo(p.x - pw * 0.3, p.y); ctx.lineTo(p.x - pw * 0.3, y + ph); ctx.moveTo(p.x + pw * 0.3, p.y); ctx.lineTo(p.x + pw * 0.3, y + ph); ctx.stroke();
        ctx.fillStyle = theme.dark ? '#0b0c0d' : '#202226'; roundRect(ctx, x - 1.5, y - 1.5, pw + 3, ph + 3, 3); ctx.fill();
        ctx.fillStyle = ad.color.bg; roundRect(ctx, x, y, pw, ph, 2); ctx.fill();
        if (selB) { ctx.strokeStyle = theme.danfo; ctx.lineWidth = 2.5; roundRect(ctx, x - 3, y - 3, pw + 6, ph + 6, 4); ctx.stroke(); }
        ctx.textBaseline = 'middle';
        ctx.font = Math.round(ph * 0.55) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        ctx.textAlign = 'left'; ctx.fillStyle = ad.color.fg;
        ctx.fillText(ad.emoji, x + 2 * k, y + ph / 2 + 0.5);
        var fs = Math.round(5.2 * k * Math.min(1.25, cam.z));
        if (fs >= 6) {
          ctx.font = '700 ' + fs + 'px Atkinson Hyperlegible, sans-serif';
          var words = ad.text.split(' '), lines = [''], maxW = pw - ph * 0.65 - 5 * k;
          words.forEach(function (w) { var t = (lines[lines.length - 1] + ' ' + w).trim(); if (ctx.measureText(t).width > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; });
          lines = lines.slice(0, Math.max(1, Math.floor(ph / (fs + 1))));
          lines.forEach(function (ln, i) { ctx.fillText(ln, x + ph * 0.62 + 3 * k, y + ph / 2 + (i - (lines.length - 1) / 2) * (fs + 1)); });
        }
        if (ad.paid) { ctx.beginPath(); ctx.arc(x + pw - 3 * k, y + 3 * k, 1.8 * k, 0, Math.PI * 2); ctx.fillStyle = '#e5484d'; ctx.fill(); }
        boardHits.push({ id: b.id, x: p.x, y: y + ph / 2, w: pw, h: ph + post });
      });
      ctx.textBaseline = 'alphabetic';

      // Key places: a coloured badge per category with a small vector glyph.
      placeHits = [];
      var pr = Math.max(6.5, Math.min(12, 6.5 * Math.sqrt(cam.z) * Math.min(1.3, Math.max(0.85, base.s))));
      (scene.places || []).forEach(function (pl) {
        var p = toScreen(pl.x, pl.y, 0), sel = pl.id === scene.place;
        var cy = p.y - pr - 2;
        if (sel) { ctx.beginPath(); ctx.arc(p.x, cy, pr + 5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill(); }
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - pr * 0.45, cy + pr * 0.6); ctx.lineTo(p.x + pr * 0.45, cy + pr * 0.6); ctx.closePath();
        ctx.fillStyle = D.PLACE_TYPES[pl.type].color; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, cy, pr, 0, Math.PI * 2); ctx.fill();
        if (emojiOk && pl.icon) {
          // Real icons: the emoji on a white badge, ringed in the category colour.
          ctx.beginPath(); ctx.arc(p.x, cy, pr, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
          ctx.lineWidth = sel ? 3 : 2; ctx.strokeStyle = sel ? theme.danfo : D.PLACE_TYPES[pl.type].color; ctx.stroke();
          ctx.font = Math.round(pr * 1.15) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(pl.icon, p.x, cy + pr * 0.08);
        } else {
          ctx.lineWidth = sel ? 2.5 : 1.5; ctx.strokeStyle = sel ? theme.danfo : '#ffffff'; ctx.stroke();
          glyph(ctx, pl.glyph, p.x, cy, pr * 0.62);
        }
        placeHits.push({ id: pl.id, x: p.x, y: cy });
        if (sel || cam.z >= 1.9) labels.push({ place: pl, top: { x: p.x, y: cy + 4 }, pri: sel ? 1 : 4, sel: sel });
      });

      // District pins.
      pins = [];
      var pulse = reduce ? 0.5 : (clock % 2200) / 2200;
      keys.forEach(function (k) {
        var d = D.DISTRICTS[k], p = toScreen(d.x, d.y, 0);
        var here = k === scene.loc, sel = k === scene.sel;
        var stem = 16 * Math.min(1.4, Math.max(0.8, s));
        var top = { x: p.x, y: p.y - stem };
        pins.push({ k: k, x: top.x, y: top.y, gx: p.x, gy: p.y });
        ctx.strokeStyle = theme.dark ? 'rgba(255,255,255,.5)' : 'rgba(23,24,26,.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(top.x, top.y); ctx.stroke();
        if (here) {
          ctx.beginPath(); ctx.arc(top.x, top.y, 7 + pulse * 12, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(242,182,0,' + (1 - pulse).toFixed(2) + ')'; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(top.x, top.y, here ? 7 : 5.5, 0, Math.PI * 2);
        ctx.fillStyle = here ? theme.danfo : theme.surface; ctx.fill();
        ctx.lineWidth = sel ? 3 : 2; ctx.strokeStyle = sel ? theme.lagoon : (here ? theme.danfoInk : theme.ink); ctx.stroke();

        labels.push({ k: k, here: here, sel: sel, top: top, pri: here ? 0 : sel ? 1 : (k === scene.home || k === scene.work) ? 2 : 3 });

        // Other players here.
        var n = scene.peers && scene.peers[k];
        if (n) {
          var bx = top.x + 10, by = top.y + 2;
          ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fillStyle = theme.lagoon; ctx.fill();
          ctx.strokeStyle = theme.surface; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.font = '700 9px IBM Plex Mono, monospace'; ctx.fillText(String(Math.min(99, n)), bx, by + 0.5);
        }
      });
      placeLabels(labels);
      ctx.textBaseline = 'alphabetic';
    }

    // Name chips, most important first; each takes the first free spot
    // above, below, right or left of its pin, or is left off if crowded.
    function placeLabels(list) {
      list.sort(function (a, b) { return a.pri - b.pri; });
      var taken = pins.map(function (p) { return { x: p.x - 7, y: p.y - 7, w: 14, h: 14 }; });
      list.forEach(function (l) {
        var text = l.place ? l.place.name : D.DISTRICTS[l.k].name + (l.k === scene.home ? ' · Home' : '') + (l.k === scene.work ? ' · Work' : '');
        ctx.font = (l.place ? '600 10.5px' : '700 ' + (l.here ? 12 : 11) + 'px') + ' Atkinson Hyperlegible, sans-serif';
        var w = ctx.measureText(text).width + (l.place ? 18 : 12), h = l.place ? 15 : 17, x0 = l.top.x, y0 = l.top.y;
        var spots = [[x0 - w / 2, y0 - 28], [x0 - w / 2, y0 + 10], [x0 + 10, y0 - h / 2], [x0 - 10 - w, y0 - h / 2]];
        var box = null;
        for (var i = 0; i < spots.length && !box; i++) {
          var c = { x: spots[i][0], y: spots[i][1], w: w, h: h };
          if (c.x < 2 || c.y < 34 || c.x + w > W - 2 || c.y + h > H - 2) continue;
          if (!taken.some(function (t) { return c.x < t.x + t.w && c.x + c.w > t.x && c.y < t.y + t.h && c.y + c.h > t.y; })) box = c;
        }
        if (!box && l.pri <= 2) box = { x: x0 - w / 2, y: y0 - 28, w: w, h: h };
        if (!box) return;
        taken.push(box);
        ctx.fillStyle = l.here ? theme.danfo : (theme.dark ? 'rgba(27,28,30,.9)' : 'rgba(255,255,255,.92)');
        roundRect(ctx, box.x, box.y, box.w, box.h, 8.5); ctx.fill();
        if (l.place) { ctx.fillStyle = l.homeTag ? theme.danfo : D.PLACE_TYPES[l.place.type].color; ctx.fillRect(box.x + 5, box.y + box.h / 2 - 3, 3, 6); }
        if (l.sel) { ctx.strokeStyle = l.place ? theme.danfo : theme.lagoon; ctx.lineWidth = 2; roundRect(ctx, box.x, box.y, box.w, box.h, 8.5); ctx.stroke(); }
        ctx.fillStyle = l.here ? theme.danfoInk : theme.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, box.x + box.w / 2, box.y + box.h / 2 + 0.5);
      });
    }

    // Tiny white vector icons, drawn in a box of half-size r around (x, y).
    function glyph(g, kind, x, y, r) {
      g.save();
      g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = Math.max(1, r * 0.28); g.lineCap = 'round'; g.lineJoin = 'round';
      var L = function (pts) { g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(x + p[0] * r, y + p[1] * r); else g.moveTo(x + p[0] * r, y + p[1] * r); }); g.stroke(); };
      var C = function (cx, cy, rr, fill) { g.beginPath(); g.arc(x + cx * r, y + cy * r, rr * r, 0, Math.PI * 2); if (fill) g.fill(); else g.stroke(); };
      var R = function (x0, y0, w, h, fill) { if (fill) g.fillRect(x + x0 * r, y + y0 * r, w * r, h * r); else g.strokeRect(x + x0 * r, y + y0 * r, w * r, h * r); };
      switch (kind) {
        case 'glass': L([[-0.8, -0.7], [0.8, -0.7], [0, 0.15], [-0.8, -0.7]]); L([[0, 0.15], [0, 0.75]]); L([[-0.45, 0.8], [0.45, 0.8]]); break;
        case 'note': C(-0.35, 0.55, 0.3, true); L([[-0.08, 0.55], [-0.08, -0.8], [0.6, -0.55]]); break;
        case 'film': R(-0.8, -0.55, 1.6, 1.1); L([[-0.35, -0.55], [-0.35, 0.55]]); L([[0.35, -0.55], [0.35, 0.55]]); break;
        case 'mask': C(0, 0, 0.75); C(-0.3, -0.15, 0.1, true); C(0.3, -0.15, 0.1, true); g.beginPath(); g.arc(x, y + 0.1 * r, 0.38 * r, 0.2, Math.PI - 0.2); g.stroke(); break;
        case 'frame': R(-0.75, -0.65, 1.5, 1.3); L([[-0.5, 0.4], [-0.1, -0.05], [0.2, 0.25], [0.5, -0.1]]); break;
        case 'tree': C(0, -0.25, 0.5, true); L([[0, 0.2], [0, 0.85]]); break;
        case 'wave': g.beginPath(); for (var i = 0; i <= 10; i++) { var t = i / 10; g.lineTo(x + (t * 1.7 - 0.85) * r, y + Math.sin(t * Math.PI * 2) * 0.3 * r); } g.stroke(); break;
        case 'ball': C(0, 0, 0.7); L([[-0.7, 0], [0.7, 0]]); L([[0, -0.7], [0, 0.7]]); break;
        case 'dumbbell': L([[-0.6, 0], [0.6, 0]]); R(-0.85, -0.4, 0.3, 0.8, true); R(0.55, -0.4, 0.3, 0.8, true); break;
        case 'bowl': g.beginPath(); g.arc(x, y - 0.1 * r, 0.75 * r, 0, Math.PI); g.closePath(); g.fill(); L([[-0.9, -0.1], [0.9, -0.1]]); break;
        case 'basket': L([[-0.8, -0.2], [0.8, -0.2], [0.55, 0.7], [-0.55, 0.7], [-0.8, -0.2]]); g.beginPath(); g.arc(x, y - 0.2 * r, 0.5 * r, Math.PI, 0); g.stroke(); break;
        case 'cap': L([[-0.9, -0.2], [0, -0.65], [0.9, -0.2], [0, 0.25], [-0.9, -0.2]]); L([[-0.5, 0.05], [-0.5, 0.55], [0.5, 0.55], [0.5, 0.05]]); break;
        case 'laptop': R(-0.6, -0.6, 1.2, 0.85); L([[-0.9, 0.55], [0.9, 0.55]]); break;
        case 'phone': R(-0.4, -0.75, 0.8, 1.5); C(0, 0.5, 0.08, true); break;
        case 'tool': L([[-0.6, 0.6], [0.3, -0.3]]); C(0.45, -0.45, 0.3); break;
        case 'scissors': C(-0.4, 0.45, 0.25); C(0.4, 0.45, 0.25); L([[-0.25, 0.25], [0.5, -0.75]]); L([[0.25, 0.25], [-0.5, -0.75]]); break;
        case 'cross': R(-0.22, -0.7, 0.44, 1.4, true); R(-0.7, -0.22, 1.4, 0.44, true); break;
        case 'dome': g.beginPath(); g.arc(x, y + 0.2 * r, 0.6 * r, Math.PI, 0); g.closePath(); g.fill(); L([[0, -0.4], [0, -0.85]]); L([[-0.8, 0.45], [0.8, 0.45]]); break;
        case 'naira': L([[-0.45, 0.7], [-0.45, -0.7], [0.45, 0.7], [0.45, -0.7]]); L([[-0.7, -0.1], [0.7, -0.1]]); L([[-0.7, 0.2], [0.7, 0.2]]); break;
        case 'boat': g.beginPath(); g.moveTo(x - 0.85 * r, y + 0.15 * r); g.lineTo(x + 0.85 * r, y + 0.15 * r); g.lineTo(x + 0.5 * r, y + 0.6 * r); g.lineTo(x - 0.5 * r, y + 0.6 * r); g.closePath(); g.fill(); L([[0, 0.1], [0, -0.75], [0.55, 0.0]]); break;
        case 'car': R(-0.85, -0.1, 1.7, 0.6); L([[-0.5, -0.1], [-0.3, -0.55], [0.35, -0.55], [0.55, -0.1]]); C(-0.45, 0.55, 0.18, true); C(0.45, 0.55, 0.18, true); break;
        case 'bus': R(-0.75, -0.6, 1.5, 1.0); L([[-0.75, -0.1], [0.75, -0.1]]); C(-0.4, 0.6, 0.15, true); C(0.4, 0.6, 0.15, true); break;
        case 'plane': L([[0, -0.85], [0, 0.85]]); L([[-0.85, 0.05], [0, -0.25], [0.85, 0.05]]); L([[-0.35, 0.75], [0, 0.6], [0.35, 0.75]]); break;
        default: C(0, 0, 0.35, true);
      }
      g.restore();
    }

    function roundRect(g, x, y, w, h, r) {
      g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }

    function hudHtml() {
      var bits = [];
      var esc = function (v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
      if (scene.others) bits.push('<span class="pg-pill"><i class="pg-live"></i>' + scene.others + ' online</span>');
      bits.push('<span class="pg-pill">' + esc(scene.clock) + '</span>');
      bits.push('<span class="pg-pill' + (scene.power ? '' : ' off') + '">' + (scene.power ? 'Light at home' : 'NEPA took light') + '</span>');
      var banner = scene.banner ? '<div class="pg-banner">' + esc(scene.banner) + '</div>' : '';
      return '<div class="pg-pills">' + bits.join('') + '</div>' + banner;
    }

    function frame(ts) {
      raf = 0;
      if (!wrap.isConnected || !scene) return;
      var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
      if (dt && dt < 1 / 32) { schedule(); return; } // ~30 fps is plenty
      last = ts; clock += dt * 1000;
      if (resize()) staticKey = '';
      drawStatic();
      drawDynamic(dt * 10);
      if (!reduce && !document.hidden) schedule();
    }
    function schedule() { if (!raf) raf = root.requestAnimationFrame(frame); }

    // Pointer: tap a pin to select; drag to pan when zoomed in.
    var drag = null;
    canvas.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, px: cam.px, py: cam.py, moved: false };
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      if (drag.moved && cam.z > 1) { cam.px = drag.px + dx; cam.py = drag.py + dy; clampCam(); staticKey = ''; kick(); }
    });
    canvas.addEventListener('pointerup', function (e) {
      var d = drag; drag = null;
      if (!d || d.moved) return;
      var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 26;
      pins.forEach(function (p) {
        var dd = Math.min(Math.hypot(p.x - x, p.y - y), Math.hypot(p.gx - x, p.gy - y), Math.hypot(p.x - x, p.y - 19 - y));
        if (dd < bd) { bd = dd; best = p.k; }
      });
      var bestHome = null, bh = 15;
      homeHits.forEach(function (h) { var dd = Math.hypot(h.x - x, h.y - y); if (dd < bh) { bh = dd; bestHome = h.id; } });
      if (bestHome && opts.onSelectHome) { opts.onSelectHome(bestHome); return; }
      var bestBoard = null;
      boardHits.forEach(function (b) { if (Math.abs(x - b.x) <= b.w / 2 + 3 && y >= b.y - b.h / 2 - 3 && y <= b.y + b.h / 2) bestBoard = b.id; });
      if (bestBoard && opts.onSelectBoard) { opts.onSelectBoard(bestBoard); return; }
      var bestPlace = null, bp = Math.min(bd, 16);
      // Tap on the estate grid: work back from the screen to world km.
      var w = fromScreen(x, y);
      if (!bestHome && bd > 14 && w.x > E.x0 && w.x < EX1 && w.y > E.y0 && w.y < EY1 && opts.onSelectPlot) {
        var col = Math.floor((w.x - E.x0) / E.gap), row = Math.floor((w.y - E.y0) / E.gap);
        var hitPlace = placeHits.some(function (p) { return Math.hypot(p.x - x, p.y - y) < 14; });
        if (!hitPlace) { opts.onSelectPlot(row * E.cols + col); return; }
      }
      placeHits.forEach(function (p) { var dd = Math.hypot(p.x - x, p.y - y); if (dd < bp) { bp = dd; bestPlace = p.id; } });
      if (bestPlace && opts.onSelectPlace) opts.onSelectPlace(bestPlace);
      else if (best && opts.onSelect) opts.onSelect(best);
    });
    zoom.addEventListener('click', function (e) {
      var b = e.target.closest('[data-z]'); if (!b) return;
      var z = +b.getAttribute('data-z');
      if (z === 0) { cam.z = 1.8; centreOn(scene.loc); }
      else { cam.z = Math.max(1, Math.min(3, cam.z + z * 0.5)); if (cam.z === 1) { cam.px = 0; cam.py = 0; } }
      clampCam(); staticKey = ''; kick();
    });
    function centreOn(k) {
      cam.px = 0; cam.py = 0;
      var d = D.DISTRICTS[k], p = toScreen(d.x, d.y, 0);
      cam.px = W / 2 - p.x; cam.py = H / 2 - p.y;
    }
    function clampCam() {
      var lim = (cam.z - 1) * Math.max(W, H) * 0.6;
      cam.px = Math.max(-lim, Math.min(lim, cam.px)); cam.py = Math.max(-lim, Math.min(lim, cam.py));
      if (cam.z === 1) { cam.px = 0; cam.py = 0; }
    }
    function kick() { last = 0; if (reduce) { drawStatic(); drawDynamic(0); } else schedule(); }

    root.addEventListener('resize', function () { if (wrap.isConnected) kick(); });
    // Billboards keep rotating even when motion is reduced (a slow swap, not animation).
    if (reduce) setInterval(function () { if (wrap.isConnected && scene) { drawStatic(); drawDynamic(0); } }, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });

    return {
      el: wrap,
      update: function (next) {
        scene = next;
        theme = readTheme();
        canvas.setAttribute('aria-label', 'Isometric map of Lagos. You are in ' + D.DISTRICTS[next.loc].name + ', ' + next.clock + '. Use the district buttons below to plan a trip.');
        hud.innerHTML = hudHtml();
        resize();
        kick();
      }
    };
  }

  root.LasgidiPlayground = { create: create, isWater: isWater, nearestDistrict: nearestDistrict, ESTATES: ESTATES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
