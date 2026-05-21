const CURURU_CACHE_VERSION = 'cururu-pwa-v8-20260520-create-socio';
const CURURU_STATIC_CACHE = CURURU_CACHE_VERSION;

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/css/style.css?v=20260520-editable-portada',
    '/js/config.js?v=20260519-telegram-security-lite',
    '/js/utils.js?v=20260520-construction-media',
    '/js/notifications.js?v=20260519-telegram-security-lite',
    '/js/auth.js?v=20260519-telegram-security-lite',
    '/js/public.js?v=20260520-construction-media',
    '/js/socio.js?v=20260519-stock-packs-utf8',
    '/js/modals.js?v=20260520-construction-media',
    '/js/admin.js?v=20260520-create-socio-edge',
    '/js/maestro.js?v=20260519-exif-cleanup',
    '/js/main.js?v=20260520-safe-sw',
    '/assets/images/logo.png',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
    '/assets/icons/apple-touch-icon.png',
    '/assets/icons/maskable-icon-512.png'
];

function shouldBypassRequest(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return true;
    if (request.headers.has('range')) return true;
    if (url.origin !== self.location.origin) return true;
    if (url.pathname.includes('/functions/')) return true;
    if (url.pathname.includes('/auth/')) return true;
    if (url.pathname.includes('/rest/')) return true;
    if (url.pathname.includes('/storage/')) return true;
    if (url.pathname.startsWith('/cdn-cgi/')) return true;
    if (url.pathname === '/js/supabase-client.js') return true;
    return false;
}

function isLocalStaticRequest(request) {
    return !shouldBypassRequest(request);
}

function isCacheableStaticResponse(response) {
    return response
        && response.status === 200
        && response.type === 'basic';
}

function putStaticCache(cacheKey, response) {
    if (!isCacheableStaticResponse(response)) return Promise.resolve();
    return caches.open(CURURU_STATIC_CACHE)
        .then((cache) => cache.put(cacheKey, response.clone()))
        .catch(() => undefined);
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CURURU_STATIC_CACHE)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== CURURU_STATIC_CACHE)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (shouldBypassRequest(request)) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    putStaticCache('/index.html', response);
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(request)
            .then((cached) => cached || fetch(request).then((response) => {
                putStaticCache(request, response);
                return response;
            }))
            .catch(() => caches.match(request))
    );
});
