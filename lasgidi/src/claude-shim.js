/* Lasgidi online off claude.ai: the same window.claude.use('db' | 'user' | 'room') surface the game already uses,
   backed by Supabase. Runs only when there is no real window.claude (so never on claude.ai) and a config is present
   (window.LASGIDI_ONLINE = { url, anon }, written by the Pages build). Sign-in is anonymous: one id per device.
   Permissions are enforced by the database (supabase/schema.sql); this file only maps the calls. */
(function (root) {
  'use strict';

  function denied(e) { var x = new Error((e && e.message) || 'Not allowed'); x.code = 'invalid_argument'; return x; }
  function docId(path) { return String(path).split('/')[1]; }
  function isTop(path) { return String(path).split('/').length === 2; }
  function snapDoc(row) { return { id: row ? docId(row.path) : null, exists: !!row, data: function () { return row ? row.data : undefined; } }; }
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // make(getClient) builds the namespaces; getClient() resolves { sb, uid }. Kept separate so tests can pass a fake client.
  function make(getClient) {
    var seq = 0, cache = {};

    function collection(name, lim, eq) {
      lim = lim || 100;
      return {
        limit: function (n) { return collection(name, Math.max(1, Math.min(1000, n | 0)), eq); },
        where: function (field, op, v) { if (op !== '==') throw new Error('Only == is supported'); return collection(name, lim, [field, v]); },
        onSnapshot: function (next, onErr) {
          var rows = {}, stopped = false, ch = null, sbRef = null;
          function emit() {
            if (stopped) return;
            var list = Object.keys(rows).map(function (k) { return rows[k]; }).sort(function (a, b) { return String(b.updated_at).localeCompare(String(a.updated_at)); }).slice(0, lim);
            next({ docs: list.map(snapDoc) });
          }
          function keep(r) { return r && isTop(r.path) && (!eq || String(r.data && r.data[eq[0]]) === String(eq[1])); }
          getClient().then(function (c) {
            if (stopped) return; sbRef = c.sb;
            var q = c.sb.from('docs').select('path,data,updated_at').eq('coll', name).order('updated_at', { ascending: false }).limit(lim * 2);
            if (eq) q = q.eq('data->>' + eq[0], String(eq[1]));
            q.then(function (res) {
              if (res.error) { if (onErr) onErr(res.error); return; }
              (res.data || []).forEach(function (r) { if (keep(r)) rows[r.path] = r; });
              emit();
            });
            ch = c.sb.channel('docs-' + name + '-' + (++seq)).on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'coll=eq.' + name }, function (p) {
              if (p.eventType === 'DELETE') { if (p.old && p.old.path) delete rows[p.old.path]; }
              else if (keep(p.new)) rows[p.new.path] = p.new;
              else if (p.new && rows[p.new.path]) delete rows[p.new.path];
              emit();
            }).subscribe();
          }, function (e) { if (onErr) onErr(e); });
          return function () { stopped = true; if (ch && sbRef) sbRef.removeChannel(ch); };
        }
      };
    }

    function doc(path) {
      var coll = String(path).split('/')[0];
      function read(c) { return c.sb.from('docs').select('path,data,updated_at').eq('path', path).maybeSingle().then(function (res) { if (res.error) throw res.error; return res.data || null; }); }
      return {
        get: function () { return getClient().then(function (c) { return read(c).then(snapDoc); }); },
        onSnapshot: function (next, onErr) {
          var stopped = false, ch = null, sbRef = null;
          getClient().then(function (c) {
            sbRef = c.sb;
            read(c).then(function (r) { if (!stopped) next(snapDoc(r)); }, function (e) { if (onErr) onErr(e); });
            ch = c.sb.channel('doc-' + (++seq)).on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'path=eq.' + path }, function (p) { if (!stopped) next(snapDoc(p.eventType === 'DELETE' ? null : p.new)); }).subscribe();
          }, function (e) { if (onErr) onErr(e); });
          return function () { stopped = true; if (ch && sbRef) sbRef.removeChannel(ch); };
        },
        // A full overwrite, like the artifact's set().
        set: function (obj) {
          return getClient().then(function (c) {
            return c.sb.from('docs').upsert({ path: path, coll: coll, data: obj }, { onConflict: 'path' }).then(function (res) { if (res.error) throw denied(res.error); });
          });
        },
        // Merge fields into an existing document (an editor approving a review, for example). Never creates one.
        update: function (obj) {
          return getClient().then(function (c) {
            return read(c).then(function (r) {
              if (!r) throw denied({ message: 'No such document' });
              var merged = Object.assign({}, r.data, obj);
              return c.sb.from('docs').update({ data: merged }).eq('path', path).select('path').then(function (res) { if (res.error || !res.data || !res.data.length) throw denied(res.error); });
            });
          });
        }
      };
    }

    var db = { collection: function (name) { return collection(name); }, doc: doc };

    var user = {
      id: function () { return getClient().then(function (c) { return c.uid; }); },
      canEdit: function () { return getClient().then(function (c) { return c.sb.from('admins').select('id').eq('id', c.uid).maybeSingle().then(function (r) { return !!(r && r.data); }, function () { return false; }); }); },
      can: function (what) { return getClient().then(function () { return what === 'data.write'; }, function () { return false; }); },
      profiles: function (ids) {
        var list = (ids || []).filter(function (x) { return typeof x === 'string' && UUID.test(x); }).slice(0, 200);
        if (!list.length) return Promise.resolve({});
        return getClient().then(function (c) {
          return c.sb.from('profiles').select('id,name').in('id', list).then(function (res) { var out = {}; (res.data || []).forEach(function (p) { out[p.id] = { name: String(p.name || '').slice(0, 24) }; }); return out; });
        });
      },
      // Off claude.ai there is no account name: the game's own (filtered) name is the profile name.
      setName: function (name) {
        name = String(name || '').trim().slice(0, 24); if (!name) return Promise.resolve();
        return getClient().then(function (c) { return c.sb.from('profiles').upsert({ id: c.uid, name: name }, { onConflict: 'id' }); });
      }
    };

    var room = (function () {
      var chP = null, peersFns = [], me = null, msgCh = {}, last = null;
      function channel() {
        if (chP) return chP;
        chP = getClient().then(function (c) {
          me = c.uid;
          var ch = c.sb.channel('lasgidi-room', { config: { presence: { key: c.uid } } });
          ch.on('presence', { event: 'sync' }, function () {
            var st = ch.presenceState(), peers = Object.keys(st).map(function (k) { var p = (st[k] && st[k][0]) || {}; var pres = Object.assign({}, p); delete pres.presence_ref; return { by: k, isMe: k === me, kind: 'viewer', presence: pres }; });
            last = { peers: peers }; peersFns.forEach(function (f) { try { f(last); } catch (e) {} });
          });
          return new Promise(function (res) { ch.subscribe(function (status) { if (status === 'SUBSCRIBED') res({ c: c, ch: ch }); }); });
        });
        return chP;
      }
      return {
        presence: function (obj) { return channel().then(function (x) { return x.ch.track(obj || {}); }); },
        onPeers: function (fn) { peersFns.push(fn); channel(); if (last) fn(last); },
        emit: function (topic, data) {
          return getClient().then(function (c) {
            var to = data && typeof data.to === 'string' && UUID.test(data.to) ? data.to : null;
            return c.sb.from('msgs').insert({ topic: topic, recipient: to, data: data || {} }).then(function (res) { if (res.error) throw denied(res.error); });
          });
        },
        // Messages come from the database, so the sender (by) is the real signed-in player, never what a client claims.
        on: function (topic, fn) {
          getClient().then(function (c) {
            if (msgCh[topic]) { msgCh[topic].fns.push(fn); return; }
            var rec = { fns: [fn] }; msgCh[topic] = rec;
            rec.ch = c.sb.channel('msgs-' + topic).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'msgs', filter: 'topic=eq.' + topic }, function (p) {
              var r = p.new; if (!r || r.sender === c.uid) return;
              rec.fns.forEach(function (f) { try { f({ by: r.sender, data: r.data }); } catch (e) {} });
            }).subscribe();
          });
        }
      };
    })();

    var spaces = { db: db, user: user, room: room };
    return { use: function (name) { if (!cache[name]) cache[name] = getClient().then(function () { return spaces[name] || null; }, function () { return null; }); return cache[name]; }, online: 'supabase' };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { make: make }; return; }

  var C = root.LASGIDI_ONLINE || {};
  if (root.claude || !C.url || !C.anon) return;
  // Accept the address as Supabase shows it in places (…/rest/v1/) as well as the bare project URL.
  C = { url: String(C.url).trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, ''), anon: String(C.anon).trim() };
  var ready = null;
  function loadLib() {
    if (root.supabase && root.supabase.createClient) return Promise.resolve();
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'vendor/supabase.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function getClient() {
    if (ready) return ready;
    ready = loadLib().then(function () {
      var sb = root.supabase.createClient(C.url, C.anon, { auth: { persistSession: true, storageKey: 'lasgidi.sb.v1' } });
      return sb.auth.getSession().then(function (r) {
        if (r.data && r.data.session) return r.data.session;
        return sb.auth.signInAnonymously().then(function (x) { if (x.error) throw x.error; return x.data.session; });
      }).then(function (sess) { return { sb: sb, uid: sess.user.id }; });
    });
    return ready;
  }
  root.claude = make(getClient);
})(typeof window !== 'undefined' ? window : this);
