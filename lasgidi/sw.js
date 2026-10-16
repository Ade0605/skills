/* Offline cache: the game's files are cached on install. The shop's /api/ calls always go to the network. */
const CACHE = 'lasgidi-v119';
const FILES = ['./', 'index.html', 'src/styles.css', 'src/data.js', 'src/engine.js', 'src/icons.js', 'src/playground.js', 'src/interior.js', 'src/avatar.js', 'src/images.js', 'src/danfo.js', 'src/danceoff.js', 'src/hawker.js', 'src/bole.js', 'src/quiz.js', 'src/gov.js', 'src/chat.js', 'src/cruise.js', 'src/airport.js', 'src/airport3d.js', 'src/beach3d.js', 'src/venue.js', 'src/ui.js', 'vendor/three.min.js', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).pathname.indexOf('/api/') === 0) return; // live shop answers: never cached
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match('index.html'))));
});
