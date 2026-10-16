/* Lasgidi: Go-slow hawker, a quick-fire mini-game. Cars crawl through the
 * Oshodi go-slow; a driver's hand goes up for water, gala, airtime or chips.
 * Pick the right item from your tray, tap the car, and get paid before the
 * light changes. When the task force van comes, hold HIDE or lose your goods.
 * 45 seconds. Result ({ sales, served, wrong, seized }) is paid by the engine. */
(function (root) {
  'use strict';
  var GOODS = [{ id: 'water', icon: '💧', name: 'Pure water', price: 100 }, { id: 'gala', icon: '🌭', name: 'Gala', price: 300 },
    { id: 'credit', icon: '📱', name: 'Airtime', price: 500 }, { id: 'chips', icon: '🍌', name: 'Plantain chips', price: 200 }];
  var RUN = 45, ROWS = 3;
  function create(opts) {
    var wrap = document.createElement('div'); wrap.className = 'hawk-game';
    var canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', 'Go-slow hawker');
    var pad = document.createElement('div'); pad.className = 'hk-pad';
    pad.innerHTML = GOODS.map(function (g, i) { return '<button type="button" class="hk-btn" data-hk="' + i + '" aria-label="' + g.name + '">' + g.icon + '<small>₦' + g.price + '</small></button>'; }).join('') + '<button type="button" class="hk-btn hide" data-hk="hide" aria-label="Hide (hold)">🙈<small>HIDE</small></button>';
    wrap.appendChild(canvas); wrap.appendChild(pad);
    var ctx = canvas.getContext('2d'), W = 360, H = 480, dpr = 1, seed = (opts && opts.seed) || 9, view = opts && opts.view;
    if (view) view.mount(canvas, wrap); // a 3D go-slow under the HUD canvas
    function rnd() { seed = (seed + 0x6D2B79F5) | 0; var t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    var st, raf = 0, last = 0;
    function reset() {
      st = { t: 0, cars: [], pick: null, hiding: false, sales: 0, served: 0, wrong: 0, seized: 0, goods: 30, light: 'red', lightT: 6, van: null, vanNext: 12 + rnd() * 8, msg: 'Pick an item, then tap the car that wants it!', msgT: 3, over: false, pops: [] };
      for (var r = 0; r < ROWS; r++) for (var i = 0; i < 4; i++) st.cars.push(car(r, i * 110 + rnd() * 30));
    }
    function car(row, x) { return { row: row, x: x, want: null, wantT: 0, patience: 0, col: ['#c9ccd2', '#2f6fa0', '#7b2d26', '#1c1d20', '#f4f3ec', '#f2b600'][Math.floor(rnd() * 6)], danfo: rnd() < 0.25 }; }
    function size() {
      var r = wrap.getBoundingClientRect(), w = Math.max(280, Math.min(440, r.width || 360)), h = Math.round(Math.min(520, Math.max(380, w * 1.2)));
      dpr = Math.min(2, root.devicePixelRatio || 1);
      if (w === W && h === H && canvas.width === Math.round(w * dpr)) return;
      W = w; H = h; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    }
    var rowY = function (r) { return 90 + r * ((H - 150) / ROWS) + 30; };
    function say(m) { st.msg = m; st.msgT = 1.8; }
    function fx(n, a) { if (opts && opts.sfx) { try { opts.sfx(n, a); } catch (e) {} } } // sound only; never touches the game
    function step(dt) {
      if (st.over) return;
      st.t += dt; st.lightT -= dt;
      if (st.lightT <= 0) { st.light = st.light === 'red' ? 'green' : 'red'; st.lightT = st.light === 'red' ? 5 + rnd() * 4 : 2 + rnd() * 1.5; if (st.light === 'green') say('Light don change! Traffic is moving.'); }
      var v = st.light === 'green' ? 140 : 12;
      st.cars.forEach(function (c) {
        c.x += v * dt * (1 + c.row * 0.15);
        if (c.x > W + 60) { c.x = -80 - rnd() * 40; c.want = null; }
        if (!c.want && st.light === 'red' && rnd() < dt * 0.35 && c.x > 20 && c.x < W - 40) { c.want = GOODS[Math.floor(rnd() * GOODS.length)]; c.patience = 4 + rnd() * 2; }
        if (c.want) { c.patience -= dt; if (c.patience <= 0 || st.light === 'green' && rnd() < dt * 2) c.want = null; }
      });
      // The task force van: hide (hold) or lose part of your goods.
      st.vanNext -= dt;
      if (!st.van && st.vanNext <= 0) { st.van = { x: -120, warned: false }; say('🚨 Task force is coming! Hold HIDE!'); fx('siren'); }
      if (st.van) {
        st.van.x += 150 * dt;
        if (st.van.x > W / 2 - 40 && st.van.x < W / 2 + 40 && !st.van.done) { st.van.done = true; if (!st.hiding) { var lose = Math.min(st.goods, 8); st.goods -= lose; st.seized += lose; fx('seized'); say('They seized ' + lose + ' of your goods!'); } else say('You hid. They passed.'); }
        if (st.van.x > W + 140) { st.van = null; st.vanNext = 10 + rnd() * 10; }
      }
      st.pops.forEach(function (p) { p.y -= 40 * dt; p.t -= dt; }); st.pops = st.pops.filter(function (p) { return p.t > 0; });
      if (st.msgT > 0) st.msgT -= dt;
      if (st.t >= RUN || st.goods <= 0) { st.over = true; if (opts && opts.onDone) opts.onDone({ sales: st.sales, served: st.served, wrong: st.wrong, seized: st.seized }); }
    }
    function tapAt(x, y) {
      if (!st || st.over || st.hiding) return;
      var best = null, bd = 50;
      st.cars.forEach(function (c) { var d = Math.hypot(c.x + 30 - x, rowY(c.row) - y); if (d < bd) { bd = d; best = c; } });
      if (!best) return;
      if (!best.want) { say('That driver no want anything.'); return; }
      if (st.pick == null) { say('Pick an item from your tray first.'); return; }
      var g = GOODS[st.pick];
      if (g.id === best.want.id) { fx('sale'); st.sales += g.price; st.served++; st.goods--; st.pops.push({ x: best.x + 30, y: rowY(best.row) - 30, t: 0.8, text: '+₦' + g.price }); best.want = null; }
      else { st.wrong++; fx('wrong'); say('"I said ' + best.want.name + '!"'); best.patience -= 1.5; }
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (view) { ctx.clearRect(0, 0, W, H); view.frame(st, { W: W, H: H, rowY: rowY, rows: ROWS, goods: GOODS }); } else {
      ctx.fillStyle = '#3a3b3f'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#9a9384'; ctx.fillRect(0, 0, W, 60); ctx.fillRect(0, H - 40, W, 40);
      ctx.fillStyle = '#c9ccd2'; ctx.font = '700 11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('OSHODI · UNDER BRIDGE', 10, 54);
      // traffic light
      ctx.fillStyle = '#17181a'; ctx.fillRect(W - 40, 8, 26, 46); ctx.fillStyle = st.light === 'red' ? '#ff3b30' : '#4a1512'; ctx.beginPath(); ctx.arc(W - 27, 21, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = st.light === 'green' ? '#34c759' : '#123a1d'; ctx.beginPath(); ctx.arc(W - 27, 41, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.setLineDash([16, 14]); ctx.lineWidth = 2;
      for (var r = 1; r < ROWS; r++) { var ly = (rowY(r - 1) + rowY(r)) / 2; ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke(); }
      ctx.setLineDash([]);
      st.cars.forEach(function (c) {
        var y = rowY(c.row);
        ctx.fillStyle = c.danfo ? '#f2b600' : c.col; ctx.fillRect(c.x, y - 16, 62, 32);
        if (c.danfo) { ctx.fillStyle = '#17181a'; ctx.fillRect(c.x, y - 2, 62, 4); }
        ctx.fillStyle = 'rgba(20,30,40,.75)'; ctx.fillRect(c.x + 40, y - 12, 14, 24);
        if (c.want) {
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(c.x + 30, y - 32, 15, 0, Math.PI * 2); ctx.fill();
          ctx.font = '16px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.want.icon, c.x + 30, y - 31);
          ctx.strokeStyle = c.patience < 1.5 ? '#ff3b30' : '#34c759'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x + 30, y - 32, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, c.patience / 6)); ctx.stroke();
          ctx.textBaseline = 'alphabetic';
        }
      });
      if (st.van) { var vy = H - 30; ctx.fillStyle = '#ffffff'; ctx.fillRect(st.van.x, vy - 22, 100, 28); ctx.fillStyle = '#c0392b'; ctx.fillRect(st.van.x, vy - 10, 100, 6); ctx.fillStyle = '#17181a'; ctx.font = '700 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TASK FORCE', st.van.x + 50, vy + 0); }
      }
      st.pops.forEach(function (p) { ctx.fillStyle = '#7fe08a'; ctx.font = '800 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y); });
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, 8, W - 60, 32);
      ctx.fillStyle = '#fff'; ctx.font = '700 13px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('⏱ ' + Math.max(0, Math.ceil(RUN - st.t)) + 's  ₦' + st.sales.toLocaleString('en') + '  📦 ' + st.goods + (st.pick != null ? '  ' + GOODS[st.pick].icon : ''), 16, 29);
      if (st.hiding) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '800 18px sans-serif'; ctx.fillText('🙈 Hiding behind the bus stop…', W / 2, H / 2); }
      if (st.msgT > 0) { ctx.font = '700 13px sans-serif'; ctx.textAlign = 'center'; var mw = Math.min(W - 20, ctx.measureText(st.msg).width + 20); ctx.fillStyle = 'rgba(242,182,0,.95)'; ctx.fillRect((W - mw) / 2, 64, mw, 24); ctx.fillStyle = '#1a1500'; ctx.fillText(st.msg, W / 2, 81); }
      if (st.over) { ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '800 22px sans-serif'; ctx.fillText(st.goods <= 0 ? 'Tray empty!' : 'Time to go home!', W / 2, H / 2 - 20); ctx.font = '600 15px sans-serif'; ctx.fillText('₦' + st.sales.toLocaleString('en') + ' from ' + st.served + ' sales' + (st.seized ? ' · ' + st.seized + ' seized' : ''), W / 2, H / 2 + 10); }
    }
    function frame(ts) { raf = 0; if (!wrap.isConnected) return; var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts; size(); step(dt); draw(); if (!st.over) raf = root.requestAnimationFrame(frame); }
    pad.addEventListener('pointerdown', function (e) { var b = e.target.closest('[data-hk]'); if (!b || !st) return; e.preventDefault(); if (b.dataset.hk === 'hide') st.hiding = true; else { st.pick = +b.dataset.hk; pad.querySelectorAll('.hk-btn').forEach(function (x) { x.classList.toggle('sel', x === b); }); } });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { pad.addEventListener(ev, function () { if (st) st.hiding = false; }); });
    canvas.addEventListener('pointerdown', function (e) { var p = view && view.pick(e.clientX, e.clientY); if (p) { tapAt(p.x, p.y); return; } var r = canvas.getBoundingClientRect(); tapAt((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height); });
    function onKey(e) { if (!wrap.isConnected || !st) return; var n = { 1: 0, 2: 1, 3: 2, 4: 3 }[e.key]; if (n != null && e.type === 'keydown') { st.pick = n; } if (e.key === ' ' || e.key === 'h') { st.hiding = e.type === 'keydown'; e.preventDefault(); } }
    root.addEventListener('keydown', onKey); root.addEventListener('keyup', onKey);
    return {
      el: wrap,
      start: function () { reset(); last = 0; size(); if (!raf) raf = root.requestAnimationFrame(frame); },
      stop: function () { if (raf) root.cancelAnimationFrame(raf); raf = 0; if (view) view.dispose(); root.removeEventListener('keydown', onKey); root.removeEventListener('keyup', onKey); },
      // For tests: a bot that serves whoever is asking and hides from the van.
      tick: function (sec, auto) {
        if (!st) reset(); var n = Math.round(sec / 0.05);
        for (var i = 0; i < n && !st.over; i++) {
          if (auto) { st.hiding = !!(st.van && st.van.x > W / 2 - 160 && st.van.x < W / 2 + 60); var c = st.cars.filter(function (x) { return x.want; })[0]; if (c && !st.hiding) { st.pick = GOODS.indexOf(c.want); tapAt(c.x + 30, rowY(c.row)); } }
          step(0.05);
        }
        size(); draw(); return { sales: st.sales, served: st.served, wrong: st.wrong, seized: st.seized, over: st.over };
      },
      state: function () { return st; }
    };
  }
  root.LasgidiHawker = { create: create, GOODS: GOODS };
})(typeof window !== 'undefined' ? window : this);
