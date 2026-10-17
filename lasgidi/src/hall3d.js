/* Lasgidi: the white-wedding hall in real 3D (three.js). mount(canvas) swaps the planner's hall preview (or your
   booked wedding's hall) for a live, orbitable hall built from the same plan (data-wwplan): the theme's two
   colours, the decor level (simple: chair covers and table flowers; elegant: ceiling drapes, fairy lights and a
   flower-wall stage; grand: crystal chandeliers, a mirrored aisle and a raised stage) and the extras (floral arch,
   cold sparks, photo booth, drone, live band, fireworks). The couple sit on the stage (one of them looks like
   you), guests sit at round tables, and a few dance on the floor and spray naira. One renderer is kept and
   reused across the app's re-renders; the scene is only rebuilt when the plan changes. Returns false without
   three.js or WebGL, so the 2D drawing is used. */
(function (root) {
  'use strict';
  var D = root.LASGIDI_DATA || {};
  var R = null; // { renderer, gl, box, scene, cam, key, raf, ... } shared across mounts
  function lite() { return document.documentElement.classList.contains('lite'); }
  function mount(cv, me) {
    var T = root.THREE, W = D.WHITE_WEDDING; if (!T || !cv || !W) return false;
    var p; try { p = JSON.parse(cv.getAttribute('data-wwplan')); } catch (e) { return false; }
    if (!R) {
      var renderer; try { renderer = root.LasgidiGL ? root.LasgidiGL.make({ maxRatio: 1.75 }) : new T.WebGLRenderer({ antialias: !lite() }); } catch (e) { return false; } if (!renderer) return false;
      if (!root.LasgidiGL) renderer.setPixelRatio(Math.min(lite() ? 1 : 1.75, root.devicePixelRatio || 1)); renderer.toneMapping = T.ACESFilmicToneMapping; renderer.outputColorSpace = T.SRGBColorSpace; renderer.shadowMap.enabled = !lite();
      var box = document.createElement('div'); box.className = 'ww-hall ww-hall-3d'; box.appendChild(renderer.domElement); renderer.domElement.setAttribute('aria-hidden', 'true');
      R = { renderer: renderer, box: box, key: '', raf: 0, yaw: 0.25, pitch: 0.3, dist: 15.5, drag: null, t0: performance.now() };
      box.addEventListener('pointerdown', function (e) { R.drag = { x: e.clientX, y: e.clientY, yaw: R.yaw, pitch: R.pitch }; box.setPointerCapture && box.setPointerCapture(e.pointerId); });
      box.addEventListener('pointermove', function (e) { if (!R.drag) return; R.yaw = R.drag.yaw - (e.clientX - R.drag.x) * 0.006; R.pitch = Math.max(0.12, Math.min(1.1, R.drag.pitch + (e.clientY - R.drag.y) * 0.004)); });
      ['pointerup', 'pointercancel'].forEach(function (ev) { box.addEventListener(ev, function () { R.drag = null; }); });
      box.addEventListener('wheel', function (e) { e.preventDefault(); R.dist = Math.max(9, Math.min(26, R.dist + e.deltaY * 0.01)); }, { passive: false });
    }
    R.box.setAttribute('role', 'img'); R.box.setAttribute('aria-label', cv.getAttribute('aria-label') || 'Your decorated hall'); if (cv.id) R.box.id = cv.id;
    R.box.setAttribute('data-wwplan', cv.getAttribute('data-wwplan'));
    cv.parentNode.replaceChild(R.box, cv);
    var key = JSON.stringify([p, me && me.look, me && me.outfit]);
    if (key !== R.key) { R.key = key; build(T, W, p, me); }
    if (!R.raf) R.raf = root.requestAnimationFrame(frame);
    return true;
  }
  function frame() {
    R.raf = 0; if (!R.box.isConnected) return; // the page moved on; mount() restarts it
    if (root.LasgidiGL && !root.LasgidiGL.live(R.box)) { R.raf = root.requestAnimationFrame(frame); return; }
    if (root.LasgidiGL) root.LasgidiGL.pace(R.renderer);
    var T = root.THREE, w = R.box.clientWidth || 640, h = R.box.clientHeight || 300, t = (performance.now() - R.t0) / 1000;
    if (w !== R.w || h !== R.h) { R.w = w; R.h = h; R.renderer.setSize(w, h, false); R.renderer.domElement.style.width = w + 'px'; R.renderer.domElement.style.height = h + 'px'; R.cam.aspect = w / h; R.cam.updateProjectionMatrix(); }
    var reduce = lite() || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches), yaw = R.yaw + (R.drag || reduce ? 0 : Math.sin(t * 0.12) * 0.25);
    R.cam.position.set(Math.sin(yaw) * R.dist * Math.cos(R.pitch), 1.2 + Math.sin(R.pitch) * R.dist, Math.cos(yaw) * R.dist * Math.cos(R.pitch)); R.cam.lookAt(0, 1.6, -2);
    if (R.tick) R.tick(reduce ? 0 : t, T);
    R.renderer.render(R.scene, R.cam);
    R.raf = root.requestAnimationFrame(frame);
  }
  function build(T, W, p, me) {
    var th = W.themes[p.theme] || W.themes.gold_white, lvl = { simple: 0, elegant: 1, grand: 2 }[p.decor] || 0, ex = p.extras || [];
    var A = new T.Color(th.a), B = new T.Color(th.b);
    if (R.scene) R.scene.traverse(function (x) { if (x.geometry) x.geometry.dispose(); if (x.material) [].concat(x.material).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); }); });
    var S = R.scene = new T.Scene(); S.background = new T.Color(0x1c1622); S.fog = new T.Fog(0x1c1622, 26, 48);
    R.cam = new T.PerspectiveCamera(45, (R.w || 640) / (R.h || 300), 0.1, 200);
    function M(c, r, m, x) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: r == null ? 0.7 : r, metalness: m || 0 }, x || {})); }
    function box(par, w, h, d, m, x, y, z) { var b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x || 0, y || 0, z || 0); b.castShadow = b.receiveShadow = true; par.add(b); return b; }
    function cyl(par, rt, rb, h, m, x, y, z, seg) { var c = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 20), m); c.position.set(x || 0, y || 0, z || 0); c.castShadow = c.receiveShadow = true; par.add(c); return c; }
    function ball(par, r, m, x, y, z) { var s = new T.Mesh(new T.SphereGeometry(r, 12, 8), m); s.position.set(x, y, z); par.add(s); return s; }
    var G = root.LasgidiGames3D, AV = root.LasgidiAvatar3D;
    function person(d, k, i) { var s = d || (G ? G.stranger(k, i) : null); if (AV && s) { var f = AV.figure(T, s.look, s.outfit, s.extra || null); f.traverse(function (x) { x.castShadow = true; }); return f; } var g = new T.Group(); cyl(g, 0.22, 0.28, 1.1, M([0xc0392b, 0x2f6fa0, 0xf2b600][i % 3]), 0, 0.85, 0); ball(g, 0.18, M(0x8a5a3c), 0, 1.6, 0); return g; }
    S.add(new T.HemisphereLight(0xfff0dc, 0x3a2a30, lvl ? 0.55 : 0.8));
    var key = new T.DirectionalLight(0xfff2dc, 0.9); key.position.set(6, 14, 10); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); var sc = key.shadow.camera; sc.left = sc.bottom = -14; sc.right = sc.top = 14; S.add(key);
    // The room: floor (a mirrored aisle at grand), walls, and the stage at the back.
    var floor = new T.Mesh(new T.PlaneGeometry(26, 22).rotateX(-Math.PI / 2), M(0xd9cbb8, 0.5, 0.05)); floor.position.z = -1; floor.receiveShadow = true; S.add(floor);
    var aisle = new T.Mesh(new T.PlaneGeometry(2.2, 14).rotateX(-Math.PI / 2), lvl >= 2 ? M(0xdfe6ee, 0.12, 0.35) : M(0xf4f3ec, 0.8)); aisle.position.set(0, 0.01, 2); aisle.receiveShadow = true; S.add(aisle);
    var wallM = M(0x3a2c40, 0.9); box(S, 26, 8, 0.3, wallM, 0, 4, -12); box(S, 0.3, 8, 22, wallM, -13, 4, -1); box(S, 0.3, 8, 22, wallM, 13, 4, -1);
    var stageH = lvl >= 2 ? 0.8 : 0.45; box(S, 11, stageH, 4, M(0xefe6d8, 0.6), 0, stageH / 2, -9.6);
    // Flower-wall backdrop in the theme colours (elegant and grand), or a ribbon backdrop (simple).
    var fw = new T.Group(); fw.position.set(0, stageH, -11.6); S.add(fw);
    var am = M(th.a, 0.6), bm = M(th.b, 0.6), wm = M(0xffffff, 0.6);
    if (lvl) { for (var r = 0; r < 9; r++) for (var c = 0; c < 22; c++) { var f = ball(fw, lvl >= 2 ? 0.28 : 0.24, (r + c) % 3 === 0 ? bm : (r + c) % 3 === 1 ? am : wm, -5 + c * 0.48, 0.4 + r * 0.46, (r + c) % 2 * 0.08); f.castShadow = false; } }
    else { for (var rb = 0; rb < 9; rb++) box(fw, 0.5, 4, 0.05, rb % 2 ? am : bm, -4 + rb, 2, 0); }
    // The couple's chairs and the couple (one of them is you).
    [-0.8, 0.8].forEach(function (x, i) { var ch = new T.Group(); ch.position.set(x, stageH, -9.4); S.add(ch); box(ch, 0.9, 0.12, 0.8, M(0xffffff, 0.5), 0, 0.55, 0); box(ch, 0.9, 1.4, 0.12, M(0xffffff, 0.5), 0, 1.2, -0.4); box(ch, 0.92, 0.12, 0.14, am, 0, 1.9, -0.4); });
    var you = person(me && me.look ? { look: me.look, outfit: me.outfit || {} } : null, 'groom', 1), spouse = person({ look: { skin: 2, hair: 2, shape: 1 }, outfit: { dress: firstOf('dress', /gown|white|lace/i) } }, 'bride', 0);
    you.position.set(-0.8, stageH, -9.1); spouse.position.set(0.8, stageH, -9.1); S.add(you); S.add(spouse);
    // Round tables with white cloths, a theme-colour runner, chairs, centrepieces and seated guests.
    var guests = [], tables = [];
    for (var tb = 0; tb < 10; tb++) {
      var side = tb % 2 ? 1 : -1, row = Math.floor(tb / 2), tx = side * (4 + (row % 2) * 2.6), tz = -5.5 + row * 3.1, tg = new T.Group(); tg.position.set(tx, 0, tz); S.add(tg); tables.push(tg);
      cyl(tg, 1.05, 1.05, 0.06, M(0xffffff, 0.6), 0, 0.78, 0, 28); cyl(tg, 1.07, 1.12, 0.74, M(0xffffff, 0.8), 0, 0.4, 0, 28); cyl(tg, 1.09, 1.09, 0.18, am, 0, 0.66, 0, 28);
      var cp = lvl ? 1.3 : 0.25; cyl(tg, 0.04, 0.06, cp, M(0xd4d4d4, 0.2, 0.8), 0, 0.8 + cp / 2, 0, 8); var bloom = ball(tg, lvl ? 0.35 : 0.22, am, 0, 0.85 + cp, 0); bloom.castShadow = false; for (var bl = 0; bl < 5; bl++) ball(tg, lvl ? 0.14 : 0.1, bm, Math.cos(bl * 1.26) * (lvl ? 0.3 : 0.2), 0.8 + cp + 0.1, Math.sin(bl * 1.26) * (lvl ? 0.3 : 0.2)).castShadow = false;
      for (var s = 0; s < 6; s++) { var a = s / 6 * Math.PI * 2, chx = Math.cos(a) * 1.5, chz = Math.sin(a) * 1.5, chair = new T.Group(); chair.position.set(chx, 0, chz); chair.rotation.y = -a - Math.PI / 2; tg.add(chair); box(chair, 0.5, 0.5, 0.5, M(0xffffff, 0.6), 0, 0.25, 0); box(chair, 0.5, 0.7, 0.08, M(0xffffff, 0.6), 0, 0.85, 0.22); box(chair, 0.52, 0.12, 0.1, am, 0, 0.75, 0.24);
        if ((tb + s) % 3 !== 0) { var gs = person(null, 'wedding', tb * 6 + s); gs.scale.setScalar(0.92); gs.position.set(chx * 0.93, -0.36, chz * 0.93); gs.rotation.y = -a - Math.PI / 2 + Math.PI; tg.add(gs); if (gs.userData.legs) gs.userData.legs.forEach(function (l) { l.rotation.x = -1.5; }); guests.push(gs); } }
    }
    // Dancers on the floor in front of the stage, spraying naira over the couple.
    var dancers = []; for (var d = 0; d < 6; d++) { var dp = person(null, 'owambe', d), a2 = d / 6 * Math.PI * 2; dp.position.set(Math.cos(a2) * 1.8, 0, -6.2 + Math.sin(a2) * 0.9); dp.rotation.y = Math.atan2(-dp.position.x, -9 - dp.position.z); S.add(dp); dancers.push(dp); }
    var cashT = (function () { var c = document.createElement('canvas'); c.width = 128; c.height = 64; var g = c.getContext('2d'); g.fillStyle = '#7fbf6a'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#1b5e20'; g.lineWidth = 4; g.strokeRect(4, 4, 120, 56); g.fillStyle = '#1b5e20'; g.font = '900 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₦500', 64, 33); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; })();
    var cashM = new T.MeshStandardMaterial({ map: cashT, side: T.DoubleSide }), cash = [];
    for (var n = 0; n < 40; n++) { var cn = new T.Mesh(new T.PlaneGeometry(0.42, 0.21), cashM); S.add(cn); cash.push({ m: cn, k: n / 40, x: (n * 0.618 % 1 - 0.5) * 4, z: -6.8 + (n * 0.37 % 1) * 1.6, sp: 0.6 + (n % 5) * 0.12 }); }
    // Drapes and fairy lights (elegant up), chandeliers (grand), uplights in the theme colour.
    var lights = [];
    if (lvl >= 1) {
      for (var dr = 0; dr < 9; dr++) { var drape = new T.Mesh(new T.CylinderGeometry(1.25, 1.25, 26, 16, 1, true, Math.PI, Math.PI), M(0xffffff, 0.9, 0, { side: T.DoubleSide, transparent: true, opacity: 0.8 })); drape.rotation.z = Math.PI / 2; drape.position.set(0, 8.2, -11 + dr * 2.6); drape.scale.set(1, 0.55, 1); S.add(drape); }
      var fairy = new T.MeshBasicMaterial({ color: 0xffe9aa }); for (var fl = 0; fl < (lite() ? 80 : 180); fl++) { var b2 = ball(S, 0.05, fairy, (fl * 0.618 % 1 - 0.5) * 24, 6.3 + (fl * 0.37 % 1) * 1.2, -11.5 + (fl * 0.271 % 1) * 21); lights.push(b2); }
    }
    if (lvl >= 2) [-5, 0, 5].forEach(function (cx) { var ch = new T.Group(); ch.position.set(cx, 5.6, -3); S.add(ch); cyl(ch, 0.02, 0.02, 1.8, M(0xc9b88a, 0.3, 0.8), 0, 1, 0, 6); var crys = M(0xeef6ff, 0.05, 0.3, { emissive: 0xfff2d0, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }); for (var ring = 0; ring < 3; ring++) for (var k = 0; k < 12 - ring * 3; k++) { var aa = k / (12 - ring * 3) * Math.PI * 2, rr = 0.9 - ring * 0.25, cr = new T.Mesh(new T.OctahedronGeometry(0.09), crys); cr.position.set(Math.cos(aa) * rr, -ring * 0.3, Math.sin(aa) * rr); ch.add(cr); } var pl = new T.PointLight(0xfff0d0, 10, 12, 1.5); pl.position.y = -0.3; ch.add(pl); });
    [-12.5, 12.5].forEach(function (x) { for (var u = 0; u < 4; u++) { var up = new T.SpotLight(A.getHex(), 14, 10, 0.5, 0.6, 1); up.position.set(x * 0.98, 0.3, -10 + u * 5); up.target.position.set(x, 6, -10 + u * 5); S.add(up); S.add(up.target); } });
    var stageSpot = new T.SpotLight(0xfff4e0, 40, 20, 0.4, 0.5, 1.2); stageSpot.position.set(0, 8, -4); stageSpot.target.position.set(0, stageH, -9.3); stageSpot.castShadow = true; S.add(stageSpot); S.add(stageSpot.target);
    // Extras.
    if (ex.indexOf('arch') >= 0) { var arch = new T.Group(); arch.position.set(0, 0, 5.5); S.add(arch); for (var ai = 0; ai <= 24; ai++) { var an = Math.PI * ai / 24; ball(arch, 0.32, ai % 3 ? am : ai % 2 ? bm : wm, Math.cos(an) * 2.2, Math.sin(an) * 3.2, 0); } }
    var sparks = [];
    if (ex.indexOf('sparks') >= 0) [-3.2, 3.2].forEach(function (sx) { cyl(S, 0.25, 0.3, 0.3, M(0x222222, 0.4, 0.6), sx, 0.15, -7.6); for (var k = 0; k < 40; k++) { var sp = new T.Mesh(new T.SphereGeometry(0.035, 5, 4), new T.MeshBasicMaterial({ color: 0xffe6a0 })); S.add(sp); sparks.push({ m: sp, x: sx, k: k / 40, a: k * 2.4 }); } });
    if (ex.indexOf('band') >= 0) { var bandG = new T.Group(); bandG.position.set(-8.5, 0, -9.5); S.add(bandG); box(bandG, 4, 0.4, 2.4, M(0x5a3f2b, 0.7), 0, 0.2, 0); for (var m2 = 0; m2 < 3; m2++) { var mu = person(null, 'band', m2); mu.position.set(-1.2 + m2 * 1.2, 0.4, 0); mu.rotation.y = 0.5; bandG.add(mu); dancers.push(mu); } cyl(bandG, 0.3, 0.3, 0.5, M(0x8a5a2b, 0.6), 1.6, 0.65, 0.6); }
    if (ex.indexOf('booth') >= 0) { var bth = new T.Group(); bth.position.set(9, 0, 6); S.add(bth); box(bth, 2.4, 2.6, 0.1, am, 0, 1.3, -0.6); cyl(bth, 0.03, 0.03, 1.4, M(0x222222), 0, 0.7, 1.4, 6); box(bth, 0.4, 0.3, 0.3, M(0x17181a, 0.3, 0.5), 0, 1.5, 1.4); }
    var drone = null; if (ex.indexOf('drone') >= 0) { drone = new T.Group(); box(drone, 0.5, 0.12, 0.5, M(0x222222, 0.4, 0.6), 0, 0, 0); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { cyl(drone, 0.16, 0.16, 0.02, M(0x999999), q[0] * 0.35, 0.08, q[1] * 0.35, 10); }); var led = ball(drone, 0.05, new T.MeshBasicMaterial({ color: 0xff3030 }), 0, -0.08, 0.2); S.add(drone); }
    var pyro = []; if (ex.indexOf('fireworks') >= 0) for (var fw2 = 0; fw2 < 60; fw2++) { var pm = new T.Mesh(new T.SphereGeometry(0.06, 5, 4), new T.MeshBasicMaterial({ color: [0xffd34d, 0xff5a8a, 0x7ad0ff, th.a === '#ffffff' ? 0xffffff : A.getHex()][fw2 % 4], transparent: true })); S.add(pm); pyro.push({ m: pm, a: fw2 * 2.399, e: (fw2 * 0.618) % 1, burst: fw2 % 3 }); }
    function firstOf(slot, re) { var C = D.CLOTHES || {}, ids = Object.keys(C).filter(function (k) { return C[k].slot === slot; }); return ids.filter(function (k) { return re.test(k + ' ' + (C[k].name || '')); })[0] || ids[0]; }
    function swing(pp, t, amt, up) { var u = pp.userData, a = Math.sin(t) * amt; if (u.legs && !up) u.legs.forEach(function (l, i) { l.rotation.x = i ? -a : a; }); if (u.arms) u.arms.forEach(function (l, i) { l.rotation.x = up ? -1.7 - Math.sin(t + i * Math.PI) * 0.6 : (i ? a : -a); }); }
    R.tick = function (t) {
      dancers.forEach(function (dp, i) { swing(dp, t * 6 + i, 0.4, i % 2 === 0); dp.position.y = (dp.parent === S ? 0 : 0.4) + Math.abs(Math.sin(t * 6 + i)) * 0.06; });
      swing(you, t * 1.5, 0.04, false); swing(spouse, t * 1.5 + 1, 0.04, false);
      guests.forEach(function (gs, i) { if (gs.userData.arms) gs.userData.arms.forEach(function (l, k) { l.rotation.x = -0.6 + Math.sin(t * 2 + i + k) * 0.15; }); });
      cash.forEach(function (c) { var k = (c.k + t * 0.12 * c.sp) % 1; c.m.position.set(c.x + Math.sin(t * 2 + c.k * 9) * 0.3, 4.2 - k * 4.1, c.z); c.m.rotation.set(t * 3 * c.sp + c.k * 6, t * 2 + c.k * 4, 0); });
      lights.forEach(function (b, i) { b.visible = (Math.floor(t * 2 + i * 0.37) % 7) !== 0; });
      sparks.forEach(function (s) { var k = (s.k + t * 0.9) % 1; s.m.position.set(s.x + Math.cos(s.a) * k * 0.5, 0.3 + k * 3.2 - k * k * 1.2, -7.6 + Math.sin(s.a) * k * 0.5); s.m.scale.setScalar(1 - k * 0.7); });
      if (drone) drone.position.set(Math.sin(t * 0.4) * 6, 5 + Math.sin(t * 1.3) * 0.3, -2 + Math.cos(t * 0.4) * 5);
      pyro.forEach(function (p) { var cyc = (t * 0.35 + p.burst / 3) % 1, k = Math.max(0, (cyc - 0.2) / 0.8); p.m.visible = cyc > 0.2; p.m.position.set((p.burst - 1) * 6 + Math.cos(p.a) * k * 2.5 * (0.5 + p.e), 7.2 + Math.sin(p.a) * k * 2.5 * (0.5 + p.e) - k * k, 6); p.m.material.opacity = 1 - k; });
    };
  }
  root.LasgidiHall3D = { mount: mount };
})(typeof window !== 'undefined' ? window : this);
