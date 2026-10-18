'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os'), fs = require('fs'), path = require('path'), http = require('http');
const { createApp, config } = require('../server/server.js');

// A fake provider API: records calls and answers like Flutterwave and PayPal do.
function fakeFetch(state) {
  return async function (url, opts) {
    state.calls.push([url, opts && opts.method]);
    const json = body => ({ ok: true, json: async () => body });
    if (url.endsWith('/payments')) { state.lastFlw = JSON.parse(opts.body); return json({ status: 'success', data: { link: 'https://checkout.flutterwave.test/pay/abc' } }); }
    if (url.includes('/transactions/') && url.endsWith('/verify')) return json({ status: 'success', data: Object.assign({ id: 555, status: 'successful', currency: 'NGN', amount: 1500, tx_ref: state.lastFlw && state.lastFlw.tx_ref }, state.flwOverride || {}) });
    if (url.endsWith('/v1/oauth2/token')) return json({ access_token: 'tok' });
    if (url.endsWith('/v2/checkout/orders')) return json({ id: 'PP-ORDER-1', links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.test/checkoutnow?token=PP-ORDER-1' }] });
    if (url.includes('/capture')) return json({ status: 'COMPLETED', purchase_units: [{ payments: { captures: [Object.assign({ id: 'CAP1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '1.99' } }, state.ppOverride || {})] } }] });
    return { ok: false, json: async () => ({}) };
  };
}
async function withServer(env, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsg-shop-'));
  const cfg = config(Object.assign({ DATA_DIR: dir, PUBLIC_URL: 'http://localhost' }, env));
  const state = { calls: [] }, srv = http.createServer(createApp(cfg, fakeFetch(state)));
  await new Promise(r => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const req = (p, o) => fetch(base + p, Object.assign({ redirect: 'manual' }, o || {}));
  try { await run(req, state); } finally { srv.close(); }
}
const KEYS = { FLW_SECRET_KEY: 'FLWSECK_TEST-x', FLW_SECRET_HASH: 'hush', FLW_RECEIPT_EMAIL: 'receipts@shop-owner.test', PAYPAL_CLIENT_ID: 'id', PAYPAL_SECRET: 'sec' };
const ACC = 'abcdefghij0123456789';
const post = (req, p, body, headers) => req(p, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: JSON.stringify(body) });

test('shop: lists cosmetics and the wallet top-ups, in sandbox by default, with no providers until keys are set', async () => {
  await withServer({}, async req => {
    const j = await (await req('/api/shop')).json();
    assert.equal(j.mode, 'sandbox'); assert.deepEqual(j.providers, { flutterwave: false, paypal: false });
    assert.deepEqual(Object.keys(j.kinds), ['tag', 'acc', 'paint']);
    const looks = ['shades', 'chain', 'cap', 'phones'];
    const D = require('../src/data.js');
    for (const [k, it] of Object.entries(j.catalog).filter(([, v]) => v.kind === 'topup')) {
      assert.ok(D.TOPUP_PACKS[k], k + ' is a known pack'); assert.equal(it.naira, D.TOPUP_PACKS[k].naira, k + ' credits what the engine credits');
    }
    for (const it of Object.values(j.catalog).filter(v => v.kind !== 'topup')) {
      assert.ok(j.kinds[it.kind], 'every item has a known kind');
      assert.ok(it.ngn >= 1500 && it.ngn <= 3000 && /^\d+\.\d\d$/.test(it.usd) && +it.usd <= 3.99, 'priced as a small cosmetic');
      assert.match(it.color, /^#[0-9a-f]{6}$/i);
      if (it.kind === 'acc') assert.ok(looks.includes(it.look), 'an accessory names a drawing the avatar knows');
      assert.deepEqual(Object.keys(it).filter(k => !['name', 'kind', 'look', 'color', 'ink', 'ngn', 'usd'].includes(k)), [], 'no field that could carry an advantage');
    }
    for (const k of ['tag', 'acc', 'paint', 'topup']) assert.ok(Object.values(j.catalog).some(it => it.kind === k));
    const r = await post(req, '/api/checkout', { account: ACC, item: 'tag_emerald', provider: 'paypal', adult: true });
    assert.equal(r.status, 400);
  });
});

test('shop: checkout refuses bad keys, unknown items and under-18s', async () => {
  await withServer(KEYS, async req => {
    assert.equal((await post(req, '/api/checkout', { account: 'short', item: 'tag_emerald', provider: 'paypal', adult: true })).status, 400);
    assert.equal((await post(req, '/api/checkout', { account: ACC, item: 'naira_1m', provider: 'paypal', adult: true })).status, 400);
    assert.equal((await post(req, '/api/checkout', { account: ACC, item: 'tag_emerald', provider: 'paypal' })).status, 400);
  });
});

test('shop: Flutterwave unlocks only after the server verifies the payment, once, and webhooks need the secret hash', async () => {
  await withServer(KEYS, async (req, st) => {
    const c = await (await post(req, '/api/checkout', { account: ACC, item: 'tag_emerald', provider: 'flutterwave', adult: true })).json();
    assert.match(c.url, /flutterwave/); assert.equal(st.lastFlw.customer.email, 'receipts@shop-owner.test'); assert.equal(st.lastFlw.amount, '1500');
    // Nothing owned yet: the redirect alone does not unlock anything without verification.
    assert.deepEqual((await (await req('/api/owned?account=' + ACC)).json()).items, []);
    // A webhook with the wrong hash is refused.
    assert.equal((await post(req, '/api/flutterwave/webhook', { data: { id: 555 } }, { 'verif-hash': 'nope' })).status, 401);
    // An underpaid transaction does not unlock.
    st.flwOverride = { amount: 100 };
    let r = await req('/api/flutterwave/return?status=successful&transaction_id=555');
    assert.match(r.headers.get('location'), /shop=fail/);
    st.flwOverride = null;
    r = await req('/api/flutterwave/return?status=successful&transaction_id=555');
    assert.match(r.headers.get('location'), /shop=ok/);
    assert.equal((await post(req, '/api/flutterwave/webhook', { data: { id: 555 } }, { 'verif-hash': 'hush' })).status, 200);
    const owned = (await (await req('/api/owned?account=' + ACC)).json()).items;
    assert.equal(owned.length, 1, 'webhook after redirect does not grant twice'); assert.equal(owned[0].item, 'tag_emerald'); assert.equal(owned[0].currency, 'NGN');
    assert.equal((await post(req, '/api/checkout', { account: ACC, item: 'tag_emerald', provider: 'flutterwave', adult: true })).status, 409);
  });
});

test('shop: PayPal unlocks only after a completed capture of the right amount', async () => {
  await withServer(KEYS, async (req, st) => {
    const c = await (await post(req, '/api/checkout', { account: ACC, item: 'tag_lagoon', provider: 'paypal', adult: true })).json();
    assert.match(c.url, /paypal/);
    assert.match((await req('/api/paypal/return?ref=' + c.ref + '&token=WRONG')).headers.get('location'), /shop=fail/);
    st.ppOverride = { amount: { currency_code: 'USD', value: '0.10' } };
    assert.match((await req('/api/paypal/return?ref=' + c.ref + '&token=PP-ORDER-1')).headers.get('location'), /shop=fail/);
    st.ppOverride = null;
    assert.match((await req('/api/paypal/return?ref=' + c.ref + '&token=PP-ORDER-1')).headers.get('location'), /shop=ok/);
    const owned = (await (await req('/api/owned?account=' + ACC)).json()).items;
    assert.equal(owned.length, 1); assert.equal(owned[0].currency, 'USD'); assert.equal(owned[0].amount, '1.99');
  });
});

test('shop: serves the game but never the server folder, data or dotfiles', async () => {
  await withServer({}, async req => {
    const idx = await req('/index.html'); assert.equal(idx.status, 200); assert.match(await idx.text(), /name="lasgidi-shop"/);
    assert.equal((await req('/terms.html')).status, 200);
    for (const p of ['/server/server.js', '/server/data/shop.json', '/%2e%2e/%2e%2e/etc/passwd', '/.git/config', '/node_modules/terser/package.json']) assert.equal((await req(p)).status, 404, p);
  });
});

test('shop: the owner can move a paid item to a new shop key, only from this machine with the admin token', async () => {
  const NEW = 'zzzzzzzzzz9876543210';
  await withServer(Object.assign({ SHOP_ADMIN_TOKEN: 'owner-secret' }, KEYS), async (req, st) => {
    const c = await (await post(req, '/api/checkout', { account: ACC, item: 'tag_night', provider: 'flutterwave', adult: true })).json();
    await req('/api/flutterwave/return?status=successful&transaction_id=555');
    const restore = (token, body) => post(req, '/api/admin/restore', body || { ref: c.ref, account: NEW }, token ? { 'x-admin-token': token } : {});
    assert.equal((await restore('')).status, 401);
    assert.equal((await restore('wrong')).status, 401);
    assert.equal((await restore('owner-secret', { ref: 'lsg_nope', account: NEW })).status, 400);
    assert.equal((await restore('owner-secret')).status, 200);
    const oldItems = (await (await req('/api/owned?account=' + ACC)).json()).items, newItems = (await (await req('/api/owned?account=' + NEW)).json()).items;
    assert.equal(oldItems.length, 0, 'the old key loses it, so items cannot be shared');
    assert.equal(newItems.length, 1); assert.equal(newItems[0].item, 'tag_night');
    assert.equal((await restore('owner-secret')).status, 409, 'restoring again to the same key does nothing');
  });
  // With no admin token configured there is no admin endpoint at all.
  await withServer(KEYS, async req => assert.equal((await post(req, '/api/admin/restore', { ref: 'x', account: NEW }, { 'x-admin-token': '' })).status, 404));
});

test('shop security: headers, JSON-only posts, rate limit, proxied admin calls and the pending-order cap', async () => {
  await withServer(Object.assign({ SHOP_ADMIN_TOKEN: 'owner-secret', SHOP_RATE_LIMIT: '200' }, KEYS), async req => {
    const page = await req('/index.html');
    assert.match(page.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
    assert.equal(page.headers.get('x-frame-options'), 'DENY');
    assert.equal((await req('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
    // Through a proxy, the admin endpoint is not there even with the right token.
    assert.equal((await post(req, '/api/admin/restore', { ref: 'lsg_' + '0'.repeat(24), account: ACC }, { 'x-admin-token': 'owner-secret', 'x-forwarded-for': '203.0.113.9' })).status, 404);
    // At most five unfinished payments per shop key.
    const items = ['tag_emerald', 'tag_lagoon', 'tag_ankara', 'tag_night', 'acc_shades', 'acc_chain'];
    const dup0 = await post(req, '/api/checkout', { account: ACC, item: 'tag_emerald', provider: 'flutterwave', adult: true });
    const dup = await post(req, '/api/checkout', { account: ACC, item: 'tag_emerald', provider: 'flutterwave', adult: true });
    assert.equal(dup.status, 409, 'no second payment for an item already being paid for');
    let last; for (let i = 1; i < 6; i++) last = await post(req, '/api/checkout', { account: ACC, item: items[i], provider: 'flutterwave', adult: true });
    assert.equal(last.status, 429);
    for (const bad of ['constructor', '__proto__', 'toString']) assert.equal((await post(req, '/api/checkout', { account: ACC + 'x', item: bad, provider: 'flutterwave', adult: true })).status, 400, bad + ' is not an item');
    assert.equal((await post(req, '/api/checkout', { account: [ACC], item: 'tag_lagoon', provider: 'flutterwave', adult: true })).status, 400, 'a shop key must be a string');
  });
  await withServer({ SHOP_RATE_LIMIT: '5' }, async req => {
    const codes = []; for (let i = 0; i < 8; i++) codes.push((await req('/api/shop')).status);
    assert.ok(codes.slice(0, 5).every(c => c === 200)); assert.equal(codes[7], 429);
  });
});

test('shop security: a damaged purchase file stops the shop instead of wiping purchases', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsg-shop-')); fs.writeFileSync(path.join(dir, 'shop.json'), '{"orders":');
  assert.throws(() => createApp(config({ DATA_DIR: dir })), /damaged/);
  assert.equal(fs.readFileSync(path.join(dir, 'shop.json'), 'utf8'), '{"orders":', 'the file is left as it was');
});
