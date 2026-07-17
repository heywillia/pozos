// Service worker mínimo: cachea la cáscara de la app para que abra sin conexión.
// Los datos de pozos siempre van a la red (no se cachean para no mostrar info vieja).
const CACHE = 'mapa-pozos-v1';
const ASSETS = ['./', './index.html', './config.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Solo cache-first para archivos propios; todo lo externo (Supabase, mapas, Nominatim) va a la red
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
