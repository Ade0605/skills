/* Lasgidi: walk-in venues. Every place on the map opens as a small isometric yard drawn on a canvas:
   a set that fits the kind of place (a refinery, an airport, a buka, a club, a gallery, a park, a school,
   an office or a motor park), a sign for each thing you can do there, the people about, and vehicles on
   the road out front dropping workers and visitors at the gate. When you arrive, your ride pulls up and
   you walk in. Drawing only: tapping a sign hands its index back to the page, which runs the real action. */
(function (root) {
  'use strict';
  var PAD = { w: 10, d: 6 }, ROAD = 6.75, GATE = 5.0;
  // Where the action signs stand on the pad, in order.
  var SLOTS = [[1.5, 2.0], [4.1, 1.9], [6.7, 2.0], [9.0, 2.6], [1.3, 4.4], [3.7, 4.5], [6.2, 4.5], [8.6, 4.8]];
  var RIDES = {
    danfo: { len: 1.5, col: '#f2c200', stripe: '#17181a', h: 0.55 }, brt: { len: 2.2, col: '#2f6fa0', stripe: '#ffffff', h: 0.62 },
    cab: { len: 1.05, col: '#f2c200', stripe: '#17181a', h: 0.42 }, car: { len: 1.05, col: '#3d4a5c', stripe: '#c7ccd1', h: 0.42 },
    keke: { len: 0.7, col: '#2fa36b', stripe: '#17181a', h: 0.5 }, okada: { len: 0.45, col: '#c0392b', stripe: '#17181a', h: 0.3 },
    staff: { len: 1.9, col: '#ffffff', stripe: '#1f8a4c', h: 0.6 }
  };

  function create(opts) {
    opts = opts || {};
    var el = document.createElement('div'); el.className = 'cruise-stage venue-stage';
    var cv = document.createElement('canvas'); cv.className = 'cruise-canvas';
    cv.setAttribute('role', 'img'); el.appendChild(cv);
    var bar = document.createElement('div'); bar.className = 'iv-spin';
    bar.innerHTML = '<button type="button" class="pg-zbtn" data-vspin="-1" aria-label="Turn the view left">⟲</button><button type="button" class="pg-zbtn" data-vspin="1" aria-label="Turn the view right">⟳</button>';
    el.appendChild(bar);
    var g = cv.getContext('2d'), scene = { people: [], acts: [] }, figs = {}, hits = [], raf = 0, W = 0, H = 0, dpr = 1, t0 = 0;
    var turn = 0, spin = null, fit = null, deferQ = null, CX = 5, CY = 3.7;
    var bubble = null, arriveKey = '', arriveAt = -1, reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function size() {
      var w = el.clientWidth || 360, h = el.clientHeight || Math.round(w * 0.62);
      dpr = Math.min(2, root.devicePixelRatio || 1);
      if (w === W && h === H) return; W = w; H = h;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    // The view turns about the middle of the yard: ang is 0, π/2, π or 3π/2 at rest, and in between while spinning.
    function ang() { if (!spin) return turn * Math.PI / 2; var u = Math.min(1, (performance.now() - spin.at) / 380), e = 1 - Math.pow(1 - u, 3); if (u >= 1) { spin = null; return turn * Math.PI / 2; } return (spin.from + (spin.to - spin.from) * e) * Math.PI / 2; }
    var A = 0;
    function Rt(x, y) { var c = Math.cos(A), s = Math.sin(A), dx = x - CX, dy = y - CY; return { x: CX + dx * c - dy * s, y: CY + dx * s + dy * c }; }
    function depth(x, y) { var q = Rt(x, y); return q.x + q.y; }
    // Whether a face with world normal (nx, ny) looks toward the camera at this angle.
    function faces(nx, ny) { var c = Math.cos(A), s = Math.sin(A); return (nx * c - ny * s) + (nx * s + ny * c) > 0.01; }
    function fitView() {
      // Fit the yard and the road at this angle, with room above for tall props.
      var mD = 1e9, xD = -1e9, mS = 1e9, xS = -1e9;
      [[-0.6, 0], [PAD.w + 0.6, 0], [PAD.w + 0.6, PAD.d + 1.4], [-0.6, PAD.d + 1.4]].forEach(function (c) { var q = Rt(c[0], c[1]); mD = Math.min(mD, q.x - q.y); xD = Math.max(xD, q.x - q.y); mS = Math.min(mS, q.x + q.y); xS = Math.max(xS, q.x + q.y); });
      var tw = Math.min(W / ((xD - mD) / 2 + 0.6), H / ((xS - mS) / 4 + 2.3));
      fit = { tw: tw, ox: W / 2 - (xD + mD) / 2 * tw / 2, oy: (H - ((xS - mS) / 4 + 2.3) * tw) / 2 + 2.0 * tw - mS * tw / 4 };
    }
    function P(x, y, z) {
      var q = Rt(x, y), tw = fit.tw;
      return { x: fit.ox + (q.x - q.y) * tw / 2, y: fit.oy + (q.x + q.y) * tw / 4 - (z || 0) * tw, s: tw };
    }
    // Props are queued with their depth and drawn back to front once the set is laid out, so a turned view still overlaps right.
    function later(d, f) { if (deferQ) { deferQ.push({ d: d, f: f }); return true; } return false; }
    function at(x, y, f) { if (!later(depth(x, y), f)) f(); }
    function poly(pts, fill, stroke) {
      if (deferQ && pts.some(function (p) { return (p[2] || 0) > 0.05; })) { var mx = 0, my = 0; pts.forEach(function (p) { mx += p[0]; my += p[1]; }); later(depth(mx / pts.length, my / pts.length) + 0.3, function () { poly(pts, fill, stroke); }); return; }
      g.beginPath(); pts.forEach(function (p, i) { var q = P(p[0], p[1], p[2]); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); }
    }
    function shade(hex, f) {
      var n = parseInt(hex.slice(1), 16), r = n >> 16, gg = n >> 8 & 255, b = n & 255;
      function c(v) { return Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); }
      return '#' + ((1 << 24) + (c(r) << 16) + (c(gg) << 8) + c(b)).toString(16).slice(1);
    }
    // A box from (x,y) with footprint w×d and height h; side and front shades come from the top colour.
    function box(x, y, w, d, h, col) {
      if (later(depth(x + w / 2, y + d / 2), function () { box(x, y, w, d, h, col); })) return;
      slab(x, y, w, d, 0, h, col, col);
    }
    // A block from z0 to z1: the two side faces that look at the camera, then the top.
    function slab(x, y, w, d, z0, z1, top, side) {
      var c = Math.cos(A), sn = Math.sin(A);
      [[0, 1, [[x, y + d], [x + w, y + d]]], [1, 0, [[x + w, y], [x + w, y + d]]], [0, -1, [[x, y], [x + w, y]]], [-1, 0, [[x, y], [x, y + d]]]].forEach(function (f) {
        if (!faces(f[0], f[1])) return;
        var vx = f[0] * c - f[1] * sn; // more of the face toward screen-left gets the lighter shade
        var e = f[2]; poly([[e[0][0], e[0][1], z0], [e[1][0], e[1][1], z0], [e[1][0], e[1][1], z1], [e[0][0], e[0][1], z1]], shade(side, vx > 0.5 ? -0.28 : -0.12));
      });
      poly([[x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1]], top);
    }
    function cyl(x, y, r, h, col, band) {
      if (later(depth(x, y), function () { cyl(x, y, r, h, col, band); })) return;
      var b = P(x, y, 0), tp = P(x, y, h), rx = r * b.s * 0.7, ry = rx * 0.5;
      g.fillStyle = shade(col, -0.2); g.fillRect(b.x - rx, tp.y, rx * 2, b.y - tp.y);
      g.beginPath(); g.ellipse(b.x, b.y, rx, ry, 0, 0, Math.PI); g.fill();
      if (band) { g.fillStyle = band; var by = tp.y + (b.y - tp.y) * 0.62; g.fillRect(b.x - rx, by, rx * 2, Math.max(2, b.s * 0.06)); }
      g.beginPath(); g.ellipse(b.x, tp.y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = col; g.fill();
    }
    function tree(x, y, k) { if (later(depth(x, y), function () { tree(x, y, k); })) return; var p = P(x, y, 0), s = p.s * (k || 1); g.fillStyle = '#5a3a22'; g.fillRect(p.x - 2, p.y - s * 0.55, 4, s * 0.55); g.fillStyle = '#2e7d32'; g.beginPath(); g.arc(p.x, p.y - s * 0.75, s * 0.34, 0, Math.PI * 2); g.fill(); g.fillStyle = '#43a047'; g.beginPath(); g.arc(p.x - s * 0.1, p.y - s * 0.85, s * 0.2, 0, Math.PI * 2); g.fill(); }
    function label(x, y, z, text, bg) {
      if (later(depth(x, y) + 0.5, function () { label(x, y, z, text, bg); })) return;
      var p = P(x, y, z); g.font = '800 ' + Math.min(13, Math.max(9, p.s * 0.2)) + 'px system-ui, sans-serif';
      var tw = g.measureText(text).width + 14, th = Math.min(22, Math.max(15, p.s * 0.34));
      g.fillStyle = '#3a3d42'; g.fillRect(p.x - tw / 2 + 3, p.y, 2, p.s * 0.5); g.fillRect(p.x + tw / 2 - 5, p.y, 2, p.s * 0.5);
      g.fillStyle = bg; g.fillRect(p.x - tw / 2, p.y - th, tw, th);
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, p.x, p.y - th / 2);
    }

    /* ---------- sets: the ground and the props for each kind of place ---------- */
    function ground(top, edge) { slab(0, 0, PAD.w, PAD.d, -0.25, 0, top, edge); }
    function fence(col) { poly([[0.05, 0.05, 0.01], [PAD.w - 0.05, 0.05, 0.01], [PAD.w - 0.05, PAD.d - 0.05, 0.01], [GATE + 0.7, PAD.d - 0.05, 0.01], [GATE + 0.7, PAD.d - 0.12, 0.01], [PAD.w - 0.12, PAD.d - 0.12, 0.01], [PAD.w - 0.12, 0.12, 0.01], [0.12, 0.12, 0.01], [0.12, PAD.d - 0.12, 0.01], [GATE - 0.7, PAD.d - 0.12, 0.01], [GATE - 0.7, PAD.d - 0.05, 0.01], [0.05, PAD.d - 0.05, 0.01]], col); }
    var SETS = {
      refinery: function (t) {
        ground('#9aa0a6', '#6b7280'); fence('#f2a900');
        [[7.4, 0.6], [8.7, 0.6], [7.4, 1.9]].forEach(function (q) { cyl(q[0], q[1], 0.55, 0.9, '#e8eaec', '#1f8a4c'); });
        [[2.4, 0.5, 2.6], [3.1, 0.7, 2.1], [3.7, 0.5, 1.7]].forEach(function (q) { cyl(q[0], q[1], 0.22, q[2], '#b9c0c7', '#e8b416'); });
        box(0.4, 0.4, 1.3, 0.8, 0.55, '#f4f1ea'); box(0.4, 0.4, 1.3, 0.12, 0.6, '#1f3b63');
        at(5.4, 2.2, function () { for (var i = 0; i < 5; i++) { var a = P(4.4 + i * 0.5, 2.2, 0), b = P(4.4 + i * 0.5, 2.2, 0.45); g.strokeStyle = '#7c8794'; g.lineWidth = 2; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
        var r0 = P(4.3, 2.2, 0.45), r1 = P(6.5, 2.2, 0.45); g.strokeStyle = '#e8b416'; g.lineWidth = 5; g.beginPath(); g.moveTo(r0.x, r0.y); g.lineTo(r1.x, r1.y); g.stroke(); });
        at(9.4, 4.8, function () {
        var fs = P(9.4, 4.8, 0), ft = P(9.4, 4.8, 2.6); g.lineWidth = 4; for (var j = 0; j < 6; j++) { g.strokeStyle = j % 2 ? '#ffffff' : '#c0392b'; g.beginPath(); g.moveTo(fs.x, fs.y + (ft.y - fs.y) * j / 6); g.lineTo(fs.x, fs.y + (ft.y - fs.y) * (j + 1) / 6); g.stroke(); }
        var fl = reduce ? 0 : Math.sin(t / 110) * 0.15; g.fillStyle = '#f39c12'; g.beginPath(); g.moveTo(ft.x - 6, ft.y); g.quadraticCurveTo(ft.x - 4, ft.y - 14, ft.x, ft.y - 24 - fl * 20); g.quadraticCurveTo(ft.x + 4, ft.y - 14, ft.x + 6, ft.y); g.fill();
        g.fillStyle = '#ffe08a'; g.beginPath(); g.ellipse(ft.x, ft.y - 6, 2.5, 6, 0, 0, Math.PI * 2); g.fill(); });
        box(6.6, 4.6, 1.8, 0.7, 0.35, '#7c8794'); poly([[6.5, 4.5, 0.75], [8.5, 4.5, 0.75], [8.5, 5.4, 0.75], [6.5, 5.4, 0.75]], '#e8b416');
      },
      airport: function () {
        ground('#b7bcc2', '#7a8088');
        box(0.4, 0.3, 5.4, 1.1, 0.75, '#4f82b0'); poly([[0.3, 0.2, 0.78], [5.9, 0.2, 0.78], [5.9, 1.5, 0.78], [0.3, 1.5, 0.78]], '#e3e6e9');
        if (faces(0, 1)) later(depth(3.1, 0.85) + 0.01, function () { for (var i = 0; i < 9; i++) poly([[0.6 + i * 0.58, 1.41, 0.15], [0.95 + i * 0.58, 1.41, 0.15], [0.95 + i * 0.58, 1.41, 0.62], [0.6 + i * 0.58, 1.41, 0.62]], 'rgba(200,230,250,.55)'); });
        cyl(8.6, 0.8, 0.18, 2.2, '#c3c8cd'); box(8.25, 0.45, 0.7, 0.7, 0.0, '#2b4f72'); at(8.7, 0.9, function () { var tc = P(8.6, 0.8, 2.2); g.fillStyle = '#2b4f72'; g.fillRect(tc.x - tc.s * 0.3, tc.y - tc.s * 0.3, tc.s * 0.6, tc.s * 0.3); });
        var c = [7.4, 3.6]; poly([[c[0] - 1.4, c[1] - 0.12, 0.25], [c[0] + 1.4, c[1] - 0.12, 0.25], [c[0] + 1.4, c[1] + 0.12, 0.25], [c[0] - 1.4, c[1] + 0.12, 0.25]], '#f4f5f6');
        poly([[c[0] + 0.1, c[1] - 1.4, 0.24], [c[0] + 0.5, c[1] - 1.4, 0.24], [c[0] + 0.2, c[1] + 1.4, 0.24], [c[0] - 0.2, c[1] + 1.4, 0.24]], '#d9dde1');
        poly([[c[0] - 1.35, c[1] - 0.5, 0.26], [c[0] - 1.1, c[1] - 0.5, 0.26], [c[0] - 1.1, c[1] + 0.5, 0.26], [c[0] - 1.35, c[1] + 0.5, 0.26]], '#c0392b');
      },
      transport: function () {
        ground('#a7a29a', '#6f6a62');
        box(0.5, 0.5, 2.6, 0.7, 0.7, '#f4f1ea'); poly([[0.4, 0.4, 0.74], [3.2, 0.4, 0.74], [3.2, 1.35, 0.74], [0.4, 1.35, 0.74]], '#2f6fa0');
        [[4.2, 0.6], [6.0, 0.6], [7.8, 0.6]].forEach(function (q) { vehicle(q[0], q[1] + 0.3, 'danfo', 0); });
        box(1.0, 3.8, 1.6, 0.5, 0.35, '#c0392b'); poly([[0.9, 3.7, 0.9], [2.7, 3.7, 0.9], [2.7, 4.4, 0.8], [0.9, 4.4, 0.8]], '#f2c200');
      },
      food: function (t) {
        ground('#d8c7a6', '#a08a63'); fence('#8a5a2b');
        box(0.5, 0.4, 3.0, 0.8, 0.45, '#8a5a2b'); poly([[0.4, 0.3, 1.0], [3.6, 0.3, 1.0], [3.6, 1.3, 0.85], [0.4, 1.3, 0.85]], '#c0392b');
        ['#e67e22', '#2fa36b', '#f2c200', '#8e44ad'].forEach(function (col, i) { cyl(0.9 + i * 0.7, 0.75, 0.16, 0.52, col); });
        [[3.6, 3.0], [5.4, 3.0], [3.6, 4.3], [5.4, 4.3]].forEach(function (q) { box(q[0], q[1], 1.2, 0.55, 0.35, '#a0703f'); box(q[0], q[1] - 0.35, 1.2, 0.18, 0.18, '#7a4a26'); box(q[0], q[1] + 0.72, 1.2, 0.18, 0.18, '#7a4a26'); });
        box(7.6, 0.6, 1.2, 0.6, 0.4, '#3a3d42'); if (!reduce) at(8.4, 1.4, function () { for (var k = 0; k < 4; k++) { var u = (t / 1800 + k / 4) % 1, sp = P(8.2, 0.9, 0.5 + u * 1.4); g.fillStyle = 'rgba(220,220,220,' + (0.6 - u * 0.6) + ')'; g.beginPath(); g.arc(sp.x + Math.sin(u * 6 + k) * 6, sp.y, 4 + u * 8, 0, Math.PI * 2); g.fill(); } });
        tree(9.3, 3.6); tree(0.6, 5.2, 0.8);
      },
      nightlife: function (t) {
        ground('#1b1e2c', '#0b0d14');
        var lc = ['#ff2d95', '#20c6ff', '#7cff6b', '#b45cff', '#ffcc00'];
        for (var r = 0; r < 3; r++) for (var c = 0; c < 5; c++) { var ci = (r + c + Math.floor((reduce ? 0 : t) / 450)) % lc.length; poly([[3.2 + c * 0.72, 2.3 + r * 0.72, 0.01], [3.9 + c * 0.72, 2.3 + r * 0.72, 0.01], [3.9 + c * 0.72, 3.0 + r * 0.72, 0.01], [3.2 + c * 0.72, 3.0 + r * 0.72, 0.01]], lc[ci] + 'aa'); }
        box(3.8, 0.4, 2.4, 0.7, 0.5, '#2a2d3d'); box(0.4, 0.5, 2.4, 0.6, 0.42, '#3a2c4f'); box(7.4, 0.5, 2.2, 1.1, 0.25, '#4a0f2a');
        at(20, 20, function () { for (var b = 0; b < 4; b++) { var src = P(5.0, 0.7, 1.6), an = reduce ? b : t / 800 + b * 1.5, tx = P(5 + Math.cos(an) * 3, 3 + Math.sin(an) * 2, 0); g.strokeStyle = lc[b] + '55'; g.lineWidth = 6; g.beginPath(); g.moveTo(src.x, src.y); g.lineTo(tx.x, tx.y); g.stroke(); } });
      },
      culture: function () {
        ground('#e4ddcf', '#a89f8e'); fence('#8a7f6c');
        box(0.6, 0.4, 4.4, 1.2, 0.85, '#f4f1ea'); poly([[0.4, 0.25, 0.88], [5.2, 0.25, 0.88], [5.2, 1.8, 0.88], [0.4, 1.8, 0.88]], '#c8714e');
        for (var i = 0; i < 6; i++) cyl(0.85 + i * 0.8, 1.75, 0.09, 0.85, '#ffffff');
        box(7.4, 2.4, 0.8, 0.8, 0.3, '#9aa0a6'); at(7.85, 2.85, function () { var st = P(7.8, 2.8, 0.3); g.fillStyle = '#5d4a3a'; g.fillRect(st.x - st.s * 0.08, st.y - st.s * 0.9, st.s * 0.16, st.s * 0.9); g.beginPath(); g.arc(st.x, st.y - st.s * 0.98, st.s * 0.12, 0, Math.PI * 2); g.fill(); });
        ['#c0392b', '#2fa36b', '#f2c200'].forEach(function (col, i) { at(6.4 + i * 1.1, 0.6, function () { var a = P(6.4 + i * 1.1, 0.6, 0), b = P(6.4 + i * 1.1, 0.6, 1.6); g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.fillStyle = col; g.fillRect(b.x, b.y, b.s * 0.3, b.s * 0.6);  }); });
        tree(9.3, 5.0); tree(0.5, 4.9, 0.9);
      },
      outdoors: function (t) {
        ground('#7fb35f', '#3f6e34');
        poly([[4.4, 0, 0.005], [5.6, 0, 0.005], [5.6, PAD.d, 0.005], [4.4, PAD.d, 0.005]], '#d9cbb0');
        var fc = P(5.0, 3.0, 0); g.fillStyle = '#9aa0a6'; g.beginPath(); g.ellipse(fc.x, fc.y, fc.s * 0.9, fc.s * 0.45, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5fb3e0'; g.beginPath(); g.ellipse(fc.x, fc.y - 2, fc.s * 0.75, fc.s * 0.36, 0, 0, Math.PI * 2); g.fill();
        if (!reduce) for (var k = 0; k < 6; k++) { var u = (t / 900 + k / 6) % 1, an = k * 1.05; g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(fc.x + Math.cos(an) * u * fc.s * 0.5, fc.y - fc.s * (0.9 * Math.sin(u * Math.PI)) - 4, 2, 0, Math.PI * 2); g.fill(); }
        [[1.0, 1.0], [2.6, 0.6], [8.4, 0.8], [9.2, 2.2], [0.8, 3.0], [8.8, 5.0], [2.2, 5.2]].forEach(function (q) { tree(q[0], q[1]); });
        [[2.6, 3.4], [7.0, 3.4]].forEach(function (q) { box(q[0], q[1], 1.0, 0.3, 0.2, '#8a5a2b'); });
      },
      learn: function () {
        ground('#cfc6b0', '#968c73'); fence('#5d636b');
        box(0.5, 0.3, 5.2, 1.2, 0.8, '#e9dcc0'); poly([[0.4, 0.2, 0.84], [5.8, 0.2, 0.84], [5.8, 1.6, 0.84], [0.4, 1.6, 0.84]], '#a0522d');
        if (faces(0, 1)) later(depth(3.1, 0.9) + 0.01, function () { for (var i = 0; i < 7; i++) poly([[0.8 + i * 0.7, 1.51, 0.3], [1.2 + i * 0.7, 1.51, 0.3], [1.2 + i * 0.7, 1.51, 0.62], [0.8 + i * 0.7, 1.51, 0.62]], '#5d8fbb'); });
        at(7.6, 1.0, function () { var fp = P(7.6, 1.0, 0), ft = P(7.6, 1.0, 2.0); g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); g.moveTo(fp.x, fp.y); g.lineTo(ft.x, ft.y); g.stroke();
        g.fillStyle = '#1f8a4c'; g.fillRect(ft.x, ft.y, ft.s * 0.18, ft.s * 0.3); g.fillStyle = '#ffffff'; g.fillRect(ft.x + ft.s * 0.18, ft.y, ft.s * 0.18, ft.s * 0.3); g.fillStyle = '#1f8a4c'; g.fillRect(ft.x + ft.s * 0.36, ft.y, ft.s * 0.18, ft.s * 0.3); });
        for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) box(3.2 + c * 1.2, 2.8 + r * 1.0, 0.7, 0.4, 0.3, '#a0703f');
        tree(9.2, 4.8); tree(0.7, 5.0, 0.9);
      },
      services: function () {
        ground('#c9ced3', '#8a9097');
        box(0.5, 0.3, 4.6, 1.2, 1.1, '#5d8fbb'); poly([[0.4, 0.2, 1.14], [5.2, 0.2, 1.14], [5.2, 1.6, 1.14], [0.4, 1.6, 1.14]], '#e3e6e9');
        if (faces(0, 1)) later(depth(2.8, 0.9) + 0.01, function () { for (var i = 0; i < 6; i++) poly([[0.7 + i * 0.75, 1.51, 0.15], [1.2 + i * 0.75, 1.51, 0.15], [1.2 + i * 0.75, 1.51, 0.95], [0.7 + i * 0.75, 1.51, 0.95]], 'rgba(220,240,255,.6)'); });
        box(6.6, 0.6, 0.5, 0.4, 0.8, '#2f6fa0'); box(7.4, 0.6, 0.5, 0.4, 0.8, '#2f6fa0');
        at(4.2, 3.0, function () { for (var q = 0; q < 5; q++) { var a = P(3.0 + q * 0.6, 3.0, 0), b = P(3.0 + q * 0.6, 3.0, 0.4); g.strokeStyle = '#d4af37'; g.lineWidth = 2; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
        var r0 = P(3.0, 3.0, 0.36), r1 = P(5.4, 3.0, 0.36); g.strokeStyle = '#b8322b'; g.lineWidth = 3; g.beginPath(); g.moveTo(r0.x, r0.y); g.lineTo(r1.x, r1.y); g.stroke(); });
        tree(9.2, 4.6); tree(8.6, 2.2, 0.9);
      }
    };

    /* ---------- vehicles on the road out front ---------- */
    function vehicle(x, y, kind, z) {
      if (later(depth(x, y), function () { vehicle(x, y, kind, z); })) return;
      var R = RIDES[kind] || RIDES.danfo, w = 0.5, sy = faces(0, 1) ? w / 2 : -w / 2;
      if (kind === 'okada') { var p = P(x, y, 0); g.fillStyle = '#17181a'; g.beginPath(); g.arc(p.x - p.s * 0.18, p.y, p.s * 0.08, 0, Math.PI * 2); g.arc(p.x + p.s * 0.18, p.y - p.s * 0.04, p.s * 0.08, 0, Math.PI * 2); g.fill(); g.fillStyle = R.col; g.fillRect(p.x - p.s * 0.2, p.y - p.s * 0.22, p.s * 0.4, p.s * 0.12); return; }
      slab(x - R.len / 2, y - w / 2, R.len, w, 0, R.h, R.col, R.col);
      poly([[x - R.len / 2, y + sy, R.h * 0.55], [x + R.len / 2, y + sy, R.h * 0.55], [x + R.len / 2, y + sy, R.h * 0.62], [x - R.len / 2, y + sy, R.h * 0.62]], R.stripe);
      var nW = Math.max(2, Math.round(R.len / 0.32)); for (var i = 0; i < nW; i++) { var wx = x - R.len / 2 + 0.08 + i * (R.len - 0.16) / nW; poly([[wx, y + sy, R.h * 0.68], [wx + (R.len - 0.16) / nW - 0.05, y + sy, R.h * 0.68], [wx + (R.len - 0.16) / nW - 0.05, y + sy, R.h * 0.92], [wx, y + sy, R.h * 0.92]], 'rgba(40,60,80,.75)'); }
      [x - R.len / 2 + 0.22, x + R.len / 2 - 0.22].forEach(function (wx) { var p = P(wx, y + sy, 0.06); g.fillStyle = '#17181a'; g.beginPath(); g.ellipse(p.x, p.y, p.s * 0.09, p.s * 0.07, 0, 0, Math.PI * 2); g.fill(); });
    }
    function road() {
      poly([[-3, PAD.d + 0.3, -0.25], [PAD.w + 3, PAD.d + 0.3, -0.25], [PAD.w + 3, PAD.d + 1.3, -0.25], [-3, PAD.d + 1.3, -0.25]], '#4a4f56');
      g.setLineDash([8, 8]); var a = P(-3, ROAD, -0.25), b = P(PAD.w + 3, ROAD, -0.25); g.strokeStyle = '#f2c200'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]);
      poly([[GATE - 0.6, PAD.d, 0], [GATE + 0.6, PAD.d, 0], [GATE + 0.6, PAD.d + 0.3, -0.25], [GATE - 0.6, PAD.d + 0.3, -0.25]], '#8a9097');
    }
    // A drop-off: the ride comes in from the left, stops at the gate, then leaves to the right. u runs 0..1.
    function rideX(u) { return u < 0.35 ? -3 + (GATE + 3) * (1 - Math.pow(1 - u / 0.35, 2)) : u < 0.6 ? GATE : GATE + (PAD.w + 4 - GATE) * Math.pow((u - 0.6) / 0.4, 2); }

    function figure(pl) {
      var ex = pl.me && pl.extra && pl.extra.look ? pl.extra : null, key = JSON.stringify([pl.look, pl.outfit, ex]);
      if (figs[key]) return figs[key];
      if (!root.LasgidiAvatar) return null;
      try { var c = document.createElement('canvas'); root.LasgidiAvatar.draw(c, pl.look || { skin: 2, hair: 0, shape: 1 }, pl.outfit || {}, ex); figs[key] = c; } catch (e) { return null; }
      if (Object.keys(figs).length > 80) figs = {};
      return figs[key];
    }
    function person(pl, x, y, alpha, now) {
      var p = P(x, y, 0), fh = p.s * 1.35, fw = fh * 180 / 260, fig = figure(pl), bob = reduce ? 0 : Math.sin(now / 500 + x * 2 + y) * p.s * 0.015;
      g.globalAlpha = alpha;
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(p.x, p.y, fw * 0.28, fw * 0.1, 0, 0, Math.PI * 2); g.fill();
      if (fig) g.drawImage(fig, p.x - fw / 2, p.y - fh + bob, fw, fh);
      if (pl.hat) { var hy = p.y - fh + bob + fh * 0.085; g.fillStyle = pl.hat; g.beginPath(); g.ellipse(p.x, hy + fh * 0.03, fw * 0.17, fh * 0.05, 0, Math.PI, 0); g.fill(); g.fillRect(p.x - fw * 0.2, hy + fh * 0.025, fw * 0.4, fh * 0.012); }
      if (pl.vest) { g.fillStyle = pl.vest; g.globalAlpha = alpha * 0.85; g.fillRect(p.x - fw * 0.16, p.y - fh * 0.68 + bob, fw * 0.32, fh * 0.2); g.globalAlpha = alpha; }
      g.globalAlpha = 1;
      return { x: p.x, y: p.y - fh / 2, w: fw * 0.6, h: fh };
    }

    function personTag(pl, x, y) {
      var p = P(x, y, 0), fh = p.s * 1.35;
      if (pl.label) {
        g.font = '700 ' + Math.min(11, Math.max(8, p.s * 0.17)) + 'px system-ui, sans-serif';
        var tw = g.measureText(pl.label).width + 10, ty = p.y - fh - 6;
        g.fillStyle = pl.me ? '#2f6fd0' : 'rgba(20,24,30,.72)'; g.beginPath(); if (g.roundRect) g.roundRect(p.x - tw / 2, ty - 14, tw, 15, 7); else g.rect(p.x - tw / 2, ty - 14, tw, 15); g.fill();
        g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(pl.label, p.x, ty - 6.5);
      }
    }
    function frame(now) {
      size(); if (!t0) t0 = now;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      A = ang(); fitView(); deferQ = [];
      var sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, scene.night ? '#141c3a' : '#8fb4d9'); sky.addColorStop(0.55, scene.night ? '#3a2d4f' : '#d7c6c0'); sky.addColorStop(1, scene.night ? '#20242c' : '#e9e4dc');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = scene.night ? '#262a31' : '#b9b4aa'; g.beginPath(); g.ellipse(W / 2, H * 1.05, W * 0.85, H * 0.62, 0, Math.PI, 0); g.fill();
      road();
      (SETS[scene.set] || SETS.outdoors)(now);
      if (scene.sign) label(GATE + 1.2, PAD.d - 0.1, 1.15, scene.sign, scene.signBg || '#1f3b63');
      // People: those already here, then commuters dropped off by the shuttle, then you.
      var list = [];
      (scene.people || []).forEach(function (pl, i) {
        var q = SLOTS[pl.slot % SLOTS.length], an = i * 2.3, rad = 0.45 + (i % 3) * 0.22;
        list.push({ pl: pl, x: Math.max(0.3, Math.min(PAD.w - 0.3, q[0] + Math.cos(an) * rad)), y: Math.max(0.5, Math.min(PAD.d - 0.3, q[1] + 0.45 + Math.sin(an) * rad * 0.7)), a: 1, i: i });
      });
      var cyc = 15000, cu = reduce ? 0.6 : ((now - t0) % cyc) / cyc * 2.2, shuttle = scene.shuttle || 'danfo';
      var arriving = arriveAt >= 0 && now - arriveAt < 6500, au = arriving ? (now - arriveAt) / 6500 : 1;
      if (!arriving && !reduce && cu < 1) {
        vehicle(rideX(cu), ROAD, shuttle);
        if (cu > 0.42) (scene.commuters || []).forEach(function (pl, k) { var w = Math.min(1, (cu - 0.42) / 0.5), tq = SLOTS[(k * 3 + 1) % SLOTS.length]; list.push({ pl: pl, x: GATE + (k - 0.5) * 0.4 + (tq[0] - GATE) * w, y: PAD.d + 0.4 + (tq[1] + 0.6 - PAD.d - 0.4) * w, a: w > 0.85 ? (1 - w) / 0.15 : 1, i: -1 }); });
      }
      var me = scene.me, mePos = null;
      if (me) {
        var target = SLOTS[(scene.meSlot || 5) % SLOTS.length], tx = target[0] + 0.35, ty = target[1] + 0.85;
        if (arriving) {
          var ride = scene.arrive && RIDES[scene.arrive] ? scene.arrive : null;
          if (ride) vehicle(rideX(au), ROAD, ride);
          var w2 = ride ? Math.max(0, (au - 0.4) / 0.35) : au / 0.6, wk = Math.min(1, w2);
          if (!ride || au > 0.38) mePos = { x: (ride ? GATE : -1) + (tx - (ride ? GATE : -1)) * wk, y: PAD.d + 0.45 + (ty - PAD.d - 0.45) * wk };
        } else mePos = { x: tx, y: ty };
        if (mePos) list.push({ pl: me, x: mePos.x, y: mePos.y, a: 1, i: -2 });
      }
      var pHits = [];
      list.forEach(function (it) { later(depth(it.x, it.y), function () { var r = person(it.pl, it.x, it.y, it.a, now); if (it.i >= 0) pHits.push({ kind: 'person', i: it.i, x: r.x, y: r.y, w: r.w, h: r.h }); }); });
      // Draw everything queued, back to front, then the name tags and the action signs on top.
      var q = deferQ; deferQ = null; q.sort(function (a, b) { return a.d - b.d; }).forEach(function (it) { it.f(); });
      list.forEach(function (it) { if (it.a > 0.5 && (it.pl.me || it.pl.live)) personTag(it.pl, it.x, it.y); });
      // Action signs, one per slot.
      hits = pHits;
      (scene.acts || []).slice(0, SLOTS.length).forEach(function (a, i) {
        var q = SLOTS[i], p = P(q[0], q[1], 1.25 + (i % 2) * 0.25); g.font = '800 ' + Math.min(12, Math.max(9, p.s * 0.18)) + 'px system-ui, sans-serif';
        var txt = W < 560 ? a.icon : a.icon + ' ' + a.short, tw = g.measureText(txt).width + 14, th = 20, on = !a.off;
        g.fillStyle = on ? 'rgba(255,255,255,.95)' : 'rgba(235,235,235,.75)'; g.strokeStyle = on ? '#2f6fd0' : '#9aa0a6'; g.lineWidth = 1.5;
        g.beginPath(); if (g.roundRect) g.roundRect(p.x - tw / 2, p.y - th, tw, th, 10); else g.rect(p.x - tw / 2, p.y - th, tw, th); g.fill(); g.stroke();
        g.fillStyle = on ? '#17181a' : '#6b7280'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, p.x, p.y - th / 2);
        g.fillStyle = on ? '#2f6fd0' : '#9aa0a6'; g.beginPath(); g.moveTo(p.x - 5, p.y); g.lineTo(p.x + 5, p.y); g.lineTo(p.x, p.y + 6); g.fill();
        hits.push({ kind: 'act', i: i, x: p.x, y: p.y - th / 2, w: tw, h: th + 6 });
      });

      list.forEach(function (it) {
        if (!it.pl.say) return;
        var p = P(it.x, it.y, 0), fh = p.s * 1.35; g.font = '600 12px system-ui, sans-serif';
        var t = it.pl.say.length > 60 ? it.pl.say.slice(0, 58) + '…' : it.pl.say, bw = Math.min(W - 20, g.measureText(t).width + 18), bx = Math.max(10, Math.min(W - bw - 10, p.x - bw / 2)), by = Math.max(6, p.y - fh - 50);
        g.fillStyle = '#ffffff'; g.strokeStyle = it.pl.me ? '#2f6fd0' : '#17181a'; g.lineWidth = 1.2; g.beginPath(); if (g.roundRect) g.roundRect(bx, by, bw, 24, 12); else g.rect(bx, by, bw, 24); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(p.x - 5, by + 24); g.lineTo(p.x + 5, by + 24); g.lineTo(p.x, by + 31); g.fill();
        g.fillStyle = '#17181a'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t, bx + 9, by + 12);
      });
      if (bubble && now - bubble.at < 3500) {
        var bp = bubble.pos; g.font = '600 12px system-ui, sans-serif'; var bw = Math.min(W - 20, g.measureText(bubble.text).width + 18), bx = Math.max(10, Math.min(W - bw - 10, bp.x - bw / 2)), by = Math.max(8, bp.y - bp.h / 2 - 44);
        g.fillStyle = '#ffffff'; g.strokeStyle = '#17181a'; g.lineWidth = 1; g.beginPath(); if (g.roundRect) g.roundRect(bx, by, bw, 24, 12); else g.rect(bx, by, bw, 24); g.fill(); g.stroke();
        g.fillStyle = '#17181a'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(bubble.text, bx + 9, by + 12);
      }
      if (scene.night) { g.fillStyle = 'rgba(10,14,40,.22)'; g.fillRect(0, 0, W, H); }
      raf = reduce ? 0 : root.requestAnimationFrame(frame);
    }
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-vspin]'); if (!b) return;
      var d = +b.getAttribute('data-vspin') > 0 ? -1 : 1, from = spin ? spin.to : turn; // ⟳ turns the yard clockwise on screen
      spin = reduce ? null : { from: from, to: from + d, at: performance.now() }; turn = ((from + d) % 4 + 4) % 4;
      if (reduce) frame(performance.now());
    });
    cv.addEventListener('click', function (e) {
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      for (var i = hits.length - 1; i >= 0; i--) {
        var h = hits[i]; if (Math.abs(x - h.x) > h.w / 2 || Math.abs(y - h.y) > h.h / 2) continue;
        if (h.kind === 'act') { if (opts.onAct) opts.onAct(h.i); return; }
        var pl = scene.people[h.i]; if (pl && pl.line) { bubble = { text: (pl.live ? pl.label : pl.label + ': ') + (pl.live ? ' · ' : '') + pl.line, at: performance.now(), pos: h }; if (reduce) frame(performance.now()); }
        return;
      }
    });
    return {
      el: el,
      update: function (sc) {
        scene = sc || scene;
        cv.setAttribute('aria-label', (scene.name || 'A place') + '. ' + (scene.people || []).length + ' people here. Things to do are listed below.');
        if (scene.arriveKey && scene.arriveKey !== arriveKey) { arriveKey = scene.arriveKey; arriveAt = root.performance ? performance.now() : 0; }
        if (reduce) frame(root.performance ? performance.now() : 0);
      },
      start: function () { if (!raf && !reduce) raf = root.requestAnimationFrame(frame); },
      stop: function () { if (raf) root.cancelAnimationFrame(raf); raf = 0; }
    };
  }
  root.LasgidiVenue = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
