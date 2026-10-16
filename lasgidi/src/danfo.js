/* Lasgidi: Danfo Run, an arcade mini-game. Drive a danfo from Ojuelegba,
 * stop at bus stops to drop and load passengers, dodge potholes, okadas and
 * traffic, and never stop where LASTMA is watching. 90 seconds a run.
 * The result ({ fares, fines, served }) is handed to the engine, which pays it
 * as a shift (capped), so the game itself never touches money. */
(function (root) {
  'use strict';
  var STOPS = ['Ojuelegba', 'Tejuosho', 'Yaba', 'Jibowu', 'Fadeyi', 'Onipanu', 'Obalende', 'CMS', 'Ikeja Along', 'Oshodi'];
  var CRIES = ['{s}! {s}! Enter with your change!', 'Wole! {s}, straight!', '{s} o! One chance remain!', 'Owa o! {s}!', 'Shift, shift, shift! {s}!'];
  var SEATS = 14, RUN = 90, LANES = 3;

  function create(opts) {
    var wrap = document.createElement('div'); wrap.className = 'danfo-game';
    var canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', 'Danfo Run');
    var pad = document.createElement('div'); pad.className = 'dg-pad';
    pad.innerHTML = '<button type="button" class="dg-btn" data-dg="left" aria-label="Left lane">◀</button><button type="button" class="dg-btn brake" data-dg="brake" aria-label="Brake (hold)">BRAKE</button><button type="button" class="dg-btn" data-dg="right" aria-label="Right lane">▶</button>';
    wrap.appendChild(canvas); wrap.appendChild(pad);
    var ctx = canvas.getContext('2d'), W = 360, H = 560, dpr = 1, view = opts && opts.view;
    if (view) view.mount(canvas, wrap); // a 3D stage draws the road; this canvas keeps the HUD on top
    var reduce = !!(opts && opts.reduce) || !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var seed = (opts && opts.seed) || 1;
    function rnd() { seed = (seed + 0x6D2B79F5) | 0; var t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

    var st = null, raf = 0, last = 0, keys = { brake: false };
    function reset() {
      st = { t: 0, dist: 0, speed: 0, lane: 1, x: 1, fares: 0, fines: 0, served: 0, pax: [], stopIdx: 0, msg: 'Hold BRAKE at a bus stop in the left lane to load.', msgT: 3,
        things: [], nextStop: 260, nextThing: 140, stopped: 0, over: false, shake: 0, fined: {} };
    }
    function size() {
      var r = wrap.getBoundingClientRect(), w = Math.max(280, Math.min(440, r.width || 360));
      var h = Math.round(Math.min(620, Math.max(420, w * 1.45)));
      dpr = Math.min(2, root.devicePixelRatio || 1);
      if (w === W && h === H && canvas.width === Math.round(w * dpr)) return;
      W = w; H = h; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    }
    var roadL = function () { return W * 0.18; }, roadW = function () { return W * 0.64; };
    var laneX = function (l) { return roadL() + roadW() * (l + 0.5) / LANES; };

    function spawn() {
      // Bus stops on the left kerb, LASTMA zones, potholes, okadas, cars.
      if (st.dist >= st.nextStop) {
        var name = STOPS[(st.stopIdx + 1) % STOPS.length];
        st.things.push({ k: 'stop', y: -60, name: name, idx: st.stopIdx + 1, wait: 2 + Math.floor(rnd() * 5), done: false });
        st.stopIdx++; st.nextStop = st.dist + 330 + rnd() * 160;
        if (rnd() < 0.55) st.things.push({ k: 'lastma', y: -60 - 150 - rnd() * 60, len: 90 });
      }
      if (st.dist >= st.nextThing) {
        var r = rnd(), lane = Math.floor(rnd() * LANES);
        if (r < 0.35) st.things.push({ k: 'hole', y: -30, lane: lane });
        else if (r < 0.65) st.things.push({ k: 'okada', y: -40, lane: lane, fx: laneX(lane), dir: rnd() < 0.5 ? -1 : 1 });
        else st.things.push({ k: 'car', y: -70, lane: lane, v: 0.45 + rnd() * 0.3, col: ['#c9ccd2', '#2f6fa0', '#7b2d26', '#1c1d20', '#f4f3ec'][Math.floor(rnd() * 5)] });
        st.nextThing = st.dist + 70 + rnd() * 90;
      }
    }
    function say(m) { st.msg = m; st.msgT = 2.4; }
    function cry(name) { return CRIES[Math.floor(rnd() * CRIES.length)].replace(/\{s\}/g, name); }

    function step(dt) {
      if (st.over) return;
      st.t += dt;
      var max = 260, brake = keys.brake;
      st.speed += (brake ? -520 : 120) * dt; st.speed = Math.max(0, Math.min(max, st.speed));
      var dy = st.speed * dt; st.dist += dy;
      st.x += (st.lane - st.x) * Math.min(1, dt * 12);
      spawn();
      var busY = H - 110, busX = laneX(st.x), slow = st.speed < max * 0.25;
      st.things.forEach(function (o) {
        o.y += dy;
        if (o.k === 'car') o.y -= 160 * o.v * dt; // cars drive too, a little slower than you
        if (o.k === 'okada') { o.fx += o.dir * 60 * dt; if (o.fx < roadL() + 14 || o.fx > roadL() + roadW() - 14) o.dir *= -1; }
      });
      st.things.forEach(function (o) {
        if (o.hit) return;
        if (o.k === 'stop' && !o.done && Math.abs(o.y - busY) < 50 && st.lane === 0 && slow) {
          st.stopped += dt;
          if (st.stopped > 0.6) {
            o.done = true; st.stopped = 0;
            var drop = st.pax.filter(function (p) { return p.to === o.idx; });
            st.pax = st.pax.filter(function (p) { return p.to !== o.idx; });
            var paid = drop.reduce(function (a, p) { return a + p.fare; }, 0);
            st.fares += paid; st.served += drop.length;
            var room = SEATS - st.pax.length, load = Math.min(room, o.wait);
            for (var i = 0; i < load; i++) st.pax.push({ to: o.idx + 1 + Math.floor(rnd() * 3), fare: 200 + Math.floor(rnd() * 4) * 100 });
            say((drop.length ? drop.length + ' down, ₦' + paid.toLocaleString('en') + '. ' : '') + (load ? load + ' in. ' : 'Bus full! ') + cry(STOPS[(o.idx + 1) % STOPS.length]));
          }
        }
        if (o.k === 'lastma' && slow && st.speed < 30 && o.y > busY - o.len && o.y < busY + 30 && !st.fined[o.y | 0]) {
          st.fined[o.y | 0] = 1; o.hit = true; st.fines += 2000; st.shake = 0.4; say('LASTMA! "Park well! No stopping here!" ₦2,000 fine.');
        }
        if ((o.k === 'hole' || o.k === 'car' || o.k === 'okada') && Math.abs(o.y - busY) < (o.k === 'car' ? 52 : 26)) {
          var ox = o.k === 'okada' ? o.fx : laneX(o.lane);
          if (Math.abs(ox - busX) < roadW() / LANES * 0.55) {
            o.hit = true; st.shake = 0.5;
            if (o.k === 'hole') { st.speed *= 0.4; st.fines += 300; say('Pothole! Shock absorber: ₦300.'); }
            else { st.speed *= 0.2; st.fines += 1500; if (st.pax.length) st.pax.pop(); say(o.k === 'okada' ? 'Okada scraped you! ₦1,500 and a passenger came down to argue.' : 'You jammed a car! ₦1,500 to settle.'); }
          }
        }
      });
      st.things = st.things.filter(function (o) { return o.y < H + 120; });
      if (st.msgT > 0) st.msgT -= dt;
      if (st.shake > 0) st.shake -= dt;
      if (st.t >= RUN) {
        st.over = true;
        // Anyone still on board pays on the way out.
        var rest = st.pax.reduce(function (a, p) { return a + p.fare; }, 0);
        st.fares += rest; st.served += st.pax.length; st.pax = [];
        if (opts && opts.onDone) opts.onDone({ fares: st.fares, fines: st.fines, served: st.served });
      }
    }

    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var sx = st.shake > 0 && !reduce ? (Math.random() - 0.5) * 6 : 0;
      ctx.save(); ctx.translate(sx, 0);
      if (view) { ctx.clearRect(-10, 0, W + 20, H); view.frame(st, { W: W, H: H, laneX: laneX, roadL: roadL(), roadW: roadW(), busY: H - 110, brake: keys.brake, lanes: LANES, reduce: reduce }); } else {
      ctx.fillStyle = '#3f6b3a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#9a9384'; ctx.fillRect(roadL() - 16, 0, 16, H); ctx.fillRect(roadL() + roadW(), 0, 16, H);
      ctx.fillStyle = '#3a3b3f'; ctx.fillRect(roadL(), 0, roadW(), H);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.setLineDash([22, 22]); ctx.lineDashOffset = -(st.dist % 44);
      for (var l = 1; l < LANES; l++) { var lx = roadL() + roadW() * l / LANES; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke(); }
      ctx.setLineDash([]);
      // roadside buildings
      for (var b = 0; b < 8; b++) {
        var by = ((b * 120 + st.dist * 0.9) % (H + 120)) - 120;
        ctx.fillStyle = ['#d9822b', '#c9ccd2', '#f2e6c9', '#6b3fa0'][b % 4]; ctx.fillRect(4, by, roadL() - 26, 80);
        ctx.fillStyle = ['#2f6fa0', '#c0392b', '#2fa36b', '#f2b600'][b % 4]; ctx.fillRect(roadL() + roadW() + 22, by + 40, W - roadL() - roadW() - 26, 70);
      }
      st.things.forEach(function (o) {
        if (o.k === 'lastma') {
          ctx.fillStyle = 'rgba(242,182,0,.5)'; ctx.fillRect(roadL(), o.y - o.len, roadW() / LANES, o.len);
          ctx.fillStyle = '#17181a'; ctx.font = '700 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('LASTMA · NO STOPPING', roadL() + roadW() / LANES / 2, o.y - o.len / 2);
        }
      });
      st.things.forEach(function (o) {
        if (o.k === 'stop') {
          ctx.fillStyle = o.done ? '#7a7a7a' : '#2fa36b'; rr(roadL() - 16, o.y - 30, 16, 60, 3); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.font = '700 11px sans-serif'; ctx.textAlign = 'left';
          ctx.save(); ctx.translate(roadL() - 4, o.y + 28); ctx.rotate(-Math.PI / 2); ctx.fillText('🚏 ' + o.name, 0, 0); ctx.restore();
          if (!o.done) for (var i = 0; i < o.wait; i++) { ctx.fillStyle = ['#c0392b', '#2f6fa0', '#f2b600', '#6b3fa0'][i % 4]; ctx.beginPath(); ctx.arc(roadL() - 26, o.y - 22 + i * 10, 4, 0, Math.PI * 2); ctx.fill(); }
        } else if (o.k === 'hole') {
          ctx.fillStyle = '#1d1e20'; ctx.beginPath(); ctx.ellipse(laneX(o.lane), o.y, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
        } else if (o.k === 'okada') {
          ctx.fillStyle = '#c0392b'; rr(o.fx - 6, o.y - 16, 12, 32, 5); ctx.fill(); ctx.fillStyle = '#f2b600'; ctx.beginPath(); ctx.arc(o.fx, o.y - 4, 6, 0, Math.PI * 2); ctx.fill();
        } else if (o.k === 'car') {
          var cx = laneX(o.lane); ctx.fillStyle = o.col; rr(cx - 17, o.y - 30, 34, 60, 7); ctx.fill(); ctx.fillStyle = 'rgba(20,30,40,.7)'; ctx.fillRect(cx - 12, o.y - 18, 24, 12);
        }
      });
      // the danfo: yellow with black stripes
      var bx = laneX(st.x), by2 = H - 110;
      ctx.fillStyle = '#f2b600'; rr(bx - 22, by2 - 44, 44, 88, 8); ctx.fill();
      ctx.fillStyle = '#17181a'; ctx.fillRect(bx - 22, by2 - 6, 44, 5); ctx.fillRect(bx - 22, by2 + 10, 44, 5);
      ctx.fillStyle = 'rgba(20,30,40,.8)'; ctx.fillRect(bx - 16, by2 - 38, 32, 14);
      if (keys.brake) { ctx.fillStyle = '#ff3b30'; ctx.fillRect(bx - 20, by2 + 40, 9, 4); ctx.fillRect(bx + 11, by2 + 40, 9, 4); }
      }
      ctx.restore();
      // HUD
      ctx.fillStyle = 'rgba(23,24,26,.82)'; rr(8, 8, W - 16, 44, 10); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = '700 13px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('⏱ ' + Math.max(0, Math.ceil(RUN - st.t)) + 's', 18, 35);
      ctx.fillText('🧍 ' + st.pax.length + '/' + SEATS, 80, 35);
      ctx.fillText('₦' + st.fares.toLocaleString('en'), 150, 35);
      ctx.fillStyle = '#ff9a8f'; ctx.fillText(st.fines ? '−₦' + st.fines.toLocaleString('en') : '', 230, 35);
      if (st.msgT > 0) {
        // Wrap the conductor's line onto up to two rows that fit the road.
        ctx.font = '600 13px sans-serif';
        var words = st.msg.split(' '), rows = [''], maxW = W - 44;
        words.forEach(function (w) { var tr = rows[rows.length - 1] ? rows[rows.length - 1] + ' ' + w : w; if (ctx.measureText(tr).width > maxW && rows[rows.length - 1]) rows.push(w); else rows[rows.length - 1] = tr; });
        if (rows.length > 2) { rows = rows.slice(0, 2); rows[1] += '…'; }
        var mw = Math.min(W - 24, Math.max.apply(null, rows.map(function (r) { return ctx.measureText(r).width; })) + 24), mh = 12 + rows.length * 17;
        ctx.fillStyle = 'rgba(242,182,0,.95)'; rr((W - mw) / 2, 60, mw, mh, 10); ctx.fill();
        ctx.fillStyle = '#1a1500'; ctx.textAlign = 'center';
        rows.forEach(function (r, i) { ctx.fillText(r, W / 2, 78 + i * 17); });
      }
      if (st.over) {
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
        ctx.font = '800 22px sans-serif'; ctx.fillText('Last stop!', W / 2, H / 2 - 30);
        ctx.font = '600 15px sans-serif'; ctx.fillText('Fares ₦' + st.fares.toLocaleString('en') + ' · fines ₦' + st.fines.toLocaleString('en'), W / 2, H / 2);
        ctx.fillText(st.served + ' passengers served', W / 2, H / 2 + 24);
        ctx.font = '500 12px sans-serif'; ctx.fillText('Your pay is capped at a fair day\'s takings.', W / 2, H / 2 + 48);
      }
    }
    function frame(ts) {
      raf = 0;
      if (!wrap.isConnected) return;
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      size(); step(dt); draw();
      if (!st.over) raf = root.requestAnimationFrame(frame);
    }
    function lane(d) { if (st && !st.over) st.lane = Math.max(0, Math.min(LANES - 1, st.lane + d)); }
    function onKey(e) {
      if (!wrap.isConnected) return;
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'a') { lane(-1); e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'd') { lane(1); e.preventDefault(); }
      else if (k === 'ArrowDown' || k === ' ' || k === 's') { keys.brake = e.type === 'keydown'; e.preventDefault(); }
    }
    function onUp(e) { if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 's') keys.brake = false; }
    pad.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('[data-dg]'); if (!b) return; e.preventDefault();
      if (b.dataset.dg === 'left') lane(-1); else if (b.dataset.dg === 'right') lane(1); else keys.brake = true;
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { pad.addEventListener(ev, function (e) { var b = e.target.closest && e.target.closest('[data-dg="brake"]'); if (b || ev !== 'pointerleave') keys.brake = false; }); });
    var sx0 = null;
    canvas.addEventListener('pointerdown', function (e) { sx0 = e.clientX; });
    canvas.addEventListener('pointerup', function (e) { if (sx0 == null) return; var d = e.clientX - sx0; if (Math.abs(d) > 24) lane(d > 0 ? 1 : -1); else lane(e.offsetX < W / 2 ? -1 : 1); sx0 = null; });
    root.addEventListener('keydown', onKey); root.addEventListener('keyup', onUp);

    function start() { reset(); last = 0; size(); if (!raf) raf = root.requestAnimationFrame(frame); }
    function stop() { if (raf) root.cancelAnimationFrame(raf); raf = 0; if (view) view.dispose(); root.removeEventListener('keydown', onKey); root.removeEventListener('keyup', onUp); }
    // For tests: advance the game without a browser frame clock.
    function tick(sec, input) { if (!st) reset(); if (input) { if (input.lane != null) st.lane = input.lane; keys.brake = !!input.brake; } var n = Math.round(sec / 0.05); for (var i = 0; i < n && !st.over; i++) step(0.05); size(); draw(); return { t: st.t, fares: st.fares, fines: st.fines, served: st.served, pax: st.pax.length, over: st.over }; }
    return { el: wrap, start: start, stop: stop, tick: tick, state: function () { return st; } };
  }
  root.LasgidiDanfo = { create: create, STOPS: STOPS };
})(typeof window !== 'undefined' ? window : this);
