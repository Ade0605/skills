/* Lasgidi: music and game sounds, made in the browser with WebAudio (no files, nothing copied). Original
   patterns written for the game:
   - afro:     a 3-3-2 kick, shaker sixteenths, claps on 2 and 4, a log-drum bass and off-beat chord stabs
   - highlife: a bell line, a walking bass and a guitar-like arpeggio (the wedding hall, the owambe hall)
   - fuji:     talking-drum bends over shaker and bell (street parties)
   - pad:      soft held chords and a light shaker (home)
   play(ac, style, { bpm, vol }) starts (or switches) the music on the shared AudioContext with a look-ahead
   scheduler; stop() fades it out. sfx(ac, name, arg) plays one game sound: fare, fine, pothole, crash, whistle,
   brake, hit, miss, spray, sale, wrong, siren, seized, sizzle, served, burnt, correct, buzz, sting, cheer. */
(function (root) {
  'use strict';
  var M = { style: null, timer: 0, bus: null, ac: null, next: 0, step: 0, bpm: 110 };
  var NOISE = null;
  function noiseBuf(ac) { if (NOISE && NOISE.sampleRate === ac.sampleRate) return NOISE; var n = ac.sampleRate, b = ac.createBuffer(1, n, n), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; NOISE = b; return b; }
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function osc(ac, out, type, f0, f1, t, dec, peak, a) { var o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dec); env(g, t, a || 0.004, peak, dec); o.connect(g); g.connect(out); o.start(t); o.stop(t + (a || 0.004) + dec + 0.05); return o; }
  function noise(ac, out, t, dec, peak, ftype, freq, q) { var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf(ac); f.type = ftype || 'highpass'; f.frequency.value = freq || 6000; f.Q.value = q || 0.7; env(g, t, 0.002, peak, dec); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.05); }
  var hz = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  // A major: I – vi – IV – V, one chord a bar.
  var CHORDS = [[57, 61, 64], [54, 57, 61], [50, 54, 57], [52, 56, 59]], BASS = [45, 42, 38, 40];
  var I = {
    kick: function (ac, o, t, v) { osc(ac, o, 'sine', 130, 42, t, 0.16, 0.9 * v); },
    shaker: function (ac, o, t, v) { noise(ac, o, t, 0.045, 0.12 * v, 'highpass', 7000); },
    clap: function (ac, o, t, v) { noise(ac, o, t, 0.13, 0.32 * v, 'bandpass', 1600, 1.2); noise(ac, o, t + 0.012, 0.09, 0.2 * v, 'bandpass', 1900, 1.5); },
    log: function (ac, o, t, v, m) { osc(ac, o, 'sine', hz(m) * 1.06, hz(m), t, 0.32, 0.55 * v); osc(ac, o, 'triangle', hz(m + 12), hz(m + 12) * 0.98, t, 0.12, 0.12 * v); },
    bass: function (ac, o, t, v, m) { osc(ac, o, 'triangle', hz(m), hz(m), t, 0.28, 0.4 * v); },
    stab: function (ac, o, t, v, ch) { var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200; f.connect(o); ch.forEach(function (m) { osc(ac, f, 'sawtooth', hz(m + 12), hz(m + 12), t, 0.16, 0.05 * v); }); },
    pluck: function (ac, o, t, v, m) { var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.25); f.connect(o); osc(ac, f, 'sawtooth', hz(m), hz(m), t, 0.3, 0.12 * v); },
    bell: function (ac, o, t, v, hi) { osc(ac, o, 'square', hi ? 1320 : 990, null, t, 0.07, 0.035 * v); osc(ac, o, 'sine', hi ? 2640 : 1980, null, t, 0.05, 0.03 * v); },
    talk: function (ac, o, t, v, up) { var f0 = up ? 150 : 210, o2 = ac.createOscillator(), g = ac.createGain(); o2.type = 'triangle'; o2.frequency.setValueAtTime(f0, t); o2.frequency.linearRampToValueAtTime(up ? 240 : 140, t + 0.12); o2.frequency.linearRampToValueAtTime(up ? 180 : 120, t + 0.24); env(g, t, 0.005, 0.5 * v, 0.24); o2.connect(g); g.connect(o); o2.start(t); o2.stop(t + 0.3); },
    pad: function (ac, o, t, v, ch, len) { ch.forEach(function (m, k) { var o2 = ac.createOscillator(), g = ac.createGain(); o2.type = 'sine'; o2.frequency.value = hz(m + 12) * (1 + (k - 1) * 0.002); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 * v, t + len * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + len); o2.connect(g); g.connect(o); o2.start(t); o2.stop(t + len + 0.05); }); }
  };
  // One sixteenth of each style. bar = 0..3, s = 0..15, d = one sixteenth in seconds.
  var STYLES = {
    afro: { bpm: 108, step: function (ac, o, t, bar, s, d) {
      if ([0, 3, 6, 8, 11, 14].indexOf(s) >= 0) I.kick(ac, o, t, s % 8 === 0 ? 1 : 0.7);
      I.shaker(ac, o, t, s % 4 === 2 ? 1 : s % 2 ? 0.45 : 0.7);
      if (s === 4 || s === 12) I.clap(ac, o, t, 1);
      if (s === 2 || s === 10 || (s === 13 && bar % 2)) I.log(ac, o, t, 1, BASS[bar] + (s === 13 ? 7 : 0));
      if (s % 4 === 2) I.stab(ac, o, t, 1, CHORDS[bar]);
      if (bar === 3 && s >= 12 && s % 2 === 0) I.bell(ac, o, t, 0.8, s === 14);
    } },
    highlife: { bpm: 124, step: function (ac, o, t, bar, s, d) {
      if (s === 0 || s === 8) I.kick(ac, o, t, 0.8);
      if ([0, 2, 4, 5, 7, 9, 11, 12, 14].indexOf(s) >= 0) I.bell(ac, o, t, 0.7, s === 0 || s === 7);
      if (s % 2 === 0) { var ch = CHORDS[bar]; I.pluck(ac, o, t, s % 4 ? 0.7 : 1, ch[(s / 2) % 3] + (s >= 8 ? 12 : 0)); }
      if ([0, 6, 8, 14].indexOf(s) >= 0) I.bass(ac, o, t, 1, BASS[bar] + (s === 6 ? 7 : s === 14 ? 4 : 0));
      if (s === 4 || s === 12) I.shaker(ac, o, t, 1.2);
    } },
    fuji: { bpm: 100, step: function (ac, o, t, bar, s, d) {
      if ([0, 3, 6, 8, 10, 12, 14].indexOf(s) >= 0) I.talk(ac, o, t, s === 0 ? 1 : 0.75, (s + bar) % 3 === 0);
      I.shaker(ac, o, t, s % 2 ? 0.4 : 0.8);
      if (s % 4 === 0) I.bell(ac, o, t, 0.6, s === 0);
      if (s === 0 || s === 10) I.bass(ac, o, t, 0.8, BASS[bar]);
    } },
    pad: { bpm: 84, step: function (ac, o, t, bar, s, d) {
      if (s === 0) I.pad(ac, o, t, 1, CHORDS[bar], d * 16);
      if (s % 4 === 2) I.shaker(ac, o, t, 0.35);
      if (s === 0 || s === 10) I.bass(ac, o, t, 0.5, BASS[bar] + 12);
    } }
  };
  function tick() {
    var ac = M.ac, St = STYLES[M.style]; if (!ac || !St) return;
    var d = 60 / M.bpm / 4;
    while (M.next < ac.currentTime + 0.12) {
      var st = M.step % 16, bar = Math.floor(M.step / 16) % 4, sw = st % 2 ? d * 0.08 : 0; // a little swing
      if (M.next > ac.currentTime - 0.02) St.step(ac, M.bus, M.next + sw, bar, st, d);
      M.next += d; M.step++;
    }
  }
  function play(ac, style, o) {
    o = o || {}; if (!ac || !STYLES[style]) return false;
    var bpm = o.bpm || STYLES[style].bpm;
    if (M.style === style && M.ac === ac && M.bpm === bpm) { if (o.vol && M.bus && M.vol !== o.vol) { M.vol = o.vol; M.bus.gain.setTargetAtTime(o.vol, ac.currentTime, 0.3); } return true; } // same music, maybe a new level
    stop(true);
    var bus = ac.createGain(), comp = ac.createDynamicsCompressor(); bus.gain.setValueAtTime(0.0001, ac.currentTime); bus.gain.exponentialRampToValueAtTime(o.vol || 0.22, ac.currentTime + 0.6); bus.connect(comp); comp.connect(ac.destination);
    M = { style: style, ac: ac, bus: bus, comp: comp, bpm: bpm, vol: o.vol || 0.22, next: ac.currentTime + 0.05, step: 0, timer: setInterval(tick, 25) };
    tick(); return true;
  }
  function stop(now) {
    if (M.timer) clearInterval(M.timer);
    if (M.bus && M.ac) { var t = M.ac.currentTime, b = M.bus, c = M.comp; try { b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(Math.max(0.0001, b.gain.value), t); b.gain.exponentialRampToValueAtTime(0.0001, t + (now ? 0.15 : 0.6)); setTimeout(function () { try { b.disconnect(); c.disconnect(); } catch (e) {} }, 900); } catch (e) {} }
    M = { style: null, timer: 0, bus: null, ac: null, next: 0, step: 0, bpm: 110 };
  }
  var SFX = {
    fare: function (ac, o, t) { osc(ac, o, 'sine', 1568, null, t, 0.08, 0.18); osc(ac, o, 'sine', 2093, null, t + 0.07, 0.16, 0.16); },
    fine: function (ac, o, t) { osc(ac, o, 'sawtooth', 160, 120, t, 0.35, 0.12); },
    pothole: function (ac, o, t) { osc(ac, o, 'sine', 90, 40, t, 0.2, 0.7); noise(ac, o, t, 0.12, 0.25, 'lowpass', 400); },
    crash: function (ac, o, t) { noise(ac, o, t, 0.45, 0.5, 'lowpass', 1800); osc(ac, o, 'sine', 110, 35, t, 0.3, 0.6); noise(ac, o, t + 0.05, 0.3, 0.2, 'highpass', 4000); },
    whistle: function (ac, o, t) { var w = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain(); w.frequency.value = 2900; l.frequency.value = 28; lg.gain.value = 140; l.connect(lg); lg.connect(w.frequency); env(g, t, 0.01, 0.12, 0.6); w.connect(g); g.connect(o); w.start(t); l.start(t); w.stop(t + 0.7); l.stop(t + 0.7); },
    brake: function (ac, o, t) { noise(ac, o, t, 0.35, 0.08, 'bandpass', 3200, 6); },
    hit: function (ac, o, t, lane) { osc(ac, o, 'triangle', hz(69 + [0, 4, 7, 12][lane || 0]), null, t, 0.09, 0.12); },
    miss: function (ac, o, t) { osc(ac, o, 'sine', 180, 150, t, 0.12, 0.1); },
    spray: function (ac, o, t) { [0, 4, 7, 12, 16].forEach(function (k, i) { osc(ac, o, 'sine', hz(81 + k), null, t + i * 0.05, 0.12, 0.09); }); },
    sale: function (ac, o, t) { noise(ac, o, t, 0.05, 0.2, 'highpass', 5000); osc(ac, o, 'sine', 1760, null, t + 0.04, 0.1, 0.15); osc(ac, o, 'sine', 2349, null, t + 0.11, 0.2, 0.13); },
    wrong: function (ac, o, t) { osc(ac, o, 'square', 196, 185, t, 0.22, 0.06); },
    siren: function (ac, o, t) { var s = ac.createOscillator(), g = ac.createGain(); s.type = 'sawtooth'; for (var k = 0; k < 4; k++) { s.frequency.setValueAtTime(k % 2 ? 620 : 900, t + k * 0.3); } env(g, t, 0.05, 0.05, 1.2); var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; s.connect(f); f.connect(g); g.connect(o); s.start(t); s.stop(t + 1.3); },
    seized: function (ac, o, t) { [0, -3, -7].forEach(function (k, i) { osc(ac, o, 'triangle', hz(64 + k), null, t + i * 0.12, 0.16, 0.12); }); },
    sizzle: function (ac, o, t) { noise(ac, o, t, 0.6, 0.06, 'highpass', 5200); },
    served: function (ac, o, t) { osc(ac, o, 'sine', 1318, null, t, 0.25, 0.14); },
    burnt: function (ac, o, t) { noise(ac, o, t, 0.5, 0.12, 'bandpass', 900, 0.8); osc(ac, o, 'sine', 140, 90, t, 0.3, 0.1); },
    correct: function (ac, o, t) { osc(ac, o, 'sine', 988, null, t, 0.12, 0.16); osc(ac, o, 'sine', 1319, null, t + 0.1, 0.26, 0.16); },
    buzz: function (ac, o, t) { osc(ac, o, 'sawtooth', 110, 100, t, 0.4, 0.1); },
    sting: function (ac, o, t) { [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]].forEach(function (ch, i) { ch.forEach(function (m) { osc(ac, o, 'sawtooth', hz(m), null, t + i * 0.14, i === 3 ? 0.6 : 0.12, 0.03); }); }); },
    cheer: function (ac, o, t) { var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf(ac); s.loop = true; f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.6; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); s.connect(f); f.connect(g); g.connect(o); s.start(t); s.stop(t + 1.7); }
  };
  function sfx(ac, name, arg) { if (!ac || !SFX[name]) return; try { SFX[name](ac, ac.destination, ac.currentTime + 0.01, arg); } catch (e) {} }
  root.LasgidiMusic = { play: play, stop: stop, sfx: sfx, playing: function () { return M.style; }, bpm: function () { return M.bpm; }, STYLES: Object.keys(STYLES), SFX: Object.keys(SFX) };
})(typeof window !== 'undefined' ? window : this);
