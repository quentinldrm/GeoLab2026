// ==================================================
// SERVICE WORKER - Cache offline et chargement rapide
// ==================================================

const CACHE_NAME = 'geolab-v2';
const STATIC_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/script_landing.js',
    '/map/map.html',
    '/map/script_map.js',
    '/icu/icu.html',
    '/icu/script_icu.js',
    '/compare/compare.html',
    '/compare/script_compare.js',
    '/utils/common.js',
    '/utils/stats_utils.js',
    '/utils/cache-manager.js',
    '/utils/geojson-loader.js',
    '/utils/geojson-worker.js',
    '/utils/preloader.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet.vectorgrid@latest/dist/Leaflet.VectorGrid.bundled.js',
    'https://cdn.jsdelivr.net/npm/@turf/turf@7.0.0/turf.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js'
];

// Installation
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Service Worker: Caching static files');
            return cache.addAll(STATIC_CACHE.map(url => new Request(url, { mode: 'no-cors' })))
                .catch(err => console.warn('Some files failed to cache:', err));
        })
    );
    self.skipWaiting();
});

// Activation
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch - Network first for .gz files, cache first for static
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Pour les fichiers .gz : toujours réseau (IndexedDB gère le cache)
    if (url.pathname.endsWith('.gz')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Pour le reste : cache first, puis réseau
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                return response;
            }
            return fetch(event.request).then(fetchResponse => {
                // Ne cache que les requêtes GET réussies
                if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type === 'error') {
                    return fetchResponse;
                }
                
                // Clone pour mettre en cache
                const responseToCache = fetchResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                
                return fetchResponse;
            });
        }).catch(() => {
            // Fallback en cas d'erreur réseau
            return caches.match('./index.html');
        })
    );
});
