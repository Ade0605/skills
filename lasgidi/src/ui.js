/* Lasgidi — browser UI. Renders the engine state; never changes money itself. */
(function () {
  'use strict';
  var L = window.Lasgidi, D = L.DATA, N = L.naira;
  var SAVE_KEY = 'lasgidi.save.v1', WEEKLY_KEY = 'lasgidi.weekly.v1';
  var app = document.getElementById('app');
  var ui = { tab: 'do', sel: null, place: null, placeCat: null, board: null, ad: { emoji: 0, slogan: 's0', color: 0 }, toasts: [], draftOrigin: null, importMsg: '', flash: '' };
  var S = null;

  /* ---------- storage (best effort) ---------- */
  // Two slots: your life, and this week's Lagos. They never overwrite each other.
  function save() {
    if (!S) return;
    try { localStorage.setItem(S.challenge ? WEEKLY_KEY : SAVE_KEY, L.serialize(S)); } catch (e) { /* storage unavailable */ }
  }
  function load(key) {
    try {
      var code = localStorage.getItem(key || SAVE_KEY);
      if (code) return L.migrate(L.deserialize(code).state);
    } catch (e) { /* ignore broken save */ }
    return null;
  }
  function thisWeek() { return L.challengeId(new Date()); }
  // This week's run, if one is saved for the current week.
  function weeklyRun() {
    var w = load(WEEKLY_KEY);
    return w && w.challenge && w.challenge.id === thisWeek() ? w : null;
  }
  function setMode(mode) { prefs.mode = mode; writeJSON(PREF_KEY, prefs); }
  function playWeekly(fresh) {
    if (S) save();
    var w = fresh ? null : weeklyRun();
    if (!w) w = L.newGame({ challenge: thisWeek(), name: (S && S.name) || ui.draftName || 'Ade' });
    S = w; ui.tab = 'do'; ui.sel = null; ui.place = null; ui.board = null; online.wStatus = '';
    setMode('weekly'); save(); render(); subscribeWeekly();
  }
  function backToLife() {
    if (S) save();
    S = load(SAVE_KEY); ui.tab = 'do'; ui.sel = null; ui.place = null; ui.board = null;
    setMode('life'); render();
  }

  var LIVES_KEY = 'lasgidi.lives.v1', PREF_KEY = 'lasgidi.prefs.v1';
  function readJSON(k, fallback) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  var prefs = readJSON(PREF_KEY, { sound: false });
  function lives() { return readJSON(LIVES_KEY, []); }
  function archiveLife() {
    if (!S) return;
    var list = lives();
    list.push(Object.assign(L.lifeSummary(S), { ended: Date.now() }));
    list.sort(function (a, b) { return b.score - a.score; });
    writeJSON(LIVES_KEY, list.slice(0, 20));
  }

  /* ---------- sound: bank alerts and the danfo horn (off by default) ---------- */
  var audio = null;
  function ctx() {
    if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; } }
    if (audio && audio.state === 'suspended') audio.resume().catch(function () {});
    return audio;
  }
  function tone(freq, start, len, type, vol) {
    var a = ctx(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain(), t = a.currentTime + start;
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + len + 0.02);
  }
  var sounds = {
    credit: function () { tone(988, 0, 0.14); tone(1319, 0.13, 0.22); },
    debit: function () { tone(440, 0, 0.18, 'triangle', 0.08); },
    horn: function () { tone(370, 0, 0.12, 'square', 0.05); tone(370, 0.17, 0.2, 'square', 0.05); },
    bad: function () { tone(330, 0, 0.2, 'triangle', 0.1); tone(247, 0.18, 0.35, 'triangle', 0.1); },
    good: function () { tone(784, 0, 0.12); tone(988, 0.1, 0.12); tone(1175, 0.2, 0.25); }
  };
  function play(name) { if (prefs.sound && sounds[name]) { try { sounds[name](); } catch (e) { /* audio blocked */ } } }

  function esc(v) {
    return String(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function dur(m) { return L.fmtMins(m); }

  /* ---------- run an engine call, then render ---------- */
  function run(fn, kind) {
    var res = fn();
    if (res && res.ok && kind === 'travel') play('horn');
    else if (res && res.collapsed) play('bad');
    else if (res && (res.won || /Promoted/.test(res.msg || ''))) play('good');
    else if (S && S.alerts && S.alerts.length) {
      var net = S.alerts.reduce(function (a, x) { return a + (x.memo === 'Transfer' ? 0 : x.amt); }, 0);
      if (net > 0) play('credit'); else if (net < 0) play('debit');
    }
    if (res && res.msg) ui.toasts.push({ msg: res.msg, ok: res.ok });
    (S.alerts || []).forEach(function (a) { ui.toasts.push({ alert: a }); });
    S.alerts = [];
    if (ui.toasts.length > 4) ui.toasts = ui.toasts.slice(-4);
    save();
    render();
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(function () { ui.toasts = []; renderToasts(); }, 4200);
  }

  /* ---------- top-level render ---------- */
  function render() {
    // Live updates re-render at any moment, so keep what the viewer is typing.
    var kept = {};
    Array.prototype.forEach.call(app.querySelectorAll('input[id], textarea[id]:not([readonly])'), function (el) {
      if (el.type === 'radio') { if (el.checked) kept[el.id] = true; } else kept[el.id] = el.value;
    });
    var focusId = document.activeElement && document.activeElement.id;
    if (!S) { app.innerHTML = introView(); bindIntro(); }
    else {
      app.innerHTML = strip() + '<main class="wrap">' + needsView() + board() + '</main>' + modal() + '<div class="toasts" id="toasts" aria-live="polite"></div>';
      renderToasts();
    }
    Object.keys(kept).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'radio') el.checked = true; else el.value = kept[id];
    });
    mountPlayground();
    mountInterior();
    syncResidence();
    if (focusId) { var f = document.getElementById(focusId); if (f) f.focus(); }
    syncPresence();
  }

  /* ---------- Lagos online: shared hall of fame and live presence ----------
   * Both light up only inside claude.ai; the game is complete without them.
   * No chat and no free text travel between players: presence carries a
   * district key, the board carries numbers. */
  var online = { ads: [], sponsored: [], db: null, user: null, room: null, me: null, fame: [], hidden: 0, unverified: 0, names: {}, peers: {}, others: 0, canWrite: null, sentLoc: null, status: '', checked: {} };

  // Each player's row is a small summary at fame/<id>; the replay log lives
  // beside it at fame/<id>/proof/log. Load every summary (no ordering: a
  // stored score is never trusted, so it cannot choose who gets loaded),
  // rank by the rebuilt score, then fetch and replay proofs from the top
  // down until the board has 10 verified lives.
  var rawFame = [], verifying = false;
  var BOARD = 10, MAX_PROOFS = 25;

  function verdictKey(id, raw) { return id + ':' + raw.seal + ':' + raw.lines; }

  function rankFame() {
    var cands = [], hidden = 0, failed = 0;
    rawFame.forEach(function (d) {
      var e = L.checkFame(d.raw);
      if (!e || typeof d.raw.seal !== 'string') { hidden++; return; }
      cands.push({ id: d.id, raw: d.raw, e: e, key: verdictKey(d.id, d.raw) });
    });
    cands.sort(function (a, b) { return b.e.score - a.e.score; });
    var rows = [], pending = 0;
    cands.forEach(function (c) {
      var v = online.checked[c.key];
      if (v === 'ok') rows.push(Object.assign(c.e, { id: c.id }));
      else if (v === 'bad') failed++;
      else pending++;
    });
    online.fame = rows.slice(0, BOARD); online.hidden = hidden; online.unverified = failed;
    online.pending = rows.length >= BOARD ? 0 : pending;
    if (online.user && online.fame.length) {
      online.user.profiles(online.fame.map(function (r) { return r.id; })).then(function (ps) { online.names = ps; scheduleRender(); });
    }
    scheduleRender();
    if (!verifying && rows.length < BOARD) verifyNext(cands);
  }

  function verifyNext(cands) {
    var next = null, fetched = Object.keys(online.checked).length;
    for (var i = 0; i < cands.length; i++) if (!online.checked[cands[i].key]) { next = cands[i]; break; }
    if (!next || fetched >= MAX_PROOFS) { online.pending = 0; scheduleRender(); return; }
    verifying = true;
    online.db.doc('fame/' + next.id + '/proof/log').get().then(function (snap) {
      var proof = snap.exists ? snap.data() : null;
      var ok = !!(proof && proof.seal === next.raw.seal && L.verifyFame(Object.assign({}, next.raw, { replay: proof.replay })).ok);
      online.checked[next.key] = ok ? 'ok' : 'bad';
    }, function () { online.checked[next.key] = 'bad'; }).then(function () {
      verifying = false;
      setTimeout(rankFame, 0);
    });
  }

  function initOnline() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    window.claude.use('user').then(function (u) {
      if (!u) return;
      online.user = u;
      u.id().then(function (id) { online.me = id; scheduleRender(); });
      u.can('data.write').then(function (c) { online.canWrite = c; scheduleRender(); });
    });
    window.claude.use('db').then(function (db) {
      if (!db) return;
      online.db = db;
      db.collection('fame').limit(500).onSnapshot(function (snap) {
        rawFame = snap.docs.map(function (d) { return { id: d.id, raw: d.data() }; });
        rankFame();
      }, function () { online.db = null; scheduleRender(); });
    });
    window.claude.use('db').then(function (db) {
      if (!db) return;
      db.collection('ads').limit(500).onSnapshot(function (snap) {
        online.ads = snap.docs.map(function (d) { return { id: d.id, raw: d.data() }; });
        var ids = online.ads.map(function (a) { return a.id; });
        if (online.user && ids.length) online.user.profiles(ids).then(function (ps) { Object.keys(ps).forEach(function (k) { online.names[k] = ps[k]; }); scheduleRender(); });
        scheduleRender();
      }, function () { online.ads = []; });
      db.collection('sponsored').limit(50).onSnapshot(function (snap) {
        online.sponsored = snap.docs.map(function (d) { return d.data(); });
        scheduleRender();
      }, function () { online.sponsored = []; });
    });
    window.claude.use('db').then(function (db) { if (db) subscribeWeekly(); });
    window.claude.use('db').then(function (db) {
      if (!db) return;
      db.collection('residents').limit(500).onSnapshot(function (snap) {
        online.residents = snap.docs.map(function (d) { var r = d.data(); return { id: d.id, home: r && typeof r.home === 'string' ? r.home : null }; });
        var ids = online.residents.map(function (r) { return r.id; });
        if (online.user && ids.length) online.user.profiles(ids).then(function (ps) { Object.keys(ps).forEach(function (k) { online.names[k] = ps[k]; }); scheduleRender(); });
        scheduleRender();
      }, function () { online.residents = []; });
      db.collection('plots').limit(500).onSnapshot(function (snap) {
        online.plots = snap.docs.map(function (d) { var r = d.data(); return { id: d.id, plot: r && typeof r.plot === 'number' ? r.plot | 0 : -1, at: r && typeof r.at === 'number' ? r.at : 0 }; });
        scheduleRender();
      }, function () { online.plots = []; });
    });
    window.claude.use('room').then(function (room) {
      if (!room) return;
      online.room = room;
      room.onPeers(function (ch) {
        var counts = {}, others = 0;
        ch.peers.forEach(function (p) {
          if (p.isMe || p.kind !== 'viewer') return;
          var d = p.presence && p.presence.d;
          if (typeof d !== 'string' || !D.DISTRICTS[d]) return;
          counts[d] = (counts[d] || 0) + 1; others++;
        });
        online.peers = counts; online.others = others;
        scheduleRender();
      }, function () { online.room = null; online.peers = {}; online.others = 0; scheduleRender(); });
      syncPresence();
    });
  }

  var renderTimer = null;
  function scheduleRender() {
    if (renderTimer) return;
    renderTimer = setTimeout(function () { renderTimer = null; render(); }, 400);
  }

  function syncPresence() {
    if (!online.room) return;
    var d = S ? S.loc : null;
    if (d === online.sentLoc) return;
    online.sentLoc = d;
    online.room.presence({ d: d }).catch(function () {});
  }

  /* ---------- Weekly Lagos board: same replay check, ranked by net worth ---------- */
  var weeklyUnsub = null, weeklyFor = null, rawWeekly = [], wVerifying = false;
  function boardWeek() { return S && S.challenge ? S.challenge.id : thisWeek(); }
  function subscribeWeekly() {
    if (!online.db) return;
    var id = boardWeek();
    if (weeklyFor === id) return;
    if (weeklyUnsub) weeklyUnsub();
    weeklyFor = id; rawWeekly = []; online.weekly = [];
    try {
      weeklyUnsub = online.db.collection('weekly').where('challenge', '==', id).limit(500).onSnapshot(function (snap) {
        rawWeekly = snap.docs.map(function (d) { return { id: d.id, raw: d.data() }; });
        rankWeekly();
      }, function () { online.weekly = []; scheduleRender(); });
    } catch (e) { weeklyUnsub = null; online.weekly = []; }
  }
  function rankWeekly() {
    var id = weeklyFor, rows = [], pending = [];
    rawWeekly.forEach(function (d) {
      var r = d.raw;
      if (!r || r.challenge !== id || typeof r.worth !== 'number' || typeof r.seal !== 'string') return;
      var key = 'w:' + id + ':' + d.id + ':' + r.seal + ':' + r.lines, v = online.checked[key];
      if (v === 'ok') rows.push({ id: d.id, worth: r.worth, origin: D.ORIGINS[r.origin] ? r.origin : null, career: D.CAREERS[r.career] ? r.career : null, level: r.level | 0 });
      else if (!v) pending.push({ id: d.id, raw: r, key: key });
    });
    rows.sort(function (a, b) { return b.worth - a.worth; });
    online.weekly = rows.slice(0, 10);
    online.wPending = pending.length;
    if (online.user && online.weekly.length) online.user.profiles(online.weekly.map(function (r) { return r.id; })).then(function (ps) { Object.keys(ps).forEach(function (k) { online.names[k] = ps[k]; }); scheduleRender(); });
    scheduleRender();
    if (wVerifying || !pending.length || Object.keys(online.checked).length > 60) return;
    pending.sort(function (a, b) { return b.raw.worth - a.raw.worth; });
    var next = pending[0];
    wVerifying = true;
    online.db.doc('weekly/' + next.id + '/proof/log').get().then(function (snap) {
      var proof = snap.exists ? snap.data() : null;
      online.checked[next.key] = proof && proof.seal === next.raw.seal && L.verifyChallenge(Object.assign({}, next.raw, { replay: proof.replay }), id).ok ? 'ok' : 'bad';
    }, function () { online.checked[next.key] = 'bad'; }).then(function () { wVerifying = false; setTimeout(rankWeekly, 0); });
  }
  function postWeekly() {
    if (!online.db || !online.me) return Promise.resolve('The weekly board works when the game is opened on claude.ai.');
    if (!S || !S.challenge || !S.over) return Promise.resolve('Finish all 4 weeks first.');
    if (S.tampered || !S.replay) return Promise.resolve('This run cannot be verified, so it cannot be posted.');
    var e = L.challengeEntry(S);
    var mine = rawWeekly.filter(function (d) { return d.id === online.me; })[0];
    if (mine && mine.raw.challenge === e.challenge && mine.raw.worth >= e.worth) return Promise.resolve('Your best this week (' + N(mine.raw.worth) + ') stays on the board.');
    var summary = { challenge: e.challenge, worth: e.worth, seal: e.seal, lines: e.lines, origin: e.origin, career: e.career, level: e.level, weeks: e.weeks, at: Date.now() };
    return online.db.doc('weekly/' + online.me + '/proof/log').set({ seal: e.seal, lines: e.lines, replay: e.replay })
      .then(function () { return online.db.doc('weekly/' + online.me).set(summary); })
      .then(function () { return 'Posted ' + N(e.worth) + ' to the ' + e.challenge + ' board. Other players will replay it to check.'; },
        function (err) { return err && err.code === 'invalid_argument' ? 'You need Contributor access to post.' : 'Could not post right now. Try again shortly.'; });
  }
  function weeklyBoardView() {
    if (!online.db) return '<p class="note">The weekly board appears when the game is opened on claude.ai.</p>';
    var rows = online.weekly || [];
    var html = rows.length ? '<div class="stmt-wrap"><table class="stmt lives"><thead><tr><th>#</th><th>Lagosian</th><th>Ended as</th><th class="n">Net worth</th></tr></thead><tbody>' + rows.map(function (r, i) {
      var mine = r.id === online.me, p = online.names[r.id];
      return '<tr' + (mine ? ' class="me"' : '') + '><td class="num">' + (i + 1) + '</td><td>' + esc(mine ? 'You' : (p && p.name) || 'Someone') + ' <span class="ver">✓ replayed</span></td><td>' + esc(r.career ? D.CAREERS[r.career].titles[r.level] : 'Jobless') + '</td><td class="n num"><b>' + N(r.worth) + '</b></td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="note">No verified runs yet this week. Be the first.</p>';
    if (online.wPending) html += '<p class="note">Checking ' + online.wPending + ' more…</p>';
    return html;
  }

  function myFame() {
    for (var i = 0; i < online.fame.length; i++) if (online.fame[i].id === online.me) return online.fame[i];
    return null;
  }

  function postFame(entry, quiet) {
    if (!online.db || !online.me) return Promise.resolve(quiet ? null : 'The Hall of Fame is not available here.');
    if (S && S.tampered) return Promise.resolve('Edited saves cannot go on the Hall of Fame.');
    if (!entry.replay) return Promise.resolve(quiet ? null : 'This life began before verified scores, so it cannot be checked. Start a new life to get on the board.');
    var mine = myFame();
    if (mine && mine.score >= entry.score) return Promise.resolve(quiet ? null : 'Your best on the board (' + mine.score + ') is higher. It stays.');
    var summary = Object.assign({}, entry, { at: Date.now() });
    delete summary.replay;
    // Proof first, so a summary never points at a missing log.
    return online.db.doc('fame/' + online.me + '/proof/log').set({ seal: entry.seal, lines: entry.lines, replay: entry.replay })
      .then(function () { return online.db.doc('fame/' + online.me).set(summary); })
      .then(function () { return 'Posted ' + entry.score + ' points to the Hall of Fame. Other players\' browsers will replay it to check.'; })
      .catch(function (err) {
        if (err && err.code === 'invalid_argument') { online.canWrite = false; return 'You can read the Hall of Fame but not post to it. Ask the owner for Contributor access.'; }
        return 'Could not post right now. Try again in a moment.';
      });
  }

  function weeklyInviteView() {
    var w = weeklyRun();
    return '<div class="section"><h3>Weekly Lagos ' + esc(thisWeek()) + '</h3><p class="note">Everyone gets the same Lagos this week: same start, same events. 4 weeks, highest net worth wins. Your life here is saved and waits for you.</p>' +
      '<div class="inline"><button class="btn sm go" id="w-play" data-wplay="1">' + (w ? (w.over ? 'See this week\'s result' : 'Resume this week\'s Lagos') : 'Play this week\'s Lagos') + '</button></div></div>';
  }
  function weeklyMeView() {
    return '<div class="section"><h3>Weekly Lagos ' + esc(S.challenge.id) + '</h3><p class="note">' + (S.over ? 'Finished with ' + N(L.netWorth(S)) + '.' : 'Week ' + (L.week(S) + 1) + ' of ' + L.CHALLENGE_WEEKS + '. Net worth so far ' + N(L.netWorth(S)) + '.') + ' Your main life is saved and waiting.</p>' +
      '<div class="inline"><button class="btn sm go" id="w-back" data-wlife="1">Back to your life</button>' + (S.over ? '<button class="btn sm" id="w-result" data-wresult="1">Show result</button>' : '') +
      '<button class="btn sm ghost" id="w-restart" data-wrestart="1">Restart this week</button></div>' +
      '<h3>This week\'s board</h3>' + weeklyBoardView() + '</div>';
  }

  function familyView() {
    if (S.rules < 6) return '<div class="section"><h3>Love and family</h3><p class="note">This life started before relationships came to Lagos. Your next life can fall in love, marry and raise children.</p></div>';
    var p = S.partner, html = '<div class="section"><h3>Love and family</h3>';
    if (!p) html += '<p class="note">Single. Keep your social life up and you may meet someone at a party, church, the gym or on the danfo.</p>';
    else {
      var stage = { dating: 'Dating', introduced: 'Families have met', married: 'Married' }[p.stage];
      html += '<dl class="kv"><dt>Partner</dt><dd>' + esc(p.name) + '</dd><dt>Status</dt><dd>' + stage + '</dd><dt>Affection</dt><dd class="num">' + p.aff + ' / 100</dd>' +
        (p.stage === 'married' ? '<dt>Rent</dt><dd>' + esc(p.name) + ' pays half</dd>' : '') + '</dl>' +
        '<div class="progress"><i style="width:' + p.aff + '%"></i></div>' +
        '<p class="note">' + (p.stage === 'married' ? 'Spend time together at home to keep the marriage strong.' : 'Call from home and go on dates. Silence for more than 2 days costs affection. At 60 the families meet; at 75 you can marry.') + '</p>';
      if (p.stage !== 'married') {
        html += '<div class="list">' + L.weddingOptions(S).map(function (w) {
          return '<div class="item"><div><h3>' + esc(w.name) + '</h3><div class="meta"><span class="cost num">' + N(w.cost) + '</span></div>' + (w.disabled ? '<div class="why">' + esc(w.disabled) + '</div>' : '') + '</div>' +
            '<button class="btn sm' + (w.disabled ? '' : ' go') + '" id="wed-' + w.id + '" data-wed="' + w.id + '"' + (w.disabled ? ' disabled' : '') + '>Marry</button></div>';
        }).join('') + '</div>';
      }
    }
    if (S.kids.length) {
      html += '<h3>Children</h3><ul class="note">' + S.kids.map(function (k, i) {
        var due = k.nextFees - L.day(S);
        return '<li>Child ' + (i + 1) + ': ' + (k.school ? esc(L.SCHOOLS[k.school].name) + ', next fees in ' + Math.max(0, due) + ' days' : 'school starts in ' + Math.max(0, due) + ' days') + '</li>';
      }).join('') + '</ul><p class="note">Each child costs ' + N(L.price(S, 4000)) + ' a week for food and care.</p>';
    }
    return html + '</div>';
  }

  function fameView() {
    if (!online.db) return '';
    var rows = online.fame.slice(0, 10);
    var html = '<div class="section"><h3>Lagos Hall of Fame</h3><p class="note">Everyone this game is shared with. Each person\'s best life. Every entry is replayed move by move in your browser, and only lives that replay to the same result are ranked.' +
      (online.hidden + online.unverified ? ' ' + (online.hidden + online.unverified) + ' ' + (online.hidden + online.unverified === 1 ? 'entry failed' : 'entries failed') + ' the check and ' + (online.hidden + online.unverified === 1 ? 'is' : 'are') + ' hidden.' : '') +
      (online.pending ? ' Checking ' + online.pending + '…' : '') + '</p>';
    if (!rows.length) html += '<p class="note">No one has posted yet. Post your life to be first.</p>';
    else html += '<div class="stmt-wrap"><table class="stmt lives"><thead><tr><th>#</th><th>Lagosian</th><th>Ended as</th><th class="n">Weeks</th><th class="n">Net worth</th><th class="n">Score</th></tr></thead><tbody>' + rows.map(function (r, i) {
      var p = online.names[r.id], mine = r.id === online.me;
      var who = mine ? 'You' : (p && p.name) || 'Someone';
      var title = r.career ? D.CAREERS[r.career].titles[r.level] : 'Jobless';
      return '<tr' + (mine ? ' class="me"' : '') + '><td class="num">' + (i + 1) + '</td><td>' + esc(who) + ' <span class="muted">· ' + esc(D.ORIGINS[r.origin].name) + '</span> <span class="ver" title="Replayed and verified">✓ replayed</span>' + (r.won ? ' <span class="gain">✓ ' + esc(D.GOALS[r.goal].name) + '</span>' : '') + '</td><td>' + esc(title) + '</td><td class="n num">' + r.weeks + '</td><td class="n num">' + N(r.worth) + '</td><td class="n num"><b>' + r.score + '</b></td></tr>';
    }).join('') + '</tbody></table></div>';
    if (S && !S.replay) html += '<p class="note">This life began before verified scores, so it cannot be posted. Your next life can.</p>';
    else if (S && online.me && online.canWrite !== false) html += '<div class="inline"><button class="btn sm" id="post-fame" data-postfame="1">Post this life (' + L.fameEntry(S).score + ')</button><span class="note">' + esc(online.status) + '</span></div>';
    else if (online.status) html += '<p class="note">' + esc(online.status) + '</p>';
    return html + '</div>';
  }

  function renderToasts() {
    var el = document.getElementById('toasts');
    if (!el) return;
    el.innerHTML = ui.toasts.map(function (t) {
      if (t.alert) {
        var cr = t.alert.amt > 0;
        return '<div class="toast"><b class="' + (cr ? 'cr' : 'dr') + '">' + (cr ? 'CR' : 'DR') + ' ' + N(Math.abs(t.alert.amt)) + '</b><span>' + esc(t.alert.memo) + ' · ' + (t.alert.acct === 'bank' ? 'Bank' : 'Cash') + '</span></div>';
      }
      return '<div class="toast"><span class="msg">' + esc(t.msg) + '</span></div>';
    }).join('');
  }

  function strip() {
    var e = S.econ, chips = [];
    chips.push('<span class="chip' + (S.power ? '' : ' off') + '">' + (S.power ? 'Light: on' : 'NEPA took light') + '</span>');
    if (e.fuelDays) chips.push('<span class="chip off">Fuel scarcity · ' + e.fuelDays + 'd</span>');
    if (e.flood) chips.push('<span class="chip off">Flooding on the Island</span>');
    if (L.isDecember(S)) chips.push('<span class="chip">Detty December</span>');
    if (e.policy) chips.push('<span class="chip">' + esc(D.POLICIES[e.policy].name) + ' · ' + e.policyWeeks + 'w</span>');
    if (S.challenge) chips.unshift('<span class="chip off">Weekly Lagos ' + esc(S.challenge.id) + (S.over ? ' · finished' : ' · week ' + Math.min(L.CHALLENGE_WEEKS, L.week(S) + 1) + ' of ' + L.CHALLENGE_WEEKS) + '</span>');
    if (S.rentRate) {
      var due = L.minutesUntilRent(S), short = S.cash + S.bank < S.rentRate;
      chips.push('<span class="chip' + (short && due <= 2880 ? ' off' : '') + '">Rent ' + N(S.rentRate) + ' in ' + dur(due) + '</span>');
    }
    chips.push('<span class="chip">Prices ×' + e.infl.toFixed(2) + '</span>');
    if (online.others) chips.push('<span class="chip">' + online.others + (online.others === 1 ? ' other Lagosian' : ' other Lagosians') + ' online</span>');
    return '<header class="strip"><div class="strip-in">' +
      '<div class="brand">LASGIDI</div>' +
      '<div class="clock"><b>' + L.clockLabel(S) + '</b><span>' + L.dateLabel(S) + '</span></div>' +
      '<div class="chips">' + chips.join('') + '</div>' +
      '<button class="chip chip-btn" id="sound" data-sound="1" aria-pressed="' + !!prefs.sound + '">' + (prefs.sound ? 'Sound on' : 'Sound off') + '</button>' +
      '<div class="wallet"><div><small>Cash</small><b>' + N(S.cash) + '</b></div><div><small>Bank</small><b>' + N(S.bank) + '</b></div></div>' +
      '</div></header>';
  }

  function needsView() {
    var labels = { hunger: 'Belle', energy: 'Energy', fun: 'Enjoyment', social: 'Social', hygiene: 'Hygiene', stress: 'Calm' };
    return '<section class="needs" aria-label="Needs">' + ['hunger', 'energy', 'fun', 'social', 'hygiene', 'stress'].map(function (k) {
      var v = Math.round(k === 'stress' ? 100 - S.needs.stress : S.needs[k]);
      var cls = v < 25 ? 'low' : v < 50 ? 'mid' : '';
      return '<div class="need"><div class="row"><span>' + labels[k] + '</span><span class="num">' + v + '</span></div>' +
        '<div class="bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v + '" aria-label="' + labels[k] + '"><i class="' + cls + '" style="width:' + v + '%"></i></div></div>';
    }).join('') + '</section>';
  }

  function board() {
    var isNarrow = window.matchMedia && window.matchMedia('(max-width: 899px)').matches;
    if (!isNarrow && ui.tab === 'map') ui.tab = 'do';
    var tabs = [['do', 'Do'], ['map', 'Map'], ['home', 'Home'], ['work', 'Work'], ['money', 'Money'], ['me', 'Me'], ['gist', 'Gist']];
    var debt = L.debts(S) > 0;
    var bar = '<div class="tabs" role="tablist">' + tabs.map(function (t) {
      return '<button class="tab' + (t[0] === 'map' ? ' tab-map' : '') + '" role="tab" id="tab-' + t[0] + '" data-tab="' + t[0] + '" aria-selected="' + (ui.tab === t[0]) + '">' + t[1] +
        (t[0] === 'money' && debt ? '<span class="dot" title="You owe money"></span>' : '') + '</button>';
    }).join('') + '</div>';
    var body = { do: doView, map: function () { return mapBlock(); }, home: houseTab, work: workView, money: moneyView, me: meView, gist: gistView }[ui.tab]();
    return '<div class="board">' +
      // One map per layout: the desktop panel, or the Map tab on phones.
      (isNarrow ? '' : '<section class="panel map-panel" aria-label="Map of Lagos">' + mapBlock() + '</section>') +
      '<section class="panel work-panel">' + bar + '<div class="tab-body">' + body + '</div></section></div>';
  }

  /* ---------- map: the playground ---------- */
  var playground = null;
  function sceneFor() {
    var banner = '';
    if (S.econ.policy) banner = D.POLICIES[S.econ.policy].name + ' is law for ' + S.econ.policyWeeks + ' more week' + (S.econ.policyWeeks === 1 ? '' : 's');
    else if (S.econ.fuelDays) banner = 'Fuel scarcity: fares are up 60%';
    else if (S.econ.flood) banner = 'Flooding on the Island today';
    else if (L.isDecember(S)) banner = 'Detty December: prices up, parties everywhere';
    return {
      loc: S.loc, sel: ui.sel, home: L.homeDef(S).district, work: S.job ? D.CAREERS[S.job.id].district : null,
      hour: L.hour(S), minute: S.t % 60, t: S.t, power: S.power, gridDown: S.econ.gridDown > 0, levy: S.econ.policy === 'power',
      flood: S.econ.flood > 0, fuel: S.econ.fuelDays > 0, peers: online.peers, others: online.others,
      clock: L.clockLabel(S), banner: banner,
      places: ui.placeCat === 'boards' || ui.placeCat === 'homes' ? [] : D.PLACES.filter(function (p) { return !ui.placeCat || p.type === ui.placeCat; }), place: ui.place,
      homeId: S.home, homeSel: ui.homeSel, showHomes: ui.placeCat === 'homes', residents: residentCounts(),
      myPlot: L.myPlot(S), plotSel: ui.plotSel, plotOwners: plotOwners(),
      boards: boardAdsMap(), board: ui.board
    };
  }

  /* ---------- billboards ---------- */
  // Live paid ads for a board, newest first, at most 3; each person has one ad at a time.
  function paidAds(boardId) {
    var now = Date.now();
    return online.ads.map(function (d) { var a = L.checkAd(d.raw, now); return a && a.board === boardId ? Object.assign(a, { by: d.id }) : null; })
      .filter(Boolean).sort(function (a, b) { return b.at - a.at; }).slice(0, 3);
  }
  // Sponsored ads are written only by the artifact's owner and editors; still shown with care.
  function sponsoredAds(boardId) {
    var now = Date.now();
    return online.sponsored.filter(function (r) {
      return r && r.board === boardId && typeof r.title === 'string' && r.title.length <= 40 && typeof r.until === 'number' && r.until > now;
    }).map(function (r) {
      var c = D.AD_COLORS[r.color] || D.AD_COLORS[1];
      return { emoji: '📣', text: r.title, line2: typeof r.line2 === 'string' ? r.line2.slice(0, 60) : '', url: typeof r.url === 'string' && /^https:\/\//.test(r.url) ? r.url : null, color: c, sponsored: true, paid: true, until: r.until };
    });
  }
  function psaFor(i) {
    var a = D.PSAS[i % D.PSAS.length], b = D.PSAS[(i + 3) % D.PSAS.length];
    return [a, b].map(function (p, j) { return { emoji: p.emoji, text: p.text, color: D.AD_COLORS[j ? 2 : 1], psa: true }; });
  }
  function adsForBoard(id, i) {
    var paid = sponsoredAds(id).concat(paidAds(id).map(function (a) { return Object.assign(a, { paid: true }); }));
    return paid.length ? paid : psaFor(i);
  }
  function boardAdsMap() {
    var m = {};
    D.BILLBOARDS.forEach(function (b, i) { m[b.id] = adsForBoard(b.id, i); });
    return m;
  }
  function myAd() {
    var now = Date.now();
    for (var i = 0; i < online.ads.length; i++) if (online.ads[i].id === online.me) return L.checkAd(online.ads[i].raw, now);
    return null;
  }
  function adPreview(a, big) {
    return '<div class="ad' + (big ? ' big' : '') + '" style="background:' + a.color.bg + ';color:' + a.color.fg + '"><span class="ad-e">' + a.emoji + '</span><span class="ad-t">' + esc(a.text) +
      (a.line2 ? '<small>' + esc(a.line2) + '</small>' : '') + '</span></div>';
  }

  function boardView(id) {
    var b = D.BILLBOARDS.filter(function (x) { return x.id === id; })[0];
    if (!b) return '';
    var i = D.BILLBOARDS.indexOf(b), ads = adsForBoard(id, i), paid = ads.filter(function (a) { return a.paid; });
    var html = '<div class="inline" style="justify-content:space-between"><h3>Billboard · ' + esc(b.name) + '</h3><button class="btn sm ghost" id="close-board" data-closeboard="1">Close</button></div>' +
      '<p class="note">' + (paid.length ? '<span class="onair">ON AIR</span> ' + paid.length + ' ad' + (paid.length === 1 ? '' : 's') + ' take turns, 15 s each.' : 'No paid ads right now, so it shows public-service messages.') + '</p>' +
      '<div class="ads">' + ads.map(function (a) {
        var who = a.sponsored ? 'Sponsored' : a.psa ? 'Public service' : (a.by === online.me ? 'Your ad' : ((online.names[a.by] && online.names[a.by].name) || 'A Lagosian'));
        var left = a.until ? Math.max(1, Math.round((a.until - Date.now()) / 3600e3)) + 'h left' : '';
        return '<div class="ad-card">' + adPreview(a, true) + '<div class="meta"><span>' + esc(who) + '</span>' + (left ? '<span>' + left + '</span>' : '') +
          (a.url ? '<a class="btn sm ghost" href="' + esc(a.url) + '" target="_blank" rel="noopener sponsored">Visit</a>' : '') + '</div></div>';
      }).join('') + '</div>';
    html += composerView(b, paid);
    return html;
  }

  function composerView(b, paid) {
    var cost = L.boardRent(S), mine = myAd(), others = paid.filter(function (a) { return !a.sponsored && a.by !== online.me; }).length;
    var html = '<div class="section"><h3>Put your ad here</h3>';
    if (!online.db || !online.me) return html + '<p class="note">Billboards are shared with everyone you share Lasgidi with. They work when the game is opened on claude.ai.</p></div>';
    if (online.canWrite === false) return html + '<p class="note">You can see the boards but not post. Ask the owner for Contributor access.</p></div>';
    if (others >= 3) return html + '<p class="note">This board is full. Try another one.</p></div>';
    var ad = ui.ad, slogans = L.adSlogans(S);
    if (!slogans.some(function (x) { return x.code === ad.slogan; })) ad.slogan = slogans[0].code;
    var preview = { emoji: D.AD_EMOJI[ad.emoji], text: L.sloganText(ad.slogan), color: D.AD_COLORS[ad.color] };
    html += '<p class="note">Pick an emoji, a slogan and a colour. ' + naira(cost) + ' in-game naira for 24 real hours. You can have one ad up at a time' + (mine ? '; posting here replaces your ad at ' + esc(D.BILLBOARDS.filter(function (x) { return x.id === mine.board; })[0].name) : '') + '.</p>' +
      adPreview(preview, true) +
      '<div class="pick" role="group" aria-label="Emoji">' + D.AD_EMOJI.map(function (e, i) { return '<button type="button" class="pick-e' + (i === ad.emoji ? ' on' : '') + '" id="ade-' + i + '" data-ademoji="' + i + '" aria-pressed="' + (i === ad.emoji) + '">' + e + '</button>'; }).join('') + '</div>' +
      '<label class="label" for="ad-slogan">Slogan</label><select id="ad-slogan" data-adslogan="1">' + slogans.map(function (x) { return '<option value="' + esc(x.code) + '"' + (x.code === ad.slogan ? ' selected' : '') + '>' + esc(x.text) + '</option>'; }).join('') + '</select>' +
      '<div class="pick" role="group" aria-label="Colour">' + D.AD_COLORS.map(function (c, i) { return '<button type="button" class="pick-c' + (i === ad.color ? ' on' : '') + '" id="adc-' + i + '" data-adcolor="' + i + '" aria-pressed="' + (i === ad.color) + '" aria-label="Colour ' + (i + 1) + '" style="background:' + c.bg + ';color:' + c.fg + '">Aa</button>'; }).join('') + '</div>' +
      '<div class="inline"><button class="btn go" id="ad-post" data-adpost="' + b.id + '"' + (S.cash + S.bank < cost || S.over ? ' disabled' : '') + '>Rent this board · ' + naira(cost) + '</button>' +
      (S.cash + S.bank < cost ? '<span class="why">You need ' + naira(cost - S.cash - S.bank) + ' more.</span>' : '') +
      (online.status ? '<span class="note">' + esc(online.status) + '</span>' : '') + '</div>';
    return html + '</div>';
  }
  function naira(n) { return N(n); }

  function postAd(boardId) {
    var res = L.rentBoard(S, boardId);
    if (!res.ok) return Promise.resolve(res);
    var ad = ui.ad;
    return online.db.doc('ads/' + online.me).set({ board: boardId, emoji: ad.emoji, slogan: ad.slogan, color: ad.color, at: Date.now(), until: Date.now() + 24 * 3600e3 })
      .then(function () { return res; }, function (err) {
        return { ok: false, msg: err && err.code === 'invalid_argument' ? 'Paid, but the board refused the ad: you need Contributor access.' : 'Paid, but the ad could not be posted. Try again in a moment.' };
      });
  }

  /* ---------- Home tab: interior, shop, garage ---------- */
  var interior = null;
  function mountInterior() {
    if (!S || ui.tab !== 'home' || !window.LasgidiInterior) return;
    var slot = document.querySelector('.tab-body .iv-slot');
    if (!slot) return;
    if (!interior) interior = window.LasgidiInterior.create({
      onSelect: function (i) { ui.itemSel = i; render(); },
      onPlace: function (i, x, y, r) { run(function () { var res = L.placeItem(S, i, x, y, r); if (res.ok) ui.itemSel = i; return res.ok ? { ok: true, msg: '' } : res; }); }
    });
    slot.appendChild(interior.el);
    var h = L.homeDef(S);
    interior.update({ size: L.roomSize(S), type: h.type || 'room', name: h.name, items: S.items, vehicles: S.vehicles, sel: ui.itemSel, power: S.power, hour: L.hour(S),
      dark: document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) });
  }
  var FX_NAMES = { sleep: 'sleep', power: 'light', gen: 'gen cost', fun: 'enjoyment', stress: 'stress', social: 'social', hunger: 'belle', energy: 'energy' };
  function fxText(f) {
    var parts = [];
    Object.keys(f.fx || {}).forEach(function (k) {
      var v = f.fx[k];
      if (k === 'sleep' || k === 'power') parts.push('+' + Math.round(v * 100) + '% ' + FX_NAMES[k]);
      else if (k === 'gen') parts.push('−' + Math.round(v * 100) + '% gen cost');
      else parts.push((v > 0 ? '+' : '') + v + ' ' + FX_NAMES[k] + '/day');
    });
    if (f.needsPower) parts.push('needs light');
    if (f.status) parts.push('+' + f.status + ' status');
    return parts.join(' · ');
  }
  function freeSpot(i) {
    var sz = L.roomSize(S);
    for (var r = 0; r < 2; r++) for (var y = 0; y < sz[1]; y++) for (var x = 0; x < sz[0]; x++) if (L.fitsAt(S, i, x, y, r)) return { x: x, y: y, r: r };
    return null;
  }
  function houseTab() {
    var h = L.homeDef(S), sz = L.roomSize(S), sel = ui.itemSel != null ? S.items[ui.itemSel] : null;
    var html = '<div class="panel-h"><h2>' + esc(h.name) + '</h2><span class="muted">' + esc(D.HOME_TYPES[h.type || 'room'].name) + ' · ' + sz[0] + '×' + sz[1] + ' floor</span></div><div class="panel-b">';
    html += '<div class="iv-slot"></div>';
    if (sel) {
      var f = D.FURNITURE[sel.id];
      html += '<div class="iv-bar"><span><b>' + f.icon + ' ' + esc(f.name) + '</b> <span class="muted">' + esc(fxText(f)) + '</span></span><span class="inline">' +
        (sel.x != null ? '<button class="btn sm" id="i-rot" data-irot="1">Rotate</button><button class="btn sm ghost" id="i-store" data-istore="1">Store</button>' : '<button class="btn sm" id="i-place" data-iplace="' + ui.itemSel + '">Place</button>') +
        '<button class="btn sm ghost" id="i-sell" data-isell="1">Sell (40%)</button><button class="btn sm ghost" id="i-done" data-idone="1">Done</button></span></div>';
    } else html += '<p class="note">Tap a piece to select it, then tap the floor or drag to move it.</p>';
    var light = Math.round(Math.min(0.98, h.power + L.furniturePower(S)) * 100);
    var daily = L.furnitureDaily(S);
    html += '<div class="section"><h3>How your home works</h3><dl class="kv"><dt>Sleep quality</dt><dd class="num">' + Math.round((h.sleep + L.furnitureSleep(S)) * 100) + '%</dd><dt>Light</dt><dd class="num">' + light + '% of the time</dd>' +
      '<dt>Gen fuel</dt><dd class="num">' + N(Math.round(1500 * S.econ.fuel * S.econ.infl * (1 - L.furnitureGen(S)) / 50) * 50) + ' per use</dd>' +
      '<dt>Every day</dt><dd>' + (daily ? esc(Object.keys(daily).map(function (k) { return (daily[k] > 0 ? '+' : '') + daily[k] + ' ' + FX_NAMES[k]; }).join(', ')) : 'Nothing yet') + '</dd>' +
      '<dt>Status</dt><dd class="num">' + L.statusPoints(S) + '</dd></dl></div>';
    var stored = S.items.map(function (it, i) { return { it: it, i: i }; }).filter(function (o) { return o.it.x == null; });
    if (stored.length) html += '<div class="section"><h3>In storage</h3><div class="list">' + stored.map(function (o) {
      var f = D.FURNITURE[o.it.id];
      return '<div class="item"><div><h3>' + f.icon + ' ' + esc(f.name) + '</h3><div class="meta"><span>' + f.w + '×' + f.d + '</span></div></div><span class="inline"><button class="btn sm" id="iplace-' + o.i + '" data-iplace="' + o.i + '">Place</button></span></div>';
    }).join('') + '</div></div>';
    // Furniture shop.
    var cats = []; Object.keys(D.FURNITURE).forEach(function (k) { if (cats.indexOf(D.FURNITURE[k].cat) < 0) cats.push(D.FURNITURE[k].cat); });
    var cat = ui.shopCat && cats.indexOf(ui.shopCat) >= 0 ? ui.shopCat : cats[0];
    html += '<div class="section"><h3>Furniture shop</h3><div class="pg-chips" style="padding:0">' + cats.map(function (c) { return '<button type="button" class="pg-chip' + (c === cat ? ' sel' : '') + '" id="shop-' + c.replace(/\W+/g, '') + '" data-shopcat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div><div class="list">' +
      Object.keys(D.FURNITURE).filter(function (k) { return D.FURNITURE[k].cat === cat; }).map(function (k) {
        var f = D.FURNITURE[k], p = L.price(S, f.price), owned = S.items.filter(function (it) { return it.id === k; }).length;
        return '<div class="item"><div><h3>' + f.icon + ' ' + esc(f.name) + (owned ? ' <span class="muted">· own ' + owned + '</span>' : '') + '</h3><div class="meta"><span class="cost num">' + N(p) + '</span><span>' + f.w + '×' + f.d + '</span><span>' + esc(fxText(f)) + '</span></div></div>' +
          '<button class="btn sm" id="buyi-' + k + '" data-buyitem="' + k + '"' + (S.cash + S.bank >= p ? '' : ' disabled') + '>Buy</button></div>';
      }).join('') + '</div></div>';
    // Garage and hangar.
    html += '<div class="section"><h3>Garage and hangar</h3>';
    if (S.vehicles.length) html += '<div class="list">' + S.vehicles.map(function (v, i) {
      var V = D.VEHICLES[v.id];
      return '<div class="item"><div><h3>' + V.icon + ' ' + esc(V.name) + '</h3><div class="meta"><span>Upkeep ' + N(L.price(S, V.upkeep)) + '/week</span><span>+' + V.status + ' status</span></div></div><button class="btn sm ghost" id="sellv-' + i + '" data-sellveh="' + i + '">Sell (50%)</button></div>';
    }).join('') + '</div>';
    else html += '<p class="note">' + (S.car ? 'You drive the ' + esc(D.CAR.name) + '. ' : '') + 'Cars drive you faster than danfo; a boat uses the jetties; a helicopter flies anywhere in minutes. Everything has weekly upkeep.</p>';
    var kinds = [['car', 'Cars'], ['boat', 'Boats'], ['heli', 'Helicopters'], ['jet', 'Jets']];
    var kind = ui.vehKind || 'car';
    html += '<div class="pg-chips" style="padding:0">' + kinds.map(function (k) { return '<button type="button" class="pg-chip' + (k[0] === kind ? ' sel' : '') + '" id="vk-' + k[0] + '" data-vehkind="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div><div class="list">' +
      Object.keys(D.VEHICLES).filter(function (k) { return D.VEHICLES[k].kind === kind; }).map(function (k) {
        var V = D.VEHICLES[k], p = L.price(S, V.price);
        var what = V.kind === 'car' ? 'Top speed ' + V.speed + ' km/h on clear roads' : V.kind === 'boat' ? 'Use the jetties without waiting' : V.kind === 'heli' ? 'Anywhere in Lagos in about 30 minutes, ' + N(L.price(S, V.trip)) + ' a trip' : 'Weekends abroad from the airport';
        return '<div class="item"><div><h3>' + V.icon + ' ' + esc(V.name) + '</h3><div class="meta"><span class="cost num">' + N(p) + '</span><span>' + esc(what) + '</span><span>Upkeep ' + N(L.price(S, V.upkeep)) + '/wk</span><span>+' + V.status + ' status</span></div></div>' +
          '<button class="btn sm" id="buyv-' + k + '" data-buyveh="' + k + '"' + (S.cash + S.bank >= p ? '' : ' disabled') + '>Buy</button></div>';
      }).join('') + '</div></div>';
    return html + '</div>';
  }

  /* ---------- homes and the Mainland Estate ---------- */
  function clearPicks() { ui.sel = null; ui.place = null; ui.board = null; ui.homeSel = null; ui.plotSel = null; online.status = ''; }
  function marketHomes() {
    return Object.keys(D.HOMES).filter(function (k) { var h = D.HOMES[k]; return !h.hidden && (!h.owned || L.ownsHome(S, k)); })
      .sort(function (a, b) { return D.HOMES[a].rent - D.HOMES[b].rent; });
  }
  function residentCounts() {
    var m = {};
    (online.residents || []).forEach(function (r) { if (r.id !== online.me && D.HOMES[r.home]) m[r.home] = (m[r.home] || 0) + 1; });
    return m;
  }
  // Each plot belongs to whoever claimed it first in the shared store.
  function plotOwnersById() {
    var m = {};
    (online.plots || []).slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (p) {
      if (p.plot >= 0 && p.plot < L.plotCount() && !L.plotTakenByNpc(p.plot) && !m[p.plot]) m[p.plot] = p.id;
    });
    return m;
  }
  function plotOwners() {
    var m = {}, by = plotOwnersById();
    Object.keys(by).forEach(function (n) { if (by[n] !== online.me) m[n] = 1; });
    return m;
  }
  function firstFreePlot() {
    var by = plotOwnersById();
    for (var n = 0; n < L.plotCount(); n++) if (!L.plotTakenByNpc(n) && !by[n]) return n;
    return 0;
  }
  function homeView(id) {
    var h = D.HOMES[id];
    if (!h) return '';
    var c = L.moveInCost(S, id), here = S.home === id, n = residentCounts()[id] || 0;
    var names = (online.residents || []).filter(function (r) { return r.home === id && r.id !== online.me; }).slice(0, 4)
      .map(function (r) { return (online.names[r.id] && online.names[r.id].name) || 'A Lagosian'; });
    var why = here ? 'You live here' : S.arrears ? 'Clear your rent arrears first' : (h.owned && !L.ownsHome(S, id)) ? 'Buy a plot first' : (S.cash + S.bank < c.total) ? 'Move-in needs ' + N(c.total) : null;
    return '<div class="inline" style="justify-content:space-between"><h3>' + esc(h.name) + '</h3><button class="btn sm ghost" id="close-home" data-closepick="1">Close</button></div>' +
      '<p class="note"><b>' + esc(D.HOME_TYPES[h.type].name) + '</b> · ' + esc(D.DISTRICTS[h.district].name) + (n ? ' · <span class="gain">' + n + ' Lagosian' + (n === 1 ? '' : 's') + ' live here' + (names.length ? ': ' + esc(names.join(', ')) : '') + '</span>' : '') + '</p>' +
      (h.perk ? '<p>' + esc(h.perk) + '</p>' : '') +
      '<dl class="kv"><dt>Rent</dt><dd class="num">' + (h.owned ? 'None, you own it' : N(c.rent) + ' a week') + '</dd><dt>Move-in</dt><dd class="num">' + (h.owned ? 'Free' : N(c.total) + ' (4 weeks + 10% agent fee)') + '</dd>' +
      '<dt>Light</dt><dd>' + Math.round(h.power * 100) + '% of the time</dd><dt>Sleep</dt><dd>' + (h.sleep >= 1.1 ? 'Excellent' : h.sleep >= 1 ? 'Good' : h.sleep >= 0.9 ? 'Fair' : 'Rough') + '</dd>' +
      (h.daily ? '<dt>Every day</dt><dd>' + Object.keys(h.daily).map(function (k) { return (h.daily[k] > 0 ? '+' : '') + h.daily[k] + ' ' + ({ stress: 'stress', social: 'social', fun: 'enjoyment' }[k] || k); }).join(', ') + '</dd>' : '') + '</dl>' +
      '<div class="inline"><button class="btn go" id="move-' + id + '" data-move="' + id + '"' + (why ? ' disabled' : '') + '>' + (here ? 'Your home' : 'Move here') + '</button>' + (why && !here ? '<span class="why">' + esc(why) + '</span>' : '') + '</div>';
  }
  function plotView(n) {
    var by = plotOwnersById(), owner = by[n], mine = L.myPlot(S) === n, npc = L.plotTakenByNpc(n);
    var cost = L.price(S, D.PROPERTIES[D.ESTATE.property].price);
    var html = '<div class="inline" style="justify-content:space-between"><h3>🏡 ' + esc(D.ESTATE.name) + ' · plot ' + (n + 1) + '</h3><button class="btn sm ghost" id="close-plot" data-closepick="1">Close</button></div>';
    if (mine) {
      return html + '<p>This is your house. No rent, no landlord, an estate transformer.</p><div class="inline">' +
        (S.home === D.ESTATE.home ? '<span class="gain">You live here.</span>' : '<button class="btn go" id="move-estate" data-move="' + D.ESTATE.home + '">Move in (free)</button>') + '</div>';
    }
    if (npc) return html + '<p class="note">A Lagosian family already lives here. Free plots show as empty pads.</p>';
    if (owner) return html + '<p class="note">Owned by ' + esc((online.names[owner] && online.names[owner].name) || 'another player') + '.</p>';
    var have = L.myPlot(S) != null;
    var why = have ? 'You already own plot ' + (L.myPlot(S) + 1) : (S.cash + S.bank < cost) ? 'You need ' + N(cost - S.cash - S.bank) + ' more' : null;
    return html + '<p>For sale: a two-storey house on its own plot, north of the Lagoon. Buy it and live rent-free; it counts towards the Landlord goal. One plot each.</p>' +
      '<dl class="kv"><dt>Price</dt><dd class="num">' + N(cost) + '</dd><dt>Rent</dt><dd>None</dd><dt>Light</dt><dd>65% (estate transformer)</dd></dl>' +
      '<div class="inline"><button class="btn go" id="buy-plot" data-buyplot="' + n + '"' + (why ? ' disabled' : '') + '>Buy plot ' + (n + 1) + '</button>' + (why ? '<span class="why">' + esc(why) + '</span>' : '') +
      (online.status ? '<span class="note">' + esc(online.status) + '</span>' : '') + '</div>';
  }
  function syncResidence() {
    if (!online.db || !online.me || !S || S.challenge) return;
    var key = S.home + ':' + L.myPlot(S);
    if (online.sentHome === key) return;
    online.sentHome = key;
    online.db.doc('residents/' + online.me).set({ home: S.home, at: Date.now() }).catch(function () {});
  }

  /* ---------- places ---------- */
  function placeView(id) {
    var pl = D.PLACES.filter(function (p) { return p.id === id; })[0];
    if (!pl) return '';
    var here = S.loc === pl.district, t = D.PLACE_TYPES[pl.type];
    var avail = here ? L.availableActions(S) : [];
    var rows = pl.acts.map(function (aid) {
      var a = here ? avail.filter(function (x) { return x.id === aid; })[0] : null;
      if (a) return actionRow(a);
      var def = (D.PLACE_ACTIONS[pl.district] || []).filter(function (x) { return x.id === aid; })[0];
      if (!def) return '';
      var meta = [dur(def.mins)];
      if (def.cost) meta.push('<span class="cost">' + N(L.price(S, def.cost)) + '</span>');
      if (def.earn) meta.push('<span class="gain">earns</span>');
      if (def.when) meta.push(esc(whenText(def.when)));
      return '<div class="item"><div><h3>' + esc(def.label) + '</h3><div class="meta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div></div></div>';
    }).join('');
    return '<div class="inline" style="justify-content:space-between"><h3><span class="pl-ic" style="border-color:' + t.color + '">' + (pl.icon || '•') + '</span> ' + esc(pl.name) + '</h3><button class="btn sm ghost" id="close-place" data-closeplace="1">Close</button></div>' +
      '<p class="note"><span class="pl-type" style="color:' + t.color + '">' + esc(t.name) + '</span> · ' + esc(D.DISTRICTS[pl.district].name) + '</p><p>' + esc(pl.text) + '</p>' +
      (rows ? '<div class="list">' + rows + '</div>' : '') +
      (here ? '' : '<div class="inline"><button class="btn go" id="trip-' + pl.district + '" data-tripto="' + pl.district + '">Plan a trip to ' + esc(D.DISTRICTS[pl.district].name) + '</button></div>');
  }
  function whenText(w) {
    var parts = [];
    if (w.days) parts.push(w.days.map(function (d) { return D.DAYS[d]; }).join('/'));
    if (w.from != null) parts.push(String(w.from).padStart(2, '0') + ':00–' + String(w.to).padStart(2, '0') + ':00');
    return parts.join(' ');
  }
  function mountPlayground() {
    if (!S || !window.LasgidiPlayground) return;
    var narrow = window.matchMedia && window.matchMedia('(max-width: 899px)').matches;
    var slot = document.querySelector(narrow ? '.tab-body .pg-slot' : '.map-panel .pg-slot');
    if (!slot) return;
    if (!playground) playground = window.LasgidiPlayground.create({
      onSelect: function (k) { ui.sel = k === S.loc ? null : k; ui.place = null; ui.board = null; render(); },
      onSelectPlace: function (id) { clearPicks(); ui.place = id; render(); },
      onSelectBoard: function (id) { clearPicks(); ui.board = id; render(); },
      onSelectHome: function (id) { clearPicks(); ui.homeSel = id; render(); },
      onSelectPlot: function (n) { clearPicks(); ui.plotSel = n; render(); }
    });
    slot.appendChild(playground.el);
    playground.update(sceneFor());
  }

  function placeFilters() {
    var cats = Object.keys(D.PLACE_TYPES);
    var html = '<div class="pg-chips" role="group" aria-label="Show places"><span class="label">Places</span>' +
      '<button type="button" class="pg-chip' + (!ui.placeCat ? ' sel' : '') + '" id="pc-all" data-placecat="">All</button>' +
      cats.map(function (c) { return '<button type="button" class="pg-chip' + (ui.placeCat === c ? ' sel' : '') + '" id="pc-' + c + '" data-placecat="' + c + '"><i class="sw" style="background:' + D.PLACE_TYPES[c].color + '"></i>' + esc(D.PLACE_TYPES[c].name) + '</button>'; }).join('') +
      '<button type="button" class="pg-chip' + (ui.placeCat === 'boards' ? ' sel' : '') + '" id="pc-boards" data-placecat="boards">📣 Billboards</button>' +
      '<button type="button" class="pg-chip' + (ui.placeCat === 'homes' ? ' sel' : '') + '" id="pc-homes" data-placecat="homes">🏠 Homes</button></div>';
    if (ui.placeCat === 'homes') {
      html += '<div class="pg-chips">' + marketHomes().map(function (k) {
        var h = D.HOMES[k];
        return '<button type="button" class="pg-chip' + (ui.homeSel === k ? ' sel' : '') + (S.home === k ? ' here' : '') + '" id="hm-' + k + '" data-homesel="' + k + '">' + esc(h.name) + ' <span class="num">· ' + N(L.price(S, h.rent)) + '/wk</span></button>';
      }).join('') + '<button type="button" class="pg-chip" id="hm-estate" data-plotsel="' + (L.myPlot(S) != null ? L.myPlot(S) : firstFreePlot()) + '">🏡 ' + esc(D.ESTATE.name) + ' plots</button></div>';
    } else if (ui.placeCat === 'boards') {
      html += '<div class="pg-chips">' + D.BILLBOARDS.map(function (b) {
        var n = paidAds(b.id).length + sponsoredAds(b.id).length;
        return '<button type="button" class="pg-chip' + (ui.board === b.id ? ' sel' : '') + '" id="bb-' + b.id + '" data-boardsel="' + b.id + '">' + esc(b.name) + (n ? ' <span class="onair">' + n + '</span>' : '') + '</button>';
      }).join('') + '</div>';
    } else if (ui.placeCat) {
      html += '<div class="pg-chips">' + D.PLACES.filter(function (p) { return p.type === ui.placeCat; }).map(function (p) {
        return '<button type="button" class="pg-chip' + (ui.place === p.id ? ' sel' : '') + '" id="pl-' + p.id + '" data-place="' + p.id + '">' + (p.icon || '') + ' ' + esc(p.name) + '</button>';
      }).join('') + '</div>';
    }
    return html;
  }

  function mapBlock() {
    var d = D.DISTRICTS[S.loc];
    var chips = '<div class="pg-chips" role="group" aria-label="Districts">' + Object.keys(D.DISTRICTS).map(function (k) {
      var here = k === S.loc, sel = k === ui.sel;
      return '<button type="button" class="pg-chip' + (here ? ' here' : '') + (sel ? ' sel' : '') + '" id="go-' + k + '" data-go="' + k + '"' + (here ? ' aria-current="true"' : '') + '>' + esc(D.DISTRICTS[k].name) +
        (online.peers[k] ? ' <span class="num">· ' + online.peers[k] + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    return '<div class="panel-h"><h2>' + esc(d.name) + '</h2><span class="label">' + (d.side === 'island' ? 'Island' : 'Mainland') + '</span></div>' +
      '<div class="pg-slot"></div>' + placeFilters() + chips +
      '<div class="legend"><span>Road</span><span class="ferry">Ferry</span><span class="muted">BRT: Ikorodu, Ikeja, Oshodi, Yaba, Lagos Island</span></div>' +
      '<div class="where">' + (ui.sel && ui.sel !== S.loc ? travelView(ui.sel) + (ui.place ? '<p class="note">Heading for ' + esc(D.PLACES.filter(function (p) { return p.id === ui.place; })[0].name) + '.</p>' : '')
        : ui.place ? placeView(ui.place) : ui.board ? boardView(ui.board) : ui.homeSel ? homeView(ui.homeSel) : ui.plotSel != null ? plotView(ui.plotSel)
        : '<p>' + esc(d.blurb) + ' Tap a district, a place, a home or a billboard.</p>') + '</div>';
  }

  function travelView(dest) {
    var opts = L.travelOptions(S, dest);
    var km = opts.length ? opts[0].km : 0;
    var rows = opts.filter(function (o) { return !(o.mode === 'car' && !S.car); }).map(function (o) {
      var meta = dur(o.mins) + ' · ' + (o.cost ? N(o.cost) : 'free') + (o.energy ? ' · −' + o.energy + ' energy' : '') + (o.traffic > 1.3 ? ' · go-slow ×' + o.traffic : '');
      return '<div class="mode' + (o.disabled ? ' dis' : '') + '"><b>' + esc(o.name) + '</b><div class="meta">' + (o.disabled ? esc(o.disabled) : meta) +
        (o.risk && !o.disabled ? '<em>' + esc(o.risk) + '</em>' : '') + '</div>' +
        '<button class="btn sm go" id="go-' + o.mode + '" data-travel="' + dest + '" data-mode="' + o.mode + '"' + (o.disabled ? ' disabled' : '') + '>Go</button></div>';
    }).join('');
    return '<div class="inline" style="justify-content:space-between"><h3>To ' + esc(D.DISTRICTS[dest].name) + ' <span class="muted num">· ' + km + ' km</span></h3>' +
      '<button class="btn sm ghost" id="clear-sel" data-clear-sel="1">Close</button></div>' +
      '<p>' + esc(D.DISTRICTS[dest].blurb) + '</p><div class="modes">' + rows + '</div>';
  }

  /* ---------- Do tab ---------- */
  function actionRow(a) {
    var meta = ['<span>' + dur(a.mins) + '</span>'];
    if (a.price) meta.push('<span class="cost">' + N(a.price) + (a.gen ? ' incl. gen' : '') + '</span>');
    if (a.earnEst) meta.push('<span class="gain">~' + N(a.earnEst) + '</span>');
    if (a.xp) meta.push('<span>' + Object.keys(a.xp).map(function (k) { return '+' + D.SKILLS[k]; }).join(' ') + '</span>');
    if (a.whenLabel) meta.push('<span>' + esc(a.whenLabel) + '</span>');
    if (a.late) meta.push('<span class="cost">Late: 30% docked</span>');
    if (a.collapseRisk && !a.disabled) meta.push('<span class="cost">' + esc(a.collapseRisk) + '</span>');
    return '<div class="item' + (a.isWork ? ' work' : '') + '"><div><h3>' + esc(a.label) + '</h3><div class="meta">' + meta.join('') + '</div>' +
      (a.disabled ? '<div class="why">' + esc(a.disabled) + '</div>' : '') + '</div>' +
      '<button class="btn' + (a.isWork ? ' go' : '') + '" id="act-' + a.id + '" data-act="' + a.id + '"' + (a.disabled ? ' disabled' : '') + '>' + (a.isWork ? 'Clock in' : 'Do') + '</button></div>';
  }

  function adviceView() {
    var tips = L.advise(S);
    if (!tips.length) return '';
    return '<section class="advice" aria-label="Suggestions"><span class="label">Wetin I go do?</span>' + tips.map(function (t, i) {
      var a = t.act, btn = '';
      if (a && a.type === 'act') btn = '<button class="btn sm go" id="adv-' + i + '" data-act="' + a.id + '">Do it</button>';
      if (a && a.type === 'travel') btn = '<button class="btn sm go" id="adv-' + i + '" data-travel="' + a.dest + '" data-mode="' + a.mode + '">Go</button>';
      if (a && a.type === 'apply') btn = '<button class="btn sm go" id="adv-' + i + '" data-apply="' + a.id + '">Apply</button>';
      if (a && a.type === 'move') btn = '<button class="btn sm go" id="adv-' + i + '" data-move="' + a.id + '">Move</button>';
      if (a && a.type === 'tab') btn = '<button class="btn sm ghost" id="adv-' + i + '" data-tab="' + a.id + '">Open ' + esc(a.id) + '</button>';
      return '<div class="tip ' + t.kind + '"><p>' + esc(t.text) + '</p>' + btn + '</div>';
    }).join('') + '</section>';
  }

  // Net worth by week: one series, so no legend; the heading names it.
  function sparkline(points, idBase) {
    if (!points || points.length < 2) return '<p class="note">Your net worth chart starts after your second full week.</p>';
    var W = 320, H = 96, P = { l: 4, r: 8, t: 10, b: 18 };
    var vals = points.map(function (p) { return p.worth; });
    var lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max.apply(null, vals);
    if (hi === lo) hi = lo + 1;
    var x = function (i) { return P.l + i / (points.length - 1) * (W - P.l - P.r); };
    var y = function (v) { return P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b); };
    var line = points.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(p.worth).toFixed(1); }).join('');
    var area = line + 'L' + x(points.length - 1).toFixed(1) + ',' + y(lo).toFixed(1) + 'L' + x(0).toFixed(1) + ',' + y(lo).toFixed(1) + 'Z';
    var last = points[points.length - 1];
    var hits = points.map(function (p, i) {
      var w = (W - P.l - P.r) / (points.length - 1);
      return '<rect x="' + (x(i) - w / 2).toFixed(1) + '" y="0" width="' + w.toFixed(1) + '" height="' + H + '" fill="transparent"><title>Week ' + p.w + ': ' + N(p.worth) + '</title></rect>';
    }).join('');
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="' + idBase + '-t"><title id="' + idBase + '-t">Net worth by week, from ' + N(points[0].worth) + ' in week ' + points[0].w + ' to ' + N(last.worth) + ' in week ' + last.w + '</title>' +
      '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>' +
      '<path d="' + area + '" fill="var(--lagoon)" opacity=".14"/>' +
      '<path d="' + line + '" fill="none" stroke="var(--lagoon)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + x(points.length - 1).toFixed(1) + '" cy="' + y(last.worth).toFixed(1) + '" r="4" fill="var(--lagoon)" stroke="var(--surface)" stroke-width="2"/>' +
      '<text x="' + P.l + '" y="' + (H - 4) + '" class="spark-l">Wk ' + points[0].w + '</text>' +
      '<text x="' + (W - P.r) + '" y="' + (H - 4) + '" text-anchor="end" class="spark-l">Wk ' + last.w + '</text>' +
      hits + '</svg>';
  }

  function catBars(obj, cls) {
    var keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; });
    if (!keys.length) return '<p class="note">Nothing this week.</p>';
    var max = obj[keys[0]];
    return '<div class="cats">' + keys.map(function (k) {
      return '<div class="cat"><span>' + esc(L.CATEGORY_NAMES[k] || k) + '</span><span class="cbar"><i class="' + cls + '" style="width:' + Math.max(2, Math.round(obj[k] / max * 100)) + '%"></i></span><span class="num">' + N(obj[k]) + '</span></div>';
    }).join('') + '</div>';
  }

  function shareBlock() {
    var text = L.shareText(S), enc = encodeURIComponent(text);
    return '<div class="share"><p class="sharetext" id="share-text">' + esc(text) + '</p><div class="inline">' +
      '<button class="btn sm" id="copy-share" data-copyshare="1">Copy</button>' +
      '<a class="btn sm ghost" href="https://x.com/intent/post?text=' + enc + '" target="_blank" rel="noopener">Post on X</a>' +
      '<a class="btn sm ghost" href="https://wa.me/?text=' + enc + '" target="_blank" rel="noopener">WhatsApp</a></div></div>';
  }

  function doView() {
    var acts = L.availableActions(S);
    var home = acts.filter(function (a) { return a.atHome; });
    var place = acts.filter(function (a) { return !a.atHome; });
    var d = D.DISTRICTS[S.loc];
    var html = '<div class="panel-h"><h2>In ' + esc(d.name) + '</h2><span class="muted">Sorted: open now first</span></div><div class="panel-b">' + adviceView();
    var sortOpen = function (a, b) { return (a.disabled ? 1 : 0) - (b.disabled ? 1 : 0); };
    html += '<div class="list">' + place.sort(sortOpen).map(actionRow).join('') + '</div>';
    if (home.length) html += '<div class="section"><h3>At home · ' + esc(L.homeDef(S).name) + '</h3><div class="list">' + home.sort(sortOpen).map(actionRow).join('') + '</div></div>';
    else html += '<div class="section"><p class="note">Home is ' + esc(L.homeDef(S).name) + ' in ' + esc(D.DISTRICTS[L.homeDef(S).district].name) + '. Sleep, cook and bathe there.</p></div>';
    html += '<div class="section"><div class="inline"><button class="btn ghost" id="wait-1" data-wait="60">Wait 1 hour</button><span class="note">Pantry: ' + S.pantry + ' meals at home</span></div></div>';
    return html + '</div>';
  }

  /* ---------- Work tab ---------- */
  function workView() {
    var html = '<div class="panel-h"><h2>Work</h2><span class="muted">Shifts pay daily. Three no-shows and you are sacked.</span></div><div class="panel-b">';
    if (S.job) {
      var c = D.CAREERS[S.job.id], need = L.promotionNeeds(S);
      var skillLvl = L.skillLevel(S, c.skill);
      var avg = S.job.shifts ? S.job.perfSum / S.job.shifts : 0;
      html += '<div class="section" style="padding-top:0"><h3>' + esc(c.titles[S.job.level]) + ' · ' + esc(c.name) + '</h3>' +
        '<dl class="kv"><dt>Where</dt><dd>' + esc(D.DISTRICTS[c.district].name) + '</dd><dt>Shift</dt><dd class="num">' + pad(c.start) + ':00–' + pad(c.end) + ':00 · ' + c.days.map(function (d) { return D.DAYS[d]; }).join(' ') + '</dd>' +
        '<dt>Pay per shift</dt><dd class="num">' + N(Math.round(c.pay[S.job.level] * S.econ.wage / 50) * 50) + '</dd>' +
        '<dt>Strikes</dt><dd class="num">' + S.job.missed + ' / 3</dd>' +
        '<dt>Today\'s form</dt><dd class="num">' + Math.round(L.performance(S) * 100) + '%</dd></dl>';
      if (need) {
        html += '<p class="note">Next: ' + esc(c.titles[S.job.level + 1]) + '. Needs ' + need.shifts + ' shifts (' + S.job.shifts + ' done), ' + esc(need.skillName) + ' ' + need.skill + ' (you: ' + skillLvl + '), average form 55% (you: ' + Math.round(avg * 100) + '%).</p>' +
          '<div class="progress"><i style="width:' + Math.min(100, Math.round(S.job.shifts / need.shifts * 100)) + '%"></i></div>';
      } else html += '<p class="note">You are at the top of this ladder.</p>';
      html += '<div class="inline"><button class="btn ghost sm" id="quit-job" data-quit="1">Resign</button></div></div>';
    } else {
      html += '<p class="note">You have no job. Apply in person at the district where the job is.</p>';
    }
    html += '<div class="section"><h3>Careers</h3><div class="list">' + Object.keys(D.CAREERS).map(function (cid) {
      var c = D.CAREERS[cid], e = L.jobEligibility(S, cid), mine = S.job && S.job.id === cid;
      return '<div class="item"><div><h3>' + esc(c.titles[0]) + ' → ' + esc(c.titles[4]) + '</h3><div class="meta"><span>' + esc(c.name) + '</span><span>' + esc(D.DISTRICTS[c.district].name) + '</span><span class="num">' + pad(c.start) + '–' + pad(c.end) + '</span><span class="gain">' + N(c.pay[0]) + '–' + N(c.pay[4]) + '/shift</span><span>' + esc(D.SKILLS[c.skill]) + '</span></div>' +
        (!e.ok && !mine ? '<div class="why">' + esc(e.reason) + '</div>' : '') + (e.connect ? '<div class="meta gain">' + esc(D.NPCS[e.connect].name) + ' is your connect here</div>' : '') + '</div>' +
        '<button class="btn sm" id="apply-' + cid + '" data-apply="' + cid + '"' + (e.ok ? '' : ' disabled') + '>' + (mine ? 'Current' : 'Apply') + '</button></div>';
    }).join('') + '</div></div>';
    return html + '</div>';
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  /* ---------- Money tab ---------- */
  function moneyView() {
    var h = L.homeDef(S);
    var html = '<div class="panel-h"><h2>Money</h2><span class="muted">Net worth <b class="num">' + N(L.netWorth(S)) + '</b></span></div><div class="panel-b">';

    html += '<div class="section" style="padding-top:0"><h3>Bank</h3><p class="note">Savings earn 0.3% a week. Prices rise faster than that, so idle cash loses value.</p>' +
      '<div class="inline"><label class="label" for="amt">Amount (₦)</label><input id="amt" inputmode="numeric" placeholder="10000"><button class="btn sm" id="dep" data-bank="dep">Deposit</button><button class="btn sm ghost" id="wd" data-bank="wd">Withdraw</button></div></div>';

    html += '<div class="section"><h3>Rent · ' + esc(h.name) + '</h3><dl class="kv"><dt>Weekly rent</dt><dd class="num">' + N(S.rentRate) + '</dd><dt>Due</dt><dd>Saturdays 12:00</dd><dt>Arrears</dt><dd class="num ' + (S.arrears ? 'cost' : '') + '">' + N(S.arrears) + (S.rentLate ? ' · strike ' + S.rentLate + '/3' : '') + '</dd><dt>Light</dt><dd>' + Math.round(h.power * 100) + '% of the time</dd></dl>' +
      (S.arrears ? '<div class="inline"><button class="btn sm" id="pay-arrears" data-arrears="1">Pay arrears</button></div>' : '') +
      '<details><summary>Move house (4 weeks upfront + 10% agent fee)</summary><div class="list">' + marketHomes().map(function (k) {
        var hm = D.HOMES[k], c = L.moveInCost(S, k);
        return '<div class="item"><div><h3>' + esc(hm.name) + '</h3><div class="meta"><span class="num">' + N(c.rent) + '/week</span><span>Light ' + Math.round(hm.power * 100) + '%</span><span class="cost num">Move-in ' + N(c.total) + '</span></div></div>' +
          '<button class="btn sm" id="move-' + k + '" data-move="' + k + '"' + (k === S.home ? ' disabled' : '') + '>' + (k === S.home ? 'Home' : 'Move') + '</button></div>';
      }).join('') + '</div></details></div>';

    html += '<div class="section"><h3>Ajo (esusu)</h3>';
    if (S.ajo) html += '<p class="note">' + N(S.ajo.contrib) + ' a week with 5 others. Round ' + S.ajo.round + ' of 6. Your collection week: ' + S.ajo.slot + (S.ajo.received ? ' (collected)' : '') + '. Paid in: ' + N(S.ajo.paid) + '.</p>';
    else html += '<p class="note">Six people pay in every week; each week one person collects the pot, minus one share for the collector. Forced savings, with some trust risk.</p><div class="inline">' +
      L.AJO_SIZES.map(function (v) { return '<button class="btn sm ghost" id="ajo-' + v + '" data-ajo="' + v + '">' + N(v) + '/wk</button>'; }).join('') + '</div>';
    html += '</div>';

    html += '<div class="section"><h3>Loans</h3>' + (S.loans.length ? '<div class="list">' + S.loans.map(function (l, i) {
      return '<div class="item"><div><h3>' + esc(l.name) + '</h3><div class="meta"><span class="cost num">Owe ' + N(l.bal) + '</span>' + (l.rate ? '<span>' + Math.round(l.rate * 100) + '%/week</span>' : '') + '<span>' + (l.weeksLeft > 0 ? l.weeksLeft + ' weeks left' : 'Overdue') + '</span></div></div>' +
        '<button class="btn sm" id="repay-' + i + '" data-repay="' + i + '">Repay all</button></div>';
    }).join('') + '</div>' : '<p class="note">No debts.</p>') +
      '<div class="list">' + Object.keys(L.LOANS).map(function (k) {
        var lo = L.LOANS[k], max = L.loanLimit(S, k);
        return '<div class="item"><div><h3>' + esc(lo.name) + '</h3><div class="meta"><span>' + Math.round(lo.rate * 100) + '% a week</span><span>' + lo.weeks + ' weeks</span><span>' + (max ? 'Up to ' + N(max) : (k === 'coop' ? 'Needs a job and 10 shifts' : '')) + '</span>' +
          (k === 'app' ? '<span class="cost">Shames you to your contacts if late</span>' : '') + '</div></div>' +
          '<button class="btn sm ghost" id="loan-' + k + '" data-loan="' + k + '"' + (max ? '' : ' disabled') + '>Borrow amount</button></div>';
      }).join('') + '</div><p class="note">"Borrow amount" uses the figure in the Amount box above.</p></div>';

    html += '<div class="section"><h3>Businesses</h3><p class="note">Pay out daily at 18:00 after running costs. Not visited in 7 days? Staff will steal from you.</p>';
    if (S.businesses.length) html += '<div class="list">' + S.businesses.map(function (b, i) {
      var def = D.BUSINESSES[b.id], idle = L.day(S) - b.visit;
      return '<div class="item"><div><h3>' + esc(def.name) + '</h3><div class="meta"><span>Last visit ' + (idle ? idle + ' days ago' : 'today') + '</span>' + (idle > 7 ? '<span class="cost">Staff are stealing</span>' : '') + '</div></div><button class="btn sm ghost" id="sell-' + i + '" data-sellb="' + i + '">Sell (60%)</button></div>';
    }).join('') + '</div><div class="inline"><button class="btn sm" id="visit" data-visit="1">Check on businesses (2h)</button></div>';
    html += '<details><summary>Buy a business</summary><div class="list">' + Object.keys(D.BUSINESSES).map(function (k) {
      var b = D.BUSINESSES[k], p = L.price(S, b.price);
      return '<div class="item"><div><h3>' + esc(b.name) + '</h3><div class="meta"><span class="cost num">' + N(p) + '</span><span class="gain num">~' + N(Math.round(b.daily * S.econ.infl / 50) * 50) + '/day</span>' + (b.power ? '<span>Needs light</span>' : '') + (b.weekend ? '<span>Busy Fri–Sun</span>' : '') + (b.december ? '<span>Booms in December</span>' : '') + '</div></div>' +
        '<button class="btn sm" id="buyb-' + k + '" data-buyb="' + k + '"' + (S.cash + S.bank >= p ? '' : ' disabled') + '>Buy</button></div>';
    }).join('') + '</div></details></div>';

    html += '<div class="section"><h3>Property and car</h3>' + (S.properties.length ? '<ul class="note">' + S.properties.map(function (p) { return '<li>' + esc(D.PROPERTIES[p.id].name) + ' · worth ' + N(p.value) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="list">' + Object.keys(D.PROPERTIES).map(function (k) {
        var p = D.PROPERTIES[k], pr = L.price(S, p.price);
        return '<div class="item"><div><h3>' + esc(p.name) + '</h3><div class="meta"><span class="cost num">' + N(pr) + '</span>' + (p.weekly ? '<span class="gain num">' + N(p.weekly) + '/week from tenants</span>' : '<span>Appreciates ~1.2%/week</span>') + '</div></div>' +
          '<button class="btn sm" id="buyp-' + k + '" data-buyp="' + k + '"' + (S.cash + S.bank >= pr ? '' : ' disabled') + '>Buy</button></div>';
      }).join('') +
      '<div class="item"><div><h3>Cars, boats, helicopters and jets</h3><div class="meta"><span>' + (S.car ? esc(D.CAR.name) + ' owned · ' : '') + 'Your garage and hangar are on the Home tab</span></div></div><button class="btn sm" id="to-garage" data-tab="home">Open garage</button></div></div></div>';

    html += '<div class="section"><h3>Statement</h3><p class="note">Every naira in or out is a sealed line. Edited saves show up as tampered.</p><div class="stmt-wrap"><table class="stmt"><tbody>' +
      S.ledger.slice(0, 25).map(function (l) {
        return '<tr><td class="num muted">' + L.DATA.DAYS[Math.floor(l.t / 1440) % 7] + ' ' + pad(Math.floor(l.t % 1440 / 60)) + ':' + pad(l.t % 60) + '</td><td>' + esc(l.memo) + ' <span class="muted">· ' + l.acct + '</span></td><td class="n num ' + (l.amt > 0 ? 'gain' : 'cost') + '">' + (l.amt > 0 ? '+' : '') + N(l.amt) + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="seal">Seal ' + esc(S.ledgerHash) + ' · ' + S.ledgerCount + ' lines · ' + (L.verifyLedger(S) ? 'balances reconcile' : 'DOES NOT RECONCILE') + '</p></div>';
    return html + '</div>';
  }

  /* ---------- Me tab ---------- */
  function meView() {
    var gp = L.goalProgress(S), g = D.GOALS[S.goal];
    var html = '<div class="panel-h"><h2>' + esc(S.name) + '</h2><span class="muted">' + esc(D.ORIGINS[S.origin].name) + ' · ' + esc(D.HOMES[S.home].name) + '</span></div><div class="panel-b">';
    html += '<div class="section" style="padding-top:0"><h3>Goal: ' + esc(g.name) + (S.won ? ' · done' : '') + '</h3><p class="note">' + esc(g.text) + '</p>' +
      gp.parts.map(function (p) { return '<div><div class="inline" style="justify-content:space-between"><span>' + esc(p.label) + '</span><span class="num">' + Math.round(p.value * 100) + '%</span></div><div class="progress"><i style="width:' + Math.round(p.value * 100) + '%"></i></div></div>'; }).join('') + '</div>';
    html += '<div class="section"><h3>Net worth by week</h3>' + sparkline(S.history, 'me-spark') +
      (S.history.length ? '<details><summary>Show as table</summary><div class="stmt-wrap"><table class="stmt"><tbody>' + S.history.slice().reverse().map(function (h) { return '<tr><td>Week ' + h.w + '</td><td class="n num">' + N(h.worth) + '</td></tr>'; }).join('') + '</tbody></table></div></details>' : '') + '</div>';
    html += S.challenge ? weeklyMeView() : weeklyInviteView() + familyView();
    if (!S.challenge) html += fameView();
    var sum = L.lifeSummary(S), best = lives()[0];
    html += '<div class="section"><h3>Score so far: <span class="num">' + sum.score + '</span></h3><p class="note">Net worth ÷ ₦1,000, plus 10 a week survived, 50 an achievement, 40 a career level and 500 for your goal.' + (best ? ' Your best life scored ' + best.score + '.' : '') + '</p>' + (lives().length ? livesView(5) : '') + '</div>';
    html += '<div class="section"><h3>Share your life</h3>' + shareBlock() + '</div>';
    html += '<div class="section"><h3>Skills</h3><div class="skills">' + Object.keys(D.SKILLS).map(function (k) {
      var lvl = L.skillLevel(S, k), xp = S.skills[k], lo = D.SKILL_XP[lvl], hi = D.SKILL_XP[lvl + 1] || lo;
      var pct = hi > lo ? Math.round((xp - lo) / (hi - lo) * 100) : 100;
      return '<div><div class="inline" style="justify-content:space-between"><span>' + D.SKILLS[k] + '</span><span class="num">Lv ' + lvl + '</span></div><div class="progress"><i style="width:' + pct + '%"></i></div></div>';
    }).join('') + '</div></div>';
    html += '<div class="section"><h3>People</h3><p class="note">Gist with people where they hang out. At 60 they are your connect into their trade.</p><div class="list">' + Object.keys(D.NPCS).map(function (k) {
      var n = D.NPCS[k], f = S.friends[k];
      return '<div class="item"><div><h3>' + esc(n.name) + ' <span class="muted">· ' + esc(n.role) + '</span></h3><div class="meta"><span>' + esc(D.DISTRICTS[n.district].name) + '</span><span>' + esc(D.CAREERS[n.career].name) + ' connect at 60</span></div></div><span class="num">' + f.lvl + '/100</span></div>';
    }).join('') + '</div></div>';
    html += '<div class="section"><h3>Achievements</h3><div class="ach">' + Object.keys(L.ACHIEVEMENTS).map(function (k) {
      return '<div class="' + (S.ach[k] ? 'got' : 'not') + '">' + (S.ach[k] ? '✓ ' : '· ') + esc(L.ACHIEVEMENTS[k]) + '</div>';
    }).join('') + '</div></div>';
    html += '<div class="section"><h3>Save</h3><p class="note">The game saves in this browser. Copy the save code to move to another device.</p>' +
      '<div class="inline"><button class="btn sm" id="copy-save" data-copy="1">Copy save code</button><button class="btn sm ghost" id="new-game" data-new="1">New life</button></div>' +
      '<textarea id="save-code" readonly rows="3" style="width:100%" aria-label="Save code">' + esc(L.serialize(S)) + '</textarea>' +
      (ui.flash ? '<p class="note">' + esc(ui.flash) + '</p>' : '') + '</div>' +
      '<div class="section"><h3>Keyboard</h3><p class="note">Number keys switch tabs in the order shown (1 is Do). A runs the top suggestion. Tab and Enter work everywhere, including the map.</p></div>';
    return html + '</div>';
  }

  function gistView() {
    return '<div class="panel-h"><h2>Gist</h2><span class="muted">What is happening in your Lagos</span></div><div class="panel-b"><ul class="feed">' + S.log.map(function (l) {
      return '<li class="' + l.kind + '"><time>Wk ' + (Math.floor(l.t / 10080) + 1) + ' · ' + D.DAYS[Math.floor(l.t / 1440) % 7] + ' ' + pad(Math.floor(l.t % 1440 / 60)) + ':' + pad(l.t % 60) + '</time>' + esc(l.text) + '</li>';
    }).join('') + '</ul></div>';
  }

  /* ---------- modal for choice events ---------- */
  function modal() {
    if (S.over && !S.overSeen) {
      var text = L.challengeShareText(S).split('\n');
      return '<div class="scrim" role="dialog" aria-modal="true" aria-labelledby="ch-title"><div class="sheet"><span class="label">Weekly Lagos ' + esc(S.challenge.id) + ' · time up</span><h2 id="ch-title">' + N(L.netWorth(S)) + '</h2>' +
        '<p class="squares" aria-label="Net worth by week">' + text[1] + '</p>' +
        '<p>' + esc(D.ORIGINS[S.origin].name) + ', ' + esc(S.job ? D.CAREERS[S.job.id].titles[S.job.level] : 'job hunting') + '. Everyone played this same Lagos this week.</p>' +
        shareBlock() + '<h3>This week\'s board</h3>' + weeklyBoardView() +
        '<div class="opts"><button class="btn go" id="w-post" data-wpost="1">Post to this week\'s board</button>' + (online.wStatus ? '<p class="note">' + esc(online.wStatus) + '</p>' : '') +
        '<button class="btn ghost" id="w-life" data-wlife="1">Back to your life</button><button class="btn ghost" id="w-close" data-wclose="1">Look around</button></div></div></div>';
    }
    var ev = S.pending[0];
    if (ev) {
      return '<div class="scrim" role="dialog" aria-modal="true" aria-labelledby="ev-title"><div class="sheet"><span class="label">' + L.clockLabel(S) + ' · ' + esc(D.DISTRICTS[S.loc].name) + '</span><h2 id="ev-title">' + esc(ev.title) + '</h2><p>' + esc(ev.text) + '</p><div class="opts">' +
        ev.options.map(function (o, i) { return '<button class="btn' + (i === 0 ? ' go' : ' ghost') + '" id="choice-' + i + '" data-choice="' + i + '">' + esc(o) + '</button>'; }).join('') + '</div></div></div>';
    }
    var r = S.report;
    if (r && S.reportSeen !== r.w) {
      var spent = 0, made = 0;
      Object.keys(r.out).forEach(function (k) { spent += r.out[k]; });
      Object.keys(r.inc).forEach(function (k) { made += r.inc[k]; });
      return '<div class="scrim" role="dialog" aria-modal="true" aria-labelledby="rep-title"><div class="sheet"><span class="label">Weekly report card</span><h2 id="rep-title">Week ' + r.w + '</h2>' +
        '<dl class="kv"><dt>Net worth</dt><dd class="num">' + N(r.worth) + '</dd><dt>Change</dt><dd class="num ' + (r.delta >= 0 ? 'gain' : 'cost') + '">' + (r.delta >= 0 ? '+' : '') + N(r.delta) + '</dd><dt>Money in</dt><dd class="num">' + N(made) + '</dd><dt>Money out</dt><dd class="num">' + N(spent) + '</dd></dl>' +
        '<h3>Where it came from</h3>' + catBars(r.inc, 'in') + '<h3>Where it went</h3>' + catBars(r.out, 'out') +
        '<h3>Net worth by week</h3>' + sparkline(S.history, 'rep-spark') + shareBlock() +
        '<div class="opts"><button class="btn go" id="rep-ok" data-repok="1">On to week ' + (r.w + 1) + '</button></div></div></div>';
    }
    if (S.won && !S.wonSeen) {
      return '<div class="scrim" role="dialog" aria-modal="true" aria-labelledby="won-title"><div class="sheet"><span class="label">Goal complete</span><h2 id="won-title">' + esc(D.GOALS[S.won.goal].name) + '!</h2><p>' + esc(S.name) + ', you did it in ' + (L.week(S) + 1) + ' weeks. Net worth ' + N(L.netWorth(S)) + ', ' + S.stats.trips + ' trips, ' + S.stats.shifts + ' shifts.</p><div class="opts"><button class="btn go" id="won-ok" data-wonok="1">Keep playing</button></div></div></div>';
    }
    return '';
  }

  function livesView(limit) {
    var list = lives().slice(0, limit || 5);
    if (!list.length) return '';
    return '<div class="stmt-wrap"><table class="stmt lives"><thead><tr><th>Life</th><th>Ended as</th><th class="n">Weeks</th><th class="n">Net worth</th><th class="n">Score</th></tr></thead><tbody>' + list.map(function (l) {
      return '<tr><td>' + esc(l.name) + ' <span class="muted">· ' + esc(D.ORIGINS[l.origin] ? D.ORIGINS[l.origin].name : l.origin) + '</span>' + (l.won ? ' <span class="gain">✓ ' + esc(D.GOALS[l.goal].name) + '</span>' : '') + (l.tampered ? ' <span class="cost">edited save</span>' : '') + '</td><td>' + esc(l.title || 'Jobless') + '</td><td class="n num">' + l.weeks + '</td><td class="n num">' + N(l.worth) + '</td><td class="n num"><b>' + l.score + '</b></td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  /* ---------- intro / new game ---------- */
  function introView() {
    var goals = Object.keys(D.GOALS).map(function (k, i) {
      return '<div class="goal"><input type="radio" name="goal" id="goal-' + k + '" value="' + k + '"' + (i === 0 ? ' checked' : '') + '><label for="goal-' + k + '"><b>' + esc(D.GOALS[k].name) + '</b><span>' + esc(D.GOALS[k].text) + '</span></label></div>';
    }).join('');
    var o = ui.draftOrigin ? D.ORIGINS[ui.draftOrigin] : null;
    return '<div class="intro">' +
      '<h1>LASGIDI<span>Make it in Lagos. One week of rent at a time.</span></h1>' +
      '<p class="lede">Work, hustle, sleep through NEPA, take the danfo or the ferry, join an ajo, dodge the loan apps and the Ponzi schemes. Rent is due every Saturday at noon.</p>' +
      '<div class="field"><label class="label" for="pname">Your name</label><input id="pname" maxlength="24" value="Ade" autocomplete="off"></div>' +
      '<div class="field"><span class="label">Your goal</span><div class="goals">' + goals + '</div></div>' +
      '<div class="lottery"><span class="label">Birth lottery</span>' +
      (o ? '<b>' + esc(o.name) + '</b><p style="margin:0">' + esc(o.text) + '</p>' : '<p style="margin:0">Lagos decides where you start. The roll is random and happens once per life.</p>') +
      '<div class="odds"><span>LAPO Baby 50%</span><span>Ajepako 35%</span><span>Nepo Baby 15%</span></div>' +
      '<div class="inline">' + (o ? '<button class="btn go" id="start" data-start="1">Start life in ' + esc(D.DISTRICTS[D.HOMES[o.home].district].name) + '</button>' : '<button class="btn go" id="roll" data-roll="1">Roll the birth lottery</button>') + '</div></div>' +
      (lives().length ? '<div class="field"><span class="label">Your past lives · best scores</span>' + livesView(5) + '</div>' : '') +
      (online.db && online.fame.length ? '<div class="field">' + fameView().replace('<div class="section">', '<div>') + '</div>' : '') +
      '<div class="lottery weekly"><span class="label">Weekly Lagos ' + esc(thisWeek()) + '</span><b>Same Lagos for everybody</b><p style="margin:0">One shared seed this week: the same start, the same events. 4 weeks, highest net worth wins, and every run is replayed to check it.</p>' +
      '<div class="inline"><button class="btn go" id="w-play-intro" data-wplay="1">' + (weeklyRun() ? 'Resume this week\'s Lagos' : 'Play this week\'s Lagos') + '</button></div></div>' +
      '<details class="import"><summary>Continue from a save code</summary><textarea id="import-code" aria-label="Paste save code" placeholder="LSG1...."></textarea><div class="inline"><button class="btn sm" id="import" data-import="1">Load save</button><span class="note">' + esc(ui.importMsg) + '</span></div></details>' +
      '<p class="note">Lasgidi is a work of fiction. In-game naira has no real value and cannot be bought or cashed out.</p>' +
      '</div>';
  }

  function bindIntro() {
    var name = document.getElementById('pname');
    if (name && ui.draftName != null) name.value = ui.draftName;
    if (ui.draftGoal) { var g = document.getElementById('goal-' + ui.draftGoal); if (g) g.checked = true; }
  }

  function introState() {
    var name = document.getElementById('pname');
    var g = document.querySelector('input[name="goal"]:checked');
    ui.draftName = name ? name.value : 'Ade';
    ui.draftGoal = g ? g.value : 'japa';
  }

  /* ---------- events ---------- */
  function amount() {
    var el = document.getElementById('amt');
    return el ? parseInt(String(el.value).replace(/[^\d]/g, ''), 10) || 0 : 0;
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab],[data-go],[data-travel],[data-clear-sel],[data-act],[data-wait],[data-apply],[data-quit],[data-bank],[data-arrears],[data-move],[data-ajo],[data-loan],[data-repay],[data-buyb],[data-sellb],[data-visit],[data-buyp],[data-car],[data-choice],[data-copy],[data-new],[data-roll],[data-start],[data-import],[data-wonok],[data-repok],[data-copyshare],[data-sound],[data-postfame],[data-wed],[data-placecat],[data-place],[data-closeplace],[data-closeboard],[data-tripto],[data-ademoji],[data-adcolor],[data-adpost],[data-boardsel],[data-wplay],[data-wlife],[data-wclose],[data-wpost],[data-wrestart],[data-wresult],[data-homesel],[data-plotsel],[data-closepick],[data-buyplot],[data-irot],[data-istore],[data-isell],[data-idone],[data-iplace],[data-buyitem],[data-shopcat],[data-vehkind],[data-buyveh],[data-sellveh]');
    if (!t || t.disabled) return;
    var ds = t.dataset;
    if (ds.roll) {
      introState();
      ui.seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) | 0;
      ui.draftOrigin = L.newGame({ seed: ui.seed }).origin;
      render(); var st = document.getElementById('start'); if (st) st.focus();
      return;
    }
    if (ds.start) {
      introState();
      S = L.newGame({ name: ui.draftName.trim() || 'Ade', goal: ui.draftGoal, seed: ui.seed });
      ui.tab = 'do'; ui.sel = null; ui.draftOrigin = null;
      save(); render(); return;
    }
    if (ds.import) {
      try {
        var r = L.deserialize(document.getElementById('import-code').value);
        S = r.state;
        if (!r.tampered && S.replay) {
          var re = L.replayLife(S.replay);
          if (!re || re.ledgerHash !== S.ledgerHash) r.tampered = true;
        }
        if (r.tampered) { S.tampered = true; }
        ui.importMsg = ''; ui.flash = r.tampered ? 'This save was edited outside the game. It loads, but it is marked as tampered.' : 'Save loaded.';
        save(); render();
      } catch (err) { ui.importMsg = err.message; render(); }
      return;
    }
    if (ds.wplay) { introState(); playWeekly(false); return; }
    if (!S) return;
    if (ds.wlife) { backToLife(); return; }
    if (ds.wclose) { S.overSeen = true; save(); render(); return; }
    if (ds.wresult) { S.overSeen = false; render(); return; }
    if (ds.wrestart) {
      if (!ui.confirmRestart) { ui.confirmRestart = true; ui.flash = 'Tap "Restart this week" again to start this week\'s Lagos over.'; render(); return; }
      ui.confirmRestart = false; ui.flash = ''; playWeekly(true); return;
    }
    if (ds.wpost) { t.disabled = true; postWeekly().then(function (m) { online.wStatus = m; render(); }); return; }
    if (ds.tab) { ui.tab = ds.tab; ui.flash = ''; render(); return; }
    if (ds.go) { ui.sel = ds.go === S.loc ? null : ds.go; ui.place = null; ui.board = null; render(); return; }
    if (ds.placecat !== undefined) { ui.placeCat = ds.placecat || null; render(); return; }
    if (ds.place) { ui.place = ds.place; ui.board = null; ui.sel = null; render(); return; }
    if (ds.buyitem) { run(function () { var r = L.buyItem(S, ds.buyitem); if (r.ok) ui.itemSel = S.items.length - 1; return r; }); return; }
    if (ds.shopcat) { ui.shopCat = ds.shopcat; render(); return; }
    if (ds.vehkind) { ui.vehKind = ds.vehkind; render(); return; }
    if (ds.buyveh) { run(function () { return L.buyVehicle(S, ds.buyveh); }); return; }
    if (ds.sellveh !== undefined) { run(function () { return L.sellVehicle(S, +ds.sellveh); }); return; }
    if (ds.idone) { ui.itemSel = null; render(); return; }
    if (ds.irot) { var it0 = S.items[ui.itemSel]; run(function () { var r = L.placeItem(S, ui.itemSel, it0.x, it0.y, it0.r ? 0 : 1); return r.ok ? { ok: true, msg: 'Rotated.' } : { ok: false, msg: 'No room to rotate it here. Move it first.' }; }); return; }
    if (ds.istore) { run(function () { return L.storeItem(S, ui.itemSel); }); return; }
    if (ds.isell) { var si = ui.itemSel; ui.itemSel = null; run(function () { return L.sellItem(S, si); }); return; }
    if (ds.iplace !== undefined) {
      var pi = +ds.iplace, spot = freeSpot(pi);
      run(function () { if (!spot) return { ok: false, msg: 'There is no space for it. Store or sell something first.' }; ui.itemSel = pi; return L.placeItem(S, pi, spot.x, spot.y, spot.r); });
      return;
    }
    if (ds.homesel) { clearPicks(); ui.homeSel = ds.homesel; render(); return; }
    if (ds.plotsel !== undefined) { clearPicks(); ui.plotSel = +ds.plotsel; render(); return; }
    if (ds.closepick) { clearPicks(); render(); return; }
    if (ds.buyplot !== undefined) {
      var pn = +ds.buyplot, by = plotOwnersById();
      if (by[pn] && by[pn] !== online.me) { online.status = 'Someone just bought this plot. Pick another.'; render(); return; }
      run(function () {
        var r = L.buyPlot(S, pn);
        if (r.ok && online.db && online.me) online.db.doc('plots/' + online.me).set({ plot: pn, at: Date.now() }).catch(function () {});
        return r;
      });
      return;
    }
    if (ds.boardsel) { ui.board = ds.boardsel; ui.place = null; ui.sel = null; online.status = ''; render(); return; }
    if (ds.closeplace) { ui.place = null; render(); return; }
    if (ds.closeboard) { ui.board = null; online.status = ''; render(); return; }
    if (ds.tripto) { ui.sel = ds.tripto; render(); return; }
    if (ds.ademoji) { ui.ad.emoji = +ds.ademoji; render(); return; }
    if (ds.adcolor) { ui.ad.color = +ds.adcolor; render(); return; }
    if (ds.adpost) {
      t.disabled = true;
      postAd(ds.adpost).then(function (res) { online.status = res.msg; run(function () { return res; }); });
      return;
    }
    if (ds.clearSel) { ui.sel = null; render(); return; }
    if (ds.travel) { run(function () { var r = L.travel(S, ds.travel, ds.mode); if (r.ok) { ui.sel = null; if (ui.tab === 'map' && !ui.place) ui.tab = 'do'; } return r; }, 'travel'); return; }
    if (ds.act) { run(function () { return L.doAction(S, ds.act); }); return; }
    if (ds.wait) { run(function () { if (S.pending.length) return { ok: false, msg: 'Decide on the open event first.' }; return L.wait(S, 60); }); return; }
    if (ds.apply) { run(function () { return L.applyJob(S, ds.apply); }); return; }
    if (ds.quit) { run(function () { return L.quitJob(S); }); return; }
    if (ds.bank) { var a = amount(); run(function () { return ds.bank === 'dep' ? L.deposit(S, a) : L.withdraw(S, a); }); return; }
    if (ds.arrears) { run(function () { return L.payArrears(S); }); return; }
    if (ds.move) { run(function () { return L.moveHouse(S, ds.move); }); return; }
    if (ds.ajo) { run(function () { return L.joinAjo(S, +ds.ajo); }); return; }
    if (ds.loan) { var la = amount(); run(function () { return L.takeLoan(S, ds.loan, la); }); return; }
    if (ds.repay) { run(function () { var l = S.loans[+ds.repay]; return L.repayLoan(S, +ds.repay, l ? l.bal : 0); }); return; }
    if (ds.buyb) { run(function () { return L.buyBusiness(S, ds.buyb); }); return; }
    if (ds.sellb) { run(function () { return L.sellBusiness(S, +ds.sellb); }); return; }
    if (ds.visit) { run(function () { return L.visitBusinesses(S); }); return; }
    if (ds.buyp) { run(function () { return L.buyProperty(S, ds.buyp); }); return; }
    if (ds.car) { run(function () { return L.buyCar(S); }); return; }
    if (ds.choice) { run(function () { return L.resolveChoice(S, +ds.choice); }); return; }
    if (ds.wonok) { S.wonSeen = true; save(); render(); return; }
    if (ds.wed) { run(function () { return L.marry(S, ds.wed); }); return; }
    if (ds.postfame) {
      t.disabled = true;
      postFame(L.fameEntry(S)).then(function (msg) { online.status = msg || ''; render(); });
      return;
    }
    if (ds.sound) { prefs.sound = !prefs.sound; writeJSON(PREF_KEY, prefs); if (prefs.sound) { ctx(); play('credit'); } render(); return; }
    if (ds.repok) { S.reportSeen = S.report.w; save(); render(); return; }
    if (ds.copyshare) {
      var txt = L.shareText(S);
      try {
        navigator.clipboard.writeText(txt).then(function () { t.textContent = 'Copied'; }, function () { selectText('share-text'); });
      } catch (err) { selectText('share-text'); }
      return;
    }
    if (ds.copy) {
      var code = L.serialize(S), box = document.getElementById('save-code');
      var done = function (m) { ui.flash = m; render(); };
      try {
        navigator.clipboard.writeText(code).then(function () { done('Save code copied.'); }, function () { if (box) box.select(); ui.flash = 'Select the code below and copy it.'; });
      } catch (err) { if (box) box.select(); }
      return;
    }
    if (ds.new) {
      if (!ui.confirmNew) { ui.confirmNew = true; ui.flash = 'Tap "New life" again to end this life. It will be scored (' + L.lifeSummary(S).score + ' points) and kept in your hall of lives.'; render(); return; }
      ui.confirmNew = false; ui.flash = '';
      if (S.challenge) { backToLife(); return; }
      if (S && !S.tampered) postFame(L.fameEntry(S), true);
      archiveLife();
      S = null;
      try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
      render();
    }
  });

  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'ad-slogan') { ui.ad.slogan = e.target.value; render(); }
  });

  document.addEventListener('keydown', function (e) {
    if (S && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target.matches && e.target.matches('input, textarea, select'))) {
      var tabs = ['do', 'map', 'home', 'work', 'money', 'me', 'gist'];
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 6 && !document.querySelector('.scrim')) {
        var narrow = window.matchMedia('(max-width: 899px)').matches;
        var list = narrow ? tabs : tabs.filter(function (t) { return t !== 'map'; });
        if (list[n - 1]) { ui.tab = list[n - 1]; render(); var tb = document.getElementById('tab-' + ui.tab); if (tb) tb.focus(); e.preventDefault(); return; }
      }
      if ((e.key === 'a' || e.key === 'A') && !document.querySelector('.scrim')) {
        var b = document.querySelector('.advice button:not([disabled])');
        if (b) { b.click(); e.preventDefault(); return; }
      }
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-go]')) {
      e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });

  var lastNarrow = null;
  window.addEventListener('resize', function () {
    var n = window.matchMedia('(max-width: 899px)').matches;
    if (n !== lastNarrow) { lastNarrow = n; if (S) render(); }
  });

  /* ---------- boot ---------- */
  function selectText(id) {
    var el = document.getElementById(id);
    if (!el || !window.getSelection) return;
    var range = document.createRange(); range.selectNodeContents(el);
    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  }

  function start(data) {
    S = (data && data.state) ? L.migrate(data.state) : (prefs.mode === 'weekly' && weeklyRun()) || load(SAVE_KEY);
    if (data && data.ui) Object.assign(ui, data.ui, { toasts: [] });
    render();
    initOnline();
  }
  var hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(function () { return { state: S, ui: { tab: ui.tab, sel: ui.sel } }; });
  if (hot && hot.ready) hot.ready(start); else start(hot && hot.data ? hot.data : {});

  if ('serviceWorker' in navigator && /^https:|^http:\/\/localhost/.test(location.href) && !hot) {
    try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) { /* not available */ }
  }
})();
