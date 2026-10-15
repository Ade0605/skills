/* Lasgidi — browser UI. Renders the engine state; never changes money itself. */
(function () {
  'use strict';
  var L = window.Lasgidi, D = L.DATA, N = L.naira;
  var SAVE_KEY = 'lasgidi.save.v1', WEEKLY_KEY = 'lasgidi.weekly.v1';
  var app = document.getElementById('app');
  var ui = { tab: 'map', sel: null, place: null, placeCat: null, board: null, ad: { emoji: 0, slogan: 's0', color: 0, plan: 'day' }, toasts: [], draftOrigin: null, importMsg: '', flash: '' };
  var S = null;

  /* ---------- storage (best effort) ---------- */
  // Two slots: your life, and this week's Lagos. They never overwrite each other.
  function save() {
    if (!S) return;
    try { localStorage.setItem(S.challenge ? WEEKLY_KEY : SAVE_KEY, L.serialize(S)); } catch (e) { /* storage unavailable */ }
    publishHome();
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
    S = w; ui.tab = 'map'; ui.sel = null; ui.place = null; ui.board = null; online.wStatus = '';
    setMode('weekly'); save(); render(); subscribeWeekly();
  }
  function backToLife() {
    if (S) save();
    S = load(SAVE_KEY); ui.tab = 'map'; ui.sel = null; ui.place = null; ui.board = null;
    setMode('life'); render();
  }

  var LIVES_KEY = 'lasgidi.lives.v1', PREF_KEY = 'lasgidi.prefs.v1';
  function readJSON(k, fallback) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  var prefs = readJSON(PREF_KEY, { sound: false });
  function lives() { return readJSON(LIVES_KEY, []); }
  var HEIR_KEY = 'lasgidi.heir.v1';
  // The children who can carry the family on (an array; a single offer from v60 also reads).
  function heirsWaiting() {
    var h = readJSON(HEIR_KEY, null), list = Array.isArray(h) ? h : h ? [h] : [];
    return list.filter(function (x) { return x && typeof x.name === 'string' && typeof x.inherit === 'number'; });
  }
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
    S.alerts = []; nightReminders();
    if (ui.toasts.length > 4) ui.toasts = ui.toasts.slice(-4);
    save();
    render();
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(function () { ui.toasts = []; renderToasts(); }, 4200);
  }

  /* ---------- top-level render ---------- */
  /* ---------- settings: language, text size, lite mode ---------- */
  // Naija Pidgin for the interface chrome (tabs, app names, headings, buttons).
  // Whole text nodes are swapped after each render; story text stays in English.
  var PCM = {
    'Attend CDS': 'Go CDS', 'Certificate of National Service': 'NYSC certificate',
    // Newer features.
    '🎤 Interview': '🎤 Interview', 'Submit answers': 'Submit am', 'Not now': 'No be now', 'Sleep here': 'Sleep here', 'Book': 'Book am', 'Buy drugs': 'Buy medicine',
    '📚 Homework': '📚 Homework', 'Family tree': 'Family tree', 'Start someone new': 'Start new person', 'Accept': 'Accept am',
    'Do it': 'Do am', 'Go': 'Go', 'Apply': 'Apply', 'Resign': 'Comot for work', 'Collect your prize': 'Collect your prize', 'Careers': 'Work dem',
    '🛏️ Somewhere to sleep': '🛏️ Where to sleep', 'Children': 'Pikin dem', 'Do a camp day': 'Do camp day', 'Work at your PPA': 'Go your PPA', 'Register': 'Register', 'Service': 'Service am',
    'Do': 'Wetin dey', 'Map': 'Map', '📱 Phone': '📱 Phone', 'Home': 'House', 'Work': 'Work', 'Money': 'Owo', 'Me': 'Me', 'Gist': 'Gist',
    'Messages': 'Messages', 'Quests': 'Mission', 'Jobs': 'Work wey dey', 'Bank': 'Bank', 'Stocks': 'Shares', 'Shop': 'Market', 'Creator': 'Content', 'Games': 'Games',
    'Dealers': 'Motor dealers', 'Gem hunt': 'Gem hunt', 'What\'s on': 'Wetin dey happen', 'Weather': 'Weather', 'Town Hall': 'Town Hall', 'Travel': 'Travel', 'My story': 'My story', 'Hall of Fame': 'Hall of Fame', 'Wardrobe': 'Cloth', 'Guide': 'How to play',
    '‹ Apps': '‹ Apps', 'Buy': 'Buy am', 'Close': 'Close am', 'Leave': 'Comot', 'Hire': 'Hire am', 'Let go': 'Sack am', 'Adopt': 'Carry am go house', 'Rehome': 'Give am out', 'Join': 'Join', 'Cancel': 'Cancel am',
    'Open': 'Open am', 'Host': 'Throw am', 'Take it': 'Take am', 'Claim': 'Collect', 'Go now': 'Go now now', 'Wear': 'Wear am', 'Take off': 'Remove am', 'Haggle': 'Price am', 'Play': 'Play', '▶ Play': '▶ Play am', 'Go there': 'Go there', 'Quit': 'Comot',
    'Wait 1 hour': 'Siddon 1 hour', 'Clock in': 'Clock in', 'Sell': 'Sell am', 'Drive': 'Drive am', 'Showroom': 'Showroom', 'My garage': 'My garage',
    'Achievements': 'Wetin you don do', 'Skills': 'Wetin you sabi', 'People': 'Your people', 'Save': 'Save am', 'Settings': 'Settings',
    'Wetin I go do?': 'Wetin I go do?', 'Lagosians here': 'Lagos people wey dey here', 'Gifts for you': 'Gift for you', 'Party invites': 'Party invite',
    'Furniture shop': 'Furniture shop', 'Clothes shop': 'Cloth shop', 'In storage': 'For store', 'Domestic staff': 'House staff', 'Pets': 'Pets', 'Health plan': 'Hospital plan',
    'Chieftaincy': 'Chieftaincy', 'Phones': 'Phones', 'Lifetime': 'All your life', 'Milestones': 'Big moments', 'Share it': 'Share am', 'Share your life': 'Share your life',
    'Copy': 'Copy am', 'New life': 'New life', 'Copy save code': 'Copy save code', 'Sound on': 'Sound dey', 'Sound off': 'Sound no dey', 'Light at home': 'Light dey house', 'NEPA took light': 'NEPA don take light',
    'Mini-games': 'Mini-games', 'Biggest blocks': 'Biggest blocks', 'Your block': 'Your block', 'Places': 'Places', 'All': 'Everything', 'Billboards': 'Billboards'
  };
  function translateDom(root) {
    if (prefs.lang !== 'pcm' || !root) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { var p = n.parentNode; return p && /^(SCRIPT|STYLE|TEXTAREA|CANVAS)$/.test(p.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } }), n;
    while ((n = w.nextNode())) {
      var v = n.nodeValue, k = v.trim();
      if (k && PCM.hasOwnProperty(k) && PCM[k] !== k) n.nodeValue = v.replace(k, PCM[k]);
    }
  }
  function applyPrefs() {
    var h = document.documentElement;
    h.classList.toggle('big-text', !!prefs.big);
    h.classList.toggle('lite', !!prefs.lite);
    h.setAttribute('lang', prefs.lang === 'pcm' ? 'pcm' : 'en');
  }
  applyPrefs();
  function settingsView() {
    var opt = function (id, label, on, desc) { return '<div class="item"><div><h3>' + label + '</h3><div class="act-note">' + desc + '</div></div><button class="btn sm' + (on ? ' go' : ' ghost') + '" id="set-' + id + '" data-setpref="' + id + '" aria-pressed="' + !!on + '">' + (on ? 'On' : 'Off') + '</button></div>'; };
    return '<div class="section"><h3>Settings</h3><div class="list">' +
      opt('lang', '🗣️ Naija Pidgin', prefs.lang === 'pcm', 'Tabs, app names, headings and buttons in Pidgin. Story text stays in English.') +
      opt('big', '🔠 Large text', prefs.big, 'Bigger text everywhere.') +
      opt('lite', '🪶 Lite mode', prefs.lite, 'Fewer animations and no moving traffic on the map, for cheap phones and low data. The page reloads.') +
      '</div></div>';
  }

  // A one-time toast when a room night starts in your city and you are not in that room.
  function nightReminders() {
    if (!S || !D.ROOM_NIGHTS) return; ui.nightSeen = ui.nightSeen || {};
    var here = L.cityOf(S);
    Object.keys(D.ROOM_NIGHTS).forEach(function (id) {
      var I = L.roomNightInfo(S, id); if (!I.live) return;
      var key = id + ':' + I.evDay; if (ui.nightSeen[key]) return; ui.nightSeen[key] = 1;
      var R = D.ROOMS[id], pl = D.PLACES.filter(function (x) { return x.id === R.place; })[0];
      if (L.districtCity(pl.district) !== here || L.roomIn(S, id)) return;
      ui.toasts.push({ msg: I.n.icon + ' ' + I.n.name + ' is on at ' + R.name + '.', ok: true });
    });
  }
  function render() {
    // Live updates re-render at any moment, so keep what the viewer is typing.
    var kept = {};
    Array.prototype.forEach.call(app.querySelectorAll('input[id], textarea[id]:not([readonly])'), function (el) {
      if (el.type === 'file' || el.type === 'checkbox') return; // browsers forbid setting a file input; checkboxes render from state
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
    mountVisit();
    mountCruise();
    mountAirport();
    mountRoom();
    mountVenue();
    Array.prototype.forEach.call(document.querySelectorAll('canvas.ww-hall'), drawHall);
    drawHudAvatar();
    mountInterior();
    drawAvatar();
    syncResidence();
    if (focusId) { var f = document.getElementById(focusId); if (f) f.focus(); }
    translateDom(app);
    syncPresence();
  }

  /* ---------- Lagos online: shared hall of fame and live presence ----------
   * Both light up only inside claude.ai; the game is complete without them.
   * No chat and no free text travel between players: presence carries a
   * district key, the board carries numbers. */
  var online = { govrun: [], govvote: [], govparty: [], govprimary: [], govcab: [], govconfirm: [], photos: {}, photoOff: {}, chats: {}, unread: {}, sentTimes: [], muted: (function () { try { return JSON.parse(localStorage.getItem('lasgidi.muted.v1') || '{}') || {}; } catch (e) { return {}; } })(), photoreview: [], myPhotoReview: null, votes: [], sea: [], seaimg: {}, seareview: [], mySeaReview: null, ads: [], sponsored: [], db: null, user: null, room: null, me: null, fame: [], hidden: 0, unverified: 0, names: {}, peers: {}, others: 0, canWrite: null, sentLoc: null, status: '', checked: {}, adimg: [], adpaid: {}, adreview: [], myReview: null, canEdit: false, picStatus: '', peerList: [], homes: {}, giftsIn: [], waved: {}, sentHome: '' };

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
    online.fameAll = rows; online.fame = rows.slice(0, BOARD); online.hidden = hidden; online.unverified = failed;
    online.pending = rows.length >= BOARD ? 0 : pending;
    if (online.user && online.fame.length) {
      online.user.profiles(rows.map(function (r) { return r.id; })).then(function (ps) { online.names = ps; scheduleRender(); });
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

  // Picture-ad review: a player's own submission, and (for editors) the queue.
  var myReviewOn = false, reviewsOn = false;
  function subscribeMyReview() {
    if (myReviewOn || !online.me) return;
    window.claude.use('db').then(function (db) {
      if (!db || myReviewOn) return; myReviewOn = true;
      try { db.doc('adreview/' + online.me).onSnapshot(function (d) { online.myReview = d && d.exists ? d.data() : null; scheduleRender(); }, function () { online.myReview = null; }); } catch (e) { online.myReview = null; }
      try { db.doc('seareview/' + online.me).onSnapshot(function (d) { online.mySeaReview = d && d.exists ? d.data() : null; scheduleRender(); }, function () { online.mySeaReview = null; }); } catch (e) { online.mySeaReview = null; }
      try { db.doc('photoreview/' + online.me).onSnapshot(function (d) { online.myPhotoReview = d && d.exists ? d.data() : null; scheduleRender(); }, function () { online.myPhotoReview = null; }); } catch (e) { online.myPhotoReview = null; }
    });
  }
  var reportsOn = false;
  function subscribeReports() {
    if (reportsOn) return;
    window.claude.use('db').then(function (db) {
      if (!db || reportsOn) return; reportsOn = true;
      try { db.collection('reports').limit(200).onSnapshot(function (snap) {
        online.reports = snap.docs.map(function (d) { return { id: d.id, raw: d.data() }; }).filter(function (r) { return r.raw && typeof r.raw.who === 'string' && typeof r.raw.at === 'number'; }).sort(function (a, b) { return b.raw.at - a.raw.at; });
        var ids = online.reports.map(function (r) { return r.id; }).concat(online.reports.map(function (r) { return r.raw.who; }));
        if (online.user && ids.length) online.user.profiles(ids).then(function (ps) { Object.keys(ps).forEach(function (k) { online.names[k] = ps[k]; }); scheduleRender(); });
        scheduleRender();
      }, function () { online.reports = []; }); } catch (e) { online.reports = []; }
    });
  }
  function subscribeReviews() {
    if (reviewsOn) return;
    window.claude.use('db').then(function (db) {
      if (!db || reviewsOn) return; reviewsOn = true;
      try { db.collection('adreview').limit(100).onSnapshot(function (snap) {
        online.adreview = snap.docs.map(function (d) { return { id: d.id, raw: d.data() }; }).filter(function (r) { return r.raw && !r.raw.status; });
        var ids = online.adreview.map(function (r) { return r.id; });
        if (online.user && ids.length) online.user.profiles(ids).then(function (ps) { Object.keys(ps).forEach(function (k) { online.names[k] = ps[k]; }); scheduleRender(); });
        scheduleRender();
      }, function () { online.adreview = []; }); } catch (e) { online.adreview = []; }
      try { db.collection('seareview').limit(100).onSnapshot(function (snap) {
        online.seareview = snap.docs.map(function (d) { return { id: d.id, raw: d.data() }; }).filter(function (r) { return r.raw && !r.raw.status; });
        scheduleRender();
      }, function () { online.seareview = []; }); } catch (e) { online.seareview = []; }
      try { db.collection('photoreview').limit(100).onSnapshot(function (snap) {
        online.photoreview = snap.docs.map(function (d) { return { id: d.id, raw: d.data() }; }).filter(function (r) { return r.raw && !r.raw.status && okImg(r.raw.img); });
        var ids = online.photoreview.map(function (r) { return r.id; });
        if (online.user && ids.length) online.user.profiles(ids).then(function (ps) { Object.keys(ps).forEach(function (k) { online.names[k] = ps[k]; }); scheduleRender(); });
        scheduleRender();
      }, function () { online.photoreview = []; }); } catch (e) { online.photoreview = []; }
    });
  }

  function initOnline() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    window.claude.use('user').then(function (u) {
      if (!u) return;
      online.user = u;
      u.id().then(function (id) { online.me = id; scheduleRender(); subscribeMyReview(); });
      if (typeof u.canEdit === 'function') u.canEdit().then(function (c) { online.canEdit = !!c; scheduleRender(); if (c) { subscribeReviews(); subscribeReports(); } }, function () {});
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
        setTimeout(maybeRenewAd, 0);
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
      try { db.collection('adimg').limit(200).onSnapshot(function (snap) {
        online.adimg = snap.docs.map(function (d) { return { id: d.id, raw: d.data() }; }); scheduleRender();
      }, function () { online.adimg = []; });
      db.collection('adpaid').limit(500).onSnapshot(function (snap) {
        var m = {}; snap.docs.forEach(function (d) { m[d.id] = d.data(); }); online.adpaid = m; scheduleRender();
      }, function () { online.adpaid = {}; }); } catch (e) { online.adimg = []; online.adpaid = {}; }
      subscribeMyReview(); if (online.canEdit) subscribeReviews();
      try {
        db.collection('sea').limit(500).onSnapshot(function (snap) {
          online.sea = snap.docs.map(function (d) { return { id: d.id, raw: d.data() }; });
          var ids = online.sea.map(function (d) { return d.id; }).filter(function (i) { return !online.names[i]; });
          if (online.user && ids.length) online.user.profiles(ids).then(function (ps) { Object.keys(ps).forEach(function (k) { online.names[k] = ps[k]; }); scheduleRender(); });
          scheduleRender();
        }, function () { online.sea = []; });
        db.collection('govrun').limit(500).onSnapshot(function (snap) {
          online.govrun = snap.docs.map(function (d) { return { id: d.id, raw: d.data() }; });
          var ids = online.govrun.map(function (d) { return d.id; }).filter(function (i) { return !online.names[i]; });
          if (online.user && ids.length) online.user.profiles(ids).then(function (ps) { Object.keys(ps).forEach(function (k) { online.names[k] = ps[k]; }); scheduleRender(); });
          scheduleRender();
        }, function () { online.govrun = []; });
        ['govparty', 'govprimary', 'govcab', 'govconfirm'].forEach(function (c) {
          db.collection(c).limit(1000).onSnapshot(function (snap) {
            online[c] = snap.docs.map(function (d) { return { id: d.id, raw: d.data() }; });
            var ids = online[c].map(function (d) { return d.id; }).filter(function (i) { return !online.names[i]; });
            if (online.user && ids.length) online.user.profiles(ids).then(function (ps) { Object.keys(ps).forEach(function (k) { online.names[k] = ps[k]; }); scheduleRender(); });
            scheduleRender();
          }, function () { online[c] = []; });
        });
        db.collection('govvote').limit(1000).onSnapshot(function (snap) { online.govvote = snap.docs.map(function (d) { return { id: d.id, raw: d.data() }; }); scheduleRender(); }, function () { online.govvote = []; });
        db.collection('votes').limit(1000).onSnapshot(function (snap) { online.votes = snap.docs.map(function (d) { return { id: d.id, raw: d.data() }; }); scheduleRender(); }, function () { online.votes = []; });
        db.collection('seaimg').limit(500).onSnapshot(function (snap) { var m = {}; snap.docs.forEach(function (d) { m[d.id] = d.data(); }); online.seaimg = m; scheduleRender(); }, function () { online.seaimg = {}; });
        // Profile photos: only editor-approved pictures are stored here; a player can switch theirs off.
        db.collection('photo').limit(500).onSnapshot(function (snap) { var m = {}; snap.docs.forEach(function (d) { var v = d.data(); if (v && okImg(v.img)) m[d.id] = v.img; }); online.photos = m; scheduleRender(); }, function () { online.photos = {}; });
        db.collection('photooff').limit(500).onSnapshot(function (snap) { var m = {}; snap.docs.forEach(function (d) { var v = d.data(); m[d.id] = !!(v && v.off); }); online.photoOff = m; scheduleRender(); }, function () { online.photoOff = {}; });
      } catch (e) { online.sea = []; online.seaimg = {}; }
      try {
        db.collection('homes').limit(300).onSnapshot(function (snap) { var m = {}; snap.docs.forEach(function (d) { m[d.id] = d.data(); }); online.homes = m; scheduleRender(); }, function () { online.homes = {}; });
        db.collection('gifts').limit(300).onSnapshot(function (snap) {
          online.giftsIn = snap.docs.map(function (d) { return { from: d.id, raw: d.data() }; }).filter(function (g) { return g.raw && g.raw.to === online.me && D.GIFTS[g.raw.gift] && typeof g.raw.at === 'number'; });
          var ids = online.giftsIn.map(function (g) { return g.from; });
          if (online.user && ids.length) online.user.profiles(ids).then(function (ps) { Object.keys(ps).forEach(function (k) { online.names[k] = ps[k]; }); scheduleRender(); });
          scheduleRender();
        }, function () { online.giftsIn = []; });
      } catch (e) {}
    });
    window.claude.use('db').then(function (db) {
      if (!db) return;
      db.collection('residents').limit(500).onSnapshot(function (snap) {
        online.residents = snap.docs.map(function (d) { var r = d.data(); return { id: d.id, home: r && typeof r.home === 'string' ? r.home : null }; });
        var ids = online.residents.map(function (r) { return r.id; });
        if (online.user && ids.length) online.user.profiles(ids).then(function (ps) { Object.keys(ps).forEach(function (k) { online.names[k] = ps[k]; }); scheduleRender(); });
        scheduleRender();
      }, function () { online.residents = []; });
      db.collection('cvs').limit(500).onSnapshot(function (snap) {
        var m = {}; snap.docs.forEach(function (d) { m[d.id] = d.data(); }); online.cvs = m; scheduleRender();
      }, function () { online.cvs = {}; });
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
        var seen = {};
        online.peerList = ch.peers.filter(function (p) { return !p.isMe && p.kind === 'viewer' && p.by && p.presence && typeof p.presence.d === 'string' && D.DISTRICTS[p.presence.d]; })
          .filter(function (p) { if (seen[p.by]) return false; seen[p.by] = true; return true; }).map(function (p) { return { by: p.by, d: p.presence.d, look: cleanLook(p.presence.look), party: cleanParty(p.presence.party), at: typeof p.presence.at === 'string' && p.presence.at.length < 80 ? p.presence.at : null, act: typeof p.presence.a === 'string' && Object.prototype.hasOwnProperty.call(ACTIVITIES, p.presence.a) ? p.presence.a : null }; });
        var ids = online.peerList.map(function (p) { return p.by; });
        if (online.user && ids.length) online.user.profiles(ids).then(function (ps) { Object.keys(ps).forEach(function (k) { online.names[k] = ps[k]; }); scheduleRender(); });
        scheduleRender();
      }, function () { online.room = null; online.peers = {}; online.others = 0; online.peerList = []; scheduleRender(); });
      try {
        room.on('wave', function (msg) {
          if (!msg || !msg.by || !msg.data || msg.data.to !== online.me) return;
          var nm = (online.names[msg.by] && online.names[msg.by].name) || 'A Lagosian';
          ui.toasts.push({ msg: msg.data.bell ? '🔔 ' + nm + ' rang your bell. They are at your party!' : '👋 ' + nm + ' waved at you.', ok: true }); scheduleRender();
        });
        room.on('deck', function (msg) {
          if (msg && msg.data && typeof msg.data.room === 'string') { // a live room's chat: only from people in that same room
            var rid = msg.data.room;
            if (!D.ROOMS[rid] || msg.by === online.me || online.muted[msg.by] || !S || !S.room || !L.roomIn(S, rid) || !roomPeers(rid).some(function (p) { return p.by === msg.by; })) return;
            var rr = CH.clean(msg.data.text); if (!rr.ok) return;
            online.roomChat = (online.roomChat || []).concat([{ room: rid, by: msg.by, text: rr.text, at: Date.now() }]).slice(-30);
            mountRoom(); setTimeout(mountRoom, 7200); return;
          }
          if (!msg || !msg.by || !msg.data || msg.by === online.me || online.muted[msg.by] || !S || !S.cruise || !L.cruiseAboard(S)) return;
          if (!deckPeers().some(function (p) { return p.by === msg.by; })) return; // only people actually on deck
          var r = CH.clean(msg.data.text); if (!r.ok) return;
          online.deck = (online.deck || []).concat([{ by: msg.by, text: r.text, at: Date.now() }]).slice(-20);
          mountCruise(); setTimeout(mountCruise, 7200);
        });
        room.on('chat', function (msg) {
          if (!msg || !msg.by || !msg.data || msg.data.to !== online.me || online.muted[msg.by] || msg.by === online.me) return;
          var r = CH.clean(msg.data.text); if (!r.ok) return; // the sender's filter is not trusted
          var log0 = online.chats[msg.by] = online.chats[msg.by] || [];
          if (log0.filter(function (m) { return !m.me && Date.now() - m.at < 60000; }).length >= 15) return;
          log0.push({ me: false, text: r.text, at: Date.now() }); if (log0.length > 60) log0.shift();
          if (ui.chatWith !== msg.by) { online.unread[msg.by] = (online.unread[msg.by] || 0) + 1; ui.toasts.push({ msg: '💬 ' + handleOf(msg.by) + ': ' + r.text, ok: true }); }
          scheduleRender();
        });
      } catch (e) {}
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
    var d = S ? S.loc : null, lk = S && S.look ? { skin: S.look.skin, hair: S.look.hair, shape: S.look.shape } : null, pt = myParty();
    var pres = { d: d, look: lk, party: pt, at: S && S.cruise && L.cruiseAboard(S) ? 'cruise:' + S.cruise.spot : S && S.room && L.roomIn(S, S.room.id) ? 'room:' + S.room.id + ':' + S.room.spot : ui.visit || null, a: S ? myActivity() : null };
    var key = JSON.stringify(pres);
    if (key === online.sentLoc) return;
    online.sentLoc = key;
    online.room.presence(pres).catch(function () {});
  }
  // Your own party stays open to online friends for 30 real minutes.
  var PARTY_KEY = 'lasgidi.party.v1', PARTY_OPEN = 30 * 60 * 1000;
  var PARTY_KINDS = Object.assign({ wedding: { name: 'Wedding reception', icon: '💍' } }, D.PARTIES);
  function openParty(kind, planner) { try { localStorage.setItem(PARTY_KEY, JSON.stringify({ seed: S.seed, kind: kind, planner: !!planner, at: Date.now() })); } catch (e) {} syncPresence(); publishHome(); }
  function myParty() {
    try { var v = JSON.parse(localStorage.getItem(PARTY_KEY) || 'null'); if (v && S && v.seed === S.seed && PARTY_KINDS[v.kind] && Date.now() - v.at < PARTY_OPEN) return { kind: v.kind, planner: !!v.planner, at: v.at }; } catch (e) {}
    return null;
  }
  function cleanParty(p) {
    if (!p || typeof p !== 'object' || !PARTY_KINDS[p.kind] || typeof p.at !== 'number' || !(Date.now() - p.at < PARTY_OPEN && p.at <= Date.now() + 60000)) return null;
    return { kind: p.kind, planner: !!p.planner, at: Math.floor(p.at) };
  }
  function guestsAt(host) { return (online.peerList || []).filter(function (p) { return p.at === host; }).length; }
  function partyOf(host) {
    var pr = (online.peerList || []).filter(function (p) { return p.by === host; })[0];
    return (pr && pr.party) || (online.homes[host] && cleanParty(online.homes[host].party)) || null;
  }
  // Faces of everyone at a host's party, as small round images.
  function guestFaces(host, withMe) {
    var list = (online.peerList || []).filter(function (p) { return p.at === host && p.look; }).slice(0, 8), out = '';
    if (withMe && S) { var mp = photoOf(online.me), me = mp ? null : faceCanvas(S.look || { skin: 2, hair: 0, shape: 1 }, S.outfit); if (mp || me) out += '<img class="gface me" alt="You" src="' + (mp || me.toDataURL()) + '">'; }
    list.forEach(function (p) { var ph = photoOf(p.by), f = ph ? null : faceCanvas(p.look, null); if (ph || f) out += '<img class="gface" alt="' + esc(nameOf(p.by)) + '" title="' + esc(nameOf(p.by)) + '" src="' + (ph || f.toDataURL()) + '">'; });
    return out ? '<div class="gfaces">' + out + '</div>' : '';
  }
  function partyInvites() {
    if (!S || S.challenge) return '';
    var mine = myParty(), html = '';
    if (mine) html += '<div class="party-banner">' + PARTY_KINDS[mine.kind].icon + ' <b>Your ' + (mine.kind === 'wedding' ? 'wedding reception' : 'party') + ' is on</b> (' + esc(PARTY_KINDS[mine.kind].name.toLowerCase()) + (mine.planner ? ', decorated' : '') + '). ' + guestsAt(online.me) + ' guest' + (guestsAt(online.me) === 1 ? '' : 's') + ' here now · open ' + Math.max(1, Math.round((PARTY_OPEN - (Date.now() - mine.at)) / 60000)) + ' more min' + guestFaces(online.me, false) + '</div>';
    var hosts = (online.peerList || []).filter(function (p) { return p.party && p.by !== ui.visit; });
    if (hosts.length) html += '<div class="section"><h3>💌 Party invites</h3><div class="list">' + hosts.slice(0, 4).map(function (p) {
      var P = PARTY_KINDS[p.party.kind];
      return '<div class="item"><div><h3>' + P.icon + ' ' + esc(nameOf(p.by)) + (p.party.kind === 'wedding' ? ' just got married' : ' is throwing a party') + '</h3><div class="meta"><span>' + esc(P.name) + (p.party.planner ? ' · decorated' : '') + '</span><span>' + guestsAt(p.by) + ' here</span></div></div><button class="btn sm go" id="join-' + esc(p.by) + '" data-joinparty="' + esc(p.by) + '">Go now</button></div>';
    }).join('') + '</div></div>';
    return html;
  }
  // A look from another player: only small whole numbers inside D.LOOKS.
  function cleanLook(lk) {
    if (!lk || typeof lk !== 'object') return null;
    var ok = function (v, list) { return typeof v === 'number' && v >= 0 && v < list.length && Math.round(v) === v; };
    return ok(lk.skin, D.LOOKS.skin) && ok(lk.hair, D.LOOKS.hair) && ok(lk.shape, D.LOOKS.shape) ? { skin: lk.skin, hair: lk.hair, shape: lk.shape } : null;
  }
  // A round-ready head crop of an avatar, cached by look and outfit.
  var faceCache = {};
  function faceCanvas(look, outfit) {
    if (!window.LasgidiAvatar) return null;
    var key = JSON.stringify([look, outfit || {}]);
    if (faceCache[key]) return faceCache[key];
    try {
      var off = document.createElement('canvas'), c = document.createElement('canvas');
      window.LasgidiAvatar.draw(off, look, outfit || {});
      var r = off.width / 180; c.width = c.height = 64;
      c.getContext('2d').drawImage(off, 40 * r, 2 * r, 100 * r, 100 * r, 0, 0, 64, 64);
      if (Object.keys(faceCache).length > 40) faceCache = {};
      return (faceCache[key] = c);
    } catch (e) { return null; }
  }
  // What a player is up to, as a code from a fixed list (never free text), shown under their @handle.
  var ACTIVITIES = { work: 'at work', study: 'studying', beach: 'at the beach', party: 'partying', club: 'at the club', eat: 'eating out', shop: 'shopping', gym: 'working out', sights: 'sightseeing', travel: 'on the move', home: 'at home' };
  function activityFor(actId) {
    var pl = D.PLACES.filter(function (p) { return p.acts.indexOf(actId) >= 0; })[0], a = null;
    Object.keys(D.PLACE_ACTIONS).some(function (d) { a = D.PLACE_ACTIONS[d].filter(function (x) { return x.id === actId; })[0]; return !!a; });
    var lab = ((a && a.label) || '').toLowerCase();
    if (/beach|jet ski|cabana|lagoon|boat/.test(lab)) return 'beach';
    if (/gym|jog|run|tennis|football|swim|workout|fitness/.test(lab) || (a && a.xp && a.xp.fitness)) return 'gym';
    if (a && (a.gig || a.earn)) return 'work';
    if (/club|rave|lounge|party|owambe/.test(lab)) return pl && pl.type === 'nightlife' ? 'club' : 'party';
    if (!pl) return null;
    return { nightlife: 'party', culture: 'sights', outdoors: 'sights', food: 'eat', learn: 'study', services: 'shop', transport: 'travel' }[pl.type] || null;
  }
  function myActivity() {
    if (ui.visit) return 'home';
    if (ui.trip && Date.now() - ui.trip.at < 60000) return 'travel';
    if (ui.activity && Date.now() - ui.activityAt < 30 * 60000) return ui.activity;
    return S && S.loc === L.homeDef(S).district ? 'home' : null;
  }
  // Online players on the map: a little figure with their @handle floating above.
  var CH = window.LasgidiChat;
  function handleOf(id) { return CH.handle(id === online.me ? ((online.names[id] && online.names[id].name) || (S && S.name)) : (online.names[id] && online.names[id].name)); }
  function mapPlayers() {
    if (!online.room || !S) return [];
    var city = L.cityOf(S), out = [{ by: online.me || 'me', d: S.loc, label: handleOf(online.me), sub: ACTIVITIES[myActivity()] || '', me: true, look: S.look || null }];
    (online.peerList || []).forEach(function (p) {
      if (out.length >= 17 || L.districtCity(p.d) !== city || online.muted[p.by]) return;
      out.push({ by: p.by, d: p.d, label: handleOf(p.by), sub: p.act ? ACTIVITIES[p.act] : '', look: p.look, unread: online.unread[p.by] || 0, face: photoImage(p.by) || (p.look ? faceCanvas(p.look, null) : null) });
    });
    return out;
  }
  // The player card: who they are, where they are, wave, visit, and a filtered chat.
  function chatView(by) {
    var p = (online.peerList || []).filter(function (x) { return x.by === by; })[0];
    if (!p) return '<div class="inline" style="justify-content:space-between"><h3>💬 Chat</h3><button class="btn sm ghost" id="close-chat" data-closechat="1">Close</button></div><p class="muted">' + esc(nameOf(by)) + ' is not online right now.</p>';
    var msgs = online.chats[by] || [], muted = !!online.muted[by], home = checkHome(online.homes[by]);
    var near = p.d === S.loc;
    return '<div class="sheet-grab" aria-hidden="true"></div><div class="player-card"><div class="pc-head">' + (photoImg(by, 'pc-photo') || '<span class="pc-photo pc-ph">🙂</span>') +
      '<div><h3>' + esc(nameOf(by)) + '</h3><div class="pc-handle">' + esc(handleOf(by)) + '</div><div class="meta"><span>📍 ' + esc(D.DISTRICTS[p.d].name) + '</span>' + (p.act ? '<span>' + esc(ACTIVITIES[p.act]) + '</span>' : '') + (home ? '<span>🏠 ' + esc(home.h.name) + '</span>' : '') + '</div></div>' +
      '<button class="btn sm ghost" id="close-chat" data-closechat="1">Close</button></div>' +
      '<div class="inline"><button class="btn sm ghost" id="pwave-' + esc(by) + '" data-wave="' + esc(by) + '">👋 Wave</button>' + (home ? '<button class="btn sm ghost" id="pvisit-' + esc(by) + '" data-visit2="' + esc(by) + '">🏠 Visit</button>' : '') +
        (near ? '' : '<button class="btn sm ghost" id="pgo-' + esc(by) + '" data-go="' + p.d + '">🧭 Go to them</button>') +
        '<button class="btn sm ghost" id="pmute-' + esc(by) + '" data-chatmute="' + esc(by) + '">' + (muted ? '🔈 Unblock' : '🚫 Block') + '</button>' +
        '<button class="btn sm ghost" id="preport-' + esc(by) + '" data-reportopen="' + esc(by) + '">🚩 Report</button>' +
        (online.cvs && checkCv(online.cvs[by]) ? '<button class="btn sm ghost" id="pcv-' + esc(by) + '" data-cvfor="' + esc(by) + '">📄 CV</button>' : '') + '</div>' + reportBox(by) +
        (ui.cvFor === by && online.cvs && checkCv(online.cvs[by]) ? cvHtml(checkCv(online.cvs[by]), by) : '') +
      '<div class="chat-log" id="chat-log" aria-live="polite">' + (msgs.length ? msgs.slice(-30).map(function (m) { return '<div class="chat-msg' + (m.me ? ' me' : '') + '"><span>' + esc(m.text) + '</span></div>'; }).join('') : '<p class="muted">Say hello. Messages are not saved and vanish when you close the game.</p>') + '</div>' +
      '<div class="chat-quick">' + CH.QUICK.map(function (q, i) { return '<button type="button" class="act-chip" id="cq-' + i + '" data-chatq="' + i + '">' + esc(q) + '</button>'; }).join('') + '</div>' +
      '<div class="chat-send"><input id="chat-in" maxlength="' + CH.MAX + '" autocomplete="off" placeholder="Message ' + esc(handleOf(by)) + '" aria-label="Message" value="' + esc(ui.chatDraft || '') + '"><button class="btn" id="chat-send" data-chatsend="' + esc(by) + '">Send</button></div>' +
      (ui.chatWhy ? '<p class="why">' + esc(ui.chatWhy) + '</p>' : '') +
      '<p class="note">Keep it friendly: no sexual messages, no insults or abuse, no links, numbers or emails. Messages that break the rules are not sent, and you can mute anyone.</p></div>';
  }
  // Reports: one row per reporter (reports/<you>), reason from a fixed list, read only by editors.
  var REPORT_REASONS = { sexual: 'Sexual messages', abuse: 'Insults, threats or hate', spam: 'Spam or scams', political: 'Political abuse or impersonation', other: 'Something else unsafe' };
  function reportBox(by) {
    if (ui.reportFor !== by) return '';
    return '<div class="report-box" role="group" aria-label="Report ' + esc(handleOf(by)) + '"><b>Report ' + esc(handleOf(by)) + '</b><div class="pick">' + Object.keys(REPORT_REASONS).map(function (k) { return '<button type="button" class="pg-chip" id="rep-' + k + '" data-reportsend="' + esc(by) + ':' + k + '">' + esc(REPORT_REASONS[k]) + '</button>'; }).join('') + '</div>' +
      '<p class="note">Reports go to the game\'s editors with the player and the reason only. Blocking also hides them from you at once.</p>' + (online.reportStatus ? '<p class="gain">' + esc(online.reportStatus) + '</p>' : '') + '</div>';
  }
  function sendReport(by, reason) {
    if (!REPORT_REASONS[reason]) return;
    online.muted[by] = 1; try { localStorage.setItem('lasgidi.muted.v1', JSON.stringify(online.muted)); } catch (e) {}
    if (!online.db || !online.me) { online.reportStatus = 'Blocked. Reports send when the game is opened on claude.ai.'; render(); return; }
    online.db.doc('reports/' + online.me).set({ who: String(by).slice(0, 80), reason: reason, at: Date.now() }).then(function () { online.reportStatus = 'Thanks. Reported and blocked.'; render(); }, function () { online.reportStatus = 'Blocked. The report could not be sent.'; render(); });
  }
  function reportsAdmin() {
    if (!online.canEdit || !online.reports || !online.reports.length) return '';
    return '<div class="section"><h3>🚩 Reports for editors</h3><div class="list">' + online.reports.slice(0, 30).map(function (r) {
      return '<div class="item"><div><h3>' + esc(nameOf(r.raw.who)) + ' <span class="pc-handle">' + esc(handleOf(r.raw.who)) + '</span></h3><div class="meta"><span>' + esc(REPORT_REASONS[r.raw.reason] || 'Other') + '</span><span>by ' + esc(nameOf(r.id)) + '</span><span>' + new Date(r.raw.at).toLocaleString() + '</span></div></div></div>';
    }).join('') + '</div></div>';
  }
  function safetyCard() {
    return '<div class="section safety"><h3>🛡️ Safety and privacy</h3><ul class="note">' +
      '<li><b>Who you are:</b> your claude.ai account. Lasgidi never asks for a password or an email. Players must be 18 or older.</li>' +
      '<li><b>What other players see:</b> your display name and @handle, the district you are in, your avatar\'s look, a fixed activity label, and party, cruise or visit status.</li>' +
      '<li><b>Chat:</b> one-to-one and deck chat are filtered for sexual content, insults, links, emails and numbers, both when sent and when received, and are never stored.</li>' +
      '<li><b>Block and report:</b> open a player\'s card to block them (hidden from you at once) or report them to the editors with a reason.</li>' +
      '<li><b>Politics:</b> manifestos and mottos come from fixed lists, never free text, and candidates can be reported.</li>' +
      '<li><b>Money:</b> in-game naira has no real value. There is no gambling, no betting, no real investments and no cash-out. Billboards are player ads, labelled as such.</li></ul></div>';
  }
  // Everyone online in every city, so friends in Abuja or PH are one tap away.
  function peopleView() {
    if (!online.room) return '<div class="section"><h3>👥 People online</h3><p class="note">Other players show here when the game is opened on claude.ai.</p></div>';
    var list = (online.peerList || []).filter(function (p) { return !online.muted[p.by]; }), here = L.cityOf(S);
    list.sort(function (a, b) { var ca = L.districtCity(a.d) === here ? 0 : 1, cb = L.districtCity(b.d) === here ? 0 : 1; return ca - cb || nameOf(a.by).localeCompare(nameOf(b.by)); });
    var blocked = Object.keys(online.muted).length;
    var rooms = [['cruise', '🛳️ Lagoon Boat Cruise', 'lagoon_cruise', deckPeers().length]].concat(Object.keys(D.ROOMS).map(function (k) { return [k, '📍 ' + D.ROOMS[k].name, D.ROOMS[k].place, roomPeers(k).length]; }));
    var cityOfPlace = function (pid) { var pl = D.PLACES.filter(function (x) { return x.id === pid; })[0]; return pl ? L.districtCity(pl.district) : 'lagos'; };
    var PP = L.passportInfo(S);
    var roomRow = function (r) { return '<div class="item"><div><h3>' + esc(r[1]) + (PP.rooms[r[0]] != null ? ' <span class="stamp" title="Stamped">🛂 ✓</span>' : ' <span class="stamp new">New</span>') + '</h3><div class="meta"><span>' + (r[3] ? '👥 ' + r[3] + ' here now' : 'Quiet right now') + '</span></div></div><button class="btn sm ghost" id="lr-' + r[0] + '" data-place="' + r[2] + '" data-tab="map">Go</button></div>'; };
    var cityOrder = [here].concat(Object.keys(D.CITIES).filter(function (c) { return c !== here; }));
    var passHtml = '<div class="passport"><b>🛂 Passport ' + PP.seen + '/' + PP.total + ' rooms</b> · ' + PP.nights + ' night' + (PP.nights === 1 ? '' : 's') + ' · ' + PP.hangs + ' catch-up' + (PP.hangs === 1 ? '' : 's') +
      '<div class="pp-badges">' + PP.badges.map(function (b) { return '<span class="pp-badge' + (b.got ? ' got' : '') + '" title="' + esc(b.text) + '">' + b.icon + ' ' + esc(b.name) + '</span>'; }).join('') + '</div></div>';
    var LO = L.localsInfo(S);
    passHtml += '<div class="passport"><b>🤝 Friends in Abuja and Port Harcourt</b><div class="pp-badges">' + LO.map(function (f) { return '<span class="pp-badge' + (f.lvl ? ' got' : '') + '" title="' + esc(D.LOCALS[f.id].text) + '">' + esc(f.name) + ' · ' + esc(D.ROOMS[f.room].name) + ' · ' + f.lvl + '/100</span>'; }).join('') + '</div></div>';
    var roomsHtml = '<div class="section"><h3>📍 Live rooms</h3>' + passHtml + cityOrder.map(function (c) {
      var rs = rooms.filter(function (r) { return cityOfPlace(r[2]) === c; }); if (!rs.length) return '';
      return '<p class="note"><b>' + esc(D.CITIES[c].name) + '</b>' + (c === here ? ' · you are here' : ' · travel there first') + '</p><div class="list">' + rs.map(roomRow).join('') + '</div>';
    }).join('') + '</div>';
    return roomsHtml + '<div class="section"><h3>👥 People online <span class="muted">· ' + list.length + '</span></h3>' + (list.length ? '<div class="list">' + list.slice(0, 60).map(function (p) {
      var city = D.CITIES[L.districtCity(p.d)].name, act = p.act ? ACTIVITIES[p.act] : '', rid = p.at && p.at.indexOf('room:') === 0 ? p.at.split(':')[1] : null, where = deckPeers().indexOf(p) >= 0 ? 'on the Lagoon Boat Cruise' : rid && D.ROOMS[rid] && roomPeers(rid).indexOf(p) >= 0 ? 'at ' + D.ROOMS[rid].name : act;
      return '<div class="item person">' + (photoImg(p.by) || '<span class="pc-photo pc-ph" style="width:40px;height:40px;font-size:20px">🙂</span>') + '<div><h3>' + esc(nameOf(p.by)) + ' <span class="pc-handle">' + esc(handleOf(p.by)) + '</span></h3><div class="meta"><span>📍 ' + esc(D.DISTRICTS[p.d].name) + ', ' + esc(city) + '</span>' + (where ? '<span>' + esc(where) + '</span>' : '') + '</div></div>' +
        '<div class="inline"><button class="btn sm" id="ppl-chat-' + esc(p.by) + '" data-chatopen="' + esc(p.by) + '">💬 Chat' + (online.unread[p.by] ? ' · ' + online.unread[p.by] : '') + '</button></div></div>';
    }).join('') + '</div>' : '<p class="note">Nobody else is online right now.</p>') + (blocked ? '<p class="note">' + blocked + ' blocked player' + (blocked === 1 ? '' : 's') + ' hidden. Unblock from their player card.</p>' : '') + '</div>';
  }
  function sendChat(by, text) {
    var r = CH.clean(text);
    if (!r.ok) { ui.chatWhy = r.why; render(); return; }
    var wait = CH.canSend(online.sentTimes, Date.now());
    if (wait) { ui.chatWhy = wait; render(); return; }
    if (!online.room) { ui.chatWhy = 'Chat is not open here.'; render(); return; }
    online.sentTimes = online.sentTimes.concat([Date.now()]).slice(-12);
    online.room.emit('chat', { to: by, text: r.text }).then(function () {
      (online.chats[by] = online.chats[by] || []).push({ me: true, text: r.text, at: Date.now() });
      ui.chatDraft = ''; ui.chatWhy = ''; var ci0 = document.getElementById('chat-in'); if (ci0) ci0.value = ''; render();
      var lg = document.getElementById('chat-log'); if (lg) lg.scrollTop = lg.scrollHeight;
    }, function () { ui.chatWhy = 'Chat is not open here yet.'; render(); });
  }
  function mapFaces() {
    var out = { me: photoImage(online.me) || faceCanvas(S.look || { skin: 2, hair: 0, shape: 1 }, S.outfit), peers: {} }, n = 0;
    (online.peerList || []).forEach(function (p) {
      if (!p.look || n >= 6 || L.districtCity(p.d) !== L.cityOf(S)) return;
      var f = photoImage(p.by) || faceCanvas(p.look, null); if (!f) return;
      (out.peers[p.d] = out.peers[p.d] || []).push(f); n++;
    });
    return out;
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

  var SLOT_NAMES = { top: 'Tops', bottom: 'Bottoms', dress: 'Dresses and agbada', shoes: 'Shoes', head: 'Headwear', acc: 'Accessories' };
  var TAG_NAMES = { owambe: 'owambe', club: 'the club', office: 'the office', gym: 'the gym', rain: 'the rain' };
  var TAG_EFFECT = { owambe: 'better owambes', club: 'better club nights', office: 'better form at banking and tech jobs', gym: 'faster fitness' };
  function lagosianView() {
    var lk = S.look, tags = Object.keys(L.outfitTags(S));
    var html = '<div class="section" style="padding-top:0"><h3>Your Lagosian</h3><div class="lagosian"><canvas id="avatar-canvas" width="180" height="260" role="img" aria-label="Your Lagosian in their current outfit"></canvas><div class="lg-ctl">' +
      '<span class="label">Skin</span><div class="pick">' + D.LOOKS.skin.map(function (c, i) { return '<button type="button" class="pick-c' + (lk.skin === i ? ' on' : '') + '" id="sk-' + i + '" data-lookskin="' + i + '" aria-label="Skin tone ' + (i + 1) + '" aria-pressed="' + (lk.skin === i) + '" style="background:' + c + '"></button>'; }).join('') + '</div>' +
      '<label class="label" for="look-hair">Hair</label><select id="look-hair">' + D.LOOKS.hair.map(function (h, i) { return '<option value="' + i + '"' + (lk.hair === i ? ' selected' : '') + '>' + esc(h) + '</option>'; }).join('') + '</select>' +
      '<span class="label">Shape</span><div class="pick">' + D.LOOKS.shape.map(function (h, i) { return '<button type="button" class="pg-chip' + (lk.shape === i ? ' sel' : '') + '" id="sh-' + i + '" data-lookshape="' + i + '">' + esc(h) + '</button>'; }).join('') + '</div>' +
      '<p class="note">' + (tags.length ? 'Dressed for ' + tags.map(function (t) { return TAG_NAMES[t]; }).join(', ') + ': ' + tags.map(function (t) { return TAG_EFFECT[t]; }).join('; ') + '.' : 'Dress for the occasion: owambe outfits, club fits, office wear and gym kit each help.') + '</p></div></div>';
    // Wardrobe.
    if (S.wardrobe.length) {
      html += '<h3>Wardrobe</h3><div class="list">' + S.wardrobe.map(function (w) {
        var c = D.CLOTHES[w.id], on = S.outfit[c.slot] === w.id;
        return '<div class="item"><div><h3>' + esc(c.name) + (on ? ' <span class="gain">· wearing</span>' : '') + '</h3><div class="meta"><span>' + esc(SLOT_NAMES[c.slot]) + '</span>' + (c.tags.length ? '<span>' + esc(c.tags.join(', ')) + '</span>' : '') + '</div></div>' +
          (on ? '<button class="btn sm ghost" id="off-' + w.id + '" data-takeoff="' + c.slot + '">Take off</button>' : '<button class="btn sm" id="wear-' + w.id + '" data-wear="' + w.id + '">Wear</button>') + '</div>';
      }).join('') + '</div>';
    }
    var slot = ui.clothSlot || 'top', canHaggle = !L.haggleOpen(S);
    html += '<h3>Clothes shop</h3>' + (canHaggle ? '<p class="note">🛍️ You are at Balogun: haggle! The trader opens high and has a secret last price. You get three offers per item a day.</p>' : '<p class="note">Go to Balogun market (Lagos Island, Monday to Saturday) to haggle prices down.</p>') + '<div class="pg-chips" style="padding:0">' + Object.keys(SLOT_NAMES).map(function (k) { return '<button type="button" class="pg-chip' + (k === slot ? ' sel' : '') + '" id="cs-' + k + '" data-clothslot="' + k + '">' + SLOT_NAMES[k] + '</button>'; }).join('') + '</div><div class="list">' +
      Object.keys(D.CLOTHES).filter(function (k) { return D.CLOTHES[k].slot === slot && !D.CLOTHES[k].gift; }).map(function (k) {
        var c = D.CLOTHES[k], p = L.price(S, c.price), own = S.wardrobe.some(function (w) { return w.id === k; });
        return '<div class="item"><div><h3><i class="swatch" style="background:' + c.color + (c.alt ? ';box-shadow:inset -6px 0 0 ' + c.alt : '') + '"></i>' + esc(c.name) + '</h3><div class="meta"><span class="cost num">' + N(p) + '</span><span>' + esc(c.fabric) + '</span>' + (c.tags.length ? '<span>for ' + esc(c.tags.map(function (t) { return TAG_NAMES[t]; }).join(', ')) + '</span>' : '') + (c.status ? '<span>+' + c.status + ' status</span>' : '') + '</div></div>' +
          (own ? '<span class="muted">Owned</span>' : '<span class="inline">' + (canHaggle ? '<button class="btn sm ghost" id="hag-' + k + '" data-haggle="' + k + '">Haggle</button>' : '') + '<button class="btn sm" id="buyc-' + k + '" data-buycloth="' + k + '"' + (S.cash + S.bank >= p ? '' : ' disabled') + '>Buy</button></span>') + '</div>' +
          (ui.haggle && ui.haggle.id === k && !own ? haggleBox(k, p) : '');
      }).join('') + '</div></div>';
    return html;
  }
  function haggleBox(k, list) {
    var h = ui.haggle, ask = L.haggleAsk(S, k);
    return '<div class="haggle"><p><b>Trader:</b> "' + esc(D.CLOTHES[k].name) + '? Na ' + N(ask) + ', my sister/brother."</p>' + (h.msg ? '<p class="note">' + esc(h.msg) + '</p>' : '') +
      '<div class="pg-chips" style="padding:0">' + [0.6, 0.7, 0.8, 0.9].map(function (f) { var v = Math.round(list * f / 50) * 50; return '<button type="button" class="pg-chip" id="hago-' + Math.round(f * 100) + '" data-hagoffer="' + v + '">' + N(v) + '</button>'; }).join('') +
      (h.counter ? '<button type="button" class="pg-chip sel" id="hago-counter" data-hagoffer="' + h.counter + '">Take ' + N(h.counter) + '</button>' : '') + '</div></div>';
  }
  function drawAvatar() {
    var cv = document.getElementById('avatar-canvas');
    if (cv && window.LasgidiAvatar && S) window.LasgidiAvatar.draw(cv, S.look, S.outfit, myExtra());
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
        }).join('') + '</div>' + whiteWeddingView();
      }
    }
    if (S.kids.length) {
      html += '<h3>Children</h3><div class="list">' + L.kidsInfo(S).map(function (k, i) {
        return '<div class="item kid"><div><h3>🧒 ' + esc(k.name) + (k.label ? ' <span class="slang" title="' + esc(D.SLANG[k.label][1]) + '">' + esc(D.SLANG[k.label][0]) + '</span>' : '') + (k.last ? ' <span class="kid-grade g' + k.last + '" title="Last report card">' + k.last + '</span>' : '') + '</h3>' +
          '<div class="meta"><span>' + (k.school ? esc(L.SCHOOLS[k.school].name) + ', next fees in ' + k.feesIn + ' days' : 'school starts in ' + k.feesIn + ' days') + '</span>' + (k.school ? '<span>Homework this term: ' + k.hw + '</span>' : '') + '</div>' +
          '<div class="kid-bond" aria-label="Bond ' + k.bond + ' of 100"><span>Bond</span><div class="progress"><i style="width:' + k.bond + '%"></i></div></div>' +
          '<div class="inline"><button class="btn sm" id="kid-hw-' + i + '" data-kid="hw:' + i + '"' + (k.hwWhy ? ' disabled title="' + esc(k.hwWhy) + '"' : '') + '>📚 Homework</button><button class="btn sm" id="kid-out-' + i + '" data-kid="out:' + i + '"' + (k.outWhy ? ' disabled title="' + esc(k.outWhy) + '"' : '') + '>🎡 Outing · ' + N(L.price(S, 5000)) + '</button></div>' +
          (k.hwWhy && k.outWhy ? '<div class="why">' + esc(k.hwWhy) + '. ' + esc(k.outWhy) + '.</div>' : '') + '</div></div>';
      }).join('') + '</div><p class="note">Each child costs ' + N(L.price(S, 4000)) + ' a week for food and care. Help with homework on school nights and take them out at weekends: the report card each term follows the school, the homework and your bond.</p>';
    }
    return html + '</div>';
  }

  function fameView() {
    if (!online.db) return '';
    var city = ui.fameCity || '', all = online.fameAll || online.fame;
    var homeCity = function (r) { var h = D.HOMES[r.home]; return h ? L.districtCity(h.district) : null; };
    var rows = (city ? all.filter(function (r) { return homeCity(r) === city; }) : all).slice(0, 10);
    var html = '<div class="section"><h3>' + (city ? esc(D.CITIES[city].name) : 'Lasgidi') + ' Hall of Fame</h3>' +
      '<div class="pg-chips" style="padding:0 0 8px" role="group" aria-label="Board">' + [['', 'All Nigeria']].concat(Object.keys(D.CITIES).map(function (k) { return [k, D.CITIES[k].name]; })).map(function (c) {
        return '<button type="button" class="pg-chip' + (c[0] === city ? ' sel' : '') + '" id="fc-' + (c[0] || 'all') + '" data-famecity="' + c[0] + '">' + esc(c[1]) + '</button>';
      }).join('') + '</div>';
    if (S) {
      var top = all.filter(function (r) { var h = D.HOMES[r.home]; return h && h.district === S.loc; }).sort(function (a, b) { return b.worth - a.worth; })[0];
      if (top) html += '<p class="note">👑 Richest in ' + esc(D.DISTRICTS[S.loc].name) + ': ' + esc(top.id === online.me ? 'you' : (online.names[top.id] && online.names[top.id].name) || 'Someone') + ', ' + N(top.worth) + '.</p>';
    }
    html += '<p class="note">Everyone this game is shared with. Each person\'s best life. Every entry is replayed move by move in your browser, and only lives that replay to the same result are ranked.' +
      (online.hidden + online.unverified ? ' ' + (online.hidden + online.unverified) + ' ' + (online.hidden + online.unverified === 1 ? 'entry failed' : 'entries failed') + ' the check and ' + (online.hidden + online.unverified === 1 ? 'is' : 'are') + ' hidden.' : '') +
      (online.pending ? ' Checking ' + online.pending + '…' : '') + '</p>';
    if (!rows.length) html += '<p class="note">' + (city && all.length ? 'No verified lives from ' + esc(D.CITIES[city].name) + ' yet. Live there and post yours.' : 'No one has posted yet. Post your life to be first.') + '</p>';
    else html += '<div class="stmt-wrap"><table class="stmt lives"><thead><tr><th>#</th><th>Lagosian</th><th>Ended as</th><th class="n">Weeks</th><th class="n">Net worth</th><th class="n">Score</th></tr></thead><tbody>' + rows.map(function (r, i) {
      var p = online.names[r.id], mine = r.id === online.me;
      var who = mine ? 'You' : (p && p.name) || 'Someone', face = photoImg(r.id, 'pphoto sm');
      var title = r.career ? D.CAREERS[r.career].titles[r.level] : 'Jobless';
      return '<tr' + (mine ? ' class="me"' : '') + '><td class="num">' + (i + 1) + '</td><td>' + face + esc(who) + ' <span class="muted">· ' + esc(D.ORIGINS[r.origin].name) + '</span>' + (r.gen > 1 ? '<span class="gen-chip">Gen ' + r.gen + '</span>' : '') + ' <span class="ver" title="Replayed and verified">✓ replayed</span>' + (r.won ? ' <span class="gain">✓ ' + esc(D.GOALS[r.goal].name) + '</span>' : '') + '</td><td>' + esc(title) + '</td><td class="n num">' + r.weeks + '</td><td class="n num">' + N(r.worth) + '</td><td class="n num"><b>' + r.score + '</b></td></tr>';
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
    if (L.cityOf(S) !== 'lagos' || L.districtCity(L.homeDef(S).district) !== 'lagos') chips.push('<span class="chip">📍 ' + esc(D.CITIES[L.cityOf(S)].name) + '</span>');
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
    var labels = { hunger: 'Belle', energy: 'Energy', fun: 'Fun', social: 'Social', hygiene: 'Hygiene', stress: 'Calm' };
    var icons = { hunger: '🍲', energy: '⚡', fun: '🎉', social: '💬', hygiene: '🫧', stress: '😌' };
    return '<section class="needs hud" aria-label="Needs"><button type="button" class="hud-face" id="hud-face" data-tab="me" aria-label="Your Lagosian"><canvas id="hud-avatar" width="56" height="56" aria-hidden="true"></canvas></button>' + ['hunger', 'energy', 'fun', 'social', 'hygiene', 'stress'].map(function (k) {
      var v = Math.round(k === 'stress' ? 100 - S.needs.stress : S.needs[k]);
      var cls = v < 25 ? 'low' : v < 50 ? 'mid' : '';
      return '<div class="need n-' + k + '"><div class="row"><span><span class="need-ic" aria-hidden="true">' + icons[k] + '</span> ' + labels[k] + '</span><span class="num">' + v + '</span></div>' +
        '<div class="bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v + '" aria-label="' + labels[k] + '"><i class="' + cls + '" style="width:' + v + '%"></i></div></div>';
    }).join('') + '</section>';
  }

  function board() {
    var isNarrow = window.matchMedia && window.matchMedia('(max-width: 899px)').matches;
    // The Map tab is the map alone, full width, on every screen: what you can do sits in its 📋 pop-up.
    if (ui.tab === 'map') return '<div class="board map-only"><section class="panel map-panel" aria-label="Map of Lagos">' + mapBlock() + '</section></div>' + bottomNav();
    var tabs = [['do', 'Do'], ['map', 'Map'], ['phone', '📱 Phone'], ['home', 'Home'], ['work', 'Work'], ['money', 'Money'], ['me', 'Me'], ['gist', 'Gist']];
    var debt = L.debts(S) > 0, unread = unreadCount();
    if (ui.tab === 'gist') markRead();
    var bar = '<div class="tabs" role="tablist">' + tabs.map(function (t) {
      return '<button class="tab' + (t[0] === 'map' ? ' tab-map' : '') + '" role="tab" id="tab-' + t[0] + '" data-tab="' + t[0] + '" aria-selected="' + (ui.tab === t[0]) + '">' + t[1] +
        (t[0] === 'money' && debt ? '<span class="dot" title="You owe money"></span>' : '') +
        (t[0] === 'phone' && unread ? '<span class="badge" aria-label="' + unread + ' unread">' + (unread > 99 ? '99+' : unread) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    var body = ({ do: doView, map: function () { return mapBlock(); }, phone: phoneView, home: houseTab, buy: buyView, work: workView, money: moneyView, me: meView, gist: gistView }[ui.tab] || doView)();
    return '<div class="board">' +
      // One map per layout: the desktop panel beside the tabs, or none on phones (the Map tab shows it).
      (isNarrow ? '' : '<section class="panel map-panel" aria-label="Map of Lagos">' + mapBlock() + '</section>') +
      '<section class="panel work-panel">' + bar + '<div class="tab-body">' + body + '</div></section></div>' + bottomNav();
  }

  /* ---------- map: the playground ---------- */
  var playground = null;
  // Map layers the viewer can switch off: place names, billboards and other players. Kept on this device.
  var LAYER_KEY = 'lasgidi.layers.v1';
  function mapLayers() { if (!ui.layers) { try { ui.layers = JSON.parse(localStorage.getItem(LAYER_KEY) || 'null'); } catch (e) {} ui.layers = ui.layers || { names: true, boards: true, players: true }; } return ui.layers; }
  function layerChips() {
    var l = mapLayers();
    return '<div class="pg-layers" role="group" aria-label="Map layers">' + [['names', '🏷️ Names'], ['boards', '🪧 Billboards'], ['players', '👥 Players']].map(function (x) {
      return '<button type="button" class="pg-chip' + (l[x[0]] ? ' sel' : '') + '" id="layer-' + x[0] + '" data-layer="' + x[0] + '" aria-pressed="' + !!l[x[0]] + '">' + x[1] + '</button>';
    }).join('') + '</div>';
  }
  function sceneFor() {
    var banner = '';
    if (S.econ.policy) banner = D.POLICIES[S.econ.policy].name + ' is law for ' + S.econ.policyWeeks + ' more week' + (S.econ.policyWeeks === 1 ? '' : 's');
    else if (S.econ.fuelDays) banner = 'Fuel scarcity: fares are up 60%';
    else if (S.econ.flood) banner = 'Flooding on the Island today';
    else if (L.isDecember(S)) banner = 'Detty December: prices up, parties everywhere';
    return {
      city: L.cityOf(S), loc: S.loc, sel: ui.sel, home: L.homeDef(S).district, work: S.job ? D.CAREERS[S.job.id].district : null,
      hour: L.hour(S), minute: S.t % 60, t: S.t, power: S.power, gridDown: S.econ.gridDown > 0, levy: S.econ.policy === 'power',
      flood: S.econ.flood > 0, fuel: S.econ.fuelDays > 0, peers: online.peers, others: online.others, faces: mapFaces(), players: mapPlayers(), layers: mapLayers(), showBoards: ui.placeCat === 'boards', weather: L.weatherNow(S), sea: { claims: seaClaims(), mine: online.me || 'me', sel: ui.seaOpen ? seaSel() : null }, trip: ui.trip && Date.now() - ui.trip.at < 2600 ? ui.trip : null,
      clock: L.clockLabel(S), banner: banner,
      places: ui.placeCat === 'boards' || ui.placeCat === 'homes' || ui.placeCat === 'cities' ? [] : D.PLACES.filter(function (p) { return L.districtCity(p.district) === L.cityOf(S) && (!ui.placeCat || p.type === ui.placeCat); }), place: ui.place,
      homeId: S.home, homePaint: myPaint(), homeSel: ui.homeSel, showHomes: ui.placeCat === 'homes', residents: residentCounts(),
      myPlot: L.myPlot(S), plotSel: ui.plotSel, plotOwners: plotOwners(),
      boards: boardAdsMap(), board: ui.board, gems: gemsLeft(),
      biz: S.businesses.filter(function (b) { return b.site; }).map(function (b) { return { district: b.site, icon: D.BUSINESS_GROWTH[b.id].icon }; })
    };
  }

  // The face in the HUD: draw the full avatar off-screen, then crop the head.
  var hudOff = null;
  function drawHudAvatar() {
    var c = document.getElementById('hud-avatar');
    if (!c || !S || !window.LasgidiAvatar) return;
    if (!hudOff) hudOff = document.createElement('canvas');
    try {
      window.LasgidiAvatar.draw(hudOff, S.look || { skin: 2, hair: 0, shape: 1 }, S.outfit || {}, myExtra());
      var r = hudOff.width / 180, g = c.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = 56 * dpr; c.height = 56 * dpr; c.style.width = '56px'; c.style.height = '56px';
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
      g.drawImage(hudOff, 40 * r, 2 * r, 100 * r, 100 * r, 0, 0, c.width, c.height);
    } catch (e) { /* the bars still work without a face */ }
  }

  /* ---------- first-run tour: four short tips, inline (never blocks a tap) ---------- */
  var TOUR_KEY = 'lasgidi.tour.v1';
  var TOUR = [
    ['🧭', 'Wetin I go do?', 'The advisor at the top suggests your next three moves. Tap one to do it: eat, sleep, go to work, or catch the right bus.'],
    ['🗺️', 'The map', 'Tap a district or a place to see what you can do there and how to get there. Gems, billboards, homes and other cities are all on the map.'],
    ['📱', 'Your phone', 'Messages, jobs, your bank, car dealers, the gem hunt, travel and the Hall of Fame are all in the Phone tab.'],
    ['💸', 'Money is hard', 'Rent is due every Saturday, prices rise every week, and PAYE comes off every shift. Save in the bank, buy bills, and build a business.']
  ];
  // While the first-run tour is still on, keep the map calm: no quest or government chips.
  function firstRun() { return tourStep() < TOUR.length; }
  function tourStep() { try { var v = localStorage.getItem(TOUR_KEY); return v == null ? 0 : +v; } catch (e) { return TOUR.length; } }
  function setTour(n) { try { localStorage.setItem(TOUR_KEY, String(n)); } catch (e) {} }
  function tourCard() {
    var n = tourStep();
    if (n >= TOUR.length || S.challenge) return '';
    var t = TOUR[n];
    return '<div class="tour" role="note"><span class="tour-ic">' + t[0] + '</span><div><b>' + esc(t[1]) + '</b><p>' + esc(t[2]) + '</p>' +
      '<div class="inline"><button class="btn sm" id="tour-next" data-tour="' + (n + 1) + '">' + (n + 1 < TOUR.length ? 'Next (' + (n + 1) + '/' + TOUR.length + ')' : 'Got it') + '</button><button class="link-btn" id="tour-skip" data-tour="' + TOUR.length + '">Skip the tour</button></div></div></div>';
  }

  /* ---------- multiplayer life: who is here, waves, home visits, gifts ---------- */
  // A player's approved photo, unless they switched it off.
  function photoOf(id) { return id && !online.photoOff[id] && online.photos[id] ? online.photos[id] : null; }
  function photoImg(id, cls, alt) { var p = photoOf(id); return p ? '<img class="' + (cls || 'pphoto') + '" alt="' + esc(alt || nameOf(id)) + '" src="' + p + '">' : ''; }
  var photoCache = {};
  function photoImage(id) {
    var src = photoOf(id); if (!src) return null;
    var im = photoCache[id];
    if (!im || im.src !== src) { im = photoCache[id] = new Image(); im.onload = function () { scheduleRender(); }; im.src = src; }
    return im.complete && im.naturalWidth ? im : null;
  }
  function nameOf(id) { return (online.names[id] && online.names[id].name) || 'A Lagosian'; }
  // A small public snapshot of your home for visitors; only written when it changes.
  function homeSnapshot() {
    var h = L.homeDef(S);
    return { home: S.home, items: S.items.filter(function (it) { return it.x != null; }).slice(0, 60).map(function (it) { return { id: it.id, x: it.x, y: it.y, r: it.r ? 1 : 0 }; }),
      vehicles: S.vehicles.slice(0, 24).map(function (v) { return v.id; }), party: myParty(), at: Date.now() };
  }
  var homeTimer = null;
  function publishHome() {
    if (!online.db || !online.me || online.canWrite === false || !S || S.challenge) return;
    if (homeTimer) return;
    homeTimer = setTimeout(function () {
      homeTimer = null;
      var snap = homeSnapshot(), key = JSON.stringify([snap.home, snap.items, snap.vehicles, snap.party]);
      if (key === online.sentHome) return;
      online.sentHome = key;
      online.db.doc('homes/' + online.me).set(snap).catch(function () { online.sentHome = ''; });
    }, 1500);
  }
  // Check a visitor's snapshot against the game's own data before drawing it.
  function checkHome(raw) {
    if (!raw || typeof raw !== 'object' || !D.HOMES[raw.home] || D.HOMES[raw.home].hidden) return null;
    var h = D.HOMES[raw.home], sz = D.ROOM_SIZES[h.type] || D.ROOM_SIZES.room;
    var items = Array.isArray(raw.items) ? raw.items.slice(0, 60).filter(function (it) {
      return it && D.FURNITURE[it.id] && Number.isInteger(it.x) && Number.isInteger(it.y) && it.x >= 0 && it.y >= 0 && it.x < sz[0] && it.y < sz[1];
    }).map(function (it) { return { id: it.id, x: it.x, y: it.y, r: it.r ? 1 : 0 }; }) : [];
    var vehicles = Array.isArray(raw.vehicles) ? raw.vehicles.slice(0, 24).filter(function (v) { return D.VEHICLES[v]; }).map(function (v) { return { id: v }; }) : [];
    return { home: raw.home, h: h, size: sz, items: items, vehicles: vehicles };
  }
  function peopleHere() {
    if (!online.room || !S) return '';
    var here = online.peerList.filter(function (p) { return p.d === S.loc; });
    if (!here.length) return '';
    var gifts = Object.keys(D.GIFTS);
    return '<div class="section people"><h3>👥 Lagosians here <span class="muted">· ' + here.length + ' in ' + esc(D.DISTRICTS[S.loc].name) + '</span></h3><div class="list">' + here.slice(0, 12).map(function (p) {
      var home = checkHome(online.homes[p.by]), waved = online.waved[p.by] && Date.now() - online.waved[p.by] < 30000;
      return '<div class="item person">' + photoImg(p.by) + '<div><h3>' + esc(nameOf(p.by)) + ' <span class="pc-handle">' + esc(handleOf(p.by)) + '</span></h3>' + (home ? '<div class="meta"><span>Lives in ' + esc(home.h.name) + '</span></div>' : '') + '</div><div class="inline">' +
        '<button class="btn sm ghost" id="wave-' + esc(p.by) + '" data-wave="' + esc(p.by) + '"' + (waved ? ' disabled' : '') + '>👋 ' + (waved ? 'Waved' : 'Wave') + '</button>' +
        '<button class="btn sm ghost" id="chat-' + esc(p.by) + '" data-chatopen="' + esc(p.by) + '">💬 Chat' + (online.unread[p.by] ? ' · ' + online.unread[p.by] : '') + '</button>' +
        (home ? '<button class="btn sm ghost" id="visit-' + esc(p.by) + '" data-visit2="' + esc(p.by) + '">🏠 Visit</button>' : '') +
        '<select id="giftsel-' + esc(p.by) + '" aria-label="Gift">' + gifts.map(function (g) { return '<option value="' + g + '">' + D.GIFTS[g].icon + ' ' + esc(D.GIFTS[g].name) + ' · ' + N(L.price(S, D.GIFTS[g].price)) + '</option>'; }).join('') + '</select>' +
        '<button class="btn sm" id="gift-' + esc(p.by) + '" data-gift="' + esc(p.by) + '">🎁 Send</button></div></div>';
    }).join('') + '</div><p class="note">Gifts lift their mood; no money changes hands between lives.</p></div>';
  }
  function giftInbox() {
    var g = online.giftsIn.filter(function (x) { return !Object.prototype.hasOwnProperty.call(S.giftsOpened || {}, x.from + ':' + x.raw.at); });
    if (!g.length || S.challenge) return '';
    return '<div class="section gifts"><h3>🎁 Gifts for you</h3><div class="list">' + g.slice(0, 6).map(function (x) {
      var G = D.GIFTS[x.raw.gift];
      return '<div class="item"><div><h3>' + G.icon + ' ' + esc(G.name) + '</h3><div class="meta"><span>From ' + esc(nameOf(x.from)) + '</span></div></div><button class="btn sm" id="open-' + esc(x.from) + '" data-opengift="' + esc(x.from) + '">Open</button></div>';
    }).join('') + '</div></div>';
  }
  var visitInterior = null;
  function visitView() {
    if (!ui.visit) return '';
    var v = checkHome(online.homes[ui.visit]);
    if (!v) { ui.visit = null; return ''; }
    var pt = partyOf(ui.visit), key = pt ? ui.visit + ':' + pt.at : '';
    var acts = pt ? '<div class="party-bar"><span>' + PARTY_KINDS[pt.kind].icon + ' You are at ' + esc(nameOf(ui.visit)) + '\'s ' + esc(PARTY_KINDS[pt.kind].name.toLowerCase()) + ' · ' + (guestsAt(ui.visit) + 1) + ' here</span>' + guestFaces(ui.visit, true) + '<div class="inline">' +
      '<button class="btn sm ghost" id="pbell" data-bell="' + esc(ui.visit) + '">🔔 Ring bell</button>' +
      Object.keys(D.PARTY_ACTS).map(function (k) { var A = D.PARTY_ACTS[k], done = Object.prototype.hasOwnProperty.call(S.partyJoins || {}, key + ':' + k);
        return '<button class="btn sm' + (done ? ' ghost' : ' go') + '" id="pact-' + k + '" data-partyact="' + k + '"' + (done ? ' disabled' : '') + '>' + A.icon + ' ' + esc(A.name) + '</button>'; }).join('') + '</div></div>' : '';
    return '<div class="section visit' + (pt ? ' party-on' : '') + '"><div class="inline" style="justify-content:space-between"><h3>🏠 ' + esc(nameOf(ui.visit)) + '\'s home · ' + esc(v.h.name) + '</h3><button class="btn sm ghost" id="visit-close" data-visit2="">Leave</button></div>' + acts + '<div class="visit-slot' + (pt && pt.planner ? ' decorated' : '') + '"></div>' +
      '<p class="note">' + v.items.length + ' pieces of furniture · ' + v.vehicles.length + ' vehicles. You can look, not touch.</p></div>';
  }
  function mountVisit() {
    if (!ui.visit || !window.LasgidiInterior) return;
    var slot = document.querySelector('.visit-slot'), v = checkHome(online.homes[ui.visit]);
    if (!slot || !v) return;
    if (!visitInterior) visitInterior = window.LasgidiInterior.create({ onSelect: function () {}, onPlace: function () {} });
    slot.appendChild(visitInterior.el);
    visitInterior.update({ size: v.size, type: v.h.type || 'room', name: v.h.name, items: v.items, vehicles: v.vehicles, sel: null, power: true, hour: 12,
      dark: document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) });
  }

  /* ---------- daily gem hunt ---------- */
  function gemToday() { return L.gemDayId(new Date()); }
  function gemsLeft() {
    if (!S || S.challenge) return [];
    var id = gemToday(), got = L.gemsFound(S, id);
    return L.gemsFor(id).map(function (g, n) { return { place: g.place, district: g.district, n: n }; }).filter(function (g) { return got.indexOf(g.n) < 0; });
  }
  function gemCard() {
    if (!S || S.challenge) return '';
    var id = gemToday(), gems = L.gemsFor(id), got = L.gemsFound(S, id), prize = L.nextGemPrize(S, id);
    var html = '<div class="section gem-card"><h3>💎 Daily gem hunt <span class="muted">· ' + got.length + '/' + gems.length + ' found' + (prize ? ' · next prize ' + N(prize) : ' · all found today') + '</span></h3>' +
      '<p class="note">Everyone gets the same five gems each day. Go to the place and pick it up; each one pays more than the last. New gems at midnight (UTC).</p><div class="list">';
    html += gems.map(function (g, n) {
      var pl = D.PLACES.filter(function (x) { return x.id === g.place; })[0], done = got.indexOf(n) >= 0, here = S.loc === g.district;
      return '<div class="item"><div><h3>' + (done ? '✅ ' : '💎 ') + esc(pl.name) + '</h3><div class="meta"><span>' + esc(D.DISTRICTS[g.district].name) + '</span></div></div>' +
        (done ? '<span class="muted">Found</span>' : here ? '<button class="btn sm" id="gem-' + n + '" data-gem="' + n + '">Pick it up</button>' : '<button class="btn sm ghost" id="gemgo-' + n + '" data-tripto="' + g.district + '">Go there</button>') + '</div>';
    }).join('');
    return html + '</div></div>';
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
  function pictureAds(boardId) {
    var now = Date.now();
    return online.adimg.map(function (d) { var a = L.checkPictureAd(d.raw, online.adpaid[d.id], now); return a && a.board === boardId ? Object.assign(a, { by: d.id, paid: true, picture: true, text: 'Picture ad', color: D.AD_COLORS[0], emoji: '🖼️' }) : null; })
      .filter(Boolean).sort(function (a, b) { return b.at - a.at; }).slice(0, 3);
  }
  function sponsoredPictures(boardId) {
    var now = Date.now();
    return online.sponsored.filter(function (r) { return r && r.board === boardId && typeof r.until === 'number' && r.until > now && r.until < now + 31 * 24 * 3600e3 && typeof r.img === 'string' && r.img.length <= L.PIC_MAX && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+\/]+={0,2}$/.test(r.img); })
      .map(function (r) { return { img: r.img, text: 'Sponsored', color: D.AD_COLORS[1], emoji: '📣', sponsored: true, paid: true, picture: true, until: r.until }; });
  }
  function adsForBoard(id, i) {
    var paid = sponsoredPictures(id).concat(sponsoredAds(id), pictureAds(id), paidAds(id).map(function (a) { return Object.assign(a, { paid: true }); }));
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
    if (a.img) return '<div class="ad ad-pic' + (big ? ' big' : '') + '"><img src="' + esc(a.img) + '" alt="Picture ad" width="320" height="160"></div>';
    return '<div class="ad' + (big ? ' big' : '') + '" style="background:' + a.color.bg + ';color:' + a.color.fg + '"><span class="ad-e">' + a.emoji + '</span><span class="ad-t">' + esc(a.text) +
      (a.line2 ? '<small>' + esc(a.line2) + '</small>' : '') + '</span></div>';
  }

  function boardView(id) {
    var b = D.BILLBOARDS.filter(function (x) { return x.id === id; })[0];
    if (!b) return '';
    var i = D.BILLBOARDS.indexOf(b), ads = adsForBoard(id, i), paid = ads.filter(function (a) { return a.paid; });
    var html = '<div class="inline" style="justify-content:space-between"><h3>Billboard · ' + esc(b.name) + '</h3><button class="btn sm ghost" id="close-board" data-closeboard="1">Close</button></div>' +
      '<p class="note">' + (paid.length ? '<span class="onair">ON AIR</span> ' + paid.length + ' ad' + (paid.length === 1 ? '' : 's') + ' take turns, 15 s each.' : 'No paid ads right now, so it shows public-service messages.') + ' <span class="ad-tag">Player ads</span> Ads are made by players with game money, not real brands or investments.</p>' +
      '<div class="ads">' + ads.map(function (a) {
        var who = a.sponsored ? 'Sponsored' : a.psa ? 'Public service' : (a.by === online.me ? 'Your ad' : ((online.names[a.by] && online.names[a.by].name) || 'A Lagosian'));
        var left = a.until ? Math.max(1, Math.round((a.until - Date.now()) / 3600e3)) + 'h left' : '';
        return '<div class="ad-card">' + adPreview(a, true) + '<div class="meta"><span>' + esc(who) + '</span>' + (left ? '<span>' + left + '</span>' : '') +
          (a.url ? '<a class="btn sm ghost" href="' + esc(a.url) + '" target="_blank" rel="noopener sponsored">Visit</a>' : '') + '</div></div>';
      }).join('') + '</div>';
    html += composerView(b, paid);
    html += pictureComposer(b);
    if (online.canEdit) html += reviewQueue();
    return html;
  }

  /* ---------- picture ads ---------- */
  function myPicture() {
    var now = Date.now(), mine = online.adimg.filter(function (d) { return d.id === online.me; })[0];
    return { approved: mine ? mine.raw : null, live: mine ? L.checkPictureAd(mine.raw, online.adpaid[online.me], now) : null };
  }
  function pictureComposer(b) {
    if (!online.db || !online.me || online.canWrite === false) return '';
    var plan = ui.ad.plan || 'day', mp = myPicture(), rv = online.myReview, html = '<div class="section"><h3>Picture ad</h3>';
    html += '<p class="note">Upload your own picture: a flyer, a product, your business. ' + (online.canEdit ? 'As an editor, you can post it straight away as a sponsored ad, or send it through review like everyone else.' : 'The owner reviews every picture before it can go up. You pay only after it is approved.') + '</p>';
    if (mp.live) html += '<p class="note"><span class="onair">ON AIR</span> Your picture is up at ' + esc(boardName(mp.live.board)) + ' for ' + Math.max(1, Math.round((mp.live.until - Date.now()) / 3600e3)) + ' more hours.</p>';
    else if (mp.approved && rv && rv.sub === mp.approved.sub) {
      var q = L.boardQuote(S, mp.approved.board, mp.approved.plan);
      html += adPreview({ img: mp.approved.img }, true) + '<div class="inline"><span class="gain">Approved for ' + esc(boardName(mp.approved.board)) + ' · ' + esc(D.AD_PLANS[mp.approved.plan].name) + '.</span><button class="btn go" id="pic-pay" data-picpay="1"' + (S.cash + S.bank < q || S.over ? ' disabled' : '') + '>Pay ' + N(q) + ' to go live</button></div>';
    } else if (rv && rv.status === 'rejected') html += '<p class="note cost">Your last picture was not approved. You can try a different one.</p>';
    else if (rv && !rv.status) html += adPreview({ img: rv.img }, true) + '<p class="note">Waiting for the owner to review your picture for ' + esc(boardName(rv.board)) + '.</p>';
    html += '<label class="label" for="ad-file">Choose a picture</label><input type="file" id="ad-file" accept="image/jpeg,image/png,image/webp">';
    if (ui.picDraft) {
      html += adPreview({ img: ui.picDraft }, true) + '<p class="note">Cropped to fit the board. Runs ' + esc(D.AD_PLANS[plan].name) + ' at ' + esc(b.name) + ' (pick the length above), ' + N(L.boardQuote(S, b.id, plan)) + ' once approved.</p>' +
        '<div class="inline"><button class="btn" id="pic-submit" data-picsubmit="' + b.id + '">Send for review</button>' +
        (online.canEdit ? '<button class="btn ghost" id="pic-sponsor" data-picsponsor="' + b.id + '">Post now as sponsored</button>' : '') + '</div>';
    }
    if (online.picStatus) html += '<p class="note">' + esc(online.picStatus) + '</p>';
    return html + '</div>';
  }
  function reviewQueue() {
    var q = online.adreview.filter(function (r) { return r.raw && typeof r.raw.img === 'string' && /^data:image\/(jpeg|png);base64,/.test(r.raw.img) && r.raw.img.length <= L.PIC_MAX; });
    var html = '<div class="section"><h3>Review picture ads <span class="muted">· ' + q.length + ' waiting</span></h3>';
    if (!q.length) return html + '<p class="note">Nothing to review.</p></div>';
    return html + '<div class="list">' + q.map(function (r) {
      var who = (online.names[r.id] && online.names[r.id].name) || 'A Lagosian', P = D.AD_PLANS[r.raw.plan];
      return '<div class="item review">' + adPreview({ img: r.raw.img }, false) + '<div><h3>' + esc(who) + '</h3><div class="meta"><span>' + esc(boardName(r.raw.board)) + '</span><span>' + esc(P ? P.name : '') + '</span></div>' +
        '<div class="inline"><button class="btn sm" id="rv-ok-' + esc(r.id) + '" data-rvok="' + esc(r.id) + '">Approve</button><button class="btn sm ghost" id="rv-no-' + esc(r.id) + '" data-rvno="' + esc(r.id) + '">Reject</button></div></div></div>';
    }).join('') + '</div></div>';
  }
  // Read a picked file, crop it to the board's 2:1 shape and re-encode as JPEG.
  function preparePicture(file, aspect) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) return reject(new Error('Pick a JPEG, PNG or WebP picture under 15 MB.'));
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var ar = aspect || 2, W = ar >= 1 ? 320 : Math.round(320 * ar), H = ar >= 1 ? Math.round(320 / ar) : 320, c = document.createElement('canvas'); c.width = W; c.height = H;
        var g = c.getContext('2d'), r = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * r, h = im.naturalHeight * r;
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
        URL.revokeObjectURL(url);
        var q = 0.8, out = c.toDataURL('image/jpeg', q);
        while (out.length > L.PIC_MAX - 2000 && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
        if (out.length > L.PIC_MAX - 2000) return reject(new Error('That picture is too detailed to fit. Try a simpler one.'));
        resolve(out);
      };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That file could not be read as a picture.')); };
      im.src = url;
    });
  }
  function randSub() { var a = 'abcdefghijklmnopqrstuvwxyz0123456789', o = ''; for (var i = 0; i < 12; i++) o += a[Math.floor(Math.random() * a.length)]; return o; }
  function picWriteError(err) { return err && err.code === 'invalid_argument' ? 'The board refused it: you may need Contributor access.' : 'It could not be saved. Try again in a moment.'; }

  function composerView(b, paid) {
    var plan = ui.ad.plan || 'day', cost = L.boardQuote(S, b.id, plan), mine = myAd(), sub = adSub(), others = paid.filter(function (a) { return !a.sponsored && a.by !== online.me; }).length;
    var html = '<div class="section"><h3>Put your ad here</h3>';
    if (!online.db || !online.me) return html + '<p class="note">Billboards are shared with everyone you share Lasgidi with. They work when the game is opened on claude.ai.</p></div>';
    if (online.canWrite === false) return html + '<p class="note">You can see the boards but not post. Ask the owner for Contributor access.</p></div>';
    if (others >= 3) return html + '<p class="note">This board is full. Try another one.</p></div>';
    var ad = ui.ad, slogans = L.adSlogans(S);
    if (!slogans.some(function (x) { return x.code === ad.slogan; })) ad.slogan = slogans[0].code;
    var preview = { emoji: D.AD_EMOJI[ad.emoji], text: L.sloganText(ad.slogan), color: D.AD_COLORS[ad.color] };
    html += '<p class="note">Pick an emoji, a slogan, a colour and how long it runs. Busier boards cost more' + (b.traffic ? ' (this one is ×' + b.traffic + ')' : '') + ', and longer runs are cheaper per day. Paid in in-game naira; time runs in real hours. You can have one ad up at a time' + (mine ? '; posting here replaces your ad at ' + esc(D.BILLBOARDS.filter(function (x) { return x.id === mine.board; })[0].name) : '') + '.</p>' +
      adPreview(preview, true) +
      '<div class="pick" role="group" aria-label="Emoji">' + D.AD_EMOJI.map(function (e, i) { return '<button type="button" class="pick-e' + (i === ad.emoji ? ' on' : '') + '" id="ade-' + i + '" data-ademoji="' + i + '" aria-pressed="' + (i === ad.emoji) + '">' + e + '</button>'; }).join('') + '</div>' +
      '<label class="label" for="ad-slogan">Slogan</label><select id="ad-slogan" data-adslogan="1">' + slogans.map(function (x) { return '<option value="' + esc(x.code) + '"' + (x.code === ad.slogan ? ' selected' : '') + '>' + esc(x.text) + '</option>'; }).join('') + '</select>' +
      '<div class="pick" role="group" aria-label="Colour">' + D.AD_COLORS.map(function (c, i) { return '<button type="button" class="pick-c' + (i === ad.color ? ' on' : '') + '" id="adc-' + i + '" data-adcolor="' + i + '" aria-pressed="' + (i === ad.color) + '" aria-label="Colour ' + (i + 1) + '" style="background:' + c.bg + ';color:' + c.fg + '">Aa</button>'; }).join('') + '</div>' +
      '<div class="label">How long</div><div class="pg-chips" style="padding:0">' + Object.keys(D.AD_PLANS).map(function (k) {
        var P = D.AD_PLANS[k], q = L.boardQuote(S, b.id, k);
        return '<button type="button" class="pg-chip' + (k === plan ? ' sel' : '') + '" id="adp-' + k + '" data-adplan="' + k + '">' + P.name + ' · ' + naira(q) + (P.days > 1 ? ' (' + naira(Math.round(q / P.days / 500) * 500) + '/day)' : '') + '</button>';
      }).join('') + '</div>' +
      '<label class="ad-sub"><input type="checkbox" id="ad-renew"' + (ui.ad.renew ? ' checked' : '') + '> Subscribe: renew automatically when it runs out (charged each time you open the game after it ends)</label>' +
      (sub ? '<p class="note">Subscribed: ' + esc(D.AD_PLANS[sub.plan].name) + ' at ' + esc(boardName(sub.board)) + '. <button type="button" class="link-btn" id="ad-unsub" data-adunsub="1">Cancel subscription</button></p>' : '') +
      '<div class="inline"><button class="btn go" id="ad-post" data-adpost="' + b.id + '"' + (S.cash + S.bank < cost || S.over ? ' disabled' : '') + '>Rent this board · ' + naira(cost) + '</button>' +
      (S.cash + S.bank < cost ? '<span class="why">You need ' + naira(cost - S.cash - S.bank) + ' more.</span>' : '') +
      (online.status ? '<span class="note">' + esc(online.status) + '</span>' : '') + '</div>';
    return html + '</div>';
  }
  function naira(n) { return N(n); }

  // Ad subscription: kept in this browser only; renews when the game is open after the ad ends.
  var ADSUB_KEY = 'lasgidi.adsub.v1';
  function adSub() {
    try { var v = JSON.parse(localStorage.getItem(ADSUB_KEY) || 'null'); return v && D.AD_PLANS[v.plan] && boardName(v.board) ? v : null; } catch (e) { return null; }
  }
  function setAdSub(v) { try { if (v) localStorage.setItem(ADSUB_KEY, JSON.stringify(v)); else localStorage.removeItem(ADSUB_KEY); } catch (e) {} }
  function boardName(id) { var b = D.BILLBOARDS.filter(function (x) { return x.id === id; })[0]; return b ? b.name : ''; }
  var renewTried = false;
  function maybeRenewAd() {
    var sub = adSub();
    if (renewTried || !sub || !S || S.over || S.challenge || !online.db || !online.me || online.canWrite === false || myAd()) return;
    renewTried = true;
    var keep = ui.ad;
    ui.ad = { emoji: sub.emoji, slogan: sub.slogan, color: sub.color, plan: sub.plan, renew: true };
    postAd(sub.board).then(function (res) {
      ui.ad = keep;
      run(function () { return res.ok ? { ok: true, msg: 'Ad subscription renewed at ' + boardName(sub.board) + '.' } : { ok: false, msg: 'Ad subscription not renewed: ' + res.msg }; });
    });
  }

  function postAd(boardId) {
    var ad = ui.ad, plan = ad.plan || 'day';
    var res = L.rentBoard(S, boardId, plan);
    if (!res.ok) return Promise.resolve(res);
    if (ad.renew) setAdSub({ board: boardId, plan: plan, emoji: ad.emoji, slogan: ad.slogan, color: ad.color });
    return online.db.doc('ads/' + online.me).set({ board: boardId, emoji: ad.emoji, slogan: ad.slogan, color: ad.color, at: Date.now(), until: Date.now() + res.days * 24 * 3600e3 })
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
    interior.update({ paint: myPaint(), size: L.roomSize(S), type: h.type || 'room', name: h.name, items: S.items, vehicles: S.vehicles, sel: ui.itemSel, power: S.power, hour: L.hour(S),
      dark: document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) });
  }
  var FX_NAMES = { sleep: 'sleep', power: 'light', gen: 'gen cost', fun: 'enjoyment', stress: 'stress', social: 'social', hunger: 'belle', energy: 'energy', hygiene: 'hygiene' };
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
    var room = L.staffRoom(S);
    html += '<div class="section"><h3>🧑‍🍳 Domestic staff</h3><p class="note">' + (room ? 'Your home has room for ' + room + ' staff (' + S.staff.length + ' hired). Paid every week from cash, then savings. Unpaid staff leave.' : 'There is no room for staff in a single room or flat share. A self-con or bigger has.') + '</p><div class="list">' + Object.keys(D.STAFF).map(function (k) {
      var St = D.STAFF[k], have = S.staff.indexOf(k) >= 0, fx = Object.keys(St.daily).map(function (n) { return (St.daily[n] > 0 ? '+' : '') + St.daily[n] + ' ' + FX_NAMES[n]; }).join(', ');
      var why = have ? '' : !room ? 'No room' : S.staff.length >= room ? 'No more room' : St.needsCar && !(S.vehicles.some(function (v) { return D.VEHICLES[v.id].kind === 'car'; }) || S.car) ? 'Needs a car' : '';
      return '<div class="item"><div><h3>' + St.icon + ' ' + esc(St.name) + (have ? ' <span class="gain">· hired</span>' : '') + '</h3><div class="meta"><span class="cost num">' + N(L.staffPay(S, k)) + '/wk</span><span>' + esc(fx) + ' a day</span></div><div class="act-note">' + esc(St.text) + '</div>' + (why ? '<div class="why">' + esc(why) + '</div>' : '') + '</div>' +
        (have ? '<button class="btn ghost" id="fire-' + k + '" data-firestaff="' + k + '">Let go</button>' : '<button class="btn" id="hire-' + k + '" data-hirestaff="' + k + '"' + (why ? ' disabled' : '') + '>Hire</button>') + '</div>';
    }).join('') + '</div></div>';
    var yard = L.hasYard(S);
    html += '<div class="section"><h3>🐾 Pets</h3><p class="note">Up to 3. Food and the vet are paid every week; a pet you cannot feed goes to a neighbour. Dogs need a compound' + (yard ? ' (you have one).' : ': a 2-bedroom flat or bigger.') + '</p><div class="list">' + Object.keys(D.PETS).map(function (k) {
      var P = D.PETS[k], have = S.pets.indexOf(k) >= 0, fx = Object.keys(P.daily).map(function (n) { return (P.daily[n] > 0 ? '+' : '') + P.daily[n] + ' ' + FX_NAMES[n]; }).join(', ');
      var why = have ? '' : P.yard && !yard ? 'Needs a compound' : S.pets.length >= 3 ? 'Three pets is plenty' : '';
      return '<div class="item"><div><h3>' + P.icon + ' ' + esc(P.name) + (have ? ' <span class="gain">· yours</span>' : '') + '</h3><div class="meta">' + (have ? '' : '<span class="cost num">' + N(L.price(S, P.price)) + '</span>') + '<span class="num">' + N(L.price(S, P.weekly)) + '/wk</span><span>' + esc(fx) + ' a day</span></div>' + (why ? '<div class="why">' + esc(why) + '</div>' : '') + '</div>' +
        (have ? '<button class="btn ghost" id="rehome-' + k + '" data-rehome="' + k + '">Rehome</button>' : '<button class="btn" id="pet-' + k + '" data-buypet="' + k + '"' + (why ? ' disabled' : '') + '>Adopt</button>') + '</div>';
    }).join('') + '</div></div>';
    html += '<div class="section"><h3>🩺 Health plan</h3><p class="note">' + (S.hmo ? 'You are on ' + esc(D.HMO[S.hmo].name) + '.' : 'Without a plan, every collapse costs a hospital bill.') + ' Premiums are paid every week; if one bounces, the plan lapses.</p><div class="list">' + Object.keys(D.HMO).map(function (k) {
      var H = D.HMO[k], on = S.hmo === k;
      return '<div class="item"><div><h3>' + H.icon + ' ' + esc(H.name) + (on ? ' <span class="gain">· active</span>' : '') + '</h3><div class="meta"><span class="cost num">' + N(L.price(S, H.weekly)) + '/wk</span></div><div class="act-note">' + esc(H.text) + '</div></div>' +
        (on ? '<button class="btn ghost" id="hmo-off" data-hmooff="1">Cancel</button>' : '<button class="btn" id="hmo-' + k + '" data-hmo="' + k + '">' + (S.hmo ? 'Switch' : 'Join') + '</button>') + '</div>';
    }).join('') + '</div></div>';
    html += '<div class="section"><h3>🎉 Host a party</h3><p class="note">Saturdays at home, 11:00 to 18:00, once every 4 weeks. Guests spray money, more for a well-dressed, well-connected host, but a party never pays for itself. Your friends will remember it. Add an event decorator (half the cost again) to transform the house; guests spray 25% more. Lagosians online get an invite for 30 minutes.</p><div class="list">' + Object.keys(D.PARTIES).map(function (k) {
      var P = D.PARTIES[k], why = L.partyBlock(S, k);
      return '<div class="item"><div><h3>' + P.icon + ' ' + esc(P.name) + '</h3><div class="meta"><span>' + P.guests + ' guests</span><span>' + dur(P.mins) + '</span><span class="cost num">' + N(L.price(S, P.cost)) + '</span>' + (P.types ? '<span>Needs a ' + esc(D.HOME_TYPES[P.types[0]].name.toLowerCase()) + ' or bigger</span>' : '') + '</div>' +
        (why ? '<div class="why">' + esc(why) + '</div>' : '') + '</div><div class="inline"><button class="btn" id="party-' + k + '" data-party="' + k + '"' + (why ? ' disabled' : '') + '>Host</button><button class="btn ghost" id="partyp-' + k + '" data-partyplan="' + k + '"' + (why ? ' disabled' : '') + ' title="Event decorator: +' + esc(N(L.price(S, P.cost * D.PLANNER_FACTOR))) + ', guests spray 25% more">+ Decorator</button></div></div>';
    }).join('') + '</div></div>';
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
    html += '<div class="section"><h3>Garage and hangar</h3>' + dealerView('Car dealers are on the map at Berger (Ikeja) and Lekki. You can also buy here.') + '</div>';
    return html + '</div>';
  }

  /* ---------- car dealer: showroom and my garage ---------- */
  // A vehicle's picture when one exists, else its emoji.
  function vehPic(id) { return pic('veh:' + id, D.VEHICLES[id].name, '<div class="dl-ic">' + D.VEHICLES[id].icon + '</div>', 'dl-pic'); }
  function dealerView(note) {
    var tab = ui.dealerTab || 'show', wallet = S.cash + S.bank;
    var html = '<div class="dl-head"><span class="muted">Wallet</span> <b class="num">' + N(wallet) + '</b></div>' +
      '<div class="seg"><button type="button" class="seg-b' + (tab === 'show' ? ' sel' : '') + '" id="dl-show" data-dealertab="show">🔑 Showroom</button>' +
      '<button type="button" class="seg-b' + (tab === 'garage' ? ' sel' : '') + '" id="dl-garage" data-dealertab="garage">🅿️ My garage</button></div>';
    if (tab === 'garage') {
      var worth = S.vehicles.reduce(function (a, v) { return a + Math.round(v.paid * 0.5 / 1000) * 1000; }, 0);
      var cars = S.vehicles.filter(function (v) { return D.VEHICLES[v.id].kind === 'car'; }).length;
      var driving = (function () { var V = L.bestCar(S); return V; })();
      html += '<div class="dl-sum"><span>' + S.vehicles.length + ' vehicle' + (S.vehicles.length === 1 ? '' : 's') + ' · ' + S.vehicles.length + '/12 spaces</span><span>Worth <b class="num">' + N(worth) + '</b> to the dealer</span></div>';
      if (!S.vehicles.length) html += '<p class="note">' + (S.car ? 'You drive the ' + esc(D.CAR.name) + '. ' : '') + 'Nothing parked yet. Pick something in the showroom.</p>';
      var groups = [['Garage', '🅿️', ['car']], ['Danfo park', '🚐', ['bus']], ['Marina', '⚓', ['boat']], ['Hangar', '🛫', ['heli', 'jet']]];
      groups.forEach(function (g) {
        var rows = S.vehicles.map(function (v, i) { return { v: v, i: i, V: D.VEHICLES[v.id] }; }).filter(function (o) { return g[2].indexOf(o.V.kind) >= 0; });
        if (!rows.length) return;
        var up = rows.reduce(function (a, o) { return a + L.vehicleUpkeep(S, o.v.id); }, 0), val = rows.reduce(function (a, o) { return a + Math.round(o.v.paid * 0.5 / 1000) * 1000; }, 0);
        html += '<h4 class="dl-group">' + g[1] + ' ' + g[0] + ' <span class="muted">· ' + rows.length + ' · upkeep ' + N(up) + '/wk · worth ' + N(val) + '</span></h4><div class="list">' + rows.map(function (o) {
          var v = o.v, i = o.i, V = o.V, isCar = V.kind === 'car';
          var on = isCar && (S.driving === i || (S.driving < 0 && driving === V && S.vehicles.findIndex(function (x) { return D.VEHICLES[x.id] === V; }) === i));
          var wi = L.wearInfo(S, i);
          return '<div class="item dl-car' + (on ? ' on' : '') + '">' + vehPic(v.id) + '<div><h3>' + esc(V.name) + '</h3><div class="meta">' + (wi ? '<span class="' + (wi.odds >= 0.02 ? 'cost' : '') + '">Wear ' + wi.wear + ' km · ' + (Math.round(wi.odds * 1000) / 10) + '% breakdown risk a trip</span>' : '') + '<span>Worth ' + N(Math.round(v.paid * 0.5 / 1000) * 1000) + ' to the dealer</span><span>Upkeep ' + N(L.vehicleUpkeep(S, v.id)) + '/wk</span></div></div>' +
            '<div class="dl-act">' + (isCar ? (on ? '<span class="gain dl-on">Driving</span>' : '<button class="btn sm ghost" id="drive-' + i + '" data-drive="' + i + '">Drive</button>') : '<span class="muted">' + (V.kind === 'boat' ? 'At the jetty' : V.kind === 'heli' ? 'On the helipad' : V.kind === 'bus' ? (S.danfoDriver ? 'On the road with a driver' : 'At the Ojuelegba park') : 'In the hangar') + '</span>') +
              (V.kind === 'bus' ? '<button class="btn sm' + (S.danfoDriver ? ' ghost' : '') + '" id="danfo-driver" data-danfodriver="' + (S.danfoDriver ? '0' : '1') + '">' + (S.danfoDriver ? 'Take off the road' : 'Hire a driver') + '</button>' : '') +
            '<button class="link-btn cost" id="sellv-' + i + '" data-sellveh="' + i + '">Sell</button></div></div>';
        }).join('') + '</div>';
      });
      if (cars > 1 && S.driving >= 0) html += '<div class="inline"><button class="btn sm ghost" id="drive-auto" data-drive="-1">Always take the fastest car</button></div>';
      if (cars && S.rules >= 12) {
        var sw = L.serviceBlock(S), sc = L.serviceCost(S);
        html += '<div class="section"><h3>🔧 Ladipo auto market</h3><p class="note">Every kilometre wears your car, and a worn car breaks down more (a roadside fix costs time and money). A service at Ladipo in Mushin resets the wear on all your cars.</p>' +
          '<div class="inline"><button class="btn sm' + (sw ? '' : ' go') + '" id="service" data-service="1"' + (sw ? ' disabled' : '') + '>Service' + (sc ? ' · ' + N(sc) : '') + '</button>' + (sw && sw.indexOf('Mushin') >= 0 ? '<button class="btn sm ghost" id="go-ladipo" data-tripto="mushin" data-tab="map">Go to Mushin</button>' : '') + '</div>' + (sw ? '<p class="why">' + esc(sw) + '.</p>' : '') + '</div>';
      }
      return html;
    }
    var kinds = [['car', '🚗 Cars'], ['bus', '🚐 Commercial'], ['boat', '🚤 Boats'], ['heli', '🚁 Helicopters'], ['jet', '🛩️ Jets']];
    var kind = ui.vehKind || 'car';
    html += (note ? '<p class="note">' + esc(note) + '</p>' : '') + '<div class="pg-chips" style="padding:0">' + kinds.map(function (k) { return '<button type="button" class="pg-chip' + (k[0] === kind ? ' sel' : '') + '" id="vk-' + k[0] + '" data-vehkind="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div><div class="list">' +
      (function () { var TO = Object.keys(D.VEHICLE_TIERS), last = null; return Object.keys(D.VEHICLES).filter(function (k) { return D.VEHICLES[k].kind === kind; }).sort(function (a, b) { var A = D.VEHICLES[a], B = D.VEHICLES[b]; return (A.tier ? TO.indexOf(A.tier) + 1 : 0) - (B.tier ? TO.indexOf(B.tier) + 1 : 0) || A.price - B.price; }).map(function (k) { var tr = D.VEHICLES[k].tier || '', h = tr !== last ? '<div class="dl-tier">' + esc(tr ? D.VEHICLE_TIERS[tr] : 'Classic range') + '</div>' : ''; last = tr; return [k, h]; }); })().map(function (kh) {
        var k = kh[0], V = D.VEHICLES[k], p = L.price(S, V.price), own = S.vehicles.filter(function (v) { return v.id === k; }).length;
        var what = V.kind === 'car' ? 'Top speed ' + V.speed + ' km/h on clear roads' : V.kind === 'boat' ? 'Use the jetties without waiting' : V.kind === 'heli' ? 'Anywhere in Lagos in about 30 minutes, ' + N(L.price(S, V.trip)) + ' a trip' : V.kind === 'bus' ? 'Danfo Runs with no owner\'s returns, or a driver for weekly returns (and risks)' : 'Fly it from any airport\'s Departures board; upkeep covers the hangar and crew';
        return kh[1] + '<div class="item dl-car">' + vehPic(k) + '<div><h3>' + esc(V.name) + (own ? ' <span class="muted">· own ' + own + '</span>' : '') + '</h3><div class="meta"><span class="cost num">' + N(p) + '</span><span>' + esc(what) + '</span><span>Upkeep ' + N(L.vehicleUpkeep(S, k)) + '/wk</span><span>+' + V.status + ' status</span></div></div>' +
          '<button class="btn sm" id="buyv-' + k + '" data-buyveh="' + k + '"' + (wallet >= p && S.vehicles.length < 12 ? '' : ' disabled') + '>Buy</button></div>';
      }).join('') + '</div>' + (kind === 'car' || kind === 'jet' || kind === 'boat' ? '<p class="note">Makes and models are named only to describe what you buy. Lasgidi is not affiliated with any maker. Upkeep covers insurance, servicing' + (kind === 'jet' ? ', the hangar and crew' : kind === 'boat' ? ', the marina berth and crew' : '') + '.</p>' : '');
    return html;
  }

  /* ---------- homes and the Mainland Estate ---------- */
  function clearPicks() { ui.chatWith = null; ui.sel = null; ui.place = null; ui.board = null; ui.homeSel = null; ui.plotSel = null; ui.seaSel = null; ui.seaOpen = false; online.status = ''; }
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
    return pic('home:' + (h.type || 'room'), h.name, '', 'pl-pic') + '<div class="inline" style="justify-content:space-between"><h3>' + esc(h.name) + '</h3><button class="btn sm ghost" id="close-home" data-closepick="1">Close</button></div>' +
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
    var chips = pl.acts.map(function (aid) { var def = (D.PLACE_ACTIONS[pl.district] || []).filter(function (x) { return x.id === aid; })[0]; return def ? '<span class="act-chip">' + actIcon(def) + ' ' + esc(def.label) + '</span>' : ''; }).join('');
    return '<div class="sheet-grab" aria-hidden="true"></div>' + pic('place:' + pl.id, pl.name, '', 'pl-pic') + '<div class="inline" style="justify-content:space-between"><h3 class="pl-title">' + (icon3d(pl.glyph) ? '<span class="pl-ic3d">' + icon3d(pl.glyph, pl.name) + '</span>' : '<span class="pl-ic" style="border-color:' + t.color + '">' + (pl.icon || '•') + '</span>') + '<span>' + esc(pl.name) + '<small>' + esc(D.DISTRICTS[pl.district].name) + '</small></span></h3><button class="btn sm ghost" id="close-place" data-closeplace="1">Close</button></div>' +
      '<p class="note"><span class="pl-type" style="color:' + t.color + '">' + esc(t.name) + '</span></p><p>' + esc(pl.text) + '</p>' +
      '<div class="inline"><button type="button" class="btn sm go" id="venue-' + pl.id + '" data-venue="' + pl.id + '">🚪 Walk in</button><button type="button" class="link-btn" id="share-' + pl.id + '" data-shareplace="' + pl.id + '">🔗 Share a link to ' + esc(pl.name) + '</button></div>' +
      (chips ? '<div class="act-chips">' + chips + '</div>' : '') +
      (rows ? '<div class="list">' + rows + '</div>' : '') +
      (pl.dealer ? dealerView() : '') +
      (DEP_PLACES[pl.id] ? departuresView(pl) : '') + (pl.club ? clubView(pl.club) : '') + (pl.cruise ? cruiseCard() : '') + roomCardFor(pl.id) + (pl.hydepark ? hydeParkView() : '') +
      (pl.id === 'airport' && !S.challenge ? japaView() : '') +
      (pl.hr ? hrCard(pl) : '') + (pl.shares ? sharesCard(pl) : '') +
      (function () { var g = gemsLeft().filter(function (x) { return x.place === pl.id; })[0]; return g ? '<div class="gem-here"><span>💎 A gem is hidden here.</span>' + (here ? '<button class="btn sm" id="gemp-' + g.n + '" data-gem="' + g.n + '">Pick it up · ' + N(L.nextGemPrize(S, gemToday())) + '</button>' : '<span class="muted">Go to ' + esc(D.DISTRICTS[pl.district].name) + ' to pick it up.</span>') + '</div>' : ''; })() +
      (here || pl.dealer ? '' : rideRow(pl.district));
  }
  // A workplace's HR desk: the career it hires for, with an Apply button when you are there.
  function hrCard(pl) {
    var cid = pl.hr, c = D.CAREERS[cid]; if (!c) return '';
    var e = L.jobEligibility(S, cid), mine = S.job && S.job.id === cid;
    var days = c.days.map(function (d) { return D.DAYS[d]; }).join(', ');
    return '<div class="section"><h3>🧑‍💼 HR office · ' + esc(c.name) + '</h3><p class="note">Starts as ' + esc(c.titles[0]) + ' on ' + N(c.pay[0]) + ' a shift, ' + pad(c.start) + ':00–' + pad(c.end) + ':00, ' + esc(days) + '. Needs ' + esc(D.SKILLS[c.skill]) + ' ' + c.req[0] + '. Top grade: ' + esc(c.titles[c.titles.length - 1]) + '.</p>' +
      '<div class="inline"><button class="btn sm go" id="hr-' + cid + '" data-apply="' + cid + '"' + (e.ok ? '' : ' disabled') + '>' + (mine ? 'You work here' : 'Apply for a job') + '</button>' + (!e.ok && !mine ? '<span class="why">' + esc(e.reason) + '</span>' : '') + '</div></div>';
  }
  // The listed company behind a site: today's share price, with a link to buy on the exchange.
  function sharesCard(pl) {
    var St = D.STOCKS[pl.shares]; if (!St) return '';
    var px = Math.round(L.stockPrice(S, pl.shares)), held = S.stocks && S.stocks[pl.shares];
    return '<div class="section"><h3>' + St.icon + ' ' + esc(St.name) + ' runs this plant</h3><p class="note">Listed on the exchange as ' + esc(St.ticker) + '. ' + (held && held.u ? 'You hold ' + held.u + ' shares.' : 'Buy shares through your broker in the Stocks app.') + '</p>' +
      '<div class="inline"><span class="act-chip">Per share <b>' + N(px) + '</b></span><span class="act-chip">10 shares <b>' + N(px * 10) + '</b></span><button class="btn sm" id="shares-' + pl.id + '" data-app="stocks" data-tab="phone">📈 Open Stocks</button></div></div>';
  }
  /* ---------- fishing: a card where there's water, and on the cruise rail ---------- */
  function fishingCard(compact) {
    var q = L.fishInfo(S), F = D.FISHING;
    if (!q.where && !compact) return '';
    var bagN = Object.keys(q.bag).reduce(function (a, k) { return a + q.bag[k]; }, 0);
    var bag = Object.keys(q.bag).map(function (k) { var c = F.catch.filter(function (x) { return x.id === k; })[0]; return c ? c.icon + ' ' + c.name + ' ×' + q.bag[k] : ''; }).filter(Boolean).join(' · ');
    var btns = !q.rod ? '<button class="btn sm go" id="fish-rod" data-fishrod="1">🎣 Buy a rod · ' + N(L.price(S, F.rod)) + '</button>'
      : '<button class="btn sm go" id="fish-cast" data-fishcast="1"' + (q.why ? ' disabled title="' + esc(q.why) + '"' : '') + '>🎣 Cast a line · ' + q.left + ' left today</button>' +
        (bagN ? '<button class="btn sm" id="fish-sell" data-fishsell="1"' + (q.where && q.where.indexOf('cruise') < 0 ? '' : ' disabled title="Sell at a waterfront"') + '>Sell · ' + N(q.bagValue) + '</button><button class="btn sm ghost" id="fish-cook" data-fishcook="1">🍲 Take home</button>' : '');
    if (compact) return '<div class="fish-row">' + btns.replace(/id="fish-/g, 'id="deck-fish-') + (bag ? '<small>' + esc(bag) + '</small>' : '') + '</div>';
    return '<div class="section fishing"><h3>🎣 Fishing at ' + esc(q.where) + '</h3><p class="note">45 minutes a cast, three casts a day. Most casts bring tilapia or catfish, sometimes nothing, and rarely a barracuda.</p><div class="inline">' + btns + '</div>' + (bag ? '<p class="note">In your bag: ' + esc(bag) + '</p>' : '') + (q.why && q.rod ? '<p class="why">' + esc(q.why) + '.</p>' : '') + '</div>';
  }
  /* ---------- photos: snap the deck or the map, label it, save it ---------- */
  function takePhoto(srcCanvas, caption) {
    if (!srcCanvas) return;
    try {
      var w = srcCanvas.width, h = srcCanvas.height, c = document.createElement('canvas'); c.width = w; c.height = h;
      var g = c.getContext('2d'); g.drawImage(srcCanvas, 0, 0);
      var fs = Math.max(14, Math.round(w / 45)); g.font = '800 ' + fs + 'px system-ui, sans-serif'; g.textAlign = 'right'; g.textBaseline = 'bottom';
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText('Lasgidi · ' + caption, w - fs + 2, h - fs + 2); g.fillStyle = '#ffffff'; g.fillText('Lasgidi · ' + caption, w - fs, h - fs);
      ui.photo = { url: c.toDataURL('image/png'), caption: caption, canvas: c }; showPhoto();
    } catch (e) { ui.toasts.push({ msg: 'Could not take the photo here.', ok: false }); renderToasts(); }
  }
  function showPhoto() {
    var old = document.getElementById('photo-view'); if (old) old.remove();
    if (!ui.photo) return;
    var el = document.createElement('div'); el.id = 'photo-view'; el.className = 'photo-view'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Your photo');
    el.innerHTML = '<div class="pv-top"><b>📷 Your photo</b><button class="btn sm ghost" id="photo-close" data-photoclose="1" aria-label="Close">✕</button></div>' +
      '<img class="pv-img" src="' + ui.photo.url + '" alt="Photo: ' + esc(ui.photo.caption) + '">' +
      '<div class="pv-bar"><button class="btn go big-go" id="photo-save" data-photosave="1">⬇ Save to phone</button><div class="inline" style="justify-content:space-between"><button class="btn sm ghost" id="photo-retake" data-photoretake="1">↺ Retake</button><span class="note" id="photo-status"></span></div></div>';
    document.body.appendChild(el);
    var b = document.getElementById('photo-save'); if (b) b.focus();
  }
  function savePhoto() {
    var st = document.getElementById('photo-status'), name = 'lasgidi-' + (ui.photo.caption || 'photo').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '.png';
    var say = function (m) { if (st) st.textContent = m; };
    ui.photo.canvas.toBlob(function (blob) {
      if (!blob) { say('Could not make the file.'); return; }
      var viaAnchor = function () { try { var a = document.createElement('a'); a.href = ui.photo.url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); say('Downloading…'); } catch (e) { say('Long-press the photo to save it.'); } };
      if (!window.claude || typeof window.claude.use !== 'function') { viaAnchor(); return; }
      window.claude.use('downloads').then(function (dl) {
        if (!dl) { viaAnchor(); return; }
        dl.save({ filename: name, data: blob }).then(function () { say('Saved.'); }, function (e) { say(e && e.code === 'declined' ? 'Not saved.' : 'Saving is not available here. Long-press the photo instead.'); });
      }, viaAnchor);
    }, 'image/png');
  }
  /* ---------- Lagoon Boat Cruise: a ticket card on the place sheet, then a full-screen deck ---------- */
  function cruiseCard() {
    var C = D.CRUISE, aboard = L.cruiseAboard(S), why = L.cruiseBlock(S), n = deckPeers().length;
    return '<section class="cruise-card"><div class="cc-top"><span>🛳️ LAGOON BOAT CRUISE</span><span>' + N(L.cruiseFare(S)) + '</span></div>' +
      '<p class="note">Two hours on the water from Five Cowries Creek: the deck bar, the sun deck, the party deck, the captain\'s helm and the rail. ' + (n ? n + ' player' + (n === 1 ? ' is' : 's are') + ' aboard now.' : 'Board and see who else is on deck.') + '</p>' +
      (aboard ? '<button class="btn go big-go" id="cruise-open" data-cruiseopen="1">Back on deck</button>'
        : '<button class="btn go big-go" id="cruise-board" data-cruiseboard="1"' + (why ? ' disabled title="' + esc(why) + '"' : '') + '>Board · ' + N(L.cruiseFare(S)) + '</button>' + (why ? '<p class="why">' + esc(why) + '.</p>' : '')) + '</section>';
  }
  function deckPeers() {
    return (online.peerList || []).filter(function (p) { return p.d === D.CRUISE.district && p.at && p.at.indexOf('cruise:') === 0 && D.CRUISE.spots[p.at.slice(7)] && !online.muted[p.by]; });
  }
  var cruiseStage = null, cruisePanelKey = '';
  var CREW = [{ by: 'crew:captain', label: 'Captain', spot: 'helm', crew: true, look: { skin: 4, hair: 6, shape: 2 }, outfit: { top: 'shirt', bottom: 'trousers' } },
    { by: 'crew:bar', label: 'Bartender', spot: 'bar', crew: true, look: { skin: 3, hair: 2, shape: 1 }, outfit: { top: 'st_ankara', bottom: 'st_jeans' } },
    { by: 'crew:dj', label: 'DJ', spot: 'party', crew: true, look: { skin: 5, hair: 5, shape: 1 }, outfit: { top: 'crop', bottom: 'joggers' } }];
  var STARTERS = ['st_tee', 'st_ankara', 'st_adire', 'st_asooke'];
  function deckScene() {
    var mt = myTag(), me = { by: online.me || 'me', label: handleOf(online.me), spot: S.cruise.spot, me: true, extra: myExtra(), look: S.look, outfit: S.outfit, tagc: mt && mt.color, tagi: mt && mt.ink };
    var peers = deckPeers().slice(0, 16).map(function (p) { var h = 0; for (var i = 0; i < p.by.length; i++) h = (h * 31 + p.by.charCodeAt(i)) >>> 0; return { by: p.by, label: handleOf(p.by), spot: p.at.slice(7), look: p.look, outfit: { top: STARTERS[h % 4], bottom: ['st_jeans', 'st_chinos', 'st_wrapper'][h % 3] } }; });
    var bubbles = {}, now = Date.now();
    (online.deck || []).forEach(function (m) { if (now - m.at < 7000) bubbles[m.by] = m.text; });
    var h0 = L.hour(S);
    return { players: CREW.concat(peers, [me]), spot: S.cruise.spot, bubbles: bubbles, night: h0 >= 19 || h0 < 6 };
  }
  function cruisePanel() {
    var C = D.CRUISE, peers = deckPeers(), left = Math.max(0, S.cruise.until - S.t);
    return '<div class="cv-head">' + (photoImg(online.me, 'cv-me') || '<span class="cv-me">🙂</span>') + '<div><b>🛳️ Lagoon Boat Cruise <span class="muted">· Five Cowries Creek</span></b><small>' + esc(S.cruise.last || 'The captain sounds the horn. ' + dur(left) + ' on the water.') + '</small></div>' +
      '<button class="btn sm ghost" id="cruise-photo" data-photo="cruise" aria-label="Take a photo">📷</button><button class="btn sm ghost" id="cruise-close" data-cruiseclose="1" aria-label="Back to the map">🗺️</button><button class="btn sm ghost" id="cruise-fold" data-cruisefold="1" aria-label="' + (ui.cruiseFold ? 'Show the panel' : 'Hide the panel') + '">' + (ui.cruiseFold ? '⌃' : '⌄') + '</button></div>' +
      (ui.cruiseFold ? '' : 
      '<div class="chat-send"><input id="deck-in" maxlength="' + CH.MAX + '" autocomplete="off" placeholder="Say something to the ' + (peers.length + 1) + ' player' + (peers.length ? 's' : '') + ' here…" aria-label="Deck chat"><button class="btn" id="deck-send" data-decksend="1" aria-label="Send">➤</button></div>' +
      (ui.deckWhy ? '<p class="why">' + esc(ui.deckWhy) + '</p>' : '') +
      '<div class="cv-spots">' + Object.keys(C.spots).map(function (k) { var P0 = C.spots[k], on = S.cruise.spot === k, n = peers.filter(function (p) { return p.at.slice(7) === k; }).length; return '<button type="button" class="act-chip' + (on ? ' on' : '') + '" id="spot-' + k + '" data-cruisespot="' + k + '">' + P0.icon + ' ' + esc(P0.name) + (P0.cost ? ' · ' + N(L.price(S, P0.cost)) : '') + (n ? ' · 👥' + n : '') + '</button>'; }).join('') + '</div>' +
      (S.cruise.spot === 'rail' ? fishingCard(true) : '') +
      '<div class="inline" style="justify-content:space-between"><p class="note cv-note">' + dur(left) + ' left on board. Tap a spot to move, or a player to chat. Chat is filtered and never stored.</p><button class="btn sm ghost" id="cruise-leave" data-cruiseleave="1">Leave the boat</button></div>');
  }
  function mountCruise() {
    var ov = document.getElementById('cruise-view');
    // Travelled off while still holding a ticket: you got off the boat (a recorded leave, after the trip).
    if (S && S.cruise && L.cruiseAboard(S) && S.loc !== D.CRUISE.district) { L.cruiseLeave(S); ui.cruiseOpen = false; save(); }
    var want = S && S.cruise && L.cruiseAboard(S) && ui.cruiseOpen;
    if (!want) { if (ov) ov.remove(); return; }
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'cruise-view'; ov.className = 'cruise-view'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Lagoon Boat Cruise');
      if (!cruiseStage) cruiseStage = window.LasgidiCruise.create({
        onSpot: function (k) { if (k !== S.cruise.spot) run(function () { return L.cruiseSpot(S, k); }); },
        onPlayer: function (by) { ui.cruiseOpen = false; clearPicks(); ui.chatWith = by; online.unread[by] = 0; ui.tab = 'map'; render(); }
      });
      var panel = document.createElement('div'); panel.className = 'cv-panel'; panel.id = 'cv-panel';
      ov.appendChild(cruiseStage.el); ov.appendChild(panel); document.body.appendChild(ov); cruisePanelKey = '';
    }
    var html = cruisePanel(), pn = document.getElementById('cv-panel');
    if (html !== cruisePanelKey) {
      var inp = document.getElementById('deck-in'), val = inp ? inp.value : '', foc = document.activeElement && document.activeElement.id === 'deck-in';
      pn.innerHTML = html; cruisePanelKey = html;
      var ni = document.getElementById('deck-in'); if (ni) { ni.value = val; if (foc) ni.focus(); }
    }
    cruiseStage.update(deckScene()); cruiseStage.start();
  }
  function sendDeck(text) {
    var r = CH.clean(text);
    if (!r.ok) { ui.deckWhy = r.why; mountCruise(); return; }
    var wait = CH.canSend(online.sentTimes, Date.now());
    if (wait) { ui.deckWhy = wait; mountCruise(); return; }
    ui.deckWhy = '';
    online.sentTimes = online.sentTimes.concat([Date.now()]).slice(-12);
    online.deck = (online.deck || []).concat([{ by: online.me || 'me', text: r.text, at: Date.now() }]).slice(-20);
    var ni = document.getElementById('deck-in'); if (ni) ni.value = '';
    if (online.room) online.room.emit('deck', { text: r.text }).catch(function () {});
    mountCruise();
  }
  /* ---------- white wedding planner: venue, planner, aso-ebi, vendors, theme, decor, extras, after-party ---------- */
  function wwDraft() { return ui.ww || (ui.ww = { venue: 'ikeja_centre', planner: 'standard', asoebi: 'family', vendors: 'classic', theme: 'gold_white', decor: 'elegant', extras: ['arch'], after: 'lounge' }); }
  function whiteWeddingView() {
    var W = D.WHITE_WEDDING, b = S.wwPlan;
    if (b && !b.done && Math.floor(S.t / 1440) <= b.date) {
      var V = W.venues[b.plan.venue], why = L.wwDayBlock(S), days = b.date - Math.floor(S.t / 1440);
      return '<div class="ww"><h3>' + (icon3d('rings', '') || '💒') + ' Your white wedding</h3><div class="ww-count"><b>' + (days > 0 ? days + ' day' + (days === 1 ? '' : 's') : 'Today') + '</b><span>' + D.DAYS[b.date % 7] + ', week ' + (Math.floor(b.date / 7) + 1) + ' · ' + esc(V.name) + ' · ' + b.guests + ' guests</span></div>' +
        '<canvas class="ww-hall" id="ww-hall" width="640" height="300" data-wwplan="' + esc(JSON.stringify(b.plan)) + '" aria-label="Your decorated hall"></canvas>' +
        '<p class="note">' + esc(W.themes[b.plan.theme].name) + ' · ' + esc(W.decor[b.plan.decor].text) + '</p><dl class="kv"><dt>Paid</dt><dd class="num">' + N(b.paid) + '</dd><dt>Balance on the day</dt><dd class="num">' + N(b.total - b.paid) + '</dd></dl>' +
        '<div class="inline"><button class="btn go" id="ww-hold" data-wwhold="1"' + (why ? ' disabled title="' + esc(why) + '"' : '') + '>💍 Walk down the aisle</button>' + (S.loc !== V.district ? '<button class="btn ghost" id="ww-go" data-tripto="' + V.district + '" data-tab="map">Go to ' + esc(D.DISTRICTS[V.district].name) + '</button>' : '') + '</div>' + (why ? '<p class="why">' + esc(why) + '.</p>' : '') + '</div>';
    }
    var d = wwDraft(), q = L.wwQuote(S, d);
    var row = function (key, label, opts, fmt) {
      return '<div class="ww-row"><span class="label">' + label + '</span><div class="pick">' + Object.keys(opts).map(function (k) { var on = d[key] === k; return '<button type="button" class="pg-chip' + (on ? ' sel' : '') + '" id="ww-' + key + '-' + k + '" data-wwset="' + key + ':' + k + '" aria-pressed="' + on + '">' + esc(opts[k].name) + (fmt ? ' · ' + fmt(opts[k]) : '') + '</button>'; }).join('') + '</div></div>';
    };
    var cost = function (o) { return o.cost ? N(L.price(S, o.cost)) : 'free'; };
    return '<details class="ww"' + (ui.wwOpen ? ' open' : '') + '><summary id="ww-open" data-wwopen="1">' + (icon3d('rings', '') || '💒') + ' Plan a white wedding</summary>' +
      '<p class="note">Church, then the reception and an after-party. Real planners take 6 to 12 months; in Lagos time you book a Saturday at least four weeks away, pay 30% now and the rest on the day.</p>' +
      row('venue', 'Venue', W.venues, function (o) { return N(L.price(S, o.cost)) + ', ' + o.guests + ' guests'; }) + row('planner', 'Planner', W.planners, cost) + row('asoebi', 'Aso-ebi', W.asoebi, cost) +
      row('vendors', 'Vendors (catering, photo, DJ, MC, makeup and gele)', W.vendors, function (o) { return N(L.price(S, o.perGuest)) + '/guest'; }) +
      '<div class="ww-row"><span class="label">Colour theme</span><div class="pick">' + Object.keys(W.themes).map(function (k) { var T = W.themes[k], on = d.theme === k; return '<button type="button" class="ww-sw' + (on ? ' on' : '') + '" id="ww-theme-' + k + '" data-wwset="theme:' + k + '" aria-pressed="' + on + '" title="' + esc(T.name) + '" style="background:linear-gradient(135deg,' + T.a + ' 50%,' + T.b + ' 50%)"><span class="sr">' + esc(T.name) + '</span></button>'; }).join('') + '<span class="muted">' + esc(W.themes[d.theme].name) + '</span></div></div>' +
      row('decor', 'Hall decoration', W.decor, cost) + '<p class="note">' + esc(W.decor[d.decor].text) + '</p>' +
      '<div class="ww-row"><span class="label">Extras</span><div class="pick">' + Object.keys(W.extras).map(function (k) { var on = d.extras.indexOf(k) >= 0; return '<button type="button" class="pg-chip' + (on ? ' sel' : '') + '" id="ww-x-' + k + '" data-wwextra="' + k + '" aria-pressed="' + on + '">' + esc(W.extras[k].name) + ' · ' + N(L.price(S, W.extras[k].cost)) + '</button>'; }).join('') + '</div></div>' +
      row('after', 'After-party', W.afterparty, cost) +
      '<canvas class="ww-hall" id="ww-hall" width="640" height="300" data-wwplan="' + esc(JSON.stringify(d)) + '" aria-label="Preview of your decorated hall"></canvas>' +
      (q.lines ? '<div class="ww-bill">' + q.lines.map(function (l) { return '<div><span>' + esc(l[0]) + '</span><span class="num">' + N(l[1]) + '</span></div>'; }).join('') + '<div class="ww-tot"><span>Total</span><span class="num">' + N(q.total) + '</span></div><div><span>Deposit now (30%)</span><span class="num">' + N(q.deposit) + '</span></div></div>' : '') +
      (q.disabled ? '<p class="why">' + esc(q.disabled) + '.</p>' : '') +
      '<button class="btn go" id="ww-book" data-wwbook="1"' + (q.disabled ? ' disabled' : '') + '>Book ' + (q.date != null ? D.DAYS[q.date % 7] + ', week ' + (Math.floor(q.date / 7) + 1) : 'the date') + ' · ' + N(q.deposit || 0) + '</button></details>';
  }
  // The hall, drawn from the plan: theme colours, drapes and lights, chandeliers, the stage, tables, the arch and sparks.
  function drawHall(cv) {
    var W = D.WHITE_WEDDING, p; try { p = JSON.parse(cv.getAttribute('data-wwplan')); } catch (e) { return; }
    var T = W.themes[p.theme] || W.themes.gold_white, g = cv.getContext('2d'), w = cv.width, h = cv.height, lvl = { simple: 0, elegant: 1, grand: 2 }[p.decor] || 0;
    var bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#2a2233'); bg.addColorStop(1, '#4a3b4f'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d9cbb8'; g.fillRect(0, h * 0.72, w, h * 0.28); // floor
    if (lvl >= 1) { for (var i = 0; i < 9; i++) { g.beginPath(); g.moveTo(i * w / 8, 0); g.quadraticCurveTo(i * w / 8 + w / 16, 60, (i + 1) * w / 8, 0); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 14; g.stroke(); }
      for (var f = 0; f < 70; f++) { var fx = (f * 97) % w, fy = 8 + (f * 37) % 70; g.fillStyle = 'rgba(255,236,170,' + (0.5 + (f % 3) * 0.15) + ')'; g.beginPath(); g.arc(fx, fy, 1.6, 0, Math.PI * 2); g.fill(); } }
    if (lvl >= 2) [w * 0.25, w * 0.5, w * 0.75].forEach(function (cx) { g.strokeStyle = '#c9b88a'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, 40); g.stroke(); for (var k = 0; k < 7; k++) { g.fillStyle = 'rgba(230,240,255,.9)'; g.beginPath(); g.arc(cx - 18 + k * 6, 46 + Math.abs(3 - k) * -2, 3, 0, Math.PI * 2); g.fill(); } g.fillStyle = 'rgba(255,240,200,.18)'; g.beginPath(); g.arc(cx, 48, 30, 0, Math.PI * 2); g.fill(); });
    // Stage and flower-wall backdrop in the theme colours.
    g.fillStyle = '#efe6d8'; g.fillRect(w * 0.3, h * 0.62, w * 0.4, h * 0.1);
    for (var r = 0; r < 6; r++) for (var c = 0; c < 18; c++) { g.fillStyle = (r + c) % 3 ? T.a : T.b; g.beginPath(); g.arc(w * 0.31 + c * (w * 0.38 / 17), h * 0.28 + r * 14, lvl ? 7 : 5, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffffff'; g.fillRect(w * 0.46, h * 0.5, w * 0.08, h * 0.12); g.fillStyle = T.a; g.fillRect(w * 0.46, h * 0.5, w * 0.08, 6); // couple's chairs
    // Round tables with centrepieces.
    for (var tb = 0; tb < 6; tb++) { var tx = w * (0.08 + tb * 0.168), ty = h * 0.86; g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(tx, ty, 34, 10, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = T.a; g.beginPath(); g.ellipse(tx, ty + 3, 34, 6, 0, 0, Math.PI); g.fill();
      var cp = lvl ? 26 : 12; g.strokeStyle = T.b; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, ty - 4); g.lineTo(tx, ty - cp); g.stroke(); g.fillStyle = T.a; g.beginPath(); g.arc(tx, ty - cp - 5, lvl ? 9 : 6, 0, Math.PI * 2); g.fill(); }
    if (p.extras && p.extras.indexOf('arch') >= 0) { g.lineWidth = 12; g.strokeStyle = T.b; g.beginPath(); g.arc(w * 0.06, h * 0.72, 46, Math.PI, 0); g.stroke(); for (var a = 0; a < 12; a++) { var an = Math.PI + a * Math.PI / 11; g.fillStyle = a % 2 ? T.a : '#ffffff'; g.beginPath(); g.arc(w * 0.06 + Math.cos(an) * 46, h * 0.72 + Math.sin(an) * 46, 6, 0, Math.PI * 2); g.fill(); } }
    if (p.extras && p.extras.indexOf('sparks') >= 0) [w * 0.36, w * 0.64].forEach(function (sx) { for (var k = 0; k < 18; k++) { g.strokeStyle = 'rgba(255,230,150,' + (0.4 + (k % 3) * 0.2) + ')'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx, h * 0.62); g.lineTo(sx + Math.sin(k) * 14, h * 0.62 - 18 - (k % 5) * 9); g.stroke(); } });
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '700 14px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(T.name + ' · ' + (W.decor[p.decor] ? W.decor[p.decor].name : ''), 12, h - 10);
  }
  /* ---------- Lekki Hyde Park: five zones, buy ready-built or build your own ---------- */
  function hydeParkView() {
    var H = D.HYDE_PARK, wallet = S.cash + S.bank, order = ['low', 'middle', 'billionaire', 'vip', 'super'];
    return '<section class="hp"><h3>🏡 Homes in Lekki Hyde Park</h3><p class="note">Gated, by the lagoon, with its own gate onto the Lekki–Epe Expressway. Every home pays the estate service charge each week. Building yourself costs less than buying ready-built, but takes about 18 days on site.</p>' +
      order.map(function (z) {
        var Z = H.zones[z], P = D.PROPERTIES[Z.house], PL = D.PROPERTIES[Z.plot], pr = L.price(S, P.price), pp = L.price(S, PL.price), q = L.hpInfo(S, z);
        var own = S.properties.some(function (p) { return p.id === Z.house; }), lives = S.home === P.home;
        var buildTotal = H.stages.reduce(function (a, st) { return a + Math.round(pr * st.share / 1000) * 1000; }, 0) + Math.round(pr * H.approval / 1000) * 1000;
        var body;
        if (own) body = '<span class="gain">✓ You own this' + (lives ? ' and live here' : '') + '</span>' + (lives ? '' : '<button class="btn sm" id="hp-move-' + z + '" data-move="' + P.home + '">Move in</button>');
        else if (q.hasPlot || q.done || q.working) {
          body = '<div class="hp-stages">' + H.stages.map(function (st, i) { return '<span class="' + (i < q.done ? 'done' : i === q.done && q.working ? 'now' : '') + '">' + st.icon + ' ' + esc(st.name) + '</span>'; }).join('') + '</div>' +
            (q.working ? '<span class="muted">Ready in ' + q.readyIn + ' day' + (q.readyIn === 1 ? '' : 's') + '</span>' : '<button class="btn sm go" id="hp-build-' + z + '" data-hpbuild="' + z + '"' + (q.why ? ' disabled title="' + esc(q.why) + '"' : '') + '>Start ' + esc(q.next.name.toLowerCase()) + ' · ' + N(q.cost) + '</button>' + (q.why ? '<span class="why">' + esc(q.why) + '</span>' : ''));
        } else body = '<div class="inline"><button class="btn sm" id="hp-buy-' + z + '" data-buyp="' + Z.house + '"' + (wallet >= pr ? '' : ' disabled') + '>Buy ready-built · ' + N(pr) + '</button><button class="btn sm ghost" id="hp-plot-' + z + '" data-buyp="' + Z.plot + '"' + (wallet >= pp ? '' : ' disabled') + '>Buy the plot · ' + N(pp) + '</button></div><span class="muted">Then build for about ' + N(buildTotal) + '</span>';
        return '<div class="hp-zone hp-' + z + '"><div class="hp-h"><b>' + esc(Z.name) + '</b><span class="hp-tier">' + esc(Z.tier) + '</span></div><div class="meta"><span>' + esc(Z.style) + '</span><span>+' + P.status + ' status</span><span>Service ' + N(L.price(S, P.charge)) + '/wk</span><span class="gain">Lets for ' + N(L.price(S, P.weekly)) + '/wk</span></div>' + body + '</div>';
      }).join('') + '</section>';
  }
  /* ---------- members-only clubs: a membership card, two ways in, then the members' list ---------- */
  function clubView(id) {
    var C = D.CLUBS[id], m = S.clubs && S.clubs[id], member = L.clubMember(S, id), qw = L.clubQuote(S, id, 'worth'), qr = L.clubQuote(S, id, 'referral');
    var left = member ? Math.ceil((m.until - S.t) / 1440) : 0;
    var html = '<section class="club"><div class="club-card' + (member ? ' on' : '') + '"><div class="cc-top"><span>MEMBERS ONLY</span><span>' + C.icon + '</span></div><b>' + esc(C.name) + '</b><small>' + esc(C.where) + '</small>' +
      (member ? '<div class="cc-mem">✓ Member · ' + left + ' day' + (left === 1 ? '' : 's') + ' left · ' + esc((S.name || '').toUpperCase()) + '</div>' : '<div class="cc-mem">Joining ' + N(L.price(S, C.join)) + ' · then ' + N(L.price(S, C.weekly)) + ' a week</div>') + '</div>' +
      '<p>' + esc(C.text) + '</p>';
    if (member) html += '<button class="btn" id="club-renew-' + id + '" data-joinclub="' + id + ':worth"' + (qw.disabled ? ' disabled title="' + esc(qw.disabled) + '"' : '') + '>Renew a week · ' + N(qw.total) + '</button>';
    else if (m && m.joined) html += '<p class="why">Your membership lapsed.</p><button class="btn go" id="club-renew-' + id + '" data-joinclub="' + id + ':worth"' + (qw.disabled ? ' disabled title="' + esc(qw.disabled) + '"' : '') + '>Renew · ' + N(qw.total) + '</button>';
    else html += '<div class="club-ways">' +
      '<div class="club-way"><b>💰 High net worth</b><span>' + N(L.price(S, C.minWorth)) + '+ net worth</span><span class="' + (qw.worthOk ? 'gain' : 'cost') + '">You: ' + N(L.netWorth(S)) + '</span><button class="btn go sm" id="club-worth-' + id + '" data-joinclub="' + id + ':worth"' + (qw.disabled ? ' disabled title="' + esc(qw.disabled) + '"' : '') + '>Apply · ' + N(qw.total) + '</button></div>' +
      '<div class="club-way"><b>🤝 Referral</b><span>A member vouches for you at status ' + C.referStatus + '+ or Charisma level ' + C.referCharisma + '+</span><span class="' + (qr.referOk ? 'gain' : 'cost') + '">You: status ' + L.statusPoints(S) + ', Charisma ' + L.skillLevel(S, 'charisma') + '</span><button class="btn sm" id="club-ref-' + id + '" data-joinclub="' + id + ':referral"' + (qr.disabled ? ' disabled title="' + esc(qr.disabled) + '"' : '') + '>Get referred · ' + N(qr.total) + '</button></div></div>' +
      ((qw.disabled && qr.disabled) ? '<p class="why">' + esc(qw.worthOk || qr.referOk ? (qw.worthOk ? qw.disabled : qr.disabled) : 'Not yet. Grow your net worth or your status.') + '</p>' : '');
    html += '<div class="list">' + L.clubActOptions(S, id).map(function (o) {
      return '<div class="item"><div><h3>' + esc(o.label) + '</h3><div class="meta"><span>' + dur(o.mins) + '</span>' + (o.cost ? '<span class="cost">' + N(o.cost) + '</span>' : '') + (o.when ? '<span>' + esc(whenText(o.when)) + '</span>' : '') + '</div></div><button class="btn sm" id="clubact-' + id + '-' + o.id + '" data-clubact="' + id + ':' + o.id + '"' + (o.disabled ? ' disabled title="' + esc(o.disabled) + '"' : '') + '>' + (member ? 'Go' : '🔒') + '</button></div>';
    }).join('') + '</div></section>';
    return html;
  }
  /* ---------- live rooms (beach, Tidewater House): the deck renderer with other layouts ---------- */
  var ROOM_CREW = {
    beach: [{ by: 'crew:bar', label: 'Barman', spot: 'bar', crew: true, look: { skin: 4, hair: 0, shape: 1 }, outfit: { top: 'st_ankara', bottom: 'st_chinos' } }, { by: 'crew:guard', label: 'Lifeguard', spot: 'jetski', crew: true, look: { skin: 3, hair: 6, shape: 2 }, outfit: { top: 'jersey', bottom: 'joggers' } }],
    club: [{ by: 'crew:dj', label: 'DJ', spot: 'dj', crew: true, look: { skin: 5, hair: 5, shape: 1 }, outfit: { top: 'crop', bottom: 'joggers' } }, { by: 'crew:bouncer', label: 'Bouncer', spot: 'vip', crew: true, look: { skin: 5, hair: 6, shape: 2 }, outfit: { top: 'blazer', bottom: 'trousers' } }, { by: 'crew:bar', label: 'Bartender', spot: 'bar', crew: true, look: { skin: 3, hair: 2, shape: 1 }, outfit: { top: 'st_tee', bottom: 'trousers' } }],
    market: [{ by: 'crew:mama', label: 'Mama Put', spot: 'buka', crew: true, look: { skin: 4, hair: 2, shape: 2 }, outfit: { top: 'st_ankara', bottom: 'st_wrapper' } }, { by: 'crew:seller', label: 'Fabric seller', spot: 'fabric', crew: true, look: { skin: 3, hair: 4, shape: 1 }, outfit: { top: 'st_asooke', bottom: 'st_wrapper' } }, { by: 'crew:alaaru', label: 'Alaaru', spot: 'gate', crew: true, look: { skin: 5, hair: 0, shape: 1 }, outfit: { top: 'st_tee', bottom: 'st_chinos' } }],
    park: [{ by: 'crew:band', label: 'Highlife band', spot: 'stage', crew: true, look: { skin: 4, hair: 3, shape: 1 }, outfit: { top: 'st_adire', bottom: 'trousers' } }, { by: 'crew:suya', label: 'Suya man', spot: 'food', crew: true, look: { skin: 5, hair: 6, shape: 1 }, outfit: { top: 'st_tee', bottom: 'st_chinos' } }],
    tidewater: [{ by: 'crew:dj', label: 'DJ', spot: 'dj', crew: true, look: { skin: 5, hair: 5, shape: 1 }, outfit: { top: 'crop', bottom: 'joggers' } }, { by: 'crew:chef', label: 'Chef', spot: 'oven', crew: true, look: { skin: 2, hair: 6, shape: 1 }, outfit: { top: 'st_tee', bottom: 'trousers' } }, { by: 'crew:bar', label: 'Bartender', spot: 'bar', crew: true, look: { skin: 4, hair: 2, shape: 1 }, outfit: { top: 'shirt', bottom: 'trousers' } }],
    wuse2: [{ by: 'crew:dj', label: 'DJ', spot: 'dj', crew: true, look: { skin: 4, hair: 5, shape: 1 }, outfit: { top: 'crop', bottom: 'joggers' } }, { by: 'crew:hype', label: 'Hype man', spot: 'spray', crew: true, look: { skin: 5, hair: 6, shape: 2 }, outfit: { top: 'st_adire', bottom: 'trousers' } }],
    wuse_mkt: [{ by: 'crew:mama', label: 'Mama Put', spot: 'buka', crew: true, look: { skin: 4, hair: 2, shape: 2 }, outfit: { top: 'st_ankara', bottom: 'st_wrapper' } }, { by: 'crew:mai', label: 'Mai shayi', spot: 'gate', crew: true, look: { skin: 3, hair: 6, shape: 1 }, outfit: { top: 'shirt', bottom: 'st_chinos' } }],
    millennium: [{ by: 'crew:choir', label: 'Choir', spot: 'stage', crew: true, look: { skin: 3, hair: 2, shape: 1 }, outfit: { top: 'st_tee', bottom: 'st_wrapper' } }, { by: 'crew:suya', label: 'Suya man', spot: 'food', crew: true, look: { skin: 5, hair: 6, shape: 1 }, outfit: { top: 'shirt', bottom: 'st_chinos' } }],
    garden_city: [{ by: 'crew:dj', label: 'DJ', spot: 'dj', crew: true, look: { skin: 5, hair: 5, shape: 1 }, outfit: { top: 'crop', bottom: 'joggers' } }, { by: 'crew:bouncer', label: 'Bouncer', spot: 'vip', crew: true, look: { skin: 5, hair: 6, shape: 2 }, outfit: { top: 'blazer', bottom: 'trousers' } }],
    mile1: [{ by: 'crew:bole', label: 'Bole mama', spot: 'buka', crew: true, look: { skin: 4, hair: 4, shape: 2 }, outfit: { top: 'st_ankara', bottom: 'st_wrapper' } }, { by: 'crew:fish', label: 'Fish seller', spot: 'shoes', crew: true, look: { skin: 5, hair: 2, shape: 1 }, outfit: { top: 'st_tee', bottom: 'st_wrapper' } }],
    isaac_boro: [{ by: 'crew:band', label: 'Ogene band', spot: 'stage', crew: true, look: { skin: 5, hair: 3, shape: 1 }, outfit: { top: 'st_adire', bottom: 'trousers' } }, { by: 'crew:corn', label: 'Corn seller', spot: 'food', crew: true, look: { skin: 4, hair: 2, shape: 2 }, outfit: { top: 'st_ankara', bottom: 'st_wrapper' } }],
  };
  function roomCardFor(placeId) {
    var id = Object.keys(D.ROOMS).filter(function (k) { return D.ROOMS[k].place === placeId; })[0]; if (!id) return '';
    var R = D.ROOMS[id], inRoom = L.roomIn(S, id), why = L.roomBlock(S, id), n = roomPeers(id).length;
    var rd = D.PLACES.filter(function (x) { return x.id === R.place; })[0].district, rc = L.districtCity(rd);
    if (why && rc !== L.cityOf(S)) why = 'Travel to ' + D.CITIES[rc].name + ' first, then ' + D.DISTRICTS[rd].name;
    var firstVisit = L.passportInfo(S).rooms[id] == null;
    return '<section class="cruise-card room-card"><div class="cc-top"><span>📍 LIVE ROOM · ' + esc(R.name.toUpperCase()) + (firstVisit ? ' · 🛂 FIRST VISIT' : '') + '</span><span>' + (L.roomFee(S, id) ? N(L.roomFee(S, id)) : R.club ? 'Members' : R.fee ? 'Free with a friend' : 'Free') + '</span></div>' +
      '<p class="note">' + (n ? n + ' player' + (n === 1 ? ' is' : 's are') + ' here now. ' : '') + 'Step in, move between spots and chat with everyone there. ' + (D.ROOM_NIGHTS[id] ? (function (I) { return I.n.icon + ' ' + (I.live ? 'On now: ' : 'Every ') + esc(I.live ? I.n.name : I.n.name + ' (' + I.why + ')') + '. '; })(L.roomNightInfo(S, id)) : '') + 'Open ' + R.from + ':00–' + (R.to === 24 ? 'midnight' : (R.to % 24) + ':00') + '.</p>' +
      (inRoom ? '<button class="btn go big-go" id="room-open" data-roomopen="' + id + '">Back in</button>' : '<button class="btn go big-go" id="room-enter" data-roomenter="' + id + '"' + (why ? ' disabled title="' + esc(why) + '"' : '') + '>Go in' + (L.roomFee(S, id) ? ' · ' + N(L.roomFee(S, id)) : '') + '</button>' + (why ? '<p class="why">' + esc(why) + '.</p>' : '')) + '</section>';
  }
  function roomPeers(id) {
    var pre = 'room:' + id + ':';
    var dist = D.PLACES.filter(function (x) { return x.id === D.ROOMS[id].place; })[0].district;
    return (online.peerList || []).filter(function (p) { return p.d === dist && p.at && p.at.indexOf(pre) === 0 && D.ROOMS[id].spots[p.at.slice(pre.length)] && !online.muted[p.by]; });
  }
  var roomStage = null, roomKey = '';
  function roomScene(id) {
    var pre = 'room:' + id + ':', me = { by: online.me || 'me', label: handleOf(online.me), spot: S.room.spot, me: true, extra: myExtra(), look: S.look, outfit: S.outfit, tagc: (myTag() || {}).color, tagi: (myTag() || {}).ink };
    var peers = roomPeers(id).slice(0, 16).map(function (p) { var h = 0; for (var i = 0; i < p.by.length; i++) h = (h * 31 + p.by.charCodeAt(i)) >>> 0; return { by: p.by, label: handleOf(p.by), spot: p.at.slice(pre.length), look: p.look, outfit: { top: STARTERS[h % 4], bottom: ['st_jeans', 'st_chinos', 'st_wrapper'][h % 3] } }; });
    var bubbles = {}, now = Date.now(); (online.roomChat || []).forEach(function (m) { if (m.room === id && now - m.at < 7000) bubbles[m.by] = m.text; });
    var h0 = L.hour(S); var R0 = D.ROOMS[id], lay = R0.layout || id; var NPC_LOOKS = [{ skin: 4, hair: 2, shape: 1 }, { skin: 2, hair: 4, shape: 0 }, { skin: 5, hair: 6, shape: 2 }, { skin: 3, hair: 1, shape: 1 }, { skin: 1, hair: 3, shape: 0 }], NPC_TOPS = ['st_asooke', 'shirt', 'blazer', 'jersey', 'crop'];
    var friends = roomFriends(id).map(function (f, i) { var h = f.id.length + f.id.charCodeAt(0); return { by: 'npc:' + f.id, label: f.name, spot: f.spot, crew: true, npc: true, look: NPC_LOOKS[h % 5], outfit: { top: NPC_TOPS[h % 5], bottom: f.local ? 'st_wrapper' : 'trousers' } }; });
    var NI = L.roomNightInfo(S, id), extra = NI && NI.live ? [{ by: 'crew:night', label: NI.n.crew, spot: NI.n.spot || Object.keys(R0.spots)[0], crew: true, look: { skin: 4, hair: 3, shape: 1 }, outfit: { top: 'st_adire', bottom: 'trousers' } }] : []; return { room: id, layout: lay, sign: R0.sign, topPad: 100, event: !!(NI && NI.live), players: (ROOM_CREW[id] || []).concat(extra, friends, peers, [me]), spot: S.room.spot, bubbles: bubbles, night: lay === 'club' || h0 >= 19 || h0 < 6 };
  }
  // Friends in a room: Lagos NPC friends plus local friends in Abuja and PH.
  function roomFriends(id) {
    var out = Object.keys(D.ROOM_NPCS[id] || {}).map(function (k) { return { id: k, name: D.NPCS[k].name, spot: D.ROOM_NPCS[id][k], lvl: S.friends[k].lvl }; });
    L.localsInfo(S).forEach(function (f) { if (f.room === id) out.push({ id: f.id, name: f.name, spot: D.LOCALS[f.id].spot, lvl: f.lvl, local: true, perk: f.perk }); });
    return out;
  }
  function roomFriendChips(id) {
    var fs = roomFriends(id); if (!fs.length) return '';
    return '<div class="cv-spots room-friends">' + fs.map(function (f) { var why = L.roomHangBlock(S, id, f.id); return '<button type="button" class="act-chip" id="rhang-' + f.id + '" data-roomhang="' + f.id + '"' + (why ? ' disabled title="' + esc(why) + '"' : '') + '>👋 ' + (why ? esc(f.name) + ' ✓' : 'Hang out with ' + esc(f.name)) + ' · ' + f.lvl + '/100' + (f.local && S.rules >= 15 ? (f.lvl >= 40 ? (f.perk.entry ? ' · 🎟️ free entry' : ' · 🍛 free plate') : ' · perk at 40') : '') + '</button>'; }).join('') + '</div>';
  }
  function roomNightBar(id) {
    var I = L.roomNightInfo(S, id); if (!I || !I.live) return '';
    return '<div class="room-night"><span>' + I.n.icon + ' <b>Tonight: ' + esc(I.n.name) + '</b> · ' + (I.fee ? N(I.fee) : 'free') + '</span>' +
      (I.joined ? '<span class="muted">You are in ✓</span>' : '<button class="btn sm go" id="room-night" data-roomnight="' + id + '"' + (I.why ? ' disabled title="' + esc(I.why) + '"' : '') + '>Join</button>') + '</div>';
  }
  function roomPanel(id) {
    var R = D.ROOMS[id], peers = roomPeers(id), left = Math.max(0, S.room.until - S.t);
    return '<div class="cv-head">' + (photoImg(online.me, 'cv-me') || '<span class="cv-me">🙂</span>') + '<div><b>📍 ' + esc(R.name) + ' <span class="muted">· ' + esc(R.where) + '</span></b><small>' + esc(S.room.last || dur(left) + ' here. Pick a spot.') + '</small></div>' +
      '<button class="btn sm ghost" id="room-photo" data-photo="room" aria-label="Take a photo">📷</button><button class="btn sm ghost" id="room-close" data-roomclose="1" aria-label="Back to the map">🗺️</button><button class="btn sm ghost" id="room-fold" data-roomfold="1" aria-label="' + (ui.roomFold ? 'Show the panel' : 'Hide the panel') + '">' + (ui.roomFold ? '⌃' : '⌄') + '</button></div>' +
      (ui.roomFold ? '' : '<div class="chat-send"><input id="room-in" maxlength="' + CH.MAX + '" autocomplete="off" placeholder="Say something to the ' + (peers.length + 1) + ' player' + (peers.length ? 's' : '') + ' here…" aria-label="Room chat"><button class="btn" id="room-send" data-roomsend="1" aria-label="Send">➤</button></div>' +
      (ui.roomWhy ? '<p class="why">' + esc(ui.roomWhy) + '</p>' : '') + roomNightBar(id) + roomFriendChips(id) +
      '<div class="cv-spots">' + Object.keys(R.spots).map(function (k) { var P0 = R.spots[k], on = S.room.spot === k, n = peers.filter(function (p) { return p.at.slice(('room:' + id + ':').length) === k; }).length; return '<button type="button" class="act-chip' + (on ? ' on' : '') + '" id="rspot-' + k + '" data-roomspot="' + k + '">' + P0.icon + ' ' + esc(P0.name) + (P0.cost ? ' · ' + N(L.price(S, P0.cost)) : '') + (n ? ' · 👥' + n : '') + '</button>'; }).join('') + '</div>' +
      (id === 'beach' ? fishingCard(true) : '') +
      '<div class="inline" style="justify-content:space-between"><p class="note cv-note">' + dur(left) + ' left. Tap a spot to move, or a player to chat. Chat is filtered and never stored.</p><button class="btn sm ghost" id="room-leave" data-roomleave="1">Leave</button></div>');
  }
  function mountRoom() {
    var ov = document.getElementById('room-view');
    if (S && S.room && L.roomIn(S, S.room.id) && S.loc !== D.PLACES.filter(function (p) { return p.id === D.ROOMS[S.room.id].place; })[0].district) { L.roomLeave(S); ui.roomOpen = null; save(); }
    var id = S && S.room && L.roomIn(S, S.room.id) && ui.roomOpen === S.room.id ? S.room.id : null;
    if (!id) { if (ov) ov.remove(); return; }
    if (ov && ov.getAttribute('data-room') !== id) { ov.remove(); ov = null; }
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'room-view'; ov.className = 'cruise-view room-view room-' + id; ov.setAttribute('data-room', id); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', D.ROOMS[id].name);
      if (!roomStage) roomStage = window.LasgidiCruise.create({
        onSpot: function (k) { if (S.room && k !== S.room.spot) run(function () { return L.roomSpot(S, S.room.id, k); }); },
        onPlayer: function (by) { if (by.indexOf('npc:') === 0) { var nk = by.slice(4); run(function () { return L.roomHang(S, S.room.id, nk); }); return; } ui.roomOpen = null; clearPicks(); ui.chatWith = by; online.unread[by] = 0; ui.tab = 'map'; render(); }
      });
      var pn = document.createElement('div'); pn.className = 'cv-panel'; pn.id = 'room-panel'; ov.appendChild(roomStage.el); ov.appendChild(pn); document.body.appendChild(ov); roomKey = '';
    }
    var html = roomPanel(id), pn2 = document.getElementById('room-panel');
    if (html !== roomKey) { var inp = document.getElementById('room-in'), val = inp ? inp.value : '', foc = document.activeElement && document.activeElement.id === 'room-in'; pn2.innerHTML = html; roomKey = html; var ni = document.getElementById('room-in'); if (ni) { ni.value = val; if (foc) ni.focus(); } }
    roomStage.update(roomScene(id)); roomStage.start();
  }
  function sendRoom(text) {
    var r = CH.clean(text); if (!r.ok) { ui.roomWhy = r.why; mountRoom(); return; }
    var wait = CH.canSend(online.sentTimes, Date.now()); if (wait) { ui.roomWhy = wait; mountRoom(); return; }
    ui.roomWhy = ''; online.sentTimes = online.sentTimes.concat([Date.now()]).slice(-12);
    online.roomChat = (online.roomChat || []).concat([{ room: S.room.id, by: online.me || 'me', text: r.text, at: Date.now() }]).slice(-30);
    var ni = document.getElementById('room-in'); if (ni) ni.value = '';
    if (online.room) online.room.emit('deck', { room: S.room.id, text: r.text }).catch(function () {});
    mountRoom();
  }
  /* ---------- walk-in venues: every place on the map as a small yard with its people and rides ---------- */
  var venueStage = null, venueKey = '';
  var VENUE_CREW = {
    refinery: [['Plant hand', 'Shift change is at two. Hard hat on before the gate.', 1], ['Process engineer', 'Column three is running hot today.', 1], ['Security', 'Visitors sign the book first, abeg.', 0], ['Tanker driver', 'Loading since six. Na so the work be.', 1], ['Visitor', 'The flare stack is bigger than I thought.', 0]],
    airport: [['Traveller', 'Boarding in forty minutes. Where is gate three?', 0], ['Ground crew', 'Chocks in, fuel truck next.', 1], ['Pilot', 'Clear skies over Abuja this evening.', 0], ['Cab driver', 'Island or mainland? Traffic is bad at Ikeja.', 0]],
    transport: [['Conductor', 'Oshodi! Oshodi! Enter with your change!', 0], ['Driver', 'We move when the bus full.', 0], ['Passenger', 'This queue no dey move at all.', 0], ['Hawker', 'Gala, Lacasera, pure water!', 0]],
    food: [['Mama Put', 'Rice, beans, dodo. Wetin you go chop?', 0], ['Customer', 'The stew here is sweet die.', 0], ['Waiter', 'Small chops are coming now.', 0]],
    nightlife: [['DJ', 'Next song go burst your head.', 0], ['Bouncer', 'No shorts tonight, boss.', 0], ['Raver', 'This party no get part two!', 0]],
    culture: [['Guide', 'This piece is older than Lagos itself.', 0], ['Artist', 'I paint the danfos at dawn.', 0], ['Tourist', 'Take my picture with the statue, please.', 0]],
    outdoors: [['Jogger', 'Five laps before the sun gets hot.', 0], ['Family', 'The children want ice cream again.', 0], ['Hawker', 'Coconut! Fresh coconut!', 0]],
    learn: [['Student', 'Exams start Monday. I never read.', 0], ['Teacher', 'Sit down, the class has started.', 0], ['Lab tech', 'Do not touch that beaker.', 0]],
    services: [['Clerk', 'Come back with two passport photos.', 0], ['Customer', 'The network is down again.', 0], ['Security', 'Drop your bag in the tray.', 0]]
  };
  var VENUE_RIDES = { danfo: 1, brt: 1, cab: 1, keke: 1, okada: 1, car: 1 };
  function venueSet(pl) {
    if (/refinery|yards|docks/.test(pl.id)) return 'refinery';
    if (DEP_PLACES[pl.id] || pl.id === 'new_airport_site' || pl.glyph === 'plane') return 'airport';
    return VENUE_CREW[pl.type] ? pl.type : 'outdoors';
  }
  function vHash(str, n) { var h = 2166136261; for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return Math.imul(h ^ n, 2654435761) >>> 0; }
  // A stranger dressed from the wardrobe, the same each game hour.
  function venueStranger(seed, ix) {
    var h = vHash(seed, ix), ids = Object.keys(D.CLOTHES), pick = function (slot, k) { var l = ids.filter(function (c) { return D.CLOTHES[c].slot === slot; }); return l[(h >>> k) % l.length]; };
    var dress = (h >>> 3) % 5 === 0, outfit = dress ? { dress: pick('dress', 4) } : { top: pick('top', 5), bottom: pick('bottom', 9) };
    outfit.shoes = pick('shoes', 13);
    return { look: { skin: h % D.LOOKS.skin.length, hair: (h >>> 6) % D.LOOKS.hair.length, shape: (h >>> 11) % 3 }, outfit: outfit };
  }
  // A sign-sized name for an action: the part before any colon or bracket, cut at a word and never ending on a small word.
  var VENUE_STOP = /^(a|an|the|in|at|as|on|of|for|to|and|with|from|by|your|my)$/i;
  function venueShort(label) {
    var base = label.replace(/\s*\(.*?\)/g, '').split(/[:,–]/)[0].trim();
    if (base.length <= 20) return base;
    var out = []; base.split(' ').some(function (w) { if ((out.concat(w).join(' ')).length > 20) return true; out.push(w); return false; });
    while (out.length > 1 && VENUE_STOP.test(out[out.length - 1])) out.pop();
    return out.join(' ') || base.slice(0, 20);
  }
  function venueActs(pl) {
    var here = S.loc === pl.district, avail = here ? L.availableActions(S) : [];
    return pl.acts.map(function (aid) {
      var def = (D.PLACE_ACTIONS[pl.district] || []).filter(function (x) { return x.id === aid; })[0]; if (!def) return null;
      var a = avail.filter(function (x) { return x.id === aid; })[0];
      return { id: aid, def: def, a: a || null, icon: actIcon(def), short: venueShort(def.label), off: !a || a.disabled };
    }).filter(Boolean);
  }
  function venueScene(pl) {
    var set = venueSet(pl), hr = Math.floor(S.t / 60), crew = VENUE_CREW[set], seed = pl.id + ':' + hr, n = 3 + vHash(seed, 1) % 4, acts = venueActs(pl), slots = Math.max(1, Math.min(8, acts.length));
    var people = [];
    for (var i = 0; i < n; i++) {
      var role = crew[vHash(seed, 20 + i) % crew.length], st = venueStranger(seed, i);
      people.push({ look: st.look, outfit: st.outfit, label: role[0], line: role[1], slot: vHash(seed, 40 + i) % 8, hat: role[2] && set === 'refinery' ? '#f2c200' : null, vest: role[2] ? '#f39c12' : null });
    }
    // Live players in this district stand here too, under their @handles.
    (online.peerList || []).filter(function (p) { return p.d === pl.district && !online.muted[p.by] && p.look; }).slice(0, 4).forEach(function (p, k) {
      people.push({ look: p.look, outfit: {}, label: handleOf(p.by), line: 'a player here now. Chat from the map.', slot: (k * 3 + 2) % 8, live: true });
    });
    var commuters = [0, 1].map(function (k) { var st = venueStranger(pl.id + ':c', k); return { look: st.look, outfit: st.outfit, hat: set === 'refinery' ? '#f2c200' : null, vest: set === 'refinery' ? '#f39c12' : null }; });
    // While the ride view is still up, hold the arrival (and keep you off the yard) until it closes.
    var riding = !!document.getElementById('ride-view'), here = S.loc === pl.district && !riding, trip = !riding && ui.trip && ui.trip.to === pl.district && Date.now() - ui.trip.at < 120000 ? ui.trip : null;
    var worksHere = S.job && D.CAREERS[S.job.id] && pl.hr === S.job.id, h0 = L.hour(S);
    return {
      name: pl.name, set: set, acts: acts, people: people, commuters: commuters, night: h0 >= 19 || h0 < 6,
      sign: pl.name.toUpperCase().slice(0, 30), signBg: set === 'refinery' ? '#1f3b63' : set === 'nightlife' ? '#8e24aa' : '#1f3b63',
      shuttle: set === 'refinery' ? 'staff' : set === 'airport' ? 'cab' : ['danfo', 'keke', 'okada', 'cab'][vHash(pl.id, 3) % 4],
      me: here ? { look: S.look, outfit: S.outfit, extra: myExtra(), label: 'You', me: true, hat: set === 'refinery' && (worksHere || ui.venueSlot != null) ? '#ffffff' : null } : null,
      meSlot: ui.venueSlot != null ? ui.venueSlot : Math.min(5, slots - 1),
      arrive: trip && VENUE_RIDES[trip.mode] ? trip.mode : null, arriveKey: trip ? 'trip:' + trip.at : ''
    };
  }
  function venuePanel(pl) {
    var here = S.loc === pl.district, acts = venueActs(pl), crowd = venueScene(pl).people.length + (here ? 1 : 0);
    return '<div class="ap-head"><b>' + esc(pl.icon || '📍') + ' ' + esc(pl.name) + '</b><span class="muted">' + esc(D.DISTRICTS[pl.district].name) + ' · ' + crowd + ' here · ' + esc(L.clockLabel(S)) + '</span><button class="btn sm ghost" id="venue-close" data-venueclose="1" aria-label="Leave the scene">✕</button></div>' +
      (here ? '<p class="note">Tap a sign in the yard, or a person to hear them. Workers and visitors come in by ' + esc({ refinery: 'staff bus', airport: 'cab' }[venueSet(pl)] || 'danfo, keke and okada') + ' all day.</p>' +
        '<div class="list">' + acts.map(function (x) { return x.a ? actionRow(x.a) : '<div class="item"><div><h3>' + esc(x.def.label) + '</h3><div class="meta"><span>' + esc(x.def.when ? whenText(x.def.when) : 'Not open now') + '</span></div></div></div>'; }).join('') + '</div>'
        : '<p class="note">You are in ' + esc(D.DISTRICTS[S.loc].name) + '. Take a ride to ' + esc(D.DISTRICTS[pl.district].name) + ': it pulls up at the gate and you walk in.</p>' + rideRow(pl.district)) +
      (pl.hr ? hrCard(pl) : '') + (pl.shares ? sharesCard(pl) : '');
  }
  function mountVenue() {
    var ov = document.getElementById('venue-view'), pl = ui.venueOpen && S ? D.PLACES.filter(function (p) { return p.id === ui.venueOpen; })[0] : null;
    if (!pl || ui.cruiseOpen || ui.airportOpen || ui.roomOpen) { if (ov) ov.remove(); if (venueStage) venueStage.stop(); return; }
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'venue-view'; ov.className = 'cruise-view venue-view'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', pl.name);
      if (!venueStage) venueStage = window.LasgidiVenue.create({ onAct: function (i) {
        var p0 = D.PLACES.filter(function (p) { return p.id === ui.venueOpen; })[0], x = p0 && venueActs(p0)[i]; if (!x) return;
        if (S.loc !== p0.district) { ui.toasts.push({ msg: 'Ride to ' + D.DISTRICTS[p0.district].name + ' first, then walk in.', ok: false }); renderToasts(); return; }
        if (!x.a || x.a.disabled) { ui.toasts.push({ msg: (x.a && x.a.disabled) || (x.def.when ? 'Open ' + whenText(x.def.when) : 'Not open now'), ok: false }); renderToasts(); return; }
        ui.venueSlot = i; run(function () { var r = L.doAction(S, x.id); if (r && r.ok) { ui.activity = activityFor(x.id); ui.activityAt = Date.now(); } return r; });
      } });
      var pn = document.createElement('div'); pn.className = 'cv-panel ap-panel'; pn.id = 'venue-panel'; ov.appendChild(venueStage.el); ov.appendChild(pn); document.body.appendChild(ov); venueKey = '';
    }
    var html = venuePanel(pl); if (html !== venueKey) { document.getElementById('venue-panel').innerHTML = html; venueKey = html; }
    venueStage.update(venueScene(pl)); venueStage.start();
  }
  /* ---------- the live airport: an animated scene with Departures and Arrivals boards ---------- */
  var AIRLINES = [['EA', 'Eagle Air'], ['LG', 'Lagoon Airways'], ['SJ', 'Savannah Jet'], ['AW', 'Atlantic Wings'], ['NX', 'Niger Express']];
  var DOMESTIC = ['Abuja', 'Port Harcourt', 'Kano', 'Enugu', 'Benin City', 'Owerri', 'Uyo', 'Ilorin'], ABROAD = ['London', 'Dubai', 'Accra', 'Johannesburg', 'Atlanta', 'Nairobi', 'Paris', 'Istanbul', 'Doha', 'Toronto'];
  // A deterministic board for this game day: one flight about every 25 minutes, statuses from the clock.
  function fids(kind) {
    var dayN = Math.floor(S.t / 1440), now = S.t % 1440, here = D.CITIES[L.cityOf(S)].name, out = [];
    for (var i = 0; i < 9; i++) {
      var slot = Math.floor(now / 25) - 2 + i, mins = slot * 25 + (kind === 'arr' ? 10 : 0); if (mins < 300 || mins > 1410) continue;
      var h = Math.imul(dayN * 131 + slot * 17 + (kind === 'arr' ? 7 : 0), 2654435761) >>> 0, al = AIRLINES[h % AIRLINES.length];
      var pool = h % 3 === 0 ? ABROAD : DOMESTIC.filter(function (c) { return c !== here; }), city = pool[(h >>> 3) % pool.length], late = (h >>> 9) % 7 === 0 ? 40 : 0, diff = mins + late - now;
      var status = kind === 'dep' ? (diff < -10 ? 'Departed' : diff < 15 ? 'Boarding' : diff < 45 ? 'Gate open' : late ? 'Delayed' : 'On time') : (diff < -5 ? 'Landed' : diff < 20 ? 'Approaching' : late ? 'Delayed' : 'Expected');
      out.push({ at: mins + late, time: pad(Math.floor((mins + late) / 60) % 24) + ':' + pad((mins + late) % 60), code: al[0] + ' ' + (100 + (h % 800)), airline: al[1], city: city, gate: 1 + (h >>> 5) % 5, status: status });
    }
    return out.sort(function (x, y) { return x.at - y.at; }).slice(0, 6);
  }
  var airportStage = null, airportKey = '';
  function airportPanel() {
    var tab = ui.fidsTab || 'dep', rows = fids(tab), cls = { Boarding: 'st-go', 'Gate open': 'st-go', Departed: 'st-off', Landed: 'st-off', Approaching: 'st-go', Delayed: 'st-late' };
    return '<div class="ap-head"><b>🛬 ' + esc(ui.airportName || 'Airport') + '</b><span class="muted">' + esc(L.clockLabel(S)) + '</span><button class="btn sm ghost" id="ap-photo" data-photo="airport" aria-label="Take a photo">📷</button><button class="btn sm ghost" id="ap-close" data-airportclose="1" aria-label="Close the airport view">✕</button></div>' +
      '<div class="dep-tabs sm" role="tablist"><button type="button" role="tab" class="dep-tab' + (tab === 'dep' ? ' on' : '') + '" id="fids-dep" data-fidstab="dep" aria-selected="' + (tab === 'dep') + '">🛫 Departures</button><button type="button" role="tab" class="dep-tab' + (tab === 'arr' ? ' on' : '') + '" id="fids-arr" data-fidstab="arr" aria-selected="' + (tab === 'arr') + '">🛬 Arrivals</button></div>' +
      '<div class="fids-wrap"><table class="fids"><thead><tr><th>Time</th><th>Flight</th><th>' + (tab === 'dep' ? 'To' : 'From') + '</th><th>Gate</th><th>Status</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td class="num">' + r.time + '</td><td class="num">' + esc(r.code) + '</td><td>' + esc(r.city) + '</td><td class="num">' + r.gate + '</td><td class="' + (cls[r.status] || '') + '">' + esc(r.status) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="inline"><button class="btn sm go" id="ap-book" data-airportgo="air">✈️ Book a flight</button><button class="btn sm" id="ap-jet" data-airportgo="jet">🛩️ My jet</button><button class="btn sm" id="ap-chop" data-airportgo="chopper">🚁 Chopper</button></div>' +
      '<p class="note">Tap the gates, the private jets or the helipads to book. Airlines are fictional. International flights are for show; japa from the airport card.</p>';
  }
  function mountAirport() {
    var ov = document.getElementById('airport-view');
    if (!ui.airportOpen || !S) { if (ov) ov.remove(); return; }
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'airport-view'; ov.className = 'cruise-view airport-view'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Live airport view');
      if (!airportStage) airportStage = window.LasgidiAirport.create({ onTap: function (k) { if (k === 'parking') return; airportGo(k === 'departures' ? 'air' : k); } });
      var pn = document.createElement('div'); pn.className = 'cv-panel ap-panel'; pn.id = 'ap-panel'; ov.appendChild(airportStage.el); ov.appendChild(pn); document.body.appendChild(ov); airportKey = '';
    }
    var html = airportPanel(); if (html !== airportKey) { document.getElementById('ap-panel').innerHTML = html; airportKey = html; }
    var h0 = L.hour(S); airportStage.update({ name: ui.airportName, night: h0 >= 19 || h0 < 6 }); airportStage.start();
  }
  function airportGo(tab) { ui.airportOpen = false; ui.depTab = tab; clearPicks(); ui.place = ui.airportPlace || 'airport'; ui.tab = 'map'; render(); }
  /* ---------- airport departures: Air (cabins, insurance, boarding pass), My jet / charter, Chopper ---------- */
  var DEP_PLACES = { airport: 1, abj_airport_pl: 1, ph_airport_pl: 1 };
  function departuresView(pl) {
    var tab = ui.depTab || 'air', here = L.cityOf(S), cities = Object.keys(D.CITIES).filter(function (c) { return c !== here; });
    var city = cities.indexOf(ui.depCity) >= 0 ? ui.depCity : cities[0], code = D.CITY_CODES;
    var tabs = '<div class="dep-tabs" role="tablist">' + [['air', '✈️ Air'], ['jet', '🛩️ My jet'], ['chopper', '🚁 Chopper']].map(function (x) {
      return '<button type="button" role="tab" aria-selected="' + (tab === x[0]) + '" class="dep-tab' + (tab === x[0] ? ' on' : '') + '" id="dep-' + x[0] + '" data-deptab="' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    var cityRows = function (fn) {
      return '<div class="dep-cities">' + cities.map(function (c) {
        var on = c === city;
        return '<button type="button" class="dep-city' + (on ? ' sel' : '') + '" id="depc-' + c + '" data-depcity="' + c + '"><b>' + code[here] + ' → ' + code[c] + '</b><span>' + esc(D.CITIES[c].name) + '</span><span class="num">' + fn(c) + '</span></button>';
      }).join('') + '</div>';
    };
    var body = '';
    if (tab === 'air') {
      var cabin = D.CABINS[ui.depCabin] ? ui.depCabin : 'economy', ins = !!ui.depInsure, q = L.flightQuote(S, city, cabin, ins);
      body = cityRows(function (c) { return 'from ' + N(L.flightQuote(S, c, 'economy', false).fare || 0) + ' · ' + dur(D.INTERCITY.flight.mins); }) +
        '<div class="cabins">' + Object.keys(D.CABINS).map(function (k) {
          var K = D.CABINS[k], f = L.flightQuote(S, city, k, false);
          return '<button type="button" class="cabin' + (k === cabin ? ' sel' : '') + '" id="cab-' + k + '" data-depcabin="' + k + '"><span class="cab-e">' + K.icon + '</span><b>' + esc(K.name) + '</b><span class="num">' + N(f.fare || 0) + '</span><small>' + esc(K.perk) + '</small></button>';
        }).join('') + '</div>' +
        '<label class="dep-ins"><input type="checkbox" id="dep-insure" data-depinsure="1"' + (ins ? ' checked' : '') + '> 🛡️ Travel insurance (' + Math.round(D.AIR.insure * 100) + '% of the fare): covers a lost bag</label>' +
        '<div class="bpass"><div class="bp-top"><span>BOARDING PASS</span><span>' + esc(D.CABINS[cabin].name) + '</span></div>' +
          '<div class="bp-route"><b>' + code[here] + '</b><span>✈︎ ' + dur(D.INTERCITY.flight.mins) + '</span><b>' + code[city] + '</b></div>' +
          '<div class="bp-names"><span>' + esc(D.DISTRICTS[D.CITIES[here].airport].name) + '</span><span>' + esc(D.DISTRICTS[D.CITIES[city].airport].name) + '</span></div>' +
          '<div class="bp-lines"><div><span>Fare' + (q.rush > 1 ? ' (morning rush ×' + q.rush + ')' : '') + '</span><span>' + N(q.fare || 0) + '</span></div>' +
          '<div><span>🚕 Cab to the airport</span><span>' + (q.cab ? N(q.cab) : 'Included') + '</span></div>' +
          (ins ? '<div><span>🛡️ Insurance</span><span>' + N(q.insure) + '</span></div>' : '') +
          '<div class="bp-total"><span>Total</span><span>' + N(q.total || 0) + '</span></div><div class="muted"><span>In your wallet</span><span>' + N(S.cash + S.bank) + '</span></div></div>' +
          (q.disabled ? '<p class="why">' + esc(q.disabled) + '</p>' : '') +
          '<button class="btn go big-go" id="dep-book" data-flyclass="' + city + ':' + cabin + ':' + (ins ? 1 : 0) + '"' + (q.disabled ? ' disabled' : '') + '>Book · ' + N(q.total || 0) + '</button></div>';
    } else if (tab === 'jet') {
      var own = L.ownsJet(S), jq = L.jetQuote(S, city, false), cq = L.jetQuote(S, city, true);
      var mine = (S.vehicles || []).filter(function (v) { return D.VEHICLES[v.id] && D.VEHICLES[v.id].kind === 'jet'; });
      body = '<div class="hangar"><b>🛩️ Private hangar</b>' + (mine.length ? mine.map(function (v) { return '<span class="tail">' + esc(D.VEHICLES[v.id].name) + ' · ' + esc((S.name || 'Your') + "'s") + '</span>'; }).join('') : '<span class="muted">Your hangar bay is empty.</span>') + '</div>' +
        cityRows(function (c) { return N((own ? L.jetQuote(S, c, false) : L.jetQuote(S, c, true)).cost || 0); }) +
        (own ? '<button class="btn go big-go" id="dep-jet" data-flyjet="' + city + ':0"' + (jq.disabled ? ' disabled title="' + esc(jq.disabled) + '"' : '') + '>Fly my jet · fuel and crew ' + N(jq.cost || 0) + '</button>' + (jq.disabled ? '<p class="why">' + esc(jq.disabled) + '</p>' : '')
          : '<p class="note">No jet yet. Lekki luxury motors sells them, or charter one for this trip.</p><div class="inline"><button class="btn sm ghost" id="dep-shop" data-place="lekki_motors">Shop jets</button></div>') +
        '<button class="btn" id="dep-charter" data-flyjet="' + city + ':1"' + (cq.disabled ? ' disabled title="' + esc(cq.disabled) + '"' : '') + '>Charter a jet · ' + N(cq.cost || 0) + '</button>' + (cq.disabled && cq.disabled !== jq.disabled ? '<p class="why">' + esc(cq.disabled) + '</p>' : '');
    } else {
      var qv = (ui.chopQ || '').toLowerCase(), fc = ui.chopCity || 'all';
      var list = D.PLACES.filter(function (p) { return !/_site$/.test(p.id) && D.DISTRICTS[p.district] && (fc === 'all' || L.districtCity(p.district) === fc) && (!qv || (p.name + ' ' + D.DISTRICTS[p.district].name).toLowerCase().indexOf(qv) >= 0); }).slice(0, 30);
      body = '<p class="note">Straight to the door, any place in any city. Not cheap.</p>' +
        '<input type="search" class="chop-q" id="chop-q" placeholder="Search a place" value="' + esc(ui.chopQ || '') + '" aria-label="Search a place">' +
        '<div class="dep-tabs sm">' + ['all'].concat(Object.keys(D.CITIES)).map(function (c) { return '<button type="button" class="dep-tab' + (fc === c ? ' on' : '') + '" id="chopc-' + c + '" data-chopcity="' + c + '">' + (c === 'all' ? 'All' : esc(D.CITIES[c].name)) + '</button>'; }).join('') + '</div>' +
        '<div class="list">' + list.map(function (p) {
          var cq2 = L.chopperQuote(S, p.id);
          return '<div class="item"><div><h3>' + (p.icon || '•') + ' ' + esc(p.name) + '</h3><div class="meta"><span>' + esc(D.DISTRICTS[p.district].name) + '</span><span>' + dur(cq2.mins) + '</span><span class="cost">' + N(cq2.cost) + '</span></div></div><button class="btn sm" id="chop-' + p.id + '" data-chopper="' + p.id + '"' + (cq2.disabled ? ' disabled title="' + esc(cq2.disabled) + '"' : '') + '>Fly</button></div>';
        }).join('') + (list.length ? '' : '<p class="muted">No place matches.</p>') + '</div>';
    }
    return '<section class="departures"><div class="inline" style="justify-content:space-between"><h3>' + (icon3d('jet', '') || '🛫') + ' Departures</h3><button class="btn sm ghost" id="airport-live" data-airportopen="' + pl.id + '">🛬 Live airport view</button></div>' + tabs + body + '</section>';
  }
  // The transport picker on a place sheet: one chip per way to get there, then a big Go button.
  var MODE_ICONS = { danfo: 'bus', brt: 't_brt', cab: 't_taxi', keke: 't_keke', okada: 't_okada', car: 'car', ferry: 'boat', boat: 't_speedboat', heli: 't_heli', trek: 't_walk', rail: 't_train' };
  var MODE_EMOJI = { danfo: '🚐', brt: '🚍', cab: '🚕', keke: '🛺', okada: '🏍️', car: '🚗', ferry: '⛴️', boat: '🚤', heli: '🚁', trek: '🚶', rail: '🚆' };
  function rideRow(dest) {
    var opts = L.travelOptions(S, dest).filter(function (o) { return !(o.mode === 'car' && !S.car); });
    if (!opts.length) return '';
    var ok = opts.filter(function (o) { return !o.disabled; });
    var sel = opts.filter(function (o) { return o.mode === ui.rideMode && !o.disabled; })[0] || ok.slice().sort(function (a, b) { return a.cost - b.cost || a.mins - b.mins; }).filter(function (o) { return o.mode !== 'trek' || ok.length === 1; })[0] || ok[0];
    var rush = opts.some(function (o) { return o.traffic > 1.3; });
    return '<div class="rides" role="radiogroup" aria-label="How to get there">' + opts.map(function (o) {
      var on = sel && o.mode === sel.mode;
      return '<button type="button" class="ride' + (on ? ' sel' : '') + '" role="radio" aria-checked="' + on + '" id="ride-' + o.mode + '" data-ridemode="' + o.mode + '"' + (o.disabled ? ' disabled title="' + esc(o.disabled) + '"' : '') + '>' +
        (icon3d(MODE_ICONS[o.mode]) || '<span class="ride-e">' + (MODE_EMOJI[o.mode] || '🚌') + '</span>') + '<b>' + esc(o.name) + '</b><span class="num">' + (o.cost ? N(o.cost) : 'Free') + '</span></button>';
    }).join('') + '</div>' + (rush ? '<p class="why">🚦 Go-slow: the roads are slow right now.</p>' : '') + (sel && sel.risk ? '<p class="why">' + esc(sel.risk) + '</p>' : '') +
      (sel ? '<button class="btn go big-go" id="ride-go" data-travel="' + dest + '" data-mode="' + sel.mode + '">Go · ' + (sel.cost ? N(sel.cost) : 'free') + ' · ' + dur(sel.mins) + '</button>' : '<p class="why">No way to get there right now.</p>');
  }
  function icon3d(key, alt) { var src = key && window.LASGIDI_ICONS && window.LASGIDI_ICONS[key]; return src ? '<img class="ic3d" src="' + src + '" alt="' + esc(alt || '') + '" width="32" height="32">' : ''; }
  // Landmarks near the straight line between two districts, for the "now passing" note.
  function passing(from, to) {
    var a = D.DISTRICTS[from], b = D.DISTRICTS[to];
    if (!a || !b) return [];
    var dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
    return D.PLACES.filter(function (p) { return p.district !== from && p.district !== to && L.districtCity(p.district) === L.districtCity(from); }).map(function (p) {
      var u = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
      if (u < 0.15 || u > 0.85) return null;
      var px = a.x + u * dx - p.x, py = a.y + u * dy - p.y;
      return { name: p.name, d: px * px + py * py, u: u };
    }).filter(function (p) { return p && p.d < 9; }).sort(function (x, y) { return x.d - y.d; }).slice(0, 2).sort(function (x, y) { return x.u - y.u; }).map(function (p) { return p.name; });
  }
  /* ---------- the ride view: a short journey scene with "Now passing" signs ---------- */
  // Mounted outside the app so live re-renders never restart it. Tap anywhere or Arrive to skip.
  var RIDE_NAMES = { danfo: 'Danfo', brt: 'BRT bus', cab: 'Cab', keke: 'Keke', okada: 'Okada', car: 'Your car', ferry: 'Ferry', boat: 'Speedboat', heli: 'Chopper', trek: 'Trekking', rail: 'Train', flight: 'Flight', jet: 'Private jet' };
  function showRide(from, to, mode, t0) {
    var old = document.getElementById('ride-view'); if (old) old.remove();
    if (!D.DISTRICTS[from] || !D.DISTRICTS[to] || from === to) return;
    var chauffeur = mode === 'car' && (S.staff || []).some(function (x) { return x.id === 'driver' || x === 'driver'; });
    var name = chauffeur ? 'VIP chauffeur' : (RIDE_NAMES[mode] || 'Ride'), water = mode === 'ferry' || mode === 'boat', air = mode === 'heli' || mode === 'flight' || mode === 'jet';
    var sights = passing(from, to).slice(0, 3);
    if (!air && !sights.length) {
      var pick = function (d) { var x = D.PLACES.filter(function (p) { return p.district === d && !/_site$/.test(p.id); })[0]; return x ? x.name : D.DISTRICTS[d].name; };
      sights = [pick(from), pick(to)];
    }
    var h = L.hour(S), night = h < 6 || h >= 19, dusk = h >= 17 && h < 19;
    var ic = icon3d(MODE_ICONS[mode] || (air ? 't_heli' : 'car'), name).replace('width="32" height="32"', 'width="64" height="64"');
    var veh = ic || '<span class="rv-emoji">' + (MODE_EMOJI[mode] || (mode === 'flight' || mode === 'jet' ? '✈️' : '🚗')) + '</span>';
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches, secs = reduce ? 2.5 : 5.5;
    var el = document.createElement('div');
    el.id = 'ride-view'; el.className = 'ride-view' + (night ? ' night' : dusk ? ' dusk' : '') + (water ? ' water' : '') + (air ? ' air' : '') + (reduce ? ' still' : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', name + ' to ' + D.DISTRICTS[to].name);
    el.style.setProperty('--rv-secs', secs + 's');
    el.innerHTML = '<div class="rv-card"><div class="rv-top"><span class="rv-mode">' + esc(name) + '</span><b>' + esc(D.DISTRICTS[from].name) + ' → ' + esc(D.DISTRICTS[to].name) + '</b><span class="rv-time">' + dur(Math.max(1, S.t - (t0 || S.t))) + ' · arrive ' + esc(L.clockLabel(S)) + '</span></div>' +
      '<div class="rv-scene" aria-hidden="true"><div class="rv-sky"><i class="rv-sun"></i><i class="rv-cloud c1"></i><i class="rv-cloud c2"></i></div><div class="rv-far"></div><div class="rv-near"></div>' +
      '<div class="rv-road"><div class="rv-lines"></div></div>' +
      sights.map(function (s, i) { return '<div class="rv-sign" style="animation-delay:' + (secs * (0.12 + i * 0.8 / Math.max(1, sights.length))).toFixed(2) + 's"><small>Now passing</small><b>' + esc(s) + '</b></div>'; }).join('') +
      '<div class="rv-veh' + (chauffeur ? ' vip' : '') + '">' + veh + '</div></div>' +
      '<div class="rv-bar"><i></i></div>' +
      '<div class="rv-foot"><span>' + (sights.length ? '📍 ' + esc(sights.join(' · ')) : '☁️ Above the city') + '</span><button class="btn go" id="rv-arrive" type="button">Arrive</button></div></div>';
    var done = function () { if (el.parentNode) { el.remove(); if (ui.venueOpen) mountVenue(); } }; // a walk-in scene behind the ride starts its arrival now
    el.addEventListener('click', function (e) { if (e.target === el || (e.target.closest && e.target.closest('#rv-arrive'))) done(); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Escape') done(); });
    document.body.appendChild(el);
    var b = document.getElementById('rv-arrive'); if (b) b.focus();
    setTimeout(done, secs * 1000 + 400);
  }
  function japaView() {
    var html = '<div class="section"><h3>🌍 International departures: Japa</h3><p class="note">IELTS ' + (S.edu.ieltsPassed ? '✓ passed' : '✗ not yet') + ' · funds ' + N(S.cash + S.bank) + ' of ' + N(L.price(S, 15000000)) + ' proof plus visa and ticket' + (L.debts(S) > 0 ? ' · ✗ clear your debts' : '') + '. Japa ends this life: you can post it to the Hall of Fame and start a new one.</p><div class="list">';
    html += Object.keys(D.JAPA_DESTS).map(function (k) {
      var J = D.JAPA_DESTS[k], why = L.japaBlock(S, k);
      return '<div class="item"><div><h3>' + J.icon + ' ' + esc(J.name) + '</h3><div class="meta"><span class="cost num">' + N(L.price(S, J.ticket) + L.price(S, 1200000)) + ' ticket and visa</span></div><div class="act-note">' + esc(J.text) + '</div></div><button class="btn go" id="japa-' + k + '" data-japa="' + k + '"' + (why ? ' disabled title="' + esc(why) + '"' : '') + '>Japa</button></div>';
    }).join('');
    return html + '</div></div>';
  }
  function whenText(w) {
    var parts = [];
    if (w.days) parts.push(w.days.map(function (d) { return D.DAYS[d]; }).join('/'));
    if (w.from != null) parts.push(String(w.from).padStart(2, '0') + ':00–' + String(w.to).padStart(2, '0') + ':00');
    return parts.join(' ');
  }
  /* ---------- Sea Plots: shared claims, approved pictures ---------- */
  var SEA_COLORS = ['#c0392b', '#2f6fa0', '#2fa36b', '#6b3fa0', '#d9822b', '#17181a', '#d0453a', '#0f6f78'];
  function cleanRect(r) {
    var S = D.SEA, i = function (v) { return typeof v === 'number' && Math.round(v) === v && v >= 0; };
    if (!r || !i(r.x) || !i(r.y) || !i(r.w) || !i(r.h) || r.w < 1 || r.h < 1 || r.w > S.maxSide || r.h > S.maxSide || r.x + r.w > S.cols || r.y + r.h > S.rows) return null;
    return { x: r.x, y: r.y, w: r.w, h: r.h, at: typeof r.at === 'number' ? r.at : 0 };
  }
  function overlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
  function okImg(s) { return typeof s === 'string' && s.length <= L.PIC_MAX && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+\/]+={0,2}$/.test(s); }
  // Everyone's blocks, oldest claim first; a later claim that overlaps is ignored.
  function seaClaims() {
    var list = (online.sea || []).map(function (d) { var r = cleanRect(d.raw); return r ? Object.assign(r, { id: d.id }) : null; }).filter(Boolean)
      .sort(function (a, b) { return a.at - b.at || (a.id < b.id ? -1 : 1); }), out = [];
    // Your own block comes from your life, so it shows even offline.
    if (S && S.sea && online.me) { var myDoc = list.filter(function (k) { return k.id === online.me; })[0]; list = list.filter(function (k) { return k.id !== online.me; }).concat([Object.assign({ id: online.me, at: myDoc ? myDoc.at : Infinity }, S.sea)]); list.sort(function (a, b) { return a.at - b.at; }); }
    else if (S && S.sea) list.push(Object.assign({ id: 'me', at: Infinity }, S.sea));
    list.forEach(function (k) { if (!out.some(function (o) { return overlap(o, k); })) out.push(k); });
    return out.map(function (k) {
      var im = online.seaimg[k.id], pend = k.id === (online.me || 'me') && online.mySeaReview && !online.mySeaReview.status ? online.mySeaReview : null;
      var src = im && okImg(im.img) && im.x === k.x && im.y === k.y && im.w === k.w && im.h === k.h ? im : null;
      var nm = (online.names[k.id] && online.names[k.id].name) || '';
      return { id: k.id, x: k.x, y: k.y, w: k.w, h: k.h, img: src ? src.img : null, imgAt: src ? src.approvedAt || 0 : 0, pending: !!pend,
        color: SEA_COLORS[parseInt(String(k.id).replace(/\W/g, '').slice(-6), 36) % SEA_COLORS.length || 0], label: (nm[0] || '🌊').toUpperCase() };
    });
  }
  // A new life owns no sea: give back the last life's block on the shared map.
  function releaseOldSea() {
    if (!online.db || !online.me || (S && S.sea)) return;
    var doc = (online.sea || []).filter(function (d) { return d.id === online.me; })[0];
    if (doc && cleanRect(doc.raw)) online.db.doc('sea/' + online.me).set({ x: 0, y: 0, w: 0, h: 0, at: Date.now() }).catch(function () {});
  }
  // Your block lost the water to an older claim (another device got there first).
  function seaDropped() {
    if (!S || !S.sea) return false;
    var me = online.me || 'me';
    return !seaClaims().some(function (k) { return k.id === me; });
  }
  function seaSel() {
    if (!ui.seaSel) return null;
    var s2 = Object.assign({}, ui.seaSel), S2 = D.SEA;
    s2.w = Math.min(s2.w, S2.cols - s2.x); s2.h = Math.min(s2.h, S2.rows - s2.y);
    s2.bad = seaClaims().some(function (k) { return k.id !== (online.me || 'me') && overlap(k, s2); });
    return s2;
  }
  function seaView() {
    var sel = seaSel(), mine = S.sea, S2 = D.SEA;
    var html = '<div class="inline" style="justify-content:space-between"><h3>🌊 Sea Plots</h3><button class="btn sm ghost" id="sea-close" data-seaclose="1">Close</button></div>' +
      '<p class="note">A grid of ' + (S2.cols * S2.rows).toLocaleString('en') + ' plots in the water off Lagos Island. Buy a block (up to ' + S2.maxSide + '×' + S2.maxSide + ') and put a picture on it for every Lagosian to see. Pictures are checked by an editor before they go live. ' + N(L.price(S, S2.price)) + ' a plot. Zoom in to see the small ones.</p>';
    var claims = seaClaims(), me = online.me || 'me';
    var owner = sel ? claims.filter(function (k) { return k.id !== me && sel.x >= k.x && sel.x < k.x + k.w && sel.y >= k.y && sel.y < k.y + k.h; })[0] : null;
    if (owner) {
      html += '<div class="section sea-owner"><h3>' + (owner.img ? '' : '<span class="sea-dot" style="background:' + owner.color + '"></span> ') + esc(nameOf(owner.id)) + '\'s block · ' + owner.w + '×' + owner.h + '</h3>' +
        (owner.img ? '<img class="sea-big" alt="' + esc(nameOf(owner.id)) + '\'s picture" src="' + owner.img + '">' : '<p class="note">No picture yet.</p>') +
        '<div class="inline">' + (checkHome(online.homes[owner.id]) ? '<button class="btn sm ghost" id="sea-visit" data-visit2="' + esc(owner.id) + '">🏠 Visit their home</button>' : '') + '<button class="btn sm ghost" id="sea-pick" data-seapickfree="1">Pick a free spot</button></div></div>';
    }
    if (sel && !owner) {
      var cost = L.seaCost(S, sel.w, sel.h);
      html += '<div class="label">Block size from plot ' + (sel.x + 1) + '·' + (sel.y + 1) + '</div><div class="pg-chips" style="padding:0">' + [[1, 1], [2, 2], [3, 2], [4, 4], [6, 4], [8, 8], [12, 12]].map(function (z) {
        return '<button type="button" class="pg-chip' + (ui.seaSel.w === z[0] && ui.seaSel.h === z[1] ? ' sel' : '') + '" id="seasz-' + z[0] + 'x' + z[1] + '" data-seasize="' + z[0] + 'x' + z[1] + '">' + z[0] + '×' + z[1] + '</button>';
      }).join('') + '</div>';
      html += sel.bad ? '<p class="why">Someone already owns part of that block. Pick another spot.</p>'
        : '<div class="inline" style="margin-top:8px"><button class="btn go" id="sea-buy" data-seabuy="1"' + (cost > S.cash + S.bank ? ' disabled' : '') + '>' + (mine ? 'Move here' : 'Buy') + ' ' + sel.w + '×' + sel.h + (cost ? ' · ' + N(cost) : ' · free (same size or smaller)') + '</button></div>';
    }
    if (mine) {
      var rv = online.mySeaReview, si = online.me && online.seaimg[online.me];
      var live = si && okImg(si.img) && si.x === mine.x && si.y === mine.y && si.w === mine.w && si.h === mine.h;
      if (seaDropped()) html += '<p class="why" id="sea-dropped">Someone claimed part of this water before you, so your block is hidden on the shared map. Pick a free spot and move there: moving is free.</p>';
      html += '<div class="section"><h3>Your block · ' + mine.w + '×' + mine.h + ' at ' + (mine.x + 1) + '·' + (mine.y + 1) + '</h3><p class="note">' +
        (live ? '✅ Your picture is live.' : rv && !rv.status ? '⏳ Your picture is waiting for an editor.' : rv && rv.status === 'rejected' ? '❌ Your last picture was not approved. Try another.' : 'No picture yet.') + (online.db ? '' : ' Pictures need the shared board (open the game on claude.ai).') + '</p>' +
        (online.db && online.me ? '<label class="btn sm" for="sea-file">📷 Upload a picture</label><input type="file" id="sea-file" accept="image/jpeg,image/png,image/webp" hidden>' : '') +
        ' <button class="btn sm ghost" id="sea-release" data-searelease="1">Let it go</button>' + (online.seaStatus ? '<p class="note">' + esc(online.seaStatus) + '</p>' : '') + '</div>';
    } else if (!sel) html += '<p class="note">Tap a spot on the sea grid to pick a block.</p>';
    var big = claims.filter(function (k) { return k.id !== me || S.sea; }).slice().sort(function (a, b) { return b.w * b.h - a.w * a.h; }).slice(0, 5);
    if (big.length) html += '<div class="section"><h3>Biggest blocks</h3><ol class="sea-top">' + big.map(function (k) {
      return '<li><button type="button" class="link-btn" id="sea-go-' + esc(k.id) + '" data-seago="' + k.x + ',' + k.y + '">' + esc(k.id === me ? 'You' : nameOf(k.id)) + '</button> <span class="muted">· ' + k.w + '×' + k.h + ' (' + k.w * k.h + ' plots)' + (k.img ? ' · 🖼️' : '') + '</span></li>';
    }).join('') + '</ol></div>';
    if (online.canEdit) {
      var q = (online.seareview || []).filter(function (r) { return okImg(r.raw.img) && cleanRect(r.raw); });
      html += '<div class="section"><h3>Review sea pictures <span class="muted">· ' + q.length + ' waiting</span></h3>' + (q.length ? '<div class="list">' + q.map(function (r) {
        return '<div class="item review"><img class="sea-prev" alt="" src="' + r.raw.img + '"><div><h3>' + esc(nameOf(r.id)) + '</h3><div class="meta"><span>' + r.raw.w + '×' + r.raw.h + '</span></div><div class="inline"><button class="btn sm" id="sr-ok-' + esc(r.id) + '" data-srok="' + esc(r.id) + '">Approve</button><button class="btn sm ghost" id="sr-no-' + esc(r.id) + '" data-srno="' + esc(r.id) + '">Reject</button></div></div></div>';
      }).join('') + '</div>' : '<p class="note">Nothing to review.</p>') + '</div>';
    }
    return html;
  }

  function mountPlayground() {
    if (!S || !window.LasgidiPlayground) return;
    var narrow = window.matchMedia && window.matchMedia('(max-width: 899px)').matches;
    var slot = document.querySelector('.map-panel .pg-slot') || document.querySelector('.tab-body .pg-slot');
    if (!slot) return;
    if (!playground) playground = window.LasgidiPlayground.create({
      onSelect: function (k) { ui.sel = k === S.loc ? null : k; ui.place = null; ui.board = null; render(); },
      onSelectPlace: function (id) { clearPicks(); ui.mapPop = null; ui.place = id; render(); },
      onSelectPlayer: function (by) { clearPicks(); ui.chatWith = by; online.unread[by] = 0; render(); },
      onSelectBoard: function (id) { clearPicks(); ui.board = id; render(); },
      onSelectHome: function (id) { clearPicks(); ui.homeSel = id; render(); },
      onSelectPlot: function (n) { clearPicks(); ui.plotSel = n; render(); },
      onSelectSea: function (c, r) { clearPicks(); var w = ui.seaSel ? ui.seaSel.w : 2, h = ui.seaSel ? ui.seaSel.h : 2; ui.seaSel = { x: c, y: r, w: w, h: h }; ui.seaOpen = true; render(); }
    });
    slot.appendChild(playground.el); window.__pg = playground;
    playground.update(sceneFor());
    mountMapUI(narrow);
  }
  // On-map controls: the map fills the window, a 📋 Do button opens what you can do here, and tapping a pin
  // (a place, a home or a billboard) opens its card as a pop-up over the map.
  function mapPopKind() {
    if (ui.mapPop === 'do') return 'do';
    if (ui.sel && ui.sel !== S.loc) return '';
    if (ui.chatWith || ui.seaOpen) return '';
    return ui.place ? 'place' : ui.board ? 'board' : ui.homeSel ? 'home' : '';
  }
  function mapDoHtml() {
    var acts = L.availableActions(S), sortOpen = function (a, b) { return (a.disabled ? 1 : 0) - (b.disabled ? 1 : 0); };
    var place = acts.filter(function (a) { return !a.atHome; }).sort(sortOpen), home = acts.filter(function (a) { return a.atHome; }).sort(sortOpen);
    var html = adviceView() + '<div class="list">' + place.map(actionRow).join('') + '</div>' +
      (home.length ? '<h4>At home · ' + esc(L.homeDef(S).name) + '</h4><div class="list">' + home.map(actionRow).join('') + '</div>' : '') +
      '<div class="inline"><button class="btn ghost" id="wait-1" data-wait="60">Wait 1 hour</button></div>';
    return html.replace(/ id="/g, ' id="mp-'); // the Do tab can be on screen too: keep ids unique
  }
  function mountMapUI(narrow) {
    var el = playground && playground.el; if (!el) return;
    var full = el.classList.contains('pg-full');
    if (!full) {
      el.classList.add('pg-fit');
      // Fill the window below the sticky status strip and above the phone's bottom bar.
      var strip = document.querySelector('.strip'), nav = document.querySelector('.bnav');
      var navH = nav ? nav.getBoundingClientRect().height : 0;
      // The map on its own: fit it between its top edge and the bottom bar, so every control shows without scrolling.
      var used = el.closest('.map-only') ? Math.min(el.getBoundingClientRect().top + window.scrollY, window.innerHeight * 0.45) + navH + 10 : (strip ? strip.getBoundingClientRect().height : 0) + navH + 16;
      el.style.height = Math.max(340, Math.round(window.innerHeight - used)) + 'px';
    } else el.style.height = '';
    var dock = el.querySelector('.map-dock');
    if (!dock) { dock = document.createElement('div'); dock.className = 'map-dock'; el.appendChild(dock); }
    var n = L.availableActions(S).filter(function (a) { return !a.disabled; }).length, kind = mapPopKind();
    dock.innerHTML = '<button type="button" class="map-dock-btn' + (kind === 'do' ? ' on' : '') + '" id="map-do" data-mappop="do" aria-expanded="' + (kind === 'do') + '" aria-label="What you can do in ' + esc(D.DISTRICTS[S.loc].name) + '">📋 Do here <span class="num">' + n + '</span></button>';
    var pop = el.querySelector('.map-pop');
    if (!pop) { pop = document.createElement('div'); pop.className = 'map-pop'; pop.setAttribute('role', 'dialog'); el.appendChild(pop); }
    var title = kind === 'do' ? '📋 In ' + D.DISTRICTS[S.loc].name : kind === 'place' ? '📍 ' + (D.PLACES.filter(function (p) { return p.id === ui.place; })[0] || {}).name : kind === 'board' ? '🪧 Billboard' : kind === 'home' ? '🏠 ' + (D.HOMES[ui.homeSel] || {}).name : '';
    var body = kind === 'do' ? mapDoHtml() : kind === 'place' ? placeView(ui.place) : kind === 'board' ? boardView(ui.board) : kind === 'home' ? homeView(ui.homeSel) : '';
    pop.hidden = !kind;
    pop.setAttribute('aria-label', title || 'Map');
    pop.innerHTML = kind ? '<div class="map-pop-h"><b>' + esc(title || '') + '</b><button type="button" class="btn sm ghost" id="map-pop-close" data-mappopclose="1" aria-label="Close">✕</button></div><div class="map-pop-b">' + body + '</div>' : '';
  }

  // Fly or take the bus to another city.
  function citiesView() {
    var here = L.cityOf(S), html = '<div class="section cities"><h3>✈️ Other cities</h3><p class="note">You are in ' + esc(D.CITIES[here].name) + '. Flights leave from ' + esc(D.DISTRICTS[D.CITIES[here].airport].name) + '; buses from ' + esc(D.DISTRICTS[D.CITIES[here].park].name) + ' (daytime only). Your home and rent stay where they are; you can move house to another city from its Homes list.</p>';
    Object.keys(D.CITIES).filter(function (c) { return c !== here; }).forEach(function (c) {
      var opts = L.intercityOptions(S, c);
      html += '<div class="city-card"><h4>' + esc(D.CITIES[c].name) + '</h4><div class="list">' + opts.map(function (o) {
        var at = S.loc === o.from;
        return '<div class="item"><div><h3>' + (o.mode === 'flight' ? '✈️ ' : '🚌 ') + esc(o.name) + '</h3><div class="meta"><span>' + dur(o.mins) + '</span><span class="cost num">' + (o.cost ? N(o.cost) : 'Free') + '</span>' + (o.disabled ? '<span class="why">' + esc(o.disabled) + '</span>' : '') + '</div></div>' +
          (o.disabled && !at ? '<button class="btn sm ghost" id="go-' + c + '-' + o.mode + '" data-tripto="' + o.from + '">Go to ' + esc(D.DISTRICTS[o.from].name) + '</button>' : '<button class="btn sm go" id="fly-' + c + '-' + o.mode + '" data-fly="' + c + ':' + o.mode + '"' + (o.disabled ? ' disabled' : '') + '>Go</button>') + '</div>';
      }).join('') + '</div></div>';
    });
    return html + '</div>';
  }
  function placeFilters() {
    var cats = Object.keys(D.PLACE_TYPES);
    var html = '<div class="pg-chips" role="group" aria-label="Show places"><span class="label">Places</span>' +
      '<button type="button" class="pg-chip' + (!ui.placeCat ? ' sel' : '') + '" id="pc-all" data-placecat="">All</button>' +
      cats.map(function (c) { return '<button type="button" class="pg-chip' + (ui.placeCat === c ? ' sel' : '') + '" id="pc-' + c + '" data-placecat="' + c + '"><i class="sw" style="background:' + D.PLACE_TYPES[c].color + '"></i>' + esc(D.PLACE_TYPES[c].name) + '</button>'; }).join('') +
      (L.cityOf(S) === 'lagos' ? '<button type="button" class="pg-chip' + (ui.placeCat === 'boards' ? ' sel' : '') + '" id="pc-boards" data-placecat="boards">📣 Billboards</button><button type="button" class="pg-chip' + (ui.seaOpen ? ' sel' : '') + '" id="pc-sea" data-seaopen="1">🌊 Sea Plots</button>' : '') +
      '<button type="button" class="pg-chip' + (ui.placeCat === 'homes' ? ' sel' : '') + '" id="pc-homes" data-placecat="homes">🏠 Homes</button>' +
      '<button type="button" class="pg-chip' + (ui.placeCat === 'cities' ? ' sel' : '') + '" id="pc-cities" data-placecat="cities">✈️ Cities</button></div>';
    if (ui.placeCat === 'cities') return html + citiesView();
    if (ui.placeCat === 'homes') {
      html += '<div class="pg-chips">' + marketHomes().filter(function (k) { return L.districtCity(D.HOMES[k].district) === L.cityOf(S); }).map(function (k) {
        var h = D.HOMES[k];
        return '<button type="button" class="pg-chip' + (ui.homeSel === k ? ' sel' : '') + (S.home === k ? ' here' : '') + '" id="hm-' + k + '" data-homesel="' + k + '">' + esc(h.name) + ' <span class="num">· ' + N(L.price(S, h.rent)) + '/wk</span></button>';
      }).join('') + (L.cityOf(S) === 'lagos' ? '<button type="button" class="pg-chip" id="hm-estate" data-plotsel="' + (L.myPlot(S) != null ? L.myPlot(S) : firstFreePlot()) + '">🏡 ' + esc(D.ESTATE.name) + ' plots</button>' : '') + '</div>';
    } else if (ui.placeCat === 'boards') {
      html += '<div class="pg-chips">' + D.BILLBOARDS.map(function (b) {
        var n = paidAds(b.id).length + sponsoredAds(b.id).length;
        return '<button type="button" class="pg-chip' + (ui.board === b.id ? ' sel' : '') + '" id="bb-' + b.id + '" data-boardsel="' + b.id + '">' + esc(b.name) + (n ? ' <span class="onair">' + n + '</span>' : '') + '</button>';
      }).join('') + '</div>';
    } else if (ui.placeCat) {
      html += '<div class="pg-chips">' + D.PLACES.filter(function (p) { return p.type === ui.placeCat && L.districtCity(p.district) === L.cityOf(S); }).map(function (p) {
        return '<button type="button" class="pg-chip' + (ui.place === p.id ? ' sel' : '') + '" id="pl-' + p.id + '" data-place="' + p.id + '">' + (p.icon || '') + ' ' + esc(p.name) + '</button>';
      }).join('') + '</div>';
    }
    return html;
  }

  function questChips() {
    var qs = L.activeQuests(S);
    if (!qs.length) return '';
    return '<div class="quests" role="group" aria-label="Quests">' + qs.map(function (q) {
      return '<button type="button" class="quest' + (q.done ? ' done' : '') + '" id="q-' + q.id + '" data-quest="' + q.id + '" title="' + esc(q.title + ': ' + (q.done ? 'claim ' + N(q.reward) : q.hint)) + '" aria-label="' + esc(q.title + '. ' + (q.done ? 'Claim ' + N(q.reward) : q.hint)) + '"><span class="q-ic">' + q.icon + '</span><span class="q-t"><b>' + esc(q.title) + '</b><small>' +
        (q.done ? 'Claim ' + N(q.reward) : esc(q.hint)) + '</small></span></button>';
    }).join('') + '</div>';
  }
  function questsView() {
    var got = S.quests || {};
    return '<div class="section"><h3>🎯 Quests</h3><p class="note">Small goals to get you started. Each pays once.</p><div class="list">' + D.QUESTS.map(function (q) {
      var claimed = got[q.id] != null, done = L.questDone(S, q.id);
      return '<div class="item"><div><h3>' + q.icon + ' ' + esc(q.title) + '</h3><div class="meta">' + (claimed ? '<span class="gain">Claimed</span>' : done ? '<span class="gain">Done</span>' : '<span>' + esc(q.hint) + '</span>') + '<span class="num">' + N(L.price(S, q.reward)) + '</span></div></div>' +
        (claimed ? '' : '<button class="btn sm' + (done ? '' : ' ghost') + '" id="qa-' + q.id + '" data-quest="' + q.id + '">' + (done ? 'Claim' : 'Go') + '</button>') + '</div>';
    }).join('') + '</div></div>';
  }
  var QUEST_APPS = { nysc: 1, creator: 1, shop: 1, stocks: 1, jobs: 1, gems: 1, bank: 1, events: 1, dealers: 1, travel: 1 };
  function goQuest(id) {
    var q = D.QUESTS.filter(function (x) { return x.id === id; })[0];
    if (!q) return;
    if (L.questDone(S, id)) { run(function () { return L.claimQuest(S, id); }); return; }
    if (QUEST_APPS[q.go]) { ui.tab = 'phone'; ui.app = q.go; }
    else if (q.go === 'map') { ui.place = 'ojuelegba_park'; ui.placeCat = null; ui.board = null; ui.sel = null; ui.tab = 'map'; }
    else ui.tab = q.go === 'business' ? 'money' : q.go;
    render();
  }

  function mapBlock() {
    var d = D.DISTRICTS[S.loc];
    var chips = '<div class="pg-chips" role="group" aria-label="Districts">' + Object.keys(D.DISTRICTS).filter(function (k) { return L.districtCity(k) === L.cityOf(S); }).map(function (k) {
      var here = k === S.loc, sel = k === ui.sel;
      return '<button type="button" class="pg-chip' + (here ? ' here' : '') + (sel ? ' sel' : '') + '" id="go-' + k + '" data-go="' + k + '"' + (here ? ' aria-current="true"' : '') + '>' + esc(D.DISTRICTS[k].name) +
        (online.peers[k] ? ' <span class="num">· ' + online.peers[k] + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    return '<div class="panel-h"><h2>' + esc(d.name) + '</h2><span class="label">' + (d.side === 'island' ? 'Island' : 'Mainland') + '</span></div>' +
      layerChips() + '<div class="pg-wrap">' + (firstRun() ? '' : questChips()) + '<div class="pg-slot"></div></div>' + (firstRun() ? '' : govChips()) + placeFilters() + chips +
      '<div class="legend"><span>Road</span><span class="ferry">Ferry</span><span class="muted">BRT: Ikorodu, Ikeja, Oshodi, Yaba, Lagos Island</span></div>' +
      '<div class="where">' + (ui.sel && ui.sel !== S.loc ? travelView(ui.sel) + (ui.place ? '<p class="note">Heading for ' + esc(D.PLACES.filter(function (p) { return p.id === ui.place; })[0].name) + '.</p>' : '')
        : ui.chatWith ? chatView(ui.chatWith) : ui.seaOpen ? seaView() : (ui.place || ui.board || ui.homeSel) ? '<p class="note">Opened on the map. Tap ✕ on the card to close it.</p>' : ui.plotSel != null ? plotView(ui.plotSel)
        : '<p>' + esc(d.blurb) + ' Tap a district, a place, a home or a billboard.</p>') + '</div>';
  }

  function travelView(dest) {
    var opts = L.travelOptions(S, dest);
    var km = opts.length ? opts[0].km : 0;
    var rows = opts.filter(function (o) { return !(o.mode === 'car' && !S.car); }).map(function (o) {
      var meta = dur(o.mins) + ' · ' + (o.cost ? N(o.cost) : 'free') + (o.energy ? ' · −' + o.energy + ' energy' : '') + (o.traffic > 1.3 ? ' · go-slow ×' + o.traffic : '') + (o.wet && !L.outfitTags(S).rain ? ' · you will get wet' : '');
      return '<div class="mode' + (o.disabled ? ' dis' : '') + '"><b>' + (icon3d(MODE_ICONS[o.mode]) || '') + esc(o.name) + '</b><div class="meta">' + (o.disabled ? esc(o.disabled) : meta) +
        (o.risk && !o.disabled ? '<em>' + esc(o.risk) + '</em>' : '') + '</div>' +
        '<button class="btn sm go" id="go-' + o.mode + '" data-travel="' + dest + '" data-mode="' + o.mode + '"' + (o.disabled ? ' disabled' : '') + '>Go</button></div>';
    }).join('');
    return '<div class="inline" style="justify-content:space-between"><h3>To ' + esc(D.DISTRICTS[dest].name) + ' <span class="muted num">· ' + km + ' km</span></h3>' +
      '<button class="btn sm ghost" id="clear-sel" data-clear-sel="1">Close</button></div>' +
      '<p>' + esc(D.DISTRICTS[dest].blurb) + '</p>' + weatherNote() + '<div class="modes">' + rows + '</div>';
  }
  var WX_INFO = { clear: ['☀️', 'Clear'], rain: ['🌧️', 'Rain'], storm: ['⛈️', 'Storm'], harmattan: ['🌫️', 'Harmattan'] };
  function weatherNote() {
    var w = L.weatherNow(S);
    if (w === 'rain') return '<p class="note">🌧️ Rain: roads are about 35% slower, and you get soaked on foot, okada, keke, danfo, BRT or ferry without an umbrella.</p>';
    if (w === 'storm') return '<p class="note">⛈️ Storm: roads are about 70% slower, okadas and kekes have parked, and boats are not sailing.</p>';
    return '';
  }
  function weatherView() {
    if (!(S.rules >= 9)) return '<div class="section"><h3>🌦️ Weather</h3><p class="note">This life began before the weather update, so the sky stays clear. Your next life gets rainy seasons, storms and harmattan.</p></div>';
    var now = L.weatherNow(S), d0 = L.day(S);
    return '<div class="section"><h3>🌦️ Weather</h3><p class="note">Now: ' + WX_INFO[now][0] + ' ' + WX_INFO[now][1] + '. Rain falls from about 11:00 to 18:00. The rainy season runs from April to October, with a break in August. Harmattan dust comes in December and January. An umbrella (Wardrobe → Accessories) keeps you dry.</p><div class="list">' +
      L.weatherForecast(S, 7).map(function (f) {
        var I = WX_INFO[f.wx];
        return '<div class="item"><div><h3>' + I[0] + ' ' + (f.day === d0 ? 'Today' : D.DAYS[f.day % 7]) + '</h3><div class="meta"><span>' + I[1] + (f.wx === 'rain' || f.wx === 'storm' ? ' · 11:00–18:00' : '') + '</span></div></div></div>';
      }).join('') + '</div></div>';
  }

  /* ---------- mini-games: one overlay, outside the render tree, for all five ---------- */
  // From rules 10 the engine charges a game when it starts (L.startMinigame), so
  // quitting forfeits the run; older lives pay on collect, as they always did.
  var MINIGAMES = {
    danfo: { lib: 'LasgidiDanfo', label: 'Danfo Run', title: '🚐 Danfo Run · Ojuelegba to Yaba', salt: 0, collect: 'Collect and end the shift',
      note: function () { return '◀ ▶ (or swipe) to change lanes. Hold BRAKE (or ↓/space) at a 🚏 in the left lane to drop and load. Never stop in a yellow LASTMA zone. Dodge potholes, okadas and cars. Takings are capped at ' + N(L.price(S, 12000)) + '. The owner takes ' + N(L.price(S, 4000)) + ' and fuel is on you.'; },
      live: function (st) { return st.served + ' passengers, ' + N(st.fares) + ' in fares' + (st.fines ? ', ' + N(st.fines) + ' in fines' : ''); },
      done: function (r) { return 'Run over: ' + r.served + ' passengers, ' + N(r.fares) + ' in fares.'; },
      pay: function (r) { return L.danfoShift(S, r.fares, r.fines, r.served); } },
    dance: { lib: 'LasgidiDance', label: 'Owambe dance-off', title: '💃 Owambe dance-off', salt: 77, collect: 'Collect the spray',
      note: function () { return 'Tap the lane (or press ← ↓ ↑ → or D F J K) as each note hits the line. Every 10 in a row brings the guests out to spray you. The entry is ' + N(L.price(S, 3000)) + ' and spraying is capped at ' + N(L.price(S, 4000)) + '; an owambe outfit helps.'; },
      live: function (st) { return st.hits + ' of ' + st.total + ' beats, streak ' + st.combo; },
      done: function (r) { return 'The DJ cuts the music: ' + r.hits + ' of ' + r.total + ' beats.'; },
      pay: function (r) { return L.danceOff(S, r.hits, r.total, r.best); } },
    hawk: { lib: 'LasgidiHawker', label: 'Go-slow hawker', title: '🛒 Hawk in the Oshodi go-slow', salt: 313, collect: 'Count the money and go home',
      note: function () { return 'When a driver raises a hand, pick what they want from your tray (or press 1–4) and tap their car before the light turns green. Hold 🙈 HIDE (or space) when the task force van comes. Your tray costs ' + N(L.price(S, 4000)) + ' and sales are capped at ' + N(L.price(S, 10000)) + '.'; },
      live: function (st) { return st.served + ' sales, ' + st.goods + ' items left' + (st.van ? '. Task force van coming!' : ''); },
      done: function (r) { return 'Shift over: ' + r.served + ' sales.'; },
      pay: function (r) { return L.hawkShift(S, r.sales, r.served, r.wrong, r.seized); } },
    bole: { lib: 'LasgidiBole', label: 'Bole grill', title: '🍌 Bole grill · Old GRA', salt: 919, collect: 'Collect your share',
      note: function () { return 'Pick plantain, fish or yam (or press 1–3) and tap an empty spot on the grill. When it turns golden, tap it to serve whoever ordered it. Leave it too long and it burns. Mama keeps half the takings and charges for anything burnt, and your share is capped at ' + N(L.price(S, 9000)) + '.'; },
      live: function (st) { return st.served + ' plates served, ' + st.burnt + ' burnt'; },
      done: function (r) { return 'Grill closed: ' + r.served + ' plates served.'; },
      pay: function (r) { return L.boleShift(S, r.sales, r.served, r.burnt); } },
    quiz: { lib: 'LasgidiQuiz', label: 'Naija Quiz', title: '🎤 Naija Quiz · Millennium Park', salt: 7919, collect: 'Collect your prize',
      note: function () { return 'Ten questions, 12 seconds each. Tap an answer or press A–D. Five right wins a prize, rising to ' + N(L.price(S, 8000)) + ' for 10 out of 10. One show a day.'; },
      live: null, // the quiz is buttons and text already
      done: function (r) { return 'That\'s the show: ' + r.correct + ' out of ' + r.total + '.'; },
      pay: function (r) { return L.quizShow(S, r.correct, r.total); } }
  };
  var mini = null; // { kind, game, ov, result, timer, onKey }
  function miniFocusables(ov) { return Array.prototype.filter.call(ov.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'), function (el) { return el.offsetParent !== null; }); }
  function openMinigame(kind) {
    var g = MINIGAMES[kind];
    if (!g || !window[g.lib] || document.getElementById('danfo-overlay')) return;
    var paid = false;
    if (L.miniStarts(S)) {
      var started = null;
      run(function () { started = L.startMinigame(S, kind); return started; });
      if (!started || !started.ok || S.over) return;
      paid = true;
    }
    var ov = document.createElement('div'); ov.id = 'danfo-overlay'; ov.className = 'scrim danfo-scrim'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', g.label);
    ov.innerHTML = '<div class="sheet danfo-sheet" tabindex="-1"><div class="inline" style="justify-content:space-between"><b>' + g.title + '</b><button class="btn sm ghost" id="danfo-quit">Quit</button></div><div class="danfo-slot"></div>' +
      '<p class="note">' + g.note() + (paid ? ' <b>Paid up front: quitting forfeits this run.</b>' : '') + ' Esc quits.</p><p class="sr-only" id="mini-live" aria-live="polite"></p><div class="danfo-end"></div></div>';
    document.body.appendChild(ov);
    var m = mini = { kind: kind, ov: ov, result: null, timer: 0 };
    var reduce = document.documentElement.classList.contains('lite');
    m.game = window[g.lib].create({ seed: (S.seed ^ S.t ^ g.salt) | 0, reduce: reduce, onDone: function (r) {
      m.result = r;
      ov.querySelector('#mini-live').textContent = g.done(r) + ' Press ' + g.collect + '.';
      ov.querySelector('.danfo-end').innerHTML = '<div class="inline"><button class="btn go" id="danfo-collect">' + g.collect + '</button></div>';
      var c = ov.querySelector('#danfo-collect'); if (c) c.focus();
    } });
    ov.querySelector('.danfo-slot').appendChild(m.game.el);
    window.__mini = window.__danfo = m.game; // handle for tests
    // A spoken score for screen readers: the canvas label follows the game, once a second.
    var cv = m.game.el.querySelector('canvas');
    if (g.live && cv && m.game.state) m.timer = setInterval(function () { var st = m.game.state(); if (st && !st.over) cv.setAttribute('aria-label', g.label + ': ' + g.live(st)); }, 1000);
    m.game.start();
    // Focus the sheet, not a button: space and the arrows belong to the game.
    ov.querySelector('.danfo-sheet').focus();
    m.onKey = function (e) {
      if (mini !== m) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!window.confirm(m.result ? 'Leave without collecting your pay?' : paid ? 'Quit this run? You have already paid for it.' : 'Quit this run? You will not be paid for it.')) return;
        closeMinigame(); return;
      }
      if (e.key === 'Tab') {
        var f = miniFocusables(ov); if (!f.length) { e.preventDefault(); return; }
        var i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && (i < 0 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', m.onKey, true);
    ov.addEventListener('click', function (e) {
      if (e.target.id === 'danfo-quit') { closeMinigame(); return; }
      if (e.target.id === 'danfo-collect' && m.result) { var r = m.result; closeMinigame(); run(function () { return g.pay(r); }); refocusPlay(kind); }
    });
  }
  function closeMinigame() {
    var m = mini; mini = null;
    if (m) { if (m.game) m.game.stop(); clearInterval(m.timer); document.removeEventListener('keydown', m.onKey, true); m.ov.remove(); refocusPlay(m.kind); }
    var ov = document.getElementById('danfo-overlay'); if (ov) ov.remove();
  }
  // Back to the Play button that opened the game (the page re-rendered behind the overlay).
  function refocusPlay(kind) { var b = document.querySelector('[data-minigame="' + kind + '"]:not([disabled])') || document.getElementById('tab-do'); if (b) b.focus(); }

  /* ---------- Do tab ---------- */
  // A friendly emoji for each action row, read off its label (display only).
  var ACT_ICONS = [[/clock in|shift|work at/i, '💼'], [/sleep|nap|rest/i, '😴'], [/eat|food|suya|amala|bole|pepper ?soup|brunch|meal|buka|jollof/i, '🍲'], [/beach|jet ?ski|boat|yacht|swim/i, '🏖️'], [/club|rave|party|owambe|spray|concert|show|lounge|rooftop|shisha/i, '🪩'],
    [/skit|film|shoot/i, '🎬'], [/live|stream/i, '🔴'], [/gym|football|basket|tennis|box|run|sport|match|golf|polo|squash|tournament/i, '⚽'], [/church|mosque|pray|service/i, '🙏'], [/market|buy|shop|haggle/i, '🛍️'], [/bath|shower|wash|barb|salon|glam|hair|nails/i, '🫧'],
    [/study|class|course|read|lesson|exam|ielts/i, '📚'], [/watch|museum|park|gallery|shrine|sight|tour|visit|landmark|art/i, '📸'], [/help|cousin|hustle|hawk|sell|danfo|okada|keke|gig|labour/i, '🛠️'], [/friend|date|call|hang|gist|family|kid|wife|husband/i, '💬']];
  function actIcon(a) { if (a.minigame) return '🎮'; if (a.isWork) return '💼'; for (var i = 0; i < ACT_ICONS.length; i++) if (ACT_ICONS[i][0].test(a.label)) return ACT_ICONS[i][1]; return '✨'; }
  function actionRow(a) {
    var meta = ['<span>' + dur(a.mins) + '</span>'];
    if (a.price) meta.push('<span class="cost">' + N(a.price) + (a.gen ? ' incl. gen' : '') + '</span>');
    if (a.earnEst) meta.push('<span class="gain">~' + N(a.earnEst) + '</span>');
    if (a.xp) meta.push('<span>' + Object.keys(a.xp).map(function (k) { return '+' + D.SKILLS[k]; }).join(' ') + '</span>');
    if (a.whenLabel) meta.push('<span>' + esc(a.whenLabel) + '</span>');
    if (a.late) meta.push('<span class="cost">Late: 30% docked</span>');
    if (a.collapseRisk && !a.disabled) meta.push('<span class="cost">' + esc(a.collapseRisk) + '</span>');
    return '<div class="item act' + (a.isWork ? ' work' : '') + '"><span class="act-ic" aria-hidden="true">' + actIcon(a) + '</span><div><h3>' + esc(a.label) + '</h3><div class="meta">' + meta.join('') + '</div>' +
      (a.note ? '<div class="act-note">' + esc(a.note) + '</div>' : '') + (a.disabled ? '<div class="why">' + esc(a.disabled) + '</div>' : '') + '</div>' +
      (a.minigame ? '<button class="btn go" id="act-' + a.id + '" data-minigame="' + a.minigame + '"' + (a.disabled ? ' disabled' : '') + '>▶ Play</button></div>'
        : '<button class="btn' + (a.isWork ? ' go' : '') + '" id="act-' + a.id + '" data-act="' + a.id + '"' + (a.disabled ? ' disabled' : '') + '>' + (a.isWork ? 'Clock in' : 'Do') + '</button></div>');
  }

  function adviceView() {
    var tips = L.advise(S);
    if (!tips.length) return '';
    return '<section class="advice" aria-label="Suggestions"><span class="label">Wetin I go do?</span>' + tips.map(function (t, i) {
      var a = t.act, btn = '';
      if (a && a.type === 'act') btn = '<button class="btn sm go" id="adv-' + i + '" data-act="' + a.id + '">Do it</button>';
      if (a && a.type === 'travel') btn = '<button class="btn sm go" id="adv-' + i + '" data-travel="' + a.dest + '" data-mode="' + a.mode + '">Go</button>';
      if (a && a.type === 'apply') btn = '<button class="btn sm go" id="adv-' + i + '" data-apply="' + a.id + '">Apply</button>';
      if (a && a.type === 'treat') btn = '<button class="btn sm go" id="adv-' + i + '" data-treat="1">Buy drugs</button>';
      if (a && a.type === 'lodge') btn = '<button class="btn sm go" id="adv-' + i + '" data-lodge="' + a.id + '">Book</button>';
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

  // A one-line nudge when a gem is hidden in the district you are in.
  function gemHere() {
    var g = gemsLeft().filter(function (x) { return x.district === S.loc; })[0];
    if (!g) return '';
    var pl = D.PLACES.filter(function (x) { return x.id === g.place; })[0];
    return '<div class="gem-here"><span>💎 A gem is hidden at <b>' + esc(pl.name) + '</b>.</span><button class="btn sm" id="gemh-' + g.n + '" data-gem="' + g.n + '">Pick it up · ' + N(L.nextGemPrize(S, gemToday())) + '</button></div>';
  }
  function streakCard() {
    if (!S || S.challenge) return '';
    var id = gemToday(), info = L.streakInfo(S, id);
    if (info.claimed) return '';
    var dots = ''; for (var i = 0; i < 7; i++) dots += '<i class="' + (i < info.slot ? 'on' : i === info.slot ? 'now' : '') + '"></i>';
    return '<div class="streak"><span class="st-ic">🔥</span><div class="st-t"><b>Day ' + info.n + ' streak</b><span class="st-dots" aria-label="Day ' + (info.slot + 1) + ' of 7">' + dots + '</span></div><button class="btn sm go" id="streak" data-streak="1">Claim ' + N(info.prize) + '</button></div>';
  }
  // December in Lagos: what is on, and what it costs.
  function dettyCard() {
    if (!L.isDecember(S) || L.cityOf(S) !== 'lagos') return '';
    var wk = L.week(S) % 4, phase = ['the warm-up', 'the build-up', 'Christmas week', 'the New Year countdown'][wk], live = [];
    Object.keys(D.PLACE_ACTIONS).forEach(function (d) { if (L.districtCity(d) !== 'lagos') return; D.PLACE_ACTIONS[d].forEach(function (a) { if (a.dec && L.inWindow(S, a.when)) live.push({ a: a, d: d }); }); });
    var newRules = S.rules >= 14;
    return '<div class="section detty"><h3>🎉 Detty December · ' + phase + '</h3><p class="note">IJGBs are home, the city never sleeps and everything costs more: prices +15%' + (newRules ? ', hotels and short-lets +60%, heavier traffic, gigs pay 20% more' : '') + '.' + (S.stats.decEvents ? ' You have been to ' + S.stats.decEvents + ' December event' + (S.stats.decEvents === 1 ? '' : 's') + ' this season.' : '') + '</p>' +
      (live.length ? '<div class="label">On right now</div><ul class="note detty-live">' + live.slice(0, 5).map(function (r) { return '<li>' + esc(r.a.label) + ' · ' + esc(D.DISTRICTS[r.d].name) + (r.a.cost ? ' · ' + N(L.price(S, r.a.cost)) : ' · free') + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="inline"><button class="btn sm" id="detty-whatson" data-tab="phone" data-app="events">🎟️ What\'s on this December</button></div></div>';
  }
  function sickCard() {
    var k = L.sickInfo(S);
    if (!k) return '';
    return '<div class="section sick-card"><h3>🦟 Malaria · day ' + (k.days + 1) + '</h3><p class="note">' + (k.drugs ? 'You are on antimalarials. Rest: the fever should break soon.' : k.worse ? 'It is getting worse. Your energy is draining fast and you could collapse.' : 'Fever and chills drain your energy and your work suffers.') + ' A mosquito net, a running fan or AC keeps them off at night.</p>' +
      (k.drugs ? '' : '<div class="inline"><button class="btn go" id="treat" data-treat="1"' + (k.why ? ' disabled' : '') + '>💊 Buy antimalarials · ' + N(k.cost) + '</button></div>' + (k.why ? '<p class="why">' + esc(k.why) + '.</p>' : '')) + '</div>';
  }
  // Away from your home district: somewhere to sleep, paid by the night.
  function lodgingView() {
    var opts = L.lodgingOptions(S), hd = L.homeDef(S);
    var note = '<p class="note">Home is ' + esc(hd.name) + ' in ' + esc(D.DISTRICTS[hd.district].name) + (L.districtCity(hd.district) !== L.cityOf(S) ? ', ' + esc(D.CITIES[L.districtCity(hd.district)].name) : '') + '. Sleep, cook and bathe there' + (opts.length ? ', or pay for a night here.' : '.') + '</p>';
    if (!opts.length) return '<div class="section">' + note + '</div>';
    return '<div class="section"><h3>🛏️ Somewhere to sleep</h3>' + note + '<div class="list">' + opts.map(function (o) {
      var L2 = D.LODGING[o.id];
      return '<div class="item"><div><h3>' + o.icon + ' ' + esc(o.name) + '</h3><div class="meta"><span class="cost num">' + N(o.price) + ' a night</span><span>till 06:30</span>' + (L2.gen ? '<span>generator</span>' : '<span>NEPA light only</span>') + (L2.fx && L2.fx.hunger ? '<span>breakfast</span>' : '') + '</div>' + (o.disabled ? '<div class="why">' + esc(o.disabled) + '</div>' : '') + '</div>' +
        '<button class="btn sm" id="lodge-' + o.id + '" data-lodge="' + o.id + '"' + (o.disabled ? ' disabled' : '') + '>Sleep here</button></div>';
    }).join('') + '</div></div>';
  }
  function doView() {
    var acts = L.availableActions(S);
    var home = acts.filter(function (a) { return a.atHome; });
    var place = acts.filter(function (a) { return !a.atHome; });
    var d = D.DISTRICTS[S.loc];
    var html = '<div class="panel-h"><h2>In ' + esc(d.name) + '</h2><span class="muted">Sorted: open now first</span></div><div class="panel-b">' + tourCard() + streakCard() + partyInvites() + visitView() + adviceView() + gemHere() + giftInbox();
    var sortOpen = function (a, b) { return (a.disabled ? 1 : 0) - (b.disabled ? 1 : 0); };
    html += sickCard() + dettyCard();
    html += '<div class="list">' + place.sort(sortOpen).map(actionRow).join('') + '</div>';
    html += fishingCard() + peopleHere() + gemCard();
    if (home.length) html += '<div class="section"><h3>At home · ' + esc(L.homeDef(S).name) + '</h3><div class="list">' + home.sort(sortOpen).map(actionRow).join('') + '</div></div>';
    else html += lodgingView();
    html += '<div class="section"><div class="inline"><button class="btn ghost" id="wait-1" data-wait="60">Wait 1 hour</button><span class="note">Pantry: ' + S.pantry + ' meals at home</span></div></div>';
    return html + '</div>';
  }

  // Building on your Ikorodu plot: stage by stage, with the omo-onile first.
  function buildView() {
    var b = L.buildInfo(S);
    if (!b.hasPlot && !b.built && !b.done) return '<p class="note">Buy the plot of land in Ikorodu and you can build your own house on it, stage by stage.</p>';
    var steps = b.stages.map(function (st, i) {
      var state = i < b.done || b.built ? 'done' : i === b.done && b.working ? 'now' : '';
      return '<li class="bd-' + (state || 'todo') + '"><span>' + st.icon + '</span> ' + esc(st.name) + (state === 'now' ? ' · ' + b.readyIn + ' day' + (b.readyIn === 1 ? '' : 's') + ' to go' : state === 'done' ? ' ✓' : ' · ' + N(L.price(S, st.cost))) + '</li>';
    }).join('');
    var html = '<div class="build"><h4>🏗️ ' + (b.built ? 'Your house in Ikorodu is finished' : 'Build on your Ikorodu plot') + '</h4><ol class="bd-steps">' + steps + '</ol>';
    if (b.built) html += S.home === 'built_own' ? '<p class="note">You live here: no rent, ever.</p>' : '<p class="note">Tenants pay you ' + N(L.price(S, D.PROPERTIES.built_house.weekly)) + ' a week while you live elsewhere. Move in from the homes list.</p>';
    else if (b.working) html += '<p class="note">Work is going on at the site. The next stage can start when this one is done.</p>';
    else html += '<div class="inline"><button class="btn sm' + (b.why ? '' : ' go') + '" id="build-next" data-build="1"' + (b.why ? ' disabled' : '') + '>Start ' + esc(b.next.name.toLowerCase()) + ' · ' + N(b.cost) + '</button>' +
      (b.why && /Visit the site/.test(b.why) ? '<button class="btn sm ghost" id="build-go" data-tripto="ikorodu" data-tab="map">Go to Ikorodu</button>' : '') + '</div>' +
      (b.levy ? '<p class="note">Includes the omo-onile "development levy" (' + N(b.levy) + ') before the foundation.</p>' : '') + (b.why ? '<p class="why">' + esc(b.why) + '.</p>' : '');
    return html + '</div>';
  }

  /* ---------- Work tab ---------- */
  // The interview panel: three questions from the engine, answered with radio buttons.
  function interviewView() {
    var cid = ui.interview; if (!cid) return '';
    var c = D.CAREERS[cid], qs = L.interviewQuestions(S, cid), why = L.interviewBlock(S, cid);
    return '<div class="section interview"><h3>🎤 Interview · ' + esc(c.titles[0]) + ', ' + esc(c.name) + '</h3><p class="note">Answer three questions. Two right gets you the job' + (L.skillLevel(S, 'charisma') >= 4 ? ' (your Charisma means one will do)' : '') + '. Fail and they will "get back to you" in 3 days.</p>' +
      qs.map(function (q, i) {
        return '<fieldset class="iv-q"><legend>' + (i + 1) + '. ' + esc(q.q) + '</legend>' + q.opts.map(function (o, k) {
          return '<label class="iv-opt"><input type="radio" name="iv-' + i + '" value="' + k + '" id="iv-' + i + '-' + k + '"> ' + esc(o) + '</label>';
        }).join('') + '</fieldset>';
      }).join('') +
      '<div class="inline"><button class="btn go" id="iv-submit" data-ivsubmit="' + cid + '"' + (why ? ' disabled' : '') + '>Submit answers</button><button class="btn ghost" id="iv-cancel" data-interview="">Not now</button></div>' + (why ? '<p class="why">' + esc(why) + '.</p>' : '') + '</div>';
  }
  function workView() {
    var html = '<div class="panel-h"><h2>Work</h2><span class="muted">Shifts pay daily. Three no-shows and you are sacked.</span></div><div class="panel-b">' + interviewView() +
      '<details class="section cv-wrap"><summary id="cv-work">📄 Your CV goes with every application</summary>' + cvHtml(L.cv(S)) + '</details>';
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
        (e.ok && !mine && L.needsInterview(S, cid) ? '<button class="btn sm" id="apply-' + cid + '" data-interview="' + cid + '">🎤 Interview</button></div>'
          : '<button class="btn sm" id="apply-' + cid + '" data-apply="' + cid + '"' + (e.ok ? '' : ' disabled') + '>' + (mine ? 'Current' : 'Apply') + '</button></div>');
    }).join('') + '</div></div>';
    return html + '</div>';
  }
  // Pictures: AI-generated illustrations in img/, keyed like 'place:shrine'.
  // Falls back to the given HTML (usually the emoji) when there is none.
  function pic(key, alt, fallback, cls) {
    var src = (window.LASGIDI_IMAGES || {})[key];
    if (!src) return fallback || '';
    return '<img class="pic ' + (cls || '') + '" src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" width="640" height="400">';
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  /* ---------- bank: wallet, savings and treasury bills ---------- */
  function bankView() {
    var tab = ui.bankTab || 'save', held = L.bondsHeld(S), d = L.day(S);
    var html = '<div class="section" style="padding-top:0"><div class="wallet-card"><div class="wc-l">Wallet</div><div class="wc-big num">' + N(S.cash) + '</div>' +
      '<div class="wc-s">Net worth ' + N(L.netWorth(S)) + ' · Cash in hand pays for everything first, then your savings by transfer.</div></div>' +
      '<div class="bank-card"><div class="bk-top"><span class="bk-logo">🐚</span><div><div class="bk-name">EKO RESERVE BANK</div><div class="bk-rate">Savings ' + (L.savingsRate(S) * 100).toFixed(1) + '% a week · Treasury bills ' + +(L.billRate(S) * 100).toFixed(1) + '% in ' + L.BOND_DAYS + ' days</div>' + (S.econ.cbn ? '<div class="bk-rate">CBN governor: ' + D.CBN[S.econ.cbn].icon + ' ' + esc(D.CBN[S.econ.cbn].name) + ' · ' + S.econ.cbnWeeks + ' week' + (S.econ.cbnWeeks === 1 ? '' : 's') + ' left</div>' : '') + '</div></div>' +
      '<div class="bk-pills"><div class="bk-pill"><span>Savings</span><b class="num">' + N(S.bank) + '</b></div><div class="bk-pill"><span>In bills</span><b class="num">' + N(held) + '</b></div></div></div>' +
      '<div class="bank-body"><div class="seg"><button type="button" class="seg-b' + (tab === 'save' ? ' sel' : '') + '" id="bt-save" data-banktab="save">💰 Savings</button><button type="button" class="seg-b' + (tab === 'bill' ? ' sel' : '') + '" id="bt-bill" data-banktab="bill">📜 Treasury bills</button></div>' +
      '<label class="label" for="amt">Amount (₦)</label><input id="amt" class="amt-big" inputmode="numeric" placeholder="₦ 0">' +
      '<div class="pg-chips" style="padding:0">' + [10000, 100000, 1000000, 10000000].map(function (v) { return '<button type="button" class="pg-chip" id="amt-' + v + '" data-bondamt="' + v + '">' + N(v) + '</button>'; }).join('') + '</div>';
    if (tab === 'save') {
      html += '<div class="inline"><button class="btn sm" id="dep" data-bank="dep">Deposit to savings</button><button class="btn sm ghost" id="wd" data-topup="1">💳 Top up wallet</button></div>' +
        '<p class="note">Savings earn ' + (L.savingsRate(S) * 100).toFixed(1) + '% every Monday. Prices rise faster than that, so idle cash loses value. Top up moves savings into your wallet.</p>';
    } else {
      html += '<div class="inline"><button class="btn sm" id="buybond" data-buybond="1">Buy a ' + L.BOND_DAYS + '-day bill</button></div>' +
        '<p class="note">Paid from savings, minimum ' + N(10000) + '. It is locked until it matures, then comes back to savings with ' + +(L.billRate(S) * 100).toFixed(1) + '%. The rate is fixed when you buy.</p>';
      if (S.bonds.length) html += '<div class="list">' + S.bonds.map(function (b, i) {
        var left = b.due - d;
        return '<div class="item"><div><h3>📜 ' + N(b.amt) + '</h3><div class="meta"><span class="gain num">+' + N(L.bondReturn(b.amt, b.rate)) + '</span><span>Matures ' + (left <= 1 ? 'tomorrow' : 'in ' + left + ' days') + '</span></div></div></div>';
      }).join('') + '</div>';
    }
    return html + '</div></div>';
  }

  /* ---------- businesses you build ---------- */
  function businessesView() {
    var html = '<div class="section"><h3>Your businesses</h3><p class="note">Build on a site in any district. Each one pays out daily at 18:00 after running costs. Upgrade it twice to grow it. Without a manager, visit at least weekly, or the staff will steal from you.</p>';
    if (S.businesses.length) html += '<div class="list">' + S.businesses.map(function (b, i) {
      var g = D.BUSINESS_GROWTH[b.id], idle = L.day(S) - b.visit, up = L.upgradeCost(S, b);
      var stars = b.level ? '★★★'.slice(0, b.level) + '☆☆☆'.slice(0, 3 - b.level) : '';
      var meta = [];
      meta.push(b.site ? esc(D.DISTRICTS[b.site].name) : 'No site');
      meta.push('<span class="gain num">~' + N(L.businessEstimate(S, b)) + '/day</span>');
      if (b.site) meta.push('Shop rent ' + N(L.price(S, D.BUSINESS_SITES[b.site].rent * (b.level || 1))) + '/wk');
      if (b.manager) meta.push('Manager ' + N(L.managerPay(S, b)) + '/wk');
      else meta.push('Last visit ' + (idle ? idle + ' days ago' : 'today') + (idle > 7 ? ' <span class="cost">· staff are stealing</span>' : ''));
      var btns = '';
      if (b.level && b.level < 3) btns += '<button class="btn sm" id="upb-' + i + '" data-upb="' + i + '"' + (S.cash + S.bank >= up ? '' : ' disabled') + '>Upgrade ' + N(up) + '</button>';
      if (b.level) btns += b.manager ? '<button class="btn sm ghost" id="fmb-' + i + '" data-fmb="' + i + '">Let manager go</button>' : '<button class="btn sm ghost" id="hmb-' + i + '" data-hmb="' + i + '">Hire manager</button>';
      btns += '<button class="link-btn" id="sell-' + i + '" data-sellb="' + i + '">Sell (60%)</button>';
      return '<div class="item biz">' + pic('biz:' + b.id, L.businessName(b), '<div class="dl-ic">' + (g ? g.icon : '🏪') + '</div>', 'dl-pic') + '<div><h3>' + esc(L.businessName(b)) + (stars ? ' <span class="biz-stars">' + stars + '</span>' : '') + '</h3><div class="meta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div><div class="inline biz-btns">' + btns + '</div></div></div>';
    }).join('') + '</div>' + (S.businesses.some(function (b) { return !b.manager; }) ? '<div class="inline"><button class="btn sm" id="visit" data-visit="1">Check on businesses (2h)</button></div>' : '');
    var site = ui.bizSite || (D.BUSINESS_SITES[S.loc] ? S.loc : 'surulere'), sd = D.BUSINESS_SITES[site];
    html += '<details' + (S.businesses.length && !ui.bizOpen ? '' : ' open') + '><summary>Build a business</summary>' +
      '<div class="inline"><label class="label" for="biz-site">Site</label><select id="biz-site">' + Object.keys(D.BUSINESS_SITES).map(function (k) {
        return '<option value="' + k + '"' + (k === site ? ' selected' : '') + '>' + esc(D.DISTRICTS[k].name) + (L.districtCity(k) !== 'lagos' ? ', ' + esc(D.CITIES[L.districtCity(k)].name) : '') + ' · ×' + D.BUSINESS_SITES[k].mult.toFixed(2) + ' · rent ' + N(L.price(S, D.BUSINESS_SITES[k].rent)) + '/wk</option>';
      }).join('') + '</select></div>' + ['high', 'mid', 'low'].map(function (tier) {
        var keys = Object.keys(D.BUSINESSES).filter(function (k) { return D.BUSINESSES[k].tier === tier; });
        return '<h4 class="dl-group">' + esc(D.BUSINESS_TIERS[tier]) + '</h4><div class="list">' + keys.map(function (k) {
        var bz = D.BUSINESSES[k], p = L.price(S, bz.price), g = D.BUSINESS_GROWTH[k];
        return '<div class="item biz">' + pic('biz:' + k, bz.name, '<div class="dl-ic">' + g.icon + '</div>', 'dl-pic') + '<div><h3>' + esc(bz.name) + '</h3><div class="meta"><span class="cost num">' + N(p) + '</span><span class="gain num">~' + N(Math.round(bz.daily * S.econ.infl * sd.mult / 50) * 50) + '/day here</span><span>Grows into ' + esc(g.names[2]) + '</span>' + (bz.power ? '<span>Needs light</span>' : '') + (bz.weekend ? '<span>Busy Fri–Sun</span>' : '') + (bz.december ? '<span>Booms in December (×' + bz.december + ')</span>' : '') + (bz.weekdays ? '<span>Term days only</span>' : '') + (bz.risky ? '<span class="cost">Risky: dues and losses</span>' : '') + '</div></div>' +
          '<button class="btn sm" id="buyb-' + k + '" data-buyb="' + k + '"' + (S.cash + S.bank >= p && S.businesses.length < 12 ? '' : ' disabled') + '>Build</button></div>';
      }).join('') + '</div>';
      }).join('') + '<p class="note">The jump from small to big is capital, location (the Island pays most) and scale. Detty December lifts anything that touches hospitality, events, transport and luxury.</p></details></div>';
    return html;
  }

  /* ---------- Money tab ---------- */
  function moneyView() {
    var h = L.homeDef(S);
    var html = '<div class="panel-h"><h2>Money</h2><span class="muted">Net worth <b class="num">' + N(L.netWorth(S)) + '</b></span></div><div class="panel-b">';

    html += bankView();

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
      return '<div class="item"><div><h3>' + esc(l.name) + '</h3><div class="meta"><span class="cost num">Owe ' + N(l.bal) + '</span>' + (l.rate ? '<span>' + +(l.rate * 100).toFixed(1) + '%/week</span>' : '') + '<span>' + (l.weeksLeft > 0 ? l.weeksLeft + ' weeks left' : 'Overdue') + '</span></div></div>' +
        '<button class="btn sm" id="repay-' + i + '" data-repay="' + i + '">Repay all</button></div>';
    }).join('') + '</div>' : '<p class="note">No debts.</p>') +
      '<div class="list">' + Object.keys(L.LOANS).map(function (k) {
        var lo = L.LOANS[k], max = L.loanLimit(S, k);
        return '<div class="item"><div><h3>' + esc(lo.name) + '</h3><div class="meta"><span>' + +(L.loanRate(S, k) * 100).toFixed(1) + '% a week</span><span>' + lo.weeks + ' weeks</span><span>' + (max ? 'Up to ' + N(max) : (k === 'coop' ? 'Needs a job and 10 shifts' : '')) + '</span>' +
          (k === 'app' ? '<span class="cost">Shames you to your contacts if late</span>' : '') + '</div></div>' +
          '<button class="btn sm ghost" id="loan-' + k + '" data-loan="' + k + '"' + (max ? '' : ' disabled') + '>Borrow amount</button></div>';
      }).join('') + '</div><p class="note">"Borrow amount" uses the figure in the Amount box above.</p></div>';

    html += businessesView();

    html += '<div class="section"><h3>Property and car</h3>' + (S.properties.length ? '<ul class="note">' + S.properties.map(function (p) { return '<li>' + esc(D.PROPERTIES[p.id].name) + ' · worth ' + N(p.value) + '</li>'; }).join('') + '</ul>' : '') +
      buildView() + '<div class="list">' + Object.keys(D.PROPERTIES).filter(function (k) { return !D.PROPERTIES[k].hidden && !D.PROPERTIES[k].hydepark && !D.PROPERTIES[k].hpZone; }).map(function (k) {
        var p = D.PROPERTIES[k], pr = L.price(S, p.price);
        return '<div class="item"><div><h3>' + esc(p.name) + '</h3><div class="meta"><span class="cost num">' + N(pr) + '</span>' + (p.weekly ? '<span class="gain num">' + N(p.weekly) + '/week from tenants</span>' : '<span>Appreciates ~1.2%/week</span>') + '</div></div>' +
          '<button class="btn sm" id="buyp-' + k + '" data-buyp="' + k + '"' + (S.cash + S.bank >= pr ? '' : ' disabled') + '>Buy</button></div>';
      }).join('') +
      '<div class="item"><div><h3>🏡 Lekki Hyde Park</h3><div class="meta"><span>Five zones by the lagoon, from ' + N(L.price(S, D.PROPERTIES.hp_plot_low.price)) + ' plots to a private islet</span></div></div><button class="btn sm" id="to-hp" data-place="lekki_hyde_park" data-tab="map">See the estate</button></div>' +
      '<div class="item"><div><h3>Cars, boats, helicopters and jets</h3><div class="meta"><span>' + (S.car ? esc(D.CAR.name) + ' owned · ' : '') + 'Your garage and hangar are on the Home tab</span></div></div><button class="btn sm" id="to-garage" data-tab="home">Open garage</button></div></div></div>';

    html += '<div class="section"><h3>Statement</h3><p class="note">Every naira in or out is a sealed line. Edited saves show up as tampered.</p><div class="stmt-wrap"><table class="stmt"><tbody>' +
      S.ledger.slice(0, 25).map(function (l) {
        return '<tr><td class="num muted">' + L.DATA.DAYS[Math.floor(l.t / 1440) % 7] + ' ' + pad(Math.floor(l.t % 1440 / 60)) + ':' + pad(l.t % 60) + '</td><td>' + esc(l.memo) + ' <span class="muted">· ' + l.acct + '</span></td><td class="n num ' + (l.amt > 0 ? 'gain' : 'cost') + '">' + (l.amt > 0 ? '+' : '') + N(l.amt) + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="seal">Seal ' + esc(S.ledgerHash) + ' · ' + S.ledgerCount + ' lines · ' + (L.verifyLedger(S) ? 'balances reconcile' : 'DOES NOT RECONCILE') + '</p></div>';
    return html + '</div>';
  }

  /* ---------- Me tab ---------- */
  function titlesView() {
    var nx = L.nextTitle(S), have = L.titleDef(S), worth = L.netWorth(S);
    var html = '<div class="section"><h3>🪶 Chieftaincy</h3><p class="note">' + (have ? 'You are ' + esc(L.titledName(S)) + '. ' : '') + 'Titles come in order. Each needs a minimum net worth and a cheque for the installation. A title earns nothing, but it adds status and goes in front of your name.</p><div class="list">';
    html += D.TITLES.map(function (T) {
      var held = have && D.TITLES.indexOf(T) <= D.TITLES.indexOf(have), isNext = nx && nx.id === T.id, need = L.price(S, T.worth);
      var why = isNext && worth < need ? 'Net worth ' + N(worth) + ' of ' + N(need) + ' needed' : '';
      return '<div class="item"><div><h3>' + T.icon + ' ' + esc(T.name) + (held ? ' <span class="gain">· yours</span>' : '') + '</h3><div class="meta"><span class="cost num">' + N(L.price(S, T.cost)) + '</span><span>Net worth ' + N(need) + '+</span><span>+' + T.status + ' status</span></div><div class="act-note">' + esc(T.text) + '</div>' + (why ? '<div class="why">' + esc(why) + '</div>' : '') + '</div>' +
        (isNext ? '<button class="btn" id="title-' + T.id + '" data-title="' + T.id + '"' + (why ? ' disabled' : '') + '>Take it</button>' : '') + '</div>';
    }).join('');
    return html + '</div></div>';
  }
  /* ---------- the CV: from the game's own records, never typed ---------- */
  var EDU = { degree: ['🎓', 'Degree, University of Lagos'], studying: ['📚', 'Studying at the University of Lagos'], nysc: ['🎖️', 'NYSC service year completed'], serving: ['🎖️', 'Serving NYSC'], ielts: ['🇬🇧', 'IELTS: passed'] };
  function cvSnapshot() {
    var c = L.cv(S);
    return { weeks: c.weeks, work: c.work.slice(0, 10).map(function (w) { return { id: w.id, level: w.level, shifts: w.shifts, current: !!w.current, why: w.why || null }; }),
      edu: c.edu.map(function (e) { return e.code; }), skills: c.skills.map(function (k) { return { id: k.id, level: k.level }; }), at: Date.now() };
  }
  // Another player's shared CV, checked against the game's data before it is drawn.
  function checkCv(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.work)) return null;
    var work = raw.work.slice(0, 10).filter(function (w) { return w && D.CAREERS[w.id] && Number.isInteger(w.level) && w.level >= 0 && w.level < D.CAREERS[w.id].titles.length; }).map(function (w) { var c = D.CAREERS[w.id]; return { title: c.titles[w.level], org: c.name, current: !!w.current, shifts: Math.max(0, Math.min(9999, w.shifts | 0)), why: w.why === 'dismissed' ? 'dismissed' : w.why === 'resigned' ? 'resigned' : null }; });
    var edu = (Array.isArray(raw.edu) ? raw.edu : []).filter(function (e) { return EDU[e]; }).map(function (e) { return { icon: EDU[e][0], title: EDU[e][1] }; });
    var skills = (Array.isArray(raw.skills) ? raw.skills : []).filter(function (k) { return k && D.SKILLS[k.id] && Number.isInteger(k.level) && k.level > 0 && k.level < 10; }).slice(0, 4).map(function (k) { return { name: D.SKILLS[k.id], level: k.level }; });
    return { weeks: Math.max(1, Math.min(999, raw.weeks | 0)), work: work, edu: edu, skills: skills, record: { clean: true } };
  }
  function cvHtml(c, who) {
    var mine = who === online.me || !who;
    return '<div class="cv"><div class="cv-head"><span class="cv-doc">📄</span><div><h3>' + esc(mine ? handleOf(online.me) : handleOf(who)) + '\'s CV</h3><small>Jobs, education and record, from the game\'s own records</small></div></div>' +
      '<p class="note">' + esc(mine ? S.name : nameOf(who)) + ' · week ' + c.weeks + ' of this life in Lasgidi. Built from the game\'s own records, not what anyone typed.</p>' +
      '<div class="cv-sec"><b>💼 WORK</b>' + (c.work.length ? c.work.map(function (w) { return '<div class="cv-row"><span class="cv-ic">🏢</span><div><b>' + esc(w.title) + '</b><small>' + esc(w.org) + ' · ' + w.shifts + ' shift' + (w.shifts === 1 ? '' : 's') + (w.why === 'dismissed' ? ' · let go' : '') + '</small></div>' + (w.current ? '<span class="cv-tag">Current</span>' : '') + '</div>'; }).join('') : '<p class="note">No jobs yet.</p>') + '<small class="muted">Past jobs are kept from now on.</small></div>' +
      '<div class="cv-sec"><b>🎓 EDUCATION</b>' + (c.edu.length ? c.edu.map(function (e) { return '<div class="cv-row"><span class="cv-ic">' + e.icon + '</span><div><b>' + esc(e.title) + '</b>' + (e.note ? '<small>' + esc(e.note) + '</small>' : '') + '</div></div>'; }).join('') : '<p class="note">No degree or certificates yet.</p>') + '</div>' +
      (c.skills.length ? '<div class="cv-sec"><b>🛠️ SKILLS</b><div class="cv-skills">' + c.skills.map(function (k) { return '<span class="act-chip">' + esc(k.name) + ' · level ' + k.level + '</span>'; }).join('') + '</div></div>' : '') +
      '<div class="cv-sec"><b>🚔 CRIMINAL RECORD</b><div class="cv-row"><span class="cv-ic">✅</span><div><b>Clean record</b><small>No arrests or court cases</small></div></div></div></div>';
  }
  function shareCv() {
    if (!online.db || !online.me) { online.cvStatus = 'Sharing works when the game is opened on claude.ai.'; render(); return; }
    online.db.doc('cvs/' + online.me).set(cvSnapshot()).then(function () { online.cvStatus = 'Shared. Players can open your CV from your player card.'; render(); }, function () { online.cvStatus = 'Could not share right now.'; render(); });
  }
  function meView() {
    var gp = L.goalProgress(S), g = D.GOALS[S.goal];
    var html = '<div class="panel-h"><h2>' + esc(L.titledName(S)) + '</h2><span class="muted">' + esc(D.ORIGINS[S.origin].name) + ' · ' + esc(D.HOMES[S.home].name) + '</span></div><div class="panel-b">' + labelChips(L.lagosLabels(S)) + photoView() +
      '<details class="section cv-wrap"' + (ui.cvOpen ? ' open' : '') + '><summary id="cv-open" data-cvopen="1">📄 My CV</summary>' + cvHtml(L.cv(S)) +
      '<div class="inline"><button class="btn sm" id="cv-share" data-cvshare="1">' + (online.cvs && online.cvs[online.me] ? 'Update my shared CV' : 'Share my CV with players') + '</button>' + (online.cvStatus ? '<span class="note">' + esc(online.cvStatus) + '</span>' : '') + '</div></details>';
    if (online.shop && (online.owned || []).length) html += '<div class="section">' + purchaseHistory() + '</div>';
    html += '<div class="section" style="padding-top:0"><h3>Goal: ' + esc(g.name) + (S.won ? ' · done' : '') + '</h3><p class="note">' + esc(g.text) + '</p>' +
      gp.parts.map(function (p) { return '<div><div class="inline" style="justify-content:space-between"><span>' + esc(p.label) + '</span><span class="num">' + Math.round(p.value * 100) + '%</span></div><div class="progress"><i style="width:' + Math.round(p.value * 100) + '%"></i></div></div>'; }).join('') + '</div>';
    html += '<div class="section"><h3>Net worth by week</h3>' + sparkline(S.history, 'me-spark') +
      (S.history.length ? '<details><summary>Show as table</summary><div class="stmt-wrap"><table class="stmt"><tbody>' + S.history.slice().reverse().map(function (h) { return '<tr><td>Week ' + h.w + '</td><td class="n num">' + N(h.worth) + '</td></tr>'; }).join('') + '</tbody></table></div></details>' : '') + '</div>';
    html += titlesView();
    html += lagosianView();
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
    html += settingsView();
    html += '<div class="section"><h3>Save</h3><p class="note">The game saves in this browser. Copy the save code to move to another device.</p>' +
      '<div class="inline"><button class="btn sm" id="copy-save" data-copy="1">Copy save code</button><button class="btn sm ghost" id="new-game" data-new="1">New life</button></div>' +
      '<textarea id="save-code" readonly rows="3" style="width:100%" aria-label="Save code">' + esc(L.serialize(S)) + '</textarea>' +
      (ui.flash ? '<p class="note">' + esc(ui.flash) + '</p>' : '') + '</div>' +
      '<div class="section"><h3>Keyboard</h3><p class="note">Number keys switch tabs in the order shown (1 is Do). A runs the top suggestion. Tab and Enter work everywhere, including the map.</p></div>';
    return html + '</div>';
  }

  /* ---------- my Lagos story: milestones and lifetime numbers ---------- */
  function when(t) { return 'Week ' + (Math.floor(t / 10080) + 1) + ', ' + D.DAYS[Math.floor(t / 1440) % 7]; }
  function storyView() {
    var sum = L.lifeSummary(S), days = L.day(S) + 1, gems = 0;
    Object.keys(S.gems || {}).forEach(function (k) { gems += S.gems[k].got.length; });
    var html = '<div class="section" style="padding-top:0"><div class="wallet-card"><div class="wc-l">' + esc(S.name) + ' · day ' + days + ' in ' + esc(D.CITIES[L.cityOf(S)].name) + '</div><div class="wc-big num">' + N(sum.worth) + '</div>' +
      '<div class="wc-s">Peak ' + N(sum.peak) + ' · ' + esc(sum.title || 'job hunting') + ' · ' + esc(D.HOMES[S.home].name) + ' · score ' + sum.score + '</div></div>';
    var rows = [
      ['💰', 'Earned in total', N(S.stats.earned)], ['💸', 'Spent in total', N(S.stats.spent)],
      ['🚌', 'Trips taken', S.stats.trips.toLocaleString('en')], ['⏰', 'Shifts worked', S.stats.shifts.toLocaleString('en')],
      ['💎', 'Gems found', gems], ['🎉', 'Festivals and matches', S.stats.events || 0],
      ['🛍️', 'Sold online', S.shop ? S.shop.sold : 0], ['📈', 'Shares held', N(L.stocksValue(S))],
      ['🚗', 'Vehicles', (S.vehicles || []).length + (S.car ? 1 : 0)], ['🛋️', 'Furniture', (S.items || []).length],
      ['🐾', 'Pets', (S.pets || []).length], ['🧑‍🍳', 'Staff', (S.staff || []).length],
      ['🚐', 'Danfo passengers', S.stats.danfoPax || 0], ['🏁', 'Best Danfo Run', N(S.stats.danfoBest || 0)]
    ];
    html += '<h3>Lifetime</h3><div class="story-grid">' + rows.map(function (r) { return '<div><span>' + r[0] + '</span><b class="num">' + r[2] + '</b><small>' + esc(r[1]) + '</small></div>'; }).join('') + '</div>';
    var ms = Object.keys(S.ach).map(function (k) { return { t: S.ach[k], text: L.ACHIEVEMENTS[k] }; });
    if (S.partner && S.partner.stage === 'married' && !S.ach.wedding) ms.push({ t: S.t, text: 'Married' });
    ms.sort(function (a, b) { return a.t - b.t; });
    html += '<h3>Milestones</h3>' + (ms.length ? '<ol class="timeline">' + ms.map(function (m) { return '<li><time>' + when(m.t) + '</time>' + esc(m.text) + '</li>'; }).join('') + '</ol>' : '<p class="note">Your first milestone is waiting: a job, a move, a gem.</p>');
    html += familyTree();
    html += '<h3>Share it</h3>' + shareBlock();
    return html + '</div>';
  }
  // The family line, oldest first, then you, your partner and your children.
  function familyTree() {
    var line = S.heir ? (S.heir.line || [S.heir.parent]) : [], gen = S.heir ? S.heir.gen || 2 : 1, kids = L.kidsInfo(S);
    if (!line.length && !kids.length && !S.partner) return '';
    var people = line.map(function (n) { return '<li class="ft-anc">' + esc(n) + '</li>'; }).join('') +
      '<li class="ft-me"><b>' + esc(S.name) + '</b>' + (S.partner && S.partner.stage === 'married' ? ' ♥ ' + esc(S.partner.name) : '') + '</li>' +
      (kids.length ? '<li class="ft-kids">' + kids.map(function (k) { return '<span>🧒 ' + esc(k.name) + (k.last ? ' <span class="kid-grade g' + k.last + '">' + k.last + '</span>' : '') + '</span>'; }).join('') + '</li>' : '');
    return '<h3>🌳 Family tree</h3><p class="note">Generation ' + gen + ' of your family in Lagos.' + (kids.length ? ' End this life and one of your children can carry the family on.' : '') + '</p><ol class="ftree">' + people + '</ol>';
  }

  /* ---------- creator: followers, phones, brand deals ---------- */
  function creatorView() {
    var c = S.creator || { followers: 0, posts: 0, lastPost: -1 }, deal = L.brandDeal(S), active = c.lastPost >= L.day(S) - 7;
    var html = '<div class="section" style="padding-top:0"><div class="wallet-card"><div class="wc-l">📸 ' + esc(S.name) + ' · ' + c.posts + ' posts</div><div class="wc-big num">' + c.followers.toLocaleString('en') + ' <span style="font-size:.45em">followers</span></div>' +
      '<div class="wc-s">' + (S.rules >= 9 ? (deal ? 'Brand deals: about ' + N(deal) + ' a week while you keep posting' : 'Brand deals start at 2,000 followers') : 'Weekly brand deals come with your next life') + ' · next post +' + L.followerGain(S, false).toLocaleString('en') + '</div></div>' +
      '<p class="note">' + (active || !c.followers ? 'Post at least once a week. A quiet week loses 3% of your followers.' : '⚠️ No post this week: you are losing followers.') + ' Shoot at Lekki beach, or film a skit at home. Charisma, a sharp phone and a club or owambe outfit all help. Viral posts bring thousands at once.</p>';
    var ci = L.creatorInfo(S);
    html += '<h3>🎬 Skits</h3><p class="note">Pick a theme. 🔥 ' + esc(D.SKIT_THEMES[ci.trend].name) + ' is trending this week (double followers), and filming in the right place helps (×1.4).</p><div class="skit-grid">' + ci.themes.map(function (t) {
      var T = D.SKIT_THEMES[t.id];
      return '<button type="button" class="skit-btn' + (t.id === ci.trend ? ' hot' : '') + '" id="skit-' + t.id + '" data-skit="' + t.id + '"' + (t.why ? ' disabled title="' + esc(t.why) + '"' : '') + '><span>' + T.icon + '</span><b>' + esc(T.name) + '</b><small>' + (t.id === ci.trend ? '🔥 trending · ' : '') + '×' + (Math.round(t.mult * 10) / 10) + '</small></button>';
    }).join('') + '</div>';
    html += '<h3>🔴 Go live</h3><p class="note">Viewers send gifts. Prime time is 20:00 to 01:00, and December crowds are bigger. At home, NEPA can drop your stream unless you have an inverter or solar. Data costs ' + N(L.price(S, 1500)) + ' a stream.' + (ci.peak ? ' Your best: ' + ci.peak.toLocaleString('en') + ' watching.' : '') + '</p>' +
      '<div class="inline"><button class="btn' + (ci.live ? '' : ' go') + '" id="go-live" data-golive="1"' + (ci.live ? ' disabled' : '') + '>🔴 Go live · about ' + ci.viewers.toLocaleString('en') + ' viewers</button></div>' + (ci.live ? '<p class="why">' + esc(ci.live) + '.</p>' : '') +
      '<p class="note">From 20,000 followers, promoters pay for appearances at VI club nights (Thursday and Friday).</p>';
    html += '<h3>Phones</h3><div class="list">' + Object.keys(D.PHONES).map(function (k) {
      var P = D.PHONES[k], have = S.phone === k, trade = S.phone ? Math.floor(L.price(S, D.PHONES[S.phone].price) * 0.3) : 0, cost = L.price(S, P.price) - trade;
      return '<div class="item"><div><h3>' + P.icon + ' ' + esc(P.name) + (have ? ' <span class="gain">· yours</span>' : '') + '</h3><div class="meta"><span>Camera ×' + P.cam + '</span>' + (P.status ? '<span>+' + P.status + ' status</span>' : '') + (have || (S.phone && D.PHONES[S.phone].price >= P.price) ? '' : '<span class="cost num">' + N(cost) + (trade ? ' after trade-in' : '') + '</span>') + '</div></div>' +
        (have || (S.phone && D.PHONES[S.phone].price >= P.price) ? '' : '<button class="btn" id="phone-' + k + '" data-buyphone="' + k + '"' + (cost > S.cash + S.bank ? ' disabled' : '') + '>Buy</button>') + '</div>';
    }).join('') + '</div>';
    if (!S.phone) html += '<p class="note">You are shooting on an old phone (camera ×0.6).</p>';
    return html + '</div>';
  }

  /* ---------- online shop ---------- */
  function shopView() {
    var sh = S.shop;
    if (!sh) {
      return '<div class="section" style="padding-top:0"><h3>🛍️ Start an online shop</h3><p class="note">Post on chat apps and social media, buy stock wholesale, and dispatch riders deliver. You pay ' + N(L.price(S, 10000)) + ' to set up. Sales land every week. The app takes 5%, riders cost ' + N(L.price(S, 500)) + ' an order, and some customers send things back.</p><div class="list">' +
        Object.keys(D.SHOP_NICHES).map(function (k) {
          var Nn = D.SHOP_NICHES[k];
          return '<div class="item"><div><h3>' + Nn.icon + ' ' + esc(Nn.name) + '</h3><div class="meta"><span>Buy ' + N(L.price(S, Nn.cost)) + '</span><span>Sell ' + N(L.price(S, Nn.price)) + '</span><span>~' + Nn.demand + ' orders/wk without ads</span></div><div class="act-note">' + esc(Nn.text) + '</div></div><button class="btn" id="shop-open-' + k + '" data-shopopen="' + k + '">Open</button></div>';
        }).join('') + '</div></div>';
    }
    var Nn = D.SHOP_NICHES[sh.niche], pv = L.shopPreview(S), last = sh.last;
    var html = '<div class="section" style="padding-top:0"><div class="wallet-card"><div class="wc-l">' + Nn.icon + ' ' + esc(Nn.name) + '</div><div class="wc-big num">' + sh.stock + ' <span style="font-size:.5em">in stock</span></div>' +
      '<div class="wc-s">' + sh.sold.toLocaleString('en') + ' sold so far · next week about ' + pv.orders + ' orders' + (pv.orders < pv.demand ? ' (demand ' + pv.demand + ': restock!)' : '') + ', taking ~' + N(Math.max(0, pv.net)) + ' after ads, fees and riders: ' + (pv.profit >= 0 ? '~' + N(pv.profit) + ' profit' : '~' + N(-pv.profit) + ' loss') + ' once the stock is paid for</div></div>';
    if (last) html += '<p class="note">Week ' + (last.w) + ': ' + last.orders + ' sold' + (last.returned ? ', ' + last.returned + ' returned' : '') + (last.spoiled ? ', ' + last.spoiled + ' spoiled' : '') + '. Takings ' + N(Math.max(0, last.net)) + ' after fees and dispatch (before the cost of the stock).</p>';
    html += '<div class="label">Restock · ' + N(pv.cost) + ' per ' + esc(Nn.unit) + (Nn.spoils ? ' · unsold trays spoil each week' : '') + '</div><div class="pg-chips" style="padding:0">' + [10, 20, 50, 100].map(function (u) {
      var c = u * pv.cost, off = sh.stock + u > 500 || c > S.cash + S.bank;
      return '<button type="button" class="pg-chip" id="shop-rs-' + u + '" data-shoprestock="' + u + '"' + (off ? ' disabled' : '') + '>+' + u + ' · ' + N(c) + '</button>';
    }).join('') + '</div>';
    html += '<div class="label" style="margin-top:10px">Ads, paid weekly</div><div class="pg-chips" style="padding:0">' + Object.keys(D.SHOP_ADS).map(function (k) {
      var A = D.SHOP_ADS[k];
      return '<button type="button" class="pg-chip' + (sh.ads === k ? ' sel' : '') + '" id="shop-ad-' + k + '" data-shopads="' + k + '">' + esc(A.name) + (A.cost ? ' · ' + N(L.price(S, A.cost)) + ' · ×' + A.mult : '') + '</button>';
    }).join('') + '</div>';
    html += '<div class="inline" style="margin-top:12px"><button class="btn sm ghost" id="shop-close" data-shopclose="1">Close shop' + (sh.stock ? ' · clear stock for ' + N(Math.floor(sh.stock * pv.cost * 0.4)) : '') + '</button></div>';
    return html + '</div>';
  }

  /* ---------- the stock exchange ---------- */
  function miniChart(vals, w, h, cls) {
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals); if (hi === lo) hi = lo + 1;
    var pts = vals.map(function (v, i) { return (i / Math.max(1, vals.length - 1) * (w - 2) + 1).toFixed(1) + ',' + (1 + (1 - (v - lo) / (hi - lo)) * (h - 2)).toFixed(1); }).join(' ');
    var up = vals[vals.length - 1] >= vals[0];
    return '<svg class="' + cls + ' ' + (up ? 'up' : 'down') + '" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '"' + (cls === 'chart' ? ' preserveAspectRatio="none"' : '') + ' aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  }
  function pxLabel(v) { return '₦' + (v < 10 ? v.toFixed(2) : v.toLocaleString('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 })); }
  function stocksView() {
    var held = S.stocks || {}, value = L.stocksValue(S), cost = 0, shut = L.marketOpen(S), d = L.day(S);
    Object.keys(held).forEach(function (id) { cost += held[id].cost; });
    var pl = value - cost;
    var html = '<div class="section" style="padding-top:0"><div class="wallet-card"><div class="wc-l">Your portfolio</div><div class="wc-big num">' + N(value) + '</div>' +
      '<div class="wc-s">' + (cost ? (pl >= 0 ? '▲ ' : '▼ ') + N(Math.abs(pl)) + ' ' + (pl >= 0 ? 'up' : 'down') + ' on what you paid, after fees · ' : '') + 'Savings ' + N(S.bank) + '</div></div>' +
      '<p class="note">' + (shut ? '🔒 ' + esc(shut) : '🟢 The exchange is open until 14:30.') + ' Broker fee ' + (L.brokerFee(1e9) / 1e9 * 100).toFixed(1) + '% each way (min ' + N(L.brokerFee(0)) + '). Shares are paid from savings. Some pay dividends every 13 weeks. Prices can fall. Retail accounts are capped at ' + N(L.price(S, 20000000)) + ' invested.</p><div class="list stocks">';
    html += Object.keys(D.STOCKS).map(function (id) {
      var St = D.STOCKS[id], hist = L.stockHistory(S, id, 30), px = hist[hist.length - 1], prev = d > 0 ? L.stockPrice(S, id, d - 1) : px, ch = (px / prev - 1) * 100, h = held[id], sel = ui.stock === id;
      var row = '<button type="button" class="stk' + (sel ? ' sel' : '') + '" id="stk-' + id + '" data-stock="' + id + '"><span class="stk-ic">' + St.icon + '</span><span class="stk-n"><b>' + esc(St.ticker) + '</b><small>' + esc(St.name) + (h ? ' · ' + h.u.toLocaleString('en') + ' held' : '') + '</small></span>' + miniChart(hist, 64, 24, 'spark') +
        '<span class="stk-p num"><b>' + pxLabel(px) + '</b><small class="' + (ch >= 0 ? 'gain' : 'cost') + '">' + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%</small></span></button>';
      if (!sel) return row;
      var hist90 = L.stockHistory(S, id, 90), hv = h ? Math.floor(h.u * px) : 0;
      row += '<div class="stk-detail">' + miniChart(hist90, 320, 90, 'chart') + '<div class="meta"><span>' + esc(St.sector) + '</span><span>' + (St.div ? 'Dividend ' + (St.div * 100).toFixed(0) + '% a year' : 'No dividend') + '</span><span>90 days: ' + pxLabel(Math.min.apply(null, hist90)) + ' – ' + pxLabel(Math.max.apply(null, hist90)) + '</span></div>' +
        (h ? '<p class="note">You hold ' + h.u.toLocaleString('en') + ' shares worth ' + N(hv) + ' (paid ' + N(h.cost) + ').</p>' : '') +
        '<div class="label">Buy</div><div class="pg-chips" style="padding:0">' + [10000, 50000, 250000, 1000000].map(function (v) {
          return '<button type="button" class="pg-chip" id="sb-' + id + '-' + v + '" data-stockbuy="' + id + ':' + v + '"' + (shut || v + L.brokerFee(v) > S.bank ? ' disabled' : '') + '>' + N(v) + '</button>';
        }).join('') + '</div>' +
        (h ? '<div class="inline">' + (h.u > 1 ? '<button class="btn sm ghost" id="ss-half-' + id + '" data-stocksell="' + id + ':' + Math.floor(h.u / 2) + '"' + (shut ? ' disabled' : '') + '>Sell half</button>' : '') + '<button class="btn sm ghost" id="ss-all-' + id + '" data-stocksell="' + id + ':' + h.u + '"' + (shut ? ' disabled' : '') + '>Sell all · ' + N(Math.max(0, hv - L.brokerFee(hv))) + '</button></div>' : '') + '</div>';
      return row;
    }).join('');
    return html + '</div></div>';
  }

  /* ---------- the phone: apps over the existing screens ---------- */
  var READ_KEY = 'lasgidi.read.v1';
  function lastRead() { try { var v = JSON.parse(localStorage.getItem(READ_KEY) || '{}'); return v.seed === S.seed ? v.t : -1; } catch (e) { return -1; } }
  function markRead() { try { localStorage.setItem(READ_KEY, JSON.stringify({ seed: S.seed, t: S.t })); } catch (e) {} }
  function unreadCount() { var t = lastRead(); return S.log.filter(function (l) { return l.t > t; }).length; }
  var APPS = [
    ['guide', '❓', 'Guide'], ['messages', '💬', 'Messages'], ['quests', '🎯', 'Quests'], ['home', '🏠', 'Home'], ['people', '👥', 'People'], ['jobs', '💼', 'Careers'], ['money', '💰', 'Money'], ['assets', '📊', 'Assets'], ['houses', '🏡', 'Houses'], ['bank', '🏦', 'Bank'], ['stocks', '📈', 'Stocks'], ['shop', '🛍️', 'Shop'], ['creator', '📸', 'Creator'], ['games', '🎮', 'Games'], ['dealers', '🚗', 'Dealers'],
    ['gems', '💎', 'Gem hunt'], ['events', '🎟️', 'What\'s on'], ['weather', '🌦️', 'Weather'], ['travel', '✈️', 'Travel'], ['town', '🗳️', 'Town Hall'], ['govt', '🏛️', 'Government'], ['nysc', '🎖️', 'NYSC'], ['sports', '🏅', 'Sports'], ['sights', '🗺️', 'Sightseeing'], ['story', '📖', 'My story'], ['fame', '🏆', 'Hall of Fame'], ['wardrobe', '👗', 'Wardrobe'], ['style', '🎨', 'Style shop']
  ];
  // Every festival, match and concert in every city, with when it is on.
  var GUIDE = [
    ['🧭', 'Survive the week', 'Eat, sleep and bathe, and keep stress down. Rent is due every Friday at noon. The advisor on the Do tab suggests your next move.', 'tab', 'do'],
    ['💼', 'Earn', 'Get a job (Phone → Jobs), work shifts, and take side gigs where you are. Ride-hail if you own a car. Money is hard on purpose: taxes, levies and January sapa.', 'app', 'jobs'],
    ['🎮', 'Mini-games', 'Danfo Run at Ojuelegba, hawking in the Oshodi go-slow, and the Saturday owambe dance-off. All pay capped amounts into your life.', 'app', 'games'],
    ['🏦', 'Save and invest', 'Savings, treasury bills, the stock exchange, an online shop, businesses and property. Watch the fees.', 'app', 'bank'],
    ['🗺️', 'Explore', 'Three cities. Zoom the map (pinch, wheel or ⛶ full screen), tap places, and hunt the daily gems. Away from home, book a guest house, hotel or short-let for the night. The rainy season slows the roads.', 'tab', 'map'],
    ['🌊', 'Sea Plots', 'Buy a block of plots in the Atlantic and put your picture on it for every player to see, after an editor checks it.', 'sea', ''],
    ['🏠', 'Home life', 'Furnish your home, hire staff, adopt pets, take a health plan, and host parties (with a decorator) that online friends can join.', 'tab', 'home'],
    ['📸', 'Fame', 'Grow followers for brand deals, post your life to the Hall of Fame, and take chieftaincy titles.', 'app', 'creator'],
    ['🗺️', 'Sightseeing', 'Lekki Conservation Centre, the Lekki art gallery, Tarkwa Bay, Freedom Park, the National Museum, Kalakuta, Badagry and more, grouped by area. Visit 8 to become a Lagos explorer.', 'app', 'sights'],
    ['🏅', 'Sports', 'Football from the street to the NPFL, basketball, boxing, tennis, golf, polo, e-sports, ayo olopon and more. Play 8 sports to become an All-rounder, and win tournament prizes.', 'app', 'sports'],
    ['🎖️', 'NYSC', 'After your UNILAG degree, register for the service year: three camp days in Kubwa, Abuja, then 12 weeks at your posting with CDS every Thursday and a monthly allawee.', 'app', 'nysc'],
    ['✈️', 'The end', 'Pass IELTS, save ₦15m proof of funds and japa from Ikeja airport to complete a life. Or play forever.', 'app', 'travel']
  ];
  function guideView() {
    return '<div class="section" style="padding-top:0"><h3>❓ How to play Lasgidi</h3><div class="list">' + GUIDE.map(function (g, i) {
      var btn = g[3] === 'tab' ? '<button class="btn sm ghost" id="guide-' + i + '" data-tab="' + g[4] + '">Open</button>' : g[3] === 'app' ? '<button class="btn sm ghost" id="guide-' + i + '" data-app="' + g[4] + '">Open</button>' : '<button class="btn sm ghost" id="guide-' + i + '" data-seaopen="1" data-tab="map">Open</button>';
      return '<div class="item"><div><h3>' + g[0] + ' ' + esc(g[1]) + '</h3><div class="act-note">' + esc(g[2]) + '</div></div>' + btn + '</div>';
    }).join('') + '</div>' + safetyCard() + '<p class="note">Number keys switch tabs; A does the top suggestion. Your game saves in this browser. Copy the save code on the Me tab to move devices.</p>' + slangView() + '</div>';
  }
  // Your profile photo: uploaded for review, shown to others only once an editor approves it.
  function photoView() {
    if (!online.db || !online.me) return '<div class="section"><h3>📷 Your photo</h3><p class="note">Add a photo so other players can recognise you. Photos are shared through the game\'s board, so they work when Lasgidi is opened on claude.ai.</p></div>';
    var mine = online.photos[online.me], off = !!online.photoOff[online.me], rv = online.myPhotoReview;
    var status = rv && !rv.status ? '⏳ Your new photo is waiting for an editor.' : rv && rv.status === 'rejected' ? '❌ Your last photo was not approved. Try another.' : mine ? (off ? '🙈 Your photo is hidden from other players.' : '✅ Other players see this photo.') : 'No photo yet: other players see your avatar.';
    var html = '<div class="section photo-sec"><h3>📷 Your photo</h3><div class="photo-row">' + (mine ? '<img class="pphoto lg" alt="Your photo" src="' + mine + '">' : '<div class="pphoto lg ph-empty" aria-hidden="true">🙂</div>') +
      '<div><p class="note">' + status + ' Use a clear photo of your own face: no other people, no contact details. An editor checks every photo before anyone else sees it.</p>' +
      '<div class="inline"><label class="btn sm" for="photo-file">📷 ' + (mine ? 'Change photo' : 'Add a photo') + '</label><input type="file" id="photo-file" accept="image/jpeg,image/png,image/webp" hidden>' +
      (mine ? '<button class="btn sm ghost" id="photo-off" data-photooff="' + (off ? '0' : '1') + '">' + (off ? 'Show my photo' : 'Hide my photo') + '</button>' : '') + '</div>' +
      (online.photoStatus ? '<p class="note">' + esc(online.photoStatus) + '</p>' : '') + '</div></div></div>';
    if (online.canEdit) {
      var q = online.photoreview || [];
      html += '<div class="section"><h3>Review player photos <span class="muted">· ' + q.length + ' waiting</span></h3>' + (q.length ? '<div class="list">' + q.slice(0, 10).map(function (r) {
        return '<div class="item review"><img class="pphoto lg" alt="" src="' + r.raw.img + '"><div><h3>' + esc(nameOf(r.id)) + '</h3><div class="meta"><span>Submitted ' + new Date(r.raw.at || 0).toLocaleString() + '</span></div></div>' +
          '<div class="inline"><button class="btn sm go" id="phok-' + esc(r.id) + '" data-phok="' + esc(r.id) + '">Approve</button><button class="btn sm ghost" id="phno-' + esc(r.id) + '" data-phno="' + esc(r.id) + '">Reject</button></div></div>';
      }).join('') + '</div>' : '<p class="note">Nothing to review.</p>') + '</div>';
    }
    return html;
  }
  // Lagos slang labels as chips, each explained on hover/tap (title) and in the Guide.
  function labelChips(ids) {
    if (!ids || !ids.length) return '';
    return '<div class="slang-chips" aria-label="What Lagos calls you">' + ids.map(function (k) { var L2 = D.SLANG[k]; return '<span class="slang" title="' + esc(L2[1]) + '">' + esc(L2[0]) + '</span>'; }).join('') + '</div>';
  }
  function slangView() {
    return '<h3>🗣️ Lagos labels</h3><p class="note">What people call each other. Your own labels show on the Me tab and change as you play.</p><dl class="slang-dl">' +
      Object.keys(D.SLANG).map(function (k) { return '<dt>' + esc(D.SLANG[k][0]) + '</dt><dd>' + esc(D.SLANG[k][1]) + '</dd>'; }).join('') + '</dl>';
  }

  /* ---------- Sightseeing: plan by area, because the traffic is real ---------- */
  var SIGHT_AREAS = [['Lekki and the coast', ['lekki', 'ajah']], ['The Island: Lagos Island, Ikoyi and VI', ['island', 'ikoyi', 'vi']], ['The Mainland and beyond', ['ikeja', 'yaba', 'surulere', 'mushin', 'oshodi', 'festac', 'ikorodu']]];
  function sightsView() {
    var seen = (S.stats && S.stats.sights) || {}, n = Object.keys(seen).length;
    var html = '<div class="section"><h3>🗺️ Sightseeing in Lagos</h3><p class="note">Traffic is heavy, so plan by area: do Lekki one day and the Island the next.' + (S.rules >= 14 ? ' You have visited ' + n + (n < 8 ? ' sights (8 makes you a Lagos explorer).' : ' sights: Lagos explorer!') : '') + '</p>';
    SIGHT_AREAS.forEach(function (area) {
      var rows = [];
      area[1].forEach(function (d) { (D.PLACE_ACTIONS[d] || []).forEach(function (a) { if (a.sight) rows.push({ a: a, d: d, pl: D.PLACES.filter(function (p) { return p.acts.indexOf(a.id) >= 0; })[0] }); }); });
      if (!rows.length) return;
      html += '<h4 class="dl-group">' + esc(area[0]) + '</h4><div class="list">' + rows.map(function (r) {
        var a = r.a, here = S.loc === r.d, open = L.inWindow(S, a.when), sameCity = L.cityOf(S) === 'lagos';
        var btn = here ? (r.pl ? '<button class="btn sm" id="sg-' + a.id + '" data-place="' + r.pl.id + '">Open</button>' : '') : sameCity ? '<button class="btn sm ghost" id="sg-go-' + a.id + '" data-tripto="' + r.d + '" data-tab="map">Go there</button>' : '<button class="btn sm ghost" id="sg-fly-' + a.id + '" data-app="travel">✈️ Lagos</button>';
        return '<div class="item"><div><h3>' + esc(r.pl ? r.pl.icon + ' ' + r.pl.name : a.label) + (seen[a.id] ? ' <span class="gain">✓</span>' : '') + '</h3><div class="meta"><span>' + esc(D.DISTRICTS[r.d].name) + '</span><span>' + esc(whenText(a.when)) + '</span>' + (a.cost ? '<span class="cost num">' + N(L.price(S, a.cost)) + '</span>' : '<span>Free</span>') + (here && open ? '<span class="gain">Open now</span>' : '') + '</div><div class="act-note">' + esc(a.label) + '</div></div>' + btn + '</div>';
      }).join('') + '</div>';
    });
    return html + '</div>';
  }

  /* ---------- Sports: where to play in Lagos ---------- */
  function sportsView() {
    var played = (S.stats && S.stats.sports) || {}, byGroup = {};
    Object.keys(D.PLACE_ACTIONS).forEach(function (d) { D.PLACE_ACTIONS[d].forEach(function (a) { if (!a.sport) return; var g = D.SPORTS[a.sport][2]; (byGroup[g] = byGroup[g] || []).push({ a: a, d: d }); }); });
    var html = '<div class="section"><h3>🏅 Sports in Lagos</h3><p class="note">Football runs from the street to the NPFL, and there is a game for everyone across the city. You have played ' + Object.keys(played).length + ' of ' + Object.keys(D.SPORTS).length + ' sports' + (Object.keys(played).length < 8 ? ' (8 makes you an All-rounder)' : ': All-rounder!') + '. Tournaments pay a prize if you are good enough.' + (S.stats && S.stats.wins ? ' Wins: ' + S.stats.wins + '.' : '') + '</p>';
    ['Most popular', 'Widely played', 'Traditional and local', 'Emerging'].forEach(function (g) {
      if (!byGroup[g]) return;
      html += '<h4 class="dl-group">' + esc(g) + '</h4><div class="list">' + byGroup[g].map(function (r) {
        var a = r.a, SP = D.SPORTS[a.sport], now = L.inWindow(S, a.when), here = S.loc === r.d, sameCity = L.districtCity(r.d) === L.cityOf(S);
        var go = here ? (now ? '<span class="gain">Open now</span>' : '') : sameCity ? '<button class="btn sm ghost" id="sp-go-' + a.id + '" data-tripto="' + r.d + '" data-tab="map">Go there</button>' : '';
        return '<div class="item"><div><h3>' + SP[1] + ' ' + esc(a.label) + (played[a.sport] ? ' <span class="gain">✓</span>' : '') + '</h3><div class="meta"><span>' + esc(D.DISTRICTS[r.d].name) + '</span><span>' + esc(whenText(a.when)) + '</span>' + (a.cost ? '<span class="cost num">' + N(L.price(S, a.cost)) + '</span>' : '<span>Free</span>') + (a.compete ? '<span class="gain">Prize ' + N(L.price(S, a.compete.prize)) + '</span>' : '') + '</div></div>' + go + '</div>';
      }).join('') + '</div>';
    });
    return html + '</div>';
  }

  /* ---------- NYSC: the service year ---------- */
  // A button that takes you to a district: a trip in this city, or the Travel app for another city.
  function goBtn(id, d) {
    if (S.loc === d) return '';
    return L.districtCity(d) !== L.cityOf(S) ? '<button class="btn sm ghost" id="' + id + '" data-app="travel">✈️ Travel to ' + esc(D.CITIES[L.districtCity(d)].name) + '</button>'
      : '<button class="btn sm ghost" id="' + id + '" data-tripto="' + d + '" data-tab="map">Go to ' + esc(D.DISTRICTS[d].name) + '</button>';
  }
  function nyscView() {
    var n = L.nyscInfo(S), html = '<div class="section"><h3>🎖️ National Youth Service Corps</h3>';
    if (n.stage === 'locked') return html + '<p class="note">NYSC is for graduates. Enrol at UNILAG (Yaba), attend 30 lectures and graduate, then come back here to register for your service year.</p><div class="inline"><button class="btn sm ghost" id="nysc-yaba" data-tripto="yaba" data-tab="map">Go to Yaba</button></div></div>';
    if (n.stage === 'eligible') return html + '<p class="note">You have a degree, so the service year is next. Registration gets you a call-up letter and a posting to a PPA (place of primary assignment). You do three camp days at Kubwa, Abuja, then 12 weeks of service. The allawee is ' + N(n.allowance) + ' every 4 weeks, as long as you attend 3 of the 4 Thursday CDS meetings.</p>' +
      '<div class="inline"><button class="btn go" id="nysc-register" data-nysc="register"' + (S.cash + S.bank < n.fee ? ' disabled' : '') + '>Register · ' + N(n.fee) + '</button></div></div>';
    var p = n.ppa, ppaCard = '<div class="item"><div><h3>' + p.icon + ' ' + esc(p.name) + '</h3><div class="meta"><span>' + esc(D.DISTRICTS[p.district].name) + ', ' + esc(D.CITIES[L.districtCity(p.district)].name) + '</span><span class="' + (p.pay ? 'gain' : 'muted') + '">' + (p.pay ? N(L.price(S, p.pay)) + ' a day' : 'No stipend') + '</span></div><div class="act-note">' + esc(p.text) + '</div></div></div>';
    if (n.stage === 'callup' || n.stage === 'camp') {
      var dots = ''; for (var i = 0; i < D.NYSC.campDays; i++) dots += '<span class="nysc-dot' + (i < n.campDays ? ' on' : '') + '" aria-hidden="true"></span>';
      return html + '<p class="note">Your call-up letter says: report to the <b>orientation camp in Kubwa, Abuja</b>. The gate is open 05:00 to 20:00. Each camp day ends with a night in the camp hostel.</p>' +
        '<div class="nysc-camp" aria-label="Camp day ' + n.campDays + ' of ' + D.NYSC.campDays + '">' + dots + '<span>Camp day ' + n.campDays + ' of ' + D.NYSC.campDays + '</span></div>' +
        '<div class="inline"><button class="btn go" id="nysc-camp" data-nysc="camp"' + (n.camp ? ' disabled' : '') + '>🎖️ Do a camp day</button>' + goBtn('nysc-go-camp', 'abj_kubwa') + '</div>' + (n.camp ? '<p class="why">' + esc(n.camp) + '.</p>' : '') +
        '<div class="label">Your posting after camp</div><div class="list">' + ppaCard + '</div></div>';
    }
    if (n.stage === 'service') {
      var marks = n.cds.map(function (c, i) { return '<span class="nysc-cds' + (c === true ? ' on' : c === false ? ' miss' : '') + '" title="Week ' + (i + 1) + '">' + (c === true ? '✓' : c === false ? '✗' : '·') + '</span>'; }).join('');
      return html + '<p class="note">Corper wee! You have ' + n.weeksLeft + ' week' + (n.weeksLeft === 1 ? '' : 's') + ' of service left. The next allawee (' + N(n.allowance) + ') comes in ' + n.nextPayIn + ' week' + (n.nextPayIn === 1 ? '' : 's') + ' if your CDS register is signed at least 3 times this month.</p>' +
        '<div class="label">CDS this month (Thursdays, 10:00–14:00)</div><div class="nysc-cdsrow">' + marks + '</div>' +
        '<div class="inline"><button class="btn go" id="nysc-cds" data-nysc="cds"' + (n.cdsWhy ? ' disabled' : '') + '>🤝 Attend CDS</button></div>' + (n.cdsWhy ? '<p class="why">' + esc(n.cdsWhy) + '.</p>' : '') +
        '<div class="label">Your PPA (weekdays, report 08:00–09:59)</div><div class="list">' + ppaCard + '</div>' +
        '<div class="inline"><button class="btn go" id="nysc-work" data-nysc="work"' + (n.work ? ' disabled' : '') + '>' + p.icon + ' Work at your PPA</button>' + goBtn('nysc-go-ppa', p.district) + '</div>' + (n.work ? '<p class="why">' + esc(n.work) + '.</p>' : '') +
        '<p class="note">Allawee paid ' + n.paid + ' time' + (n.paid === 1 ? '' : 's') + (n.withheld ? ', withheld ' + n.withheld : '') + '.</p></div>';
    }
    var off = n.offer && !n.retainWhy ? '<div class="item"><div><h3>💼 Job offer: ' + esc(n.offer.title) + ' · ' + esc(n.offer.name) + '</h3><div class="meta"><span class="gain">' + N(n.offer.pay) + ' a shift to start</span><span>' + Math.max(0, n.offer.until - L.day(S)) + ' days to accept</span></div></div>' +
      '<button class="btn go" id="nysc-retain" data-nysc="retain">Accept</button></div>' : '<p class="note">' + esc(n.retainWhy) + '.</p>';
    return html + '<div class="nysc-done"><p class="nysc-big">🎖️</p><h3>Certificate of National Service</h3><p class="note">You served at ' + esc(p.name) + ' for ' + n.days + ' PPA day' + (n.days === 1 ? '' : 's') + '. Allawee paid ' + n.paid + ' time' + (n.paid === 1 ? '' : 's') + (n.withheld ? ', withheld ' + n.withheld : '') + '. Corper wee! 🫡</p></div><div class="list">' + off + '</div></div>';
  }

  /* ---------- Town Hall: a weekly vote shared by every player ---------- */
  function townWeek() { return L.challengeId(new Date()); }
  function townQuestion() { var id = townWeek(), n = parseInt(id.slice(-2), 10) + parseInt(id.slice(0, 4), 10) * 53; return D.TOWNHALL[n % D.TOWNHALL.length]; }
  function townTally() {
    var wk = townWeek(), q = townQuestion(), counts = q.a.map(function () { return 0; }), mine = null;
    (online.votes || []).forEach(function (v) {
      var r = v.raw;
      if (!r || r.week !== wk || typeof r.choice !== 'number' || r.choice < 0 || r.choice >= q.a.length || Math.round(r.choice) !== r.choice) return;
      counts[r.choice]++;
      if (v.id === online.me) mine = r.choice;
    });
    return { q: q, counts: counts, total: counts.reduce(function (a, b) { return a + b; }, 0), mine: mine, wk: wk };
  }
  /* ---------- State government: parties, primaries, tickets, campaign, election, Executive Council ---------- */
  var G = window.LasgidiGov;
  function lastWeek() { return L.challengeId(new Date(Date.now() - 7 * 86400000)); }
  function govPhase() { return G.phase(new Date()); }
  var LAGOS_UNITS = (function () { var m = {}; Object.keys(D.DISTRICTS).forEach(function (k) { if (L.districtCity(k) === 'lagos') m[k] = true; }); return m; })();
  function myUnit() { var h = D.HOMES[S.home], d = h && h.district; return d && LAGOS_UNITS[d] ? d : LAGOS_UNITS[S.loc] ? S.loc : 'other'; }
  function unitName(u) { return D.DISTRICTS[u] ? D.DISTRICTS[u].name : 'Outside Lagos'; }
  function govState(wk) {
    var n = G.nominees(online.govrun, online.govparty, online.govprimary, wk);
    return { n: n, e: G.election(n.tickets, online.govvote, wk, LAGOS_UNITS) };
  }
  // The governing ticket this week: last week's election winner.
  function government() {
    var lw = lastWeek(), st = govState(lw), w = st.e.winner;
    if (!w) return null;
    return { gov: w.ticket.id, deputy: w.ticket.deputy, ticket: w.ticket, result: st.e, assembly: st.e.voters, cabinet: G.council(w.ticket.id, online.govcab, online.govconfirm, st.e.voters, townWeek()) };
  }
  function governor() { var g = government(); return g ? { id: g.gov, motto: g.ticket.motto } : null; }
  function partyChip(p) { var P = G.PARTIES[p]; return P ? '<span class="party-chip" style="--pc:' + P.color + '">' + P.icon + ' ' + esc(P.short) + '</span>' : ''; }
  var PHASE_LABEL = { primaries: '🗳️ Party primaries (Mon–Tue)', campaign: '📣 Campaign season (Wed–Fri)', election: '🗳️ Election weekend (Sat–Sun)' };
  function govChips() {
    if (L.cityOf(S) !== 'lagos') return '';
    var g = government(), homes = Object.keys(online.homes || {}).length;
    return '<div class="gov-row">' + (online.room ? '<span class="gov-chip live"><i class="pg-live"></i> ' + (online.others + 1) + ' online</span>' : '') +
      '<button type="button" class="gov-chip" id="gov-chip" data-app="govt">🏛️ ' + (g ? 'Gov ' + esc(nameOf(g.gov)) : 'Seat open') + '</button>' +
      '<button type="button" class="gov-chip" id="gov-phase" data-app="govt">' + PHASE_LABEL[govPhase()] + '</button>' +
      '<button type="button" class="gov-chip" id="gov-sea" data-seaopen="1">🌊 Sea Plots</button>' +
      '<button type="button" class="gov-chip" id="gov-homes" data-placecat="homes">🏘️ ' + homes + ' home' + (homes === 1 ? '' : 's') + '</button></div>' +
      '<button type="button" class="gov-banner" id="gov-banner" data-app="govt">🏛️ ' + (g ? 'Gov ' + esc(nameOf(g.gov)) + ' & Deputy ' + esc(nameOf(g.deputy)) + ': ' + esc(G.MOTTOS[g.ticket.motto]) : 'No governor yet. Join a party and run in the primaries') + '</button>';
  }

  function govtView() {
    var tab = ui.govTab || 'house', can = !!(online.db && online.me);
    var tabs = [['house', '🏛️ Government House'], ['parties', '🎌 Parties'], ['campaign', '📣 Campaign'], ['vote', '🗳️ Vote'], ['results', '📊 Results']];
    var html = '<div class="section" style="padding-top:0"><p class="note">Lasgidi elects a Governor and Deputy Governor every week, on a joint ticket. Primaries run Monday and Tuesday, the campaign Wednesday to Friday, and voting Saturday and Sunday. The winners govern the next week and form the Executive Council. None of it touches money in your life. Today: <b>' + esc(PHASE_LABEL[govPhase()]) + '</b>.' + (can ? '' : ' The government works when the game is opened on claude.ai.') + '</p>' +
      '<div class="pg-chips" style="padding:0">' + tabs.map(function (t) { return '<button type="button" class="pg-chip' + (t[0] === tab ? ' sel' : '') + '" id="gt-' + t[0] + '" data-govtab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      (online.govStatus ? '<p class="note"><b>' + esc(online.govStatus) + '</b></p>' : '') + '</div>';
    if (tab === 'house') html += govHouse(can);
    else if (tab === 'parties') html += govParties(can);
    else if (tab === 'campaign') html += govCampaign(can);
    else if (tab === 'vote') html += govVote(can);
    else html += govResults();
    return html;
  }
  function person(id, role, extra) {
    return '<div class="gov-now">' + photoImg(id, 'pphoto') + '<div><span class="label">' + esc(role) + '</span><b>' + esc(nameOf(id)) + (id === online.me ? ' (you)' : '') + '</b>' + (extra || '') + '</div></div>';
  }
  function govHouse(can) {
    var g = government();
    if (!g) return '<div class="section"><h3>🏛️ Government House</h3><p class="note">The seat is empty: no ticket won last week. Join a party in the Parties tab, win your primary, pick a deputy and take the ticket to the voters this weekend.</p></div>';
    var t = g.ticket, mine = g.gov === online.me, inAssembly = !!g.assembly[online.me];
    var html = '<div class="section"><h3>🏛️ Government House · ' + esc(townWeek()) + '</h3>' +
      person(g.gov, 'Governor · chief executive', '<p>' + partyChip(t.party) + ' “' + esc(G.MOTTOS[t.motto]) + '”</p><span class="muted">' + t.planks.map(function (p) { return G.PLANKS[p].icon + ' ' + G.PLANKS[p].name; }).join(' · ') + '</span>') +
      person(g.deputy, 'Deputy Governor · acts when the governor is away') + '</div>';
    // Executive Council.
    var byPost = {}; g.cabinet.forEach(function (c) { byPost[c.post] = c; });
    var myCab = (online.govcab || []).filter(function (r) { return r.id === online.me; })[0], myPosts = mine && myCab && G.weekVal(myCab.raw, townWeek()) ? G.weekVal(myCab.raw, townWeek()).posts || {} : {};
    var pool = Object.keys(online.names).filter(function (id) { return id !== g.gov; });
    html += '<div class="section"><h3>🧑🏾‍💼 Executive Council</h3><p class="note">The governor appoints Commissioners and Special Advisers. Commissioners serve once the State House of Assembly confirms them; Special Advisers need no confirmation.</p><div class="list">' +
      Object.keys(G.PORTFOLIOS).map(function (k) {
        var P = G.PORTFOLIOS[k], c = byPost[k];
        var status = !c ? '<span class="muted">Vacant</span>' : c.status === 'confirmed' ? '<span class="gain">Confirmed ' + c.yes + '–' + c.no + '</span>' : c.status === 'rejected' ? '<span class="cost">Rejected ' + c.yes + '–' + c.no + '</span>' : c.status === 'appointed' ? '<span class="gain">Appointed</span>' : '<span>Awaiting confirmation ' + c.yes + '–' + c.no + '</span>';
        var pick = mine && can ? '<select id="cab-' + k + '" data-govappoint="' + k + '"><option value="">Choose…</option>' + pool.map(function (id) { return '<option value="' + esc(id) + '"' + (myPosts[k] === id ? ' selected' : '') + '>' + esc(nameOf(id)) + '</option>'; }).join('') + '</select>' : '';
        var vote = c && !P.sa && inAssembly && can && !mine ? '<span class="inline"><button class="btn sm go" id="cf-y-' + k + '" data-govconfirm="' + k + ':1">Confirm</button><button class="btn sm ghost" id="cf-n-' + k + '" data-govconfirm="' + k + ':-1">Reject</button></span>' : '';
        return '<div class="item"><div><h3>' + P.icon + ' ' + esc(P.name) + '</h3><div class="meta">' + (c ? '<span>' + esc(nameOf(c.id)) + '</span>' : '') + status + '</div>' + pick + '</div>' + vote + '</div>';
      }).join('') + '</div></div>';
    var r = g.result;
    html += '<div class="section"><h3>🏛️ State House of Assembly</h3><p class="note">Every player who voted in last week\'s election sits in the Assembly this week (' + Object.keys(g.assembly).length + ' members) and votes to confirm or reject Commissioners.' + (inAssembly ? ' You are a member.' : '') + '</p>' +
      '<h3>⚖️ Judiciary: Election Tribunal</h3><p class="note">' + (r.simpleMajority ? 'No ticket reached 25% of the vote in two-thirds of the districts. The tribunal returned the ticket with the most valid votes.' : 'The tribunal certified the result: the winning ticket had the most valid votes and the required spread (25% in at least ' + r.need + ' of ' + Object.keys(r.units).length + ' districts).') + '</p></div>';
    return html;
  }
  function govParties(can) {
    var wk = townWeek(), ph = govPhase(), st = govState(wk), mem = st.n.members, myParty = mem[online.me], pts = L.statusPoints(S);
    var counts = {}; Object.keys(mem).forEach(function (k) { counts[mem[k]] = (counts[mem[k]] || 0) + 1; });
    var html = '<div class="section"><h3>🎌 Political parties</h3><p class="note">Join one party a week. Members choose its candidate for governor in the primaries (Monday and Tuesday).</p><div class="list">' +
      Object.keys(G.PARTIES).map(function (p) {
        var P = G.PARTIES[p], on = myParty === p;
        return '<div class="item"><div><h3>' + partyChip(p) + ' ' + esc(P.name) + '</h3><div class="meta"><span>' + (counts[p] || 0) + ' member' + (counts[p] === 1 ? '' : 's') + '</span></div></div>' +
          (on ? '<span class="gain">✓ Member</span>' : '<button class="btn sm' + (myParty ? ' ghost' : ' go') + '" id="party-' + p + '" data-govjoin="' + p + '"' + (can ? '' : ' disabled') + '>' + (myParty ? 'Switch' : 'Join') + '</button>') + '</div>';
      }).join('') + '</div></div>';
    if (!myParty) return html;
    // Primaries in my party.
    var cands = st.n.candidates.filter(function (c) { return c.party === myParty; }).sort(function (a, b) { return b.primary - a.primary || a.at - b.at; });
    var myVote = (online.govprimary || []).filter(function (r) { return r.id === online.me; })[0], mv = myVote && G.weekVal(myVote.raw, wk);
    html += '<div class="section"><h3>' + partyChip(myParty) + ' Primary for governor</h3>' +
      (cands.length ? '<div class="th-opts">' + cands.map(function (c) {
        var on = mv && mv.cand === c.id;
        return '<button type="button" class="th-opt' + (on ? ' sel' : '') + '" id="pri-' + esc(c.id) + '" data-govprimary="' + esc(c.id) + '"' + (can && ph === 'primaries' ? '' : ' disabled') + '><span class="th-t">' + (on ? '✓ ' : '') + esc(nameOf(c.id)) + (c.id === online.me ? ' (you)' : '') + '<small> · ' + esc(G.MOTTOS[c.motto]) + '</small></span><b class="num">' + c.primary + '</b></button>';
      }).join('') + '</div>' : '<p class="note">No one has declared yet.</p>') + (ph !== 'primaries' ? '<p class="note">Primary voting is closed until Monday. ' + (cands[0] ? esc(nameOf(cands[0].id)) + ' is the nominee.' : '') + '</p>' : '') + '</div>';
    // Declare / edit my candidacy.
    var mine = st.n.candidates.filter(function (c) { return c.id === online.me; })[0];
    var sel = ui.govMotto != null ? ui.govMotto : mine ? mine.motto : 0, planks = ui.govPlanks || (mine ? mine.planks.slice() : []);
    if (mine || ph === 'primaries') {
      html += '<div class="section"><h3>' + (mine ? '✏️ Your campaign' : '🙋🏾 Declare for governor') + '</h3>' +
        '<div class="label">Slogan</div><div class="pg-chips" style="padding:0">' + G.MOTTOS.map(function (m, i) { return '<button type="button" class="pg-chip' + (i === sel ? ' sel' : '') + '" id="govm-' + i + '" data-govmotto="' + i + '">' + esc(m) + '</button>'; }).join('') + '</div>' +
        '<div class="label">Your three priorities</div><div class="pg-chips" style="padding:0">' + Object.keys(G.PLANKS).map(function (k) { return '<button type="button" class="pg-chip' + (planks.indexOf(k) >= 0 ? ' sel' : '') + '" id="plank-' + k + '" data-govplank="' + k + '">' + G.PLANKS[k].icon + ' ' + esc(G.PLANKS[k].name) + '</button>'; }).join('') + '</div>' +
        '<div class="inline"><button class="btn go" id="gov-run" data-govrun="1"' + (can && pts >= G.MIN_STATUS ? '' : ' disabled') + '>' + (mine ? 'Save campaign' : '🗳️ Declare') + '</button></div>' +
        (pts < G.MIN_STATUS ? '<p class="why">You need ' + G.MIN_STATUS + ' status points to run (you have ' + pts + '). Property, cars and titles add status.</p>' : '') + '</div>';
    }
    // Running mate.
    var ticket = st.n.tickets.filter(function (t) { return t.id === online.me; })[0];
    if (ticket) {
      var mates = Object.keys(mem).filter(function (id) { return mem[id] === myParty && id !== online.me; });
      html += '<div class="section"><h3>🤝 Your running mate</h3><p class="note">You are your party\'s nominee. Choose a Deputy Governor from your party. They must accept before the ticket can go on the ballot.</p>' +
        (mates.length ? '<select id="gov-deputy" data-govdeputy="1"><option value="">Choose a party member…</option>' + mates.map(function (id) { return '<option value="' + esc(id) + '"' + (ticket.deputyAsk === id ? ' selected' : '') + '>' + esc(nameOf(id)) + '</option>'; }).join('') + '</select>' : '<p class="note">No other members in your party yet. Invite friends to join ' + esc(G.PARTIES[myParty].short) + '.</p>') +
        '<p class="note">' + (ticket.deputy ? '✅ ' + esc(nameOf(ticket.deputy)) + ' accepted. Your ticket is on the ballot.' : ticket.deputyAsk ? '⏳ Waiting for ' + esc(nameOf(ticket.deputyAsk)) + ' to accept.' : 'No deputy yet: the ticket cannot go on the ballot.') + '</p></div>';
    }
    // Asked to be someone's deputy?
    var asks = st.n.tickets.filter(function (t) { return t.deputyAsk === online.me && t.party === myParty; });
    if (asks.length) {
      var mp = (online.govparty || []).filter(function (r) { return r.id === online.me; })[0], mpv = mp && G.weekVal(mp.raw, wk);
      html += '<div class="section"><h3>🎖️ Deputy Governor offer</h3><div class="list">' + asks.map(function (t) {
        var on = mpv && mpv.mate === t.id;
        return '<div class="item"><div><h3>' + esc(nameOf(t.id)) + ' wants you as Deputy Governor</h3><div class="meta"><span>“' + esc(G.MOTTOS[t.motto]) + '”</span></div></div>' + (on ? '<span class="gain">✓ Accepted</span>' : '<button class="btn sm go" id="mate-' + esc(t.id) + '" data-govmate="' + esc(t.id) + '"' + (can ? '' : ' disabled') + '>Accept</button>') + '</div>';
      }).join('') + '</div></div>';
    }
    return html;
  }
  function ticketCard(t, extra) {
    return '<div class="item"><div><h3>' + partyChip(t.party) + ' ' + esc(nameOf(t.id)) + (t.deputy ? ' & ' + esc(nameOf(t.deputy)) : ' <span class="muted">(no deputy yet)</span>') + '</h3>' +
      '<div class="meta"><span>“' + esc(G.MOTTOS[t.motto]) + '”</span>' + t.planks.map(function (p) { return '<span>' + G.PLANKS[p].icon + ' ' + esc(G.PLANKS[p].name) + '</span>'; }).join('') + '</div></div>' + (extra || '') + '</div>';
  }
  function govCampaign(can) {
    var wk = townWeek(), ph = govPhase(), st = govState(wk), today = new Date().toISOString().slice(0, 10);
    var html = '<div class="section"><h3>📣 On the campaign trail</h3><p class="note">Nominees take their ticket across the state: town halls, rallies, road shows, media, debates, policy presentations and community visits. Each activity counts once a day and adds buzz. Buzz is bragging rights: only votes decide the winner.</p><div class="list">' +
      (st.n.tickets.length ? st.n.tickets.slice().sort(function (a, b) { return b.buzz - a.buzz; }).map(function (t) {
        return ticketCard(t, '<b class="num">🔥 ' + t.buzz + '</b>') + '<div class="camp-row">' + Object.keys(G.CAMPAIGN).map(function (k) { return t.camp[k] ? '<span class="camp-tag">' + G.CAMPAIGN[k].icon + ' ×' + t.camp[k] + '</span>' : ''; }).join('') + '</div>';
      }).join('') : '<p class="note">No nominees yet. Primaries run Monday and Tuesday.</p>') + '</div></div>';
    var mine = st.n.tickets.filter(function (t) { return t.id === online.me; })[0];
    if (mine) {
      var raw = ((online.govrun || []).filter(function (r) { return r.id === online.me; })[0] || {}).raw || {}, days = raw.campDay || {};
      html += '<div class="section"><h3>🎤 Campaign as ' + esc(nameOf(online.me)) + '</h3><div class="act-grid">' + Object.keys(G.CAMPAIGN).map(function (k) {
        var done = days[k] === today, C = G.CAMPAIGN[k];
        return '<button type="button" class="btn' + (done ? ' ghost' : ' go') + '" id="camp-' + k + '" data-govcamp="' + k + '"' + (can && ph === 'campaign' && !done ? '' : ' disabled') + '>' + C.icon + ' ' + esc(C.name) + (done ? ' ✓' : '') + '</button>';
      }).join('') + '</div>' + (ph !== 'campaign' ? '<p class="note">The campaign runs Wednesday to Friday.</p>' : '') + '</div>';
    }
    return html;
  }
  function govVote(can) {
    var wk = townWeek(), ph = govPhase(), st = govState(wk), u = myUnit();
    var mv = (online.govvote || []).filter(function (r) { return r.id === online.me; })[0], v = mv && G.weekVal(mv.raw, wk);
    var ballot = st.n.tickets.filter(function (t) { return t.deputy; });
    var html = '<div class="section"><h3>📘 Voter education</h3><ul class="gov-list">' +
      '<li><b>When:</b> Saturday and Sunday (UTC). Voting closes at the end of Sunday.</li>' +
      '<li><b>Where:</b> your polling unit is the district your Lasgidi home is in: <b>' + esc(unitName(u)) + '</b>.</li>' +
      '<li><b>How:</b> one secret vote per player for a Governor–Deputy ticket. You can change it until voting closes. The game only ever shows totals, never who voted for whom.</li>' +
      '<li><b>Winning:</b> votes are collated from each district to the state. The winner needs the most valid votes and at least 25% in two-thirds of the districts that voted.</li></ul></div>';
    html += '<div class="section"><h3>🗳️ Ballot · ' + esc(wk) + '</h3>' + (ballot.length ? '<div class="th-opts">' + ballot.map(function (t) {
      var on = v && v.cand === t.id;
      return '<button type="button" class="th-opt' + (on ? ' sel' : '') + '" id="ballot-' + esc(t.id) + '" data-govvote="' + esc(t.id) + '"' + (can && ph === 'election' ? '' : ' disabled') + '><span class="th-t">' + (on ? '✓ ' : '') + partyChip(t.party) + ' ' + esc(nameOf(t.id)) + ' & ' + esc(nameOf(t.deputy)) + '<small> · ' + esc(G.MOTTOS[t.motto]) + '</small></span></button>' +
        (t.id !== online.me ? '<button type="button" class="link-btn rep-link" id="repc-' + esc(t.id) + '" data-reportopen="' + esc(t.id) + '" aria-label="Report ' + esc(nameOf(t.id)) + '">🚩 Report</button>' + reportBox(t.id) : '');
    }).join('') + '</div>' : '<p class="note">No complete tickets yet. A ticket needs a nominee and a deputy who accepted.</p>') +
      (ph !== 'election' ? '<p class="note">Polls open on Saturday.</p>' : v ? '<p class="note">Your vote is in at ' + esc(unitName(v.unit)) + '.</p>' : '') + '</div>';
    return html;
  }
  function resultTable(e) {
    if (!e.rows.length) return '<p class="note">No tickets were on the ballot.</p>';
    var units = Object.keys(e.units);
    return '<div class="list">' + e.rows.map(function (r, i) {
      var pct = e.total ? Math.round(r.votes / e.total * 100) : 0;
      return ticketCard(r.ticket, '<b class="num">' + r.votes + ' · ' + pct + '%</b>') + '<p class="note">' + (i === 0 && e.winner === r ? '🏆 Declared winner. ' : '') + 'At least 25% in ' + r.spread + ' of ' + units.length + ' districts' + (r.meetsSpread ? ' ✓' : ' (needs ' + e.need + ')') + '.</p>';
    }).join('') + '</div><div class="label">Collation by district</div><div class="list">' + units.map(function (u) {
      return '<div class="item"><div><h3>' + esc(unitName(u)) + '</h3><div class="meta">' + e.rows.map(function (r) { return '<span>' + esc(G.PARTIES[r.ticket.party].short) + ' ' + (r.units[u] || 0) + '</span>'; }).join('') + '</div></div><b class="num">' + e.units[u] + '</b></div>';
    }).join('') + '</div>';
  }
  function govResults() {
    var now = govState(townWeek()).e, last = govState(lastWeek()).e;
    return '<div class="section"><h3>📊 This weekend · ' + esc(townWeek()) + (govPhase() === 'election' ? ' (counting live)' : '') + '</h3>' + (govPhase() === 'election' ? resultTable(now) : '<p class="note">Results appear when the polls open on Saturday.</p>') + '</div>' +
      '<div class="section"><h3>🏁 Final result · ' + esc(lastWeek()) + '</h3>' + resultTable(last) + '</div>';
  }
  // Write one of my government docs: keep this week's fields, carry last week's entry in prev.
  function govWrite(col, patch, msg) {
    if (!online.db || !online.me) return;
    var wk = townWeek(), old = (online[col] || []).filter(function (r) { return r.id === online.me; })[0], o = old && old.raw;
    var doc;
    if (o && o.week === wk) { doc = JSON.parse(JSON.stringify(o)); Object.keys(patch).forEach(function (k) { doc[k] = patch[k]; }); }
    else { doc = JSON.parse(JSON.stringify(patch)); doc.week = wk; if (o && o.week) { var pv = JSON.parse(JSON.stringify(o)); delete pv.prev; doc.prev = pv; } }
    online.db.doc(col + '/' + online.me).set(doc).then(function () { online.govStatus = msg; render(); }, function () { online.govStatus = 'That could not be saved.'; render(); });
  }

  function townView() {
    var T = townTally();
    var html = reportsAdmin() + '<div class="section" style="padding-top:0"><h3>🗳️ Town Hall · ' + esc(T.wk) + '</h3><p class="note">One question a week for every Lasgidi player. Your vote is shared, and you can change it until the week ends. Nothing here touches your money.</p>' +
      '<h3 class="th-q">' + esc(T.q.q) + '</h3><div class="th-opts">' + T.q.a.map(function (a, i) {
        var pct = T.total ? Math.round(T.counts[i] / T.total * 100) : 0, on = T.mine === i;
        return '<button type="button" class="th-opt' + (on ? ' sel' : '') + '" id="vote-' + i + '" data-vote="' + i + '"' + (online.db && online.me ? '' : ' disabled') + '><span class="th-bar" style="width:' + pct + '%"></span><span class="th-t">' + (on ? '✓ ' : '') + esc(a) + '</span><b class="num">' + pct + '%</b></button>';
      }).join('') + '</div><p class="note">' + T.total + ' vote' + (T.total === 1 ? '' : 's') + ' so far.' + (online.db ? '' : ' Voting works when the game is opened on claude.ai.') + (online.voteStatus ? ' ' + esc(online.voteStatus) : '') + '</p></div>';
    return html + '<div class="section"><button class="btn go" id="town-govt" data-app="govt">🏛️ Open the State Government</button></div>';
  }

  function gamesView() {
    var rows = [
      { icon: '🚐', name: 'Danfo Run', where: 'Ojuelegba danfo park, Surulere', when: 'Every day, 06:00–21:00', best: S.stats.danfoBest ? 'Best fares ' + N(S.stats.danfoBest) + ' · ' + (S.stats.danfoPax || 0) + ' passengers in all' : 'Not played yet', act: 'suru_danfo', kind: 'danfo', place: 'ojuelegba_park', district: 'surulere' },
      { icon: '🛒', name: 'Go-slow hawker', where: 'Oshodi market, Oshodi', when: 'Every day, 06:00–21:00', best: S.stats.hawkBest ? 'Best shift ' + N(S.stats.hawkBest) : 'Not played yet', act: 'oshodi_hawkgame', kind: 'hawk', place: 'oshodi_market', district: 'oshodi' },
      { icon: '🍌', name: 'Bole grill', where: 'Bole and fish spot, Old GRA, Port Harcourt', when: 'Every day, 11:00–22:00', best: S.stats.boleBest ? 'Best shift ' + N(S.stats.boleBest) : 'Not played yet', act: 'ph_bolegame', kind: 'bole', place: 'ph_bole', district: 'ph_oldgra' },
      { icon: '🎤', name: 'Naija Quiz', where: 'Millennium Park, Maitama, Abuja', when: 'Friday to Sunday, 15:00–20:00, once a day', best: S.stats.quizBest != null ? 'Best ' + S.stats.quizBest + '/10' : 'Not played yet', act: 'abj_quiz', kind: 'quiz', place: 'abj_millennium', district: 'abj_maitama' },
      { icon: '💃', name: 'Owambe dance-off', where: 'Event hall, Surulere', when: 'Saturdays, 12:00–20:00', best: S.stats.danceBest ? 'Best ' + S.stats.danceBest + '% on the beat' : 'Not played yet', act: 'suru_danceoff', kind: 'dance', place: 'owambe_hall', district: 'surulere' }
    ];
    var acts = L.availableActions(S);
    return '<div class="section" style="padding-top:0"><h3>🎮 Mini-games</h3><p class="note">Arcade games that pay as part of your life, with capped takings, so skill helps but never prints money.</p><div class="list">' + rows.map(function (g) {
      var a = acts.filter(function (x) { return x.id === g.act; })[0], can = a && !a.disabled;
      return '<div class="item"><div><h3>' + g.icon + ' ' + esc(g.name) + '</h3><div class="meta"><span>' + esc(g.where) + '</span><span>' + esc(g.when) + '</span></div><div class="act-note">' + esc(g.best) + '</div>' + (a && a.disabled ? '<div class="why">' + esc(a.disabled) + '</div>' : '') + '</div>' +
        (can ? '<button class="btn go" id="game-' + g.kind + '" data-minigame="' + g.kind + '">▶ Play</button>' : L.districtCity(g.district) !== L.cityOf(S) ? '<button class="btn ghost" id="game-go-' + g.kind + '" data-app="travel">✈️ Fly there</button>' : '<button class="btn ghost" id="game-go-' + g.kind + '" data-tripto="' + g.district + '" data-tab="map">Go there</button>') + '</div>';
    }).join('') + '</div></div>';
  }
  // When a room night next starts (game minutes), or 0 while it is on.
  function nightNext(id) {
    var N = D.ROOM_NIGHTS[id], I = L.roomNightInfo(S, id); if (I.live) return 0;
    var base = Math.floor(S.t / 1440) * 1440;
    for (var k = 0; k <= 7; k++) { var st = base + k * 1440 + N.from * 60; if (Math.floor(st / 1440) % 7 === N.dow && st > S.t) return st - S.t; }
    return 7 * 1440;
  }
  function roomNightsView() {
    var here = L.cityOf(S), rows = Object.keys(D.ROOM_NIGHTS).map(function (id) {
      var R = D.ROOMS[id], pl = D.PLACES.filter(function (x) { return x.id === R.place; })[0], c = L.districtCity(pl.district);
      return { id: id, N: D.ROOM_NIGHTS[id], R: R, city: c, wait: nightNext(id) };
    }).sort(function (a, b) { return (a.wait ? 1 : 0) - (b.wait ? 1 : 0) || (a.city === here ? 0 : 1) - (b.city === here ? 0 : 1) || a.wait - b.wait; });
    return '<div class="section"><h3>📍 Room nights this week</h3><p class="note">One night a week in every live room. Join from inside the room.</p><div class="list">' + rows.map(function (r) {
      var E = r.N, when = D.DAYS[E.dow] + ' ' + String(E.from).padStart(2, '0') + ':00';
      return '<div class="item"><div><h3>' + E.icon + ' ' + esc(E.name) + '</h3><div class="meta">' + (r.wait ? '<span>' + when + ' · in ' + esc(dur(r.wait)) + '</span>' : '<span class="gain">On now</span>') + '<span>' + esc(r.R.name) + ', ' + esc(D.CITIES[r.city].name) + '</span><span>' + (E.fee ? N(L.price(S, E.fee)) : 'Free') + '</span></div></div><button class="btn sm ghost" id="rn-' + r.id + '" data-place="' + r.R.place + '" data-tab="map">Go</button></div>';
    }).join('') + '</div></div>';
  }
  function eventsView() {
    var rows = [];
    Object.keys(D.PLACE_ACTIONS).forEach(function (d) {
      D.PLACE_ACTIONS[d].forEach(function (a) { if (a.event) rows.push({ a: a, d: d, pl: D.PLACES.filter(function (p) { return p.acts.indexOf(a.id) >= 0; })[0] }); });
    });
    var m = L.monthIndex(S);
    var here = L.cityOf(S);
    // This month first, then your own city, then whatever is on right now.
    rows.sort(function (x, y) {
      var a = !x.a.when.months || x.a.when.months.indexOf(m) >= 0, b = !y.a.when.months || y.a.when.months.indexOf(m) >= 0;
      return (b ? 1 : 0) - (a ? 1 : 0) || (L.districtCity(y.d) === here ? 1 : 0) - (L.districtCity(x.d) === here ? 1 : 0) || (L.inWindow(S, y.a.when) ? 1 : 0) - (L.inWindow(S, x.a.when) ? 1 : 0);
    });
    var html = roomNightsView() + '<div class="section"><h3>🎟️ What\'s on</h3><p class="note">Festivals, concerts and matches across Lagos, Abuja and Port Harcourt. It is ' + esc(D.MONTHS[m]) + ' in your life.</p><div class="list">';
    html += rows.map(function (r) {
      var w = r.a.when, thisMonth = !w.months || w.months.indexOf(m) >= 0, now = thisMonth && L.inWindow(S, w), sameCity = L.districtCity(r.d) === L.cityOf(S);
      var when = (w.months ? w.months.map(function (x) { return D.MONTHS[x]; }).join('/') + ' · ' : 'Every week · ') + (w.days ? w.days.map(function (x) { return D.DAYS[x]; }).join('/') + ' ' : '') + pad(w.from) + ':00–' + pad(w.to) + ':00';
      var status = now ? '<span class="gain">On now</span>' : thisMonth ? '<span>This month</span>' : '<span class="muted">Coming in ' + esc(D.MONTHS[w.months[0]]) + '</span>';
      var go = !sameCity ? '<button class="btn sm ghost" id="ev-fly-' + r.a.id + '" data-app="travel">✈️ ' + esc(D.CITIES[L.districtCity(r.d)].name) + '</button>'
        : S.loc === r.d ? (r.pl ? '<button class="btn sm" id="ev-' + r.a.id + '" data-place="' + r.pl.id + '">Open</button>' : '')
        : '<button class="btn sm ghost" id="ev-go-' + r.a.id + '" data-tripto="' + r.d + '">Go there</button>';
      return '<div class="item"><div><h3>' + esc(r.a.label) + '</h3><div class="meta">' + status + '<span>' + esc(r.pl ? r.pl.name : D.DISTRICTS[r.d].name) + ', ' + esc(D.CITIES[L.districtCity(r.d)].name) + '</span><span>' + esc(when) + '</span>' + (r.a.cost ? '<span class="cost num">' + N(L.price(S, r.a.cost)) + '</span>' : '<span>Free</span>') + '</div></div>' + go + '</div>';
    }).join('');
    return html + '</div></div>';
  }
  function phoneView() {
    var app = ui.app, body;
    if (app) {
      if (app === 'messages') { body = gistView(); markRead(); }
      else if (app === 'jobs') body = workView();
      else if (app === 'town') body = '<div class="panel-b">' + townView() + '</div>';
      else if (app === 'govt') body = '<div class="panel-b">' + govtView() + '</div>';
      else if (app === 'nysc') body = '<div class="panel-b">' + nyscView() + '</div>';
      else if (app === 'sports') body = '<div class="panel-b">' + sportsView() + '</div>';
      else if (app === 'sights') body = '<div class="panel-b">' + sightsView() + '</div>';
      else if (app === 'guide') body = '<div class="panel-b">' + guideView() + '</div>';
      else if (app === 'games') body = '<div class="panel-b">' + gamesView() + '</div>';
      else if (app === 'creator') body = '<div class="panel-b">' + creatorView() + '</div>';
      else if (app === 'story') body = '<div class="panel-b">' + storyView() + '</div>';
      else if (app === 'weather') body = '<div class="panel-b">' + weatherView() + '</div>';
      else if (app === 'shop') body = '<div class="panel-b">' + shopView() + '</div>';
      else if (app === 'stocks') body = '<div class="panel-b">' + stocksView() + '</div>';
      else if (app === 'quests') body = '<div class="panel-b">' + questsView() + '</div>';
      else if (app === 'bank') body = '<div class="panel-b">' + bankView() + '</div>';
      else if (app === 'dealers') body = '<div class="panel-b"><div class="section"><h3>Car dealers</h3>' + dealerView('Buy from the phone, or visit the Berger and Lekki dealers on the map.') + '</div></div>';
      else if (app === 'gems') body = '<div class="panel-b">' + gemCard() + '</div>';
      else if (app === 'events') body = '<div class="panel-b">' + eventsView() + '</div>';
      else if (app === 'travel') body = '<div class="panel-b">' + citiesView() + '</div>';
      else if (app === 'fame') body = '<div class="panel-b">' + (fameView() || '<div class="section"><h3>Lagos Hall of Fame</h3><p class="note">The Hall of Fame is shared with everyone you share Lasgidi with. It works when the game is opened on claude.ai.</p></div>') + '</div>';
      else if (app === 'wardrobe') body = '<div class="panel-b">' + lagosianView() + '</div>';
      else if (app === 'home') body = houseTab();
      else if (app === 'people') body = '<div class="panel-b">' + peopleView() + '</div>';
      else if (app === 'money') body = moneyView();
      else if (app === 'assets') body = '<div class="panel-b">' + assetsView() + '</div>';
      else if (app === 'houses') body = '<div class="panel-b">' + housesView() + '</div>';
      else if (app === 'style') body = '<div class="panel-b">' + styleView() + '</div>';
      var a = APPS.filter(function (x) { return x[0] === app; })[0];
      return '<div class="phone-top"><button class="btn sm ghost" id="app-back" data-app="">‹ Apps</button><b>' + (a ? a[1] + ' ' + esc(a[2]) : '') + '</b></div>' + body;
    }
    // 3D app tiles: each app gets its own gradient, like a real phone home screen.
    var APP_TINTS = [['#ffd23f', '#f59e0b'], ['#4ade80', '#16a34a'], ['#f472b6', '#db2777'], ['#60a5fa', '#2563eb'], ['#a78bfa', '#7c3aed'], ['#fb923c', '#ea580c'], ['#2dd4bf', '#0d9488'], ['#f87171', '#dc2626']];
    var unread = unreadCount(), id = gemToday(), found = L.gemsFound(S, id).length;
    var onNow = 0;
    Object.keys(D.PLACE_ACTIONS).forEach(function (d) { D.PLACE_ACTIONS[d].forEach(function (a) { if (a.event && L.districtCity(d) === L.cityOf(S) && (!a.when.months || a.when.months.indexOf(L.monthIndex(S)) >= 0) && L.inWindow(S, a.when)) onNow++; }); });
    var badge = { quests: L.activeQuests(S, 99).filter(function (q) { return q.done; }).length, messages: unread, gems: L.GEM_COUNT - found, events: onNow };
    // The home screen sits in a phone frame: status bar, a lock-screen clock, a news ticker and the apps.
    var h = L.hour(S), mins = S.t % 60, news = S.log.filter(function (l) { return l.kind !== 'info'; }).slice(0, 4);
    var batt = Math.max(5, Math.round(S.needs.energy)), net = S.power ? '4G' : 'E';
    return '<div class="phone-frame' + (h >= 19 || h < 6 ? ' night' : '') + '"><div class="ph-status"><span>' + pad(h) + ':' + pad(mins) + '</span><span class="ph-notch" aria-hidden="true"></span><span>' + net + ' ▮▮▮ ' + batt + '%</span></div>' +
      '<div class="ph-lock"><b>' + pad(h) + ':' + pad(mins) + '</b><span>' + esc(L.dateLabel ? L.dateLabel(S) : L.clockLabel(S)) + ' · ' + esc(D.CITIES[L.cityOf(S)].name) + '</span></div>' +
      (news.length ? '<div class="ph-news" aria-label="Latest news"><span class="ph-news-h">📰 Latest</span><div class="ph-ticker"><div>' + news.map(function (l) { return '<span>' + esc(l.text) + '</span>'; }).join('') + '</div></div></div>' : '') +
      '<div class="apps ph-apps">' + APPS.filter(function (x) { return x[0] !== 'style' || online.shop; }).map(function (x, i) {
      var n = badge[x[0]];
      return '<button type="button" class="app" id="app-' + x[0] + '" data-app="' + x[0] + '"><span class="app-ic" style="--a1:' + APP_TINTS[i % APP_TINTS.length][0] + ';--a2:' + APP_TINTS[i % APP_TINTS.length][1] + '">' + x[1] + (n ? '<span class="badge">' + (n > 99 ? '99+' : n) + '</span>' : '') + '</span><span class="app-n">' + esc(x[2]) + '</span></button>';
    }).join('') + '</div><div class="ph-home" aria-hidden="true"></div></div>';
  }

  // Assets: where your net worth sits, largest first.
  function assetsView() {
    var rows = [['💵 Cash', S.cash], ['🏦 Bank', S.bank], ['📈 Shares', L.stocksValue(S)], ['📜 Treasury bills', L.bondsHeld(S)]];
    S.properties.forEach(function (p) { rows.push(['🏠 ' + D.PROPERTIES[p.id].name, p.value]); });
    (S.vehicles || []).forEach(function (v) { rows.push([(D.VEHICLES[v.id].icon || '🚗') + ' ' + D.VEHICLES[v.id].name, Math.round(v.paid * 0.5 / 1000) * 1000]); });
    S.businesses.forEach(function (b) { rows.push(['🏪 ' + ((D.BUSINESSES[b.id] && D.BUSINESSES[b.id].name) || 'Business'), Math.round(b.paid * 0.6 / 50) * 50]); });
    var items = (S.items || []).reduce(function (a, it) { return a + Math.round(it.paid * 0.4 / 50) * 50; }, 0); if (items) rows.push(['🛋️ Furniture and things', items]);
    rows = rows.filter(function (r) { return r[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
    var total = rows.reduce(function (a, r) { return a + r[1]; }, 0) || 1, debt = L.debts(S);
    return '<div class="section" style="padding-top:0"><h3>📊 Your assets</h3><div class="wallet-card"><div class="wc-l">Net worth</div><div class="wc-big num">' + N(L.netWorth(S)) + '</div></div><div class="list">' +
      rows.map(function (r) { return '<div class="item asset-row"><div><h3>' + esc(r[0]) + '</h3><div class="asset-bar"><i style="width:' + Math.max(2, Math.round(r[1] / total * 100)) + '%"></i></div></div><span class="num">' + N(r[1]) + '</span></div>'; }).join('') +
      (debt ? '<div class="item asset-row"><div><h3>🧾 Debts</h3></div><span class="num cost">−' + N(debt) + '</span></div>' : '') + '</div><p class="note">Cars and boats count at half what you paid, furniture at 40%: resale is hard in Lagos.</p></div>';
  }
  // Houses: where you live, what you own, and the estates you can buy into.
  function housesView() {
    var H = L.homeDef(S), own = S.properties.filter(function (p) { return D.PROPERTIES[p.id].house; });
    return '<div class="section" style="padding-top:0"><h3>🏡 Houses</h3><div class="item"><div><h3>You live in ' + esc(H.name) + '</h3><div class="meta"><span>' + esc(D.DISTRICTS[H.district].name) + '</span><span>' + (H.rent ? N(L.price(S, H.rent)) + ' rent a week' : 'No rent') + '</span></div></div><button class="btn sm ghost" id="hs-home" data-tab="home">Open home</button></div>' +
      (own.length ? '<h4>You own</h4><div class="list">' + own.map(function (p) { var P = D.PROPERTIES[p.id]; return '<div class="item"><div><h3>' + esc(P.name) + '</h3><div class="meta"><span>Worth ' + N(p.value) + '</span>' + (P.weekly ? '<span class="gain">Lets for ' + N(L.price(S, P.weekly)) + '/wk</span>' : '') + '</div></div>' + (P.home && S.home !== P.home ? '<button class="btn sm" id="hs-move-' + p.id + '" data-move="' + P.home + '">Move in</button>' : '') + '</div>'; }).join('') + '</div>' : '') +
      '<div class="list"><div class="item"><div><h3>🏡 Lekki Hyde Park</h3><div class="meta"><span>Five zones by the lagoon: buy or build</span></div></div><button class="btn sm" id="hs-hp" data-place="lekki_hyde_park" data-tab="map">Open</button></div>' +
      '<div class="item"><div><h3>🔑 Rent somewhere else</h3><div class="meta"><span>Every home on the map, by price</span></div></div><button class="btn sm ghost" id="hs-rent" data-placecat="homes" data-tab="map">Browse</button></div>' +
      '<div class="item"><div><h3>🏙️ Prime addresses and land</h3><div class="meta"><span>Nicon Town to Banana Island, and plots</span></div></div><button class="btn sm ghost" id="hs-prime" data-tab="money">Property</button></div></div></div>';
  }
  // Buy: every place to spend in one launcher, plus the car dealer.
  function buyView() {
    var stores = [['🚗', 'Cars, jets and yachts', 'Lekki luxury motors and Berger', 'data-app="dealers" data-tab="phone"'], ['🏡', 'Houses and land', 'Hyde Park, prime homes and plots', 'data-app="houses" data-tab="phone"'],
      ['👗', 'Clothes and looks', 'Boutiques, aso-ebi and the tailor', 'data-app="wardrobe" data-tab="phone"'], ['🛋️', 'Furniture', 'Fill your home', 'data-tab="home"'], ['📈', 'Shares and bills', 'The stock exchange and treasury bills', 'data-app="stocks" data-tab="phone"'], ['🏪', 'A business', 'Start or grow one', 'data-tab="money"']];
    return '<div class="panel-h"><h2>🛍️ Buy</h2><span class="muted">Wallet ' + N(S.cash + S.bank) + '</span></div><div class="panel-b"><div class="buy-grid">' + stores.map(function (x, i) {
      return '<button type="button" class="buy-tile" id="buy-' + i + '" ' + x[3] + '><span>' + x[0] + '</span><b>' + esc(x[1]) + '</b><small>' + esc(x[2]) + '</small></button>';
    }).join('') + '</div></div>';
  }
  function bottomNav() {
    var items = [['home', '🏠', 'Home'], ['buy', '🛍️', 'Buy'], ['map', '🗺️', 'Map'], ['phone', '📱', 'Phone']];
    return '<nav class="bnav" aria-label="Main">' + items.map(function (x) { var on = ui.tab === x[0]; return '<button type="button" class="bn' + (on ? ' on' : '') + '" id="bn-' + x[0] + '" data-tab="' + x[0] + '"' + (x[0] === 'phone' ? ' data-app=""' : '') + ' aria-current="' + (on ? 'page' : 'false') + '"><span>' + x[1] + '</span>' + x[2] + '</button>'; }).join('') + '</nav>';
  }
  function gistView() {
    return '<div class="panel-h"><h2>Gist</h2><span class="muted">What is happening in your Lagos</span></div><div class="panel-b"><ul class="feed">' + S.log.map(function (l) {
      return '<li class="' + l.kind + '"><time>Wk ' + (Math.floor(l.t / 10080) + 1) + ' · ' + D.DAYS[Math.floor(l.t / 1440) % 7] + ' ' + pad(Math.floor(l.t % 1440 / 60)) + ':' + pad(l.t % 60) + '</time>' + esc(l.text) + '</li>';
    }).join('') + '</ul></div>';
  }

  /* ---------- modal for choice events ---------- */
  function modal() {
    if (S.japa && !S.japaSeen) {
      var J = D.JAPA_DESTS[S.japa.dest];
      return '<div class="scrim" role="dialog" aria-modal="true" aria-labelledby="japa-title"><div class="sheet"><span class="label">Life complete · week ' + (L.week(S) + 1) + '</span><h2 id="japa-title">' + J.icon + ' You japa-ed to ' + esc(J.name) + '!</h2>' +
        '<p>' + esc(L.titledName(S)) + ', ' + esc(D.ORIGINS[S.origin].name) + '. You left Lagos with ' + N(L.netWorth(S)) + ', ' + S.stats.trips + (S.stats.trips === 1 ? ' trip' : ' trips') + ' and ' + S.stats.shifts + (S.stats.shifts === 1 ? ' shift' : ' shifts') + ' behind you. ' + esc(J.text) + '</p>' +
        shareBlock() + '<div class="opts">' + (online.db && S.replay ? '<button class="btn go" id="japa-post" data-postfame="1">Post this life to the Hall of Fame</button>' : '') +
        '<button class="btn" id="japa-new" data-new="1">Start a new life</button><button class="btn ghost" id="japa-look" data-japaseen="1">Look back at this life</button></div></div></div>';
    }
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
      return '<tr><td>' + esc(l.name) + ' <span class="muted">· ' + esc(D.ORIGINS[l.origin] ? D.ORIGINS[l.origin].name : l.origin) + '</span>' + (l.gen > 1 ? '<span class="gen-chip">Gen ' + l.gen + '</span>' : '') + (l.won ? ' <span class="gain">✓ ' + esc(D.GOALS[l.goal].name) + '</span>' : '') + (l.tampered ? ' <span class="cost">edited save</span>' : '') + '</td><td>' + esc(l.title || 'Jobless') + '</td><td class="n num">' + l.weeks + '</td><td class="n num">' + N(l.worth) + '</td><td class="n num"><b>' + l.score + '</b></td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  /* ---------- intro / new game ---------- */
  function introView() {
    var o = ui.draftOrigin ? D.ORIGINS[ui.draftOrigin] : null, hs = heirsWaiting();
    var heirCard = hs.length ? '<div class="lottery heir"><span class="label">The next generation · generation ' + (hs[0].gen || 2) + '</span><b>👪 Continue the family of ' + esc(hs[0].parent) + '</b>' +
      '<p style="margin:0">Each child inherits ' + N(hs[0].inherit) + ' after the estate costs and the family share. Choose who carries the family on.</p><div class="list">' + hs.map(function (h, i) {
        var perks = [h.school === 'intl' ? 'International school: counts as a degree' : h.school === 'private' ? 'Private school: Charisma' : h.school ? 'Public school' : 'Not yet in school',
          h.as ? h.as + ' straight-A report card' + (h.as === 1 ? '' : 's') + ': Tech' : '', h.bond >= 60 ? 'Close bond: starts calm' : 'Bond ' + h.bond].filter(Boolean);
        return '<div class="item"><div><h3>🧒 ' + esc(h.name) + '</h3><div class="meta">' + perks.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('') + '</div></div>' +
          '<button class="btn sm go" id="heir-start-' + i + '" data-heir="' + i + '">Play as ' + esc(h.name) + '</button></div>';
      }).join('') + '</div><div class="inline"><button class="btn ghost" id="heir-skip" data-heir="skip">Start someone new</button></div></div>' : '';
    return '<div class="intro">' +
      '<h1>LASGIDI<span>Make it in Lagos. One week of rent at a time.</span></h1>' + heirCard +
      '<p class="lede">Work, hustle, sleep through NEPA, take the danfo or the ferry, join an ajo, dodge the loan apps and the Ponzi schemes. Rent is due every Saturday at noon.</p>' +
      onboardView(o) +
      (lives().length ? '<div class="field"><span class="label">Your past lives · best scores</span>' + livesView(5) + '</div>' : '') +
      (online.db && online.fame.length ? '<div class="field">' + fameView().replace('<div class="section">', '<div>') + '</div>' : '') +
      '<div class="lottery weekly"><span class="label">Weekly Lagos ' + esc(thisWeek()) + '</span><b>Same Lagos for everybody</b><p style="margin:0">One shared seed this week: the same start, the same events. 4 weeks, highest net worth wins, and every run is replayed to check it.</p>' +
      '<div class="inline"><button class="btn go" id="w-play-intro" data-wplay="1">' + (weeklyRun() ? 'Resume this week\'s Lagos' : 'Play this week\'s Lagos') + '</button></div></div>' +
      '<details class="import"><summary>Continue from a save code</summary><textarea id="import-code" aria-label="Paste save code" placeholder="LSG1...."></textarea><div class="inline"><button class="btn sm" id="import" data-import="1">Load save</button><span class="note">' + esc(ui.importMsg) + '</span></div></details>' +
      '<details class="import"><summary>🛡️ Safety and privacy</summary>' + safetyCard() + '</details>' +
      '<p class="note">Lasgidi is a work of fiction. In-game naira has no real value and cannot be bought or cashed out.</p>' +
      '</div>';
  }

  /* ---------- new-player setup: Profile, Look, Personality, Dream, Birth lottery, Home ---------- */
  // Your identity is your claude.ai account: there is no password or email field anywhere in the game.
  var ONB_STEPS = ['Profile', 'Look', 'Personality', 'Dream', 'Birth lottery', 'Home'];
  function onb() { return ui.onb || (ui.onb = { step: 0, name: ui.draftName || 'Ade', adult: false, look: { skin: 2, hair: 0, shape: 1 }, outfit: { top: 'st_tee', bottom: 'st_jeans' }, traits: [], goal: null, home: null }); }
  function onbValid(o, step) {
    if (step === 0) return o.name.trim().length > 0 && o.adult;
    if (step === 2) return o.traits.length === 2;
    if (step === 3) return !!o.goal;
    if (step === 4) return !!ui.draftOrigin;
    if (step === 5) return !!o.home;
    return true;
  }
  function onboardView(orig) {
    var o = onb(), st = o.step, body = '';
    if (st === 0) body = '<h2>Who are you in Lagos?</h2>' +
      '<div class="field"><label class="label" for="pname">Your name in the game</label><input id="pname" maxlength="24" value="' + esc(o.name) + '" autocomplete="off"></div>' +
      '<p class="note">Other players see you as <b>' + esc(window.LasgidiChat ? window.LasgidiChat.handle(o.name) : o.name) + '</b>. Your account is your claude.ai sign-in: Lasgidi never asks for a password or an email.</p>' +
      '<label class="onb-check"><input type="checkbox" id="onb-adult"' + (o.adult ? ' checked' : '') + '> I am 18 or older</label>';
    else if (st === 1) body = '<h2>Your look</h2><div class="onb-look"><canvas id="onb-av" width="180" height="220" aria-label="Your avatar"></canvas><div>' +
      '<span class="label">Skin tone</span><div class="pick">' + D.LOOKS.skin.map(function (c, i) { return '<button type="button" class="pick-c' + (o.look.skin === i ? ' on' : '') + '" id="onb-sk-' + i + '" data-onbskin="' + i + '" aria-label="Skin tone ' + (i + 1) + '" aria-pressed="' + (o.look.skin === i) + '" style="background:' + c + '"></button>'; }).join('') + '</div>' +
      '<span class="label">Hairstyle</span><div class="pick">' + D.LOOKS.hair.map(function (h, i) { return '<button type="button" class="pg-chip' + (o.look.hair === i ? ' sel' : '') + '" id="onb-hr-' + i + '" data-onbhair="' + i + '">' + esc(h) + '</button>'; }).join('') + '</div>' +
      '<span class="label">Body</span><div class="pick">' + D.LOOKS.shape.map(function (h, i) { return '<button type="button" class="pg-chip' + (o.look.shape === i ? ' sel' : '') + '" id="onb-sh-' + i + '" data-onbshape="' + i + '">' + esc(h) + '</button>'; }).join('') + '</div>' +
      ['top', 'bottom'].map(function (slot) { return '<span class="label">' + (slot === 'top' ? 'Top (fabric and colour)' : 'Bottoms') + '</span><div class="pick">' + Object.keys(D.CLOTHES).filter(function (k) { return D.CLOTHES[k].starter && D.CLOTHES[k].slot === slot; }).map(function (k) { var C = D.CLOTHES[k], on = o.outfit[slot] === k; return '<button type="button" class="pg-chip onb-cloth' + (on ? ' sel' : '') + '" id="onb-cl-' + k + '" data-onbcloth="' + slot + ':' + k + '" aria-pressed="' + on + '"><i style="background:' + (C.alt ? 'linear-gradient(135deg,' + C.color + ' 55%,' + C.alt + ' 55%)' : C.color) + '"></i>' + esc(C.name.replace(/ \(starter\)/, '')) + '</button>'; }).join('') + '</div>'; }).join('') +
      '<button type="button" class="btn sm ghost" id="onb-shuffle" data-onb="shuffle">🎲 Shuffle</button><p class="note">Your first outfit is free. Lace, agbada, office wear and more come later from the markets and boutiques.</p></div></div>';
    else if (st === 2) body = '<h2>Your personality</h2><p class="note">Pick exactly two. Each gives a small head start.</p><div class="onb-grid">' + Object.keys(D.TRAITS).map(function (k) {
      var T = D.TRAITS[k], on = o.traits.indexOf(k) >= 0, full = o.traits.length >= 2 && !on;
      return '<button type="button" class="onb-card' + (on ? ' sel' : '') + '" id="onb-tr-' + k + '" data-onbtrait="' + k + '" aria-pressed="' + on + '"' + (full ? ' disabled' : '') + '><span class="onb-e">' + T.icon + '</span><b>' + esc(T.name) + '</b><small>' + esc(T.text) + '</small></button>';
    }).join('') + '</div><p class="onb-count">' + o.traits.length + ' of 2 chosen</p>';
    else if (st === 3) body = '<h2>Your dream</h2><p class="note">Pick one. You can still do everything else.</p><div class="onb-grid">' + Object.keys(D.GOALS).map(function (k) {
      var G = D.GOALS[k], on = o.goal === k;
      return '<button type="button" class="onb-card' + (on ? ' sel' : '') + '" id="onb-goal-' + k + '" data-onbgoal="' + k + '" aria-pressed="' + on + '"><b>' + esc(G.name) + '</b><small>' + esc(G.text) + '</small></button>';
    }).join('') + '</div>';
    else if (st === 4) body = '<h2>The birth lottery</h2><div class="lottery">' + (orig ? '<b>' + esc(orig.name) + '</b><p style="margin:0">' + esc(orig.text) + '</p>' : '<p style="margin:0">Lagos decides where you start. The roll is random and happens once per life.</p>') +
      '<div class="odds"><span>LAPO Baby 50%</span><span>Ajepako 35%</span><span>Nepo Baby 15%</span></div>' + (orig ? '' : '<div class="inline"><button class="btn go" id="roll" data-roll="1">Roll the birth lottery</button></div>') + '</div>';
    else {
      var homes = (orig && D.START_HOMES[ui.draftOrigin]) || [];
      body = '<h2>Your first home</h2><p class="note">' + (orig ? esc(orig.name) + ': these are the homes your start can pay for.' : 'Roll the birth lottery first.') + ' Rent is due every Saturday at noon.</p><div class="onb-grid">' + homes.map(function (k) {
        var H = D.HOMES[k], on = o.home === k;
        return '<button type="button" class="onb-card' + (on ? ' sel' : '') + '" id="onb-home-' + k + '" data-onbhome="' + k + '" aria-pressed="' + on + '">' + (icon3d('h_' + (H.type === 'flat2' || H.type === 'flat3' ? 'flat' : H.type)) || '<span class="onb-e">🏠</span>') + '<b>' + esc(H.name) + '</b><small>' + esc(D.DISTRICTS[H.district].name) + ' · ' + N(H.rent) + ' a week · light ' + Math.round(H.power * 100) + '%</small></button>';
      }).join('') + '</div>';
    }
    var ok = onbValid(o, st), last = st === ONB_STEPS.length - 1;
    return '<section class="onb" aria-label="Set up your life"><ol class="onb-steps">' + ONB_STEPS.map(function (n, i) { return '<li class="' + (i < st ? 'done' : i === st ? 'now' : '') + '"><span>' + (i < st ? '✓' : i + 1) + '</span>' + esc(n) + '</li>'; }).join('') + '</ol>' +
      '<div class="onb-body">' + body + '</div><div class="onb-nav">' + (st ? '<button type="button" class="btn ghost" id="onb-back" data-onb="back">Back</button>' : '<span></span>') +
      (last ? '<button class="btn go" id="start" data-start="1"' + (ok ? '' : ' disabled') + '>🔑 Move in</button>' : '<button type="button" class="btn go" id="onb-next" data-onb="next"' + (ok ? '' : ' disabled') + '>Next</button>') + '</div></section>';
  }
  function bindIntro() {
    var av = document.getElementById('onb-av');
    if (av && window.LasgidiAvatar) { try { window.LasgidiAvatar.draw(av, onb().look, onb().outfit); } catch (e) {} }
    var name = document.getElementById('pname');
    if (name && ui.draftName != null) name.value = ui.draftName;
    if (ui.draftGoal) { var g = document.getElementById('goal-' + ui.draftGoal); if (g) g.checked = true; }
  }

  function introState() {
    var o = onb(), name = document.getElementById('pname');
    if (name) o.name = name.value;
    ui.draftName = o.name; ui.draftGoal = o.goal || 'freestyle';
  }

  /* ---------- events ---------- */
  function amount() {
    var el = document.getElementById('amt');
    return el ? parseInt(String(el.value).replace(/[^\d]/g, ''), 10) || 0 : 0;
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-venue],[data-venueclose],[data-tab],[data-go],[data-travel],[data-clear-sel],[data-act],[data-wait],[data-apply],[data-quit],[data-bank],[data-arrears],[data-move],[data-ajo],[data-loan],[data-repay],[data-buyb],[data-sellb],[data-visit],[data-buyp],[data-car],[data-choice],[data-copy],[data-new],[data-roll],[data-start],[data-import],[data-wonok],[data-repok],[data-copyshare],[data-sound],[data-postfame],[data-wed],[data-placecat],[data-place],[data-closeplace],[data-closeboard],[data-tripto],[data-ademoji],[data-adcolor],[data-adpost],[data-boardsel],[data-wplay],[data-wlife],[data-wclose],[data-wpost],[data-wrestart],[data-wresult],[data-homesel],[data-plotsel],[data-closepick],[data-buyplot],[data-irot],[data-istore],[data-isell],[data-idone],[data-iplace],[data-buyitem],[data-shopcat],[data-vehkind],[data-buyveh],[data-sellveh],[data-lookskin],[data-lookshape],[data-wear],[data-takeoff],[data-clothslot],[data-buycloth],[data-dealertab],[data-drive],[data-bondamt],[data-banktab],[data-buybond],[data-topup],[data-upb],[data-hmb],[data-fmb],[data-adplan],[data-adunsub],[data-picpay],[data-picsubmit],[data-picsponsor],[data-rvok],[data-rvno],[data-gem],[data-fly],[data-app],[data-wave],[data-visit2],[data-gift],[data-opengift],[data-tour],[data-quest],[data-famecity],[data-stock],[data-stockbuy],[data-stocksell],[data-streak],[data-party],[data-hirestaff],[data-firestaff],[data-buypet],[data-rehome],[data-hmo],[data-hmooff],[data-shopopen],[data-shoprestock],[data-shopads],[data-shopclose],[data-buyphone],[data-title],[data-partyplan],[data-joinparty],[data-partyact],[data-bell],[data-minigame],[data-danfodriver],[data-haggle],[data-hagoffer],[data-japa],[data-japaseen],[data-seaclose],[data-seaopen],[data-seago],[data-seapickfree],[data-seasize],[data-seabuy],[data-searelease],[data-srok],[data-srno],[data-setpref],[data-vote],[data-nysc],[data-lodge],[data-kid],[data-treat],[data-heir],[data-service],[data-interview],[data-ivsubmit],[data-build],[data-skit],[data-golive],[data-photooff],[data-phok],[data-phno],[data-govvote],[data-govmotto],[data-govrun],[data-govtab],[data-govplank],[data-govjoin],[data-govmate],[data-govprimary],[data-govcamp],[data-govconfirm],[data-ridemode],[data-shareplace],[data-deptab],[data-depcity],[data-depcabin],[data-flyclass],[data-flyjet],[data-chopper],[data-chopcity],[data-chatq],[data-chatopen],[data-chatsend],[data-chatmute],[data-closechat],[data-reportopen],[data-reportsend],[data-cvshare],[data-cvfor],[data-cvopen],[data-joinclub],[data-clubact],[data-hpbuild],[data-roomenter],[data-roomopen],[data-roomspot],[data-roomleave],[data-roomnight],[data-roomhang],[data-copytext],[data-shopbuy],[data-shopequip],[data-shopadult],[data-mappop],[data-mappopclose],[data-roomclose],[data-roomsend],[data-roomfold],[data-layer],[data-airportopen],[data-airportclose],[data-airportgo],[data-fidstab],[data-fishrod],[data-fishcast],[data-fishsell],[data-fishcook],[data-photo],[data-photoclose],[data-photosave],[data-photoretake],[data-cruisefold],[data-cruiseboard],[data-cruiseopen],[data-cruisespot],[data-cruiseleave],[data-cruiseclose],[data-decksend],[data-onb],[data-onbskin],[data-onbhair],[data-onbshape],[data-onbtrait],[data-onbgoal],[data-onbhome],[data-onbcloth],[data-wwset],[data-wwextra],[data-wwbook],[data-wwhold],[data-wwopen]');
    if (!t || t.disabled) return;
    var ds = t.dataset;
    if (ds.wwopen) { ui.wwOpen = !ui.wwOpen; return; }
    if (ds.wwset) { var ws = ds.wwset.split(':'); wwDraft()[ws[0]] = ws[1]; ui.wwOpen = true; render(); return; }
    if (ds.wwextra) { var wx = wwDraft().extras, wi = wx.indexOf(ds.wwextra); if (wi >= 0) wx.splice(wi, 1); else wx.push(ds.wwextra); ui.wwOpen = true; render(); return; }
    if (ds.wwbook) { run(function () { return L.planWhiteWedding(S, wwDraft()); }); return; }
    if (ds.wwhold) { run(function () { var r = L.holdWhiteWedding(S); if (r.ok) openParty('wedding', S.wwPlan && S.wwPlan.plan.planner !== 'none'); return r; }); return; }
    if (ds.onb) {
      var o0 = onb(); introState();
      if (ds.onb === 'next' && onbValid(o0, o0.step)) o0.step = Math.min(ONB_STEPS.length - 1, o0.step + 1);
      else if (ds.onb === 'back') o0.step = Math.max(0, o0.step - 1);
      else if (ds.onb === 'shuffle') { var rr = function (n) { return Math.floor(Math.random() * n); }; o0.look = { skin: rr(D.LOOKS.skin.length), hair: rr(D.LOOKS.hair.length), shape: rr(D.LOOKS.shape.length) }; var sts = function (sl) { return Object.keys(D.CLOTHES).filter(function (k) { return D.CLOTHES[k].starter && D.CLOTHES[k].slot === sl; }); }, tp = sts('top'), bt = sts('bottom'); o0.outfit = { top: tp[rr(tp.length)], bottom: bt[rr(bt.length)] }; }
      render(); var nx = document.getElementById(ds.onb === 'back' ? 'onb-back' : 'onb-next') || document.getElementById('start'); if (nx && ds.onb !== 'shuffle') nx.focus(); return;
    }
    if (ds.onbskin != null && t.hasAttribute('data-onbskin')) { onb().look.skin = +ds.onbskin; render(); return; }
    if (ds.onbhair != null && t.hasAttribute('data-onbhair')) { onb().look.hair = +ds.onbhair; render(); return; }
    if (ds.onbshape != null && t.hasAttribute('data-onbshape')) { onb().look.shape = +ds.onbshape; render(); return; }
    if (ds.onbtrait) { var tr0 = onb().traits, ti0 = tr0.indexOf(ds.onbtrait); if (ti0 >= 0) tr0.splice(ti0, 1); else if (tr0.length < 2) tr0.push(ds.onbtrait); render(); return; }
    if (ds.onbcloth) { var oc = ds.onbcloth.split(':'); onb().outfit[oc[0]] = oc[1]; render(); return; }
    if (ds.onbgoal) { onb().goal = ds.onbgoal; render(); return; }
    if (ds.onbhome) { onb().home = ds.onbhome; render(); return; }
    if (ds.roll) {
      introState();
      ui.seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) | 0;
      ui.draftOrigin = L.newGame({ seed: ui.seed }).origin;
      render(); var st = document.getElementById('start'); if (st) st.focus();
      return;
    }
    if (ds.heir) {
      var hw = heirsWaiting()[+ds.heir || 0];
      try { localStorage.removeItem(HEIR_KEY); } catch (err) { /* ignore */ }
      if (ds.heir === 'skip' || !hw) { render(); return; }
      introState();
      S = L.newGame({ name: hw.name, goal: ui.draftGoal, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) | 0, origin: 'heir', heir: hw });
      ui.tab = 'map'; ui.sel = null; ui.draftOrigin = null;
      releaseOldSea();
      save(); render(); return;
    }
    if (ds.start) {
      introState();
      var ob = onb();
      S = L.newGame({ name: ui.draftName.trim() || 'Ade', goal: ui.draftGoal, seed: ui.seed, traits: ob.traits.length === 2 ? ob.traits : undefined, startHome: ob.home || undefined, look: ob.look, outfit: ob.outfit });
      ui.tab = 'map'; ui.sel = null; ui.draftOrigin = null; ui.onb = null;
      releaseOldSea();
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
    if (ds.tab) { ui.tab = ds.tab; ui.flash = ''; if (t.hasAttribute('data-app')) ui.app = ds.app || null; if (ds.tripto) { clearPicks(); ui.sel = ds.tripto === S.loc ? null : ds.tripto; } if (ds.seaopen) { clearPicks(); ui.seaOpen = true; } if (ds.place && t.hasAttribute('data-place')) { clearPicks(); ui.place = ds.place; } if (t.hasAttribute('data-placecat')) { clearPicks(); ui.placeCat = ds.placecat || null; } render(); if (ds.seaopen && playground && playground.focusSea) playground.focusSea(); return; }
    if (ds.go) { ui.sel = ds.go === S.loc ? null : ds.go; ui.place = null; ui.board = null; render(); return; }
    if (ds.placecat !== undefined) { ui.placeCat = ds.placecat || null; render(); return; }
    if (ds.place) { ui.place = ds.place; ui.board = null; ui.mapPop = null; ui.sel = null; render(); return; }
    if (ds.lookskin !== undefined) { run(function () { return L.setLook(S, +ds.lookskin, S.look.hair, S.look.shape); }); return; }
    if (ds.lookshape !== undefined) { run(function () { return L.setLook(S, S.look.skin, S.look.hair, +ds.lookshape); }); return; }
    if (ds.wear) { run(function () { return L.wear(S, ds.wear); }); return; }
    if (ds.takeoff) { run(function () { return L.takeOff(S, ds.takeoff); }); return; }
    if (ds.clothslot) { ui.clothSlot = ds.clothslot; render(); return; }
    if (ds.buycloth) { run(function () { return L.buyClothes(S, ds.buycloth); }); return; }
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
    if (ds.app != null && t.hasAttribute('data-app')) { ui.app = ds.app || null; render(); var tb = document.querySelector('.tab-body'); if (tb) tb.scrollTop = 0; return; }
    if (ds.tour) { setTour(+ds.tour); render(); return; }
    if (ds.quest) { goQuest(ds.quest); return; }
    if (ds.hirestaff) { var hk = ds.hirestaff; run(function () { return L.hireStaff(S, hk); }); return; }
    if (ds.firestaff) { var fk = ds.firestaff; run(function () { return L.fireStaff(S, fk); }); return; }
    if (ds.buypet) { var bp = ds.buypet; run(function () { return L.buyPet(S, bp); }); return; }
    if (ds.rehome) { var rp = ds.rehome; run(function () { return L.rehomePet(S, rp); }); return; }
    if (ds.hmo) { var hp = ds.hmo; run(function () { return L.joinHmo(S, hp); }); return; }
    if (ds.hmooff) { run(function () { return L.leaveHmo(S); }); return; }
    if (ds.title) { var tt = ds.title; run(function () { return L.takeTitle(S, tt); }); return; }
    if (ds.buyphone) { var bph = ds.buyphone; run(function () { return L.buyPhone(S, bph); }); return; }
    if (ds.shopopen) { var so = ds.shopopen; run(function () { return L.openShop(S, so); }); return; }
    if (ds.shoprestock) { var sr = +ds.shoprestock; run(function () { return L.restockShop(S, sr); }); return; }
    if (ds.shopads) { var sa = ds.shopads; run(function () { return L.setShopAds(S, sa); }); return; }
    if (ds.shopclose) { run(function () { return L.closeShop(S); }); return; }
    if (ds.party || ds.partyplan) {
      var pk = ds.party || ds.partyplan, plan = !!ds.partyplan;
      run(function () {
        var r = L.hostParty(S, pk, plan);
        if (r.ok) openParty(pk, plan);
        return r;
      });
      return;
    }
    if (ds.seaopen) { clearPicks(); ui.seaOpen = true; render(); if (playground && playground.focusSea) playground.focusSea(); return; }
    if (ds.seago) { var sg = ds.seago.split(','); ui.seaSel = { x: +sg[0], y: +sg[1], w: 2, h: 2 }; ui.seaOpen = true; render(); return; }
    if (ds.seapickfree) { ui.seaSel = null; render(); return; }
    if (ds.seaclose) { ui.seaOpen = false; ui.seaSel = null; render(); return; }
    if (ds.seasize) { var sz = ds.seasize.split('x'); if (ui.seaSel) { ui.seaSel.w = +sz[0]; ui.seaSel.h = +sz[1]; } render(); return; }
    if (ds.seabuy) {
      var sel = seaSel(); if (!sel || sel.bad) return;
      run(function () {
        var r = L.buySeaPlots(S, sel.x, sel.y, sel.w, sel.h);
        if (r.ok && online.db && online.me) online.db.doc('sea/' + online.me).set({ x: sel.x, y: sel.y, w: sel.w, h: sel.h, at: Date.now() }).catch(function () { online.seaStatus = 'Saved in your life, but the shared map refused it.'; render(); });
        if (r.ok) ui.seaSel = null;
        return r;
      });
      return;
    }
    if (ds.searelease) { run(function () { var r = L.releaseSeaPlots(S); if (r.ok && online.db && online.me) online.db.doc('sea/' + online.me).set({ x: 0, y: 0, w: 0, h: 0, at: Date.now() }).catch(function () {}); return r; }); return; }
    if (ds.photooff && online.db && online.me) { online.db.doc('photooff/' + online.me).set({ off: ds.photooff === '1', at: Date.now() }).catch(function () { online.photoStatus = 'That could not be saved. Try again.'; render(); }); return; }
    if ((ds.phok || ds.phno) && online.db && online.canEdit) {
      var pid = ds.phok || ds.phno, pr = (online.photoreview || []).filter(function (x) { return x.id === pid; })[0];
      if (!pr) return;
      if (ds.phno) { online.db.doc('photoreview/' + pid).update({ status: 'rejected' }).then(function () { render(); }, function () {}); return; }
      online.db.doc('photo/' + pid).set({ img: pr.raw.img, approvedAt: Date.now() }).then(function () { return online.db.doc('photoreview/' + pid).update({ status: 'approved' }); }).then(function () { render(); }, function () {});
      return;
    }
    if (ds.srok || ds.srno) {
      var rid = ds.srok || ds.srno, rr = (online.seareview || []).filter(function (x) { return x.id === rid; })[0];
      if (!rr || !online.db) return;
      if (ds.srno) { online.db.doc('seareview/' + rid).update({ status: 'rejected' }).then(function () { render(); }); return; }
      online.db.doc('seaimg/' + rid).set({ img: rr.raw.img, x: rr.raw.x, y: rr.raw.y, w: rr.raw.w, h: rr.raw.h, approvedAt: Date.now() })
        .then(function () { return online.db.doc('seareview/' + rid).update({ status: 'approved' }); }).then(function () { render(); }, function () {});
      return;
    }
    if (ds.japa) { var jd = ds.japa; run(function () { return L.japaFly(S, jd); }); return; }
    if (ds.japaseen) { S.japaSeen = true; S.wonSeen = true; save(); render(); return; }
    if (ds.haggle) { ui.haggle = ui.haggle && ui.haggle.id === ds.haggle ? null : { id: ds.haggle }; render(); return; }
    if (ds.hagoffer && ui.haggle) {
      var hid = ui.haggle.id, off = +ds.hagoffer;
      run(function () { var r = L.haggleBuy(S, hid, off); if (r.ok) ui.haggle = null; else ui.haggle = { id: hid, msg: r.msg, counter: r.counter }; return r; });
      return;
    }
    if (ds.danfodriver) { var dv = ds.danfodriver === '1'; run(function () { return L.setDanfoDriver(S, dv); }); return; }
    if (ds.minigame) { openMinigame(ds.minigame); return; }
    if (ds.nysc) { var nk = ds.nysc; run(function () { return nk === 'register' ? L.nyscRegister(S) : nk === 'camp' ? L.nyscCamp(S) : nk === 'cds' ? L.nyscCDS(S) : nk === 'retain' ? L.nyscRetain(S) : L.nyscWork(S); }); return; }
    if (ds.skit) { var sk = ds.skit; run(function () { return L.shootSkit(S, sk); }); return; }
    if (ds.golive) { run(function () { return L.goLive(S); }); return; }
    if (ds.build) { run(function () { return L.buildStage(S); }); return; }
    if (ds.service) { run(function () { return L.serviceCars(S); }); return; }
    if (ds.treat) { run(function () { return L.treatMalaria(S); }); return; }
    if (ds.kid) { var kp = ds.kid.split(':'), ki = +kp[1]; run(function () { return kp[0] === 'hw' ? L.helpHomework(S, ki) : L.kidOuting(S, ki); }); return; }
    if (ds.lodge) { var lg = ds.lodge; run(function () { return L.sleepAway(S, lg); }); return; }
    if (ds.joinparty) { ui.visit = ds.joinparty; ui.tab = 'do'; render(); syncPresence(); return; }
    if (ds.partyact) {
      var host = ui.visit, pt2 = host && partyOf(host), act = ds.partyact;
      if (!pt2) return;
      run(function () { return L.joinParty(S, host + ':' + pt2.at, act); });
      return;
    }
    if (ds.bell) {
      if (!online.room) return;
      online.room.emit('wave', { to: ds.bell, bell: true }).then(function () { ui.toasts.push({ msg: '🔔 Ding dong! ' + nameOf(ds.bell) + ' knows you are here.', ok: true }); render(); }, function () {});
      return;
    }
    if (ds.streak) { var sid = gemToday(); run(function () { return L.claimStreak(S, sid); }); return; }
    if (ds.stock) { ui.stock = ui.stock === ds.stock ? null : ds.stock; render(); return; }
    if (ds.stockbuy) { var sb = ds.stockbuy.split(':'); run(function () { return L.buyStock(S, sb[0], +sb[1]); }); return; }
    if (ds.stocksell) { var sl = ds.stocksell.split(':'); run(function () { return L.sellStock(S, sl[0], +sl[1]); }); return; }
    if (ds.famecity != null && t.hasAttribute('data-famecity')) { ui.fameCity = ds.famecity || null; render(); return; }
    if (ds.wave) {
      var wid = ds.wave; if (!online.room) return;
      online.waved[wid] = Date.now();
      online.room.emit('wave', { to: wid }).then(function () { ui.toasts.push({ msg: '👋 You waved at ' + nameOf(wid) + '.', ok: true }); render(); }, function () { ui.toasts.push({ msg: 'Waving is not open here yet.', ok: false }); render(); });
      render(); return;
    }
    if (t.hasAttribute('data-visit2')) { ui.visit = ds.visit2 || null; ui.tab = 'do'; render(); syncPresence(); return; }
    if (ds.gift) {
      var to = ds.gift, sel = document.getElementById('giftsel-' + to), gid2 = sel ? sel.value : 'suya';
      var gr = L.sendGift(S, gid2);
      if (!gr.ok) { run(function () { return gr; }); return; }
      online.db.doc('gifts/' + online.me).set({ to: to, gift: gid2, at: Date.now() })
        .then(function () { run(function () { return { ok: true, msg: D.GIFTS[gid2].icon + ' Gift sent to ' + nameOf(to) + '.' }; }); }, function () { run(function () { return { ok: false, msg: 'Paid, but the gift could not be delivered. Try again.' }; }); });
      save(); return;
    }
    if (ds.opengift) {
      var gx = online.giftsIn.filter(function (x) { return x.from === ds.opengift; })[0];
      if (gx) run(function () { return L.openGift(S, gx.from + ':' + gx.raw.at, gx.raw.gift); });
      return;
    }
    if (ds.fly) { var fp = ds.fly.split(':'); run(function () { var r = L.intercity(S, fp[0], fp[1]); if (r.ok) { ui.sel = null; ui.place = null; ui.placeCat = null; } return r; }, 'travel'); return; }
    if (ds.gem) { var gid = gemToday(), gn = +ds.gem; run(function () { return L.collectGem(S, gid, gn); }); return; }
    if (ds.picsubmit) {
      var draft = ui.picDraft, bid = ds.picsubmit, pl = ui.ad.plan || 'day';
      if (!draft) return;
      online.picStatus = 'Sending…'; render();
      online.db.doc('adreview/' + online.me).set({ img: draft, board: bid, plan: pl, sub: randSub(), at: Date.now() })
        .then(function () { ui.picDraft = null; online.picStatus = 'Sent. You will see it here once the owner approves it.'; render(); }, function (err) { online.picStatus = picWriteError(err); render(); });
      return;
    }
    if (ds.picsponsor) {
      var sd = ui.picDraft, sp = D.AD_PLANS[ui.ad.plan || 'day'];
      if (!sd || !online.canEdit) return;
      online.db.doc('sponsored/p' + randSub()).set({ img: sd, board: ds.picsponsor, at: Date.now(), until: Date.now() + sp.days * 24 * 3600e3 })
        .then(function () { ui.picDraft = null; online.picStatus = 'Posted as a sponsored picture for ' + sp.name + '.'; render(); }, function (err) { online.picStatus = picWriteError(err); render(); });
      return;
    }
    if (ds.picpay) {
      var ap = myPicture().approved;
      if (!ap) return;
      t.disabled = true;
      var pr = L.rentBoard(S, ap.board, ap.plan);
      if (!pr.ok) { run(function () { return pr; }); return; }
      online.db.doc('adpaid/' + online.me).set({ sub: ap.sub, board: ap.board, until: Date.now() + pr.days * 24 * 3600e3, at: Date.now() })
        .then(function () { online.picStatus = ''; run(function () { return { ok: true, msg: 'Your picture is on air at ' + boardName(ap.board) + '.' }; }); }, function (err) { run(function () { return { ok: false, msg: 'Paid, but ' + picWriteError(err).toLowerCase() }; }); });
      save(); return;
    }
    if (ds.rvok || ds.rvno) {
      var rid = ds.rvok || ds.rvno, row = online.adreview.filter(function (r) { return r.id === rid; })[0];
      if (!row) return;
      var done = function () { online.adreview = online.adreview.filter(function (r) { return r.id !== rid; }); render(); };
      if (ds.rvno) { online.db.doc('adreview/' + rid).update({ status: 'rejected' }).then(done, function (err) { online.picStatus = picWriteError(err); render(); }); return; }
      var rr = row.raw;
      online.db.doc('adimg/' + rid).set({ img: rr.img, board: rr.board, plan: rr.plan, sub: rr.sub, approvedAt: Date.now() })
        .then(function () { return online.db.doc('adreview/' + rid).update({ status: 'approved' }); })
        .then(done, function (err) { online.picStatus = picWriteError(err); render(); });
      return;
    }
    if (ds.adplan) { ui.ad.plan = ds.adplan; render(); return; }
    if (ds.adunsub) { setAdSub(null); ui.ad.renew = false; online.status = 'Subscription cancelled. Your current ad runs until it ends.'; render(); return; }
    if (ds.adpost) {
      t.disabled = true;
      postAd(ds.adpost).then(function (res) { online.status = res.msg; run(function () { return res; }); });
      return;
    }
    if (ds.clearSel) { ui.sel = null; render(); return; }
    if (ds.travel) { var from0 = S.loc, mode0 = ds.mode, t0 = S.t; run(function () { var r = L.travel(S, ds.travel, ds.mode); if (r.ok) { ui.sel = null; ui.trip = { from: from0, to: S.loc, mode: mode0, at: Date.now() }; showRide(from0, S.loc, mode0, t0); } return r; }, 'travel'); return; }
    if (ds.act) { var aid0 = ds.act; run(function () { var r = L.doAction(S, aid0); if (r && r.ok) { ui.activity = activityFor(aid0); ui.activityAt = Date.now(); } return r; }); return; }
    if (ds.wait) { run(function () { if (S.pending.length) return { ok: false, msg: 'Decide on the open event first.' }; return L.wait(S, 60); }); return; }
    if (ds.apply) { run(function () { var r = L.applyJob(S, ds.apply); if (r && r.interview) { ui.interview = r.interview; ui.tab = 'work'; } return r; }); return; }
    if (ds.interview !== undefined) { ui.interview = ds.interview || null; render(); return; }
    if (ds.ivsubmit) {
      var ivc = ds.ivsubmit, picks = [0, 1, 2].map(function (i) { var el = document.querySelector('input[name="iv-' + i + '"]:checked'); return el ? +el.value : -1; });
      run(function () { var r = L.interviewJob(S, ivc, picks[0], picks[1], picks[2]); if (r.ok) ui.interview = null; return r; });
      return;
    }
    if (ds.quit) { run(function () { return L.quitJob(S); }); return; }
    if (ds.upb) { run(function () { return L.upgradeBusiness(S, +ds.upb); }); return; }
    if (ds.hmb) { run(function () { return L.hireManager(S, +ds.hmb); }); return; }
    if (ds.fmb) { run(function () { return L.fireManager(S, +ds.fmb); }); return; }
    if (ds.dealertab) { ui.dealerTab = ds.dealertab; render(); return; }
    if (ds.drive) { run(function () { return L.driveVehicle(S, +ds.drive); }); return; }
    if (ds.banktab) { ui.bankTab = ds.banktab; render(); return; }
    if (ds.bondamt) { var el = document.getElementById('amt'); if (el) el.value = ds.bondamt; return; }
    if (ds.buybond) { var ba = amount(); run(function () { return L.buyBond(S, ba); }); return; }
    if (ds.topup) { var ta = amount(); run(function () { return L.withdraw(S, ta); }); return; }
    if (ds.bank) { var a = amount(); run(function () { return ds.bank === 'dep' ? L.deposit(S, a) : L.withdraw(S, a); }); return; }
    if (ds.arrears) { run(function () { return L.payArrears(S); }); return; }
    if (ds.move) { run(function () { return L.moveHouse(S, ds.move); }); return; }
    if (ds.ajo) { run(function () { return L.joinAjo(S, +ds.ajo); }); return; }
    if (ds.loan) { var la = amount(); run(function () { return L.takeLoan(S, ds.loan, la); }); return; }
    if (ds.repay) { run(function () { var l = S.loans[+ds.repay]; return L.repayLoan(S, +ds.repay, l ? l.bal : 0); }); return; }
    if (ds.buyb) { var site = ui.bizSite || (D.BUSINESS_SITES[S.loc] ? S.loc : 'surulere'); run(function () { return L.buyBusiness(S, ds.buyb, site); }); return; }
    if (ds.sellb) { run(function () { return L.sellBusiness(S, +ds.sellb); }); return; }
    if (ds.visit) { run(function () { return L.visitBusinesses(S); }); return; }
    if (ds.buyp) { run(function () { return L.buyProperty(S, ds.buyp); }); return; }
    if (ds.car) { run(function () { return L.buyCar(S); }); return; }
    if (ds.choice) { run(function () { return L.resolveChoice(S, +ds.choice); }); return; }
    if (ds.wonok) { S.wonSeen = true; save(); render(); return; }
    if (ds.wed) { run(function () { var r = L.marry(S, ds.wed); if (r.ok && S.partner && S.partner.stage === 'married') openParty('wedding', ds.wed !== 'registry'); return r; }); return; }
    if (ds.postfame) {
      t.disabled = true;
      postFame(L.fameEntry(S)).then(function (msg) { online.status = msg || ''; render(); });
      return;
    }
    if (ds.ridemode) { ui.rideMode = ds.ridemode; render(); return; }
    if (ds.chatopen) { clearPicks(); ui.chatWith = ds.chatopen; online.unread[ds.chatopen] = 0; ui.tab = 'map'; render(); return; }
    if (ds.cruiseboard) { run(function () { var r = L.cruiseBoard(S); if (r.ok) { ui.cruiseOpen = true; ui.airportOpen = false; } return r; }); syncPresence(); return; }
    if (ds.cruiseopen) { ui.cruiseOpen = true; ui.airportOpen = false; render(); return; }
    if (ds.cruisespot) { var csp = ds.cruisespot; if (S.cruise && S.cruise.spot === csp) return; run(function () { return L.cruiseSpot(S, csp); }); syncPresence(); return; }
    if (ds.cruiseleave) { ui.cruiseOpen = false; run(function () { return L.cruiseLeave(S); }); syncPresence(); return; }
    if (ds.cruiseclose) { ui.cruiseOpen = false; render(); return; }
    if (ds.decksend) { var di = document.getElementById('deck-in'); sendDeck(di ? di.value : ''); return; }
    if (ds.fishrod) { run(function () { return L.buyRod(S); }); return; }
    if (ds.fishcast) { run(function () { var r = L.fish(S); if (r.ok && S.cruise && L.cruiseAboard(S)) S.cruise.last = r.msg; return r; }); return; }
    if (ds.fishsell) { run(function () { return L.sellFish(S); }); return; }
    if (ds.fishcook) { run(function () { return L.cookFish(S); }); return; }
    if (ds.photo) { ui.photoFrom = ds.photo; if (ds.photo === 'cruise') takePhoto(document.querySelector('#cruise-view .cruise-canvas'), 'Lagoon Boat Cruise'); else if (ds.photo === 'airport') takePhoto(document.querySelector('.airport-canvas'), ui.airportName || 'Airport'); else if (ds.photo === 'room') takePhoto(document.querySelector('#room-view .cruise-canvas'), D.ROOMS[S.room.id].name); else takePhoto(document.querySelector('.pg-canvas'), D.DISTRICTS[S.loc].name); return; }
    if (ds.photoretake) { var pv = document.getElementById('photo-view'); if (pv) pv.remove(); setTimeout(function () { if (ui.photoFrom === 'cruise') takePhoto(document.querySelector('#cruise-view .cruise-canvas'), 'Lagoon Boat Cruise'); else takePhoto(document.querySelector('.pg-canvas'), D.DISTRICTS[S.loc].name); }, 80); return; }
    if (ds.photoclose) { ui.photo = null; var pv2 = document.getElementById('photo-view'); if (pv2) pv2.remove(); return; }
    if (ds.photosave) { savePhoto(); return; }
    if (ds.cruisefold) { ui.cruiseFold = !ui.cruiseFold; mountCruise(); return; }
    if (ds.airportopen) { var apl = D.PLACES.filter(function (p) { return p.id === ds.airportopen; })[0]; ui.airportPlace = ds.airportopen; ui.airportName = apl ? apl.name : 'Airport'; ui.airportOpen = true; ui.cruiseOpen = false; render(); return; }
    if (ds.airportclose) { ui.airportOpen = false; render(); return; }
    if (ds.airportgo) { airportGo(ds.airportgo); return; }
    if (ds.fidstab) { ui.fidsTab = ds.fidstab; mountAirport(); return; }
    if (ds.layer) { var ly = mapLayers(); ly[ds.layer] = !ly[ds.layer]; try { localStorage.setItem(LAYER_KEY, JSON.stringify(ly)); } catch (e) {} render(); return; }
    if (ds.roomenter) { var re0 = ds.roomenter; run(function () { var r = L.roomEnter(S, re0); if (r.ok) { ui.roomOpen = re0; ui.cruiseOpen = false; ui.airportOpen = false; } return r; }); syncPresence(); return; }
    if (ds.venue) { ui.venueOpen = ds.venue; ui.venueSlot = null; ui.cruiseOpen = false; ui.airportOpen = false; render(); return; }
    if (ds.venueclose) { ui.venueOpen = null; render(); return; }
    if (ds.roomopen) { ui.roomOpen = ds.roomopen; ui.cruiseOpen = false; ui.airportOpen = false; render(); return; }
    if (ds.roomspot) { var rsp = ds.roomspot; if (S.room && S.room.spot === rsp) return; run(function () { return L.roomSpot(S, S.room.id, rsp); }); syncPresence(); return; }
    if (ds.mappop) { ui.mapPop = ui.mapPop === 'do' ? null : 'do'; if (ui.mapPop) { ui.place = null; ui.board = null; ui.homeSel = null; } render(); return; }
    if (ds.mappopclose) { ui.mapPop = null; ui.place = null; ui.board = null; ui.homeSel = null; render(); return; }
    if (ds.copytext) { var ct = ds.copytext; try { navigator.clipboard.writeText(ct).then(function () { ui.toasts.push({ msg: 'Copied.', ok: true }); renderToasts(); }, function () {}); } catch (e) {} return; }
    if (ds.shopadult) { ui.shopAdult = !!t.checked; render(); return; }
    if (ds.shopbuy) { var sb = ds.shopbuy.split(':'); shopBuy(sb[0], sb[1]); return; }
    if (ds.shopequip != null && t.hasAttribute('data-shopequip')) { var qk = ds.shopequip.split(':'), qc = online.shop && online.shop.catalog[qk[1]]; if (!qk[1] || (qc && qc.kind === qk[0] && ownedItem(qk[1]))) setWear(qk[0], qk[1] || null); render(); return; }
    if (ds.roomhang) { var rh0 = ds.roomhang; run(function () { return L.roomHang(S, S.room.id, rh0); }); return; }
    if (ds.roomnight) { var rn0 = ds.roomnight; run(function () { return L.roomNight(S, rn0); }); return; }
    if (ds.roomleave) { ui.roomOpen = null; run(function () { return L.roomLeave(S); }); syncPresence(); return; }
    if (ds.roomclose) { ui.roomOpen = null; render(); return; }
    if (ds.roomsend) { var ri = document.getElementById('room-in'); sendRoom(ri ? ri.value : ''); return; }
    if (ds.roomfold) { ui.roomFold = !ui.roomFold; mountRoom(); return; }
    if (ds.hpbuild) { var hz = ds.hpbuild; run(function () { return L.hpBuild(S, hz); }); return; }
    if (ds.joinclub) { var jc = ds.joinclub.split(':'); run(function () { return L.joinClub(S, jc[0], jc[1]); }); return; }
    if (ds.clubact) { var ca = ds.clubact.split(':'); run(function () { return L.clubAct(S, ca[0], ca[1]); }); return; }
    if (ds.cvshare) { shareCv(); return; }
    if (ds.cvfor) { ui.cvFor = ui.cvFor === ds.cvfor ? null : ds.cvfor; render(); return; }
    if (ds.cvopen) { ui.cvOpen = !ui.cvOpen; return; }
    if (ds.reportopen) { ui.reportFor = ui.reportFor === ds.reportopen ? null : ds.reportopen; online.reportStatus = ''; render(); return; }
    if (ds.reportsend) { var rs = ds.reportsend.split(':'); var rr = rs.pop(); sendReport(rs.join(':'), rr); return; }
    if (ds.closechat) { ui.chatWith = null; ui.chatWhy = ''; render(); return; }
    if (ds.chatq != null && t.hasAttribute('data-chatq')) { sendChat(ui.chatWith, CH.QUICK[+ds.chatq]); return; }
    if (ds.chatsend) { var ci = document.getElementById('chat-in'); sendChat(ds.chatsend, ci ? ci.value : ''); return; }
    if (ds.chatmute) { if (online.muted[ds.chatmute]) delete online.muted[ds.chatmute]; else online.muted[ds.chatmute] = 1; try { localStorage.setItem('lasgidi.muted.v1', JSON.stringify(online.muted)); } catch (e) {} render(); return; }
    if (ds.deptab) { ui.depTab = ds.deptab; render(); return; }
    if (ds.depcity) { ui.depCity = ds.depcity; render(); return; }
    if (ds.depcabin) { ui.depCabin = ds.depcabin; render(); return; }
    if (ds.chopcity) { ui.chopCity = ds.chopcity; render(); return; }
    if (ds.flyclass) { var fq = ds.flyclass.split(':'); var f0 = S.loc, t0 = S.t; run(function () { var r = L.flyClass(S, fq[0], fq[1], fq[2] === '1'); if (r.ok) { ui.sel = null; ui.place = null; showRide(f0, S.loc, 'flight', t0); } return r; }, 'travel'); return; }
    if (ds.flyjet) { var fj = ds.flyjet.split(':'); var f1 = S.loc, t1 = S.t; run(function () { var r = L.flyJet(S, fj[0], fj[1] === '1'); if (r.ok) { ui.sel = null; ui.place = null; showRide(f1, S.loc, 'jet', t1); } return r; }, 'travel'); return; }
    if (ds.chopper) { var cp = ds.chopper; var f2 = S.loc, t2 = S.t; run(function () { var r = L.chopperTo(S, cp); if (r.ok) { ui.sel = null; ui.place = cp; showRide(f2, S.loc, 'heli', t2); } return r; }, 'travel'); return; }
    if (ds.shareplace) { var spl = D.PLACES.filter(function (p) { return p.id === ds.shareplace; })[0], stx = 'Meet me at ' + spl.name + ', ' + D.DISTRICTS[spl.district].name + ' in Lasgidi.'; try { navigator.clipboard.writeText(stx).then(function () { t.textContent = '✅ Copied'; }, function () { t.textContent = stx; }); } catch (e) { t.textContent = stx; } return; }
    if (ds.govtab) { ui.govTab = ds.govtab; online.govStatus = ''; render(); return; }
    if (ds.govmotto != null) { ui.govMotto = +ds.govmotto; render(); return; }
    if (ds.govplank) { var pl0 = (ui.govPlanks || (govState(townWeek()).n.candidates.filter(function (c) { return c.id === online.me; })[0] || { planks: [] }).planks).slice(), pi0 = pl0.indexOf(ds.govplank); if (pi0 >= 0) pl0.splice(pi0, 1); else if (pl0.length < 3) pl0.push(ds.govplank); ui.govPlanks = pl0; render(); return; }
    if (ds.govjoin) { govWrite('govparty', { party: ds.govjoin, mate: null, at: Date.now() }, 'You joined ' + G.PARTIES[ds.govjoin].name + '.'); return; }
    if (ds.govmate) { govWrite('govparty', { mate: ds.govmate }, 'You are on the ticket as Deputy Governor.'); return; }
    if (ds.govrun) {
      var st0 = govState(townWeek()), me0 = st0.n.candidates.filter(function (c) { return c.id === online.me; })[0], mp0 = st0.n.members[online.me];
      if (!mp0) { online.govStatus = 'Join a party first.'; render(); return; }
      var cur = me0 || {};
      govWrite('govrun', { party: mp0, motto: ui.govMotto != null ? ui.govMotto : cur.motto || 0, planks: ui.govPlanks || cur.planks || [], deputy: cur.deputyAsk || null, camp: cur.camp || {}, at: me0 ? me0.at : Date.now() }, me0 ? 'Campaign saved.' : 'You declared for governor!');
      ui.govMotto = null; ui.govPlanks = null; return;
    }
    if (ds.govprimary) { govWrite('govprimary', { cand: ds.govprimary, at: Date.now() }, 'Primary vote cast.'); return; }
    if (ds.govcamp) {
      var raw0 = ((online.govrun || []).filter(function (r) { return r.id === online.me; })[0] || {}).raw || {}, day0 = new Date().toISOString().slice(0, 10);
      var camp0 = JSON.parse(JSON.stringify(raw0.camp || {})), cd0 = JSON.parse(JSON.stringify(raw0.campDay || {}));
      if (cd0[ds.govcamp] === day0) return;
      camp0[ds.govcamp] = (camp0[ds.govcamp] || 0) + 1; cd0[ds.govcamp] = day0;
      govWrite('govrun', { camp: camp0, campDay: cd0 }, G.CAMPAIGN[ds.govcamp].name + ' done. The crowd loved it!'); return;
    }
    if (ds.govvote) { govWrite('govvote', { cand: ds.govvote, unit: myUnit(), at: Date.now() }, 'Your vote is in.'); return; }
    if (ds.govconfirm) { var cf = ds.govconfirm.split(':'), oldc = (online.govconfirm || []).filter(function (r) { return r.id === online.me; })[0], ov = oldc && G.weekVal(oldc.raw, townWeek()); var votes0 = JSON.parse(JSON.stringify((ov && ov.week === townWeek() && ov.votes) || {})); votes0[cf[0]] = +cf[1]; govWrite('govconfirm', { votes: votes0 }, 'Assembly vote recorded.'); return; }
    if (ds.vote != null && t.hasAttribute('data-vote')) {
      if (!online.db || !online.me) return;
      var ch = +ds.vote;
      online.db.doc('votes/' + online.me).set({ week: townWeek(), choice: ch, at: Date.now() }).then(function () { online.voteStatus = 'Vote saved.'; render(); }, function () { online.voteStatus = 'Your vote could not be saved.'; render(); });
      return;
    }
    if (ds.setpref) {
      var k = ds.setpref;
      if (k === 'lang') prefs.lang = prefs.lang === 'pcm' ? 'en' : 'pcm'; else prefs[k] = !prefs[k];
      writeJSON(PREF_KEY, prefs); applyPrefs();
      if (k === 'lite') { location.reload(); return; }
      render(); return;
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
      // A life with children can be continued by the eldest (see introView).
      var offer = S && !S.tampered ? L.heirOffers(S) : [];
      if (offer.length) writeJSON(HEIR_KEY, offer); else { try { localStorage.removeItem(HEIR_KEY); } catch (err) { /* ignore */ } }
      archiveLife();
      S = null;
      try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
      render();
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'chat-in') { ui.chatDraft = e.target.value; return; }
    if (e.target && e.target.id === 'pname' && !S) { onb().name = e.target.value.slice(0, 24); var nb = document.getElementById('onb-next'); if (nb) nb.disabled = !onbValid(onb(), onb().step); return; }
    if (e.target && e.target.id === 'chop-q') {
      ui.chopQ = e.target.value.slice(0, 40); render();
      var q = document.getElementById('chop-q'); if (q) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (x) {} }
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'onb-adult') { onb().adult = e.target.checked; render(); return; }
    if (e.target && e.target.id === 'dep-insure') { ui.depInsure = e.target.checked; render(); return; }
    if (e.target && e.target.id === 'gov-deputy') { govWrite('govrun', { deputy: e.target.value || null }, e.target.value ? 'Offer sent to ' + nameOf(e.target.value) + '.' : 'Running mate cleared.'); return; }
    if (e.target && e.target.dataset && e.target.dataset.govappoint) {
      var gw = townWeek(), oc = (online.govcab || []).filter(function (r) { return r.id === online.me; })[0], ov = oc && G.weekVal(oc.raw, gw);
      var posts = JSON.parse(JSON.stringify((ov && ov.week === gw && ov.posts) || {}));
      if (e.target.value) posts[e.target.dataset.govappoint] = e.target.value; else delete posts[e.target.dataset.govappoint];
      govWrite('govcab', { posts: posts }, 'Appointment announced.'); return;
    }
    if (e.target && e.target.id === 'ad-file') {
      var f = e.target.files && e.target.files[0];
      preparePicture(f).then(function (d) { ui.picDraft = d; online.picStatus = ''; render(); }, function (err) { ui.picDraft = null; online.picStatus = err.message; render(); });
    }
    if (e.target && e.target.id === 'photo-file' && online.db && online.me) {
      var pf = e.target.files && e.target.files[0];
      online.photoStatus = 'Preparing your photo…'; render();
      preparePicture(pf, 1).then(function (img) {
        return online.db.doc('photoreview/' + online.me).set({ img: img, at: Date.now() });
      }).then(function () { online.photoStatus = 'Sent for review. Other players see it once an editor approves it.'; render(); }, function (err) { online.photoStatus = (err && err.message) || picWriteError(err); render(); });
      return;
    }
    if (e.target && e.target.id === 'sea-file' && S && S.sea && online.db && online.me) {
      var sf = e.target.files && e.target.files[0], m = S.sea;
      online.seaStatus = 'Preparing your picture…'; render();
      preparePicture(sf, m.w / m.h).then(function (d) {
        return online.db.doc('seareview/' + online.me).set({ img: d, x: m.x, y: m.y, w: m.w, h: m.h, at: Date.now() });
      }).then(function () { online.seaStatus = 'Sent for review. It goes live once an editor approves it.'; render(); }, function (err) { online.seaStatus = (err && err.message) || 'It could not be sent.'; render(); });
    }
    if (e.target && e.target.id === 'ad-renew') { ui.ad.renew = e.target.checked; }
    if (e.target && e.target.id === 'biz-site') { ui.bizSite = e.target.value; ui.bizOpen = true; render(); }
    if (e.target && e.target.id === 'ad-slogan') { ui.ad.slogan = e.target.value; render(); }
    if (e.target && e.target.id === 'look-hair' && S) { var hv = +e.target.value; run(function () { return L.setLook(S, S.look.skin, hv, S.look.shape); }); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'room-in') { e.preventDefault(); sendRoom(e.target.value); return; }
    if (e.key === 'Enter' && e.target && e.target.id === 'deck-in') { e.preventDefault(); sendDeck(e.target.value); return; }
    if (e.key === 'Enter' && e.target && e.target.id === 'chat-in' && ui.chatWith) { e.preventDefault(); sendChat(ui.chatWith, e.target.value); return; }
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

  /* ---------- Style shop (self-hosted PWA only) ----------
     Real cash buys cosmetics only, through the shop server in server/. Owned items live on this device and on
     that server, never in a life's state, so they change no ledger, score or replay. The artifact build has no shop. */
  var SHOP_KEY = 'lasgidi.shopkey.v1', TAG_KEY = 'lasgidi.tag.v1', WEAR_KEY = 'lasgidi.wear.v1';
  // What you wear from the shop: one item per kind ({ tag, acc, paint }), kept on this device. The old tag key moves in.
  function wearing() {
    var w = null; try { w = JSON.parse(localStorage.getItem(WEAR_KEY) || 'null'); } catch (e) {}
    if (!w || typeof w !== 'object') { w = {}; try { var t = localStorage.getItem(TAG_KEY); if (t) w.tag = t; } catch (e) {} }
    return w;
  }
  function setWear(kind, id) {
    var w = wearing(); if (id) w[kind] = id; else delete w[kind];
    try { localStorage.setItem(WEAR_KEY, JSON.stringify(w)); localStorage.removeItem(TAG_KEY); } catch (e) {}
  }
  // The catalogue entry you wear for a kind, only if this key owns it.
  function worn(kind) {
    var id = wearing()[kind], C = online.shop && online.shop.catalog[id];
    return C && C.kind === kind && ownedItem(id) ? C : null;
  }
  function myExtra() { var a = worn('acc'); return a ? { look: a.look, color: a.color } : null; }
  function myPaint() { var p = worn('paint'); return p ? p.color : null; }
  function shopKey() {
    var k = null; try { k = localStorage.getItem(SHOP_KEY); } catch (e) {}
    if (!/^[a-z0-9]{16,40}$/.test(k || '')) {
      var b = new Uint8Array(24); (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(b) : b.forEach(function (v, i) { b[i] = Math.random() * 256; });
      k = Array.prototype.map.call(b, function (v) { return 'abcdefghijklmnopqrstuvwxyz0123456789'[v % 36]; }).join('');
      try { localStorage.setItem(SHOP_KEY, k); } catch (e) {}
    }
    return k;
  }
  function initShop() {
    if (!document.querySelector('meta[name="lasgidi-shop"]') || !window.fetch) return; // only when served by the shop server
    fetch('/api/shop', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.catalog) return;
      online.shop = j; return fetch('/api/owned?account=' + shopKey(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (o) { online.owned = (o && o.items) || []; scheduleRender(); });
    }).catch(function () {});
    var q = new URLSearchParams(location.search), st = q.get('shop');
    if (st) {
      ui.toasts.push(st === 'ok' ? { msg: '🎨 Payment confirmed. Your item is unlocked (receipt ' + (q.get('ref') || '') + ').', ok: true } : st === 'cancel' ? { msg: 'Payment cancelled. Nothing was charged.', ok: false } : { msg: 'The payment could not be confirmed, so nothing was unlocked. If you were charged, contact the shop with your receipt.', ok: false });
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      ui.tab = 'phone'; ui.app = 'style'; scheduleRender();
    }
  }
  function ownedItem(id) { return (online.owned || []).some(function (g) { return g.item === id; }); }
  function myTag() { var C = worn('tag'); return C ? { color: C.color, ink: C.ink } : null; }
  function styleView() {
    var sh = online.shop; if (!sh) return '<p class="note">The Style shop is only on self-hosted copies of the game.</p>';
    var P = sh.providers, cat = sh.catalog, wear = wearing(), kinds = sh.kinds || { tag: 'Name tags' };
    var html = '<div class="section" style="padding-top:0"><h3>🎨 Style shop</h3><p class="note">Real money buys <b>cosmetics only</b>: a colour for your @handle in live rooms and on the cruise, an accessory over your avatar, or a paint colour for your home. You wear one of each kind. It never buys naira, skills, status or any advantage, and it is not part of any life\'s score or replay.</p>' +
      (sh.mode !== 'live' ? '<p class="why">Sandbox mode: payments use test cards and accounts, and no real money moves.</p>' : '') +
      (!P.flutterwave && !P.paypal ? '<p class="why">No payment method is set up on this server yet.</p>' : '') +
      '<label class="shop-adult"><input type="checkbox" id="shop-adult"' + (ui.shopAdult ? ' checked' : '') + ' data-shopadult="1"> I am 18 or over</label>' +
      '<p class="note"><a href="/terms.html" target="_blank" rel="noopener">Terms and refunds</a></p>' + Object.keys(kinds).map(function (kind) {
        var ids = Object.keys(cat).filter(function (k) { return (cat[k].kind || 'tag') === kind; });
        return ids.length ? '<h4>' + esc(kinds[kind]) + '</h4><div class="list">' + ids.map(function (k) { return shopRow(k, kind); }).join('') + '</div>' : '';
      }).join('') + purchaseHistory() +
      '<h4>🔑 Your shop key</h4><p class="note">Your items belong to this key, kept in this browser. On a new device, or if you clear this site\'s data, send the shop owner your receipt and your new key, and they can move your items across.</p>' +
      '<div class="inline"><code class="shop-key">' + esc(shopKey()) + '</code><button class="btn sm ghost" id="shop-key-copy" data-copytext="' + esc(shopKey()) + '">Copy</button></div></div>';
    return html;
  }
  function shopRow(k, kind) {
    var sh = online.shop, P = sh.providers, C = sh.catalog[k], own = ownedItem(k), on = own && wearing()[kind] === k;
        var buy = own ? '<button class="btn sm' + (on ? '' : ' go') + '" id="shop-eq-' + k + '" data-shopequip="' + kind + ':' + (on ? '' : k) + '">' + (on ? 'Take off' : 'Wear') + '</button>'
          : (P.flutterwave ? '<button class="btn sm go" id="shop-flw-' + k + '" data-shopbuy="' + k + ':flutterwave"' + (ui.shopAdult ? '' : ' disabled title="Tick 18 or over first"') + '>Pay ₦' + C.ngn.toLocaleString('en') + '</button>' : '') +
            (P.paypal ? '<button class="btn sm ghost" id="shop-pp-' + k + '" data-shopbuy="' + k + ':paypal"' + (ui.shopAdult ? '' : ' disabled title="Tick 18 or over first"') + '>PayPal $' + C.usd + '</button>' : '');
    return '<div class="item"><div><h3><span class="tag-swatch" style="background:' + C.color + ';color:' + C.ink + '">' + (kind === 'tag' ? '@you' : kind === 'paint' ? '🏠' : '✨') + '</span> ' + esc(C.name) + '</h3><div class="meta"><span>₦' + C.ngn.toLocaleString('en') + ' · $' + C.usd + '</span>' + (own ? '<span class="gain">Owned</span>' : '') + '</div></div><div class="inline">' + buy + '</div></div>';
  }
  function purchaseHistory() {
    var h = online.owned || []; if (!h.length) return '';
    var cat = (online.shop && online.shop.catalog) || {};
    return '<h4>🧾 Your purchases</h4><div class="list">' + h.map(function (g) {
      return '<div class="item"><div><h3>' + esc((cat[g.item] || {}).name || g.item) + '</h3><div class="meta"><span>' + esc(g.currency === 'NGN' ? '₦' + Number(g.amount).toLocaleString('en') : '$' + g.amount) + ' · ' + esc(g.provider === 'paypal' ? 'PayPal' : 'Flutterwave') + '</span><span>' + esc(String(g.at).slice(0, 10)) + '</span><span class="muted">Receipt ' + esc(g.ref) + '</span></div></div></div>';
    }).join('') + '</div>';
  }
  function shopBuy(item, provider) {
    if (!ui.shopAdult) { ui.toasts.push({ msg: 'Tick "I am 18 or over" first.', ok: false }); renderToasts(); return; }
    fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: shopKey(), item: item, provider: provider, adult: true }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) { if (x.ok && x.j.url && /^https:\/\//.test(x.j.url)) location.href = x.j.url; else { ui.toasts.push({ msg: (x.j && x.j.error) || 'The shop could not start the payment.', ok: false }); renderToasts(); } })
      .catch(function () { ui.toasts.push({ msg: 'The shop is not reachable right now.', ok: false }); renderToasts(); });
  }
  function start(data) {
    S = (data && data.state) ? L.migrate(data.state) : (prefs.mode === 'weekly' && weeklyRun()) || load(SAVE_KEY);
    if (data && data.ui) Object.assign(ui, data.ui, { toasts: [] });
    render();
    initOnline();
    initShop();
  }
  var hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(function () { return { state: S, ui: { tab: ui.tab, sel: ui.sel } }; });
  if (hot && hot.ready) hot.ready(start); else start(hot && hot.data ? hot.data : {});

  if ('serviceWorker' in navigator && /^https:|^http:\/\/localhost/.test(location.href) && !hot) {
    try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) { /* not available */ }
  }
})();
