/* Lasgidi: a live airport scene, drawn on a canvas.
   A fenced airport plot with runway 50 · 22, a taxiway, five gates with jet bridges and airliners,
   six private jets, four helipads with choppers, a hangar, a fuel farm and a tall control tower.
   The terminal has a glass front under a wave roof and a green name band; in front of it a plaza
   with a fountain and flags, a live departures board, and two car parks of twenty bays each.
   Men and women walk between the car parks and the doors, cabs and a bus circle the kerb, and the
   board drives the sky: the next departure pushes back from its gate and takes off, an arrival lands. */
(function (root) {
  'use strict';
  var GW = 24, GD = 15;
  var CARC = ['#c0392b', '#2f6fa0', '#f4f3ec', '#17181a', '#f2b600', '#2fa36b', '#8fa2b3', '#e67e22', '#7d3c98', '#5d6d7e'];
  var GATES = [6.6, 8.7, 10.8, 12.9, 15.0];

  function create(opts) {
    opts = opts || {};
    var el = document.createElement('div'); el.className = 'airport-stage';
    var cv = document.createElement('canvas'); cv.className = 'airport-canvas';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Live view of the airport: runway 50 · 22, five gates, six private jets, four helipads, the terminal, the departures board and two car parks');
    el.appendChild(cv);
    var g = cv.getContext('2d'), scene = { name: 'Airport', night: false }, raf = 0, W = 0, H = 0, dpr = 1, hits = [];
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function size() {
      var w = el.clientWidth || 360, h = el.clientHeight || 400; dpr = Math.min(2, root.devicePixelRatio || 1);
      if (w === W && h === H) return; W = w; H = h; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    function P(x, y, z) {
      // Fit the whole fenced plot, with room above for the tower and the board.
      var tw = Math.min(W / (GW + GD) * (W < 600 ? 2.5 : 1.95), H / (GW + GD) * 3.55), th = tw * 0.5;
      var ox = W / 2 - (GW - GD) * tw / 4, oy = H * 0.5 - (GW + GD) * th / 4 + tw * 0.9;
      return { x: ox + (x - y) * tw / 2, y: oy + (x + y) * th / 2 - (z || 0) * tw, s: tw };
    }
    function poly(pts, fill, stroke, lw) { g.beginPath(); pts.forEach(function (p, i) { var q = P(p[0], p[1], p[2]); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); } }
    function rect(x, y, w, d, fill, z, stroke) { poly([[x, y, z || 0], [x + w, y, z || 0], [x + w, y + d, z || 0], [x, y + d, z || 0]], fill, stroke); }
    function box(x, y, w, d, h, top, side, front) {
      poly([[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h]], front || side);
      poly([[x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, h], [x + w, y, h]], side);
      poly([[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]], top);
    }
    function line(x0, y0, x1, y1, col, lw, dash, z) { var a = P(x0, y0, z || 0.002), b = P(x1, y1, z || 0.002); g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]); }
    // A plane seen from above, laid on the ground plane: heading in radians (0 = +x).
    function plane(x, y, z, heading, len, body, tail) {
      var c = Math.cos(heading), s = Math.sin(heading), pt = function (u, v) { return [x + u * c - v * s, y + u * s + v * c, z]; };
      var L = len, Wg = len * 0.9;
      if (z > 0.02) { var sh = function (u, v) { return [x + u * c - v * s + z * 0.6, y + u * s + v * c + z * 0.6, 0]; }; poly([sh(L / 2, 0), sh(-L / 2, L * 0.06), sh(-L / 2, -L * 0.06)], 'rgba(0,0,0,.18)'); }
      poly([pt(-L * 0.08, 0), pt(-L * 0.22, Wg / 2), pt(-L * 0.3, Wg / 2), pt(-L * 0.18, 0), pt(-L * 0.3, -Wg / 2), pt(-L * 0.22, -Wg / 2)], body, 'rgba(0,0,0,.25)', 0.6);
      poly([pt(-L * 0.4, 0), pt(-L * 0.48, L * 0.18), pt(-L * 0.52, L * 0.18), pt(-L * 0.47, 0), pt(-L * 0.52, -L * 0.18), pt(-L * 0.48, -L * 0.18)], body);
      poly([pt(L / 2, 0), pt(L * 0.42, L * 0.05), pt(-L / 2, L * 0.04), pt(-L / 2, -L * 0.04), pt(L * 0.42, -L * 0.05)], body, 'rgba(0,0,0,.3)', 0.6);
      poly([pt(-L * 0.36, L * 0.03), pt(-L * 0.5, L * 0.03), pt(-L * 0.5, -L * 0.03), pt(-L * 0.36, -L * 0.03)], tail);
    }
    function heli(x, y, t, body) {
      var p = P(x, y, 0.15), s = p.s; g.fillStyle = body || '#20252b'; g.beginPath(); g.ellipse(p.x, p.y, s * 0.28, s * 0.14, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(p.x, p.y - s * 0.03, s * 0.42, s * 0.05); g.fillStyle = 'rgba(160,210,240,.85)'; g.beginPath(); g.ellipse(p.x - s * 0.12, p.y - s * 0.02, s * 0.1, s * 0.07, 0, 0, Math.PI * 2); g.fill();
      var a = reduce ? 0.6 : t / 90; g.strokeStyle = 'rgba(30,34,40,.75)'; g.lineWidth = Math.max(1, s * 0.04);
      g.beginPath(); g.moveTo(p.x - Math.cos(a) * s * 0.55, p.y - s * 0.12 - Math.sin(a) * s * 0.18); g.lineTo(p.x + Math.cos(a) * s * 0.55, p.y - s * 0.12 + Math.sin(a) * s * 0.18); g.stroke();
    }
    function label(x, y, z, text, bg, fg, size) {
      var p = P(x, y, z); g.font = '800 ' + (size || Math.min(13, Math.max(8, p.s * 0.3))) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      var w = g.measureText(text).width + 10, h = (size || 13) + 4; if (bg) { g.fillStyle = bg; g.fillRect(p.x - w / 2, p.y - h / 2, w, h); } g.fillStyle = fg || '#fff'; g.fillText(text, p.x, p.y);
    }
    function car(x, y, col) {
      var p = P(x, y, 0.05), s = p.s; g.save(); g.translate(p.x, p.y); g.rotate(-0.46);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-s * 0.17, -s * 0.05, s * 0.36, s * 0.14);
      g.fillStyle = col; g.fillRect(-s * 0.18, -s * 0.08, s * 0.36, s * 0.15); g.fillStyle = 'rgba(180,220,255,.85)'; g.fillRect(-s * 0.06, -s * 0.07, s * 0.13, s * 0.13); g.restore();
    }
    function movingCar(x, y, col) { var p = P(x, y, 0.05), s = p.s; g.save(); g.translate(p.x, p.y); g.rotate(0.46); g.fillStyle = col; g.fillRect(-s * 0.18, -s * 0.07, s * 0.36, s * 0.14); g.fillStyle = 'rgba(180,220,255,.8)'; g.fillRect(-s * 0.05, -s * 0.06, s * 0.12, s * 0.12); g.restore(); }
    function palm(x, y, k) {
      var p = P(x, y, 0), s = p.s * (k || 1); g.strokeStyle = '#7a5230'; g.lineWidth = Math.max(1.5, s * 0.06); g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(p.x + s * 0.12, p.y - s * 0.5, p.x + s * 0.04, p.y - s * 0.95); g.stroke();
      g.fillStyle = '#2e8b3e'; for (var k2 = 0; k2 < 6; k2++) { var a = k2 * Math.PI / 3 + 0.3; g.beginPath(); g.ellipse(p.x + s * 0.04 + Math.cos(a) * s * 0.24, p.y - s * 0.95 + Math.sin(a) * s * 0.08, s * 0.26, s * 0.06, a, 0, Math.PI * 2); g.fill(); }
    }
    // A walker: men in trousers, women in a dress, legs swinging as they go.
    function walker(x, y, female, col, t, k) {
      var p = P(x, y, 0), s = Math.max(0.7, p.s / 40) * (k || 1), sw = reduce ? 0 : Math.sin(t / 140 + x * 7) * 2.2 * s;
      g.strokeStyle = '#3a2a1e'; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(p.x - 1 * s, p.y - 5 * s); g.lineTo(p.x - 1 * s + sw, p.y); g.moveTo(p.x + 1 * s, p.y - 5 * s); g.lineTo(p.x + 1 * s - sw, p.y); g.stroke();
      g.fillStyle = col;
      if (female) { g.beginPath(); g.moveTo(p.x - 3.2 * s, p.y - 4 * s); g.lineTo(p.x + 3.2 * s, p.y - 4 * s); g.lineTo(p.x + 1.6 * s, p.y - 10 * s); g.lineTo(p.x - 1.6 * s, p.y - 10 * s); g.closePath(); g.fill(); }
      else { g.fillRect(p.x - 2 * s, p.y - 10 * s, 4 * s, 5.5 * s); g.fillStyle = '#2b3440'; g.fillRect(p.x - 2 * s, p.y - 5 * s, 4 * s, 1.2 * s); }
      g.fillStyle = '#6b4029'; g.beginPath(); g.arc(p.x, p.y - 12 * s, 1.9 * s, 0, Math.PI * 2); g.fill();
      if (female) { g.fillStyle = col; g.beginPath(); g.ellipse(p.x, p.y - 13.6 * s, 2.4 * s, 1.1 * s, 0, 0, Math.PI * 2); g.fill(); }
      return { x: p.x, y: p.y - 14 * s };
    }
    function fence() {
      var col = scene.night ? 'rgba(200,205,212,.55)' : 'rgba(90,96,104,.75)';
      [[0.15, 0.15, GW - 0.15, 0.15], [GW - 0.15, 0.15, GW - 0.15, GD - 0.15], [0.15, 0.15, 0.15, GD - 0.15], [0.15, GD - 0.15, 4.6, GD - 0.15], [6.4, GD - 0.15, GW - 0.15, GD - 0.15]].forEach(function (e) {
        var n = Math.max(2, Math.round(Math.hypot(e[2] - e[0], e[3] - e[1]) / 0.8));
        for (var i = 0; i <= n; i++) { var x = e[0] + (e[2] - e[0]) * i / n, y = e[1] + (e[3] - e[1]) * i / n, a = P(x, y, 0), b = P(x, y, 0.32); g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
        [0.12, 0.22, 0.32].forEach(function (z) { line(e[0], e[1], e[2], e[3], col, 0.8, null, z); });
      });
      // The gate house at the entrance.
      box(4.75, GD - 0.75, 0.6, 0.5, 0.35, '#e9eaec', '#c9cbcf', '#dfe3e7'); line(4.6, GD - 0.15, 6.4, GD - 0.15, '#c0392b', 2.5, [4, 4], 0.25);
    }
    // The departures board on the plaza: live rows, jets and choppers marked apart.
    function board(t) {
      var b = scene.board; if (!b) return;
      var arr = !reduce && Math.floor(t / 9000) % 2 === 1, rows = (arr ? b.arr : b.dep) || [];
      var a = P(2.6, 13.4, 0), top = P(2.6, 13.4, 1.0), s = a.s, w = Math.min(W * 0.34, Math.max(190, s * 5.4)), rh = Math.max(9, Math.min(13, s * 0.3)), h = rh * (rows.length + 2) + 6;
      var x0 = top.x - w / 2, y0 = top.y - h;
      g.fillStyle = '#2b2f36'; g.fillRect(top.x - w * 0.3, top.y, 3, a.y - top.y); g.fillRect(top.x + w * 0.3, top.y, 3, a.y - top.y);
      g.fillStyle = '#0d1117'; g.fillRect(x0, y0, w, h); g.strokeStyle = '#3a3f46'; g.lineWidth = 2; g.strokeRect(x0, y0, w, h);
      g.font = '800 ' + Math.round(rh * 0.82) + 'px ui-monospace, Menlo, monospace'; g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillStyle = '#f2b600'; g.fillText(arr ? 'ARRIVALS' : 'DEPARTURES', x0 + 6, y0 + rh * 0.75);
      g.textAlign = 'right'; g.fillText(scene.clock || '', x0 + w - 6, y0 + rh * 0.75); g.textAlign = 'left';
      g.font = '700 ' + Math.round(rh * 0.6) + 'px ui-monospace, Menlo, monospace'; g.fillStyle = '#8fa2b3';
      var cols = [0.02, 0.17, 0.36, 0.66, 0.76];
      ['TIME', 'FLIGHT', arr ? 'FROM' : 'TO', 'TYPE', 'STATUS'].forEach(function (c, i) { g.fillText(c, x0 + w * cols[i] + 4, y0 + rh * 1.65); });
      g.font = '800 ' + Math.round(rh * 0.7) + 'px ui-monospace, Menlo, monospace';
      rows.forEach(function (r, i) {
        var y = y0 + rh * (2.6 + i), st = r.status, sc = /Boarding|Final|Landed|Gate/.test(st) ? '#4be08a' : /Delayed/.test(st) ? '#ff8a3d' : /Departed/.test(st) ? '#8fa2b3' : '#f4f3ec';
        g.fillStyle = '#f4f3ec'; g.fillText(r.time, x0 + w * cols[0] + 4, y); g.fillStyle = '#ffd36b'; g.fillText(r.code, x0 + w * cols[1] + 4, y);
        g.fillStyle = '#f4f3ec'; g.fillText(r.city.toUpperCase().slice(0, 13), x0 + w * cols[2] + 4, y);
        g.fillStyle = r.kind === 'heli' ? '#7fd3ff' : '#f4f3ec'; g.fillText(r.kind === 'heli' ? 'HELI' : 'JET', x0 + w * cols[3] + 4, y);
        g.fillStyle = sc; g.fillText(st.toUpperCase().slice(0, 10), x0 + w * cols[4] + 4, y);
      });
      hits.push({ kind: 'board', sx0: x0, sy0: y0, sx1: x0 + w, sy1: y0 + h });
    }
    function frame(t) {
      size(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, scene.night ? '#0d1a2e' : '#7fc6ea'); bg.addColorStop(1, scene.night ? '#0b2236' : '#3a9fcc'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      hits = [];
      var gates = scene.gates || [];
      // The airport plot: green land in a few tones, with an edge.
      poly([[0, GD, 0], [GW, GD, 0], [GW, GD, -0.3], [0, GD, -0.3]], '#5c8a43'); poly([[GW, 0, 0], [GW, GD, 0], [GW, GD, -0.3], [GW, 0, -0.3]], '#4f7a39');
      rect(0, 0, GW, GD, scene.night ? '#3e5e33' : '#9cc77a');
      [[0.4, 2.5, 4.4, 1.2, '#8dbd69'], [17.2, 7.6, 6.4, 1.2, '#a9d184'], [0.4, 12.2, 4.8, 2.4, '#86b863'], [17.6, 13.4, 6, 1.3, '#b3d88f'], [0.4, 8.9, 0.4, 3.2, '#a9d184']].forEach(function (q) { rect(q[0], q[1], q[2], q[3], scene.night ? '#35522c' : q[4], 0.001); });
      // Runway 50 · 22: piano keys, big numbers, touchdown bars, a centre line and edge lights.
      rect(1, 0.8, 22, 1.5, '#2c3036');
      line(4.0, 1.55, 20.0, 1.55, '#f4f3ec', 2, [10, 10]);
      for (var k = 0; k < 7; k++) { rect(1.15, 0.9 + k * 0.19, 0.7, 0.09, '#f4f3ec'); rect(22.15, 0.9 + k * 0.19, 0.7, 0.09, '#f4f3ec'); }
      [[3.6, 1.0], [3.6, 1.95], [20.0, 1.0], [20.0, 1.95]].forEach(function (q) { rect(q[0], q[1], 0.6, 0.12, '#f4f3ec'); rect(q[0] + 0.8, q[1], 0.6, 0.12, '#f4f3ec'); });
      label(2.6, 1.55, 0.02, '50', null, '#f4f3ec', 18); label(21.4, 1.55, 0.02, '22', null, '#f4f3ec', 18);
      for (var li = 0; li <= 22; li += 2) { [0.8, 2.3].forEach(function (yy) { var q = P(1 + li, yy, 0.01); g.fillStyle = scene.night ? '#ffe27a' : '#f2c94c'; g.beginPath(); g.arc(q.x, q.y, 1.6, 0, Math.PI * 2); g.fill(); }); }
      // Taxiway and links.
      rect(1, 2.8, 22, 0.45, '#3a3f46'); line(1, 3.02, 23, 3.02, '#f2b600', 1.4);
      [6, 11, 16, 20].forEach(function (x) { rect(x, 2.3, 0.45, 0.5, '#3a3f46'); });
      // Apron and the five gates: jet bridges, stand numbers, and an airliner unless that flight has gone.
      rect(5.5, 3.4, 11, 3.2, '#c9ccd1');
      GATES.forEach(function (gx, gi) {
        var gs = gates[gi] || {};
        box(gx + 0.25, 5.4, 0.25, 1.4, 0.22, '#e9eaec', '#c9cbcf');
        line(gx - 0.9, 3.5, gx - 0.9, 6.5, '#f2b600', 1, [3, 3]);
        if (gs.status !== 'Departed' && gs.status !== 'Pushback') plane(gx, 4.6, 0, Math.PI / 2, 1.95, '#f7f7f5', gs.tail || ['#1d7a43', '#c0392b', '#2f6fa0', '#1d7a43', '#f2b600'][gi]);
        label(gx - 0.45, 6.3, 0.02, String(gi + 1), '#f2b600', '#1a1500');
        if (gs.code) label(gx, 3.75, 0.5, gs.code + (gs.status ? ' · ' + gs.status : ''), /Boarding|Final/.test(gs.status) ? '#1d7a43' : 'rgba(23,24,26,.7)', '#fff', 10);
        if (/Boarding|Final/.test(gs.status) && !reduce) for (var bp = 0; bp < 3; bp++) { var u = ((t / 2600 + bp / 3) % 1); walker(gx + 0.37, 6.6 - u * 1.4, bp % 2 === 1, '#2f6fa0', t, 0.7); }
      });
      hits.push({ kind: 'departures', x0: 5.5, y0: 3.4, x1: 16.5, y1: 6.6 });
      // Private-jet apron: six business jets; yours wears your colour.
      rect(17, 3.4, 5.8, 3.6, '#d3d6da');
      [[17.9, 4.3], [19.8, 4.3], [21.7, 4.3], [17.9, 6.1], [19.8, 6.1], [21.7, 6.1]].forEach(function (q, i) {
        var mine = scene.myJet && i === 0; plane(q[0], q[1], 0, Math.PI / 2, 1.3, mine ? scene.myJet : i % 3 === 0 ? '#1f2329' : '#f7f7f5', mine ? '#d4af37' : '#8fa2b3');
        if (mine) label(q[0], q[1] + 0.95, 0.02, 'YOUR JET', '#d4af37', '#1a1500', 9);
      });
      label(19.9, 7.3, 0.02, 'PRIVATE JETS', '#1f2933'); hits.push({ kind: 'jet', x0: 17, y0: 3.4, x1: 22.8, y1: 7.4 });
      // Four helipads with parked choppers.
      [[1.7, 4.2], [3.7, 4.2], [1.7, 6.0], [3.7, 6.0]].forEach(function (q, i) {
        rect(q[0] - 0.75, q[1] - 0.75, 1.5, 1.5, '#3a3f46'); var c = P(q[0], q[1], 0.01); g.strokeStyle = '#f2b600'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(c.x, c.y, c.s * 0.55, c.s * 0.28, 0, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#f4f3ec'; g.font = '900 ' + Math.max(8, c.s * 0.35) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', c.x, c.y);
        heli(q[0] + 0.1, q[1] - 0.05, t + i * 400, scene.myHeli && i === 0 ? scene.myHeli : ['#20252b', '#1f3b63', '#20252b', '#7a1f2b'][i]);
      });
      label(0.9, 7.3, 0.02, 'HELIPORT', '#1f2933', '#fff', 10);
      hits.push({ kind: 'chopper', x0: 0.9, y0: 3.4, x1: 4.5, y1: 6.8 });
      // Hangar and fuel farm.
      box(0.9, 8.9, 3.8, 1.5, 0.8, '#c9ced4', '#aeb4bb', '#dfe3e7');
      var hg = P(2.8, 10.4, 0.4); g.strokeStyle = '#9aa1a8'; g.lineWidth = 1.2; for (var hr = 0; hr < 5; hr++) { g.beginPath(); g.ellipse(hg.x, hg.y, hg.s * (0.4 + hr * 0.18), hg.s * 0.25, 0, Math.PI, 0); g.stroke(); }
      [[1.4, 11.4], [2.4, 11.4], [3.4, 11.4]].forEach(function (q) { var p = P(q[0], q[1], 0), s = p.s; g.fillStyle = '#e3e6e9'; g.fillRect(p.x - s * 0.3, p.y - s * 0.45, s * 0.6, s * 0.45); g.beginPath(); g.ellipse(p.x, p.y - s * 0.45, s * 0.3, s * 0.12, 0, 0, Math.PI * 2); g.fillStyle = '#f4f6f8'; g.fill(); });
      // The terminal: a long glass front under a wave roof, a green name band, and the city codes at each end.
      box(5.6, 6.8, 11.0, 1.9, 0.85, '#e9ecef', '#c7cbd0', '#9fc4dc');
      for (var w = 0; w < 14; w++) { var a2 = P(5.9 + w * 0.76, 8.7, 0.12), b2 = P(5.9 + w * 0.76, 8.7, 0.7); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a2.x, a2.y); g.lineTo(b2.x, b2.y); g.stroke(); }
      for (var rw = 0; rw < 4; rw++) { var ry = 7.05 + rw * 0.42; g.strokeStyle = '#7fb2d4'; g.lineWidth = 2; g.beginPath(); for (var rx = 0; rx <= 22; rx++) { var xx = 5.7 + rx * 0.5, q = P(xx, ry + Math.sin(rx * 0.7) * 0.06, 0.87); if (rx) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); } g.stroke(); }
      poly([[5.6, 8.7, 0.62], [16.6, 8.7, 0.62], [16.6, 8.7, 0.86], [5.6, 8.7, 0.86]], '#1d5a3c');
      label(11.1, 8.7, 0.74, (scene.name || 'AIRPORT').toUpperCase(), null, '#ffffff', 11); label(6.5, 8.7, 0.74, scene.code || 'LOS', null, '#ffd36b', 10); label(15.7, 8.7, 0.74, scene.code || 'LOS', null, '#ffd36b', 10);
      hits.push({ kind: 'terminal', x0: 5.6, y0: 6.8, x1: 16.6, y1: 8.8 });
      // Control tower: a tall shaft, the glass cab, the roof and a blinking beacon.
      box(21.3, 9.3, 0.5, 0.5, 3.4, '#dfe3e7', '#c3c9cf', '#eef1f3');
      box(20.95, 8.95, 1.2, 1.2, 0.01, '#c9ccd1', '#aeb4bb'); var tc = P(21.55, 9.55, 3.4), ts = tc.s; g.fillStyle = 'rgba(110,170,210,.95)'; g.fillRect(tc.x - ts * 0.55, tc.y - ts * 0.5, ts * 1.1, ts * 0.5); g.fillStyle = '#e3e6e9'; g.beginPath(); g.ellipse(tc.x, tc.y - ts * 0.5, ts * 0.62, ts * 0.2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#6b7280'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(tc.x, tc.y - ts * 0.6); g.lineTo(tc.x, tc.y - ts * 1.1); g.stroke(); if (reduce || Math.floor(t / 600) % 2 === 0) { g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(tc.x, tc.y - ts * 1.12, 2.5, 0, Math.PI * 2); g.fill(); }
      label(21.55, 10.4, 0.02, 'TOWER', '#1f2933', '#fff', 9);
      // Landside: kerb road, the plaza with fountain and flags, two car parks of twenty bays, a taxi rank, the access road.
      rect(5.5, 8.8, 11.5, 0.6, '#3a3f46'); line(5.5, 9.1, 17, 9.1, '#f4f3ec', 1, [6, 6]);
      rect(9.6, 9.5, 2.7, 3.0, scene.night ? '#7d7a70' : '#e7e1d2');
      var fo = P(10.95, 11.4, 0.01); g.fillStyle = '#c9ccd1'; g.beginPath(); g.ellipse(fo.x, fo.y, fo.s * 0.8, fo.s * 0.4, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3fb6d8'; g.beginPath(); g.ellipse(fo.x, fo.y, fo.s * 0.6, fo.s * 0.3, 0, 0, Math.PI * 2); g.fill();
      if (!reduce) for (var d = 0; d < 6; d++) { var du = (t / 700 + d / 6) % 1, da = d * 1.05; g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(fo.x + Math.cos(da) * du * fo.s * 0.4, fo.y - fo.s * 0.6 * Math.sin(du * Math.PI) - 2, 1.6, 0, Math.PI * 2); g.fill(); }
      [[9.8, 12.3], [12.1, 12.3]].forEach(function (q) { var a = P(q[0], q[1], 0), b = P(q[0], q[1], 1.1); g.strokeStyle = '#d9dde1'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); var fw = b.s * 0.42, fh = b.s * 0.26, wv = reduce ? 0 : Math.sin(t / 300 + q[0]) * 2; g.fillStyle = '#1f8a4c'; g.fillRect(b.x, b.y + wv * 0.2, fw / 3, fh); g.fillStyle = '#ffffff'; g.fillRect(b.x + fw / 3, b.y + wv * 0.2, fw / 3, fh); g.fillStyle = '#1f8a4c'; g.fillRect(b.x + fw * 2 / 3, b.y + wv * 0.2, fw / 3, fh); });
      var lots = [[5.8, 9.8, 3.6, 2.6], [12.6, 9.8, 3.6, 2.6]], bays = 0;
      lots.forEach(function (r, ri) {
        rect(r[0], r[1], r[2], r[3], '#50565e');
        for (var cx = 0; cx < 10; cx++) for (var cy = 0; cy < 2; cy++) {
          var bx = r[0] + 0.18 + cx * 0.34, by = r[1] + 0.45 + cy * 1.35; line(bx - 0.15, by - 0.4, bx - 0.15, by + 0.4, 'rgba(255,255,255,.55)', 0.8);
          var full = ((cx * 7 + cy * 13 + ri * 5) % 10) < 8 || (scene.busy && ((cx + cy) % 3)); if (full) { car(bx, by, CARC[(cx + cy * 3 + ri * 2) % CARC.length]); bays++; }
        }
        line(r[0] + 0.3, r[1] + 1.3, r[0] + r[2] - 0.3, r[1] + 1.3, 'rgba(255,255,255,.7)', 1, [5, 5]);
      });
      hits.push({ kind: 'parking', x0: 5.8, y0: 9.8, x1: 16.2, y1: 12.4 });
      rect(17.4, 9.8, 2.4, 1.0, '#50565e'); for (var tx2 = 0; tx2 < 5; tx2++) car(17.65 + tx2 * 0.46, 10.3, '#f2c200'); label(18.6, 11.1, 0.02, 'TAXI', '#f2c200', '#1a1500', 9);
      rect(5.5, 12.75, 17.5, 0.6, '#3a3f46'); line(5.5, 13.05, 23, 13.05, '#f4f3ec', 1, [6, 6]); rect(16.6, 8.8, 0.6, 4.55, '#3a3f46'); rect(4.6, 12.75, 1.8, 2.25, '#3a3f46');
      // Palms along the plaza, the access road and the fence.
      [[5.4, 9.6], [9.3, 9.7], [12.6, 9.6], [16.4, 9.6], [9.4, 12.5], [12.4, 12.5]].forEach(function (q) { palm(q[0], q[1], 0.85); });
      for (var pr = 0; pr < 12; pr++) palm(6.8 + pr * 1.4, 13.9 - (pr % 2) * 0.25, 0.9);
      [[0.6, 13.2], [1.6, 14.1], [2.8, 13.0], [23.3, 8.4], [23.4, 11.0], [23.2, 13.9], [0.7, 2.9], [23.4, 3.2]].forEach(function (q) { palm(q[0], q[1], 0.95); });
      // Moving traffic: cars round the kerb and along the access road, and an airport bus.
      var tt = reduce ? 0 : t / 1000;
      for (var m = 0; m < 6; m++) { var u0 = ((tt * 0.09 + m / 6) % 1); movingCar(5.6 + u0 * 11.2, 8.98, CARC[m % CARC.length]); }
      for (var n2 = 0; n2 < 5; n2++) { var u2 = ((tt * 0.07 + n2 / 5) % 1); movingCar(22.8 - u2 * 17, 12.93 + (n2 % 2) * 0.25, CARC[(n2 + 3) % CARC.length]); }
      var bu = ((tt * 0.05) % 1); box(5.6 + bu * 10.5, 9.15, 0.9, 0.22, 0.25, '#2f6fd0', '#24559f', '#3a7be0');
      // People: travellers walking between the car parks and the doors (men and women), and live players by name.
      for (var pi = 0; pi < 22; pi++) { var pu = ((tt * 0.11 + pi * 0.137) % 1), out = pi % 3 === 0, px = 6.2 + (pi * 0.71 % 9.8), py = out ? 9.5 + pu * 2.9 : 12.4 - pu * 2.9; walker(px, py, pi % 2 === 1, ['#c0392b', '#2f6fa0', '#f2b600', '#2fa36b', '#8e44ad', '#e67e22', '#17181a'][pi % 7], t); }
      (scene.players || []).slice(0, 6).forEach(function (pl, i) {
        var px = 7 + i * 1.6, py = 9.55 + (reduce ? 0 : Math.sin(t / 2000 + i) * 0.15), top = walker(px, py, !!pl.female, '#2f6fd0', t, 1.2);
        g.font = '700 10px system-ui, sans-serif'; var tw = g.measureText(pl.label).width + 10; g.fillStyle = pl.me ? '#2f6fd0' : 'rgba(20,24,30,.78)'; g.fillRect(top.x - tw / 2, top.y - 16, tw, 13); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(pl.label, top.x, top.y - 9.5);
      });
      fence();
      board(t);
      // The sky follows the board: the next departure takes off (a chopper lifts if it is a heli), an arrival lands.
      if (!reduce) {
        var cyc = (t / 1000) % 26, dep = scene.nextDep, arr = scene.nextArr;
        if (cyc < 12) { var lu = cyc / 12, ease = 1 - Math.pow(1 - lu, 2), lx = -2 + ease * 18, lz = Math.max(0, 1.6 * (1 - lu * 2.2)); plane(lx, 1.55, lz, 0, 2.1, '#f7f7f5', '#1d7a43'); if (arr) label(lx, 1.55, lz + 0.6, arr, 'rgba(23,24,26,.7)', '#fff', 9); }
        else if (cyc > 13) {
          var tu = (cyc - 13) / 13;
          if (dep && dep.kind === 'heli') { var hz = tu * 4, hx = 1.7 + tu * 6; var hp = P(hx, 4.2, hz); heli(hx, 4.2 - hz * 0.0, t); label(hx, 4.2, hz + 0.7, dep.code, 'rgba(23,24,26,.7)', '#fff', 9); }
          else { var tx = 22 - tu * tu * 26, tz = Math.max(0, (tu - 0.45) * 3.2); plane(tx, 1.55, tz, Math.PI, 2.1, '#f7f7f5', '#c0392b'); if (dep) label(tx, 1.55, tz + 0.6, dep.code + ' → ' + dep.city, 'rgba(23,24,26,.7)', '#fff', 9); }
        }
      }
      if (el.isConnected) raf = root.requestAnimationFrame(frame); else raf = 0;
    }
    cv.addEventListener('click', function (e) {
      if (!opts.onTap) return;
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      var bh = hits.filter(function (h) { return h.sx0 != null && x >= h.sx0 && x <= h.sx1 && y >= h.sy0 && y <= h.sy1; })[0]; if (bh) { opts.onTap(bh.kind); return; }
      // Back-project the tap onto the ground plane.
      var a = P(0, 0, 0), bx = P(1, 0, 0), by = P(0, 1, 0), ux = bx.x - a.x, uy = bx.y - a.y, vx = by.x - a.x, vy = by.y - a.y, det = ux * vy - uy * vx;
      var gx = ((x - a.x) * vy - (y - a.y) * vx) / det, gy = (ux * (y - a.y) - uy * (x - a.x)) / det;
      var hit = hits.filter(function (h) { return h.x0 != null && gx >= h.x0 && gx <= h.x1 && gy >= h.y0 && gy <= h.y1; })[0];
      if (hit) opts.onTap(hit.kind);
    });
    function update(s) { scene = s || scene; if (!raf && el.isConnected) raf = root.requestAnimationFrame(frame); }
    function start() { if (!raf) raf = root.requestAnimationFrame(frame); }
    return { el: el, update: update, start: start, canvas: cv };
  }
  root.LasgidiAirport = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
