/* Lasgidi — shared 3D vehicle models (okada, keke, car, SUV, cab, danfo, bus) built from side profiles and turned
   parts, so every scene draws the same detailed vehicles. Our own designs. Units are metres, the ground is y = 0 and
   the front faces -z. vehicle(T, kind, opts) returns a THREE.Group; opts: { color, lite, london, rider: {look, outfit},
   seated: [{look, outfit}, …] }. Riders and passengers use LasgidiAvatar3D.figure when it is loaded. */
(function (root) {
  'use strict';
  var MATS = {};
  function mat(T, key, o) { var k = key + ':' + (o.color != null ? o.color : ''); return MATS[k] || (MATS[k] = new T.MeshStandardMaterial(o)); }
  function mesh(T, g, geo, m, x, y, z) { var o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; }
  // A tube between two points.
  function tube(T, g, a, b, r, m, seg) {
    var A = new T.Vector3(a[0], a[1], a[2]), B = new T.Vector3(b[0], b[1], b[2]), d = B.clone().sub(A), len = d.length();
    var o = mesh(T, g, new T.CylinderGeometry(r, r, len, seg || 8), m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); return o;
  }
  // A box with rounded edges (a rounded rectangle extruded with a small bevel).
  function rbox(T, w, h, d, r) {
    r = Math.min(r || 0.05, w / 2 - 0.001, h / 2 - 0.001); var s = new T.Shape(), x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, H = h - 2 * r;
    s.moveTo(x, y - r); s.lineTo(x + W, y - r); s.quadraticCurveTo(x + W + r, y - r, x + W + r, y); s.lineTo(x + W + r, y + H); s.quadraticCurveTo(x + W + r, y + H + r, x + W, y + H + r);
    s.lineTo(x, y + H + r); s.quadraticCurveTo(x - r, y + H + r, x - r, y + H); s.lineTo(x - r, y); s.quadraticCurveTo(x - r, y - r, x, y - r);
    var bev = Math.min(r, d / 4, w / 4, h / 4), geo = new T.ExtrudeGeometry(s, { depth: d - 2 * bev, bevelEnabled: true, bevelSize: bev * 0.9, bevelOffset: -bev * 0.9, bevelThickness: bev, bevelSegments: 2, curveSegments: 4 });
    geo.translate(0, 0, -(d - 2 * bev) / 2); return geo;
  }
  // A wheel: tyre, rim, hub; spokes for motorbikes. Axis along x.
  function wheel(T, g, x, y, z, r, w, o) {
    o = o || {}; var wg = new T.Group(); wg.position.set(x, y, z); g.add(wg);
    var tyre = mesh(T, wg, new T.TorusGeometry(r - w * 0.35, w * 0.42, 8, o.lite ? 14 : 22), mat(T, 'tyre', { color: 0x16171a, roughness: 0.9 })); tyre.rotation.y = Math.PI / 2;
    var rim = mesh(T, wg, new T.CylinderGeometry(r * (o.spokes ? 0.78 : 0.6), r * (o.spokes ? 0.78 : 0.6), w * 0.5, o.lite ? 12 : 18, 1, !!o.spokes), mat(T, 'rim', { color: o.rim || 0xb9bec6, roughness: 0.3, metalness: 0.85, side: 2 })); rim.rotation.z = Math.PI / 2;
    var hub = mesh(T, wg, new T.CylinderGeometry(r * 0.16, r * 0.16, w * 0.9, 10), mat(T, 'hub', { color: 0x8a9099, roughness: 0.35, metalness: 0.8 })); hub.rotation.z = Math.PI / 2;
    if (o.spokes && !o.lite) for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; tube(T, wg, [0, 0, 0], [0, Math.cos(a) * r * 0.76, Math.sin(a) * r * 0.76], 0.006, mat(T, 'spoke', { color: 0xd0d4da, roughness: 0.3, metalness: 0.9 }), 4); }
    else if (!o.spokes) for (var j = 0; j < 5; j++) { var b = j / 5 * Math.PI * 2, sp = mesh(T, wg, new T.BoxGeometry(w * 0.52, r * 0.42, r * 0.1), mat(T, 'rimsp', { color: 0x9aa0a8, roughness: 0.3, metalness: 0.85 }), 0, Math.cos(b) * r * 0.32, Math.sin(b) * r * 0.32); sp.rotation.x = b; }
    wg.userData.wheel = true; return wg;
  }
  function light(T, g, x, y, z, r, color, kind) { var m = mesh(T, g, kind === 'disc' ? new T.CylinderGeometry(r, r, 0.04, 14) : new T.SphereGeometry(r, 12, 8), new T.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.9, roughness: 0.2 }), x, y, z); if (kind === 'disc') m.rotation.x = Math.PI / 2; return m; }
  function glassM(T) { return mat(T, 'glass', { color: 0x223a4a, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.82 }); }
  function bodyM(T, c, rough) { return mat(T, 'body' + (rough || ''), { color: c, roughness: rough == null ? 0.32 : rough, metalness: 0.35 }); }
  function seatFig(T, g, who, x, y, z, ry, pose) {
    var A = root.LasgidiAvatar3D; if (!A || !who) return null;
    var f = A.figure(T, who.look || { skin: 2, hair: 0, shape: 1 }, who.outfit || {}, who.extra || null);
    f.position.set(x, y, z); f.rotation.y = ry == null ? Math.PI : ry; if (A.pose) A.pose(f, pose || 'sit'); g.add(f); return f;
  }

  // ---- Okada: a commuter motorbike with a long seat for a passenger.
  function okada(T, o) {
    var g = new T.Group(), c = o.color != null ? o.color : 0xc0392b, paint = bodyM(T, c), dark = mat(T, 'okdark', { color: 0x1d1f23, roughness: 0.55, metalness: 0.4 }), chrome = mat(T, 'chrome', { color: 0xdfe3e8, roughness: 0.18, metalness: 0.95 }), seat = mat(T, 'okseat', { color: 0x17181a, roughness: 0.75 });
    var R = 0.31; wheel(T, g, 0, R, -0.68, R, 0.11, { spokes: true, lite: o.lite }); wheel(T, g, 0, R, 0.66, R, 0.12, { spokes: true, lite: o.lite });
    [-1, 1].forEach(function (sd) { tube(T, g, [sd * 0.085, 1.0, -0.5], [sd * 0.085, R, -0.68], 0.022, chrome); });
    tube(T, g, [0, 1.02, -0.5], [0, 0.48, -0.05], 0.035, paint); tube(T, g, [0, 0.86, -0.3], [0, 0.82, 0.55], 0.03, dark); tube(T, g, [0, 0.45, 0], [0, R, 0.66], 0.03, dark);
    [-1, 1].forEach(function (sd) { tube(T, g, [sd * 0.1, 0.42, 0.05], [sd * 0.1, R + 0.02, 0.66], 0.02, dark); tube(T, g, [sd * 0.1, 0.8, 0.5], [sd * 0.1, R + 0.02, 0.66], 0.018, chrome); });
    tube(T, g, [-0.36, 1.12, -0.47], [0.36, 1.12, -0.47], 0.016, chrome); [-1, 1].forEach(function (sd) { tube(T, g, [sd * 0.31, 1.12, -0.47], [sd * 0.4, 1.12, -0.46], 0.024, seat); tube(T, g, [sd * 0.2, 1.12, -0.47], [sd * 0.26, 1.3, -0.5], 0.008, dark); var mir = mesh(T, g, new T.CylinderGeometry(0.045, 0.045, 0.012, 12), chrome, sd * 0.27, 1.32, -0.5); mir.rotation.x = Math.PI / 2; });
    mesh(T, g, new T.CylinderGeometry(0.07, 0.085, 0.1, 12), dark, 0, 1.06, -0.56).rotation.x = Math.PI / 2 - 0.3; light(T, g, 0, 1.06, -0.62, 0.065, 0xfff4cc, 'disc');
    var tank = mesh(T, g, new T.SphereGeometry(0.2, 16, 12), paint, 0, 0.9, -0.22); tank.scale.set(0.85, 0.62, 1.4);
    var st = mesh(T, g, rbox(T, 0.27, 0.09, 0.78, 0.04), seat, 0, 0.9, 0.22); st.rotation.x = 0.04;
    mesh(T, g, rbox(T, 0.22, 0.2, 0.42, 0.05), paint, 0, 0.75, 0.25);
    mesh(T, g, rbox(T, 0.24, 0.26, 0.3, 0.04), dark, 0, 0.44, -0.05); if (!o.lite) for (var f = 0; f < 4; f++) mesh(T, g, new T.BoxGeometry(0.28, 0.012, 0.22), chrome, 0, 0.5 + f * 0.035, -0.12);
    tube(T, g, [0.1, 0.38, -0.02], [0.17, 0.36, 0.35], 0.03, chrome); tube(T, g, [0.17, 0.36, 0.35], [0.18, 0.42, 0.78], 0.045, chrome);
    var fg = mesh(T, g, new T.TorusGeometry(R + 0.04, 0.03, 6, 18, Math.PI * 0.8), paint, 0, R, -0.68); fg.rotation.y = Math.PI / 2; fg.rotation.x = -0.1;
    var rg = mesh(T, g, new T.TorusGeometry(R + 0.05, 0.035, 6, 18, Math.PI * 0.75), paint, 0, R, 0.66); rg.rotation.y = Math.PI / 2; rg.rotation.x = 1.2;
    mesh(T, g, new T.BoxGeometry(0.3, 0.03, 0.34), dark, 0, 0.98, 0.72); light(T, g, 0, 0.88, 0.86, 0.035, 0xd8261c, 'disc');
    [-1, 1].forEach(function (sd) { tube(T, g, [sd * 0.06, 0.36, -0.1], [sd * 0.22, 0.36, -0.1], 0.012, dark); tube(T, g, [sd * 0.06, 0.42, 0.42], [sd * 0.22, 0.42, 0.42], 0.012, dark); });
    tube(T, g, [-0.04, 0.3, 0.1], [-0.12, 0.05, 0.25], 0.012, dark); // the stand
    if (o.rider) { var rd = seatFig(T, g, o.rider, 0, 0.11, 0.05, Math.PI, 'ride'); g.userData.rider = rd; }
    if (o.seated && o.seated[0]) seatFig(T, g, o.seated[0], 0, 0.12, 0.45, Math.PI, 'ride-back');
    return g;
  }

  // ---- Keke: a three-wheeled tricycle taxi with a canopy, windscreen, driver's seat and a back bench for three.
  function keke(T, o) {
    var g = new T.Group(), c = o.color != null ? o.color : 0x2fa36b, paint = bodyM(T, c, 0.4), roof = bodyM(T, o.roof != null ? o.roof : 0xf2c200, 0.45), dark = mat(T, 'kkdark', { color: 0x1d1f23, roughness: 0.6, metalness: 0.3 }), seat = mat(T, 'kkseat', { color: 0x3a2a24, roughness: 0.8 });
    wheel(T, g, 0, 0.26, -1.05, 0.26, 0.13, { lite: o.lite }); wheel(T, g, -0.58, 0.27, 0.72, 0.27, 0.14, { lite: o.lite }); wheel(T, g, 0.58, 0.27, 0.72, 0.27, 0.14, { lite: o.lite });
    // The tub: a side profile with a sloping nose, extruded across.
    var tub = new T.Mesh(profileZ(T, [[-0.78, 0.36], [-0.78, 0.74], [0.98, 0.74], [1.04, 0.4]], 1.26, 0.05), paint); tub.castShadow = true; g.add(tub);
    var cowl = new T.Mesh(profileZ(T, [[-1.36, 0.36], [-1.34, 0.9], [-1.18, 1.12], [-0.98, 1.16], [-0.72, 0.8], [-0.72, 0.36]], 0.82, 0.08), paint); cowl.castShadow = true; g.add(cowl);
    [-1, 1].forEach(function (sd) { var fl = mesh(T, g, new T.BoxGeometry(0.24, 0.36, 0.5), paint, sd * 0.5, 0.56, -0.95); fl.rotation.y = sd * 0.5; });
    mesh(T, g, new T.BoxGeometry(0.6, 0.06, 0.3), mat(T, 'kkdash', { color: 0x1d1f23, roughness: 0.6 }), 0, 1.1, -0.86);
    mesh(T, g, rbox(T, 1.3, 0.1, 2.3, 0.04), dark, 0, 0.36, -0.15);
    var ws = mesh(T, g, new T.PlaneGeometry(1.06, 0.62), glassM(T), 0, 1.42, -0.95); ws.rotation.x = -0.18;
    [-1, 1].forEach(function (sd) { tube(T, g, [sd * 0.6, 1.1, -0.95], [sd * 0.6, 1.88, -0.85], 0.022, dark); tube(T, g, [sd * 0.62, 0.72, 0.95], [sd * 0.62, 1.9, 0.9], 0.022, dark); tube(T, g, [sd * 0.62, 1.15, -0.2], [sd * 0.62, 1.15, 0.9], 0.016, dark); });
    var rf = mesh(T, g, rbox(T, 1.38, 0.08, 2.05, 0.04), roof, 0, 1.92, 0); rf.rotation.x = 0.03;
    var back = mesh(T, g, new T.CylinderGeometry(0.69, 0.69, 0.9, 16, 1, true, -Math.PI / 2, Math.PI), roof, 0, 1.47, 1.02); back.rotation.z = Math.PI / 2; back.scale.set(1, 1, 0.25); back.material.side = 2;
    if (!o.lite) [-1, 1].forEach(function (sd) { var fl = mesh(T, g, new T.CylinderGeometry(0.05, 0.05, 1.6, 8), mat(T, 'kkflap', { color: 0x1f3b63, roughness: 0.9 }), sd * 0.66, 1.84, 0.1); fl.rotation.x = Math.PI / 2; });
    mesh(T, g, rbox(T, 0.42, 0.1, 0.42, 0.05), seat, 0, 0.95, -0.42); tube(T, g, [-0.32, 1.22, -0.78], [0.32, 1.22, -0.78], 0.016, dark); tube(T, g, [0, 1.22, -0.78], [0, 0.95, -1.0], 0.025, dark);
    mesh(T, g, rbox(T, 1.12, 0.14, 0.5, 0.05), seat, 0, 0.9, 0.5); mesh(T, g, rbox(T, 1.12, 0.5, 0.1, 0.05), seat, 0, 1.18, 0.8);
    light(T, g, 0, 1.0, -1.31, 0.07, 0xfff4cc, 'disc'); [-1, 1].forEach(function (sd) { light(T, g, sd * 0.5, 0.62, 1.04, 0.04, 0xd8261c, 'disc'); });
    mesh(T, g, new T.BoxGeometry(0.4, 0.13, 0.02), mat(T, 'kkplate', { color: 0xf4f3ec, roughness: 0.6 }), 0, 0.55, 1.04);
    if (o.rider) seatFig(T, g, o.rider, 0, 0.16, -0.38, Math.PI, 'drive');
    (o.seated || []).slice(0, 3).forEach(function (who, i) { seatFig(T, g, who, -0.36 + i * 0.36, 0.13, 0.55, Math.PI, 'sit'); });
    return g;
  }
  // Same as profile() but keeps the shape's x as z (front = -z) without flipping.
  function profileZ(T, pts, width, bevel) {
    var s = new T.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
    var bv = bevel == null ? 0.06 : bevel, geo = new T.ExtrudeGeometry(s, { depth: width - 2 * bv, bevelEnabled: bv > 0, bevelSize: bv, bevelOffset: -bv, bevelThickness: bv, bevelSegments: 3, curveSegments: 6 });
    geo.translate(0, 0, -(width - 2 * bv) / 2); geo.rotateY(-Math.PI / 2); return geo; // shape x → world z (a pure rotation keeps the faces the right way out)
  }
  // Glass panel following the slope from a to b (each [z, y]) across the width, a touch outside the body.
  function slopeGlass(T, g, a, b, width, out) {
    var dz = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dz, dy), p = mesh(T, g, new T.PlaneGeometry(width, len), glassM(T), 0, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2);
    p.rotation.x = Math.atan2(dz, dy); p.translateZ(-Math.abs(out || 0.014)); p.material.side = 2; return p;
  }

  // ---- Cars: a saloon, an SUV, a cab and the London black cab, each from its own side profile.
  var CAR = {
    car: { w: 1.8, wb: 1.38, r: 0.33, pts: [[-2.25, 0.32], [-2.28, 0.62], [-2.05, 0.8], [-0.95, 0.92], [-0.35, 1.4], [0.7, 1.42], [1.45, 1.0], [2.18, 0.95], [2.25, 0.62], [2.2, 0.32]], wind: [[-0.93, 0.95], [-0.37, 1.38]], rear: [[0.72, 1.4], [1.43, 1.02]], win: [[-0.85, 0.97], [-0.36, 1.33], [0.68, 1.35], [1.32, 1.0]] },
    suv: { w: 1.95, wb: 1.45, r: 0.38, pts: [[-2.35, 0.38], [-2.38, 0.85], [-2.1, 1.02], [-1.2, 1.12], [-0.7, 1.72], [1.95, 1.75], [2.32, 1.62], [2.36, 0.85], [2.3, 0.38]], wind: [[-1.18, 1.14], [-0.72, 1.7]], rear: [[2.0, 1.72], [2.33, 1.15]], win: [[-1.1, 1.17], [-0.7, 1.66], [1.9, 1.68], [2.25, 1.18]] },
    // Luxury bodies (our own shapes, after each class): a low wedge supercar, a curvy mid-engine car, a two-tone
    // hypercar with a horseshoe grille, a long-bonnet grand tourer, a boxy 4x4, a six-wheel 6x6 pickup, a chauffeur
    // limousine with a tall chrome grille, and an open roadster.
    wedge: { w: 2.05, wb: 1.35, r: 0.36, rim: 0x2a2c30, grille: 'mesh', spoiler: true, intakes: true, pts: [[-2.3, 0.28], [-2.34, 0.5], [-1.3, 0.74], [-0.42, 1.1], [0.45, 1.12], [1.7, 0.95], [2.25, 0.86], [2.28, 0.3]], wind: [[-1.25, 0.77], [-0.45, 1.08]], rear: [[0.5, 1.1], [1.6, 0.97]], win: [[-1.15, 0.8], [-0.42, 1.05], [0.42, 1.06], [1.0, 0.92]] },
    roadster: { w: 2.05, wb: 1.35, r: 0.36, rim: 0x2a2c30, grille: 'mesh', spoiler: true, intakes: true, open: true, pts: [[-2.3, 0.28], [-2.34, 0.5], [-1.3, 0.74], [-0.55, 0.95], [1.55, 0.95], [2.25, 0.86], [2.28, 0.3]], wind: [[-1.2, 0.78], [-0.62, 1.12]] },
    curvy: { w: 1.98, wb: 1.33, r: 0.35, grille: 'mesh', intakes: true, pts: [[-2.25, 0.3], [-2.3, 0.55], [-1.95, 0.7], [-0.95, 0.82], [-0.35, 1.18], [0.45, 1.2], [1.35, 1.0], [2.2, 0.86], [2.26, 0.34]], wind: [[-0.93, 0.84], [-0.37, 1.16]], rear: [[0.5, 1.18], [1.3, 1.0]], win: [[-0.85, 0.87], [-0.35, 1.13], [0.42, 1.14], [1.0, 0.95]] },
    hyper: { w: 2.05, wb: 1.38, r: 0.37, rim: 0xc9ccd2, grille: 'horseshoe', spoiler: true, pts: [[-2.2, 0.3], [-2.25, 0.62], [-1.65, 0.8], [-0.65, 0.92], [-0.12, 1.2], [0.65, 1.22], [1.55, 1.02], [2.25, 0.92], [2.28, 0.35]], front2: [[-2.21, 0.3], [-2.26, 0.62], [-1.66, 0.81], [-0.75, 0.93], [-0.5, 0.75], [-0.62, 0.3]], wind: [[-0.62, 0.95], [-0.14, 1.18]], rear: [[0.7, 1.2], [1.5, 1.03]], win: [[-0.55, 0.97], [-0.12, 1.15], [0.62, 1.16], [1.2, 1.0]] },
    gt: { w: 1.96, wb: 1.48, r: 0.36, grille: 'chrome-wide', pts: [[-2.42, 0.33], [-2.45, 0.7], [-2.15, 0.86], [-0.75, 0.96], [-0.18, 1.36], [0.75, 1.38], [1.7, 1.02], [2.38, 0.92], [2.42, 0.36]], wind: [[-0.73, 0.98], [-0.2, 1.34]], rear: [[0.8, 1.36], [1.65, 1.04]], win: [[-0.65, 1.0], [-0.18, 1.31], [0.72, 1.32], [1.45, 1.04]] },
    boxy: { w: 1.98, wb: 1.45, r: 0.42, grille: 'black-bars', spare: true, pts: [[-2.35, 0.42], [-2.38, 1.15], [-1.55, 1.2], [-1.38, 1.98], [2.15, 2.0], [2.32, 1.95], [2.34, 0.42]], wind: [[-1.52, 1.22], [-1.39, 1.95]], rear: [[2.2, 1.96], [2.33, 1.3]], win: [[-1.45, 1.25], [-1.35, 1.9], [2.1, 1.92], [2.25, 1.3]] },
    boxy6: { w: 2.15, axles: [-2.0, 1.0, 2.3], r: 0.5, rim: 0xb9a57a, grille: 'black-bars', rollbar: true, pts: [[-3.0, 0.65], [-3.02, 1.4], [-2.15, 1.45], [-1.98, 2.3], [0.45, 2.32], [0.55, 1.5], [3.0, 1.5], [3.02, 0.65]], wind: [[-2.12, 1.47], [-1.99, 2.27]], rear: [[0.47, 2.3], [0.54, 1.6]], win: [[-2.05, 1.5], [-1.95, 2.22], [0.4, 2.24], [0.48, 1.55]] },
    limo: { w: 2.02, wb: 1.75, r: 0.38, grille: 'chrome-tall', pts: [[-2.95, 0.36], [-2.98, 1.02], [-2.45, 1.12], [-0.95, 1.17], [-0.42, 1.62], [1.45, 1.64], [2.35, 1.22], [2.95, 1.12], [2.98, 0.36]], wind: [[-0.93, 1.19], [-0.44, 1.6]], rear: [[1.5, 1.62], [2.32, 1.24]], win: [[-0.85, 1.21], [-0.42, 1.56], [1.42, 1.58], [2.1, 1.25]] },
    ldncab: { w: 1.75, wb: 1.35, r: 0.34, pts: [[-2.2, 0.34], [-2.24, 0.72], [-1.95, 0.9], [-1.0, 1.02], [-0.6, 1.62], [1.3, 1.66], [1.95, 1.3], [2.15, 0.95], [2.15, 0.34]], wind: [[-0.98, 1.04], [-0.62, 1.6]], rear: [[1.32, 1.64], [1.93, 1.32]], win: [[-0.9, 1.06], [-0.6, 1.56], [1.28, 1.58], [1.85, 1.3]] }
  };
  function car(T, o, kind) {
    var P = CAR[kind] || CAR.car, g = new T.Group(), c = o.color != null ? o.color : 0x2f6fa0, paint = bodyM(T, c), trim = mat(T, 'cartrim', { color: 0x1a1c20, roughness: 0.5, metalness: 0.3 }), chrome = mat(T, 'chrome', { color: 0xdfe3e8, roughness: 0.18, metalness: 0.95 });
    var nose = P.pts[1], tail = P.pts[P.pts.length - 2], axles = P.axles || [-P.wb, P.wb];
    var body = new T.Mesh(profileZ(T, P.pts, P.w, 0.07), paint); body.castShadow = true; body.receiveShadow = true; g.add(body);
    if (P.front2) { var f2 = new T.Mesh(profileZ(T, P.front2, P.w + 0.02, 0.06), bodyM(T, o.color2 != null ? o.color2 : 0x17181a)); g.add(f2); }
    if (!P.open) {
      g.add(new T.Mesh(profileZ(T, P.win, P.w + 0.03, 0), glassM(T)));
      mesh(T, g, new T.BoxGeometry(P.w + 0.05, (P.win[1][1] - P.win[0][1]) * 0.9, 0.09), paint, 0, (P.win[0][1] + P.win[2][1]) / 2, (P.win[1][0] + P.win[2][0]) / 2 - 0.05);
      slopeGlass(T, g, P.rear[0], P.rear[1], P.w * 0.8, 0.012);
    } else {
      [-0.42, 0.42].forEach(function (x) { mesh(T, g, rbox(T, 0.5, 0.12, 0.5, 0.05), mat(T, 'leather', { color: 0x7a1f1f, roughness: 0.7 }), x, 0.82, 0.05); mesh(T, g, rbox(T, 0.5, 0.55, 0.12, 0.05), mat(T, 'leather', { color: 0x7a1f1f, roughness: 0.7 }), x, 1.08, 0.32); });
      [-1, 1].forEach(function (sd) { mesh(T, g, new T.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), paint, sd * 0.42, 0.95, 0.6).scale.set(1, 1.4, 1.6); });
    }
    slopeGlass(T, g, P.wind[0], P.wind[1], P.w * 0.84, -0.012);
    [-1, 1].forEach(function (sd) {
      axles.forEach(function (zz) { var arch = mesh(T, g, new T.TorusGeometry(P.r + 0.06, 0.035, 6, 18, Math.PI), trim, sd * (P.w / 2 + 0.005), P.r, zz); arch.rotation.y = Math.PI / 2; wheel(T, g, sd * (P.w / 2 - 0.12), P.r, zz, P.r, P.r > 0.45 ? 0.36 : 0.26, { lite: o.lite, rim: P.rim }); });
      if (kind === 'boxy' || kind === 'boxy6') { var hl = mesh(T, g, new T.CylinderGeometry(0.1, 0.1, 0.05, 18), new T.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xfff1c0, emissiveIntensity: 0.8, roughness: 0.1 }), sd * P.w * 0.34, nose[1] - 0.1, nose[0] - 0.02); hl.rotation.x = Math.PI / 2; }
      else lamp(T, g, sd * P.w * 0.33, nose[1] - 0.07, nose[0] - 0.01, P.w * 0.2, 0.08, 0xfff4cc);
      lamp(T, g, sd * P.w * 0.36, tail[1] - 0.08, tail[0] + 0.015, P.w * 0.16, 0.08, 0xd8261c, true);
      if (!P.open && !o.lite) { // door seams and handles
        var seamM = mat(T, 'seam', { color: 0x111214, roughness: 0.8 }), wb = P.win[0][1], zs = kind === 'wedge' || kind === 'curvy' || kind === 'hyper' || kind === 'gt' || kind === 'roadster' ? [P.win[0][0], P.win[3][0] - 0.05] : [P.win[0][0], (P.win[1][0] + P.win[2][0]) / 2 - 0.05, P.win[3][0] - 0.1];
        zs.forEach(function (zz) { mesh(T, g, new T.BoxGeometry(0.008, Math.max(0.2, wb - P.pts[0][1] - 0.12), 0.012), seamM, sd * (P.w / 2 + 0.002), (wb + P.pts[0][1]) / 2 + 0.03, zz); });
        zs.slice(0, -1).forEach(function (zz, k) { mesh(T, g, rbox(T, 0.02, 0.03, 0.14, 0.01), chrome, sd * (P.w / 2 + 0.01), wb - 0.12, (zz + zs[k + 1]) / 2 + 0.25); });
      }
      if (!o.lite && !P.open) { var mir = mesh(T, g, rbox(T, 0.05, 0.1, 0.16, 0.02), paint, sd * (P.w / 2 + 0.05), P.wind[0][1] + 0.08, P.wind[0][0] + 0.12); mir.rotation.y = sd * 0.2; }
      if (P.intakes) { var ik = mesh(T, g, new T.BoxGeometry(0.02, 0.26, 0.6), trim, sd * (P.w / 2 + 0.005), 0.62, 0.55); ik.rotation.x = 0.35; }
    });
    // Grilles by class.
    var gz = nose[0] - 0.035;
    if (P.grille === 'mesh') mesh(T, g, rbox(T, P.w * 0.7, 0.16, 0.04, 0.04), trim, 0, P.pts[0][1] + 0.1, P.pts[0][0] - 0.02);
    else if (P.grille === 'horseshoe') { var hs = mesh(T, g, new T.TorusGeometry(0.17, 0.025, 8, 20, Math.PI * 1.3), chrome, 0, nose[1] - 0.2, gz); hs.rotation.z = -Math.PI * 0.15 + Math.PI; mesh(T, g, new T.CircleGeometry(0.16, 18), trim, 0, nose[1] - 0.22, gz - 0.005).rotation.y = Math.PI; }
    else if (P.grille === 'chrome-tall') { mesh(T, g, rbox(T, 0.62, 0.55, 0.06, 0.03), chrome, 0, nose[1] - 0.3, gz); mesh(T, g, new T.ConeGeometry(0.03, 0.12, 6), chrome, 0, nose[1] + 0.07, nose[0] + 0.02); }
    else if (P.grille === 'chrome-wide') { mesh(T, g, rbox(T, 0.8, 0.32, 0.05, 0.08), chrome, 0, nose[1] - 0.22, gz); mesh(T, g, rbox(T, 0.72, 0.25, 0.05, 0.06), trim, 0, nose[1] - 0.22, gz - 0.01); }
    else if (P.grille === 'black-bars') { mesh(T, g, rbox(T, P.w * 0.5, 0.36, 0.05, 0.03), trim, 0, nose[1] - 0.25, gz); for (var gb = 0; gb < 3; gb++) mesh(T, g, new T.BoxGeometry(P.w * 0.48, 0.025, 0.02), chrome, 0, nose[1] - 0.36 + gb * 0.1, gz - 0.03); }
    else mesh(T, g, rbox(T, P.w * 0.5, 0.16, 0.04, 0.03), trim, 0, nose[1] - 0.12, nose[0] - 0.03);
    if (P.spoiler) { mesh(T, g, rbox(T, P.w * 0.9, 0.04, 0.3, 0.02), trim, 0, tail[1] + 0.22, tail[0] - 0.15); [-1, 1].forEach(function (sd) { mesh(T, g, new T.BoxGeometry(0.04, 0.2, 0.08), trim, sd * P.w * 0.3, tail[1] + 0.1, tail[0] - 0.12); }); }
    if (P.spare) { var sp = wheel(T, g, 0, 1.0, P.pts[P.pts.length - 1][0] + 0.18, 0.36, 0.22, { lite: true }); sp.rotation.y = Math.PI / 2; sp.userData.wheel = false; }
    if (P.rollbar) { [-1, 1].forEach(function (sd) { tube(T, g, [sd * 0.9, 1.5, 0.75], [sd * 0.9, 2.15, 0.85], 0.04, chrome); }); tube(T, g, [-0.9, 2.15, 0.85], [0.9, 2.15, 0.85], 0.04, chrome); }
    mesh(T, g, new T.BoxGeometry(P.w + 0.02, 0.12, 0.06), trim, 0, P.pts[0][1] + 0.05, P.pts[0][0] + 0.02); mesh(T, g, new T.BoxGeometry(P.w + 0.02, 0.12, 0.06), trim, 0, P.pts[P.pts.length - 1][1] + 0.05, P.pts[P.pts.length - 1][0] - 0.02);
    plate(T, g, 0, P.pts[P.pts.length - 1][1] + 0.2, P.pts[P.pts.length - 1][0] + 0.06, 0, !!o.london); var fp = plate(T, g, 0, P.pts[0][1] + 0.2, P.pts[0][0] - 0.06, Math.PI, !!o.london);
    if (o.taxiSign) { mesh(T, g, rbox(T, 0.5, 0.14, 0.2, 0.04), new T.MeshStandardMaterial({ color: 0xfff2a8, emissive: 0xffd84a, emissiveIntensity: 0.5 }), 0, P.win[1][1] + 0.12, (P.win[1][0] + P.win[2][0]) / 2); }
    if (o.stripe != null) [-1, 1].forEach(function (sd) { mesh(T, g, new T.BoxGeometry(0.01, 0.1, Math.abs(P.pts[0][0]) * 1.8), mat(T, 'stripe', { color: o.stripe, roughness: 0.5 }), sd * (P.w / 2 + 0.07), 0.62, 0); });
    if (o.rider) { var seatY = P.open || /wedge|curvy|hyper/.test(kind) ? 0.32 : kind === 'boxy' || kind === 'boxy6' ? 0.85 : 0.42; if (!P.open) mesh(T, g, rbox(T, 0.5, 0.1, 0.5, 0.05), mat(T, 'carseat', { color: 0x2b2f36, roughness: 0.8 }), -0.38, seatY, 0.1); var dv = seatFig(T, g, o.rider, -0.38, seatY + 0.06 - 0.71, 0.12, Math.PI, 'drive'); if (dv) dv.scale.setScalar(0.85); }
    return g;
  }
  // Which body each car in the dealers' list wears (by id, then by its icon). Made-up names, own shapes.
  var BODY = { lambo_revuelto: 'wedge', supercar: 'wedge', lambo_roadster: 'roadster', ferrari_sf90: 'curvy', ferrari_812: 'curvy', mclaren_750s: 'curvy', porsche_911: 'curvy',
    bugatti_chiron: 'hyper', bugatti_sport: 'hyper', bentley_gt: 'gt', ferrari_roma: 'gt', rr_spectre: 'gt', gclass: 'boxy', merc_g63: 'boxy', merc_g6x6: 'boxy6',
    rr_phantom: 'limo', rr_ghost: 'limo', maybach_s680: 'limo', limo: 'limo', keke_own: 'keke', powerbike: 'okada', danfo_bus: 'danfo', ldn_hatch: 'car', tokunbo: 'car', muscle: 'car', merc_s: 'car', bmw_7: 'car', audi_a8: 'car' };
  function forVehicle(T, id, V, opts) {
    var b = BODY[id] || (V && /🏎/.test(V.icon || '') ? 'curvy' : V && /🚙|🛻/.test(V.icon || '') ? 'suv' : 'car');
    var col = V && V.color ? parseInt(String(V.color).replace('#', ''), 16) : undefined, o = Object.assign({ color: col, color2: V && V.color2 ? parseInt(String(V.color2).replace('#', ''), 16) : undefined }, opts || {});
    if (b === 'keke' || b === 'okada' || b === 'danfo') return vehicle(T, b, o);
    return vehicle(T, 'lux:' + b, o);
  }
  // Canvas textures for plates, route boards and adverts (made-up text only).
  var TX = {};
  function textTex(T, key, w, h, draw) { if (TX[key]) return TX[key]; var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return (TX[key] = t); }
  function plateTex(T, london) { return textTex(T, 'plate' + (london ? 'U' : ''), 256, 64, function (g, w, h) { g.fillStyle = london ? '#f2c200' : '#f4f3ec'; g.fillRect(0, 0, w, h); g.strokeStyle = '#17181a'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4); if (!london) { g.fillStyle = '#1d7a43'; g.font = '700 13px system-ui'; g.textAlign = 'center'; g.fillText('LAGOS · CENTRE OF EXCELLENCE', w / 2, 15); } g.fillStyle = london ? '#17181a' : '#1f3b63'; g.font = '900 ' + (london ? 40 : 34) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(london ? 'LD12 GDI' : 'KJA 482 XA', w / 2, london ? 46 : 52); }); }
  function plate(T, g, x, y, z, ry, london) { var p = mesh(T, g, new T.PlaneGeometry(0.42, 0.11), new T.MeshStandardMaterial({ map: plateTex(T, london), roughness: 0.5 }), x, y, z); p.rotation.y = ry; return p; }
  // A rounded lamp unit (head or tail) set into the body.
  function lamp(T, g, x, y, z, w, h, color, back) { var m = mesh(T, g, rbox(T, w, h, 0.05, Math.min(w, h) * 0.4), new T.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: back ? 0.6 : 0.85, roughness: 0.15, metalness: 0.2 }), x, y, z); return m; }

  // ---- Danfo: the yellow van of Lagos. Flat front with a black grille band and round headlamps, a steep windscreen,
  // two black stripes down each side, a row of windows, the sliding door open with the conductor hanging out, and
  // sometimes a wrapped load roped on the roof. London gets the classic red double-decker instead.
  function danfo(T, o) {
    var g = new T.Group(), c = o.color != null ? o.color : 0xf5a30c, paint = bodyM(T, c, 0.42), black = mat(T, 'dfblack', { color: 0x17181a, roughness: 0.6 }), chrome = mat(T, 'chrome', { color: 0xdfe3e8, roughness: 0.18, metalness: 0.95 }), steel = mat(T, 'dfsteel', { color: 0x8a9099, roughness: 0.4, metalness: 0.7 });
    var W = 1.86, pts = [[-2.26, 0.42], [-2.31, 0.98], [-2.29, 1.16], [-2.04, 1.96], [-1.86, 2.06], [2.16, 2.07], [2.3, 1.95], [2.31, 0.42]];
    var body = new T.Mesh(profileZ(T, pts, W, 0.09), paint); body.castShadow = true; body.receiveShadow = true; g.add(body);
    // Windscreen (with wipers) and the black front panel with round headlamps.
    slopeGlass(T, g, [-2.29, 1.18], [-2.05, 1.93], W * 0.86, -0.012);
    [-1, 1].forEach(function (sd) { var wp = mesh(T, g, new T.BoxGeometry(0.5, 0.02, 0.02), black, sd * 0.3, 1.24, -2.3); wp.rotation.z = sd * 0.4; });
    mesh(T, g, rbox(T, W * 0.9, 0.26, 0.05, 0.04), black, 0, 0.88, -2.32);
    for (var gr = 0; gr < 4; gr++) mesh(T, g, new T.BoxGeometry(W * 0.5, 0.018, 0.02), steel, 0, 0.8 + gr * 0.05, -2.35);
    [-1, 1].forEach(function (sd) { mesh(T, g, new T.CylinderGeometry(0.1, 0.1, 0.05, 18), new T.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xfff1c0, emissiveIntensity: 0.8, roughness: 0.1 }), sd * 0.68, 0.88, -2.36).rotation.x = Math.PI / 2; lamp(T, g, sd * 0.86, 0.66, -2.33, 0.12, 0.06, 0xf2a900); });
    mesh(T, g, rbox(T, 0.4, 0.12, 0.04, 0.03), black, 0, 0.62, -2.33); mesh(T, g, new T.BoxGeometry(0.3, 0.14, 0.02), mat(T, 'dfplate', { color: 0xf4f3ec, roughness: 0.5 }), 0.42, 1.08, -2.32);
    mesh(T, g, rbox(T, W + 0.06, 0.16, 0.18, 0.05), black, 0, 0.5, -2.36); mesh(T, g, rbox(T, W + 0.06, 0.16, 0.18, 0.05), black, 0, 0.52, 2.36);
    // Two black stripes, wheel arches, steel wheels with hubcaps, mirrors.
    [-1, 1].forEach(function (sd) {
      [1.0, 1.1].forEach(function (yy) { mesh(T, g, new T.BoxGeometry(0.012, 0.05, 4.5), black, sd * (W / 2 + 0.006), yy, 0.02); });
      [-1.42, 1.48].forEach(function (zz) { var arch = mesh(T, g, new T.TorusGeometry(0.44, 0.035, 6, 18, Math.PI), black, sd * (W / 2 + 0.004), 0.36, zz); arch.rotation.y = Math.PI / 2; wheel(T, g, sd * (W / 2 - 0.14), 0.36, zz, 0.36, 0.25, { lite: o.lite, rim: 0x9aa0a6 }); });
      var mr = mesh(T, g, rbox(T, 0.05, 0.16, 0.12, 0.02), black, sd * (W / 2 + 0.1), 1.45, -1.95); tube(T, g, [sd * W / 2, 1.42, -1.95], [sd * (W / 2 + 0.08), 1.45, -1.95], 0.012, black);
      lamp(T, g, sd * 0.8, 0.95, 2.33, 0.1, 0.3, 0xd8261c, true);
    });
    // Windows: the cab doors, the middle and the back, each a dark pane with a rubber frame.
    var win = function (x, z, len) { mesh(T, g, rbox(T, 0.03, 0.56, len, 0.07), glassM(T), x, 1.62, z); mesh(T, g, rbox(T, 0.02, 0.62, len + 0.06, 0.08), black, x - Math.sign(x) * 0.006, 1.62, z); };
    [-1, 1].forEach(function (sd) { win(sd * (W / 2 + 0.008), -1.45, 0.7); win(sd * (W / 2 + 0.008), 1.15, 1.2); });
    win(-(W / 2 + 0.008), 0.0, 1.2);
    // The sliding door is open on the kerb side (+x): a dark doorway, the door slid back over the rear window.
    mesh(T, g, new T.BoxGeometry(0.05, 1.5, 1.15), mat(T, 'dfinside', { color: 0x221d18, roughness: 0.9 }), W / 2 - 0.02, 1.18, -0.05);
    mesh(T, g, rbox(T, 0.05, 1.5, 1.1, 0.06), paint, W / 2 + 0.06, 1.2, 1.1);
    mesh(T, g, new T.BoxGeometry(0.4, 0.05, 1.1), black, W / 2 - 0.18, 0.46, -0.05); // the step
    // Rear: window, plate, ladder hooks.
    mesh(T, g, rbox(T, 1.3, 0.5, 0.03, 0.06), glassM(T), 0, 1.6, 2.33); plate(T, g, 0, 0.68, 2.36, 0, false);
    // Seats inside and the people.
    for (var sr = 0; sr < 3; sr++) mesh(T, g, rbox(T, 1.7, 0.12, 0.45, 0.05), mat(T, 'dfseat', { color: 0x5a3a2a, roughness: 0.8 }), 0, 0.92, -0.55 + sr * 0.92);
    (o.seated || []).slice(0, 6).forEach(function (who, i) { seatFig(T, g, who, i % 2 ? 0.42 : -0.42, 0.15, -0.5 + Math.floor(i / 2) * 0.92, Math.PI, 'sit'); });
    if (o.rider) seatFig(T, g, o.rider, -0.48, 0.15, -1.55, Math.PI, 'drive');
    var A = root.LasgidiAvatar3D;
    if (o.conductor !== false && A) { // the conductor stands on the step, one hand on the roof, shouting the route
      var cd = A.figure(T, (o.conductor && o.conductor.look) || { skin: 3, hair: 0, shape: 1 }, (o.conductor && o.conductor.outfit) || { top: 'jersey', bottom: 'trousers', shoes: 'slides' }, null);
      cd.position.set(W / 2 + 0.05, 0.48, -0.1); cd.rotation.y = Math.PI / 2 + 0.5; cd.scale.setScalar(0.92); var u = cd.userData;
      if (u.arms && u.arms[0]) { u.arms[0].rotation.z = -2.6; u.arms[0].rotation.x = 0.2; } if (u.legs && u.legs[1]) { u.legs[1].rotation.x = 0.35; u.knees[1].rotation.x = 0.4; }
      g.add(cd);
    }
    if (o.load) { var ld = mesh(T, g, rbox(T, 1.3, 0.75, 1.6, 0.3), mat(T, 'dfload', { color: 0xe58a12, roughness: 0.6 }), 0, 2.45, -0.1); mesh(T, g, new T.BoxGeometry(1.34, 0.77, 0.12), mat(T, 'dftape', { color: 0x3a9a4a, roughness: 0.6 }), 0, 2.45, -0.1); [-0.5, 0.5].forEach(function (zz) { mesh(T, g, new T.BoxGeometry(1.36, 0.03, 0.03), black, 0, 2.84, zz); }); }
    else if (!o.lite) { mesh(T, g, new T.BoxGeometry(1.5, 0.06, 3.2), black, 0, 2.12, 0.1); for (var b = 0; b < 5; b++) mesh(T, g, new T.BoxGeometry(1.5, 0.05, 0.05), black, 0, 2.17, -1.4 + b * 0.75); }
    return g;
  }
  // ---- The classic London double-decker: rounded front and back, two decks of windows, a cream band, an open
  // platform at the back on the kerb side, a route board and a side advert (made-up text).
  function routemaster(T, o) {
    var g = new T.Group(), red = bodyM(T, o.color != null ? o.color : 0xc8102e, 0.35), cream = mat(T, 'rmcream', { color: 0xf1e3b8, roughness: 0.6 }), black = mat(T, 'rmblack', { color: 0x17181a, roughness: 0.6 }), L2 = 8.4, W = 2.4;
    var lower = mesh(T, g, rbox(T, W, 1.95, L2, 0.18), red, 0, 1.35, 0), upper = mesh(T, g, rbox(T, W, 1.8, L2 - 0.2, 0.42), red, 0, 3.2, 0.1);
    mesh(T, g, new T.BoxGeometry(W + 0.012, 0.13, L2 - 0.3), cream, 0, 2.33, 0.1);
    [-1, 1].forEach(function (sd) {
      for (var w = 0; w < 6; w++) { mesh(T, g, rbox(T, 0.03, 0.62, 1.05, 0.08), glassM(T), sd * (W / 2 + 0.01), 3.3, -3.0 + w * 1.2); if (w < 5) mesh(T, g, rbox(T, 0.03, 0.66, 1.05, 0.08), glassM(T), sd * (W / 2 + 0.01), 1.7, -2.4 + w * 1.2); }
      [-2.75, 2.55].forEach(function (zz) { var arch = mesh(T, g, new T.TorusGeometry(0.58, 0.035, 6, 18, Math.PI), black, sd * (W / 2 + 0.004), 0.5, zz); arch.rotation.y = Math.PI / 2; wheel(T, g, sd * (W / 2 - 0.18), 0.5, zz, 0.5, 0.32, { lite: o.lite, rim: 0xc8102e }); });
      lamp(T, g, sd * 0.85, 0.75, -L2 / 2 - 0.02, 0.18, 0.18, 0xfff4cc); lamp(T, g, sd * 0.95, 0.9, L2 / 2 + 0.02, 0.1, 0.2, 0xd8261c, true);
    });
    // The side advert between the decks and the route board up front.
    var ad = textTex(T, 'rmad', 512, 64, function (gg, w, h) { gg.fillStyle = '#f6c58a'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#3a1a10'; gg.font = 'italic 700 40px Georgia, serif'; gg.textAlign = 'center'; gg.fillText('Visit Lagos', w / 2, 46); });
    [-1, 1].forEach(function (sd) { var ap = mesh(T, g, new T.PlaneGeometry(4.2, 0.5), new T.MeshStandardMaterial({ map: ad, roughness: 0.6 }), sd * (W / 2 + 0.02), 2.7, -0.6); ap.rotation.y = sd * Math.PI / 2; });
    var rb = textTex(T, 'rmroute', 256, 64, function (gg, w, h) { gg.fillStyle = '#111'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#fff'; gg.font = '800 34px system-ui'; gg.fillText('8', 14, 44); gg.font = '700 22px system-ui'; gg.fillText('VICTORIA', 54, 30); gg.font = '500 14px system-ui'; gg.fillText('via Oxford Circus', 54, 50); });
    var rbm = mesh(T, g, new T.PlaneGeometry(1.2, 0.3), new T.MeshBasicMaterial({ map: rb }), 0, 3.85, -L2 / 2 + 0.08); rbm.rotation.y = Math.PI;
    // Front: the cab window, the radiator grille, the upper-deck windscreen.
    mesh(T, g, rbox(T, 2.0, 0.7, 0.03, 0.12), glassM(T), 0, 3.25, -L2 / 2 + 0.08); mesh(T, g, rbox(T, 0.9, 0.8, 0.03, 0.08), glassM(T), -0.6, 1.75, -L2 / 2 - 0.01);
    mesh(T, g, rbox(T, 0.7, 0.55, 0.06, 0.06), black, 0.35, 0.95, -L2 / 2 - 0.03); for (var gl = 0; gl < 6; gl++) mesh(T, g, new T.BoxGeometry(0.62, 0.02, 0.02), mat(T, 'chrome', { color: 0xdfe3e8, roughness: 0.18, metalness: 0.95 }), 0.35, 0.75 + gl * 0.08, -L2 / 2 - 0.07);
    // The open platform at the back on the kerb side, with its pole.
    mesh(T, g, new T.BoxGeometry(1.0, 1.8, 1.1), mat(T, 'rminside', { color: 0x3a2a28, roughness: 0.9 }), -W / 2 + 0.49, 1.4, L2 / 2 - 0.52);
    tube(T, g, [-W / 2 + 0.05, 0.45, L2 / 2 - 0.05], [-W / 2 + 0.05, 2.3, L2 / 2 - 0.05], 0.025, mat(T, 'pole', { color: 0xe8d9a8, roughness: 0.3, metalness: 0.6 }));
    mesh(T, g, new T.BoxGeometry(W + 0.04, 0.1, L2), black, 0, 0.42, 0); plate(T, g, 0.5, 0.75, L2 / 2 + 0.04, 0, true);
    (o.seated || []).slice(0, 4).forEach(function (who, i) { seatFig(T, g, who, i % 2 ? 0.55 : -0.55, 2.07, -1.5 + Math.floor(i / 2) * 1.2, Math.PI, 'sit'); });
    if (o.rider) seatFig(T, g, o.rider, -0.6, 0.35, -L2 / 2 + 0.7, Math.PI, 'drive');
    return g;
  }
  function bus(T, o) {
    var g = new T.Group(), c = o.color != null ? o.color : 0x1f5fa0, len = o.len || 11, paint = bodyM(T, c, 0.4), black = mat(T, 'busblack', { color: 0x17181a, roughness: 0.6 });
    mesh(T, g, rbox(T, 2.5, 2.7, len, 0.18), paint, 0, 1.75, 0);
    [-1, 1].forEach(function (sd) { mesh(T, g, rbox(T, 0.03, 0.95, len * 0.86, 0.08), glassM(T), sd * 1.26, 2.25, 0.2); [-len / 2 + 2, len / 2 - 2.2].forEach(function (zz) { wheel(T, g, sd * 1.05, 0.5, zz, 0.5, 0.32, { lite: o.lite }); }); light(T, g, sd * 0.85, 0.95, -len / 2 - 0.02, 0.1, 0xfff4cc, 'disc'); light(T, g, sd * 0.9, 1.1, len / 2 + 0.02, 0.08, 0xd8261c, 'disc'); });
    mesh(T, g, new T.PlaneGeometry(2.2, 1.3), glassM(T), 0, 2.3, -len / 2 - 0.13).rotation.y = Math.PI;
    mesh(T, g, new T.BoxGeometry(2.52, 0.12, len), black, 0, 0.55, 0);
    if (o.london) { mesh(T, g, rbox(T, 2.5, 2.2, len, 0.18), paint, 0, 4.2, 0); [-1, 1].forEach(function (sd) { mesh(T, g, rbox(T, 0.03, 0.9, len * 0.9, 0.08), glassM(T), sd * 1.26, 4.35, 0); }); }
    return g;
  }

  // Merge every mesh under root (except the skipped subtrees) into one mesh per material: a detailed vehicle then costs
  // a handful of draw calls. Seated riders are merged too (they never move on their own).
  function merge(T, root0, skip) {
    var keep = new Set(skip || []), groups = {}, inv = new T.Matrix4(), m4 = new T.Matrix4(), nm = new T.Matrix3();
    root0.updateMatrixWorld(true); inv.copy(root0.matrixWorld).invert();
    (function walk(o) {
      if (o !== root0 && keep.has(o)) return;
      if (o.isMesh && !Array.isArray(o.material) && o.geometry && o.geometry.attributes.position && o.geometry.attributes.normal) {
        var sig = o.material.uuid + '|' + (o.geometry.attributes.uv ? 'uv' : '') + '|' + (o.castShadow ? 'c' : ''); (groups[sig] = groups[sig] || []).push(o);
      }
      o.children.slice().forEach(walk);
    })(root0);
    Object.keys(groups).forEach(function (k) {
      var list = groups[k]; if (list.length < 2) return;
      var n = 0, ni = 0, uv = !!list[0].geometry.attributes.uv;
      list.forEach(function (o) { var g = o.geometry; n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
      var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uvs = uv ? new Float32Array(n * 2) : null, idx = new (n > 65535 ? Uint32Array : Uint16Array)(ni), v = new T.Vector3(), off = 0, io = 0;
      list.forEach(function (o) {
        var g = o.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, c = P.count, i;
        m4.multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(m4);
        for (i = 0; i < c; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m4); pos[(off + i) * 3] = v.x; pos[(off + i) * 3 + 1] = v.y; pos[(off + i) * 3 + 2] = v.z; v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(off + i) * 3] = v.x; nor[(off + i) * 3 + 1] = v.y; nor[(off + i) * 3 + 2] = v.z; if (uvs && U) { uvs[(off + i) * 2] = U.getX(i); uvs[(off + i) * 2 + 1] = U.getY(i); } }
        if (g.index) for (i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + off; else for (i = 0; i < c; i++) idx[io++] = i + off;
        off += c; o.parent.remove(o); g.dispose();
      });
      var mg = new T.BufferGeometry(); mg.setAttribute('position', new T.BufferAttribute(pos, 3)); mg.setAttribute('normal', new T.BufferAttribute(nor, 3)); if (uvs) mg.setAttribute('uv', new T.BufferAttribute(uvs, 2)); mg.setIndex(new T.BufferAttribute(idx, 1)); mg.computeBoundingSphere();
      var mm = new T.Mesh(mg, list[0].material); mm.castShadow = list[0].castShadow; mm.receiveShadow = true; root0.add(mm);
    });
  }
  // A walking person from LasgidiAvatar3D, merged by material: the body in one go, each leg and arm on its own so they swing.
  function person(T, who, opts) {
    var A = root.LasgidiAvatar3D; if (!A) return null;
    var f = A.figure(T, (who && who.look) || { skin: 2, hair: 0, shape: 1 }, (who && who.outfit) || {}, (who && who.extra) || null), u = f.userData, limbs = [].concat(u.legs || [], u.arms || []);
    if (opts && opts.still) { merge(T, f); return f; } // far away: one piece, no swinging limbs
    merge(T, f, limbs); limbs.forEach(function (l) { merge(T, l); }); return f;
  }
  function vehicle(T, kind, opts) {
    var o = {}, g; Object.keys(opts || {}).forEach(function (k) { if (opts[k] !== undefined && opts[k] !== null) o[k] = opts[k]; }); // unset options keep each model's defaults
    if (kind === 'okada' || kind === 'bike') g = okada(T, o);
    else if (kind === 'keke') g = keke(T, o);
    else if (kind === 'suv' || kind === 'jeep') g = car(T, o, 'suv');
    else if (/^lux:/.test(kind)) g = car(T, o, kind.slice(4));
    else if (kind === 'cab' || kind === 'taxi') g = o.london ? car(T, Object.assign({ color: 0x111214 }, o), 'ldncab') : car(T, Object.assign({ color: 0xf2c200, stripe: 0x17181a, taxiSign: true }, o), 'car');
    else if (kind === 'danfo') g = o.london ? routemaster(T, o) : danfo(T, o);
    else if (kind === 'routemaster') g = routemaster(T, o);
    else if (kind === 'bus' || kind === 'brt' || kind === 'coach') g = o.london && kind !== 'coach' ? routemaster(T, o) : bus(T, o);
    else g = car(T, o, 'car');
    g.userData.wheels = []; g.traverse(function (x) { if (x.userData && x.userData.wheel) g.userData.wheels.push(x); });
    if (o.bake !== false) { if (o.roll === false) { merge(T, g); g.userData.wheels = []; } else { merge(T, g, g.userData.wheels); g.userData.wheels.forEach(function (w) { merge(T, w); }); } }
    g.userData.kind = kind; return g;
  }
  // Spin a vehicle's wheels by the distance it moved (metres).
  function roll(g, dist) { (g.userData.wheels || []).forEach(function (w) { w.rotation.x -= dist / 0.35; }); }

  // The Lagos–Ibadan standard-gauge train: a diesel locomotive and passenger coaches in white with Nigerian green.
  // Curved roofs, framed tinted windows, doors, roof air-conditioning, gangway bellows, bogies with steel wheels and
  // an under-floor skirt. The front faces -z and the train runs back along +z; userData.length is its full length.
  // opts: { coaches (default 3), lite }. Parts sharing a material are merged, so a whole train is a handful of draws.
  var TRAIN_MATS = null;
  function trainMats(T) {
    if (TRAIN_MATS) return TRAIN_MATS;
    var P = function (o) { return T.MeshPhysicalMaterial ? new T.MeshPhysicalMaterial(o) : new T.MeshStandardMaterial(o); };
    return (TRAIN_MATS = {
      white: P({ color: 0xf3f3ef, roughness: 0.28, metalness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
      green: P({ color: 0x0b7a3e, roughness: 0.32, metalness: 0.15, clearcoat: 0.6 }),
      dgreen: P({ color: 0x075a2d, roughness: 0.4, metalness: 0.1, clearcoat: 0.4 }),
      yellow: P({ color: 0xf2c200, roughness: 0.35, clearcoat: 0.5 }),
      glass: P({ color: 0x14202a, roughness: 0.05, metalness: 0.6, clearcoat: 1 }),
      frame: new T.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.5, metalness: 0.4 }),
      steel: new T.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.3, metalness: 0.85 }),
      under: new T.MeshStandardMaterial({ color: 0x23262a, roughness: 0.8, metalness: 0.3 }),
      rubber: new T.MeshStandardMaterial({ color: 0x0e0f11, roughness: 0.95 }),
      roof: new T.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.45, metalness: 0.5 }),
      lamp: new T.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff1b8, emissiveIntensity: 1.2 }),
      red: new T.MeshStandardMaterial({ color: 0xa31414, emissive: 0x5a0000, emissiveIntensity: 0.6 })
    });
  }
  function bodyShape(T, w, h, r) { // a flat floor and sides that curve into the roof
    var s = new T.Shape(), x = w / 2; s.moveTo(-x, 0); s.lineTo(x, 0); s.lineTo(x, h - r); s.quadraticCurveTo(x, h, x - r, h); s.lineTo(-x + r, h); s.quadraticCurveTo(-x, h, -x, h - r); s.lineTo(-x, 0); return s;
  }
  function trainBox(T, g, w, h, d, m, x, y, z) { return mesh(T, g, new T.BoxGeometry(w, h, d), m, x, y, z); }
  function bogie(T, g, z, M, lite, wheels) {
    trainBox(T, g, 2.3, 0.42, 2.9, M.under, 0, 0.62, z);
    [-1, 1].forEach(function (sx) { trainBox(T, g, 0.12, 0.3, 2.6, M.steel, sx * 1.12, 0.62, z); }); // side frames
    [-0.95, 0.95].forEach(function (dz) {
      var ax = new T.Group(); ax.position.set(0, 0.46, z + dz); g.add(ax); wheels.push(ax);
      [-0.72, 0.72].forEach(function (sx) { var w = mesh(T, ax, new T.CylinderGeometry(0.46, 0.46, 0.14, lite ? 12 : 22), M.steel, sx, 0, 0); w.rotation.z = Math.PI / 2; var hb = mesh(T, ax, new T.CylinderGeometry(0.16, 0.16, 0.16, 8), M.under, sx, 0, 0); hb.rotation.z = Math.PI / 2; });
      var axle = mesh(T, ax, new T.CylinderGeometry(0.07, 0.07, 1.5, 6), M.under, 0, 0, 0); axle.rotation.z = Math.PI / 2;
    });
  }
  function coach(T, g, z0, L, M, lite, wheels, last) {
    var c = new T.Group(); c.position.z = z0 + L / 2; g.add(c);
    var body = new T.Mesh(new T.ExtrudeGeometry(bodyShape(T, 3.1, 3.35, 0.7), { depth: L, bevelEnabled: false, curveSegments: lite ? 4 : 8 }), M.white); body.geometry.translate(0, 0, -L / 2); body.position.y = 1.1; body.castShadow = body.receiveShadow = true; c.add(body);
    trainBox(T, c, 3.14, 0.42, L, M.green, 0, 1.33, 0); // the green skirt
    trainBox(T, c, 3.14, 0.16, L, M.green, 0, 2.06, 0); // the green line under the windows
    trainBox(T, c, 3.14, 0.05, L, M.yellow, 0, 2.19, 0); // a thin yellow pinstripe
    var nW = lite ? 6 : 9, span = L - 6.4;
    [-1, 1].forEach(function (sx) {
      for (var i = 0; i < nW; i++) { var wz = -span / 2 + (i + 0.5) * span / nW; trainBox(T, c, 0.04, 0.98, span / nW - 0.32, M.frame, sx * 1.565, 2.85, wz); trainBox(T, c, 0.04, 0.86, span / nW - 0.46, M.glass, sx * 1.585, 2.85, wz); }
      [-1, 1].forEach(function (dz) { var dzz = dz * (L / 2 - 1.7); trainBox(T, c, 0.05, 2.25, 1.15, M.green, sx * 1.57, 2.4, dzz); trainBox(T, c, 0.05, 0.62, 0.62, M.glass, sx * 1.6, 2.95, dzz); trainBox(T, c, 0.05, 0.05, 1.15, M.steel, sx * 1.6, 1.3, dzz); });
    });
    trainBox(T, c, 2.6, 0.5, L - 6, M.under, 0, 0.92, 0); // under-floor equipment
    if (!lite) for (var e = 0; e < 3; e++) trainBox(T, c, 2.1, 0.45, 1.6, M.frame, 0, 0.78, -L / 2 + 6 + e * (L - 12) / 2);
    [-L / 4, L / 4].forEach(function (az) { var ac = new T.Mesh(rbox(T, 2.0, 0.34, 3.2, 0.12), M.roof); ac.position.set(0, 4.55, az); ac.castShadow = true; c.add(ac); }); // roof air-conditioning
    trainBox(T, c, 0.9, 0.05, L - 0.4, M.roof, 0, 4.47, 0); // the roof walkway strip
    bogie(T, c, -L / 2 + 3.2, M, lite, wheels); bogie(T, c, L / 2 - 3.2, M, lite, wheels);
    if (!last) trainBox(T, c, 2.3, 2.7, 0.9, M.rubber, 0, 2.55, L / 2 + 0.45); // the gangway bellows to the next coach
    else { // the tail end: a green end panel, the end door with its window, tail lights and a buffer beam
      trainBox(T, c, 3.0, 1.0, 0.06, M.green, 0, 1.6, L / 2 + 0.03); trainBox(T, c, 0.95, 2.2, 0.06, M.dgreen, 0, 2.4, L / 2 + 0.05); trainBox(T, c, 0.6, 0.7, 0.07, M.glass, 0, 3.05, L / 2 + 0.06);
      [-1, 1].forEach(function (sx) { trainBox(T, c, 0.62, 0.62, 0.06, M.glass, sx * 1.05, 3.0, L / 2 + 0.05); trainBox(T, c, 0.3, 0.2, 0.08, M.red, sx * 1.0, 1.55, L / 2 + 0.07); });
      trainBox(T, c, 2.9, 0.25, 0.4, M.under, 0, 0.8, L / 2 + 0.15);
    }
    return c;
  }
  function locomotive(T, g, L, M, lite, wheels) {
    var c = new T.Group(); c.position.z = L / 2; g.add(c);
    // The long hood behind the cab, green with a white band, side grilles along it.
    var hood = new T.Mesh(rbox(T, 2.9, 2.8, L - 5.4, 0.35), M.green); hood.position.set(0, 2.55, 2.4); hood.castShadow = true; c.add(hood);
    trainBox(T, c, 2.94, 0.5, L - 5.4, M.white, 0, 2.9, 2.4);
    if (!lite) for (var gi = 0; gi < 8; gi++) [-1, 1].forEach(function (sx) { trainBox(T, c, 0.04, 0.9, 1.1, M.frame, sx * 1.47, 2.2, -L / 2 + 6.5 + gi * 1.55); });
    // The cab at the front: taller, with a raked windscreen and side windows.
    var cab = new T.Mesh(new T.ExtrudeGeometry(bodyShape(T, 3.1, 3.6, 0.45), { depth: 4.2, bevelEnabled: false, curveSegments: 6 }), M.white); cab.geometry.translate(0, 0, -2.1); cab.position.set(0, 1.1, -L / 2 + 2.9); cab.castShadow = true; c.add(cab);
    trainBox(T, c, 3.14, 0.9, 4.2, M.green, 0, 1.55, -L / 2 + 2.9);
    var nose = trainBox(T, c, 3.0, 1.7, 1.2, M.yellow, 0, 1.95, -L / 2 + 0.5); // the yellow warning nose
    var ws = trainBox(T, c, 2.7, 1.15, 0.08, M.glass, 0, 3.6, -L / 2 + 0.88); ws.rotation.x = -0.35; // raked windscreen
    trainBox(T, c, 0.06, 1.25, 0.12, M.frame, 0, 3.6, -L / 2 + 0.86);
    [-1, 1].forEach(function (sx) { trainBox(T, c, 0.05, 0.9, 1.6, M.glass, sx * 1.575, 3.5, -L / 2 + 2.4); trainBox(T, c, 0.05, 2.1, 0.8, M.dgreen, sx * 1.575, 2.3, -L / 2 + 3.9); }); // side windows, cab doors
    [-0.95, 0.95].forEach(function (sx) { var hl = mesh(T, c, new T.CylinderGeometry(0.17, 0.17, 0.08, 14), M.lamp, sx, 1.75, -L / 2 - 0.12); hl.rotation.x = Math.PI / 2; });
    var top = mesh(T, c, new T.CylinderGeometry(0.2, 0.2, 0.08, 14), M.lamp, 0, 4.25, -L / 2 + 0.95); top.rotation.x = Math.PI / 2 - 0.35;
    trainBox(T, c, 0.9, 0.24, 0.05, M.white, 0, 2.55, -L / 2 - 0.12); // the number plate
    [-0.25, 0.25].forEach(function (hx) { var h = mesh(T, c, new T.CylinderGeometry(0.06, 0.09, 0.45, 8), M.steel, hx, 4.85, -L / 2 + 3.2); h.rotation.x = Math.PI / 2; }); // air horns
    trainBox(T, c, 2.9, 0.25, 0.5, M.under, 0, 0.75, -L / 2 - 0.1); // buffer beam
    trainBox(T, c, 2.6, 0.55, L - 3, M.under, 0, 0.95, 0);
    trainBox(T, c, 2.3, 0.9, 4, M.frame, 0, 0.75, 0); // the fuel tank between the bogies
    bogie(T, c, -L / 2 + 3.4, M, lite, wheels); bogie(T, c, L / 2 - 3.4, M, lite, wheels);
    return c;
  }
  function train(T, opts) {
    opts = opts || {}; var M = trainMats(T), g = new T.Group(), wheels = [], lite = !!opts.lite, n = opts.coaches == null ? 3 : opts.coaches, LL = 20, CL = 24, GAP = 0.9;
    locomotive(T, g, LL, M, lite, wheels);
    for (var i = 0; i < n; i++) coach(T, g, LL + GAP + i * (CL + GAP), CL, M, lite, wheels, i === n - 1);
    var keep = wheels.slice(); merge(T, g, keep);
    g.userData.wheels = wheels; g.userData.length = LL + n * (CL + GAP);
    return g;
  }
  root.LasgidiModels3D = { vehicle: vehicle, forVehicle: forVehicle, person: person, roll: roll, merge: merge, rbox: rbox, tube: tube, wheel: wheel, train: train };
})(typeof window !== 'undefined' ? window : globalThis);
