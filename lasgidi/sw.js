/* Offline cache: the game's files are cached on install (the online library, vendor/supabase.js, only when a page asks for it). The shop's /api/ calls always go to the network. */
const CACHE = 'lasgidi-v197';
const FILES = ['./', 'index.html', 'src/styles.css', 'src/data.js', 'src/engine.js', 'src/icons.js', 'src/playground.js', 'src/gl3d.js', 'src/music.js', 'src/interior.js', 'src/home3d.js', 'src/avatar.js', 'src/avatar3d.js', 'src/images.js', 'src/danfo.js', 'src/danceoff.js', 'src/hawker.js', 'src/bole.js', 'src/quiz.js', 'src/gov.js', 'src/chat.js', 'src/cruise.js', 'src/cruise3d.js', 'src/airport.js', 'src/airport3d.js', 'src/city3d.js', 'src/ride3d.js', 'src/games3d.js', 'src/hall3d.js', 'src/beach3d.js', 'src/venue.js', 'src/arcade.js', 'src/street3d.js', 'src/online-config.js', 'src/claude-shim.js', 'src/ui.js', 'vendor/three.min.js', 'manifest.webmanifest', 'icon.svg'];
// Install with fresh copies (cache: 'reload' skips the browser's own HTTP cache, so an update never caches old files).
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
// The page and the game's own code and styles: network first, so an update shows on the next load; the cache only when
// offline. Big libraries and pictures: cache first.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.indexOf('/api/') === 0) return; // live shop answers: never cached
  const own = url.origin === location.origin, fresh = own && (e.request.mode === 'navigate' || /\.(html|css|js|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/')) && !/\/vendor\//.test(url.pathname);
  const save = res => { if (res.ok && own) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; };
  if (fresh) { e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(save).catch(() => caches.match(e.request).then(hit => hit || caches.match('index.html')))); return; }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(save).catch(() => caches.match('index.html'))));
});
