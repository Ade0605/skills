/* Lasgidi: Naija Quiz, a timed trivia mini-game at Millennium Park, Abuja.
 * Ten questions, 12 seconds each, four options. Questions mix well-known facts
 * about Nigeria with how life in Lasgidi works. The result ({ correct, total })
 * is paid by the engine as a capped prize. */
(function (root) {
  'use strict';
  var BANK = [
    ['What is the capital of Nigeria?', ['Abuja', 'Lagos', 'Kano', 'Ibadan'], 0],
    ['What is Nigeria\'s currency?', ['Naira', 'Cedi', 'Rand', 'Shilling'], 0],
    ['In what year did Nigeria become independent?', ['1960', '1963', '1957', '1970'], 0],
    ['Which two rivers meet at Lokoja?', ['Niger and Benue', 'Niger and Ogun', 'Benue and Cross', 'Osun and Ogun'], 0],
    ['Which big rock stands near Abuja and appears on the ₦100 note?', ['Zuma Rock', 'Olumo Rock', 'Aso Rock', 'Idanre Hill'], 0],
    ['The Eyo festival comes from which city?', ['Lagos', 'Calabar', 'Benin City', 'Enugu'], 0],
    ['Which state hosts the famous December carnival in Calabar?', ['Cross River', 'Rivers', 'Akwa Ibom', 'Delta'], 0],
    ['Nigeria\'s film industry is known as…', ['Nollywood', 'Bollywood', 'Kannywood only', 'Riverwood'], 0],
    ['Which ocean is Lagos on?', ['Atlantic', 'Indian', 'Pacific', 'Arctic'], 0],
    ['Port Harcourt is the capital of which state?', ['Rivers', 'Bayelsa', 'Delta', 'Imo'], 0],
    ['"Japa" means…', ['Leaving the country', 'A kind of rice', 'A Lagos bus', 'A wedding dance'], 0],
    ['A yellow Lagos minibus is called a…', ['Danfo', 'Keke', 'Okada', 'Molue only'], 0],
    ['In Lasgidi, rent is due every…', ['Friday at noon', 'Monday morning', 'Month end', 'Sunday night'], 0],
    ['In Lasgidi, where do you play Danfo Run?', ['Ojuelegba, Surulere', 'Lekki Phase 1', 'Ikeja GRA', 'Wuse, Abuja'], 0],
    ['In Lasgidi, what does a Treasury bill pay?', ['About 1% after 7 days', '50% a week', 'Nothing', 'Double your money'], 0],
    ['In Lasgidi, what do you need to japa?', ['IELTS and proof of funds', 'A chieftaincy title', 'A danfo', 'A Sea Plot'], 0],
    ['"Owambe" is…', ['A big party', 'A market', 'A bridge', 'A bank'], 0],
    ['Suya is…', ['Spicy grilled meat', 'A soup', 'A drink', 'A fabric'], 0],
    ['Which festival honours Fela Kuti every October?', ['Felabration', 'Eyo', 'Argungu', 'Durbar'], 0],
    ['The Argungu Fishing Festival is held in which state?', ['Kebbi', 'Lagos', 'Rivers', 'Ogun'], 0],
    ['Aso-ebi is…', ['Matching party fabric for a group', 'A Lagos road', 'A type of loan', 'A street food'], 0],
    ['Which city is known as the Garden City?', ['Port Harcourt', 'Kano', 'Jos', 'Abeokuta'], 0],
    ['In Lasgidi, rainy season mostly runs…', ['April to October', 'November to March', 'All year', 'Only December'], 0],
    ['Balogun market is in…', ['Lagos Island', 'Abuja', 'Port Harcourt', 'Ibadan'], 0]
  ];
  var N = 10, PER = 12;
  function create(opts) {
    var wrap = document.createElement('div'); wrap.className = 'quiz-game';
    var seed = (opts && opts.seed) || 5, view = opts && opts.view, body = wrap;
    if (view) { body = document.createElement('div'); view.mount(null, wrap); wrap.appendChild(body); } // a 3D studio above the answer card
    function rnd() { seed = (seed + 0x6D2B79F5) | 0; var t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    var st, timer = 0;
    function pickQs() {
      var pool = BANK.slice(), out = [];
      while (out.length < N && pool.length) {
        var q = pool.splice(Math.floor(rnd() * pool.length), 1)[0], order = [0, 1, 2, 3].sort(function () { return rnd() - 0.5; });
        out.push({ q: q[0], opts: order.map(function (i) { return q[1][i]; }), ans: order.indexOf(q[2]) });
      }
      return out;
    }
    function render() {
      if (st.over) {
        body.innerHTML = '<div class="qz-card"><h3>🎤 That\'s the show!</h3><p class="qz-big">' + st.correct + ' / ' + N + '</p><p class="note">' + (st.correct >= 8 ? 'The audience is on its feet!' : st.correct >= 5 ? 'Not bad at all.' : 'Better luck next time.') + '</p></div>';
        if (view) view.frame(st, { n: N, per: PER });
        return;
      }
      var q = st.qs[st.i], left = Math.max(0, Math.ceil(st.left));
      body.innerHTML = '<div class="qz-card"><div class="qz-top"><span>Question ' + (st.i + 1) + ' of ' + N + '</span><span>✅ ' + st.correct + '</span><span class="qz-time' + (left <= 3 ? ' low' : '') + '">⏱ ' + left + 's</span></div>' +
        '<h3 class="qz-q">' + q.q.replace(/</g, '&lt;') + '</h3><div class="qz-opts">' + q.opts.map(function (o, k) {
          var cls = st.chosen == null ? '' : k === q.ans ? ' right' : k === st.chosen ? ' wrong' : '';
          return '<button type="button" class="qz-opt' + cls + '" data-qz="' + k + '"' + (st.chosen != null ? ' disabled' : '') + '><b>' + 'ABCD'[k] + '</b> ' + o.replace(/</g, '&lt;') + '</button>';
        }).join('') + '</div></div>';
      if (view) view.frame(st, { n: N, per: PER });
    }
    function fx(n, a) { if (opts && opts.sfx) { try { opts.sfx(n, a); } catch (e) {} } } // sound only; never touches the game
    function answer(k) {
      if (!st || st.over || st.chosen != null) return;
      st.chosen = k; if (k === st.qs[st.i].ans) { st.correct++; fx('correct'); } else fx('buzz');
      render();
      setTimeout(next, 900);
    }
    function next() {
      st.i++; st.chosen = null; st.left = PER;
      if (st.i >= N) { st.over = true; stopTimer(); fx(st.correct >= 5 ? 'cheer' : 'buzz'); render(); if (opts && opts.onDone) opts.onDone({ correct: st.correct, total: N }); return; }
      render();
    }
    function stopTimer() { if (timer) clearInterval(timer); timer = 0; }
    wrap.addEventListener('click', function (e) { var b = e.target.closest('[data-qz]'); if (b) answer(+b.dataset.qz); });
    function onKey(e) { if (!wrap.isConnected) return; var k = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 }[String(e.key).toLowerCase()]; if (k != null) answer(k); }
    root.addEventListener('keydown', onKey);
    return {
      el: wrap,
      start: function () {
        st = { qs: pickQs(), i: 0, correct: 0, chosen: null, left: PER, over: false };
        fx('sting');
        render(); stopTimer();
        timer = setInterval(function () { if (!wrap.isConnected) { stopTimer(); return; } if (st.chosen != null || st.over) return; st.left -= 0.25; if (st.left <= 0) { st.chosen = -1; fx('buzz'); render(); setTimeout(next, 700); } else if (Math.abs(st.left - Math.round(st.left)) < 0.01) render(); }, 250);
      },
      state: function () { return st; },
      stop: function () { stopTimer(); root.removeEventListener('keydown', onKey); if (view) view.dispose(); },
      // For tests: answer every question (right or wrong) instantly.
      tick: function (_s, auto) { while (st && !st.over) { st.chosen = null; var k = auto ? st.qs[st.i].ans : (st.qs[st.i].ans + 1) % 4; if (k === st.qs[st.i].ans) st.correct++; next(); } return { correct: st.correct, total: N, over: st.over }; }
    };
  }
  root.LasgidiQuiz = { create: create, BANK: BANK };
})(typeof window !== 'undefined' ? window : this);
