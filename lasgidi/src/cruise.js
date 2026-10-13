/* Lasgidi: the Lagoon Boat Cruise deck, drawn on a canvas.
   An isometric wooden deck on the lagoon with a wheelhouse, a deck bar, loungers,
   a colour dance floor, speakers and a stern rail. Players stand at their spots
   with @handles over their heads. Tap a spot to move there, or a player to chat. */
(function (root) {
  'use strict';
  var D = root.LASGIDI_DATA;
  // Deck coordinates (x along the boat, y across). Each spot has a centre where its people gather.
  var SPOTS = { helm: [8.4, 1.6], sun: [8.2, 4.4], bar: [2.0, 1.5], party: [5.0, 3.4], rail: [1.4, 4.6] };
  // Other live rooms share the renderer: each has its own spots and furniture.
  var LAYOUTS = {
    cruise: SPOTS,
    beach: { bar: [2.0, 1.4], volley: [5.2, 2.6], loungers: [8.2, 1.6], jetski: [8.4, 4.6], bonfire: [3.0, 4.4] },
    tidewater: { dj: [5.0, 1.4], oven: [1.8, 1.5], jetty: [8.6, 4.6], lounge: [3.0, 4.4], bar: [8.0, 1.5] },
    club: { floor: [5.0, 3.2], dj: [5.0, 1.0], bar: [1.6, 1.6], vip: [8.4, 1.6], spray: [6.6, 4.6] },
    market: { fabric: [2.0, 1.6], phones: [5.0, 1.6], buka: [8.2, 1.6], shoes: [3.4, 4.4], gate: [8.0, 4.8] },
    park: { stage: [5.0, 1.2], seats: [5.0, 3.4], food: [1.6, 4.4], art: [8.4, 4.4], trees: [1.6, 1.6] }
  };
  var DECK = { w: 10, d: 6 };

  function create(opts) {
    opts = opts || {};
    var el = document.createElement('div'); el.className = 'cruise-stage';
    var cv = document.createElement('canvas'); cv.className = 'cruise-canvas';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'The deck of the Lagoon Boat Cruise');
    el.appendChild(cv);
    var g = cv.getContext('2d'), scene = { players: [], bubbles: {} }, figs = {}, hits = [], raf = 0, W = 0, H = 0, dpr = 1;
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function size() {
      var w = el.clientWidth || 360, h = el.clientHeight || Math.round(w * 0.62);
      dpr = Math.min(2, root.devicePixelRatio || 1);
      if (w === W && h === H) return; W = w; H = h;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    // Isometric projection fitted to the canvas.
    function P(x, y, z) {
      var tw = Math.min(W * 0.118, H * 0.15), th = tw * 0.5;
      var ox = W / 2 - (DECK.w - DECK.d) * tw / 4, oy = H * 0.56 - (DECK.w + DECK.d) * th / 4;
      return { x: ox + (x - y) * tw / 2, y: oy + (x + y) * th / 2 - (z || 0) * tw, s: tw };
    }
    function poly(pts, fill, stroke) { g.beginPath(); pts.forEach(function (p, i) { var q = P(p[0], p[1], p[2]); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } }
    // A box from (x,y) with footprint w×d and height h (deck units).
    function box(x, y, w, d, h, top, side, front) {
      poly([[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h]], front || side);
      poly([[x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, h], [x + w, y, h]], side);
      poly([[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]], top);
    }
    var signRects = [];
    function sign(x, y, z, text, bg) {
      var p = P(x, y, z), s = p.s;
      g.font = '800 ' + Math.min(15, Math.max(9, s * 0.24)) + 'px system-ui, sans-serif';
      var tw = g.measureText(text).width + 16, th = Math.min(26, Math.max(16, s * 0.4));
      g.fillStyle = '#3a3d42'; g.fillRect(p.x - tw / 2 + s * 0.1, p.y, s * 0.06, s * 1.2); g.fillRect(p.x + tw / 2 - s * 0.16, p.y, s * 0.06, s * 1.2);
      g.fillStyle = bg; g.fillRect(p.x - tw / 2, p.y - th, tw, th); signRects.push({ x: p.x, y: p.y - th / 2, w: tw, h: th });
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, p.x, p.y - th / 2);
    }
    function figure(pl) {
      var key = JSON.stringify([pl.look, pl.outfit]);
      if (figs[key]) return figs[key];
      if (!root.LasgidiAvatar) return null;
      try { var c = document.createElement('canvas'); root.LasgidiAvatar.draw(c, pl.look || { skin: 2, hair: 0, shape: 1 }, pl.outfit || {}); figs[key] = c; } catch (e) { return null; }
      if (Object.keys(figs).length > 60) figs = {};
      return figs[key];
    }
    function frame(t) {
      size();
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); signRects = [];
      var room = scene.layout || scene.room || 'cruise', SP = LAYOUTS[room] || SPOTS, bob = reduce || room !== 'cruise' ? 0 : Math.sin(t / 900) * 2;
      // Sky and lagoon.
      var sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, scene.night ? '#0d1733' : '#bfe3f7'); sky.addColorStop(0.28, scene.night ? '#1c2c55' : '#d9f0fb'); sky.addColorStop(0.3, scene.night ? '#0f2f4a' : '#2a9cc4'); sky.addColorStop(1, scene.night ? '#0a2236' : '#1d7fa3');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      var roomNow = scene.layout || scene.room || 'cruise';
      if (roomNow === 'club') { g.fillStyle = '#0b0d18'; g.fillRect(0, 0, W, H); }
      if (roomNow === 'market' || roomNow === 'park') { g.fillStyle = roomNow === 'market' ? (scene.night ? '#3b2c22' : '#b98a5e') : (scene.night ? '#23402a' : '#6fa65a'); g.fillRect(0, H * 0.3, W, H * 0.7); }
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.5;
      for (var i = 0; i < 18; i++) { var wy = H * 0.34 + (i * 37 % (H * 0.66)), wx = ((i * 97 + (reduce ? 0 : t / 40)) % (W + 80)) - 40; g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 12, wy - 4, wx + 24, wy); g.stroke(); }
      g.save(); g.translate(0, bob);
      if (room === 'cruise') {
      // Hull and deck.
      poly([[0, DECK.d, 0], [DECK.w, DECK.d, 0], [DECK.w + 0.4, DECK.d + 0.3, -0.5], [-0.3, DECK.d + 0.3, -0.5]], '#5a3a22');
      poly([[DECK.w, 0, 0], [DECK.w, DECK.d, 0], [DECK.w + 0.4, DECK.d + 0.3, -0.5], [DECK.w + 0.6, 0, -0.5]], '#4a2f1b');
      poly([[0, 0, 0], [DECK.w, 0, 0], [DECK.w, DECK.d, 0], [0, DECK.d, 0]], '#a8743f');
      g.strokeStyle = 'rgba(70,40,15,.35)'; g.lineWidth = 1;
      for (var k = 1; k < DECK.w * 2; k++) { var a = P(k / 2, 0, 0), b = P(k / 2, DECK.d, 0); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
      // Dance floor: a 4×4 grid of colour tiles that cycles.
      var cols = ['#ff5fa2', '#3fa3ff', '#4be08a', '#b45cff', '#ffc93c'];
      for (var r = 0; r < 4; r++) for (var c2 = 0; c2 < 4; c2++) { var ci = (r + c2 + Math.floor((reduce ? 0 : t) / 600)) % cols.length; poly([[3.6 + c2 * 0.7, 2.2 + r * 0.7, 0.01], [4.3 + c2 * 0.7, 2.2 + r * 0.7, 0.01], [4.3 + c2 * 0.7, 2.9 + r * 0.7, 0.01], [3.6 + c2 * 0.7, 2.9 + r * 0.7, 0.01]], cols[ci], 'rgba(255,255,255,.35)'); }
      // Deck bar along the port side, with stools and bottles.
      box(0.6, 0.5, 3.4, 0.6, 0.38, '#7a4a26', '#6a3f20', '#f2ede4');
      ['#2fa36b', '#c0392b', '#f2b600', '#2f6fd0', '#e67e22'].forEach(function (col, n) { var p = P(0.9 + n * 0.6, 0.72, 0.38), s = p.s; g.fillStyle = col; g.fillRect(p.x - s * 0.05, p.y - s * 0.32, s * 0.1, s * 0.32); });
      [1.0, 1.8, 2.6, 3.4].forEach(function (x) { var p = P(x, 1.45, 0), s = p.s; g.fillStyle = '#2b2f36'; g.fillRect(p.x - s * 0.02, p.y - s * 0.28, s * 0.04, s * 0.28); g.beginPath(); g.ellipse(p.x, p.y - s * 0.28, s * 0.12, s * 0.05, 0, 0, Math.PI * 2); g.fill(); });
      sign(1.4, 0.3, 0.9, 'DECK BAR', '#1f2933');
      // Wheelhouse at the bow with the ship's wheel.
      box(8.0, 0.4, 1.4, 1.0, 0.5, '#e9e6df', '#cfcac0', '#f7f4ee');
      var wh = P(8.4, 1.2, 0.75), ws = wh.s * 0.28; g.strokeStyle = '#6b4423'; g.lineWidth = Math.max(2, ws * 0.18); g.beginPath(); g.arc(wh.x, wh.y, ws, 0, Math.PI * 2); g.stroke();
      for (var sp = 0; sp < 8; sp++) { var an = sp * Math.PI / 4 + (reduce ? 0 : t / 4000); g.beginPath(); g.moveTo(wh.x, wh.y); g.lineTo(wh.x + Math.cos(an) * ws * 1.3, wh.y + Math.sin(an) * ws * 1.3); g.stroke(); }
      sign(8.0, 0.2, 1.5, 'LAGOON CRUISE', '#1f4f7a');
      // Sun deck loungers.
      [[7.6, 3.8], [8.6, 3.8], [7.6, 4.9]].forEach(function (q) { box(q[0], q[1], 0.8, 0.4, 0.12, '#ffffff', '#d9dcdf', '#eef0f2'); poly([[q[0], q[1], 0.12], [q[0] + 0.25, q[1], 0.12], [q[0] + 0.25, q[1] + 0.4, 0.45], [q[0], q[1] + 0.4, 0.45]], '#2f6fa0'); });
      // Speakers beside the dance floor.
      [[3.1, 2.4], [6.6, 4.9]].forEach(function (q) { box(q[0], q[1], 0.35, 0.35, 0.7, '#cfc6b8', '#b5ab9c', '#ddd4c6'); var p = P(q[0] + 0.17, q[1] + 0.35, 0.45); g.fillStyle = '#4a4f57'; g.beginPath(); g.arc(p.x, p.y, p.s * 0.1, 0, Math.PI * 2); g.fill(); });
      } else if (room === 'beach') {
      // White sand on the sea, with a wet edge, a beach bar, a volleyball net, loungers and umbrellas, a jet ski dock and a bonfire.
      poly([[0, DECK.d, 0], [DECK.w, DECK.d, 0], [DECK.w, DECK.d, -0.3], [0, DECK.d, -0.3]], '#d9bf86');
      poly([[0, 0, 0], [DECK.w, 0, 0], [DECK.w, DECK.d, 0], [0, DECK.d, 0]], '#f2deb0');
      poly([[0, DECK.d - 0.6, 0.005], [DECK.w, DECK.d - 0.6, 0.005], [DECK.w, DECK.d, 0.005], [0, DECK.d, 0.005]], '#e4c98f');
      box(0.6, 0.5, 2.8, 0.6, 0.4, '#8a5a2b', '#6f4722', '#c98b4a'); sign(1.0, 0.3, 1.0, 'BEACH BAR', '#c0392b');
      ['#2fa36b', '#f2b600', '#e67e22', '#2f6fd0'].forEach(function (col, n) { var p = P(0.9 + n * 0.6, 0.72, 0.4), s = p.s; g.fillStyle = col; g.fillRect(p.x - s * 0.05, p.y - s * 0.3, s * 0.1, s * 0.3); });
      var n0 = P(4.2, 2.6, 0), n1 = P(6.2, 2.6, 0); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.moveTo(n0.x, n0.y); g.lineTo(n0.x, n0.y - n0.s * 0.9); g.lineTo(n1.x, n1.y - n1.s * 0.9); g.lineTo(n1.x, n1.y); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; for (var nl = 1; nl < 4; nl++) { g.beginPath(); g.moveTo(n0.x, n0.y - n0.s * (0.9 - nl * 0.12)); g.lineTo(n1.x, n1.y - n1.s * (0.9 - nl * 0.12)); g.stroke(); }
      var vb = P(5.2 + Math.sin((reduce ? 0 : t) / 700) * 0.8, 2.2, 1.0 + Math.abs(Math.sin((reduce ? 0 : t) / 350)) * 0.5); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(vb.x, vb.y, vb.s * 0.09, 0, Math.PI * 2); g.fill();
      [[7.4, 1.0], [8.4, 1.0], [9.2, 1.4]].forEach(function (q, i) { box(q[0], q[1], 0.7, 0.35, 0.1, '#ffffff', '#d9dcdf', '#eef0f2'); var u = P(q[0] + 0.35, q[1] - 0.1, 0); g.strokeStyle = '#555'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(u.x, u.y); g.lineTo(u.x, u.y - u.s * 0.9); g.stroke(); g.fillStyle = ['#e5484d', '#2f6fd0', '#f2b600'][i]; g.beginPath(); g.ellipse(u.x, u.y - u.s * 0.9, u.s * 0.42, u.s * 0.16, 0, Math.PI, 0); g.fill(); });
      poly([[7.6, 5.0, 0.02], [9.8, 5.0, 0.02], [9.8, 5.4, 0.02], [7.6, 5.4, 0.02]], '#a07a4f');
      [[8.2, 5.7], [9.2, 5.8]].forEach(function (q, i) { var p = P(q[0], q[1], 0.02); g.fillStyle = i ? '#f2b600' : '#2f6fd0'; g.beginPath(); g.ellipse(p.x, p.y, p.s * 0.3, p.s * 0.1, -0.45, 0, Math.PI * 2); g.fill(); });
      var bf = P(3.0, 4.6, 0); g.fillStyle = '#6b4a2a'; g.fillRect(bf.x - bf.s * 0.25, bf.y - bf.s * 0.06, bf.s * 0.5, bf.s * 0.08);
      if (scene.night || (reduce ? 0 : 1)) { var fl = reduce ? 0 : Math.sin(t / 120) * 0.05; g.fillStyle = scene.night ? '#ff9a3c' : 'rgba(255,154,60,.6)'; g.beginPath(); g.moveTo(bf.x - bf.s * 0.18, bf.y - bf.s * 0.05); g.quadraticCurveTo(bf.x, bf.y - bf.s * (0.6 + fl), bf.x + bf.s * 0.18, bf.y - bf.s * 0.05); g.fill(); }
      sign(8.6, 4.2, 1.0, 'JET SKIS', '#1f4f7a');
      } else if (room === 'club') {
      // A club: dark floor, an LED dance floor, the DJ booth with lights, a long bar and a roped-off VIP booth.
      poly([[0, DECK.d, 0], [DECK.w, DECK.d, 0], [DECK.w, DECK.d, -0.3], [0, DECK.d, -0.3]], '#05060c');
      poly([[0, 0, 0], [DECK.w, 0, 0], [DECK.w, DECK.d, 0], [0, DECK.d, 0]], '#171a2a');
      var lc = ['#ff2d95', '#20c6ff', '#7cff6b', '#b45cff', '#ffcc00'];
      for (var r2 = 0; r2 < 4; r2++) for (var c3 = 0; c3 < 5; c3++) { var cc = (r2 * 2 + c3 + Math.floor((reduce ? 0 : t) / 400)) % lc.length; poly([[3.2 + c3 * 0.72, 2.2 + r2 * 0.72, 0.01], [3.92 + c3 * 0.72, 2.2 + r2 * 0.72, 0.01], [3.92 + c3 * 0.72, 2.92 + r2 * 0.72, 0.01], [3.2 + c3 * 0.72, 2.92 + r2 * 0.72, 0.01]], lc[cc], 'rgba(0,0,0,.4)'); }
      box(4.0, 0.3, 2.0, 0.6, 0.5, '#2a2d3d', '#1d2030', '#33374a'); sign(4.6, 0.2, 1.3, 'DJ', '#ff2d95');
      for (var bm = 0; bm < 5; bm++) { var src = P(5.0, 0.5, 1.6), ang2 = (reduce ? bm : t / 900 + bm * 1.3), tx = P(5 + Math.cos(ang2) * 3, 3 + Math.sin(ang2) * 2, 0); g.strokeStyle = lc[bm] + '55'; g.lineWidth = 6; g.beginPath(); g.moveTo(src.x, src.y); g.lineTo(tx.x, tx.y); g.stroke(); }
      box(0.4, 0.5, 2.6, 0.6, 0.4, '#3a2c4f', '#2a1f3a', '#7b5cff'); sign(0.8, 0.3, 1.0, 'BAR', '#1f2933');
      box(7.4, 0.5, 2.2, 1.2, 0.25, '#4a0f2a', '#360a1f', '#6b1a3d');
      [[7.3, 1.9], [8.4, 1.9], [9.5, 1.9]].forEach(function (q) { var a4 = P(q[0], q[1], 0), b4 = P(q[0], q[1], 0.45); g.strokeStyle = '#d4af37'; g.lineWidth = 2; g.beginPath(); g.moveTo(a4.x, a4.y); g.lineTo(b4.x, b4.y); g.stroke(); });
      var r0 = P(7.3, 1.9, 0.38), r1 = P(9.5, 1.9, 0.38); g.strokeStyle = '#b8322b'; g.lineWidth = 3; g.beginPath(); g.moveTo(r0.x, r0.y); g.quadraticCurveTo((r0.x + r1.x) / 2, (r0.y + r1.y) / 2 + 8, r1.x, r1.y); g.stroke();
      sign(7.8, 0.3, 1.0, 'VIP', '#d4af37');
      if (scene.sign) sign(1.6, 5.4, 1.4, scene.sign, '#ff2d95');
      if (!reduce) for (var nt = 0; nt < 12; nt++) { var u5 = ((t / 2200 + nt * 0.083) % 1), np = P(6.0 + (nt % 4) * 0.4, 4.2 + Math.floor(nt / 4) * 0.3, 1.6 - u5 * 1.6); g.fillStyle = '#4caf50'; g.save(); g.translate(np.x, np.y); g.rotate(nt + u5 * 6); g.fillRect(-4, -2, 8, 4); g.restore(); }
      } else if (room === 'market') {
      // Balogun market: red earth, rows of stalls under coloured umbrellas and awnings, bales of fabric, a buka and the gate.
      poly([[0, DECK.d, 0], [DECK.w, DECK.d, 0], [DECK.w, DECK.d, -0.2], [0, DECK.d, -0.2]], '#8a5a3a');
      poly([[0, 0, 0], [DECK.w, 0, 0], [DECK.w, DECK.d, 0], [0, DECK.d, 0]], '#c9875a');
      var aw = ['#c0392b', '#2f6fd0', '#f2b600', '#2fa36b', '#8e44ad', '#e67e22'];
      [[0.6, 0.4], [1.8, 0.4], [3.6, 0.4], [4.8, 0.4], [6.9, 0.4], [8.1, 0.4], [2.2, 3.6], [3.6, 3.6], [5.0, 3.6]].forEach(function (q, i) {
        box(q[0], q[1], 1.0, 0.7, 0.3, '#8a6a46', '#6f5233', '#a07a4f');
        var wares = ['#e74c3c', '#f1c40f', '#1abc9c', '#9b59b6', '#3498db']; for (var wj = 0; wj < 4; wj++) { var wp = P(q[0] + 0.15 + wj * 0.22, q[1] + 0.3, 0.3); g.fillStyle = wares[(i + wj) % wares.length]; g.fillRect(wp.x - wp.s * 0.08, wp.y - wp.s * 0.14, wp.s * 0.16, wp.s * 0.14); }
        poly([[q[0] - 0.1, q[1] - 0.1, 0.8], [q[0] + 1.1, q[1] - 0.1, 0.8], [q[0] + 1.1, q[1] + 0.8, 0.65], [q[0] - 0.1, q[1] + 0.8, 0.65]], aw[i % aw.length]);
      });
      sign(1.2, 0.2, 1.3, 'FABRICS', '#7a1f2b'); sign(4.2, 0.2, 1.3, 'PHONES', '#1f4f7a'); sign(7.4, 0.2, 1.3, 'BUKA', '#2e7d32');
      var gt0 = P(7.2, 5.6, 0), gt1 = P(9.2, 5.6, 0); g.strokeStyle = '#4a3a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(gt0.x, gt0.y); g.lineTo(gt0.x, gt0.y - gt0.s * 1.3); g.lineTo(gt1.x, gt1.y - gt1.s * 1.3); g.lineTo(gt1.x, gt1.y); g.stroke();
      sign(7.9, 5.6, 1.5, scene.sign || 'BALOGUN MARKET', '#c0392b');
      } else if (room === 'park') {
      // Freedom Park: lawns and paths, a lit stage with a backdrop, stone amphitheatre steps, food stalls, art stalls and old trees.
      poly([[0, DECK.d, 0], [DECK.w, DECK.d, 0], [DECK.w, DECK.d, -0.25], [0, DECK.d, -0.25]], '#3f6e34');
      poly([[0, 0, 0], [DECK.w, 0, 0], [DECK.w, DECK.d, 0], [0, DECK.d, 0]], '#7fb35f');
      poly([[4.4, 0, 0.005], [5.6, 0, 0.005], [5.6, DECK.d, 0.005], [4.4, DECK.d, 0.005]], '#d9cbb0');
      box(3.2, 0.2, 3.6, 1.0, 0.35, '#3a3f46', '#2b2f36', '#4a4f57');
      poly([[3.2, 0.2, 0.35], [6.8, 0.2, 0.35], [6.8, 0.2, 1.4], [3.2, 0.2, 1.4]], '#1f2933');
      for (var sl = 0; sl < 6; sl++) { var sp2 = P(3.5 + sl * 0.6, 0.25, 1.45), on2 = reduce || Math.floor(t / 500 + sl) % 2 === 0; g.fillStyle = on2 ? '#ffe27a' : 'rgba(255,226,122,.3)'; g.beginPath(); g.arc(sp2.x, sp2.y, sp2.s * 0.07, 0, Math.PI * 2); g.fill(); }
      sign(4.2, 0.2, 1.75, scene.sign || 'FREEDOM PARK', '#2e7d32');
      for (var st2 = 0; st2 < 3; st2++) poly([[3.0, 2.8 + st2 * 0.5, 0.06 * st2], [7.0, 2.8 + st2 * 0.5, 0.06 * st2], [7.0, 3.2 + st2 * 0.5, 0.06 * st2], [3.0, 3.2 + st2 * 0.5, 0.06 * st2]], ['#cfc6b8', '#bfb5a6', '#afa594'][st2]);
      [[0.6, 4.0], [1.8, 4.0]].forEach(function (q, i) { box(q[0], q[1], 1.0, 0.6, 0.35, '#8a5a2b', '#6f4722', '#c98b4a'); poly([[q[0], q[1], 0.75], [q[0] + 1.0, q[1], 0.75], [q[0] + 1.0, q[1] + 0.6, 0.6], [q[0], q[1] + 0.6, 0.6]], i ? '#f2b600' : '#c0392b'); });
      [[7.8, 4.0], [9.0, 4.0]].forEach(function (q) { box(q[0], q[1], 0.9, 0.5, 0.25, '#f4f1e8', '#d8d2c4', '#e8e2d4'); var ap = P(q[0] + 0.45, q[1], 0.6); g.fillStyle = ['#2f6fd0', '#e67e22'][Math.round(q[0]) % 2]; g.fillRect(ap.x - ap.s * 0.18, ap.y - ap.s * 0.3, ap.s * 0.36, ap.s * 0.3); });
      [[0.8, 0.8], [1.8, 1.2], [9.2, 2.8], [0.6, 2.6]].forEach(function (q) { var tp2 = P(q[0], q[1], 0); g.fillStyle = '#5a3a22'; g.fillRect(tp2.x - 2, tp2.y - tp2.s * 0.5, 4, tp2.s * 0.5); g.fillStyle = '#2e7d32'; g.beginPath(); g.arc(tp2.x, tp2.y - tp2.s * 0.75, tp2.s * 0.4, 0, Math.PI * 2); g.fill(); });
      } else {
      // Tidewater House: a timber deck over the lagoon, a DJ booth, a wood-fired pizza oven, lounge sofas, a bar and the jetty.
      poly([[0, DECK.d, 0], [DECK.w, DECK.d, 0], [DECK.w, DECK.d, -0.35], [0, DECK.d, -0.35]], '#3e2a1a');
      poly([[0, 0, 0], [DECK.w, 0, 0], [DECK.w, DECK.d, 0], [0, DECK.d, 0]], '#6e4a2c');
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (var tk = 1; tk < DECK.d * 3; tk++) { var ta = P(0, tk / 3, 0), tb = P(DECK.w, tk / 3, 0); g.beginPath(); g.moveTo(ta.x, ta.y); g.lineTo(tb.x, tb.y); g.stroke(); }
      box(4.2, 0.5, 1.6, 0.6, 0.45, '#1f2329', '#15181c', '#2b3037'); sign(4.4, 0.3, 1.1, 'DJ', '#8e44ad');
      for (var lz = 0; lz < 6; lz++) { var lp = P(3.6 + lz * 0.6, 0.4, 1.6), on = !reduce && Math.floor(t / 300 + lz) % 3 === 0; g.fillStyle = on ? ['#ff5fa2', '#3fa3ff', '#4be08a'][lz % 3] : 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(lp.x, lp.y, lp.s * 0.08, 0, Math.PI * 2); g.fill(); }
      box(1.0, 0.6, 1.2, 1.0, 0.7, '#b0532c', '#8f4222', '#c4643a'); var ov = P(1.6, 1.6, 0.3); g.fillStyle = reduce ? '#ff9a3c' : 'rgba(255,' + (140 + Math.floor(Math.sin(t / 150) * 30)) + ',60,.95)'; g.beginPath(); g.ellipse(ov.x, ov.y, ov.s * 0.22, ov.s * 0.14, 0, Math.PI, 0); g.fill(); sign(1.2, 0.4, 1.3, 'WOOD-FIRED PIZZA', '#7a1f2b');
      box(7.2, 0.6, 2.2, 0.6, 0.38, '#2b2f36', '#20242a', '#d4af37'); sign(7.6, 0.4, 0.95, 'BAR', '#1f2933');
      [[2.0, 4.0], [3.6, 4.0], [2.8, 4.9]].forEach(function (q) { box(q[0], q[1], 0.9, 0.4, 0.2, '#efe6d6', '#d6ccba', '#e2d8c4'); });
      poly([[8.0, 5.0, 0.01], [9.4, 5.0, 0.01], [9.4, 7.4, -0.05], [8.0, 7.4, -0.05]], '#8a6a46');
      var yb = P(9.9, 6.4, 0); g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(yb.x, yb.y, yb.s * 0.6, yb.s * 0.2, -0.45, 0, Math.PI * 2); g.fill(); g.fillStyle = '#9fc4dc'; g.fillRect(yb.x - yb.s * 0.15, yb.y - yb.s * 0.18, yb.s * 0.3, yb.s * 0.12);
      sign(8.4, 4.6, 1.2, 'JETTY', '#1f4f7a');
      }
      // Event night: bunting along the back edges and falling confetti.
      if (scene.event) {
        var bc = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
        [[[0, 0], [DECK.w, 0]], [[0, 0], [0, DECK.d]]].forEach(function (e2) {
          var a6 = P(e2[0][0], e2[0][1], 1.9), b6 = P(e2[1][0], e2[1][1], 1.9); g.strokeStyle = '#444'; g.lineWidth = 1; g.beginPath(); g.moveTo(a6.x, a6.y); g.lineTo(b6.x, b6.y); g.stroke();
          for (var f6 = 0; f6 < 14; f6++) { var u6 = (f6 + 0.5) / 14, fx6 = a6.x + (b6.x - a6.x) * u6, fy6 = a6.y + (b6.y - a6.y) * u6; g.fillStyle = bc[f6 % 5]; g.beginPath(); g.moveTo(fx6 - 6, fy6); g.lineTo(fx6 + 6, fy6); g.lineTo(fx6, fy6 + 12); g.fill(); }
        });
        if (!reduce) for (var c6 = 0; c6 < 24; c6++) { var v6 = ((t / 3000 + c6 * 0.041) % 1), cp = P((c6 * 37 % 100) / 10, (c6 * 53 % 60) / 10, 2.4 - v6 * 2.4); g.fillStyle = bc[c6 % 5]; g.fillRect(cp.x, cp.y, 4, 6); }
      }
      // Players and crew, back to front.
      hits = [];
      var placed = {}, list = (scene.players || []).map(function (pl) {
        var base = SP[pl.spot] || SP[Object.keys(SP)[0]], n = placed[pl.spot] = (placed[pl.spot] || 0) + 1, ang = n * 2.4, rad = n === 1 ? 0 : 0.6 + 0.2 * Math.floor(n / 4);
        return { pl: pl, x: base[0] + Math.cos(ang) * rad, y: base[1] + Math.sin(ang) * rad * 0.8 };
      }).sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
      // Stagger labels that would sit on top of each other.
      function collides(it, i) {
        for (var j = 0; j < i; j++) { var o = list[j]; if (Math.abs(o.lx - it.lx) < (o.lw + it.lw) / 2 + 2 && Math.abs((o.ly0 - o.lift) - (it.ly0 - it.lift)) < 20) return true; }
        for (var q = 0; q < signRects.length; q++) { var sr = signRects[q]; if (Math.abs(sr.x - it.lx) < (sr.w + it.lw) / 2 + 2 && Math.abs(sr.y - (it.ly0 - it.lift)) < (sr.h + 18) / 2 + 1) return true; }
        return false;
      }
      list.forEach(function (it, i) {
        var p0 = P(it.x, it.y, 0); g.font = '700 ' + Math.min(12, Math.max(9, p0.s * 0.2)) + 'px system-ui, sans-serif';
        it.lw = g.measureText(it.pl.label || '').width + 12; it.lx = p0.x; it.ly0 = p0.y - p0.s * 1.5 - 4; it.lift = 0;
        var tries = [0, 20, -20, 40, -40, 60, -60, 80, -80], topPad = scene.topPad || 14;
        var x0 = it.lx, side = [0, -1, 1], done = false;
        for (var sd = 0; sd < side.length && !done; sd++) {
          it.lx = x0 + side[sd] * (it.lw / 2 + 30); it.dx = it.lx - x0;
          for (var k = 0; k < tries.length; k++) { it.lift = tries[k]; if (it.ly0 - it.lift >= topPad && !collides(it, i)) { done = true; break; } }
        }
        if (!done) { it.lift = 0; it.lx = x0; it.dx = 0; }
      });
      list.forEach(function (it) {
        var p = P(it.x, it.y, 0), s = p.s, fig = figure(it.pl), fh = s * 1.5, fw = fh * 180 / 260;
        var dance = !reduce && it.pl.spot === 'party' ? Math.abs(Math.sin(t / 220 + it.x * 3)) * s * 0.12 : 0;
        if (fig) g.drawImage(fig, p.x - fw / 2, p.y - fh + fh * 0.06 - dance, fw, fh);
        if (it.pl.npc) hits.push({ by: it.pl.by, x: p.x, y: p.y - fh / 2, w: fw, h: fh + 20 });
        if (!it.pl.me && !it.pl.crew) hits.push({ by: it.pl.by, x: p.x, y: p.y - fh / 2, w: fw, h: fh + 20 });
      });
      // Labels and speech bubbles after every figure, so no one stands in front of a name.
      list.forEach(function (it) {
        var p0 = P(it.x, it.y, 0), p = { x: p0.x + (it.dx || 0), y: p0.y, s: p0.s }, s = p.s, fh = s * 1.5;
        var dance = !reduce && it.pl.spot === 'party' ? Math.abs(Math.sin(t / 220 + it.x * 3)) * s * 0.12 : 0;
        var label = it.pl.label || '';
        g.font = '700 ' + Math.min(12, Math.max(9, s * 0.2)) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        var lw = g.measureText(label).width + 12, ly = p.y - fh - 4 - dance - (it.lift || 0);
        g.fillStyle = it.pl.me ? '#f2b600' : it.pl.npc ? '#2e7d32' : it.pl.crew ? 'rgba(40,44,52,.85)' : '#2f6fd0';
        g.beginPath(); if (g.roundRect) g.roundRect(p.x - lw / 2, ly - 9, lw, 18, 9); else g.rect(p.x - lw / 2, ly - 9, lw, 18); g.fill();
        g.fillStyle = it.pl.me ? '#1a1500' : '#ffffff'; g.fillText(label, p.x, ly);
        var bub = scene.bubbles && scene.bubbles[it.pl.by];
        if (bub) {
          g.font = '600 12px system-ui, sans-serif'; var text = bub.length > 34 ? bub.slice(0, 33) + '…' : bub, bw = g.measureText(text).width + 16, by = ly - 26;
          g.fillStyle = '#ffffff'; g.beginPath(); if (g.roundRect) g.roundRect(p.x - bw / 2, by - 11, bw, 22, 10); else g.rect(p.x - bw / 2, by - 11, bw, 22); g.fill();
          g.beginPath(); g.moveTo(p.x - 5, by + 10); g.lineTo(p.x + 5, by + 10); g.lineTo(p.x, by + 16); g.fill();
          g.fillStyle = '#17181a'; g.fillText(text, p.x, by);
        }
      });
      // The stern rail (boat and club deck only).
      if (room === 'cruise' || room === 'tidewater') {
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      [[0, DECK.d, 0, 0], [0, DECK.d, DECK.w, DECK.d]].forEach(function (l) { var a = P(l[0], l[1], 0.45), b = P(l[2], l[3], 0.45); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); });
      for (var rp = 0; rp <= 10; rp++) { var u = rp / 10, x0 = u * DECK.w, a2 = P(x0, DECK.d, 0), b2 = P(x0, DECK.d, 0.45); g.beginPath(); g.moveTo(a2.x, a2.y); g.lineTo(b2.x, b2.y); g.stroke(); }
      for (var rq = 0; rq <= 6; rq++) { var a3 = P(0, rq, 0), b3 = P(0, rq, 0.45); g.beginPath(); g.moveTo(a3.x, a3.y); g.lineTo(b3.x, b3.y); g.stroke(); }
      }
      // Spot rings for where you can go (yours glows).
      Object.keys(SP).forEach(function (k) {
        var q = P(SP[k][0], SP[k][1] + 0.6, 0.02), mine = scene.spot === k;
        g.beginPath(); g.ellipse(q.x, q.y, q.s * 0.45, q.s * 0.2, 0, 0, Math.PI * 2);
        g.strokeStyle = mine ? 'rgba(242,182,0,.95)' : 'rgba(255,255,255,.45)'; g.lineWidth = mine ? 3 : 1.5; g.stroke();
        hits.push({ spot: k, x: q.x, y: q.y, w: q.s * 1.2, h: q.s * 0.7 });
      });
      g.restore();
      if (el.isConnected) raf = root.requestAnimationFrame(frame); else raf = 0;
    }
    cv.addEventListener('click', function (e) {
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null;
      hits.forEach(function (h) { if (Math.abs(x - h.x) <= h.w / 2 && Math.abs(y - h.y) <= h.h / 2 && (!best || (h.by && !best.by))) best = h; });
      if (!best) return;
      if (best.by && opts.onPlayer) opts.onPlayer(best.by);
      else if (best.spot && opts.onSpot) opts.onSpot(best.spot);
    });
    function update(s) { scene = s || scene; if (!raf && el.isConnected) raf = root.requestAnimationFrame(frame); }
    function start() { if (!raf) raf = root.requestAnimationFrame(frame); }
    return { el: el, update: update, start: start, spots: SPOTS };
  }

  root.LasgidiCruise = { create: create, SPOTS: SPOTS, LAYOUTS: LAYOUTS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
