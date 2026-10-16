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
  var X0 = -2, X1 = 43, Y0 = -1, Y1 = 30, CITY = 'lagos';

  // Land, in km: the mainland, and the Island strip from Lagos Island to Ajah.
  // Everything else is water: the Lagoon between them, the harbour channel,
  // and the Atlantic to the south.
  var MAINLAND = [[-2, -1], [31, -1], [34, 2.5], [32, 5.6], [24, 6.4], [17.4, 6.6], [16.6, 10], [17.2, 14], [17, 17.8], [14.2, 19.4], [11.4, 20.6], [7, 21.2], [2, 20.8], [-2, 20]];
  // Eko Atlantic: reclaimed land off Bar Beach, south of VI, joined to it by a bridge.
  var EKO = [[13.6, 27.9], [19.4, 27.9], [19.8, 28.4], [19.8, 30.6], [13.4, 30.6], [13.2, 28.4]];
  // A white-sand beach on the Ibeju-Lekki coast, south of Ajah and east of the Sea Plots.
  var BEACH = [[40.9, 27.0], [43, 26.5], [49.6, 26.0], [50.4, 26.8], [50.2, 29.6], [41.2, 29.7], [40.8, 28.4]];
  var ISLAND = [[14.4, 21], [17.8, 19.9], [21.6, 19.8], [25.6, 21.4], [33, 22.4], [43, 22.6], [51.4, 22.4], [51.8, 25.8], [43, 26.6], [33, 26.9], [24, 26.9], [20.6, 27.1], [17.6, 26.4], [16, 24.2], [14.2, 22.6]];
  // Lekki Hyde Park's private islet in the lagoon, joined to Billionaire Row by a bridge.
  var HP_ISLET = [[31.9, 21.75], [32.5, 21.55], [33.0, 21.75], [33.0, 22.2], [32.4, 22.35], [31.95, 22.2]];
  var CREEK = [[17.2, 23.1], [21.4, 22.6], [21.6, 23.3], [17.4, 23.8]]; // Five Cowries creek between the Island and VI
  // Each city in its own frame: land polygons, water carved out of them, and the drawing box.
  var GEO = {
    lagos: { box: [-2, 52, -1, 31], land: [MAINLAND, ISLAND, EKO, BEACH, HP_ISLET], water: [CREEK], label: [] },
    abuja: { box: [-3, 35, -3, 28], land: [[[-3, -3], [35, -3], [35, 28], [-3, 28]]],
      water: [[[4.6, 12.8], [6.4, 12.4], [8.8, 12.9], [9.4, 14.0], [8.2, 15.0], [5.6, 14.9], [4.4, 14.0]]], label: [['Jabi Lake', 6.9, 13.8]] },
    ph: { box: [-2, 32, -2, 26], land: [[[-2, -2], [32, -2], [32, 8], [28, 12.5], [25, 17.5], [20.5, 21], [16.5, 21.6], [12, 21.2], [6, 19.8], [-2, 19]]],
      water: [[[22.4, 13.6], [27.2, 12.6], [27.6, 13.4], [22.8, 14.6]]], label: [['Bonny River', 18, 24], ['Amadi Creek', 25.4, 14.6]] }
  };

  // Glass and stone tints for VI's towers, so the skyline isn't one grey wall.
  var TOWER_TINTS = ['#5f8fb8', '#4f9a9a', '#8fa2b3', '#c9b99a', '#e4e6e8', '#3d6e8f', '#7aa7c7'];
  // How each district builds: height range (px), density, footprint, palette.
  var STYLE = {
    vi:       { h: [40, 92], dens: 0.8, r: 3.0, foot: [0.5, 0.62], roof: '#9fb3c4', wall: '#7f93a6', glass: true, spaced: true },
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
    ikorodu:  { h: [3, 6], dens: 0.42, r: 3.2, foot: [0.45, 0.65], roof: '#9a5b3b', wall: '#d2c2a8', trees: 0.3 },
    abj_kubwa:   { h: [3, 7], dens: 0.6, r: 3.2, foot: [0.5, 0.7], roof: '#9a5b3b', wall: '#d8c9ad', trees: 0.15 },
    abj_maitama: { h: [8, 20], dens: 0.4, r: 3.4, foot: [0.5, 0.7], roof: '#c9c2b2', wall: '#efe6d6', trees: 0.4 },
    abj_wuse:    { h: [8, 30], dens: 0.75, r: 3.2, foot: [0.55, 0.75], roof: '#a8826a', wall: '#d6c7ad' },
    abj_jabi:    { h: [6, 16], dens: 0.55, r: 3.0, foot: [0.5, 0.65], roof: '#b9643f', wall: '#e3d6c3', trees: 0.2 },
    abj_asokoro: { h: [7, 14], dens: 0.35, r: 3.4, foot: [0.5, 0.7], roof: '#3d4a52', wall: '#f2ede4', trees: 0.45 },
    abj_garki:   { h: [12, 60], dens: 0.65, r: 3.2, foot: [0.55, 0.75], roof: '#9fb3c4', wall: '#8fa2b3', glass: true },
    abj_nyanya:  { h: [3, 7], dens: 0.85, r: 2.8, foot: [0.65, 0.9], roof: '#8f5a3c', wall: '#c8b79a', market: true },
    abj_airport: { h: [3, 8], dens: 0.2, r: 2.4, foot: [0.6, 0.9], roof: '#b8b0a2', wall: '#d9d3c4' },
    ph_airport:  { h: [3, 8], dens: 0.2, r: 2.4, foot: [0.6, 0.9], roof: '#b8b0a2', wall: '#d9d3c4' },
    ph_choba:    { h: [4, 10], dens: 0.6, r: 3.0, foot: [0.5, 0.7], roof: '#9a5b3b', wall: '#d2c2a8', trees: 0.25 },
    ph_rumuokoro:{ h: [3, 8], dens: 0.85, r: 2.8, foot: [0.65, 0.9], roof: '#3f7f9a', wall: '#c8b79a', market: true },
    ph_gra:      { h: [8, 28], dens: 0.6, r: 3.2, foot: [0.55, 0.75], roof: '#b8b0a2', wall: '#958d7e', trees: 0.2 },
    ph_transamadi:{ h: [6, 14], dens: 0.7, r: 3.2, foot: [0.75, 0.95], roof: '#7c8a8f', wall: '#a7a49c' },
    ph_dline:    { h: [4, 10], dens: 0.9, r: 2.8, foot: [0.65, 0.9], roof: '#8f5a3c', wall: '#bfa58a' },
    ph_oldgra:   { h: [5, 12], dens: 0.6, r: 3.0, foot: [0.55, 0.8], roof: '#9c6a4a', wall: '#cdb69c', trees: 0.3 },
    ph_borokiri: { h: [4, 9], dens: 0.75, r: 2.6, foot: [0.6, 0.85], roof: '#c7a27a', wall: '#a8835c' }
  };
  // Typical share of time each district has light.
  var GRID = { vi: 0.9, ikoyi: 0.95, lekki: 0.75, island: 0.6, ikeja: 0.6, yaba: 0.5, surulere: 0.55, festac: 0.55, ajah: 0.6, mushin: 0.35, oshodi: 0.4, ikorodu: 0.4,
    abj_kubwa: 0.5, abj_maitama: 0.92, abj_wuse: 0.75, abj_jabi: 0.75, abj_asokoro: 0.95, abj_garki: 0.85, abj_nyanya: 0.45, abj_airport: 0.8,
    ph_airport: 0.7, ph_choba: 0.45, ph_rumuokoro: 0.45, ph_gra: 0.75, ph_transamadi: 0.65, ph_dline: 0.4, ph_oldgra: 0.55, ph_borokiri: 0.45 };
  var FERRIES = [['ikorodu', 'island'], ['ikorodu', 'ikoyi'], ['island', 'lekki'], ['ikoyi', 'lekki']];

  function inPoly(x, y, pts) {
    var c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }
  function isWater(x, y, city) {
    var g = GEO[city || CITY];
    for (var i = 0; i < g.water.length; i++) if (inPoly(x, y, g.water[i])) return true;
    return !g.land.some(function (l) { return inPoly(x, y, l); });
  }
  function cityOfDistrict(k) { return (D.DISTRICTS[k] && D.DISTRICTS[k].city) || 'lagos'; }
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
  // Spin and spread. The view turns by any angle about the city's centre, and the land is drawn SPREAD times
  // bigger while buildings, trees and pins keep their size, so places stand further apart. World coordinates, and so
  // every distance, fare and travel time in the game, never change: only the drawing does.
  var ANG = 0, SPREAD = 2, RCX = 0, RCY = 0;
  function rotV(dx, dy) { var c = Math.cos(ANG), s = Math.sin(ANG); return { x: dx * c + dy * s, y: -dx * s + dy * c }; }
  function rot(x, y) { var v = rotV(x - RCX, y - RCY); return { x: SPREAD * (RCX + v.x), y: SPREAD * (RCY + v.y) }; }
  function unrot(vx, vy) { var dx = vx / SPREAD - RCX, dy = vy / SPREAD - RCY, c = Math.cos(ANG), s = Math.sin(ANG); return { x: RCX + dx * c - dy * s, y: RCY + dx * s + dy * c }; }
  function isoR(x, y) { var q = rot(x, y); return iso(q.x, q.y); }
  function depth(x, y) { var q = rot(x, y); return q.x + q.y; }
  function landBox() {
    LAND_BOX = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 };
    tiles.forEach(function (t) {
      [[t.x, t.y], [t.x + 1, t.y], [t.x, t.y + 1], [t.x + 1, t.y + 1]].forEach(function (c) {
        var p = isoR(c[0], c[1]);
        LAND_BOX.minX = Math.min(LAND_BOX.minX, p.x); LAND_BOX.maxX = Math.max(LAND_BOX.maxX, p.x);
        LAND_BOX.minY = Math.min(LAND_BOX.minY, p.y); LAND_BOX.maxY = Math.max(LAND_BOX.maxY, p.y);
      });
    });
  }
  // The corner of every tile nearest the camera, for the current angle (all tiles share it).
  function frontCorner() {
    var cs = [[0, 0], [1, 0], [1, 1], [0, 1]], best = 0, bd = -1e9;
    cs.forEach(function (c, i) { var v = rotV(c[0], c[1]); if (v.x + v.y > bd + 1e-9) { bd = v.x + v.y; best = i; } });
    return best;
  }
  function sortWorld(fast) {
    tiles.sort(function (a, b) { return depth(a.x + 0.5, a.y + 0.5) - depth(b.x + 0.5, b.y + 0.5); });
    buildings.sort(function (a, b) { return depth(a.x, a.y) - depth(b.x, b.y); });
    trees.sort(function (a, b) { return depth(a.x, a.y) - depth(b.x, b.y); });
    if (!fast) landBox();
  }
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = f < 0 ? 0 : 255, p = Math.abs(f);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ---------- world model (built once) ---------- */

  var keys = [];
  function nearestDistrict(x, y, city) {
    var best = null, bd = 1e9;
    (city ? Object.keys(D.DISTRICTS).filter(function (k) { return cityOfDistrict(k) === city; }) : keys).forEach(function (k) {
      var d = D.DISTRICTS[k], dd = Math.hypot(d.x - x, d.y - y);
      if (dd < bd) { bd = dd; best = k; }
    });
    return { k: best, d: bd };
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
  function nearEstate(x, y) { return ESTATES.some(function (e) { return Math.hypot(e.x - x, e.y - y) < e.r + 0.2; }); }
  var E = D.ESTATE, EX1 = E.x0 + E.cols * E.gap, EY1 = E.y0 + E.rows * E.gap;
  // The refinery (Ibeju-Lekki) and new airport (Ikeja, x 0.9–7.9, y 2.1–4.3) pads stay clear of trees and buildings.
  // Landmarks in Abuja and Port Harcourt keep a clear footprint so generated blocks don't cover them.
  var LANDMARKS = {
    abuja: [[23.2, 7.4, 2.2], [0.6, -0.6, 1.6], [18.0, 13.0, 0.8], [13.6, 14.8, 0.6], [16.2, 13.0, 0.5], [10.8, 21.6, 0.6], [11.6, 20.4, 1.0], [20.2, 12.6, 0.7], [17.8, 17.0, 0.5]],
    ph: [[8.6, 3.2, 1.0], [23.8, 12.2, 0.8], [12.6, 13.6, 0.6], [18.6, 18.8, 0.9], [14.6, 20.4, 0.5], [19.4, 9.4, 0.7], [13.8, 9.8, 0.5], [10.8, 12.2, 0.5]]
  };
  function inSite(city, x, y) {
    if (LANDMARKS[city]) return LANDMARKS[city].some(function (m) { return Math.hypot(x - m[0], y - m[1]) < m[2]; });
    return city === 'lagos' && ((x > 43.9 && y > 22.5 && y < 25.3) || (x > 0.6 && x < 8.3 && y > 1.8 && y < 4.6));
  }
  function inMainlandEstate(x, y) { return CITY === 'lagos' && x > E.x0 - 0.3 && x < EX1 + 0.3 && y > E.y0 - 0.3 && y < EY1 + 0.3; }
  function plotXY(n) { return { x: E.x0 + (n % E.cols) * E.gap + E.gap / 2, y: E.y0 + Math.floor(n / E.cols) * E.gap + E.gap / 2 }; }
  function npcPlot(n) { var h = Math.imul((n + 17) * 2654435761, 1597334677) >>> 0; return (h % 100) < 38; }
  var ESTATE_ROOFS = ['#3f8f55', '#2f7a63', '#4a9a5a', '#b44a3a', '#4b4f55', '#2f6fa0'];
  var tiles = [], buildings = [], trees = [], ESTATES = [], LAND_BOX = null;
  var MODELS_REF = null;
  function buildWorld(city) {
  CITY = city; var bx0 = GEO[city].box; X0 = bx0[0]; X1 = bx0[1]; Y0 = bx0[2]; Y1 = bx0[3];
  keys = Object.keys(D.DISTRICTS).filter(function (k) { return cityOfDistrict(k) === city; });
  tiles = []; buildings = []; trees = [];
  for (var ty = Y0; ty < Y1; ty++) {
    for (var tx = X0; tx < X1; tx++) {
      var cx = tx + 0.5, cy = ty + 0.5;
      if (isWater(cx, cy)) continue;
      var nd = nearestDistrict(cx, cy);
      tiles.push({ x: tx, y: ty, k: nd.d < 6 ? nd.k : null, d: nd.d, edgeR: isWater(cx + 1, cy), edgeL: isWater(cx, cy + 1), wat: [isWater(cx + 1, cy), isWater(cx, cy + 1), isWater(cx - 1, cy), isWater(cx, cy - 1)], v: hash(tx, ty, 1), sand: city === 'lagos' && inPoly(cx, cy, BEACH) && !inPoly(cx, cy, ISLAND) });
    }
  }
  // Buildings sit on a finer 0.5 km grid. SPACING thins every district and FOOT trims footprints, so streets and yards show between blocks.
  var SPACING = 0.72, FOOT = 0.82;
  var SUB = 0.5;
  for (var by = Y0; by < Y1; by += SUB) {
    for (var bx = X0; bx < X1; bx += SUB) {
      var px = bx + SUB / 2, py = by + SUB / 2, ix = Math.round(bx * 2), iy = Math.round(by * 2);
      if (isWater(px, py) || isWater(px + 0.3, py) || isWater(px, py + 0.3)) continue;
      var n2 = nearestDistrict(px, py), st = STYLE[n2.k];
      var fall = Math.max(0, 1 - n2.d / st.r);
      if (fall <= 0) { if (hash(ix, iy, 9) < 0.07) trees.push({ x: px, y: py, s: 0.8 + hash(ix, iy, 4) * 0.6 }); continue; }
      if (st.trees && hash(ix, iy, 7) < st.trees * 0.5) { trees.push({ x: px, y: py, s: 0.8 + hash(ix, iy, 8) * 0.4 }); continue; }
      if (hash(ix, iy, 5) > st.dens * SPACING * Math.min(1, fall * 1.8)) continue;
      if (n2.d < 0.75) continue; // keep the centre clear for the district pin
      // Spaced districts (VI's towers) take one plot in four, so each tower stands clear with street between.
      if (st.spaced && ((ix & 1) || (iy & 1))) continue;
      var tower = st.towers && hash(ix, iy, 11) < st.towers;
      var core = Math.pow(fall, 0.8);
      var h = tower ? 30 + hash(ix, iy, 12) * 26 : st.h[0] + (st.h[1] - st.h[0]) * Math.pow(hash(ix, iy, 6), 1.4) * (0.45 + core * 0.55);
      var f = (st.rows ? st.foot[0] : st.foot[0] + (st.foot[1] - st.foot[0]) * hash(ix, iy, 13)) * SUB * (st.spaced ? 1.5 : FOOT);
      buildings.push({ x: px, y: py, w: f, dep: st.market ? f : f * (0.8 + hash(ix, iy, 14) * 0.4), h: h, k: n2.k,
        roof: st.market && hash(ix, iy, 15) < 0.6 ? ['#c44b3a', '#2f6fa0', '#d9a520', '#3f8f55'][Math.floor(hash(ix, iy, 16) * 4)] : (hash(ix, iy, 18) < 0.25 ? shadeHex(st.roof, 0.12) : st.roof),
        wall: tower ? '#8fa2b3' : st.spaced ? TOWER_TINTS[Math.floor(hash(ix, iy, 19) * TOWER_TINTS.length)] : st.wall, glass: st.glass || tower, tall: st.spaced || tower, seed: hash(ix, iy, 17) });
    }
  }
  ESTATES = Object.keys(D.HOMES).filter(function (k) { return !D.HOMES[k].hidden && !D.HOMES[k].beach && !D.HOMES[k].hydepark && D.HOMES[k].x != null && cityOfDistrict(D.HOMES[k].district) === city; }).map(function (k) {
    var h = D.HOMES[k], m = MODELS[h.type] || MODELS.room;
    return { id: k, x: h.x, y: h.y, type: h.type, k: h.district, m: m, r: Math.max(0.45, (Math.max(m.n[0], m.n[1]) * Math.max(m.gap, m.w)) / 2 + 0.25) };
  });
  buildings = buildings.filter(function (b) { return !nearEstate(b.x, b.y) && !inMainlandEstate(b.x, b.y); });
  trees = trees.filter(function (t) { return !nearEstate(t.x, t.y) && !inMainlandEstate(t.x, t.y) && !inSite(city, t.x, t.y); });
  buildings = buildings.filter(function (b) { return !inSite(city, b.x, b.y) && !(city === 'lagos' && inPoly(b.x, b.y, EKO)); });
  trees = trees.filter(function (t) { return !(city === 'lagos' && (inPoly(t.x, t.y, EKO) || inPoly(t.x, t.y, BEACH))); });
  buildings = buildings.filter(function (b) { return !(city === 'lagos' && inPoly(b.x, b.y, BEACH)); });
  if (city === 'lagos') {
    // Lekki Hyde Park: clear the box, then lay out each zone's houses in rows.
    var HB = D.HYDE_PARK.box, inHP = function (x, y) { return (x > HB[0] - 0.1 && x < HB[2] + 0.1 && y > HB[1] - 0.1 && y < HB[3] + 0.35) || inPoly(x, y, HP_ISLET); };
    buildings = buildings.filter(function (b) { return !inHP(b.x, b.y); });
    trees = trees.filter(function (t) { return !inHP(t.x, t.y); });
    var hpRoof = ['#3f8f55', '#2f7a63', '#4a9a5a', '#2f6fa0'];
    for (var ti = 0; ti < 8; ti++) buildings.push({ x: 31.05 + ti * 0.2, y: 23.72, w: 0.16, dep: 0.26, h: 7, k: 'lekki', roof: hpRoof[ti % 2], wall: '#f3efe6', seed: hash(ti, 3, 41) }); // Garden Row terraces
    for (var si = 0; si < 5; si++) buildings.push({ x: 32.25 + si * 0.17, y: 23.42, w: 0.13, dep: 0.22, h: 8, k: 'lekki', roof: '#2f7a63', wall: '#efe9dc', seed: hash(si, 4, 41) }), buildings.push({ x: 32.25 + si * 0.17, y: 23.68, w: 0.13, dep: 0.22, h: 8, k: 'lekki', roof: '#4a9a5a', wall: '#efe9dc', seed: hash(si, 5, 41) }); // Park Crescent semis
    for (var vi2 = 0; vi2 < 3; vi2++) buildings.push({ x: 32.25 + vi2 * 0.3, y: 22.9, w: 0.22, dep: 0.22, h: 11, k: 'lekki', roof: '#2f6fa0', wall: '#ffffff', glass: true, seed: hash(vi2, 6, 41) }); // Celebrity Row villas
    for (var bi2 = 0; bi2 < 3; bi2++) buildings.push({ x: 31.15 + bi2 * 0.32, y: 22.88, w: 0.26, dep: 0.26, h: 12, k: 'lekki', roof: '#3d4a52', wall: '#f7f3ea', seed: hash(bi2, 7, 41) }); // Billionaire Row mansions
    buildings.push({ x: 32.45, y: 21.95, w: 0.32, dep: 0.28, h: 14, k: 'lekki', roof: '#2f6fa0', wall: '#ffffff', glass: true, seed: hash(1, 8, 41) }); // the islet villa
    [[31.95, 23.5], [32.05, 23.2], [31.2, 23.3], [31.6, 23.3], [33.0, 23.0], [32.8, 22.2], [32.1, 21.9]].forEach(function (p, i) { trees.push({ x: p[0], y: p[1], s: 0.9 + (i % 3) * 0.1, palm: i % 2 === 0 }); });
    // Ten beach houses facing the sea, with palms between them.
    var bh = ['#2fa3a3', '#c0603f', '#3f78b0', '#d9a520', '#2f8f5a'];
    for (var hi = 0; hi < 10; hi++) {
      var hx = 41.9 + hi * 0.83;
      buildings.push({ x: hx, y: 27.35, w: 0.46, dep: 0.4, h: 7 + (hi % 3), k: 'ajah', roof: bh[hi % bh.length], wall: '#fbfaf6', seed: hash(hi, 9, 31) });
      trees.push({ x: hx + 0.42, y: 27.75, s: 1, palm: true });
    }
    for (var pi = 0; pi < 8; pi++) trees.push({ x: 41.6 + pi * 1.1, y: 29.3, s: 0.9, palm: true });
  }
  if (city === 'lagos') {
    // Eko Atlantic: a row of glass towers on the waterfront, the boulevard, then streets of villas, all spaced out.
    var tints = ['#5f8fb8', '#4f9a9a', '#e4e6e8', '#3d6e8f', '#7aa7c7', '#c9b99a'];
    for (var ex = 14.3, ei = 0; ex < 19.4; ex += 1.25, ei++) {
      buildings.push({ x: ex, y: 28.45, w: 0.5, dep: 0.45, h: 34 + hash(ei, 3, 21) * 26, k: 'vi', roof: '#9fb3c4', wall: tints[ei % tints.length], glass: true, tall: true, seed: hash(ei, 3, 22) });
    }
    var vroofs = ['#b9643f', '#3f6f8f', '#7a8f3f', '#8f3f5a', '#c9a227'];
    for (var vy = 29.7, vr = 0; vy < 30.45; vy += 0.6, vr++) {
      for (var vx = 13.95, vc = 0; vx < 19.6; vx += 0.62, vc++) {
        buildings.push({ x: vx, y: vy, w: 0.4, dep: 0.34, h: 3.5 + hash(vc, vr, 23) * 1.5, k: 'vi', roof: vroofs[Math.floor(hash(vc, vr, 24) * vroofs.length)], wall: '#f2efe8', pitch: true, rise: 3.5, seed: hash(vc, vr, 25) });
      }
    }
    for (var px2 = 13.95; px2 < 19.6; px2 += 0.7) trees.push({ x: px2, y: 29.18, s: 0.9, palm: true });
  }
  ESTATES.forEach(function (e, ei) {
    var m = e.m, nx = m.n[0], ny = m.n[1];
    for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) {
      var bx = e.x + (i - (nx - 1) / 2) * m.gap, by = e.y + (j - (ny - 1) / 2) * m.gap;
      buildings.push({ x: bx, y: by, w: m.w, dep: m.d, h: m.h[0] + (m.h[1] - m.h[0]) * hash(ei, i * 7 + j, 51), k: e.k, estate: e.id,
        roof: m.roof[(i + j) % m.roof.length], wall: m.wall, glass: m.glass, pitch: m.pitch });
    }
  });
  RCX = (X0 + X1) / 2; RCY = (Y0 + Y1) / 2;
  sortWorld();
  // The Sea Plots grid is not part of the fit: the frame fits the land, so the city fills the map.
  if (false && city === 'lagos' && D.SEA) {
    var S0 = D.SEA, sx1 = S0.x0 + S0.cols * S0.gap, sy1 = S0.y0 + S0.rows * S0.gap;
    [[S0.x0, S0.y0], [sx1, S0.y0], [S0.x0, sy1], [sx1, sy1]].forEach(function (c) {
      var p = iso(c[0], c[1]);
      LAND_BOX.minX = Math.min(LAND_BOX.minX, p.x); LAND_BOX.maxX = Math.max(LAND_BOX.maxX, p.x);
      LAND_BOX.minY = Math.min(LAND_BOX.minY, p.y); LAND_BOX.maxY = Math.max(LAND_BOX.maxY, p.y);
    });
  }

  }
  buildWorld('lagos');

  // Landmarks drawn into the static layer.
  var RUNWAY = [[3.2, 0.6], [9.6, 0.2], [9.8, 1.0], [3.4, 1.4]];
  var STADIUM = { x: 9.2, y: 16.6, rx: 0.9, ry: 0.7 };
  // Tap areas for places, in world km: the big landmarks use their drawn shape; every other place gets a circle round its pin.
  var AREAS = {
    white_sand_beach: { r: [41.0, 26.85, 50.8, 29.95] }, refinery_site: { r: [44.2, 22.8, 51.0, 24.9] }, new_airport_site: { r: [0.9, 2.1, 7.9, 4.3] },
    airport: { p: [[3.2, 0.6], [9.6, 0.2], [9.8, 1.0], [3.4, 1.4]] }, stadium: { e: [9.2, 16.6, 0.95, 0.75] },
    eko_atlantic_city: { p: [[13.6, 27.9], [19.4, 27.9], [19.8, 28.4], [19.8, 30.6], [13.4, 30.6], [13.2, 28.4]] }
  };
  var AREA_R = { outdoors: 0.55, transport: 0.45, culture: 0.4, food: 0.4, nightlife: 0.35, learn: 0.35, services: 0.35 };
  function inPoly(x, y, pts) { var c = false; for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) { var a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function inArea(A, x, y) { return A.r ? x >= A.r[0] && x <= A.r[2] && y >= A.r[1] && y <= A.r[3] : A.p ? inPoly(x, y, A.p) : A.e ? Math.pow((x - A.e[0]) / A.e[2], 2) + Math.pow((y - A.e[1]) / A.e[3], 2) <= 1 : false; }
  // The place whose area holds world point w: a drawn landmark first, else the nearest pin whose circle holds it.
  function placeAreaAt(places, w) {
    var hit = null, bd = 1e9;
    places.forEach(function (pl) { if (AREAS[pl.id] && inArea(AREAS[pl.id], w.x, w.y)) hit = hit || pl.id; });
    if (hit) return hit;
    places.forEach(function (pl) { var d = Math.hypot(pl.x - w.x, pl.y - w.y); if (d <= (AREA_R[pl.type] || 0.35) && d < bd) { bd = d; hit = pl.id; } });
    return hit;
  }
  // The Ibeju-Lekki refinery east of Ajah, and the new international airport (laid out here, drawn in Ikeja).
  var REFINERY = { x0: 44.2, y0: 22.8, x1: 51.0, y1: 24.9 }, NEW_AIRPORT = { x0: 44.2, y0: 25.1, x1: 51.2, y1: 27.3 }, AIRPORT_AT = { x: 0.9, y: 2.1 };

  /* ---------- the playground ---------- */

  // Picture ads: decode each validated data URL once and keep it.
  var PICS = {};
  function picImage(src) {
    if (PICS[src]) return PICS[src];
    var keys = Object.keys(PICS); if (keys.length > 40) delete PICS[keys[0]];
    var im = new Image(); im.decoding = 'async'; im.src = src; PICS[src] = im;
    return im;
  }

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
    zoom.innerHTML = '<button type="button" class="pg-zbtn" data-z="full" aria-label="Enlarge map" aria-pressed="false">⛶</button><button type="button" class="pg-zbtn" data-z="1" aria-label="Zoom in">+</button><button type="button" class="pg-zbtn" data-z="-1" aria-label="Zoom out">−</button><button type="button" class="pg-zbtn" data-z="0" aria-label="Centre on me">◎</button><button type="button" class="pg-zbtn" data-spin="-1" aria-label="Spin the map left">⟲</button><button type="button" class="pg-zbtn" data-spin="1" aria-label="Spin the map right">⟳</button><button type="button" class="pg-zbtn" data-photo="map" aria-label="Take a photo of the map">📷</button>';
    canvas.tabIndex = 0;
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
    try { var sp0 = parseFloat(root.localStorage && root.localStorage.getItem('lasgidi.spin.v2')); if (isFinite(sp0) && sp0) { ANG = sp0; sortWorld(); } } catch (e) {}
    var opened = false, OPEN_ZOOM = 4;
    // 3D icon pictures (src/icons.js), drawn inside the pins when they have loaded.
    var ICON_IMG = {};
    function iconImg(key) {
      var src = key && root.LASGIDI_ICONS && root.LASGIDI_ICONS[key];
      if (!src) return null;
      var im = ICON_IMG[key];
      if (!im) { im = ICON_IMG[key] = new Image(); im.onload = function () { staticKey = ''; kick(); }; im.src = src; }
      return im.complete && im.naturalWidth ? im : null;
    }
    var MODE_ICON = { danfo: 'bus', brt: 't_brt', cab: 't_taxi', keke: 't_keke', okada: 't_okada', car: 'car', ferry: 'boat', boat: 't_speedboat', heli: 't_heli', trek: 't_walk', rail: 't_train', plane: 'plane' };
    var lite = !!(root.document && document.documentElement.classList.contains('lite'));
    var reduce = (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) || lite;
    var raf = 0, last = 0, clock = 0;
    var vehicles = [], boats = [];
    var pins = [], faceBoxes = [], placeHits = [], boardHits = [], homeHits = [], playerHits = [];
    var HOME_ICON = { room: '🛏️', share: '👥', selfcon: '🚪', miniflat: '🏠', flat2: '🏢', flat3: '🏢', duplex: '🏡', luxury: '🌆', mansion: '🏰' };

    // Vehicles: danfos on roads, ferries on the lagoon.
    function cityRoads() { return D.ROADS.filter(function (r) { return cityOfDistrict(r[0]) === CITY; }); }
    function rebuildTraffic() {
      vehicles = []; boats = [];
      cityRoads().forEach(function (r, i) {
        for (var n = 0; n < 2; n++) vehicles.push({ a: r[0], b: r[1], t: hash(i, n, 21), dir: n ? -1 : 1, kind: hash(i, n, 22) < 0.7 ? 'danfo' : 'car' });
      });
      if (CITY === 'lagos') FERRIES.forEach(function (r, i) { boats.push({ a: r[0], b: r[1], t: hash(i, 3, 23), dir: 1 }); });
    }
    rebuildTraffic();

    function readTheme() {
      var cs = getComputedStyle(document.documentElement);
      var get = function (n, f) { return (cs.getPropertyValue(n) || '').trim() || f; };
      var paper = get('--paper', '#f4f3ec');
      var dark = (function () { var c = paper.replace('#', ''); if (c.length !== 6) return false; var n = parseInt(c, 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) < 100; })();
      return {
        dark: dark, paper: paper, ink: get('--ink', '#17181a'), danfo: get('--danfo', '#f2b600'), danfoInk: get('--danfo-ink', '#1a1500'),
        lagoon: get('--lagoon', '#0f6f78'), surface: get('--surface', '#ffffff'), muted: get('--muted', '#5d5f63'),
        water: dark ? '#0f3a63' : '#4fb4ec', waterDeep: dark ? '#0b2e52' : '#2f95d6', waterTop: dark ? '#14467a' : '#6cc6f2', sand: dark ? '#8f8873' : '#f7f1de',
        land: dark ? '#2d3a2b' : '#c9d6a9', land2: dark ? '#344331' : '#bfcf9b', soil: dark ? '#3b3a30' : '#d9cfb0',
        side: dark ? '#1c231a' : '#8c9a6c', road: dark ? '#4a4d52' : '#6b6f75', roadLine: dark ? '#8a8d91' : '#e8e6dc',
        tree: dark ? '#2f5a33' : '#4f8a46'
      };
    }

    function resize() {
      var r = wrap.getBoundingClientRect();
      var full = wrap.classList.contains('pg-full') || wrap.classList.contains('pg-fit'); // pg-fit: the page sets the map's height (fills the window)
      var w = Math.max(240, Math.round(r.width)), h = full ? Math.max(200, Math.round(r.height)) : Math.max(200, Math.round(w * (w < 600 ? 1.15 : 0.85)));
      dpr = Math.min(w < 600 ? 1.5 : 2, root.devicePixelRatio || 1); // cheap phones: fewer pixels to fill
      if (w === W && h === H && canvas.width === Math.round(w * dpr)) return false;
      var keep = opened && W ? fromScreen(W / 2, H / 2) : null; // the page resized the map: keep the same spot in the middle
      W = w; H = h;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.height = full ? '100%' : H + 'px';
      // Fit the land (not the empty sea corners), leaving room for the HUD.
      var minX = LAND_BOX.minX, maxX = LAND_BOX.maxX, minY = LAND_BOX.minY - 70, maxY = LAND_BOX.maxY + 6;
      base.s = Math.min(W / (maxX - minX), H / (maxY - minY)) * 0.97;
      base.ox = W / 2 - (minX + maxX) / 2 * base.s;
      base.oy = H / 2 - (minY + maxY) / 2 * base.s;
      if (keep) { var kp = toScreen(keep.x, keep.y, 0); cam.px += W / 2 - kp.x; cam.py += H / 2 - kp.y; clampCam(); }
      staticKey = '';
      return true;
    }

    function fromScreen(sx, sy) {
      var sc = base.s * cam.z;
      var ix = (sx - base.ox * cam.z + (W / 2) * (cam.z - 1) - cam.px) / sc;
      var iy = (sy - base.oy * cam.z + (H / 2) * (cam.z - 1) - cam.py) / sc;
      var a = ix / (TW / 2), b = iy / (TH / 2);
      return unrot((a + b) / 2, (b - a) / 2);
    }
    function toScreen(x, y, z) {
      var p = isoR(x, y), s = base.s * cam.z;
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
      var key = [CITY, W, H, dpr, cam.z, cam.px | 0, cam.py | 0, theme.dark, Math.round(night * 10), JSON.stringify(power), scene.flood ? 1 : 0, scene.myPlot, scene.plotSel, JSON.stringify(scene.plotOwners || {})].join('|');
      if (key === staticKey && staticLayer) return;
      staticKey = key;
      if (!staticLayer) staticLayer = document.createElement('canvas');
      staticLayer.width = canvas.width; staticLayer.height = canvas.height;
      var g = staticLayer.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var s = base.s * cam.z;

      // Water.
      var wg = g.createLinearGradient(0, 0, 0, H); wg.addColorStop(0, theme.waterTop); wg.addColorStop(1, theme.waterDeep);
      g.fillStyle = wg; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,' + (theme.dark ? 0.12 : 0.28) + ')';
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
      // Tile corners c0 (x,y) c1 (x+1,y) c2 (x+1,y+1) c3 (x,y+1); edge i runs ci→c(i+1) and borders the N, E, S, W neighbour.
      var fc = frontCorner(), EDGE_NB = [3, 0, 1, 2];
      var eA = fc, eB = (fc + 3) % 4; // the two edges that meet at the front corner
      tiles.forEach(function (t) {
        var w = [[t.x, t.y], [t.x + 1, t.y], [t.x + 1, t.y + 1], [t.x, t.y + 1]].map(function (c) { return toScreen(c[0], c[1], 0); });
        g.beginPath(); g.moveTo(w[0].x, w[0].y); g.lineTo(w[1].x, w[1].y); g.lineTo(w[2].x, w[2].y); g.lineTo(w[3].x, w[3].y); g.closePath();
        // pts: [far, right neighbour, front, left neighbour] in screen terms, as the cliff code below expects.
        var f0 = w[fc], na = w[(fc + 1) % 4], nb = w[(fc + 3) % 4], rightA = na.x > nb.x;
        var pts = [w[(fc + 2) % 4], rightA ? na : nb, f0, rightA ? nb : na];
        var wA = t.wat ? t.wat[EDGE_NB[eA]] : false, wB = t.wat ? t.wat[EDGE_NB[eB]] : false;
        var eR = rightA ? wA : wB, eL = rightA ? wB : wA;
        var fill = t.sand ? theme.sand : t.k ? (t.d < (STYLE[t.k].r - 0.6) ? theme.soil : theme.land) : theme.land2;
        if (scene.flood && t.k && D.DISTRICTS[t.k].side === 'island' && t.v < 0.55) fill = theme.water;
        g.fillStyle = t.v < 0.5 ? fill : shade(fill.charAt(0) === '#' ? fill : '#888888', theme.dark ? 0.03 : -0.03);
        g.fill();
        if (eR) {
          var b = pts[1], c = pts[2];
          g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(c.x, c.y + cliff * s); g.lineTo(b.x, b.y + cliff * s); g.closePath();
          g.fillStyle = theme.side; g.fill();
        }
        if (eL) {
          var c2 = pts[2], d2 = pts[3];
          g.beginPath(); g.moveTo(d2.x, d2.y); g.lineTo(c2.x, c2.y); g.lineTo(c2.x, c2.y + cliff * s); g.lineTo(d2.x, d2.y + cliff * s); g.closePath();
          g.fillStyle = shade(theme.side.charAt(0) === '#' ? theme.side : '#666666', -0.15); g.fill();
        }
      });

      // Airport runway near Ikeja and the National Stadium in Surulere.
      if (CITY === 'lagos') {
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
      // Private jet hangar and a helipad at the east end of the runway.
      poly(g, [[8.3, 1.15], [9.7, 1.1], [9.75, 1.85], [8.35, 1.9]], theme.road);
      drawBuilding(g, { x: 8.55, y: 1.5, w: 0.8, dep: 0.35, h: 6, wall: '#e8e6df', roof: '#8a9199' }, s, 0, true);
      var hp = toScreen(9.45, 1.55, 0);
      g.beginPath(); g.ellipse(hp.x, hp.y, 0.22 * TW * s, 0.22 * TH * s, 0, 0, Math.PI * 2); g.fillStyle = '#3d4248'; g.fill();
      g.lineWidth = Math.max(0.6, 0.8 * s); g.strokeStyle = '#f5c518'; g.stroke();
      g.fillStyle = '#ffffff'; g.font = '700 ' + Math.max(6, 7 * s) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', hp.x, hp.y);
      drawRefinery(g, s); drawNewAirport(g, s); drawEko(g, s); drawBeach(g, s);
      drawHydePark(g, s);
      // Members' clubs: a timber jetty into the water with boats tied up.
      [[21.4, 20.6, -1], [19.9, 20.7, -1], [14.2, 29.4, 1], [18.9, 29.6, 1]].forEach(function (c) {
        var y0 = c[1] + c[2] * 0.25, y1 = c[1] + c[2] * 1.0;
        poly(g, [[c[0] - 0.06, Math.min(y0, y1)], [c[0] + 0.06, Math.min(y0, y1)], [c[0] + 0.06, Math.max(y0, y1)], [c[0] - 0.06, Math.max(y0, y1)]], theme.dark ? '#6b5640' : '#a07a4f');
        [[0.25, 0.55], [-0.25, 0.75], [0.25, 0.95]].forEach(function (b, i) {
          var q = toScreen(c[0] + b[0], c[1] + c[2] * b[1], 0);
          g.beginPath(); g.ellipse(q.x, q.y, 5 * s, 2 * s, -0.45, 0, Math.PI * 2); g.fillStyle = ['#ffffff', '#f2efe6', '#2f6fa0'][i]; g.fill();
          g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = Math.max(0.4, 0.5 * s); g.stroke();
          g.fillStyle = '#9fc4dc'; g.fillRect(q.x - 1.5 * s, q.y - 2.5 * s, 3 * s, 1.6 * s);
        });
      });
      }
      if (CITY === 'abuja') drawAbuja(g, s);
      if (CITY === 'ph') drawPH(g, s);

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
      if (CITY === 'lagos') (function () {
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
      cityRoads().forEach(function (r) {
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
      (CITY === 'lagos' ? FERRIES : []).forEach(function (r) {
        var a = D.DISTRICTS[r[0]], b = D.DISTRICTS[r[1]], p = toScreen(a.x, a.y, 0), q = toScreen(b.x, b.y, 0);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
      });
      g.setLineDash([]);
      // Rail lines: a coloured track with sleepers, and a station dot at each stop.
      if (CITY === 'lagos' && D.RAIL_LINES) Object.keys(D.RAIL_LINES).forEach(function (k) {
        var Ln = D.RAIL_LINES[k], pts = Ln.stops.map(function (d) { var a = D.DISTRICTS[d]; return toScreen(a.x + 0.35, a.y + 0.35, 0); });
        g.strokeStyle = Ln.color; g.lineWidth = Math.max(2.5, 3.2 * s); g.globalAlpha = 0.9;
        g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.stroke();
        g.lineWidth = Math.max(0.6, 0.8 * s); g.setLineDash([1 * s, 4 * s]); g.strokeStyle = theme.dark ? '#111' : '#fff';
        g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.stroke(); g.setLineDash([]);
        g.globalAlpha = 1; g.fillStyle = Ln.color;
        pts.forEach(function (p) { g.beginPath(); g.arc(p.x, p.y, Math.max(3, 3.6 * s), 0, Math.PI * 2); g.fill(); });
      });

      // Road names along the roads; minor roads and streets appear as you zoom in.
      g.textAlign = 'center'; g.textBaseline = 'middle';
      cityRoads().forEach(function (r) {
        var name = D.ROAD_NAMES[r[0] + '-' + r[1]];
        if (!name || (cam.z < 1.4 && D.MAJOR_ROADS.indexOf(name) < 0)) return;
        var a = D.DISTRICTS[r[0]], b = D.DISTRICTS[r[1]];
        groundText(g, name, (a.x + b.x) / 2, (a.y + b.y) / 2, b.x - a.x, b.y - a.y, D.MAJOR_ROADS.indexOf(name) >= 0 ? 0.55 : 0.42, theme.dark ? 'rgba(235,235,225,.85)' : 'rgba(40,42,46,.85)', true);
      });
      if (cam.z >= 1.6 && CITY === 'lagos') {
        D.STREETS.forEach(function (st) {
          var p = toScreen(st.a[0], st.a[1], 0), q = toScreen(st.b[0], st.b[1], 0);
          g.strokeStyle = theme.road; g.lineWidth = Math.max(1.2, 1.6 * s); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
          groundText(g, st.name, (st.a[0] + st.b[0]) / 2, (st.a[1] + st.b[1]) / 2, st.b[0] - st.a[0], st.b[1] - st.a[1], 0.3, theme.dark ? 'rgba(235,235,225,.8)' : 'rgba(40,42,46,.8)', true);
        });
      }
      // Area names painted on the ground.
      D.AREA_LABELS.filter(function (l) { return (l[4] || 'lagos') === CITY; }).forEach(function (l) {
        groundText(g, l[0], l[1], l[2], 1, 0, l[3], theme.dark ? 'rgba(255,255,255,.3)' : 'rgba(30,60,30,.34)', false, true);
      });

      // Water labels.
      g.fillStyle = theme.dark ? 'rgba(160,210,214,.55)' : 'rgba(15,111,120,.55)';
      g.font = 'italic 600 ' + Math.max(9, 11 * Math.min(1.4, s)) + 'px ' + 'Atkinson Hyperlegible, sans-serif';
      g.textAlign = 'center';
      if (CITY === 'lagos') {
        var lg = toScreen(30, 13.5, 0); g.fillText('LAGOS  LAGOON', lg.x, lg.y);
        var oc = toScreen(37, 29.6, 0); g.fillText('ATLANTIC  OCEAN', oc.x, oc.y);
        var hb = toScreen(11.5, 24.5, 0); g.fillText('HARBOUR', hb.x, hb.y);
      }
      GEO[CITY].label.forEach(function (l) { var q = toScreen(l[1], l[2], 0); g.fillText(l[0].toUpperCase(), q.x, q.y); });

      // Trees and buildings, back to front.
      var houses = [];
      for (var pn = 0; CITY === 'lagos' && pn < E.cols * E.rows; pn++) {
        if (!(npcPlot(pn) || (scene.plotOwners && scene.plotOwners[pn]) || scene.myPlot === pn)) continue;
        var pp = plotXY(pn);
        houses.push({ x: pp.x, y: pp.y, w: E.gap * 0.5, dep: E.gap * 0.42, h: 7 + hash(pn, 3, 61) * 3, k: E.district, pitch: true,
          roof: scene.myPlot === pn ? '#f2b600' : ESTATE_ROOFS[Math.floor(hash(pn, 4, 62) * ESTATE_ROOFS.length)], wall: '#efe9dc' });
      }
      var items = trees.map(function (t) { return { tree: t, z: depth(t.x, t.y) }; }).concat(buildings.concat(houses).map(function (b) { return { b: b, z: depth(b.x, b.y) }; }));
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

    /* ---------- construction sites (drawn from simple shapes, no images) ---------- */
    function poly(g, pts, fill, stroke, lw) {
      g.beginPath(); pts.forEach(function (c, i) { var q = toScreen(c[0], c[1], c[2] || 0); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    }
    // A site pad: sand with a dashed orange fence while building, or mown grass once done.
    function sitePad(g, s, R, done) {
      var sand = done ? (theme.dark ? '#33493a' : '#9cc58a') : theme.dark ? '#4a4538' : '#d9cfb4';
      poly(g, [[R.x0, R.y0], [R.x1, R.y0], [R.x1, R.y1], [R.x0, R.y1]], sand);
      if (done) return;
      g.setLineDash([2 * s, 2 * s]); poly(g, [[R.x0, R.y0], [R.x1, R.y0], [R.x1, R.y1], [R.x0, R.y1]], null, '#e2652b', Math.max(1, 1.2 * s)); g.setLineDash([]);
    }
    // A vertical cylinder at (x, y): radius in km, height in px (scaled). frame = only rings and struts (under construction).
    function cyl(g, s, x, y, r, h, col, frame, rings) {
      var c = toScreen(x, y, 0), rx = r * TW * s * 0.5, ry = r * TH * s * 0.5, up = h * s;
      if (!frame) {
        g.fillStyle = shade(col, -0.18); g.fillRect(c.x - rx, c.y - up, rx * 2, up);
        g.beginPath(); g.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI); g.fill();
        g.beginPath(); g.ellipse(c.x, c.y - up, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = col; g.fill();
        g.strokeStyle = shade(col, -0.35); g.lineWidth = Math.max(0.5, 0.6 * s); g.stroke();
      } else {
        g.strokeStyle = theme.dark ? '#9aa0a6' : '#7b8087'; g.lineWidth = Math.max(0.5, 0.5 * s);
        for (var k = 0; k <= 3; k++) { g.beginPath(); g.ellipse(c.x, c.y - up * k / 3, rx, ry, 0, 0, Math.PI * 2); g.stroke(); }
        for (var a = 0; a < 8; a++) { var dx = Math.cos(a * Math.PI / 4) * rx, dy = Math.sin(a * Math.PI / 4) * ry; g.beginPath(); g.moveTo(c.x + dx, c.y + dy); g.lineTo(c.x + dx, c.y + dy - up); g.stroke(); }
      }
      if (rings) { g.strokeStyle = rings; g.lineWidth = Math.max(0.8, 1 * s); for (var i = 1; i < 6; i++) { g.beginPath(); g.ellipse(c.x, c.y - up * i / 6, rx * 1.15, ry * 1.15, 0, 0, Math.PI * 2); g.stroke(); } }
    }
    // A two-post sign board: yellow site board, or (done) a navy gateway board with one white line.
    function sign(g, s, x, y, l1, l2, done) {
      var c = toScreen(x, y, 0), w = 34 * s, h = 7.5 * s;
      g.fillStyle = '#17181a'; g.fillRect(c.x - w / 2 + 1 * s, c.y - h - 3 * s, 0.8 * s, h + 3 * s); g.fillRect(c.x + w / 2 - 2 * s, c.y - h - 3 * s, 0.8 * s, h + 3 * s);
      g.fillStyle = done ? '#1f3b63' : '#f2c200'; g.fillRect(c.x - w / 2, c.y - h - 4 * s, w, h);
      g.fillStyle = done ? '#ffffff' : '#17181a'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (done) { g.font = '800 ' + Math.max(5, 2.8 * s) + 'px sans-serif'; g.fillText(l1, c.x, c.y - h - 4 * s + h * 0.5); return; }
      g.font = '800 ' + Math.max(5, 2.6 * s) + 'px sans-serif'; g.fillText(l1, c.x, c.y - h - 4 * s + h * 0.33);
      g.font = '900 ' + Math.max(5, 2.9 * s) + 'px sans-serif'; g.fillText(l2, c.x, c.y - h - 4 * s + h * 0.72);
    }
    // A rock massif: a lumpy mound with a lit face and a shadow face.
    function rock(g, s, x, y, rx, h, col) {
      var c = toScreen(x, y, 0), w = rx * TW * s * 0.5, up = h * s;
      var gr = g.createLinearGradient(c.x - w, 0, c.x + w, 0); gr.addColorStop(0, shade(col, 0.15)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.35));
      g.beginPath(); g.moveTo(c.x - w, c.y);
      g.bezierCurveTo(c.x - w * 0.95, c.y - up * 0.7, c.x - w * 0.45, c.y - up * 1.05, c.x - w * 0.05, c.y - up);
      g.bezierCurveTo(c.x + w * 0.4, c.y - up * 0.98, c.x + w * 0.9, c.y - up * 0.6, c.x + w, c.y);
      g.closePath(); g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = Math.max(0.5, 0.6 * s);
      for (var k = 1; k < 4; k++) { g.beginPath(); g.moveTo(c.x - w * (0.6 - k * 0.15), c.y - up * (0.9 - k * 0.1)); g.quadraticCurveTo(c.x - w * (0.4 - k * 0.2), c.y - up * 0.4, c.x - w * (0.5 - k * 0.25), c.y - 2 * s); g.stroke(); }
    }
    function bowl(g, s, x, y, rx, ry, pitch) {
      var sc = toScreen(x, y, 0);
      g.beginPath(); g.ellipse(sc.x, sc.y, rx * TW * s * 0.5, ry * TH * s * 0.5, 0, 0, Math.PI * 2); g.fillStyle = theme.dark ? '#7b7f86' : '#d8d4c8'; g.fill();
      g.beginPath(); g.ellipse(sc.x, sc.y - 1.5 * s, rx * TW * s * 0.36, ry * TH * s * 0.36, 0, 0, Math.PI * 2); g.fillStyle = pitch || (theme.dark ? '#3c6a3a' : '#6aa357'); g.fill();
      g.lineWidth = Math.max(1, 2.4 * s); g.strokeStyle = theme.dark ? '#9aa0a6' : '#b8b2a2'; g.beginPath(); g.ellipse(sc.x, sc.y - 2 * s, rx * TW * s * 0.5, ry * TH * s * 0.5, 0, Math.PI, Math.PI * 2); g.stroke();
    }
    function spire(g, s, x, y, h, col) { var c = toScreen(x, y, 0); g.beginPath(); g.moveTo(c.x - 1.2 * s, c.y); g.lineTo(c.x, c.y - h * s); g.lineTo(c.x + 1.2 * s, c.y); g.closePath(); g.fillStyle = col; g.fill(); }
    function drawAbuja(g, s) {
      rock(g, s, 23.2, 7.4, 3.6, 46, theme.dark ? '#5d5650' : '#8e8275'); // Aso Rock
      rock(g, s, 0.6, -0.6, 2.4, 52, theme.dark ? '#4f4a46' : '#7d7368'); // Zuma Rock
      // National Mosque: a white hall, a golden dome and four minarets.
      drawBuilding(g, { x: 18.0, y: 13.0, w: 0.7, dep: 0.7, h: 7, wall: '#f2efe6', roof: '#e7e2d4' }, s, 0, true);
      var md = toScreen(18.0, 13.0, 0); g.beginPath(); g.ellipse(md.x, md.y - 9 * s, 7 * s, 7 * s, 0, Math.PI, Math.PI * 2); var dg = g.createLinearGradient(md.x - 7 * s, 0, md.x + 7 * s, 0); dg.addColorStop(0, '#ffe58a'); dg.addColorStop(1, '#c9961b'); g.fillStyle = dg; g.fill();
      [[17.55, 12.55], [18.45, 12.55], [17.55, 13.45], [18.45, 13.45]].forEach(function (m) { cyl(g, s, m[0], m[1], 0.07, 26, '#f4f1e8'); spire(g, s, m[0], m[1] - 0.0, 30, '#d9b347'); });
      // National Christian Centre: a white block with a tall triangular spire.
      drawBuilding(g, { x: 13.6, y: 14.8, w: 0.6, dep: 0.5, h: 8, wall: '#f4f2ec', roof: '#c9c2b2' }, s, 0, true);
      spire(g, s, 13.6, 14.8, 30, '#eeeae0');
      // Millennium Tower: a slim mast with a pod near the top.
      cyl(g, s, 16.2, 13.0, 0.1, 70, '#d9dde2'); var mt = toScreen(16.2, 13.0, 0); g.beginPath(); g.ellipse(mt.x, mt.y - 56 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2); g.fillStyle = '#5f8fb8'; g.fill();
      // City Gate: two pillars and an arch over the airport road.
      var ga = toScreen(10.5, 21.6, 0), gb = toScreen(11.1, 21.6, 0); g.strokeStyle = '#e8e2d2'; g.lineWidth = Math.max(1.2, 2.2 * s);
      g.beginPath(); g.moveTo(ga.x, ga.y); g.lineTo(ga.x, ga.y - 12 * s); g.quadraticCurveTo((ga.x + gb.x) / 2, ga.y - 20 * s, gb.x, gb.y - 12 * s); g.lineTo(gb.x, gb.y); g.stroke();
      bowl(g, s, 11.6, 20.4, 1.4, 1.1);
      drawBuilding(g, { x: 20.2, y: 12.6, w: 0.9, dep: 0.5, h: 6, wall: '#f2ede4', roof: '#4f8a5b' }, s, 0, true); // Three Arms Zone
      var tz = toScreen(20.2, 12.6, 0); g.beginPath(); g.ellipse(tz.x, tz.y - 8 * s, 4 * s, 4 * s, 0, Math.PI, Math.PI * 2); g.fillStyle = '#3f7f55'; g.fill();
      [[17.6, 16.9], [17.9, 17.1], [18.1, 16.85]].forEach(function (k, i) { var c = toScreen(k[0], k[1], 0); g.beginPath(); g.moveTo(c.x - 4 * s, c.y); g.lineTo(c.x, c.y - 6 * s); g.lineTo(c.x + 4 * s, c.y); g.closePath(); g.fillStyle = ['#c0392b', '#2f6fa0', '#e67e22'][i]; g.fill(); }); // craft stall tents
    }
    function drawPH(g, s) {
      bowl(g, s, 8.6, 3.2, 1.4, 1.1);
      // River port: container stacks and three gantry cranes over the creek.
      ['#c0392b', '#2f6fa0', '#2fa36b', '#e67e22'].forEach(function (col, i) { var c = toScreen(23.3 + i * 0.25, 12.5, 0); g.fillStyle = col; g.fillRect(c.x - 3 * s, c.y - 3 * s, 6 * s, 3 * s); });
      [23.2, 23.8, 24.4].forEach(function (x) { var a = toScreen(x, 12.0, 0); g.strokeStyle = '#d0453a'; g.lineWidth = Math.max(0.8, 1.2 * s); g.beginPath(); g.moveTo(a.x - 3 * s, a.y); g.lineTo(a.x - 3 * s, a.y - 20 * s); g.lineTo(a.x + 9 * s, a.y - 20 * s); g.moveTo(a.x + 3 * s, a.y); g.lineTo(a.x + 3 * s, a.y - 20 * s); g.moveTo(a.x - 6 * s, a.y - 17 * s); g.lineTo(a.x + 11 * s, a.y - 17 * s); g.stroke(); });
      drawBuilding(g, { x: 12.6, y: 13.6, w: 0.8, dep: 0.5, h: 7, wall: '#a8432f', roof: '#6b2f24' }, s, 0, true); // Brick House
      poly(g, [[17.6, 18.3], [19.8, 18.0], [20.0, 19.2], [17.8, 19.5]], theme.sand || '#e8d6a8'); // tourist beach
      [[18.2, 18.6], [18.8, 18.5], [19.4, 18.7]].forEach(function (k, i) { var c = toScreen(k[0], k[1], 0); g.beginPath(); g.moveTo(c.x - 4 * s, c.y - 4 * s); g.quadraticCurveTo(c.x, c.y - 8 * s, c.x + 4 * s, c.y - 4 * s); g.closePath(); g.fillStyle = ['#e5484d', '#f5c518', '#2f6fd0'][i]; g.fill(); g.strokeStyle = '#555'; g.beginPath(); g.moveTo(c.x, c.y - 6 * s); g.lineTo(c.x, c.y); g.stroke(); });
      poly(g, [[14.45, 20.1], [14.75, 20.1], [14.75, 21.2], [14.45, 21.2]], theme.dark ? '#6b5640' : '#9a7b56'); // Bonny jetty
      poly(g, [[13.2, 9.6], [14.4, 9.6], [14.4, 10.0], [13.2, 10.0]], theme.road); // Garrison flyover deck
      var z = toScreen(19.4, 9.4, 0); g.beginPath(); g.ellipse(z.x, z.y, 0.9 * TW * s * 0.5, 0.7 * TH * s * 0.5, 0, 0, Math.PI * 2); g.fillStyle = theme.dark ? '#2f4a2c' : '#7fb35f'; g.fill(); // zoo grounds
      drawBuilding(g, { x: 10.8, y: 12.2, w: 0.7, dep: 0.5, h: 6, wall: '#d9c38f', roof: '#8a6a3a' }, s, 0, true); // cultural centre
    }
    function drawHydePark(g, s) {
      var B = D.HYDE_PARK.box, x0 = B[0], y0 = B[1], x1 = B[2], y1 = B[3];
      // Estate pad, a fence line, the access road to the expressway and the gatehouse.
      poly(g, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], theme.dark ? '#33402f' : '#cfe0b4', theme.dark ? '#7b7f86' : '#8a9a74', Math.max(1, 1.4 * s));
      poly(g, [[31.95, y1], [32.05, y1], [32.07, 24.32], [31.93, 24.32]], theme.road);
      poly(g, [[x0 + 0.05, 23.55], [x1 - 0.05, 23.55], [x1 - 0.05, 23.6], [x0 + 0.05, 23.6]], theme.road); // estate boulevard
      poly(g, [[x0 + 0.05, 23.12], [x1 - 0.05, 23.12], [x1 - 0.05, 23.17], [x0 + 0.05, 23.17]], theme.road);
      poly(g, [[31.97, y0 + 0.05], [32.03, y0 + 0.05], [32.03, y1], [31.97, y1]], theme.road);
      drawBuilding(g, { x: 32.0, y: 23.92, w: 0.12, dep: 0.08, h: 4, wall: '#d9c38f', roof: '#8a6a3a' }, s, 0, true);
      // Central park with a pool and two tennis courts.
      poly(g, [[31.1, 23.2], [31.9, 23.2], [31.9, 23.5], [31.1, 23.5]], theme.dark ? '#2f4a2c' : '#7fb35f');
      poly(g, [[31.55, 23.26], [31.8, 23.26], [31.8, 23.36], [31.55, 23.36]], '#3fb6d8', '#ffffff', 1);
      [[31.2, 23.27], [31.38, 23.27]].forEach(function (c) { poly(g, [[c[0], c[1]], [c[0] + 0.14, c[1]], [c[0] + 0.14, c[1] + 0.18], [c[0], c[1] + 0.18]], '#2f7fb0', '#ffffff', 1); });
      // Lagoon frontage: private jetties for Billionaire Row and a bridge to the islet.
      [31.15, 31.47, 31.79].forEach(function (x) { poly(g, [[x - 0.03, 22.45], [x + 0.03, 22.45], [x + 0.03, 22.66], [x - 0.03, 22.66]], theme.dark ? '#6b5640' : '#a07a4f'); });
      poly(g, [[32.18, 22.2], [32.26, 22.2], [32.26, 22.66], [32.18, 22.66]], theme.dark ? '#8a8f96' : '#d8d4c8');
      var lb = toScreen((x0 + x1) / 2, y1 - 0.12, 0); g.font = '800 ' + Math.min(12, Math.max(7, 6 * s)) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = theme.dark ? '#d9e6c9' : '#2f5a2f'; g.fillText('LEKKI HYDE PARK', lb.x, lb.y);
    }
    function drawRefinery(g, s) {
      var R = REFINERY;
      sitePad(g, s, R, true);
      poly(g, [[44.35, 22.9], [50.95, 22.9], [50.95, 24.8], [44.35, 24.8]], theme.dark ? '#4c4f53' : '#cfd2d4'); // the concrete plant yard
      // Tank farm: eight finished tanks, each with a green band.
      poly(g, [[44.5, 23.0], [47.0, 23.0], [47.0, 24.3], [44.5, 24.3]], theme.dark ? '#57534a' : '#c8c3b5');
      var tanks = [[44.95, 23.3, 0], [45.6, 23.3, 0], [46.25, 23.3, 0], [46.9, 23.3, 0], [44.95, 23.95, 0], [45.6, 23.95, 0], [46.25, 23.95, 0], [46.9, 23.95, 0]];
      tanks.forEach(function (k) { cyl(g, s, k[0], k[1], 0.55, 9, '#dfe2e5', k[2] === 1); if (!k[2]) { var c = toScreen(k[0], k[1], 0); g.strokeStyle = '#1f8a4c'; g.lineWidth = Math.max(0.8, 1 * s); g.beginPath(); g.ellipse(c.x, c.y - 6 * s, 0.55 * TW * s * 0.5, 0.55 * TH * s * 0.5, 0, 0, Math.PI); g.stroke(); } });
      // Pipe rack across the site.
      var a = toScreen(44.6, 24.55, 0), b = toScreen(50.6, 24.45, 0);
      g.strokeStyle = '#7c8794'; g.lineWidth = Math.max(1, 1.6 * s); g.beginPath(); g.moveTo(a.x, a.y - 3 * s); g.lineTo(b.x, b.y - 3 * s); g.stroke();
      g.strokeStyle = '#e8b416'; g.lineWidth = Math.max(0.6, 0.8 * s); g.beginPath(); g.moveTo(a.x, a.y - 4.2 * s); g.lineTo(b.x, b.y - 4.2 * s); g.stroke();
      for (var i = 0; i <= 10; i++) { var q = toScreen(44.6 + i * 0.6, 24.55 - i * 0.01, 0); g.strokeStyle = '#7c8794'; g.lineWidth = Math.max(0.5, 0.6 * s); g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x, q.y - 3 * s); g.stroke(); }
      // Distillation columns with yellow ladders, a control building, a cooling tower, flare stacks.
      cyl(g, s, 47.75, 23.25, 0.32, 20, '#9aa2ab', false, '#e8b416'); cyl(g, s, 48.35, 23.55, 0.3, 16, '#9aa2ab', false, '#e8b416'); cyl(g, s, 48.0, 23.95, 0.26, 13, '#9aa2ab', false, '#e8b416');
      drawBuilding(g, { x: 49.5, y: 23.3, w: 0.7, dep: 0.6, h: 7, wall: '#c9ced3', roof: '#b6bcc2' }, s, 0, true);
      var ct = toScreen(50.25, 23.95, 0), crx = 0.55 * TW * s * 0.5, cry = 0.55 * TH * s * 0.5, cup = 13 * s;
      g.beginPath(); g.moveTo(ct.x - crx, ct.y); g.quadraticCurveTo(ct.x - crx * 0.55, ct.y - cup * 0.6, ct.x - crx * 0.7, ct.y - cup); g.lineTo(ct.x + crx * 0.7, ct.y - cup); g.quadraticCurveTo(ct.x + crx * 0.55, ct.y - cup * 0.6, ct.x + crx, ct.y); g.closePath();
      g.fillStyle = theme.dark ? '#8d9196' : '#c9cdd1'; g.fill();
      g.beginPath(); g.ellipse(ct.x, ct.y - cup, crx * 0.7, cry * 0.7, 0, 0, Math.PI * 2); g.fillStyle = theme.dark ? '#5d6166' : '#9ea3a8'; g.fill();
      // Flare stacks, now lit: a small flame on each.
      [[50.6, 23.0], [50.85, 23.2]].forEach(function (k) {
        var c = toScreen(k[0], k[1], 0); for (var j = 0; j < 6; j++) { g.fillStyle = j % 2 ? '#ffffff' : '#c0392b'; g.fillRect(c.x - 0.7 * s, c.y - (j + 1) * 3 * s, 1.4 * s, 3 * s); }
        var fy = c.y - 18 * s; g.beginPath(); g.moveTo(c.x - 1.6 * s, fy); g.quadraticCurveTo(c.x - 1.2 * s, fy - 3 * s, c.x, fy - 5.5 * s); g.quadraticCurveTo(c.x + 1.2 * s, fy - 3 * s, c.x + 1.6 * s, fy); g.closePath(); g.fillStyle = '#f39c12'; g.fill();
        g.beginPath(); g.ellipse(c.x, fy - 1.2 * s, 0.7 * s, 1.6 * s, 0, 0, Math.PI * 2); g.fillStyle = '#ffe08a'; g.fill();
      });
      // Tanker lorries at the loading gantry, by the gate.
      drawBuilding(g, { x: 47.9, y: 24.6, w: 0.9, dep: 0.16, h: 3.5, wall: '#7c8794', roof: '#e8b416' }, s, 0, true);
      [47.6, 47.9, 48.2].forEach(function (tx, i) { var c = toScreen(tx, 24.72, 0); g.fillStyle = '#dfe2e5'; g.fillRect(c.x - 3 * s, c.y - 3 * s, 4.5 * s, 2.5 * s); g.fillStyle = ['#c0392b', '#2f6fa0', '#1f8a4c'][i]; g.fillRect(c.x + 1.5 * s, c.y - 2.6 * s, 1.8 * s, 2.1 * s); });
      // A jetty into the lagoon with a tanker ship moored at its head, and the gateway sign.
      var j0 = toScreen(45.4, 22.8, 0), j1 = toScreen(45.4, 22.0, 0);
      g.strokeStyle = theme.dark ? '#77756d' : '#b9b4a6'; g.lineWidth = Math.max(2, 3 * s); g.beginPath(); g.moveTo(j0.x, j0.y); g.lineTo(j1.x, j1.y); g.stroke();
      poly(g, [[44.75, 21.72], [45.25, 21.66], [46.15, 21.66], [46.15, 21.9], [45.25, 21.9], [44.75, 21.84]], '#8a2f2b');
      poly(g, [[45.3, 21.7], [46.1, 21.7], [46.1, 21.86], [45.3, 21.86]], '#3f4a55');
      drawBuilding(g, { x: 46.0, y: 21.78, w: 0.14, dep: 0.18, h: 3.5, wall: '#f4f5f6', roof: '#dfe2e5' }, s, 0, true);
      sign(g, s, 50.2, 24.85, 'LAGOS OIL REFINERY', '', true);
    }
    function drawBeach(g, s) {
      // Clear shallows: a turquoise band off the sand.
      var sh = toScreen(45.6, 30.1, 0), sg = g.createRadialGradient(sh.x, sh.y, 4 * s, sh.x, sh.y, 70 * s);
      sg.addColorStop(0, 'rgba(120,235,235,.75)'); sg.addColorStop(1, 'rgba(120,235,235,0)');
      poly(g, [[40.8, 29.75], [50.4, 29.6], [50.9, 31.2], [40.6, 31.4]], null); g.fillStyle = sg; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = Math.max(0.8, 1.2 * s);  // surf line
      var w0 = toScreen(41.2, 29.85, 0), w1 = toScreen(50.2, 29.72, 0); g.beginPath(); g.moveTo(w0.x, w0.y); g.lineTo(w1.x, w1.y); g.stroke();
      // Decks and pools in front of each house.
      for (var hi = 0; hi < 10; hi++) {
        var hx = 41.9 + hi * 0.83;
        poly(g, [[hx - 0.3, 27.58], [hx + 0.3, 27.58], [hx + 0.3, 27.95], [hx - 0.3, 27.95]], theme.dark ? '#6b5236' : '#c99a62');
        poly(g, [[hx - 0.2, 27.64], [hx + 0.14, 27.64], [hx + 0.14, 27.88], [hx - 0.2, 27.88]], '#39c5e6');
        var lo = toScreen(hx + 0.22, 27.9, 0); g.fillStyle = '#ffffff'; g.fillRect(lo.x - 1.5 * s, lo.y - 1 * s, 3 * s, 1 * s);
      }
      // Umbrellas and loungers on the sand.
      var um = ['#ff4d8d', '#ffd23f', '#2f80ed', '#16a35a', '#ff8a3d'];
      for (var ui2 = 0; ui2 < 12; ui2++) {
        var u = toScreen(41.7 + ui2 * 0.72, 28.95 + (ui2 % 2) * 0.18, 0);
        g.strokeStyle = '#7a5a3a'; g.lineWidth = Math.max(0.5, 0.6 * s); g.beginPath(); g.moveTo(u.x, u.y); g.lineTo(u.x, u.y - 5 * s); g.stroke();
        g.beginPath(); g.ellipse(u.x, u.y - 5 * s, 3.2 * s, 1.4 * s, 0, Math.PI, 0); g.fillStyle = um[ui2 % um.length]; g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(u.x + 1.5 * s, u.y - 0.6 * s, 2.6 * s, 0.9 * s);
      }
      // Horses on the beach.
      [[43.0, 28.45, '#7a4a2a'], [43.45, 28.62, '#2b1d14'], [43.9, 28.4, '#c8a882']].forEach(function (h) {
        var c = toScreen(h[0], h[1], 0), k = s;
        g.fillStyle = h[2];
        g.beginPath(); g.ellipse(c.x, c.y - 3.6 * k, 2.6 * k, 1.3 * k, 0, 0, Math.PI * 2); g.fill();      // body
        g.fillRect(c.x - 2 * k, c.y - 3 * k, 0.5 * k, 3 * k); g.fillRect(c.x - 1 * k, c.y - 3 * k, 0.5 * k, 3 * k);
        g.fillRect(c.x + 1 * k, c.y - 3 * k, 0.5 * k, 3 * k); g.fillRect(c.x + 1.9 * k, c.y - 3 * k, 0.5 * k, 3 * k);
        g.beginPath(); g.moveTo(c.x + 2 * k, c.y - 4.2 * k); g.lineTo(c.x + 3.4 * k, c.y - 6.6 * k); g.lineTo(c.x + 4.4 * k, c.y - 6 * k); g.lineTo(c.x + 2.8 * k, c.y - 3.6 * k); g.closePath(); g.fill(); // neck and head
        g.strokeStyle = h[2]; g.lineWidth = Math.max(0.5, 0.6 * k); g.beginPath(); g.moveTo(c.x - 2.5 * k, c.y - 3.8 * k); g.lineTo(c.x - 3.4 * k, c.y - 2 * k); g.stroke(); // tail
      });
      // Quad bikes.
      [[45.3, 28.5, '#e5484d'], [45.75, 28.35, '#f2b600'], [46.2, 28.55, '#2f80ed']].forEach(function (q) {
        var c = toScreen(q[0], q[1], 0);
        g.fillStyle = '#1f2125'; [[-2, 0], [2, 0], [-1.2, -0.8], [2.8, -0.8]].forEach(function (w) { g.beginPath(); g.arc(c.x + w[0] * s, c.y + w[1] * s - 1 * s, 1 * s, 0, Math.PI * 2); g.fill(); });
        g.fillStyle = q[2]; g.fillRect(c.x - 2.2 * s, c.y - 3.2 * s, 4.6 * s, 1.8 * s);
        g.fillStyle = '#1f2125'; g.fillRect(c.x - 0.5 * s, c.y - 4 * s, 1.6 * s, 0.9 * s);
      });
      // Water sports: jet skis with wakes, a banana boat, a parasail and kayaks.
      [[47.2, 30.5], [48.4, 30.8], [44.6, 30.9]].forEach(function (j, i) {
        var c = toScreen(j[0], j[1], 0);
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(0.6, 0.8 * s);
        g.beginPath(); g.moveTo(c.x - 2 * s, c.y); g.quadraticCurveTo(c.x - 8 * s, c.y + 2 * s, c.x - 14 * s, c.y + 1 * s); g.stroke();
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(c.x, c.y, 2.8 * s, 1.1 * s, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = ['#e5484d', '#7c3aed', '#16a35a'][i]; g.fillRect(c.x - 0.8 * s, c.y - 2.2 * s, 1.6 * s, 1.6 * s);
      });
      var bb = toScreen(46.0, 31.1, 0); g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(bb.x, bb.y, 5 * s, 1.2 * s, 0, 0, Math.PI * 2); g.fill();
      ['#e5484d', '#2f80ed', '#16a35a'].forEach(function (c, i) { g.fillStyle = c; g.beginPath(); g.arc(bb.x - 3 * s + i * 3 * s, bb.y - 1.6 * s, 0.9 * s, 0, Math.PI * 2); g.fill(); });
      var ps = toScreen(48.0, 31.4, 0); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = Math.max(0.4, 0.4 * s);
      g.beginPath(); g.moveTo(ps.x, ps.y); g.lineTo(ps.x - 6 * s, ps.y - 22 * s); g.stroke();
      g.beginPath(); g.ellipse(ps.x - 6 * s, ps.y - 24 * s, 5 * s, 2.4 * s, 0, Math.PI, 0); g.fillStyle = '#ff4d8d'; g.fill();
      [[42.4, 30.4, '#ff8a3d'], [42.9, 30.6, '#ffd23f']].forEach(function (k) { var c = toScreen(k[0], k[1], 0); g.fillStyle = k[2]; g.beginPath(); g.ellipse(c.x, c.y, 2.6 * s, 0.7 * s, -0.3, 0, Math.PI * 2); g.fill(); });
    }
    function drawEko(g, s) {
      // The boulevard and cross streets, the sea wall promenade, then the bridge to VI.
      poly(g, [[13.4, 28.95], [19.8, 28.95], [19.8, 29.3], [13.4, 29.3]], theme.road);
      for (var cx = 14.6; cx < 19.6; cx += 1.7) poly(g, [[cx, 28.0], [cx + 0.16, 28.0], [cx + 0.16, 30.55], [cx, 30.55]], theme.road);
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(0.5, 0.6 * s); g.setLineDash([3 * s, 3 * s]);
      var b0 = toScreen(13.5, 29.12, 0), b1 = toScreen(19.7, 29.12, 0); g.beginPath(); g.moveTo(b0.x, b0.y); g.lineTo(b1.x, b1.y); g.stroke(); g.setLineDash([]);
      poly(g, [[13.4, 30.45], [19.8, 30.45], [19.8, 30.6], [13.4, 30.6]], theme.dark ? '#6d6a60' : '#e6dcc2'); // the Great Wall promenade
      // Bridge: deck, railings and two cable-stayed pylons.
      var x0 = 18.25, x1 = 18.75, y0 = 26.75, y1 = 28.05;
      poly(g, [[x0 - 0.05, y0], [x1 + 0.05, y0], [x1 + 0.05, y1], [x0 - 0.05, y1]], theme.dark ? '#3b3e44' : '#c8ccd2');
      poly(g, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], theme.road);
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(0.5, 0.6 * s); g.setLineDash([2 * s, 2 * s]);
      var m0 = toScreen(18.5, y0, 0), m1 = toScreen(18.5, y1, 0); g.beginPath(); g.moveTo(m0.x, m0.y); g.lineTo(m1.x, m1.y); g.stroke(); g.setLineDash([]);
      [x0 - 0.05, x1 + 0.05].forEach(function (rx) { var r0 = toScreen(rx, y0, 0), r1 = toScreen(rx, y1, 0); g.strokeStyle = theme.dark ? '#aeb4bb' : '#6b7280'; g.lineWidth = Math.max(0.8, 1 * s); g.beginPath(); g.moveTo(r0.x, r0.y - 1.5 * s); g.lineTo(r1.x, r1.y - 1.5 * s); g.stroke(); });
      [[x0 - 0.05, 27.4], [x1 + 0.05, 27.4]].forEach(function (pp) {
        var b = toScreen(pp[0], pp[1], 0), ph = 22 * s;
        g.strokeStyle = '#e8eef3'; g.lineWidth = Math.max(1.5, 2.2 * s); g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x, b.y - ph); g.stroke();
        g.strokeStyle = 'rgba(232,238,243,.8)'; g.lineWidth = Math.max(0.4, 0.45 * s);
        for (var k = 1; k <= 4; k++) { [pp[1] - k * 0.14, pp[1] + k * 0.14].forEach(function (cy) { var c = toScreen(pp[0], cy, 0); g.beginPath(); g.moveTo(b.x, b.y - ph * (0.5 + k * 0.12)); g.lineTo(c.x, c.y - 1.5 * s); g.stroke(); }); }
      });
    }
    function drawNewAirport(g, s) {
      // Laid out in local coordinates (x 44.2–51.2, y 25.1–27.3), then moved to its real spot beside Murtala Muhammed in Ikeja.
      var o0 = toScreen(0, 0, 0), o1 = toScreen(AIRPORT_AT.x - NEW_AIRPORT.x0, AIRPORT_AT.y - NEW_AIRPORT.y0, 0);
      g.save(); g.translate(o1.x - o0.x, o1.y - o0.y);
      var R = NEW_AIRPORT, white = '#ffffff', tar = theme.dark ? '#3b3f45' : '#5d636b';
      sitePad(g, s, R, true);
      // Runway: full length, edge lines, a dashed centre line and threshold bars at both ends.
      poly(g, [[44.45, 25.22], [51.05, 25.22], [51.05, 25.5], [44.45, 25.5]], tar);
      g.strokeStyle = white; g.lineWidth = Math.max(0.4, 0.5 * s);
      [25.25, 25.47].forEach(function (ey) { var a = toScreen(44.5, ey, 0), b = toScreen(51.0, ey, 0); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); });
      g.lineWidth = Math.max(0.5, 0.7 * s); g.setLineDash([3 * s, 3 * s]);
      var r0 = toScreen(44.95, 25.36, 0), r1 = toScreen(50.55, 25.36, 0); g.beginPath(); g.moveTo(r0.x, r0.y); g.lineTo(r1.x, r1.y); g.stroke(); g.setLineDash([]);
      [44.55, 50.8].forEach(function (tx) { for (var k = 0; k < 6; k++) { var ty = 25.27 + k * 0.035; poly(g, [[tx, ty], [tx + 0.18, ty], [tx + 0.18, ty + 0.018], [tx, ty + 0.018]], white); } });
      // Parallel taxiway with yellow centre line, two links to the runway, and the apron.
      poly(g, [[44.9, 25.62], [50.6, 25.62], [50.6, 25.74], [44.9, 25.74]], tar);
      [45.4, 50.1].forEach(function (lx) { poly(g, [[lx, 25.5], [lx + 0.14, 25.5], [lx + 0.14, 25.62], [lx, 25.62]], tar); });
      g.strokeStyle = '#f2c200'; g.lineWidth = Math.max(0.4, 0.45 * s); var t0 = toScreen(44.95, 25.68, 0), t1 = toScreen(50.55, 25.68, 0); g.beginPath(); g.moveTo(t0.x, t0.y); g.lineTo(t1.x, t1.y); g.stroke();
      poly(g, [[45.9, 25.74], [49.6, 25.74], [49.6, 26.2], [45.9, 26.2]], theme.dark ? '#4a4f56' : '#9aa1a9');
      [46.3, 46.9, 47.5, 48.6, 49.2].forEach(function (sx) { var a = toScreen(sx, 25.8, 0), b = toScreen(sx, 26.2, 0); g.strokeStyle = '#f2c200'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); });
      // Planes: three at the stands nose-in, one rolling for take-off.
      plane(g, 46.3, 25.95, Math.PI / 2, '#1f8a5b'); plane(g, 47.5, 25.95, Math.PI / 2, '#c0392b'); plane(g, 48.6, 25.95, Math.PI / 2, '#2f6fa0');
      plane(g, 49.6, 25.36, Math.PI, '#e2652b');
      // Hangars at the west end, the control tower, and the fuel farm in the east.
      drawBuilding(g, { x: 44.8, y: 25.98, w: 0.65, dep: 0.36, h: 6, wall: '#a9b0b8', roof: '#c7ccd1', pitch: true, rise: 4 }, s, 0, true);
      drawBuilding(g, { x: 44.8, y: 26.46, w: 0.65, dep: 0.36, h: 6, wall: '#a9b0b8', roof: '#c7ccd1', pitch: true, rise: 4 }, s, 0, true);
      // Terminal: two glass halls joined by a low concourse, with jet bridges out to the stands.
      drawBuilding(g, { x: 46.85, y: 26.42, w: 1.5, dep: 0.4, h: 9, wall: '#4f82b0', roof: '#e3e6e9', glass: true }, s, 0, true);
      drawBuilding(g, { x: 48.0, y: 26.36, w: 0.8, dep: 0.26, h: 4.5, wall: '#5d8fbb', roof: '#e3e6e9', glass: true }, s, 0, true);
      drawBuilding(g, { x: 48.95, y: 26.42, w: 1.0, dep: 0.4, h: 8, wall: '#4f82b0', roof: '#e3e6e9', glass: true }, s, 0, true);
      [46.3, 47.5, 48.6].forEach(function (bx) { drawBuilding(g, { x: bx, y: 26.11, w: 0.05, dep: 0.18, h: 2.2, wall: '#d7dadd', roof: '#eceef0' }, s, 0, true); });
      ctrlTower(g, s, 45.7, 26.55);
      [[50.3, 26.3], [50.6, 26.3], [50.9, 26.3]].forEach(function (k) { cyl(g, s, k[0], k[1], 0.2, 3, '#d7dadd'); });
      // Landside: the car park, the forecourt road and the gateway sign.
      poly(g, [[46.2, 26.68], [47.6, 26.68], [47.6, 26.98], [46.2, 26.98]], theme.road);
      ['#c0392b', '#2f6fa0', '#ffffff', '#2fa36b', '#17181a'].forEach(function (col, i) { var c = toScreen(46.45 + i * 0.26, 26.83, 0); g.fillStyle = col; g.fillRect(c.x - 1.5 * s, c.y - 1 * s, 3 * s, 2 * s); });
      poly(g, [[44.3, 27.05], [51.1, 27.05], [51.1, 27.22], [44.3, 27.22]], theme.road);
      sign(g, s, 49.6, 27.0, 'LAGOS INTERNATIONAL AIRPORT', '', true);
      g.restore();
    }
    // A jet seen from above, drawn flat in world coordinates so it turns with the map. heading: radians, nose direction.
    function plane(g, x, y, heading, livery) {
      var c = Math.cos(heading), sn = Math.sin(heading);
      function P(u, v) { return [x + u * c - v * sn, y + u * sn + v * c]; }
      function shape(pts, fill, dx) { poly(g, pts.map(function (p) { var q = P(p[0], p[1]); return [q[0] + (dx || 0), q[1] + (dx || 0)]; }), fill); }
      var body = [[0.17, 0], [0.14, 0.022], [-0.14, 0.02], [-0.17, 0], [-0.14, -0.02], [0.14, -0.022]];
      var wings = [[0.04, 0.02], [-0.04, 0.16], [-0.07, 0.16], [-0.03, 0.02], [-0.03, -0.02], [-0.07, -0.16], [-0.04, -0.16], [0.04, -0.02]];
      var tail = [[-0.12, 0.015], [-0.16, 0.07], [-0.175, 0.07], [-0.16, 0], [-0.175, -0.07], [-0.16, -0.07], [-0.12, -0.015]];
      var sh = 'rgba(0,0,0,.18)';
      shape(wings, sh, 0.02); shape(body, sh, 0.02);
      shape(wings, '#d9dde1'); shape(tail, livery); shape(body, '#f4f5f6');
      shape([[0.06, 0.012], [-0.12, 0.012], [-0.12, 0.004], [0.06, 0.004]], livery);
    }
    // The control tower: a slim shaft with a glass cab and a roof cap.
    function ctrlTower(g, s, x, y) {
      var c = toScreen(x, y, 0), rx = 0.07 * TW * s * 0.5, ry = 0.07 * TH * s * 0.5, up = 22 * s, cab = 4 * s;
      g.fillStyle = '#c3c8cd'; g.fillRect(c.x - rx, c.y - up, rx * 2, up); g.fillStyle = '#9aa1a9'; g.fillRect(c.x, c.y - up, rx, up);
      var w = rx * 2.6, h = ry * 2.6;
      g.fillStyle = '#2b4f72'; g.fillRect(c.x - w, c.y - up - cab, w * 2, cab);
      g.beginPath(); g.ellipse(c.x, c.y - up, w, h, 0, 0, Math.PI); g.fill();
      g.fillStyle = 'rgba(160,210,240,.55)'; g.fillRect(c.x - w * 0.9, c.y - up - cab * 0.85, w * 1.8, cab * 0.6);
      g.beginPath(); g.ellipse(c.x, c.y - up - cab, w * 1.1, h * 1.1, 0, 0, Math.PI * 2); g.fillStyle = '#e3e6e9'; g.fill();
      g.strokeStyle = '#6b7280'; g.lineWidth = Math.max(0.5, 0.6 * s); g.beginPath(); g.moveTo(c.x, c.y - up - cab); g.lineTo(c.x, c.y - up - cab - 4 * s); g.stroke();
    }

    function drawTree(g, t, s) {
      var p = toScreen(t.x, t.y, 0), r = 2.6 * t.s * s;
      if (t.palm) {
        // A palm: a leaning trunk and six fronds.
        var th = 9 * t.s * s, tx = p.x + 1.6 * s, ty = p.y - th;
        g.strokeStyle = theme.dark ? '#5a4632' : '#9a7448'; g.lineWidth = Math.max(0.8, 1.1 * s);
        g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(p.x + 0.2 * s, p.y - th * 0.6, tx, ty); g.stroke();
        g.strokeStyle = theme.dark ? '#3f7a3a' : '#2f9a4a'; g.lineWidth = Math.max(0.8, 1.3 * s);
        for (var f = 0; f < 6; f++) { var a = f / 6 * Math.PI * 2, ex = tx + Math.cos(a) * 4.5 * s, ey = ty + Math.sin(a) * 2 * s + 1.5 * s;
          g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * 3 * s, ty - 1.5 * s, ex, ey); g.stroke(); }
        return;
      }
      g.fillStyle = theme.dark ? '#3a2d22' : '#7a5a3a';
      g.fillRect(p.x - 0.5 * s, p.y - 3 * s, 1 * s, 3 * s);
      g.beginPath(); g.arc(p.x, p.y - 4.5 * s, r, 0, Math.PI * 2); g.fillStyle = theme.tree; g.fill();
    }

    // Screen point for view-space coordinates (already spun).
    function toScreenV(vx, vy, z) {
      var p = iso(vx, vy), s = base.s * cam.z;
      return { x: (p.x * s) + base.ox * cam.z - (W / 2) * (cam.z - 1) + cam.px, y: ((p.y - (z || 0)) * s) + base.oy * cam.z - (H / 2) * (cam.z - 1) + cam.py };
    }
    function boxFaces(b, s) {
      // Corners in view space at the building's true size, labelled so p2 is the corner nearest the camera, p1 and p3
      // its neighbours (p1 to the right on screen) and p0 the far corner. The faces drawn then always face the camera.
      var hw = b.w / 2, hd = b.dep / 2, c = rot(b.x, b.y);
      var vs = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(function (o) { var v = rotV(o[0], o[1]); return { x: c.x + v.x, y: c.y + v.y }; });
      var fi = 0; for (var q = 1; q < 4; q++) if (vs[q].x + vs[q].y > vs[fi].x + vs[fi].y + 1e-9) fi = q;
      var na = vs[(fi + 1) % 4], nb = vs[(fi + 3) % 4], right = (na.x - na.y) > (nb.x - nb.y);
      var p2 = toScreenV(vs[fi].x, vs[fi].y, 0), p1 = toScreenV(right ? na.x : nb.x, right ? na.y : nb.y, 0), p3 = toScreenV(right ? nb.x : na.x, right ? nb.y : na.y, 0), p0 = toScreenV(vs[(fi + 2) % 4].x, vs[(fi + 2) % 4].y, 0);
      var up = b.h * s;
      return { p0: p0, p1: p1, p2: p2, p3: p3, up: up };
    }

    // A tower in full 3D: ground shadow, lit and shaded glass faces with a mullion grid, edge lines, a set-back crown and a mast.
    function drawTower(g, b, s, night) {
      var f = boxFaces(b, s), up = f.up, lw = Math.max(0.5, 0.6 * s);
      var sh = up * 0.35;
      g.fillStyle = 'rgba(0,0,0,' + (theme.dark ? 0.35 : 0.16) + ')';
      g.beginPath(); g.moveTo(f.p1.x, f.p1.y); g.lineTo(f.p2.x, f.p2.y); g.lineTo(f.p2.x + sh, f.p2.y + sh * 0.2); g.lineTo(f.p1.x + sh, f.p1.y + sh * 0.2); g.closePath(); g.fill();
      function face(a, c, col, lit) {
        var gr = g.createLinearGradient(0, a.y - up, 0, a.y);
        gr.addColorStop(0, shade(col, lit + 0.1)); gr.addColorStop(1, shade(col, lit - 0.12));
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.lineTo(c.x, c.y - up); g.lineTo(a.x, a.y - up); g.closePath(); g.fillStyle = gr; g.fill();
        // Mullions and floor bands.
        g.strokeStyle = lit > -0.2 ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.18)'; g.lineWidth = lw * 0.8;
        var cols = 4;
        for (var i = 1; i < cols; i++) { var x = a.x + (c.x - a.x) * i / cols, y = a.y + (c.y - a.y) * i / cols; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - up); g.stroke(); }
        for (var yy = 3.5 * s; yy < up - 1 * s; yy += 3.5 * s) { g.beginPath(); g.moveTo(a.x, a.y - yy); g.lineTo(c.x, c.y - yy); g.stroke(); }
        if (lit > -0.2) { // a diagonal sky reflection on the lit face
          g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,.14)';
          g.beginPath(); g.moveTo(a.x, a.y - up * 0.75); g.lineTo(c.x, c.y - up); g.lineTo(c.x, c.y - up * 0.8); g.lineTo(a.x, a.y - up * 0.5); g.closePath(); g.fill(); g.restore();
        }
      }
      face(f.p1, f.p2, b.wall, -0.3);
      face(f.p3, f.p2, b.wall, -0.04);
      g.beginPath(); g.moveTo(f.p0.x, f.p0.y - up); g.lineTo(f.p1.x, f.p1.y - up); g.lineTo(f.p2.x, f.p2.y - up); g.lineTo(f.p3.x, f.p3.y - up); g.closePath();
      g.fillStyle = shade(b.wall, 0.25); g.fill();
      // Edges: a dark outline and a bright front corner.
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = lw;
      g.beginPath(); g.moveTo(f.p1.x, f.p1.y); g.lineTo(f.p1.x, f.p1.y - up); g.lineTo(f.p0.x, f.p0.y - up); g.lineTo(f.p3.x, f.p3.y - up); g.lineTo(f.p3.x, f.p3.y); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(f.p2.x, f.p2.y); g.lineTo(f.p2.x, f.p2.y - up); g.stroke();
      // Crown: a set-back box on top (two in three towers), then a mast with a red light.
      var top = up;
      if (b.seed < 0.66) {
        var cb = { x: b.x - b.w * 0.08, y: b.y - b.dep * 0.08, w: b.w * 0.6, dep: b.dep * 0.6, h: b.h * 0.14 }, cf = boxFaces(cb, s), cu = cf.up;
        [[cf.p1, cf.p2, -0.32], [cf.p3, cf.p2, -0.08]].forEach(function (q) { g.beginPath(); g.moveTo(q[0].x, q[0].y - up); g.lineTo(q[1].x, q[1].y - up); g.lineTo(q[1].x, q[1].y - up - cu); g.lineTo(q[0].x, q[0].y - up - cu); g.closePath(); g.fillStyle = shade(b.wall, q[2]); g.fill(); });
        g.beginPath(); g.moveTo(cf.p0.x, cf.p0.y - up - cu); g.lineTo(cf.p1.x, cf.p1.y - up - cu); g.lineTo(cf.p2.x, cf.p2.y - up - cu); g.lineTo(cf.p3.x, cf.p3.y - up - cu); g.closePath(); g.fillStyle = shade(b.wall, 0.3); g.fill();
        top = up + cu;
      }
      if (b.seed > 0.35) {
        var m = toScreen(b.x - b.w * 0.08, b.y - b.dep * 0.08, 0), mh = 8 * s;
        g.strokeStyle = theme.dark ? '#c9ccd1' : '#55595f'; g.lineWidth = lw; g.beginPath(); g.moveTo(m.x, m.y - top); g.lineTo(m.x, m.y - top - mh); g.stroke();
        g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(m.x, m.y - top - mh, Math.max(0.8, 1 * s), 0, Math.PI * 2); g.fill();
      }
    }

    function drawBuilding(g, b, s, night, pw) {
      if (b.tall) return drawTower(g, b, s, night);
      var f = boxFaces(b, s), up = f.up;
      // Right face (x+), left face (y+), then roof.
      g.beginPath(); g.moveTo(f.p1.x, f.p1.y); g.lineTo(f.p2.x, f.p2.y); g.lineTo(f.p2.x, f.p2.y - up); g.lineTo(f.p1.x, f.p1.y - up); g.closePath();
      g.fillStyle = shade(b.wall, -0.28); g.fill();
      g.beginPath(); g.moveTo(f.p3.x, f.p3.y); g.lineTo(f.p2.x, f.p2.y); g.lineTo(f.p2.x, f.p2.y - up); g.lineTo(f.p3.x, f.p3.y - up); g.closePath();
      g.fillStyle = shade(b.wall, -0.1); g.fill();
      if (b.pitch) {
        // A gabled roof: ridge along x, two slopes and a gable end.
        var rise = (b.rise || Math.max(3, b.dep * 30)) * s;
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
        var p = toScreen(e.x, e.y, 0), icon = HOME_ICON[e.type] || '🏠';
        var cy = pin3d(ctx, p.x, p.y, mine ? er + 2 : er, mine ? (/^#[0-9a-f]{6}$/i.test(scene.homePaint || '') ? scene.homePaint : theme.danfo) : '#6b7280', icon, { sel: sel, lift: (MODELS[e.type].h[1] + 6) * s, bob: mine && !reduce, glyph: 'dome', bead: mine ? '#fff3c4' : null, img: 'h_' + (e.type === 'flat2' || e.type === 'flat3' ? 'flat' : e.type) });
        var n = scene.residents && scene.residents[e.id];
        if (n) {
          ctx.beginPath(); ctx.arc(p.x + er, cy - er * 0.6, 7, 0, Math.PI * 2); ctx.fillStyle = theme.lagoon; ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.font = '700 9px IBM Plex Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.min(99, n)), p.x + er, cy - er * 0.6 + 0.5);
        }
        homeHits.push({ id: e.id, x: p.x, y: cy });
        if (mine || sel) labels.push({ place: { name: mine ? 'Your home · ' + D.HOMES[e.id].name : D.HOMES[e.id].name, type: 'services' }, top: { x: p.x, y: cy + 4 }, pri: mine ? 2 : 1, sel: sel, homeTag: true });
      });
      if (scene.myPlot != null && CITY === 'lagos') {
        var mp = plotXY(scene.myPlot), mq = toScreen(mp.x, mp.y, 0), my = mq.y - 14 * s - er;
        ctx.beginPath(); ctx.arc(mq.x, my, er + 2, 0, Math.PI * 2); ctx.fillStyle = theme.danfo; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = theme.danfoInk; ctx.stroke();
        if (emojiOk) { ctx.font = Math.round(er * 1.15) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏡', mq.x, my + er * 0.08); }
        labels.push({ place: { name: 'Your house · plot ' + (scene.myPlot + 1), type: 'services' }, top: { x: mq.x, y: my + 4 }, pri: 2, homeTag: true });
      }
      ctx.textBaseline = 'alphabetic';

      // Billboards: a panel on two posts; paid ads rotate every 15 s.
      boardHits = [];
      var slot = Math.floor(Date.now() / 15000);
      var showBoards = !(scene.layers && scene.layers.boards === false) && (cam.z >= 1.3 || scene.board || scene.showBoards);
      (CITY === 'lagos' && showBoards ? D.BILLBOARDS : []).forEach(function (b, bi) {
        var ads = (scene.boards && scene.boards[b.id]) || [];
        if (!ads.length) return;
        var ad = ads[(slot + bi) % ads.length];
        var p = toScreen(b.x, b.y, 0), k = Math.max(0.85, Math.min(1.8, s));
        var pw = 40 * k, ph = 20 * k, post = 12 * k, x = p.x - pw / 2, y = p.y - post - ph;
        var selB = b.id === scene.board;
        ctx.strokeStyle = theme.dark ? '#9aa0a6' : '#4b4f55'; ctx.lineWidth = Math.max(1, 1.2 * k);
        ctx.beginPath(); ctx.moveTo(p.x - pw * 0.3, p.y); ctx.lineTo(p.x - pw * 0.3, y + ph); ctx.moveTo(p.x + pw * 0.3, p.y); ctx.lineTo(p.x + pw * 0.3, y + ph); ctx.stroke();
        ctx.fillStyle = theme.dark ? '#0b0c0d' : '#202226'; roundRect(ctx, x - 1.5, y - 1.5, pw + 3, ph + 3, 3); ctx.fill();
        var pimg = ad.img ? picImage(ad.img) : null;
        if (pimg && pimg.complete && pimg.naturalWidth) {
          ctx.save(); roundRect(ctx, x, y, pw, ph, 2); ctx.clip(); ctx.drawImage(pimg, x, y, pw, ph); ctx.restore();
          if (selB) { ctx.strokeStyle = theme.danfo; ctx.lineWidth = 2.5; roundRect(ctx, x - 3, y - 3, pw + 6, ph + 6, 4); ctx.stroke(); }
          ctx.beginPath(); ctx.arc(x + pw - 3 * k, y + 3 * k, 1.8 * k, 0, Math.PI * 2); ctx.fillStyle = '#e5484d'; ctx.fill();
          boardHits.push({ id: b.id, x: p.x, y: y + ph / 2, w: pw, h: ph + post });
          return;
        }
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

      // The open place's tap area, outlined so you can see what counts as inside it.
      var openPl = scene.place && (scene.places || []).filter(function (pl) { return pl.id === scene.place; })[0];
      if (openPl) {
        var OA = AREAS[openPl.id]; ctx.save(); ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeStyle = theme.dark ? 'rgba(255,214,0,.85)' : 'rgba(214,150,0,.9)'; ctx.fillStyle = 'rgba(255,214,0,.08)'; ctx.beginPath();
        var pts = OA && OA.r ? [[OA.r[0], OA.r[1]], [OA.r[2], OA.r[1]], [OA.r[2], OA.r[3]], [OA.r[0], OA.r[3]]] : OA && OA.p ? OA.p : null;
        if (!pts) { var rr = OA && OA.e ? null : AREA_R[openPl.type] || 0.35; pts = []; for (var ai = 0; ai < 24; ai++) { var an = ai / 24 * Math.PI * 2; pts.push(OA && OA.e ? [OA.e[0] + Math.cos(an) * OA.e[2], OA.e[1] + Math.sin(an) * OA.e[3]] : [openPl.x + Math.cos(an) * rr, openPl.y + Math.sin(an) * rr]); } }
        pts.forEach(function (c, i) { var q = toScreen(c[0], c[1], 0); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      // Key places: a coloured badge per category with a small vector glyph.
      placeHits = [];
      var pr = Math.max(7.5, Math.min(13, 7.2 * Math.sqrt(cam.z) * Math.min(1.3, Math.max(0.85, base.s))));
      // Space pins out: nudge overlapping ones apart on screen, with a thin line back to the real spot.
      var spots = (scene.places || []).map(function (pl) { var g0 = toScreen(pl.x, pl.y, 0); return { pl: pl, gx: g0.x, gy: g0.y, x: g0.x, y: g0.y }; });
      var minD = pr * 2.5, maxOff = pr * 4;
      for (var it = 0; it < 14; it++) {
        for (var i1 = 0; i1 < spots.length; i1++) for (var j1 = i1 + 1; j1 < spots.length; j1++) {
          var A1 = spots[i1], B1 = spots[j1], dx = B1.x - A1.x, dy = B1.y - A1.y, dd = Math.sqrt(dx * dx + dy * dy);
          if (dd >= minD) continue;
          if (dd < 0.01) { dx = (i1 % 2 ? 1 : -1); dy = 0.3; dd = 1; }
          var push = (minD - dd) / 2, ux = dx / dd, uy = dy / dd;
          A1.x -= ux * push; A1.y -= uy * push; B1.x += ux * push; B1.y += uy * push;
        }
        spots.forEach(function (q) { var ox = q.x - q.gx, oy = q.y - q.gy, od = Math.sqrt(ox * ox + oy * oy); if (od > maxOff) { q.x = q.gx + ox / od * maxOff; q.y = q.gy + oy / od * maxOff; } });
      }
      spots.forEach(function (q) {
        var pl = q.pl, p = { x: q.x, y: q.y }, sel = pl.id === scene.place;
        if (Math.abs(q.x - q.gx) + Math.abs(q.y - q.gy) > 2) {
          ctx.strokeStyle = theme.dark ? 'rgba(255,255,255,.45)' : 'rgba(23,24,26,.45)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(q.gx, q.gy); ctx.lineTo(q.x, q.y); ctx.stroke();
          ctx.beginPath(); ctx.arc(q.gx, q.gy, 1.8, 0, Math.PI * 2); ctx.fillStyle = D.PLACE_TYPES[pl.type].color; ctx.fill();
        }
        var cy = pin3d(ctx, p.x, p.y, pr, D.PLACE_TYPES[pl.type].color, pl.icon, { sel: sel, bob: sel && !reduce, glyph: pl.glyph, img: pl.glyph });
        placeHits.push({ id: pl.id, x: p.x, y: cy });
        if (sel || (cam.z >= 1.9 && !(scene.layers && scene.layers.names === false))) labels.push({ place: pl, top: { x: p.x, y: cy + 4 }, pri: sel ? 1 : 4, sel: sel });
      });

      // Sea Plots: the grid, everyone's blocks, and approved pictures laid flat on the water.
      if (CITY === 'lagos') drawSea();

      // District pins.
      pins = []; faceBoxes = [];
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
        var pr0 = here ? 7.5 : 6, pcol = here ? theme.danfo : (sel ? theme.lagoon : (theme.dark ? '#d9dce1' : '#ffffff'));
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 4, 1.6, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill();
        var sg = ctx.createRadialGradient(top.x - pr0 * 0.4, top.y - pr0 * 0.4, pr0 * 0.1, top.x, top.y, pr0);
        sg.addColorStop(0, shade(pcol, 0.4)); sg.addColorStop(1, shade(pcol, -0.3));
        ctx.beginPath(); ctx.arc(top.x, top.y, pr0, 0, Math.PI * 2); ctx.fillStyle = sg; ctx.fill();
        ctx.lineWidth = sel ? 2.5 : 1.5; ctx.strokeStyle = sel ? theme.lagoon : (here ? theme.danfoInk : theme.ink); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(top.x - pr0 * 0.35, top.y - pr0 * 0.45, pr0 * 0.35, pr0 * 0.2, -0.6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();

        labels.push({ k: k, here: here, sel: sel, top: top, pri: here ? 0 : sel ? 1 : (k === scene.home || k === scene.work) ? 2 : 3 });
        var faces = scene.faces || {};
        if (here && faces.me) { drawFace(faces.me, top.x, top.y - 22, 11, theme.danfo); faceBoxes.push({ x: top.x - 13, y: top.y - 35, w: 26, h: 26 }); }

        // Your businesses here: small emoji chips to the left of the pin.
        var biz = (scene.biz || []).filter(function (b) { return b.district === k; });
        biz.slice(0, 3).forEach(function (b, bi) {
          var bx = top.x - 14 - bi * 17, by = top.y - 2;
          ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.fillStyle = theme.surface; ctx.fill();
          ctx.strokeStyle = '#2fa36b'; ctx.lineWidth = 2; ctx.stroke();
          ctx.font = '10px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = theme.ink; ctx.fillText(b.icon, bx, by + 0.5);
        });
        if (biz.length > 3) { ctx.font = '700 9px IBM Plex Mono, monospace'; ctx.fillStyle = theme.ink; ctx.fillText('+' + (biz.length - 3), top.x - 14 - 3 * 17, top.y - 2); }

        // Other players here.
        var n = scene.peers && scene.peers[k], pf = (scene.faces && scene.faces.peers && scene.faces.peers[k]) || [];
        if (scene.players && scene.players.length) { /* drawn below as figures with @handles */ }
        else if (pf.length) {
          pf.slice(0, 3).forEach(function (f, fi) { var fx = top.x + 14 + fi * 13, fy = top.y + 2; drawFace(f, fx, fy, 8, theme.muted); faceBoxes.push({ x: fx - 9, y: fy - 9, w: 18, h: 18 }); });
          if (n > 3) { var cx = top.x + 14 + 3 * 13; ctx.beginPath(); ctx.arc(cx, top.y + 2, 7, 0, Math.PI * 2); ctx.fillStyle = theme.lagoon; ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.font = '700 8px IBM Plex Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+' + Math.min(99, n - 3), cx, top.y + 2.5); }
        } else if (n) {
          var bx = top.x + 10, by = top.y + 2;
          ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fillStyle = theme.lagoon; ctx.fill();
          ctx.strokeStyle = theme.surface; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.font = '700 9px IBM Plex Mono, monospace'; ctx.fillText(String(Math.min(99, n)), bx, by + 0.5);
        }
      });
      placeLabels(labels);
      // Online players: a small figure with a face and an @handle floating over each head. Tap to chat.
      playerHits = [];
      var byD = {};
      (scene.layers && scene.layers.players === false ? [] : scene.players || []).forEach(function (pl0) {
        var d = D.DISTRICTS[pl0.d]; if (!d || cityOfDistrict(pl0.d) !== CITY) return;
        var g0 = toScreen(d.x, d.y, 0), stem0 = 16 * Math.min(1.4, Math.max(0.8, s)), hx, hy;
        if (pl0.me) { hx = g0.x; hy = g0.y - stem0 - 22; if (!(scene.faces && scene.faces.me)) return; }
        else {
          var i = byD[pl0.d] = (byD[pl0.d] || 0) + 1, ang = i * 2.2 + 0.5, rad = 22 + 8 * Math.floor((i - 1) / 5);
          var fx = g0.x + Math.cos(ang) * rad, fy = g0.y + Math.sin(ang) * rad * 0.5, hash = 0;
          for (var c = 0; c < pl0.by.length; c++) hash = (hash * 31 + pl0.by.charCodeAt(c)) >>> 0;
          var body = ['#2f6fd0', '#c0392b', '#16a35a', '#8e44ad', '#e67e22', '#0e8a8a'][hash % 6];
          ctx.beginPath(); ctx.ellipse(fx, fy, 5, 2, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(fx - 4.5, fy); ctx.lineTo(fx - 3.5, fy - 9); ctx.quadraticCurveTo(fx, fy - 12, fx + 3.5, fy - 9); ctx.lineTo(fx + 4.5, fy); ctx.closePath();
          ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
          hx = fx; hy = fy - 16;
          if (pl0.face) drawFace(pl0.face, hx, hy, 6, '#ffffff');
          else { ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fillStyle = '#8a5a3c'; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); }
          playerHits.push({ by: pl0.by, x: hx, y: hy + 6 });
        }
        var txt = pl0.label || '@lagosian';
        ctx.font = '700 10px ' + (theme.font || 'system-ui, sans-serif'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var tw = ctx.measureText(txt).width + 10, ty = hy - (pl0.me ? 20 : 15);
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(hx - tw / 2, ty - 7.5, tw, 15, 7.5); else ctx.rect(hx - tw / 2, ty - 7.5, tw, 15);
        ctx.fillStyle = pl0.me ? theme.danfo : 'rgba(18,20,24,.82)'; ctx.fill();
        ctx.fillStyle = pl0.me ? (theme.danfoInk || '#17181a') : '#ffffff'; ctx.fillText(txt, hx, ty + 0.5);
        if (pl0.unread) { ctx.beginPath(); ctx.arc(hx + tw / 2 - 1, ty - 6, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#e5484d'; ctx.fill(); }
        if (pl0.sub && cam.z >= 1.2) { ctx.font = '600 9px ' + (theme.font || 'system-ui, sans-serif'); var sw2 = ctx.measureText(pl0.sub).width + 8; ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(hx - sw2 / 2, ty - 21, sw2, 12, 6); else ctx.rect(hx - sw2 / 2, ty - 21, sw2, 12); ctx.fill(); ctx.fillStyle = '#17181a'; ctx.fillText(pl0.sub, hx, ty - 14.5); }
        if (!pl0.me) playerHits.push({ by: pl0.by, x: hx, y: ty });
      });
      // Today's hidden gems: a bobbing diamond over each place still to find.
      (scene.gems || []).forEach(function (g) {
        var pl = D.PLACES.filter(function (x) { return x.id === g.place; })[0];
        if (!pl || cityOfDistrict(pl.district) !== CITY) return;
        var p = toScreen(pl.x, pl.y, 0), bob = reduce ? 0 : Math.sin(clock / 380 + pl.x) * 2.5, gy = p.y - pr * 2 - 16 + bob, gr = Math.max(7, pr * 0.85);
        ctx.strokeStyle = '#2f6fd0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x, gy + gr + 2); ctx.lineTo(p.x, p.y - pr * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, gy, gr + 3, 0, Math.PI * 2); ctx.fillStyle = '#2f6fd0'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        if (emojiOk) { ctx.font = Math.round(gr * 1.3) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💎', p.x, gy); }
        else { ctx.beginPath(); ctx.moveTo(p.x, gy - gr); ctx.lineTo(p.x + gr * 0.8, gy); ctx.lineTo(p.x, gy + gr); ctx.lineTo(p.x - gr * 0.8, gy); ctx.closePath(); ctx.fillStyle = '#58a6ff'; ctx.fill(); }
        placeHits.push({ id: pl.id, x: p.x, y: gy });
      });

      // Your trip: a marker rides from where you were to where you are now.
      var tr = scene.trip, tp = tr ? (Date.now() - tr.at) / 2400 : 2;
      if (tr && tp < 1 && !reduce && D.DISTRICTS[tr.from] && D.DISTRICTS[tr.to] && cityOfDistrict(tr.from) === CITY) {
        var e = tp < 0.5 ? 2 * tp * tp : 1 - Math.pow(-2 * tp + 2, 2) / 2, A = D.DISTRICTS[tr.from], B = D.DISTRICTS[tr.to];
        var q = toScreen(A.x + (B.x - A.x) * e, A.y + (B.y - A.y) * e, 0), icon = { danfo: '🚌', brt: '🚍', cab: '🚕', keke: '🛺', okada: '🏍️', car: '🚗', ferry: '⛴️', boat: '🚤', heli: '🚁', trek: '🚶', rail: '🚆' }[tr.mode] || '🚌';
        ctx.beginPath(); ctx.arc(q.x, q.y - 14, 13, 0, Math.PI * 2); ctx.fillStyle = theme.danfo; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = theme.danfoInk; ctx.stroke();
        var tpic = iconImg(MODE_ICON[tr.mode]);
        if (tpic) ctx.drawImage(tpic, q.x - 15, q.y - 29, 30, 30);
        else { ctx.font = '15px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, q.x, q.y - 13.5); }
        var label = 'On the way to ' + D.DISTRICTS[tr.to].name + '…';
        ctx.font = '700 12px Atkinson Hyperlegible, sans-serif'; var lw = ctx.measureText(label).width + 18;
        ctx.fillStyle = theme.dark ? 'rgba(27,28,30,.92)' : 'rgba(255,255,255,.95)'; roundRect(ctx, W / 2 - lw / 2, H - 44, lw, 24, 12); ctx.fill();
        ctx.fillStyle = theme.ink; ctx.fillText(label, W / 2, H - 31.5);
        ctx.textBaseline = 'alphabetic';
      }

      // Weather over everything: rain streaks (still when motion is reduced), or harmattan haze.
      if (scene.weather === 'rain' || scene.weather === 'storm') {
        var heavy = scene.weather === 'storm', n = Math.round(W * H / (heavy ? 1200 : 2000)), off = reduce ? 0 : clock * (heavy ? 0.9 : 0.6);
        ctx.fillStyle = theme.dark ? 'rgba(20,30,50,.18)' : 'rgba(60,80,110,.12)'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = theme.dark ? 'rgba(190,210,240,.55)' : 'rgba(30,60,110,.5)'; ctx.lineWidth = 1.3; ctx.beginPath();
        for (var ri = 0; ri < n; ri++) {
          var rx = (hash(ri, 3, 11) * (W + 60) + off * 0.35) % (W + 60) - 30, ry = (hash(ri, 7, 13) * (H + 40) + off) % (H + 40) - 20, len = heavy ? 18 : 12;
          ctx.moveTo(rx, ry); ctx.lineTo(rx - len * 0.35, ry + len);
        }
        ctx.stroke();
      } else if (scene.weather === 'harmattan') {
        ctx.fillStyle = theme.dark ? 'rgba(160,130,90,.14)' : 'rgba(214,190,150,.22)'; ctx.fillRect(0, 0, W, H);
      }

      ctx.textBaseline = 'alphabetic';
    }

    // A player's face in a ringed circle.
    function drawFace(img, x, y, r, ring) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fillStyle = ring; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = theme.surface; ctx.fill(); ctx.clip();
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
      ctx.restore();
    }

    var seaImgs = {};
    function seaImage(key, src) {
      var im = seaImgs[key];
      // Room for every block on the board (500 docs); past that, drop the oldest, not the lot.
      if (!im) { var ks = Object.keys(seaImgs); if (ks.length >= 600) delete seaImgs[ks[0]]; im = seaImgs[key] = new Image(); im.onload = function () { kick(); }; im.src = src; }
      return im.complete && im.naturalWidth ? im : null;
    }
    function seaQuad(c, r, w, h) {
      var S = D.SEA, x0 = S.x0 + c * S.gap, y0 = S.y0 + r * S.gap, x1 = x0 + w * S.gap, y1 = y0 + h * S.gap;
      return [toScreen(x0, y0, 0), toScreen(x1, y0, 0), toScreen(x1, y1, 0), toScreen(x0, y1, 0)];
    }
    function pathQuad(q) { ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); for (var i = 1; i < 4; i++) ctx.lineTo(q[i].x, q[i].y); ctx.closePath(); }
    function drawSea() {
      var S = D.SEA, sea = scene.sea || {}, g = S.gap;
      var all = seaQuad(0, 0, S.cols, S.rows);
      pathQuad(all); ctx.fillStyle = theme.dark ? 'rgba(80,140,190,.16)' : 'rgba(255,255,255,.18)'; ctx.fill();
      var cell = Math.hypot(all[1].x - all[0].x, all[1].y - all[0].y) / S.cols;
      // Lite mode draws the grid lines only once you zoom in.
      if (cell > 2.2 && (!lite || cam.z >= 1.5)) {
        ctx.strokeStyle = theme.dark ? 'rgba(170,210,240,.22)' : 'rgba(255,255,255,.45)'; ctx.lineWidth = 0.6; ctx.beginPath();
        var step = cell > 5 ? 1 : cell > 3 ? 2 : 4;
        for (var c = 0; c <= S.cols; c += step) { var a = toScreen(S.x0 + c * g, S.y0, 0), b = toScreen(S.x0 + c * g, S.y0 + S.rows * g, 0); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
        for (var r = 0; r <= S.rows; r += step) { var a2 = toScreen(S.x0, S.y0 + r * g, 0), b2 = toScreen(S.x0 + S.cols * g, S.y0 + r * g, 0); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); }
        ctx.stroke();
      }
      pathQuad(all); ctx.strokeStyle = theme.dark ? 'rgba(170,210,240,.5)' : 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.2; ctx.stroke();
      (sea.claims || []).forEach(function (k) {
        var q = seaQuad(k.x, k.y, k.w, k.h), im = k.img ? seaImage(k.id + ':' + k.imgAt, k.img) : null;
        if (im) {
          ctx.save(); pathQuad(q); ctx.clip();
          // Map picture pixels onto the iso parallelogram of the block.
          ctx.transform((q[1].x - q[0].x) / im.naturalWidth, (q[1].y - q[0].y) / im.naturalWidth, (q[3].x - q[0].x) / im.naturalHeight, (q[3].y - q[0].y) / im.naturalHeight, q[0].x, q[0].y);
          ctx.drawImage(im, 0, 0);
          ctx.restore();
        } else {
          pathQuad(q); ctx.fillStyle = k.color || '#f2b600'; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
          var cx = (q[0].x + q[2].x) / 2, cy = (q[0].y + q[2].y) / 2, sz = Math.min(14, Math.max(7, cell * Math.min(k.w, k.h) * 0.45));
          if (cell * Math.min(k.w, k.h) > 8) { ctx.fillStyle = '#ffffff'; ctx.font = '800 ' + Math.round(sz) + 'px Atkinson Hyperlegible, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(k.label || '?', cx, cy); ctx.textBaseline = 'alphabetic'; }
        }
        pathQuad(q); ctx.lineWidth = k.id === sea.mine ? 2.5 : 1; ctx.strokeStyle = k.id === sea.mine ? theme.danfo : 'rgba(23,24,26,.55)'; ctx.stroke();
      });
      if (sea.sel) {
        var qs = seaQuad(sea.sel.x, sea.sel.y, sea.sel.w, sea.sel.h);
        pathQuad(qs); ctx.fillStyle = sea.sel.bad ? 'rgba(208,69,58,.35)' : 'rgba(242,182,0,.35)'; ctx.fill();
        ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.strokeStyle = sea.sel.bad ? '#d0453a' : theme.danfo; ctx.stroke(); ctx.setLineDash([]);
      }
    }
    function seaCellAt(w) {
      var S = D.SEA, c = Math.floor((w.x - S.x0) / S.gap), r = Math.floor((w.y - S.y0) / S.gap);
      return c >= 0 && r >= 0 && c < S.cols && r < S.rows ? { c: c, r: r } : null;
    }

    // Name chips, most important first; each takes the first free spot
    // above, below, right or left of its pin, or is left off if crowded.
    function placeLabels(list) {
      list.sort(function (a, b) { return a.pri - b.pri; });
      var taken = pins.map(function (p) { return { x: p.x - 7, y: p.y - 7, w: 14, h: 14 }; }).concat(faceBoxes);
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

    // A 3D map pin: a glossy teardrop in the category colour, floating over a ground shadow,
    // with the emoji on a white bead. Used for places, homes and districts.
    function pin3d(g, x, gy, r, col, icon, o) {
      o = o || {};
      var lift = o.lift != null ? o.lift : r * 1.25, bob = o.bob ? Math.sin(clock / 380) * 2 : 0;
      var cy = gy - lift - r + bob;
      // Ground shadow.
      g.beginPath(); g.ellipse(x, gy, r * 0.75, r * 0.32, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,' + (theme.dark ? 0.45 : 0.22) + ')'; g.fill();
      if (o.sel) { g.beginPath(); g.ellipse(x, gy, r * 1.3, r * 0.55, 0, 0, Math.PI * 2); g.strokeStyle = theme.danfo; g.lineWidth = 2; g.stroke(); }
      // Teardrop body with a radial gradient: light from the top left.
      g.beginPath(); g.moveTo(x, gy - 1);
      g.bezierCurveTo(x - r * 0.35, gy - lift * 0.55, x - r * 1.02, cy + r * 0.55, x - r, cy);
      g.arc(x, cy, r, Math.PI, 0);
      g.bezierCurveTo(x + r * 1.02, cy + r * 0.55, x + r * 0.35, gy - lift * 0.55, x, gy - 1);
      g.closePath();
      var gr = g.createRadialGradient(x - r * 0.4, cy - r * 0.45, r * 0.15, x, cy + r * 0.3, r * 1.6);
      gr.addColorStop(0, shade(col, 0.35)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.4));
      g.fillStyle = gr; g.fill();
      g.lineWidth = o.sel ? 2.5 : 1; g.strokeStyle = o.sel ? theme.danfo : shade(col, -0.45); g.stroke();
      // White bead with a soft inner shade, the emoji, then a gloss highlight.
      var br = r * 0.74;
      var bg = g.createRadialGradient(x - br * 0.3, cy - br * 0.35, br * 0.1, x, cy, br);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, o.bead || '#e9ecef');
      g.beginPath(); g.arc(x, cy, br, 0, Math.PI * 2); g.fillStyle = bg; g.fill();
      var pic = iconImg(o.img);
      if (pic) {
        var ps = br * 2.25; g.drawImage(pic, x - ps / 2, cy - ps / 2 - br * 0.05, ps, ps);
      } else if (icon && emojiOk) {
        g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 2; g.shadowOffsetY = 1;
        g.font = Math.round(br * 1.35) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(icon, x, cy + br * 0.1); g.restore();
      } else if (o.glyph) { g.save(); g.beginPath(); g.arc(x, cy, br, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.restore(); glyph(g, o.glyph, x, cy, br * 0.8); }
      g.beginPath(); g.ellipse(x - r * 0.38, cy - r * 0.55, r * 0.38, r * 0.2, -0.6, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
      return cy;
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
      var WX = { rain: '🌧️ Rain', storm: '⛈️ Storm', harmattan: '🌫️ Harmattan' };
      if (WX[scene.weather]) bits.push('<span class="pg-pill">' + WX[scene.weather] + '</span>');
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

    // Pointer: tap a pin to select; drag to pan; pinch, wheel or double-tap to zoom.
    var drag = null, touches = {}, pinch = null, lastTap = 0, MAXZ = 24;
    function zoomAt(z, fx, fy) {
      z = Math.max(1, Math.min(MAXZ, z));
      var wpt = fromScreen(fx, fy);
      cam.z = z;
      if (z === 1) { cam.px = 0; cam.py = 0; }
      else { var q = toScreen(wpt.x, wpt.y, 0); cam.px += fx - q.x; cam.py += fy - q.y; }
      clampCam(); staticKey = ''; kick();
    }
    function local(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    canvas.addEventListener('pointerdown', function (e) {
      touches[e.pointerId] = local(e);
      var ids = Object.keys(touches);
      if (ids.length === 2) {
        var a = touches[ids[0]], b = touches[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: cam.z, a: Math.atan2(b.y - a.y, b.x - a.x), ang: ANG, turned: false };
        drag = null; return;
      }
      drag = { x: e.clientX, y: e.clientY, px: cam.px, py: cam.py, moved: false, turn: e.shiftKey || e.button === 2, ang: ANG };
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (touches[e.pointerId]) touches[e.pointerId] = local(e);
      if (pinch) {
        var ids = Object.keys(touches); if (ids.length < 2) return;
        var a = touches[ids[0]], b = touches[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        // Two-finger twist turns the map (after a small dead zone, so a plain pinch doesn't wobble it).
        var da = Math.atan2(b.y - a.y, b.x - a.x) - pinch.a; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (pinch.turned || Math.abs(da) > 0.12) { pinch.turned = true; setAngle(pinch.ang - da, false); }
        zoomAt(pinch.z * d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      if (drag.moved && drag.turn) { setAngle(drag.ang - dx * 0.008, false); return; } // Shift+drag or right-drag turns the map
      if (drag.moved && cam.z > 1) { cam.px = drag.px + dx; cam.py = drag.py + dy; clampCam(); staticKey = ''; kick(); }
    });
    function lift(e) {
      delete touches[e.pointerId];
      if (Object.keys(touches).length < 2 && pinch) { if (pinch.turned) setAngle(ANG, true); pinch = null; drag = { moved: true }; }
      else if (drag && drag.turn && drag.moved) setAngle(ANG, true);
    }
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('pointercancel', function (e) { lift(e); drag = null; });
    canvas.addEventListener('wheel', function (e) {
      // Only take the wheel when it zooms: at full zoom in or out, let the page scroll.
      if ((e.deltaY < 0 && cam.z >= MAXZ) || (e.deltaY > 0 && cam.z <= 1)) return;
      e.preventDefault();
      var p = local(e);
      zoomAt(cam.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), p.x, p.y);
    }, { passive: false });
    canvas.addEventListener('dblclick', function (e) { var p = local(e); zoomAt(cam.z * 1.6, p.x, p.y); });
    canvas.addEventListener('keydown', function (e) {
      if (e.key === '+' || e.key === '=') { zoomAt(cam.z * 1.25, W / 2, H / 2); e.preventDefault(); }
      else if (e.key === '-' || e.key === '_') { zoomAt(cam.z / 1.25, W / 2, H / 2); e.preventDefault(); }
      else if (e.key === 'q' || e.key === 'Q') { spin(-1); e.preventDefault(); }
      else if (e.key === 'e' || e.key === 'E') { spin(1); e.preventDefault(); }
    });
    function setFull(on) {
      wrap.classList.toggle('pg-full', on);
      document.documentElement.classList.toggle('pg-full-open', on);
      var b = zoom.querySelector('[data-z="full"]'); if (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', on ? 'Exit full screen' : 'Enlarge map'); b.textContent = on ? '✕' : '⛶'; }
      W = 0; resize(); clampCam(); staticKey = ''; kick();
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && wrap.classList.contains('pg-full')) setFull(false); });
    canvas.addEventListener('pointerup', function (e) {
      var wasPinch = !!pinch || Object.keys(touches).length > 1;
      lift(e);
      var d = drag; drag = null;
      if (wasPinch || !d || d.moved) return;
      // Double-tap on touch screens zooms in.
      if (e.pointerType === 'touch') { var now = Date.now(); if (now - lastTap < 300) { lastTap = 0; var lp = local(e); zoomAt(cam.z * 1.6, lp.x, lp.y); return; } lastTap = now; }
      var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 26;
      pins.forEach(function (p) {
        var dd = Math.min(Math.hypot(p.x - x, p.y - y), Math.hypot(p.gx - x, p.gy - y), Math.hypot(p.x - x, p.y - 19 - y));
        if (dd < bd) { bd = dd; best = p.k; }
      });
      var bestPl = null, bpl = 13;
      playerHits.forEach(function (h) { var dd = Math.hypot(h.x - x, h.y - y); if (dd < bpl) { bpl = dd; bestPl = h.by; } });
      if (bestPl && opts.onSelectPlayer) { opts.onSelectPlayer(bestPl); return; }
      var bestHome = null, bh = 15;
      homeHits.forEach(function (h) { var dd = Math.hypot(h.x - x, h.y - y); if (dd < bh) { bh = dd; bestHome = h.id; } });
      if (bestHome && opts.onSelectHome) { opts.onSelectHome(bestHome); return; }
      var bestBoard = null;
      boardHits.forEach(function (b) { if (Math.abs(x - b.x) <= b.w / 2 + 3 && y >= b.y - b.h / 2 - 3 && y <= b.y + b.h / 2) bestBoard = b.id; });
      if (bestBoard && opts.onSelectBoard) { opts.onSelectBoard(bestBoard); return; }
      var bestPlace = null, bp = Math.min(bd, 16);
      // Tap on the estate grid: work back from the screen to world km.
      var w = fromScreen(x, y);
      var seaCell = CITY === 'lagos' && bd > 14 ? seaCellAt(w) : null;
      if (seaCell && opts.onSelectSea && !placeHits.some(function (p) { return Math.hypot(p.x - x, p.y - y) < 12; })) { opts.onSelectSea(seaCell.c, seaCell.r); return; }
      if (!bestHome && bd > 14 && CITY === 'lagos' && w.x > E.x0 && w.x < EX1 && w.y > E.y0 && w.y < EY1 && opts.onSelectPlot) {
        var col = Math.floor((w.x - E.x0) / E.gap), row = Math.floor((w.y - E.y0) / E.gap);
        var hitPlace = placeHits.some(function (p) { return Math.hypot(p.x - x, p.y - y) < 14; });
        if (!hitPlace) { opts.onSelectPlot(row * E.cols + col); return; }
      }
      placeHits.forEach(function (p) { var dd = Math.hypot(p.x - x, p.y - y); if (dd < bp) { bp = dd; bestPlace = p.id; } });
      // Anywhere inside a place's area counts as tapping it; tapping the open place again, or empty map, closes it.
      if (!bestPlace) bestPlace = placeAreaAt(scene.places || [], w);
      if (bestPlace && opts.onSelectPlace) { opts.onSelectPlace(bestPlace === scene.place ? null : bestPlace); return; }
      if (scene.place && opts.onSelectPlace) { opts.onSelectPlace(null); return; }
      if (best && opts.onSelect) opts.onSelect(best);
    });
    // Spin to any angle, keeping the middle of the screen in the middle and the scale steady.
    var spinning = null;
    function setAngle(a, settle) {
      var mid = fromScreen(W / 2, H / 2), scale = base.s * cam.z;
      ANG = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      sortWorld(!settle);
      if (settle) { W = 0; resize(); cam.z = Math.max(1, Math.min(MAXZ, scale / base.s)); try { root.localStorage && root.localStorage.setItem('lasgidi.spin.v2', String(ANG)); } catch (e) {} }
      cam.px = 0; cam.py = 0; var p = toScreen(mid.x, mid.y, 0); cam.px = W / 2 - p.x; cam.py = H / 2 - p.y; clampCam();
      staticKey = ''; kick();
    }
    function spin(dir) {
      // dir +1 turns the map clockwise on screen (the ⟳ arrow); a larger ANG turns it anticlockwise.
      var from = ANG, to = Math.round((ANG - dir * Math.PI / 2) / (Math.PI / 2)) * (Math.PI / 2);
      if (reduce) { setAngle(to, true); return; }
      if (spinning) root.cancelAnimationFrame(spinning);
      var t0 = 0, D = 350;
      var step = function (ts) {
        if (!t0) t0 = ts; var u = Math.min(1, (ts - t0) / D), e = 1 - Math.pow(1 - u, 3);
        setAngle(from + (to - from) * e, u >= 1); spinning = u < 1 ? root.requestAnimationFrame(step) : null;
      };
      spinning = root.requestAnimationFrame(step);
    }
    zoom.addEventListener('click', function (e) {
      var sp = e.target.closest('[data-spin]'); if (sp) { spin(+sp.getAttribute('data-spin')); return; }
      var b = e.target.closest('[data-z]'); if (!b) return;
      if (b.getAttribute('data-z') === 'full') { setFull(!wrap.classList.contains('pg-full')); return; }
      var z = +b.getAttribute('data-z');
      if (z === 0) { cam.z = Math.max(1.8, cam.z); centreOn(scene.loc); clampCam(); staticKey = ''; kick(); }
      else zoomAt(z > 0 ? cam.z * 1.4 : cam.z / 1.4, W / 2, H / 2);
    });
    function centreOn(k) {
      cam.px = 0; cam.py = 0;
      var d = D.DISTRICTS[k], p = toScreen(d.x, d.y, 0);
      cam.px = W / 2 - p.x; cam.py = H / 2 - p.y;
    }
    function clampCam() {
      var lim = (cam.z - 1) * Math.max(W, H) * 0.62;
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
      // Screen point of the centre of a sea plot (for tests and keyboard help).
      // Fly the camera to the Sea Plots grid.
      focusAt: function (x, y, z) { cam.z = z || 3; cam.px = 0; cam.py = 0; var p = toScreen(x, y, 0); cam.px = W / 2 - p.x; cam.py = H / 2 - p.y; clampCam(); staticKey = ''; kick(); },
      focusSea: function () { var S = D.SEA; cam.z = Math.max(cam.z, W < 600 ? 3 : 2.4); cam.px = 0; cam.py = 0; var p = toScreen(S.x0 + S.cols * S.gap / 2, S.y0 + S.rows * S.gap / 2, 0); cam.px = W / 2 - p.x; cam.py = H / 2 - p.y; clampCam(); staticKey = ''; kick(); },
      worldPoint: function (x, y) { var p = toScreen(x, y, 0); return { x: p.x, y: p.y }; }, // screen point of a world spot (for tests)
      seaPoint: function (c, r) { var S = D.SEA, p = toScreen(S.x0 + (c + 0.5) * S.gap, S.y0 + (r + 0.5) * S.gap, 0); return { x: p.x, y: p.y }; },
      update: function (next) {
        if ((next.city || 'lagos') !== CITY) { buildWorld(next.city || 'lagos'); rebuildTraffic(); W = 0; cam = { z: 1, px: 0, py: 0 }; staticKey = ''; }
        scene = next;
        theme = readTheme();
        canvas.setAttribute('aria-label', 'Isometric map of Lagos. You are in ' + D.DISTRICTS[next.loc].name + ', ' + next.clock + '. Use the district buttons below to plan a trip.');
        hud.innerHTML = hudHtml();
        resize();
        // Open zoomed in on where you are, so the land fills the map; zoom out for the whole city.
        if (!opened && W && D.DISTRICTS[next.loc]) { opened = true; var dl = D.DISTRICTS[next.loc]; cam.z = OPEN_ZOOM; cam.px = 0; cam.py = 0; var fp = toScreen(dl.x, dl.y, 0); cam.px = W / 2 - fp.x; cam.py = H / 2 - fp.y; clampCam(); staticKey = ''; }
        kick();
      }
    };
  }

  root.LasgidiPlayground = { create: create, isWater: isWater, nearestDistrict: nearestDistrict, ESTATES: ESTATES, GEO: GEO };
})(typeof globalThis !== 'undefined' ? globalThis : this);
