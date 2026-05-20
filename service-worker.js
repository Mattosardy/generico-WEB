const CURURU_CACHE_VERSION = 'cururu-pwa-v2-20260520-supabase-new';
const CURURU_STATIC_CACHE = CURURU_CACHE_VERSION;

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/css/style.css?v=20260519-exif-cleanup',
    '/js/config.js?v=20260519-telegram-security-lite',
    '/js/utils.js?v=20260519-exif-cleanup',
    '/js/notifications.js?v=20260519-telegram-security-lite',
    '/js/auth.js?v=20260519-telegram-security-lite',
    '/js/public.js?v=20260520-plan-plus',
    '/js/socio.js?v=20260519-stock-packs-utf8',
    '/js/modals.js?v=20260520-plan-plus',
    '/js/admin.js?v=20260520-plan-plus',
    '/js/maestro.js?v=20260519-exif-cleanup',
    '/js/main.js?v=20260520-pwa',
    '/assets/images/logo.png',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
    '/assets/icons/apple-touch-icon.png',
    '/assets/icons/maskable-icon-512.png'
];

function isLocalStaticRequest(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return false;
    if (url.origin !== self.location.origin) return false;
    if (url.pathname.startsWith('/rest/')) return false;
    if (url.pathname.startsWith('/auth/')) return false;
    if (url.pathname.startsWith('/storage/')) return false;
    if (url.pathname.startsWith('/functions/')) return false;
    if (url.pathname.startsWith('/cdn-cgi/')) return false;
    if (url.pathname === '/js/supabase-client.js') return false;
    return true;
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
    if (!isLocalStaticRequest(request)) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CURURU_STATIC_CACHE).then((cache) => cache.put('/index.html', copy));
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(request)
            .then((cached) => cached || fetch(request).then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CURURU_STATIC_CACHE).then((cache) => cache.put(request, copy));
                }
                return response;
            }))
    );
});
