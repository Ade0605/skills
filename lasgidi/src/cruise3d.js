/* Lasgidi: the Lagoon Boat Cruise deck and the live rooms in real 3D (three.js). Same interface as src/cruise.js:
   create({ onSpot(key), onPlayer(by) }) → { el, update(scene), start, spots }, reading the same SPOTS and LAYOUTS so
   the spot keys match the engine. scene = { players: [{ by, label, spot, me, crew, npc, look, outfit, extra }],
   spot, bubbles: { by: text }, night, room, layout, sign, event }. The cruise sails the lagoon with the skyline
   drifting past; rooms (beach, Tidewater, club, market, park) get their own floor and props. People are the 3D
   avatars at their spots with their handles over them and chat bubbles when they talk. Tap a ring to move there,
   a person to chat. */
(function (root) {
  'use strict';
  var D = root.LASGIDI_DATA, SC = 2; // deck units → 3D units

  function create(opts) {
    opts = opts || {};
    var T = root.THREE, C2 = root.LasgidiCruise; if (!T || !C2) return null;
    var LAYOUTS = C2.LAYOUTS, SPOTS = C2.SPOTS;
    var el = document.createElement('div'); el.className = 'cruise-stage cruise-3d';
    var renderer; try { renderer = root.LasgidiGL ? root.LasgidiGL.make({}) : new T.WebGLRenderer({ antialias: true }); } catch (e) { return null; } if (!renderer) return null;
    var LITE = root.LasgidiGL ? root.LasgidiGL.lite() : (root.innerWidth || 1000) < 700 || ((root.navigator || {}).hardwareConcurrency || 8) <= 4;
    if (!root.LasgidiGL) renderer.setPixelRatio(Math.min(LITE ? 1.25 : 2, root.devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.toneMapping = T.ACESFilmicToneMapping;
    var cv = renderer.domElement; cv.className = 'cruise-canvas'; cv.setAttribute('role', 'img'); el.appendChild(cv);
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var S3 = new T.Scene(), cam = new T.PerspectiveCamera(42, 1, 0.1, 1500), scene = { players: [] }, raf = 0, W = 0, H = 0, built = '', peopleKey = '';
    S3.fog = new T.Fog(0xbfe3f7, 120, 520);
    var hemi = new T.HemisphereLight(0xf2f6ff, 0x5a6a50, 0.9), sun = new T.DirectionalLight(0xfff1dc, 1.6); sun.position.set(30, 50, 20); sun.castShadow = true; sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048); var shc = sun.shadow.camera; shc.left = -20; shc.right = 20; shc.top = 16; shc.bottom = -16;
    S3.add(hemi, sun); var stage = new T.Group(), people = new T.Group(); S3.add(stage, people);
    var DYN = { water: null, sky: [], tiles: [], lights: [], fire: null, spots: [], figs: [], tags: [], bubbles: {}, confetti: null };
    function M(c, r, m, o) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: r == null ? 0.7 : r, metalness: m || 0 }, o || {})); }
    function box(w, h, d, m, x, y, z, g) { var o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; (g || stage).add(o); return o; }
    function cyl(r1, r2, h, m, x, y, z, seg, g) { var o = new T.Mesh(new T.CylinderGeometry(r1, r2, h, seg || 16), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; (g || stage).add(o); return o; }
    function texOf(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
    function tag(text, bg, fg, w) { var t = texOf(512, 96, function (g, cw, ch) { g.font = '800 40px system-ui, sans-serif'; var tw = Math.min(cw - 8, g.measureText(text).width + 36); g.fillStyle = bg; g.beginPath(); if (g.roundRect) g.roundRect((cw - tw) / 2, 14, tw, 64, 32); else g.rect((cw - tw) / 2, 14, tw, 64); g.fill(); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, 47); }); var s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.renderOrder = 10; s.scale.set(w, w * 96 / 512, 1); return s; }
    function P(x, y) { return new T.Vector3((x - 5) * SC, 0, (y - 3) * SC); } // deck centre at the origin
    function spotInfo(room, k) { var src = room === 'cruise' ? D.CRUISE && D.CRUISE.spots : D.ROOMS && D.ROOMS[scene.room] && D.ROOMS[scene.room].spots; var s = src && src[k]; return s ? (s.icon ? s.icon + ' ' : '') + s.name : k; }

    function build(room) {
      stage.clear(); DYN = { water: null, sky: [], tiles: [], lights: [], fire: null, spots: [], figs: [], tags: [], bubbles: {}, confetti: null };
      var sea = room === 'cruise' || room === 'tidewater' || room === 'beach', wood = M(0xb08a5a, 0.85), dark = M(0x17181a, 0.6);
      if (sea) { var w = new T.Mesh(new T.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0x2a7896, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.15 })); w.position.y = -1.2; stage.add(w); DYN.water = w;
        for (var ti = 0; ti < 26; ti++) { var hgt = 20 + (ti * 37 % 70), tw = new T.Mesh(new T.BoxGeometry(12, hgt, 12), new T.MeshStandardMaterial({ color: 0x7f97ab, roughness: 0.3, metalness: 0.4, emissive: 0xffd28c, emissiveIntensity: 0 })); tw.position.set(-260 + ti * 22, hgt / 2 - 1, -200 - (ti % 3) * 30); stage.add(tw); DYN.sky.push(tw); } }
      if (room === 'cruise') {
        // The boat: a hull, a planked deck, the wheelhouse, a bar, loungers, a light-up dance floor, speakers and the stern rail.
        var hullShape = new T.Shape(); hullShape.moveTo(-11, -6.4); hullShape.lineTo(9, -6.4); hullShape.quadraticCurveTo(14, -3, 15, 0); hullShape.quadraticCurveTo(14, 3, 9, 6.4); hullShape.lineTo(-11, 6.4); hullShape.lineTo(-11, -6.4);
        var hull = new T.Mesh(new T.ExtrudeGeometry(hullShape, { depth: 2.4, bevelEnabled: false }).rotateX(Math.PI / 2), M(0xf4f3ec, 0.45)); hull.position.y = 0; hull.castShadow = true; stage.add(hull);
        var plankT = texOf(256, 256, function (g, cw, ch) { for (var y = 0; y < ch; y += 16) { g.fillStyle = 'hsl(30,' + (25 + (y * 7) % 10) + '%,' + (48 + (y * 13) % 10) + '%)'; g.fillRect(0, y, cw, 15); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y + 15, cw, 1); } }); plankT.wrapS = plankT.wrapT = T.RepeatWrapping; plankT.repeat.set(4, 3);
        var deck = new T.Mesh(new T.ShapeGeometry(hullShape).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ map: plankT, roughness: 0.85, side: T.DoubleSide })); deck.position.y = 0.02; deck.receiveShadow = true; stage.add(deck);
        var wh = P(8.4, 1.6); box(4, 3, 4, M(0xf4f3ec, 0.5), wh.x + 1, 1.5, wh.z - 1.5); box(4.1, 1.1, 4.1, M(0x2c4a5c, 0.05, 0.8), wh.x + 1, 2.2, wh.z - 1.5); box(4.4, 0.25, 4.4, M(0x1f5fa0, 0.5), wh.x + 1, 3.1, wh.z - 1.5); var wheel = new T.Mesh(new T.TorusGeometry(0.45, 0.06, 8, 20), M(0x6b4a2b)); wheel.position.set(wh.x - 0.9, 1.3, wh.z - 0.2); wheel.rotation.y = Math.PI / 2; stage.add(wheel);
        var br = P(2, 1.5); box(3.6, 1.1, 1.0, M(0x6b4a2b, 0.6), br.x, 0.55, br.z - 1.2); box(3.8, 0.1, 1.2, M(0xd4af37, 0.3, 0.7), br.x, 1.12, br.z - 1.2);
        var sunP = P(8.2, 4.4); for (var l = 0; l < 3; l++) { box(0.8, 0.2, 2, M(0xffffff, 0.6), sunP.x - 1.6 + l * 1.4, 0.35, sunP.z + 0.8); }
        var party = P(5, 3.4); for (var ix = 0; ix < 5; ix++) for (var iz = 0; iz < 4; iz++) { var tm = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.3 }), tile = box(0.9, 0.05, 0.9, tm, party.x - 2 + ix, 0.05, party.z - 1.5 + iz); DYN.tiles.push(tm); }
        [-1, 1].forEach(function (sd) { box(0.7, 1.4, 0.7, dark, party.x + sd * 3, 0.7, party.z - 2); });
        for (var rl = -11; rl <= 9; rl += 1.2) [-6.2, 6.2].forEach(function (z) { cyl(0.04, 0.04, 1, M(0xdfe3e8, 0.3, 0.8), rl, 0.5, z, 6); }); [-6.2, 6.2].forEach(function (z) { var rail = cyl(0.05, 0.05, 20, M(0xdfe3e8, 0.3, 0.8), -1, 1, z, 6); rail.rotation.z = Math.PI / 2; });
        for (var fl = 0; fl < 12; fl++) { var bulb = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), new T.MeshBasicMaterial({ color: 0x6b6458 })); bulb.position.set(-10 + fl * 1.8, 3.4 - Math.sin(fl / 11 * Math.PI) * 0.6, 0); stage.add(bulb); DYN.lights.push(bulb.material); }
      } else {
        // Room floors and props, laid out on the same 10 × 6 grid.
        var floorC = { beach: 0xe9dcc0, tidewater: 0xb08a5a, club: 0x141418, market: 0x9a8a72, park: 0x5f9a4a }[room] || 0xb08a5a;
        box(22, 0.4, 14, M(floorC, room === 'club' ? 0.2 : 0.9, room === 'club' ? 0.4 : 0), 0, -0.2, 0);
        var L = LAYOUTS[room] || {};
        if (room === 'beach') { var bar0 = P(L.bar[0], L.bar[1]); box(3, 1.1, 1.2, M(0x8a5a2b), bar0.x, 0.55, bar0.z); var roof = new T.Mesh(new T.ConeGeometry(2.6, 1.2, 4), M(0xc8a25e, 1)); roof.position.set(bar0.x, 3.2, bar0.z); roof.rotation.y = Math.PI / 4; stage.add(roof); var v0 = P(L.volley[0], L.volley[1]); [-2, 2].forEach(function (x) { cyl(0.06, 0.06, 2.4, M(0xffffff), v0.x + x, 1.2, v0.z, 6); }); box(4, 0.8, 0.02, new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }), v0.x, 1.9, v0.z); var bf = P(L.bonfire[0], L.bonfire[1]); cyl(0.9, 1, 0.3, M(0x55524d), bf.x, 0.15, bf.z); var fire = new T.Mesh(new T.ConeGeometry(0.6, 1.4, 10, 1, true), new T.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false })); fire.position.set(bf.x, 1, bf.z); stage.add(fire); DYN.fire = fire; }
        else if (room === 'tidewater') { var dj = P(L.dj[0], L.dj[1]); box(3, 1.2, 1.2, dark, dj.x, 0.6, dj.z); var ov = P(L.oven[0], L.oven[1]); var dome = new T.Mesh(new T.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0xb5603a, 0.9)); dome.position.set(ov.x, 0.8, ov.z); stage.add(dome); box(2.2, 0.8, 2.2, M(0x8a7a68), ov.x, 0.4, ov.z); var jt = P(L.jetty[0], L.jetty[1]); box(2.4, 0.2, 8, M(0xb08a5a), jt.x, 0, jt.z + 3); var bar1 = P(L.bar[0], L.bar[1]); box(3.4, 1.1, 1, M(0x6b4a2b), bar1.x, 0.55, bar1.z - 0.8); var lo = P(L.lounge[0], L.lounge[1]); box(3, 0.5, 1, M(0xefe8da), lo.x, 0.25, lo.z + 0.6); }
        else if (room === 'club') { var fl2 = P(L.floor[0], L.floor[1]); for (var cx = 0; cx < 6; cx++) for (var cz = 0; cz < 4; cz++) { var cm = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.7 }); box(1.1, 0.05, 1.1, cm, fl2.x - 3 + cx * 1.2, 0.03, fl2.z - 2 + cz * 1.2); DYN.tiles.push(cm); } var dj2 = P(L.dj[0], L.dj[1]); box(4, 1.4, 1.4, dark, dj2.x, 0.7, dj2.z - 0.6); var bar2 = P(L.bar[0], L.bar[1]); box(1.2, 1.1, 4, M(0x2b2f36, 0.3, 0.5), bar2.x - 0.8, 0.55, bar2.z); var vip = P(L.vip[0], L.vip[1]); box(3, 0.6, 1.2, M(0x5a1f4a, 0.4), vip.x, 0.3, vip.z - 0.8); for (var lz = 0; lz < 4; lz++) { var lt = new T.PointLight([0xff3fa8, 0x3a6bff, 0x19e3c8, 0xffb000][lz], 6, 18, 1.5); lt.position.set(-8 + lz * 5.5, 4, 0); stage.add(lt); DYN.lights.push(lt); } }
        else if (room === 'market') { Object.keys(L).forEach(function (k, i) { var p = P(L[k][0], L[k][1]); box(2.6, 1, 1.4, M(0x8a6a42), p.x, 0.5, p.z - 0.8); var um = new T.Mesh(new T.ConeGeometry(1.8, 0.6, 10, 1, true), M([0xc0392b, 0x1f5fa0, 0xf2b600, 0x2fa36b, 0xe67e22][i % 5], 0.8, 0, { side: T.DoubleSide })); um.position.set(p.x, 2.6, p.z - 0.8); stage.add(um); cyl(0.04, 0.04, 2.6, M(0xdfe3e8), p.x, 1.3, p.z - 0.8, 6); }); }
        else if (room === 'park') { var st = P(L.stage[0], L.stage[1]); box(6, 0.6, 2.4, M(0x6b4a2b), st.x, 0.3, st.z - 0.6); box(6.4, 0.2, 3, M(0x2e7d32), st.x, 3, st.z - 0.6); var se = P(L.seats[0], L.seats[1]); for (var r2 = 0; r2 < 3; r2++) box(5, 0.4, 0.5, M(0x8a6a3a), se.x, 0.2, se.z + r2 * 0.9 - 0.4); var tr = P(L.trees[0], L.trees[1]); for (var t2 = 0; t2 < 3; t2++) { cyl(0.15, 0.2, 2, M(0x5a4632), tr.x + t2 * 1.2 - 1.2, 1, tr.z - 0.6); var cr = new T.Mesh(new T.IcosahedronGeometry(1.1, 1), M(0x3f7f3a, 0.9, 0, { flatShading: true })); cr.position.set(tr.x + t2 * 1.2 - 1.2, 2.6, tr.z - 0.6); cr.castShadow = true; stage.add(cr); } }
        if (scene.sign) { var sg = tag(String(scene.sign), '#ff2d95', '#ffffff', 9); sg.position.set(0, 5.5, -7); stage.add(sg); }
      }
      // Spot rings with their names; yours glows.
      var SP = LAYOUTS[room] || SPOTS;
      Object.keys(SP).forEach(function (k) { var p = P(SP[k][0], SP[k][1] + 0.6), ring = new T.Mesh(new T.RingGeometry(1.0, 1.25, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false })); ring.position.set(p.x, 0.06, p.z); ring.userData.spot = k; stage.add(ring); var disc = new T.Mesh(new T.CircleGeometry(1.25, 30).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); disc.position.copy(ring.position); disc.userData.spot = k; stage.add(disc); var lb = tag(spotInfo(room, k), 'rgba(255,255,255,.9)', '#17181a', 4.4); lb.position.set(p.x, 0.5, p.z + 1.6); stage.add(lb); DYN.spots.push({ k: k, ring: ring }); });
      if (scene.event) { var cg = new T.BufferGeometry(), cp = new Float32Array(300 * 3); for (var c = 0; c < 300; c++) { cp[c * 3] = (Math.random() - 0.5) * 22; cp[c * 3 + 1] = Math.random() * 8; cp[c * 3 + 2] = (Math.random() - 0.5) * 14; } cg.setAttribute('position', new T.BufferAttribute(cp, 3)); DYN.confetti = new T.Points(cg, new T.PointsMaterial({ size: 0.2, vertexColors: false, color: 0xfdd835 })); stage.add(DYN.confetti); }
      orbit.r = room === 'cruise' ? 23 : 21; orbit.pol = 1.1; place();
    }
    function syncPeople() {
      var room = scene.layout || scene.room || 'cruise', SP = LAYOUTS[room] || SPOTS, key = JSON.stringify((scene.players || []).map(function (p) { return [p.by, p.spot, p.look, p.outfit, p.label]; }));
      if (key !== peopleKey) {
        var was = {}; (DYN.figs || []).forEach(function (f) { was[f.pl.by] = f.g.position.clone(); }); // where everyone stood, so they walk to their new spot
        peopleKey = key; people.clear(); DYN.figs = []; var placed = {};
        (scene.players || []).forEach(function (pl, i) {
          var base = SP[pl.spot] || SP[Object.keys(SP)[0]], n = placed[pl.spot] = (placed[pl.spot] || 0) + 1, ang = n * 2.4, rad = n === 1 ? 0 : 0.6 + 0.2 * Math.floor(n / 4), p = P(base[0] + Math.cos(ang) * rad, base[1] + Math.sin(ang) * rad * 0.8);
          var g = new T.Group(); g.position.copy(p); var fig = root.LasgidiAvatar3D ? root.LasgidiAvatar3D.figure(T, pl.look || { skin: 2, hair: 0, shape: 1 }, pl.outfit || {}, pl.extra) : new T.Mesh(new T.CapsuleGeometry(0.3, 1.1, 4, 8), M(0x2f6fa0)); fig.rotation.y = (i * 1.7) % 6.28; g.add(fig);
          var tg = tag((pl.me ? '★ ' : '') + (pl.label || ''), pl.me ? (pl.tagc || '#2f6fd0') : pl.crew ? 'rgba(23,24,26,.75)' : '#ffffff', pl.me ? (pl.tagi || '#ffffff') : pl.crew ? '#ffffff' : '#17181a', 4.2); tg.position.y = 2.5; g.add(tg);
          g.traverse(function (o) { if (!pl.me && (!pl.crew || pl.npc)) o.userData.by = pl.by; }); people.add(g); var fw = { g: g, fig: fig, pl: pl, ph: i * 0.9, to: p.clone() }; if (was[pl.by] && was[pl.by].distanceTo(p) > 0.3 && !reduce) { fw.from = was[pl.by].clone(); fw.from.y = 0; fw.t0 = performance.now(); fw.dur = Math.min(2200, 500 + was[pl.by].distanceTo(p) * 140); g.position.copy(fw.from); fig.rotation.y = Math.atan2(p.x - fw.from.x, p.z - fw.from.z); } DYN.figs.push(fw);
        });
      }
      DYN.spots.forEach(function (s) { var mine = s.k === scene.spot; s.ring.material.color.set(mine ? 0xf2b600 : 0xffffff); s.ring.material.opacity = mine ? 0.95 : 0.5; });
      DYN.figs.forEach(function (f) { var txt = scene.bubbles && scene.bubbles[f.pl.by]; if (f.bub && f.bubText !== txt) { f.g.remove(f.bub); f.bub = null; } if (txt && !f.bub) { f.bub = tag(String(txt).slice(0, 44), '#ffffff', '#17181a', 7); f.bub.position.y = 3.3; f.g.add(f.bub); f.bubText = txt; } });
    }

    var orbit = { az: 0.6, pol: 1.0, r: 28 }, ptrs = {}, drag = null, moved = false, pinch0 = 0;
    function place() { orbit.pol = Math.max(0.45, Math.min(1.3, orbit.pol)); orbit.r = Math.max(10, Math.min(60, orbit.r)); var s = Math.sin(orbit.pol); cam.position.set(orbit.r * s * Math.sin(orbit.az), orbit.r * Math.cos(orbit.pol), orbit.r * s * Math.cos(orbit.az)); cam.lookAt(0, 0.8, 0); }
    cv.addEventListener('pointerdown', function (e) { ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; drag = { x: e.clientX, y: e.clientY }; moved = false; var a = Object.values(ptrs); if (a.length === 2) pinch0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
    cv.addEventListener('pointermove', function (e) { if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; var a = Object.values(ptrs); if (a.length === 2 && pinch0) { var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); orbit.r *= pinch0 / Math.max(1, d); pinch0 = d; moved = true; place(); return; } if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; orbit.az -= dx * 0.006; orbit.pol -= dy * 0.004; drag = { x: e.clientX, y: e.clientY }; place(); });
    function up(e) { delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch0 = 0; if (!Object.keys(ptrs).length) drag = null; }
    var ray = new T.Raycaster(), ndc = new T.Vector2();
    cv.addEventListener('pointerup', function (e) { var mv = moved; up(e); if (mv) return; var r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
      var hp = ray.intersectObjects(people.children, true).filter(function (h) { return h.object.userData.by; })[0]; if (hp && opts.onPlayer) { opts.onPlayer(hp.object.userData.by); return; }
      var hs = ray.intersectObjects(stage.children, true).filter(function (h) { return h.object.userData.spot; })[0]; if (hs && opts.onSpot) opts.onSpot(hs.object.userData.spot); });
    cv.addEventListener('pointercancel', up); cv.addEventListener('wheel', function (e) { e.preventDefault(); orbit.r *= Math.exp(e.deltaY * 0.0012); place(); }, { passive: false });

    function size() { var w = el.clientWidth || 360, h = el.clientHeight || 400; if (w === W && h === H) return; W = w; H = h; renderer.setSize(W, H, false); cv.style.width = W + 'px'; cv.style.height = H + 'px'; cam.aspect = W / H; cam.updateProjectionMatrix(); }
    function frame(now) {
      if (root.LasgidiGL && !root.LasgidiGL.live(el)) { raf = el.isConnected ? root.requestAnimationFrame(frame) : 0; return; } // hidden or under another view: skip the frame
      root.LasgidiGL && root.LasgidiGL.pace(renderer);
      size(); var t = reduce ? 2 : now / 1000, night = !!scene.night, room = scene.layout || scene.room || 'cruise';
      var sky = night ? 0x0d1733 : room === 'club' ? 0x0d0d14 : 0xbfe3f7; S3.background = new T.Color(sky); S3.fog.color.set(sky);
      hemi.intensity = night ? 0.35 : 0.9; sun.intensity = night ? 0.15 : 1.6;
      if (DYN.water) { DYN.water.material.color.set(night ? 0x0b2236 : 0x2a7896); if (room === 'cruise') { stage.position.y = Math.sin(t * 0.9) * 0.08; stage.rotation.z = Math.sin(t * 0.7) * 0.01; } }
      DYN.sky.forEach(function (tw, i) { if (room === 'cruise') tw.position.x = ((-260 + i * 22 + t * 3) % 572 + 572) % 572 - 286; tw.material.emissiveIntensity = night ? 0.6 : 0; });
      DYN.tiles.forEach(function (m, i) { m.emissive.setHSL((t * 0.2 + i * 0.07) % 1, 0.9, 0.5); m.emissiveIntensity = night || room === 'club' ? 0.9 : 0.35; });
      DYN.lights.forEach(function (l, i) { if (l.isLight) l.intensity = 5 + Math.abs(Math.sin(t * 3 + i)) * 6; else l.color.set(night ? 0xffd27a : 0x6b6458); });
      if (DYN.fire) DYN.fire.scale.set(1, 0.8 + Math.abs(Math.sin(t * 8)) * 0.4, 1);
      if (DYN.confetti) { var cp = DYN.confetti.geometry.attributes.position; for (var c = 0; c < cp.count; c++) cp.setY(c, ((cp.getY(c) - 0.03) + 8) % 8); cp.needsUpdate = true; }
      DYN.figs.forEach(function (f) { if (f.from) { var k = Math.min(1, (now - f.t0) / f.dur), e = k * k * (3 - 2 * k), lg = f.fig.userData && f.fig.userData.legs, sw = Math.sin(now / 1000 * 9) * 0.55; f.g.position.lerpVectors(f.from, f.to, e); if (lg) lg.forEach(function (l, j) { l.rotation.x = k < 1 ? (j ? -sw : sw) : 0; }); if (k >= 1) f.from = null; return; } var dancing = room === 'club' || (room === 'cruise' && f.pl.spot === 'party'); f.g.position.y = dancing && !reduce ? Math.abs(Math.sin(t * 4 + f.ph)) * 0.15 : 0; var arms = f.fig.userData && f.fig.userData.arms; if (arms && dancing && !reduce) { arms[0].rotation.z = -0.6 - Math.sin(t * 4 + f.ph) * 0.8; arms[1].rotation.z = 0.6 + Math.sin(t * 4 + f.ph) * 0.8; } });
      renderer.render(S3, cam); raf = el.isConnected ? root.requestAnimationFrame(frame) : 0;
    }
    function update(s) { scene = s || scene; var room = scene.layout || scene.room || 'cruise', bk = room + '|' + (scene.sign || '') + '|' + (scene.event ? 1 : 0); if (bk !== built) { built = bk; peopleKey = ''; build(room); } syncPeople(); if (!raf && el.isConnected) raf = root.requestAnimationFrame(frame); }
    function start() { if (!raf) raf = root.requestAnimationFrame(frame); }
    return { el: el, update: update, start: start, spots: SPOTS, is3d: true, mePos: function () { var f = (DYN.figs || []).filter(function (x) { return x.pl.me; })[0]; return f ? { x: f.g.position.x, z: f.g.position.z, walking: !!f.from } : null; }, /* for tests */ dispose: function () { if (raf) root.cancelAnimationFrame(raf); raf = 0; if (root.LasgidiGL) root.LasgidiGL.free(renderer); else renderer.dispose(); } };
  }
  root.LasgidiCruise3D = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
