// Lasgidi Arcade: ten small offline games on the phone (Whot, Chess, Snake, Word Connect, Checkers, Four in a Row,
// Number Merge, Breaker, Star Defender, Math Rush). Just for fun: they never touch your life's money or replay,
// and best scores stay on this device.
(function (root) {
  'use strict';
  var BEST_KEY = 'lasgidi.arcade.v1';
  function bests() { try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveBest(k, v) { try { var b = bests(); if (!(b[k] >= v)) { b[k] = v; localStorage.setItem(BEST_KEY, JSON.stringify(b)); return true; } } catch (e) {} return false; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A crisp canvas of w x h CSS pixels that fits the body width.
  function canvas(body, w, h) {
    var c = el('canvas', 'arc-cv'), dpr = Math.min(2, root.devicePixelRatio || 1), fit = Math.min(1, (body.clientWidth - 8) / w || 1);
    c.width = w * dpr; c.height = h * dpr; c.style.width = (w * fit) + 'px'; c.style.height = (h * fit) + 'px';
    var g = c.getContext('2d'); g.scale(dpr, dpr); body.appendChild(c); return { c: c, g: g, k: fit };
  }
  // Swipe and arrow keys -> 'u' | 'd' | 'l' | 'r'.
  function swipes(target, fn) {
    var sx = 0, sy = 0;
    target.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    target.addEventListener('touchend', function (e) { var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); });
    var key = function (e) { var m = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r' }[e.key]; if (m) { e.preventDefault(); fn(m); } };
    document.addEventListener('keydown', key); return function () { document.removeEventListener('keydown', key); };
  }
  function pad(body, fn) {
    var p = el('div', 'arc-pad', '<button type="button" data-d="u" aria-label="Up">▲</button><button type="button" data-d="l" aria-label="Left">◀</button><button type="button" data-d="d" aria-label="Down">▼</button><button type="button" data-d="r" aria-label="Right">▶</button>');
    p.addEventListener('click', function (e) { var b = e.target.closest('[data-d]'); if (b) fn(b.getAttribute('data-d')); }); body.appendChild(p);
  }

  /* ---------------- Snake ---------------- */
  function snake(body, api) {
    var N = 18, S = 18, cv = canvas(body, N * S, N * S), g = cv.g, sn, dir, nd, food, timer, dead;
    function place() { do { food = [rnd(N), rnd(N)]; } while (sn.some(function (p) { return p[0] === food[0] && p[1] === food[1]; })); }
    function start() { sn = [[8, 9], [7, 9], [6, 9]]; dir = 'r'; nd = 'r'; dead = false; place(); api.score(0); clearInterval(timer); timer = setInterval(step, 120); draw(); }
    function step() {
      if ({ u: 'd', d: 'u', l: 'r', r: 'l' }[nd] !== dir) dir = nd;
      var h = sn[0], m = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[dir], n = [h[0] + m[0], h[1] + m[1]];
      if (n[0] < 0 || n[1] < 0 || n[0] >= N || n[1] >= N || sn.some(function (p) { return p[0] === n[0] && p[1] === n[1]; })) { dead = true; clearInterval(timer); draw(); api.over(sn.length - 3, start); return; }
      sn.unshift(n); if (n[0] === food[0] && n[1] === food[1]) { api.score(sn.length - 3); place(); } else sn.pop(); draw();
    }
    function draw() {
      g.fillStyle = '#12301f'; g.fillRect(0, 0, N * S, N * S);
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) if ((i + j) % 2) { g.fillStyle = '#163a26'; g.fillRect(i * S, j * S, S, S); }
      g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(food[0] * S + S / 2, food[1] * S + S / 2, S / 2.4, 0, 7); g.fill();
      sn.forEach(function (p, i) { g.fillStyle = dead ? '#888' : i ? '#4ade80' : '#bbf7d0'; g.fillRect(p[0] * S + 1, p[1] * S + 1, S - 2, S - 2); });
    }
    var off = swipes(cv.c, function (d) { nd = d; }); pad(body, function (d) { nd = d; }); start();
    return function () { clearInterval(timer); off(); };
  }

  /* ---------------- Number Merge (2048) ---------------- */
  function merge(body, api) {
    var b, score, grid = el('div', 'arc-2048'); body.appendChild(grid);
    function add() { var e = []; for (var i = 0; i < 16; i++) if (!b[i]) e.push(i); if (e.length) b[e[rnd(e.length)]] = Math.random() < 0.9 ? 2 : 4; }
    function start() { b = []; for (var i = 0; i < 16; i++) b[i] = 0; score = 0; add(); add(); api.score(0); draw(); }
    function line(a) { var v = a.filter(Boolean), out = []; for (var i = 0; i < v.length; i++) { if (v[i] === v[i + 1]) { out.push(v[i] * 2); score += v[i] * 2; i++; } else out.push(v[i]); } while (out.length < 4) out.push(0); return out; }
    function move(d) {
      var before = b.join(), idx = function (r, c) { return d === 'l' ? r * 4 + c : d === 'r' ? r * 4 + 3 - c : d === 'u' ? c * 4 + r : (3 - c) * 4 + r; };
      for (var r = 0; r < 4; r++) { var a = [], c; for (c = 0; c < 4; c++) a.push(b[idx(r, c)]); a = line(a); for (c = 0; c < 4; c++) b[idx(r, c)] = a[c]; }
      if (b.join() !== before) { add(); api.score(score); draw(); if (stuck()) api.over(score, start); }
    }
    function stuck() { for (var i = 0; i < 16; i++) { if (!b[i]) return false; if (i % 4 < 3 && b[i] === b[i + 1]) return false; if (i < 12 && b[i] === b[i + 4]) return false; } return true; }
    var COL = { 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#16a35a' };
    function draw() { grid.innerHTML = b.map(function (v) { return '<div class="t' + (v ? '' : ' e') + '" style="background:' + (COL[v] || (v ? '#3c3a32' : '')) + ';color:' + (v > 4 ? '#fff' : '#5a4f45') + '">' + (v || '') + '</div>'; }).join(''); }
    var off = swipes(grid, move); pad(body, move); start(); return off;
  }

  /* ---------------- Breaker ---------------- */
  function breaker(body, api) {
    var W = 340, H = 440, cv = canvas(body, W, H), g = cv.g, raf, st;
    var COLS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];
    function start() { st = { px: W / 2, bx: W / 2, by: H - 60, vx: 2.6, vy: -3.4, lives: 3, score: 0, held: true, bricks: [] }; for (var r = 0; r < 6; r++) for (var c = 0; c < 8; c++) st.bricks.push({ x: 6 + c * 41, y: 40 + r * 18, on: true, c: COLS[r] }); api.score(0); cancelAnimationFrame(raf); loop(); }
    function loop() {
      var s = st;
      if (s.held) { s.bx = s.px; s.by = H - 34; } else {
        s.bx += s.vx; s.by += s.vy;
        if (s.bx < 6 || s.bx > W - 6) s.vx = -s.vx; if (s.by < 6) s.vy = -s.vy;
        if (s.by > H - 30 && s.by < H - 18 && Math.abs(s.bx - s.px) < 36 && s.vy > 0) { s.vy = -Math.abs(s.vy); s.vx = (s.bx - s.px) / 9; }
        if (s.by > H) { s.lives--; s.held = true; if (s.lives <= 0) { draw(); api.over(s.score, start); return; } }
        s.bricks.forEach(function (b) { if (b.on && s.bx > b.x && s.bx < b.x + 38 && s.by > b.y && s.by < b.y + 15) { b.on = false; s.vy = -s.vy; s.score += 10; api.score(s.score); } });
        if (!s.bricks.some(function (b) { return b.on; })) { s.bricks.forEach(function (b) { b.on = true; }); s.held = true; s.vy *= 1.1; s.vx *= 1.1; }
      }
      draw(); raf = requestAnimationFrame(loop);
    }
    function draw() {
      var s = st; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
      s.bricks.forEach(function (b) { if (b.on) { g.fillStyle = b.c; g.fillRect(b.x, b.y, 38, 15); } });
      g.fillStyle = '#e2e8f0'; g.fillRect(s.px - 34, H - 26, 68, 8); g.beginPath(); g.arc(s.bx, s.by, 6, 0, 7); g.fillStyle = '#fde047'; g.fill();
      g.fillStyle = '#94a3b8'; g.font = '600 12px system-ui'; g.fillText('♥ ' + s.lives + (s.held ? '   tap to launch' : ''), 8, H - 6);
    }
    var mv = function (e) { var r = cv.c.getBoundingClientRect(), x = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / cv.k; st.px = Math.max(34, Math.min(W - 34, x)); };
    cv.c.addEventListener('pointermove', mv); cv.c.addEventListener('touchmove', function (e) { mv(e); e.preventDefault(); }, { passive: false });
    cv.c.addEventListener('click', function () { st.held = false; });
    var key = function (e) { if (e.key === 'ArrowLeft') st.px = Math.max(34, st.px - 24); else if (e.key === 'ArrowRight') st.px = Math.min(W - 34, st.px + 24); else if (e.key === ' ') st.held = false; };
    document.addEventListener('keydown', key); start();
    return function () { cancelAnimationFrame(raf); document.removeEventListener('keydown', key); };
  }

  /* ---------------- Star Defender ---------------- */
  function defender(body, api) {
    var W = 340, H = 460, cv = canvas(body, W, H), g = cv.g, raf, st, stars = [];
    for (var i = 0; i < 50; i++) stars.push([rnd(W), rnd(H), 0.5 + Math.random() * 1.5]);
    function start() { st = { x: W / 2, shots: [], foes: [], lives: 3, score: 0, t: 0, wave: 1 }; api.score(0); cancelAnimationFrame(raf); loop(); }
    function loop() {
      var s = st; s.t++;
      if (s.t % 12 === 0) s.shots.push([s.x, H - 50]);
      if (s.t % Math.max(18, 50 - s.wave * 4) === 0) s.foes.push({ x: 20 + rnd(W - 40), y: -20, v: 1 + Math.random() * (0.8 + s.wave * 0.25), w: Math.random() * 2 });
      if (s.t % 600 === 0) s.wave++;
      s.shots.forEach(function (p) { p[1] -= 7; }); s.shots = s.shots.filter(function (p) { return p[1] > -10; });
      s.foes.forEach(function (f) { f.y += f.v; f.x += Math.sin((s.t + f.w * 50) / 30) * 0.8; s.shots.forEach(function (p) { if (!f.dead && Math.abs(p[0] - f.x) < 14 && Math.abs(p[1] - f.y) < 14) { f.dead = true; p[1] = -99; s.score += 10; api.score(s.score); } }); if (!f.dead && f.y > H - 60 && Math.abs(f.x - s.x) < 20) { f.dead = true; s.lives--; } if (!f.dead && f.y > H) { f.dead = true; s.lives--; } });
      s.foes = s.foes.filter(function (f) { return !f.dead; });
      draw(); if (s.lives <= 0) { api.over(s.score, start); return; } raf = requestAnimationFrame(loop);
    }
    function draw() {
      var s = st; g.fillStyle = '#05061a'; g.fillRect(0, 0, W, H);
      stars.forEach(function (p) { p[1] = (p[1] + p[2]) % H; g.fillStyle = 'rgba(255,255,255,' + p[2] / 2 + ')'; g.fillRect(p[0], p[1], 2, 2); });
      g.fillStyle = '#fde047'; s.shots.forEach(function (p) { g.fillRect(p[0] - 1.5, p[1], 3, 10); });
      s.foes.forEach(function (f) { g.fillStyle = '#ef4444'; g.beginPath(); g.moveTo(f.x, f.y + 12); g.lineTo(f.x - 13, f.y - 10); g.lineTo(f.x + 13, f.y - 10); g.fill(); g.fillStyle = '#fca5a5'; g.fillRect(f.x - 3, f.y - 6, 6, 6); });
      g.fillStyle = '#60a5fa'; g.beginPath(); g.moveTo(s.x, H - 64); g.lineTo(s.x - 16, H - 36); g.lineTo(s.x + 16, H - 36); g.fill(); g.fillStyle = '#f97316'; g.fillRect(s.x - 4, H - 36, 8, 5 + (s.t % 4));
      g.fillStyle = '#94a3b8'; g.font = '600 12px system-ui'; g.fillText('♥ ' + s.lives + '   wave ' + s.wave, 8, H - 8);
    }
    var mv = function (e) { var r = cv.c.getBoundingClientRect(), x = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / cv.k; st.x = Math.max(16, Math.min(W - 16, x)); };
    cv.c.addEventListener('pointermove', mv); cv.c.addEventListener('touchmove', function (e) { mv(e); e.preventDefault(); }, { passive: false });
    var key = function (e) { if (e.key === 'ArrowLeft') st.x = Math.max(16, st.x - 20); else if (e.key === 'ArrowRight') st.x = Math.min(W - 16, st.x + 20); };
    document.addEventListener('keydown', key); start();
    return function () { cancelAnimationFrame(raf); document.removeEventListener('keydown', key); };
  }

  /* ---------------- Math Rush ---------------- */
  function mathrush(body, api) {
    var box = el('div', 'arc-math'), timer, st; body.appendChild(box);
    function q() {
      var lv = Math.min(4, Math.floor(st.score / 5)), op = '+-×÷'[rnd(Math.min(4, 2 + Math.floor(lv / 2)))], a, b, ans;
      if (op === '+') { a = rnd(10 + lv * 20) + 1; b = rnd(10 + lv * 20) + 1; ans = a + b; } else if (op === '-') { a = rnd(20 + lv * 20) + 5; b = rnd(a); ans = a - b; }
      else if (op === '×') { a = rnd(9 + lv) + 2; b = rnd(9) + 2; ans = a * b; } else { b = rnd(9) + 2; ans = rnd(10) + 1; a = b * ans; }
      var ch = [ans]; while (ch.length < 4) { var w = ans + (rnd(11) - 5) || ans + 7; if (w >= 0 && ch.indexOf(w) < 0) ch.push(w); }
      st.ans = ans; box.innerHTML = '<div class="mr-time"><i style="width:' + (st.left / 60 * 100) + '%"></i></div><div class="mr-q">' + a + ' ' + op + ' ' + b + ' = ?</div><div class="mr-ch">' + shuffle(ch).map(function (c) { return '<button type="button" data-v="' + c + '">' + c + '</button>'; }).join('') + '</div>';
    }
    function start() { st = { score: 0, left: 60 }; api.score(0); q(); clearInterval(timer); timer = setInterval(function () { st.left--; var bar = box.querySelector('.mr-time i'); if (bar) bar.style.width = (Math.max(0, st.left) / 60 * 100) + '%'; if (st.left <= 0) { clearInterval(timer); api.over(st.score, start); } }, 1000); }
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (!b || st.left <= 0) return; if (+b.getAttribute('data-v') === st.ans) { st.score++; api.score(st.score); } else { st.left = Math.max(0, st.left - 3); b.classList.add('bad'); } q(); });
    start(); return function () { clearInterval(timer); };
  }

  /* ---------------- Four in a Row ---------------- */
  function four(body, api) {
    var R = 6, C = 7, b, over, box = el('div', 'arc-c4'), msg = el('p', 'arc-msg'); body.appendChild(msg); body.appendChild(box);
    function start() { b = []; for (var i = 0; i < R * C; i++) b[i] = 0; over = false; msg.textContent = 'You are red. Drop a disc in a column.'; draw(); }
    function drop(bd, c, p) { for (var r = R - 1; r >= 0; r--) if (!bd[r * C + c]) { bd[r * C + c] = p; return r; } return -1; }
    function win(bd, p) { var d = [[0, 1], [1, 0], [1, 1], [1, -1]]; for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) for (var k = 0; k < 4; k++) { var n = 0; for (var s = 0; s < 4; s++) { var rr = r + d[k][0] * s, cc = c + d[k][1] * s; if (rr < 0 || rr >= R || cc < 0 || cc >= C || bd[rr * C + cc] !== p) break; n++; } if (n === 4) return true; } return false; }
    function cpu() {
      var cols = [3, 2, 4, 1, 5, 0, 6].filter(function (c) { return !b[c]; }), pick = null;
      [2, 1].forEach(function (p) { if (pick != null) return; cols.forEach(function (c) { if (pick != null) return; var t = b.slice(); drop(t, c, p); if (win(t, p)) pick = c; }); });
      if (pick == null) { var safe = cols.filter(function (c) { var t = b.slice(); drop(t, c, 2); return !cols.some(function (c2) { var t2 = t.slice(); return drop(t2, c2, 1) >= 0 && win(t2, 1); }); }); var pool = safe.length ? safe : cols; pick = Math.random() < 0.6 ? pool[0] : pool[rnd(pool.length)]; }
      return pick;
    }
    function play(c) {
      if (over || drop(b, c, 1) < 0) return;
      if (win(b, 1)) { over = true; draw(); msg.textContent = '🎉 You win!'; api.win(); return; }
      if (b.every(Boolean)) { over = true; draw(); msg.textContent = 'Draw.'; api.over(null, start); return; }
      drop(b, cpu(), 2); draw();
      if (win(b, 2)) { over = true; msg.textContent = 'Phone wins this one.'; api.over(null, start); }
      else if (b.every(Boolean)) { over = true; msg.textContent = 'Draw.'; api.over(null, start); }
    }
    function draw() { var h = ''; for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) h += '<button type="button" data-c="' + c + '" class="h' + b[r * C + c] + '" aria-label="Column ' + (c + 1) + '"></button>'; box.innerHTML = h; }
    box.addEventListener('click', function (e) { var t = e.target.closest('[data-c]'); if (t) play(+t.getAttribute('data-c')); });
    api.onAgain(start); start();
  }

  /* ---------------- Checkers ---------------- */
  function checkers(body, api) {
    var b, sel, chain, over, box = el('div', 'arc-board ck'), msg = el('p', 'arc-msg'); body.appendChild(msg); body.appendChild(box);
    // b[i]: 0 empty, 1 you, 2 you king, -1 phone, -2 phone king
    function start() { b = []; for (var i = 0; i < 64; i++) { var r = i >> 3, c = i & 7; b[i] = (r + c) % 2 ? (r < 3 ? -1 : r > 4 ? 1 : 0) : 0; } sel = null; chain = null; over = false; msg.textContent = 'Your move. Captures are compulsory.'; draw(); }
    function side(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
    function moves(bd, i, capOnly) {
      var v = bd[i], s = side(v), out = [], r = i >> 3, c = i & 7, dirs = Math.abs(v) === 2 ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : s > 0 ? [[-1, 1], [-1, -1]] : [[1, 1], [1, -1]];
      dirs.forEach(function (d) { var r1 = r + d[0], c1 = c + d[1], r2 = r + 2 * d[0], c2 = c + 2 * d[1];
        if (r2 >= 0 && r2 < 8 && c2 >= 0 && c2 < 8 && side(bd[r1 * 8 + c1]) === -s && !bd[r2 * 8 + c2]) out.push({ from: i, to: r2 * 8 + c2, cap: r1 * 8 + c1 });
        else if (!capOnly && r1 >= 0 && r1 < 8 && c1 >= 0 && c1 < 8 && !bd[r1 * 8 + c1]) out.push({ from: i, to: r1 * 8 + c1 }); });
      return out;
    }
    function all(bd, s) { var caps = [], plain = []; for (var i = 0; i < 64; i++) if (side(bd[i]) === s) moves(bd, i).forEach(function (m) { (m.cap != null ? caps : plain).push(m); }); return caps.length ? caps : plain; }
    function apply(bd, m) { bd[m.to] = bd[m.from]; bd[m.from] = 0; if (m.cap != null) bd[m.cap] = 0; var r = m.to >> 3; if (bd[m.to] === 1 && r === 0) bd[m.to] = 2; if (bd[m.to] === -1 && r === 7) bd[m.to] = -2; }
    function cpuTurn() {
      var at = null;
      (function go() {
        var ms = at != null ? moves(b, at, true) : all(b, -1);
        if (!ms.length) { if (at == null) { over = true; msg.textContent = '🎉 You win! The phone has no moves.'; api.win(); } else end(); draw(); return; }
        var caps = ms.filter(function (m) { return m.cap != null; }), pool = caps.length ? caps : ms;
        var safe = pool.filter(function (m) { var t = b.slice(); apply(t, m); return !all(t, 1).some(function (x) { return x.cap === m.to; }); });
        var m = (safe.length ? safe : pool)[rnd((safe.length ? safe : pool).length)]; apply(b, m); draw();
        if (m.cap != null && moves(b, m.to, true).length) { at = m.to; setTimeout(go, 350); } else end();
      })();
      function end() { var mine = all(b, 1); if (!mine.length) { over = true; msg.textContent = 'The phone wins this one.'; api.over(null, start); } else msg.textContent = 'Your move.' + (mine[0].cap != null ? ' You must capture.' : ''); draw(); }
    }
    function tap(i) {
      if (over) return;
      var legal = chain != null ? moves(b, chain, true) : all(b, 1);
      if (side(b[i]) === 1 && chain == null) { sel = legal.some(function (m) { return m.from === i; }) ? i : null; draw(); return; }
      var m = legal.filter(function (x) { return x.from === sel && x.to === i; })[0]; if (!m) return;
      apply(b, m); if (m.cap != null && moves(b, m.to, true).length) { chain = sel = m.to; msg.textContent = 'Keep jumping!'; draw(); return; }
      chain = sel = null; draw(); msg.textContent = 'Phone is thinking…'; setTimeout(cpuTurn, 400);
    }
    function draw() {
      var legal = sel != null ? (chain != null ? moves(b, chain, true) : all(b, 1)).filter(function (m) { return m.from === sel; }).map(function (m) { return m.to; }) : [];
      var h = ''; for (var i = 0; i < 64; i++) { var dark = ((i >> 3) + (i & 7)) % 2, v = b[i]; h += '<button type="button" data-i="' + i + '" class="sq' + (dark ? ' d' : '') + (i === sel ? ' sel' : '') + (legal.indexOf(i) >= 0 ? ' hint' : '') + '">' + (v ? '<span class="pc ' + (v > 0 ? 'me' : 'cpu') + (Math.abs(v) === 2 ? ' king' : '') + '">' + (Math.abs(v) === 2 ? '♛' : '') + '</span>' : '') + '</button>'; }
      box.innerHTML = h;
    }
    box.addEventListener('click', function (e) { var t = e.target.closest('[data-i]'); if (t) tap(+t.getAttribute('data-i')); });
    api.onAgain(start); start();
  }

  /* ---------------- Chess ---------------- */
  function chess(body, api) {
    var b, turn, sel, over, box = el('div', 'arc-board ch'), msg = el('p', 'arc-msg'); body.appendChild(msg); body.appendChild(box);
    var GLYPH = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }, VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    function start() { b = 'rnbqkbnrpppppppp' + Array(33).join('.') + 'PPPPPPPPRNBQKBNR'; b = b.split(''); turn = 'w'; sel = null; over = false; msg.textContent = 'You are white. Tap a piece, then where to move.'; draw(); }
    function col(p) { return p === '.' ? null : p === p.toUpperCase() ? 'w' : 'b'; }
    function pseudo(bd, i) {
      var p = bd[i], c = col(p), t = p.toLowerCase(), r = i >> 3, f = i & 7, out = [];
      var add = function (rr, ff) { if (rr < 0 || rr > 7 || ff < 0 || ff > 7) return false; var j = rr * 8 + ff; if (col(bd[j]) === c) return false; out.push(j); return bd[j] === '.'; };
      if (t === 'p') { var d = c === 'w' ? -1 : 1, j = (r + d) * 8 + f; if (r + d >= 0 && r + d < 8 && bd[j] === '.') { out.push(j); if ((c === 'w' ? r === 6 : r === 1) && bd[j + d * 8] === '.') out.push(j + d * 8); } [-1, 1].forEach(function (df) { var ff = f + df, rr = r + d; if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 && col(bd[rr * 8 + ff]) && col(bd[rr * 8 + ff]) !== c) out.push(rr * 8 + ff); }); }
      else if (t === 'n') [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(function (m) { add(r + m[0], f + m[1]); });
      else if (t === 'k') [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (m) { add(r + m[0], f + m[1]); });
      else { var dirs = t === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : t === 'b' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]; dirs.forEach(function (m) { for (var k = 1; k < 8 && add(r + m[0] * k, f + m[1] * k); k++); }); }
      return out;
    }
    function attacked(bd, i, by) { for (var j = 0; j < 64; j++) if (col(bd[j]) === by && pseudo(bd, j).indexOf(i) >= 0) return true; return false; }
    function mv(bd, a, z) { var t = bd.slice(); t[z] = t[a]; t[a] = '.'; if (t[z] === 'P' && z < 8) t[z] = 'Q'; if (t[z] === 'p' && z >= 56) t[z] = 'q'; return t; }
    function legal(bd, c) { var out = []; for (var i = 0; i < 64; i++) if (col(bd[i]) === c) pseudo(bd, i).forEach(function (z) { var t = mv(bd, i, z), k = t.indexOf(c === 'w' ? 'K' : 'k'); if (!attacked(t, k, c === 'w' ? 'b' : 'w')) out.push([i, z]); }); return out; }
    function material(bd) { var s = 0; bd.forEach(function (p, i) { if (p !== '.') { var v = VAL[p.toLowerCase()] + ((i >> 3) > 1 && (i >> 3) < 6 && (i & 7) > 1 && (i & 7) < 6 ? 0.1 : 0); s += col(p) === 'b' ? v : -v; } }); return s; }
    function cpu() {
      var ms = shuffle(legal(b, 'b')), best = null, bs = -1e9;
      ms.forEach(function (m) { var t = mv(b, m[0], m[1]), rep = legal(t, 'w'), worst = 1e9;
        if (!rep.length) worst = attacked(t, t.indexOf('K'), 'b') ? 1e6 : 0;
        rep.forEach(function (x) { var v = material(mv(t, x[0], x[1])); if (v < worst) worst = v; });
        if (worst > bs) { bs = worst; best = m; } });
      return best;
    }
    function status(c) { var ms = legal(b, c), k = b.indexOf(c === 'w' ? 'K' : 'k'), chk = attacked(b, k, c === 'w' ? 'b' : 'w'); return { none: !ms.length, check: chk }; }
    function tap(i) {
      if (over || turn !== 'w') return;
      if (col(b[i]) === 'w') { sel = i; draw(); return; }
      if (sel == null) return; var ok = legal(b, 'w').some(function (m) { return m[0] === sel && m[1] === i; }); if (!ok) return;
      b = mv(b, sel, i); sel = null; turn = 'b'; draw();
      var s = status('b'); if (s.none) { over = true; msg.textContent = s.check ? '🎉 Checkmate! You win.' : 'Stalemate: a draw.'; if (s.check) api.win(); else api.over(null, start); return; }
      msg.textContent = 'Phone is thinking…'; setTimeout(function () { var m = cpu(); b = mv(b, m[0], m[1]); turn = 'w'; var s2 = status('w');
        if (s2.none) { over = true; msg.textContent = s2.check ? 'Checkmate. The phone wins.' : 'Stalemate: a draw.'; api.over(null, start); } else msg.textContent = s2.check ? 'Check! Protect your king.' : 'Your move.'; draw(); }, 250);
    }
    function draw() {
      var hint = sel != null ? legal(b, 'w').filter(function (m) { return m[0] === sel; }).map(function (m) { return m[1]; }) : [];
      var h = ''; for (var i = 0; i < 64; i++) h += '<button type="button" data-i="' + i + '" class="sq' + (((i >> 3) + (i & 7)) % 2 ? ' d' : '') + (i === sel ? ' sel' : '') + (hint.indexOf(i) >= 0 ? ' hint' : '') + '"><span class="cp ' + (col(b[i]) || '') + '">' + (GLYPH[b[i]] || '') + '</span></button>';
      box.innerHTML = h;
    }
    box.addEventListener('click', function (e) { var t = e.target.closest('[data-i]'); if (t) tap(+t.getAttribute('data-i')); });
    api.onAgain(start); start();
  }

  /* ---------------- Whot ---------------- */
  function whot(body, api) {
    var SH = { circle: '●', triangle: '▲', cross: '✚', square: '■', star: '★', whot: 'W' }, SHC = { circle: '#c0392b', triangle: '#c0392b', cross: '#c0392b', square: '#c0392b', star: '#c0392b', whot: '#7c3aed' };
    var SPECIAL = { 1: 'Hold on', 2: 'Pick two', 8: 'Suspension', 14: 'General market', 20: 'Whot' };
    var st, box = el('div', 'arc-whot'); body.appendChild(box);
    function deck() { var d = [], add = function (s, ns) { ns.forEach(function (n) { d.push({ s: s, n: n }); }); }, a = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14], b2 = [1, 2, 3, 5, 7, 10, 11, 13, 14];
      add('circle', a); add('triangle', a); add('cross', b2); add('square', b2); add('star', [1, 2, 3, 4, 5, 7, 8]); for (var i = 0; i < 5; i++) d.push({ s: 'whot', n: 20 }); return shuffle(d); }
    function start() { var d = deck(); st = { market: d, me: d.splice(0, 5), cpu: d.splice(0, 5), pile: [], want: null, msg: 'Match the shape or number. 20 (Whot) is wild.', over: false, choose: false }; var top; do { top = st.market.shift(); if (top.n === 20 || SPECIAL[top.n]) st.market.push(top); } while (top.n === 20 || SPECIAL[top.n]); st.pile.push(top); draw(); }
    function top() { return st.pile[st.pile.length - 1]; }
    function fits(c) { if (c.n === 20) return true; var t = top(); if (st.want) return c.s === st.want; return c.s === t.s || c.n === t.n; }
    function draw1(who) { if (!st.market.length) { var keep = st.pile.pop(); st.market = shuffle(st.pile); st.pile = [keep]; } if (st.market.length) st[who].push(st.market.shift()); }
    function after(who, c) {
      var other = who === 'me' ? 'cpu' : 'me', again = false, name = who === 'me' ? 'You' : 'Phone';
      st.want = null;
      if (!st[who].length) { st.over = true; st.msg = who === 'me' ? '🎉 Check up! You win.' : 'Phone: "Check up!" The phone wins.'; draw(); if (who === 'me') api.win(); else api.over(null, start); return; }
      if (c.n === 2) { draw1(other); draw1(other); st.msg = name + ' played Pick two.'; again = true; }
      else if (c.n === 14) { draw1(other); st.msg = name + ' called General market.'; again = true; }
      else if (c.n === 1 || c.n === 8) { st.msg = name + ': ' + SPECIAL[c.n] + '!'; again = true; }
      else st.msg = '';
      if (st[who].length === 1) st.msg += ' ' + name + ': "Last card!"';
      return again;
    }
    function cpuTurn() {
      if (st.over) return;
      var hand = st.cpu, playable = hand.filter(fits).sort(function (a, b) { return (a.n === 20) - (b.n === 20) || (SPECIAL[b.n] ? 1 : 0) - (SPECIAL[a.n] ? 1 : 0); });
      if (!playable.length) { draw1('cpu'); st.msg = 'Phone went to market.'; draw(); return; }
      var c = playable[0]; hand.splice(hand.indexOf(c), 1); st.pile.push(c);
      if (c.n === 20) { var count = {}; hand.forEach(function (x) { if (x.s !== 'whot') count[x.s] = (count[x.s] || 0) + 1; }); var best = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0] || 'circle'; st.want = best; st.msg = 'Phone played Whot: "I need ' + best + '!"'; if (!hand.length) { after('cpu', c); return; } draw(); return; }
      var again = after('cpu', c); draw(); if (again && !st.over) setTimeout(cpuTurn, 700);
    }
    function play(i) {
      if (st.over || st.choose) return; var c = st.me[i]; if (!fits(c)) { st.msg = 'That card does not match. Play ' + (st.want ? 'a ' + st.want : 'the same shape or number') + ', or go to market.'; draw(); return; }
      st.me.splice(i, 1); st.pile.push(c);
      if (c.n === 20 && st.me.length) { st.choose = true; st.msg = 'Whot! Which shape do you need?'; draw(); return; }
      var again = after('me', c); draw(); if (!again && !st.over) setTimeout(cpuTurn, 600);
    }
    function card(c, i, mine) { return '<button type="button" class="wc' + (mine && fits(c) ? ' ok' : '') + '"' + (mine ? ' data-w="' + i + '"' : ' disabled') + ' style="--wc:' + SHC[c.s] + '"><b>' + c.n + '</b><span>' + SH[c.s] + '</span><b class="r">' + c.n + '</b></button>'; }
    function draw() {
      var t = top();
      box.innerHTML = '<div class="wh-cpu"><span>📱 Phone · ' + st.cpu.length + ' card' + (st.cpu.length === 1 ? '' : 's') + '</span><div class="wh-back">' + st.cpu.map(function () { return '<i></i>'; }).join('') + '</div></div>' +
        '<div class="wh-mid"><button type="button" class="wc back" data-market="1"' + (st.over || st.choose ? ' disabled' : '') + '><span>WHOT</span><small>Market · ' + st.market.length + '</small></button>' + card(t, -1, false) + (st.want ? '<span class="wh-want">Need: ' + SH[st.want] + ' ' + st.want + '</span>' : '') + '</div>' +
        '<p class="arc-msg">' + st.msg + '</p>' + (st.choose ? '<div class="wh-pick">' + ['circle', 'triangle', 'cross', 'square', 'star'].map(function (s) { return '<button type="button" data-need="' + s + '">' + SH[s] + ' ' + s + '</button>'; }).join('') + '</div>' : '') +
        '<div class="wh-hand">' + st.me.map(function (c, i) { return card(c, i, true); }).join('') + '</div>';
    }
    box.addEventListener('click', function (e) {
      var w = e.target.closest('[data-w]'), m = e.target.closest('[data-market]'), n = e.target.closest('[data-need]');
      if (w) play(+w.getAttribute('data-w'));
      else if (m && !st.over) { draw1('me'); st.msg = 'You went to market.'; draw(); setTimeout(cpuTurn, 600); }
      else if (n) { st.choose = false; st.want = n.getAttribute('data-need'); st.msg = 'You need ' + st.want + '.'; draw(); setTimeout(cpuTurn, 600); }
    });
    api.onAgain(start); start();
  }

  /* ---------------- Word Connect ---------------- */
  var WORDS = [
    ['RATE', ['RATE', 'TEAR', 'EAT', 'TEA', 'ATE', 'ART', 'RAT', 'TAR', 'EAR', 'ARE']],
    ['PLANE', ['PLANE', 'PANEL', 'PLAN', 'PALE', 'LEAP', 'LANE', 'LEAN', 'NAP', 'PAN', 'PEN', 'PAL', 'LAP', 'APE']],
    ['STONE', ['STONE', 'NOTES', 'TONES', 'NOTE', 'TONE', 'ONES', 'NEST', 'SENT', 'TENS', 'TON', 'TEN', 'NET', 'SET', 'NOT', 'ONE', 'TOE']],
    ['HEART', ['HEART', 'EARTH', 'HATE', 'HEAT', 'RATE', 'TEAR', 'HEAR', 'HARE', 'THE', 'HAT', 'EAT', 'TEA', 'ART', 'RAT']],
    ['DANCE', ['DANCE', 'CANE', 'DEAN', 'ACNE', 'AND', 'CAN', 'DEN', 'END', 'ACE']],
    ['GROUND', ['GROUND', 'ROUND', 'DRUG', 'RUNG', 'UNDO', 'RUN', 'URN', 'DOG', 'GOD', 'OUR', 'GUN', 'NOD']],
    ['MARKET', ['MARKET', 'MAKER', 'TAKER', 'TREK', 'MAKE', 'TAKE', 'RAKE', 'MEAT', 'TEAM', 'MATE', 'TAME', 'TERM', 'ARM', 'ART', 'EAT', 'TEA', 'RAT', 'MAT']],
    ['FRIEND', ['FRIEND', 'FINDER', 'FINED', 'FRIED', 'DINER', 'FIND', 'FINE', 'FIRE', 'RIDE', 'DINE', 'NERD', 'FED', 'FIN', 'RED', 'DIE', 'END', 'DEN']]
  ];
  function words(body, api) {
    var st, box = el('div', 'arc-words'); body.appendChild(box);
    function start(lv) { lv = lv || 0; var P = WORDS[lv % WORDS.length]; st = { lv: lv, P: P, letters: shuffle(P[0].split('')), found: [], pick: [], msg: 'Tap letters to make words, then ✓.', score: st ? st.score : 0 }; draw(); }
    function draw() {
      var P = st.P, cur = st.pick.map(function (i) { return st.letters[i]; }).join('');
      box.innerHTML = '<p class="arc-msg">Puzzle ' + (st.lv + 1) + ' · ' + st.found.length + ' of ' + P[1].length + ' words</p><div class="ww-list">' + P[1].slice().sort(function (a, b) { return a.length - b.length || (a < b ? -1 : 1); }).map(function (w) { var f = st.found.indexOf(w) >= 0; return '<span class="ww' + (f ? ' f' : '') + '">' + w.split('').map(function (ch) { return '<i>' + (f ? ch : '') + '</i>'; }).join('') + '</span>'; }).join('') + '</div>' +
        '<div class="ww-cur">' + (cur || '&nbsp;') + '</div><div class="ww-wheel">' + st.letters.map(function (ch, i) { return '<button type="button" data-l="' + i + '"' + (st.pick.indexOf(i) >= 0 ? ' class="on"' : '') + '>' + ch + '</button>'; }).join('') + '</div>' +
        '<div class="ww-act"><button type="button" class="btn sm ghost" data-ww="mix">🔀 Shuffle</button><button type="button" class="btn sm ghost" data-ww="clear">⌫ Clear</button><button type="button" class="btn sm go" data-ww="ok">✓ Enter</button></div><p class="arc-msg">' + st.msg + '</p>';
    }
    box.addEventListener('click', function (e) {
      var l = e.target.closest('[data-l]'), a = e.target.closest('[data-ww]');
      if (l) { var i = +l.getAttribute('data-l'), k = st.pick.indexOf(i); if (k >= 0) st.pick.splice(k, 1); else st.pick.push(i); draw(); return; }
      if (!a) return; var w = a.getAttribute('data-ww');
      if (w === 'mix') { st.letters = shuffle(st.letters); st.pick = []; }
      else if (w === 'clear') st.pick = [];
      else if (w === 'next') { start(st.lv + 1); return; }
      else { var word = st.pick.map(function (i) { return st.letters[i]; }).join(''); st.pick = [];
        if (st.found.indexOf(word) >= 0) st.msg = word + ': already found.';
        else if (st.P[1].indexOf(word) >= 0) { st.found.push(word); st.score++; api.score(st.score); st.msg = '✅ ' + word + '!'; if (st.found.length === st.P[1].length) { st.msg = '🎉 Puzzle done! <button type="button" class="btn sm go" data-ww="next">Next puzzle</button>'; } }
        else st.msg = word ? word + ' is not on the list.' : 'Tap some letters first.'; }
      draw();
    });
    start(0);
  }

  var GAMES = {
    whot: { name: 'Whot', icon: '🃏', fn: whot, kind: 'win' }, chess: { name: 'Chess', icon: '♟️', fn: chess, kind: 'win' },
    snake: { name: 'Snake', icon: '🐍', fn: snake }, words: { name: 'Word Connect', icon: '🔤', fn: words },
    checkers: { name: 'Checkers', icon: '⚫', fn: checkers, kind: 'win' }, four: { name: 'Four in a Row', icon: '🔴', fn: four, kind: 'win' },
    merge: { name: 'Number Merge', icon: '🔢', fn: merge }, breaker: { name: 'Breaker', icon: '🧱', fn: breaker },
    defender: { name: 'Star Defender', icon: '🚀', fn: defender }, math: { name: 'Math Rush', icon: '➗', fn: mathrush }
  };

  // Open a game full screen. onClose runs when the player leaves.
  function open(kind, onClose) {
    var G = GAMES[kind]; if (!G) return;
    var ov = el('div', 'arc-ov'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', G.name);
    var best = bests()[kind];
    ov.innerHTML = '<div class="arc-top"><button type="button" class="arc-x" aria-label="Close">‹</button><b>' + G.icon + ' ' + G.name + '</b><span class="arc-sc">' + (G.kind === 'win' ? 'Wins ' + (best || 0) : 'Score 0 · Best ' + (best || 0)) + '</span></div><div class="arc-body"></div><div class="arc-end" hidden></div>';
    document.body.appendChild(ov);
    var body = ov.querySelector('.arc-body'), sc = ov.querySelector('.arc-sc'), end = ov.querySelector('.arc-end'), again = null, cleanup = null;
    function showEnd(text, fn) { end.hidden = false; end.innerHTML = '<p>' + text + '</p><button type="button" class="btn go">Play again</button>'; end.querySelector('button').onclick = function () { end.hidden = true; (fn || again)(); }; }
    var api = {
      score: function (n) { sc.textContent = 'Score ' + n + ' · Best ' + Math.max(n, bests()[kind] || 0); },
      over: function (n, fn) { var nb = n != null && saveBest(kind, n); showEnd(n != null ? (nb ? '🏆 New best: ' + n + '!' : 'Game over · score ' + n) : 'Game over.', fn); },
      win: function () { var w = (bests()[kind] || 0) + 1; saveBest(kind, w); sc.textContent = 'Wins ' + w; showEnd('🎉 Nice one! That is ' + w + (w === 1 ? ' win' : ' wins') + ' on this phone.'); },
      onAgain: function (fn) { again = fn; }
    };
    function close() { if (cleanup) try { cleanup(); } catch (e) {} ov.remove(); document.removeEventListener('keydown', esc); if (onClose) onClose(); }
    function esc(e) { if (e.key === 'Escape') close(); }
    ov.querySelector('.arc-x').onclick = close; document.addEventListener('keydown', esc);
    requestAnimationFrame(function () { cleanup = G.fn(body, api) || null; });
    return { close: close, el: ov };
  }
  root.LasgidiArcade = { GAMES: GAMES, open: open, bests: bests, WORDS: WORDS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
