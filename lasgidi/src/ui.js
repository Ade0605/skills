/* Lasgidi — browser UI. Renders the engine state; never changes money itself. */
(function () {
  'use strict';
  var L = window.Lasgidi, D = L.DATA, N = L.naira;
  var SAVE_KEY = 'lasgidi.save.v1';
  var app = document.getElementById('app');
  var ui = { tab: 'do', sel: null, toasts: [], draftOrigin: null, importMsg: '', flash: '' };
  var S = null;

  /* ---------- storage (best effort) ---------- */
  function save() {
    if (!S) return;
    try { localStorage.setItem(SAVE_KEY, L.serialize(S)); } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      var code = localStorage.getItem(SAVE_KEY);
      if (code) return L.deserialize(code).state;
    } catch (e) { /* ignore broken save */ }
    return null;
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
    if (focusId) { var f = document.getElementById(focusId); if (f) f.focus(); }
    syncPresence();
  }

  /* ---------- Lagos online: shared hall of fame and live presence ----------
   * Both light up only inside claude.ai; the game is complete without them.
   * No chat and no free text travel between players: presence carries a
   * district key, the board carries numbers. */
  var online = { db: null, user: null, room: null, me: null, fame: [], hidden: 0, names: {}, peers: {}, others: 0, canWrite: null, sentLoc: null, status: '' };

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
      db.collection('fame').orderBy('score', 'desc').limit(60).onSnapshot(function (snap) {
        var rows = [], hidden = 0;
        snap.docs.forEach(function (d) {
          var e = L.checkFame(d.data());
          if (e) rows.push(Object.assign(e, { id: d.id })); else hidden++;
        });
        rows.sort(function (a, b) { return b.score - a.score; });
        online.fame = rows; online.hidden = hidden;
        if (online.user && rows.length) {
          online.user.profiles(rows.map(function (r) { return r.id; })).then(function (ps) { online.names = ps; scheduleRender(); });
        }
        scheduleRender();
      }, function () { online.db = null; scheduleRender(); });
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

  function myFame() {
    for (var i = 0; i < online.fame.length; i++) if (online.fame[i].id === online.me) return online.fame[i];
    return null;
  }

  function postFame(entry, quiet) {
    if (!online.db || !online.me) return Promise.resolve(quiet ? null : 'The Hall of Fame is not available here.');
    if (S && S.tampered) return Promise.resolve('Edited saves cannot go on the Hall of Fame.');
    var mine = myFame();
    if (mine && mine.score >= entry.score) return Promise.resolve(quiet ? null : 'Your best on the board (' + mine.score + ') is higher. It stays.');
    return online.db.doc('fame/' + online.me).set(Object.assign({}, entry, { at: Date.now() }))
      .then(function () { return 'Posted ' + entry.score + ' points to the Hall of Fame.'; })
      .catch(function (err) {
        if (err && err.code === 'invalid_argument') { online.canWrite = false; return 'You can read the Hall of Fame but not post to it. Ask the owner for Contributor access.'; }
        return 'Could not post right now. Try again in a moment.';
      });
  }

  function fameView() {
    if (!online.db) return '';
    var rows = online.fame.slice(0, 10);
    var html = '<div class="section"><h3>Lagos Hall of Fame</h3><p class="note">Everyone this game is shared with. Each person\'s best life; scores are rebuilt from the numbers, never taken on trust.' +
      (online.hidden ? ' ' + online.hidden + ' implausible ' + (online.hidden === 1 ? 'entry is' : 'entries are') + ' hidden.' : '') + '</p>';
    if (!rows.length) html += '<p class="note">No one has posted yet. Post your life to be first.</p>';
    else html += '<div class="stmt-wrap"><table class="stmt lives"><thead><tr><th>#</th><th>Lagosian</th><th>Ended as</th><th class="n">Weeks</th><th class="n">Net worth</th><th class="n">Score</th></tr></thead><tbody>' + rows.map(function (r, i) {
      var p = online.names[r.id], mine = r.id === online.me;
      var who = mine ? 'You' : (p && p.name) || 'Someone';
      var title = r.career ? D.CAREERS[r.career].titles[r.level] : 'Jobless';
      return '<tr' + (mine ? ' class="me"' : '') + '><td class="num">' + (i + 1) + '</td><td>' + esc(who) + ' <span class="muted">· ' + esc(D.ORIGINS[r.origin].name) + '</span>' + (r.won ? ' <span class="gain">✓ ' + esc(D.GOALS[r.goal].name) + '</span>' : '') + '</td><td>' + esc(title) + '</td><td class="n num">' + r.weeks + '</td><td class="n num">' + N(r.worth) + '</td><td class="n num"><b>' + r.score + '</b></td></tr>';
    }).join('') + '</tbody></table></div>';
    if (S && online.me && online.canWrite !== false) html += '<div class="inline"><button class="btn sm" id="post-fame" data-postfame="1">Post this life (' + L.fameEntry(S).score + ')</button><span class="note">' + esc(online.status) + '</span></div>';
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
    var tabs = [['do', 'Do'], ['map', 'Map'], ['work', 'Work'], ['money', 'Money'], ['me', 'Me'], ['gist', 'Gist']];
    var debt = L.debts(S) > 0;
    var bar = '<div class="tabs" role="tablist">' + tabs.map(function (t) {
      return '<button class="tab' + (t[0] === 'map' ? ' tab-map' : '') + '" role="tab" id="tab-' + t[0] + '" data-tab="' + t[0] + '" aria-selected="' + (ui.tab === t[0]) + '">' + t[1] +
        (t[0] === 'money' && debt ? '<span class="dot" title="You owe money"></span>' : '') + '</button>';
    }).join('') + '</div>';
    var body = { do: doView, map: function () { return mapBlock(); }, work: workView, money: moneyView, me: meView, gist: gistView }[ui.tab]();
    return '<div class="board">' +
      '<section class="panel map-panel" aria-label="Map of Lagos">' + mapBlock() + '</section>' +
      '<section class="panel work-panel">' + bar + '<div class="tab-body">' + body + '</div></section></div>';
  }

  /* ---------- map ---------- */
  function px(d) { return { x: 14 + D.DISTRICTS[d].x * 10, y: 16 + D.DISTRICTS[d].y * 10 }; }
  function poly(pts) { return pts.map(function (p) { return (14 + p[0] * 10) + ',' + (16 + p[1] * 10); }).join(' '); }

  function mapBlock() {
    var lagoon = poly([[16.5, 6.5], [41, 6.5], [41.5, 19.5], [34, 21.2], [25, 19.6], [18.5, 19.2], [17, 17]]);
    var harbour = poly([[13.2, 19.6], [18.5, 19.2], [17.6, 20.4], [15, 20.2], [13.8, 24], [12.2, 27.6], [10.8, 27.6]]);
    var ocean = poly([[-1.4, 27.6], [41.5, 27.6], [41.5, 29], [-1.4, 29]]);
    var roads = D.ROADS.map(function (r) {
      var a = px(r[0]), b = px(r[1]);
      return '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" opacity=".55"/>';
    }).join('');
    var ferryPairs = [['ikorodu', 'island'], ['ikorodu', 'ikoyi'], ['island', 'lekki'], ['ikoyi', 'lekki']];
    var ferries = ferryPairs.map(function (r) {
      var a = px(r[0]), b = px(r[1]);
      return '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="var(--lagoon)" stroke-width="2" stroke-dasharray="5 4"/>';
    }).join('');
    var homeD = L.homeDef(S).district, jobD = S.job ? D.CAREERS[S.job.id].district : null;
    var nodes = Object.keys(D.DISTRICTS).map(function (k) {
      var p = px(k), here = k === S.loc, sel = k === ui.sel;
      var below = ['festac', 'surulere', 'vi', 'ajah', 'lekki', 'island'].indexOf(k) >= 0;
      var tags = [];
      if (k === homeD) tags.push('HOME');
      if (k === jobD) tags.push('WORK');
      var tagSvg = tags.map(function (t, i) {
        var w = t.length * 5.6 + 6, tx = p.x - 10 - w, ty = p.y - 5 + i * 13;
        if (tx < 2) tx = p.x + 10;
        return '<rect class="tagbg" x="' + tx + '" y="' + ty + '" width="' + w + '" height="11" rx="2"/><text class="tag" x="' + (tx + 3) + '" y="' + (ty + 8.5) + '">' + t + '</text>';
      }).join('');
      return '<g class="node' + (here ? ' here' : '') + (sel ? ' sel' : '') + '" data-go="' + k + '" tabindex="0" role="button" aria-label="' + esc(D.DISTRICTS[k].name) + (here ? ' (you are here)' : '') + '">' +
        (here ? '<circle class="ring" cx="' + p.x + '" cy="' + p.y + '" r="8"/>' : '') +
        '<circle class="dot" cx="' + p.x + '" cy="' + p.y + '" r="' + (here ? 8 : 6.5) + '"/>' +
        (online.peers[k] ? '<g class="peers" aria-hidden="true"><circle cx="' + (p.x + 9) + '" cy="' + (p.y + 7) + '" r="6.5"/><text x="' + (p.x + 9) + '" y="' + (p.y + 10) + '" text-anchor="middle">' + Math.min(99, online.peers[k]) + '</text></g>' : '') +
        '<circle cx="' + p.x + '" cy="' + p.y + '" r="16" fill="transparent"/>' +
        '<text x="' + p.x + '" y="' + (below ? p.y + 21 : p.y - 12) + '" text-anchor="middle">' + esc(D.DISTRICTS[k].name) + '</text>' + tagSvg + '</g>';
    }).join('');
    var svg = '<svg viewBox="0 0 430 310" role="group" aria-label="Lagos districts. Select one to plan a trip.">' +
      '<rect x="0" y="0" width="430" height="310" fill="var(--paper)"/>' +
      '<polygon points="' + lagoon + '" fill="var(--water)"/><polygon points="' + harbour + '" fill="var(--water)"/><polygon points="' + ocean + '" fill="var(--water)"/>' +
      '<text x="300" y="120" font-size="11" font-style="italic" fill="var(--lagoon)" text-anchor="middle">Lagos Lagoon</text>' +
      '<text x="215" y="303" font-size="11" font-style="italic" fill="var(--lagoon)" text-anchor="middle">Atlantic Ocean</text>' +
      roads + ferries + nodes + '</svg>';
    var d = D.DISTRICTS[S.loc];
    return '<div class="panel-h"><h2>' + esc(d.name) + '</h2><span class="label">' + (d.side === 'island' ? 'Island' : 'Mainland') + '</span></div>' +
      '<div class="map">' + svg + '</div>' +
      '<div class="legend"><span>Road</span><span class="ferry">Ferry</span><span class="muted">BRT: Ikorodu, Ikeja, Oshodi, Yaba, Lagos Island</span></div>' +
      '<div class="where">' + (ui.sel && ui.sel !== S.loc ? travelView(ui.sel) : '<p>' + esc(d.blurb) + ' Select a district to plan a trip.</p>') + '</div>';
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
      '<details><summary>Move house (4 weeks upfront + 10% agent fee)</summary><div class="list">' + Object.keys(D.HOMES).filter(function (k) { return !D.HOMES[k].hidden; }).map(function (k) {
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
      '<div class="item"><div><h3>' + esc(D.CAR.name) + '</h3><div class="meta"><span class="cost num">' + N(L.price(S, D.CAR.price)) + '</span><span>₦5,000/week upkeep, fuel per km</span></div></div><button class="btn sm" id="buy-car" data-car="1"' + (S.car || S.cash + S.bank < L.price(S, D.CAR.price) ? ' disabled' : '') + '>' + (S.car ? 'Owned' : 'Buy') + '</button></div></div></div>';

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
    html += fameView();
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
    var t = e.target.closest('[data-tab],[data-go],[data-travel],[data-clear-sel],[data-act],[data-wait],[data-apply],[data-quit],[data-bank],[data-arrears],[data-move],[data-ajo],[data-loan],[data-repay],[data-buyb],[data-sellb],[data-visit],[data-buyp],[data-car],[data-choice],[data-copy],[data-new],[data-roll],[data-start],[data-import],[data-wonok],[data-repok],[data-copyshare],[data-sound],[data-postfame]');
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
        S = r.state; if (r.tampered) { S.tampered = true; }
        ui.importMsg = ''; ui.flash = r.tampered ? 'This save was edited outside the game. It loads, but it is marked as tampered.' : 'Save loaded.';
        save(); render();
      } catch (err) { ui.importMsg = err.message; render(); }
      return;
    }
    if (!S) return;
    if (ds.tab) { ui.tab = ds.tab; ui.flash = ''; render(); return; }
    if (ds.go) { ui.sel = ds.go === S.loc ? null : ds.go; render(); return; }
    if (ds.clearSel) { ui.sel = null; render(); return; }
    if (ds.travel) { run(function () { var r = L.travel(S, ds.travel, ds.mode); if (r.ok) { ui.sel = null; if (ui.tab === 'map') ui.tab = 'do'; } return r; }, 'travel'); return; }
    if (ds.act) { run(function () { return L.doAction(S, ds.act); }); return; }
    if (ds.wait) { run(function () { if (S.pending.length) return { ok: false, msg: 'Decide on the open event first.' }; L._advance(S, 60); return { ok: true, msg: 'An hour passes.' }; }); return; }
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
      if (S && !S.tampered) postFame(L.fameEntry(S), true);
      archiveLife();
      S = null;
      try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
      render();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (S && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target.matches && e.target.matches('input, textarea, select'))) {
      var tabs = ['do', 'map', 'work', 'money', 'me', 'gist'];
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
    S = L.migrate((data && data.state) || load());
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
