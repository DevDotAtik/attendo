const CACHE_NAME = 'attendsheets-shell-v1';
const STATIC_ASSETS = ['/', '/login', '/register', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Security rule: NEVER cache any API attendance or auth mutations
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  // Network-first for dynamic navigation, cache fallback for app shell
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
