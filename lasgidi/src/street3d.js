// Step outside: walk (or run) from your gate down a Lagos residential close to the main road, in 3D.
// The close has houses behind walls and metal gates (No. 1, No. 2 ...), gutters with plank bridges, red laterite,
// parked cars, electric poles and neighbours walking; it opens onto a main road with a petrol station, danfos,
// shops and busy pavements. Only for looking around: it never changes your life.
(function (root) {
  'use strict';
  function create(opts) {
    var T = root.THREE; if (!T) return null;
    opts = opts || {};
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var lite = !!opts.lite;
    var el = document.createElement('div'); el.className = 'st3-view';
    var renderer; try { renderer = root.LasgidiGL ? root.LasgidiGL.make({}) : new T.WebGLRenderer({ antialias: !lite }); } catch (e) { return null; }
    if (!renderer) return null;
    var cv = renderer.domElement; cv.className = 'st3-cv'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Your street in 3D. Drag the joystick, use the arrow keys, or tap the ground to walk.'); el.appendChild(cv);
    renderer.setPixelRatio(Math.min(lite ? 1 : 2, root.devicePixelRatio || 1)); renderer.shadowMap.enabled = !lite;
    var S3 = new T.Scene(), sky = 0x9fd3ef; S3.background = new T.Color(sky); S3.fog = new T.Fog(sky, 60, 220);
    var cam = new T.PerspectiveCamera(58, 1, 0.1, 500);
    var hemi = new T.HemisphereLight(0xffffff, 0x8a6a50, 0.85); S3.add(hemi);
    var sun = new T.DirectionalLight(0xfff1dc, 1.5); sun.position.set(30, 60, 20); sun.castShadow = !lite; sun.shadow.mapSize.set(1024, 1024); var sc = sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.far = 160; S3.add(sun); S3.add(sun.target);
    var MATS = {}; function mat(k, o) { return MATS[k] || (MATS[k] = new T.MeshStandardMaterial(Object.assign({ roughness: 0.85 }, o))); }
    function mesh(g, m, x, y, z, parent) { var o = new T.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = !lite; o.receiveShadow = true; (parent || S3).add(o); return o; }
    function box(w, h, d, m, x, y, z, parent) { return mesh(new T.BoxGeometry(w, h, d), m, x, y, z, parent); }
    function label(text, bg, fg, w, h) { var c = document.createElement('canvas'); c.width = 512; c.height = 128; var g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 512, 128); g.fillStyle = fg; g.font = '800 54px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66); var t = new T.CanvasTexture(c); return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t })); }
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

    /* ---------- the close ---------- */
    var LEN = 132, ROADW = 7, MAINZ = -LEN - 10;
    box(80, 0.1, LEN + 40, mat('laterite', { color: 0xa0502e }), 0, -0.06, -LEN / 2 + 10);
    box(ROADW, 0.06, LEN, mat('asphalt', { color: 0x3d3f44, roughness: 0.95 }), 0, 0.02, -LEN / 2);
    for (var p = 0; p < 14; p++) box(2 + rnd() * 4, 0.04, 3 + rnd() * 5, mat('redsoil', { color: 0xb5452d }), (rnd() - 0.5) * ROADW, 0.06, -6 - rnd() * (LEN - 12));
    [-1, 1].forEach(function (s) {
      box(1.8, 0.14, LEN, mat('kerb', { color: 0xbdb8ad }), s * (ROADW / 2 + 1.5), 0.07, -LEN / 2); // pavement
      box(0.7, 0.05, LEN, mat('gutter', { color: 0x2b2b26 }), s * (ROADW / 2 + 0.35), 0.0, -LEN / 2); // open gutter
    });
    var gateCols = [0x1f3f8a, 0x14532d, 0x17181a, 0x7a1d1d], wallCols = [0xd9d2c3, 0xc8d4cf, 0xe6d8b8, 0xcfc6bb, 0xb9c4cc];
    var houseN = 1;
    for (var z = -8; z > -LEN + 6; z -= 13) {
      [-1, 1].forEach(function (s) {
        var x = s * (ROADW / 2 + 2.7), n = houseN++;
        var wall = mat('wall' + (n % 5), { color: wallCols[n % 5] });
        box(0.35, 2.3, 12.4, wall, x, 1.15, z); // fence wall
        var gate = box(0.2, 2.1, 3.2, mat('gate' + (n % 4), { color: gateCols[n % 4], metalness: 0.4, roughness: 0.5 }), x - s * 0.05, 1.05, z + 2.5);
        var plate = label('No. ' + n, '#1f3f8a', '#ffffff', 1.2, 0.3); plate.position.set(x - s * 0.2, 1.9, z - 1.2); plate.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; S3.add(plate);
        // a plank bridge over the gutter at the gate
        var pl = box(1.2, 0.12, 3, mat('plank', { color: 0x8a6a3a }), s * (ROADW / 2 + 0.4), 0.1, z + 2.5);
        box(1.25, 0.02, 0.25, mat('stripeY', { color: 0xf2c200 }), s * (ROADW / 2 + 0.4), 0.17, z + 1.6); box(1.25, 0.02, 0.25, mat('stripeK', { color: 0x111111 }), s * (ROADW / 2 + 0.4), 0.17, z + 2.2);
        // the house behind the wall
        var hh = 4 + (n % 3) * 3, hx = x + s * 6;
        box(9, hh, 10, mat('house' + (n % 5), { color: wallCols[(n + 2) % 5] }), hx, hh / 2, z);
        for (var wy = 1.8; wy < hh - 0.5; wy += 3) [-2.5, 0, 2.5].forEach(function (dz) { box(0.12, 1.2, 1.3, mat('win', { color: 0x2c4a5c, metalness: 0.6, roughness: 0.2 }), hx - s * 4.55, wy, z + dz); });
        box(9.6, 0.4, 10.6, mat('roof' + (n % 3), { color: [0x7a2f22, 0x3b4250, 0x5b4636][n % 3] }), hx, hh + 0.2, z);
        if (n % 3 === 0) { var tank = mesh(new T.CylinderGeometry(0.9, 0.9, 1.6, 12), mat('tank', { color: 0x1f2f6b }), hx, hh + 1.2, z + 2); }
      });
      // electric pole with wires
      var px = (z / 13) % 2 ? -(ROADW / 2 + 2.1) : ROADW / 2 + 2.1;
      mesh(new T.CylinderGeometry(0.12, 0.16, 8, 8), mat('pole', { color: 0x4a4a46 }), px, 4, z - 6);
      box(1.6, 0.12, 0.12, mat('pole', {}), px, 7.6, z - 6);
    }
    // wires along the close
    [-0.6, 0.6].forEach(function (o) { var w = new T.Mesh(new T.BoxGeometry(0.03, 0.03, LEN), new T.MeshBasicMaterial({ color: 0x222222 })); w.position.set(ROADW / 2 + 2.1 + o, 7.5, -LEN / 2); S3.add(w); });
    // parked cars
    function car(color, x, z, rot) { var g = new T.Group(); box(1.9, 0.8, 4.2, mat('car' + color, { color: color, metalness: 0.5, roughness: 0.35 }), 0, 0.75, 0, g); box(1.7, 0.6, 2.2, mat('carglass', { color: 0x1d2a33, metalness: 0.7, roughness: 0.2 }), 0, 1.4, -0.2, g); [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]].forEach(function (q) { var wh = mesh(new T.CylinderGeometry(0.38, 0.38, 0.3, 12), mat('tyre', { color: 0x111111 }), q[0], 0.38, q[1], g); wh.rotation.z = Math.PI / 2; }); g.position.set(x, 0, z); g.rotation.y = rot || 0; S3.add(g); return g; }
    car(0x17181a, -2.2, -40); car(0x8a8d93, 2.3, -73, Math.PI); car(0x2f6fa0, -2.2, -102); if (!lite) car(0x6b1d1d, 2.3, -22, Math.PI);
    // your own gate, at the start
    var mine = label('🏠 Your home', '#16a34a', '#ffffff', 2.4, 0.6); mine.position.set(0, 2.5, 4.6); mine.rotation.y = Math.PI; S3.add(mine);
    box(ROADW + 6, 2.3, 0.35, mat('wall0', {}), 0, 1.15, 5); box(3.4, 2.1, 0.2, mat('gate0', {}), 0, 1.05, 4.8);

    /* ---------- the main road ---------- */
    box(260, 0.06, 18, mat('asphalt', {}), 0, 0.03, MAINZ - 4);
    for (var lx = -126; lx < 130; lx += 6) box(2.6, 0.02, 0.18, mat('laneY', { color: 0xf2c200 }), lx, 0.07, MAINZ - 4);
    box(260, 0.5, 0.6, mat('median', { color: 0xf4f3ec }), 0, 0.25, MAINZ - 4.5); for (var mx = -128; mx < 130; mx += 2) box(1, 0.52, 0.62, mat('medianK', { color: 0x111111 }), mx, 0.26, MAINZ - 4.5);
    box(260, 0.16, 4, mat('pave', { color: 0xd8d2c4 }), 0, 0.08, MAINZ + 7); box(260, 0.16, 4, mat('pave', {}), 0, 0.08, MAINZ - 15);
    // shops along the far pavement
    var shopNames = [['GOD\'S TIME PHARMACY', '#16a34a'], ['MAMA T SUPERMARKET', '#c0392b'], ['ESTHER FASHION HOUSE', '#7c3aed'], ['FRESH CUTZ BARBERS', '#1f3f8a'], ['NAIJA PHONES & GADGETS', '#ea580c'], ['ROYAL BAKERY', '#b45309']];
    shopNames.forEach(function (sh, i) {
      var x = -70 + i * 26; box(22, 7 + (i % 2) * 3, 10, mat('shopW' + i, { color: wallCols[i % 5] }), x, (7 + (i % 2) * 3) / 2, MAINZ - 23);
      for (var k = 0; k < 6; k++) box(1.6, 1.4, 0.15, mat('shelf' + (k % 4), { color: [0xc0392b, 0x2f6fa0, 0xf2c200, 0x16a34a][k % 4] }), x - 8 + k * 3.2, 1.6, MAINZ - 17.9);
      var s = label(sh[0], sh[1], '#ffffff', 16, 2.2); s.position.set(x, 5.6, MAINZ - 17.9); S3.add(s);
    });
    // petrol station on the near side, past the close
    var ps = new T.Group(); ps.position.set(40, 0, MAINZ + 18); S3.add(ps);
    box(22, 0.5, 12, mat('canopy', { color: 0xf4f3ec }), 0, 6, 0, ps); box(22.2, 0.9, 12.2, mat('canopyR', { color: 0xc0392b }), 0, 6.6, 0, ps);
    [-8, 0, 8].forEach(function (x) { mesh(new T.CylinderGeometry(0.3, 0.3, 6, 8), mat('frame', { color: 0xdedede }), x, 3, 0, ps); box(1, 1.8, 0.7, mat('pump', { color: 0x17181a }), x + 2.5, 0.9, 0, ps); });
    var psl = label('EKO FUEL · PMS ₦ · DIESEL', '#c0392b', '#ffffff', 12, 1.6); psl.position.set(0, 7.9, -6.2); ps.add(psl);
    // danfos and cars driving the main road
    var movers = [];
    function danfo() { var g = new T.Group(); box(2.2, 2.2, 5.2, mat('danfo', { color: 0xf2c200, roughness: 0.5 }), 0, 1.5, 0, g); box(2.25, 0.25, 5.25, mat('stripeK', {}), 0, 1.1, 0, g); box(2.22, 0.8, 3.4, mat('carglass', {}), 0, 2.1, -0.4, g); [[-1, 1.7], [1, 1.7], [-1, -1.7], [1, -1.7]].forEach(function (q) { var wh = mesh(new T.CylinderGeometry(0.45, 0.45, 0.3, 12), mat('tyre', {}), q[0], 0.45, q[1], g); wh.rotation.z = Math.PI / 2; }); S3.add(g); return g; }
    for (var m = 0; m < (lite ? 3 : 6); m++) { var dv = m % 2 ? danfo() : car([0xffffff, 0x2f6fa0, 0x17181a, 0x8a8d93][m % 4], 0, 0, 0); dv.rotation.y = m % 2 ? Math.PI / 2 : -Math.PI / 2; movers.push({ g: dv, lane: m % 2 ? MAINZ - 1.5 : MAINZ - 7.5, dir: m % 2 ? 1 : -1, x: -120 + m * 47, sp: 7 + (m % 3) * 2 }); }

    /* ---------- people ---------- */
    var people = [], G3 = root.LasgidiGames3D, A3 = root.LasgidiAvatar3D;
    function person(i) {
      if (A3 && G3) { var st = G3.stranger('street:' + i, i); var f = A3.figure(T, st.look, st.outfit, null); f.scale.setScalar(1.0); f.traverse(function (o) { if (o.isMesh) o.castShadow = !lite; }); S3.add(f); return f; }
      var g = new T.Group(); box(0.6, 1.1, 0.35, mat('ppl' + (i % 4), { color: [0xc0392b, 0x2f6fa0, 0x16a34a, 0xf2c200][i % 4] }), 0, 1.25, 0, g); mesh(new T.SphereGeometry(0.22, 10, 8), mat('skin', { color: 0x6b4a33 }), 0, 2.0, 0, g); S3.add(g); return g;
    }
    var routes = [];
    for (var q = 0; q < (lite ? 6 : 12); q++) routes.push({ x: (q % 2 ? 1 : -1) * (ROADW / 2 + 1.5), z0: -10 - (q * 9) % (LEN - 20), len: 18 + (q % 4) * 6, ph: q * 1.7, sp: 1 + (q % 3) * 0.3 });
    for (var q2 = 0; q2 < (lite ? 6 : 14); q2++) routes.push({ main: true, x0: -60 + q2 * 9, z: q2 % 2 ? MAINZ + 7 : MAINZ - 15, len: 20, ph: q2 * 2.1, sp: 1.1 + (q2 % 3) * 0.25 });
    routes.forEach(function (r, i) { r.f = person(i + 1); r.f.traverse(function (o) { o.userData.npc = i + 1; }); people.push(r); });

    /* ---------- you ---------- */
    var ME = A3 ? A3.figure(T, opts.look || { skin: 2, hair: 0, shape: 1 }, opts.outfit || {}, null) : person(0);
    ME.traverse(function (o) { if (o.isMesh) o.castShadow = !lite; }); S3.add(ME);
    var P = { x: 0, z: -2, yaw: Math.PI, run: false, tx: null, tz: null }, keys = {}, joy = { x: 0, y: 0 };
    var camYaw = 0; // the camera sits behind you (towards your gate), looking down the close

    /* ---------- controls ---------- */
    var ui = document.createElement('div'); ui.className = 'st3-ui';
    ui.innerHTML = '<div class="st3-top"><button type="button" class="st3-btn" data-st3="home">🏠 Back inside</button><span class="st3-where" aria-live="polite">Your street</span><button type="button" class="st3-btn" data-st3="map">🗺️ Go somewhere</button></div>' +
      '<div class="st3-joy" aria-label="Joystick: drag to walk"><i></i></div><button type="button" class="st3-run" data-st3="run" aria-pressed="false">🏃 Run</button>';
    el.appendChild(ui);
    var knob = ui.querySelector('.st3-joy i'), joyEl = ui.querySelector('.st3-joy'), runBtn = ui.querySelector('.st3-run'), whereEl = ui.querySelector('.st3-where');
    function setRun(on) { P.run = on; runBtn.setAttribute('aria-pressed', String(on)); runBtn.classList.toggle('on', on); }
    ui.addEventListener('click', function (e) { var b = e.target.closest('[data-st3]'); if (!b) return; var a = b.getAttribute('data-st3'); if (a === 'run') setRun(!P.run); else if (a === 'home' && opts.onHome) opts.onHome(); else if (a === 'map' && opts.onMap) opts.onMap(); });
    var jid = null, jc = null;
    joyEl.addEventListener('pointerdown', function (e) { jid = e.pointerId; var r = joyEl.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; try { joyEl.setPointerCapture(jid); } catch (x) {} move(e); e.preventDefault(); });
    function move(e) { if (e.pointerId !== jid) return; var dx = e.clientX - jc.x, dy = e.clientY - jc.y, d = Math.hypot(dx, dy), k = Math.min(1, d / jc.r); if (d > 0) { joy.x = dx / d * k; joy.y = dy / d * k; } knob.style.transform = 'translate(' + joy.x * jc.r * 0.6 + 'px,' + joy.y * jc.r * 0.6 + 'px)'; if (k > 0.95 && !P.run && d > jc.r * 1.35) setRun(true); }
    joyEl.addEventListener('pointermove', move);
    function joyEnd(e) { if (e.pointerId !== jid) return; jid = null; joy.x = joy.y = 0; knob.style.transform = ''; }
    joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
    function kd(e) { if (!el.isConnected) return; var k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'shift'].indexOf(k) >= 0) { keys[k] = true; if (k.indexOf('arrow') === 0) e.preventDefault(); } }
    function ku(e) { keys[e.key.toLowerCase()] = false; }
    document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
    // drag the view to turn; tap the ground to walk there
    var drag = null, ray = new T.Raycaster(), ndc = new T.Vector2(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
    cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, moved: false }; });
    cv.addEventListener('pointermove', function (e) { if (!drag) return; var dx = e.clientX - drag.x; if (Math.abs(dx) > 3) drag.moved = true; camYaw -= dx * 0.006; drag.x = e.clientX; });
    cv.addEventListener('pointerup', function (e) { var d0 = drag; drag = null; if (!d0 || d0.moved) return; var r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); var hitP = ray.intersectObjects(people.map(function (p) { return p.f; }), true)[0]; if (hitP && hitP.object.userData.npc) { chat(hitP.object.userData.npc); return; } var gp = new T.Vector3(); if (ray.ray.intersectPlane(ground, gp)) { P.tx = gp.x; P.tz = gp.z; } });

    // A quick chat with a passer-by.
    var GREET = ['Ah, good day o!', 'How you dey?', 'Morning o!', 'My person!', 'Afternoon o, how body?'];
    var WHERE = ['The main road dey straight down. Walk past No. 7, you go see the petrol station.', 'Danfo? Go the main road, stand by the shops. Conductors go call you.', 'Pharmacy dey for the main road, God\'s Time. Them get everything.', 'Your gate? Turn back, na the green sign.'];
    var GIST = ['NEPA don take light since morning o.', 'Landlord say rent go increase next year. Wahala.', 'Owambe dey this Saturday for No. 12, them dey share aso-ebi.', 'Area boys dey collect money for the junction, carry change.', 'Tomato don cost again for market.', 'Them dey fix the road for the main road. Go-slow everywhere.'];
    var chatEl = document.createElement('div'); chatEl.className = 'st3-chat'; chatEl.hidden = true; el.appendChild(chatEl); var chatWho = 0;
    function pickL(a) { return a[Math.floor(Math.random() * a.length)]; }
    function chat(n, line, mine) {
      chatWho = n; chatEl.hidden = false;
      chatEl.innerHTML = '<div class="st3-ch"><span>🚶🏾</span><div><b>Passer-by</b><small>On the street · a quick chat</small></div></div>' + (mine ? '<p class="st3-me">' + mine + '</p>' : '') + '<p class="st3-say">' + (line || pickL(GREET)) + '</p>' +
        '<button type="button" data-st3c="where">🧭 Abeg, where is…?</button><button type="button" data-st3c="gist">🗞️ Wetin dey happen for this area?</button><button type="button" data-st3c="bye">👋🏾 Bye</button>';
      if (opts.onSay) try { opts.onSay(line || ''); } catch (e) {}
    }
    chatEl.addEventListener('click', function (e) { var b = e.target.closest('[data-st3c]'); if (!b) return; var k = b.getAttribute('data-st3c'); if (k === 'bye') { chatEl.hidden = true; return; } chat(chatWho, pickL(k === 'where' ? WHERE : GIST), k === 'where' ? 'Abeg, where is…?' : 'Wetin dey happen for this area?'); });
    // Where you can walk: the close (road and pavements) and the main road strip.
    function clampPos() {
      if (P.z > -1.2) P.z = -1.2; // your gate is behind you
      if (P.z > MAINZ + 9) P.x = Math.max(-(ROADW / 2 + 2.2), Math.min(ROADW / 2 + 2.2, P.x));
      else { P.x = Math.max(-125, Math.min(125, P.x)); P.z = Math.max(MAINZ - 16.5, P.z); if (P.z > MAINZ + 9 && Math.abs(P.x) > ROADW / 2 + 2.2) P.z = MAINZ + 9; }
      if (Math.abs(P.z - (MAINZ - 4.5)) < 0.5 && Math.abs(P.x) > 1) P.z += P.z > MAINZ - 4.5 ? 0.5 : -0.5; // the median
    }

    /* ---------- frame ---------- */
    var W = 0, H = 0, raf = 0, last = 0, stepT = 0;
    function size() { var w = el.clientWidth || 360, h = el.clientHeight || 600; if (w === W && h === H) return; W = w; H = h; renderer.setSize(W, H, false); cv.style.width = W + 'px'; cv.style.height = H + 'px'; cam.aspect = W / H; cam.updateProjectionMatrix(); }
    function frame(now) {
      if (root.LasgidiGL && !root.LasgidiGL.live(el)) { raf = el.isConnected ? root.requestAnimationFrame(frame) : 0; return; }
      size(); var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; var t = now / 1000;
      // input -> direction relative to the camera
      var fx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + joy.x, fz = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0) + joy.y;
      var mag = Math.min(1, Math.hypot(fx, fz)), running = P.run || keys.shift;
      if (mag > 0.08) { P.tx = null; var c = Math.cos(camYaw), s = Math.sin(camYaw), wx = fz * s + fx * c, wz = fz * c - fx * s; // camera-relative: up walks away from the camera
        var spd = (running ? 7.5 : 3.2) * mag; P.x += wx / mag * spd * dt * mag; P.z += wz / mag * spd * dt * mag; P.yaw = Math.atan2(wx, wz); }
      else if (P.tx != null) { var dx = P.tx - P.x, dz = P.tz - P.z, d = Math.hypot(dx, dz), sp2 = (running ? 7.5 : 3.2) * dt; if (d < 0.2) P.tx = null; else { P.x += dx / d * Math.min(d, sp2); P.z += dz / d * Math.min(d, sp2); P.yaw = Math.atan2(dx, dz); mag = 1; } }
      clampPos();
      var moving = mag > 0.08 || P.tx != null;
      ME.position.set(P.x, 0.12, P.z); var dy = ((P.yaw - ME.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI; ME.rotation.y += dy * Math.min(1, dt * 10);
      stepT += dt * (moving ? (running ? 15 : 9) : 0); var sw = moving ? Math.sin(stepT) * (running ? 0.9 : 0.55) : 0;
      if (ME.userData.legs) ME.userData.legs.forEach(function (l, k) { l.rotation.x = k ? -sw : sw; }); if (ME.userData.arms) ME.userData.arms.forEach(function (l, k) { l.rotation.x = (k ? sw : -sw) * 0.8; });
      ME.position.y = 0.12 + (moving && running ? Math.abs(Math.sin(stepT)) * 0.12 : 0);
      // the camera follows behind you; it slowly swings round to your back while you move
      if (moving && !drag) { var dyaw = ((P.yaw + Math.PI - camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; camYaw += dyaw * Math.min(1, dt * 1.6); }
      var back = running ? 7 : 6, hgt = 3.1; cam.position.set(P.x + Math.sin(camYaw) * back, hgt, P.z + Math.cos(camYaw) * back); cam.lookAt(P.x, 1.5, P.z);
      sun.position.set(P.x + 30, 60, P.z + 20); sun.target.position.set(P.x, 0, P.z);
      // traffic and people
      movers.forEach(function (m) { m.x += m.dir * m.sp * dt; if (m.x > 130) m.x = -130; if (m.x < -130) m.x = 130; m.g.position.set(m.x, 0, m.lane); });
      people.forEach(function (r) { var u = ((t * r.sp * 0.12 + r.ph) % 2), f = u < 1 ? u : 2 - u, dir = u < 1 ? 1 : -1;
        if (r.main) r.f.position.set(r.x0 + f * r.len, 0.12, r.z), r.f.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        else r.f.position.set(r.x, 0.12, r.z0 - f * r.len), r.f.rotation.y = dir > 0 ? Math.PI : 0;
        var ls = Math.sin(t * 7 + r.ph) * 0.5; if (r.f.userData.legs) r.f.userData.legs.forEach(function (l, k) { l.rotation.x = k ? -ls : ls; }); });
      var where = P.z > MAINZ + 9 ? (P.z > -6 ? 'At your gate' : 'Your street · ' + Math.round(-P.z) + ' m from your gate') : 'Main road · danfos, shops, the petrol station';
      if (whereEl.textContent !== where) whereEl.textContent = where;
      renderer.render(S3, cam);
      raf = el.isConnected ? root.requestAnimationFrame(frame) : 0;
    }
    return {
      el: el,
      start: function () { if (!raf) raf = root.requestAnimationFrame(frame); },
      stop: function () { if (raf) root.cancelAnimationFrame(raf); raf = 0; },
      dispose: function () { if (raf) root.cancelAnimationFrame(raf); raf = 0; document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); if (root.LasgidiGL) root.LasgidiGL.free(renderer); else renderer.dispose(); },
      me: function () { return { x: P.x, z: P.z, run: P.run }; }, // for tests
      jump: function (x, z) { P.x = x; P.z = z; P.tx = null; }, // for tests
      MAINZ: MAINZ
    };
  }
  root.LasgidiStreet3D = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
