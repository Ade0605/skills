#!/usr/bin/env node
'use strict';
// Lasgidi shop server for the self-hosted PWA: serves the game, sells cosmetics through Flutterwave and PayPal,
// and unlocks an item only after the provider confirms the payment server-side. No dependencies.
// Settings come from environment variables (see README); keys never go in the code. Sandbox is the default.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { COSMETICS } = require('./catalog');

const ACCOUNT = /^[a-z0-9]{16,40}$/; // a random shop key the game makes on the device (not a password, never typed)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon' };

function config(env) {
  env = env || process.env;
  const live = env.SHOP_MODE === 'live';
  return {
    port: +env.PORT || 8080,
    publicUrl: (env.PUBLIC_URL || 'http://localhost:' + (+env.PORT || 8080)).replace(/\/$/, ''),
    dataDir: env.DATA_DIR || path.join(__dirname, 'data'),
    root: path.join(__dirname, '..'),
    live,
    adminToken: env.SHOP_ADMIN_TOKEN || '',
    flw: env.FLW_SECRET_KEY ? { key: env.FLW_SECRET_KEY, hash: env.FLW_SECRET_HASH || '', receipt: env.FLW_RECEIPT_EMAIL || '', api: env.FLW_API || 'https://api.flutterwave.com/v3' } : null,
    paypal: env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET ? { id: env.PAYPAL_CLIENT_ID, secret: env.PAYPAL_SECRET, api: env.PAYPAL_API || (live ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com') } : null
  };
}

// A tiny JSON store: pending orders and granted items, written atomically.
function store(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'shop.json');
  let db = { orders: {}, grants: {} };
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  const save = () => { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, file); };
  return {
    order: ref => db.orders[ref] || null,
    addOrder: o => { db.orders[o.ref] = o; save(); },
    owned: acc => db.grants[acc] || [],
    // Idempotent: the same payment reference never grants twice.
    grant: (ref, providerId) => {
      const o = db.orders[ref]; if (!o || o.status === 'paid') return false;
      o.status = 'paid'; o.providerId = String(providerId || ''); o.paidAt = new Date().toISOString();
      (db.grants[o.account] = db.grants[o.account] || []).push({ item: o.item, ref: o.ref, provider: o.provider, amount: o.amount, currency: o.currency, at: o.paidAt });
      save(); return true;
    },
    // Owner restore: move a paid order's item to a new shop key (the old key loses it, so items can't be shared).
    restore: (ref, acc) => {
      const o = db.orders[ref]; if (!o || o.status !== 'paid') return 'No paid order with that receipt';
      if (o.account === acc) return 'That key already has it';
      const old = db.grants[o.account] || [], g = old.filter(x => x.ref === ref)[0]; if (!g) return 'No grant for that receipt';
      if ((db.grants[acc] || []).some(x => x.item === o.item)) return 'That key already owns this item';
      db.grants[o.account] = old.filter(x => x.ref !== ref);
      (db.grants[acc] = db.grants[acc] || []).push(Object.assign({}, g, { restored: new Date().toISOString() }));
      o.restoredFrom = (o.restoredFrom || []).concat(o.account); o.account = acc; save(); return '';
    }
  };
}

