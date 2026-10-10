/* Lasgidi — your Lagosian, drawn on a canvas from your look and outfit. */
(function (root) {
  'use strict';
  var D = root.LASGIDI_DATA;

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = f < 0 ? 0 : 255, p = Math.abs(f);
    return 'rgb(' + Math.round((t - r) * p + r) + ',' + Math.round((t - g) * p + g) + ',' + Math.round((t - b) * p + b) + ')';
  }

  // A fill for a garment: plain colour or a fabric pattern.
  function fabricFill(ctx, c) {
    if (!c) return '#f4f3ec';
    if (c.fabric === 'plain' || !c.alt && c.fabric !== 'lace' && c.fabric !== 'denim') return c.color;
    var t = document.createElement('canvas'); t.width = t.height = 16;
    var g = t.getContext('2d');
    g.fillStyle = c.color; g.fillRect(0, 0, 16, 16);
    if (c.fabric === 'ankara') {
      g.fillStyle = c.alt; g.beginPath(); g.arc(8, 8, 4.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = shade(c.color, 0.35); g.beginPath(); g.arc(8, 8, 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = c.alt; g.fillRect(0, 0, 3, 3); g.fillRect(13, 13, 3, 3);
    } else if (c.fabric === 'asooke') {
      g.fillStyle = c.alt; g.fillRect(3, 0, 2, 16); g.fillRect(11, 0, 1, 16);
      g.fillStyle = shade(c.color, -0.2); g.fillRect(7, 0, 2, 16);
    } else if (c.fabric === 'lace') {
      g.fillStyle = c.alt || shade(c.color, 0.4);
      [[3, 3], [11, 3], [7, 8], [3, 13], [11, 13]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 1.6, 0, Math.PI * 2); g.fill(); });
    } else if (c.fabric === 'denim') {
      g.strokeStyle = shade(c.color, 0.15); g.lineWidth = 1;
      for (var i = -16; i < 32; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 16); g.stroke(); }
    }
    return ctx.createPattern(t, 'repeat');
  }

  function draw(canvas, look, outfit) {
    var dpr = Math.min(2, root.devicePixelRatio || 1), W = 180, H = 260;
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var skin = D.LOOKS.skin[look.skin] || D.LOOKS.skin[2], k = [0.86, 1, 1.18][look.shape] || 1;
    var o = outfit || {}, C = function (slot) { return o[slot] ? D.CLOTHES[o[slot]] : null; };
    var top = C('top'), bottom = C('bottom'), dress = C('dress'), shoes = C('shoes'), head = C('head'), acc = C('acc');
    var cx = 90, sw = 34 * k, hw = 30 * k;

    function shape(pts, fill) { ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    // Ground shadow.
    ctx.beginPath(); ctx.ellipse(cx, 246, 46 * k, 7, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fill();
    // Legs and arms (skin), drawn under clothes.
    shape([[cx - 14 * k, 150], [cx - 2, 150], [cx - 4, 236], [cx - 14 * k, 236]], skin);
    shape([[cx + 2, 150], [cx + 14 * k, 150], [cx + 14 * k, 236], [cx + 4, 236]], skin);
    shape([[cx - sw - 8, 84], [cx - sw + 2, 84], [cx - sw - 2, 160], [cx - sw - 12, 160]], skin);
    shape([[cx + sw - 2, 84], [cx + sw + 8, 84], [cx + sw + 12, 160], [cx + sw + 2, 160]], skin);
    // Hair behind the head.
    var hair = D.LOOKS.hair[look.hair] || 'Low cut', hc = '#1a1410';
    if (!head || head.slot !== 'head' || head.name === 'Face cap') {
      if (hair === 'Afro') { ctx.beginPath(); ctx.arc(cx, 44, 36, 0, Math.PI * 2); ctx.fillStyle = hc; ctx.fill(); }
      if (hair === 'Braids' || hair === 'Locs') {
        ctx.fillStyle = hc;
        for (var i = 0; i < 6; i++) { var bx = cx - 26 + i * 10.4; ctx.fillRect(bx, 40, hair === 'Locs' ? 6 : 3.5, 62 + (i % 2) * 6); }
      }
    }
    // Neck and head.
    shape([[cx - 7, 62], [cx + 7, 62], [cx + 8, 82], [cx - 8, 82]], shade(skin, -0.08));
    ctx.beginPath(); ctx.ellipse(cx, 44, 22, 25, 0, 0, Math.PI * 2); ctx.fillStyle = skin; ctx.fill();
    ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(cx - 8, 44, 2.2, 0, Math.PI * 2); ctx.arc(cx + 8, 44, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(skin, -0.45); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, 52, 7, 0.25, Math.PI - 0.25); ctx.stroke();
    // Hair on top.
    ctx.fillStyle = hc;
    if (hair !== 'Bald' && !(head && head.name !== 'Face cap')) {
      ctx.beginPath(); ctx.ellipse(cx, 30, 23, hair === 'Low cut' ? 10 : 14, 0, Math.PI, 0); ctx.fill();
      if (hair === 'Cornrows') { ctx.strokeStyle = shade(skin, -0.2); ctx.lineWidth = 1; for (var r = -15; r <= 15; r += 6) { ctx.beginPath(); ctx.moveTo(cx + r, 18); ctx.lineTo(cx + r * 1.2, 32); ctx.stroke(); } }
      if (hair === 'Bantu knots') [[-14, 20], [0, 14], [14, 20], [-20, 32], [20, 32]].forEach(function (p) { ctx.beginPath(); ctx.arc(cx + p[0], p[1], 5.5, 0, Math.PI * 2); ctx.fill(); });
      if (hair === 'Short twists') for (var tw = -18; tw <= 18; tw += 6) { ctx.beginPath(); ctx.arc(cx + tw, 20 + Math.abs(tw) / 4, 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // Garments.
    if (dress) {
      var flare = dress.name.indexOf('agbada') >= 0 || dress.name.indexOf('Agbada') >= 0 ? 34 : dress.name.indexOf('gown') >= 0 || dress.name.indexOf('iro') >= 0 ? 18 : 8;
      shape([[cx - sw, 80], [cx + sw, 80], [cx + hw + flare, 222], [cx - hw - flare, 222]], fabricFill(ctx, dress));
      if (flare >= 30) { shape([[cx - sw, 82], [cx - sw - 26, 150], [cx - sw - 6, 156], [cx - sw + 6, 100]], fabricFill(ctx, dress)); shape([[cx + sw, 82], [cx + sw + 26, 150], [cx + sw + 6, 156], [cx + sw - 6, 100]], fabricFill(ctx, dress)); }
    } else {
      var t = top || { color: '#f4f3ec', fabric: 'plain' }, bt = bottom;
      if (bt && (bt.name.indexOf('wrapper') >= 0 || bt.name.indexOf('skirt') >= 0 || bt.name.indexOf('Wrapper') >= 0)) {
        shape([[cx - hw, 138], [cx + hw, 138], [cx + hw + 8, 206], [cx - hw - 8, 206]], fabricFill(ctx, bt));
      } else {
        var bf = bt ? fabricFill(ctx, bt) : '#7b7f86';
        var len = bt ? 232 : 182;
        shape([[cx - hw, 138], [cx - 1, 138], [cx - 3, len], [cx - hw + 2, len]], bf);
        shape([[cx + 1, 138], [cx + hw, 138], [cx + hw - 2, len], [cx + 3, len]], bf);
      }
      shape([[cx - sw, 80], [cx + sw, 80], [cx + hw + 4, 146], [cx - hw - 4, 146]], fabricFill(ctx, t));
      shape([[cx - sw, 80], [cx - sw - 12, 112], [cx - sw - 2, 116], [cx - sw + 6, 96]], fabricFill(ctx, t));
      shape([[cx + sw, 80], [cx + sw + 12, 112], [cx + sw + 2, 116], [cx + sw - 6, 96]], fabricFill(ctx, t));
    }
    // Shoes.
    var sc = shoes ? shoes.color : '#4b4f55';
    ctx.fillStyle = sc; ctx.beginPath(); ctx.ellipse(cx - 9 * k, 238, 11, 5, 0, 0, Math.PI * 2); ctx.ellipse(cx + 9 * k, 238, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Headwear.
    if (head) {
      if (head.name === 'Gele') {
        ctx.fillStyle = fabricFill(ctx, head);
        ctx.beginPath(); ctx.moveTo(cx - 34, 30); ctx.quadraticCurveTo(cx - 20, -6, cx, 4); ctx.quadraticCurveTo(cx + 26, -10, cx + 40, 24); ctx.quadraticCurveTo(cx + 10, 34, cx - 34, 30); ctx.fill();
      } else if (head.name === 'Fila cap') {
        ctx.fillStyle = fabricFill(ctx, head);
        ctx.beginPath(); ctx.moveTo(cx - 22, 28); ctx.lineTo(cx + 22, 28); ctx.lineTo(cx + 30, 8); ctx.quadraticCurveTo(cx, 0, cx - 20, 10); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = head.color; ctx.beginPath(); ctx.ellipse(cx, 26, 23, 12, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(cx - 4, 24, 30, 5);
      }
    }
    // Accessories.
    if (acc) {
      if (acc.name === 'Coral beads') { ctx.fillStyle = acc.color; for (var b = -3; b <= 3; b++) { ctx.beginPath(); ctx.arc(cx + b * 5, 84 + Math.abs(b) * -1.2 + 2, 2.8, 0, Math.PI * 2); ctx.fill(); } }
      else if (acc.name === 'Luxury watch') { ctx.fillStyle = acc.color; ctx.fillRect(cx + sw + 4, 150, 9, 6); }
      else { ctx.strokeStyle = acc.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, 84, 15, 0.2, Math.PI - 0.2); ctx.stroke(); }
    }
  }

  root.LasgidiAvatar = { draw: draw };
})(typeof globalThis !== 'undefined' ? globalThis : this);
