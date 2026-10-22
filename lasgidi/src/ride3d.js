/* Lasgidi: the ride view in real 3D (three.js). play(container, o) fills the "Now passing" window with a short
   journey: o = { mode, night, dusk, water, air, highway, sights: [names], secs, chauffeur, look, outfit }. A coach on the
   highway (highway: true) passes savanna, villages and the towns on its route; box.dataset.cam picks chase, side or inside. Your danfo, keke,
   okada, car, cab, BRT bus, train, ferry, boat, helicopter or jet moves with the camera chasing it; lane lines,
   city blocks, palms and street lamps stream past (the lagoon and its wake for boats; clouds and the city far below
   for flights); each landmark you pass rises beside the road with its green "Now passing" sign. It stops itself
   when the window closes. Returns false if WebGL is unavailable, so the 2D scene can be used instead. */
(function (root) {
  'use strict';
  function play(box, o) {
    var T = root.THREE; if (!T || !box) return false;
    var renderer; try { renderer = root.LasgidiGL ? root.LasgidiGL.make({ maxRatio: 1.5 }) : new T.WebGLRenderer({ antialias: true }); } catch (e) { return false; } if (!renderer) return false;
    if (!root.LasgidiGL) renderer.setPixelRatio(Math.min(1.5, root.devicePixelRatio || 1)); renderer.toneMapping = T.ACESFilmicToneMapping; renderer.shadowMap.enabled = true;
    var cv = renderer.domElement; cv.className = 'rv-3d'; box.innerHTML = ''; box.appendChild(cv);
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches, secs = o.secs || 5.5, night = !!o.night, dusk = !!o.dusk, water = !!o.water, air = !!o.air, mode = o.mode || 'car', HW = !!o.highway;
    var S3 = new T.Scene(), cam = new T.PerspectiveCamera(50, 2, 0.1, 900), sky = night ? 0x0d1733 : dusk ? 0xf0b98a : 0x9fd3ef; S3.background = new T.Color(sky); S3.fog = new T.Fog(sky, 60, 260);
    S3.add(new T.HemisphereLight(night ? 0x6070a0 : 0xfff4e6, 0x5a6a50, night ? 0.45 : 0.95)); var sun = new T.DirectionalLight(night ? 0x8fa8ff : dusk ? 0xffb070 : 0xffffff, night ? 0.25 : 1.5); sun.position.set(-20, 40, 10); sun.castShadow = true; S3.add(sun);
    function M(c, r, m, x) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: r == null ? 0.7 : r, metalness: m || 0 }, x || {})); }
    function box3(g, w, h, d, m, x, y, z) { var b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; }
    function K0(g, rt, h, x, y, z) { var c = new T.Mesh(new T.CylinderGeometry(rt, rt, h, 10), M(0x2b2f36, 0.4, 0.6)); c.position.set(x, y, z); g.add(c); return c; }
    function tex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
    var world = new T.Group(); S3.add(world); var movers = [], sights = [], SPEED = air ? 40 : water ? 14 : mode === 'trek' ? 4 : mode === 'okada' || mode === 'keke' ? 16 : 20;
    // The ground: a road with moving lane lines, the lagoon, or the city far below.
    var groundTex = tex(256, 256, function (g, w, h) { if (water) { g.fillStyle = night ? '#1a4a68' : '#2a7896'; g.fillRect(0, 0, w, h); for (var i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.05 + (i % 5) * 0.03) + ')'; g.fillRect((i * 53) % w, (i * 97) % h, 30, 2); } } else if (air) { g.fillStyle = night ? '#141a24' : '#7a8a6a'; g.fillRect(0, 0, w, h); for (var b = 0; b < 140; b++) { g.fillStyle = night ? (b % 3 ? 'rgba(255,205,120,.9)' : 'rgba(255,240,200,.7)') : ['#c9c2b4', '#9aa0a6', '#b5603a', '#d8d2c4'][b % 4]; g.fillRect((b * 37) % w, (b * 61) % h, night ? 3 + (b % 3) : 8 + (b % 3) * 4, night ? 3 : 8 + (b % 4) * 3); } if (night) { g.strokeStyle = 'rgba(255,190,90,.8)'; g.lineWidth = 2; for (var rl = 0; rl < 6; rl++) { g.beginPath(); g.moveTo(0, rl * 47 % h); g.lineTo(w, (rl * 47 + 90) % h); g.stroke(); } } } else { g.fillStyle = '#3a3f46'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2c200'; for (var y = 0; y < h; y += 64) g.fillRect(w / 2 - 3, y, 6, 36); g.fillStyle = '#f4f3ec'; g.fillRect(8, 0, 4, h); g.fillRect(w - 12, 0, 4, h); } });
    groundTex.wrapS = groundTex.wrapT = T.RepeatWrapping; groundTex.repeat.set(air ? 6 : 1, air ? 30 : 12);
    var ground = new T.Mesh(new T.PlaneGeometry(air ? 600 : water ? 400 : 12, 400).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: groundTex, roughness: water ? 0.2 : 0.9, emissive: air && night ? 0xffffff : 0x000000, emissiveMap: air && night ? groundTex : null, emissiveIntensity: 0.9 })); ground.position.set(0, air ? -60 : 0, -150); ground.receiveShadow = true; world.add(ground);
    if (!water && !air) { var side = new T.Mesh(new T.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), M(HW ? 0x6f8f3e : 0x9a9184, 0.95)); side.position.set(0, -0.02, -150); side.receiveShadow = true; world.add(side); }
    // Things that stream past: blocks with lit windows, palms, lamps (or buoys and boats; or clouds).
    var winT = tex(32, 64, function (g, w, h) { g.fillStyle = '#5d7488'; g.fillRect(0, 0, w, h); for (var y = 2; y < h; y += 8) for (var x = 2; x < w; x += 7) { g.fillStyle = night ? ((x + y) % 3 ? 'rgba(255,214,140,.95)' : 'rgba(40,50,60,.9)') : 'rgba(200,215,225,.8)'; g.fillRect(x, y, 4, 4); } });
    for (var i = 0; i < 26; i++) {
      var sd = i % 2 ? 1 : -1, z = -i * 12, g = new T.Group();
      if (air) { var cl = new T.Mesh(new T.SphereGeometry(4 + (i % 3) * 2, 10, 8), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, roughness: 1 })); cl.scale.set(2, 0.6, 1); g.add(cl); g.position.set(sd * (14 + (i * 7) % 20), -10 - (i % 4) * 6, z); }
      else if (water) { if (i % 3 === 0) { box3(g, 3, 0.6, 1.2, M(0xf4f3ec), 0, 0.2, 0); g.position.set(sd * (14 + (i * 5) % 12), 0, z); } else { var bu = new T.Mesh(new T.CylinderGeometry(0.3, 0.4, 1, 8), M(i % 2 ? 0xc0392b : 0xf2b600)); bu.position.y = 0.4; g.add(bu); g.position.set(sd * 8, 0, z); } var tw = box3(g, 8, 20 + (i * 13) % 40, 8, M(0xffffff, 0.3, 0.3, { map: winT, emissiveMap: winT, emissive: 0xffd28c, emissiveIntensity: night ? 0.9 : 0 }), sd * 46, 12, -30); }
      else if (HW) { // the open road: savanna trees, palms, the odd village with zinc roofs, road signs
        var kind = i % 5;
        if (kind === 0) { [0, 1, 2].forEach(function (k) { var hx = sd * (14 + k * 5), hh = box3(g, 3.6, 2.2, 3.2, M([0xc8a27a, 0xb48a5a, 0xd8c3a5][k], 0.9), hx, 1.1, k * 3); var roof = box3(g, 4.2, 0.2, 3.8, M(0x9a8a78, 0.5, 0.45), hx, 2.35, k * 3); roof.rotation.x = 0.1; }); }
        else if (kind === 2) { var tr2 = new T.Mesh(new T.CylinderGeometry(0.15, 0.22, 5, 6), M(0x6b4a2b)); tr2.position.set(sd * 9, 2.5, 0); g.add(tr2); for (var f2 = 0; f2 < 6; f2++) { var fr2 = new T.Mesh(new T.BoxGeometry(2.4, 0.06, 0.5), M(0x3f8f3a, 0.8)); fr2.position.set(sd * 9 + Math.cos(f2) * 1, 5, Math.sin(f2) * 1); fr2.rotation.y = f2; fr2.rotation.z = 0.3; g.add(fr2); } }
        else { for (var tq = 0; tq < 3; tq++) { var tx = sd * (10 + tq * 7 + (i * 3) % 5), tt = new T.Mesh(new T.CylinderGeometry(0.2, 0.3, 2.4, 6), M(0x5a3d24)); tt.position.set(tx, 1.2, tq * 4); g.add(tt); var crown = new T.Mesh(new T.IcosahedronGeometry(1.8 + (tq % 2) * 0.6, 0), M([0x4f7f2f, 0x6a8f3a, 0x3f6f2a][tq], 0.9, 0, { flatShading: true })); crown.position.set(tx, 3.4, tq * 4); crown.scale.y = 0.7; g.add(crown); } }
        if (i % 7 === 3) { var post2 = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 3, 6), M(0x9aa0a6)); post2.position.set(sd * 6.8, 1.5, 0); g.add(post2); box3(g, 2.4, 1.2, 0.08, M(0x1d7a43), sd * 6.8, 3.2, 0); }
        g.position.z = z;
      }
      else {
        var hgt = 4 + (i * 13) % 16, b = box3(g, 6, hgt, 6, M(0xffffff, 0.5, 0.1, { map: winT, emissiveMap: winT, emissive: 0xffd28c, emissiveIntensity: night ? 0.35 : 0 }), sd * 13, hgt / 2, 0); box3(g, 6.2, 0.3, 6.2, M([0xc44b3a, 0x2f6fa0, 0x9a8a78][i % 3]), sd * 13, hgt + 0.15, 0);
        if (i % 2 === 0) { var tr = new T.Mesh(new T.CylinderGeometry(0.15, 0.22, 4, 6), M(0x6b4a2b)); tr.position.set(sd * 7.5, 2, 4); g.add(tr); for (var f = 0; f < 6; f++) { var fr = new T.Mesh(new T.BoxGeometry(2.2, 0.06, 0.5), M(0x3f8f3a, 0.8)); fr.position.set(sd * 7.5 + Math.cos(f) * 1, 4, 4 + Math.sin(f) * 1); fr.rotation.y = f; fr.rotation.z = 0.35; g.add(fr); } }
        var lp = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 4, 6), M(0x2b2f36)); lp.position.set(sd * 6.6, 2, -4); g.add(lp); var bulb = new T.Mesh(new T.SphereGeometry(0.2, 8, 6), new T.MeshBasicMaterial({ color: night || dusk ? 0xffd27a : 0x8a8478 })); bulb.position.set(sd * 6.6, 4.1, -4); g.add(bulb);
        g.position.z = z;
      }
      world.add(g); movers.push(g);
    }
    // Your ride.
    var V = new T.Group(); world.add(V); var col = { coach: 0xf4f3ec, danfo: 0xf2c200, keke: 0x2fa36b, okada: 0xc0392b, brt: 0x1f5fa0, cab: 0xf2c200, rail: 0x1d7a43 }[mode] || (o.chauffeur ? 0x17181a : 0xf4f3ec), body = M(col, 0.35, 0.3), glass = M(0x2c4a5c, 0.05, 0.8);
    if (water) { box3(V, 2.2, 0.8, mode === 'ferry' ? 7 : 4.5, M(0xf4f3ec, 0.4), 0, 0.3, 0); box3(V, 1.8, 0.9, mode === 'ferry' ? 3 : 1.6, M(0x1f5fa0), 0, 1.1, 0.4); var wake = new T.Mesh(new T.PlaneGeometry(3, 10).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false })); wake.position.set(0, 0.05, 7); V.add(wake); V.userData.wake = wake; }
    else if (air) {
      var nav = function (x, y, z, c) { var l = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), new T.MeshBasicMaterial({ color: c })); l.position.set(x, y, z); V.add(l); (V.userData.navs = V.userData.navs || []).push(l); };
      if (mode === 'heli') {
        // A twin-seat helicopter: body, glass nose, tail boom and fin, skids, main and tail rotors.
        var hm = M(0x1f3b63, 0.3, 0.45), hb = new T.Mesh(new T.CapsuleGeometry(0.75, 1.3, 6, 16).rotateX(Math.PI / 2), hm); V.add(hb);
        var nose = new T.Mesh(new T.SphereGeometry(0.74, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2), M(0x8fc4dc, 0.05, 0.6, { transparent: true, opacity: 0.75 })); nose.position.set(0, 0.08, -0.9); nose.scale.set(1, 0.9, 1.1); V.add(nose);
        var boom = new T.Mesh(new T.CylinderGeometry(0.12, 0.26, 3.2, 10).rotateX(Math.PI / 2), hm); boom.position.set(0, 0.25, 2.3); V.add(boom); box3(V, 0.08, 0.9, 0.5, M(0xf2b600, 0.4), 0, 0.65, 3.8); box3(V, 1.2, 0.06, 0.35, hm, 0, 0.3, 3.5);
        [-0.6, 0.6].forEach(function (x) { box3(V, 0.07, 0.07, 2.4, M(0x2b2f36, 0.4, 0.6), x, -0.95, 0); [-0.6, 0.6].forEach(function (z) { box3(V, 0.06, 0.4, 0.06, M(0x2b2f36), x * 0.85, -0.75, z); }); });
        K0(V, 0.12, 0.4, 0, 0.95, 0); var rot = new T.Group(); rot.position.y = 1.18; V.add(rot); [0, Math.PI / 2].forEach(function (r) { var bl = box3(rot, 6.4, 0.04, 0.22, M(0x17181a, 0.5), 0, 0, 0); bl.rotation.y = r; }); V.userData.rotor = rot;
        var tr = new T.Group(); tr.position.set(0.12, 0.7, 3.8); V.add(tr); box3(tr, 0.03, 1.1, 0.12, M(0x17181a), 0, 0, 0); V.userData.tailRotor = tr;
        nav(-0.75, 0, 0, 0xff3030); nav(0.75, 0, 0, 0x30ff60); V.scale.setScalar(1.3);
      } else {
        // A business jet: fuselage, swept wings, winglets, T-tail, engines on the tail, window line.
        var wm = M(0xf7f7f5, 0.25, 0.35), fus = new T.Mesh(new T.CapsuleGeometry(0.7, 6, 6, 16).rotateX(Math.PI / 2), wm); V.add(fus);
        var cone = new T.Mesh(new T.ConeGeometry(0.7, 1.4, 16).rotateX(-Math.PI / 2), wm); cone.position.z = -4.1; V.add(cone);
        box3(V, 1.0, 0.18, 0.04, M(0x22343f, 0.05, 0.7), 0, 0.32, -3.3).rotation.x = -0.4; for (var wi = 0; wi < 7; wi++) box3(V, 1.42, 0.16, 0.22, M(0x22343f, 0.1, 0.6), 0, 0.15, -2 + wi * 0.6);
        [-1, 1].forEach(function (sd) { var wg = box3(V, 4.6, 0.12, 1.5, wm, sd * 2.6, -0.25, 0.4); wg.rotation.y = -sd * 0.38; box3(V, 0.1, 0.7, 0.6, M(0x1d7a43), sd * 4.85, 0.05, 1.3).rotation.z = sd * 0.2; var en = new T.Mesh(new T.CylinderGeometry(0.32, 0.36, 1.6, 14).rotateX(Math.PI / 2), M(0xd9dde2, 0.3, 0.5)); en.position.set(sd * 1.0, 0.45, 2.6); V.add(en); nav(sd * 4.9, -0.2, 1.1, sd < 0 ? 0xff3030 : 0x30ff60); });
        box3(V, 0.12, 1.8, 1.3, wm, 0, 1.2, 3.4).rotation.x = 0.3; box3(V, 2.8, 0.1, 0.9, wm, 0, 2.05, 3.8); box3(V, 0.13, 0.5, 1.0, M(0x1d7a43), 0, 1.6, 3.5).rotation.x = 0.3;
        box3(V, 1.44, 0.08, 7.2, M(0x1d7a43, 0.4), 0, -0.05, 0);
      }
    }
    else if (mode === 'coach') { // a long-distance luxury coach: white body, blue stripe, tinted windows, luggage on the roof
      box3(V, 2.5, 2.8, 12, body, 0, 1.8, 0); box3(V, 2.54, 0.35, 12.05, M(0x1f5fa0, 0.4), 0, 1.2, 0); box3(V, 2.56, 1.0, 10.4, glass, 0, 2.5, -0.4); box3(V, 2.3, 1.2, 0.08, glass, 0, 2.4, -6.02);
      var bk = tex(256, 64, function (c, w, hh) { c.fillStyle = '#f4f3ec'; c.fillRect(0, 0, w, hh); c.fillStyle = '#1f5fa0'; c.font = '900 30px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SAVANNA LINE', w / 2, hh / 2); });
      var bm = new T.Mesh(new T.PlaneGeometry(2.2, 0.55), new T.MeshBasicMaterial({ map: bk })); bm.position.set(0, 1.6, 6.03); V.add(bm); [-0.95, 0.95].forEach(function (x) { box3(V, 0.3, 0.5, 0.05, new T.MeshBasicMaterial({ color: 0xff2a2a }), x, 0.9, 6.03); });
      box3(V, 2.0, 0.5, 4, M(0x8a3a2a, 0.8), 0, 3.45, 1); box3(V, 1.6, 0.4, 2, M(0x2f6fa0, 0.8), 0.1, 3.9, 1.5);
      [[-1.2, -4.2], [1.2, -4.2], [-1.2, 4.2], [1.2, 4.2], [-1.2, 2.8], [1.2, 2.8]].forEach(function (q) { var wh = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.35, 14), M(0x111111)); wh.rotation.z = Math.PI / 2; wh.position.set(q[0], 0.5, q[1]); V.add(wh); });
      for (var sr = 0; sr < 9; sr++) [-0.6, 0.6].forEach(function (x) { box3(V, 0.55, 0.9, 0.5, M(0x1f3b63, 0.8), x, 1.9, -4.5 + sr * 1.1); });
    }
    else if (mode === 'trek' && root.LasgidiAvatar3D) { var me = root.LasgidiAvatar3D.figure(T, o.look || { skin: 2, hair: 0, shape: 1 }, o.outfit || {}, null); me.rotation.y = Math.PI; V.add(me); V.userData.walker = me; }
    else if (mode === 'okada') { box3(V, 0.3, 0.6, 1.8, body, 0, 0.7, 0); [-0.8, 0.8].forEach(function (zz) { var wh = new T.Mesh(new T.TorusGeometry(0.35, 0.1, 8, 16), M(0x111111)); wh.position.set(0, 0.4, zz); wh.rotation.y = Math.PI / 2; V.add(wh); }); var rider = new T.Mesh(new T.CapsuleGeometry(0.25, 0.6, 4, 8), M(0x2f6fa0)); rider.position.set(0, 1.4, 0.1); V.add(rider); }
    else { var long = mode === 'brt' || mode === 'rail' ? 9 : mode === 'danfo' ? 5 : mode === 'keke' ? 2.4 : 4.2, ht = mode === 'brt' || mode === 'rail' || mode === 'danfo' ? 2.2 : mode === 'keke' ? 1.5 : 1.0; box3(V, mode === 'keke' ? 1.3 : 2, ht, long, body, 0, ht / 2 + 0.4, 0); box3(V, mode === 'keke' ? 1.32 : 2.02, ht * 0.4, long * 0.8, glass, 0, ht * 0.8 + 0.4, -0.1); if (mode === 'danfo') box3(V, 2.04, 0.18, long + 0.04, M(0x17181a), 0, ht * 0.45 + 0.4, 0); if (mode === 'car' || mode === 'cab') box3(V, 1.8, 0.6, long * 0.5, body, 0, ht + 0.7, 0.2);
      [[-1, -long / 2 + 0.7], [1, -long / 2 + 0.7], [-1, long / 2 - 0.7], [1, long / 2 - 0.7]].forEach(function (q) { if (mode === 'keke' && q[1] < 0 && q[0] > 0) return; var wh = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.3, 12), M(0x111111)); wh.rotation.z = Math.PI / 2; wh.position.set(q[0] * (mode === 'keke' ? 0.65 : 1), 0.4, q[1]); V.add(wh); }); }
    V.position.set(water || air ? 0 : 1.6, air ? 0 : 0, 0); V.traverse(function (x) { x.castShadow = true; });
    // The landmarks you pass, each with its green sign.
    (o.sights || []).forEach(function (name, i) {
      var g = new T.Group(), sd = i % 2 ? -1 : 1, h = air ? 34 + i * 6 : 14 + i * 4, y0 = air ? -60 : 0, lx = air ? sd * 24 : sd * 16; box3(g, 8, h, 8, M(0xe9e2d4, 0.6, 0, air && night ? { emissive: 0xffd28c, emissiveIntensity: 0.25 } : {}), lx, y0 + h / 2, 0); box3(g, 8.4, 1, 8.4, M(0x1d7a43), lx, y0 + h + 0.5, 0);
      var st = tex(512, 160, function (c, w, hh) { c.fillStyle = '#1d7a43'; c.fillRect(0, 0, w, hh); c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, hh - 16); var sub = o.subs && o.subs[i]; c.textAlign = 'center'; if (sub) { c.fillStyle = '#ffffff'; c.font = '900 56px system-ui, sans-serif'; c.fillText(String(name).toUpperCase().slice(0, 18), w / 2, 78, w - 30); c.fillStyle = '#cfe8d6'; c.font = '800 28px system-ui, sans-serif'; c.fillText(sub, w / 2, 128, w - 30); return; } c.fillStyle = '#cfe8d6'; c.font = '700 26px system-ui, sans-serif'; c.fillText('NOW PASSING', w / 2, 50); c.fillStyle = '#ffffff'; c.font = '900 44px system-ui, sans-serif'; c.fillText(String(name).slice(0, 26), w / 2, 112, w - 30); });
      // The River Niger: a steel truss bridge and the wide water under the road at Jebba, and at Onitsha or Asaba.
      if (o.highway && /Jebba|Onitsha|Asaba/.test(name)) {
        var wm = M(0x4f8aa0, 0.15, 0.1), stl = M(0x5d6670, 0.5, 0.5);
        [-1, 1].forEach(function (sdw) { var wp = new T.Mesh(new T.PlaneGeometry(160, 90).rotateX(-Math.PI / 2), wm); wp.position.set(sdw * 86, 0.06, 0); g.add(wp); });
        [-5.6, 5.6].forEach(function (bx) { box3(g, 0.5, 0.5, 84, stl, bx, 6.5, 0); box3(g, 0.5, 0.5, 84, stl, bx, 0.6, 0); for (var k = -40; k <= 40; k += 8) { box3(g, 0.35, 6, 0.35, stl, bx, 3.5, k); var dg = new T.Mesh(new T.BoxGeometry(0.25, 9.6, 0.25), stl); dg.position.set(bx, 3.5, k + 4); dg.rotation.x = 0.92; g.add(dg); } });
        for (var cb = -40; cb <= 40; cb += 8) box3(g, 11.4, 0.3, 0.3, stl, 0, 6.6, cb);
      }
      var sign = new T.Mesh(new T.PlaneGeometry(7, 2.2), new T.MeshBasicMaterial({ map: st, side: T.DoubleSide })); sign.position.set(air ? lx : sd * 6.5, air ? y0 + h + 4.5 : 5, 0); if (air) sign.scale.setScalar(2.2); g.add(sign); [-3, 3].forEach(function (px) { if (!air) { var post = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 4, 6), M(0x9aa0a6)); post.position.set(sd * 6.5 + px, 2, 0); g.add(post); } });
      g.position.set(0, air ? 0 : 0, -400); world.add(g); sights.push({ g: g, at: secs * (0.12 + i * 0.8 / Math.max(1, o.sights.length)) });
    });
    cam.position.set(air ? 10 : 6, air ? 5 : 4.5, air ? 16 : 11); cam.lookAt(0, air ? 0 : 1, -6);
    var t0 = performance.now(), raf = 0, W = 0, H = 0;
    function frame(now) {
      if (!cv.isConnected) { if (root.LasgidiGL) root.LasgidiGL.free(renderer); else renderer.dispose(); return; }
      if (root.LasgidiGL) root.LasgidiGL.pace(renderer);
      var w = box.clientWidth || 320, h = box.clientHeight || 160; if (w !== W || h !== H) { W = w; H = h; renderer.setSize(W, H, false); cv.style.width = W + 'px'; cv.style.height = H + 'px'; cam.aspect = W / H; cam.updateProjectionMatrix(); }
      var t = (now - t0) / 1000, run = reduce ? 0 : t;
      groundTex.offset.y = -(run * SPEED / (air ? 13 : 33)) % 1;
      movers.forEach(function (g, i) { var z = (-i * 12 + run * SPEED) % 312; g.position.z = z > 20 ? z - 312 : z; });
      sights.forEach(function (s) { var dz = (t - s.at) * SPEED * 1.4; s.g.position.z = Math.min(40, -120 + dz * 1.6); });
      V.position.y = air ? Math.sin(t * 1.2) * 0.5 + (t < 1 ? -3 * (1 - t) : 0) : water ? Math.sin(t * 2) * 0.1 : Math.abs(Math.sin(t * 9)) * 0.03; V.rotation.z = water ? Math.sin(t * 1.6) * 0.03 : 0;
      if (V.userData.rotor) V.userData.rotor.rotation.y = t * 25; if (V.userData.tailRotor) V.userData.tailRotor.rotation.x = t * 40; if (V.userData.navs) V.userData.navs.forEach(function (l) { l.visible = Math.floor(t * 2) % 2 === 0; }); if (V.userData.wake) V.userData.wake.material.opacity = 0.35 + Math.sin(t * 5) * 0.1;
      if (V.userData.walker) { var lg = V.userData.walker.userData.legs, a = Math.sin(t * 7) * 0.5; lg[0].rotation.x = a; lg[1].rotation.x = -a; }
      var cm = box.dataset.cam || 'chase'; if (!air && !water) { if (cm === 'side') { cam.position.set(V.position.x + 14, 3, 1); cam.lookAt(V.position.x, 1.5, -1); } else if (cm === 'inside') { cam.position.set(V.position.x + 0.6, 2.4, mode === 'coach' ? -1 : 0); cam.lookAt(V.position.x + 0.3, 2.2, -30); } else { cam.position.set(6, 4.5, 11); cam.lookAt(0, 1, -6); } }
      renderer.render(S3, cam); raf = root.requestAnimationFrame(frame);
    }
    raf = root.requestAnimationFrame(frame);
    return true;
  }
  root.LasgidiRide3D = { play: play };
})(typeof globalThis !== 'undefined' ? globalThis : this);