function send(res, code, body, headers) {
  const isStr = typeof body === 'string';
  res.writeHead(code, Object.assign({ 'Content-Type': isStr ? 'text/plain; charset=utf-8' : 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, headers || {}));
  res.end(isStr ? body : JSON.stringify(body));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > (limit || 64 * 1024)) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function same(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }

function createApp(cfg, fetchImpl) {
  const f = fetchImpl || fetch, db = store(cfg.dataDir);
  const providers = { flutterwave: !!cfg.flw, paypal: !!cfg.paypal };

  async function paypalToken() {
    const r = await f(cfg.paypal.api + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(cfg.paypal.id + ':' + cfg.paypal.secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    const j = await r.json(); if (!r.ok || !j.access_token) throw new Error('PayPal sign-in failed'); return j.access_token;
  }

  async function checkout(body) {
    const item = COSMETICS[body.item];
    if (!item) return [400, { error: 'No such item' }];
    if (!ACCOUNT.test(body.account || '')) return [400, { error: 'Bad shop key' }];
    if (body.adult !== true) return [400, { error: 'Purchases are for players aged 18 or over' }];
    if (db.owned(body.account).some(g => g.item === body.item)) return [409, { error: 'You already own this' }];
    const ref = 'lsg_' + crypto.randomBytes(12).toString('hex');
    if (body.provider === 'flutterwave' && cfg.flw) {
      if (!cfg.flw.receipt) return [503, { error: 'The shop owner has not set a receipts address' }];
      const o = { ref, account: body.account, item: body.item, provider: 'flutterwave', amount: item.ngn, currency: 'NGN', status: 'pending', created: new Date().toISOString() };
      const r = await f(cfg.flw.api + '/payments', { method: 'POST', headers: { Authorization: 'Bearer ' + cfg.flw.key, 'Content-Type': 'application/json' }, body: JSON.stringify({
        tx_ref: ref, amount: String(item.ngn), currency: 'NGN', redirect_url: cfg.publicUrl + '/api/flutterwave/return',
        // The game never asks players for an email; Flutterwave needs one, so the shop owner's receipts address is used.
        customer: { email: cfg.flw.receipt, name: 'Lasgidi player' }, customizations: { title: 'Lasgidi', description: item.name } }) });
      const j = await r.json();
      if (!r.ok || !j.data || !j.data.link) return [502, { error: 'Flutterwave did not start the payment' }];
      db.addOrder(o); return [200, { url: j.data.link, ref }];
    }
    if (body.provider === 'paypal' && cfg.paypal) {
      const o = { ref, account: body.account, item: body.item, provider: 'paypal', amount: item.usd, currency: 'USD', status: 'pending', created: new Date().toISOString() };
      const tok = await paypalToken();
      const r = await f(cfg.paypal.api + '/v2/checkout/orders', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({
        intent: 'CAPTURE', purchase_units: [{ reference_id: ref, custom_id: ref, description: item.name, amount: { currency_code: 'USD', value: item.usd } }],
        application_context: { brand_name: 'Lasgidi', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', return_url: cfg.publicUrl + '/api/paypal/return?ref=' + ref, cancel_url: cfg.publicUrl + '/?shop=cancel' } }) });
      const j = await r.json();
      const link = j && j.links && j.links.filter(l => l.rel === 'approve' || l.rel === 'payer-action')[0];
      if (!r.ok || !link) return [502, { error: 'PayPal did not start the payment' }];
      o.providerOrder = j.id; db.addOrder(o); return [200, { url: link.href, ref }];
    }
    return [400, { error: 'That payment method is not set up' }];
  }

  // Flutterwave: never trust the redirect or the webhook body; ask Flutterwave about the transaction.
  async function flwVerify(id) {
    if (!/^\d{1,20}$/.test(String(id || ''))) return false;
    const r = await f(cfg.flw.api + '/transactions/' + id + '/verify', { headers: { Authorization: 'Bearer ' + cfg.flw.key } });
    const j = await r.json(); const d = j && j.data;
    if (!r.ok || !d || d.status !== 'successful') return false;
    const o = db.order(d.tx_ref); if (!o || o.provider !== 'flutterwave') return false;
    if (d.currency !== o.currency || Number(d.amount) < Number(o.amount)) return false;
    db.grant(o.ref, d.id); return o.ref;
  }
  async function paypalCapture(ref, token) {
    const o = db.order(ref); if (!o || o.provider !== 'paypal' || o.providerOrder !== token) return false;
    if (o.status === 'paid') return ref;
    const tok = await paypalToken();
    const r = await f(cfg.paypal.api + '/v2/checkout/orders/' + encodeURIComponent(token) + '/capture', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' } });
    const j = await r.json();
    const cap = j && j.purchase_units && j.purchase_units[0] && j.purchase_units[0].payments && j.purchase_units[0].payments.captures && j.purchase_units[0].payments.captures[0];
    if (!r.ok || j.status !== 'COMPLETED' || !cap || cap.status !== 'COMPLETED') return false;
    if (cap.amount.currency_code !== o.currency || cap.amount.value !== o.amount) return false;
    db.grant(ref, cap.id); return ref;
  }

  function serveStatic(req, res, url) {
    let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
    if (p === '/terms.html') return fs.createReadStream(path.join(__dirname, 'terms.html')).on('open', () => res.writeHead(200, { 'Content-Type': TYPES['.html'] })).pipe(res);
    const file = path.normalize(path.join(cfg.root, p));
    if (!file.startsWith(cfg.root + path.sep) || file.includes(path.sep + 'server' + path.sep) || file.includes(path.sep + 'node_modules' + path.sep) || /(^|[\\/])\./.test(path.relative(cfg.root, file))) return send(res, 404, 'Not found');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return send(res, 404, 'Not found');
      if (file === path.join(cfg.root, 'index.html')) { // tell the game a shop server is here
        const html = fs.readFileSync(file, 'utf8').replace('<head>', '<head>\n<meta name="lasgidi-shop" content="1">');
        res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); return res.end(html);
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
      fs.createReadStream(file).pipe(res);
    });
  }

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname === '/api/shop' && req.method === 'GET') return send(res, 200, { catalog: COSMETICS, providers, mode: cfg.live ? 'live' : 'sandbox', terms: '/terms.html' });
      if (url.pathname === '/api/owned' && req.method === 'GET') {
        const acc = url.searchParams.get('account') || ''; if (!ACCOUNT.test(acc)) return send(res, 400, { error: 'Bad shop key' });
        return send(res, 200, { items: db.owned(acc) });
      }
      if (url.pathname === '/api/checkout' && req.method === 'POST') {
        let body; try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
        const [code, out] = await checkout(body || {}); return send(res, code, out);
      }
      if (url.pathname === '/api/flutterwave/return' && cfg.flw) {
        const ok = url.searchParams.get('status') === 'successful' || url.searchParams.get('status') === 'completed' ? await flwVerify(url.searchParams.get('transaction_id')) : false;
        return send(res, 302, '', { Location: '/?shop=' + (ok ? 'ok&ref=' + ok : 'fail') });
      }
      if (url.pathname === '/api/flutterwave/webhook' && req.method === 'POST' && cfg.flw) {
        if (!cfg.flw.hash || !same(req.headers['verif-hash'] || '', cfg.flw.hash)) return send(res, 401, { error: 'Bad signature' });
        let ev; try { ev = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
        await flwVerify(ev && ev.data && ev.data.id); return send(res, 200, { ok: true });
      }
      if (url.pathname === '/api/paypal/return' && cfg.paypal) {
        const ok = await paypalCapture(url.searchParams.get('ref') || '', url.searchParams.get('token') || '');
        return send(res, 302, '', { Location: '/?shop=' + (ok ? 'ok&ref=' + ok : 'fail') });
      }
      if (url.pathname === '/api/admin/restore' && req.method === 'POST') {
        // Owner only: from this machine, with the admin token. No token set means no admin endpoint at all.
        const local = /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '');
        if (!cfg.adminToken || !local) return send(res, 404, { error: 'Not found' });
        if (!same(req.headers['x-admin-token'] || '', cfg.adminToken)) return send(res, 401, { error: 'Bad token' });
        let b; try { b = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
        if (!/^lsg_[0-9a-f]{24}$/.test(b.ref || '') || !ACCOUNT.test(b.account || '')) return send(res, 400, { error: 'Give a receipt (lsg_…) and a shop key' });
        const err = db.restore(b.ref, b.account); return send(res, err ? 409 : 200, err ? { error: err } : { ok: true });
      }
      if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
      return serveStatic(req, res, url);
    } catch (e) {
      console.error('shop error:', e && e.message); // never log keys or request bodies
      return send(res, 500, { error: 'Something went wrong' });
    }
  };
}

if (require.main === module) {
  const cfg = config();
  const app = createApp(cfg);
  http.createServer(app).listen(cfg.port, () => console.log('Lasgidi on ' + cfg.publicUrl + ' (' + (cfg.live ? 'LIVE payments' : 'sandbox') + '; Flutterwave ' + (cfg.flw ? 'on' : 'off') + ', PayPal ' + (cfg.paypal ? 'on' : 'off') + ')'));
}
module.exports = { createApp, config, COSMETICS };
