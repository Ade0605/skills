/* Lasgidi — board games: Ludo (2–4 players), Ayò Ọlọ́pọ́n (the Yoruba mancala, 2 players) and English draughts
   (2 players). Pure rules, no drawing: every game is a list of moves replayed from the start, so two phones that see
   the same moves always agree, and an illegal move is simply not a move. Ludo dice come from the table's seed and the
   turn number (nobody can choose their roll). Each game also has a computer player for playing offline.
   API (window.LasgidiBoards): start(game, seats, seed) → state; legal(state) → moves for the player to move;
   play(state, move) → new state or null if illegal; replay(game, seats, seed, moves) → state; ai(state) → move. */
(function (root) {
  'use strict';
  function hash(str) { var h = 2166136261 >>> 0; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------------- Ayò Ọlọ́pọ́n -----------------------------------------------------------------------------
  // 12 pits: 0–5 are seat 0's row (left to right), 6–11 are seat 1's (right to left as seen by seat 0); sowing goes
  // anticlockwise, pit i to i + 1. The pit you lift from is skipped when you go round (12 or more seeds). Capture: if
  // your last seed lands in an opponent's pit making 2 or 3, you take them, and so on backwards along the opponent's
  // row while those pits hold 2 or 3. A move that would take every seed the opponent has captures nothing. If your
  // opponent's row is empty you must give them seeds if you can; if you cannot, the game ends and you keep what is on
  // your side. 25 seeds wins; 24 each is a draw. After 120 moves with no capture the seeds left go to their row.
  var AYO = {
    start: function () { return { game: 'ayo', pits: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], store: [0, 0], turn: 0, n: 0, quiet: 0, over: false, winner: null, last: null }; },
    mine: function (s, i) { return s.turn === 0 ? i < 6 : i >= 6; },
    sow: function (pits, from) { var p = pits.slice(), n = p[from], i = from; p[from] = 0; while (n > 0) { i = (i + 1) % 12; if (i === from) continue; p[i]++; n--; } return { pits: p, last: i }; },
    rowTotal: function (pits, seat) { var t = 0; for (var i = seat * 6; i < seat * 6 + 6; i++) t += pits[i]; return t; },
    legal: function (s) {
      if (s.over) return [];
      var opp = 1 - s.turn, out = [];
      for (var i = s.turn * 6; i < s.turn * 6 + 6; i++) { if (!s.pits[i]) continue; if (AYO.rowTotal(s.pits, opp) === 0 && AYO.rowTotal(AYO.sow(s.pits, i).pits, opp) === 0) continue; out.push(i); }
      return out;
    },
    play: function (s0, m) {
      if (AYO.legal(s0).indexOf(m) < 0) return null;
      var s = clone(s0), r = AYO.sow(s.pits, m), p = r.pits, opp = 1 - s.turn, took = 0, i = r.last, caps = [];
      var inOpp = function (k) { return opp === 0 ? k < 6 : k >= 6; };
      while (inOpp(i) && (p[i] === 2 || p[i] === 3)) { caps.push(i); took += p[i]; i = (i + 11) % 12; }
      var left = AYO.rowTotal(p, opp) - took;
      if (took && left > 0) { caps.forEach(function (k) { p[k] = 0; }); s.store[s.turn] += took; s.quiet = 0; } else { took = 0; caps = []; s.quiet++; }
      s.pits = p; s.n++; s.last = { from: m, to: r.last, took: took, caps: caps }; s.turn = opp;
      AYO.finish(s); return s;
    },
    finish: function (s) {
      var me = s.turn, none = AYO.legal(s).length === 0;
      if (s.store[0] >= 25 || s.store[1] >= 25 || none || s.quiet >= 120) {
        if (none || s.quiet >= 120) { for (var i = 0; i < 12; i++) { s.store[i < 6 ? 0 : 1] += s.pits[i]; s.pits[i] = 0; } }
        if (s.store[0] >= 25 || s.store[1] >= 25 || none || s.quiet >= 120) { s.over = true; s.winner = s.store[0] === s.store[1] ? -1 : s.store[0] > s.store[1] ? 0 : 1; }
      }
      return me;
    },
    score: function (s, seat) { return s.store[seat] - s.store[1 - seat]; }
  };

  // ---------------- Ludo ----------------------------------------------------------------------------------
  // Colours in seat order around the board: red, green, yellow, blue (two players get red and yellow, three get red,
  // green and yellow). A token is -1 in the yard, 0–50 on the 52-square track counted from its colour's start, 51–55
  // in its home column and 56 when home. A six brings a token out and earns another roll; landing on an opponent on a
  // square that is not safe sends it back to the yard and also earns another roll; three sixes in a row lose the
  // turn. Exact rolls to get home. First to bring all four home wins; play continues for the places.
  var COLORS = ['red', 'green', 'yellow', 'blue'], START = { red: 0, green: 13, yellow: 26, blue: 39 }, SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
  function ludoColors(n) { return n === 2 ? ['red', 'yellow'] : n === 3 ? ['red', 'green', 'yellow'] : COLORS.slice(); }
  var LUDO = {
    start: function (n, seed) { var cols = ludoColors(n); return { game: 'ludo', colors: cols, tokens: cols.map(function () { return [-1, -1, -1, -1]; }), turn: 0, n: 0, sixes: 0, seed: String(seed), dice: 0, done: [], over: false, winner: null, last: null }; },
    roll: function (s) { return hash(s.seed + ':' + s.n) % 6 + 1; },
    abs: function (color, p) { return (START[color] + p) % 52; },
    legal: function (s) {
      if (s.over) return [];
      var d = LUDO.roll(s), me = s.turn, t = s.tokens[me], out = [];
      if (s.sixes >= 2 && d === 6) return [-1]; // a third six: the turn is lost
      for (var k = 0; k < 4; k++) { var p = t[k]; if (p === 56) continue; if (p === -1) { if (d === 6) out.push(k); continue; } if (p + d <= 56) out.push(k); }
      return out.length ? out : [-1];
    },
    play: function (s0, m) {
      var leg = LUDO.legal(s0); if (leg.indexOf(m) < 0) return null;
      var s = clone(s0), d = LUDO.roll(s), me = s.turn, again = false, cap = null;
      if (m >= 0) {
        var p = s.tokens[me][m], np = p === -1 ? 0 : p + d; s.tokens[me][m] = np;
        if (np <= 50) { var sq = LUDO.abs(s.colors[me], np); if (SAFE.indexOf(sq) < 0) s.tokens.forEach(function (tt, o) { if (o === me) return; tt.forEach(function (q, k) { if (q >= 0 && q <= 50 && LUDO.abs(s.colors[o], q) === sq) { tt[k] = -1; cap = { seat: o, token: k }; } }); }); }
        if (cap || np === 56) again = true;
      }
      if (d === 6 && m !== -1) again = true;
      s.sixes = d === 6 && again && m !== -1 ? s.sixes + 1 : 0;
      s.last = { seat: me, dice: d, token: m, cap: cap };
      if (s.tokens[me].every(function (q) { return q === 56; }) && s.done.indexOf(me) < 0) { s.done.push(me); if (s.winner == null) s.winner = me; again = false; }
      if (s.done.length >= s.colors.length - 1) s.over = true;
      s.n++;
      if (!again || s.over) { s.sixes = 0; var nx = me; for (var c = 0; c < s.colors.length; c++) { nx = (nx + 1) % s.colors.length; if (s.done.indexOf(nx) < 0) break; } s.turn = nx; }
      return s;
    },
    score: function (s, seat) { var f = function (o) { return s.tokens[o].reduce(function (a, q) { return a + (q < 0 ? -6 : q === 56 ? 70 : q); }, 0); }, best = -1e9; for (var o = 0; o < s.colors.length; o++) if (o !== seat) best = Math.max(best, f(o)); return f(seat) - best; }
  };

  // ---------------- English draughts ----------------------------------------------------------------------
  // 8×8, the dark squares only (index = row * 8 + col, row 0 at the top; dark when (row + col) is odd). Seat 0 is the
  // dark pieces at the bottom moving up, seat 1 the light pieces at the top moving down. Men move one square
  // diagonally forward; kings one square any diagonal way. Captures are compulsory and a piece must keep jumping
  // while it can; a man reaching the far row is crowned and his move ends. You lose with no pieces or no move; 40
  // moves each with no capture or crowning is a draw. A move is a path: [from, to, to, …].
  var DR = {
    start: function () { var b = []; for (var i = 0; i < 64; i++) { var r = Math.floor(i / 8), c = i % 8, dark = (r + c) % 2 === 1; b.push(!dark ? null : r < 3 ? 'w' : r > 4 ? 'b' : null); } return { game: 'draughts', board: b, turn: 0, n: 0, quiet: 0, over: false, winner: null, last: null }; },
    own: function (pc, seat) { return pc && (seat === 0 ? pc.toLowerCase() === 'b' : pc.toLowerCase() === 'w'); },
    dirs: function (pc) { return pc === 'b' ? [[-1, -1], [-1, 1]] : pc === 'w' ? [[1, -1], [1, 1]] : [[-1, -1], [-1, 1], [1, -1], [1, 1]]; },
    jumps: function (b, i, pc, seat) {
      var r = Math.floor(i / 8), c = i % 8, out = [];
      DR.dirs(pc).forEach(function (d) {
        var mr = r + d[0], mc = c + d[1], tr = r + 2 * d[0], tc = c + 2 * d[1];
        if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return; var mid = b[mr * 8 + mc], to = tr * 8 + tc;
        if (mid && !DR.own(mid, seat) && !b[to]) {
          var nb = b.slice(); nb[to] = pc; nb[i] = null; nb[mr * 8 + mc] = null;
          var crown = (pc === 'b' && tr === 0) || (pc === 'w' && tr === 7);
          var more = crown ? [] : DR.jumps(nb, to, pc, seat);
          if (more.length) more.forEach(function (p) { out.push([i].concat(p)); }); else out.push([i, to]);
        }
      });
      return out;
    },
    legal: function (s) {
      if (s.over) return [];
      var b = s.board, seat = s.turn, caps = [], steps = [];
      for (var i = 0; i < 64; i++) { var pc = b[i]; if (!DR.own(pc, seat)) continue; caps = caps.concat(DR.jumps(b, i, pc, seat));
        if (!caps.length) { var r = Math.floor(i / 8), c = i % 8; DR.dirs(pc).forEach(function (d) { var tr = r + d[0], tc = c + d[1]; if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8 && !b[tr * 8 + tc]) steps.push([i, tr * 8 + tc]); }); } }
      return caps.length ? caps : steps;
    },
    same: function (a, b) { return a.length === b.length && a.every(function (x, k) { return x === b[k]; }); },
    play: function (s0, m) {
      if (!Array.isArray(m) || !DR.legal(s0).some(function (x) { return DR.same(x, m); })) return null;
      var s = clone(s0), b = s.board, pc = b[m[0]], took = 0;
      for (var k = 1; k < m.length; k++) { var a = m[k - 1], t = m[k]; if (Math.abs(t - a) > 9) { b[(a + t) / 2] = null; took++; } b[t] = pc; b[a] = null; }
      var end = m[m.length - 1], er = Math.floor(end / 8), crowned = false;
      if (pc === 'b' && er === 0) { b[end] = 'B'; crowned = true; } if (pc === 'w' && er === 7) { b[end] = 'W'; crowned = true; }
      s.quiet = took || crowned ? 0 : s.quiet + 1; s.last = { path: m, took: took }; s.n++; s.turn = 1 - s.turn;
      if (!DR.legal(s).length) { s.over = true; s.winner = 1 - s.turn; } else if (s.quiet >= 80) { s.over = true; s.winner = -1; }
      return s;
    },
    score: function (s, seat) { var v = 0; s.board.forEach(function (pc) { if (!pc) return; var w = pc === pc.toUpperCase() ? 3 : 1; v += DR.own(pc, seat) ? w : -w; }); return v; }
  };

  var RULES = { ayo: AYO, ludo: LUDO, draughts: DR };
  var INFO = {
    ludo: { name: 'Ludo', icon: '🎲', min: 2, max: 4, text: 'Roll, bring your four tokens out on a six and race them home. Land on a rival to send them back.' },
    ayo: { name: 'Ayò Ọlọ́pọ́n', icon: '🌰', min: 2, max: 2, text: 'The Yoruba seed game: sow anticlockwise, capture 2s and 3s on your opponent\'s side. 25 seeds wins.' },
    draughts: { name: 'Draughts', icon: '⚫', min: 2, max: 2, text: 'English draughts: move diagonally, jumps are compulsory, reach the far row to crown a king.' }
  };
  function start(game, seats, seed) { return game === 'ludo' ? LUDO.start(seats, seed) : RULES[game].start(); }
  function legal(s) { return RULES[s.game].legal(s); }
  function play(s, m) { try { return RULES[s.game].play(s, m); } catch (e) { return null; } }
  function replay(game, seats, seed, moves) { var s = start(game, seats, seed); for (var i = 0; i < moves.length; i++) { var n = play(s, moves[i]); if (!n) break; s = n; } return s; }
  function same(a, b) { return Array.isArray(a) ? Array.isArray(b) && DR.same(a, b) : a === b; }
  // The computer: a short look-ahead for Ayo and draughts, a sensible greedy player for Ludo.
  function search(s, depth, seat) {
    var R = RULES[s.game]; if (s.over || depth === 0) return s.over ? (s.winner === seat ? 1000 : s.winner === -1 ? 0 : -1000) : R.score(s, seat);
    var ms = R.legal(s), best = s.turn === seat ? -1e9 : 1e9;
    for (var i = 0; i < ms.length; i++) { var n = R.play(s, ms[i]); if (!n) continue; var v = search(n, depth - 1, seat); best = s.turn === seat ? Math.max(best, v) : Math.min(best, v); }
    return best;
  }
  function ai(s, level) {
    var R = RULES[s.game], ms = R.legal(s), seat = s.turn; if (!ms.length) return null; if (ms.length === 1) return ms[0];
    if (s.game === 'ludo') {
      var best = ms[0], bv = -1e9;
      ms.forEach(function (m) { var n = R.play(s, m); if (!n) return; var v = R.score(n, seat) + (n.last && n.last.cap ? 40 : 0) + (m >= 0 && s.tokens[seat][m] === -1 ? 15 : 0); if (m >= 0 && n.tokens[seat][m] <= 50 && SAFE.indexOf(LUDO.abs(s.colors[seat], n.tokens[seat][m])) >= 0) v += 6; if (v > bv) { bv = v; best = m; } });
      return best;
    }
    var depth = s.game === 'ayo' ? (level === 'easy' ? 1 : 4) : (level === 'easy' ? 1 : 3), bm = ms[0], bs = -1e9;
    ms.forEach(function (m, k) { var n = R.play(s, m); if (!n) return; var v = search(n, depth - 1, seat) + ((hash(String(s.n) + k) % 7) * 0.01); if (v > bs) { bs = v; bm = m; } });
    return bm;
  }
  // Whose turn it is as a seat, and which seat a move number belongs to (for merging the players' move lists).
  root.LasgidiBoards = { INFO: INFO, start: start, legal: legal, play: play, replay: replay, ai: ai, same: same, colors: ludoColors, roll: LUDO.roll, SAFE: SAFE, START: START, AYO: AYO, LUDO: LUDO, DR: DR };
  if (typeof module !== 'undefined') module.exports = root.LasgidiBoards;
})(typeof window !== 'undefined' ? window : globalThis);
