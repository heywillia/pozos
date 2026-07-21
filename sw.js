// Service worker v2
// - HTML y config: RED PRIMERO (siempre la última versión; cache solo como respaldo offline)
// - Íconos y manifest: cache primero (no cambian seguido)
const CACHE = 'mapa-pozos-v2';
const ASSETS = ['./', './index.html', './config.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Supabase, mapas, Nominatim: directo a la red

  const esHTML = e.request.mode === 'navigate' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('index.html') ||
                 url.pathname.endsWith('config.js');

  if (esHTML) {
    // red primero: si hay internet, siempre la versión nueva
    e.respondWith(
      fetch(e.request).then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return r;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // íconos/manifest: cache primero
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
