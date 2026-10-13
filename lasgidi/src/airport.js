/* Lasgidi: a live airport scene, drawn on a canvas.
   Runway with planes landing and taking off, gates with airliners, a private-jet
   apron, helipads with choppers, a hangar, fuel tanks, a control tower, the
   terminal, and car parks with moving traffic and passengers walking in. */
(function (root) {
  'use strict';
  var GW = 24, GD = 15;

  function create(opts) {
    opts = opts || {};
    var el = document.createElement('div'); el.className = 'airport-stage';
    var cv = document.createElement('canvas'); cv.className = 'airport-canvas';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Live view of the airport: runway, gates, private jets, helipads, terminal and car parks');
    el.appendChild(cv);
    var g = cv.getContext('2d'), scene = { name: 'Airport', night: false }, raf = 0, W = 0, H = 0, dpr = 1, hits = [];
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function size() {
      var w = el.clientWidth || 360, h = el.clientHeight || 400; dpr = Math.min(2, root.devicePixelRatio || 1);
      if (w === W && h === H) return; W = w; H = h; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    function P(x, y, z) {
      var tw = Math.min(W / (GW + GD) * (W < 600 ? 2.7 : 2.05), H / (GW + GD) * 4.6), th = tw * 0.5;
      var ox = W / 2 - (GW - GD) * tw / 4, oy = H * 0.5 - (GW + GD) * th / 4;
      return { x: ox + (x - y) * tw / 2, y: oy + (x + y) * th / 2 - (z || 0) * tw, s: tw };
    }
    function poly(pts, fill, stroke, lw) { g.beginPath(); pts.forEach(function (p, i) { var q = P(p[0], p[1], p[2]); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); } }
    function rect(x, y, w, d, fill, z, stroke) { poly([[x, y, z || 0], [x + w, y, z || 0], [x + w, y + d, z || 0], [x, y + d, z || 0]], fill, stroke); }
    function box(x, y, w, d, h, top, side, front) {
      poly([[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h]], front || side);
      poly([[x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, h], [x + w, y, h]], side);
      poly([[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]], top);
    }
    function line(x0, y0, x1, y1, col, lw, dash) { var a = P(x0, y0, 0.002), b = P(x1, y1, 0.002); g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]); }
    // A plane seen from above, laid on the ground plane: heading in radians (0 = +x).
    function plane(x, y, z, heading, len, body, tail) {
      var c = Math.cos(heading), s = Math.sin(heading), pt = function (u, v) { return [x + u * c - v * s, y + u * s + v * c, z]; };
      var L = len, Wg = len * 0.9;
      if (z > 0.02) { var sh = function (u, v) { return [x + u * c - v * s + z * 0.6, y + u * s + v * c + z * 0.6, 0]; }; poly([sh(L / 2, 0), sh(-L / 2, L * 0.06), sh(-L / 2, -L * 0.06)], 'rgba(0,0,0,.18)'); }
      poly([pt(-L * 0.08, 0), pt(-L * 0.22, Wg / 2), pt(-L * 0.3, Wg / 2), pt(-L * 0.18, 0), pt(-L * 0.3, -Wg / 2), pt(-L * 0.22, -Wg / 2)], body, 'rgba(0,0,0,.25)', 0.6);
      poly([pt(-L * 0.4, 0), pt(-L * 0.48, L * 0.18), pt(-L * 0.52, L * 0.18), pt(-L * 0.47, 0), pt(-L * 0.52, -L * 0.18), pt(-L * 0.48, -L * 0.18)], body);
      poly([pt(L / 2, 0), pt(L * 0.42, L * 0.05), pt(-L / 2, L * 0.04), pt(-L / 2, -L * 0.04), pt(L * 0.42, -L * 0.05)], body, 'rgba(0,0,0,.3)', 0.6);
      var tp = P.apply(null, pt(-L * 0.47, 0)); g.fillStyle = tail; g.beginPath(); g.arc(tp.x, tp.y - z * 0, Math.max(1.5, tp.s * 0.08), 0, Math.PI * 2); g.fill();
    }
    function heli(x, y, t) {
      var p = P(x, y, 0.15), s = p.s; g.fillStyle = '#20252b'; g.beginPath(); g.ellipse(p.x, p.y, s * 0.28, s * 0.14, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(p.x, p.y - s * 0.03, s * 0.42, s * 0.05);
      var a = reduce ? 0.6 : t / 90; g.strokeStyle = 'rgba(30,34,40,.75)'; g.lineWidth = Math.max(1, s * 0.04);
      g.beginPath(); g.moveTo(p.x - Math.cos(a) * s * 0.55, p.y - s * 0.12 - Math.sin(a) * s * 0.18); g.lineTo(p.x + Math.cos(a) * s * 0.55, p.y - s * 0.12 + Math.sin(a) * s * 0.18); g.stroke();
    }
    function label(x, y, z, text, bg, fg) {
      var p = P(x, y, z); g.font = '800 ' + Math.min(13, Math.max(8, p.s * 0.3)) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      var w = g.measureText(text).width + 10; g.fillStyle = bg; g.fillRect(p.x - w / 2, p.y - 8, w, 16); g.fillStyle = fg || '#fff'; g.fillText(text, p.x, p.y);
    }
    function car(x, y, col, along) {
      var p = P(x, y, 0.05), s = p.s; g.fillStyle = col; g.save(); g.translate(p.x, p.y); g.rotate(along ? 0.46 : -0.46); g.fillRect(-s * 0.18, -s * 0.07, s * 0.36, s * 0.14); g.fillStyle = 'rgba(180,220,255,.8)'; g.fillRect(-s * 0.05, -s * 0.06, s * 0.12, s * 0.12); g.restore();
    }
    var CARC = ['#c0392b', '#2f6fa0', '#f4f3ec', '#17181a', '#f2b600', '#2fa36b', '#8fa2b3', '#e67e22'];
    function frame(t) {
      size(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, scene.night ? '#0d1a2e' : '#7fc6ea'); bg.addColorStop(1, scene.night ? '#0b2236' : '#3a9fcc'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      hits = [];
      // The airport plot: grass with an edge.
      poly([[0, GD, 0], [GW, GD, 0], [GW, GD, -0.3], [0, GD, -0.3]], '#5c8a43'); poly([[GW, 0, 0], [GW, GD, 0], [GW, GD, -0.3], [GW, 0, -0.3]], '#4f7a39');
      rect(0, 0, GW, GD, scene.night ? '#3e5e33' : '#9cc77a');
      // Runway 09/27 with a centre line, thresholds and edge lights.
      rect(1, 0.8, 22, 1.5, '#2c3036');
      line(2.2, 1.55, 21.8, 1.55, '#f4f3ec', 2, [10, 10]);
      for (var k = 0; k < 6; k++) { rect(1.15, 0.9 + k * 0.22, 0.6, 0.1, '#f4f3ec'); rect(22.25, 0.9 + k * 0.22, 0.6, 0.1, '#f4f3ec'); }
      label(2.4, 1.55, 0.02, '09', 'rgba(0,0,0,0)', '#f4f3ec'); label(21.6, 1.55, 0.02, '27', 'rgba(0,0,0,0)', '#f4f3ec');
      for (var li = 0; li <= 22; li += 2) { [0.8, 2.3].forEach(function (yy) { var q = P(1 + li, yy, 0.01); g.fillStyle = scene.night ? '#ffe27a' : '#f2c94c'; g.beginPath(); g.arc(q.x, q.y, 1.6, 0, Math.PI * 2); g.fill(); }); }
      // Taxiway and links.
      rect(1, 2.8, 22, 0.45, '#3a3f46'); line(1, 3.02, 23, 3.02, '#f2b600', 1.4);
      [6, 11, 16, 20].forEach(function (x) { rect(x, 2.3, 0.45, 0.5, '#3a3f46'); });
      // Apron, gates and airliners.
      rect(5.5, 3.4, 11, 3.0, '#c9ccd1');
      for (var gi = 0; gi < 5; gi++) {
        var gx = 6.6 + gi * 2.1;
        box(gx + 0.25, 5.6, 0.25, 0.8, 0.22, '#e9eaec', '#c9cbcf');
        plane(gx, 4.7, 0, Math.PI / 2, 1.95, '#f7f7f5', ['#1d7a43', '#c0392b', '#2f6fa0', '#1d7a43', '#f2b600'][gi]);
        label(gx - 0.4, 6.0, 0.02, String(gi + 1), '#f2b600', '#1a1500');
      }
      hits.push({ kind: 'departures', x0: 5.5, y0: 3.4, x1: 16.5, y1: 8.6 });
      // Private-jet apron: six business jets, two of them black.
      rect(17, 3.4, 5.8, 3.6, '#d3d6da');
      [[17.9, 4.3], [19.8, 4.3], [21.7, 4.3], [17.9, 6.1], [19.8, 6.1], [21.7, 6.1]].forEach(function (q, i) { plane(q[0], q[1], 0, Math.PI / 2, 1.3, i % 3 === 0 ? '#1f2329' : '#f7f7f5', '#8fa2b3'); });
      label(19.9, 7.3, 0.02, 'PRIVATE JETS', '#1f2933'); hits.push({ kind: 'jet', x0: 17, y0: 3.4, x1: 22.8, y1: 7.4 });
      // Helipads with parked choppers.
      [[2.0, 4.6], [3.9, 4.6]].forEach(function (q, i) {
        rect(q[0] - 0.75, q[1] - 0.75, 1.5, 1.5, '#3a3f46'); var c = P(q[0], q[1], 0.01); g.strokeStyle = '#f2b600'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(c.x, c.y, c.s * 0.55, c.s * 0.28, 0, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#f4f3ec'; g.font = '900 ' + Math.max(8, c.s * 0.35) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', c.x, c.y);
        heli(q[0] + 0.1, q[1] - 0.05, t + i * 400);
      });
      hits.push({ kind: 'chopper', x0: 1, y0: 3.6, x1: 5, y1: 5.6 });
      // Hangar, fuel farm and control tower.
      box(1.0, 6.4, 3.6, 2.2, 0.9, '#c9ced4', '#aeb4bb', '#dfe3e7');
      var hg = P(2.8, 8.6, 0.45); g.strokeStyle = '#9aa1a8'; g.lineWidth = 1.2; for (var hr = 0; hr < 5; hr++) { g.beginPath(); g.ellipse(hg.x, hg.y, hg.s * (0.4 + hr * 0.18), hg.s * 0.25, 0, Math.PI, 0); g.stroke(); }
      label(2.8, 8.9, 0.02, 'HANGAR', '#1f2933');
      [[1.4, 10.8], [2.4, 10.8], [3.4, 10.8]].forEach(function (q) { var p = P(q[0], q[1], 0), s = p.s; g.fillStyle = '#e3e6e9'; g.fillRect(p.x - s * 0.3, p.y - s * 0.45, s * 0.6, s * 0.45); g.beginPath(); g.ellipse(p.x, p.y - s * 0.45, s * 0.3, s * 0.12, 0, 0, Math.PI * 2); g.fillStyle = '#f4f6f8'; g.fill(); });
      box(21.2, 9.2, 0.6, 0.6, 2.6, '#dfe3e7', '#c3c9cf', '#eef1f3');
      box(20.95, 8.95, 1.1, 1.1, 0.45, 'rgba(120,180,220,.9)', '#5d8fb0', '#7fb2d4');
      // Terminal building with its sign.
      box(6.0, 6.8, 10.0, 1.8, 0.8, '#e6e8eb', '#c7cbd0', '#9fc4dc');
      for (var w = 0; w < 12; w++) { var a2 = P(6.3 + w * 0.8, 8.6, 0.25), b2 = P(6.3 + w * 0.8, 8.6, 0.65); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a2.x, a2.y); g.lineTo(b2.x, b2.y); g.stroke(); }
      label(11, 8.75, 0.95, (scene.name || 'AIRPORT').toUpperCase(), '#1d5a3c');
      // Landside: the kerb road, two car parks, a fountain, the access road and palms.
      rect(5.5, 8.8, 11.5, 0.6, '#3a3f46'); line(5.5, 9.1, 17, 9.1, '#f4f3ec', 1, [6, 6]);
      [[5.8, 9.8, 4.6, 2.4], [11.6, 9.8, 4.6, 2.4], [18, 9.8, 3.4, 1.4]].forEach(function (r, ri) {
        rect(r[0], r[1], r[2], r[3], '#50565e');
        for (var cx = 0; cx < Math.floor(r[2] / 0.45); cx++) for (var cy = 0; cy < Math.floor(r[3] / 0.6); cy++) { var hsh = (cx * 7 + cy * 13 + ri * 5) % 10; if (hsh < 7) car(r[0] + 0.25 + cx * 0.45, r[1] + 0.3 + cy * 0.6, CARC[(cx + cy * 3 + ri) % CARC.length], false); }
      });
      hits.push({ kind: 'parking', x0: 5.8, y0: 9.8, x1: 16.2, y1: 12.2 });
      var fo = P(10.95, 11, 0.01); g.fillStyle = '#c9ccd1'; g.beginPath(); g.ellipse(fo.x, fo.y, fo.s * 0.7, fo.s * 0.35, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3fb6d8'; g.beginPath(); g.ellipse(fo.x, fo.y, fo.s * 0.5, fo.s * 0.25, 0, 0, Math.PI * 2); g.fill();
      rect(5.5, 12.6, 17.5, 0.6, '#3a3f46'); line(5.5, 12.9, 23, 12.9, '#f4f3ec', 1, [6, 6]); rect(16.6, 8.8, 0.6, 4.4, '#3a3f46');
      // Moving traffic: cars round the kerb and along the access road, and an airport bus.
      var tt = reduce ? 0 : t / 1000;
      for (var m = 0; m < 6; m++) { var u = ((tt * 0.09 + m / 6) % 1); car(5.6 + u * 11.2, 8.98, CARC[m % CARC.length], true); }
      for (var n2 = 0; n2 < 5; n2++) { var u2 = ((tt * 0.07 + n2 / 5) % 1); car(22.8 - u2 * 17, 12.78 + (n2 % 2) * 0.25, CARC[(n2 + 3) % CARC.length], true); }
      var bu = ((tt * 0.05) % 1); box(5.6 + bu * 10.5, 9.15, 0.9, 0.22, 0.25, '#2f6fd0', '#24559f', '#3a7be0');
      // Passengers walking from the car parks to the terminal doors.
      for (var pi = 0; pi < 16; pi++) { var pu = ((tt * 0.12 + pi * 0.137) % 1), px = 6.4 + (pi * 0.71 % 9.4), py = 11.6 - pu * 3.0, pp = P(px, py, 0); g.fillStyle = ['#c0392b', '#2f6fa0', '#f2b600', '#2fa36b', '#8e44ad'][pi % 5]; g.fillRect(pp.x - 1.5, pp.y - 7, 3, 6); g.fillStyle = '#6b4029'; g.beginPath(); g.arc(pp.x, pp.y - 8.5, 1.8, 0, Math.PI * 2); g.fill(); }
      for (var tr = 0; tr < 14; tr++) { var tq = P(5.8 + tr * 1.25, 13.8 - (tr % 2) * 0.3, 0); g.fillStyle = '#2e7d32'; g.beginPath(); g.arc(tq.x, tq.y - tq.s * 0.35, tq.s * 0.22, 0, Math.PI * 2); g.fill(); g.fillStyle = '#6b4a2a'; g.fillRect(tq.x - 1, tq.y - tq.s * 0.18, 2, tq.s * 0.18); }
      // Air traffic: one plane lands (left to right, slowing), another takes off (right to left, climbing).
      if (!reduce) {
        var cyc = (t / 1000) % 26;
        if (cyc < 12) { var lu = cyc / 12, ease = 1 - Math.pow(1 - lu, 2), lx = -2 + ease * 18, lz = Math.max(0, 1.6 * (1 - lu * 2.2)); plane(lx, 1.55, lz, 0, 2.1, '#f7f7f5', '#1d7a43'); }
        else if (cyc > 13) { var tu = (cyc - 13) / 13, tx = 22 - tu * tu * 26, tz = Math.max(0, (tu - 0.45) * 3.2); plane(tx, 1.55, tz, Math.PI, 2.1, '#f7f7f5', '#c0392b'); }
      }
      if (el.isConnected) raf = root.requestAnimationFrame(frame); else raf = 0;
    }
    cv.addEventListener('click', function (e) {
      if (!opts.onTap) return;
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      // Back-project the tap onto the ground plane.
      var a = P(0, 0, 0), bx = P(1, 0, 0), by = P(0, 1, 0), ux = bx.x - a.x, uy = bx.y - a.y, vx = by.x - a.x, vy = by.y - a.y, det = ux * vy - uy * vx;
      var gx = ((x - a.x) * vy - (y - a.y) * vx) / det, gy = (ux * (y - a.y) - uy * (x - a.x)) / det;
      var hit = hits.filter(function (h) { return gx >= h.x0 && gx <= h.x1 && gy >= h.y0 && gy <= h.y1; })[0];
      if (hit) opts.onTap(hit.kind);
    });
    function update(s) { scene = s || scene; if (!raf && el.isConnected) raf = root.requestAnimationFrame(frame); }
    function start() { if (!raf) raf = root.requestAnimationFrame(frame); }
    return { el: el, update: update, start: start };
  }
  root.LasgidiAirport = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
