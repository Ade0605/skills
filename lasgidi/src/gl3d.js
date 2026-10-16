/* Lasgidi: one place for the 3D renderers' phone and speed rules (three.js).
   - make(o): a WebGLRenderer with the shared lite rule (the html.lite class, a small screen, 4 or fewer cores, or
     4GB or less memory): pixel ratio 1, no antialias. Returns null without WebGL.
   - shadow(n): a shadow-map size, capped at 1024 in lite.
   - live(el): should this view draw now? Not when the tab is hidden, the element has left the page, or a
     full-screen view (a walk-in, the cruise, a room, the airport, a mini-game, a ride, photo mode) sits over it.
   - pace(renderer): call once a frame; when frames are slow (about 40ms on average over 2s) the pixel ratio
     steps down (to 0.75 at least), and back up when they are quick again.
   - free(renderer): dispose it and give the context back, for views that close.
   Drawing only: nothing here touches the game. */
(function (root) {
  'use strict';
  var OVERLAYS = '.cruise-view, #danfo-overlay, .ride-view, #photo-view';
  function lite() {
    var d = root.document && root.document.documentElement, n = root.navigator || {};
    return !!(d && d.classList.contains('lite')) || (root.innerWidth || 1000) < 700 || (n.hardwareConcurrency || 8) <= 4 || (n.deviceMemory || 8) <= 4;
  }
  // Low-end hardware, ignoring screen size and the user's setting (used to turn lite on by default).
  function lowEnd() { var n = root.navigator || {}; return (n.hardwareConcurrency || 8) <= 4 || (n.deviceMemory || 8) <= 4; }
  var made = [];
  function make(o) {
    var T = root.THREE; o = o || {}; if (!T) return null;
    var L = lite(), r;
    try { r = new T.WebGLRenderer({ antialias: !L && o.antialias !== false, alpha: !!o.alpha, preserveDrawingBuffer: !!o.preserve }); } catch (e) { return null; }
    var base = Math.min(L ? 1 : (o.maxRatio || 2), root.devicePixelRatio || 1);
    r.setPixelRatio(base); r.userData = { base: base, ratio: base, ema: 16, last: 0, slow: 0, quick: 0 };
    if (o.shadows !== false) { r.shadowMap.enabled = true; if (T.PCFSoftShadowMap != null && !L) r.shadowMap.type = T.PCFSoftShadowMap; }
    made.push(r); return r;
  }
  function shadow(n) { return lite() ? Math.min(n, 1024) : n; }
  function covered(el) {
    var doc = root.document; if (!doc) return false;
    var mine = el.closest ? el.closest(OVERLAYS) : null, all = doc.querySelectorAll(OVERLAYS);
    for (var i = 0; i < all.length; i++) {
      var ov = all[i]; if (ov === mine || ov.contains(el)) continue;
      if (!mine) return true;                                                   // the map or home under any full-screen view
      if (mine.compareDocumentPosition(ov) & 4) return true;                    // a view opened after (on top of) this one
    }
    return false;
  }
  function live(el) { return !!el && el.isConnected && !(root.document && root.document.hidden) && !covered(el); }
  function pace(r) {
    var u = r && r.userData; if (!u || u.base == null) return;
    var now = (root.performance || Date).now(), dt = u.last ? now - u.last : 16; u.last = now;
    if (dt > 250) return; // a pause, not a slow frame
    u.ema += (dt - u.ema) * 0.05;
    if (u.ema > 40) { u.slow += dt; u.quick = 0; } else if (u.ema < 22) { u.quick += dt; u.slow = 0; } else { u.slow = u.quick = 0; }
    if (u.slow > 2000 && u.ratio > 0.75) { u.ratio = Math.max(0.75, +(u.ratio * 0.8).toFixed(2)); r.setPixelRatio(u.ratio); u.slow = 0; u.ema = 30; }
    else if (u.quick > 4000 && u.ratio < u.base) { u.ratio = Math.min(u.base, +(u.ratio * 1.25).toFixed(2)); r.setPixelRatio(u.ratio); u.quick = 0; }
  }
  function free(r) { if (!r) return; try { r.dispose(); if (r.forceContextLoss) r.forceContextLoss(); } catch (e) {} var i = made.indexOf(r); if (i >= 0) made.splice(i, 1); }
  root.LasgidiGL = { make: make, shadow: shadow, live: live, covered: covered, pace: pace, free: free, lite: lite, lowEnd: lowEnd, count: function () { return made.length; }, all: function () { return made.slice(); } };
})(typeof window !== 'undefined' ? window : this);
