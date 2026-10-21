'use strict';
// The own-site online shim (src/claude-shim.js) against an in-memory fake of the Supabase client that applies the same
// rules as supabase/schema.sql (which is tested for real in Postgres separately): own docs only, editor-only collections,
// database-set message senders, live snapshots.
const test = require('node:test');
const assert = require('node:assert/strict');
const { make } = require('../src/claude-shim.js');

const ADMIN_ONLY = ['sponsored', 'adimg', 'seaimg', 'photo'], REVIEW = ['adreview', 'seareview', 'photoreview'];
function world() {
  const W = { docs: new Map(), profiles: new Map(), msgs: [], admins: new Set(['admin']), subs: [], clock: 0, presence: new Map(), roomSubs: [] };
  W.notify = (table, ev, row, old) => W.subs.filter(s => s.table === table).forEach(s => { if (s.match(row || old)) s.fn({ eventType: ev, new: row, old }); });
  return W;
}
function client(W, uid) {
  const can = {
    readDoc: r => r.coll === 'reports' ? W.admins.has(uid) : REVIEW.includes(r.coll) ? r.owner === uid || W.admins.has(uid) : true,
    writeDoc: (path, coll, existing) => {
      if (ADMIN_ONLY.includes(coll)) return W.admins.has(uid);
      if (existing && REVIEW.includes(coll) && W.admins.has(uid)) return true;
      return path.split('/')[1] === uid && (!existing || existing.owner === uid);
    }
  };
  function q(table) {
    const st = { table, filters: [], lim: 1e9 };
    const run = () => {
      let rows = table === 'docs' ? [...W.docs.values()].filter(can.readDoc) : table === 'profiles' ? [...W.profiles.values()] : table === 'admins' ? [...W.admins].filter(a => a === uid).map(id => ({ id })) : W.msgs;
      for (const [k, v, op] of st.filters) rows = rows.filter(r => { const val = k.startsWith('data->>') ? String((r.data || {})[k.slice(7)]) : r[k]; return op === 'in' ? v.includes(val) : String(val) === String(v); });
      if (st.order) rows = rows.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      return rows.slice(0, st.lim);
    };
    const api = {
      select() { return api; }, eq(k, v) { st.filters.push([k, v]); return api; }, in(k, v) { st.filters.push([k, v, 'in']); return api; },
      order() { st.order = true; return api; }, limit(n) { st.lim = n; return api; },
      maybeSingle() { return Promise.resolve({ data: run()[0] || null, error: null }); },
      then(res, rej) { return Promise.resolve({ data: run(), error: null }).then(res, rej); },
      upsert(row) {
        if (table === 'profiles') { if (row.id !== uid) return Promise.resolve({ error: { message: 'rls' } }); W.profiles.set(uid, { id: uid, name: row.name }); return Promise.resolve({ error: null }); }
        const ex = W.docs.get(row.path);
        if (!can.writeDoc(row.path, row.coll, ex && !ADMIN_ONLY.includes(row.coll) ? ex : null) || (ex && ex.owner !== uid && !ADMIN_ONLY.includes(row.coll))) return Promise.resolve({ error: { message: 'new row violates row-level security policy' } });
        const r = { path: row.path, coll: row.coll, owner: ex ? ex.owner : uid, data: row.data, updated_at: String(++W.clock).padStart(8, '0') };
        W.docs.set(row.path, r); W.notify('docs', ex ? 'UPDATE' : 'INSERT', r); return Promise.resolve({ error: null });
      },
      update(patch) {
        return { eq: (k, path) => ({ select: () => { const ex = W.docs.get(path); if (!ex || !can.writeDoc(path, ex.coll, ex)) return Promise.resolve({ data: [], error: null }); const r = Object.assign({}, ex, patch, { updated_at: String(++W.clock).padStart(8, '0') }); W.docs.set(path, r); W.notify('docs', 'UPDATE', r); return Promise.resolve({ data: [{ path }], error: null }); } }) };
      },
      insert(row) { const r = Object.assign({}, row, { sender: uid, id: W.msgs.length + 1 }); W.msgs.push(r); W.notify('msgs', 'INSERT', r); return Promise.resolve({ error: null }); }
    };
    return api;
  }
  const sb = {
    from: q,
    channel(name, opts) {
      const ch = { name, handlers: [], key: opts && opts.config && opts.config.presence && opts.config.presence.key };
      ch.on = (kind, filt, fn) => {
        if (kind === 'postgres_changes') {
          const [col, val] = (filt.filter || '').replace('=eq.', '\u0000').split('\u0000');
          W.subs.push({ table: filt.table, fn, match: r => (!col || String(r[col]) === val) && (filt.table !== 'docs' || can.readDoc(r)) && (filt.table !== 'msgs' || r.topic !== 'chat' || r.sender === uid || r.recipient === uid) });
        } else if (kind === 'presence') ch.sync = fn;
        return ch;
      };
      ch.subscribe = cb => { if (ch.sync) W.roomSubs.push(ch); if (cb) setTimeout(() => cb('SUBSCRIBED'), 0); return ch; };
      ch.track = p => { W.presence.set(ch.key, Object.assign({ presence_ref: 'x' }, p)); W.roomSubs.forEach(c => c.sync && c.sync()); return Promise.resolve('ok'); };
      ch.presenceState = () => { const o = {}; for (const [k, v] of W.presence) o[k] = [v]; return o; };
      return ch;
    },
    removeChannel() {}
  };
  return make(() => Promise.resolve({ sb, uid }));
}
const tick = () => new Promise(r => setTimeout(r, 5));

