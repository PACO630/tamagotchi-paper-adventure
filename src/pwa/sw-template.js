/* Tamagotchi Paper Adventure — Service Worker
 * Only caches GAME RESOURCES in Cache Storage. Player saves live in IndexedDB
 * and are never touched here: cache cleanup only deletes caches whose names
 * start with RESOURCE_PREFIX.
 */
const BUILD_ID = '__BUILD_ID__';
const RESOURCE_PREFIX = 'tpa-resources-';
const CACHE_NAME = RESOURCE_PREFIX + BUILD_ID;
const PRECACHE = __PRECACHE_LIST__;
const FONT_CACHE = 'tpa-fonts-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Add one by one so a single failure does not abort the whole install.
      await Promise.all(PRECACHE.map(async (url) => {
        try {
          const res = await fetch(new Request(url, { cache: 'reload' }));
          if (res.ok) await cache.put(url, res);
        } catch (e) { /* offline during install: will be cached at runtime */ }
      }));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith(RESOURCE_PREFIX) && k !== CACHE_NAME)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'SW_VERSION', version: BUILD_ID });
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Fonts (Noto Sans TC fallback font): cache-first in its own cache so it survives game updates
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      } catch (e) {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }
  if (url.origin !== self.location.origin) return; // PeerJS broker / STUN etc. go straight to network

  // Navigations: network first (to pick up new versions), fall back to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', res.clone());
        return res;
      } catch (e) {
        const cached = await caches.match('./index.html') || await caches.match('./');
        return cached || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Static resources: cache first, then network (and store).
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      return new Response('', { status: 504 });
    }
  })());
});
