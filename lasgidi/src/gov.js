/* Lasgidi state government: parties, primaries, Governor–Deputy tickets,
 * the campaign, the election and the Executive Council.
 *
 * Every function here is pure: it reads the shared player docs (as
 * [{ id, raw }] lists) and returns who won what. Nothing here touches a
 * player's life or money, and nothing a player writes is trusted without
 * being checked against the rules below.
 *
 * The weekly cycle (UTC days of the ISO week):
 *   Mon–Tue  party primaries: join a party, declare, party members vote
 *   Wed–Fri  campaign: nominees pick a deputy and take the ticket round the state
 *   Sat–Sun  election: one vote per player at their polling unit (district)
 *   Next week the winning ticket governs and appoints the Executive Council. */
(function (root) {
  'use strict';

  var PARTIES = {
    epp: { name: 'Eko Progressive Party', short: 'EPP', icon: '🦅', color: '#1d6fd1' },
    phc: { name: "People's Hustle Congress", short: 'PHC', icon: '✊🏾', color: '#d1452f' },
    lyp: { name: 'Lasgidi Youth Party', short: 'LYP', icon: '⚡', color: '#7c3aed' },
    odf: { name: 'Owambe Democratic Front', short: 'ODF', icon: '🥁', color: '#16a35a' }
  };
  var MOTTOS = ['Light for every street, 24/7', 'No more go-slow on Third Mainland', 'Eko o ni baje!', 'Money speaks, but work speaks louder', 'Jobs for every graduate', 'Clean gutters, no more flood', 'Owambe every Saturday, on the state', 'Fix the roads, then we talk', 'Hustle hard, Lagos go pay', 'More BRT, less danfo wahala', 'Detty December all year', 'Island and Mainland, one Lagos'];
  var PLANKS = {
    security: { name: 'Security', icon: '🛡️' }, economy: { name: 'Economy and jobs', icon: '💼' }, infra: { name: 'Roads and infrastructure', icon: '🛣️' },
    education: { name: 'Education', icon: '🎓' }, health: { name: 'Health', icon: '🏥' }, transport: { name: 'Transport', icon: '🚆' },
    environment: { name: 'Flood and environment', icon: '🌊' }, youth: { name: 'Youth and tech', icon: '💻' }
  };
  var CAMPAIGN = {
    townhall: { name: 'Town hall meeting', icon: '🏛️', buzz: 3 },
    rally: { name: 'Rally', icon: '📣', buzz: 4 },
    roadshow: { name: 'Road show', icon: '🚐', buzz: 3 },
    media: { name: 'Media appearance', icon: '📺', buzz: 2 },
    debate: { name: 'Debate', icon: '🎙️', buzz: 4 },
    policy: { name: 'Policy presentation', icon: '📊', buzz: 3 },
    community: { name: 'Meet traditional leaders, youth groups and communities', icon: '🤝', buzz: 3 },
    mobilise: { name: 'Voter education and mobilisation', icon: '🗳️', buzz: 2 }
  };
  // The Executive Council. Commissioners need the Assembly to confirm them; Special Advisers don't.
  var PORTFOLIOS = {
    finance: { name: 'Commissioner for Finance', icon: '💰' },
    works: { name: 'Commissioner for Works and Infrastructure', icon: '🏗️' },
    health: { name: 'Commissioner for Health', icon: '🏥' },
    education: { name: 'Commissioner for Education', icon: '🎓' },
    transport: { name: 'Commissioner for Transportation', icon: '🚆' },
    environment: { name: 'Commissioner for the Environment', icon: '🌳' },
    youth: { name: 'Commissioner for Youth and Sports', icon: '⚽' },
    tourism: { name: 'Commissioner for Tourism, Arts and Culture', icon: '🎭' },
    sa_media: { name: 'Special Adviser, Media and Publicity', icon: '📰', sa: true },
    sa_tech: { name: 'Special Adviser, Innovation and Technology', icon: '💡', sa: true }
  };
  var MIN_STATUS = 20;          // status points needed to run for governor
  var SPREAD_SHARE = 0.25;      // a winner needs 25% of the vote...
  var SPREAD_UNITS = 2 / 3;     // ...in two-thirds of the districts that voted

  function weekId(date) {
    var d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return d.getUTCFullYear() + '-W' + String(Math.ceil(((d - yearStart) / 86400000 + 1) / 7)).padStart(2, '0');
  }
  function phase(date) { var d = date.getUTCDay(); return d === 1 || d === 2 ? 'primaries' : d >= 3 && d <= 5 ? 'campaign' : 'election'; }
  // Was this timestamp in the given week, in the given phase?
  function inPhase(at, wk, ph) { if (typeof at !== 'number' || !isFinite(at)) return false; var dt = new Date(at); return weekId(dt) === wk && phase(dt) === ph; }
  // Each doc keeps this week's entry and the one before it ({week, ..., prev: {week, ...}}).
  function weekVal(raw, wk) { if (!raw || typeof raw !== 'object') return null; if (raw.week === wk) return raw; if (raw.prev && raw.prev.week === wk) return raw.prev; return null; }
  function byId(list) { var m = {}; (list || []).forEach(function (r) { if (r && typeof r.id === 'string') m[r.id] = r.raw; }); return m; }

  // Party members this week: { id: party }.
  function members(parties, wk) {
    var m = {};
    (parties || []).forEach(function (r) { var v = weekVal(r.raw, wk); if (v && PARTIES[v.party]) m[r.id] = v.party; });
    return m;
  }

  // Candidates, primaries and the tickets on the ballot.
  function nominees(runs, parties, primaries, wk) {
    var mem = members(parties, wk), partyDocs = byId(parties), cands = {};
    (runs || []).forEach(function (r) {
      var v = weekVal(r.raw, wk);
      if (!v || !PARTIES[v.party] || mem[r.id] !== v.party || !inPhase(v.at, wk, 'primaries')) return;
      if (typeof v.motto !== 'number' || !MOTTOS[v.motto]) return;
      var planks = Array.isArray(v.planks) ? v.planks.filter(function (p, i, a) { return PLANKS[p] && a.indexOf(p) === i; }).slice(0, 3) : [];
      var camp = {};
      if (v.camp && typeof v.camp === 'object') Object.keys(CAMPAIGN).forEach(function (k) { var n = +v.camp[k]; if (n > 0 && n < 10) camp[k] = Math.floor(n); });
      cands[r.id] = { id: r.id, party: v.party, motto: v.motto, planks: planks, camp: camp, at: v.at, deputyAsk: typeof v.deputy === 'string' ? v.deputy : null, primary: 0 };
    });
    (primaries || []).forEach(function (r) {
      var v = weekVal(r.raw, wk), c = v && cands[v.cand];
      if (c && mem[r.id] === c.party && inPhase(v.at, wk, 'primaries')) c.primary++;
    });
    var out = {};
    Object.keys(cands).forEach(function (k) {
      var c = cands[k], best = out[c.party];
      if (!best || c.primary > best.primary || (c.primary === best.primary && c.at < best.at)) out[c.party] = c;
    });
    var tickets = Object.keys(out).map(function (p) {
      var c = out[p], dep = c.deputyAsk, dv = dep && weekVal(partyDocs[dep], wk);
      // A joint ticket: the deputy is a different member of the same party who has accepted.
      var ok = dep && dep !== c.id && mem[dep] === p && dv && dv.mate === c.id;
      return { party: p, id: c.id, deputy: ok ? dep : null, deputyAsk: dep, motto: c.motto, planks: c.planks, camp: c.camp, primary: c.primary, at: c.at,
        buzz: Object.keys(c.camp).reduce(function (a, k) { return a + c.camp[k] * CAMPAIGN[k].buzz; }, 0) };
    }).sort(function (a, b) { return a.at - b.at; });
    return { candidates: Object.keys(cands).map(function (k) { return cands[k]; }), tickets: tickets, members: mem };
  }

  // Collate the election: polling unit (district) totals, then the state.
  function election(tickets, votes, wk, units) {
    var onBallot = {}, unitSet = units || null;
    (tickets || []).forEach(function (t) { if (t.deputy) onBallot[t.id] = { ticket: t, votes: 0, units: {} }; });
    var unitTotals = {}, voters = {};
    (votes || []).forEach(function (r) {
      var v = weekVal(r.raw, wk), e = v && onBallot[v.cand];
      if (!e || !inPhase(v.at, wk, 'election')) return;
      voters[r.id] = v.cand;
      var u = typeof v.unit === 'string' && (!unitSet || unitSet[v.unit]) ? v.unit : 'other';
      e.votes++; e.units[u] = (e.units[u] || 0) + 1; unitTotals[u] = (unitTotals[u] || 0) + 1;
    });
    var unitIds = Object.keys(unitTotals), need = Math.ceil(unitIds.length * SPREAD_UNITS);
    var rows = Object.keys(onBallot).map(function (k) {
      var e = onBallot[k], spread = unitIds.filter(function (u) { return (e.units[u] || 0) / unitTotals[u] >= SPREAD_SHARE; }).length;
      return { ticket: e.ticket, votes: e.votes, units: e.units, spread: spread, meetsSpread: e.votes > 0 && spread >= need };
    }).sort(function (a, b) { return b.votes - a.votes || a.ticket.at - b.ticket.at; });
    var winner = rows.filter(function (r) { return r.meetsSpread; })[0] || null, simple = false;
    if (!winner && rows[0] && rows[0].votes > 0) { winner = rows[0]; simple = true; }
    return { rows: rows, units: unitTotals, need: need, winner: winner, simpleMajority: simple, voters: voters, total: unitIds.reduce(function (a, u) { return a + unitTotals[u]; }, 0) };
  }

  // The Executive Council for the governing week: only the governor's own doc counts.
  // The Assembly is everyone who voted in the election that put them there.
  function council(govId, cabDocs, confirmDocs, assembly, wk) {
    var posts = {}, cab = govId && weekVal(byId(cabDocs)[govId], wk);
    if (cab && cab.posts && typeof cab.posts === 'object') Object.keys(PORTFOLIOS).forEach(function (k) { var id = cab.posts[k]; if (typeof id === 'string' && id && id !== govId) posts[k] = id; });
    var tally = {};
    (confirmDocs || []).forEach(function (r) {
      var v = weekVal(r.raw, wk);
      if (!v || !assembly[r.id] || !v.votes || typeof v.votes !== 'object') return;
      Object.keys(posts).forEach(function (k) { var x = v.votes[k]; if (x === 1 || x === -1) { tally[k] = tally[k] || { yes: 0, no: 0 }; tally[k][x === 1 ? 'yes' : 'no']++; } });
    });
    return Object.keys(posts).map(function (k) {
      var t = tally[k] || { yes: 0, no: 0 }, sa = !!PORTFOLIOS[k].sa;
      return { post: k, id: posts[k], yes: t.yes, no: t.no, status: sa ? 'appointed' : t.yes > t.no ? 'confirmed' : t.no > t.yes ? 'rejected' : 'awaiting' };
    });
  }

  var API = { PARTIES: PARTIES, MOTTOS: MOTTOS, PLANKS: PLANKS, CAMPAIGN: CAMPAIGN, PORTFOLIOS: PORTFOLIOS, MIN_STATUS: MIN_STATUS, SPREAD_SHARE: SPREAD_SHARE,
    weekId: weekId, phase: phase, inPhase: inPhase, weekVal: weekVal, members: members, nominees: nominees, election: election, council: council };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.LasgidiGov = API;
})(this);
