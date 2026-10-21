#!/usr/bin/env node
'use strict';
// Lasgidi shop server for the self-hosted PWA: serves the game, sells cosmetics through Flutterwave and PayPal,
// and unlocks an item only after the provider confirms the payment server-side. No dependencies.
// Settings come from environment variables (see README); keys never go in the code. Sandbox is the default.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { COSMETICS, KINDS, TOPUPS } = require('./catalog');

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
    rateLimit: +env.SHOP_RATE_LIMIT || 30,
    trustProxy: env.SHOP_TRUST_PROXY === '1',
    flw: env.FLW_SECRET_KEY ? { key: env.FLW_SECRET_KEY, hash: env.FLW_SECRET_HASH || '', receipt: env.FLW_RECEIPT_EMAIL || '', api: env.FLW_API || 'https://api.flutterwave.com/v3' } : null,
    paypal: env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET ? { id: env.PAYPAL_CLIENT_ID, secret: env.PAYPAL_SECRET, api: env.PAYPAL_API || (live ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com') } : null
  };
}

// A tiny JSON store: pending orders and granted items, written atomically.
function store(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'shop.json');
  let db = { orders: {}, grants: {} };
  if (fs.existsSync(file)) {
    // A damaged file must never be replaced by an empty store: that would wipe everyone's purchases.
    try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error('shop.json is damaged; restore it from a backup before starting the shop (' + e.message + ')'); }
  }
  const save = () => {
    const tmp = file + '.tmp', fd = fs.openSync(tmp, 'w');
    try { fs.writeSync(fd, JSON.stringify(db)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, file);
  };
  return {
    order: ref => db.orders[ref] || null,
    addOrder: o => { Object.keys(db.orders).forEach(k => { const x = db.orders[k]; if (x.status === 'pending' && Date.now() - Date.parse(x.created) > 7 * 86400000) delete db.orders[k]; }); db.orders[o.ref] = o; save(); }, // week-old unpaid orders are dropped
    pendingItem: (acc, item) => Object.keys(db.orders).some(k => { const o = db.orders[k]; return o.account === acc && o.item === item && o.status === 'pending' && Date.now() - Date.parse(o.created) < 86400000; }),
    pendingAll: () => Object.keys(db.orders).filter(k => db.orders[k].status === 'pending' && Date.now() - Date.parse(db.orders[k].created) < 86400000).length,
    pendingFor: acc => Object.keys(db.orders).filter(k => db.orders[k].account === acc && db.orders[k].status === 'pending' && Date.now() - Date.parse(db.orders[k].created) < 86400000).length,
    owned: acc => db.grants[acc] || [],
    // Idempotent: the same payment reference never grants twice.
    grant: (ref, providerId) => {
      const o = db.orders[ref]; if (!o || o.status === 'paid') return false;
      o.status = 'paid'; o.providerId = String(providerId || ''); o.paidAt = new Date().toISOString();
      (db.grants[o.account] = db.grants[o.account] || []).push({ item: o.item, ref: o.ref, provider: o.provider, amount: o.amount, currency: o.currency, at: o.paidAt });
      save(); return true;
    },
    // A wallet top-up is credited to one life only: the first life that claims its receipt keeps it.
    claim: (acc, ref, life) => {
      const g = (db.grants[acc] || []).filter(x => x.ref === ref)[0]; if (!g) return 'none';
      if (!/^topup_/.test(g.item)) return 'notopup';
      if (g.life && g.life !== life) return 'used';
      if (!g.life) { g.life = life; save(); }
      return 'ok';
    },
    // Owner restore: move a paid order's item to a new shop key (the old key loses it, so items can't be shared).
    restore: (ref, acc) => {
      const o = db.orders[ref]; if (!o || o.status !== 'paid') return 'No paid order with that receipt';
      if (o.account === acc) return 'That key already has it';
      const old = db.grants[o.account] || [], g = old.filter(x => x.ref === ref)[0]; if (!g) return 'No grant for that receipt';
      if (!/^topup_/.test(o.item) && (db.grants[acc] || []).some(x => x.item === o.item)) return 'That key already owns this item';
      db.grants[o.account] = old.filter(x => x.ref !== ref);
      (db.grants[acc] = db.grants[acc] || []).push(Object.assign({}, g, { restored: new Date().toISOString() }));
      o.restoredFrom = (o.restoredFrom || []).concat(o.account); o.account = acc; save(); return '';
    }
  };
}

