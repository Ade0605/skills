/* Lasgidi — the detailed city street for rides (our own look, all names made up). A gradient sky with a sun glow and
   clouds; asphalt with grain, patches and lane markings; painted kerbs and paved walks; Lagos-style blocks (painted
   walls, burglar-proof windows, AC units, black water tanks on the roof), shops with awnings and signboards,
   glass office towers, billboards and wooden power poles with wires. Used by ride3d.js for city roads; `lite` trims
   texture sizes and the small details for phones. The road runs along z; buildings stand at x = ±(9.5 …). */
(function (root) {
  'use strict';
  var C = {}; // textures and materials, built once
  function rnd(seed) { var s = seed >>> 0 || 1; return function () { s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0; return (s >>> 8) / 16777216; }; }
  function canvasTex(T, w, h, draw, rep) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
  function grain(g, w, h, n, a, r) { for (var i = 0; i < n; i++) { var v = r(); g.fillStyle = 'rgba(' + (v > 0.5 ? '255,255,255' : '0,0,0') + ',' + (a * r()) + ')'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } }

  // The road surface: four lanes, a double yellow centre line, dashed white lane lines, solid edge lines.
  function asphalt(T, lite, london) {
    var k = 'asphalt' + (lite ? 'L' : '') + (london ? 'U' : ''); if (C[k]) return C[k];
    var W = lite ? 256 : 512, H = lite ? 512 : 1024;
    C[k] = canvasTex(T, W, H, function (g, w, h) {
      var r = rnd(7); g.fillStyle = '#35393f'; g.fillRect(0, 0, w, h); grain(g, w, h, lite ? 6000 : 26000, 0.22, r);
      for (var p = 0; p < 7; p++) { g.fillStyle = 'rgba(' + (p % 2 ? '20,22,26' : '70,74,80') + ',.35)'; g.fillRect(r() * w * 0.8, r() * h, 20 + r() * 60, 30 + r() * 120); } // patches
      g.strokeStyle = 'rgba(15,16,18,.35)'; g.lineWidth = 1.2; for (var c = 0; c < 10; c++) { g.beginPath(); var x = r() * w, y = r() * h; g.moveTo(x, y); for (var s = 0; s < 6; s++) { x += (r() - 0.5) * 30; y += r() * 26; g.lineTo(x, y); } g.stroke(); } // cracks
      g.fillStyle = 'rgba(10,10,12,.18)'; [0.27, 0.73].forEach(function (f) { g.fillRect(w * f - 10, 0, 6, h); g.fillRect(w * f + 6, 0, 6, h); }); // tyre tracks
      var line = function (x, col, dash) { g.fillStyle = col; for (var y = 0; y < h; y += dash ? h / 4 : h) g.fillRect(x - w * 0.006, y, w * 0.012, dash ? h / 8 : h); };
      line(w * 0.03, '#eeeae0', false); line(w * 0.97, '#eeeae0', false);
      if (london) { line(w * 0.5, '#eeeae0', true); } else { line(w * 0.49, '#f2c200', false); line(w * 0.51, '#f2c200', false); }
      line(w * 0.25, '#eeeae0', true); line(w * 0.75, '#eeeae0', true);
    }, [1, 12]);
    return C[k];
  }
  function paving(T, lite) {
    if (C.pave) return C.pave;
    C.pave = canvasTex(T, lite ? 128 : 256, lite ? 128 : 256, function (g, w, h) {
      var r = rnd(11); g.fillStyle = '#bdb6a8'; g.fillRect(0, 0, w, h); var s = w / 8;
      for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) { var o = y % 2 ? s / 2 : 0; g.fillStyle = 'hsl(' + (30 + r() * 12) + ',' + (8 + r() * 8) + '%,' + (66 + r() * 10) + '%)'; g.fillRect(x * s + o + 1, y * s + 1, s - 2, s - 2); }
      grain(g, w, h, 1500, 0.12, r);
    }, [2, 40]);
    return C.pave;
  }
  function kerbTex(T) { return C.kerb || (C.kerb = canvasTex(T, 128, 16, function (g, w, h) { for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f2efe6' : '#1d1f23'; g.fillRect(i * w / 8, 0, w / 8, h); } }, [1, 40])); }
  // A sky dome: deep blue above a hazy horizon, warm near the sun.
  function skyDome(T, night, dusk) {
    var g = canvasTex(T, 16, 512, function (c, w, h) {
      var gr = c.createLinearGradient(0, 0, 0, h);
      if (night) { gr.addColorStop(0, '#060b1f'); gr.addColorStop(0.55, '#14214a'); gr.addColorStop(1, '#2b3b66'); }
      else if (dusk) { gr.addColorStop(0, '#2c4d8a'); gr.addColorStop(0.45, '#c97f6a'); gr.addColorStop(0.75, '#f4b26a'); gr.addColorStop(1, '#f7d6a6'); }
      else { gr.addColorStop(0, '#2f78c8'); gr.addColorStop(0.5, '#7fb9e6'); gr.addColorStop(0.82, '#cfe4f0'); gr.addColorStop(1, '#e8ecea'); }
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    });
    var m = new T.Mesh(new T.SphereGeometry(700, 24, 12), new T.MeshBasicMaterial({ map: g, side: T.BackSide, fog: false, depthWrite: false }));
    m.userData.sky = true; return m;
  }
  function sunGlow(T, night, dusk) {
    var t = canvasTex(T, 128, 128, function (c, w, h) { var gr = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, night ? 'rgba(235,240,255,1)' : 'rgba(255,252,235,1)'); gr.addColorStop(0.18, night ? 'rgba(220,230,255,.8)' : dusk ? 'rgba(255,190,110,.7)' : 'rgba(255,245,210,.6)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    var s = new T.Sprite(new T.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true })); s.scale.set(night ? 60 : 140, night ? 60 : 140, 1); return s;
  }
  function cloud(T, seed) {
    var t = C['cloud' + (seed % 3)] || (C['cloud' + (seed % 3)] = canvasTex(T, 256, 128, function (c, w, h) { var r = rnd(seed % 3 + 3); for (var i = 0; i < 18; i++) { var x = w * (0.2 + r() * 0.6), y = h * (0.45 + r() * 0.25), rr = 18 + r() * 34, gr = c.createRadialGradient(x, y, 1, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); } }));
    var s = new T.Sprite(new T.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true, opacity: 0.9 })); s.scale.set(160, 70, 1); return s;
  }
  // Facades: painted walls, windows with frames and burglar-proof bars, AC units, rain streaks. emissive: lit windows.
  var WALLS = ['#e8dcc4', '#f0c9a8', '#cfe0c8', '#d8d2e8', '#f4f1e8', '#e9b9a0', '#f2e3a0', '#c9dde6'];
  function facade(T, v, lite, emissive) {
    var k = 'fac' + v + (lite ? 'L' : '') + (emissive ? 'E' : ''); if (C[k]) return C[k];
    var W = lite ? 128 : 256, H = lite ? 128 : 256; // one floor, two window bays; repeated across the wall
    C[k] = canvasTex(T, W, H, function (g, w, h) {
      var r = rnd(v * 31 + 5), wall = WALLS[v % WALLS.length];
      if (emissive) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); } else { g.fillStyle = wall; g.fillRect(0, 0, w, h); grain(g, w, h, lite ? 400 : 1600, 0.1, r); g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, h * 0.9, w, h * 0.1); }
      [0, 1].forEach(function (b) {
        var x = w * (0.12 + b * 0.5), y = h * 0.22, ww = w * 0.28, wh = h * 0.5, lit = emissive && r() > 0.45;
        if (emissive) { if (lit) { g.fillStyle = ['#ffd58a', '#fff0c8', '#ffc66a'][Math.floor(r() * 3)]; g.fillRect(x + 3, y + 3, ww - 6, wh - 6); } return; }
        g.fillStyle = '#f4f3ec'; g.fillRect(x - 3, y - 3, ww + 6, wh + 6);
        var gl = g.createLinearGradient(x, y, x + ww, y + wh); gl.addColorStop(0, '#5b7184'); gl.addColorStop(0.5, '#a9bfcf'); gl.addColorStop(1, '#3f5262'); g.fillStyle = gl; g.fillRect(x, y, ww, wh);
        g.fillStyle = '#f4f3ec'; g.fillRect(x + ww / 2 - 1.5, y, 3, wh);
        if (v % 3 !== 2) { g.fillStyle = 'rgba(30,32,36,.75)'; for (var bb = 1; bb < 6; bb++) g.fillRect(x + bb * ww / 6 - 1, y, 2, wh); g.fillRect(x, y + wh / 2 - 1, ww, 2); }
        if ((v + b) % 2 === 0 && !lite) { g.fillStyle = '#e6e6e2'; g.fillRect(x + ww * 0.2, y + wh + 8, ww * 0.6, h * 0.1); g.fillStyle = '#9aa0a6'; for (var ff = 0; ff < 5; ff++) g.fillRect(x + ww * 0.24 + ff * ww * 0.11, y + wh + 11, 2, h * 0.07); }
        var st = g.createLinearGradient(0, y + wh, 0, h); st.addColorStop(0, 'rgba(60,50,40,.22)'); st.addColorStop(1, 'rgba(60,50,40,0)'); g.fillStyle = st; g.fillRect(x + 4, y + wh, ww - 8, h - y - wh);
      });
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, w, 4);
    });
    C[k].wrapS = C[k].wrapT = T.RepeatWrapping; return C[k];
  }
  function glassTex(T, lite, emissive) {
    var k = 'glass' + (lite ? 'L' : '') + (emissive ? 'E' : ''); if (C[k]) return C[k];
    C[k] = canvasTex(T, lite ? 64 : 128, lite ? 64 : 128, function (g, w, h) {
      var r = rnd(19);
      if (emissive) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) if (r() > 0.55) { g.fillStyle = 'rgba(255,230,170,.9)'; g.fillRect(i * w / 4 + 2, j * h / 4 + 2, w / 4 - 4, h / 4 - 5); } return; }
      var gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2e4a66'); gr.addColorStop(0.5, '#7ea3c2'); gr.addColorStop(1, '#25405a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9d2da'; for (var x = 0; x <= 4; x++) g.fillRect(x * w / 4 - 1, 0, 2, h); for (var y = 0; y <= 4; y++) g.fillRect(0, y * h / 4 - 2, w, 3);
    });
    C[k].wrapS = C[k].wrapT = T.RepeatWrapping; return C[k];
  }
  // Signboards and billboards (made-up names only).
  var SHOPS = ['Mama Tola Kitchen', 'Chidi Phones & Accessories', 'Grace Pharmacy', 'Blessed Hands Salon', 'Eko Fabrics', 'Divine Mercy Supermarket', 'Ola Barbing Saloon', 'Sharp Sharp Printing', 'Bisi Bakery', 'Unity Electricals'];
  var ADS = [['Gidi Mobile', '5G for everybody', '#7b2ff7', '#ffd400'], ['Eko Paints', 'Colour your house', '#e8443a', '#ffffff'], ['Jollof Express', 'Hot. Fast. Delivered.', '#f2a900', '#17181a'], ['Naija Bank', 'Save small, grow big', '#0f6b4a', '#ffffff'], ['Lagoon Water', 'Pure, cold, clean', '#1f6fd0', '#ffffff'], ['Vibes FM 99.1', 'The sound of Lagos', '#17181a', '#ffcc00']];
  var LDN_SHOPS = ['Kings Road Coffee', 'Thames News', 'The Red Lion', 'Camden Records', 'Market Grocers'];
  function signTex(T, text, bg, fg) { var k = 'sign:' + text; return C[k] || (C[k] = canvasTex(T, 512, 96, function (g, w, h) { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = '800 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2, w - 24); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); })); }
  function adTex(T, ad) { var k = 'ad:' + ad[0]; return C[k] || (C[k] = canvasTex(T, 512, 256, function (g, w, h) { var gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, ad[2]); gr.addColorStop(1, '#17181a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = ad[3]; g.font = '900 76px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(ad[0], 32, 120, w - 64); g.font = '600 36px system-ui, sans-serif'; g.fillStyle = '#ffffff'; g.fillText(ad[1], 34, 186, w - 64); g.fillStyle = ad[3]; g.fillRect(32, 210, 120, 8); })); }

  function uvScale(geo, su, sv) { var uv = geo.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); uv.needsUpdate = true; return geo; }
  function uvRow(geo, row, rows) { var uv = geo.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setY(i, (rows - 1 - row + uv.getY(i)) / rows); uv.needsUpdate = true; return geo; }
  // One texture sheet for every shop sign, one for every billboard (so they merge into a single draw each).
  function signSheet(T, list, night) { var k = 'signs' + list.length + (night ? 'N' : ''); return C[k] || (C[k] = canvasTex(T, 512, 96 * list.length, function (g, w, h) { var cols = [['#17181a', '#ffd400'], ['#ffffff', '#17181a'], ['#0f6b4a', '#ffffff'], ['#b3122a', '#ffffff'], ['#1f3b63', '#ffffff']]; list.forEach(function (t, i) { var c = cols[i % cols.length]; g.fillStyle = night ? '#000' : c[0]; g.fillRect(0, i * 96, w, 96); g.fillStyle = night ? '#fff' : c[1]; g.font = '800 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, i * 96 + 50, w - 24); if (!night) { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 6; g.strokeRect(3, i * 96 + 3, w - 6, 90); } }); })); }
  function adSheet(T) { return C.ads || (C.ads = canvasTex(T, 512, 256 * ADS.length, function (g, w, h) { ADS.forEach(function (ad, i) { var y0 = i * 256, gr = g.createLinearGradient(0, y0, w, y0 + 256); gr.addColorStop(0, ad[2]); gr.addColorStop(1, '#17181a'); g.fillStyle = gr; g.fillRect(0, y0, w, 256); g.fillStyle = ad[3]; g.font = '900 76px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(ad[0], 32, y0 + 120, w - 64); g.font = '600 36px system-ui, sans-serif'; g.fillStyle = '#ffffff'; g.fillText(ad[1], 34, y0 + 186, w - 64); g.fillStyle = ad[3]; g.fillRect(32, y0 + 210, 120, 8); }); })); }
  function M(T, k, o) { return C['m:' + k] || (C['m:' + k] = new T.MeshStandardMaterial(o)); }
  var NOSHADOW = false;
  function mesh(T, g, geo, m, x, y, z, shadow) { var o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = !NOSHADOW && shadow !== false; o.receiveShadow = true; g.add(o); return o; }

  // One stretch of street (12 m long) on side sd (−1 left, +1 right): a building or two, a power pole, maybe a billboard.
  function block(T, i, sd, o) {
    var g = new T.Group(), r = rnd(i * 97 + (sd > 0 ? 13 : 0) + 1), lite = !!o.lite, night = !!o.night, london = !!o.london; NOSHADOW = lite;
    // Walk, kerb and gutter.
    mesh(T, g, new T.BoxGeometry(3.4, 0.18, 12), M(T, 'pave', { map: paving(T, lite), roughness: 0.95 }), sd * 7.85, 0.09, 0, false);
    mesh(T, g, new T.BoxGeometry(0.28, 0.24, 12), M(T, 'kerb' + (london ? 'U' : ''), london ? { color: 0xbdb6a8, roughness: 0.9 } : { map: kerbTex(T), roughness: 0.8 }), sd * 6.14, 0.12, 0, false);
    var tall = !london && i % 5 === 2, setback = 9.8 + r() * 0.8;
    if (tall) { // a glass office tower set back from the road
      var th = 34 + Math.floor(r() * 30), tw = 10;
      mesh(T, g, uvScale(new T.BoxGeometry(tw, th, 11), tw / 3, th / 3), M(T, 'glassT' + (lite ? 'L' : '') + (night ? 'N' : ''), { map: glassTex(T, lite, false), roughness: 0.15, metalness: 0.65, emissive: night ? 0xffffff : 0x000000, emissiveMap: night ? glassTex(T, lite, true) : null, emissiveIntensity: night ? 0.8 : 0 }), sd * (setback + 6), th / 2, 0);
      mesh(T, g, new T.BoxGeometry(tw + 0.4, 1.2, 11.4), M(T, 'crown', { color: 0xd8dce2, roughness: 0.4, metalness: 0.5 }), sd * (setback + 6), th + 0.6, 0);
      mesh(T, g, new T.BoxGeometry(tw * 0.6, 4, 2.4), M(T, 'lobby', { color: 0x2f3a44, roughness: 0.2, metalness: 0.5 }), sd * (setback + 1.6), 2, 0);
    } else {
      var floors = london ? 3 + Math.floor(r() * 3) : 2 + Math.floor(r() * 5), fh = 3.1, H = floors * fh + 1, v = Math.floor(r() * 8), D = 8 + r() * 3, Wz = 11.6;
      var wallM = M(T, 'fac' + v + (lite ? 'L' : '') + (night ? 'N' : ''), { map: facade(T, v, lite, false), roughness: 0.9, emissive: night ? 0xffffff : 0x000000, emissiveMap: night ? facade(T, v, lite, true) : null, emissiveIntensity: night ? 0.6 : 0 }), side = M(T, 'wall' + v, { color: WALLS[v % WALLS.length], roughness: 0.92 });
      var bx = sd * (setback + D / 2); mesh(T, g, new T.BoxGeometry(D, H - 3.4, Wz), side, bx, 3.4 + (H - 3.4) / 2, 0);
      var fp = mesh(T, g, uvScale(new T.PlaneGeometry(Wz, H - 3.4), Wz / 4.2, floors), wallM, sd * (setback - 0.012), 3.4 + (H - 3.4) / 2, 0, false); fp.rotation.y = -sd * Math.PI / 2;
      // The shop floor: a darker base with a shop front, a coloured awning and a signboard.
      mesh(T, g, new T.BoxGeometry(D, 3.4, Wz), M(T, 'base', { color: 0xa39a8c, roughness: 0.9 }), bx, 1.7, 0);
      var front = sd * (setback - 0.02);
      mesh(T, g, new T.BoxGeometry(0.06, 2.6, Wz * 0.8), M(T, 'shopglass' + (night ? 'N' : ''), { color: night ? 0x6b5a3a : 0x4f6a80, roughness: 0.1, metalness: 0.3, emissive: night ? 0xffc46a : 0x000000, emissiveIntensity: night ? 0.3 : 0 }), front, 1.45, 0);
      var aw = mesh(T, g, new T.BoxGeometry(1.8, 0.1, Wz * 0.9), M(T, 'awn' + (i % 5), { color: [0xc0392b, 0x1f6fd0, 0x16a34a, 0xf2a900, 0x7b2ff7][i % 5], roughness: 0.8 }), sd * (setback - 0.9), 3.05, 0); aw.rotation.z = sd * 0.22;
      var names = london ? LDN_SHOPS : SHOPS, ni = (i * 3 + (sd > 0 ? 1 : 0)) % names.length;
      var sg = mesh(T, g, uvRow(new T.PlaneGeometry(Wz * 0.8, 0.9), ni, names.length), M(T, 'signs' + (london ? 'U' : '') + (night ? 'N' : ''), { map: signSheet(T, names, false), emissive: night ? 0xffffff : 0x000000, emissiveMap: night ? signSheet(T, names, true) : null, emissiveIntensity: night ? 0.35 : 0 }), sd * (setback - 0.06), 3.75, 0, false); sg.rotation.y = -sd * Math.PI / 2;
      if (!lite) {
        // Roof life: a black water tank on a stand, sometimes a satellite dish; a balcony rail on upper floors.
        var rx = bx + sd * (D * 0.2); mesh(T, g, new T.CylinderGeometry(0.8, 0.8, 1.6, 14), M(T, 'tank', { color: 0x17181a, roughness: 0.6 }), rx, H + 1.5, -Wz * 0.25); mesh(T, g, new T.BoxGeometry(1.8, 0.7, 1.8), M(T, 'stand', { color: 0x5a5f66, roughness: 0.6, metalness: 0.4 }), rx, H + 0.35, -Wz * 0.25);
        if (r() > 0.5) { var dish = mesh(T, g, new T.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 3), M(T, 'dish', { color: 0xe8e8e4, roughness: 0.5, side: 2 }), bx - sd * D * 0.2, H + 0.6, Wz * 0.25); dish.rotation.z = sd * 1.1; }
        if (floors > 2) for (var bf = 1; bf < floors; bf++) if ((bf + i) % 2 === 0) { mesh(T, g, new T.BoxGeometry(0.9, 0.12, Wz * 0.42), side, sd * (setback - 0.45), 3.4 + bf * fh - 0.1, -Wz * 0.22); mesh(T, g, new T.BoxGeometry(0.05, 0.9, Wz * 0.42), M(T, 'rail', { color: 0x2b2f36, roughness: 0.5, metalness: 0.6 }), sd * (setback - 0.88), 3.4 + bf * fh + 0.35, -Wz * 0.22); }
      }
    }
    // A wooden power pole with a crossbar, and wires running on to the next pole.
    if (!london) {
      var px = sd * 6.6, wood = M(T, 'pole', { color: 0x5a4632, roughness: 0.95 });
      mesh(T, g, new T.CylinderGeometry(0.11, 0.15, 8.6, 8), wood, px, 4.3, -5);
      mesh(T, g, new T.BoxGeometry(1.8, 0.12, 0.12), wood, px, 8.0, -5);
      mesh(T, g, new T.BoxGeometry(0.9, 0.08, 0.08), wood, px - sd * 0.45, 7.2, -5); mesh(T, g, new T.BoxGeometry(0.5, 0.12, 0.25), M(T, 'lamphead' + (night ? 'N' : ''), { color: 0xfff2d0, emissive: night ? 0xffd890 : 0x000000, emissiveIntensity: night ? 1.4 : 0 }), px - sd * 0.9, 7.1, -5, false);
      if (!lite) [-0.75, 0, 0.75].forEach(function (wx) { var wire = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 12, 4), M(T, 'wire', { color: 0x111111, roughness: 1 })); wire.rotation.x = Math.PI / 2; wire.position.set(px + wx, 7.8 - Math.abs(wx) * 0.05, 1); g.add(wire); });
    } else {
      mesh(T, g, new T.CylinderGeometry(0.08, 0.1, 6, 8), M(T, 'lamp', { color: 0x2b2f36, roughness: 0.4, metalness: 0.6 }), sd * 6.6, 3, -5);
      var lh = mesh(T, g, new T.BoxGeometry(1.2, 0.12, 0.3), M(T, 'lamp', {}), sd * 6.1, 6, -5); lh.castShadow = false;
    }
    // A billboard on tall legs, now and then.
    if (!london && i % 4 === 1) {
      var bbx = sd * 8.8;
      [-1.6, 1.6].forEach(function (lz) { mesh(T, g, new T.CylinderGeometry(0.14, 0.14, 7, 8), M(T, 'bbleg', { color: 0x5a5f66, roughness: 0.5, metalness: 0.6 }), bbx, 3.5, 3 + lz); });
      var ai = (i + (sd > 0 ? 2 : 0)) % ADS.length, bb = mesh(T, g, uvRow(new T.PlaneGeometry(6, 3), ai, ADS.length), M(T, 'ads' + (night ? 'N' : ''), { map: adSheet(T), roughness: 0.6, emissive: night ? 0xffffff : 0x000000, emissiveMap: night ? adSheet(T) : null, emissiveIntensity: night ? 0.5 : 0, side: 2 }), bbx, 8.4, 3); bb.rotation.y = -sd * Math.PI / 2 + sd * 0.35;
      mesh(T, g, new T.BoxGeometry(0.3, 3.2, 6.2), M(T, 'bbback', { color: 0x2b2f36, roughness: 0.6 }), bbx + sd * 0.2, 8.4, 3).rotation.y = sd * 0.35;
    }
    // A palm (curved trunk, drooping fronds) on alternate stretches.
    if (!london && i % 2 === 0) palm(T, g, sd * 7.9, 3, r, lite);
    else if (london && i % 2 === 0) { mesh(T, g, new T.CylinderGeometry(0.16, 0.22, 4, 8), M(T, 'trunk', { color: 0x5a4632, roughness: 0.95 }), sd * 7.9, 2, 3); var cr = mesh(T, g, new T.IcosahedronGeometry(1.9, 1), M(T, 'leafL', { color: 0x4f7d3a, roughness: 0.9, flatShading: true }), sd * 7.9, 4.8, 3); cr.scale.y = 0.85; }
    return g;
  }
  // A strip of street: n stretches of 12 m on both sides, merged into one mesh per material.
  function strip(T, i0, n, o) { var g = new T.Group(); for (var k = 0; k < n; k++) { var a = block(T, i0 + k, -1, o), b = block(T, i0 + k + 50, 1, o); a.position.z = b.position.z = -k * 12; g.add(a); g.add(b); } if (root.LasgidiModels3D && root.LasgidiModels3D.merge) root.LasgidiModels3D.merge(T, g); return g; }
  function palm(T, g, x, z, r, lite) {
    var trunkM = M(T, 'palmtrunk', { color: 0x9a8264, roughness: 0.95 }), leafM = M(T, 'palmleaf', { color: 0x3f8f3a, roughness: 0.8, side: 2 }), h = 6 + r() * 2.5, lean = (r() - 0.5) * 0.4, segs = lite ? 3 : 6, px = x, py = 0;
    for (var s = 0; s < segs; s++) { var len = h / segs, nx = px + lean * len * (s / segs), seg = mesh(T, g, new T.CylinderGeometry(0.17 - s * 0.012, 0.2 - s * 0.012, len, 8), trunkM, (px + nx) / 2, py + len / 2, z); seg.rotation.z = -lean * (s / segs); px = nx; py += len; }
    var fronds = lite ? 6 : 10;
    for (var f = 0; f < fronds; f++) {
      var a = f / fronds * Math.PI * 2, fr = new T.Group(); fr.position.set(px, py, z); fr.rotation.y = a; g.add(fr);
      var leaf = new T.Mesh(new T.PlaneGeometry(3.2, 0.7, 4, 1), leafM); var p = leaf.geometry.attributes.position; for (var k = 0; k < p.count; k++) { var lx = p.getX(k) + 1.6; p.setY(k, p.getY(k) * (1 - lx / 3.4)); p.setZ(k, -0.18 * lx * lx); } leaf.geometry.computeVertexNormals();
      leaf.position.x = 1.6; leaf.rotation.x = Math.PI / 2; leaf.rotation.z = 0; fr.rotation.z = -0.15 - (f % 2) * 0.2; leaf.castShadow = true; fr.add(leaf);
    }
    mesh(T, g, new T.SphereGeometry(0.32, 8, 6), M(T, 'coco', { color: 0x5a4a2a, roughness: 0.8 }), px, py - 0.2, z);
  }
  // ---- The open highway between cities: laterite shoulders, savanna grass, acacia and baobab trees, palms, shrubs,
  // villages of mud-brick houses with zinc roofs, roadside stalls, kilometre posts and the odd billboard.
  function grassTex(T, lite) {
    return C.grass || (C.grass = canvasTex(T, lite ? 128 : 256, lite ? 128 : 256, function (g, w, h) {
      var r = rnd(23); g.fillStyle = '#8a9a4a'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < (lite ? 1800 : 7000); i++) { var v = r(); g.fillStyle = v < 0.3 ? 'rgba(190,170,90,.5)' : v < 0.6 ? 'rgba(90,120,50,.5)' : v < 0.8 ? 'rgba(150,120,70,.35)' : 'rgba(60,90,40,.45)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 4); }
    }, [40, 40]));
  }
  function lateriteTex(T) { return C.lat || (C.lat = canvasTex(T, 128, 128, function (g, w, h) { var r = rnd(29); g.fillStyle = '#a5532e'; g.fillRect(0, 0, w, h); grain(g, w, h, 2500, 0.25, r); }, [1, 6])); }
  function mudTex(T) { return C.mud || (C.mud = canvasTex(T, 128, 128, function (g, w, h) { var r = rnd(31); g.fillStyle = '#b77a4e'; g.fillRect(0, 0, w, h); grain(g, w, h, 1800, 0.2, r); g.fillStyle = 'rgba(80,45,25,.25)'; g.fillRect(0, h * 0.85, w, h * 0.15); g.fillStyle = '#3b2a1c'; g.fillRect(w * 0.38, h * 0.4, w * 0.24, h * 0.6); g.fillStyle = '#2b3a46'; g.fillRect(w * 0.08, h * 0.35, w * 0.18, h * 0.2); g.fillRect(w * 0.74, h * 0.35, w * 0.18, h * 0.2); })); }
  function zincTex(T) { return C.zinc || (C.zinc = canvasTex(T, 64, 64, function (g, w, h) { for (var x = 0; x < w; x += 4) { g.fillStyle = x % 8 ? '#9aa0a6' : '#7c8288'; g.fillRect(x, 0, 4, h); } g.fillStyle = 'rgba(150,80,40,.35)'; g.fillRect(0, h * 0.6, w, h * 0.4); }, [3, 1])); }
  function acacia(T, g, x, z, r) {
    var tr = M(T, 'acTrunk', { color: 0x5a4632, roughness: 0.95 }), lf = M(T, 'acLeaf', { color: 0x5f7f34, roughness: 0.9, flatShading: true }), h = 3 + r() * 1.5;
    var t1 = mesh(T, g, new T.CylinderGeometry(0.12, 0.2, h, 6), tr, x, h / 2, z); t1.rotation.z = (r() - 0.5) * 0.3;
    for (var b = 0; b < 3; b++) { var br = mesh(T, g, new T.CylinderGeometry(0.06, 0.1, 1.6, 5), tr, x + Math.cos(b * 2.1) * 0.5, h + 0.4, z + Math.sin(b * 2.1) * 0.5); br.rotation.z = Math.cos(b * 2.1) * 0.7; br.rotation.x = Math.sin(b * 2.1) * 0.7; }
    var cn = mesh(T, g, new T.SphereGeometry(2.4 + r(), 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), lf, x, h + 0.6, z); cn.scale.y = 0.35;
  }
  function baobab(T, g, x, z, r) {
    var tr = M(T, 'bbTrunk', { color: 0x8a7a6a, roughness: 0.95 }), lf = M(T, 'bbLeaf', { color: 0x6f8a3a, roughness: 0.9, flatShading: true }), h = 4 + r() * 1.5;
    mesh(T, g, new T.CylinderGeometry(0.8, 1.3, h, 10), tr, x, h / 2, z);
    for (var b = 0; b < 5; b++) { var a = b / 5 * Math.PI * 2, br = mesh(T, g, new T.CylinderGeometry(0.12, 0.3, 2.4, 6), tr, x + Math.cos(a) * 0.9, h + 0.6, z + Math.sin(a) * 0.9); br.rotation.z = Math.cos(a) * 0.9; br.rotation.x = Math.sin(a) * 0.9; mesh(T, g, new T.IcosahedronGeometry(0.9, 0), lf, x + Math.cos(a) * 1.9, h + 1.4, z + Math.sin(a) * 1.9); }
  }
  function shrub(T, g, x, z, r) { var m = mesh(T, g, new T.IcosahedronGeometry(0.6 + r() * 0.6, 0), M(T, 'shrub', { color: 0x58783a, roughness: 0.95, flatShading: true }), x, 0.4, z); m.scale.y = 0.7; }
  function hut(T, g, x, z, r, sd) {
    var w = 3.4 + r(), d = 3 + r(), h = 2.4;
    var wall = mesh(T, g, new T.BoxGeometry(w, h, d), M(T, 'mud', { map: mudTex(T), roughness: 0.95 }), x, h / 2, z); wall.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
    var rf = mesh(T, g, new T.BoxGeometry(w + 0.6, 0.08, d + 0.6), M(T, 'zinc', { map: zincTex(T), roughness: 0.45, metalness: 0.55 }), x, h + 0.25, z); rf.rotation.y = wall.rotation.y; rf.rotation.x = 0.12;
  }
  function stall(T, g, x, z, r, sd) {
    var wood = M(T, 'stallWood', { color: 0x8a6a3a, roughness: 0.9 });
    mesh(T, g, new T.BoxGeometry(1.6, 0.8, 1.2), wood, x, 0.4, z); [-0.7, 0.7].forEach(function (q) { mesh(T, g, new T.CylinderGeometry(0.04, 0.04, 2.2, 5), wood, x + q, 1.1, z); });
    var um = mesh(T, g, new T.ConeGeometry(1.4, 0.5, 10, 1, true), M(T, 'stUmb' + (Math.floor(r() * 3)), { color: [0xc0392b, 0x1f6fd0, 0xf2a900][Math.floor(r() * 3)], roughness: 0.8, side: 2 }), x, 2.3, z);
    for (var k = 0; k < 6; k++) mesh(T, g, new T.SphereGeometry(0.1, 6, 4), M(T, 'fruit' + (k % 3), { color: [0xe67e22, 0xf2c200, 0x2fa36b][k % 3], roughness: 0.6 }), x - 0.5 + (k % 3) * 0.5, 0.88, z - 0.25 + Math.floor(k / 3) * 0.5);
  }
  function hwBlock(T, i, sd, o) {
    var g = new T.Group(), r = rnd(i * 53 + (sd > 0 ? 7 : 0) + 3), lite = !!o.lite; NOSHADOW = lite;
    mesh(T, g, new T.BoxGeometry(2.2, 0.04, 12), M(T, 'laterite', { map: lateriteTex(T), roughness: 1 }), sd * 7.1, 0.02, 0, false);
    var kind = i % 7;
    if (kind === 2 || kind === 5) { for (var hh = 0; hh < (lite ? 2 : 3); hh++) hut(T, g, sd * (15 + hh * 5 + r() * 2), -4 + hh * 4, r, sd); if (!lite) stall(T, g, sd * 9.2, 2, r, sd); }
    else if (kind === 3) baobab(T, g, sd * (14 + r() * 8), r() * 8 - 4, r);
    else if (kind === 6) { var ad = ADS[(i + (sd > 0 ? 3 : 0)) % ADS.length], bbx = sd * 11; [-1.8, 1.8].forEach(function (lz) { mesh(T, g, new T.CylinderGeometry(0.14, 0.14, 5, 8), M(T, 'bbleg', { color: 0x5a5f66, roughness: 0.5, metalness: 0.6 }), bbx, 2.5, lz); }); var bb = mesh(T, g, uvRow(new T.PlaneGeometry(6, 3), (i + (sd > 0 ? 3 : 0)) % ADS.length, ADS.length), M(T, 'ads', { map: adSheet(T), roughness: 0.6, side: 2 }), bbx, 6.4, 0); bb.rotation.y = -sd * Math.PI / 2 + sd * 0.4; }
    else { for (var t = 0; t < (lite ? 1 : 2); t++) acacia(T, g, sd * (11 + r() * 14), r() * 10 - 5, r); }
    if (!lite) for (var sb = 0; sb < 3; sb++) shrub(T, g, sd * (9 + r() * 16), r() * 12 - 6, r);
    if (i % 4 === 0) palm(T, g, sd * (9.5 + r() * 3), r() * 6 - 3, r, lite);
    if (i % 5 === 1) { mesh(T, g, new T.BoxGeometry(0.2, 0.9, 0.12), M(T, 'kmpost', { color: 0xf4f1e8, roughness: 0.7 }), sd * 6.5, 0.45, 0); mesh(T, g, new T.BoxGeometry(0.21, 0.25, 0.13), M(T, 'kmtop', { color: 0x1f6fd0, roughness: 0.7 }), sd * 6.5, 0.8, 0); }
    return g;
  }
  function hwStrip(T, i0, n, o) { var g = new T.Group(); for (var k = 0; k < n; k++) { var a = hwBlock(T, i0 + k, -1, o), b = hwBlock(T, i0 + k + 70, 1, o); a.position.z = b.position.z = -k * 12; g.add(a); g.add(b); } if (root.LasgidiModels3D && root.LasgidiModels3D.merge) root.LasgidiModels3D.merge(T, g); return g; }
  // Far hills and rock outcrops on the horizon (they stay put while the road streams past).
  function horizon(T, scene, o) {
    var g = new T.Group(), hm = M(T, 'hill' + (o.night ? 'N' : ''), { color: o.night ? 0x1d2433 : 0x7b8a62, roughness: 1, flatShading: true }), rk = M(T, 'rock', { color: o.night ? 0x262a33 : 0x8a7f74, roughness: 0.95, flatShading: true });
    for (var h = 0; h < 14; h++) { var sd = h % 2 ? 1 : -1, hl = new T.Mesh(new T.ConeGeometry(30 + (h * 13) % 30, 18 + (h * 7) % 22, 7), h % 4 === 0 ? rk : hm); hl.position.set(sd * (110 + (h * 37) % 90), 6, -120 - h * 45); hl.scale.z = 0.6; g.add(hl); }
    scene.add(g); return g;
  }
  // Sky, sun and clouds for a ride scene; returns the sun's direction for the light.
  function sky(T, scene, o) {
    var d = skyDome(T, o.night, o.dusk); scene.add(d);
    var sn = sunGlow(T, o.night, o.dusk), dir = new T.Vector3(-0.35, o.dusk ? 0.12 : o.night ? 0.5 : 0.42, -1).normalize(); sn.position.copy(dir).multiplyScalar(620); scene.add(sn);
    if (!o.night) for (var c = 0; c < (o.lite ? 4 : 9); c++) { var cl = cloud(T, c); cl.position.set(-500 + c * 120 + (c % 2) * 40, 120 + (c % 3) * 40, -420 - (c % 4) * 50); scene.add(cl); }
    return dir;
  }
  // A reflection map from the same sky over a grey road and a band of city, so car paint and glass mirror the
  // world (made once per lighting).
  function envMap(T, renderer, o) {
    var k = 'env' + (o.night ? 'N' : o.dusk ? 'D' : ''); if (C[k]) return C[k];
    try {
      var sc = new T.Scene(); sc.add(skyDome(T, o.night, o.dusk));
      var gnd = new T.Mesh(new T.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: o.night ? 0x14161c : 0x5a5d62 })); gnd.position.y = -2; sc.add(gnd);
      for (var b = 0; b < 16; b++) { var a = b / 16 * Math.PI * 2, bl = new T.Mesh(new T.BoxGeometry(60, 40 + (b * 37) % 80, 60), new T.MeshBasicMaterial({ color: o.night ? 0x2a2f3c : [0xd8cdb8, 0xb9c3cc, 0xe0c9a8, 0x8fa3b3][b % 4] })); bl.position.set(Math.cos(a) * 300, 10, Math.sin(a) * 300); sc.add(bl); }
      var pm = new T.PMREMGenerator(renderer), rt = pm.fromScene(sc, 0.02); pm.dispose(); return (C[k] = rt.texture);
    } catch (e) { return null; }
  }
  root.LasgidiRoad3D = { envMap: envMap, block: block, strip: strip, hwStrip: hwStrip, horizon: horizon, grass: grassTex, asphalt: asphalt, sky: sky, palm: palm };
})(typeof window !== 'undefined' ? window : globalThis);
