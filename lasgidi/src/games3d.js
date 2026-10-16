/* Lasgidi: the five mini-games in real 3D (three.js). view(kind, o) returns a stage the game hands its own live
   state to each frame ({ mount, frame, pick, dispose }), so the game logic, its seeded randomness and its result
   are exactly the same as the 2D version; only the picture changes. The game's 2D canvas stays on top, cleared,
   for the HUD and messages, and taps on it still reach the game (pick() turns a tap into game coordinates by
   raycasting the 3D ground, for the hawker's cars and the grill's slots).
   - danfo: chase camera behind your yellow danfo; buildings, palms and lamps stream past; bus stops with people
     waiting, LASTMA zones, potholes, okadas and cars.
   - dance: an owambe stage with you dancing, guests around you, four glowing lanes and naira raining on streaks.
   - hawk:  the Oshodi go-slow under the bridge; three rows of cars, the light, you with your tray, the van.
   - bole:  a roadside grill with embers and smoke; plantain, fish and yam that turn golden then burn; customers.
   - quiz:  a game-show studio above the answer card: host, podium, the question on a big screen, lit answers.
   Returns null without three.js or WebGL, and the game draws itself in 2D. */
(function (root) {
  'use strict';
  var D = root.LASGIDI_DATA || {};
  function hash(str, n) { var h = 2166136261; str = String(str); for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return Math.imul(h ^ n, 2654435761) >>> 0; }
  // A stranger dressed from the wardrobe (the same idea as the walk-ins), stable for a given key.
  function stranger(key, ix) {
    var h = hash(key, ix), C = D.CLOTHES || {}, ids = Object.keys(C), pick = function (slot, k) { var l = ids.filter(function (c) { return C[c].slot === slot; }); return l.length ? l[(h >>> k) % l.length] : undefined; };
    var dress = (h >>> 3) % 4 === 0, outfit = dress ? { dress: pick('dress', 4) } : { top: pick('top', 5), bottom: pick('bottom', 9) };
    outfit.shoes = pick('shoes', 13); if ((h >>> 17) % 4 === 0) outfit.head = pick('head', 19);
    var L = D.LOOKS || { skin: [0, 1, 2, 3, 4, 5], hair: [0, 1, 2, 3] };
    return { look: { skin: h % L.skin.length, hair: (h >>> 6) % L.hair.length, shape: (h >>> 11) % 3 }, outfit: outfit };
  }

  function view(kind, o) {
    var T = root.THREE; o = o || {};
    if (!T || !BUILD[kind]) return null;
    var renderer; try { renderer = root.LasgidiGL ? root.LasgidiGL.make({ antialias: !o.lite, maxRatio: 1.75 }) : new T.WebGLRenderer({ antialias: !o.lite, alpha: false }); } catch (e) { return null; } if (!renderer) return null;
    if (o.lite || (root.LasgidiGL && root.LasgidiGL.lite())) o.lite = true;
    if (!root.LasgidiGL) renderer.setPixelRatio(Math.min(o.lite ? 1 : 1.75, root.devicePixelRatio || 1)); renderer.toneMapping = T.ACESFilmicToneMapping; renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = !o.lite; renderer.shadowMap.type = T.PCFSoftShadowMap;
    var gl = renderer.domElement; gl.className = 'g3d-gl'; gl.setAttribute('aria-hidden', 'true');
    var scene = new T.Scene(), cam = new T.PerspectiveCamera(50, 1, 0.1, 400), ray = new T.Raycaster(), stack = null, hud = null, raf = 0, dead = false, t0 = performance.now(), lastT = 0, lastSt = null, lastG = null, W = 0, H = 0;
    var K = kit(T, scene, o);
    var B = BUILD[kind](T, scene, cam, K, o);
    function sizeTo(w, h) { w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); if (w === W && h === H) return; W = w; H = h; renderer.setSize(W, H, false); gl.style.width = W + 'px'; gl.style.height = H + 'px'; cam.aspect = W / H; cam.updateProjectionMatrix(); }
    function render(st, g) {
      if (dead || !st) return;
      var now = (performance.now() - t0) / 1000, dt = Math.min(0.1, Math.max(0, now - lastT)); lastT = now;
      if (hud) sizeTo(hud.clientWidth || (g && g.W) || 360, hud.clientHeight || (g && g.H) || 480);
      else if (stack) sizeTo(stack.clientWidth || 360, stack.clientHeight || 240);
      B.update(st, g || {}, now, dt);
      if (root.LasgidiGL) { if (!root.LasgidiGL.live(gl)) return; root.LasgidiGL.pace(renderer); }
      renderer.render(scene, cam);
    }
    var api = {
      kind: kind,
      // canvas: the game's own 2D canvas (kept on top for the HUD); for the quiz, no canvas and a studio above the card.
      mount: function (canvas, wrap) {
        stack = document.createElement('div'); stack.className = 'g3d-stack g3d-' + kind;
        if (canvas) { hud = canvas; canvas.classList.add('g3d-hud'); canvas.parentNode ? canvas.parentNode.insertBefore(stack, canvas) : wrap.insertBefore(stack, wrap.firstChild); stack.appendChild(gl); stack.appendChild(canvas); }
        else { stack.appendChild(gl); wrap.insertBefore(stack, wrap.firstChild); var loop = function () { raf = 0; if (dead) return; if (!stack.isConnected && lastT > 2) { api.dispose(); return; } render(lastSt, lastG); raf = root.requestAnimationFrame(loop); }; raf = root.requestAnimationFrame(loop); }
      },
      frame: function (st, g) { lastSt = st; lastG = g; if (hud) render(st, g); },
      // A tap (client coordinates) as game coordinates, from where it meets the 3D ground; null if it misses.
      pick: function (cx, cy) {
        if (!B.pick || dead) return null;
        var r = gl.getBoundingClientRect(); if (!r.width) return null;
        ray.setFromCamera(new T.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), cam);
        var p = new T.Vector3(); if (!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -B.pick.y), p)) return null;
        return B.pick.toGame(p, lastG || {});
      },
      dispose: function () { if (dead) return; dead = true; if (raf) root.cancelAnimationFrame(raf); raf = 0; scene.traverse(function (x) { if (x.geometry) x.geometry.dispose(); }); if (root.LasgidiGL) root.LasgidiGL.free(renderer); else { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); } },
      scene: scene, camera: cam
    };
    return api;
  }

  /* ---------- shared helpers ---------- */
  function kit(T, scene, o) {
    var K = {};
    K.M = function (c, r, m, x) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: r == null ? 0.7 : r, metalness: m || 0 }, x || {})); };
    K.box = function (p, w, h, d, m, x, y, z) { var b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x || 0, y || 0, z || 0); b.castShadow = b.receiveShadow = true; p.add(b); return b; };
    K.cyl = function (p, rt, rb, h, m, x, y, z, seg) { var c = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 14), m); c.position.set(x || 0, y || 0, z || 0); c.castShadow = c.receiveShadow = true; p.add(c); return c; };
    K.ball = function (p, r, m, x, y, z) { var s = new T.Mesh(new T.SphereGeometry(r, 14, 10), m); s.position.set(x || 0, y || 0, z || 0); s.castShadow = true; p.add(s); return s; };
    K.tex = function (w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
    var SPR = {};
    // A text or emoji label that always faces the camera; cached by its look.
    K.label = function (text, bg, fg, h, round) {
      var key = text + '|' + bg + '|' + fg, tx = SPR[key];
      if (!tx) {
        var probe = document.createElement('canvas').getContext('2d'); probe.font = '700 44px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        var w = Math.max(64, Math.ceil(probe.measureText(text).width) + 36);
        tx = SPR[key] = K.tex(w, 64, function (g, ww, hh) { if (bg) { g.fillStyle = bg; var r = round ? 32 : 14; g.beginPath(); g.moveTo(r, 0); g.arcTo(ww, 0, ww, hh, r); g.arcTo(ww, hh, 0, hh, r); g.arcTo(0, hh, 0, 0, r); g.arcTo(0, 0, ww, 0, r); g.fill(); } g.fillStyle = fg || '#fff'; g.font = probe.font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, ww / 2, hh / 2 + 2); });
        tx.userData = { aspect: w / 64 };
      }
      var s = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: false, transparent: true })); s.renderOrder = 10; h = h || 0.6; s.scale.set(h * tx.userData.aspect, h, 1); return s;
    };
    K.lights = function (sky, hemiSky, hemiGround, sunCol, sunI, pos) {
      scene.background = new T.Color(sky);
      scene.add(new T.HemisphereLight(hemiSky, hemiGround, 0.9));
      var sun = new T.DirectionalLight(sunCol, sunI); sun.position.set(pos[0], pos[1], pos[2]); sun.castShadow = true; sun.shadow.mapSize.set(o.lite ? 512 : 1024, o.lite ? 512 : 1024);
      var c = sun.shadow.camera; c.left = c.bottom = -16; c.right = c.top = 16; c.near = 1; c.far = 80; scene.add(sun); scene.add(sun.target); return sun;
    };
    // A person: the 3D avatar (from a look and outfit) or a simple figure if the avatar module is missing.
    K.person = function (d, key, ix) {
      var A = root.LasgidiAvatar3D, s = d || stranger(key || 'guest', ix || 0);
      if (A) { var f = A.figure(T, s.look, s.outfit, s.extra || null); f.traverse(function (x) { x.castShadow = true; }); return f; }
      var g = new T.Group(); K.cyl(g, 0.22, 0.28, 1.1, K.M([0xc0392b, 0x2f6fa0, 0xf2b600, 0x6b3fa0][ix % 4]), 0, 0.85, 0); K.ball(g, 0.18, K.M(0x8a5a3c), 0, 1.6, 0); g.userData.legs = []; g.userData.arms = []; return g;
    };
    // Swing a person's limbs: walk (amount ~0.5) or dance (arms up).
    K.move = function (p, t, amt, dance) {
      var u = p.userData, a = Math.sin(t) * amt;
      if (u.legs) u.legs.forEach(function (l, i) { l.rotation.x = i ? -a : a; });
      if (u.arms) u.arms.forEach(function (l, i) { l.rotation.x = dance ? -1.6 - Math.sin(t + i * Math.PI) * 0.7 : (i ? a : -a) * 0.8; });
    };
    K.lerpHex = function (a, b, k) { return new T.Color(a).lerp(new T.Color(b), Math.max(0, Math.min(1, k))); };
    // Objects tied to game objects (cars, notes, food): build once, hide when gone.
    K.pool = function (parent, make) {
      var map = new Map();
      return {
        sync: function (list, place) {
          var seen = new Set();
          list.forEach(function (it, i) { var m = map.get(it); if (!m) { m = make(it, i); parent.add(m); map.set(it, m); } seen.add(it); m.visible = true; place(m, it, i); });
          map.forEach(function (m, it) { if (!seen.has(it)) { parent.remove(m); map.delete(it); } });
        },
        map: map
      };
    };
    K.winTex = K.tex(32, 64, function (g, w, h) { g.fillStyle = '#e7dccb'; g.fillRect(0, 0, w, h); for (var y = 4; y < h - 4; y += 10) for (var x = 3; x < w - 3; x += 9) { g.fillStyle = (x * y) % 7 ? '#3d5566' : '#8fb2c4'; g.fillRect(x, y, 5, 6); } });
    K.palm = function (p, x, z, h) {
      var g = new T.Group(); g.position.set(x, 0, z); p.add(g); h = h || 3.4;
      var tr = K.cyl(g, 0.1, 0.16, h, K.M(0x7a5a3a, 0.9), 0, h / 2, 0, 7); tr.rotation.z = 0.06;
      for (var f = 0; f < 7; f++) { var fr = new T.Mesh(new T.ConeGeometry(0.22, 1.9, 4), K.M(0x2f7d32, 0.8)); fr.position.set(Math.cos(f * 0.9) * 0.7, h - 0.1, Math.sin(f * 0.9) * 0.7); fr.rotation.set(Math.sin(f * 0.9) * 1.3, 0, -Math.cos(f * 0.9) * 1.3); fr.castShadow = true; g.add(fr); }
      return g;
    };
    K.car = function (col, long, opts) {
      opts = opts || {}; var g = new T.Group(), body = K.M(col, 0.35, 0.35), glass = K.M(0x22343f, 0.08, 0.7);
      long = long || 2; var wid = opts.wide || long * 0.5, ht = opts.tall ? 1.05 : 0.5;
      K.box(g, wid, ht, long, body, 0, 0.25 + ht / 2, 0);
      if (opts.tall) { K.box(g, wid + 0.02, 0.32, long * 0.86, glass, 0, 0.25 + ht * 0.72, 0); }
      else { K.box(g, wid * 0.86, 0.36, long * 0.5, body, 0, 0.25 + ht + 0.18, long * 0.05); K.box(g, wid * 0.88, 0.3, long * 0.46, glass, 0, 0.25 + ht + 0.18, long * 0.05); }
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { var w = K.cyl(g, 0.2, 0.2, 0.16, K.M(0x111111, 0.9), q[0] * wid / 2, 0.22, q[1] * long * 0.32, 12); w.rotation.z = Math.PI / 2; });
      var tl = K.M(0x550000, 0.4, 0, { emissive: 0xff2a1a, emissiveIntensity: 0.15 });
      K.box(g, 0.22, 0.1, 0.04, tl, -wid / 2 + 0.16, 0.25 + ht * 0.7, long / 2 + 0.01); K.box(g, 0.22, 0.1, 0.04, tl, wid / 2 - 0.16, 0.25 + ht * 0.7, long / 2 + 0.01);
      K.box(g, 0.2, 0.1, 0.04, K.M(0xfff7d6, 0.3, 0, { emissive: 0xfff3c0, emissiveIntensity: 0.4 }), -wid / 2 + 0.16, 0.25 + ht * 0.6, -long / 2 - 0.01).position.x = -wid / 2 + 0.16;
      g.userData.tail = tl; return g;
    };
    K.stranger = stranger;
    return K;
  }

  var BUILD = {};

  /* ---------- Danfo Run ---------- */
  BUILD.danfo = function (T, scene, cam, K, o) {
    var S = 30, sky = 0xbcd9ea; K.lights(sky, 0xfff3e0, 0x5d6b4c, 0xfff1d6, 1.6, [-8, 18, 6]); scene.fog = new T.Fog(sky, 15, 34);
    var world = new T.Group(); scene.add(world);
    var ground = new T.Mesh(new T.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), K.M(0x6f7a52, 0.95)); ground.position.z = -20; ground.receiveShadow = true; world.add(ground);
    var road = null, kerbs = [], dashes = [], blocks = [], stuff = new T.Group(); world.add(stuff);
    var built = false, geo = null;
    function build(g) {
      geo = { rl: (g.roadL - g.W / 2) / S, rw: g.roadW / S };
      road = new T.Mesh(new T.PlaneGeometry(geo.rw, 80).rotateX(-Math.PI / 2), K.M(0x3b3d42, 0.9)); road.position.set(geo.rl + geo.rw / 2, 0.01, -20); road.receiveShadow = true; world.add(road);
      [geo.rl - 0.3, geo.rl + geo.rw + 0.3].forEach(function (x) { var k = K.box(world, 0.6, 0.18, 80, K.M(0xa49c8c, 0.9), x, 0.09, -20); kerbs.push(k); });
      for (var l = 1; l < g.lanes; l++) for (var i = 0; i < 22; i++) { var d = K.box(world, 0.09, 0.02, 0.75, K.M(0xf1f1ea, 0.6), geo.rl + geo.rw * l / g.lanes, 0.025, 0); d.castShadow = false; dashes.push({ m: d, i: i }); }
      // Buildings, shops, palms and lamps on both sides; they stream past as you drive.
      var cols = [0xd9822b, 0xc9ccd2, 0xf2e6c9, 0x6b3fa0, 0x2f6fa0, 0xc0392b, 0x2fa36b, 0xf2b600];
      for (var b = 0; b < 16; b++) {
        var side = b % 2 ? 1 : -1, grp = new T.Group(), h = 1.8 + (b * 7 % 5) * 0.9, w = 2.6, x = side < 0 ? geo.rl - 1.2 - w / 2 : geo.rl + geo.rw + 1.2 + w / 2;
        K.box(grp, w, h, 3, K.M(0xffffff, 0.7, 0, { map: K.winTex, color: cols[b % cols.length] }), x, h / 2, 0);
        K.box(grp, w + 0.2, 0.15, 3.2, K.M(0x8a7a66), x, h + 0.07, 0);
        if (b % 3 === 0) { var aw = K.box(grp, 0.12, 0.08, 2.4, K.M([0xc0392b, 0x2f6fa0, 0x2fa36b][b % 3]), x - side * (w / 2 + 0.4), 1.25, 0); aw.scale.x = 8; }
        if (b % 2 === 0) K.palm(grp, side < 0 ? geo.rl - 0.75 : geo.rl + geo.rw + 0.75, 1.6, 2.6 + (b % 3) * 0.4);
        else { var lp = K.cyl(grp, 0.04, 0.05, 2.8, K.M(0x2b2f36), side < 0 ? geo.rl - 0.65 : geo.rl + geo.rw + 0.65, 1.4, 1.2, 6); K.box(grp, 0.5, 0.06, 0.12, K.M(0x2b2f36), lp.position.x - side * 0.25, 2.8, 1.2); }
        world.add(grp); blocks.push({ g: grp, i: Math.floor(b / 2) });
      }
      built = true;
    }
    // The danfo: yellow, black stripes, open side door, conductor hanging out.
    var bus = new T.Group(); world.add(bus);
    (function () {
      var yel = K.M(0xf2b600, 0.35, 0.25), blk = K.M(0x17181a, 0.5), glass = K.M(0x1f2f3a, 0.05, 0.75);
      K.box(bus, 1.5, 1.35, 3.6, yel, 0, 1.0, 0); K.box(bus, 1.52, 0.12, 3.62, blk, 0, 0.95, 0); K.box(bus, 1.52, 0.12, 3.62, blk, 0, 1.25, 0);
      K.box(bus, 1.38, 0.4, 0.5, yel, 0, 1.3, -1.95); K.box(bus, 1.36, 0.42, 0.06, glass, 0, 1.5, -2.2).rotation.x = -0.35;
      K.box(bus, 1.54, 0.38, 2.9, glass, 0, 1.48, 0.15); K.box(bus, 1.4, 0.06, 3.3, K.M(0x9a9a9a, 0.6, 0.5), 0, 1.72, 0);
      [[-0.75, -1.25], [0.75, -1.25], [-0.75, 1.25], [0.75, 1.25]].forEach(function (q) { var w = K.cyl(bus, 0.3, 0.3, 0.22, K.M(0x111111, 0.9), q[0], 0.32, q[1], 14); w.rotation.z = Math.PI / 2; });
      var tl = K.M(0x550000, 0.4, 0, { emissive: 0xff2a1a, emissiveIntensity: 0.2 }); K.box(bus, 0.26, 0.16, 0.04, tl, -0.55, 0.8, 1.81); K.box(bus, 0.26, 0.16, 0.04, tl, 0.55, 0.8, 1.81); bus.userData.tail = tl;
      var cond = K.person(null, 'conductor', 3); cond.scale.setScalar(0.62); cond.position.set(-0.85, 0.35, 0.4); cond.rotation.y = -Math.PI / 2; bus.add(cond); bus.userData.cond = cond;
      var sign = K.label('OJUELEGBA–YABA', '#17181a', '#f2b600', 0.32); sign.position.set(0, 2.05, -1.2); bus.add(sign);
    })();
    var X = function (px, g) { return (px - g.W / 2) / S; }, Z = function (py, g) { return (py - g.busY) / S; };
    var pool = K.pool(stuff, function (it, i) {
      var g = new T.Group();
      if (it.k === 'stop') {
        var post = K.M(0x2fa36b, 0.5), roof = K.M(0x1d7a43, 0.4);
        K.cyl(g, 0.05, 0.05, 2.1, post, -0.6, 1.05, -0.8, 6); K.cyl(g, 0.05, 0.05, 2.1, post, -0.6, 1.05, 0.8, 6); K.box(g, 1.3, 0.1, 2.2, roof, -0.9, 2.15, 0); K.box(g, 0.06, 1.0, 2.0, K.M(0xcfe8d6, 0.2, 0, { transparent: true, opacity: 0.5 }), -1.5, 1.2, 0);
        var lb = K.label('🚏 ' + it.name, '#1d7a43', '#fff', 0.42); lb.position.set(-0.9, 2.65, 0); g.add(lb);
        g.userData.people = [];
        for (var p = 0; p < Math.min(6, it.wait); p++) { var per = K.person(null, 'stop' + it.idx, p); per.scale.setScalar(0.6); per.position.set(-1.1 - (p % 2) * 0.5, 0.18, -0.9 + p * 0.38); per.rotation.y = Math.PI / 2; g.add(per); g.userData.people.push(per); }
      } else if (it.k === 'lastma') {
        var zone = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xf2b600, transparent: true, opacity: 0.45, depthWrite: false })); zone.position.y = 0.03; g.add(zone); g.userData.zone = zone;
        var off = K.person({ look: { skin: 3, hair: 0, shape: 1 }, outfit: { top: firstOf('top', /yellow|polo|tee/i), bottom: firstOf('bottom', /trouser|khaki|jean/i), head: firstOf('head', /cap/i) } }, 'lastma', 0); off.scale.setScalar(0.62); off.position.set(-0.25, 0.18, 0); off.rotation.y = Math.PI / 2; g.add(off); g.userData.off = off;
        var lt = K.label('LASTMA · NO STOPPING', '#f2b600', '#17181a', 0.32); g.add(lt); g.userData.lt = lt;
      } else if (it.k === 'hole') {
        var h = K.cyl(g, 0.55, 0.45, 0.04, K.M(0x141516, 1), 0, 0.02, 0, 16); h.scale.z = 0.6; h.castShadow = false; var w = K.cyl(g, 0.4, 0.4, 0.02, K.M(0x3a4f5a, 0.05, 0.3), 0, 0.04, 0.05, 14); w.scale.z = 0.5;
      } else if (it.k === 'okada') {
        K.box(g, 0.22, 0.4, 1.1, K.M(0xc0392b, 0.4, 0.3), 0, 0.55, 0); [-0.45, 0.45].forEach(function (z) { var wh = new T.Mesh(new T.TorusGeometry(0.24, 0.07, 8, 14), K.M(0x111111)); wh.rotation.y = Math.PI / 2; wh.position.set(0, 0.3, z); g.add(wh); });
        var r = K.person(null, 'okada', i); r.scale.setScalar(0.55); r.position.set(0, 0.45, 0.05); g.add(r); var hel = K.ball(g, 0.13, K.M(0xf2b600, 0.3), 0, 1.38, 0.05); hel.scale.y = 0.85;
      } else if (it.k === 'car') {
        var c = K.car(new T.Color(it.col).getHex(), 2.4); g.add(c);
      }
      return g;
    });
    function firstOf(slot, re) { var C = D.CLOTHES || {}, ids = Object.keys(C).filter(function (k) { return C[k].slot === slot; }); return ids.filter(function (k) { return re.test(k + ' ' + (C[k].name || '')); })[0] || ids[0]; }
    var dist = 0;
    return {
      update: function (st, g, t, dt) {
        if (!built) build(g);
        dist = st.dist / S;
        var len = 22 * 1.47; dashes.forEach(function (d) { var z = ((d.i * 1.47 + dist) % len); d.m.position.z = z - len + 6; });
        var blen = 8 * 4.2; blocks.forEach(function (b) { b.g.position.z = ((b.i * 4.2 + dist * 0.9) % blen) - blen + 6; });
        pool.sync(st.things, function (m, it) {
          m.position.z = Z(it.y, g);
          if (it.k === 'stop') { m.position.x = geo.rl - 0.05; m.userData.people.forEach(function (p, i) { p.visible = !it.done; K.move(p, t * 3 + i, 0.08, false); }); }
          else if (it.k === 'lastma') { var lw = g.roadW / g.lanes / S; m.position.x = geo.rl + lw / 2; m.userData.zone.scale.set(lw, 1, it.len / S); m.userData.zone.position.z = -it.len / S / 2; m.userData.off.position.set(-lw / 2 - 0.45, 0.18, -it.len / S / 2); m.userData.lt.position.set(0, 1.4, -it.len / S / 2); K.move(m.userData.off, t * 4, 0.1, false); m.userData.zone.material.opacity = it.hit ? 0.2 : 0.45; }
          else if (it.k === 'okada') { m.position.x = X(it.fx, g); m.rotation.y = it.dir * 0.35; }
          else { m.position.x = X(g.laneX(it.lane), g); }
        });
        var bx = X(g.laneX(st.x), g); bus.position.set(bx, Math.abs(Math.sin(t * 11)) * 0.02 * (st.speed > 10 ? 1 : 0), 0); bus.rotation.y = (st.lane - st.x) * -0.25;
        bus.userData.tail.emissiveIntensity = g.brake ? 2.5 : 0.2;
        K.move(bus.userData.cond, t * 5, 0.25, false);
        var sh = st.shake > 0 && !g.reduce ? st.shake : 0;
        cam.position.set(bx * 0.5 + (Math.random() - 0.5) * sh * 0.4, 6.6 + (Math.random() - 0.5) * sh * 0.3, 8.6);
        cam.lookAt(bx * 0.65, 0.2, -6);
      }
    };
  };

  /* ---------- Owambe dance-off ---------- */
  BUILD.dance = function (T, scene, cam, K, o) {
    K.lights(0x1a0b24, 0x9a6bd0, 0x2a1030, 0xffe0f0, 0.7, [4, 14, 8]); scene.fog = new T.Fog(0x1a0b24, 16, 34);
    var SP = 1.05, LEN = 16, colors = ['#c0392b', '#2f6fa0', '#2fa36b', '#f2b600'];
    var floor = new T.Mesh(new T.PlaneGeometry(30, 40).rotateX(-Math.PI / 2), K.M(0x1d1424, 0.25, 0.4)); floor.position.z = -8; floor.receiveShadow = true; scene.add(floor);
    var lanes = [], rings = [], noteMat = [], ICON = ['◀', '▼', '▲', '▶'];
    for (var l = 0; l < 4; l++) {
      var x = (l - 1.5) * SP, c = new T.Color(colors[l]);
      var strip = new T.Mesh(new T.PlaneGeometry(SP * 0.86, LEN + 2).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0x120c18, emissive: c, emissiveIntensity: 0.18, roughness: 0.4 })); strip.position.set(x, 0.01, -LEN / 2 + 1); scene.add(strip); lanes.push(strip);
      var ring = new T.Mesh(new T.TorusGeometry(0.34, 0.05, 8, 28).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.8 })); ring.position.set(x, 0.05, 0); scene.add(ring); rings.push(ring);
      var top = K.tex(128, 128, (function (k) { return function (g, w, h) { g.fillStyle = colors[k]; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = '900 70px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ICON[k], 64, 68); }; })(l));
      noteMat.push([new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.3 }), new T.MeshStandardMaterial({ map: top, emissive: c, emissiveIntensity: 0.25, emissiveMap: top }), new T.MeshStandardMaterial({ color: c })]);
    }
    var hitLine = new T.Mesh(new T.PlaneGeometry(SP * 4.2, 0.06).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffffff })); hitLine.position.set(0, 0.04, 0); scene.add(hitLine);
    // The stage: a raised platform, a flower-and-light backdrop, speakers, the DJ, you, and guests.
    var stage = new T.Group(); stage.position.z = -LEN - 1.5; scene.add(stage);
    K.box(stage, 9, 0.5, 4, K.M(0xe8dcc8, 0.6), 0, 0.25, 0);
    var back = K.tex(512, 256, function (g, w, h) { var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5a1f6b'); gr.addColorStop(1, '#c0392b'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (var i = 0; i < 160; i++) { g.fillStyle = ['#f2b600', '#ffffff', '#ff7ab8'][i % 3]; g.beginPath(); g.arc((i * 61) % w, (i * 37) % h, 3 + i % 4, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#fff'; g.font = '900 54px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('OWAMBE', w / 2, h / 2 + 18); });
    var bk = new T.Mesh(new T.PlaneGeometry(10, 5), new T.MeshStandardMaterial({ map: back, emissive: 0xffffff, emissiveMap: back, emissiveIntensity: 0.35 })); bk.position.set(0, 2.9, -2); stage.add(bk);
    [-4, 4].forEach(function (x) { K.box(stage, 0.9, 1.8, 0.8, K.M(0x111111, 0.6), x, 1.4, -0.8); K.cyl(stage, 0.28, 0.28, 0.05, K.M(0x333333, 0.3, 0.6), x, 1.6, -0.38).rotation.x = Math.PI / 2; });
    K.box(stage, 1.8, 0.9, 0.8, K.M(0x222a36, 0.4, 0.4), 2.4, 0.95, -1.2); var dj = K.person(null, 'dj', 2); dj.position.set(2.4, 0.5, -1.8); stage.add(dj); var djl = K.label('DJ TIDEWAVE', '#17181a', '#f2b600', 0.32); djl.position.set(2.4, 2.7, -1.6); stage.add(djl);
    var me = K.person(o.look ? { look: o.look, outfit: o.outfit || {} } : null, 'me', 0); me.position.set(0, 0.5, 0.6); stage.add(me);
    var crowd = [];
    for (var c = 0; c < 10; c++) { var side = c % 2 ? 1 : -1, p = K.person(null, 'owambe', c); p.position.set(side * (3.2 + (c >> 1) % 3 * 0.9), 0, -LEN + 2.2 + (c >> 1) * 1.6); p.rotation.y = -side * 0.8; scene.add(p); crowd.push(p); }
    var lights = [0xf2b600, 0xd0453a, 0x2fa36b, 0x8a5cff].map(function (col, i) { var pl = new T.PointLight(col, 18, 14, 1.6); pl.position.set((i - 1.5) * 3, 4, -LEN + 1); scene.add(pl); return pl; });
    var cashMat = new T.MeshStandardMaterial({ map: K.tex(128, 64, function (g, w, h) { g.fillStyle = '#7fbf6a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1b5e20'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#1b5e20'; g.font = '900 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₦1000', w / 2, h / 2); }), side: T.DoubleSide, roughness: 0.6 });
    var notes = new T.Group(); scene.add(notes);
    var noteGeo = new T.CylinderGeometry(0.34, 0.34, 0.16, 24);
    var npool = K.pool(notes, function (n) { var m = new T.Mesh(noteGeo, noteMat[n.lane]); m.castShadow = true; return m; });
    var cash = new T.Group(); scene.add(cash);
    var cpool = K.pool(cash, function () { return new T.Mesh(new T.PlaneGeometry(0.5, 0.25), cashMat); });
    cam.position.set(0, 3.8, 5.2); cam.lookAt(0, 0.1, -6.6);
    return {
      update: function (st, g, t) {
        var beat = g.beat || 0.536, ph = st.t / beat, pulse = g.reduce ? 0.5 : 0.5 + 0.5 * Math.cos(ph * Math.PI * 2);
        var live = st.notes.filter(function (n) { return !n.hit && !n.gone && n.t - st.t < (g.fall || 1.6) * 1.05 && n.t - st.t > -0.25; });
        npool.sync(live, function (m, n) { var k = (n.t - st.t) / (g.fall || 1.6); m.position.set((n.lane - 1.5) * SP, 0.16, -k * LEN); var near = Math.abs(n.t - st.t) < 0.12; m.scale.setScalar(near ? 1.15 : 1); });
        for (var l = 0; l < 4; l++) { var f = st.flash[l] > 0; lanes[l].material.emissiveIntensity = f ? 0.9 : 0.12 + 0.12 * pulse; rings[l].scale.setScalar(f ? 1.25 : 1); rings[l].material.emissiveIntensity = f ? 2.2 : 0.8; }
        lights.forEach(function (pl, i) { pl.intensity = 10 + 18 * (g.reduce ? 0.5 : 0.5 + 0.5 * Math.cos((ph + i * 0.5) * Math.PI)); });
        var hype = Math.min(1, st.combo / 10);
        K.move(me, ph * Math.PI, 0.35 + hype * 0.3, st.combo >= 5); me.position.y = 0.5 + Math.abs(Math.sin(ph * Math.PI)) * 0.08 * (g.reduce ? 0 : 1); me.rotation.y = Math.sin(ph * Math.PI * 0.5) * 0.4;
        K.move(dj, ph * Math.PI, 0.1, false);
        crowd.forEach(function (p, i) { K.move(p, ph * Math.PI + i, 0.3, st.combo >= 10 && i % 2 === 0); p.position.y = Math.abs(Math.sin(ph * Math.PI + i)) * 0.06; });
        // Spraying: the notes the game drops (x and fall) rain around you on the stage.
        cpool.sync(st.cash, function (m, c) { var k = Math.min(1, Math.max(0, (c.y + 100) / ((g.H || 520) + 130))); m.position.set((c.x / (g.W || 360) - 0.5) * 6, 5.5 - k * 5.2, -LEN - 0.4 + (c.x * 7 % 2)); m.rotation.set(c.r, c.r * 0.7, c.r * 0.3); });
      }
    };
  };

  /* ---------- Go-slow hawker ---------- */
  BUILD.hawk = function (T, scene, cam, K, o) {
    var S = 30; K.lights(0xd6c9a8, 0xfff0d6, 0x5a5448, 0xffe6bf, 1.5, [6, 16, 8]); scene.fog = new T.Fog(0xd6c9a8, 24, 50);
    var world = new T.Group(), built = false, rowZ = [], zTop = 0, zBot = 0, half = 6; scene.add(world);
    var cars = new T.Group(), fx = new T.Group(); world.add(cars); world.add(fx);
    var light = {}, me = null, shelter = null, van = null, pops = new T.Group(); world.add(pops);
    var X = function (px, g) { return (px - g.W / 2) / S; }, Z = function (py, g) { return (py - g.H / 2) / S; };
    function build(g) {
      half = g.W / 2 / S + 3; zTop = Z(60, g); zBot = Z(g.H - 40, g);
      var road = new T.Mesh(new T.PlaneGeometry(half * 2 + 20, zBot - zTop).rotateX(-Math.PI / 2), K.M(0x3c3e43, 0.9)); road.position.set(0, 0.01, (zTop + zBot) / 2); road.receiveShadow = true; world.add(road);
      K.box(world, half * 2 + 20, 0.2, 3, K.M(0xa49c8c, 0.9), 0, 0.1, zTop - 1.5); K.box(world, half * 2 + 20, 0.2, 4, K.M(0xa49c8c, 0.9), 0, 0.1, zBot + 2);
      for (var r = 1; r < g.rows; r++) { var lz = Z((g.rowY(r - 1) + g.rowY(r)) / 2, g); for (var i = -12; i < 12; i++) { var d = K.box(world, 0.6, 0.02, 0.07, K.M(0xf1f1ea, 0.6), i * 1.1, 0.02, lz); d.castShadow = false; } }
      for (var rr = 0; rr < g.rows; rr++) rowZ.push(Z(g.rowY(rr), g));
      // The Oshodi bridge overhead, its pillars, and the market behind.
      var conc = K.M(0x9c968a, 0.9);
      K.box(world, half * 2 + 20, 0.9, 2.4, conc, 0, 6.2, zTop - 2.2); [-8, -3, 2, 7].forEach(function (x) { K.box(world, 0.8, 6, 0.8, conc, x, 3, zTop - 2.2); });
      var sign = K.label('OSHODI · UNDER BRIDGE', '#1d7a43', '#fff', 0.5); sign.position.set(-2, 5.3, zTop - 0.9); world.add(sign);
      for (var s = 0; s < 9; s++) { var umb = new T.Group(), ux = -10 + s * 2.6; K.cyl(umb, 0.03, 0.03, 1.6, K.M(0x444444), ux, 0.8, zTop - 4.2, 5); var cn = new T.Mesh(new T.ConeGeometry(1.1, 0.5, 10), K.M([0xc0392b, 0xf2b600, 0x2f6fa0, 0x2fa36b][s % 4], 0.6)); cn.position.set(ux, 1.7, zTop - 4.2); cn.castShadow = true; umb.add(cn); K.box(umb, 1.2, 0.6, 0.8, K.M(0x8a6a4a), ux, 0.3, zTop - 4.2); world.add(umb); }
      // The traffic light at the top right.
      var tp = new T.Group(); tp.position.set(X(g.W - 27, g), 0, zTop - 0.6); world.add(tp); K.cyl(tp, 0.06, 0.06, 3, K.M(0x2b2f36), 0, 1.5, 0, 6); K.box(tp, 0.4, 1.0, 0.3, K.M(0x17181a), 0, 3.2, 0);
      light.red = K.ball(tp, 0.12, new T.MeshStandardMaterial({ color: 0x4a1512, emissive: 0xff3b30, emissiveIntensity: 0 }), 0, 3.45, 0.17); light.green = K.ball(tp, 0.12, new T.MeshStandardMaterial({ color: 0x123a1d, emissive: 0x34c759, emissiveIntensity: 0 }), 0, 2.95, 0.17);
      // You: a hawker with your tray on your head, on the kerb by a bus-stop shelter.
      me = K.person(o.look ? { look: o.look, outfit: o.outfit || {} } : null, 'hawker', 1); me.position.set(0, 0.2, zBot + 1.0); world.add(me);
      var tray = new T.Group(); K.cyl(tray, 0.45, 0.4, 0.08, K.M(0xb0b6bc, 0.3, 0.6), 0, 0, 0, 18); [[0x9ad4f0, -0.18, 0], [0xd9822b, 0.15, 0.1], [0x2f6fa0, 0.05, -0.18], [0xe8c35a, -0.05, 0.2]].forEach(function (q) { K.box(tray, 0.16, 0.12, 0.16, K.M(q[0], 0.5), q[1], 0.1, q[2]); }); tray.position.set(0, 1.98, 0); me.add(tray);
      shelter = new T.Group(); shelter.position.set(2.6, 0.2, zBot + 1.4); world.add(shelter); K.box(shelter, 2, 0.08, 1, K.M(0x1d7a43), 0, 2.1, 0); K.box(shelter, 2, 1.6, 0.06, K.M(0x9fd0b4, 0.2, 0, { transparent: true, opacity: 0.55 }), 0, 1.1, -0.45); K.cyl(shelter, 0.04, 0.04, 2.1, K.M(0x1d7a43), -0.95, 1.05, 0.45, 6); K.cyl(shelter, 0.04, 0.04, 2.1, K.M(0x1d7a43), 0.95, 1.05, 0.45, 6);
      // The task force van.
      van = new T.Group(); K.box(van, 3.2, 1.3, 1.4, K.M(0xf4f3ec, 0.4, 0.2), 0, 0.9, 0); K.box(van, 3.22, 0.2, 1.42, K.M(0xc0392b), 0, 0.85, 0); K.box(van, 0.8, 0.5, 1.3, K.M(0x22343f, 0.08, 0.7), 1.2, 1.35, 0);
      [-1.1, 1.1].forEach(function (x) { [-0.7, 0.7].forEach(function (z) { var w = K.cyl(van, 0.26, 0.26, 0.2, K.M(0x111111), x, 0.26, z, 12); w.rotation.x = Math.PI / 2; }); });
      var bar = K.box(van, 0.5, 0.12, 0.3, new T.MeshStandardMaterial({ color: 0x1030aa, emissive: 0x2050ff, emissiveIntensity: 1 }), 0.2, 1.62, 0); van.userData.bar = bar; var vl = K.label('TASK FORCE', '#c0392b', '#fff', 0.36); vl.position.set(0, 2.1, 0); van.add(vl); van.visible = false; world.add(van);
      built = true;
    }
    var pool = K.pool(cars, function (c) {
      var g = new T.Group(), body = c.danfo ? K.car(0xf2b600, 2.0, { tall: true, wide: 1.05 }) : K.car(new T.Color(c.col).getHex(), 2.0);
      body.rotation.y = -Math.PI / 2; g.add(body);
      if (c.danfo) { var st = K.box(g, 2.02, 0.1, 1.07, K.M(0x17181a), 0, 0.8, 0); st.castShadow = false; }
      var drv = K.person(null, 'driver', Math.round(c.x * 7) & 15); drv.scale.setScalar(0.45); drv.position.set(0.25, 0.32, 0.2); drv.rotation.y = Math.PI / 2; g.add(drv);
      g.userData.bub = new T.Group(); g.add(g.userData.bub);
      var bar = new T.Mesh(new T.PlaneGeometry(1, 0.1), new T.MeshBasicMaterial({ color: 0x34c759, depthTest: false })); bar.renderOrder = 11; bar.position.y = -0.48; g.userData.bub.add(bar); g.userData.bar = bar; g.userData.bub.position.set(0, 2.1, 0);
      return g;
    });
    var popPool = K.pool(pops, function (p) { return K.label(p.text, null, '#7fe08a', 0.5); });
    cam.position.set(0, 13.5, 11.5); cam.lookAt(0, 0, 1.9);
    return {
      pick: { y: 0.6, toGame: function (p, g) { return { x: p.x * S + g.W / 2, y: p.z * S + g.H / 2 }; } },
      update: function (st, g, t) {
        if (!built) build(g);
        pool.sync(st.cars, function (m, c) {
          m.position.set(X(c.x + 31, g), 0, rowZ[c.row]);
          var b = m.userData.bub; b.visible = !!c.want;
          if (c.want) {
            if (b.userData.icon !== c.want.id) { if (b.userData.spr) b.remove(b.userData.spr); var sp = K.label(c.want.icon, '#ffffff', '#111', 0.62, true); b.add(sp); b.userData.spr = sp; b.userData.icon = c.want.id; }
            var k = Math.max(0, c.patience / 6); m.userData.bar.scale.x = Math.max(0.02, k); m.userData.bar.position.x = -(1 - k) / 2; m.userData.bar.material.color.setHex(c.patience < 1.5 ? 0xff3b30 : 0x34c759);
            b.position.y = 2.1 + Math.sin(t * 6) * 0.05;
          }
        });
        light.red.material.emissiveIntensity = st.light === 'red' ? 2.4 : 0; light.green.material.emissiveIntensity = st.light === 'green' ? 2.4 : 0;
        // You: walk to the car you're serving, crouch behind the shelter when hiding.
        var tx = st.hiding ? shelter.position.x - 0.1 : 0, tz = st.hiding ? shelter.position.z - 0.1 : zBot + 1.0;
        me.position.x += (tx - me.position.x) * 0.15; me.position.z += (tz - me.position.z) * 0.15; me.scale.y = st.hiding ? 0.7 : 1;
        K.move(me, t * 6, Math.abs(tx - me.position.x) > 0.05 ? 0.5 : 0.05, false);
        van.visible = !!st.van; if (st.van) { van.position.set(X(st.van.x + 50, g), 0.1, zBot + 2.6); van.userData.bar.material.emissive.setHex(Math.floor(t * 6) % 2 ? 0xff2020 : 0x2050ff); }
        popPool.sync(st.pops, function (m, p) { m.position.set(X(p.x, g), 2.6 + (0.8 - p.t) * 1.4, Z(p.y + 30, g)); m.material.opacity = Math.min(1, p.t * 2); });
      }
    };
  };

  /* ---------- Bole grill ---------- */
  BUILD.bole = function (T, scene, cam, K, o) {
    var S = 30; K.lights(0xe8b878, 0xffe6c4, 0x5a3f2b, 0xffd2a0, 1.3, [-6, 14, 8]); scene.fog = new T.Fog(0xe8b878, 20, 40);
    var world = new T.Group(); scene.add(world); var built = false, slots = [], coals = [], smoke = [], cust = new T.Group(), food = new T.Group(); world.add(cust); world.add(food);
    var X = function (px, g) { return (px - g.W / 2) / S; }, Z = function (py, g) { return (py - g.H * 0.5) / S; }, TOP = 0.95, pops = new T.Group(); world.add(pops);
    function build(g) {
      var ground = new T.Mesh(new T.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), K.M(0x8a7458, 1)); ground.receiveShadow = true; world.add(ground);
      var x0 = X(12, g), x1 = X(g.W - 12, g), z0 = Z(g.H * 0.45 - 50, g), z1 = Z(g.H * 0.45 + 150, g), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, gw = x1 - x0, gd = z1 - z0;
      // The drum grill on legs, its coal bed and the grate.
      K.box(world, gw + 0.3, 0.5, gd + 0.3, K.M(0x2a2b2e, 0.5, 0.6), cx, TOP - 0.3, cz);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { K.cyl(world, 0.06, 0.06, TOP - 0.5, K.M(0x2a2b2e, 0.5, 0.6), cx + q[0] * gw / 2, (TOP - 0.5) / 2, cz + q[1] * gd / 2, 6); });
      for (var c = 0; c < 46; c++) { var m = new T.MeshStandardMaterial({ color: 0x2a1408, emissive: 0xff5a10, emissiveIntensity: 0.6, roughness: 1 }), co = K.ball(world, 0.07 + (c % 3) * 0.02, m, x0 + 0.2 + (c * 0.618 % 1) * (gw - 0.4), TOP - 0.05, z0 + 0.2 + (c * 0.377 % 1) * (gd - 0.4)); co.castShadow = false; coals.push(co); }
      for (var b = 0; b <= 26; b++) { var bar = K.cyl(world, 0.02, 0.02, gd, K.M(0x7a7a7a, 0.4, 0.8), x0 + b * gw / 26, TOP + 0.02, cz, 5); bar.rotation.x = Math.PI / 2; bar.castShadow = false; }
      var glow = new T.PointLight(0xff7a2a, 6, 6, 1.5); glow.position.set(cx, TOP + 0.3, cz); world.add(glow); world.userData.glow = glow;
      for (var i = 0; i < g.slots; i++) { var p = g.slotXY(i), ring = new T.Mesh(new T.TorusGeometry(32 / S, 0.025, 6, 30).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })); ring.position.set(X(p.x, g), TOP + 0.05, Z(p.y, g)); world.add(ring); slots.push({ ring: ring, x: X(p.x, g), z: Z(p.y, g) }); }
      // The stall: an umbrella, a sign, the sauce bowl and plates, palm trees and the street behind the queue.
      var umb = new T.Mesh(new T.ConeGeometry(2.4, 0.8, 12, 1, true), K.M(0xc0392b, 0.7, 0, { side: T.DoubleSide })); umb.position.set(x1 + 1.2, 3.4, z0 - 2.6); umb.castShadow = true; world.add(umb); K.cyl(world, 0.05, 0.05, 3.3, K.M(0x555555), x1 + 1.2, 1.65, z0 - 2.6, 6);
      var sg = K.label('🍌 BOLE & FISH · OLD GRA', '#17181a', '#f2b600', 0.55); sg.position.set(cx, 3.3, z0 - 4.6); world.add(sg);
      K.cyl(world, 0.4, 0.3, 0.25, K.M(0xb03a1a, 0.4), x1 + 0.7, TOP - 0.1, cz - 0.6, 16); K.box(world, 1.6, TOP - 0.1, 2.4, K.M(0x7a5233, 0.8), x1 + 0.9, (TOP - 0.1) / 2, cz - 0.4); for (var pl = 0; pl < 5; pl++) K.cyl(world, 0.3, 0.26, 0.03, K.M(0xf4f3ec, 0.3), x1 + 0.8, TOP + pl * 0.035, cz + 0.6, 16);
      K.palm(world, X(-30, g), Z(30, g) - 4, 4); K.palm(world, X(g.W + 40, g), Z(20, g) - 5, 4.5);
      [-6, -2, 3, 7].forEach(function (x, k) { K.box(world, 3.4, 3 + k % 2, 2, K.M(0xffffff, 0.7, 0, { map: K.winTex, color: [0xd9822b, 0xf2e6c9, 0x2f6fa0, 0xc9ccd2][k] }), x, 1.6 + (k % 2) / 2, Z(48, g) - 6); });
      for (var s = 0; s < 10; s++) { var sm = new T.Sprite(new T.SpriteMaterial({ map: smokeTex(), transparent: true, opacity: 0.3, depthWrite: false })); sm.scale.set(1.2, 1.2, 1); world.add(sm); smoke.push({ s: sm, k: s / 10, x: x0 + (s * 0.37 % 1) * gw, z: cz + ((s * 0.71) % 1 - 0.5) * gd }); }
      built = true;
    }
    var SMK = null; function smokeTex() { return SMK || (SMK = K.tex(64, 64, function (g) { var gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(230,230,230,.9)'); gr.addColorStop(1, 'rgba(230,230,230,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); })); }
    var RAW = ['#e8d36a', '#b9b9b0', '#f1e6c8'], GOLDC = ['#d98a1c', '#b5651d', '#e0a040'], BURNT = '#2a1a10';
    function foodMesh(f) {
      var g = new T.Group(), m = K.M(RAW[f], 0.6);
      if (f === 0) { for (var k = -1; k <= 1; k++) { var pl = new T.Mesh(new T.CapsuleGeometry(0.14, 0.62, 4, 10), m); pl.rotation.z = Math.PI / 2; pl.rotation.y = 0.3 * k; pl.position.set(0, 0.12, k * 0.26); pl.castShadow = true; g.add(pl); } }
      else if (f === 1) { var bd = new T.Mesh(new T.SphereGeometry(0.42, 16, 10), m); bd.scale.set(1.4, 0.4, 0.6); bd.position.y = 0.14; bd.castShadow = true; g.add(bd); var tl = new T.Mesh(new T.ConeGeometry(0.22, 0.36, 4), m); tl.rotation.z = Math.PI / 2; tl.position.set(0.72, 0.14, 0); g.add(tl); var eye = K.ball(g, 0.04, K.M(0x111111), -0.44, 0.22, 0.12); eye.castShadow = false; }
      else { for (var y = 0; y < 3; y++) { var ch = K.box(g, 0.34, 0.2, 0.26, m, (y - 1) * 0.3, 0.12, (y % 2) * 0.12 - 0.06); ch.rotation.y = y * 0.5; } }
      g.userData.mat = m; return g;
    }
    var fpool = K.pool(food, function (s) { return foodMesh(s.f); });
    var cpool = K.pool(cust, function (c, i) {
      var g = new T.Group(), p = K.person(null, 'bole', Math.round(c.wait * 1000) & 31); g.add(p); g.userData.p = p;
      var b = new T.Group(); b.position.y = 2.3; g.add(b); var ic = K.label(['🍌', '🐟', '🍠'][c.f], '#ffffff', '#111', 0.6, true); b.add(ic);
      var bar = new T.Mesh(new T.PlaneGeometry(0.9, 0.09), new T.MeshBasicMaterial({ color: 0x34c759, depthTest: false })); bar.renderOrder = 11; bar.position.y = -0.45; b.add(bar); g.userData.bar = bar; g.userData.b = b;
      return g;
    });
    var popPool = K.pool(pops, function (p) { return K.label(p.text, null, '#7fe08a', 0.55); });
    cam.position.set(0, 9.6, 10.6); cam.lookAt(0, 0.4, -1.6);
    return {
      pick: { y: TOP + 0.1, toGame: function (p, g) { return { x: p.x * S + g.W / 2, y: p.z * S + g.H * 0.5 }; } },
      update: function (st, g, t) {
        if (!built) build(g);
        coals.forEach(function (c, i) { c.material.emissiveIntensity = 0.45 + 0.4 * Math.abs(Math.sin(t * 2.2 + i * 1.7)); }); world.userData.glow.intensity = 5 + Math.sin(t * 3) * 1.2;
        var list = [], at = [];
        st.slots.forEach(function (s, i) { if (s) { list.push(s); at.push(i); } });
        fpool.sync(list, function (m, s, k) {
          var i = at[k], sl = slots[i], f = g.foods[s.f], age = st.t - s.at, sg = g.stage(s);
          m.position.set(sl.x, TOP + 0.02, sl.z); m.rotation.y = (i * 0.7) % 1.2 - 0.6;
          var col = sg === 'raw' ? K.lerpHex(RAW[s.f], GOLDC[s.f], age / f.cook) : sg === 'gold' ? K.lerpHex(GOLDC[s.f], '#7a3a10', (age - f.cook) / g.gold * 0.6) : new T.Color(BURNT);
          m.userData.mat.color.copy(col); m.userData.mat.emissive = m.userData.mat.emissive || new T.Color(); m.userData.mat.emissive.setHex(sg === 'gold' ? 0x3a2000 : 0); m.position.y = TOP + 0.02 + (sg === 'gold' && !g.reduce ? Math.abs(Math.sin(t * 8)) * 0.02 : 0);
        });
        slots.forEach(function (sl, i) { var s = st.slots[i], sg = s && g.stage(s); sl.ring.material.color.setHex(sg === 'gold' ? 0xffffff : sg === 'burnt' ? 0xff4a3a : 0xffffff); sl.ring.material.opacity = sg === 'gold' ? 0.6 + 0.4 * Math.sin(t * 10) : sg === 'burnt' ? 0.8 : 0.3; });
        var burning = st.slots.filter(function (s) { return s && g.stage(s) === 'burnt'; }).length;
        smoke.forEach(function (s, i) { var k = (s.k + t * 0.18) % 1; s.s.position.set(s.x + Math.sin(t + i) * 0.3, TOP + 0.3 + k * 3.2, s.z - k * 0.8); s.s.material.opacity = (1 - k) * (0.2 + burning * 0.12); s.s.material.color.setHex(burning ? 0x555555 : 0xffffff); s.s.scale.setScalar(0.8 + k * 1.6); });
        cpool.sync(st.queue, function (m, c, i) {
          var tx = X(40 + i * 80, g), tz = Z(110, g) - 2.2;
          if (m.userData.placed) { m.position.x += (tx - m.position.x) * 0.12; } else { m.position.set(tx, 0, tz); m.userData.placed = true; }
          m.position.z = tz; K.move(m.userData.p, t * 5, Math.abs(tx - m.position.x) > 0.05 ? 0.5 : 0.03, false);
          var k = Math.max(0, c.wait / 20); m.userData.bar.scale.x = Math.max(0.02, k); m.userData.bar.position.x = -(1 - k) * 0.45; m.userData.bar.material.color.setHex(c.wait < 4 ? 0xff3b30 : 0x34c759);
        });
        popPool.sync(st.pops, function (m, p) { m.position.set(X(p.x, g), TOP + 1.2 + (0.8 - p.t) * 1.4, Z(p.y + 30, g)); m.material.opacity = Math.min(1, p.t * 2); });
      }
    };
  };

  /* ---------- Naija Quiz: the studio above the answer card ---------- */
  BUILD.quiz = function (T, scene, cam, K, o) {
    K.lights(0x0b1630, 0x9ab8ff, 0x1a2a50, 0xffffff, 0.8, [3, 10, 8]);
    var floor = new T.Mesh(new T.CircleGeometry(12, 48).rotateX(-Math.PI / 2), K.M(0x13294b, 0.2, 0.5)); floor.receiveShadow = true; scene.add(floor);
    var ring = new T.Mesh(new T.TorusGeometry(4.5, 0.06, 8, 64).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: 0x5aa0ff })); ring.position.y = 0.02; scene.add(ring);
    var scv = document.createElement('canvas'); scv.width = 1024; scv.height = 420; var sctx = scv.getContext('2d'), stex = new T.CanvasTexture(scv); stex.colorSpace = T.SRGBColorSpace;
    var screen = new T.Mesh(new T.PlaneGeometry(7.2, 2.95), new T.MeshStandardMaterial({ map: stex, emissive: 0xffffff, emissiveMap: stex, emissiveIntensity: 0.9 })); screen.position.set(0, 2.6, -3.6); scene.add(screen);
    K.box(scene, 7.6, 3.3, 0.2, K.M(0x0d1b33, 0.3, 0.6), 0, 2.6, -3.75);
    var panels = []; for (var k = 0; k < 4; k++) { var pm = new T.MeshStandardMaterial({ color: 0x1f3b63, emissive: 0x2f6fa0, emissiveIntensity: 0.5, roughness: 0.3 }); var pn = K.box(scene, 1.5, 0.45, 0.2, pm, (k - 1.5) * 1.7, 0.6, -3.2); var lb = K.label('ABCD'[k], null, '#ffffff', 0.38); lb.position.set((k - 1.5) * 1.7, 0.6, -3.05); scene.add(lb); panels.push(pm); }
    var host = K.person(null, 'quizhost', 4); host.position.set(-3.6, 0, -0.8); host.rotation.y = 0.7; scene.add(host); K.box(scene, 0.8, 1.05, 0.5, K.M(0x2f6fa0, 0.4, 0.3), -3.1, 0.52, -0.3).rotation.y = 0.7;
    var me = K.person(o.look ? { look: o.look, outfit: o.outfit || {} } : null, 'me', 0); me.position.set(3.4, 0, -0.6); me.rotation.y = -0.7; scene.add(me);
    var pod = K.box(scene, 1, 1.05, 0.6, new T.MeshStandardMaterial({ color: 0x1f3b63, emissive: 0x2f6fa0, emissiveIntensity: 0.4 }), 3.0, 0.52, -0.1); pod.rotation.y = -0.7;
    var timerBar = new T.Mesh(new T.PlaneGeometry(7.2, 0.14), new T.MeshBasicMaterial({ color: 0xf2b600 })); timerBar.position.set(0, 1.0, -3.55); scene.add(timerBar);
    var spots = [0x5aa0ff, 0xf2b600, 0xff6ab0].map(function (c, i) { var s = new T.SpotLight(c, 40, 20, 0.45, 0.5, 1.2); s.position.set((i - 1) * 5, 7, 3); scene.add(s); scene.add(s.target); return s; });
    var crowd = []; for (var a = 0; a < 7; a++) { var p = K.person(null, 'audience', a); p.position.set((a - 3) * 1.25, 0, 3.6 + (a % 2) * 0.5); p.rotation.y = Math.PI; scene.add(p); crowd.push(p); }
    var key = '';
    function drawScreen(st, g) {
      var q = st.over ? null : st.qs[st.i], w = scv.width, h = scv.height;
      var gr = sctx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#13294b'); gr.addColorStop(1, '#2f6fa0'); sctx.fillStyle = gr; sctx.fillRect(0, 0, w, h);
      sctx.strokeStyle = '#f2b600'; sctx.lineWidth = 8; sctx.strokeRect(10, 10, w - 20, h - 20); sctx.fillStyle = '#f2b600'; sctx.font = '800 34px system-ui, sans-serif'; sctx.textAlign = 'center';
      if (!q) { sctx.fillText('NAIJA QUIZ', w / 2, 90); sctx.fillStyle = '#fff'; sctx.font = '900 130px system-ui, sans-serif'; sctx.fillText(st.correct + ' / ' + (g.n || 10), w / 2, 260); }
      else {
        sctx.fillText('QUESTION ' + (st.i + 1) + ' OF ' + (g.n || 10), w / 2, 70); sctx.fillStyle = '#fff'; sctx.font = '800 50px system-ui, sans-serif';
        var words = q.q.split(' '), rows = [''], maxW = w - 90; words.forEach(function (wd) { var tr = rows[rows.length - 1] ? rows[rows.length - 1] + ' ' + wd : wd; if (sctx.measureText(tr).width > maxW && rows[rows.length - 1]) rows.push(wd); else rows[rows.length - 1] = tr; });
        rows.slice(0, 4).forEach(function (r, i) { sctx.fillText(r, w / 2, 150 + i * 62 + (4 - Math.min(4, rows.length)) * 24); });
      }
      stex.needsUpdate = true;
    }
    cam.position.set(0, 2.6, 7.6); cam.lookAt(0, 1.7, -2);
    return {
      update: function (st, g, t) {
        var kk = st.over + ':' + st.i + ':' + st.chosen + ':' + st.correct; if (kk !== key) { key = kk; drawScreen(st, g); }
        var q = st.over ? null : st.qs[st.i];
        panels.forEach(function (pm, k) { var c = 0x2f6fa0, i = 0.5; if (q && st.chosen != null) { if (k === q.ans) { c = 0x34c759; i = 1.6; } else if (k === st.chosen) { c = 0xff3b30; i = 1.4; } else i = 0.15; } pm.emissive.setHex(c); pm.emissiveIntensity = i; });
        timerBar.scale.x = st.over ? 0 : Math.max(0.001, st.left / (g.per || 12)); timerBar.material.color.setHex(st.left <= 3 ? 0xff3b30 : 0xf2b600);
        spots.forEach(function (s, i) { s.target.position.set(Math.sin(t * 0.7 + i * 2) * 3, 0, -1 + Math.cos(t * 0.5 + i) * 1.5); });
        var cheer = st.over ? st.correct >= 5 : q && st.chosen === q.ans;
        K.move(host, t * 2, 0.08, false); K.move(me, t * 6, cheer ? 0.4 : 0.05, cheer);
        crowd.forEach(function (p, i) { K.move(p, t * 6 + i, cheer ? 0.4 : 0.04, cheer); p.position.y = cheer ? Math.abs(Math.sin(t * 6 + i)) * 0.1 : 0; });
      }
    };
  };

  root.LasgidiGames3D = { view: view, stranger: stranger };
})(typeof window !== 'undefined' ? window : this);
