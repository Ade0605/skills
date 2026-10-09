/* Lasgidi — your home, inside: an isometric room you furnish.
 * Draws the floor and two back walls for the current home type, every
 * placed item as a simple iso model, and the driveway with your vehicles.
 * Pointer: tap an item to select it, tap a floor tile (or drag the item)
 * to move it. All changes go through the engine via callbacks. */
(function (root) {
  'use strict';
  var D = root.LASGIDI_DATA;
  var TW = 36, TH = 18, WALL = 70;

  var FLOORS = {
    room: ['#9a958b', '#918c82'], share: ['#b8ab92', '#ad9f86'], selfcon: ['#d8ccb4', '#cfc2a8'], miniflat: ['#d8ccb4', '#cfc2a8'],
    flat2: ['#cdb79a', '#c2ab8c'], flat3: ['#cdb79a', '#c2ab8c'], duplex: ['#a77b52', '#9b7049'],
    luxury: ['#e9e6df', '#2a2b2e'], mansion: ['#efece4', '#d9d3c4']
  };
  var WALLS = { room: '#c9bfa6', share: '#d6ccb4', selfcon: '#e2dccd', miniflat: '#e2dccd', flat2: '#e7e1d2', flat3: '#e7e1d2', duplex: '#efe9dc', luxury: '#2f3136', mansion: '#f4f1ea' };

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = f < 0 ? 0 : 255, p = Math.abs(f);
    return 'rgb(' + Math.round((t - r) * p + r) + ',' + Math.round((t - g) * p + g) + ',' + Math.round((t - b) * p + b) + ')';
  }

  function create(opts) {
    var wrap = document.createElement('div'); wrap.className = 'iv';
    var canvas = document.createElement('canvas'); canvas.className = 'iv-canvas'; canvas.setAttribute('role', 'img');
    wrap.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var view = null, W = 0, H = 0, dpr = 1, s = 1, ox = 0, oy = 0, hits = [], drag = null, hover = null;
    var emojiFont = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

    function iso(x, y, z) { return { x: ox + (x - y) * TW / 2 * s, y: oy + (x + y) * TH / 2 * s - (z || 0) * s }; }
    function fromScreen(sx, sy) {
      var a = (sx - ox) / (TW / 2 * s), b = (sy - oy) / (TH / 2 * s);
      return { x: (a + b) / 2, y: (b - a) / 2 };
    }

    function fit() {
      var r = wrap.getBoundingClientRect();
      var w = Math.max(260, Math.round(r.width)), h = Math.round(w * (w < 600 ? 0.8 : 0.58));
      dpr = Math.min(2, root.devicePixelRatio || 1);
      if (w !== W || h !== H) { W = w; H = h; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.height = H + 'px'; }
      var sz = view.size, gw = sz[0] + 4, gd = sz[1] + 2.5; // room, driveway and front lawn
      var spanX = (gw + gd) * TW / 2, spanY = (gw + gd) * TH / 2 + WALL + 30;
      s = Math.min(W / spanX, H / spanY) * 0.94;
      ox = W / 2 - ((gw - gd) * TW / 2 * s) / 2;
      oy = (H - spanY * s) / 2 + (WALL + 22) * s;
    }

    function poly(pts, fill, stroke) {
      ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    }
    // An iso box from (x, y) with size (w, d), from height z0 to z1 (px).
    function box(x, y, w, d, z0, z1, color, top) {
      var a = iso(x, y, z1), b = iso(x + w, y, z1), c = iso(x + w, y + d, z1), e = iso(x, y + d, z1);
      var b0 = iso(x + w, y, z0), c0 = iso(x + w, y + d, z0), e0 = iso(x, y + d, z0);
      poly([b, c, c0, b0], shade(color, -0.25));
      poly([e, c, c0, e0], shade(color, -0.1));
      poly([a, b, c, e], top || color);
    }

    function drawItem(it, f, ghost) {
      var dims = it.r ? [f.d, f.w] : [f.w, f.d], x = it.x, y = it.y, w = dims[0], d = dims[1], c = f.color, h = f.h;
      ctx.globalAlpha = ghost ? 0.55 : 1;
      var ins = 0.08;
      switch (f.shape) {
        case 'rug':
          poly([iso(x + ins, y + ins), iso(x + w - ins, y + ins), iso(x + w - ins, y + d - ins), iso(x + ins, y + d - ins)], c);
          poly([iso(x + 0.35, y + 0.35), iso(x + w - 0.35, y + 0.35), iso(x + w - 0.35, y + d - 0.35), iso(x + 0.35, y + d - 0.35)], null, 'rgba(255,220,120,.8)');
          break;
        case 'bed':
          box(x + ins, y + ins, w - 2 * ins, d - 2 * ins, 0, h * 0.6, '#6b4a2f');
          box(x + ins + 0.05, y + ins + 0.05, w - 2 * ins - 0.1, d - 2 * ins - 0.1, h * 0.6, h, '#f1ede4', c);
          var px = it.r ? x + ins : x + ins, py = it.r ? y + ins : y + ins;
          box(px + 0.1, py + 0.1, it.r ? w - 0.3 : 0.45, it.r ? 0.4 : d - 0.3, h, h + 2.5, '#ffffff');
          break;
        case 'sofa':
          box(x + ins, y + ins, w - 2 * ins, d - 2 * ins, 0, h * 0.55, c);
          if (it.r) box(x + ins, y + ins, 0.3, d - 2 * ins, h * 0.55, h * 1.3, shade(c, -0.1));
          else box(x + ins, y + ins, w - 2 * ins, 0.3, h * 0.55, h * 1.3, shade(c, -0.1));
          break;
        case 'table':
          [[0.15, 0.15], [w - 0.25, 0.15], [0.15, d - 0.25], [w - 0.25, d - 0.25]].forEach(function (l) { box(x + l[0], y + l[1], 0.1, 0.1, 0, h - 1, '#5a4330'); });
          box(x + ins, y + ins, w - 2 * ins, d - 2 * ins, h - 1, h, c);
          break;
        case 'chair':
          box(x + 0.2, y + 0.2, 0.6, 0.6, 0, h * 0.5, c);
          box(x + 0.2, y + 0.2, 0.6, 0.15, h * 0.5, h * 1.4, c);
          break;
        case 'plant':
          box(x + 0.3, y + 0.3, 0.4, 0.4, 0, 4, '#b5603c');
          var p = iso(x + 0.5, y + 0.5, 4 + h);
          ctx.beginPath(); ctx.arc(p.x, p.y, 7 * s, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
          break;
        case 'pole':
          box(x + 0.35, y + 0.35, 0.3, 0.3, 0, h, c);
          var q = iso(x + 0.5, y + 0.5, h);
          ctx.beginPath(); ctx.arc(q.x, q.y, 5 * s, 0, Math.PI * 2); ctx.fillStyle = shade(c, 0.2); ctx.fill();
          break;
        case 'tv':
          box(x + 0.15, y + 0.3, w - 0.3, d - 0.6, 0, 3, '#3a2f28');
          if (it.r) box(x + 0.45, y + 0.1, 0.1, d - 0.2, 3, h + 3, c, '#2a4a6a');
          else box(x + 0.1, y + 0.45, w - 0.2, 0.1, 3, h + 3, c, '#2a4a6a');
          break;
        case 'wallbox':
          box(x + 0.15, y + 0.15, w - 0.3, Math.min(0.35, d - 0.3), h, h + 6, c);
          break;
        default:
          box(x + ins, y + ins, w - 2 * ins, d - 2 * ins, 0, h, c);
      }
      ctx.globalAlpha = 1;
    }

    function drawCar(x, y, V, z) {
      box(x, y, 1.6, 0.8, 1, 5, V.color);
      box(x + 0.35, y + 0.08, 0.8, 0.64, 5, 8.5, shade(V.color, 0.1), '#9fc3d8');
      [[0.25, -0.02], [1.15, -0.02], [0.25, 0.72], [1.15, 0.72]].forEach(function (wpos) { box(x + wpos[0], y + wpos[1], 0.25, 0.1, 0, 2, '#1c1d20'); });
    }

    function draw() {
      if (!view) return;
      fit();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var sz = view.size, type = view.type, fl = FLOORS[type] || FLOORS.room, wall = WALLS[type] || WALLS.room;
      // Lawn and driveway.
      poly([iso(-1, -1), iso(sz[0] + 4, -1), iso(sz[0] + 4, sz[1] + 1.5), iso(-1, sz[1] + 1.5)], view.dark ? '#2f3d2c' : '#b9cf9a');
      poly([iso(sz[0] + 0.4, 0), iso(sz[0] + 3.6, 0), iso(sz[0] + 3.6, sz[1]), iso(sz[0] + 0.4, sz[1])], view.dark ? '#3a3b3e' : '#c9c6bf');
      // Back walls with windows.
      poly([iso(0, 0, WALL), iso(sz[0], 0, WALL), iso(sz[0], 0), iso(0, 0)], shade(wall, -0.06));
      poly([iso(0, 0, WALL), iso(0, sz[1], WALL), iso(0, sz[1]), iso(0, 0)], shade(wall, -0.16));
      for (var wx = 1; wx < sz[0] - 0.5; wx += 2.5) poly([iso(wx, 0, WALL * 0.75), iso(wx + 1, 0, WALL * 0.75), iso(wx + 1, 0, WALL * 0.35), iso(wx, 0, WALL * 0.35)], view.power || view.hour < 18 && view.hour >= 7 ? '#a9d4ea' : '#2a3a4a');
      // Floor tiles.
      for (var ty = 0; ty < sz[1]; ty++) for (var tx = 0; tx < sz[0]; tx++) {
        var hl = hover && hover.x === tx && hover.y === ty;
        poly([iso(tx, ty), iso(tx + 1, ty), iso(tx + 1, ty + 1), iso(tx, ty + 1)], hl ? '#f2d36b' : fl[(tx + ty) % 2], 'rgba(0,0,0,.06)');
      }
      // Items, back to front.
      hits = [];
      var list = view.items.map(function (it, i) { return { it: it, i: i }; }).filter(function (o) { return o.it.x != null; });
      list.sort(function (a, b) { return (a.it.x + a.it.y) - (b.it.x + b.it.y); });
      list.forEach(function (o) {
        var f = D.FURNITURE[o.it.id];
        var moving = drag && drag.idx === o.i && drag.to;
        drawItem(o.it, f, moving);
        var dims = o.it.r ? [f.d, f.w] : [f.w, f.d];
        var c = iso(o.it.x + dims[0] / 2, o.it.y + dims[1] / 2, f.h + 4);
        hits.push({ i: o.i, x: c.x, y: c.y, r: 16 * s + 6 });
        if (o.i === view.sel) {
          ctx.lineWidth = 2.5; ctx.strokeStyle = '#f2b600';
          poly([iso(o.it.x, o.it.y), iso(o.it.x + dims[0], o.it.y), iso(o.it.x + dims[0], o.it.y + dims[1]), iso(o.it.x, o.it.y + dims[1])], null, '#f2b600');
          ctx.font = Math.round(16 * Math.max(0.8, s)) + 'px ' + emojiFont; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(f.icon, c.x, c.y - 8);
        }
      });
      if (drag && drag.to) drawItem({ id: view.items[drag.idx].id, x: drag.to.x, y: drag.to.y, r: view.items[drag.idx].r }, D.FURNITURE[view.items[drag.idx].id], true);
      // Driveway: cars, a helipad, boats at a jetty marker.
      var cars = view.vehicles.filter(function (v) { return D.VEHICLES[v.id].kind === 'car'; });
      cars.slice(0, 4).forEach(function (v, i) { drawCar(sz[0] + 1.1, 0.4 + i * 1.3, D.VEHICLES[v.id]); });
      var heli = view.vehicles.some(function (v) { return D.VEHICLES[v.id].kind === 'heli'; });
      if (heli) {
        var hp = iso(Math.max(1, sz[0] * 0.3), sz[1] + 0.85);
        ctx.beginPath(); ctx.ellipse(hp.x, hp.y, 26 * s, 13 * s, 0, 0, Math.PI * 2); ctx.fillStyle = '#4b4f55'; ctx.fill();
        ctx.font = '700 ' + Math.round(14 * s) + 'px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', hp.x, hp.y);
        ctx.font = Math.round(26 * s) + 'px ' + emojiFont; ctx.fillText('🚁', hp.x, hp.y - 16 * s);
      }
      var extra = view.vehicles.filter(function (v) { return D.VEHICLES[v.id].kind === 'boat' || D.VEHICLES[v.id].kind === 'jet'; });
      extra.forEach(function (v, i) {
        var p = iso(sz[0] + 3.4, sz[1] + 0.9 - i * 0.2);
        ctx.font = Math.round(24 * s) + 'px ' + emojiFont; ctx.textAlign = 'center'; ctx.fillText(D.VEHICLES[v.id].icon, p.x + i * 30 * s, p.y);
      });
      // NEPA: the room dims when there is no light at night.
      if (!view.power && (view.hour >= 19 || view.hour < 6)) { ctx.fillStyle = 'rgba(8,12,30,.45)'; ctx.fillRect(0, 0, W, H); }
    }

    function tileAt(e) {
      var r = canvas.getBoundingClientRect(), w = fromScreen(e.clientX - r.left, e.clientY - r.top);
      var tx = Math.floor(w.x), ty = Math.floor(w.y);
      return tx >= 0 && ty >= 0 && tx < view.size[0] && ty < view.size[1] ? { x: tx, y: ty } : null;
    }
    function itemAt(e) {
      var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 1e9;
      hits.forEach(function (h) { var dd = Math.hypot(h.x - x, h.y - y); if (dd < h.r && dd < bd) { bd = dd; best = h.i; } });
      if (best != null) return best;
      // Otherwise whatever item covers the tapped tile.
      var t = tileAt(e); if (!t) return null;
      for (var i = 0; i < view.items.length; i++) {
        var it = view.items[i]; if (it.x == null) continue;
        var f = D.FURNITURE[it.id], dm = it.r ? [f.d, f.w] : [f.w, f.d];
        if (t.x >= it.x && t.x < it.x + dm[0] && t.y >= it.y && t.y < it.y + dm[1]) return i;
      }
      return null;
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (!view) return;
      var i = itemAt(e);
      if (i != null) { drag = { idx: i, start: tileAt(e), to: null }; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); }
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!view) return;
      var t = tileAt(e);
      if (drag) {
        if (t && drag.start && (t.x !== drag.start.x || t.y !== drag.start.y)) { var it = view.items[drag.idx]; drag.to = { x: Math.max(0, t.x - (drag.start.x - it.x)), y: Math.max(0, t.y - (drag.start.y - it.y)) }; draw(); }
      } else if (e.pointerType === 'mouse') { var old = hover; hover = t; if (!old || !t || old.x !== t.x || old.y !== t.y) draw(); }
    });
    canvas.addEventListener('pointerup', function (e) {
      if (!view) return;
      var d = drag; drag = null;
      if (d && d.to) { opts.onPlace(d.idx, d.to.x, d.to.y, view.items[d.idx].r); return; }
      if (d) { opts.onSelect(d.idx); return; }
      var t = tileAt(e);
      if (t && view.sel != null) opts.onPlace(view.sel, t.x, t.y, view.items[view.sel].r);
      else opts.onSelect(null);
    });
    canvas.addEventListener('pointerleave', function () { if (hover) { hover = null; draw(); } });
    root.addEventListener('resize', function () { if (wrap.isConnected) draw(); });

    return {
      el: wrap,
      update: function (v) {
        view = v;
        canvas.setAttribute('aria-label', 'Inside your home: ' + v.name + ', ' + v.items.filter(function (i) { return i.x != null; }).length + ' items placed. Use the lists below to arrange it.');
        draw();
      }
    };
  }

  root.LasgidiInterior = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
