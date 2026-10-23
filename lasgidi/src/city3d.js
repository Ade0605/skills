/* Lasgidi: the city map in real 3D (three.js). Built from the same data as the 2D map (src/playground.js):
   the land and water polygons, the generated blocks and trees, the roads between districts, the ferry lanes,
   the landmarks and every place's pin. Drag to pan, right-drag or two fingers to turn, wheel or pinch to zoom.
   Taps call the same callbacks as the 2D map: onSelectPlace(id) for a pin or a landmark's area, onSelect(k) for
   a district. Interface: create(opts) → { el, update(scene), start, stop, flyTo(x, y), is3d }. */
(function (root) {
  'use strict';
  var K = 10; // 3D units per km

  function create(opts) {
    opts = opts || {};
    var T = root.THREE, PG = root.LasgidiPlayground, D = root.LASGIDI_DATA; if (!T || !PG || !PG.worldFor || !D) return null;
    var el = document.createElement('div'); el.className = 'city-3d';
    var renderer; try { renderer = root.LasgidiGL ? root.LasgidiGL.make({}) : new T.WebGLRenderer({ antialias: true }); } catch (e) { return null; } if (!renderer) return null;
    var LITE = root.LasgidiGL ? root.LasgidiGL.lite() : (root.innerWidth || 1000) < 700 || ((root.navigator || {}).hardwareConcurrency || 8) <= 4;
    if (!root.LasgidiGL) renderer.setPixelRatio(Math.min(LITE ? 1.25 : 2, root.devicePixelRatio || 1)); renderer.shadowMap.enabled = !LITE; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    var cv = renderer.domElement; cv.className = 'city-canvas'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'The city in 3D. Drag to move, pinch or scroll to zoom, two fingers to turn. Tap a pin to open a place.'); el.appendChild(cv);
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var S3 = new T.Scene(), cam = new T.PerspectiveCamera(45, 1, 1, 4000), raf = 0, W = 0, H = 0, sc = {}, city = '', last = 0;
    S3.background = new T.Color(0x9fd3ef); S3.fog = new T.Fog(0x9fd3ef, 500, 1400);
    var hemi = new T.HemisphereLight(0xf2f6ff, 0x6b7f4a, 0.9), sun = new T.DirectionalLight(0xfff1dc, 1.7); sun.castShadow = !LITE; sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048);
    var shc = sun.shadow.camera; shc.left = -320; shc.right = 320; shc.top = 220; shc.bottom = -220; shc.near = 10; shc.far = 1200; sun.shadow.bias = -0.0006; S3.add(hemi, sun, sun.target);
    var world = new T.Group(); S3.add(world);

    /* ---------- helpers ---------- */
    function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; t.userData = { canvas: c }; return t; }
    var Mc = {}; function mat(k, o) { return Mc[k] || (Mc[k] = new T.MeshStandardMaterial(o)); }
    function mesh(geo, m, x, y, z) { var o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; return o; }
    function P(x, y, h) { return new T.Vector3(x * K, h || 0, y * K); }
    function shape(pts) { var s = new T.Shape(); pts.forEach(function (p, i) { if (i) s.lineTo(p[0] * K, p[1] * K); else s.moveTo(p[0] * K, p[1] * K); }); return s; }
    function flat(geoShape, m, y) { var g = new T.ShapeGeometry(geoShape, 2); g.rotateX(Math.PI / 2); var o = new T.Mesh(g, m); o.position.y = y; o.receiveShadow = true; return o; }
    function labelTex(text, bg, fg, size) { return canvasTex(512, 96, function (g, w, h) { g.clearRect(0, 0, w, h); g.font = '800 ' + (size || 40) + 'px system-ui, sans-serif'; var tw = Math.min(w - 8, g.measureText(text).width + 36); g.fillStyle = bg; g.beginPath(); if (g.roundRect) g.roundRect((w - tw) / 2, 14, tw, 64, 32); else g.rect((w - tw) / 2, 14, tw, 64); g.fill(); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 47); }); }
    function sprite(tex, w) { var s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false })); s.renderOrder = 10; s.scale.set(w, w * 96 / 512, 1); s.userData.w = w; return s; }
    function hexNum(h) { return parseInt(String(h || '#888888').replace('#', ''), 16); }
    var DTINT = {}; function districtTint(k) { if (DTINT[k]) return DTINT[k]; var h = 0; for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0; return (DTINT[k] = /^dxb_/.test(k) ? 'hsl(' + (32 + h % 8) + ',' + (40 + h % 12) + '%,' + (68 + (h >> 4) % 8) + '%)' : 'hsl(' + (70 + h % 50) + ',' + (22 + h % 14) + '%,' + (58 + (h >> 4) % 10) + '%)'); } // Dubai: sand, not grass

    /* ---------- build a city from the 2D map's world ---------- */
    var DYN = { cars: null, carPath: [], boats: [], boatPath: [], pins: [], areas: [], labels: [], towersM: null, lamps: null, me: null, plane: null, runway: null, flare: null, cables: [] };
    // Free a group's GPU memory (geometries, materials and their maps), then empty it.
    function wipe(g) { g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(function (m) { ['map', 'emissiveMap', 'alphaMap', 'normalMap', 'roughnessMap'].forEach(function (k) { if (m[k] && m[k].dispose) m[k].dispose(); }); m.dispose(); }); }); g.clear(); }
    function build(name) {
      city = name; wipe(world); LV.key = ''; var Wd = PG.worldFor(name), G = Wd.GEO[name], box = G.box, x0 = box[0], x1 = box[1], y0 = box[2], y1 = box[3], bw = x1 - x0, bh = y1 - y0;
      DYN = { cars: null, carPath: [], boats: [], boatPath: [], pins: [], areas: Wd.AREAS || {}, labels: [], towersM: null, lamps: null, me: null, plane: null, runway: null, flare: null, cables: [] };
      // Water, then the land with a district-tinted ground texture painted from the 2D map's tiles.
      var water = new T.Mesh(new T.PlaneGeometry(bw * K * 3, bh * K * 3).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0x2f86b0, roughness: 0.42, metalness: 0.05, clearcoat: 0.4, clearcoatRoughness: 0.5 })); water.position.set((x0 + bw / 2) * K, -0.4, (y0 + bh / 2) * K); world.add(water); DYN.water = water;
      var PXK = 12, groundT = canvasTex(Math.round(bw * PXK), Math.round(bh * PXK), function (g, w, h) {
        g.fillStyle = name === 'dxb' ? '#e2c290' : '#a8b57e'; g.fillRect(0, 0, w, h);
        (Wd.tiles || []).forEach(function (t) { if (!t.k) return; g.fillStyle = districtTint(t.k); g.fillRect((t.x - x0) * PXK, (y1 - t.y - 1) * PXK, PXK + 1, PXK + 1); });
        var rr = 7; for (var i = 0; i < w * h / 40; i++) { rr = (rr * 16807) % 2147483647; var px = rr % w; rr = (rr * 16807) % 2147483647; var py = rr % h; g.fillStyle = (rr & 1) ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.05)'; g.fillRect(px, py, 2, 2); }
      });
      groundT.wrapS = groundT.wrapT = T.ClampToEdgeWrapping; groundT.repeat.set(1 / (bw * K), -1 / (bh * K)); groundT.offset.set(-x0 / bw, 1 + y0 / bh); groundT.flipY = true;
      var landM = new T.MeshStandardMaterial({ map: groundT, roughness: 0.95, side: T.DoubleSide }), shoreM = new T.MeshStandardMaterial({ color: 0xe8d9b5, roughness: 1, side: T.DoubleSide });
      G.land.forEach(function (poly) { var s = shape(poly); (G.water || []).forEach(function (hole) { var hs = new T.Path(); hole.forEach(function (p, i) { if (i) hs.lineTo(p[0] * K, p[1] * K); else hs.moveTo(p[0] * K, p[1] * K); }); s.holes.push(hs); }); world.add(flat(s, shoreM, -0.05)); var inner = flat(s, landM, 0.02); world.add(inner); });
      // Buildings: low blocks with coloured roofs, and glass towers whose windows light up at night.
      var bl = (Wd.buildings || []).filter(function (b) { return !b.tall; }), tl = (Wd.buildings || []).filter(function (b) { return b.tall; });
      var m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), s3 = new T.Vector3(), c = new T.Color(), box1 = new T.BoxGeometry(1, 1, 1); box1.translate(0, 0.5, 0);
      if (bl.length) { var walls = new T.InstancedMesh(box1, new T.MeshStandardMaterial({ roughness: 0.85 }), bl.length), roofs = new T.InstancedMesh(box1, new T.MeshStandardMaterial({ roughness: 0.7 }), bl.length);
        bl.forEach(function (b, i) { var hh = Math.max(0.6, b.h * 0.11); m4.compose(v.set(b.x * K, 0, b.y * K), q, s3.set(b.w * K * 0.86, hh, b.dep * K * 0.86)); walls.setMatrixAt(i, m4); walls.setColorAt(i, c.set(hexNum(b.wall))); m4.compose(v.set(b.x * K, hh, b.y * K), q, s3.set(b.w * K * 0.92, 0.25, b.dep * K * 0.92)); roofs.setMatrixAt(i, m4); roofs.setColorAt(i, c.set(hexNum(b.roof))); });
        walls.castShadow = roofs.castShadow = !LITE; walls.receiveShadow = true; world.add(walls, roofs); }
      if (tl.length) {
        var winT = canvasTex(64, 128, function (g, w, h) { g.fillStyle = '#26303b'; g.fillRect(0, 0, w, h); var rr = 3; for (var yy = 4; yy < h; yy += 8) for (var xx = 3; xx < w; xx += 7) { rr = (rr * 16807) % 2147483647; g.fillStyle = rr % 10 < 6 ? 'rgba(255,214,140,' + (0.5 + (rr % 50) / 100) + ')' : 'rgba(120,150,180,.25)'; g.fillRect(xx, yy, 4, 4); } });
        var dayT = canvasTex(32, 128, function (g, w, h) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); for (var yy = 0; yy < h; yy += 8) { g.fillStyle = 'rgba(40,60,80,.35)'; g.fillRect(0, yy, w, 3); } });
        var towersM = new T.MeshStandardMaterial({ map: dayT, roughness: 0.25, metalness: 0.45, emissive: 0xffffff, emissiveMap: winT, emissiveIntensity: 0 }), towers = new T.InstancedMesh(box1, towersM, tl.length);
        tl.forEach(function (b, i) { m4.compose(v.set(b.x * K, 0, b.y * K), q, s3.set(b.w * K * 0.8, Math.max(2, b.h * 0.1), b.dep * K * 0.8)); towers.setMatrixAt(i, m4); towers.setColorAt(i, c.set(hexNum(b.wall))); });
        towers.castShadow = !LITE; world.add(towers); DYN.towersM = towersM; }
      var tr = Wd.trees || []; if (tr.length) { var crowns = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.9, flatShading: true }), tr.length);
        tr.forEach(function (t, i) { var sz = (t.s || 1) * (t.palm ? 1.1 : 1.4); m4.compose(v.set(t.x * K, sz * 1.2, t.y * K), q, s3.set(sz, sz * (t.palm ? 0.6 : 1), sz)); crowns.setMatrixAt(i, m4); crowns.setColorAt(i, c.setHSL(0.27 + ((i * 37) % 10) / 100, 0.45, 0.28 + ((i * 13) % 10) / 100)); }); crowns.castShadow = !LITE; world.add(crowns); }
      // Roads between districts (raised decks where they cross water), streetlights along them, traffic on them.
      var keys = Object.keys(D.DISTRICTS).filter(function (k) { return (D.DISTRICTS[k].city || 'lagos') === name; }), roads = D.ROADS.filter(function (r) { return keys.indexOf(r[0]) >= 0; });
      var roadM = mat('road', { color: 0x3a3f46, roughness: 0.9 }), deckM = mat('deck', { color: 0x9aa0a6, roughness: 0.7 }), lineM = mat('rline', { color: 0xf2c200, roughness: 0.6 }), pierM = mat('pier', { color: 0xc7ccd1 }), lampPts = [];
      roads.forEach(function (r) {
        var a = D.DISTRICTS[r[0]], b = D.DISTRICTS[r[1]], ax = a.x * K, az = a.y * K, bx = b.x * K, bz = b.y * K, L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax), name2 = D.ROAD_NAMES && (D.ROAD_NAMES[r[0] + '-' + r[1]] || D.ROAD_NAMES[r[1] + '-' + r[0]]), major = name2 && D.MAJOR_ROADS.indexOf(name2) >= 0, bridge = a.side !== b.side, wdt = major ? 2.4 : 1.6, yy = bridge ? 1.6 : 0.12;
        var rd = mesh(new T.BoxGeometry(L, bridge ? 0.5 : 0.1, wdt), bridge ? deckM : roadM, (ax + bx) / 2, yy, (az + bz) / 2); rd.rotation.y = -ang; world.add(rd);
        var dash = mesh(new T.BoxGeometry(L, 0.02, 0.12), lineM, (ax + bx) / 2, yy + (bridge ? 0.27 : 0.07), (az + bz) / 2); dash.rotation.y = -ang; dash.castShadow = false; world.add(dash);
        if (bridge) for (var k = 6; k < L - 3; k += 9) world.add(mesh(new T.CylinderGeometry(0.35, 0.45, 1.8, 6), pierM, ax + Math.cos(ang) * k, 0.5, az + Math.sin(ang) * k));
        for (var lp = 4; lp < L; lp += major ? 6 : 10) lampPts.push([ax + Math.cos(ang) * lp - Math.sin(ang) * (wdt / 2 + 0.3), yy + 1.4, az + Math.sin(ang) * lp + Math.cos(ang) * (wdt / 2 + 0.3)]);
        for (var n = 0; n < (major ? 4 : 2); n++) DYN.carPath.push({ ax: ax, az: az, bx: bx, bz: bz, y: yy + (bridge ? 0.25 : 0.05), u: ((n * 0.37 + r[0].length * 0.11) % 1), dir: n % 2 ? -1 : 1, off: (n % 2 ? 1 : -1) * wdt * 0.22, sp: 0.03 + (n % 3) * 0.008, danfo: n % 3 !== 2 });
      });
      if (lampPts.length) { var lamps = new T.InstancedMesh(new T.SphereGeometry(0.22, 6, 4), new T.MeshBasicMaterial({ color: 0x6b6458 }), lampPts.length); lampPts.forEach(function (p, i) { m4.makeTranslation(p[0], p[1], p[2]); lamps.setMatrixAt(i, m4); }); world.add(lamps); DYN.lamps = lamps; }
      if (DYN.carPath.length) { var carBox = new T.BoxGeometry(1.4, 0.6, 0.7); carBox.translate(0, 0.3, 0); DYN.cars = new T.InstancedMesh(carBox, new T.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }), DYN.carPath.length); DYN.carPath.forEach(function (p, i) { DYN.cars.setColorAt(i, c.set(p.danfo ? 0xf2c200 : [0xf4f3ec, 0xc0392b, 0x2f6fa0, 0x17181a][i % 4])); }); world.add(DYN.cars); }
      (Wd.FERRIES || []).forEach(function (fr, i) { var a = D.DISTRICTS[fr[0]], b = D.DISTRICTS[fr[1]]; if (!a || !b) return; var boat = new T.Group(); boat.add(mesh(new T.BoxGeometry(3, 0.6, 1.1), mat('ferryH', { color: 0xf4f3ec }), 0, 0.1, 0)); boat.add(mesh(new T.BoxGeometry(1.8, 0.6, 0.9), mat('ferryC', { color: 0x1f5fa0 }), -0.2, 0.6, 0)); world.add(boat); DYN.boats.push(boat); DYN.boatPath.push({ ax: a.x * K, az: a.y * K, bx: b.x * K, bz: b.y * K, u: (i * 0.29) % 1 }); });
      // Landmarks.
      if (Wd.RUNWAY && name === 'lagos') { var rw = flat(shape(Wd.RUNWAY), mat('runway', { color: 0x2b2f36, roughness: 0.9, side: T.DoubleSide }), 0.08); world.add(rw); var a0 = Wd.RUNWAY[0], a1 = Wd.RUNWAY[1], a3 = Wd.RUNWAY[3]; DYN.runway = { x0: (a0[0] + a3[0]) / 2 * K, z0: (a0[1] + a3[1]) / 2 * K, x1: (a1[0] + Wd.RUNWAY[2][0]) / 2 * K, z1: (a1[1] + Wd.RUNWAY[2][1]) / 2 * K };
        var pl = new T.Group(), wm = mat('planeW', { color: 0xf7f7f5, roughness: 0.4 }); pl.add(mesh(new T.CapsuleGeometry(0.35, 3.2, 4, 10).rotateZ(Math.PI / 2), wm, 0, 0.6, 0)); pl.add(mesh(new T.BoxGeometry(0.9, 0.08, 4), wm, 0, 0.55, 0)); pl.add(mesh(new T.BoxGeometry(0.6, 1.0, 0.08), mat('planeT', { color: 0x1d7a43 }), -1.7, 1.1, 0)); world.add(pl); DYN.plane = pl; }
      if (Wd.STADIUM && name === 'lagos') { var st = Wd.STADIUM, bowl = mesh(new T.CylinderGeometry(st.rx * K, st.rx * K * 0.85, 2.6, 32, 1, true), mat('bowl', { color: 0xe9e5dc, side: T.DoubleSide }), st.x * K, 1.3, st.y * K); bowl.scale.z = st.ry / st.rx; world.add(bowl); var pitchM = mesh(new T.CircleGeometry(st.rx * K * 0.8, 32).rotateX(-Math.PI / 2), mat('pitch', { color: 0x3f8f3a }), st.x * K, 0.15, st.y * K); pitchM.scale.z = st.ry / st.rx; world.add(pitchM); }
      (Wd.HARBOUR_BRIDGES || []).forEach(function (b2) { if (name !== 'lagos') return; var a = b2[0], e2 = b2[1], ax = a[0] * K, az = a[1] * K, ex = e2[0] * K, ez = e2[1] * K, L = Math.hypot(ex - ax, ez - az), ang = Math.atan2(ez - az, ex - ax); var dk = mesh(new T.BoxGeometry(L, 0.5, 1.8), deckM, (ax + ex) / 2, 1.6, (az + ez) / 2); dk.rotation.y = -ang; world.add(dk); var px = ax + (ex - ax) * 0.32, pz = az + (ez - az) * 0.32; world.add(mesh(new T.BoxGeometry(0.6, 9, 0.6), mat('pylon', { color: 0xeef1f3 }), px, 4.5, pz)); for (var cb = 1; cb <= 5; cb++) [-1, 1].forEach(function (sd) { var pts = [new T.Vector3(px, 8.5 - cb * 0.9, pz), new T.Vector3(px + sd * Math.cos(ang) * cb * L * 0.06, 1.9, pz + sd * Math.sin(ang) * cb * L * 0.06)]; var ln = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xffffff })); world.add(ln); DYN.cables.push({ l: ln, k: cb }); }); });
      if (name === 'lagos') { var ref = D.PLACES.filter(function (p) { return p.id === 'refinery_site'; })[0]; if (ref) { for (var tk = 0; tk < 4; tk++) world.add(mesh(new T.CylinderGeometry(1.2, 1.2, 1.6, 16), mat('tank', { color: 0xe9ecef, metalness: 0.4 }), ref.x * K - 3 + (tk % 2) * 3, 0.8, ref.y * K - 2 + Math.floor(tk / 2) * 3)); world.add(mesh(new T.CylinderGeometry(0.15, 0.2, 8, 6), mat('flare', { color: 0x5a6068 }), ref.x * K + 4, 4, ref.y * K)); var ff = new T.Mesh(new T.ConeGeometry(0.5, 1.6, 8, 1, true).translate(0, 0.8, 0), new T.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })); ff.position.set(ref.x * K + 4, 8, ref.y * K); world.add(ff); DYN.flare = ff; } }
      if (name === 'abuja') { ['abj_aso', 'abj_zuma_pl'].forEach(function (id, i) { var p = D.PLACES.filter(function (q2) { return q2.id === id; })[0]; if (!p) return; var rk = mesh(new T.IcosahedronGeometry(i ? 9 : 7, 2), mat('rock', { color: 0x8a7a68, roughness: 0.95, flatShading: true }), p.x * K + 6, 2, p.y * K + 6); rk.scale.y = 0.8; world.add(rk); }); }
      // District names float over the ground; places get pins with their icon; "you" get a blue marker.
      keys.forEach(function (k) { var d = D.DISTRICTS[k], s = sprite(labelTex(d.name, 'rgba(23,24,26,.72)', '#ffffff', 40), 14); s.position.copy(P(d.x, d.y, 9)); s.userData.district = k; world.add(s); DYN.labels.push(s); });
      var iconCache = {};
      D.PLACES.filter(function (p) { return (D.DISTRICTS[p.district] && (D.DISTRICTS[p.district].city || 'lagos')) === name; }).forEach(function (p) {
        var ic = iconCache[p.icon] || (iconCache[p.icon] = canvasTex(128, 128, function (g, w, h) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w / 2, h / 2, 56, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(23,24,26,.35)'; g.lineWidth = 6; g.stroke(); g.font = '72px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.icon || '📍', w / 2, h / 2 + 4); }));
        var post = mesh(new T.CylinderGeometry(0.08, 0.08, 4, 6), mat('post', { color: 0x17181a }), p.x * K, 2, p.y * K); post.castShadow = false; post.userData.place = p.id; world.add(post);
        var pin = new T.Sprite(new T.SpriteMaterial({ map: ic, depthTest: true, transparent: true, fog: false })); pin.scale.set(3.2, 3.2, 1); pin.position.set(p.x * K, 5.4, p.y * K); pin.userData.place = p.id; world.add(pin);
        var nm = sprite(labelTex(p.name.replace(/\s*\(.*?\)/g, ''), 'rgba(255,255,255,.92)', '#17181a', 34), 9); nm.position.set(p.x * K, 7.6, p.y * K); nm.userData.place = p.id; nm.visible = false; world.add(nm);
        DYN.pins.push({ id: p.id, pin: pin, name: nm, x: p.x * K, z: p.y * K });
      });
      var me = new T.Group(); me.add(mesh(new T.TorusGeometry(2.2, 0.3, 8, 32).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: 0x2f6fd0 }), 0, 0.3, 0)); if (root.LasgidiAvatar3D && sc.myLook) { var fig = root.LasgidiAvatar3D.figure(T, sc.myLook, sc.myOutfit, null); fig.scale.setScalar(1.8); fig.rotation.y = 0.4; me.add(fig); } else { me.add(mesh(new T.CapsuleGeometry(0.6, 1.4, 4, 10), mat('meBody', { color: 0x2f6fd0, roughness: 0.4 }), 0, 1.6, 0)); me.add(mesh(new T.SphereGeometry(0.55, 12, 10), mat('meHead', { color: 0x6b4029 }), 0, 3.1, 0)); } var meTag = sprite(labelTex('You', '#2f6fd0', '#ffffff', 40), 6); meTag.position.y = 4.8; me.add(meTag); world.add(me); DYN.me = me;
      // Frame the whole city.
      orbit.tx = (x0 + bw / 2) * K; orbit.tz = (y0 + bh / 2) * K; orbit.r = Math.max(bw, bh) * K * 0.9; orbit.az = 0; BOX = { x0: x0 * K, x1: x1 * K, z0: y0 * K, z1: y1 * K, rmax: Math.max(bw, bh) * K * 1.3 };
      sun.position.set(orbit.tx + 260, 420, orbit.tz - 200); sun.target.position.set(orbit.tx, 0, orbit.tz); place();
    }


    /* ---------- the live layer: billboards, gems, home, businesses, other players, your selection, your trip ---------- */
    var LIVE = new T.Group(); S3.add(LIVE); var LV = { boards: [], gems: [], players: [], ring: null, key: '' }, TRIP = null;
    function adFace(ad, sel) {
      return canvasTex(256, 128, function (g, w, h) { g.fillStyle = '#17181a'; g.fillRect(0, 0, w, h); var col = ad && ad.color, bg = col && col.bg ? col.bg : typeof col === 'string' ? col : '#1f5fa0', fg = col && col.fg ? col.fg : '#ffffff'; g.fillStyle = bg; g.fillRect(6, 6, w - 12, h - 12);
        var img = ad && ad.img ? LV.imgs[ad.img] : null; if (img && img.complete && img.naturalWidth) g.drawImage(img, 6, 6, w - 12, h - 12);
        else { g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '56px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; g.fillText((ad && ad.emoji) || '📣', 48, h / 2 + 2); g.font = '800 22px system-ui, sans-serif'; var words = String((ad && ad.text) || 'Advertise here').split(' '), line = '', y = 38, lines = []; words.forEach(function (wd) { if ((line + ' ' + wd).trim().length > 14) { lines.push(line.trim()); line = wd; } else line += ' ' + wd; }); lines.push(line.trim()); lines.slice(0, 4).forEach(function (l, i) { g.fillText(l, 165, y + i * 26 - (Math.min(4, lines.length) - 1) * 6); }); }
        if (sel) { g.strokeStyle = '#ffd23f'; g.lineWidth = 10; g.strokeRect(3, 3, w - 6, h - 6); } });
    }
    // Billboards turn to face the default view, so their ads read from the start.
    function orbitFacing() { return 0; }
    function liveKey() { return JSON.stringify([city, sc.rules, sc.board, sc.sel, sc.home, (sc.gems || []).map(function (g) { return g.place + g.n; }), (sc.biz || []).map(function (b) { return b.district + b.icon; }), (sc.players || []).map(function (p) { return p.by + p.d + (p.unread || 0); }), sc.layers && sc.layers.boards, Object.keys(sc.boards || {}).map(function (k) { return (sc.boards[k] || []).length; })]); }
    function buildLive() {
      wipe(LIVE); LV = { boards: [], gems: [], players: [], ring: null, show: null, key: liveKey(), imgs: LV.imgs || {} };
      var post = mat('bpost', { color: 0x4b4f55, metalness: 0.5 }), frameMat = mat('bframe2', { color: 0x202226 });
      // Rail lines on raised track: Lagos's Blue and Red lines, and (rules 26) the London Tube. One mesh per line, stations instanced.
      var RL = D.RAIL_LINES || {}, stops = [];
      Object.keys(RL).forEach(function (k) { var Ln = RL[k]; if ((D.DISTRICTS[Ln.stops[0]] || {}).city !== city && !(city === 'lagos' && !(D.DISTRICTS[Ln.stops[0]] || {}).city)) return; if (Ln.rules && !((sc.rules || 0) >= Ln.rules)) return;
        var path = new T.CurvePath(), off = (Object.keys(RL).indexOf(k) % 3 - 1) * 0.35, pts = Ln.stops.map(function (d) { var a = D.DISTRICTS[d]; stops.push([a.x, a.y]); return new T.Vector3((a.x + 0.35) * K + off, 1.4, (a.y + 0.35) * K + off); });
        for (var i = 1; i < pts.length; i++) path.add(new T.LineCurve3(pts[i - 1], pts[i]));
        LIVE.add(new T.Mesh(new T.TubeGeometry(path, pts.length * 8, 0.32, 5, false), new T.MeshStandardMaterial({ color: new T.Color(Ln.color), roughness: 0.5 })));
      });
      if (stops.length) { var stn = new T.InstancedMesh(new T.CylinderGeometry(0.9, 0.9, 1.8, 10), mat('railStop', { color: 0xf4f3ec, roughness: 0.6 }), stops.length), sm4 = new T.Matrix4(); stops.forEach(function (p0, i) { sm4.makeTranslation((p0[0] + 0.35) * K, 0.9, (p0[1] + 0.35) * K); stn.setMatrixAt(i, sm4); }); LIVE.add(stn); }
      if (city === 'lagos' && !(sc.layers && sc.layers.boards === false)) D.BILLBOARDS.forEach(function (b) {
        var ads = (sc.boards && sc.boards[b.id]) || []; if (!ads.length) return; var g = new T.Group(); g.position.set(b.x * K, 0, b.y * K);
        [-1.4, 1.4].forEach(function (x) { g.add(mesh(new T.CylinderGeometry(0.12, 0.14, 4.4, 6), post, x, 2.2, 0)); }); g.add(mesh(new T.BoxGeometry(5.4, 2.9, 0.25), frameMat, 0, 5.4, -0.1));
        ads.forEach(function (a) { if (a.img && !LV.imgs[a.img]) { var im = new Image(); im.src = a.img; LV.imgs[a.img] = im; } });
        var faceM = new T.MeshBasicMaterial({ map: adFace(ads[0], sc.board === b.id), side: T.DoubleSide }), face = new T.Mesh(new T.PlaneGeometry(5, 2.5), faceM); face.position.set(0, 5.4, 0.08); g.rotation.y = orbitFacing(); g.add(face);
        g.traverse(function (o) { o.userData.board = b.id; }); LIVE.add(g); LV.boards.push({ id: b.id, g: g, face: faceM, ads: ads, at: -1 });
      });
      (sc.gems || []).forEach(function (gm) { var p = D.PLACES.filter(function (q) { return q.id === gm.place; })[0]; if (!p) return; var gem = new T.Mesh(new T.OctahedronGeometry(1.1, 0), new T.MeshStandardMaterial({ color: 0x33c3f0, emissive: 0x1aa0d0, emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.2 })); gem.position.set(p.x * K + 1.6, 8.5, p.y * K); gem.userData.place = p.id; LIVE.add(gem); LV.gems.push(gem); });
      var hd = D.DISTRICTS[sc.home]; if (hd) { var hg = new T.Group(); hg.position.set(hd.x * K - 3, 0, hd.y * K + 2); hg.add(mesh(new T.BoxGeometry(2.4, 1.6, 2), mat('homeW', { color: 0xf4f1ea }), 0, 0.8, 0)); var rf = mesh(new T.ConeGeometry(2, 1.2, 4), mat('homeR', { color: 0xc0392b }), 0, 2.2, 0); rf.rotation.y = Math.PI / 4; hg.add(rf); var ht = sprite(labelTex('🏠 Home', '#ffffff', '#17181a', 38), 6); ht.position.y = 4.2; hg.add(ht); LIVE.add(hg); }
      (sc.biz || []).forEach(function (bz, i) { var d = D.DISTRICTS[bz.district]; if (!d) return; var s = sprite(labelTex(bz.icon || '🏪', 'rgba(255,255,255,.95)', '#17181a', 44), 3.4); s.position.set(d.x * K + 3 + (i % 3) * 1.6, 6, d.y * K - 2); LIVE.add(s); });
      (sc.players || []).forEach(function (pl, i) { if (pl.me) return; var d = D.DISTRICTS[pl.d]; if (!d) return; var g = new T.Group(), a = i * 1.3; g.position.set(d.x * K + Math.cos(a) * 4, 0, d.y * K + Math.sin(a) * 4); g.add(mesh(new T.CapsuleGeometry(0.45, 1.1, 4, 8), mat('pl' + i % 5, { color: [0x2fa36b, 0x8e44ad, 0xe67e22, 0xc0392b, 0xf2b600][i % 5] }), 0, 1.2, 0)); var tag = sprite(labelTex((pl.unread ? '🔴 ' : '') + pl.label, 'rgba(23,24,26,.8)', '#ffffff', 36), 6); tag.position.y = 3.4; g.add(tag); g.traverse(function (o) { o.userData.player = pl.by; }); LIVE.add(g); LV.players.push(g); });
      if (city === 'lagos' && sc.show && D.LAGOON_SHOW) buildShow();
      var sd = D.DISTRICTS[sc.sel]; if (sd && sc.sel !== sc.loc) { var ring = new T.Mesh(new T.RingGeometry(5, 6, 48).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false })); ring.position.set(sd.x * K, 0.3, sd.y * K); LIVE.add(ring); LV.ring = ring; }
    }
    // Your trip: the ride you took goes from one district to the next while the camera follows.
    function tripVehicle(mode) {
      var g = new T.Group(), col = mode === 'danfo' ? 0xf2c200 : mode === 'keke' ? 0x2fa36b : mode === 'okada' ? 0xc0392b : mode === 'brt' ? 0x1f5fa0 : 0xf4f3ec;
      if (mode === 'ferry' || mode === 'boat') { g.add(mesh(new T.BoxGeometry(4, 0.8, 1.5), mat('tripH', { color: 0xf4f3ec }), 0, 0.2, 0)); g.add(mesh(new T.BoxGeometry(2.2, 0.8, 1.2), mat('tripC', { color: 0x1f5fa0 }), -0.3, 0.9, 0)); }
      else if (mode === 'heli' || mode === 'jet') { g.add(mesh(new T.CapsuleGeometry(0.5, 2.2, 4, 10).rotateZ(Math.PI / 2), mat('tripA', { color: 0x1f3b63 }), 0, 0, 0)); g.add(mesh(new T.BoxGeometry(mode === 'jet' ? 1 : 4.5, 0.06, mode === 'jet' ? 4 : 0.2), mat('tripB', { color: 0x17181a }), 0, mode === 'jet' ? 0 : 0.7, 0)); }
      else if (mode === 'trek') { g.add(mesh(new T.CapsuleGeometry(0.5, 1.2, 4, 8), mat('meBody', {}), 0, 1.1, 0)); }
      else { g.add(mesh(new T.BoxGeometry(mode === 'okada' ? 1.4 : 2.6, mode === 'okada' ? 0.8 : 1.2, mode === 'okada' ? 0.4 : 1.1), mat('tripV' + mode, { color: col, roughness: 0.4 }), 0, 0.7, 0)); }
      var tag = sprite(labelTex('You', '#2f6fd0', '#ffffff', 40), 5); tag.position.y = 3.4; g.add(tag); LIVE.add(g); return g;
    }
    // Eko Lagoon Lights (rules 43): a floating ring stage on the lagoon. A dotted LED ring with this week's act, twin light
    // pillars, sweeping beams, speaker towers on pontoons and a countdown that hangs over it.
    function ledTex(text, live) {
      return canvasTex(512, 512, function (g, w, h) {
        g.fillStyle = '#120406'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); g.fill();
        g.save(); g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2); g.clip();
        var lines = text.split(' '), big = lines.length > 2 ? [lines.slice(0, Math.ceil(lines.length / 2)).join(' '), lines.slice(Math.ceil(lines.length / 2)).join(' ')] : lines.length === 2 && text.length > 9 ? lines : [text];
        g.fillStyle = live ? '#ff3b3b' : '#c22a2a'; g.textAlign = 'center'; g.textBaseline = 'middle';
        var fs = 170; g.font = '900 ' + fs + 'px Impact, "Arial Black", sans-serif'; var widest = Math.max.apply(null, big.map(function (l) { return g.measureText(l).width; })), room = big.length > 1 ? 440 : 470; if (widest > room) { fs = Math.floor(fs * room / widest); g.font = '900 ' + fs + 'px Impact, "Arial Black", sans-serif'; }
        big.forEach(function (l, i) { g.fillText(l, w / 2, h / 2 + (i - (big.length - 1) / 2) * fs * 1.05); });
        // LED dots: punch a grid of dark gaps through everything
        g.fillStyle = 'rgba(18,4,6,.55)'; for (var y = 0; y < h; y += 8) g.fillRect(0, y, w, 2); for (var x = 0; x < w; x += 8) g.fillRect(x, 0, 2, h);
        g.restore();
      });
    }
    function cdTex(lines) {
      return canvasTex(512, 200, function (g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,6,8,.55)'; g.fillRect(40, 10, w - 80, h - 20); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 40px system-ui, sans-serif'; g.fillText(lines[0], w / 2, 58); g.font = '900 78px system-ui, sans-serif'; g.fillText(lines[1], w / 2, 138); });
    }
    function showLines(v) {
      if (!v) return ['', ''];
      if (v.live) return ['LIVE NOW · ' + D.LAGOON_SHOW.name.toUpperCase(), v.act];
      var m = v.next || 0, d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60;
      return ['NEXT SHOW IN', (d ? d + 'd ' : '') + hh + 'h ' + mm + 'm'];
    }
    function buildShow() {
      var Sh = D.LAGOON_SHOW, v = sc.show, g = new T.Group(); g.position.set(Sh.x * K, 0, Sh.y * K);
      var dark = mat('shBase', { color: 0x141416, roughness: 0.5, metalness: 0.4 });
      g.add(mesh(new T.BoxGeometry(16, 1.4, 10), dark, 0, 0.5, 0));
      g.add(mesh(new T.BoxGeometry(12, 0.6, 7), mat('shTop', { color: 0x2a0d10, emissive: 0x3a0000, roughness: 0.6 }), 0, 1.5, 0));
      var ringM = new T.MeshBasicMaterial({ color: 0xff3030 }), ring = new T.Mesh(new T.TorusGeometry(8.6, 0.45, 10, 72), ringM); ring.position.set(0, 11, 0); g.add(ring);
      var dots = new T.Mesh(new T.TorusGeometry(9.6, 0.12, 4, 120), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); dots.position.copy(ring.position); g.add(dots);
      var faceM = new T.MeshBasicMaterial({ map: ledTex(v.act, v.live), transparent: true }); var face = new T.Mesh(new T.CircleGeometry(8.3, 64), faceM); face.position.set(0, 11, 0.05); g.add(face);
      var back = face.clone(); back.material = faceM; back.rotation.y = Math.PI; back.position.z = -0.05; g.add(back);
      [-1, 1].forEach(function (sx) { g.add(mesh(new T.BoxGeometry(0.6, 9, 0.6), dark, sx * 7.4, 6, 0)); });
      var pilM = new T.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false }), pillars = [];
      [-2.6, 2.6].forEach(function (x) { var pl = new T.Mesh(new T.CylinderGeometry(1.5, 1.5, 160, 16, 1, true), pilM); pl.position.set(x, 80, -1.2); pl.castShadow = false; g.add(pl); pillars.push(pl); });
      var beamM = new T.MeshBasicMaterial({ color: 0xffd0d0, transparent: true, opacity: 0.14, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }), beams = [];
      for (var i = 0; i < (LITE ? 4 : 8); i++) { var cone = new T.ConeGeometry(3, 70, 12, 1, true); cone.translate(0, -35, 0); cone.rotateX(Math.PI); var bm = new T.Mesh(cone, beamM); bm.position.set((i % 2 ? 1 : -1) * (2 + (i >> 1)), 2, 1); bm.castShadow = false; g.add(bm); beams.push(bm); }
      [-1, 1].forEach(function (sx) { var tw = new T.Group(); tw.position.set(sx * 15, 0, 3); tw.add(mesh(new T.BoxGeometry(4, 0.8, 4), dark, 0, 0.3, 0)); tw.add(mesh(new T.BoxGeometry(0.4, 9, 0.4), dark, 0, 4.8, 0)); tw.add(mesh(new T.BoxGeometry(1.8, 2.4, 1.4), mat('shSpk', { color: 0x0c0c0e }), 0, 9.5, 0)); tw.add(mesh(new T.BoxGeometry(1.6, 1.8, 1.2), mat('shSpk', { color: 0x0c0c0e }), 0, 2, 0)); g.add(tw); });
      var glow = new T.Mesh(new T.CircleGeometry(14, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xff2a6a, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false })); glow.position.y = 0.15; g.add(glow);
      var cdM = new T.SpriteMaterial({ map: cdTex(showLines(v)), depthTest: false, transparent: true }), cd = new T.Sprite(cdM); cd.scale.set(26, 10, 1); cd.position.set(0, 26, 0); cd.renderOrder = 10; g.add(cd);
      g.traverse(function (o) { o.userData.show = 1; }); LIVE.add(g);
      LV.show = { g: g, ring: ringM, dots: dots, face: faceM, act: v.act, live: v.live, pillars: pillars, pil: pilM, beams: beams, beamM: beamM, glow: glow, cd: cdM, cdKey: showLines(v).join('|') };
    }
    function flyShow() { var Sh = D.LAGOON_SHOW; if (Sh) fly = { tx: Sh.x * K, tz: Sh.y * K + 4, r: 62 }; }
    function showFrame(t) {
      var X = LV.show, v = sc.show; if (!X || !v) return;
      if (v.act !== X.act || v.live !== X.live) { X.face.map.dispose(); X.face.map = ledTex(v.act, v.live); X.face.needsUpdate = true; X.act = v.act; X.live = v.live; }
      var key = showLines(v).join('|'); if (key !== X.cdKey) { X.cd.map.dispose(); X.cd.map = cdTex(showLines(v)); X.cd.needsUpdate = true; X.cdKey = key; }
      var hr = sc.hour == null ? 12 : sc.hour, night = hr >= 18 || hr < 6, k = (v.live ? 1 : 0.45) * (night ? 1 : 0.6);
      X.pil.opacity = (0.18 + 0.14 * Math.sin(t * 2)) * k; X.beamM.opacity = (v.live ? 0.18 : 0.07) * (night ? 1 : 0.5);
      X.beams.forEach(function (b, i) { var sp = v.live ? 0.9 : 0.25; b.rotation.z = Math.sin(t * sp + i * 0.9) * 0.6; b.rotation.x = 0.3 + Math.cos(t * sp * 0.7 + i) * 0.25; b.visible = night || v.live; });
      X.ring.color.setHSL(0, 1, v.live ? 0.45 + 0.1 * Math.sin(t * 6) : 0.42); X.dots.rotation.z = t * (v.live ? 0.8 : 0.2);
      X.glow.material.opacity = (v.live ? 0.35 : 0.18) * (0.8 + 0.2 * Math.sin(t * 3));
    }
    function liveFrame(t, now) {
      if (liveKey() !== LV.key) buildLive();
      var slot = Math.floor(now / 6000); LV.boards.forEach(function (b, bi) { var k = (slot + bi) % b.ads.length; if (k !== b.at) { b.at = k; if (b.face.map) b.face.map.dispose(); b.face.map = adFace(b.ads[k], sc.board === b.id); b.face.needsUpdate = true; } });
      LV.gems.forEach(function (g, i) { g.rotation.y = t * 1.6 + i; g.position.y = 8.5 + Math.sin(t * 2 + i) * 0.5; });
      if (LV.ring) { var s = 1 + Math.sin(t * 3) * 0.08; LV.ring.scale.set(s, 1, s); }
      if (LV.show) showFrame(t);
      var tr = sc.trip; if (tr && (!TRIP || TRIP.at !== tr.at)) { if (TRIP && TRIP.v) { LIVE.remove(TRIP.v); wipe(TRIP.v); } var a = D.DISTRICTS[tr.from], b2 = D.DISTRICTS[tr.to]; TRIP = a && b2 ? { at: tr.at, a: a, b: b2, mode: tr.mode, v: tripVehicle(tr.mode), t0: now } : null; }
      if (TRIP && TRIP.v) { var u = Math.min(1, (now - TRIP.t0) / 2600), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, x = (TRIP.a.x + (TRIP.b.x - TRIP.a.x) * e) * K, z = (TRIP.a.y + (TRIP.b.y - TRIP.a.y) * e) * K, air = TRIP.mode === 'heli' || TRIP.mode === 'jet' ? Math.sin(u * Math.PI) * 30 + 2 : 0, ang = Math.atan2((TRIP.b.y - TRIP.a.y), (TRIP.b.x - TRIP.a.x));
        TRIP.v.position.set(x, air + (TRIP.mode === 'ferry' || TRIP.mode === 'boat' ? 0 : 0.2), z); TRIP.v.rotation.y = -ang; fly = { tx: x, tz: z, r: Math.min(orbit.r, 140) };
        if (u >= 1) { LIVE.remove(TRIP.v); wipe(TRIP.v); TRIP.v = null; TRIP.done = true; }
      }
      if (DYN.me) DYN.me.visible = DYN.me.visible && !(TRIP && TRIP.v);
    }

    /* ---------- camera: pan, turn, zoom; tilt follows zoom ---------- */
    var orbit = { az: 0, r: 500, tx: 0, tz: 0 }, BOX = { x0: -1e4, x1: 1e4, z0: -1e4, z1: 1e4, rmax: 900 }, ptrs = {}, drag = null, pinch0 = 0, twist0 = 0, moved = false, fly = null;
    function pol() { var u = Math.min(1, Math.max(0, (orbit.r - 40) / (BOX.rmax - 40))); return 1.12 - u * 0.62; }
    function place() {
      orbit.r = Math.max(28, Math.min(BOX.rmax, orbit.r)); orbit.tx = Math.max(BOX.x0, Math.min(BOX.x1, orbit.tx)); orbit.tz = Math.max(BOX.z0, Math.min(BOX.z1, orbit.tz));
      var p = pol(), s = Math.sin(p); cam.position.set(orbit.tx + orbit.r * s * Math.sin(orbit.az), orbit.r * Math.cos(p), orbit.tz + orbit.r * s * Math.cos(orbit.az)); cam.lookAt(orbit.tx, 0, orbit.tz);
      var near = orbit.r < 160; DYN.pins.forEach(function (pn) { pn.name.visible = near && Math.hypot(pn.x - orbit.tx, pn.z - orbit.tz) < orbit.r * 0.9; var k = Math.max(1, orbit.r / 120); pn.pin.scale.set(3.2 * k, 3.2 * k, 1); pn.pin.position.y = 4.2 + 1.2 * k; });
      DYN.labels.forEach(function (l) { var k = Math.max(0.7, orbit.r / 260); l.scale.set(l.userData.w * k, l.userData.w * k * 96 / 512, 1); l.position.y = 8 + k * 5; });
    }
    cv.addEventListener('pointerdown', function (e) { ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; drag = { x: e.clientX, y: e.clientY, btn: e.button }; moved = false; fly = null; var a = Object.values(ptrs); if (a.length === 2) { pinch0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); twist0 = Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x); } try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
    cv.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; var a = Object.values(ptrs);
      if (a.length === 2 && pinch0) { var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), tw = Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x); orbit.r *= pinch0 / Math.max(1, d); orbit.az -= tw - twist0; pinch0 = d; twist0 = tw; moved = true; place(); return; }
      if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (drag.btn === 2 || e.shiftKey) orbit.az -= dx * 0.006;
      else { var k = orbit.r / (H || 600) * 1.6, ca = Math.cos(orbit.az), sa = Math.sin(orbit.az); orbit.tx -= (dx * ca - dy * sa * 1.4) * k; orbit.tz -= (-dx * sa - dy * ca * 1.4) * k; }
      drag.x = e.clientX; drag.y = e.clientY; place();
    });
    function up(e) { delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch0 = 0; if (!Object.keys(ptrs).length) drag = null; }
    cv.addEventListener('pointerup', function (e) { var mv = moved; up(e); if (!mv) tap(e); }); cv.addEventListener('pointercancel', up); cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('wheel', function (e) { e.preventDefault(); orbit.r *= Math.exp(e.deltaY * 0.0012); place(); }, { passive: false });
    var ray = new T.Raycaster(), ndc = new T.Vector2(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
    function tap(e) {
      var r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
      var lh = ray.intersectObjects(LIVE.children, true).filter(function (h) { var u = h.object.userData; return u.board || u.player || u.place || u.show; })[0];
      if (lh && lh.object.userData.show) { flyShow(); if (opts.onShow) opts.onShow(); return; }
      if (lh) { var ud = lh.object.userData; if (ud.board && opts.onSelectBoard) { opts.onSelectBoard(ud.board); return; } if (ud.player && opts.onSelectPlayer) { opts.onSelectPlayer(ud.player); return; } if (ud.place && opts.onSelectPlace) { opts.onSelectPlace(ud.place); return; } }
      var objs = []; DYN.pins.forEach(function (pn) { objs.push(pn.pin); if (pn.name.visible) objs.push(pn.name); });
      var hit = ray.intersectObjects(objs, false)[0]; if (hit && opts.onSelectPlace) { opts.onSelectPlace(hit.object.userData.place); return; }
      var gp = new T.Vector3(); if (!ray.ray.intersectPlane(ground, gp)) return; var wx = gp.x / K, wy = gp.z / K;
      var area = PG.placeAt ? PG.placeAt(city, wx, wy) : null; if (area && opts.onSelectPlace) { opts.onSelectPlace(area); return; }
      if (PG.isWater(wx, wy, city)) return; var nd = PG.nearestDistrict(wx, wy, city); if (nd && nd.d < 6 && opts.onSelect) opts.onSelect(nd.k);
    }
    function flyTo(x, y, r) { fly = { tx: x * K, tz: y * K, r: r || 90 }; }
    var bar = document.createElement('div'); bar.className = 'iv-spin city-bar';
    bar.innerHTML = '<button type="button" class="pg-zbtn" data-c3="2d" aria-label="Switch to the 2D map" title="2D map">🗺</button><button type="button" class="pg-zbtn" data-c3="me" aria-label="Fly to me" title="Fly to me">📍</button><button type="button" class="pg-zbtn" data-c3="in" aria-label="Zoom in">+</button><button type="button" class="pg-zbtn" data-c3="out" aria-label="Zoom out">−</button><button type="button" class="pg-zbtn" data-c3="l" aria-label="Turn left">⟲</button><button type="button" class="pg-zbtn" data-c3="r" aria-label="Turn right">⟳</button><button type="button" class="pg-zbtn" data-c3="all" aria-label="Whole city" title="Whole city">⛶</button>';
    el.appendChild(bar);
    bar.addEventListener('click', function (e) { var b = e.target.closest('[data-c3]'); if (!b) return; var a = b.getAttribute('data-c3'); fly = null;
      if (a === '2d') { if (opts.onToggle) opts.onToggle(); return; }
      if (a === 'me') { var d = D.DISTRICTS[sc.loc]; if (d) flyTo(d.x, d.y, 80); return; }
      if (a === 'all') { fly = { tx: (BOX.x0 + BOX.x1) / 2, tz: (BOX.z0 + BOX.z1) / 2, r: BOX.rmax / 1.45 }; return; }
      if (a === 'in') orbit.r *= 0.75; else if (a === 'out') orbit.r *= 1.33; else orbit.az += (a === 'l' ? 1 : -1) * Math.PI / 6; place(); });

    /* ---------- frame ---------- */
    function size() { var w = el.clientWidth || 360, h = el.clientHeight || 400; if (w === W && h === H) return; W = w; H = h; renderer.setSize(W, H, false); cv.style.width = W + 'px'; cv.style.height = H + 'px'; cam.aspect = W / H; cam.updateProjectionMatrix(); }
    function frame(now) {
      if (root.LasgidiGL && !root.LasgidiGL.live(el)) { raf = el.isConnected ? root.requestAnimationFrame(frame) : 0; return; } // hidden or under another view: skip the frame
      root.LasgidiGL && root.LasgidiGL.pace(renderer);
      size(); var t = reduce ? 5 : now / 1000, dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      var hr = sc.hour == null ? 12 : sc.hour, night = hr >= 19 || hr < 6, dusk = hr >= 17 && hr < 19, w = sc.weather, wet = w === 'rain' || w === 'storm';
      var sky = night ? 0x16263f : wet ? 0x9aa6b0 : w === 'harmattan' ? 0xd9c49a : dusk ? 0xf0c9a0 : 0x9fd3ef; S3.background.set(sky); S3.fog.color.set(sky); S3.fog.near = w === 'harmattan' ? 220 : 500; S3.fog.far = w === 'harmattan' ? 800 : 1400;
      hemi.intensity = night ? 0.62 : wet ? 0.7 : 0.9; sun.intensity = night ? 0.3 : wet ? 0.5 : 1.7; sun.color.set(night ? 0x8fa8ff : dusk ? 0xffc890 : 0xfff1dc);
      if (DYN.water) DYN.water.material.color.set(night ? 0x143a5a : 0x2f86b0);
      if (DYN.towersM) DYN.towersM.emissiveIntensity = night ? 0.85 : dusk ? 0.25 : 0; if (DYN.lamps) DYN.lamps.material.color.set(night || dusk ? 0xffd27a : 0x6b6458);
      if (fly) { var k = 1 - Math.exp(-dt * 3); orbit.tx += (fly.tx - orbit.tx) * k; orbit.tz += (fly.tz - orbit.tz) * k; orbit.r += (fly.r - orbit.r) * k; if (Math.abs(fly.r - orbit.r) < 1 && Math.hypot(fly.tx - orbit.tx, fly.tz - orbit.tz) < 1) fly = null; place(); }
      if (DYN.cars) { var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), one = new T.Vector3(1, 1, 1); DYN.carPath.forEach(function (p, i) { var u = ((p.u + t * p.sp * p.dir) % 1 + 1) % 1, ang = Math.atan2(p.bz - p.az, p.bx - p.ax), x = p.ax + (p.bx - p.ax) * u - Math.sin(ang) * p.off, z = p.az + (p.bz - p.az) * u + Math.cos(ang) * p.off; e.set(0, -ang + (p.dir < 0 ? Math.PI : 0), 0); q.setFromEuler(e); m4.compose(v.set(x, p.y, z), q, one); DYN.cars.setMatrixAt(i, m4); }); DYN.cars.instanceMatrix.needsUpdate = true; }
      DYN.boats.forEach(function (b, i) { var p = DYN.boatPath[i], u = (p.u + t * 0.012) % 2, f = u < 1 ? u : 2 - u, ang = Math.atan2(p.bz - p.az, p.bx - p.ax); b.position.set(p.ax + (p.bx - p.ax) * f, Math.sin(t * 2 + i) * 0.05, p.az + (p.bz - p.az) * f); b.rotation.y = -ang + (u < 1 ? 0 : Math.PI); });
      if (DYN.plane && DYN.runway) { var R = DYN.runway, pu = (t % 40) / 40, roll = Math.min(1, pu / 0.6), x2 = R.x0 + (R.x1 - R.x0) * (roll * roll), z2 = R.z0 + (R.z1 - R.z0) * (roll * roll), hgt = pu > 0.45 ? (pu - 0.45) * 60 : 0; DYN.plane.position.set(x2 + (pu > 0.6 ? (R.x1 - R.x0) * (pu - 0.6) * 2.5 : 0), 0.1 + hgt, z2 + (pu > 0.6 ? (R.z1 - R.z0) * (pu - 0.6) * 2.5 : 0)); DYN.plane.rotation.set(0, -Math.atan2(R.z1 - R.z0, R.x1 - R.x0), hgt > 0 ? 0.15 : 0); DYN.plane.visible = pu < 0.95; }
      if (DYN.flare) DYN.flare.scale.set(1, 0.8 + Math.abs(Math.sin(t * 7)) * 0.5, 1);
      DYN.cables.forEach(function (cb) { cb.l.material.color.setHSL((t * 0.12 + cb.k * 0.08) % 1, 0.9, night ? 0.6 : 0.9); });
      liveFrame(t, now);
      if (DYN.me && !(TRIP && TRIP.v)) { var d = D.DISTRICTS[sc.loc]; if (d) { DYN.me.visible = true; DYN.me.position.set(d.x * K, 0.2 + (reduce ? 0 : Math.abs(Math.sin(t * 2.5)) * 0.6), d.y * K); } else DYN.me.visible = false; }
      renderer.render(S3, cam);
      raf = el.isConnected ? root.requestAnimationFrame(frame) : 0;
    }
    return {
      el: el, canvas: cv, is3d: true, flyTo: flyTo,
      update: function (next) { sc = next || sc; var c2 = sc.city || 'lagos'; if (c2 !== city) build(c2); if (!raf && el.isConnected) raf = root.requestAnimationFrame(frame); },
      focusShow: function () { flyShow(); if (!raf && el.isConnected) raf = root.requestAnimationFrame(frame); },
      start: function () { if (!raf) raf = root.requestAnimationFrame(frame); },
      stop: function () { if (raf) root.cancelAnimationFrame(raf); raf = 0; }
    };
  }
  root.LasgidiCity3D = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
