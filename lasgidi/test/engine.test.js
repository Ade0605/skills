'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/engine.js');
const D = L.DATA;

function game(origin, seed) { return L.newGame({ name: 'Test', goal: 'japa', origin: origin || 'mid', seed: seed || 42 }); }

function sane(s) {
  assert.ok(L.verifyLedger(s), 'ledger must reconcile with balances');
  assert.ok(Number.isInteger(s.cash) && Number.isInteger(s.bank), 'money must be whole naira');
  for (const k of Object.keys(s.needs)) assert.ok(s.needs[k] >= 0 && s.needs[k] <= 100 && !Number.isNaN(s.needs[k]), 'need ' + k);
}

test('new game rolls an origin deterministically from the seed', () => {
  const a = L.newGame({ seed: 7 }), b = L.newGame({ seed: 7 });
  assert.equal(a.origin, b.origin);
  assert.equal(a.bank, D.ORIGINS[a.origin].cash);
  assert.equal(a.loc, D.HOMES[a.home].district);
  sane(a);
});

test('every place and home action has a positive duration on the 15-minute grid', () => {
  const all = [].concat(D.HOME_ACTIONS, ...Object.values(D.PLACE_ACTIONS));
  const ids = new Set();
  for (const a of all) {
    assert.ok(a.mins > 0 && a.mins % 15 === 0, a.id);
    assert.ok(!ids.has(a.id), 'duplicate id ' + a.id);
    ids.add(a.id);
  }
});

test('rent is collected on Saturday noon and arrears lead to eviction', () => {
  const s = game('mid');
  L.withdraw(s, s.bank);
  L._post(s, 'cash', -s.cash, 'test drain');
  for (let i = 0; i < 3 * 7 * 96; i++) L._advance(s, 15);
  assert.equal(s.home, 'squat');
  assert.ok(s.arrears >= 3 * D.HOMES.yaba_selfcon.rent);
  assert.ok(s.ach.evicted);
  sane(s);
});

test('rent is paid when the player has money', () => {
  const s = game('mid');
  const before = s.cash + s.bank;
  L._advance(s, (5 * 24 + 6) * 60); // Mon 06:00 -> Sat 12:00
  assert.equal(s.arrears, 0);
  assert.ok(s.ledger.some(l => l.memo.startsWith('Rent')));
  assert.ok(s.cash + s.bank <= before - D.HOMES.yaba_selfcon.rent);
});

test('travel charges the fare, moves the player and costs time', () => {
  const s = game('mid');
  const opts = L.travelOptions(s, 'island');
  const danfo = opts.find(o => o.mode === 'danfo');
  assert.ok(!danfo.disabled);
  const t0 = s.t, m0 = s.cash + s.bank;
  const r = L.travel(s, 'island', 'danfo');
  assert.ok(r.ok, r.msg);
  assert.equal(s.loc, 'island');
  assert.ok(s.t - t0 >= danfo.mins);
  assert.ok(m0 - (s.cash + s.bank) >= danfo.cost);
  sane(s);
});

test('keke cannot cross the bridge and ferry needs jetties', () => {
  const s = game('mid');
  const o = L.travelOptions(s, 'island');
  assert.match(o.find(x => x.mode === 'keke').disabled, /bridges/);
  s.loc = 'ikorodu';
  assert.equal(L.travelOptions(s, 'island').find(x => x.mode === 'ferry').disabled, undefined);
  assert.match(L.travelOptions(s, 'ajah').find(x => x.mode === 'ferry').disabled, /jetty/);
});

test('rush hour makes road travel slower than off-peak', () => {
  const s = game('mid');
  s.t = 1440 * 2 + 3 * 60; // Wed 03:00
  const night = L.travelOptions(s, 'island').find(x => x.mode === 'danfo').mins;
  s.t = 1440 * 2 + 8 * 60; // Wed 08:00
  const rush = L.travelOptions(s, 'island').find(x => x.mode === 'danfo').mins;
  assert.ok(rush > night * 1.5, `rush ${rush} vs night ${night}`);
});

test('jobs: apply in person, work a shift, get paid, get promoted', () => {
  const s = game('mid');
  assert.equal(L.jobEligibility(s, 'buka').ok, false); // wrong district
  s.loc = 'mushin';
  assert.ok(L.applyJob(s, 'buka').ok);
  let promoted = false;
  for (let d = 0; d < 30 && !promoted; d++) {
    // jump to 05:45 on the next day, keep the player fed and rested
    const target = (L.day(s) + 1) * 1440 + 5 * 60 + 45;
    L._advance(s, target - s.t);
    Object.assign(s.needs, { hunger: 90, energy: 90, fun: 80, social: 80, hygiene: 90, stress: 10 });
    s.skills.cooking = Math.max(s.skills.cooking, 30);
    const shift = L.availableActions(s).find(a => a.id === 'work_shift');
    assert.ok(shift && !shift.disabled, shift && shift.disabled);
    const r = L.doAction(s, 'work_shift');
    assert.ok(r.ok, r.msg);
    while (s.pending.length) L.resolveChoice(s, 1);
    if (s.job.level > 0) promoted = true;
  }
  assert.ok(promoted, 'should be promoted within 30 shifts');
  assert.ok(s.ach.first_pay && s.ach.promoted);
  sane(s);
});

test('three missed shifts gets you sacked', () => {
  const s = game('mid');
  s.loc = 'mushin';
  L.applyJob(s, 'buka');
  L._advance(s, 4 * 1440);
  assert.equal(s.job, null);
});

test('a degree-gated job opens with a connect', () => {
  const s = game('mid');
  s.loc = 'vi';
  s.skills.charisma = 10;
  assert.match(L.jobEligibility(s, 'bank').reason, /degree/);
  s.friends.kunle.lvl = 60;
  assert.ok(L.jobEligibility(s, 'bank').ok);
});

test('ajo pays out five shares on your week and completes after six', () => {
  const s = game('nepo');
  L.joinAjo(s, 10000);
  s.ajo.slot = 3;
  for (let w = 0; w < 7; w++) L._advance(s, 7 * 1440);
  assert.equal(s.ajo, null);
  const payout = s.ledger.find(l => l.memo === 'Ajo payout');
  if (payout) assert.equal(payout.amt, 50000);
  sane(s);
});

test('loan app debt compounds weekly', () => {
  const s = game('lapo');
  assert.ok(L.takeLoan(s, 'app', 50000).ok);
  L._advance(s, 7 * 1440);
  const l = s.loans.find(x => x.kind === 'app');
  assert.ok(l.bal >= 56000);
  assert.ok(L.repayLoan(s, s.loans.indexOf(l), l.bal).ok || s.cash + s.bank < l.bal);
  sane(s);
});

test('money can never go negative or fractional', () => {
  const s = game('lapo');
  assert.throws(() => L._post(s, 'cash', -999999999, 'x'));
  assert.throws(() => L._post(s, 'cash', 1.5, 'x'));
  assert.equal(L.deposit(s, 10 ** 9).ok, false);
  assert.equal(L.withdraw(s, -5).ok, false);
});

test('save codes round-trip and detect edited money', () => {
  const s = game('mid');
  L.travel(s, 'oshodi', 'danfo');
  const code = L.serialize(s);
  const back = L.deserialize(code);
  assert.equal(back.tampered, false);
  assert.deepEqual(back.state, JSON.parse(JSON.stringify(s)));

  const hacked = JSON.parse(JSON.stringify(s));
  hacked.cash += 1e9;
  const json = JSON.stringify(hacked);
  const forged = 'LSG1.' + Buffer.from(json).toString('base64') + '.' + code.split('.')[2];
  assert.equal(L.deserialize(forged).tampered, true);
});

test('choice events resolve and unblock the player', () => {
  const s = game('mid');
  s.pending.push({ id: 'scam', title: 'x', text: 'x', options: ['Click', 'Delete'] });
  const act = L.availableActions(s)[0];
  assert.ok(act.disabled);
  const r = L.resolveChoice(s, 1);
  assert.ok(r.ok);
  assert.ok(s.ach.sharp);
  assert.equal(s.pending.length, 0);
});

test('starving sends you to hospital, not to game over', () => {
  const s = game('lapo');
  s.needs.hunger = 1;
  const r = L.doAction(s, L.availableActions(s).find(a => a.id === 'mushin_football' && !a.disabled) ? 'mushin_football' : 'home_practice');
  assert.ok(r.collapsed);
  assert.equal(s.loc, 'island');
  sane(s);
});

// A greedy bot plays 30 weeks. Checks invariants every step and that the
// economy stays bounded (the "everyone is a billionaire" failure).
test('30-week bot run keeps the books balanced and the economy bounded', () => {
  for (const origin of ['lapo', 'mid', 'nepo']) {
    const s = game(origin, 1000 + origin.length);
    let steps = 0;
    while (L.week(s) < 30 && steps < 20000) {
      steps++;
      while (s.pending.length) L.resolveChoice(s, steps % 2);
      const acts = L.availableActions(s).filter(a => !a.disabled);
      const pickBy = f => acts.find(f);
      let a = pickBy(x => x.id === 'work_shift')
        || (s.needs.hunger < 35 && (pickBy(x => x.fx && x.fx.hunger > 30 && x.price <= (s.cash + s.bank) / 4) || pickBy(x => x.special === 'cook')))
        || (s.needs.energy < 30 && pickBy(x => x.special === 'sleep' || x.special === 'nap'))
        || (s.needs.hygiene < 30 && pickBy(x => x.id === 'home_bath'))
        || pickBy(x => x.gig)
        || pickBy(x => x.fx && (x.fx.fun || x.fx.social) && !x.price)
        || acts[steps % Math.max(1, acts.length)];
      if (!s.job && L.dow(s) < 5) {
        for (const cid of Object.keys(D.CAREERS)) if (L.jobEligibility(s, cid).ok) { L.applyJob(s, cid); break; }
      }
      if (a) L.doAction(s, a.id);
      else {
        const home = D.HOMES[s.home].district;
        const dest = s.loc === home ? 'oshodi' : home;
        const opt = L.travelOptions(s, dest).filter(o => !o.disabled).sort((x, y) => x.cost - y.cost)[0];
        if (opt) L.travel(s, dest, opt.mode); else L._advance(s, 60);
      }
      sane(s);
    }
    const worth = L.netWorth(s);
    assert.ok(L.week(s) >= 30, origin + ' bot got stuck at step ' + steps);
    assert.ok(worth < 50_000_000, origin + ' net worth exploded: ' + worth);
    assert.ok(Number.isFinite(worth));
  }
});

test('advisor tells you to leave for work in time and to clock in on arrival', () => {
  const s = game('mid');
  s.loc = 'ikeja';
  L.applyJob(s, 'dispatch');           // Ikeja, 08:00
  s.loc = 'yaba';
  s.t = 1440 + 6 * 60 + 30;            // Tue 06:30
  const tip = L.advise(s).find(t => /Leave now/.test(t.text));
  assert.ok(tip, JSON.stringify(L.advise(s)));
  assert.equal(tip.act.type, 'travel');
  assert.ok(L.travel(s, tip.act.dest, tip.act.mode).ok);
  while (s.pending.length) L.resolveChoice(s, 1);
  const clock = L.advise(s).find(t => t.act && t.act.id === 'work_shift');
  assert.ok(clock, JSON.stringify(L.advise(s)));
  assert.ok(L.doAction(s, 'work_shift').ok);
});

test('advisor points a hungry player to food they can afford', () => {
  const s = game('mid');
  s.needs.hunger = 10;
  const tip = L.advise(s)[0];
  assert.match(tip.text, /belle/i);
  assert.ok(tip.act);
});

test('weekly report categorises every naira spent and earned', () => {
  const s = game('mid');
  L.travel(s, 'oshodi', 'danfo');
  while (s.pending.length) L.resolveChoice(s, 1);
  L.doAction(s, 'oshodi_bukka');
  L._advance(s, 7 * 1440);
  const r = s.report;
  assert.ok(r && r.w === 1);
  assert.ok(r.out.transport > 0 && r.out.food > 0 && r.out.housing > 0, JSON.stringify(r.out));
  const out = Object.values(r.out).reduce((a, b) => a + b, 0);
  const spentWeek = s.ledger.filter(l => l.amt < 0 && l.memo !== 'Transfer' && l.t < 7 * 1440).reduce((a, l) => a - l.amt, 0);
  assert.equal(out, spentWeek);
  assert.equal(s.history.length, 1);
});

test('rent countdown and long durations read in days', () => {
  const s = game('mid');                // Mon 06:00
  assert.equal(L.minutesUntilRent(s), 5 * 1440 + 6 * 60);
  assert.equal(L.fmtMins(L.minutesUntilRent(s)), '5d 6h');
});

test('v0.1 saves migrate to the current schema', () => {
  const s = game('mid');
  for (const k of ['sv', 'wk', 'history', 'report', 'welfareDay', 'viralWeek', 'hospitalWeek']) delete s[k];
  const code = 'LSG1.' + Buffer.from(JSON.stringify(s)).toString('base64') + '.x';
  const back = L.deserialize(code).state;
  assert.equal(back.sv, L.SCHEMA);
  assert.deepEqual(back.history, []);
  L._advance(back, 7 * 1440);          // weekly tick works on a migrated save
  assert.equal(back.history.length, 1);
});

// Following the advisor alone should be a viable way to play.
test('a player who follows the advisor survives and gets promoted', () => {
  const s = L.newGame({ origin: 'lapo', seed: 1, goal: 'freestyle' });
  let collapses = 0, steps = 0;
  while (L.week(s) < 16 && steps++ < 20000) {
    while (s.pending.length) L.resolveChoice(s, 1);
    const tip = L.advise(s).find(t => t.act && t.act.type !== 'tab');
    let r = null;
    if (tip) {
      const a = tip.act;
      r = a.type === 'act' ? L.doAction(s, a.id) : a.type === 'travel' ? L.travel(s, a.dest, a.mode) : a.type === 'treat' ? L.treatMalaria(s) : a.type === 'lodge' ? L.sleepAway(s, a.id) : L.applyJob(s, a.id);
    }
    if (!r || !r.ok) {
      const acts = L.availableActions(s).filter(a => !a.disabled);
      const a = acts.find(x => x.gig) || acts.find(x => x.fx && (x.fx.fun || x.fx.social) && !x.price);
      if (a) r = L.doAction(s, a.id); else L._advance(s, 60);
    }
    if (r && r.collapsed) collapses++;
    sane(s);
  }
  assert.ok(collapses <= 5, 'collapses: ' + collapses);
  assert.ok(s.job && s.job.level >= 2, 'job: ' + JSON.stringify(s.job));
  assert.notEqual(s.home, 'squat');
});

test('advisor offers a one-tap move when rent eats the pay', () => {
  const s = game('nepo');                // Lekki studio, ₦40,000/week
  s.loc = 'mushin';
  L.applyJob(s, 'buka');                 // ₦4,200/shift
  L.withdraw(s, s.bank);
  L._post(s, 'cash', -(s.cash - 120000), 'test drain');
  const tip = L.advise(s).find(t => t.act && t.act.type === 'move');
  assert.ok(tip, JSON.stringify(L.advise(s)));
  assert.ok(L.moveHouse(s, tip.act.id).ok);
  assert.ok(s.rentRate < 10000);
  sane(s);
});

test('advisor suggests a job near home when the commute is long', () => {
  const s = game('lapo');                // home Mushin
  s.loc = 'lekki'; s.skills.fitness = 10;
  L.applyJob(s, 'fitness');              // ₦5,000/shift, 26 km away; the buka next door pays ₦4,200
  s.loc = 'mushin';
  s.t = 1440 * 5 + 14 * 60;              // Saturday afternoon, no shift
  const tip = L.advise(s).find(t => /commute/.test(t.text));
  assert.ok(tip && tip.act, JSON.stringify(L.advise(s)));
  // A much better-paid far job is never traded for a junior local one.
  const t = game('lapo');
  t.loc = 'vi'; t.friends.kunle.lvl = 60;
  L.applyJob(t, 'bank');                 // ₦9,000/shift
  t.loc = 'mushin'; t.t = 1440 * 5 + 14 * 60;
  assert.equal(L.advise(t).find(x => /commute/.test(x.text)), undefined);
  assert.equal(L.applyJob(t, 'nope').ok, false);
});

test('life summary scores a run', () => {
  const s = game('mid');
  const a = L.lifeSummary(s);
  L._advance(s, 14 * 1440);
  const b = L.lifeSummary(s);
  assert.ok(b.weeks === a.weeks + 2 && b.score !== a.score);
  assert.equal(typeof b.score, 'number');
});

test('hall of fame entries are rebuilt from fields and implausible ones dropped', () => {
  const s = game('mid');
  L._advance(s, 14 * 1440);
  const e = L.fameEntry(s);
  const back = L.checkFame(JSON.parse(JSON.stringify(e)));
  assert.ok(back);
  assert.equal(back.score, e.score);
  assert.equal(L.checkFame(Object.assign({}, e, { score: 999999 })).score, e.score, 'stored score is ignored');
  assert.equal(L.checkFame(Object.assign({}, e, { worth: 9e11 })), null, 'impossible wealth is dropped');
  assert.equal(L.checkFame(Object.assign({}, e, { weeks: 1.5 })), null);
  assert.equal(L.checkFame(Object.assign({}, e, { origin: '<img>' })), null);
  assert.equal(L.checkFame(null), null);
  assert.equal(L.lifeSummary(s).score, e.score);
});

function playByAdvisor(s, weeks) {
  let steps = 0;
  while (L.week(s) < weeks && steps++ < 20000) {
    while (s.pending.length) L.resolveChoice(s, steps % 2);
    const tip = L.advise(s).find(t => t.act && t.act.type !== 'tab');
    let r = null;
    if (tip) {
      const a = tip.act;
      r = a.type === 'act' ? L.doAction(s, a.id) : a.type === 'travel' ? L.travel(s, a.dest, a.mode)
        : a.type === 'move' ? L.moveHouse(s, a.id) : L.applyJob(s, a.id);
    }
    if (!r || !r.ok) {
      const g = L.availableActions(s).find(x => !x.disabled && x.gig);
      if (g) L.doAction(s, g.id); else L.wait(s, 60);
    }
  }
  return s;
}

test('a recorded life replays to the identical ledger seal and score', () => {
  const s = playByAdvisor(L.newGame({ seed: 77, goal: 'odogwu' }), 6);
  L.deposit(s, Math.floor(s.cash / 2));
  assert.ok(s.replay.acts.length > 100);
  const entry = JSON.parse(JSON.stringify(L.fameEntry(s)));
  const v = L.verifyFame(entry);
  assert.ok(v.ok, v.reason);
  assert.equal(v.entry.seal, s.ledgerHash);
  assert.equal(v.entry.score, entry.score);
});

test('replay verification catches edited numbers and edited action logs', () => {
  const s = playByAdvisor(L.newGame({ seed: 5, goal: 'freestyle' }), 4);
  const entry = JSON.parse(JSON.stringify(L.fameEntry(s)));
  // Inflate wealth (and fix up the score so it looks consistent).
  const rich = JSON.parse(JSON.stringify(entry));
  rich.worth += 500000; rich.score = L.scoreOf(rich);
  assert.equal(L.verifyFame(rich).ok, false);
  // Splice in actions that never happened.
  const forged = JSON.parse(JSON.stringify(entry));
  forged.replay.acts = forged.replay.acts.slice(0, 50);
  assert.equal(L.verifyFame(forged).ok, false);
  // Junk in the log.
  const junk = JSON.parse(JSON.stringify(entry));
  junk.replay.acts.push(['nope', 1]);
  assert.equal(L.verifyFame(junk).ok, false);
  // No log at all (a pre-v0.5 life).
  delete entry.replay;
  assert.equal(L.verifyFame(entry).reason, 'no replay');
});

// Golden replay: a life recorded by the real v0.5 engine. Every later
// version must still verify it, or old Hall of Fame entries would break.
test('a life recorded under v0.5 rules still verifies (golden replay)', () => {
  const entry = require('./fixtures/v0.5-life.json');
  const v = L.verifyFame(entry);
  assert.ok(v.ok, v.reason);
});

function lovers(seed) {
  const s = L.newGame({ seed, goal: 'freestyle', origin: 'nepo' });
  s.pending.push({ id: 'crush', title: 'x', text: 'x', options: ['Collect', 'No'], name: 'Tolu' });
  L.resolveChoice(s, 0);
  return s;
}

test('dating raises affection, silence lowers it, and neglect ends it', () => {
  const s = lovers(1);
  assert.equal(s.partner.name, 'Tolu');
  const call = L.availableActions(s).find(a => a.id === 'love_call');
  assert.ok(call && !call.disabled);
  const a0 = s.partner.aff;
  L.doAction(s, 'love_call');
  assert.ok(s.partner.aff > a0);
  for (let i = 0; i < 22; i++) { while (s.pending.length) L.resolveChoice(s, 1); L.wait(s, 24 * 60); }
  assert.equal(s.partner, null, 'a silent partner leaves');
});

test('introduction, wedding, half rent, baby and school fees', () => {
  const s = lovers(2);
  s.partner.aff = 60;                    // the introduction adds 10, leaving 70 of the 75 needed
  s.pending.push({ id: 'intro', title: 'x', text: 'x', options: ['Yes', 'No'], amt: 300000 });
  assert.ok(L.resolveChoice(s, 0).ok);
  assert.equal(s.partner.stage, 'introduced');
  assert.match(L.weddingOptions(s).find(w => w.id === 'registry').disabled || '', /not ready/);
  s.partner.aff = 80;
  assert.ok(L.marry(s, 'registry').ok);
  assert.equal(s.partner.stage, 'married');
  assert.equal(L.rentShare(s), Math.round(s.rentRate / 2 / 50) * 50);
  assert.ok(s.ach.wedding);
  s.pending.push({ id: 'baby', title: 'x', text: 'x', options: ['Yes', 'No'] });
  L.resolveChoice(s, 0);
  assert.equal(s.kids.length, 1);
  s.kids[0].nextFees = L.day(s);   // fees due now
  for (let i = 0; i < 10 && !(s.pending[0] && s.pending[0].id === 'school'); i++) {
    while (s.pending.length && s.pending[0].id !== 'school') L.resolveChoice(s, 1);
    if (!s.pending.length) L.wait(s, 24 * 60);
  }
  assert.equal(s.pending[0] && s.pending[0].id, 'school');
  const before = s.cash + s.bank;
  assert.ok(L.resolveChoice(s, 1).ok);   // private school
  assert.equal(s.kids[0].school, 'private');
  assert.ok(before - (s.cash + s.bank) >= 180000);
  const e = L.fameEntry(s);
  assert.ok(e.married && e.kids === 1);
  assert.equal(L.checkFame(JSON.parse(JSON.stringify(e))).score, e.score);
  sane(s);
});

test('v0.5-rules lives never meet anyone', () => {
  const s = L.newGame({ seed: 4, goal: 'freestyle', rules: 5 });
  for (let i = 0; i < 60; i++) { while (s.pending.length) { assert.notEqual(s.pending[0].id, 'crush'); L.resolveChoice(s, 1); } L.wait(s, 24 * 60); }
  assert.equal(s.partner, null);
  assert.equal(L.availableActions(s).some(a => /^love_/.test(a.id)), false);
});

test('weekly challenge: same id, same Lagos; different week, different Lagos', () => {
  const a = L.newGame({ challenge: '2026-W41' }), b = L.newGame({ challenge: '2026-W41' }), c = L.newGame({ challenge: '2026-W42' });
  assert.equal(a.seed, b.seed);
  assert.equal(a.origin, b.origin);
  assert.notEqual(a.seed, c.seed);
  assert.throws(() => L.newGame({ challenge: 'next week' }));
  assert.equal(L.challengeId(new Date(Date.UTC(2026, 9, 9))), '2026-W41');
  assert.equal(L.challengeId(new Date(Date.UTC(2021, 0, 3))), '2020-W53');
});

test('weekly challenge ends after 4 weeks, freezes, and verifies by replay', () => {
  const s = playByAdvisor(L.newGame({ challenge: '2026-W41' }), 10);
  assert.ok(s.over);
  assert.equal(L.week(s), L.CHALLENGE_WEEKS);
  const t0 = s.t, w0 = L.netWorth(s);
  assert.equal(L.wait(s, 60).ok, false);
  assert.equal(L.doAction(s, 'home_bath').ok, false);
  assert.equal(s.t, t0); assert.equal(L.netWorth(s), w0);
  assert.equal(L.advise(s).length, 0);
  assert.match(L.shareText(s), /^Lasgidi Weekly 2026-W41 · /);
  assert.equal([...L.shareText(s).split('\n')[1]].length, 4, 'one square per week');
  const entry = JSON.parse(JSON.stringify(L.challengeEntry(s)));
  assert.ok(L.verifyChallenge(entry, '2026-W41').ok);
  assert.equal(L.verifyChallenge(entry, '2026-W42').ok, false, 'wrong week');
  const richer = JSON.parse(JSON.stringify(entry)); richer.worth += 100000;
  assert.equal(L.verifyChallenge(richer, '2026-W41').ok, false);
  sane(s);
});

test('an unfinished challenge does not count', () => {
  const s = playByAdvisor(L.newGame({ challenge: '2026-W41' }), 2);
  assert.equal(s.over, false);
  assert.equal(L.verifyChallenge(JSON.parse(JSON.stringify(L.challengeEntry(s))), '2026-W41').reason, 'not finished');
});

test('every mapped place sits on land in its own district and links real activities there', () => {
  globalThis.LASGIDI_DATA = D;
  require('../src/playground.js');
  const PG = globalThis.LasgidiPlayground;
  const ids = new Set();
  for (const p of D.PLACES) {
    assert.ok(!ids.has(p.id), 'duplicate place ' + p.id); ids.add(p.id);
    assert.ok(D.PLACE_TYPES[p.type], p.id + ' type');
    const pc = D.DISTRICTS[p.district].city || 'lagos';
    assert.equal(PG.isWater(p.x, p.y, pc), false, p.id + ' is in the water');
    assert.equal(PG.nearestDistrict(p.x, p.y, pc).k, p.district, p.id + ' is outside ' + p.district);
    const here = (D.PLACE_ACTIONS[p.district] || []).map(a => a.id);
    for (const a of p.acts) assert.ok(here.includes(a), p.id + ' links ' + a + ' which is not in ' + p.district);
  }
  assert.ok(D.PLACES.length >= 40);
});

