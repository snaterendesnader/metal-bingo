// Service worker: alles network-first met 3 seconden geduld, daarna de cache.
importScripts('app.js'); // CACHE, parseBands, cacheLogos

const CORE = ['./', 'index.html', 'app.js', 'manifest.json', 'icon.png', 'bands.txt'];
const TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    const bands = await (await cache.match('bands.txt')).text();
    await cacheLogos(parseBands(bands));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const network = fetch(request).then(res => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  network.catch(() => {}); // voorkomt een losse rejection als de cache al antwoordde
  const timeout = new Promise(resolve => setTimeout(resolve, TIMEOUT_MS));
  const quick = await Promise.race([network, timeout]).catch(() => undefined);
  // Traag of offline: cache als die er is, anders toch op het netwerk wachten.
  return quick || (await cache.match(request)) || network;
}
