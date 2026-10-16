/* Lasgidi: Bole grill, a timing mini-game at the Old GRA bole spot in Port
 * Harcourt. Pick plantain, fish or yam and tap an empty slot on the grill;
 * each item turns golden, then burns. Tap a golden item to serve it to the
 * customer at the front of the queue who ordered it. 45 seconds.
 * Result ({ sales, served, burnt }) is paid by the engine, capped. */
(function (root) {
  'use strict';
  var FOODS = [{ id: 'bole', icon: '🍌', name: 'Bole', price: 400, cook: 4.5 }, { id: 'fish', icon: '🐟', name: 'Fish', price: 900, cook: 6.5 }, { id: 'yam', icon: '🍠', name: 'Yam', price: 300, cook: 3.5 }];
  var SLOTS = 6, RUN = 45, GOLD = 2.4; // seconds an item stays golden before it burns
  function create(opts) {
    var wrap = document.createElement('div'); wrap.className = 'bole-game';
    var canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', 'Bole grill');
    var pad = document.createElement('div'); pad.className = 'bl-pad';
    pad.innerHTML = FOODS.map(function (f, i) { return '<button type="button" class="hk-btn" data-bl="' + i + '" aria-label="' + f.name + '">' + f.icon + '<small>' + f.name + '</small></button>'; }).join('');
    wrap.appendChild(canvas); wrap.appendChild(pad);
    var ctx = canvas.getContext('2d'), W = 360, H = 440, dpr = 1, seed = (opts && opts.seed) || 11, view = opts && opts.view;
    if (view) view.mount(canvas, wrap); // a 3D grill under the HUD canvas
    function rnd() { seed = (seed + 0x6D2B79F5) | 0; var t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    var st, raf = 0, last = 0;
    function reset() {
      st = { t: 0, slots: [], queue: [], pick: 0, sales: 0, served: 0, burnt: 0, nextCust: 1, msg: 'Pick food, tap the grill. Serve it when golden!', msgT: 3, over: false, pops: [] };
      for (var i = 0; i < SLOTS; i++) st.slots.push(null);
    }
    function size() {
      var r = wrap.getBoundingClientRect(), w = Math.max(280, Math.min(420, r.width || 360)), h = Math.round(Math.min(480, Math.max(360, w * 1.15)));
      dpr = Math.min(2, root.devicePixelRatio || 1);
      if (w === W && h === H && canvas.width === Math.round(w * dpr)) return;
      W = w; H = h; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    }
    function slotXY(i) { var cols = 3, gw = W - 40, gx = 20 + (i % cols + 0.5) * gw / cols, gy = H * 0.45 + Math.floor(i / cols) * 90; return { x: gx, y: gy }; }
    function stage(s) { var f = FOODS[s.f], age = st.t - s.at; return age < f.cook ? 'raw' : age < f.cook + GOLD ? 'gold' : 'burnt'; }
    function say(m) { st.msg = m; st.msgT = 1.8; }
    function fx(n, a) { if (opts && opts.sfx) { try { opts.sfx(n, a); } catch (e) {} } } // sound only; never touches the game
    function step(dt) {
      if (st.over) return;
      st.t += dt;
      st.nextCust -= dt;
      if (st.nextCust <= 0 && st.queue.length < 4) { st.queue.push({ f: Math.floor(rnd() * FOODS.length), wait: 14 + rnd() * 6 }); st.nextCust = 2.5 + rnd() * 2.5; }
      st.queue.forEach(function (c) { c.wait -= dt; });
      if (st.queue.length && st.queue[0].wait <= 0) { st.queue.shift(); say('The customer got tired and left!'); }
      st.slots.forEach(function (s, i) { if (s && stage(s) === 'burnt' && !s.burnNoted) { s.burnNoted = true; st.burnt++; fx('burnt'); say('It burnt! Scrape it off.'); } });
      st.pops.forEach(function (p) { p.y -= 40 * dt; p.t -= dt; }); st.pops = st.pops.filter(function (p) { return p.t > 0; });
      if (st.msgT > 0) st.msgT -= dt;
      if (st.t >= RUN) { st.over = true; if (opts && opts.onDone) opts.onDone({ sales: st.sales, served: st.served, burnt: st.burnt }); }
    }
    function tapSlot(i) {
      if (!st || st.over) return;
      var s = st.slots[i];
      if (!s) { st.slots[i] = { f: st.pick, at: st.t }; fx('sizzle'); return; }
      var sg = stage(s);
      if (sg === 'burnt') { st.slots[i] = null; return; }
      if (sg === 'raw') { say('Not ready yet. Wait for golden.'); return; }
      var qi = st.queue.findIndex(function (c) { return c.f === s.f; });
      if (qi < 0) { say('Nobody ordered ' + FOODS[s.f].name.toLowerCase() + ' right now.'); return; }
      var f = FOODS[s.f]; st.queue.splice(qi, 1); st.slots[i] = null; st.sales += f.price; st.served++; fx('served');
      var p = slotXY(i); st.pops.push({ x: p.x, y: p.y - 30, t: 0.8, text: '+₦' + f.price });
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (view) { ctx.clearRect(0, 0, W, H); view.frame(st, { W: W, H: H, slotXY: slotXY, stage: stage, foods: FOODS, gold: GOLD, slots: SLOTS }); } else {
      ctx.fillStyle = '#3b2a1e'; ctx.fillRect(0, 0, W, H);
      // queue
      ctx.fillStyle = '#5a3f2b'; ctx.fillRect(0, 48, W, 92);
      st.queue.forEach(function (c, i) {
        var x = 40 + i * 80, f = FOODS[c.f];
        ctx.fillStyle = ['#c0392b', '#2f6fa0', '#2fa36b', '#6b3fa0'][i % 4]; ctx.beginPath(); ctx.arc(x, 110, 18, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 18, 110, 36, 22);
        ctx.fillStyle = '#d9a47a'; ctx.beginPath(); ctx.arc(x, 82, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + 22, 66, 14, 0, Math.PI * 2); ctx.fill();
        ctx.font = '14px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.icon, x + 22, 67);
        ctx.strokeStyle = c.wait < 4 ? '#ff3b30' : '#34c759'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + 22, 66, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, c.wait / 20)); ctx.stroke();
      });
      ctx.textBaseline = 'alphabetic';
      // grill
      ctx.fillStyle = '#17181a'; ctx.fillRect(12, H * 0.45 - 50, W - 24, 200);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 2; for (var gx = 20; gx < W - 20; gx += 14) { ctx.beginPath(); ctx.moveTo(gx, H * 0.45 - 46); ctx.lineTo(gx, H * 0.45 + 146); ctx.stroke(); }
      for (var e = 0; e < 12; e++) { ctx.fillStyle = 'rgba(255,' + (90 + (e * 37) % 80) + ',0,' + (0.25 + 0.2 * Math.sin(st.t * 4 + e)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(30 + (e * 61) % (W - 60), H * 0.45 + 140, 10, 0, Math.PI * 2); ctx.fill(); }
      for (var i = 0; i < SLOTS; i++) {
        var p = slotXY(i), s = st.slots[i];
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 32, 0, Math.PI * 2); ctx.stroke();
        if (!s) continue;
        var sg = stage(s), f = FOODS[s.f], age = st.t - s.at;
        ctx.fillStyle = sg === 'raw' ? 'rgba(242,182,0,' + (0.15 + 0.4 * age / f.cook).toFixed(2) + ')' : sg === 'gold' ? 'rgba(242,182,0,.9)' : 'rgba(40,20,10,.95)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, Math.PI * 2); ctx.fill();
        ctx.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = sg === 'burnt' ? 0.35 : 1; ctx.fillText(f.icon, p.x, p.y + 1); ctx.globalAlpha = 1;
        if (sg === 'gold') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - (age - f.cook) / GOLD)); ctx.stroke(); }
        if (sg === 'burnt') { ctx.fillStyle = '#ff9a8f'; ctx.font = '700 11px sans-serif'; ctx.fillText('BURNT', p.x, p.y + 22); }
        ctx.textBaseline = 'alphabetic';
      }
      }
      st.pops.forEach(function (p) { ctx.fillStyle = '#7fe08a'; ctx.font = '800 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y); });
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, 8, W - 16, 32);
      ctx.fillStyle = '#fff'; ctx.font = '700 13px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('⏱ ' + Math.max(0, Math.ceil(RUN - st.t)) + 's   ₦' + st.sales.toLocaleString('en') + '   🔥 ' + st.burnt + ' burnt   ' + FOODS[st.pick].icon, 16, 29);
      if (st.msgT > 0) { ctx.font = '700 13px sans-serif'; ctx.textAlign = 'center'; var mw = Math.min(W - 20, ctx.measureText(st.msg).width + 20); ctx.fillStyle = 'rgba(242,182,0,.95)'; ctx.fillRect((W - mw) / 2, H - 34, mw, 24); ctx.fillStyle = '#1a1500'; ctx.fillText(st.msg, W / 2, H - 17); }
      if (st.over) { ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '800 22px sans-serif'; ctx.fillText('Fire is out!', W / 2, H / 2 - 20); ctx.font = '600 15px sans-serif'; ctx.fillText('₦' + st.sales.toLocaleString('en') + ' from ' + st.served + ' plates · ' + st.burnt + ' burnt', W / 2, H / 2 + 10); }
    }
    function frame(ts) { raf = 0; if (!wrap.isConnected) return; var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts; size(); step(dt); draw(); if (!st.over) raf = root.requestAnimationFrame(frame); }
    pad.addEventListener('pointerdown', function (e) { var b = e.target.closest('[data-bl]'); if (!b || !st) return; e.preventDefault(); st.pick = +b.dataset.bl; pad.querySelectorAll('.hk-btn').forEach(function (x) { x.classList.toggle('sel', x === b); }); });
    canvas.addEventListener('pointerdown', function (e) {
      var r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height, p3 = view && view.pick(e.clientX, e.clientY);
      if (p3) { x = p3.x; y = p3.y; }
      for (var i = 0; i < SLOTS; i++) { var p = slotXY(i); if (Math.hypot(p.x - x, p.y - y) < 38) { tapSlot(i); return; } }
    });
    function onKey(e) { if (!wrap.isConnected || !st) return; var n = { 1: 0, 2: 1, 3: 2 }[e.key]; if (n != null) st.pick = n; var sl = { q: 0, w: 1, e: 2, a: 3, s: 4, d: 5 }[e.key]; if (sl != null) tapSlot(sl); }
    root.addEventListener('keydown', onKey);
    return {
      el: wrap,
      start: function () { reset(); last = 0; size(); if (!raf) raf = root.requestAnimationFrame(frame); },
      state: function () { return st; },
      stop: function () { if (raf) root.cancelAnimationFrame(raf); raf = 0; if (view) view.dispose(); root.removeEventListener('keydown', onKey); },
      // For tests: a bot that grills what is ordered and serves when golden.
      tick: function (sec, auto) {
        if (!st) reset(); var n = Math.round(sec / 0.05);
        for (var i = 0; i < n && !st.over; i++) {
          if (auto) {
            st.slots.forEach(function (s, j) { if (s && (stage(s) === 'gold' || stage(s) === 'burnt')) tapSlot(j); });
            var want = st.queue.map(function (c) { return c.f; }), cooking = st.slots.filter(Boolean).map(function (s) { return s.f; });
            want.forEach(function (f) { var k = cooking.indexOf(f); if (k >= 0) cooking.splice(k, 1); else { var e = st.slots.indexOf(null); if (e >= 0) { st.pick = f; tapSlot(e); } } });
          }
          step(0.05);
        }
        size(); draw(); return { sales: st.sales, served: st.served, burnt: st.burnt, over: st.over };
      }
    };
  }
  root.LasgidiBole = { create: create, FOODS: FOODS };
})(typeof window !== 'undefined' ? window : this);
