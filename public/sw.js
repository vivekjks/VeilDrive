const CACHE = 'veildrive-shell-v2';
const CORE = ['/', '/manifest.webmanifest', '/veil-mark.svg', '/assets/veil-core.png'];
const PRIVATE_ASSET_PATHS = ['/keys/', '/zkir/', '/compiler/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (PRIVATE_ASSET_PATHS.some((path) => url.pathname.startsWith(path)) || url.pathname.endsWith('.wasm')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  if (!['script', 'style', 'font', 'image'].includes(request.destination)) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    })),
  );
});
