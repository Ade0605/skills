/* Lasgidi: your avatar in real 3D (three.js). figure(T, look, outfit, extra) builds a person from the same look
   (skin, hair, body shape) and wardrobe (top, bottom, dress, shoes, head, accessory, extra) as the 2D avatar:
   ankara, adire and aso-oke tops get their patterns, agbada and kaftan their wide sleeves, the gele its folds.
   When three.js is ready, LasgidiAvatar.draw() renders this figure (three-quarter view, soft light) into the same
   2D canvas the game already uses, so the HUD, profile, wardrobe and set-up all show it; before that, or without
   WebGL, the 2D drawing is used. Figures stand about 1.85 units tall with their feet at y = 0. */
(function (root) {
  'use strict';
  var D = root.LASGIDI_DATA;
  var PAT = {};
  function patternTex(T, fabric, color, alt) {
    var key = fabric + color + alt; if (PAT[key]) return PAT[key];
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 128, 128);
    var a = alt || '#f2b600';
    if (fabric === 'ankara') { for (var y = 0; y < 128; y += 32) for (var x = 0; x < 128; x += 32) { g.fillStyle = a; g.beginPath(); g.arc(x + 16, y + 16, 10, 0, Math.PI * 2); g.fill(); g.fillStyle = color; g.beginPath(); g.arc(x + 16, y + 16, 5, 0, Math.PI * 2); g.fill(); g.strokeStyle = a; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 8); g.stroke(); } }
    else if (fabric === 'adire') { g.strokeStyle = a; g.lineWidth = 4; for (var k = 0; k < 128; k += 16) { g.beginPath(); g.moveTo(0, k); for (var xx = 0; xx <= 128; xx += 8) g.lineTo(xx, k + (xx % 16 ? 4 : -4)); g.stroke(); } for (var d = 0; d < 10; d++) { g.fillStyle = a; g.fillRect((d * 37) % 128, (d * 53) % 128, 6, 6); } }
    else if (fabric === 'asooke') { for (var s = 0; s < 128; s += 12) { g.fillStyle = s % 24 ? a : 'rgba(255,255,255,.18)'; g.fillRect(0, s, 128, 3); } }
    else if (fabric === 'lace') { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; for (var lx = 0; lx < 128; lx += 16) for (var ly = 0; ly < 128; ly += 16) { g.beginPath(); g.arc(lx + 8, ly + 8, 5, 0, Math.PI * 2); g.stroke(); } }
    else if (fabric === 'denim') { for (var dn = 0; dn < 1200; dn++) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.08) + ')'; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 1); } }
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2, 2); PAT[key] = t; return t;
  }
  function figure(T, look, outfit, extra) {
    look = look || { skin: 2, hair: 0, shape: 1 }; var o = outfit || {}, C = function (slot) { return o[slot] && D.CLOTHES[o[slot]] ? D.CLOTHES[o[slot]] : null; };
    var top = C('top'), bottom = C('bottom'), dress = C('dress'), shoes = C('shoes'), head = C('head'), acc = C('acc');
    var k = [0.88, 1, 1.16][look.shape] || 1, skinHex = D.LOOKS.skin[look.skin] || D.LOOKS.skin[2], hairName = D.LOOKS.hair[look.hair] || 'Low cut';
    var g = new T.Group(), M = function (color, rough, metal, map) { return new T.MeshStandardMaterial({ color: map ? 0xffffff : color, map: map || null, roughness: rough == null ? 0.7 : rough, metalness: metal || 0 }); };
    var skin = M(skinHex, 0.6), hairM = M(0x17110c, 0.9);
    function cloth(it, fallback) { if (!it) return M(fallback, 0.8); return /ankara|adire|asooke|lace|denim/.test(it.fabric || '') ? M(0xffffff, 0.8, 0, patternTex(T, it.fabric, it.color, it.alt)) : M(it.color || fallback, it.fabric === 'leather' ? 0.4 : 0.8); }
    function add(geo, m, x, y, z, parent) { var mesh = new T.Mesh(geo, m); mesh.position.set(x || 0, y || 0, z || 0); mesh.castShadow = true; (parent || g).add(mesh); return mesh; }
    var long = dress && /agbada|kaftan|gown|iro|designer/.test(o.dress || ''), robe = dress && /agbada|kaftan/.test(o.dress), gown = dress && /gown|iro/.test(o.dress);
    var topM = dress ? cloth(dress) : cloth(top, 0xf4f3ec), botM = dress && o.dress === 'designer' ? cloth(dress) : cloth(bottom, 0x3d5a80);
    // Legs (with hips as pivots), shoes.
    var legs = [];
    [-1, 1].forEach(function (sd) { var lg = new T.Group(); lg.position.set(sd * 0.1 * k, 0.92, 0); g.add(lg); var trouser = !bottom || !/wrapper|skirt/.test(o.bottom || '') ; add(new T.CapsuleGeometry(0.075 * k, 0.72, 4, 10), trouser && !gown ? botM : skin, 0, -0.44, 0, lg); add(new T.BoxGeometry(0.12, 0.08, 0.24), shoes ? M(shoes.color, 0.45) : M(0x2b2f36, 0.6), 0, -0.88, 0.04, lg); legs.push(lg); });
    // Wrapper or skirt over the legs; gowns and robes flare to the knees or ankles.
    if (!dress && bottom && /wrapper|skirt/.test(o.bottom)) add(new T.CylinderGeometry(0.2 * k, 0.24 * k, o.bottom === 'skirt' ? 0.5 : 0.78, 20, 1, true), botM, 0, o.bottom === 'skirt' ? 0.75 : 0.56, 0).material.side = T.DoubleSide;
    if (long) { var len = robe || gown ? 1.12 : 0.62, rob = add(new T.CylinderGeometry(0.2 * k, (robe ? 0.42 : gown ? 0.34 : 0.24) * k, len, 24, 1, true), topM, 0, 1.42 - len / 2, 0); rob.material.side = T.DoubleSide; }
    // Torso and chest.
    var torso = add(new T.CapsuleGeometry(0.17 * k, 0.36, 6, 14), topM, 0, 1.22, 0); torso.scale.set(1.15, 1, 0.75);
    add(new T.CylinderGeometry(0.06, 0.07, 0.1, 12), skin, 0, 1.5, 0);
    // Arms with shoulder pivots; robes get wide sleeves.
    var arms = [];
    [-1, 1].forEach(function (sd) { var ar = new T.Group(); ar.position.set(sd * 0.26 * k, 1.42, 0); ar.rotation.z = sd * 0.08; g.add(ar); var sleeve = robe ? add(new T.CylinderGeometry(0.08, 0.2, 0.5, 14, 1, true), topM, sd * 0.04, -0.22, 0, ar) : add(new T.CapsuleGeometry(0.062 * k, top && /tee|jersey|crop/.test(o.top || '') ? 0.18 : 0.38, 4, 8), topM, 0, top && /tee|jersey|crop/.test(o.top || '') ? -0.1 : -0.2, 0, ar); if (robe) sleeve.material.side = T.DoubleSide; add(new T.CapsuleGeometry(0.05, 0.36, 4, 8), skin, 0, -0.36, 0, ar); add(new T.SphereGeometry(0.055, 10, 8), skin, 0, -0.58, 0, ar); arms.push(ar); });
    // Head, face, ears.
    var hd = add(new T.SphereGeometry(0.135, 24, 18), skin, 0, 1.7, 0); hd.scale.set(0.92, 1.08, 0.98);
    var eyeM = M(0x111111, 0.3); [-1, 1].forEach(function (sd) { add(new T.SphereGeometry(0.016, 8, 6), eyeM, sd * 0.045, 1.72, 0.12); add(new T.SphereGeometry(0.03, 8, 6), skin, sd * 0.13, 1.7, 0); });
    add(new T.SphereGeometry(0.022, 8, 6), skin, 0, 1.68, 0.135); add(new T.BoxGeometry(0.05, 0.008, 0.01), M(0x5a2a1a, 0.6), 0, 1.635, 0.125);
    // Hair by style (under any hat).
    var capOn = head && /cap|fila/.test(o.head || ''), geleOn = head && o.head === 'gele'; if (capOn && hairName !== 'Bald' && hairName !== 'Locs' && hairName !== 'Braids') hairName = 'Low cut';
    if (!geleOn) {
      if (hairName === 'Afro') { var af = add(new T.SphereGeometry(0.19, 18, 14), hairM, 0, 1.8, -0.07); af.scale.set(1.05, 0.95, 0.9); }
      else if (hairName === 'Locs' || hairName === 'Braids') { add(new T.SphereGeometry(0.142, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), hairM, 0, 1.71, 0); for (var b = 0; b < 14; b++) { var a2 = Math.PI * 0.15 + b / 13 * Math.PI * 0.7 + Math.PI; add(new T.CylinderGeometry(0.014, 0.012, hairName === 'Locs' ? 0.32 : 0.4, 5), hairM, Math.cos(a2) * 0.12, 1.56, Math.sin(a2) * 0.1 - 0.02); } }
      else if (hairName === 'Bantu knots') { add(new T.SphereGeometry(0.139, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), hairM, 0, 1.71, 0); [[0, 1.86, 0], [-0.08, 1.82, 0.05], [0.08, 1.82, 0.05], [-0.1, 1.8, -0.07], [0.1, 1.8, -0.07]].forEach(function (q) { add(new T.SphereGeometry(0.035, 10, 8), hairM, q[0], q[1], q[2]); }); }
      else if (hairName === 'Cornrows') { for (var r = 0; r < 6; r++) { var row = add(new T.TorusGeometry(0.13, 0.012, 6, 20, Math.PI), hairM, -0.06 + r * 0.024, 1.71, 0); row.rotation.y = Math.PI / 2; } }
      else if (hairName === 'Short twists') { add(new T.SphereGeometry(0.15, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), hairM, 0, 1.71, 0); for (var tw = 0; tw < 18; tw++) { var ta = tw * 2.4, tr = 0.04 + (tw % 4) * 0.025; add(new T.ConeGeometry(0.018, 0.05, 5), hairM, Math.cos(ta) * tr, 1.84 - tr * 0.4, Math.sin(ta) * tr); } }
      else if (hairName !== 'Bald') add(new T.SphereGeometry(0.139, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), hairM, 0, 1.715, -0.005);
    }
    // Headwear.
    if (geleOn) { var gm = M(head.color, 0.5, 0.2); var g1 = add(new T.TorusGeometry(0.15, 0.06, 10, 24), gm, 0, 1.82, -0.02); g1.rotation.x = Math.PI / 2 - 0.3; var g2 = add(new T.ConeGeometry(0.22, 0.22, 20, 1, true), gm, 0, 1.94, -0.04); g2.rotation.x = -0.3; g2.material.side = T.DoubleSide; add(new T.TorusGeometry(0.1, 0.05, 8, 20, Math.PI * 1.4), gm, 0.1, 1.96, -0.04).rotation.y = 1; }
    else if (head && o.head === 'fila') add(new T.CylinderGeometry(0.13, 0.14, 0.13, 20), M(head.color, 0.8), 0, 1.84, 0).rotation.z = 0.15;
    else if (capOn) { add(new T.SphereGeometry(0.145, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(head.color, 0.7), 0, 1.75, 0); add(new T.CylinderGeometry(0.09, 0.09, 0.015, 16, 1, false, -Math.PI / 2, Math.PI), M(head.color, 0.7), 0, 1.76, 0.12); }
    // Accessories.
    if (acc && o.acc === 'beads') { add(new T.TorusGeometry(0.1, 0.022, 8, 24), M(acc.color, 0.4), 0, 1.47, 0.02).rotation.x = Math.PI / 2 - 0.25; }
    if (acc && o.acc === 'chain') { add(new T.TorusGeometry(0.12, 0.012, 6, 28, Math.PI), M(acc.color, 0.2, 0.9), 0, 1.42, 0.08).rotation.z = Math.PI; }
    if (acc && o.acc === 'watch') add(new T.BoxGeometry(0.06, 0.04, 0.06), M(acc.color, 0.2, 0.9), 0, -0.48, 0.02, arms[1]);
    if (acc && o.acc === 'umbrella') { var um = add(new T.ConeGeometry(0.55, 0.22, 12, 1, true), M(acc.color, 0.7), 0, 0.42, 0.1, arms[1]); um.material.side = T.DoubleSide; add(new T.CylinderGeometry(0.01, 0.01, 1, 6), M(0x2b2f36), 0, -0.05, 0.1, arms[1]); arms[1].rotation.x = -2.6; }
    if (extra && extra.look === 'shades') { var sm = M(/^#[0-9a-f]{6}$/i.test(extra.color || '') ? extra.color : '#17181a', 0.15, 0.6); [-1, 1].forEach(function (sd) { add(new T.BoxGeometry(0.07, 0.04, 0.012), sm, sd * 0.045, 1.725, 0.13); }); }
    if (extra && extra.look === 'chain') add(new T.TorusGeometry(0.12, 0.012, 6, 28, Math.PI), M(extra.color || '#d8dce2', 0.2, 0.9), 0, 1.42, 0.08).rotation.z = Math.PI;
    g.userData.legs = legs; g.userData.arms = arms; g.userData.k = k;
    return g;
  }

  /* ---------- the portrait renderer: one shared WebGL context draws portraits into 2D canvases ---------- */
  var R = null, cache = {};
  function portraitRenderer(T) {
    if (R !== null) return R;
    try {
      var rend = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); rend.setPixelRatio(1); rend.setSize(360, 520, false); rend.toneMapping = T.ACESFilmicToneMapping; rend.outputColorSpace = T.SRGBColorSpace;
      var sc = new T.Scene(), cam = new T.PerspectiveCamera(26, 360 / 520, 0.1, 20); cam.position.set(1.9, 1.45, 4.6); cam.lookAt(0, 1.0, 0);
      sc.add(new T.HemisphereLight(0xfff4e6, 0x8090a0, 1.1)); var key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(2, 3, 3); sc.add(key); var rim = new T.DirectionalLight(0xbcd4ff, 0.8); rim.position.set(-2, 2, -2); sc.add(rim);
      var shadow = new T.Mesh(new T.CircleGeometry(0.42, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 })); sc.add(shadow);
      R = { r: rend, sc: sc, cam: cam };
    } catch (e) { R = false; }
    return R;
  }
  function draw3d(canvas, look, outfit, extra) {
    var T = root.THREE; if (!T) return false; var P = portraitRenderer(T); if (!P) return false;
    var key = JSON.stringify([look, outfit, extra]), img = cache[key];
    if (!img) {
      var fig = figure(T, look, outfit, extra); fig.rotation.y = -0.35; P.sc.add(fig); P.r.render(P.sc, P.cam); P.sc.remove(fig);
      fig.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      img = document.createElement('canvas'); img.width = 360; img.height = 520; img.getContext('2d').drawImage(P.r.domElement, 0, 0);
      var keys = Object.keys(cache); if (keys.length > 60) delete cache[keys[0]]; cache[key] = img;
    }
    var dpr = Math.min(2, root.devicePixelRatio || 1), W = 180, H = 260;
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return true;
  }
  root.LasgidiAvatar3D = { figure: figure, draw: draw3d };
  // Upgrade the 2D avatar in place: every caller of LasgidiAvatar.draw gets the 3D portrait once three.js is ready.
  if (root.LasgidiAvatar && !root.LasgidiAvatar.draw2d) { var d2 = root.LasgidiAvatar.draw; root.LasgidiAvatar.draw2d = d2; root.LasgidiAvatar.draw = function (canvas, look, outfit, extra) { try { if (draw3d(canvas, look, outfit, extra)) return; } catch (e) {} return d2(canvas, look, outfit, extra); }; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
