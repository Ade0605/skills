/* Lasgidi: Owambe dance-off, a rhythm mini-game. Notes fall in four lanes to
 * the beat; tap the lane (or press ←↓↑→ / D F J K) as each one reaches the line.
 * Streaks bring guests to spray you. 40 seconds a dance. The result
 * ({ hits, total, best }) goes to the engine, which pays a capped spray. */
(function (root) {
  'use strict';
  var LANES = 4, BPM = 112, RUN = 40, KEYS = { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, d: 0, f: 1, j: 2, k: 3 };
  var ICONS = ['◀', '▼', '▲', '▶'], COLORS = ['#c0392b', '#2f6fa0', '#2fa36b', '#f2b600'];
  var HYPE = ['E choke!', 'Gbese!', 'Shayo!', 'Odogwu!', 'Na you biko!', 'Spray am!', 'Omo!'];

  function create(opts) {
    var wrap = document.createElement('div'); wrap.className = 'dance-game';
    var canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', 'Owambe dance-off');
    var pad = document.createElement('div'); pad.className = 'df-pad';
    pad.innerHTML = ICONS.map(function (ic, i) { return '<button type="button" class="df-btn" data-df="' + i + '" style="--c:' + COLORS[i] + '" aria-label="Lane ' + (i + 1) + '">' + ic + '</button>'; }).join('');
    wrap.appendChild(canvas); wrap.appendChild(pad);
    var ctx = canvas.getContext('2d'), W = 360, H = 520, dpr = 1, seed = (opts && opts.seed) || 7;
    function rnd() { seed = (seed + 0x6D2B79F5) | 0; var t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    var st, raf = 0, last = 0, beat = 60 / BPM, fall = 1.6; // seconds a note takes to reach the line

    function reset() {
      st = { t: 0, notes: [], hits: 0, total: 0, combo: 0, best: 0, flash: [0, 0, 0, 0], msg: 'Tap as each note hits the line!', msgT: 2.5, cash: [], over: false };
      // A beat map: one or two notes on most beats, some off-beats once you warm up.
      for (var b = 4; b * beat < RUN - 1; b++) {
        var tt = b * beat;
        if (rnd() < 0.82) st.notes.push({ lane: Math.floor(rnd() * LANES), t: tt, hit: false, gone: false });
        if (tt > 12 && rnd() < 0.25) st.notes.push({ lane: Math.floor(rnd() * LANES), t: tt + beat / 2, hit: false, gone: false });
      }
      st.total = st.notes.length;
    }
    function size() {
      var r = wrap.getBoundingClientRect(), w = Math.max(280, Math.min(420, r.width || 360)), h = Math.round(Math.min(560, Math.max(400, w * 1.35)));
      dpr = Math.min(2, root.devicePixelRatio || 1);
      if (w === W && h === H && canvas.width === Math.round(w * dpr)) return;
      W = w; H = h; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    }
    var lineY = function () { return H - 70; }, laneX = function (l) { return W * (l + 0.5) / LANES; };
    function hit(lane) {
      if (!st || st.over) return;
      st.flash[lane] = 0.15;
      var best = null, bd = 0.2;
      st.notes.forEach(function (n) { if (n.lane === lane && !n.hit && !n.gone) { var d = Math.abs(n.t - st.t); if (d < bd) { bd = d; best = n; } } });
      if (!best) { st.combo = 0; return; }
      best.hit = true; st.hits++; st.combo++; if (st.combo > st.best) st.best = st.combo;
      if (st.combo % 10 === 0) { st.msg = HYPE[Math.floor(rnd() * HYPE.length)] + ' Guests are spraying!'; st.msgT = 1.6; for (var i = 0; i < 6; i++) st.cash.push({ x: rnd() * W, y: -20 - rnd() * 80, v: 120 + rnd() * 80, r: rnd() * 6 }); }
    }
    function step(dt) {
      if (st.over) return;
      st.t += dt;
      st.notes.forEach(function (n) { if (!n.hit && !n.gone && st.t - n.t > 0.2) { n.gone = true; st.combo = 0; } });
      st.cash.forEach(function (c) { c.y += c.v * dt; c.r += dt * 3; });
      st.cash = st.cash.filter(function (c) { return c.y < H + 30; });
      for (var i = 0; i < LANES; i++) if (st.flash[i] > 0) st.flash[i] -= dt;
      if (st.msgT > 0) st.msgT -= dt;
      if (st.t >= RUN) { st.over = true; if (opts && opts.onDone) opts.onDone({ hits: st.hits, total: st.total, best: st.best }); }
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var pulse = 0.5 + 0.5 * Math.cos((st.t / beat) * Math.PI * 2);
      var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2b0f3a'); bg.addColorStop(1, '#6b3fa0');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // party lights
      for (var i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(' + ['242,182,0', '208,69,58', '47,163,107'][i % 3] + ',' + (0.08 + 0.12 * pulse).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(W * (i + 0.5) / 6, 30, 60, 0, Math.PI * 2); ctx.fill(); }
      for (var l = 0; l < LANES; l++) {
        ctx.fillStyle = 'rgba(255,255,255,' + (st.flash[l] > 0 ? 0.22 : 0.06) + ')'; ctx.fillRect(W * l / LANES + 4, 0, W / LANES - 8, H);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, lineY()); ctx.lineTo(W, lineY()); ctx.stroke();
      for (var k = 0; k < LANES; k++) { ctx.strokeStyle = COLORS[k]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(laneX(k), lineY(), 20, 0, Math.PI * 2); ctx.stroke(); }
      st.notes.forEach(function (n) {
        if (n.hit || n.gone) return;
        var y = lineY() - (n.t - st.t) / fall * (lineY() - 40);
        if (y < -30 || y > H + 30) return;
        ctx.fillStyle = COLORS[n.lane]; ctx.beginPath(); ctx.arc(laneX(n.lane), y, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.font = '700 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ICONS[n.lane], laneX(n.lane), y + 1);
      });
      st.cash.forEach(function (c) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = '#7fbf6a'; ctx.fillRect(-14, -7, 28, 14); ctx.fillStyle = '#1b5e20'; ctx.font = '700 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('₦', 0, 0); ctx.restore(); });
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(8, 8, W - 16, 34);
      ctx.fillStyle = '#ffffff'; ctx.font = '700 13px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('⏱ ' + Math.max(0, Math.ceil(RUN - st.t)) + 's', 16, 30); ctx.fillText('🎯 ' + st.hits + '/' + st.total, 80, 30); ctx.fillText('🔥 ×' + st.combo, 170, 30);
      if (st.msgT > 0) { ctx.font = '700 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#f2b600'; ctx.fillText(st.msg, W / 2, 72); }
      if (st.over) {
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.font = '800 22px sans-serif'; ctx.fillText('The DJ cuts the music!', W / 2, H / 2 - 24);
        ctx.font = '600 15px sans-serif'; ctx.fillText(st.hits + ' of ' + st.total + ' beats · best streak ' + st.best, W / 2, H / 2 + 6);
      }
    }
    function frame(ts) { raf = 0; if (!wrap.isConnected) return; var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts; size(); step(dt); draw(); if (!st.over) raf = root.requestAnimationFrame(frame); }
    function onKey(e) { if (!wrap.isConnected || e.repeat) return; var l = KEYS[e.key]; if (l != null) { hit(l); e.preventDefault(); } }
    pad.addEventListener('pointerdown', function (e) { var b = e.target.closest('[data-df]'); if (b) { e.preventDefault(); hit(+b.dataset.df); } });
    canvas.addEventListener('pointerdown', function (e) { var r = canvas.getBoundingClientRect(); hit(Math.min(LANES - 1, Math.floor((e.clientX - r.left) / r.width * LANES))); });
    root.addEventListener('keydown', onKey);
    return {
      el: wrap,
      start: function () { reset(); last = 0; size(); if (!raf) raf = root.requestAnimationFrame(frame); },
      stop: function () { if (raf) root.cancelAnimationFrame(raf); raf = 0; root.removeEventListener('keydown', onKey); },
      // For tests: play perfectly (or not) without the frame clock.
      tick: function (sec, auto) { if (!st) reset(); var n = Math.round(sec / 0.02); for (var i = 0; i < n && !st.over; i++) { step(0.02); if (auto) st.notes.forEach(function (x) { if (!x.hit && !x.gone && Math.abs(x.t - st.t) < 0.02) hit(x.lane); }); } size(); draw(); return { hits: st.hits, total: st.total, best: st.best, over: st.over }; },
      state: function () { return st; }
    };
  }
  root.LasgidiDance = { create: create };
})(typeof window !== 'undefined' ? window : this);
