const CURURU_CACHE_VERSION = 'cururu-pwa-v14-20260525-pedidos';
const CURURU_APP_SHELL = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/css/style.css',
    '/js/config.js',
    '/js/utils.js',
    '/js/supabase-client.js',
    '/js/notifications.js',
    '/js/auth.js',
    '/js/public.js',
    '/js/socio.js',
    '/js/modals.js',
    '/js/admin.js',
    '/js/maestro.js',
    '/js/tour.js',
    '/js/main.js',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
    '/assets/icons/maskable-icon-512.png',
    '/assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CURURU_CACHE_VERSION)
            .then((cache) => cache.addAll(CURURU_APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith('cururu-') && key !== CURURU_CACHE_VERSION)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copia = response.clone();
                    caches.open(CURURU_CACHE_VERSION).then((cache) => cache.put('/index.html', copia));
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(request)
            .then((cached) => cached || fetch(request).then((response) => {
                if (!response || response.status !== 200) return response;
                const copia = response.clone();
                caches.open(CURURU_CACHE_VERSION).then((cache) => cache.put(request, copia));
                return response;
            }))
    );
});
