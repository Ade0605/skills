/* Lasgidi: your home, inside, in real 3D (three.js). Same interface as the 2D room (src/interior.js):
   create({ onSelect(i), onPlace(i, x, y, r) }) → { el, update(view) }, where view = { size: [w, d], type, name, items,
   vehicles, sel, power, hour, paint, look, outfit }. The floor is the same tile grid the engine places furniture on,
   with low partition walls for the rooms of bigger homes, two walls with windows and a door, every item modelled
   by its shape (beds, sofas, tables, TVs, fans, art, rugs, plants, fridges, cookers, the gen...), your rides on the
   driveway, and you standing in the room. Tap an item to pick it, drag it or tap a tile to move it, ⤾ to turn it.
   Drag the empty floor to look around, pinch or scroll to zoom. Moves go through the engine via the callbacks. */
(function (root) {
  'use strict';
  var D = root.LASGIDI_DATA;
  var FLOORS = { room: 0x9a958b, share: 0xb8ab92, selfcon: 0xd8ccb4, miniflat: 0xd8ccb4, flat2: 0xcdb79a, flat3: 0xcdb79a, duplex: 0xa77b52, luxury: 0xe9e6df, mansion: 0xefece4 };
  var WALLS = { room: 0xc9bfa6, share: 0xd6ccb4, selfcon: 0xe2dccd, miniflat: 0xe2dccd, flat2: 0xe7e1d2, flat3: 0xe7e1d2, duplex: 0xefe9dc, luxury: 0x3a3c42, mansion: 0xf4f1ea };
  var ROOM_FLOORS = { Kitchen: 0xe6e1d6, Bathroom: 0xc7d9df };
  function roomsFor(type, sz) {
    var w = sz[0], d = sz[1];
    if (type === 'room' || type === 'share' || type === 'selfcon') return [];
    if (type === 'miniflat') { var m = Math.ceil(w / 2); return [{ x: 0, y: 0, w: m, d: d, name: 'Bedroom' }, { x: m, y: 0, w: w - m, d: d, name: 'Living room' }]; }
    var a = Math.round(w * 0.55), b = Math.round(d * 0.5);
    var out = [{ x: 0, y: 0, w: a, d: b, name: 'Bedroom' }, { x: a, y: 0, w: w - a, d: b, name: 'Kitchen' }, { x: 0, y: b, w: a, d: d - b, name: 'Living room' }, { x: a, y: b, w: w - a, d: d - b, name: 'Bathroom' }];
    if (type === 'mansion' || type === 'duplex') { var h = Math.round(a / 2); out[0] = { x: 0, y: 0, w: h, d: b, name: 'Bedroom' }; out.splice(1, 0, { x: h, y: 0, w: a - h, d: b, name: 'Guest room' }); }
    return out;
  }
  function hexN(h, f) { return typeof h === 'number' ? h : parseInt(String(h || f || '#888888').replace('#', ''), 16); }

  function create(opts) {
    opts = opts || {};
    var T = root.THREE; if (!T) return null;
    var wrap = document.createElement('div'); wrap.className = 'iv iv-3d';
    var renderer; try { renderer = new T.WebGLRenderer({ antialias: true }); } catch (e) { return null; }
    var LITE = (root.innerWidth || 1000) < 700 || ((root.navigator || {}).hardwareConcurrency || 8) <= 4;
    renderer.setPixelRatio(Math.min(LITE ? 1.25 : 2, root.devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.toneMapping = T.ACESFilmicToneMapping;
    var cv = renderer.domElement; cv.className = 'iv-canvas'; cv.setAttribute('role', 'img'); wrap.appendChild(cv);
    var bar = document.createElement('div'); bar.className = 'iv-spin';
    bar.innerHTML = '<button type="button" class="pg-zbtn" data-h3="turn" aria-label="Turn the picked item" title="Turn the item">⤾</button><button type="button" class="pg-zbtn" data-h3="l" aria-label="Look left">⟲</button><button type="button" class="pg-zbtn" data-h3="r" aria-label="Look right">⟳</button><button type="button" class="pg-zbtn" data-h3="in" aria-label="Zoom in">+</button><button type="button" class="pg-zbtn" data-h3="out" aria-label="Zoom out">−</button>';
    wrap.appendChild(bar);
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var S3 = new T.Scene(), cam = new T.PerspectiveCamera(40, 1, 0.1, 400), view = null, raf = 0, W = 0, H = 0, key = '';
    S3.background = new T.Color(0x1d2228);
    var hemi = new T.HemisphereLight(0xfff4e6, 0x5a5048, 0.7), sun = new T.DirectionalLight(0xfff1d8, 1.4); sun.castShadow = true; sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048); var shc = sun.shadow.camera; shc.left = -14; shc.right = 14; shc.top = 14; shc.bottom = -14; sun.shadow.bias = -0.0006;
    S3.add(hemi, sun, sun.target); var lamp = new T.PointLight(0xffd8a0, 0, 30, 1.4); S3.add(lamp);
    var home = new T.Group(); S3.add(home); var items3 = [], fans = [], screens = [], ghost = null;
    var Mc = {}; function mat(k, o) { return Mc[k] || (Mc[k] = new T.MeshStandardMaterial(o)); }
    function M(color, rough, metal) { return new T.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.7 : rough, metalness: metal || 0 }); }
    function box(g, w, h, d, m, x, y, z) { var o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; }
    function cyl(g, r1, r2, h, m, x, y, z, seg) { var o = new T.Mesh(new T.CylinderGeometry(r1, r2, h, seg || 16), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; }
    function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }

    // One item, modelled in its footprint (w × d tiles) with its height; the group's origin is the footprint's corner.
    function model(it, f) {
      var dims = it.r ? [f.d, f.w] : [f.w, f.d], w = dims[0], d = dims[1], h = Math.max(0.15, (f.h || 4) * 0.11), c = hexN(f.color), g = new T.Group(), cx = w / 2, cz = d / 2, m = M(c, 0.6), nm = f.name || '';
      if (f.shape === 'bed') { box(g, w - 0.1, 0.3, d - 0.1, M(0x5a3b22, 0.7), cx, 0.15, cz); box(g, w - 0.2, Math.max(0.18, h * 0.5), d - 0.2, M(0xf4f1ea, 0.9), cx, 0.3 + h * 0.25, cz); box(g, w - 0.24, 0.06, (d - 0.2) * 0.6, m, cx, 0.36 + h * 0.5, cz + (d - 0.2) * 0.2);
        var hb = it.r ? box(g, 0.12, 0.9, d - 0.1, M(0x4a2f1c, 0.6), 0.06, 0.6, cz) : box(g, w - 0.1, 0.9, 0.12, M(0x4a2f1c, 0.6), cx, 0.6, 0.06); [0.3, 0.7].forEach(function (u) { box(g, it.r ? 0.35 : (w - 0.3) * 0.4, 0.14, it.r ? (d - 0.3) * 0.4 : 0.35, M(0xffffff, 0.9), it.r ? 0.35 : cx + (u - 0.5) * (w - 0.4), 0.42 + h * 0.5, it.r ? cz + (u - 0.5) * (d - 0.4) : 0.35); }); }
      else if (f.shape === 'sofa') { box(g, w - 0.1, 0.4, d - 0.1, m, cx, 0.3, cz); if (it.r) box(g, 0.25, 0.75, d - 0.1, m, 0.15, 0.55, cz); else box(g, w - 0.1, 0.75, 0.25, m, cx, 0.55, 0.15); [[0.12, cz], [w - 0.12, cz]].forEach(function (q) { if (!it.r) box(g, 0.2, 0.55, d - 0.1, m, q[0], 0.45, q[1]); }); if (it.r) [[cx, 0.12], [cx, d - 0.12]].forEach(function (q) { box(g, w - 0.1, 0.55, 0.2, m, q[0], 0.45, q[1]); }); }
      else if (f.shape === 'table') { var pool = /pool/i.test(nm), top = box(g, w - 0.2, 0.08, d - 0.2, pool ? M(0x1d7a43, 0.9) : m, cx, pool ? 0.8 : 0.72, cz); [[0.2, 0.2], [w - 0.2, 0.2], [0.2, d - 0.2], [w - 0.2, d - 0.2]].forEach(function (q) { cyl(g, 0.04, 0.04, pool ? 0.8 : 0.72, M(0x3a2a1a), q[0], (pool ? 0.8 : 0.72) / 2, q[1], 6); }); if (/dining/i.test(nm)) [[cx - 0.5, -0.05], [cx + 0.5, -0.05], [cx - 0.5, d + 0.05], [cx + 0.5, d + 0.05]].forEach(function (q) { box(g, 0.4, 0.45, 0.4, M(0x6b4a2b), q[0], 0.23, q[1]); box(g, 0.4, 0.5, 0.06, M(0x6b4a2b), q[0], 0.7, q[1] < 0 ? q[1] - 0.17 : q[1] + 0.17); }); if (/centre/i.test(nm)) { top.position.y = 0.42; top.scale.y = 1; g.children.slice(1).forEach(function (l) { l.scale.y = 0.55; l.position.y = 0.2; }); } }
      else if (f.shape === 'chair') { for (var ch = 0; ch < Math.max(1, Math.round(w * d)); ch++) { var px = 0.5 + (ch % w), pz = 0.5 + Math.floor(ch / w); box(g, 0.44, 0.06, 0.44, m, px, 0.45, pz); box(g, 0.44, 0.45, 0.06, m, px, 0.7, pz - 0.2); [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (q) { cyl(g, 0.025, 0.025, 0.45, m, px + q[0], 0.22, pz + q[1], 5); }); } }
      else if (f.shape === 'rug') { var rt = canvasTex(128, 128, function (cx2, w2, h2) { cx2.fillStyle = '#' + c.toString(16).padStart(6, '0'); cx2.fillRect(0, 0, w2, h2); cx2.strokeStyle = 'rgba(255,255,255,.6)'; cx2.lineWidth = 6; cx2.strokeRect(10, 10, w2 - 20, h2 - 20); for (var k = 0; k < 6; k++) { cx2.fillStyle = ['#f2b600', '#17181a', '#ffffff'][k % 3]; cx2.beginPath(); cx2.arc(30 + (k % 3) * 34, 40 + Math.floor(k / 3) * 48, 10, 0, Math.PI * 2); cx2.fill(); } }); var rug = new T.Mesh(new T.PlaneGeometry(w - 0.1, d - 0.1).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: rt, roughness: 1 })); rug.position.set(cx, 0.015, cz); rug.receiveShadow = true; g.add(rug); }
      else if (f.shape === 'tv') { box(g, w - 0.2, 0.45, d * 0.6, M(0x2b2f36, 0.5), cx, 0.23, cz); var scr = new T.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.2, emissive: 0x2f6fd0, emissiveIntensity: 0 }); var sm = box(g, it.r ? 0.06 : w - 0.1, Math.max(0.6, h * 0.8), it.r ? d - 0.1 : 0.06, scr, cx, 0.5 + Math.max(0.6, h * 0.8) / 2, cz); screens.push(scr); }
      else if (f.shape === 'pole') { if (/fan/i.test(nm)) { cyl(g, 0.15, 0.2, 0.06, M(0x2b2f36), cx, 0.03, cz); cyl(g, 0.02, 0.02, 1.2, M(0xdfe3e8, 0.3, 0.6), cx, 0.6, cz, 6); var hd = new T.Group(); hd.position.set(cx, 1.25, cz); for (var bl = 0; bl < 3; bl++) { var blade = box(hd, 0.08, 0.02, 0.4, M(0xf4f3ec), 0, 0, 0.2); blade.position.set(Math.sin(bl * 2.09) * 0.2, 0, Math.cos(bl * 2.09) * 0.2); blade.rotation.y = bl * 2.09; } hd.rotation.x = Math.PI / 2; g.add(hd); fans.push(hd); }
        else if (/chandelier/i.test(nm)) { var chm = new T.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffd27a, emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.4 }); cyl(g, 0.02, 0.02, 0.8, M(0xd4af37, 0.3, 0.8), cx, 2.6, cz, 6); for (var cr = 0; cr < 8; cr++) { var a = cr / 8 * Math.PI * 2; var dr = new T.Mesh(new T.OctahedronGeometry(0.08, 0), chm); dr.position.set(cx + Math.cos(a) * 0.35, 2.1, cz + Math.sin(a) * 0.35); g.add(dr); } cyl(g, 0.4, 0.1, 0.25, chm, cx, 2.25, cz); screens.push(chm); }
        else { cyl(g, 0.22, 0.26, 0.5, M(0x3a2a1a), cx, 0.25, cz); var br = new T.Mesh(new T.SphereGeometry(0.18, 18, 14), M(0x7a5530, 0.35, 0.75)); br.position.set(cx, 0.75, cz); br.scale.set(0.85, 1.2, 0.9); g.add(br); cyl(g, 0.17, 0.15, 0.22, M(0x7a5530, 0.35, 0.75), cx, 1.0, cz); } }
      else if (f.shape === 'wallbox') { if (/AC/.test(nm)) { box(g, w - 0.1, 0.3, 0.22, M(0xf7f7f5, 0.4), cx, 2.1, 0.12); box(g, w - 0.3, 0.03, 0.02, M(0x9aa0a6), cx, 2.0, 0.24); } else { box(g, w - 0.2, 0.75, 0.05, M(0x17181a, 0.5), cx, 1.6, 0.03); var art = canvasTex(128, 96, function (ag, aw, ah) { ag.fillStyle = '#c0392b'; ag.fillRect(0, 0, aw, ah); for (var k = 0; k < 9; k++) { ag.fillStyle = ['#f2b600', '#1f5fa0', '#2fa36b'][k % 3]; ag.beginPath(); ag.arc(14 + (k % 3) * 50, 16 + Math.floor(k / 3) * 32, 11, 0, Math.PI * 2); ag.fill(); } }); var ap = new T.Mesh(new T.PlaneGeometry(w - 0.32, 0.64), new T.MeshStandardMaterial({ map: art })); ap.position.set(cx, 1.6, 0.06); g.add(ap); } }
      else if (f.shape === 'plant') { cyl(g, 0.2, 0.15, 0.35, M(0xb5603a, 0.8), cx, 0.18, cz); for (var lf = 0; lf < 7; lf++) { var lm = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), M(0x3f8f3a, 0.8)); lm.position.set(cx + Math.cos(lf * 0.9) * 0.16, 0.5 + (lf % 3) * 0.16, cz + Math.sin(lf * 0.9) * 0.16); lm.scale.set(0.7, 1.4, 0.7); lm.castShadow = true; g.add(lm); } }
      else {
        // Boxes: fridge, cooker, wardrobe, piano, aquarium, treadmill, gen, inverter, solar, console, sound system, net.
        if (/fridge/i.test(nm)) { box(g, w - 0.15, h, d - 0.15, M(0xeef1f3, 0.3, 0.3), cx, h / 2, cz); box(g, 0.04, h * 0.5, 0.04, M(0x9aa0a6, 0.3, 0.8), w - 0.25, h * 0.6, d - 0.05); }
        else if (/cooker/i.test(nm)) { box(g, w - 0.1, 0.85, d - 0.1, M(0xdfe3e8, 0.4, 0.4), cx, 0.43, cz); [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]].forEach(function (q) { cyl(g, 0.12, 0.12, 0.03, M(0x17181a), q[0] * w, 0.87, q[1] * d, 12); }); }
        else if (/piano/i.test(nm)) { box(g, w - 0.1, 0.9, d - 0.2, M(0x0b0b0e, 0.15, 0.3), cx, 0.75, cz); box(g, w - 0.3, 0.05, 0.3, M(0xf4f3ec), cx, 0.85, d - 0.15); }
        else if (/aquarium/i.test(nm)) { box(g, w - 0.1, 0.7, d - 0.1, M(0x2b2f36), cx, 0.35, cz); var aq = new T.Mesh(new T.BoxGeometry(w - 0.15, 0.6, d - 0.15), new T.MeshPhysicalMaterial({ color: 0x5fb3cf, transparent: true, opacity: 0.55, roughness: 0.05 })); aq.position.set(cx, 1.0, cz); g.add(aq); }
        else if (/treadmill/i.test(nm)) { box(g, w - 0.1, 0.15, d - 0.2, M(0x17181a), cx, 0.1, cz); box(g, 0.6, 1.1, 0.08, M(0x3a3f46), cx, 0.65, 0.12); }
        else if (/gen/i.test(nm)) { box(g, w - 0.15, h, d - 0.15, M(/pass my/.test(nm) ? 0xc0392b : 0xf2b600, 0.5), cx, h / 2, cz); box(g, (w - 0.15) * 0.6, 0.1, 0.1, M(0x17181a), cx, h + 0.05, cz); }
        else if (/solar/i.test(nm)) { var pn = box(g, w - 0.1, 0.05, d - 0.1, M(0x1a2a4a, 0.2, 0.4), cx, 0.6, cz); pn.rotation.x = -0.4; box(g, 0.08, 0.6, 0.08, M(0x9aa0a6), cx, 0.3, cz); }
        else if (/net/i.test(nm)) { var net = new T.Mesh(new T.ConeGeometry(Math.max(w, d) * 0.55, 1.9, 16, 1, true), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: T.DoubleSide })); net.position.set(cx, 1.05, cz); g.add(net); }
        else if (/sound/i.test(nm)) { [0.25, 0.75].forEach(function (u) { box(g, 0.4, h, 0.4, M(0x17181a, 0.5), u * w, h / 2, cz); cyl(g, 0.12, 0.12, 0.02, M(0x3a3f46), u * w, h * 0.6, cz + 0.21, 14).rotation.x = Math.PI / 2; }); }
        else box(g, w - 0.12, h, d - 0.12, m, cx, h / 2, cz);
        if (/wardrobe/i.test(nm)) box(g, 0.02, h * 0.8, 0.02, M(0xd4af37, 0.3, 0.8), cx, h / 2, d - 0.05);
      }
      return g;
    }
    function vehicleModel(V) {
      var g = new T.Group(), c = hexN(V.color, '#c0392b'), body = M(c, 0.3, 0.5), glass = M(0x2c4a5c, 0.05, 0.8), k = V.kind;
      if (k === 'boat') { box(g, 4, 0.6, 1.4, M(0xf4f3ec, 0.4), 0, 0.3, 0); box(g, 1.6, 0.5, 1.1, glass, -0.4, 0.85, 0); }
      else if (k === 'heli') { var b2 = new T.Mesh(new T.SphereGeometry(0.7, 16, 12), body); b2.scale.set(1.4, 0.9, 0.9); b2.position.y = 0.9; g.add(b2); box(g, 2.4, 0.15, 0.15, body, -1.6, 1.0, 0); box(g, 4.2, 0.04, 0.2, M(0x17181a), 0, 1.65, 0); }
      else if (k === 'jet') { var j = new T.Mesh(new T.CapsuleGeometry(0.4, 3.4, 4, 12).rotateZ(Math.PI / 2), M(0xf7f7f5, 0.3, 0.3)); j.position.y = 0.8; g.add(j); box(g, 1.2, 0.06, 4.4, M(0xf7f7f5), 0, 0.75, 0); box(g, 0.5, 0.9, 0.06, body, -1.9, 1.3, 0); }
      else if (k === 'bus') { box(g, 4.4, 1.6, 1.6, M(0xf2c200, 0.5), 0, 1.0, 0); box(g, 3.4, 0.5, 1.62, glass, -0.2, 1.4, 0); }
      else { var bike = /keke|bike|okada/i.test(V.name || ''); box(g, bike ? 1.8 : 3.6, bike ? 0.9 : 0.7, bike ? 1.0 : 1.6, body, 0, 0.55, 0); box(g, bike ? 1.0 : 2, 0.55, bike ? 0.95 : 1.5, glass, -0.1, bike ? 1.2 : 1.15, 0); }
      [[-1.1, 0.75], [1.1, 0.75], [-1.1, -0.75], [1.1, -0.75]].forEach(function (q) { if (k === 'boat' || k === 'heli' || k === 'jet') return; var wh = cyl(g, 0.3, 0.3, 0.22, M(0x111111), q[0] * (k === 'bus' ? 1.5 : 1), 0.3, q[1], 12); wh.rotation.x = Math.PI / 2; });
      return g;
    }
    function build() {
      home.clear(); items3 = []; fans = []; screens = []; ghost = null;
      var sz = view.size || [4, 3], w = sz[0], d = sz[1], type = view.type || 'room', wallC = view.paint ? hexN(view.paint) : WALLS[type] || 0xe2dccd;
      // Floor tiles, room floors, the two walls with windows and a door, skirting.
      var tileM = [M(FLOORS[type] || 0xd8ccb4, 0.55), M(((FLOORS[type] || 0xd8ccb4) & 0xfefefe) - 0x0a0a0a, 0.55)], rooms = roomsFor(type, sz);
      for (var x = 0; x < w; x++) for (var y = 0; y < d; y++) { var rm = rooms.filter(function (r) { return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.d; })[0], fm = rm && ROOM_FLOORS[rm.name] ? M(ROOM_FLOORS[rm.name], 0.4) : tileM[(x + y) % 2]; var t = new T.Mesh(new T.BoxGeometry(0.98, 0.06, 0.98), fm); t.position.set(x + 0.5, -0.03, y + 0.5); t.receiveShadow = true; t.userData.tile = [x, y]; home.add(t); }
      var wm = M(wallC, 0.85), WH = 2.8;
      box(home, w, WH, 0.12, wm, w / 2, WH / 2, -0.06); box(home, 0.12, WH, d, wm, -0.06, WH / 2, d / 2);
      var glass = new T.MeshStandardMaterial({ color: 0xbfe0f2, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.1 }); var wins = [];
      for (var wx = 1; wx < w - 0.5; wx += 2.5) { box(home, 1.2, 1.1, 0.04, glass, wx + 0.4, 1.6, 0.02); box(home, 1.3, 0.06, 0.1, M(0xf4f3ec), wx + 0.4, 1.02, 0.05); wins.push(glass); }
      for (var wz = 1.2; wz < d - 0.5; wz += 2.8) box(home, 0.04, 1.1, 1.2, glass, 0.02, 1.6, wz + 0.4);
      box(home, 0.9, 2.0, 0.05, M(0x6b4a2b, 0.6), w - 1, 1.0, 0.03); cyl(home, 0.03, 0.03, 0.06, M(0xd4af37, 0.3, 0.8), w - 0.7, 1.0, 0.07, 8).rotation.x = Math.PI / 2;
      box(home, w, 0.12, 0.03, M(0x5a4632), w / 2, 0.06, 0.02); box(home, 0.03, 0.12, d, M(0x5a4632), 0.02, 0.06, d / 2);
      rooms.forEach(function (r) { if (r.x + r.w < w) for (var py = r.y; py < r.y + r.d; py++) { if (py === r.y + Math.floor(r.d / 2)) continue; box(home, 0.08, 1.1, 1, wm, r.x + r.w, 0.55, py + 0.5); } if (r.y + r.d < d) for (var px = r.x; px < r.x + r.w; px++) { if (px === r.x + Math.floor(r.w / 2)) continue; box(home, 1, 1.1, 0.08, wm, px + 0.5, 0.55, r.y + r.d); } });
      // Furniture.
      (view.items || []).forEach(function (it, i) { if (it.x == null) return; var f = D.FURNITURE[it.id]; if (!f) return; var g = model(it, f); g.position.set(it.x, 0, it.y); g.traverse(function (o) { o.userData.item = i; }); home.add(g); items3[i] = g; });
      // Outside: a paved driveway with your rides.
      var drive = new T.Mesh(new T.PlaneGeometry(6, Math.max(d, 6)).rotateX(-Math.PI / 2), M(0x8a8d84, 0.9)); drive.position.set(w + 3.5, -0.05, d / 2); drive.receiveShadow = true; home.add(drive);
      (view.vehicles || []).slice(0, 6).forEach(function (v, i) { var V = D.VEHICLES[v.id]; if (!V) return; var vm = vehicleModel(V); vm.position.set(w + 3.5, 0, 1.6 + i * 2.6); vm.rotation.y = Math.PI / 2 * (i % 2 ? 1 : -1) * 0 + Math.PI / 2; home.add(vm); });
      // You, standing in the room.
      if (root.LasgidiAvatar3D && view.look) { var me = root.LasgidiAvatar3D.figure(T, view.look, view.outfit || {}, null); me.scale.setScalar(0.95); var free = freeTile(); me.position.set(free[0] + 0.5, 0, free[1] + 0.5); me.rotation.y = 0.6; home.add(me); }
      HOMEW = w; HOMED = d; orbit.tx = w / 2 + 0.8; orbit.tz = d / 2; orbit.r = Math.max(7, Math.max(w, d) * 1.25); place();
      sun.position.set(w / 2 + 8, 12, d / 2 + 10); sun.target.position.set(w / 2, 0, d / 2); lamp.position.set(w / 2, 2.5, d / 2);
      WIN = glass;
    }
    var HOMEW = 4, HOMED = 3, WIN = null;
    function occupied() { var occ = {}; (view.items || []).forEach(function (it) { if (it.x == null) return; var f = D.FURNITURE[it.id]; if (!f) return; var dm = it.r ? [f.d, f.w] : [f.w, f.d]; for (var a = 0; a < dm[0]; a++) for (var b = 0; b < dm[1]; b++) occ[(it.x + a) + ',' + (it.y + b)] = 1; }); return occ; }
    function freeTile() { var occ = occupied(), w = (view.size || [4, 3])[0], d = (view.size || [4, 3])[1]; for (var y = d - 1; y >= 0; y--) for (var x = w - 1; x >= 0; x--) if (!occ[x + ',' + y]) return [x, y]; return [w - 1, d - 1]; }
    function selectGlow() { items3.forEach(function (g, i) { if (!g) return; g.traverse(function (o) { if (o.isMesh && o.material && o.material.emissive && !o.userData.keepEmissive) { o.material = o.material.clone(); o.material.emissive.set(i === view.sel ? 0xffb000 : 0x000000); o.material.emissiveIntensity = i === view.sel ? 0.35 : 0; } }); }); }

    /* ---------- camera and pointer ---------- */
    var orbit = { az: -0.75, pol: 0.95, r: 9, tx: 2, tz: 1.5 }, ptrs = {}, drag = null, moved = false, pinch0 = 0;
    function place() { orbit.pol = Math.max(0.35, Math.min(1.25, orbit.pol)); orbit.r = Math.max(3, Math.min(40, orbit.r)); var s = Math.sin(orbit.pol); cam.position.set(orbit.tx + orbit.r * s * Math.sin(orbit.az + Math.PI), orbit.r * Math.cos(orbit.pol), orbit.tz - orbit.r * s * Math.cos(orbit.az + Math.PI)); cam.lookAt(orbit.tx, 0.4, orbit.tz); }
    var ray = new T.Raycaster(), ndc = new T.Vector2(), floorPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    function pick(e) { var r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); var h = ray.intersectObjects(home.children, true).filter(function (x) { return x.object.userData.item != null || x.object.userData.tile; })[0]; var p = new T.Vector3(); var tile = ray.ray.intersectPlane(floorPlane, p) ? [Math.floor(p.x), Math.floor(p.z)] : null; return { item: h && h.object.userData.item != null ? h.object.userData.item : null, tile: tile }; }
    cv.addEventListener('pointerdown', function (e) { ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; var p = pick(e); drag = { x: e.clientX, y: e.clientY, item: p.item != null && p.item === view.sel ? p.item : null }; moved = false; var a = Object.values(ptrs); if (a.length === 2) pinch0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
    cv.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; var a = Object.values(ptrs);
      if (a.length === 2 && pinch0) { var dd = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); orbit.r *= pinch0 / Math.max(1, dd); pinch0 = dd; moved = true; place(); return; }
      if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (drag.item != null && moved) { var p = pick(e); if (p.tile && items3[drag.item]) { items3[drag.item].position.set(p.tile[0], 0.08, p.tile[1]); drag.to = p.tile; } return; }
      orbit.az -= dx * 0.006; orbit.pol -= dy * 0.004; drag.x = e.clientX; drag.y = e.clientY; place();
    });
    function up(e) { delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch0 = 0; }
    cv.addEventListener('pointerup', function (e) { var d0 = drag, mv = moved; up(e); drag = null; if (!view) return;
      if (d0 && d0.item != null && d0.to) { var it = view.items[d0.item]; opts.onPlace && opts.onPlace(d0.item, d0.to[0], d0.to[1], it.r); return; }
      if (mv) return; var p = pick(e);
      if (p.item != null) { opts.onSelect && opts.onSelect(p.item); return; }
      if (p.tile && view.sel != null && p.tile[0] >= 0 && p.tile[1] >= 0) { opts.onPlace && opts.onPlace(view.sel, p.tile[0], p.tile[1], view.items[view.sel].r); return; }
      opts.onSelect && opts.onSelect(null); });
    cv.addEventListener('pointercancel', up); cv.addEventListener('wheel', function (e) { e.preventDefault(); orbit.r *= Math.exp(e.deltaY * 0.0012); place(); }, { passive: false });
    bar.addEventListener('click', function (e) { var b = e.target.closest('[data-h3]'); if (!b || !view) return; var a = b.getAttribute('data-h3');
      if (a === 'turn') { var it = view.items[view.sel]; if (it && it.x != null && opts.onPlace) opts.onPlace(view.sel, it.x, it.y, it.r ? 0 : 1); return; }
      if (a === 'in') orbit.r *= 0.8; else if (a === 'out') orbit.r *= 1.25; else orbit.az += (a === 'l' ? 1 : -1) * Math.PI / 6; place(); });

    function size() { var w = wrap.clientWidth || 360, h = wrap.clientHeight || 360; if (w === W && h === H) return; W = w; H = h; renderer.setSize(W, H, false); cv.style.width = W + 'px'; cv.style.height = H + 'px'; cam.aspect = W / H; cam.updateProjectionMatrix(); }
    function frame(now) {
      size(); var t = reduce ? 0 : now / 1000, hr = view && view.hour != null ? view.hour : 12, night = hr >= 19 || hr < 6, lit = view && view.power;
      hemi.intensity = night ? (lit ? 0.55 : 0.18) : 0.75; sun.intensity = night ? 0.05 : 1.4; lamp.intensity = night ? (lit ? 14 : 3) : 0; lamp.color.set(lit ? 0xffd8a0 : 0xff9a40);
      if (WIN) { WIN.emissiveIntensity = night ? 0.05 : 0.7; WIN.color.set(night ? 0x1a2a4a : 0xbfe0f2); }
      fans.forEach(function (f) { f.rotation.z = lit || !night ? t * 12 : 0; }); screens.forEach(function (m) { m.emissiveIntensity = lit || !night ? 0.4 + Math.sin(t * 3) * 0.1 : 0; });
      renderer.render(S3, cam); raf = wrap.isConnected ? root.requestAnimationFrame(frame) : 0;
    }
    return {
      el: wrap, is3d: true,
      // Screen point (relative to the canvas) of a floor tile's centre, for tests and keyboard help.
      tilePoint: function (x, y) { var v = new T.Vector3(x + 0.5, 0, y + 0.5).project(cam); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H }; },
      update: function (v) { view = v; cv.setAttribute('aria-label', 'Inside your home in 3D: ' + v.name + ', ' + (v.items || []).filter(function (i) { return i.x != null; }).length + ' items placed. Tap an item, then drag it or tap a tile to move it.');
        var k = JSON.stringify([v.size, v.type, v.paint, v.items, (v.vehicles || []).map(function (x) { return x.id; }), v.look, v.outfit]); if (k !== key) { key = k; build(); }
        selectGlow(); if (!raf) raf = root.requestAnimationFrame(frame); }
    };
  }
  root.LasgidiHome3D = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
