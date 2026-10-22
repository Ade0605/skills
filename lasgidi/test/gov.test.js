'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/gov.js');

// Fixed days in ISO week 2026-W42: Mon 12 Oct, Tue 13, Wed 14, Sat 17, Sun 18.
const MON = Date.UTC(2026, 9, 12, 10), TUE = Date.UTC(2026, 9, 13, 10), WED = Date.UTC(2026, 9, 14, 10), SAT = Date.UTC(2026, 9, 17, 10), SUN = Date.UTC(2026, 9, 18, 10);
const WK = '2026-W42';
const doc = (id, raw) => ({ id, raw: Object.assign({ week: WK }, raw) });

test('gov: the weekly cycle', () => {
  assert.equal(G.weekId(new Date(MON)), WK);
  assert.equal(G.phase(new Date(MON)), 'primaries'); assert.equal(G.phase(new Date(TUE)), 'primaries');
  assert.equal(G.phase(new Date(WED)), 'campaign'); assert.equal(G.phase(new Date(SAT)), 'election'); assert.equal(G.phase(new Date(SUN)), 'election');
});

test('gov: primaries pick a nominee; a ticket needs a deputy from the same party who accepted', () => {
  const parties = [doc('a', { party: 'epp' }), doc('b', { party: 'epp' }), doc('c', { party: 'epp', mate: 'a' }), doc('d', { party: 'phc' }), doc('x', { party: 'phc', mate: 'd' })];
  const runs = [doc('a', { party: 'epp', motto: 1, planks: ['security', 'health', 'health', 'bogus'], deputy: 'c', at: MON }), doc('b', { party: 'epp', motto: 2, deputy: 'c', at: MON + 1 }),
    doc('d', { party: 'phc', motto: 3, deputy: 'x', at: TUE }), doc('late', { party: 'phc', motto: 0, at: WED })];
  const primaries = [doc('b', { cand: 'a', at: TUE }), doc('c', { cand: 'a', at: TUE }), doc('d', { cand: 'a', at: TUE }) /* wrong party */, doc('a', { cand: 'b', at: WED }) /* after primaries */];
  const n = G.nominees(runs, parties, primaries, WK);
  const epp = n.tickets.find(t => t.party === 'epp'), phc = n.tickets.find(t => t.party === 'phc');
  assert.equal(epp.id, 'a'); assert.equal(epp.primary, 2); assert.equal(epp.deputy, 'c');
  assert.deepEqual(epp.planks, ['security', 'health']);
  assert.equal(phc.id, 'd'); assert.equal(phc.deputy, 'x');
  assert.ok(!n.candidates.some(c => c.id === 'late'), 'declaring after Tuesday is too late');
  const unaccepted = G.nominees([doc('a', { party: 'epp', motto: 1, deputy: 'b', at: MON })], parties, [], WK);
  assert.equal(unaccepted.tickets[0].deputy, null, 'b never accepted');
});

test('gov: the election collates by district, applies the spread rule and seats the Assembly', () => {
  const t1 = { party: 'epp', id: 'a', deputy: 'c', at: 1 }, t2 = { party: 'phc', id: 'd', deputy: 'x', at: 2 }, t3 = { party: 'lyp', id: 'z', deputy: null, at: 3 };
  const units = { ikeja: true, yaba: true, lekki: true };
  const v = (id, cand, unit, at) => doc(id, { cand, unit, at: at || SAT });
  // a wins more votes but only in Ikeja; d has 25%+ everywhere.
  const votes = [v('1', 'a', 'ikeja'), v('2', 'a', 'ikeja'), v('3', 'a', 'ikeja'), v('4', 'a', 'ikeja'), v('5', 'd', 'ikeja'), v('6', 'd', 'yaba'), v('7', 'd', 'lekki'),
    v('8', 'z', 'lekki') /* not on the ballot */, v('9', 'a', 'yaba', WED) /* before the polls */];
  const e = G.election([t1, t2, t3], votes, WK, units);
  assert.equal(e.rows[0].ticket.id, 'a'); assert.equal(e.rows[0].votes, 4);
  assert.equal(e.need, 2);
  assert.equal(e.winner.ticket.id, 'd', 'the most votes with the spread wins'); assert.equal(e.simpleMajority, false);
  assert.equal(Object.keys(e.voters).length, 7);
  const e2 = G.election([t1, t2], [v('1', 'a', 'ikeja'), v('2', 'a', 'yaba'), v('3', 'd', 'lekki'), v('4', 'a', 'ikeja'), v('5', 'a', 'mars')], WK, units);
  assert.equal(e2.units.other, 1, 'unknown units collate as other');
});

