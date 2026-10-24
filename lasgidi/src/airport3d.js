/* Lasgidi: the live airport in real 3D (three.js, WebGL). Every model is built here from 3D shapes, not images:
   airliners with swept wings, fins and engines; business jets with T-tails; helicopters with turning rotors;
   cars with cabins and wheels; people with legs that walk. The plot is the same as the 2D scene (x east 0–24,
   z south 0–15, y up): a fenced green site with runway 50 · 22, five gates with jet bridges, six private jets,
   four helipads, a hangar, a fuel farm, a control tower, a wave-roofed terminal with a green name band, a plaza
   with a fountain and flags, a live departures board, two car parks of twenty bays and a taxi rank.
   Drag to orbit, wheel or pinch to zoom. Taps on the gates, jets, helipads, terminal or board call opts.onTap. */
(function (root) {
  'use strict';
  var CARC = [0xc0392b, 0x2f6fa0, 0xf4f3ec, 0x17181a, 0xf2b600, 0x2fa36b, 0x8fa2b3, 0xe67e22, 0x7d3c98, 0x5d6d7e];
  var GATES = [6.6, 8.7, 10.8, 12.9, 15.0];

  function create(opts) {
    opts = opts || {};
    var T = root.THREE; if (!T) return null;
    var LHR = opts.city === 'ldn'; // London Heathrow: purple band, Union flags, black cabs, a red TfL bus, plane trees, grey sky
    var el = document.createElement('div'); el.className = 'airport-stage airport-3d';
    var renderer;
    try { renderer = root.LasgidiGL ? root.LasgidiGL.make({ preserve: true }) : new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch (e) { return null; } if (!renderer) return null;
    var LITE = root.LasgidiGL ? root.LasgidiGL.lite() : (root.innerWidth || 1000) < 700 || ((root.navigator || {}).hardwareConcurrency || 8) <= 4;
    if (!root.LasgidiGL) renderer.setPixelRatio(Math.min(LITE ? 1.25 : 2, root.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    var cv = renderer.domElement; cv.className = 'airport-canvas'; cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Live 3D view of the airport. Drag to turn it, scroll or pinch to zoom, tap the gates, jets, helipads, terminal or board.');
    el.appendChild(cv);
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var scene3 = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, 0.1, 400), state = { name: 'Airport', night: false }, raf = 0, W = 0, H = 0;
    scene3.fog = new T.Fog(0x9fd3ef, 60, 140);
    var hemi = new T.HemisphereLight(0xdff3ff, 0x5c7a43, 0.9), sun = new T.DirectionalLight(0xffffff, 1.6);
    sun.position.set(30, 40, 22); sun.target.position.set(12, 0, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048); var sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 120; sun.shadow.bias = -0.0005;
    scene3.add(hemi, sun, sun.target);

    /* ---------- materials, shared geometry and helpers ---------- */
    var M = {}; function mat(key, color, o) { if (!M[key]) M[key] = new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.75, metalness: 0.05 }, o || {})); return M[key]; }
    function col(c) { return mat('c' + c, c, { roughness: 0.45, metalness: 0.25 }); }
    var glass = mat('glass', 0x7fb2d4, { roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.85 }), dark = mat('dark', 0x1c2128, { roughness: 0.5 }), white = mat('white', 0xf6f7f8, { roughness: 0.35, metalness: 0.2 });
    function mesh(geo, m, x, y, z, cast) { var o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = cast !== false; o.receiveShadow = true; return o; }
    function boxM(w, h, d, m, x, y, z, cast) { return mesh(new T.BoxGeometry(w, h, d), m, x, y, z, cast); }
    function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.anisotropy = 8; t.colorSpace = T.SRGBColorSpace; t.userData = { canvas: c, draw: draw }; return t; }
    function sprite(text, bg, fg, scale) {
      var t = canvasTex(256, 64, function (g, w, h) { g.clearRect(0, 0, w, h); g.font = '800 30px system-ui, sans-serif'; var tw = Math.min(w - 4, g.measureText(text).width + 24); g.fillStyle = bg; g.beginPath(); if (g.roundRect) g.roundRect((w - tw) / 2, 10, tw, 44, 18); else g.rect((w - tw) / 2, 10, tw, 44); g.fill(); g.fillStyle = fg || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 33); });
      var s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(2.4 * (scale || 1), 0.6 * (scale || 1), 1); s.renderOrder = 10; return s;
    }
    function setSpriteText(s, text, bg) { var t = s.material.map; if (t.userData.text === text) return; t.userData.text = text; var c = t.userData.canvas, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.font = '800 30px system-ui, sans-serif'; var tw = Math.min(c.width - 4, g.measureText(text).width + 24); g.fillStyle = bg || 'rgba(23,24,26,.8)'; g.beginPath(); if (g.roundRect) g.roundRect((c.width - tw) / 2, 10, tw, 44, 18); else g.rect((c.width - tw) / 2, 10, tw, 44); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, 33); t.needsUpdate = true; }
    function tag(obj, kind) { obj.traverse(function (o) { o.userData.kind = kind; }); return obj; }

    /* ---------- vehicles and people, built from shapes ---------- */
    function wingShape(span, root0, tip, sweep) { var s = new T.Shape(); s.moveTo(root0 / 2, 0); s.lineTo(root0 / 2 - sweep, span); s.lineTo(root0 / 2 - sweep - tip, span); s.lineTo(-root0 / 2, 0); s.lineTo(root0 / 2 - sweep - tip, -span); s.lineTo(root0 / 2 - sweep, -span); s.closePath(); return s; }
    var GEO = {};
    function geo(key, make) { return GEO[key] || (GEO[key] = make()); }
    function airliner(tail, len) {
      var L = len || 1.9, r = L * 0.06, g = new T.Group();
      var body = mesh(geo('al-body' + L, function () { var c = new T.CapsuleGeometry(r, L - 2 * r, 6, 16); c.rotateZ(Math.PI / 2); return c; }), white, 0, r * 1.6, 0); g.add(body);
      var stripe = mesh(geo('al-str' + L, function () { var c = new T.CylinderGeometry(r * 1.01, r * 1.01, L * 0.82, 16, 1, true, Math.PI * 0.62, Math.PI * 0.18); c.rotateZ(Math.PI / 2); return c; }), col(tail), 0, r * 1.6, 0, false); g.add(stripe);
      var wing = mesh(geo('al-wing' + L, function () { var e = new T.ExtrudeGeometry(wingShape(L * 0.5, L * 0.22, L * 0.07, L * 0.2), { depth: L * 0.012, bevelEnabled: false }); e.rotateX(Math.PI / 2); return e; }), mat('wing', 0xdfe3e7, { roughness: 0.4, metalness: 0.3 }), -L * 0.02, r * 1.25, 0); g.add(wing);
      var stab = mesh(geo('al-stab' + L, function () { var e = new T.ExtrudeGeometry(wingShape(L * 0.17, L * 0.1, L * 0.04, L * 0.07), { depth: L * 0.01, bevelEnabled: false }); e.rotateX(Math.PI / 2); return e; }), mat('wing', 0xdfe3e7), -L * 0.44, r * 1.9, 0); g.add(stab);
      var fin = mesh(geo('al-fin' + L, function () { var s = new T.Shape(); s.moveTo(0, 0); s.lineTo(L * 0.16, 0); s.lineTo(L * 0.02, L * 0.17); s.lineTo(-L * 0.06, L * 0.17); s.closePath(); var e = new T.ExtrudeGeometry(s, { depth: L * 0.012, bevelEnabled: false }); e.translate(0, 0, -L * 0.006); return e; }), col(tail), -L * 0.5, r * 2.3, 0); g.add(fin);
      [-1, 1].forEach(function (sd) { var en = mesh(geo('al-eng' + L, function () { var c = new T.CylinderGeometry(r * 0.55, r * 0.5, L * 0.13, 14); c.rotateZ(Math.PI / 2); return c; }), mat('engine', 0xb9c0c7, { metalness: 0.5, roughness: 0.3 }), L * 0.06, r * 0.75, sd * L * 0.17); g.add(en); });
      g.add(mesh(geo('al-nose' + L, function () { return new T.SphereGeometry(r * 0.55, 10, 8); }), dark, L / 2 - r * 0.55, r * 1.85, 0, false));
      [[L * 0.3, 0], [-L * 0.05, L * 0.08], [-L * 0.05, -L * 0.08]].forEach(function (q) { g.add(mesh(geo('al-gear', function () { return new T.CylinderGeometry(0.012, 0.012, 0.09, 6); }), dark, q[0], 0.045, q[1], false)); });
      return g;
    }
    function bizjet(colr, accent) {
      var L = 1.25, r = 0.055, g = new T.Group(), m = col(colr);
      var body = mesh(geo('bj-body', function () { var c = new T.CapsuleGeometry(r, L - 2 * r, 6, 14); c.rotateZ(Math.PI / 2); return c; }), m, 0, r * 1.7, 0); g.add(body);
      g.add(mesh(geo('bj-wing', function () { var e = new T.ExtrudeGeometry(wingShape(L * 0.4, L * 0.2, L * 0.07, L * 0.18), { depth: 0.012, bevelEnabled: false }); e.rotateX(Math.PI / 2); return e; }), m, 0.02, r * 1.2, 0));
      g.add(mesh(geo('bj-fin', function () { var s = new T.Shape(); s.moveTo(0, 0); s.lineTo(0.16, 0); s.lineTo(0.04, 0.2); s.lineTo(-0.04, 0.2); s.closePath(); var e = new T.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false }); e.translate(0, 0, -0.006); return e; }), m, -L * 0.48, r * 2.2, 0));
      g.add(mesh(geo('bj-tstab', function () { var e = new T.ExtrudeGeometry(wingShape(0.2, 0.08, 0.04, 0.06), { depth: 0.01, bevelEnabled: false }); e.rotateX(Math.PI / 2); return e; }), m, -L * 0.48, r * 2.2 + 0.2, 0));
      [-1, 1].forEach(function (sd) { g.add(mesh(geo('bj-eng', function () { var c = new T.CylinderGeometry(0.035, 0.03, 0.18, 12); c.rotateZ(Math.PI / 2); return c; }), col(accent), -L * 0.3, r * 2.1, sd * 0.09)); });
      g.add(mesh(geo('bj-win', function () { var c = new T.BoxGeometry(L * 0.5, 0.025, r * 2.04); return c; }), dark, 0.05, r * 2.1, 0, false));
      return g;
    }
    function helicopter(colr) {
      var g = new T.Group(), m = col(colr);
      g.add(mesh(geo('h-body', function () { var s = new T.SphereGeometry(0.22, 18, 12); s.scale(1.25, 0.75, 0.75); return s; }), m, 0, 0.26, 0));
      g.add(mesh(geo('h-glass', function () { var s = new T.SphereGeometry(0.15, 14, 10); s.scale(1, 0.75, 0.9); return s; }), glass, 0.16, 0.3, 0, false));
      g.add(mesh(geo('h-boom', function () { var c = new T.CylinderGeometry(0.04, 0.025, 0.7, 10); c.rotateZ(Math.PI / 2); return c; }), m, -0.55, 0.3, 0));
      g.add(mesh(geo('h-tfin', function () { return new T.BoxGeometry(0.12, 0.18, 0.015); }), m, -0.88, 0.38, 0));
      [-1, 1].forEach(function (sd) { g.add(mesh(geo('h-skid', function () { var c = new T.CylinderGeometry(0.012, 0.012, 0.55, 6); c.rotateZ(Math.PI / 2); return c; }), dark, 0.02, 0.02, sd * 0.15, false)); });
      g.add(mesh(geo('h-mast', function () { return new T.CylinderGeometry(0.02, 0.02, 0.1, 6); }), dark, 0, 0.47, 0, false));
      var rotor = new T.Group(); rotor.position.set(0, 0.52, 0);
      [0, Math.PI / 2].forEach(function (a) { var b = mesh(geo('h-blade', function () { return new T.BoxGeometry(1.3, 0.008, 0.05); }), dark, 0, 0, 0, false); b.rotation.y = a; rotor.add(b); });
      g.add(rotor); g.userData.rotor = rotor;
      var tr = mesh(geo('h-trotor', function () { return new T.BoxGeometry(0.22, 0.03, 0.008); }), dark, -0.9, 0.36, 0.02, false); g.add(tr); g.userData.trotor = tr;
      return g;
    }
    function car(c, bus) {
      var g = new T.Group(), L = bus ? 0.95 : 0.34, Wd = bus ? 0.2 : 0.16;
      g.add(mesh(geo(bus ? 'bus-b' : 'car-b', function () { return new T.BoxGeometry(L, bus ? 0.16 : 0.07, Wd); }), col(c), 0, bus ? 0.12 : 0.07, 0));
      if (!bus) g.add(mesh(geo('car-cab', function () { return new T.BoxGeometry(0.17, 0.06, 0.14); }), mat('cabin', 0x2a3a4a, { roughness: 0.15, metalness: 0.6 }), -0.02, 0.13, 0));
      else g.add(mesh(geo('bus-w', function () { return new T.BoxGeometry(0.9, 0.05, 0.205); }), mat('cabin', 0x2a3a4a), 0, 0.15, 0, false));
      [[L * 0.32, 1], [L * 0.32, -1], [-L * 0.32, 1], [-L * 0.32, -1]].forEach(function (q) { g.add(mesh(geo('wheel', function () { var w = new T.CylinderGeometry(0.035, 0.035, 0.03, 10); w.rotateX(Math.PI / 2); return w; }), dark, q[0], 0.035, q[1] * Wd / 2, false)); });
      return g;
    }
    var SKIN = [0x6b4029, 0x8a5a3c, 0x4a2c1c, 0x9b6a4b];
    function person(colr, female, k) {
      var g = new T.Group(), s = k || 1, skin = mat('skin' + (colr % 4), SKIN[colr % 4], { roughness: 0.8 }), cloth = col(colr);
      var legs = []; [-1, 1].forEach(function (sd) { var lg = new T.Group(); lg.position.set(0, 0.05 * s, sd * 0.012 * s); lg.add(mesh(geo('leg', function () { var b = new T.BoxGeometry(0.014, 0.05, 0.014); b.translate(0, -0.025, 0); return b; }), dark, 0, 0, 0, false)); lg.scale.setScalar(s); g.add(lg); legs.push(lg); });
      if (female) { var d = mesh(geo('dress', function () { return new T.ConeGeometry(0.03, 0.06, 10); }), cloth, 0, 0.07 * s, 0); d.scale.setScalar(s); g.add(d); }
      else { var t = mesh(geo('torso', function () { return new T.BoxGeometry(0.025, 0.04, 0.035); }), cloth, 0, 0.075 * s, 0); t.scale.setScalar(s); g.add(t); }
      var h = mesh(geo('head', function () { return new T.SphereGeometry(0.013, 10, 8); }), skin, 0, 0.112 * s, 0); h.scale.setScalar(s); g.add(h);
      if (female) { var hw = mesh(geo('gele', function () { var c = new T.SphereGeometry(0.016, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); return c; }), cloth, 0, 0.12 * s, 0, false); hw.scale.setScalar(s); g.add(hw); }
      g.userData.legs = legs; return g;
    }
    function palm(x, z, k) {
      var g = new T.Group(), s = k || 1; g.position.set(x, 0, z);
      var curve = new T.QuadraticBezierCurve3(new T.Vector3(0, 0, 0), new T.Vector3(0.12 * s, 0.5 * s, 0), new T.Vector3(0.05 * s, 1.0 * s, 0));
      g.add(mesh(new T.TubeGeometry(curve, 8, 0.035 * s, 6), mat('trunk', 0x7a5230, { roughness: 0.9 }), 0, 0, 0));
      for (var i = 0; i < 7; i++) { var lf = mesh(geo('leaf', function () { var b = new T.BoxGeometry(0.55, 0.012, 0.11); b.translate(0.26, 0, 0); return b; }), mat('leaf', 0x2e8b3e, { roughness: 0.8 }), 0.05 * s, 1.0 * s, 0); lf.scale.setScalar(s); lf.rotation.y = i * Math.PI * 2 / 7; lf.rotation.z = -0.45; g.add(lf); }
      return g;
    }
    function tree(x, z, k) { var g = new T.Group(); g.position.set(x, 0, z); g.add(mesh(geo('ttr', function () { return new T.CylinderGeometry(0.04, 0.05, 0.35, 6); }), mat('trunk', 0x7a5230), 0, 0.17, 0)); var c = mesh(geo('tcan', function () { return new T.IcosahedronGeometry(0.32, 1); }), mat('canopy', 0x3f8f3a, { roughness: 0.9, flatShading: true }), 0, 0.5, 0); c.scale.setScalar(k || 1); g.add(c); return g; }

    /* ---------- the site ---------- */
    var world = new T.Group(); scene3.add(world);
    world.add(mesh(new T.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), mat('sea', 0x2a9cc4, { roughness: 0.3, metalness: 0.1 }), 12, -0.32, 8, false));
    world.add(boxM(24, 0.3, 15, mat('soil', 0x5c8a43), 12, -0.15, 7.5));
    world.add(boxM(24, 0.01, 15, mat('grass', 0x9cc77a, { roughness: 0.95 }), 12, 0.005, 7.5, false));
    [[0.4, 2.5, 4.4, 1.2, 0x8dbd69], [17.2, 7.6, 6.4, 1.2, 0xa9d184], [0.4, 12.2, 4.8, 2.4, 0x86b863], [17.6, 13.4, 6, 1.3, 0xb3d88f]].forEach(function (q) { world.add(boxM(q[2], 0.01, q[3], mat('g' + q[4], q[4], { roughness: 0.95 }), q[0] + q[2] / 2, 0.011, q[1] + q[3] / 2, false)); });
    // Runway 50 · 22, painted on a texture: piano keys, the numbers, touchdown bars and the centre line.
    var rwTex = canvasTex(2048, 140, function (g, w, h) {
      g.fillStyle = '#2c3036'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f3ec';
      for (var k = 0; k < 8; k++) { g.fillRect(14, 10 + k * 15.5, 60, 9); g.fillRect(w - 74, 10 + k * 15.5, 60, 9); }
      g.save(); g.translate(130, h / 2); g.rotate(Math.PI / 2); g.font = '900 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('50', 0, 0); g.restore();
      g.save(); g.translate(w - 130, h / 2); g.rotate(-Math.PI / 2); g.font = '900 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('22', 0, 0); g.restore();
      [230, 330, w - 330, w - 230].forEach(function (x) { g.fillRect(x, 22, 60, 12); g.fillRect(x, h - 34, 60, 12); });
      for (var x = 420; x < w - 420; x += 80) g.fillRect(x, h / 2 - 3, 44, 6);
      g.fillRect(0, 4, w, 3); g.fillRect(0, h - 7, w, 3);
    });
    world.add(boxM(22, 0.02, 1.5, mat('runway', 0xffffff, { map: rwTex, roughness: 0.85 }), 12, 0.02, 1.55, false));
    for (var li = 0; li <= 22; li += 1) [0.78, 2.32].forEach(function (zz) { world.add(mesh(geo('rlight', function () { return new T.SphereGeometry(0.035, 6, 4); }), mat('rlight', 0xf2c94c, { emissive: 0xf2c94c, emissiveIntensity: 0.6 }), 1 + li, 0.04, zz, false)); });
    var twTex = canvasTex(1024, 32, function (g, w, h) { g.fillStyle = '#3a3f46'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2b600'; g.fillRect(0, h / 2 - 2, w, 4); });
    world.add(boxM(22, 0.02, 0.45, mat('taxi', 0xffffff, { map: twTex }), 12, 0.02, 3.02, false));
    [6, 11, 16, 20].forEach(function (x) { world.add(boxM(0.45, 0.021, 0.55, mat('asph', 0x3a3f46), x + 0.22, 0.02, 2.55, false)); });
    world.add(boxM(11, 0.02, 3.2, mat('apron', 0xc9ccd1, { roughness: 0.9 }), 11, 0.02, 5.0, false));
    world.add(boxM(5.8, 0.02, 3.6, mat('apron2', 0xd3d6da, { roughness: 0.9 }), 19.9, 0.02, 5.2, false));
    var gateObjs = [];
    GATES.forEach(function (gx, gi) {
      world.add(boxM(0.22, 0.22, 1.5, mat('bridge', 0xe9eaec, { roughness: 0.5 }), gx + 0.37, 0.32, 6.1));
      world.add(boxM(0.04, 0.32, 0.04, dark, gx + 0.37, 0.16, 5.5));
      var p = airliner(['0x1d7a43', '0xc0392b', '0x2f6fa0', '0x1d7a43', '0xf2b600'].map(Number)[gi], 1.95); p.position.set(gx, 0.02, 4.6); p.rotation.y = -Math.PI / 2; tag(p, 'departures'); world.add(p);
      var s = sprite('Gate ' + (gi + 1), '#f2b600', '#1a1500', 0.7); s.position.set(gx, 1.2, 3.8); world.add(s);
      gateObjs.push({ plane: p, label: s, walkers: [] });
    });
    // Private jets: six on their own apron; yours wears your colour.
    var jets = [];
    [[17.9, 4.3], [19.8, 4.3], [21.7, 4.3], [17.9, 6.1], [19.8, 6.1], [21.7, 6.1]].forEach(function (q, i) { var j = bizjet(i % 3 === 0 ? 0x1f2329 : 0xf7f7f5, 0x8fa2b3); j.position.set(q[0], 0.02, q[1]); j.rotation.y = -Math.PI / 2; tag(j, 'jet'); world.add(j); jets.push(j); });
    var myJetLabel = sprite('YOUR JET', '#d4af37', '#1a1500', 0.7); myJetLabel.position.set(17.9, 1.0, 4.3); myJetLabel.visible = false; world.add(myJetLabel);
    // Heliport: four pads with a choppers on each.
    var padTex = canvasTex(256, 256, function (g, w, h) { g.fillStyle = '#3a3f46'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f2b600'; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, h / 2, 96, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#f4f3ec'; g.font = '900 120px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', w / 2, h / 2 + 6); });
    var helis = [];
    [[1.7, 4.2], [3.7, 4.2], [1.7, 6.0], [3.7, 6.0]].forEach(function (q, i) { var pad = boxM(1.5, 0.03, 1.5, mat('pad', 0xffffff, { map: padTex }), q[0], 0.02, q[1], false); tag(pad, 'chopper'); world.add(pad); var hc = helicopter([0x20252b, 0x1f3b63, 0x20252b, 0x7a1f2b][i]); hc.position.set(q[0], 0.03, q[1]); hc.rotation.y = 0.4; tag(hc, 'chopper'); world.add(hc); helis.push(hc); });
    var hpl = sprite('HELIPORT', '#1f2933', '#fff', 0.8); hpl.position.set(2.7, 1.3, 7.2); world.add(hpl);
    // Hangar (a half barrel), fuel farm and the control tower.
    var hang = mesh(new T.CylinderGeometry(0.85, 0.85, 3.8, 24, 1, false, 0, Math.PI), mat('hangar', 0xc9ced4, { metalness: 0.4, roughness: 0.4 }), 2.8, 0, 9.65); hang.rotation.z = Math.PI / 2; world.add(hang); // the upper half of a barrel, its axis along x
    [1.4, 2.4, 3.4].forEach(function (x) { world.add(mesh(geo('tank', function () { return new T.CylinderGeometry(0.33, 0.33, 0.45, 20); }), mat('tank', 0xe3e6e9, { metalness: 0.3, roughness: 0.4 }), x, 0.225, 11.4)); });
    world.add(mesh(new T.CylinderGeometry(0.16, 0.22, 3.4, 16), mat('tower', 0xdfe3e7, { roughness: 0.5 }), 21.55, 1.7, 9.55));
    world.add(mesh(new T.CylinderGeometry(0.42, 0.3, 0.12, 16), mat('tower', 0xdfe3e7), 21.55, 3.42, 9.55));
    world.add(mesh(new T.CylinderGeometry(0.5, 0.42, 0.42, 16), glass, 21.55, 3.69, 9.55));
    world.add(mesh(new T.CylinderGeometry(0.58, 0.5, 0.08, 16), mat('tower', 0xdfe3e7), 21.55, 3.94, 9.55));
    world.add(mesh(new T.CylinderGeometry(0.01, 0.01, 0.5, 6), dark, 21.55, 4.2, 9.55, false));
    var beacon = mesh(new T.SphereGeometry(0.05, 8, 6), new T.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 1 }), 21.55, 4.47, 9.55, false); world.add(beacon);
    var twl = sprite('TOWER', '#1f2933', '#fff', 0.6); twl.position.set(21.55, 4.9, 9.55); world.add(twl);
    // The terminal: a long glass front under a wave roof, with a green name band.
    var term = new T.Group(); term.add(boxM(11, 0.85, 1.9, mat('termwall', 0xe9ecef, { roughness: 0.4 }), 11.1, 0.425, 7.75));
    var front = mesh(new T.PlaneGeometry(10.8, 0.6), glass, 11.1, 0.35, 8.71, false); term.add(front);
    for (var mu = 0; mu < 15; mu++) term.add(boxM(0.03, 0.6, 0.03, mat('mull', 0xb9c0c7, { metalness: 0.6 }), 5.75 + mu * 0.75, 0.35, 8.72, false));
    var roofGeo = new T.PlaneGeometry(11.8, 2.5, 96, 8); roofGeo.rotateX(-Math.PI / 2); var rp = roofGeo.attributes.position;
    for (var vi = 0; vi < rp.count; vi++) { var vx = rp.getX(vi), vz = rp.getZ(vi); rp.setY(vi, 0.95 + Math.sin(vx * 0.9) * 0.06 + (1 - Math.pow(vz / 1.25, 2)) * 0.18); } roofGeo.computeVertexNormals();
    term.add(mesh(roofGeo, mat('roof', 0xdfe6ec, { roughness: 0.35, metalness: 0.35, side: T.DoubleSide }), 11.1, 0, 7.75));
    var bandTex = canvasTex(2048, 96, function (g, w, h) { g.fillStyle = LHR ? '#4b2a7b' : '#1d5a3c'; g.fillRect(0, 0, w, h); g.fillStyle = LHR ? '#ffffff' : '#ffd36b'; g.font = '900 54px system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(state.code || 'LOS', 26, h / 2); g.textAlign = 'right'; g.fillText(state.code || 'LOS', w - 26, h / 2); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '900 50px system-ui, sans-serif'; g.fillText((state.name || 'AIRPORT').toUpperCase(), w / 2, h / 2); });
    var band = mesh(new T.PlaneGeometry(11.2, 0.2), new T.MeshStandardMaterial({ map: bandTex, roughness: 0.6, emissive: 0xffffff, emissiveMap: bandTex, emissiveIntensity: 0.35 }), 11.1, 0.76, 8.76, false); term.add(band);
    tag(term, 'terminal'); world.add(term);
    // Landside: kerb road, plaza, fountain, flags, car parks, taxi rank, access road, fence.
    var roadTex = canvasTex(1024, 32, function (g, w, h) { g.fillStyle = '#3a3f46'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f3ec'; for (var x = 0; x < w; x += 48) g.fillRect(x, h / 2 - 1.5, 26, 3); });
    world.add(boxM(11.5, 0.02, 0.6, mat('road', 0xffffff, { map: roadTex }), 11.25, 0.02, 9.1, false));
    world.add(boxM(17.5, 0.02, 0.6, mat('road', 0xffffff, { map: roadTex }), 14.25, 0.02, 13.05, false));
    world.add(boxM(0.6, 0.021, 4.55, mat('asph', 0x3a3f46), 16.9, 0.02, 11.07, false)); world.add(boxM(1.8, 0.021, 2.25, mat('asph', 0x3a3f46), 5.5, 0.02, 13.87, false));
    world.add(boxM(2.7, 0.02, 3.0, mat('plaza', 0xe7e1d2, { roughness: 0.9 }), 10.95, 0.022, 11.0, false));
    world.add(mesh(new T.CylinderGeometry(0.75, 0.8, 0.12, 28), mat('basin', 0xc9ccd1), 10.95, 0.06, 11.4)); world.add(mesh(new T.CylinderGeometry(0.62, 0.62, 0.02, 28), mat('water', 0x3fb6d8, { roughness: 0.1, metalness: 0.2 }), 10.95, 0.13, 11.4, false));
    var jetsW = []; for (var fj = 0; fj < 8; fj++) { var dr = mesh(geo('drop', function () { return new T.SphereGeometry(0.025, 6, 4); }), mat('spray', 0xe8f7ff, { transparent: true, opacity: 0.85 }), 10.95, 0.2, 11.4, false); world.add(dr); jetsW.push(dr); }
    var flagTex = canvasTex(96, 64, LHR ? function (g, w, h) { g.fillStyle = '#012169'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 12; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); g.strokeStyle = '#c8102e'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#fff'; g.fillRect(w / 2 - 10, 0, 20, h); g.fillRect(0, h / 2 - 10, w, 20); g.fillStyle = '#c8102e'; g.fillRect(w / 2 - 6, 0, 12, h); g.fillRect(0, h / 2 - 6, w, 12); } : function (g, w, h) { g.fillStyle = '#1f8a4c'; g.fillRect(0, 0, w / 3, h); g.fillStyle = '#ffffff'; g.fillRect(w / 3, 0, w / 3, h); g.fillStyle = '#1f8a4c'; g.fillRect(w * 2 / 3, 0, w / 3, h); });
    var flags = [];
    [[9.8, 12.3], [12.1, 12.3], [9.8, 9.7], [12.1, 9.7]].forEach(function (q) { world.add(mesh(geo('pole', function () { return new T.CylinderGeometry(0.015, 0.015, 1.3, 6); }), mat('pole', 0xd9dde1, { metalness: 0.6 }), q[0], 0.65, q[1])); var f = mesh(geo('flag', function () { var p = new T.PlaneGeometry(0.42, 0.26, 8, 1); p.translate(0.21, 0, 0); return p; }), new T.MeshStandardMaterial({ map: flagTex, side: T.DoubleSide }), q[0], 1.15, q[1], false); world.add(f); flags.push(f); });
    var bayTex = canvasTex(512, 256, function (g, w, h) { g.fillStyle = '#50565e'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; for (var i = 0; i <= 10; i++) { var x = 6 + i * (w - 12) / 10; g.beginPath(); g.moveTo(x, 6); g.lineTo(x, h * 0.38); g.moveTo(x, h * 0.62); g.lineTo(x, h - 6); g.stroke(); } g.setLineDash([14, 12]); g.beginPath(); g.moveTo(10, h / 2); g.lineTo(w - 10, h / 2); g.stroke(); });
    [[5.8, 9.8], [12.6, 9.8]].forEach(function (r, ri) {
      var lot = boxM(3.6, 0.02, 2.6, mat('lot', 0xffffff, { map: bayTex }), r[0] + 1.8, 0.021, r[1] + 1.3, false); tag(lot, 'parking'); world.add(lot);
      for (var cx = 0; cx < 10; cx++) for (var cy = 0; cy < 2; cy++) { var c = car(CARC[(cx + cy * 3 + ri * 2) % CARC.length]); c.position.set(r[0] + 0.18 + cx * 0.355, 0.02, r[1] + (cy ? 2.15 : 0.45)); c.rotation.y = Math.PI / 2; world.add(c); }
    });
    world.add(boxM(2.4, 0.02, 1.0, mat('lot2', 0x50565e), 18.6, 0.021, 10.3, false)); for (var tx2 = 0; tx2 < 5; tx2++) { var cab = car(LHR ? 0x111214 : 0xf2c200); cab.position.set(17.65 + tx2 * 0.46, 0.02, 10.3); cab.rotation.y = Math.PI / 2; world.add(cab); }
    var taxl = LHR ? sprite('BLACK CABS', '#111214', '#ffd36b', 0.5) : sprite('TAXI', '#f2c200', '#1a1500', 0.5); taxl.position.set(18.6, 0.8, 10.3); world.add(taxl);
    if (LHR) {
      // A red double-decker at the kerb, and the way to the Tube and the Elizabeth line.
      var dd = new T.Group(); dd.add(boxM(0.95, 0.34, 0.22, mat('ldnbus', 0xd8261c, { roughness: 0.45 }), 0, 0.2, 0)); dd.add(boxM(0.9, 0.05, 0.225, mat('cabin', 0x2a3a4a), 0, 0.17, 0, false)); dd.add(boxM(0.9, 0.05, 0.225, mat('cabin', 0x2a3a4a), 0, 0.31, 0, false)); dd.position.set(7.4, 0.02, 9.1); world.add(dd);
      var t5 = sprite('TERMINAL 5', '#4b2a7b', '#ffffff', 0.7); t5.position.set(11.1, 1.55, 8.6); world.add(t5);
      var tube = sprite('⊖ Underground · Elizabeth line', '#1f3a93', '#ffffff', 0.55); tube.position.set(5.6, 0.95, 10.6); world.add(tube);
      var bus = sprite('TfL buses', '#d8261c', '#ffffff', 0.45); bus.position.set(7.4, 0.75, 9.1); world.add(bus);
    }
    // Palms and shade trees.
    [[5.4, 9.6], [9.3, 9.7], [12.6, 9.6], [16.4, 9.6], [9.4, 12.5], [12.4, 12.5], [0.6, 13.2], [1.6, 14.1], [2.8, 13.0], [23.3, 8.4], [23.4, 11.0], [23.2, 13.9], [0.7, 2.9], [23.4, 3.2]].forEach(function (q) { world.add(LHR ? tree(q[0], q[1], 1.1) : palm(q[0], q[1], 0.95)); });
    for (var pr = 0; pr < 12; pr++) world.add(LHR ? tree(6.8 + pr * 1.4, 13.9 - (pr % 2) * 0.25, 1) : palm(6.8 + pr * 1.4, 13.9 - (pr % 2) * 0.25, 0.9));
    [[19.0, 8.1], [20.5, 8.0], [18.4, 12.0], [21.5, 12.4], [1.2, 8.0]].forEach(function (q) { world.add(tree(q[0], q[1], 0.9)); });
    // The perimeter fence: posts and three wires, with a gate house at the entrance.
    var postGeo = new T.BoxGeometry(0.04, 0.34, 0.04), postMat = mat('post', 0x5a6068, { metalness: 0.5 }), wireMat = new T.LineBasicMaterial({ color: 0x8a9097 });
    [[0.15, 0.15, 23.85, 0.15], [23.85, 0.15, 23.85, 14.85], [0.15, 0.15, 0.15, 14.85], [0.15, 14.85, 4.6, 14.85], [6.4, 14.85, 23.85, 14.85]].forEach(function (e) {
      var n = Math.max(2, Math.round(Math.hypot(e[2] - e[0], e[3] - e[1]) / 0.8));
      for (var i = 0; i <= n; i++) world.add(mesh(postGeo, postMat, e[0] + (e[2] - e[0]) * i / n, 0.17, e[1] + (e[3] - e[1]) * i / n, false));
      [0.12, 0.22, 0.32].forEach(function (y) { world.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(e[0], y, e[1]), new T.Vector3(e[2], y, e[3])]), wireMat)); });
    });
    world.add(boxM(0.6, 0.4, 0.5, mat('gatehouse', 0xe9eaec), 5.05, 0.2, 14.5)); var barrier = boxM(1.6, 0.04, 0.04, mat('barrier', 0xc0392b), 5.6, 0.32, 14.85, false); world.add(barrier);
    // The departures board on the plaza edge, redrawn from the live data.
    var boardTex = canvasTex(1024, 560, function () {});
    var boardG = new T.Group(); boardG.position.set(13.3, 0, 12.2);
    boardG.add(boxM(0.06, 1.1, 0.06, dark, -0.9, 0.55, 0)); boardG.add(boxM(0.06, 1.1, 0.06, dark, 0.9, 0.55, 0));
    boardG.add(boxM(2.3, 1.3, 0.08, dark, 0, 1.75, 0)); var bface = mesh(new T.PlaneGeometry(2.2, 1.2), new T.MeshBasicMaterial({ map: boardTex }), 0, 1.75, 0.045, false); boardG.add(bface);
    tag(boardG, 'board'); world.add(boardG);
    function drawBoard() {
      var b = state.board || { dep: [], arr: [] }, showArr = !reduce && Math.floor(performance.now() / 9000) % 2 === 1, rows = (showArr ? b.arr : b.dep) || [];
      var key = JSON.stringify([showArr, rows, state.clock]); if (boardTex.userData.key === key) return; boardTex.userData.key = key;
      var c = boardTex.userData.canvas, g = c.getContext('2d'), w = c.width, h = c.height;
      g.fillStyle = '#0d1117'; g.fillRect(0, 0, w, h); g.font = '800 44px ui-monospace, Menlo, monospace'; g.textBaseline = 'middle';
      g.fillStyle = '#f2b600'; g.textAlign = 'left'; g.fillText(showArr ? 'ARRIVALS' : 'DEPARTURES', 24, 40); g.textAlign = 'right'; g.fillText(state.clock || '', w - 24, 40); g.textAlign = 'left';
      var cx = [24, 160, 330, 690, 800]; g.font = '700 26px ui-monospace, Menlo, monospace'; g.fillStyle = '#8fa2b3';
      ['TIME', 'FLIGHT', showArr ? 'FROM' : 'TO', 'TYPE', 'STATUS'].forEach(function (t, i) { g.fillText(t, cx[i], 92); });
      g.font = '800 32px ui-monospace, Menlo, monospace';
      rows.slice(0, 6).forEach(function (r, i) { var y = 150 + i * 66, st = r.status, sc = /Boarding|Final|Landed|Gate|Baggage/.test(st) ? '#4be08a' : /Delayed/.test(st) ? '#ff8a3d' : /Departed/.test(st) ? '#8fa2b3' : '#f4f3ec';
        g.fillStyle = '#f4f3ec'; g.fillText(r.time, cx[0], y); g.fillStyle = '#ffd36b'; g.fillText(r.code, cx[1], y); g.fillStyle = '#f4f3ec'; g.fillText(r.city.toUpperCase().slice(0, 14), cx[2], y); g.fillStyle = r.kind === 'heli' ? '#7fd3ff' : '#f4f3ec'; g.fillText(r.kind === 'heli' ? 'HELI' : 'JET', cx[3], y); g.fillStyle = sc; g.fillText(st.toUpperCase().slice(0, 10), cx[4], y); });
      boardTex.needsUpdate = true;
    }

    /* ---------- moving things ---------- */
    var landing = airliner(0x1d7a43, 2.1); world.add(landing); var depPlane = airliner(0xc0392b, 2.1); world.add(depPlane);
    var landLabel = sprite('', 'rgba(23,24,26,.8)', '#fff', 0.8); world.add(landLabel); var depLabel = sprite('', 'rgba(23,24,26,.8)', '#fff', 0.8); world.add(depLabel);
    var flyHeli = helicopter(0x1f3b63); world.add(flyHeli); var flyJet = bizjet(0xf7f7f5, 0x1d7a43); world.add(flyJet);
    var smoke = []; for (var sm = 0; sm < 5; sm++) { var pf = mesh(geo('puff', function () { return new T.SphereGeometry(0.12, 8, 6); }), new T.MeshBasicMaterial({ color: 0xf4f4f4, transparent: true, opacity: 0, depthWrite: false }), 0, 0.1, 1.55, false); world.add(pf); smoke.push(pf); }
    var lastSlot = null;
    var traffic = []; for (var m = 0; m < 6; m++) { var tc = car(CARC[m % CARC.length]); world.add(tc); traffic.push({ o: tc, k: 'kerb', u: m / 6 }); }
    for (var n2 = 0; n2 < 5; n2++) { var ac = car(CARC[(n2 + 3) % CARC.length]); world.add(ac); traffic.push({ o: ac, k: 'access', u: n2 / 5, lane: n2 % 2 }); }
    var bus = car(0x2f6fd0, true); world.add(bus); traffic.push({ o: bus, k: 'kerb', u: 0.5, speed: 0.6 });
    var walkers = []; for (var pi = 0; pi < 26; pi++) { var wk = person(pi, pi % 2 === 1, 2.6); world.add(wk); walkers.push({ o: wk, i: pi, out: pi % 3 === 0, x: 6.2 + (pi * 0.71 % 9.8), u: (pi * 0.137) % 1 }); }
    GATES.forEach(function (gx, gi) { for (var b = 0; b < 3; b++) { var p = person(gi * 3 + b, b % 2 === 1, 2.2); p.visible = false; world.add(p); gateObjs[gi].walkers.push(p); } });
    var players = []; function syncPlayers() {
      var list = (state.players || []).slice(0, 6);
      while (players.length < list.length) { var p = person(players.length + 2, false, 3.2), lb = sprite('', '#2f6fd0', '#fff', 0.6); world.add(p); world.add(lb); players.push({ o: p, l: lb }); }
      players.forEach(function (pl, i) { var d = list[i]; pl.o.visible = pl.l.visible = !!d; if (!d) return; pl.o.position.set(7 + i * 1.6, 0.02, 9.55); setSpriteText(pl.l, d.label, d.me ? '#2f6fd0' : 'rgba(20,24,30,.85)'); pl.l.position.set(7 + i * 1.6, 0.75, 9.55); });
    }

    /* ---------- camera: orbit with drag, zoom with wheel or pinch ---------- */
    var orbit = { az: -0.62, pol: 0.95, r: 26, tx: 12, ty: 0, tz: 8.2 }, ptrs = {}, drag = null, pinch0 = 0, moved = false, follow = !reduce;
    function place() { orbit.pol = Math.max(0.25, Math.min(1.35, orbit.pol)); orbit.r = Math.max(5, Math.min(48, orbit.r)); var sp = Math.sin(orbit.pol); camera.position.set(orbit.tx + orbit.r * sp * Math.sin(orbit.az), orbit.ty + orbit.r * Math.cos(orbit.pol), orbit.tz + orbit.r * sp * Math.cos(orbit.az)); camera.lookAt(orbit.tx, orbit.ty, orbit.tz); }
    // The follow-cam tracks each movement; any drag, zoom or turn hands the camera back to you.
    function setFollow(on) { follow = on; var fb = bar && bar.querySelector('[data-a3="follow"]'); if (fb) { fb.setAttribute('aria-pressed', String(on)); fb.classList.toggle('on', on); } }
    place();
    cv.addEventListener('pointerdown', function (e) { ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; drag = { x: e.clientX, y: e.clientY }; moved = false; if (Object.keys(ptrs).length === 2) { var a = Object.values(ptrs); pinch0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); } try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
    cv.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var a = Object.values(ptrs);
      if (a.length === 2 && pinch0) { var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); orbit.r *= pinch0 / Math.max(1, d); pinch0 = d; moved = true; setFollow(false); place(); return; }
      if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) { moved = true; if (follow) setFollow(false); }
      if (e.shiftKey || e.buttons === 2) { var k = orbit.r / 600; orbit.tx -= (dx * Math.cos(orbit.az) - dy * Math.sin(orbit.az)) * k; orbit.tz -= (-dx * Math.sin(orbit.az) - dy * Math.cos(orbit.az)) * k * -1; }
      else { orbit.az -= dx * 0.006; orbit.pol -= dy * 0.005; }
      drag = { x: e.clientX, y: e.clientY }; place();
    });
    function up(e) { delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch0 = 0; if (!Object.keys(ptrs).length) drag = null; }
    cv.addEventListener('pointerup', function (e) { var wasMoved = moved; up(e); if (!wasMoved) tap(e); });
    cv.addEventListener('pointercancel', up); cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('wheel', function (e) { e.preventDefault(); setFollow(false); orbit.r *= Math.exp(e.deltaY * 0.0012); place(); }, { passive: false });
    var ray = new T.Raycaster(), ndc = new T.Vector2();
    function tap(e) {
      if (!opts.onTap) return; var r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
      var hit = ray.intersectObjects(world.children, true).filter(function (h) { return h.object.userData.kind; })[0]; if (hit) opts.onTap(hit.object.userData.kind);
    }
    // Buttons: turn and zoom.
    var bar = document.createElement('div'); bar.className = 'iv-spin';
    bar.innerHTML = '<button type="button" class="pg-zbtn' + (follow ? ' on' : '') + '" data-a3="follow" aria-pressed="' + follow + '" aria-label="Follow the aircraft" title="Follow the aircraft">🎥</button><button type="button" class="pg-zbtn" data-a3="in" aria-label="Zoom in">+</button><button type="button" class="pg-zbtn" data-a3="out" aria-label="Zoom out">−</button><button type="button" class="pg-zbtn" data-a3="l" aria-label="Turn left">⟲</button><button type="button" class="pg-zbtn" data-a3="r" aria-label="Turn right">⟳</button>';
    el.appendChild(bar);
    bar.addEventListener('click', function (e) { var b = e.target.closest('[data-a3]'); if (!b) return; var a = b.getAttribute('data-a3'); if (a === 'follow') { setFollow(!follow); if (!follow) { orbit.tx = 12; orbit.ty = 0; orbit.tz = 8.2; orbit.r = 26; orbit.pol = 0.95; place(); } return; } setFollow(false); if (a === 'in') orbit.r *= 0.8; else if (a === 'out') orbit.r *= 1.25; else orbit.az += (a === 'l' ? 1 : -1) * Math.PI / 4; place(); });

    /* ---------- frame ---------- */
    var last = 0;
    function size() { var w = el.clientWidth || 360, h = el.clientHeight || 400; if (w === W && h === H) return; W = w; H = h; renderer.setSize(W, H, false); cv.style.width = W + 'px'; cv.style.height = H + 'px'; camera.aspect = W / H; camera.updateProjectionMatrix(); }
    function frame(t) {
      if (root.LasgidiGL && !root.LasgidiGL.live(el)) { raf = el.isConnected ? root.requestAnimationFrame(frame) : 0; return; } // hidden or under another view: skip the frame
      root.LasgidiGL && root.LasgidiGL.pace(renderer);
      size(); var dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t; var s = reduce ? 0 : t / 1000;
      var night = !!state.night; hemi.intensity = night ? 0.6 : 0.9; sun.intensity = night ? 0.4 : 1.6; sun.color.set(night ? 0x9fb7ff : 0xffffff); var dayC = LHR ? 0xb7c2cc : 0x9fd3ef; scene3.background = new T.Color(night ? 0x0d1a2e : dayC); scene3.fog.color.set(night ? 0x0d1a2e : dayC);
      glass.emissive = new T.Color(night ? 0x6a5a2a : 0x000000); glass.emissiveIntensity = night ? 0.6 : 0;
      // Rotors, beacon, fountain and flags.
      helis.forEach(function (h, i) { h.userData.rotor.rotation.y = s * (i === 0 ? 14 : 0.2); h.userData.trotor.rotation.z = s * 30; });
      beacon.visible = reduce || Math.floor(t / 600) % 2 === 0;
      jetsW.forEach(function (d, i) { var u = (s * 0.9 + i / jetsW.length) % 1, a = i * Math.PI / 4; d.position.set(10.95 + Math.cos(a) * u * 0.45, 0.15 + Math.sin(u * Math.PI) * 0.55, 11.4 + Math.sin(a) * u * 0.45); });
      flags.forEach(function (f, i) { f.rotation.y = Math.sin(s * 1.8 + i) * 0.35; });
      // Gates follow the board: a departed flight leaves its stand empty; boarding gates show passengers on the bridge.
      var gates = state.gates || [];
      gateObjs.forEach(function (go, gi) {
        var gs = gates[gi] || {}; go.plane.visible = gs.status !== 'Departed';
        setSpriteText(go.label, 'Gate ' + (gi + 1) + (gs.code ? ' · ' + gs.code + (gs.status ? ' · ' + gs.status : '') : ''), /Boarding|Final/.test(gs.status) ? '#1d7a43' : 'rgba(23,24,26,.8)');
        var boarding = /Boarding|Final/.test(gs.status);
        go.walkers.forEach(function (p, b) { p.visible = boarding; if (!boarding) return; var u = (s / 2.6 + b / 3) % 1; p.position.set(GATES[gi] + 0.37, 0.43, 6.8 - u * 1.4); p.rotation.y = Math.PI; swing(p, s + b); });
      });
      // The sky: a movement every 20 seconds (airliner, private jet, helicopter; landing then take-off), each announced.
      var sec = reduce ? 5 : s, Sky = root.LasgidiSky, mv = Sky ? Sky.at(sec, state) : null;
      [landing, depPlane, flyJet, flyHeli].forEach(function (o) { o.visible = false; }); landLabel.visible = depLabel.visible = false; helis[3].visible = false;
      if (mv) {
        var obj = mv.kind === 'airliner' ? (mv.phase === 'arr' ? landing : depPlane) : mv.kind === 'jet' ? flyJet : flyHeli, nx = Sky.at(sec + 0.08, state), dx = nx.x - mv.x, dz = nx.y - mv.y;
        obj.visible = true; obj.position.set(mv.x, mv.h + 0.02, mv.y);
        var yaw = mv.kind === 'heli' ? 0.6 : Math.hypot(dx, dz) > 0.002 ? Math.atan2(-dz, dx) : obj.rotation.y;
        obj.rotation.set(0, yaw, mv.pitch);
        if (mv.kind === 'heli') { obj.userData.rotor.rotation.y = s * 16 * mv.rotor; obj.userData.trotor.rotation.z = s * 30 * mv.rotor; }
        var lb = mv.phase === 'arr' ? landLabel : depLabel; lb.visible = true; lb.position.set(mv.x, mv.h + (mv.kind === 'airliner' ? 1.1 : 0.8), mv.y); setSpriteText(lb, mv.label);
        smoke.forEach(function (p, k) { var a = mv.smoke ? Math.max(0, mv.smoke - k * 0.12) : 0; p.visible = a > 0; if (!a) return; p.position.set(mv.x - 0.5 - a * (0.6 + k * 0.3), 0.08 + a * 0.15, mv.y + (k % 2 ? 0.12 : -0.12)); p.scale.setScalar(0.6 + a * 2.2); p.material.opacity = 0.6 * (1 - a); });
        if (follow) {
          var home = mv.u > 0.93, ft = home ? [12, 0, 8.2] : [mv.x, mv.h * 0.8, mv.y], fr = home ? 22 : mv.kind === 'airliner' ? 9 : mv.kind === 'jet' ? 7 : 6, k = 1 - Math.exp(-dt * (home ? 1.2 : 2.2));
          orbit.tx += (ft[0] - orbit.tx) * k; orbit.ty += (ft[1] - orbit.ty) * k; orbit.tz += (ft[2] - orbit.tz) * k; orbit.r += (fr - orbit.r) * k; orbit.pol += ((home ? 0.95 : 1.12) - orbit.pol) * k; place();
        }
        if (lastSlot !== mv.n) { lastSlot = mv.n; if (opts.onMovement) { try { opts.onMovement(mv); } catch (e) {} } }
      }
      // Traffic and walkers.
      traffic.forEach(function (c) { var u = reduce ? c.u : (c.u + s * 0.09 * (c.speed || 1)) % 1; if (c.k === 'kerb') { c.o.position.set(5.6 + u * 11.2, 0.02, 8.98); c.o.rotation.y = 0; } else { c.o.position.set(22.8 - u * 17, 0.02, 12.93 + c.lane * 0.25); c.o.rotation.y = Math.PI; } });
      walkers.forEach(function (w) { var u = reduce ? w.u : (w.u + s * 0.11) % 1, z = w.out ? 9.5 + u * 2.9 : 12.4 - u * 2.9; w.o.position.set(w.x, 0.02, z); w.o.rotation.y = w.out ? 0 : Math.PI; swing(w.o, s + w.i); });
      drawBoard();
      renderer.render(scene3, camera);
      raf = el.isConnected ? root.requestAnimationFrame(frame) : 0;
    }
    function swing(p, s) { var a = reduce ? 0 : Math.sin(s * 8) * 0.5; p.userData.legs[0].rotation.z = a; p.userData.legs[1].rotation.z = -a; }
    function update(next) {
      var prevName = state.name + '|' + state.code; state = Object.assign({}, state, next || {});
      if (state.name + '|' + state.code !== prevName) { var c = bandTex.userData.canvas; bandTex.userData.draw(c.getContext('2d'), c.width, c.height); bandTex.needsUpdate = true; }
      jets[0].traverse(function (o) { if (o.isMesh && o.material !== dark) o.material = state.myJet ? col(parseInt(String(state.myJet).replace('#', ''), 16)) : col(0x1f2329); }); myJetLabel.visible = !!state.myJet;
      syncPlayers();
      if (!raf && el.isConnected) raf = root.requestAnimationFrame(frame);
    }
    function start() { if (!raf) raf = root.requestAnimationFrame(frame); }
    return { el: el, update: update, start: start, canvas: cv, is3d: true, dispose: function () { if (raf) root.cancelAnimationFrame(raf); raf = 0; if (root.LasgidiGL) root.LasgidiGL.free(renderer); else renderer.dispose(); } };
  }
  root.LasgidiAirport3D = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