test('shim: your own docs only; editor-only collections; live collection snapshots and the where filter', async () => {
  const W = world(), a = client(W, 'alice'), b = client(W, 'bob'), adm = client(W, 'admin');
  const dbA = await a.use('db'), dbB = await b.use('db'), dbAd = await adm.use('db');
  assert.equal(await a.use('downloads'), null);
  let seen = null; const stop = dbB.collection('homes').limit(50).onSnapshot(s => { seen = s; });
  await dbA.doc('homes/alice').set({ home: 'mushin_room' }); await tick();
  assert.equal(seen.docs.length, 1); assert.equal(seen.docs[0].id, 'alice'); assert.equal(seen.docs[0].data().home, 'mushin_room');
  await assert.rejects(dbB.doc('homes/alice').set({ home: 'stolen' }), e => e.code === 'invalid_argument');
  await assert.rejects(dbA.doc('sponsored/p1').set({ x: 1 }), e => e.code === 'invalid_argument');
  await dbAd.doc('sponsored/p1').set({ x: 1 });
  await dbA.doc('fame/alice/proof/log').set({ log: [1, 2] });
  await assert.rejects(dbB.doc('fame/alice/proof/log').set({ log: [] }), e => e.code === 'invalid_argument');
  assert.deepEqual((await dbB.doc('fame/alice/proof/log').get()).data().log, [1, 2]);
  let famelist = null; dbB.collection('fame').limit(10).onSnapshot(s => { famelist = s; }); await tick();
  assert.equal(famelist.docs.length, 0, 'proof logs are not listed as fame entries');
  await dbA.doc('weekly/alice').set({ challenge: 'w1' }); await dbB.doc('weekly/bob').set({ challenge: 'w2' });
  let wk = null; dbB.collection('weekly').where('challenge', '==', 'w1').limit(500).onSnapshot(s => { wk = s; }); await tick();
  assert.deepEqual(wk.docs.map(d => d.id), ['alice']);
  stop();
});

test('shim: reviews are private, an editor approves without taking the doc over; reports are editor-only', async () => {
  const W = world(), a = client(W, 'alice'), b = client(W, 'bob'), adm = client(W, 'admin');
  const dbA = await a.use('db'), dbB = await b.use('db'), dbAd = await adm.use('db');
  await dbA.doc('adreview/alice').set({ status: 'pending', img: 'x' });
  assert.equal((await dbB.doc('adreview/alice').get()).exists, false);
  await assert.rejects(dbB.doc('adreview/alice').update({ status: 'ok' }), e => e.code === 'invalid_argument');
  await dbAd.doc('adreview/alice').update({ status: 'ok' });
  const r = await dbA.doc('adreview/alice').get(); assert.equal(r.data().status, 'ok'); assert.equal(r.data().img, 'x'); assert.equal(W.docs.get('adreview/alice').owner, 'alice');
  await dbB.doc('reports/bob').set({ who: 'alice', reason: 'spam' });
  let rep = null; dbA.collection('reports').limit(200).onSnapshot(s => { rep = s; }); await tick(); assert.equal(rep.docs.length, 0);
  assert.equal(await (await adm.use('user')).canEdit(), true); assert.equal(await (await a.use('user')).canEdit(), false);
});

test('shim: presence lists peers; messages carry the real sender; direct chat only reaches its recipient', async () => {
  const W = world(), a = client(W, '11111111-1111-1111-1111-111111111111'), b = client(W, '22222222-2222-2222-2222-222222222222'), c = client(W, '33333333-3333-3333-3333-333333333333');
  const ra = await a.use('room'), rb = await b.use('room'), rc = await c.use('room');
  let peers = null; rb.onPeers(ch => { peers = ch.peers; });
  await ra.presence({ d: 'mushin' }); await rb.presence({ d: 'yaba' }); await tick();
  const meA = peers.find(p => p.by.startsWith('1111')), meB = peers.find(p => p.isMe);
  assert.equal(meA.presence.d, 'mushin'); assert.equal(meA.kind, 'viewer'); assert.ok(!('presence_ref' in meA.presence)); assert.ok(meB);
  const gotB = [], gotC = []; rb.on('chat', m => gotB.push(m)); rc.on('chat', m => gotC.push(m)); await tick();
  await ra.emit('chat', { to: '22222222-2222-2222-2222-222222222222', text: 'how far' }); await tick();
  assert.equal(gotB.length, 1); assert.equal(gotB[0].by, '11111111-1111-1111-1111-111111111111'); assert.equal(gotB[0].data.text, 'how far');
  assert.equal(gotC.length, 0, 'a third player does not see a direct chat');
  const u = await a.use('user'); await u.setName('Alice'); const ps = await (await b.use('user')).profiles(['11111111-1111-1111-1111-111111111111', 'nope']);
  assert.equal(ps['11111111-1111-1111-1111-111111111111'].name, 'Alice');
});
