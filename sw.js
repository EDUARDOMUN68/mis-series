const CACHE = 'mis-series-1.0.2';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg', './catalog.css', './catalog-core.js', './catalog.js', './tmdb.svg'];
self.addEventListener('message', event => {
  if (event.data === 'SERIES_CACHE_VERSION') event.ports[0]?.postMessage(CACHE);
});
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mis-series-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Do not cache third-party API requests or credentials.
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  const allowed = ASSETS.some(asset => new URL(asset, self.registration.scope).pathname === url.pathname);
  if (!allowed) return;
  event.respondWith(fetch(event.request, {cache:'no-store'}).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(url.pathname, copy))); }
    return response;
  }).catch(() => caches.match(url.pathname).then(r => r || caches.match(event.request))));
});