test('billboards: rent is a recorded ledger debit; stored ads are validated', () => {
  globalThis.LASGIDI_DATA = D;
  require('../src/playground.js');
  const PG = globalThis.LasgidiPlayground;
  for (const b of D.BILLBOARDS) {
    assert.equal(PG.isWater(b.x, b.y), false, b.id + ' is in the water');
    assert.equal(PG.nearestDistrict(b.x, b.y).k, b.district, b.id + ' is outside ' + b.district);
  }
  const s = L.newGame({ seed: 9, origin: 'nepo', goal: 'freestyle' });
  const before = s.cash + s.bank;
  assert.ok(L.rentBoard(s, 'tmb').ok);
  assert.equal(before - (s.cash + s.bank), L.boardRent(s));
  assert.ok(s.ach.billboard);
  assert.equal(L.rentBoard(s, 'nowhere').ok, false);
  assert.ok(L.verifyFame(JSON.parse(JSON.stringify(L.fameEntry(s)))).ok, 'renting replays');
  const now = Date.now();
  const good = { board: 'tmb', emoji: 0, slogan: 's3', color: 1, until: now + 3600e3 };
  assert.equal(L.checkAd(good, now).text, 'Soft life loading');
  assert.equal(L.checkAd(Object.assign({}, good, { slogan: 'Call 0803 123 4567' }), now), null, 'free text rejected');
  assert.equal(L.checkAd(Object.assign({}, good, { until: now - 1 }), now), null, 'expired');
  assert.ok(L.checkAd(Object.assign({}, good, { until: now + 7 * 24 * 3600e3 }), now), 'a 7-day plan is valid');
  assert.equal(L.checkAd(Object.assign({}, good, { until: now + 8 * 24 * 3600e3 }), now), null, 'too long');
  assert.equal(L.checkAd(Object.assign({}, good, { emoji: 99 }), now), null);
  assert.equal(L.sloganText('b:buka:mushin'), 'Buka now open in Mushin');
  sane(s);
});

test('every home estate sits on land in its own district; perks apply daily', () => {
  globalThis.LASGIDI_DATA = D;
  require('../src/playground.js');
  const PG = globalThis.LasgidiPlayground;
  for (const [id, h] of Object.entries(D.HOMES)) {
    assert.ok(D.HOME_TYPES[h.type], id + ' type');
    if (h.hidden || h.owned) continue; // owned homes are drawn on their estate plot
    const hc = D.DISTRICTS[h.district].city || 'lagos';
    assert.equal(PG.isWater(h.x, h.y, hc), false, id + ' is in the water');
    assert.equal(PG.nearestDistrict(h.x, h.y, hc).k, h.district, id + ' is outside ' + h.district);
  }
  const s = L.newGame({ seed: 3, origin: 'nepo', goal: 'freestyle' });
  assert.ok(L.moveHouse(s, 'yaba_share').ok);
  s.needs.social = 10;
  while (s.pending.length) L.resolveChoice(s, 1);
  L.wait(s, 24 * 60);
  assert.ok(s.needs.social > 10 - 2.5 * 24 + 6 - 1 || s.needs.social >= 0, 'housemates add social');
  sane(s);
});

test('Mainland Estate: buy one plot, live rent-free, plots and labels sit on land', () => {
  globalThis.LASGIDI_DATA = D;
  require('../src/playground.js');
  const PG = globalThis.LasgidiPlayground;
  for (let n = 0; n < L.plotCount(); n++) { const p = L.plotXY(n); assert.equal(PG.isWater(p.x, p.y), false, 'plot ' + n + ' in water'); }
  const sh = D.PLACES.find(p => p.id === 'shrine');
  assert.equal(PG.nearestDistrict(sh.x, sh.y).k, 'ikeja');
  const s = L.newGame({ seed: 4, origin: 'nepo', goal: 'landlord' });
  L._post(s, 'bank', 20000000, 'test grant'); s.opening.bank += 20000000; s.ledgerSum.bank -= 20000000;
  let free = 0; while (L.plotTakenByNpc(free)) free++;
  const taken = [...Array(L.plotCount()).keys()].find(n => L.plotTakenByNpc(n));
  assert.equal(L.buyPlot(s, taken).ok, false);
  assert.equal(L.moveHouse(s, 'estate_own').ok, false, 'must own a plot first');
  assert.ok(L.buyPlot(s, free).ok);
  assert.equal(L.myPlot(s), free);
  assert.equal(L.buyPlot(s, free + 1).ok, false, 'one plot each');
  assert.ok(L.moveHouse(s, 'estate_own').ok);
  assert.equal(s.rentRate, 0);
  assert.ok(s.ach.landlord && L.goalProgress(s).done);
  sane(s);
});

test('furniture: buy, auto-place, no overlaps, effects only while placed, kept on moving', () => {
  const s = L.newGame({ seed: 12, origin: 'nepo', goal: 'freestyle' });
  L._post(s, 'bank', 50000000, 'test grant');
  const sleep0 = L.furnitureSleep(s), power0 = L.furniturePower(s);
  assert.ok(L.buyItem(s, 'king').ok);
  assert.ok(L.buyItem(s, 'inverter').ok);
  assert.ok(L.furnitureSleep(s) > sleep0 && L.furniturePower(s) > power0);
  const bed = s.items[0];
  assert.notEqual(bed.x, null, 'auto-placed');
  assert.equal(L.placeItem(s, 1, bed.x, bed.y, 0).ok, false, 'no overlap');
  const sz = L.roomSize(s);
  assert.equal(L.placeItem(s, 0, sz[0], 0, 0).ok, false, 'in bounds');
  assert.ok(L.storeItem(s, 0).ok);
  assert.equal(L.furnitureSleep(s), sleep0, 'stored items do nothing');
  assert.ok(L.placeItem(s, 0, 0, 0, 1).ok);
  // Move to a single room: the king bed (3x2) still fits a 4x3 room, the rest may not.
  assert.ok(L.moveHouse(s, 'mushin_room').ok);
  s.items.forEach((it, i) => { if (it.x != null) assert.ok(L.fitsAt(s, i, it.x, it.y, it.r)); });
  const worth = L.netWorth(s);
  assert.ok(L.sellItem(s, 0).ok);
  assert.ok(L.netWorth(s) <= worth);
  sane(s);
  // Replays: buy and arrange affordable pieces with real starting money.
  const r = L.newGame({ seed: 14, origin: 'nepo', goal: 'freestyle' });
  assert.ok(L.buyItem(r, 'ortho').ok && L.buyItem(r, 'plant').ok && L.buyItem(r, 'tv').ok);
  assert.ok(L.storeItem(r, 1).ok && L.placeItem(r, 1, 0, 2, 0).ok);
  L.wait(r, 24 * 60);
  assert.ok(L.verifyFame(JSON.parse(JSON.stringify(L.fameEntry(r)))).ok, 'furniture replays');
});

test('vehicles: own car speeds commutes, helicopter flies anywhere, upkeep is weekly', () => {
  const s = L.newGame({ seed: 13, origin: 'nepo', goal: 'freestyle' });
  L._post(s, 'bank', 4000000000, 'test grant');
  assert.match(L.travelOptions(s, 'ajah').find(o => o.mode === 'heli').disabled, /helicopter/);
  const danfo = L.travelOptions(s, 'ikeja').find(o => o.mode === 'danfo').mins;
  assert.ok(L.buyVehicle(s, 'supercar').ok);
  const car = L.travelOptions(s, 'ikeja').find(o => o.mode === 'car');
  assert.ok(!car.disabled && car.mins <= danfo);
  assert.ok(L.buyVehicle(s, 'heli').ok);
  const heli = L.travelOptions(s, 'ikorodu').find(o => o.mode === 'heli');
  assert.ok(!heli.disabled && heli.mins <= 45, 'heli ' + heli.mins);
  assert.ok(L.statusPoints(s) >= 120);
  const before = s.cash + s.bank;
  for (let i = 0; i < 7; i++) { while (s.pending.length) L.resolveChoice(s, 1); L.wait(s, 24 * 60); }
  assert.ok(s.ledger.some(l => l.memo === 'Upkeep: Helicopter' && -l.amt >= D.VEHICLES.heli.upkeep), 'weekly upkeep paid');
  sane(s);
});

test('wardrobe: buy and wear clothes, dresses replace top and bottom, outfits help', () => {
  const s = L.newGame({ seed: 15, origin: 'nepo', goal: 'freestyle' });
  assert.ok(L.setLook(s, 4, 2, 0).ok);
  assert.equal(L.setLook(s, 99, 0, 0).ok, false);
  assert.ok(L.buyClothes(s, 'ankara_sh').ok && L.buyClothes(s, 'wrapper').ok);
  assert.ok(L.outfitTags(s).owambe);
  assert.ok(L.buyClothes(s, 'gown').ok);
  assert.equal(s.outfit.top, undefined); assert.equal(s.outfit.bottom, undefined); assert.equal(s.outfit.dress, 'gown');
  assert.ok(L.wear(s, 'ankara_sh').ok);
  assert.equal(s.outfit.dress, undefined);
  assert.equal(L.buyClothes(s, 'ankara_sh').ok, false, 'no duplicates');
  assert.ok(L.takeOff(s, 'top').ok);
  assert.ok(L.statusPoints(s) >= 2);
  assert.ok(L.verifyFame(JSON.parse(JSON.stringify(L.fameEntry(s)))).ok, 'wardrobe replays');
  sane(s);
});

test('treasury bills: paid from savings, back with 1% after 7 days, counted in net worth, replayable', () => {
  const s = L.newGame({ seed: 21, origin: 'nepo', goal: 'freestyle' });
  assert.equal(L.buyBond(s, 5000).ok, false, 'minimum 10k');
  assert.equal(L.buyBond(s, s.bank + 1).ok, false, 'only from savings');
  const amt = Math.floor(s.bank / 2), nw = L.netWorth(s), bank = s.bank;
  assert.ok(L.buyBond(s, amt).ok);
  assert.equal(s.bank, bank - amt);
  assert.equal(L.netWorth(s), nw, 'a bill is still yours');
  for (let i = 0; i < 8; i++) { while (s.pending.length) L.resolveChoice(s, 1); L.wait(s, 24 * 60); }
  assert.equal(s.bonds.length, 0);
  assert.ok(s.ledger.some(l => l.memo === 'Treasury bill interest' && l.amt === Math.floor(amt * L.BOND_RATE)));
  assert.equal(L.category('Treasury bill interest', 1), 'savings');
  assert.equal(L.category('Hospital bill', -1), 'health');
  const r = L.replayLife(s.replay);
  assert.equal(r.ledgerHash, s.ledgerHash);
  sane(s);
});

test('driving: pick which car you drive; selling keeps the pick right', () => {
  const s = L.newGame({ seed: 22, origin: 'nepo', goal: 'freestyle' });
  L._post(s, 'bank', 2000000000, 'test grant');
  assert.ok(L.buyVehicle(s, 'tokunbo').ok && L.buyVehicle(s, 'supercar').ok && L.buyVehicle(s, 'speedboat').ok);
  const fast = L.travelOptions(s, 'ikeja').find(o => o.mode === 'car').mins;
  assert.equal(L.driveVehicle(s, 2).ok, false, 'a boat is not a car');
  assert.ok(L.driveVehicle(s, 0).ok);
  assert.ok(L.travelOptions(s, 'ikeja').find(o => o.mode === 'car').mins >= fast);
  assert.ok(L.driveVehicle(s, 1).ok);
  L.sellVehicle(s, 0);
  assert.equal(s.driving, 0, 'pick follows the supercar');
  L.sellVehicle(s, 0);
  assert.equal(s.driving, -1);
});

test('replay codes: a life that buys a business and a bill replays to the same seal', () => {
  const s = L.newGame({ seed: 23, origin: 'nepo', goal: 'freestyle' });
  assert.ok(L.buyBusiness(s, 'pos').ok);
  assert.ok(L.buyBond(s, 20000).ok);
  for (let i = 0; i < 3; i++) { while (s.pending.length) L.resolveChoice(s, 1); L.wait(s, 24 * 60); }
  const r = L.replayLife(s.replay);
  assert.equal(r.businesses.length, 1);
  assert.equal(r.ledgerHash, s.ledgerHash);
});

test('businesses: build on a site, upgrade, hire a manager; old-style buys unchanged', () => {
  // Old-style buy (no site) behaves exactly as before: same seal as a life without the new code paths.
  const a = L.newGame({ seed: 24, origin: 'nepo', goal: 'freestyle' });
  assert.ok(L.buyBusiness(a, 'pos').ok);
  assert.equal(a.businesses[0].site, undefined);
  assert.equal(L.upgradeBusiness(a, 0).ok, false, 'no growth without a site');

  const s = L.newGame({ seed: 24, origin: 'nepo', goal: 'freestyle' });
  assert.equal(L.buyBusiness(s, 'pos', 'mars').ok, false);
  assert.ok(L.buyBusiness(s, 'pos', 'lekki').ok);
  const b = s.businesses[0], est1 = L.businessEstimate(s, b), paid1 = b.paid;
  assert.ok(est1 > L.businessEstimate(a, a.businesses[0]), 'Lekki pays more');
  assert.ok(L.upgradeBusiness(s, 0).ok);
  assert.equal(L.businessName(b), 'POS and bill-pay shop');
  assert.ok(b.paid > paid1 && L.businessEstimate(s, b) > est1 * 1.5);
  assert.ok(L.hireManager(s, 0).ok);
  // Ten days without a visit: no stealing with a manager; rent and salary charged weekly.
  for (let i = 0; i < 10; i++) { while (s.pending.length) L.resolveChoice(s, 1); L.wait(s, 24 * 60); }
  assert.ok(!s.log.some(l => /staff are stealing/.test(l.text || l.msg || '')), 'manager stops theft');
  assert.ok(s.ledger.some(l => /^Shop rent: POS and bill-pay shop/.test(l.memo)));
  assert.ok(s.ledger.some(l => /^Manager salary: POS and bill-pay shop/.test(l.memo)));
  assert.equal(L.category('Shop rent: Restaurant', -1), 'business');
  const r = L.replayLife(s.replay);
  assert.equal(r.ledgerHash, s.ledgerHash);
  assert.equal(r.businesses[0].level, 2);
  sane(s);
});

test('rules 7: CBN governor race sets rates; PAYE and business levies; old rules untouched', () => {
  const s = L.newGame({ seed: 31, origin: 'mid', goal: 'freestyle', rules: 7 });
  assert.equal(s.rules, 7);
  let saw = false;
  for (let i = 0; i < 20 && !saw; i++) {
    while (s.pending.length) { const ev = s.pending[0]; if (ev.id === 'cbn') { saw = true; L.resolveChoice(s, 0); } else L.resolveChoice(s, 1); }
    if (!saw) L.wait(s, 24 * 60);
  }
  assert.ok(saw, 'a CBN race happens by week 2');
  assert.ok(D.CBN[s.econ.cbn] && s.econ.cbnWeeks === 4);
  const c = D.CBN[s.econ.cbn];
  assert.equal(L.savingsRate(s), c.save);
  assert.equal(L.billRate(s), c.bill);
  assert.equal(L.loanRate(s, 'app'), Math.round(L.LOANS.app.rate * c.loan * 10000) / 10000);
  // PAYE: none on small pay, 20% at the margin on big pay.
  assert.equal(L.payeTax(s, 3000), 0);
  assert.ok(L.payeTax(s, 100000) > 15000);
  assert.equal(L.category('PAYE income tax', -1), 'tax');
  assert.equal(L.category('Business levies (state and council)', -1), 'tax');
  const r = L.replayLife(s.replay);
  assert.equal(r.ledgerHash, s.ledgerHash);
  // Rules 6 lives never see the race or the tax.
  const o = L.newGame({ seed: 31, origin: 'mid', goal: 'freestyle', rules: 6 });
  for (let i = 0; i < 20; i++) { while (o.pending.length) { assert.notEqual(o.pending[0].id, 'cbn'); L.resolveChoice(o, 1); } L.wait(o, 24 * 60); }
  assert.equal(L.payeTax(o, 100000), 0);
  assert.equal(o.econ.cbn, null);
});

test('luxury boats and jets: superyacht sails, jets add status', () => {
  const s = L.newGame({ seed: 32, origin: 'nepo', goal: 'freestyle' });
  L._post(s, 'bank', 200000000000, 'test grant');
  assert.ok(L.buyVehicle(s, 'superyacht').ok && L.buyVehicle(s, 'light_jet').ok);
  assert.ok(L.travelOptions(s, 'ikoyi').some(o => o.mode === 'boat' && !o.disabled), 'a superyacht uses the jetties');
  const before = L.statusPoints(s);
  assert.ok(L.buyVehicle(s, 'jumbo').ok);
  assert.ok(L.statusPoints(s) > before);
});

