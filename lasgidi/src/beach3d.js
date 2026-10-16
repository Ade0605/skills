/* Lasgidi: the beach in real 3D (three.js, WebGL). Built from shapes and procedural textures, no photos:
   a hazy golden-hour sky with the sun's glow, an animated sea (turquoise shallows into deep blue, glinting),
   a foam line washing up the shore, rippled white sand, feathery palms, and, at White Sand Beach, modern white
   villas with infinity pools, turquoise umbrellas, daybeds and lawns. Eko Atlantic's towers stand in the haze.
   Same interface as the 2D walk-in renderer: create(opts) → { el, update(scene), start, stop, canvas }.
   Action signs float over their spots (tap → opts.onAct(i)); people walk the sand; drag to orbit, pinch to zoom. */
(function (root) {
  'use strict';
  var SPOTS = [[-16, -6], [-6, -4], [4, -5], [14, -4], [-12, 4], [-2, 6], [8, 5], [18, 4]];
  var SPOTS_HARBOUR = [[-42, -32], [0, -42], [42, -32], [-58, 34], [58, 38], [-34, 58], [34, 60], [0, -62]];
  var SPOTS_STADIUM = [[-40, -48], [-20, -49], [0, -49], [20, -49], [40, -48], [-30, -52], [10, -52], [30, -52]];
  var SPOTS_STREET = [[-16, -17], [-8, -17.5], [0, -17.5], [8, -17.5], [16, -17], [-12, -19.5], [4, -19.5], [14, -19.5]];
  var SPOTS_CLUB = [[-15, -3], [-6, -7], [6, -7], [15, -3], [-17, 11], [-7, 4], [7, 4], [17, 11]];
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
    function bakeEnv() { if (envRT) envRT.dispose(); envRT = pmrem.fromScene(envScene, 0.02); S3.environment = CLUB && !ROOF ? null : envRT.texture; }
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
    function SP() { return STAD ? (sc.street ? SPOTS_STREET : SPOTS_STADIUM) : CLUB ? SPOTS_CLUB : HARBOUR ? SPOTS_HARBOUR : SPOTS; }
    var ESTATE = false, HARBOUR = false, CLUB = false, ROOF = false, STAD = false; // Lekki Hyde Park: lawns and a lake; Harbour Live: a paved island in the harbour
    function groundY(x, z) { if (CLUB || STAD) return 0.05; if (HARBOUR) return 1.2; if (ESTATE) return z < -28 ? 1.0 : 1.0 + Math.sin(x * 0.031) * Math.cos(z * 0.027) * 0.45 * Math.min(1, (z + 28) / 20); if (z < SAND0 + 2) return 1.0; var slope = Math.min(1.1, (z - SAND0) / SAND_D), fade = Math.min(1, (z - SAND0) / 6); return 0.95 - slope * 1.5 + (Math.sin(x * 0.21) * Math.cos(z * 0.33) * 0.1 + Math.sin(x * 0.05 + z * 0.1) * 0.2) * fade; }

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

    /* ---------- Lekki Hyde Park: golf lawns, a lake with a fountain, arched bridges, the skyline ---------- */
    var estateG = new T.Group(); estateG.visible = false; S3.add(estateG); var spray = [], estateBuilt = false;
    var LAKE = { x: 4, z: 36, rx: 50, rz: 22 };
    function lakeShape(scale) { var sh = new T.Shape(); for (var i = 0; i <= 64; i++) { var a = i / 64 * Math.PI * 2, wob = 1 + Math.sin(a * 3) * 0.08 + Math.cos(a * 2) * 0.06; var x = Math.cos(a) * LAKE.rx * wob * scale, y = Math.sin(a) * LAKE.rz * wob * scale * (Math.cos(a) > 0.4 ? 0.8 : 1); if (i) sh.lineTo(x, y); else sh.moveTo(x, y); } return sh; }
    function bridge(x, z, L, rotY) {
      var sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(0, 1.0); sh.quadraticCurveTo(L / 2, 3.0, L, 1.0); sh.lineTo(L, 0); sh.lineTo(0, 0);
      [0.22, 0.5, 0.78].forEach(function (u) { var h = new T.Path(), cx = L * u, r = L * (u === 0.5 ? 0.14 : 0.09); h.moveTo(cx - r, 0); h.absarc(cx, 0, r, Math.PI, 0, true); h.lineTo(cx - r, 0); sh.holes.push(h); });
      var g = new T.Group(); g.position.set(x, 0.4, z); g.rotation.y = rotY || 0;
      var body = mesh(new T.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false }), mat('stone', { color: 0xf1ece2, roughness: 0.7 }), -L / 2, 0, -1.5); g.add(body);
      for (var i = 0; i <= 20; i++) { var u = i / 20, px = -L / 2 + u * L, py = 1.0 + (1 - Math.pow(2 * u - 1, 2)) * 1.0; [-1.45, 1.45].forEach(function (zz) { g.add(mesh(new T.BoxGeometry(0.12, 0.7, 0.12), mat('stone', {}), px, py + 0.35, zz)); }); }
      estateG.add(g); return g;
    }
    function buildEstate() {
      if (estateBuilt) return; estateBuilt = true;
      var lg = new T.PlaneGeometry(700, 360, 140, 72); lg.rotateX(-Math.PI / 2); lg.translate(0, 0, 150); var lp = lg.attributes.position;
      for (var i = 0; i < lp.count; i++) { var x = lp.getX(i), z = lp.getZ(i), dx = (x - LAKE.x) / LAKE.rx, dz = (z - LAKE.z) / LAKE.rz, inLake = dx * dx + dz * dz; lp.setY(i, (z < -28 ? 1.0 : 1.0 + Math.sin(x * 0.031) * Math.cos(z * 0.027) * 0.45 * Math.min(1, (z + 28) / 20)) - (inLake < 1.25 ? (1.25 - inLake) * 1.2 : 0)); }
      lg.computeVertexNormals(); var golf = mesh(lg, mat('golf', { map: grassTex, roughness: 0.95 }), 0, 0, 0); golf.castShadow = false; estateG.add(golf);
      var rim = mesh(new T.ShapeGeometry(lakeShape(1.04), 64).rotateX(-Math.PI / 2), mat('pebble', { color: 0xa9a294, roughness: 1 }), LAKE.x, 0.42, LAKE.z); rim.castShadow = false; estateG.add(rim);
      var lake = new T.Mesh(new T.ShapeGeometry(lakeShape(1), 64).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0xa9cdd6, roughness: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 })); lake.position.set(LAKE.x, 0.46, LAKE.z); lake.receiveShadow = true; estateG.add(lake);
      // A second, smaller lake far off with its own bridge.
      var far = new T.Mesh(new T.CircleGeometry(1, 48).rotateX(-Math.PI / 2), lake.material); far.scale.set(34, 1, 10); far.position.set(-80, 0.6, 140); estateG.add(far);
      bridge(-38, 28, 16, Math.PI / 2 - 0.25); bridge(-80, 140, 12, 0.1);
      // The fountain in the middle of the lake.
      estateG.add(mesh(new T.CylinderGeometry(0.8, 1.0, 0.4, 20), mat('stone', {}), LAKE.x, 0.55, LAKE.z));
      for (var f = 0; f < 70; f++) { var d = mesh(new T.SphereGeometry(0.12 + (f % 3) * 0.05, 6, 4), mat('sprayM', { color: 0xf4fbff, roughness: 0.2, transparent: true, opacity: 0.8 }), LAKE.x, 1, LAKE.z); d.castShadow = false; estateG.add(d); spray.push(d); }
      // Paths round the lake and a golf green with its flag and a bunker.
      for (var k = 0; k < 48; k++) { var a = k / 48 * Math.PI * 2, px = LAKE.x + Math.cos(a) * (LAKE.rx + 7), pz = LAKE.z + Math.sin(a) * (LAKE.rz + 5); if (pz < 22) continue; var seg = mesh(new T.BoxGeometry(6.6, 0.06, 1.8), mat('path', {}), px, groundY(px, pz) + 0.05, pz); seg.rotation.y = -a + Math.PI / 2; seg.castShadow = false; estateG.add(seg); }
      [[60, 30], [-58, 46]].forEach(function (q) { estateG.add(mesh(new T.CylinderGeometry(0.04, 0.04, 2.4, 6), mat('fpole', { color: 0xffffff }), q[0], groundY(q[0], q[1]) + 1.2, q[1])); var fl = mesh(new T.PlaneGeometry(0.9, 0.55), mat('flagR', { color: 0xd23b2f, side: T.DoubleSide }), q[0] + 0.45, groundY(q[0], q[1]) + 2.1, q[1]); estateG.add(fl); var b = mesh(new T.CircleGeometry(1, 24).rotateX(-Math.PI / 2), mat('bunker', { color: 0xe9dcc0, roughness: 1 }), q[0] - 6, groundY(q[0] - 6, q[1] + 3) + 0.04, q[1] + 3); b.scale.set(4, 1, 2); b.castShadow = false; estateG.add(b); });
      // Clumps of shade trees and palms round the edges.
      var r = rnd(31), treeM = mat('estTree', { color: 0x3f7f3a, roughness: 0.9, flatShading: true });
      for (var t2 = 0; t2 < 46; t2++) { var tx = -200 + r() * 400, tz = 150 + r() * 90; if (Math.abs(tx - LAKE.x) < 50 && Math.abs(tz - LAKE.z) < 22) continue; var cr = mesh(new T.IcosahedronGeometry(2.5 + r() * 2.5, 1), treeM, tx, groundY(tx, tz) + 3 + r() * 2, tz); estateG.add(cr); estateG.add(mesh(new T.CylinderGeometry(0.3, 0.4, 3, 6), trunkM, tx, groundY(tx, tz) + 1.5, tz)); }
      // A row of lakeside homes on the far bank.
      for (var hh = 0; hh < 12; hh++) { var hx = -150 + hh * 28, hz = 190 + (hh % 2) * 8; estateG.add(mesh(new T.BoxGeometry(14, 6, 9), white, hx, groundY(hx, hz) + 3, hz)); estateG.add(mesh(new T.BoxGeometry(10, 3.5, 7), white, hx - 1, groundY(hx, hz) + 7.7, hz)); estateG.add(mesh(new T.BoxGeometry(11, 2.2, 0.2), glassM, hx, groundY(hx, hz) + 2.6, hz - 4.6)); }
      // The city skyline on the horizon, larger here as in a view across the estate.
      var gt = mat('tower2', { color: 0x8aa0b2, roughness: 0.25, metalness: 0.5 });
      for (var sk = 0; sk < 46; sk++) { var h = 22 + r() * (sk % 5 === 0 ? 110 : 60), w = 9 + r() * 12, x = -700 + sk * 26 + r() * 14 + (sk > 26 ? 160 : 0); var tw = new T.Mesh(new T.BoxGeometry(w, h, w), gt); tw.position.set(x, h / 2, 760 + r() * 140); estateG.add(tw); if (r() < 0.35) { var sp2 = new T.Mesh(new T.ConeGeometry(w * 0.3, h * 0.25, 4), gt); sp2.position.set(x, h + h * 0.12, tw.position.z); estateG.add(sp2); } }
    }

    /* ---------- Harbour Live: fountain show, concert stage, crowd, LED bridges, billboards, the private club ---------- */
    var harbourG = new T.Group(); harbourG.visible = false; S3.add(harbourG); var harbourBuilt = false, HB = { jets: [], beams: [], cables: [], screens: [], crowd: null, crowdN: 0, boards: [] };
    var HEADLINERS = ['KAYODE BLAZE', 'AMARA SOL', 'DJ TIDEWAVE', 'BIG TEMI', 'ZINO'];
    function screenTex(w, h, draw) { var t = canvasTex(w, h, function () {}); t.userData.redraw = draw; return t; }
    function emissiveMat(color, opacity) { return new T.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity == null ? 0.85 : opacity, blending: T.AdditiveBlending, depthWrite: false }); }
    function cableBridge(x0, z0, x1, z1) {
      var g = new T.Group(), dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
      g.position.set(x0, 0, z0); g.rotation.y = -ang;
      g.add(mesh(new T.BoxGeometry(L, 1.2, 12), mat('deck', { color: 0xc9ced3, roughness: 0.6 }), L / 2, 6, 0));
      g.add(mesh(new T.BoxGeometry(L, 0.3, 11), mat('road2', { color: 0x3a3f46, roughness: 0.9 }), L / 2, 6.7, 0));
      for (var k = 0; k < L; k += 40) g.add(mesh(new T.CylinderGeometry(1.2, 1.6, 6, 10), mat('pier', { color: 0xb9c0c7 }), k + 20, 3, 0));
      var px = L * 0.32, ph = 70; [-4.5, 4.5].forEach(function (zz) { var leg = mesh(new T.BoxGeometry(2.2, ph, 2.2), mat('pylon', { color: 0xeef1f3, roughness: 0.4 }), px, ph / 2, zz); leg.rotation.x = zz > 0 ? -0.06 : 0.06; g.add(leg); });
      g.add(mesh(new T.BoxGeometry(2.4, 2.4, 11), mat('pylon', {}), px, ph - 2, 0));
      for (var c = 1; c <= 9; c++) [-1, 1].forEach(function (sd) { [-5.4, 5.4].forEach(function (zz) { var ex = sd > 0 ? px + c * (L * 0.075) : px - c * (px / 10) /* the back span stays short */, pts = [new T.Vector3(px, ph - 4 - c * 2.6, zz * 0.5), new T.Vector3(ex, 7, zz)]; var ln = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })); g.add(ln); HB.cables.push({ l: ln, k: c, sd: sd }); }); });
      for (var lm = 6; lm < L; lm += 14) [-5.6, 5.6].forEach(function (zz) { g.add(mesh(new T.CylinderGeometry(0.12, 0.12, 3, 6), mat('lamp', { color: 0x5a6068 }), lm, 8.2, zz)); var bulb = new T.Mesh(new T.SphereGeometry(0.35, 8, 6), new T.MeshBasicMaterial({ color: 0xffe28c })); bulb.position.set(lm, 9.8, zz); g.add(bulb); });
      harbourG.add(g); return g;
    }
    function towerBlock(x, z, w, h, d, grp, y0, list) {
      var t = canvasTex(64, 128, function (g, cw, ch) { var r = rnd(Math.round(x * 7 + z)); g.fillStyle = '#26303b'; g.fillRect(0, 0, cw, ch); for (var yy = 4; yy < ch; yy += 8) for (var xx = 3; xx < cw; xx += 7) { g.fillStyle = r() < 0.55 ? 'rgba(255,214,140,' + (0.5 + r() * 0.5) + ')' : 'rgba(120,150,180,.25)'; g.fillRect(xx, yy, 4, 4); } });
      var day = canvasTex(32, 128, function (g, cw, ch) { g.fillStyle = '#5d7488'; g.fillRect(0, 0, cw, ch); for (var yy = 0; yy < ch; yy += 8) { g.fillStyle = '#c9d3dc'; g.fillRect(0, yy, cw, 2); } for (var xx = 0; xx < cw; xx += 8) { g.fillStyle = 'rgba(30,45,60,.5)'; g.fillRect(xx, 0, 1, ch); } });
      var m = new T.MeshStandardMaterial({ color: 0xffffff, map: day, roughness: 0.25, metalness: 0.4, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0 }); var b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, (y0 || 0) + h / 2, z); (grp || harbourG).add(b); if (list) list.push(m); else HB.towers = (HB.towers || []).concat([m]); return b;
    }
    function buildHarbour() {
      if (harbourBuilt) return; harbourBuilt = true;
      // Water all round, and the island: a paved platform with a sea wall.
      var hw = new T.Mesh(new T.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0x1b4f6e, roughness: 0.1, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 })); hw.position.y = -0.4; harbourG.add(hw); HB.water = hw;
      var isl = new T.Shape(); [[-110, -70], [100, -75], [125, 0], [110, 120], [-90, 125], [-125, 20]].forEach(function (q, i) { if (i) isl.lineTo(q[0], q[1]); else isl.moveTo(q[0], q[1]); });
      var plat = mesh(new T.ExtrudeGeometry(isl, { depth: 1.6, bevelEnabled: false }).rotateX(Math.PI / 2), mat('paving', { color: 0xd9d2c4, roughness: 0.85 }), 0, 1.2, 0); harbourG.add(plat);
      var lawnG = mesh(new T.CircleGeometry(48, 48, Math.PI * 0.08, Math.PI * 0.84).rotateX(-Math.PI / 2), mat('conlawn', { map: grassTex, roughness: 0.95 }), 0, 1.22, 78); lawnG.rotation.y = Math.PI; harbourG.add(lawnG);
      // The fountain: a big round basin with three rings of jets and a tall centre jet.
      harbourG.add(mesh(new T.CylinderGeometry(24, 25, 1.2, 64), mat('basin', { color: 0xc9ccd1, roughness: 0.6 }), 0, 1.6, 0));
      var pool = mesh(new T.CylinderGeometry(22.5, 22.5, 0.3, 64), new T.MeshPhysicalMaterial({ color: 0x2a8fb8, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9 }), 0, 2.15, 0); harbourG.add(pool);
      var jetGeo = new T.CylinderGeometry(0.18, 0.55, 1, 10, 1, true); jetGeo.translate(0, 0.5, 0);
      [[18, 28], [12, 20], [6, 12]].forEach(function (ring, ri) { for (var j = 0; j < ring[1]; j++) { var a = j / ring[1] * Math.PI * 2, m = emissiveMat(0xffffff, 0.75), jet = new T.Mesh(jetGeo, m); jet.position.set(Math.cos(a) * ring[0], 2.2, Math.sin(a) * ring[0]); harbourG.add(jet); HB.jets.push({ m: jet, ring: ri, i: j, a: a }); } });
      var cj = new T.Mesh(jetGeo, emissiveMat(0xffffff, 0.85)); cj.position.set(0, 2.2, 0); cj.scale.set(2.2, 1, 2.2); harbourG.add(cj); HB.jets.push({ m: cj, ring: 3, i: 0, a: 0 });
      // The stage: deck, roof truss, LED wall and side screens, speaker stacks, light beams.
      var stage = new T.Group(); stage.position.set(0, 1.2, 102); harbourG.add(stage);
      stage.add(mesh(new T.BoxGeometry(46, 3, 18), mat('stagedeck', { color: 0x1c2128, roughness: 0.5 }), 0, 1.5, 0));
      [[-22, -8], [22, -8], [-22, 8], [22, 8]].forEach(function (q) { stage.add(mesh(new T.BoxGeometry(1.2, 22, 1.2), mat('truss', { color: 0x3a3f46, metalness: 0.7, roughness: 0.3 }), q[0], 11, q[1])); });
      stage.add(mesh(new T.BoxGeometry(48, 1.4, 20), mat('truss', {}), 0, 22, 0));
      var wall = screenTex(1024, 384, function (g, w, h, t) { var gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'hsl(' + (t * 30 % 360) + ',80%,30%)'); gr.addColorStop(1, 'hsl(' + ((t * 30 + 140) % 360) + ',80%,22%)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (var b = 0; b < 48; b++) { var bh = (0.2 + 0.8 * Math.abs(Math.sin(t * 3 + b * 0.5))) * h * 0.45; g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(b * (w / 48) + 2, h - bh, w / 48 - 4, bh); } g.fillStyle = '#ffffff'; g.font = '900 86px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; var off = sc.show === false, ad = Math.floor(t / 5) % 2; g.fillText(off ? (ad ? 'LAGOON BANK' : 'NEXT SHOW') : HEADLINERS[Math.floor(t / 6) % HEADLINERS.length], w / 2, h * 0.42); g.font = '800 34px system-ui, sans-serif'; g.fillText(off ? (ad ? 'Save small. Live large.' : 'FRI & SAT · 8PM · HARBOUR LIVE') : 'HARBOUR LIVE · TONIGHT', w / 2, h * 0.75); });
      var wallM = new T.Mesh(new T.PlaneGeometry(40, 15), new T.MeshBasicMaterial({ map: wall })); wallM.position.set(0, 12, 8.9); wallM.rotation.y = Math.PI; stage.add(wallM); HB.screens.push(wall);
      [-31, 31].forEach(function (x) { var st = screenTex(384, 512, function (g, w, h, t) { g.fillStyle = '#0d1117'; g.fillRect(0, 0, w, h); var gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w); gr.addColorStop(0, 'hsla(' + ((t * 50 + x) % 360) + ',90%,55%,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 54px system-ui'; g.textAlign = 'center'; g.fillText('LIVE', w / 2, h / 2); }); var sm = new T.Mesh(new T.PlaneGeometry(12, 16), new T.MeshBasicMaterial({ map: st })); sm.position.set(x, 13, 8); sm.rotation.y = Math.PI; stage.add(sm); stage.add(mesh(new T.BoxGeometry(1, 22, 1), mat('truss', {}), x, 11, 9)); HB.screens.push(st); });
      [-26, 26].forEach(function (x) { for (var k = 0; k < 4; k++) stage.add(mesh(new T.BoxGeometry(4, 2.6, 3.4), mat('speaker', { color: 0x15181c, roughness: 0.6 }), x, 4.3 + k * 2.7, -6)); });
      for (var bm = 0; bm < 8; bm++) { var beam = new T.Mesh(new T.ConeGeometry(4, 60, 16, 1, true).translate(0, -30, 0), emissiveMat(0xffffff, 0.12)); beam.position.set(-18 + bm * 5.1, 22, 6); stage.add(beam); HB.beams.push(beam); }
      // The crowd: a few hundred concert-goers on the lawn, jumping to the music.
      var bodyG = new T.CapsuleGeometry(0.32, 1.1, 4, 8); bodyG.translate(0, 1.1, 0); var N = 340, crowd = new T.InstancedMesh(bodyG, new T.MeshStandardMaterial({ roughness: 0.7 }), N); var headG = new T.SphereGeometry(0.26, 10, 8); headG.translate(0, 2.25, 0); var heads = new T.InstancedMesh(headG, new T.MeshStandardMaterial({ color: 0x6b4029, roughness: 0.7 }), N);
      var rr = rnd(41), tmpC = new T.Color(), base2 = []; for (var i = 0; i < N; i++) { var a2 = Math.PI * (0.12 + rr() * 0.76), d2 = 8 + rr() * 38, x = -Math.cos(a2) * d2, z = 78 - Math.sin(a2) * d2 * 0.9 + 6; base2.push([x, z, rr() * 6]); crowd.setColorAt(i, tmpC.setHSL(rr(), 0.6, 0.45)); }
      crowd.castShadow = true; harbourG.add(crowd, heads); HB.crowd = crowd; HB.heads = heads; HB.crowdN = N; HB.crowdBase = base2;
      // Billboards on the island's edge, lit at night.
      var ADS = [['LAGOON BANK', 'Save small. Live large.', '#1d5a3c'], ['JOLLOF TECH', 'Build it in Yaba', '#7b5cff'], ['EKO CEMENT', 'Lagos is built on us', '#c0392b'], ['ADVERTISE HERE', 'Billboards app · from ₦100k', '#f2b600']];
      [[-95, 10, 0.9], [95, 20, -0.9], [-60, -60, 0.4], [70, -62, -0.3]].forEach(function (q, i) { var ad = ADS[i % ADS.length], bt = canvasTex(512, 256, function (g, w, h) { g.fillStyle = ad[2]; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, h * 0.62, w, h * 0.38); g.fillStyle = '#fff'; g.font = '900 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ad[0], w / 2, h * 0.38); g.font = '700 30px system-ui, sans-serif'; g.fillText(ad[1], w / 2, h * 0.8); });
        var bg = new T.Group(); bg.position.set(q[0], 1.2, q[1]); bg.rotation.y = q[2]; bg.add(mesh(new T.CylinderGeometry(0.5, 0.6, 14, 8), mat('bpole', { color: 0x5a6068, metalness: 0.6 }), 0, 7, 0)); var face = new T.Mesh(new T.PlaneGeometry(22, 11), new T.MeshStandardMaterial({ map: bt, emissive: 0xffffff, emissiveMap: bt, emissiveIntensity: 0.25, side: T.DoubleSide })); face.position.y = 19; bg.add(face); bg.add(mesh(new T.BoxGeometry(22.6, 11.6, 0.6), mat('bframe', { color: 0x1c2128 }), 0, 19, -0.4)); harbourG.add(bg); HB.boards.push(face.material); });
      // The private club behind the stage, its glass lounge, pool deck and jetty facing the lagoon.
      var club = new T.Group(); club.position.set(-10, 1.2, 128); harbourG.add(club);
      club.add(mesh(new T.BoxGeometry(56, 9, 18), mat('clubwall', { color: 0xf3f1ec, roughness: 0.4 }), 0, 4.5, 0)); club.add(mesh(new T.BoxGeometry(40, 7, 14), mat('clubwall', {}), -4, 12.5, -1));
      var clubGlass = new T.MeshStandardMaterial({ color: 0x2c4a5c, roughness: 0.05, metalness: 0.8, emissive: 0xffc878, emissiveIntensity: 0 }); club.add(mesh(new T.BoxGeometry(50, 6.5, 0.4), clubGlass, 0, 4.5, 9.1)); club.add(mesh(new T.BoxGeometry(36, 5, 0.4), clubGlass, -4, 12.5, 6.1)); HB.clubGlass = clubGlass;
      club.add(mesh(new T.BoxGeometry(60, 0.6, 14), mat('clubdeck', { map: deckTex, roughness: 0.8 }), 0, 0.3, 16)); var cp = mesh(new T.BoxGeometry(30, 0.3, 7), poolM, -8, 0.7, 16); cp.castShadow = false; club.add(cp);
      club.add(mesh(new T.BoxGeometry(4, 0.6, 40), mat('clubdeck', {}), 18, 0, 40)); for (var jl = 0; jl < 6; jl++) { var b2 = new T.Mesh(new T.SphereGeometry(0.4, 8, 6), new T.MeshBasicMaterial({ color: 0xffe28c })); b2.position.set(18, 1.5, 24 + jl * 6.5); club.add(b2); }
      [[-24, 14], [-12, 14], [4, 14], [14, 14]].forEach(function (q) { club.add(umbrella(q[0], 0.6, q[1] + 6, 1.6)); });
      var cs = sprite('THE HARBOUR · MEMBERS', '#1c2128', '#ffd36b', 22); cs.position.set(-4, 20, 6); club.add(cs);
      // Three cable-stayed link bridges with LED cables: to the mainland, Lagos Island and Eko Atlantic.
      cableBridge(-118, 30, -480, -150); cableBridge(118, 40, 520, -40); cableBridge(70, 118, 300, 520);
      // Lamp posts round the fountain and the plaza, and lights on the stage, for the night.
      HB.lights = [];
      for (var lp = 0; lp < 14; lp++) { var la = lp / 14 * Math.PI * 2, lx = Math.cos(la) * 34, lz = Math.sin(la) * 30 - 4; harbourG.add(mesh(new T.CylinderGeometry(0.2, 0.25, 7, 6), mat('lpost', { color: 0x3a3f46, metalness: 0.6 }), lx, 4.7, lz)); var gl = new T.Mesh(new T.SphereGeometry(0.6, 10, 8), new T.MeshBasicMaterial({ color: 0xffe2a0 })); gl.position.set(lx, 8.4, lz); harbourG.add(gl); }
      [[0, 10, -4, 0xffd8a0, 900], [-50, 10, -30, 0xffd8a0, 700], [50, 10, -30, 0xffd8a0, 700], [0, 30, 96, 0xb084ff, 1600], [-30, 12, 50, 0xff6ab0, 600], [30, 12, 50, 0x5ad1ff, 600], [-10, 14, 140, 0xffc878, 800]].forEach(function (q) { var L0 = new T.PointLight(q[3], 0, 160, 1.6); L0.position.set(q[0], q[1], q[2]); L0.userData.max = q[4] / 300; harbourG.add(L0); HB.lights.push(L0); });
      // Skylines: Lagos Island across the water, Eko Atlantic beyond the third bridge, low mainland roofs behind.
      var rs = rnd(77); for (var ti = 0; ti < 18; ti++) towerBlock(560 + rs() * 220, -160 + ti * 26, 18 + rs() * 12, 50 + rs() * 140, 18 + rs() * 10);
      for (var te = 0; te < 14; te++) towerBlock(220 + te * 28 + rs() * 10, 600 + rs() * 120, 18 + rs() * 10, 70 + rs() * 120, 18 + rs() * 10);
      for (var tm = 0; tm < 26; tm++) towerBlock(-700 + tm * 30 + rs() * 12, -300 - rs() * 140, 20 + rs() * 16, 10 + rs() * 30, 20 + rs() * 16);
    }


    /* ---------- nightlife: an indoor club (LED floor, DJ booth, lasers, VIP booths) or a rooftop lounge over the city ---------- */
    var clubG = new T.Group(); clubG.visible = false; S3.add(clubG); var CB = {};
    var PALS = [[0xffb000, 0x8e44ff, 0x1a1024], [0xff2a4a, 0x2a6bff, 0x10131f], [0x19e3c8, 0xff3fa8, 0x0d1a1c]];
    function hashStr(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
    function css(c) { return '#' + c.getHexString(); }
    function dancers(n, r, spot) {
      var bodyG = new T.CapsuleGeometry(0.3, 1.0, 4, 8); bodyG.translate(0, 1.0, 0); var headG = new T.SphereGeometry(0.24, 10, 8); headG.translate(0, 2.05, 0);
      var body = new T.InstancedMesh(bodyG, new T.MeshStandardMaterial({ roughness: 0.55 }), n), head = new T.InstancedMesh(headG, new T.MeshStandardMaterial({ color: 0x5a341f, roughness: 0.7 }), n), c = new T.Color();
      for (var i = 0; i < n; i++) { var p = spot(r, i); CB.base.push([p[0], p[1], r() * 6, p[2] || 0]); body.setColorAt(i, c.setHSL(r(), 0.55, 0.3 + r() * 0.25)); }
      body.castShadow = true; clubG.add(body, head); CB.crowd = body; CB.heads = head; CB.n = n;
    }
    function sofa(x, z, rot, len, m) {
      var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
      g.add(mesh(new T.BoxGeometry(len, 0.8, 1.8), m, 0, 0.4, 0)); g.add(mesh(new T.BoxGeometry(len, 1.4, 0.5), m, 0, 1.1, -0.9));
      [-1, 1].forEach(function (s) { g.add(mesh(new T.BoxGeometry(0.5, 1.0, 1.8), m, s * (len / 2 - 0.25), 0.7, 0)); });
      clubG.add(g); return g;
    }
    function sparkler(x, y, z) {
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array(90), 3));
      var pts = new T.Points(geo, new T.PointsMaterial({ color: 0xffe9a8, size: 0.28, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); pts.position.set(x, y, z); clubG.add(pts); CB.sparks.push(pts);
      clubG.add(mesh(new T.CylinderGeometry(0.12, 0.16, 0.9, 10), mat('bottle', { color: 0x1c3a26, roughness: 0.1, metalness: 0.3 }), x, y - 0.5, z));
    }
    function bottleShelf() {
      return canvasTex(1024, 256, function (g, w, h) { var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a2a12'); gr.addColorStop(1, '#ffcf7a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (var row = 0; row < 3; row++) { var y0 = row * 85 + 80; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, y0, w, 5); for (var x = 6; x < w - 10; x += 14 + (x * 7) % 9) { var bh = 40 + (x * 13) % 30; g.fillStyle = ['rgba(30,80,40,.85)', 'rgba(120,60,20,.85)', 'rgba(220,230,240,.7)', 'rgba(20,20,30,.9)'][(x >> 3) % 4]; g.fillRect(x, y0 - bh, 9, bh); g.fillRect(x + 3, y0 - bh - 12, 3, 12); } } });
    }
    function clubBar(x, z, len, faceX) {
      clubG.add(mesh(new T.BoxGeometry(3, 3.4, len), mat('barTop', { color: 0x1a1a1f, roughness: 0.25, metalness: 0.4 }), x, 1.7, z));
      var glow = new T.Mesh(new T.PlaneGeometry(len, 0.2), new T.MeshBasicMaterial({ color: CB.pal[1] })); glow.position.set(x + faceX * 1.52, 3.2, z); glow.rotation.y = faceX * Math.PI / 2; clubG.add(glow);
      var sh = new T.Mesh(new T.PlaneGeometry(len, 6.5), new T.MeshBasicMaterial({ map: bottleShelf() })); sh.position.set(x - faceX * 3.6, 5.2, z); sh.rotation.y = faceX * Math.PI / 2; clubG.add(sh);
      for (var s = 0; s < Math.floor(len / 3); s++) { var sz = z - len / 2 + 1.5 + s * 3; clubG.add(mesh(new T.CylinderGeometry(0.45, 0.45, 0.15, 14), mat('stool', { color: 0x8a6a3a, roughness: 0.5 }), x + faceX * 2.8, 2.2, sz)); clubG.add(mesh(new T.CylinderGeometry(0.07, 0.07, 2.2, 6), frameM, x + faceX * 2.8, 1.1, sz)); }
    }
    function buildClub() {
      clubG.clear(); var key = sc.placeId || sc.name || 'club', hh = hashStr(key), r = rnd(hh), pal = PALS[hh % PALS.length];
      CB = { beams: [], lights: [], sparks: [], screens: [], towers: [], base: [], bulbs: null, pal: [new T.Color(pal[0]), new T.Color(pal[1]), new T.Color(pal[2])] };
      var title = String(sc.name || 'Club').replace(/\s*\(.*?\)/g, '').replace(/^The /, '').toUpperCase();
      if (ROOF) buildRoof(r, title); else buildRoom(r, title);
    }
    function buildRoom(r, title) {
      var A = CB.pal[0], B = CB.pal[1], RW = 60 + Math.round(r() * 10), RD = 72, RH = 18; CB.RW = RW;
      var panel = canvasTex(256, 256, function (g, w, h) { g.fillStyle = '#2a2a32'; g.fillRect(0, 0, w, h); for (var x = 0; x < w; x += 32) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x, 0, 2, h); } for (var y = 0; y < h; y += 64) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, y, w, 3); } }, [10, 2]);
      var room = new T.Mesh(new T.BoxGeometry(RW, RH, RD), new T.MeshStandardMaterial({ map: panel, roughness: 0.75, side: T.BackSide })); room.position.set(0, RH / 2, 0); room.receiveShadow = true; clubG.add(room);
      var floor = new T.Mesh(new T.PlaneGeometry(RW, RD).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0x141418, roughness: 0.18, metalness: 0.5 })); floor.position.y = 0.02; floor.receiveShadow = true; clubG.add(floor);
      // The LED dance floor: 8 by 8 tiles that ripple in the club's colours.
      var NT = 8, tiles = new T.InstancedMesh(new T.BoxGeometry(2.3, 0.12, 2.3), new T.MeshBasicMaterial({ color: 0xffffff }), NT * NT), m4 = new T.Matrix4(), c = new T.Color();
      for (var i = 0; i < NT; i++) for (var j = 0; j < NT; j++) { m4.makeTranslation(-9.45 + i * 2.7, 0.08, -3.45 + j * 2.7); tiles.setMatrixAt(i * NT + j, m4); tiles.setColorAt(i * NT + j, c.set(0x222222)); }
      clubG.add(tiles); CB.tiles = tiles; CB.NT = NT;
      // The DJ booth on its riser, with the LED wall behind.
      var booth = new T.Group(); booth.position.set(0, 0, RD / 2 - 8); clubG.add(booth);
      booth.add(mesh(new T.BoxGeometry(24, 1.6, 10), mat('riser', { color: 0x1a1a20, roughness: 0.5 }), 0, 0.8, 0));
      booth.add(mesh(new T.BoxGeometry(9, 1.3, 2), mat('djdesk', { color: 0x0e0e12, roughness: 0.3, metalness: 0.5 }), 0, 2.25, -2.5));
      [-2.4, 2.4].forEach(function (x) { booth.add(mesh(new T.CylinderGeometry(0.9, 0.9, 0.15, 24), mat('deckT', { color: 0x2b2b30, metalness: 0.6, roughness: 0.3 }), x, 3.0, -2.5)); });
      var strip = new T.Mesh(new T.PlaneGeometry(9, 0.25), new T.MeshBasicMaterial({ color: A })); strip.position.set(0, 2.5, -3.52); strip.rotation.y = Math.PI; booth.add(strip);
      var dj = person(3, false); dj.position.set(0, 1.6, -0.8); dj.rotation.y = Math.PI / 2; booth.add(dj);
      [-11, 11].forEach(function (x) { for (var k = 0; k < 3; k++) booth.add(mesh(new T.BoxGeometry(3, 2.4, 2.6), mat('speaker', { color: 0x15181c, roughness: 0.6 }), x, 2.8 + k * 2.5, 1)); });
      var wall = screenTex(1024, 384, function (g, w, h, t) {
        if (!CB.open) { g.fillStyle = '#0d0f14'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '900 80px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(title, w / 2, h * 0.42, w - 60); g.font = '700 34px system-ui, sans-serif'; g.fillText('CLOSED · DOORS OPEN 10PM', w / 2, h * 0.72); return; }
        var gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, css(A)); gr.addColorStop(1, css(B)); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,' + (0.35 + 0.3 * Math.abs(Math.sin(t * 1.9))) + ')'; g.fillRect(0, 0, w, h);
        for (var b = 0; b < 64; b++) { var bh = (0.15 + 0.85 * Math.abs(Math.sin(t * 4 + b * 0.37) * Math.cos(t * 1.3 + b * 0.11))) * h * 0.5; g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(b * (w / 64) + 2, h - bh, w / 64 - 4, bh); }
        g.fillStyle = '#fff'; g.font = '900 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(title, w / 2, h * 0.4, w - 60); g.font = '800 34px system-ui, sans-serif'; g.fillText('TONIGHT · ' + HEADLINERS[Math.floor(t / 8) % HEADLINERS.length], w / 2, h * 0.72);
      });
      var wm = new T.Mesh(new T.PlaneGeometry(36, 13.5), new T.MeshBasicMaterial({ map: wall })); wm.position.set(0, 9.6, RD / 2 - 0.3); wm.rotation.y = Math.PI; clubG.add(wm); CB.screens.push(wall);
      // The bar along the left wall, with a back-lit bottle shelf and stools.
      clubBar(-RW / 2 + 5, 0, 27, 1);
      // VIP booths along the right wall: sofas, a table, bottles with sparklers.
      var vipM = new T.MeshStandardMaterial({ color: B.clone().multiplyScalar(0.3), roughness: 0.35 }), nb = 3 + (r() < 0.5 ? 1 : 0);
      for (var v = 0; v < nb; v++) { var vz = -22 + v * (40 / (nb - 1)), vx = RW / 2 - 4; sofa(vx, vz, -Math.PI / 2, 7, vipM); clubG.add(mesh(new T.CylinderGeometry(1.3, 1.3, 0.2, 20), mat('vipTable', { color: 0xd8c38a, metalness: 0.8, roughness: 0.25 }), vx - 3.2, 1.2, vz)); clubG.add(mesh(new T.CylinderGeometry(0.2, 0.3, 1.1, 8), frameM, vx - 3.2, 0.55, vz)); sparkler(vx - 3.2, 2.4, vz - 0.4); clubG.add(mesh(new T.BoxGeometry(0.2, 2.2, 9), mat('rope', { color: 0xa8892f, metalness: 0.8, roughness: 0.3 }), vx - 5.6, 1.1, vz)); }
      // Ceiling truss with moving heads, and the laser fan from the booth.
      [-10, 10].forEach(function (x) { clubG.add(mesh(new T.BoxGeometry(0.9, 0.9, RD - 8), mat('truss', { color: 0x3a3f46, metalness: 0.7, roughness: 0.3 }), x, RH - 1, 0)); });
      for (var cz = -24; cz <= 26; cz += 10) clubG.add(mesh(new T.BoxGeometry(22, 0.7, 0.7), mat('truss', {}), 0, RH - 1, cz));
      for (var k2 = 0; k2 < 8; k2++) { var bm = new T.Mesh(new T.ConeGeometry(2.4, 17, 16, 1, true).translate(0, -8.5, 0), emissiveMat(0xffffff, 0.1)); bm.position.set(k2 % 2 ? 10 : -10, RH - 1.9, -12 + (k2 >> 1) * 10); clubG.add(bm); CB.beams.push(bm); clubG.add(mesh(new T.BoxGeometry(0.9, 1.0, 0.9), mat('mhead', { color: 0x111114, metalness: 0.6, roughness: 0.4 }), bm.position.x, RH - 1.5, bm.position.z)); }
      var NL = 20, lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(new Float32Array(NL * 6), 3));
      CB.lasers = new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x33ff77, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })); clubG.add(CB.lasers); CB.NL = NL; CB.laserO = [0, 8.5, RD / 2 - 5];
      // Coloured washes, and a warm light over the bar.
      [[-12, 13, -6, A], [12, 13, -6, B], [-12, 13, 14, B], [12, 13, 14, A], [-RW / 2 + 6, 8, 0, new T.Color(0xffc070)]].forEach(function (q, i) { var L0 = new T.PointLight(q[3], 0, 70, 1.2); L0.position.set(q[0], q[1], q[2]); L0.userData.max = i === 4 ? 18 : 40; L0.userData.c = q[3]; clubG.add(L0); CB.lights.push(L0); });
      dancers(120, r, function (rr, i) { return i < 96 ? [-10 + rr() * 20, -4 + rr() * 20] : i < 108 ? [-RW / 2 + 9 + rr() * 3, -12 + rr() * 24] : [RW / 2 - 9 - rr() * 3, -20 + rr() * 38]; });
    }
    function buildRoof(r, title) {
      var A = CB.pal[0], B = CB.pal[1], Y0 = -70;
      var lag = new T.Mesh(new T.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0x1b4f6e, roughness: 0.1, clearcoat: 1 })); lag.position.y = Y0 - 1; clubG.add(lag); CB.water = lag;
      var streets = new T.Mesh(new T.PlaneGeometry(900, 500).rotateX(-Math.PI / 2), mat('city', { color: 0x4a4f55, roughness: 0.9 })); streets.position.set(0, Y0, -150); clubG.add(streets);
      clubG.add(mesh(new T.BoxGeometry(80, Math.abs(Y0), 64), mat('core', { color: 0xd9d4ca, roughness: 0.7 }), 0, Y0 / 2 - 0.6, 0));
      var deck = mesh(new T.BoxGeometry(76, 0.6, 60), mat('roofdeck', { map: deckTex, roughness: 0.8 }), 0, -0.3, 0); deck.castShadow = false; clubG.add(deck);
      var glassR = mat('rail', { color: 0xbfd7e0, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.4 });
      clubG.add(mesh(new T.BoxGeometry(76, 1.3, 0.15), glassR, 0, 0.65, 30)); [-38, 38].forEach(function (x) { clubG.add(mesh(new T.BoxGeometry(0.15, 1.3, 60), glassR, x, 0.65, 0)); });
      clubG.add(mesh(new T.BoxGeometry(76, 7, 1), mat('roofwall', { color: 0x2a2d31, roughness: 0.6 }), 0, 3.5, -30));
      // An infinity-edge pool strip along the front, then the city.
      clubG.add(mesh(new T.BoxGeometry(46, 0.5, 5), mat('coping', { color: 0xf1efe9, roughness: 0.5 }), 0, 0.25, 25)); var pl = mesh(new T.BoxGeometry(44, 0.1, 4), poolM, 0, 0.52, 25); pl.castShadow = false; clubG.add(pl);
      // Festoon bulbs strung across the deck.
      var bulbM = new T.MeshBasicMaterial({ color: 0xffd27a }); CB.bulbs = bulbM;
      [-18, -2, 14].forEach(function (z) { [-34, 34].forEach(function (x) { clubG.add(mesh(new T.CylinderGeometry(0.12, 0.12, 7, 6), frameM, x, 3.5, z)); }); for (var b = 0; b <= 22; b++) { var u = b / 22, bx = -34 + u * 68, by = 6.8 - Math.sin(u * Math.PI) * 1.6; var bb = new T.Mesh(new T.SphereGeometry(0.22, 8, 6), bulbM); bb.position.set(bx, by, z); clubG.add(bb); } });
      // Low sofas round tables, a fire pit, the bar on the left and a DJ corner on the right.
      var cream = mat('cream', { color: 0xefe8da, roughness: 0.8 });
      [[-20, 4, 0.2], [-6, 10, -0.1], [10, 8, 0.15], [22, 2, -0.3], [-14, -10, 0], [14, -12, 0]].forEach(function (q) { sofa(q[0], q[1], Math.PI + q[2], 6, cream); clubG.add(mesh(new T.CylinderGeometry(1.2, 1.2, 0.5, 20), mat('rtable', { color: 0x6b4a2b, roughness: 0.6 }), q[0], 0.5, q[1] + 2.4)); });
      clubG.add(mesh(new T.CylinderGeometry(2.4, 2.6, 0.9, 24), mat('pit', { color: 0x55524d, roughness: 0.9 }), 0, 0.45, -2));
      var flame = new T.Mesh(new T.ConeGeometry(1.4, 2.6, 12, 1, true).translate(0, 1.3, 0), emissiveMat(0xff8a2a, 0.75)); flame.position.set(0, 0.9, -2); clubG.add(flame); CB.flame = flame;
      var fl = new T.PointLight(0xff9a40, 0, 40, 1.4); fl.position.set(0, 3, -2); fl.userData.max = 14; fl.userData.c = new T.Color(0xff9a40); clubG.add(fl); CB.lights.push(fl);
      clubBar(-34, -6, 18, 1);
      clubG.add(mesh(new T.BoxGeometry(6, 1.4, 3), mat('djdesk', { color: 0x0e0e12 }), 30, 0.7, -14)); var dj = person(3, false); dj.position.set(32, 0, -14); clubG.add(dj);
      var sg = sprite(title, '#17181a', css(A), 14); sg.position.set(0, 9, -30); clubG.add(sg);
      [[-20, 12, B], [20, 12, A]].forEach(function (q) { var L0 = new T.PointLight(q[2], 0, 60, 1.3); L0.position.set(q[0], 8, q[1]); L0.userData.max = 16; L0.userData.c = q[2]; clubG.add(L0); CB.lights.push(L0); });
      // The city below and around: glass towers to the horizon, the lagoon beyond.
      var rs = rnd(91); for (var tb = 0; tb < 44; tb++) { var a = -1.4 + rs() * 2.8, d = 140 + rs() * 420, tx = Math.sin(a) * d, tz = Math.cos(a) * d; if (tz > 260 && Math.abs(tx) < 160) continue; towerBlock(tx, tz, 16 + rs() * 16, 30 + rs() * 150, 16 + rs() * 14, clubG, Y0, CB.towers); }
      dancers(36, r, function (rr) { return [-26 + rr() * 52, -20 + rr() * 34]; });
    }


    /* ---------- stadiums: a floodlit bowl with a live match, or a street five-a-side pitch ---------- */
    var stadG = new T.Group(); stadG.visible = false; S3.add(stadG); var ST = {};
    var TEAMS = [['LAGOS LIONS', 0x1d7a43, 0xf4f3ec], ['EKO RANGERS', 0xc0392b, 0x17181a]];
    function pitchTex(w, h, stripes) {
      return canvasTex(1024, Math.round(1024 * h / w), function (g, cw, ch) {
        for (var i = 0; i < stripes; i++) { g.fillStyle = i % 2 ? '#3f8f3a' : '#4a9c42'; g.fillRect(i * cw / stripes, 0, cw / stripes + 1, ch); }
        var k = cw / w; g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = Math.max(2, 0.12 * k);
        g.strokeRect(2 * k, 2 * k, cw - 4 * k, ch - 4 * k); g.beginPath(); g.moveTo(cw / 2, 2 * k); g.lineTo(cw / 2, ch - 2 * k); g.stroke();
        g.beginPath(); g.arc(cw / 2, ch / 2, 9.15 * k * (w / 105), 0, Math.PI * 2); g.stroke();
        [0, 1].forEach(function (sd) { var bw = 16.5 * k * (w / 105), bh = 40.3 * k * (h / 68), sw = 5.5 * k * (w / 105), sh = 18.3 * k * (h / 68), x0 = sd ? cw - 2 * k - bw : 2 * k, xs = sd ? cw - 2 * k - sw : 2 * k; g.strokeRect(x0, (ch - bh) / 2, bw, bh); g.strokeRect(xs, (ch - sh) / 2, sw, sh); g.fillStyle = '#fff'; g.beginPath(); g.arc(sd ? cw - 2 * k - 11 * k * (w / 105) : 2 * k + 11 * k * (w / 105), ch / 2, 0.3 * k + 2, 0, Math.PI * 2); g.fill(); });
        g.fillStyle = '#fff'; g.beginPath(); g.arc(cw / 2, ch / 2, 0.3 * k + 2, 0, Math.PI * 2); g.fill();
      });
    }
    function goal(x, w, hgt, dir) {
      var g = new T.Group(); g.position.set(x, 0, 0); var pm = mat('post', { color: 0xffffff, roughness: 0.4 });
      [-w / 2, w / 2].forEach(function (z) { g.add(mesh(new T.CylinderGeometry(0.07, 0.07, hgt, 8), pm, 0, hgt / 2, z)); }); var bar = mesh(new T.CylinderGeometry(0.07, 0.07, w, 8), pm, 0, hgt, 0); bar.rotation.x = Math.PI / 2; g.add(bar);
      var netT = canvasTex(128, 64, function (c, cw, ch) { c.clearRect(0, 0, cw, ch); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1; for (var i = 0; i <= cw; i += 6) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, ch); c.stroke(); } for (var j = 0; j <= ch; j += 6) { c.beginPath(); c.moveTo(0, j); c.lineTo(cw, j); c.stroke(); } });
      var netM = new T.MeshBasicMaterial({ map: netT, transparent: true, side: T.DoubleSide, depthWrite: false }), back = new T.Mesh(new T.PlaneGeometry(w, hgt), netM); back.rotation.y = Math.PI / 2; back.position.set(dir * 1.8, hgt / 2, 0); g.add(back);
      [-w / 2, w / 2].forEach(function (z) { var sd = new T.Mesh(new T.PlaneGeometry(1.8, hgt), netM); sd.position.set(dir * 0.9, hgt / 2, z); g.add(sd); }); var top = new T.Mesh(new T.PlaneGeometry(1.8, w), netM); top.rotation.x = Math.PI / 2; top.position.set(dir * 0.9, hgt, 0); g.add(top);
      stadG.add(g); return g;
    }
    function squad(n, colrs, size) {
      var bodyG = new T.CapsuleGeometry(0.3 * size, 1.0 * size, 4, 8); bodyG.translate(0, 1.0 * size, 0); var headG = new T.SphereGeometry(0.24 * size, 10, 8); headG.translate(0, 2.05 * size, 0);
      var body = new T.InstancedMesh(bodyG, new T.MeshStandardMaterial({ roughness: 0.55 }), n), head = new T.InstancedMesh(headG, new T.MeshStandardMaterial({ color: 0x5a341f, roughness: 0.7 }), n), c = new T.Color();
      for (var i = 0; i < n; i++) body.setColorAt(i, c.set(colrs(i))); body.castShadow = true; stadG.add(body, head); return { body: body, head: head, n: n };
    }
    // 4-3-3 for each side, attacking left to right for the home team.
    var FORM = [[-48, 0], [-34, -22], [-36, -8], [-36, 8], [-34, 22], [-20, -14], [-22, 0], [-20, 14], [-8, -22], [-6, 0], [-8, 22]];
    function buildStadium() {
      stadG.clear(); ST = { street: !!sc.street, towers: [], lights: [], banks: [] }; var r = rnd(hashStr((sc.placeId || 'stadium') + ':' + (sc.day || 0)));
      if (ST.street) return buildStreetPitch(r);
      var PW = 105, PH = 68; ST.PW = PW; ST.PH = PH; ST.scale = 1;
      var ground = mesh(new T.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), mat('stadOut', { color: 0x8a8d84, roughness: 0.95 }), 0, -0.05, 0); ground.castShadow = false; stadG.add(ground);
      var track = mesh(new T.PlaneGeometry(132, 92).rotateX(-Math.PI / 2), mat('track', { color: 0xb5492f, roughness: 0.9 }), 0, 0.0, 0); track.castShadow = false; stadG.add(track);
      for (var ln = 1; ln <= 6; ln++) { var lr = mesh(new T.PlaneGeometry(132 - ln * 2.4, 0.08).rotateX(-Math.PI / 2), mat('lane', { color: 0xf4efe6 }), 0, 0.01, -46 + ln * 1.2); lr.castShadow = false; stadG.add(lr); var lr2 = lr.clone(); lr2.position.z = 46 - ln * 1.2; stadG.add(lr2); }
      var pitch = mesh(new T.PlaneGeometry(PW + 6, PH + 6).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: pitchTex(PW + 6, PH + 6, 18), roughness: 0.92 }), 0, 0.03, 0); pitch.castShadow = false; stadG.add(pitch);
      goal(-PW / 2, 7.32, 2.44, -1); goal(PW / 2, 7.32, 2.44, 1);
      // The bowl: a lathe profile of tiers, squashed into an oval round the track.
      var prof = []; for (var ti = 0; ti <= 22; ti++) { prof.push(new T.Vector2(74 + ti * 1.7, 1 + ti * 1.25)); prof.push(new T.Vector2(74 + ti * 1.7 + 1.7, 1 + ti * 1.25)); }
      prof.push(new T.Vector2(74 + 23 * 1.7 + 2, 0));
      var seatT = canvasTex(1024, 128, function (g, cw, ch) { for (var x = 0; x < cw; x += 32) { g.fillStyle = (x / 32) % 3 === 0 ? '#f4f3ec' : '#1d7a43'; g.fillRect(x, 0, 32, ch); } for (var y = 0; y < ch; y += 6) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y, cw, 1); } }, [6, 1]);
      var bowl = new T.Mesh(new T.LatheGeometry(prof, 96), new T.MeshStandardMaterial({ map: seatT, roughness: 0.8, side: T.DoubleSide })); bowl.scale.set(1, 1, 0.66); bowl.receiveShadow = true; stadG.add(bowl);
      var rim = new T.Mesh(new T.CylinderGeometry(115.5, 115.5, 6, 96, 1, true), mat('rimwall', { color: 0xd9d4ca, roughness: 0.7, side: T.DoubleSide })); rim.scale.set(1, 1, 0.66); rim.position.y = 30; stadG.add(rim);
      // A canopy over the far stand, on slim supports.
      var canopy = new T.Mesh(new T.RingGeometry(84, 118, 64, 1, Math.PI * 0.18, Math.PI * 0.64).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0xeef1f3, roughness: 0.4, metalness: 0.3, side: T.DoubleSide, transparent: true, opacity: 0.92 })); canopy.scale.set(1, 1, 0.66); canopy.position.y = 40; canopy.rotation.y = 0; stadG.add(canopy);
      for (var cs = 0; cs < 9; cs++) { var ca = Math.PI * (0.2 + cs * 0.075), cx = Math.cos(ca) * 116, cz = Math.sin(ca) * 116 * 0.66; stadG.add(mesh(new T.CylinderGeometry(0.6, 0.8, 40, 8), mat('rimwall', {}), cx, 20, cz)); }
      // Floodlight masts at the four corners, light banks facing the pitch.
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
        var x = q[0] * 96, z = q[1] * 64; stadG.add(mesh(new T.CylinderGeometry(0.9, 1.4, 62, 10), mat('mast', { color: 0x9aa0a6, metalness: 0.6, roughness: 0.4 }), x, 31, z));
        var bankM = new T.MeshBasicMaterial({ color: 0x555a60 }), bank = new T.Mesh(new T.BoxGeometry(12, 6, 1), bankM); bank.position.set(x, 64, z); bank.lookAt(0, 0, 0); stadG.add(bank); ST.banks.push(bankM);
        var sl = new T.SpotLight(0xf4f7ff, 0, 260, 0.55, 0.5, 1.2); sl.position.set(x, 64, z); sl.target.position.set(-x * 0.2, 0, -z * 0.2); stadG.add(sl, sl.target); ST.lights.push(sl);
      });
      // The scoreboard above the far stand.
      ST.board = screenTex(1024, 320, function (g, w, h) {
        g.fillStyle = '#0b0f16'; g.fillRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
        if (!ST.live) { g.fillStyle = '#ffd23f'; g.font = '900 72px system-ui, sans-serif'; g.fillText(ST.title || 'NATIONAL STADIUM', w / 2, h * 0.38, w - 40); g.fillStyle = '#fff'; g.font = '700 38px system-ui, sans-serif'; g.fillText('TRAINING · KICK-OFF 6PM', w / 2, h * 0.72); return; }
        g.fillStyle = '#fff'; g.font = '800 46px system-ui, sans-serif'; g.fillText(TEAMS[0][0], w * 0.25, h * 0.3); g.fillText(TEAMS[1][0], w * 0.75, h * 0.3);
        g.fillStyle = '#ffd23f'; g.font = '900 120px system-ui, sans-serif'; g.fillText(ST.score[0] + ' – ' + ST.score[1], w / 2, h * 0.62);
        g.fillStyle = ST.flash ? '#ffd23f' : '#9fb2c2'; g.font = '800 40px system-ui, sans-serif'; g.fillText(ST.flash ? 'GOAL!' : ST.min + "'", w / 2, h * 0.9);
      });
      var bm = new T.Mesh(new T.PlaneGeometry(36, 11.25), new T.MeshBasicMaterial({ map: ST.board })); bm.position.set(0, 48, 82); bm.rotation.y = Math.PI; stadG.add(bm); stadG.add(mesh(new T.BoxGeometry(37, 12.2, 1), mat('bframe', { color: 0x1c2128 }), 0, 48, 82.7));
      ST.title = String(sc.name || 'Stadium').toUpperCase();
      ST.players = squad(22, function (i) { return i === 0 ? 0xf2b600 : i === 11 ? 0x2f6fa0 : TEAMS[i < 11 ? 0 : 1][1]; }, 1);
      var fans = 1400, fr = rnd(57), fb = []; ST.fans = squad(fans, function () { var v = fr(); return v < 0.45 ? TEAMS[0][1] : v < 0.7 ? TEAMS[0][2] : v < 0.85 ? TEAMS[1][1] : 0x2b2f36; }, 0.9);
      for (var f = 0; f < fans; f++) { var a = fr() * Math.PI * 2, tier = Math.floor(fr() * 22), rad = 74 + tier * 1.7 + 0.8; fb.push([Math.cos(a) * rad, 1 + (tier + 1) * 1.25, Math.sin(a) * rad * 0.66, fr() * 6]); } ST.fanBase = fb;
      ST.ball = mesh(new T.SphereGeometry(0.35, 14, 10), mat('ball', { color: 0xffffff, roughness: 0.5 }), 0, 0.35, 0); stadG.add(ST.ball);
    }
    function buildStreetPitch(r) {
      var PW = 40, PH = 24; ST.PW = PW; ST.PH = PH; ST.scale = 0.38;
      var dustT = canvasTex(256, 256, function (g, w, h) { var rr = rnd(9); g.fillStyle = '#c8a878'; g.fillRect(0, 0, w, h); for (var i = 0; i < 9000; i++) { g.fillStyle = rr() < 0.5 ? 'rgba(150,115,75,.25)' : 'rgba(235,215,180,.25)'; g.fillRect(rr() * w, rr() * h, 2, 2); } for (var k = 0; k < 20; k++) { g.fillStyle = 'rgba(95,140,60,.35)'; g.beginPath(); g.arc(rr() * w, rr() * h, 6 + rr() * 14, 0, Math.PI * 2); g.fill(); } }, [8, 6]);
      var ground = mesh(new T.PlaneGeometry(300, 300).rotateX(-Math.PI / 2), mat('street', { color: 0x9a9184, roughness: 0.95 }), 0, -0.05, 0); ground.castShadow = false; stadG.add(ground);
      var dirt = mesh(new T.PlaneGeometry(PW + 8, PH + 8).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: dustT, roughness: 1 }), 0, 0.02, 0); dirt.castShadow = false; stadG.add(dirt);
      var lines = canvasTex(512, 320, function (g, w, h) { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16); g.beginPath(); g.moveTo(w / 2, 8); g.lineTo(w / 2, h - 8); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 34, 0, Math.PI * 2); g.stroke(); });
      var lp = mesh(new T.PlaneGeometry(PW, PH).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: lines, transparent: true, depthWrite: false }), 0, 0.04, 0); lp.castShadow = false; stadG.add(lp);
      goal(-PW / 2, 4, 1.8, -1); goal(PW / 2, 4, 1.8, 1);
      // Chain-link fence on posts, benches, and the area's low buildings around.
      var fenceT = canvasTex(64, 64, function (g, w, h) { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(200,205,210,.8)'; g.lineWidth = 1.2; for (var i = -h; i < w; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); } }, [24, 2]);
      var fM = new T.MeshBasicMaterial({ map: fenceT, transparent: true, side: T.DoubleSide, depthWrite: false });
      [[0, -(PH / 2 + 4), PW + 8, 0], [0, PH / 2 + 4, PW + 8, 0], [-(PW / 2 + 4), 0, PH + 8, Math.PI / 2], [PW / 2 + 4, 0, PH + 8, Math.PI / 2]].forEach(function (q) { var fp = new T.Mesh(new T.PlaneGeometry(q[2], 3.2), fM); fp.position.set(q[0], 1.6, q[1]); fp.rotation.y = q[3]; stadG.add(fp); for (var k = -q[2] / 2; k <= q[2] / 2; k += 4) { var px = q[3] ? q[0] : q[0] + k, pz = q[3] ? q[1] + k : q[1]; stadG.add(mesh(new T.CylinderGeometry(0.06, 0.06, 3.3, 6), frameM, px, 1.65, pz)); } });
      [-12, 0, 12].forEach(function (x) { stadG.add(mesh(new T.BoxGeometry(5, 0.3, 0.9), mat('bench', { color: 0x8a6a3a, roughness: 0.8 }), x, 0.6, -(PH / 2 + 6))); });
      var rs = rnd(33); for (var b = 0; b < 22; b++) { var a = rs() * Math.PI * 2, d = 40 + rs() * 50; towerBlock(Math.cos(a) * d * 1.3, Math.sin(a) * d + (Math.sin(a) < 0 ? -10 : 10), 10 + rs() * 10, 6 + rs() * 14, 10 + rs() * 8, stadG, 0, ST.towers); }
      ST.players = squad(10, function (i) { return i === 0 || i === 5 ? 0xf2b600 : i < 5 ? 0xf4f3ec : 0x2f6fa0; }, 1);
      var fr = rnd(58), fb = []; ST.fans = squad(24, function () { return [0xc0392b, 0x2f6fa0, 0xf2b600, 0x2fa36b, 0x8e44ad, 0xe67e22][Math.floor(fr() * 6)]; }, 1);
      for (var f = 0; f < 24; f++) { var sdz = f % 2 ? 1 : -1; fb.push([-PW / 2 + fr() * PW, 0, sdz * (PH / 2 + 5.5 + fr() * 1.5), fr() * 6]); } ST.fanBase = fb;
      ST.ball = mesh(new T.SphereGeometry(0.3, 12, 8), mat('ball', { color: 0xffffff, roughness: 0.5 }), 0, 0.3, 0); stadG.add(ST.ball);
      ST.title = 'STREET';
    }
    // The match: players hold a shape that slides with the ball; the ball passes along arcs; a goal every 90 seconds.
    function matchFrame(t, live) {
      var P = ST.players, mx = new T.Matrix4(), PW = ST.PW, sc2 = ST.scale, n = P.n, half = n / 2;
      var step = Math.floor(t / 1.6), u = (t / 1.6) % 1, hr = function (k) { var h = Math.imul(k ^ 0x9e3779b9, 2654435761) >>> 0; return (h >>> 8) / 16777216; };
      var gcyc = Math.floor(t / 90), gu = (t % 90) / 90, scoring = live && gu > 0.94, side = hr(gcyc * 7) < 0.55 ? 0 : 1;
      var pos = function (i, bx, bz) { var home = i < half, f = FORM[Math.floor((home ? i : i - half) * 11 / half)] || FORM[0], fx = (home ? f[0] : -f[0]) * sc2, fz = f[1] * sc2 * (ST.street ? 1.1 : 1); var shift = Math.max(-PW * 0.3, Math.min(PW * 0.3, bx * 0.45)); return [fx + shift + Math.sin(t * 0.6 + i * 2.1) * 2.5 * sc2 + (live ? 0 : Math.sin(t * 0.3 + i) * 20 * sc2), fz + Math.cos(t * 0.45 + i * 1.3) * 3 * sc2 + bz * 0.15]; };
      var carrier = Math.floor(hr(step) * n), recv = Math.floor(hr(step + 1) * n), bx0, bz0;
      var ballGuess = pos(carrier, 0, 0); bx0 = ballGuess[0]; bz0 = ballGuess[1];
      var a = pos(carrier, bx0, bz0), b = pos(Math.floor(hr(step + 1) * n), bx0, bz0), bx = a[0] + (b[0] - a[0]) * u, bz = a[1] + (b[1] - a[1]) * u, by = 0.35 + Math.sin(u * Math.PI) * (hr(step * 3) < 0.3 ? 4 : 0.8) * sc2;
      if (scoring) { var gx = (side ? -1 : 1) * PW / 2 + (side ? -1 : 1) * 1.2, k2 = Math.min(1, (gu - 0.94) / 0.03); bx = a[0] + (gx - a[0]) * k2; bz = a[1] * (1 - k2); by = 0.35 + Math.sin(k2 * Math.PI) * 1.2; }
      ST.ball.position.set(bx, by, bz); ST.ball.visible = live || ST.street;
      for (var i = 0; i < n; i++) { var p = live ? pos(i, bx, bz) : [Math.cos(t * 0.25 + i * 0.6) * PW * 0.42, Math.sin(t * 0.25 + i * 0.6) * ST.PH * 0.42]; var chase = i === carrier || i === recv; if (chase && live) { p[0] += (bx - p[0]) * 0.7; p[1] += (bz - p[1]) * 0.7; } mx.makeTranslation(p[0], Math.abs(Math.sin(t * 9 + i)) * 0.12, p[1]); P.body.setMatrixAt(i, mx); P.head.setMatrixAt(i, mx); }
      P.body.count = P.head.count = live || ST.street ? n : 6; P.body.instanceMatrix.needsUpdate = P.head.instanceMatrix.needsUpdate = true;
      var goals = [0, 0]; for (var g = 0; g < gcyc; g++) goals[hr(g * 7) < 0.55 ? 0 : 1]++; if (gu > 0.97) goals[side]++;
      ST.score = goals; ST.min = Math.min(90, Math.floor((t % 5400) / 60)); ST.flash = gu > 0.97; ST.live = live;
      var F = ST.fans, jump = ST.flash ? 1 : 0.15; for (var fi = 0; fi < F.n; fi++) { var fq = ST.fanBase[fi]; mx.makeTranslation(fq[0], fq[1] + Math.max(0, Math.sin(t * (ST.flash ? 9 : 2) + fq[3])) * jump * 0.6, fq[2]); F.body.setMatrixAt(fi, mx); F.head.setMatrixAt(fi, mx); }
      F.body.count = F.head.count = live ? F.n : ST.street ? 8 : 0; F.body.instanceMatrix.needsUpdate = F.head.instanceMatrix.needsUpdate = true;
    }

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
      signs.forEach(function (s, i) { var a = acts[i]; s.visible = !!a; if (!a) return; var q = SP()[i]; s.position.set(q[0], groundY(q[0], q[1]) + 4.2 + (i % 2) * 0.8, q[1]); label(s, a.icon + ' ' + a.short, a.off ? 'rgba(235,235,235,.85)' : '#ffffff', a.off ? '#6b7280' : '#17181a'); s.userData.act = i; });
    }
    function syncPeople() {
      var list = sc.people || [];
      while (crowd.length < list.length) { var p = person(crowd.length, crowd.length % 2 === 1); world.add(p); crowd.push(p); }
      crowd.forEach(function (p, i) { var d = list[i]; p.visible = !!d; if (!d) return; p.userData.person = i; var q = SP()[(d.slot || i) % SP().length]; p.userData.home = [q[0] + Math.cos(i * 2.3) * 2.2, q[1] + 1.5 + Math.sin(i * 2.3) * 1.6]; p.traverse(function (o) { o.userData.person = i; }); });
      if (sc.me && !me) { me = person(9, false); meTag = sprite('You', '#2f6fd0', '#fff', 2.4); world.add(me); world.add(meTag); }
      if (me) { me.visible = meTag.visible = !!sc.me; }
      if (sc.gem && !gem) { gem = new T.Mesh(new T.OctahedronGeometry(0.6, 0), new T.MeshPhysicalMaterial({ color: 0x33c3f0, roughness: 0, metalness: 0.1, clearcoat: 1, emissive: 0x0c5a7a, emissiveIntensity: 0.6 })); gem.castShadow = true; gem.traverse(function (o) { o.userData.gem = true; }); world.add(gem); }
      if (gem) gem.visible = !!sc.gem;
    }

    /* ---------- build per place ---------- */
    var built = '';
    function build() {
      var key = (sc.mode || 'beach') + (sc.villas ? 'v' : 'b') + (sc.rooftop ? 'r' : '') + (sc.name || ''); if (key === built) return; built = key;
      ESTATE = sc.mode === 'estate'; HARBOUR = sc.mode === 'harbour'; CLUB = sc.mode === 'club'; ROOF = CLUB && !!sc.rooftop; STAD = sc.mode === 'stadium'; if (ESTATE) buildEstate(); if (HARBOUR) buildHarbour(); if (CLUB) buildClub(); if (STAD) buildStadium();
      harbourG.visible = HARBOUR; clubG.visible = CLUB; stadG.visible = STAD; sky.visible = !CLUB || ROOF; S3.environment = CLUB && !ROOF ? null : envRT.texture;
      // Frame: the estate uses a wider lens so the pool below and the skyline above both fit, as in a terrace photo.
      if (STAD) { cam.fov = 50; orbit.az = 0; orbit.pol = sc.street ? 1.12 : 1.08; orbit.r = sc.street ? 40 : 118; orbit.tx = 0; orbit.tz = sc.street ? 2 : 6; } else if (CLUB) { cam.fov = ROOF ? 52 : 62; orbit.az = 0; orbit.pol = ROOF ? 1.3 : 1.22; orbit.r = ROOF ? 34 : 26; orbit.tx = 0; orbit.tz = ROOF ? 4 : 8; } else if (HARBOUR) { cam.fov = 50; orbit.az = sc.club ? Math.PI - 0.55 : 0; orbit.pol = sc.club ? 1.25 : 1.2; orbit.r = sc.club ? 85 : 130; orbit.tx = sc.club ? -10 : 0; orbit.tz = sc.club ? 126 : 40; } else if (ESTATE) { cam.fov = 55; orbit.az = 0.05; orbit.pol = 1.23; orbit.r = 39; orbit.tx = -12; orbit.tz = -2; } else { cam.fov = 42; orbit.az = 0.08; orbit.pol = 1.17; orbit.r = 40; orbit.tx = -12; orbit.tz = -6; }
      cam.updateProjectionMatrix(); place();
      estateG.visible = ESTATE; [sand, sea, foam, wet, skyline, lawn, path, jetski, sail].forEach(function (o) { o.visible = !ESTATE && !HARBOUR && !CLUB && !STAD; });
      dyn.clear(); palms = []; villas = new T.Group(); beachBits = new T.Group(); dyn.add(villas, beachBits);
      if (CLUB || STAD) return;
      if (HARBOUR) { [[-80, -20], [-60, 50], [70, 60], [85, -20], [-30, -50], [40, -50], [-95, 90], [95, 95]].forEach(function (q, i) { palm(q[0], q[1], 9 + (i % 3), (i % 2 ? -0.2 : 0.2)); }); return; }
      if (ESTATE) { [-38, -12, 14, 40].forEach(function (x) { villa(x, x === -12); }); [[-30, 3, 9, 0.3], [-4, 5, 8.5, 0.4], [20, 4, 9.5, 0.2], [44, 2, 9, -0.3], [-25, -24, 12, 0.1], [28, -24, 12, 0.15], [-2, -21, 9, 0.35], [30, 22, 10, -0.2], [-50, 18, 11, 0.25]].forEach(function (q) { palm(q[0], q[1], q[2], q[3]); }); return; }
      if (sc.villas) { [-38, -12, 14, 40].forEach(function (x) { villa(x, x === -12); }); } // the view is from the -12 villa's terrace
      else { shack(-22, 2); shack(26, 3); }
      [[-30, 3, 9, 0.3], [-22, -6, 11, -0.2], [-4, 5, 8.5, 0.4], [10, -4, 10, -0.3], [20, 4, 9.5, 0.2], [33, -6, 11, -0.25], [-42, -8, 10, 0.2], [44, 2, 9, -0.3], [-25, -24, 12, 0.1], [2, -25, 11, -0.1], [28, -24, 12, 0.15], [-2, -21, 9, 0.35]].forEach(function (q) { palm(q[0], q[1], q[2], q[3]); });
      [[-30, 9], [-20, 10.5], [-8, 9.5], [4, 10.5], [16, 9.5], [28, 10.5], [40, 9.5]].forEach(function (q, i) { var u = umbrella(q[0], groundY(q[0], q[1]), q[1], 1); dyn.add(u); lounger(q[0] - 1, q[1] + 1.2, 0.2); lounger(q[0] + 1, q[1] + 1.2, -0.2); if (i % 2) { u.children[1].material = mat('umbW', { color: 0xf4f1ea, roughness: 0.7, side: T.DoubleSide }); u.children[2].material = u.children[1].material; } });
    }

    /* ---------- camera: a terrace view toward the sea; drag to orbit, wheel or pinch to zoom ---------- */
    // The view starts from a villa's upper terrace, looking down over its pool to the sea.
    var orbit = { az: 0.08, pol: 1.17, r: 40, tx: -12, ty: 0, tz: -6 }, ptrs = {}, drag = null, pinch0 = 0, moved = false;
    function place() { orbit.pol = Math.max(0.55, Math.min(1.42, orbit.pol)); orbit.r = Math.max(CLUB ? 6 : 10, Math.min(CLUB ? (ROOF ? 60 : 30) : 140, orbit.r)); if (CLUB && !ROOF) orbit.pol = Math.max(0.95, orbit.pol); var s = Math.sin(orbit.pol); cam.position.set(orbit.tx + orbit.r * s * Math.sin(orbit.az), orbit.ty + orbit.r * Math.cos(orbit.pol), orbit.tz - orbit.r * s * Math.cos(orbit.az)); cam.lookAt(orbit.tx, orbit.ty + 2, orbit.tz); }
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
      var nv = night ? 0.85 : 0; if (Math.abs(skyU.night.value - nv) > 0.01) { skyU.night.value += (nv - skyU.night.value) * 0.1; if (Math.abs(skyU.night.value - nv) <= 0.01) { skyU.night.value = nv; bakeEnv(); } } hemi.intensity = night ? 0.25 : rain ? 0.6 : 0.85; sun.intensity = night ? 0.15 : rain ? 0.7 : 2.2; sun.color.set(night ? 0x8fa8ff : 0xffe2b8); hemi.color.set(0xfff1dd);
      S3.fog.color.set(night ? 0x0b1020 : rain ? 0xa9b2b8 : sc.weather === 'harmattan' ? 0xd9c49a : HAZE); S3.fog.density = (rain ? 0.006 : sc.weather === 'harmattan' ? 0.0055 : 0.0029) * (HARBOUR || ROOF || STAD ? 0.45 : 1);
      poolM.emissive.set(night ? 0x1fa9c9 : 0x000000); poolM.emissiveIntensity = night ? 0.9 : 0; // underwater lights after dark
      if (HARBOUR) {
        var beat = Math.abs(Math.sin(t * 2.2)), lit = night ? 1 : 0.35, show = sc.show !== false, fshow = sc.hour == null || (sc.hour >= 19 && sc.hour < 23), jk = fshow ? 1 : 0.45;
        HB.jets.forEach(function (j) { var h = j.ring === 3 ? 26 + 10 * Math.abs(Math.sin(t * 1.3)) : (8 + 10 * Math.abs(Math.sin(t * 2 + j.i * 0.4 + j.ring))) * (j.ring === 0 ? 1.1 : 1); j.m.scale.y = h * jk; j.m.material.color.setHSL(((t * 0.08 + j.i / 30 + j.ring * 0.2) % 1), night ? 0.9 : 0.15, night ? 0.6 : 0.95); j.m.material.opacity = night ? 0.8 : 0.65; });
        HB.beams.forEach(function (b, i) { b.visible = show; b.rotation.z = Math.sin(t * 0.9 + i) * 0.5; b.rotation.x = -0.6 + Math.cos(t * 0.7 + i) * 0.3; b.material.color.setHSL((t * 0.1 + i / 8) % 1, 0.9, 0.6); b.material.opacity = 0.05 + 0.12 * lit; });
        HB.cables.forEach(function (c) { c.l.material.color.setHSL((t * 0.12 + c.k * 0.06 + (c.sd > 0 ? 0.3 : 0)) % 1, 0.9, night ? 0.6 : 0.85); });
        HB.screens.forEach(function (st) { var cv0 = st.userData.canvas; st.userData.redraw(cv0.getContext('2d'), cv0.width, cv0.height, t); st.needsUpdate = true; });
        (HB.towers || []).forEach(function (m) { m.emissiveIntensity = night ? 0.9 : 0; }); HB.boards.forEach(function (m) { m.emissiveIntensity = night ? 0.9 : 0.2; }); HB.clubGlass.emissiveIntensity = night ? 0.6 : 0;
        HB.water.material.color.set(night ? 0x0b2236 : 0x1b4f6e); HB.lights.forEach(function (L0) { L0.intensity = night ? L0.userData.max * 3 : 0; }); if (night) hemi.intensity = 0.55;
        var mx = new T.Matrix4(); for (var ci = 0; ci < HB.crowdN; ci++) { var cb = HB.crowdBase[ci], jump = show && (night || reduce) ? Math.max(0, Math.sin(t * 6 + cb[2])) * 0.6 * beat : 0; mx.makeTranslation(cb[0], 1.2 + jump, cb[1]); HB.crowd.setMatrixAt(ci, mx); HB.heads.setMatrixAt(ci, mx); } HB.crowd.count = HB.heads.count = show ? HB.crowdN : 40; HB.crowd.instanceMatrix.needsUpdate = true; HB.heads.instanceMatrix.needsUpdate = true;
      } else if (STAD) {
        var live = !!(sc.hour != null ? sc.hour >= 16 && sc.hour < 22 : sc.night), flood = live && !!night;
        matchFrame(reduce ? 30 : t, live || !!ST.street);
        ST.lights.forEach(function (L0) { L0.intensity = flood ? 900 : 0; }); ST.banks.forEach(function (m) { m.color.set(flood ? 0xffffff : 0x555a60); });
        ST.towers.forEach(function (m) { m.emissiveIntensity = night ? 0.9 : 0; }); if (night && flood) hemi.intensity = 0.45;
        if (ST.board) { var cb = ST.board.userData.canvas; ST.board.userData.redraw(cb.getContext('2d'), cb.width, cb.height, t); ST.board.needsUpdate = true; }
      } else if (CLUB) {
        var open = !!(ROOF || night), A = CB.pal[0], B = CB.pal[1], kick = Math.pow(Math.abs(Math.sin(t * 3.9)), 3), cc = new T.Color(); CB.open = open;
        if (!ROOF) { hemi.intensity = open ? 0.16 : 1.4; hemi.color.copy(open ? B : new T.Color(0xffffff)); sun.intensity = 0; S3.fog.color.copy(open ? CB.pal[2] : new T.Color(0x24262c)); S3.fog.density = open ? 0.014 : 0.004; }
        else if (night) hemi.intensity = 0.4;
        if (CB.tiles) { for (var ti = 0; ti < CB.NT; ti++) for (var tj = 0; tj < CB.NT; tj++) { var wv = 0.5 + 0.5 * Math.sin(t * 2.4 - Math.hypot(ti - 3.5, tj - 3.5) * 0.9); if (open) cc.copy(A).lerp(B, 0.5 + 0.5 * Math.sin(t * 0.7 + ti * 0.5 + tj * 0.3)).multiplyScalar(0.25 + 0.95 * wv * (0.6 + 0.4 * kick)); else cc.set(0x1c1c1f); CB.tiles.setColorAt(ti * CB.NT + tj, cc); } CB.tiles.instanceColor.needsUpdate = true; }
        if (CB.lasers) { CB.lasers.visible = open; var lp = CB.lasers.geometry.attributes.position, O = CB.laserO; CB.lasers.material.color.setHSL((0.33 + Math.floor(t / 4) * 0.21) % 1, 1, 0.55); for (var li = 0; li < CB.NL; li++) { var la = -0.9 + 1.8 * li / (CB.NL - 1) + Math.sin(t * 1.3) * 0.35, ev = -0.2 + Math.sin(t * 0.9 + li * 0.25) * 0.1; lp.setXYZ(li * 2, O[0], O[1], O[2]); lp.setXYZ(li * 2 + 1, O[0] + Math.sin(la) * 64, O[1] + ev * 64, O[2] - Math.cos(la) * 64); } lp.needsUpdate = true; }
        CB.beams.forEach(function (b, i) { b.visible = open; b.rotation.z = Math.sin(t * 1.1 + i) * 0.55; b.rotation.x = Math.cos(t * 0.8 + i * 1.7) * 0.45; b.material.color.copy(i % 2 ? A : B); b.material.opacity = 0.07 + 0.08 * kick; });
        CB.lights.forEach(function (L0, i) { var on = ROOF ? night : open; L0.color.copy(on || ROOF ? L0.userData.c : new T.Color(0xfff4e0)); L0.intensity = on ? L0.userData.max * (CB.flame && i === 0 ? 0.8 + 0.3 * Math.sin(t * 13) : 0.7 + 0.5 * kick) : ROOF ? 0 : L0.userData.max * 0.55; });
        CB.sparks.forEach(function (pt) { pt.visible = open; var a = pt.geometry.attributes.position; for (var k = 0; k < a.count; k++) { var u = Math.random(), an = Math.random() * 6.283, rr2 = u * 0.5; a.setXYZ(k, Math.cos(an) * rr2, u * 1.1, Math.sin(an) * rr2); } a.needsUpdate = true; });
        CB.screens.forEach(function (st) { var cv0 = st.userData.canvas; st.userData.redraw(cv0.getContext('2d'), cv0.width, cv0.height, t); st.needsUpdate = true; });
        CB.towers.forEach(function (m) { m.emissiveIntensity = night ? 0.9 : 0; }); if (CB.bulbs) CB.bulbs.color.set(night ? 0xffd27a : 0x6b6458); if (CB.water) CB.water.material.color.set(night ? 0x0b2236 : 0x1b4f6e);
        if (CB.flame) { CB.flame.scale.set(1 + Math.sin(t * 11) * 0.08, 0.85 + Math.abs(Math.sin(t * 7.3)) * 0.35, 1 + Math.cos(t * 9) * 0.08); CB.flame.material.opacity = night ? 0.85 : 0.5; }
        if (CB.crowd) { var cm = new T.Matrix4(), cnt = open ? CB.n : 0; CB.crowd.count = CB.heads.count = cnt; for (var di = 0; di < cnt; di++) { var db = CB.base[di], hop = ROOF ? Math.max(0, Math.sin(t * 2 + db[2])) * 0.08 : Math.max(0, Math.sin(t * 7.8 + db[2])) * 0.45 * (0.4 + 0.6 * kick); cm.makeRotationY(db[2]); cm.setPosition(db[0], hop, db[1]); CB.crowd.setMatrixAt(di, cm); CB.heads.setMatrixAt(di, cm); } CB.crowd.instanceMatrix.needsUpdate = true; CB.heads.instanceMatrix.needsUpdate = true; }
      } else if (ESTATE) spray.forEach(function (d, i) { var u = ((reduce ? 0.5 : t * 0.55) + i / spray.length) % 1, a = i * 2.39, rad = (i % 4 === 0 ? 0.3 : 2.6) * u; d.position.set(LAKE.x + Math.cos(a) * rad, 0.7 + Math.sin(u * Math.PI) * (i % 4 === 0 ? 9 : 4.5), LAKE.z + Math.sin(a) * rad * 0.8); });
      else if (!reduce) waves(t);
      foam.position.z = SEA0 - 1 + Math.sin(t * 0.8) * 1.6; foam.material.opacity = 0.65 + Math.sin(t * 0.8 + 1) * 0.3; wet.position.z = SEA0 - 3.5 + Math.sin(t * 0.8 - 0.6) * 1.2;
      jetski.position.set(-60 + ((t * 9) % 140), -0.2 + Math.sin(t * 3) * 0.15, SEA0 + 30); jetski.rotation.y = 0; sail.position.set(80 - ((t * 1.5) % 200), -0.3, 180); sail.rotation.z = Math.sin(t) * 0.04;
      palms.forEach(function (o) { o.userData.crown.rotation.z = Math.sin(t * 0.9 + o.position.x) * 0.04; });
      crowd.forEach(function (p, i) { if (!p.visible || !p.userData.home) return; var hx = p.userData.home[0], hz = p.userData.home[1], u = reduce ? 0 : Math.sin(t * 0.25 + i), x = hx + u * 2.5, z = hz + Math.cos(t * 0.2 + i) * 1.2; p.position.set(x, groundY(x, z), z); p.rotation.y = Math.cos(t * 0.25 + i) > 0 ? Math.PI / 2 : -Math.PI / 2; var a = reduce ? 0 : Math.sin(t * 6 + i) * 0.45; p.userData.legs[0].rotation.z = a; p.userData.legs[1].rotation.z = -a; });
      if (me && sc.me) { var q = SP()[(sc.meSlot || 5) % SP().length], mx = q[0] + 1.6, mz = q[1] + 2.5; me.position.set(mx, groundY(mx, mz), mz); label(meTag, sc.me.say ? sc.me.say.slice(0, 40) : 'You', '#2f6fd0', '#fff'); meTag.scale.set(sc.me.say ? 9 : 2.4, (sc.me.say ? 9 : 2.4) * 96 / 512, 1); meTag.position.set(mx, me.position.y + 2.7, mz); }
      if (gem && sc.gem) { var gq = SP()[sc.gem.slot % SP().length]; gem.position.set(gq[0] - 2.5, groundY(gq[0] - 2.5, gq[1] + 2) + 1.2 + Math.sin(t * 2) * 0.25, gq[1] + 2); gem.rotation.y = t * 1.5; }
      strollers.forEach(function (p, i) { p.visible = !CLUB || i < (sc.night || ROOF ? 5 : 1); var x = CLUB ? -20 + ((i * 9 + (reduce ? 0 : t * (i % 2 ? 0.7 : -0.6))) % 40 + 40) % 40 : -50 + ((i * 13 + (reduce ? 0 : t * (i % 2 ? 0.9 : -0.8))) % 100 + 100) % 100, z = STAD ? (sc.street ? -21 : -55) + (i % 3) * 1.2 : CLUB ? -22 + (i % 3) * 2 : HARBOUR ? -50 + (i % 3) * 3 : SEA0 - 4 + (i % 3) * 1.2; p.position.set(x, groundY(x, z), z); p.rotation.y = i % 2 ? Math.PI / 2 : -Math.PI / 2; var a = reduce ? 0 : Math.sin(t * 6 + i) * 0.45; p.userData.legs[0].rotation.z = a; p.userData.legs[1].rotation.z = -a; });
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
