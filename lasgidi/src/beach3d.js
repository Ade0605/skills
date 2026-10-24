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
  var SPOTS_STADIUM = [[-40, -40], [-20, -41], [0, -41], [20, -41], [40, -40], [-30, -43], [10, -43], [30, -43]];
  var SPOTS_STREET = [[-16, -17], [-8, -17.5], [0, -17.5], [8, -17.5], [16, -17], [-12, -19.5], [4, -19.5], [14, -19.5]];
  var SPOTS_MARKET = [[-4, -20], [4, -20], [-5, -13], [5, -13], [-3, -6], [3, -6], [-5, 1], [5, 1]];
  var SPOTS_JETTY = [[-8, -22], [0, -24], [8, -22], [-12, -27], [12, -27], [0, -12], [0, -2], [0, 8]];
  var SPOTS_PARK = [[-22, -14], [-10, -17], [2, -18], [14, -16], [26, -12], [-16, -6], [-2, -8], [12, -7]];
  var SPOTS_PLAZA = [[-24, -24], [-12, -28], [0, -30], [12, -28], [24, -24], [-18, -16], [16, -16], [0, -20]];
  var SPOTS_GALLERY = [[-13, -4], [-5, -6], [5, -6], [13, -4], [-20, 4], [-9, 6], [9, 6], [20, 4]];
  var SPOTS_STREET2 = [[-14, -4], [-6, -5], [2, -5], [10, -4], [18, -4], [-10, -2.5], [6, -2.5], [14, -2.5]];
  var SPOTS_CLUB = [[-15, -3], [-6, -7], [6, -7], [15, -3], [-17, 11], [-7, 4], [7, 4], [17, 11]];
  var SAND0 = -22, SAND_D = 38, SEA0 = 16; // sand from the lawn's edge (z -22) to the waterline (z 16)

  function create(opts) {
    opts = opts || {};
    var T = root.THREE; if (!T) return null;
    var el = document.createElement('div'); el.className = 'cruise-stage venue-stage beach-3d';
    var renderer; try { renderer = root.LasgidiGL ? root.LasgidiGL.make({ preserve: true }) : new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch (e) { return null; } if (!renderer) return null;
    // Lighter on phones and small machines: a lower pixel ratio and a smaller shadow map keep the frame rate up.
    var LITE = root.LasgidiGL ? root.LasgidiGL.lite() : (root.innerWidth || 1000) < 700 || ((root.navigator || {}).hardwareConcurrency || 8) <= 4;
    if (!root.LasgidiGL) renderer.setPixelRatio(Math.min(LITE ? 1.25 : 2, root.devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
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
    sun.position.set(-60, 40, -80); sun.castShadow = true; sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048); var shc = sun.shadow.camera; shc.left = -45; shc.right = 45; shc.top = 40; shc.bottom = -40; shc.near = 1; shc.far = 260; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
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

    // Speed: merge the meshes in a group that never move into one mesh per material (draw calls drop from hundreds
    // to a few dozen). People (anything with legs), tagged movers (userData.dyn), tappable things, instanced meshes,
    // points, lines and sprites are left as they are, and so is anything in `skip`.
    function mergeStatic(root, skip, figure) {
      var keep = new Set(skip || []), groups = {}, inv = new T.Matrix4(), m4 = new T.Matrix4(), nm = new T.Matrix3();
      root.updateMatrixWorld(true); inv.copy(root.matrixWorld).invert();
      (function walk(o, frozen) {
        if (o !== root && (keep.has(o) || (figure ? false : (o.userData.dyn || o.userData.spin || o.userData.legs !== undefined)) || o.userData.letter || o.userData.gem || o.userData.person != null)) return;
        if (o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material) && o.visible && o.geometry && o.geometry.attributes.position && o.geometry.attributes.normal) {
          var g = o.geometry, sig = o.material.uuid + '|' + (g.attributes.uv ? 'uv' : '') + '|' + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
          (groups[sig] = groups[sig] || []).push(o);
        }
        o.children.slice().forEach(function (c) { walk(c); });
      })(root);
      var merged = 0;
      Object.keys(groups).forEach(function (k) {
        var list = groups[k]; if (list.length < 2) return;
        var n = 0, ni = 0, uv = !!list[0].geometry.attributes.uv;
        list.forEach(function (o) { var g = o.geometry; n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
        var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uvs = uv ? new Float32Array(n * 2) : null, idx = new (n > 65535 ? Uint32Array : Uint16Array)(ni), v = new T.Vector3(), off = 0, io = 0;
        list.forEach(function (o) {
          var g = o.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, c = P.count;
          m4.multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(m4);
          for (var i = 0; i < c; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m4); pos[(off + i) * 3] = v.x; pos[(off + i) * 3 + 1] = v.y; pos[(off + i) * 3 + 2] = v.z; v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(off + i) * 3] = v.x; nor[(off + i) * 3 + 1] = v.y; nor[(off + i) * 3 + 2] = v.z; if (uvs && U) { uvs[(off + i) * 2] = U.getX(i); uvs[(off + i) * 2 + 1] = U.getY(i); } }
          if (g.index) for (var j = 0; j < g.index.count; j++) idx[io++] = g.index.getX(j) + off; else for (var j2 = 0; j2 < c; j2++) idx[io++] = j2 + off;
          off += c; o.parent.remove(o); g.dispose();
        });
        var mg = new T.BufferGeometry(); mg.setAttribute('position', new T.BufferAttribute(pos, 3)); mg.setAttribute('normal', new T.BufferAttribute(nor, 3)); if (uvs) mg.setAttribute('uv', new T.BufferAttribute(uvs, 2)); mg.setIndex(new T.BufferAttribute(idx, 1)); mg.computeBoundingSphere();
        var mm = new T.Mesh(mg, list[0].material); mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow; root.add(mm); merged += list.length;
      });
      return merged;
    }
    // A person's body, head, hair and clothes merged by material; legs and arms stay separate so they still swing and wave.
    function slimFigure(g, inner) { var u = (inner || g).userData; mergeStatic(g, [].concat(u.legs || [], u.arms || []), true); return g; }
    var Mc = {}; function mat(k, o) { return Mc[k] || (Mc[k] = new T.MeshStandardMaterial(o)); }
    // Free a group's GPU memory before it is rebuilt for another place (shared materials and geometry simply upload again when next used).
    function wipe(g) { g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(function (m) { ['map', 'emissiveMap', 'alphaMap', 'normalMap', 'roughnessMap'].forEach(function (k) { if (m[k] && m[k].dispose) m[k].dispose(); }); m.dispose(); }); }); g.clear(); }
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
    function SP() { return STR ? SPOTS_STREET2 : GAL ? SPOTS_GALLERY : PLZ ? SPOTS_PLAZA : PRK ? SPOTS_PARK : JTY ? SPOTS_JETTY : MKT ? SPOTS_MARKET : STAD ? (sc.street ? SPOTS_STREET : SPOTS_STADIUM) : CLUB ? SPOTS_CLUB : HARBOUR ? SPOTS_HARBOUR : SPOTS; }
    var ESTATE = false, HARBOUR = false, CLUB = false, ROOF = false, STAD = false, MKT = false, JTY = false, PRK = false, PLZ = false, GAL = false, STR = false, DOLL = false; // Lekki Hyde Park: lawns and a lake; Harbour Live: a paved island in the harbour
    function groundY(x, z) { if (STR) return z > -6 ? 0.3 : 0.05; if (PRK || PLZ || GAL) return 0.05; if (JTY) return z > -15 ? 1.1 : 0.85; if (CLUB || STAD || MKT) return 0.05; if (HARBOUR) return 1.2; if (ESTATE) return z < -28 ? 1.0 : 1.0 + Math.sin(x * 0.031) * Math.cos(z * 0.027) * 0.45 * Math.min(1, (z + 28) / 20); if (z < SAND0 + 2) return 1.0; var slope = Math.min(1.1, (z - SAND0) / SAND_D), fade = Math.min(1, (z - SAND0) / 6); return 0.95 - slope * 1.5 + (Math.sin(x * 0.21) * Math.cos(z * 0.33) * 0.1 + Math.sin(x * 0.05 + z * 0.1) * 0.2) * fade; }

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
      mergeStatic(estateG, spray); // everything but the fountain spray stands still
    }

    /* ---------- Harbour Live: fountain show, concert stage, crowd, LED bridges, billboards, the private club ---------- */
    var harbourG = new T.Group(); harbourG.visible = false; S3.add(harbourG); var harbourBuilt = false, HB = { jets: [], beams: [], cables: [], screens: [], crowd: null, crowdN: 0, boards: [] };
    var HEADLINERS = ['KAYODE BLAZE', 'AMARA SOL', 'DJ TIDEWAVE', 'BIG TEMI', 'ZINO'];
    // Redraw a canvas screen at most hz times a second (uploading a 1024px canvas every frame is heavy on phones).
    function redrawAt(tx, t, hz) { var u = tx.userData; if (u.last != null && t - u.last < 1 / hz && t >= u.last) return; u.last = t; var c = u.canvas; u.redraw(c.getContext('2d'), c.width, c.height, t); tx.needsUpdate = true; }
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
      var wall = screenTex(1024, 384, function (g, w, h, t) { var gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'hsl(' + (t * 30 % 360) + ',80%,30%)'); gr.addColorStop(1, 'hsl(' + ((t * 30 + 140) % 360) + ',80%,22%)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (var b = 0; b < 48; b++) { var bh = (0.2 + 0.8 * Math.abs(Math.sin(t * 3 + b * 0.5))) * h * 0.45; g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(b * (w / 48) + 2, h - bh, w / 48 - 4, bh); } g.fillStyle = '#ffffff'; g.font = '900 86px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; var off = sc.show === false, ad = Math.floor(t / 5) % 2; var fe = sc.fest; g.fillText(fe ? (off ? 'EKO DETTY FEST' : String(fe.head).toUpperCase()) : off ? (ad ? 'LAGOON BANK' : 'NEXT SHOW') : HEADLINERS[Math.floor(t / 6) % HEADLINERS.length], w / 2, h * 0.42, w - 40); g.font = '800 34px system-ui, sans-serif'; g.fillText(fe ? (off ? 'NIGHT ' + fe.night + ' · ' + String(fe.head).toUpperCase() + ' · GATES 6PM' : 'EKO DETTY FEST · NIGHT ' + fe.night + ' OF 21') : off ? (ad ? 'Save small. Live large.' : 'FRI & SAT · 8PM · HARBOUR LIVE') : 'HARBOUR LIVE · TONIGHT', w / 2, h * 0.75, w - 40); });
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
      mergeStatic(harbourG, HB.jets.map(function (j) { return j.m; }).concat(HB.beams, HB.water ? [HB.water] : []));
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
      wipe(clubG); var key = sc.placeId || sc.name || 'club', hh = hashStr(key), r = rnd(hh), pal = PALS[hh % PALS.length];
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
      if (!DOLL) [-10, 10].forEach(function (x) { clubG.add(mesh(new T.BoxGeometry(0.9, 0.9, RD - 8), mat('truss', { color: 0x3a3f46, metalness: 0.7, roughness: 0.3 }), x, RH - 1, 0)); });
      if (!DOLL) for (var cz = -24; cz <= 26; cz += 10) clubG.add(mesh(new T.BoxGeometry(22, 0.7, 0.7), mat('truss', {}), 0, RH - 1, cz));
      for (var k2 = 0; k2 < (DOLL ? 0 : 8); k2++) { var bm = new T.Mesh(new T.ConeGeometry(2.4, 17, 16, 1, true).translate(0, -8.5, 0), emissiveMat(0xffffff, 0.1)); bm.position.set(k2 % 2 ? 10 : -10, RH - 1.9, -12 + (k2 >> 1) * 10); clubG.add(bm); CB.beams.push(bm); clubG.add(mesh(new T.BoxGeometry(0.9, 1.0, 0.9), mat('mhead', { color: 0x111114, metalness: 0.6, roughness: 0.4 }), bm.position.x, RH - 1.5, bm.position.z)); }
      var NL = 20, lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(new Float32Array(NL * 6), 3));
      CB.lasers = new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x33ff77, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })); clubG.add(CB.lasers); CB.NL = NL; CB.laserO = [0, 8.5, RD / 2 - 5];
      // Coloured washes, and a warm light over the bar.
      [[-12, 13, -6, A], [12, 13, -6, B], [-12, 13, 14, B], [12, 13, 14, A], [-RW / 2 + 6, 8, 0, new T.Color(0xffc070)]].forEach(function (q, i) { var L0 = new T.PointLight(q[3], 0, 70, 1.2); L0.position.set(q[0], q[1], q[2]); L0.userData.max = i === 4 ? 18 : 40; L0.userData.c = q[3]; clubG.add(L0); CB.lights.push(L0); });
      dancers(120, r, function (rr, i) { return i < 96 ? [-10 + rr() * 20, -4 + rr() * 20] : i < 108 ? [-RW / 2 + 9 + rr() * 3, -12 + rr() * 24] : [RW / 2 - 9 - rr() * 3, -20 + rr() * 38]; });
      if (sc.placeId === 'owambe_hall') owambe(RD); else clubExtras(RW, RD);
      mergeStatic(clubG, [room, floor].concat(CB.beams || [], CB.towers || [], (CB.poles || []).map(function (p) { return p.g; }), CB.band || [], CB.owambe || []));
    }
    // Every club room (not the event hall): a round stage with two poles and dancers in stage outfits, a celebrity car park
    // at the door with a red carpet, and naira rain over the dance floor when somebody sprays (sc.rain).
    function clubExtras(RW, RD) {
      if (sc.placeId === 'shrine') return shrineExtras(RW, RD);
      var px = -RW / 2 + 13, pz = 24, gold = mat('poleGold', { color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
      clubG.add(mesh(new T.CylinderGeometry(4.2, 4.4, 1, 32), mat('stage', { color: 0x17181a, roughness: 0.3, metalness: 0.4 }), px, 0.5, pz));
      var ring = new T.Mesh(new T.TorusGeometry(4.25, 0.08, 8, 48).rotateX(Math.PI / 2), emissiveMat(0xff4fd8, 1)); ring.position.set(px, 1.02, pz); clubG.add(ring);
      CB.poles = []; [-1.6, 1.6].forEach(function (dx, i) {
        clubG.add(mesh(new T.CylinderGeometry(0.07, 0.07, 16, 10), gold, px + dx, 9, pz));
        var d = root.LasgidiAvatar3D && root.LasgidiGames3D ? avatarFor(root.LasgidiGames3D.stranger('stage' + i, i), 80 + i) : person(80 + i, true); clubG.add(d); CB.poles.push({ g: d, x: px + dx, z: pz, ph: i * Math.PI });
      });
      var sl = new T.SpotLight(0xff7ae0, 80, 22, 0.5, 0.6, 1.2); sl.position.set(px, 16, pz - 2); sl.target.position.set(px, 0, pz); clubG.add(sl, sl.target);
      // the car park: a red carpet from the door and four luxury cars under a sign
      var cx = RW / 2 - 12, cz = -29; clubG.add(mesh(new T.BoxGeometry(22, 0.04, 9), mat('park', { color: 0x2b2d33, roughness: 0.8 }), cx, 0.04, cz));
      for (var b = 0; b < 5; b++) clubG.add(mesh(new T.BoxGeometry(0.12, 0.05, 6), mat('bay', { color: 0xf4f3ec }), cx - 10 + b * 5, 0.08, cz));
      clubG.add(mesh(new T.BoxGeometry(2.4, 0.06, 26), mat('carpet', { color: 0xb3122a, roughness: 0.9 }), 0, 0.06, -RD / 2 + 13));
      [0x17181a, 0xf4f3ec, 0xd4af37, 0xb3122a].forEach(function (col, k) { var c = carModel(col, 4.8); c.position.set(cx - 7.5 + k * 5, 0, cz); c.rotation.y = Math.PI / 2; clubG.add(c); });
      var st = canvasTex(512, 96, function (g, w, h) { g.fillStyle = '#d4af37'; g.fillRect(0, 0, w, h); g.fillStyle = '#17181a'; g.font = '900 48px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CELEBRITY PARKING', w / 2, h / 2); });
      var sm = new T.Mesh(new T.PlaneGeometry(10, 1.9), new T.MeshBasicMaterial({ map: st })); sm.position.set(cx, 5, cz + 4.6); sm.rotation.y = Math.PI; clubG.add(sm);
      [-1, 1].forEach(function (s2) { clubG.add(mesh(new T.CylinderGeometry(0.12, 0.12, 5, 8), gold, cx + s2 * 4.6, 2.5, cz + 4.6)); });
      // money rain
      var nt = canvasTex(128, 64, function (g, w, h) { g.fillStyle = '#7fbf6a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1b5e20'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#1b5e20'; g.font = '900 28px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₦1000', w / 2, h / 2); });
      var NC = LITE ? 60 : 140, notes = new T.InstancedMesh(new T.PlaneGeometry(0.9, 0.45), new T.MeshStandardMaterial({ map: nt, side: T.DoubleSide, roughness: 0.6 }), NC); clubG.add(notes); CB.cash = notes; CB.NC = NC; CB.rainOnly = true;
    }
    // The Afrobeat live house in Ikeja: a band on the riser (drums, sax, guitar, a singer), a painted mural wall,
    // round tables with red stools and yellow AFROBEAT LIVE boards.
    function shrineExtras(RW, RD) {
      var bz = RD / 2 - 8; CB.band = [];
      var kit = new T.Group(); kit.position.set(-6, 1.6, bz + 1); [[0, 0.7, 0.9], [-1.1, 1.1, 0.5], [1.1, 1.1, 0.5]].forEach(function (d) { kit.add(mesh(new T.CylinderGeometry(d[2], d[2], 0.6, 18), mat('drum', { color: 0xc0392b, roughness: 0.4 }), d[0], d[1], 0)); }); kit.add(mesh(new T.CylinderGeometry(0.6, 0.6, 0.04, 18), mat('cymbal', { color: 0xd4af37, metalness: 0.9, roughness: 0.2 }), 1.6, 2.2, -0.4)); clubG.add(kit);
      [[-6, bz + 2.4], [-2, bz - 1], [2.5, bz - 1], [6.5, bz - 1.5]].forEach(function (q, i) { var f = root.LasgidiAvatar3D && root.LasgidiGames3D ? avatarFor(root.LasgidiGames3D.stranger('band', i), 100 + i) : person(100 + i, i === 3); f.position.set(q[0], 1.6, q[1]); f.rotation.y = -Math.PI / 2; clubG.add(f); CB.band.push(f); });
      var sax = mesh(new T.CylinderGeometry(0.06, 0.16, 0.9, 10), mat('sax', { color: 0xd4af37, metalness: 0.9, roughness: 0.2 }), -2, 2.9, bz - 1.5); sax.rotation.x = 0.5; clubG.add(sax);
      var gtr = mesh(new T.BoxGeometry(0.9, 0.3, 0.08), mat('gtr', { color: 0x7a3b12 }), 2.5, 2.7, bz - 1.5); gtr.rotation.z = 0.5; clubG.add(gtr);
      clubG.add(mesh(new T.CylinderGeometry(0.04, 0.04, 2.6, 6), mat('mic', { color: 0x222222, metalness: 0.7 }), 6.5, 2.9, bz - 2.4));
      function board(text, w, h, x, y, z, ry) { var t = canvasTex(1024, 192, function (g, cw, ch) { g.fillStyle = '#f2c200'; g.fillRect(0, 0, cw, ch); g.fillStyle = '#17181a'; g.font = '900 110px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2 + 6, cw - 40); }); var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t })); m.position.set(x, y, z); m.rotation.y = ry; clubG.add(m); }
      board('AFROBEAT LIVE', 14, 2.6, -12, 14.5, RD / 2 - 0.4, Math.PI); board('AFROBEAT LIVE', 14, 2.6, 12, 14.5, RD / 2 - 0.4, Math.PI);
      var mural = canvasTex(1024, 512, function (g, w, h) { g.fillStyle = '#f2a516'; g.fillRect(0, 0, w, h); g.fillStyle = '#17181a'; g.fillRect(30, 30, w - 60, 170); g.fillStyle = '#f2c200'; g.font = '900 120px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MUSIC IS THE WEAPON', w / 2, 118, w - 100);
        ['#d0453a', '#1f8a9a', '#c45a1a', '#2f6fd0'].forEach(function (c, i) { g.fillStyle = c; g.fillRect(40 + i * 240, 240, 210, 230); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(145 + i * 240, 330, 50, 0, 6.3); g.fill(); g.fillRect(105 + i * 240, 380, 80, 70); }); });
      var mm = new T.Mesh(new T.PlaneGeometry(22, 11), new T.MeshBasicMaterial({ map: mural })); mm.position.set(RW / 2 - 0.4, 9, -22); mm.rotation.y = -Math.PI / 2; clubG.add(mm);
      for (var tb = 0; tb < 5; tb++) { var tx = -14 + (tb % 3) * 14, tz = -24 + Math.floor(tb / 3) * 8; clubG.add(mesh(new T.CylinderGeometry(1.8, 1.8, 0.15, 20), mat('rtab', { color: 0x6b3a1a, roughness: 0.6 }), tx, 2.2, tz)); clubG.add(mesh(new T.CylinderGeometry(0.2, 0.3, 2.2, 8), mat('rtleg', { color: 0x2a1a10 }), tx, 1.1, tz));
        for (var st = 0; st < 4; st++) { var a = st * Math.PI / 2; clubG.add(mesh(new T.CylinderGeometry(0.5, 0.45, 0.25, 14), mat('rstool', { color: 0xc0392b }), tx + Math.cos(a) * 2.6, 1.5, tz + Math.sin(a) * 2.6)); } }
    }
    // The Surulere event hall: a high table on the riser, guests in agbada and gele, and naira raining on the floor.
    function owambe(RD) {
      var hz = RD / 2 - 6, cloth = mat('hiCloth', { color: 0xffffff, roughness: 0.7 }), gold = mat('hiGold', { color: 0xd4af37, roughness: 0.35, metalness: 0.6 });
      [-8, 8].forEach(function (x) { clubG.add(mesh(new T.BoxGeometry(6, 1.2, 1.4), cloth, x, 2.2, hz)); clubG.add(mesh(new T.BoxGeometry(6.05, 0.25, 1.45), gold, x, 2.6, hz)); });
      var A3 = root.LasgidiAvatar3D, dress = [{ dress: 'agbada', head: 'fila' }, { dress: 'iro_buba', head: 'gele' }, { dress: 'kaftan', head: 'fila' }, { dress: 'gown', head: 'gele' }];
      if (A3) for (var i = 0; i < 12; i++) {
        var f = A3.figure(T, { skin: i % 6, hair: i % 4, shape: i % 3 }, dress[i % 4], null), seat = i < 4;
        if (seat) { f.position.set((i < 2 ? -8 : 8) + (i % 2 ? 1.4 : -1.4), 1.6, hz + 1.2); f.rotation.y = Math.PI; }
        else { var an = i * 0.785; f.position.set(Math.cos(an) * 4.5, 0.15, 6 + Math.sin(an) * 4); f.rotation.y = an + Math.PI / 2; }
        f.scale.setScalar(1.25); f.userData.owambe = true; slimFigure(f); clubG.add(f); (CB.owambe = CB.owambe || []).push(f);
      }
      var nt = canvasTex(128, 64, function (g, w, h) { g.fillStyle = '#7fbf6a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1b5e20'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#1b5e20'; g.font = '900 28px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₦1000', w / 2, h / 2); });
      var NC = 70, notes = new T.InstancedMesh(new T.PlaneGeometry(0.9, 0.45), new T.MeshStandardMaterial({ map: nt, side: T.DoubleSide, roughness: 0.6 }), NC); clubG.add(notes); CB.cash = notes; CB.NC = NC;
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
    function squad(n, colrs, size, grp) {
      var bodyG = new T.CapsuleGeometry(0.3 * size, 1.0 * size, 4, 8); bodyG.translate(0, 1.0 * size, 0); var headG = new T.SphereGeometry(0.24 * size, 10, 8); headG.translate(0, 2.05 * size, 0);
      var body = new T.InstancedMesh(bodyG, new T.MeshStandardMaterial({ roughness: 0.55 }), n), head = new T.InstancedMesh(headG, new T.MeshStandardMaterial({ color: 0x5a341f, roughness: 0.7 }), n), c = new T.Color();
      for (var i = 0; i < n; i++) body.setColorAt(i, c.set(colrs(i))); body.castShadow = true; (grp || stadG).add(body, head); return { body: body, head: head, n: n };
    }
    // 4-3-3 for each side, attacking left to right for the home team.
    var FORM = [[-48, 0], [-34, -22], [-36, -8], [-36, 8], [-34, 22], [-20, -14], [-22, 0], [-20, 14], [-8, -22], [-6, 0], [-8, 22]];
    function buildStadium() {
      wipe(stadG); ST = { street: !!sc.street, towers: [], lights: [], banks: [] }; var r = rnd(hashStr((sc.placeId || 'stadium') + ':' + (sc.day || 0)));
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
      var canopy = new T.Mesh(new T.RingGeometry(84, 118, 64, 1, Math.PI * 0.18, Math.PI * 0.64).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: 0xeef1f3, roughness: 0.4, metalness: 0.3, side: T.DoubleSide, transparent: true, opacity: 0.92 })); canopy.scale.set(1, 1, 0.66); canopy.position.y = 40; canopy.rotation.y = 0; stadG.add(canopy);
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


    /* ---------- markets: rows of stalls under zinc and umbrellas, piled goods, traders, hawkers in the aisles ---------- */
    var mktG = new T.Group(); mktG.visible = false; S3.add(mktG); var MK = {};
    var MK_ROWS = [-33, -21, -9, 9, 21, 33], MK_Z0 = -26, MK_DZ = 5, MK_N = 15;
    var GOODS = { food: [0xd23b2f, 0xe8742a, 0x7b3f8c, 0x8a5a2b, 0x9ccf4a, 0xf2c94c, 0xc7ccd1, 0xf4f1ea], crafts: [0x5a3a22, 0x7a4f2e, 0x3b2a1a, 0xc0392b, 0x1f5fa0, 0xf2b600, 0x2fa36b, 0x8e44ad], elec: [0x15171b, 0x22252b, 0x2e3238, 0x3a3f46, 0x101215, 0xb9bec6], gold: [0xd4af37, 0xf2c94c, 0xb8860b, 0xe6c35c, 0xc9a227, 0xfff1a8] };
    var SCREENS = [0x3fa9f5, 0x41d37e, 0xf5c542, 0xf0643c, 0xb36bf2, 0xffffff];
    function buildMarket() { // the gold souk (Dubai) shows bangles and chains, upright like carvings
      wipe(mktG); var crafts = /crafts/.test(sc.placeId || ''), elec = sc.placeId === 'lag_alaba', gold = sc.placeId === 'dxb_gold', r = rnd(hashStr(sc.placeId || 'market')), pal = GOODS[elec ? 'elec' : gold ? 'gold' : crafts ? 'crafts' : 'food']; crafts = crafts || gold; MK = { towers: [], lamps: [], crafts: crafts, elec: elec };
      var dirtT = canvasTex(256, 256, function (g, w, h) { var rr = rnd(13); g.fillStyle = '#8d7e6b'; g.fillRect(0, 0, w, h); for (var i = 0; i < 7000; i++) { g.fillStyle = rr() < 0.5 ? 'rgba(70,60,50,.2)' : 'rgba(190,175,150,.2)'; g.fillRect(rr() * w, rr() * h, 2, 2); } for (var k = 0; k < 6; k++) { g.fillStyle = 'rgba(60,70,80,.35)'; g.beginPath(); g.ellipse(rr() * w, rr() * h, 10 + rr() * 16, 4 + rr() * 6, rr() * 3, 0, Math.PI * 2); g.fill(); } }, [20, 20]);
      var ground = mesh(new T.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: dirtT, roughness: 0.95 }), 0, 0, 0); ground.castShadow = false; mktG.add(ground);
      // Stall frames, tables and zinc roofs, instanced: six rows facing the aisles.
      var NS = MK_ROWS.length * MK_N, m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc3 = new T.Vector3(1, 1, 1), c = new T.Color();
      var zincT = canvasTex(128, 128, function (g, w, h) { var rr = rnd(5); for (var x = 0; x < w; x += 8) { var l = 55 + rr() * 15; g.fillStyle = 'hsl(30,' + (8 + rr() * 20) + '%,' + l + '%)'; g.fillRect(x, 0, 4, h); g.fillStyle = 'hsl(25,25%,' + (l - 12) + '%)'; g.fillRect(x + 4, 0, 4, h); } for (var k = 0; k < 14; k++) { g.fillStyle = 'rgba(140,70,30,' + (0.2 + rr() * 0.3) + ')'; g.beginPath(); g.arc(rr() * w, rr() * h, 4 + rr() * 12, 0, Math.PI * 2); g.fill(); } });
      var tables = new T.InstancedMesh(new T.BoxGeometry(3.6, 1.0, 2.2), mat('mtable', { color: 0x8a6a42, roughness: 0.9 }), NS), roofs = new T.InstancedMesh(new T.BoxGeometry(4.6, 0.08, 3.6), new T.MeshStandardMaterial({ map: zincT, roughness: 0.6, metalness: 0.5 }), NS), posts = new T.InstancedMesh(new T.CylinderGeometry(0.07, 0.07, 3.2, 6), mat('mpost', { color: 0x5a4632, roughness: 0.9 }), NS * 4);
      // Goods: fruit and peppers, carvings, or (Alaba) a wall of TVs with lit screens. Low-poly fruit: ~800 of them on a phone.
      var GN = NS * 9, goods = new T.InstancedMesh(elec ? new T.BoxGeometry(0.45, 0.6, 0.7) : crafts ? new T.CylinderGeometry(0.16, 0.24, 1, 8) : new T.SphereGeometry(0.42, LITE ? 6 : 8, LITE ? 4 : 6), new T.MeshStandardMaterial({ roughness: elec ? 0.4 : 0.6 }), GN), screens = elec ? new T.InstancedMesh(new T.BoxGeometry(0.03, 0.5, 0.62), new T.MeshBasicMaterial({ color: 0xffffff }), GN) : null, cloth = new T.InstancedMesh(new T.BoxGeometry(0.9, 0.18, 0.7), new T.MeshStandardMaterial({ roughness: 0.8 }), NS * 3);
      var traders = [], gi = 0, ci = 0, stalls = [];
      MK_ROWS.forEach(function (x, ri) { var face = x < 0 ? 1 : -1; for (var k = 0; k < MK_N; k++) {
        var z = MK_Z0 + k * MK_DZ, si = ri * MK_N + k, tilt = (r() - 0.5) * 0.08; stalls.push([x, z, face]);
        m4.makeTranslation(x, 0.5, z); tables.setMatrixAt(si, m4);
        e.set(tilt, 0, face * 0.12); q.setFromEuler(e); m4.compose(v.set(x - face * 0.4, 3.15 + (r() - 0.5) * 0.2, z), q, sc3); roofs.setMatrixAt(si, m4);
        [[-1.9, -1.4], [1.9, -1.4], [-1.9, 1.4], [1.9, 1.4]].forEach(function (pp, pk) { m4.makeTranslation(x + pp[0], 1.6, z + pp[1]); posts.setMatrixAt(si * 4 + pk, m4); });
        var kind = Math.floor(r() * pal.length);
        if (elec) for (var tk = 0; tk < 9; tk++) { var tz = z + (tk % 3 - 1) * 0.72, ty = 1.32 + Math.floor(tk / 3) * 0.62, tx = x - face * 0.9; m4.makeTranslation(tx, ty, tz); goods.setMatrixAt(gi, m4); goods.setColorAt(gi, c.set(pal[Math.floor(r() * pal.length)])); m4.makeTranslation(tx + face * 0.24, ty, tz); screens.setMatrixAt(gi, m4); screens.setColorAt(gi, c.set(SCREENS[Math.floor(r() * SCREENS.length)]).multiplyScalar(0.75 + r() * 0.25)); gi++; }
        else for (var gk = 0; gk < 9; gk++) { var gx = x + (gk % 3 - 1) * 1.05 + (r() - 0.5) * 0.2, gz = z + (Math.floor(gk / 3) - 1) * 0.62, s = crafts ? 0.8 + r() * 1.1 : 0.7 + r() * 0.5; e.set(0, r() * 3, 0); q.setFromEuler(e); m4.compose(v.set(gx, 1.0 + (crafts ? s * 0.5 : 0.25 * s), gz), q, new T.Vector3(crafts ? 1 : s, crafts ? s : s * 0.7, crafts ? 1 : s)); goods.setMatrixAt(gi, m4); goods.setColorAt(gi, c.set(pal[(kind + (r() < 0.25 ? 1 : 0)) % pal.length]).offsetHSL(0, 0, (r() - 0.5) * 0.12)); gi++; }
        for (var ck = 0; ck < 3; ck++) { m4.makeTranslation(x + face * 1.5, 0.12 + ck * 0.19, z - 0.7 + ck * 0.15); cloth.setMatrixAt(ci, m4); cloth.setColorAt(ci, elec ? c.setHSL(0, 0, 0.06 + r() * 0.1) : c.setHSL(r(), 0.7, 0.5)); ci++; } // Alaba: speaker boxes and decoders, not cloth
        traders.push([x - face * 1.6, z + (r() - 0.5) * 1.2, r() * 6]);
      } });
      [tables, roofs, posts, goods, cloth].forEach(function (o) { o.castShadow = true; o.receiveShadow = true; mktG.add(o); }); MK.stalls = stalls;
      if (screens) { mktG.add(screens); MK.screens = screens; }
      // Big umbrellas over some stalls, in faded market colours.
      var UC = [0xc0392b, 0x1f5fa0, 0xf2b600, 0x2fa36b, 0xe67e22];
      stalls.forEach(function (st, i) { if (i % 4 !== 1) return; var u = umbrella(st[0] + st[2] * 2.4, 0, st[1], 1.25); u.children[1].material = u.children[2].material = mat('mumb' + (i % 5), { color: UC[i % 5], roughness: 0.8, side: T.DoubleSide }); mktG.add(u); });
      // The entrance arch with the market's name, the road with a danfo and a keke, low buildings and overhead wires.
      var title = String(sc.name || 'Market').toUpperCase();
      var archT = canvasTex(1024, 160, function (g, w, h) { g.fillStyle = elec ? '#1f2f5a' : crafts ? '#5a3a22' : '#1d5a3c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2c94c'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10); g.fillStyle = '#fff'; g.font = '900 86px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(title, w / 2, h / 2 + 4, w - 40); });
      var arch = new T.Mesh(new T.BoxGeometry(22, 3.4, 0.4), [mat('archS', { color: 0x1c2128 }), mat('archS', {}), mat('archS', {}), mat('archS', {}), new T.MeshStandardMaterial({ map: archT, roughness: 0.6 }), new T.MeshStandardMaterial({ map: archT, roughness: 0.6 })]); arch.position.set(0, 8, -32); mktG.add(arch);
      [-11, 11].forEach(function (x) { mktG.add(mesh(new T.BoxGeometry(1, 9.7, 1), mat('archP', { color: 0xd9d4ca, roughness: 0.7 }), x, 4.85, -32)); });
      var road = mesh(new T.PlaneGeometry(400, 12).rotateX(-Math.PI / 2), mat('mroad', { color: 0x3a3f46, roughness: 0.9 }), 0, 0.02, -42); road.castShadow = false; mktG.add(road);
      var bus = new T.Group(); bus.position.set(-18, 0, -42); bus.add(mesh(new T.BoxGeometry(7, 2.6, 2.6), mat('danfoY', { color: 0xf2c200, roughness: 0.5 }), 0, 1.7, 0)); bus.add(mesh(new T.BoxGeometry(7.05, 0.3, 2.65), mat('danfoB', { color: 0x17181a }), 0, 1.4, 0)); bus.add(mesh(new T.BoxGeometry(5, 0.9, 2.66), glassM, -0.4, 2.4, 0)); [[-2.3, 1.3], [2.3, 1.3], [-2.3, -1.3], [2.3, -1.3]].forEach(function (w) { var wh = mesh(new T.CylinderGeometry(0.45, 0.45, 0.3, 12), mat('tyre', { color: 0x111111 }), w[0], 0.45, w[1]); wh.rotation.x = Math.PI / 2; bus.add(wh); }); mktG.add(bus); MK.bus = bus;
      var keke = new T.Group(); keke.add(mesh(new T.BoxGeometry(2.4, 1.6, 1.4), mat('kekeG', { color: 0x2fa36b, roughness: 0.5 }), 0, 1.2, 0)); keke.add(mesh(new T.BoxGeometry(2.5, 0.12, 1.5), mat('danfoB', {}), 0, 2.05, 0)); mktG.add(keke); MK.keke = keke;
      var rs = rnd(71); for (var b = 0; b < 30; b++) { var side = b % 3, bx, bz; if (side === 0) { bx = -60 + b * 4.2; bz = 54 + rs() * 10; } else { bx = (side === 1 ? -1 : 1) * (46 + rs() * 10); bz = -20 + (b % 10) * 9; } towerBlock(bx, bz, 8 + rs() * 6, 6 + rs() * 12, 8 + rs() * 4, mktG, 0, MK.towers); }
      for (var wl = 0; wl < 6; wl++) { var pts = []; for (var wi = 0; wi <= 12; wi++) { var u = wi / 12; pts.push(new T.Vector3(-45 + u * 90, 9 - Math.sin(u * Math.PI) * 1.2 + wl * 0.3, -36 + wl * 14)); } mktG.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x1a1a1a }))); }
      // Lanterns for after dark.
      stalls.forEach(function (st, i) { if (i % 3) return; var lm = new T.Mesh(new T.SphereGeometry(0.22, 8, 6), new T.MeshBasicMaterial({ color: 0x5a5040 })); lm.position.set(st[0] - st[2] * 1.2, 2.7, st[1]); mktG.add(lm); MK.lamps.push(lm.material); });
      MK.lights = []; [[-15, 6, -10], [15, 6, -10], [0, 6, 14], [-27, 6, 26], [27, 6, 26]].forEach(function (p) { var L0 = new T.PointLight(0xffc070, 0, 40, 1.4); L0.position.set(p[0], p[1], p[2]); mktG.add(L0); MK.lights.push(L0); });
      // People: a trader behind every stall, shoppers and hawkers (trays on heads) along the aisles.
      MK.traders = squad(traders.length, function (i) { return [0xc0392b, 0x2f6fa0, 0xf2b600, 0x2fa36b, 0x8e44ad, 0xe67e22, 0xf4f3ec][i % 7]; }, 1, mktG); MK.traderBase = traders;
      var NW = 170, wb = [], wr = rnd(19); for (var wk = 0; wk < NW; wk++) { var aisle = [-27, -15, 0, 15, 27][Math.floor(wr() * 5)]; wb.push([aisle + (wr() - 0.5) * (aisle === 0 ? 10 : 4), wr() * 80, (wr() < 0.5 ? 1 : -1) * (0.6 + wr() * 0.8), wr() * 6, wr() < 0.22]); }
      MK.walkers = squad(NW, function (i) { return [0xc0392b, 0x2f6fa0, 0xf2b600, 0x2fa36b, 0x8e44ad, 0xe67e22, 0xf4f3ec, 0x17181a][(i * 5) % 8]; }, 1, mktG); MK.walkBase = wb;
      MK.trays = new T.InstancedMesh(new T.CylinderGeometry(0.55, 0.45, 0.22, 12), mat('tray', { color: 0xc9a46a, roughness: 0.7 }), NW); mktG.add(MK.trays);
    }
    function marketFrame(t, open) {
      var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), one = new T.Vector3(1, 1, 1), zero = new T.Vector3(0, 0, 0);
      var W = MK.walkers, wn = open ? W.n : Math.round(W.n * 0.12);
      for (var i = 0; i < W.n; i++) { var b = MK.walkBase[i]; if (i >= wn) { m4.compose(v.set(0, -9, 0), q, zero); W.body.setMatrixAt(i, m4); W.head.setMatrixAt(i, m4); MK.trays.setMatrixAt(i, m4); continue; }
        var z = MK_Z0 - 4 + ((b[1] + t * b[2] * 1.2) % 80 + 80) % 80; e.set(0, b[2] > 0 ? 0 : Math.PI, 0); q.setFromEuler(e); m4.compose(v.set(b[0] + Math.sin(t * 0.5 + b[3]) * 0.6, Math.abs(Math.sin(t * 6 + b[3])) * 0.06, z), q, one); W.body.setMatrixAt(i, m4); W.head.setMatrixAt(i, m4);
        if (b[4]) { m4.compose(v.set(b[0] + Math.sin(t * 0.5 + b[3]) * 0.6, 2.42, z), q, one); MK.trays.setMatrixAt(i, m4); } else { m4.compose(v.set(0, -9, 0), q, zero); MK.trays.setMatrixAt(i, m4); } }
      W.body.instanceMatrix.needsUpdate = W.head.instanceMatrix.needsUpdate = MK.trays.instanceMatrix.needsUpdate = true;
      var Tr = MK.traders; for (var k = 0; k < Tr.n; k++) { var tb = MK.traderBase[k], here = open || k % 5 === 0; m4.compose(v.set(tb[0], here ? Math.max(0, Math.sin(t * 1.5 + tb[2])) * 0.05 : -9, tb[1]), q.identity(), here ? one : zero); Tr.body.setMatrixAt(k, m4); Tr.head.setMatrixAt(k, m4); }
      Tr.body.instanceMatrix.needsUpdate = Tr.head.instanceMatrix.needsUpdate = true;
      var kx = ((t * 6) % 140) - 70; MK.keke.position.set(kx, 0, -40); MK.keke.rotation.y = 0; MK.bus.position.x = -18 + Math.max(0, Math.sin(t * 0.15)) * 4;
    }


    /* ---------- jetties and marinas: a timber pier on the lagoon, ferries and boats docking on a schedule ---------- */
    var jetG = new T.Group(); jetG.visible = false; S3.add(jetG); var JT = {};
    function hull(len, wid, colr, cabin, cabColr) {
      var g = new T.Group(), sh = new T.Shape(); sh.moveTo(-len / 2, -wid / 2); sh.lineTo(len * 0.3, -wid / 2); sh.quadraticCurveTo(len / 2, -wid * 0.2, len / 2 + len * 0.08, 0); sh.quadraticCurveTo(len / 2, wid * 0.2, len * 0.3, wid / 2); sh.lineTo(-len / 2, wid / 2); sh.lineTo(-len / 2, -wid / 2);
      var hb = mesh(new T.ExtrudeGeometry(sh, { depth: wid * 0.32, bevelEnabled: false }).rotateX(-Math.PI / 2), mat('hull' + colr, { color: colr, roughness: 0.35, metalness: 0.1 }), 0, -0.2, 0); g.add(hb);
      g.add(mesh(new T.BoxGeometry(len * 1.02, 0.12, wid * 1.01), mat('rubb', { color: 0x1c2128 }), 0.02, wid * 0.32 - 0.36, 0)); g.add(mesh(new T.BoxGeometry(len * 0.82, 0.06, wid * 0.8), mat('boatdeck', { color: 0xc9a46a, roughness: 0.8 }), -len * 0.04, wid * 0.32 - 0.18, 0));
      if (cabin) { g.add(mesh(new T.BoxGeometry(len * cabin, wid * 0.32, wid * 0.8), mat('cab' + cabColr, { color: cabColr, roughness: 0.4 }), -len * 0.05, wid * 0.32 + wid * 0.12, 0)); g.add(mesh(new T.BoxGeometry(len * cabin * 1.01, wid * 0.12, wid * 0.81), glassM, -len * 0.05, wid * 0.32 + wid * 0.2, 0)); }
      jetG.add(g); return g;
    }
    function buildJetty() {
      wipe(jetG); var id = sc.placeId || 'jetty', marina = /yacht|club_|vip/.test(id), makoko = id === 'makoko', r = rnd(hashStr(id)); JT = { towers: [], boats: [], wakes: [], marina: marina, makoko: makoko, lamps: [] };
      var water = new T.Mesh(new T.PlaneGeometry(3000, 3000, 1, 1).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: makoko ? 0x4f7a6a : 0x3a8fb0, roughness: 0.2, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 })); water.position.y = -0.4; jetG.add(water); JT.water = water;
      // The shore: a concrete quay with a ticket kiosk, benches and a life-jacket rack.
      jetG.add(mesh(new T.BoxGeometry(160, 2.2, 30), mat('quay', { color: 0xbdb7aa, roughness: 0.9 }), 0, -0.3, -30));
      var kioskT = canvasTex(512, 128, function (g, w, h) { g.fillStyle = '#1f5fa0'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 52px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(sc.name || 'Jetty').toUpperCase(), w / 2, h * 0.42, w - 20); g.font = '700 26px system-ui, sans-serif'; g.fillText(marina ? 'MARINA · MEMBERS AND GUESTS' : makoko ? 'WATER TAXI · CANOES' : 'FERRY · WATER TAXI · TICKETS', w / 2, h * 0.8); });
      jetG.add(mesh(new T.BoxGeometry(8, 3.4, 4), mat('kiosk', { color: 0xf4f3ec, roughness: 0.7 }), -14, 2.5, -20)); var ks = new T.Mesh(new T.PlaneGeometry(8, 2), new T.MeshBasicMaterial({ map: kioskT })); ks.position.set(-14, 5.1, -17.98); jetG.add(ks);
      [-4, 4].forEach(function (x) { jetG.add(mesh(new T.BoxGeometry(5, 0.3, 0.9), mat('bench', { color: 0x8a6a3a, roughness: 0.8 }), x, 1.3, -18)); });
      for (var lj = 0; lj < 8; lj++) jetG.add(mesh(new T.BoxGeometry(0.7, 0.9, 0.25), mat('lifej', { color: 0xff7a1a, roughness: 0.6 }), 12 + (lj % 4) * 0.8, 1.6 + Math.floor(lj / 4) * 1.0, -17.8));
      // The pier: planks on pilings out into the water, a T-head for the ferry, cleats and lamps.
      var deckM = mat('pierdeck', { map: deckTex, roughness: 0.85 }); jetG.add(mesh(new T.BoxGeometry(6, 0.4, 46), deckM, 0, 0.9, 6)); jetG.add(mesh(new T.BoxGeometry(34, 0.4, 6), deckM, 0, 0.9, 30));
      for (var pz = -14; pz <= 30; pz += 4) [-2.8, 2.8].forEach(function (x) { jetG.add(mesh(new T.CylinderGeometry(0.22, 0.25, 4, 8), mat('piling', { color: 0x4a3a2a, roughness: 0.9 }), x, -0.9, pz)); });
      for (var px = -16; px <= 16; px += 4) [27.2, 32.8].forEach(function (z) { jetG.add(mesh(new T.CylinderGeometry(0.22, 0.25, 4, 8), mat('piling', {}), px, -0.9, z)); });
      for (var lp = -10; lp <= 26; lp += 9) [-3, 3].forEach(function (x) { jetG.add(mesh(new T.CylinderGeometry(0.08, 0.08, 3.2, 6), frameM, x, 2.7, lp)); var bm = new T.MeshBasicMaterial({ color: 0x6b6458 }), b = new T.Mesh(new T.SphereGeometry(0.25, 8, 6), bm); b.position.set(x, 4.4, lp); jetG.add(b); JT.lamps.push(bm); });
      [-14, -6, 6, 14].forEach(function (x) { jetG.add(mesh(new T.CylinderGeometry(0.18, 0.22, 0.5, 8), mat('cleat', { color: 0x2b2f36, metalness: 0.6 }), x, 1.35, 32.6)); });
      // Moored boats: yachts at a marina, canoes and speedboats at a public jetty, stilt houses at Makoko.
      for (var mb = 0; mb < (marina ? 7 : 5); mb++) { var side = mb % 2 ? 1 : -1, zz = -6 + Math.floor(mb / 2) * 9, b2 = marina ? hull(14 + r() * 6, 4.2, 0xf7f7f5, 0.5, 0xeef1f3) : hull(6, 1.8, [0x2f6fa0, 0xc0392b, 0x2fa36b, 0xf2b600][mb % 4], 0, 0); b2.position.set(side * (marina ? 10 : 6), 0, zz); b2.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.1; JT.boats.push({ o: b2, ph: r() * 6 }); }
      if (makoko) { for (var sh2 = 0; sh2 < 26; sh2++) { var hx = -70 + (sh2 % 9) * 16 + r() * 6, hz = 30 + Math.floor(sh2 / 9) * 22 + r() * 6; if (Math.abs(hx) < 20 && hz < 40) continue; var hg = new T.Group(); hg.position.set(hx, 0, hz); for (var st = 0; st < 4; st++) hg.add(mesh(new T.CylinderGeometry(0.15, 0.15, 3, 6), mat('piling', {}), (st % 2 ? 2.4 : -2.4), 0.6, (st < 2 ? 2 : -2))); hg.add(mesh(new T.BoxGeometry(6, 3, 5), mat('plank' + (sh2 % 3), { color: [0x7a5a3a, 0x6b5038, 0x8a6a48][sh2 % 3], roughness: 1 }), 0, 3.6, 0)); var rf = mesh(new T.BoxGeometry(6.6, 0.15, 5.6), mat('zinc', { color: 0x9a8a78, metalness: 0.4, roughness: 0.6 }), 0, 5.3, 0); rf.rotation.z = 0.12; hg.add(rf); jetG.add(hg); } }
      // The far shore's skyline across the water.
      var rs = rnd(61); for (var tb = 0; tb < 30; tb++) towerBlock(-260 + tb * 18 + rs() * 8, 260 + rs() * 80, 12 + rs() * 12, makoko ? 10 + rs() * 30 : 30 + rs() * 120, 12 + rs() * 10, jetG, 0, JT.towers);
      // The movers: a ferry, a speedboat and a canoe on a 60-second round.
      JT.ferry = hull(22, 6, 0xf4f3ec, 0.62, 0x1f5fa0); JT.speed = hull(8, 2.4, 0xffffff, 0.3, 0x17181a); JT.canoe = hull(7, 1.2, 0x6b4a2b, 0, 0);
      var paddler = person(5, false); paddler.position.set(0, 0.2, 0); paddler.scale.setScalar(0.9); JT.canoe.add(paddler);
      [JT.ferry, JT.speed].forEach(function (o) { var wk = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })); jetG.add(wk); JT.wakes.push({ m: wk, o: o }); });
      JT.dests = /^cc_/.test(sc.placeId || '') ? ['Komenda', 'Shama', 'Anomabo', 'Moree', 'Komenda'] : /^dxb_/.test(sc.placeId || '') ? ['Bur Dubai', 'Deira', 'Al Seef', 'the Marina', 'Bur Dubai'] : /^kum_/.test(sc.placeId || '') ? ['Abono', 'Dompa', 'Pipie', 'Obo', 'Abono'] : /^acc_/.test(sc.placeId || '') ? ['Tema', 'Ada', 'Winneba', 'Cape Coast', 'Tema'] : /^ph_/.test(sc.placeId || '') ? ['Bonny', 'Onne', 'Okrika', 'Abonnema', 'Bonny'] : /^abj_/.test(sc.placeId || '') ? ['the north shore', 'the island', 'the marina', 'the north shore', 'the island'] : ['Ikorodu', 'CMS', 'Falomo', 'Ebute-Ero', 'Tarkwa Bay'];
      JT.labels = [sprite('', 'rgba(23,24,26,.8)', '#fff', 18), sprite('', 'rgba(23,24,26,.8)', '#fff', 12)]; JT.labels.forEach(function (l) { jetG.add(l); });
      // Passengers waiting on the quay and the pier.
      var NW = 46, wr = rnd(29), wb = []; for (var w = 0; w < NW; w++) wb.push(w < 26 ? [-10 + wr() * 20, -24 + wr() * 8, wr() * 6] : [(wr() - 0.5) * 4, -8 + wr() * 36, wr() * 6]);
      JT.people = squad(NW, function (i) { return [0xc0392b, 0x2f6fa0, 0xf2b600, 0x2fa36b, 0x8e44ad, 0xe67e22, 0xf4f3ec][i % 7]; }, 1, jetG); JT.peopleBase = wb;
      if (/^(cms|lagoon_cruise|lagoon_jetty|ph_bonny_pl)$/.test(id)) partyBoat();
    }
    // The Lagoon party boat (the island jetty and the Lagoon Boat Cruise): moored by the pier, with the deck bar,
    // the captain's helm, an LED dance floor, speaker stacks, a sun deck with loungers, rails and life rings.
    function partyBoat() {
      var B = new T.Group(); B.position.set(-34, 0, 8); jetG.add(B); JT.party = { g: B };
      var hullM = mat('pbhull', { color: 0xf4f3ec, roughness: 0.4 }), deck = mat('pbdeck', { color: 0x6b3f22, roughness: 0.8 }), rail = mat('pbrail', { color: 0xdfe6ee, metalness: 0.7, roughness: 0.3 });
      B.add(mesh(new T.BoxGeometry(14, 2.6, 30), hullM, 0, 0.3, 0)); B.add(mesh(new T.BoxGeometry(14.2, 0.4, 30.2), mat('pbstripe', { color: 0x1f5fa0 }), 0, -0.6, 0));
      var bow = mesh(new T.CylinderGeometry(7, 7, 2.6, 3, 1), hullM, 0, 0.3, 16.5); bow.rotation.y = Math.PI / 2; bow.scale.set(1, 1, 0.5); B.add(bow);
      B.add(mesh(new T.BoxGeometry(13.6, 0.3, 30), deck, 0, 1.75, 0));
      [-6.8, 6.8].forEach(function (x) { B.add(mesh(new T.BoxGeometry(0.12, 0.12, 30), rail, x, 3, 0)); for (var p = -14; p <= 14; p += 2) B.add(mesh(new T.CylinderGeometry(0.05, 0.05, 1.2, 6), rail, x, 2.4, p)); });
      B.add(mesh(new T.BoxGeometry(13.6, 0.12, 0.12), rail, 0, 3, -15));
      // the deck bar with a shelf of bottles and a bartender
      B.add(mesh(new T.BoxGeometry(2, 1.8, 8), mat('pbbar', { color: 0xf4f3ec }), -5, 2.8, -8)); B.add(mesh(new T.BoxGeometry(2.4, 0.15, 8.4), mat('pbbartop', { color: 0x2b2d33 }), -5, 3.75, -8));
      for (var bt = 0; bt < 6; bt++) B.add(mesh(new T.CylinderGeometry(0.12, 0.14, 0.7, 8), mat('pbbtl' + bt % 3, { color: [0x1c7a4a, 0x2f6fd0, 0xc0392b][bt % 3], roughness: 0.1 }), -6.4, 4.6, -11 + bt * 1.2)); B.add(mesh(new T.BoxGeometry(0.2, 0.1, 8), mat('pbshelf', { color: 0x5a3a22 }), -6.4, 4.2, -8));
      for (var sb = 0; sb < 3; sb++) B.add(mesh(new T.CylinderGeometry(0.4, 0.4, 0.15, 12), mat('pbstool', { color: 0x17181a }), -3.4, 3, -10.5 + sb * 2.5));
      var bar1 = root.LasgidiAvatar3D && root.LasgidiGames3D ? avatarFor(root.LasgidiGames3D.stranger('deckbar', 0), 120) : person(120, true); bar1.position.set(-6, 1.9, -8); bar1.rotation.y = 0; B.add(bar1);
      // the captain's helm on a console at the bow end
      B.add(mesh(new T.BoxGeometry(4, 2.2, 2), mat('pbhelm', { color: 0xf4f3ec }), 0, 2.9, 11)); var wheel = new T.Mesh(new T.TorusGeometry(0.7, 0.07, 8, 24), mat('wheel', { color: 0x7a4b2a })); wheel.position.set(0, 4.3, 10); B.add(wheel); JT.party.wheel = wheel;
      for (var sp = 0; sp < 8; sp++) { var spk = mesh(new T.BoxGeometry(0.05, 1.7, 0.05), mat('wheel', {}), 0, 4.3, 10); spk.rotation.z = sp * Math.PI / 8; B.add(spk); }
      var cap = root.LasgidiAvatar3D && root.LasgidiGames3D ? avatarFor(root.LasgidiGames3D.stranger('captain', 0), 121) : person(121, false); cap.position.set(0, 1.9, 12.6); cap.rotation.y = -Math.PI / 2; B.add(cap);
      // the LED dance floor and speaker stacks
      var NT = 5, tiles = new T.InstancedMesh(new T.BoxGeometry(1.6, 0.08, 1.6), new T.MeshBasicMaterial({ color: 0xffffff }), NT * NT), m4 = new T.Matrix4(), c = new T.Color();
      for (var i = 0; i < NT; i++) for (var j = 0; j < NT; j++) { m4.makeTranslation(-2.6 + i * 1.75 + 1, 1.95, -3.5 + j * 1.75); tiles.setMatrixAt(i * NT + j, m4); tiles.setColorAt(i * NT + j, c.set(0x333333)); }
      B.add(tiles); JT.party.tiles = tiles; JT.party.NT = NT;
      [[-2.5, -5.5], [4.5, -5.5], [-2.5, 5], [4.5, 5]].forEach(function (q) { B.add(mesh(new T.BoxGeometry(1, 2.4, 0.9), mat('pbspk', { color: 0x3a3f46 }), q[0], 3.1, q[1])); });
      JT.party.dancers = []; for (var d = 0; d < 4; d++) { var f = root.LasgidiAvatar3D && root.LasgidiGames3D ? avatarFor(root.LasgidiGames3D.stranger('deck', d), 122 + d) : person(122 + d, d % 2 === 1); f.position.set(-1 + (d % 2) * 3, 1.95, -2 + Math.floor(d / 2) * 3); f.rotation.y = d * 1.5; B.add(f); JT.party.dancers.push(f); }
      // the sun deck: loungers at the stern, and life rings on the rails
      for (var l = 0; l < 3; l++) { var lg = new T.Group(); lg.position.set(4 + 0, 1.9, -13 + l * 0 + 0); lg.position.x = -4 + l * 4; lg.add(mesh(new T.BoxGeometry(1.4, 0.3, 3), mat('lounger', { color: 0xf4f3ec }), 0, 0.4, 0)); var back = mesh(new T.BoxGeometry(1.4, 0.2, 1.2), mat('lounger', {}), 0, 0.9, -1.4); back.rotation.x = -0.6; lg.add(back); B.add(lg); }
      [[6.85, -4], [-6.85, 6], [6.85, 9]].forEach(function (q) { var ring = new T.Mesh(new T.TorusGeometry(0.55, 0.16, 8, 20), mat('lring', { color: 0xff3b2f })); ring.position.set(q[0], 2.7, q[1]); ring.rotation.y = Math.PI / 2; B.add(ring); });
      // a sign on two poles
      var st = canvasTex(512, 96, function (g, w, h) { g.fillStyle = '#17213a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 54px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(/^ph_/.test(sc.placeId || '') ? 'RIVER CRUISE' : 'LAGOON CRUISE', w / 2, h / 2); });
      [-3, 3].forEach(function (x) { B.add(mesh(new T.CylinderGeometry(0.08, 0.08, 4, 6), rail, x, 4, 14)); }); var sm = new T.Mesh(new T.PlaneGeometry(7, 1.3), new T.MeshBasicMaterial({ map: st, side: T.DoubleSide })); sm.position.set(0, 6, 14); sm.rotation.y = Math.PI; B.add(sm);
      var L0 = new T.PointLight(0xff3fb4, 0, 22, 1.4); L0.position.set(0, 7, 0); B.add(L0); JT.party.light = L0;
      mergeStatic(B, [wheel]);
    }
    // A 60-second round: the ferry comes in and ties up at the T-head, a speedboat zips past, a canoe paddles along the shore.
    function jettyFrame(t, night) {
      var P = JT.party; if (P) { P.g.position.y = Math.sin(t * 1.1) * 0.08; P.g.rotation.z = Math.sin(t * 0.8) * 0.01; P.wheel.rotation.z = Math.sin(t * 0.4) * 0.6; P.light.intensity = night ? 30 : 0;
        var c9 = new T.Color(), A9 = new T.Color(0xff3fb4), B9 = new T.Color(0xffd23f); for (var i9 = 0; i9 < P.NT * P.NT; i9++) { c9.copy(A9).lerp(B9, 0.5 + 0.5 * Math.sin(t * 2.2 + i9 * 0.9)).offsetHSL((i9 % 4) * 0.15, 0, 0); P.tiles.setColorAt(i9, c9); } P.tiles.instanceColor.needsUpdate = true;
        P.dancers.forEach(function (f, k) { f.rotation.y = k * 1.5 + (reduce ? 0 : Math.sin(t * 1.5 + k) * 0.8); f.position.y = 1.95 + (reduce ? 0 : Math.abs(Math.sin(t * 4 + k)) * 0.12); var lg = f.userData.legs; if (lg && !reduce) { lg[0].rotation[f.userData.axis || 'z'] = Math.sin(t * 4 + k) * 0.35; lg[1].rotation[f.userData.axis || 'z'] = -Math.sin(t * 4 + k) * 0.35; } }); }
      var u = (t % 60) / 60, fx, fz, fyaw = Math.PI / 2;
      if (u < 0.35) { var a = u / 0.35, e = 1 - Math.pow(1 - a, 2); fx = -140 + e * 140; fz = 37 + (1 - e) * 30; fyaw = -Math.atan2(-30 * 2 * (1 - a), 140) ; }
      else if (u < 0.65) { fx = 0; fz = 37; fyaw = 0; }
      else { var d = (u - 0.65) / 0.35; fx = d * d * 160; fz = 37 + d * d * 40; fyaw = -Math.atan2(40 * d, 160 * d + 0.01); }
      JT.ferry.position.set(fx, Math.sin(t * 1.3) * 0.08, fz); JT.ferry.rotation.y = fyaw;
      var su = ((t + 20) % 30) / 30, sx = -200 + su * 400; JT.speed.position.set(sx, Math.sin(t * 4) * 0.12, 70); JT.speed.rotation.y = 0; JT.speed.rotation.z = 0.05;
      var cu = ((t + 7) % 80) / 80; JT.canoe.position.set(60 - cu * 120, Math.sin(t * 2) * 0.05, -12); JT.canoe.rotation.y = Math.PI;
      JT.wakes.forEach(function (w) { var o = w.o, moving = o === JT.speed || u < 0.35 || u > 0.65; w.m.visible = moving; w.m.position.set(o.position.x - Math.cos(o.rotation.y) * (o === JT.ferry ? 14 : 6), -0.3, o.position.z + Math.sin(o.rotation.y) * (o === JT.ferry ? 14 : 6)); w.m.rotation.y = o.rotation.y; w.m.scale.set(o === JT.ferry ? 16 : 10, 1, o === JT.ferry ? 5 : 2.4); w.m.material.opacity = 0.35 + Math.sin(t * 5) * 0.1; });
      var dest = (JT.dests || ['Ikorodu', 'CMS', 'Falomo', 'Ebute-Ero', 'Tarkwa Bay'])[Math.floor(t / 60) % 5], docked = u >= 0.35 && u < 0.65;
      label(JT.labels[0], docked ? '⛴ Boarding · to ' + dest : u < 0.35 ? '⛴ Arriving from ' + dest : '⛴ Departed · to ' + dest, docked ? '#1d7a43' : 'rgba(23,24,26,.8)', '#fff'); JT.labels[0].position.set(fx, 9, fz);
      label(JT.labels[1], '🚤 Water taxi', 'rgba(23,24,26,.8)', '#fff'); JT.labels[1].position.set(JT.speed.position.x, 5, 70);
      JT.boats.forEach(function (b) { b.o.position.y = Math.sin(t * 1.2 + b.ph) * 0.1; b.o.rotation.z = Math.sin(t * 0.9 + b.ph) * 0.02; });
      var P = JT.people, m4 = new T.Matrix4(); for (var i = 0; i < P.n; i++) { var pb = JT.peopleBase[i], boarding = docked && i >= 26 && (u - 0.35) / 0.3 > (i - 26) / 20; var pz = boarding ? 37 : pb[1], py = boarding ? -50 : (i >= 26 ? 1.1 : 0.85); m4.makeTranslation(pb[0], py + Math.abs(Math.sin(t * 2 + pb[2])) * 0.03, pz); P.body.setMatrixAt(i, m4); P.head.setMatrixAt(i, m4); }
      P.body.instanceMatrix.needsUpdate = P.head.instanceMatrix.needsUpdate = true;
      JT.lamps.forEach(function (m) { m.color.set(night ? 0xffd27a : 0x6b6458); }); JT.towers.forEach(function (m) { m.emissiveIntensity = night ? 0.9 : 0; }); JT.water.material.color.set(night ? 0x0b2236 : JT.makoko ? 0x4f7a6a : 0x3a8fb0);
    }


    /* ---------- parks: lawns and shade trees, a looping path, a pond, a gazebo, and each park's own landmark ---------- */
    var parkG = new T.Group(); parkG.visible = false; S3.add(parkG); var PK = {};
    var PATH_R = [34, 22];
    function pathAt(u) { var a = u * Math.PI * 2; return [Math.cos(a) * PATH_R[0] * (1 + 0.12 * Math.sin(a * 3)), Math.sin(a) * PATH_R[1] * (1 + 0.1 * Math.cos(a * 2)) + 6]; }
    function rockMesh(rad, seed, colr) {
      var g = new T.IcosahedronGeometry(rad, 4), p = g.attributes.position, rr = rnd(seed), v = new T.Vector3();
      var bumps = []; for (var b = 0; b < 26; b++) bumps.push([rr() * 2 - 1, rr() * 2 - 1, rr() * 2 - 1, 0.08 + rr() * 0.22]);
      for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); var k = 1; bumps.forEach(function (bb) { var d = v.x * bb[0] + v.y * bb[1] + v.z * bb[2]; k += Math.pow(Math.max(0, d), 3) * bb[3]; }); k += Math.sin(v.y * 40 + v.x * 6) * 0.015; var y = v.y < -0.1 ? -0.1 : v.y; p.setXYZ(i, v.x * rad * k, y * rad * k * 0.82, v.z * rad * k); }
      g.computeVertexNormals(); return new T.Mesh(g, new T.MeshStandardMaterial({ color: colr || 0x8a7a68, roughness: 0.95, flatShading: true }));
    }
    // Ikoyi Golf Club: six holes (tee, fairway, bunker, green and a numbered flag), a lake, buggies and the clubhouse terrace.
    var GOLF_HOLES = [[-46, -30, -20, -38], [-14, -40, 18, -28], [26, -18, 44, 8], [40, 22, 14, 36], [-4, 30, -30, 40], [-40, 18, -50, -6]];
    function golfCourse(r) {
      var fair = mat('fairway', { color: 0x5fae4a, roughness: 0.85 }), green = mat('green', { color: 0x79c95a, roughness: 0.6 }), sand = mat('bunker', { color: 0xe8d6a0, roughness: 1 }), tee = mat('tee', { color: 0x4f9a3d });
      PK.flags = [];
      GOLF_HOLES.forEach(function (h, i) {
        var dx = h[2] - h[0], dz = h[3] - h[1], len = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
        var fw = mesh(new T.CircleGeometry(1, 32).rotateX(-Math.PI / 2), fair, (h[0] + h[2]) / 2, 0.03, (h[1] + h[3]) / 2); fw.scale.set(len / 2 + 4, 1, 6); fw.rotation.y = -ang; fw.castShadow = false; parkG.add(fw);
        var gr = mesh(new T.CircleGeometry(5, 32).rotateX(-Math.PI / 2), green, h[2], 0.05, h[3]); gr.castShadow = false; parkG.add(gr);
        parkG.add(mesh(new T.BoxGeometry(4, 0.2, 4), tee, h[0], 0.1, h[1]));
        var bk = mesh(new T.CircleGeometry(2.6, 20).rotateX(-Math.PI / 2), sand, h[2] - Math.cos(ang) * 7 + Math.sin(ang) * 4, 0.06, h[3] - Math.sin(ang) * 7 - Math.cos(ang) * 4); bk.scale.set(1.4, 1, 0.8); bk.castShadow = false; parkG.add(bk);
        parkG.add(mesh(new T.CylinderGeometry(0.05, 0.05, 4.2, 6), mat('flagpole', { color: 0xf4f3ec }), h[2], 2.1, h[3]));
        var ft = canvasTex(128, 96, function (g, w, hh) { g.fillStyle = i % 2 ? '#d0453a' : '#f2c200'; g.fillRect(0, 0, w, hh); g.fillStyle = '#fff'; g.font = '900 70px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), w / 2, hh / 2 + 4); });
        var fl = new T.Mesh(new T.PlaneGeometry(1.4, 1), new T.MeshStandardMaterial({ map: ft, side: T.DoubleSide })); fl.position.set(h[2] + 0.72, 3.6, h[3]); parkG.add(fl); PK.flags.push(fl);
        parkG.add(mesh(new T.CylinderGeometry(0.22, 0.22, 0.05, 16), mat('cup', { color: 0x111111 }), h[2], 0.06, h[3]));
      });
      var lake = new T.Mesh(new T.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0x4f9fbf, roughness: 0.06, clearcoat: 1 })); lake.scale.set(12, 1, 7); lake.position.set(10, 0.04, 6); parkG.add(lake);
      // the clubhouse and its terrace
      var ch = new T.Group(); ch.position.set(0, 0, -62); ch.add(mesh(new T.BoxGeometry(34, 9, 14), mat('chw', { color: 0xf4efe4, roughness: 0.6 }), 0, 4.5, 0)); ch.add(mesh(new T.BoxGeometry(37, 1, 17), mat('chr', { color: 0x2b3a2b }), 0, 9.5, 0));
      for (var w2 = 0; w2 < 8; w2++) ch.add(mesh(new T.BoxGeometry(2.6, 3.4, 0.2), glassM, -14 + w2 * 4, 4.4, 7.05)); ch.add(mesh(new T.BoxGeometry(34, 0.4, 7), mat('terr', { color: 0xb08a5a }), 0, 0.6, 10.5));
      for (var u = 0; u < 4; u++) { ch.add(mesh(new T.CylinderGeometry(1, 1, 0.1, 16), mat('ttop', { color: 0xf4f3ec }), -12 + u * 8, 2, 10.5)); ch.add(mesh(new T.CylinderGeometry(0.1, 0.1, 4, 6), mat('upole', { color: 0x666666 }), -12 + u * 8, 2.6, 10.5)); ch.add(mesh(new T.ConeGeometry(2.6, 1.2, 8), mat('umb', { color: 0x1f5a3c }), -12 + u * 8, 4.6, 10.5)); }
      var st = canvasTex(1024, 128, function (g, w, h) { g.fillStyle = '#1f3a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#d4af37'; g.font = '800 64px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((sc.placeId === 'golf_abuja' ? 'ABUJA HILLS GOLF CLUB' : 'IKOYI GOLF CLUB') + ' · MEMBERS', w / 2, h / 2); });
      var sm = new T.Mesh(new T.PlaneGeometry(22, 2.75), new T.MeshBasicMaterial({ map: st })); sm.position.set(0, 7.6, 7.12); ch.add(sm); parkG.add(ch);
      // buggies and golfers mid-swing
      PK.golfers = [];
      [0xf4f3ec, 0xf4f3ec, 0x1f5a3c].forEach(function (c, k) { var b = carModel(c, 2.6); b.scale.set(0.8, 0.8, 0.8); b.position.set(-20 + k * 6, 0, -50 + k * 2); b.rotation.y = 0.3; parkG.add(b); });
      GOLF_HOLES.slice(0, 4).forEach(function (h, i) { var p = root.LasgidiAvatar3D && root.LasgidiGames3D ? avatarFor(root.LasgidiGames3D.stranger('golfer', i), 90 + i) : person(90 + i, i % 2 === 1); p.position.set(h[0] - 1, 0.05, h[1] + 1); p.rotation.y = -Math.atan2(h[3] - h[1], h[2] - h[0]); parkG.add(p);
        var club = mesh(new T.CylinderGeometry(0.03, 0.03, 1.4, 6), mat('club', { color: 0xc0c0c0, metalness: 0.9 }), 0, 0, 0); var pv = new T.Group(); pv.position.set(h[0] - 1, 1.3, h[1] + 1); club.position.y = -0.7; pv.add(club); parkG.add(pv); PK.golfers.push({ pv: pv, ph: i * 1.7 }); });
      PK.ball = mesh(new T.SphereGeometry(0.18, 12, 8), mat('ball', { color: 0xffffff, roughness: 0.3 }), 0, 0, 0); parkG.add(PK.ball);
    }
    // Lekki Conservation Centre, close up: raised platforms in the trees joined by a rope canopy walkway, a tree house,
    // a boardwalk over the mangrove water, the nature trail sign, a picnic lawn and monkeys in the branches.
    function lccExtras(r) {
      var wood = mat('lccwood', { color: 0x7a4b2a, roughness: 0.9 }), rope = new T.LineBasicMaterial({ color: 0xc8a165 });
      var plats = [[-18, 6], [-4, -2], [10, 4], [22, -6]];
      plats.forEach(function (p) { parkG.add(mesh(new T.CylinderGeometry(0.9, 1.2, 9, 8), wood, p[0], 4.5, p[1])); parkG.add(mesh(new T.CylinderGeometry(3, 3, 0.4, 12), wood, p[0], 9, p[1])); parkG.add(mesh(new T.IcosahedronGeometry(5, 1), mat('lcccrown', { color: 0x2f7a4a, roughness: 0.9, flatShading: true }), p[0], 14, p[1])); });
      for (var k = 0; k < plats.length - 1; k++) { var a = plats[k], b = plats[k + 1], n = 14; for (var j = 0; j <= n; j++) { var u = j / n, sag = Math.sin(u * Math.PI) * 1.2, x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u, pl = mesh(new T.BoxGeometry(0.5, 0.12, 1.6), mat('plank', { color: 0x9a6a3a }), x, 9 - sag, z); pl.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); parkG.add(pl); }
        [-0.8, 0.8].forEach(function (off) { var pts = []; for (var j2 = 0; j2 <= 12; j2++) { var u2 = j2 / 12, dir = Math.atan2(b[1] - a[1], b[0] - a[0]); pts.push(new T.Vector3(a[0] + (b[0] - a[0]) * u2 - Math.sin(dir) * off, 10.1 - Math.sin(u2 * Math.PI) * 1.2, a[1] + (b[1] - a[1]) * u2 + Math.cos(dir) * off)); } parkG.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), rope)); }); }
      PK.walkway = { plats: plats };
      var th = new T.Group(); th.position.set(-30, 0, -14); [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(function (q) { th.add(mesh(new T.BoxGeometry(0.4, 6, 0.4), wood, q[0], 3, q[1])); });
      th.add(mesh(new T.BoxGeometry(6, 0.4, 6), wood, 0, 6, 0)); th.add(mesh(new T.BoxGeometry(5, 4, 5), mat('thw', { color: 0xa0522d }), 0, 8.2, 0)); th.add(mesh(new T.BoxGeometry(1.2, 2, 0.1), mat('thd', { color: 0x2b1a10 }), 0, 7.8, 2.55));
      var roof = mesh(new T.ConeGeometry(4.8, 2.6, 4), mat('thr', { color: 0x8b2e1f }), 0, 11.5, 0); roof.rotation.y = Math.PI / 4; th.add(roof); for (var s2 = 0; s2 < 6; s2++) th.add(mesh(new T.BoxGeometry(1.4, 0.15, 0.4), wood, 2.6, 0.6 + s2, 2.6 - s2 * 0.1)); parkG.add(th);
      var sw = new T.Mesh(new T.PlaneGeometry(40, 16).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0x3f5f3a, roughness: 0.15, clearcoat: 0.6 })); sw.position.set(18, 0.05, 22); parkG.add(sw);
      for (var bw = 0; bw < 16; bw++) parkG.add(mesh(new T.BoxGeometry(2.4, 0.2, 2.2), wood, 0 + bw * 2.4, 0.5, 22));
      for (var mg = 0; mg < 22; mg++) { var mx = 2 + r() * 34, mz = 15 + r() * 14; if (Math.abs(mz - 22) < 2) continue; parkG.add(mesh(new T.IcosahedronGeometry(1.4 + r(), 0), mat('mangrove', { color: 0x2d5a33, flatShading: true }), mx, 1.6, mz)); }
      var sg = canvasTex(512, 128, function (g, w, h) { g.fillStyle = '#3b2a1a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4e6c8'; g.font = '800 54px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NATURE TRAIL →', w / 2, h / 2); });
      parkG.add(mesh(new T.BoxGeometry(0.3, 4, 0.3), wood, 26, 2, 4)); var sgm = new T.Mesh(new T.PlaneGeometry(5, 1.25), new T.MeshBasicMaterial({ map: sg, side: T.DoubleSide })); sgm.position.set(26, 3.6, 4); sgm.rotation.y = Math.PI; parkG.add(sgm);
      var cs = canvasTex(512, 128, function (g, w, h) { g.fillStyle = '#1f3a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4e6c8'; g.font = '800 46px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CONSERVATION CENTRE', w / 2, h / 2); });
      [-6, 6].forEach(function (x) { parkG.add(mesh(new T.BoxGeometry(0.4, 6, 0.4), wood, x, 3, -20)); }); var csm = new T.Mesh(new T.PlaneGeometry(12, 3), new T.MeshBasicMaterial({ map: cs, side: T.DoubleSide })); csm.position.set(0, 5.6, -20); csm.rotation.y = Math.PI; parkG.add(csm);
      var pic = canvasTex(256, 256, function (g, w, h) { for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#c0392b' : '#ffffff'; g.fillRect(x * 32, y * 32, 32, 32); } });
      [[-12, -8], [-6, -12]].forEach(function (q) { var bl = new T.Mesh(new T.PlaneGeometry(4, 3).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: pic })); bl.position.set(q[0], 0.06, q[1]); parkG.add(bl); parkG.add(mesh(new T.CylinderGeometry(0.7, 0.8, 0.8, 12), mat('basketL', { color: 0xa9743f }), q[0] + 1.2, 0.4, q[1] + 0.6)); });
      PK.monkeys = []; plats.forEach(function (p, i) { var m = new T.Group(), fur = mat('fur', { color: 0x6b5a45, roughness: 1 }); m.add(mesh(new T.SphereGeometry(0.35, 10, 8), fur, 0, 0, 0)); m.add(mesh(new T.SphereGeometry(0.22, 10, 8), fur, 0.3, 0.3, 0)); var tl = mesh(new T.CylinderGeometry(0.04, 0.03, 1, 5), fur, -0.4, -0.3, 0); tl.rotation.z = 0.8; m.add(tl); m.position.set(p[0] + 1.5, 12, p[1]); parkG.add(m); PK.monkeys.push({ m: m, p: p, ph: i }); });
    }
    function buildPark() {
      wipe(parkG); var id = sc.placeId || 'park', r = rnd(hashStr(id)); PK = { lamps: [], towers: [], spray: [] }; var golf = /^golf_/.test(id), open = golf || /polo|funpark|waterpark|ldn_eye/.test(id); // golf and polo clear the middle of the park
      var lawn = mesh(new T.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), mat('parklawn', { map: grassTex, roughness: 0.95 }), 0, 0, 0); lawn.castShadow = false; parkG.add(lawn);
      if (!open) {
      // The looping path, as short paving segments.
      for (var k = 0; k < 90; k++) { var a = pathAt(k / 90), b = pathAt((k + 1) / 90), seg = mesh(new T.BoxGeometry(Math.hypot(b[0] - a[0], b[1] - a[1]) + 0.3, 0.06, 3), mat('ppath', { color: 0xd9cdb6, roughness: 0.9 }), (a[0] + b[0]) / 2, 0.04, (a[1] + b[1]) / 2); seg.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); seg.castShadow = false; parkG.add(seg); }
      // A pond with a little fountain, and the gazebo by it.
      var pond = new T.Mesh(new T.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0x6fb7c9, roughness: 0.08, clearcoat: 1 })); pond.scale.set(11, 1, 7); pond.position.set(6, 0.06, 8); parkG.add(pond);
      var rimP = mesh(new T.TorusGeometry(1, 0.06, 6, 48).rotateX(Math.PI / 2), mat('pebble', { color: 0xa9a294, roughness: 1 }), 6, 0.08, 8); rimP.scale.set(11, 1, 7); parkG.add(rimP);
      PK.spray = []; for (var f = 0; f < 40; f++) { var d = mesh(new T.SphereGeometry(0.1, 6, 4), mat('sprayM', { color: 0xf4fbff, roughness: 0.2, transparent: true, opacity: 0.8 }), 6, 0.5, 8); d.castShadow = false; parkG.add(d); PK.spray.push(d); }
      var gz = new T.Group(); gz.position.set(-14, 0, 12); gz.add(mesh(new T.CylinderGeometry(5, 5.2, 0.5, 8), mat('gzbase', { color: 0xe9e5dc, roughness: 0.7 }), 0, 0.25, 0)); for (var gp = 0; gp < 8; gp++) { var ga = gp / 8 * Math.PI * 2; gz.add(mesh(new T.CylinderGeometry(0.15, 0.15, 3.4, 8), white, Math.cos(ga) * 4.4, 2.2, Math.sin(ga) * 4.4)); } var gr = mesh(new T.ConeGeometry(5.8, 2.4, 8), mat('gzroof', { color: 0x7a3b2a, roughness: 0.8 }), 0, 5.1, 0); gz.add(gr); parkG.add(gz);
      }
      // Shade trees (instanced crowns and trunks), palms, flower beds, benches, lamps.
      var NT = open ? 24 : 70, crowns = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), new T.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), NT), trunks = new T.InstancedMesh(new T.CylinderGeometry(0.25, 0.35, 1, 6), trunkM, NT), m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), s3 = new T.Vector3(), c = new T.Color();
      for (var t = 0; t < NT; t++) { var ang = r() * Math.PI * 2, rad = t < 24 && !open ? 12 + r() * 14 : (open ? 62 : 42) + r() * 50, tx = Math.cos(ang) * rad * 1.3, tz = Math.sin(ang) * rad + 6; if (Math.abs(tx - 6) < 13 && Math.abs(tz - 8) < 9) tz += 18; if (tz < 4 && Math.abs(tx) < 40) tz = 30 + r() * 20; var h = 3 + r() * 3, cr = 2.4 + r() * 2.6; m4.compose(v.set(tx, h + cr * 0.6, tz), q, s3.set(cr, cr * 0.85, cr)); crowns.setMatrixAt(t, m4); crowns.setColorAt(t, c.setHSL(0.26 + r() * 0.08, 0.45, 0.24 + r() * 0.12)); m4.compose(v.set(tx, h / 2, tz), q, s3.set(1, h, 1)); trunks.setMatrixAt(t, m4); }
      crowns.castShadow = trunks.castShadow = true; parkG.add(crowns, trunks);
      var NF = open ? 1 : 260, flowers = new T.InstancedMesh(new T.SphereGeometry(0.22, 6, 4), new T.MeshStandardMaterial({ roughness: 0.7 }), NF);
      for (var fl = 0; fl < NF; fl++) { var bed = fl % 4, bx = [-28, 26, -6, 20][bed], bz = [-6, -4, 26, 24][bed]; m4.makeTranslation(bx + (r() - 0.5) * 8, 0.25, bz + (r() - 0.5) * 3); flowers.setMatrixAt(fl, m4); flowers.setColorAt(fl, c.set([0xd23b2f, 0xf2b600, 0xe85aa0, 0xf4f3ec, 0x8e44ad][Math.floor(r() * 5)])); } parkG.add(flowers);
      for (var bn = 0; bn < (open ? 0 : 10); bn++) { var bp = pathAt(bn / 10 + 0.03), bg = new T.Group(); bg.position.set(bp[0] * 1.12, 0, (bp[1] - 6) * 1.18 + 6); bg.lookAt(0, 0, 6); bg.add(mesh(new T.BoxGeometry(2.4, 0.15, 0.7), mat('bench', { color: 0x8a6a3a, roughness: 0.8 }), 0, 0.6, 0)); bg.add(mesh(new T.BoxGeometry(2.4, 0.6, 0.12), mat('bench', {}), 0, 1.0, -0.32)); parkG.add(bg); }
      for (var lp2 = 0; lp2 < (open ? 0 : 14); lp2++) { var lpp = pathAt(lp2 / 14); parkG.add(mesh(new T.CylinderGeometry(0.1, 0.12, 4, 6), frameM, lpp[0] * 0.9, 2, (lpp[1] - 6) * 0.86 + 6)); var lb = new T.MeshBasicMaterial({ color: 0x6b6458 }), bulb = new T.Mesh(new T.SphereGeometry(0.3, 8, 6), lb); bulb.position.set(lpp[0] * 0.9, 4.2, (lpp[1] - 6) * 0.86 + 6); parkG.add(bulb); PK.lamps.push(lb); }
      [[0, 3], [-10, -3], [18, 2]].forEach(function (pq, i) { palm(pq[0] + 30, pq[1] - 20, 8 + i, 0.2); });
      // Each park's landmark: a great rock, the city gate, a canopy walkway, the zoo's enclosures, or a city skyline.
      if (/aso|zuma/.test(id)) { var rock = rockMesh(/zuma/.test(id) ? 70 : 55, hashStr(id), /zuma/.test(id) ? 0x7d6e5e : 0x8a7a68); rock.position.set(-30, 0, 230); rock.castShadow = true; parkG.add(rock); }
      else if (/gate/.test(id)) { var gateM = mat('gate', { color: 0xf1ece2, roughness: 0.6 }); [-16, 16].forEach(function (x) { parkG.add(mesh(new T.BoxGeometry(5, 26, 5), gateM, x, 13, 70)); }); parkG.add(mesh(new T.BoxGeometry(40, 5, 6), gateM, 0, 28, 70)); parkG.add(mesh(new T.TorusGeometry(10, 1.2, 8, 32, Math.PI), mat('gateG', { color: 0x1d7a43 }), 0, 30, 70)); }
      else if (/lcc/.test(id)) { for (var cw = 0; cw < 8; cw++) { var x0 = -40 + cw * 12, pts = []; for (var cu = 0; cu <= 10; cu++) { var uu = cu / 10; pts.push(new T.Vector3(x0 + uu * 12, 12 - Math.sin(uu * Math.PI) * 1.4, 40 + Math.sin(cw) * 6)); } parkG.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x5a4632 }))); parkG.add(mesh(new T.CylinderGeometry(0.4, 0.5, 13, 6), trunkM, x0, 6.5, 40 + Math.sin(cw) * 6)); var plat = mesh(new T.CylinderGeometry(1.6, 1.6, 0.3, 10), mat('plank0', { color: 0x7a5a3a }), x0, 12, 40 + Math.sin(cw) * 6); parkG.add(plat); } }
      else if (/zoo/.test(id)) { [[-34, 40], [0, 46], [34, 40]].forEach(function (zq, zi) { for (var zp = 0; zp < 14; zp++) { var za = zp / 14 * Math.PI * 2; parkG.add(mesh(new T.CylinderGeometry(0.1, 0.1, 2.4, 6), frameM, zq[0] + Math.cos(za) * 9, 1.2, zq[1] + Math.sin(za) * 6)); } var an = new T.Group(); an.position.set(zq[0], 0, zq[1]); var am = mat('animal' + zi, { color: [0xc9a46a, 0x6b6b6b, 0x8a5a3c][zi], roughness: 0.8 }); an.add(mesh(new T.CapsuleGeometry(0.7, 1.6, 4, 8).rotateZ(Math.PI / 2), am, 0, 1.4, 0)); an.add(mesh(new T.SphereGeometry(0.5, 10, 8), am, 1.5, 1.9, 0)); [[-0.8, -0.4], [-0.8, 0.4], [0.8, -0.4], [0.8, 0.4]].forEach(function (lq) { an.add(mesh(new T.CylinderGeometry(0.12, 0.12, 1, 6), am, lq[0], 0.5, lq[1])); }); parkG.add(an); }); }
      if (golf) golfCourse(r); if (/lcc/.test(id)) lccExtras(r); if (/funpark/.test(id)) funRides(); if (/polo/.test(id)) poloField(); if (/waterpark/.test(id)) waterPark(); if (id === 'ldn_eye') londonEye();
      var rs = rnd(81); for (var tb = 0; tb < 26; tb++) { var ta = -1.2 + rs() * 2.4, td = 160 + rs() * 120; towerBlock(Math.sin(ta) * td, Math.cos(ta) * td + 40, 14 + rs() * 12, (/abj|ph_/.test(id) ? 12 : 25) + rs() * 70, 14 + rs() * 10, parkG, 0, PK.towers); }
      // Joggers and strollers going round the path, families on picnic blankets.
      var NW = golf ? 6 : 60, wb = [], wr = rnd(37); for (var w = 0; w < NW; w++) wb.push([wr(), (wr() < 0.3 ? 2.2 : 1) * (wr() < 0.5 ? 1 : -1) * (0.008 + wr() * 0.006), (wr() - 0.5) * 1.6, wr() * 6]);
      PK.walkers = squad(NW, function (i) { return [0xc0392b, 0x2f6fa0, 0xf2b600, 0x2fa36b, 0x8e44ad, 0xe67e22, 0xf4f3ec][i % 7]; }, 1, parkG); PK.walkBase = wb; if (golf) { PK.walkers.body.visible = PK.walkers.head.visible = false; }
      if (golf || /lcc|funpark|zoo|polo|waterpark|ldn_eye/.test(id)) mergeStatic(parkG, [lawn].concat(PK.spray || [], PK.flags || [], (PK.golfers || []).map(function (g) { return g.pv; }), PK.ball ? [PK.ball] : [], (PK.monkeys || []).map(function (k) { return k.m; })));
      for (var pc = 0; pc < (open ? 0 : 6); pc++) { var px = -24 + pc * 9 + r() * 3, pz = -12 + (pc % 2) * 30; var bl = mesh(new T.BoxGeometry(3, 0.04, 2.4), mat('blanket' + pc % 3, { color: [0xc0392b, 0x1f5fa0, 0xf2b600][pc % 3], roughness: 0.9 }), px, 0.05, pz); bl.castShadow = false; parkG.add(bl); }
    }
    // Capital Polo Grounds: a striped field with goal posts, the stand, the members' pavilion and six riders after the ball.
    function horse(col, ri) {
      var g = new T.Group(), hm = mat('horse' + col, { color: col, roughness: 0.7 }); g.add(mesh(new T.BoxGeometry(2.6, 1.1, 0.9), hm, 0, 1.9, 0)); var nk = mesh(new T.BoxGeometry(0.5, 1.3, 0.5), hm, 1.3, 2.6, 0); nk.rotation.z = -0.5; g.add(nk); g.add(mesh(new T.BoxGeometry(0.9, 0.45, 0.45), hm, 1.85, 3.15, 0));
      var legs = []; [[-1, -0.3], [-1, 0.3], [1, -0.3], [1, 0.3]].forEach(function (q) { var lg = new T.Group(); lg.position.set(q[0], 1.4, q[1]); var m = mesh(new T.CylinderGeometry(0.11, 0.09, 1.4, 6), hm, 0, -0.7, 0); lg.add(m); g.add(lg); legs.push(lg); });
      var rider = person(80 + ri, false); rider.position.set(-0.1, 1.8, 0); rider.scale.setScalar(0.9); g.add(rider); g.add(mesh(new T.CylinderGeometry(0.03, 0.03, 2.4, 4), mat('mallet', { color: 0xd9c49a }), 0.6, 2.2, 0.6));
      g.userData.dyn = true; g.userData.hlegs = legs; return g;
    }
    function poloField() {
      for (var st = 0; st < 8; st++) { var sm = mesh(new T.BoxGeometry(10, 0.04, 34), mat(st % 2 ? 'poloA' : 'poloB', { color: st % 2 ? 0x4f9e3c : 0x5bb046, roughness: 0.9 }), -35 + st * 10, 0.05, 6); sm.castShadow = false; parkG.add(sm); }
      [-40, 40].forEach(function (x) { [-3.5, 3.5].forEach(function (z) { parkG.add(mesh(new T.CylinderGeometry(0.2, 0.25, 3.4, 8), white, x, 1.7, 6 + z)); }); });
      for (var tr = 0; tr < 5; tr++) parkG.add(mesh(new T.BoxGeometry(60, 0.8, 2), mat('poloStand', { color: 0xf4f1ea }), 0, 0.4 + tr * 0.8, 27 + tr * 2)); parkG.add(mesh(new T.BoxGeometry(62, 0.4, 12), mat('poloRoof', { color: 0x1f5a3c }), 0, 7, 31));
      var pv = new T.Group(); pv.position.set(-52, 0, 8); pv.add(mesh(new T.BoxGeometry(14, 5, 9), white, 0, 2.5, 0)); pv.add(mesh(new T.ConeGeometry(10, 3.2, 4), mat('poloPav', { color: 0x9a2a2a }), 0, 6.6, 0)); pv.children[1].rotation.y = Math.PI / 4; pv.add(mesh(new T.BoxGeometry(14.4, 0.2, 4), mat('poloDeck', { color: 0x8a6a4a }), 0, 0.6, -6)); parkG.add(pv);
      var sgT = canvasTex(512, 96, function (g, w, h) { g.fillStyle = '#1f5a3c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f1ea'; g.font = '800 46px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CAPITAL POLO GROUNDS', w / 2, h / 2, w - 24); }), sg = new T.Mesh(new T.PlaneGeometry(14, 2.6), new T.MeshBasicMaterial({ map: sgT })); sg.position.set(0, 9, 25.4); sg.rotation.y = Math.PI; parkG.add(sg);
      PK.ponies = []; for (var h = 0; h < 6; h++) { var hr = horse([0x6b3f22, 0x2b1a10, 0x9a6a3a][h % 3], h); parkG.add(hr); hr.position.set(-12 + h * 5, 0, 2 + (h % 2) * 8); PK.ponies.push({ g: hr, ph: h * 0.9, team: h % 2 }); }
      PK.poloBall = mesh(new T.SphereGeometry(0.25, 10, 8), white, 0, 0.3, 6); PK.poloBall.userData.dyn = true; parkG.add(PK.poloBall);
    }
    // Lekki Leisure Waterpark: a wave pool, three slides from a tower, a lazy river ring, loungers and umbrellas.
    function waterPark() {
      var water = new T.MeshPhysicalMaterial({ color: 0x3fc1e0, roughness: 0.05, clearcoat: 1, emissive: 0x0a3a4a, emissiveIntensity: 0.3 }), tile = mat('wpTile', { color: 0xf4f3ec, roughness: 0.4 });
      parkG.add(mesh(new T.BoxGeometry(34, 0.4, 20), tile, 0, 0.2, 8)); var wpool = new T.Mesh(new T.BoxGeometry(32, 0.2, 18), water); wpool.position.set(0, 0.42, 8); parkG.add(wpool); PK.wave = wpool; wpool.userData.dyn = true;
      var ring = new T.Mesh(new T.TorusGeometry(26, 2, 6, 48).rotateX(Math.PI / 2), water); ring.scale.y = 0.15; ring.position.set(0, 0.3, 8); parkG.add(ring);
      var tw = new T.Group(); tw.position.set(-28, 0, 34); tw.add(mesh(new T.BoxGeometry(6, 14, 6), mat('wpTower', { color: 0xf2b600 }), 0, 7, 0)); tw.add(mesh(new T.BoxGeometry(7, 0.4, 7), tile, 0, 14.2, 0)); parkG.add(tw);
      [[0xc0392b, 0.2], [0x2f6fa0, 0.7], [0x16a35a, 1.2]].forEach(function (q, i) { var pts = []; for (var k = 0; k <= 24; k++) { var u = k / 24, a = q[1] + u * 3.2; pts.push(new T.Vector3(-28 + Math.cos(a) * (4 + u * 10), 14 - u * 13.4, 34 + Math.sin(a) * (4 + u * 10) - u * 14)); } var sl = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 48, 0.9, 8, false), mat('wpSlide' + i, { color: q[0], roughness: 0.3, side: T.DoubleSide })); sl.castShadow = true; parkG.add(sl); });
      for (var lg = 0; lg < 10; lg++) { var lx = -20 + lg * 4.4, lz = -6; parkG.add(mesh(new T.BoxGeometry(1.4, 0.35, 3.2), mat('wpLounger', { color: 0xffffff }), lx, 0.4, lz)); if (lg % 2 === 0) { parkG.add(mesh(new T.CylinderGeometry(0.06, 0.06, 3.4, 6), frameM, lx + 2.2, 1.7, lz)); parkG.add(mesh(new T.ConeGeometry(2, 0.8, 10, 1, true), mat('wpUmb' + (lg % 4), { color: [0xc0392b, 0xf2b600, 0x2f6fa0, 0x16a35a][lg % 4], side: T.DoubleSide }), lx + 2.2, 3.4, lz)); } }
      PK.swimmers = []; for (var sw = 0; sw < 14; sw++) { var b = mesh(new T.SphereGeometry(0.32, 8, 6), mat('skin' + sw % 4, { color: [0x5a341f, 0x8d5a3b, 0x3d2416, 0x6b4029][sw % 4] }), -12 + (sw % 7) * 4, 0.7, 2 + Math.floor(sw / 7) * 8); b.userData.dyn = true; parkG.add(b); PK.swimmers.push({ m: b, ph: sw * 0.7 }); }
      var sgT = canvasTex(512, 96, function (g, w, h) { g.fillStyle = '#2f6fa0'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 50px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LEKKI LEISURE WATERPARK', w / 2, h / 2, w - 24); }), sg = new T.Mesh(new T.PlaneGeometry(14, 2.6), new T.MeshBasicMaterial({ map: sgT })); sg.position.set(0, 7, 40); sg.rotation.y = Math.PI; parkG.add(sg);
    }
    // Capital Fun Park: a Ferris wheel, a carousel and a bumper-car rink.
    function funRides() {
      var steel = mat('funSteel', { color: 0xdfe3e8, metalness: 0.7, roughness: 0.3 }), W = new T.Group(); W.position.set(0, 16, 46);
      W.add(mesh(new T.TorusGeometry(14, 0.25, 6, 48), steel, 0, 0, 0)); W.add(mesh(new T.TorusGeometry(14, 0.25, 6, 48), steel, 0, 0, 1.6));
      for (var sp = 0; sp < 12; sp++) { var a = sp / 12 * Math.PI * 2, spk = mesh(new T.BoxGeometry(0.2, 14, 0.2), steel, Math.cos(a) * 7, Math.sin(a) * 7, 0.8); spk.rotation.z = a - Math.PI / 2; W.add(spk); }
      PK.cabins = []; for (var cb = 0; cb < 12; cb++) { var ca = cb / 12 * Math.PI * 2, cab = mesh(new T.BoxGeometry(2, 1.8, 1.6), mat('funCab' + cb % 4, { color: [0xc0392b, 0xf2b600, 0x2f6fa0, 0x16a35a][cb % 4], roughness: 0.4 }), Math.cos(ca) * 14, Math.sin(ca) * 14 - 1.2, 0.8); W.add(cab); PK.cabins.push(cab); }
      parkG.add(W); PK.wheel = W; W.userData.dyn = true; [-1, 1].forEach(function (sd) { var leg = mesh(new T.BoxGeometry(0.5, 18, 0.5), steel, sd * 5, 8, 44.6); leg.rotation.z = sd * 0.28; parkG.add(leg); var leg2 = leg.clone(); leg2.position.z = 49; parkG.add(leg2); });
      var C = new T.Group(); C.position.set(-30, 0, 28); C.add(mesh(new T.CylinderGeometry(7, 7, 0.6, 32), mat('carDeck', { color: 0xf4f3ec }), 0, 0.5, 0)); C.add(mesh(new T.ConeGeometry(7.6, 3, 16), mat('carTop', { color: 0xc0392b, roughness: 0.5 }), 0, 6.8, 0)); C.add(mesh(new T.CylinderGeometry(0.6, 0.6, 5.4, 10), steel, 0, 3.2, 0));
      for (var hs = 0; hs < 8; hs++) { var ha = hs / 8 * Math.PI * 2, hg = new T.Group(); hg.position.set(Math.cos(ha) * 5, 0, Math.sin(ha) * 5); hg.rotation.y = -ha; hg.add(mesh(new T.CylinderGeometry(0.06, 0.06, 4.6, 6), mat('funGold', { color: 0xd4af37, metalness: 0.8, roughness: 0.3 }), 0, 3, 0)); hg.add(mesh(new T.BoxGeometry(0.5, 0.7, 1.6), mat('funCab' + hs % 4, {}), 0, 2, 0)); hg.add(mesh(new T.BoxGeometry(0.35, 0.6, 0.4), mat('funCab' + hs % 4, {}), 0, 2.6, 0.75)); C.add(hg); }
      C.userData.dyn = true; parkG.add(C); PK.carousel = C;
      var rk = new T.Group(); rk.position.set(30, 0, 28); rk.add(mesh(new T.BoxGeometry(18, 0.15, 12), mat('rink', { color: 0x2b2f36, roughness: 0.3, metalness: 0.3 }), 0, 0.08, 0)); [[0, -6, 18, 0.2], [0, 6, 18, 0.2], [-9, 0, 0.2, 12], [9, 0, 0.2, 12]].forEach(function (q) { rk.add(mesh(new T.BoxGeometry(q[2] || 0.2, 0.8, q[3] || 0.2), mat('rinkRail', { color: 0xf2b600 }), q[0], 0.5, q[1])); });
      rk.add(mesh(new T.BoxGeometry(18.4, 0.3, 12.4), mat('rinkRoof', { color: 0x2f6fa0 }), 0, 5, 0)); [[-9, -6], [9, -6], [-9, 6], [9, 6]].forEach(function (q) { rk.add(mesh(new T.CylinderGeometry(0.15, 0.15, 5, 6), steel, q[0], 2.5, q[1])); }); parkG.add(rk);
      PK.bumpers = []; for (var bc = 0; bc < 6; bc++) { var car = new T.Group(); car.add(mesh(new T.BoxGeometry(1.8, 0.7, 1.3), mat('funCab' + bc % 4, {}), 0, 0.55, 0)); car.add(mesh(new T.TorusGeometry(0.8, 0.12, 6, 16).rotateX(Math.PI / 2), mat('tyre', { color: 0x111111 }), 0, 0.3, 0)); car.position.set(30, 0, 28); car.userData.dyn = true; parkG.add(car); PK.bumpers.push({ g: car, ph: bc * 1.7 }); }
      [['FERRIS WHEEL', 0, 30], ['CAROUSEL', -30, 37], ['BUMPER CARS', 30, 36]].forEach(function (q) { var st = canvasTex(512, 96, function (g, w, h) { g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 56px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(q[0], w / 2, h / 2); }); var sm = new T.Mesh(new T.PlaneGeometry(8, 1.5), new T.MeshBasicMaterial({ map: st })); sm.position.set(q[1], 7.5, q[2]); sm.rotation.y = Math.PI; parkG.add(sm); });
    }
    function parkFrame(t, night) {
      var W = PK.walkers, m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), one = new T.Vector3(1, 1, 1), n = night ? Math.round(W.n * 0.25) : W.n;
      for (var i = 0; i < W.n; i++) { var b = PK.walkBase[i]; if (i >= n) { m4.makeTranslation(0, -9, 0); W.body.setMatrixAt(i, m4); W.head.setMatrixAt(i, m4); continue; } var u = ((b[0] + t * b[1]) % 1 + 1) % 1, p = pathAt(u), p2 = pathAt((u + 0.002 * Math.sign(b[1]) + 1) % 1); e.set(0, Math.atan2(-(p2[1] - p[1]), p2[0] - p[0]), 0); q.setFromEuler(e); m4.compose(v.set(p[0] + b[2], Math.abs(Math.sin(t * (Math.abs(b[1]) > 0.016 ? 12 : 6) + b[3])) * 0.08, p[1] + b[2]), q, one); W.body.setMatrixAt(i, m4); W.head.setMatrixAt(i, m4); }
      W.body.instanceMatrix.needsUpdate = W.head.instanceMatrix.needsUpdate = true;
      PK.spray.forEach(function (d, i) { var u = (t * 0.6 + i / PK.spray.length) % 1, a = i * 2.39, rad = 1.6 * u; d.position.set(6 + Math.cos(a) * rad, 0.3 + Math.sin(u * Math.PI) * 3.2, 8 + Math.sin(a) * rad * 0.8); });
      PK.lamps.forEach(function (m) { m.color.set(night ? 0xffe2a0 : 0x6b6458); });
      if (PK.flags) PK.flags.forEach(function (f, i) { f.rotation.y = Math.sin(t * 2 + i) * 0.3; });
      if (PK.golfers) { PK.golfers.forEach(function (g, i) { var c = ((t * 0.5 + g.ph) % 3), sw = c < 1 ? -c * 2.2 : c < 1.2 ? -2.2 + (c - 1) * 22 : 2.2 - Math.min(2.2, (c - 1.2) * 3); g.pv.rotation.z = sw * 0.8; });
        var h = GOLF_HOLES[Math.floor(t / 5) % GOLF_HOLES.length], u = (t % 5) / 5; PK.ball.position.set(h[0] + (h[2] - h[0]) * u, 0.2 + Math.sin(u * Math.PI) * 14, h[1] + (h[3] - h[1]) * u); }
      if (PK.swimmers) { PK.wave.position.y = 0.42 + Math.sin(t * 1.5) * 0.08; PK.swimmers.forEach(function (w) { w.m.position.y = 0.62 + Math.sin(t * 2 + w.ph) * 0.12; }); }
      if (PK.ponies) { var bx = Math.sin(t * 0.21) * 32, bz = 6 + Math.sin(t * 0.37) * 10; PK.poloBall.position.set(bx, 0.3, bz); PK.ponies.forEach(function (p, i) { var ax = bx + Math.sin(t * 0.5 + p.ph) * 6 - (p.team ? 4 : -4), az = bz + Math.cos(t * 0.4 + p.ph) * 5, o = p.g.position, dx = ax - o.x, dz = az - o.z; o.x += dx * 0.03; o.z += dz * 0.03; if (Math.abs(dx) + Math.abs(dz) > 0.1) p.g.rotation.y = Math.atan2(-dz, dx); if (!reduce) p.g.userData.hlegs.forEach(function (l, k) { l.rotation.z = Math.sin(t * 9 + k * 1.6 + i) * 0.5; }); }); }
      if (PK.wheel) { PK.wheel.rotation.z = t * 0.12; PK.cabins.forEach(function (c) { c.rotation.z = -t * 0.12; }); PK.carousel.rotation.y = t * 0.6; PK.carousel.children.forEach(function (h, i) { if (i > 2) h.position.y = Math.sin(t * 2 + i) * 0.4; }); PK.bumpers.forEach(function (b) { var a = t * 0.7 + b.ph; b.g.position.set(30 + Math.sin(a) * 7, 0, 28 + Math.sin(a * 1.6 + b.ph) * 4.5); b.g.rotation.y = a * 1.3; }); }
      if (PK.monkeys) PK.monkeys.forEach(function (k) { var a = t * 0.8 + k.ph; k.m.position.set(k.p[0] + Math.cos(a) * 2, 11.5 + Math.abs(Math.sin(t * 3 + k.ph)) * 0.8, k.p[1] + Math.sin(a) * 2); }); PK.towers.forEach(function (m) { m.emissiveIntensity = night ? 0.9 : 0; });
    }


    /* ---------- grand squares: a cathedral, a mosque or a state house over a paved plaza with flags and a fountain ---------- */
    var plzG = new T.Group(); plzG.visible = false; S3.add(plzG); var PZ = {};
    function arches(g, w, h, n, x0, y0, z, colr) { for (var i = 0; i < n; i++) { var sh = new T.Shape(), aw = w / n * 0.62, ax = x0 - w / 2 + (i + 0.5) * (w / n); sh.moveTo(-aw / 2, 0); sh.lineTo(-aw / 2, h - aw / 2); sh.absarc(0, h - aw / 2, aw / 2, Math.PI, 0, true); sh.lineTo(aw / 2, 0); var m = new T.Mesh(new T.ShapeGeometry(sh, 12), mat('arch' + colr, { color: colr, roughness: 0.6 })); m.position.set(ax, y0, z); m.rotation.y = Math.PI; g.add(m); } }
    function cathedral(x, z, s) {
      var g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(s || 1); var stone = mat('cstone', { color: 0xe9e2d4, roughness: 0.8 }), roof = mat('croof', { color: 0x5a6b78, roughness: 0.6, metalness: 0.2 });
      g.add(mesh(new T.BoxGeometry(26, 22, 60), stone, 0, 11, 30)); var rf = mesh(new T.CylinderGeometry(15, 15, 60, 3, 1), roof, 0, 26, 30); rf.rotation.x = Math.PI / 2; rf.rotation.y = Math.PI / 2; rf.scale.set(1, 1, 0.55); g.add(rf);
      g.add(mesh(new T.BoxGeometry(34, 30, 4), stone, 0, 15, 0)); [-13, 13].forEach(function (tx) { g.add(mesh(new T.BoxGeometry(9, 50, 9), stone, tx, 25, 0)); g.add(mesh(new T.ConeGeometry(6.4, 22, 4), roof, tx, 61, 0)); g.add(mesh(new T.ConeGeometry(0.4, 4, 6), mat('gold', { color: 0xd4af37, metalness: 0.8, roughness: 0.3 }), tx, 74, 0)); });
      var rose = canvasTex(256, 256, function (c, w, h) { c.fillStyle = '#1a2a4a'; c.fillRect(0, 0, w, h); for (var k = 0; k < 16; k++) { c.fillStyle = ['#c0392b', '#1f5fa0', '#f2b600', '#2fa36b'][k % 4]; c.beginPath(); c.moveTo(w / 2, h / 2); c.arc(w / 2, h / 2, 120, k / 16 * Math.PI * 2, (k + 1) / 16 * Math.PI * 2); c.fill(); } c.strokeStyle = '#e9e2d4'; c.lineWidth = 8; for (var r2 = 30; r2 <= 120; r2 += 30) { c.beginPath(); c.arc(w / 2, h / 2, r2, 0, Math.PI * 2); c.stroke(); } });
      var rm = new T.MeshStandardMaterial({ map: rose, emissive: 0xffffff, emissiveMap: rose, emissiveIntensity: 0.15 }), rw = new T.Mesh(new T.CircleGeometry(6, 32), rm); rw.position.set(0, 21, -2.05); rw.rotation.y = Math.PI; g.add(rw); PZ.glow.push(rm);
      arches(g, 18, 10, 3, 0, 0, -2.05, 0x2a2018); for (var b = 0; b < 6; b++) [-14, 14].forEach(function (bx) { g.add(mesh(new T.BoxGeometry(2, 18, 3), stone, bx, 9, 8 + b * 9)); });
      g.add(mesh(new T.CylinderGeometry(0.3, 0.3, 8, 6), mat('gold', {}), 0, 34, 0)); g.add(mesh(new T.BoxGeometry(4, 0.6, 0.6), mat('gold', {}), 0, 36, 0));
      plzG.add(g); return g;
    }
    function mosque(x, z, s) {
      var g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(s || 1); var wall = mat('mwall', { color: 0xf4f1ea, roughness: 0.7 }), gold = mat('mgold', { color: 0xd4af37, metalness: 0.85, roughness: 0.25 }), trim = mat('mtrim', { color: 0x1d7a43, roughness: 0.5 });
      g.add(mesh(new T.BoxGeometry(50, 16, 46), wall, 0, 8, 22)); g.add(mesh(new T.BoxGeometry(51, 1.2, 47), trim, 0, 16.2, 22));
      g.add(mesh(new T.CylinderGeometry(16, 16, 6, 32), wall, 0, 19.5, 22)); var dome = mesh(new T.SphereGeometry(16, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, 22.5, 22); dome.scale.y = 1.15; g.add(dome); g.add(mesh(new T.CylinderGeometry(0.4, 0.6, 5, 8), gold, 0, 43, 22)); g.add(mesh(new T.TorusGeometry(1.4, 0.3, 8, 20, Math.PI * 1.6), gold, 0, 46.5, 22));
      [[-20, 4], [20, 4], [-20, 40], [20, 40]].forEach(function (q) { g.add(mesh(new T.SphereGeometry(5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold, q[0], 16.6, q[1])); });
      [[-30, -2], [30, -2], [-30, 46], [30, 46]].forEach(function (q) { g.add(mesh(new T.CylinderGeometry(1.6, 2, 60, 12), wall, q[0], 30, q[1])); [22, 40, 54].forEach(function (y) { g.add(mesh(new T.CylinderGeometry(2.6, 2.6, 1, 12), trim, q[0], y, q[1])); }); g.add(mesh(new T.ConeGeometry(2, 7, 12), gold, q[0], 63.5, q[1])); });
      arches(g, 44, 11, 7, 0, 0, -1.05, 0x22301f); PZ.domes.push(gold);
      plzG.add(g); return g;
    }
    function stateHouse(x, z, domeOn) {
      var g = new T.Group(); g.position.set(x, 0, z); var wall = mat('swall', { color: 0xf7f5f0, roughness: 0.6 });
      g.add(mesh(new T.BoxGeometry(90, 20, 30), wall, 0, 10, 15)); g.add(mesh(new T.BoxGeometry(92, 1.5, 32), mat('scorn', { color: 0xe2dccd }), 0, 20.6, 15)); g.add(mesh(new T.BoxGeometry(94, 2, 6), wall, 0, 1, -3));
      for (var c = 0; c < 14; c++) g.add(mesh(new T.CylinderGeometry(0.9, 1, 18, 14), wall, -39 + c * 6, 11, -1.5));
      var ped = new T.Shape(); ped.moveTo(-26, 0); ped.lineTo(26, 0); ped.lineTo(0, 8); ped.lineTo(-26, 0); g.add(mesh(new T.ExtrudeGeometry(ped, { depth: 3, bevelEnabled: false }), wall, 0, 21, -3));
      if (domeOn) { g.add(mesh(new T.CylinderGeometry(9, 9, 6, 32), wall, 0, 24, 15)); g.add(mesh(new T.SphereGeometry(9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat('sdome', { color: 0x3d7a5a, metalness: 0.5, roughness: 0.35 }), 0, 27, 15)); }
      for (var w = 0; w < 12; w++) [6, 14].forEach(function (y) { g.add(mesh(new T.BoxGeometry(3, 4, 0.2), glassM, -38 + w * 7, y, -0.1)); });
      plzG.add(g); return g;
    }
    // UNILAG: the Senate Building, a lecture theatre, the Main Library, Mama B's buka, a hall of residence room,
    // the five-a-side pitch and the lagoon front, with a gate sign.
    function campusSign(text, bg, fg, w, x, y, z, ry, grp) { var t = canvasTex(1024, 160, function (g, cw, ch) { g.fillStyle = bg; g.fillRect(0, 0, cw, ch); g.fillStyle = fg; g.font = '900 88px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2 + 4, cw - 40); }); var m = new T.Mesh(new T.PlaneGeometry(w, w * 0.156), new T.MeshBasicMaterial({ map: t, side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry || 0; (grp || plzG).add(m); return m; }
    function campusFig(i, x, z, ry, sit) { var f = root.LasgidiAvatar3D && root.LasgidiGames3D ? avatarFor(root.LasgidiGames3D.stranger('unilag', i), 130 + i) : person(130 + i, i % 2 === 1); f.position.set(x, sit ? 0.5 : 0.05, z); f.rotation.y = ry || 0; if (sit && f.userData.legs) f.userData.legs.forEach(function (l) { l.rotation[f.userData.axis || 'z'] = -1.2; }); plzG.add(f); return f; }
    function campusBuild() {
      var CN = { ph_uniport: ['UNIVERSITY OF PORT HARCOURT', "MAMA NGOZI'S BUKA · RICE AND BEANS N1200"], abj_uni: ['UNIVERSITY OF ABUJA', "MAMA HAUWA'S BUKA · RICE AND BEANS N1200"], abj_chu: ['CAPITAL HEIGHTS UNIVERSITY', "MAMA HAUWA'S BUKA · RICE AND BEANS N1200"], ph_rsu: ['RIVERS STATE UNIVERSITY', "MAMA IBIERE'S BUKA · RICE AND BEANS N1200"], lag_lasu: ['LAGOS STATE UNIVERSITY', "MAMA TOYIN'S BUKA · RICE AND BEANS N1200"], lag_yabatech: ['YABA COLLEGE OF TECHNOLOGY', "MAMA KEMI'S BUKA · RICE AND BEANS N1200"], acc_ug: ['UNIVERSITY OF GHANA, LEGON', "AUNTIE AKOS'S CHOP BAR · WAAKYE ₵10"], kum_knust_uni: ['KWAME NKRUMAH UNIVERSITY OF SCIENCE AND TECHNOLOGY', "AUNTIE ABENA'S CHOP BAR · FUFU ₵20"], cc_ucc_uni: ['UNIVERSITY OF CAPE COAST', "AUNTIE EFUA'S CHOP BAR · BANKU ₵15"] }[sc.placeId] || ['UNIVERSITY OF LAGOS', "MAMA B'S BUKA · RICE AND BEANS N1200"], DRY = /^(abj_|acc_ug|kum_)/.test(sc.placeId || '');
      var wall = mat('cwall', { color: 0xf1ede4, roughness: 0.7 }), wood = mat('cwood', { color: 0x8a5a33, roughness: 0.8 }), dark = mat('cdark', { color: 0x1f2a44 });
      // the Senate Building: a tall white tower with window bands, and the admissions desk at its foot
      var sen = new T.Group(); sen.position.set(0, 0, 70); sen.add(mesh(new T.BoxGeometry(26, 48, 16), wall, 0, 24, 0)); for (var fl = 1; fl < 12; fl++) sen.add(mesh(new T.BoxGeometry(26.2, 1.4, 16.2), glassM, 0, fl * 4, 0)); plzG.add(sen);
      campusSign('SENATE BUILDING', '#1f2a44', '#ffffff', 16, 0, 6, 61.8, Math.PI); plzG.add(mesh(new T.BoxGeometry(8, 1.2, 2), dark, 0, 0.6, 56)); plzG.add(mesh(new T.BoxGeometry(1.2, 0.8, 0.1), mat('cmon', { color: 0x2f6fd0 }), 1, 1.6, 56)); campusFig(0, 0, 57.6, Math.PI / 2);
      // a lecture theatre: tiered benches facing a whiteboard and the lecturer
      var lt = new T.Group(); lt.position.set(-44, 0, 34); for (var row = 0; row < 5; row++) { lt.add(mesh(new T.BoxGeometry(16, 0.6 + row * 0.6, 2), mat('ctier', { color: 0x9a8f80 }), 0, (0.6 + row * 0.6) / 2, -row * 2.2)); lt.add(mesh(new T.BoxGeometry(15, 0.15, 0.8), wood, 0, 1.4 + row * 0.6, -row * 2.2 + 0.4)); }
      lt.add(mesh(new T.BoxGeometry(12, 5, 0.2), mat('cboard', { color: 0xf8f8f4, roughness: 0.3 }), 0, 3.5, 7)); lt.add(mesh(new T.BoxGeometry(12.4, 5.4, 0.15), dark, 0, 3.5, 7.1)); for (var ln = 0; ln < 4; ln++) lt.add(mesh(new T.BoxGeometry(5 + (ln % 2) * 3, 0.15, 0.05), mat('cink', { color: 0x1f3b63 }), -1.5, 4.8 - ln * 0.8, 6.85));
      plzG.add(lt); campusSign('LECTURE THEATRE', '#1f2a44', '#ffffff', 12, -44, 7.4, 41.2, Math.PI); campusFig(1, -46, 39, -Math.PI / 2); for (var st = 0; st < 6; st++) campusFig(2 + st, -50 + st * 2.4, 34 - (st % 3) * 2.2 + 0.2, -Math.PI / 2, true);
      // the Main Library: an open-fronted hall with shelves, reading tables and a SILENCE sign
      var lib = new T.Group(); lib.position.set(44, 0, 34); lib.add(mesh(new T.BoxGeometry(22, 10, 0.4), wall, 0, 5, 7)); lib.add(mesh(new T.BoxGeometry(0.4, 10, 14), wall, -11, 5, 0)); lib.add(mesh(new T.BoxGeometry(0.4, 10, 14), wall, 11, 5, 0)); lib.add(mesh(new T.BoxGeometry(22.4, 0.5, 14.4), mat('croof', { color: 0x7a2a1a }), 0, 10.2, 0));
      for (var sh = 0; sh < 4; sh++) { lib.add(mesh(new T.BoxGeometry(4, 6, 1), mat('cshelf', { color: 0x5a3a22 }), -7.5 + sh * 5, 3, 5.8)); for (var bk = 0; bk < 12; bk++) lib.add(mesh(new T.BoxGeometry(0.3, 0.9, 0.7), mat('cbook' + bk % 4, { color: [0xc0392b, 0x2f6fd0, 0x16a35a, 0xf2a516][bk % 4] }), -9 + sh * 5 + (bk % 6) * 0.6, 1 + Math.floor(bk / 6) * 2, 5.2)); }
      [[-4, -1], [4, -1]].forEach(function (q) { lib.add(mesh(new T.BoxGeometry(6, 0.2, 2.4), wood, q[0], 1.6, q[1])); }); plzG.add(lib); campusSign('MAIN LIBRARY · SILENCE', '#1f2a44', '#ffffff', 14, 44, 11.6, 41.4, Math.PI);
      campusFig(8, 40, 33, 0, true); campusFig(9, 48, 33, Math.PI, true);
      // Mama B's buka: a canopy over pots of rice, beans and stew, and bench tables
      var bu = new T.Group(); bu.position.set(30, 0, -26); bu.add(mesh(new T.BoxGeometry(12, 0.3, 6), mat('canopyB', { color: 0xe0c27a }), 0, 4.6, 0)); [[-5.6, -2.6], [5.6, -2.6], [-5.6, 2.6], [5.6, 2.6]].forEach(function (q) { bu.add(mesh(new T.CylinderGeometry(0.12, 0.12, 4.6, 6), mat('cpost', { color: 0x666666 }), q[0], 2.3, q[1])); });
      bu.add(mesh(new T.BoxGeometry(10, 1.8, 2), mat('bcounter', { color: 0x1f3b9a }), 0, 0.9, 1.6)); for (var pt = 0; pt < 4; pt++) bu.add(mesh(new T.CylinderGeometry(0.8, 0.7, 1, 16), mat('pot', { color: 0x3a3a3a, metalness: 0.5 }), -3.6 + pt * 2.4, 2.3, 1.6));
      for (var bt = 0; bt < 2; bt++) { bu.add(mesh(new T.BoxGeometry(8, 0.2, 2), wood, 0, 1.4, -4.5 - bt * 4)); bu.add(mesh(new T.BoxGeometry(8, 0.2, 0.7), wood, 0, 0.8, -3.2 - bt * 4)); bu.add(mesh(new T.BoxGeometry(8, 0.2, 0.7), wood, 0, 0.8, -5.8 - bt * 4)); bu.add(mesh(new T.CylinderGeometry(0.5, 0.5, 0.06, 14), mat('plate', { color: 0xffffff }), -2 + bt * 3, 1.55, -4.5 - bt * 4)); }
      plzG.add(bu); campusSign(CN[1], '#1f3b9a', '#ffffff', 11, 30, 3.6, -24.25, Math.PI); campusFig(10, 30, -22.6, -Math.PI / 2); campusFig(11, 28, -30.5, Math.PI / 2, true);
      // a hall of residence room, cut away: bunk beds, a locker and a red bucket
      var hr = new T.Group(); hr.position.set(-32, 0, -26); hr.add(mesh(new T.BoxGeometry(12, 0.2, 10), mat('hfloor', { color: 0x9a9a9a }), 0, 0.1, 0)); hr.add(mesh(new T.BoxGeometry(12, 6, 0.3), mat('hwall', { color: 0xdfe8d8 }), 0, 3, 5)); hr.add(mesh(new T.BoxGeometry(0.3, 6, 10), mat('hwall', {}), -6, 3, 0));
      [0, 1].forEach(function (bb) { var bx = -3 + bb * 5.5; [0.9, 3].forEach(function (y) { hr.add(mesh(new T.BoxGeometry(4, 0.4, 2), mat('bunkm', { color: 0x1f3b9a }), bx, y, 2.6)); }); [[-2, 1.6], [2, 1.6], [-2, 3.6], [2, 3.6]].forEach(function (q) { hr.add(mesh(new T.BoxGeometry(0.15, 4, 0.15), mat('bunkf', { color: 0x2b2d33 }), bx + q[0], 2, q[1])); }); });
      hr.add(mesh(new T.BoxGeometry(2, 4, 1.4), mat('locker', { color: 0x8aa0b8, metalness: 0.4 }), 4.8, 2, -2)); hr.add(mesh(new T.CylinderGeometry(0.6, 0.5, 0.9, 14), mat('bucket', { color: 0xc0392b }), -4, 0.55, -3)); plzG.add(hr); campusSign('HALL OF RESIDENCE', '#2b2d33', '#ffffff', 10, -32, 7, -21.2, Math.PI);
      // the five-a-side pitch
      var pc = new T.Group(); pc.position.set(-20, 0, 8); pc.add(mesh(new T.BoxGeometry(18, 0.06, 11), mat('pitch5', { color: 0x2f8f3a }), 0, 0.06, 0)); pc.add(mesh(new T.BoxGeometry(0.15, 0.08, 11), mat('pline', { color: 0xffffff }), 0, 0.1, 0)); [-9, 9].forEach(function (x) { pc.add(mesh(new T.BoxGeometry(0.12, 2, 0.12), mat('pline', {}), x, 1, -1.8)); pc.add(mesh(new T.BoxGeometry(0.12, 2, 0.12), mat('pline', {}), x, 1, 1.8)); pc.add(mesh(new T.BoxGeometry(0.12, 0.12, 3.7), mat('pline', {}), x, 2, 0)); });
      PZ.ball = mesh(new T.SphereGeometry(0.3, 12, 8), mat('ballw', { color: 0xffffff }), 0, 0.35, 0); pc.add(PZ.ball); plzG.add(pc); PZ.players = []; for (var pl = 0; pl < 4; pl++) PZ.players.push(campusFig(20 + pl, -20 + (pl - 1.5) * 4, 8 + (pl % 2 ? 2 : -2), 0));
      // the lagoon front, the gate sign
      var lag = new T.Mesh(new T.PlaneGeometry(200, 30).rotateX(-Math.PI / 2), (DRY ? mat('plzlawn', {}) : new T.MeshPhysicalMaterial({ color: 0x3a7f9f, roughness: 0.08, clearcoat: 1 }))); lag.position.set(0, 0.04, -62); plzG.add(lag);
      for (var lb = 0; lb < 5; lb++) plzG.add(mesh(new T.BoxGeometry(3, 0.25, 0.8), wood, -24 + lb * 12, 0.9, -45)); campusFig(24, -12, -44.4, Math.PI / 2, true); campusFig(25, -10.6, -44.4, Math.PI / 2, true);
      [-10, 10].forEach(function (x) { plzG.add(mesh(new T.BoxGeometry(1.4, 8, 1.4), wall, x, 4, 18)); }); campusSign(CN[0], '#1f2a44', '#f2c200', 18, 0, 8.6, 18, Math.PI);
    }
    // London: the Elizabeth Tower (Big Ben) beside Parliament, and Tower Bridge over a river.
    function bigBen(x, z) {
      var g = new T.Group(); g.position.set(x, 0, z); var st = mat('bbStone', { color: 0xd9c79a, roughness: 0.75 }), gold = mat('bbGold', { color: 0xc9a227, metalness: 0.7, roughness: 0.35 });
      g.add(mesh(new T.BoxGeometry(9, 56, 9), st, 0, 28, 0)); for (var b = 1; b < 9; b++) g.add(mesh(new T.BoxGeometry(9.3, 0.6, 9.3), mat('bbBand', { color: 0xb8a578 }), 0, b * 6.5, 0));
      var face = new T.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xfff1c0, emissiveIntensity: 0.35 }); [0, 1, 2, 3].forEach(function (k) { var fc = new T.Mesh(new T.CircleGeometry(3.4, 32), face); var a = k * Math.PI / 2; fc.position.set(Math.sin(a) * 4.7, 47, -Math.cos(a) * 4.7); fc.rotation.y = -a + Math.PI; g.add(fc); var hd = mesh(new T.BoxGeometry(0.25, 2.6, 0.1), mat('bbHand', { color: 0x17181a }), Math.sin(a) * 4.8, 47.8, -Math.cos(a) * 4.8); hd.rotation.y = -a; g.add(hd); });
      g.add(mesh(new T.BoxGeometry(10, 4, 10), gold, 0, 58, 0)); var sp = mesh(new T.ConeGeometry(5.6, 18, 4), mat('bbSpire', { color: 0x3a4a3f, metalness: 0.4 }), 0, 69, 0); sp.rotation.y = Math.PI / 4; g.add(sp);
      g.add(mesh(new T.BoxGeometry(90, 18, 12), st, -52, 9, 4)); for (var tw = 0; tw < 12; tw++) g.add(mesh(new T.ConeGeometry(1.2, 6, 4), st, -94 + tw * 7.4, 21, 4));
      plzG.add(g);
    }
    function towerBridge(x, z) {
      var g = new T.Group(); g.position.set(x, 0, z); var st = mat('tbStone', { color: 0xcfc7b0, roughness: 0.7 }), blue = mat('tbBlue', { color: 0x2f6fa0, roughness: 0.5 });
      var river = new T.Mesh(new T.PlaneGeometry(400, 50).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0x5f7a86, roughness: 0.1, clearcoat: 1 })); river.position.set(0, 0.2, 0); g.add(river);
      [-16, 16].forEach(function (px) { g.add(mesh(new T.BoxGeometry(10, 44, 10), st, px, 22, 0)); g.add(mesh(new T.ConeGeometry(4.2, 10, 4), mat('tbRoof', { color: 0x4a5560 }), px, 49, 0)); [-1, 1].forEach(function (c) { g.add(mesh(new T.ConeGeometry(1, 5, 4), mat('tbRoof', {}), px + c * 4.4, 46.5, 4.4)); }); });
      g.add(mesh(new T.BoxGeometry(22, 3, 6), blue, 0, 38, 0)); g.add(mesh(new T.BoxGeometry(22, 2, 10), mat('tbDeck', { color: 0x6a6f76 }), 0, 9, 0));
      [-1, 1].forEach(function (sd) { var pts = []; for (var k = 0; k <= 16; k++) { var u = k / 16; pts.push(new T.Vector3(sd * (21 + u * 40), 38 - Math.sin(u * Math.PI / 2) * 28, 0)); } g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, 0.6, 6, false), blue)); g.add(mesh(new T.BoxGeometry(44, 2, 10), mat('tbDeck', {}), sd * 43, 9, 0)); });
      plzG.add(g);
    }
    function londonEye() {
      var steel = mat('eyeSteel', { color: 0xf4f6f8, metalness: 0.6, roughness: 0.25 }), W = new T.Group(); W.position.set(0, 34, 50);
      W.add(mesh(new T.TorusGeometry(30, 0.5, 6, 64), steel, 0, 0, 0)); for (var sp = 0; sp < 16; sp++) { var a = sp / 16 * Math.PI * 2, spk = mesh(new T.BoxGeometry(0.2, 30, 0.2), steel, Math.cos(a) * 15, Math.sin(a) * 15, 0); spk.rotation.z = a - Math.PI / 2; W.add(spk); }
      PK.cabins = []; var glassC = mat('eyeCap', { color: 0xbfe3f2, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.8 }); for (var c = 0; c < 24; c++) { var ca = c / 24 * Math.PI * 2, cap = mesh(new T.CapsuleGeometry(1.1, 2.6, 4, 8).rotateZ(Math.PI / 2), glassC, Math.cos(ca) * 31.2, Math.sin(ca) * 31.2, 0); W.add(cap); PK.cabins.push(cap); }
      W.userData.dyn = true; parkG.add(W); PK.wheel = W; PK.carousel = new T.Group(); PK.bumpers = [];
      [-1, 1].forEach(function (sd) { var leg = mesh(new T.BoxGeometry(1.2, 40, 1.2), steel, sd * 3, 17, 46); leg.rotation.x = sd * 0.0; leg.rotation.z = 0.12 * sd; parkG.add(leg); });
      var river = new T.Mesh(new T.PlaneGeometry(400, 40).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0x5f7a86, roughness: 0.1, clearcoat: 1 })); river.position.set(0, 0.1, 86); parkG.add(river);
    }
    // Accra's Independence Arch: a wide white gate with the black star on top, and the stands of the square either side.
    function blackStarGate(x, z) {
      var g = new T.Group(); g.position.set(x, 0, z); var wm = mat('bsgWhite', { color: 0xf4f1ea, roughness: 0.6 }), dk = mat('bsgStar', { color: 0x17181a, roughness: 0.4 });
      [-14, -5, 5, 14].forEach(function (px) { g.add(mesh(new T.BoxGeometry(5, 22, 6), wm, px, 11, 0)); }); g.add(mesh(new T.BoxGeometry(40, 6, 7), wm, 0, 25, 0));
      [-9.5, 9.5].forEach(function (px) { g.add(mesh(new T.BoxGeometry(4, 13, 6.2), mat('bsgShade', { color: 0xd8d2c4 }), px, 6.5, 0)); });
      var sh = new T.Shape(); for (var k = 0; k < 10; k++) { var a = Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 2.2 : 5.4; if (k) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      var star = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false }), dk); star.position.set(0, 34, -0.6); g.add(star);
      var txt = canvasTex(1024, 128, function (c, w, h) { c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h); c.fillStyle = '#17181a'; c.font = '800 60px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FREEDOM AND JUSTICE · AD 1957', w / 2, h / 2, w - 30); });
      var tm = new T.Mesh(new T.PlaneGeometry(34, 4.2), new T.MeshBasicMaterial({ map: txt })); tm.position.set(0, 25, -3.6); tm.rotation.y = Math.PI; g.add(tm);
      for (var tr = 0; tr < 6; tr++) [-1, 1].forEach(function (sd) { g.add(mesh(new T.BoxGeometry(30, 1, 2.6), mat('bsgStand', { color: 0xc9c2b4 }), sd * 50, 0.5 + tr, -8 + tr * 2.6)); });
      [0xce1126, 0xfcd116, 0x006b3f].forEach(function (c, i) { g.add(mesh(new T.BoxGeometry(14, 1.2, 0.3), mat('ghflag' + i, { color: c }), 0, 40 - i * 1.2, -0.4)); });
      plzG.add(g);
    }
    // Cape Coast and Elmina (rules 28): the whitewashed castles on the rocks, cannons on the sea wall, the sea beyond.
    // Told plainly: these were where enslaved Africans were held before the ships. A plaque by the Door of No Return.
    function slaveCastle(x, z, elmina) {
      var g = new T.Group(); g.position.set(x, 0, z); var wm = mat('ccWhite', { color: 0xf4f1ea, roughness: 0.7 }), rock = mat('ccRock', { color: 0x6b6258, roughness: 0.95 }), iron = mat('ccIron', { color: 0x2b2f36, metalness: 0.6, roughness: 0.5 }), roof = mat('ccRoof', { color: elmina ? 0xb5542e : 0x8a3a2a, roughness: 0.8 });
      var sea = new T.Mesh(new T.PlaneGeometry(500, 160).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0x2f7fa0, roughness: 0.1, clearcoat: 1 })); sea.position.set(0, 0.2, 110); g.add(sea);
      g.add(mesh(new T.BoxGeometry(110, 3, 40), rock, 0, 1.5, 26));
      var W = 80, D0 = 46; [[0, -D0 / 2, W, 3], [0, D0 / 2, W, 3], [-W / 2, 0, 3, D0], [W / 2, 0, 3, D0]].forEach(function (w) { g.add(mesh(new T.BoxGeometry(w[2], 12, w[3]), wm, w[0], 6, w[1])); });
      for (var c = 0; c < 16; c++) { g.add(mesh(new T.BoxGeometry(2, 1.6, 3.4), wm, -W / 2 + 3 + c * (W - 6) / 15, 12.8, D0 / 2)); g.add(mesh(new T.BoxGeometry(2, 1.6, 3.4), wm, -W / 2 + 3 + c * (W - 6) / 15, 12.8, -D0 / 2)); }
      [[-W / 2, D0 / 2], [W / 2, D0 / 2]].forEach(function (b) { g.add(mesh(new T.CylinderGeometry(7, 8, 16, 12), wm, b[0], 8, b[1])); });
      g.add(mesh(new T.BoxGeometry(30, 10, 14), wm, 0, 17, -6)); g.add(mesh(new T.BoxGeometry(31, 1.2, 15), roof, 0, 22.6, -6)); // the governor's quarters
      for (var k = 0; k < 7; k++) { var cn = mesh(new T.CylinderGeometry(0.5, 0.7, 5, 10), iron, -24 + k * 8, 13.6, D0 / 2 + 2.2); cn.rotation.x = Math.PI / 2; g.add(cn); }
      var dr = mesh(new T.BoxGeometry(3.4, 5, 0.6), mat('ccDoor', { color: 0x1c1a18, roughness: 0.9 }), 8, 2.5, D0 / 2 + 1.6); g.add(dr); // the Door of No Return, to the sea
      var txt = canvasTex(1024, 160, function (c, w, h) { c.fillStyle = '#2b2f36'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4f1ea'; c.font = '700 44px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('IN EVERLASTING MEMORY OF THE ANGUISH OF OUR ANCESTORS', w / 2, h / 2 - 22, w - 40); c.font = '500 34px Georgia, serif'; c.fillText('MAY THOSE WHO DIED REST IN PEACE', w / 2, h / 2 + 28, w - 40); });
      var pl = new T.Mesh(new T.PlaneGeometry(26, 4), new T.MeshBasicMaterial({ map: txt })); pl.position.set(0, 8, -D0 / 2 - 1.6); pl.rotation.y = Math.PI; g.add(pl);
      [0xce1126, 0xfcd116, 0x006b3f].forEach(function (cl, i) { g.add(mesh(new T.BoxGeometry(6, 0.8, 0.2), mat('ccflag' + i, { color: cl }), W / 2, 22 - i * 0.8, D0 / 2)); }); g.add(mesh(new T.CylinderGeometry(0.15, 0.15, 8, 6), iron, W / 2 - 3, 20, D0 / 2));
      plzG.add(g);
    }
    // Dubai (rules 26): the Burj Khalifa in stepped glass tiers with its spire, and the fountain lake in front.
    function burjKhalifa(x, z) {
      var g = new T.Group(); g.position.set(x, 0, z); var gl = mat('bkGlass', { color: 0x9fb8c8, metalness: 0.7, roughness: 0.18 }), st = mat('bkSteel', { color: 0xdfe6ea, metalness: 0.8, roughness: 0.25 });
      var tiers = [[16, 40], [13, 34], [10.5, 30], [8, 26], [6, 22], [4.2, 18], [2.8, 14]], y = 0;
      tiers.forEach(function (t, i) { [0, 1, 2].forEach(function (k) { var a = k * Math.PI * 2 / 3, w = mesh(new T.BoxGeometry(t[0] * 0.55, t[1], t[0]), gl, Math.cos(a) * t[0] * 0.32, y + t[1] / 2, Math.sin(a) * t[0] * 0.32); w.rotation.y = -a; g.add(w); }); g.add(mesh(new T.CylinderGeometry(t[0] * 0.36, t[0] * 0.4, t[1], 8), gl, 0, y + t[1] / 2, 0)); y += t[1]; if (i < tiers.length - 1) g.add(mesh(new T.CylinderGeometry(t[0] * 0.42, t[0] * 0.42, 0.8, 8), st, 0, y, 0)); });
      g.add(mesh(new T.CylinderGeometry(0.4, 1.6, 40, 8), st, 0, y + 20, 0)); // the spire
      var lake = new T.Mesh(new T.PlaneGeometry(130, 46).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0x3f7f9a, roughness: 0.08, clearcoat: 1 })); lake.position.set(0, 0.15, -46); g.add(lake);
      PZ.jets = []; var jm = new T.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.75 });
      for (var j = 0; j < 15; j++) { var jt = new T.Mesh(new T.CylinderGeometry(0.25, 0.6, 1, 6), jm); jt.position.set(-49 + j * 7, 0.5, -46); jt.userData.dyn = true; g.add(jt); PZ.jets.push(jt); }
      plzG.add(g);
    }
    // The desert camp: red dunes, a ring of tents round a fire, camels and 4x4s.
    function desertCamp() {
      var sand = mat('dsSand', { color: 0xd9a066, roughness: 0.95 }), dark = mat('dsSand2', { color: 0xc88a52, roughness: 0.95 });
      var gnd = mesh(new T.PlaneGeometry(520, 520).rotateX(-Math.PI / 2), sand, 0, 0.06, 0); gnd.castShadow = false; plzG.add(gnd);
      var rd = rnd(611); for (var d = 0; d < 26; d++) { var du = new T.Mesh(new T.SphereGeometry(1, 14, 8), d % 3 ? sand : dark); var a = rd() * Math.PI * 2, rr = 70 + rd() * 120; du.scale.set(18 + rd() * 26, 5 + rd() * 9, 10 + rd() * 16); du.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); du.rotation.y = rd() * 3; du.castShadow = false; plzG.add(du); }
      var tent = mat('dsTent', { color: 0xf1e4c8, roughness: 0.8 }), rug = mat('dsRug', { color: 0x9a2a2a, roughness: 0.9 });
      for (var t = 0; t < 8; t++) { var ta = t / 8 * Math.PI * 2; plzG.add(mesh(new T.ConeGeometry(5, 6, 6), tent, Math.cos(ta) * 26, 3, Math.sin(ta) * 26 + 20)); }
      plzG.add(mesh(new T.CylinderGeometry(12, 12, 0.2, 16), rug, 0, 0.12, 20));
      var fire = new T.Mesh(new T.ConeGeometry(1.4, 3, 8), new T.MeshBasicMaterial({ color: 0xff8a2a })); fire.position.set(0, 1.5, 20); plzG.add(fire);
      var cm = mat('dsCamel', { color: 0xb07a4a, roughness: 0.85 });
      [[-30, -8], [-36, -2], [-24, -14]].forEach(function (c) { var k = new T.Group(); k.position.set(c[0], 0, c[1]); k.add(mesh(new T.BoxGeometry(4.4, 1.8, 1.6), cm, 0, 3.2, 0)); k.add(mesh(new T.SphereGeometry(1, 8, 6), cm, 0, 4.3, 0)); [[-1.6, -0.5], [1.6, -0.5], [-1.6, 0.5], [1.6, 0.5]].forEach(function (l) { k.add(mesh(new T.BoxGeometry(0.35, 2.4, 0.35), cm, l[0], 1.2, l[1])); }); var nk = mesh(new T.BoxGeometry(0.6, 2.4, 0.6), cm, 2.6, 4.4, 0); nk.rotation.z = -0.5; k.add(nk); k.add(mesh(new T.BoxGeometry(1.4, 0.8, 0.8), cm, 3.4, 5.6, 0)); plzG.add(k); });
      [[32, -10, 0xf4f3ec], [40, -2, 0x17181a], [26, -18, 0xc0392b]].forEach(function (v) { var car = new T.Group(); car.position.set(v[0], 0, v[1]); car.add(mesh(new T.BoxGeometry(5.6, 2.2, 2.6), mat('ds4x4' + v[2], { color: v[2], roughness: 0.4, metalness: 0.3 }), 0, 1.9, 0)); car.add(mesh(new T.BoxGeometry(3.4, 1.2, 2.5), glassM, -0.4, 3.4, 0)); [[-1.8, 1.3], [1.8, 1.3], [-1.8, -1.3], [1.8, -1.3]].forEach(function (w) { var wh = mesh(new T.CylinderGeometry(0.7, 0.7, 0.5, 12), mat('tyre', { color: 0x111111 }), w[0], 0.7, w[1]); wh.rotation.x = Math.PI / 2; car.add(wh); }); plzG.add(car); });
    }
    function buildPlaza() {
      wipe(plzG); var id = sc.placeId || 'plaza'; PZ = { glow: [], domes: [], flags: [], lamps: [], towers: [] };
      var paveT = canvasTex(256, 256, function (c, w, h) { var rr = rnd(3); c.fillStyle = '#d8d2c4'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 32) for (var x = 0; x < w; x += 32) { c.fillStyle = 'hsl(40,' + (8 + rr() * 6) + '%,' + (74 + rr() * 8) + '%)'; c.fillRect(x + 1, y + 1, 30, 30); } }, [40, 40]);
      var pave = mesh(new T.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: paveT, roughness: 0.85 }), 0, 0, 0); pave.castShadow = false; plzG.add(pave);
      var gr = mesh(new T.PlaneGeometry(500, 160).rotateX(-Math.PI / 2), mat('plzlawn', { map: grassTex, roughness: 0.95 }), 0, 0.02, -150); gr.castShadow = false; plzG.add(gr);
      if (id === 'worship') { cathedral(-55, 50, 0.9); mosque(55, 50, 0.85); }
      else if (id === 'theatre') { theatre(0, 70); if (sc.th) theatreBoard(0, 20); }
      else if (/abj_tower/.test(id)) millenniumTower(0, 80);
      else if (id === 'acc_blackstar') blackStarGate(0, 60);
      else if (id === 'dxb_burj') burjKhalifa(0, 110);
      else if (id === 'cc_castle' || id === 'cc_elmina_castle') slaveCastle(0, 70, id === 'cc_elmina_castle');
      else if (id === 'dxb_safari') desertCamp();
      else if (id === 'ldn_bigben') bigBen(20, 95);
      else if (id === 'ldn_towerbridge') towerBridge(0, 70);
      else if (/mosque/.test(id)) mosque(0, 50, 1.15);
      else if (/ecumenical/.test(id)) cathedral(0, 50, 1.2);
      else if (/eagle|tbs/.test(id)) {
        var st = mat('stand', { color: 0xf4f1ea, roughness: 0.7 }); for (var tier = 0; tier < 8; tier++) plzG.add(mesh(new T.BoxGeometry(120, 1.2, 3), st, 0, 0.6 + tier * 1.2, 70 + tier * 3)); var can = mesh(new T.BoxGeometry(124, 0.6, 30), mat('canopy', { color: 0x1d7a43, roughness: 0.5 }), 0, 16, 80); can.rotation.x = -0.08; plzG.add(can); for (var cp = -60; cp <= 60; cp += 15) plzG.add(mesh(new T.CylinderGeometry(0.5, 0.5, 16, 8), st, cp, 8, 94));
        if (/tbs/.test(id)) { [-30, 30].forEach(function (hx) { var hs = new T.Group(); hs.position.set(hx, 0, 30); hs.add(mesh(new T.BoxGeometry(6, 4, 6), st, 0, 2, 0)); var hm = mat('bronze', { color: 0x6b4a2b, metalness: 0.6, roughness: 0.4 }); hs.add(mesh(new T.CapsuleGeometry(1.2, 4, 4, 8).rotateZ(Math.PI / 2 - 0.5), hm, 0, 7, 0)); hs.add(mesh(new T.CapsuleGeometry(0.6, 2, 4, 8).rotateZ(-0.6), hm, 2.6, 9.2, 0)); [[-1.6, -0.8], [-1.6, 0.8], [1.2, -0.8], [1.2, 0.8]].forEach(function (lq) { hs.add(mesh(new T.CylinderGeometry(0.3, 0.3, 3, 6), hm, lq[0], 5, lq[1])); }); plzG.add(hs); }); }
        else { var eg = new T.Group(); eg.position.set(0, 0, 36); eg.add(mesh(new T.CylinderGeometry(3, 4, 8, 12), st, 0, 4, 0)); var em = mat('eagle', { color: 0x2b2f36, metalness: 0.6, roughness: 0.35 }); eg.add(mesh(new T.SphereGeometry(2, 16, 12), em, 0, 10, 0)); [-1, 1].forEach(function (sd) { var wg = mesh(new T.BoxGeometry(9, 0.4, 2.6), em, sd * 5, 11.5, 0); wg.rotation.z = sd * 0.35; eg.add(wg); }); eg.add(mesh(new T.ConeGeometry(0.7, 2, 8), mat('gold', { color: 0xd4af37, metalness: 0.8 }), 0, 11.2, -2.2)); plzG.add(eg); }
      } else if (/^(unilag|ph_uniport|abj_uni|abj_chu|ph_rsu|lag_lasu|lag_yabatech|acc_ug|kum_knust_uni|cc_ucc_uni)$/.test(id)) { campusBuild(); }
      else stateHouse(0, 60, /threearms/.test(id));
      // Flags along the plaza, a fountain at its heart, lamps, palms, and the city behind.
      var gh = /^(acc|kum|cc)_/.test(id), uk = /^ldn_/.test(id), ae = /^dxb_/.test(id), za = /^ctn_/.test(id), castle = /^cc_.*castle$/.test(id), dune = id === 'dxb_safari' || castle, flagT = canvasTex(96, 64, function (c, w, h) { if (za) { c.fillStyle = '#e03c31'; c.fillRect(0, 0, w, h / 2); c.fillStyle = '#001489'; c.fillRect(0, h / 2, w, h / 2); c.fillStyle = '#fff'; c.fillRect(0, h * 0.3, w, h * 0.4); c.fillStyle = '#007749'; c.fillRect(0, h * 0.38, w, h * 0.24); c.fillStyle = '#ffb81c'; c.beginPath(); c.moveTo(0, h * 0.12); c.lineTo(w * 0.42, h / 2); c.lineTo(0, h * 0.88); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.moveTo(0, h * 0.22); c.lineTo(w * 0.32, h / 2); c.lineTo(0, h * 0.78); c.fill(); return; } if (ae) { ['#00732f', '#ffffff', '#000000'].forEach(function (col, i) { c.fillStyle = col; c.fillRect(0, i * h / 3, w, h / 3 + 1); }); c.fillStyle = '#ff0000'; c.fillRect(0, 0, w / 4, h); return; } if (uk) { c.fillStyle = '#012169'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 12; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke(); c.strokeStyle = '#c8102e'; c.lineWidth = 4; c.stroke(); c.fillStyle = '#fff'; c.fillRect(w / 2 - 9, 0, 18, h); c.fillRect(0, h / 2 - 9, w, 18); c.fillStyle = '#c8102e'; c.fillRect(w / 2 - 5, 0, 10, h); c.fillRect(0, h / 2 - 5, w, 10); return; } if (gh) { ['#ce1126', '#fcd116', '#006b3f'].forEach(function (col, i) { c.fillStyle = col; c.fillRect(0, i * h / 3, w, h / 3 + 1); }); c.fillStyle = '#000'; c.font = '700 22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', w / 2, h / 2 + 1); return; } c.fillStyle = '#008751'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(w / 3, 0, w / 3, h); });
      for (var fp = 0; fp < (dune ? 0 : 10); fp++) { var fx = -45 + fp * 10, fz = 18; plzG.add(mesh(new T.CylinderGeometry(0.15, 0.18, 14, 6), mat('fpole2', { color: 0xdfe3e8, metalness: 0.6 }), fx, 7, fz)); var fg = new T.PlaneGeometry(4, 2.6, 12, 1); fg.translate(2, 0, 0); var flag = new T.Mesh(fg, new T.MeshStandardMaterial({ map: flagT, side: T.DoubleSide, roughness: 0.8 })); flag.position.set(fx, 12.6, fz); flag.userData.base = Float32Array.from(fg.attributes.position.array); plzG.add(flag); PZ.flags.push(flag); }
      if (!dune) plzG.add(mesh(new T.CylinderGeometry(9, 9.5, 1.2, 40), mat('basin', { color: 0xc9ccd1, roughness: 0.6 }), 0, 0.6, -4)); if (!dune) plzG.add(mesh(new T.CylinderGeometry(8.4, 8.4, 0.2, 40), new T.MeshPhysicalMaterial({ color: 0x5fb3cf, roughness: 0.05, clearcoat: 1 }), 0, 1.15, -4));
      PZ.spray = []; for (var sp2 = 0; sp2 < (dune ? 0 : 50); sp2++) { var d = mesh(new T.SphereGeometry(0.14, 6, 4), mat('sprayM', { color: 0xf4fbff, roughness: 0.2, transparent: true, opacity: 0.8 }), 0, 1, -4); d.castShadow = false; plzG.add(d); PZ.spray.push(d); }
      for (var lp = 0; lp < (dune ? 0 : 12); lp++) { var lx = (lp % 2 ? 1 : -1) * 22, lz = -36 + Math.floor(lp / 2) * 10; plzG.add(mesh(new T.CylinderGeometry(0.12, 0.14, 5, 6), frameM, lx, 2.5, lz)); var lb = new T.MeshBasicMaterial({ color: 0x6b6458 }), bl = new T.Mesh(new T.SphereGeometry(0.35, 8, 6), lb); bl.position.set(lx, 5.2, lz); plzG.add(bl); PZ.lamps.push(lb); }
      (dune ? [] : [[-34, -20], [34, -20], [-34, 0], [34, 0]]).forEach(function (q, i) { palm(q[0], q[1], 10 + i % 2, i % 2 ? -0.15 : 0.15); });
      var rs = rnd(91); for (var tb = 0; tb < (dune ? 0 : 20); tb++) { var ta = -1.3 + rs() * 2.6, td = 190 + rs() * 120; towerBlock(Math.sin(ta) * td, Math.cos(ta) * td + 60, 14 + rs() * 12, 20 + rs() * 70, 14 + rs() * 10, plzG, 0, PZ.towers); }
      PZ.flood = []; [[-40, 12, 10], [40, 12, 10], [0, 12, 20]].forEach(function (q) { var L0 = new T.SpotLight(0xfff1d6, 0, 200, 0.7, 0.6, 1.2); L0.position.set(q[0], q[1], q[2]); L0.target.position.set(q[0] * 0.6, 20, 60); plzG.add(L0, L0.target); PZ.flood.push(L0); });
      // People crossing the plaza; a crowd on worship days (Friday at the mosque, Sunday at the church).
      var NW = 140, wr = rnd(43), wb = []; for (var w = 0; w < NW; w++) wb.push([-40 + wr() * 80, -36 + wr() * 70, (wr() - 0.5) * 2, (wr() - 0.5) * 2, wr() * 6]);
      PZ.walkers = squad(NW, function (i) { return [0xf4f3ec, 0xf4f3ec, 0x2f6fa0, 0x1d7a43, 0xc0392b, 0x8e44ad, 0xf2b600][i % 7]; }, 1, plzG); PZ.walkBase = wb;
      if (/^(unilag|ph_uniport|abj_uni|abj_chu|ph_rsu|lag_lasu|lag_yabatech|acc_ug|kum_knust_uni|cc_ucc_uni)$/.test(id)) mergeStatic(plzG, [pave, gr].concat(PZ.spray || [], PZ.flags || [], PZ.ball ? [PZ.ball] : []));
    }
    function plazaFrame(t, night) {
      if (PZ.ball) { var bu = t * 0.7; PZ.ball.position.set(Math.sin(bu) * 7, 0.35 + Math.abs(Math.sin(t * 3)) * 0.6, Math.sin(bu * 1.7) * 3.5); (PZ.players || []).forEach(function (f, k) { var lg = f.userData.legs; f.position.x = -20 + (k - 1.5) * 4 + Math.sin(bu + k) * 1.5; if (lg && !reduce) { lg[0].rotation[f.userData.axis || 'z'] = Math.sin(t * 7 + k) * 0.5; lg[1].rotation[f.userData.axis || 'z'] = -Math.sin(t * 7 + k) * 0.5; } }); }
      var dw = ((sc.day || 0) % 7 + 7) % 7, busy = (/mosque|worship/.test(sc.placeId || '') && dw === 4) || (/ecumenical|worship/.test(sc.placeId || '') && dw === 6), W = PZ.walkers, n = night ? 18 : busy ? W.n : 60;
      var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), one = new T.Vector3(1, 1, 1);
      for (var i = 0; i < W.n; i++) { var b = PZ.walkBase[i]; if (i >= n) { m4.makeTranslation(0, -9, 0); W.body.setMatrixAt(i, m4); W.head.setMatrixAt(i, m4); continue; } var x = ((b[0] + t * b[2] + 45) % 90 + 90) % 90 - 45, z = ((b[1] + t * b[3] + 40) % 80 + 80) % 80 - 40; if (Math.hypot(x, z + 4) < 10) x += 12; e.set(0, Math.atan2(-b[3], b[2]), 0); q.setFromEuler(e); m4.compose(v.set(x, Math.abs(Math.sin(t * 6 + b[4])) * 0.06, z), q, one); W.body.setMatrixAt(i, m4); W.head.setMatrixAt(i, m4); }
      W.body.instanceMatrix.needsUpdate = W.head.instanceMatrix.needsUpdate = true;
      (PZ.board || []).forEach(function (m) { m.emissiveIntensity = night ? 0.9 : 0.12; });
      if (PZ.boardTex && sc.th && !!sc.th.on !== PZ.boardOn) { PZ.boardOn = !!sc.th.on; PZ.boardTex.userData.last = null; redrawAt(PZ.boardTex, t, 1); } // the show started or ended: repaint, no rebuild
      PZ.flags.forEach(function (f, k) { var p = f.geometry.attributes.position, b0 = f.userData.base; for (var j = 0; j < p.count; j++) { var x0 = b0[j * 3]; p.array[j * 3 + 2] = Math.sin(t * 4 + x0 * 1.6 + k) * 0.3 * (x0 / 4); } p.needsUpdate = true; });
      (PZ.jets || []).forEach(function (jt, i) { var hj = night ? 6 + 14 * Math.abs(Math.sin(t * 1.3 + i * 0.5)) : 0.01; jt.scale.set(1, hj, 1); jt.position.y = hj / 2; jt.visible = night; }); // the fountain dances after dark
      PZ.spray.forEach(function (d, i) { var u = (t * 0.55 + i / PZ.spray.length) % 1, a = i * 2.39, rad = (i % 5 === 0 ? 0.4 : 4) * u; d.position.set(Math.cos(a) * rad, 1.2 + Math.sin(u * Math.PI) * (i % 5 === 0 ? 7 : 3.5), -4 + Math.sin(a) * rad); });
      PZ.lamps.forEach(function (m) { m.color.set(night ? 0xffe2a0 : 0x6b6458); }); PZ.towers.forEach(function (m) { m.emissiveIntensity = night ? 0.9 : 0; }); PZ.glow.forEach(function (m) { m.emissiveIntensity = night ? 0.9 : 0.15; }); PZ.flood.forEach(function (L0) { L0.intensity = night ? 1400 : 0; });
    }


    /* ---------- galleries and museums: a white-cube hall, lit paintings, sculptures on plinths, display cases ---------- */
    var galG = new T.Group(); galG.visible = false; S3.add(galG); var GL = {};
    function artTex(seed, kind) {
      return canvasTex(256, 320, function (g, w, h) { var r = rnd(seed), pal = [['#c0392b', '#f2b600', '#1f5fa0', '#17181a'], ['#2fa36b', '#f4f1ea', '#e67e22', '#5a3a22'], ['#1a2a4a', '#3a8fb0', '#f2c94c', '#f4f1ea'], ['#7a1f2b', '#d4af37', '#2b2f36', '#e9e2d4']][Math.floor(r() * 4)];
        g.fillStyle = pal[3]; g.fillRect(0, 0, w, h);
        if (kind === 0) for (var i = 0; i < 14; i++) { g.fillStyle = pal[Math.floor(r() * 3)]; g.globalAlpha = 0.85; g.beginPath(); g.arc(r() * w, r() * h, 10 + r() * 60, 0, Math.PI * 2); g.fill(); }
        else if (kind === 1) { for (var y = 0; y < h; y += 32) for (var x = 0; x < w; x += 32) { g.fillStyle = pal[(x / 32 + y / 32) % 2 ? 0 : 2]; g.fillRect(x + 2, y + 2, 28, 28); g.strokeStyle = pal[3]; g.lineWidth = 3; g.beginPath(); g.arc(x + 16, y + 16, 8, 0, Math.PI * 2); g.stroke(); } }
        else { for (var k = 0; k < 9; k++) { g.fillStyle = pal[k % 3]; g.globalAlpha = 0.9; g.fillRect(r() * w * 0.7, r() * h * 0.7, 30 + r() * 90, 20 + r() * 120); } g.globalAlpha = 1; g.strokeStyle = pal[3]; g.lineWidth = 6; g.beginPath(); g.moveTo(0, h * r()); g.bezierCurveTo(w * 0.3, 0, w * 0.6, h, w, h * r()); g.stroke(); }
        g.globalAlpha = 1; });
    }
    function buildGallery() {
      wipe(galG); var id = sc.placeId || 'gallery', r = rnd(hashStr(id)), museum = /museum|badagry|obiwali/.test(id); GL = { spots: [] };
      var RW = 56, RD = 44, RH = 13;
      var room = new T.Mesh(new T.BoxGeometry(RW, RH, RD), new T.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.9, side: T.BackSide })); room.position.set(0, RH / 2, 0); room.receiveShadow = true; galG.add(room);
      var floorT = canvasTex(256, 256, function (g, w, h) { var rr = rnd(4); g.fillStyle = museum ? '#a88a64' : '#b9b5ad'; g.fillRect(0, 0, w, h); for (var i = 0; i < 3000; i++) { g.fillStyle = 'rgba(0,0,0,' + rr() * 0.05 + ')'; g.fillRect(rr() * w, rr() * h, 2, 2); } if (museum) for (var y = 0; y < h; y += 16) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, w, 1); } }, [10, 8]);
      var floor = new T.Mesh(new T.PlaneGeometry(RW, RD).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: floorT, roughness: 0.25, metalness: 0.1 })); floor.position.y = 0.02; floor.receiveShadow = true; galG.add(floor);
      // Paintings round the walls, each with a frame and a spot from the ceiling track.
      var frameMat = mat('gframe', { color: museum ? 0x6b4a2b : 0x1c1c1f, roughness: 0.5 }), n = 0;
      [[0, RD / 2 - 0.2, Math.PI, RW], [-RW / 2 + 0.2, 0, Math.PI / 2, RD], [RW / 2 - 0.2, 0, -Math.PI / 2, RD]].forEach(function (wq) {
        var cnt = Math.floor(wq[3] / 9); for (var i = 0; i < cnt; i++) { var off = -wq[3] / 2 + (i + 0.5) * (wq[3] / cnt), w2 = 3.2 + r() * 2.4, h2 = w2 * (1.1 + r() * 0.4), g = new T.Group(); g.position.set(wq[2] === Math.PI ? off : wq[0], 4.6 + r() * 0.6, wq[2] === Math.PI ? wq[1] : off); g.rotation.y = wq[2];
          g.add(mesh(new T.BoxGeometry(w2 + 0.4, h2 + 0.4, 0.15), frameMat, 0, 0, -0.02)); var pic = new T.Mesh(new T.PlaneGeometry(w2, h2), new T.MeshStandardMaterial({ map: artTex(hashStr(id) + n * 97, n % 3), roughness: 0.7 })); pic.position.z = 0.08; g.add(pic);
          var lab = new T.Mesh(new T.PlaneGeometry(0.6, 0.35), mat('label', { color: 0xffffff })); lab.position.set(w2 / 2 + 0.8, -h2 / 2 + 0.6, 0.06); g.add(lab); galG.add(g); n++;
          var sl = new T.SpotLight(0xfff4e0, 60, 18, 0.42, 0.5, 1.4); sl.position.copy(g.position).add(new T.Vector3(Math.sin(wq[2]) * 4, RH - g.position.y - 0.5, Math.cos(wq[2]) * 4)); sl.target.position.copy(g.position); galG.add(sl, sl.target); GL.spots.push(sl); } });
      // Sculptures on plinths down the middle, or display cases of masks and bronzes at a museum.
      var bronze = mat('bronze', { color: 0x7a5530, metalness: 0.7, roughness: 0.35 }), wood = mat('carve', { color: 0x4a2f1c, roughness: 0.6 }), glassCase = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 0.9, transparent: true, opacity: 0.25, thickness: 0.2 });
      for (var p = 0; p < 6; p++) { var px = -18 + (p % 3) * 18, pz = -4 + Math.floor(p / 3) * 12; galG.add(mesh(new T.BoxGeometry(2.2, 2.4, 2.2), mat('plinth', { color: 0xffffff, roughness: 0.6 }), px, 1.2, pz));
        if (museum) { var head = new T.Group(); head.position.set(px, 2.4, pz); head.add(mesh(new T.CylinderGeometry(0.55, 0.65, 0.4, 16), bronze, 0, 0.2, 0)); var hd = mesh(new T.SphereGeometry(0.62, 20, 16), p % 2 ? bronze : wood, 0, 1.0, 0); hd.scale.set(0.85, 1.15, 0.9); head.add(hd); head.add(mesh(new T.CylinderGeometry(0.66, 0.6, 0.5, 16), p % 2 ? bronze : wood, 0, 1.7, 0)); galG.add(head); galG.add(mesh(new T.BoxGeometry(2, 2.4, 2), glassCase, px, 3.6, pz)); }
        else { var sk = mesh(p % 2 ? new T.TorusKnotGeometry(0.7, 0.22, 96, 12, 2, 3) : new T.IcosahedronGeometry(0.9, 0), p % 3 === 0 ? bronze : mat('sculpt' + p, { color: [0xc0392b, 0xf4f1ea, 0x1f5fa0][p % 3], roughness: 0.3, metalness: 0.2 }), px, 3.6, pz); sk.userData.spin = true; galG.add(sk); } }
      [-9, 9].forEach(function (bx) { galG.add(mesh(new T.BoxGeometry(5, 0.5, 1.4), mat('gbench', { color: 0x1c1c1f, roughness: 0.4 }), bx, 0.9, 12)); });
      var tl = mat('track', { color: 0x2b2f36, metalness: 0.6 }); [-RD / 2 + 4, 0, RD / 2 - 4].forEach(function (z) { galG.add(mesh(new T.BoxGeometry(RW - 6, 0.2, 0.3), tl, 0, RH - 0.3, z)); });
      var titleT = canvasTex(1024, 128, function (g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = '#17181a'; g.font = '800 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(sc.name || 'Gallery').toUpperCase(), w / 2, h / 2, w - 40); });
      var tm = new T.Mesh(new T.PlaneGeometry(22, 2.75), new T.MeshBasicMaterial({ map: titleT, transparent: true })); tm.position.set(0, RH - 2.2, RD / 2 - 0.25); tm.rotation.y = Math.PI; galG.add(tm);
      GL.amb = new T.PointLight(0xffffff, 40, 80, 1); GL.amb.position.set(0, RH - 1, 0); galG.add(GL.amb);
      // Visitors drift between the works and pause in front of them.
      var NW = 26, wr = rnd(53), wb = []; for (var w = 0; w < NW; w++) wb.push([wr() * 6.28, 8 + wr() * 10, (wr() < 0.5 ? 1 : -1) * (0.02 + wr() * 0.02), wr() * 6]);
      GL.walkers = squad(NW, function (i) { return [0x17181a, 0xf4f3ec, 0xc0392b, 0x2f6fa0, 0x8e44ad, 0xe67e22][i % 6]; }, 1, galG); GL.walkBase = wb;
      mergeStatic(galG, [room]);
    }
    function galleryFrame(t) {
      var W = GL.walkers, m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), one = new T.Vector3(1, 1, 1);
      for (var i = 0; i < W.n; i++) { var b = GL.walkBase[i], ph = t * b[2] + b[0], step = Math.floor(ph * 3), u = ph * 3 - step, pause = u < 0.6, a = (step + (pause ? 0 : (u - 0.6) / 0.4)) / 3, x = Math.cos(a) * b[1] * 1.6, z = Math.sin(a) * b[1] + 2; e.set(0, pause ? Math.atan2(x, -(z - 2)) : -a - Math.PI / 2 * Math.sign(b[2]), 0); q.setFromEuler(e); m4.compose(v.set(Math.max(-24, Math.min(24, x)), pause ? 0 : Math.abs(Math.sin(t * 5 + b[3])) * 0.05, Math.max(-18, Math.min(18, z))), q, one); W.body.setMatrixAt(i, m4); W.head.setMatrixAt(i, m4); }
      W.body.instanceMatrix.needsUpdate = W.head.instanceMatrix.needsUpdate = true;
      galG.children.forEach(function (o) { if (o.userData.spin) o.rotation.y = t * 0.3; });
    }
    // Landmark exteriors for the plaza: the National Theatre's ribbed drum and the Millennium Tower's needle and saucer.
    function theatre(x, z) {
      var g = new T.Group(); g.position.set(x, 0, z); var wall = mat('thwall', { color: 0xe9e5dc, roughness: 0.7 }), rib = mat('thrib', { color: 0xc8c2b4, roughness: 0.6 });
      g.add(mesh(new T.CylinderGeometry(42, 44, 14, 48), wall, 0, 7, 0)); g.add(mesh(new T.CylinderGeometry(43, 43, 2.2, 48), glassM, 0, 8, 0));
      for (var k = 0; k < 24; k++) { var a = k / 24 * Math.PI * 2, fold = mesh(new T.BoxGeometry(12, 0.8, 9), rib, Math.cos(a) * 36, 17 + (k % 2) * 1.6, Math.sin(a) * 36); fold.rotation.y = -a; fold.rotation.z = (k % 2 ? 0.35 : -0.35); g.add(fold); }
      g.add(mesh(new T.CylinderGeometry(30, 38, 6, 48), wall, 0, 17, 0)); g.add(mesh(new T.CylinderGeometry(22, 30, 5, 48), mat('throof', { color: 0x9aa3ab, metalness: 0.4, roughness: 0.4 }), 0, 22.5, 0));
      plzG.add(g); return g;
    }
    // Rules 31: the National Theatre's billboard on the plaza: now showing, next week, last week. Lit at night.
    function theatreBoard(x, z) {
      var th = sc.th, g = new T.Group(); g.position.set(x, 0, z); var steel = mat('tbPost', { color: 0x3a3f46, metalness: 0.6, roughness: 0.4 });
      [-7, 7].forEach(function (px) { g.add(mesh(new T.CylinderGeometry(0.45, 0.55, 10, 10), steel, px, 5, 0)); });
      g.add(mesh(new T.BoxGeometry(18.6, 9.6, 0.6), mat('tbFrame', { color: 0x17181a, roughness: 0.5 }), 0, 14.6, 0));
      var tex = screenTex(1024, 512, function (c, w, h) { th = sc.th || th;
        c.fillStyle = '#120c0a'; c.fillRect(0, 0, w, h); c.fillStyle = th.color || '#8e2b2b'; c.fillRect(0, 0, w, 74); c.fillRect(0, h - 120, w, 120);
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.font = '800 40px system-ui, sans-serif'; c.fillText('NATIONAL THEATRE · IGANMU', w / 2, 38, w - 40);
        c.fillStyle = '#ffd23f'; c.font = '900 44px system-ui, sans-serif'; c.fillText(th.on ? '★ ON NOW ★' : 'NOW SHOWING', w / 2, 118);
        c.fillStyle = '#fff'; c.font = '900 86px system-ui, sans-serif'; c.fillText(String(th.title).toUpperCase(), w / 2, 210, w - 50);
        c.fillStyle = '#e9e5dc'; c.font = '700 38px system-ui, sans-serif'; c.fillText(String(th.kind || '').toUpperCase() + (th.by ? ' · ' + th.by : ''), w / 2, 290, w - 50); c.font = '600 34px system-ui, sans-serif'; c.fillText(th.when || '', w / 2, 340, w - 50);
        c.fillStyle = '#fff'; c.font = '700 32px system-ui, sans-serif'; c.fillText('NEXT WEEK: ' + th.next, w / 2, h - 84, w - 50); c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillText(th.last ? 'LAST WEEK: ' + th.last : 'THE NEW SEASON STARTS NOW', w / 2, h - 38, w - 50);
      });
      redrawAt(tex, 0, 1); PZ.boardTex = tex; PZ.boardOn = !!th.on; PZ.board = [];
      [0, Math.PI].forEach(function (ry) { var m = new T.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12, roughness: 0.6 }); var pnl = new T.Mesh(new T.PlaneGeometry(18, 9), m); pnl.position.set(0, 14.6, ry ? -0.32 : 0.32); pnl.rotation.y = ry; pnl.userData.dyn = true; g.add(pnl); PZ.board.push(m); });
      plzG.add(g); return g;
    }
    // Rules 31: inside the National Theatre's main hall: raked seats, a proscenium stage with curtains, footlights and
    // spotlights, and this week's show on stage (a play, a band, dancers, a comedian or a musical). Curtain closed off show hours.
    function buildAuditorium(room, floor, RW, RD, RH) {
      var th = sc.th || { title: 'National Theatre', kind: 'play', on: false, color: '#8e2b2b', by: '' }, on = !!th.on, col = new T.Color(th.color || '#8e2b2b');
      room.material.color.set(0x2a1416); floor.material.color.set(0x3a2418); floor.material.roughness = 0.7; floor.material.metalness = 0;
      var AU = GL.au = { perf: [], spots: [], curtain: [], on: on, kind: th.kind, aud: null, audBase: [] }, SZ = RD / 2 - 6, red = mat('auCurtain', { color: 0x8e1a1f, roughness: 0.85 }), gold = mat('auGold', { color: 0xc9a227, metalness: 0.7, roughness: 0.35 }), wood = mat('auStage', { color: 0x5a3a22, roughness: 0.6 });
      galG.add(mesh(new T.BoxGeometry(46, 1.5, 12), wood, 0, 0.75, SZ)); // the stage
      galG.add(mesh(new T.BoxGeometry(46.4, 0.3, 0.4), gold, 0, 1.5, SZ - 6));
      [-1, 1].forEach(function (sd) { galG.add(mesh(new T.BoxGeometry(3, RH, 1.6), gold, sd * 24.5, RH / 2, SZ - 6)); galG.add(mesh(new T.BoxGeometry(3.2, 12, 0.6), red, sd * 21.6, 7.5, SZ - 5.2)); });
      var hdr = canvasTex(1024, 128, function (c, w, h) { c.fillStyle = '#1a0d0d'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c9a227'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#ffd23f'; c.font = '900 64px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(th.title).toUpperCase(), w / 2, h / 2 + 2, w - 60); });
      var hm = new T.Mesh(new T.PlaneGeometry(46, 3.4), new T.MeshBasicMaterial({ map: hdr })); hm.position.set(0, RH - 2, SZ - 6.9); hm.rotation.y = Math.PI; galG.add(hm);
      galG.add(mesh(new T.BoxGeometry(50, 2.6, 1.2), gold, 0, RH - 2, SZ - 6.1));
      // Main curtain: two halves that draw apart when the show is on.
      [-1, 1].forEach(function (sd) { var c = mesh(new T.BoxGeometry(21, 12, 0.4), red, sd * 10.5, 7.5, SZ - 4.6); c.userData.dyn = true; c.userData.side = sd; galG.add(c); AU.curtain.push(c); });
      // Footlights.
      var fl = new T.MeshBasicMaterial({ color: 0xffe2a0 }); for (var f = 0; f < 15; f++) galG.add(mesh(new T.BoxGeometry(0.9, 0.25, 0.4), fl, -21 + f * 3, 1.62, SZ - 5.6));
      // The backdrop, painted for the kind of show (a live LED wall for a concert).
      var drawDrop = function (c, w, h, t) {
        var k = th.kind; t = t || 0;
        if (k === 'concert') { c.fillStyle = '#05060a'; c.fillRect(0, 0, w, h); for (var b = 0; b < 32; b++) { var v = (Math.sin(t * 3 + b * 0.7) * 0.5 + 0.5) * (Math.sin(t * 1.3 + b) * 0.3 + 0.7); c.fillStyle = 'hsl(' + ((b * 11 + t * 40) % 360) + ',90%,55%)'; c.fillRect(b * w / 32 + 2, h - v * h * 0.8, w / 32 - 4, v * h * 0.8); } c.fillStyle = '#fff'; c.font = '900 70px system-ui'; c.textAlign = 'center'; c.fillText(String(th.title).toUpperCase(), w / 2, 90, w - 40); return; }
        var g2 = c.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, k === 'dance' ? '#f39c12' : k === 'comedy' ? '#3a1d14' : k === 'musical' ? '#2c1a4a' : '#5d8aa8'); g2.addColorStop(1, k === 'dance' ? '#8e2b2b' : k === 'comedy' ? '#1a0d0a' : k === 'musical' ? '#8e44ad' : '#d9c79a'); c.fillStyle = g2; c.fillRect(0, 0, w, h);
        if (k === 'comedy') { c.fillStyle = '#5a2a1a'; for (var y = 0; y < h; y += 34) for (var x = (y / 34) % 2 * 40; x < w; x += 80) c.fillRect(x + 2, y + 2, 76, 30); c.fillStyle = '#ffd23f'; c.font = '900 90px system-ui'; c.textAlign = 'center'; c.fillText(String(th.title).toUpperCase(), w / 2, h / 2, w - 40); return; }
        if (k === 'dance') { c.fillStyle = '#ffdb6e'; c.beginPath(); c.arc(w / 2, h * 0.62, 110, 0, Math.PI * 2); c.fill(); c.fillStyle = '#3a1a0a'; c.fillRect(0, h * 0.72, w, h); return; }
        if (k === 'musical') { c.fillStyle = '#17121f'; for (var bx = 0; bx < 26; bx++) { var bh = 60 + (bx * 37 % 140); c.fillRect(bx * 40, h - bh, 34, bh); } c.fillStyle = '#ffd23f'; for (var st = 0; st < 40; st++) c.fillRect((st * 97) % w, (st * 53) % (h * 0.5), 3, 3); return; }
        // a play: a village compound, palms and a hut wall
        c.fillStyle = '#b07a4a'; c.fillRect(0, h * 0.6, w, h * 0.4); c.fillStyle = '#8a5a34'; c.fillRect(w * 0.1, h * 0.35, w * 0.3, h * 0.3); c.fillStyle = '#5a3a20'; c.beginPath(); c.moveTo(w * 0.07, h * 0.36); c.lineTo(w * 0.25, h * 0.15); c.lineTo(w * 0.43, h * 0.36); c.fill();
        c.fillStyle = '#2f6b3a'; [0.62, 0.8].forEach(function (px) { c.fillRect(w * px, h * 0.2, 10, h * 0.42); for (var lf = 0; lf < 6; lf++) { c.beginPath(); c.ellipse(w * px + 5, h * 0.2, 60, 12, lf * 0.55, 0, Math.PI * 2); c.fill(); } });
      };
      var drop = th.kind === 'concert' ? screenTex(1024, 320, drawDrop) : canvasTex(1024, 320, function (c, w, h) { drawDrop(c, w, h, 0); });
      var dm = new T.Mesh(new T.PlaneGeometry(40, 12.5), new T.MeshBasicMaterial({ map: drop })); dm.position.set(0, 7.6, RD / 2 - 0.4); dm.rotation.y = Math.PI; galG.add(dm); if (th.kind === 'concert') AU.drop = drop;
      // Who is on stage.
      var perf = function (i, female, x, z, mode, y) { var p = person(i, female); p.position.set(x, y || 1.5, z); p.rotation.y = Math.PI / 2; p.userData.dyn = true; galG.add(p); AU.perf.push({ g: p, mode: mode, ph: i * 1.7, x: x, z: z, y: y || 1.5 }); return p; };
      var micStand = function (x, z) { galG.add(mesh(new T.CylinderGeometry(0.05, 0.05, 1.7, 6), steelM(), x, 2.35, z - 0.6)); galG.add(mesh(new T.SphereGeometry(0.12, 8, 6), mat('auMic', { color: 0x17181a }), x, 3.25, z - 0.6)); };
      if (th.kind === 'concert') {
        perf(200, true, 0, SZ - 3, 'sway'); micStand(0, SZ - 3); perf(201, false, -7, SZ - 1, 'sway'); perf(202, false, 7, SZ - 1, 'sway');
        galG.add(mesh(new T.BoxGeometry(8, 0.8, 5), wood, 0, 1.9, SZ + 3)); perf(203, false, 0, SZ + 4, 'drum', 2.3); [-1.3, 0, 1.3].forEach(function (dx) { galG.add(mesh(new T.CylinderGeometry(0.6, 0.6, 0.6, 14), mat('auDrum', { color: 0xc0392b, roughness: 0.4 }), dx, 3.1, SZ + 2.6)); });
        for (var hn = 0; hn < 3; hn++) { perf(204 + hn, hn === 1, 12 + hn * 2.6, SZ + 1, 'sway'); galG.add(mesh(new T.CylinderGeometry(0.08, 0.25, 1.1, 8), gold, 12 + hn * 2.6, 3.0, SZ + 0.3)); }
      } else if (th.kind === 'dance' || th.kind === 'musical') {
        for (var dn = 0; dn < (th.kind === 'dance' ? 8 : 6); dn++) perf(210 + dn, dn % 2 === 0, -12 + (dn % 4) * 8, SZ - 2 + Math.floor(dn / 4) * 4, 'dance');
        if (th.kind === 'musical') { perf(220, true, 0, SZ - 4, 'sway'); micStand(0, SZ - 4); }
        else [-19, -17].forEach(function (dx, k) { perf(221 + k, false, dx, SZ + 1, 'drum'); galG.add(mesh(new T.CylinderGeometry(0.35, 0.35, 1.0, 12), mat('auTalk', { color: 0x8a5a34 }), dx, 2.6, SZ + 0.4)); });
      } else if (th.kind === 'comedy') {
        perf(230, false, 0, SZ - 3, 'sway'); micStand(0, SZ - 3); galG.add(mesh(new T.CylinderGeometry(0.5, 0.5, 1.4, 12), wood, 3, 2.2, SZ - 1));
      } else {
        perf(240, false, -6, SZ - 1, 'walk'); perf(241, true, 2, SZ - 2, 'walk'); perf(242, false, 9, SZ, 'sway');
        galG.add(mesh(new T.BoxGeometry(6, 4, 4), mat('auHut', { color: 0x9a6a3a, roughness: 0.9 }), -15, 3.5, SZ + 2)); galG.add(mesh(new T.ConeGeometry(4.6, 3, 6), mat('auThatch', { color: 0x6b4a22, roughness: 0.95 }), -15, 7, SZ + 2));
        galG.add(mesh(new T.CylinderGeometry(0.7, 0.6, 1.2, 12), mat('auKeg', { color: 0x6b3a1f }), 14, 2.1, SZ - 1)); galG.add(mesh(new T.BoxGeometry(2.6, 1.2, 1.2), wood, 10, 2.1, SZ + 2));
      }
      AU.perf.forEach(function (p) { p.g.visible = on; });
      // Spotlights from the lighting rig over the seats.
      if (on) for (var sp = 0; sp < (LITE ? 2 : 3); sp++) { var sl = new T.SpotLight([0xfff1d6, th.kind === 'concert' ? 0xff3d7f : 0xffe0b0, th.kind === 'concert' ? 0x3dd6ff : 0xfff1d6][sp], 140, 70, 0.22, 0.5, 1.2); sl.position.set(-10 + sp * 10, RH - 1, -6); sl.target.position.set(0, 1.5, SZ); galG.add(sl, sl.target); AU.spots.push(sl); }
      // Raked seats, two blocks with an aisle, and the audience (full on show nights).
      var seat = mat('auSeat', { color: 0x9e1b24, roughness: 0.7 }), tier = mat('auTier', { color: 0x2c1a14, roughness: 0.9 }), r0 = rnd(hashStr(th.title || 'show')), places = [];
      for (var r = 0; r < 9; r++) { var zz = 5 - r * 2.7, yy = r * 0.55; if (r) galG.add(mesh(new T.BoxGeometry(52, yy, 2.7), tier, 0, yy / 2, zz));
        [-1, 1].forEach(function (sd) { galG.add(mesh(new T.BoxGeometry(22, 0.35, 1.0), seat, sd * 13, yy + 0.55, zz)); galG.add(mesh(new T.BoxGeometry(22, 1.0, 0.25), seat, sd * 13, yy + 1.1, zz - 0.55)); for (var k = 0; k < 15; k++) places.push([sd * (3 + k * 1.43), yy + 0.4, zz]); }); }
      var full = on ? 0.8 : 0.04, seated = places.filter(function () { return r0() < full; }); if (!seated.length) seated = places.slice(0, 2);
      AU.aud = squad(seated.length, function (i) { return [0xc0392b, 0xf4f3ec, 0x2f6fa0, 0x16a35a, 0x8e44ad, 0xf2b600, 0x17181a][i % 7]; }, 0.8, galG); AU.audBase = seated;
      var m4 = new T.Matrix4(); seated.forEach(function (q, i) { m4.makeTranslation(q[0], q[1], q[2]); AU.aud.body.setMatrixAt(i, m4); AU.aud.head.setMatrixAt(i, m4); }); AU.aud.body.instanceMatrix.needsUpdate = AU.aud.head.instanceMatrix.needsUpdate = true;
      // Programme posters on the side walls.
      [[-1, 'NOW: ' + th.title], [1, th.on ? 'TONIGHT' : (th.when || '')]].forEach(function (pp) { var pt = canvasTex(256, 384, function (c, w, h) { c.fillStyle = th.color || '#8e2b2b'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '900 34px system-ui'; String(pp[1]).toUpperCase().split(' ').reduce(function (ln, wd) { var l = ln[ln.length - 1]; if ((l + ' ' + wd).length > 12 && l) ln.push(wd); else ln[ln.length - 1] = (l ? l + ' ' : '') + wd; return ln; }, ['']).slice(0, 7).forEach(function (l, k) { c.fillText(l, w / 2, 70 + k * 44, w - 20); }); });
        var pm = new T.Mesh(new T.PlaneGeometry(4, 6), new T.MeshBasicMaterial({ map: pt })); pm.position.set(pp[0] * (RW / 2 - 0.3), 6, -4); pm.rotation.y = -pp[0] * Math.PI / 2; galG.add(pm); });
    }
    function steelM() { return mat('auSteel', { color: 0xc7ccd1, metalness: 0.8, roughness: 0.3 }); }
    function auditoriumFrame(t) {
      var AU = GL.au, on = AU.on;
      AU.curtain.forEach(function (c) { var want = on ? c.userData.side * 19 : c.userData.side * 10.5; c.position.x += (want - c.position.x) * 0.04; c.scale.x += ((on ? 0.25 : 1) - c.scale.x) * 0.04; });
      if (GL.amb) GL.amb.intensity = on ? 14 : 60; if (on) hemi.intensity = 0.32;
      AU.spots.forEach(function (sl, k) { sl.target.position.set(Math.sin(t * (AU.kind === 'concert' ? 0.9 : 0.25) + k * 2.1) * (AU.kind === 'concert' ? 12 : 6), 1.5, RD_AU + Math.cos(t * 0.5 + k) * 2); });
      if (AU.drop) redrawAt(AU.drop, t, LITE ? 6 : 12);
      if (!on) return;
      AU.perf.forEach(function (p) { var g = p.g, lg = g.userData.legs, ph = t + p.ph;
        if (p.mode === 'dance') { g.position.y = p.y + Math.abs(Math.sin(ph * 5)) * 0.45; g.rotation.y = Math.PI / 2 + Math.sin(ph * 1.5) * 0.9; if (lg) lg.forEach(function (l, i) { l.rotation.z = Math.sin(ph * 10 + i * Math.PI) * 0.5; }); }
        else if (p.mode === 'walk') { var dx = Math.sin(ph * 0.35) * 3; g.position.x = p.x + dx; g.rotation.y = Math.PI / 2 + Math.cos(ph * 0.35) * 0.9; if (lg) lg.forEach(function (l, i) { l.rotation.z = Math.sin(ph * 4 + i * Math.PI) * 0.35 * Math.abs(Math.cos(ph * 0.35)); }); }
        else if (p.mode === 'drum') { g.position.y = p.y + Math.abs(Math.sin(ph * 8)) * 0.12; }
        else { g.rotation.z = Math.sin(ph * 2.2) * 0.08; g.position.y = p.y + Math.abs(Math.sin(ph * 4)) * 0.06; } });
      if (AU.kind === 'concert' && !LITE && !reduce) { var m4 = new T.Matrix4(); AU.audBase.forEach(function (q, i) { m4.makeTranslation(q[0], q[1] + Math.max(0, Math.sin(t * 6 + i)) * 0.35, q[2]); AU.aud.body.setMatrixAt(i, m4); AU.aud.head.setMatrixAt(i, m4); }); AU.aud.body.instanceMatrix.needsUpdate = AU.aud.head.instanceMatrix.needsUpdate = true; }
    }
    var RD_AU = 46 / 2 - 6;
    function millenniumTower(x, z) {
      var g = new T.Group(); g.position.set(x, 0, z); var steel = mat('mtsteel', { color: 0xdfe3e8, metalness: 0.7, roughness: 0.3 });
      [0, 2.1, 4.2].forEach(function (a) { var leg = mesh(new T.CylinderGeometry(1.2, 2.4, 150, 10), steel, Math.cos(a) * 6, 75, Math.sin(a) * 6); leg.rotation.z = Math.cos(a) * 0.04; leg.rotation.x = -Math.sin(a) * 0.04; g.add(leg); });
      var saucer = mesh(new T.CylinderGeometry(16, 10, 8, 32), glassM, 0, 112, 0); g.add(saucer); g.add(mesh(new T.CylinderGeometry(16.5, 16.5, 1.2, 32), steel, 0, 116, 0)); g.add(mesh(new T.ConeGeometry(1.5, 40, 10), steel, 0, 170, 0));
      plzG.add(g); return g;
    }


    /* ---------- street scenes: a Lagos road with a featured building for each kind of place ---------- */
    var strG = new T.Group(); strG.visible = false; S3.add(strG); var SR = {};
    function signTex(text, sub, bg, fg) { return canvasTex(1024, 192, function (g, w, h) { g.fillStyle = bg || '#1d5a3c'; g.fillRect(0, 0, w, h); g.fillStyle = fg || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 78px system-ui, sans-serif'; g.fillText(text, w / 2, sub ? h * 0.4 : h / 2, w - 40); if (sub) { g.font = '700 36px system-ui, sans-serif'; g.fillText(sub, w / 2, h * 0.8, w - 40); } }); }
    function signBoard(grp, text, sub, bg, x, y, z, w, rotY) { var m = new T.Mesh(new T.PlaneGeometry(w, w * 0.1875), new T.MeshStandardMaterial({ map: signTex(text, sub, bg), emissive: 0xffffff, emissiveMap: null, roughness: 0.6 })); m.material.emissiveIntensity = 0; m.position.set(x, y, z); m.rotation.y = rotY || Math.PI; grp.add(m); SR.signs.push(m.material); return m; }
    function carModel(colr, len) {
      var L = len || 4.4, g = new T.Group(), body = mat('car' + colr, { color: colr, roughness: 0.3, metalness: 0.5 });
      g.add(mesh(new T.BoxGeometry(L, 0.9, 1.8), body, 0, 0.75, 0)); g.add(mesh(new T.BoxGeometry(L * 0.55, 0.7, 1.7), body, -L * 0.05, 1.5, 0)); g.add(mesh(new T.BoxGeometry(L * 0.56, 0.5, 1.72), glassM, -L * 0.05, 1.5, 0));
      [[-L * 0.32, 0.9], [L * 0.32, 0.9], [-L * 0.32, -0.9], [L * 0.32, -0.9]].forEach(function (w) { var wh = mesh(new T.CylinderGeometry(0.38, 0.38, 0.3, 14), mat('tyre', { color: 0x111111 }), w[0], 0.38, w[1]); wh.rotation.x = Math.PI / 2; g.add(wh); });
      return g;
    }
    function danfo() { var g = new T.Group(); g.add(mesh(new T.BoxGeometry(7, 2.6, 2.6), mat('danfoY', { color: 0xf2c200, roughness: 0.5 }), 0, 1.7, 0)); g.add(mesh(new T.BoxGeometry(7.05, 0.3, 2.65), mat('danfoB', { color: 0x17181a }), 0, 1.4, 0)); g.add(mesh(new T.BoxGeometry(5, 0.9, 2.66), glassM, -0.4, 2.4, 0)); [[-2.3, 1.3], [2.3, 1.3], [-2.3, -1.3], [2.3, -1.3]].forEach(function (w) { var wh = mesh(new T.CylinderGeometry(0.45, 0.45, 0.3, 12), mat('tyre', { color: 0x111111 }), w[0], 0.45, w[1]); wh.rotation.x = Math.PI / 2; g.add(wh); }); return g; }
    function zincRoof(w, d, y, tilt) { var r = mesh(new T.BoxGeometry(w, 0.15, d), mat('zincR', { color: 0x9a8a78, metalness: 0.45, roughness: 0.55 }), 0, y, 0); r.rotation.x = tilt || 0.12; return r; }
    function buildStreet() {
      wipe(strG); var id = sc.placeId || 'street', kind = sc.kind || 'eatery', r = rnd(hashStr(id)), title = String(sc.name || 'Lagos').replace(/\s*\(.*?\)/g, '').toUpperCase(); SR = { signs: [], towers: [], movers: [], flames: [], smoke: [], kind: kind, spin: [] };
      var ground = mesh(new T.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), mat('stGround', { color: 0x9a9184, roughness: 0.95 }), 0, 0, 0); ground.castShadow = false; strG.add(ground);
      var road = mesh(new T.PlaneGeometry(600, 12).rotateX(-Math.PI / 2), mat('mroad', { color: 0x3a3f46, roughness: 0.9 }), 0, 0.02, -12); road.castShadow = false; strG.add(road);
      for (var dl = -280; dl < 280; dl += 8) { var dash = mesh(new T.PlaneGeometry(3.5, 0.25).rotateX(-Math.PI / 2), mat('dash', { color: 0xf2c200 }), dl, 0.03, -12); dash.castShadow = false; strG.add(dash); }
      strG.add(mesh(new T.BoxGeometry(600, 0.3, 5), mat('kerb', { color: 0xc9c2b4, roughness: 0.9 }), 0, 0.15, -3.5));
      var B = new T.Group(); B.position.set(0, 0, 8); strG.add(B); var wall = mat('stWall', { color: 0xe9e2d4, roughness: 0.8 });
      if (kind === 'shop') {
        // A player's own business: a shopfront in the shop's colours, its counter, shelves of what it sells, staff, and more customers at each level.
        var G = sc.shop || { group: 'kiosk', level: 1, owner: '' }, lv = Math.max(1, Math.min(3, G.level | 0 || 1)), col = { food: 0xc0392b, kiosk: 0x1f5fa0, salon: 0x8e44ad, shop: 0x16a35a, yard: 0xe67e22, big: 0x17181a }[G.group] || 0x1f5fa0;
        var w = 14 + lv * 4, H = 5 + lv, wallM = mat('shopW', { color: 0xf1ede4, roughness: 0.8 }); B.add(mesh(new T.BoxGeometry(w, H, 0.3), wallM, 0, H / 2, 11)); [-1, 1].forEach(function (sd) { B.add(mesh(new T.BoxGeometry(0.3, H, 10), wallM, sd * w / 2, H / 2, 6)); }); B.add(mesh(new T.BoxGeometry(w, 0.3, 10), wallM, 0, H, 6)); B.add(mesh(new T.BoxGeometry(w, 0.1, 10), mat('shopFloor', { color: 0xd8d2c4, roughness: 0.4 }), 0, 0.05, 6)); B.add(mesh(new T.BoxGeometry(w, 0.8, 0.3), wallM, 0, H - 0.4, 1)); B.add(mesh(new T.BoxGeometry(w + 0.4, 0.6, 10.4), mat('shopTrim' + G.group, { color: col }), 0, 5 + lv + 0.3, 6));
        B.add(mesh(new T.BoxGeometry(w - 2, 3.4, 0.12), mat('shopGlass', { color: 0xdbeef5, roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false }), 0, 2.2, 0.95)); var lamp = new T.PointLight(0xfff1d6, 30, 30, 1.2); lamp.position.set(0, 4.2, 6); B.add(lamp); var awn = mesh(new T.BoxGeometry(w, 0.2, 3), mat('shopAwn' + G.group, { color: col, roughness: 0.6 }), 0, 4.4, -0.5); awn.rotation.x = 0.18; B.add(awn);
        B.add(mesh(new T.BoxGeometry(6, 1.3, 1.4), mat('shopCounter', { color: 0x6b4a2b }), -w / 2 + 5, 0.65, 4));
        var goods = { food: [0xd9a35a, 0xc0392b, 0xf2b600], kiosk: [0x2b2f36, 0x2f6fa0, 0xf4f3ec], salon: [0xf4c7d9, 0x8e44ad, 0xffffff], shop: [0x16a35a, 0xf2b600, 0xc0392b], yard: [0x2b2f36, 0xe67e22, 0x9a9184], big: [0xd4af37, 0x17181a, 0x7b5cff] }[G.group] || [0xcccccc];
        for (var sh = 0; sh < 2 + lv; sh++) { var sx = -w / 2 + 3 + sh * 4.2; if (sx > w / 2 - 2) break; B.add(mesh(new T.BoxGeometry(3.4, 3.6, 0.8), mat('shelf', { color: 0x8a6a4a }), sx, 1.8, 9.5)); for (var it = 0; it < 9; it++) B.add(mesh(new T.BoxGeometry(0.6, 0.6, 0.5), mat('good' + G.group + (it % 3), { color: goods[it % goods.length], roughness: 0.6 }), sx - 1.2 + (it % 3) * 1.2, 0.9 + Math.floor(it / 3) * 1.1, 9.2)); }
        if (G.group === 'yard') for (var cw = 0; cw < lv; cw++) { var c3 = carModel([0xc0392b, 0x2f6fa0, 0xf4f3ec][cw], 4); c3.position.set(4 + cw * 6, 0.2, -6); c3.rotation.y = Math.PI / 2; B.add(c3); }
        if (G.group === 'salon') for (var sc2 = 0; sc2 < 1 + lv; sc2++) { B.add(mesh(new T.BoxGeometry(1.1, 1.2, 1.1), mat('bchair', { color: 0xc0392b, roughness: 0.4 }), -2 + sc2 * 3, 0.9, 4)); B.add(mesh(new T.BoxGeometry(2, 1.6, 0.1), mat('mirror', { color: 0xdfe8ee, metalness: 0.9, roughness: 0.05 }), -2 + sc2 * 3, 2.6, 10.8)); }
        if (G.group === 'food') for (var pt2 = 0; pt2 < lv + 1; pt2++) B.add(mesh(new T.CylinderGeometry(0.8, 0.7, 1, 14), mat('pot', { color: 0x1c1c1f, metalness: 0.4 }), -w / 2 + 3 + pt2 * 2, 1.8, 4));
        var staff = person(90, false); staff.position.set(-w / 2 + 5, 0, 5.6); staff.rotation.y = -Math.PI / 2; B.add(staff); if (lv > 1) { var st2 = person(91, true); st2.position.set(-w / 2 + 7.5, 0, 5.6); st2.rotation.y = -Math.PI / 2; B.add(st2); }
        for (var cu = 0; cu < 2 + lv * 2; cu++) { var cp = person(92 + cu, cu % 2 === 1); cp.position.set(-w / 2 + 4 + (cu % 4) * 2.4 + Math.floor(cu / 4) * 6, 0, 2.2 - Math.floor(cu / 4) * 3); cp.rotation.y = Math.PI / 2; B.add(cp); }
        signBoard(B, title, (G.owner ? G.owner + ' · ' : '') + 'LEVEL ' + lv, '#' + col.toString(16).padStart(6, '0'), 0, 6.4 + lv, 0.7, Math.min(22, w - 1));
        mergeStatic(B, []);
      } else if (kind === 'eatery') {
        B.add(mesh(new T.BoxGeometry(18, 5, 10), mat('bukaW', { color: 0xd8c08a, roughness: 0.9 }), 0, 2.5, 6)); var aw = zincRoof(22, 9, 4.2, 0.18); aw.position.z = -2; B.add(aw); [-10, 10].forEach(function (x) { B.add(mesh(new T.CylinderGeometry(0.12, 0.12, 4, 6), frameM, x, 2, -6)); });
        for (var tb = 0; tb < 6; tb++) { var tx = -7.5 + (tb % 3) * 7.5, tz = -4 + Math.floor(tb / 3) * 3.4; B.add(mesh(new T.CylinderGeometry(0.9, 0.9, 0.08, 16), mat('ptab', { color: 0xf4f3ec }), tx, 1.0, tz)); B.add(mesh(new T.CylinderGeometry(0.08, 0.1, 1, 6), mat('ptab', {}), tx, 0.5, tz)); [-1.3, 1.3].forEach(function (cx) { B.add(mesh(new T.BoxGeometry(0.7, 0.9, 0.7), mat('pchair' + (tb % 2), { color: tb % 2 ? 0xc0392b : 0x1f5fa0, roughness: 0.5 }), tx + cx, 0.45, tz)); }); }
        [-6, -3.5].forEach(function (px) { B.add(mesh(new T.CylinderGeometry(0.9, 0.8, 1.2, 14), mat('pot', { color: 0x1c1c1f, metalness: 0.4 }), px, 0.9, 1)); var fl = new T.Mesh(new T.ConeGeometry(0.6, 0.9, 10, 1, true).translate(0, 0.45, 0), emissiveMat(0xff7a1a, 0.8)); fl.position.set(px, 0, 1); B.add(fl); SR.flames.push(fl); });
        for (var sm = 0; sm < 14; sm++) { var pf = mesh(new T.SphereGeometry(0.4, 8, 6), new T.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.3, depthWrite: false }), -4.8, 2, 1, false); B.add(pf); SR.smoke.push(pf); }
        signBoard(B, title, /^(acc|kum)_/.test(id) ? 'BANKU · FUFU · WAAKYE · KELEWELE' : 'RICE · AMALA · SWALLOW · PEPPER SOUP', '#c0392b', 0, 5.6, -6.6, 16);
      } else if (kind === 'workshop') {
        var roof = zincRoof(26, 14, 5, 0.1); roof.position.z = 2; B.add(roof); [[-12, -4], [12, -4], [-12, 8], [12, 8]].forEach(function (q) { B.add(mesh(new T.CylinderGeometry(0.16, 0.16, 5, 6), frameM, q[0], 2.5, q[1])); });
        if (/sawmill/.test(id)) { for (var lg = 0; lg < 18; lg++) { var log = mesh(new T.CylinderGeometry(0.45, 0.45, 7, 10), trunkM, -14 + (lg % 6) * 1.0, 0.45 + Math.floor(lg / 6) * 0.85, -6); log.rotation.x = Math.PI / 2; log.position.x = -16 + (lg % 6) * 0.95; B.add(log); } for (var pk = 0; pk < 10; pk++) B.add(mesh(new T.BoxGeometry(6, 0.15, 0.6), mat('plankW', { color: 0xc9a46a }), 4, 0.1 + pk * 0.16, 2)); B.add(mesh(new T.BoxGeometry(5, 1, 1.4), mat('saw', { color: 0x2f6fa0, metalness: 0.4 }), -2, 0.9, 2)); var blade = mesh(new T.CylinderGeometry(0.9, 0.9, 0.05, 24), mat('blade', { color: 0xc7ccd1, metalness: 0.9, roughness: 0.2 }), -2, 1.5, 2); blade.rotation.x = Math.PI / 2; B.add(blade); SR.spin.push(blade); }
        else if (/tailor/.test(id)) { for (var tm = 0; tm < 6; tm++) { var mx2 = -8 + (tm % 3) * 8, mz = -1 + Math.floor(tm / 3) * 5; B.add(mesh(new T.BoxGeometry(3, 1.0, 1.4), mat('mtable', { color: 0x8a6a42 }), mx2, 0.5, mz)); B.add(mesh(new T.BoxGeometry(0.9, 0.6, 0.4), mat('smach', { color: 0x17181a, metalness: 0.4 }), mx2, 1.3, mz)); } for (var fr = 0; fr < 14; fr++) { var roll = mesh(new T.CylinderGeometry(0.25, 0.25, 2.2, 10), mat('fab' + (fr % 6), { color: [0xc0392b, 0xf2b600, 0x1f5fa0, 0x2fa36b, 0x8e44ad, 0xe67e22][fr % 6], roughness: 0.8 }), 10.5, 1.1, -3 + fr * 0.6); B.add(roll); } }
        else { [[-6, 0, 0xc0392b, 0.6], [2, 2, 0x2f6fa0, 0], [9, -1, 0xf4f3ec, 0]].forEach(function (cq) { var c2 = carModel(cq[2]); c2.position.set(cq[0], cq[3], cq[1]); c2.rotation.y = 0.3; B.add(c2); if (cq[3]) B.add(mesh(new T.BoxGeometry(0.8, 0.6, 0.8), mat('jack', { color: 0xc0392b }), cq[0], 0.3, cq[1])); }); for (var ty = 0; ty < 8; ty++) { var tyre = mesh(new T.TorusGeometry(0.42, 0.18, 8, 16), mat('tyre', { color: 0x111111 }), -12 + (ty % 2) * 1, 0.2 + Math.floor(ty / 2) * 0.36, 6); tyre.rotation.x = Math.PI / 2; B.add(tyre); } }
        signBoard(B, title, /ladipo/.test(id) ? 'SPARE PARTS · PANEL BEATING · SERVICE' : /tailor/.test(id) ? 'BESPOKE · ANKARA · AGBADA' : 'TIMBER · PLANKS · FURNITURE', '#2b2f36', 0, 6.4, -4.6, 18);
      } else if (kind === 'motorpark') {
        var can = zincRoof(46, 22, 7, 0.06); can.position.z = 6; B.add(can); for (var cp = -22; cp <= 22; cp += 11) [-4, 16].forEach(function (z) { B.add(mesh(new T.CylinderGeometry(0.25, 0.25, 7, 8), frameM, cp, 3.5, z)); });
        for (var db = 0; db < 8; db++) { var dn = danfo(); dn.position.set(-18 + (db % 4) * 12, 0, 1 + Math.floor(db / 4) * 9); dn.rotation.y = Math.PI / 2; B.add(dn); }
        B.add(mesh(new T.BoxGeometry(5, 3, 3), mat('kiosk', { color: 0xf4f3ec }), 20, 1.5, -6)); signBoard(B, title, /^ph_/.test(id) ? 'ABA · OWERRI · LAGOS · ABUJA · CALABAR' : /^abj_/.test(id) ? 'LAGOS · PH · KANO · KADUNA · JOS' : 'LAGOS · IBADAN · ABUJA · PH · BENIN', '#1f5fa0', 0, 8.6, -5.2, 20);
        // The ticket office, the tea and bread stall, the drivers' bench, and the intercity coaches loading behind the shed.
        var tko = new T.Group(); tko.position.set(-30, 0, 2); tko.add(mesh(new T.BoxGeometry(7, 4, 5), mat('tko', { color: 0x1f5fa0, roughness: 0.6 }), 0, 2, 0)); tko.add(mesh(new T.BoxGeometry(7.4, 0.3, 5.6), mat('tkoRoof', { color: 0xf4f3ec }), 0, 4.15, 0));
        [-2, 0, 2].forEach(function (x) { tko.add(mesh(new T.BoxGeometry(1.4, 1.2, 0.1), glassM, x, 2.2, -2.55)); }); tko.add(mesh(new T.BoxGeometry(6.6, 0.15, 0.7), mat('tkoSill', { color: 0xf4f3ec }), 0, 1.5, -2.8)); B.add(tko); signBoard(B, 'TICKETS', 'LAGOS · PH · KANO · JOS · ENUGU', '#c0392b', -30, 5.3, -0.7, 8);
        for (var tqq = 0; tqq < 4; tqq++) { var qp = person(60 + tqq, tqq % 2 === 1); qp.position.set(-31 + tqq * 0.1, 0, -2 - tqq * 1.3); qp.rotation.y = Math.PI / 2; B.add(qp); }
        var tea = new T.Group(); tea.position.set(8, 0, -8.2); tea.add(mesh(new T.BoxGeometry(3.2, 0.15, 1.4), mat('teaTop', { color: 0x8a5a33 }), 0, 1.3, 0)); [[-1.4, -0.5], [1.4, -0.5], [-1.4, 0.5], [1.4, 0.5]].forEach(function (q) { tea.add(mesh(new T.BoxGeometry(0.1, 1.3, 0.1), mat('teaTop', {}), q[0], 0.65, q[1])); });
        tea.add(mesh(new T.CylinderGeometry(0.3, 0.35, 0.6, 12), mat('kettle', { color: 0xc7ccd1, metalness: 0.8, roughness: 0.3 }), -1, 1.7, 0)); for (var lf = 0; lf < 4; lf++) tea.add(mesh(new T.BoxGeometry(0.5, 0.35, 0.9), mat('bread', { color: 0xd9a35a, roughness: 0.8 }), 0.1 + lf * 0.55, 1.55, 0));
        tea.add(mesh(new T.CylinderGeometry(0.05, 0.05, 3.4, 6), frameM, 0, 1.7, 0.6)); var umb = mesh(new T.ConeGeometry(2.2, 0.8, 10, 1, true), mat('teaUmb', { color: 0x16a35a, side: T.DoubleSide }), 0, 3.6, 0.6); tea.add(umb); B.add(tea);
        var mai = person(64, false); mai.position.set(8, 0, -7); mai.rotation.y = -Math.PI / 2; B.add(mai); signBoard(B, 'MAI SHAYI', 'TEA · BREAD · EGG · INDOMIE', '#16a35a', 8, 4.4, -9.3, 5);
        B.add(mesh(new T.BoxGeometry(7, 0.2, 1), mat('dbench', { color: 0x6b4a2b }), -9, 0.9, -8.6)); [-12, -6].forEach(function (x) { B.add(mesh(new T.BoxGeometry(0.2, 0.9, 0.8), mat('dbench', {}), x, 0.45, -8.6)); });
        for (var dr = 0; dr < 3; dr++) { var dv = person(65 + dr, false); dv.position.set(-11.2 + dr * 2.2, 0.5, -8.6); dv.rotation.y = Math.PI / 2; if (dv.userData.legs) dv.userData.legs.forEach(function (l) { l.rotation[dv.userData.axis || 'z'] = -1.2; }); B.add(dv); }
        signBoard(B, "DRIVERS' UNION", 'NO SMOKING · WAIT YOUR TURN', '#17181a', -9, 3.2, -9.3, 5);
        [-13, 13].forEach(function (x, ci) { var co = new T.Group(); co.position.set(x, 0, 25); co.add(mesh(new T.BoxGeometry(18, 3.6, 3.2), mat('coachW', { color: 0xf4f3ec, roughness: 0.35 }), 0, 2.4, 0)); co.add(mesh(new T.BoxGeometry(18.05, 0.6, 3.25), mat('coachS' + ci, { color: ci ? 0x1f5fa0 : 0x16a35a }), 0, 1.4, 0)); co.add(mesh(new T.BoxGeometry(16, 1.1, 3.3), glassM, 0.4, 3.2, 0));
          [-6.5, -4.5, 5, 7].forEach(function (wx) { var wh = mesh(new T.CylinderGeometry(0.6, 0.6, 3.4, 12), mat('tyre', { color: 0x111111 }), wx, 0.6, 0); wh.rotation.x = Math.PI / 2; co.add(wh); }); B.add(co); });
        for (var bg = 0; bg < 6; bg++) B.add(mesh(new T.BoxGeometry(0.9, 0.7, 0.6), mat('lug' + bg % 3, { color: [0xc0392b, 0x2f6fa0, 0x17181a][bg % 3] }), -18 + bg * 0.9, 0.35, 22.6));
        // The yard as it really is: a brick-paved apron, a ring of market stalls under red umbrellas, a POS stand,
        // rows of blue waiting seats and shopfronts (salon, chemist, POS) facing the park.
        B.add(mesh(new T.BoxGeometry(96, 0.06, 14), mat('brick', { color: 0xa65a3a, roughness: 0.95 }), 0, 0.03, 34));
        var umbM = mat('redUmb', { color: 0xd61f26, side: T.DoubleSide, roughness: 0.7 }), stallM = mat('stallTop', { color: 0x7a5232, roughness: 0.85 }), bucketM = mat('bucket', { color: 0x1f5fd0, roughness: 0.5 });
        var fruitM = [0xe23b2e, 0x2fa84f, 0xf2c200, 0xf07a1a, 0x7b3fa0].map(function (c, i) { return mat('fruit' + i, { color: c, roughness: 0.6 }); });
        for (var ms = 0; ms < 14; ms++) {
          var st = new T.Group(), side = ms < 8 ? 0 : 1, sx = side ? (ms % 2 ? 40 : -40) : -38 + ms * 10.8, sz = side ? -6 + Math.floor((ms - 8) / 2) * 10 : 33;
          st.position.set(sx, 0, sz); st.rotation.y = side ? (sx > 0 ? -Math.PI / 2 : Math.PI / 2) : Math.PI;
          st.add(mesh(new T.BoxGeometry(4.2, 0.2, 2), stallM, 0, 1.1, 0)); [[-1.9, -0.8], [1.9, -0.8], [-1.9, 0.8], [1.9, 0.8]].forEach(function (q) { st.add(mesh(new T.BoxGeometry(0.15, 1.1, 0.15), stallM, q[0], 0.55, q[1])); });
          for (var fr = 0; fr < 6; fr++) st.add(mesh(new T.SphereGeometry(0.32, 8, 6), fruitM[(fr + ms) % 5], -1.5 + fr * 0.6, 1.45, (fr % 2) * 0.5 - 0.25));
          st.add(mesh(new T.CylinderGeometry(0.06, 0.06, 3.6, 6), frameM, 0, 1.8, 0)); st.add(mesh(new T.ConeGeometry(3, 0.9, 12, 1, true), umbM, 0, 3.7, 0));
          st.add(mesh(new T.CylinderGeometry(0.35, 0.3, 0.7, 10), bucketM, 2.6, 0.35, 0.6));
          var sel = person(90 + ms, ms % 3 === 0); sel.position.set(0.3, 0, -1.6); sel.rotation.y = 0; st.add(sel); B.add(st);
        }
        var pos = new T.Group(); pos.position.set(-20, 0, -13); pos.add(mesh(new T.BoxGeometry(3.4, 2.6, 2.4), mat('posK', { color: 0xf4f3ec }), 0, 1.3, 0)); pos.add(mesh(new T.BoxGeometry(3.8, 0.2, 2.8), mat('posRoof', { color: 0x16a35a }), 0, 2.7, 0));
        pos.add(mesh(new T.BoxGeometry(3, 0.12, 0.6), mat('posSill', { color: 0x2b2f36 }), 0, 1.2, -1.4)); B.add(pos); signBoard(B, 'POS · TRANSFER · WITHDRAWAL', 'CASH OUT HERE', '#16a35a', -20, 3.6, -14.3, 7);
        var posGirl = person(110, true); posGirl.position.set(-20, 0, -12.6); posGirl.rotation.y = Math.PI; B.add(posGirl);
        var seatM = mat('wseat', { color: 0x1f3f8a, roughness: 0.5 });
        for (var wr = 0; wr < 3; wr++) for (var ws = 0; ws < 6; ws++) { B.add(mesh(new T.BoxGeometry(1, 0.15, 1), seatM, 24 + ws * 1.15, 0.9, -2 + wr * 3)); B.add(mesh(new T.BoxGeometry(1, 1, 0.15), seatM, 24 + ws * 1.15, 1.4, -1.5 + wr * 3)); }
        for (var wr2 = 0; wr2 < 3; wr2++) B.add(mesh(new T.BoxGeometry(7, 0.12, 0.3), frameM, 26.9, 0.5, -2 + wr2 * 3));
        for (var wpp = 0; wpp < 4; wpp++) { var wpn = person(115 + wpp, wpp % 2 === 0); wpn.position.set(24.5 + wpp * 2.3, 0.5, -2 + (wpp % 3) * 3); wpn.rotation.y = Math.PI; if (wpn.userData.legs) wpn.userData.legs.forEach(function (l) { l.rotation[wpn.userData.axis || 'z'] = -1.2; }); B.add(wpn); }
        [['BLESSED HANDS UNISEX SALON', '#2b4fd6', -28], ['GOOD HEALTH CHEMIST', '#16a35a', 0], ['POS · TRANSFER · WITHDRAWAL', '#6b2fd6', 28]].forEach(function (sh, i) {
          B.add(mesh(new T.BoxGeometry(22, 7, 6), mat('shopW' + i, { color: [0xe9e2d3, 0xd9d4c8, 0xcfd6dc][i], roughness: 0.9 }), sh[2], 3.5, 44)); B.add(mesh(new T.BoxGeometry(20, 3, 0.2), glassM, sh[2], 1.8, 40.9));
          signBoard(B, sh[0], i === 1 ? 'DRUGS · TESTS · FIRST AID' : i === 0 ? 'HAIR · NAILS · BARBING' : 'AIRTIME · DATA · BILLS', sh[1], sh[2], 7.6, 40.8, 18);
        });
        for (var cw = 0; cw < 14; cw++) { var cp3 = person(130 + cw, cw % 2 === 1); cp3.position.set(-26 + (cw * 7.3) % 50, 0, -18 + (cw * 3.7) % 14); cp3.rotation.y = (cw * 1.3) % (Math.PI * 2); B.add(cp3); }
        mergeStatic(B, []);
      } else if (kind === 'rail') {
        // Idu: a long platform under a canopy, the ticket gate, two tracks, a timetable board and a two-car train on a one-minute loop.
        var conc = mat('platform', { color: 0xc9c2b4, roughness: 0.9 }), steelR = mat('railSteel', { color: 0x8a9099, metalness: 0.8, roughness: 0.3 });
        B.add(mesh(new T.BoxGeometry(80, 1, 7), conc, 0, 0.5, 4)); B.add(mesh(new T.BoxGeometry(80, 0.08, 0.4), mat('yline', { color: 0xf2c200 }), 0, 1.04, 7.2));
        [10.5, 15.5].forEach(function (z) { [-0.75, 0.75].forEach(function (o) { B.add(mesh(new T.BoxGeometry(160, 0.2, 0.15), steelR, 0, 0.1, z + o)); }); for (var sl = -78; sl <= 78; sl += 2.5) B.add(mesh(new T.BoxGeometry(0.5, 0.12, 2.4), mat('sleeper', { color: 0x5a4a3a }), sl, 0.05, z)); });
        B.add(mesh(new T.BoxGeometry(78, 0.4, 9), mat('railCan', { color: 0xf4f3ec, roughness: 0.5 }), 0, 7.4, 5)); for (var cp2 = -36; cp2 <= 36; cp2 += 9) B.add(mesh(new T.CylinderGeometry(0.22, 0.22, 6.4, 8), frameM, cp2, 4.2, 1.6));
        for (var tg = 0; tg < 6; tg++) { B.add(mesh(new T.BoxGeometry(0.4, 1.1, 1.4), mat('gate', { color: 0x2b2f36, metalness: 0.5 }), -6 + tg * 2.4, 1.55, 1)); B.add(mesh(new T.BoxGeometry(0.06, 0.06, 1.1), mat('gateArm', { color: 0xc0392b }), -5 + tg * 2.4, 1.9, 1)); }
        var tt = screenTex(512, 256, function (g, w, h, t) { g.fillStyle = '#0d1117'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2c200'; g.font = '800 34px system-ui'; g.fillText('DEPARTURES', 20, 44); g.font = '600 28px system-ui'; var mm = Math.floor(t / 60) % 60; [['AIRPORT', 2], ['KUBWA', 9], ['AIRPORT', 17], ['AIRPORT', 32]].forEach(function (r, i) { g.fillStyle = i ? '#e8eaed' : '#7ee787'; g.fillText(r[0], 20, 100 + i * 42); g.fillText(i ? r[1] + ' min' : 'Boarding', 330, 100 + i * 42); }); });
        var ttm = new T.Mesh(new T.PlaneGeometry(8, 4), new T.MeshBasicMaterial({ map: tt })); ttm.position.set(12, 5, 1.4); ttm.rotation.y = Math.PI; B.add(ttm); SR.board = tt; redrawAt(tt, 0, 1);
        signBoard(B, title, 'LIGHT RAIL · AIRPORT LINE', '#16a35a', 0, 8.8, 0.4, 22);
        for (var wp = 0; wp < 8; wp++) { var pp = person(70 + wp, wp % 3 === 1); pp.position.set(-30 + wp * 7.5 + (wp % 2) * 1.5, 1, 5 + (wp % 3) * 0.8); pp.rotation.y = Math.PI / 2 * (wp % 2 ? 1 : -1) + Math.PI / 2; B.add(pp); }
        var tr = new T.Group(); [0, 1].forEach(function (c) { var car = new T.Group(); car.position.x = c * 19; car.add(mesh(new T.BoxGeometry(18, 3.6, 3), mat('trainW', { color: 0xf4f3ec, roughness: 0.35 }), 0, 2.4, 0)); car.add(mesh(new T.BoxGeometry(18.05, 0.7, 3.05), mat('trainG', { color: 0x16a35a }), 0, 1.2, 0)); car.add(mesh(new T.BoxGeometry(16, 1.2, 3.1), glassM, 0, 3, 0)); tr.add(car); });
        tr.position.set(-200, 0.2, 10.5); tr.userData.dyn = true; B.add(tr); SR.train = tr;
        mergeStatic(B, [tr, ttm]);
      } else if (kind === 'salon') {
        B.add(mesh(new T.BoxGeometry(14, 5, 9), wall, 0, 2.5, 4.5)); B.add(mesh(new T.BoxGeometry(12, 3.6, 0.15), glassM, 0, 2.2, -0.05));
        for (var ch = 0; ch < 3; ch++) { B.add(mesh(new T.BoxGeometry(1.1, 1.2, 1.1), mat('bchair', { color: 0xc0392b, roughness: 0.4 }), -4 + ch * 4, 0.9, 4)); B.add(mesh(new T.BoxGeometry(2, 1.6, 0.1), mat('mirror', { color: 0xdfe8ee, metalness: 0.9, roughness: 0.05 }), -4 + ch * 4, 2.6, 8.9)); }
        var pole = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 2.4, 16), new T.MeshStandardMaterial({ map: canvasTex(64, 128, function (g, w, h) { for (var y = -h; y < h * 2; y += 24) { g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 32); g.lineTo(w, y + 44); g.lineTo(0, y + 12); g.fill(); g.fillStyle = '#1f5fa0'; g.beginPath(); g.moveTo(0, y + 12); g.lineTo(w, y + 44); g.lineTo(w, y + 52); g.lineTo(0, y + 20); g.fill(); } }) })); pole.position.set(7.6, 2.4, -0.4); B.add(pole); SR.spin.push(pole);
        signBoard(B, title, 'CUTS · SHAVES · DREADS · BRAIDS', '#17181a', 0, 4.4, -0.2, 12);
      } else if (kind === 'bank') {
        towerBlock(0, 22, 26, 60, 20, B, 0, SR.towers); B.add(mesh(new T.BoxGeometry(30, 7, 10), glassM, 0, 3.5, 6)); for (var at = 0; at < 4; at++) B.add(mesh(new T.BoxGeometry(1.2, 2.2, 0.8), mat('atm', { color: 0x2b2f36, metalness: 0.4 }), -6 + at * 4, 1.1, 0.6)); signBoard(B, 'LAGOON BANK', title, '#1d5a3c', 0, 8.6, 0.8, 18);
      } else if (kind === 'hospital') {
        B.add(mesh(new T.BoxGeometry(56, 20, 20), mat('hosp', { color: 0xf7f7f5, roughness: 0.7 }), 0, 10, 12)); for (var hw = 0; hw < 14; hw++) [5, 10, 15].forEach(function (y) { B.add(mesh(new T.BoxGeometry(2.4, 2.4, 0.2), glassM, -24 + hw * 3.7, y, 1.9)); });
        var ec = mesh(new T.BoxGeometry(16, 0.5, 8), mat('hcan', { color: 0x1f5fa0 }), 0, 4.5, -1); B.add(ec); [-7, 7].forEach(function (x) { B.add(mesh(new T.CylinderGeometry(0.2, 0.2, 4.5, 8), frameM, x, 2.25, -4.6)); });
        var crossT = canvasTex(128, 128, function (g, w, h) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#d23b2f'; g.fillRect(w * 0.38, h * 0.12, w * 0.24, h * 0.76); g.fillRect(w * 0.12, h * 0.38, w * 0.76, h * 0.24); }); var cr = new T.Mesh(new T.PlaneGeometry(4, 4), new T.MeshBasicMaterial({ map: crossT })); cr.position.set(18, 17, 1.85); cr.rotation.y = Math.PI; B.add(cr);
        var amb = new T.Group(); amb.add(mesh(new T.BoxGeometry(6, 2.8, 2.4), mat('ambW', { color: 0xffffff, roughness: 0.4 }), 0, 1.8, 0)); amb.add(mesh(new T.BoxGeometry(6.02, 0.4, 2.42), mat('ambR', { color: 0xd23b2f }), 0, 1.6, 0)); var siren = new T.MeshBasicMaterial({ color: 0x3a6bff }); var sir = new T.Mesh(new T.BoxGeometry(1, 0.3, 0.6), siren); sir.position.set(1.5, 3.35, 0); amb.add(sir); SR.siren = siren; amb.position.set(-4, 0, -3); B.add(amb);
        signBoard(B, title, 'EMERGENCY · OUTPATIENTS · PHARMACY', '#1f5fa0', 0, 21.5, 1.85, 30);
      } else if (kind === 'dealer') {
        var showGlass = new T.MeshPhysicalMaterial({ color: 0xcfe3ee, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }); B.add(mesh(new T.BoxGeometry(34, 9, 18), showGlass, 0, 4.5, 8)); B.add(mesh(new T.BoxGeometry(35, 0.8, 19), mat('showroof', { color: 0x2b2f36, metalness: 0.5 }), 0, 9.3, 8)); B.add(mesh(new T.BoxGeometry(34, 0.2, 18), mat('showfloor', { color: 0xf4f4f4, metalness: 0.3, roughness: 0.15 }), 0, 0.1, 8));
        [[-11, 4, 0xc0392b], [0, 4, 0x17181a], [11, 4, 0xf4f3ec], [-5.5, 12, 0xd4af37], [5.5, 12, 0x2f6fa0]].forEach(function (cq) { var c3 = carModel(cq[2], 4.8); c3.position.set(cq[0], 0.2, cq[1]); c3.rotation.y = 0.5; B.add(c3); SR.spin.push(c3); });
        for (var fg = 0; fg < 8; fg++) { B.add(mesh(new T.CylinderGeometry(0.08, 0.08, 7, 6), frameM, -16 + fg * 4.5, 3.5, -2.5)); B.add(mesh(new T.PlaneGeometry(1.2, 3), mat('dflag' + fg % 2, { color: fg % 2 ? 0xc0392b : 0x17181a, side: T.DoubleSide }), -15.4 + fg * 4.5, 5.2, -2.5)); }
        signBoard(B, title, 'NEW · TOKUNBO · FINANCE AVAILABLE', '#17181a', 0, 10.6, -1.2, 22);
      } else if (kind === 'airport') {
        var tGlass = new T.MeshPhysicalMaterial({ color: 0x9fc3d6, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55 }); B.add(mesh(new T.BoxGeometry(90, 12, 26), tGlass, 0, 6, 14)); for (var mu = -44; mu <= 44; mu += 4) B.add(mesh(new T.BoxGeometry(0.3, 12, 0.3), frameM, mu, 6, 0.9));
        var wave = new T.PlaneGeometry(100, 34, 40, 1); var wp = wave.attributes.position; for (var wi = 0; wi < wp.count; wi++) wp.setZ(wi, Math.sin(wp.getX(wi) * 0.09) * 1.6); wave.computeVertexNormals(); var wr2 = new T.Mesh(wave, mat('wroof', { color: 0xeef1f3, metalness: 0.4, roughness: 0.35, side: T.DoubleSide })); wr2.rotation.x = -Math.PI / 2; wr2.position.set(0, 13.5, 13); B.add(wr2);
        var kc = mesh(new T.BoxGeometry(80, 0.5, 8), mat('kcan', { color: 0xdfe3e8, metalness: 0.4 }), 0, 6.2, -3); B.add(kc); for (var kp = -36; kp <= 36; kp += 12) B.add(mesh(new T.CylinderGeometry(0.3, 0.3, 6.2, 8), frameM, kp, 3.1, -6.6));
        B.add(mesh(new T.CylinderGeometry(2, 3, 34, 12), mat('twr', { color: 0xe9e5dc }), 52, 17, 30)); B.add(mesh(new T.CylinderGeometry(5.5, 4.5, 4, 12), glassM, 52, 36, 30)); B.add(mesh(new T.CylinderGeometry(6, 6, 0.6, 12), mat('twrc', { color: 0x2b2f36 }), 52, 38.3, 30));
        var tail = new T.Shape(); tail.moveTo(0, 0); tail.lineTo(9, 0); tail.lineTo(2, 11); tail.lineTo(-1, 11); tail.lineTo(0, 0); var tl2 = mesh(new T.ExtrudeGeometry(tail, { depth: 0.6, bevelEnabled: false }), mat('tailG', { color: 0x1d7a43 }), -30, 14, 40); tl2.rotation.y = Math.PI / 2; B.add(tl2);
        for (var tx3 = 0; tx3 < 5; tx3++) { var cab = carModel(tx3 % 2 ? 0xf2c200 : 0xf4f3ec); cab.position.set(-28 + tx3 * 9, 0, -9); B.add(cab); }
        signBoard(B, 'DEPARTURES', title, '#1d7a43', 0, 9.5, -0.2, 26);
      } else if (kind === 'refinery') {
        for (var tk = 0; tk < 6; tk++) { var tx2 = -40 + (tk % 3) * 22, tz2 = 20 + Math.floor(tk / 3) * 26; B.add(mesh(new T.CylinderGeometry(9, 9, 12, 32), mat('tank', { color: 0xe9ecef, metalness: 0.4, roughness: 0.4 }), tx2, 6, tz2)); B.add(mesh(new T.CylinderGeometry(9.1, 9.1, 0.6, 32), mat('tankband', { color: 0x1d7a43 }), tx2, 9, tz2)); }
        [[22, 20, 46], [30, 26, 38], [26, 34, 30]].forEach(function (q) { B.add(mesh(new T.CylinderGeometry(1.8, 2.2, q[2], 16), mat('column', { color: 0xc7ccd1, metalness: 0.6, roughness: 0.35 }), q[0], q[2] / 2, q[1])); for (var rg = 6; rg < q[2]; rg += 6) B.add(mesh(new T.TorusGeometry(2.4, 0.15, 6, 20).rotateX(Math.PI / 2), mat('rail2', { color: 0xf2b600 }), q[0], rg, q[1])); });
        for (var pp = 0; pp < 6; pp++) { var pipe = mesh(new T.CylinderGeometry(0.4, 0.4, 70, 10), mat('pipe' + pp % 3, { color: [0xc0392b, 0xf2b600, 0x9aa0a6][pp % 3], metalness: 0.5 }), 0, 2 + pp * 0.9, 6); pipe.rotation.z = Math.PI / 2; B.add(pipe); }
        B.add(mesh(new T.CylinderGeometry(0.8, 1.2, 50, 10), mat('flare', { color: 0x5a6068, metalness: 0.6 }), 46, 25, 46)); var ff = new T.Mesh(new T.ConeGeometry(2.4, 7, 12, 1, true).translate(0, 3.5, 0), emissiveMat(0xff8a2a, 0.9)); ff.position.set(46, 50, 46); B.add(ff); SR.flames.push(ff);
        signBoard(B, title, 'SAFETY FIRST · PPE BEYOND THIS POINT', '#1d7a43', -20, 6, -2, 20);
      }
      // Neighbouring shops and blocks along the street, a danfo and keke on the road, walkers on the kerb.
      var rs = rnd(hashStr(id) + 5); for (var nb = 0; nb < 18; nb++) { var side = nb % 2 ? 1 : -1, bx = side * (34 + Math.floor(nb / 2) * 15 + rs() * 4); if (kind === 'refinery') bx = side * (70 + Math.floor(nb / 2) * 15); towerBlock(bx, 10 + rs() * 8, 12 + rs() * 4, 6 + rs() * 14, 10 + rs() * 6, strG, 0, SR.towers); }
      for (var bb = 0; bb < 8; bb++) towerBlock(-150 + bb * 40 + rs() * 10, 120 + rs() * 40, 20 + rs() * 10, 20 + rs() * 50, 16 + rs() * 8, strG, 0, SR.towers);
      var d1 = danfo(); strG.add(d1); SR.movers.push({ o: d1, lane: -14.5, sp: 7, ph: 0 }); var k1 = carModel(0x2fa36b, 3); strG.add(k1); SR.movers.push({ o: k1, lane: -9.5, sp: -9, ph: 60 }); var c4 = carModel(0x2f6fa0); strG.add(c4); SR.movers.push({ o: c4, lane: -14.5, sp: 11, ph: 140 });
      var NW = 40, wr = rnd(77), wb = []; for (var w = 0; w < NW; w++) wb.push([wr() * 120 - 60, -4.5 + wr() * 2.6, (wr() < 0.5 ? 1 : -1) * (0.8 + wr() * 0.8), wr() * 6]);
      SR.walkers = squad(NW, function (i) { return [0xc0392b, 0x2f6fa0, 0xf2b600, 0x2fa36b, 0x8e44ad, 0xe67e22, 0xf4f3ec, 0x17181a][i % 8]; }, 1, strG); SR.walkBase = wb;
      SR.lights = []; [[-12, 7, -2], [12, 7, -2]].forEach(function (q) { var L0 = new T.PointLight(0xffd8a0, 0, 50, 1.4); L0.position.set(q[0], q[1], q[2]); strG.add(L0); SR.lights.push(L0); });
    }
    function streetFrame(t, night) {
      SR.movers.forEach(function (m) { var x = ((m.ph + t * m.sp) % 240 + 240) % 240 - 120; m.o.position.set(x, 0, m.lane); m.o.rotation.y = m.sp > 0 ? 0 : Math.PI; });
      if (SR.train) { var tc = (t % 60) / 60, tx = tc < 0.25 ? -150 + 140 * Math.sin(tc / 0.25 * Math.PI / 2) : tc < 0.6 ? -10 : -10 + 160 * Math.pow((tc - 0.6) / 0.4, 2); SR.train.position.x = tx; } if (SR.board) redrawAt(SR.board, t, 0.5);
      var W = SR.walkers, m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), one = new T.Vector3(1, 1, 1);
      for (var i = 0; i < W.n; i++) { var b = SR.walkBase[i], x = ((b[0] + t * b[2] + 60) % 120 + 120) % 120 - 60; e.set(0, b[2] > 0 ? 0 : Math.PI, 0); q.setFromEuler(e); m4.compose(v.set(x, 0.3 + Math.abs(Math.sin(t * 6 + b[3])) * 0.06, b[1]), q, one); W.body.setMatrixAt(i, m4); W.head.setMatrixAt(i, m4); }
      W.body.instanceMatrix.needsUpdate = W.head.instanceMatrix.needsUpdate = true;
      SR.flames.forEach(function (f, k) { f.scale.set(1 + Math.sin(t * 11 + k) * 0.1, 0.85 + Math.abs(Math.sin(t * 7 + k)) * 0.35, 1); });
      SR.smoke.forEach(function (p, k) { var u = (t * 0.25 + k / SR.smoke.length) % 1; p.position.set(-4.8 + Math.sin(k) * 0.6 * u, 2 + u * 7, 1 + Math.cos(k) * 0.5 * u); p.scale.setScalar(0.6 + u * 2.4); p.material.opacity = 0.35 * (1 - u); });
      SR.spin.forEach(function (o) { o.rotation.y = o.geometry ? t * 2 : 0.5 + Math.sin(t * 0.3) * 0.4; });
      if (SR.siren) SR.siren.color.set(Math.floor(t * 3) % 2 ? 0x3a6bff : 0xd23b2f);
      SR.towers.forEach(function (m) { m.emissiveIntensity = night ? 0.85 : 0; }); SR.lights.forEach(function (L0) { L0.intensity = night ? 30 : 0; });
    }
    // Interiors for a co-working hub, a gym and a mall atrium, built in the gallery's hall.
    /* ---------- Police divisions, polling units and hospitals (rules 19 places): rooms with a door people come and go by ---------- */
    // GL.flow: figures walking a loop of waypoints (from the door, to the desk, ... and out), pausing at each one.
    function flowFig(i, uni, capC) {
      var g;
      if (!uni && !LITE && root.LasgidiAvatar3D && root.LasgidiGames3D) g = avatarFor(root.LasgidiGames3D.stranger((sc.placeId || 'civic') + ':flow', i), 60 + i);
      else { g = person(60 + i, i % 2 === 1); if (uni) { var um = mat('uni' + uni, { color: uni, roughness: 0.6 }), cm = mat('cl' + (60 + i) % 8); g.traverse(function (o) { if (o.material === cm) o.material = um; }); }
        if (capC) { var cap = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.12, 12), mat('cap' + capC, { color: capC })); cap.position.y = 2.0; g.add(cap); } }
      galG.add(g); return g;
    }
    function flow(g, pts, speed, off, pause) {
      var segs = [], tot = 0; for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a: a, b: b, d: d, t0: tot }); tot += d / speed + (pause || 2); }
      GL.flow.push({ g: g, segs: segs, tot: tot, speed: speed, off: off || 0, pause: pause || 2 });
    }
    function flowFrame(t) {
      (GL.steam || []).forEach(function (sp, i) { var u = ((t * 0.25 + i / 8) % 1); sp.position.y = 1.1 + u * 3; sp.scale.setScalar((0.6 + u * 1.4) * (1 - u * 0.6)); });
      (GL.flow || []).forEach(function (f, i) {
        var tt = ((t + f.off) % f.tot + f.tot) % f.tot, s = f.segs[0];
        for (var k = 0; k < f.segs.length; k++) if (tt >= f.segs[k].t0) s = f.segs[k];
        var u = tt - s.t0, walk = s.d / f.speed, moving = u < walk, r = moving ? u / walk : 1;
        var x = s.a[0] + (s.b[0] - s.a[0]) * r, z = s.a[1] + (s.b[1] - s.a[1]) * r; f.g.position.set(x, 0.05, z);
        if (moving && s.d > 0.01) f.g.rotation.y = Math.atan2(-(s.b[1] - s.a[1]), s.b[0] - s.a[0]);
        var lg = f.g.userData.legs, sw = moving && !reduce ? Math.sin(t * 7 + i) * 0.45 : 0; if (lg) { lg[0].rotation[f.g.userData.axis || 'z'] = sw; lg[1].rotation[f.g.userData.axis || 'z'] = -sw; }
      });
      if (GL.wheel && !reduce) GL.wheel.rotation.y = t * 2.2; if (GL.slots) GL.slots.forEach(function (m, k) { m.color.setHSL(((t * 0.4 + k * 0.13) % 1), 0.9, 0.55); });
      var B = GL.board; if (B) { var k = JSON.stringify(sc.board || null); if (k !== B.key) { B.key = k; var c = B.tex.image, g = c.getContext('2d'); drawBoard(g, c.width, c.height, sc.board, B.kind); B.tex.needsUpdate = true; } }
    }
    function drawBoard(g, w, h, bd, kind) {
      g.fillStyle = kind === 'polling' ? '#0f3d2e' : '#14213d'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd23f'; g.font = '800 40px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText(bd ? bd.title : (kind === 'polling' ? 'LIVE RESULTS' : 'LIVE CASES'), 28, 44, w - 56);
      g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(28, 76, w - 56, 3);
      var rows = bd && bd.rows || [], max = 1; rows.forEach(function (r) { var n = +r[1]; if (n > max) max = n; });
      rows.slice(0, 7).forEach(function (r, i) {
        var y = 116 + i * 52; g.fillStyle = '#ffffff'; g.font = '600 28px system-ui, sans-serif'; g.fillText(r[0], 28, y, w * 0.6);
        if (kind === 'polling' && r[1] !== '') { g.fillStyle = r[2]; g.fillRect(w * 0.62, y - 14, Math.max(6, (w * 0.28) * (+r[1] / max)), 28); g.fillStyle = '#fff'; g.font = '800 28px system-ui, sans-serif'; g.textAlign = 'right'; g.fillText(r[1], w - 28, y); g.textAlign = 'left'; }
        else { g.fillStyle = r[2]; g.font = '800 26px system-ui, sans-serif'; g.textAlign = 'right'; g.fillText(r[1], w - 28, y, w * 0.36); g.textAlign = 'left'; }
      });
      if (bd && bd.foot) { g.fillStyle = '#d0453a'; g.fillRect(0, h - 56, w, 56); g.fillStyle = '#fff'; g.font = '800 28px system-ui, sans-serif'; g.fillText('● ' + bd.foot, 28, h - 28, w - 56); }
    }
    function poster(text, bg, fg, w, h, x, y, z, ry) {
      var tx = canvasTex(512, Math.round(512 * h / w), function (g, cw, ch) { g.fillStyle = bg; g.fillRect(0, 0, cw, ch); g.fillStyle = fg; g.font = '900 ' + Math.round(ch * 0.42) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2, cw - 24); });
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tx })); m.position.set(x, y, z); m.rotation.y = ry || 0; galG.add(m); return m;
    }
    function chair(x, z, ry, col) { var c = new T.Group(); c.position.set(x, 0, z); c.rotation.y = ry || 0; var m = mat('chair' + col, { color: col, roughness: 0.5 }); c.add(mesh(new T.BoxGeometry(1, 0.12, 1), m, 0, 0.9, 0)); c.add(mesh(new T.BoxGeometry(1, 1.1, 0.12), m, 0, 1.45, -0.45)); [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]].forEach(function (q) { c.add(mesh(new T.BoxGeometry(0.08, 0.9, 0.08), m, q[0], 0.45, q[1])); }); galG.add(c); return c; }
    function plant(x, z) { galG.add(mesh(new T.CylinderGeometry(0.7, 0.55, 1.2, 12), mat('pot', { color: 0xd8c3a5 }), x, 0.6, z)); for (var k = 0; k < 5; k++) { var lf = mesh(new T.ConeGeometry(0.25, 2.4, 5), mat('leaf', { color: 0x2f8f4a }), x + Math.cos(k * 1.3) * 0.25, 2.1, z + Math.sin(k * 1.3) * 0.25); lf.rotation.set(Math.sin(k * 1.3) * 0.35, 0, -Math.cos(k * 1.3) * 0.35); galG.add(lf); } }
    function sitter(i, x, z, ry, lie) { var p = flowFig(i); p.position.set(x, lie ? 1.25 : 0.05, z); p.rotation.y = ry || 0; if (lie) p.rotation.z = Math.PI / 2; else if (p.userData.legs) p.userData.legs.forEach(function (l) { l.rotation[p.userData.axis || 'z'] = -1.2; }); return p; }
    // The High Court, the city library, the grand hotel, the casino and the office floor (rules 19 places).
    function buildMore(kind, room, floor, RW, RD, RH, DX, DZ) {
      var wood = mat('mwood', { color: 0x6b3f22, roughness: 0.6 }), gold = mat('mgold2', { color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
      poster(String(sc.name || '').replace(/,.*/, '').toUpperCase(), { court: '#3a2a12', library: '#1f3b63', hotel: '#17181a', casino: '#5a0f1a', office: '#1f2a44', conference: '#0b3d2a', bowling: '#1a1030' }[kind], kind === 'hotel' || kind === 'casino' ? '#d4af37' : '#ffffff', 22, 1.8, 0, 8.4, RD / 2 - 0.3, Math.PI);
      if (kind === 'court') {
        room.material.color.set(0xe9dfc9); floor.material.color.set(0x8a6a4a);
        galG.add(mesh(new T.BoxGeometry(14, 3.2, 3), wood, 0, 1.6, 16)); galG.add(mesh(new T.BoxGeometry(14.4, 0.25, 3.4), wood, 0, 3.3, 16)); chair(0, 18, Math.PI, 0x7a1f1f); var judge = flowFig(140, 0x17181a); judge.position.set(0, 1.6, 17.6); judge.rotation.y = -Math.PI / 2;
        poster('COURT IN SESSION', '#7a1f1f', '#ffffff', 8, 1.2, 0, 6.4, RD / 2 - 0.35, Math.PI);
        var dock = new T.Group(); dock.position.set(-14, 0, 4); dock.add(mesh(new T.BoxGeometry(4, 1.6, 0.2), wood, 0, 0.8, -2)); dock.add(mesh(new T.BoxGeometry(0.2, 1.6, 4), wood, -2, 0.8, 0)); dock.add(mesh(new T.BoxGeometry(0.2, 1.6, 4), wood, 2, 0.8, 0)); galG.add(dock); var acc = flowFig(141); acc.position.set(-14, 0.05, 4.6); acc.rotation.y = -Math.PI / 2; poster('THE DOCK', '#3a2a12', '#fff', 3, 0.6, -14, 2.4, 2.1, Math.PI);
        var wb = new T.Group(); wb.position.set(12, 0, 10); wb.add(mesh(new T.BoxGeometry(3, 1.6, 0.2), wood, 0, 0.8, -1.5)); wb.add(mesh(new T.BoxGeometry(0.2, 1.6, 3), wood, -1.5, 0.8, 0)); galG.add(wb); var wit = flowFig(142); wit.position.set(12, 0.05, 10.4); wit.rotation.y = -Math.PI / 2; poster('WITNESS', '#3a2a12', '#fff', 3, 0.6, 12, 2.4, 8.3, Math.PI);
        [-6, 6].forEach(function (x, i) { galG.add(mesh(new T.BoxGeometry(8, 0.15, 2.4), wood, x, 2, 6)); chair(x - 2, 4.6, 0, 0x17181a); chair(x + 2, 4.6, 0, 0x17181a); var lw = flowFig(143 + i, 0x17181a); lw.position.set(x, 0.05, 3.8); lw.rotation.y = -Math.PI / 2; var wig = new T.Mesh(new T.SphereGeometry(0.18, 10, 8), mat('wig', { color: 0xf2efe6 })); wig.position.y = 1.95; lw.add(wig); });
        for (var gr = 0; gr < 4; gr++) { galG.add(mesh(new T.BoxGeometry(22, 0.3, 1.2), wood, 0, 0.9, -6 - gr * 3)); galG.add(mesh(new T.BoxGeometry(22, 1.4, 0.2), wood, 0, 1.6, -6.6 - gr * 3)); } sitter(146, -5, -6, -Math.PI / 2); sitter(147, 3, -9, -Math.PI / 2); sitter(148, 7, -6, -Math.PI / 2);
        poster('PUBLIC GALLERY', '#3a2a12', '#fff', 6, 1, -20, 5, -RD / 2 + 0.3, 0);
        flow(flowFig(150, 0x17181a), [[DX, DZ], [-6, 2], [6, 2], [DX, DZ]], 1.8, 0, 4); flow(flowFig(151), [[DX, DZ + 1], [-10, -14], [DX, DZ + 1]], 2, 6, 6); flow(flowFig(152, 0x1b2a49, 0x111111), [[DX, DZ - 1], [-14, 1.5], [DX, DZ - 1]], 1.6, 10, 8);
      } else if (kind === 'library') {
        room.material.color.set(0xf3ede0); floor.material.color.set(0x9a7a5a);
        for (var row = 0; row < 5; row++) for (var side = 0; side < 2; side++) { var sx = -24 + row * 5, sz = side ? 12 : -12; galG.add(mesh(new T.BoxGeometry(1.2, 6, 9), wood, sx, 3, sz)); for (var bk = 0; bk < 24; bk++) galG.add(mesh(new T.BoxGeometry(0.4, 0.9, 0.3 + (bk % 3) * 0.1), mat('lbk' + bk % 5, { color: [0xc0392b, 0x2f6fd0, 0x16a35a, 0xf2a516, 0x8e44ad][bk % 5] }), sx + 0.65, 0.8 + Math.floor(bk / 6) * 1.4, sz - 3.6 + (bk % 6) * 1.4)); }
        for (var tb = 0; tb < 4; tb++) { var tx = 4 + (tb % 2) * 10, tz = -6 + Math.floor(tb / 2) * 10; galG.add(mesh(new T.BoxGeometry(6, 0.2, 2.6), wood, tx, 2, tz)); galG.add(mesh(new T.CylinderGeometry(0.15, 0.2, 0.8, 8), mat('lamp', { color: 0x1f5a3c }), tx, 2.5, tz)); chair(tx - 1.5, tz - 2, 0, 0x5a3a22); chair(tx + 1.5, tz + 2, Math.PI, 0x5a3a22); }
        sitter(160, 2.5, -8, 0); sitter(161, 15.5, 6, Math.PI);
        for (var pc = 0; pc < 4; pc++) { galG.add(mesh(new T.BoxGeometry(2.4, 0.15, 1.4), mat('pcdesk', { color: 0xf4f3ec }), 22, 1.6, -14 + pc * 3.2)); galG.add(mesh(new T.BoxGeometry(0.1, 1, 1.4), mat('mon', { color: 0x2f6fd0 }), 22.8, 2.3, -14 + pc * 3.2)); }
        poster('COMPUTER ROOM', '#1f3b63', '#fff', 6, 1, 22, 5.4, -RD / 2 + 0.3, 0); poster('SILENCE PLEASE', '#ffffff', '#d0453a', 7, 1.2, -12, 6, RD / 2 - 0.35, Math.PI);
        galG.add(mesh(new T.BoxGeometry(6, 2.2, 2), mat('ldesk', { color: 0x1f3b63 }), -18, 1.1, 0)); var lib = flowFig(162, 0x8e44ad); lib.position.set(-18, 0.05, 1.6); lib.rotation.y = -Math.PI / 2;
        flow(flowFig(163), [[DX, DZ], [-18, -1.6], [-14, 10], [8, -3.6], [DX, DZ]], 1.6, 0, 5); flow(flowFig(164), [[DX, DZ + 1], [-9, -10], [21, -8], [DX, DZ + 1]], 1.6, 9, 6);
      } else if (kind === 'hotel') {
        room.material.color.set(0xf4ece0); floor.material.color.set(0xe8e2d6); floor.material.roughness = 0.1; floor.material.metalness = 0.2;
        galG.add(mesh(new T.BoxGeometry(10, 2.4, 2.4), mat('hdesk', { color: 0x2b1a10, roughness: 0.3 }), -12, 1.2, 14)); galG.add(mesh(new T.BoxGeometry(10.4, 0.15, 2.8), gold, -12, 2.47, 14)); poster('RECEPTION', '#17181a', '#d4af37', 6, 1, -12, 5.6, RD / 2 - 0.35, Math.PI); [-14, -10].forEach(function (x, i) { var rc = flowFig(170 + i, 0x17181a); rc.position.set(x, 0.05, 16); rc.rotation.y = -Math.PI / 2; });
        var ch = new T.Group(); ch.position.set(0, RH - 2.4, 0); ch.add(mesh(new T.CylinderGeometry(2.2, 0.8, 1.6, 16, 1, true), new T.MeshStandardMaterial({ color: 0xd4af37, emissive: 0x8a6a1a, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3, side: T.DoubleSide }), 0, 0, 0)); var crys = new T.MeshBasicMaterial({ color: 0xfff1c8 }); for (var cr = 0; cr < 24; cr++) { var a = cr / 24 * Math.PI * 2; ch.add(mesh(new T.SphereGeometry(0.16, 8, 6), crys, Math.cos(a) * 2.1, -0.9, Math.sin(a) * 2.1)); } galG.add(ch); var cl = new T.PointLight(0xffe2a8, 50, 40, 1.2); cl.position.set(0, RH - 3.4, 0); galG.add(cl);
        var pool = new T.Mesh(new T.BoxGeometry(16, 0.3, 8), new T.MeshPhysicalMaterial({ color: 0x3fb4e0, roughness: 0.05, clearcoat: 1 })); pool.position.set(12, 0.2, -10); galG.add(pool); galG.add(mesh(new T.BoxGeometry(17, 0.25, 9), mat('poolrim', { color: 0xf4f3ec }), 12, 0.1, -10)); poster('POOL', '#3fb4e0', '#fff', 4, 0.9, 12, 5, -RD / 2 + 0.3, 0);
        for (var lg = 0; lg < 4; lg++) { var lo = new T.Group(); lo.position.set(5 + lg * 4.5, 0, -3.5); lo.add(mesh(new T.BoxGeometry(1.4, 0.35, 3.2), mat('hlounger', { color: 0xf4f3ec }), 0, 0.5, 0)); galG.add(lo); } sitter(172, 9.5, -3.5, 0, true);
        [[-14, -8], [-6, -8]].forEach(function (q) { galG.add(mesh(new T.BoxGeometry(5, 1, 2), mat('sofa', { color: 0x7a1f3a }), q[0], 0.5, q[1])); galG.add(mesh(new T.BoxGeometry(5, 1.4, 0.5), mat('sofa', {}), q[0], 1.2, q[1] - 0.9)); }); sitter(173, -14, -7.6, Math.PI / 2); plant(-24, -14); plant(-2, 18); plant(24, 14);
        var trolley = new T.Group(); trolley.add(mesh(new T.BoxGeometry(1.8, 0.1, 1), gold, 0, 0.4, 0)); trolley.add(mesh(new T.BoxGeometry(0.08, 2.2, 0.08), gold, -0.85, 1.4, 0)); trolley.add(mesh(new T.BoxGeometry(0.08, 2.2, 0.08), gold, 0.85, 1.4, 0)); trolley.add(mesh(new T.BoxGeometry(1.8, 0.08, 0.08), gold, 0, 2.5, 0)); trolley.add(mesh(new T.BoxGeometry(1.2, 0.9, 0.6), mat('bag', { color: 0x2f6fd0 }), 0, 0.9, 0)); galG.add(trolley); trolley.userData.legs = null;
        // The grand floor: marble pillars, the piano bar, the champagne bar, the buffet, the spa tub and a suite cut away.
        var HS = [], marble = mat('marble', { color: 0xf2efe9, roughness: 0.18, metalness: 0.1 }), silver = mat('hsilver', { color: 0xd8dce2, metalness: 0.9, roughness: 0.2 }), black = mat('pianoblk', { color: 0x0d0d10, roughness: 0.15, metalness: 0.3 }), linen = mat('linen', { color: 0xffffff, roughness: 0.7 });
        [[-4, 6], [4, 6], [-4, -20], [4, -20]].forEach(function (q) { galG.add(mesh(new T.CylinderGeometry(0.75, 0.75, RH, 16), marble, q[0], RH / 2, q[1])); galG.add(mesh(new T.BoxGeometry(2, 0.5, 2), gold, q[0], 0.25, q[1])); galG.add(mesh(new T.BoxGeometry(2, 0.5, 2), gold, q[0], RH - 0.25, q[1])); });
        var pn = new T.Group(); pn.position.set(-24, 0, -16); pn.rotation.y = 0.5; pn.add(mesh(new T.BoxGeometry(3, 0.7, 4.2), black, 0, 1.8, 0)); var lid = mesh(new T.BoxGeometry(2.9, 0.08, 4), black, 0.9, 2.9, 0); lid.rotation.z = 0.7; pn.add(lid); pn.add(mesh(new T.BoxGeometry(3, 0.2, 0.6), mat('keys', { color: 0xf4f3ec }), 0, 2.1, 2.3));
        [[-1.2, -1.6], [1.2, -1.6], [0, 1.8]].forEach(function (q) { pn.add(mesh(new T.CylinderGeometry(0.12, 0.12, 1.5, 8), black, q[0], 0.75, q[1])); }); pn.add(mesh(new T.BoxGeometry(2, 0.3, 0.8), black, 0, 1, 3.4)); galG.add(pn);
        HS.push(sitter(178, -24 + Math.sin(0.5) * 3.4, -16 + Math.cos(0.5) * 3.4, Math.PI / 2 + 0.5 + Math.PI)); poster('PIANO BAR', '#17181a', '#d4af37', 6, 1, -RW / 2 + 0.3, 5.4, -14, Math.PI / 2);
        [[-19, -12], [-18, -17], [-20, -21]].forEach(function (q, i) { galG.add(mesh(new T.CylinderGeometry(0.9, 0.9, 0.1, 18), marble, q[0], 1.7, q[1])); galG.add(mesh(new T.CylinderGeometry(0.1, 0.2, 1.7, 8), gold, q[0], 0.85, q[1])); chair(q[0] + 1.3, q[1], -Math.PI / 2, 0x7a1f3a); if (i < 2) HS.push(sitter(179 + i, q[0] + 1.3, q[1], -Math.PI / 2)); });
        galG.add(mesh(new T.BoxGeometry(10, 2.2, 1.8), mat('cbar', { color: 0x17181a, roughness: 0.2 }), 22, 1.1, 8)); galG.add(mesh(new T.BoxGeometry(10.4, 0.15, 2.2), gold, 22, 2.27, 8)); galG.add(mesh(new T.BoxGeometry(10, 0.15, 1), gold, 22, 3.6, 11.2)); galG.add(mesh(new T.BoxGeometry(10, 0.15, 1), gold, 22, 5, 11.2));
        for (var bo = 0; bo < 18; bo++) galG.add(mesh(new T.CylinderGeometry(0.16, 0.18, 1.1, 8), mat('chbot' + bo % 3, { color: [0x1f4a2a, 0xd4af37, 0x2b1a10][bo % 3], roughness: 0.2, metalness: 0.4 }), 17.6 + (bo % 9) * 1.1, bo < 9 ? 4.2 : 5.6, 11.2));
        var ice = mesh(new T.CylinderGeometry(0.5, 0.4, 0.8, 14), silver, 20, 2.75, 8); galG.add(ice); galG.add(mesh(new T.CylinderGeometry(0.14, 0.16, 1.1, 8), mat('chbot1', {}), 20, 3.2, 8)); var flute = mat('flute', { color: 0xfff3c0, roughness: 0.05, transparent: true, opacity: 0.7 }); for (var fl = 0; fl < 5; fl++) galG.add(mesh(new T.CylinderGeometry(0.1, 0.03, 0.5, 8), flute, 22 + fl * 0.7, 2.6, 7.6));
        poster('CHAMPAGNE BAR', '#17181a', '#d4af37', 8, 1, 22, 7, RD / 2 - 0.35, Math.PI); var bt = flowFig(181, 0x17181a); bt.position.set(22, 0.05, 9.8); bt.rotation.y = Math.PI / 2; HS.push(bt); [18, 26].forEach(function (x, i) { galG.add(mesh(new T.CylinderGeometry(0.5, 0.4, 0.15, 12), gold, x, 1.6, 6)); galG.add(mesh(new T.CylinderGeometry(0.08, 0.08, 1.6, 6), gold, x, 0.8, 6)); HS.push(sitter(182 + i, x, 6, 0)); });
        galG.add(mesh(new T.BoxGeometry(12, 1.6, 2.2), linen, -14, 0.8, -20)); for (var cd = 0; cd < 5; cd++) { var dsh = mesh(new T.CylinderGeometry(0.7, 0.7, 1.6, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), silver, -18.8 + cd * 2.4, 1.75, -20); dsh.rotation.y = Math.PI / 2; galG.add(dsh); }
        poster('BUFFET', '#17181a', '#d4af37', 5, 0.9, -14, 4.6, -RD / 2 + 0.3, 0); var chef = flowFig(184, 0xffffff); chef.position.set(-14, 0.05, -21.8); chef.rotation.y = Math.PI / 2; var hat = new T.Mesh(new T.CylinderGeometry(0.22, 0.2, 0.45, 10), linen); hat.position.y = 2.05; chef.add(hat); HS.push(chef);
        galG.add(mesh(new T.CylinderGeometry(2.6, 2.6, 0.9, 28), marble, 25.5, 0.45, -18)); var tub = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 0.1, 28), new T.MeshPhysicalMaterial({ color: 0x6fd4e8, roughness: 0.05, clearcoat: 1, emissive: 0x1a5a6a, emissiveIntensity: 0.4 })); tub.position.set(25.5, 0.86, -18); galG.add(tub);
        var steamM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }); GL.steam = []; for (var stm = 0; stm < 8; stm++) { var sp = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), steamM); sp.position.set(25.5 + Math.cos(stm) * 1.2, 1.2, -18 + Math.sin(stm) * 1.2); galG.add(sp); GL.steam.push(sp); } HS.push(sitter(185, 24.3, -17.4, 0.3)); poster('SPA', '#3fb4e0', '#fff', 4, 0.9, 25.5, 4.6, -RD / 2 + 0.3, 0);
        galG.add(mesh(new T.BoxGeometry(0.3, 4, 9), marble, -19, 2, 18)); galG.add(mesh(new T.BoxGeometry(6, 0.8, 6.4), mat('bedframe', { color: 0x2b1a10 }), -25, 0.4, 17.5)); galG.add(mesh(new T.BoxGeometry(5.8, 0.6, 6.2), linen, -25, 1.1, 17.5)); galG.add(mesh(new T.BoxGeometry(6.2, 3.6, 0.4), mat('headbd', { color: 0x7a1f3a, roughness: 0.6 }), -25, 1.8, 21));
        [-26.5, -23.5].forEach(function (x) { galG.add(mesh(new T.BoxGeometry(2, 0.5, 1), linen, x, 1.6, 20)); }); galG.add(mesh(new T.BoxGeometry(5.9, 0.2, 3), mat('throw', { color: 0xd4af37, roughness: 0.6 }), -25, 1.45, 15.6)); poster('PRESIDENTIAL SUITE', '#17181a', '#d4af37', 8, 1, -25, 6.4, RD / 2 - 0.35, Math.PI);
        HS.forEach(function (f) { mergeStatic(f, [], true); }); // these guests never move: one draw per material each
        flow(trolley, [[DX + 1.5, DZ], [-12, 11.6], [20, 16], [DX + 1.5, DZ]], 1.5, 0, 4); flow(flowFig(174, 0x7a1f3a), [[DX, DZ + 1], [-11, 11.6], [20, 17], [DX, DZ + 1]], 1.5, 0, 4); flow(flowFig(175), [[DX, DZ - 1], [12, -5], [DX, DZ - 1]], 1.8, 7, 8); flow(flowFig(176), [[DX, DZ + 2], [-6, -6], [-12, 11.6], [DX, DZ + 2]], 1.6, 12, 6); flow(flowFig(177), [[DX, DZ - 2], [24, -2], [DX, DZ - 2]], 1.4, 18, 10);
      } else if (kind === 'bowling') {
        // Ten lanes with pins and a scoreboard over each pair, the ball return, a snack bar and arcade cabinets; glow lights on the gutters.
        room.material.color.set(0x1a1030); floor.material.color.set(0x2a2440);
        var lane = mat('lane', { color: 0xd9a35a, roughness: 0.15, metalness: 0.1 }), pinM = mat('pin', { color: 0xffffff, roughness: 0.3 }), glow = new T.MeshBasicMaterial({ color: 0x7b5cff });
        for (var ln = 0; ln < 10; ln++) { var lx = -22 + ln * 4.9; galG.add(mesh(new T.BoxGeometry(3.4, 0.12, 30), lane, lx, 0.08, 4)); [-1.9, 1.9].forEach(function (o) { galG.add(mesh(new T.BoxGeometry(0.3, 0.06, 30), glow, lx + o, 0.1, 4)); });
          for (var pr = 0; pr < 4; pr++) for (var pc = 0; pc <= pr; pc++) galG.add(mesh(new T.CylinderGeometry(0.11, 0.16, 0.7, 8), pinM, lx + (pc - pr / 2) * 0.45, 0.45, 17.5 + pr * 0.45));
          if (ln % 2 === 0) galG.add(mesh(new T.BoxGeometry(1, 0.8, 1.4), mat('ballret', { color: 0x2b2f36, metalness: 0.4 }), lx + 2.45, 0.4, -12)); }
        var sb = screenTex(1024, 256, function (g, w, h, t) { g.fillStyle = '#0d0820'; g.fillRect(0, 0, w, h); g.font = '800 40px system-ui'; for (var k = 0; k < 5; k++) { g.fillStyle = ['#7ee787', '#ffd23f', '#ff7b72', '#79c0ff', '#d2a8ff'][k]; g.fillText('LANE ' + (k * 2 + 1) + '–' + (k * 2 + 2), 20 + k * 200, 70); g.fillStyle = '#fff'; g.fillText(String(60 + ((Math.floor(t / 4) * 7 + k * 13) % 90)), 40 + k * 200, 150); g.fillText(String(50 + ((Math.floor(t / 4) * 5 + k * 17) % 90)), 40 + k * 200, 210); } });
        var sbm = new T.Mesh(new T.PlaneGeometry(40, 10), new T.MeshBasicMaterial({ map: sb })); sbm.position.set(0, 6.6, RD / 2 - 0.3); sbm.rotation.y = Math.PI; galG.add(sbm); GL.screenTex = sb; redrawAt(sb, 0, 1);
        galG.add(mesh(new T.BoxGeometry(12, 2.2, 1.8), mat('snackbar', { color: 0xc0392b }), -18, 1.1, -19)); poster('SNACK BAR', '#c0392b', '#fff', 6, 1, -18, 4.2, -RD / 2 + 0.3, 0); var cook = flowFig(195, 0xffffff); cook.position.set(-18, 0.05, -20.6); cook.rotation.y = Math.PI / 2;
        for (var ar = 0; ar < 4; ar++) { galG.add(mesh(new T.BoxGeometry(1.6, 3, 1.4), mat('arcade' + ar % 2, { color: ar % 2 ? 0x2f6fa0 : 0x8e44ad }), 10 + ar * 2.4, 1.5, -20.6)); galG.add(mesh(new T.PlaneGeometry(1.2, 1), new T.MeshBasicMaterial({ color: [0x7ee787, 0xffd23f, 0xff7b72, 0x79c0ff][ar] })).translateX(10 + ar * 2.4).translateY(2.2).translateZ(-19.85)); }
        poster('ARCADE', '#8e44ad', '#fff', 5, 1, 14, 4.6, -RD / 2 + 0.3, 0);
        for (var bw = 0; bw < 6; bw++) { var bf = flowFig(196 + bw); bf.position.set(-22 + bw * 9.8, 0.05, -10); bf.rotation.y = -Math.PI / 2; }
        flow(flowFig(203), [[DX, DZ], [-18, -16], [DX, DZ]], 1.6, 0, 5); flow(flowFig(204), [[DX, DZ + 1], [12, -17], [DX, DZ + 1]], 1.6, 6, 6);
      } else if (kind === 'conference') {
        // The plenary hall: a stage with a podium and a big screen, flags, and tiered rows of delegates.
        room.material.color.set(0xe9e4da); floor.material.color.set(0x6a1f2a);
        galG.add(mesh(new T.BoxGeometry(34, 1.2, 8), wood, 0, 0.6, 17)); galG.add(mesh(new T.BoxGeometry(34.4, 0.15, 8.4), gold, 0, 1.25, 17));
        galG.add(mesh(new T.BoxGeometry(2, 2.2, 1.4), wood, 0, 2.3, 15)); galG.add(mesh(new T.CylinderGeometry(0.04, 0.04, 0.8, 6), frameM, 0, 3.7, 14.6)); var spk = flowFig(190, 0x17181a); spk.position.set(0, 1.25, 16.4); spk.rotation.y = -Math.PI / 2;
        galG.add(mesh(new T.BoxGeometry(14, 0.15, 2), mat('ctable', { color: 0xf4f3ec }), -10, 2.4, 18.6)); [-14, -10, -6].forEach(function (x, i) { chair(x, 20, Math.PI, 0x17181a); }); galG.add(mesh(new T.BoxGeometry(14, 0.15, 2), mat('ctable', {}), 10, 2.4, 18.6)); [6, 10, 14].forEach(function (x) { chair(x, 20, Math.PI, 0x17181a); });
        var scr = screenTex(1024, 512, function (g, w, h, t) { var gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0b3d2a'); gr.addColorStop(1, '#127a4f'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 72px system-ui'; g.textAlign = 'center'; g.fillText(/^ph_/.test(sc.placeId || '') ? 'GARDEN CITY SUMMIT' : 'CAPITAL SUMMIT', w / 2, 200); g.font = '600 40px system-ui'; g.fillText(['Trade and jobs', 'Power for all', 'Youth and tech', 'Roads and rail'][Math.floor(t / 6) % 4], w / 2, 290); g.fillStyle = '#d4af37'; g.fillRect(w / 2 - 160, 330, 320, 6); });
        var sm = new T.Mesh(new T.PlaneGeometry(13, 6.5), new T.MeshBasicMaterial({ map: scr })); sm.position.set(0, 4.6, RD / 2 - 0.3); sm.rotation.y = Math.PI; galG.add(sm); GL.screenTex = scr; redrawAt(scr, 0, 1);
        var flagT = canvasTex(96, 64, function (g, w, h) { g.fillStyle = '#008751'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(w / 3, 0, w / 3, h); }), flagM = new T.MeshStandardMaterial({ map: flagT, side: T.DoubleSide, roughness: 0.8 });
        [-15, -12, 12, 15].forEach(function (x) { galG.add(mesh(new T.CylinderGeometry(0.06, 0.06, 5, 6), gold, x, 3.7, 20.4)); var fm = new T.Mesh(new T.PlaneGeometry(1.6, 1.1), flagM); fm.position.set(x + 0.8, 5.4, 20.4); galG.add(fm); });
        var NA = 72, aud = squad(NA, function (i) { return [0x17181a, 0xf4f3ec, 0x1f3b63, 0x0b3d2a, 0x7a1f3a, 0xd4af37][i % 6]; }, 1, galG), m4 = new T.Matrix4();
        for (var rw = 0; rw < 6; rw++) { var y = rw * 0.5, z = 8 - rw * 4; galG.add(mesh(new T.BoxGeometry(44, y + 0.01 || 0.01, 4), mat('ctier', { color: 0x5a1a24 }), 0, y / 2, z)); galG.add(mesh(new T.BoxGeometry(40, 0.15, 0.9), wood, 0, y + 1.5, z + 1.2));
          for (var se = 0; se < 12; se++) { var k = rw * 12 + se; m4.makeTranslation(-18 + se * 3.3 + (rw % 2) * 0.8, y - 0.35, z - 0.4); aud.body.setMatrixAt(k, m4); aud.head.setMatrixAt(k, m4); } }
        aud.body.instanceMatrix.needsUpdate = aud.head.instanceMatrix.needsUpdate = true; poster('DELEGATES ONLY', '#0b3d2a', '#fff', 6, 1, -20, 5, -RD / 2 + 0.3, 0); poster('EXPO HALL', '#d4af37', '#17181a', 5, 1, 20, 5, -RD / 2 + 0.3, 0);
        flow(flowFig(191, 0x0b3d2a), [[DX, DZ], [-22, 10], [-22, -14], [DX, DZ]], 1.6, 0, 5); flow(flowFig(192, 0x17181a), [[DX, DZ + 1], [22, 12], [DX, DZ + 1]], 1.4, 8, 6);
      } else if (kind === 'casino') {
        room.material.color.set(0x2a0d14); floor.material.color.set(0x5a0f1a);
        var dome = new T.Mesh(new T.SphereGeometry(10, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat('cdome', { color: 0xd4af37, metalness: 0.9, roughness: 0.2, side: T.BackSide })); dome.position.set(0, RH - 1.5, 0); dome.scale.y = 0.25; galG.add(dome);
        var rt = new T.Group(); rt.position.set(0, 0, 4); rt.add(mesh(new T.BoxGeometry(9, 1.8, 4.5), mat('felt', { color: 0x0f5a32, roughness: 0.9 }), 0, 0.9, 0)); var wheel = new T.Mesh(new T.CylinderGeometry(1.4, 1.4, 0.3, 37), new T.MeshStandardMaterial({ map: canvasTex(256, 256, function (g, w, h) { for (var k = 0; k < 37; k++) { g.fillStyle = k === 0 ? '#16a35a' : k % 2 ? '#c0392b' : '#17181a'; g.beginPath(); g.moveTo(w / 2, h / 2); g.arc(w / 2, h / 2, w / 2, k / 37 * 6.283, (k + 1) / 37 * 6.283); g.fill(); } g.fillStyle = '#d4af37'; g.beginPath(); g.arc(w / 2, h / 2, w / 6, 0, 6.3); g.fill(); }), metalness: 0.3, roughness: 0.4 })); wheel.position.set(-3, 1.95, 0); rt.add(wheel); GL.wheel = wheel; galG.add(rt);
        var crp = flowFig(180, 0x17181a); crp.position.set(-3, 0.05, 6.6); crp.rotation.y = -Math.PI / 2; poster('ROULETTE', '#5a0f1a', '#d4af37', 5, 0.9, 0, 4.4, 6.4, Math.PI);
        [-14, 14].forEach(function (x, i) { var bj = new T.Group(); bj.position.set(x, 0, 6); var top = new T.Mesh(new T.CylinderGeometry(3.2, 3.2, 0.3, 24, 1, false, 0, Math.PI), mat('felt', {})); top.position.y = 1.8; bj.add(top); bj.add(mesh(new T.BoxGeometry(6.4, 1.6, 0.3), mat('bjb', { color: 0x2b1a10 }), 0, 0.8, 0)); for (var cd = 0; cd < 3; cd++) bj.add(mesh(new T.BoxGeometry(0.5, 0.02, 0.7), mat('card', { color: 0xffffff }), -1 + cd, 1.97, -1.5)); galG.add(bj); var dl = flowFig(181 + i, 0x17181a); dl.position.set(x, 0.05, 6.8); dl.rotation.y = -Math.PI / 2; poster('BLACKJACK', '#5a0f1a', '#d4af37', 4, 0.8, x, 4.2, 6.5, Math.PI); });
        GL.slots = []; for (var sl = 0; sl < 12; sl++) { var sx = -24 + sl * 4.4, sz = -16; var sm = new T.MeshBasicMaterial({ color: 0xffd23f }); galG.add(mesh(new T.BoxGeometry(2.4, 4, 2), mat('slotb', { color: 0x8a1a2a, metalness: 0.4 }), sx, 2, sz)); var sc0 = new T.Mesh(new T.PlaneGeometry(1.8, 1.2), sm); sc0.position.set(sx, 2.8, sz + 1.01); galG.add(sc0); GL.slots.push(sm); galG.add(mesh(new T.CylinderGeometry(0.4, 0.4, 0.15, 12), mat('slotstool', { color: 0x17181a }), sx, 1.2, sz + 2)); }
        sitter(183, -15.2, -14, -Math.PI / 2); sitter(184, 1.2, -14, -Math.PI / 2); sitter(185, 14.4, -14, -Math.PI / 2); poster('SLOTS', '#d4af37', '#5a0f1a', 6, 1.1, 0, 6.4, -RD / 2 + 0.3, 0); poster('18+ · PLAY RESPONSIBLY', '#17181a', '#ffffff', 9, 1, -20, 6, RD / 2 - 0.35, Math.PI);
        flow(flowFig(186), [[DX, DZ], [-3, 1.2], [-14, 3.5], [-10, -13], [DX, DZ]], 1.6, 0, 5); flow(flowFig(187), [[DX, DZ + 1], [14, 3.5], [6, -13], [DX, DZ + 1]], 1.6, 8, 6); flow(flowFig(188), [[DX, DZ - 1], [3, 2], [20, -13], [DX, DZ - 1]], 1.5, 15, 7); flow(flowFig(189), [[DX, DZ + 2], [-20, -12], [-3, 1.5], [DX, DZ + 2]], 1.7, 22, 6);
      } else { // the office floor
        room.material.color.set(0xeef1f4); floor.material.color.set(0x8f969e);
        for (var d = 0; d < 12; d++) { var dx = -18 + (d % 4) * 9, dz = -10 + Math.floor(d / 4) * 7; galG.add(mesh(new T.BoxGeometry(5, 0.15, 2.2), mat('odesk', { color: 0xf4f3ec, roughness: 0.4 }), dx, 1.5, dz)); galG.add(mesh(new T.BoxGeometry(1.4, 0.9, 0.08), mat('mon', { color: 0x2f6fd0 }), dx, 2.3, dz + 0.6)); chair(dx, dz - 1.4, 0, 0x17181a); if (d % 3 === 0) sitter(190 + d, dx, dz - 1.3, Math.PI / 2); }
        var mr = new T.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.3, roughness: 0.05 }); galG.add(mesh(new T.BoxGeometry(12, RH - 2, 0.1), mr, 18, (RH - 2) / 2, 10)); galG.add(mesh(new T.BoxGeometry(0.1, RH - 2, 10), mr, 12, (RH - 2) / 2, 15));
        galG.add(mesh(new T.BoxGeometry(8, 0.2, 3), wood, 19, 1.8, 16)); for (var mc = 0; mc < 4; mc++) chair(16 + mc * 2, 14, 0, 0x2f6fd0); poster('MEETING ROOM', '#1f2a44', '#fff', 6, 1, 18, 7.5, RD / 2 - 0.35, Math.PI);
        galG.add(mesh(new T.BoxGeometry(RW - 2, 6, 0.1), mat('owin', { color: 0x9fd0ff, emissive: 0x6aa8e0, emissiveIntensity: 0.4, transparent: true, opacity: 0.6 }), 0, 4, -RD / 2 + 0.3));
        galG.add(mesh(new T.BoxGeometry(6, 2.2, 2), mat('ordesk', { color: 0x1f2a44 }), -18, 1.1, 14)); var rc2 = flowFig(200, 0x1f2a44); rc2.position.set(-18, 0.05, 15.6); rc2.rotation.y = -Math.PI / 2; plant(-24, 18); plant(24, -18);
        flow(flowFig(201, 0x1f2a44), [[DX, DZ], [-18, 12.4], [16, 12], [DX, DZ]], 1.8, 0, 4); flow(flowFig(202), [[DX, DZ + 1], [-9, -2], [9, -2], [DX, DZ + 1]], 1.8, 6, 5); flow(flowFig(203), [[DX, DZ - 1], [0, 5], [18, 14], [DX, DZ - 1]], 1.6, 11, 6);
        if (sc.placeId === 'office_tower') { // Marina Towers: the ground-floor lobby (blue carpet, glass curtain wall, the big blue sign, green sofas, reception, the canteen)
          floor.material.color.set(0x56657a);
          poster('MARINA TOWERS', '#1f4fa0', '#ffffff', 16, 2.4, 8, RH - 2.2, -RD / 2 + 0.45, 0); poster('MARINA TOWERS', '#1f2a44', '#ffffff', 5, 0.9, -18, 3.6, 13.2, Math.PI);
          for (var mu = -RW / 2 + 2; mu < RW / 2 - 1; mu += 4) galG.add(mesh(new T.BoxGeometry(0.25, 6.2, 0.25), mat('mull', { color: 0x2b2f36, metalness: 0.6 }), mu, 4, -RD / 2 + 0.4));
          [[-21, -6], [-21, 1]].forEach(function (q, i) { var so = new T.Group(); so.position.set(q[0], 0, q[1]); so.rotation.y = Math.PI / 2; var gm = mat('sofaG', { color: 0x14532d, roughness: 0.7 }); so.add(mesh(new T.BoxGeometry(5, 0.9, 1.8), gm, 0, 0.6, 0)); so.add(mesh(new T.BoxGeometry(5, 1.2, 0.5), gm, 0, 1.4, -0.75)); so.add(mesh(new T.BoxGeometry(0.5, 1.1, 1.8), gm, -2.5, 0.9, 0)); so.add(mesh(new T.BoxGeometry(0.5, 1.1, 1.8), gm, 2.5, 0.9, 0)); galG.add(so); if (i === 0) sitter(205, q[0] + 0.4, q[1] + 1, Math.PI / 2); });
          plant(-24, -12); plant(-24, 8); plant(-12, 18); plant(24, 8);
          galG.add(mesh(new T.BoxGeometry(1.4, 0.9, 0.1), mat('mon', {}), -18, 2.6, 13.6));
          // the canteen at the far side: counter, a menu board, little round tables
          galG.add(mesh(new T.BoxGeometry(10, 2.2, 1.6), mat('cant', { color: 0xc8a165, roughness: 0.6 }), 20, 1.1, -14)); poster('CANTEEN · RICE · BEANS · CHICKEN', '#b91c1c', '#ffffff', 10, 1, 20, 4.8, -16.5, 0);
          [[14, -6], [20, -6], [26, -6]].forEach(function (q) { galG.add(mesh(new T.CylinderGeometry(1, 1, 0.12, 18), mat('ctab', { color: 0xf4f3ec }), q[0], 1.5, q[1])); galG.add(mesh(new T.CylinderGeometry(0.12, 0.12, 1.5, 8), mat('frame', {}), q[0], 0.75, q[1])); chair(q[0] - 1.4, q[1], Math.PI / 2, 0xe2463f); chair(q[0] + 1.4, q[1], -Math.PI / 2, 0xe2463f); });
          sitter(206, 18.6, -6, Math.PI / 2); flow(flowFig(207, 0xffffff), [[20, -12.6], [24, -12.6], [20, -12.6]], 0.6, 0, 3);
          flow(flowFig(208), [[DX, DZ], [-20, 4], [20, -10], [DX, DZ]], 1.7, 3, 5); flow(flowFig(209), [[DX, DZ - 1], [-17, 11.5], [DX, DZ - 1]], 1.5, 9, 6);
        }
      }
    }
    function buildCivic(kind, room, floor, RW, RD, RH) {
      GL.flow = []; var DX = -RW / 2 + 0.6, DZ = 0; // the door, in the left wall
      [[-14, -8], [14, 8]].forEach(function (q) { var L1 = new T.PointLight(kind === 'casino' ? 0xffd9a0 : 0xffffff, kind === 'casino' ? 40 : 55, 50, 1.1); L1.position.set(q[0], RH - 1.5, q[1]); galG.add(L1); });
      galG.add(mesh(new T.BoxGeometry(0.3, 6.4, 5.2), mat('doorframe', { color: 0x5a3a22 }), -RW / 2 + 0.2, 3.2, DZ));
      var day = !sc.night, dm = new T.Mesh(new T.PlaneGeometry(4.4, 6), new T.MeshBasicMaterial({ color: day ? 0xfff3d6 : 0x1c2433 })); dm.position.set(-RW / 2 + 0.36, 3, DZ); dm.rotation.y = Math.PI / 2; galG.add(dm);
      poster(kind === 'polling' ? 'WAY IN' : kind === 'casino' ? 'CASINO' : 'ENTRANCE', '#16a35a', '#fff', 4, 0.9, -RW / 2 + 0.4, 6.8, DZ, Math.PI / 2);
      var board = canvasTex(1024, 512, function () {}); GL.board = { tex: board, key: '', kind: kind };
      if (kind === 'police' || kind === 'polling') { var bm = new T.Mesh(new T.PlaneGeometry(12, 6), new T.MeshBasicMaterial({ map: board })); bm.position.set(0, 4, RD / 2 - 0.3); bm.rotation.y = Math.PI; galG.add(bm); galG.add(mesh(new T.BoxGeometry(12.6, 6.6, 0.3), mat('bframe', { color: 0x17181a }), 0, 4, RD / 2 - 0.1));
        poster(String(sc.name || '').toUpperCase(), kind === 'polling' ? '#16a35a' : '#1f2a44', '#ffffff', 22, 1.8, 0, 8.4, RD / 2 - 0.3, Math.PI); }
      if (/^(court|library|hotel|casino|office|conference|bowling)$/.test(kind)) buildMore(kind, room, floor, RW, RD, RH, DX, DZ);
      else if (kind === 'police') {
        room.material.color.set(0xd6dde6); floor.material.color.set(0x9aa3ad);
        galG.add(mesh(new T.BoxGeometry(3, 2.4, 14), mat('pdesk', { color: 0x1f2a44, roughness: 0.5 }), -6, 1.2, 4)); galG.add(mesh(new T.BoxGeometry(3.4, 0.2, 14.4), mat('pdtop', { color: 0xd9d4c7 }), -6, 2.5, 4));
        galG.add(mesh(new T.BoxGeometry(0.15, 1, 1.4), mat('mon', { color: 0x2f6fd0, roughness: 0.2 }), -5.6, 3.1, 1)); galG.add(mesh(new T.BoxGeometry(1.2, 0.05, 1.6), mat('book', { color: 0x7a1f1f }), -6, 2.63, 6));
        poster('ENQUIRIES', '#1f2a44', '#ffffff', 6, 1.2, -6, 6.4, 4, Math.PI / 2 * 0 + Math.PI / 2);
        // the cell: bars, a bench and the people inside
        var CX = 17; galG.add(mesh(new T.BoxGeometry(RW / 2 - CX, 0.1, 16), mat('cellfl', { color: 0x6f747b }), CX + (RW / 2 - CX) / 2, 0.06, -6));
        for (var b = 0; b < 26; b++) galG.add(mesh(new T.CylinderGeometry(0.07, 0.07, RH, 6), mat('bar', { color: 0x30343a, metalness: 0.8, roughness: 0.3 }), CX, RH / 2, -14 + b * 0.62));
        galG.add(mesh(new T.BoxGeometry(RW / 2 - CX, 0.2, 0.2), mat('bar', {}), CX + (RW / 2 - CX) / 2, 7, 2)); galG.add(mesh(new T.BoxGeometry(0.2, RH, 0.2), mat('bar', {}), CX + (RW / 2 - CX) / 2, RH / 2, 2));
        for (var cb = 0; cb < 2; cb++) galG.add(mesh(new T.BoxGeometry(1.2, 0.8, 7), mat('cbench', { color: 0x8a6f4d }), RW / 2 - 1.5, 0.4, -10 + cb * 8));
        poster('THE CELL', '#d0453a', '#fff', 5, 1, CX - 0.2, 8.6, -6, -Math.PI / 2);
        sitter(1, RW / 2 - 1.8, -11, Math.PI); sitter(2, RW / 2 - 1.8, -3, Math.PI); var st0 = flowFig(3); st0.position.set(CX + 1.2, 0.05, -8); st0.rotation.y = Math.PI;
        // the waiting bench by the door
        galG.add(mesh(new T.BoxGeometry(10, 0.25, 1.3), mat('wbench', { color: 0x8a6f4d }), -20, 0.9, -12)); galG.add(mesh(new T.BoxGeometry(10, 1.6, 0.2), mat('wbench', {}), -20, 1.8, -12.6));
        sitter(4, -22, -11.9, Math.PI / 2); sitter(5, -18, -11.9, Math.PI / 2);
        poster('THE POLICE IS YOUR FRIEND', '#1f2a44', '#ffd23f', 12, 1.6, -20, 6, -RD / 2 + 0.3, 0); poster('BAIL IS FREE', '#ffffff', '#d0453a', 6, 1.4, -18, 4, RD / 2 - 0.3, Math.PI);
        var desk1 = flowFig(10, 0x1b2a49, 0x111111); desk1.position.set(-8.5, 0.05, 2); desk1.rotation.y = 0; var desk2 = flowFig(11, 0x1b2a49, 0x111111); desk2.position.set(-8.5, 0.05, 7);
        // in and out: complainants to the desk and the bench, an officer walking a suspect to the cell, someone bailed walking out
        flow(flowFig(20), [[DX, DZ], [-3.6, 2], [-16, -10], [DX, DZ]], 2.2, 0, 3);
        flow(flowFig(21), [[DX, DZ + 1], [-3.6, 6], [-3.6, 3], [DX, DZ + 1]], 2, 9, 4);
        var off = flowFig(22, 0x1b2a49, 0x111111), sus = flowFig(23); flow(off, [[DX, DZ - 1], [2, -2], [CX - 1.5, 1], [2, -2]], 1.8, 3, 3); flow(sus, [[DX, DZ - 2], [2, -3], [CX - 1.5, 0], [2, -3]], 1.8, 3, 3);
        flow(flowFig(24), [[CX - 1.5, 3.5], [0, 10], [DX, DZ + 2]], 2, 14, 2);
        flow(flowFig(25), [[DX, DZ], [-12, 12], [-3.6, 9], [DX, DZ]], 2.4, 20, 3);
      } else if (kind === 'polling') {
        room.material.color.set(0xefe6d2); floor.material.color.set(0xa89f8d);
        galG.add(mesh(new T.BoxGeometry(8, 0.2, 3), mat('adesk', { color: 0xf4f3ec }), -14, 2, 6)); [[-17.5, 4.8], [-10.5, 4.8], [-17.5, 7.2], [-10.5, 7.2]].forEach(function (q) { galG.add(mesh(new T.BoxGeometry(0.15, 2, 0.15), mat('leg', { color: 0x555555 }), q[0], 1, q[1])); });
        galG.add(mesh(new T.BoxGeometry(0.8, 0.25, 0.5), mat('bvas', { color: 0x17181a, roughness: 0.3 }), -14, 2.25, 5.6)); poster('ACCREDITATION', '#16a35a', '#fff', 7, 1.2, -14, 5.2, 7.6, Math.PI);
        var o1 = flowFig(30, 0x2f8f4a), o2 = flowFig(31, 0x2f8f4a); o1.position.set(-15.5, 0.05, 8.4); o1.rotation.y = -Math.PI / 2; o2.position.set(-12.5, 0.05, 8.4); o2.rotation.y = -Math.PI / 2;
        // voting cubicles: three-sided screens on small tables
        for (var cu = 0; cu < 4; cu++) { var cx2 = 6 + cu * 4.5, cz = 14; galG.add(mesh(new T.BoxGeometry(3, 0.12, 2), mat('ctab', { color: 0xb08a5a }), cx2, 2, cz)); var sc2 = mat('cub', { color: 0x9fc8e8, roughness: 0.8 });
          galG.add(mesh(new T.BoxGeometry(3, 2, 0.08), sc2, cx2, 3, cz + 1)); galG.add(mesh(new T.BoxGeometry(0.08, 2, 2), sc2, cx2 - 1.5, 3, cz)); galG.add(mesh(new T.BoxGeometry(0.08, 2, 2), sc2, cx2 + 1.5, 3, cz)); [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]].forEach(function (q) { galG.add(mesh(new T.BoxGeometry(0.1, 2, 0.1), mat('leg', {}), cx2 + q[0], 1, cz + q[1])); }); }
        poster('VOTING CUBICLES', '#ffffff', '#1f3b63', 9, 1.2, 12.75, 5, 15.3, Math.PI);
        // the ballot box: see-through, on a table, papers inside
        galG.add(mesh(new T.BoxGeometry(3, 0.15, 2), mat('btab', { color: 0xb08a5a }), 2, 2, 2)); var bx = mesh(new T.BoxGeometry(1.6, 1.4, 1.2), new T.MeshStandardMaterial({ color: 0xdff1ff, transparent: true, opacity: 0.4, roughness: 0.05 }), 2, 2.8, 2); galG.add(bx);
        for (var pp = 0; pp < 9; pp++) { var pap = mesh(new T.BoxGeometry(0.5, 0.02, 0.35), mat('paper', { color: 0xffffff }), 1.5 + (pp % 3) * 0.4, 2.2 + Math.floor(pp / 3) * 0.08, 1.7 + (pp % 2) * 0.4); pap.rotation.y = pp; galG.add(pap); }
        galG.add(mesh(new T.BoxGeometry(1.7, 0.08, 1.3), mat('bxlid', { color: 0x16a35a }), 2, 3.52, 2)); poster('BALLOT BOX', '#16a35a', '#fff', 3, 0.7, 2, 4.4, 2, Math.PI);
        poster('YOUR VOTE IS YOUR VOICE', '#16a35a', '#ffffff', 14, 1.8, -12, 7, -RD / 2 + 0.3, 0);
        poster('THE QUEUE', '#f2a516', '#17181a', 5, 1, -24, 5.6, -RD / 2 + 0.3, 0);
        // the queue: people standing in a line from the door, shuffling forward; voters going round desk, cubicle, box and out
        for (var q = 0; q < 7; q++) { var qp = flowFig(40 + q); flow(qp, [[-26 + q * 1.4, -8], [-25.6 + q * 1.4, -8]], 0.2, q * 1.7, 6); }
        for (var v = 0; v < 4; v++) flow(flowFig(50 + v), [[-17, -8], [-14, 4], [6 + v * 4.5, 12.6], [2, 0.6], [DX, DZ + 1.5 - v]], 2, v * 7, 3);
      } else { // a hospital: reception, the nurses' station, the doctor, the pharmacy, a ward and a waiting area; a zobo kiosk
        room.material.color.set(0xeef1f3); floor.material.color.set(0xc9ced3);
        galG.add(mesh(new T.BoxGeometry(10, 2.4, 3), mat('nst', { color: 0x1f2a44 }), 4, 1.2, 10)); galG.add(mesh(new T.BoxGeometry(10.4, 0.2, 3.4), mat('nstt', { color: 0xf4f3ec }), 4, 2.5, 10));
        galG.add(mesh(new T.BoxGeometry(1.4, 1, 0.12), mat('mon', { color: 0x2f6fd0 }), 3, 3.1, 9.6)); poster("NURSES' STATION", '#1f2a44', '#ffffff', 8, 1.4, 4, 6.6, 12, Math.PI);
        var n1 = flowFig(70, 0xf4f3ec, 0xffffff); n1.position.set(4, 0.05, 12.2); n1.rotation.y = -Math.PI / 2;
        // the ward: three beds along the left wall, two patients
        for (var bd = 0; bd < 3; bd++) { var bz = -16 + bd * 6; galG.add(mesh(new T.BoxGeometry(5, 0.8, 2.6), mat('bedf', { color: 0xd8c3a5 }), -24, 0.8, bz)); galG.add(mesh(new T.BoxGeometry(4.6, 0.4, 2.4), mat('sheet', { color: 0xd9674a }), -23.8, 1.35, bz)); galG.add(mesh(new T.BoxGeometry(1, 0.35, 1.8), mat('pillow', { color: 0xffffff }), -26, 1.6, bz));
          galG.add(mesh(new T.CylinderGeometry(0.04, 0.04, 3.5, 6), mat('drip', { color: 0xbbbbbb, metalness: 0.7 }), -21, 1.75, bz + 1.5)); galG.add(mesh(new T.BoxGeometry(0.4, 0.6, 0.15), mat('drbag', { color: 0xdff1ff, transparent: true, opacity: 0.7 }), -21, 3.3, bz + 1.5)); if (bd < 2) sitter(71 + bd, -24, bz, 0, true); }
        poster('WARD', '#2f8f4a', '#fff', 4, 1, -24, 6.4, -RD / 2 + 0.3, 0);
        // the pharmacy window: a counter and shelves of boxes
        galG.add(mesh(new T.BoxGeometry(8, 2.2, 2), mat('ph', { color: 0xf4f3ec }), 20, 1.1, 16)); for (var sh = 0; sh < 3; sh++) for (var bx2 = 0; bx2 < 10; bx2++) galG.add(mesh(new T.BoxGeometry(0.6, 0.6, 0.5), mat('phb' + (bx2 % 4), { color: [0x2f6fd0, 0xd0453a, 0x16a35a, 0xf2a516][bx2 % 4] }), 16.5 + bx2 * 0.75, 3 + sh * 1, RD / 2 - 0.8));
        poster('PHARMACY', '#16a35a', '#fff', 6, 1.2, 20, 7, RD / 2 - 0.3, Math.PI); var ph1 = flowFig(73, 0xf4f3ec); ph1.position.set(20, 0.05, 18.4); ph1.rotation.y = -Math.PI / 2;
        // the doctor's corner
        galG.add(mesh(new T.BoxGeometry(4, 0.15, 2.4), mat('ddesk', { color: 0x8a6f4d }), 20, 2, -12)); chair(20, -14, 0, 0x17181a); chair(20, -9.8, Math.PI, 0x2f6fd0); var doc = flowFig(74, 0xffffff); doc.position.set(20, 0.05, -14.6); doc.rotation.y = Math.PI / 2;
        poster('DOCTOR', '#2f6fd0', '#fff', 4, 1, 20, 6, -RD / 2 + 0.3, 0);
        // waiting area: rows of red chairs
        for (var wc = 0; wc < 10; wc++) chair(-10 + (wc % 5) * 1.6, -6 + Math.floor(wc / 5) * 3, Math.PI, 0xd0453a); sitter(75, -8.4, -6, -Math.PI / 2); sitter(76, -5.2, -3, -Math.PI / 2);
        poster('WAITING AREA', '#d0453a', '#fff', 6, 1.2, -6.8, 6, -RD / 2 + 0.3, 0);
        // the zobo kiosk
        galG.add(mesh(new T.BoxGeometry(5, 3, 3), mat('kiosk', { color: 0xe0a21a }), RW / 2 - 4, 1.5, 2)); galG.add(mesh(new T.BoxGeometry(5.6, 0.4, 3.6), mat('kroof', { color: 0xd0453a }), RW / 2 - 4, 4.6, 2)); poster('MAMA ZEE · ZOBO', '#d0453a', '#fff', 5, 0.9, RW / 2 - 4, 3.8, 0.45, Math.PI);
        plant(-RW / 2 + 3, 16); plant(RW / 2 - 3, -18); plant(-4, 18);
        poster(String(sc.name || 'HOSPITAL').toUpperCase(), '#d0453a', '#ffffff', 16, 2.2, 0, 8.4, RD / 2 - 0.3, Math.PI);
        flow(flowFig(80), [[DX, DZ], [2, 7.6], [-8, -7.6], [20, -8.6], [20, 14], [DX, DZ]], 2, 0, 3);
        flow(flowFig(81), [[DX, DZ + 1], [5, 7.6], [-6, -4], [DX, DZ + 1]], 2.2, 8, 4);
        flow(flowFig(82, 0xf4f3ec, 0xffffff), [[0, 8], [-21.5, -14], [-21.5, -8], [0, 8]], 1.6, 3, 4);
        var str = new T.Group(); str.add(mesh(new T.BoxGeometry(4.2, 0.2, 1.4), mat('strt', { color: 0xf4f3ec }), 0, 1.6, 0)); str.add(mesh(new T.BoxGeometry(4.2, 0.3, 1.4), mat('strs', { color: 0x2f6fd0 }), 0, 1.85, 0)); galG.add(str); str.userData.legs = null; flow(str, [[DX + 2, DZ - 3], [-12, 4], [DX + 2, DZ - 3]], 2.4, 12, 2);
        flow(flowFig(83), [[DX, DZ - 1], [RW / 2 - 6, 0.2], [DX, DZ - 1]], 2.2, 16, 5);
      }
    }
    function buildHall() {
      wipe(galG); var kind = sc.kind, r = rnd(hashStr(sc.placeId || 'hall')); GL = { spots: [], screens: [], flow: [] };
      var RW = 60, RD = 46, RH = kind === 'cinema' ? 18 : kind === 'auditorium' ? 16 : 10;
      var room = new T.Mesh(new T.BoxGeometry(RW, RH, RD), new T.MeshStandardMaterial({ color: kind === 'gym' ? 0x2b2f36 : 0xf2f0eb, roughness: 0.85, side: T.BackSide })); room.position.set(0, RH / 2, 0); galG.add(room);
      var floor = new T.Mesh(new T.PlaneGeometry(RW, RD).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: kind === 'gym' ? 0x1c1c1f : kind === 'cinema' ? 0xe9e5dc : 0xb08a5a, roughness: kind === 'cinema' ? 0.12 : 0.6, metalness: kind === 'cinema' ? 0.2 : 0 })); floor.position.y = 0.02; floor.receiveShadow = true; galG.add(floor);
      var title = String(sc.name || '').toUpperCase(), tt = canvasTex(1024, 128, function (g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = kind === 'gym' ? '#f2b600' : '#17181a'; g.font = '800 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(title, w / 2, h / 2, w - 40); });
      var tm = new T.Mesh(new T.PlaneGeometry(24, 3), new T.MeshBasicMaterial({ map: tt, transparent: true })); tm.position.set(0, RH - 2, RD / 2 - 0.25); tm.rotation.y = Math.PI; galG.add(tm);
      if (kind === 'tech') {
        for (var d = 0; d < 12; d++) { var dx = -18 + (d % 4) * 12, dz = -6 + Math.floor(d / 4) * 8; galG.add(mesh(new T.BoxGeometry(6, 0.15, 2.2), mat('desk', { color: 0xf4f3ec, roughness: 0.4 }), dx, 1.5, dz)); [-1.6, 1.6].forEach(function (mxx) { var scr = new T.MeshBasicMaterial({ color: 0x2f6fd0 }); var mon = new T.Mesh(new T.BoxGeometry(1.4, 0.9, 0.08), scr); mon.position.set(dx + mxx, 2.3, dz + 0.6); galG.add(mon); GL.screens.push(scr); galG.add(mesh(new T.BoxGeometry(0.8, 1.0, 0.8), mat('chair', { color: 0x17181a }), dx + mxx, 0.5, dz - 1.4)); }); }
        for (var bb = 0; bb < 4; bb++) galG.add(mesh(new T.SphereGeometry(1.1, 14, 10), mat('bean' + bb, { color: [0xf2b600, 0xc0392b, 0x2fa36b, 0x8e44ad][bb], roughness: 0.8 }), -22 + bb * 3, 0.7, 18));
        var wb2 = new T.Mesh(new T.PlaneGeometry(12, 4), new T.MeshBasicMaterial({ map: canvasTex(512, 160, function (g, w, h) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2f6fd0'; g.lineWidth = 4; g.strokeRect(20, 20, 140, 60); g.strokeRect(220, 40, 120, 80); g.beginPath(); g.moveTo(160, 50); g.lineTo(220, 80); g.stroke(); g.fillStyle = '#c0392b'; g.font = '700 30px system-ui'; g.fillText('SHIP IT 🚀', 360, 140); }) })); wb2.position.set(-RW / 2 + 0.2, 4, 0); wb2.rotation.y = Math.PI / 2; galG.add(wb2);
      } else if (kind === 'gym') {
        for (var tr = 0; tr < 6; tr++) { var tg = new T.Group(); tg.position.set(-20 + tr * 4, 0, 16); tg.add(mesh(new T.BoxGeometry(1.6, 0.4, 4), mat('tread', { color: 0x17181a }), 0, 0.3, 0)); tg.add(mesh(new T.BoxGeometry(1.4, 1.4, 0.2), mat('treadc', { color: 0x3a3f46 }), 0, 1.4, -1.8)); galG.add(tg); }
        for (var rk = 0; rk < 3; rk++) { var rx = 6 + rk * 7; [-1.2, 1.2].forEach(function (s2) { galG.add(mesh(new T.BoxGeometry(0.3, 3.6, 0.3), mat('rack', { color: 0xc0392b, metalness: 0.5 }), rx + s2, 1.8, 6)); }); var bar = mesh(new T.CylinderGeometry(0.06, 0.06, 4, 8), mat('bar', { color: 0xc7ccd1, metalness: 0.9 }), rx, 2.4, 6); bar.rotation.z = Math.PI / 2; galG.add(bar); [-1.8, 1.8].forEach(function (s3) { var pl = mesh(new T.CylinderGeometry(0.7, 0.7, 0.2, 18), mat('plate', { color: 0x17181a }), rx + s3, 2.4, 6); pl.rotation.z = Math.PI / 2; galG.add(pl); }); }
        for (var db2 = 0; db2 < 10; db2++) galG.add(mesh(new T.CapsuleGeometry(0.15, 0.6, 4, 8).rotateZ(Math.PI / 2), mat('dumb', { color: 0x3a3f46, metalness: 0.6 }), -20 + db2 * 1.2, 0.8, -10));
        var mir = mesh(new T.BoxGeometry(RW - 4, 5, 0.1), mat('mirror', { color: 0xdfe8ee, metalness: 0.95, roughness: 0.04 }), 0, 3.5, -RD / 2 + 0.3); galG.add(mir);
        if (/^pulse_/.test(sc.placeId || '')) { // a Pulse Fitness & Pilates branch: a studio, a smoothie bar, showers and the red sign
          room.material.color.set(0xd9dbde); floor.material.color.set(0x22252b);
          var mats = [0x8e44ad, 0x16a085, 0xe84393, 0x2f6fd0, 0xf39c12, 0x27ae60];
          for (var mt = 0; mt < 6; mt++) galG.add(mesh(new T.BoxGeometry(2, 0.06, 4.4), mat('pmat' + mt, { color: mats[mt], roughness: 0.9 }), 14 + (mt % 3) * 3, 0.05, -12 + Math.floor(mt / 3) * 6));
          galG.add(mesh(new T.BoxGeometry(12, 0.1, 14), mat('studio', { color: 0xc9a27a, roughness: 0.5 }), 17, 0.03, -9)); // the studio's wooden floor
          for (var rf = 0; rf < 3; rf++) { var ref = new T.Group(); ref.position.set(-24, 0, -14 + rf * 5); ref.add(mesh(new T.BoxGeometry(2.4, 0.5, 4.6), mat('reformer', { color: 0xf4f3ec, roughness: 0.5 }), 0, 0.5, 0)); ref.add(mesh(new T.BoxGeometry(2.2, 0.15, 2), mat('rcar', { color: 0x2f6fd0 }), 0, 0.85, -0.6)); galG.add(ref); } // Pilates reformers
          var bar2 = mesh(new T.BoxGeometry(3, 2.2, 12), mat('smoothie', { color: 0x16a34a, roughness: 0.4 }), -RW / 2 + 5, 1.1, 10); galG.add(bar2);
          galG.add(mesh(new T.BoxGeometry(3.4, 0.2, 12.4), mat('smoothieTop', { color: 0xf4f3ec, roughness: 0.3 }), -RW / 2 + 5, 2.3, 10));
          for (var st2 = 0; st2 < 4; st2++) galG.add(mesh(new T.CylinderGeometry(0.5, 0.5, 0.2, 14), mat('stool', { color: 0x17181a }), -RW / 2 + 7.6, 1.6, 6 + st2 * 2.6));
          for (var cup = 0; cup < 5; cup++) galG.add(mesh(new T.CylinderGeometry(0.22, 0.16, 0.6, 10), mat('cup' + (cup % 3), { color: [0xff8fab, 0xffd166, 0x95d5b2][cup % 3] }), -RW / 2 + 4.6, 2.7, 6 + cup * 2));
          var shw = new T.MeshStandardMaterial({ color: 0xcfe8f2, transparent: true, opacity: 0.35, roughness: 0.05 });
          for (var sh2 = 0; sh2 < 3; sh2++) { galG.add(mesh(new T.BoxGeometry(4, 6, 0.1), shw, -RW / 2 + 5 + sh2 * 4.4, 3, RD / 2 - 8)); galG.add(mesh(new T.BoxGeometry(0.1, 6, 4), shw, -RW / 2 + 3 + sh2 * 4.4, 3, RD / 2 - 6)); }
          var pt = canvasTex(512, 128, function (g, w, h) { g.fillStyle = '#d0453a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 72px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PULSE', w / 2, h / 2 + 4); });
          var ps = new T.Mesh(new T.PlaneGeometry(10, 2.5), new T.MeshBasicMaterial({ map: pt })); ps.position.set(14, RH - 2.4, -RD / 2 + 0.4); galG.add(ps);
          for (var pl2 = 0; pl2 < 3; pl2++) { galG.add(mesh(new T.CylinderGeometry(0.7, 0.55, 1.2, 12), mat('pot', { color: 0xd8c3a5 }), RW / 2 - 4, 0.6, -16 + pl2 * 14)); galG.add(mesh(new T.ConeGeometry(0.9, 2.6, 7), mat('leaf', { color: 0x2f8f4a }), RW / 2 - 4, 2.4, -16 + pl2 * 14)); } // potted plants
        }
      } else if (kind === 'auditorium') {
        tm.visible = false; buildAuditorium(room, floor, RW, RD, RH);
      } else if (/^(police|polling|hospital|court|library|hotel|casino|office|conference|bowling)$/.test(kind)) {
        tm.visible = false; buildCivic(kind, room, floor, RW, RD, RH);
        mergeStatic(galG, [room, floor].concat((GL.flow || []).map(function (f) { return f.g; }), GL.wheel ? [GL.wheel] : [], GL.steam || []));
      } else {
        // A mall atrium: shopfronts on two levels, a gallery walkway, an escalator and the cinema's NOW SHOWING screen.
        var SHOPS = ['SAVEMART', 'FASHION HUB', 'PHONES & MORE', 'CRISPY CHICK', 'BOOKS', 'GAMES', 'BEAUTY', 'SPORTS'];
        [-1, 1].forEach(function (sd) { for (var sh = 0; sh < 4; sh++) [0, 1].forEach(function (lv) { var z = -15 + sh * 10, y = lv * 8, n2 = SHOPS[(sh * 2 + lv + (sd > 0 ? 3 : 0)) % SHOPS.length]; galG.add(mesh(new T.BoxGeometry(0.2, 5, 8), glassM, sd * (RW / 2 - 6), y + 2.6, z)); var sgm = new T.MeshStandardMaterial({ map: signTex(n2, null, ['#c0392b', '#1f5fa0', '#17181a', '#d4af37'][sh % 4]), emissive: 0xffffff, emissiveIntensity: 0.15 }); sgm.emissiveMap = sgm.map; var sg2 = new T.Mesh(new T.PlaneGeometry(7, 1.3), sgm); sg2.position.set(sd * (RW / 2 - 5.8), y + 5.8, z); sg2.rotation.y = -sd * Math.PI / 2; galG.add(sg2); }); });
        [-1, 1].forEach(function (sd) { galG.add(mesh(new T.BoxGeometry(6, 0.4, RD), mat('gallery2', { color: 0xf4f3ec }), sd * (RW / 2 - 3), 8, 0)); galG.add(mesh(new T.BoxGeometry(0.1, 1.1, RD), mat('rail', { color: 0xbfd7e0, transparent: true, opacity: 0.45 }), sd * (RW / 2 - 6), 8.75, 0)); });
        var esc = mesh(new T.BoxGeometry(3, 0.6, 16), mat('escal', { color: 0xc7ccd1, metalness: 0.7 }), -8, 4, 2); esc.rotation.x = -Math.atan2(8, 16); galG.add(esc);
        var nowT = screenTex(1024, 512, function (g, w, h, t) { var gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1a1024'); gr.addColorStop(1, '#3a1a5a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23f'; g.font = '900 64px system-ui'; g.textAlign = 'center'; g.fillText('NOW SHOWING', w / 2, 90); var films = ['EKO NIGHTS', 'THE DANFO JOB', 'LAGOS LOVE', 'JAPA'][Math.floor(t / 4) % 4]; g.fillStyle = '#fff'; g.font = '900 110px system-ui'; g.fillText(films, w / 2, 280, w - 60); g.font = '700 40px system-ui'; g.fillText('13:00 · 16:00 · 19:30 · 22:00', w / 2, 400); });
        var nm = new T.Mesh(new T.PlaneGeometry(20, 10), new T.MeshBasicMaterial({ map: nowT })); nm.position.set(0, 10, RD / 2 - 0.3); nm.rotation.y = Math.PI; galG.add(nm); GL.screenTex = nowT;
        galG.add(mesh(new T.CylinderGeometry(4, 4.4, 0.8, 32), mat('basin', { color: 0xc9ccd1 }), 0, 0.4, -2)); palm(0, -2, 6, 0.1);
      }
      GL.amb = new T.PointLight(0xffffff, 60, 90, 1); GL.amb.position.set(0, RH - 1, 0); galG.add(GL.amb);
      var NW = kind === 'auditorium' ? 1 : kind === 'cinema' ? 70 : /^(police|polling|hospital|court|library|hotel|casino|office|conference|bowling)$/.test(kind) ? 1 : 24, wr = rnd(53), wb = []; for (var w = 0; w < NW; w++) wb.push([wr() * 6.28, 6 + wr() * 12, (wr() < 0.5 ? 1 : -1) * (0.02 + wr() * 0.03), wr() * 6]);
      GL.walkers = squad(NW, function (i) { return [0x17181a, 0xf4f3ec, 0xc0392b, 0x2f6fa0, 0x8e44ad, 0xe67e22][i % 6]; }, 1, galG); GL.walkBase = wb;
      if (!/^(police|polling|hospital|court|library|hotel|casino|office|conference|bowling)$/.test(kind)) mergeStatic(galG, [room, floor]); // civic rooms merged in their own branch
    }

    /* ---------- weather: rain streaks (and lightning in a storm), harmattan dust ---------- */
    var WX = new T.Group(); S3.add(WX); var RAIN_N = LITE ? 700 : 1600, rainPos = new Float32Array(RAIN_N * 6), rainSeed = new Float32Array(RAIN_N * 3), wr0 = rnd(97);
    for (var ri = 0; ri < RAIN_N; ri++) { rainSeed[ri * 3] = wr0() * 140 - 70; rainSeed[ri * 3 + 1] = wr0() * 50; rainSeed[ri * 3 + 2] = wr0() * 140 - 70; }
    var rainGeo = new T.BufferGeometry(); rainGeo.setAttribute('position', new T.BufferAttribute(rainPos, 3));
    var rainLines = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0xdfe6ee, transparent: true, opacity: 0.7, depthWrite: false })); rainLines.frustumCulled = false; WX.add(rainLines);
    var DUST_N = LITE ? 300 : 700, dustGeo = new T.BufferGeometry(), dustPos = new Float32Array(DUST_N * 3); for (var di2 = 0; di2 < DUST_N; di2++) { dustPos[di2 * 3] = wr0() * 140 - 70; dustPos[di2 * 3 + 1] = wr0() * 30; dustPos[di2 * 3 + 2] = wr0() * 140 - 70; }
    dustGeo.setAttribute('position', new T.BufferAttribute(dustPos, 3)); var dust = new T.Points(dustGeo, new T.PointsMaterial({ color: 0xe8d6a8, size: 0.6, transparent: true, opacity: 0.7, depthWrite: false })); dust.frustumCulled = false; WX.add(dust);
    var flashUntil = 0, SKY0 = { top: skyU.top.value.clone(), mid: skyU.mid.value.clone(), hor: skyU.hor.value.clone() }, SKYW = { rain: [0x7d8a96, 0x9aa6b0, 0xb5bcc2], storm: [0x4a5560, 0x6b7680, 0x8a939a], harmattan: [0xcbb994, 0xdccba4, 0xe8d9b4] }, skyTmp = new T.Color();
    function skyWeather(w) { var tgt = SKYW[w]; ['top', 'mid', 'hor'].forEach(function (k, i) { skyTmp.copy(SKY0[k]); if (tgt) skyTmp.set(tgt[i]); skyU[k].value.lerp(skyTmp, 0.05); }); }
    function night0() { return !!sc.night; }
    function weatherFrame(t, now) {
      var indoor = (CLUB && !ROOF) || GAL, w = sc.weather, rainy = !indoor && (w === 'rain' || w === 'storm'), dusty = !indoor && w === 'harmattan';
      skyWeather(indoor ? null : w); if (rainy && !night0()) { hemi.intensity = Math.min(hemi.intensity, w === 'storm' ? 0.45 : 0.6); sun.intensity = Math.min(sun.intensity, 0.5); }
      WX.position.set(orbit.tx, 0, orbit.tz); rainLines.visible = rainy; dust.visible = dusty;
      if (rainy) { var n = w === 'storm' ? RAIN_N : Math.round(RAIN_N * 0.6), fall = w === 'storm' ? 38 : 26, slant = w === 'storm' ? 6 : 2; for (var i = 0; i < RAIN_N; i++) { var o = i * 6; if (i >= n) { rainPos[o + 1] = rainPos[o + 4] = -100; continue; } var y = 50 - ((rainSeed[i * 3 + 1] + t * fall) % 50), x = rainSeed[i * 3] + slant * (y / 50), z = rainSeed[i * 3 + 2]; rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x - slant * 0.04; rainPos[o + 4] = y - 1.8; rainPos[o + 5] = z; } rainGeo.attributes.position.needsUpdate = true; }
      if (dusty) { for (var k = 0; k < DUST_N; k++) { dustPos[k * 3] = ((dustPos[k * 3] + 70 + 0.03) % 140) - 70; dustPos[k * 3 + 1] = (dustPos[k * 3 + 1] + Math.sin(t + k) * 0.01 + 30) % 30; } dustGeo.attributes.position.needsUpdate = true; }
      if (w === 'storm' && !indoor && !reduce) { if (now > flashUntil + 4000 && Math.random() < 0.004) flashUntil = now + 160; if (now < flashUntil) { hemi.intensity = 2.4; hemi.color.set(0xdfe8ff); } }
    }

    /* ---------- the beach rave after dark: a DJ booth and LED screen, a light-up dance floor, speaker stacks,
       a suya grill with glowing coals, cabanas and a banner. Beaches only, from 20:00. ---------- */
    var raveG = new T.Group(); raveG.visible = false; world.add(raveG); var RV = null;
    function buildRave() {
      if (RV) return; RV = { key: sc.name }; var X = -4, Z = -4;
      var NT = 6, tiles = new T.InstancedMesh(new T.BoxGeometry(2.2, 0.1, 2.2), new T.MeshBasicMaterial({ color: 0xffffff }), NT * NT), m4 = new T.Matrix4(), c = new T.Color();
      for (var i = 0; i < NT; i++) for (var j = 0; j < NT; j++) { m4.makeTranslation(X - 6.5 + i * 2.6, 0.2, Z - 6.5 + j * 2.6); tiles.setMatrixAt(i * NT + j, m4); tiles.setColorAt(i * NT + j, c.set(0x333333)); }
      raveG.add(tiles); RV.tiles = tiles; RV.NT = NT;
      var booth = new T.Group(); booth.position.set(X + 2, 0, Z + 11); booth.add(mesh(new T.BoxGeometry(7, 2.2, 2.4), mat('rvbooth', { color: 0x17181a }), 0, 1.1, 0)); booth.add(mesh(new T.BoxGeometry(2.4, 0.2, 1.2), mat('decks', { color: 0x444a52, metalness: 0.6 }), 0, 2.3, 0)); raveG.add(booth);
      var scr = new T.MeshBasicMaterial({ color: 0xff3fb4 }); var sm = new T.Mesh(new T.PlaneGeometry(12, 6.5), scr); sm.position.set(X + 2, 6.5, Z + 13.5); sm.rotation.y = Math.PI; raveG.add(sm); RV.screen = scr; raveG.add(mesh(new T.BoxGeometry(12.6, 7, 0.3), mat('rvframe', { color: 0x111111 }), X + 2, 6.5, Z + 13.8));
      var dj = root.LasgidiAvatar3D && root.LasgidiGames3D ? avatarFor(root.LasgidiGames3D.stranger('beachdj', 0), 110) : person(110, true); dj.position.set(X + 2, 0.1, Z + 12.4); dj.rotation.y = Math.PI / 2; raveG.add(dj); RV.dj = dj;
      [[-4, 11], [8, 11], [-9, 0], [10, 0]].forEach(function (q) { for (var k = 0; k < 2; k++) { var sp = mesh(new T.BoxGeometry(1.4, 2.4, 1.2), mat('spk', { color: 0x9b9fae, roughness: 0.4 }), X + q[0] + k * 1.5, 1.2, Z + q[1]); raveG.add(sp); [0.55, 1.65].forEach(function (y) { var cone = mesh(new T.CircleGeometry(0.42, 18), mat('cone', { color: 0x2b2d33 }), X + q[0] + k * 1.5, y, Z + q[1] + 0.61); raveG.add(cone); }); } });
      var bn = canvasTex(1024, 160, function (g, w, h) { g.fillStyle = '#c2185b'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 96px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(sc.name || 'Beach').replace(/,.*/, '').toUpperCase() + ' RAVE', w / 2, h / 2, w - 40); });
      [-5, 5].forEach(function (dx) { raveG.add(mesh(new T.CylinderGeometry(0.12, 0.12, 8, 8), mat('bnpole', { color: 0x17181a }), X - 12 + dx, 4, Z - 10)); }); var bm = new T.Mesh(new T.PlaneGeometry(10, 1.6), new T.MeshBasicMaterial({ map: bn, side: T.DoubleSide })); bm.position.set(X - 12, 7.4, Z - 10); bm.rotation.y = Math.PI; raveG.add(bm);
      var grill = new T.Group(); grill.position.set(X - 12, 0, Z - 6); grill.add(mesh(new T.BoxGeometry(4, 1.6, 1.6), mat('grill', { color: 0x3a2a1f }), 0, 0.8, 0)); var coal = new T.MeshBasicMaterial({ color: 0xff5a1a }); for (var s = 0; s < 8; s++) grill.add(mesh(new T.BoxGeometry(0.3, 0.12, 1.3), coal, -1.6 + s * 0.45, 1.68, 0)); RV.coal = coal; var gl = new T.PointLight(0xff6a2a, 20, 10, 1.6); gl.position.set(0, 2.4, 0); grill.add(gl); RV.grillLight = gl;
      var cook = root.LasgidiAvatar3D && root.LasgidiGames3D ? avatarFor(root.LasgidiGames3D.stranger('suya', 0), 111) : person(111, false); cook.position.set(0, 0.1, -1.6); cook.rotation.y = Math.PI / 2; grill.add(cook); raveG.add(grill);
      [[-14, 6], [-8, 9], [18, 6]].forEach(function (q, k) { var cb = new T.Group(); cb.position.set(X + q[0], 0, Z + q[1]); cb.add(mesh(new T.CylinderGeometry(0.1, 0.1, 4, 6), mat('cbpole', { color: 0x5a3a22 }), 0, 2, 0)); cb.add(mesh(new T.ConeGeometry(3, 1.4, 8), mat('cbtop' + k, { color: [0x1f8a7a, 0x8a5a3c, 0xc2185b][k] }), 0, 4.4, 0));
        [-1, 1].forEach(function (s2) { cb.add(mesh(new T.BoxGeometry(1, 0.35, 2.4), mat('lounger', { color: 0x5a7bd0 }), s2 * 1.4, 0.45, 0)); }); raveG.add(cb); });
      mergeStatic(raveG, [RV.dj]);
      RV.lights = []; [0xff3fb4, 0x3fd0ff, 0xffd23f].forEach(function (col, k) { var L0 = new T.PointLight(col, 40, 26, 1.4); L0.position.set(X - 4 + k * 6, 6, Z - 4); raveG.add(L0); RV.lights.push(L0); });
    }
    function raveFrame(t, on) {
      if (on && RV && RV.key !== sc.name) { wipe(raveG); RV = null; }
      if (on) buildRave(); raveG.visible = !!on; if (!on || !RV) return;
      var c = new T.Color(), A = new T.Color(0xff3fb4), B = new T.Color(0x3fd0ff), kick = Math.pow(Math.abs(Math.sin(t * 3.9)), 3);
      for (var i = 0; i < RV.NT; i++) for (var j = 0; j < RV.NT; j++) { c.copy(A).lerp(B, 0.5 + 0.5 * Math.sin(t * 2 + i * 0.7 + j * 0.4)).offsetHSL(((i + j) % 3) * 0.12, 0, 0).multiplyScalar(0.6 + 0.4 * kick); RV.tiles.setColorAt(i * RV.NT + j, c); }
      RV.tiles.instanceColor.needsUpdate = true; RV.screen.color.setHSL((t * 0.05) % 1, 0.8, 0.5 + 0.1 * kick); RV.coal.color.setHSL(0.04, 1, 0.45 + 0.1 * Math.sin(t * 9)); RV.grillLight.intensity = 16 + 6 * Math.sin(t * 9);
      RV.lights.forEach(function (L0, k) { L0.intensity = 25 + 30 * kick; L0.position.x = -4 - 4 + k * 6 + Math.sin(t + k) * 3; });
      var lg = RV.dj.userData.legs; RV.dj.position.y = 0.1 + kick * 0.1; if (lg && !reduce) { lg[0].rotation[RV.dj.userData.axis || 'z'] = Math.sin(t * 3.9) * 0.2; lg[1].rotation[RV.dj.userData.axis || 'z'] = -Math.sin(t * 3.9) * 0.2; }
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
      g.userData.legs = legs; return slimFigure(g);
    }
    function sprite(text, bg, fg, w) {
      var c = document.createElement('canvas'); c.width = 512; c.height = 96; var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
      var s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false })); s.renderOrder = 20; s.userData = { c: c, t: t, w: w || 6 }; label(s, text, bg, fg); return s;
    }
    function label(s, text, bg, fg) { var k = text + bg; if (s.userData.k === k) return; s.userData.k = k; var c = s.userData.c, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.font = '800 40px system-ui, sans-serif'; var tw = Math.min(c.width - 6, g.measureText(text).width + 40); g.fillStyle = bg; g.beginPath(); if (g.roundRect) g.roundRect((c.width - tw) / 2, 14, tw, 64, 32); else g.rect((c.width - tw) / 2, 14, tw, 64); g.fill(); g.fillStyle = fg || '#17181a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, 47); s.userData.t.needsUpdate = true; s.scale.set(s.userData.w, s.userData.w * 96 / 512, 1); }
    var signs = [], crowd = [], me = null, meTag = null, gem = null, bubble = null, bubbleAt = 0;
    // Strollers along the waterline: scenery, not tappable.
    var strollers = []; for (var si = 0; si < 10; si++) { var sp0 = !LITE && root.LasgidiAvatar3D && root.LasgidiGames3D ? avatarFor(root.LasgidiGames3D.stranger('stroller', si), 20 + si) : person(20 + si, si % 2 === 1); sp0.traverse(function (o) { o.userData.scenery = true; }); S3.add(sp0); strollers.push(sp0); }
    function syncSigns() {
      var acts = sc.acts || [];
      while (signs.length < Math.min(8, acts.length)) { var s = sprite('', '#fff'); world.add(s); signs.push(s); }
      signs.forEach(function (s, i) { var a = acts[i]; s.visible = !!a; if (!a) return; var q = SP()[i]; s.position.set(q[0], groundY(q[0], q[1]) + 4.2 + (i % 2) * 0.8, q[1]); label(s, a.icon + ' ' + a.short, a.off ? 'rgba(235,235,235,.85)' : '#ffffff', a.off ? '#6b7280' : '#17181a'); s.userData.act = i; });
    }
    // A person in their own look and outfit (the 3D avatar) when we know it, else the plain figure. Wrapped so it
    // faces +x like person(), with its legs swinging about x.
    function avatarFor(d, i) {
      if (d && !d.look && root.LasgidiGames3D && root.LasgidiAvatar3D) { var st0 = root.LasgidiGames3D.stranger((sc.placeId || 'yard') + ':' + (d.label || ''), i); d = Object.assign({}, d, { look: st0.look, outfit: st0.outfit }); } // strangers get a real 3D look too
      if (!d || !d.look || !root.LasgidiAvatar3D) return person(i, i % 2 === 1);
      var outer = new T.Group(), f = root.LasgidiAvatar3D.figure(T, d.look, d.outfit, d.extra); f.rotation.y = Math.PI / 2; f.scale.setScalar(1.05); outer.add(f);
      outer.userData.legs = f.userData.legs; outer.userData.axis = 'x'; outer.userData.key = JSON.stringify([d.look, d.outfit, d.extra]); slimFigure(outer, f); return outer;
    }
    function lookKey(d) { return d && d.look ? JSON.stringify([d.look, d.outfit, d.extra]) : ''; }
    // The letter hunt: today's letter glows here when you have its riddle; tap it (or walk into it) to catch it.
    var letter = null, letterKey = '', beacon = null; // beacon: a pulsing ring on the ground and a beam of light over it
    function syncLetter() {
      var L0 = sc.letter, k = L0 ? L0.ch + L0.color : '';
      if (k !== letterKey) { letterKey = k; if (letter) { world.remove(letter); wipe(letter); letter = null; } if (beacon) { world.remove(beacon); wipe(beacon); beacon = null; }
        if (L0) { beacon = new T.Group(); var bc = new T.Color(L0.color); var ring = new T.Mesh(new T.RingGeometry(1.5, 2.1, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: bc, transparent: true, opacity: 0.85, depthWrite: false })); beacon.add(ring); beacon.userData.ring = ring;
          var beam = new T.Mesh(new T.CylinderGeometry(0.22, 0.42, 14, 14, 1, true), new T.MeshBasicMaterial({ color: bc, transparent: true, opacity: 0.28, depthWrite: false, side: T.DoubleSide })); beam.position.y = 7; beacon.add(beam);
          beacon.traverse(function (o) { o.userData.letter = true; }); world.add(beacon); }
        if (L0) { letter = new T.Group(); var lt = canvasTex(256, 256, function (g, w, h) { g.fillStyle = L0.color; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.font = '900 210px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L0.ch, w / 2, h / 2 + 12); });
          var face = new T.MeshStandardMaterial({ map: lt, emissive: 0xffffff, emissiveMap: lt, emissiveIntensity: 0.9, roughness: 0.3 }), side = new T.MeshStandardMaterial({ color: L0.color, emissive: L0.color, emissiveIntensity: 0.6 });
          var bx = new T.Mesh(new T.BoxGeometry(2, 2, 0.35), [side, side, side, side, face, face]); bx.castShadow = true; letter.add(bx);
          var glow = new T.PointLight(L0.color, 30, 12, 1.6); glow.position.y = 0.5; letter.add(glow); letter.traverse(function (o) { o.userData.letter = true; }); world.add(letter); }
      }
    }
    // Rules 35+: festival dressing over any walk-in while a festival is on at this place: an arch with its name,
    // bunting, and props for the kind of festival (troupes, food tents, drummers, easels, kente, canoes, flags).
    var festG = null, festKey = '';
    function syncFest() {
      var F0 = sc.fdress, k = F0 ? F0.id + ':' + (sc.mode || '') : '';
      if (k === festKey) return; festKey = k;
      if (festG) { world.remove(festG); wipe(festG); festG = null; }
      if (!F0) return;
      festG = new T.Group(); festG.userData.dancers = []; world.add(festG);
      // Laid out around where the camera looks, so it is in view in every kind of walk-in.
      var R0 = [[-12, -2], [-6, -4], [0, -5], [6, -4], [12, -2], [-9, 4], [0, 5], [9, 4]], cx = orbit.tx || 0, cz = orbit.tz || 0, col = new T.Color(F0.color || '#e84393'), at = function (i) { var q = R0[i % R0.length], x = cx + q[0], z = cz + q[1]; return { x: x, z: z, y: groundY(x, z) }; };
      // The arch over the middle spot, readable from the camera side.
      var a0 = at(2), post = mat('fdPost', { color: 0x3a3f46, metalness: 0.5, roughness: 0.4 });
      [-6, 6].forEach(function (dx) { festG.add(mesh(new T.CylinderGeometry(0.25, 0.3, 7, 10), post, a0.x + dx, a0.y + 3.5, a0.z + 3)); });
      var bt = canvasTex(1024, 160, function (g, w, h) { g.fillStyle = F0.color || '#e84393'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.2)'; for (var i = 0; i < w; i += 40) g.fillRect(i, 0, 20, 10); g.fillStyle = '#fff'; g.font = '900 78px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(F0.name).toUpperCase(), w / 2, h / 2 + 4, w - 40); });
      [0, Math.PI].forEach(function (ry) { var bm = new T.Mesh(new T.PlaneGeometry(12.4, 1.95), new T.MeshStandardMaterial({ map: bt, emissive: 0xffffff, emissiveMap: bt, emissiveIntensity: 0.35, roughness: 0.6 })); bm.position.set(a0.x, a0.y + 6.6, a0.z + 3 + (ry ? 0.05 : -0.05)); bm.rotation.y = ry; festG.add(bm); });
      // Bunting: little flags strung between the spots, one merged mesh with vertex colours.
      var pos = [], cols = [], cset = [col, new T.Color(0xffd23f), new T.Color(0xffffff), new T.Color(0x16a35a), new T.Color(0x2f6fd0)];
      for (var r = 0; r < 4; r++) { var p1 = at(r), p2 = at(r + 1); for (var f = 0; f < 12; f++) { var u = f / 12, x = p1.x + (p2.x - p1.x) * u, z = p1.z + (p2.z - p1.z) * u, y = Math.max(p1.y, p2.y) + 5 - Math.sin(u * Math.PI) * 0.9, c = cset[(f + r) % cset.length];
        pos.push(x - 0.35, y, z, x + 0.35, y, z, x, y - 0.7, z); for (var v = 0; v < 3; v++) cols.push(c.r, c.g, c.b); } }
      var bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); bg.computeVertexNormals();
      festG.add(new T.Mesh(bg, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide })));
      // Props by festival.
      var kind = F0.id, spots = [5, 6, 7];
      spots.forEach(function (si, j) {
        var q = at(si), g = new T.Group(); g.position.set(q.x + (j - 1) * 1.5, q.y, q.z + 2); festG.add(g);
        if (kind === 'foodfest') { g.add(mesh(new T.BoxGeometry(4, 1, 2), mat('fdTable', { color: 0x8a5a34 }), 0, 0.5, 0)); g.add(mesh(new T.ConeGeometry(3.2, 1.6, 4), mat('fdTent' + j, { color: [0xe67e22, 0xffffff, 0xc0392b][j], roughness: 0.8 }), 0, 3.4, 0)); [-2, 2].forEach(function (px) { g.add(mesh(new T.CylinderGeometry(0.08, 0.08, 2.6, 6), post, px, 1.3, 0)); }); [-1, 0.2, 1.3].forEach(function (px) { g.add(mesh(new T.CylinderGeometry(0.4, 0.35, 0.5, 12), mat('fdPot', { color: 0x1c1c1f, metalness: 0.4 }), px, 1.25, 0)); }); }
        else if (kind === 'accart') { [-1.2, 1.2].forEach(function (px, e) { var ct = canvasTex(256, 192, function (c2, w, h) { c2.fillStyle = '#fff'; c2.fillRect(0, 0, w, h); for (var b = 0; b < 9; b++) { c2.fillStyle = 'hsl(' + ((b * 47 + j * 90 + e * 30) % 360) + ',80%,55%)'; c2.beginPath(); c2.arc((b * 61 + e * 30) % w, (b * 43) % h, 18 + b * 3, 0, Math.PI * 2); c2.fill(); } }); g.add(mesh(new T.BoxGeometry(0.1, 2.4, 0.1), post, px, 1.2, 0.3)); var cv = new T.Mesh(new T.PlaneGeometry(1.8, 1.35), new T.MeshBasicMaterial({ map: ct, side: T.DoubleSide })); cv.position.set(px, 1.8, 0.2); g.add(cv); }); }
        else if (kind === 'kumkente') { var kt = canvasTex(256, 256, function (c2, w, h) { var K = ['#f2b600', '#16a35a', '#c0392b', '#17181a']; for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 32) { c2.fillStyle = K[((x / 32) + (y / 16)) % 4 | 0]; c2.fillRect(x, y, 32, 16); } }); [-1.6, 1.6].forEach(function (px) { g.add(mesh(new T.BoxGeometry(0.12, 3, 0.12), post, px, 1.5, 0)); }); g.add(mesh(new T.BoxGeometry(3.4, 0.12, 0.12), post, 0, 3, 0)); var cl = new T.Mesh(new T.PlaneGeometry(3, 2.5), new T.MeshStandardMaterial({ map: kt, side: T.DoubleSide, roughness: 0.9 })); cl.position.set(0, 1.7, 0); g.add(cl); }
        else if (kind === 'phregatta') { var hull = mat('fdCanoe' + j, { color: [0x8e2b2b, 0x1f5fa0, 0xf2b600][j], roughness: 0.6 }); g.add(mesh(new T.BoxGeometry(7, 0.7, 1.2), hull, 0, 0.4, 0)); [-3.6, 3.6].forEach(function (px) { var tip = mesh(new T.ConeGeometry(0.6, 1.4, 4), hull, px, 0.5, 0); tip.rotation.z = px > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(tip); }); for (var pd = 0; pd < 4; pd++) g.add(mesh(new T.BoxGeometry(0.1, 1.6, 0.25), mat('fdPaddle', { color: 0xd8c3a5 }), -2.4 + pd * 1.6, 1.1, 0.7)); }
        else if (kind === 'indep') { [-1.5, 0, 1.5].forEach(function (px) { g.add(mesh(new T.CylinderGeometry(0.06, 0.06, 4, 6), post, px, 2, 0)); var fl = canvasTex(96, 64, function (c2, w, h) { c2.fillStyle = '#008751'; c2.fillRect(0, 0, w, h); c2.fillStyle = '#fff'; c2.fillRect(w / 3, 0, w / 3, h); }); var fm = new T.Mesh(new T.PlaneGeometry(1.5, 1), new T.MeshBasicMaterial({ map: fl, side: T.DoubleSide })); fm.position.set(px + 0.75, 3.4, 0); g.add(fm); }); }
        // People: carnival troupes with feather headdresses, drummers for culture week, a dancer or two everywhere else.
        var n = kind === 'carnival' ? 3 : kind === 'abjculture' ? 2 : 1;
        for (var d = 0; d < n; d++) { var pp = person(300 + j * 5 + d, (d + j) % 2 === 0); pp.position.set((d - (n - 1) / 2) * 1.4, 0, 1.5); pp.rotation.y = -Math.PI / 2; g.add(pp);
          if (kind === 'carnival') { var hd = mesh(new T.ConeGeometry(0.55, 1.6, 8, 1, true), mat('fdFeather' + ((d + j) % 3), { color: [0xe84393, 0xf2b600, 0x2fa36b][(d + j) % 3], side: T.DoubleSide, roughness: 0.7 }), 0, 2.6, 0); hd.rotation.x = Math.PI; pp.add(hd); }
          if (kind === 'abjculture') g.add(mesh(new T.CylinderGeometry(0.35, 0.3, 0.9, 12), mat('fdDrum', { color: 0x8a5a34 }), (d - 0.5) * 1.4 + 0.5, 0.45, 1.9));
          festG.userData.dancers.push({ p: pp, ph: j * 1.3 + d }); }
      });
    }
    function festFrame(t) { if (!festG) return; festG.userData.dancers.forEach(function (D0) { D0.p.position.y = Math.abs(Math.sin(t * 4 + D0.ph)) * 0.3; D0.p.rotation.y = -Math.PI / 2 + Math.sin(t * 1.3 + D0.ph) * 0.6; }); }
    function syncPeople() {
      var list = sc.people || [];
      while (crowd.length < list.length) { var p = avatarFor(list[crowd.length], crowd.length); world.add(p); crowd.push(p); }
      crowd.forEach(function (p, i) { var d = list[i]; if (d && d.look && lookKey(d) !== (p.userData.key || '')) { var np = avatarFor(d, i); world.remove(p); wipe(p); world.add(np); crowd[i] = p = np; } p.visible = !!d; if (!d) return; p.userData.person = i; var q = SP()[(d.slot || i) % SP().length]; p.userData.home = [q[0] + Math.cos(i * 2.3) * 2.2, q[1] + 1.5 + Math.sin(i * 2.3) * 1.6]; p.traverse(function (o) { o.userData.person = i; }); });
      if (sc.me && me && lookKey(sc.me) !== (me.userData.key || '')) { world.remove(me); wipe(me); me = null; }
      if (sc.me && !me) { me = avatarFor(sc.me, 9); if (!meTag) { meTag = sprite('You', '#2f6fd0', '#fff', 2.4); world.add(meTag); } world.add(me); }
      if (me) { me.visible = meTag.visible = !!sc.me; }
      if (sc.gem && !gem) { gem = new T.Mesh(new T.OctahedronGeometry(0.6, 0), new T.MeshPhysicalMaterial({ color: 0x33c3f0, roughness: 0, metalness: 0.1, clearcoat: 1, emissive: 0x0c5a7a, emissiveIntensity: 0.6 })); gem.castShadow = true; gem.traverse(function (o) { o.userData.gem = true; }); world.add(gem); }
      if (gem) gem.visible = !!sc.gem;
    }

    /* ---------- build per place ---------- */
    var built = '';
    function build() {
      var key = (sc.mode || 'beach') + (sc.villas ? 'v' : 'b') + (sc.rooftop ? 'r' : '') + (sc.name || '') + (sc.th ? sc.th.key : ''); if (key === built) return; built = key; WK.reset = true;
      DOLL = sc.mode === 'hall' || sc.mode === 'gallery' || (sc.mode === 'club' && !sc.rooftop && sc.placeId !== 'owambe_hall'); ESTATE = sc.mode === 'estate'; HARBOUR = sc.mode === 'harbour'; CLUB = sc.mode === 'club'; ROOF = CLUB && !!sc.rooftop; STAD = sc.mode === 'stadium'; MKT = sc.mode === 'market'; JTY = sc.mode === 'jetty'; PRK = sc.mode === 'park'; PLZ = sc.mode === 'plaza'; GAL = sc.mode === 'gallery' || sc.mode === 'hall'; STR = sc.mode === 'street'; if (sc.mode === 'gallery') buildGallery(); if (sc.mode === 'hall') buildHall(); if (STR) buildStreet(); if (PLZ) buildPlaza(); if (PRK) buildPark(); if (MKT) buildMarket(); if (JTY) buildJetty(); if (ESTATE) buildEstate(); if (HARBOUR) buildHarbour(); if (CLUB) buildClub(); if (STAD) buildStadium();
      harbourG.visible = HARBOUR; clubG.visible = CLUB; stadG.visible = STAD; mktG.visible = MKT; jetG.visible = JTY; parkG.visible = PRK; plzG.visible = PLZ; galG.visible = GAL; strG.visible = STR; sky.visible = !CLUB || ROOF; S3.environment = CLUB && !ROOF ? null : envRT.texture;
      // Frame: the estate uses a wider lens so the pool below and the skyline above both fit, as in a terrace photo.
      orbit.ty = 0; if (PLZ && /abj_tower|dxb_burj/.test(sc.placeId || '')) { cam.fov = 55; orbit.az = 0; orbit.pol = 1.42; orbit.r = 120; orbit.tx = 0; orbit.ty = 55; orbit.tz = 40; } else if (STR) { cam.fov = 52; orbit.az = 0; orbit.pol = 1.25; orbit.pol = 1.32; orbit.r = sc.kind === 'refinery' ? 90 : sc.kind === 'hospital' || sc.kind === 'motorpark' || sc.kind === 'airport' || sc.kind === 'rail' ? 60 : 38; orbit.tx = 0; orbit.ty = sc.kind === 'refinery' ? 10 : 3; orbit.tz = 14; } else if ((GAL || CLUB) && DOLL) { var narrow0 = (root.innerWidth || 1000) < 700; cam.fov = 50; orbit.az = narrow0 ? 1.25 : 0.5; orbit.pol = 0.9; orbit.r = CLUB ? (narrow0 ? 104 : 70) : narrow0 ? 84 : 52; orbit.tx = 0; orbit.ty = 0; orbit.tz = 2; } else if (GAL) { cam.fov = 60; orbit.az = 0; orbit.pol = 1.25; orbit.r = 24; orbit.tx = 0; orbit.ty = 1; orbit.tz = 6; } else if (PLZ) { cam.fov = 55; orbit.az = 0; orbit.pol = 1.3; orbit.r = 70; orbit.tx = 0; orbit.ty = 12; orbit.tz = 20; } else if (PRK) { cam.fov = 55; orbit.az = 0; orbit.pol = 1.18; orbit.r = 50; orbit.tx = 0; orbit.tz = 8; } else if (JTY) { cam.fov = 52; orbit.az = 0.35; orbit.pol = 1.2; orbit.r = 52; orbit.tx = 0; orbit.tz = 8; } else if (MKT) { cam.fov = 55; orbit.az = 0; orbit.pol = 1.16; orbit.r = 36; orbit.tx = 0; orbit.tz = 4; } else if (STAD) { cam.fov = 50; orbit.az = 0; orbit.pol = sc.street ? 1.12 : 1.08; orbit.r = sc.street ? 40 : 84; orbit.tx = 0; orbit.tz = sc.street ? 2 : 4; } else if (CLUB) { cam.fov = ROOF ? 52 : 62; orbit.az = 0; orbit.pol = ROOF ? 1.3 : 1.22; orbit.r = ROOF ? 34 : 26; orbit.tx = 0; orbit.tz = ROOF ? 4 : 8; } else if (HARBOUR) { cam.fov = 50; orbit.az = sc.club ? Math.PI - 0.55 : 0; orbit.pol = sc.club ? 1.25 : 1.2; orbit.r = sc.club ? 85 : 130; orbit.tx = sc.club ? -10 : 0; orbit.tz = sc.club ? 126 : 40; } else if (ESTATE) { cam.fov = 55; orbit.az = 0.05; orbit.pol = 1.23; orbit.r = 39; orbit.tx = -12; orbit.tz = -2; } else { cam.fov = 42; orbit.az = 0.08; orbit.pol = 1.17; orbit.r = 40; orbit.tx = -12; orbit.tz = -6; }
      if (GAL && sc.kind === 'auditorium') { var nrw = (root.innerWidth || 1000) < 700; cam.fov = 52; orbit.az = 0; orbit.pol = 1.08; orbit.r = nrw ? 50 : 40; orbit.tx = 0; orbit.ty = 5; orbit.tz = 8; } // from the back of the hall, facing the stage
      cam.updateProjectionMatrix(); place();
      estateG.visible = ESTATE; [sand, sea, foam, wet, skyline, lawn, path, jetski, sail].forEach(function (o) { o.visible = !ESTATE && !HARBOUR && !CLUB && !STAD && !MKT && !JTY && !PRK && !PLZ && !GAL && !STR; });
      wipe(dyn); palms = []; villas = new T.Group(); beachBits = new T.Group(); dyn.add(villas, beachBits);
      if (CLUB || STAD || MKT || JTY || PRK || PLZ || GAL || STR) return;
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
    var EYE = false;
    function place() { orbit.pol = Math.max(0.55, Math.min(EYE ? 1.52 : 1.42, orbit.pol)); orbit.r = Math.max(CLUB || GAL ? 6 : 10, Math.min(GAL ? (DOLL ? 100 : 22) : CLUB ? (ROOF ? 60 : DOLL ? 120 : 30) : 140, orbit.r)); if ((CLUB && !ROOF && !DOLL) || (GAL && !DOLL)) orbit.pol = Math.max(0.95, orbit.pol); else if (DOLL) orbit.pol = Math.max(0.6, orbit.pol); var s = Math.sin(orbit.pol); cam.position.set(orbit.tx + orbit.r * s * Math.sin(orbit.az), orbit.ty + orbit.r * Math.cos(orbit.pol), orbit.tz - orbit.r * s * Math.cos(orbit.az)); cam.lookAt(orbit.tx, orbit.ty + 2, orbit.tz); }
    place();
    cv.addEventListener('pointerdown', function (e) { ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; drag = { x: e.clientX, y: e.clientY }; moved = false; var a = Object.values(ptrs); if (a.length === 2) pinch0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
    cv.addEventListener('pointermove', function (e) { if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; var a = Object.values(ptrs); if (a.length === 2 && pinch0) { var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); orbit.r *= pinch0 / Math.max(1, d); pinch0 = d; moved = true; place(); return; } if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; orbit.az -= dx * 0.005; orbit.pol -= dy * 0.004; drag = { x: e.clientX, y: e.clientY }; place(); });
    function up(e) { delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch0 = 0; if (!Object.keys(ptrs).length) drag = null; }
    cv.addEventListener('pointerup', function (e) { var mv = moved; up(e); if (!mv) tap(e); }); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function (e) { e.preventDefault(); orbit.r *= Math.exp(e.deltaY * 0.0012); place(); }, { passive: false });
    var ray = new T.Raycaster(), ndc = new T.Vector2();
    function tap(e) {
      var r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
      var sh = ray.intersectObjects(signs.filter(function (s) { return s.visible; }), false)[0]; if (sh && opts.onAct) { if (WK.on && me) { walkTo(sh.object.userData.act); return; } opts.onAct(sh.object.userData.act); return; }
      var hit = ray.intersectObjects(world.children, true).filter(function (h) { return h.object.userData.gem || h.object.userData.letter || h.object.userData.person != null; })[0];
      if (hit && hit.object.userData.letter) { if (opts.onLetter) opts.onLetter(); return; }
      if (!hit) { if (WK.on && me) { var gp = new T.Vector3(); if (ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -groundY(WK.x, WK.z)), gp)) { WK.tx = gp.x; WK.tz = gp.z; WK.act = null; } } return; } if (hit.object.userData.gem) { if (opts.onGem && sc.gem) opts.onGem(sc.gem.n); return; }
      var d = (sc.people || [])[hit.object.userData.person]; if (d) { if (d.npc && opts.onNpc) opts.onNpc(d.npc); if (!bubble) { bubble = sprite('', '#fff', '#17181a', 9); world.add(bubble); } label(bubble, (d.label + ': ' + (d.line || '')).slice(0, 48), '#ffffff', '#17181a'); bubble.position.copy(crowd[hit.object.userData.person].position).add(new T.Vector3(0, 3.2, 0)); bubble.visible = true; bubbleAt = performance.now(); }
    }
    var bar = document.createElement('div'); bar.className = 'iv-spin';
    bar.innerHTML = '<button type="button" class="pg-zbtn" data-b3="photo" aria-label="Take a photo">📷</button><button type="button" class="pg-zbtn" data-b3="in" aria-label="Zoom in">+</button><button type="button" class="pg-zbtn" data-b3="out" aria-label="Zoom out">−</button><button type="button" class="pg-zbtn" data-b3="l" aria-label="Turn left">⟲</button><button type="button" class="pg-zbtn" data-b3="r" aria-label="Turn right">⟳</button><button type="button" class="pg-zbtn b3-walk" data-b3="walk" aria-label="Walk around" aria-pressed="true">🚶</button>';
    el.appendChild(bar);
    // Three views of every place: Above (the aerial overview), Inside (in among the people) and Eye (eye level, as if you stood there).
    var views = document.createElement('div'); views.className = 'b3-views'; views.setAttribute('role', 'group'); views.setAttribute('aria-label', 'View');
    views.innerHTML = [['above', 'Above'], ['inside', 'Inside'], ['eye', 'Eye']].map(function (v) { return '<button type="button" data-b3="v:' + v[0] + '" aria-pressed="false">' + v[1] + '</button>'; }).join('');
    el.appendChild(views);
    function setView(v) {
      if (WK.on) setWalk(false);
      EYE = v === 'eye';
      if (v === 'above') { orbit.pol = 0.66; orbit.r = CLUB || GAL ? 60 : 95; } else if (v === 'inside') { orbit.pol = 1.25; orbit.r = CLUB || GAL ? 16 : 34; } else { orbit.pol = 1.52; orbit.r = CLUB || GAL ? 14 : 30; }
      place();
      [].forEach.call(views.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-b3') === 'v:' + v)); });
    }
    views.addEventListener('click', function (e) { var b = e.target.closest('[data-b3]'); if (b) setView(b.getAttribute('data-b3').slice(2)); });
    bar.addEventListener('click', function (e) { var b = e.target.closest('[data-b3]'); if (!b) return; var a = b.getAttribute('data-b3'); if (a === 'photo') { if (opts.onPhoto) opts.onPhoto(cv); return; } if (a === 'walk') { setWalk(!WK.on); if (opts.onWalk) opts.onWalk(WK.on); return; } if (a === 'in') orbit.r *= 0.8; else if (a === 'out') orbit.r *= 1.25; else orbit.az += (a === 'l' ? 1 : -1) * Math.PI / 6; place(); });

    /* ---------- the season: a Christmas tree, Sallah rams, the marathon arch, the New Yam pile, Style Week's runway ---------- */
    var seasG = new T.Group(); world.add(seasG); var seasKey = '', SEAS = { bulbs: [] };
    function seasonal() {
      var k = built + '|' + sc.month + '|' + (sc.placeId || ''); if (k === seasKey) return; seasKey = k; wipe(seasG); SEAS = { bulbs: [] };
      var m = sc.month, q = SP(), cx = 0, cz = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; if (m == null) return; q.forEach(function (p) { cx += p[0] / q.length; cz += p[1] / q.length; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); });
      var K = Math.max(1, Math.min(2.6, Math.max(x1 - x0, z1 - z0) / 22)), front = z1 + 3 * K; // bigger in the big squares, in front of the signs
      var at = function (dx, dz) { var x = cx + dx * K, z = front + dz * K - 6 * K; return [x, groundY(x, z), z]; }, id = sc.placeId || '';
      var big = function (g, x) { g.scale.setScalar(K * (x || 1)); return g; };
      // A festival banner on two posts, readable from the camera.
      var banner = function (g, text, col, y, w) { w = w || 7; [-w / 2, w / 2].forEach(function (x) { g.add(mesh(new T.BoxGeometry(0.2, y + 0.6, 0.2), mat('banP', { color: 0x5a3f2b }), x, (y + 0.6) / 2, 0)); }); var bt = canvasTex(512, 96, function (c, ww, hh) { c.fillStyle = col; c.fillRect(0, 0, ww, hh); c.fillStyle = '#fff'; c.font = '900 46px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, ww / 2, hh / 2 + 3, ww - 20); }); var b = new T.Mesh(new T.PlaneGeometry(w, w * 0.19), new T.MeshBasicMaterial({ map: bt, side: T.DoubleSide })); b.position.set(0, y, 0); b.rotation.y = Math.PI; g.add(b); };
      if (m === 11 && (PLZ || GAL || STR || MKT || PRK)) { // a Christmas tree with lights and a star
        var p0 = at(-7, 4), tr = big(new T.Group()); tr.position.set(p0[0], p0[1], p0[2]); seasG.add(tr);
        tr.add(mesh(new T.CylinderGeometry(0.35, 0.45, 1.4, 10), mat('xtrunk', { color: 0x6b4a2b }), 0, 0.7, 0));
        [[3.2, 3, 1.6], [2.5, 2.6, 3.4], [1.7, 2.2, 5.0]].forEach(function (c) { tr.add(mesh(new T.ConeGeometry(c[0], c[1], 14), mat('xtree', { color: 0x1f6b3a, roughness: 0.8 }), 0, c[2], 0)); });
        tr.add(mesh(new T.OctahedronGeometry(0.45), new T.MeshBasicMaterial({ color: 0xffd34d }), 0, 6.5, 0));
        for (var b = 0; b < 36; b++) { var h = 1.6 + (b % 12) * 0.38, rr = 3 * (1 - (h - 1.2) / 5.6), an = b * 2.4, bl = mesh(new T.SphereGeometry(0.13, 8, 6), new T.MeshBasicMaterial({ color: [0xff3b30, 0xffd34d, 0x3bc9ff, 0xffffff][b % 4] }), Math.cos(an) * rr, h, Math.sin(an) * rr); bl.castShadow = false; tr.add(bl); SEAS.bulbs.push(bl); }
      }
      if (m === 3 && MKT) { // Sallah rams in a pen
        var pn = at(-5, 8), pen = big(new T.Group(), 1.7); pen.position.set(pn[0], pn[1], pn[2]); seasG.add(pen); pn = [0, 0, 0]; banner(pen, '🐏 SALLAH RAM MARKET', '#1d7a43', 2.6, 7); for (var r = 0; r < 6; r++) { var ram = new T.Group(); ram.position.set(pn[0] + (r % 3) * 1.8, pn[1], pn[2] + Math.floor(r / 3) * 1.6); ram.rotation.y = r * 1.1; pen.add(ram);
          var wool = mat('wool', { color: 0xefe9dc, roughness: 1 }); var bd = mesh(new T.SphereGeometry(0.6, 12, 10), wool, 0, 0.75, 0); bd.scale.set(1.4, 0.9, 0.9); ram.add(bd); ram.add(mesh(new T.SphereGeometry(0.3, 10, 8), mat('ramface', { color: 0x3a2a20 }), 0.85, 0.95, 0));
          [-0.18, 0.18].forEach(function (zz) { var hn = mesh(new T.TorusGeometry(0.16, 0.05, 6, 12, Math.PI * 1.4), mat('horn', { color: 0x8a7a5a }), 0.8, 1.15, zz); hn.rotation.y = Math.PI / 2; ram.add(hn); });
          [[-0.4, -0.25], [-0.4, 0.25], [0.4, -0.25], [0.4, 0.25]].forEach(function (l) { ram.add(mesh(new T.CylinderGeometry(0.07, 0.07, 0.5, 6), mat('ramface', {}), l[0], 0.25, l[1])); }); }
        for (var f = 0; f < 12; f++) pen.add(mesh(new T.BoxGeometry(0.1, 0.9, 0.1), mat('fence', { color: 0x8a6a4a }), pn[0] - 1 + (f % 6) * 1.2, pn[1] + 0.45, pn[2] - 1 + Math.floor(f / 6) * 4.2));
      }
      if (m === 1 && (id === 'tbs' || id === 'link_bridge' || PLZ)) { // the marathon start arch and bunting
        var pa = at(0, 5), arch = big(new T.Group()); arch.position.set(pa[0], pa[1], pa[2]); seasG.add(arch);
        [-5, 5].forEach(function (x) { arch.add(mesh(new T.BoxGeometry(0.6, 5, 0.6), mat('archP', { color: 0x1d7a43 }), x, 2.5, 0)); });
        var bt = canvasTex(512, 96, function (g, w, h) { g.fillStyle = '#1d7a43'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 52px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EKO CITY MARATHON', w / 2, h / 2 + 3); });
        var ban = new T.Mesh(new T.PlaneGeometry(10.6, 1.4), new T.MeshBasicMaterial({ map: bt, side: T.DoubleSide })); ban.position.set(0, 5.2, 0); ban.rotation.y = Math.PI; arch.add(ban);
        for (var fl = 0; fl < 30; fl++) arch.add(mesh(new T.ConeGeometry(0.2, 0.45, 3), new T.MeshBasicMaterial({ color: [0x1d7a43, 0xffffff][fl % 2] }), -7 + fl * 0.48, 4.3 - Math.sin(fl / 29 * Math.PI) * 0.6, 0.2));
      }
      if (m === 7 && id === 'theatre') { // the New Yam pile
        var yg = big(new T.Group(), 1.8), py = at(-7, 6); yg.position.set(py[0], py[1], py[2]); seasG.add(yg); py = [0, 0, 0]; banner(yg, 'IRI JI · NEW YAM FESTIVAL', '#7a3a10', 2.8, 6); yg.add(mesh(new T.BoxGeometry(4, 0.9, 2), mat('yamTbl', { color: 0x7a5233 }), py[0], py[1] + 0.45, py[2]));
        for (var y2 = 0; y2 < 18; y2++) { var row = y2 < 8 ? 0 : y2 < 14 ? 1 : 2, yam = mesh(new T.CapsuleGeometry(0.16, 0.7, 4, 8), mat('yam', { color: 0x8a5a33, roughness: 1 }), py[0] - 1.4 + (y2 % (8 - row * 2)) * 0.4 + row * 0.4, py[1] + 1.05 + row * 0.3, py[2]); yam.rotation.z = Math.PI / 2; yg.add(yam); }
      }
      if (m === 10 && id === 'eko_convention') { // Eko Style Week's runway
        var pr = at(0, 4); pr[2] = cz; seasG.add(mesh(new T.BoxGeometry(2.4, 0.6, 18), mat('runway', { color: 0xf4f3ec, roughness: 0.25, metalness: 0.2 }), pr[0], pr[1] + 0.3, pr[2]));
        for (var lt = 0; lt < 12; lt++) { var rl = mesh(new T.SphereGeometry(0.1, 6, 4), new T.MeshBasicMaterial({ color: 0xfff2c0 }), pr[0] + (lt % 2 ? 1.25 : -1.25), pr[1] + 0.62, pr[2] - 8.5 + Math.floor(lt / 2) * 3.4); rl.castShadow = false; seasG.add(rl); }
      }
    }

    /* ---------- walking: tap the ground, WASD or the arrows, or the joystick; the camera follows ---------- */
    var WK = { on: opts.walk !== false, x: 0, z: 0, yaw: 0, tx: null, tz: null, act: null, keys: {}, joy: null, key: '', moving: 0, near: -1, follow: false };
    function walkBox() { var q = SP(), x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; q.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }); var pad = HARBOUR ? 14 : CLUB || GAL ? 4 : 7; return { x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: Math.min(z1 + pad, (!ESTATE && !HARBOUR && !CLUB && !STAD && !MKT && !JTY && !PRK && !PLZ && !GAL && !STR) ? SEA0 + 3 : 1e9) }; }
    function walkStart() { var b = walkBox(), q = SP()[(sc.meSlot || 5) % SP().length]; WK.x = q[0] + 1.6; WK.z = Math.min(b.z1 - 1, q[1] + 2.5); WK.tx = WK.tz = null; WK.act = null; WK.yaw = Math.PI / 2; }
    function walkTo(i) { var q = SP()[i % SP().length]; WK.tx = q[0] + 1.6; WK.tz = q[1] + 2.2; WK.act = i; }
    function setWalk(on) { WK.on = !!on; var b = bar.querySelector('.b3-walk'); if (b) { b.setAttribute('aria-pressed', String(WK.on)); b.classList.toggle('on', WK.on); } joy.style.display = WK.on && coarse ? '' : 'none'; doBtn.hidden = true; if (WK.on) walkStart(); }
    var coarse = !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches);
    // The on-screen joystick (touch screens).
    var joy = document.createElement('div'); joy.className = 'b3-joy'; joy.setAttribute('aria-hidden', 'true'); joy.innerHTML = '<i></i>'; el.appendChild(joy);
    var knob = joy.firstChild, joyId = null;
    function joyAt(e) { var r = joy.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2), m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } WK.joy = { x: dx, y: dy }; knob.style.transform = 'translate(' + (dx * 26) + 'px,' + (dy * 26) + 'px)'; }
    joy.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); joyId = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch (x) {} joyAt(e); });
    joy.addEventListener('pointermove', function (e) { if (e.pointerId === joyId) joyAt(e); });
    ['pointerup', 'pointercancel'].forEach(function (ev) { joy.addEventListener(ev, function () { joyId = null; WK.joy = null; knob.style.transform = ''; }); });
    // "Do it" when you stand by a sign.
    var doBtn = document.createElement('button'); doBtn.type = 'button'; doBtn.className = 'btn go b3-do'; doBtn.hidden = true; el.appendChild(doBtn);
    joy.style.display = WK.on && coarse ? '' : 'none';
    doBtn.addEventListener('click', function () { if (WK.near >= 0 && opts.onAct) opts.onAct(WK.near); });
    var KEYS = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
    function onKey(e) { if (e.type === 'keyup') { var ku = KEYS[String(e.key).toLowerCase()]; if (ku) WK.keys[ku] = false; return; } // always let go, wherever focus is
      if (!el.isConnected || !WK.on || (root.LasgidiGL && !root.LasgidiGL.live(el))) return; var t = e.target, tag = t && t.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return; var k = KEYS[String(e.key).toLowerCase()]; if (!k) return; WK.keys[k] = e.type === 'keydown'; if (e.type === 'keydown') { WK.tx = WK.tz = null; WK.act = null; e.preventDefault(); } }
    root.addEventListener('keydown', onKey); root.addEventListener('keyup', onKey);
    var letGo = function () { WK.keys = {}; WK.joy = null; }; root.addEventListener('blur', letGo); if (root.document) root.document.addEventListener('visibilitychange', letGo);
    function walkFrame(dt, t) {
      if (!me || !sc.me) return;
      var b = walkBox(), cfx = cam.position.x - orbit.tx, cfz = cam.position.z - orbit.tz, cl = Math.hypot(cfx, cfz) || 1, fx = -cfx / cl, fz = -cfz / cl; // camera forward on the ground
      var rx = -fz, rz = fx, mx = 0, mz = 0, K = WK.keys;
      if (K.f) { mx += fx; mz += fz; } if (K.b) { mx -= fx; mz -= fz; } if (K.r) { mx += rx; mz += rz; } if (K.l) { mx -= rx; mz -= rz; }
      if (WK.joy) { mx += rx * WK.joy.x - fx * WK.joy.y; mz += rz * WK.joy.x - fz * WK.joy.y; }
      if (!mx && !mz && WK.tx != null) { var ddx = WK.tx - WK.x, ddz = WK.tz - WK.z, dd = Math.hypot(ddx, ddz); if (dd < 0.35) { WK.tx = WK.tz = null; if (WK.act != null && opts.onAct) { var a = WK.act; WK.act = null; opts.onAct(a); } } else { mx = ddx / dd; mz = ddz / dd; } }
      var m = Math.hypot(mx, mz), sp = (CLUB || GAL ? 4 : 6.5) * dt;
      if (m > 0.01) { mx /= Math.max(1, m); mz /= Math.max(1, m); WK.x = Math.max(b.x0, Math.min(b.x1, WK.x + mx * sp)); WK.z = Math.max(b.z0, Math.min(b.z1, WK.z + mz * sp)); var want = Math.atan2(-mz, mx), dy = ((want - WK.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; WK.yaw += dy * Math.min(1, dt * 10); WK.moving = Math.min(1, WK.moving + dt * 6); WK.follow = true; }
      else WK.moving = Math.max(0, WK.moving - dt * 6);
      me.position.set(WK.x, groundY(WK.x, WK.z), WK.z); me.rotation.y = WK.yaw;
      var lg = me.userData.legs, sw = Math.sin(t * 9) * 0.6 * WK.moving; if (lg) lg.forEach(function (l, k) { l.rotation[me.userData.axis || 'z'] = k ? -sw : sw; });
      if (WK.follow) { var WR = CLUB || GAL ? 12 : HARBOUR ? 34 : 24; orbit.tx += (WK.x - orbit.tx) * Math.min(1, dt * 3); orbit.tz += (WK.z - orbit.tz) * Math.min(1, dt * 3); if (orbit.r > WR) orbit.r += (WR - orbit.r) * Math.min(1, dt * 1.5); place(); if (WK.moving === 0 && Math.hypot(WK.x - orbit.tx, WK.z - orbit.tz) < 0.2) WK.follow = false; }
      // People notice you: regulars and crew with a line turn to you and say it (once until you walk away); others wave.
      var seen = WK.seen || (WK.seen = {});
      crowd.forEach(function (p, i) {
        var d = (sc.people || [])[i]; if (!p.visible || !d) return; var ddx = WK.x - p.position.x, ddz = WK.z - p.position.z, dist = Math.hypot(ddx, ddz);
        var inner0 = p.children && p.children[0], arms0 = inner0 && inner0.userData && inner0.userData.arms;
        if (dist > 3.2 && arms0 && arms0[1] && inner0.userData.waving) { arms0[1].rotation.x = inner0.userData.armRest || 0; inner0.userData.waving = false; } // stop waving once you have walked on (an umbrella arm stays up)
        if (dist > 6) { seen[i] = false; return; } if (dist > 3.2) return;
        p.rotation.y = Math.atan2(-ddz, ddx); // face you
        var inner = p.children && p.children[0], arms = inner && inner.userData && inner.userData.arms;
        if (d.line && !seen[i]) { seen[i] = true; if (!bubble) { bubble = sprite('', '#fff', '#17181a', 9); world.add(bubble); } label(bubble, ((d.label || '') + ': ' + d.line).slice(0, 48), '#ffffff', '#17181a'); bubble.position.copy(p.position).add(new T.Vector3(0, 3.2, 0)); bubble.visible = true; bubbleAt = performance.now(); WK.greeted = (WK.greeted || 0) + 1; }
        else if (!d.line && arms && arms[1]) { if (!inner.userData.waving) { inner.userData.armRest = arms[1].rotation.x; inner.userData.waving = true; } arms[1].rotation.x = -2.6 + Math.sin(t * 10) * 0.35; } // a wave
      });
      // The nearest sign within reach lights up, with a "Do it" button.
      var near = -1, best = 3.6; (sc.acts || []).slice(0, 8).forEach(function (a, i) { if (!a) return; var q = SP()[i]; var dd2 = Math.hypot(q[0] - WK.x, q[1] - WK.z); if (dd2 < best) { best = dd2; near = i; } });
      if (near !== WK.near) { WK.near = near; var a2 = near >= 0 ? sc.acts[near] : null; doBtn.hidden = !a2 || !!sc.clean; if (a2) { doBtn.textContent = '▶ ' + (a2.icon || '') + ' ' + a2.short; doBtn.disabled = !!a2.off; } signs.forEach(function (sg, i) { sg.material.color.set(i === near ? 0xffe27a : 0xffffff); }); }
    }

    /* ---------- frame ---------- */
    function size() { var w = el.clientWidth || 360, h = el.clientHeight || 400; if (w === W && h === H) return; W = w; H = h; renderer.setSize(W, H, false); cv.style.width = W + 'px'; cv.style.height = H + 'px'; cam.aspect = W / H; cam.updateProjectionMatrix(); }
    function frame(now) {
      if (root.LasgidiGL && !root.LasgidiGL.live(el)) { raf = el.isConnected ? root.requestAnimationFrame(frame) : 0; return; } // hidden or under another view: skip the frame
      root.LasgidiGL && root.LasgidiGL.pace(renderer);
      size(); var t = reduce ? 3 : now / 1000, night = sc.night ? 1 : 0, rain = sc.weather === 'rain' || sc.weather === 'storm';
      var nv = night ? 0.85 : 0; if (Math.abs(skyU.night.value - nv) > 0.01) { skyU.night.value += (nv - skyU.night.value) * 0.1; if (Math.abs(skyU.night.value - nv) <= 0.01) { skyU.night.value = nv; bakeEnv(); } } hemi.intensity = night ? 0.25 : rain ? 0.6 : 0.85; sun.intensity = night ? 0.15 : rain ? 0.7 : 2.2; sun.color.set(night ? 0x8fa8ff : 0xffe2b8); hemi.color.set(0xfff1dd); hemi.groundColor.set(GAL ? 0xf4f1ea : 0x8a9a6a);
      S3.fog.color.set(night ? 0x0b1020 : rain || sc.grey ? 0xa9b2b8 : sc.weather === 'harmattan' ? 0xd9c49a : HAZE); S3.fog.density = (rain ? 0.006 : sc.weather === 'harmattan' ? 0.0055 : 0.0029) * (HARBOUR || ROOF || STAD || MKT || JTY || PRK || PLZ || STR ? 0.45 : 1);
      poolM.emissive.set(night ? 0x1fa9c9 : 0x000000); poolM.emissiveIntensity = night ? 0.9 : 0; // underwater lights after dark
      if (HARBOUR) {
        var beat = Math.abs(Math.sin(t * 2.2)), lit = night ? 1 : 0.35, show = sc.show !== false, fshow = sc.hour == null || (sc.hour >= 19 && sc.hour < 23), jk = fshow ? 1 : 0.45;
        HB.jets.forEach(function (j) { var h = j.ring === 3 ? 26 + 10 * Math.abs(Math.sin(t * 1.3)) : (8 + 10 * Math.abs(Math.sin(t * 2 + j.i * 0.4 + j.ring))) * (j.ring === 0 ? 1.1 : 1); j.m.scale.y = h * jk; j.m.material.color.setHSL(((t * 0.08 + j.i / 30 + j.ring * 0.2) % 1), night ? 0.9 : 0.15, night ? 0.6 : 0.95); j.m.material.opacity = night ? 0.8 : 0.65; });
        HB.beams.forEach(function (b, i) { b.visible = show; b.rotation.z = Math.sin(t * 0.9 + i) * 0.5; b.rotation.x = -0.6 + Math.cos(t * 0.7 + i) * 0.3; b.material.color.setHSL((t * 0.1 + i / 8) % 1, 0.9, 0.6); b.material.opacity = 0.05 + 0.12 * lit; });
        HB.cables.forEach(function (c) { c.l.material.color.setHSL((t * 0.12 + c.k * 0.06 + (c.sd > 0 ? 0.3 : 0)) % 1, 0.9, night ? 0.6 : 0.85); });
        HB.screens.forEach(function (st) { redrawAt(st, t, 12); });
        (HB.towers || []).forEach(function (m) { m.emissiveIntensity = night ? 0.9 : 0; }); HB.boards.forEach(function (m) { m.emissiveIntensity = night ? 0.9 : 0.2; }); HB.clubGlass.emissiveIntensity = night ? 0.6 : 0;
        HB.water.material.color.set(night ? 0x0b2236 : 0x1b4f6e); HB.lights.forEach(function (L0) { L0.intensity = night ? L0.userData.max * 3 : 0; }); if (night) hemi.intensity = 0.55;
        var mx = new T.Matrix4(); for (var ci = 0; ci < HB.crowdN; ci++) { var cb = HB.crowdBase[ci], jump = show && (night || reduce) ? Math.max(0, Math.sin(t * 6 + cb[2])) * 0.6 * beat : 0; mx.makeTranslation(cb[0], 1.2 + jump, cb[1]); HB.crowd.setMatrixAt(ci, mx); HB.heads.setMatrixAt(ci, mx); } HB.crowd.count = HB.heads.count = show ? HB.crowdN : 40; HB.crowd.instanceMatrix.needsUpdate = true; HB.heads.instanceMatrix.needsUpdate = true;
      } else if (STR) {
        streetFrame(reduce ? 30 : t, !!night); if (night) hemi.intensity = 0.4;
      } else if (GAL) {
        galleryFrame(reduce ? 30 : t); flowFrame(reduce ? 30 : t); if (GL.screens) GL.screens.forEach(function (m, k) { m.color.setHSL(0.6 + Math.sin(t * 0.3 + k) * 0.05, 0.6, 0.45); }); if (GL.screenTex) redrawAt(GL.screenTex, t, 4); hemi.intensity = 0.9; hemi.color.set(0xffffff); sun.intensity = 0; S3.fog.density = 0.002;
        if (GL.au) auditoriumFrame(reduce ? 30 : t);
      } else if (PLZ) {
        plazaFrame(reduce ? 30 : t, !!night); if (night) hemi.intensity = 0.4;
      } else if (PRK) {
        parkFrame(reduce ? 30 : t, !!night); if (night) hemi.intensity = 0.4;
      } else if (JTY) {
        jettyFrame(reduce ? 30 : t, !!night); if (night) hemi.intensity = 0.45;
      } else if (MKT) {
        var mopen = sc.hour == null ? !night : sc.hour >= 6 && sc.hour < 20;
        marketFrame(reduce ? 20 : t, mopen);
        MK.lamps.forEach(function (m) { m.color.set(night ? 0xffd27a : 0x5a5040); }); MK.lights.forEach(function (L0) { L0.intensity = night ? 18 : 0; }); MK.towers.forEach(function (m) { m.emissiveIntensity = night ? 0.7 : 0; }); if (night) hemi.intensity = 0.4;
      } else if (STAD) {
        var live = !!(sc.hour != null ? sc.hour >= 16 && sc.hour < 22 : sc.night), flood = live && !!night;
        matchFrame(reduce ? 30 : t, live || !!ST.street);
        ST.lights.forEach(function (L0) { L0.intensity = flood ? 900 : 0; }); ST.banks.forEach(function (m) { m.color.set(flood ? 0xffffff : 0x555a60); });
        ST.towers.forEach(function (m) { m.emissiveIntensity = night ? 0.9 : 0; }); if (night && flood) hemi.intensity = 0.45;
        if (ST.board) redrawAt(ST.board, t, 2);
      } else if (CLUB) {
        var open = !!(ROOF || night), A = CB.pal[0], B = CB.pal[1], kick = Math.pow(Math.abs(Math.sin(t * 3.9)), 3), cc = new T.Color(); CB.open = open;
        if (!ROOF) { hemi.intensity = open ? (DOLL ? 0.42 : 0.16) : 1.4; hemi.color.copy(open ? B : new T.Color(0xffffff)); sun.intensity = 0; S3.fog.color.copy(open ? CB.pal[2] : new T.Color(0x24262c)); S3.fog.density = open ? (DOLL ? 0.005 : 0.014) : 0.004; }
        else if (night) hemi.intensity = 0.4;
        if (CB.tiles) { for (var ti = 0; ti < CB.NT; ti++) for (var tj = 0; tj < CB.NT; tj++) { var wv = 0.5 + 0.5 * Math.sin(t * 2.4 - Math.hypot(ti - 3.5, tj - 3.5) * 0.9); if (open) cc.copy(A).lerp(B, 0.5 + 0.5 * Math.sin(t * 0.7 + ti * 0.5 + tj * 0.3)).multiplyScalar(0.25 + 0.95 * wv * (0.6 + 0.4 * kick)); else cc.set(0x1c1c1f); CB.tiles.setColorAt(ti * CB.NT + tj, cc); } CB.tiles.instanceColor.needsUpdate = true; }
        if (CB.lasers) { CB.lasers.visible = open; var lp = CB.lasers.geometry.attributes.position, O = CB.laserO; CB.lasers.material.color.setHSL((0.33 + Math.floor(t / 4) * 0.21) % 1, 1, 0.55); for (var li = 0; li < CB.NL; li++) { var la = -0.9 + 1.8 * li / (CB.NL - 1) + Math.sin(t * 1.3) * 0.35, ev = -0.2 + Math.sin(t * 0.9 + li * 0.25) * 0.1; lp.setXYZ(li * 2, O[0], O[1], O[2]); lp.setXYZ(li * 2 + 1, O[0] + Math.sin(la) * 64, O[1] + ev * 64, O[2] - Math.cos(la) * 64); } lp.needsUpdate = true; }
        CB.beams.forEach(function (b, i) { b.visible = open; b.rotation.z = Math.sin(t * 1.1 + i) * 0.55; b.rotation.x = Math.cos(t * 0.8 + i * 1.7) * 0.45; b.material.color.copy(i % 2 ? A : B); b.material.opacity = 0.07 + 0.08 * kick; });
        CB.lights.forEach(function (L0, i) { var on = ROOF ? night : open; L0.color.copy(on || ROOF ? L0.userData.c : new T.Color(0xfff4e0)); L0.intensity = on ? L0.userData.max * (CB.flame && i === 0 ? 0.8 + 0.3 * Math.sin(t * 13) : 0.7 + 0.5 * kick) : ROOF ? 0 : L0.userData.max * 0.55; });
        if (CB.cash) { var m5 = new T.Matrix4(), q5 = new T.Quaternion(), e5 = new T.Euler(), v5 = new T.Vector3(), s5 = new T.Vector3(1, 1, 1); CB.cash.visible = open && (!CB.rainOnly || !!sc.rain); for (var ci = 0; ci < CB.NC; ci++) { var ck = (ci / CB.NC + t * 0.09 * (0.7 + (ci % 5) * 0.1)) % 1; v5.set(-9 + (ci * 0.618 % 1) * 18, 9 - ck * 9, -3 + (ci * 0.377 % 1) * 19); e5.set(t * 2 + ci, t * 1.3 + ci * 0.5, 0); CB.cash.setMatrixAt(ci, m5.compose(v5, q5.setFromEuler(e5), s5)); } CB.cash.instanceMatrix.needsUpdate = true; }
        if (CB.band) CB.band.forEach(function (f, i) { f.position.y = 1.6 + (open && !reduce ? Math.abs(Math.sin(t * 4 + i)) * 0.15 : 0); var lg7 = f.userData.legs; if (lg7 && open && !reduce) { lg7[0].rotation[f.userData.axis || 'z'] = Math.sin(t * 4 + i) * 0.25; lg7[1].rotation[f.userData.axis || 'z'] = -Math.sin(t * 4 + i) * 0.25; } });
        if (CB.poles) CB.poles.forEach(function (P, i) { var a6 = reduce ? P.ph : t * 1.2 + P.ph, up = reduce ? 0.6 : 0.6 + Math.max(0, Math.sin(t * 0.6 + P.ph)) * 2.2; P.g.position.set(P.x + Math.cos(a6) * 0.45, up, P.z + Math.sin(a6) * 0.45); P.g.rotation.y = -a6 + Math.PI; var lg6 = P.g.userData.legs; if (lg6) { lg6[0].rotation[P.g.userData.axis || 'z'] = up > 1 ? 0.9 : Math.sin(t * 4 + i) * 0.3; lg6[1].rotation[P.g.userData.axis || 'z'] = up > 1 ? -0.3 : -Math.sin(t * 4 + i) * 0.3; } });
        if (CB.owambe) CB.owambe.forEach(function (f, i) { var u = f.userData, a5 = Math.sin(t * 6 + i) * 0.5; if (u.arms) u.arms.forEach(function (l, k) { l.rotation.x = open && i >= 4 && i % 2 ? -1.8 - Math.sin(t * 6 + i + k * 3) * 0.5 : (k ? a5 : -a5) * 0.4; }); if (u.legs && i >= 4) u.legs.forEach(function (l, k) { l.rotation.x = open ? (k ? -a5 : a5) * 0.6 : 0; }); });
        CB.sparks.forEach(function (pt) { pt.visible = open; var a = pt.geometry.attributes.position; for (var k = 0; k < a.count; k++) { var u = Math.random(), an = Math.random() * 6.283, rr2 = u * 0.5; a.setXYZ(k, Math.cos(an) * rr2, u * 1.1, Math.sin(an) * rr2); } a.needsUpdate = true; });
        CB.screens.forEach(function (st) { redrawAt(st, t, CB.open ? 12 : 0.5); });
        CB.towers.forEach(function (m) { m.emissiveIntensity = night ? 0.9 : 0; }); if (CB.bulbs) CB.bulbs.color.set(night ? 0xffd27a : 0x6b6458); if (CB.water) CB.water.material.color.set(night ? 0x0b2236 : 0x1b4f6e);
        if (CB.flame) { CB.flame.scale.set(1 + Math.sin(t * 11) * 0.08, 0.85 + Math.abs(Math.sin(t * 7.3)) * 0.35, 1 + Math.cos(t * 9) * 0.08); CB.flame.material.opacity = night ? 0.85 : 0.5; }
        if (CB.crowd) { var cm = new T.Matrix4(), cnt = open ? CB.n : 0; CB.crowd.count = CB.heads.count = cnt; for (var di = 0; di < cnt; di++) { var db = CB.base[di], hop = ROOF ? Math.max(0, Math.sin(t * 2 + db[2])) * 0.08 : Math.max(0, Math.sin(t * 7.8 + db[2])) * 0.45 * (0.4 + 0.6 * kick); cm.makeRotationY(db[2]); cm.setPosition(db[0], hop, db[1]); CB.crowd.setMatrixAt(di, cm); CB.heads.setMatrixAt(di, cm); } CB.crowd.instanceMatrix.needsUpdate = true; CB.heads.instanceMatrix.needsUpdate = true; }
      } else if (ESTATE) spray.forEach(function (d, i) { var u = ((reduce ? 0.5 : t * 0.55) + i / spray.length) % 1, a = i * 2.39, rad = (i % 4 === 0 ? 0.3 : 2.6) * u; d.position.set(LAKE.x + Math.cos(a) * rad, 0.7 + Math.sin(u * Math.PI) * (i % 4 === 0 ? 9 : 4.5), LAKE.z + Math.sin(a) * rad * 0.8); });
      else if (!reduce) waves(t);
      foam.position.z = SEA0 - 1 + Math.sin(t * 0.8) * 1.6; foam.material.opacity = 0.65 + Math.sin(t * 0.8 + 1) * 0.3; wet.position.z = SEA0 - 3.5 + Math.sin(t * 0.8 - 0.6) * 1.2;
      jetski.position.set(-60 + ((t * 9) % 140), -0.2 + Math.sin(t * 3) * 0.15, SEA0 + 30); jetski.rotation.y = 0; sail.position.set(80 - ((t * 1.5) % 200), -0.3, 180); sail.rotation.z = Math.sin(t) * 0.04;
      palms.forEach(function (o) { o.userData.crown.rotation.z = Math.sin(t * 0.9 + o.position.x) * 0.04; });
      crowd.forEach(function (p, i) { if (!p.visible || !p.userData.home) return; var hx = p.userData.home[0], hz = p.userData.home[1], u = reduce ? 0 : Math.sin(t * 0.25 + i), x = hx + u * 2.5, z = hz + Math.cos(t * 0.2 + i) * 1.2; p.position.set(x, groundY(x, z), z); p.rotation.y = Math.cos(t * 0.25 + i) > 0 ? Math.PI / 2 : -Math.PI / 2; var a = reduce ? 0 : Math.sin(t * 6 + i) * 0.45; p.userData.legs[0].rotation[p.userData.axis || 'z'] = a; p.userData.legs[1].rotation[p.userData.axis || 'z'] = -a; });
      var wdt = Math.min(0.25, Math.max(0, (now - (WK.last || now)) / 1000)); WK.last = now;
      if (me && sc.me && WK.on) { walkFrame(wdt, t); label(meTag, sc.me.say ? sc.me.say.slice(0, 40) : 'You', '#2f6fd0', '#fff'); meTag.scale.set(sc.me.say ? 9 : 2.4, (sc.me.say ? 9 : 2.4) * 96 / 512, 1); meTag.position.set(WK.x, me.position.y + 2.7, WK.z); }
      else if (me && sc.me) { var q = SP()[(sc.meSlot || 5) % SP().length], mx = q[0] + 1.6, mz = q[1] + 2.5; me.position.set(mx, groundY(mx, mz), mz); if (me.userData.axis) me.rotation.y = Math.PI / 2; label(meTag, sc.me.say ? sc.me.say.slice(0, 40) : 'You', '#2f6fd0', '#fff'); meTag.scale.set(sc.me.say ? 9 : 2.4, (sc.me.say ? 9 : 2.4) * 96 / 512, 1); meTag.position.set(mx, me.position.y + 2.7, mz); }
      festFrame(reduce ? 30 : t);
      if (letter && sc.letter) { var lq = SP()[sc.letter.slot % SP().length], lx = lq[0] + 2.8, lz = lq[1] + 1.5; letter.position.set(lx, groundY(lx, lz) + 3.4 + (reduce ? 0 : Math.sin(t * 2) * 0.3), lz); if (beacon) { beacon.position.set(lx, groundY(lx, lz) + 0.06, lz); var rs = reduce ? 1 : 1 + 0.22 * Math.sin(t * 3.2); beacon.userData.ring.scale.set(rs, 1, rs); } letter.scale.setScalar(1.7); letter.rotation.y = reduce ? 0.4 : t * 0.9; if (WK.on && me && Math.hypot(WK.x - lx, WK.z - lz) < 2.4 && !letter.userData.caught) { letter.userData.caught = true; if (opts.onLetter) opts.onLetter(); } }
      if (gem && sc.gem) { var gq = SP()[sc.gem.slot % SP().length]; gem.position.set(gq[0] - 2.5, groundY(gq[0] - 2.5, gq[1] + 2) + 1.2 + Math.sin(t * 2) * 0.25, gq[1] + 2); gem.rotation.y = t * 1.5; }
      strollers.forEach(function (p, i) { p.visible = !CLUB || i < (sc.night || ROOF ? 5 : 1); var x = CLUB ? -20 + ((i * 9 + (reduce ? 0 : t * (i % 2 ? 0.7 : -0.6))) % 40 + 40) % 40 : -50 + ((i * 13 + (reduce ? 0 : t * (i % 2 ? 0.9 : -0.8))) % 100 + 100) % 100, z = STR ? -2 + (i % 3) * 0.5 : GAL ? -16 + (i % 3) * 1.2 : PLZ ? -34 + (i % 3) * 1.2 : PRK ? -24 + (i % 3) * 1.2 : JTY ? -26 + (i % 3) * 1.2 : MKT ? -36 + (i % 3) * 1.2 : STAD ? (sc.street ? -21 : -44) + (i % 3) * 1.2 : CLUB ? -22 + (i % 3) * 2 : HARBOUR ? -50 + (i % 3) * 3 : SEA0 - 4 + (i % 3) * 1.2; p.position.set(x, groundY(x, z), z); p.rotation.y = i % 2 ? Math.PI / 2 : -Math.PI / 2; var a = reduce ? 0 : Math.sin(t * 6 + i) * 0.45; p.userData.legs[0].rotation[p.userData.axis || 'z'] = a; p.userData.legs[1].rotation[p.userData.axis || 'z'] = -a; });
      if (bubble && bubble.visible && now - bubbleAt > 3500) bubble.visible = false;
      weatherFrame(t, now);
      raveFrame(t, !ESTATE && !HARBOUR && !CLUB && !STAD && !MKT && !JTY && !PRK && !PLZ && !GAL && !STR && !!sc.night && (sc.hour == null || sc.hour >= 20 || sc.hour < 4));
      SEAS.bulbs.forEach(function (b, i) { b.visible = reduce || Math.floor(t * 2 + i * 0.37) % 3 !== 0; });
      signs.forEach(function (s) { s.visible = s.visible && !sc.clean; });
      renderer.render(S3, cam);
      raf = el.isConnected ? root.requestAnimationFrame(frame) : 0;
    }
    return {
      el: el, canvas: cv, is3d: true,
      update: function (next) { sc = next || sc; build(); seasonal(); syncSigns(); syncPeople(); syncLetter(); syncFest(); if (WK.reset && me) { WK.reset = false; walkStart(); WK.near = -2; } cv.setAttribute('aria-label', (sc.name || 'The beach') + ' in 3D. Drag to look around, tap a sign to do it.'); if (!raf && el.isConnected) raf = root.requestAnimationFrame(frame); },
      start: function () { if (!raf) raf = root.requestAnimationFrame(frame); },
      stop: function () { if (raf) root.cancelAnimationFrame(raf); raf = 0; },
      walk: function () { return { on: WK.on, x: WK.x, z: WK.z, near: WK.near, greeted: WK.greeted || 0 }; },
      letterAt: function () { return letter ? { x: letter.position.x, z: letter.position.z } : null; }, // for tests
      peopleAt: function () { return crowd.map(function (p, i) { var d = (sc.people || [])[i]; return p.visible && d ? { x: p.position.x, z: p.position.z, line: !!d.line } : null; }); }, // for tests
      screenOf: function (x, z, dy) { var v = new T.Vector3(x, groundY(x, z) + (dy || 0), z).project(cam), r = cv.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }, // for tests
    };
  }
  root.LasgidiBeach3D = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
