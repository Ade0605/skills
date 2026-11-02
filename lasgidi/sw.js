/* Offline cache: the game's files are cached on install (the online library, vendor/supabase.js, only when a page asks for it). The shop's /api/ calls always go to the network. */
const CACHE = 'lasgidi-v220';
const FILES = ['./', 'index.html', 'src/styles.css', 'src/data.js', 'src/engine.js', 'src/icons.js', 'src/playground.js', 'src/gl3d.js', 'src/music.js', 'src/interior.js', 'src/home3d.js', 'src/avatar.js', 'src/avatar3d.js', 'src/models3d.js', 'src/road3d.js', 'src/images.js', 'src/danfo.js', 'src/danceoff.js', 'src/hawker.js', 'src/bole.js', 'src/quiz.js', 'src/gov.js', 'src/chat.js', 'src/cruise.js', 'src/cruise3d.js', 'src/airport.js', 'src/airport3d.js', 'src/city3d.js', 'src/ride3d.js', 'src/games3d.js', 'src/hall3d.js', 'src/beach3d.js', 'src/venue.js', 'src/arcade.js', 'src/street3d.js', 'src/online-config.js', 'src/claude-shim.js', 'src/ui.js', 'vendor/three.min.js', 'manifest.webmanifest', 'icon.svg'];
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
  // Network first, but never hang on a slow or stalled connection: after 2.5 s use the saved copy (the network answer
  // still refreshes the cache for next time). With nothing saved yet, wait for the network as before.
  if (fresh) {
    const net = fetch(e.request, { cache: 'no-cache' }).then(save);
    e.respondWith(caches.match(e.request).then(hit => {
      if (!hit) return net.catch(() => caches.match('index.html'));
      const late = new Promise(res => setTimeout(() => res(hit), 2500));
      return Promise.race([net.catch(() => hit), late]);
    }));
    e.waitUntil(net.catch(() => null));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(save).catch(() => caches.match('index.html'))));
});
// A run reminder was tapped: bring the game's tab forward, or open it.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow ? self.clients.openWindow('./') : null;
  }));
});
