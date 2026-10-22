// Service worker: tiene in cache solo l'app. Windy, Open-Meteo e le mappe
// vanno sempre in rete (le immagini Windy scadono e non si salvano).

const CACHE = 'wi-v2';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'data/osm-webcams.json',
  'js/app.js',
  'js/detail.js',
  'js/favorites.js',
  'js/format.js',
  'js/geo.js',
  'js/geocode.js',
  'js/list.js',
  'js/map.js',
  'js/osm.js',
  'js/settings.js',
  'js/weather.js',
  'js/windy.js',
  'vendor/leaflet.js',
  'vendor/leaflet.css',
  'vendor/leaflet.markercluster.js',
  'vendor/MarkerCluster.css',
  'vendor/MarkerCluster.Default.css',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