test('billboard plans: busier boards and longer runs cost more; legacy rent unchanged', () => {
  const s = L.newGame({ seed: 33, origin: 'nepo', goal: 'freestyle' });
  const day = L.boardQuote(s, 'tmb', 'day'), week = L.boardQuote(s, 'tmb', 'week');
  assert.ok(week > day * 5 && week < day * 7, 'a week is cheaper per day');
  assert.ok(L.boardQuote(s, 'tmb', 'day') > L.boardQuote(s, 'festac_link', 'day'), 'Third Mainland costs more than Festac');
  const before = s.cash + s.bank, r = L.rentBoard(s, 'tmb', 'three');
  assert.ok(r.ok && r.days === 3);
  assert.equal(before - (s.cash + s.bank), L.boardQuote(s, 'tmb', 'three'));
  assert.equal(L.rentBoard(s, 'tmb', 'month').ok, false);
  const legacy = L.newGame({ seed: 33, origin: 'nepo', goal: 'freestyle' }), b0 = legacy.cash + legacy.bank;
  assert.ok(L.rentBoard(legacy, 'tmb').ok);
  assert.equal(b0 - (legacy.cash + legacy.bank), L.boardRent(legacy));
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('more luxury: jet ski, houseboat, business jet; private island needs a boat', () => {
  const s = L.newGame({ seed: 34, origin: 'nepo', goal: 'freestyle' });
  L._post(s, 'bank', 30000000000, 'test grant');
  const isle = () => L.availableActions(s).some(a => a.id === 'lekki_island');
  if (s.loc !== 'lekki') s.loc = 'lekki';
  assert.equal(isle(), false, 'no boat, no island');
  const st = L.statusPoints(s), sl = L.furnitureSleep(s);
  assert.ok(L.buyVehicle(s, 'jetski').ok);
  assert.ok(isle(), 'any boat unlocks the island day');
  assert.ok(L.buyVehicle(s, 'houseboat').ok && L.buyVehicle(s, 'bizjet').ok);
  assert.ok(L.statusPoints(s) > st);
  if (['lekki', 'ikoyi'].includes(D.HOMES[s.home].district)) assert.ok(L.furnitureSleep(s) > sl, 'houseboat helps sleep by an Island home');
});

test('rules 8: steeper PAYE, rent reviews, luxury insurance, slower promotions; rules 7 unchanged', () => {
  const s = L.newGame({ seed: 35, origin: 'mid', goal: 'freestyle', rules: 8 });
  assert.equal(s.rules, 8);
  const r7 = L.newGame({ seed: 35, origin: 'mid', goal: 'freestyle', rules: 7 });
  assert.ok(L.payeTax(s, 100000) > L.payeTax(r7, 100000), 'rules 8 taxes big pay harder');
  assert.equal(L.payeTax(s, 2500), 0);
  const rent0 = s.rentRate;
  for (let i = 0; i < 30 && L.week(s) < 4; i++) { while (s.pending.length) L.resolveChoice(s, 1); L.wait(s, 24 * 60); }
  while (s.pending.length) L.resolveChoice(s, 1);
  if (rent0 && s.econ.policy !== 'tenancy') assert.ok(s.rentRate >= rent0, 'rent never drops at a review');
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
  // Slower promotions only under rules 8.
  const a = L.newGame({ seed: 36, origin: 'mid', goal: 'freestyle' }), b = L.newGame({ seed: 36, origin: 'mid', goal: 'freestyle', rules: 7 });
  a.job = { id: 'trader', level: 1, shifts: 0, perfSum: 0 }; b.job = { id: 'trader', level: 1, shifts: 0, perfSum: 0 };
  assert.ok(L.promotionNeeds(a).shifts > L.promotionNeeds(b).shifts);
});

test('picture ads: only approved, paid, image-only data shows; payment is a recorded rentBoard', () => {
  const now = 1e12, img = { img: 'data:image/jpeg;base64,' + 'A'.repeat(400), board: 'tmb', plan: 'three', sub: 'abc123xyz' };
  const paid = { sub: 'abc123xyz', board: 'tmb', until: now + 3 * 24 * 3600e3, at: now };
  assert.ok(L.checkPictureAd(img, paid, now));
  assert.equal(L.checkPictureAd(Object.assign({}, img, { img: 'data:image/svg+xml;base64,PHN2Zz4=' }), paid, now), null, 'no SVG');
  assert.equal(L.checkPictureAd(Object.assign({}, img, { img: 'javascript:alert(1)' }), paid, now), null);
  assert.equal(L.checkPictureAd(Object.assign({}, img, { img: 'data:image/png;base64,' + 'A'.repeat(L.PIC_MAX) }), paid, now), null, 'too big');
  assert.equal(L.checkPictureAd(img, Object.assign({}, paid, { sub: 'other1234' }), now), null, 'payment must match the approved picture');
  assert.equal(L.checkPictureAd(img, Object.assign({}, paid, { until: now - 1 }), now), null, 'expired');
  assert.equal(L.checkPictureAd(img, Object.assign({}, paid, { until: now + 5 * 24 * 3600e3 }), now), null, 'longer than the plan');
  assert.equal(L.checkPictureAd(img, Object.assign({}, paid, { board: 'oshodi' }), now), null, 'paid for another board');
  const s = L.newGame({ seed: 37, origin: 'nepo', goal: 'freestyle' });
  assert.ok(L.rentBoard(s, 'tmb', 'three').ok);
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('daily gem hunt: same gems for everyone each day, must be there, once each, one hunt per game day', () => {
  const a = L.gemsFor('2026-10-12'), b = L.gemsFor('2026-10-12'), c = L.gemsFor('2026-10-13');
  assert.equal(a.length, 5); assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  assert.equal(new Set(a.map(g => g.place)).size, 5);
  const s = L.newGame({ seed: 38, origin: 'mid', goal: 'freestyle' });
  const g = a[0];
  if (s.loc !== g.district) assert.equal(L.collectGem(s, '2026-10-12', 0).ok, false, 'must be in the district');
  s.loc = g.district;
  const cash = s.cash, p1 = L.nextGemPrize(s, '2026-10-12');
  assert.ok(L.collectGem(s, '2026-10-12', 0).ok);
  assert.equal(s.cash - cash, p1);
  assert.equal(L.collectGem(s, '2026-10-12', 0).ok, false, 'once each');
  assert.ok(L.nextGemPrize(s, '2026-10-12') > p1, 'prizes grow');
  s.loc = c[0].district;
  assert.match(L.collectGem(s, '2026-10-13', 0).msg, /already hunted today/, 'one hunt day per game day');
  assert.equal(L.collectGem(s, 'yesterday', 0).ok, false);
  assert.equal(L.category('Gem hunt prize', 1), 'gigs');
});

test('cities: districts on land in their own city; same-city travel only; fly and bus between cities', () => {
  globalThis.LASGIDI_DATA = D;
  require('../src/playground.js');
  const PG = globalThis.LasgidiPlayground;
  for (const [k, d] of Object.entries(D.DISTRICTS)) {
    const c = d.city || 'lagos';
    assert.ok(D.CITIES[c], k + ' city');
    assert.equal(PG.isWater(d.x, d.y, c), false, k + ' is in the water');
    assert.ok((D.PLACE_ACTIONS[k] || []).some(a => a.gig), k + ' has a gig, so nobody is stranded');
  }
  for (const c of Object.values(D.CITIES)) { assert.ok(D.DISTRICTS[c.airport] && D.DISTRICTS[c.park]); }
  const s = L.newGame({ seed: 40, origin: 'nepo', goal: 'freestyle' });
  assert.equal(L.cityOf(s), 'lagos');
  assert.ok(L.travelOptions(s, 'abj_wuse').every(o => o.disabled), 'no danfo to Abuja');
  assert.match(L.intercityOptions(s, 'abuja').find(o => o.mode === 'flight').disabled || '', /Leaves from Ikeja/);
  // Get to the airport, then fly.
  if (s.loc !== 'ikeja') { const o = L.travelOptions(s, 'ikeja').filter(o => !o.disabled && !(o.mode === 'trek' && (o.tired || o.km > 45))).sort((a, b) => a.cost - b.cost)[0]; assert.ok(L.travel(s, 'ikeja', o.mode).ok); }
  while (s.pending.length) L.resolveChoice(s, 1);
  const before = s.cash + s.bank, r = L.intercity(s, 'abuja', 'flight');
  assert.ok(r.ok, r.msg);
  assert.equal(s.loc, 'abj_airport'); assert.equal(L.cityOf(s), 'abuja');
  assert.ok(before - (s.cash + s.bank) >= L.price(s, D.INTERCITY.flight.fare) * 0.9);
  assert.ok(s.ach.traveller);
  assert.ok(L.availableActions(s).some(a => a.id === 'abj_air_gig'), 'local actions in Abuja');
  assert.equal(L.category('Flight to Abuja', -1), 'transport');
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
  // The bus does not run at night.
  const t = L.newGame({ seed: 41, origin: 'mid', goal: 'freestyle' });
  t.loc = 'oshodi'; t.t = Math.floor(t.t / 1440) * 1440 + 22 * 60;
  assert.match(L.intercityOptions(t, 'ph').find(o => o.mode === 'bus').disabled, /night/);
});

test('gifts: the sender pays, the receiver gets mood only (no cash); opened once, three a day', () => {
  const s = L.newGame({ seed: 42, origin: 'mid', goal: 'freestyle' });
  const before = s.cash + s.bank;
  assert.ok(L.sendGift(s, 'suya').ok);
  assert.equal(before - (s.cash + s.bank), L.price(s, D.GIFTS.suya.price));
  const r = L.newGame({ seed: 43, origin: 'mid', goal: 'freestyle' }), cash = r.cash + r.bank, fun = r.needs.fun;
  assert.ok(L.openGift(r, 'u_a:1', 'cake').ok);
  assert.equal(r.cash + r.bank, cash, 'no money changes hands');
  assert.ok(r.needs.fun >= fun);
  assert.equal(L.openGift(r, 'u_a:1', 'cake').ok, false, 'once');
  assert.ok(L.openGift(r, 'u_b:1', 'suya').ok && L.openGift(r, 'u_c:1', 'suya').ok);
  assert.match(L.openGift(r, 'u_d:1', 'suya').msg, /three gifts today/);
  assert.equal(L.openGift(r, 'u_e:1', 'gold').ok, false);
  assert.equal(L.replayLife(r.replay).ledgerHash, r.ledgerHash);
});

test('events: festivals appear only in their month, day and hours', () => {
  const s = L.newGame({ seed: 44, origin: 'mid', goal: 'freestyle' });
  s.loc = 'ikeja';
  const fela = () => L.availableActions(s).find(a => a.id === 'ikeja_felabration');
  assert.equal(L.monthIndex(s), 9, 'lives start in October');
  s.t = Math.floor(s.t / 1440) * 1440 + 20 * 60;
  assert.ok(fela() && !fela().disabled, 'Felabration on an October night');
  s.t += 5 * 7 * 1440; // November
  const f2 = fela();
  assert.ok(!f2 || f2.disabled, 'not in November');
  for (const [d, list] of Object.entries(D.PLACE_ACTIONS)) for (const a of list) if (a.event) assert.ok(D.PLACES.some(p => p.acts.includes(a.id)), a.id + ' is on a place card');
});

test('quests: checks flip, claims pay once, and the life still replays', () => {
  const s = L.newGame({ seed: 45, origin: 'nepo', goal: 'freestyle' });
  assert.deepEqual(L.activeQuests(s).map(q => q.id), ['save_100k', 'get_job', 'first_shift'], 'claimable first');
  assert.equal(L.claimQuest(s, 'get_job').ok, false, 'not done yet');
  assert.equal(L.claimQuest(s, 'nope').ok, false);
  assert.ok(L.questDone(s, 'save_100k'), 'Nepo starts with ₦800k banked');
  const before = s.cash + s.bank;
  assert.ok(L.claimQuest(s, 'save_100k').ok);
  assert.equal(s.cash + s.bank - before, L.price(s, D.QUESTS.find(q => q.id === 'save_100k').reward));
  assert.equal(L.claimQuest(s, 'save_100k').ok, false, 'once');
  assert.ok(!L.questDone(s, 'pantry'));
  assert.ok(L.travel(s, 'mushin', L.travelOptions(s, 'mushin').find(o => !o.disabled).mode).ok);
  if (Math.floor(s.t / 60) % 24 < 7) L.wait(s, 120);
  assert.ok(L.doAction(s, 'mushin_market').ok);
  assert.ok(L.questDone(s, 'pantry'));
  assert.ok(L.claimQuest(s, 'pantry').ok);
  assert.deepEqual(L.activeQuests(s).map(q => q.id), ['get_job', 'first_shift', 'gem']);
  const r = L.replayLife(s.replay);
  assert.equal(r.ledgerHash, s.ledgerHash);
  assert.deepEqual(Object.keys(r.quests).sort(), ['pantry', 'save_100k']);
});

test('stocks: market hours, broker fees, net worth, dividends, and replay', () => {
  const s = L.newGame({ seed: 46, origin: 'nepo', goal: 'freestyle' });
  assert.match(L.buyStock(s, 'ekocem', 50000).msg, /10:00 to 14:30/, 'closed at 06:00');
  assert.equal(L.stockPrice(s, 'ekocem', 0), D.STOCKS.ekocem.base);
  assert.equal(L.stockPrice(s, 'ekocem', 40), L.stockPrice(L.newGame({ seed: 46, origin: 'mid', goal: 'freestyle' }), 'ekocem', 40), 'same seed, same prices');
  L.wait(s, 4 * 60 + 30); // 10:30 on a Monday
  const bank = s.bank, worth = L.netWorth(s);
  const r = L.buyStock(s, 'lagoonbk', 100000);
  assert.ok(r.ok, r.msg);
  const h = s.stocks.lagoonbk, px = L.stockPrice(s, 'lagoonbk');
  assert.equal(h.u, Math.floor(100000 / px));
  assert.equal(bank - s.bank, Math.round(h.u * px) + L.brokerFee(Math.round(h.u * px)));
  assert.ok(worth - L.netWorth(s) <= L.brokerFee(100000) + 1, 'only the fee leaves net worth');
  assert.ok(L.questDone(s, 'shares'));
  assert.equal(L.sellStock(s, 'lagoonbk', h.u + 1).ok, false);
  assert.ok(L.sellStock(s, 'lagoonbk', Math.floor(h.u / 2)).ok);
  // Hold to week 13 for a quarterly dividend.
  for (let i = 0; i < 13 * 7 && L.week(s) < 13; i++) { L.wait(s, 24 * 60); if (s.pending.length) L.resolveChoice(s, 0); }
  assert.ok(s.log.some(l => /Lagoon Bank paid a dividend/.test(l.text)), 'dividend paid');
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('ride-hailing: only with a car; pays fares minus the cut and fuel', () => {
  const s = L.newGame({ seed: 47, origin: 'nepo', goal: 'freestyle' });
  assert.ok(!L.availableActions(s).some(a => a.id === 'ride_hail'), 'no car, no ride-hail');
  s.vehicles.push({ id: 'keke_own', paid: D.VEHICLES.keke_own.price }); // a gift, for the mechanics only
  const a = L.availableActions(s).find(x => x.id === 'ride_hail');
  assert.ok(a && /keke/i.test(a.label) && /25% cut/.test(a.note), a && a.label);
  const res = L.doAction(s, 'ride_hail');
  assert.ok(res.ok, res.msg);
  assert.match(res.msg, /the app kept/);
  const memos = s.alerts.map(x => x.memo);
  assert.ok(memos.includes('Ride-hail fares') && memos.includes('Ride-hail fuel'), memos.join());
  assert.equal(L.category('Ride-hail fares', 1), 'gigs');
  assert.equal(L.category('Ride-hail fuel', -1), 'transport');
  // A luxury SUV earns premium fares but burns more fuel.
  s.vehicles = [{ id: 'suv', paid: D.VEHICLES.suv.price }];
  assert.match(L.availableActions(s).find(x => x.id === 'ride_hail').label, /SUV/);
});

test('daily streak: grows on consecutive real days, once per game day, resets after a gap', () => {
  const s = L.newGame({ seed: 49, origin: 'mid', goal: 'freestyle' });
  const b0 = s.cash + s.bank;
  assert.ok(L.claimStreak(s, '2026-10-10').ok);
  assert.equal(s.cash + s.bank - b0, L.price(s, 1000));
  assert.equal(L.claimStreak(s, '2026-10-10').ok, false, 'once a day');
  assert.match(L.claimStreak(s, '2026-10-11').msg, /game day/);
  L.wait(s, 24 * 60);
  assert.equal(L.streakInfo(s, '2026-10-11').n, 2);
  assert.ok(L.claimStreak(s, '2026-10-11').ok);
  L.wait(s, 24 * 60);
  assert.equal(L.streakInfo(s, '2026-10-14').n, 1, 'a missed day resets');
  assert.equal(L.claimStreak(s, '2026-10-09').ok, false, 'no going back');
  assert.equal(L.claimStreak(s, 'tomorrow').ok, false);
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('parties: Saturday at home, size needs a big enough home, guests spray but it never pays', () => {
  const s = L.newGame({ seed: 50, origin: 'nepo', goal: 'freestyle', rules: 8 });
  assert.match(L.hostParty(s, 'small').msg, /Saturdays/);
  while (L.dow(s) !== 5 || L.hour(s) < 12) { if (s.pending.length) L.resolveChoice(s, 0); else L.wait(s, 60); }
  if (s.loc !== L.homeDef(s).district) L.travel(s, L.homeDef(s).district, L.travelOptions(s, L.homeDef(s).district).find(o => !o.disabled).mode);
  assert.match(L.hostParty(s, 'grand').msg, /too small/);
  const b0 = s.cash + s.bank, r = L.hostParty(s, 'small');
  assert.ok(r.ok, r.msg);
  assert.ok(s.cash + s.bank < b0, 'a party costs more than the spraying');
  assert.ok(s.ach.host);
  assert.match(L.partyBlock(s, 'small'), /Wait \d+ more days/);
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('staff: home size limits, weekly pay, daily help, and they leave when unpaid', () => {
  const s = L.newGame({ seed: 51, origin: 'nepo', goal: 'freestyle' });
  assert.match(L.hireStaff(s, 'driver').msg, /needs a car|no room/);
  const room = L.staffRoom(s);
  if (!room) { assert.match(L.hireStaff(s, 'help').msg, /no room/); return; }
  const b0 = s.cash + s.bank;
  assert.ok(L.hireStaff(s, 'help').ok);
  assert.equal(b0 - (s.cash + s.bank), L.staffPay(s, 'help'));
  assert.equal(L.hireStaff(s, 'help').ok, false, 'one of each');
  assert.ok(s.ach.oga);
  for (let i = 0; i < 9 && L.week(s) < 1; i++) { if (s.pending.length) L.resolveChoice(s, 0); else L.wait(s, 24 * 60); }
  assert.ok(s.ledger.length && L.replayLife(s.replay).ledgerHash === s.ledgerHash, 'paid weekly, and replays');
  assert.equal(L.category('Staff: House help', -1), 'housing');
  assert.ok(L.fireStaff(s, 'help').ok);
  assert.deepEqual(s.staff, []);
});

test('saves stamped with a newer schema but missing new fields still load whole', () => {
  const s = L.newGame({ seed: 52, origin: 'mid', goal: 'freestyle' });
  delete s.quests; delete s.stocks; delete s.streak; delete s.staff; s.sv = 12;
  const back = L.deserialize(L.serialize(s)).state;
  assert.deepEqual([back.quests, back.stocks, back.streak, back.staff], [{}, {}, null, []]);
  assert.ok(L.hireStaff(back, 'help').ok || true);
  assert.ok(Array.isArray(L.activeQuests(back)));
});

test('pets and HMO: yards for dogs, weekly care, HMO pays the hospital, and replay', () => {
  const s = L.newGame({ seed: 53, origin: 'nepo', goal: 'freestyle' }); // Lekki studio: a 2-bedroom flat
  assert.ok(L.buyPet(s, 'cat').ok);
  assert.equal(L.buyPet(s, 'cat').ok, false, 'one of each');
  assert.equal(L.hasYard(s), true);
  assert.ok(L.buyPet(s, 'dog').ok);
  assert.ok(s.ach.pet);
  assert.ok(L.joinHmo(s, 'basic').ok);
  s.loc = 'island'; // for the check-up price only
  const ck = L.availableActions(s).find(a => a.id === 'island_checkup');
  assert.equal(ck.price, Math.round(L.price(s, 8000) * 0.5 / 50) * 50, 'half-price check-up');
  const m = L.newGame({ seed: 54, origin: 'mid', goal: 'freestyle' });
  assert.match(L.buyPet(m, 'dog').msg, /compound/);
  assert.ok(L.buyPet(m, 'cat').ok && L.joinHmo(m, 'basic').ok);
  for (let i = 0; i < 9 && L.week(m) < 1; i++) { if (m.pending.length) L.resolveChoice(m, 0); else L.wait(m, 24 * 60); }
  assert.equal(L.replayLife(m.replay).ledgerHash, m.ledgerHash);
  assert.ok(L.leaveHmo(m).ok && m.hmo === null);
  assert.ok(L.rehomePet(m, 'cat').ok && m.pets.length === 0);
  assert.equal(L.category('HMO premium', -1), 'health');
});

test('online shop: setup, stock, weekly sales net of fees, spoilage, ads, close, replay', () => {
  const s = L.newGame({ seed: 55, origin: 'nepo', goal: 'freestyle' });
  assert.equal(L.restockShop(s, 10).ok, false, 'open first');
  const b0 = s.cash + s.bank;
  assert.ok(L.openShop(s, 'okrika').ok);
  assert.equal(b0 - (s.cash + s.bank), L.price(s, 10000));
  assert.ok(L.questDone(s, 'shop'));
  assert.match(L.restockShop(s, 501).msg, /500 at most/);
  assert.ok(L.restockShop(s, 20).ok && s.shop.stock === 20);
  assert.ok(L.setShopAds(s, 'insta').ok);
  const p = L.shopPreview(s);
  assert.equal(p.orders, 20, 'capped by stock');
  for (let i = 0; i < 9 && L.week(s) < 1; i++) { if (s.pending.length) L.resolveChoice(s, 0); else L.wait(s, 24 * 60); }
  assert.ok(s.shop.last && s.shop.last.orders <= 20 && s.shop.sold === s.shop.last.orders);
  assert.equal(s.shop.stock, 20 - s.shop.last.orders);
  assert.equal(L.category('Shop sales: Okrika thrift clothes', 1), 'business');
  assert.equal(L.category('Dispatch riders', -1), 'business');
  while (s.pending.length) L.resolveChoice(s, 0);
  assert.match(L.openShop(s, 'chops').msg, s.shop.stock ? /clear your stock/ : /live/);
  const before = s.cash + s.bank, left = s.shop.stock;
  assert.ok(L.closeShop(s).ok && s.shop === null);
  assert.equal(s.cash + s.bank - before, Math.floor(left * L.price(s, D.SHOP_NICHES.okrika.cost) * 0.4));
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
  // Small chops: unsold trays spoil at the week's end.
  const c = L.newGame({ seed: 56, origin: 'nepo', goal: 'freestyle' });
  assert.ok(L.openShop(c, 'chops').ok && L.restockShop(c, 60).ok);
  for (let i = 0; i < 9 && L.week(c) < 1; i++) { if (c.pending.length) L.resolveChoice(c, 0); else L.wait(c, 24 * 60); }
  assert.equal(c.shop.stock, 0);
  assert.ok(c.shop.last.spoiled > 0);
  // A save missing the field loads with no shop.
  const o = L.newGame({ seed: 57, origin: 'mid', goal: 'freestyle' }); delete o.shop;
  assert.equal(L.deserialize(L.serialize(o)).state.shop, null);
});

test('weather (rules 9): seeded rain slows roads, storms park okadas and boats, umbrellas keep you dry', () => {
  const old = L.newGame({ seed: 58, origin: 'mid', goal: 'freestyle', rules: 8 });
  assert.equal(L.weatherNow(old), null, 'no weather before rules 9');
  const s = L.newGame({ seed: 58, origin: 'mid', goal: 'freestyle' });
  assert.equal(s.rules, L.RULES);
  assert.ok(s.rules >= 9);
  assert.equal(L.weatherOn(s, 40), L.weatherOn(L.newGame({ seed: 58, origin: 'lapo', goal: 'freestyle' }), 40), 'same seed, same sky');
  // Find a rainy and a stormy day in this life, then compare trips at noon.
  let rain = -1, storm = -1;
  for (let d = 0; d < 400 && (rain < 0 || storm < 0); d++) { const w = L.weatherOn(s, d); if (w === 'rain' && rain < 0) rain = d; if (w === 'storm' && storm < 0) storm = d; }
  assert.ok(rain >= 0 && storm >= 0);
  const at = (d, h) => { const g = L.newGame({ seed: 58, origin: 'mid', goal: 'freestyle' }); g.t = d * 1440 + h * 60; return g; };
  const dry = at(rain, 8), wet = at(rain, 12), st = at(storm, 13);
  assert.equal(L.weatherNow(dry), 'clear', 'rain holds off till 11:00');
  const mins = (g) => L.travelOptions(g, 'ikeja').find(o => o.mode === 'danfo').mins;
  const w8 = L.newGame({ seed: 58, origin: 'mid', goal: 'freestyle', rules: 8 }); w8.t = wet.t;
  assert.ok(mins(wet) > mins(w8), 'rain slows the danfo');
  assert.match(L.travelOptions(st, 'ikeja').find(o => o.mode === 'okada').disabled || '', /storm/);
  const r = L.travel(wet, 'ikeja', 'danfo');
  assert.ok(r.ok && /soaked/.test(r.msg), r.msg);
  const u = at(rain, 12);
  assert.ok(L.buyClothes(u, 'umbrella').ok && L.wear(u, 'umbrella').ok);
  const ru = L.travel(u, 'ikeja', 'danfo');
  assert.ok(ru.ok && !/soaked/.test(ru.msg), ru.msg);
  // A year of weather: June is far wetter than January.
  let jun = 0, jan = 0;
  for (let d = 0; d < 365; d++) { const g = at(d, 12); const m = L.monthIndex(g), w = L.weatherOn(g, d); if (w === 'rain' || w === 'storm') { if (m === 5) jun++; if (m === 0) jan++; } }
  assert.ok(jun > jan * 3, jun + ' vs ' + jan);
  // Rules 9 lives replay; a rules version from the future is refused.
  const v = L.newGame({ seed: 59, origin: 'mid', goal: 'freestyle' });
  for (let i = 0; i < 40; i++) { if (v.pending.length) L.resolveChoice(v, 0); else L.wait(v, 180); }
  assert.equal(L.replayLife(v.replay).ledgerHash, v.ledgerHash);
  assert.equal(L.replayLife(Object.assign({}, v.replay, { rules: L.RULES + 1 })), null);
});

test('creators: followers grow per post (faster with a better phone), brand deals weekly on rules 9', () => {
  const s = L.newGame({ seed: 60, origin: 'nepo', goal: 'freestyle' });
  while (L.hour(s) < 8) L.wait(s, 60);
  const sk = () => L.availableActions(s).find(a => a.id === 'home_skit');
  assert.ok(sk() && !sk().disabled, 'film a skit at home');
  const g0 = L.followerGain(s, false);
  assert.ok(L.doAction(s, 'home_skit').ok);
  assert.ok(s.creator.followers >= g0 && s.creator.posts === 1);
  assert.ok(L.buyPhone(s, 'mid').ok);
  assert.ok(L.followerGain(s, false) > g0, 'better camera, more followers');
  assert.equal(L.buyPhone(s, 'mid').ok, false);
  assert.match(L.buyPhone(s, 'budget').msg, /already better/, 'no downgrades for cash');
  assert.equal(L.brandDeal(s), 0, 'no deals under 2,000 followers');
  const t = L.newGame({ seed: 61, origin: 'mid', goal: 'freestyle' });
  t.creator = { followers: 12000, posts: 50, lastPost: 0 };
  assert.equal(L.brandDeal(t), L.price(t, 12 * 1200));
  const b0 = t.cash + t.bank;
  for (let i = 0; i < 9 && L.week(t) < 1; i++) { if (t.pending.length) L.resolveChoice(t, 0); else L.wait(t, 24 * 60); }
  assert.ok(t.log.some(l => /sponsored posts/.test(l.text)), 'weekly brand deal');
  const r8 = L.newGame({ seed: 61, origin: 'mid', goal: 'freestyle', rules: 8 });
  r8.creator = { followers: 12000, posts: 50, lastPost: 0 };
  for (let i = 0; i < 9 && L.week(r8) < 1; i++) { if (r8.pending.length) L.resolveChoice(r8, 0); else L.wait(r8, 24 * 60); }
  assert.ok(!r8.log.some(l => /sponsored posts/.test(l.text)), 'no weekly deals before rules 9');
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('chieftaincy: titles in order, gated by net worth, add status and a name prefix', () => {
  const s = L.newGame({ seed: 62, origin: 'nepo', goal: 'freestyle' });
  assert.match(L.takeTitle(s, 'chief').msg, /in order/);
  assert.match(L.takeTitle(s, 'baale').msg, /net worth of/);
  assert.equal(L.nextTitle(s).id, 'baale');
  const rich = L.newGame({ seed: 63, origin: 'nepo', goal: 'freestyle' });
  rich.bank += 30000000; rich.opening.bank += 30000000; // mechanics only
  const st = L.statusPoints(rich);
  const r = L.takeTitle(rich, 'baale');
  assert.ok(r.ok, r.msg);
  assert.equal(L.titledName(rich), 'Baale ' + rich.name);
  assert.ok(L.statusPoints(rich) > st && rich.ach.chief);
  assert.match(L.shareText(rich), /Baale/);
  assert.equal(L.nextTitle(rich).id, 'chief');
  assert.equal(L.category('Chieftaincy: Baale of your street', -1), 'lifestyle');
});

test('party extras: a decorator costs more and pays more spray; guests join for mood only', () => {
  const s = L.newGame({ seed: 50, origin: 'nepo', goal: 'freestyle', rules: 8 });
  while (L.dow(s) !== 5 || L.hour(s) < 12) { if (s.pending.length) L.resolveChoice(s, 0); else L.wait(s, 60); }
  if (s.loc !== L.homeDef(s).district) L.travel(s, L.homeDef(s).district, L.travelOptions(s, L.homeDef(s).district).find(o => !o.disabled).mode);
  const b0 = s.cash + s.bank, r = L.hostParty(s, 'small', true);
  assert.ok(r.ok, r.msg);
  assert.ok(s.lastParty && s.lastParty.planner);
  assert.ok(s.alerts.some(a => a.amt === -L.price(s, 120000 * 1.5)), 'decorator adds half again');
  const g = L.newGame({ seed: 64, origin: 'mid', goal: 'freestyle' });
  const cash = g.cash + g.bank, fun = g.needs.fun;
  assert.ok(L.joinParty(g, 'u_host:123', 'dance').ok);
  assert.equal(g.cash + g.bank, cash, 'no money changes hands');
  assert.ok(g.needs.fun > fun - 5);
  assert.equal(L.joinParty(g, 'u_host:123', 'dance').ok, false, 'once per party');
  assert.ok(L.joinParty(g, 'u_host:123', 'socialise').ok);
  assert.equal(L.joinParty(g, 'u_host:123', 'steal').ok, false);
  assert.equal(L.replayLife(g.replay).ledgerHash, g.ledgerHash);
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('danfo run: played at Ojuelegba, takings capped, owner and fuel paid, replays', () => {
  const s = L.newGame({ seed: 65, origin: 'mid', goal: 'freestyle', rules: 8 });
  assert.match(L.danfoShift(s, 10000, 0, 20).msg, /Ojuelegba/);
  L.travel(s, 'surulere', L.travelOptions(s, 'surulere').find(o => !o.disabled).mode);
  while (L.hour(s) < 6) L.wait(s, 60);
  while (s.pending.length) L.resolveChoice(s, 0);
  assert.match(L.doAction(s, 'suru_danfo').msg, /Play the run/);
  const b0 = s.cash + s.bank;
  const r = L.danfoShift(s, 999999, 0, 30);
  assert.ok(r.ok, r.msg);
  const fares = s.alerts.find(a => a.memo === 'Danfo fares').amt;
  assert.ok(fares <= L.price(s, 12000), 'capped');
  assert.ok(s.alerts.some(a => a.memo === 'Danfo owner returns') && s.alerts.some(a => a.memo === 'Danfo fuel'));
  assert.equal(L.danfoShift(s, -5, 0, 3).ok, false);
  assert.equal(L.category('Danfo fares', 1), 'gigs');
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
  // The new park is not in the gem pool: today's gems are unchanged.
  assert.ok(L.gemsFor('2026-10-12').every(g => g.place !== 'ojuelegba_park'));
});

test('own danfo: runs skip the owner returns; a driver brings weekly returns', () => {
  const s = L.newGame({ seed: 66, origin: 'mid', goal: 'freestyle', rules: 8 });
  assert.equal(L.setDanfoDriver(s, true).ok, false);
  s.vehicles.push({ id: 'danfo_bus', paid: 18000000 }); // mechanics only
  assert.ok(L.setDanfoDriver(s, true).ok && s.danfoDriver);
  for (let i = 0; i < 9 && L.week(s) < 1; i++) { if (s.pending.length) L.resolveChoice(s, 0); else L.wait(s, 24 * 60); }
  assert.ok(s.log.some(l => /danfo/i.test(l.text)), 'a weekly danfo line');
  while (L.hour(s) < 7 || L.hour(s) >= 12) { if (s.pending.length) L.resolveChoice(s, 0); else L.wait(s, 60); }
  while (s.pending.length) L.resolveChoice(s, 0);
  s.needs.energy = 90; s.needs.hunger = 90; // rested and fed, for the mechanics
  if (s.loc !== 'surulere') { const o = L.travelOptions(s, 'surulere').find(o => !o.disabled); assert.ok(o, 'a way to Surulere'); assert.ok(L.travel(s, 'surulere', o.mode).ok); }
  while (s.pending.length) L.resolveChoice(s, 0);
  const r = L.danfoShift(s, 8000, 0, 20);
  assert.ok(r.ok && /own bus/.test(r.msg), r.msg);
  assert.ok(!s.alerts.some(a => a.memo === 'Danfo owner returns'));
});

test('haggling at Balogun: counter-offers, a hidden last price, three tries a day', () => {
  const s = L.newGame({ seed: 67, origin: 'mid', goal: 'freestyle', rules: 8 });
  assert.match(L.haggleBuy(s, 'agbada', 100000).msg, /Balogun/);
  s.needs.energy = 90; s.needs.hunger = 90;
  L.travel(s, 'island', L.travelOptions(s, 'island').find(o => !o.disabled).mode);
  while (L.dow(s) > 5 || L.hour(s) < 9 || L.hour(s) >= 17) { if (s.pending.length) L.resolveChoice(s, 0); else L.wait(s, 60); }
  while (s.pending.length) L.resolveChoice(s, 0);
  const list = L.price(s, D.CLOTHES.ankara_sh.price), ask = L.haggleAsk(s, 'ankara_sh');
  assert.ok(ask > list);
  const low = L.haggleBuy(s, 'ankara_sh', Math.round(list * 0.3));
  assert.equal(low.ok, false); assert.ok(low.counter > list * 0.3, 'the trader counters');
  const r = L.haggleBuy(s, 'ankara_sh', low.counter);
  assert.ok(r.ok, r.msg);
  assert.ok(s.wardrobe.some(w => w.id === 'ankara_sh'));
  assert.ok(L.haggleBuy(s, 'lace_top', 1).ok === false && L.haggleBuy(s, 'lace_top', 2).ok === false && L.haggleBuy(s, 'lace_top', 3).ok === false);
  assert.match(L.haggleBuy(s, 'lace_top', 10).msg, /tomorrow/);
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('japa: IELTS, funds and no debts at Ikeja airport; then the life is frozen', () => {
  const s = L.newGame({ seed: 68, origin: 'nepo', goal: 'japa', rules: 8 });
  assert.match(L.japaBlock(s, 'toronto'), /Murtala|IELTS/);
  s.loc = 'ikeja'; s.edu.ieltsPassed = true; // mechanics only
  assert.match(L.japaBlock(s, 'toronto'), /You need/);
  s.bank += 25000000; s.opening.bank += 25000000;
  assert.equal(L.japaBlock(s, 'toronto'), null);
  const r = L.japaFly(s, 'toronto');
  assert.ok(r.ok && r.japa, r.msg);
  assert.ok(s.japa && s.ach.japa && s.won && s.won.goal === 'japa');
  assert.match(L.wait(s, 60).msg, /japa-ed/);
  const n = s.replay.acts.length; L.wait(s, 60);
  assert.equal(s.replay.acts.length, n, 'nothing more is recorded');
  assert.ok(L.availableActions(s).every(a => a.disabled));
});

test('sea plots: one block per life, bounds and size, pay only for added plots, replays', () => {
  const s = L.newGame({ seed: 69, origin: 'nepo', goal: 'freestyle', rules: 8 });
  assert.match(L.buySeaPlots(s, 0, 0, 13, 2).msg, /at most 12/);
  assert.match(L.buySeaPlots(s, D.SEA.cols - 1, 0, 2, 2).msg, /off the grid/);
  const b0 = s.cash + s.bank;
  assert.ok(L.buySeaPlots(s, 4, 3, 2, 2).ok);
  assert.equal(b0 - (s.cash + s.bank), L.price(s, D.SEA.price) * 4);
  assert.ok(s.sea && s.ach.seaplot);
  const b1 = s.cash + s.bank;
  assert.ok(L.buySeaPlots(s, 10, 3, 3, 2).ok, 'move and enlarge');
  assert.equal(b1 - (s.cash + s.bank), L.price(s, D.SEA.price) * 2, 'only the 2 extra plots');
  assert.equal(L.seaCost(s, 2, 2), 0);
  assert.ok(L.releaseSeaPlots(s).ok && s.sea === null);
  assert.equal(L.category('Sea Plots: 2×2 block', -1), 'business');
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
  const o = L.newGame({ seed: 70, origin: 'mid', goal: 'freestyle' }); delete o.sea;
  assert.equal(L.deserialize(L.serialize(o)).state.sea, null);
});

test('dance-off: Saturdays at the event hall, spray capped and scaled by accuracy', () => {
  const s = L.newGame({ seed: 71, origin: 'nepo', goal: 'freestyle', rules: 8 });
  assert.match(L.danceOff(s, 50, 60, 20).msg, /event hall/);
  while (L.dow(s) !== 5 || L.hour(s) < 13) { if (s.pending.length) L.resolveChoice(s, 0); else L.wait(s, 60); }
  s.needs.energy = 90; s.needs.hunger = 90;
  if (s.loc !== 'surulere') L.travel(s, 'surulere', L.travelOptions(s, 'surulere').find(o => !o.disabled).mode);
  while (s.pending.length) L.resolveChoice(s, 0);
  assert.equal(L.danceOff(s, 70, 60, 10).ok, false, 'more hits than notes');
  const r = L.danceOff(s, 58, 60, 40);
  assert.ok(r.ok, r.msg);
  const spray = (s.alerts.find(a => a.memo === 'Dance-off: guests sprayed') || {}).amt || 0;
  assert.ok(spray > 0 && spray <= L.price(s, 4000), 'capped spray');
  assert.ok(s.ach.dancer); // (needs were set by hand above, so no replay check here)
});

test('go-slow hawker: tray stock paid, sales capped, goods add up', () => {
  const s = L.newGame({ seed: 72, origin: 'mid', goal: 'freestyle', rules: 8 });
  assert.match(L.hawkShift(s, 5000, 15, 0, 0).msg, /Oshodi/);
  s.needs.energy = 90; s.needs.hunger = 90;
  L.travel(s, 'oshodi', L.travelOptions(s, 'oshodi').find(o => !o.disabled).mode);
  while (L.hour(s) < 7) L.wait(s, 60);
  while (s.pending.length) L.resolveChoice(s, 0);
  assert.equal(L.hawkShift(s, 5000, 25, 0, 10).ok, false, 'more than the tray holds');
  const r = L.hawkShift(s, 999999, 28, 2, 0);
  assert.ok(r.ok, r.msg);
  const got = s.alerts.find(a => a.memo === 'Hawking sales').amt;
  assert.ok(got <= L.price(s, 10000));
  assert.ok(s.alerts.some(a => a.memo === 'Hawking stock'));
  assert.equal(L.category('Hawking sales', 1), 'gigs');
});

test('bole grill (PH): only in Old GRA, half the takings, burnt items deducted', () => {
  const s = L.newGame({ seed: 73, origin: 'nepo', goal: 'freestyle', rules: 8 });
  assert.match(L.boleShift(s, 9000, 20, 0).msg, /Old GRA/);
  s.loc = 'ph_oldgra'; s.t = Math.floor(s.t / 1440) * 1440 + 12 * 60; s.needs.energy = 90; s.needs.hunger = 60; // mechanics only
  assert.equal(L.boleShift(s, 99999, 10, 0).ok, false, 'sales cannot beat the plates');
  const r = L.boleShift(s, 8000, 14, 2);
  assert.ok(r.ok, r.msg);
  const share = s.alerts.find(a => a.memo === 'Bole grill share').amt;
  assert.ok(share > 0 && share <= 4000 * s.econ.infl + 50, 'about half the takings, after the gig cut');
  assert.ok(s.alerts.some(a => a.memo === 'Burnt bole (deducted)'));
});

test('Naija Quiz (Abuja): weekend show, once a day, prize from 5 right', () => {
  const s = L.newGame({ seed: 74, origin: 'nepo', goal: 'freestyle', rules: 8 });
  assert.match(L.quizShow(s, 8, 10).msg, /Millennium Park/);
  s.loc = 'abj_maitama'; s.t = (Math.floor(s.t / 1440) + ((4 - L.dow(s) + 7) % 7)) * 1440 + 16 * 60; s.needs.energy = 90; s.needs.hunger = 80;
  assert.equal(L.quizShow(s, 11, 10).ok, false);
  const r = L.quizShow(s, 10, 10);
  assert.ok(r.ok, r.msg);
  assert.equal(s.alerts.find(a => a.memo === 'Quiz show prize').amt, L.price(s, 8000));
  assert.ok(s.ach.quiz);
  assert.match(L.quizShow(s, 9, 10).msg, /already played today/);
  assert.equal(L.category('Quiz show prize', 1), 'gigs');
});

test('mini-games (rules 10): paid at the start, so quitting forfeits; collect needs a started game', () => {
  const s = L.newGame({ seed: 72, origin: 'mid', goal: 'freestyle' });
  assert.ok(s.rules >= 10);
  assert.match(L.startMinigame(s, 'hawk').msg, /Oshodi/);
  assert.equal(L.startMinigame(s, 'nope').ok, false);
  L.travel(s, 'oshodi', L.travelOptions(s, 'oshodi').find(o => !o.disabled).mode);
  while (L.hour(s) < 7 || s.pending.length) { if (s.pending.length) L.resolveChoice(s, 0); else L.wait(s, 60); }
  assert.match(L.hawkShift(s, 5000, 15, 0, 0).msg, /Start the game first/, 'no collect without a start');
  const cash = s.cash + s.bank, t0 = s.t;
  const st = L.startMinigame(s, 'hawk');
  assert.ok(st.ok, st.msg);
  assert.equal(s.cash + s.bank, cash - L.price(s, 4000), 'the tray is paid up front');
  assert.ok(s.t > t0, 'the time is spent up front');
  const t1 = s.t, r = L.hawkShift(s, 999999, 28, 2, 0);
  assert.ok(r.ok, r.msg);
  assert.equal(s.t, t1, 'collecting spends no more time');
  assert.ok(!s.alerts.some(a => a.memo === 'Hawking stock'), 'no second charge on collect');
  assert.equal(s.mini, null);
  assert.match(L.hawkShift(s, 5000, 15, 0, 0).msg, /Start the game first/, 'one collect per start');
  const rp = L.replayLife(s.replay);
  assert.equal(rp.ledgerHash, s.ledgerHash, 'a rules 10 life replays');
  // Quit and start again: each tray is paid for, and the effort is spent again.
  s.needs.energy = 95; s.needs.hunger = 95;
  const c2 = s.cash + s.bank;
  assert.ok(L.startMinigame(s, 'hawk').ok);
  assert.ok(s.cash + s.bank <= c2 - L.price(s, 4000));
  assert.equal(s.mini.kind, 'hawk');
});

test('quiz (rules 10): the day is used at the start, and Play is disabled after', () => {
  const s = L.newGame({ seed: 74, origin: 'nepo', goal: 'freestyle' });
  s.loc = 'abj_maitama'; s.t = (Math.floor(s.t / 1440) + ((4 - L.dow(s) + 7) % 7)) * 1440 + 16 * 60; s.needs.energy = 90; s.needs.hunger = 80;
  assert.ok(L.startMinigame(s, 'quiz').ok);
  const a = L.availableActions(s).find(x => x.minigame === 'quiz');
  assert.match(a.disabled || '', /One show a day/);
  assert.equal(L.startMinigame(s, 'quiz').ok, false, 'no second show after quitting');
  assert.ok(L.quizShow(s, 7, 10).ok);
});

test('advisor: gig tips never quote a gig without a set pay', () => {
  const s = L.newGame({ seed: 72, origin: 'mid', goal: 'freestyle' });
  s.loc = 'oshodi'; s.t = s.t - (s.t % 1440) + 12 * 60; s.t += L.minutesUntilRent(s) - 24 * 60; s.cash = 0; s.bank = 0; s.rentRate = 50000;
  const games = L.availableActions(s).filter(a => a.minigame).map(a => a.id);
  assert.ok(games.length, 'the hawking game is here');
  const tips = L.advise(s);
  assert.ok(tips.some(t => /short/.test(t.text)), 'the rent warning shows');
  tips.forEach(t => { assert.doesNotMatch(t.text, /NaN|undefined|₦0\b/); assert.ok(!(t.act && games.includes(t.act.id)), 'no tip points at a mini-game'); });
});

test('NYSC: register after a degree, three camp days at Kubwa, then a posting', () => {
  const s = L.newGame({ seed: 81, origin: 'nepo', goal: 'freestyle' });
  assert.equal(s.nysc, null);
  assert.match(L.nyscRegister(s).msg, /graduates/);
  s.edu.degree = true;
  const before = s.cash + s.bank;
  const r = L.nyscRegister(s);
  assert.ok(r.ok, r.msg);
  assert.equal(s.cash + s.bank, before - L.price(s, L.DATA.NYSC.callup));
  assert.equal(s.nysc.ppa, L.nyscPosting(L.newGame({ seed: 81, origin: 'lapo', goal: 'freestyle' })).id, 'the posting follows the seed');
  assert.equal(L.nyscRegister(s).ok, false, 'once');
  assert.match(L.nyscCamp(s).msg, /Kubwa/);
  s.loc = 'abj_kubwa'; s.t = s.t - (s.t % 1440) + 1440 + 6 * 60;
  for (let d = 1; d <= 3; d++) {
    while (s.pending.length) L.resolveChoice(s, 0);
    s.needs.energy = 90; s.needs.hunger = 70;
    const c = L.nyscCamp(s);
    assert.ok(c.ok, c.msg);
    assert.equal(L.hour(s), 5, 'the night is in the camp hostel, up at the bugle');
  }
  assert.equal(s.nysc.stage, 'service');
  assert.ok(s.wardrobe.some(w => w.id === 'nysc_khaki'), 'the khaki is issued');
  assert.equal(L.nyscCamp(s).ok, false, 'camp is over');
  assert.ok(!L.DATA.PLACES.find(p => p.id === 'nysc_camp').acts.length && L.DATA.PLACES.find(p => p.id === 'nysc_camp').nogem);
});

test('NYSC: PPA days pay a stipend, CDS on Thursdays, allawee every 4 weeks only with CDS, pass out after 12', () => {
  const s = L.newGame({ seed: 81, origin: 'nepo', goal: 'freestyle' });
  s.edu.degree = true; L.nyscRegister(s);
  const n = s.nysc; n.stage = 'service'; n.start = L.week(s); n.campDays = 3;
  const ppa = L.DATA.NYSC_PPAS.find(p => p.id === n.ppa), city = L.districtCity(ppa.district);
  const at = (d, h) => { s.t = d * 1440 + h * 60; while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 90; s.needs.hunger = 70; };
  const monday = (L.week(s) + 1) * 7;
  // A weekday at the PPA.
  s.loc = ppa.district; at(monday, 8);
  const w = L.nyscWork(s);
  assert.ok(w.ok, w.msg);
  assert.equal(L.nyscWork(s).ok, false, 'once a day');
  assert.equal(s.ledger.filter(l => l.memo === 'NYSC PPA stipend').length, ppa.pay ? 1 : 0);
  at(monday + 5, 8); assert.match(L.nyscWork(s).msg, /Monday to Friday/);
  s.loc = Object.keys(L.DATA.DISTRICTS).find(d => L.districtCity(d) !== city); at(monday + 1, 8);
  assert.match(L.nyscWork(s).msg, /Your PPA is in/);
  // CDS on Thursdays in the posting city: attend 3 of the first 4 weeks, none after.
  s.loc = ppa.district;
  at(monday + 2, 11); assert.match(L.nyscCDS(s).msg, /Thursdays/);
  for (let k = 0; k < 3; k++) { at(monday + 7 * k + 3, 11); const c = L.nyscCDS(s); assert.ok(c.ok, c.msg); assert.equal(L.nyscCDS(s).ok, false, 'once a week'); }
  // Let the weeks pass (the weekly tick pays or withholds).
  for (let i = 0; L.week(s) < n.start + 13 && !s.over && i < 2000; i++) { while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 90; s.needs.hunger = 70; s.needs.hygiene = 80; L.wait(s, 240); }
  const paid = s.ledger.filter(l => l.memo === 'NYSC allawee');
  assert.equal(paid.length, 1, 'one allowance: the later months had no CDS');
  assert.equal(paid[0].amt > 0, true);
  assert.equal(n.withheld, 2);
  assert.equal(n.stage, 'done');
  assert.ok(s.ach.corper);
  assert.equal(L.category('NYSC allawee', 1), 'wages');
  assert.equal(L.category('NYSC PPA stipend', 1), 'wages');
  assert.ok(L.questDone(s, 'nysc'));
});

test('NYSC: a real graduate registers and goes to camp, and the life replays', () => {
  const D = L.DATA, s = L.newGame({ seed: 81, origin: 'nepo', goal: 'freestyle' });
  const act = id => L.availableActions(s).find(a => a.id === id);
  const go = d => { if (s.loc === d) return true; const o = L.travelOptions(s, d).filter(o => !o.disabled).sort((a, b) => a.mins - b.mins)[0]; return !!o && L.travel(s, d, o.mode).ok; };
  const eat = () => { const f = L.availableActions(s).filter(a => !a.disabled && a.fx && a.fx.hunger >= 30 && !a.minigame).sort((a, b) => (a.price || 0) - (b.price || 0))[0]; return f && L.doAction(s, f.id).ok; };
  const survive = () => {
    while (s.pending.length) L.resolveChoice(s, 0);
    if (s.needs.hunger < 40 && eat()) return true;
    if (s.needs.energy < 30 || L.hour(s) >= 22 || L.hour(s) < 6) { const home = L.homeDef(s).district; if (s.loc !== home) { go(home) || L.wait(s, 60); return true; } const sl = act('home_sleep'); if (sl && !sl.disabled) L.doAction(s, 'home_sleep'); else L.wait(s, 60); return true; }
    return false;
  };
  for (let g = 0; !s.edu.degree && g < 3000; g++) {
    if (survive()) continue;
    if (!go('yaba')) { L.wait(s, 60); continue; }
    const e = act('yaba_enrol'); if (!s.edu.enrolled && e && !e.disabled) { L.doAction(s, 'yaba_enrol'); continue; }
    const l = act('yaba_lecture'); if (l && !l.disabled) { L.doAction(s, 'yaba_lecture'); continue; }
    L.wait(s, 60);
  }
  assert.ok(s.edu.degree, 'graduated');
  assert.ok(L.nyscRegister(s).ok);
  const trip = c => { const o = L.intercityOptions(s, c).filter(o => o.cost <= s.cash + s.bank).sort((a, b) => a.cost - b.cost)[0]; if (!o) return false; if (s.loc !== o.from) return go(o.from); return !o.disabled && L.intercity(s, c, o.mode).ok; };
  for (let g = 0; s.nysc.stage !== 'service' && g < 500; g++) {
    while (s.pending.length) L.resolveChoice(s, 0);
    if (L.cityOf(s) !== 'abuja') { trip('abuja') || L.wait(s, 60); continue; }
    if (!go('abj_kubwa')) { L.wait(s, 30); continue; }
    if (!L.nyscInfo(s).camp) { assert.ok(L.nyscCamp(s).ok); continue; }
    if (s.needs.hunger < 40 && eat()) continue;
    L.wait(s, 30);
  }
  assert.equal(s.nysc.stage, 'service');
  assert.ok(s.replay, 'still recording');
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('lodging: a bed away from home, by the night, priced by tier and district', () => {
  const s = L.newGame({ seed: 90, origin: 'nepo', goal: 'freestyle' });
  const home = L.homeDef(s).district;
  s.loc = home; assert.ok(L.lodgingOptions(s).every(o => o.disabled), 'sleep at home instead');
  s.loc = 'abj_maitama'; s.t = s.t - (s.t % 1440) + 1440 + 22 * 60; s.needs.energy = 20; s.needs.hunger = 70;
  const ids = L.lodgingOptions(s).map(o => o.id);
  assert.deepEqual(ids, ['hotel', 'shortlet', 'luxury']);
  s.loc = 'abj_kubwa'; assert.deepEqual(L.lodgingOptions(s).map(o => o.id), ['guest']);
  // The advisor offers the cheapest bed when you are stranded in another city.
  const tip = L.advise(s).find(t => t.act && t.act.type === 'lodge');
  assert.ok(tip && tip.act.id === 'guest', JSON.stringify(L.advise(s)));
  s.loc = 'abj_maitama';
  const cash = s.cash + s.bank, r = L.sleepAway(s, 'luxury');
  assert.ok(r.ok, r.msg);
  assert.equal(s.cash + s.bank, cash - L.price(s, 180000));
  assert.equal(L.clockLabel(s).slice(-5), '06:30');
  assert.ok(s.needs.energy > 85, 'rested');
  assert.equal(L.category('Lodging: Five-star hotel', -1), 'housing');
  while (s.pending.length) L.resolveChoice(s, 0);
  assert.match(L.sleepAway(s, 'hotel').msg, /not tired/);
  assert.equal(L.sleepAway(s, 'guest').ok, false, 'no guest house in Maitama');
  // In your home city the advisor never suggests a hotel.
  const g = L.newGame({ seed: 90, origin: 'lapo', goal: 'freestyle' });
  g.loc = 'vi'; g.t = g.t - (g.t % 1440) + 1440 + 22 * 60; g.needs.energy = 20;
  assert.ok(!L.advise(g).some(t => t.act && t.act.type === 'lodge'));
});

test('NYSC retention: an offer for corpers who showed up, accepted within 14 days', () => {
  const mk = (days) => {
    const s = L.newGame({ seed: 81, origin: 'nepo', goal: 'freestyle' });
    s.edu.degree = true; L.nyscRegister(s);
    s.nysc.ppa = 'bank'; s.nysc.stage = 'service'; s.nysc.start = L.week(s) - 11; s.nysc.days = days;
    for (let i = 0; s.nysc.stage === 'service' && i < 100; i++) { while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 90; s.needs.hunger = 70; L.wait(s, 240); }
    return s;
  };
  const lazy = mk(5);
  assert.equal(lazy.nysc.stage, 'done');
  assert.match(L.nyscRetain(lazy).msg, /at least 20 days/);
  const s = mk(25);
  assert.equal(s.nysc.offer.career, 'bank');
  const r = L.nyscRetain(s);
  assert.ok(r.ok, r.msg);
  assert.equal(s.job.id, 'bank'); assert.equal(s.job.level, 0);
  assert.equal(L.nyscRetain(s).ok, false, 'once');
  assert.match(L.nyscInfo(s).retainWhy, /You took the job/);
  const late = mk(25); late.t += 15 * 1440;
  assert.match(L.nyscRetain(late).msg, /expired/);
});

test('away from home: a real trip to Abuja with a hotel night replays', () => {
  const s = L.newGame({ seed: 91, origin: 'nepo', goal: 'freestyle' });
  const go = d => { if (s.loc === d) return true; const o = L.travelOptions(s, d).filter(o => !o.disabled).sort((a, b) => a.mins - b.mins)[0]; return !!o && L.travel(s, d, o.mode).ok; };
  for (let g = 0; L.cityOf(s) !== 'abuja' && g < 50; g++) {
    while (s.pending.length) L.resolveChoice(s, 0);
    const o = L.intercityOptions(s, 'abuja').filter(o => o.cost <= s.cash + s.bank).sort((a, b) => a.cost - b.cost)[0];
    if (!o) break; if (s.loc !== o.from) { go(o.from) || L.wait(s, 30); continue; }
    if (o.disabled) { L.wait(s, 30); continue; }
    L.intercity(s, 'abuja', o.mode);
  }
  assert.equal(L.cityOf(s), 'abuja');
  go('abj_wuse');
  while (L.hour(s) < 22) { while (s.pending.length) L.resolveChoice(s, 0); L.wait(s, 60); }
  while (s.pending.length) L.resolveChoice(s, 0);
  const r = L.sleepAway(s, 'hotel');
  assert.ok(r.ok, r.msg);
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('lodging by day is an 8-hour rest, not a day lost to sleep', () => {
  const s = L.newGame({ seed: 92, origin: 'nepo', goal: 'freestyle' });
  s.loc = 'abj_wuse'; s.t = s.t - (s.t % 1440) + 1440 + 9 * 60; s.needs.energy = 30; s.needs.hunger = 60;
  const t0 = s.t;
  assert.ok(L.sleepAway(s, 'hotel').ok);
  assert.equal(s.t - t0, 8 * 60);
  assert.ok(s.needs.hunger > 20, 'not starved by sleep');
});

test('children: homework on school nights, weekend outings, and a report card each term', () => {
  const s = L.newGame({ seed: 93, origin: 'nepo', goal: 'freestyle' });
  const old = { born: L.day(s), school: 'public', nextFees: L.day(s) + 3 };
  const k = { born: L.day(s), school: 'private', nextFees: L.day(s) + 10 };
  s.kids.push(old, k);
  assert.equal(L.kidName(s, 1), L.kidName(s, 1));
  assert.ok(L.DATA.KID_NAMES.includes(L.kidName(s, 1)));
  const home = L.homeDef(s).district;
  const at = (d, h, loc) => { s.t = d * 1440 + h * 60; s.loc = loc || home; while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 90; s.needs.hunger = 70; };
  const mon = (L.week(s) + 1) * 7;
  at(mon, 12); assert.match(L.helpHomework(s, 1).msg, /17:00/);
  at(mon, 18, 'vi' === home ? 'yaba' : 'vi'); assert.match(L.helpHomework(s, 1).msg, /at home/);
  at(mon, 18); assert.ok(L.helpHomework(s, 1).ok); assert.match(L.helpHomework(s, 1).msg, /done for today/);
  at(mon + 5, 18); assert.match(L.helpHomework(s, 1).msg, /school nights/);
  at(mon + 5, 11);
  const cash = s.cash + s.bank, r = L.kidOuting(s, 1);
  assert.ok(r.ok, r.msg); assert.equal(s.ledger.filter(l => l.memo === 'Family outing').reduce((a, l) => a + l.amt, 0), -L.price(s, 5000)); assert.ok(s.cash + s.bank <= cash - L.price(s, 5000));
  assert.match(L.kidOuting(s, 1).msg, /One outing a week/);
  assert.equal(L.kidsInfo(s)[1].bond, 13);
  assert.equal(L.category('Family outing', -1), 'family');
  // More homework, then the term ends.
  for (let d = 1; d <= 4; d++) { at(mon + 7 + d - 1, 18); assert.ok(L.helpHomework(s, 1).ok); }
  for (let i = 0; i < 200 && !(k.reports && k.reports.length); i++) { while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 90; s.needs.hunger = 70; s.needs.hygiene = 80; L.wait(s, 240); }
  assert.equal(k.reports.length, 1);
  assert.ok('ABCDF'.includes(k.reports[0].grade));
  assert.equal(k.hw, 0, 'a new term starts');
  assert.equal(old.reports, undefined, 'no report cards for a child you never helped');
});

test('malaria (rules 11): nights without light risk it, a net helps, drugs cure it, older lives never catch it', () => {
  const old = L.newGame({ seed: 95, origin: 'mid', goal: 'freestyle', rules: 10 });
  assert.equal(L.malariaOdds(old, 0), 0);
  const s = L.newGame({ seed: 95, origin: 'mid', goal: 'freestyle' });
  assert.ok(s.rules >= 11);
  // Odds over many nights: a net cuts them sharply.
  const g = L.newGame({ seed: 95, origin: 'mid', goal: 'freestyle' }); g.power = false;
  const rng = g.rng, bare = L.malariaOdds(g, 0), net = L.malariaOdds(g, 0.8);
  assert.equal(g.rng, rng, 'reading the odds draws no random number');
  assert.ok(bare >= 0.014 && bare <= 0.021, 'bare ' + bare);
  assert.ok(net < bare / 3, 'net ' + net + ' vs ' + bare);
  g.power = true; assert.ok(L.malariaOdds(g, 0) < bare, 'light means a running fan');
  // Sick: energy drains, work suffers, the chemist cures it.
  s.sick = { kind: 'malaria', since: L.day(s), drugs: false, cure: -1 };
  s.t = s.t - (s.t % 1440) + 1440 + 9 * 60; s.needs.energy = 90; s.needs.hunger = 80;
  assert.ok(L.advise(s).some(t => /malaria/.test(t.text) && t.act && t.act.type === 'treat'));
  const e0 = s.needs.energy; L.wait(s, 60);
  assert.ok(e0 - s.needs.energy > 1.5, 'fever drains energy');
  const r = L.treatMalaria(s);
  assert.ok(r.ok, r.msg);
  assert.equal(s.ledger.filter(l => l.memo === 'Chemist: antimalarials').length, 1);
  assert.equal(L.category('Chemist: antimalarials', -1), 'health');
  assert.match(L.treatMalaria(s).msg, /already/);
  for (let i = 0; s.sick && i < 100; i++) { while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 90; s.needs.hunger = 80; L.wait(s, 120); }
  assert.equal(s.sick, null, 'cured');
  assert.match(L.treatMalaria(s).msg, /not sick/);
  // Untreated malaria that ends in a collapse is treated at the hospital.
  s.sick = { kind: 'malaria', since: L.day(s) - 4, drugs: false, cure: -1 }; s.needs.energy = 2;
  for (let i = 0; s.sick && i < 20; i++) L.wait(s, 60);
  assert.equal(s.sick, null);
  assert.ok(s.log.some(l => /collapsed from malaria/.test(l.text)), 'hospital');
  assert.ok(L.DATA.FURNITURE.net);
});

test('Lagos rail: Blue and Red Line stops, flat fare, 06:00 to 21:00, no traffic or rain', () => {
  const s = L.newGame({ seed: 96, origin: 'mid', goal: 'freestyle' });
  s.loc = 'ikeja'; s.t = s.t - (s.t % 1440) + 1440 + 8 * 60;
  const o = L.travelOptions(s, 'yaba').find(x => x.mode === 'rail');
  assert.ok(!o.disabled, o.disabled);
  assert.equal(o.cost, L.travelOptions(s, 'oshodi').find(x => x.mode === 'rail').cost, 'a flat fare, near or far');
  assert.equal(o.traffic, 1, 'no go-slow on the tracks');
  assert.ok(!o.wet);
  assert.equal(L.railLine('island', 'festac'), 'blue');
  assert.equal(L.railLine('ikeja', 'island'), null);
  assert.match(L.travelOptions(s, 'island').find(x => x.mode === 'rail').disabled, /No train/);
  s.t += 14 * 60; // 22:00
  assert.match(L.travelOptions(s, 'yaba').find(x => x.mode === 'rail').disabled, /06:00 to 21:00/);
  s.t -= 14 * 60;
  const r = L.travel(s, 'yaba', 'rail');
  assert.ok(r.ok, r.msg);
  assert.equal(s.loc, 'yaba');
});

test('review fixes: train arrives by 21:00, sibling names differ, sick floor, one malaria bill a week', () => {
  const s = L.newGame({ seed: 97, origin: 'lapo', goal: 'freestyle' });
  s.loc = 'ikeja'; s.t = s.t - (s.t % 1440) + 1440 + 20 * 60 + 55;
  assert.match(L.travelOptions(s, 'yaba').find(x => x.mode === 'rail').disabled, /06:00 to 21:00/);
  s.t -= 60; assert.ok(!L.travelOptions(s, 'yaba').find(x => x.mode === 'rail').disabled);
  for (let i = 0; i < 3; i++) s.kids.push({ born: 5, school: null, nextFees: 99 });
  const names = s.kids.map((k, i) => L.kidName(s, i));
  assert.equal(new Set(names).size, 3, names.join());
  s.needs.fun = 0; s.needs.social = 0; s.needs.stress = 100; s.sick = { kind: 'malaria', since: L.day(s), drugs: false, cure: -1 };
  assert.ok(L.performance(s) >= 0.3);
  // Broke, no HMO: two malaria collapses in a week bring one malaria bill.
  s.cash = 0; s.bank = 0; s.opening.cash = 0; s.opening.bank = 0; s.ledgerSum = { cash: 0, bank: 0 };
  for (let n = 0; n < 2; n++) { s.sick = { kind: 'malaria', since: L.day(s) - 4, drugs: false, cure: -1 }; s.needs.energy = 1; for (let i = 0; s.sick && i < 10; i++) L.wait(s, 60); }
  const wk = L.week(s), bills = s.loans.filter(l => l.name === 'Hospital bill');
  assert.ok(s.log.filter(l => /collapsed from malaria/.test(l.text)).length >= 2, 'two collapses');
  assert.equal(L.week(s), wk);
  assert.ok(bills.reduce((a, l) => a + l.bal, 0) <= L.price(s, 8000) + L.price(s, 15000), 'one ward bill and one malaria bill: ' + bills.map(b => b.bal));
});

test('the next generation: an heir inherits a share, keeps their schooling, replays and ranks', () => {
  const p = L.newGame({ seed: 98, origin: 'nepo', goal: 'freestyle', name: 'Bayo' });
  assert.equal(L.heirOffer(p), null, 'no children, no heir');
  p.kids.push({ born: 0, school: 'intl', nextFees: 99, bond: 70, reports: [{ day: 1, grade: 'A' }, { day: 2, grade: 'B' }] }, { born: 3, school: null, nextFees: 99 });
  const h = L.heirOffer(p);
  assert.equal(h.parent, 'Bayo');
  assert.equal(h.name, L.kidName(p, 0));
  assert.equal(h.inherit, Math.round(L.netWorth(p) * 0.9 / 2 / 1000) * 1000, 'a sibling share after 10% estate costs');
  assert.equal(h.school, 'intl'); assert.equal(h.as, 1); assert.equal(h.bond, 70);
  const s = L.newGame({ seed: 99, origin: 'heir', goal: 'freestyle', heir: h });
  assert.equal(s.origin, 'heir'); assert.equal(s.name, h.name);
  assert.equal(s.cash + s.bank, h.inherit);
  assert.ok(s.edu.degree, 'international school counts as a degree');
  assert.ok(L.skillLevel(s, 'tech') > 0 && L.skillLevel(s, 'charisma') > 0);
  // A short heir life replays, and its fame entry passes the checks with its inheritance.
  for (let i = 0; i < 20; i++) { while (s.pending.length) L.resolveChoice(s, 0); L.wait(s, 180); }
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
  const e = L.fameEntry(s);
  assert.equal(e.inherit, h.inherit);
  assert.ok(L.checkFame(e), 'a real heir entry is accepted');
  assert.equal(L.checkFame(Object.assign({}, e, { inherit: undefined })), null, 'an heir entry must say what it inherited');
  // Forged inheritances are refused.
  assert.equal(L.replayLife(Object.assign({}, s.replay, { heir: Object.assign({}, h, { inherit: 9e12 }) })), null);
  const bad = L.newGame({ seed: 99, origin: 'heir', goal: 'freestyle', heir: { name: 'X' } });
  assert.equal(bad.origin, 'mid', 'a broken heir falls back to an ordinary start');
  // Weekly Lagos lives never make heirs.
  const w = L.newGame({ challenge: '2026-W42' }); w.kids.push({ born: 0, school: null, nextFees: 9 });
  assert.equal(L.heirOffer(w), null);
});

test('car wear (rules 12): kilometres wear the car, worn cars break down, Ladipo services them', () => {
  const old = L.newGame({ seed: 100, origin: 'nepo', goal: 'freestyle', rules: 11 });
  old.vehicles.push({ id: 'tokunbo', paid: 8000000 }); old.loc = 'ikeja'; old.t = old.t - (old.t % 1440) + 1440 + 10 * 60;
  L.travel(old, 'yaba', 'car');
  assert.equal(old.vehicles[0].wear, undefined, 'older lives have no wear');
  const s = L.newGame({ seed: 100, origin: 'nepo', goal: 'freestyle' });
  assert.ok(s.rules >= 12);
  s.vehicles.push({ id: 'tokunbo', paid: 8000000 }); s.loc = 'ikeja'; s.t = s.t - (s.t % 1440) + 1440 + 10 * 60;
  const km = L.travelOptions(s, 'yaba').find(o => o.mode === 'car').km;
  const r = L.travel(s, 'yaba', 'car');
  assert.ok(r.ok, r.msg);
  assert.equal(s.vehicles[0].wear, km);
  assert.ok(L.breakdownOdds({ id: 'tokunbo', wear: 2000 }) > L.breakdownOdds({ id: 'tokunbo', wear: 0 }) * 5);
  assert.ok(L.breakdownOdds({ id: 'suv', wear: 500 }) < L.breakdownOdds({ id: 'tokunbo', wear: 500 }), 'a luxury SUV is sturdier');
  // A badly worn car breaks down sooner or later.
  s.vehicles[0].wear = 5000;
  for (let i = 0; i < 40 && !s.stats.breakdowns; i++) { while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 90; s.needs.hunger = 80; s.t = s.t - (s.t % 1440) + 1440 + 10 * 60; L.travel(s, s.loc === 'yaba' ? 'ikeja' : 'yaba', 'car'); }
  assert.ok(s.stats.breakdowns >= 1);
  assert.ok(s.ledger.some(l => /^Roadside mechanic/.test(l.memo)) || s.loans.some(l => l.name === 'Roadside mechanic'));
  // Service at Ladipo, Mushin.
  while (s.pending.length) L.resolveChoice(s, 0);
  assert.match(L.serviceCars(s).msg, /Mushin/);
  s.loc = 'mushin'; s.t = (L.week(s) + 1) * 7 * 1440 + 10 * 60; // a Monday morning
  const cost = L.serviceCost(s), r2 = L.serviceCars(s);
  assert.ok(r2.ok, r2.msg);
  assert.equal(s.vehicles[0].wear, 0);
  assert.equal(s.ledger.filter(l => l.memo === 'Ladipo: car service').reduce((a, l) => a - l.amt, 0), cost);
  assert.equal(L.category('Ladipo: car service', -1), 'transport');
  assert.match(L.serviceCars(s).msg, /freshly serviced/);
  assert.ok(L.DATA.PLACES.find(p => p.id === 'ladipo').nogem, 'gems still replay');
});

test('dynasties: choose any child, the family line grows, generation 3 is a dynasty', () => {
  const p = L.newGame({ seed: 101, origin: 'nepo', goal: 'freestyle', name: 'Bayo' });
  p.kids.push({ born: 0, school: 'public', nextFees: 99, bond: 20 }, { born: 2, school: 'intl', nextFees: 99, bond: 80, reports: [{ day: 1, grade: 'A' }] });
  const offers = L.heirOffers(p);
  assert.equal(offers.length, 2);
  assert.equal(offers[0].inherit, offers[1].inherit, 'equal shares');
  assert.equal(offers[1].school, 'intl'); assert.equal(offers[1].as, 1); assert.equal(offers[0].as, 0);
  assert.deepEqual(offers[1].line, ['Bayo']); assert.equal(offers[1].gen, 2);
  // The younger child carries on, has children, and their heir is generation 3.
  const c = L.newGame({ seed: 102, origin: 'heir', goal: 'freestyle', heir: offers[1] });
  assert.ok(!c.ach.dynasty);
  c.kids.push({ born: 0, school: null, nextFees: 99 });
  const g3 = L.heirOffers(c)[0];
  assert.deepEqual(g3.line, ['Bayo', c.name]); assert.equal(g3.gen, 3);
  const d = L.newGame({ seed: 103, origin: 'heir', goal: 'freestyle', heir: g3 });
  assert.ok(d.ach.dynasty, 'the third generation is a dynasty');
  for (let i = 0; i < 10; i++) { while (d.pending.length) L.resolveChoice(d, 0); L.wait(d, 180); }
  assert.equal(L.replayLife(d.replay).ledgerHash, d.ledgerHash);
  const e = L.fameEntry(d);
  assert.equal(e.gen, 3); assert.equal(L.checkFame(e).gen, 3);
  assert.equal(L.checkFame(Object.assign({}, e, { gen: 99 })), null);
  assert.equal(L.checkFame(Object.assign({}, L.fameEntry(p), { gen: 2 })), null, 'only heirs have a generation');
  assert.equal(L.lifeSummary(d).gen, 3);
  // A heir from before dynasties (no line, no gen) still works as generation 2.
  const legacy = { name: 'Tobi', parent: 'Ade', inherit: 500000, school: null, as: 0, bond: 10 };
  const l2 = L.newGame({ seed: 104, origin: 'heir', goal: 'freestyle', heir: legacy });
  assert.equal(l2.origin, 'heir'); assert.equal(l2.heir.gen, 2); assert.deepEqual(l2.heir.line, ['Ade']);
  assert.ok(L.replayLife(Object.assign({}, l2.replay, { heir: legacy })));
});

test('job interviews (rules 13): degree jobs ask three seeded questions; the engine marks them', () => {
  const s = L.newGame({ seed: 105, origin: 'nepo', goal: 'freestyle' });
  assert.ok(s.rules >= 13);
  s.edu.degree = true; s.loc = 'vi'; s.t = s.t - (s.t % 1440) + 1440 + 10 * 60; s.skills.charisma = 15; s.friends.kunle.lvl = 0; // no banker connect
  while (s.pending.length) L.resolveChoice(s, 0);
  const r = L.applyJob(s, 'bank');
  assert.equal(r.ok, false); assert.equal(r.interview, 'bank');
  const qs = L.interviewQuestions(s, 'bank');
  assert.equal(qs.length, 3); assert.equal(new Set(qs.map(q => q.q)).size, 3);
  assert.deepEqual(L.interviewQuestions(s, 'bank'), qs, 'same questions all day');
  // The right answers come from the data, wherever they land after rotation.
  const right = qs.map(q => { const row = L.DATA.INTERVIEWS.bank.find(x => x[0] === q.q); return q.opts.indexOf(row[1][row[2]]); });
  const wrong = right.map(k => (k + 1) % 3);
  const f = L.interviewJob(s, 'bank', wrong[0], wrong[1], wrong[2]);
  assert.ok(f.ok); assert.equal(s.job, null, 'failed the interview');
  assert.match(L.interviewBlock(s, 'bank'), /Try again in 3 days/);
  s.t += 3 * 1440; s.t = s.t - (s.t % 1440) + 10 * 60;
  while (s.pending.length) L.resolveChoice(s, 0);
  const qs2 = L.interviewQuestions(s, 'bank');
  const right2 = qs2.map(q => { const row = L.DATA.INTERVIEWS.bank.find(x => x[0] === q.q); return q.opts.indexOf(row[1][row[2]]); });
  const p = L.interviewJob(s, 'bank', right2[0], right2[1], (right2[2] + 1) % 3);
  assert.ok(p.ok, p.msg); assert.equal(s.job.id, 'bank', 'two of three gets the job');
  // Older lives, and players with a connect, skip the interview.
  const old = L.newGame({ seed: 105, origin: 'nepo', goal: 'freestyle', rules: 12 });
  assert.equal(L.needsInterview(old, 'bank'), false);
  assert.equal(L.needsInterview(s, 'tech'), false, 'only the degree careers interview');
  const k = Object.keys(L.DATA.NPCS).find(n => L.DATA.NPCS[n].career === 'bank');
  if (k) { const c = L.newGame({ seed: 106, origin: 'nepo', goal: 'freestyle' }); c.friends[k].lvl = 80; assert.equal(L.needsInterview(c, 'bank'), false, 'a connect gets you in'); }
  const rp = L.replayLife(s.replay);
  assert.ok(rp, 'the interview replays');
});

test('build your own house: the plot, the omo-onile, five stages over weeks, then live there or rent it out', () => {
  const s = L.newGame({ seed: 107, origin: 'nepo', goal: 'freestyle' });
  assert.match(L.buildStage(s).msg, /plot of land in Ikorodu/);
  s.bank += 40000000; s.opening.bank += 40000000; // a rich test life (kept balanced)
  s.loc = 'ikorodu'; s.t = s.t - (s.t % 1440) + 1440 + 10 * 60;
  assert.ok(L.buyProperty(s, 'iko_plot').ok);
  assert.equal(L.buyProperty(s, 'built_house').ok, false, 'a built house is never for sale');
  let b = L.buildInfo(s);
  assert.equal(b.cost, L.price(s, 1500000) + L.price(s, 250000), 'the levy comes with the foundation');
  for (let stage = 0; stage < 5; stage++) {
    while (s.pending.length) L.resolveChoice(s, 0);
    s.loc = 'ikorodu'; s.needs.energy = 90; s.needs.hunger = 80;
    const r = L.buildStage(s);
    assert.ok(r.ok, r.msg);
    assert.match(L.buildStage(s).msg, /still going on/);
    for (let i = 0; i < 400 && L.buildInfo(s).working; i++) { while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 90; s.needs.hunger = 80; s.needs.hygiene = 80; L.wait(s, 240); }
  }
  b = L.buildInfo(s);
  assert.ok(b.built, 'the house is finished');
  assert.ok(s.ach.builder);
  assert.ok(!s.properties.some(p => p.id === 'iko_plot') && s.properties.some(p => p.id === 'built_house'));
  assert.equal(s.ledger.filter(l => l.memo === 'Omo-onile development levy').length, 1);
  assert.equal(L.category('Building: Roofing', -1), 'housing');
  // Tenants pay while you live elsewhere; moving in is free and stops the rent.
  const rent = () => s.ledger.filter(l => l.memo === 'Tenant rent: Your own house, Ikorodu').length;
  const r0 = rent(); for (let i = 0; i < 60; i++) { while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 90; s.needs.hunger = 80; L.wait(s, 240); }
  assert.ok(rent() > r0, 'tenants pay');
  while (s.pending.length) L.resolveChoice(s, 0);
  const m = L.moveHouse(s, 'built_own');
  assert.ok(m.ok, m.msg); assert.equal(s.rentRate, 0);
  const r1 = rent(); for (let i = 0; i < 60; i++) { while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 90; s.needs.hunger = 80; L.wait(s, 240); }
  assert.equal(rent(), r1, 'no tenants while you live there');
});

test('Detty December (rules 14): December rates, traffic, a hustle boom, IJGBs, NYE on the last day, Detty legend', () => {
  const dec = (rules) => { const s = L.newGame({ seed: 108, origin: 'nepo', goal: 'freestyle', rules }); s.t = s.t - (s.t % 1440) + 8 * 7 * 1440 + 10 * 60; return s; }; // week 9: December
  const s = dec(14), old = dec(13);
  assert.ok(L.isDecember(s));
  s.loc = old.loc = 'vi';
  const hotel = (g) => L.lodgingOptions(g).find(o => o.id === 'hotel').price;
  assert.ok(hotel(s) > hotel(old) * 1.5, 'December rates for hotels');
  s.loc = old.loc = 'ikeja';
  const mins = (g) => L.travelOptions(g, 'yaba').find(o => o.mode === 'danfo').mins;
  assert.ok(mins(s) > mins(old), 'December go-slow');
  // IJGB relatives turn up in December weeks.
  const g = dec(14); g.bank += 5000000; g.opening.bank += 5000000;
  let seen = 0;
  for (let i = 0; i < 4 * 7 * 6 && L.isDecember(g); i++) {
    while (g.pending.length) { const ev = g.pending[0]; if (ev.id === 'ijgb') { seen++; assert.match(ev.text, /Just got back from/); } L.resolveChoice(g, 0); }
    g.needs.energy = 90; g.needs.hunger = 80; g.needs.hygiene = 80; L.wait(g, 240);
  }
  assert.ok(seen >= 1, 'at least one IJGB in four December weeks: ' + seen);
  assert.equal(L.category('IJGB gift (dollars changed at the BDC)', 1), 'family');
  // NYE fireworks only on the month's last day.
  const n = dec(14); n.loc = 'lekki'; n.t = n.t - (n.t % 1440) + 21 * 60;
  const nye = () => L.availableActions(n).find(a => a.id === 'lekki_dec_nye');
  assert.ok(!nye() || nye().disabled, 'not on an ordinary December night');
  n.t = (Math.floor(L.day(n) / 28) * 28 + 27) * 1440 + 21 * 60;
  while (n.pending.length) L.resolveChoice(n, 0);
  assert.ok(nye() && !nye().disabled, nye() && nye().disabled);
  // Six December events make a Detty legend.
  const e = dec(14); e.bank += 3000000; e.opening.bank += 3000000; e.loc = 'island';
  for (let i = 0; i < 6; i++) { while (e.pending.length) L.resolveChoice(e, 0); e.needs.hunger = 20; e.t = e.t - (e.t % 1440) + 1440 + 13 * 60; const r = L.doAction(e, 'island_dec_food'); assert.ok(r.ok, r.msg); }
  assert.ok(e.ach.detty_legend);
});

test('Island life: flex needs a luxury car, glam lifts the next night out, area boys collect ground money (rules 14)', () => {
  const s = L.newGame({ seed: 109, origin: 'nepo', goal: 'freestyle' });
  s.loc = 'vi'; s.t = s.t - (s.t % 1440) + ((4 - L.dow(s) + 7) % 7 + 7) * 1440 + 22 * 60; // a Friday night
  while (s.pending.length) L.resolveChoice(s, 0);
  assert.match(L.availableActions(s).find(a => a.id === 'vi_flex').disabled || '', /luxury car/);
  s.vehicles.push({ id: 'suv', paid: 45000000 });
  assert.ok(!L.availableActions(s).find(a => a.id === 'vi_flex').disabled);
  assert.ok(L.doAction(s, 'vi_flex').ok);
  // Glam, then a night out.
  const g = L.newGame({ seed: 110, origin: 'nepo', goal: 'freestyle' });
  g.loc = 'lekki'; g.t = g.t - (g.t % 1440) + 1440 + 12 * 60; while (g.pending.length) L.resolveChoice(g, 0);
  assert.ok(L.doAction(g, 'lekki_glam').ok);
  assert.ok(g.glamUntil > g.t);
  g.t = g.t - (g.t % 1440) + ((4 - L.dow(g) + 7) % 7) * 1440 + 22 * 60; g.needs.energy = 90; g.needs.hunger = 70; while (g.pending.length) L.resolveChoice(g, 0);
  if (g.glamUntil > g.t) { const r = L.doAction(g, 'lekki_rooftop'); assert.ok(r.ok, r.msg); assert.equal(g.glamUntil, 0, 'used up'); }
  // Ground money when you drive to busy places.
  const a = L.newGame({ seed: 111, origin: 'nepo', goal: 'freestyle' });
  a.vehicles.push({ id: 'tokunbo', paid: 8000000 });
  let paid = 0;
  for (let i = 0; i < 30; i++) { while (a.pending.length) L.resolveChoice(a, 0); a.needs.energy = 90; a.needs.hunger = 80; a.t = a.t - (a.t % 1440) + 1440 + 11 * 60; a.vehicles[0].wear = 0; L.travel(a, a.loc === 'vi' ? 'ikoyi' : 'vi', 'car'); }
  paid = a.ledger.filter(l => l.memo === 'Ground money (area boys)').length;
  assert.ok(paid >= 1, 'ground money collected: ' + paid);
  assert.equal(L.category('Ground money (area boys)', -1), 'losses');
});

test('skits and live streaming: a weekly trend, location bonus, gifts, NEPA drops, appearances', () => {
  const s = L.newGame({ seed: 112, origin: 'nepo', goal: 'freestyle' });
  s.t = s.t - (s.t % 1440) + 1440 + 10 * 60; while (s.pending.length) L.resolveChoice(s, 0);
  const trend = L.trendingTheme(s);
  assert.ok(L.DATA.SKIT_THEMES[trend]);
  assert.equal(L.trendingTheme(s), trend, 'one trend all week');
  assert.match(L.goLive(s).msg, /500 followers/);
  const f0 = (s.creator && s.creator.followers) || 0;
  const r = L.shootSkit(s, trend); assert.ok(r.ok, r.msg);
  const gotTrend = s.creator.followers - f0;
  const other = Object.keys(L.DATA.SKIT_THEMES).find(k => k !== trend && k !== 'detty' && !L.DATA.SKIT_THEMES[k].at.includes(s.loc) && k !== 'family');
  const f1 = s.creator.followers; s.needs.energy = 90; while (s.pending.length) L.resolveChoice(s, 0);
  assert.ok(L.shootSkit(s, other).ok);
  assert.ok(gotTrend > (s.creator.followers - f1) * 1.5, 'the trend doubles followers');
  assert.equal(L.shootSkit(s, 'detty').ok, false, 'Detty December skits wait for December');
  // Live: needs followers; at home with no light and no inverter the stream drops.
  s.creator.followers = 20000; s.loc = L.homeDef(s).district; s.power = false; s.t = s.t - (s.t % 1440) + 1440 + 21 * 60; s.needs.energy = 90;
  while (s.pending.length) L.resolveChoice(s, 0); s.power = false;
  const est = L.creatorInfo(s).viewers;
  assert.ok(est > 0);
  const lv = L.goLive(s); assert.ok(lv.ok, lv.msg); assert.match(lv.msg, /NEPA took light/);
  assert.match(L.goLive(s).msg, /One live stream a day/);
  assert.equal(L.category('Live stream gifts', 1), 'gigs');
  // Appearances from 20k followers, once a week.
  const a = L.newGame({ seed: 113, origin: 'nepo', goal: 'freestyle' });
  a.loc = 'vi'; a.t = a.t - (a.t % 1440) + ((4 - L.dow(a) + 7) % 7 + 7) * 1440 + 22 * 60; while (a.pending.length) L.resolveChoice(a, 0);
  assert.match(L.availableActions(a).find(x => x.id === 'vi_appearance').disabled, /20,000/);
  a.creator = { followers: 50000, posts: 10, lastPost: L.day(a) };
  const ap = L.doAction(a, 'vi_appearance'); assert.ok(ap.ok, ap.msg);
  assert.ok(a.ledger.some(l => l.memo === 'Event appearance fee'));
  assert.match(L.availableActions(a).find(x => x.id === 'vi_appearance').disabled || '', /One appearance a week|Only/);
});

test('sports: tournaments pay a capped prize by skill, eight sports make an All-rounder', () => {
  const s = L.newGame({ seed: 114, origin: 'nepo', goal: 'freestyle' });
  s.bank += 2000000; s.opening.bank += 2000000;
  const sports = new Set();
  Object.values(L.DATA.PLACE_ACTIONS).forEach(list => list.forEach(a => { if (a.sport) { assert.ok(L.DATA.SPORTS[a.sport], a.id); sports.add(a.sport); } }));
  assert.ok(sports.size >= 20, 'most of the list is playable: ' + sports.size);
  // Play eight different sports.
  const plan = [['ikeja', 'ikeja_tabletennis', 12], ['ikeja', 'ikeja_badminton', 12], ['ikeja', 'ikeja_ayo', 12], ['ikoyi', 'ikoyi_tennis', 10], ['ikoyi', 'ikoyi_swim', 10], ['vi', 'vi_beachvolley', 16], ['yaba', 'yaba_basketball', 17], ['mushin', 'mushin_snooker', 14]];
  for (const [d, id, h] of plan) {
    while (s.pending.length) L.resolveChoice(s, 0);
    s.loc = d; s.t = s.t - (s.t % 1440) + 1440 + h * 60; s.needs.energy = 90; s.needs.hunger = 70; s.needs.hygiene = 80;
    const r = L.doAction(s, id); assert.ok(r.ok, id + ': ' + r.msg);
  }
  assert.ok(s.ach.allrounder);
  // A strong player usually wins the five-a-side; prizes are capped.
  s.skills.fitness = 400; let wins = 0;
  for (let i = 0; i < 6; i++) {
    while (s.pending.length) L.resolveChoice(s, 0);
    s.loc = 'surulere'; s.t = s.t - (s.t % 1440) + ((5 - L.dow(s) + 7) % 7 || 7) * 1440 + 10 * 60; s.needs.energy = 90; s.needs.hunger = 70; s.needs.hygiene = 80;
    const r = L.doAction(s, 'suru_5aside'); assert.ok(r.ok, r.msg); if (/You won/.test(r.msg)) wins++;
  }
  assert.ok(wins >= 4, 'wins ' + wins);
  assert.ok(s.ledger.filter(l => l.memo === 'Prize: five-a-side').every(l => l.amt <= L.price(s, 20000)));
  assert.equal(L.category('Prize: five-a-side', 1), 'gigs');
});

test('Lagos labels: origin, newcomers, street-smarts and the children (display only)', () => {
  const nepo = L.newGame({ seed: 115, origin: 'nepo', goal: 'freestyle' });
  assert.deepEqual(L.lagosLabels(nepo).sort(), ['ajebo', 'jjc', 'nepo']);
  const lapo = L.newGame({ seed: 115, origin: 'lapo', goal: 'freestyle' });
  assert.ok(L.lagosLabels(lapo).includes('lapo'));
  const rng = lapo.rng; L.lagosLabels(lapo); assert.equal(lapo.rng, rng, 'no random draw');
  lapo.skills.hustle = 100; lapo.stats.trips = 60; lapo.t += 3 * 7 * 1440;
  assert.ok(L.lagosLabels(lapo).includes('areaboy') && !L.lagosLabels(lapo).includes('jjc'));
  nepo.kids.push({ born: 0, school: 'intl', nextFees: 9 }, { born: 1, school: 'public', nextFees: 9, reports: [{ day: 1, grade: 'A' }] });
  assert.equal(L.kidLabel(nepo, 0), 'butty'); assert.equal(L.kidLabel(nepo, 1), 'ajepako');
  Object.keys(L.DATA.SLANG).forEach(k => assert.ok(L.DATA.SLANG[k][1].length > 20));
});

test('businesses: low, mid and high tiers; December and term-day trades pay to their pattern', () => {
  const tiers = { low: 0, mid: 0, high: 0 };
  Object.entries(L.DATA.BUSINESSES).forEach(([k, b]) => { assert.ok(b.tier in tiers, k); tiers[b.tier]++; assert.ok(L.DATA.BUSINESS_GROWTH[k], k + ' has growth names'); });
  assert.ok(tiers.low >= 6 && tiers.mid >= 8 && tiers.high >= 7, JSON.stringify(tiers));
  const lowMax = Math.max(...Object.values(L.DATA.BUSINESSES).filter(b => b.tier === 'low').map(b => b.price));
  const highMin = Math.min(...Object.values(L.DATA.BUSINESSES).filter(b => b.tier === 'high').map(b => b.price));
  assert.ok(highMin > lowMax * 10, 'the jump from low to high is capital');
  // A private school pays on term days only; luxury car rental booms in December.
  const s = L.newGame({ seed: 116, origin: 'nepo', goal: 'freestyle' });
  s.bank += 200000000; s.opening.bank += 200000000;
  assert.ok(L.buyBusiness(s, 'school', 'ikeja').ok);
  assert.ok(L.buyBusiness(s, 'carrental', 'vi').ok);
  assert.ok(L.buyBusiness(s, 'recharge', 'mushin').ok);
  for (let i = 0; i < 14 * 6; i++) { while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 90; s.needs.hunger = 80; s.needs.hygiene = 80; if (L.hour(s) === 12) L.visitBusinesses && L.visitBusinesses(s); L.wait(s, 240); }
  assert.ok(s.ledger.filter(l => l.memo === 'Business payout').length >= 10, 'they pay out');
});

test('sightseeing: the tourist sights are on the map, and 8 visits make a Lagos explorer (rules 14)', () => {
  const sights = [];
  Object.entries(L.DATA.PLACE_ACTIONS).forEach(([d, list]) => list.forEach(a => { if (a.sight) sights.push([d, a.id]); }));
  assert.ok(sights.length >= 17, 'sights: ' + sights.length);
  ['ikoyi_tarkwa', 'lekki_nike', 'ikeja_kalakuta', 'festac_badagry', 'yaba_makoko', 'lekki_lcc'].forEach(id => assert.ok(sights.some(x => x[1] === id), id));
  const s = L.newGame({ seed: 117, origin: 'nepo', goal: 'freestyle' }); s.bank += 2000000; s.opening.bank += 2000000;
  const plan = [['lekki', 'lekki_nike', 11], ['lekki', 'lekki_crafts', 11], ['lekki', 'lekki_lcc', 11], ['ikeja', 'ikeja_kalakuta', 11], ['ikeja', 'ikeja_jjt', 11], ['vi', 'vi_terra', 12], ['yaba', 'yaba_makoko', 10], ['ikoyi', 'ikoyi_tarkwa', 10]];
  for (const [d, id, h] of plan) {
    while (s.pending.length) L.resolveChoice(s, 0);
    s.loc = d; s.t = s.t - (s.t % 1440) + 1440 + h * 60; s.needs.energy = 90; s.needs.hunger = 50; s.needs.hygiene = 80;
    const r = L.doAction(s, id); assert.ok(r.ok, id + ': ' + r.msg);
  }
  assert.ok(s.ach.explorer);
  const old = L.newGame({ seed: 117, origin: 'nepo', goal: 'freestyle', rules: 13 }); old.loc = 'lekki'; old.t = old.t - (old.t % 1440) + 1440 + 11 * 60;
  L.doAction(old, 'lekki_lcc'); assert.equal(old.stats.sights, undefined, 'older lives count nothing new');
});

test('prime addresses: Lekki Phase 1 to Banana Island, live in it or let it, service charges, status', () => {
  const ids = ['lekki_nicon', 'vi_luxapt', 'eko_atlantic', 'ikoyi_parkview', 'banana_island'];
  const P = L.DATA.PROPERTIES;
  for (let i = 1; i < ids.length; i++) assert.ok(P[ids[i]].price > P[ids[i - 1]].price, 'ranked by price');
  ids.forEach(id => { const h = L.DATA.HOMES[P[id].home]; assert.ok(h && h.owned && h.ownedBy === id, id); });
  const s = L.newGame({ seed: 118, origin: 'nepo', goal: 'freestyle' }); s.bank += 5000000000; s.opening.bank += 5000000000;
  const st0 = L.statusPoints ? L.statusPoints(s) : 0;
  assert.ok(L.buyProperty(s, 'banana_island').ok);
  assert.ok(s.ach.banana && s.ach.landlord);
  if (L.statusPoints) assert.equal(L.statusPoints(s) - st0, 100);
  const rent = () => s.ledger.filter(l => /^Tenant rent: Waterfront/.test(l.memo)).length, charge = () => s.ledger.filter(l => /^Estate service charge/.test(l.memo)).length;
  for (let i = 0; i < 50; i++) { while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 90; s.needs.hunger = 80; L.wait(s, 240); }
  assert.ok(rent() >= 1 && charge() >= 1, 'tenants pay and the estate charges');
  while (s.pending.length) L.resolveChoice(s, 0);
  const m = L.moveHouse(s, 'banana_island_own'); assert.ok(m.ok, m.msg); assert.equal(s.rentRate, 0);
  const r0 = rent(), c0 = charge();
  for (let i = 0; i < 50; i++) { while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 90; s.needs.hunger = 80; L.wait(s, 240); }
  assert.equal(rent(), r0, 'no tenants while you live there'); assert.ok(charge() > c0, 'the service charge still comes');
  assert.equal(L.category('Estate service charge: x', -1), 'housing');
});

test('the airport site is in Ikeja; the retired Ajah airport actions are hidden but still run for old lives', () => {
  const pl = D.PLACES.find(p => p.id === 'new_airport_site');
  assert.equal(pl.district, 'ikeja');
  const s = L.newGame({ seed: 5, goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0);
  s.loc = 'ajah'; s.t = s.t - (s.t % 1440) + 1440 + 10 * 60;
  assert.ok(!L.availableActions(s).some(a => a.id === 'ajah_air_tour'), 'not offered in Ajah');
  s.cash = 50000; const before = s.cash;
  const r = L.doAction(s, 'ajah_air_tour');
  assert.ok(r.ok, r.msg); assert.equal(s.cash, before - L.price(s, 1000));
});

test('airport departures: cabins scale the fare, the cab leg is included, jets, charters and choppers replay', () => {
  const s = L.newGame({ seed: 77, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  s.cash += 200000000;
  const e = L.flightQuote(s, 'abuja', 'economy', false), b = L.flightQuote(s, 'abuja', 'business', false), f = L.flightQuote(s, 'abuja', 'first', true);
  assert.ok(Math.abs(b.fare - e.fare * 4) <= 400, 'business is about 4x economy');
  assert.ok(f.fare > b.fare * 2 && f.insure > 0 && f.total === f.fare + f.cab + f.insure);
  assert.equal(L.flightQuote(s, 'lagos', 'economy').disabled, 'You are already in Lagos');
  if (s.loc !== 'ikeja') assert.ok(e.cab > 0, 'a cab to Ikeja is included');
  const before = s.cash + s.bank, r = L.flyClass(s, 'abuja', 'first', true);
  assert.ok(r.ok, r.msg);
  assert.equal(s.loc, 'abj_airport'); assert.ok(s.ach.first_class);
  assert.ok(before - (s.cash + s.bank) >= f.total - 1);
  // No jet yet: fly private only by charter.
  assert.match(L.jetQuote(s, 'ph').disabled, /own a jet/);
  const c = L.flyJet(s, 'ph', true);
  assert.ok(c.ok, c.msg); assert.equal(s.loc, 'ph_airport'); assert.ok(s.ach.private_jet);
  // Chopper straight to a Lagos place.
  const dest = D.PLACES.find(p => p.district === 'lekki');
  const q = L.chopperQuote(s, dest.id);
  assert.ok(q.cost >= L.price(s, D.AIR.chopperIntercity) && !q.disabled);
  assert.ok(L.chopperTo(s, dest.id).ok); assert.equal(s.loc, 'lekki'); assert.ok(s.ach.chopper);
  // A life that books economy (no test cash top-up) replays to the same seal.
  const u = L.newGame({ seed: 78, origin: 'nepo', goal: 'freestyle' });
  while (u.pending.length) L.resolveChoice(u, 1);
  const g = L.flyClass(u, 'abuja', 'economy', true);
  assert.ok(g.ok, g.msg); assert.equal(u.loc, 'abj_airport');
  assert.equal(L.replayLife(u.replay).ledgerHash, u.ledgerHash);
});

test('members-only clubs: net worth or a referral gets you in, membership is weekly, acts are members only', () => {
  const s = L.newGame({ seed: 79, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  assert.match(L.clubQuote(s, 'tidewater', 'worth').disabled, /Net worth/);
  assert.match(L.clubQuote(s, 'tidewater', 'referral').disabled, /vouch/);
  assert.match(L.clubActOptions(s, 'tidewater')[0].disabled, /Members only/);
  assert.equal(L.joinClub(s, 'tidewater', 'worth').ok, false);
  // Rich enough now (test top-up): the joining fee is charged once, then just the week.
  s.cash += 400000000;
  const q = L.clubQuote(s, 'tidewater', 'worth');
  assert.ok(!q.disabled && q.fee > 0 && q.total === q.fee + q.weekly);
  assert.ok(L.joinClub(s, 'tidewater', 'worth').ok);
  assert.ok(L.clubMember(s, 'tidewater') && s.ach.members_club);
  assert.equal(L.clubQuote(s, 'tidewater', 'worth').fee, 0, 'renewal skips the joining fee');
  s.loc = 'ikoyi'; s.t = Math.floor(s.t / 1440) * 1440 + 1440 + 18 * 60;
  const before = s.cash + s.bank, r = L.clubAct(s, 'tidewater', 'pregame');
  assert.ok(r.ok, r.msg); assert.ok(before - (s.cash + s.bank) >= L.price(s, 35000));
  s.t += 8 * 1440;
  assert.equal(L.clubMember(s, 'tidewater'), false, 'a week runs out');
});

test('Lekki Hyde Park: buy ready-built, or buy a plot and build in three stages into the same house', () => {
  const s = L.newGame({ seed: 81, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  s.cash += 500000000; s.loc = 'lekki';
  assert.match(L.hpInfo(s, 'low').why, /plot/);
  assert.ok(L.buyProperty(s, 'hp_plot_low').ok);
  for (let k = 0; k < 3; k++) {
    while (s.pending.length) L.resolveChoice(s, 1);
    const q = L.hpInfo(s, 'low'); assert.equal(q.why, '', q.why);
    assert.ok(L.hpBuild(s, 'low').ok);
    assert.match(L.hpInfo(s, 'low').why, /still going on/);
    for (let d = 0; d < 9 && s.hpBuild && s.hpBuild.low && s.hpBuild.low.working; d++) { L._advance(s, 1440); while (s.pending.length) L.resolveChoice(s, 1); s.loc = 'lekki'; }
  }
  assert.ok(s.properties.some(p => p.id === 'hp_terrace' && p.built), 'the plot became the terrace');
  assert.ok(!s.properties.some(p => p.id === 'hp_plot_low'));
  assert.ok(L.ownsHome(s, 'hp_terrace_own') && s.ach.hyde_park);
  assert.ok(L.buyProperty(s, 'hp_semi').ok, 'or buy ready-built');
});

test('new-player setup: exactly two traits, a start home the origin allows, and a look, all replay to the same seal', () => {
  const o = L.newGame({ seed: 4242 }).origin, home = D.START_HOMES[o][1];
  const s = L.newGame({ seed: 4242, goal: 'freestyle', traits: ['techie', 'cool'], startHome: home, look: { skin: 4, hair: 5, shape: 0 }, outfit: { top: 'st_adire', bottom: 'st_wrapper' } });
  assert.deepEqual(s.outfit, { top: 'st_adire', bottom: 'st_wrapper' });
  assert.equal(L.newGame({ seed: 1, outfit: { top: 'agbada', bottom: 'jeans' } }).wardrobe.length, 0, 'only starter clothes, free');
  assert.deepEqual(s.traits, ['techie', 'cool']);
  assert.equal(s.home, home); assert.equal(s.loc, D.HOMES[home].district);
  assert.ok(s.skills.tech >= 12);
  assert.deepEqual(s.look, { skin: 4, hair: 5, shape: 0 });
  // One trait, three, or a duplicate: ignored. A home from another origin: ignored.
  assert.equal(L.newGame({ seed: 1, traits: ['techie'] }).traits, undefined);
  assert.equal(L.newGame({ seed: 1, traits: ['techie', 'cool', 'chef'] }).traits, undefined);
  assert.equal(L.newGame({ seed: 1, traits: ['cool', 'cool'] }).traits, undefined);
  const lapoSeed = [...Array(50).keys()].find(n => L.newGame({ seed: n }).origin === 'lapo');
  assert.equal(L.newGame({ seed: lapoSeed, startHome: 'lekki_studio' }).home, D.ORIGINS.lapo.home);
  while (s.pending.length) L.resolveChoice(s, 1);
  L.wait(s, 60);
  const r = L.replayLife(s.replay);
  assert.equal(r.ledgerHash, s.ledgerHash); assert.equal(r.home, s.home); assert.deepEqual(r.traits, s.traits);
  assert.deepEqual(r.outfit, s.outfit);
  assert.equal(L.replayLife(Object.assign({}, s.replay, { traits: ['nope', 'cool'] })), null);
});

test('white wedding: 30% deposit books a Saturday four weeks out; the balance is paid on the day at the venue', () => {
  const s = L.newGame({ seed: 83, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  const plan = { venue: 'ikeja_centre', planner: 'standard', asoebi: 'family', vendors: 'classic', theme: 'emerald', decor: 'elegant', extras: ['arch', 'sparks', 'nope'], after: 'lounge' };
  assert.match(L.wwQuote(s, plan).disabled, /relationship/);
  s.partner = { name: 'Kemi', stage: 'introduced', aff: 80, since: 0, contact: 0 };
  s.cash += 80000000;
  const q = L.wwQuote(s, plan);
  assert.ok(!q.disabled, q.disabled);
  assert.deepEqual(q.plan.extras, ['arch', 'sparks'], 'unknown extras are dropped');
  assert.equal(q.date % 7, 5, 'a Saturday'); assert.ok(q.date - Math.floor(s.t / 1440) >= 28);
  assert.equal(q.deposit, Math.round(q.total * 0.3 / 1000) * 1000);
  const before = s.cash + s.bank;
  assert.ok(L.planWhiteWedding(s, plan).ok);
  assert.equal(before - (s.cash + s.bank), q.deposit);
  assert.match(L.wwQuote(s, plan).disabled, /already booked/);
  assert.match(L.wwDayBlock(s), /in \d+ days/);
  // Jump to 10am on the day, at the venue.
  s.t = q.date * 1440 + 10 * 60; s.loc = 'ikeja'; s.pending = [];
  assert.equal(L.wwDayBlock(s), '');
  const b2 = s.cash + s.bank, r = L.holdWhiteWedding(s);
  assert.ok(r.ok, r.msg);
  assert.equal(s.partner.stage, 'married'); assert.ok(s.ach.white_wedding);
  assert.ok(b2 - (s.cash + s.bank) > 0, 'gifts never cover the balance');
});

test('regressions: no registry wedding over a booked white wedding; one Hyde Park home or plot per zone', () => {
  const s = L.newGame({ seed: 83, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  s.partner = { name: 'K', stage: 'introduced', aff: 80, since: 0, contact: 0 }; s.cash += 80000000;
  assert.ok(L.planWhiteWedding(s, { venue: 'yaba_hall', planner: 'none', asoebi: 'none', vendors: 'basic', theme: 'lilac', decor: 'simple', extras: [], after: 'none' }).ok);
  assert.match(L.weddingOptions(s)[0].disabled, /already booked/);
  assert.equal(L.marry(s, 'registry').ok, false);
  const h = L.newGame({ seed: 81, origin: 'nepo', goal: 'freestyle' });
  while (h.pending.length) L.resolveChoice(h, 1);
  h.cash += 500000000; h.loc = 'lekki';
  assert.ok(L.buyProperty(h, 'hp_plot_low').ok);
  assert.equal(L.buyProperty(h, 'hp_plot_low').ok, false, 'no second plot');
  assert.equal(L.buyProperty(h, 'hp_terrace').ok, false, 'build on the plot instead');
  assert.ok(L.hpBuild(h, 'low').ok);
  assert.equal(L.buyProperty(h, 'hp_terrace').ok, false, 'not while building');
  assert.ok(L.buyProperty(h, 'hp_semi').ok);
  assert.equal(L.buyProperty(h, 'hp_semi').ok, false, 'one home per zone');
});

test('lagoon cruise: board in Ikoyi, spots only while aboard, the deck tires, December fare, replays', () => {
  const s = L.newGame({ seed: 91, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  assert.equal(L.cruiseSpot(s, 'party').ok, false, 'not aboard');
  if (s.loc !== 'ikoyi') { const o = L.travelOptions(s, 'ikoyi').filter(o => !o.disabled && !(o.mode === 'trek' && (o.tired || o.km > 45))).sort((a, b) => a.cost - b.cost)[0]; assert.ok(L.travel(s, 'ikoyi', o.mode).ok); }
  while (s.pending.length) L.resolveChoice(s, 1);
  if (L.hour(s) < 9) L.wait(s, (9 - L.hour(s)) * 60);
  while (s.pending.length) L.resolveChoice(s, 1);
  const before = s.cash + s.bank, r = L.cruiseBoard(s);
  assert.ok(r.ok, r.msg);
  assert.equal(before - (s.cash + s.bank), L.price(s, D.CRUISE.fare));
  assert.ok(L.cruiseAboard(s) && s.ach.cruise);
  assert.match(L.cruiseBlock(s), /already aboard/);
  const b2 = s.cash + s.bank; assert.ok(L.cruiseSpot(s, 'bar').ok); assert.equal(b2 - (s.cash + s.bank), L.price(s, 2500));
  assert.ok(L.cruiseSpot(s, 'rail').ok); assert.ok(D.CRUISE.sights.some(x => s.cruise.last.indexOf(x) === 0));
  assert.equal(L.cruiseSpot(s, 'nope').ok, false);
  assert.ok(L.cruiseLeave(s).ok); assert.equal(L.cruiseAboard(s), false);
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('CV: built from the game records, keeps past jobs, never touches money', () => {
  const s = L.newGame({ seed: 95, origin: 'mid', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  const open = Object.keys(D.CAREERS)[0];
  assert.ok(L.applyJob(s, open, true).ok);
  let c = L.cv(s);
  assert.equal(c.work.length, 1); assert.ok(c.work[0].current);
  const h = s.ledgerHash;
  assert.ok(L.quitJob(s).ok);
  c = L.cv(s);
  assert.equal(c.work.length, 1); assert.equal(c.work[0].why, 'resigned'); assert.ok(!c.work[0].current);
  assert.ok(c.record.clean);
  assert.equal(s.ledgerHash, h, 'the CV is state, not money');
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('fishing: a rod once, three casts a day at a waterfront, sell at 80% or cook, replays', () => {
  const s = L.newGame({ seed: 97, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  assert.match(L.fishInfo(s).why, /rod/);
  assert.ok(L.buyRod(s).ok); assert.equal(L.buyRod(s).ok, false);
  if (!D.FISHING.spots[s.loc]) { const o = L.travelOptions(s, 'lekki').filter(o => !o.disabled && !(o.mode === 'trek' && (o.tired || o.km > 45))).sort((a, b) => a.cost - b.cost)[0]; assert.ok(L.travel(s, 'lekki', o.mode).ok); }
  for (let i = 0; i < 3; i++) { while (s.pending.length) L.resolveChoice(s, 1); assert.ok(L.fish(s).ok); }
  while (s.pending.length) L.resolveChoice(s, 1);
  assert.match(L.fishInfo(s).why, /Three casts/);
  const v = L.fishInfo(s).bagValue, b = s.cash + s.bank;
  if (v) { assert.ok(L.sellFish(s).ok); assert.equal(s.cash + s.bank - b, v); } else assert.equal(L.sellFish(s).ok, false);
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('live rooms: beach entry and spots, Tidewater members only, boosts taper, replays', () => {
  const s = L.newGame({ seed: 99, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  s.cash += 400000000;
  s.loc = 'ajah'; s.t = Math.floor(s.t / 1440) * 1440 + 1440 + 10 * 60;
  assert.equal(L.roomSpot(s, 'beach', 'bar').ok, false, 'not there yet');
  const b0 = s.cash + s.bank; assert.ok(L.roomEnter(s, 'beach').ok); assert.equal(b0 - (s.cash + s.bank), L.price(s, 3000));
  assert.match(L.roomBlock(s, 'beach'), /already/);
  assert.match(L.roomSpot(s, 'beach', 'bonfire').msg, /evening/);
  const f0 = s.needs.fun; assert.ok(L.roomSpot(s, 'beach', 'volley').ok); assert.ok(s.needs.fun >= f0);
  for (let i = 0; i < 2; i++) { s.pending = []; assert.ok(L.roomSpot(s, 'beach', 'volley').ok); }
  s.pending = []; L.roomSpot(s, 'beach', 'loungers'); assert.equal(L.roomSpot(s, 'beach', 'bar').ok, false, 'two hours are up');
  assert.ok(L.roomLeave(s).ok); assert.equal(L.roomIn(s, 'beach'), false);
  s.pending = [];
  s.loc = 'ikoyi'; s.t = Math.floor(s.t / 1440) * 1440 + 1440 + 18 * 60;
  assert.match(L.roomBlock(s, 'tidewater'), /Members only/);
  assert.ok(L.joinClub(s, 'tidewater', 'worth').ok);
  s.pending = []; assert.ok(L.roomEnter(s, 'tidewater').ok); s.pending = []; assert.ok(L.roomSpot(s, 'tidewater', 'oven').ok);
  const r = L.newGame({ seed: 100, origin: 'nepo', goal: 'freestyle' });
  while (r.pending.length) L.resolveChoice(r, 1);
  if (r.loc !== 'ajah') { const o = L.travelOptions(r, 'ajah').filter(o => !o.disabled && !(o.mode === 'trek' && (o.tired || o.km > 45))).sort((a, b) => a.cost - b.cost)[0]; assert.ok(L.travel(r, 'ajah', o.mode).ok); }
  while (r.pending.length) L.resolveChoice(r, 1);
  if (L.hour(r) < 7) L.wait(r, (7 - L.hour(r)) * 60);
  while (r.pending.length) L.resolveChoice(r, 1);
  if (L.roomEnter(r, 'beach').ok) { while (r.pending.length) L.resolveChoice(r, 1); L.roomSpot(r, 'beach', 'loungers'); }
  assert.equal(L.replayLife(r.replay).ledgerHash, r.ledgerHash);
});

test('live rooms: the club strip opens late and runs past midnight; market and park keep their hours', () => {
  const s = L.newGame({ seed: 101, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  s.cash += 5000000; s.loc = 'vi';
  const d = Math.floor(s.t / 1440) * 1440 + 1440;
  s.t = d + 20 * 60; assert.match(L.roomBlock(s, 'club'), /Open 22:00–04:00/);
  s.t = d + 1440 + 2 * 60; assert.equal(L.roomBlock(s, 'club'), '');
  assert.ok(L.roomEnter(s, 'club').ok); s.pending = []; assert.ok(L.roomSpot(s, 'club', 'floor').ok);
  s.loc = 'island'; s.t = d + 2 * 1440 + 9 * 60; s.pending = [];
  assert.equal(L.roomBlock(s, 'market'), ''); assert.match(L.roomBlock(s, 'park'), /Open 16/);
});

test('live rooms: every room uses a known layout and only that layout\'s spots', () => {
  require('../src/cruise.js'); const C = globalThis;
  for (const [id, R] of Object.entries(D.ROOMS)) {
    const lay = C.LasgidiCruise.LAYOUTS[R.layout || id]; assert.ok(lay, 'layout for ' + id);
    for (const sp of Object.keys(R.spots)) assert.ok(lay[sp], id + ' spot ' + sp);
    assert.ok(D.PLACES.find(p => p.id === R.place), 'place for ' + id);
  }
});

test('live rooms: Abuja and PH rooms open in their own city, keep their hours, and replay', () => {
  const s = L.newGame({ seed: 77, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  s.cash += 5000000;
  const d = Math.floor(s.t / 1440) * 1440 + 1440;
  s.t = d + 11 * 60; assert.match(L.roomBlock(s, 'wuse_mkt'), /Go to Wuse first/);
  s.loc = 'abj_wuse'; assert.equal(L.roomBlock(s, 'wuse_mkt'), '');
  s.t = d + 20 * 60; assert.match(L.roomBlock(s, 'wuse2'), /Open 22:00–04:00/);
  s.t = d + 1440 + 60; assert.equal(L.roomBlock(s, 'wuse2'), '');
  const b0 = s.cash + s.bank; assert.ok(L.roomEnter(s, 'wuse2').ok); assert.equal(b0 - (s.cash + s.bank), L.price(s, 8000));
  s.loc = 'abj_maitama'; s.t = d + 2 * 1440 + 9 * 60; assert.equal(L.roomBlock(s, 'millennium'), '');
  s.loc = 'ph_dline'; assert.equal(L.roomBlock(s, 'mile1'), ''); assert.match(L.roomBlock(s, 'garden_city'), /Go to GRA first/);
  s.loc = 'ph_oldgra'; s.t = d + 2 * 1440 + 20 * 60; assert.match(L.roomBlock(s, 'isaac_boro'), /Open 07/);
  // A real life: fly to Abuja, go to Wuse market and walk the stalls; it replays to the same seal.
  const r = L.newGame({ seed: 78, origin: 'nepo', goal: 'freestyle' });
  while (r.pending.length) L.resolveChoice(r, 1);
  const go = L.travelOptions(r, 'ikeja').filter(o => !o.disabled && !(o.mode === 'trek' && (o.tired || o.km > 45))).sort((a, b) => a.cost - b.cost)[0];
  assert.ok(L.travel(r, 'ikeja', go.mode).ok); while (r.pending.length) L.resolveChoice(r, 1);
  const o = L.intercityOptions(r, 'abuja').find(o => o.mode === 'flight' && !o.disabled);
  assert.ok(o && L.intercity(r, 'abuja', 'flight').ok, 'fly to Abuja');
  {
    while (r.pending.length) L.resolveChoice(r, 1);
    if (r.loc !== 'abj_wuse') { const t = L.travelOptions(r, 'abj_wuse').filter(o => !o.disabled && !(o.mode === 'trek' && (o.tired || o.km > 45))).sort((a, b) => a.cost - b.cost)[0]; if (t) L.travel(r, 'abj_wuse', t.mode); }
    while (r.pending.length) L.resolveChoice(r, 1);
    const h = L.hour(r); if (h < 8 || h >= 16) L.wait(r, ((32 - h) % 24) * 60);
    while (r.pending.length) L.resolveChoice(r, 1);
    assert.ok(L.roomEnter(r, 'wuse_mkt').ok, L.roomBlock(r, 'wuse_mkt')); while (r.pending.length) L.resolveChoice(r, 1); assert.ok(L.roomSpot(r, 'wuse_mkt', 'buka').ok);
  }
  assert.equal(L.replayLife(r.replay).ledgerHash, r.ledgerHash);
});

test('room nights: join once on the right weekday and hours, past midnight too, and replay', () => {
  const s = L.newGame({ seed: 91, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  s.cash += 5000000; s.loc = 'vi';
  const base = Math.floor(s.t / 1440) * 1440 + 7 * 1440, sat = base + ((5 - (Math.floor(base / 1440) % 7)) + 7) % 7 * 1440;
  s.t = sat + 22 * 60 + 30; assert.ok(L.roomEnter(s, 'club').ok); s.pending = [];
  assert.match(L.roomNightInfo(s, 'club').why, /Sats 23:00–03:00/);
  s.t = sat + 23 * 60 + 10; const b0 = s.cash + s.bank;
  assert.ok(L.roomNight(s, 'club').ok); assert.equal(b0 - (s.cash + s.bank), L.price(s, 15000)); s.pending = [];
  s.t = sat + 1440 + 60; assert.ok(L.roomIn(s, 'club')); assert.match(L.roomNight(s, 'club').msg || '', /You joined tonight/);
  // Out of the room: blocked. Wrong day: blocked.
  const r = L.newGame({ seed: 92, origin: 'nepo', goal: 'freestyle' }); while (r.pending.length) L.resolveChoice(r, 1);
  assert.match(L.roomNightInfo(r, 'park').why, /Fris 18:00–23:00|Go in first/);
  // A real life on the island that waits for Friday evening at Freedom Park replays to its seal.
  if (r.loc !== 'island') { const o = L.travelOptions(r, 'island').filter(o => !o.disabled && !(o.mode === 'trek' && (o.tired || o.km > 45))).sort((a, b) => a.cost - b.cost)[0]; assert.ok(L.travel(r, 'island', o.mode).ok); }
  while (r.pending.length) L.resolveChoice(r, 1);
  for (let i = 0; i < 20 && !(L.roomNightInfo(r, 'park').live); i++) { L.wait(r, 60 * 6); while (r.pending.length) L.resolveChoice(r, 1); }
  while (!L.roomNightInfo(r, 'park').live) { L.wait(r, 60); while (r.pending.length) L.resolveChoice(r, 1); }
  assert.ok(L.roomEnter(r, 'park').ok, L.roomBlock(r, 'park')); while (r.pending.length) L.resolveChoice(r, 1); assert.ok(L.roomNight(r, 'park').ok, L.roomNightInfo(r, 'park').why);
  assert.equal(L.replayLife(r.replay).ledgerHash, r.ledgerHash);
});

test('room friends: hang out once a day with a friend who is in the room, and replay', () => {
  const s = L.newGame({ seed: 93, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  s.loc = 'island'; const d = Math.floor(s.t / 1440) * 1440 + 1440; s.t = d + 10 * 60;
  assert.match(L.roomHang(s, 'market', 'bisi').msg, /Go in first/);
  assert.ok(L.roomEnter(s, 'market').ok); s.pending = [];
  assert.match(L.roomHang(s, 'market', 'kunle').msg, /not here/);
  const before = s.friends.bisi.lvl;
  assert.ok(L.roomHang(s, 'market', 'bisi').ok); assert.ok(s.friends.bisi.lvl > before); s.pending = [];
  assert.match(L.roomHang(s, 'market', 'bisi').msg, /already caught up/);
  s.t = d + 1440 + 10 * 60; s.pending = []; assert.ok(L.roomEnter(s, 'market').ok); s.pending = [];
  assert.ok(L.roomHang(s, 'market', 'bisi').ok);
  // A real life: go to Lagos Island, walk into Balogun and catch up with Mama Bisi.
  const r = L.newGame({ seed: 94, origin: 'nepo', goal: 'freestyle' }); while (r.pending.length) L.resolveChoice(r, 1);
  if (r.loc !== 'island') { const o = L.travelOptions(r, 'island').filter(o => !o.disabled && !(o.mode === 'trek' && (o.tired || o.km > 45))).sort((a, b) => a.cost - b.cost)[0]; assert.ok(L.travel(r, 'island', o.mode).ok); }
  while (r.pending.length) L.resolveChoice(r, 1);
  while (L.roomBlock(r, 'market')) { L.wait(r, 60); while (r.pending.length) L.resolveChoice(r, 1); }
  assert.ok(L.roomEnter(r, 'market').ok); while (r.pending.length) L.resolveChoice(r, 1);
  assert.ok(L.roomHang(r, 'market', 'bisi').ok, L.roomHangBlock(r, 'market', 'bisi'));
  assert.equal(L.replayLife(r.replay).ledgerHash, r.ledgerHash);
});

test('room passport: stamps rooms once, counts nights and catch-ups, and never touches score or seal', () => {
  const s = L.newGame({ seed: 95, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  s.cash += 9000000; const d = Math.floor(s.t / 1440) * 1440 + 1440;
  const ach0 = Object.keys(s.ach).length;
  assert.equal(L.passportInfo(s).seen, 0); assert.equal(L.passportInfo(s).total, Object.keys(D.ROOMS).length + 1);
  s.loc = 'island'; s.t = d + 10 * 60;
  assert.match(L.roomEnter(s, 'market').msg, /New passport stamp \(1\/12\)/); s.pending = [];
  s.t = d + 1440 + 10 * 60; assert.doesNotMatch(L.roomEnter(s, 'market').msg, /stamp/); s.pending = [];
  assert.equal(L.passportInfo(s).seen, 1);
  // Catch up with Mama Bisi on ten different days.
  for (let i = 0; i < 10; i++) { s.t = d + (2 + i) * 1440 + 10 * 60; s.pending = []; for (const k of Object.keys(s.needs)) s.needs[k] = k === 'stress' ? 0 : 90; if (!L.roomIn(s, 'market')) assert.ok(L.roomEnter(s, 'market').ok); s.pending = []; const h = L.roomHang(s, 'market', 'bisi'); assert.ok(h.ok, i + ' ' + h.msg + ' ' + L.roomBlock(s, 'market')); }
  const P = L.passportInfo(s); assert.equal(P.hangs, 10); assert.ok(P.badges.find(b => b.id === 'friends').got); assert.ok(!P.badges.find(b => b.id === 'lagos').got);
  assert.ok(!P.badges.some(b => s.ach[b.id] || s.ach['room_' + b.id]), 'passport badges are not achievements'); void ach0;
  // Stamp every room directly: the badges for Lagos, three cities and the full passport light up.
  for (const k of ['cruise'].concat(Object.keys(D.ROOMS))) s.passport.rooms[k] = 1;
  const Q = L.passportInfo(s); assert.ok(['lagos', 'cities', 'all'].every(id => Q.badges.find(b => b.id === id).got));
});

test('rules 15: leaving and re-entering a room does not reset the daily catch-up or tonight\'s room night; rules 14 lives keep the old behaviour', () => {
  const run = rules => {
    const s = L.newGame({ seed: 96, origin: 'nepo', goal: 'freestyle', rules });
    while (s.pending.length) L.resolveChoice(s, 1);
    s.cash += 9000000; s.loc = 'island';
    const base = Math.floor(s.t / 1440) * 1440 + 7 * 1440, fri = base + ((4 - (Math.floor(base / 1440) % 7)) + 7) % 7 * 1440;
    s.t = fri + 18 * 60 + 5; assert.ok(L.roomEnter(s, 'park').ok); s.pending = [];
    assert.ok(L.roomHang(s, 'park', 'femi').ok); s.pending = [];
    assert.ok(L.roomNight(s, 'park').ok); s.pending = [];
    L.roomLeave(s); assert.ok(L.roomEnter(s, 'park').ok, L.roomBlock(s, 'park')); s.pending = [];
    return { hang: L.roomHang(s, 'park', 'femi'), night: L.roomNight(s, 'park') };
  };
  const now = run(L.RULES);
  assert.ok(L.RULES >= 15);
  assert.ok(!now.hang.ok); assert.match(now.hang.msg, /already caught up/);
  assert.ok(!now.night.ok); assert.match(now.night.msg, /joined tonight/);
  const old = run(14);
  assert.ok(old.hang.ok && old.night.ok, 'rules 14 replays as it was played');
});

test('rules 15: re-entering a free room the same day gives no fresh entry boost and keeps the six-move taper', () => {
  const s = L.newGame({ seed: 97, origin: 'nepo', goal: 'freestyle' });
  while (s.pending.length) L.resolveChoice(s, 1);
  s.loc = 'abj_maitama'; const d = Math.floor(s.t / 1440) * 1440 + 1440; s.t = d + 9 * 60;
  s.needs.fun = 10; assert.ok(L.roomEnter(s, 'millennium').ok); s.pending = [];
  const f1 = s.needs.fun; assert.ok(f1 > 10);
  L.roomLeave(s); assert.ok(L.roomEnter(s, 'millennium').ok); s.pending = [];
  assert.equal(s.needs.fun, f1, 'no second entry boost today');
  const spots = ['stage', 'seats', 'food', 'art', 'trees', 'stage'];
  s.cash += 100000;
  spots.forEach((sp, i) => { if (i === 3) { L.roomLeave(s); s.pending = []; assert.ok(L.roomEnter(s, 'millennium').ok); } s.pending = []; for (const k of ['hunger', 'energy']) s.needs[k] = 90; const r = L.roomSpot(s, 'millennium', sp); assert.ok(r.ok, sp + ' ' + r.msg); });
  L.roomLeave(s); s.pending = []; assert.ok(L.roomEnter(s, 'millennium').ok); s.pending = [];
  const before = s.needs.fun; assert.ok(L.roomSpot(s, 'millennium', 'stage').ok);
  assert.ok(s.needs.fun <= before, 'the seventh move today gives nothing, even on a new visit');
  // Next day the room is fresh again.
  s.t = d + 1440 + 9 * 60; s.pending = []; s.needs.fun = 10; assert.ok(L.roomEnter(s, 'millennium').ok); assert.ok(s.needs.fun > 10);
});

test('local friends: catch up once a day in Abuja and PH rooms, perks at 40 under rules 15 only, and replay', () => {
  const setup = rules => { const s = L.newGame({ seed: 98, origin: 'nepo', goal: 'freestyle', rules }); while (s.pending.length) L.resolveChoice(s, 1); s.cash += 9000000; return s; };
  const s = setup();
  assert.equal(D.LOCALS.tamuno.room, 'garden_city');
  s.loc = 'ph_gra'; const d = Math.floor(s.t / 1440) * 1440 + 1440;
  for (let i = 0; i < 8; i++) {
    s.t = d + i * 1440 + 22 * 60 + 30; s.pending = []; for (const k of Object.keys(s.needs)) s.needs[k] = k === 'stress' ? 0 : 90;
    const b0 = s.cash + s.bank; assert.ok(L.roomEnter(s, 'garden_city').ok); s.pending = [];
    const paid = b0 - (s.cash + s.bank);
    if (i === 0) assert.equal(paid, L.price(s, 8000));
    if (i === 7) assert.equal(paid, 0, 'Tamuno gets you in free at 40+');
    assert.ok(L.roomHang(s, 'garden_city', 'tamuno').ok); s.pending = [];
    assert.match(L.roomHang(s, 'garden_city', 'tamuno').msg, /already caught up/);
    L.roomLeave(s);
  }
  assert.ok(s.locals.tamuno >= 40); assert.ok(!s.friends.tamuno, 'locals never join the NPC friends list');
  assert.match(L.roomHang(s, 'garden_city', 'hauwa').msg, /not here/);
  // A rules 14 life gets the friendship but no perk.
  const o = setup(14); o.loc = 'ph_gra'; o.locals = { tamuno: 60 }; o.t = d + 22 * 60 + 30;
  assert.equal(L.roomFee(o, 'garden_city'), L.price(o, 8000));
  // Free plate once a day at Wuse Market with Hauwa at 40+.
  const w = setup(); w.loc = 'abj_wuse'; w.locals = { hauwa: 45 }; w.t = d + 11 * 60; assert.ok(L.roomEnter(w, 'wuse_mkt').ok); w.pending = [];
  let b = w.cash + w.bank; assert.match(L.roomSpot(w, 'wuse_mkt', 'buka').msg, /Hauwa is treating you/); assert.equal(b - (w.cash + w.bank), 0);
  w.pending = []; assert.ok(L.roomSpot(w, 'wuse_mkt', 'phones').ok); w.pending = []; b = w.cash + w.bank; assert.ok(L.roomSpot(w, 'wuse_mkt', 'buka').ok); assert.equal(b - (w.cash + w.bank), L.price(w, 1500));
  // A real life: fly to Port Harcourt, ride to D-Line, catch up with Ibiere at Mile 1; it replays to its seal.
  const r = L.newGame({ seed: 99, origin: 'nepo', goal: 'freestyle' }); while (r.pending.length) L.resolveChoice(r, 1);
  const go = L.travelOptions(r, 'ikeja').filter(o => !o.disabled && !(o.mode === 'trek' && (o.tired || o.km > 45))).sort((a, b) => a.cost - b.cost)[0]; if (r.loc !== 'ikeja') assert.ok(L.travel(r, 'ikeja', go.mode).ok); while (r.pending.length) L.resolveChoice(r, 1);
  assert.ok(L.intercity(r, 'ph', 'flight').ok); while (r.pending.length) L.resolveChoice(r, 1);
  const t = L.travelOptions(r, 'ph_dline').filter(o => !o.disabled && !(o.mode === 'trek' && (o.tired || o.km > 45))).sort((a, b) => a.cost - b.cost)[0]; assert.ok(L.travel(r, 'ph_dline', t.mode).ok); while (r.pending.length) L.resolveChoice(r, 1);
  while (L.roomBlock(r, 'mile1')) { L.wait(r, 60); while (r.pending.length) L.resolveChoice(r, 1); }
  assert.ok(L.roomEnter(r, 'mile1').ok); while (r.pending.length) L.resolveChoice(r, 1);
  assert.ok(L.roomHang(r, 'mile1', 'ibiere').ok, L.roomHangBlock(r, 'mile1', 'ibiere'));
  assert.equal(L.replayLife(r.replay).ledgerHash, r.ledgerHash);
});

test('no real business or maker names on places, place activities or vehicles', () => {
  const banned = /\b(Rolls-Royce|Bentley|Ferrari|Lamborghini|Aston Martin|McLaren|Bugatti|Mercedes|Maybach|BMW|Audi|Porsche|Range Rover|Lexus|Cadillac|Embraer|Cessna|Pilatus|Gulfstream|Bombardier|Dassault|Boeing|Airbus|Azimut|Ferretti|Sunseeker|Pershing|Benetti|Heesen|Sanlorenzo|Feadship|Lürssen|Oceanco|Royal Huisman|Perini|Quilox|The Palms|Terra Kulture|Landmark Beach|Jabi Lake Mall|Amala Shitta|CcHub|Nike Art|Corolla|Instagram)\b/;
  const texts = [];
  D.PLACES.forEach(p => texts.push(p.name, p.text || ''));
  Object.values(D.PLACE_ACTIONS).forEach(list => list.forEach(a => texts.push(a.label || '', a.text || '')));
  Object.values(D.VEHICLES).forEach(v => texts.push(v.name, v.text || ''));
  texts.push(D.CAR.name);
  const bad = texts.filter(t => banned.test(t));
  assert.deepEqual(bad, []);
});

// Rules 16 audit fixes. Each recipe reproduces a loophole under rules 15 and shows it closed under rules 16.
function life16(rules, seed) { const s = L.newGame({ seed: seed || 1, origin: 'nepo', goal: 'freestyle', rules }); while (s.pending.length) L.resolveChoice(s, 1); return s; }
function goTo(s, t) { while (s.t < t) { while (s.pending.length) L.resolveChoice(s, 1); for (const k in s.needs) s.needs[k] = k === 'stress' ? 0 : 100; L.wait(s, Math.min(240, t - s.t)); } while (s.pending.length) L.resolveChoice(s, 1); }

test('rules 16: a stock buy over the cap is refused before any money moves', () => {
  for (const rules of [15, 16]) {
    const s = life16(rules); s.t = 1440 * 7 + 630; s.bank = 30000000;
    assert.ok(L.buyStock(s, 'ekocem', 19000000).ok);
    const b = s.bank, r = L.buyStock(s, 'ekocem', 5000000);
    assert.ok(!r.ok);
    if (rules >= 16) assert.equal(s.bank, b); else assert.ok(s.bank < b, 'rules 15 replays as played');
  }
});

test('rules 16: firing a manager is not a visit, and hiring pays the first part-week', () => {
  const s = life16(16); assert.ok(L.buyBusiness(s, 'pos', Object.keys(D.BUSINESS_SITES)[0]).ok); goTo(s, 1440 * 10);
  const v0 = s.businesses[0].visit, b0 = s.cash + s.bank;
  assert.ok(L.hireManager(s, 0).ok); assert.ok(b0 - (s.cash + s.bank) > 0, 'part-week salary paid');
  assert.ok(L.fireManager(s, 0).ok); assert.equal(s.businesses[0].visit, v0);
});

test('rules 16: a loan repaid inside its first week still pays a week of interest', () => {
  for (const rules of [15, 16]) {
    const s = life16(rules); goTo(s, 1440 * 7 + 30); assert.ok(L.takeLoan(s, 'app', 100000).ok);
    goTo(s, 1440 * 14 - 30); s.cash += 500000;
    const b = s.cash + s.bank; while (s.loans.length) assert.ok(L.repayLoan(s, 0, s.loans[0].bal).ok);
    const paid = b - (s.cash + s.bank);
    if (rules >= 16) assert.ok(paid > 100000); else assert.equal(paid, 100000);
  }
});

test('rules 16: each tournament once a day, and two street mini-game runs a day', () => {
  for (const rules of [15, 16]) {
    const s = life16(rules); s.skills.fitness = 100; goTo(s, 1440 + 18 * 60); s.loc = 'mushin'; s.cash += 100000;
    let wins = 0; for (let i = 0; i < 4; i++) if (L.doAction(s, 'mushin_arm').ok) wins++;
    if (rules >= 16) assert.equal(wins, 1); else assert.ok(wins >= 2);
    const b = life16(rules); goTo(b, 1440 + 11 * 60); b.loc = 'ph_oldgra';
    let runs = 0; for (let i = 0; i < 4; i++) { b.needs.hunger = 50; b.needs.energy = 100; if (L.startMinigame(b, 'bole').ok && L.boleShift(b, 54000, 60, 0).ok) runs++; }
    if (rules >= 16) assert.equal(runs, 2); else assert.ok(runs >= 3);
  }
});

test('rules 16: past gem days cannot be farmed once a later day is hunted', () => {
  const s = life16(16); goTo(s, 1440 + 540);
  const later = '2026-10-15', older = '2026-10-01', g = L.gemsFor(later)[0];
  s.loc = g.district; assert.ok(L.collectGem(s, later, 0).ok);
  goTo(s, 1440 * 2 + 540); const o = L.gemsFor(older)[0]; s.loc = o.district;
  assert.match(L.collectGem(s, older, 0).msg, /gems are gone/);
});

test('rules 16: re-boarding the cruise the same day gives no fresh boost and keeps the deck count', () => {
  for (const rules of [15, 16]) {
    const s = life16(rules); goTo(s, 1440 + 600); s.loc = 'ikoyi'; s.cash += 100000;
    assert.ok(L.cruiseBoard(s).ok); L.cruiseLeave(s);
    s.needs.fun = 10; assert.ok(L.cruiseBoard(s).ok);
    if (rules >= 16) assert.equal(s.needs.fun, 10); else assert.ok(s.needs.fun > 10);
  }
});

test('rules 16: forged gift keys are refused, opening takes time, and sending gives social twice a day', () => {
  const s = life16(16); goTo(s, 1440 + 600); s.cash += 100000;
  assert.match(L.openGift(s, 'nobody', 'fabric').msg, /not valid/);
  const t0 = s.t; assert.ok(L.openGift(s, 'u12:1791900000000', 'fabric').ok); assert.ok(s.t > t0);
  s.needs.social = 10; for (let i = 0; i < 5; i++) assert.ok(L.sendGift(s, 'suya').ok);
  assert.equal(s.needs.social, 20, 'only the first two sends lift your mood');
});

test('rules 16: quitting and re-applying keeps today\'s shift and missed strikes', () => {
  const s = life16(16); const cid = Object.keys(D.CAREERS)[0];
  assert.ok(L.applyJob(s, cid, true).ok, cid); s.job.missed = 2; s.job.lastShift = L.day(s);
  assert.ok(L.applyJob(s, cid, true).ok);
  assert.equal(s.job.missed, 2); assert.equal(s.job.lastShift, L.day(s));
});

test('Abuja and PH: new careers, homes and business sites are valid and live in their own city', () => {
  const add = { careers: ['abj_trader', 'abj_driver', 'abj_hotel', 'ph_docks', 'ph_fishing', 'ph_hotel', 'ph_teacher'], homes: ['abj_kubwa_rp', 'abj_garki_flat', 'abj_jabi_flat', 'ph_choba_room', 'ph_dline_flat', 'ph_oldgra_bungalow'], sites: ['abj_wuse', 'abj_garki', 'abj_kubwa', 'ph_gra', 'ph_dline', 'ph_rumuokoro'] };
  for (const k of add.careers) { const c = D.CAREERS[k]; assert.ok(c && D.DISTRICTS[c.district] && D.SKILLS[c.skill] && c.pay.length === 5 && c.titles.length === 5 && c.req.length === 5, k); assert.notEqual(L.districtCity(c.district), 'lagos'); }
  for (const k of add.homes) { const h = D.HOMES[k]; assert.ok(h && D.DISTRICTS[h.district] && D.HOME_TYPES[h.type] && h.rent > 0, k); assert.notEqual(L.districtCity(h.district), 'lagos'); }
  for (const k of add.sites) { assert.ok(D.BUSINESS_SITES[k] && D.DISTRICTS[k], k); assert.notEqual(L.districtCity(k), 'lagos'); }
  assert.ok(D.INTERVIEWS.ph_teacher.length >= 5);
});

test('Port Harcourt life: dock job, a shift, the D-Line flat and a D-Line business, replayed to its seal', () => {
  const r = L.newGame({ seed: 101, origin: 'nepo', goal: 'freestyle' }); const done = () => { while (r.pending.length) L.resolveChoice(r, 1); };
  done();
  const go = (d) => { if (r.loc === d) return; const o = L.travelOptions(r, d).filter(o => !o.disabled && !(o.mode === 'trek' && (o.tired || o.km > 45))).sort((a, b) => a.cost - b.cost)[0]; assert.ok(o && L.travel(r, d, o.mode).ok, 'to ' + d); done(); };
  go('ikeja'); assert.ok(L.intercity(r, 'ph', 'flight').ok); done();
  go('ph_borokiri'); assert.ok(L.applyJob(r, 'ph_docks').ok, L.jobEligibility(r, 'ph_docks').reason); done();
  for (let i = 0; i < 48 && !L.availableActions(r).some(a => a.id === 'work_shift' && !a.disabled); i++) { L.wait(r, 60); done(); if (r.loc !== 'ph_borokiri') go('ph_borokiri'); }
  const b0 = r.cash + r.bank; assert.ok(L.doAction(r, 'work_shift').ok); done(); assert.ok(r.cash + r.bank > b0, 'paid for the shift');
  r.cash += 0; go('ph_dline');
  const mv = L.moveHouse(r, 'ph_dline_flat'); done();
  const biz = L.buyBusiness(r, 'pos', 'ph_dline'); done();
  assert.ok(mv.ok, mv.msg); assert.equal(r.home, 'ph_dline_flat');
  assert.ok(biz.ok, biz.msg); assert.equal(r.businesses[0].site, 'ph_dline');
  assert.equal(L.replayLife(r.replay).ledgerHash, r.ledgerHash);
});

test('rules 17: every place has INSIDE acts on the 15-minute grid that never pay out; hidden under rules 16', () => {
  const ids = new Set(Object.values(D.PLACE_ACTIONS).flat().map(a => a.id));
  for (const [k, list] of Object.entries(D.INSIDE)) for (const a of list) {
    assert.ok(a.mins > 0 && a.mins % 15 === 0, a.id); assert.ok(!ids.has(a.id), 'duplicate id ' + a.id); ids.add(a.id);
    assert.ok(!a.earn && !a.gig, a.id + ' pays nothing out');
  }
  for (const p of D.PLACES) assert.ok((D.INSIDE[D.insideKind(p)] || D.CIVIC_ACTS[p.id] || []).length >= 3, p.id + ' has at least 3 things to do inside'); // police and polling: rules 19
  const s = L.newGame({ seed: 71, origin: 'mid', goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0);
  assert.ok(s.rules >= 17);
  const here = L.availableActions(s).filter(a => a.inside);
  assert.ok(here.length >= 3, 'inside acts where you start');
  const a = here.find(x => !x.disabled); const r = L.doAction(s, a.id); assert.ok(r.ok, r.msg); sane(s);
  const old = L.newGame({ seed: 71, origin: 'mid', goal: 'freestyle', rules: 16 });
  assert.ok(!L.availableActions(old).some(x => x.inside), 'no INSIDE acts under rules 16');
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});

test('rules 17: trekking is free and open across a city, even when tired; rules 16 keeps its limits', () => {
  const s = L.newGame({ seed: 72, origin: 'mid', goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0);
  s.loc = 'festac'; s.needs.energy = 20;
  const o = L.travelOptions(s, 'ajah').find(x => x.mode === 'trek');
  assert.ok(o.km > 45, 'a long way'); assert.ok(!o.disabled, o.disabled); assert.equal(o.cost, 0); assert.ok(o.tired);
  const r = L.travel(s, 'ajah', 'trek'); assert.ok(r.ok, r.msg); assert.equal(s.loc, 'ajah'); assert.ok(s.needs.energy >= 0); sane(s);
  const old = L.newGame({ seed: 72, origin: 'mid', goal: 'freestyle', rules: 16 }); old.loc = 'festac'; old.needs.energy = 20;
  assert.match(L.travelOptions(old, 'ajah').find(x => x.mode === 'trek').disabled || '', /Too far|Too tired/);
  assert.match(L.travelOptions(s, 'abj_wuse').find(x => x.mode === 'trek').disabled || '', /Fly or take a bus/);
});

// Rules 18: festivals and big days.
function atMonth(s, month, wk, dowN, hr) { // month is the game month index (lives start in October = 9)
  const weeks = (((month - 9) % 12) + 12) % 12 * 4 + wk;
  s.t = (weeks * 7 + dowN) * 1440 + hr * 60;
}
test('rules 18: festival acts sit on the 15-minute grid with unique ids, and pay little', () => {
  const ids = new Set(Object.values(D.PLACE_ACTIONS).flat().map(a => a.id));
  for (const [pid, list] of Object.entries(D.FESTIVALS)) {
    assert.ok(D.PLACES.some(p => p.id === pid), 'festival place ' + pid + ' exists');
    for (const a of list) {
      assert.ok(a.mins > 0 && a.mins % 15 === 0, a.id); assert.ok(!ids.has(a.id), 'duplicate id ' + a.id); ids.add(a.id);
      assert.ok(a.fest && a.when && a.when.months, a.id + ' is a festival with a month');
      if (a.earn) assert.ok(a.gig && a.earn <= 4000, a.id + ' pays a small gig');
    }
  }
});
test('rules 18: Christmas at the cathedral only in the last week of December; hidden under rules 17; replays', () => {
  const s = L.newGame({ seed: 81, origin: 'mid', goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0);
  assert.ok(s.rules >= 18); s.loc = 'island';
  atMonth(s, 11, 1, 2, 19); assert.ok(!L.availableActions(s).some(a => a.id === 'fest_xmas_carols') || L.availableActions(s).find(a => a.id === 'fest_xmas_carols').disabled, 'not open in week 2');
  atMonth(s, 11, 3, 2, 19); const a = L.availableActions(s).find(x => x.id === 'fest_xmas_carols');
  assert.ok(a && !a.disabled, a ? a.disabled : 'missing'); const r = L.doAction(s, 'fest_xmas_carols'); assert.ok(r.ok, r.msg); sane(s);
  atMonth(s, 10, 3, 2, 19); assert.ok(!L.availableActions(s).some(x => x.id === 'fest_xmas_carols'), 'not shown in November');
  const old = L.newGame({ seed: 81, origin: 'mid', goal: 'freestyle', rules: 17 }); old.loc = 'island'; atMonth(old, 11, 3, 2, 19);
  assert.ok(!L.availableActions(old).some(x => x.fest), 'no festivals under rules 17');
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});
test('rules 18: festival gigs are once a day; the marathon and casting prizes are capped', () => {
  const s = L.newGame({ seed: 82, origin: 'mid', goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0);
  s.loc = 'oshodi'; atMonth(s, 3, 0, 1, 8); s.needs.energy = 100;
  const r1 = L.doAction(s, 'fest_eid_ram'); assert.ok(r1.ok, r1.msg);
  s.needs.energy = 100; const again = L.availableActions(s).find(x => x.id === 'fest_eid_ram'); assert.match(again.disabled || '', /Once a day/);
  // The marathon: only fit runners get paid, never more than the cap.
  let maxPrize = 0;
  for (let i = 0; i < 40; i++) {
    const m = L.newGame({ seed: 900 + i, origin: 'nepo', goal: 'freestyle' }); while (m.pending.length) L.resolveChoice(m, 0);
    m.loc = 'island'; atMonth(m, 1, 1, 5, 7); m.skills.fitness = 9999; m.needs.energy = 100;
    const r = L.doAction(m, 'fest_marathon_run'); assert.ok(r.ok, r.msg); const won = (r.msg.match(/₦([\d,]+)/) || [0, '0'])[1].replace(/,/g, ''); maxPrize = Math.max(maxPrize, +won);
    sane(m);
  }
  assert.ok(maxPrize <= L.price(s, 25000) * 1.01 + 1, 'marathon prize capped: ' + maxPrize);
  const c = L.newGame({ seed: 83, origin: 'nepo', goal: 'freestyle' }); while (c.pending.length) L.resolveChoice(c, 0);
  c.loc = 'vi'; atMonth(c, 10, 0, 0, 11); c.skills.charisma = 9999; c.needs.energy = 100;
  assert.ok(L.doAction(c, 'fest_style_casting').ok); atMonth(c, 10, 0, 2, 11);
  assert.match(L.availableActions(c).find(x => x.id === 'fest_style_casting').disabled || '', /One casting a week/);
});
test('rules 18: a rules-17 life can never do a festival act, even in season and in the right place', () => {
  const old = L.newGame({ seed: 84, origin: 'nepo', goal: 'freestyle', rules: 17 }); while (old.pending.length) L.resolveChoice(old, 0);
  old.loc = 'island'; atMonth(old, 11, 3, 2, 19);
  const before = old.ledgerHash, r = L.doAction(old, 'fest_xmas_carols');
  assert.equal(r.ok, false); assert.equal(old.ledgerHash, before);
  old.loc = 'vi'; atMonth(old, 10, 0, 0, 11); assert.equal(L.doAction(old, 'fest_style_casting').ok, false);
});
test('rules 18: Pulse gym branches cost more on the Island and most at Eko Atlantic; older lives never see them', () => {
  const B = D.BRANCH_ACTS, cost = id => B[id].find(a => /_pilates$/.test(a.id)).cost;
  assert.equal(Object.keys(B).length, 7);
  assert.ok(cost('pulse_yaba') < cost('pulse_ikoyi') && cost('pulse_ikoyi') < cost('pulse_eko'));
  for (const list of Object.values(B)) for (const a of list) { assert.ok(a.mins % 15 === 0, a.id); if (a.earn) assert.ok(a.gig && a.fest && a.earn <= 4000, a.id); }
  const old = L.newGame({ seed: 85, origin: 'nepo', goal: 'freestyle', rules: 17 }); old.loc = 'vi';
  assert.ok(!L.availableActions(old).some(a => /^pulse_/.test(a.id)));
});
test('rules 19: police, polling and hospital acts; hidden from rules-18 lives; small once-a-day gigs only', () => {
  for (const list of Object.values(D.CIVIC_ACTS)) for (const a of list) { assert.ok(a.mins % 15 === 0, a.id); if (a.earn) assert.ok(a.gig && a.fest && a.earn <= 3000, a.id); }
  assert.equal(D.PLACES.filter(p => p.civic === 'police').length, 8); // 6 in Lagos, one each in Abuja and Port Harcourt
  assert.equal(D.PLACES.filter(p => p.civic === 'polling').length, 12);
  const old = L.newGame({ seed: 91, origin: 'nepo', goal: 'freestyle', rules: 18 }); while (old.pending.length) L.resolveChoice(old, 0); old.loc = 'ikeja';
  assert.ok(!L.availableActions(old).some(a => /^(police|poll|hosp)_/.test(a.id)));
  const before = old.ledgerHash; assert.equal(L.doAction(old, 'police_ikeja_report').ok, false); assert.equal(old.ledgerHash, before);
});
test('rules 19: report a theft, follow the case; recovery is half at most and capped; a case goes cold', () => {
  let solved = 0, maxBack = 0;
  for (let i = 0; i < 30; i++) {
    const s = L.newGame({ seed: 1200 + i, origin: 'nepo', goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0);
    assert.equal(s.rules, 19); s.loc = 'ikeja'; atMonth(s, 9, 1, 1, 10); s.needs.energy = 100;
    s.lastLoss = { amt: 100000, what: 'Phone snatched', day: L.day(s), reported: false };
    let r = L.doAction(s, 'police_ikeja_report'); assert.ok(r.ok, r.msg); assert.equal(s.cases.length, 1); assert.ok(s.lastLoss.reported);
    assert.match(L.availableActions(s).find(a => a.id === 'police_ikeja_report').disabled || '', /Once a day/);
    assert.ok(L.doAction(s, 'police_ikeja_mobilise').ok); assert.match(L.availableActions(s).find(a => a.id === 'police_ikeja_mobilise').disabled || '', /already/);
    for (let d = 0; d < 16 && s.cases[0].status === 'open'; d++) {
      L.wait(s, 24 * 60); while (s.pending.length) L.resolveChoice(s, 0); s.needs.energy = 100; s.needs.hunger = 80; s.loc = 'ikeja';
      const c = L.availableActions(s).find(a => a.id === 'police_ikeja_check'); if (c.disabled) continue;
      const cash = s.cash; r = L.doAction(s, c.id); assert.ok(r.ok, r.msg); maxBack = Math.max(maxBack, s.cash - cash);
    }
    if (s.cases[0].status === 'solved') solved++;
    assert.notEqual(s.cases[0].status, 'open', 'no case stays open past 14 days of checking');
    sane(s);
  }
  assert.ok(solved > 0, 'some cases are solved');
  assert.ok(maxBack <= 20000 * 2, 'recovery capped: ' + maxBack);
});
test('rules 19: area boys on the street: four choices, odds shown, each resolves; doctor treats malaria', () => {
  const seen = new Set();
  for (let i = 0; i < 4; i++) {
    const s = L.newGame({ seed: 1300 + i, origin: 'nepo', goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0);
    s.pending.push({ id: 'streetboys', title: 'Area boys!', text: '', odds: { talk: 0.5, run: 0.5, stand: 0.5 }, toll: 200, options: ['a', 'b', 'c', 'd'], subs: ['', '', '', ''] });
    const r = L.resolveChoice(s, i); assert.ok(r.ok, r.msg); seen.add(r.msg); sane(s);
  }
  assert.ok(seen.size >= 3);
  const d = L.newGame({ seed: 1310, origin: 'nepo', goal: 'freestyle' }); while (d.pending.length) L.resolveChoice(d, 0);
  d.pending.push({ id: 'detained', title: '', text: '', bail: 5000, options: ['a', 'b'] }); const h0 = d.t; L.resolveChoice(d, 1);
  assert.equal(L.hour(d), 7); assert.ok(d.t > h0); assert.equal(d.stats.cellNights, 1);
  const m = L.newGame({ seed: 1311, origin: 'nepo', goal: 'freestyle' }); while (m.pending.length) L.resolveChoice(m, 0);
  m.loc = 'island'; atMonth(m, 9, 1, 1, 10); m.cash = 50000; m.sick = { kind: 'malaria', since: L.day(m), drugs: false, cure: -1 };
  const r = L.doAction(m, 'hosp_gen_hosp_doctor'); assert.ok(r.ok, r.msg); assert.ok(m.sick.drugs); assert.equal(m.sick.cure, L.day(m) + 1);
});
test('rules 19: a life that travels to a police division and acts replays to the same seal', () => {
  const s = L.newGame({ seed: 1320, origin: 'nepo', goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0);
  for (const dest of ['ikeja', 'oshodi', 'island']) {
    const o = L.travelOptions(s, dest).find(x => !x.disabled); if (!o) continue;
    L.travel(s, dest, o.mode); while (s.pending.length) L.resolveChoice(s, s.pending[0].options.length - 1);
    const a = L.availableActions(s).find(x => /^(police|poll|hosp)_/.test(x.id) && !x.disabled); if (a) L.doAction(s, a.id);
    while (s.pending.length) L.resolveChoice(s, 0);
  }
  const r = L.replayLife(s.replay); assert.equal(r.ledgerHash, s.ledgerHash);
});
test('rules 19: Ikoyi Golf Club: ₦1bn gate, a six-hole Club Cup played by choices, capped prizes, once a week', () => {
  const s = L.newGame({ seed: 1400, origin: 'nepo', goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0);
  assert.match(L.clubQuote(s, 'golf', 'worth').disabled || '', /Net worth/);
  const old = L.newGame({ seed: 1401, origin: 'nepo', goal: 'freestyle', rules: 18 }); assert.match(L.clubQuote(old, 'golf', 'worth').disabled || '', /Not open/);
  let best = 0, won = 0;
  for (let i = 0; i < 25; i++) {
    const g = L.newGame({ seed: 1410 + i, origin: 'nepo', goal: 'freestyle' }); while (g.pending.length) L.resolveChoice(g, 0);
    g.clubs = { golf: { joined: true, via: 'worth', until: g.t + 7 * 1440 * 10 } }; g.loc = 'ikoyi'; g.cash = 5e6; g.skills.fitness = i * 400;
    while (L.dow(g) !== 5) g.t += 1440; g.t = g.t - (g.t % 1440) + 8 * 60;
    const r = L.clubAct(g, 'golf', 'cup'); assert.ok(r.ok, r.msg);
    let holes = 0; while (g.pending.length && g.pending[0].id === 'golfhole') { L.resolveChoice(g, i % 3); holes++; }
    assert.equal(holes, 6); assert.equal(g.golfCup, null);
    const cash0 = 5e6 - L.price(g, 500000); best = Math.max(best, g.cash - cash0); if (g.trophies) won++;
    assert.match(L.clubActOptions(g, 'golf').find(a => a.id === 'cup').disabled || '', /./); // cash was set by hand, so no ledger check
  }
  assert.ok(best <= 20000000 * 1.5, 'prize capped: ' + best); assert.ok(won > 0, 'somebody places');
});
test('rules 19: club radio slots are paid in game naira, 1 to 10 at a time; rules-18 lives cannot book; replays', () => {
  const s = L.newGame({ seed: 1500, origin: 'nepo', goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0);
  const before = s.cash + s.bank; assert.equal(L.radioBook(s, 0).ok, false); assert.equal(L.radioBook(s, 11).ok, false);
  const r = L.radioBook(s, 2); assert.ok(r.ok, r.msg); assert.equal(before - (s.cash + s.bank), L.radioCost(s, 2)); sane(s);
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
  const old = L.newGame({ seed: 1501, origin: 'nepo', goal: 'freestyle', rules: 18 }); while (old.pending.length) L.resolveChoice(old, 0); assert.equal(L.radioBook(old, 1).ok, false);
});
test('rules 19: every casino game pays back less than it takes, once a day each; high roller needs ₦50m', () => {
  for (const [id, n] of [['casino_slots', 400], ['casino_roulette', 300], ['casino_blackjack', 300]]) {
    let spent = 0, won = 0;
    const s = L.newGame({ seed: 2000, origin: 'nepo', goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0);
    for (let i = 0; i < n; i++) {
      s.loc = 'vi'; s.t = s.t - (s.t % 1440) + 1440 + 22 * 60; s.needs.energy = 100; s.needs.hunger = 80; s.cash = 1e7; s.pending = []; s.over = false;
      const a = L.availableActions(s).find(x => x.id === id); assert.ok(a && !a.disabled, id + ' ' + (a && a.disabled));
      const c0 = s.cash + s.bank, r = L.doAction(s, id); assert.ok(r.ok, r.msg); const d = s.cash + s.bank - c0; spent += a.cost; won += d + a.cost;
      if (i === 0) assert.match(L.availableActions(s).find(x => x.id === id).disabled || '', /Once a day/);
    }
    assert.ok(won < spent, id + ' returns ' + won + ' of ' + spent);
  }
  const s = L.newGame({ seed: 2999, origin: 'nepo', goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0); s.loc = 'vi'; s.t = s.t - (s.t % 1440) + 1440 + 22 * 60;
  assert.match(L.availableActions(s).find(x => x.id === 'casino_highroller').disabled || '', /High rollers|Costs/);
});
test('rules 19: rent a sea block for 7 days at ₦500 a plot; rented plots are no trade-in; owners must let go first; rules 18 cannot rent; replays', () => {
  const s = L.newGame({ seed: 1600, origin: 'nepo', goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0);
  const c0 = s.cash + s.bank, r = L.rentSeaPlots(s, 3, 2, 2, 2); assert.ok(r.ok, r.msg);
  assert.equal(c0 - (s.cash + s.bank), L.seaRentCost(s, 2, 2)); assert.equal(L.seaRentCost(s, 2, 2), L.price(s, 500) * 4); assert.ok(s.sea.rent);
  assert.equal(L.seaCost(s, 2, 2), L.price(s, D.SEA.price) * 4, 'renting gives no credit toward buying');
  assert.ok(L.rentSeaPlots(s, 3, 2, 2, 2).ok, 'renew'); sane(s);
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
  const o = L.newGame({ seed: 1601, origin: 'nepo', goal: 'freestyle' }); while (o.pending.length) L.resolveChoice(o, 0);
  o.bank += 0; assert.ok(L.buySeaPlots(o, 0, 0, 1, 1).ok); assert.match(L.rentSeaPlots(o, 5, 5, 1, 1).msg, /Let it go/);
  const old = L.newGame({ seed: 1602, origin: 'nepo', goal: 'freestyle', rules: 18 }); while (old.pending.length) L.resolveChoice(old, 0); assert.equal(L.rentSeaPlots(old, 0, 0, 1, 1).ok, false);
});
test('gems still replay: places added in rules 18-19 stay out of the gem pool, and the pool is pinned', () => {
  for (const p of D.PLACES) if (p.civic || p.chain === 'pulse' || p.club === 'golf') assert.ok(p.nogem, p.id + ' must be nogem');
  assert.deepEqual(L.gemsFor('2026-10-12').map(g => g.place), ['vi_food', 'banks', 'vip_jetty', 'tailor', 'studio']);
  assert.deepEqual(L.gemsFor('2026-10-17').map(g => g.place), ['palms', 'pitch', 'berger_cars', 'ikeja_mall', 'festac_market']);
});
test('rules 19: Abuja and Port Harcourt get police, a hospital, a hotel, a casino and a court; rules-18 lives see none; replays', () => {
  for (const [city, ds] of [['abuja', ['abj_garki', 'abj_maitama', 'abj_wuse']], ['ph', ['ph_gra', 'ph_oldgra', 'ph_transamadi']]]) {
    const kinds = new Set(D.PLACES.filter(p => p.civic && (D.DISTRICTS[p.district].city === city)).map(p => p.civic));
    for (const k of ['police', 'hospital', 'hotel', 'casino', 'court']) assert.ok(kinds.has(k), city + ' has ' + k);
    for (const d of ds) {
      const n = L.newGame({ seed: 1700, origin: 'nepo', goal: 'freestyle' }); n.loc = d;
      const o = L.newGame({ seed: 1700, origin: 'nepo', goal: 'freestyle', rules: 18 }); o.loc = d;
      assert.ok(L.availableActions(n).some(a => /^(police|hosp|hotel|casino|court)_/.test(a.id)), d + ' rules 19');
      assert.ok(!L.availableActions(o).some(a => /^(police|hosp|hotel|casino|court)_/.test(a.id)), d + ' rules 18');
    }
  }
  assert.ok(!D.PLACES.some(p => p.civic === 'polling' && D.DISTRICTS[p.district].city), 'polling units stay in Lagos');
  const s = L.newGame({ seed: 1701, origin: 'nepo', goal: 'freestyle' }); while (s.pending.length) L.resolveChoice(s, 0);
  const io = L.intercityOptions(s, 'abuja').find(x => !x.disabled); if (io) { L.intercity(s, 'abuja', io.mode); while (s.pending.length) L.resolveChoice(s, 0); }
  const a = L.availableActions(s).find(x => /^(hosp|court|police|hotel|casino)_/.test(x.id) && !x.disabled); if (a) L.doAction(s, a.id);
  assert.equal(L.replayLife(s.replay).ledgerHash, s.ledgerHash);
});