test('gov: the Executive Council: only the governor appoints; the Assembly confirms Commissioners', () => {
  const cab = [doc('g', { posts: { finance: 'p1', health: 'p2', sa_media: 'p3', bogus: 'p4', works: 'g' } }), doc('h', { posts: { finance: 'impostor' } })];
  const assembly = { m1: 'g', m2: 'g', m3: 'g' };
  const conf = [doc('m1', { votes: { finance: 1, health: -1 } }), doc('m2', { votes: { finance: 1, health: -1 } }), doc('m3', { votes: { finance: -1 } }), doc('outsider', { votes: { health: 1, finance: -1 } })];
  const c = G.council('g', cab, conf, assembly, WK);
  const by = Object.fromEntries(c.map(r => [r.post, r]));
  assert.deepEqual(Object.keys(by).sort(), ['finance', 'health', 'sa_media']);
  assert.equal(by.finance.id, 'p1'); assert.equal(by.finance.status, 'confirmed'); assert.equal(by.finance.yes, 2);
  assert.equal(by.health.status, 'rejected'); assert.equal(by.sa_media.status, 'appointed');
});

test('gov: Senator and President races on the same ballot; one office a week; the President needs spread', () => {
  const parties = [doc('a', { party: 'epp' }), doc('b', { party: 'phc' }), doc('c', { party: 'lyp' }), doc('v1', { party: 'epp' })];
  const runs = [doc('a', { office: 'sen', party: 'epp', motto: 1, at: TUE }), doc('b', { office: 'pres', party: 'phc', motto: 2, at: WED }), doc('c', { office: 'pres', party: 'lyp', motto: 3, at: MON }),
    doc('late', { office: 'sen', party: 'epp', motto: 0, at: SAT }), doc('nomember', { office: 'sen', party: 'odf', motto: 0, at: MON })];
  // The governor's nominees ignore anyone running for another office.
  assert.equal(G.nominees(runs, parties, [], WK).candidates.length, 0);
  const votes = [doc('v1', { unit: 'yaba', sen: 'a', senAt: SAT, pres: 'b', presAt: SAT }), doc('v2', { unit: 'ikeja', sen: 'a', senAt: SUN, pres: 'b', presAt: SUN }),
    doc('v3', { unit: 'abj_wuse', pres: 'c', presAt: SAT }), doc('v4', { unit: 'abj_wuse', pres: 'c', presAt: WED }) /* before the polls */, doc('v5', { unit: 'yaba', sen: 'late', senAt: SAT }) /* not a candidate */];
  const sen = G.race('sen', runs, parties, votes, WK);
  assert.deepEqual(sen.rows.map(r => r.cand.id), ['a']); assert.equal(sen.winner.cand.id, 'a'); assert.equal(sen.total, 2);
  const pres = G.race('pres', runs, parties, votes, WK);
  assert.equal(pres.total, 3); assert.equal(pres.rows[0].cand.id, 'b'); assert.equal(pres.rows[0].votes, 2);
  assert.equal(pres.winner.cand.id, 'b'); assert.equal(pres.need, 2); assert.ok(pres.rows[0].meetsSpread);
  assert.equal(G.race('nope', runs, parties, votes, WK), null);
  assert.equal(G.race('sen', [doc('a', { office: 'sen', party: 'epp', motto: 1, at: TUE })], parties, [], WK).winner, null, 'no votes, no senator');
});
