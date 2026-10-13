/* Lasgidi: the Lagoon Boat Cruise deck, drawn on a canvas.
   An isometric wooden deck on the lagoon with a wheelhouse, a deck bar, loungers,
   a colour dance floor, speakers and a stern rail. Players stand at their spots
   with @handles over their heads. Tap a spot to move there, or a player to chat. */
(function (root) {
  'use strict';
  var D = root.LASGIDI_DATA;
  // Deck coordinates (x along the boat, y across). Each spot has a centre where its people gather.
  var SPOTS = { helm: [8.4, 1.6], sun: [8.2, 4.4], bar: [2.0, 1.5], party: [5.0, 3.4], rail: [1.4, 4.6] };
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
    function sign(x, y, z, text, bg) {
      var p = P(x, y, z), s = p.s;
      g.font = '800 ' + Math.min(15, Math.max(9, s * 0.24)) + 'px system-ui, sans-serif';
      var tw = g.measureText(text).width + 16, th = Math.min(26, Math.max(16, s * 0.4));
      g.fillStyle = '#3a3d42'; g.fillRect(p.x - tw / 2 + s * 0.1, p.y, s * 0.06, s * 1.2); g.fillRect(p.x + tw / 2 - s * 0.16, p.y, s * 0.06, s * 1.2);
      g.fillStyle = bg; g.fillRect(p.x - tw / 2, p.y - th, tw, th);
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
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      var bob = reduce ? 0 : Math.sin(t / 900) * 2;
      // Sky and lagoon.
      var sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, scene.night ? '#0d1733' : '#bfe3f7'); sky.addColorStop(0.28, scene.night ? '#1c2c55' : '#d9f0fb'); sky.addColorStop(0.3, scene.night ? '#0f2f4a' : '#2a9cc4'); sky.addColorStop(1, scene.night ? '#0a2236' : '#1d7fa3');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.5;
      for (var i = 0; i < 18; i++) { var wy = H * 0.34 + (i * 37 % (H * 0.66)), wx = ((i * 97 + (reduce ? 0 : t / 40)) % (W + 80)) - 40; g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 12, wy - 4, wx + 24, wy); g.stroke(); }
      g.save(); g.translate(0, bob);
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
      // Players and crew, back to front.
      hits = [];
      var placed = {}, list = (scene.players || []).map(function (pl) {
        var base = SPOTS[pl.spot] || SPOTS.rail, n = placed[pl.spot] = (placed[pl.spot] || 0) + 1, ang = n * 2.4, rad = n === 1 ? 0 : 0.6 + 0.2 * Math.floor(n / 4);
        return { pl: pl, x: base[0] + Math.cos(ang) * rad, y: base[1] + Math.sin(ang) * rad * 0.8 };
      }).sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
      // Stagger labels that would sit on top of each other.
      list.forEach(function (it, i) { var p0 = P(it.x, it.y, 0); for (var j = 0; j < i; j++) { var q = P(list[j].x, list[j].y, 0); if (Math.abs(q.x - p0.x) < 70 && Math.abs((q.y - (list[j].lift || 0)) - (p0.y - (it.lift || 0))) < 18) it.lift = (it.lift || 0) + 18; } });
      list.forEach(function (it) {
        var p = P(it.x, it.y, 0), s = p.s, fig = figure(it.pl), fh = s * 1.5, fw = fh * 180 / 260;
        var dance = !reduce && it.pl.spot === 'party' ? Math.abs(Math.sin(t / 220 + it.x * 3)) * s * 0.12 : 0;
        if (fig) g.drawImage(fig, p.x - fw / 2, p.y - fh + fh * 0.06 - dance, fw, fh);
        var label = it.pl.label || '';
        g.font = '700 ' + Math.min(12, Math.max(9, s * 0.2)) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        var lw = g.measureText(label).width + 12, ly = p.y - fh - 4 - dance - (it.lift || 0);
        g.fillStyle = it.pl.me ? '#f2b600' : it.pl.crew ? 'rgba(40,44,52,.85)' : '#2f6fd0';
        g.beginPath(); if (g.roundRect) g.roundRect(p.x - lw / 2, ly - 9, lw, 18, 9); else g.rect(p.x - lw / 2, ly - 9, lw, 18); g.fill();
        g.fillStyle = it.pl.me ? '#1a1500' : '#ffffff'; g.fillText(label, p.x, ly);
        var bub = scene.bubbles && scene.bubbles[it.pl.by];
        if (bub) {
          g.font = '600 12px system-ui, sans-serif'; var text = bub.length > 34 ? bub.slice(0, 33) + '…' : bub, bw = g.measureText(text).width + 16, by = ly - 26;
          g.fillStyle = '#ffffff'; g.beginPath(); if (g.roundRect) g.roundRect(p.x - bw / 2, by - 11, bw, 22, 10); else g.rect(p.x - bw / 2, by - 11, bw, 22); g.fill();
          g.beginPath(); g.moveTo(p.x - 5, by + 10); g.lineTo(p.x + 5, by + 10); g.lineTo(p.x, by + 16); g.fill();
          g.fillStyle = '#17181a'; g.fillText(text, p.x, by);
        }
        if (!it.pl.me && !it.pl.crew) hits.push({ by: it.pl.by, x: p.x, y: p.y - fh / 2, w: fw, h: fh + 20 });
      });
      // The stern rail.
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      [[0, DECK.d, 0, 0], [0, DECK.d, DECK.w, DECK.d]].forEach(function (l) { var a = P(l[0], l[1], 0.45), b = P(l[2], l[3], 0.45); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); });
      for (var rp = 0; rp <= 10; rp++) { var u = rp / 10, x0 = u * DECK.w, a2 = P(x0, DECK.d, 0), b2 = P(x0, DECK.d, 0.45); g.beginPath(); g.moveTo(a2.x, a2.y); g.lineTo(b2.x, b2.y); g.stroke(); }
      for (var rq = 0; rq <= 6; rq++) { var a3 = P(0, rq, 0), b3 = P(0, rq, 0.45); g.beginPath(); g.moveTo(a3.x, a3.y); g.lineTo(b3.x, b3.y); g.stroke(); }
      // Spot rings for where you can go (yours glows).
      Object.keys(SPOTS).forEach(function (k) {
        var q = P(SPOTS[k][0], SPOTS[k][1] + 0.6, 0.02), mine = scene.spot === k;
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

  root.LasgidiCruise = { create: create, SPOTS: SPOTS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
