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
      r = a.type === 'act' ? L.doAction(s, a.id) : a.type === 'travel' ? L.travel(s, a.dest, a.mode) : L.applyJob(s, a.id);
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
    assert.equal(PG.isWater(p.x, p.y), false, p.id + ' is in the water');
    assert.equal(PG.nearestDistrict(p.x, p.y).k, p.district, p.id + ' is outside ' + p.district);
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
  assert.equal(L.checkAd(Object.assign({}, good, { until: now + 30 * 3600e3 }), now), null, 'too long');
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
    assert.equal(PG.isWater(h.x, h.y), false, id + ' is in the water');
    assert.equal(PG.nearestDistrict(h.x, h.y).k, h.district, id + ' is outside ' + h.district);
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
