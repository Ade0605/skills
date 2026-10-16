/* Lasgidi: the beach in real 3D (three.js, WebGL). Built from shapes and procedural textures, no photos:
   a hazy golden-hour sky with the sun's glow, an animated sea (turquoise shallows into deep blue, glinting),
   a foam line washing up the shore, rippled white sand, feathery palms, and, at White Sand Beach, modern white
   villas with infinity pools, turquoise umbrellas, daybeds and lawns. Eko Atlantic's towers stand in the haze.
   Same interface as the 2D walk-in renderer: create(opts) → { el, update(scene), start, stop, canvas }.
   Action signs float over their spots (tap → opts.onAct(i)); people walk the sand; drag to orbit, pinch to zoom. */
(function (root) {
  'use strict';
  var SPOTS = [[-16, -6], [-6, -4], [4, -5], [14, -4], [-12, 4], [-2, 6], [8, 5], [18, 4]];
  var SAND0 = -22, SAND_D = 38, SEA0 = 16; // sand from the lawn's edge (z -22) to the waterline (z 16)

  function create(opts) {
    opts = opts || {};
    var T = root.THREE; if (!T) return null;
    var el = document.createElement('div'); el.className = 'cruise-stage venue-stage beach-3d';
    var renderer; try { renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    var cv = renderer.domElement; cv.className = 'cruise-canvas'; cv.setAttribute('role', 'img'); el.appendChild(cv);
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var S3 = new T.Scene(), cam = new T.PerspectiveCamera(42, 1, 0.5, 2500), sc = { acts: [], people: [] }, raf = 0, W = 0, H = 0;
    var HAZE = 0xe9dccb; S3.fog = new T.FogExp2(HAZE, 0.0021);

    /* ---------- sky: a gradient dome with the low sun's glow ---------- */
    var skyU = { top: { value: new T.Color(0x7fb6df) }, mid: { value: new T.Color(0xcfe1ea) }, hor: { value: new T.Color(0xf2e2cf) }, sunDir: { value: new T.Vector3(-0.55, 0.18, -0.8).normalize() }, night: { value: 0 } };
    var sky = new T.Mesh(new T.SphereGeometry(1800, 32, 16), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: skyU,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; uniform float night; varying vec3 vD; void main(){ float h = max(vD.y, 0.0); vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.75, h)); float s = max(dot(normalize(vD), sunDir), 0.0); c += vec3(1.0,0.86,0.62) * (pow(s, 600.0) * 2.5 + pow(s, 12.0) * 0.35); c = mix(c, vec3(0.03,0.05,0.12) + vec3(0.05,0.06,0.12)*h, night); gl_FragColor = vec4(c, 1.0); }' }));
    S3.add(sky);
    // Reflections: bake the sky into an environment map so the sea and the pools mirror it.
    var envScene = new T.Scene(), envSky = sky.clone(); envScene.add(envSky); var pmrem = new T.PMREMGenerator(renderer), envRT = null;
    function bakeEnv() { if (envRT) envRT.dispose(); envRT = pmrem.fromScene(envScene, 0.02); S3.environment = envRT.texture; }
    bakeEnv();
    var hemi = new T.HemisphereLight(0xfff1dd, 0x8a9a6a, 0.85), sun = new T.DirectionalLight(0xffe2b8, 2.2);
    sun.position.set(-60, 40, -80); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); var shc = sun.shadow.camera; shc.left = -45; shc.right = 45; shc.top = 40; shc.bottom = -40; shc.near = 1; shc.far = 260; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    sun.target.position.set(0, 0, 10); S3.add(hemi, sun, sun.target);

    /* ---------- procedural textures ---------- */
    function canvasTex(w, h, draw, rep) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } t.userData = { canvas: c }; return t; }
    function rnd(seed) { var s = seed >>> 0; return function () { s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0; return (s >>> 8) / 16777216; }; }
    var sandTex = canvasTex(512, 512, function (g, w, h) { var r = rnd(7); g.fillStyle = '#efe4cf'; g.fillRect(0, 0, w, h); for (var i = 0; i < 26000; i++) { var v = r(); g.fillStyle = v < 0.5 ? 'rgba(200,180,150,' + (0.05 + r() * 0.12) + ')' : 'rgba(255,252,242,' + (0.05 + r() * 0.15) + ')'; g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5); } for (var k = 0; k < 40; k++) { g.strokeStyle = 'rgba(190,170,140,.08)'; g.lineWidth = 2; g.beginPath(); var y = r() * h; g.moveTo(0, y); for (var x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + k) * 4); g.stroke(); } }, [24, 12]);
    var grassTex = canvasTex(256, 256, function (g, w, h) { var r = rnd(3); g.fillStyle = '#6fa64a'; g.fillRect(0, 0, w, h); for (var i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(60,110,40,.18)' : 'rgba(150,200,100,.16)'; g.fillRect(r() * w, r() * h, 1, 2 + r() * 2); } for (var s = 0; s < h; s += 32) { g.fillStyle = s % 64 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.03)'; g.fillRect(0, s, w, 32); } }, [10, 6]);
    var deckTex = canvasTex(256, 256, function (g, w, h) { var r = rnd(11); for (var y = 0; y < h; y += 16) { g.fillStyle = 'hsl(30,' + (22 + r() * 10) + '%,' + (52 + r() * 10) + '%)'; g.fillRect(0, y, w, 15); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y + 15, w, 1); } }, [3, 3]);
    var trunkTex = canvasTex(64, 256, function (g, w, h) { g.fillStyle = '#8a6a4a'; g.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 10) { g.fillStyle = 'rgba(60,40,25,.45)'; g.fillRect(0, y, w, 3); g.fillStyle = 'rgba(200,170,130,.25)'; g.fillRect(0, y + 4, w, 2); } }, [1, 4]);
    var frondTex = canvasTex(256, 64, function (g, w, h) { g.clearRect(0, 0, w, h); g.strokeStyle = '#4c7a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); for (var x = 6; x < w - 4; x += 5) { var L = (h / 2 - 2) * Math.sin(Math.PI * Math.min(1, (x / w) * 1.15)); g.strokeStyle = 'hsl(' + (95 + (x % 13)) + ',48%,' + (30 + (x % 7) * 2) + '%)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + 7, h / 2 - L); g.moveTo(x, h / 2); g.lineTo(x + 7, h / 2 + L); g.stroke(); } });

    /* ---------- materials and helpers ---------- */
    var Mc = {}; function mat(k, o) { return Mc[k] || (Mc[k] = new T.MeshStandardMaterial(o)); }
    function mesh(geo, m, x, y, z) { var o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; return o; }
    var white = mat('white', { color: 0xf7f5f0, roughness: 0.55 }), glassM = mat('glass', { color: 0x2c4a5c, roughness: 0.05, metalness: 0.85 }), frameM = mat('frame', { color: 0x2a2d31, roughness: 0.4, metalness: 0.6 });
    // Pool water: rippled light lines over a pale tile floor, under a glossy coat.
    var causticTex = canvasTex(256, 256, function (g, w, h) { var r = rnd(23); g.fillStyle = '#4fd3e6'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; for (var i = 0; i < 70; i++) { var x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 12, y - 10, x + 24, y + 10, x + 36, y - 2); g.stroke(); } g.strokeStyle = 'rgba(20,90,110,.12)'; g.lineWidth = 1; for (var k = 0; k < w; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, h); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); } }, [3, 1]);
    var poolM = new T.MeshPhysicalMaterial({ map: causticTex, color: 0xffffff, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.92 });
    var umbM = mat('umb', { color: 0x1fb3c9, roughness: 0.7, side: T.DoubleSide });

    /* ---------- the land: lawn, a path, rippled sand ---------- */
    var world = new T.Group(); S3.add(world);
    var sandGeo = new T.PlaneGeometry(260, SAND_D + 4, 130, 30); sandGeo.rotateX(-Math.PI / 2); sandGeo.translate(0, 0, SAND0 + SAND_D / 2); var sp = sandGeo.attributes.position;
    for (var i = 0; i < sp.count; i++) sp.setY(i, groundY(sp.getX(i), sp.getZ(i)));
    sandGeo.computeVertexNormals(); var sand = mesh(sandGeo, mat('sand', { map: sandTex, color: 0xffffff, roughness: 0.95 }), 0, 0, 0); sand.castShadow = false; world.add(sand);
    var lawn = mesh(new T.PlaneGeometry(260, 52).rotateX(-Math.PI / 2), mat('lawn', { map: grassTex, roughness: 0.95 }), 0, 1.0, -46); lawn.castShadow = false; world.add(lawn);
    var path = mesh(new T.PlaneGeometry(260, 2.4).rotateX(-Math.PI / 2), mat('path', { color: 0xd9cdb6, roughness: 0.9 }), 0, 1.03, -27.5); path.castShadow = false; world.add(path);

    /* ---------- the sea: animated waves, turquoise shallows, glints, and a foam line ---------- */
    var seaGeo = new T.PlaneGeometry(1400, 700, 180, 90); seaGeo.rotateX(-Math.PI / 2); seaGeo.translate(0, 0, SEA0 + 350);
    var sPos = seaGeo.attributes.position, base = new Float32Array(sPos.array), cols = new Float32Array(sPos.count * 3), shallow = new T.Color(0x3ccfd6), deep = new T.Color(0x1f80ad), tmp = new T.Color();
    for (var vi = 0; vi < sPos.count; vi++) { var dz = base[vi * 3 + 2] - SEA0; tmp.copy(shallow).lerp(deep, Math.min(1, Math.max(0, dz / 160))); cols[vi * 3] = tmp.r; cols[vi * 3 + 1] = tmp.g; cols[vi * 3 + 2] = tmp.b; }
    seaGeo.setAttribute('color', new T.BufferAttribute(cols, 3));
    var sea = new T.Mesh(seaGeo, new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.15, transparent: true, opacity: 0.94 })); sea.position.y = -0.6; sea.receiveShadow = true; S3.add(sea);
    function waves(t) {
      for (var i = 0; i < sPos.count; i++) { var x = base[i * 3], z = base[i * 3 + 2], near = Math.min(1, Math.max(0.15, (z - SEA0) / 60)) * Math.max(0.15, 1 - Math.max(0, z - 160) / 300); sPos.array[i * 3 + 1] = (Math.sin(x * 0.045 + t * 0.9) * 0.35 + Math.sin(z * 0.08 - t * 1.4) * 0.45 + Math.sin((x + z) * 0.13 + t * 2.1) * 0.12) * near; }
      sPos.needsUpdate = true; seaGeo.computeVertexNormals();
    }
    var foamTex = canvasTex(512, 64, function (g, w, h) { var r = rnd(5); var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (var i = 0; i < 900; i++) { g.fillStyle = 'rgba(255,255,255,' + r() * 0.6 + ')'; g.beginPath(); g.arc(r() * w, h * (0.25 + r() * 0.5), 1 + r() * 2.5, 0, Math.PI * 2); g.fill(); } }, [8, 1]);
    var foam = new T.Mesh(new T.PlaneGeometry(400, 5).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, fog: true })); foam.position.set(0, -0.05, SEA0 - 1); S3.add(foam);
    var wet = new T.Mesh(new T.PlaneGeometry(400, 6).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0xbfae8e, roughness: 0.25, transparent: true, opacity: 0.55, depthWrite: false })); wet.position.set(0, -0.08, SEA0 - 3.5); S3.add(wet);

    /* ---------- palms with feathery fronds ---------- */
    function frondGeo(len, width, droop) {
      var segs = 12, g = new T.BufferGeometry(), pos = [], uv = [], idx = [];
      for (var i = 0; i <= segs; i++) { var u = i / segs, x = u * len, y = Math.sin(u * Math.PI * 0.55) * len * 0.28 - u * u * droop, w2 = width * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05)) / 2; pos.push(x, y, -w2, x, y - w2 * 0.35, w2); uv.push(u, 0, u, 1); if (i < segs) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    var FROND = frondGeo(4.2, 1.6, 2.6), frondM = new T.MeshStandardMaterial({ map: frondTex, alphaTest: 0.35, side: T.DoubleSide, roughness: 0.8 }), trunkM = mat('trunk', { map: trunkTex, roughness: 0.95 });
    function palm(x, z, h, lean) {
      var g = new T.Group(); g.position.set(x, groundY(x, z), z); var top = new T.Vector3(lean * h * 0.25, h, lean * h * 0.08);
      var curve = new T.QuadraticBezierCurve3(new T.Vector3(0, 0, 0), new T.Vector3(lean * h * 0.18, h * 0.55, 0), top);
      var tr = mesh(new T.TubeGeometry(curve, 16, 0.22, 8), trunkM); g.add(tr);
      var crown = new T.Group(); crown.position.copy(top);
      for (var i = 0; i < 13; i++) { var f = new T.Mesh(FROND, frondM); f.castShadow = true; f.rotation.y = i * 2.4; f.rotation.z = (i % 3) * 0.12 - 0.05; f.scale.setScalar(0.85 + (i % 4) * 0.08); crown.add(f); }
      for (var c = 0; c < 5; c++) crown.add(mesh(new T.SphereGeometry(0.16, 8, 6), mat('coco', { color: 0x5a4a2a, roughness: 0.6 }), Math.cos(c * 1.3) * 0.25, -0.25, Math.sin(c * 1.3) * 0.25));
      g.add(crown); g.userData.crown = crown; dyn.add(g); palms.push(g); return g;
    }
    function groundY(x, z) { if (z < SAND0 + 2) return 1.0; var slope = Math.min(1.1, (z - SAND0) / SAND_D), fade = Math.min(1, (z - SAND0) / 6); return 0.95 - slope * 1.5 + (Math.sin(x * 0.21) * Math.cos(z * 0.33) * 0.1 + Math.sin(x * 0.05 + z * 0.1) * 0.2) * fade; }

    /* ---------- villas with infinity pools (White Sand Beach) ---------- */
    var dyn = new T.Group(); world.add(dyn); var villas = new T.Group(), palms = []; dyn.add(villas);
    function villa(x, view) {
      var g = new T.Group(); g.position.set(x, 1.0, -36);
      if (!view) {
      g.add(mesh(new T.BoxGeometry(16, 4.2, 10), white, 0, 2.1, 0));
      g.add(mesh(new T.BoxGeometry(11, 3.6, 8.5), white, -1.5, 6.0, -0.6));
      g.add(mesh(new T.BoxGeometry(17.5, 0.35, 11.2), mat('slab', { color: 0xe9e5dc, roughness: 0.6 }), 0, 4.3, 0.2));
      g.add(mesh(new T.BoxGeometry(12, 0.3, 9.4), mat('slab', { color: 0xe9e5dc }), -1.5, 7.95, -0.6));
      g.add(mesh(new T.BoxGeometry(13.5, 3.0, 0.15), glassM, 0, 1.8, 5.02)); g.add(mesh(new T.BoxGeometry(9.5, 2.6, 0.15), glassM, -1.5, 5.9, 3.62));
      for (var m = -6; m <= 6; m += 2) g.add(mesh(new T.BoxGeometry(0.08, 3.0, 0.2), frameM, m, 1.8, 5.08));
      g.add(mesh(new T.BoxGeometry(11.5, 1.0, 0.1), mat('rail', { color: 0xbfd7e0, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.45 }), -1.5, 4.95, 4.05));
      }
      // Deck, infinity pool and its loungers.
      var deck = mesh(new T.BoxGeometry(18, 0.3, 9), mat('deck', { map: deckTex, roughness: 0.8 }), 0, 0.15, 9.5); g.add(deck);
      g.add(mesh(new T.BoxGeometry(12.6, 0.5, 4.4), mat('coping', { color: 0xf1efe9, roughness: 0.5 }), -1, 0.3, 10.4));
      var pool = mesh(new T.BoxGeometry(12, 0.1, 3.8), poolM, -1, 0.52, 10.4); pool.castShadow = false; g.add(pool);
      for (var l = 0; l < 4; l++) { var lg = mesh(new T.BoxGeometry(0.9, 0.12, 2.0), white, -6 + l * 2.6, 0.36, 7.0); lg.rotation.x = -0.05; g.add(lg); }
      [[-6.5, 13.3], [-0.5, 13.3], [5.5, 13.3]].forEach(function (q) { g.add(umbrella(q[0], 0.3, q[1], 1.3)); }); // along the seaward edge, past the pool
      [[6.5, 6.3], [7.4, 7.6]].forEach(function (q) { g.add(mesh(new T.SphereGeometry(0.75, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), white, q[0], 0.3, q[1])); });
      villas.add(g); return g;
    }
    function umbrella(x, y, z, k) {
      var g = new T.Group(); g.position.set(x, y, z); var s = k || 1;
      g.add(mesh(new T.CylinderGeometry(0.05 * s, 0.05 * s, 2.6 * s, 6), mat('upole', { color: 0xe8e2d6, roughness: 0.5 }), 0, 1.3 * s, 0));
      var top = mesh(new T.ConeGeometry(1.5 * s, 0.6 * s, 10, 1, true), umbM, 0, 2.6 * s, 0); g.add(top);
      g.add(mesh(new T.CylinderGeometry(1.5 * s, 1.5 * s, 0.12 * s, 10, 1, true), umbM, 0, 2.3 * s, 0));
      return g;
    }
    function lounger(x, z, rot) { var g = new T.Group(); g.position.set(x, groundY(x, z), z); g.rotation.y = rot || 0; g.add(mesh(new T.BoxGeometry(0.75, 0.18, 1.9), white, 0, 0.3, 0)); var back = mesh(new T.BoxGeometry(0.75, 0.12, 0.8), white, 0, 0.55, -0.85); back.rotation.x = -0.7; g.add(back); dyn.add(g); return g; }

    /* ---------- beach bars, umbrellas, boats, the skyline ---------- */
    var beachBits = new T.Group(); dyn.add(beachBits);
    function shack(x, z) { var g = new T.Group(); g.position.set(x, groundY(x, z), z); g.add(mesh(new T.BoxGeometry(6, 1.1, 2.2), mat('bar', { color: 0x8a5a2b, roughness: 0.8 }), 0, 0.55, 0)); [[-2.8, -0.9], [2.8, -0.9], [-2.8, 0.9], [2.8, 0.9]].forEach(function (q) { g.add(mesh(new T.CylinderGeometry(0.08, 0.08, 3, 6), mat('post', { color: 0x6b4423 }), q[0], 1.5, q[1])); }); var roof = mesh(new T.ConeGeometry(4.6, 1.4, 4, 1), mat('thatch', { color: 0xc8a25e, roughness: 1 }), 0, 3.6, 0); roof.rotation.y = Math.PI / 4; roof.scale.set(1.4, 1, 0.75); g.add(roof); beachBits.add(g); return g; }
    function boat(colr) { var g = new T.Group(); var hull = mesh(new T.CylinderGeometry(0.6, 0.35, 4.2, 10, 1), mat('hull' + colr, { color: colr, roughness: 0.4 }), 0, 0, 0); hull.rotation.z = Math.PI / 2; hull.scale.set(1, 1, 0.55); g.add(hull); g.add(mesh(new T.BoxGeometry(1.2, 0.5, 0.7), white, -0.4, 0.45, 0)); S3.add(g); return g; }
    var skyline = new T.Group(); S3.add(skyline);
    // Eko Atlantic: a cluster of glass towers far off along the coast, softened by the haze.
    (function () { var r = rnd(19), glassT = mat('tower', { color: 0x7f97ab, roughness: 0.25, metalness: 0.5 }); for (var i = 0; i < 22; i++) { var h = 40 + r() * 110, w = 14 + r() * 16; var b = new T.Mesh(new T.BoxGeometry(w, h, w), glassT); b.position.set(-1150 + i * 30 + r() * 20, h / 2 - 2, 1000 + r() * 200); skyline.add(b); } })();
    var jetski = boat(0xffffff), sail = boat(0xf2f2f2); sail.add(mesh(new T.ConeGeometry(1.2, 5, 3), mat('sail', { color: 0xffffff, side: T.DoubleSide }), 0, 3, 0));

    /* ---------- people, signs, the gem ---------- */
    var SKIN = [0x6b4029, 0x8a5a3c, 0x4a2c1c, 0x9b6a4b], CL = [0xc0392b, 0x2f6fa0, 0xf2b600, 0x2fa36b, 0x8e44ad, 0xe67e22, 0xf4f3ec, 0x17181a];
    function person(i, female) {
      var g = new T.Group(), skin = mat('skin' + i % 4, { color: SKIN[i % 4], roughness: 0.75 }), cloth = mat('cl' + i % 8, { color: CL[i % 8], roughness: 0.7 });
      var legs = []; [-1, 1].forEach(function (s) { var lg = new T.Group(); lg.position.set(0, 0.9, s * 0.1); var m = new T.Mesh(new T.CapsuleGeometry(0.075, 0.7, 4, 8), female ? skin : mat('shorts' + i % 3, { color: [0x1f3b63, 0xd8cfb8, 0x2b2f36][i % 3], roughness: 0.8 })); m.position.y = -0.45; m.castShadow = true; lg.add(m); g.add(lg); legs.push(lg); });
      var torso = new T.Mesh(female ? new T.CylinderGeometry(0.18, 0.32, 0.9, 12) : new T.CapsuleGeometry(0.2, 0.45, 4, 10), cloth); torso.position.y = female ? 1.25 : 1.3; torso.castShadow = true; g.add(torso);
      [-1, 1].forEach(function (s) { var a = new T.Mesh(new T.CapsuleGeometry(0.055, 0.55, 4, 6), skin); a.position.set(0, 1.3, s * 0.26); a.castShadow = true; g.add(a); });
      var head = new T.Mesh(new T.SphereGeometry(0.15, 14, 10), skin); head.position.y = 1.85; head.castShadow = true; g.add(head);
      var hair = new T.Mesh(new T.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('hair', { color: 0x1a1410, roughness: 0.9 })); hair.position.y = 1.87; g.add(hair);
      g.userData.legs = legs; return g;
    }
    function sprite(text, bg, fg, w) {
      var c = document.createElement('canvas'); c.width = 512; c.height = 96; var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
      var s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false })); s.renderOrder = 20; s.userData = { c: c, t: t, w: w || 6 }; label(s, text, bg, fg); return s;
    }
    function label(s, text, bg, fg) { var k = text + bg; if (s.userData.k === k) return; s.userData.k = k; var c = s.userData.c, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.font = '800 40px system-ui, sans-serif'; var tw = Math.min(c.width - 6, g.measureText(text).width + 40); g.fillStyle = bg; g.beginPath(); if (g.roundRect) g.roundRect((c.width - tw) / 2, 14, tw, 64, 32); else g.rect((c.width - tw) / 2, 14, tw, 64); g.fill(); g.fillStyle = fg || '#17181a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, 47); s.userData.t.needsUpdate = true; s.scale.set(s.userData.w, s.userData.w * 96 / 512, 1); }
    var signs = [], crowd = [], me = null, meTag = null, gem = null, bubble = null, bubbleAt = 0;
    // Strollers along the waterline: scenery, not tappable.
    var strollers = []; for (var si = 0; si < 10; si++) { var sp0 = person(20 + si, si % 2 === 1); sp0.traverse(function (o) { o.userData.scenery = true; }); S3.add(sp0); strollers.push(sp0); }
    function syncSigns() {
      var acts = sc.acts || [];
      while (signs.length < Math.min(8, acts.length)) { var s = sprite('', '#fff'); world.add(s); signs.push(s); }
      signs.forEach(function (s, i) { var a = acts[i]; s.visible = !!a; if (!a) return; var q = SPOTS[i]; s.position.set(q[0], groundY(q[0], q[1]) + 4.2 + (i % 2) * 0.8, q[1]); label(s, a.icon + ' ' + a.short, a.off ? 'rgba(235,235,235,.85)' : '#ffffff', a.off ? '#6b7280' : '#17181a'); s.userData.act = i; });
    }
    function syncPeople() {
      var list = sc.people || [];
      while (crowd.length < list.length) { var p = person(crowd.length, crowd.length % 2 === 1); world.add(p); crowd.push(p); }
      crowd.forEach(function (p, i) { var d = list[i]; p.visible = !!d; if (!d) return; p.userData.person = i; var q = SPOTS[(d.slot || i) % SPOTS.length]; p.userData.home = [q[0] + Math.cos(i * 2.3) * 2.2, q[1] + 1.5 + Math.sin(i * 2.3) * 1.6]; p.traverse(function (o) { o.userData.person = i; }); });
      if (sc.me && !me) { me = person(9, false); meTag = sprite('You', '#2f6fd0', '#fff', 2.4); world.add(me); world.add(meTag); }
      if (me) { me.visible = meTag.visible = !!sc.me; }
      if (sc.gem && !gem) { gem = new T.Mesh(new T.OctahedronGeometry(0.6, 0), new T.MeshPhysicalMaterial({ color: 0x33c3f0, roughness: 0, metalness: 0.1, clearcoat: 1, emissive: 0x0c5a7a, emissiveIntensity: 0.6 })); gem.castShadow = true; gem.traverse(function (o) { o.userData.gem = true; }); world.add(gem); }
      if (gem) gem.visible = !!sc.gem;
    }

    /* ---------- build per place ---------- */
    var built = '';
    function build() {
      var key = (sc.villas ? 'v' : 'b') + (sc.name || ''); if (key === built) return; built = key;
      dyn.clear(); palms = []; villas = new T.Group(); beachBits = new T.Group(); dyn.add(villas, beachBits);
      if (sc.villas) { [-38, -12, 14, 40].forEach(function (x) { villa(x, x === -12); }); } // the view is from the -12 villa's terrace
      else { shack(-22, 2); shack(26, 3); }
      [[-30, 3, 9, 0.3], [-22, -6, 11, -0.2], [-4, 5, 8.5, 0.4], [10, -4, 10, -0.3], [20, 4, 9.5, 0.2], [33, -6, 11, -0.25], [-42, -8, 10, 0.2], [44, 2, 9, -0.3], [-25, -24, 12, 0.1], [2, -25, 11, -0.1], [28, -24, 12, 0.15], [-2, -21, 9, 0.35]].forEach(function (q) { palm(q[0], q[1], q[2], q[3]); });
      [[-30, 9], [-20, 10.5], [-8, 9.5], [4, 10.5], [16, 9.5], [28, 10.5], [40, 9.5]].forEach(function (q, i) { var u = umbrella(q[0], groundY(q[0], q[1]), q[1], 1); dyn.add(u); lounger(q[0] - 1, q[1] + 1.2, 0.2); lounger(q[0] + 1, q[1] + 1.2, -0.2); if (i % 2) { u.children[1].material = mat('umbW', { color: 0xf4f1ea, roughness: 0.7, side: T.DoubleSide }); u.children[2].material = u.children[1].material; } });
    }

    /* ---------- camera: a terrace view toward the sea; drag to orbit, wheel or pinch to zoom ---------- */
    // The view starts from a villa's upper terrace, looking down over its pool to the sea.
    var orbit = { az: 0.08, pol: 1.17, r: 40, tx: -12, ty: 0, tz: -6 }, ptrs = {}, drag = null, pinch0 = 0, moved = false;
    function place() { orbit.pol = Math.max(0.55, Math.min(1.42, orbit.pol)); orbit.r = Math.max(10, Math.min(140, orbit.r)); var s = Math.sin(orbit.pol); cam.position.set(orbit.tx + orbit.r * s * Math.sin(orbit.az), orbit.ty + orbit.r * Math.cos(orbit.pol), orbit.tz - orbit.r * s * Math.cos(orbit.az)); cam.lookAt(orbit.tx, orbit.ty + 2, orbit.tz); }
    place();
    cv.addEventListener('pointerdown', function (e) { ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; drag = { x: e.clientX, y: e.clientY }; moved = false; var a = Object.values(ptrs); if (a.length === 2) pinch0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
    cv.addEventListener('pointermove', function (e) { if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; var a = Object.values(ptrs); if (a.length === 2 && pinch0) { var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); orbit.r *= pinch0 / Math.max(1, d); pinch0 = d; moved = true; place(); return; } if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; orbit.az -= dx * 0.005; orbit.pol -= dy * 0.004; drag = { x: e.clientX, y: e.clientY }; place(); });
    function up(e) { delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch0 = 0; if (!Object.keys(ptrs).length) drag = null; }
    cv.addEventListener('pointerup', function (e) { var mv = moved; up(e); if (!mv) tap(e); }); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function (e) { e.preventDefault(); orbit.r *= Math.exp(e.deltaY * 0.0012); place(); }, { passive: false });
    var ray = new T.Raycaster(), ndc = new T.Vector2();
    function tap(e) {
      var r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
      var sh = ray.intersectObjects(signs.filter(function (s) { return s.visible; }), false)[0]; if (sh && opts.onAct) { opts.onAct(sh.object.userData.act); return; }
      var hit = ray.intersectObjects(world.children, true).filter(function (h) { return h.object.userData.gem || h.object.userData.person != null; })[0];
      if (!hit) return; if (hit.object.userData.gem) { if (opts.onGem && sc.gem) opts.onGem(sc.gem.n); return; }
      var d = (sc.people || [])[hit.object.userData.person]; if (d) { if (d.npc && opts.onNpc) opts.onNpc(d.npc); if (!bubble) { bubble = sprite('', '#fff', '#17181a', 9); world.add(bubble); } label(bubble, (d.label + ': ' + (d.line || '')).slice(0, 48), '#ffffff', '#17181a'); bubble.position.copy(crowd[hit.object.userData.person].position).add(new T.Vector3(0, 3.2, 0)); bubble.visible = true; bubbleAt = performance.now(); }
    }
    var bar = document.createElement('div'); bar.className = 'iv-spin';
    bar.innerHTML = '<button type="button" class="pg-zbtn" data-b3="photo" aria-label="Take a photo">📷</button><button type="button" class="pg-zbtn" data-b3="in" aria-label="Zoom in">+</button><button type="button" class="pg-zbtn" data-b3="out" aria-label="Zoom out">−</button><button type="button" class="pg-zbtn" data-b3="l" aria-label="Turn left">⟲</button><button type="button" class="pg-zbtn" data-b3="r" aria-label="Turn right">⟳</button>';
    el.appendChild(bar);
    bar.addEventListener('click', function (e) { var b = e.target.closest('[data-b3]'); if (!b) return; var a = b.getAttribute('data-b3'); if (a === 'photo') { if (opts.onPhoto) opts.onPhoto(cv); return; } if (a === 'in') orbit.r *= 0.8; else if (a === 'out') orbit.r *= 1.25; else orbit.az += (a === 'l' ? 1 : -1) * Math.PI / 6; place(); });

    /* ---------- frame ---------- */
    function size() { var w = el.clientWidth || 360, h = el.clientHeight || 400; if (w === W && h === H) return; W = w; H = h; renderer.setSize(W, H, false); cv.style.width = W + 'px'; cv.style.height = H + 'px'; cam.aspect = W / H; cam.updateProjectionMatrix(); }
    function frame(now) {
      size(); var t = reduce ? 3 : now / 1000, night = sc.night ? 1 : 0, rain = sc.weather === 'rain' || sc.weather === 'storm';
      var nv = night ? 0.85 : 0; if (Math.abs(skyU.night.value - nv) > 0.01) { skyU.night.value += (nv - skyU.night.value) * 0.1; if (Math.abs(skyU.night.value - nv) <= 0.01) { skyU.night.value = nv; bakeEnv(); } } hemi.intensity = night ? 0.25 : rain ? 0.6 : 0.85; sun.intensity = night ? 0.15 : rain ? 0.7 : 2.2; sun.color.set(night ? 0x8fa8ff : 0xffe2b8);
      S3.fog.color.set(night ? 0x0b1020 : rain ? 0xa9b2b8 : sc.weather === 'harmattan' ? 0xd9c49a : HAZE); S3.fog.density = rain ? 0.006 : sc.weather === 'harmattan' ? 0.0055 : 0.0029;
      poolM.emissive.set(night ? 0x1fa9c9 : 0x000000); poolM.emissiveIntensity = night ? 0.9 : 0; // underwater lights after dark
      if (!reduce) waves(t);
      foam.position.z = SEA0 - 1 + Math.sin(t * 0.8) * 1.6; foam.material.opacity = 0.65 + Math.sin(t * 0.8 + 1) * 0.3; wet.position.z = SEA0 - 3.5 + Math.sin(t * 0.8 - 0.6) * 1.2;
      jetski.position.set(-60 + ((t * 9) % 140), -0.2 + Math.sin(t * 3) * 0.15, SEA0 + 30); jetski.rotation.y = 0; sail.position.set(80 - ((t * 1.5) % 200), -0.3, 180); sail.rotation.z = Math.sin(t) * 0.04;
      palms.forEach(function (o) { o.userData.crown.rotation.z = Math.sin(t * 0.9 + o.position.x) * 0.04; });
      crowd.forEach(function (p, i) { if (!p.visible || !p.userData.home) return; var hx = p.userData.home[0], hz = p.userData.home[1], u = reduce ? 0 : Math.sin(t * 0.25 + i), x = hx + u * 2.5, z = hz + Math.cos(t * 0.2 + i) * 1.2; p.position.set(x, groundY(x, z), z); p.rotation.y = Math.cos(t * 0.25 + i) > 0 ? Math.PI / 2 : -Math.PI / 2; var a = reduce ? 0 : Math.sin(t * 6 + i) * 0.45; p.userData.legs[0].rotation.z = a; p.userData.legs[1].rotation.z = -a; });
      if (me && sc.me) { var q = SPOTS[(sc.meSlot || 5) % SPOTS.length], mx = q[0] + 1.6, mz = q[1] + 2.5; me.position.set(mx, groundY(mx, mz), mz); label(meTag, sc.me.say ? sc.me.say.slice(0, 40) : 'You', '#2f6fd0', '#fff'); meTag.scale.set(sc.me.say ? 9 : 2.4, (sc.me.say ? 9 : 2.4) * 96 / 512, 1); meTag.position.set(mx, me.position.y + 2.7, mz); }
      if (gem && sc.gem) { var gq = SPOTS[sc.gem.slot % SPOTS.length]; gem.position.set(gq[0] - 2.5, groundY(gq[0] - 2.5, gq[1] + 2) + 1.2 + Math.sin(t * 2) * 0.25, gq[1] + 2); gem.rotation.y = t * 1.5; }
      strollers.forEach(function (p, i) { var x = -50 + ((i * 13 + (reduce ? 0 : t * (i % 2 ? 0.9 : -0.8))) % 100 + 100) % 100, z = SEA0 - 4 + (i % 3) * 1.2; p.position.set(x, groundY(x, z), z); p.rotation.y = i % 2 ? Math.PI / 2 : -Math.PI / 2; var a = reduce ? 0 : Math.sin(t * 6 + i) * 0.45; p.userData.legs[0].rotation.z = a; p.userData.legs[1].rotation.z = -a; });
      if (bubble && bubble.visible && now - bubbleAt > 3500) bubble.visible = false;
      signs.forEach(function (s) { s.visible = s.visible && !sc.clean; });
      renderer.render(S3, cam);
      raf = el.isConnected ? root.requestAnimationFrame(frame) : 0;
    }
    return {
      el: el, canvas: cv, is3d: true,
      update: function (next) { sc = next || sc; build(); syncSigns(); syncPeople(); cv.setAttribute('aria-label', (sc.name || 'The beach') + ' in 3D. Drag to look around, tap a sign to do it.'); if (!raf && el.isConnected) raf = root.requestAnimationFrame(frame); },
      start: function () { if (!raf) raf = root.requestAnimationFrame(frame); },
      stop: function () { if (raf) root.cancelAnimationFrame(raf); raf = 0; }
    };
  }
  root.LasgidiBeach3D = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
