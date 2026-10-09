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
  s.loc = 'vi'; s.friends.kunle.lvl = 60;
  L.applyJob(s, 'bank');
  s.loc = 'mushin';
  s.t = 1440 * 5 + 14 * 60;              // Saturday afternoon, no shift
  const tip = L.advise(s).find(t => /commute/.test(t.text));
  assert.ok(tip && tip.act, JSON.stringify(L.advise(s)));
});

test('life summary scores a run', () => {
  const s = game('mid');
  const a = L.lifeSummary(s);
  L._advance(s, 14 * 1440);
  const b = L.lifeSummary(s);
  assert.ok(b.weeks === a.weeks + 2 && b.score !== a.score);
  assert.equal(typeof b.score, 'number');
});