function send(res, code, body, headers) {
  const isStr = typeof body === 'string';
  res.writeHead(code, Object.assign({ 'Content-Type': isStr ? 'text/plain; charset=utf-8' : 'application/json', 'Cache-Control': 'no-store' }, SEC, headers || {}));
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
// Security headers for every page the shop serves.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const SEC = { 'Content-Security-Policy': CSP, 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'X-Content-Type-Options': 'nosniff' };
// A small per-IP rate limit for /api/: 30 requests a minute, refilled continuously.
function limiter(rate, per) {
  const bucket = new Map();
  return ip => {
    const now = Date.now(), b = bucket.get(ip) || { t: now, n: rate };
    b.n = Math.min(rate, b.n + (now - b.t) * rate / per); b.t = now;
    if (bucket.size > 5000) { const old = bucket.keys().next().value; bucket.delete(old); } // drop the oldest, never everyone's limit
    if (b.n < 1) { bucket.set(ip, b); return false; }
    b.n -= 1; bucket.set(ip, b); return true;
  };
}
function same(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }

function createApp(cfg, fetchImpl) {
  const inflight = new Map();
  const f0 = fetchImpl || fetch, db = store(cfg.dataDir);
  // Provider calls give up after 15 seconds instead of hanging a request.
  const f = (u, o) => f0(u, Object.assign({}, o, typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(15000) } : {}));
  const providers = { flutterwave: !!cfg.flw, paypal: !!cfg.paypal };

  async function paypalToken() {
    const r = await f(cfg.paypal.api + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(cfg.paypal.id + ':' + cfg.paypal.secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    const j = await r.json(); if (!r.ok || !j.access_token) throw new Error('PayPal sign-in failed'); return j.access_token;
  }

  async function checkout(body) {
    const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
    const item = has(COSMETICS, body.item) ? COSMETICS[body.item] : has(TOPUPS, body.item) ? TOPUPS[body.item] : null;
    if (!item) return [400, { error: 'No such item' }];
    if (typeof body.account !== 'string') return [400, { error: 'Bad shop key' }];
    if (!ACCOUNT.test(body.account || '')) return [400, { error: 'Bad shop key' }];
    if (body.adult !== true) return [400, { error: 'Purchases are for players aged 18 or over' }];
    if (!TOPUPS[body.item] && db.owned(body.account).some(g => g.item === body.item)) return [409, { error: 'You already own this' }]; // top-ups can be bought again
    if (db.pendingFor(body.account) >= 5) return [429, { error: 'Too many unfinished payments. Finish or wait a day.' }];
    if (!TOPUPS[body.item] && db.pendingItem(body.account, body.item)) return [409, { error: 'You already started paying for this. Finish that payment, or wait a day.' }];
    if (db.pendingAll() >= 2000) return [503, { error: 'The shop is busy. Try again later.' }];
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
    if (!/^lsg_[0-9a-f]{24}$/.test(String(d.tx_ref || ''))) return false;
    const o = db.order(d.tx_ref); if (!o || o.provider !== 'flutterwave') return false;
    if (d.currency !== o.currency || !(Number(d.amount) >= Number(o.amount))) return false; // NaN never passes
    db.grant(o.ref, d.id); return o.ref;
  }
  async function paypalCapture(ref, token) {
    if (!/^[A-Z0-9-]{5,40}$/.test(token)) return false;
    const o = db.order(ref); if (!o || o.provider !== 'paypal' || o.providerOrder !== token) return false;
    if (o.status === 'paid') return ref;
    if (inflight.has(ref)) return inflight.get(ref); // a second return while the first is capturing waits for it
    const job = (async () => {
      const tok = await paypalToken();
      const firstCap = j => j && j.purchase_units && j.purchase_units[0] && j.purchase_units[0].payments && j.purchase_units[0].payments.captures && j.purchase_units[0].payments.captures[0];
      let j = null, okr = false;
      try { const r = await f(cfg.paypal.api + '/v2/checkout/orders/' + encodeURIComponent(token) + '/capture', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' } }); okr = r.ok; j = await r.json(); } catch (e) { j = null; }
      // If the capture failed or its answer was lost (it may already have been captured), ask PayPal for the order itself.
      if (!okr || !j || j.status !== 'COMPLETED') { const r2 = await f(cfg.paypal.api + '/v2/checkout/orders/' + encodeURIComponent(token), { headers: { Authorization: 'Bearer ' + tok } }); j = r2.ok ? await r2.json() : null; }
      const cap = firstCap(j);
      if (!j || j.status !== 'COMPLETED' || !cap || cap.status !== 'COMPLETED') return false;
      if (cap.amount.currency_code !== o.currency || cap.amount.value !== o.amount) return false;
      db.grant(ref, cap.id); return ref;
    })();
    inflight.set(ref, job);
    try { return await job; } finally { inflight.delete(ref); }
  }

  function serveStatic(req, res, url) {
    let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
    if (p === '/terms.html') return fs.createReadStream(path.join(__dirname, 'terms.html')).on('open', () => res.writeHead(200, Object.assign({ 'Content-Type': TYPES['.html'] }, SEC))).pipe(res);
    const file = path.normalize(path.join(cfg.root, p));
    const dataDir = path.resolve(cfg.dataDir || '');
    if (file === dataDir || file.startsWith(dataDir + path.sep)) return send(res, 404, 'Not found'); // shop.json holds every key
    if (!file.startsWith(cfg.root + path.sep) || file.includes(path.sep + 'server' + path.sep) || file.includes(path.sep + 'node_modules' + path.sep) || /(^|[\\/])\./.test(path.relative(cfg.root, file))) return send(res, 404, 'Not found');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return send(res, 404, 'Not found');
      if (file === path.join(cfg.root, 'index.html')) { // tell the game a shop server is here
        const html = fs.readFileSync(file, 'utf8').replace('<head>', '<head>\n<meta name="lasgidi-shop" content="1">');
        res.writeHead(200, Object.assign({ 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' }, SEC)); return res.end(html);
      }
      res.writeHead(200, Object.assign({ 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }, SEC));
      fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    });
  }

  const allow = limiter(cfg.rateLimit || 30, 60000);
  return async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname.startsWith('/api/')) {
        // Behind a trusted proxy (SHOP_TRUST_PROXY=1), limit by the client address it forwards; otherwise by the socket.
        const ip = cfg.trustProxy && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',').pop().trim() : (req.socket.remoteAddress || '');
        if (!allow(ip)) return send(res, 429, { error: 'Slow down' });
        if (req.method === 'POST' && !/^application\/json\b/.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Send JSON' });
      }
      if (url.pathname === '/api/shop' && req.method === 'GET') return send(res, 200, { catalog: Object.assign({}, COSMETICS, TOPUPS), kinds: KINDS, providers, mode: cfg.live ? 'live' : 'sandbox', terms: '/terms.html' });
      if (url.pathname === '/api/owned' && req.method === 'GET') {
        const acc = url.searchParams.get('account') || ''; if (!ACCOUNT.test(acc)) return send(res, 400, { error: 'Bad shop key' });
        return send(res, 200, { items: db.owned(acc) });
      }
      if (url.pathname === '/api/claim' && req.method === 'POST') {
        let body; try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
        const acc = body && body.account, ref = body && body.ref, life = body && body.life;
        if (typeof acc !== 'string' || !ACCOUNT.test(acc) || typeof ref !== 'string' || ref.length > 80 || typeof life !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(life)) return send(res, 400, { error: 'Bad request' });
        const r = db.claim(acc, ref, life);
        return r === 'ok' ? send(res, 200, { ok: true }) : send(res, r === 'used' ? 409 : 404, { error: r === 'used' ? 'That top-up went to another life' : 'No top-up with that receipt' });
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
        // Behind a reverse proxy every request looks local, so anything a proxy forwarded is refused.
        const proxied = req.headers['x-forwarded-for'] || req.headers.forwarded || req.headers['x-real-ip'] || req.headers['x-forwarded-host'];
        const local = !proxied && /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '');
        if (!cfg.adminToken || !local) return send(res, 404, { error: 'Not found' });
        if (!same(req.headers['x-admin-token'] || '', cfg.adminToken)) return send(res, 401, { error: 'Bad token' });
        let b; try { b = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
        if (!b || typeof b !== 'object' || typeof b.account !== 'string' || !/^lsg_[0-9a-f]{24}$/.test(b.ref || '') || !ACCOUNT.test(b.account || '')) return send(res, 400, { error: 'Give a receipt (lsg_…) and a shop key' });
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
