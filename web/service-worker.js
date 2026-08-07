/* Offline app shell. Cache-first so Hittem launches with no network. */
const CACHE = 'hittem-v4';
const ASSETS = [
  '.', 'index.html', 'styles.css', 'config.js', 'google.js', 'app.js', 'manifest.webmanifest',
  'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(ASSETS.map((a) => c.add(a)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Same-origin only. Cache-first is right for the app shell and catastrophic for
  // everything else: the Google SDK, the token endpoint and the People API are all
  // cross-origin GETs, and serving those from cache would pin a stale contact list (or a
  // dead token response) for the life of the cache. Let them go to the network untouched.
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      const c = await caches.open(CACHE);
      c.put(e.request, res.clone());
      return res;
    } catch (_) {
      return cached || caches.match('index.html');
    }
  })());
});
